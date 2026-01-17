import { useState, useEffect, useRef } from 'react';
import { X, Plus, Save, Trash2, CheckCircle, AlertCircle, Sparkles, Image as ImageIcon, GripVertical, ChevronDown, FileText, BookOpen, Award, ListChecks, HelpCircle } from 'lucide-react';
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
  class: string;
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
  solution: string;
  is_public: boolean; // true = public/common, false = private/proprietary
  tags: string[]; // Added: tags for categorization
  // Code question specific fields
  programming_language?: string;
  test_cases?: Array<{ input: string; expected_output: string; marks?: number }>;
  test_stub?: string;
}

interface CollegeData {
  boards: string[];
  subjects: string[];
  classes: string[];
}

const questionTypes = [
  { 
    value: QUESTION_TYPES.DESCRIPTIVE, 
    label: QUESTION_TYPE_LABELS[QUESTION_TYPES.DESCRIPTIVE], 
    icon: '📄', 
    gradient: 'from-green-500 to-teal-500',
    description: 'Long form answers'
  },
  { 
    value: QUESTION_TYPES.CODE, 
    label: QUESTION_TYPE_LABELS[QUESTION_TYPES.CODE], 
    icon: '💻', 
    gradient: 'from-indigo-500 to-violet-500',
    description: 'Programming questions'
  },
  { 
    value: QUESTION_TYPES.MCQ, 
    label: QUESTION_TYPE_LABELS[QUESTION_TYPES.MCQ], 
    icon: '📝', 
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Questions with options'
  },
  { 
    value: QUESTION_TYPES.JUMBLED, 
    label: QUESTION_TYPE_LABELS[QUESTION_TYPES.JUMBLED], 
    icon: '🔀', 
    gradient: 'from-orange-500 to-red-500',
    description: 'Arrange in order'
  },
  { 
    value: QUESTION_TYPES.FITB, 
    label: QUESTION_TYPE_LABELS[QUESTION_TYPES.FITB], 
    icon: '✍️', 
    gradient: 'from-purple-500 to-pink-500',
    description: 'Complete the answer'
  }
];

const difficultyLevels = [
  { value: COMPLEXITY_LEVELS.EASY, label: COMPLEXITY_LABELS[COMPLEXITY_LEVELS.EASY], emoji: '😊', color: 'green' },
  { value: COMPLEXITY_LEVELS.MEDIUM, label: COMPLEXITY_LABELS[COMPLEXITY_LEVELS.MEDIUM], emoji: '🤔', color: 'yellow' },
  { value: COMPLEXITY_LEVELS.HARD, label: COMPLEXITY_LABELS[COMPLEXITY_LEVELS.HARD], emoji: '😰', color: 'red' }
];

// Subject to Programming Language mapping
// This ensures that when a user selects a subject like "C Programming", 
// the programming language automatically defaults to "C"
const SUBJECT_TO_LANGUAGE_MAP: { [key: string]: string } = {
  // Exact matches
  'C Programming': 'C',
  'C++ Programming': 'C++',
  'Java Programming': 'Java',
  'Python Programming': 'Python',
  'JavaScript Programming': 'JavaScript',
  'Ruby Programming': 'Ruby',
  'Go Programming': 'Go',
  'PHP Programming': 'PHP',
  'Rust Programming': 'Rust',
  'Swift Programming': 'Swift',
  'Kotlin Programming': 'Kotlin',
  'TypeScript Programming': 'TypeScript',
  'R Programming': 'R',
  'MATLAB Programming': 'MATLAB',
  'SQL Programming': 'SQL',
  'Bash Programming': 'Bash',
  'Shell Programming': 'Shell',
  'Perl Programming': 'Perl',
  'Scala Programming': 'Scala',
  'Dart Programming': 'Dart',
  'C# Programming': 'C#',
  
  // Also support without "Programming" suffix
  'C': 'C',
  'C++': 'C++',
  'Java': 'Java',
  'Python': 'Python',
  'JavaScript': 'JavaScript',
  'Ruby': 'Ruby',
  'Go': 'Go',
  'PHP': 'PHP',
  'Rust': 'Rust',
  'Swift': 'Swift',
  'Kotlin': 'Kotlin',
  'TypeScript': 'TypeScript',
  'R': 'R',
  'MATLAB': 'MATLAB',
  'SQL': 'SQL',
  'Bash': 'Bash',
  'Shell': 'Shell',
  'Perl': 'Perl',
  'Scala': 'Scala',
  'Dart': 'Dart',
  'C#': 'C#'
};

