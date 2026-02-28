import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faClipboardList,
  faCalendar,
  faUsers,
  faGraduationCap,
  faClock,
  faCircleCheck,
  faChartLine,
  faXmark,
  faPhone,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService, type UserModel } from './services/firebase_service';
import { 
  ATTENDANCE_STATUS,
  EXAM_MODES,
  type ExamStatus, type ExamMode, type SecurityLevel,
  type QuestionType
} from './constants';

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
    // Likert specific
    likertTrait?: string;  // ✅ Likert - trait this question maps to
    likertDirection?: 'positive' | 'reverse';  // ✅ Likert - scoring direction
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

interface Student {
  // User fields (matching unified User interface)
  userId: string;
  fullName: string;
  studentRoll: string;
  email: string;
  phone?: string;
  
  // Attendance-specific fields
  isPresent: boolean;
  markedAt?: string;
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
  collegeId?: string;  // ADD THIS: College ID from exams table
  createdAt: string;
  createdBy: string;
  createdById: string;
  createdByRole: string;
}

interface AttendanceProps {
  exam: Exam;
  brandTheme: any;
  currentUser: UserModel;
  isExamOver?: boolean;
  onBack: () => void;
}

export default function Attendance({ exam, brandTheme, currentUser, isExamOver = false, onBack }: AttendanceProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  const [examEndTime, setExamEndTime] = useState<Date | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageDocuments, setPageDocuments] = useState<Map<number, any>>(new Map());
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  
  // Attendance tracking across all pages
  const [totalPresentStudents, setTotalPresentStudents] = useState(0);
  const [totalAbsentStudents, setTotalAbsentStudents] = useState(0);
  
  const PAGE_SIZE = 8; // Students per page
  const hasLoggedView = useRef(false); // Track if we've logged this view
  const attendanceCache = useRef<Map<string, { status: string; markedAt: any }> | null>(null);

  // Calculate exam start and end times
  useEffect(() => {
    if (exam.examTime) {
      const [hours, minutes] = exam.examTime.split(':').map(Number);
      const start = new Date(exam.examDate);
      start.setHours(hours, minutes, 0, 0);
      setExamStartTime(start);
      
      const durationMinutes = parseInt(exam.duration);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      setExamEndTime(end);
    }
    
    // Log view activity (non-blocking) - ONLY ONCE
    if (!hasLoggedView.current) {
      hasLoggedView.current = true; // Mark as logged
      (async () => {
        try {
          await firebaseService.addActivityLog({
            userId: currentUser.userId,
            collegeId: exam.collegeId || currentUser.collegeId,
            action: 'view_attendance',
            entityType: 'exam',
            entityId: exam.id,
            details: JSON.stringify({
              examTitle: exam.title,
              examClass: exam.class,
              examSubject: exam.subject,
              examDate: exam.examDate,
              isExamOver: isExamOver
            })
          });
        } catch (logError) {
          console.warn('⚠️ Failed to log attendance view:', logError);
        }
      })();
    }
  }, [exam.examDate, exam.examTime, exam.duration]);

  // Update current time every second for live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load student data when exam changes or page changes
  useEffect(() => {
    loadPage(1);
  }, [exam.id]);

  // Function to get total student count
  const getTotalStudentCount = async () => {
    try {
      // This should fetch all matching students to get count
      // We'll use a large limit just to count
      const { students: allStudents } = await firebaseService.getStudentsByExamPaginated(
        exam.id, 
        1000, // Large number to get all
        null
      );
      return allStudents.length;
    } catch (error) {
      console.error('Error getting total count:', error);
      return 0;
    }
  };

 // Function to load a specific page
