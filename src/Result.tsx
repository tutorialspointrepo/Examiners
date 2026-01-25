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
  faUser,
  faBuilding,
  faCheckSquare,
  faClock,
  faTrophy
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import type { DocumentSnapshot } from 'firebase/firestore';
import { 
  EXAM_STATUS, 
  MONTH_NAMES_SHORT,
  USER_TYPES,
  hasPermissionLevel,
  type QuestionType,
  type ExamStatus, type ExamMode, type SecurityLevel,
} from './constants';

interface BrandTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  gradients: {
    primary: string;
    secondary: string;
  };
}

// Exam data structure
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

interface Exam {
  id: string;
  type: string;
  typeColor: string;
  year: string;
  class: string;
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
  totalQuestions: number;
  maxMarks: string;
  totalStudents?: number;
  questionPaperImages?: string[];
  questionsList?: Question[];
  createdAt: string;
  createdBy: string;
  createdById: string;
  createdByRole: string;
}

interface ResultProps {
  activeCollegeId: string;
  selectedYear: string;
  brandTheme: BrandTheme;
  onExamSelect: (exam: Exam) => void;
  selectedRoom?: any; 
  selectedExam: Exam | null;
  isMainCollapsed: boolean;
  onCollapse: () => void;
  onCountsChange?: () => void;
  onResultsListChange?: (completedExams: Exam[]) => void;
  onStudentsDataChange?: (data: { presentStudents: any[], absentStudents: any[], totalStudents: number }) => void;
  onStudentSelect?: (student: any) => void;
  selectedStudent?: any;
  currentUserType?: typeof USER_TYPES[keyof typeof USER_TYPES];
  currentUserId?: string;
}

