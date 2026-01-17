import { useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faClipboardList,
  faCalendar,
  faUsers,
  faGraduationCap,
  faChevronLeft,
  faChevronRight,
  faUserCheck,
  faClock,
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faArrowTrendUp,
  faChartLine,
  faXmark,
  faWifi,
  faWifiSlash,
  faEye,
  faArrowsRotate,
  faChevronDown,
  faExpand,
  faClipboard,
  faThumbTack,
  faScissors,
  faComputer,
  faCamera,
  faWrench,
  faLaptopCode,
  faCopy,
  faTowerBroadcast,
  faClockRotateLeft,
  faKeyboard,
  faRightLeft,
  faMagnifyingGlass,
  faPrint,
  faFloppyDisk,
  faScrewdriverWrench,
  faRightFromBracket,
  faRightToBracket,
  faHourglassHalf,
  faHashtag,
  faPlay,
  faImage
} from '@fortawesome/sharp-light-svg-icons';

import { firebaseService } from './services/firebase_service';
import { type QuestionType } from './constants';
import {
  MONTH_NAMES_SHORT,
  STUDENT_STATUS,
  type StudentStatus,
  VIOLATION_DESCRIPTIONS,
  type ViolationType,
  SEVERITY_BADGE_CLASSES,
  SEVERITY_TEXT_CLASSES,
  SEVERITY_LEVELS,
  type SeverityLevel,
  STUDENT_STATUS_COLORS,
} from './constants';

interface Violation {
  type: string;
  timestamp: Date;
  details?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  questionNo?: number;
  questionId?: string;
  proofUrl?: string;
}

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
    testCases?: Array<{ input: string; expected_output: string; marks?: number }>;
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
  
  // LiveStats-specific fields
  isPresent: boolean;
  markedAt?: string;
  questionsSubmitted?: number;
  lastActivity?: string;
  violations?: Violation[];
  activities?: any[];
  progress?: number;
  status?: 'active' | 'idle' | 'submitted' | 'absent' | 'expired' | 'not_started';
  entryTime?: Date;
  exitTime?: Date;
  ipAddress?: string;
  initialIP?: string;
  hasMultipleIPs?: boolean;
  totalDuration?: number;
  activityLogId?: string;
  
  // Connectivity tracking
  totalDisconnections?: number;
  totalInternetUnavailableDuration?: number; // in seconds
  connectivityHistory?: any[];
  lastDisconnectionTime?: Date | null; // ✅ NEW: Time of most recent disconnection
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
  status: string;
  mode: string;
  securityLevel?: string;
  attendance?: boolean;
  examDate: string;
  examTime?: string;
  duration: string;
  completionPolicy?: 'strict' | 'flexible';  // ✅ ADDED: Completion policy for exam timing
  totalQuestions: number;
  maxMarks: string;
  totalStudents?: number;
  questionPaperImages?: string[];
  questionsList?: Question[];
  collegeId?: string;  // ADD THIS LINE
  createdAt: string;
  createdBy: string;
  createdById: string;
  createdByRole: string;
}

interface LiveStatsProps {
  exam: Exam;
  brandTheme: any;
  onBack: () => void;
  userCollegeId: string;
}