const loadPage = async (pageNumber: number) => {
  try {
    // Only show full loading spinner on initial load (page 1 from scratch)
    if (pageNumber === 1 && students.length === 0) {
      setIsLoading(true);
    }
    
    console.log(`📚 Loading page ${pageNumber} (${PAGE_SIZE} students per page)`);
    
    // Get the last document for the previous page
    const lastDoc = pageNumber === 1 ? null : pageDocuments.get(pageNumber - 1);
    
    // Get students for this page
    const { students: studentsData, lastDoc: newLastDoc, hasMore } = 
      await firebaseService.getStudentsByExamPaginated(exam.id, PAGE_SIZE, lastDoc);
    
    console.log(`✅ Found ${studentsData.length} students for page ${pageNumber}`);
    
    // Fetch attendance only once and cache it
    if (!attendanceCache.current) {
      console.log('📥 Fetching attendance records (first time)...');
      const attendanceData = await firebaseService.getExamAttendance(exam.id);
      
      attendanceCache.current = new Map(
        attendanceData.map(record => [
          record.userId,
          { status: record.status, markedAt: record.markedAt }
        ])
      );
      console.log(`📝 Cached ${attendanceCache.current.size} attendance records`);
      
      // Calculate totals once
      const presentCount = attendanceData.filter(record => record.status === 'present').length;
      
      let totalCount = totalStudents;
      if (pageNumber === 1 && totalStudents === 0) {
        totalCount = await getTotalStudentCount();
        setTotalStudents(totalCount);
        setTotalPages(Math.ceil(totalCount / PAGE_SIZE));
      }
      
      setTotalPresentStudents(presentCount);
      setTotalAbsentStudents(Math.max(0, totalCount - presentCount));
    }
    
    // Use cached attendance map
    const attendanceMap = attendanceCache.current;

    // Merge attendance status with student data
    const studentsWithAttendance: Student[] = studentsData.map(student => {
      const attendanceRecord = attendanceMap.get(student.userId);
      
      return {
        userId: student.userId,
        fullName: student.fullName,
        studentRoll: student.studentRoll || 'N/A',
        email: student.email || '',  // ✅ Add fallback (though should never be empty)
        phone: student.phone,
        isPresent: attendanceRecord?.status === 'present',
        markedAt: attendanceRecord?.markedAt 
          ? new Date(attendanceRecord.markedAt).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            })
          : undefined
      };
  });
    
    // Sort present students first, then alphabetically by name
    studentsWithAttendance.sort((a, b) => {
      if (a.isPresent === b.isPresent) return (a.fullName || '').localeCompare(b.fullName || '');
      return a.isPresent ? -1 : 1;
    });

    setStudents(studentsWithAttendance);
    setHasNextPage(hasMore);
    
    // Store the last document for this page
    if (newLastDoc) {
      const newPageDocs = new Map(pageDocuments);
      newPageDocs.set(pageNumber, newLastDoc);
      setPageDocuments(newPageDocs);
    }
    
    setCurrentPage(pageNumber);
    setIsLoading(false);
    
    console.log(`✅ Page ${pageNumber} loaded. HasNext: ${hasMore}`);
    
  } catch (error) {
    console.error('❌ Error loading page:', error);
    setIsLoading(false);
    alert('Failed to load students. Please refresh the page.');
  }
};

  // Navigate to next page
  const goToNextPage = async () => {
    if (hasNextPage && !isPaginating) {
      setIsPaginating(true);
      await loadPage(currentPage + 1);
      setIsPaginating(false);
    }
  };

  // Navigate to previous page
  const goToPreviousPage = async () => {
    if (currentPage > 1 && !isPaginating) {
      setIsPaginating(true);
      await loadPage(currentPage - 1);
      setIsPaginating(false);
    }
  };

  // Toggle attendance status
  const toggleAttendance = async (studentUserId: string) => {
  try {
    const student = students.find(s => s.userId === studentUserId);
    if (!student) return;
    
    console.log(`📝 Toggling attendance for student: ${student.fullName}`);
    
    // ✅ CRITICAL: Ensure exam has collegeId before proceeding
    if (!exam.collegeId) {
      console.error('❌ ERROR: Exam does not have collegeId. Cannot mark attendance.');
      alert('Error: This exam is missing college information. Please contact administrator.');
      return;
    }
    
    const newStatus = !student.isPresent;
    
    // ✅ FIX: Create a modified user object with exam's collegeId ONLY
    // This ensures attendance records get the correct collegeId from the exam table
    const userWithExamCollege = {
      ...currentUser,
      collegeId: exam.collegeId  // Use ONLY exam's collegeId
    };
    
    if (newStatus) {
      // Mark as present - use exam's collegeId
      await firebaseService.markAttendance(exam.id, studentUserId, ATTENDANCE_STATUS.PRESENT, userWithExamCollege);
      console.log(`✅ Marked ${student.fullName} as present with collegeId: ${exam.collegeId}`);
      // Update total counts
      setTotalPresentStudents(prev => prev + 1);
      setTotalAbsentStudents(prev => prev - 1);
    } else {
      // Mark as absent (remove attendance record) - use exam's collegeId
      await firebaseService.markAttendance(exam.id, studentUserId, ATTENDANCE_STATUS.ABSENT, userWithExamCollege);
      console.log(`✅ Marked ${student.fullName} as absent with collegeId: ${exam.collegeId}`);
      // Update total counts
      setTotalPresentStudents(prev => prev - 1);
      setTotalAbsentStudents(prev => prev + 1);
    }
    
    // Update local state
    setStudents(students.map(s => {
      if (s.userId === studentUserId) {
        return {
          ...s,
          isPresent: newStatus,
          markedAt: newStatus ? new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }) : undefined
        };
      }
      return s;
    }));

    // Update attendance cache
    if (attendanceCache.current) {
      if (newStatus) {
        attendanceCache.current.set(studentUserId, { status: 'present', markedAt: new Date() });
      } else {
        attendanceCache.current.set(studentUserId, { status: 'absent', markedAt: new Date() });
      }
    }
  } catch (error) {
    console.error('Error toggling attendance:', error);
  }
};

  // Calculate time-related stats
  const getTimeStats = () => {
    if (!examStartTime || !examEndTime) return null;
    
    const now = currentTime;
    const isStarted = now >= examStartTime;
    const isEnded = now >= examEndTime;
    const isInProgress = isStarted && !isEnded;
    
    // Calculate elapsed time
    const elapsedMs = isStarted ? Math.max(0, now.getTime() - examStartTime.getTime()) : 0;
    const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    const elapsedMins = elapsedMinutes % 60;
    
    // Calculate remaining time
    const totalDuration = parseInt(exam.duration);
    const remainingMinutes = isStarted ? Math.max(0, totalDuration - elapsedMinutes) : totalDuration;
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = remainingMinutes % 60;
    
    // Progress percentage
    const progressPercent = isStarted ? Math.min(100, (elapsedMinutes / totalDuration) * 100) : 0;
    
    return {
      isStarted,
      isEnded,
      isInProgress,
      elapsedDisplay: `${elapsedHours}h ${elapsedMins}m`,
      remainingDisplay: `${remainingHours}h ${remainingMins}m`,
      progressPercent,
      statusText: isEnded ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'
    };
  };

  const timeStats = getTimeStats();

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Panel - Exam Details and Stats */}
      <div className="w-[45%] border-r border-gray-200 bg-white overflow-y-auto hide-scrollbar" 
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="p-8 space-y-8">
          {/* Exam Header Card */}
          <div 
            className="p-6 rounded-2xl text-white shadow-xl"
            style={{ background: brandTheme.gradients.primary }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span 
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                    style={{ 
                      backgroundColor: exam.type.toUpperCase() === 'HOME WORK' ? '#FCD34D' : exam.typeColor,
                      color: exam.type.toUpperCase() === 'HOME WORK' ? '#92400E' : 'white'
                    }}
                  >
                    {exam.type}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
                    {exam.board}
                  </span>
                  {timeStats && timeStats.isInProgress && (
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${exam.mode === EXAM_MODES.OFFLINE ? 'bg-orange-500 border-orange-400' : 'bg-green-500 border-green-400'} border`}>
                      <div className="relative flex items-center">
                        <span className="flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                      </div>
                      <span className="text-xs font-bold text-white uppercase">{exam.mode === EXAM_MODES.OFFLINE ? 'Offline' : 'Live'}</span>
                    </div>
                  )}
                </div>
                <h1 className="text-xl font-bold mb-2">{exam.title}</h1>
                <div className="flex items-center space-x-4 text-xs">
                  {exam.subject && (
                    <div className="flex items-center space-x-1">
                      <FontAwesomeIcon icon={faClipboardList} />
                      <span>{exam.subject}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>{exam.maxMarks} Marks</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FontAwesomeIcon icon={faClipboardList} />
                    <span>{exam.totalQuestions} Questions</span>
                  </div>
                  <div className="flex items-center space-x-1 opacity-75 text-xs">
                    <span>Exam ID: {exam.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Exam Details - Date and Duration */}
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex items-center space-x-6 text-xs whitespace-nowrap">
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faCalendar} className="text-gray-600" />
                <span className="text-gray-600 font-medium">Date & Time:</span>
                <span className="font-bold text-gray-900">
                  {new Date(exam.examDate).toLocaleDateString('en-GB', { 
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }).replace(/ /g, '-')}
                  {exam.examTime && ` ${exam.examTime.split(':').map((part, i) => {
                    if (i === 0) {
                      const hour = parseInt(part);
                      return hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                    }
                    return part;
                  }).join(':')} ${parseInt(exam.examTime.split(':')[0]) >= 12 ? 'PM' : 'AM'} IST`}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faClock} className="text-gray-600" />
                <span className="text-gray-600 font-medium">Duration:</span>
                <span className="font-bold text-gray-900">{exam.duration} min</span>
              </div>
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faGraduationCap} className="text-gray-600" />
                <span className="text-gray-600 font-medium">Class:</span>
                <span className="font-bold text-gray-900">{exam.class}</span>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="space-y-8">
            {/* Status and Timer */}
            <div className="flex items-center justify-between gap-6">
              {/* Exam Status */}
              <div className="flex-1 p-5 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 border border-purple-300">
                <div className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faClock} className="text-purple-600" />
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Exam Status</p>
                    <p className="text-lg font-bold text-purple-800">
                      {timeStats?.statusText || 'Scheduled'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Timer */}
              {timeStats && timeStats.isInProgress && (
                <div className="flex-1 p-5 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-300">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon icon={faChartLine} className="text-blue-600" />
                    <div>
                      <p className="text-xs font-semibold text-blue-700 mb-1">Time Remaining</p>
                      <p className="text-lg font-bold text-blue-800">{timeStats.remainingDisplay}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Time Since Start (if exam started but not in progress view) */}
              {timeStats && timeStats.isStarted && !timeStats.isInProgress && (
                <div className="flex-1 p-5 rounded-xl bg-gradient-to-br from-gray-100 to-slate-100 border border-gray-300">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon icon={faClock} className="text-gray-600" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {timeStats.isEnded ? 'Exam Completed' : 'Time Elapsed'}
                      </p>
                      <p className="text-lg font-bold text-gray-800">{timeStats.elapsedDisplay}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {timeStats.isStarted ? 'Since exam started' : 'Exam not started'}
                  </p>
                </div>
              )}
            </div>

            {/* Attendance Rate and Total Students */}
            <div className="flex items-center justify-center gap-8 mt-8">
              {/* Attendance Rate Circle */}
              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 border border-green-300 flex flex-col items-center justify-center">
                  <FontAwesomeIcon icon={faCircleCheck} className="text-green-600 mb-2" />
                  <p className="text-xs font-semibold text-green-700 mb-1">Attendance</p>
                  <p className="text-2xl font-bold text-green-800">
                    {totalStudents > 0 ? Math.round((totalPresentStudents / totalStudents) * 100) : 0}%
                  </p>
                </div>
                <p className="text-xs text-gray-600 mt-4 text-center">Present students</p>
              </div>

              {/* Total Students Circle */}
              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-300 flex flex-col items-center justify-center">
                  <FontAwesomeIcon icon={faUsers} className="text-orange-600 mb-2" />
                  <p className="text-xs font-semibold text-orange-700 mb-1">Total Students</p>
                  <p className="text-2xl font-bold text-orange-800">{totalStudents || students.length}</p>
                </div>
                <p className="text-xs text-gray-600 mt-4 text-center">Enrolled students</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {timeStats && timeStats.isStarted && (
            <div className="p-6 rounded-xl bg-white border border-gray-200 mt-12">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Exam Progress</p>
                <p className="text-sm font-bold" style={{ color: brandTheme.colors.primary }}>
                  {Math.round(timeStats.progressPercent)}%
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${timeStats.progressPercent}%`,
                    backgroundColor: brandTheme.colors.primary
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {timeStats.elapsedDisplay} elapsed • {timeStats.remainingDisplay} remaining
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Student List for Attendance */}
      <div className="w-[55%] h-full flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          {/* Header Row with Title and Close button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Exam Attendance</h3>
              <div className="flex items-center space-x-2 mt-1">
                <FontAwesomeIcon icon={faChartLine} className="text-gray-600" />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-green-600">{totalPresentStudents} present</span>
                  {' • '}
                  <span className="font-semibold text-red-600">{totalAbsentStudents} absent</span>
                  {' • '}
                  <span className="font-semibold">{totalStudents || students.length} total</span>
                </span>
              </div>
            </div>
            
            {/* Close button */}
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close Attendance"
            >
              <FontAwesomeIcon icon={faXmark} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Students Grid */}
        <div 
          className="flex-1 overflow-y-auto px-6 py-6 hide-scrollbar" 
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: brandTheme.colors.primary }}></div>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <FontAwesomeIcon icon={faUsers} className="text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg font-medium">No students enrolled</p>
              <p className="text-gray-400 text-sm">Students will appear here once enrolled</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {students.map((student) => (
                <button
                  key={student.userId}
                  onClick={() => !isExamOver && toggleAttendance(student.userId)}
                  disabled={isPaginating || isExamOver}
                  className={`p-4 rounded-xl border transition-all text-left ${
                    student.isPresent 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${isPaginating || isExamOver ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
                >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div 
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            student.isPresent ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        >
                          {student.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">{student.fullName}</p>
                          <p className="text-xs text-gray-600">Roll: {student.studentRoll}</p>
                        </div>
                      </div>
                      
                      {student.isPresent ? (
                        <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"></div>
                      )}
                    </div>

                    {student.phone && (
                      <div className="flex items-center space-x-2 text-xs text-gray-600 mb-2">
                        <FontAwesomeIcon icon={faPhone} />
                        <span>{student.phone}</span>
                      </div>
                    )}

                    {student.isPresent && student.markedAt && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-green-200">
                        <span className="text-xs text-green-700 font-semibold">Marked Present</span>
                        <span className="text-xs text-green-600">{student.markedAt}</span>
                      </div>
                    )}

                    {!student.isPresent && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs text-gray-500">
                          {isExamOver ? 'Attendance locked - exam ended' : 'Click to mark present'}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
          )}
        </div>

        {/* Pagination Controls */}
        {!isLoading && students.length > 0 && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Page Info */}
              <div className="text-sm text-gray-600">
                {isPaginating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: brandTheme.colors.primary }}></div>
                    <span>Loading page...</span>
                  </div>
                ) : (
                  <>
                    Showing <span className="font-semibold text-gray-900">{((currentPage - 1) * PAGE_SIZE) + 1}</span> to{' '}
                    <span className="font-semibold text-gray-900">
                      {Math.min(currentPage * PAGE_SIZE, totalStudents || students.length)}
                    </span> of{' '}
                    <span className="font-semibold text-gray-900">{totalStudents || students.length}</span> students
                  </>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center space-x-2">
                {/* Previous Button */}
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1 || isPaginating}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed border"
                  style={{
                    borderColor: currentPage === 1 || isPaginating ? '#E5E7EB' : brandTheme.colors.primary,
                    color: currentPage === 1 || isPaginating ? '#9CA3AF' : brandTheme.colors.primary,
                    backgroundColor: 'white'
                  }}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                  <span>Previous</span>
                </button>

                {/* Page Numbers */}
                <div className="flex items-center space-x-2 px-4">
                  <span className="text-sm font-medium text-gray-700">
                    Page <span className="font-bold" style={{ color: brandTheme.colors.primary }}>{currentPage}</span>
                    {totalPages > 1 && <span className="text-gray-500"> of {totalPages}</span>}
                  </span>
                </div>

                {/* Next Button */}
                <button
                  onClick={goToNextPage}
                  disabled={!hasNextPage || isPaginating}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: !hasNextPage || isPaginating ? '#9CA3AF' : brandTheme.gradients.primary,
                    boxShadow: !hasNextPage || isPaginating ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <span>Next</span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}