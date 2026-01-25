import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download,  CheckCircle, AlertCircle, Loader2, FileText} from 'lucide-react';
import { useBrand } from './BrandContext';
import * as XLSX from 'xlsx';
import { firebaseService } from './services/firebase_service';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck } from '@fortawesome/sharp-light-svg-icons';
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
  programming_language?: string;
  question_text: string;
  question_image_urls?: string;
  options?: string;
  correct_answers?: string;
  maximum_marks: number;
  difficulty_level: ComplexityLevel | string;
  hint?: string;
  solution?: string;
  test_cases?: string;
  test_stub?: string;
  marks_per_test_case?: string;
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
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.MCQ,
        programming_language: 'Java',
        question_text: '<h2>Basic For Loop Execution</h2><p>What will be the output of the following code?</p><code>for (int i = 0; i < 5; i++) {\n    System.out.print(i + " ");\n}</code>',
        question_image_urls: '',
        options: '0 1 2 3 4|0 1 2 3 4 5|1 2 3 4 5|0 1 2 3',
        correct_answers: '0 1 2 3 4',
        maximum_marks: 1,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'The loop starts at i=0 and continues while i<5',
        solution: '<p>Loop execution trace: Iteration 1: i=0, condition (0<5) is true → Print "0 ", i becomes 1. Iteration 2: i=1, condition (1<5) is true → Print "1 ", i becomes 2. And so on until i=5.</p>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'loops,for-loop,java-basics,control-flow'
      },
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.MCQ,
        programming_language: 'Java',
        question_text: '<h2>MCQ with Multiple Correct Answers</h2><p>Which of the following are valid loop types in Java? (Multiple answers)</p>',
        question_image_urls: '',
        options: 'for loop|while loop|repeat-until loop|do-while loop',
        correct_answers: 'for loop|while loop|do-while loop',
        maximum_marks: 3,
        difficulty_level: COMPLEXITY_LEVELS.MEDIUM,
        hint: 'Java has three main loop constructs',
        solution: '<p>Java supports for, while, and do-while loops. repeat-until is not a valid Java loop construct.</p>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'loops,java-syntax,control-structures'
      },
      // Fill in the Blank Questions
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java OOPs Concepts',
        type: QUESTION_TYPES.FITB,
        programming_language: 'java',
        question_text: '<h2>Static Members</h2><p>Fill in the blanks about static keyword.</p><p>The _____ keyword is used to create class-level members. Static variables are shared among _____ instances of the class.</p>',
        question_image_urls: '',
        options: '',
        correct_answers: 'static|all',
        maximum_marks: 2,
        difficulty_level: COMPLEXITY_LEVELS.MEDIUM,
        hint: 'Static members belong to class, not individual objects',
        solution: '<p>The <strong>static</strong> keyword is used to create class-level members. Static variables are shared among <strong>all</strong> instances of the class.</p>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'oop,static,java-keywords,class-members'
      },
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Enumerations',
        type: QUESTION_TYPES.FITB,
        programming_language: 'java',
        question_text: '<h2>Define and Use Enum</h2><p>Fill in the blanks to create and use an enum.</p><code>\n_____ Day {\n    MONDAY, TUESDAY, WEDNESDAY\n}\n_____ today = Day.MONDAY;\nSystem.out.println(today);\n</code>',
        question_image_urls: '',
        options: '',
        correct_answers: 'enum|Day',
        maximum_marks: 2,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Use enum keyword to define, enum name for variable type',
        solution: '<code>\n<strong>enum</strong> Day {\n    MONDAY, TUESDAY, WEDNESDAY\n}\n<strong>Day</strong> today = Day.MONDAY;\nSystem.out.println(today);\n</code>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'enumerations,java-syntax,data-types'
      },
      // Jumbled Quiz Questions
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.JUMBLED,
        programming_language: 'java',
        question_text: '<h2>Print Numbers 1 to 5</h2><p>Arrange the code to print numbers from 1 to 5 using a for loop.</p>',
        question_image_urls: '',
        options: 'System.out.println(i);|}|for (int i = 1; i <= 5; i++) {',
        correct_answers: 'for (int i = 1; i <= 5; i++) {|System.out.println(i);|}',
        maximum_marks: 3,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Loop declaration first, then print statement, then closing brace',
        solution: '<h3>Correct Sequence:</h3><code>\nfor (int i = 1; i <= 5; i++) {\n    System.out.println(i);\n}\n</code><p><strong>Output:</strong> 1 2 3 4 5</p>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'loops,code-arrangement,java-basics'
      },
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java OOPs Concepts',
        type: QUESTION_TYPES.JUMBLED,
        programming_language: 'java',
        question_text: '<h2>Method Overloading - Add Numbers</h2><p>Arrange the code to demonstrate method overloading with two add methods.</p>',
        question_image_urls: '',
        options: 'System.out.println(add(5, 10));|static int add(int a, int b, int c) { return a + b + c; }|System.out.println(add(5, 10, 15));|static int add(int a, int b) { return a + b; }',
        correct_answers: 'static int add(int a, int b) { return a + b; }|static int add(int a, int b, int c) { return a + b + c; }|System.out.println(add(5, 10));|System.out.println(add(5, 10, 15));',
        maximum_marks: 4,
        difficulty_level: COMPLEXITY_LEVELS.MEDIUM,
        hint: 'Define first add method with 2 params, second add with 3 params, call both',
        solution: '<h3>Correct Sequence:</h3><code>\nstatic int add(int a, int b) { return a + b; }\nstatic int add(int a, int b, int c) { return a + b + c; }\nSystem.out.println(add(5, 10));\nSystem.out.println(add(5, 10, 15));\n</code>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'oop,method-overloading,polymorphism'
      },
      // Descriptive Questions
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.DESCRIPTIVE,
        programming_language: 'java',
        question_text: '<h2>Print Your Name 5 Times</h2><p>Write a Java program using a for loop to print your name 5 times.</p><h3>Examples</h3><p><strong>Output:</strong><br><code>Mohammad\nMohammad\nMohammad\nMohammad\nMohammad</code></p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 5,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Use for loop from 1 to 5',
        solution: '<code>\nfor (int i = 1; i <= 5; i++) {\n    System.out.println("Mohammad");\n}\n</code><p><strong>Output:</strong> Name printed 5 times.</p>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'loops,for-loop,java-basics,programming'
      },
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java Loops',
        type: QUESTION_TYPES.DESCRIPTIVE,
        programming_language: 'java',
        question_text: '<h2>Print Even Numbers from 2 to 10</h2><p>Write a program using while loop to print even numbers from 2 to 10.</p><h3>Examples</h3><p><strong>Output:</strong><br><code>2 4 6 8 10</code></p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 5,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Start from 2, increment by 2',
        solution: '<code>\nint i = 2;\nwhile (i <= 10) {\n    System.out.print(i + " ");\n    i += 2;\n}\n</code><p><strong>Output:</strong> 2 4 6 8 10</p>',
        test_cases: '',
        test_stub: '',
        marks_per_test_case: '',
        tags: 'loops,while-loop,even-numbers,programming'
      },
      // Code Questions
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java OOPs Concepts',
        type: QUESTION_TYPES.CODE,
        programming_language: 'Java',
        question_text: '<h2>Create Student Class with Basic Operations</h2><p>Write a program to create a <strong>Student</strong> class with instance variables <strong>name</strong> (String), <strong>rollNumber</strong> (int), and <strong>marks</strong> (double). Create a method <strong>displayInfo()</strong> that prints the details in the format: "Name: [name], Roll: [rollNumber], Marks: [marks]".</p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 4,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Define Student class with three instance variables. Create method displayInfo() that uses System.out.println() with the required format',
        solution: 'import java.util.Scanner;\n\nclass Student {\n    String name;\n    int rollNumber;\n    double marks;\n    \n    void displayInfo() {\n        System.out.println("Name: " + name + ", Roll: " + rollNumber + ", Marks: " + marks);\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Student s = new Student();\n        s.name = sc.nextLine();\n        s.rollNumber = sc.nextInt();\n        s.marks = sc.nextDouble();\n        s.displayInfo();\n    }\n}',
        test_cases: JSON.stringify([
          { input: 'John\n101\n85.5', expected_output: 'Name: John, Roll: 101, Marks: 85.5\n', marks: 0.4 },
          { input: 'Alice\n201\n92.0', expected_output: 'Name: Alice, Roll: 201, Marks: 92.0\n', marks: 0.4 },
          { input: 'Bob\n102\n78.5', expected_output: 'Name: Bob, Roll: 102, Marks: 78.5\n', marks: 0.4 },
          { input: 'Charlie\n303\n88.0', expected_output: 'Name: Charlie, Roll: 303, Marks: 88.0\n', marks: 0.4 },
          { input: 'David\n104\n95.5', expected_output: 'Name: David, Roll: 104, Marks: 95.5\n', marks: 0.4 },
          { input: 'Eve\n205\n82.0', expected_output: 'Name: Eve, Roll: 205, Marks: 82.0\n', marks: 0.4 },
          { input: 'Frank\n106\n91.5', expected_output: 'Name: Frank, Roll: 106, Marks: 91.5\n', marks: 0.4 },
          { input: 'Grace\n307\n87.0', expected_output: 'Name: Grace, Roll: 307, Marks: 87.0\n', marks: 0.4 },
          { input: 'Henry\n108\n93.5', expected_output: 'Name: Henry, Roll: 108, Marks: 93.5\n', marks: 0.4 },
          { input: 'Ivy\n209\n89.0', expected_output: 'Name: Ivy, Roll: 209, Marks: 89.0\n', marks: 0.4 }
        ]),
        test_stub: 'import java.util.Scanner;\n\nclass Student {\n    String name;\n    int rollNumber;\n    double marks;\n    \n    void displayInfo() {\n        // Your Code Starts Here\n        \n        // Your Code Ends Here\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Student s = new Student();\n        s.name = sc.nextLine();\n        s.rollNumber = sc.nextInt();\n        s.marks = sc.nextDouble();\n        s.displayInfo();\n    }\n}',
        marks_per_test_case: '0.4',
        tags: 'oop,classes,methods,java-programming'
      },
      {
        board: '',
        is_public: true,
        class: 'MCA-1',
        subject: 'Java',
        chapter: 'Java OOPs Concepts',
        type: QUESTION_TYPES.CODE,
        programming_language: 'Java',
        question_text: '<h2>Rectangle Class with Area and Perimeter</h2><p>Write a program to create a <strong>Rectangle</strong> class with instance variables <strong>length</strong> and <strong>width</strong>. Implement methods <strong>calculateArea()</strong> and <strong>calculatePerimeter()</strong>.</p>',
        question_image_urls: '',
        options: '',
        correct_answers: '',
        maximum_marks: 4,
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: 'Create Rectangle class with length and width as instance variables. Implement two methods that return calculated values',
        solution: 'import java.util.Scanner;\n\nclass Rectangle {\n    double length;\n    double width;\n    \n    double calculateArea() {\n        return length * width;\n    }\n    \n    double calculatePerimeter() {\n        return 2 * (length + width);\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Rectangle r = new Rectangle();\n        r.length = sc.nextDouble();\n        r.width = sc.nextDouble();\n        System.out.println("Area: " + r.calculateArea());\n        System.out.println("Perimeter: " + r.calculatePerimeter());\n    }\n}',
        test_cases: JSON.stringify([
          { input: '5.0 3.0', expected_output: 'Area: 15.0\nPerimeter: 16.0\n', marks: 0.4 },
          { input: '10.0 5.0', expected_output: 'Area: 50.0\nPerimeter: 30.0\n', marks: 0.4 },
          { input: '7.5 2.5', expected_output: 'Area: 18.75\nPerimeter: 20.0\n', marks: 0.4 },
          { input: '4.0 4.0', expected_output: 'Area: 16.0\nPerimeter: 16.0\n', marks: 0.4 },
          { input: '12.0 8.0', expected_output: 'Area: 96.0\nPerimeter: 40.0\n', marks: 0.4 },
          { input: '6.0 3.0', expected_output: 'Area: 18.0\nPerimeter: 18.0\n', marks: 0.4 },
          { input: '9.0 4.0', expected_output: 'Area: 36.0\nPerimeter: 26.0\n', marks: 0.4 },
          { input: '15.0 10.0', expected_output: 'Area: 150.0\nPerimeter: 50.0\n', marks: 0.4 },
          { input: '8.5 6.5', expected_output: 'Area: 55.25\nPerimeter: 30.0\n', marks: 0.4 },
          { input: '11.0 7.0', expected_output: 'Area: 77.0\nPerimeter: 36.0\n', marks: 0.4 }
        ]),
        test_stub: 'import java.util.Scanner;\n\nclass Rectangle {\n    double length;\n    double width;\n    \n    double calculateArea() {\n        // Your Code Starts Here\n        \n        // Your Code Ends Here\n        return 0;\n    }\n    \n    double calculatePerimeter() {\n        // Your Code Starts Here\n        \n        // Your Code Ends Here\n        return 0;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Rectangle r = new Rectangle();\n        r.length = sc.nextDouble();\n        r.width = sc.nextDouble();\n        System.out.println("Area: " + r.calculateArea());\n        System.out.println("Perimeter: " + r.calculatePerimeter());\n    }\n}',
        marks_per_test_case: '0.4',
        tags: 'oop,classes,methods,calculations,geometry'
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
      { wch: EXCEL_COLUMN_WIDTHS.MEDIUM },       // 7. programming_language
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XLARGE }, // 8. question_text
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_MEDIUM }, // 9. question_image_urls
      { wch: EXCEL_COLUMN_WIDTHS.EXTRA_WIDE },   // 10. options
      { wch: EXCEL_COLUMN_WIDTHS.MEDIUM },       // 11. correct_answers
      { wch: EXCEL_COLUMN_WIDTHS.STANDARD },     // 12. maximum_marks
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_MEDIUM }, // 13. difficulty_level
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_MEDIUM }, // 14. hint
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XLARGE }, // 15. solution
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_XXLARGE }, // 16. test_cases
      { wch: EXCEL_COLUMN_WIDTHS.CONTENT_LARGE }, // 17. test_stub
      { wch: EXCEL_COLUMN_WIDTHS.STANDARD },     // 18. marks_per_test_case
      { wch: EXCEL_COLUMN_WIDTHS.LARGE }         // 19. tags ✅
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
      [''],
      ['Difficulty Levels (Select from these):'],
      [COMPLEXITY_LEVELS.EASY],
      [COMPLEXITY_LEVELS.MEDIUM],
      [COMPLEXITY_LEVELS.HARD],
      [''],
      ['Programming Languages (commonly used):'],
      ['Java'],
      ['Python'],
      ['C'],
      ['C++'],
      ['JavaScript'],
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
      ['type', `Question type: ${QUESTION_TYPES.MCQ}, ${QUESTION_TYPES.FITB}, ${QUESTION_TYPES.DESCRIPTIVE}, ${QUESTION_TYPES.JUMBLED}, ${QUESTION_TYPES.CODE}`],
      ['programming_language', 'Programming language for the question (e.g., Java, Python, C++). Recommended for all questions.'],
      ['question_text', 'The actual question text. Supports HTML tags like <h2>, <p>, <code>, <strong> for rich formatting'],
      ['options', 'For MCQ & JUMBLED: separate options/items with | (e.g., "Option 1|Option 2|Option 3|Option 4")'],
      ['correct_answers', 'For MCQ: Single OR multiple correct answers separated by | | For FITB: answers for each blank separated by | | For JUMBLED: correct sequence separated by |'],
      ['maximum_marks', 'Numeric value for marks (e.g., 1, 2, 5)'],
      ['difficulty_level', `${COMPLEXITY_LEVELS.EASY}, ${COMPLEXITY_LEVELS.MEDIUM}, or ${COMPLEXITY_LEVELS.HARD}`],
      ['hint', 'Hint for solving (optional). Supports HTML formatting.'],
      ['solution', 'Detailed solution (optional). Supports HTML formatting.'],
      ['test_cases', 'For CODE questions: JSON array of test cases with input, expected_output, and marks'],
      ['test_stub', 'For CODE questions: Starter code template that students will complete'],
      ['marks_per_test_case', 'Optional: Marks for each test case. Use single value (e.g., "0.4") or comma-separated (e.g., "0.4,0.4,0.3")'],
      ['tags', 'Optional: Comma-separated tags for categorization (e.g., "loops,for-loop,java-basics"). Automatically lowercased.'],
      [''],
      ['HTML Formatting in question_text, hint, solution:'],
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
      [QUESTION_TYPES.CODE, 'Requires: programming_language, test_cases (JSON), and test_stub'],
      [''],
      ['Code Question Format:'],
      ['test_cases', 'JSON array format: [{"input":"John\\n101\\n85.5","expected_output":"Name: John, Roll: 101, Marks: 85.5\\n","marks":0.4}]'],
      ['test_stub', 'Starter code with function/class structure. Use comments like "// Your Code Starts Here" to indicate where students write code'],
      [''],
      ['Examples (See Questions sheet for complete examples):'],
      ['MCQ', 'Single answer: correct_answers = "0 1 2 3 4"  |  Multiple answers: correct_answers = "for loop|while loop|do-while loop"'],
      ['FITB', 'Two blanks: question has "The _____ keyword... among _____ instances"  |  correct_answers = "static|all"'],
      ['Jumbled', 'Code arrangement: options = "System.out.println(i);|}|for (int i = 1; i <= 5; i++) {"  |  correct_answers = "for (int i = 1; i <= 5; i++) {|System.out.println(i);|}"'],
      ['Descriptive', 'Open-ended questions where students write full answers. No options or correct_answers needed.'],
      ['Code', 'Complete programming problems with automated testing. Requires test_cases JSON and test_stub template.']
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
        
        // Validate chapter is provided
        if (!question.chapter || !question.chapter.toString().trim()) {
          results.failed++;
          results.errors.push(`Row ${i + EXCEL_ROW_OFFSET}: ${NOTIFICATION_MESSAGES.CHAPTER_REQUIRED}`);
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
          solution: question.solution || QUESTION_DEFAULTS.EMPTY_STRING,
          
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
          
          ...(mapQuestionType(question.type) === QUESTION_TYPES.CODE && {
            programming_language: question.programming_language?.toString().trim(),
            test_cases: question.test_cases 
              ? JSON.parse(question.test_cases.toString().trim()) 
              : [],
            test_stub: question.test_stub?.toString().trim()
          })
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
    
    // Process: trim, lowercase, remove empty, deduplicate
    const processed = tags
      .map(tag => String(tag).trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    return [...new Set(processed)];
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
                      <li className="flex items-start"><span className="mr-2">•</span><span><strong>Optional:</strong> board (empty if not provided), hint, solution</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span><strong>MCQ with multiple correct answers:</strong> Separate correct answers with | (e.g., "Answer1|Answer2")</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span><strong>CODE questions:</strong> Must include programming_language, test_cases (JSON), and test_stub</span></li>
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
                <div className="max-h-96 overflow-y-auto">
                  {parsedQuestions
                    .slice((previewPage - 1) * PREVIEW_ITEMS_PER_PAGE, previewPage * PREVIEW_ITEMS_PER_PAGE)
                    .map((q, idx) => {
                      const actualIndex = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE + idx;
                      return (
                    <div key={actualIndex} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{actualIndex + 1}</span>
                          {q.board && (
                            <span className="text-xs font-semibold px-2 py-1 rounded"
                              style={{ 
                                backgroundColor: brandTheme.colors.secondary + '20',
                                color: brandTheme.colors.secondary
                              }}>{q.board}</span>
                          )}
                          <span className="text-xs font-semibold px-2 py-1 rounded"
                            style={{ 
                              backgroundColor: brandTheme.colors.primary + '20',
                              color: brandTheme.colors.primary
                            }}>{getTypeDisplayName(q.type)}</span>
                          {q.type === 'code' && q.programming_language && (
                            <span className="text-xs font-semibold px-2 py-1 rounded"
                              style={{ 
                                backgroundColor: brandTheme.colors.accent + '20',
                                color: brandTheme.colors.accent
                              }}>💻 {q.programming_language}</span>
                          )}
                          <span className="text-xs font-semibold px-2 py-1 rounded"
                            style={{ 
                              backgroundColor: brandTheme.colors.primary + '30',
                              color: brandTheme.colors.primary
                            }}>{q.subject}</span>
                          <span className="text-xs font-semibold px-2 py-1 rounded"
                            style={{ 
                              backgroundColor: brandTheme.colors.accent + '30',
                              color: brandTheme.colors.accent
                            }}>Class {q.class}</span>
                          {q.tags && processQuestionTags(q.tags).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {processQuestionTags(q.tags).slice(0, 3).map((tag: string, tagIdx: number) => (
                                <span
                                  key={tagIdx}
                                  className="text-xs font-semibold px-2 py-1 rounded"
                                  style={{ 
                                    backgroundColor: '#3B82F620',
                                    color: '#3B82F6'
                                  }}
                                >
                                  🏷️ {tag}
                                </span>
                              ))}
                              {processQuestionTags(q.tags).length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{processQuestionTags(q.tags).length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{q.maximum_marks} marks</span>
                      </div>
                      <div className="space-y-3">
                        {(() => {
                          // Process the HTML to wrap code blocks with copy buttons and syntax highlighting
                          const processHTML = (html: string) => {
                            // Split by code tags
                            const parts = html.split(/(<code>.*?<\/code>)/gs);
                            
                            return parts.map((part, index) => {
                              // Check if this is a code block
                              const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                              
                              if (codeMatch) {
                                const codeContent = codeMatch[1];
                                const codeId = `preview-code-${idx}-${index}`;
                                
                                // Determine programming language
                                const detectLanguage = (code: string): string => {
                                  // If it's a code question, use its language
                                  if (q.programming_language) {
                                    return q.programming_language.toLowerCase();
                                  }
                                  
                                  // Simple auto-detection based on code patterns
                                  if (code.includes('def ') || code.includes('import numpy') || code.includes('print(')) {
                                    return 'python';
                                  }
                                  if (code.includes('function ') || code.includes('const ') || code.includes('let ') || code.includes('=>')) {
                                    return 'javascript';
                                  }
                                  if (code.includes('public class') || code.includes('public static void') || code.includes('System.out')) {
                                    return 'java';
                                  }
                                  if (code.includes('#include') || code.includes('int main()')) {
                                    return 'cpp';
                                  }
                                  if (code.includes('SELECT') || code.includes('FROM') || code.includes('WHERE')) {
                                    return 'sql';
                                  }
                                  
                                  // Default to java for educational content
                                  return 'java';
                                };
                                
                                const language = detectLanguage(codeContent);
                                
                                return (
                                  <div key={index} className="relative rounded-lg overflow-hidden">
                                    {/* Terminal-style header with dots and copy button */}
                                    <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                      {/* macOS-style dots */}
                                      <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                      </div>
                                      
                                      {/* Copy button */}
                                      <button
                                        onClick={() => copyToClipboard(codeContent, codeId)}
                                        className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                        title="Copy to clipboard"
                                      >
                                        {copiedCode === codeId ? (
                                          <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                        ) : (
                                          <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                        )}
                                      </button>
                                    </div>
                                    
                                    {/* Code content with top padding for header */}
                                    <div className="pt-10">
                                      <SyntaxHighlighter
                                        language={language}
                                        style={vscDarkPlus}
                                        customStyle={{
                                          margin: 0,
                                          borderRadius: 0,
                                          borderBottomLeftRadius: '0.5rem',
                                          borderBottomRightRadius: '0.5rem',
                                          fontSize: '0.875rem',
                                          padding: '1rem',
                                          paddingTop: '0.5rem'
                                        }}
                                        showLineNumbers={false}
                                      >
                                        {codeContent}
                                      </SyntaxHighlighter>
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Regular HTML content
                              return (
                                <div
                                  key={index}
                                  className="prose prose-sm max-w-none
                                    [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-3 [&>h1]:mt-2
                                    [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-2 [&>h2]:mt-2
                                    [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-2 [&>h3]:mt-2
                                    [&>p]:text-base [&>p]:text-gray-800 [&>p]:mb-2 [&>p]:leading-relaxed
                                    [&_strong]:font-bold [&_strong]:text-gray-900
                                    [&_br]:block [&_br]:mb-2
                                    [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2
                                    [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2
                                    [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ __html: part }}
                                />
                              );
                            });
                          };
                          
                          return processHTML(q.question_text);
                        })()}
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