export default function LiveStats({ exam, brandTheme, onBack, userCollegeId }: LiveStatsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  const [examEndTime, setExamEndTime] = useState<Date | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState(true);
  const hasAutoSubmittedRef = useRef<boolean>(false); // ✅ Use ref for immediate updates
  const [autoSubmitStatus, setAutoSubmitStatus] = useState<string | null>(null); // ✅ Status message

  // ✅ NEW: Connectivity data state
  const [connectivityData, setConnectivityData] = useState<Map<string, { disconnections: number, duration: number, history: any[], lastDisconnectionTime: Date | null }>>(new Map());
  const [lastConnectivityFetch, setLastConnectivityFetch] = useState<Date | null>(null);
  const CONNECTIVITY_REFRESH_INTERVAL = 60000; // 60 seconds
  
  // Modal states
  const [selectedStudentForViolations, setSelectedStudentForViolations] = useState<Student | null>(null);
  const [selectedStudentForActivities, setSelectedStudentForActivities] = useState<Student | null>(null);
  const [violationsCurrentPage, setViolationsCurrentPage] = useState(1);
  const [activitiesCurrentPage, setActivitiesCurrentPage] = useState(1);
  const [evidenceModal, setEvidenceModal] = useState<{ url: string; type: 'video' | 'image' } | null>(null);
  const hasLoggedView = useRef(false); // Track if we've logged this view
  
  // Override refresh interval to 60 seconds
  const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds
  const GRACE_PERIOD_MINUTES = 5; // ✅ Continue monitoring for 5 minutes after exam ends
  const VIOLATIONS_PER_PAGE = 25;

  // Helper function to format date in IST timezone
  const formatISTTime = (date: Date, options: { timeOnly?: boolean; dateOnly?: boolean } = {}): string => {
    if (isNaN(date.getTime())) {
      console.error('❌ Invalid date:', date);
      return 'Invalid Date';
    }
    
    // Use toLocaleString with IST timezone
    if (options.timeOnly) {
      return date.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    if (options.dateOnly) {
      return date.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
    
    return date.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // ✅ NEW: Network quality assessment
  const getNetworkQuality = (student: Student): {
    icon: string;
    color: string;
    label: string;
  } => {
    const disconnections = student.totalDisconnections || 0;
    
    // Updated thresholds based on disconnection count
    if (disconnections === 0) {
      return { icon: '🟢', color: 'text-green-700', label: 'Excellent' };
    }
    
    if (disconnections <= 2) {
      return { icon: '🟢', color: 'text-green-700', label: 'Excellent' };
    }
    
    if (disconnections <= 5) {
      return { icon: '🔵', color: 'text-blue-700', label: 'Good' };
    }
    
    if (disconnections <= 8) {
      return { icon: '🟡', color: 'text-amber-700', label: 'Fair' };
    }
    
    return { icon: '🔴', color: 'text-red-700', label: 'Poor' };
  };

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
          const { firebaseService } = await import('./services/firebase_service');
          const currentUser = await firebaseService.getCurrentUserProfile();
          if (currentUser && exam) {
            await firebaseService.addActivityLog({
              userId: currentUser.userId,
              collegeId: exam.collegeId || userCollegeId,
              action: 'view_live_stats',
              entityType: 'exam',
              entityId: exam.id,
              details: JSON.stringify({
                examTitle: exam.title,
                examClass: exam.class,
                examSubject: exam.subject,
                examDate: exam.examDate,
                examStatus: exam.status
              })
            });
          }
        } catch (logError) {
          console.warn('⚠️ Failed to log live stats view:', logError);
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

  // Calculate time statistics
  const getTimeStats = () => {
    if (!examStartTime || !examEndTime) return null;
    
    const now = currentTime;
    const totalDuration = examEndTime.getTime() - examStartTime.getTime();
    const elapsed = now.getTime() - examStartTime.getTime();
    const remaining = examEndTime.getTime() - now.getTime();
    
    const elapsedMinutes = Math.max(0, Math.floor(elapsed / 60000));
    const remainingMinutes = Math.max(0, Math.floor(remaining / 60000));
    const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    
    return {
      elapsedMinutes,
      remainingMinutes,
      elapsedDisplay: `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`,
      remainingDisplay: `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`,
      progressPercent,
      isStarted: now >= examStartTime,
      isEnded: now >= examEndTime
    };
  };

  const timeStats = getTimeStats();
  
  // Calculate exam status based on start time and duration
  const getExamStatus = () => {
    if (!examStartTime || !examEndTime) {
      return { status: 'scheduled', label: 'SCHEDULED', color: 'gray' };
    }
    
    const now = currentTime;
    
    if (now < examStartTime) {
      return { status: 'scheduled', label: 'SCHEDULED', color: 'blue' };
    } else if (now >= examStartTime && now < examEndTime) {
      return { status: 'live', label: 'LIVE', color: 'green' };
    } else {
      return { status: 'ended', label: 'ENDED', color: 'red' };
    }
  };
  
  const examStatus = getExamStatus();
  
  const formatExamDate = (dateString: string): string => {
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
  };

  // Helper function to format time
  const formatExamTime = (timeString: string): string => {
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
  };

  // ==================== AUTO-SUBMIT EXPIRED ATTEMPTS ====================
  /**
   * Auto-submit all in_progress attempts when exam time expires
   * This runs as part of the LiveStats auto-refresh cycle
   */
  const autoSubmitExpiredAttempts = async () => {
    // ✅ CRITICAL: Check if already processing/completed
    if (hasAutoSubmittedRef.current) {
      console.log('⏭️ Auto-submit already triggered, skipping...');
      return;
    }
    
    if (!examEndTime) return;
    
    const now = new Date();
    
    // Check if exam has expired
    if (now <= examEndTime) {
      console.log('⏰ Exam still in progress, no auto-submit needed');
      return;
    }
    
    // ✅ Set flag IMMEDIATELY to prevent concurrent runs
    hasAutoSubmittedRef.current = true;
    
    console.log('⏰ Exam time expired - checking for active attempts to auto-submit...');
    
    try {
      setAutoSubmitStatus('Checking for active attempts...');
      
      // Get all attempts for this exam
      const attempts = await firebaseService.getExamAttempts(exam.id);
      
      // Filter only in_progress attempts
      const activeAttempts = attempts.filter(
        (attempt: any) => attempt.status === 'in_progress'
      );
      
      if (activeAttempts.length === 0) {
        console.log('✅ No active attempts found - all students already submitted');
        setAutoSubmitStatus('All students submitted');
        setTimeout(() => setAutoSubmitStatus(null), 3000);
        return;
      }
      
      console.log(`📤 Auto-submitting ${activeAttempts.length} active attempt(s)...`);
      setAutoSubmitStatus(`Auto-submitting ${activeAttempts.length} attempt(s)...`);
      
      // Auto-submit each active attempt
      let successCount = 0;
      let errorCount = 0;
      
      for (const attempt of activeAttempts) {
        try {
          console.log(`  → Auto-submitting attempt ${attempt.attemptId} for student ${attempt.studentId}`);
          
          // Use Firebase service to submit the exam with autoSubmit flag
          await firebaseService.submitExam(attempt.attemptId, true); // true = autoSubmit
          
          successCount++;
          console.log(`  ✅ Successfully auto-submitted attempt ${attempt.attemptId}`);
        } catch (error) {
          console.error(`  ❌ Failed to auto-submit attempt ${attempt.attemptId}:`, error);
          errorCount++;
        }
      }
      
      // Update status message
      const message = `Auto-submitted ${successCount} attempt(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`;
      console.log(`✅ ${message}`);
      setAutoSubmitStatus(message);
      
      // Clear status after 5 seconds
      setTimeout(() => setAutoSubmitStatus(null), 5000);
      
      // Reload student data to show updated statuses
      await loadStudentData();
      
    } catch (error) {
      console.error('❌ Error during auto-submit:', error);
      setAutoSubmitStatus('Auto-submit failed');
      setTimeout(() => setAutoSubmitStatus(null), 3000);
      
      // ✅ Reset flag after delay to allow retry on next refresh (30 seconds)
      setTimeout(() => {
        console.log('🔄 Resetting auto-submit flag to allow retry...');
        hasAutoSubmittedRef.current = false;
      }, 30000); // 30 second delay before retry
    }
  };

  // ✅ NEW: Function to fetch connectivity data for ALL students in the exam
  const fetchConnectivityData = async () => {
    try {
      const now = new Date();
      
      // Skip if we fetched recently (within CONNECTIVITY_REFRESH_INTERVAL)
      if (lastConnectivityFetch) {
        const timeSinceLastFetch = now.getTime() - lastConnectivityFetch.getTime();
        if (timeSinceLastFetch < CONNECTIVITY_REFRESH_INTERVAL) {
          console.log(`⏭️ Skipping connectivity fetch - last fetched ${Math.round(timeSinceLastFetch / 1000)}s ago`);
          return;
        }
      }
      
      console.log('🔥🔥🔥 FETCHING CONNECTIVITY DATA 🔥🔥🔥');
      console.log('📡 Exam ID:', exam.id);
      
      // Get ALL connectivity records for this exam at once (more efficient than per-student)
      const allConnectivityRecords = await firebaseService.getAllExamConnectivityRecords(exam.id);
      console.log(`📡 Retrieved ${allConnectivityRecords.length} total connectivity records`);
      
      if (allConnectivityRecords.length > 0) {
        console.log('📡 Sample connectivity record:', allConnectivityRecords[0]);
      }
      
      // Group by userId
      const connectivityByUser = new Map<string, { disconnections: number, duration: number, history: any[], lastDisconnectionTime: Date | null }>();
      
      allConnectivityRecords.forEach((record: any, idx: number) => {
        console.log(`  Record ${idx + 1}: userId="${record.userId}", duration=${record.internetUnavailableDuration}s`);
        
        const userId = record.userId;
        const existing = connectivityByUser.get(userId) || { 
          disconnections: 0, 
          duration: 0, 
          history: [],
          lastDisconnectionTime: null // ✅ NEW
        };
        
        existing.disconnections++;
        existing.duration += record.internetUnavailableDuration || 0;
        existing.history.push(record);
        
        // ✅ NEW: Track most recent disconnection time
        const recordTime = record.timestamp?.toDate ? record.timestamp.toDate() : new Date(record.timestamp);
        if (!existing.lastDisconnectionTime || recordTime > existing.lastDisconnectionTime) {
          existing.lastDisconnectionTime = recordTime;
        }
        
        connectivityByUser.set(userId, existing);
      });
      
      console.log(`📡 Processed connectivity data for ${connectivityByUser.size} unique users`);
      console.log('📡 User IDs with connectivity data:', Array.from(connectivityByUser.keys()));
      
      // Log summary
      const studentsWithIssues = Array.from(connectivityByUser.entries())
        .filter(([_, data]) => data.disconnections > 0);
      
      if (studentsWithIssues.length > 0) {
        console.log(`📡 CONNECTIVITY SUMMARY:`, {
          totalUsers: connectivityByUser.size,
          usersWithIssues: studentsWithIssues.length,
          totalDisconnections: Array.from(connectivityByUser.values())
            .reduce((sum, data) => sum + data.disconnections, 0),
          totalDuration: Array.from(connectivityByUser.values())
            .reduce((sum, data) => sum + data.duration, 0)
        });
        studentsWithIssues.forEach(([userId, data]) => {
          console.log(`  📶 ${userId}: ${data.disconnections} disconnections, ${data.duration}s total`);
        });
      } else {
        console.log('⚠️ No connectivity issues found for any user');
      }
      
      // Update state
      console.log('📡 Updating connectivityData state...');
      setConnectivityData(connectivityByUser);
      setLastConnectivityFetch(now);
      console.log('✅ Connectivity data state updated!');
      
      // Return the fresh data so it can be used immediately
      return connectivityByUser;
      
    } catch (error) {
      console.error('❌ Error fetching connectivity data:', error);
      // Return empty map on error
      return new Map();
    }
  };

  // Function to load/refresh student data
   const loadStudentData = async (freshConnectivityData?: Map<string, { disconnections: number, duration: number, history: any[], lastDisconnectionTime: Date | null }>) => {
    try {
      setIsLoading(true);
      
      // Guard: Check if required fields exist
      const collegeId = exam.collegeId || userCollegeId;
      if (!collegeId) {
        console.error('❌ Cannot load student data: missing collegeId', exam);
        setIsLoading(false);
        return;
      }
      
      console.log('📚 Total students (from Exams table):', exam.totalStudents || 0);
      
      // STEP 1: Get attendance records from attendance table for this exam
      const attendanceRecords = await firebaseService.getExamAttendance(exam.id);
      console.log(`📝 Total attendance records:`, attendanceRecords.length);
      
      // Count present students (status = 'present')
      const presentAttendanceRecords = attendanceRecords.filter(record => record.status === 'present');
      console.log(`✅ Present students from attendance:`, presentAttendanceRecords.length);

      // STEP 2: Get exam attempts for present students
      const attempts = await firebaseService.getExamAttempts(exam.id);
      
      // 🔥 FIX: If there are multiple attempts per student, keep only the latest one
      const attemptsMap = new Map<string, any>();
      attempts.forEach(attempt => {
        const existingAttempt = attemptsMap.get(attempt.studentId);
        
        // If no existing attempt or this one is newer, use it
        if (!existingAttempt) {
          attemptsMap.set(attempt.studentId, attempt);
        } else {
          // Compare timestamps to get the latest attempt
          const existingStartTime = existingAttempt.startTime instanceof Date 
            ? existingAttempt.startTime 
            : new Date(existingAttempt.startTime);
          const currentStartTime = attempt.startTime instanceof Date 
            ? attempt.startTime 
            : new Date(attempt.startTime);
          
          // Keep the attempt with the most recent start time
          if (currentStartTime > existingStartTime) {
            console.log(`⚠️ Multiple attempts for ${attempt.studentId}, using latest (${attempt.attemptId})`);
            attemptsMap.set(attempt.studentId, attempt);
          }
        }
      });
      
      console.log(`✅ Exam attempts:`, attempts.length, '(unique students:', attemptsMap.size, ')');
      
      // STEP 4: Create student data array (connectivity data will be added separately)      // Debug: Log if there are duplicate attempts
      if (attempts.length > attemptsMap.size) {
        console.warn(`⚠️ Found ${attempts.length - attemptsMap.size} duplicate attempts!`);
      }
      
      // Debug: Log first attempt to see structure
      if (attempts.length > 0) {
        console.log('📊 Sample attempt structure:', {
          studentId: attempts[0].studentId,
          attemptedQuestions: attempts[0].attemptedQuestions,
          responsesCount: attempts[0].responses?.length || 0,
          timeSpent: attempts[0].timeSpent,
          duration: attempts[0].duration,
          activities: attempts[0].activities?.length || 0
        });
        
        // Log first response to see structure including violations
        if (attempts[0].responses && attempts[0].responses.length > 0) {
          console.log('📝 Sample response structure:', {
            questionId: attempts[0].responses[0].questionId,
            questionNo: attempts[0].responses[0].questionNo,
            isAnswered: attempts[0].responses[0].isAnswered,
            answeredAt: attempts[0].responses[0].answeredAt,
            violations: attempts[0].responses[0].violations?.length || 0
          });
        }
      }
      
      // STEP 3: Create student data array using attendance record data directly
      const studentsData: Student[] = presentAttendanceRecords.map(attendanceRecord => {
        const studentId = attendanceRecord.studentId || attendanceRecord.userId;
        const attempt = attemptsMap.get(studentId);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing: ${attendanceRecord.studentName} (${studentId})`);
        console.log(`Attempt ID: ${attempt?.attemptId || 'NO ATTEMPT'}`);
        console.log(`${'='.repeat(60)}`);
        
        // Extract entry/exit times from activities array (if attempt exists)
        const activities = attempt?.activities || [];
        
        console.log(`📋 Activities for ${attendanceRecord.studentName}:`, {
          activitiesCount: activities.length,
          activities: activities.map((a: any) => ({
            type: a.type,
            timestamp: a.timestamp?.toDate ? a.timestamp.toDate().toISOString() : a.timestamp,
            ipAddress: a.ipAddress
          }))
        });
        
        // Find first entry to get initial IP
        const entryActivities = activities.filter((a: any) => a.type === 'enter');
        const initialEntry = entryActivities[0];
        const initialIP = initialEntry?.ipAddress || '';
        
        // Check if there are multiple different IPs
        const uniqueIPs = new Set(
          entryActivities
            .map((a: any) => a.ipAddress)
            .filter((ip: string) => ip)
        );
        const hasMultipleIPs = uniqueIPs.size > 1;
        
        const entryActivity = activities.find((a: any) => a.type === 'enter');
        const exitActivity = [...activities].reverse().find((a: any) => a.type === 'exit');
        
        console.log(`🚪 Entry/Exit for ${attendanceRecord.studentName}:`, {
          hasEntryActivity: !!entryActivity,
          hasExitActivity: !!exitActivity,
          entryTimestamp: entryActivity?.timestamp,
          exitTimestamp: exitActivity?.timestamp
        });
        
        // Convert Firestore Timestamp to Date
        const entryTime = entryActivity?.timestamp 
          ? (entryActivity.timestamp?.toDate ? entryActivity.timestamp.toDate() : new Date(entryActivity.timestamp))
          : undefined;
        const exitTime = exitActivity?.timestamp 
          ? (exitActivity.timestamp?.toDate ? exitActivity.timestamp.toDate() : new Date(exitActivity.timestamp))
          : undefined;
        const ipAddress = initialIP;
        
        // ✅ Count questions that are actually answered
        // Check: isAnswered=true OR has studentAnswer (for compatibility)
        const questionsAnswered = attempt?.responses 
          ? attempt.responses.filter((r: any) => {
              // Primary check: isAnswered flag
              if (r.isAnswered === true) return true;
              
              // Fallback: has actual answer content
              if (r.studentAnswer) {
                if (typeof r.studentAnswer === 'string' && r.studentAnswer.trim().length > 0) return true;
                if (Array.isArray(r.studentAnswer) && r.studentAnswer.length > 0) return true;
              }
              
              return false;
            }).length
          : 0;
        
        console.log(`📝 Responses for ${attendanceRecord.studentName}:`, {
          totalResponses: attempt?.responses?.length || 0,
          answeredCount: questionsAnswered,
          sampleResponses: attempt?.responses?.slice(0, 3).map((r: any) => ({
            questionId: r.questionId,
            questionNo: r.questionNo,
            isAnswered: r.isAnswered,
            isSkipped: r.isSkipped,
            hasAnswer: !!r.studentAnswer,
            answerType: typeof r.studentAnswer,
            answerContent: Array.isArray(r.studentAnswer) ? `Array[${r.studentAnswer.length}]` : 
                          typeof r.studentAnswer === 'string' ? `String(${r.studentAnswer.length} chars)` : 
                          r.studentAnswer
          }))
        });
        
        // Calculate progress
        const progress = exam.totalQuestions > 0 
          ? Math.round((questionsAnswered / exam.totalQuestions) * 100) 
          : 0;
        
        // Determine status - map database status to UI status
        // Database: "in_progress" | "submitted" | "auto_submitted" | "expired"
        // UI: "active" | "submitted" | "expired" | "not_started"
        let status: StudentStatus = STUDENT_STATUS.ACTIVE;
        
        // ✅ CRITICAL FIX: Check if attempt exists first
        if (!attempt) {
          // Student marked attendance but never started exam - NO ATTEMPT
          status = 'not_started' as StudentStatus;
          console.log(`⚠️ ${attendanceRecord.studentName}: Marked present but no attempt created`);
        } else if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
          status = STUDENT_STATUS.SUBMITTED;
        } else if (attempt.status === 'expired' || attempt.status === 'timeout') {
          status = 'expired' as StudentStatus;
        } else if (attempt.status === 'in_progress') {
          // ✅ Check if exam time has expired for active attempts
          const examEndTime = new Date(exam.examDate);
          if (exam.examTime) {
            const [hours, minutes] = exam.examTime.split(':').map(Number);
            examEndTime.setHours(hours, minutes, 0, 0);
          }
          examEndTime.setMinutes(examEndTime.getMinutes() + parseInt(exam.duration));
          
          if (new Date() > examEndTime) {
            status = 'expired' as StudentStatus; // ✅ Show as expired if time passed
          } else {
            status = STUDENT_STATUS.ACTIVE;
          }
        } else {
          // Unknown status - treat as not started
          status = 'not_started' as StudentStatus;
        }
        
        // ✅ Collect violations from response level
        const allViolations: any[] = [];
        if (attempt?.responses && Array.isArray(attempt.responses)) {
          attempt.responses.forEach((response: any) => {
            if (response.violations && Array.isArray(response.violations)) {
              response.violations.forEach((violation: any) => {
                allViolations.push({
                  ...violation,
                  questionNo: response.questionNo,
                  questionId: response.questionId
                });
              });
            }
          });
        }
        
        console.log(`👤 ${attendanceRecord.studentName} (${studentId}):`, {
          responsesCount: attempt?.responses?.length || 0,
          answeredCount: questionsAnswered,
          attemptedQuestions: attempt?.attemptedQuestions,
          timeSpent: attempt?.timeSpent,
          violationsCount: allViolations.length,
          dbStatus: attempt?.status,
          uiStatus: status
        });
        
        // Format marked at time
        const markedAtFormatted = attendanceRecord?.markedAt
          ? (attendanceRecord.markedAt instanceof Date 
              ? attendanceRecord.markedAt 
              : new Date(attendanceRecord.markedAt)
            ).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            })
          : undefined;
        
        // Helper function to parse IST timestamp strings
        const parseISTTimestamp = (timestampStr: string): Date => {
          console.log(`🔍 Parsing IST string: "${timestampStr}"`);
          
          // Expected format: "YYYY-MM-DD HH:mm:ss IST"
          if (!timestampStr.includes(' IST')) {
            console.error('❌ Not IST format:', timestampStr);
            return new Date('INVALID');
          }
          
          // Remove " IST" and parse
          const dateTimeStr = timestampStr.replace(' IST', '').trim();
          const [datePart, timePart] = dateTimeStr.split(' ');
          const [year, month, day] = datePart.split('-').map(Number);
          const [hours, minutes, seconds] = timePart.split(':').map(Number);
          
          // Create Date in IST (subtract 5:30 to get UTC)
          const istOffset = 5.5 * 60 * 60 * 1000;
          const utcTime = Date.UTC(year, month - 1, day, hours, minutes, seconds) - istOffset;
          const date = new Date(utcTime);
          
          console.log(`✅ Parsed:`, {
            input: timestampStr,
            utc: date.toISOString(),
            ist: date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          });
          
          return date;
        };

        // Convert violations timestamps - ONLY handles IST strings now
        const violationsWithConvertedTimestamps = allViolations.map((violation: any, idx: number) => {
          console.log(`🔍 Violation ${idx + 1}:`, violation.type, violation.timestamp);
          
          let timestamp: Date;
          
          // Only expect string format now
          if (typeof violation.timestamp === 'string') {
            timestamp = parseISTTimestamp(violation.timestamp);
          } else {
            console.error(`❌ Unexpected timestamp format:`, typeof violation.timestamp, violation.timestamp);
            timestamp = new Date('INVALID');
          }
          
          // ❌ DON'T validate or use fallback - let invalid dates show as "Invalid Date" in UI
          // This helps us identify the real parsing issue
          
          // Normalize severity: map database values to UI values
          let severity = violation.severity;
          if (severity === 'moderate') {
            severity = 'high';
          } else if (severity === 'minor') {
            severity = 'low';
          }
          
          return {
            ...violation,
            timestamp,
            severity: severity || 'low'
          };
        });
        
        // Convert activities timestamps
        const activitiesWithConvertedTimestamps = (activities || []).map((activity: any, idx: number) => {
          let timestamp: Date;
          
          if (!activity.timestamp) {
            timestamp = new Date();
          } else if (typeof activity.timestamp === 'string') {
            // ISO string format - most common
            timestamp = new Date(activity.timestamp);
          } else if (activity.timestamp instanceof Date) {
            // Already a Date object
            timestamp = activity.timestamp;
          } else if (typeof activity.timestamp === 'object') {
            // Handle various object formats
            if (activity.timestamp.__time__) {
              timestamp = new Date(activity.timestamp.__time__);
            } else if (activity.timestamp.seconds !== undefined) {
              const ms = activity.timestamp.seconds * 1000 + (activity.timestamp.nanoseconds || 0) / 1000000;
              timestamp = new Date(ms);
            } else if (activity.timestamp?.toDate && typeof activity.timestamp.toDate === 'function') {
              timestamp = activity.timestamp.toDate();
            } else if (Object.keys(activity.timestamp).length === 0) {
              timestamp = new Date();
            } else {
              timestamp = new Date();
            }
          } else if (typeof activity.timestamp === 'number') {
            timestamp = new Date(activity.timestamp);
          } else {
            timestamp = new Date();
          }
          
          // Verify timestamp is valid
          if (isNaN(timestamp.getTime())) {
            console.error(`❌ Invalid activity timestamp at index ${idx}:`, activity.timestamp);
            timestamp = new Date();
          }
          
          return {
            ...activity,
            timestamp
          };
        });
        
        // Calculate duration from attempt.timeSpent or from activities
        let calculatedDuration = attempt?.timeSpent || 0;
        
        // If no timeSpent in attempt but we have entry/exit times, calculate from activities
        if (calculatedDuration === 0 && entryTime) {
          const endTimeForDuration = exitTime || new Date();
          calculatedDuration = Math.floor((endTimeForDuration.getTime() - entryTime.getTime()) / 1000); // in seconds
        }
        
        console.log(`⏱️ ${attendanceRecord.studentName} duration:`, {
          timeSpent: attempt?.timeSpent,
          calculated: calculatedDuration,
          entryTime: entryTime?.toLocaleTimeString(),
          exitTime: exitTime?.toLocaleTimeString()
        });
        
        console.log(`✅ FINAL DATA for ${attendanceRecord.studentName}:`, {
          questionsSubmitted: questionsAnswered,
          progress: progress,
          status: status,
          totalDuration: calculatedDuration,
          activitiesCount: activitiesWithConvertedTimestamps.length,
          violationsCount: violationsWithConvertedTimestamps.length,
          ipAddress: ipAddress,
          hasMultipleIPs: hasMultipleIPs
        });
        
        // Get connectivity data for this student from parameter or state
        const dataSource = freshConnectivityData || connectivityData;
        const studentConnectivity = dataSource.get(studentId) || { disconnections: 0, duration: 0, history: [], lastDisconnectionTime: null };
        
        // ✅ DEBUG: Log connectivity data lookup
        console.log(`👤 Student ${attendanceRecord.studentName}:`);
        console.log(`   studentId being used: "${studentId}"`);
        console.log(`   Using ${freshConnectivityData ? 'FRESH' : 'STATE'} connectivity data`);
        console.log(`   Data source size: ${dataSource.size}`);
        console.log(`   Connectivity lookup result:`, {
          disconnections: studentConnectivity.disconnections,
          duration: studentConnectivity.duration,
          historyCount: studentConnectivity.history.length,
          found: studentConnectivity.disconnections > 0
        });
        
        if (studentConnectivity.disconnections > 0) {
          console.log(`   ✅ HAS CONNECTIVITY DATA!`);
        } else {
          console.log(`   ⚠️ No connectivity data for this student`);
        }
        
        // ✅ USE DATA DIRECTLY FROM ATTENDANCE RECORD
        return {
          userId: studentId,
          fullName: attendanceRecord.studentName || 'Unknown',  // From attendance table
          studentRoll: attendanceRecord.studentRollNumber || 'N/A',  // From attendance table
          email: '',  // Not stored in attendance, leave empty
          isPresent: true,
          markedAt: markedAtFormatted,
          questionsSubmitted: questionsAnswered,
          lastActivity: exitTime
            ? exitTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            : entryTime
            ? entryTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            : 'No activity',
          violations: violationsWithConvertedTimestamps,
          activities: activitiesWithConvertedTimestamps,
          progress,
          status,
          entryTime,
          exitTime,
          ipAddress,
          initialIP,
          hasMultipleIPs,
          totalDuration: calculatedDuration,
          activityLogId: attempt?.attemptId,
          // Connectivity data
          totalDisconnections: studentConnectivity.disconnections,
          totalInternetUnavailableDuration: studentConnectivity.duration,
          connectivityHistory: studentConnectivity.history,
          lastDisconnectionTime: studentConnectivity.lastDisconnectionTime // ✅ NEW
        };
      });
      
      setStudents(studentsData);
      
      setIsLoading(false);
      setLastRefresh(new Date());
      
    } catch (error) {
      console.error('Failed to load exam activity data:', error);
      setIsLoading(false);
    }
  };
  // ==================== AUTO-REFRESH WITH AUTO-SUBMIT ====================
  // Initial load and auto-refresh setup
  useEffect(() => {
    // NOTE: Initial data loading is handled by connectivity useEffect below
    // which loads connectivity data FIRST, then student data
    setIsAutoRefreshActive(true);

    // Set up auto-refresh (60 seconds)
    const refreshInterval = setInterval(async () => {
      if (!examEndTime) return;
      
      const now = new Date();
      const gracePeriodEnd = new Date(examEndTime.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);
      
      // ✅ OPTIMIZATION 1: Stop auto-refresh after grace period ends
      if (now > gracePeriodEnd) {
        console.log(`⏹️ Grace period ended (${GRACE_PERIOD_MINUTES} min after exam). Stopping auto-refresh.`);
        setIsAutoRefreshActive(false);
        clearInterval(refreshInterval);
        return;
      }
      
      // ✅ AUTO-SUBMIT: If exam just ended and we haven't auto-submitted yet
      if (now > examEndTime && !hasAutoSubmittedRef.current) {
        console.log('⏰ Exam time expired - triggering auto-submit...');
        
        try {
          await autoSubmitExpiredAttempts();
        } catch (error) {
          console.error('❌ Auto-submit error in interval:', error);
          // autoSubmitExpiredAttempts handles its own retry logic
        }
      }
      
      // ✅ Continue refreshing during exam and grace period
      if (now <= gracePeriodEnd) {
        console.log('Auto-refreshing Live Stats data...');
        // Refresh connectivity data first, then student data with fresh data
        const freshConnectivityData = await fetchConnectivityData();
        await loadStudentData(freshConnectivityData);
      }
    }, AUTO_REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      console.log('Cleaning up auto-refresh interval');
      clearInterval(refreshInterval);
    };
  }, [exam.id, examEndTime]); // ✅ Removed hasAutoSubmitted - using ref instead

  // ✅ NEW: Connectivity data fetching effect
  useEffect(() => {
    const initializeData = async () => {
      // STEP 1: Fetch connectivity data FIRST and get the fresh data
      const freshConnectivityData = await fetchConnectivityData();
      
      // STEP 2: Then load student data with the fresh connectivity data
      await loadStudentData(freshConnectivityData);
    };
    
    // Initialize on mount
    initializeData();
    
    // Set up periodic refresh for connectivity data (every 60 seconds)
    const connectivityInterval = setInterval(async () => {
      console.log('🔄 Refreshing connectivity data...');
      const freshConnectivityData = await fetchConnectivityData();
      // Also refresh student data with the new connectivity info
      await loadStudentData(freshConnectivityData);
    }, CONNECTIVITY_REFRESH_INTERVAL);
    
    // Cleanup
    return () => {
      console.log('Cleaning up connectivity refresh interval');
      clearInterval(connectivityInterval);
    };
  }, [exam.id]); // Only re-run if exam changes


  const presentStudents = students.filter(s => s.isPresent);
  const totalStudentsCount = exam.totalStudents || students.length; // Use exam.totalStudents from Exams table
  const absentCount = totalStudentsCount - presentStudents.length; // Calculate absent count
  const submittedCount = presentStudents.filter(s => s.status === STUDENT_STATUS.SUBMITTED).length;
  const activeCount = presentStudents.filter(s => s.status === STUDENT_STATUS.ACTIVE).length;
  const expiredCount = presentStudents.filter(s => s.status === 'expired').length;
  const notStartedCount = presentStudents.filter(s => s.status === 'not_started').length; // ✅ Count students who never started
  const totalViolations = presentStudents.reduce((sum, s) => {
    return sum + (s.violations?.length || 0);
  }, 0);
  const avgProgress = presentStudents.length > 0 
    ? Math.round(presentStudents.reduce((sum, s) => sum + (s.progress || 0), 0) / presentStudents.length)
    : 0;

  // Get violation icon
 const getViolationIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'WINDOW_BLUR': faEye,
      'TAB_SWITCH': faArrowsRotate,
      'WINDOW_MINIMIZE': faChevronDown,
      'FULLSCREEN_EXIT': faExpand,
      'COPY_ATTEMPT': faClipboard,
      'PASTE_ATTEMPT': faThumbTack,
      'CUT_ATTEMPT': faScissors,
      'RIGHT_CLICK': faComputer,
      'PRINT_SCREEN': faCamera,
      'SCREENSHOT_ATTEMPT': faCamera,
      'DEVTOOLS_OPEN': faScrewdriverWrench,
      'CONSOLE_OPEN': faLaptopCode,
      'MULTIPLE_TABS': faCopy,
      'NETWORK_DISCONNECT': faTowerBroadcast,
      'TIME_MANIPULATION': faClockRotateLeft,
      'SHORTCUT_CTRLC': faKeyboard,
      'SHORTCUT_CTRLV': faKeyboard,
      'SHORTCUT_CTRLX': faKeyboard,
      'SHORTCUT_CTRLA': faKeyboard,
      'SHORTCUT_ALTTAB': faRightLeft,
      'SHORTCUT_CTRLSHIFTC': faMagnifyingGlass,
      'SHORTCUT_F12': faWrench,
      'SHORTCUT_CTRLP': faPrint,
      'SHORTCUT_CTRLS': faFloppyDisk,
      'SHORTCUT_DEVTOOLS': faScrewdriverWrench
    };
    return iconMap[type] || faTriangleExclamation;
  };

  const getViolationLabel = (type: string) => {
    return VIOLATION_DESCRIPTIONS[type as ViolationType] || type.replace(/_/g, ' ');
  };

  // Get status color
  const getStatusColor = (status?: string) => {
    if (status === 'expired') {
      return 'text-orange-700 bg-orange-100'; // ✅ Expired
    }
    if (status === 'not_started') {
      return 'text-gray-600 bg-gray-200'; // ✅ Not started (grey)
    }
    return STUDENT_STATUS_COLORS[status as StudentStatus] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="h-full flex bg-white">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Left Panel - Stats Section */}
      <div className="w-[45%] flex flex-col border-r border-gray-200">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="mb-4">
          <div className="flex items-center space-x-4">
            <FontAwesomeIcon icon={faClipboardList} className="text-gray-900 text-3xl" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-gray-900">{exam.title}</h2>
                {/* Dynamic Status Badge */}
                <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full ${
                  examStatus.color === 'green' 
                    ? 'bg-green-50 border border-green-200' 
                    : examStatus.color === 'blue'
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {examStatus.status === 'live' && (
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </div>
                  )}
                  <span className={`text-xs font-bold ${
                    examStatus.color === 'green' 
                      ? 'text-green-600' 
                      : examStatus.color === 'blue'
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }`}>
                    {examStatus.label}
                  </span>
                </div>
                {/* Network Status Indicator */}
                <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full ${
                  navigator.onLine 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {navigator.onLine ? (
                    <>
                      <FontAwesomeIcon icon={faWifi} className="text-blue-600 text-xs" />
                      <span className="text-xs font-bold text-blue-600">ONLINE</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faWifiSlash} className="text-red-600 text-xs" />
                      <span className="text-xs font-bold text-red-600">OFFLINE</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">Live Stats</p>
            </div>
          </div>
        </div>

        {/* Exam Info Summary */}
        <div 
          className="overflow-x-auto hide-scrollbar"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="flex items-center gap-6" style={{ minWidth: 'max-content' }}>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <FontAwesomeIcon icon={faCalendar} className="text-gray-500 text-lg" />
              <span className="text-xs text-gray-500">Date & Time:</span>
              <span className="text-sm font-semibold text-gray-900">{formatExamDate(exam.examDate)}</span>
              {exam.examTime && (
                <span className="text-xs text-gray-600">{formatExamTime(exam.examTime)}</span>
              )}
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <FontAwesomeIcon icon={faClock} className="text-gray-500 text-lg" />
              <span className="text-xs text-gray-500">Duration:</span>
              <span className="text-sm font-semibold text-gray-900">{exam.duration} min</span>
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <FontAwesomeIcon icon={faGraduationCap} className="text-gray-500 text-lg" />
              <span className="text-xs text-gray-500">Class:</span>
              <span className="text-sm font-semibold text-gray-900">{exam.class}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-6 hide-scrollbar">
        {/* Attendance Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div 
            className="p-4 rounded-xl border"
            style={{ 
              backgroundColor: `${brandTheme.colors.primary}08`,
              borderColor: brandTheme.colors.primary
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Present</p>
                <p className="text-3xl font-bold" style={{ color: brandTheme.colors.primary }}>
                  {presentStudents.length}
                </p>
              </div>
              <FontAwesomeIcon icon={faCircleCheck} style={{ color: brandTheme.colors.primary }} className="text-3xl" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {totalStudentsCount > 0 ? Math.round((presentStudents.length / totalStudentsCount) * 100) : 0}% attendance
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-red-200 bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Absent</p>
                <p className="text-3xl font-bold text-red-600">{absentCount}</p>
              </div>
              <FontAwesomeIcon icon={faCircleXmark} className="text-red-500 text-3xl" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {totalStudentsCount > 0 ? Math.round((absentCount / totalStudentsCount) * 100) : 0}% absent
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{totalStudentsCount}</p>
              </div>
              <FontAwesomeIcon icon={faUsers} className="text-gray-600 text-3xl" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Class {exam.class}
            </p>
          </div>
        </div>

        {/* Live Monitoring Stats - 4 Circles */}
        <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 mb-4">
          <div className="grid grid-cols-4 gap-4">
            {/* Time Left Circle */}
            {timeStats && (
              <div className="flex flex-col items-center">
                <div className={`relative w-32 h-32 rounded-full border flex flex-col items-center justify-center ${
                  timeStats.isEnded 
                    ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300'
                    : !timeStats.isStarted
                    ? 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-300'
                    : 'bg-gradient-to-br from-purple-100 to-indigo-100 border-purple-300'
                }`}>
                  <FontAwesomeIcon 
                    icon={faClock} 
                    className={`text-xl mb-1 ${
                      timeStats.isEnded 
                        ? 'text-gray-600'
                        : !timeStats.isStarted
                        ? 'text-blue-600'
                        : 'text-purple-600'
                    }`} 
                  />
                  <p className={`text-[10px] font-semibold mb-0.5 ${
                    timeStats.isEnded 
                      ? 'text-gray-700'
                      : !timeStats.isStarted
                      ? 'text-blue-700'
                      : 'text-purple-700'
                  }`}>
                    {timeStats.isEnded ? 'Ended' : !timeStats.isStarted ? 'Starts in' : 'Time Left'}
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {timeStats.isEnded 
                      ? 'Done' 
                      : !timeStats.isStarted 
                      ? (() => {
                          const minutesUntilStart = Math.floor(((examStartTime?.getTime() || 0) - currentTime.getTime()) / 60000);
                          const hours = Math.floor(minutesUntilStart / 60);
                          const minutes = minutesUntilStart % 60;
                          return `${hours}h ${minutes}m`;
                        })()
                      : timeStats.remainingDisplay
                    }
                  </p>
                </div>
                {timeStats.isStarted && !timeStats.isEnded && (
                  <p className="text-[10px] text-gray-600 mt-2">
                    {timeStats.elapsedDisplay} elapsed
                  </p>
                )}
                {!timeStats.isStarted && (
                  <p className="text-[10px] text-gray-600 mt-2">
                    Until exam starts
                  </p>
                )}
                {timeStats.isEnded && (
                  <p className="text-[10px] text-gray-600 mt-2">
                    Exam completed
                  </p>
                )}
              </div>
            )}

            {/* Submitted Circle */}
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 border border-green-300 flex flex-col items-center justify-center">
                <FontAwesomeIcon icon={faCircleCheck} className="text-green-600 text-xl mb-1" />
                <p className="text-[10px] font-semibold text-green-700 mb-0.5">Submitted</p>
                <p className="text-xl font-bold text-gray-900">
                  {submittedCount}/{presentStudents.length}
                </p>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                {presentStudents.length > 0 ? Math.round((submittedCount / presentStudents.length) * 100) : 0}% completed
              </p>
            </div>

            {/* Average Progress Circle */}
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-300 flex flex-col items-center justify-center">
                <FontAwesomeIcon icon={faArrowTrendUp} className="text-blue-600 text-xl mb-1" />
                <p className="text-[10px] font-semibold text-blue-700 mb-0.5">Avg Progress</p>
                <p className="text-xl font-bold text-gray-900">{avgProgress}%</p>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">Overall completion</p>
            </div>

            {/* Violations Circle */}
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-orange-100 to-red-100 border border-orange-300 flex flex-col items-center justify-center">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-orange-600 text-xl mb-1" />
                <p className="text-[10px] font-semibold text-orange-700 mb-0.5">Violations</p>
                <p className="text-xl font-bold text-gray-900">{totalViolations}</p>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                {presentStudents.filter(s => s.violations && s.violations.length > 0).length} students
              </p>
            </div>
          </div>
        </div>

        {/* Internet Connectivity Summary Box - ALWAYS SHOW */}
        {useMemo(() => {
          const usersWithDisconnections = presentStudents.filter(s => (s.totalDisconnections || 0) > 0).length;
          const affectedPercentage = presentStudents.length > 0 ? Math.round((usersWithDisconnections / presentStudents.length) * 100) : 0;
          
          // ✅ NEW: Smart disconnection counting - group by time window
          // If multiple students disconnect within 7 seconds, count as ONE incident
          const calculateSmartMetrics = (): { incidents: number, totalDuration: number } => {
            // Collect all disconnection records with timestamps and durations
            const allDisconnections: { 
              userId: string, 
              timestamp: Date,
              duration: number 
            }[] = [];
            
            presentStudents.forEach(student => {
              if (student.connectivityHistory && student.connectivityHistory.length > 0) {
                student.connectivityHistory.forEach((record: any) => {
                  const timestamp = record.disconnectionTimestamp?.toDate 
                    ? record.disconnectionTimestamp.toDate() 
                    : new Date(record.disconnectionTimestamp);
                  
                  allDisconnections.push({
                    userId: student.userId,
                    timestamp: timestamp,
                    duration: record.internetUnavailableDuration || 0
                  });
                });
              }
            });
            
            // Sort by timestamp
            allDisconnections.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            // Group disconnections within 10-second window
            const TIME_WINDOW_SECONDS = 10;
            const disconnectionGroups: Array<{
              timestamps: Date[],
              durations: number[],
              userIds: string[]
            }> = [];
            
            allDisconnections.forEach(disc => {
              let addedToGroup = false;
              
              // Try to add to existing group
              for (let group of disconnectionGroups) {
                const groupStart = group.timestamps[0];
                const timeDiff = Math.abs(disc.timestamp.getTime() - groupStart.getTime()) / 1000;
                
                if (timeDiff <= TIME_WINDOW_SECONDS) {
                  group.timestamps.push(disc.timestamp);
                  group.durations.push(disc.duration);
                  group.userIds.push(disc.userId);
                  addedToGroup = true;
                  break;
                }
              }
              
              // Create new group if not added
              if (!addedToGroup) {
                disconnectionGroups.push({
                  timestamps: [disc.timestamp],
                  durations: [disc.duration],
                  userIds: [disc.userId]
                });
              }
            });
            
            // Calculate total duration: use MAX duration from each group
            // (because it's the same incident, we count the longest disconnection in that group)
            const totalDuration = disconnectionGroups.reduce((sum, group) => {
              const maxDurationInGroup = Math.max(...group.durations);
              return sum + maxDurationInGroup;
            }, 0);
            
            return {
              incidents: disconnectionGroups.length,
              totalDuration: totalDuration
            };
          };
          
          const { incidents: totalDisconnections, totalDuration } = calculateSmartMetrics();
          
          // Format duration
          const formatDuration = (seconds: number): string => {
            if (seconds === 0) return '0 Minutes';
            if (seconds < 60) return `${seconds} Seconds`;
            if (seconds < 3600) {
              const minutes = Math.floor(seconds / 60);
              return `${minutes} Minute${minutes !== 1 ? 's' : ''}`;
            }
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours} Hour${hours !== 1 ? 's' : ''} ${minutes} Minute${minutes !== 1 ? 's' : ''}`;
          };
          
          return (
            <div className="bg-white rounded-xl p-6 border border-gray-200 mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Internet Connectivity</h3>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Disconnection Duration */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <FontAwesomeIcon icon={faWifi} className="text-gray-500 text-sm" />
                    <p className="text-xs text-gray-600">Disconnection</p>
                  </div>
                  <p className="text-l font-bold" style={{ color: brandTheme.colors.primary }}>
                    Total {formatDuration(totalDuration)}
                  </p>
                </div>
                
                {/* Number of Times */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <FontAwesomeIcon icon={faHashtag} className="text-gray-500 text-sm" />
                    <p className="text-xs text-gray-600">Times</p>
                  </div>
                  <p className="text-l font-bold" style={{ color: brandTheme.colors.primary }}>
                    {totalDisconnections} Time{totalDisconnections !== 1 ? 's' : ''}
                  </p>
                </div>
                
                {/* Affected Users */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <FontAwesomeIcon icon={faUsers} className="text-gray-500 text-sm" />
                    <p className="text-xs text-gray-600">Affected Users</p>
                  </div>
                  <p className="text-l font-bold" style={{ color: brandTheme.colors.primary }}>
                    {affectedPercentage}%
                  </p>
                </div>
              </div>
            </div>
          );
        }, [presentStudents])}

        {/* Exam Progress Bar - Separate Section */}
        {timeStats && (
          <div className="bg-white rounded-xl p-6 border border-gray-200 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-gray-900">
                Exam Progress
                {exam.completionPolicy === 'flexible' && (
                  <span className="ml-2 text-sm font-medium text-green-600">(Flexible Mode)</span>
                )}
                {(!exam.completionPolicy || exam.completionPolicy === 'strict') && (
                  <span className="ml-2 text-sm font-medium text-blue-600">(Strict Mode)</span>
                )}
              </span>
              <span className="text-base font-bold text-gray-900">{Math.round(timeStats.progressPercent)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${timeStats.progressPercent}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
              <span>{timeStats.elapsedDisplay} elapsed</span>
              <span>{timeStats.remainingDisplay} remaining</span>
            </div>
          </div>
        )}
        
        {/* Exam Expired Warning Banner */}
        {examEndTime && currentTime > examEndTime && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-300 rounded-xl p-4 mb-4 animate-pulse">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                  <FontAwesomeIcon icon={faClock} className="text-white text-lg" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-orange-900 mb-1">
                  ⏰ Exam Time Expired
                </h4>
                <p className="text-xs text-orange-800 mb-2">
                  {hasAutoSubmittedRef.current 
                    ? (
                        activeCount > 0 
                          ? `${activeCount} active attempt(s) have been auto-submitted.`
                          : 'All active attempts have been auto-submitted.'
                      ) + (notStartedCount > 0 ? ` ${notStartedCount} student(s) never started the exam.` : '')
                    : (
                        activeCount > 0 
                          ? `Auto-submitting ${activeCount} active attempt(s) now...`
                          : notStartedCount > 0
                            ? `${notStartedCount} student(s) marked present but never started the exam.`
                            : 'No active attempts to submit.'
                      )}
                </p>
                {activeCount > 0 && !hasAutoSubmittedRef.current && (
                  <div className="flex items-center space-x-2 text-xs font-medium text-orange-900">
                    <div className="w-4 h-4 border border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing {activeCount} active attempt(s)...</span>
                  </div>
                )}
                {notStartedCount > 0 && hasAutoSubmittedRef.current && (
                  <div className="flex items-center space-x-2 text-xs bg-yellow-100 border border-yellow-300 rounded px-2 py-1 mt-2">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-yellow-700" />
                    <span className="text-yellow-800 font-medium">
                      {notStartedCount} student(s) marked attendance but never started the exam
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Right Panel - Students List */}
      <div className="w-[55%] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          {/* Header Row with Title and Close button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Exam Progress
                {exam.completionPolicy === 'flexible' && (
                  <span className="ml-2 text-base font-medium text-green-600">(Flexible Mode)</span>
                )}
                {(!exam.completionPolicy || exam.completionPolicy === 'strict') && (
                  <span className="ml-2 text-base font-medium text-blue-600">(Strict Mode)</span>
                )}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <FontAwesomeIcon icon={faChartLine} className="text-gray-600 text-sm" />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-green-600">{activeCount} active</span>
                  {' • '}
                  <span className="font-semibold text-blue-600">{submittedCount} submitted</span>
                  {expiredCount > 0 && (
                    <>
                      {' • '}
                      <span className="font-semibold text-orange-600">{expiredCount} expired</span>
                    </>
                  )}
                  {notStartedCount > 0 && (
                    <>
                      {' • '}
                      <span className="font-semibold text-gray-600">{notStartedCount} not started</span>
                    </>
                  )}
                  {' • '}
                  <span className="font-semibold">{presentStudents.length} total</span>
                </span>
              </div>
            </div>
            
            {/* Close button */}
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close Live Stats"
            >
              <FontAwesomeIcon icon={faXmark} className="text-gray-600 text-xl" />
            </button>
          </div>
        </div>

      {/* Students List */}
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
        ) : (
          <>
            {/* Present Students Section */}
            {presentStudents.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faUserCheck} style={{ color: brandTheme.colors.primary }} className="text-xl" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Present Students ({presentStudents.length})
                    </h3>
                  </div>
                  
                  {/* Auto-refresh indicator */}
                  <div className="flex items-center space-x-4">
                    {isAutoRefreshActive ? (
                      <>
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </div>
                        <span className="text-xs text-gray-500">
                          Auto-refresh • Updated {Math.floor((currentTime.getTime() - lastRefresh.getTime()) / 1000)}s ago
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="relative flex h-2 w-2">
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                        </div>
                        <span className="text-xs text-gray-500">
                          Auto-refresh stopped • Exam ended
                        </span>
                      </>
                    )}
                    
                    {/* Auto-submit status indicator */}
                    {autoSubmitStatus && (
                      <div className="flex items-center space-x-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded-md">
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                        </div>
                        <span className="text-xs font-medium text-orange-700">
                          {autoSubmitStatus}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {presentStudents
                    .sort((a, b) => {
                      // Put submitted students at the bottom
                      if (a.status === 'submitted' && b.status !== 'submitted') return 1;
                      if (a.status !== 'submitted' && b.status === 'submitted') return -1;
                      
                      // Within each group, sort by name
                      return a.fullName.localeCompare(b.fullName);
                    })
                    .map((student) => (
                    <div 
                      key={student.userId}
                      className="p-4 rounded-xl border transition-all hover:shadow-md"
                      style={{ 
                        backgroundColor: `${brandTheme.colors.primary}05`,
                        borderColor: student.violations && student.violations.length > 0 
                          ? '#fbbf24' 
                          : `${brandTheme.colors.primary}40`
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold relative"
                            style={{ backgroundColor: brandTheme.colors.primary }}
                          >
                            {student.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                            {student.status === 'active' && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border border-white"></div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-semibold text-gray-900">{student.fullName}</p>
                              {student.status && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(student.status)}`}>
                                  {student.status.toUpperCase()}
                                </span>
                              )}
                              
                              {/* Activities Icon */}
                              {student.activities && student.activities.length > 0 && (
                                <button
                                  onClick={() => setSelectedStudentForActivities(student)}
                                  className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                                  title="View activity log"
                                >
                                  <FontAwesomeIcon icon={faClockRotateLeft} className="text-blue-600 text-[10px]" />
                                  <span className="text-[10px] font-bold text-blue-700">{student.activities.length}</span>
                                </button>
                              )}
                              
                              {/* Multiple IP Warning Badge */}
                              {student.hasMultipleIPs && (
                                <span className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-red-100 border border-red-300">
                                  <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-600 text-[10px]" />
                                  <span className="text-[10px] font-bold text-red-700">Multiple IPs</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3">
                              <p className="text-xs text-gray-600">Roll No: {student.studentRoll}</p>
                              {student.activityLogId && (
                                <p className="text-xs text-gray-500 font-mono">
                                  Attempt Id: <span className="font-semibold text-blue-600">{student.activityLogId}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            {student.markedAt && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Marked at</p>
                                <p className="text-xs font-medium text-gray-700">{student.markedAt}</p>
                              </div>
                            )}
                            <FontAwesomeIcon icon={faCircleCheck} style={{ color: brandTheme.colors.primary }} className="text-lg" />
                          </div>
                          {student.lastActivity && (
                            <p className="text-[10px] text-gray-500 mt-1">{student.lastActivity}</p>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {student.progress !== undefined && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600">Progress</span>
                            <span className="text-xs font-bold" style={{ color: brandTheme.colors.primary }}>
                              {student.questionsSubmitted}/{exam.totalQuestions} questions • {student.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${student.progress}%`,
                                backgroundColor: brandTheme.colors.primary
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Activity Details */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {student.ipAddress && (
                            <div>
                              <p className="text-gray-500">IP Address</p>
                              <p className="font-mono text-gray-700 truncate" title={student.ipAddress}>
                                {student.ipAddress}
                              </p>
                            </div>
                          )}
                          {student.totalDuration !== undefined && (
                            <div>
                              <p className="text-gray-500">Duration</p>
                              <p className="font-semibold text-gray-700">
                                {Math.floor(student.totalDuration / 60)}m {student.totalDuration % 60}s
                              </p>
                            </div>
                          )}
                          {student.entryTime && (
                            <div>
                              <p className="text-gray-500">Entry Time</p>
                              <p className="font-semibold text-gray-700">
                                {student.entryTime.toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          )}
                          {/* Internet Connectivity Info */}
                          <div className="">
                            {/* Header line with label and quality badge */}
                            <div className="flex items-center space-x-1">
                              <FontAwesomeIcon 
                                icon={faWifi} 
                                className="text-gray-500 text-[10px]" 
                              />
                              <p className="text-gray-500">Disconnection</p>
                            </div>
                            
                            {/* Duration value */}
                            <p className={`font-semibold ${(student.totalDisconnections || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {(() => {
                                const duration = student.totalInternetUnavailableDuration || 0;
                                if (duration === 0) return '0 Minutes';
                                if (duration < 60) return `${duration} Seconds`;
                                if (duration < 3600) {
                                  const minutes = Math.floor(duration / 60);
                                  return `${minutes} Minute${minutes !== 1 ? 's' : ''}`;
                                }
                                const hours = Math.floor(duration / 3600);
                                const minutes = Math.floor((duration % 3600) / 60);
                                return `${hours} Hour${hours !== 1 ? 's' : ''} ${minutes} Minute${minutes !== 1 ? 's' : ''}`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Inline Violations Display - Latest 5 */}
                      {student.violations && student.violations.length > 0 && (
                        <div className={`mt-3 p-3 border rounded-lg ${
                          student.violations.some(v => v.severity === 'critical') 
                            ? 'bg-red-50 border-red-300' 
                            : student.violations.some(v => v.severity === 'high')
                            ? 'bg-orange-50 border-orange-300'
                            : 'bg-yellow-50 border-yellow-300'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <FontAwesomeIcon 
                                icon={faTriangleExclamation} 
                                className={`text-sm ${
                                  student.violations.some(v => v.severity === SEVERITY_LEVELS.CRITICAL)
                                    ? SEVERITY_TEXT_CLASSES[SEVERITY_LEVELS.CRITICAL]
                                    : student.violations.some(v => v.severity === SEVERITY_LEVELS.HIGH)
                                    ? SEVERITY_TEXT_CLASSES[SEVERITY_LEVELS.HIGH]
                                    : SEVERITY_TEXT_CLASSES[SEVERITY_LEVELS.MEDIUM]
                                }`}
                              />
                              <span className={`text-xs font-bold ${
                                student.violations.some(v => v.severity === 'critical')
                                  ? 'text-red-800'
                                  : student.violations.some(v => v.severity === 'high')
                                  ? 'text-orange-800'
                                  : 'text-yellow-800'
                              }`}>
                                Latest Violations (Showing {Math.min(4, student.violations.length)} of {student.violations.length})
                              </span>
                            </div>
                            {/* Only show "view more" button if there are more than 4 violations */}
                            {student.violations.length > 4 && (
                              <button
                                onClick={() => {
                                  setSelectedStudentForViolations(student);
                                  setViolationsCurrentPage(1);
                                }}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors shadow-sm ${
                                  student.violations.some(v => v.severity === 'critical')
                                    ? 'bg-red-300 hover:bg-red-400'
                                    : student.violations.some(v => v.severity === 'high')
                                    ? 'bg-orange-300 hover:bg-orange-400'
                                    : 'bg-yellow-300 hover:bg-yellow-400'
                                }`}
                                title="View all violations"
                              >
                                <FontAwesomeIcon 
                                  icon={faChevronRight} 
                                  className={`text-sm ${
                                    student.violations.some(v => v.severity === 'critical')
                                      ? 'text-red-800'
                                      : student.violations.some(v => v.severity === 'high')
                                      ? 'text-orange-800'
                                      : 'text-yellow-800'
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {student.violations
                              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                              .slice(0, 4)
                              .map((violation, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs bg-white bg-opacity-50 p-2 rounded">
                                <span className="text-gray-700 flex items-center space-x-2 flex-1">
                                  <FontAwesomeIcon icon={getViolationIcon(violation.type)} className="text-sm" />
                                  <span className="truncate">{getViolationLabel(violation.type)}</span>
                                </span>
                                <div className="flex items-center space-x-2 ml-2">
                                  {/* Play button for violations with proofUrl */}
                                  {violation.proofUrl && (
                                    <button
                                      onClick={() => {
                                        const url = violation.proofUrl!;
                                        // Check if it's an image file, otherwise treat as video
                                        const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') ||
                                                       url.includes('%2Ejpg') || url.includes('%2Ejpeg') || url.includes('%2Epng');
                                        setEvidenceModal({ url, type: isImage ? 'image' : 'video' });
                                      }}
                                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                                        violation.severity === 'critical' ? 'bg-red-200 hover:bg-red-300 text-red-700' :
                                        violation.severity === 'high' ? 'bg-orange-200 hover:bg-orange-300 text-orange-700' :
                                        violation.severity === 'medium' ? 'bg-yellow-200 hover:bg-yellow-300 text-yellow-700' :
                                        'bg-blue-200 hover:bg-blue-300 text-blue-700'
                                      }`}
                                      title="View evidence"
                                    >
                                      <FontAwesomeIcon 
                                        icon={(() => {
                                          const url = violation.proofUrl || '';
                                          const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') ||
                                                         url.includes('%2Ejpg') || url.includes('%2Ejpeg') || url.includes('%2Epng');
                                          return isImage ? faImage : faPlay;
                                        })()} 
                                        className="text-[8px]" 
                                      />
                                    </button>
                                  )}
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    SEVERITY_BADGE_CLASSES[violation.severity as SeverityLevel] || 
                                    SEVERITY_BADGE_CLASSES[SEVERITY_LEVELS.LOW]
                                  }`}>
                                    {violation.severity?.toUpperCase()}
                                  </span>
                                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                    {formatISTTime(violation.timestamp, { timeOnly: true })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Absent Students Section */}
            {/* Empty State */}
            {students.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-64">
                <FontAwesomeIcon icon={faUsers} className="text-gray-300 text-6xl mb-4" />
                <p className="text-gray-500 text-lg font-medium">No active students yet</p>
                <p className="text-gray-400 text-sm">Students will appear here when they start the exam</p>
              </div>
            )}
          </>
        )}
      </div>
      </div>
      
      {/* Violations Modal - Slide from Right */}
      <div className={`fixed inset-0 z-[9999] flex items-start justify-end p-2 transition-opacity duration-300 ${
        selectedStudentForViolations ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
          onClick={() => {
            setSelectedStudentForViolations(null);
            setViolationsCurrentPage(1);
          }}
        />
        
        <div 
          className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[35rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
            selectedStudentForViolations ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Gradient */}
          <div 
            className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
            style={{ 
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
            }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Violations {selectedStudentForViolations?.violations && selectedStudentForViolations.violations.length > 0 && 
                    `(${selectedStudentForViolations.violations.length})`}
                </h2>
                <p className="text-xs text-white/80">
                  {selectedStudentForViolations?.fullName} • Roll No: {selectedStudentForViolations?.studentRoll}
                </p>
                {selectedStudentForViolations?.activityLogId && (
                  <p className="text-xs text-white/80 font-mono">
                    Attempt Id: <span className="font-semibold">{selectedStudentForViolations.activityLogId}</span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedStudentForViolations(null);
                setViolationsCurrentPage(1);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white" />
            </button>
          </div>
          
          {/* Violation Summary Badges */}
          {selectedStudentForViolations?.violations && selectedStudentForViolations.violations.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center space-x-2 flex-wrap gap-y-2">
              {(() => {
                const summary = {
                  critical: selectedStudentForViolations.violations.filter(v => v.severity === 'critical').length,
                  high: selectedStudentForViolations.violations.filter(v => v.severity === 'high').length,
                  medium: selectedStudentForViolations.violations.filter(v => v.severity === 'medium').length,
                  low: selectedStudentForViolations.violations.filter(v => v.severity === 'low').length
                };
                
                return (
                  <>
                    {summary.critical > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span>Critical: {summary.critical}</span>
                      </span>
                    )}
                    {summary.high > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        <span>High: {summary.high}</span>
                      </span>
                    )}
                    {summary.medium > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span>Medium: {summary.medium}</span>
                      </span>
                    )}
                    {summary.low > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>Low: {summary.low}</span>
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          
          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 hide-scrollbar">
            {selectedStudentForViolations?.violations && selectedStudentForViolations.violations.length > 0 ? (
              <>
                <div className="space-y-2">
                  {/* Sort by timestamp descending (latest first) and show current page */}
                  {(() => {
                    const sortedViolations = selectedStudentForViolations.violations
                      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                    const startIdx = (violationsCurrentPage - 1) * VIOLATIONS_PER_PAGE;
                    const endIdx = startIdx + VIOLATIONS_PER_PAGE;
                    const pageViolations = sortedViolations.slice(startIdx, endIdx);
                    
                    return pageViolations.map((violation, idx) => (
                      <div 
                        key={startIdx + idx}
                        className={`p-3 rounded-xl border ${
                          violation.severity === 'critical' 
                            ? 'bg-red-50 border-red-200' 
                            : violation.severity === 'high'
                            ? 'bg-orange-50 border-orange-200'
                            : violation.severity === 'medium'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        {/* Top Row: Icon, Title, Play Button */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              violation.severity === 'critical' ? 'bg-red-100' :
                              violation.severity === 'high' ? 'bg-orange-100' :
                              violation.severity === 'medium' ? 'bg-yellow-100' :
                              'bg-blue-100'
                            }`}>
                              <FontAwesomeIcon 
                                icon={getViolationIcon(violation.type)} 
                                className={`text-sm ${
                                  violation.severity === 'critical' ? 'text-red-600' :
                                  violation.severity === 'high' ? 'text-orange-600' :
                                  violation.severity === 'medium' ? 'text-yellow-600' :
                                  'text-blue-600'
                                }`}
                              />
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900">{getViolationLabel(violation.type)}</h4>
                          </div>
                          
                          {/* Play/View Evidence Button */}
                          {(violation as any).proofUrl && (
                            <button 
                              onClick={() => {
                                const url = (violation as any).proofUrl;
                                console.log('🎬 Opening evidence URL:', url);
                                // Check if it's an image file, otherwise treat as video
                                const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') ||
                                               url.includes('%2Ejpg') || url.includes('%2Ejpeg') || url.includes('%2Epng');
                                setEvidenceModal({ url, type: isImage ? 'image' : 'video' });
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                violation.severity === 'critical' ? 'bg-red-200 hover:bg-red-300 text-red-700' :
                                violation.severity === 'high' ? 'bg-orange-200 hover:bg-orange-300 text-orange-700' :
                                violation.severity === 'medium' ? 'bg-yellow-200 hover:bg-yellow-300 text-yellow-700' :
                                'bg-blue-200 hover:bg-blue-300 text-blue-700'
                              }`}
                              title="View evidence"
                            >
                              <FontAwesomeIcon 
                                icon={(() => {
                                  const url = (violation as any).proofUrl || '';
                                  const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') ||
                                                 url.includes('%2Ejpg') || url.includes('%2Ejpeg') || url.includes('%2Epng');
                                  return isImage ? faImage : faPlay;
                                })()} 
                                className="text-xs" 
                              />
                            </button>
                          )}
                        </div>
                        
                        {/* Details Text */}
                        {violation.details && (
                          <p className="text-xs text-gray-600 mb-2 pl-[42px]">{violation.details}</p>
                        )}
                        
                        {/* Bottom Row: Badges and Timestamp */}
                        <div className="flex items-center justify-between pl-[42px]">
                          <div className="flex items-center space-x-1.5">
                            {violation.questionNo && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                                Q{violation.questionNo}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              SEVERITY_BADGE_CLASSES[violation.severity as SeverityLevel] || 
                              SEVERITY_BADGE_CLASSES[SEVERITY_LEVELS.LOW]
                            }`}>
                              {violation.severity?.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500">
                            <FontAwesomeIcon icon={faClock} className="mr-1" />
                            {(() => {
                                const timestamp = violation.timestamp && typeof violation.timestamp === 'object' && 'toDate' in violation.timestamp
                                ? (violation.timestamp as any).toDate()
                                : violation.timestamp instanceof Date
                                ? violation.timestamp 
                                : new Date(violation.timestamp);
                              return formatISTTime(timestamp);
                            })()}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 text-5xl mb-4" />
                <p className="text-gray-600 text-sm">No violations detected</p>
              </div>
            )}
          </div>
          
          {/* Footer with Pagination */}
          {selectedStudentForViolations?.violations && selectedStudentForViolations.violations.length > VIOLATIONS_PER_PAGE && (
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div className="text-xs text-gray-600">
                Showing {((violationsCurrentPage - 1) * VIOLATIONS_PER_PAGE) + 1} to {Math.min(violationsCurrentPage * VIOLATIONS_PER_PAGE, selectedStudentForViolations.violations.length)} of {selectedStudentForViolations.violations.length}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViolationsCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={violationsCurrentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    violationsCurrentPage === 1
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1" />
                  Previous
                </button>
                
                <span className="text-xs font-medium text-gray-700">
                  Page {violationsCurrentPage} of {Math.ceil(selectedStudentForViolations.violations.length / VIOLATIONS_PER_PAGE)}
                </span>
                
                <button
                  onClick={() => setViolationsCurrentPage(prev => Math.min(Math.ceil((selectedStudentForViolations.violations?.length || 0) / VIOLATIONS_PER_PAGE), prev + 1))}
                  disabled={violationsCurrentPage >= Math.ceil(selectedStudentForViolations.violations.length / VIOLATIONS_PER_PAGE)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    violationsCurrentPage >= Math.ceil(selectedStudentForViolations.violations.length / VIOLATIONS_PER_PAGE)
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Next
                  <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Activities Modal - Slide from Right */}
      <div className={`fixed inset-0 z-[9999] flex items-start justify-end p-2 transition-opacity duration-300 ${
        selectedStudentForActivities ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            selectedStudentForActivities ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => {
            setSelectedStudentForActivities(null);
            setActivitiesCurrentPage(1);
          }}
        />
        
        {/* Modal Panel */}
        <div 
          className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[35rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
            selectedStudentForActivities ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Blue Gradient */}
          <div 
            className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
            style={{ 
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)'
            }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <FontAwesomeIcon icon={faClockRotateLeft} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Activity Log {selectedStudentForActivities?.activities && selectedStudentForActivities.activities.length > 0 && 
                    `(${selectedStudentForActivities.activities.length})`}
                </h2>
                <p className="text-xs text-white/80">
                  {selectedStudentForActivities?.fullName} • Roll No: {selectedStudentForActivities?.studentRoll}
                </p>
                {selectedStudentForActivities?.activityLogId && (
                  <p className="text-xs text-white/80 font-mono">
                    Attempt Id: <span className="font-semibold">{selectedStudentForActivities.activityLogId}</span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedStudentForActivities(null);
                setActivitiesCurrentPage(1);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
            {selectedStudentForActivities?.activities && selectedStudentForActivities.activities.length > 0 ? (
              (() => {
                const ACTIVITIES_PER_PAGE = 25;
                const sortedActivities = selectedStudentForActivities.activities
                  .slice()
                  .sort((a, b) => {
                    const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 
                                  a.timestamp instanceof Date ? a.timestamp.getTime() : 
                                  new Date(a.timestamp).getTime();
                    const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 
                                  b.timestamp instanceof Date ? b.timestamp.getTime() : 
                                  new Date(b.timestamp).getTime();
                    return timeB - timeA; // Descending order (latest first)
                  });
                
                const startIdx = (activitiesCurrentPage - 1) * ACTIVITIES_PER_PAGE;
                const pageActivities = sortedActivities.slice(startIdx, startIdx + ACTIVITIES_PER_PAGE);
                
                return pageActivities.map((activity, idx) => {
                  const globalIdx = startIdx + idx;
                  const nextActivity = sortedActivities[globalIdx + 1];
                  const isExit = activity.type === 'exit';
                  const isEntry = activity.type === 'enter';
                  
                  // Check if this entry has a different IP than the initial IP
                  const initialIP = selectedStudentForActivities.initialIP || '';
                  const currentIP = activity.ipAddress || '';
                  const isDifferentIP = isEntry && currentIP && initialIP && currentIP !== initialIP;
                  
                  // Safely convert activity timestamp
                  const activityTimestamp = activity.timestamp?.toDate 
                    ? activity.timestamp.toDate() 
                    : activity.timestamp instanceof Date 
                    ? activity.timestamp 
                    : new Date(activity.timestamp);
                  
                  // Calculate duration out if this is an exit and next is an enter
                  let durationOut = null;
                  if (isExit && nextActivity && nextActivity.type === 'enter') {
                    const nextTimestamp = nextActivity.timestamp?.toDate 
                      ? nextActivity.timestamp.toDate() 
                      : nextActivity.timestamp instanceof Date 
                      ? nextActivity.timestamp 
                      : new Date(nextActivity.timestamp);
                    
                    const exitTime = activityTimestamp.getTime();
                    const reentryTime = nextTimestamp.getTime();
                    const durationMs = reentryTime - exitTime;
                    const minutes = Math.floor(durationMs / 60000);
                    const seconds = Math.floor((durationMs % 60000) / 1000);
                    durationOut = `${minutes}m ${seconds}s`;
                  }
                  
                  return (
                    <div key={idx}>
                      <div 
                        className={`p-3 rounded-xl border ${
                          isDifferentIP 
                            ? 'bg-red-50 border-red-400' 
                            : isEntry 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        {/* Warning badge for different IP */}
                        {isDifferentIP && (
                          <div className="mb-2 flex items-center space-x-2 px-2 py-1 bg-red-100 border border-red-300 rounded-lg">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-600 text-xs" />
                            <span className="text-[10px] font-bold text-red-800">
                              DIFFERENT IP - Security violation
                            </span>
                          </div>
                        )}
                        
                        {/* Top Row: Icon, Title, IP */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isEntry ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              <FontAwesomeIcon 
                                icon={isEntry ? faRightToBracket : faRightFromBracket} 
                                className={`text-sm ${isEntry ? 'text-green-600' : 'text-red-600'}`}
                              />
                            </div>
                            <div>
                              <h4 className={`text-sm font-semibold ${
                                isEntry ? 'text-green-900' : 'text-red-900'
                              }`}>
                                {isEntry ? 'Entered Exam' : 'Exited Exam'}
                              </h4>
                              <p className="text-[10px] text-gray-500">
                                <FontAwesomeIcon icon={faClock} className="mr-1" />
                                {activityTimestamp.toLocaleString('en-US', { 
                                  dateStyle: 'short',
                                  timeStyle: 'medium'
                                })}
                              </p>
                            </div>
                          </div>
                          {activity.ipAddress && (
                            <div className="text-right">
                              <p className="text-[10px] text-gray-500">IP Address</p>
                              <p className={`text-xs font-mono font-semibold ${
                                isDifferentIP ? 'text-red-700' : 'text-gray-700'
                              }`}>
                                {activity.ipAddress}
                              </p>
                              {isDifferentIP && (
                                <p className="text-[9px] text-red-600 font-semibold">
                                  Initial: {initialIP}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Duration Out Display */}
                      {durationOut && (
                        <div className="flex items-center justify-center py-1.5">
                          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-orange-100 border border-orange-200 rounded-full">
                            <FontAwesomeIcon icon={faHourglassHalf} className="text-orange-600 text-[10px]" />
                            <span className="text-[10px] font-semibold text-orange-800">
                              Out for {durationOut}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            ) : (
              <div className="text-center py-12">
                <FontAwesomeIcon icon={faClockRotateLeft} className="text-gray-300 text-5xl mb-4" />
                <p className="text-gray-600">No activity recorded yet</p>
              </div>
            )}
          </div>

          {/* Footer with Pagination */}
          {selectedStudentForActivities?.activities && selectedStudentForActivities.activities.length > 25 && (
            <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0 bg-gray-50 rounded-b-2xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActivitiesCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={activitiesCurrentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    activitiesCurrentPage === 1
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1" />
                  Previous
                </button>
                
                <span className="text-xs font-medium text-gray-700">
                  Page {activitiesCurrentPage} of {Math.ceil(selectedStudentForActivities.activities.length / 25)}
                </span>
                
                <button
                  onClick={() => setActivitiesCurrentPage(prev => Math.min(Math.ceil((selectedStudentForActivities.activities?.length || 0) / 25), prev + 1))}
                  disabled={activitiesCurrentPage >= Math.ceil(selectedStudentForActivities.activities.length / 25)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    activitiesCurrentPage >= Math.ceil(selectedStudentForActivities.activities.length / 25)
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Next
                  <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evidence Modal Overlay - Global (appears on top of everything) */}
      {evidenceModal && (
        <div 
          className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4"
          onClick={() => setEvidenceModal(null)}
        >
          <div 
            className="relative bg-gray-900 rounded-2xl overflow-hidden max-w-full max-h-full shadow-2xl p-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close and Open in New Tab */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-t-xl">
              <span className="text-xs text-gray-400 font-medium">
                {evidenceModal.type === 'video' ? '🎬 Video Evidence' : '🖼️ Image Evidence'}
              </span>
              <div className="flex items-center space-x-2">
                <a
                  href={evidenceModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all flex items-center space-x-1"
                >
                  <FontAwesomeIcon icon={faExpand} className="text-[10px]" />
                  <span>Open in New Tab</span>
                </a>
                <button
                  onClick={() => setEvidenceModal(null)}
                  className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition-all"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
                </button>
              </div>
            </div>
            
            {/* Media Content */}
            <div className="bg-black rounded-b-xl flex items-center justify-center min-h-[200px] min-w-[300px]">
              {evidenceModal.type === 'video' ? (
                <video 
                  key={evidenceModal.url}
                  controls 
                  autoPlay
                  playsInline
                  className="max-w-[80vw] max-h-[70vh] rounded-b-lg"
                >
                  <source src={evidenceModal.url} type="video/webm" />
                  <source src={evidenceModal.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img 
                  key={evidenceModal.url}
                  src={evidenceModal.url} 
                  alt="Evidence" 
                  className="max-w-[80vw] max-h-[70vh] object-contain rounded-b-lg"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}