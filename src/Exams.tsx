import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faClipboardList,
  faCalendar,
  faAward,
  faShield,
  faUsers,
  faGraduationCap,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faTelescope,
  faBuilding,
  faCheckSquare,
  faClock,
  faVideo,
  faChartBar
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { EXAM_STATUS, EXAM_MODES, SECURITY_LEVELS, FILTER_VALUES, type QuestionType, type ExamStatus, type ExamMode, type SecurityLevel } from './constants';

interface Question {
    id: string;
    type: QuestionType;
    questionText: string;
    title?: string;
    maximumMarks: number;
    marks?: number;
    complexity?: string;
    board?: string;
    options?: string[];
    correctAnswers?: string[];
    jumbledOptions?: string[];
    hint?: string;
    solution?: string;
    // Code question specific
    programmingLanguage?: string;
    programming_language?: string;
    testCases?: Array<{ input: string; expected_output?: string; marks?: number }>;
    testStub?: string;
    // Additional fields
    createdByName?: string;
    createdAt?: string;
    isProprietaryQuestion?: boolean;
    source?: 'questionBank' | 'custom';
    questionBankId?: string;
    questionNo?: number;
    // Image URLs
    imageUrls?: string[];
  }

export interface Exam {
  id: string;
  type: string;
  typeColor: string;
  year: string;
  class: string;
  subject?: string;
  title: string;
  board: string;
  status: ExamStatus;           // ✅ Already correct
  mode: ExamMode;               // ⚠️ YOU NEED TO CHANGE THIS
  securityLevel?: SecurityLevel; // ⚠️ YOU NEED TO CHANGE THIS
  attendance?: boolean;
  avProctoring?: boolean;
  examDate: string;
  examTime?: string;
  duration: string;
  completionPolicy?: 'strict' | 'flexible'; 
  totalQuestions: number;
  maxMarks: string;
  totalStudents?: number;
  questionPaperImages?: string[];
  questionsList?: Question[];
  collegeId?: string;  // ✅ ADDED: College ID from exams table
  personalityAssessment?: boolean;
  likertQuestions?: any[];
  likertDuration?: number;
  createdAt: string;
  createdBy: string;
  createdById: string;
  createdByName?: string;
  createdByRole: string;
}

interface ExamsProps {
  activeCollegeId: string | null;
  selectedYear: string;
  brandTheme: any;
  onExamSelect: (exam: Exam | null) => void;
  selectedExam: Exam | null;
  isMainCollapsed: boolean;
  onCreateExam?: () => void;
  onEditExam?: (exam: Exam) => void;
  onDeleteExam?: (examId: string) => void;
  onViewResults?: (exam: Exam) => void;
  onCountsChange?: () => Promise<void>;
  showStudentPreview?: boolean; 
  onStudentPreviewClose?: (() => void | undefined) | undefined
  onCollapse: () => void;
  onExamsListChange?: (exams: Exam[]) => void;
  newlyCreatedExamId?: string | null;
  onExamAutoSelected?: () => void;
  userId?: string; // ✅ ADDED: Current student's user ID
  currentUserType?: string; // ✅ ADDED: User type (student/teacher/admin)
  studentClass?: string; // ✅ ADDED: Student's class
  studentBoard?: string; // ✅ ADDED: Student's board
  onFilteredExamCount?: (count: number) => void; // ✅ Report enrolled exam count to parent for sidebar
}

