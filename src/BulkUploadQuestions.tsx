import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download,  CheckCircle, AlertCircle, Loader2, FileText} from 'lucide-react';
import { useBrand } from './BrandContext';
import * as XLSX from 'xlsx';
import { firebaseService } from './services/firebase_service';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck, faChevronDown, faChevronUp, faGripVertical } from '@fortawesome/sharp-light-svg-icons';
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  COMPLEXITY_LEVELS,
  SPECIAL_IDS,
  UPLOAD_STEPS,
  NOTIFICATION_TYPES_UI,
  EXCEL_FILE_EXTENSIONS,
  EXCEL_SHEET_NAMES,
  TEMPLATE_FILENAME,
  REQUIRED_QUESTION_COLUMNS,
  EXCEL_COLUMN_WIDTHS,
  DELIMITERS,
  REGEX_PATTERNS,
  UI_TIMINGS,
  ICON_SIZES,
  EXCEL_ROW_OFFSET,
  QUESTION_DEFAULTS,
  NOTIFICATION_MESSAGES,
  type QuestionType,
  type ComplexityLevel,
  type UploadStep,
  type NotificationTypeUI
} from './constants';

import type { 
  CreateQuestionInput
} from './types/question.types';

interface BulkUploadQuestionsProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollegeId: string;
  activeCollegeName: string;
  currentUser: any;
  isSuperUser: boolean;
  collegeData: {
    boards: string[];
    subjects: string[];
    classes: string[];
  };
  onUploadComplete: () => void;
}

interface QuestionRow {
  board?: string;
  is_public?: string | boolean;
  college_id?: string;
  class: string;
  subject: string;
  chapter?: string;
  type: QuestionType | string;
  question_text: string;
  question_image_urls?: string;
  options?: string;
  correct_answers?: string;
  maximum_marks: number;
  difficulty_level: ComplexityLevel | string;
  hint?: string;
  test_cases?: string;
  test_stub?: string;
  programming_language?: string;
  starter_codes?: string; // JSON array: [{"language":"python","code":"def solve():..."}]
  sql_schema?: string; // JSON array of table schemas
  sql_test_cases?: string; // JSON array of SQL test cases
  tags?: string; // Comma-separated tags
}