// Helper function to get programming language from subject
const getLanguageFromSubject = (subject: string): string | null => {
  // Direct match
  if (SUBJECT_TO_LANGUAGE_MAP[subject]) {
    return SUBJECT_TO_LANGUAGE_MAP[subject];
  }
  
  // Try to match with "Programming" removed
  const withoutProgramming = subject.replace(/\s+Programming$/i, '').trim();
  if (SUBJECT_TO_LANGUAGE_MAP[withoutProgramming]) {
    return SUBJECT_TO_LANGUAGE_MAP[withoutProgramming];
  }
  
  // Check if subject contains a language name
  for (const [key, value] of Object.entries(SUBJECT_TO_LANGUAGE_MAP)) {
    if (subject.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return null;
};

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
    class: '',
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
    solution: '',
    is_public: false, // Default to private questions
    tags: [], // Initialize tags as empty array
    programming_language: 'Python',
    test_cases: [{ input: '', expected_output: '', marks: 0 }],
    test_stub: ''
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
        class: '',
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
        solution: '',
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
        throw new Error('College not found');
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
      
      console.log('Setting college data:', { boards, classes, subjects });
      setCollegeData({ boards, classes, subjects });
      
      // Set initial form values when switching to manual view
      if (view === 'manual') {
        setFormData(prev => ({
          ...prev,
          board: boards[0] || '',
          class: classes[0] || '',
          subject: subjects[0] || ''
        }));
      }
    } catch (error) {
      console.error('Error loading college data:', error);
      setError('Failed to load college data. Using default values.');
      
      // Set fallback values even on error
      const fallbackData = {
        boards: ['CBSE', 'ICSE', 'State Board'],
        classes: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'],
        subjects: ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science']
      };
      setCollegeData(fallbackData);
      
      if (view === 'manual') {
        setFormData(prev => ({
          ...prev,
          board: fallbackData.boards[0],
          class: fallbackData.classes[0],
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
      
      // Auto-sync programming language when subject changes for code questions
      if (field === 'subject' && prev.type === QUESTION_TYPES.CODE) {
        const detectedLanguage = getLanguageFromSubject(value);
        if (detectedLanguage) {
          newData.programming_language = detectedLanguage;
          console.log(`✅ Auto-synced programming language to "${detectedLanguage}" based on subject "${value}"`);
        }
      }
      
      // Auto-sync programming language when question type changes to code
      if (field === 'type' && value === QUESTION_TYPES.CODE && prev.subject) {
        const detectedLanguage = getLanguageFromSubject(prev.subject);
        if (detectedLanguage) {
          newData.programming_language = detectedLanguage;
          console.log(`✅ Auto-synced programming language to "${detectedLanguage}" based on existing subject "${prev.subject}"`);
        }
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
    if (!formData.board || !formData.class || !formData.subject) {
      setError('Please select Board, Class, and Subject');
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
      // Programming language is automatically set based on subject, no need to validate
      // It will be ensured in handleSubmit before saving
      
      if (!formData.test_stub || !formData.test_stub.trim()) {
        setError('Starter code is required for code questions');
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
        solution: formData.solution || '',
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
        
        ...(formData.type === QUESTION_TYPES.CODE && {
          programming_language: formData.programming_language,
          test_cases: formData.test_cases,
          test_stub: formData.test_stub
          // Language auto-detection happens in transformation
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
                <X size={16} className="text-white" />
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
                        <span>Hints & Solutions</span>
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
                  <Sparkles size={18} className="text-white" />
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
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Form Content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-4">
                {/* Error Message */}
                {error && (
                  <div ref={errorRef} className="bg-red-50 border-l-4 border-red-500 p-4 flex items-start space-x-3 rounded-lg">
                    <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
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
                    <p className="text-sm text-gray-600">Loading college data...</p>
                  </div>
                )}

                {!isLoadingCollegeData && (
                  <>
                    {/* Show warning if no data available */}
                    {(!collegeData.boards.length || !collegeData.classes.length || !collegeData.subjects.length) && (
                      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="text-sm font-medium text-yellow-800">College data incomplete</p>
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
                          <FileText size={20} style={{ color: brandTheme.colors.secondary }} />
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
                              <ChevronDown size={16} className="text-gray-500" />
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

                        {/* Class */}
                        <div className="dropdown-container">
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                            Class <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === 'class' ? null : 'class')}
                              className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white"
                              disabled={collegeData.classes.length === 0}
                            >
                              <span className="text-gray-900">{formData.class || 'Select Class'}</span>
                              <ChevronDown size={16} className="text-gray-500" />
                            </button>
                            {openDropdown === 'class' && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                {collegeData.classes.map((cls) => (
                                  <button
                                    key={cls}
                                    onClick={() => {
                                      handleInputChange('class', cls);
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                  >
                                    {cls}
                                  </button>
                                ))}
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
                              <ChevronDown size={16} className="text-gray-500" />
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
                          <BookOpen size={20} style={{ color: brandTheme.colors.secondary }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Question Type</h3>
                          <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Choose the question format</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-3">
                        {questionTypes.map(type => (
                          <button
                            key={type.value}
                            onClick={() => {
                              handleInputChange('type', type.value);
                              if (type.value === QUESTION_TYPES.MCQ || type.value === QUESTION_TYPES.JUMBLED) {
                                setFormData(prev => ({ ...prev, options: ['', '', '', ''], correct_answers: [], correct_sequence: [] }));
                              } else {
                                setFormData(prev => ({ ...prev, options: [''], correct_answers: [], correct_sequence: [] }));
                              }
                            }}
                            className={`group relative p-4 rounded-xl border transition-all overflow-hidden ${
                              formData.type === type.value
                                ? 'border-transparent shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            style={formData.type === type.value ? {
                              background: `linear-gradient(135deg, ${brandTheme.colors.primary}, ${brandTheme.colors.secondary || brandTheme.colors.primary})`
                            } : {}}
                          >
                            <div className="relative z-10">
                              <div className={`text-3xl mb-2 transition-transform group-hover:scale-110 ${
                                formData.type === type.value ? 'filter drop-shadow-lg' : ''
                              }`}>
                                {type.icon}
                              </div>
                              <p className={`text-xs font-bold mb-1 ${
                                formData.type === type.value ? 'text-white' : 'text-gray-900'
                              }`}>
                                {type.label}
                              </p>
                              <p className={`text-[10px] ${
                                formData.type === type.value ? 'text-white/80' : 'text-gray-600'
                              }`}>
                                {type.description}
                              </p>
                            </div>
                            {formData.type === type.value && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle size={16} className="text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question Text with Image Upload */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm text-base font-semibold text-gray-900 uppercase tracking-wide">
                          {formData.type === QUESTION_TYPES.CODE ? 'Problem Statement' : 'Question'} <span className="text-red-500">*</span>
                        </h3>
                        <button
                          onClick={() => questionImageInputRef.current?.click()}
                          disabled={isUploadingImage || formData.question_image_urls.length >= 5}
                          className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ 
                            color: brandTheme.colors.primary,
                            backgroundColor: `${brandTheme.colors.primary}10`
                          }}
                          title={formData.question_image_urls.length >= 5 ? 'Maximum 5 images allowed' : 'Add images (max 5, 10MB each)'}
                        >
                          {isUploadingImage ? (
                            <>
                              <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon size={16} />
                              <span>Add Images ({formData.question_image_urls.length}/5)</span>
                            </>
                          )}
                        </button>
                        <input
                          ref={questionImageInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                      
                      <div className="border border-gray-300 rounded-lg overflow-hidden">
                        <RichTextEditor
                          value={formData.question_text}
                          onChange={(value) => handleInputChange('question_text', value)}
                          darkMode={false}
                          placeholder={formData.type === QUESTION_TYPES.CODE ? 'Describe the problem statement...' : 'Enter your question here...'}
                          minHeight="300px"
                        />
                      </div>

                      {/* Multiple Images Preview Grid */}
                      {formData.question_image_urls.length > 0 && (
                        <div className="grid grid-cols-5 gap-2 mt-3">
                          {formData.question_image_urls.map((imageUrl, index) => (
                            <div key={index} className="relative group">
                              <img 
                                src={imageUrl} 
                                alt={`Question Image ${index + 1}`} 
                                className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                                <button
                                  onClick={() => removeQuestionImage(index)}
                                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg transform scale-90 group-hover:scale-100"
                                  title="Remove image"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="absolute top-1.5 left-1.5 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded font-semibold">
                                {index + 1}
                              </div>
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
                            <ListChecks size={20} style={{ color: brandTheme.colors.secondary }} />
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
                                  <Trash2 size={16} />
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
                            <Plus size={16} />
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
                            <GripVertical size={20} style={{ color: brandTheme.colors.secondary }} />
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
                              <GripVertical size={18} className="text-gray-400" />
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
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={addOption}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                          >
                            <Plus size={16} />
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
                              <CheckCircle size={20} style={{ color: brandTheme.colors.secondary }} />
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
                                        <Trash2 size={14} />
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
                                  <Plus size={14} />
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
                          <Plus size={16} />
                          <span>Add Another Blank</span>
                        </button>
                        
                        <p className="text-xs text-gray-600 mt-3">💡 Add multiple blanks for questions like "The capital of ___₁ is ___₂"</p>
                      </div>
                    )}

                    {/* Code Question Specific Fields */}
                    {formData.type === QUESTION_TYPES.CODE && (
                      <>
                        {/* Test Stub */}
                        <div className="border rounded-xl p-4"
                          style={{ 
                            background: brandTheme.gradients.card,
                            borderColor: brandTheme.colors.secondary + '33'
                          }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                                <FileText size={20} style={{ color: brandTheme.colors.secondary }} />
                              </div>
                              <div>
                                <h3 className="text-base font-semibold text-gray-900">Starter Code <span className="text-red-500">*</span></h3>
                                <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Pre-filled code template for students</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowStarterCodeHelp(!showStarterCodeHelp)}
                              className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                              title="Show examples"
                            >
                              <HelpCircle size={14} />
                            </button>
                          </div>

                          {showStarterCodeHelp && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-2">
                              <p className="font-semibold text-blue-900">💡 Starter Code Examples:</p>
                              
                              <div className="space-y-3">
                                <div>
                                  <p className="font-medium text-blue-800 mb-1">Python:</p>
                                  <pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto">
{`def solution(n):
    # Write your code here
    pass`}
                                  </pre>
                                </div>

                                <div>
                                  <p className="font-medium text-blue-800 mb-1">Java:</p>
                                  <pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto">
{`class Solution {
    public int solution(int n) {
        // Write your code here
        return 0;
    }
}`}
                                  </pre>
                                </div>

                                <div>
                                  <p className="font-medium text-blue-800 mb-1">C++:</p>
                                  <pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto">
{`int solution(int n) {
    // Write your code here
    return 0;
}`}
                                  </pre>
                                </div>
                              </div>

                              <p className="text-blue-700 italic mt-2">Students will start with this code and modify it to solve the problem.</p>
                            </div>
                          )}

                          <textarea
                            value={formData.test_stub || ''}
                            onChange={(e) => handleInputChange('test_stub', e.target.value)}
                            placeholder={`def solution():
    # Your code here
    pass`}
                            rows={6}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-y text-sm font-mono"
                            style={{ minHeight: '48px', maxHeight: '300px' }}
                          />
                        </div>

                        {/* Test Cases */}
                        <div className="border rounded-xl p-4"
                          style={{ 
                            background: brandTheme.gradients.card,
                            borderColor: brandTheme.colors.secondary + '33'
                          }}>
                          <div className="flex items-center space-x-2.5 mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                              <ListChecks size={20} style={{ color: brandTheme.colors.secondary }} />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">Test Cases <span className="text-red-500">*</span></h3>
                              <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Input and expected output pairs</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {(formData.test_cases || []).map((testCase, index) => (
                              <div key={index} className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1 space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={testCase.input}
                                      onChange={(e) => {
                                        const newTestCases = [...(formData.test_cases || [])];
                                        newTestCases[index].input = e.target.value;
                                        handleInputChange('test_cases', newTestCases);
                                      }}
                                      placeholder="Input (e.g., 5)"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <input
                                      type="text"
                                      value={testCase.expected_output}
                                      onChange={(e) => {
                                        const newTestCases = [...(formData.test_cases || [])];
                                        newTestCases[index].expected_output = e.target.value;
                                        handleInputChange('test_cases', newTestCases);
                                      }}
                                      placeholder="Expected Output (e.g., 120)"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                  </div>
                                  <input
                                    type="number"
                                    value={testCase.marks || 0}
                                    onChange={(e) => {
                                      const newTestCases = [...(formData.test_cases || [])];
                                      newTestCases[index].marks = parseFloat(e.target.value) || 0;
                                      handleInputChange('test_cases', newTestCases);
                                    }}
                                    placeholder="Marks (e.g., 0.5)"
                                    step="0.1"
                                    min="0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                {(formData.test_cases || []).length > 1 && (
                                  <button
                                    onClick={() => {
                                      const newTestCases = (formData.test_cases || []).filter((_, i) => i !== index);
                                      handleInputChange('test_cases', newTestCases);
                                    }}
                                    className="w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all mt-7"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newTestCases = [...(formData.test_cases || []), { input: '', expected_output: '', marks: 0 }];
                                handleInputChange('test_cases', newTestCases);
                              }}
                              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                              style={{ 
                                color: brandTheme.colors.primary,
                                backgroundColor: `${brandTheme.colors.primary}10`
                              }}
                            >
                              <Plus size={16} />
                              <span>Add Test Case</span>
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 mt-3">💡 Add multiple test cases with marks. The sum of all test case marks should equal the maximum marks.</p>
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
                                  <CheckCircle size={16} className="text-white" />
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
                          <Award size={20} style={{ color: brandTheme.colors.accent }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Additional Details & Help</h3>
                          <p className="text-xs" style={{ color: brandTheme.colors.accent, opacity: 0.9 }}>Marks, visibility, hints & solutions</p>
                        </div>
                      </div>

                      {/* Maximum Marks, Previous Year, and Visibility */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
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
                            placeholder="e.g., 2023, 2024"
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
                                {formData.is_public ? '🌐 Public (All colleges)' : '🏫 Private (Your college only)'}
                              </span>
                              <ChevronDown size={16} className="text-gray-500" />
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
                                  🏫 Private (Your college only)
                                </button>
                                <button
                                  onClick={() => {
                                    handleInputChange('is_public', true);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                >
                                  🌐 Public (All colleges)
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
                                  if (!currentTags.includes(newTag)) {
                                    handleInputChange('tags', [...currentTags, newTag]);
                                  }
                                  setTagInput('');
                                }
                              }}
                              placeholder="Type tag and press Enter (e.g., algebra, geometry, calculus)"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newTag = tagInput.trim().toLowerCase();
                                const currentTags = formData.tags || [];
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
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Add tags to categorize and search questions easily (e.g., "trigonometry", "quadratic-equations", "kinematics")
                          </p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t-2 border-gray-200 my-4"></div>

                      {/* Help Students - Hint and Solution */}
                      <div className="flex items-center space-x-2 mb-3">
                        <HelpCircle size={18} style={{ color: brandTheme.colors.accent }} />
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

                        <div>
                          <label className="block text-xs font-semibold text-gray-900 mb-1.5">Solution</label>
                          {formData.type === QUESTION_TYPES.CODE ? (
                            <div className="relative">
                              <textarea
                                value={formData.solution}
                                onChange={(e) => handleInputChange('solution', e.target.value)}
                                placeholder={`def solution(n):
    # Write the complete solution here
    result = n * (n - 1)
    return result`}
                                rows={10}
                                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-y text-sm font-mono hover:border-gray-400 bg-gray-900 text-gray-100"
                                style={{ tabSize: 4, minHeight: '48px', maxHeight: '300px' }}
                              />
                              <div className="mt-2 border border-gray-300 rounded-lg overflow-hidden">
                                <div className="bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 border-b border-gray-300 flex items-center justify-between">
                                  <span>Preview</span>
                                  <span className="text-[10px] text-gray-500">Live syntax highlighting</span>
                                </div>
                                {formData.solution ? (
                                  <SyntaxHighlighter
                                    language={formData.programming_language?.toLowerCase() || 'python'}
                                    style={vscDarkPlus}
                                    customStyle={{
                                      margin: 0,
                                      borderRadius: 0,
                                      fontSize: '0.875rem',
                                      padding: '1rem'
                                    }}
                                    showLineNumbers={true}
                                  >
                                    {formData.solution}
                                  </SyntaxHighlighter>
                                ) : (
                                  <div className="bg-gray-900 p-8 text-center">
                                    <p className="text-gray-400 text-sm">Start typing to see live preview...</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="border border-gray-300 rounded-lg overflow-hidden">
                              <RichTextEditor
                                value={formData.solution}
                                onChange={(value) => handleInputChange('solution', value)}
                                darkMode={false}
                                placeholder="Provide detailed solution..."
                                minHeight="300px"
                              />
                            </div>
                          )}
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
                        <Save size={16} />
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
                  <CheckCircle size={36} className="text-white" />
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