function Exams({ 
  activeCollegeId, 
  selectedYear, 
  brandTheme,
  onExamSelect,
  selectedExam,
  isMainCollapsed,
  onCollapse,
  onExamsListChange,
  onCountsChange,
  newlyCreatedExamId,
  onExamAutoSelected,
  onViewResults,
  userId, // ✅ ADDED: Current student's user ID
  currentUserType, // ✅ ADDED: User type
  studentClass: _studentClass, // ✅ ADDED: Student's class
  studentBoard: _studentBoard, // ✅ ADDED: Student's board
  onFilteredExamCount // ✅ Report enrolled exam count to parent for sidebar
}: ExamsProps) {
  // State
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null); // ✅ PERF: Track which exam is loading full data
  const [viewResultLoadingId, setViewResultLoadingId] = useState<string | null>(null); // spinner on "Exams Result" click
  const [enrolledExamIds, setEnrolledExamIds] = useState<Set<string> | null>(null); // ✅ ADDED: Enrolled exam IDs for students
  const [examFilter, setExamFilter] = useState<typeof FILTER_VALUES.ALL | typeof EXAM_STATUS.UPCOMING | typeof EXAM_STATUS.COMPLETED>(FILTER_VALUES.ALL);
  const [highlightedExamId, setHighlightedExamId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>(FILTER_VALUES.ALL);
  const [selectedBoard, setSelectedBoard] = useState<string>(FILTER_VALUES.ALL);
  const [selectedExamType, setSelectedExamType] = useState<string>(FILTER_VALUES.ALL);
  const [submittedExams, setSubmittedExams] = useState<Record<string, boolean>>({}); // ✅ ADDED: Track submitted exams
  
  // Dropdown states
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [isExamTypeDropdownOpen, setIsExamTypeDropdownOpen] = useState(false);
  
  // College data
  const [classes, setClasses] = useState<string[]>([FILTER_VALUES.ALL]);
  const [boards, setBoards] = useState<string[]>([FILTER_VALUES.ALL]);
  const [examTypes, setExamTypes] = useState<string[]>([FILTER_VALUES.ALL]);
  const [showBoardFilter, setShowBoardFilter] = useState(false);
  
  // Refs
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const examTypeDropdownRef = useRef<HTMLDivElement>(null);
  const examCardsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Client-side pagination
  const EXAMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  // Helper function to format date in DD-MON-YYYY
  function formatExamDate(dateString: string): string {
    if (!dateString) return 'Not scheduled';
    
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      return dateString;
    }
  }

  // Helper function to format time in 12-hour format with AM/PM IST
  function formatExamTime(timeString: string): string {
    if (!timeString) return '';
    
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      
      return `${hour12}:${minutes} ${ampm} IST`;
    } catch (error) {
      return timeString;
    }
  }

  // Helper function to format duration in readable format
  function formatDuration(durationMinutes: string | number): string {
    const minutes = typeof durationMinutes === 'string' ? parseInt(durationMinutes) : durationMinutes;
    
    if (isNaN(minutes)) return durationMinutes.toString();
    
    // Convert to days if >= 1 day
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours > 0) {
        return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hr${remainingHours !== 1 ? 's' : ''}`;
      }
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    
    // Convert to hours if >= 1 hour
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes > 0) {
        return `${hours} hr${hours !== 1 ? 's' : ''} ${remainingMinutes} min${remainingMinutes !== 1 ? 's' : ''}`;
      }
      return `${hours} hr${hours !== 1 ? 's' : ''}`;
    }
    
    // Show in minutes
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  }

  // Helper function to check if exam is currently live
  function isExamLive(examDate: string, examTime: string, duration: string): boolean {
    if (!examDate || !examTime || !duration) return false;
    
    try {
      // Parse exam date and time in IST
      const [hours, minutes] = examTime.split(':').map(Number);
      
      // Create exam start time in IST (UTC+5:30)
      const examStartIST = new Date(examDate);
      examStartIST.setHours(hours, minutes, 0, 0);
      
      // Parse duration
      const durationMinutes = parseInt(duration);
      const examEndIST = new Date(examStartIST.getTime() + durationMinutes * 60 * 1000);
      
      // Get current time in IST
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      // Exam is live if current IST time is between exam start and end time
      return nowIST >= examStartIST && nowIST <= examEndIST;
    } catch (error) {
      console.error('Error checking if exam is live:', error);
      return false;
    }
  }

  // Check if exam window has ended (time-based, not status-based)
  function isExamOver(exam: Exam): boolean {
    if (!exam.examDate) return false;
    try {
      const examStart = new Date(exam.examDate);
      if (exam.examTime) {
        const [hours, minutes] = exam.examTime.split(':').map(Number);
        examStart.setHours(hours, minutes, 0, 0);
      } else {
        examStart.setHours(23, 59, 59, 999);
      }
      const totalDuration = (parseInt(exam.duration) || 0) + (exam.personalityAssessment ? (exam.likertDuration || 0) : 0);
      const examEnd = new Date(examStart.getTime() + totalDuration * 60 * 1000);
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      return nowIST > examEnd;
    } catch {
      return false;
    }
  }

  // ✅ PERF: Ref to current exams for cache lookup without re-creating callbacks

  // Simple: Upcoming/Live = metadata only. Completed = fetch questions.
  const handleExamSelect = useCallback((exam: Exam | null) => {
    if (!exam) {
      onExamSelect(null);
      setLoadingExamId(null);
      return;
    }

    // Check if current user is the creator
    const isCreator = exam.createdById === userId || 
      exam.createdBy === userId;

    // Students don't need questions on the listing page — they get questions when they Start Exam
    if (currentUserType === 'student') {
      onExamSelect({
        ...exam,
        questionsList: [],
        questionPool: [],
        likertQuestions: [],
      } as Exam);
      return;
    }

    // Check if within 30 minutes of exam start
    const isWithin30Min = (() => {
      if (!exam.examDate) return false;
      const now = new Date();
      const examStart = new Date(exam.examDate);
      if (exam.examTime) {
        const [hours, minutes] = exam.examTime.split(':').map(Number);
        examStart.setHours(hours, minutes, 0, 0);
      } else {
        examStart.setHours(0, 0, 0, 0);
      }
      return now >= new Date(examStart.getTime() - 30 * 60 * 1000);
    })();

    const isCompleted = exam.status === EXAM_STATUS.COMPLETED;
    const shouldFetchQuestions = isCompleted || isCreator || isWithin30Min;

    if (!shouldFetchQuestions) {
      // Non-creator, not within 30min, not completed — show metadata only
      onExamSelect({
        ...exam,
        questionsList: [],
        questionPool: [],
        likertQuestions: [],
      } as Exam);
      return;
    }

    // Fetch questions via Cloud Function (respects permissions for all user types)
    setLoadingExamId(exam.id);
    firebaseService.getExamQuestionsList(exam.id).then(examData => {
      const questions = examData ? {
        questionsList: examData.questionsList,
        questionPool: examData.questionPool,
        likertQuestions: examData.likertQuestions,
      } : { questionsList: [], questionPool: [], likertQuestions: [] };
      onExamSelect({
        ...exam,
        questionsList: questions.questionsList,
        questionPool: questions.questionPool,
        likertQuestions: questions.likertQuestions,
      } as Exam);
    }).catch(error => {
      console.error('Error loading exam questions:', error);
      onExamSelect(exam);
    }).finally(() => {
      setLoadingExamId(null);
    });
  }, [onExamSelect, userId]);

  const loadInitialExams = useCallback(async () => {
    if (!activeCollegeId) {
      setExams([]);
      setIsLoadingExams(false);
      return;
    }
    
    setIsLoadingExams(true);
    setExams([]);
    
  try {
      // ✅ SUB-COLLECTION: Load all exams in one shot — parent docs are lightweight (~1.5KB)
      const allExams = await firebaseService.getExams(activeCollegeId, selectedYear);
      
      const formattedExams = allExams.map(exam => ({
        id: exam.id,
        type: exam.type,
        typeColor: exam.typeColor,
        year: exam.year,
        class: exam.class,
        subject: exam.subject,
        title: exam.title,
        board: exam.board,
        status: exam.status,
        mode: exam.mode,
        securityLevel: exam.securityLevel,
        attendance: exam.attendance,
        avProctoring: exam.avProctoring,
        examDate: exam.examDate,
        examTime: exam.examTime,
        duration: exam.duration,
        completionPolicy: exam.completionPolicy,
        totalQuestions: exam.totalQuestions,
        maxMarks: exam.maxMarks,
        totalStudents: exam.totalStudents,
        questionPaperImages: exam.questionPaperImages,
        questionsList: exam.questionsList,
        // Question Pool fields for random selection
        questionPool: exam.questionPool,
        pickRandomCount: exam.pickRandomCount,
        poolQuestionMarks: exam.poolQuestionMarks,
        collegeId: exam.collegeId,
        personalityAssessment: (exam as any).personalityAssessment || false,
        likertQuestions: (exam as any).likertQuestions || [],
        likertQuestionCount: (exam as any).likertQuestionCount || 0,
        likertDuration: (exam as any).likertDuration || 0,
        createdAt: exam.createdAt.toLocaleString(),
        createdBy: exam.createdByName,
        createdById: exam.createdBy,
        createdByRole: exam.createdByRole
      }));
      
      setExams(formattedExams as Exam[]);
      
      // Notify parent component of the updated exams list
      if (onExamsListChange) {
        onExamsListChange(formattedExams as Exam[]);
      }
      
      // ✅ Trigger count refresh in parent (App.tsx) to update sidebar and top bar
      if (onCountsChange) {
        await onCountsChange();
      }
      
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setIsLoadingExams(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollegeId, selectedYear, onExamsListChange]);
  
  // Check submission status after exams load — students only
  useEffect(() => {
    const checkSubmissions = async () => {
      if (!userId || exams.length === 0 || currentUserType !== 'student') {
        return;
      }
      
      try {
        const examIds = exams.map(e => e.id);
        const submittedMap = await firebaseService.checkSubmittedExams(examIds, userId);
        setSubmittedExams(submittedMap);
      } catch (error) {
        console.error('Error checking submissions:', error);
      }
    };
    
    checkSubmissions();
  }, [exams, userId]);

  // ✅ SUB-COLLECTION: No more loadMoreExams or infinite scroll — all exams loaded in one shot

  useEffect(() => {
    if (activeCollegeId) {
      loadInitialExams();
    }
  }, [activeCollegeId, selectedYear, loadInitialExams]);

  // ✅ ADDED: Fetch enrolled exam IDs for students
  useEffect(() => {
    if (currentUserType === 'student' && userId && activeCollegeId) {
      firebaseService.getEnrolledExamIdsForStudent(userId, activeCollegeId)
        .then(ids => setEnrolledExamIds(ids))
        .catch(() => setEnrolledExamIds(new Set()));
    } else {
      setEnrolledExamIds(null); // Non-students don't need enrollment filtering
    }
  }, [currentUserType, userId, activeCollegeId]);

  // Auto-select and scroll to newly created exam
  const onExamAutoSelectedRef = useRef(onExamAutoSelected);
  onExamAutoSelectedRef.current = onExamAutoSelected;
  
  useEffect(() => {
    let highlightTimer: ReturnType<typeof setTimeout>;
    
    if (newlyCreatedExamId && exams.length > 0) {
      const newExam = exams.find(exam => exam.id === newlyCreatedExamId);
      if (newExam) {
        // Select the newly created exam
        onExamSelectRef.current(newExam);
        
        // Highlight the newly created exam with red
        setHighlightedExamId(newlyCreatedExamId);
        
        // Scroll to the exam card after a brief delay to ensure DOM is ready
        setTimeout(() => {
          const examCard = examCardsRef.current[newlyCreatedExamId];
          if (examCard) {
            examCard.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }
        }, 100);
        
        // Remove red highlight after 10 seconds and clear the newly created exam ID
        highlightTimer = setTimeout(() => {
          setHighlightedExamId(null);
          if (onExamAutoSelectedRef.current) {
            onExamAutoSelectedRef.current();
          }
        }, 10000);
      } else {
        // If newly created exam not found, refresh the list
        loadInitialExams();
      }
    } else if (newlyCreatedExamId && exams.length === 0) {
      // If exam list is empty but we have a new exam ID, load the exams
      loadInitialExams();
    }
    
    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (highlightTimer) {
        clearTimeout(highlightTimer);
      }
    };
  }, [newlyCreatedExamId, exams, loadInitialExams]);

  // Load college data (classes, boards, exam types)
  useEffect(() => {
    const loadCollegeData = async () => {
      if (!activeCollegeId) {
        setClasses([FILTER_VALUES.ALL]);
        setBoards([FILTER_VALUES.ALL]);
        setExamTypes([FILTER_VALUES.ALL]);
        setShowBoardFilter(false);
        return;
      }

      try {
        const college = await firebaseService.getCollegeById(activeCollegeId);
        
        if (college) {
          // Load classes
          if (college.validClasses && college.validClasses.length > 0) {
            setClasses([FILTER_VALUES.ALL, ...college.validClasses]);
          } else {
            setClasses([FILTER_VALUES.ALL]);
          }
          
          // Load boards
          if (college.supportedBoards) {
            setBoards([FILTER_VALUES.ALL, ...college.supportedBoards]);
            setShowBoardFilter(college.supportedBoards.length > 1);
            
            // If only one board, automatically select it
            if (college.supportedBoards.length === 1) {
              setSelectedBoard(college.supportedBoards[0]);
            }
          } else {
            setBoards([FILTER_VALUES.ALL]);
            setShowBoardFilter(false);
          }
          
          // Load exam types
          if (college.examTypes && college.examTypes.length > 0) {
            setExamTypes([FILTER_VALUES.ALL, ...college.examTypes]);
          } else {
            setExamTypes([FILTER_VALUES.ALL]);
          }
        }
      } catch (error) {
        console.error('Error loading college data:', error);
      }
    };

    loadCollegeData();
  }, [activeCollegeId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(event.target as Node)) {
        setIsBoardDropdownOpen(false);
      }
      if (examTypeDropdownRef.current && !examTypeDropdownRef.current.contains(event.target as Node)) {
        setIsExamTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter exams by year, class, board, and exam type (without status filter)
  const baseFilteredExams = useMemo(() => {
    const filtered = exams.filter(exam => {
      // ALWAYS include the highlighted (newly created) exam, regardless of filters
      if (highlightedExamId && exam.id === highlightedExamId) {
        return true;
      }
      
      // For students, only show exams they are enrolled in
      if (currentUserType === 'student') {
        // If enrollment data is still loading, show nothing yet
        if (enrolledExamIds === null) return false;
        // Only show exams the student is enrolled in
        if (!enrolledExamIds.has(exam.id)) return false;
        
        // Apply exam type filter for students too
        const isPAFilter = selectedExamType === 'PA Included' || selectedExamType === 'Personality Assessment';
        const examTypeMatch = selectedExamType === FILTER_VALUES.ALL 
          || (isPAFilter 
              ? !!(exam.personalityAssessment || (exam as any).personalityAssessment)
              : exam.type === selectedExamType);
        return examTypeMatch;
      }
      
      // For teachers/admins, use the dropdown filters
      const yearMatch = selectedYear === FILTER_VALUES.ALL || exam.year === selectedYear;
      const classMatch = selectedClass === FILTER_VALUES.ALL || exam.class === selectedClass;
      const boardMatch = selectedBoard === FILTER_VALUES.ALL || exam.board === selectedBoard;
      const isPAFilter = selectedExamType === 'PA Included' || selectedExamType === 'Personality Assessment';
      const examTypeMatch = selectedExamType === FILTER_VALUES.ALL 
        || (isPAFilter 
            ? !!(exam.personalityAssessment || (exam as any).personalityAssessment)
            : exam.type === selectedExamType);
      return yearMatch && classMatch && boardMatch && examTypeMatch;
    });
    
    return filtered;
  }, [exams, selectedYear, selectedClass, selectedBoard, selectedExamType, currentUserType, enrolledExamIds, highlightedExamId]);

  // Filter exams including status filter and sort by priority
  const filteredExams = useMemo(() => {
    const filtered = baseFilteredExams.filter(exam => {
      if (examFilter === FILTER_VALUES.ALL) return true;
      
      // For students, use time-based check since exam.status may not be updated
      if (currentUserType === 'student') {
        const examOver = isExamOver(exam);
        if (examFilter === EXAM_STATUS.COMPLETED) return examOver || exam.status === EXAM_STATUS.COMPLETED;
        if (examFilter === EXAM_STATUS.UPCOMING) return !examOver && exam.status !== EXAM_STATUS.COMPLETED;
        return exam.status === examFilter;
      }
      
      const statusMatch = exam.status === examFilter;
      return statusMatch;
    });
    
    // Sort exams by priority: Live → Upcoming → Completed
    let sorted = filtered.sort((a, b) => {
      // Define priority order
      const getPriority = (status: string) => {
        if (status === EXAM_STATUS.ACTIVE || status === EXAM_STATUS.ONGOING) return 1; // Live exams first
        if (status === EXAM_STATUS.UPCOMING) return 2; // Upcoming second
        if (status === EXAM_STATUS.COMPLETED) return 3; // Completed last
        return 4; // Any other status
      };
      
      const priorityA = getPriority(a.status);
      const priorityB = getPriority(b.status);
      
      // If different priorities, sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort by exam date (newer first for live/upcoming, older first for completed)
      try {
        const dateA = new Date(a.examDate + ' ' + (a.examTime || '00:00')).getTime();
        const dateB = new Date(b.examDate + ' ' + (b.examTime || '00:00')).getTime();
        
        // For completed exams, show most recent first
        if (priorityA === 3) {
          return dateB - dateA; // Descending (newest first)
        }
        // For live/upcoming exams, show soonest first
        return dateA - dateB; // Ascending (soonest first)
      } catch (error) {
        return 0;
      }
    });
    
    // CRITICAL: Move highlighted exam to the top
    if (highlightedExamId) {
      const highlightedIndex = sorted.findIndex(exam => exam.id === highlightedExamId);
      if (highlightedIndex >= 0) {
        const [highlightedExam] = sorted.splice(highlightedIndex, 1);
        sorted.unshift(highlightedExam);
      }
    }
    
    return sorted;
  }, [baseFilteredExams, examFilter, exams.length, highlightedExamId, currentUserType]);

  // ✅ Client-side pagination
  const totalPages = Math.max(1, Math.ceil(filteredExams.length / EXAMS_PER_PAGE));
  const paginatedExams = useMemo(() => {
    const start = (currentPage - 1) * EXAMS_PER_PAGE;
    return filteredExams.slice(start, start + EXAMS_PER_PAGE);
  }, [filteredExams, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [examFilter, selectedClass, selectedBoard, selectedExamType]);

  // Scroll to top when page changes
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Notify parent component when filtered exams change
  useEffect(() => {
    if (onExamsListChange) {
      onExamsListChange(filteredExams);
    }
  }, [filteredExams, onExamsListChange]);

  // ✅ Report enrolled/filtered exam count to parent for sidebar badge
  useEffect(() => {
    if (onFilteredExamCount) {
      onFilteredExamCount(baseFilteredExams.length);
    }
  }, [baseFilteredExams.length, onFilteredExamCount]);

  // Auto-select first exam when filtered exams change (only if no exam selected)
  // ✅ PERF: Use handleExamSelect for auto-select so full data is lazy-loaded
  const onExamSelectRef = useRef(handleExamSelect);
  onExamSelectRef.current = handleExamSelect;
  
  useEffect(() => {
    if (filteredExams.length > 0 && !selectedExam) {
      // Only auto-select if NO exam is currently selected
      onExamSelectRef.current(filteredExams[0]);
    }
  }, [filteredExams, selectedExam]);

  return (
    <>
      {isMainCollapsed ? (
        <div className="flex flex-col items-center justify-center h-full py-8 space-y-4">
          <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '24px' }} className="text-gray-600" />
          <div className="text-gray-600 font-semibold text-sm tracking-wider"
               style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            Exams
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header with Filters */}
          <div className="flex-shrink-0 z-[100] h-[72px] bg-white px-6 py-4 pb-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '28px' }} className="text-gray-900" />
                <h2 className="text-2xl font-bold text-gray-900">Exams</h2>
                
                {/* Only show filters for teachers/admins, not for students */}
                {currentUserType !== 'student' && (
                  <>
                    {/* Class Dropdown */}
                    <div ref={classDropdownRef} className="relative class-dropdown-container z-[999]">
                      <button 
                        onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: '16px' }} />
                        <span>{selectedClass === FILTER_VALUES.ALL ? 'Class' : selectedClass}</span>
                        <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className={`transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isClassDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
                          {classes.map((classItem) => (
                            <button
                              key={classItem}
                              onClick={() => {
                                setSelectedClass(classItem);
                                setIsClassDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                selectedClass === classItem 
                                  ? 'font-medium' 
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                              style={selectedClass === classItem ? {
                                backgroundColor: `${brandTheme.colors.primary}15`,
                                color: brandTheme.colors.primary
                              } : {}}
                            >
                              {classItem === FILTER_VALUES.ALL ? 'All Classes' : classItem}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Board Dropdown */}
                    {showBoardFilter && (
                      <div ref={boardDropdownRef} className="relative board-dropdown-container z-[999]">
                        <button 
                          onClick={() => setIsBoardDropdownOpen(!isBoardDropdownOpen)}
                          className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          <FontAwesomeIcon icon={faBuilding} style={{ fontSize: '16px' }} />
                          <span>{selectedBoard === FILTER_VALUES.ALL ? 'Board' : selectedBoard}</span>
                          <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className={`transition-transform ${isBoardDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isBoardDropdownOpen && (
                          <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
                            {boards.map((boardItem) => (
                              <button
                                key={boardItem}
                                onClick={() => {
                                  setSelectedBoard(boardItem);
                                  setIsBoardDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                  selectedBoard === boardItem 
                                    ? 'font-medium' 
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                                style={selectedBoard === boardItem ? {
                                  backgroundColor: `${brandTheme.colors.primary}15`,
                                  color: brandTheme.colors.primary
                                } : {}}
                              >
                                {boardItem === FILTER_VALUES.ALL ? 'All Boards' : boardItem}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <button 
                onClick={onCollapse}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Collapse"
              >
                <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: '20px' }} />
              </button>
            </div>
          </div>

          {/* Exam List Content */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Status Filter Buttons - Sticky */}
            <div className="sticky top-0 z-50 bg-white pt-4 pb-4 -mx-6 px-6">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setExamFilter(FILTER_VALUES.ALL)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
                    examFilter === FILTER_VALUES.ALL
                      ? 'text-white shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={examFilter === FILTER_VALUES.ALL ? {
                    background: brandTheme.gradients.primary
                  } : {}}
                >
                  <span>📊</span>
                  <span>All</span>
                  <span className="ml-1 text-xs font-semibold">{baseFilteredExams.length}</span>
                </button>
                
                <button
                  onClick={() => setExamFilter(EXAM_STATUS.UPCOMING)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
                    examFilter === EXAM_STATUS.UPCOMING
                      ? 'shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={examFilter === EXAM_STATUS.UPCOMING ? {
                    backgroundColor: `${brandTheme.colors.primary}20`, 
                    color: brandTheme.colors.primary 
                  } : {}}
                >
                  <span>📝</span>
                  <span>Upcoming</span>
                  <span className="ml-1 text-xs font-semibold">{baseFilteredExams.filter(e => currentUserType === 'student' ? (!isExamOver(e) && e.status !== EXAM_STATUS.COMPLETED) : e.status === EXAM_STATUS.UPCOMING).length}</span>
                </button>
                
                <button
                  onClick={() => setExamFilter(EXAM_STATUS.COMPLETED)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
                    examFilter === EXAM_STATUS.COMPLETED
                      ? 'shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={examFilter === EXAM_STATUS.COMPLETED ? {
                    backgroundColor: `${brandTheme.colors.primary}20`, 
                    color: brandTheme.colors.primary 
                  } : {}}
                >
                  <span>✅</span>
                  <span>Completed</span>
                  <span className="ml-1 text-xs font-semibold">{baseFilteredExams.filter(e => currentUserType === 'student' ? (isExamOver(e) || e.status === EXAM_STATUS.COMPLETED) : e.status === EXAM_STATUS.COMPLETED).length}</span>
                </button>
                
                {/* Exam Type Filter Dropdown */}
                <div ref={examTypeDropdownRef} className="relative ml-auto">
                  <button 
                    onClick={() => setIsExamTypeDropdownOpen(!isExamTypeDropdownOpen)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 max-w-[180px]"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="truncate flex-1 min-w-0">{selectedExamType === FILTER_VALUES.ALL ? 'Exam Type' : selectedExamType}</span>
                    <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className={`transition-transform flex-shrink-0 ${isExamTypeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isExamTypeDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
                      {examTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setSelectedExamType(type);
                            setIsExamTypeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            selectedExamType === type 
                              ? 'font-medium' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          style={selectedExamType === type ? {
                            backgroundColor: `${brandTheme.colors.primary}15`,
                            color: brandTheme.colors.primary
                          } : {}}
                        >
                          {type === FILTER_VALUES.ALL ? 'All Types' : type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {filteredExams.length} examination{filteredExams.length !== 1 ? 's' : ''}
              {totalPages > 1 && <span className="text-gray-400"> · Page {currentPage} of {totalPages}</span>}
            </p>

            {/* Loading State */}
            {isLoadingExams ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
                  style={{ 
                    borderColor: brandTheme.colors.primary + '20',
                    borderTopColor: brandTheme.colors.primary
                  }}
                />
                <p className="text-gray-600 font-medium">Loading exams...</p>
              </div>
            ) : filteredExams.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative mb-6">
                  <FontAwesomeIcon icon={faTelescope} style={{ fontSize: '80px' }} className="text-gray-300" />
                  <div className="absolute -top-2 -right-4 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <div className="absolute top-4 -left-6 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute -bottom-2 right-8 w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <p className="text-gray-700 font-semibold text-lg mb-2">No exams found</p>
                <p className="text-sm text-gray-500 mb-4">No exams available for the selected filters</p>
              </div>
            ) : (
              /* Exams Grid */
              <div className="grid grid-cols-1 gap-4 pb-4">
                {paginatedExams.map((exam) => {
                  return (
                    <div 
                      key={exam.id}
                      ref={(el) => { examCardsRef.current[exam.id] = el; }}
                      onClick={() => {
                        handleExamSelect(exam);
                      }}
                      className={`relative rounded-xl shadow-sm border p-5 transition-all duration-500 ${
                        'cursor-pointer ' + (
                            highlightedExamId === exam.id
                              ? 'shadow-lg border'
                              : selectedExam?.id === exam.id 
                              ? 'shadow-md' 
                              : 'bg-white border-gray-200 hover:shadow-md'
                          )
                      }`}
                      style={
                        highlightedExamId === exam.id ? {
                          backgroundColor: '#fef2f2',
                          borderColor: '#ef4444',
                          boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.2)'
                        } : selectedExam?.id === exam.id ? {
                          backgroundColor: `${brandTheme.colors.primary}08`,
                          borderColor: brandTheme.colors.primary
                        } : {}
                      }
                      onMouseEnter={(e) => {
                        if (selectedExam?.id !== exam.id) {
                          e.currentTarget.style.borderColor = brandTheme.colors.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedExam?.id !== exam.id) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }
                      }}
                    >
                      {/* Status badges moved to bottom bar */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {exam.title}
                            </h3>
                            
                            {/* Live Indicator for Online Exams */}
                            {exam.mode === EXAM_MODES.ONLINE && exam.examTime && isExamLive(exam.examDate, exam.examTime, String((parseInt(exam.duration) || 0) + (exam.personalityAssessment ? (exam.likertDuration || 0) : 0))) && (
                              <div className="flex items-center space-x-1.5">
                                <div className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </div>
                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">LIVE</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 flex items-center gap-3">
                            <span className="flex items-center">
                              <FontAwesomeIcon icon={faUsers} style={{ fontSize: '12px' }} className="mr-1" />
                              <span className="font-medium">{exam.totalStudents || 0} Student{exam.totalStudents !== 1 ? 's' : ''}</span>
                            </span>
                            {exam.personalityAssessment && ((exam.likertQuestions?.length || 0) > 0 || ((exam as any).likertDuration || 0) > 0) && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                <FontAwesomeIcon icon={faChartBar} style={{ fontSize: '10px' }} />
                                PA Included
                              </span>
                            )}
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                              {exam.status === EXAM_STATUS.COMPLETED ? (
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              )}
                              ID: {exam.id}
                            </span>
                          </p>
                        </div>
                      </div>
                      
                      <div 
                        className={`grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg ${
                          selectedExam?.id !== exam.id ? 'bg-gray-50' : ''
                        }`}
                        style={selectedExam?.id === exam.id ? {
                          backgroundColor: `${brandTheme.colors.primary}15`
                        } : {}}
                      >
                        <div className="flex items-center space-x-2">
                          <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '16px' }} className="text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Date & Time</p>
                            <p className="text-sm font-medium text-gray-900">{formatExamDate(exam.examDate)}</p>
                            {exam.examTime && (
                              <p className="text-xs text-gray-600 mt-0.5">{formatExamTime(exam.examTime)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FontAwesomeIcon icon={faClock} style={{ fontSize: '16px' }} className="text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Duration</p>
                            <p className="text-sm font-medium text-gray-900">
                              {(() => {
                                const examDur = parseInt(exam.duration) || 0;
                                const likertDur = exam.personalityAssessment ? (exam.likertDuration || 0) : 0;
                                return formatDuration(examDur + likertDur);
                              })()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '16px' }} className="text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Questions</p>
                            <p className="text-sm font-medium text-gray-900">{exam.totalQuestions} Qs</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FontAwesomeIcon icon={faAward} style={{ fontSize: '16px' }} className="text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Max Marks</p>
                            <p className="text-sm font-medium text-gray-900">
                              {(() => {
                                const marks = parseInt(exam.maxMarks || '0');
                                const isPersonalityOnly = exam.personalityAssessment && marks === 0;
                                return isPersonalityOnly ? 'N/A' : `${marks} marks`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row-reverse items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          {/* Status Badge (replaces board + year) */}
                          {(() => {
                            const over = isExamOver(exam) || exam.status === EXAM_STATUS.COMPLETED;
                            const live = !over && isExamLive(exam.examDate, exam.examTime || '', String((parseInt(exam.duration) || 0) + (exam.personalityAssessment ? (exam.likertDuration || 0) : 0)));
                            const label = live ? 'Live' : over ? 'Completed' : 'Upcoming';
                            const cls = live ? 'text-red-600' : over ? 'text-green-600' : 'text-amber-600';
                            return (
                              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${cls}`}>
                                {live ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                ) : over ? (
                                  <FontAwesomeIcon icon={faCheckSquare} style={{ fontSize: '10px' }} />
                                ) : (
                                  <FontAwesomeIcon icon={faClock} style={{ fontSize: '10px' }} />
                                )}
                                {label}
                              </span>
                            );
                          })()}
                          
                          {/* Security Level Badge */}
                          {exam.mode === EXAM_MODES.ONLINE && exam.securityLevel === SECURITY_LEVELS.SECURE && (
                            <div 
                              className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-red-50 to-red-100 rounded-full cursor-help" 
                              title="Secure Exam - Enhanced Security Measures Enabled"
                            >
                              <FontAwesomeIcon icon={faShield} style={{ fontSize: '10px' }} className="text-red-600" />
                            </div>
                          )}
                          
                          {/* Attendance Badge */}
                          {exam.mode === EXAM_MODES.ONLINE && exam.attendance && (
                            <div 
                              className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full cursor-help" 
                              title="Attendance Required - Students must mark attendance"
                            >
                              <FontAwesomeIcon icon={faCheckSquare} style={{ fontSize: '10px' }} className="text-blue-600" />
                            </div>
                          )}
                          
                          {/* A/V Proctoring Badge */}
                          {exam.mode === EXAM_MODES.ONLINE && exam.avProctoring && (
                            <div 
                              className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-full cursor-help" 
                              title="A/V Proctoring Enabled - Audio & Video Monitoring Active"
                            >
                              <FontAwesomeIcon icon={faVideo} style={{ fontSize: '10px' }} className="text-purple-600" />
                            </div>
                          )}
                        </div>
                        
                        {/* Action pills */}
                        <div className="flex flex-row-reverse items-center gap-2">
                          {currentUserType === 'student' && submittedExams[exam.id] && (
                            <div className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1">
                              <FontAwesomeIcon icon={faCheckSquare} style={{ fontSize: '9px' }} />
                              <span>Submitted</span>
                            </div>
                          )}
                          {!submittedExams[exam.id] && (exam.status === EXAM_STATUS.COMPLETED || isExamOver(exam)) && currentUserType === 'student' && (
                            <div className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1">
                              <FontAwesomeIcon icon={faClock} style={{ fontSize: '9px' }} />
                              <span>Absent</span>
                            </div>
                          )}
                          {!submittedExams[exam.id] && !isExamOver(exam) && exam.status !== EXAM_STATUS.COMPLETED && currentUserType === 'student' && !isExamLive(exam.examDate, exam.examTime || '', String((parseInt(exam.duration) || 0) + (exam.personalityAssessment ? (exam.likertDuration || 0) : 0))) && (
                            <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1">
                              <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '9px' }} />
                              <span>Scheduled</span>
                            </div>
                          )}
                          {onViewResults && currentUserType !== 'student' && (exam.status === EXAM_STATUS.COMPLETED || isExamOver(exam)) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewResultLoadingId(exam.id);
                                onViewResults(exam);
                                window.setTimeout(() => setViewResultLoadingId((cur) => (cur === exam.id ? null : cur)), 1200);
                              }}
                              disabled={viewResultLoadingId === exam.id}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 hover:shadow-md"
                              style={{ color: '#fff', background: '#10b981', opacity: viewResultLoadingId === exam.id ? 0.8 : 1 }}
                              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.06)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                            >
                              {viewResultLoadingId === exam.id ? (
                                <>
                                  <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <FontAwesomeIcon icon={faChartBar} style={{ fontSize: '11px' }} />
                                  Exams Result
                                </>
                              )}
                            </button>
                          )}
                          <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExamSelect(exam);
                          }}
                          disabled={loadingExamId === exam.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 hover:shadow-md"
                          style={{ 
                            color: '#fff',
                            background: `linear-gradient(135deg, ${brandTheme.colors.primary} 0%, #7c3aed 100%)`,
                            opacity: loadingExamId === exam.id ? 0.8 : 1
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = 'brightness(1.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'none';
                          }}
                        >
                          {loadingExamId === exam.id ? (
                            <>
                              <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                              Loading...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '11px' }} />
                              Exams Detail
                            </>
                          )}
                        </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* End of exams indicator */}
                {currentPage === totalPages && filteredExams.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="relative mb-3">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl mb-1">📭</div>
                          <div className="w-8 h-0.5 bg-gray-300 rounded"></div>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">That's everything!</p>
                    <p className="text-xs text-gray-400 mt-1">No more exams to load</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Pagination Bar */}
          {!isLoadingExams && totalPages > 1 && (
            <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 h-14 flex items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="w-full flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Showing {((currentPage - 1) * EXAMS_PER_PAGE) + 1}–{Math.min(currentPage * EXAMS_PER_PAGE, filteredExams.length)} of {filteredExams.length}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" />
                    Prev
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    const total = totalPages;
                    if (total <= 5) { pageNum = i + 1; }
                    else if (currentPage <= 3) { pageNum = i + 1; }
                    else if (currentPage >= total - 2) { pageNum = total - 4 + i; }
                    else { pageNum = currentPage - 2 + i; }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 flex items-center justify-center text-xs font-medium rounded-md transition-all ${
                          pageNum === currentPage
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                        style={pageNum === currentPage ? { backgroundColor: brandTheme.colors.primary } : {}}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                    <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default Exams;