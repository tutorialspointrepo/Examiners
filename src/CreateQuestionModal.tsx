import { useState, useEffect, useRef } from 'react';
import { faFileText, faCode, faDatabase, faCheckDouble, faShuffle, faPenToSquare, faCircleCheck, faXmark, faPlus, faFloppyDisk, faTrash, faCircleExclamation, faSparkles, faImage, faGripVertical, faChevronDown, faBookOpen, faAward, faListCheck, faCircleQuestion } from '@fortawesome/sharp-light-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useBrand } from './BrandContext';
import { firebaseService } from './services/firebase_service';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  QUESTION_TYPES, 
  QUESTION_TYPE_LABELS,
  COMPLEXITY_LEVELS,
  COMPLEXITY_LABELS,
  type QuestionType,
  type ComplexityLevel
} from './constants';
import type { 
  CreateQuestionInput 
} from './types/question.types';
import RichTextEditor from './RichTextEditor';

interface CreateQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkUpload: () => void;
  activeCollegeId: string;
  activeCollegeName: string;
  currentUser: any;
  onQuestionAdded: () => void;
}

interface QuestionFormData {
  board: string;
  class: string[];
  subject: string;
  chapter: string;
  type: QuestionType;
  question_text: string;
  question_image_urls: string[]; // Changed to array for multiple images (max 5)
  options: string[];
  correct_answers: string[];
  blanks: string[][]; // Added: 2D array for multiple blanks, each with multiple acceptable answers
  correct_sequence: number[]; // For jumbled quiz
  maximum_marks: number;
  year: string;
  difficulty_level: ComplexityLevel;
  hint: string;
  is_public: boolean; // true = public/common, false = private/proprietary
  tags: string[]; // Added: tags for categorization
  // Code question specific fields
  test_cases?: Array<{ input: string; expected_output: string; marks?: number }>;
  test_stub?: string;
  starter_codes?: Array<{ language: string; code: string }>;
  // SQL question specific fields
  sql_schema?: Array<{
    table_name: string;
    columns: Array<{ name: string; type: string; description: string; constraints: string }>;
    primary_key: string;
    note: string;
  }>;
  sql_test_cases?: Array<{
    title: string;
    table_data: Record<string, string[][]>; // table_name -> rows (first row is header)
    expected_output: { columns: string[]; rows: string[][] };
    marks: number;
  }>;
}

interface CollegeData {
  boards: string[];
  subjects: string[];
  classes: string[];
}

const questionTypes = [
  { value: QUESTION_TYPES.DESCRIPTIVE, label: QUESTION_TYPE_LABELS[QUESTION_TYPES.DESCRIPTIVE], icon: faFileText, gradient: 'from-green-500 to-teal-500', gradientColors: '#10b981, #14b8a6', description: 'Long form answers' },
  { value: QUESTION_TYPES.CODE, label: QUESTION_TYPE_LABELS[QUESTION_TYPES.CODE], icon: faCode, gradient: 'from-indigo-500 to-violet-500', gradientColors: '#6366f1, #8b5cf6', description: 'Programming questions' },
  { value: QUESTION_TYPES.SQL, label: QUESTION_TYPE_LABELS[QUESTION_TYPES.SQL], icon: faDatabase, gradient: 'from-emerald-500 to-cyan-500', gradientColors: '#10b981, #06b6d4', description: 'Database queries' },
  { value: QUESTION_TYPES.MCQ, label: QUESTION_TYPE_LABELS[QUESTION_TYPES.MCQ], icon: faCheckDouble, gradient: 'from-blue-500 to-cyan-500', gradientColors: '#3b82f6, #06b6d4', description: 'Questions with options' },
  { value: QUESTION_TYPES.JUMBLED, label: QUESTION_TYPE_LABELS[QUESTION_TYPES.JUMBLED], icon: faShuffle, gradient: 'from-orange-500 to-red-500', gradientColors: '#f97316, #ef4444', description: 'Arrange in order' },
  { value: QUESTION_TYPES.FITB, label: QUESTION_TYPE_LABELS[QUESTION_TYPES.FITB], icon: faPenToSquare, gradient: 'from-purple-500 to-pink-500', gradientColors: '#a855f7, #ec4899', description: 'Complete the answer' }
];

const difficultyLevels = [
  { value: COMPLEXITY_LEVELS.EASY, label: COMPLEXITY_LABELS[COMPLEXITY_LEVELS.EASY], emoji: '😊', color: 'green' },
  { value: COMPLEXITY_LEVELS.MEDIUM, label: COMPLEXITY_LABELS[COMPLEXITY_LEVELS.MEDIUM], emoji: '🤔', color: 'yellow' },
  { value: COMPLEXITY_LEVELS.HARD, label: COMPLEXITY_LABELS[COMPLEXITY_LEVELS.HARD], emoji: '😰', color: 'red' }
];

