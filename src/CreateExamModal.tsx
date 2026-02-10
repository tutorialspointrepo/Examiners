import { useState, useEffect, useRef } from 'react';
import { useBrand } from './BrandContext';
import { firebaseService, type UserModel, type ExamModel, type QuestionBankItem } from './services/firebase_service';
import { 
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  EXAM_MODES,
  SECURITY_LEVELS,
  COMPLEXITY_LEVELS,
  FILTER_VALUES,
  type QuestionType,
  type ExamMode,
  type ExamStatus,
  type SecurityLevel,
  type ComplexityLevel,
} from './constants';
// Extend QuestionBankItem to include solution field used in question bank display
interface QuestionBankItemWithSolution extends QuestionBankItem {
  solution?: string;
}
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import RichTextEditor from './RichTextEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faXmark, 
  faUpload, 
  faCalendar, 
  faFileLines, 
  faBook,
  faGraduationCap,
  faUsers,
  faAward,
  faBuilding,
  faChevronDown,
  faPlus,
  faTrash,
  faCheck,
  faLaptop,
  faImage,
  faBookBookmark,
  faClipboardList,
  faHouse,
  faFlaskVial,
  faCircleExclamation,
  faCircleCheck,
  faMagnifyingGlass,
  faChevronLeft,
  faChevronRight,
  faBookAtlas,
  faUser,
  faFilter,
  faPen,
  faCircleQuestion,
  faListCheck,
  faGripVertical,
  faLock,
  faGlobe,
  faShuffle,
  faPenToSquare,
  faFileText,
  faCode,
  faCheckDouble,
  faCopy,
  faDatabase,
  faClock,
  faHourglass,
  faCheckCircle,
  faCamera,
  faVideo,
  faFileAlt
} from '@fortawesome/sharp-light-svg-icons';

interface Question {
    id: string;
    type: QuestionType;
    questionText: string;
    title?: string;
    maximumMarks: number;
    marks?: number;
    complexity?: string;
    board?: string;
    chapter?: string;
    options?: string[];
    correctAnswers?: string[];
    correctAnswer?: number;
    blanks?: string[];  // ✅ FITB specific
    correctSequence?: string[];  // ✅ Jumbled specific
    jumbledOptions?: string[];
    hint?: string;
    solution?: string;
    // Code question specific
    programmingLanguage?: string;
    programming_language?: string;
    testCases?: Array<{ input: string; expected_output?: string; marks?: number }>;
    testStub?: string;
    starter_codes?: Array<{ language: string; code: string }>;
    // Additional fields
    subject?: string;
    class?: string;
    createdByName?: string;
    createdAt?: string;
    isProprietaryQuestion?: boolean;
    source?: 'questionBank' | 'custom';
    questionBankId?: string;
    questionNo?: number;
    // Image URLs
    imageUrls?: string[];
  }


interface Exam {
  id: string;
  type: string;
  typeColor: string;
  year: string;
  class: string;
  classes?: string[];
  subject?: string;
  title: string;
  board: string;
  status: ExamStatus;
  mode: ExamMode;
  securityLevel?: SecurityLevel;
  attendance?: boolean;
  examDate: string;
  examTime?: string;
  duration: string;
  units?: string;
  totalQuestions: number;
  maxMarks: string;
  totalStudents?: number;
  enrolledClasses?: string[];
  questionPaperImages?: string[];
  questionsList?: Question[];
  createdAt: string;
  createdBy: string;
  createdById: string;
  createdByRole: string;
}

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (exam: ExamModel) => void;
  existingExam?: Exam | null;
  currentUser: UserModel;
  activeCollegeId?: string;
  activeCollegeName?: string;
}

const getExamTypeIcon = (examType: string) => {
  const iconMap: Record<string, any> = {
    'Homework': faHouse,
    'Subject Assessment': faBookBookmark,
    'Unit Test': faClipboardList,
    'Quarterly': faCalendar,
    'Half Yearly': faAward,
    'Yearly': faGraduationCap,
    'Pre-Board': faFileLines,
    'Lab Assessment': faFlaskVial
  };
  return iconMap[examType] || faBook;
};

const getExamTypeColor = (examType: string): string => {
  const colorMap: Record<string, string> = {
    'Homework': 'blue',
    'Subject Assessment': 'purple',
    'Unit Test': 'green',
    'Quarterly': 'orange',
    'Half Yearly': 'pink',
    'Yearly': 'red',
    'Pre-Board': 'indigo',
    'Lab Assessment': 'teal'
  };
  return colorMap[examType] || 'gray';
};
// Helper function to parse duration string to minutes
const parseDurationToMinutes = (duration: string | number): number => {
  // Convert to string if it's a number
  const durationStr = typeof duration === 'number' ? duration.toString() : duration;
  
  // If it's just a number string (e.g., "90"), treat it as minutes
  if (/^\d+$/.test(durationStr)) {
    return parseInt(durationStr);
  }
  
  const durationLower = durationStr.toLowerCase();
  
  // Match patterns like "1 hour", "90 minutes", "1.5 hours", "2 hours 30 minutes"
  const hourMatch = durationLower.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/);
  const minuteMatch = durationLower.match(/(\d+)\s*(?:minute|min)/);
  
  let totalMinutes = 0;
  
  if (hourMatch) {
    totalMinutes += parseFloat(hourMatch[1]) * 60;
  }
  
  if (minuteMatch) {
    totalMinutes += parseInt(minuteMatch[1]);
  }
  
  // Default to 60 minutes if parsing fails
  return totalMinutes > 0 ? totalMinutes : 60;
};
// Helper function to convert display value to minutes
const convertToMinutes = (value: number, unit: 'minutes' | 'hours' | 'days'): number => {
  if (unit === 'hours') return value * 60;
  if (unit === 'days') return value * 1440; // 24 * 60
  return value; // minutes
};

// Helper function to convert minutes to display value
const convertFromMinutes = (minutes: number, unit: 'minutes' | 'hours' | 'days'): number => {
  if (unit === 'hours') return Math.round(minutes / 60);
  if (unit === 'days') return Math.round(minutes / 1440);
  return minutes;
};

// Helper to get suggested unit based on exam type
const getSuggestedDurationUnit = (examType: string): 'minutes' | 'hours' | 'days' => {
  if (examType === 'Homework') return 'days';
  if (examType === 'Lab Assessment') return 'hours';
  return 'minutes';
};


// Helper function to check if two time periods overlap
const checkTimeOverlap = (
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): boolean => {
  return start1 < end2 && start2 < end1;
};