export default function BulkUploadQuestions({
  isOpen,
  onClose,
  activeCollegeId,
  activeCollegeName,
  currentUser,
  isSuperUser,
  collegeData,
  onUploadComplete
}: BulkUploadQuestionsProps) {  const brandTheme = useBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Helper function to format question type display names using constants
  const getTypeDisplayName = (type: string): string => {
    const normalizedType = type.toLowerCase().replace(REGEX_PATTERNS.WHITESPACE, '');
    
    // Direct mapping to display labels - NO legacy support
    const typeMap: Record<string, QuestionType> = {
      [QUESTION_TYPES.MCQ]: QUESTION_TYPES.MCQ,
      [QUESTION_TYPES.FITB]: QUESTION_TYPES.FITB,
      [QUESTION_TYPES.JUMBLED]: QUESTION_TYPES.JUMBLED,
      [QUESTION_TYPES.DESCRIPTIVE]: QUESTION_TYPES.DESCRIPTIVE,
      [QUESTION_TYPES.CODE]: QUESTION_TYPES.CODE,
      [QUESTION_TYPES.SQL]: QUESTION_TYPES.SQL,
    };
    
    const standardType = typeMap[normalizedType];
    return standardType ? QUESTION_TYPE_LABELS[standardType] : type;
  };
  
  const [uploadStep, setUploadStep] = useState<UploadStep>(UPLOAD_STEPS.SELECT);
  const [parsedQuestions, setParsedQuestions] = useState<QuestionRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  }>({ success: 0, failed: 0, errors: [] });
  const [isDragging, setIsDragging] = useState(false);
  
  // Pagination state for preview
  const [previewPage, setPreviewPage] = useState(1);
  const [expandedPreviewId, setExpandedPreviewId] = useState<number | null>(null);
  const PREVIEW_ITEMS_PER_PAGE = 10;
  
  const [notification, setNotification] = useState<{
    type: NotificationTypeUI;
    message: string;
    visible: boolean;
  }>({ type: NOTIFICATION_TYPES_UI.INFO, message: '', visible: false });

  const showNotification = (type: NotificationTypeUI, message: string) => {
    setNotification({ type, message, visible: true });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), UI_TIMINGS.COPY_FEEDBACK_DURATION);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    if (notification.visible) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, UI_TIMINGS.NOTIFICATION_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [notification.visible]);

  useEffect(() => {
    if (!isOpen) {
      setNotification({ type: NOTIFICATION_TYPES_UI.INFO, message: '', visible: false });
    }
  }, [isOpen]);

  const downloadTemplate = () => {
    const template = [
      // MCQ Questions
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.MCQ,
        question_text: '<h2>Basic For Loop Execution</h2><p>What will be the output of the following code?</p><code>for (int i = 0; i < 5; i++) {\n    System.out.print(i + " ");\n}</code>',
        question_image_urls: '',
        options: '0 1 2 3 4|0 1 2 3 4 5|1 2 3 4 5|0 1 2 3',
        correct_answers: '0 1 2 3 4',
        maximum_marks: 1,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'The loop starts at i=0 and continues while i<5',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'loops,for-loop,java-basics,control-flow'
      },
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.MCQ,
        question_text: '<h2>MCQ with Multiple Correct Answers</h2><p>Which of the following are valid loop types in Java? (Multiple answers)</p>',
        question_image_urls: '',
        options: 'for loop|while loop|repeat-until loop|do-while loop',
        correct_answers: 'for loop|while loop|do-while loop',
        maximum_marks: 3,
        difficulty_level: COMPLEXITY_LEVELS.MEDIUM,
        hint: 'Java has three main loop constructs',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'loops,java-syntax,control-structures'
      },
      // Fill in the Blank Questions
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java OOPs Concepts',
        type: QUESTION_TYPES.FITB,
        question_text: '<h2>Static Members</h2><p>Fill in the blanks about static keyword.</p><p>The _____ keyword is used to create class-level members. Static variables are shared among _____ instances of the class.</p>',
        question_image_urls: '',
        options: '',
        correct_answers: 'static|all',
        maximum_marks: 2,
        difficulty_level: COMPLEXITY_LEVELS.MEDIUM,
        hint: 'Static members belong to class, not individual objects',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'oop,static,java-keywords,class-members'
      },
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Enumerations',
        type: QUESTION_TYPES.FITB,
        question_text: '<h2>Define and Use Enum</h2><p>Fill in the blanks to create and use an enum.</p><code>\n_____ Day {\n    MONDAY, TUESDAY, WEDNESDAY\n}\n_____ today = Day.MONDAY;\nSystem.out.println(today);\n</code>',
        question_image_urls: '',
        options: '',
        correct_answers: 'enum|Day',
        maximum_marks: 2,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Use enum keyword to define, enum name for variable type',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'enumerations,java-syntax,data-types'
      },
      // Jumbled Quiz Questions
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.JUMBLED,
        question_text: '<h2>Print Numbers 1 to 5</h2><p>Arrange the code to print numbers from 1 to 5 using a for loop.</p>',
        question_image_urls: '',
        options: 'System.out.println(i);|}|for (int i = 1; i <= 5; i++) {',
        correct_answers: 'for (int i = 1; i <= 5; i++) {|System.out.println(i);|}',
        maximum_marks: 3,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Loop declaration first, then print statement, then closing brace',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'loops,code-arrangement,java-basics'
      },
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java OOPs Concepts',
        type: QUESTION_TYPES.JUMBLED,
        question_text: '<h2>Method Overloading - Add Numbers</h2><p>Arrange the code to demonstrate method overloading with two add methods.</p>',
        question_image_urls: '',
        options: 'System.out.println(add(5, 10));|static int add(int a, int b, int c) { return a + b + c; }|System.out.println(add(5, 10, 15));|static int add(int a, int b) { return a + b; }',
        correct_answers: 'static int add(int a, int b) { return a + b; }|static int add(int a, int b, int c) { return a + b + c; }|System.out.println(add(5, 10));|System.out.println(add(5, 10, 15));',
        maximum_marks: 4,
        difficulty_level: COMPLEXITY_LEVELS.MEDIUM,
        hint: 'Define first add method with 2 params, second add with 3 params, call both',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'oop,method-overloading,polymorphism'
      },
      // Descriptive Questions
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.DESCRIPTIVE,
        question_text: '<h2>Print Your Name 5 Times</h2><p>Write a Java program using a for loop to print your name 5 times.</p><h3>Examples</h3><p><strong>Output:</strong><br><code>Mohammad\nMohammad\nMohammad\nMohammad\nMohammad</code></p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 5,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Use for loop from 1 to 5',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'loops,for-loop,java-basics,programming'
      },
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.DESCRIPTIVE,
        question_text: '<h2>Print Even Numbers from 2 to 10</h2><p>Write a program using while loop to print even numbers from 2 to 10.</p><h3>Examples</h3><p><strong>Output:</strong><br><code>2 4 6 8 10</code></p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 5,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Start from 2, increment by 2',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: '',
        sql_test_cases: '',
        tags: 'loops,while-loop,even-numbers,programming'
      },
      // Code Questions
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Strings',
        type: QUESTION_TYPES.CODE,
        question_text: '<h2>Partition String into Minimum Substrings</h2><p>Given a string <strong>s</strong>, partition the string into one or more substrings such that the characters in each substring are <strong>unique</strong>. Return the <strong>minimum</strong> number of substrings in such a partition.</p><h3>Examples</h3><p><strong>Input:</strong> abacaba<br><strong>Output:</strong> 4</p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 4,
        difficulty_level: COMPLEXITY_LEVELS.MEDIUM,
        hint: 'Use a set to track characters in the current substring. When a duplicate is found, start a new partition.',
        test_cases: JSON.stringify([
          { input: 'abacaba', expected_output: '4\n', marks: 0.5 },
          { input: 'ssssss', expected_output: '6\n', marks: 0.5 },
          { input: 'abcdef', expected_output: '1\n', marks: 0.5 },
          { input: 'aab', expected_output: '2\n', marks: 0.5 },
          { input: 'abcabc', expected_output: '2\n', marks: 0.5 },
          { input: 'a', expected_output: '1\n', marks: 0.5 },
          { input: 'abcdefghijklmnopqrstuvwxyz', expected_output: '1\n', marks: 0.5 },
          { input: 'aabbcc', expected_output: '3\n', marks: 0.5 }
        ]),
        test_stub: '',
        programming_language: 'java',
        starter_codes: JSON.stringify([
          { language: 'java', code: 'import java.util.Scanner;\nimport java.util.HashSet;\n\npublic class Main {\n    public static int partitionString(String s) {\n        // Your Code Starts Here\n\n        // Your Code Ends Here\n    }\n\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.next();\n        System.out.println(partitionString(s));\n    }\n}' },
          { language: 'python', code: 'def partition_string(s: str) -> int:\n    # Your Code Starts Here\n\n    # Your Code Ends Here\n    pass\n\nif __name__ == "__main__":\n    s = input()\n    print(partition_string(s))' },
          { language: 'cpp', code: '#include <iostream>\n#include <string>\n#include <unordered_set>\n\nusing namespace std;\n\nint partitionString(string s) {\n    // Your Code Starts Here\n\n    // Your Code Ends Here\n}\n\nint main() {\n    string s;\n    cin >> s;\n    cout << partitionString(s) << endl;\n    return 0;\n}' },
          { language: 'c', code: '#include <stdio.h>\n#include <string.h>\n\nint partitionString(char s[]) {\n    // Your Code Starts Here\n\n    // Your Code Ends Here\n}\n\nint main() {\n    char s[1001];\n    scanf("%s", s);\n    printf("%d\\n", partitionString(s));\n    return 0;\n}' },
          { language: 'javascript', code: 'function partitionString(s) {\n    // Your Code Starts Here\n\n    // Your Code Ends Here\n}\n\nconst readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\nrl.on("line", (line) => {\n    console.log(partitionString(line.trim()));\n    rl.close();\n});' }
        ]),
        sql_schema: '',
        sql_test_cases: '',
        tags: 'strings,partitioning,greedy,sets'
      },
      {
        board: 'TPX',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Arrays',
        type: QUESTION_TYPES.CODE,
        question_text: '<h2>Find Maximum Element in Array</h2><p>Write a function that takes an integer <strong>n</strong> (size of array) followed by <strong>n</strong> integers, and returns the <strong>maximum</strong> element.</p><h3>Examples</h3><p><strong>Input:</strong> 5<br>3 1 4 1 5<br><strong>Output:</strong> 5</p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 2,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Iterate through the array and keep track of the maximum value seen so far.',
        test_cases: JSON.stringify([
          { input: '5\n3 1 4 1 5', expected_output: '5\n', marks: 0.25 },
          { input: '3\n10 20 30', expected_output: '30\n', marks: 0.25 },
          { input: '1\n42', expected_output: '42\n', marks: 0.25 },
          { input: '4\n-1 -5 -3 -2', expected_output: '-1\n', marks: 0.25 },
          { input: '6\n7 7 7 7 7 7', expected_output: '7\n', marks: 0.25 },
          { input: '3\n100 1 50', expected_output: '100\n', marks: 0.25 },
          { input: '5\n0 0 0 0 1', expected_output: '1\n', marks: 0.25 },
          { input: '2\n999 1000', expected_output: '1000\n', marks: 0.25 }
        ]),
        test_stub: '',
        programming_language: 'java',
        starter_codes: JSON.stringify([
          { language: 'java', code: 'import java.util.Scanner;\n\npublic class Main {\n    public static int findMax(int[] arr) {\n        // Your Code Starts Here\n\n        // Your Code Ends Here\n    }\n\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for (int i = 0; i < n; i++) arr[i] = sc.nextInt();\n        System.out.println(findMax(arr));\n    }\n}' },
          { language: 'python', code: 'def find_max(arr: list) -> int:\n    # Your Code Starts Here\n\n    # Your Code Ends Here\n    pass\n\nif __name__ == "__main__":\n    n = int(input())\n    arr = list(map(int, input().split()))\n    print(find_max(arr))' },
          { language: 'cpp', code: '#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint findMax(vector<int>& arr) {\n    // Your Code Starts Here\n\n    // Your Code Ends Here\n}\n\nint main() {\n    int n;\n    cin >> n;\n    vector<int> arr(n);\n    for (int i = 0; i < n; i++) cin >> arr[i];\n    cout << findMax(arr) << endl;\n    return 0;\n}' },
          { language: 'c', code: '#include <stdio.h>\n\nint findMax(int arr[], int n) {\n    // Your Code Starts Here\n\n    // Your Code Ends Here\n}\n\nint main() {\n    int n;\n    scanf("%d", &n);\n    int arr[n];\n    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);\n    printf("%d\\n", findMax(arr, n));\n    return 0;\n}' },
          { language: 'javascript', code: 'function findMax(arr) {\n    // Your Code Starts Here\n\n    // Your Code Ends Here\n}\n\nconst readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on("line", (line) => lines.push(line.trim()));\nrl.on("close", () => {\n    const n = parseInt(lines[0]);\n    const arr = lines[1].split(" ").map(Number);\n    console.log(findMax(arr));\n});' }
        ]),
        sql_schema: '',
        sql_test_cases: '',
        tags: 'arrays,maximum,iteration,basics'
      },
      // SQL Questions
      {
        board: 'LPU',
        is_public: false,
        class: 'MCA-1',
        subject: 'Database',
        chapter: 'SQL Query',
        type: QUESTION_TYPES.SQL,
        question_text: '<h2>Select All Records</h2><p>Write a SQL query to select all records from the <strong>Employee</strong> table.</p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 1,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Use SELECT * FROM table_name',
        test_cases: '',
        test_stub: '',
        programming_language: '',
        starter_codes: '',
        sql_schema: JSON.stringify([{
          table_name: 'Employee',
          columns: [
            { name: 'id', type: 'INT', description: '', constraints: 'PK, NOT NULL' },
            { name: 'Name', type: 'VARCHAR', description: '', constraints: '' },
            { name: 'Salary', type: 'DECIMAL', description: '', constraints: '' }
          ],
          primary_key: 'id',
          note: ''
        }]),
        sql_test_cases: JSON.stringify([{
          title: 'Test Case 1',
          table_data: { Employee: [['id', 'Name', 'Salary'], ['1', 'Mohtashim', '50000'], ['2', 'Mahnaz', '60000']] },
          expected_output: { columns: ['id', 'Name', 'Salary'], rows: [['1', 'Mohtashim', '50000'], ['2', 'Mahnaz', '60000']] },
          marks: 1.0
        }]),
        programming_language: '',
        starter_codes: '',
        tags: 'sql,select,basic-query'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [
      { wch: EXCEL_COLUMN_WIDTHS.SMALL },        // 1. board
      { wch: EXCEL_COLUMN_WIDTHS.SMALL },        // 2. is_public
      { wch: EXCEL_COLUMN_WIDTHS.NARROW },       // 3. class
      { wch: EXCEL_COLUMN_WIDTHS.LARGE },        // 4. subject
      { wch: EXCEL_COLUMN_WIDTHS.WIDER },        // 5. chapter
      { wch: EXCEL_COLUMN_WIDTHS.STANDARD },     // 6. type
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XLARGE }, // 7. question_text
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_MEDIUM }, // 8. question_image_urls
      { wch: EXCEL_COLUMN_WIDTHS.EXTRA_WIDE },   // 9. options
      { wch: EXCEL_COLUMN_WIDTHS.MEDIUM },       // 10. correct_answers
      { wch: EXCEL_COLUMN_WIDTHS.STANDARD },     // 11. maximum_marks
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_MEDIUM }, // 12. difficulty_level
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_MEDIUM }, // 13. hint
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XXLARGE }, // 14. test_cases
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_LARGE }, // 15. test_stub
      { wch: EXCEL_COLUMN_WIDTHS.STANDARD },      // 16. programming_language
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XXLARGE }, // 17. starter_codes
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XXLARGE }, // 18. sql_schema
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XXLARGE }, // 19. sql_test_cases
      { wch: EXCEL_COLUMN_WIDTHS.LARGE }           // 20. tags
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, EXCEL_SHEET_NAMES.QUESTIONS);
    
    const referenceData = [
      ['ALLOWED VALUES FOR DROPDOWNS'],
      [''],
      ['Boards (Select from these):'],
      ...(collegeData?.boards && collegeData.boards.length > 0 
        ? collegeData.boards.map(b => [b])
        : [['CBSE'], ['ICSE'], ['State Board']]),
      [''],
      ['Classes (Select from these):'],
      ...(collegeData?.classes && collegeData.classes.length > 0
        ? collegeData.classes.map(c => [c])
        : [['1st'], ['2nd'], ['3rd'], ['4th'], ['5th'], ['6th'], ['7th'], ['8th'], ['9th'], ['10th'], ['11th'], ['12th']]),
      [''],
      ['Subjects (Select from these):'],
      ...(collegeData?.subjects && collegeData.subjects.length > 0
        ? collegeData.subjects.map(s => [s])
        : [['Mathematics'], ['Science'], ['English'], ['Hindi'], ['Social Science'], ['Computer Science']]),
      [''],
      ['Question Types (Select from these):'],
      [QUESTION_TYPES.MCQ],
      [QUESTION_TYPES.FITB],
      [QUESTION_TYPES.DESCRIPTIVE],
      [QUESTION_TYPES.JUMBLED],
      [QUESTION_TYPES.CODE],
      [QUESTION_TYPES.SQL],
      [''],
      ['Difficulty Levels (Select from these):'],
      [COMPLEXITY_LEVELS.EASY],
      [COMPLEXITY_LEVELS.MEDIUM],
      [COMPLEXITY_LEVELS.HARD],
      [''],
      ['Question Visibility (Select from these):'],
      ['true (Public - shared with all colleges)'],
      ['false (Private - your college only)']
    ];

    const wsReference = XLSX.utils.aoa_to_sheet(referenceData);
    wsReference['!cols'] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsReference, EXCEL_SHEET_NAMES.REFERENCE);
    
    const instructions = [
      ['INSTRUCTIONS FOR BULK QUESTION UPLOAD'],
      [''],
      ['Column Descriptions:'],
      ['board', 'Educational board (e.g., CBSE, ICSE) - OPTIONAL (leave empty if not applicable)'],
      ['is_public', 'true (public - shared with all colleges) or false (private - your college only)'],
      ['class', 'Class level (e.g., MCA-1, 10th, 11th, 12th)'],
      ['subject', 'Subject name (e.g., Java, Mathematics, Computer Science)'],
      ['chapter', 'Chapter or topic name (e.g., Java Loops, Quadratic Equations)'],
      ['type', `Question type: ${QUESTION_TYPES.MCQ}, ${QUESTION_TYPES.FITB}, ${QUESTION_TYPES.DESCRIPTIVE}, ${QUESTION_TYPES.JUMBLED}, ${QUESTION_TYPES.CODE}, ${QUESTION_TYPES.SQL}`],
      ['question_text', 'The actual question text. Supports HTML tags like <h2>, <p>, <code>, <strong> for rich formatting'],
      ['options', 'For MCQ & JUMBLED: separate options/items with | (e.g., "Option 1|Option 2|Option 3|Option 4")'],
      ['correct_answers', 'For MCQ: Single OR multiple correct answers separated by | | For FITB: answers for each blank separated by | | For JUMBLED: correct sequence separated by |'],
      ['maximum_marks', 'Numeric value for marks (e.g., 1, 2, 5)'],
      ['difficulty_level', `${COMPLEXITY_LEVELS.EASY}, ${COMPLEXITY_LEVELS.MEDIUM}, or ${COMPLEXITY_LEVELS.HARD}`],
      ['hint', 'Hint for solving (optional). Supports HTML formatting.'],
      ['test_cases', 'For CODE questions: JSON array of test cases with input, expected_output, and marks'],
      ['test_stub', 'For CODE questions: Starter code template (backward compatible, use starter_codes for multi-language)'],
      ['programming_language', 'For CODE questions: Primary programming language (e.g., java, python, cpp)'],
      ['starter_codes', 'For CODE questions: JSON array of multi-language starter codes: [{"language":"java","code":"..."}]'],
      ['sql_schema', 'For SQL questions: JSON array of table schemas with columns, types, and constraints'],
      ['sql_test_cases', 'For SQL questions: JSON array of test cases with table_data and expected_output'],
      ['tags', 'Optional: Comma-separated tags for categorization, max 4 (e.g., "loops,for-loop,java-basics"). Automatically lowercased.'],
      [''],
      ['HTML Formatting in question_text, hint:'],
      ['You can use these HTML tags for rich formatting:'],
      ['<h2>Title</h2>', 'For main headings'],
      ['<h3>Subtitle</h3>', 'For subheadings'],
      ['<p>Text</p>', 'For paragraphs'],
      ['<code>Code here</code>', 'For inline code (will be syntax highlighted)'],
      ['<strong>Bold text</strong>', 'For bold/emphasized text'],
      ['<br>', 'For line breaks'],
      [''],
      ['Question Type Details:'],
      [QUESTION_TYPES.MCQ, 'Requires: options and correct_answers. For SINGLE correct: "Option 2". For MULTIPLE correct: "Option 1|Option 3"'],
      [QUESTION_TYPES.FITB, 'Requires: correct_answers. Use | to separate answers for multiple blanks (e.g., "static|all" for 2 blanks)'],
      [QUESTION_TYPES.DESCRIPTIVE, 'No required additional fields. Students write free-form answers.'],
      [QUESTION_TYPES.JUMBLED, 'Requires: options (items to arrange) and correct_answers (correct sequence). Both separated by |'],
      [QUESTION_TYPES.CODE, 'Requires: test_cases (JSON), test_stub or starter_codes. programming_language recommended.'],
      [QUESTION_TYPES.SQL, 'Requires: sql_schema (JSON) and sql_test_cases (JSON). Subject must be "Database".'],
      [''],
      ['Code Question Format:'],
      ['test_cases', 'JSON array format: [{"input":"John\\n101\\n85.5","expected_output":"Name: John, Roll: 101, Marks: 85.5\\n","marks":0.4}]'],
      ['test_stub', 'Single-language starter code (backward compatible). Use starter_codes for multi-language support.'],
      ['programming_language', 'Primary language: java, python, cpp, c, javascript, etc.'],
      ['starter_codes', 'JSON array: [{"language":"java","code":"..."},{"language":"python","code":"..."}]'],
      [''],
      ['SQL Question Format:'],
      ['sql_schema', 'JSON array: [{"table_name":"Employee","columns":[{"name":"id","type":"INT","description":"","constraints":"PK, NOT NULL"}],"primary_key":"id","note":""}]'],
      ['sql_test_cases', 'JSON array: [{"title":"Test 1","table_data":{"Employee":[["id","Name"],["1","John"]]},"expected_output":{"columns":["id","Name"],"rows":[["1","John"]]},"marks":1.0}]'],
      [''],
      ['Examples (See Questions sheet for complete examples):'],
      ['MCQ', 'Single answer: correct_answers = "0 1 2 3 4"  |  Multiple answers: correct_answers = "for loop|while loop|do-while loop"'],
      ['FITB', 'Two blanks: question has "The _____ keyword... among _____ instances"  |  correct_answers = "static|all"'],
      ['Jumbled', 'Code arrangement: options = "System.out.println(i);|}|for (int i = 1; i <= 5; i++) {"  |  correct_answers = "for (int i = 1; i <= 5; i++) {|System.out.println(i);|}"'],
      ['Descriptive', 'Open-ended questions where students write full answers. No options or correct_answers needed.'],
      ['Code', 'Complete programming problems with automated testing. Requires test_cases JSON and test_stub/starter_codes.'],
      ['SQL', 'Database query problems. Requires sql_schema JSON (table definitions) and sql_test_cases JSON (input data + expected output).']
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 25 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, EXCEL_SHEET_NAMES.INSTRUCTIONS);

    XLSX.writeFile(wb, TEMPLATE_FILENAME);
    showNotification(NOTIFICATION_TYPES_UI.INFO, NOTIFICATION_MESSAGES.TEMPLATE_DOWNLOADED);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<QuestionRow>(worksheet);
        
        if (jsonData.length === 0) {
          showNotification(NOTIFICATION_TYPES_UI.ERROR, NOTIFICATION_MESSAGES.FILE_EMPTY);
          return;
        }
        
        const firstRow = jsonData[0];
        const requiredColumns = [...REQUIRED_QUESTION_COLUMNS];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          showNotification(NOTIFICATION_TYPES_UI.ERROR, `Missing required columns: ${missingColumns.join(', ')}`);
          return;
        }
        
        setParsedQuestions(jsonData);
        setPreviewPage(1); // Reset preview pagination
        setUploadStep(UPLOAD_STEPS.PREVIEW);
      } catch (error) {
        showNotification(NOTIFICATION_TYPES_UI.ERROR, NOTIFICATION_MESSAGES.PARSE_ERROR);
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(EXCEL_FILE_EXTENSIONS.XLSX) || file.name.endsWith(EXCEL_FILE_EXTENSIONS.XLS)) {
        parseExcelFile(file);
      } else {
        showNotification(NOTIFICATION_TYPES_UI.ERROR, NOTIFICATION_MESSAGES.INVALID_FILE_TYPE);
      }
    }
  };

  const uploadQuestions = async () => {
    setUploadStep(UPLOAD_STEPS.UPLOADING);
    setUploadProgress(0);
    
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    for (let i = 0; i < parsedQuestions.length; i++) {
      try {
        const question: QuestionRow = parsedQuestions[i];
        const rowLabel = `Row ${i + EXCEL_ROW_OFFSET}`;
        const qType = mapQuestionType(question.type);
        
        // ─── Base Field Validation ───
        if (!question.question_text || !question.question_text.toString().trim()) {
          results.failed++;
          results.errors.push(`${rowLabel}: question_text is required`);
          setUploadProgress(((i + 1) / parsedQuestions.length) * 100);
          continue;
        }
        if (!question.subject || !question.subject.toString().trim()) {
          results.failed++;
          results.errors.push(`${rowLabel}: subject is required`);
          setUploadProgress(((i + 1) / parsedQuestions.length) * 100);
          continue;
        }
        if (!question.class || !question.class.toString().trim()) {
          results.failed++;
          results.errors.push(`${rowLabel}: class is required`);
          setUploadProgress(((i + 1) / parsedQuestions.length) * 100);
          continue;
        }
        if (!question.chapter || !question.chapter.toString().trim()) {
          results.failed++;
          results.errors.push(`${rowLabel}: ${NOTIFICATION_MESSAGES.CHAPTER_REQUIRED}`);
          setUploadProgress(((i + 1) / parsedQuestions.length) * 100);
          continue;
        }
        
        // ─── Type-Specific Validation ───
        const validationErrors: string[] = [];
        
        if (qType === QUESTION_TYPES.MCQ) {
          if (!question.options || !question.options.toString().trim()) {
            validationErrors.push('options are required for MCQ');
          } else {
            const opts = question.options.split(DELIMITERS.PIPE).filter(o => o.trim());
            if (opts.length < 2) validationErrors.push('MCQ must have at least 2 options');
          }
          if (!question.correct_answers || !question.correct_answers.toString().trim()) {
            validationErrors.push('correct_answers is required for MCQ');
          }
        }
        
        if (qType === QUESTION_TYPES.FITB) {
          if (!question.correct_answers || !question.correct_answers.toString().trim()) {
            validationErrors.push('correct_answers is required for FITB (pipe-separated blanks)');
          }
        }
        
        if (qType === QUESTION_TYPES.JUMBLED) {
          if (!question.correct_answers || !question.correct_answers.toString().trim()) {
            validationErrors.push('correct_answers is required for Jumbled (pipe-separated correct sequence)');
          }
        }
        
        if (qType === QUESTION_TYPES.CODE) {
          if (!question.test_cases || !question.test_cases.toString().trim()) {
            validationErrors.push('test_cases JSON is required for Code questions');
          } else {
            try {
              const tc = JSON.parse(question.test_cases.toString().trim());
              if (!Array.isArray(tc) || tc.length === 0) validationErrors.push('test_cases must be a non-empty JSON array');
            } catch { validationErrors.push('test_cases has invalid JSON format'); }
          }
          if (!question.starter_codes || !question.starter_codes.toString().trim()) {
            if (!question.test_stub || !question.test_stub.toString().trim()) {
              validationErrors.push('starter_codes or test_stub is required for Code questions');
            }
          } else {
            try {
              const sc = JSON.parse(question.starter_codes.toString().trim());
              if (!Array.isArray(sc) || sc.length === 0) validationErrors.push('starter_codes must be a non-empty JSON array');
            } catch { validationErrors.push('starter_codes has invalid JSON format'); }
          }
        }
        
        if (qType === QUESTION_TYPES.SQL) {
          if (!question.sql_schema || !question.sql_schema.toString().trim()) {
            validationErrors.push('sql_schema JSON is required for SQL questions');
          } else {
            try {
              const schema = JSON.parse(question.sql_schema.toString().trim());
              if (!Array.isArray(schema) || schema.length === 0) validationErrors.push('sql_schema must be a non-empty JSON array with table definitions');
            } catch { validationErrors.push('sql_schema has invalid JSON format'); }
          }
          if (!question.sql_test_cases || !question.sql_test_cases.toString().trim()) {
            validationErrors.push('sql_test_cases JSON is required for SQL questions');
          } else {
            try {
              const tc = JSON.parse(question.sql_test_cases.toString().trim());
              if (!Array.isArray(tc) || tc.length === 0) validationErrors.push('sql_test_cases must be a non-empty JSON array');
            } catch { validationErrors.push('sql_test_cases has invalid JSON format'); }
          }
        }
        
        if (validationErrors.length > 0) {
          results.failed++;
          results.errors.push(`${rowLabel}: ${validationErrors.join('; ')}`);
          setUploadProgress(((i + 1) / parsedQuestions.length) * 100);
          continue;
        }
        
        // Determine visibility
        let isPublic = true;
        if (question.is_public !== undefined && question.is_public !== null && String(question.is_public).trim() !== QUESTION_DEFAULTS.EMPTY_STRING) {
          const publicStr = String(question.is_public).trim().toLowerCase();
          if (publicStr === 'false' || publicStr === 'no' || publicStr === 'private' || publicStr === '0') {
            isPublic = false;
          }
        }
        
        // Determine college ID
        const collegeId = isPublic ? SPECIAL_IDS.TUTORIALS_POINT : (question.college_id || activeCollegeId);
        
        // Prepare input in CreateQuestionInput format
        const questionInput = {
          // Base fields
          question_text: question.question_text,
          subject: question.subject,
          class: question.class.toString().trim(),
          board: question.board || collegeData?.boards?.[0] || QUESTION_DEFAULTS.EMPTY_STRING,
          chapter: question.chapter?.toString().trim() || '',
          year: new Date().getFullYear().toString(),
          type: mapQuestionType(question.type),
          maximum_marks: parseFloat(question.maximum_marks.toString()) || QUESTION_DEFAULTS.MARKS,
          difficulty_level: normalizeComplexity(question.difficulty_level),
          hint: question.hint || QUESTION_DEFAULTS.EMPTY_STRING,
          
          // Image URLs (NEW FEATURE!)
          question_image_urls: question.question_image_urls 
            ? question.question_image_urls.split(DELIMITERS.PIPE).map((url: string) => url.trim()).filter((url: string) => url)
            : [],
          
          // Tags (NEW FEATURE!)
          tags: processQuestionTags(question.tags),
          
          // Organization
          is_public: isPublic,
          college_id: isSuperUser ? 'tutorialspoint' : collegeId,
          college_name: isSuperUser ? 'Tutorials Point' : activeCollegeName,
          created_by: currentUser?.userId || 'unknown',
          created_by_name: currentUser?.fullName || 'Unknown User',
          
          // Type-specific fields
          ...(mapQuestionType(question.type) === QUESTION_TYPES.MCQ && question.options && {
            options: question.options.split(DELIMITERS.PIPE).map(o => o.trim()),
            correct_answers: question.correct_answers 
              ? question.correct_answers.split(DELIMITERS.PIPE).map(a => a.trim())
              : []
          }),
          
          ...(mapQuestionType(question.type) === QUESTION_TYPES.FITB && question.correct_answers && {
            correct_answers: question.correct_answers.split(DELIMITERS.PIPE).map(a => a.trim()).filter(a => a)
          }),
          
          ...(mapQuestionType(question.type) === QUESTION_TYPES.JUMBLED && question.correct_answers && {
            correct_answers: question.correct_answers.split(DELIMITERS.PIPE).map(a => a.trim())
            // jumbledItems will be auto-generated in transformation
          }),
          
          ...(mapQuestionType(question.type) === QUESTION_TYPES.CODE && (() => {
            const parsedTestCases = question.test_cases 
              ? JSON.parse(question.test_cases.toString().trim()) 
              : [];
            // Auto-distribute marks evenly if test case marks don't sum to maximum_marks
            const maxMarks = parseFloat(question.maximum_marks.toString()) || QUESTION_DEFAULTS.MARKS;
            if (parsedTestCases.length > 0) {
              const totalTcMarks = parsedTestCases.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0);
              if (Math.abs(totalTcMarks - maxMarks) > 0.01) {
                const perCase = Math.round((maxMarks / parsedTestCases.length) * 100) / 100;
                parsedTestCases.forEach((tc: any) => { tc.marks = perCase; });
                // Adjust last case to fix rounding
                const diff = Math.round((maxMarks - perCase * parsedTestCases.length) * 100) / 100;
                if (diff !== 0) parsedTestCases[parsedTestCases.length - 1].marks = Math.round((perCase + diff) * 100) / 100;
              }
            }
            return {
              test_cases: parsedTestCases,
              test_stub: question.test_stub?.toString().trim() || '',
              programming_language: question.programming_language?.toString().trim() || 'java',
              starter_codes: question.starter_codes
                ? JSON.parse(question.starter_codes.toString().trim())
                : question.test_stub 
                  ? [{ language: question.programming_language?.toString().trim() || 'java', code: question.test_stub.toString().trim() }]
                  : []
            };
          })()),
          
          ...(mapQuestionType(question.type) === QUESTION_TYPES.SQL && (() => {
            const parsedSchema = question.sql_schema
              ? JSON.parse(question.sql_schema.toString().trim())
              : [];
            const parsedSqlTestCases = question.sql_test_cases
              ? JSON.parse(question.sql_test_cases.toString().trim())
              : [];
            // Auto-distribute SQL test case marks
            const maxMarks = parseFloat(question.maximum_marks.toString()) || QUESTION_DEFAULTS.MARKS;
            if (parsedSqlTestCases.length > 0) {
              const totalTcMarks = parsedSqlTestCases.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0);
              if (Math.abs(totalTcMarks - maxMarks) > 0.01) {
                const perCase = Math.round((maxMarks / parsedSqlTestCases.length) * 100) / 100;
                parsedSqlTestCases.forEach((tc: any) => { tc.marks = perCase; });
                const diff = Math.round((maxMarks - perCase * parsedSqlTestCases.length) * 100) / 100;
                if (diff !== 0) parsedSqlTestCases[parsedSqlTestCases.length - 1].marks = Math.round((perCase + diff) * 100) / 100;
              }
            }
            return {
              sql_schema: parsedSchema,
              sql_test_cases: parsedSqlTestCases
            };
          })())
        };
        
        // Create question using unified service
        const result = await firebaseService.createQuestion(questionInput as CreateQuestionInput);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to save question');
        }
        
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row ${i + EXCEL_ROW_OFFSET}: ${error.message}`);
      }
      
      setUploadProgress(Math.round(((i + 1) / parsedQuestions.length) * 100));
    }
    
    setUploadResults(results);
    setUploadStep(UPLOAD_STEPS.COMPLETE);
  };

  const normalizeComplexity = (difficulty: string): ComplexityLevel => {
    const normalized = difficulty.toLowerCase().trim();
    const complexityMap: Record<string, ComplexityLevel> = {
      'easy': COMPLEXITY_LEVELS.EASY,
      'medium': COMPLEXITY_LEVELS.MEDIUM,
      'hard': COMPLEXITY_LEVELS.HARD,
      'simple': COMPLEXITY_LEVELS.EASY,
      'moderate': COMPLEXITY_LEVELS.MEDIUM,
      'difficult': COMPLEXITY_LEVELS.HARD,
    };
    return complexityMap[normalized] || COMPLEXITY_LEVELS.MEDIUM;
  };

  // Process tags from Excel cell - handles comma-separated or JSON array format
  const processQuestionTags = (tagsValue: any): string[] => {
    if (!tagsValue) return [];
    
    let tags: string[] = [];
    
    if (typeof tagsValue === 'string') {
      const trimmed = tagsValue.trim();
      
      // Check if it's JSON array format
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            tags = parsed;
          }
        } catch {
          // If parsing fails, treat as comma-separated
          tags = trimmed.slice(1, -1).split(',');
        }
      } else {
        // Comma-separated format
        tags = trimmed.split(',');
      }
    } else if (Array.isArray(tagsValue)) {
      tags = tagsValue;
    }
    
    // Process: trim, lowercase, remove empty, deduplicate, limit to 4
    const processed = tags
      .map(tag => String(tag).trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    return [...new Set(processed)].slice(0, 4);
  };

  const mapQuestionType = (type: string): QuestionType => {
    const normalizedType = type.toLowerCase().replace(REGEX_PATTERNS.WHITESPACE, '');
    
    // Direct mapping to constants - NO legacy support
    const typeMap: Record<string, QuestionType> = {
      [QUESTION_TYPES.MCQ]: QUESTION_TYPES.MCQ,
      [QUESTION_TYPES.FITB]: QUESTION_TYPES.FITB,
      [QUESTION_TYPES.DESCRIPTIVE]: QUESTION_TYPES.DESCRIPTIVE,
      [QUESTION_TYPES.JUMBLED]: QUESTION_TYPES.JUMBLED,
      [QUESTION_TYPES.CODE]: QUESTION_TYPES.CODE,
      [QUESTION_TYPES.SQL]: QUESTION_TYPES.SQL,
    };
    
    return typeMap[normalizedType] || QUESTION_TYPES.DESCRIPTIVE;
  };

  const handleClose = () => {
    if (uploadResults.success > 0) {
      onUploadComplete();
    }
    
    setUploadStep(UPLOAD_STEPS.SELECT);
    setParsedQuestions([]);
    setUploadProgress(0);
    setPreviewPage(1);
    setUploadResults({ success: 0, failed: 0, errors: [] });
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex items-start justify-start p-2 transition-opacity duration-300 ${
      isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    }`}>
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
        onClick={handleClose}
      />
      
      <div 
        className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[50rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          /* Custom scrollbar styling - Hidden */
          .custom-scrollbar {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }
          
          .custom-scrollbar::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }
        `}</style>
        
        <div 
          className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
          style={{ 
            background: brandTheme.gradients.primary,
            borderColor: brandTheme.colors.secondary
          }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Upload size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Upload Questions</h2>
              <p className="text-white/80 text-xs">{activeCollegeName || 'Import multiple questions using Excel'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={downloadTemplate} className="px-3 py-1.5 text-white/90 font-medium text-sm rounded-lg transition-all duration-200 flex items-center space-x-2 hover:bg-white/20">
              <Download size={14} className="text-white" />
              <span>Download template</span>
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        {notification.visible && (
          <div className={`mx-8 mt-6 p-4 rounded-lg border-l-4 flex items-start space-x-3 ${
            notification.type === 'error' ? 'bg-red-50 border-red-500' : notification.type === 'warning' ? 'bg-amber-50 border-amber-500' : ''
          }`}
          style={notification.type === 'info' ? {
            backgroundColor: brandTheme.colors.primary + '10',
            borderLeftColor: brandTheme.colors.primary
          } : {}}>
            <div className="flex-shrink-0 mt-0.5">
              {notification.type === 'error' && <AlertCircle size={ICON_SIZES.LARGE} className="text-red-600" />}
              {notification.type === 'warning' && <AlertCircle size={ICON_SIZES.LARGE} className="text-amber-600" />}
              {notification.type === 'info' && <CheckCircle size={ICON_SIZES.LARGE} style={{ color: brandTheme.colors.primary }} />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${notification.type === 'error' ? 'text-red-800' : notification.type === 'warning' ? 'text-amber-800' : ''}`}
              style={notification.type === 'info' ? { color: brandTheme.colors.primary } : {}}>
                {notification.message}
              </p>
            </div>
            <button onClick={() => setNotification(prev => ({ ...prev, visible: false }))} className={`flex-shrink-0 ${notification.type === 'error' ? 'text-red-400 hover:text-red-600' : notification.type === 'warning' ? 'text-amber-400 hover:text-amber-600' : ''}`}
            style={notification.type === 'info' ? { color: brandTheme.colors.primary + '66' } : {}}>
              <X size={ICON_SIZES.SMALL} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {uploadStep === UPLOAD_STEPS.SELECT && (
            <div className="space-y-6">
              <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`relative border border-dashed rounded-xl p-12 text-center transition-all duration-200 ${isDragging ? '' : 'border-gray-300 hover:border-gray-400'}`}
              style={isDragging ? {
                borderColor: brandTheme.colors.primary,
                backgroundColor: brandTheme.colors.primary + '10'
              } : {}}>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: brandTheme.gradients.primary }}>
                    <Upload size={ICON_SIZES.XLARGE} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-2">{isDragging ? 'Drop your file here' : 'Upload Excel File'}</h3>
                    <p className="text-gray-700">Drag and drop your Excel file here, or click to browse</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg" style={{ background: brandTheme.gradients.primary }}>
                    Choose File
                  </button>
                  <p className="text-sm text-gray-700">Supported: .xlsx, .xls</p>
                </div>
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 rounded-tl-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 rounded-tr-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 rounded-bl-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 rounded-br-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
              </div>
              <div className="border rounded-xl p-5 shadow-sm"
                style={{ 
                  background: `linear-gradient(to right, ${brandTheme.colors.accent}10, ${brandTheme.colors.accent}15)`,
                  borderColor: brandTheme.colors.accent + '40'
                }}>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: brandTheme.colors.accent }}>
                    <FileText size={ICON_SIZES.MEDIUM} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold mb-3 text-amber-700">Important Instructions</h4>
                    <ul className="space-y-2 text-xs text-gray-700">
                      <li className="flex items-start"><span className="mr-2">•</span><span>Check the <strong>"Reference"</strong> sheet for all allowed values</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span><strong>Required columns:</strong> class, subject, chapter, question_text, type, maximum_marks, difficulty_level</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span><strong>Optional:</strong> board (empty if not provided), hint</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span><strong>MCQ with multiple correct answers:</strong> Separate correct answers with | (e.g., "Answer1|Answer2")</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span><strong>CODE questions:</strong> Must include test_cases (JSON) and test_stub</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {uploadStep === UPLOAD_STEPS.PREVIEW && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
                <CheckCircle size={ICON_SIZES.LARGE} className="text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">File parsed successfully!</p>
                  <p className="text-sm text-green-700">Found {parsedQuestions.length} questions ready to upload</p>
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Questions Preview</h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto space-y-3 p-3">
                  {parsedQuestions
                    .slice((previewPage - 1) * PREVIEW_ITEMS_PER_PAGE, previewPage * PREVIEW_ITEMS_PER_PAGE)
                    .map((q, idx) => {
                      const actualIndex = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE + idx;
                      const isExpanded = expandedPreviewId === actualIndex;
                      const qType = mapQuestionType(q.type);
                      return (
                    <div
                      key={actualIndex}
                      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-200"
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = brandTheme.colors.primary; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    >
                      {/* Question Header - matches QuestionList */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ background: brandTheme.gradients.primary }}
                          >
                            {actualIndex + 1}
                          </div>
                          <div className="overflow-x-auto scrollbar-hide flex-1 min-w-0">
                            <div className="flex items-center space-x-2 whitespace-nowrap">
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                                {getTypeDisplayName(q.type)}
                              </span>
                              {q.board && q.board.trim() !== '' && (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700">
                                  {q.board.toUpperCase()}
                                </span>
                              )}
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                                q.difficulty_level?.toLowerCase() === 'easy' ? 'bg-pink-100 text-pink-700' :
                                q.difficulty_level?.toLowerCase() === 'medium' ? 'bg-green-100 text-green-700' :
                                'bg-cyan-100 text-cyan-700'
                              }`}>
                                {q.difficulty_level ? q.difficulty_level.charAt(0).toUpperCase() + q.difficulty_level.slice(1).toLowerCase() : ''}
                              </span>
                              {q.chapter && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700">
                                  <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                                  </svg>
                                  {q.chapter}
                                </span>
                              )}
                              {q.tags && processQuestionTags(q.tags).length > 0 && (
                                <>
                                  {processQuestionTags(q.tags).map((tag: string, tagIdx: number) => (
                                    <span
                                      key={tagIdx}
                                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700"
                                    >
                                      <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                      </svg>
                                      {tag}
                                    </span>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="h-8 bg-gray-100 px-3 rounded-lg flex items-center">
                            <span className="text-sm font-bold text-gray-900">{q.maximum_marks}</span>
                            <span className="text-xs text-gray-600 ml-1">marks</span>
                          </div>
                          {isExpanded && (
                            <button
                              onClick={() => setExpandedPreviewId(null)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <X size={16} className="text-gray-600" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="mb-3">
                        <div className="space-y-3">
                          {(() => {
                            const processHTML = (html: string) => {
                              const parts = html.split(/(<code>.*?<\/code>)/gs);
                              return parts.map((part, index) => {
                                const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                                if (codeMatch) {
                                  const codeContent = codeMatch[1];
                                  const codeId = `preview-code-${actualIndex}-${index}`;
                                  const detectLanguage = (code: string): string => {
                                    if (code.includes('def ') || code.includes('print(')) return 'python';
                                    if (code.includes('function ') || code.includes('=>')) return 'javascript';
                                    if (code.includes('public class') || code.includes('System.out')) return 'java';
                                    if (code.includes('#include') || code.includes('int main()')) return 'cpp';
                                    if (code.includes('SELECT') || code.includes('FROM')) return 'sql';
                                    return 'java';
                                  };
                                  const language = detectLanguage(codeContent);
                                  return (
                                    <div key={index} className="relative rounded-lg overflow-hidden">
                                      <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                        <div className="flex items-center space-x-2">
                                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        </div>
                                        <button onClick={() => copyToClipboard(codeContent, codeId)} className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all" title="Copy">
                                          {copiedCode === codeId ? <FontAwesomeIcon icon={faCheck} className="text-sm" /> : <FontAwesomeIcon icon={faCopy} className="text-sm" />}
                                        </button>
                                      </div>
                                      <div className="pt-10">
                                        <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: 0, borderBottomLeftRadius: '0.5rem', borderBottomRightRadius: '0.5rem', fontSize: '0.875rem', padding: '1rem', paddingTop: '0.5rem' }} showLineNumbers={false}>
                                          {codeContent}
                                        </SyntaxHighlighter>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={index} className="prose prose-sm max-w-none [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-3 [&>h1]:mt-2 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-2 [&>h2]:mt-2 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-2 [&>h3]:mt-2 [&>p]:text-base [&>p]:text-gray-800 [&>p]:mb-2 [&>p]:leading-relaxed [&_strong]:font-bold [&_strong]:text-gray-900 [&_br]:block [&_br]:mb-2 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2 [&_li]:mb-1" dangerouslySetInnerHTML={{ __html: part }} />
                                );
                              });
                            };
                            return processHTML(q.question_text);
                          })()}
                        </div>
                      </div>

                      {/* MCQ Options - collapsed view (no correct answer shown) */}
                      {qType === QUESTION_TYPES.MCQ && q.options && !isExpanded && (
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Options</h4>
                          <div className="space-y-2">
                            {q.options.split(DELIMITERS.PIPE).map((option: string, optIndex: number) => (
                              <div key={optIndex} className="flex items-center space-x-2 p-2.5 rounded-lg border bg-gray-50 border-gray-200">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-300 text-gray-700">
                                  {String.fromCharCode(65 + optIndex)}
                                </div>
                                <span className="text-sm text-gray-700">{option.trim()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Jumbled Items - collapsed view */}
                      {qType === QUESTION_TYPES.JUMBLED && q.correct_answers && !isExpanded && (
                        <div className="mt-3 space-y-2">
                          {q.correct_answers.split(DELIMITERS.PIPE).sort(() => Math.random() - 0.5).map((item: string, itemIndex: number) => (
                            <div key={itemIndex} className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200">
                              <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                                <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                              </div>
                              <span className="text-sm text-gray-700">{item.trim()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ─── Expanded Details ─── */}
                      {isExpanded && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                          <h3 className="text-base font-bold text-gray-900">Question Details</h3>

                          {/* MCQ Options with correct answers */}
                          {qType === QUESTION_TYPES.MCQ && q.options && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Options</h4>
                              <div className="space-y-2">
                                {q.options.split(DELIMITERS.PIPE).map((option: string, optIndex: number) => {
                                  const isCorrect = q.correct_answers?.split(DELIMITERS.PIPE).map(a => a.trim()).includes(option.trim());
                                  return (
                                    <div key={optIndex} className={`flex items-center space-x-2 p-2.5 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                        {isCorrect ? '✓' : String.fromCharCode(65 + optIndex)}
                                      </div>
                                      <span className={`text-sm ${isCorrect ? 'text-green-800 font-semibold' : 'text-gray-700'}`}>{option.trim()}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* FITB Answers */}
                          {qType === QUESTION_TYPES.FITB && q.correct_answers && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Correct Answers</h4>
                              <div className="space-y-1">
                                {q.correct_answers.split(DELIMITERS.PIPE).map((ans, ai) => (
                                  <div key={ai} className="flex items-center space-x-2 p-2 rounded-lg bg-green-50 border border-green-200">
                                    <span className="text-xs font-bold text-green-600">Blank {ai + 1}:</span>
                                    <span className="text-sm text-green-800 font-semibold">{ans.trim()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Jumbled Correct Sequence */}
                          {qType === QUESTION_TYPES.JUMBLED && q.correct_answers && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Correct Sequence</h4>
                              <div className="space-y-1">
                                {q.correct_answers.split(DELIMITERS.PIPE).map((item, ji) => (
                                  <div key={ji} className="flex items-center space-x-2 p-2 rounded-lg bg-green-50 border border-green-200">
                                    <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">{ji + 1}</div>
                                    <span className="text-sm text-gray-700">{item.trim()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Code: Test Cases */}
                          {qType === QUESTION_TYPES.CODE && q.test_cases && (() => {
                            try {
                              const testCases = JSON.parse(q.test_cases.toString());
                              return testCases.length > 0 ? (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Test Cases ({testCases.length})</h4>
                                  <div className="space-y-2">
                                    {testCases.slice(0, 5).map((tc: any, tci: number) => (
                                      <div key={tci} className="p-2.5 rounded-lg bg-white border border-gray-200 text-xs">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-semibold text-gray-600">Test {tci + 1}</span>
                                          {tc.marks && <span className="text-gray-500">{tc.marks} marks</span>}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div><span className="font-semibold text-gray-500">Input:</span> <code className="text-xs bg-gray-100 px-1 rounded">{tc.input}</code></div>
                                          <div><span className="font-semibold text-gray-500">Expected:</span> <code className="text-xs bg-green-100 px-1 rounded">{tc.expected_output}</code></div>
                                        </div>
                                      </div>
                                    ))}
                                    {testCases.length > 5 && <p className="text-xs text-gray-500 italic">...and {testCases.length - 5} more test cases</p>}
                                  </div>
                                </div>
                              ) : null;
                            } catch { return null; }
                          })()}

                          {/* Code: Starter Codes */}
                          {qType === QUESTION_TYPES.CODE && q.starter_codes && (() => {
                            try {
                              const starterCodes = JSON.parse(q.starter_codes.toString());
                              return starterCodes.length > 0 ? (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Starter Codes ({starterCodes.length} languages)</h4>
                                  <div className="space-y-2">
                                    {starterCodes.map((sc: any, sci: number) => (
                                      <div key={sci}>
                                        <span className="text-xs font-semibold text-violet-700 uppercase mb-1 block">{sc.language}</span>
                                        <SyntaxHighlighter language={sc.language === 'cpp' ? 'cpp' : sc.language} style={vscDarkPlus} customStyle={{ fontSize: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', maxHeight: '200px' }} showLineNumbers={false}>
                                          {sc.code}
                                        </SyntaxHighlighter>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            } catch { return null; }
                          })()}

                          {/* Code: test_stub fallback */}
                          {qType === QUESTION_TYPES.CODE && !q.starter_codes && q.test_stub && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Starter Code</h4>
                              <SyntaxHighlighter language={q.programming_language || 'java'} style={vscDarkPlus} customStyle={{ fontSize: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', maxHeight: '200px' }} showLineNumbers={false}>
                                {q.test_stub}
                              </SyntaxHighlighter>
                            </div>
                          )}

                          {/* SQL Schema */}
                          {qType === QUESTION_TYPES.SQL && q.sql_schema && (() => {
                            try {
                              const schema = JSON.parse(q.sql_schema.toString());
                              return schema.length > 0 ? (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Table Schema</h4>
                                  {schema.map((table: any, ti: number) => (
                                    <div key={ti} className="mb-3 rounded-lg border border-green-200 overflow-hidden">
                                      <div className="bg-green-50 px-3 py-1.5 text-sm font-bold text-green-700">{table.table_name}</div>
                                      <table className="w-full text-xs">
                                        <thead><tr className="bg-gray-50"><th className="px-3 py-1.5 text-left font-semibold">Column</th><th className="px-3 py-1.5 text-left font-semibold">Type</th><th className="px-3 py-1.5 text-left font-semibold">Constraints</th></tr></thead>
                                        <tbody>
                                          {(table.columns || []).map((col: any, ci: number) => (
                                            <tr key={ci} className={ci % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                              <td className="px-3 py-1.5 font-medium">{col.name}</td>
                                              <td className="px-3 py-1.5 text-gray-600">{col.type}</td>
                                              <td className="px-3 py-1.5 text-gray-500">{col.constraints}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            } catch { return null; }
                          })()}

                          {/* SQL Test Cases */}
                          {qType === QUESTION_TYPES.SQL && q.sql_test_cases && (() => {
                            try {
                              const testCases = JSON.parse(q.sql_test_cases.toString());
                              const schema = q.sql_schema ? JSON.parse(q.sql_schema.toString()) : [];
                              return testCases.length > 0 ? (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">SQL Test Cases ({testCases.length})</h4>
                                  {testCases.map((tc: any, tci: number) => (
                                    <div key={tci} className="mb-3 p-3 bg-white rounded-lg border border-gray-200">
                                      <p className="text-xs font-semibold text-gray-600 mb-2">{tc.title || `Test ${tci + 1}`} {tc.marks ? `(${tc.marks} marks)` : ''}</p>
                                      {/* Input Tables */}
                                      {tc.table_data && Object.keys(tc.table_data).length > 0 && (
                                        <div className="mb-2">
                                          <p className="text-xs font-semibold text-blue-600 mb-1">→ Input Tables</p>
                                          {Object.entries(tc.table_data).map(([tableName, rows]: [string, any]) => {
                                            const schemaTable = schema.find((t: any) => t.table_name === tableName);
                                            const allRows = rows || [];
                                            let colNames: string[];
                                            let dataRows: any[][];
                                            if (schemaTable && schemaTable.columns.length > 0) {
                                              colNames = schemaTable.columns.map((c: any) => c.name);
                                              if (allRows.length > 0 && Array.isArray(allRows[0]) && allRows[0].length === colNames.length && allRows[0].every((cell: string, i: number) => cell === colNames[i])) {
                                                dataRows = allRows.slice(1);
                                              } else {
                                                dataRows = allRows;
                                              }
                                            } else if (allRows.length > 0 && Array.isArray(allRows[0])) {
                                              colNames = allRows[0];
                                              dataRows = allRows.slice(1);
                                            } else {
                                              colNames = [];
                                              dataRows = allRows;
                                            }
                                            return (
                                              <div key={tableName} className="mb-1.5">
                                                <p className="text-xs font-semibold text-gray-700 mb-0.5">{tableName}</p>
                                                <div className="overflow-x-auto border border-gray-200 rounded">
                                                  <table className="w-full text-xs">
                                                    <thead><tr className="bg-gray-100">{colNames.map((cn: string, ci: number) => (<th key={ci} className="px-2 py-1 text-left font-semibold text-gray-600 border-b">{cn}</th>))}</tr></thead>
                                                    <tbody>{dataRows.map((row: any[], rIdx: number) => (<tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>{row.map((cell: string, ci: number) => (<td key={ci} className="px-2 py-1 font-mono border-b border-gray-100">{cell || '—'}</td>))}</tr>))}</tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {/* Expected Output */}
                                      {tc.expected_output && (
                                        <div>
                                          <p className="text-xs font-semibold text-green-600 mb-1">◎ Expected Output</p>
                                          <div className="overflow-x-auto border border-green-200 rounded bg-green-50/30">
                                            <table className="w-full text-xs">
                                              <thead><tr className="bg-green-50">{(tc.expected_output.columns || []).map((cn: string, ci: number) => (<th key={ci} className="px-2 py-1.5 text-left font-semibold text-green-700 border-b border-green-200">{cn}</th>))}</tr></thead>
                                              <tbody>{(tc.expected_output.rows || []).map((row: string[], rIdx: number) => (<tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}>{row.map((cell: string, ci: number) => (<td key={ci} className="px-2 py-1 font-mono border-b border-green-100">{cell}</td>))}</tr>))}</tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            } catch { return null; }
                          })()}

                          {/* Hint */}
                          {q.hint && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-1">Hint</h4>
                              <p className="text-sm text-gray-700 italic">{q.hint}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{q.subject}</span>
                          <span>Class {q.class}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          {q.is_public === true || q.is_public === 'true' || q.is_public === undefined ? (
                            <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                              <span className="text-xs font-semibold">Public</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                              <span className="text-xs font-semibold">Private</span>
                            </div>
                          )}
                          <button
                            onClick={() => setExpandedPreviewId(isExpanded ? null : actualIndex)}
                            className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                            style={{ color: brandTheme.colors.primary }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                          </button>
                        </div>
                      </div>
                    </div>
                      );
                    })}
                </div>

                {/* Preview Pagination */}
                {parsedQuestions.length > PREVIEW_ITEMS_PER_PAGE && (
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((previewPage - 1) * PREVIEW_ITEMS_PER_PAGE) + 1} to {Math.min(previewPage * PREVIEW_ITEMS_PER_PAGE, parsedQuestions.length)} of {parsedQuestions.length} questions
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPreviewPage(prev => Math.max(1, prev - 1))}
                        disabled={previewPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.ceil(parsedQuestions.length / PREVIEW_ITEMS_PER_PAGE) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalPages = Math.ceil(parsedQuestions.length / PREVIEW_ITEMS_PER_PAGE);
                          return page === 1 || 
                                 page === totalPages || 
                                 page === previewPage || 
                                 page === previewPage - 1 || 
                                 page === previewPage + 1;
                        })
                        .map((page, idx, arr) => {
                          const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsis && <span className="px-2 text-gray-500">...</span>}
                              <button
                                onClick={() => setPreviewPage(page)}
                                className={`px-3 py-1 border rounded-md text-sm font-medium transition-colors ${
                                  previewPage === page
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}
                      
                      <button
                        onClick={() => setPreviewPage(prev => Math.min(Math.ceil(parsedQuestions.length / PREVIEW_ITEMS_PER_PAGE), prev + 1))}
                        disabled={previewPage === Math.ceil(parsedQuestions.length / PREVIEW_ITEMS_PER_PAGE)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => { setUploadStep('select'); setPreviewPage(1); }} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors">
                  Choose Different File
                </button>
                <button onClick={uploadQuestions} className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2" style={{ background: brandTheme.gradients.primary }}>
                  <Upload size={ICON_SIZES.MEDIUM} />
                  <span>Upload {parsedQuestions.length} Questions</span>
                </button>
              </div>
            </div>
          )}

          {uploadStep === UPLOAD_STEPS.UPLOADING && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={ICON_SIZES.XXXLARGE} className="animate-spin mb-6" style={{ color: brandTheme.colors.primary }} />
              <h3 className="text-base font-semibold text-gray-900 mb-2">Uploading Questions...</h3>
              <p className="text-gray-600 mb-6">Please wait while we process your questions</p>
              <div className="w-full max-w-md">
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${uploadProgress}%`, background: brandTheme.gradients.primary }} />
                </div>
                <p className="text-center mt-2 text-sm font-medium text-gray-700">{uploadProgress}%</p>
              </div>
            </div>
          )}

          {uploadStep === UPLOAD_STEPS.COMPLETE && (
            <div className="space-y-6">
              <div className="text-center py-8">
                {uploadResults.success > 0 && uploadResults.failed === 0 ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={ICON_SIZES.XXLARGE} className="text-green-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Upload Complete!</h3>
                    <p className="text-gray-600">All {uploadResults.success} questions were uploaded successfully</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={ICON_SIZES.XXLARGE} className="text-amber-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Upload Complete with Errors</h3>
                    <p className="text-gray-600">{uploadResults.success} succeeded, {uploadResults.failed} failed</p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{uploadResults.success}</p>
                  <p className="text-sm text-green-700 font-medium">Successful</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{uploadResults.failed}</p>
                  <p className="text-sm text-red-700 font-medium">Failed</p>
                </div>
              </div>
              {uploadResults.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                    <h4 className="font-semibold text-red-900">Errors ({uploadResults.errors.length})</h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-4 space-y-2">
                    {uploadResults.errors.map((error, idx) => (
                      <p key={idx} className="text-sm text-red-700">• {error}</p>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleClose} className="w-full px-4 py-3 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg" style={{ background: brandTheme.gradients.primary }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}