export default function CreateQuestionModal({
  isOpen,
  onClose,
  onBulkUpload,
  activeCollegeId,
  activeCollegeName,
  currentUser,
  onQuestionAdded
}: CreateQuestionModalProps) {
  const brandTheme = useBrand();
  const questionImageInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [view, setView] = useState<'choice' | 'manual' | 'success'>('choice');
  const [collegeData, setCollegeData] = useState<CollegeData>({
    boards: [],
    subjects: [],
    classes: []
  });
  const [isLoadingCollegeData, setIsLoadingCollegeData] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<QuestionFormData>({
    board: '',
    class: [],
    subject: '',
    chapter: '',
    type: QUESTION_TYPES.DESCRIPTIVE,
    question_text: '',
    question_image_urls: [], // Initialize as empty array
    options: ['', '', '', ''],
    correct_answers: [],
    blanks: [['']], // Initialize with one blank containing one empty answer
    correct_sequence: [],
    maximum_marks: 1,
    year: '',
    difficulty_level: COMPLEXITY_LEVELS.EASY,
    hint: '',
    is_public: false, // Default to private questions
    tags: [], // Initialize tags as empty array
    test_cases: [{ input: '', expected_output: '', marks: 0 }],
    test_stub: '',
    starter_codes: [{ language: 'python', code: '' }],
    sql_schema: [{
      table_name: '',
      columns: [{ name: '', type: 'int', description: '', constraints: '' }],
      primary_key: '',
      note: ''
    }],
    sql_test_cases: [{
      title: 'Test Case 1',
      table_data: {},
      expected_output: { columns: [''], rows: [['']] },
      marks: 0
    }]
  }); 

  const [showStarterCodeHelp, setShowStarterCodeHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState(''); // For tag input field

  // Auto-scroll to error when it appears
  useEffect(() => {
    if (error && errorRef.current && scrollContainerRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  // Reset view to 'choice' when modal opens
  useEffect(() => {
    if (isOpen) {
      // Force immediate reset
      setView('choice');
      setError(null);
      setIsSubmitting(false);
    } else {
      // Clean up when modal closes - also reset view
      setView('choice');
      setFormData({
        board: '',
        class: [],
        subject: '',
        chapter: '',
        type: QUESTION_TYPES.MCQ,
        question_text: '',
        question_image_urls: [], // Reset as empty array
        options: ['', '', '', ''],
        correct_answers: [],
        blanks: [['']], // Reset blanks to one blank with one empty answer
        correct_sequence: [],
        maximum_marks: 1,
        year: '',
        difficulty_level: COMPLEXITY_LEVELS.EASY,
        hint: '',
        is_public: false,
        tags: [] // Add tags to reset
      });
    }
  }, [isOpen]);

  // Load college data when modal opens or when switching to manual view
  useEffect(() => {
    if (isOpen && activeCollegeId && (view === 'manual' || view === 'choice')) {
      loadCollegeData();
    }
  }, [isOpen, activeCollegeId, view]);

  const loadCollegeData = async () => {
    setIsLoadingCollegeData(true);
    setError(null);
    try {
      console.log('Loading college data for:', activeCollegeId);
      const college = await firebaseService.getCollegeById(activeCollegeId);
      console.log('College data received:', college);
      
      if (!college) {
        throw new Error('University not found');
      }
      
      // Get data from college or use fallback
      const boards = (college.supportedBoards && college.supportedBoards.length > 0) 
        ? college.supportedBoards 
        : ['CBSE', 'ICSE', 'State Board'];
      
      const classes = (college.validClasses && college.validClasses.length > 0)
        ? college.validClasses
        : ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
      
      const subjects = (college.subjects && college.subjects.length > 0)
        ? college.subjects
        : ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science'];
      // Ensure 'Database' subject is always available for SQL question type
      if (!subjects.includes('Database')) {
        subjects.push('Database');
      }
      
      console.log('Setting college data:', { boards, classes, subjects });
      setCollegeData({ boards, classes, subjects });
      
      // Set initial form values when switching to manual view
      if (view === 'manual') {
        setFormData(prev => ({
          ...prev,
          board: boards[0] || '',
          class: [],
          subject: subjects[0] || ''
        }));
      }
    } catch (error) {
      console.error('Error loading college data:', error);
      setError('Failed to load university data. Using default values.');
      
      // Set fallback values even on error
      const fallbackData = {
        boards: ['CBSE', 'ICSE', 'State Board'],
        classes: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'],
        subjects: ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Database']
      };
      setCollegeData(fallbackData);
      
      if (view === 'manual') {
        setFormData(prev => ({
          ...prev,
          board: fallbackData.boards[0],
          class: [],
          subject: fallbackData.subjects[0]
        }));
      }
    } finally {
      setIsLoadingCollegeData(false);
    }
  };

  const handleInputChange = (field: keyof QuestionFormData, value: any) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // If subject changed away from 'Database' and type was SQL, reset to Descriptive
      if (field === 'subject' && value !== 'Database' && prev.type === QUESTION_TYPES.SQL) {
        newData.type = QUESTION_TYPES.DESCRIPTIVE;
      }
      
      return newData;
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setFormData(prev => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) {
      setError('At least 2 options are required');
      return;
    }
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  const toggleCorrectAnswer = (index: number) => {
    const optionValue = formData.options[index];
    const isCurrentlyCorrect = formData.correct_answers.includes(optionValue);
    
    if (isCurrentlyCorrect) {
      setFormData(prev => ({
        ...prev,
        correct_answers: prev.correct_answers.filter(ans => ans !== optionValue)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        correct_answers: [...prev.correct_answers, optionValue]
      }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingImage(true);
      setError(null);

      // Check if adding these files would exceed the limit
      const currentImageCount = formData.question_image_urls.length;
      const newFilesCount = files.length;
      
      if (currentImageCount + newFilesCount > 5) {
        setError(`You can upload a maximum of 5 images. You currently have ${currentImageCount} image(s). Please select ${5 - currentImageCount} or fewer images.`);
        setIsUploadingImage(false);
        if (questionImageInputRef.current) {
          questionImageInputRef.current.value = '';
        }
        return;
      }

      // Validate each file
      const validFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file type
        if (!file.type.startsWith('image/')) {
          setError(`File "${file.name}" is not an image. Please upload only image files.`);
          setIsUploadingImage(false);
          if (questionImageInputRef.current) {
            questionImageInputRef.current.value = '';
          }
          return;
        }
        
        // Check file size (10MB = 10 * 1024 * 1024 bytes)
        if (file.size > 10 * 1024 * 1024) {
          setError(`Image "${file.name}" is larger than 10MB. Please compress it or choose a smaller image.`);
          setIsUploadingImage(false);
          if (questionImageInputRef.current) {
            questionImageInputRef.current.value = '';
          }
          return;
        }
        
        validFiles.push(file);
      }

      // Upload all valid files
      const uploadPromises = validFiles.map(file => 
        firebaseService.uploadQuestionImage(activeCollegeId, file)
      );
      
      const imageUrls = await Promise.all(uploadPromises);
      
      // Add new URLs to existing array
      setFormData(prev => ({ 
        ...prev, 
        question_image_urls: [...prev.question_image_urls, ...imageUrls] 
      }));
      
      console.log(`✅ ${imageUrls.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error('Error uploading images:', error);
      setError('Failed to upload images. Please try again.');
    } finally {
      setIsUploadingImage(false);
      // Reset the input
      if (questionImageInputRef.current) {
        questionImageInputRef.current.value = '';
      }
    }
  };

  const removeQuestionImage = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      question_image_urls: prev.question_image_urls.filter((_, i) => i !== index) 
    }));
  };

  // Drag and drop handlers for jumbled quiz
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOptions = [...formData.options];
    const draggedOption = newOptions[draggedIndex];
    newOptions.splice(draggedIndex, 1);
    newOptions.splice(index, 0, draggedOption);

    setFormData(prev => ({ ...prev, options: newOptions }));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    // Update correct sequence after drag
    const sequence = formData.options.map((_, index) => index);
    setFormData(prev => ({ ...prev, correct_sequence: sequence }));
  };

  const validateForm = (): boolean => {
    setError(null);

    // Basic validations
    if (!formData.board || !formData.class || formData.class.length === 0 || !formData.subject) {
      setError('Please select Board, at least one Class, and Subject');
      return false;
    }

    if (!formData.chapter || !formData.chapter.trim()) {
      setError('Chapter is required');
      return false;
    }

    if (!formData.question_text.trim()) {
      setError('Question text is required');
      return false;
    }

    if (formData.maximum_marks < 1) {
      setError('Maximum marks must be at least 1');
      return false;
    }

    // Type-specific validations
    if (formData.type === QUESTION_TYPES.MCQ) {
      if (formData.options.length < 2) {
        setError('At least 2 options are required for MCQ');
        return false;
      }
      if (formData.options.some(opt => !opt.trim())) {
        setError('All options must have text');
        return false;
      }
      if (formData.correct_answers.length === 0) {
        setError('Please select at least one correct answer');
        return false;
      }
    }

    if (formData.type === QUESTION_TYPES.FITB) {
      // Check if at least one blank has at least one non-empty answer
      const hasValidAnswer = formData.blanks.some(blankAnswers => 
        blankAnswers.some(answer => answer.trim() !== '')
      );
      if (!hasValidAnswer) {
        setError('At least one blank must have at least one answer');
        return false;
      }
    }
    
    // Descriptive questions don't need validation for specific answers
    // They are manually graded

    if (formData.type === QUESTION_TYPES.CODE) {
      // Validate starter codes
      const starterCodes = formData.starter_codes || [];
      if (starterCodes.length === 0) {
        setError('At least one starter code is required for code questions');
        return false;
      }
      const hasEmptyCode = starterCodes.some(sc => !sc.code.trim());
      if (hasEmptyCode) {
        setError('All starter code boxes must have code filled in');
        return false;
      }
      if (!formData.test_cases || formData.test_cases.length === 0) {
        setError('At least one test case is required for code questions');
        return false;
      }
      if (formData.test_cases.some(tc => !tc.input.trim() || !tc.expected_output.trim())) {
        setError('All test cases must have both input and expected output');
        return false;
      }
      // Validate total test case marks equals maximum marks
      const totalTestCaseMarks = formData.test_cases.reduce((sum, tc) => sum + (tc.marks || 0), 0);
      const roundedTotal = Math.round(totalTestCaseMarks * 100) / 100;
      if (roundedTotal !== formData.maximum_marks) {
        setError(`Total test case marks (${roundedTotal}) must equal maximum marks (${formData.maximum_marks})`);
        return false;
      }
    }

    if (formData.type === QUESTION_TYPES.SQL) {
      // Validate SQL schema
      const schema = formData.sql_schema || [];
      if (schema.length === 0) {
        setError('At least one table schema is required for SQL questions');
        return false;
      }
      if (schema.some(t => !t.table_name.trim())) {
        setError('All tables must have a name');
        return false;
      }
      if (schema.some(t => t.columns.length === 0 || t.columns.some(c => !c.name.trim() || !c.type.trim()))) {
        setError('All table columns must have a name and type');
        return false;
      }
      // Validate primary key uniqueness in input table data
      for (const table of schema) {
        if (table.primary_key.trim()) {
          const pkColIdx = table.columns.findIndex(c => c.name.trim() === table.primary_key.trim());
          if (pkColIdx >= 0) {
            for (let tcI = 0; tcI < (formData.sql_test_cases || []).length; tcI++) {
              const rows = (formData.sql_test_cases || [])[tcI].table_data[table.table_name] || [];
              const pkValues = rows.map(r => r[pkColIdx]).filter(v => v && v.trim());
              const uniquePk = new Set(pkValues);
              if (uniquePk.size < pkValues.length) {
                setError(`Test Case ${tcI + 1}: Table "${table.table_name}" has duplicate values in primary key column "${table.primary_key}"`);
                return false;
              }
            }
          }
        }
      }
      // Validate expected output columns don't exceed total input columns
      const totalInputColumns = schema.reduce((sum, t) => sum + t.columns.filter(c => c.name.trim()).length, 0);
      for (let tcI = 0; tcI < (formData.sql_test_cases || []).length; tcI++) {
        const outCols = (formData.sql_test_cases || [])[tcI].expected_output.columns.length;
        if (outCols > totalInputColumns && totalInputColumns > 0) {
          setError(`Test Case ${tcI + 1}: Expected output has ${outCols} columns but input tables only have ${totalInputColumns} columns total`);
          return false;
        }
      }
      // Validate SQL test cases
      const sqlTc = formData.sql_test_cases || [];
      if (sqlTc.length === 0) {
        setError('At least one test case is required for SQL questions');
        return false;
      }
      if (sqlTc.some(tc => tc.expected_output.columns.length === 0 || tc.expected_output.columns.some(c => !c.trim()))) {
        setError('All test cases must have expected output columns defined');
        return false;
      }
      // Validate total SQL test case marks equals maximum marks
      const totalSqlMarks = sqlTc.reduce((sum, tc) => sum + (tc.marks || 0), 0);
      const roundedSqlTotal = Math.round(totalSqlMarks * 100) / 100;
      if (roundedSqlTotal !== formData.maximum_marks) {
        setError(`Total test case marks (${roundedSqlTotal}) must equal maximum marks (${formData.maximum_marks})`);
        return false;
      }
    }

    if (formData.type === QUESTION_TYPES.JUMBLED) {
      if (formData.options.length < 2) {
        setError('At least 2 items are required for Jumbled Quiz');
        return false;
      }
      if (formData.options.some(opt => !opt.trim())) {
        setError('All items must have text');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare question data in CreateQuestionInput format
      const questionInput = {
        // Base fields - direct mapping
        question_text: formData.question_text,
        subject: formData.subject,
        class: formData.class,
        board: formData.board,
        chapter: formData.chapter || '',
        year: formData.year || '',
        type: formData.type,
        maximum_marks: formData.maximum_marks,
        difficulty_level: formData.difficulty_level,
        hint: formData.hint || '',
        question_image_urls: formData.question_image_urls || [],
        tags: formData.tags || [], // Include tags
        
        // Organization fields
        is_public: formData.is_public,
        college_id: activeCollegeId,
        college_name: activeCollegeName,
        created_by: currentUser?.userId || 'unknown',
        created_by_name: currentUser?.fullName || 'Unknown User',
        
        // Type-specific fields
        ...(formData.type === QUESTION_TYPES.MCQ && {
          options: formData.options,
          correct_answers: formData.correct_answers
        }),
        
        ...(formData.type === QUESTION_TYPES.FITB && {
          correct_answers: formData.blanks.flat().filter(a => a.trim() !== '')
        }),
        
        ...(formData.type === QUESTION_TYPES.DESCRIPTIVE && {
          correct_answers: [] // Empty array for consistency
        }),
        
        ...(formData.type === QUESTION_TYPES.JUMBLED && {
          correct_answers: formData.options.filter(opt => opt.trim() !== '')
          // jumbledItems will be auto-generated in transformation
        }),
        
        ...((formData.type === QUESTION_TYPES.CODE) && {
          test_cases: formData.test_cases,
          test_stub: (formData.starter_codes && formData.starter_codes.length > 0) ? formData.starter_codes[0].code : (formData.test_stub || ''),
          starter_codes: formData.starter_codes || []
        }),
        
        ...(formData.type === QUESTION_TYPES.SQL && {
          sql_schema: formData.sql_schema,
          sql_test_cases: formData.sql_test_cases
        })
      };

      console.log('Submitting question:', questionInput);
      
      // Save to Firebase - transformation happens in firebase_service
      const result = await firebaseService.createQuestion(questionInput as CreateQuestionInput);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create question');
      }

      // Show success view
      setView('success');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onQuestionAdded();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Error creating question:', error);
      setError(error.message || 'Failed to create question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
        
        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
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
      className={`fixed inset-0 z-[9999] flex items-start justify-start p-2 transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
        onClick={onClose}
      />
      
      <div 
        className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[50rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Choice View */}
        {view === 'choice' && (
          <>
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
                  <span className="text-lg">📝</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Create Questions</h2>
                  <p className="text-white/80 text-xs">Choose how you want to add questions</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
              >
                <FontAwesomeIcon icon={faXmark} className="text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-6">
                {/* Bulk Upload Option */}
                <button
                  onClick={() => {
                    onBulkUpload();
                  }}
                  className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-xl"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      <span className="text-3xl">📤</span>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">Bulk Upload</h3>
                      <p className="text-sm text-gray-600">
                        Upload multiple questions at once using Excel file
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span>Fast & Efficient</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span>Supports Excel/CSV</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span>Add 100s at once</span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300"></div>
                </button>

                {/* Manual Creation Option */}
                <button
                  onClick={() => setView('manual')}
                  className="group relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-xl"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300"
                      style={{ background: brandTheme.gradients.secondary || brandTheme.gradients.primary }}
                    >
                      <span className="text-3xl">✍️</span>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">Manual Creation</h3>
                      <p className="text-sm text-gray-600">
                        Create questions one by one with full control
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                        <span>Full Customization</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                        <span>Add Images</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                        <span>Hints</span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-purple-500 opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300"></div>
                </button>
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">💡 Tip:</span> Use Bulk Upload for importing existing question banks, 
                  and Manual Creation for crafting custom questions with images and formatting.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Manual Creation View */}
        {view === 'manual' && (
          <>
            {/* Header */}
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
                  <FontAwesomeIcon icon={faSparkles} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Create New Question</h2>
                  <p className="text-white/80 text-xs">{activeCollegeName || 'Select College'}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
                disabled={isSubmitting}
              >
                <FontAwesomeIcon icon={faXmark} className="text-white" />
              </button>
            </div>

            {/* Form Content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-4">
                {/* Error Message */}
                {error && (
                  <div ref={errorRef} className="bg-red-50 border-l-4 border-red-500 p-4 flex items-start space-x-3 rounded-lg">
                    <FontAwesomeIcon icon={faCircleExclamation} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-900">Error</p>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoadingCollegeData && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">Loading university data...</p>
                  </div>
                )}

                {!isLoadingCollegeData && (
                  <>
                    {/* Show warning if no data available */}
                    {(!collegeData.boards.length || !collegeData.classes.length || !collegeData.subjects.length) && (
                      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start space-x-3">
     <FontAwesomeIcon icon={faCircleExclamation} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="text-sm font-medium text-yellow-800">University data incomplete</p>
                            <p className="text-xs text-yellow-700 mt-1">
                              Using default values. Missing data: 
                              {!collegeData.boards.length && ' Boards'}
                              {!collegeData.classes.length && ' Classes'}
                              {!collegeData.subjects.length && ' Subjects'}
                            </p>
                            <details className="mt-2">
                              <summary className="cursor-pointer text-yellow-800 font-medium">Debug Info</summary>
                              <pre className="mt-2 text-[10px] bg-yellow-100 p-2 rounded overflow-auto">
                                {JSON.stringify({
                                  boards: collegeData.boards,
                                  classes: collegeData.classes,
                                  subjects: collegeData.subjects
                                }, null, 2)}
                              </pre>
                            </details>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Basic Information */}
                    <div className="border rounded-xl p-4"
                      style={{ 
                        background: brandTheme.gradients.card,
                        borderColor: brandTheme.colors.secondary + '33'
                      }}>
                      <div className="flex items-center space-x-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                          <FontAwesomeIcon icon={faFileText} style={{ color: brandTheme.colors.secondary }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Basic Information</h3>
                          <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Select the question details</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* Board */}
                        <div className="dropdown-container">
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                            Board <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === 'board' ? null : 'board')}
                              className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white"
                              disabled={collegeData.boards.length === 0}
                            >
                              <span className="text-gray-900">{formData.board || 'Select Board'}</span>
                              <FontAwesomeIcon icon={faChevronDown} className="text-gray-500" />
                            </button>
                            {openDropdown === 'board' && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                {collegeData.boards.map((board) => (
                                  <button
                                    key={board}
                                    onClick={() => {
                                      handleInputChange('board', board);
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                  >
                                    {board}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Class (Multi-select) */}
                        <div className="dropdown-container">
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                            Class <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(select one or more)</span>
                          </label>
                          <div className="relative">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === 'class' ? null : 'class')}
                              className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white min-h-[44px]"
                              disabled={collegeData.classes.length === 0}
                            >
                              <span className={formData.class.length > 0 ? "text-gray-900 truncate" : "text-gray-400"}>
                                {formData.class.includes('Generic') 
                                  ? '🌐 Generic (All Classes)' 
                                  : formData.class.length > 0 
                                    ? formData.class.join(', ')
                                    : 'Select Classes'}
                              </span>
               <FontAwesomeIcon icon={faChevronDown} className="text-gray-500" />
                            </button>
                            {openDropdown === 'class' && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                {/* Generic option - always first */}
                                {(() => {
                                  const isGenericSelected = formData.class.includes('Generic');
                                  return (
                                    <button
                                      key="Generic"
                                      onClick={() => {
                                        handleInputChange('class', isGenericSelected ? [] : ['Generic']);
                                      }}
                                      className={`w-full px-3 py-2 text-left transition-colors font-semibold text-sm flex items-center space-x-2 border-b border-gray-200 ${
                                        isGenericSelected ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-100 text-gray-900'
                                      }`}
                                    >
                                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                        isGenericSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                                      }`}>
                                        {isGenericSelected && (
                                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </span>
                                      <span>Generic <span className="text-xs font-normal text-gray-500">(visible to all classes)</span></span>
                                    </button>
                                  );
                                })()}
                                {/* Individual class options */}
                                {collegeData.classes.map((cls) => {
                                  const isGenericSelected = formData.class.includes('Generic');
                                  const isSelected = formData.class.includes(cls);
                                  return (
                                    <button
                                      key={cls}
                                      onClick={() => {
                                        if (isGenericSelected) {
                                          // Switching from Generic to individual selection
                                          handleInputChange('class', [cls]);
                                        } else {
                                          const updated = isSelected
                                            ? formData.class.filter(c => c !== cls)
                                            : [...formData.class, cls];
                                          handleInputChange('class', updated);
                                        }
                                      }}
                                      className={`w-full px-3 py-2 text-left transition-colors font-medium text-sm flex items-center space-x-2 ${
                                        isGenericSelected ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-900'
                                      }`}
                                    >
                                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                        isSelected && !isGenericSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                      }`}>
                                        {isSelected && !isGenericSelected && (
                                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </span>
                                      <span>{cls}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Subject */}
                        <div className="dropdown-container">
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                            Subject <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === 'subject' ? null : 'subject')}
                              className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white"
                              disabled={collegeData.subjects.length === 0}
                            >
                              <span className="text-gray-900">{formData.subject || 'Select Subject'}</span>
               <FontAwesomeIcon icon={faChevronDown} className="text-gray-500" />
                            </button>
                            {openDropdown === 'subject' && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                {collegeData.subjects.map((subject) => {
                                  return (
                                    <button
                                      key={subject}
                                      onClick={() => {
                                        handleInputChange('subject', subject);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                    >
                                      {subject}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Chapter - Full Width */}
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                          Chapter <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.chapter}
                          onChange={(e) => handleInputChange('chapter', e.target.value)}
                          placeholder="e.g., Quadratic Equations, Photosynthesis, etc."
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                        />
                      </div>
                    </div>

                    {/* Question Type - Interactive Cards */}
                    <div className="border rounded-xl p-4"
                      style={{ 
                        background: brandTheme.gradients.card,
                        borderColor: brandTheme.colors.secondary + '33'
                      }}>
                      <div className="flex items-center space-x-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                          <FontAwesomeIcon icon={faBookOpen} style={{ color: brandTheme.colors.secondary }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Question Type</h3>
                          <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Choose the question format</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-6 gap-3">
                        {questionTypes.map(type => {
                          const isSqlDisabled = type.value === QUESTION_TYPES.SQL && formData.subject !== 'Database';
                          return (
                          <button
                            key={type.value}
                            onClick={() => {
                              if (isSqlDisabled) return;
                              handleInputChange('type', type.value);
                              if (type.value === QUESTION_TYPES.MCQ || type.value === QUESTION_TYPES.JUMBLED) {
                                setFormData(prev => ({ ...prev, options: ['', '', '', ''], correct_answers: [], correct_sequence: [] }));
                              } else {
                                setFormData(prev => ({ ...prev, options: [''], correct_answers: [], correct_sequence: [] }));
                              }
                              if (type.value === QUESTION_TYPES.SQL) {
                                setFormData(prev => ({
                                  ...prev,
                                  starter_codes: [{ language: 'sql', code: '' }],
                                  sql_schema: (prev.sql_schema && prev.sql_schema.length > 0) ? prev.sql_schema : [{
                                    table_name: '',
                                    columns: [{ name: '', type: 'int', description: '', constraints: '' }],
                                    primary_key: '',
                                    note: ''
                                  }],
                                  sql_test_cases: (prev.sql_test_cases && prev.sql_test_cases.length > 0) ? prev.sql_test_cases : [{
                                    title: 'Test Case 1',
                                    table_data: {},
                                    expected_output: { columns: [''], rows: [['']] },
                                    marks: 0
                                  }]
                                }));
                              } else if (type.value === QUESTION_TYPES.CODE) {
                                setFormData(prev => ({ ...prev, starter_codes: [{ language: 'python', code: '' }] }));
                              }
                            }}
                            disabled={isSqlDisabled}
                            className={`relative p-4 rounded-xl border transition-all text-center overflow-hidden ${
                              isSqlDisabled
                                ? 'border-gray-200 opacity-40 cursor-not-allowed'
                                : formData.type === type.value
                                  ? 'border-transparent shadow-lg scale-105'
                                  : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                            }`}
                            style={!isSqlDisabled && formData.type === type.value ? {
                              backgroundImage: `linear-gradient(135deg, ${type.gradientColors})`
                            } : {}}
                            title={isSqlDisabled ? 'Select "Database" as subject to enable SQL' : ''}
                          >
                            <div className="text-3xl mb-2">
                              <FontAwesomeIcon icon={type.icon} className={formData.type === type.value && !isSqlDisabled ? 'text-white' : ''} />
                            </div>
                            <p className={`font-bold text-sm mb-1 ${
                              isSqlDisabled ? 'text-gray-400' : formData.type === type.value ? 'text-white' : 'text-gray-900'
                            }`}>
                              {type.label}
                            </p>
                            <p className={`text-xs ${
                              isSqlDisabled ? 'text-gray-400' : formData.type === type.value ? 'text-white/90' : 'text-gray-600'
                            }`}>
                              {isSqlDisabled ? 'Requires "Database" subject' : type.description}
                            </p>
                            {formData.type === type.value && !isSqlDisabled && (
                              <div className="absolute top-2 right-2">
                                <FontAwesomeIcon icon={faCircleCheck} className="text-white" />
                              </div>
                            )}
                          </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Question Text / Problem Statement */}
                    <div className="border rounded-xl p-4"
                      style={{ 
                        background: brandTheme.gradients.card,
                        borderColor: brandTheme.colors.secondary + '33'
                      }}>
                      <div className="flex items-center space-x-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                          <FontAwesomeIcon icon={faFileText} style={{ color: brandTheme.colors.secondary }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            {(formData.type === QUESTION_TYPES.CODE || formData.type === QUESTION_TYPES.SQL) ? 'Problem Statement' : 'Question Text'} <span className="text-red-500">*</span>
                          </h3>
                          <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>
                            {(formData.type === QUESTION_TYPES.CODE || formData.type === QUESTION_TYPES.SQL) ? 'Describe the SQL problem' : 'Write your question'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="border border-gray-300 rounded-lg overflow-hidden">
                        <RichTextEditor
                          value={formData.question_text}
                          onChange={(value) => handleInputChange('question_text', value)}
                          darkMode={false}
                          placeholder={(formData.type === QUESTION_TYPES.CODE || formData.type === QUESTION_TYPES.SQL) ? 'Describe the problem statement...' : 'Enter your question here...'}
                          minHeight="300px"
                        />
                      </div>
                    </div>

                    {/* Image Upload Section */}
                    <div className="border rounded-xl p-4"
                      style={{ 
                        background: brandTheme.gradients.card,
                        borderColor: brandTheme.colors.secondary + '33'
                      }}>
                      <div className="flex items-center space-x-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                          <FontAwesomeIcon icon={faImage} style={{ color: brandTheme.colors.secondary }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900">Question Images</h3>
                          <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Add images to your question (optional, max 5)</p>
                        </div>
                        <input
                          ref={questionImageInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => questionImageInputRef.current?.click()}
                          disabled={isUploadingImage || formData.question_image_urls.length >= 5}
                          className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ 
                            background: formData.question_image_urls.length >= 5 ? '#9ca3af' : brandTheme.gradients.primary 
                          }}
                          title={formData.question_image_urls.length >= 5 ? 'Maximum 5 images allowed' : 'Add images (max 5, 10MB each)'}
                        >
                          <FontAwesomeIcon icon={faImage} className="text-sm" />
                          {isUploadingImage ? (
                            <span>Uploading...</span>
                          ) : (
                            <span>Add Images ({formData.question_image_urls.length}/5)</span>
                          )}
                        </button>
                      </div>

                      {/* Image Preview Grid */}
                      {formData.question_image_urls.length > 0 && (
                        <div className="grid grid-cols-5 gap-3 mt-3">
                          {formData.question_image_urls.map((imageUrl, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={`Question image ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                              />
                              <button
                                onClick={() => removeQuestionImage(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                                title="Remove image"
                              >
                                <FontAwesomeIcon icon={faXmark} className="text-xs" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* MCQ Options - Long Text Support */}
                    {formData.type === QUESTION_TYPES.MCQ && (
                      <div className="border rounded-xl p-4"
                        style={{ 
                          background: brandTheme.gradients.card,
                          borderColor: brandTheme.colors.secondary + '33'
                        }}>
                        <div className="flex items-center space-x-2.5 mb-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                            <FontAwesomeIcon icon={faListCheck} style={{ color: brandTheme.colors.secondary }} />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">Options</h3>
                            <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Add answer options</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {formData.options.map((option, index) => (
                            <div key={index} className="flex items-start space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.correct_answers.includes(option)}
                                onChange={() => toggleCorrectAnswer(index)}
                                disabled={!option.trim()}
                                className="mt-3.5 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                              />
                              <div className="flex-1">
                                <textarea
                                  value={option}
                                  onChange={(e) => handleOptionChange(index, e.target.value)}
                                  placeholder={`Option ${index + 1}`}
                                  rows={1}
                                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-y text-sm font-medium hover:border-gray-400 bg-white"
                                  style={{ minHeight: '48px', maxHeight: '300px' }}
                                />
                              </div>
                              {formData.options.length > 2 && (
                                <button
                                  onClick={() => removeOption(index)}
                                  className="mt-2 w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all"
                                >
                                  <FontAwesomeIcon icon={faTrash} className="text-sm" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={addOption}
                            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                            style={{ 
                              color: brandTheme.colors.primary,
                              backgroundColor: `${brandTheme.colors.primary}10`
                            }}
                          >
                            <FontAwesomeIcon icon={faPlus} className="text-sm" />
                            <span>Add Option</span>
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-3">💡 Check the boxes to mark correct answers (can select multiple)</p>
                      </div>
                    )}

                    {/* Jumbled Quiz Options */}
                    {formData.type === QUESTION_TYPES.JUMBLED && (
                      <div className="border rounded-xl p-4"
                        style={{ 
                          background: brandTheme.gradients.card,
                          borderColor: brandTheme.colors.secondary + '33'
                        }}>
                        <div className="flex items-center space-x-2.5 mb-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                            <FontAwesomeIcon icon={faGripVertical} style={{ color: brandTheme.colors.secondary }} />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">Items to Arrange</h3>
                            <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Drag to set correct order</p>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 mb-3">💡 Drag and drop to set the correct order. Students will see them jumbled.</p>
                        <div className="space-y-2">
                          {formData.options.map((option, index) => (
                            <div
                              key={index}
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center space-x-2 p-3 bg-white border rounded-lg cursor-move transition-all ${
                                draggedIndex === index ? 'opacity-50 border-blue-400' : 'border-gray-300 hover:border-gray-400'
                              }`}
                            >
               <FontAwesomeIcon icon={faGripVertical} className="text-gray-400" />
                              <span className="text-sm font-medium text-gray-700 w-8">#{index + 1}</span>
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(index, e.target.value)}
                                placeholder={`Item ${index + 1}`}
                                className="flex-1 px-3 py-2 border-0 focus:ring-0 text-sm font-medium"
                              />
                              {formData.options.length > 2 && (
                                <button
                                  onClick={() => removeOption(index)}
                                  className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all"
                                >
                                  <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={addOption}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                          >
                            <FontAwesomeIcon icon={faPlus} className="text-sm" />
                            <span>Add Item</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Fill in the Blank Answers */}
                    {formData.type === QUESTION_TYPES.FITB && (
                      <div className="border rounded-xl p-4"
                        style={{ 
                          background: brandTheme.gradients.card,
                          borderColor: brandTheme.colors.secondary + '33'
                        }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                              <FontAwesomeIcon icon={faCircleCheck} style={{ color: brandTheme.colors.secondary }} />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Fill in the Blanks</h3>
                              <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Add blanks and acceptable answers for each</p>
                            </div>
                          </div>
                        </div>

                        {/* Render each blank */}
                        <div className="space-y-4">
                          {formData.blanks.map((blankAnswers, blankIndex) => (
                            <div key={blankIndex} className="border border-gray-200 rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-base font-semibold text-gray-700">Blank {blankIndex + 1}</h4>
                                {formData.blanks.length > 1 && (
                                  <button
                                    onClick={() => {
                                      const newBlanks = formData.blanks.filter((_, i) => i !== blankIndex);
                                      setFormData(prev => ({ ...prev, blanks: newBlanks }));
                                    }}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                  >
                                    Remove Blank
                                  </button>
                                )}
                              </div>
                              
                              {/* Answers for this blank */}
                              <div className="space-y-2">
                                {blankAnswers.map((answer, answerIndex) => (
                                  <div key={answerIndex} className="flex items-center space-x-2">
                                    <input
                                      type="text"
                                      value={answer}
                                      onChange={(e) => {
                                        const newBlanks = [...formData.blanks];
                                        newBlanks[blankIndex][answerIndex] = e.target.value;
                                        setFormData(prev => ({ ...prev, blanks: newBlanks }));
                                      }}
                                      placeholder={`Answer ${answerIndex + 1}`}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                                    />
                                    {blankAnswers.length > 1 && (
                                      <button
                                        onClick={() => {
                                          const newBlanks = [...formData.blanks];
                                          newBlanks[blankIndex] = newBlanks[blankIndex].filter((_, i) => i !== answerIndex);
                                          setFormData(prev => ({ ...prev, blanks: newBlanks }));
                                        }}
                                        className="w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all"
                                      >
                                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                
                                {/* Add answer button for this blank */}
                                <button
                                  onClick={() => {
                                    const newBlanks = [...formData.blanks];
                                    newBlanks[blankIndex].push('');
                                    setFormData(prev => ({ ...prev, blanks: newBlanks }));
                                  }}
                                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                                  style={{ 
                                    color: brandTheme.colors.primary,
                                    backgroundColor: `${brandTheme.colors.primary}10`
                                  }}
                                >
                                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                                  <span>Add Acceptable Answer</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add new blank button */}
                        <button
                          onClick={() => {
                            setFormData(prev => ({ ...prev, blanks: [...prev.blanks, ['']] }));
                          }}
                          className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-dashed"
                          style={{ 
                            color: brandTheme.colors.primary,
                            borderColor: brandTheme.colors.primary,
                            backgroundColor: `${brandTheme.colors.primary}05`
                          }}
                        >
                          <FontAwesomeIcon icon={faPlus} className="text-sm" />
                          <span>Add Another Blank</span>
                        </button>
                        
                        <p className="text-xs text-gray-600 mt-3">💡 Add multiple blanks for questions like "The capital of ___₁ is ___₂"</p>
                      </div>
                    )}

                    {/* Code Question Specific Fields */}
                    {/* CODE Question Type UI */}
                    {formData.type === QUESTION_TYPES.CODE && (
                      <>
                        {/* Starter Codes */}
                        <div className="border rounded-xl p-4" style={{ background: brandTheme.gradients.card, borderColor: brandTheme.colors.secondary + '33' }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                                <FontAwesomeIcon icon={faFileText} style={{ color: brandTheme.colors.secondary }} />
                              </div>
                              <div>
                                <h3 className="text-base font-semibold text-gray-900">Starter Code <span className="text-red-500">*</span></h3>
                                <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Pre-filled code template for students</p>
                              </div>
                            </div>
                            <button type="button" onClick={() => setShowStarterCodeHelp(!showStarterCodeHelp)} className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors" title="Show examples"><FontAwesomeIcon icon={faCircleQuestion} className="text-xs" /></button>
                          </div>

                          {showStarterCodeHelp && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-2">
                              <p className="font-semibold text-blue-900">{String.fromCodePoint(0x1F4A1)} Starter Code Examples:</p>
                              <div className="space-y-3">
                                <div><p className="font-medium text-blue-800 mb-1">Python:</p><pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto">{`def solution(n):\n    # Write your code here\n    pass`}</pre></div>
                                <div><p className="font-medium text-blue-800 mb-1">Java:</p><pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto">{`class Solution {\n    public int solution(int n) {\n        // Write your code here\n        return 0;\n    }\n}`}</pre></div>
                                <div><p className="font-medium text-blue-800 mb-1">C++:</p><pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto">{`int solution(int n) {\n    // Write your code here\n    return 0;\n}`}</pre></div>
                              </div>
                              <p className="text-blue-700 italic mt-2">Students will start with this code and modify it to solve the problem.</p>
                            </div>
                          )}

                          <div className="space-y-4">
                            {(formData.starter_codes || [{ language: 'python', code: '' }]).map((sc, scIndex) => {
                              const allLanguages = [{ value: 'c', label: 'C' },{ value: 'cpp', label: 'C++' },{ value: 'python', label: 'Python' },{ value: 'java', label: 'Java' },{ value: 'javascript', label: 'JavaScript' },{ value: 'csharp', label: 'C#' },{ value: 'go', label: 'Go' },{ value: 'scala', label: 'Scala' },{ value: 'typescript', label: 'TypeScript' },{ value: 'bash', label: 'Bash/Shell' },{ value: 'kotlin', label: 'Kotlin' },{ value: 'lua', label: 'Lua' },{ value: 'assembly', label: 'Assembly' },{ value: 'dart', label: 'Dart' },{ value: 'swift', label: 'Swift' },{ value: 'r', label: 'R' },{ value: 'groovy', label: 'Groovy' },{ value: 'perl', label: 'Perl' },{ value: 'php', label: 'PHP' },{ value: 'rust', label: 'Rust' }];
                              const usedLanguages = (formData.starter_codes || []).filter((_, i) => i !== scIndex).map(s => s.language);
                              const availableLanguages = allLanguages.filter(l => !usedLanguages.includes(l.value));
                              return (
                                <div key={scIndex} className="border border-gray-200 rounded-lg p-3 bg-white">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2 flex-1">
                                      <span className="text-xs font-semibold text-gray-500">#{scIndex + 1}</span>
                                      <select value={sc.language} onChange={(e) => { const updated = [...(formData.starter_codes || [])]; updated[scIndex] = { ...updated[scIndex], language: e.target.value }; handleInputChange('starter_codes', updated); }} className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:border-transparent hover:border-gray-400 bg-white" style={{ minWidth: '130px' }}>
                                        {availableLanguages.map(lang => (<option key={lang.value} value={lang.value}>{lang.label}</option>))}
                                      </select>
                                    </div>
                                    {(formData.starter_codes || []).length > 1 && (<button type="button" onClick={() => { const updated = (formData.starter_codes || []).filter((_, i) => i !== scIndex); handleInputChange('starter_codes', updated); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove this starter code"><FontAwesomeIcon icon={faTrash} className="text-xs" /></button>)}
                                  </div>
                                  <textarea value={sc.code} onChange={(e) => { const updated = [...(formData.starter_codes || [])]; updated[scIndex] = { ...updated[scIndex], code: e.target.value }; setFormData(prev => ({ ...prev, starter_codes: updated, ...(scIndex === 0 ? { test_stub: e.target.value } : {}) })); }} placeholder={`// Write starter code for ${sc.language === 'python' ? 'Python' : sc.language === 'cpp' ? 'C++' : sc.language === 'csharp' ? 'C#' : sc.language === 'javascript' ? 'JavaScript' : sc.language === 'typescript' ? 'TypeScript' : sc.language === 'bash' ? 'Bash/Shell' : sc.language.charAt(0).toUpperCase() + sc.language.slice(1)}...`} rows={5} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-y text-sm font-mono" style={{ minHeight: '48px', maxHeight: '300px' }} />
                                </div>
                              );
                            })}
                          </div>
                          {(() => { const allLangCount = 20; const currentCount = (formData.starter_codes || []).length; if (currentCount >= allLangCount) return null; return (<button type="button" onClick={() => { const allLangs = ['c','cpp','python','java','javascript','csharp','go','scala','typescript','bash','kotlin','lua','assembly','dart','swift','r','groovy','perl','php','rust']; const usedLangs = (formData.starter_codes || []).map(s => s.language); const nextLang = allLangs.find(l => !usedLangs.includes(l)) || 'c'; handleInputChange('starter_codes', [...(formData.starter_codes || []), { language: nextLang, code: '' }]); }} className="mt-3 flex items-center space-x-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 text-xs font-semibold transition-colors w-full justify-center"><FontAwesomeIcon icon={faPlus} className="text-xs" /><span>Add Another Language</span></button>); })()}
                        </div>

                        {/* Code Test Cases */}
                        <div className="border rounded-xl p-4" style={{ background: brandTheme.gradients.card, borderColor: brandTheme.colors.secondary + '33' }}>
                          <div className="flex items-center space-x-2.5 mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandTheme.colors.secondary + '20' }}><FontAwesomeIcon icon={faListCheck} style={{ color: brandTheme.colors.secondary }} /></div>
                            <div><h3 className="text-base font-semibold text-gray-900">Test Cases <span className="text-red-500">*</span></h3><p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Input and expected output pairs</p></div>
                          </div>
                          <div className="space-y-3">
                            {(formData.test_cases || []).map((testCase, index) => (
                              <div key={index} className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1 space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <input type="text" value={testCase.input} onChange={(e) => { const n = [...(formData.test_cases || [])]; n[index].input = e.target.value; handleInputChange('test_cases', n); }} placeholder="Input (e.g., 5)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                                    <input type="text" value={testCase.expected_output} onChange={(e) => { const n = [...(formData.test_cases || [])]; n[index].expected_output = e.target.value; handleInputChange('test_cases', n); }} placeholder="Expected Output (e.g., 120)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                                  </div>
                                  <input type="number" value={testCase.marks || 0} onChange={(e) => { const n = [...(formData.test_cases || [])]; n[index].marks = parseFloat(e.target.value) || 0; handleInputChange('test_cases', n); }} placeholder="Marks" step="0.1" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                {(formData.test_cases || []).length > 1 && (<button onClick={() => { handleInputChange('test_cases', (formData.test_cases || []).filter((_, i) => i !== index)); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all mt-7"><FontAwesomeIcon icon={faTrash} className="text-sm" /></button>)}
                              </div>
                            ))}
                            <button onClick={() => { handleInputChange('test_cases', [...(formData.test_cases || []), { input: '', expected_output: '', marks: 0 }]); }} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ color: brandTheme.colors.primary, backgroundColor: `${brandTheme.colors.primary}10` }}><FontAwesomeIcon icon={faPlus} className="text-sm" /><span>Add Test Case</span></button>
                          </div>
                          {(() => { const totalTcMarks = (formData.test_cases || []).reduce((sum, tc) => sum + (tc.marks || 0), 0); const roundedTotal = Math.round(totalTcMarks * 100) / 100; const isMatch = roundedTotal === formData.maximum_marks; const isOver = roundedTotal > formData.maximum_marks; return (<div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${isMatch ? 'bg-green-50 border border-green-200 text-green-700' : isOver ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}><span>{isMatch ? '✅' : isOver ? '⚠️' : '💡'} Test case marks total: <strong>{roundedTotal}</strong> / <strong>{formData.maximum_marks}</strong> (max marks)</span>{isMatch ? (<span className="text-green-600 font-semibold">Matched ✓</span>) : (<span className={isOver ? 'text-red-600' : 'text-amber-600'}>{isOver ? `Over by ${Math.round((roundedTotal - formData.maximum_marks) * 100) / 100}` : `Remaining: ${Math.round((formData.maximum_marks - roundedTotal) * 100) / 100}`}</span>)}</div>); })()}
                        </div>
                      </>
                    )}

                    {/* SQL Question Type UI */}
                    {formData.type === QUESTION_TYPES.SQL && (
                      <>
                        {/* TABLE SCHEMA */}
                        <div className="border rounded-xl p-4" style={{ background: brandTheme.gradients.card, borderColor: '#05966333' }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#05966920' }}><span className="text-lg">{String.fromCodePoint(0x1F5C4)}{String.fromCodePoint(0xFE0F)}</span></div>
                              <div><h3 className="text-base font-semibold text-gray-900"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold mr-1.5">1</span>Table Schema <span className="text-red-500">*</span></h3><p className="text-xs text-gray-500 ml-7">Define your database tables first — columns, types, and constraints</p></div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            {(formData.sql_schema || []).map((table, tIdx) => (
                              <div key={tIdx} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-100">
                                  <div className="flex items-center space-x-2 flex-1">
                                    <span className="text-green-600 font-bold text-xs">TABLE {tIdx + 1}</span>
                                    <input type="text" value={table.table_name} onChange={(e) => { const u = [...(formData.sql_schema || [])]; u[tIdx] = { ...u[tIdx], table_name: e.target.value }; handleInputChange('sql_schema', u); }} placeholder="Table name (e.g., Employee)" className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-semibold focus:ring-2 focus:border-transparent" />
                                  </div>
                                  {(formData.sql_schema || []).length > 1 && (<button type="button" onClick={() => { handleInputChange('sql_schema', (formData.sql_schema || []).filter((_, i) => i !== tIdx)); }} className="ml-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FontAwesomeIcon icon={faTrash} className="text-xs" /></button>)}
                                </div>
                                <div className="p-3 space-y-2">
                                  <div className="grid grid-cols-[1fr_0.7fr_1fr_0.8fr_auto] gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1"><span>Column Name</span><span>Type</span><span>Description</span><span>Constraints</span><span className="w-7"></span></div>
                                  {table.columns.map((col, cIdx) => (
                                    <div key={cIdx} className="grid grid-cols-[1fr_0.7fr_1fr_0.8fr_auto] gap-2 items-center">
                                      <input type="text" value={col.name} onChange={(e) => { const u = [...(formData.sql_schema || [])]; const c = [...u[tIdx].columns]; c[cIdx] = { ...c[cIdx], name: e.target.value }; u[tIdx] = { ...u[tIdx], columns: c }; handleInputChange('sql_schema', u); }} placeholder="e.g., id" className="px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:ring-1" />
                                      <select value={col.type} onChange={(e) => { const u = [...(formData.sql_schema || [])]; const c = [...u[tIdx].columns]; c[cIdx] = { ...c[cIdx], type: e.target.value }; u[tIdx] = { ...u[tIdx], columns: c }; handleInputChange('sql_schema', u); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 bg-white">
                                        {['int','bigint','float','double','decimal','varchar','char','text','date','datetime','timestamp','boolean','blob'].map(t => (<option key={t} value={t}>{t.toUpperCase()}</option>))}
                                      </select>
                                      <input type="text" value={col.description} onChange={(e) => { const u = [...(formData.sql_schema || [])]; const c = [...u[tIdx].columns]; c[cIdx] = { ...c[cIdx], description: e.target.value }; u[tIdx] = { ...u[tIdx], columns: c }; handleInputChange('sql_schema', u); }} placeholder="Description" className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1" />
                                      <input type="text" value={col.constraints} onChange={(e) => { const u = [...(formData.sql_schema || [])]; const c = [...u[tIdx].columns]; c[cIdx] = { ...c[cIdx], constraints: e.target.value }; u[tIdx] = { ...u[tIdx], columns: c }; handleInputChange('sql_schema', u); }} placeholder="PK, NOT NULL..." className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1" />
                                      {table.columns.length > 1 && (<button type="button" onClick={() => { const u = [...(formData.sql_schema || [])]; u[tIdx] = { ...u[tIdx], columns: u[tIdx].columns.filter((_, i) => i !== cIdx) }; handleInputChange('sql_schema', u); }} className="w-7 h-7 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex items-center justify-center"><FontAwesomeIcon icon={faXmark} className="text-xs" /></button>)}
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => { const u = [...(formData.sql_schema || [])]; u[tIdx] = { ...u[tIdx], columns: [...u[tIdx].columns, { name: '', type: 'int', description: '', constraints: '' }] }; handleInputChange('sql_schema', u); }} className="flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded transition-colors" style={{ color: brandTheme.colors.primary }}><FontAwesomeIcon icon={faPlus} className="text-xs" /><span>Add Column</span></button>
                                </div>
                                <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                                  <div><label className="text-[10px] font-bold text-gray-500 uppercase">Primary Key</label><input type="text" value={table.primary_key} onChange={(e) => { const u = [...(formData.sql_schema || [])]; u[tIdx] = { ...u[tIdx], primary_key: e.target.value }; handleInputChange('sql_schema', u); }} placeholder="e.g., id" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1" /></div>
                                  <div><label className="text-[10px] font-bold text-gray-500 uppercase">Note (optional)</label><input type="text" value={table.note} onChange={(e) => { const u = [...(formData.sql_schema || [])]; u[tIdx] = { ...u[tIdx], note: e.target.value }; handleInputChange('sql_schema', u); }} placeholder="e.g., Each row = one employee" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1" /></div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => { handleInputChange('sql_schema', [...(formData.sql_schema || []), { table_name: '', columns: [{ name: '', type: 'int', description: '', constraints: '' }], primary_key: '', note: '' }]); }} className="mt-3 flex items-center space-x-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 text-xs font-semibold transition-colors w-full justify-center"><FontAwesomeIcon icon={faPlus} className="text-xs" /><span>Add Another Table</span></button>
                        </div>

                        {/* SQL TEST CASES */}
                        <div className="border rounded-xl p-4" style={{ background: brandTheme.gradients.card, borderColor: '#d9770633' }}>
                          <div className="flex items-center space-x-2.5 mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#d9770620' }}><FontAwesomeIcon icon={faListCheck} style={{ color: '#d97706' }} /></div>
                            <div><h3 className="text-base font-semibold text-gray-900"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold mr-1.5">2</span>Test Cases <span className="text-red-500">*</span></h3><p className="text-xs text-gray-500 ml-7">Input data auto-populates from your schema — just fill in values</p></div>
                          </div>
                          {(() => {
                            const hasValidSchema = (formData.sql_schema || []).some(t => t.table_name.trim() && t.columns.some(c => c.name.trim()));
                            if (!hasValidSchema) {
                              return (
                                <div className="flex flex-col items-center justify-center py-8 px-4">
                                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><span className="text-2xl opacity-40">🔒</span></div>
                                  <p className="text-sm font-semibold text-gray-400 mb-1">Schema Required</p>
                                  <p className="text-xs text-gray-400 text-center max-w-xs">Define at least one table with a name and columns in <strong>Step 1</strong> above. Test cases will unlock automatically.</p>
                                </div>
                              );
                            }
                            return (
                              <>
                          <div className="space-y-4">
                            {(formData.sql_test_cases || []).map((tc, tcIdx) => {
                              const schemaTableNames = (formData.sql_schema || []).map(t => t.table_name).filter(n => n.trim());
                              return (
                                <div key={tcIdx} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-100">
                                    <div className="flex items-center space-x-2 flex-1">
                                      <span className="text-amber-600 font-bold text-xs">TEST {tcIdx + 1}</span>
                                      <input type="text" value={tc.title} onChange={(e) => { const u = [...(formData.sql_test_cases || [])]; u[tcIdx] = { ...u[tcIdx], title: e.target.value }; handleInputChange('sql_test_cases', u); }} placeholder="Test case title" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:ring-1" />
                                      <div className="flex items-center space-x-1"><span className="text-[10px] text-gray-500 font-bold">MARKS:</span><input type="number" value={tc.marks || 0} onChange={(e) => { const u = [...(formData.sql_test_cases || [])]; u[tcIdx] = { ...u[tcIdx], marks: parseFloat(e.target.value) || 0 }; handleInputChange('sql_test_cases', u); }} step="0.1" min="0" className="w-16 px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:ring-1" /></div>
                                    </div>
                                    {(formData.sql_test_cases || []).length > 1 && (<button type="button" onClick={() => { handleInputChange('sql_test_cases', (formData.sql_test_cases || []).filter((_, i) => i !== tcIdx)); }} className="ml-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FontAwesomeIcon icon={faTrash} className="text-xs" /></button>)}
                                  </div>
                                  <div className="p-3 space-y-3">
                                    {schemaTableNames.length > 0 ? schemaTableNames.map((tableName) => {
                                      const schemaTable = (formData.sql_schema || []).find(t => t.table_name === tableName);
                                      const colNames = schemaTable ? schemaTable.columns.map(c => c.name).filter(n => n.trim()) : [];
                                      const tableRows = tc.table_data[tableName] || [];
                                      return (
                                        <div key={tableName} className="border border-blue-100 rounded-lg overflow-hidden">
                                          <div className="px-3 py-1.5 bg-blue-50 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-blue-700">{String.fromCodePoint(0x1F4E5)} Input: <span className="font-mono">{tableName}</span></span>
                                            <button type="button" onClick={() => { const u = [...(formData.sql_test_cases || [])]; const newRow = colNames.map(() => ''); const existing = u[tcIdx].table_data[tableName] || []; u[tcIdx] = { ...u[tcIdx], table_data: { ...u[tcIdx].table_data, [tableName]: [...existing, newRow] } }; handleInputChange('sql_test_cases', u); }} className="text-[10px] font-medium text-blue-600 hover:text-blue-800">+ Add Row</button>
                                          </div>
                                          {colNames.length > 0 ? (
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-xs">
                                                <thead><tr className="bg-gray-50">{colNames.map((cn, ci) => (<th key={ci} className="px-2 py-1.5 text-left font-semibold text-gray-600 border-b">{cn}</th>))}<th className="w-7 border-b"></th></tr></thead>
                                                <tbody>{tableRows.map((row, rIdx) => (<tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>{colNames.map((_, ci) => (<td key={ci} className="px-1 py-1 border-b border-gray-100"><input type="text" value={row[ci] || ''} onChange={(e) => { const u = [...(formData.sql_test_cases || [])]; const rows = [...(u[tcIdx].table_data[tableName] || [])]; const nr = [...(rows[rIdx] || [])]; nr[ci] = e.target.value; rows[rIdx] = nr; u[tcIdx] = { ...u[tcIdx], table_data: { ...u[tcIdx].table_data, [tableName]: rows } }; handleInputChange('sql_test_cases', u); }} className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs font-mono focus:ring-1" /></td>))}<td className="px-1 py-1 border-b border-gray-100"><button type="button" onClick={() => { const u = [...(formData.sql_test_cases || [])]; u[tcIdx] = { ...u[tcIdx], table_data: { ...u[tcIdx].table_data, [tableName]: (u[tcIdx].table_data[tableName] || []).filter((_, i) => i !== rIdx) } }; handleInputChange('sql_test_cases', u); }} className="text-red-400 hover:text-red-600"><FontAwesomeIcon icon={faXmark} className="text-xs" /></button></td></tr>))}</tbody>
                                              </table>
                                              {tableRows.length === 0 && (<p className="text-[10px] text-blue-400 text-center py-2">No rows yet — click <strong>"+ Add Row"</strong> above to add sample data.</p>)}
                                            </div>
                                          ) : (<p className="text-[10px] text-amber-500 text-center py-2">⬆ Name your columns in the schema above — they'll appear as headers here.</p>)}
                                        </div>
                                      );
                                    }) : (<div className="flex items-center space-x-2 px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg"><span className="text-amber-500 text-base">☝️</span><div><p className="text-xs font-medium text-amber-700">Complete Step 1 first</p><p className="text-[10px] text-amber-600">Define a table name and columns in the schema above — input fields will appear here automatically.</p></div></div>)}
                                                                        {(() => {
                                      const totalInputCols = (formData.sql_schema || []).reduce((sum, t) => sum + t.columns.filter(c => c.name.trim()).length, 0);
                                      const maxOutputCols = Math.max(totalInputCols, 1);
                                      const currentOutputCols = tc.expected_output.columns.length;
                                      return (
                                    <div className="border border-green-100 rounded-lg overflow-hidden">
                                      <div className="px-3 py-1.5 bg-green-50 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-green-700">{String.fromCodePoint(0x1F4E4)} Expected Output <span className="text-[9px] font-normal text-green-500">({currentOutputCols}/{maxOutputCols} cols)</span></span>
                                        <div className="flex items-center space-x-2">
                                          <button type="button" disabled={currentOutputCols >= maxOutputCols} onClick={() => { const u = [...(formData.sql_test_cases || [])]; const eo = u[tcIdx].expected_output; u[tcIdx] = { ...u[tcIdx], expected_output: { columns: [...eo.columns, ''], rows: eo.rows.map(r => [...r, '']) } }; handleInputChange('sql_test_cases', u); }} className={`text-[10px] font-medium ${currentOutputCols >= maxOutputCols ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:text-green-800'}`}>+ Column</button>
                                          <button type="button" onClick={() => { const u = [...(formData.sql_test_cases || [])]; const eo = u[tcIdx].expected_output; u[tcIdx] = { ...u[tcIdx], expected_output: { ...eo, rows: [...eo.rows, eo.columns.map(() => '')] } }; handleInputChange('sql_test_cases', u); }} className="text-[10px] font-medium text-green-600 hover:text-green-800">+ Row</button>
                                        </div>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                          <thead><tr className="bg-green-50/50">{tc.expected_output.columns.map((col, ci) => { const allSchemaCols = (formData.sql_schema || []).flatMap(t => t.columns.map(c => c.name).filter(n => n.trim())); const usedCols = tc.expected_output.columns.filter((_, i) => i !== ci); const availableCols = allSchemaCols.filter(c => !usedCols.includes(c)); return (<th key={ci} className="px-1 py-1.5 border-b"><div className="flex items-center space-x-1"><select value={col} onChange={(e) => { const u = [...(formData.sql_test_cases || [])]; const cols = [...u[tcIdx].expected_output.columns]; cols[ci] = e.target.value; u[tcIdx] = { ...u[tcIdx], expected_output: { ...u[tcIdx].expected_output, columns: cols } }; handleInputChange('sql_test_cases', u); }} className="w-full px-1.5 py-1 border border-green-200 rounded text-xs font-semibold focus:ring-1 bg-white">{!col && <option value="">Select column</option>}{availableCols.map(c => (<option key={c} value={c}>{c}</option>))}{col && !availableCols.includes(col) && <option value={col}>{col}</option>}</select>{tc.expected_output.columns.length > 1 && (<button type="button" onClick={() => { const u = [...(formData.sql_test_cases || [])]; const eo = u[tcIdx].expected_output; u[tcIdx] = { ...u[tcIdx], expected_output: { columns: eo.columns.filter((_, i) => i !== ci), rows: eo.rows.map(r => r.filter((_, i) => i !== ci)) } }; handleInputChange('sql_test_cases', u); }} className="text-red-400 hover:text-red-600 flex-shrink-0"><FontAwesomeIcon icon={faXmark} /></button>)}</div></th>); })}<th className="w-7 border-b"></th></tr></thead>
                                          <tbody>{tc.expected_output.rows.map((row, rIdx) => (<tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>{tc.expected_output.columns.map((_, ci) => (<td key={ci} className="px-1 py-1 border-b border-gray-100"><input type="text" value={row[ci] || ''} onChange={(e) => { const u = [...(formData.sql_test_cases || [])]; const rows = [...u[tcIdx].expected_output.rows]; const nr = [...rows[rIdx]]; nr[ci] = e.target.value; rows[rIdx] = nr; u[tcIdx] = { ...u[tcIdx], expected_output: { ...u[tcIdx].expected_output, rows } }; handleInputChange('sql_test_cases', u); }} className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs font-mono focus:ring-1" /></td>))}<td className="px-1 py-1 border-b border-gray-100">{tc.expected_output.rows.length > 1 && (<button type="button" onClick={() => { const u = [...(formData.sql_test_cases || [])]; u[tcIdx] = { ...u[tcIdx], expected_output: { ...u[tcIdx].expected_output, rows: u[tcIdx].expected_output.rows.filter((_, i) => i !== rIdx) } }; handleInputChange('sql_test_cases', u); }} className="text-red-400 hover:text-red-600"><FontAwesomeIcon icon={faXmark} className="text-xs" /></button>)}</td></tr>))}</tbody>
                                        </table>
                                      </div>
                                    </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <button type="button" onClick={() => { const c = (formData.sql_test_cases || []).length; handleInputChange('sql_test_cases', [...(formData.sql_test_cases || []), { title: `Test Case ${c + 1}`, table_data: {}, expected_output: { columns: [''], rows: [['']] }, marks: 0 }]); }} className="mt-3 flex items-center space-x-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 text-xs font-semibold transition-colors w-full justify-center"><FontAwesomeIcon icon={faPlus} className="text-xs" /><span>Add Test Case</span></button>
                          {(() => { const totalSqlMarks = (formData.sql_test_cases || []).reduce((sum, tc) => sum + (tc.marks || 0), 0); const roundedTotal = Math.round(totalSqlMarks * 100) / 100; const isMatch = roundedTotal === formData.maximum_marks; const isOver = roundedTotal > formData.maximum_marks; return (<div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${isMatch ? 'bg-green-50 border border-green-200 text-green-700' : isOver ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}><span>{isMatch ? '✅' : isOver ? '⚠️' : '💡'} Test case marks total: <strong>{roundedTotal}</strong> / <strong>{formData.maximum_marks}</strong> (max marks)</span>{isMatch ? (<span className="text-green-600 font-semibold">Matched ✓</span>) : (<span className={isOver ? 'text-red-600' : 'text-amber-600'}>{isOver ? `Over by ${Math.round((roundedTotal - formData.maximum_marks) * 100) / 100}` : `Remaining: ${Math.round((formData.maximum_marks - roundedTotal) * 100) / 100}`}</span>)}</div>); })()}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}


                    
                    <div className="space-y-3">
                      <h3 className="text-sm text-base font-semibold text-gray-900 uppercase tracking-wide">
                        Difficulty Level <span className="text-red-500">*</span>
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {difficultyLevels.map(level => {
                          const isSelected = formData.difficulty_level === level.value;
                          const colors = {
                            green: { bg: '#10b981', light: '#d1fae5', text: '#065f46' },
                            yellow: { bg: '#f59e0b', light: '#fef3c7', text: '#92400e' },
                            red: { bg: '#ef4444', light: '#fee2e2', text: '#991b1b' }
                          };
                          const color = colors[level.color as keyof typeof colors];
                          
                          return (
                            <button
                              key={level.value}
                              onClick={() => handleInputChange('difficulty_level', level.value)}
                              className={`relative p-4 rounded-xl border transition-all ${
                                isSelected ? 'border-transparent shadow-lg' : 'border-gray-200 hover:border-gray-300'
                              }`}
                              style={isSelected ? {
                                backgroundColor: color.bg,
                                color: 'white'
                              } : {
                                backgroundColor: color.light,
                                color: color.text
                              }}
                            >
                              <div className="text-2xl mb-1">{level.emoji}</div>
                              <p className="text-sm font-semibold">{level.label}</p>
                              {isSelected && (
                                <div className="absolute top-2 right-2">
                                  <FontAwesomeIcon icon={faCircleCheck} className="text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Additional Details & Help Students - Combined Box */}
                    <div className="border rounded-xl p-4"
                      style={{ 
                        background: brandTheme.gradients.card,
                        borderColor: brandTheme.colors.accent + '33'
                      }}>
                      <div className="flex items-center space-x-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: brandTheme.colors.accent + '20' }}>
                          <FontAwesomeIcon icon={faAward} style={{ color: brandTheme.colors.accent }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Additional Details & Help</h3>
                          <p className="text-xs" style={{ color: brandTheme.colors.accent, opacity: 0.9 }}>Marks, visibility & hints</p>
                        </div>
                      </div>

                      {/* Maximum Marks, Previous Year, and Visibility */}
                      <div className="grid grid-cols-[1fr_1.2fr_1.5fr] gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                            Maximum Marks <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={formData.maximum_marks}
                            onChange={(e) => handleInputChange('maximum_marks', parseInt(e.target.value) || 0)}
                            min="1"
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                            Previous Year <span className="text-gray-400 text-xs">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={formData.year}
                            onChange={(e) => handleInputChange('year', e.target.value)}
                            placeholder="e.g., 2025, 2026"
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                          />
                        </div>

                        <div className="dropdown-container">
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                            Visibility <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === 'visibility' ? null : 'visibility')}
                              className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white"
                            >
                              <span className="text-gray-900">
                                {formData.is_public ? '🌐 Public (All universities)' : '🏛️ Private (Your university only)'}
                              </span>
               <FontAwesomeIcon icon={faChevronDown} className="text-gray-500" />
                            </button>
                            {openDropdown === 'visibility' && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20">
                                <button
                                  onClick={() => {
                                    handleInputChange('is_public', false);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                >
                                  🏛️ Private (Your university only)
                                </button>
                                <button
                                  onClick={() => {
                                    handleInputChange('is_public', true);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                >
                                  🌐 Public (All universities)
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t-2 border-gray-200 my-4"></div>

                      {/* Tags Section */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4" style={{ color: brandTheme.colors.accent }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          <h4 className="text-base font-semibold text-gray-900 text-sm">Tags <span className="text-gray-400 text-xs">(Optional - for categorization)</span></h4>
                        </div>
                        
                        <div>
                          <div className="flex space-x-2 mb-2">
                            <input
                              type="text"
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && tagInput.trim()) {
                                  e.preventDefault();
                                  const newTag = tagInput.trim().toLowerCase();
                                  const currentTags = formData.tags || [];
                                  if (currentTags.length >= 4) return;
                                  if (!currentTags.includes(newTag)) {
                                    handleInputChange('tags', [...currentTags, newTag]);
                                  }
                                  setTagInput('');
                                }
                              }}
                              placeholder={(formData.tags || []).length >= 4 ? "Maximum 4 tags reached" : "Type tag and press Enter (e.g., 2026, Infosys Test, Brain Test)"}
                              disabled={(formData.tags || []).length >= 4}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newTag = tagInput.trim().toLowerCase();
                                const currentTags = formData.tags || [];
                                if (currentTags.length >= 4) return;
                                if (newTag && !currentTags.includes(newTag)) {
                                  handleInputChange('tags', [...currentTags, newTag]);
                                  setTagInput('');
                                }
                              }}
                              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium text-sm"
                            >
                              Add
                            </button>
                          </div>
                          
                          {formData.tags && formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {formData.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                                >
                                  {tag}
                                  <button
                                    onClick={() => {
                                      const currentTags = formData.tags || [];
                                      handleInputChange('tags', currentTags.filter((_, i) => i !== index));
                                    }}
                                    className="ml-1.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                                  >
                                    <FontAwesomeIcon icon={faXmark} className="text-xs" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Add tags to categorize and search questions easily, max 4 (e.g., "2026", "infosys-test", "brain-test", "placement-prep")
                          </p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t-2 border-gray-200 my-4"></div>

                      {/* Help Students - Hint */}
                      <div className="flex items-center space-x-2 mb-3">
                        <FontAwesomeIcon icon={faCircleQuestion} style={{ color: brandTheme.colors.accent }} />
                        <h4 className="text-base font-semibold text-gray-900 text-sm">Help Students <span className="text-gray-400 text-xs">(Optional)</span></h4>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">Hint</label>
                          <textarea
                            value={formData.hint}
                            onChange={(e) => handleInputChange('hint', e.target.value)}
                            placeholder="Provide a helpful hint..."
                            rows={2}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-y text-sm font-medium hover:border-gray-400 bg-white"
                            style={{ minHeight: '48px', maxHeight: '300px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isLoadingCollegeData}
                    className="px-5 py-2 text-white font-medium text-sm rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center space-x-2"
                    style={{ background: isSubmitting ? brandTheme.colors.primary : brandTheme.gradients.primary }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faFloppyDisk} className="text-sm" />
                        <span>Save Question</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Success View */}
        {view === 'success' && (
          <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all"
              style={{
                animation: 'slideIn 0.3s ease-out'
              }}
            >
              {/* Icon Header */}
              <div className="px-6 py-5 flex flex-col items-center text-center bg-gradient-to-br from-emerald-50 to-green-100">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg mb-4 bg-gradient-to-br from-emerald-500 to-green-600"
                  style={{
                    animation: 'bounceIn 0.5s ease-out'
                  }}
                >
   <FontAwesomeIcon icon={faCircleCheck} className="text-white" />
                </div>
                
                <h3 className="text-2xl font-bold mb-2 text-emerald-900">
                  Question Added!
                </h3>
                
                <p className="text-gray-700 text-sm leading-relaxed">
                  Successfully saved to question bank
                </p>
              </div>

              {/* Action Button */}
              <div className="px-6 py-4 bg-white flex justify-center">
                <button
                  onClick={() => {
                    setView('choice');
                    onQuestionAdded();
                  }}
                  className="px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 text-white min-w-[140px] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                >
                  Awesome!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}