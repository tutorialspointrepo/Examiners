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
  faTelescope,
  faBuilding,
  faCheckSquare,
  faClock,
  faVideo
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import type { DocumentSnapshot } from 'firebase/firestore';
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
  userId, // ✅ ADDED: Current student's user ID
  currentUserType, // ✅ ADDED: User type
  studentClass, // ✅ ADDED: Student's class
  studentBoard // ✅ ADDED: Student's board
}: ExamsProps) {
  // State
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  const loadInitialExams = useCallback(async () => {
    if (!activeCollegeId) {
      setExams([]);
      setIsLoadingExams(false);
      return;
    }
    
    setIsLoadingExams(true);
    setExams([]);
    setLastDoc(null);
    setHasMore(true);
    
    try {
      const result = await firebaseService.getExamsPaginated(activeCollegeId, selectedYear, 25);
      
      const formattedExams = result.exams.map(exam => ({
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
        createdAt: exam.createdAt.toLocaleString(),
        createdBy: exam.createdByName,
        createdById: exam.createdBy,
        createdByRole: exam.createdByRole
      }));
      
      setExams(formattedExams as Exam[]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      
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
    // Note: onCountsChange is called conditionally and is a stable function reference,
    // so it's safe to omit from dependencies to avoid unnecessary recreations
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollegeId, selectedYear, onExamsListChange]);
  
  // ✅ NEW: Check submission status after exams load
  useEffect(() => {
    const checkSubmissions = async () => {
      if (!userId || exams.length === 0) {
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

  const loadMoreExams = useCallback(async () => {
    if (!activeCollegeId || !lastDoc || !hasMore || isLoadingMore) {
      return;
    }
    
    setIsLoadingMore(true);
    
    try {
      const result = await firebaseService.getExamsPaginated(
        activeCollegeId, 
        selectedYear, 
        25, 
        lastDoc
      );
      
      const formattedExams = result.exams.map(exam => ({
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
        createdAt: exam.createdAt.toLocaleString(),
        createdBy: exam.createdByName,
        createdById: exam.createdBy,
        createdByRole: exam.createdByRole
      }));
      
      setExams(prevExams => [...prevExams, ...(formattedExams as Exam[])]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      
      // Notify parent component
      const updatedExams = [...exams, ...formattedExams];
      if (onExamsListChange) {
        onExamsListChange(updatedExams as Exam[]);
      }
    } catch (error) {
      console.error('Error loading more exams:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeCollegeId, selectedYear, lastDoc, hasMore, isLoadingMore, exams, onExamsListChange]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    observerRef.current = new IntersectionObserver((entries) => {
      const firstEntry = entries[0];
      if (firstEntry.isIntersecting && hasMore && !isLoadingMore && !isLoadingExams) {
        loadMoreExams();
      }
    }, options);

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, isLoadingExams, loadMoreExams]);

  useEffect(() => {
    if (activeCollegeId) {
      loadInitialExams();
    }
  }, [activeCollegeId, selectedYear, loadInitialExams]);

  // Auto-select and scroll to newly created exam
  useEffect(() => {
    let highlightTimer: ReturnType<typeof setTimeout>;
    
    if (newlyCreatedExamId && exams.length > 0) {
      const newExam = exams.find(exam => exam.id === newlyCreatedExamId);
      if (newExam) {
        // Select the newly created exam
        onExamSelect(newExam);
        
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
          if (onExamAutoSelected) {
            onExamAutoSelected();
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
  }, [newlyCreatedExamId, exams, onExamSelect, onExamAutoSelected, loadInitialExams]);

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
      
      // For students, only show exams for their class and board
      if (currentUserType === 'student') {
        const studentClassMatch = studentClass ? exam.class === studentClass : true;
        const studentBoardMatch = studentBoard ? exam.board === studentBoard : true;
        return studentClassMatch && studentBoardMatch;
      }
      
      // For teachers/admins, use the dropdown filters
      const yearMatch = selectedYear === FILTER_VALUES.ALL || exam.year === selectedYear;
      const classMatch = selectedClass === FILTER_VALUES.ALL || exam.class === selectedClass;
      const boardMatch = selectedBoard === FILTER_VALUES.ALL || exam.board === selectedBoard;
      const examTypeMatch = selectedExamType === FILTER_VALUES.ALL || exam.type === selectedExamType;
      return yearMatch && classMatch && boardMatch && examTypeMatch;
    });
    
    return filtered;
  }, [exams, selectedYear, selectedClass, selectedBoard, selectedExamType, currentUserType, studentClass, studentBoard, highlightedExamId]);

  // Filter exams including status filter and sort by priority
  const filteredExams = useMemo(() => {
    const filtered = baseFilteredExams.filter(exam => {
      const statusMatch = examFilter === FILTER_VALUES.ALL || exam.status === examFilter;
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
  }, [baseFilteredExams, examFilter, exams.length, highlightedExamId]);

  // Notify parent component when filtered exams change
  useEffect(() => {
    if (onExamsListChange) {
      onExamsListChange(filteredExams);
    }
  }, [filteredExams, onExamsListChange]);

  // Auto-select first exam when filtered exams change (only if no exam selected)
  useEffect(() => {
    if (filteredExams.length > 0 && !selectedExam) {
      // Only auto-select if NO exam is currently selected
      onExamSelect(filteredExams[0]);
    }
  }, [filteredExams, selectedExam, onExamSelect]);

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
        <>
          {/* Header with Filters */}
          <div className="sticky top-0 z-[100] h-[72px] bg-white px-6 py-4 pb-5 shadow-sm">
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
                        <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
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
          <div className="flex-1 overflow-y-auto h-[calc(100vh-72px)] px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                  <span className="ml-1 text-xs font-semibold">{baseFilteredExams.filter(e => e.status === EXAM_STATUS.UPCOMING).length}</span>
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
                  <span className="ml-1 text-xs font-semibold">{baseFilteredExams.filter(e => e.status === EXAM_STATUS.COMPLETED).length}</span>
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

            <p className="text-sm text-gray-600 mb-4">{filteredExams.length} examination{filteredExams.length !== 1 ? 's' : ''}</p>

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
              <div className="grid grid-cols-1 gap-4 pb-20">
                {filteredExams.map((exam) => {
                  return (
                    <div 
                      key={exam.id}
                      ref={(el) => { examCardsRef.current[exam.id] = el; }}
                      onClick={() => {
                        // Check if exam is already submitted
                        const isSubmitted = submittedExams[exam.id];
                        
                        if (isSubmitted) {
                          alert('❌ Exam Already Submitted\n\nYou have already submitted this exam and cannot re-enter it.\n\nPlease check the Results section to view your submission.');
                          return;
                        }
                        
                        onExamSelect(exam);
                      }}
                      className={`relative rounded-xl shadow-sm border p-5 transition-all duration-500 ${
                        submittedExams[exam.id] 
                          ? 'opacity-60 cursor-not-allowed bg-gray-50' // ✅ Visually show submitted exams
                          : 'cursor-pointer ' + (
                            highlightedExamId === exam.id
                              ? 'shadow-lg border'
                              : selectedExam?.id === exam.id 
                              ? 'shadow-md' 
                              : 'bg-white border-gray-200 hover:shadow-md'
                          )
                      }`}
                      style={
                        submittedExams[exam.id] ? {
                          backgroundColor: '#f9fafb',
                          borderColor: '#9ca3af',
                          cursor: 'not-allowed'
                        } : highlightedExamId === exam.id ? {
                          backgroundColor: '#fef2f2',
                          borderColor: '#ef4444',
                          boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.2)'
                        } : selectedExam?.id === exam.id ? {
                          backgroundColor: `${brandTheme.colors.primary}08`,
                          borderColor: brandTheme.colors.primary
                        } : {}
                      }
                      onMouseEnter={(e) => {
                        if (selectedExam?.id !== exam.id && !submittedExams[exam.id]) {
                          e.currentTarget.style.borderColor = brandTheme.colors.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedExam?.id !== exam.id && !submittedExams[exam.id]) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }
                      }}
                    >
                      {/* ✅ Show "SUBMITTED" badge if exam is submitted */}
                      {submittedExams[exam.id] && (
                        <div className="absolute top-3 right-3 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <FontAwesomeIcon icon={faCheckSquare} />
                          <span>SUBMITTED</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {exam.title}
                            </h3>
                            
                            {/* Live Indicator for Online Exams */}
                            {exam.mode === EXAM_MODES.ONLINE && exam.examTime && isExamLive(exam.examDate, exam.examTime, exam.duration) && (
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
                            <span className="flex items-center">
                              <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: '12px' }} className="mr-1" />
                              <span>Class {exam.class}</span>
                            </span>
                            <span className="flex items-center">
                              <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '12px' }} className="mr-1" />
                              <span>{exam.type}</span>
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                            {/* Status Icon */}
                            {exam.status === EXAM_STATUS.COMPLETED ? (
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            )}
                            ID: {exam.id}
                          </span>
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
                            <p className="text-sm font-medium text-gray-900">{formatDuration(exam.duration)}</p>
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
                            <p className="text-sm font-medium text-gray-900">{parseInt(exam.maxMarks || '0')} marks</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          {/* Board Badge */}
                          <span className="inline-flex items-center text-[11px] font-semibold text-indigo-700 bg-gradient-to-r from-indigo-50 to-indigo-100 px-3 py-1.5 rounded-lg shadow-sm">
                            {exam.board}
                          </span>
                          
                          {/* Year Badge */}
                          <span className="inline-flex items-center text-[11px] font-semibold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-1.5 rounded-lg shadow-sm">
                            {exam.year}
                          </span>
                          
                          {/* Security Level Badge */}
                          {exam.mode === EXAM_MODES.ONLINE && exam.securityLevel === SECURITY_LEVELS.SECURE && (
                            <div 
                              className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-help" 
                              title="Secure Exam - Enhanced Security Measures Enabled"
                            >
                              <FontAwesomeIcon icon={faShield} style={{ fontSize: '14px' }} className="text-red-600" />
                            </div>
                          )}
                          
                          {/* Attendance Badge */}
                          {exam.mode === EXAM_MODES.ONLINE && exam.attendance && (
                            <div 
                              className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-help" 
                              title="Attendance Required - Students must mark attendance"
                            >
                              <FontAwesomeIcon icon={faCheckSquare} style={{ fontSize: '14px' }} className="text-blue-600" />
                            </div>
                          )}
                          
                          {/* A/V Proctoring Badge */}
                          {exam.mode === EXAM_MODES.ONLINE && exam.avProctoring && (
                            <div 
                              className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-help" 
                              title="A/V Proctoring Enabled - Audio & Video Monitoring Active"
                            >
                              <FontAwesomeIcon icon={faVideo} style={{ fontSize: '14px' }} className="text-purple-600" />
                            </div>
                          )}
                        </div>
                        
                        {/* View Details Button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onExamSelect(exam);
                          }}
                          className="inline-flex items-center text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                          style={{ 
                            color: brandTheme.colors.primary,
                            backgroundColor: `${brandTheme.colors.primary}15`
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}25`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}15`;
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Sentinel for infinite scroll and loading indicator */}
                {hasMore && (
                  <div ref={sentinelRef} className="flex items-center justify-center py-8">
                    {isLoadingMore && (
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 border-4 rounded-full animate-spin"
                          style={{ 
                            borderColor: brandTheme.colors.primary + '20',
                            borderTopColor: brandTheme.colors.primary
                          }}
                        />
                        <span className="text-sm text-gray-500">Loading more exams...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* No more exams indicator */}
                {!hasMore && exams.length > 0 && (
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
        </>
      )}
    </>
  );
}

export default Exams;