function Result({ 
  activeCollegeId, 
  selectedYear, 
  brandTheme, 
  onExamSelect, 
  selectedExam,
  isMainCollapsed,
  onCollapse,
  onResultsListChange,
  onStudentsDataChange,
  onStudentSelect,
  selectedStudent,
  currentUserType = USER_TYPES.TEACHER,
  currentUserId,
}: ResultProps) {
  // Permission check - only users higher than students can view student list
  const canViewStudentList = useMemo(() => {
    return currentUserType && hasPermissionLevel(currentUserType, USER_TYPES.TEACHER);
  }, [currentUserType]);

  // State
  const [exams, setExams] = useState<Exam[]>([]);
  
  // Reset viewingStudents when selectedExam becomes null (when clicking Result in sidebar)
  useEffect(() => {
    if (selectedExam === null) {
      setViewingStudents(false);
      setSelectedExamForStudents(null);
      setPresentStudents([]);
      setAbsentStudents([]);
      setTotalStudents(0);
      setActiveStudentTab('all');
      setSearchQuery('');
    }
  }, [selectedExam]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [isLoadingMoreExams, setIsLoadingMoreExams] = useState(false); // ✅ ADDED: For exams pagination
  const [hasMoreExams, setHasMoreExams] = useState(true); // ✅ ADDED: For exams pagination
  const [lastExamDoc, setLastExamDoc] = useState<DocumentSnapshot | null>(null); // ✅ ADDED: For exams pagination
  
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedBoard, setSelectedBoard] = useState<string>('all');
  const [selectedExamType, setSelectedExamType] = useState<string>('all');
  const [viewingStudents, setViewingStudents] = useState(false);
  const [selectedExamForStudents, setSelectedExamForStudents] = useState<Exam | null>(null);
  const hasLoggedView = useRef(false); // Track if we've logged this view
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null);
  
  // New states for attendance-based student management
  const [presentStudents, setPresentStudents] = useState<any[]>([]);
  const [absentStudents, setAbsentStudents] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudentTab, setActiveStudentTab] = useState<'all' | 'present' | 'absent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  
  // Pagination state for students
  const [isLoadingMoreStudents, setIsLoadingMoreStudents] = useState(false);
  const [hasMorePresentStudents, setHasMorePresentStudents] = useState(true);
  const [hasMoreAbsentStudents, setHasMoreAbsentStudents] = useState(true);
  const [lastPresentStudentDoc, setLastPresentStudentDoc] = useState<DocumentSnapshot | null>(null);
  const [lastAbsentStudentDoc, setLastAbsentStudentDoc] = useState<DocumentSnapshot | null>(null);
  
  // Dropdown states
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [isExamTypeDropdownOpen, setIsExamTypeDropdownOpen] = useState(false);
  
  // College data
  const [classes, setClasses] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>([]);
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [showBoardFilter, setShowBoardFilter] = useState(false);
  const [showClassFilter, setShowClassFilter] = useState(false);
  const [showExamTypeFilter, setShowExamTypeFilter] = useState(false);
  
  // Refs
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const examTypeDropdownRef = useRef<HTMLDivElement>(null);
  const examCardsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // ✅ ADDED: Refs for pagination
  const examObserverRef = useRef<IntersectionObserver | null>(null);
  const examSentinelRef = useRef<HTMLDivElement>(null);
  const studentObserverRef = useRef<IntersectionObserver | null>(null);
  const studentSentinelRef = useRef<HTMLDivElement>(null);

  // Helper function to get actual question count from exam
  const getQuestionCount = (exam: Exam): number | string => {
    // Use totalQuestions from exam data
    if (exam.totalQuestions && exam.totalQuestions > 0) {
      return exam.totalQuestions;
    }
    
    // If unavailable, show '-'
    return '-';
  };

  // Helper function to get total marks from exam
  const getTotalMarks = (exam: Exam): number => {
    // ✅ Priority 1: Use exam.maxMarks from database (definitive source)
    if (exam.maxMarks) {
      const marks = parseFloat(exam.maxMarks);
      if (!isNaN(marks) && marks > 0) {
        return marks;
      }
    }
    
    // Priority 2: Calculate from questionsList only as fallback
    if (exam.questionsList && exam.questionsList.length > 0) {
      return exam.questionsList.reduce((total, question) => {
        return total + (question.maximumMarks || question.marks || 0);
      }, 0);
    }
    
    // Fallback: return 0
    return 0;
  };

  // Helper function to format date in DD-MON-YYYY
  function formatExamDate(dateString: string): string {
    if (!dateString) return 'Not scheduled';
    
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = MONTH_NAMES_SHORT[date.getMonth()];
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

  // ✅ ADDED: Helper function to format time spent (seconds to minutes and seconds)
  function formatTimeSpent(seconds: number): string {
    if (!seconds || seconds === 0) return '0m 0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  // ✅ MODIFIED: Changed from loadExams to loadInitialExams with pagination
  const loadInitialExams = useCallback(async () => {
    if (!activeCollegeId) {
      setExams([]);
      setIsLoadingExams(false);
      return;
    }
    
    setIsLoadingExams(true);
    setExams([]); // ✅ ADDED: Clear exams on initial load
    setLastExamDoc(null); // ✅ ADDED: Reset pagination
    setHasMoreExams(true); // ✅ ADDED: Reset hasMore flag
    
    try {
      console.log('📊 [RESULT.TSX] Loading completed exams for:', { activeCollegeId, selectedYear });
      
      // ✅ MODIFIED: Use getExamsPaginated instead of getExams
      const result = await firebaseService.getExamsPaginated(activeCollegeId, selectedYear, 25);
      
      // Filter only completed exams
      const completedExams = result.exams.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
      
      console.log('✅ [RESULT.TSX] Initial load complete:', {
        total: result.exams.length,
        completed: completedExams.length,
        hasMore: result.hasMore
      });
      
      setExams(completedExams as unknown as Exam[]);
      setLastExamDoc(result.lastDoc); // ✅ ADDED: Store last document
      setHasMoreExams(result.hasMore); // ✅ ADDED: Store hasMore flag
      
      // ✅ Extract unique filter values from completed exams
      const uniqueClasses = [...new Set(completedExams.map(e => e.class).filter(Boolean))];
      const uniqueBoards = [...new Set(completedExams.map(e => e.board).filter(Boolean))];
      const uniqueExamTypes = [...new Set(completedExams.map(e => e.type).filter(Boolean))];
      
      // Only show filters if there are options to filter
      if (uniqueClasses.length > 0) {
        setClasses(['all', ...uniqueClasses.sort()]);
        setShowClassFilter(uniqueClasses.length >= 1);
      } else {
        setClasses([]);
        setShowClassFilter(false);
      }
      
      if (uniqueBoards.length > 1) {
        setBoards(['all', ...uniqueBoards.sort()]);
        setShowBoardFilter(true);
      } else {
        setBoards([]);
        setShowBoardFilter(false);
      }
      
      if (uniqueExamTypes.length > 0) {
        setExamTypes(['all', ...uniqueExamTypes.sort()]);
        setShowExamTypeFilter(uniqueExamTypes.length >= 1);
      } else {
        setExamTypes([]);
        setShowExamTypeFilter(false);
      }
      
      // Notify parent of results list
      if (onResultsListChange) {
        onResultsListChange(completedExams as unknown as Exam[]);
      }
    } catch (error) {
      console.error('❌ [RESULT.TSX] Error loading completed exams:', error);
      setExams([]);
    } finally {
      setIsLoadingExams(false);
    }
  }, [activeCollegeId, selectedYear, onResultsListChange]);

  // ✅ ADDED: New function to load more exams
  const loadMoreExams = useCallback(async () => {
    if (!activeCollegeId || !lastExamDoc || !hasMoreExams || isLoadingMoreExams) {
      return;
    }
    
    console.log('📊 [RESULT.TSX] Loading more exams...');
    setIsLoadingMoreExams(true);
    
    try {
      const result = await firebaseService.getExamsPaginated(
        activeCollegeId, 
        selectedYear, 
        25, 
        lastExamDoc
      );
      
      // Filter only completed exams
      const completedExams = result.exams.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
      
      console.log('📊 [RESULT.TSX] More exams fetched:', completedExams.length);
      
      const updatedExams = [...exams, ...completedExams as unknown as Exam[]];
      setExams(updatedExams);
      setLastExamDoc(result.lastDoc);
      setHasMoreExams(result.hasMore);
      
      // ✅ Update filter options with new exams
      const uniqueClasses = [...new Set(updatedExams.map(e => e.class).filter(Boolean))];
      const uniqueBoards = [...new Set(updatedExams.map(e => e.board).filter(Boolean))];
      const uniqueExamTypes = [...new Set(updatedExams.map(e => e.type).filter(Boolean))];
      
      if (uniqueClasses.length > 0) {
        setClasses(['all', ...uniqueClasses.sort()]);
        setShowClassFilter(uniqueClasses.length >= 1);
      }
      
      if (uniqueBoards.length > 1) {
        setBoards(['all', ...uniqueBoards.sort()]);
        setShowBoardFilter(true);
      }
      
      if (uniqueExamTypes.length > 0) {
        setExamTypes(['all', ...uniqueExamTypes.sort()]);
        setShowExamTypeFilter(uniqueExamTypes.length >= 1);
      }
      
      // Notify parent
      if (onResultsListChange) {
        onResultsListChange(updatedExams as unknown as Exam[]);
      }
      
      console.log('✅ [RESULT.TSX] Load more complete:', {
        newExams: completedExams.length,
        totalExams: updatedExams.length,
        hasMore: result.hasMore
      });
    } catch (error) {
      console.error('Error loading more exams:', error);
    } finally {
      setIsLoadingMoreExams(false);
    }
  }, [activeCollegeId, selectedYear, lastExamDoc, hasMoreExams, isLoadingMoreExams, exams , onResultsListChange]);

  // ✅ ADDED: Setup intersection observer for exams infinite scroll
  useEffect(() => {
    if (!examSentinelRef.current || viewingStudents) return;

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    examObserverRef.current = new IntersectionObserver((entries) => {
      const firstEntry = entries[0];
      if (firstEntry.isIntersecting && hasMoreExams && !isLoadingMoreExams && !isLoadingExams) {
        console.log('🔄 [RESULT.TSX] Exam sentinel intersecting, loading more exams...');
        loadMoreExams();
      }
    }, options);

    examObserverRef.current.observe(examSentinelRef.current);

    return () => {
      if (examObserverRef.current) {
        examObserverRef.current.disconnect();
      }
    };
  }, [hasMoreExams, isLoadingMoreExams, isLoadingExams, loadMoreExams, viewingStudents]);

  // Load students for selected exam - Get all students from Users table, then match with attendance
  const loadStudentsForExam = useCallback(async (exam: Exam) => {
    // Permission check - students cannot view student list
    if (!canViewStudentList) {
      console.log('🚫 [RESULT.TSX] User does not have permission to view student list');
      return;
    }
    
    setIsLoadingStudents(true);
    setActiveStudentTab('all');
    
    // Clear and reset pagination state
    setPresentStudents([]);
    setAbsentStudents([]);
    setLastPresentStudentDoc(null);
    setLastAbsentStudentDoc(null);
    setHasMorePresentStudents(true);
    setHasMoreAbsentStudents(true);
    
    try {
      console.log('👥 [RESULT.TSX] Loading students for exam:', exam.id, 'Class:', exam.class, 'Board:', exam.board);
      console.log('📚 Total students (from Exams table):', exam.totalStudents || 0);
      
      // STEP 1: Get all students from Users table for this class
      const allStudentsResult = await firebaseService.getAllStudentsByClass(
        activeCollegeId,
        exam.class,
        exam.board
      );
      
      console.log('📊 [RESULT.TSX] Total students in class:', allStudentsResult.length);
      
      // STEP 2: Get attendance records for this exam
      const attendanceRecords = await firebaseService.getExamAttendance(exam.id);
      console.log(`📝 Total attendance records:`, attendanceRecords.length);
      
      // Filter for present students only (status = 'present')
      const presentAttendanceRecords = attendanceRecords.filter((record: any) => record.status === 'present');
      console.log(`✅ Present students from attendance:`, presentAttendanceRecords.length);
      
      // Create a Set of present student IDs for fast lookup
      const presentStudentIds = new Set(
        presentAttendanceRecords.map((record: any) => record.studentId)
      );
      
      // STEP 3: Get exam attempts for present students
      const attemptsResult = await firebaseService.getExamAttempts(exam.id);
      
      // Create a Map of attempts by studentId (handle duplicate attempts - keep latest)
      const attemptsMap = new Map();
      attemptsResult.forEach((attempt: any) => {
        const existingAttempt = attemptsMap.get(attempt.studentId);
        if (!existingAttempt) {
          attemptsMap.set(attempt.studentId, attempt);
        } else {
          // Keep the attempt with the most recent start time
          const existingStartTime = existingAttempt.startTime instanceof Date 
            ? existingAttempt.startTime 
            : new Date(existingAttempt.startTime);
          const currentStartTime = attempt.startTime instanceof Date 
            ? attempt.startTime 
            : new Date(attempt.startTime);
          
          if (currentStartTime > existingStartTime) {
            attemptsMap.set(attempt.studentId, attempt);
          }
        }
      });
      
      console.log(`✅ Exam attempts:`, attemptsResult.length, '(unique students:', attemptsMap.size, ')');
      
      // STEP 4: Separate all students into present and absent lists
      const presentStudentsList: any[] = [];
      const absentStudentsList: any[] = [];
      
      allStudentsResult.forEach((student: any) => {
        if (presentStudentIds.has(student.userId)) {
          // Student is present
          const attemptData = attemptsMap.get(student.userId);
          presentStudentsList.push({
            studentId: student.userId,
            studentName: student.fullName,
            rollNumber: student.studentRoll || 'N/A',
            hasAttempt: !!attemptData,
            attemptData: attemptData || null
          });
        } else {
          // Student is absent
          absentStudentsList.push({
            studentId: student.userId,
            studentName: student.fullName,
            rollNumber: student.studentRoll || 'N/A',
            hasAttempt: false,
            attemptData: null
          });
        }
      });
      
      // STEP 5: Calculate totals using exam.totalStudents (matching LiveStats logic)
      const totalStudentsCount = exam.totalStudents || allStudentsResult.length;
      
      console.log('✅ [RESULT.TSX] Loaded students:', {
        present: presentStudentsList.length,
        absent: absentStudentsList.length,
        total: totalStudentsCount,
        examTotalStudents: exam.totalStudents,
        actualClassSize: allStudentsResult.length
      });
      
      setPresentStudents(presentStudentsList);
      setAbsentStudents(absentStudentsList);
      setTotalStudents(totalStudentsCount);
      
      // For pagination: if we have more than 25 students, set hasMore flags
      setHasMorePresentStudents(presentStudentsList.length > 25);
      setHasMoreAbsentStudents(absentStudentsList.length > 25);
      
      
      setSelectedExamForStudents(exam);
      setViewingStudents(true);
    } catch (error) {
      console.error('❌ [RESULT.TSX] Error loading students:', error);
      setPresentStudents([]);
      setAbsentStudents([]);
      setTotalStudents(0);
    } finally {
      setIsLoadingStudents(false);
    }
  }, [activeCollegeId, canViewStudentList, onStudentsDataChange]);

  // Simple filter function for search
  const getFilteredStudents = () => {
    if (!searchQuery.trim()) {
      return { present: presentStudents, absent: absentStudents };
    }

    const lowerQuery = searchQuery.toLowerCase().trim();
    const filteredPresent = presentStudents.filter(s => 
      s.studentName?.toLowerCase().includes(lowerQuery) ||
      String(s.rollNumber || '').toLowerCase().includes(lowerQuery)
    );
    const filteredAbsent = absentStudents.filter(s => 
      s.studentName?.toLowerCase().includes(lowerQuery) ||
      String(s.rollNumber || '').toLowerCase().includes(lowerQuery)
    );

    return { present: filteredPresent, absent: filteredAbsent };
  };

  // ✅ ADDED: Load more present students
  const loadMorePresentStudents = useCallback(async () => {
    if (!hasMorePresentStudents || isLoadingMoreStudents || !selectedExamForStudents) return;
    
    console.log('👥 [RESULT.TSX] Loading more present students...');
    setIsLoadingMoreStudents(true);
    
    try {
      const result = await firebaseService.getExamPresentStudentsPaginated(
        selectedExamForStudents.id,
        selectedExamForStudents.class,
        selectedExamForStudents.board,
        25,
        lastPresentStudentDoc
      );
      
      console.log('📊 [RESULT.TSX] More present students fetched:', result.students.length);
      
      setPresentStudents(prev => [...prev, ...result.students]);
      setLastPresentStudentDoc(result.lastDoc);
      setHasMorePresentStudents(result.hasMore);
      
      
      console.log('✅ [RESULT.TSX] Load more present students complete:', {
        newStudents: result.students.length,
        totalPresent: presentStudents.length + result.students.length,
        hasMore: result.hasMore
      });
    } catch (error) {
      console.error('Error loading more present students:', error);
    } finally {
      setIsLoadingMoreStudents(false);
    }
  }, [hasMorePresentStudents, isLoadingMoreStudents, selectedExamForStudents, lastPresentStudentDoc, presentStudents.length]);

  // ✅ ADDED: Load more absent students
  const loadMoreAbsentStudents = useCallback(async () => {
    if (!hasMoreAbsentStudents || isLoadingMoreStudents || !selectedExamForStudents) return;
    
    console.log('👥 [RESULT.TSX] Loading more absent students...');
    setIsLoadingMoreStudents(true);
    
    try {
      const result = await firebaseService.getExamAbsentStudentsPaginated(
        selectedExamForStudents.id,
        selectedExamForStudents.class,
        selectedExamForStudents.board,
        25,
        lastAbsentStudentDoc
      );
      
      console.log('📊 [RESULT.TSX] More absent students fetched:', result.students.length);
      
      setAbsentStudents(prev => [...prev, ...result.students]);
      setLastAbsentStudentDoc(result.lastDoc);
      setHasMoreAbsentStudents(result.hasMore);
      
      
      console.log('✅ [RESULT.TSX] Load more absent students complete:', {
        newStudents: result.students.length,
        totalAbsent: absentStudents.length + result.students.length,
        hasMore: result.hasMore
      });
    } catch (error) {
      console.error('Error loading more absent students:', error);
    } finally {
      setIsLoadingMoreStudents(false);
    }
  }, [hasMoreAbsentStudents, isLoadingMoreStudents, selectedExamForStudents, lastAbsentStudentDoc, absentStudents.length]);

  // ✅ ADDED: Setup intersection observer for students infinite scroll
  useEffect(() => {
    if (!studentSentinelRef.current || !viewingStudents) return;

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    studentObserverRef.current = new IntersectionObserver((entries) => {
      const firstEntry = entries[0];
      if (firstEntry.isIntersecting && !isLoadingMoreStudents) {
        console.log('🔄 [RESULT.TSX] Student sentinel intersecting...');
        
        // Load more based on active tab
        if (activeStudentTab === 'present' || activeStudentTab === 'all') {
          if (hasMorePresentStudents) {
            loadMorePresentStudents();
          }
        }
        if (activeStudentTab === 'absent' || activeStudentTab === 'all') {
          if (hasMoreAbsentStudents) {
            loadMoreAbsentStudents();
          }
        }
      }
    }, options);

    studentObserverRef.current.observe(studentSentinelRef.current);

    return () => {
      if (studentObserverRef.current) {
        studentObserverRef.current.disconnect();
      }
    };
  }, [viewingStudents, hasMorePresentStudents, hasMoreAbsentStudents, isLoadingMoreStudents, loadMorePresentStudents, loadMoreAbsentStudents, activeStudentTab]);

  // ✅ MODIFIED: Use loadInitialExams instead of loadExams
  useEffect(() => {
    if (activeCollegeId) {
      loadInitialExams();
      
      // Log view activity (non-blocking) - ONLY ONCE
      if (!hasLoggedView.current) {
        hasLoggedView.current = true; // Mark as logged
        (async () => {
          try {
            const currentUser = await firebaseService.getCurrentUserProfile();
            if (currentUser) {
              await firebaseService.addActivityLog({
                userId: currentUser.userId,
                collegeId: activeCollegeId,
                action: 'list_exam_results',
                entityType: 'results_list',
                entityId: 'results_page',
                details: JSON.stringify({
                  viewType: 'results_list',
                  selectedYear: selectedYear,
                  selectedClass: selectedClass,
                  selectedBoard: selectedBoard
                })
              });
            }
          } catch (logError) {
            console.warn('⚠️ Failed to log student performance view:', logError);
          }
        })();
      }
    }
  }, [activeCollegeId, selectedYear, loadInitialExams]);

  // Load college data - filters are now populated from exam data dynamically
  useEffect(() => {
    const loadCollegeData = async () => {
      if (!activeCollegeId) {
        setClasses([]);
        setBoards([]);
        setExamTypes([]);
        setShowBoardFilter(false);
        setShowClassFilter(false);
        setShowExamTypeFilter(false);
        return;
      }

      try {
        const college = await firebaseService.getCollegeById(activeCollegeId);
        
        if (college) {
          console.log('📊 [RESULT.TSX] College data loaded:', college.collegeName);
          // Filters are now dynamically populated from exam data
          // No need to load from college config
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

  // Don't auto-load students - user must click "View Students" button
  // (Removed auto-loading useEffect that was causing students to load automatically)

  // Pass student data to parent for dashboard
  useEffect(() => {
    if (selectedExamForStudents && onStudentsDataChange) {
      onStudentsDataChange({
        presentStudents,
        absentStudents,
        totalStudents
      });
    }
  }, [selectedExamForStudents, presentStudents, absentStudents, totalStudents, onStudentsDataChange]);

  const goBackToExamsList = () => {
    setViewingStudents(false);
    setSelectedExamForStudents(null);
    setPresentStudents([]);
    setAbsentStudents([]);
    setTotalStudents(0);
    setActiveStudentTab('all');
  };

  // Filter exams by class, board, and exam type
  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const classMatch = selectedClass === 'all' || exam.class === selectedClass;
      const boardMatch = selectedBoard === 'all' || exam.board === selectedBoard;
      const examTypeMatch = selectedExamType === 'all' || exam.type === selectedExamType;
      return classMatch && boardMatch && examTypeMatch;
    });
  }, [exams, selectedClass, selectedBoard, selectedExamType]);

  // Helper functions

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return brandTheme.colors.primary || '#22c55e';
    if (percentage >= 75) return '#3b82f6';
    if (percentage >= 60) return '#f59e0b';
    if (percentage >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <>
      {isMainCollapsed ? (
        <div className="flex flex-col items-center justify-center h-full py-8 space-y-4">
          <FontAwesomeIcon icon={faTrophy} style={{ fontSize: '24px' }} className="text-gray-600" />
          <div className="text-gray-600 font-semibold text-sm tracking-wider"
               style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            Exam Results
          </div>
        </div>
      ) : (
        <>
          {/* Header with Filters - Same as Exams.tsx */}
          <div className={`sticky top-0 z-[100] ${viewingStudents ? 'bg-white' : 'bg-white h-[64px]'} px-6 ${viewingStudents ? 'py-4' : 'py-3 pb-4'} shadow-sm border-b border-gray-200`}>
            {viewingStudents && selectedExamForStudents ? (
              // Header when viewing students - reorganized layout
              <>
                {/* Row 1: Trophy + Results Title + Back Button */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <FontAwesomeIcon icon={faTrophy} style={{ fontSize: '28px' }} className="text-gray-900" />
                    <h2 
                      className="text-2xl font-bold text-gray-900 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => {
                        if (selectedStudent && onStudentSelect) {
                          onStudentSelect(null);
                        }
                      }}
                      title="Click to view exam dashboard"
                    >
                      Exam Results
                    </h2>
                  </div>
                  <button 
                    onClick={goBackToExamsList}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Back to Exam Results"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: '20px' }} />
                  </button>
                </div>

                {/* Row 2: Exam Details */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">{selectedExamForStudents.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faUsers} style={{ fontSize: '12px' }} className="mr-1" />
                        {selectedExamForStudents.totalStudents || 0} Students
                      </span>
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: '12px' }} className="mr-1" />
                        Class {selectedExamForStudents.class}
                      </span>
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '12px' }} className="mr-1" />
                        {selectedExamForStudents.type}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-md">
                    ID: {selectedExamForStudents.id}
                  </span>
                </div>

                {/* Row 3: Search Bar */}
                <div className="mt-3 relative">
                  <input
                    type="text"
                    placeholder="Search by name or roll number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                    style={{ 
                      outlineColor: brandTheme.colors.primary
                    }}
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </>
            ) : (
              // Header when viewing exams list
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <FontAwesomeIcon icon={faTrophy} style={{ fontSize: '28px' }} className="text-gray-900" />
                    <h2 className="text-2xl font-bold text-gray-900">Exam Results</h2>
                    
                    {/* Class Dropdown - Only show if there are classes in exams */}
                    {showClassFilter && (
                    <div ref={classDropdownRef} className="relative class-dropdown-container z-[200]">
                      <button 
                        onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: '16px' }} />
                        <span>{selectedClass === 'all' ? 'Class' : selectedClass}</span>
                        <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className={`transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isClassDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[300]">
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
                              {classItem === 'all' ? 'All Classes' : classItem}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                    
                    {/* Board Dropdown */}
                    {showBoardFilter && (
                      <div ref={boardDropdownRef} className="relative board-dropdown-container z-[200]">
                        <button 
                          onClick={() => setIsBoardDropdownOpen(!isBoardDropdownOpen)}
                          className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          <FontAwesomeIcon icon={faBuilding} style={{ fontSize: '16px' }} />
                          <span>{selectedBoard === 'all' ? 'Board' : selectedBoard}</span>
                          <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className={`transition-transform ${isBoardDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isBoardDropdownOpen && (
                          <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[300]">
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
                                {boardItem === 'all' ? 'All Boards' : boardItem}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Exam Type Dropdown - Only show if there are exam types in exams */}
                    {showExamTypeFilter && (
                    <div ref={examTypeDropdownRef} className="relative exam-type-dropdown-container z-[200]">
                      <button 
                        onClick={() => setIsExamTypeDropdownOpen(!isExamTypeDropdownOpen)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        <span>{selectedExamType === 'all' ? 'Exam Type' : selectedExamType}</span>
                        <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className={`transition-transform ${isExamTypeDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isExamTypeDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[300]">
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
                              {type === 'all' ? 'All Types' : type}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => {
                      if (viewingStudents) {
                        // If viewing students, go back to exams list
                        setViewingStudents(false);
                        setSelectedExamForStudents(null);
                        setPresentStudents([]);
                        setAbsentStudents([]);
                        setTotalStudents(0);
                        setSearchQuery('');
                        setActiveStudentTab('all');
                      } else {
                        // Otherwise collapse the sidebar
                        onCollapse();
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={viewingStudents ? "Back to Exams" : "Collapse"}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: '20px' }} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Content Area */}
          <div className={`flex-1 overflow-y-auto ${viewingStudents ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-72px)]'} ${viewingStudents ? '' : 'px-6'} bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
            {viewingStudents ? (
              // ========== STUDENTS VIEW ==========
              !canViewStudentList ? (
                // Permission denied message for students
                <div className="w-full h-full flex items-center justify-center px-6">
                  <div className="text-center max-w-md">
                    <div className="mb-6">
                      <FontAwesomeIcon 
                        icon={faShield} 
                        style={{ fontSize: '80px' }} 
                        className="text-gray-300"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      Access Restricted
                    </h3>
                    <p className="text-gray-600 mb-6">
                      You don't have permission to view the student list. This section is only accessible to teachers and administrators.
                    </p>
                    <button
                      onClick={goBackToExamsList}
                      className="px-6 py-2.5 rounded-lg font-medium transition-colors"
                      style={{
                        backgroundColor: brandTheme.colors.primary,
                        color: 'white'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      Back to Results
                    </button>
                  </div>
                </div>
              ) : (
              <div className="w-full h-full">
                {/* Students List */}
                <div className="overflow-y-auto px-6 py-2 bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">{/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                  <div className="flex space-x-8">
                    <button
                      onClick={() => setActiveStudentTab('all')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeStudentTab === 'all'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      All Students ({totalStudents})
                    </button>
                    <button
                      onClick={() => setActiveStudentTab('present')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeStudentTab === 'present'
                          ? 'border-green-600 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Present ({presentStudents.length})
                    </button>
                    <button
                      onClick={() => setActiveStudentTab('absent')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeStudentTab === 'absent'
                          ? 'border-red-600 text-red-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Absent ({absentStudents.length})
                    </button>
                  </div>
                </div>
                
                {isLoadingStudents ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
                      style={{ 
                        borderColor: brandTheme.colors.primary + '20',
                        borderTopColor: brandTheme.colors.primary
                      }}
                    />
                    <p className="text-gray-600 font-medium">Loading students...</p>
                  </div>
                ) : totalStudents === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <FontAwesomeIcon icon={faUsers} style={{ fontSize: '80px' }} className="text-gray-300 mb-6" />
                    <p className="text-gray-700 font-semibold text-lg mb-2">No students found</p>
                    <p className="text-sm text-gray-500 mb-4">No attendance records found for this exam</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* All Students Tab - Show both present and absent */}
                    {activeStudentTab === 'all' && (() => {
                      const filtered = getFilteredStudents();
                      return (
                      <>
                        {/* Present Students Section */}
                        {filtered.present.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                              Present Students ({filtered.present.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                            {filtered.present.map((student, index) => {
                                const isSelected = selectedStudent?.studentId === student.studentId;
                                return (
                                <div 
                                  key={student.studentId || index}
                                  className={`rounded-xl border p-5 bg-white hover:shadow-md transition-all duration-300 cursor-pointer ${
                                    isSelected ? 'shadow-lg' : ''
                                  }`}
                                  style={{
                                    borderColor: isSelected ? brandTheme.colors.primary : '#e5e7eb',
                                    backgroundColor: isSelected ? `${brandTheme.colors.primary}05` : 'white'
                                  }}
                                  onClick={() => {
                                    if (onStudentSelect) {
                                      onStudentSelect(student);
                                    }
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = brandTheme.colors.primary;
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = '#e5e7eb';
                                    }
                                  }}
                                >
                                  {/* Top Section - Student Info */}
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                                        {student.studentName || 'Student Name'}
                                      </h3>
                                      <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="flex items-center">
                                          <FontAwesomeIcon icon={faUser} style={{ fontSize: '14px' }} className="mr-1.5" />
                                          <span>Roll: {student.rollNumber || 'N/A'}</span>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      {student.hasAttempt && student.attemptData ? (
                                        <div 
                                          className="text-2xl font-bold px-4 py-2 rounded-lg inline-block"
                                          style={{ 
                                            color: getScoreColor(student.attemptData.percentage || 0),
                                            backgroundColor: `${getScoreColor(student.attemptData.percentage || 0)}15`
                                          }}
                                        >
                                          {(student.attemptData.percentage || 0).toFixed(2)}%
                                        </div>
                                      ) : (
                                        <div 
                                          className="text-2xl font-bold px-4 py-2 rounded-lg inline-block text-gray-400 bg-gray-100"
                                        >
                                          0.00%
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Middle Section - Details Grid (Light Background) */}
                                  <div 
                                    className="grid grid-cols-3 gap-4 p-4 rounded-lg mb-4"
                                    style={{ 
                                      backgroundColor: student.hasAttempt ? `${brandTheme.colors.primary}08` : '#fef3c7'
                                    }}
                                  >
                                    {student.hasAttempt && student.attemptData ? (
                                      <>
                                      <div className="flex items-start space-x-3">
                                        <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '20px' }} className="text-gray-500 mt-1" />
                                        <div>
                                          <p className="text-xs text-gray-500">Attempted</p>
                                          <p className="text-base font-bold text-gray-900">
                                            {student.attemptData.attemptedQuestions || 0} / {selectedExamForStudents ? getQuestionCount(selectedExamForStudents) : (student.attemptData.totalQuestions || 0)}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-start space-x-3">
                                        <FontAwesomeIcon icon={faAward} style={{ fontSize: '20px' }} className="text-gray-500 mt-1" />
                                        <div>
                                          <p className="text-xs text-gray-500">Score</p>
                                          <p className="text-base font-bold text-gray-900">
                                            {student.attemptData.obtainedMarks || 0} / {selectedExamForStudents ? getTotalMarks(selectedExamForStudents) : 0}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-start space-x-3">
                                        <FontAwesomeIcon icon={faClock} style={{ fontSize: '20px' }} className="text-gray-500 mt-1" />
                                        <div>
                                          <p className="text-xs text-gray-500">Time Spent</p>
                                          <p className="text-base font-bold text-gray-900">
                                            {student.attemptData.timeSpent ? formatTimeSpent(student.attemptData.timeSpent) : 'N/A'}
                                          </p>
                                        </div>
                                      </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-start space-x-3">
                                          <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '20px' }} className="text-gray-400 mt-1" />
                                          <div>
                                            <p className="text-xs text-gray-500">Attempted</p>
                                            <p className="text-base font-bold text-gray-400">0 / {selectedExamForStudents ? getQuestionCount(selectedExamForStudents) : 0}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-start space-x-3">
                                          <FontAwesomeIcon icon={faAward} style={{ fontSize: '20px' }} className="text-gray-400 mt-1" />
                                          <div>
                                            <p className="text-xs text-gray-500">Score</p>
                                            <p className="text-base font-bold text-gray-400">0 / {selectedExamForStudents ? getTotalMarks(selectedExamForStudents) : 0}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-start space-x-3">
                                          <FontAwesomeIcon icon={faClock} style={{ fontSize: '20px' }} className="text-gray-400 mt-1" />
                                          <div>
                                            <p className="text-xs text-gray-500">Time Spent</p>
                                            <p className="text-base font-bold text-gray-400">0m 0s</p>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {/* Bottom Section - Status Badges */}
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    <div className="flex items-center space-x-2">
                                      <span 
                                        className={`text-xs font-semibold px-4 py-2 rounded-full ${
                                          student.hasAttempt 
                                            ? 'text-green-700 bg-green-100'
                                            : 'text-yellow-700 bg-yellow-100'
                                        }`}
                                      >
                                        {student.hasAttempt ? '✓ Submitted' : '⚠ Not Submitted'}
                                      </span>
                                      {student.hasAttempt && student.attemptData && (
                                        <span 
                                          className={`text-xs font-semibold px-4 py-2 rounded-full ${
                                            (student.attemptData.violationCount || 0) === 0
                                              ? 'text-green-700 bg-green-100' 
                                              : 'text-red-700 bg-red-100'
                                          }`}
                                        >
                                          Violation ({student.attemptData.violationCount || 0})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )})}
                            </div>
                          </div>
                        )}

                        {/* Absent Students Section */}
                        {filtered.absent.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                              Absent Students ({filtered.absent.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                              {filtered.absent.map((student, index) => (
                                <div 
                                  key={student.studentId || index}
                                  className="rounded-xl border border-gray-200 p-5 bg-gray-50 opacity-75"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h3 className="text-lg font-semibold text-gray-700">
                                        {student.studentName || 'Student Name'}
                                      </h3>
                                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        <span className="flex items-center">
                                          <FontAwesomeIcon icon={faUser} style={{ fontSize: '12px' }} className="mr-1" />
                                          <span>Roll: {student.rollNumber || 'N/A'}</span>
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-4 py-2 rounded-full">
                                      ✗ Absent
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ✅ ADDED: Sentinel for students infinite scroll */}
                        {(hasMorePresentStudents || hasMoreAbsentStudents) && (
                          <div ref={studentSentinelRef} className="flex items-center justify-center py-8">
                            {isLoadingMoreStudents && (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 border-4 rounded-full animate-spin"
                                  style={{ 
                                    borderColor: brandTheme.colors.primary + '20',
                                    borderTopColor: brandTheme.colors.primary
                                  }}
                                />
                                <span className="text-sm text-gray-500">Loading more students...</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ✅ ADDED: No more students indicator */}
                        {!hasMorePresentStudents && !hasMoreAbsentStudents && (presentStudents.length > 0 || absentStudents.length > 0) && (
                          <div className="flex flex-col items-center justify-center py-8">
                            <div className="relative mb-3">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-2xl mb-1">📭</div>
                                  <div className="w-8 h-0.5 bg-gray-300 rounded"></div>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-gray-700">That's everyone!</p>
                            <p className="text-xs text-gray-400 mt-1">No more students to load</p>
                          </div>
                        )}
                      </>
                    );
                    })()}

                    {/* Present Students Only Tab */}
                    {activeStudentTab === 'present' && (() => {
                      const filtered = getFilteredStudents();
                      return (
                      <>
                        <div className="grid grid-cols-1 gap-4">
                          {filtered.present.map((student, index) => (
                            <div 
                              key={student.studentId || index}
                              className="rounded-xl border border-gray-200 p-5 bg-white hover:shadow-md transition-all duration-300 cursor-pointer"
                              onClick={() => {
                                if (onStudentSelect) {
                                  onStudentSelect(student);
                                }
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = brandTheme.colors.primary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              {/* Same student card as above - keeping code DRY */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {student.studentName || 'Student Name'}
                                  </h3>
                                  <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <span className="flex items-center">
                                      <FontAwesomeIcon icon={faUser} style={{ fontSize: '14px' }} className="mr-1.5" />
                                      <span>Roll: {student.rollNumber || 'N/A'}</span>
                                    </span>
                                  </div>
                                </div>
                                {student.hasAttempt && student.attemptData && (
                                  <div className="text-right">
                                    <div 
                                      className="text-2xl font-bold px-4 py-2 rounded-lg inline-block"
                                      style={{ 
                                        color: getScoreColor(student.attemptData.percentage || 0),
                                        backgroundColor: `${getScoreColor(student.attemptData.percentage || 0)}15`
                                      }}
                                    >
                                      {(student.attemptData.percentage || 0).toFixed(2)}%
                                    </div>
                                  </div>
                                )}
                              </div>

                              {student.hasAttempt && student.attemptData && (
                                <div 
                                  className="grid grid-cols-3 gap-4 p-4 rounded-lg mb-4"
                                  style={{ 
                                    backgroundColor: student.hasAttempt ? `${brandTheme.colors.primary}08` : '#fef3c7'
                                  }}
                                >
                                  <div className="flex items-start space-x-3">
                                    <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '20px' }} className="text-gray-500 mt-1" />
                                    <div>
                                      <p className="text-xs text-gray-500">Attempted</p>
                                      <p className="text-base font-bold text-gray-900">
                                        {student.attemptData.attemptedQuestions || 0} / {selectedExamForStudents ? getQuestionCount(selectedExamForStudents) : (student.attemptData.totalQuestions || 0)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-start space-x-3">
                                    <FontAwesomeIcon icon={faAward} style={{ fontSize: '20px' }} className="text-gray-500 mt-1" />
                                    <div>
                                      <p className="text-xs text-gray-500">Score</p>
                                      <p className="text-base font-bold text-gray-900">
                                        {student.attemptData.obtainedMarks || 0} / {selectedExamForStudents ? getTotalMarks(selectedExamForStudents) : 0}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-start space-x-3">
                                    <FontAwesomeIcon icon={faClock} style={{ fontSize: '20px' }} className="text-gray-500 mt-1" />
                                    <div>
                                      <p className="text-xs text-gray-500">Time Spent</p>
                                      <p className="text-base font-bold text-gray-900">
                                        {student.attemptData.timeSpent ? formatTimeSpent(student.attemptData.timeSpent) : 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <div className="flex items-center space-x-2">
                                  <span 
                                    className={`text-xs font-semibold px-4 py-2 rounded-full ${
                                      student.hasAttempt 
                                        ? 'text-green-700 bg-green-100'
                                        : 'text-yellow-700 bg-yellow-100'
                                    }`}
                                  >
                                    {student.hasAttempt ? '✓ Submitted' : '⚠ Not Submitted'}
                                  </span>
                                  {student.hasAttempt && student.attemptData && (
                                    <span 
                                      className={`text-xs font-semibold px-4 py-2 rounded-full ${
                                        (student.attemptData.violationCount || 0) === 0
                                          ? 'text-green-700 bg-green-100' 
                                          : 'text-red-700 bg-red-100'
                                      }`}
                                    >
                                      Violation ({student.attemptData.violationCount || 0})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* ✅ ADDED: Sentinel for present students infinite scroll */}
                        {hasMorePresentStudents && (
                          <div ref={studentSentinelRef} className="flex items-center justify-center py-8">
                            {isLoadingMoreStudents && (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 border-4 rounded-full animate-spin"
                                  style={{ 
                                    borderColor: brandTheme.colors.primary + '20',
                                    borderTopColor: brandTheme.colors.primary
                                  }}
                                />
                                <span className="text-sm text-gray-500">Loading more students...</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ✅ ADDED: No more students indicator */}
                        {!hasMorePresentStudents && presentStudents.length > 0 && (
                          <div className="flex flex-col items-center justify-center py-8">
                            <div className="relative mb-3">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-2xl mb-1">📭</div>
                                  <div className="w-8 h-0.5 bg-gray-300 rounded"></div>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-gray-700">That's everyone!</p>
                            <p className="text-xs text-gray-400 mt-1">No more students to load</p>
                          </div>
                        )}
                      </>
                    );
                    })()}

                    {/* Absent Students Only Tab */}
                    {activeStudentTab === 'absent' && (() => {
                      const filtered = getFilteredStudents();
                      return (
                        <>
                          <div className="grid grid-cols-1 gap-4">
                            {filtered.absent.length > 0 ? (
                              filtered.absent.map((student, index) => (
                                <div 
                                  key={student.studentId || index}
                                  className="rounded-xl border border-gray-200 p-5 bg-gray-50 opacity-75"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h3 className="text-lg font-semibold text-gray-700">
                                        {student.studentName || 'Student Name'}
                                      </h3>
                                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        <span className="flex items-center">
                                          <FontAwesomeIcon icon={faUser} style={{ fontSize: '12px' }} className="mr-1" />
                                          <span>Roll: {student.rollNumber || 'N/A'}</span>
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-4 py-2 rounded-full">
                                      ✗ Absent
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="flex flex-col items-center justify-center py-20">
                                <div className="relative mb-4">
                                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200 flex items-center justify-center">
                                    <div className="text-center">
                                      <div className="text-3xl mb-1">✅</div>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-lg font-semibold text-gray-900 mb-2">Perfect Attendance!</p>
                                <p className="text-sm text-gray-500 text-center max-w-md">
                                  All students marked present for this exam
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Sentinel for absent students infinite scroll */}
                          {hasMoreAbsentStudents && (
                            <div ref={studentSentinelRef} className="flex items-center justify-center py-8">
                              {isLoadingMoreStudents && (
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 border-4 rounded-full animate-spin"
                                    style={{ 
                                      borderColor: brandTheme.colors.primary + '20',
                                      borderTopColor: brandTheme.colors.primary
                                    }}
                                  />
                                  <span className="text-sm text-gray-500">Loading more students...</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* No more students indicator */}
                          {!hasMoreAbsentStudents && absentStudents.length > 0 && (
                            <div className="flex flex-col items-center justify-center py-8">
                              <div className="relative mb-3">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-2xl mb-1">📭</div>
                                    <div className="w-8 h-0.5 bg-gray-300 rounded"></div>
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm font-semibold text-gray-700">That's everyone!</p>
                              <p className="text-xs text-gray-400 mt-1">No more students to load</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              </div>
              )
            ) : (
              // ========== EXAMS VIEW ==========
              <>
              <p className="text-sm text-gray-600 mb-6 font-medium">{filteredExams.length} result{filteredExams.length !== 1 ? 's' : ''}</p>

                {/* Loading State */}
                {isLoadingExams ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
                      style={{ 
                        borderColor: brandTheme.colors.primary + '20',
                        borderTopColor: brandTheme.colors.primary
                      }}
                    />
                    <p className="text-gray-600 font-medium">Loading results...</p>
                  </div>
                ) : filteredExams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="relative mb-6">
                      <FontAwesomeIcon icon={faTrophy} style={{ fontSize: '80px' }} className="text-gray-300" />
                      <div className="absolute -top-2 -right-4 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      <div className="absolute top-4 -left-6 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                      <div className="absolute -bottom-2 right-8 w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                    </div>
                    <p className="text-gray-700 font-semibold text-lg mb-2">No completed exams found</p>
                    <p className="text-sm text-gray-500 mb-4">No completed exams available for the selected filters</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 pb-10">
                      {filteredExams.map((exam) => {
                        return (
                          <div 
                            key={exam.id}
                            ref={(el) => { examCardsRef.current[exam.id] = el; }}
                            onClick={async () => {
                              console.log('🔍 [RESULT.TSX] Loading exam for dashboard and students:', exam.id);
                              setLoadingExamId(exam.id);
                              
                              // Check permissions before loading students
                              if (!canViewStudentList) {
                                console.log('🚫 [RESULT.TSX] Student role - loading their attempt and showing answer sheet');
                                
                                try {
                                  // For students, load their own attempt data and show answer sheet
                                  if (currentUserId) {
                                    console.log('📝 [RESULT.TSX] Current User ID:', currentUserId);
                                    
                                    // Get the student's attempt data
                                    const attempts = await firebaseService.getExamAttempts(exam.id);
                                    console.log('📊 [RESULT.TSX] All attempts for exam:', attempts.length);
                                    
                                    const studentAttempt = attempts.find((attempt: any) => attempt.studentId === currentUserId);
                                    console.log('✅ [RESULT.TSX] Student attempt found:', !!studentAttempt);
                                    
                                    // Get student info
                                    const studentInfo = await firebaseService.getUserProfile(currentUserId);
                                    console.log('👤 [RESULT.TSX] Student info:', studentInfo?.fullName);
                                    
                                    // Create student object with attempt data
                                    const studentData = {
                                      studentId: currentUserId,
                                      studentName: studentInfo?.fullName || 'Student',
                                      rollNumber: studentInfo?.studentRoll || 'N/A',
                                      hasAttempt: !!studentAttempt,
                                      attemptData: studentAttempt || null
                                    };
                                    
                                    console.log('🎯 [RESULT.TSX] Selecting exam and student:', {
                                      examId: exam.id,
                                      studentName: studentData.studentName,
                                      hasAttempt: studentData.hasAttempt
                                    });
                                    
                                    // IMPORTANT: Select exam first, then student
                                    onExamSelect(exam);
                                    
                                    // Then select the student to trigger answer sheet view
                                    if (onStudentSelect) {
                                      console.log('📤 [RESULT.TSX] Calling onStudentSelect with student data');
                                      onStudentSelect(studentData);
                                    } else {
                                      console.warn('⚠️ [RESULT.TSX] onStudentSelect callback is not defined!');
                                    }
                                  } else {
                                    console.warn('⚠️ [RESULT.TSX] No currentUserId provided!');
                                    // If no currentUserId, just show dashboard
                                    onExamSelect(exam);
                                  }
                                } catch (error) {
                                  console.error('❌ [RESULT.TSX] Error loading student attempt:', error);
                                  // Fallback to just showing dashboard
                                  onExamSelect(exam);
                                } finally {
                                  setLoadingExamId(null);
                                }
                                return;
                              }
                              
                              // Load students and show dashboard when card is clicked
                              if (canViewStudentList) {
                                setViewingStudents(true);
                                try {
                                  await loadStudentsForExam(exam);
                                  onExamSelect(exam);
                                } finally {
                                  setLoadingExamId(null);
                                }
                              } else {
                                // For students, just show their own result
                                onExamSelect(exam);
                                setLoadingExamId(null);
                              }
                            }}
                            className={`rounded-xl shadow-sm border p-5 cursor-pointer transition-all duration-500 relative ${
                              selectedExam?.id === exam.id 
                                ? 'shadow-md' 
                                : 'bg-white border-gray-200 hover:shadow-md'
                            }`}
                            style={
                              selectedExam?.id === exam.id ? {
                                backgroundColor: `${brandTheme.colors.primary}08`,
                                borderColor: brandTheme.colors.primary
                              } : {}
                            }
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              if (selectedExam?.id !== exam.id) {
                                e.currentTarget.style.borderColor = brandTheme.colors.primary;
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation();
                              if (selectedExam?.id !== exam.id) {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }
                            }}
                          >
                            {/* Loading Overlay */}
                            {loadingExamId === exam.id && (
                              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                                <div className="flex flex-col items-center">
                                  <div className="w-10 h-10 border-4 rounded-full animate-spin mb-2"
                                    style={{ 
                                      borderColor: brandTheme.colors.primary + '20',
                                      borderTopColor: brandTheme.colors.primary
                                    }}
                                  />
                                  <p className="text-sm font-medium" style={{ color: brandTheme.colors.primary }}>
                                    Loading...
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {exam.title}
                                  </h3>
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
                              <div className="flex flex-col items-end">
                                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">ID: {exam.id}</span>
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
                                  <p className="text-sm font-medium text-gray-900">{exam.duration}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '16px' }} className="text-gray-500" />
                                <div>
                                  <p className="text-xs text-gray-500">Questions</p>
                                  <p className="text-sm font-medium text-gray-900">{getQuestionCount(exam)} Qs</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <FontAwesomeIcon icon={faAward} style={{ fontSize: '16px' }} className="text-gray-500" />
                                <div>
                                  <p className="text-xs text-gray-500">Max Marks</p>
                                  <p className="text-sm font-medium text-gray-900">{exam.maxMarks}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full">
                                  {exam.board}
                                </span>
                                <span className="text-[11px] font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                                  {exam.year}
                                </span>
                                {exam.mode === 'online' && exam.securityLevel === 'secure' && (
                                  <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center" title="Secure Exam">
                                    <FontAwesomeIcon icon={faShield} style={{ fontSize: '14px' }} className="text-red-600" />
                                  </div>
                                )}
                                {exam.mode === 'online' && exam.attendance && (
                                  <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center" title="Attendance Required">
                                    <FontAwesomeIcon icon={faCheckSquare} style={{ fontSize: '14px' }} className="text-blue-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                {/* View Students Button - visual indicator */}
                                {canViewStudentList && (
                                  <div
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg pointer-events-none"
                                    style={{
                                      backgroundColor: `${brandTheme.colors.primary}15`,
                                      color: brandTheme.colors.primary
                                    }}
                                    title="Click card to view students"
                                  >
                                    <FontAwesomeIcon icon={faUsers} style={{ fontSize: '12px' }} className="mr-1.5" />
                                    View Students
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ✅ ADDED: Sentinel for exams infinite scroll and loading indicator */}
                    {hasMoreExams && (
                      <div ref={examSentinelRef} className="flex items-center justify-center py-8">
                        {isLoadingMoreExams && (
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

                    {/* ✅ ADDED: No more exams indicator */}
                    {!hasMoreExams && exams.length > 0 && (
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
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default Result;