// Helper function to parse exam date string to Date object
const parseExamDate = (dateStr: string): Date | null => {
  try {
    // Try parsing different date formats
    // Format 1: "2025-11-15" or "2025/11/15"
    if (dateStr.match(/^\d{4}[-/]\d{2}[-/]\d{2}$/)) {
      return new Date(dateStr);
    }
    
    // Format 2: "15 Nov 2025" or "15-Nov-2025"
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      return dateObj;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

// Get academic year from database for a college
const getCurrentAcademicYear = async (collegeId?: string): Promise<string> => {
  if (collegeId) {
    return await firebaseService.getAcademicYear(collegeId);
  }
  // Fallback: calculate based on April start
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (currentMonth >= 4) {
    return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  } else {
    return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  }
};

// No conversion needed - database has modern types after migration
export default function CreateExamModal({ isOpen, onClose, onSave, existingExam, currentUser, activeCollegeId, activeCollegeName }: CreateExamModalProps) {
  const brand = useBrand();
  const [imageCarouselOpen, setImageCarouselOpen] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [examMode, setExamMode] = useState<ExamMode>(EXAM_MODES.ONLINE);
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>(SECURITY_LEVELS.NORMAL);
  const [attendance, setAttendance] = useState<boolean>(false);
  const [avProctoring, setAvProctoring] = useState<boolean>(false);
  const [completionPolicy, setCompletionPolicy] = useState<'strict' | 'flexible'>('strict');
  const [academicYear, setAcademicYear] = useState('');
  const [examType, setExamType] = useState('');
  const [examLabel, setExamLabel] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [board, setBoard] = useState('');
  const [maximumMarks, setMaximumMarks] = useState(100);
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [duration, setDuration] = useState(180);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [durationDisplayValue, setDurationDisplayValue] = useState(180);

  // Sync duration when unit or display value changes
  useEffect(() => {
    const minutes = convertToMinutes(durationDisplayValue, durationUnit);
    setDuration(minutes);
  }, [durationDisplayValue, durationUnit]);

  // Auto-adjust unit when exam type changes
  useEffect(() => {
    const suggestedUnit = getSuggestedDurationUnit(examType);
    if (durationUnit !== suggestedUnit) {
      setDurationUnit(suggestedUnit);
      setDurationDisplayValue(convertFromMinutes(duration, suggestedUnit));
    }
  }, [examType]);
  
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [questionPaperImages, setQuestionPaperImages] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [pickRandomCount, setPickRandomCount] = useState<number>(0);
  const [poolQuestionMarks, setPoolQuestionMarks] = useState<number>(0);
  const [enableQuestionPool, setEnableQuestionPool] = useState<boolean>(false);
  const [isAddingToPool, setIsAddingToPool] = useState<boolean>(false);
  const [isEditingFromPool, setIsEditingFromPool] = useState<boolean>(false);
  
  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);
  const [showCustomQuestionModal, setShowCustomQuestionModal] = useState(false);
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankItemWithSolution[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [selectedQuestionsMap, setSelectedQuestionsMap] = useState<Map<string, QuestionBankItemWithSolution>>(new Map());
  const [isLoadingQuestionBank, setIsLoadingQuestionBank] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuestionBankItems, setTotalQuestionBankItems] = useState(0);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const questionsPerPage = 10;
  const [qbPageDocs, setQbPageDocs] = useState<Map<number, any>>(new Map());
  
  // Pagination for Questions and Question Pool lists
  const [questionsListPage, setQuestionsListPage] = useState(1);
  const [questionPoolPage, setQuestionPoolPage] = useState(1);
  const questionsListPerPage = 25;
  
  // New filter states
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string>(FILTER_VALUES.ALL);
  const [complexityFilter, setComplexityFilter] = useState<string>(FILTER_VALUES.ALL);
  const [chapterFilter, setChapterFilter] = useState<string>(FILTER_VALUES.ALL);
  const [tagFilter, setTagFilter] = useState<string>(FILTER_VALUES.ALL);
  const [proprietaryFilter, setProprietaryFilter] = useState<'common' | 'all' | 'proprietary'>('all');
  const [showQuestionTypeDropdown, setShowQuestionTypeDropdown] = useState(false);
  const [showComplexityDropdown, setShowComplexityDropdown] = useState(false);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showQBClassDropdown, setShowQBClassDropdown] = useState(false);
  const [showQBSubjectDropdown, setShowQBSubjectDropdown] = useState(false);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [hoveredExamOption, setHoveredExamOption] = useState<string | null>(null);

  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [, setTotalStudents] = useState(0);
  const [, setIsLoadingStudentCount] = useState(false);

  // Custom Question Modal States
  const [customQuestionType, setCustomQuestionType] = useState<QuestionType>(QUESTION_TYPES.DESCRIPTIVE);
  const [customQuestionText, setCustomQuestionText] = useState('');
  const [customQuestionMarks, setCustomQuestionMarks] = useState(1);
  const [customQuestionComplexity, setCustomQuestionComplexity] = useState<ComplexityLevel>(COMPLEXITY_LEVELS.MEDIUM);
  const [customQuestionChapter, setCustomQuestionChapter] = useState<string>('');
  const [customQuestionSubject, setCustomQuestionSubject] = useState<string>('');
  const [customQuestionOptions, setCustomQuestionOptions] = useState<string[]>(['', '', '', '']);
  const [customQuestionCorrectAnswers, setCustomQuestionCorrectAnswers] = useState<string[]>([]);
  const [customQuestionBlanks, setCustomQuestionBlanks] = useState<string[]>(['']);
  const [customQuestionSequence, setCustomQuestionSequence] = useState<string[]>(['', '', '', '']);
  const [customQuestionHint, setCustomQuestionHint] = useState('');
  const [customQuestionSolution, setCustomQuestionSolution] = useState('');
  const [customQuestionProgrammingLanguage, setCustomQuestionProgrammingLanguage] = useState('Python');
  const [customQuestionTestCases, setCustomQuestionTestCases] = useState<Array<{ input: string; expected_output?: string; marks?: number }>>([{ input: '', expected_output: '', marks: 0 }]);
 const [customQuestionTestStub, setCustomQuestionTestStub] = useState('');
  const [customStarterCodes, setCustomStarterCodes] = useState<Array<{ language: string; code: string }>>([{ language: 'python', code: '' }]);
  const [customQuestionImageUrls, setCustomQuestionImageUrls] = useState<string[]>([]);
  const [isUploadingCustomQuestionImage, setIsUploadingCustomQuestionImage] = useState(false);
  const customQuestionImageInputRef = useRef<HTMLInputElement>(null);
  
  // SQL Question States
  const [customSqlSchema, setCustomSqlSchema] = useState<Array<{
    table_name: string;
    columns: Array<{ name: string; type: string; description: string; constraints: string }>;
    primary_key: string;
    note: string;
  }>>([{ table_name: '', columns: [{ name: '', type: 'int', description: '', constraints: '' }], primary_key: '', note: '' }]);
  const [customSqlTestCases, setCustomSqlTestCases] = useState<Array<{
    title: string;
    table_data: Record<string, string[][]>;
    expected_output: { columns: string[]; rows: string[][] };
    marks: number;
  }>>([{ title: 'Test Case 1', table_data: {}, expected_output: { columns: [''], rows: [['']] }, marks: 0 }]);
  const [showStarterCodeHelp, setShowStarterCodeHelp] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [, setCodingLanguages] = useState<string[]>(['Python', 'Java', 'C++', 'C', 'JavaScript', 'Go', 'Ruby']);
  const [, setIsLoadingLanguages] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    type: 'error' | 'success' | 'info';
    title: string;
    message: string;
    shouldCloseModal?: boolean;
  }>({
    show: false,
    type: 'info',
    title: '',
    message: '',
    shouldCloseModal: false
  });

  // Editing state - added at the end to preserve hooks order
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  // Student Enrollment Modal States
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<UserModel[]>([]);
  const [availableStudents, setAvailableStudents] = useState<UserModel[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentClassFilter, setStudentClassFilter] = useState<string>('all');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentModalPage, setStudentModalPage] = useState(1);
  const studentsPerPage = 25;
  const [showStudentClassDropdown, setShowStudentClassDropdown] = useState(false);

  const showAlert = (type: 'error' | 'success' | 'info', title: string, message: string, shouldCloseModal: boolean = false) => {
    setAlertConfig({
      show: true,
      type,
      title,
      message,
      shouldCloseModal
    });
  };

  // Helper function to check if a question is already in exam or pool
  const isQuestionAlreadyAdded = (questionId: string): { isAdded: boolean; location: string } => {
    // Check in main questions list
    const inQuestions = questions.some(q => 
      (q.questionBankId === questionId) || (q.id === questionId)
    );
    
    // Check in question pool
    const inPool = questionPool.some(q => 
      (q.questionBankId === questionId) || (q.id === questionId)
    );
    
    if (inQuestions) {
      return { isAdded: true, location: 'exam questions' };
    }
    if (inPool) {
      return { isAdded: true, location: 'question pool' };
    }
    
    return { isAdded: false, location: '' };
  };

  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, show: false }));
  };

  // Helper function to safely render text
  const safeRender = (text: any): string => {
    if (text === null || text === undefined) return '';
    return String(text);
  };

  // Helper function to check if text contains HTML tags
  const containsHTML = (text: string): boolean => {
    if (!text) return false;
    // Check for common HTML tags like <p>, <h1>, <h2>, <code>, <strong>, etc.
    const htmlPattern = /<[a-z][\s\S]*>/i;
    return htmlPattern.test(text);
  };

  // Helper function to convert filter value to actual question type
  const getActualQuestionType = (filterValue: string): QuestionType | undefined => {
    if (filterValue === FILTER_VALUES.ALL) {
      return undefined; // No filter, fetch all types
    }
    // Return the filter value as it's already a QuestionType constant
    return filterValue as QuestionType;
  };

  // Copy to clipboard function for code blocks
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Drag and drop handlers for jumbled quiz
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSequence = [...customQuestionSequence];
    const draggedItem = newSequence[draggedIndex];
    newSequence.splice(draggedIndex, 1);
    newSequence.splice(index, 0, draggedItem);

    setCustomQuestionSequence(newSequence);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-dismiss error messages after 10 seconds
  useEffect(() => {
    if (showErrors && Object.keys(errors).length > 0) {
      const timer = setTimeout(() => {
        setShowErrors(false);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [showErrors, errors]);

  // Clear individual field errors when fields become valid
  useEffect(() => {
    if (showErrors) {
      const newErrors = { ...errors };
      let hasChanges = false;

      // Clear error if exam date is filled
      if (examDate && errors.examDate) {
        delete newErrors.examDate;
        hasChanges = true;
      }

      // Clear error if exam time is filled
      if (examTime && errors.examTime) {
        delete newErrors.examTime;
        hasChanges = true;
      }

      // Clear error if maximum marks is valid
      if (maximumMarks && maximumMarks > 0 && errors.maximumMarks) {
        delete newErrors.maximumMarks;
        hasChanges = true;
      }

      // Clear error if duration is valid
      if (duration && duration > 0 && errors.duration) {
        delete newErrors.duration;
        hasChanges = true;
      }

      // Clear error if academic year is filled
      if (academicYear && errors.academicYear) {
        delete newErrors.academicYear;
        hasChanges = true;
      }

      // Clear error if exam type is filled
      if (examType && errors.examType) {
        delete newErrors.examType;
        hasChanges = true;
      }

      // Clear error if students are enrolled
      if (enrolledStudents.length > 0 && errors.enrolledStudents) {
        delete newErrors.enrolledStudents;
        hasChanges = true;
      }

      // Clear error if board is filled
      if (board && errors.board) {
        delete newErrors.board;
        hasChanges = true;
      }

      // Clear error if question paper images are uploaded (offline mode)
      if (examMode === EXAM_MODES.OFFLINE && questionPaperImages.length > 0 && errors.questionPaperImages) {
        delete newErrors.questionPaperImages;
        hasChanges = true;
      }

      // Clear error if questions are added (online mode)
      if (examMode === EXAM_MODES.ONLINE && questions.length > 0 && errors.questions) {
        delete newErrors.questions;
        hasChanges = true;
      }

      // Update errors if any changes were made
      if (hasChanges) {
        setErrors(newErrors);
        
        // If all errors are cleared, hide the error display
        if (Object.keys(newErrors).length === 0) {
          setShowErrors(false);
        }
      }
    }
  }, [examDate, examTime, maximumMarks, duration, academicYear, examType, enrolledStudents, board, questionPaperImages, questions, examMode, showErrors, errors]);

  const fetchStudentCount = async (collegeId: string, selectedClass: string) => {
    if (!collegeId || !selectedClass) {
      console.log('❌ No college or class selected, setting count to 0');
      setTotalStudents(0);
      return;
    }

    try {
      console.log(`🔍 Fetching students for college: ${collegeId}, class: ${selectedClass}`);
      setIsLoadingStudentCount(true);
      const students = await firebaseService.getUsersByType('student', collegeId);
      
      console.log(`📊 Total students in college: ${students.length}`);
      
      const studentsInClass = students.filter(
        student => student.studentClass === selectedClass
      );
      
      console.log(`✅ Students in ${selectedClass}: ${studentsInClass.length}`);
      setTotalStudents(studentsInClass.length);
    } catch (error) {
      console.error('❌ Error fetching student count:', error);
      setTotalStudents(0);
    } finally {
      setIsLoadingStudentCount(false);
    }
  };

  useEffect(() => {
    const loadCollegeData = async () => {
      if (!activeCollegeId) {
        setIsLoadingData(false);
        return;
      }

      try {
        setIsLoadingData(true);
        const college = await firebaseService.getCollegeById(activeCollegeId);
        
        if (college) {
          const loadedExamTypes = college.examTypes && college.examTypes.length > 0 
            ? college.examTypes 
            : ['Unit Test', 'Quarterly', 'Half Yearly', 'Yearly'];
          
          const loadedClasses = college.validClasses && college.validClasses.length > 0
            ? college.validClasses
            : ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
          
          const loadedSubjects = college.subjects && college.subjects.length > 0
            ? college.subjects
            : ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science'];
          
          // Ensure 'Database' is always available as a subject
          if (!loadedSubjects.includes('Database')) {
            loadedSubjects.push('Database');
          }
          
          const loadedBoards = college.supportedBoards && college.supportedBoards.length > 0
            ? college.supportedBoards
            : ['CBSE', 'ICSE', 'State Board'];
          
          setExamTypes(loadedExamTypes);
          setClasses(loadedClasses);
          setSubjects(loadedSubjects);
          setBoards(loadedBoards);

          if (!examType && loadedExamTypes.length > 0) {
            setExamType(loadedExamTypes[0]);
          }
          // Set board and academicYear from college data by default
          if (loadedBoards.length > 0) {
            setBoard(loadedBoards[0]);
          }
          // Set academicYear from college data
          const year = await getCurrentAcademicYear(activeCollegeId);
          setAcademicYear(year);
        }
      } catch (error) {
        console.error('Error loading college data:', error);
        setExamTypes(['Unit Test', 'Quarterly', 'Half Yearly', 'Yearly']);
        setClasses(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']);
        setSubjects(['Mathematics', 'Science', 'English', 'Hindi', 'Social Science']);
        setBoards(['CBSE', 'ICSE', 'State Board']);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (isOpen && activeCollegeId) {
      loadCollegeData();
    }
  }, [isOpen, activeCollegeId]);

  useEffect(() => {
    console.log(`📋 Class changed: ${className}, College: ${activeCollegeId}, Modal open: ${isOpen}`);
    if (activeCollegeId && className && isOpen) {
      fetchStudentCount(activeCollegeId, className);
    } else {
      console.log('⏭️ Skipping fetch - missing required data');
    }
  }, [className, activeCollegeId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setShowErrors(false);
      setTotalStudents(0);
      
      if (existingExam) {
        setExamMode(existingExam.mode);
        setSecurityLevel(existingExam.securityLevel || SECURITY_LEVELS.NORMAL);
        setAttendance(existingExam.attendance || false);
        setAvProctoring((existingExam as any).avProctoring || false);
        setCompletionPolicy((existingExam as any).completionPolicy || 'strict');
        setAcademicYear(existingExam.year);
        setExamType(existingExam.type);
        setClassName(existingExam.class);
        setSubject(existingExam.subject || '');
        setBoard(existingExam.board);
        setMaximumMarks(parseInt(existingExam.maxMarks));
        setExamDate(existingExam.examDate);
        setExamTime(existingExam.examTime || '');
        setTotalStudents(existingExam.totalStudents || 0);
        
        // Load enrolled students for existing exam
        if (existingExam.id && activeCollegeId) {
          firebaseService.getExamEnrolledStudentIds(existingExam.id).then(async (enrolledIds) => {
            if (enrolledIds.size > 0) {
              // Fetch full student objects for enrolled IDs
              const allStudents = await firebaseService.getUsersByType('student', activeCollegeId!);
              const enrolled = allStudents.filter(s => enrolledIds.has(s.userId));
              setEnrolledStudents(enrolled);
              setTotalStudents(enrolled.length);
            }
          }).catch(err => console.error('Error loading enrolled students:', err));
        }
        
        // ✅ FIXED: Proper duration handling with unit conversion
        const durationInMinutes = parseInt(existingExam.duration);
        setDuration(durationInMinutes);
        
        // Auto-select best unit
        let bestUnit: 'minutes' | 'hours' | 'days' = 'minutes';
        let displayValue = durationInMinutes;
        
        if (durationInMinutes >= 1440) {
          bestUnit = 'days';
          displayValue = Math.round(durationInMinutes / 1440);
        } else if (durationInMinutes >= 60) {
          bestUnit = 'hours';
          displayValue = Math.round(durationInMinutes / 60);
        }
        
        setDurationUnit(bestUnit);
        setDurationDisplayValue(displayValue);

        if (existingExam.mode === EXAM_MODES.OFFLINE && existingExam.questionPaperImages) {
          setQuestionPaperImages(existingExam.questionPaperImages);
        } else if (existingExam.mode === EXAM_MODES.ONLINE && existingExam.questionsList) {
          setQuestions(existingExam.questionsList);
          
          // Load question pool data if present
          if ((existingExam as any).enableQuestionPool) {
            setEnableQuestionPool(true);
            setQuestionPool((existingExam as any).questionPool || []);
            setPickRandomCount((existingExam as any).pickRandomCount || 0);
            setPoolQuestionMarks((existingExam as any).poolQuestionMarks || 0);
          }
        }
      } else {
        setExamMode(EXAM_MODES.ONLINE);
        setSecurityLevel(SECURITY_LEVELS.NORMAL);
        setAttendance(false);
        setAvProctoring(false);
        setCompletionPolicy('strict');
        getCurrentAcademicYear().then(year => setAcademicYear(year));
        setExamType('');
        setExamLabel('');
        setClassName('');
        setSubject('');
        setBoard('');
        setMaximumMarks(100);
        setExamDate('');
        setExamTime('');
        setDuration(180);
        setDurationUnit('minutes');
        setDurationDisplayValue(180);
        setQuestionPaperImages([]);
        setQuestions([]);
        setEnableQuestionPool(false);
        setQuestionPool([]);
        setPickRandomCount(0);
        setPoolQuestionMarks(0);
        setEnrolledStudents([]);
        setSelectedStudentIds(new Set());
      }
    }
  }, [isOpen, existingExam]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
      if (!target.closest('.filter-dropdown')) {
        setShowQuestionTypeDropdown(false);
        setShowComplexityDropdown(false);
        setShowChapterDropdown(false);
        setShowTagDropdown(false);
        setShowQBClassDropdown(false);
        setShowQBSubjectDropdown(false);
      }
    };

    if (openDropdown || showQuestionTypeDropdown || showComplexityDropdown || showChapterDropdown || showTagDropdown || showQBClassDropdown || showQBSubjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown, showQuestionTypeDropdown, showComplexityDropdown, showChapterDropdown, showTagDropdown, showQBClassDropdown, showQBSubjectDropdown]);

  // Fetch coding languages from Firebase
  useEffect(() => {
    const fetchCodingLanguages = async () => {
      try {
        setIsLoadingLanguages(true);
        const languages = await firebaseService.getCodingLanguages();
        if (languages && languages.length > 0) {
          setCodingLanguages(languages);
          console.log(' Loaded coding languages:', languages);
        }
      } catch (error) {
        console.error('❌ Error fetching coding languages:', error);
        // Keep default languages if fetch fails
      } finally {
        setIsLoadingLanguages(false);
      }
    };

    fetchCodingLanguages();
  }, []); // Run once on mount

  const validateForm = (): { isValid: boolean; errors: {[key: string]: string} } => {
    const newErrors: {[key: string]: string} = {};

    if (!examDate) {
      newErrors.examDate = 'Exam date is required';
    } else {
      // Check if exam date is in the past
      const selectedDate = new Date(examDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
      
      if (selectedDate < today) {
        newErrors.examDate = 'Exam date cannot be in the past';
      }
    }
    if (!examTime) {
      newErrors.examTime = 'Exam time is required';
    }
    if (!maximumMarks || maximumMarks <= 0) {
      newErrors.maximumMarks = 'Maximum marks must be greater than 0';
    }
    if (!duration || duration <= 0) {
      newErrors.duration = 'Duration must be greater than 0';
    }
    
    if (!examType) {
      newErrors.examType = 'Exam type is required';
    }
    if (enrolledStudents.length === 0) {
      newErrors.enrolledStudents = 'Please add at least one student to the exam';
    }
  
    if (examMode === EXAM_MODES.OFFLINE) {
      if (questionPaperImages.length === 0) {
        newErrors.questionPaperImages = 'Please upload at least one question paper image';
      }
    } else if (examMode === EXAM_MODES.ONLINE) {
      if (questions.length === 0 && !enableQuestionPool) {
        newErrors.questions = 'Please add at least one question or enable question pool';
      } else {
        // Calculate total marks from regular questions
        const totalQuestionMarks = questions.reduce((sum, q) => sum + (q.maximumMarks || 0), 0);
        
        console.log('🔍 Validation Debug:');
        console.log('  Regular questions count:', questions.length);
        console.log('  Regular questions total marks:', totalQuestionMarks);
        console.log('  Pool enabled:', enableQuestionPool);
        console.log('  Pool questions count:', questionPool.length);
        console.log('  Pick random count:', pickRandomCount);
        console.log('  Pool question marks:', poolQuestionMarks);
        
        // Calculate total marks from pool questions
        let poolTotalMarks = 0;
        if (enableQuestionPool) {
          if (questionPool.length === 0) {
            newErrors.questionPool = 'Please add at least one question to the pool';
          }
          
          if (pickRandomCount <= 0) {
            newErrors.pickRandomCount = 'Please specify how many questions to pick from pool';
          } else if (pickRandomCount > questionPool.length) {
            newErrors.pickRandomCount = `Cannot pick ${pickRandomCount} questions from a pool of ${questionPool.length}`;
          }
          
          if (poolQuestionMarks <= 0) {
            newErrors.poolQuestionMarks = 'Please specify marks per pool question';
          }
          
          // Calculate pool total marks
          if (pickRandomCount > 0 && poolQuestionMarks > 0) {
            poolTotalMarks = pickRandomCount * poolQuestionMarks;
          }
        }
        
        console.log('  Pool total marks:', poolTotalMarks);
        
        // Validate that maximum marks matches total of all question marks (regular + pool)
        const grandTotalMarks = totalQuestionMarks + poolTotalMarks;
        
        console.log('  Grand total marks:', grandTotalMarks);
        console.log('  Maximum marks:', maximumMarks);
        console.log('  Match:', grandTotalMarks === maximumMarks);
        
        if (grandTotalMarks !== maximumMarks) {
          newErrors.maximumMarks = `Maximum marks (${maximumMarks}) must equal total marks (${grandTotalMarks})`;
          
          if (questions.length > 0 || enableQuestionPool) {
            newErrors.questions = `Total marks is ${grandTotalMarks}, but maximum marks is set to ${maximumMarks}`;
          }
        }
      }
    }

    setErrors(newErrors);
    return { 
      isValid: Object.keys(newErrors).length === 0, 
      errors: newErrors 
    };
  };

  // Validate if exam time conflicts with existing exams for the same class
  const validateExamTimeConflict = async (): Promise<{ hasConflict: boolean; conflictingExam?: any }> => {
    try {
      if (!activeCollegeId || !className || !examDate || !duration) {
        return { hasConflict: false };
      }

      // Parse the exam date and calculate end time
      const startDate = parseExamDate(examDate);
      if (!startDate) {
        console.error('Failed to parse exam date:', examDate);
        return { hasConflict: false };
      }

      // Include exam time if specified
      if (examTime) {
        const [hours, minutes] = examTime.split(':').map(Number);
        startDate.setHours(hours, minutes, 0, 0);
      } else {
        // If no time specified, set to start of day
        startDate.setHours(0, 0, 0, 0);
      }

      const durationMinutes = parseDurationToMinutes(duration);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      console.log(' Checking time conflicts for:', {
        class: className,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        duration: `${durationMinutes} minutes`
      });

      // Fetch all exams for the same college and class
      const allExams = await firebaseService.getExams(activeCollegeId, academicYear);
      
      // Filter exams for the same class (excluding the current exam if editing)
      const sameClassExams = allExams.filter(exam => 
        exam.class === className && 
        (!existingExam || exam.id !== existingExam.id)
      );

      console.log(' Found', sameClassExams.length, 'exams for class', className);

      // Check for time conflicts
      for (const exam of sameClassExams) {
        const existingStartDate = parseExamDate(exam.examDate);
        if (!existingStartDate) {
          console.warn('Failed to parse existing exam date:', exam.examDate);
          continue;
        }

        // Include exam time if specified
        if (exam.examTime) {
          const [hours, minutes] = exam.examTime.split(':').map(Number);
          existingStartDate.setHours(hours, minutes, 0, 0);
        } else {
          // If no time specified, set to start of day
          existingStartDate.setHours(0, 0, 0, 0);
        }

        const existingDurationMinutes = parseDurationToMinutes(exam.duration);
        const existingEndDate = new Date(existingStartDate.getTime() + existingDurationMinutes * 60000);

        // Check if time periods overlap
        if (checkTimeOverlap(startDate, endDate, existingStartDate, existingEndDate)) {
          console.error(' Time conflict detected with exam:', exam.title);
          return { 
            hasConflict: true, 
            conflictingExam: exam 
          };
        }
      }

      console.log(' No time conflicts found');
      return { hasConflict: false };

    } catch (error) {
      console.error('Error validating exam time conflict:', error);
      return { hasConflict: false };
    }
  };

  const handleSave = async () => {
    setShowErrors(true);
    
    const validation = validateForm();
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      showAlert('error', 'Validation Error', firstError);
      return;
    }

    if (!activeCollegeId || !activeCollegeName) {
      showAlert('error', 'Missing Information', 'College information is missing. Please try again.');
      return;
    }

    // Validate exam time conflicts (only for new exams or if date/time changed)
    const timeConflictCheck = await validateExamTimeConflict();
    if (timeConflictCheck.hasConflict && timeConflictCheck.conflictingExam) {
      const conflictingExam = timeConflictCheck.conflictingExam;
      const conflictMessage = `Class ${className} already has an exam scheduled at this time:\n\n` +
        `📚 ${conflictingExam.title}\n\n` +
        `📅 ${conflictingExam.examDate}\n\n` +
        `⏱️ Duration: ${conflictingExam.duration}\n\n` +
        `Please choose a different date or time.`;
      
      showAlert('error', 'Schedule Conflict', conflictMessage);
      return;
    }

    try {
      setIsSaving(true);

      // Generate title: "Exam Type, Mon-YYYY (Label)" 
      const monthYear = examDate 
        ? new Date(examDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-')
        : '';
      const labelPart = examLabel && examLabel.length >= 6 ? ` (${examLabel})` : '';
      const generatedTitle = `${examType}${monthYear ? `, ${monthYear}` : ''}${labelPart}`;

      console.log('📋 Exam save debug:', { board, activeCollegeId, examType, academicYear });

      const examData: Partial<ExamModel> = {
        type: examType,
        typeColor: getExamTypeColor(examType),
        year: academicYear,
        title: generatedTitle,
        board: board || activeCollegeId || '',
        status: 'upcoming',
        mode: examMode,
        examDate: examDate,
        examTime: examTime,
        duration: duration.toString(),
        totalQuestions: examMode === EXAM_MODES.OFFLINE ? 0 : questions.length + pickRandomCount,
        maxMarks: maximumMarks.toString(),
        totalStudents: enrolledStudents.length,
        enrolledClasses: enrolledClassesList,
        collegeId: activeCollegeId,
        collegeName: activeCollegeName
      };

      if (examMode === EXAM_MODES.ONLINE) {
        examData.securityLevel = securityLevel;
        examData.attendance = attendance;
        examData.avProctoring = avProctoring;
        examData.completionPolicy = completionPolicy; // 'strict' or 'flexible'
        // Keep field names consistent - no transformation needed
        examData.questionsList = questions.map((q, index) => {
          // Base question structure - use frontend field names consistently
          const questionData: any = {
            id: q.id,
            questionNo: index + 1,
            type: q.type,  // Keep as 'mcq', 'fillInTheBlank', etc.
            questionText: cleanEmptyTags(q.questionText),  // Clean empty tags before saving
            marks: q.marks || q.maximumMarks,
            maximumMarks: q.maximumMarks || q.marks,
            complexity: q.complexity || COMPLEXITY_LEVELS.MEDIUM,
            board: q.board,
            chapter: q.chapter,
            subject: q.subject,
            class: q.class || 'Generic',
            source: q.source || 'custom',
            hint: cleanEmptyTags(q.hint),        // Clean empty tags before saving
            solution: cleanEmptyTags(q.solution)  // Clean empty tags before saving
          };

          // Copy optional fields
          if (q.createdByName) questionData.createdByName = q.createdByName;
          if (q.createdAt) questionData.createdAt = q.createdAt;
          if (typeof q.isProprietaryQuestion === 'boolean') questionData.isProprietaryQuestion = q.isProprietaryQuestion;
          if (q.questionBankId) questionData.questionBankId = q.questionBankId;

          // Image URLs (common to all question types)
          if (q.imageUrls && Array.isArray(q.imageUrls) && q.imageUrls.length > 0) {
            questionData.imageUrls = q.imageUrls;
          }

          // Type-specific fields
          if (q.type === QUESTION_TYPES.MCQ) {
            questionData.options = q.options;
            questionData.correctAnswers = q.correctAnswers;
          } else if (q.type === QUESTION_TYPES.FITB) {
            questionData.correctAnswers = q.correctAnswers;
          } else if (q.type === QUESTION_TYPES.JUMBLED) {
            questionData.correctAnswers = q.correctAnswers;
            // Create shuffled options if not present
            if (q.correctAnswers && !(q as any).jumbledOptions) {
              const shuffled = [...q.correctAnswers];
              for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
              }
              questionData.jumbledOptions = shuffled;
            } else {
              questionData.jumbledOptions = (q as any).jumbledOptions;
            }
          } else if (q.type === QUESTION_TYPES.CODE) {
            questionData.programmingLanguage = q.programmingLanguage || q.programming_language;
            questionData.testStub = q.testStub;
            if ((q as any).starter_codes) questionData.starter_codes = (q as any).starter_codes;
            questionData.testCases = q.testCases;
          } else if (q.type === QUESTION_TYPES.SQL) {
            questionData.sqlSchema = (q as any).sqlSchema;
            questionData.sqlTestCases = ((q as any).sqlTestCases || []).map((tc: any) => ({
              title: tc.title || '',
              marks: tc.marks || 0,
              table_data: JSON.stringify(tc.table_data || {}),
              expected_output: JSON.stringify(tc.expected_output || { columns: [], rows: [] })
            }));
          }

          return questionData;
        });
        
        // Add question pool data if enabled
        if (enableQuestionPool) {
          (examData as any).questionPool = questionPool.map((q, index) => {
            const questionData: any = {
              id: q.id,
              questionNo: index + 1,
              type: q.type,
              questionText: cleanEmptyTags(q.questionText),
              marks: q.marks || q.maximumMarks,
              maximumMarks: q.maximumMarks || q.marks,
              complexity: q.complexity || COMPLEXITY_LEVELS.MEDIUM,
              board: q.board,
              chapter: q.chapter,
              subject: q.subject,
              class: q.class || 'Generic',
              source: q.source || 'custom',
              hint: cleanEmptyTags(q.hint),
              solution: cleanEmptyTags(q.solution)
            };

            if (q.createdByName) questionData.createdByName = q.createdByName;
            if (q.createdAt) questionData.createdAt = q.createdAt;
            if (typeof q.isProprietaryQuestion === 'boolean') questionData.isProprietaryQuestion = q.isProprietaryQuestion;
            if (q.questionBankId) questionData.questionBankId = q.questionBankId;

            if (q.imageUrls && Array.isArray(q.imageUrls) && q.imageUrls.length > 0) {
              questionData.imageUrls = q.imageUrls;
            }

            if (q.type === QUESTION_TYPES.MCQ) {
              questionData.options = q.options;
              questionData.correctAnswers = q.correctAnswers;
            } else if (q.type === QUESTION_TYPES.FITB) {
              questionData.correctAnswers = q.correctAnswers;
            } else if (q.type === QUESTION_TYPES.JUMBLED) {
              questionData.correctAnswers = q.correctAnswers;
              // Create shuffled options if not present
              if (q.correctAnswers && !(q as any).jumbledOptions) {
                const shuffled = [...q.correctAnswers];
                for (let i = shuffled.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                questionData.jumbledOptions = shuffled;
              } else {
                questionData.jumbledOptions = (q as any).jumbledOptions;
              }
            } else if (q.type === QUESTION_TYPES.CODE) {
              questionData.programmingLanguage = q.programmingLanguage || q.programming_language;
              questionData.testCases = q.testCases;
              questionData.testStub = q.testStub;
              if ((q as any).starter_codes) questionData.starter_codes = (q as any).starter_codes;
            } else if (q.type === QUESTION_TYPES.SQL) {
              questionData.sqlSchema = (q as any).sqlSchema;
              questionData.sqlTestCases = ((q as any).sqlTestCases || []).map((tc: any) => ({
                title: tc.title || '',
                marks: tc.marks || 0,
                table_data: JSON.stringify(tc.table_data || {}),
                expected_output: JSON.stringify(tc.expected_output || { columns: [], rows: [] })
              }));
            }

            return questionData;
          });
          (examData as any).enableQuestionPool = true;
          (examData as any).pickRandomCount = pickRandomCount;
          (examData as any).poolQuestionMarks = poolQuestionMarks;
        }
      } else {
        examData.questionPaperImages = questionPaperImages;
      }

      // Remove undefined values and empty arrays to prevent Firebase errors
      const cleanExamData = Object.fromEntries(
        Object.entries(examData).filter(([_, value]) => value !== undefined && value !== null)
      );

      let savedExamId: string | null;
      
      if (existingExam?.id) {
        const success = await firebaseService.updateExam(existingExam.id, cleanExamData, currentUser);
        savedExamId = success ? existingExam.id : null;
      } else {
        savedExamId = await firebaseService.createExam(cleanExamData, currentUser);
      }

      if (savedExamId) {
        // Enroll students in exam_enrollments collection
        if (enrolledStudents.length > 0) {
          // For edit: remove all existing enrollments first, then re-enroll
          if (existingExam?.id) {
            const existingEnrolledIds = await firebaseService.getExamEnrolledStudentIds(existingExam.id);
            if (existingEnrolledIds.size > 0) {
              await firebaseService.removeStudentsFromExam(existingExam.id, Array.from(existingEnrolledIds));
            }
          }
          
          const enrollResult = await firebaseService.enrollStudentsInExam(
            savedExamId,
            enrolledStudents,
            activeCollegeId!,
            currentUser.userId
          );
          console.log(`✅ Enrolled ${enrollResult.enrolledCount} students`);
        }
        
        const savedExam = await firebaseService.getExamById(savedExamId);
        if (savedExam) {
          onSave(savedExam);
        }
        showAlert('success', 'Success!', existingExam ? 'Exam updated successfully!' : 'Exam created successfully!', true);
      } else {
        throw new Error('Failed to save exam');
      }

    } catch (error) {
      console.error('Error saving exam:', error);
      showAlert('error', 'Error', 'Failed to save exam. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setQuestionPaperImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setQuestionPaperImages(prev => prev.filter((_, i) => i !== index));
  };

  const openCustomQuestionModal = () => {
    resetCustomQuestionForm();
    setShowStarterCodeHelp(false);
    setShowCustomQuestionModal(true);
  };

  const addQuestion = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setCurrentPage(1);
    setQbPageDocs(new Map());
    setSelectedQuestionIds(new Set());
    setSelectedQuestionsMap(new Map());
    setExpandedQuestionId(null);
    setQuestionTypeFilter(FILTER_VALUES.ALL);
    setComplexityFilter(FILTER_VALUES.ALL);
    setShowQuestionBankModal(true);
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleCustomQuestionImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these images would exceed the limit
    const totalImages = customQuestionImageUrls.length + files.length;
    if (totalImages > 5) {
      showAlert('error', 'Too Many Images', `You can only upload a maximum of 5 images. You currently have ${customQuestionImageUrls.length} image(s).`);
      if (customQuestionImageInputRef.current) {
        customQuestionImageInputRef.current.value = '';
      }
      return;
    }

    setIsUploadingCustomQuestionImage(true);

    try {
      const validFiles: File[] = [];

      // Validate each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file type
        if (!file.type.startsWith('image/')) {
          showAlert('error', 'Invalid File Type', `"${file.name}" is not an image file. Please upload only images.`);
          setIsUploadingCustomQuestionImage(false);
          if (customQuestionImageInputRef.current) {
            customQuestionImageInputRef.current.value = '';
          }
          return;
        }

        // Check file size (10MB = 10 * 1024 * 1024 bytes)
        if (file.size > 10 * 1024 * 1024) {
          showAlert('error', 'File Too Large', `Image "${file.name}" is larger than 10MB. Please compress it or choose a smaller image.`);
          setIsUploadingCustomQuestionImage(false);
          if (customQuestionImageInputRef.current) {
            customQuestionImageInputRef.current.value = '';
          }
          return;
        }

        validFiles.push(file);
      }

      // Upload all valid files
      const uploadPromises = validFiles.map(file =>
        firebaseService.uploadQuestionImage(activeCollegeId!, file)
      );

      const imageUrls = await Promise.all(uploadPromises);

      // Add new URLs to existing array
      setCustomQuestionImageUrls(prev => [...prev, ...imageUrls]);

      console.log(`✅ ${imageUrls.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error('Error uploading images:', error);
      showAlert('error', 'Upload Failed', 'Failed to upload images. Please try again.');
    } finally {
      setIsUploadingCustomQuestionImage(false);
      // Reset the input
      if (customQuestionImageInputRef.current) {
        customQuestionImageInputRef.current.value = '';
      }
    }
  };

  const removeCustomQuestionImage = (index: number) => {
    setCustomQuestionImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const resetCustomQuestionForm = () => {
    setCustomQuestionType(QUESTION_TYPES.DESCRIPTIVE);
    setCustomQuestionText('');
    setCustomQuestionMarks(1);
    setCustomQuestionComplexity(COMPLEXITY_LEVELS.MEDIUM);
    setCustomQuestionChapter('');
    setCustomQuestionSubject('');
    setCustomQuestionOptions(['', '', '', '']);
    setCustomQuestionCorrectAnswers([]);
    setCustomQuestionBlanks(['']);
    setCustomQuestionSequence(['', '', '', '']);
    setCustomQuestionHint('');
    setCustomQuestionSolution('');
    setCustomQuestionProgrammingLanguage('Python');
    setCustomQuestionTestCases([{ input: '', expected_output: '', marks: 0 }]);
    setCustomQuestionTestStub('');
    setCustomStarterCodes([{ language: 'python', code: '' }]);
    setCustomQuestionImageUrls([]);
    setCustomSqlSchema([{ table_name: '', columns: [{ name: '', type: 'int', description: '', constraints: '' }], primary_key: '', note: '' }]);
    setCustomSqlTestCases([{ title: 'Test Case 1', table_data: {}, expected_output: { columns: [''], rows: [['']] }, marks: 0 }]);
    setEditingQuestionIndex(null);
  };

  // Helper function to remove empty HTML tags (except <pre> which is handled by CSS)
  const cleanEmptyTags = (html: string | undefined): string => {
    if (!html) return '';
    
    console.log('🧹 cleanEmptyTags INPUT:', html);
    console.log('🧹 Has data-latex in input?', html.includes('data-latex'));
    
    let cleaned = html;
    let previousCleaned = '';
    let iterations = 0;
    const maxIterations = 10;
    
    // Keep cleaning until no more changes (handles nested empty tags)
    while (previousCleaned !== cleaned && iterations < maxIterations) {
      previousCleaned = cleaned;
      iterations++;
      
      // Note: Empty <pre></pre> tags are now handled by CSS ([&>pre:empty]:hidden)
      // So we don't need to remove them here
      
      // Remove empty <p></p> tags (with optional whitespace, br, and attributes)
      cleaned = cleaned.replace(/<p[^>]*>([\s\n\r]|<br\s*\/?>|&nbsp;)*<\/p>/gi, '');
      
      // Remove empty <div></div> tags
      cleaned = cleaned.replace(/<div[^>]*>[\s\n\r]*<\/div>/gi, '');
      
      // Remove empty <span></span> tags (but keep math formulas)
      // Math formulas have data-latex attribute or class="math-inline-node"
      console.log('🧹 Before span removal, has data-latex?', cleaned.includes('data-latex'));
      cleaned = cleaned.replace(/<span(?![^>]*(?:data-latex|class=["'][^"']*math[^"']*["']))[^>]*>[\s\n\r]*<\/span>/gi, '');
      console.log('🧹 After span removal, has data-latex?', cleaned.includes('data-latex'));
      
      // Remove empty <h1> to <h6> tags
      cleaned = cleaned.replace(/<h[1-6][^>]*>[\s\n\r]*<\/h[1-6]>/gi, '');
      
      // Remove multiple consecutive line breaks
      cleaned = cleaned.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');
    }
    
    // Final pass - remove common empty patterns
    cleaned = cleaned.replace(/<p><\/p>/g, '');
    
    // Trim whitespace
    const result = cleaned.trim();
    
    console.log('🧹 cleanEmptyTags OUTPUT:', result);
    console.log('🧹 Has data-latex in output?', result.includes('data-latex'));
    
    return result;
  };

  const handleEditQuestion = (index: number) => {
    const question = questions[index];
    
    // Helper function to convert backticks and code tags to proper format for RichTextEditor
    const convertToProperCodeFormat = (text: string | undefined): string => {
      if (!text) return '';
      
      // Step 1: Convert triple backticks to <pre><code>
      text = text.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
      
      // Step 2: Convert standalone <code> tags (not already in <pre>) to <pre><code>
      // This handles code blocks that are already in <code> but missing <pre>
      text = text.replace(/<code>([^<]+(?:<\/?\w+[^>]*>[^<]*)*)<\/code>/g, (match, content) => {
        // Only process if content is not empty
        if (!content || content.trim() === '') {
          return match;
        }
        // Check if it's already inside a <pre> tag
        if (text && text.indexOf('<pre>' + match) === -1 && text.indexOf('<pre><code>') === -1) {
          // If content has newlines or is long, wrap in <pre>
          if (content.includes('\n') || content.length > 50) {
            return '<pre><code>' + content + '</code></pre>';
          }
        }
        return match; // Keep as-is if inline code or already in pre
      });
      
      // Step 3: Convert single backticks to inline <code> (for short inline code)
      text = text.replace(/`([^`\n]+)`/g, (match, content) => {
        // Only convert if content is not empty
        return content && content.trim() ? '<code>' + content + '</code>' : match;
      });
      
      // Step 4: Remove any empty <pre><code></code></pre> or <pre></pre> tags
      text = text.replace(/<pre>\s*<code>\s*<\/code>\s*<\/pre>/g, '');
      text = text.replace(/<pre>\s*<\/pre>/g, '');
      
      return text;
    };
    
    setShowCustomQuestionModal(true);
    setEditingQuestionIndex(index);
    
    // Pre-fill the form with question data (converting to proper code format)
    setCustomQuestionType(question.type);
    
    const convertedQuestionText = convertToProperCodeFormat(question.questionText);
    
    setCustomQuestionText(convertedQuestionText);
    setCustomQuestionMarks(question.maximumMarks);
    setCustomQuestionComplexity((question.complexity || COMPLEXITY_LEVELS.MEDIUM) as ComplexityLevel);
    setCustomQuestionChapter(question.chapter || '')
    setCustomQuestionSubject(question.subject || '');
    
    if (question.type === QUESTION_TYPES.MCQ) {
      setCustomQuestionOptions(question.options || ['', '', '', '']);
      setCustomQuestionCorrectAnswers(question.correctAnswers || []);
    } else if (question.type === QUESTION_TYPES.FITB) {
      setCustomQuestionBlanks(question.correctAnswers || ['']);
    } else if (question.type === QUESTION_TYPES.JUMBLED) {
       setCustomQuestionSequence(question.correctAnswers || ['', '', '', '']);
    } else if (question.type === QUESTION_TYPES.CODE) {
      setCustomQuestionProgrammingLanguage(question.programmingLanguage || question.programming_language || 'Python');
      setCustomQuestionTestCases(question.testCases || [{ input: '', expected_output: '', marks: 0 }]);
      setCustomQuestionTestStub(question.testStub || '');
      setCustomStarterCodes((question as any).starter_codes || [{ language: question.programmingLanguage?.toLowerCase() || 'python', code: question.testStub || '' }]);
      setCustomStarterCodes((question as any).starter_codes || [{ language: question.programmingLanguage?.toLowerCase() || 'python', code: question.testStub || '' }]);
    } else if (question.type === QUESTION_TYPES.SQL) {
      setCustomSqlSchema((question as any).sqlSchema || [{ table_name: '', columns: [{ name: '', type: 'int', description: '', constraints: '' }], primary_key: '', note: '' }]);
      setCustomSqlTestCases((question as any).sqlTestCases || [{ title: 'Test Case 1', table_data: {}, expected_output: { columns: [''], rows: [['']] }, marks: 0 }]);
    }
    
    setCustomQuestionHint(convertToProperCodeFormat(question.hint));
    setCustomQuestionSolution(convertToProperCodeFormat(question.solution));
    setCustomQuestionImageUrls(question.imageUrls || []);
    
    setEditingQuestionIndex(index);
    setIsEditingFromPool(false);
    setShowCustomQuestionModal(true);
  };

  const handleEditPoolQuestion = (index: number) => {
    const question = questionPool[index];
    
    // Helper function to convert backticks and code tags to proper format for RichTextEditor
    const convertToProperCodeFormat = (text: string | undefined): string => {
      if (!text) return '';
      
      // Step 1: Convert triple backticks to <pre><code>
      text = text.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
      
      // Step 2: Convert standalone <code> tags (not already in <pre>) to <pre><code>
      text = text.replace(/<code>([^<]+(?:<\/?\w+[^>]*>[^<]*)*)<\/code>/g, (match, content) => {
        if (!content || content.trim() === '') {
          return match;
        }
        if (text && text.indexOf('<pre>' + match) === -1 && text.indexOf('<pre><code>') === -1) {
          if (content.includes('\n') || content.length > 50) {
            return '<pre><code>' + content + '</code></pre>';
          }
        }
        return match;
      });
      
      // Step 3: Convert single backticks to inline <code>
      text = text.replace(/`([^`\n]+)`/g, (match, content) => {
        return content && content.trim() ? '<code>' + content + '</code>' : match;
      });
      
      // Step 4: Remove any empty <pre><code></code></pre> or <pre></pre> tags
      text = text.replace(/<pre>\s*<code>\s*<\/code>\s*<\/pre>/g, '');
      text = text.replace(/<pre>\s*<\/pre>/g, '');
      
      return text;
    };
    
    setShowCustomQuestionModal(true);
    setEditingQuestionIndex(index);
    setIsEditingFromPool(true);
    
    // Pre-fill the form with question data
    setCustomQuestionType(question.type);
    
    const convertedQuestionText = convertToProperCodeFormat(question.questionText);
    
    setCustomQuestionText(convertedQuestionText);
    setCustomQuestionMarks(question.maximumMarks);
    setCustomQuestionComplexity((question.complexity || COMPLEXITY_LEVELS.MEDIUM) as ComplexityLevel);
    setCustomQuestionChapter(question.chapter || '')
    setCustomQuestionSubject(question.subject || '');
    
    if (question.type === QUESTION_TYPES.MCQ) {
      setCustomQuestionOptions(question.options || ['', '', '', '']);
      setCustomQuestionCorrectAnswers(question.correctAnswers || []);
    } else if (question.type === QUESTION_TYPES.FITB) {
      setCustomQuestionBlanks(question.correctAnswers || ['']);
    } else if (question.type === QUESTION_TYPES.JUMBLED) {
       setCustomQuestionSequence(question.correctAnswers || ['', '', '', '']);
    } else if (question.type === QUESTION_TYPES.CODE) {
      setCustomQuestionProgrammingLanguage(question.programmingLanguage || question.programming_language || '');
      setCustomQuestionTestCases(question.testCases || []);
      setCustomQuestionTestStub(question.testStub || '');
    } else if (question.type === QUESTION_TYPES.SQL) {
      setCustomSqlSchema((question as any).sqlSchema || [{ table_name: '', columns: [{ name: '', type: 'int', description: '', constraints: '' }], primary_key: '', note: '' }]);
      setCustomSqlTestCases((question as any).sqlTestCases || [{ title: 'Test Case 1', table_data: {}, expected_output: { columns: [''], rows: [['']] }, marks: 0 }]);
    }
    
    const convertedHint = convertToProperCodeFormat(question.hint);
    const convertedSolution = convertToProperCodeFormat(question.solution);
    
    setCustomQuestionHint(convertedHint || '');
    setCustomQuestionSolution(convertedSolution || '');
    setCustomQuestionImageUrls(question.imageUrls || []);
    
    setEditingQuestionIndex(index);
    setShowCustomQuestionModal(true);
  };

  const handleCreateCustomQuestion = () => {
    // Validate custom question
    const cleanedQuestionText = cleanEmptyTags(customQuestionText);
    if (!cleanedQuestionText.trim()) {
      showAlert('error', 'Validation Error', 'Please enter question text');
      return;
    }

    if (!customQuestionSubject.trim()) {
      showAlert('error', 'Validation Error', 'Please select a subject');
      return;
    }

    if (!customQuestionChapter.trim()) {
      alert('Please enter a chapter name');
      return;
    }

    if (customQuestionMarks <= 0) {
      showAlert('error', 'Validation Error', 'Marks must be greater than 0');
      return;
    }

    if (customQuestionType === QUESTION_TYPES.MCQ) {
      const filledOptions = customQuestionOptions.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2) {
        showAlert('error', 'Validation Error', 'Please provide at least 2 options for MCQ');
        return;
      }
      if (customQuestionCorrectAnswers.length === 0) {
        showAlert('error', 'Validation Error', 'Please select at least one correct answer');
        return;
      }
    }

    if (customQuestionType === QUESTION_TYPES.FITB) {
      const filledBlanks = customQuestionBlanks.filter(blank => blank.trim() !== '');
      if (filledBlanks.length === 0) {
        showAlert('error', 'Validation Error', 'Please provide at least one blank answer');
        return;
      }
    }

    if (customQuestionType === QUESTION_TYPES.JUMBLED) {
      const filledSequence = customQuestionSequence.filter(item => item.trim() !== '');
      if (filledSequence.length < 2) {
        showAlert('error', 'Validation Error', 'Please provide at least 2 items for jumbled quiz');
        return;
      }
    }

    if (customQuestionType === QUESTION_TYPES.CODE) {
      if (!customQuestionProgrammingLanguage) {
        showAlert('error', 'Validation Error', 'Please select a programming language');
        return;
      }
      if (!customQuestionTestStub || !customQuestionTestStub.trim()) {
        // Check if any starter code has content
        const hasCode = customStarterCodes.some(sc => sc.code.trim());
        if (!hasCode) {
          showAlert('error', 'Validation Error', 'Please provide starter code');
          return;
        }
      }
      if (!customQuestionTestCases || customQuestionTestCases.length === 0) {
        showAlert('error', 'Validation Error', 'Please add at least one test case');
        return;
      }
      if (customQuestionTestCases.some(tc => !tc.input.trim() || !tc.expected_output?.trim())) {
        showAlert('error', 'Validation Error', 'All test cases must have both input and expected output');
        return;
      }
    }

    if (customQuestionType === QUESTION_TYPES.SQL) {
      if (!customSqlSchema || customSqlSchema.length === 0 || !customSqlSchema.some(t => t.table_name.trim())) {
        showAlert('error', 'Validation Error', 'Please define at least one table with a name in the schema');
        return;
      }
      if (customSqlSchema.some(t => t.table_name.trim() && !t.columns.some(c => c.name.trim()))) {
        showAlert('error', 'Validation Error', 'Each table must have at least one named column');
        return;
      }
      if (!customSqlTestCases || customSqlTestCases.length === 0) {
        showAlert('error', 'Validation Error', 'Please add at least one test case');
        return;
      }
      if (customSqlTestCases.some(tc => tc.expected_output.columns.length === 0 || tc.expected_output.columns.some(c => !c.trim()))) {
        showAlert('error', 'Validation Error', 'All test cases must have named expected output columns');
        return;
      }
    }

    // Create the question object
      console.log('💾 Creating question with customQuestionText:', customQuestionText);
      console.log('💾 Has data-latex attribute?', customQuestionText.includes('data-latex'));
      console.log('💾 Has data-type="math"?', customQuestionText.includes('data-type="math"'));
      
      const cleanedText = cleanEmptyTags(customQuestionText);
      console.log('💾 After cleanEmptyTags:', cleanedText);
      console.log('💾 Still has data-latex?', cleanedText.includes('data-latex'));
      
      const newQuestion: Question = {
      id: `custom_${Date.now()}`,
      type: customQuestionType,
      questionText: cleanedText,
      maximumMarks: customQuestionMarks,
      marks: customQuestionMarks,
      complexity: customQuestionComplexity,
      chapter: customQuestionChapter || undefined,
      subject: customQuestionSubject || undefined,
      class: 'Generic',
      board: board,
      createdByName: currentUser.fullName,
      createdAt: new Date().toISOString(),
      source: 'custom' as const,
      questionBankId: undefined
    };

    if (customQuestionType === QUESTION_TYPES.MCQ) {
      newQuestion.options = customQuestionOptions.filter(opt => opt.trim() !== '');
      newQuestion.correctAnswers = customQuestionCorrectAnswers;
    } else if (customQuestionType === QUESTION_TYPES.FITB) {
      const filteredBlanks = customQuestionBlanks.filter(blank => blank.trim() !== '');
      newQuestion.correctAnswers = filteredBlanks;
    } else if (customQuestionType === QUESTION_TYPES.JUMBLED) {
      newQuestion.correctAnswers = customQuestionSequence.filter(item => item.trim() !== '');
    } else if (customQuestionType === QUESTION_TYPES.CODE) {
      newQuestion.programmingLanguage = customStarterCodes[0]?.language || 'python';
      newQuestion.testCases = customQuestionTestCases;
      newQuestion.testStub = customStarterCodes[0]?.code || customQuestionTestStub;
      (newQuestion as any).starter_codes = customStarterCodes;
    } else if (customQuestionType === QUESTION_TYPES.SQL) {
      (newQuestion as any).sqlSchema = customSqlSchema;
      (newQuestion as any).sqlTestCases = customSqlTestCases;
    }

    // Add hint and solution if provided (clean empty tags before saving)
    const cleanedHint = cleanEmptyTags(customQuestionHint.trim());
    const cleanedSolution = cleanEmptyTags(customQuestionSolution.trim());
    
    if (cleanedHint) {
      newQuestion.hint = cleanedHint;
    }
    if (cleanedSolution) {
      newQuestion.solution = cleanedSolution;
    }
    
    // Add image URLs
    if (customQuestionImageUrls.length > 0) {
      newQuestion.imageUrls = customQuestionImageUrls;
    }

    // Add to questions list or update existing question
    if (editingQuestionIndex !== null) {
      // Update existing question
      if (isEditingFromPool) {
        // Update in pool
        const updatedPool = [...questionPool];
        updatedPool[editingQuestionIndex] = {
          ...updatedPool[editingQuestionIndex],
          ...newQuestion,
          // Preserve the original ID
          id: updatedPool[editingQuestionIndex].id,
          // Mark as custom when edited
          source: 'custom',
          questionBankId: undefined
        };
        setQuestionPool(updatedPool);
        showAlert('success', 'Question Updated!', 'Pool question has been updated successfully.');
      } else {
        // Update in main questions
        const updatedQuestions = [...questions];
        updatedQuestions[editingQuestionIndex] = {
          ...updatedQuestions[editingQuestionIndex],
          ...newQuestion,
          // Preserve the original ID
          id: updatedQuestions[editingQuestionIndex].id,
          // Mark as custom when edited, even if from question bank
          source: 'custom',
          // Remove question bank reference since it's been edited
          questionBankId: undefined
        };
        setQuestions(updatedQuestions);
        showAlert('success', 'Question Updated!', 'Your changes have been saved successfully.');
      }
    } else {
      // Add new question to either pool or main list
      if (isAddingToPool) {
        setQuestionPool([...questionPool, newQuestion]);
        showAlert('success', 'Question Added!', 'Custom question has been added to the pool successfully.');
      } else {
        setQuestions([...questions, newQuestion]);
        showAlert('success', 'Question Added!', 'Custom question has been added to the exam successfully.');
      }
    }
    
    setShowCustomQuestionModal(false);
    resetCustomQuestionForm();
    setIsAddingToPool(false); // Reset the flag
    setIsEditingFromPool(false); // Reset the flag
    
    // Auto-close alert after 2.5 seconds
    setTimeout(() => {
      closeAlert();
    }, 2500);
  };

  // Fetch available chapters for the selected class and subject
  const fetchAvailableChapters = async () => {
    if (!activeCollegeId || !className || !subject) {
      setAvailableChapters([]);
      return;
    }

    try {
      const chapters = await firebaseService.getChaptersForSubject(
        activeCollegeId,
        className,
        subject
      );
      setAvailableChapters(chapters || []);
      console.log('📚 Loaded chapters:', chapters);
    } catch (error) {
      console.error('❌ Error fetching chapters:', error);
      setAvailableChapters([]);
    }
  };

  const fetchAvailableTags = async () => {
    if (!activeCollegeId) {
      setAvailableTags([]);
      return;
    }

    try {
      // Fetch all questions to extract tags (pass className/subject if set, undefined if not)
      const result = await firebaseService.getQuestionsPaginated(
        activeCollegeId,
        className || undefined,
        undefined, // board
        subject || undefined,
        undefined, // question type
        'all', // proprietary
        1000, // Get many questions to collect all tags
        1,
        undefined, // search
        undefined, // complexity
        undefined  // chapter
      );

      // Extract unique tags from all questions
      const tagsSet = new Set<string>();
      result.questions.forEach((question: any) => {
        if (question.tags && Array.isArray(question.tags)) {
          question.tags.forEach((tag: string) => {
            if (tag && tag.trim()) {
              tagsSet.add(tag.trim());
            }
          });
        }
      });

      const tags = Array.from(tagsSet).sort();
      setAvailableTags(tags);
      console.log('🏷️ Loaded tags:', tags);
    } catch (error) {
      console.error('❌ Error fetching tags:', error);
      setAvailableTags([]);
    }
  };

  const fetchQuestionBankItems = async () => {
    if (!activeCollegeId) {
      console.log('❌ Missing required data for question bank fetch:', {
        collegeId: activeCollegeId
      });
      return;
    }

    try {
      setIsLoadingQuestionBank(true);
      
      const trimmedSearch = debouncedSearchQuery?.trim() || '';
      const searchQueryToSend = trimmedSearch.length >= 2 ? trimmedSearch : undefined;
      const actualQuestionType = getActualQuestionType(questionTypeFilter);
      
      // Get lastDoc for cursor-based pagination (page 1 = null)
      const lastDocForPage = currentPage > 1 ? qbPageDocs.get(currentPage - 1) : null;

      const result = await firebaseService.getQuestionsPaginated(
        activeCollegeId,
        className || undefined,
        undefined, // board - show all
        subject || undefined,
        actualQuestionType as any,
        proprietaryFilter, // Public/Private filter
        questionsPerPage,
        currentPage,
        searchQueryToSend,
        complexityFilter !== 'all' ? complexityFilter : undefined,
        chapterFilter !== 'all' ? chapterFilter : undefined,
        tagFilter !== 'all' ? tagFilter : undefined,
        lastDocForPage
      );

      console.log(`✅ Fetched ${result.questions.length} of ${result.total} questions from Question Bank`);
      
      // Store lastDoc for this page (for next page navigation)
      if (result.lastDoc) {
        setQbPageDocs(prev => {
          const newMap = new Map(prev);
          newMap.set(currentPage, result.lastDoc);
          return newMap;
        });
      }
      
      setQuestionBankItems(result.questions);
      setTotalQuestionBankItems(result.total);
    } catch (error) {
      console.error('❌ Error fetching question bank:', error);
      setQuestionBankItems([]);
      setTotalQuestionBankItems(0);
    } finally {
      setIsLoadingQuestionBank(false);
    }
  };

  useEffect(() => {
    if (showQuestionBankModal && activeCollegeId) {
      fetchQuestionBankItems();
    }
  }, [showQuestionBankModal, currentPage, debouncedSearchQuery, className, subject, activeCollegeId, questionTypeFilter, complexityFilter, chapterFilter, tagFilter, proprietaryFilter]);

  // Fetch available chapters when modal opens or class/subject changes
  useEffect(() => {
    if (showQuestionBankModal && activeCollegeId) {
      fetchAvailableTags();
      // Reset tag filter when class or subject changes
      setTagFilter(FILTER_VALUES.ALL);
      
      // Chapters need class + subject
      if (className && subject) {
        fetchAvailableChapters();
        setChapterFilter(FILTER_VALUES.ALL);
      } else {
        setAvailableChapters([]);
        setChapterFilter(FILTER_VALUES.ALL);
      }
    }
  }, [showQuestionBankModal, activeCollegeId, className, subject]);

  // Fetch available chapters when custom question modal opens
  useEffect(() => {
    if (showCustomQuestionModal && activeCollegeId && className && subject) {
      fetchAvailableChapters();
    }
  }, [showCustomQuestionModal, activeCollegeId, className, subject]);

  useEffect(() => {
    if (showQuestionBankModal && currentPage !== 1) {
      setCurrentPage(1);
      setQbPageDocs(new Map());
    }
  }, [className, subject, questionTypeFilter, complexityFilter, chapterFilter, tagFilter, debouncedSearchQuery]);

  // Student search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudentSearch(studentSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearchQuery]);

  // Fetch available students when student modal opens or filters change
  useEffect(() => {
    const fetchStudents = async () => {
      if (!showStudentModal || !activeCollegeId) return;
      
      setIsLoadingStudents(true);
      try {
        let students: UserModel[];
        if (studentClassFilter && studentClassFilter !== 'all') {
          students = await firebaseService.getStudentsByClass(studentClassFilter, activeCollegeId);
        } else {
          students = await firebaseService.getUsersByType('student', activeCollegeId);
        }
        
        // Filter by search query
        if (debouncedStudentSearch.trim()) {
          const searchLower = debouncedStudentSearch.toLowerCase();
          students = students.filter(s => 
            s.fullName?.toLowerCase().includes(searchLower) ||
            s.email?.toLowerCase().includes(searchLower) ||
            s.studentRoll?.toLowerCase().includes(searchLower)
          );
        }
        
        setAvailableStudents(students);
        setStudentModalPage(1);
        console.log(`✅ Loaded ${students.length} students`);
      } catch (error) {
        console.error('❌ Error fetching students:', error);
        setAvailableStudents([]);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [showStudentModal, activeCollegeId, studentClassFilter, debouncedStudentSearch]);

  // Toggle student selection
  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudentIds);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudentIds(newSelection);
  };

  // Select all visible students
  const toggleSelectAllStudents = () => {
    const pageStudents = paginatedStudents;
    const allSelected = pageStudents.every(s => selectedStudentIds.has(s.userId));
    
    const newSelection = new Set(selectedStudentIds);
    if (allSelected) {
      pageStudents.forEach(s => newSelection.delete(s.userId));
    } else {
      pageStudents.forEach(s => newSelection.add(s.userId));
    }
    setSelectedStudentIds(newSelection);
  };

  // Confirm student enrollment
  const confirmStudentEnrollment = () => {
    // Get full student objects for selected IDs
    const allStudents = [...enrolledStudents];
    const existingIds = new Set(allStudents.map(s => s.userId));
    
    // Add newly selected students
    availableStudents.forEach(s => {
      if (selectedStudentIds.has(s.userId) && !existingIds.has(s.userId)) {
        allStudents.push(s);
      }
    });
    
    // Remove deselected students
    const finalStudents = allStudents.filter(s => selectedStudentIds.has(s.userId));
    
    setEnrolledStudents(finalStudents);
    setTotalStudents(finalStudents.length);
    setShowStudentModal(false);
    
    console.log(`✅ ${finalStudents.length} students enrolled`);
  };

  // Open student modal and pre-select already enrolled
  const openStudentModal = () => {
    const preSelected = new Set(enrolledStudents.map(s => s.userId));
    setSelectedStudentIds(preSelected);
    setStudentClassFilter('all');
    setStudentSearchQuery('');
    setStudentModalPage(1);
    setShowStudentModal(true);
  };

  // Computed: paginated students for current page
  const paginatedStudents = availableStudents.slice(
    (studentModalPage - 1) * studentsPerPage,
    studentModalPage * studentsPerPage
  );
  const totalStudentPages = Math.ceil(availableStudents.length / studentsPerPage);

  // Computed: get unique classes from enrolled students for display
  const enrolledClassesList = [...new Set(enrolledStudents.map(s => s.studentClass).filter(Boolean))] as string[];

  // Keyboard navigation for image carousel
  useEffect(() => {
    if (!imageCarouselOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setImageCarouselOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageCarouselOpen, carouselImages.length]);

  const toggleQuestionSelection = (questionId: string) => {
    const newSelection = new Set(selectedQuestionIds);
    const newMap = new Map(selectedQuestionsMap);
    
    if (newSelection.has(questionId)) {
      newSelection.delete(questionId);
      newMap.delete(questionId);
    } else {
      newSelection.add(questionId);
      // Find the question in questionBankItems and add to map
      const question = questionBankItems.find(q => q.id === questionId);
      if (question) {
        newMap.set(questionId, question);
      }
    }
    
    setSelectedQuestionIds(newSelection);
    setSelectedQuestionsMap(newMap);
  };

  const [isSelectingAll, setIsSelectingAll] = useState(false);

  const selectAllQuestions = async () => {
    setIsSelectingAll(true);
    
    try {
      // Fetch ALL questions matching current filters (not paginated)
      const trimmedSearch = debouncedSearchQuery?.trim() || '';
      const searchQueryToSend = trimmedSearch.length >= 2 ? trimmedSearch : undefined;
      const actualQuestionType = getActualQuestionType(questionTypeFilter);
      const boardFilter = undefined;
      
      console.log('🔄 Fetching ALL questions across all pages...');
      
      // Fetch with a very large limit to get all questions
      const result = await firebaseService.getQuestionsPaginated(
        activeCollegeId,
        className || undefined,
        boardFilter,
        subject || undefined,
        actualQuestionType as any,
        'all',
        10000, // Large limit to get all questions
        1,
        searchQueryToSend,
        complexityFilter !== 'all' ? complexityFilter : undefined,
        chapterFilter !== 'all' ? chapterFilter : undefined,
        tagFilter !== 'all' ? tagFilter : undefined,
        null // no lastDoc — fetch from start
      );
      
      const allQuestions = result.questions;
      
      console.log(`✅ Fetched ${allQuestions.length} total questions matching filters`);
      
      // Filter out questions that are already added to exam or pool
      const existingQuestionIds = new Set([
        ...questions.map(q => q.questionBankId || q.id),
        ...questionPool.map(q => q.questionBankId || q.id)
      ]);
      
      const selectableQuestions = allQuestions.filter((q: any) => 
        !existingQuestionIds.has(q.id)
      );
      
      console.log(`📋 Filtered: ${selectableQuestions.length} selectable (${allQuestions.length - selectableQuestions.length} already added)`);
      
      // Add all selectable questions to selection
      const newSelection = new Set(selectedQuestionIds);
      const newMap = new Map(selectedQuestionsMap);
      
      selectableQuestions.forEach((question: any) => {
        newSelection.add(question.id);
        newMap.set(question.id, question);
      });
      
      setSelectedQuestionIds(newSelection);
      setSelectedQuestionsMap(newMap);
      console.log(`✅ Selected ${selectableQuestions.length} new questions (skipped ${allQuestions.length - selectableQuestions.length} already added)`);
    } catch (error) {
      console.error('❌ Error selecting all questions:', error);
    } finally {
      setIsSelectingAll(false);
    }
  };

  const deselectAllQuestions = () => {
    setSelectedQuestionIds(new Set());
    setSelectedQuestionsMap(new Map());
    console.log('❌ Deselected all questions');
  };

  const toggleSelectAll = async () => {
    // Check if we should deselect all or select all
    if (selectedQuestionIds.size > 0) {
      // If any questions are selected, deselect all
      deselectAllQuestions();
    } else {
      // Select all questions across all pages
      await selectAllQuestions();
    }
  };

  const addSelectedQuestions = () => {
    // Use the selectedQuestionsMap instead of filtering from questionBankItems
    const selectedQuestions = Array.from(selectedQuestionsMap.values())
      .map(item => {
        // After migration, question bank has modern types - use them directly!
        
        return {
          id: item.id,
          type: item.type,  // Use modern type directly (mcq, fitb, jumbled, code, descriptive)
          questionText: item.questionText,
          maximumMarks: item.marks,
          marks: item.marks,
          complexity: item.complexity,
          board: item.board,
          chapter: item.chapter,
          options: item.options,
          correctAnswers: item.correctAnswers,
          jumbledOptions: (item as any).jumbledOptions,  // ✅ ADDED: Include jumbledOptions for jumbled questions
          hint: item.hint,
          solution: item.solution,
          createdByName: item.createdByName,
          createdAt: item.createdAt,
          isProprietaryQuestion: item.isProprietaryQuestion,
          source: 'questionBank' as const,
          questionBankId: item.id,
          // Code question specific fields
          programmingLanguage: item.programmingLanguage,
          testCases: item.testCases,
          testStub: item.testStub,
          // SQL question specific fields
          sqlSchema: (item as any).sqlSchema,
          sqlTestCases: (item as any).sqlTestCases,
          // Image URLs
          imageUrls: item.imageUrls || [],
        } as any;
      });

    // Determine which list to check for duplicates and add to
    const targetList = isAddingToPool ? questionPool : questions;
    const setTargetList = isAddingToPool ? setQuestionPool : setQuestions;
    const targetName = isAddingToPool ? 'pool' : 'exam';
    const otherList = isAddingToPool ? questions : questionPool;
    const otherName = isAddingToPool ? 'exam questions list' : 'question pool';

    // Check for duplicates in target list
    const existingQuestionIds = new Set(targetList.map(q => q.questionBankId || q.id));
    
    // Check for duplicates in the other list (cross-list checking)
    const otherListQuestionIds = new Set(otherList.map(q => q.questionBankId || q.id));
    
    const duplicates: string[] = [];
    const crossListDuplicates: string[] = [];
    const newQuestions: any[] = [];

    selectedQuestions.forEach(q => {
      const qId = q.questionBankId || q.id;
      if (existingQuestionIds.has(qId)) {
        // Already in target list
        duplicates.push(q.questionText?.substring(0, 50) + '...' || 'Question');
      } else if (otherListQuestionIds.has(qId)) {
        // Already in the other list
        crossListDuplicates.push(q.questionText?.substring(0, 50) + '...' || 'Question');
      } else {
        newQuestions.push(q);
      }
    });

    // Handle cross-list duplicates
    if (crossListDuplicates.length > 0) {
      showAlert(
        'error',
        'Already Added',
        `${crossListDuplicates.length} question${crossListDuplicates.length !== 1 ? 's are' : ' is'} already in the ${otherName}. Please select different questions.`
      );
      return;
    }

    // Handle duplicates
    if (duplicates.length > 0) {
      const duplicateCount = duplicates.length;
      const newCount = newQuestions.length;
      
      if (newQuestions.length > 0) {
        // Some new, some duplicate
        setTargetList([...targetList, ...newQuestions]);
        showAlert(
          'info',
          'Partially Added',
          `Added ${newCount} new question${newCount !== 1 ? 's' : ''}. ${duplicateCount} duplicate question${duplicateCount !== 1 ? 's were' : ' was'} skipped to prevent duplication.`
        );
      } else {
        // All duplicates
        showAlert(
          'error',
          'Duplicate Questions',
          `All ${duplicateCount} selected question${duplicateCount !== 1 ? 's are' : ' is'} already in the ${targetName}. Please select different questions.`
        );
        return; // Don't close modal if all are duplicates
      }
    } else {
      // All new questions
      setTargetList([...targetList, ...selectedQuestions]);
      showAlert(
        'success',
        'Questions Added!',
        `Successfully added ${selectedQuestions.length} question${selectedQuestions.length !== 1 ? 's' : ''} to the ${targetName}.`
      );
    }

    setShowQuestionBankModal(false);
    setSelectedQuestionIds(new Set());
    setSelectedQuestionsMap(new Map());
    setIsAddingToPool(false); // Reset the flag

    // Auto-close success alert after 2 seconds
    if (duplicates.length === 0) {
      setTimeout(() => {
        closeAlert();
      }, 2000);
    }
  };

  const getComplexityColor = (complexity: string) => {
    const lower = complexity?.toLowerCase();
    if (lower === COMPLEXITY_LEVELS.EASY) return 'bg-green-100 text-green-700';
    if (lower === COMPLEXITY_LEVELS.MEDIUM) return 'bg-yellow-100 text-yellow-700';
    if (lower === COMPLEXITY_LEVELS.HARD) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getQuestionTypeDisplay = (type: string) => {
    // Use QUESTION_TYPE_LABELS for consistent labels
    if (type === QUESTION_TYPES.MCQ) return { label: QUESTION_TYPE_LABELS[QUESTION_TYPES.MCQ], color: 'bg-blue-100 text-blue-700' };
    if (type === QUESTION_TYPES.FITB) return { label: QUESTION_TYPE_LABELS[QUESTION_TYPES.FITB], color: 'bg-blue-100 text-blue-700' };
    if (type === QUESTION_TYPES.JUMBLED) return { label: QUESTION_TYPE_LABELS[QUESTION_TYPES.JUMBLED], color: 'bg-purple-100 text-purple-700' };
    if (type === QUESTION_TYPES.DESCRIPTIVE) return { label: QUESTION_TYPE_LABELS[QUESTION_TYPES.DESCRIPTIVE], color: 'bg-orange-100 text-orange-700' };
    if (type === QUESTION_TYPES.CODE) return { label: QUESTION_TYPE_LABELS[QUESTION_TYPES.CODE], color: 'bg-indigo-100 text-indigo-700' };
    return { label: type.toUpperCase(), color: 'bg-gray-100 text-gray-700' };
  };

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes slideInFromLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        
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
        
        @keyframes errorFadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .error-message {
          animation: errorFadeIn 0.3s ease-out;
        }
        
        /* Custom scrollbar styling - Hidden */
        .custom-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        /* Horizontal scrollbar hiding for badges */
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
          scroll-behavior: smooth;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}</style>
      
    <div className={`fixed inset-0 z-[9999] flex items-start justify-start p-2 transition-opacity duration-300 ${
      isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    }`}>
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
        <div 
          className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
          style={{ 
            background: brand.gradients.primary,
            borderColor: brand.colors.secondary
          }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <FontAwesomeIcon icon={faGraduationCap} className="text-white text-sm" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {existingExam ? 'Edit Exam' : 'Create New Exam'}
              </h2>
              <p className="text-white/80 text-xs">{activeCollegeName || 'Select College'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
          >
            <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-60">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent' }}
                />
                <p className="text-gray-600 font-medium">Loading college data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Exam Mode Selection - Compact Design */}
              <div className="border rounded-xl overflow-hidden"
                style={{ 
                  borderColor: brand.colors.primary + '33'
                }}>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
                  <div className="flex items-center space-x-2 mb-0.5">
                    <FontAwesomeIcon icon={faLaptop} className="text-blue-600" />
                    <h3 className="text-base font-semibold text-gray-900">Exam Settings</h3>
                  </div>
                  <p className="text-gray-600 text-xs">Configure security and monitoring options</p>
                </div>

                <div className="p-4">
                  {/* Security Options */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center space-x-2.5">
                      <button
                        onClick={() => setSecurityLevel(SECURITY_LEVELS.NORMAL)}
                        onMouseEnter={() => setHoveredExamOption('normal')}
                        onMouseLeave={() => setHoveredExamOption(null)}
                        className={`px-4 py-1.5 rounded-full border transition-all flex items-center space-x-2 ${
                          securityLevel === SECURITY_LEVELS.NORMAL 
                            ? 'border-green-500 bg-white' 
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                          securityLevel === SECURITY_LEVELS.NORMAL 
                            ? 'border border-green-500 bg-green-500' 
                            : 'border border-gray-400'
                        }`}>
                          {securityLevel === SECURITY_LEVELS.NORMAL && <FontAwesomeIcon icon={faCheck} className="text-white text-[8px]" />}
                        </div>
                        <span className={`font-semibold text-xs ${securityLevel === SECURITY_LEVELS.NORMAL ? 'text-green-600' : 'text-gray-600'}`}>Normal</span>
                      </button>
                      
                      <button
                        onClick={() => setSecurityLevel(SECURITY_LEVELS.SECURE)}
                        onMouseEnter={() => setHoveredExamOption('secure')}
                        onMouseLeave={() => setHoveredExamOption(null)}
                        className={`px-4 py-1.5 rounded-full border transition-all flex items-center space-x-2 ${
                          securityLevel === SECURITY_LEVELS.SECURE
                            ? 'border-gray-500 bg-white'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                          securityLevel === SECURITY_LEVELS.SECURE 
                            ? 'border border-gray-600 bg-gray-600' 
                            : 'border border-gray-400'
                        }`}>
                          {securityLevel === SECURITY_LEVELS.SECURE && <FontAwesomeIcon icon={faCheck} className="text-white text-[8px]" />}
                        </div>
                        <span className="font-semibold text-xs text-gray-600">Secure</span>
                      </button>

                      <button
                        onClick={() => setAttendance(!attendance)}
                        onMouseEnter={() => setHoveredExamOption('attendance')}
                        onMouseLeave={() => setHoveredExamOption(null)}
                        className={`px-4 py-1.5 rounded-full border transition-all flex items-center space-x-2 ${
                          attendance 
                            ? 'border-blue-500 bg-white' 
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                          attendance 
                            ? 'border border-blue-500 bg-blue-500' 
                            : 'border border-gray-400'
                        }`}>
                          {attendance && <FontAwesomeIcon icon={faCheck} className="text-white text-[8px]" />}
                        </div>
                        <span className={`font-semibold text-xs ${attendance ? 'text-blue-600' : 'text-gray-600'}`}>Attendance</span>
                      </button>

                      <button
                        onClick={() => setAvProctoring(!avProctoring)}
                        onMouseEnter={() => setHoveredExamOption('avproctoring')}
                        onMouseLeave={() => setHoveredExamOption(null)}
                        className={`px-4 py-1.5 rounded-full border transition-all flex items-center space-x-2 ${
                          avProctoring
                            ? 'border-gray-500 bg-white'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                          avProctoring 
                            ? 'border border-gray-600 bg-gray-600' 
                            : 'border border-gray-400'
                        }`}>
                          {avProctoring && <FontAwesomeIcon icon={faCheck} className="text-white text-[8px]" />}
                        </div>
                        <span className="font-semibold text-xs text-gray-600">A/V Proctoring</span>
                      </button>
                    </div>
                    
                    {/* Tooltip display below the options */}
                    <div className="h-8 flex items-center justify-center mt-2">
                      {hoveredExamOption === 'normal' && (
                        <p className="text-xs text-gray-500 text-center animate-fadeIn flex items-center space-x-1.5">
                          <FontAwesomeIcon icon={faFileAlt} className="text-green-500" />
                          <span>Standard exam mode - students can take the exam in any browser</span>
                        </p>
                      )}
                      {hoveredExamOption === 'secure' && (
                        <p className="text-xs text-gray-500 text-center animate-fadeIn flex items-center space-x-1.5">
                          <FontAwesomeIcon icon={faLock} className="text-gray-600" />
                          <span>Requires Examiners Secure Browser - prevents tab switching & copy/paste</span>
                        </p>
                      )}
                      {hoveredExamOption === 'attendance' && (
                        <p className="text-xs text-gray-500 text-center animate-fadeIn flex items-center space-x-1.5">
                          <FontAwesomeIcon icon={faCamera} className="text-blue-500" />
                          <span>Student must mark attendance before attempting the exam</span>
                        </p>
                      )}
                      {hoveredExamOption === 'avproctoring' && (
                        <p className="text-xs text-gray-500 text-center animate-fadeIn flex items-center space-x-1.5">
                          <FontAwesomeIcon icon={faVideo} className="text-purple-500" />
                          <span>Exam conducted under webcam supervision with third-person audio detection</span>
                        </p>
                      )}
                      {!hoveredExamOption && (
                        <p className="text-xs text-gray-400 text-center flex items-center space-x-1.5">
                          <FontAwesomeIcon icon={faCircleQuestion} className="text-gray-400" />
                          <span>Hover over an option to see its description</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Completion Policy Section */}
                  <div className="mt-6 pt-6 border-t-2 border-gray-200">
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faClock} className="text-gray-600" />
                            Exam Completion Policy
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">Choose how exam time limits are enforced for students</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Strict Completion */}
                          <button
                            type="button"
                            onClick={() => setCompletionPolicy('strict')}
                            className={`relative overflow-hidden border rounded-xl p-4 transition-all text-left ${
                              completionPolicy === 'strict'
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 bg-white hover:border-blue-300'
                            }`}
                          >
                            {/* Selection indicator */}
                            {completionPolicy === 'strict' && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />
                              </div>
                            )}

                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                              completionPolicy === 'strict'
                                ? 'bg-blue-100'
                                : 'bg-gray-100'
                            }`}>
                              <FontAwesomeIcon 
                                icon={faClock} 
                                className={`text-2xl ${
                                  completionPolicy === 'strict'
                                    ? 'text-blue-600'
                                    : 'text-gray-500'
                                }`}
                              />
                            </div>

                            {/* Title */}
                            <h4 className={`font-bold text-sm mb-1.5 ${
                              completionPolicy === 'strict'
                                ? 'text-blue-900'
                                : 'text-gray-700'
                            }`}>
                              Strict Completion
                            </h4>

                            {/* Description */}
                            <p className={`text-xs leading-relaxed ${
                              completionPolicy === 'strict'
                                ? 'text-blue-700'
                                : 'text-gray-600'
                            }`}>
                              All students auto-submit at exact end time, regardless of when they started
                            </p>

                            {/* Features */}
                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-start gap-2">
                                <FontAwesomeIcon 
                                  icon={faCheckCircle} 
                                  className={`text-xs mt-0.5 flex-shrink-0 ${
                                    completionPolicy === 'strict'
                                      ? 'text-blue-600'
                                      : 'text-gray-400'
                                  }`}
                                />
                                <span className={`text-xs ${
                                  completionPolicy === 'strict'
                                    ? 'text-blue-700'
                                    : 'text-gray-600'
                                }`}>
                                  Fixed deadline for all
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <FontAwesomeIcon 
                                  icon={faCheckCircle} 
                                  className={`text-xs mt-0.5 flex-shrink-0 ${
                                    completionPolicy === 'strict'
                                      ? 'text-blue-600'
                                      : 'text-gray-400'
                                  }`}
                                />
                                <span className={`text-xs ${
                                  completionPolicy === 'strict'
                                    ? 'text-blue-700'
                                    : 'text-gray-600'
                                }`}>
                                  No grace period
                                </span>
                              </div>
                            </div>

                            {/* Badge */}
                            <div className={`mt-3 inline-block px-2 py-1 rounded text-xs font-semibold ${
                              completionPolicy === 'strict'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              Default
                            </div>
                          </button>

                          {/* Flexible Completion */}
                          <button
                            type="button"
                            onClick={() => setCompletionPolicy('flexible')}
                            className={`relative overflow-hidden border rounded-xl p-4 transition-all text-left ${
                              completionPolicy === 'flexible'
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-300 bg-white hover:border-green-300'
                            }`}
                          >
                            {/* Selection indicator */}
                            {completionPolicy === 'flexible' && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />
                              </div>
                            )}

                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                              completionPolicy === 'flexible'
                                ? 'bg-green-100'
                                : 'bg-gray-100'
                            }`}>
                              <FontAwesomeIcon 
                                icon={faHourglass} 
                                className={`text-2xl ${
                                  completionPolicy === 'flexible'
                                    ? 'text-green-600'
                                    : 'text-gray-500'
                                }`}
                              />
                            </div>

                            {/* Title */}
                            <h4 className={`font-bold text-sm mb-1.5 ${
                              completionPolicy === 'flexible'
                                ? 'text-green-900'
                                : 'text-gray-700'
                            }`}>
                              Flexible Completion
                            </h4>

                            {/* Description */}
                            <p className={`text-xs leading-relaxed ${
                              completionPolicy === 'flexible'
                                ? 'text-green-700'
                                : 'text-gray-600'
                            }`}>
                              Late starters get up to 30-minute grace period after exam end time
                            </p>

                            {/* Features */}
                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-start gap-2">
                                <FontAwesomeIcon 
                                  icon={faCheckCircle} 
                                  className={`text-xs mt-0.5 flex-shrink-0 ${
                                    completionPolicy === 'flexible'
                                      ? 'text-green-600'
                                      : 'text-gray-400'
                                  }`}
                                />
                                <span className={`text-xs ${
                                  completionPolicy === 'flexible'
                                    ? 'text-green-700'
                                    : 'text-gray-600'
                                }`}>
                                  Grace for late starters only
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <FontAwesomeIcon 
                                  icon={faCheckCircle} 
                                  className={`text-xs mt-0.5 flex-shrink-0 ${
                                    completionPolicy === 'flexible'
                                      ? 'text-green-600'
                                      : 'text-gray-400'
                                  }`}
                                />
                                <span className={`text-xs ${
                                  completionPolicy === 'flexible'
                                    ? 'text-green-700'
                                    : 'text-gray-600'
                                }`}>
                                  Max 30 min extension
                                </span>
                              </div>
                            </div>

                            {/* Badge */}
                            <div className={`mt-3 inline-block px-2 py-1 rounded text-xs font-semibold ${
                              completionPolicy === 'flexible'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              Recommended for Late Entries
                            </div>
                          </button>
                        </div>

                        {/* Info Box */}
                        <div className={`mt-4 p-3 rounded-lg border ${
                          completionPolicy === 'strict'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-green-50 border-green-200'
                        }`}>
                          <div className="flex items-start gap-2">
                            <FontAwesomeIcon 
                              icon={faCircleExclamation} 
                              className={`text-sm mt-0.5 ${
                                completionPolicy === 'strict'
                                  ? 'text-blue-600'
                                  : 'text-green-600'
                              }`}
                            />
                            <div className="flex-1">
                              <p className={`text-xs font-semibold mb-1 ${
                                completionPolicy === 'strict'
                                  ? 'text-blue-900'
                                  : 'text-green-900'
                              }`}>
                                {completionPolicy === 'strict' ? 'How Strict Mode Works:' : 'How Flexible Mode Works:'}
                              </p>
                              <p className={`text-xs leading-relaxed ${
                                completionPolicy === 'strict'
                                  ? 'text-blue-700'
                                  : 'text-green-700'
                              }`}>
                                {completionPolicy === 'strict' 
                                  ? 'If exam ends at 10:00 AM, all students (including those who started late) will be auto-submitted at exactly 10:00 AM.'
                                  : 'If exam ends at 10:00 AM and a student started 15 minutes late, they will be auto-submitted at 10:15 AM (their full duration + time remaining). Maximum grace period is 30 minutes.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="border rounded-xl p-4"
                style={{ 
                  background: brand.gradients.card,
                  borderColor: brand.colors.secondary + '33'
                }}>
                <div className="flex items-center space-x-2.5 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: brand.colors.secondary + '20' }}>
                    <FontAwesomeIcon icon={faFileLines} style={{ color: brand.colors.secondary }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Basic Information</h3>
                    <p className="text-xs" style={{ color: brand.colors.secondary, opacity: 0.9 }}>Fill in the exam details</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Exam Type */}
                  <div className="dropdown-container">
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Exam Type <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                        className={`w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent ${
                          errors.examType && showErrors 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300 hover:border-gray-400 bg-white'
                        }`}
                      >
                        <span className="text-gray-900">{examType || 'Select Type'}</span>
                        <FontAwesomeIcon icon={faChevronDown} className="text-gray-500" />
                      </button>
                      {openDropdown === 'type' && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto custom-scrollbar">
                          {examTypes.map((type) => {
                            const icon = getExamTypeIcon(type);
                            return (
                              <button
                                key={type}
                                onClick={() => {
                                  setExamType(type);
                                  setOpenDropdown(null);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors flex items-center space-x-2 font-medium text-gray-900 text-sm"
                              >
                                <FontAwesomeIcon icon={icon} style={{ color: brand.colors.secondary }} className="text-base" />
                                <span>{type}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {errors.examType && showErrors && (
                      <p className="text-xs text-red-600 mt-1 ml-1 font-semibold error-message">⚠️ {errors.examType}</p>
                    )}
                  </div>

                  {/* Exam Label */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Exam Label <span className="text-gray-400 font-normal">(optional, 6-25 chars)</span>
                    </label>
                    <input
                      type="text"
                      value={examLabel}
                      onChange={(e) => {
                        if (e.target.value.length <= 25) setExamLabel(e.target.value);
                      }}
                      placeholder="e.g. Infosys Test"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm font-medium transition-all focus:ring-2 focus:border-transparent hover:border-gray-400 bg-white"
                    />
                    {examLabel && examLabel.length < 6 && (
                      <p className="text-xs text-amber-600 mt-1 ml-1">Minimum 6 characters ({6 - examLabel.length} more)</p>
                    )}
                  </div>

                  {/* Maximum Marks */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Maximum Marks <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={maximumMarks || ''}
                      onChange={(e) => setMaximumMarks(parseInt(e.target.value))}
                      className={`w-full px-3 py-3 border rounded-lg text-sm font-medium transition-all focus:ring-2 focus:border-transparent ${
                        errors.maximumMarks && showErrors 
                          ? 'border-red-300 bg-red-50' 
                          : 'border-gray-300 hover:border-gray-400 bg-white'
                      }`}
                      placeholder="e.g., 100"
                    />
                    {errors.maximumMarks && showErrors && (
                      <p className="text-xs text-red-600 mt-1 ml-1 font-semibold error-message">⚠️ {errors.maximumMarks}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2.5 mt-5">
                  {/* Exam Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Exam Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className={`w-full px-2.5 py-2.5 border rounded-lg text-xs font-medium transition-all focus:ring-2 focus:border-transparent ${
                        errors.examDate && showErrors 
                          ? 'border-red-300 bg-red-50' 
                          : 'border-gray-300 hover:border-gray-400 bg-white'
                      }`}
                    />
                    {errors.examDate && showErrors && (
                      <p className="text-xs text-red-600 mt-1 ml-1 font-semibold error-message">⚠️ {errors.examDate}</p>
                    )}
                  </div>

                  {/* Exam Time */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Exam Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={examTime}
                      onChange={(e) => setExamTime(e.target.value)}
                      className={`w-full px-2.5 py-2.5 border rounded-lg text-xs font-medium transition-all focus:ring-2 focus:border-transparent ${
                        errors.examTime && showErrors 
                          ? 'border-red-300 bg-red-50' 
                          : 'border-gray-300 hover:border-gray-400 bg-white'
                      }`}
                    />
                    {errors.examTime && showErrors && (
                      <p className="text-xs text-red-600 mt-1 ml-1 font-semibold error-message">⚠️ {errors.examTime}</p>
                    )}
                  </div>

                  {/* Duration Value */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Duration <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={durationDisplayValue || ''}
                      onChange={(e) => setDurationDisplayValue(parseInt(e.target.value))}
                      className={`w-full px-2.5 py-2.5 border rounded-lg text-xs font-medium transition-all focus:ring-2 focus:border-transparent ${
                        errors.duration && showErrors 
                          ? 'border-red-300 bg-red-50' 
                          : 'border-gray-300 hover:border-gray-400 bg-white'
                      }`}
                      placeholder={durationUnit === 'days' ? 'e.g., 7' : durationUnit === 'hours' ? 'e.g., 3' : 'e.g., 180'}
                    />
                    {errors.duration && showErrors && (
                      <p className="text-xs text-red-600 mt-1 ml-1 font-semibold error-message">⚠️ {errors.duration}</p>
                    )}
                  </div>

                  {/* Duration Unit */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={durationUnit}
                      onChange={(e) => {
                        const newUnit = e.target.value as 'minutes' | 'hours' | 'days';
                        setDurationUnit(newUnit);
                        setDurationDisplayValue(convertFromMinutes(duration, newUnit));
                      }}
                      className="w-full px-2.5 py-2.5 border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:border-transparent transition-all"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Content based on exam mode */}
              {examMode === EXAM_MODES.OFFLINE ? (
                <div className="border rounded-xl p-5"
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.secondary + '33'
                  }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: brand.colors.secondary + '20' }}>
                        <FontAwesomeIcon icon={faUpload} style={{ color: brand.colors.secondary }} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 flex items-center">
                          Question Paper
                          <span className="text-red-500 ml-1">*</span>
                        </h3>
                        <p className="text-sm" style={{ color: brand.colors.secondary, opacity: 0.9 }}>{questionPaperImages.length} page{questionPaperImages.length !== 1 ? 's' : ''} uploaded</p>
                      </div>
                    </div>
                    <label className="px-5 py-2.5 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center space-x-2 cursor-pointer"
                      style={{ background: brand.gradients.header }}>
                      <FontAwesomeIcon icon={faUpload} />
                      <span>Upload Question Papers</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {questionPaperImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                      {questionPaperImages.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Question paper page ${index + 1}`}
                            className="w-full h-48 object-cover rounded-xl border border-gray-200"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                          >
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                          <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1.5 rounded-lg text-center">
                            Page {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      className="text-center py-12 bg-white/50 rounded-xl border border-dashed"
                      style={{
                        borderColor: errors.questionPaperImages && showErrors ? '#fca5a5' : brand.colors.primary + '33'
                      }}
                    >
                      <FontAwesomeIcon icon={faUpload} className="mx-auto mb-3"
                        style={{
                          color: errors.questionPaperImages && showErrors ? '#fca5a5' : brand.colors.primary + '66'
                        }} />
                      <p className="font-semibold text-gray-900">No pages uploaded yet</p>
                      <p className="text-sm text-gray-600 mt-1">Click "Upload Question Papers" to add question paper images</p>
                    </div>
                  )}
                  {errors.questionPaperImages && showErrors && (
                    <p className="text-sm text-red-600 mt-2 ml-1 font-semibold">⚠️ {errors.questionPaperImages}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="border rounded-2xl p-5" 
                    style={{ 
                      background: brand.gradients.card,
                      borderColor: brand.colors.secondary + '33'
                    }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: brand.colors.secondary + '20' }}>
                        <FontAwesomeIcon icon={faBook} style={{ color: brand.colors.secondary }} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 flex items-center">
                          Questions List
                          <span className="text-red-500 ml-1">*</span>
                        </h3>
                        <p className="text-sm" style={{ color: brand.colors.secondary, opacity: 0.9 }}>
                          {questions.length} question{questions.length !== 1 ? 's' : ''} added
                          {questions.length > 0 && (() => {
                            const regularMarks = questions.reduce((sum, q) => sum + (q.maximumMarks || 0), 0);
                            
                            return (
                              <span className="ml-2 font-bold text-blue-600">
                                • Total: {regularMarks} marks
                              </span>
                            );
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setIsAddingToPool(false);
                          openCustomQuestionModal();
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center space-x-2 text-sm"
                      >
                        <FontAwesomeIcon icon={faPen} />
                        <span>Custom Question</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingToPool(false);
                          addQuestion();
                        }}
                        disabled={false}
                        className="px-4 py-2 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        style={{ background: brand.gradients.header }}
                        title=""
                      >
                        <FontAwesomeIcon icon={faBookAtlas} />
                        <span>Question Bank</span>
                      </button>
                    </div>
                  </div>

                  {questions.length > 0 ? (
                    <>
                      <div className="space-y-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '320px' }}>
                        {questions
                          .slice((questionsListPage - 1) * questionsListPerPage, questionsListPage * questionsListPerPage)
                          .map((question, index) => {
                            const actualIndex = (questionsListPage - 1) * questionsListPerPage + index;
                            return (
                            <div key={question.id} className="bg-white border rounded-xl p-4 transition-all shadow-sm"
                              style={{ 
                                borderColor: brand.colors.secondary + '33'
                              }}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className="text-base font-semibold text-gray-900 w-8 h-8 rounded-lg flex items-center justify-center"
                                      style={{ backgroundColor: brand.colors.secondary + '20' }}>
                                      {actualIndex + 1}
                                    </span>
                                    <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                                      question.type === QUESTION_TYPES.MCQ ? 'bg-blue-100 text-blue-700' :
                                      question.type === QUESTION_TYPES.FITB ? 'bg-green-100 text-green-700' :
                                      question.type === QUESTION_TYPES.JUMBLED ? 'bg-purple-100 text-purple-700' :
                                      question.type === QUESTION_TYPES.CODE ? 'bg-indigo-100 text-indigo-700' :
                                      'bg-orange-100 text-orange-700'
                                    }`}>
                                      {question.type === QUESTION_TYPES.MCQ ? 'MCQ' :
                                       question.type === QUESTION_TYPES.FITB ? 'Fill Blank' :
                                       question.type === QUESTION_TYPES.JUMBLED ? 'Jumbled' :
                                       question.type === QUESTION_TYPES.CODE ? 'Code' :
                                       'Descriptive'}
                                    </span>
                                    {question.complexity && (
                                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                        question.complexity === COMPLEXITY_LEVELS.EASY ? 'bg-green-100 text-green-700' :
                                        question.complexity === COMPLEXITY_LEVELS.MEDIUM ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        {question.complexity.charAt(0).toUpperCase() + question.complexity.slice(1)}
                                      </span>
                                    )}
                                    <span className="ml-auto text-xs font-bold px-3 py-1 rounded-lg"
                                      style={{ 
                                        color: brand.colors.secondary,
                                        backgroundColor: brand.colors.secondary + '20'
                                      }}>
                                      {question.maximumMarks} marks
                                    </span>
                                  </div>
                                  <div 
                                    className="text-sm text-gray-700 font-medium prose prose-sm max-w-none
                                      [&>h1]:text-base [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-1 [&>h1]:mt-0
                                      [&>h2]:text-sm [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-1 [&>h2]:mt-0
                                      [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-0.5 [&>h3]:mt-0
                                      [&>p]:text-sm [&>p]:text-gray-700 [&>p]:mb-0.5 [&>p]:leading-snug [&>p]:mt-0
                                      [&_strong]:font-bold [&_strong]:text-gray-900
                                      [&>ul]:list-disc [&>ul]:ml-4 [&>ul]:mb-1 [&>ul]:text-sm
                                      [&>ol]:list-decimal [&>ol]:ml-4 [&>ol]:mb-1 [&>ol]:text-sm
                                      [&_li]:mb-0.5 [&_li]:text-xs
                                      [&_code]:hidden
                                      [&>pre:empty]:hidden [&>pre:empty]:opacity-0 [&>pre:empty]:h-0 [&>pre:empty]:m-0 [&>pre:empty]:p-0
                                      [&_.katex]:text-sm [&_.katex]:inline-block
                                      line-clamp-3"
                                    dangerouslySetInnerHTML={{ 
                                      __html: (() => {
                                        let html = (question.questionText || 'Question text...');
                                        // Render math formulas - look for data-latex attribute
                                        html = html.replace(
                                          /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                                          (match, latex) => {
                                            try {
                                              const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                              return katex.renderToString(decodedLatex, {
                                                throwOnError: false,
                                                displayMode: false
                                              });
                                            } catch (e) {
                                              return match;
                                            }
                                          }
                                        );
                                        // Remove code blocks
                                        return html.replace(/<code>.*?<\/code>/gs, '');
                                      })()
                                    }}
                                  />
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <button
                                    onClick={() => handleEditQuestion(actualIndex)}
                                    className="w-9 h-9 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-all"
                                    title="Edit question"
                                  >
                                    <FontAwesomeIcon icon={faPenToSquare} />
                                  </button>
                                  <button
                                    onClick={() => removeQuestion(actualIndex)}
                                    className="w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all"
                                    title="Delete question"
                                  >
                                    <FontAwesomeIcon icon={faTrash} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Pagination for Questions List */}
                      {questions.length > questionsListPerPage && (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-500">
                            Showing <span className="font-semibold text-gray-700">{((questionsListPage - 1) * questionsListPerPage) + 1}-{Math.min(questionsListPage * questionsListPerPage, questions.length)}</span> of <span className="font-semibold text-gray-700">{questions.length}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => setQuestionsListPage(Math.max(1, questionsListPage - 1))}
                              disabled={questionsListPage === 1}
                              className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                                questionsListPage === 1
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                            </button>
                            {Array.from({ length: Math.ceil(questions.length / questionsListPerPage) }, (_, i) => i + 1)
                              .filter(page => {
                                const totalPages = Math.ceil(questions.length / questionsListPerPage);
                                return page === 1 || page === totalPages || (page >= questionsListPage - 1 && page <= questionsListPage + 1);
                              })
                              .map((page, idx, arr) => {
                                const prevPage = arr[idx - 1];
                                const showEllipsis = prevPage && page - prevPage > 1;
                                return (
                                  <div key={page} className="flex items-center">
                                    {showEllipsis && <span className="px-1 text-gray-400 text-xs">...</span>}
                                    <button
                                      onClick={() => setQuestionsListPage(page)}
                                      className={`min-w-[32px] h-8 rounded-lg text-sm font-semibold transition-all ${
                                        questionsListPage === page
                                          ? 'text-white shadow-sm'
                                          : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
                                      }`}
                                      style={questionsListPage === page ? { background: brand.gradients.primary } : {}}
                                    >
                                      {page}
                                    </button>
                                  </div>
                                );
                              })}
                            <button
                              onClick={() => setQuestionsListPage(Math.min(Math.ceil(questions.length / questionsListPerPage), questionsListPage + 1))}
                              disabled={questionsListPage >= Math.ceil(questions.length / questionsListPerPage)}
                              className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                                questionsListPage >= Math.ceil(questions.length / questionsListPerPage)
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div 
                      className="text-center py-12 bg-white/50 rounded-xl border border-dashed"
                      style={{
                        borderColor: errors.questions && showErrors ? '#fca5a5' : brand.colors.secondary + '33'
                      }}
                    >
                      <FontAwesomeIcon icon={faBook} className="mx-auto mb-3"
                        style={{
                          color: errors.questions && showErrors ? '#fca5a5' : brand.colors.secondary + '66'
                        }} />
                      <p className="font-semibold text-gray-900">No questions added yet</p>
                      <p className="text-sm text-gray-600 mt-1">Click "Custom Question" or "Question Bank" to start building your exam</p>
                    </div>
                  )}
                  {errors.questions && showErrors && (
                    <p className="text-sm text-red-600 mt-2 ml-1 font-semibold">⚠️ {errors.questions}</p>
                  )}
                </div>

                <div className="border rounded-2xl p-5 mt-5" 
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.secondary + '33'
                  }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: brand.colors.secondary + '20' }}>
                        <FontAwesomeIcon icon={faShuffle} style={{ color: brand.colors.secondary }} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-base font-semibold text-gray-900">
                            Question Pool (Optional)
                          </h3>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enableQuestionPool}
                              onChange={(e) => {
                                setEnableQuestionPool(e.target.checked);
                                if (!e.target.checked) {
                                  setQuestionPool([]);
                                  setPickRandomCount(0);
                                  setPoolQuestionMarks(0);
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ml-3 text-sm font-medium text-gray-700">Enable</span>
                          </label>
                        </div>
                        <p className="text-sm mt-1" style={{ color: brand.colors.secondary, opacity: 0.9 }}>
                          {enableQuestionPool ? (
                            <>
                              {questionPool.length} question{questionPool.length !== 1 ? 's' : ''} in pool
                              {pickRandomCount > 0 && poolQuestionMarks > 0 && (
                                <span className="ml-2 font-bold text-green-600">
                                  • Total: {pickRandomCount * poolQuestionMarks} marks
                                </span>
                              )}
                            </>
                          ) : (
                            'Add questions to a pool and randomly pick N questions per student'
                          )}
                        </p>
                      </div>
                    </div>
                    {enableQuestionPool && (
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setIsAddingToPool(true);
                            openCustomQuestionModal();
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center space-x-2 text-sm"
                        >
                          <FontAwesomeIcon icon={faPen} />
                          <span>Custom Question</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingToPool(true);
                            addQuestion();
                          }}
                          disabled={false}
                          className="px-4 py-2 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          style={{ background: brand.gradients.header }}
                          title=""
                        >
                          <FontAwesomeIcon icon={faBookAtlas} />
                          <span>Question Bank</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {enableQuestionPool && (
                    <>
                      <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Number of questions to pick randomly:
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={questionPool.length}
                              value={pickRandomCount}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setPickRandomCount('' as any);
                                } else {
                                  const numValue = parseInt(value);
                                  if (!isNaN(numValue) && numValue >= 0) {
                                    setPickRandomCount(numValue);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '') {
                                  setPickRandomCount(0);
                                }
                              }}
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                              placeholder="e.g., 5"
                            />
                            {pickRandomCount > questionPool.length && (
                              <p className="text-xs text-red-600 mt-1 font-semibold">
                                ⚠️ Cannot pick {pickRandomCount} questions from a pool of {questionPool.length}
                              </p>
                            )}
                            {errors.pickRandomCount && showErrors && (
                              <p className="text-xs text-red-600 mt-1 font-semibold">
                                ⚠️ {errors.pickRandomCount}
                              </p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Marks per question (equal for all):
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={poolQuestionMarks}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setPoolQuestionMarks('' as any);
                                } else {
                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue) && numValue >= 0) {
                                    setPoolQuestionMarks(numValue);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '') {
                                  setPoolQuestionMarks(0);
                                }
                              }}
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                              placeholder="e.g., 4"
                            />
                            {errors.poolQuestionMarks && showErrors && (
                              <p className="text-xs text-red-600 mt-1 font-semibold">
                                ⚠️ {errors.poolQuestionMarks}
                              </p>
                            )}
                          </div>
                        </div>
                        {errors.questionPool && showErrors && (
                          <p className="text-sm text-red-600 mt-2 ml-1 font-semibold">⚠️ {errors.questionPool}</p>
                        )}
                      </div>

                      {questionPool.length > 0 ? (
                        <>
                          <div className="space-y-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '320px' }}>
                            {questionPool
                              .slice((questionPoolPage - 1) * questionsListPerPage, questionPoolPage * questionsListPerPage)
                              .map((question, index) => {
                                const actualIndex = (questionPoolPage - 1) * questionsListPerPage + index;
                                return (
                                <div key={question.id} className="bg-white border rounded-xl p-4 transition-all shadow-sm"
                                  style={{ 
                                    borderColor: brand.colors.secondary + '33'
                                  }}>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <span className="text-base font-semibold text-gray-900 w-8 h-8 rounded-lg flex items-center justify-center"
                                          style={{ backgroundColor: brand.colors.secondary + '20' }}>
                                          {actualIndex + 1}
                                        </span>
                                        <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                                          question.type === QUESTION_TYPES.MCQ ? 'bg-blue-100 text-blue-700' :
                                          question.type === QUESTION_TYPES.FITB ? 'bg-green-100 text-green-700' :
                                          question.type === QUESTION_TYPES.JUMBLED ? 'bg-purple-100 text-purple-700' :
                                          question.type === QUESTION_TYPES.CODE ? 'bg-indigo-100 text-indigo-700' :
                                          'bg-orange-100 text-orange-700'
                                        }`}>
                                          {question.type === QUESTION_TYPES.MCQ ? 'MCQ' :
                                           question.type === QUESTION_TYPES.FITB ? 'Fill Blank' :
                                           question.type === QUESTION_TYPES.JUMBLED ? 'Jumbled' :
                                           question.type === QUESTION_TYPES.CODE ? 'Code' :
                                           'Descriptive'}
                                        </span>
                                        {question.complexity && (
                                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                            question.complexity === COMPLEXITY_LEVELS.EASY ? 'bg-green-100 text-green-700' :
                                            question.complexity === COMPLEXITY_LEVELS.MEDIUM ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {question.complexity.charAt(0).toUpperCase() + question.complexity.slice(1)}
                                          </span>
                                        )}
                                        <span className="ml-auto text-xs font-bold px-3 py-1 rounded-lg"
                                          style={{ 
                                            color: brand.colors.secondary,
                                            backgroundColor: brand.colors.secondary + '20'
                                          }}>
                                          {poolQuestionMarks > 0 ? poolQuestionMarks : question.maximumMarks} marks
                                        </span>
                                      </div>
                                      <div 
                                        className="text-sm text-gray-700 font-medium prose prose-sm max-w-none line-clamp-3"
                                        dangerouslySetInnerHTML={{ 
                                          __html: (() => {
                                            let html = (question.questionText || 'Question text...');
                                            html = html.replace(
                                              /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                                              (match, latex) => {
                                                try {
                                                  const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                                  return katex.renderToString(decodedLatex, {
                                                    throwOnError: false,
                                                    displayMode: false
                                                  });
                                                } catch (e) {
                                                  return match;
                                                }
                                              }
                                            );
                                            return html.replace(/<code>.*?<\/code>/gs, '');
                                          })()
                                        }}
                                      />
                                    </div>
                                    <div className="flex items-center space-x-2 ml-4">
                                      <button
                                        onClick={() => handleEditPoolQuestion(actualIndex)}
                                        className="w-9 h-9 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-all"
                                        title="Edit question"
                                      >
                                        <FontAwesomeIcon icon={faPenToSquare} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setQuestionPool(prev => prev.filter((_, i) => i !== actualIndex));
                                        }}
                                        className="w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all"
                                        title="Remove from pool"
                                      >
                                        <FontAwesomeIcon icon={faTrash} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Pagination for Question Pool */}
                          {questionPool.length > questionsListPerPage && (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                              <div className="text-xs text-gray-500">
                                Showing <span className="font-semibold text-gray-700">{((questionPoolPage - 1) * questionsListPerPage) + 1}-{Math.min(questionPoolPage * questionsListPerPage, questionPool.length)}</span> of <span className="font-semibold text-gray-700">{questionPool.length}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => setQuestionPoolPage(Math.max(1, questionPoolPage - 1))}
                                  disabled={questionPoolPage === 1}
                                  className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                                    questionPoolPage === 1
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                                </button>
                                {Array.from({ length: Math.ceil(questionPool.length / questionsListPerPage) }, (_, i) => i + 1)
                                  .filter(page => {
                                    const totalPages = Math.ceil(questionPool.length / questionsListPerPage);
                                    return page === 1 || page === totalPages || (page >= questionPoolPage - 1 && page <= questionPoolPage + 1);
                                  })
                                  .map((page, idx, arr) => {
                                    const prevPage = arr[idx - 1];
                                    const showEllipsis = prevPage && page - prevPage > 1;
                                    return (
                                      <div key={page} className="flex items-center">
                                        {showEllipsis && <span className="px-1 text-gray-400 text-xs">...</span>}
                                        <button
                                          onClick={() => setQuestionPoolPage(page)}
                                          className={`min-w-[32px] h-8 rounded-lg text-sm font-semibold transition-all ${
                                            questionPoolPage === page
                                              ? 'text-white shadow-sm'
                                              : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
                                          }`}
                                          style={questionPoolPage === page ? { background: brand.gradients.primary } : {}}
                                        >
                                          {page}
                                        </button>
                                      </div>
                                    );
                                  })}
                                <button
                                  onClick={() => setQuestionPoolPage(Math.min(Math.ceil(questionPool.length / questionsListPerPage), questionPoolPage + 1))}
                                  disabled={questionPoolPage >= Math.ceil(questionPool.length / questionsListPerPage)}
                                  className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                                    questionPoolPage >= Math.ceil(questionPool.length / questionsListPerPage)
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div 
                          className="text-center py-12 bg-white/50 rounded-xl border border-dashed"
                          style={{
                            borderColor: brand.colors.secondary + '33'
                          }}
                        >
                          <FontAwesomeIcon icon={faShuffle} className="mx-auto mb-3"
                            style={{
                              color: brand.colors.secondary + '66'
                            }} />
                          <p className="font-semibold text-gray-900">No questions in pool yet</p>
                          <p className="text-sm text-gray-600 mt-1">Add questions to create a randomized pool</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-5 py-3 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
          {/* Left side - Enroll Students button */}
          <div className="flex flex-col">
            <button
              onClick={openStudentModal}
              className={`px-4 py-2 border font-semibold text-sm rounded-lg transition-all flex items-center space-x-2 ${
                errors.enrolledStudents && showErrors
                  ? 'border-red-400 bg-red-50 hover:bg-red-100 text-red-700'
                  : 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700'
              }`}
            >
              <FontAwesomeIcon icon={faUsers} className="text-xs" />
              <span>Enroll Students</span>
              {enrolledStudents.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full text-white" style={{ background: brand.gradients.primary }}>
                  {enrolledStudents.length}
                </span>
              )}
            </button>
            {errors.enrolledStudents && showErrors && (
              <p className="text-xs text-red-600 mt-1 ml-1 font-semibold">⚠️ {errors.enrolledStudents}</p>
            )}
          </div>
          
          {/* Right side - Cancel and Save */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoadingData}
              className="px-5 py-2 text-white font-semibold text-sm rounded-lg transition-all shadow-md hover:shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: brand.gradients.primary }}
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} className="text-xs" />
                  <span>{existingExam ? 'Update Exam' : 'Create Exam'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Alert Modal */}
      {alertConfig.show && (
        <div 
          className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            {/* Icon Header */}
            <div 
              className={`px-6 py-5 flex flex-col items-center text-center ${
                alertConfig.type === 'error' ? 'bg-gradient-to-br from-red-50 to-rose-100' :
                alertConfig.type === 'success' ? 'bg-gradient-to-br from-emerald-50 to-green-100' :
                'bg-gradient-to-br from-blue-50 to-indigo-100'
              }`}
            >
              <div 
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg mb-4 ${
                  alertConfig.type === 'error' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                  alertConfig.type === 'success' ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
                  'bg-gradient-to-br from-blue-500 to-indigo-600'
                }`}
                style={{
                  animation: alertConfig.type === 'success' ? 'bounceIn 0.5s ease-out' : 'none'
                }}
              >
                {alertConfig.type === 'error' ? (
                  <FontAwesomeIcon icon={faCircleExclamation} className="text-white text-3xl" />
                ) : alertConfig.type === 'success' ? (
                  <FontAwesomeIcon icon={faCircleCheck} className="text-white text-3xl" />
                ) : (
                  <FontAwesomeIcon icon={faCircleExclamation} className="text-white text-3xl" />
                )}
              </div>
              
              <h3 
                className={`text-2xl font-bold mb-2 ${
                  alertConfig.type === 'error' ? 'text-red-900' :
                  alertConfig.type === 'success' ? 'text-emerald-900' :
                  'text-blue-900'
                }`}
              >
                {alertConfig.title}
              </h3>
              
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                {alertConfig.message}
              </p>
            </div>
                
            {/* Action Button */}
            <div className="px-6 py-4 bg-white flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeAlert();
                  // Only close the modal if shouldCloseModal flag is true
                  if (alertConfig.shouldCloseModal) {
                    onClose();
                  }
                }}
                className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 text-white min-w-[140px] ${
                  alertConfig.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' :
                  alertConfig.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700' :
                  'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                {alertConfig.type === 'success' ? 'Awesome!' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Question Creation Modal - Slides in from left */}
      {showCustomQuestionModal && (
        <div 
          className="fixed inset-0 z-[10000]"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="absolute bg-white rounded-2xl flex flex-col overflow-hidden shadow-2xl w-[calc(100%-16px)] max-w-[50rem]"
            style={{
              animation: 'slideInFromLeft 0.3s ease-out',
              top: '8px',
              left: '8px',
              height: 'calc(100% - 16px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b-2 flex-shrink-0 rounded-t-2xl"
              style={{ 
                background: brand.gradients.primary,
                borderColor: brand.colors.secondary
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <FontAwesomeIcon icon={faPen} className="text-white text-sm" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editingQuestionIndex !== null ? 'Edit Question' : 'Create Custom Question'}
                    </h2>
                    <p className="text-xs text-white/80">
                      {editingQuestionIndex !== null ? 'Modify the question details' : 'Design your own question for the exam'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCustomQuestionModal(false);
                    resetCustomQuestionForm();
                    setIsAddingToPool(false);
                    setIsEditingFromPool(false);
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-5">
                {/* Subject & Chapter Selection - Side by Side */}
                <div className="border rounded-xl p-4"
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.accent + '33'
                  }}>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Subject <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={customQuestionSubject}
                        onChange={(e) => {
                          setCustomQuestionSubject(e.target.value);
                          if (e.target.value.toLowerCase() !== 'database' && customQuestionType === QUESTION_TYPES.SQL) {
                            setCustomQuestionType(QUESTION_TYPES.DESCRIPTIVE);
                          }
                        }}
                        className="w-full h-[44px] px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 hover:border-gray-300 bg-white transition-all"
                      >
                        <option value="">Select a subject</option>
                        {subjects.map((sub, index) => (
                          <option key={index} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                    {/* Chapter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Chapter <span className="text-red-500">*</span>
                      </label>
                      {availableChapters.length > 0 && customQuestionChapter !== '__new__' ? (
                        <select
                          value={customQuestionChapter}
                          onChange={(e) => setCustomQuestionChapter(e.target.value)}
                          className="w-full h-[44px] px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 hover:border-gray-300 bg-white transition-all"
                        >
                          <option value="">Select a chapter</option>
                          {availableChapters.map((chapter, index) => (
                            <option key={index} value={chapter}>{chapter}</option>
                          ))}
                          <option value="__new__">+ Add New Chapter</option>
                        </select>
                      ) : (
                        <div>
                          <input
                            type="text"
                            value={customQuestionChapter === '__new__' ? '' : customQuestionChapter}
                            onChange={(e) => setCustomQuestionChapter(e.target.value)}
                            className="w-full h-[44px] px-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 hover:border-gray-300 bg-white transition-all"
                            placeholder="Enter new chapter name"
                          />
                          {availableChapters.length > 0 && (
                            <button
                              onClick={() => setCustomQuestionChapter('')}
                              className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              ← Back to chapter list
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Question Type Selection */}
                <div className="border rounded-xl p-4"
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.accent + '33'
                  }}>
                  <div className="flex items-center space-x-2.5 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: brand.colors.accent + '20' }}>
                      <FontAwesomeIcon icon={faListCheck} style={{ color: brand.colors.accent }} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Question Type</h3>
                      <p className="text-xs" style={{ color: brand.colors.accent, opacity: 0.9 }}>Select the type of question</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-3">
                    {[
                      { 
                        value: QUESTION_TYPES.DESCRIPTIVE, 
                        label: 'Descriptive', 
                        icon: faFileText, 
                        gradient: 'from-green-500 to-teal-500',
                        description: 'Long form answers'
                      },
                      { 
                        value: QUESTION_TYPES.CODE, 
                        label: 'Code', 
                        icon: faCode, 
                        gradient: 'from-indigo-500 to-violet-500',
                        description: 'Programming questions'
                      },
                      { 
                        value: QUESTION_TYPES.SQL, 
                        label: 'SQL', 
                        icon: faDatabase, 
                        gradient: 'from-emerald-500 to-cyan-500',
                        description: 'Database queries',
                        requiresSubject: 'Database'
                      },
                      { 
                        value: QUESTION_TYPES.MCQ, 
                        label: 'Multiple Choice', 
                        icon: faCheckDouble, 
                        gradient: 'from-blue-500 to-cyan-500',
                        description: 'Questions with options'
                      },
                      { 
                        value: QUESTION_TYPES.JUMBLED, 
                        label: 'Jumbled Quiz', 
                        icon: faShuffle, 
                        gradient: 'from-orange-500 to-red-500',
                        description: 'Arrange in order'
                      },
                      { 
                        value: QUESTION_TYPES.FITB, 
                        label: 'Fill in the Blank', 
                        icon: faPenToSquare, 
                        gradient: 'from-purple-500 to-pink-500',
                        description: 'Complete the answer'
                      }
                    ].map((type) => {
                      const isSelected = customQuestionType === type.value;
                      const isSqlDisabled = (type as any).requiresSubject === 'Database' && customQuestionSubject?.toLowerCase() !== 'database';
                      return (
                        <button
                          key={type.value}
                          onClick={() => !isSqlDisabled && setCustomQuestionType(type.value as any)}
                          disabled={isSqlDisabled}
                          title={isSqlDisabled ? 'Select "Database" as subject to enable SQL' : ''}
                          className={`relative p-4 rounded-xl border transition-all text-center overflow-hidden ${
                            isSqlDisabled 
                              ? 'border-gray-200 opacity-40 cursor-not-allowed'
                              : isSelected
                              ? 'border-transparent shadow-lg scale-105'
                              : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                          }`}
                          style={isSelected && !isSqlDisabled ? {
                            background: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                            backgroundImage: `linear-gradient(135deg, ${
                              type.gradient.includes('green') ? '#10b981, #14b8a6' : 
                              type.gradient.includes('emerald') ? '#10b981, #06b6d4' :
                              type.gradient.includes('indigo') ? '#6366f1, #8b5cf6' :
                              type.gradient.includes('blue') ? '#3b82f6, #06b6d4' : 
                              type.gradient.includes('orange') ? '#f97316, #ef4444' :
                              type.gradient.includes('purple') ? '#a855f7, #ec4899' : 
                              '#f97316, #ef4444'
                            })`
                          } : {}}
                        >
                          <div className="text-3xl mb-2">
                            <FontAwesomeIcon icon={type.icon} />
                          </div>
                          <p className={`font-bold text-sm mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            {type.label}
                          </p>
                          <p className={`text-xs ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                            {type.description}
                          </p>
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

                {/* Question Text / Problem Statement */}
                <div className="border rounded-xl p-4"
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.accent + '33'
                  }}>
                  <div className="flex items-center space-x-2.5 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: brand.colors.accent + '20' }}>
                      <FontAwesomeIcon icon={faFileLines} style={{ color: brand.colors.accent }} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {(customQuestionType === QUESTION_TYPES.CODE || customQuestionType === QUESTION_TYPES.SQL) ? 'Problem Statement' : 'Question Text'} <span className="text-red-500">*</span>
                      </h3>
                      <p className="text-xs text-blue-600">
                        {(customQuestionType === QUESTION_TYPES.CODE || customQuestionType === QUESTION_TYPES.SQL) ? 'Describe the SQL problem' : 'Write your question'}
                      </p>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <RichTextEditor
                      value={customQuestionText}
                      onChange={(value) => setCustomQuestionText(value)}
                      darkMode={false}
                      placeholder={(customQuestionType === QUESTION_TYPES.CODE || customQuestionType === QUESTION_TYPES.SQL) ? 'Describe the problem...' : 'Enter your question here...'}
                      minHeight="350px"
                    />
                  </div>
                </div>

                {/* Image Upload Section */}
                <div className="border rounded-xl p-4"
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.accent + '33'
                  }}>
                  <div className="flex items-center space-x-2.5 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: brand.colors.accent + '20' }}>
                      <FontAwesomeIcon icon={faImage} style={{ color: brand.colors.accent }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">Question Images</h3>
                      <p className="text-xs text-blue-600">Add images to your question (optional, max 5)</p>
                    </div>
                    <input
                      ref={customQuestionImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleCustomQuestionImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => customQuestionImageInputRef.current?.click()}
                      disabled={isUploadingCustomQuestionImage || customQuestionImageUrls.length >= 5}
                      className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        background: customQuestionImageUrls.length >= 5 ? '#9ca3af' : brand.gradients.primary 
                      }}
                      title={customQuestionImageUrls.length >= 5 ? 'Maximum 5 images allowed' : 'Add images (max 5, 10MB each)'}
                    >
                      <FontAwesomeIcon icon={faImage} />
                      {isUploadingCustomQuestionImage ? (
                        <span>Uploading...</span>
                      ) : (
                        <span>Add Images ({customQuestionImageUrls.length}/5)</span>
                      )}
                    </button>
                  </div>

                  {/* Image Preview Grid */}
                  {customQuestionImageUrls.length > 0 && (
                    <div className="grid grid-cols-5 gap-3 mt-3">
                      {customQuestionImageUrls.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Question image ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            onClick={() => removeCustomQuestionImage(index)}
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

                {/* Type-specific fields */}
                {customQuestionType === QUESTION_TYPES.MCQ && (
                  <div className="border rounded-xl p-4"
                    style={{ 
                      background: brand.gradients.card,
                      borderColor: brand.colors.accent + '33'
                    }}>
                    <div className="flex items-center space-x-2.5 mb-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#3B82F6' + '20' }}>
                        <FontAwesomeIcon icon={faListCheck} style={{ color: '#3B82F6' }} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Options</h3>
                        <p className="text-sm text-blue-600">Add answer options</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {customQuestionOptions.map((option, index) => {
                        const isCorrect = customQuestionCorrectAnswers.includes(option);
                        return (
                          <div key={index} className="flex items-center space-x-3">
                            {/* Checkbox for marking correct answer */}
                            <div
                              onClick={() => {
                                const newCorrect = [...customQuestionCorrectAnswers];
                                if (newCorrect.includes(option)) {
                                  setCustomQuestionCorrectAnswers(newCorrect.filter(a => a !== option));
                                } else {
                                  setCustomQuestionCorrectAnswers([...newCorrect, option]);
                                }
                              }}
                              className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${
                                isCorrect
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300 hover:border-blue-400 bg-white'
                              }`}
                            >
                              {isCorrect && (
                                <FontAwesomeIcon icon={faCheck} className="text-white" strokeWidth={3} />
                              )}
                            </div>
                            
                            {/* Input field */}
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...customQuestionOptions];
                                newOptions[index] = e.target.value;
                                setCustomQuestionOptions(newOptions);
                              }}
                              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-300 bg-white transition-all"
                              placeholder={`Option ${index + 1}`}
                            />
                            
                            {/* Delete button - always visible */}
                            {customQuestionOptions.length > 2 && (
                              <button
                                onClick={() => {
                                  const newOptions = customQuestionOptions.filter((_, i) => i !== index);
                                  setCustomQuestionOptions(newOptions);
                                  setCustomQuestionCorrectAnswers(customQuestionCorrectAnswers.filter(a => a !== option));
                                }}
                                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0 hover:bg-red-50"
                              >
                                <FontAwesomeIcon icon={faTrash} className="text-red-500" />
                              </button>
                            )}
                            {customQuestionOptions.length <= 2 && (
                              <div className="w-9 h-9 flex-shrink-0"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCustomQuestionOptions([...customQuestionOptions, ''])}
                      className="mt-4 px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center space-x-2 transition-all hover:bg-blue-50 text-blue-600 border border-transparent hover:border-blue-200"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      <span>Add Option</span>
                    </button>
                    <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="text-sm text-gray-700 flex items-start space-x-2">
                        <span className="text-lg">💡</span>
                        <span>Check the boxes to mark correct answers (can select multiple)</span>
                      </div>
                    </div>
                  </div>
                )}

                {customQuestionType === QUESTION_TYPES.FITB && (
                  <div className="border rounded-xl p-4"
                    style={{ 
                      background: brand.gradients.card,
                      borderColor: brand.colors.accent + '33'
                    }}>
                    <div className="flex items-center space-x-2.5 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: brand.colors.accent + '20' }}>
                        <FontAwesomeIcon icon={faCircleCheck} style={{ color: brand.colors.accent }} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Correct Answer(s) <span className="text-red-500">*</span></h3>
                        <p className="text-xs text-blue-600">Add acceptable answers for the blank</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {customQuestionBlanks.map((blank, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <input
                            type="text"
                            value={blank}
                            onChange={(e) => {
                              const newBlanks = [...customQuestionBlanks];
                              newBlanks[index] = e.target.value;
                              setCustomQuestionBlanks(newBlanks);
                            }}
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400 hover:border-gray-300 bg-white transition-all"
                            placeholder={`Answer ${index + 1}`}
                          />
                          {customQuestionBlanks.length > 1 && (
                            <button
                              onClick={() => setCustomQuestionBlanks(customQuestionBlanks.filter((_, i) => i !== index))}
                              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0 hover:bg-red-50"
                            >
                              <FontAwesomeIcon icon={faTrash} className="text-red-500" />
                            </button>
                          )}
                          {customQuestionBlanks.length <= 1 && (
                            <div className="w-9 h-9 flex-shrink-0"></div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setCustomQuestionBlanks([...customQuestionBlanks, ''])}
                      className="mt-4 px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center space-x-2 transition-all hover:bg-blue-50 text-blue-600 border border-transparent hover:border-blue-200"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      <span>Add Answer</span>
                    </button>
                    <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="text-sm text-gray-700 flex items-start space-x-2">
                        <span className="text-lg">💡</span>
                        <span>Add multiple acceptable answers</span>
                      </div>
                    </div>
                  </div>
                )}

                {customQuestionType === QUESTION_TYPES.JUMBLED && (
                  <div className="border rounded-xl p-4"
                    style={{ 
                      background: brand.gradients.card,
                      borderColor: brand.colors.accent + '33'
                    }}>
                    <div className="flex items-center space-x-2.5 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: brand.colors.accent + '20' }}>
                        <FontAwesomeIcon icon={faGripVertical} style={{ color: brand.colors.accent }} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Items to Arrange</h3>
                        <p className="text-xs text-blue-600">Drag to set correct order</p>
                      </div>
                    </div>
                    
                    <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="text-sm text-gray-700 flex items-start space-x-2">
                        <span className="text-lg">💡</span>
                        <span>Drag and drop to set the correct order. Students will see them jumbled.</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {customQuestionSequence.map((item, index) => (
                        <div
                          key={index}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center space-x-3 p-3 bg-white border rounded-lg cursor-move transition-all ${
                            draggedIndex === index ? 'opacity-50 border-blue-400' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <FontAwesomeIcon icon={faGripVertical} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-bold text-gray-700 w-8 flex-shrink-0">#{index + 1}</span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const newSequence = [...customQuestionSequence];
                              newSequence[index] = e.target.value;
                              setCustomQuestionSequence(newSequence);
                            }}
                            className="flex-1 px-3 py-2 border-0 focus:ring-0 text-sm text-gray-900 placeholder-gray-400 bg-transparent"
                            placeholder={`Item ${index + 1}`}
                          />
                          {customQuestionSequence.length > 2 && (
                            <button
                              onClick={() => setCustomQuestionSequence(customQuestionSequence.filter((_, i) => i !== index))}
                              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0 hover:bg-red-50"
                            >
                              <FontAwesomeIcon icon={faTrash} className="text-red-500" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => setCustomQuestionSequence([...customQuestionSequence, ''])}
                      className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg border border-dashed border-gray-300 hover:border-gray-400 text-gray-700 transition-colors"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      <span>Add Item</span>
                    </button>
                  </div>
                )}

                {customQuestionType === QUESTION_TYPES.DESCRIPTIVE && (
                  <div className="border rounded-xl p-4"
                    style={{ 
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      borderColor: '#fbbf24'
                    }}>
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-200 flex-shrink-0">
                        <FontAwesomeIcon icon={faCircleExclamation} className="text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-amber-900 mb-1">Descriptive Answer</h3>
                        <p className="text-sm text-amber-800">This type requires manual evaluation. Students will write detailed answers that you'll grade manually.</p>
                      </div>
                    </div>
                  </div>
                )}
                {customQuestionType === QUESTION_TYPES.CODE && (
                  <div className="space-y-4">
                    {/* Test Stub / Starter Code */}
                    <div className="border rounded-xl p-4"
                      style={{ 
                        background: brand.gradients.card,
                        borderColor: brand.colors.accent + '33'
                      }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: brand.colors.accent + '20' }}>
                            <FontAwesomeIcon icon={faFileLines} style={{ color: brand.colors.accent }} />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">Starter Code <span className="text-red-500">*</span></h3>
                            <p className="text-xs text-blue-600">Pre-filled code template for students</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowStarterCodeHelp(!showStarterCodeHelp)}
                          className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                          title="Show examples"
                        >
                          <FontAwesomeIcon icon={faCircleQuestion} />
                        </button>
                      </div>

                      {showStarterCodeHelp && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-2">
                          <p className="font-semibold text-blue-900">💡 Starter Code Examples:</p>
                          
                          <div className="space-y-3">
                            <div>
                              <p className="font-medium text-blue-800 mb-1">Python:</p>
                              <pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto custom-scrollbar">
{`def solution(n):
    # Write your code here
    pass`}
                              </pre>
                            </div>

                            <div>
                              <p className="font-medium text-blue-800 mb-1">Java:</p>
                              <pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto custom-scrollbar">
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
                              <pre className="bg-white p-2 rounded border border-blue-200 font-mono text-[10px] overflow-x-auto custom-scrollbar">
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

                      <div className="space-y-4">
                        {customStarterCodes.map((sc, scIndex) => {
                          const allLanguages = [{ value: 'c', label: 'C' },{ value: 'cpp', label: 'C++' },{ value: 'python', label: 'Python' },{ value: 'java', label: 'Java' },{ value: 'javascript', label: 'JavaScript' },{ value: 'csharp', label: 'C#' },{ value: 'go', label: 'Go' },{ value: 'scala', label: 'Scala' },{ value: 'typescript', label: 'TypeScript' },{ value: 'bash', label: 'Bash/Shell' },{ value: 'kotlin', label: 'Kotlin' },{ value: 'lua', label: 'Lua' },{ value: 'assembly', label: 'Assembly' },{ value: 'dart', label: 'Dart' },{ value: 'swift', label: 'Swift' },{ value: 'r', label: 'R' },{ value: 'groovy', label: 'Groovy' },{ value: 'perl', label: 'Perl' },{ value: 'php', label: 'PHP' },{ value: 'rust', label: 'Rust' }];
                          const usedLanguages = customStarterCodes.filter((_, i) => i !== scIndex).map(s => s.language);
                          const availableLanguages = allLanguages.filter(l => !usedLanguages.includes(l.value));
                          return (
                            <div key={scIndex} className="border border-gray-200 rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2 flex-1">
                                  <span className="text-xs font-semibold text-gray-500">#{scIndex + 1}</span>
                                  <select value={sc.language} onChange={(e) => { const updated = [...customStarterCodes]; updated[scIndex] = { ...updated[scIndex], language: e.target.value }; setCustomStarterCodes(updated); }} className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:border-transparent hover:border-gray-400 bg-white" style={{ minWidth: '130px' }}>
                                    {availableLanguages.map(lang => (<option key={lang.value} value={lang.value}>{lang.label}</option>))}
                                  </select>
                                </div>
                                {customStarterCodes.length > 1 && (<button type="button" onClick={() => { const updated = customStarterCodes.filter((_, i) => i !== scIndex); setCustomStarterCodes(updated); if (scIndex === 0 && updated.length > 0) { setCustomQuestionTestStub(updated[0].code); } }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove this starter code"><FontAwesomeIcon icon={faTrash} className="text-xs" /></button>)}
                              </div>
                              <textarea value={sc.code} onChange={(e) => { const updated = [...customStarterCodes]; updated[scIndex] = { ...updated[scIndex], code: e.target.value }; setCustomStarterCodes(updated); if (scIndex === 0) { setCustomQuestionTestStub(e.target.value); } }} placeholder={`// Write starter code for ${sc.language === 'python' ? 'Python' : sc.language === 'cpp' ? 'C++' : sc.language === 'csharp' ? 'C#' : sc.language === 'javascript' ? 'JavaScript' : sc.language === 'typescript' ? 'TypeScript' : sc.language === 'bash' ? 'Bash/Shell' : sc.language.charAt(0).toUpperCase() + sc.language.slice(1)}...`} rows={5} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-y text-sm font-mono" style={{ minHeight: '48px', maxHeight: '300px' }} />
                            </div>
                          );
                        })}
                      </div>
                      {(() => { const allLangCount = 20; const currentCount = customStarterCodes.length; if (currentCount >= allLangCount) return null; return (<button type="button" onClick={() => { const allLangs = ['c','cpp','python','java','javascript','csharp','go','scala','typescript','bash','kotlin','lua','assembly','dart','swift','r','groovy','perl','php','rust']; const usedLangs = customStarterCodes.map(s => s.language); const nextLang = allLangs.find(l => !usedLangs.includes(l)) || 'c'; setCustomStarterCodes([...customStarterCodes, { language: nextLang, code: '' }]); }} className="mt-3 flex items-center space-x-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 text-xs font-semibold transition-colors w-full justify-center"><FontAwesomeIcon icon={faPlus} className="text-xs" /><span>Add Another Language</span></button>); })()}
                    </div>

                    {/* Test Cases */}
                    <div className="border rounded-xl p-4"
                      style={{ 
                        background: brand.gradients.card,
                        borderColor: brand.colors.accent + '33'
                      }}>
                      <div className="flex items-center space-x-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: brand.colors.accent + '20' }}>
                          <FontAwesomeIcon icon={faListCheck} style={{ color: brand.colors.accent }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Test Cases <span className="text-red-500">*</span></h3>
                          <p className="text-xs text-blue-600">Input and expected output pairs</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {customQuestionTestCases.map((testCase, index) => (
                          <div key={index} className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={testCase.input}
                                  onChange={(e) => {
                                    const newTestCases = [...customQuestionTestCases];
                                    newTestCases[index].input = e.target.value;
                                    setCustomQuestionTestCases(newTestCases);
                                  }}
                                  placeholder="Input (e.g., 5)"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors"
                                />
                                <input
                                  type="text"
                                  value={testCase.expected_output}
                                  onChange={(e) => {
                                    const newTestCases = [...customQuestionTestCases];
                                    newTestCases[index].expected_output = e.target.value;
                                    setCustomQuestionTestCases(newTestCases);
                                  }}
                                  placeholder="Expected Output (e.g., 120)"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors"
                                />
                              </div>
                              <input
                                type="number"
                                value={testCase.marks || 0}
                                onChange={(e) => {
                                  const newTestCases = [...customQuestionTestCases];
                                  newTestCases[index].marks = parseFloat(e.target.value) || 0;
                                  setCustomQuestionTestCases(newTestCases);
                                }}
                                placeholder="Marks (e.g., 0.5)"
                                step="0.1"
                                min="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors"
                              />
                            </div>
                            {customQuestionTestCases.length > 1 && (
                              <button
                                onClick={() => {
                                  const newTestCases = customQuestionTestCases.filter((_, i) => i !== index);
                                  setCustomQuestionTestCases(newTestCases);
                                }}
                                className="w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all mt-7"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newTestCases = [...customQuestionTestCases, { input: '', expected_output: '', marks: 0 }];
                            setCustomQuestionTestCases(newTestCases);
                          }}
                          className="flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                          <span>Add Test Case</span>
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">💡 Add multiple test cases with marks. The sum of all test case marks should equal the maximum marks.</p>
                    </div>
                  </div>
                )}

                {/* SQL Question Section */}
                {customQuestionType === QUESTION_TYPES.SQL && (
                  <div className="space-y-4">
                    {/* Step 1: Table Schema */}
                    <div className="border rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', borderColor: '#86efac' }}>
                      <div className="flex items-center space-x-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100">
                          <span className="text-xl">🗄️</span>
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">① Table Schema <span className="text-red-500">*</span></h3>
                          <p className="text-xs text-green-600">Define your database tables — columns, types, and constraints</p>
                        </div>
                      </div>
                      
                      {customSqlSchema.map((table, tIdx) => (
                        <div key={tIdx} className="mb-3 border border-green-200 rounded-lg overflow-hidden bg-white">
                          <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-100">
                            <div className="flex items-center space-x-2 flex-1">
                              <span className="text-xs font-bold text-green-700">TABLE {tIdx + 1}</span>
                              <input type="text" value={table.table_name} onChange={(e) => { const u = [...customSqlSchema]; u[tIdx] = { ...u[tIdx], table_name: e.target.value }; setCustomSqlSchema(u); }} placeholder="Table name (e.g., Employee)" className="flex-1 px-2 py-1 border border-green-200 rounded text-sm font-semibold focus:ring-1 focus:ring-green-400" />
                            </div>
                            {customSqlSchema.length > 1 && (
                              <button type="button" onClick={() => setCustomSqlSchema(customSqlSchema.filter((_, i) => i !== tIdx))} className="ml-2 text-red-400 hover:text-red-600"><FontAwesomeIcon icon={faTrash} className="text-xs" /></button>
                            )}
                          </div>
                          <div className="p-3 space-y-2">
                            {/* Column headers */}
                            <div className="grid grid-cols-[1fr_0.7fr_1fr_0.8fr_auto] gap-1.5 text-[10px] font-semibold text-gray-500 uppercase px-1">
                              <span>Column Name</span><span>Type</span><span>Description</span><span>Constraints</span><span className="w-5"></span>
                            </div>
                            {table.columns.map((col, cIdx) => (
                              <div key={cIdx} className="grid grid-cols-[1fr_0.7fr_1fr_0.8fr_auto] gap-1.5">
                                <input type="text" value={col.name} onChange={(e) => { const u = [...customSqlSchema]; u[tIdx].columns[cIdx] = { ...col, name: e.target.value }; setCustomSqlSchema(u); }} placeholder="e.g., id" className="px-2 py-1.5 border border-gray-200 rounded text-xs font-mono focus:ring-1" />
                                <select value={col.type} onChange={(e) => { const u = [...customSqlSchema]; u[tIdx].columns[cIdx] = { ...col, type: e.target.value }; setCustomSqlSchema(u); }} className="px-1 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 bg-white">
                                  {['int','bigint','float','double','decimal','varchar','char','text','date','datetime','timestamp','boolean','blob'].map(t => (<option key={t} value={t}>{t}</option>))}
                                </select>
                                <input type="text" value={col.description} onChange={(e) => { const u = [...customSqlSchema]; u[tIdx].columns[cIdx] = { ...col, description: e.target.value }; setCustomSqlSchema(u); }} placeholder="Description" className="px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1" />
                                <input type="text" value={col.constraints} onChange={(e) => { const u = [...customSqlSchema]; u[tIdx].columns[cIdx] = { ...col, constraints: e.target.value }; setCustomSqlSchema(u); }} placeholder="PK, NOT NULL..." className="px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1" />
                                {table.columns.length > 1 && (<button type="button" onClick={() => { const u = [...customSqlSchema]; u[tIdx] = { ...u[tIdx], columns: u[tIdx].columns.filter((_, i) => i !== cIdx) }; setCustomSqlSchema(u); }} className="text-red-400 hover:text-red-600 w-5 flex items-center justify-center"><FontAwesomeIcon icon={faTrash} className="text-[10px]" /></button>)}
                              </div>
                            ))}
                            <button type="button" onClick={() => { const u = [...customSqlSchema]; u[tIdx] = { ...u[tIdx], columns: [...u[tIdx].columns, { name: '', type: 'int', description: '', constraints: '' }] }; setCustomSqlSchema(u); }} className="text-xs text-green-600 hover:text-green-800 font-medium mt-1">+ Add Column</button>
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
                              <input type="text" value={table.primary_key} onChange={(e) => { const u = [...customSqlSchema]; u[tIdx] = { ...u[tIdx], primary_key: e.target.value }; setCustomSqlSchema(u); }} placeholder="e.g., id" className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
                              <input type="text" value={table.note} onChange={(e) => { const u = [...customSqlSchema]; u[tIdx] = { ...u[tIdx], note: e.target.value }; setCustomSqlSchema(u); }} placeholder="e.g., Each row = one employee" className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setCustomSqlSchema([...customSqlSchema, { table_name: '', columns: [{ name: '', type: 'int', description: '', constraints: '' }], primary_key: '', note: '' }])} className="text-xs text-green-600 hover:text-green-800 font-semibold">+ Add Another Table</button>
                    </div>

                    {/* Step 2: SQL Test Cases */}
                    {(() => {
                      const hasValidSchema = customSqlSchema.some(t => t.table_name.trim() && t.columns.some(c => c.name.trim()));
                      if (!hasValidSchema) {
                        return (
                          <div className="border rounded-xl p-4 bg-amber-50 border-amber-200">
                            <div className="flex items-center space-x-2 text-amber-700">
                              <span>🔒</span>
                              <span className="text-sm font-semibold">Schema Required</span>
                            </div>
                            <p className="text-xs text-amber-600 mt-1">Define at least one table with a name and column in the schema above to unlock test cases.</p>
                          </div>
                        );
                      }
                      const allSchemaCols = customSqlSchema.flatMap(t => t.columns.map(c => c.name).filter(n => n.trim()));
                      const maxOutputCols = allSchemaCols.length;
                      return (
                        <div className="border rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderColor: '#fbbf24' }}>
                          <div className="flex items-center space-x-2.5 mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100">
                              <span className="text-xl">📝</span>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">② Test Cases <span className="text-red-500">*</span></h3>
                              <p className="text-xs text-amber-600">Input data auto-populates from your schema — just fill in values</p>
                            </div>
                          </div>
                          
                          {customSqlTestCases.map((tc, tcIdx) => (
                            <div key={tcIdx} className="mb-3 border border-amber-200 rounded-lg overflow-hidden bg-white">
                              <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-100">
                                <div className="flex items-center space-x-2 flex-1">
                                  <span className="text-xs font-bold text-amber-700">TEST {tcIdx + 1}</span>
                                  <input type="text" value={tc.title} onChange={(e) => { const u = [...customSqlTestCases]; u[tcIdx] = { ...u[tcIdx], title: e.target.value }; setCustomSqlTestCases(u); }} className="flex-1 px-2 py-1 border border-amber-200 rounded text-sm focus:ring-1" />
                                </div>
                                <div className="flex items-center space-x-2 ml-2">
                                  <span className="text-[10px] font-bold text-gray-500">MARKS:</span>
                                  <input type="number" value={tc.marks} onChange={(e) => { const u = [...customSqlTestCases]; u[tcIdx] = { ...u[tcIdx], marks: parseFloat(e.target.value) || 0 }; setCustomSqlTestCases(u); }} className="w-16 px-2 py-1 border border-amber-200 rounded text-sm text-center font-bold" step="0.5" min="0" />
                                  {customSqlTestCases.length > 1 && (<button type="button" onClick={() => setCustomSqlTestCases(customSqlTestCases.filter((_, i) => i !== tcIdx))} className="text-red-400 hover:text-red-600"><FontAwesomeIcon icon={faTrash} className="text-xs" /></button>)}
                                </div>
                              </div>
                              <div className="p-3 space-y-3">
                                {/* Input Tables */}
                                {customSqlSchema.filter(t => t.table_name.trim()).map((schemaTable) => {
                                  const tableName = schemaTable.table_name;
                                  const colNames = schemaTable.columns.map(c => c.name).filter(n => n.trim());
                                  const rows = tc.table_data[tableName] || [];
                                  if (colNames.length === 0) return null;
                                  return (
                                    <div key={tableName} className="border border-blue-100 rounded-lg overflow-hidden">
                                      <div className="flex items-center justify-between px-2 py-1.5 bg-blue-50 border-b border-blue-100">
                                        <span className="text-xs font-bold text-blue-600">📥 Input: {tableName}</span>
                                        <button type="button" onClick={() => { const u = [...customSqlTestCases]; const td = { ...u[tcIdx].table_data }; td[tableName] = [...(td[tableName] || []), colNames.map(() => '')]; u[tcIdx] = { ...u[tcIdx], table_data: td }; setCustomSqlTestCases(u); }} className="text-[10px] font-medium text-blue-600 hover:text-blue-800">+ Add Row</button>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                          <thead><tr className="bg-gray-50">{colNames.map((cn, ci) => (<th key={ci} className="px-2 py-1.5 text-left font-semibold text-gray-600 border-b">{cn}</th>))}<th className="w-7 border-b"></th></tr></thead>
                                          <tbody>{rows.map((row, rIdx) => (<tr key={rIdx}>{colNames.map((_, ci) => (<td key={ci} className="px-1 py-1 border-b border-gray-100"><input type="text" value={row[ci] || ''} onChange={(e) => { const u = [...customSqlTestCases]; const td = { ...u[tcIdx].table_data }; const tRows = [...(td[tableName] || [])]; const nr = [...tRows[rIdx]]; nr[ci] = e.target.value; tRows[rIdx] = nr; td[tableName] = tRows; u[tcIdx] = { ...u[tcIdx], table_data: td }; setCustomSqlTestCases(u); }} className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs font-mono focus:ring-1" /></td>))}<td className="px-1 py-1 border-b"><button type="button" onClick={() => { const u = [...customSqlTestCases]; const td = { ...u[tcIdx].table_data }; td[tableName] = (td[tableName] || []).filter((_, i) => i !== rIdx); u[tcIdx] = { ...u[tcIdx], table_data: td }; setCustomSqlTestCases(u); }} className="text-red-400 hover:text-red-600"><FontAwesomeIcon icon={faTrash} className="text-[10px]" /></button></td></tr>))}</tbody>
                                        </table>
                                        {rows.length === 0 && <p className="text-xs text-gray-400 italic p-2">No rows yet — click + Add Row above</p>}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Expected Output */}
                                <div className="border border-green-200 rounded-lg overflow-hidden">
                                  <div className="flex items-center justify-between px-2 py-1.5 bg-green-50 border-b border-green-100">
                                    <span className="text-xs font-semibold text-green-700">📤 Expected Output <span className="text-[9px] font-normal text-green-500">({tc.expected_output.columns.length}/{maxOutputCols} cols)</span></span>
                                    <div className="flex items-center space-x-2">
                                      <button type="button" disabled={tc.expected_output.columns.length >= maxOutputCols} onClick={() => { const u = [...customSqlTestCases]; const eo = u[tcIdx].expected_output; u[tcIdx] = { ...u[tcIdx], expected_output: { columns: [...eo.columns, ''], rows: eo.rows.map(r => [...r, '']) } }; setCustomSqlTestCases(u); }} className={`text-[10px] font-medium ${tc.expected_output.columns.length >= maxOutputCols ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:text-green-800'}`}>+ Column</button>
                                      <button type="button" onClick={() => { const u = [...customSqlTestCases]; const eo = u[tcIdx].expected_output; u[tcIdx] = { ...u[tcIdx], expected_output: { ...eo, rows: [...eo.rows, eo.columns.map(() => '')] } }; setCustomSqlTestCases(u); }} className="text-[10px] font-medium text-green-600 hover:text-green-800">+ Row</button>
                                    </div>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead><tr className="bg-green-50/50">{tc.expected_output.columns.map((col, ci) => { const usedCols = tc.expected_output.columns.filter((_, i) => i !== ci); const availableCols = allSchemaCols.filter(c => !usedCols.includes(c)); return (<th key={ci} className="px-1 py-1.5 border-b"><div className="flex items-center space-x-1"><select value={col} onChange={(e) => { const u = [...customSqlTestCases]; const cols = [...u[tcIdx].expected_output.columns]; cols[ci] = e.target.value; u[tcIdx] = { ...u[tcIdx], expected_output: { ...u[tcIdx].expected_output, columns: cols } }; setCustomSqlTestCases(u); }} className="w-full px-1.5 py-1 border border-green-200 rounded text-xs font-semibold focus:ring-1 bg-white">{!col && <option value="">Select column</option>}{availableCols.map(c => (<option key={c} value={c}>{c}</option>))}{col && !availableCols.includes(col) && <option value={col}>{col}</option>}</select>{tc.expected_output.columns.length > 1 && (<button type="button" onClick={() => { const u = [...customSqlTestCases]; const eo = u[tcIdx].expected_output; u[tcIdx] = { ...u[tcIdx], expected_output: { columns: eo.columns.filter((_, i) => i !== ci), rows: eo.rows.map(r => r.filter((_, i) => i !== ci)) } }; setCustomSqlTestCases(u); }} className="text-red-400 hover:text-red-600 flex-shrink-0"><FontAwesomeIcon icon={faTrash} className="text-[10px]" /></button>)}</div></th>); })}<th className="w-7 border-b"></th></tr></thead>
                                      <tbody>{tc.expected_output.rows.map((row, rIdx) => (<tr key={rIdx}>{tc.expected_output.columns.map((_, ci) => (<td key={ci} className="px-1 py-1 border-b border-gray-100"><input type="text" value={row[ci] || ''} onChange={(e) => { const u = [...customSqlTestCases]; const rows = [...u[tcIdx].expected_output.rows]; const nr = [...rows[rIdx]]; nr[ci] = e.target.value; rows[rIdx] = nr; u[tcIdx] = { ...u[tcIdx], expected_output: { ...u[tcIdx].expected_output, rows } }; setCustomSqlTestCases(u); }} className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs font-mono focus:ring-1" /></td>))}<td className="px-1 py-1 border-b border-gray-100">{tc.expected_output.rows.length > 1 && (<button type="button" onClick={() => { const u = [...customSqlTestCases]; u[tcIdx] = { ...u[tcIdx], expected_output: { ...u[tcIdx].expected_output, rows: u[tcIdx].expected_output.rows.filter((_, i) => i !== rIdx) } }; setCustomSqlTestCases(u); }} className="text-red-400 hover:text-red-600"><FontAwesomeIcon icon={faTrash} className="text-[10px]" /></button>)}</td></tr>))}</tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <button type="button" onClick={() => setCustomSqlTestCases([...customSqlTestCases, { title: `Test Case ${customSqlTestCases.length + 1}`, table_data: {}, expected_output: { columns: [''], rows: [['']] }, marks: 0 }])} className="text-xs text-amber-600 hover:text-amber-800 font-semibold mt-1">+ Add Test Case</button>
                          
                          {/* Marks tracker */}
                          <div className="mt-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-between">
                            <span className="text-xs text-yellow-700">💡 Test case marks total: <b>{customSqlTestCases.reduce((s, tc) => s + (tc.marks || 0), 0)}</b> / <b>{customQuestionMarks}</b> (max marks)</span>
                            {customSqlTestCases.reduce((s, tc) => s + (tc.marks || 0), 0) !== customQuestionMarks && (
                              <span className="text-xs text-amber-600 font-medium">Remaining: {customQuestionMarks - customSqlTestCases.reduce((s, tc) => s + (tc.marks || 0), 0)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Marks and Difficulty Level */}
                <div className="border rounded-xl p-4"
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.accent + '33'
                  }}>
                  <div className="flex items-center space-x-2.5 mb-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-cyan-100">
                      <FontAwesomeIcon icon={faAward} className="text-cyan-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Marks & Difficulty</h3>
                      <p className="text-sm text-blue-600">Set marks and complexity level</p>
                    </div>
                  </div>

                  <div className="flex items-end gap-6">
                    {/* Maximum Marks */}
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Maximum Marks <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={customQuestionMarks}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setCustomQuestionMarks('' as any);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              setCustomQuestionMarks(numValue);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '' || parseFloat(e.target.value) < 0.5) {
                            setCustomQuestionMarks(0.5);
                          }
                        }}
                        min="0.5"
                        step="0.5"
                        className="w-full h-10 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 hover:border-gray-300 bg-white transition-all"
                        placeholder="Enter marks (min 0.5)"
                      />
                    </div>

                    {/* Difficulty Level */}
                    <div className="flex-[3]">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Difficulty Level <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'easy', emoji: '😊', label: 'Easy', selectedBg: '#10b981', unselectedBg: '#d1fae5', selectedText: '#ffffff', unselectedText: '#065f46' },
                          { value: 'medium', emoji: '🤔', label: 'Medium', selectedBg: '#f59e0b', unselectedBg: '#fef3c7', selectedText: '#ffffff', unselectedText: '#92400e' },
                          { value: 'hard', emoji: '😰', label: 'Hard', selectedBg: '#ef4444', unselectedBg: '#fee2e2', selectedText: '#ffffff', unselectedText: '#991b1b' }
                        ].map((level) => {
                          const isSelected = customQuestionComplexity === level.value;
                          return (
                            <button
                              key={level.value}
                              onClick={() => setCustomQuestionComplexity(level.value as any)}
                              className={`relative flex items-center justify-center space-x-1.5 h-10 rounded-lg border transition-all text-sm ${
                                isSelected ? 'shadow-sm' : 'border-gray-200 hover:border-gray-300'
                              }`}
                              style={isSelected ? {
                                backgroundColor: level.selectedBg,
                                borderColor: level.selectedBg,
                                color: level.selectedText
                              } : {
                                backgroundColor: level.unselectedBg,
                                color: level.unselectedText,
                                borderColor: 'transparent'
                              }}
                            >
                              <span className="text-sm">{level.emoji}</span>
                              <span className="font-semibold capitalize">{level.label}</span>
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                                  <FontAwesomeIcon icon={faCheck} className="text-[10px]" style={{ color: level.selectedBg }} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Help Students - Hint and Solution */}
                <div className="border rounded-xl p-4"
                  style={{ 
                    background: brand.gradients.card,
                    borderColor: brand.colors.accent + '33'
                  }}>
                  <div className="flex items-center space-x-2.5 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: brand.colors.accent + '20' }}>
                      <FontAwesomeIcon icon={faCircleQuestion} style={{ color: brand.colors.accent }} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Help Students</h3>
                      <p className="text-xs text-blue-600">
                        <span className="text-gray-400">(Optional)</span> Provide hints & solutions
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-1.5">Hint</label>
                      <textarea
                        value={customQuestionHint}
                        onChange={(e) => setCustomQuestionHint(e.target.value)}
                        placeholder="Provide a helpful hint..."
                        rows={2}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none text-sm font-medium hover:border-gray-400 bg-white custom-scrollbar"
                      />
                    </div>

                    {customQuestionType !== QUESTION_TYPES.CODE && customQuestionType !== QUESTION_TYPES.SQL && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-1.5">Solution</label>
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                          <RichTextEditor
                            value={customQuestionSolution}
                            onChange={(value) => setCustomQuestionSolution(value)}
                            darkMode={false}
                            placeholder="Provide detailed solution..."
                            minHeight="250px"
                          />
                        </div>
                    </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-5 py-3 flex items-center justify-end space-x-3 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => {
                  setShowCustomQuestionModal(false);
                  resetCustomQuestionForm();
                  setIsAddingToPool(false);
                  setIsEditingFromPool(false);
                }}
                className="px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomQuestion}
                className="px-5 py-2 text-white font-semibold text-sm rounded-lg transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
                style={{ background: 'linear-gradient(to right, #22c55e, #10b981)' }}
              >
                <FontAwesomeIcon icon={faCheck} className="text-xs" />
                <span>{editingQuestionIndex !== null ? 'Update Question' : 'Add Question'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Bank Modal - Slides in from left */}
      {showQuestionBankModal && (
        <div 
          className="fixed inset-0 z-[10000]"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="absolute bg-white rounded-2xl flex flex-col overflow-hidden shadow-2xl w-[calc(100%-16px)] max-w-[50rem]"
            style={{
              animation: 'slideInFromLeft 0.3s ease-out',
              top: '8px',
              left: '8px',
              height: 'calc(100% - 16px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b-2 flex-shrink-0"
              style={{ 
                background: brand.gradients.primary,
                borderColor: brand.colors.secondary
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <FontAwesomeIcon icon={faBookAtlas} className="text-white text-sm" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Question Bank
                    </h2>
                    <p className="text-xs text-white/80">Select questions to add to your exam</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQuestionBankModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
                </button>
              </div>
            </div>
              
            {/* Filters Row */}
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center space-x-2 flex-wrap gap-y-2">
              <span className="text-xs font-semibold text-gray-500">Filters:</span>
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  {boards.length > 1 && (
                    <div className="px-3 py-1.5 bg-gray-200 rounded-lg flex items-center space-x-1.5">
                      <FontAwesomeIcon icon={faBuilding} className="text-gray-600 text-xs" />
                      <span className="text-xs font-bold text-gray-700">{board}</span>
                    </div>
                  )}

                  {/* Class Filter Dropdown */}
                  <div className="relative filter-dropdown">
                    <button
                      onClick={() => {
                        setShowQBClassDropdown(!showQBClassDropdown);
                        setShowQBSubjectDropdown(false);
                        setShowQuestionTypeDropdown(false);
                        setShowComplexityDropdown(false);
                        setShowChapterDropdown(false);
                        setShowTagDropdown(false);
                      }}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg flex items-center space-x-1.5 hover:bg-gray-100 transition-colors"
                    >
                      <FontAwesomeIcon icon={faGraduationCap} className="text-gray-500 text-xs" />
                      <span className="text-xs font-semibold text-gray-700">
                        {className || 'All Classes'}
                      </span>
                      <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-xs" />
                    </button>
                    
                    {showQBClassDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[160px] max-h-[250px] overflow-y-auto custom-scrollbar py-1 border">
                        <button
                          onClick={() => {
                            setClassName('');
                            setSubject('');
                            setShowQBClassDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                            !className ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          All Classes
                        </button>
                        {classes.map((cls) => (
                          <button
                            key={cls}
                            onClick={() => {
                              setClassName(cls);
                              setSubject('');
                              setShowQBClassDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              className === cls ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subject Filter Dropdown */}
                  <div className="relative filter-dropdown">
                    <button
                      onClick={() => {
                        setShowQBSubjectDropdown(!showQBSubjectDropdown);
                        setShowQBClassDropdown(false);
                        setShowQuestionTypeDropdown(false);
                        setShowComplexityDropdown(false);
                        setShowChapterDropdown(false);
                        setShowTagDropdown(false);
                      }}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg flex items-center space-x-1.5 hover:bg-gray-100 transition-colors"
                    >
                      <FontAwesomeIcon icon={faBook} className="text-gray-500 text-xs" />
                      <span className="text-xs font-semibold text-gray-700">
                        {subject || 'All Subjects'}
                      </span>
                      <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-xs" />
                    </button>
                    
                    {showQBSubjectDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[160px] max-h-[250px] overflow-y-auto custom-scrollbar py-1 border">
                        <button
                          onClick={() => {
                            setSubject('');
                            setShowQBSubjectDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                            !subject ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          All Subjects
                        </button>
                        {subjects.map((subj) => (
                          <button
                            key={subj}
                            onClick={() => {
                              setSubject(subj);
                              setShowQBSubjectDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              subject === subj ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {subj}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Question Type Filter Dropdown */}
                  <div className="relative filter-dropdown">
                    <button
                      onClick={() => {
                        setShowQuestionTypeDropdown(!showQuestionTypeDropdown);
                        setShowComplexityDropdown(false);
                        setShowChapterDropdown(false);
                        setShowTagDropdown(false);
                        setShowQBClassDropdown(false);
                        setShowQBSubjectDropdown(false);
                      }}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg flex items-center space-x-1.5 hover:bg-gray-100 transition-colors"
                    >
                      <FontAwesomeIcon icon={faFilter} className="text-gray-500 text-xs" />
                      <span className="text-xs font-semibold text-gray-700">
                        {questionTypeFilter === FILTER_VALUES.ALL ? 'All Types' : 
                         questionTypeFilter === QUESTION_TYPES.MCQ ? 'MCQ' :
                         questionTypeFilter === QUESTION_TYPES.FITB ? 'Fill Blank' :
                         questionTypeFilter === QUESTION_TYPES.JUMBLED ? 'Jumbled' :
                         questionTypeFilter === QUESTION_TYPES.CODE ? 'Code' :
                         questionTypeFilter === QUESTION_TYPES.SQL ? 'SQL' :
                         'Descriptive'}
                      </span>
                      <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-xs" />
                    </button>
                    
                    {showQuestionTypeDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[150px] py-1 border">
                        {[
                          { value: 'all', label: 'All Types' },
                          { value: QUESTION_TYPES.MCQ, label: 'MCQ' },
                          { value: 'fitb', label: 'Fill in the Blank' },
                          { value: 'jumbled', label: 'Jumbled' },
                          { value: QUESTION_TYPES.DESCRIPTIVE, label: 'Descriptive' },
                          { value: QUESTION_TYPES.CODE, label: 'Code' },
                          { value: QUESTION_TYPES.SQL, label: 'SQL' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setQuestionTypeFilter(option.value);
                              setShowQuestionTypeDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              questionTypeFilter === option.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Complexity Filter Dropdown */}
                  <div className="relative filter-dropdown">
                    <button
                      onClick={() => {
                        setShowComplexityDropdown(!showComplexityDropdown);
                        setShowQuestionTypeDropdown(false);
                        setShowChapterDropdown(false);
                        setShowTagDropdown(false);
                        setShowQBClassDropdown(false);
                        setShowQBSubjectDropdown(false);
                      }}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg flex items-center space-x-1.5 hover:bg-gray-100 transition-colors"
                    >
                      <FontAwesomeIcon icon={faAward} className="text-gray-500 text-xs" />
                      <span className="text-xs font-semibold text-gray-700">
                        {complexityFilter === FILTER_VALUES.ALL ? 'All Levels' :
                         complexityFilter.charAt(0).toUpperCase() + complexityFilter.slice(1)}
                      </span>
                      <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-xs" />
                    </button>
                    
                    {showComplexityDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[130px] py-1 border">
                        {[
                          { value: 'all', label: 'All Levels' },
                          { value: 'easy', label: 'Easy' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'hard', label: 'Hard' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setComplexityFilter(option.value);
                              setShowComplexityDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              complexityFilter === option.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chapter Filter Dropdown */}
                  {availableChapters.length > 0 && (
                    <div className="relative filter-dropdown">
                      <button
                        onClick={() => {
                          setShowChapterDropdown(!showChapterDropdown);
                          setShowQuestionTypeDropdown(false);
                          setShowComplexityDropdown(false);
                          setShowTagDropdown(false);
                          setShowQBClassDropdown(false);
                          setShowQBSubjectDropdown(false);
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg flex items-center space-x-1.5 hover:bg-gray-100 transition-colors"
                      >
                        <FontAwesomeIcon icon={faBookBookmark} className="text-gray-500 text-xs" />
                        <span className="text-xs font-semibold text-gray-700">
                          {chapterFilter === FILTER_VALUES.ALL ? 'All Chapters' : 
                           chapterFilter.length > 20 ? chapterFilter.substring(0, 20) + '...' : chapterFilter}
                        </span>
                        <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-xs" />
                      </button>
                      
                      {showChapterDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[200px] max-w-[300px] py-1 max-h-[300px] overflow-y-auto custom-scrollbar border">
                          <button
                            onClick={() => {
                              setChapterFilter(FILTER_VALUES.ALL);
                              setShowChapterDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              chapterFilter === FILTER_VALUES.ALL ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            All Chapters
                          </button>
                          {availableChapters.map((chapter) => (
                            <button
                              key={chapter}
                              onClick={() => {
                                setChapterFilter(chapter);
                                setShowChapterDropdown(false);
                              }}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                                chapterFilter === chapter ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                              }`}
                              title={chapter}
                            >
                              {chapter}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tag Filter Dropdown */}
                  {availableTags.length > 0 && (
                    <div className="relative filter-dropdown">
                      <button
                        onClick={() => {
                          setShowTagDropdown(!showTagDropdown);
                          setShowQuestionTypeDropdown(false);
                          setShowComplexityDropdown(false);
                          setShowChapterDropdown(false);
                          setShowQBClassDropdown(false);
                          setShowQBSubjectDropdown(false);
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg flex items-center space-x-1.5 hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700">
                          {tagFilter === FILTER_VALUES.ALL ? 'All Tags' : 
                           tagFilter.length > 15 ? tagFilter.substring(0, 15) + '...' : tagFilter}
                        </span>
                        <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-xs" />
                      </button>
                      
                      {showTagDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[180px] max-w-[280px] py-1 max-h-[300px] overflow-y-auto custom-scrollbar border">
                          <button
                            onClick={() => {
                              setTagFilter(FILTER_VALUES.ALL);
                              setShowTagDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              tagFilter === FILTER_VALUES.ALL ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            All Tags
                          </button>
                          {availableTags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => {
                                setTagFilter(tag);
                                setShowTagDropdown(false);
                              }}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                                tagFilter === tag ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                              }`}
                              title={tag}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="relative">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  placeholder="Search questions..."
                  className="w-full pl-10 pr-20 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-all text-sm"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                  {searchQuery !== debouncedSearchQuery && searchQuery !== '' && (
                    <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span className="font-medium">...</span>
                    </div>
                  )}
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedSearchQuery('');
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                    >
                      <FontAwesomeIcon icon={faXmark} className="text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 min-h-[24px]">
                  <div className="text-sm text-gray-600 transition-opacity duration-200">
                    {isLoadingQuestionBank && questionBankItems.length === 0 ? (
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span>Searching...</span>
                      </span>
                    ) : searchQuery.trim().length > 0 && searchQuery.trim().length < 2 ? (
                      <span className="text-xs text-amber-600 font-medium">
                        Type at least 2 characters to search
                      </span>
                    ) : (
                      <>
                        Found <span className="font-bold text-gray-900">{totalQuestionBankItems}</span> question{totalQuestionBankItems !== 1 ? 's' : ''}
                        {debouncedSearchQuery && debouncedSearchQuery.length >= 2 && (
                          <span className="ml-1 text-xs text-gray-500">
                            matching "{debouncedSearchQuery}"
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {selectedQuestionIds.size > 0 && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: brand.gradients.primary }}>
                      {selectedQuestionIds.size} selected
                    </span>
                  )}
                </div>
                
                {/* Public/Private Filter */}
                <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                  {[
                    { value: 'all', label: 'All', icon: null, activeColor: 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' },
                    { value: 'common', label: 'Public', icon: faGlobe, activeColor: 'bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200' },
                    { value: 'proprietary', label: 'Private', icon: faLock, activeColor: 'bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-200' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setProprietaryFilter(opt.value as 'common' | 'all' | 'proprietary');
                        setCurrentPage(1);
                        setQbPageDocs(new Map());
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        proprietaryFilter === opt.value
                          ? opt.activeColor
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {opt.icon && (
                        <FontAwesomeIcon 
                          icon={opt.icon} 
                          className={`text-[10px] transition-transform duration-200 ${proprietaryFilter === opt.value ? 'scale-110' : ''}`} 
                        />
                      )}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Select All checkbox */}
                {questionBankItems.length > 0 && !isLoadingQuestionBank && (
                  <button
                    onClick={toggleSelectAll}
                    disabled={isSelectingAll}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors group ${
                      isSelectingAll 
                        ? 'bg-gray-100 cursor-wait' 
                        : 'hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    {isSelectingAll ? (
                      <>
                        <div className="w-4 h-4 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-semibold text-gray-500">
                          Selecting...
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                          {selectedQuestionIds.size > 0 ? 'Deselect All' : `Select All (${totalQuestionBankItems})`}
                        </span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={selectedQuestionIds.size > 0}
                            onChange={() => {}}
                            className="w-5 h-5 rounded cursor-pointer"
                            style={{
                              accentColor: brand.colors.primary
                            }}
                          />
                        </div>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
              {isLoadingQuestionBank && questionBankItems.length > 0 && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center transition-opacity duration-200">
                  <div className="bg-white rounded-xl shadow-lg px-5 py-3 flex items-center space-x-3 border" style={{ borderColor: brand.colors.primary + '20' }}>
                    <div className="w-5 h-5 border-3 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent', borderWidth: '3px' }} />
                    <p className="text-gray-700 font-semibold text-sm">Searching...</p>
                  </div>
                </div>
              )}

              {isLoadingQuestionBank && questionBankItems.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                      style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent' }} />
                    <p className="text-gray-600 font-semibold">Loading questions...</p>
                  </div>
                </div>
              ) : questionBankItems.length === 0 ? (
                <div className="text-center py-20">
                  <FontAwesomeIcon icon={faBook} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-xl font-bold text-gray-900 mb-2">No questions found</p>
                  <p className="text-gray-600 mb-4">
                    {debouncedSearchQuery 
                      ? `No questions match "${debouncedSearchQuery}" for the current filters`
                      : `No questions available for the current filters`
                    }
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 flex-wrap">
                    <span>Current filters:</span>
                    {className && (
                      <span className="px-2 py-1 bg-gray-100 rounded-md font-semibold">Class {className}</span>
                    )}
                    {subject && (
                      <span className="px-2 py-1 bg-gray-100 rounded-md font-semibold">{subject}</span>
                    )}
                    {!className && !subject && (
                      <span className="px-2 py-1 bg-gray-100 rounded-md font-semibold">All Classes & Subjects</span>
                    )}
                    {boards.length > 1 && (
                      <span className="px-2 py-1 bg-gray-100 rounded-md font-semibold">{board}</span>
                    )}
                    {questionTypeFilter !== 'all' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-semibold">
                        {questionTypeFilter === QUESTION_TYPES.MCQ ? 'MCQ' :
                         questionTypeFilter === QUESTION_TYPES.FITB ? 'Fill Blank' :
                         questionTypeFilter === QUESTION_TYPES.JUMBLED ? 'Jumbled' :
                         questionTypeFilter === QUESTION_TYPES.CODE ? 'Code' : 
                         questionTypeFilter === QUESTION_TYPES.SQL ? 'SQL' : 'Descriptive'}
                      </span>
                    )}
                    {complexityFilter !== 'all' && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md font-semibold">
                        {complexityFilter.charAt(0).toUpperCase() + complexityFilter.slice(1)}
                      </span>
                    )}
                  </div>
                  {debouncedSearchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedSearchQuery('');
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {questionBankItems.map((question, index) => {
                    const isSelected = selectedQuestionIds.has(question.id);
                    const isExpanded = expandedQuestionId === question.id;
                    const typeDisplay = getQuestionTypeDisplay(question.type);
                    const alreadyAddedStatus = isQuestionAlreadyAdded(question.id);
                    const isAlreadyAdded = alreadyAddedStatus.isAdded;
                    
                    return (
                      <div
                        key={question.id}
                        className={`bg-white rounded-2xl p-5 transition-all ${
                          isAlreadyAdded
                            ? 'opacity-50 bg-gray-50 border border-gray-300'
                            : isSelected 
                              ? 'shadow-md ring-2 ring-blue-200 border border-blue-300' 
                              : 'border border-gray-200 hover:shadow-sm hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start space-x-4 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white text-xs font-bold">
                                {((currentPage - 1) * questionsPerPage) + index + 1}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0" style={{ maxWidth: 'calc(100% - 90px)' }}>
                              <div className="overflow-x-auto scrollbar-hide">
                                <div className="flex items-center space-x-2 whitespace-nowrap mb-4 pr-2">
                                  {isAlreadyAdded && (
                                    <span className="text-xs font-bold px-3 py-1 rounded-md bg-red-100 text-red-700 flex items-center space-x-1">
                                      <FontAwesomeIcon icon={faCircleCheck} className="text-red-600" />
                                      <span>In {alreadyAddedStatus.location}</span>
                                    </span>
                                  )}
                                  <span className={`text-xs font-bold px-3 py-1 rounded-md ${typeDisplay.color}`}>
                                    {typeDisplay.label}
                                  </span>
                                  
                                  {question.type === QUESTION_TYPES.CODE && question.programmingLanguage && (
                                    <span className="text-xs font-bold px-3 py-1 rounded-md bg-orange-100 text-orange-700">
                                      {question.programmingLanguage.charAt(0).toUpperCase() + question.programmingLanguage.slice(1).toLowerCase()}
                                    </span>
                                  )}
                                  
                                  {question.board && (
                                    <span className="text-xs font-bold px-3 py-1 rounded-md bg-purple-100 text-purple-700">
                                      {question.board}
                                    </span>
                                  )}
                                  
                                  <span className={`text-xs font-bold px-3 py-1 rounded-md ${getComplexityColor(question.complexity)}`}>
                                    {question.complexity?.toUpperCase() || 'MEDIUM'}
                                  </span>
                                  
                                  {/* Tags Display */}
                                  {question.tags && Array.isArray(question.tags) && question.tags.length > 0 && (
                                    <>
                                      {question.tags.map((tag: string, tagIdx: number) => (
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
                          </div>
                          
                          <div className="flex-shrink-0 ml-4 flex items-center space-x-2">
                            {/* Image Gallery Icon - Show if question has images */}
                            {question.imageUrls && Array.isArray(question.imageUrls) && question.imageUrls.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('🖼️ Opening carousel with images:', question.imageUrls);
                                  setCarouselImages(question.imageUrls || []);
                                  setCurrentImageIndex(0);
                                  setImageCarouselOpen(true);
                                }}
                                className="relative h-8 bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 px-3 rounded-lg transition-all hover:shadow-md group flex items-center"
                                title="View question images"
                              >
                                <div className="flex items-center space-x-1.5">
                                  <FontAwesomeIcon icon={faImage} className="text-purple-600 group-hover:scale-110 transition-transform" />
                                  <span className="text-xs font-bold text-purple-700">{question.imageUrls.length}</span>
                                </div>
                              </button>
                            )}
                            
                            <div className="h-8 bg-gray-100 px-3 rounded-lg flex items-center">
                              <span className="text-base font-semibold text-gray-900">{question.marks}</span>
                              <span className="text-xs text-gray-600 ml-1">marks</span>
                            </div>
                            
                            <div 
                              onClick={() => !isAlreadyAdded && toggleQuestionSelection(question.id)}
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                isAlreadyAdded
                                  ? 'bg-gray-300 border-gray-400 cursor-not-allowed'
                                  : isSelected 
                                    ? 'bg-blue-600 border-blue-600 cursor-pointer' 
                                    : 'border-gray-300 hover:border-blue-400 cursor-pointer'
                              }`}
                              title={isAlreadyAdded ? `Already added to ${alreadyAddedStatus.location}` : ''}
                            >
                              {isAlreadyAdded ? (
                                <FontAwesomeIcon icon={faCircleCheck} className="text-gray-600" />
                              ) : isSelected ? (
                                <FontAwesomeIcon icon={faCheck} className="text-white" strokeWidth={3} />
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Question Title - Outside flex container */}
                        <div className="mb-4 pl-10">
                                {(() => {
                                  // Process the HTML to wrap code blocks with copy buttons and syntax highlighting, and render math
                                  const processHTML = (html: string) => {
                                    // First, render any math formulas - look for data-latex attribute
                                    let processedHtml = html.replace(
                                      /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                                      (match, latex) => {
                                        try {
                                          const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                          return katex.renderToString(decodedLatex, {
                                            throwOnError: false,
                                            displayMode: false
                                          });
                                        } catch (e) {
                                          return match;
                                        }
                                      }
                                    );

                                    // Split by code tags
                                    const parts = processedHtml.split(/(<code>.*?<\/code>)/gs);
                                    
                                    return parts.map((part, partIndex) => {
                                      // Check if this is a code block
                                      const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                                      
                                      if (codeMatch) {
                                        const codeContent = codeMatch[1];
                                        const codeId = `code-${question.id}-${partIndex}`;
                                        
                                        // Determine programming language
                                        const detectLanguage = (code: string): string => {
                                          // If it's a code question, use its language
                                          if (question.programmingLanguage) {
                                            return question.programmingLanguage.toLowerCase();
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
                                          <div key={partIndex} className="relative rounded-lg overflow-hidden mb-3">
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
                                          key={partIndex}
                                          className="prose prose-sm max-w-none
                                            [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-2 [&>h1]:mt-1
                                            [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-2 [&>h2]:mt-1
                                            [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-1 [&>h3]:mt-1
                                            [&>p]:text-sm [&>p]:text-gray-800 [&>p]:mb-1 [&>p]:leading-relaxed
                                            [&_strong]:font-bold [&_strong]:text-gray-900
                                            [&_br]:block [&_br]:mb-1
                                            [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2 [&>ul]:text-sm
                                            [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2 [&>ol]:text-sm
                                            [&_li]:mb-1
                                            [&>pre:empty]:hidden [&>pre:empty]:opacity-0 [&>pre:empty]:h-0 [&>pre:empty]:m-0 [&>pre:empty]:p-0"
                                          dangerouslySetInnerHTML={{ __html: part }}
                                        />
                                      );
                                    });
                                  };
                                  
                                  return <>{processHTML(question.questionText)}</>;
                                })()}
                        </div>

                        <div className="pl-10">
                          {/* MCQ Options - Simple view without correct answer */}
                          {question.type === QUESTION_TYPES.MCQ && question.options && question.options.length > 0 && expandedQuestionId !== question.id && (
                            <div className="mt-3">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Options</h4>
                              <div className="space-y-2">
                                {question.options.map((option: string, optIndex: number) => (
                                  <div
                                    key={optIndex}
                                    className="flex items-center space-x-2 p-2.5 rounded-lg border bg-gray-50 border-gray-200"
                                  >
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-300 text-gray-700">
                                      {String.fromCharCode(65 + optIndex)}
                                    </div>
                                    <span className="text-sm text-gray-700">
                                      {option}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Jumbled Question Items - Simple MCQ-style display with grip dots */}
                          {question.type === QUESTION_TYPES.JUMBLED && expandedQuestionId !== question.id && (
                            <div className="mt-3 space-y-2">
                              {(() => {
                                // Helper function to convert Firebase object-arrays to real arrays
                                const convertToArray = (obj: any): any[] | null => {
                                  if (!obj) return null;
                                  if (Array.isArray(obj)) return obj;
                                  
                                  // Check if it's a Firebase object with numeric keys
                                  if (typeof obj === 'object') {
                                    const keys = Object.keys(obj);
                                    const numericKeys = keys.filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
                                    if (numericKeys.length > 0) {
                                      return numericKeys.map(k => obj[k]);
                                    }
                                  }
                                  
                                  return null;
                                };
                                
                                // Get jumbledOptions or jumbledItems if they exist
                                const jumbledItemsRaw = (question as any).jumbledOptions || (question as any).jumbledItems;
                                const jumbledItems = convertToArray(jumbledItemsRaw);
                                
                                // Convert correctAnswers as well
                                const correctAnswers = convertToArray(question.correctAnswers);
                                
                                // If no pre-shuffled items, use correctAnswers (shuffled)
                                const itemsToShow = jumbledItems && jumbledItems.length > 0
                                  ? jumbledItems
                                  : correctAnswers
                                  ? [...correctAnswers].sort(() => Math.random() - 0.5)
                                  : [];
                                
                                return itemsToShow.length > 0 ? itemsToShow.map((item: string, itemIndex: number) => (
                                  <div
                                    key={itemIndex}
                                    className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200"
                                  >
                                    <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                                      <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                                    </div>
                                    <span className="text-sm text-gray-700">
                                      {safeRender(item)}
                                    </span>
                                  </div>
                                )) : null;
                              })()}
                            </div>
                          )}

                          {/* Options with Correct Answer - Outside (MCQ ONLY) */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.MCQ && question.options && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Options with Correct Answer</h2>
                              <div className="space-y-2">
                                {question.options.map((option: string, optIndex: number) => {
                                  // Check if this option is correct
                                  const isCorrectByText = question.correctAnswers && 
                                    Array.isArray(question.correctAnswers) && 
                                    question.correctAnswers.some((ans: string) => 
                                      ans.trim().toLowerCase() === option.trim().toLowerCase()
                                    );
                                  
                                  const isCorrect = isCorrectByText;
                                  
                                  return (
                                    <div
                                      key={optIndex}
                                      className={`flex items-center space-x-2 p-2.5 rounded-lg border ${
                                        isCorrect
                                          ? 'bg-green-50 border-green-300'
                                          : 'bg-white border-gray-200'
                                      }`}
                                    >
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                          isCorrect
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-300 text-gray-700'
                                        }`}
                                      >
                                        {String.fromCharCode(65 + optIndex)}
                                      </div>
                                      <span className={`text-sm ${
                                        isCorrect
                                          ? 'text-green-900 font-medium'
                                          : 'text-gray-700'
                                      }`}>
                                        {option}
                                      </span>
                                      {isCorrect && (
                                        <span className="ml-auto text-xs font-semibold text-green-600">✓ Correct Answer</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* FITB - Correct Answers (Outside) */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.FITB && question.correctAnswers && Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0 && (
                            <div className="mt-4">
                              <h2 className="text-base font-semibold text-gray-900 mb-3">Correct Answers:</h2>
                              <div className="flex flex-wrap gap-2">
                                {question.correctAnswers.map((blank: string, blankIndex: number) => (
                                  <span
                                    key={blankIndex}
                                    className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg"
                                  >
                                    Blank {blankIndex + 1}: {safeRender(blank)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Jumbled - Show items with grip dots and correct sequence */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.JUMBLED && (() => {
                            // Helper function to convert Firebase object-arrays to real arrays
                            const convertToArray = (obj: any): any[] | null => {
                              if (!obj) return null;
                              if (Array.isArray(obj)) return obj;
                              
                              // Check if it's a Firebase object with numeric keys
                              if (typeof obj === 'object') {
                                const keys = Object.keys(obj);
                                const numericKeys = keys.filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
                                if (numericKeys.length > 0) {
                                  return numericKeys.map(k => obj[k]);
                                }
                              }
                              
                              return null;
                            };
                            
                            // Convert correctAnswers from Firebase format if needed
                            const correctAnswersArray = convertToArray(question.correctAnswers);
                            const hasCorrectAnswers = correctAnswersArray && correctAnswersArray.length > 0;
                            
                            if (!hasCorrectAnswers) {
                              return null;
                            }
                            
                            return (
                              <>
                                {/* Jumbled Items (What student sees) */}
                                <div className="mt-4">
                                  <h2 className="text-base font-semibold text-gray-900 mb-3">Items to Arrange:</h2>
                                  <div className="space-y-2">
                                    {(() => {
                                      // Convert jumbledItems from Firebase format if needed
                                      const jumbledItemsRaw = (question as any).jumbledOptions || (question as any).jumbledItems;
                                      const jumbledItemsArray = convertToArray(jumbledItemsRaw);
                                      
                                      const itemsToShow = jumbledItemsArray && jumbledItemsArray.length > 0
                                        ? jumbledItemsArray
                                        : correctAnswersArray ? [...correctAnswersArray].sort(() => Math.random() - 0.5) : [];
                                      
                                      return itemsToShow.map((item: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200"
                                        >
                                          <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                                            <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                                          </div>
                                          <span className="text-sm text-gray-700">
                                            {safeRender(item)}
                                          </span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>

                                {/* Correct Sequence (The Answer) */}
                                <div className="mt-4">
                                  <h2 className="text-base font-semibold text-gray-900 mb-3">Correct Sequence:</h2>
                                  <div className="space-y-2">
                                    {correctAnswersArray && correctAnswersArray.map((item: string, seqIndex: number) => (
                                      <div
                                        key={seqIndex}
                                        className="flex items-center space-x-2 p-2.5 rounded-lg border bg-green-50 border-green-300"
                                      >
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-green-500 text-white">
                                          {seqIndex + 1}
                                        </div>
                                        <span className="text-sm text-gray-700">
                                          {safeRender(item)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          })()}

                          {/* Chapter Section - Outside Question Details (NON-CODE QUESTIONS) */}
                          {expandedQuestionId === question.id && question.type !== QUESTION_TYPES.CODE && question.type !== QUESTION_TYPES.SQL && (question as any).chapter && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Chapter</h2>
                              <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                            </div>
                          )}

                          {/* Hint Section - Outside Question Details (NON-CODE QUESTIONS) */}
                          {expandedQuestionId === question.id && question.type !== QUESTION_TYPES.CODE && question.type !== QUESTION_TYPES.SQL && question.hint && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Hint</h2>
                              {containsHTML(question.hint) ? (
                                <div 
                                  className="text-sm text-gray-700 italic prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: question.hint }}
                                />
                              ) : (
                                <p className="text-sm text-gray-700 italic">{question.hint}</p>
                              )}
                            </div>
                          )}

                          {/* Solution Section - Outside Question Details (NON-CODE QUESTIONS) */}
                          {expandedQuestionId === question.id && question.type !== QUESTION_TYPES.CODE && question.type !== QUESTION_TYPES.SQL && question.solution && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Solution</h2>
                              {(question.type === QUESTION_TYPES.MCQ || question.type === QUESTION_TYPES.JUMBLED || question.type === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.DESCRIPTIVE) ? (
                                // Enhanced solution display for MCQ, jumbled, FITB, and descriptive questions - NO BOX
                                <div>
                                    {(() => {
                                      // Parse the solution to extract sections
                                      const parser = new DOMParser();
                                      const doc = parser.parseFromString(question.solution, 'text/html');
                                      const elements: React.ReactElement[] = [];
                                      let keyCounter = 0;

                                      // Process all child nodes
                                      Array.from(doc.body.childNodes).forEach((node) => {
                                        if (node.nodeType === Node.TEXT_NODE) {
                                          const text = node.textContent?.trim();
                                          if (text) {
                                            elements.push(
                                              <p key={`text-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                                {text}
                                              </p>
                                            );
                                          }
                                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                                          const element = node as HTMLElement;
                                          const tagName = element.tagName.toLowerCase();
                                          const content = element.textContent || '';

                                          // Handle different HTML tags
                                          if (tagName === 'p') {
                                            // Check if it's a special heading-like paragraph
                                            const text = content.trim();
                                            
                                            // Skip "Correct Answer:" heading in any format - it's redundant in solution section
                                            if (text.match(/^Correct Answer:?$/i) || text.match(/^<strong>Correct Answer:?<\/strong>$/i)) {
                                              return; // Skip this heading
                                            }
                                            
                                            // Also skip if the paragraph only contains "Correct Answer:" even with HTML tags
                                            const innerHTML = element.innerHTML?.trim() || '';
                                            if (innerHTML.match(/^<strong>Correct Answer:?<\/strong>$/i) || innerHTML.match(/^Correct Answer:?$/i)) {
                                              return; // Skip this heading
                                            }
                                            
                                            if (text.includes('Correct Sequence:')) {
                                              const innerHTML = element.innerHTML || '';
                                              const hasSpans = innerHTML.includes('<span');
                                              
                                              elements.push(
                                                <h3 
                                                  key={`heading-${keyCounter++}`} 
                                                  className="text-base font-bold text-gray-900 mb-2"
                                                  {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                                />
                                              );
                                            } else if (text.match(/^(Output:|Why this order:|Steps:|Note:|Important:)/i)) {
                                              const innerHTML = element.innerHTML || '';
                                              const hasSpans = innerHTML.includes('<span');
                                              
                                              elements.push(
                                                <h4 
                                                  key={`subheading-${keyCounter++}`} 
                                                  className="text-sm font-semibold text-gray-800 mt-3 mb-1"
                                                  {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                                />
                                              );
                                            } else if (text) {
                                              // Check if paragraph contains HTML spans (for highlighting)
                                              const innerHTML = element.innerHTML || '';
                                              const hasSpans = innerHTML.includes('<span');
                                              
                                              if (hasSpans) {
                                                // Preserve HTML for highlighting
                                                elements.push(
                                                  <p 
                                                    key={`para-${keyCounter++}`} 
                                                    className="text-sm text-gray-700 leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: innerHTML }}
                                                  />
                                                );
                                              } else {
                                                // Plain text
                                                elements.push(
                                                  <p key={`para-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                                    {text}
                                                  </p>
                                                );
                                              }
                                            }
                                          } else if (tagName === 'pre' || tagName === QUESTION_TYPES.CODE) {
                                            // Check if this code has yellow highlighting spans (for FITB solutions)
                                            const innerHTML = element.innerHTML || '';
                                            const hasYellowHighlights = innerHTML.includes('bg-yellow') || 
                                                                       innerHTML.includes('bg-amber') || 
                                                                       innerHTML.includes('bg-green') ||
                                                                       innerHTML.includes('background-color');
                                            
                                            if (hasYellowHighlights) {
                                              // Preserve the HTML with yellow highlights - don't use SyntaxHighlighter
                                              const codeId = `code-${question.id}-${keyCounter}`;
                                              elements.push(
                                                <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden bg-gray-900">
                                                  {/* Terminal-style header with dots and copy button */}
                                                  <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                                    <div className="flex items-center space-x-2">
                                                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                    </div>
                                                    <button
                                                      onClick={() => copyToClipboard(element.textContent || '', codeId)}
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
                                                  
                                                  {/* Code with preserved HTML highlighting */}
                                                  <div className="pt-10 pb-4 px-4">
                                                    <pre 
                                                      className="text-sm font-mono text-gray-100 whitespace-pre-wrap"
                                                      style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                                                      dangerouslySetInnerHTML={{ __html: innerHTML }}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            } else {
                                              // Use SyntaxHighlighter for code without highlights
                                              const content = element.textContent || '';
                                              const detectLanguage = (code: string): string => {
                                                if (code.includes('System.out.println') || code.includes('public class') || code.includes('static void')) {
                                                  return 'java';
                                                } else if (code.includes('print(') || code.includes('def ') || code.includes('import ')) {
                                                  return 'python';
                                                } else if (code.includes('console.log') || code.includes('const ') || code.includes('let ') || code.includes('function')) {
                                                  return 'javascript';
                                                } else if (code.includes('#include') || code.includes('cout') || code.includes('cin')) {
                                                  return 'cpp';
                                                } else if (code.includes('printf') || code.includes('scanf')) {
                                                  return 'c';
                                                }
                                                return 'java'; // Default to Java
                                              };
                                              
                                              const language = detectLanguage(content);
                                              const codeId = `code-${question.id}-${keyCounter}`;
                                              
                                              elements.push(
                                                <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden">
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
                                                      onClick={() => copyToClipboard(content, codeId)}
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
                                                      {content}
                                                    </SyntaxHighlighter>
                                                  </div>
                                                </div>
                                              );
                                            }
                                          } else if (tagName === 'ul' || tagName === 'ol') {
                                            // Lists - preserve HTML for highlighting in list items
                                            const listItems = Array.from(element.querySelectorAll('li'));
                                            elements.push(
                                              <ul key={`list-${keyCounter++}`} className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                                                {listItems.map((li, idx) => {
                                                  const liInnerHTML = li.innerHTML || '';
                                                  const hasSpans = liInnerHTML.includes('<span');
                                                  
                                                  return hasSpans ? (
                                                    <li key={idx} dangerouslySetInnerHTML={{ __html: liInnerHTML }} />
                                                  ) : (
                                                    <li key={idx}>{li.textContent}</li>
                                                  );
                                                })}
                                              </ul>
                                            );
                                          } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
                                            const innerHTML = element.innerHTML || '';
                                            const hasSpans = innerHTML.includes('<span');
                                            
                                            if (hasSpans) {
                                              elements.push(
                                                <h3 
                                                  key={`heading-${keyCounter++}`} 
                                                  className="text-base font-bold text-gray-900 mb-2"
                                                  dangerouslySetInnerHTML={{ __html: innerHTML }}
                                                />
                                              );
                                            } else {
                                              elements.push(
                                                <h3 key={`heading-${keyCounter++}`} className="text-base font-bold text-gray-900 mb-2">
                                                  {content}
                                                </h3>
                                              );
                                            }
                                          } else {
                                            // Default: treat as paragraph - preserve HTML for highlighting
                                            const innerHTML = element.innerHTML || '';
                                            const hasSpans = innerHTML.includes('<span');
                                            
                                            if (content.trim()) {
                                              if (hasSpans) {
                                                elements.push(
                                                  <p 
                                                    key={`default-${keyCounter++}`} 
                                                    className="text-sm text-gray-700 leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: innerHTML }}
                                                  />
                                                );
                                              } else {
                                                elements.push(
                                                  <p key={`default-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                                    {content}
                                                  </p>
                                                );
                                              }
                                            }
                                          }
                                        }
                                      });

                                      return elements.length > 0 ? elements : (
                                        <div 
                                          className="text-sm text-gray-900 prose prose-sm max-w-none"
                                          dangerouslySetInnerHTML={{ __html: question.solution }}
                                        />
                                      );
                                    })()}
                                </div>
                              ) : (
                                // Standard solution display for other question types
                                <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                  <button
                                    onClick={() => copyToClipboard(question.solution || '', `solution-${question.id}`)}
                                    className="absolute top-2 right-2 z-10 p-2 rounded-md bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-sm border border-gray-300"
                                    title="Copy to clipboard"
                                  >
                                    {copiedCode === `solution-${question.id}` ? (
                                      <FontAwesomeIcon icon={faCheck} className="text-green-600" />
                                    ) : (
                                      <FontAwesomeIcon icon={faCopy} />
                                    )}
                                  </button>
                                  {containsHTML(question.solution) ? (
                                    <div 
                                      className="p-4 text-sm text-gray-900 prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: question.solution }}
                                    />
                                  ) : (
                                    <div className="p-4 text-sm text-gray-900 whitespace-pre-wrap">
                                      {question.solution}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Chapter Section - Outside Question Details (CODE ONLY) */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && (question as any).chapter && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Chapter</h2>
                              <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                            </div>
                          )}

                          {/* Solution Hint Section - Outside Question Details (CODE ONLY) */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.hint && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Solution Hint</h2>
                              {containsHTML(question.hint) ? (
                                <div 
                                  className="text-sm text-gray-700 italic prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: question.hint }}
                                />
                              ) : (
                                <p className="text-sm text-gray-700 italic">{question.hint}</p>
                              )}
                            </div>
                          )}

                          {/* Solution Section - Outside Question Details (CODE ONLY) */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.solution && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Solution</h2>
                              <div className="relative rounded-lg overflow-hidden">
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
                                    onClick={() => {
                                      const tmp = document.createElement('div');
                                      tmp.innerHTML = (question.solution || '').replace(/<br\s*\/?>/gi, '\n');
                                      copyToClipboard(tmp.textContent || tmp.innerText || '', `solution-${question.id}`);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                    title="Copy to clipboard"
                                  >
                                    {copiedCode === `solution-${question.id}` ? (
                                      <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                    ) : (
                                      <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                    )}
                                  </button>
                                </div>
                                
                                {/* Code content with top padding for header */}
                                <div className="pt-10">
                                  <SyntaxHighlighter
                                    language={question.programmingLanguage?.toLowerCase() || 'python'}
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
                                    {(() => {
                                      // Strip HTML tags and decode HTML entities for clean code display
                                      const tmp = document.createElement('div');
                                      tmp.innerHTML = (question.solution || '').replace(/<br\s*\/?>/gi, '\n');
                                      return tmp.textContent || tmp.innerText || '';
                                    })()}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Test Cases Section - Only for Code Questions */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.testCases && Array.isArray(question.testCases) && question.testCases.length > 0 && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Test Cases</h2>
                              <div className="overflow-x-auto rounded-lg border border-gray-200 custom-scrollbar">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-100 border-b border-gray-200">
                                      <th className="px-3 py-2 text-center text-xs font-bold text-gray-700">#</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">Input</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">Expected Output</th>
                                      <th className="px-3 py-2 text-center text-xs font-bold text-gray-700">Marks</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {question.testCases.map((testCase: any, tcIndex: number) => (
                                      <tr key={tcIndex} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-center">
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" 
                                            style={{ background: brand.gradients.primary }}>
                                            {tcIndex + 1}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300 whitespace-pre-wrap">
                                            {testCase.input != null
                                              ? (typeof testCase.input === 'object'
                                                  ? JSON.stringify(testCase.input, null, 2)
                                                  : String(testCase.input)
                                                ).replace(/\\n/g, '\n')
                                              : 'N/A'}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-200 text-green-700 whitespace-pre-wrap">
                                            {testCase.expected_output != null
                                              ? (typeof testCase.expected_output === 'object'
                                                  ? JSON.stringify(testCase.expected_output, null, 2)
                                                  : String(testCase.expected_output)
                                                ).replace(/\\n/g, '\n')
                                              : 'N/A'}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
                                            {testCase.marks !== undefined && testCase.marks !== null ? Number(testCase.marks).toFixed(1) : '0.0'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Starter Code Template Section - Outside, Only for Code Questions */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.testStub && (
                            <div className="mt-3">
                              <h2 className="text-base font-semibold text-gray-900 mb-2">Starter Code Template</h2>
                              <div className="relative rounded-lg overflow-hidden">
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
                                    onClick={() => copyToClipboard(question.testStub || '', `stub-${question.id}`)}
                                    className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                    title="Copy to clipboard"
                                  >
                                    {copiedCode === `stub-${question.id}` ? (
                                      <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                    ) : (
                                      <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                    )}
                                  </button>
                                </div>
                                
                                {/* Code content with top padding for header */}
                                <div className="pt-10">
                                  <SyntaxHighlighter
                                    language={question.programmingLanguage?.toLowerCase() || 'python'}
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
                                    {question.testStub}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SQL Schema & Test Cases - Expanded View */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.SQL && (() => {
                            const sqlSchema = (question as any).sqlSchema || [];
                            const sqlTestCases = ((question as any).sqlTestCases || []).map((tc: any) => ({
                              ...tc,
                              table_data: typeof tc.table_data === 'string' ? JSON.parse(tc.table_data || '{}') : (tc.table_data || {}),
                              expected_output: typeof tc.expected_output === 'string' ? JSON.parse(tc.expected_output || '{"columns":[],"rows":[]}') : (tc.expected_output || { columns: [], rows: [] })
                            }));
                            return (
                              <div className="space-y-3 mt-3">
                                {/* Schema Tables */}
                                {sqlSchema.length > 0 && (
                                  <div>
                                    <h2 className="text-sm font-bold text-green-700 mb-2 flex items-center space-x-1.5">
                                      <span>🗄️</span><span>Table Schema</span>
                                    </h2>
                                    {sqlSchema.map((table: any, tIdx: number) => (
                                      <div key={tIdx} className="mb-2 border border-green-200 rounded-lg overflow-hidden bg-green-50/30">
                                        <div className="px-3 py-1.5 bg-green-100 border-b border-green-200 flex items-center justify-between">
                                          <span className="font-bold text-green-800 text-sm">{table.table_name}</span>
                                          {table.primary_key && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">PK: {table.primary_key}</span>}
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs">
                                            <thead><tr className="bg-green-50"><th className="px-2 py-1.5 text-left font-semibold text-green-700 border-b">Column</th><th className="px-2 py-1.5 text-left font-semibold text-green-700 border-b">Type</th><th className="px-2 py-1.5 text-left font-semibold text-green-700 border-b">Description</th><th className="px-2 py-1.5 text-left font-semibold text-green-700 border-b">Constraints</th></tr></thead>
                                            <tbody>{(table.columns || []).filter((c: any) => c.name).map((col: any, cIdx: number) => (<tr key={cIdx} className={cIdx % 2 === 0 ? 'bg-white' : 'bg-green-50/50'}><td className="px-2 py-1.5 font-mono font-semibold border-b border-green-100">{col.name}</td><td className="px-2 py-1.5 text-gray-600 border-b border-green-100">{col.type}</td><td className="px-2 py-1.5 text-gray-600 border-b border-green-100">{col.description || '-'}</td><td className="px-2 py-1.5 text-gray-500 border-b border-green-100">{col.constraints || '-'}</td></tr>))}</tbody>
                                          </table>
                                        </div>
                                        {table.note && <p className="px-3 py-1.5 text-[10px] text-green-600 italic bg-green-50/50 border-t border-green-100">📝 {table.note}</p>}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Test Cases */}
                                {sqlTestCases.length > 0 && (
                                  <div>
                                    <h2 className="text-sm font-bold text-amber-700 mb-2 flex items-center space-x-1.5">
                                      <span>📝</span><span>Test Cases</span>
                                    </h2>
                                    {sqlTestCases.map((tc: any, tcIdx: number) => (
                                      <div key={tcIdx} className="mb-2 border border-amber-200 rounded-lg overflow-hidden">
                                        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                                          <span className="font-bold text-amber-800 text-xs">{tc.title || `Test ${tcIdx + 1}`}</span>
                                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{tc.marks || 0} marks</span>
                                        </div>
                                        <div className="p-2 space-y-2">
                                          {/* Input tables */}
                                          {Object.entries(tc.table_data || {}).map(([tableName, rows]: [string, any]) => (
                                            <div key={tableName} className="border border-blue-100 rounded overflow-hidden">
                                              <div className="px-2 py-1 bg-blue-50 border-b border-blue-100">
                                                <span className="text-[10px] font-bold text-blue-600">📥 Input: {tableName}</span>
                                              </div>
                                              <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                  <thead><tr className="bg-gray-50">{(sqlSchema.find((t: any) => t.table_name === tableName)?.columns || []).filter((c: any) => c.name).map((col: any, ci: number) => (<th key={ci} className="px-2 py-1 text-left font-semibold text-gray-600 border-b">{col.name}</th>))}</tr></thead>
                                                  <tbody>{(rows as string[][]).map((row: string[], rIdx: number) => (<tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>{row.map((cell: string, ci: number) => (<td key={ci} className="px-2 py-1 font-mono border-b border-gray-100">{cell}</td>))}</tr>))}</tbody>
                                                </table>
                                              </div>
                                            </div>
                                          ))}
                                          {/* Expected output */}
                                          {tc.expected_output && tc.expected_output.columns?.length > 0 && (
                                            <div className="border border-green-200 rounded overflow-hidden">
                                              <div className="px-2 py-1 bg-green-50 border-b border-green-100">
                                                <span className="text-[10px] font-bold text-green-600">📤 Expected Output</span>
                                              </div>
                                              <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                  <thead><tr className="bg-green-50/50">{tc.expected_output.columns.map((col: string, ci: number) => (<th key={ci} className="px-2 py-1 text-left font-semibold text-green-700 border-b">{col}</th>))}</tr></thead>
                                                  <tbody>{(tc.expected_output.rows || []).map((row: string[], rIdx: number) => (<tr key={rIdx}>{row.map((cell: string, ci: number) => (<td key={ci} className="px-2 py-1 font-mono border-b border-gray-100">{cell}</td>))}</tr>))}</tbody>
                                                </table>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Chapter */}
                                {(question as any).chapter && (
                                  <div>
                                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Chapter</h2>
                                    <p className="text-sm text-gray-700">{(question as any).chapter}</p>
                                  </div>
                                )}

                                {/* Hint */}
                                {question.hint && (
                                  <div>
                                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Hint</h2>
                                    {containsHTML(question.hint) ? (
                                      <div className="text-sm text-gray-700 italic prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: question.hint }} />
                                    ) : (
                                      <p className="text-sm text-gray-700 italic">{question.hint}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 pl-10">
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <div className="flex items-center space-x-1">
                                  <FontAwesomeIcon icon={faUser} />
                                  <span>{question.createdByName}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <FontAwesomeIcon icon={faCalendar} />
                                  <span>
                                    {new Date(question.createdAt).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                {question.isProprietaryQuestion ? (
                                  <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                                    <FontAwesomeIcon icon={faLock} />
                                    <span className="text-xs font-semibold">Private</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                                    <FontAwesomeIcon icon={faGlobe} />
                                    <span className="text-xs font-semibold">Public</span>
                                  </div>
                                )}

                                <button
                                  onClick={() => setExpandedQuestionId(expandedQuestionId === question.id ? null : question.id)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                                  style={{ color: brand.colors.primary }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = `${brand.colors.primary}10`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  {isExpanded ? 'Hide Details' : 'View Details'}
                                </button>
                              </div>
                            </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-3 flex items-center justify-between border-t-2 border-gray-200 flex-shrink-0">
              {/* Left side - Pagination */}
              <div className="flex items-center space-x-3">
                {totalQuestionBankItems > questionsPerPage ? (
                  <>
                    <div className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{((currentPage - 1) * questionsPerPage) + 1}-{Math.min(currentPage * questionsPerPage, totalQuestionBankItems)}</span>
                      <span> of </span>
                      <span className="font-semibold text-gray-700">{totalQuestionBankItems}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1 || isLoadingQuestionBank}
                        className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                          currentPage === 1 || isLoadingQuestionBank
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                      </button>

                      {Array.from({ length: Math.ceil(totalQuestionBankItems / questionsPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalPages = Math.ceil(totalQuestionBankItems / questionsPerPage);
                          return (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          );
                        })
                        .map((page, index, array) => {
                          const prevPage = array[index - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;

                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsis && (
                                <span className="px-1 text-gray-400 text-xs">...</span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                disabled={isLoadingQuestionBank}
                                className={`min-w-[32px] h-8 rounded-lg text-sm font-semibold transition-all ${
                                  currentPage === page
                                    ? 'text-white shadow-sm'
                                    : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
                                } ${isLoadingQuestionBank ? 'opacity-50 cursor-not-allowed' : ''}`}
                                style={currentPage === page ? {
                                  background: brand.gradients.primary
                                } : {}}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}

                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(totalQuestionBankItems / questionsPerPage), currentPage + 1))}
                        disabled={currentPage >= Math.ceil(totalQuestionBankItems / questionsPerPage) || isLoadingQuestionBank}
                        className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                          currentPage >= Math.ceil(totalQuestionBankItems / questionsPerPage) || isLoadingQuestionBank
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{totalQuestionBankItems}</span> question{totalQuestionBankItems !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Right side - Selection count and buttons */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-semibold text-gray-600">
                  {selectedQuestionIds.size} selected
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuestionBankModal(false);
                  }}
                  className="px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all flex items-center space-x-2 text-sm"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                  <span>Back</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSelectedQuestions();
                  }}
                  disabled={selectedQuestionIds.size === 0}
                  className="px-5 py-2 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  style={{ background: brand.gradients.primary }}
                >
                  <FontAwesomeIcon icon={faCheck} className="text-xs" />
                  <span>Add {selectedQuestionIds.size > 0 ? `${selectedQuestionIds.size} ` : ''}Question{selectedQuestionIds.size !== 1 ? 's' : ''}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Selection Modal */}
      {showStudentModal && (
        <div 
          className="fixed inset-0 z-[10002] flex items-start justify-start p-2"
          onClick={() => setShowStudentModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0" />
          
          <div 
            className="relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[50rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideIn 0.3s ease-out' }}
          >
            {/* Header - matches parent modal */}
            <div 
              className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
              style={{ 
                background: brand.gradients.primary,
                borderColor: brand.colors.secondary
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <FontAwesomeIcon icon={faUsers} className="text-white text-sm" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Enroll Students</h2>
                  <p className="text-white/80 text-xs">{selectedStudentIds.size} selected</p>
                </div>
              </div>
              <button
                onClick={() => setShowStudentModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all"
              >
                <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="px-5 py-3 border-b border-gray-200 flex items-center space-x-3 flex-shrink-0 bg-gray-50">
              {/* Search */}
              <div className="flex-1 relative">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search by name, email, roll..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:border-transparent bg-white"
                />
              </div>
              
              {/* Class Filter */}
              <div className="relative filter-dropdown">
                <button
                  onClick={() => setShowStudentClassDropdown(!showStudentClassDropdown)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:border-gray-400 flex items-center space-x-2 transition-all"
                >
                  <FontAwesomeIcon icon={faFilter} className="text-xs text-gray-500" />
                  <span>{studentClassFilter === 'all' ? 'All Classes (Batches)' : studentClassFilter}</span>
                  <FontAwesomeIcon icon={faChevronDown} className="text-xs text-gray-400" />
                </button>
                {showStudentClassDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-30 min-w-[160px] max-h-48 overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => { setStudentClassFilter('all'); setShowStudentClassDropdown(false); }}
                      className={`w-full px-3 py-2 text-left text-sm font-medium transition-colors ${
                        studentClassFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      All Classes (Batches)
                    </button>
                    {classes.map(cls => (
                      <button
                        key={cls}
                        onClick={() => { setStudentClassFilter(cls); setShowStudentClassDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-sm font-medium transition-colors ${
                          studentClassFilter === cls ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Select All Header */}
            <div className="px-5 py-2 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedStudentIds.has(s.userId))}
                  onChange={toggleSelectAllStudents}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-semibold text-gray-700">Select All</span>
              </label>
              {selectedStudentIds.size > 0 && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full text-white" style={{ background: brand.gradients.primary }}>
                  {selectedStudentIds.size} selected
                </span>
              )}
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent' }} />
                </div>
              ) : paginatedStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <FontAwesomeIcon icon={faUsers} className="text-3xl mb-3" />
                  <p className="font-semibold text-gray-600">No students found</p>
                  <p className="text-sm mt-1">Try changing the class filter or search</p>
                </div>
              ) : (
                paginatedStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.userId);
                  const initials = student.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
                  
                  return (
                    <div
                      key={student.userId}
                      onClick={() => toggleStudentSelection(student.userId)}
                      className={`px-5 py-3 flex items-center space-x-3 cursor-pointer border-b border-gray-50 transition-all ${
                        isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); toggleStudentSelection(student.userId); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                      />
                      
                      {/* Avatar */}
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: brand.gradients.primary }}
                      >
                        {initials}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{student.fullName}</p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium" style={{ color: brand.colors.primary }}>
                            {student.studentClass || 'No Class'}
                            {student.studentRoll ? ` • Roll: ${student.studentRoll}` : ''}
                          </span>
                        </div>
                        {student.email && (
                          <p className="text-xs text-gray-400 truncate">{student.email}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Pagination and Actions */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-5 py-3 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
              {/* Pagination */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {Math.min((studentModalPage - 1) * studentsPerPage + 1, availableStudents.length)}-{Math.min(studentModalPage * studentsPerPage, availableStudents.length)}
                  </span>
                  {' '}of{' '}
                  <span className="font-semibold text-gray-700">{availableStudents.length}</span>
                </span>
                {totalStudentPages > 1 && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setStudentModalPage(Math.max(1, studentModalPage - 1))}
                      disabled={studentModalPage === 1}
                      className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <span className="text-xs font-semibold text-gray-600 px-1">{studentModalPage}/{totalStudentPages}</span>
                    <button
                      onClick={() => setStudentModalPage(Math.min(totalStudentPages, studentModalPage + 1))}
                      disabled={studentModalPage === totalStudentPages}
                      className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl transition-all"
                >
                  Close
                </button>
                <button
                  onClick={confirmStudentEnrollment}
                  className="px-5 py-2 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center space-x-2"
                  style={{ background: brand.gradients.primary }}
                >
                  <FontAwesomeIcon icon={faCheck} className="text-xs" />
                  <span>Enroll{selectedStudentIds.size > 0 ? ` (${selectedStudentIds.size})` : ''}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Carousel Modal */}
      {imageCarouselOpen && carouselImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setImageCarouselOpen(false)}
        >
          <div 
            className="relative w-full max-w-5xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setImageCarouselOpen(false)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all z-10"
              title="Close (Esc)"
            >
              <FontAwesomeIcon icon={faXmark} size="lg" />
            </button>

            {/* Image Counter */}
            <div className="absolute -top-12 left-0 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-semibold">
              {currentImageIndex + 1} / {carouselImages.length}
            </div>

            {/* Main Image Container */}
            <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Image */}
              <div className="relative w-full" style={{ minHeight: '400px', maxHeight: '80vh' }}>
                <img
                  src={carouselImages[currentImageIndex]}
                  alt={`Question Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                  style={{ maxHeight: '80vh' }}
                />
              </div>

              {/* Navigation Arrows - Only show if more than 1 image */}
              {carouselImages.length > 1 && (
                <>
                  {/* Previous Button */}
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
                    title="Previous (←)"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} size="lg" />
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
                    title="Next (→)"
                  >
                    <FontAwesomeIcon icon={faChevronRight} size="lg" />
                  </button>
                </>
              )}

              {/* Thumbnail Strip - Only show if more than 1 image */}
              {carouselImages.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center justify-center space-x-2 overflow-x-auto">
                    {carouselImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border transition-all ${
                          idx === currentImageIndex
                            ? 'border-white scale-110 shadow-lg'
                            : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Navigation Hint */}
            {carouselImages.length > 1 && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-xs flex items-center space-x-4">
                <span>← Previous</span>
                <span>•</span>
                <span>Next →</span>
                <span>•</span>
                <span>ESC to close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}