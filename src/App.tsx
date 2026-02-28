/// <reference types="react" />

import { useState, useEffect, useRef, useMemo, useCallback, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import CreateExamModal from './CreateExamModal';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ChangePassword from './ChangePassword';
import UserProfile from './UserProfile';
import CreateRoomModal from './CreateRoomModal';
import BulkUploadRooms from './BulkUploadRooms';
import BulkUploadUniversity from './BulkUploadUniversity';
import ProblemsListModal from './ProblemsListModal';
import Rooms from './Rooms';
import RoomDetail from './RoomDetail';
import Reports from './Reports';
import ReportDetail from './ReportDetail';
import HallTicketsList from './HallTicketsList';
import HallTicket from './HallTicket';
import Exams, { type Exam } from './Exams';
import { firebaseService, type UserModel, type LoginIPInfo } from './services/firebase_service';
import { getDownloadURL, ref, getStorage } from 'firebase/storage';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getHallTicketGroups } from './services/roomSchedulingService';
import { 
  EXAM_STATUS,
  ATTENDANCE_STATUS,
  USER_TYPES,
  EXAM_MODES,
  EXAM_MODE_LABELS,
  SECURITY_LEVELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  NOTICE_FILTER,
  ACTIVE_ITEMS,
  SECTION_CATEGORIES,
  
} from './constants';
import { firebaseConfig, firestoreDbName } from './config/firebase_config';
import CreateHallTicketModal from './CreateHallTicketModal';
import QuestionList from './QuestionList';
import CreateQuestionModal from './CreateQuestionModal';
import BulkUploadQuestions from './BulkUploadQuestions';
import CreateUserModal from './CreateUserModal';
import CreateLearningPathModal from './CreateLearningPathModal';
import { LoadingSpinner } from './LoadingSpinner';
import CertificateVerify from './CertificateVerify';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import katex from 'katex';

import ProfileDropdown from './ProfileDropdown';
import { BrandProvider } from './BrandContext';
import { getThemeFromSubdomain, getSubdomain, generateThemeFromBrandProfile } from './themeUtils';
import AIAssistant from './AIAssistant';
import AISupportAssistant from './AISupportAssistant';
import Questions from './Questions';
import Classes from './Classes';
import UserList from './UserList';
import Result from './Result';
import LiveStats from './LiveStats';
import Attendance from './Attendance';
import ExamsInterface from './ExamsInterface';
import ExamDashboard  from './ExamDashboard';
import StudentExamDetail from './StudentExamDetail';
import Calendar from './Calendar';
import LeaderBoard from './LeaderBoard';
import AuditUserList from './AuditUserList';
import UserAudit from './UserAudit';
import PreExamVerification from './PreExamVerification';
import Learning from './Learning';
import CourseCurriculum from './CourseCurriculum';


import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faRobot,
  faIdCard,
  faChevronLeft,
  faChevronRight,
  faChevronDown,
  faUser,
  faUsers,
  faGraduationCap,
  faChartBar,
  faClipboardList,
  faBookOpen,
  faFileLines,
  faBriefcase,
  faBell,
  faPlus,
  faCalendar,
  faCalendarDays, // ADDED: New icon for Calendar page
  faTrophy,
  faMedal,
  faBullhorn,
  faXmark,
  faBuilding,
  faListCheck,
  faLayerGroup,
  faArrowUpFromBracket,
  faUserCheck,
  faTag,
  faCircleQuestion,
  faClock,
  faStar,
  faCopy,
  faCheck,
  faMapMarkerAlt,
  faGlobe,
  faTowerBroadcast,
  faLaptop,
  faEarthAmericas,
  faChartLine,
  faBooks,
  faPartyHorn,
  faGear,
  faChalkboardUser,
  faLock,
  faShieldCheck,
  faPenToSquare,
  faCircle,
  faUserTie,
  faBackpack,
  faGripVertical,
  faAward,
  faCheckCircle,
  faDoorOpen,
  faImage,
  faClipboardCheck
} from '@fortawesome/sharp-light-svg-icons';

import { 
  faWindows,
  faApple,
  faLinux
} from '@fortawesome/free-brands-svg-icons';

// Extend Exam type to include questionPool fields for random selection
type ExamWithPool = Exam & {
  questionPool?: any[];
  pickRandomCount?: number;
  poolQuestionMarks?: number;
};

// Helper function to check if attendance can be marked (anytime except after exam ends)
function canMarkAttendance(examDate: string, examTime: string, duration: string): boolean {
  if (!examDate || !duration) return true; // Allow if date/duration not set
  
  try {
    // Get current time in IST
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Create exam start time in IST
    const examStartIST = new Date(examDate);
    
    // If examTime is provided, set the specific time
    if (examTime) {
      const [hours, minutes] = examTime.split(':').map(Number);
      examStartIST.setHours(hours, minutes, 0, 0);
    } else {
      // If no time specified, assume end of day
      examStartIST.setHours(23, 59, 59, 999);
    }
    
    // Parse duration (stored as string of minutes)
    const durationMinutes = parseInt(duration) || 0;
    
    // Calculate exam end time in IST
    const examEndIST = new Date(examStartIST.getTime() + durationMinutes * 60 * 1000);
    
    // Calculate 30 minutes before exam in IST
    const thirtyMinutesBeforeIST = new Date(examStartIST.getTime() - 30 * 60 * 1000);
    
    // Allow attendance marking from 30 minutes before exam until exam ends
    return nowIST >= thirtyMinutesBeforeIST && nowIST <= examEndIST;
  } catch (error) {
    console.error('Error checking attendance window:', error);
    return true; // Allow on error to prevent blocking
  }
}

/**
 * Get current academic year (Apr-Mar)
 * Returns format: "2025-26"
 */
/**
 * Calculate academic year based on college's academic year start month
 * @param startMonth - The month when academic year starts (e.g., "April", "January", "June")
 *                     Defaults to "April" if not provided
 */
// Calculate academic year from start month (used when college data is already loaded)
const calculateAcademicYear = (startMonth?: string): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const monthMap: Record<string, number> = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
    'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
    'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
  };
  
  const startMonthNum = startMonth ? (monthMap[startMonth.toLowerCase()] || 4) : 4;
  
  if (currentMonth >= startMonthNum) {
    return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  } else {
    return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  }
};

// Helper function to check if live stats are available (30 minutes before exam, stays enabled after exam ends)
function canViewLiveStats(examDate: string, examTime: string): boolean {
  if (!examDate || !examTime) return false;
  
  try {
    // Parse exam date and time in IST
    const [hours, minutes] = examTime.split(':').map(Number);
    const examStartIST = new Date(examDate);
    examStartIST.setHours(hours, minutes, 0, 0);
    
    // Get current time in IST
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Calculate 30 minutes before exam in IST
    const thirtyMinutesBeforeIST = new Date(examStartIST.getTime() - 30 * 60 * 1000);
    
    // Check if current IST time is after 30 minutes before exam (no end time restriction)
    return nowIST >= thirtyMinutesBeforeIST;
  } catch (error) {
    console.error('Error checking live stats availability:', error);
    return false;
  }
}

// Helper function to check if exam is currently live
function isExamLive(examDate: string, examTime: string | undefined, duration: string, likertDuration?: number): boolean {
  if (!examDate || !duration) return false;
  
  try {
    // Get current time in IST
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Create exam start time in IST
    const examStartIST = new Date(examDate);
    
    if (examTime) {
      // If time is specified, use the exact time
      const [hours, minutes] = examTime.split(':').map(Number);
      examStartIST.setHours(hours, minutes, 0, 0);
      
      const totalDurationMinutes = (parseInt(duration) || 0) + (likertDuration || 0);
      const examEndIST = new Date(examStartIST.getTime() + totalDurationMinutes * 60 * 1000);
      
      // Exam is live only during actual exam time (start to end)
      return nowIST >= examStartIST && nowIST <= examEndIST;
    } else {
      // If no time specified, consider exam live on the exam date (all day)
      examStartIST.setHours(0, 0, 0, 0);
      const examEndIST = new Date(examStartIST);
      examEndIST.setHours(23, 59, 59, 999);
      
      return nowIST >= examStartIST && nowIST <= examEndIST;
    }
  } catch (error) {
    return false;
  }
}

// Helper function to check if exam has completely ended
function isExamCompleted(examDate: string, examTime: string | undefined, duration: string, status?: string, likertDuration?: number): boolean {
  // If status is explicitly set to completed, return true
  if (status === EXAM_STATUS.COMPLETED) return true;
  
  if (!examDate || !examTime || !duration) return false;
  
  try {
    // Parse exam date and time in IST
    const [hours, minutes] = examTime.split(':').map(Number);
    const examStartIST = new Date(examDate);
    examStartIST.setHours(hours, minutes, 0, 0);
    
    const totalDurationMinutes = (parseInt(duration) || 0) + (likertDuration || 0);
    const examEndIST = new Date(examStartIST.getTime() + totalDurationMinutes * 60 * 1000);
    
    // Get current time in IST
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Check if current IST time is past exam end time
    return nowIST > examEndIST;
  } catch (error) {
    return false;
  }
}

// Helper function to check if student is marked present for an exam
async function checkStudentAttendance(examId: string, studentId: string): Promise<boolean> {
  try {
    const record = await firebaseService.getStudentAttendance(examId, studentId);
    return !!(record && record.status === ATTENDANCE_STATUS.PRESENT);
  } catch (error) {
    console.error('Error checking student attendance:', error);
    return false;
  }
}

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

// Function to handle exam start with attendance check
async function handleExamStartClick(
  exam: any, 
  user: UserModel | null, 
  onProceed: () => void, 
  onAttendanceWarning: (exam: any) => void,
  onProctoringSetup?: (exam: any, cameraGranted: boolean, audioGranted: boolean) => void
) {
  // Safety check - if no user, don't proceed
  if (!user) {
    console.error('Cannot start exam: User is null or undefined');
    return;
  }
  
  // console.log(`🔍 Checking requirements for exam: ${exam.id}, student: ${user.userId}`);
  // console.log(`🎥 Exam mode: ${exam.mode}, A/V Proctoring: ${exam.avProctoring}`);
  
  // CHECK 0: Enrollment Validation — student must be enrolled in exam_enrollments
  if (user.userType === 'student') {
    try {
      const isEnrolled = await firebaseService.isStudentEnrolledInExam(exam.id, user.userId);
      // console.log(`📋 Enrollment status: ${isEnrolled ? 'Enrolled' : 'NOT Enrolled'}`);
      if (!isEnrolled) {
        // console.log('🚫 Blocking exam start - student is NOT enrolled for this exam');
        alert('You are not enrolled for this exam. Please contact your teacher or administrator.');
        return;
      }
    } catch (enrollError) {
      console.error('❌ Error checking enrollment:', enrollError);
      // Block on error — don't let unenrolled students through
      alert('Unable to verify enrollment. Please try again.');
      return;
    }
  }
  // 🎥 CHECK 1: A/V Proctoring Requirements (if enabled)
  if (exam.mode === EXAM_MODES.ONLINE && exam.avProctoring === true) {
    // console.log('🎥 A/V Proctoring is enabled for this exam - checking requirements...');
    
    // Check if proctoring photos exist
    const hasProctoringPhotos = 
      user.proctoringPhotos?.front && 
      user.proctoringPhotos?.left && 
      user.proctoringPhotos?.right;
    
    // console.log('📸 Proctoring photos status:', {
      // front: !!user.proctoringPhotos?.front,
      // left: !!user.proctoringPhotos?.left,
      // right: !!user.proctoringPhotos?.right,
      // allComplete: hasProctoringPhotos
    // });
    
    // Check camera/microphone permissions
    let hasCameraPermission = false;
    let hasMicPermission = false;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Permissions granted
      hasCameraPermission = true;
      hasMicPermission = true;
      
      // Stop the stream immediately - we're just checking permissions
      stream.getTracks().forEach(track => track.stop());
      
      // console.log('✅ Camera and microphone permissions granted');
    } catch (error: any) {
      // console.log('❌ Camera/microphone permission error:', error.name);
      hasCameraPermission = false;
      hasMicPermission = false;
    }
    
    // If ANYTHING is missing, show the setup dialog
    if (!hasProctoringPhotos || !hasCameraPermission || !hasMicPermission) {
      // console.log('⚠️ Some requirements missing - showing setup dialog');
      if (onProctoringSetup) {
        onProctoringSetup(exam, hasCameraPermission, hasMicPermission);
      } else {
        console.error('⚠️ onProctoringSetup callback is not provided!');
      }
      return;
    }
    
    // console.log('✅ All proctoring requirements met - proceeding to exam');
  }
  
  // CHECK 2: Attendance Requirements
  // console.log(`📋 Checking attendance for exam: ${exam.id}, student: ${user.userId}`);
  
  // Check if student is already marked present
  const isPresent = await checkStudentAttendance(exam.id, user.userId);
  // console.log(`📋 Attendance status: ${isPresent ? 'Present' : 'Not marked'}`);
  // console.log(`⚙️ Exam attendance required: ${exam.attendance}`);
  
  // If exam requires attendance and student is NOT present, block them
  if (exam.attendance === true && !isPresent) {
    // console.log('🚫 Blocking exam start - attendance required but student not marked present');
    onAttendanceWarning(exam);
    return;
  }
  
  // Auto-mark attendance if not already marked
  if (!isPresent) {
    // console.log('✍️ Auto-marking attendance for student...');
    try {
      await firebaseService.markOwnAttendance(
        exam.id, 
        {
          userId: user.userId,
          fullName: user.fullName,
          email: user.email,
          studentRoll: user.studentRoll,
          collegeId: exam.collegeId
        },
        ATTENDANCE_STATUS.PRESENT
      );
      // console.log('✅ Attendance auto-marked successfully for student:', user.fullName);
    } catch (error) {
      console.error('❌ Error auto-marking attendance:', error);
      // Continue anyway - don't block exam start
    }
  } else {
    // console.log('ℹ️ Student already marked present, skipping auto-mark');
  }
  
  // Proceed to exam
  // console.log('🎯 Proceeding to exam interface...');
  onProceed();
}

// Function to handle pre-exam face verification
function triggerPreExamVerification(
  exam: any,
  user: UserModel | null,
  _onVerificationSuccess: () => void,
  _onVerificationCancel: () => void,
  setShowPreExamVerification: (show: boolean) => void,
  setPendingExam: (exam: any) => void,
  setActiveExam: (exam: any) => void,
  setShowExamInterface: (show: boolean) => void
) {
  // ✅ CHECK: If proctoring is NOT enabled, skip verification and go directly to exam
  if (exam.avProctoring !== true) {
    // console.log('ℹ️ Proctoring not enabled - requesting fullscreen and starting exam');
    
    // ✅ Request fullscreen IMMEDIATELY (synchronous call in user gesture context)
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => {
        // console.log('✅ Fullscreen activated');
      }).catch((_err) => {
        // console.warn('⚠️ Fullscreen failed:', err);
      });
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).mozRequestFullScreen) {
      (elem as any).mozRequestFullScreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }
    
    // Start exam immediately (don't wait for fullscreen promise)
    setActiveExam(exam);
    setShowExamInterface(true);
    return;
  }

  // Proctoring IS enabled - check if user has proctoring photos
  if (!user?.proctoringPhotos?.front || !user?.proctoringPhotos?.left || !user?.proctoringPhotos?.right) {
    console.error('❌ Proctoring photos missing - cannot verify identity');
    alert('Please complete ID verification in your profile before taking the exam.');
    return;
  }

  // Set pending exam and show verification
  setPendingExam(exam);
  setShowPreExamVerification(true);
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

// Countdown Timer Hook
function useCountdown(targetDate: Date) {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  useEffect(() => {
    const calculateCountdown = () => {
      // Get current time in IST
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const now = nowIST.getTime();
      
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true
        });
        return;
      }

      setCountdown({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
        isExpired: false
      });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return countdown;
}

// Countdown Timer Component
function CountdownTimer({ examDate, examTime, brandTheme }: { examDate: string; examTime?: string; brandTheme: any }) {
  const targetDate = useMemo(() => {
    const date = new Date(examDate);
    if (examTime) {
      const [hours, minutes] = examTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    } else {
      // If no time specified, count down to start of exam day
      date.setHours(0, 0, 0, 0);
    }
    return date;
  }, [examDate, examTime]);

  const countdown = useCountdown(targetDate);


  if (countdown.isExpired) {
    return null;
  }

  return (
    <div className="mt-6 mb-4">
      <div className="text-center mb-3">
        <span className="text-sm font-medium text-gray-600">Exam starts in</span>
      </div>
      
      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border-2 border-purple-200 shadow-sm">
          <div className="text-2xl font-bold text-purple-700 mb-1">
            {countdown.days.toString().padStart(2, '0')}
          </div>
          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
            Days
          </div>
        </div>

        <div className="rounded-xl p-3 border-2 shadow-sm"
          style={{
            background: `linear-gradient(to bottom right, ${brandTheme.colors.primary}10, ${brandTheme.colors.secondary}10)`,
            borderColor: `${brandTheme.colors.primary}30`
          }}>
          <div className="text-2xl font-bold mb-1"
            style={{ color: brandTheme.colors.primary }}>
            {countdown.hours.toString().padStart(2, '0')}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: brandTheme.colors.primary }}>
            Hours
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-3 border-2 border-orange-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-700 mb-1">
            {countdown.minutes.toString().padStart(2, '0')}
          </div>
          <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
            Minutes
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border-2 border-green-200 shadow-sm">
          <div className="text-2xl font-bold text-green-700 mb-1">
            {countdown.seconds.toString().padStart(2, '0')}
          </div>
          <div className="text-xs font-semibold text-green-600 uppercase tracking-wide">
            Seconds
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate remaining time until exam ends
function useRemainingTime(examDate: string, examTime: string | undefined, duration: string, likertDuration?: number) {
  const [remaining, setRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  useEffect(() => {
    const calculateRemaining = () => {
      // Create exam start time in IST
      const startTimeIST = new Date(examDate);
      if (examTime) {
        const [hours, minutes] = examTime.split(':').map(Number);
        startTimeIST.setHours(hours, minutes, 0, 0);
      } else {
        startTimeIST.setHours(0, 0, 0, 0);
      }

      // Calculate end time in IST using total duration
      const totalDurationMinutes = (parseInt(duration) || 0) + (likertDuration || 0);
      const endTimeIST = new Date(startTimeIST.getTime() + totalDurationMinutes * 60 * 1000);

      // Get current time in IST
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      const now = nowIST.getTime();
      const end = endTimeIST.getTime();
      const difference = end - now;

      if (difference < 0) {
        setRemaining({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      setRemaining({
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        isExpired: false
      });
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);

    return () => clearInterval(interval);
  }, [examDate, examTime, duration]);

  return remaining;
}

// Proctoring Setup Dialog Component
function ProctoringSetupDialog({
  exam,
  user,
  brandTheme,
  onClose,
  onProceed,
  onRefreshUser,
  cameraStatus,
  audioStatus,
  onCameraStatusChange,
  onAudioStatusChange,
  mediaStream,
  onMediaStreamChange
}: {
  exam: any;
  user: UserModel | null;
  brandTheme: any;
  onClose: () => void;
  onProceed: () => void;
  onNavigateToProfile?: () => void;
  onRefreshUser?: () => Promise<void>;
  cameraStatus: 'checking' | 'granted' | 'denied' | 'error';
  audioStatus: 'checking' | 'granted' | 'denied' | 'error';
  onCameraStatusChange: (status: 'checking' | 'granted' | 'denied' | 'error') => void;
  onAudioStatusChange: (status: 'checking' | 'granted' | 'denied' | 'error') => void;
  mediaStream: MediaStream | null;
  onMediaStreamChange: (stream: MediaStream | null) => void;
}) {
  const [, setIsCheckingPermissions] = useState(true);
  const [proctoringPhotosStatus, setProctoringPhotosStatus] = useState<'checking' | 'complete' | 'incomplete'>('checking');
  const [missingPhotos, setMissingPhotos] = useState<string[]>([]);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [permissionHelpMessage, setPermissionHelpMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Just set photo status immediately - no checking needed
    if (user) {
      const missing: string[] = [];
      if (!user.proctoringPhotos?.front) missing.push('Front Face');
      if (!user.proctoringPhotos?.left) missing.push('Left Side');
      if (!user.proctoringPhotos?.right) missing.push('Right Side');
      
      setMissingPhotos(missing);
      setProctoringPhotosStatus(missing.length === 0 ? 'complete' : 'incomplete');
    }
    setIsCheckingPermissions(false);
  }, [user]);

  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const checkPermissionsAndPhotos = async () => {
    setIsCheckingPermissions(true);
    
    // Check proctoring photos
    if (user) {
      // console.log('🔍 Checking proctoring photos for user:', user.userId);
      // console.log('📸 Proctoring photos data:', user.proctoringPhotos);
      // console.log('📸 Front photo URL:', user.proctoringPhotos?.front);
      // console.log('📸 Left photo URL:', user.proctoringPhotos?.left);
      // console.log('📸 Right photo URL:', user.proctoringPhotos?.right);
      
      const missing: string[] = [];
      
      // Simple check - just verify URLs exist
      if (!user.proctoringPhotos?.front) missing.push('Front Face');
      if (!user.proctoringPhotos?.left) missing.push('Left Side');
      if (!user.proctoringPhotos?.right) missing.push('Right Side');
      
      // console.log('📋 Missing photos:', missing);
      
      setMissingPhotos(missing);
      setProctoringPhotosStatus(missing.length === 0 ? 'complete' : 'incomplete');
      
      // console.log('✅ Photo status set to:', missing.length === 0 ? 'complete' : 'incomplete');
    } else {
      // console.warn('⚠️ No user provided for photo check');
    }
    
    // Only check camera/audio permissions if status is still 'checking'
    // If already granted/denied, skip the permission request
    if (cameraStatus === 'checking' && audioStatus === 'checking') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        onMediaStreamChange(stream);
        onCameraStatusChange('granted');
        onAudioStatusChange('granted');
      } catch (error: any) {
        console.error('Media permission error:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          onCameraStatusChange('denied');
          onAudioStatusChange('denied');
        } else {
          onCameraStatusChange('error');
          onAudioStatusChange('error');
        }
      }
    } else {
      // console.log('✅ Using existing permission status - camera:', cameraStatus, 'audio:', audioStatus);
    }
    
    setIsCheckingPermissions(false);
  };

  const requestPermissions = async () => {
    try {
      // Stop any existing streams first
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        onMediaStreamChange(null);
      }
      
      onCameraStatusChange('checking');
      onAudioStatusChange('checking');
      setShowPermissionHelp(false); // Hide help when retrying
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      onMediaStreamChange(stream);
      onCameraStatusChange('granted');
      onAudioStatusChange('granted');
    } catch (error: any) {
      console.error('Failed to get media permissions:', error);
      
      // If it's NotAllowedError, permissions are blocked in browser settings
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        onCameraStatusChange('denied');
        onAudioStatusChange('denied');
        setPermissionHelpMessage('blocked');
        setShowPermissionHelp(true);
      } else if (error.name === 'NotFoundError') {
        // No camera/microphone found
        onCameraStatusChange('error');
        onAudioStatusChange('error');
        setPermissionHelpMessage('notfound');
        setShowPermissionHelp(true);
      } else {
        // Other errors (device in use, etc.)
        onCameraStatusChange('error');
        onAudioStatusChange('error');
        setPermissionHelpMessage('inuse');
        setShowPermissionHelp(true);
      }
    }
  };

  const canProceed = 
    cameraStatus === 'granted' && 
    audioStatus === 'granted' && 
    proctoringPhotosStatus === 'complete';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
          title="Close"
        >
          <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="p-6 pt-12">
          {/* Show Permission Help Screen OR Main Setup Screen */}
          {showPermissionHelp ? (
            /* Permission Help Screen */
            <>
              {/* Title Section */}
              <div className="text-center mb-6">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ 
                    background: permissionHelpMessage === 'blocked' 
                      ? 'linear-gradient(135deg, #FCA5A5 0%, #EF4444 100%)'
                      : 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
                    boxShadow: permissionHelpMessage === 'blocked'
                      ? '0 8px 32px rgba(239, 68, 68, 0.3)'
                      : '0 8px 32px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {permissionHelpMessage === 'blocked' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    )}
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {permissionHelpMessage === 'blocked' && '🔒 Camera/Microphone Blocked'}
                  {permissionHelpMessage === 'notfound' && '❌ Device Not Found'}
                  {permissionHelpMessage === 'inuse' && '⚠️ Device In Use'}
                  {permissionHelpMessage === 'uploadphotos' && '📸 Upload Proctoring Photos'}
                </h2>
                <p className="text-gray-600 text-sm">
                  {permissionHelpMessage === 'blocked' && 'Permissions are blocked in your browser'}
                  {permissionHelpMessage === 'notfound' && 'No camera or microphone detected'}
                  {permissionHelpMessage === 'inuse' && 'Device may be in use by another application'}
                  {permissionHelpMessage === 'uploadphotos' && 'Please upload your proctoring photos first'}
                </p>
              </div>

              {/* Help Content */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 mb-6 border border-blue-200">
                {permissionHelpMessage === 'blocked' && (
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Click the lock or camera icon</p>
                        <p className="text-sm text-gray-700">Look for the 🔒 or 🎥 icon in your browser's address bar (top left)</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Change permissions to "Allow"</p>
                        <p className="text-sm text-gray-700">Select "Allow" for both Camera and Microphone</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Reload the page</p>
                        <p className="text-sm text-gray-700">Click the "Reload Page" button below to apply changes</p>
                      </div>
                    </div>
                  </div>
                )}

                {permissionHelpMessage === 'notfound' && (
                  <div className="space-y-3">
                    <p className="text-gray-800 font-semibold">No camera or microphone was detected on your device.</p>
                    <div className="text-sm text-gray-700 space-y-2">
                      <p>• Make sure your camera and microphone are properly connected</p>
                      <p>• Check if your device has a built-in camera and microphone</p>
                      <p>• Try unplugging and reconnecting external devices</p>
                      <p>• Restart your browser after connecting devices</p>
                    </div>
                  </div>
                )}

                {permissionHelpMessage === 'inuse' && (
                  <div className="space-y-3">
                    <p className="text-gray-800 font-semibold">Your camera or microphone is currently in use by another application.</p>
                    <div className="text-sm text-gray-700 space-y-2">
                      <p>• Close other video conferencing apps (Zoom, Teams, etc.)</p>
                      <p>• Close other browser tabs that might be using the camera</p>
                      <p>• Restart your browser if the issue persists</p>
                    </div>
                  </div>
                )}
                
                {permissionHelpMessage === 'uploadphotos' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
                      <p className="text-sm text-amber-900 font-semibold mb-2">⚠️ Required Photos Missing:</p>
                      <ul className="text-sm text-amber-800 space-y-1 ml-4">
                        {missingPhotos.map((photo, index) => (
                          <li key={index} className="list-disc">{photo}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Click your profile icon</p>
                        <p className="text-sm text-gray-700">Located in the top-right corner of the page</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Go to "Profile Settings"</p>
                        <p className="text-sm text-gray-700">Select Profile Settings from the dropdown menu</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Upload Proctoring Photos</p>
                        <p className="text-sm text-gray-700">Find the "Proctoring Photos" section and upload all 3 photos (Front Face, Left Side, Right Side)</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-1">Return and try again</p>
                        <p className="text-sm text-gray-700">Come back to this exam and click "Start Exam" again</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPermissionHelp(false)}
                  className="flex-1 py-3 text-gray-700 font-semibold rounded-xl border-2 border-gray-300 hover:bg-gray-50 transition"
                >
                  ← Back
                </button>
                {permissionHelpMessage === 'blocked' ? (
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 py-3 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    🔄 Reload Page
                  </button>
                ) : permissionHelpMessage === 'uploadphotos' ? (
                  <button
                    onClick={async () => {
                      // console.log('🔄 Check Again button clicked');
                      setIsRefreshing(true);
                      
                      try {
                        // Refresh user data first
                        // console.log('📥 Refreshing user data...');
                        if (onRefreshUser) {
                          await onRefreshUser();
                          // console.log('✅ User data refreshed');
                        }
                        
                        // Then recheck photos
                        // console.log('🔍 Rechecking photos...');
                        setShowPermissionHelp(false);
                        await checkPermissionsAndPhotos();
                        // console.log('✅ Photos rechecked');
                      } catch (error) {
                        console.error('❌ Error during refresh:', error);
                      } finally {
                        setIsRefreshing(false);
                      }
                    }}
                    disabled={isRefreshing}
                    className="flex-1 py-3 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    {isRefreshing ? '🔄 Checking...' : '✓ I\'ve Uploaded - Check Again'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowPermissionHelp(false);
                      requestPermissions();
                    }}
                    className="flex-1 py-3 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    Try Again
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Main Setup Screen */
            <>
          <div className="text-center mb-6">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ 
                background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)'
              }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              A/V Proctoring Setup Required
            </h2>
            <p className="text-gray-600 text-sm">
              This exam requires audio & video monitoring. Please complete the setup below.
            </p>
          </div>

          {/* Exam Details */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6 border border-purple-200">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: brandTheme.gradients.primary }}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{exam.title}</p>
                <p className="text-xs text-gray-600">{exam.class} • {exam.subject}</p>
              </div>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div className="space-y-4 mb-6">
            {/* Camera Permission */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    cameraStatus === 'granted' ? 'bg-green-100' :
                    cameraStatus === 'denied' || cameraStatus === 'error' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-5 h-5 ${
                      cameraStatus === 'granted' ? 'text-green-600' :
                      cameraStatus === 'denied' || cameraStatus === 'error' ? 'text-red-600' : 'text-gray-400'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Camera Access</p>
                    <p className="text-xs text-gray-600">
                      {cameraStatus === 'checking' && 'Checking permission...'}
                      {cameraStatus === 'granted' && 'Permission granted'}
                      {cameraStatus === 'denied' && 'Permission denied - Click "Grant Access" or check browser settings'}
                      {cameraStatus === 'error' && 'Error accessing camera - May be in use by another app'}
                    </p>
                  </div>
                </div>
                {cameraStatus === 'granted' ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : cameraStatus === 'denied' || cameraStatus === 'error' ? (
                  <button
                    onClick={requestPermissions}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition"
                  >
                    Grant Access
                  </button>
                ) : null}
              </div>
            </div>

            {/* Audio Permission */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    audioStatus === 'granted' ? 'bg-green-100' :
                    audioStatus === 'denied' || audioStatus === 'error' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-5 h-5 ${
                      audioStatus === 'granted' ? 'text-green-600' :
                      audioStatus === 'denied' || audioStatus === 'error' ? 'text-red-600' : 'text-gray-400'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Microphone Access</p>
                    <p className="text-xs text-gray-600">
                      {audioStatus === 'checking' && 'Checking permission...'}
                      {audioStatus === 'granted' && 'Permission granted'}
                      {audioStatus === 'denied' && 'Permission denied - Click "Grant Access" or check browser settings'}
                      {audioStatus === 'error' && 'Error accessing microphone - May be in use by another app'}
                    </p>
                  </div>
                </div>
                {audioStatus === 'granted' ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : audioStatus === 'denied' || audioStatus === 'error' ? (
                  <button
                    onClick={requestPermissions}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition"
                  >
                    Grant Access
                  </button>
                ) : null}
              </div>
            </div>

            {/* Proctoring Photos */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    proctoringPhotosStatus === 'complete' ? 'bg-green-100' :
                    proctoringPhotosStatus === 'incomplete' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-5 h-5 ${
                      proctoringPhotosStatus === 'complete' ? 'text-green-600' :
                      proctoringPhotosStatus === 'incomplete' ? 'text-red-600' : 'text-gray-400'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">Proctoring Photos</p>
                    <p className="text-xs text-gray-600">
                      {proctoringPhotosStatus === 'checking' && 'Checking photos...'}
                      {proctoringPhotosStatus === 'complete' && 'All photos uploaded'}
                      {proctoringPhotosStatus === 'incomplete' && `Missing: ${missingPhotos.join(', ')}`}
                    </p>
                  </div>
                </div>
                {proctoringPhotosStatus === 'complete' ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : proctoringPhotosStatus === 'incomplete' ? (
                  <button
                    onClick={() => {
                      // Show help about uploading photos
                      setPermissionHelpMessage('uploadphotos');
                      setShowPermissionHelp(true);
                    }}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition whitespace-nowrap"
                  >
                    Upload Photos
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Camera Preview */}
          {mediaStream && cameraStatus === 'granted' && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-900 mb-2">Camera Preview</p>
              <div className="relative rounded-xl overflow-hidden bg-gray-900">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>LIVE</span>
                </div>
              </div>
            </div>
          )}

          {/* Warning Message if requirements not met */}
          {!canProceed && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900 mb-1">
                    Cannot Start Exam Yet
                  </p>
                  <p className="text-xs text-red-800 leading-relaxed">
                    This exam requires A/V proctoring. Please complete all requirements above before you can proceed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-gray-700 font-semibold rounded-xl border-2 border-gray-300 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              disabled={!canProceed}
              className={`flex-1 py-3 text-white font-semibold rounded-xl shadow-lg transition ${
                canProceed
                  ? 'hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ 
                background: canProceed ? brandTheme.gradients.primary : '#9CA3AF'
              }}
            >
              {canProceed ? 'Continue to Exam' : 'Complete Setup First'}
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// Live Exam Interface Component
function LiveExamInterface({ 
  selectedExam, 
  currentUser, 
  brandTheme,
  onEnterExam
}: { 
  selectedExam: any; 
  currentUser: any;
  brandTheme: any;
  onEnterExam: () => void;
}) {
  // No artificial loading needed — parent already shows spinner via isLoadingExamDetail
  const userRole = currentUser?.userType || 'student';
  const isTeacher = ['admin', 'principal', 'dean', 'teacher', 'system_admin'].includes(userRole);
  const remaining = useRemainingTime(selectedExam.examDate, selectedExam.examTime, selectedExam.duration, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0);

  // Compute personality flags
  const hasRegularQuestionsLive = (selectedExam.questionsList?.length || 0) > 0;
  const hasPoolLive = (selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0;
  const hasPersonality = !!selectedExam.personalityAssessment && (selectedExam.likertQuestions?.length || 0) > 0;
  const isPersonalityOnly = hasPersonality && !hasRegularQuestionsLive && !hasPoolLive;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 50%, #faf8ff 100%)' }}>
      {/* Hero Header */}
      <div className="relative border-b border-gray-200" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 50%, #faf8ff 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #818cf8, transparent)', transform: 'translate(-30%, 30%)' }} />
        
        <div className="relative px-8 py-6">
          {/* Top row: Live badge + Timer */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </div>
              <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Live Now</span>
            </div>
            
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl border ${remaining.isExpired ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
              <svg className={`w-4 h-4 ${remaining.isExpired ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`text-xs font-medium ${remaining.isExpired ? 'text-red-600' : 'text-blue-600'}`}>{remaining.isExpired ? 'Ended' : 'Remaining:'}</span>
              <span className={`text-sm font-bold font-mono ${remaining.isExpired ? 'text-red-800' : 'text-blue-900'}`}>
                {remaining.hours.toString().padStart(2, '0')}:{remaining.minutes.toString().padStart(2, '0')}:{remaining.seconds.toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Exam Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-1 leading-tight">{selectedExam.title}</h1>
          <p className="text-gray-500 text-sm">
            {isTeacher ? 'Monitor and manage the live exam' : (
              <>Started at: {formatExamDate(selectedExam.examDate)}{selectedExam.examTime && <>, {formatExamTime(selectedExam.examTime || '')}</>}</>
            )}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6 max-w-3xl mx-auto">

        {/* Stats Cards */}
        <div className={`grid gap-3 mb-6 ${isPersonalityOnly ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {/* Questions */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
                <FontAwesomeIcon icon={faCircleQuestion} className="text-cyan-600 text-xs" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Questions</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{selectedExam.totalQuestions || 0}</div>
            {hasPersonality && selectedExam.likertQuestions?.length > 0 && (
              <div className="text-[10px] text-violet-500 font-medium mt-1">
                {isPersonalityOnly
                  ? `${selectedExam.likertQuestions.length} personality`
                  : `+${selectedExam.likertQuestions.length} personality`
                }
              </div>
            )}
          </div>

          {/* Max Marks — hidden if personality-only */}
          {!isPersonalityOnly && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                  <FontAwesomeIcon icon={faStar} className="text-orange-500 text-xs" />
                </div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Max Marks</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{selectedExam.maxMarks || selectedExam.totalQuestions || 0}</div>
            </div>
          )}

          {/* Duration */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                <FontAwesomeIcon icon={faClock} className="text-green-600 text-xs" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Duration</span>
            </div>
            <div className="text-lg font-bold text-gray-900 leading-tight">{formatDuration((parseInt(selectedExam.duration) || 0) + (hasPersonality ? (selectedExam.likertDuration || 0) : 0))}</div>
            {hasPersonality && !isPersonalityOnly && selectedExam.likertDuration > 0 && (
              <div className="text-[10px] text-violet-500 font-medium mt-1">
                {`+${selectedExam.likertDuration}m personality`}
              </div>
            )}
          </div>

          {/* Exam ID */}
          {selectedExam.id && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FontAwesomeIcon icon={faTag} className="text-blue-600 text-xs" />
                </div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Exam ID</span>
              </div>
              <div className="text-sm font-bold text-gray-900 truncate" title={selectedExam.id}>{selectedExam.id}</div>
            </div>
          )}
        </div>

        {/* Personality Assessment Info Card */}
        {hasPersonality && (
          <div className="mb-5 rounded-2xl overflow-hidden border border-violet-200 shadow-sm">
            {/* Header */}
            <div className="px-5 py-3.5 flex items-center space-x-3" style={{ background: brandTheme.gradients.primary }}>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isPersonalityOnly ? 'Personality Assessment' : 'Includes Personality Assessment'}
                </h3>
                <p className="text-[11px] text-violet-200">
                  {isPersonalityOnly
                    ? 'This assessment measures personality traits — there are no right or wrong answers'
                    : 'This exam includes a personality section alongside graded questions'
                  }
                </p>
              </div>
            </div>
            {/* Details */}
            <div className="bg-violet-50 px-5 py-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-violet-700">{selectedExam.likertQuestions?.length || 0}</div>
                  <div className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">Statements</div>
                </div>
                {selectedExam.likertDuration > 0 && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-violet-700">{selectedExam.likertDuration}m</div>
                    <div className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">Time Allotted</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-lg font-bold text-violet-700">No</div>
                  <div className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">Right/Wrong</div>
                </div>
              </div>
              <div className="bg-white rounded-xl px-4 py-3 border border-violet-100">
                <p className="text-xs text-gray-600 leading-relaxed">
                  You will be shown a series of statements. Rate how strongly you agree or disagree with each one — <span className="font-semibold text-violet-700">respond honestly</span> based on how you actually think and feel. Your personality profile will be generated from these responses.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
          <div className="px-5 py-3.5 flex items-center space-x-2.5 border-b border-gray-50" style={{ background: isTeacher ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : 'linear-gradient(135deg, #fff7ed, #fef3c7)' }}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isTeacher ? 'bg-amber-400' : 'bg-orange-400'}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-amber-900">
              {isTeacher ? 'Teacher Instructions' : 'Important Instructions'}
            </h3>
          </div>
          <div className="px-5 py-4">
            <div className="space-y-2.5">
              {isTeacher ? (
                <>
                  {[
                    'Monitor student attendance and submissions in real-time via Live Stats',
                    'You can enter the exam to preview questions and verify content',
                    'Student progress and scores will be visible after exam completion',
                    'Use Attendance tab to mark present students manually if needed',
                    "Your entry won't affect student access or exam results",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start space-x-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-amber-600 text-[10px] font-bold">{i + 1}</span>
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">{text}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { label: 'Mark Attendance', text: 'Your attendance will be recorded when you enter the exam', warn: false },
                    { label: 'Read Carefully', text: 'Review all questions before starting to answer', warn: false },
                    { label: 'Negative Marking', text: 'MCQ questions have negative marking — wrong answers will deduct marks', warn: true },
                    { label: 'Save Progress', text: 'Your answers are auto-saved, but submit manually to be safe', warn: false },
                    { label: 'Stable Connection', text: selectedExam.mode === EXAM_MODES.ONLINE ? 'Keep a strong internet connection throughout the exam' : 'Ensure internet connectivity for submitting answers', warn: false },
                    { label: 'Time Management', text: 'Monitor the countdown timer and submit before time expires', warn: false },
                    { label: 'Academic Integrity', text: 'Complete the exam independently without external assistance', warn: false },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-start space-x-2.5 p-2.5 rounded-xl ${item.warn ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.warn ? 'bg-red-100' : 'bg-orange-100'}`}>
                        {item.warn
                          ? <span className="text-red-600 text-[10px] font-bold">!</span>
                          : <span className="text-orange-600 text-[10px] font-bold">{i + 1}</span>
                        }
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">
                        <strong className={`font-semibold ${item.warn ? 'text-red-700' : 'text-gray-900'}`}>{item.label}:</strong> {item.text}
                      </span>
                    </div>
                  ))}
                  {selectedExam.securityLevel === SECURITY_LEVELS.SECURE && (
                    <div className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-red-50 border border-red-100">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-red-600 text-[10px] font-bold">!</span>
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">
                        <strong className="font-semibold text-red-700">Secure Mode:</strong> Tab switching and external tools may be monitored
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Enter Exam Button */}
        <div className="flex flex-col items-center space-y-3 pb-6">
          <button
            onClick={onEnterExam}
            className="w-full max-w-xs py-4 rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3"
            style={{ background: brandTheme.gradients.primary, color: 'white' }}
          >
            <span>{isTeacher ? 'Enter Exam' : 'Start Exam'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="text-xs text-gray-400 text-center max-w-sm leading-relaxed">
            {isTeacher
              ? '💼 You have monitoring access to track student progress and ensure exam integrity'
              : '🌟 Best wishes! Stay focused, manage your time, and give your best effort'
            }
          </p>
          {!isTeacher && (
            <p className="text-xs text-gray-400 text-center">
              💡 Tip: If you face any technical issues, contact your instructor immediately
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Initialize Firebase at module level (runs once when module loads)
firebaseService.initialize(firebaseConfig, firestoreDbName);

// Logo Component - EXAMINERS AI Evaluation Theme
function Logo({ size = 'medium', showText = true, brand, collegeName }: { size?: 'small' | 'medium' | 'large', showText?: boolean, brand: any, collegeName?: string }) {
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-14 h-14'
  };
  
  const mainTextSizes = {
    small: 'text-base',
    medium: 'text-xl',
    large: 'text-2xl'
  };
  
  const subTextSizes = {
    small: 'text-[10px]',
    medium: 'text-xs',
    large: 'text-sm'
  };
  
  return (
    <div className="flex items-center space-x-3">
      <div 
        className={`${sizeClasses[size]} rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden group`}
        style={{ background: brand.gradients.primary }}
      >
        {/* Animated background pulse */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent animate-pulse"></div>
        
        {/* Central Document with AI pattern */}
        <div className="relative z-10">
          <div className="relative">
            {/* Paper sheet - scaled for different sizes */}
            <div className={`bg-white rounded shadow-md relative transform group-hover:scale-110 transition-transform duration-300 ${
              size === 'small' ? 'p-1.5' : size === 'medium' ? 'p-2' : 'p-2.5'
            }`}>
              {/* Document lines - uses brand colors */}
              <div className="space-y-0.5">
                <div className={`rounded-full ${
                  size === 'small' ? 'h-0.5 w-3' : size === 'medium' ? 'h-0.5 w-4' : 'h-1 w-5'
                }`} style={{ background: `linear-gradient(to right, ${brand.colors.primary}, ${brand.colors.secondary})` }}></div>
                <div className={`rounded-full ${
                  size === 'small' ? 'h-0.5 w-2' : size === 'medium' ? 'h-0.5 w-3' : 'h-1 w-4'
                }`} style={{ background: `linear-gradient(to right, ${brand.colors.secondary}, ${brand.colors.accent})` }}></div>
                <div className={`rounded-full ${
                  size === 'small' ? 'h-0.5 w-2.5' : size === 'medium' ? 'h-0.5 w-3.5' : 'h-1 w-4.5'
                }`} style={{ background: `linear-gradient(to right, ${brand.colors.accent}, ${brand.colors.primary})` }}></div>
              </div>
              
              {/* AI Checkmark overlay */}
              <div className={`absolute bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md ${
                size === 'small' ? '-top-1 -right-1 w-3 h-3' : size === 'medium' ? '-top-1 -right-1 w-3.5 h-3.5' : '-top-1.5 -right-1.5 w-4 h-4'
              }`}>
                <svg 
                  width={size === 'small' ? '8' : size === 'medium' ? '9' : '10'} 
                  height={size === 'small' ? '8' : size === 'medium' ? '9' : '10'} 
                  viewBox="0 0 12 12" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            
            {/* AI Neural nodes */}
            <div className={`absolute bg-blue-400 rounded-full animate-pulse ${
              size === 'small' ? '-top-0.5 -left-0.5 w-1 h-1' : size === 'medium' ? '-top-1 -left-1 w-1.5 h-1.5' : '-top-1 -left-1 w-2 h-2'
            }`}></div>
            <div className={`absolute bg-purple-400 rounded-full animate-pulse ${
              size === 'small' ? '-bottom-0.5 -right-0.5 w-1 h-1' : size === 'medium' ? '-bottom-1 -right-1 w-1.5 h-1.5' : '-bottom-1 -right-1 w-2 h-2'
            }`} style={{animationDelay: '0.3s'}}></div>
          </div>
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`${mainTextSizes[size]} font-bold text-gray-900 leading-tight`}>
            EXAMINERS
          </span>
          {collegeName && (
            <span className={`${subTextSizes[size]} text-gray-500 leading-tight`}>
              {collegeName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Safe value renderer - converts objects to strings to prevent React errors
function safeRender(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    // If it's an object, try to extract meaningful data or return empty string
    if (value.toString && value.toString !== Object.prototype.toString) {
      return value.toString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}

// Static data - moved outside component to prevent recreation on every render
const priorityOptions = [
  { value: 'low' as const, label: 'Low', icon: faCircle, color: 'text-green-700' },
  { value: 'medium' as const, label: 'Medium', icon: faCircle, color: 'text-yellow-700' },
  { value: 'high' as const, label: 'High', icon: faCircle, color: 'text-red-700' }
];

const categoryOptions = [
  { value: 'general' as const, label: 'General', icon: faBullhorn },
  { value: 'academic' as const, label: 'Academic', icon: faBooks },
  { value: 'administrative' as const, label: 'Administrative', icon: faClipboardList },
  { value: 'event' as const, label: 'Event', icon: faPartyHorn }
];

const audienceOptions = [
  { value: 'all' as const, label: 'All Audiences', icon: faUsers },
  { value: 'system_admin' as const, label: 'System Admins', icon: faGear },
  { value: 'admin' as const, label: 'College Admins', icon: faUserTie },
  { value: 'principal' as const, label: 'Principals', icon: faGraduationCap },
  { value: 'dean' as const, label: 'Deans', icon: faBooks },
  { value: 'teacher' as const, label: 'Teachers', icon: faChalkboardUser },
  { value: 'student' as const, label: 'Students', icon: faBackpack }
];

const getSectionBg = (section?: string) => {
  if (section === SECTION_CATEGORIES.MANAGEMENT) return 'bg-orange-100';
  if (section === SECTION_CATEGORIES.ACADEMIC) return 'bg-blue-100';
  if (section === SECTION_CATEGORIES.ANALYTICS) return 'bg-emerald-100';
  if (section === SECTION_CATEGORIES.MEMBERS) return 'bg-purple-50';
  if (section === SECTION_CATEGORIES.ACTIVITY) return 'bg-pink-50';
  if (section === SECTION_CATEGORIES.RESOURCES) return 'bg-cyan-50';
  if (section === 'tools') return 'bg-slate-100';
  return '';
};

const getSectionTextColor = (section?: string) => {
  if (section === SECTION_CATEGORIES.MANAGEMENT) return 'text-orange-700';
  if (section === SECTION_CATEGORIES.ACADEMIC) return 'text-blue-700';
  if (section === SECTION_CATEGORIES.ANALYTICS) return 'text-emerald-700';
  if (section === SECTION_CATEGORIES.MEMBERS) return 'text-purple-600';
  if (section === SECTION_CATEGORIES.ACTIVITY) return 'text-pink-600';
  if (section === SECTION_CATEGORIES.RESOURCES) return 'text-cyan-600';
  if (section === 'tools') return 'text-slate-700';
  return 'text-gray-700';
};

// Academic years - static data
const academicYears = ['all', '2025-26', '2026-27', '2027-28', '2028-29', '2029-30'];


function AppRouter() {
  // Public route: Certificate verification (no login required)
  if (window.location.pathname.startsWith('/verify')) {
    return <CertificateVerify />;
  }
  return <App />;
}

function App() {
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [profileInitialView, setProfileInitialView] = useState<'profile' | 'leetcode'>('profile');
  const [presentStudents, setPresentStudents] = useState<any[]>([]);
  const [absentStudents, setAbsentStudents] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showAISupportAssistant, setShowAISupportAssistant] = useState(false);
  const [showLearning, setShowLearning] = useState(true);
  const [learningActiveMenu, setLearningActiveMenu] = useState<string>('courses');
  
  // Course Curriculum Page State
  const [showCourseCurriculum, setShowCourseCurriculum] = useState(false);
  const [courseCurriculumData, setCourseCurriculumData] = useState<{
    courseName: string;
    courseSlug: string;
    curriculumData: any[];
    isLoading: boolean;
    enrollmentId?: string;
    initialLectureId?: number;
  }>({ courseName: '', courseSlug: '', curriculumData: [], isLoading: false });
  const [showProblemsListModal, setShowProblemsListModal] = useState(false);
  const [selectedProblemSlug, setSelectedProblemSlug] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  const [selectedQuestionType, setSelectedQuestionType] = useState<'all' | 'mcq' | 'fitb' | 'descriptive' | 'jumbled' | 'code' | 'sql'>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [questionsRefreshKey, setQuestionsRefreshKey] = useState(0);
  const [examsRefreshKey, setExamsRefreshKey] = useState(0);
  const [usersRefreshTrigger, setUsersRefreshTrigger] = useState(0);
  const [newlyCreatedExamId, setNewlyCreatedExamId] = useState<string | null>(null);
  const [isSelectedExamSubmitted, setIsSelectedExamSubmitted] = useState(false); // ✅ Track if student submitted selected exam
  const [showExitDialog, setShowExitDialog] = useState(false); // ✅ Custom exit confirmation dialog
  const [selectedClassForUsers, setSelectedClassForUsers] = useState<string | null>(null);
  const [isCreateQuestionModalOpen, setIsCreateQuestionModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreateLearningPathModalOpen, setIsCreateLearningPathModalOpen] = useState(false);
  const [highlightUserId, _setHighlightUserId] = useState<string | null>(null);
  const [isBulkUploadUsersOpen, setIsBulkUploadUsersOpen] = useState(false);

  const [selectedHallTicket, setSelectedHallTicket] = useState<any>(null);
  const [isCreateHallTicketModalOpen, setIsCreateHallTicketModalOpen] = useState(false);

  // Dynamic counts for menu
  const [examsCount, setExamsCount] = useState(0);
  const [resultsCount, setResultsCount] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [roomsCount, setRoomsCount] = useState(0);
  const [calendarEventsCount, setCalendarEventsCount] = useState(0); // Calendar events for selected day
  const [hallTicketsCount, setHallTicketsCount] = useState(0); // Active hall tickets count
  
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [userRequiringPasswordChange, setUserRequiringPasswordChange] = useState<UserModel | null>(null);
  const [loginIPInfo, setLoginIPInfo] = useState<LoginIPInfo | null>(null);
  const [showAttendanceWarningDialog, setShowAttendanceWarningDialog] = useState(false);
  const [pendingExamStart, setPendingExamStart] = useState<any>(null);
  const [showProctoringSetupDialog, setShowProctoringSetupDialog] = useState(false);
  const [pendingProctoringExam, setPendingProctoringExam] = useState<any>(null);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'error'>('checking');
  const [audioPermissionStatus, setAudioPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'error'>('checking');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  

const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
const [isBulkUploadRoomsOpen, setIsBulkUploadRoomsOpen] = useState(false);
const [isBulkUploadUniversityOpen, setIsBulkUploadUniversityOpen] = useState(false);
const [selectedRoom, setSelectedRoom] = useState<any>(null);
const [roomRefreshTrigger, setRoomRefreshTrigger] = useState(0);
const [selectedReport, setSelectedReport] = useState<any>(null);
const [reportRefreshTrigger, setReportRefreshTrigger] = useState(0);
const [selectedAuditUser, setSelectedAuditUser] = useState<UserModel | null>(null);
const [auditTrailInitializing, setAuditTrailInitializing] = useState(false);
  // ========== BRAND CONFIGURATION - INTELLIGENT SUBDOMAIN DETECTION ==========
  // Automatically detects subdomain and applies appropriate theme
  // Examples:
  //   - lpu.tutorialspoint.com → LPU Orange theme
  //   - dps.tutorialspoint.com → DPS Blue theme
  //   - tutorialspoint.com     → Default EXAMINERS theme
  
  const detectedSubdomain = getSubdomain();
  const [brandTheme, setBrandTheme] = useState(() => {
    const subdomainTheme = getThemeFromSubdomain();
    return subdomainTheme;
  });
  // ===========================================================================
  
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(window.innerWidth <= 1400);
  const [isLeftContentCollapsed, setIsLeftContentCollapsed] = useState(window.innerWidth <= 1400);
  const [isMainCollapsed, setIsMainCollapsed] = useState(false);
  const userInteractedLeft = useRef(false);
  const userInteractedMain = useRef(false);
  const [activeItem, setActiveItem] = useState('exams');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    management: false, // Always expanded
    tools: false,       // Expanded by default
  });
  
  const [_rightPanelWidth, setRightPanelWidth] = useState(380); // Default 380px
  const [actualRightWidth, _setActualRightWidth] = useState(0); // Actual rendered width
  const [isResizing, setIsResizing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [resultsResetKey] = useState(0);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  
  // Leaderboard filter data from college
  const [allYears, setAllYears] = useState<string[]>([]);
  const [allClasses, setAllClasses] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [showNoticeDialog, setShowNoticeDialog] = useState(false);
  
  // Notices state
  const [notices, setNotices] = useState<any[]>([]);
  const [isNoticesDropdownOpen, setIsNoticesDropdownOpen] = useState(false);
  const [noticesAnimatedIn, setNoticesAnimatedIn] = useState(false);
  const [noticesFilter, setNoticesFilter] = useState<'all' | 'unread'>('all');
  const [isLoadingNotices, setIsLoadingNotices] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [showNoticeDetailModal, setShowNoticeDetailModal] = useState(false);
  const [bellAnimation, setBellAnimation] = useState(false);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showDeleteExamDialog, setShowDeleteExamDialog] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [showRestrictionDialog, setShowRestrictionDialog] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState<{ 
    title: string; 
    message: string; 
    icon: string; 
    examDate?: string; 
    examTime?: string;
    hoursRemaining?: number;
  }>({ title: '', message: '', icon: '' });
  const [isViewingLiveStats, setIsViewingLiveStats] = useState(false);
  const [isViewingAttendance, setIsViewingAttendance] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<string | null>(null);
  
  // Custom notification dialog
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customDialogMessage, setCustomDialogMessage] = useState('');
  const [customDialogType, setCustomDialogType] = useState<'success' | 'error'>('success');
  
  // Login Details Dialog
   // Login Details Dialog
  const [showLoginDetailsDialog, setShowLoginDetailsDialog] = useState(false);
  const [loginDetailsAnimatedIn, setLoginDetailsAnimatedIn] = useState(false);

  useEffect(() => {
    if (showLoginDetailsDialog) {
      requestAnimationFrame(() => { requestAnimationFrame(() => setLoginDetailsAnimatedIn(true)); });
    } else {
      setLoginDetailsAnimatedIn(false);
    }
  }, [showLoginDetailsDialog]);
  
  // Secure Browser Download Modal
  const [showSecureBrowserModal, setShowSecureBrowserModal] = useState(false);
  const [secureBrowserAnimatedIn, setSecureBrowserAnimatedIn] = useState(false);

  useEffect(() => {
    if (showSecureBrowserModal) {
      requestAnimationFrame(() => { requestAnimationFrame(() => setSecureBrowserAnimatedIn(true)); });
    } else {
      setSecureBrowserAnimatedIn(false);
    }
  }, [showSecureBrowserModal]);

  
  // Exam Interface States
  const [showExamInterface, setShowExamInterface] = useState(false);
  const [activeExam, setActiveExam] = useState<any>(null);
  const [showPreExamVerification, setShowPreExamVerification] = useState(false);
  const [pendingExam, setPendingExam] = useState<any>(null);
  const [verifiedAudioDeviceId, setVerifiedAudioDeviceId] = useState<string>('');
  
  // Colleges state (for system admin)
  const [colleges, setColleges] = useState<Array<{id: string; name: string}>>([]);
  const [selectedCollege, setSelectedCollege] = useState<{id: string; name: string; academicYear?: string; academicYearStartMonth?: string} | null>(null);
  const [isCollegeDropdownOpen, setIsCollegeDropdownOpen] = useState(false);

  // Update brand theme dynamically when college is known
  useEffect(() => {
    if (!selectedCollege?.id || detectedSubdomain !== 'default') return;
    
    // console.log('🎨 [BRAND] Fetching brand profile for:', selectedCollege.id);
    firebaseService.getBrandProfile(selectedCollege.id).then(brandProfile => {
      if (brandProfile && brandProfile.primaryColor) {
        const dynamicTheme = generateThemeFromBrandProfile(brandProfile, selectedCollege.id);
        // console.log('🎨 [BRAND] Applying dynamic theme:', {
          // primary: dynamicTheme.colors.primary,
          // secondary: dynamicTheme.colors.secondary,
          // accent: dynamicTheme.colors.accent,
          // collegeName: dynamicTheme.collegeName
        // });
        setBrandTheme(dynamicTheme);
      } else {
        // console.log('🎨 [BRAND] No brand colors found for college:', selectedCollege.id);
      }
    }).catch((err) => { console.error('🎨 [BRAND] Error:', err); });
  }, [selectedCollege?.id]);

  // College data (boards, subjects, classes)
  const [collegeData, setCollegeData] = useState<{
    boards: string[];
    subjects: string[];
    classes: string[];
    features: string[];
  }>({
    boards: [],
    subjects: [],
    classes: [],
    features: []
  });
  
  // Helper function to collapse sidebar if screen is small
  const collapseIfSmallScreen = () => {
    if (window.innerWidth <= 1400) {
      userInteractedLeft.current = false;
      setIsLeftCollapsed(true);
      setIsLeftContentCollapsed(true);
    }
  };
  
  // Check for existing session on page load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const firebaseUser = await firebaseService.waitForAuthReady();
        if (firebaseUser?.email) {
          // Try direct doc read first (works for all users including students)
          let userData = await firebaseService.getUserById(firebaseUser.uid);
          // Fall back to email query if direct read fails
          if (!userData) {
            userData = await firebaseService.getUserByEmail(firebaseUser.email);
          }
          if (userData) {
            await handleLoginSuccess(userData);
          }
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    restoreSession();
  }, []);
  
  // Fetch colleges if system admin
  useEffect(() => {
    // Skip if colleges already loaded by handleLoginSuccess
    if (isAuthenticated && currentUser && firebaseService.isSystemAdmin(currentUser) && colleges.length === 0) {
      loadColleges();
    }
}, [isAuthenticated, currentUser]);

  // Check if user is using EXAMINERS Secure Browser (memoized to avoid re-running on every render)
  const MINIMUM_SECURE_VERSION = '1.1';
  const isSecureBrowser = useMemo(() => {
    const userAgent = navigator.userAgent;
    // console.log('🔍 User Agent:', userAgent);
    
    // Check for our custom user agent markers
    const hasMarkers = userAgent.includes('SecureEnvironment') && userAgent.includes('TutorialsPoint');
    if (!hasMarkers) {
      // console.log('🔒 Is Secure Browser: false (missing markers)');
      return false;
    }
    
    // Extract version from SecureEnvironment/X.X
    const versionMatch = userAgent.match(/SecureEnvironment\/(\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : '0.0';
    
    // Compare versions: split into major.minor and check >= minimum
    const [vMajor, vMinor] = version.split('.').map(Number);
    const [minMajor, minMinor] = MINIMUM_SECURE_VERSION.split('.').map(Number);
    const isVersionValid = vMajor > minMajor || (vMajor === minMajor && vMinor >= minMinor);
    
    // console.log(`🔒 Secure Browser version: ${version} (minimum: ${MINIMUM_SECURE_VERSION}) → ${isVersionValid ? 'ALLOWED' : 'OUTDATED'}`);
    
    return isVersionValid;
  }, []);
  
  const isUsingSecureBrowser = useCallback((): boolean => {
    return isSecureBrowser;
  }, [isSecureBrowser]);

  const handleDownload = async (platform: 'windows' | 'mac' | 'linux') => {
    try {
      const storage = getStorage();
      let fileName = '';
      
      switch(platform) {
        case 'windows':
          fileName = 'Installation/ExaminersSecureBrowser.exe';
          
          break;
        case 'mac':
          fileName = 'Installation/ExaminersSecureBrowser.dmg';
          break;
        case 'linux':
          fileName = 'Installation/ExaminersSecureBrowser.deb';
          break;
      }
      
      // console.log(`📥 Fetching ${platformName} installer URL...`);
      const downloadURL = await getDownloadURL(ref(storage, fileName));
      // console.log(`✅ ${platformName} URL obtained:`, downloadURL);
      
      // Open in new tab to avoid replacing current app
      window.open(downloadURL, '_blank');
      
      // console.log(`✅ ${platformName} download started`);
    } catch (error) {
      console.error(`❌ Error downloading ${platform} installer:`, error);
      alert(`Sorry, the ${platform} installer is not available at the moment. Please contact support.`);
    }
  };

  const handleDownloadGuide = async (guideName: string, displayName: string) => {
    try {
      const storage = getStorage();
      // console.log(`📥 Fetching ${displayName}...`);
      const downloadURL = await getDownloadURL(ref(storage, `Installation/${guideName}`));
      // console.log(`✅ ${displayName} URL obtained:`, downloadURL);
      window.open(downloadURL, '_blank');
      // console.log(`✅ ${displayName} download started`);
    } catch (error) {
      console.error(`❌ Error downloading ${displayName}:`, error);
      alert(`Sorry, the ${displayName} is not available at the moment. Please contact support.`);
    }
  };
  
  const loadColleges = async () => {
    try {
      // console.log('📋 Fetching all colleges...');
      const fetchedColleges = await firebaseService.getAllColleges();
      // console.log('📋 Fetched colleges:', fetchedColleges.length, fetchedColleges);
      
      const collegeList = fetchedColleges.map(c => ({
        id: c.collegeId,
        name: c.collegeName,
        academicYear: calculateAcademicYear(c.academicYear),
        academicYearStartMonth: c.academicYear
      }));
      
      // console.log('📋 College list formatted:', collegeList);
      setColleges(collegeList);
      
      // Auto-select first college
      if (collegeList.length > 0 && !selectedCollege) {
        // console.log('✅ Auto-selecting first college:', collegeList[0]);
        setSelectedCollege(collegeList[0]);
      } else {
        // console.log('⚠️ No colleges to auto-select or already selected:', selectedCollege);
      }
    } catch (error) {
      console.error('❌ Error loading colleges:', error);
    }
  };
  
  // Fetch college data (boards, subjects, classes) when active college changes (staff only)
  useEffect(() => {
    const fetchCollegeData = async () => {
      const collegeId = getActiveCollegeId();
      if (!collegeId) {
        setCollegeData({ boards: [], subjects: [], classes: [], features: [] });
        return;
      }
      
      // Students don't need college config data (boards, subjects, classes)
      if (currentUser?.userType === 'student') return;
      
      try {
        const data = await firebaseService.getCollegeById(collegeId);
        if (data) {
          setCollegeData({
            boards: data.supportedBoards || [],
            subjects: data.subjects || [],
            classes: data.validClasses || [],
            features: data.features || []
          });
          
          // Also set college filters (avoids separate getCollege call)
          setAllClasses(data.validClasses && data.validClasses.length > 0 
            ? data.validClasses 
            : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
          
          setAllSubjects(data.subjects && data.subjects.length > 0 
            ? data.subjects 
            : ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science']);
        }
        
        // Fetch years from exams (needed for filters)
        const exams = await firebaseService.getExams(collegeId, 'all');
        const uniqueYears = [...new Set(exams.map(exam => exam.year))].filter(Boolean).sort();
        setAllYears(uniqueYears.length > 0 ? uniqueYears : ['2025-26', '2026-27', '2027-28', '2028-29', '2029-30']);
        
      } catch (error) {
        console.error('Error fetching college data:', error);
        setCollegeData({ boards: [], subjects: [], classes: [], features: [] });
      }
    };
    
    fetchCollegeData();
  }, [currentUser?.collegeId, selectedCollege?.id]);
  
  // Get active college ID (either user's college or selected college for system admin)
  const getActiveCollegeId = (): string | undefined => {
    return selectedCollege?.id || undefined;
  };
  
  const getActiveCollegeName = (): string | undefined => {
    return selectedCollege?.name || undefined;
  };
  
  const handleHallTicketSelect = (hallTicket: any) => {
    setSelectedHallTicket(hallTicket);
  };

  const handleCreateHallTicket = () => {
    // console.log('Opening Create Hall Ticket Modal');
    setIsCreateHallTicketModalOpen(true);
  };


// Add these handler functions
const handleRoomSelect = (room: any) => {
  setSelectedRoom(room);
};

const handleRoomAdded = () => {
  setRoomRefreshTrigger(prev => prev + 1);
  setSelectedRoom(null);
};

const handleCloseRoomDetail = () => {
  setSelectedRoom(null);
};

// Reports handler functions
const handleReportSelect = useCallback((report: any) => {
  // console.log('📊 handleReportSelect called:', report?.name || 'null');
  setSelectedReport(report);
}, []);

// @ts-ignore - Reserved for future report refresh functionality
const handleReportRefresh = useCallback(() => {
  // console.log('🔄 Refreshing reports...');
  setReportRefreshTrigger(prev => prev + 1);
}, []);


  const handleExamCreated = (exam?: any) => {
    // console.log('🔥 Exam created:', exam);
    // Refresh counts to update menu
    refreshCounts();
    // Store the newly created exam ID for auto-selection
    if (exam?.id) {
      // console.log('📌 Setting newly created exam ID:', exam.id);
      setNewlyCreatedExamId(exam.id);
    }
    // Trigger Exams component to refresh
    setExamsRefreshKey(prev => prev + 1);
  };

  const handleHallTicketCreated = (_hallTicketGroup?: any) => {
    // console.log('🎟️ Hall Ticket Group created:', hallTicketGroup);
    // Refresh counts to update menu
    refreshCounts();
    // Close the modal
    setIsCreateHallTicketModalOpen(false);
  };
  
  // Real-time notices listener
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    const collegeId = getActiveCollegeId();
    if (!collegeId) {
      setNotices([]);
      return;
    }
    
    setIsLoadingNotices(true);
    
    // Subscribe to real-time updates
    const unsubscribe = firebaseService.subscribeToNotices(
      collegeId,
      currentUser.userType,
      (fetchedNotices) => {
        setNotices(fetchedNotices);
        setIsLoadingNotices(false);
        
        // Calculate new unread count
        const newUnreadCount = fetchedNotices.filter(notice => 
          !notice.readBy || !notice.readBy.includes(currentUser.userId)
        ).length;
        
        // Trigger bell animation if new unread notices arrived
        if (newUnreadCount > previousUnreadCount && previousUnreadCount > 0) {
          setBellAnimation(true);
          setTimeout(() => setBellAnimation(false), 1000);
        }
        
        setPreviousUnreadCount(newUnreadCount);
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, currentUser, selectedCollege]);
  
  // Close exam menu dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('exam-menu-dropdown');
      const button = event.target as HTMLElement;
      
      // Check if click is outside the menu and not on the button
      if (menu && menu.style.display !== 'none' && !menu.contains(event.target as Node) && !button.closest('button')) {
        menu.style.display = 'none';
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  // Fetch dynamic counts for menu
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    const collegeId = getActiveCollegeId();
    if (!collegeId) return;
    
const fetchCounts = async () => {
      try {
        // Get Firestore instance
        const db = getFirestore();
        const isStudent = currentUser?.userType === 'student';
        
        // Fetch counts in parallel - skip collections students don't have access to
        const [examsSnapshot, questionsSnapshot, usersSnapshot, roomsStats, hallTicketsGroups, reportTemplatesSnapshot] = await Promise.all([
          firebaseService.getExams(collegeId, 'all'),
          isStudent ? Promise.resolve([]) : firebaseService.getQuestions(collegeId),
          isStudent ? Promise.resolve(0) : firebaseService.getUsersCount(collegeId),
          firebaseService.getRoomStats(collegeId),
          getHallTicketGroups(collegeId, { status: 'active', studentId: isStudent ? currentUser?.userId : undefined }),
          isStudent ? Promise.resolve({ size: 0 }) : getDocs(query(collection(db, 'reportTemplates'), where('isActive', '==', true)))
        ]);
        
        // Set counts (will be 0 for students)
        setQuestionsCount(Array.isArray(questionsSnapshot) ? questionsSnapshot.length : 0);
        setUsersCount(typeof usersSnapshot === 'number' ? usersSnapshot : 0);
        setRoomsCount(Array.isArray(roomsStats) ? roomsStats.length : 0);
        setHallTicketsCount(hallTicketsGroups.length);
        
        setReportsCount((reportTemplatesSnapshot as any).size || 0);
        
        // For students, only count enrolled exams and results
        if (isStudent && currentUser?.userId) {
          try {
            const enrolledIds = await firebaseService.getEnrolledExamIdsForStudent(currentUser.userId, collegeId);
            const enrolledExams = examsSnapshot.filter(exam => enrolledIds.has(exam.id));
            setExamsCount(enrolledExams.length);
            const completedEnrolledExams = enrolledExams.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
            setResultsCount(completedEnrolledExams.length);
          } catch {
            setExamsCount(examsSnapshot.length);
            const completedExams = examsSnapshot.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
            setResultsCount(completedExams.length);
          }
        } else {
          setExamsCount(examsSnapshot.length);
          const completedExams = examsSnapshot.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
          setResultsCount(completedExams.length);
        }
        
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };
    
    fetchCounts();
  }, [isAuthenticated, currentUser, selectedCollege]);
  
  // Map menu items to their required feature names
  const featureMapping: { [key: string]: string } = {
    'exams': 'Exams',
    'results': 'Results',
    'users': 'Users',
    'halltickets': 'Hall Tickets',
    'calendar': 'Calendar',
    'questions': 'Questions',
    'rooms': 'Rooms',
    'leaderboard': 'Leader Board',
    'reports': 'Reports'
  };

  // Memoized topics data with dynamic counts
  const topicsDataWithCounts = useMemo(() => [
    // ===== MANAGEMENT SECTION (Always Opened) =====
    { id: 'management', label: 'Management', icon: faBriefcase, count: 0, section: 'management', isHeader: true, defaultExpanded: true },
    { id: 'exams', label: 'Exams', icon: faClipboardList, count: examsCount, description: 'Create and manage examinations' },
    { id: 'results', label: 'Results', icon: faTrophy, count: resultsCount, description: 'View and publish exam results' },
    { id: 'users', label: 'Users', icon: faUsers, count: usersCount, description: 'Manage students, teachers, and staff' },
    { id: 'questions', label: 'Questions', icon: faBookOpen, count: questionsCount, description: 'Question bank and paper management' },
    { id: 'reports', label: 'Reports', icon: faFileLines, count: reportsCount, description: 'Performance analytics and reports' },
    
    // ===== TOOLS SECTION (Collapsed by default) =====
    { id: 'tools', label: 'Tools', icon: faGear, count: 0, section: 'tools', isHeader: true, defaultExpanded: true },
    { id: 'calendar', label: 'Calendar', icon: faCalendarDays, count: calendarEventsCount, description: 'View and manage academic schedule', alwaysShow: true, onClick: () => setActiveItem(ACTIVE_ITEMS.CALENDAR) },
    { id: 'rooms', label: 'Rooms', icon: faDoorOpen, count: roomsCount, description: 'Manage college rooms and schedules' },
    { id: 'halltickets', label: 'Hall Tickets', icon: faIdCard, count: hallTicketsCount, description: 'Manage Students Hall Tickets' },
    { id: 'audit', label: 'Audit Trail', icon: faClipboardCheck, count: -1, description: 'View user activity logs and browsing history', hideForStudents: true, showEmptyBadge: true },
    { id: 'leaderboard', label: 'Leader Board', icon: faMedal, count: -1, description: 'View student performance rankings', showEmptyBadge: true },
   ], [examsCount, resultsCount, reportsCount, questionsCount, usersCount, roomsCount, calendarEventsCount, hallTicketsCount, collegeData.features]);
  
  // Reset selected audit user when leaving audit trail section
  useEffect(() => {
    if (activeItem !== 'audit') {
      setSelectedAuditUser(null);
      setAuditTrailInitializing(false);
    } else if (activeItem === 'audit' && !selectedAuditUser) {
      // Just entered audit trail, mark as initializing
      setAuditTrailInitializing(true);
    }
  }, [activeItem]);
  
  // Clear initializing flag once first user is selected
  useEffect(() => {
    if (selectedAuditUser) {
      setAuditTrailInitializing(false);
    }
  }, [selectedAuditUser]);
  
  // Debug: Log selectedAuditUser changes
  useEffect(() => {
    // console.log('🔄 [AUDIT STATE] selectedAuditUser changed:', selectedAuditUser?.fullName || 'null');
  }, [selectedAuditUser]);
  
  // Function to refresh counts (can be called after creating/deleting items)
  const refreshCounts = async () => {
    if (!currentUser) return;
    const collegeId = getActiveCollegeId();
    if (!collegeId) return;
    
    try {
      const isStudent = currentUser?.userType === 'student';
      
      const [examsSnapshot, questionsSnapshot, usersSnapshot, roomsStats, hallTicketsGroups] = await Promise.all([
        firebaseService.getExams(collegeId, 'all'),
        isStudent ? Promise.resolve([]) : firebaseService.getQuestions(collegeId),
        isStudent ? Promise.resolve(0) : firebaseService.getUsersCount(collegeId),
        firebaseService.getRoomStats(collegeId),
        getHallTicketGroups(collegeId, { status: 'active', studentId: isStudent ? currentUser?.userId : undefined })
      ]);
      
      setQuestionsCount(Array.isArray(questionsSnapshot) ? questionsSnapshot.length : 0);
      setUsersCount(typeof usersSnapshot === 'number' ? usersSnapshot : 0);
      setRoomsCount(Array.isArray(roomsStats) ? roomsStats.length : 0);
      setHallTicketsCount(hallTicketsGroups.length);
      
      // For students, only count enrolled exams and results
      if (isStudent && currentUser?.userId) {
        try {
          const enrolledIds = await firebaseService.getEnrolledExamIdsForStudent(currentUser.userId, collegeId);
          const enrolledExams = examsSnapshot.filter(exam => enrolledIds.has(exam.id));
          setExamsCount(enrolledExams.length);
          const completedEnrolledExams = enrolledExams.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
          setResultsCount(completedEnrolledExams.length);
        } catch {
          setExamsCount(examsSnapshot.length);
          const completedExams = examsSnapshot.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
          setResultsCount(completedExams.length);
        }
      } else {
        setExamsCount(examsSnapshot.length);
        const completedExams = examsSnapshot.filter(exam => exam.status === EXAM_STATUS.COMPLETED);
        setResultsCount(completedExams.length);
      }
      
      // Calculate calendar events count for current month
      
      // Filter exams based on user role (same as Calendar component)
      let filteredExams = examsSnapshot;
      const userType = currentUser?.userType;
      
      if (userType === USER_TYPES.STUDENT && currentUser?.userId) {
        // Students see only exams they are enrolled in
        const collegeId = getActiveCollegeId();
        if (collegeId) {
          const enrolledExamIds = await firebaseService.getEnrolledExamIdsForStudent(currentUser.userId, collegeId);
          filteredExams = examsSnapshot.filter(exam => enrolledExamIds.has(exam.id));
        } else {
          filteredExams = [];
        }
      } else if (userType === USER_TYPES.TEACHER && currentUser?.teacherClasses) {
        // Teachers see exams for classes they teach
        filteredExams = examsSnapshot.filter(exam => 
          currentUser.teacherClasses?.includes(exam.class)
        );
      }
      // Admins/Principals see all exams (no filtering needed)
      
      // Count exams for the current month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthExams = filteredExams.filter(exam => {
        if (!exam.examDate) return false;
        const examDate = new Date(exam.examDate);
        return examDate.getFullYear() === currentYear && examDate.getMonth() === currentMonth;
      });
      setCalendarEventsCount(monthExams.length);
    } catch (error) {
      console.error('Error refreshing counts:', error);
    }
  };

  // College filters (classes, subjects, years) are now loaded inside fetchCollegeData effect above
  
  const handleMarkAsRead = async (noticeId: string) => {
    if (!currentUser) return;
    
    try {
      await firebaseService.markNoticeAsRead(noticeId, currentUser.userId);
      
      // Update local state
      setNotices(prevNotices =>
        prevNotices.map(notice =>
          notice.id === noticeId
            ? { ...notice, readBy: [...(notice.readBy || []), currentUser.userId] }
            : notice
        )
      );
    } catch (error) {
      console.error('Error marking notice as read:', error);
    }
  };
  
  const handleDeleteNotice = async (noticeId: string) => {
    if (!currentUser) return;
    
    // Check if user has permission to delete
    if (!['admin', 'principal', 'system_admin'].includes(currentUser.userType)) {
      setCustomDialogMessage('You do not have permission to delete notices');
      setCustomDialogType('error');
      setShowCustomDialog(true);
      return;
    }
    
    try {
      await firebaseService.deleteNotice(noticeId);
      
      // Update local state
      setNotices(prevNotices => prevNotices.filter(notice => notice.id !== noticeId));
      
      setCustomDialogMessage('Notice deleted successfully');
      setCustomDialogType('success');
      setShowCustomDialog(true);
    } catch (error) {
      console.error('Error deleting notice:', error);
      setCustomDialogMessage('Failed to delete notice');
      setCustomDialogType('error');
      setShowCustomDialog(true);
    }
  };
  
  // Get unread notices count - Memoized for performance
  const unreadNoticesCount = useMemo(() => {
    return notices.filter(notice => 
      !notice.readBy || !notice.readBy.includes(currentUser?.userId || '')
    ).length;
  }, [notices, currentUser?.userId]);
  
  // Filter notices - Memoized for performance
  const filteredNotices = useMemo(() => {
    return notices.filter(notice => {
      if (noticesFilter === NOTICE_FILTER.UNREAD) {
        return !notice.readBy || !notice.readBy.includes(currentUser?.userId || '');
      }
      return true;
    });
  }, [notices, noticesFilter, currentUser?.userId]);
  
  // Notices panel animation
  useEffect(() => {
    if (isNoticesDropdownOpen) {
      requestAnimationFrame(() => { requestAnimationFrame(() => setNoticesAnimatedIn(true)); });
    } else {
      setNoticesAnimatedIn(false);
    }
  }, [isNoticesDropdownOpen]);
  
  // Notice Dialog States
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticePriority, setNoticePriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [noticeCategory, setNoticeCategory] = useState<'general' | 'academic' | 'administrative' | 'event'>('general');
  const [noticeTargetAudience, setNoticeTargetAudience] = useState<'all' | 'system_admin' | 'admin' | 'principal' | 'dean' | 'teacher' | 'student'>('all');
  const [noticeExpiryDate, setNoticeExpiryDate] = useState('');
  const [isSubmittingNotice, setIsSubmittingNotice] = useState(false);
  const [showNoticeDialogElement, setShowNoticeDialogElement] = useState(false);
  
  // Optimized handlers to prevent typing lag
  const handleNoticeTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNoticeTitle(e.target.value);
  }, []);
  
  const handleNoticeContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoticeContent(e.target.value);
  }, []);
  
  const handleNoticePriorityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setNoticePriority(e.target.value as 'low' | 'medium' | 'high');
  }, []);
  
  const handleNoticeCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setNoticeCategory(e.target.value as 'general' | 'academic' | 'administrative' | 'event');
  }, []);
  
  const handleNoticeAudienceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setNoticeTargetAudience(e.target.value as 'all' | 'system_admin' | 'admin' | 'principal' | 'dean' | 'teacher' | 'student');
  }, []);
  
  const handleNoticeExpiryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNoticeExpiryDate(e.target.value);
  }, []);
  
  // Image Modal States
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; pageNumber: number } | null>(null);

  // Handle successful login
  const handleLoginSuccess = async (user: UserModel) => {
    setCurrentUser(user);
    setIsLoadingData(true);
    // console.log('Login successful, loading application data for:', user.email);
    
    // Extract and store IP info
    if (user.lastLoginIP) {
      setLoginIPInfo(user.lastLoginIP);
      // console.log('📍 Login IP Info:', user.lastLoginIP);
    }
    
    // Start minimum loading time (10 seconds for smooth progress bar)
    const minLoadingTime = 10000; // 10 seconds
    const startTime = Date.now();
    
    try {
      // Fetch all necessary data in parallel
      const dataPromises: Promise<any>[] = [];
      
      // 1. Load colleges if system admin
      if (firebaseService.isSystemAdmin(user)) {
        // console.log('🏫 Loading colleges for system admin...');
        // console.log('🏫 User details:', {
          // userId: user.userId,
          // userType: user.userType,
          // email: user.email
        // });
        
        dataPromises.push(
          firebaseService.getAllColleges().then(fetchedColleges => {
            // console.log('🏫 Fetched colleges on login:', fetchedColleges.length);
            const collegeList = fetchedColleges.map(c => ({
              id: c.collegeId,
              name: c.collegeName,
              academicYear: calculateAcademicYear(c.academicYear),
              academicYearStartMonth: c.academicYear
            }));
            setColleges(collegeList);
            
            // Auto-select first college
            if (collegeList.length > 0 && !selectedCollege) {
              // console.log('🏫 Auto-selecting first college on login:', collegeList[0]);
              setSelectedCollege(collegeList[0]);
            }
            // console.log('✅ Colleges loaded on login:', collegeList.length);
          }).catch(error => {
            console.error('❌ Error loading colleges on login:', error);
          })
        );
      } else {
        // console.log('❌ User is NOT system admin:', {
          // userType: user.userType,
          // isSystemAdmin: firebaseService.isSystemAdmin(user)
        // });
        
        // Auto-set college for non-System Admin users
        if (user.collegeId) {
          // console.log('🎓 Setting college for non-System Admin user...');
          dataPromises.push(
            firebaseService.getCollegeById(user.collegeId).then(college => {
              if (college) {
                const collegeInfo = {
                  id: college.collegeId || user.collegeId,
                  name: college.collegeName || 'Unknown College',
                  academicYear: calculateAcademicYear(college.academicYear),
                  academicYearStartMonth: college.academicYear
                };
                // console.log('✅ Auto-selected college at login:', collegeInfo);
                setSelectedCollege(collegeInfo);
              } else {
                console.error('❌ College not found for ID:', user.collegeId);
              }
            }).catch(error => {
              console.error('❌ Error loading college at login:', error);
            })
          );
        }
      }
      
      // 2. Counts will be loaded by useEffect hooks when isAuthenticated + selectedCollege are set
      // No need to fetch here — avoids duplicate heavy Firestore reads
      
      // Wait for all data to load
      await Promise.all(dataPromises);
      // console.log('All data loaded successfully!');
      
      // Ensure minimum loading time for smooth UX and progress bar animation
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        // console.log(`Waiting additional ${remainingTime}ms for smooth transition...`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
    } catch (error) {
      console.error('Error loading application data:', error);
      // Continue to app even if some data fails to load
    } finally {
      // Show the main application
      setIsLoadingData(false);
      setIsAuthenticated(true);
      // console.log('Application ready!');
    }
  };

  // Handle password change requirement
  const handleRequirePasswordChange = (user: UserModel) => {
    setUserRequiringPasswordChange(user);
    setShowPasswordChange(true);
  };

  // Handle password change completion
  const handlePasswordChanged = async (user: UserModel) => {
    setShowPasswordChange(false);
    setUserRequiringPasswordChange(null);
    // Use the same data loading process as login
    await handleLoginSuccess(user);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await firebaseService.signOut();
      setCurrentUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // Helper function to format date as "31-Oct-2025"
  const formatDate = (dateString: any): string => {

    if (!dateString) {
      return '';
    }
    let date: Date;
    try {
      // Handle Firestore Timestamp objects (has toDate() method)
      if (typeof dateString === 'object' && typeof dateString.toDate === 'function') {
        date = dateString.toDate();
      }
      // Handle serialized Firestore Timestamp ({ seconds, nanoseconds } or { _seconds, _nanoseconds })
      else if (typeof dateString === 'object' && (dateString.seconds != null || dateString._seconds != null)) {
        const secs = dateString.seconds ?? dateString._seconds;
        date = new Date(secs * 1000);
      }
      // Handle Date objects
      else if (dateString instanceof Date) {
        date = dateString;
      }
      // Handle Firestore console-style strings like "February 4, 2026 at 7:26:52 PM UTC+5:30"
      else if (typeof dateString === 'string' && dateString.includes(' at ')) {
        date = new Date(dateString.replace(' at ', ' '));
      }
      // Handle any other string/number
      else {
        date = new Date(dateString);
      }
      
      if (!date || isNaN(date.getTime())) {
        return '';
      }
    } catch {
      return '';
    }

    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  };


  // Memoized callbacks to prevent re-renders
  const handleResultsListChange = useCallback((completedExams: any[]) => {
    setResultsCount(completedExams.length);
  }, []);

  // ✅ NEW: Handler for Student Performance toggle
  const handleStudentPerformanceToggle = useCallback((isShowing: boolean) => {
  // Auto-collapse left panel to give more space
  if (isShowing) {
    setIsMainCollapsed(true);
  }
  }, []);
  
  const handleStudentsDataChange = useCallback((data: any) => {
    setPresentStudents(data.presentStudents);
    setAbsentStudents(data.absentStudents);
    setTotalStudents(data.totalStudents);
  }, []);
  
  const handleStudentSelect = useCallback(async (student: any) => {
    // console.log('🎯 [APP.TSX] handleStudentSelect called with:', student);
    
    // Always set immediately (shows light data or null for deselect)
    setSelectedStudentForDetail(student);
    
    // If attempt data exists but responses are stripped (paginated view), fetch full attempt in background
    if (student?.attemptData?.attemptId && !student.attemptData.responses) {
      try {
        const targetStudentId = student.studentId;
        const fullAttempt = await firebaseService.getExamAttemptById(student.attemptData.attemptId);
        if (fullAttempt) {
          // Only update if user hasn't selected a different student while we were fetching
          setSelectedStudentForDetail((prev: any) => {
            if (prev?.studentId !== targetStudentId) return prev; // stale, skip
            return {
              ...student,
              attemptData: { ...student.attemptData, ...fullAttempt }
            };
          });
        }
      } catch (err) {
        console.error('⚠️ [APP.TSX] Failed to fetch full attempt, using light data:', err);
      }
    }
  }, []);
  const [selectedExam, setSelectedExam] = useState<ExamWithPool | null>(null);
  
  // 🔒 SECURITY: Strip sensitive question data for students
  const sanitizeExamForStudent = useCallback((exam: ExamWithPool | null | undefined): ExamWithPool | null => {
    if (!exam) return null;
    const isStudent = currentUser?.userType === 'student';
    if (!isStudent) return exam;
    const sanitized = { ...exam };
    if (sanitized.questionsList && sanitized.questionsList.length > 0) {
      sanitized.questionsList = sanitized.questionsList.map((q: any) => ({
        id: q.id, type: q.type, maxMarks: q.maxMarks,
        questionText: '', maximumMarks: q.maxMarks || 0,
      })) as any;
    }
    if ((sanitized as any).questionPool) {
      (sanitized as any).questionPool = (sanitized as any).questionPool.map((q: any) => ({
        id: q.id, type: q.type, maxMarks: q.maxMarks, chapter: q.chapter,
      }));
    }
    if (sanitized.likertQuestions && sanitized.likertQuestions.length > 0) {
      sanitized.likertQuestions = sanitized.likertQuestions.map((q: any) => ({
        id: q.id, type: q.type || 'likert',
      }));
    }
    return sanitized;
  }, [currentUser?.userType]);
  
  const setSelectedExamSafe = useCallback((exam: ExamWithPool | null | undefined | ((prev: ExamWithPool | null) => ExamWithPool | null)) => {
    if (typeof exam === 'function') {
      setSelectedExam((prev) => sanitizeExamForStudent(exam(prev)));
    } else {
      setSelectedExam(sanitizeExamForStudent(exam));
    }
  }, [sanitizeExamForStudent]);
  const [currentExamsList, setCurrentExamsList] = useState<ExamWithPool[]>([]);
  const [hasCheckedSubmission, setHasCheckedSubmission] = useState(false); // ✅ Track if we've completed the check
  
  // ✅ CHECK: Fallback — only runs if fetchAndSetExam didn't already check (e.g. selectedExam set externally)
  useEffect(() => {
    // Skip if already checked by fetchAndSetExam
    if (hasCheckedSubmission) return;
    
    const checkIfExamSubmitted = async () => {
      if (!selectedExam || !currentUser?.userId) {
        setIsSelectedExamSubmitted(false);
        setHasCheckedSubmission(true);
        return;
      }
      
      const submissionKey = `${selectedExam.id}_${currentUser.userId}`;
      
      // If cached, use it
      if (submissionCacheRef.current.has(submissionKey)) {
        setIsSelectedExamSubmitted(submissionCacheRef.current.get(submissionKey)!);
        setHasCheckedSubmission(true);
        return;
      }
      
      try {
        const attempt = await firebaseService.getAnyAttempt(selectedExam.id, currentUser.userId);
        const isSubmitted = !!(attempt && (
          attempt.submitTime || 
          attempt.status === 'submitted' || 
          attempt.status === 'evaluated' || 
          attempt.status === 'under_review'
        ));
        submissionCacheRef.current.set(submissionKey, isSubmitted);
        setIsSelectedExamSubmitted(isSubmitted);
      } catch (error) {
        console.error('❌ Error checking exam submission:', error);
        setIsSelectedExamSubmitted(false);
      } finally {
        setHasCheckedSubmission(true);
      }
    };
    
    checkIfExamSubmitted();
  }, [selectedExam?.id, currentUser?.userId, hasCheckedSubmission]);
  
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [imageCarouselOpen, setImageCarouselOpen] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Keyboard navigation for image carousel
  useEffect(() => {
    if (!imageCarouselOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImageCarouselOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageCarouselOpen, carouselImages.length]);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Note: Removed fetchCreatorInfo and examCreatorInfo state as getUserById is not available in firebaseService
  // The UI will display selectedExam.createdByRole which is already available
  
 useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 220 && newWidth <= 600) {
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Responsive collapsing based on screen width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1400 && !userInteractedLeft.current) {
        setIsLeftCollapsed(true);
        setIsLeftContentCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Sync content state when collapsed state changes (for smooth animation)
  useEffect(() => {
    if (isLeftCollapsed) {
      setIsLeftContentCollapsed(true);
    } else {
      const timer = setTimeout(() => setIsLeftContentCollapsed(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isLeftCollapsed]);

// Close college dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isCollegeDropdownOpen && !target.closest('.college-dropdown-container')) {
        setIsCollegeDropdownOpen(false);
      }
    };

    if (isCollegeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCollegeDropdownOpen]);

// Close year dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isYearDropdownOpen && !target.closest('.year-dropdown-container')) {
        setIsYearDropdownOpen(false);
      }
    };

    if (isYearDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isYearDropdownOpen]);



// Filter exams based on selected filter, year, class, board, and exam type - Memoized for performance
  // Handle notice dialog animation
  useEffect(() => {
    if (showNoticeDialog) {
      setShowNoticeDialogElement(true);
      const timer = setTimeout(() => {
        const dialogElement = document.getElementById('notice-dialog');
        if (dialogElement) {
          dialogElement.classList.remove('translate-x-full');
          dialogElement.classList.add('translate-x-0');
        }
        const backdropElement = document.getElementById('notice-backdrop');
        if (backdropElement) {
          backdropElement.classList.remove('opacity-0');
          backdropElement.classList.add('opacity-100');
        }
      }, 10);
      return () => clearTimeout(timer);
    } else {
      const dialogElement = document.getElementById('notice-dialog');
      if (dialogElement) {
        dialogElement.classList.remove('translate-x-0');
        dialogElement.classList.add('translate-x-full');
      }
      const backdropElement = document.getElementById('notice-backdrop');
      if (backdropElement) {
        backdropElement.classList.remove('opacity-100');
        backdropElement.classList.add('opacity-0');
      }
      const timer = setTimeout(() => {
        setShowNoticeDialogElement(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showNoticeDialog]);

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

  // Handle notice submission
  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      setCustomDialogMessage('Please fill in all required fields');
      setCustomDialogType('error');
      setShowCustomDialog(true);
      return;
    }

    const activeCollegeId = getActiveCollegeId();
    const activeCollegeName = getActiveCollegeName();

    if (!currentUser || !activeCollegeId || !activeCollegeName) {
      setCustomDialogMessage('Missing user or college information. Please try again.');
      setCustomDialogType('error');
      setShowCustomDialog(true);
      return;
    }

    setIsSubmittingNotice(true);

    try {
      // Prepare notice data
      const noticeData = {
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        priority: noticePriority,
        category: noticeCategory,
        targetAudience: noticeTargetAudience,
        expiryDate: noticeExpiryDate || undefined,
        collegeId: activeCollegeId,
        collegeName: activeCollegeName
      };

      // console.log('Creating notice:', noticeData);

      // Create notice in Firebase
      const noticeId = await firebaseService.createNotice(noticeData, currentUser);

      if (noticeId) {
        setCustomDialogMessage('Campus notice created successfully! 🎉');
        setCustomDialogType('success');
        setShowCustomDialog(true);
        
        // Reset form
        setNoticeTitle('');
        setNoticeContent('');
        setNoticePriority('medium');
        setNoticeCategory('general');
        setNoticeTargetAudience('all');
        setNoticeExpiryDate('');
        
        // Close dialog
        setShowNoticeDialog(false);
      } else {
        throw new Error('Failed to create notice');
      }

    } catch (error) {
      console.error('Error creating notice:', error);
      setCustomDialogMessage('Failed to create notice. Please try again.');
      setCustomDialogType('error');
      setShowCustomDialog(true);
    } finally {
      setIsSubmittingNotice(false);
    }
  };

  // Cache for fetched full exam data
  const examCacheRef = useRef<Map<string, any>>(new Map());
  // Cache for submission status per exam+user — avoids repeated DB calls
  const submissionCacheRef = useRef<Map<string, boolean>>(new Map());
  const [isLoadingExamDetail, setIsLoadingExamDetail] = useState(false);

  const fetchAndSetExam = useCallback(async (examId: string, viewContext?: 'result') => {
    const userId = currentUser?.userId;
    const submissionKey = userId ? `${examId}_${userId}` : '';
    
    // If both exam data AND submission status are cached — instant, no DB call, no spinner
    // But skip cache for result context (needs full unsanitized data)
    if (!viewContext && examCacheRef.current.has(examId) && submissionKey && submissionCacheRef.current.has(submissionKey)) {
      setSelectedExamSafe(examCacheRef.current.get(examId));
      setIsSelectedExamSubmitted(submissionCacheRef.current.get(submissionKey)!);
      setHasCheckedSubmission(true);
      return;
    }
    
    // Show single loading state for everything
    setIsLoadingExamDetail(true);
    setHasCheckedSubmission(false);
    setIsSelectedExamSubmitted(false);
    
    try {
      // Step 1: Get exam data (from cache or DB)
      let examData = !viewContext ? examCacheRef.current.get(examId) : undefined;
      if (!examData) {
        const fullExam = await firebaseService.getExamById(examId, viewContext);
        if (fullExam) {
          examData = { ...fullExam, createdById: fullExam.createdBy || '', createdAt: fullExam.createdAt?.toLocaleString?.() || String(fullExam.createdAt) };
          examCacheRef.current.set(examId, examData);
        }
      }
      
      if (examData) {
        setSelectedExamSafe(examData);
      }
      
      // Step 2: Check submission status (in same loading cycle)
      if (userId && examData) {
        try {
          const attempt = await firebaseService.getAnyAttempt(examId, userId);
          const isSubmitted = !!(attempt && (
            attempt.submitTime || 
            attempt.status === 'submitted' || 
            attempt.status === 'evaluated' || 
            attempt.status === 'under_review'
          ));
          submissionCacheRef.current.set(submissionKey, isSubmitted);
          setIsSelectedExamSubmitted(isSubmitted);
        } catch (error) {
          console.error('❌ Error checking submission status:', error);
          setIsSelectedExamSubmitted(false);
        }
      }
    } catch (error) {
      console.error('Error fetching exam:', error);
    } finally {
      setHasCheckedSubmission(true);
      setIsLoadingExamDetail(false);
    }
  }, [currentUser?.userId]);
  
  const handleExamsOnExamSelect = useCallback(async (exam: any) => {
    setIsViewingLiveStats(false);
    setIsViewingAttendance(false);
    setShowStudentPreview(false);
    
    // ✅ PERF: If Exams.tsx already loaded full exam data, pre-cache it
    // so fetchAndSetExam finds it instantly without calling Cloud Function
    if (exam && exam.questionsList && exam.questionsList.length > 0 && !examCacheRef.current.has(exam.id)) {
      const cachedExam = {
        ...exam,
        createdById: exam.createdById || exam.createdBy || '',
        createdAt: typeof exam.createdAt === 'string' ? exam.createdAt : (exam.createdAt?.toLocaleString?.() || String(exam.createdAt))
      };
      examCacheRef.current.set(exam.id, cachedExam);
    }
    
    await fetchAndSetExam(exam.id);
  }, [fetchAndSetExam]);

  const handleResultsOnExamSelect = useCallback(async (exam: any) => {
    setIsViewingLiveStats(false);
    setIsViewingAttendance(false);
    setSelectedStudentForDetail(null);
    
    // ✅ PERF: Pre-cache full exam data from Result.tsx if available
    if (exam && exam.questionsList && exam.questionsList.length > 0 && !examCacheRef.current.has(exam.id)) {
      const cachedExam = {
        ...exam,
        createdById: exam.createdById || exam.createdBy || '',
        createdAt: typeof exam.createdAt === 'string' ? exam.createdAt : (exam.createdAt?.toLocaleString?.() || String(exam.createdAt))
      };
      examCacheRef.current.set(exam.id, cachedExam);
    }
    
    await fetchAndSetExam(exam.id, 'result');
  }, [fetchAndSetExam]);

  const handleCalendarOnExamSelect = useCallback(async (exam: any) => {
    // console.log('🎯 [CALENDAR] Exam clicked:', exam.title, exam.id);
    setActiveItem('exams');
    setIsViewingLiveStats(false);
    setIsViewingAttendance(false);
    setShowStudentPreview(false);
    await fetchAndSetExam(exam.id);
  }, [fetchAndSetExam]);

  return (
    <BrandProvider theme={brandTheme}>
      {/* COURSE CURRICULUM PAGE - Full screen, unmounts everything else */}
      {showCourseCurriculum && (
        <CourseCurriculum
          courseName={courseCurriculumData.courseName}
          courseSlug={courseCurriculumData.courseSlug}
          curriculumData={courseCurriculumData.curriculumData}
          isLoading={courseCurriculumData.isLoading}
          enrollmentId={courseCurriculumData.enrollmentId}
          initialLectureId={courseCurriculumData.initialLectureId}
          onBack={() => {
            setShowCourseCurriculum(false);
            setCourseCurriculumData({ courseName: '', courseSlug: '', curriculumData: [], isLoading: false });
            collapseIfSmallScreen();
          }}
          currentUser={currentUser}
          collegeName={selectedCollege?.name || brandTheme.collegeName}
          brandTheme={brandTheme}
          onEditProfile={() => { setProfileInitialView('profile'); setShowUserProfile(true); }}
          onDownloadBrowser={() => setShowSecureBrowserModal(true)}
          onViewLoginDetails={() => setShowLoginDetailsDialog(true)}
          onAddUniversity={() => setIsBulkUploadUniversityOpen(true)}
          onSignOut={handleLogout}
          isSecureBrowser={isUsingSecureBrowser()}
          onOpenResumeBuilder={() => {
            setShowCourseCurriculum(false);
            setCourseCurriculumData({ courseName: '', courseSlug: '', curriculumData: [], isLoading: false });
            setShowLearning(true);
            setLearningActiveMenu('resumebuilder');
          }}
        />
      )}

      {/* Main App - Hidden when showing curriculum but stays mounted to preserve state */}
      <div style={{ display: showCourseCurriculum ? 'none' : 'contents' }}>
      <>
      {/* PRE-EXAM VERIFICATION MODAL */}
      {showPreExamVerification && pendingExam && currentUser && (
        <PreExamVerification
          userId={currentUser.userId}
          examTitle={pendingExam.title}
          proctoringPhotos={currentUser.proctoringPhotos || { front: null, left: null, right: null }}
          
          // ✅ UPDATE THIS FUNCTION
          onSuccess={(deviceId: string) => { 
            // console.log('🎤 Microphone Verified & Captured:', deviceId);
            setVerifiedAudioDeviceId(deviceId); // <--- STORE THE ID
            
            setShowPreExamVerification(false);
            setActiveExam(pendingExam);
            setShowExamInterface(true);
            setPendingExam(null);
          }}
          
          onCancel={() => {
            setShowPreExamVerification(false);
            setPendingExam(null);
          }}
        />
      )}

      {showExamInterface && activeExam && !isSelectedExamSubmitted ? (
        // FULL SCREEN EXAM INTERFACE - No header, footer, or sidebars
      <>

      <ExamsInterface
        examId={activeExam.id}
        userId={currentUser?.userId || 'unknown_user'}
        userFullName={currentUser?.fullName || ''}
        userEmail={currentUser?.email || ''}
        userStudentRoll={currentUser?.studentRoll || ''}
        userStudentClass={currentUser?.studentClass || ''} 
        userType={currentUser?.userType || 'student'}
        proctoringPhotos={currentUser?.proctoringPhotos}
        examTitle={activeExam.title}
        examSubject={activeExam.subject || 'General'}
        examType={activeExam.type || 'Online'}
        board={activeExam.board || 'CBSE'}
        academicYear={activeExam.year || calculateAcademicYear(selectedCollege?.academicYearStartMonth)}
        totalMarks={parseInt(activeExam.maxMarks) || 100}
        duration={parseInt(activeExam.duration) || 60}
        examDate={activeExam.examDate}
        examTime={activeExam.examTime}
        completionPolicy={activeExam?.completionPolicy || 'strict'} 
        collegeId={currentUser?.collegeId || 'default'}
        collegeName={selectedCollege?.name || brandTheme.collegeName}
        selectedAudioDeviceId={verifiedAudioDeviceId}
        onSubmitExam={() => {
          setShowExamInterface(false);
          setActiveExam(null);
          setIsSelectedExamSubmitted(true);  // ✅ Mark exam as submitted
          // Update cache so clicking this exam again won't re-fetch
          if (activeExam?.id && currentUser?.userId) {
            submissionCacheRef.current.set(`${activeExam.id}_${currentUser.userId}`, true);
          }
          setSelectedExamSafe(activeExam);  // ✅ Show the submitted exam screen
        }}
       onExitExam={() => {
          const isStudent = !!(currentUser?.studentRoll && currentUser.studentRoll.trim() !== '' && currentUser.studentRoll !== 'N/A');
          if (isStudent) {
            setShowExitDialog(true);
          } else {
            setShowExamInterface(false);
          }
        }}
        onDirectExit={() => {
          setShowExamInterface(false);
        }}
      />

      {/* Custom Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onContextMenu={e => e.preventDefault()}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Exit Exam?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Confirm your action</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-gray-700 leading-relaxed">
                Are you sure you want to exit the exam? Your progress will <strong className="text-amber-600">not be saved</strong> and you'll return to the exam start screen.
              </p>
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> All answered questions and time spent will be lost. You can restart the exam from the beginning.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowExitDialog(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowExitDialog(false);
                  setShowExamInterface(false);
                }}
                className="px-5 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg transition-all"
              >
                Yes, Exit Exam
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      ) : isLoadingData ? (
        <LoadingSpinner 
          message={`Welcome back, ${currentUser?.fullName || 'User'}!`}
          size="lg"
          fullScreen={true}
          duration={10000}
          showIPInfo={loginIPInfo !== null}
          ipInfo={loginIPInfo || undefined}
        />
      ) : isCheckingAuth ? (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <>
          {showPasswordChange ? (
            <ChangePassword 
              user={userRequiringPasswordChange!}
              onPasswordChanged={handlePasswordChanged}
              onCancel={() => {
                setShowPasswordChange(false);
                setUserRequiringPasswordChange(null);
              }}
            />
          ) : showForgotPassword ? (
            <ForgotPassword 
              onBackToLogin={() => setShowForgotPassword(false)}
            />
          ) : (
            <Login 
              onLoginSuccess={handleLoginSuccess}
              onRequirePasswordChange={handleRequirePasswordChange}
              onForgotPassword={() => setShowForgotPassword(true)}
            />
          )}
        </>
      ) : (
        <div 
          className="h-screen bg-gray-50 flex flex-col overflow-hidden" 
          style={{ 
            cursor: isResizing ? 'col-resize' : 'default',
            userSelect: isResizing ? 'none' : 'auto'
          }}
        >
      {/* CSS for bell shake animation */}
      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(-15deg); }
          20%, 40%, 60%, 80% { transform: rotate(15deg); }
        }
        .bell-shake {
          animation: bellShake 0.8s ease-in-out;
        }
          
        @keyframes scale-in {
        0% {
          opacity: 0;
          transform: scale(0.9);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes bounce-slow {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-10px);
        }
      }

      .animate-scale-in {
        animation: scale-in 0.3s ease-out;
      }

      .animate-bounce-slow {
        animation: bounce-slow 2s ease-in-out infinite;
      }

      `}</style>
      
      {/* Top Header */}
      <header className="sticky top-0 z-[9998] bg-white shadow-sm border-b border-gray-200 w-full">
        <div className="flex items-center justify-between px-6 py-2.5">
          <div className="flex items-center space-x-4">
            <Logo size="medium" showText={true} brand={brandTheme} collegeName={selectedCollege?.name || brandTheme.collegeName} />
            
            {/* Show Coding Lab header when Coding Lab is active */}
            {showLearning && learningActiveMenu === 'codinglab' && (
              <>
                <div className="w-px h-8 bg-gray-200"></div>
                <button 
                  onClick={() => setShowProblemsListModal(true)}
                  className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="relative w-6 h-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded" style={{ WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 640 512\'%3E%3Cpath d=\'M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z\'/%3E%3C/svg%3E")', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 640 512\'%3E%3Cpath d=\'M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z\'/%3E%3C/svg%3E")', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">Coding Lab - Problems List</p>
                    <p className="text-xs text-gray-500">Practice Coding Problems</p>
                  </div>
                </button>
              </>
            )}
            
            {/* Only show Create button for non-students (teachers/admins) - Hide when Code Practice, Resume Builder, or Logic Builder is active */}
            {currentUser?.userType !== USER_TYPES.STUDENT && activeItem !== ACTIVE_ITEMS.CALENDAR && activeItem !== ACTIVE_ITEMS.LEADERBOARD && activeItem !== ACTIVE_ITEMS.REPORTS && activeItem !== ACTIVE_ITEMS.AUDIT && !(showLearning && learningActiveMenu === 'codepractice') && !(showLearning && learningActiveMenu === 'codinglab') && !(showLearning && learningActiveMenu === 'resumebuilder') && !(showLearning && learningActiveMenu === 'logicbuilder') && (
              <>
                <div className="w-px h-8 bg-gray-200"></div>
                <button 
                  onClick={() => {
                    if (showLearning) {
                      if (learningActiveMenu === 'students') {
                        setIsCreateUserModalOpen(true);
                      } else if (learningActiveMenu === 'learningpaths') {
                        setIsCreateLearningPathModalOpen(true);
                      } else {
                        // TODO: Open Create Course Modal
                        // console.log('Create Course clicked');
                      }
                    } else if (activeItem === ACTIVE_ITEMS.QUESTIONS) {
                      setIsCreateQuestionModalOpen(true);
                    } else if (activeItem === ACTIVE_ITEMS.USERS) {
                      setIsCreateUserModalOpen(true);
                    } else if (activeItem === ACTIVE_ITEMS.ROOMS) {
                      setIsCreateRoomModalOpen(true);
                    } else if (activeItem === ACTIVE_ITEMS.HALLTICKETS) {
                      handleCreateHallTicket();
                    } else {
                      setEditingExam(null);
                      setIsCreateModalOpen(true);
                    }
                  }}
                  className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center shadow-md"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-white" />  
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">
                      {showLearning ? (
                        learningActiveMenu === 'students' ? 'Create User' : 
                        learningActiveMenu === 'learningpaths' ? 'Create Learning Path' : 'Create Course'
                      ) :
                      activeItem === ACTIVE_ITEMS.QUESTIONS ? 'Create Questions' : 
                      activeItem === ACTIVE_ITEMS.USERS ? 'Create User' : 
                      activeItem === ACTIVE_ITEMS.ROOMS ? 'Create Room' : 
                      activeItem === ACTIVE_ITEMS.HALLTICKETS ? 'Create Hall Ticket' :
                      'Create Exam'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {showLearning ? (
                        learningActiveMenu === 'students' ? 'Add new user' : 
                        learningActiveMenu === 'learningpaths' ? 'Add new learning path' : 'Add new course'
                      ) :
                      activeItem === ACTIVE_ITEMS.QUESTIONS ? 'Add new questions' : 
                      activeItem === ACTIVE_ITEMS.USERS ? 'Add new user' : 
                      activeItem === ACTIVE_ITEMS.ROOMS ? 'Add new room' : 
                      activeItem === ACTIVE_ITEMS.HALLTICKETS ? 'Generate hall ticket' :
                      'New Assessment'}
                    </p>
                  </div>
                </button>
              </>
            )}

            {/* Resume Builder Header */}
            {showLearning && learningActiveMenu === 'resumebuilder' && (
              <>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex items-center space-x-3 px-3 py-2">
                  <div className="relative w-6 h-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded" style={{ WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 576 512\'%3E%3Cpath d=\'M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 256h64c44.2 0 80 35.8 80 80c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16c0-44.2 35.8-80 80-80zm-32-96a64 64 0 1 1 128 0 64 64 0 1 1 -128 0zm256-32H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16z\'/%3E%3C/svg%3E")', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 576 512\'%3E%3Cpath d=\'M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 256h64c44.2 0 80 35.8 80 80c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16c0-44.2 35.8-80 80-80zm-32-96a64 64 0 1 1 128 0 64 64 0 1 1 -128 0zm256-32H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H496c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16z\'/%3E%3C/svg%3E")', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">Resume Builder</p>
                    <p className="text-xs text-gray-500">Build your professional resume</p>
                  </div>
                </div>
              </>
            )}

            {/* Logic Builder Header */}
            {showLearning && learningActiveMenu === 'logicbuilder' && (
              <>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex items-center space-x-3 px-3 py-2">
                  <div className="relative w-6 h-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded" style={{ WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\'%3E%3Cpath d=\'M184 0c30.9 0 56 25.1 56 56V456c0 30.9-25.1 56-56 56c-28.9 0-52.7-21.9-55.7-50.1c-5.2 1.4-10.7 2.1-16.3 2.1c-35.3 0-64-28.7-64-64c0-7.4 1.3-14.6 3.6-21.2C21.4 367.4 0 338.2 0 304c0-31.9 18.7-59.5 45.8-72.3C37.1 220.8 32 207 32 192c0-30.7 21.6-56.3 50.4-62.6C80.8 123.9 80 118 80 112c0-29.9 20.6-55.1 48.3-62.1C131.3 21.9 155.1 0 184 0zM328 0c28.9 0 52.6 21.9 55.7 49.9c27.8 7 48.3 32.1 48.3 62.1c0 6-.8 11.9-2.4 17.4c28.8 6.2 50.4 31.9 50.4 62.6c0 15-5.1 28.8-13.8 39.7C493.3 244.5 512 272.1 512 304c0 34.2-21.4 63.4-51.6 74.8c2.3 6.6 3.6 13.8 3.6 21.2c0 35.3-28.7 64-64 64c-5.6 0-11.1-.7-16.3-2.1c-3 28.2-26.8 50.1-55.7 50.1c-30.9 0-56-25.1-56-56V56c0-30.9 25.1-56 56-56z\'/%3E%3C/svg%3E")', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\'%3E%3Cpath d=\'M184 0c30.9 0 56 25.1 56 56V456c0 30.9-25.1 56-56 56c-28.9 0-52.7-21.9-55.7-50.1c-5.2 1.4-10.7 2.1-16.3 2.1c-35.3 0-64-28.7-64-64c0-7.4 1.3-14.6 3.6-21.2C21.4 367.4 0 338.2 0 304c0-31.9 18.7-59.5 45.8-72.3C37.1 220.8 32 207 32 192c0-30.7 21.6-56.3 50.4-62.6C80.8 123.9 80 118 80 112c0-29.9 20.6-55.1 48.3-62.1C131.3 21.9 155.1 0 184 0zM328 0c28.9 0 52.6 21.9 55.7 49.9c27.8 7 48.3 32.1 48.3 62.1c0 6-.8 11.9-2.4 17.4c28.8 6.2 50.4 31.9 50.4 62.6c0 15-5.1 28.8-13.8 39.7C493.3 244.5 512 272.1 512 304c0 34.2-21.4 63.4-51.6 74.8c2.3 6.6 3.6 13.8 3.6 21.2c0 35.3-28.7 64-64 64c-5.6 0-11.1-.7-16.3-2.1c-3 28.2-26.8 50.1-55.7 50.1c-30.9 0-56-25.1-56-56V56c0-30.9 25.1-56 56-56z\'/%3E%3C/svg%3E")', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">Logic Builder</p>
                    <p className="text-xs text-gray-500">Build and test logical flows</p>
                  </div>
                </div>
              </>
            )}
            </div>
          <div className="flex items-center space-x-2">
            {/* College Dropdown (System Admin Only) */}
            {currentUser && firebaseService.isSystemAdmin(currentUser) && colleges.length > 0 ? (
              <div className="relative college-dropdown-container">
                <button 
                  onClick={() => {
                    // console.log('🏫 College dropdown clicked. Current state:', {
                      // isOpen: isCollegeDropdownOpen,
                      // colleges: colleges.length,
                      // selectedCollege
                    // });
                    setIsCollegeDropdownOpen(!isCollegeDropdownOpen);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm text-white shadow-md"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <FontAwesomeIcon icon={faBuilding} />
                  <span className="font-semibold max-w-[150px] truncate">
                    {selectedCollege ? selectedCollege.name : 'Select College'}
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isCollegeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown Menu */}
                {isCollegeDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 max-h-80 overflow-y-auto">
                    {colleges.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        No colleges found
                      </div>
                    ) : (
                      colleges.map((college) => (
                        <button
                          key={college.id}
                          onClick={() => {
                            // console.log('🏫 College selected:', college);
                            setSelectedCollege(college);
                            setIsCollegeDropdownOpen(false);
                            // Reset to home/landing page on college switch
                            setSelectedExamSafe(null);
                            setIsViewingLiveStats(false);
                            setActiveItem(showLearning ? 'learning' : 'exams');
                            // ✅ Force panels to remount with new college data
                            setExamsRefreshKey(prev => prev + 1);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            selectedCollege?.id === college.id 
                              ? 'bg-blue-50 text-blue-600 font-medium' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <FontAwesomeIcon icon={faBuilding} />
                            <span className="truncate">{college.name}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : currentUser && firebaseService.isSystemAdmin(currentUser) && colleges.length === 0 ? (
              <div className="text-xs text-white bg-red-500 px-3 py-2 rounded-lg">
                ⚠️ No colleges loaded
              </div>
            ) : null}
            
            {/* Academic Year Dropdown - Hidden when in Learning mode or for students */}
            {!showLearning && currentUser?.userType !== 'student' && (
            <div className="relative year-dropdown-container">
              <button 
                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <FontAwesomeIcon icon={faCalendar} />
                <span className="font-semibold">{selectedYear === 'all' ? 'All Years' : selectedYear}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Menu */}
              {isYearDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                  {academicYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => {
                        setSelectedYear(year);
                        setIsYearDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        selectedYear === year 
                          ? 'bg-blue-50 text-blue-600 font-medium' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {year === 'all' ? 'All Years' : year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
            
            {/* Module Switch Button */}
            <button
              onClick={() => {
                const switchingToAssessment = showLearning;
                setShowLearning(!showLearning);
                // 🔥 FIX: When switching TO Assessment mode, reset activeItem to 'exams'
                // so the middle/right panels actually render (they depend on activeItem matching)
                if (switchingToAssessment) {
                  setActiveItem(ACTIVE_ITEMS.EXAMS);
                  setSelectedExamSafe(null);
                  setIsMainCollapsed(false);
                }
              }}
              className="relative group flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:shadow-sm"
              style={{ backgroundColor: showLearning ? '#EEF2FF' : '#FEF3C7' }}
            >
              <FontAwesomeIcon 
                icon={showLearning ? faClipboardList : faBookOpen} 
                className="text-sm"
                style={{ color: showLearning ? '#6366F1' : '#D97706' }}
              />
              <span className="text-xs font-semibold" style={{ color: showLearning ? '#6366F1' : '#D97706' }}>
                {showLearning ? 'Assessment' : 'Learning'}
              </span>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg" style={{ background: brandTheme.gradients.primary }}>
                Switch to {showLearning ? 'Assessment' : 'Learning'}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderBottomColor: brandTheme.colors.primary }}></div>
              </div>
            </button>
            
            {/* Notices Dropdown */}
            <div className="relative group notices-dropdown-container">
              <button 
                onClick={() => setIsNoticesDropdownOpen(!isNoticesDropdownOpen)}
                className={`relative flex flex-col items-center justify-center w-[46px] h-[46px] bg-gray-50 hover:bg-gray-100 rounded-xl transition-all ${
                  bellAnimation ? 'bell-shake' : ''
                }`}
                style={{ 
                  color: unreadNoticesCount > 0 ? '#EF4444' : '#4B5563'
                }}
              >
                <FontAwesomeIcon 
                  icon={faBell}
                  className="transition-colors text-base"
                />
                {unreadNoticesCount > 0 && (
                  <span 
                    className="absolute top-0.5 right-1 w-4 h-4 text-white text-[9px] rounded-full flex items-center justify-center font-semibold animate-pulse"
                    style={{ backgroundColor: '#EF4444' }}
                  >
                    {unreadNoticesCount > 9 ? '9+' : unreadNoticesCount}
                  </span>
                )}
              </button>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg" style={{ background: brandTheme.gradients.primary }}>
                Notices
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderBottomColor: brandTheme.colors.primary }}></div>
              </div>
              
              {/* Notices Panel - Slide from right */}
              {isNoticesDropdownOpen && createPortal(
                <>
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity duration-300"
                  style={{ opacity: noticesAnimatedIn ? 1 : 0 }}
                  onClick={() => setIsNoticesDropdownOpen(false)}
                />
                <div
                  className="fixed right-2 top-2 bottom-2 z-[10000] w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl overflow-hidden rounded-2xl flex flex-col transition-all duration-300 ease-out"
                  style={{
                    transform: noticesAnimatedIn ? 'translateX(0)' : 'translateX(100%)',
                    opacity: noticesAnimatedIn ? 1 : 0,
                  }}
                >
                  {/* Header */}
                  <div
                    className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                        <FontAwesomeIcon icon={faBell} className="text-white text-sm" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white">Notices</h2>
                        {unreadNoticesCount > 0 && (
                          <p className="text-[11px] text-white/70">{unreadNoticesCount} unread</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setIsNoticesDropdownOpen(false)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                      <FontAwesomeIcon icon={faXmark} className="text-white" />
                    </button>
                  </div>

                  {/* Filter Tabs */}
                  <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex space-x-2">
                    <button
                      onClick={() => setNoticesFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        noticesFilter === NOTICE_FILTER.ALL
                          ? 'text-white'
                          : 'text-gray-600 bg-white hover:bg-gray-100'
                      }`}
                      style={noticesFilter === NOTICE_FILTER.ALL ? { backgroundColor: brandTheme.colors.primary } : {}}
                    >
                      All ({notices.length})
                    </button>
                    <button
                      onClick={() => setNoticesFilter('unread')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        noticesFilter === NOTICE_FILTER.UNREAD
                          ? 'text-white'
                          : 'text-gray-600 bg-white hover:bg-gray-100'
                      }`}
                      style={noticesFilter === NOTICE_FILTER.UNREAD ? { backgroundColor: brandTheme.colors.primary } : {}}
                    >
                      Unread ({unreadNoticesCount})
                    </button>
                  </div>

                  {/* Notices List */}
                  <div className="flex-1 overflow-y-auto">
                    {isLoadingNotices ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-3 rounded-full animate-spin"
                          style={{ 
                            borderColor: brandTheme.colors.primary + '20',
                            borderTopColor: brandTheme.colors.primary
                          }}
                        />
                      </div>
                    ) : filteredNotices.length === 0 ? (
                      <div className="py-20 text-center">
                        <FontAwesomeIcon icon={faBell} className="text-gray-200 text-3xl mb-3" />
                        <p className="text-gray-500 font-medium text-sm mb-1">
                          {noticesFilter === NOTICE_FILTER.UNREAD ? 'No unread notices' : 'No notices yet'}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {noticesFilter === NOTICE_FILTER.UNREAD ? 'You\'re all caught up!' : 'New notices will appear here'}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {filteredNotices.map((notice) => {
                          const isUnread = !notice.readBy || !notice.readBy.includes(currentUser?.userId || '');
                          const priorityColors = {
                            high: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
                            medium: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-500' },
                            low: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' }
                          };
                          const colors = priorityColors[notice.priority as 'high' | 'medium' | 'low'] || priorityColors.medium;
                          
                          const categoryIcon = {
                            academic: faBooks,
                            administrative: faClipboardList,
                            event: faPartyHorn,
                            general: faBullhorn
                          };
                          
                          return (
                            <div
                              key={notice.id}
                              className={`px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer ${
                                isUnread ? 'bg-blue-50/30' : ''
                              }`}
                              onClick={() => {
                                if (isUnread) {
                                  handleMarkAsRead(notice.id);
                                }
                                setSelectedNotice(notice);
                                setShowNoticeDetailModal(true);
                              }}
                            >
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-1.5">
                                  <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${isUnread ? 'animate-pulse' : ''}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-1">
                                    <h4 className={`text-[13px] font-semibold ${isUnread ? 'text-gray-900' : 'text-gray-700'} line-clamp-1`}>
                                      {notice.title}
                                    </h4>
                                    <span className="text-[11px] text-gray-400 ml-2 flex-shrink-0">
                                      {new Date(notice.createdAt).toLocaleDateString('en-IN', { 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 line-clamp-2 mb-2">
                                    {notice.content}
                                  </p>
                                  <div className="flex items-center space-x-2">
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                      <FontAwesomeIcon icon={categoryIcon[notice.category as keyof typeof categoryIcon]} className="mr-1" /> {notice.priority.toUpperCase()}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      by {notice.createdByName}
                                    </span>
                                  </div>
                                </div>
                                {['admin', 'principal', 'system_admin'].includes(currentUser?.userType || '') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNoticeToDelete(notice.id);
                                      setShowDeleteConfirmDialog(true);
                                    }}
                                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Delete notice"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {filteredNotices.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                      <button
                        onClick={() => {
                          filteredNotices.forEach(notice => {
                            if (!notice.readBy || !notice.readBy.includes(currentUser?.userId || '')) {
                              handleMarkAsRead(notice.id);
                            }
                          });
                        }}
                        className="text-[11px] font-semibold transition-colors"
                        style={{ color: brandTheme.colors.primary }}
                      >
                        Mark all as read
                      </button>
                      <span className="text-[11px] text-gray-400">
                        {filteredNotices.length} notice{filteredNotices.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                </>,
                document.body
              )}
            </div>

            {/* AI Assistant Button - Support Assistant for students on Learning page, Teaching Assistant for non-students */}
            {currentUser?.userType === 'student' && showLearning ? (
              <button
                onClick={() => setShowAISupportAssistant(true)}
                className="relative group flex flex-col items-center justify-center w-[46px] h-[46px] bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              >
               <FontAwesomeIcon icon={faRobot} className="text-gray-700 text-base" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse"></span>
                <div className="absolute top-full mt-2 px-2.5 py-1 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg" style={{ background: brandTheme.gradients.primary }}>
                  AI Support
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderBottomColor: brandTheme.colors.primary }}></div>
                </div>
              </button>
            ) : currentUser?.userType !== 'student' && (
              <button
                onClick={() => setShowAIAssistant(true)}
                className="relative group flex flex-col items-center justify-center w-[46px] h-[46px] bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              >
               <FontAwesomeIcon icon={faRobot} className="text-gray-700 text-base" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"></span>
                <div className="absolute top-full mt-2 px-2.5 py-1 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg" style={{ background: brandTheme.gradients.primary }}>
                  AI Assistant
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderBottomColor: brandTheme.colors.primary }}></div>
                </div>
              </button>
            )}

            
            
            {/* Create Notice Button (Admin/Teacher/Principal Only) */}
            {currentUser && ['teacher', 'admin', 'principal', 'system_admin'].includes(currentUser.userType) && (
              <div className="relative group">
                <button 
                  onClick={() => {
                    // console.log('Create Notice button clicked');
                    // console.log('Current user:', currentUser);
                    // console.log('Setting showNoticeDialog to true');
                    setShowNoticeDialog(true);
                  }}
                  className="flex flex-col items-center justify-center w-[46px] h-[46px] bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <FontAwesomeIcon icon={faBullhorn} 
                    className="text-gray-600 group-hover:text-blue-600 transition-all duration-200 text-base"
                  />
                </button>
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg" style={{ background: brandTheme.gradients.primary }}>
                  Create Notice
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderBottomColor: brandTheme.colors.primary }}></div>
                </div>
              </div>
            )}
            
            <div className="ml-2">
              <ProfileDropdown
                isSecureBrowser={isUsingSecureBrowser()}
                user={{
                  name: currentUser?.fullName || currentUser?.email?.split('@')[0].replace(/[._]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'User',
                  email: currentUser?.email || '',
                  role: currentUser?.userType || 'student',
                  roleName: currentUser?.userType ? firebaseService.getUserTypeDisplayName(currentUser.userType) : 'User',
                  organization: selectedCollege?.name || brandTheme.collegeName,
                  organizationId: selectedCollege?.id || currentUser?.collegeId || '',
                  avatar: currentUser?.profilePicture || undefined,
                  leetcodeUsername: currentUser?.leetcodeUsername || undefined
                }}
                onEditProfile={() => { setProfileInitialView('profile'); setShowUserProfile(true); }}
                onDownloadBrowser={() => setShowSecureBrowserModal(true)}
                onViewLoginDetails={() => setShowLoginDetailsDialog(true)}
                onViewLeetCode={() => { setProfileInitialView('leetcode'); setShowUserProfile(true); }}
                onAddUniversity={() => setIsBulkUploadUniversityOpen(true)}
                onBrandProfile={() => {
                  const cId = selectedCollege?.id || currentUser?.collegeId;
                  if (cId) {
                    firebaseService.getBrandProfile(cId).then(bp => {
                      if (bp && bp.primaryColor) {
                        setBrandTheme(generateThemeFromBrandProfile(bp, cId));
                      }
                    }).catch(() => {});
                  }
                }}
                onSignOut={handleLogout}
                onProfileClick={() => { setProfileInitialView('profile'); setShowUserProfile(true); }}
                onSwitchMode={(mode) => { 
                  setShowLearning(mode === 'learning'); 
                  if (mode !== 'learning') { setActiveItem(ACTIVE_ITEMS.EXAMS); setSelectedExamSafe(null); setIsMainCollapsed(false); }
                }}
                currentMode={showLearning ? 'learning' : 'assessment'}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden overflow-x-hidden">
        {/* Learning Center - replaces sidebar and content when active */}
        {showLearning ? (
          <Learning
            onClose={() => { setShowLearning(false); setActiveItem(ACTIVE_ITEMS.EXAMS); setSelectedExamSafe(null); setIsMainCollapsed(false); }}
            brandTheme={brandTheme}
            currentUser={currentUser}
            selectedCollege={selectedCollege}
            onActiveMenuChange={(menuItem) => {
              setLearningActiveMenu(menuItem);
              // Reset to playground mode when clicking Coding Lab in sidebar
              if (menuItem === 'codinglab') {
                setSelectedProblemSlug('');
              }
            }}
            selectedProblemSlug={selectedProblemSlug}
            onOpenCurriculum={(data) => {
              setCourseCurriculumData(data);
              setShowCourseCurriculum(true);
              collapseIfSmallScreen();
            }}
          />
        ) : (
        <>
        {/* Left Sidebar */}
        <aside 
          className={`h-full bg-gray-50 border-r border-gray-200 transition-all duration-300 ${isLeftCollapsed ? '' : 'w-64'} flex flex-col overflow-visible relative flex-shrink-0`}
          style={{ width: isLeftCollapsed ? '63px' : '256px', minWidth: isLeftCollapsed ? '63px' : '256px' }}
        >
          <div className={`p-4 flex items-center ${isLeftContentCollapsed ? 'justify-center' : 'justify-between'}`}>
            {isLeftContentCollapsed ? (
              <button onClick={() => { userInteractedLeft.current = true; setIsLeftCollapsed(false); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex flex-col space-y-1.5">
                  <div className="w-5 h-0.5 bg-gray-600"></div>
                  <div className="w-5 h-0.5 bg-gray-600"></div>
                  <div className="w-5 h-0.5 bg-gray-600"></div>
                </div>
              </button>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900">Menu</h2>
                <button onClick={() => { userInteractedLeft.current = true; setIsLeftCollapsed(true); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
              </>
            )}
          </div>

         <nav className="flex-1 overflow-y-auto overflow-x-visible p-2 max-h-[calc(100vh-140px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {topicsDataWithCounts
            .filter(item => {
              // Hide Questions from students
              if (item.id === 'questions' && currentUser?.userType === 'student') {
                return false;
              }

              // Hide Users from students
              if (item.id === 'users' && currentUser?.userType === 'student') {
                return false;
              }

              // Hide Reports from students
              if (item.id === 'reports' && currentUser?.userType === 'student') {
                return false;
              }

              // Hide items with hideForStudents flag from students
              if ((item as any).hideForStudents && currentUser?.userType === 'student') {
                return false;
              }

              // Filter based on college features
              // Headers are always shown
              // Filter based on college features
              // Items marked as alwaysShow bypass all filtering
              if ((item as any).alwaysShow) {
                return true;
              }
              
              // Headers - only show if section has visible items
              if (item.isHeader) {
                // Find current header's index
                const currentHeaderIndex = topicsDataWithCounts.findIndex(i => i.id === item.id);
                
                // Find next header's index
                const nextHeaderIndex = topicsDataWithCounts.findIndex(
                  (i, idx) => idx > currentHeaderIndex && i.isHeader
                );
                
                // Get items between this header and next header (or end of array)
                const endIndex = nextHeaderIndex === -1 ? topicsDataWithCounts.length : nextHeaderIndex;
                const sectionItems = topicsDataWithCounts.slice(currentHeaderIndex + 1, endIndex);
                
                // Check if any items in this section would be visible
                const hasVisibleItems = sectionItems.some(i => {
                  // Check student-specific filters
                  if (currentUser?.userType === 'student') {
                    if (i.id === 'questions' || i.id === 'users' || i.id === 'reports') {
                      return false;
                    }
                    // Check hideForStudents flag
                    if ((i as any).hideForStudents) {
                      return false;
                    }
                  }
                  
                  // Check alwaysShow flag
                  if ((i as any).alwaysShow) {
                    return true;
                  }
                  
                  // Check feature filters (case-insensitive)
                  if (collegeData.features.length > 0) {
                    const requiredFeature = featureMapping[i.id];
                    if (requiredFeature) {
                      return collegeData.features.some(f => f.toLowerCase() === requiredFeature.toLowerCase());
                    }
                  }
                  
                  return true;
                });
                
                return hasVisibleItems;
              }  
              // Check if feature filtering is enabled (collegeData.features has items)
              if (collegeData.features.length > 0) {
                const requiredFeature = featureMapping[item.id];
                // If feature is mapped, check if college has it (case-insensitive)
                if (requiredFeature) {
                  return collegeData.features.some(f => f.toLowerCase() === requiredFeature.toLowerCase());
                }
                // If not in mapping, show by default
                return true;
              }
              
              // If no features defined, show all
              return true;
            })
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;
              const isHeader = item.isHeader;
              
              // Get current section for this item
              const getCurrentSection = () => {
                const itemIndex = topicsDataWithCounts.findIndex(i => i.id === item.id);
                for (let i = itemIndex; i >= 0; i--) {
                  if (topicsDataWithCounts[i].isHeader) {
                    return topicsDataWithCounts[i].id;
                  }
                }
                return 'management';
              };
              
              const currentSection = getCurrentSection();
              const isSectionCollapsed = collapsedSections[currentSection] ?? false;
              
              // Hide non-header items if their section is collapsed
              if (!isHeader && isSectionCollapsed && !isLeftContentCollapsed) {
                return null;
              }
              
              if (isHeader && isLeftContentCollapsed) {
                return (
                  <div key={item.id}>
                    {item.section !== 'management' && <div className="w-full h-px bg-gray-200 mb-2"></div>}
                    <div className="py-4 my-2 flex justify-center">
                      <div className={`${getSectionTextColor(item.section)} font-semibold text-sm tracking-wider`}
                           style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                        {item.label}
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Render collapsible header
              if (isHeader && !isLeftContentCollapsed) {
                const isCollapsed = collapsedSections[item.id] ?? false;
                return (
                  <div key={item.id} className="mb-1">
                    {item.section !== 'management' && <div className="w-full h-px bg-gray-200 my-2"></div>}
                    <button
                      onClick={() => {
                        setCollapsedSections(prev => ({
                          ...prev,
                          [item.id]: !prev[item.id]
                        }));
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${getSectionBg(item.section)} hover:opacity-80`}
                    >
                      <div className="flex items-center space-x-3">
                        <FontAwesomeIcon icon={Icon} className="text-gray-700" />
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      </div>
                      <FontAwesomeIcon 
                        icon={isCollapsed ? faChevronRight : faChevronDown} 
                        className="text-gray-500 text-xs transition-transform"
                      />
                    </button>
                  </div>
                );
              }
              
              return (
                <div key={item.id} className="relative mb-1">
                  <button
                    onClick={() => {
                      // Don't allow clicking on header items
                      if (isHeader) return;
                      
                      // Handle custom onClick if provided (like codepractice)
                      if (item.onClick) {
                        item.onClick();
                        return;
                      }
                      
                      setActiveItem(item.id);
                      
                      if (item.id === 'exams') {
                        setSelectedSubject(null);
                        setSelectedClassForUsers(null);
                        setSelectedRoom(null);  // ADD THIS
                      } else if (item.id === 'questions') {
                        setSelectedExamSafe(null);
                        setSelectedClassForUsers(null);
                        setSelectedRoom(null);  // ADD THIS
                      } else if (item.id === 'rooms') {  // ADD THIS BLOCK
                        setSelectedExamSafe(null);
                        setSelectedSubject(null);
                        setSelectedClassForUsers(null);
                      } else if (item.id === 'users') {
                        setSelectedExamSafe(null);
                        setSelectedSubject(null);
                        setSelectedRoom(null);  // ADD THIS
                      } else if (item.id === 'calendar') { // ADDED: Calendar clear state
                        setSelectedExamSafe(null);
                        setSelectedSubject(null);
                        setSelectedClassForUsers(null);
                        setSelectedRoom(null);
                        setIsMainCollapsed(false); // Always expand for Calendar
                      } else if (item.id === 'leaderboard') { // ADDED: Leader Board clear state
                        setSelectedExamSafe(null);
                        setSelectedSubject(null);
                        setSelectedClassForUsers(null);
                        setSelectedRoom(null);
                        setIsMainCollapsed(false); // Always expand for LeaderBoard
                      } else if (item.id === 'reports') { // ADDED: Reports clear state
                        setSelectedExamSafe(null);
                        setSelectedSubject(null);
                        setSelectedClassForUsers(null);
                        setSelectedRoom(null);
                        setSelectedReport(null); // Clear selected report
                      } else if (item.id === 'results') {  // ADD THIS
                        setSelectedExamSafe(null);
                        setPresentStudents([]);
                        setAbsentStudents([]);
                        setTotalStudents(0);
                      }
                    }}
                    onMouseEnter={() => setHoveredCategory(item.id)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`w-full flex items-center ${isLeftContentCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-3 rounded-lg transition-all relative
                      hover:bg-gray-50
                    `}
                    style={isActive ? { backgroundColor: `${brandTheme.colors.primary}10` } : {}}
                  >
                    {isActive && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                        style={{ backgroundColor: brandTheme.colors.primary }}
                      ></div>
                    )}
                    
                    {isLeftContentCollapsed ? (
                      <FontAwesomeIcon 
                        icon={Icon} 
                        className="text-gray-600"
                        style={isActive ? { color: brandTheme.colors.primary } : {}}
                      />
                    ) : (
                      <>
                        <div className="flex items-center space-x-3 flex-1">
                          <FontAwesomeIcon 
                            icon={Icon} 
                            className="text-gray-600"
                            style={isActive ? { color: brandTheme.colors.primary } : {}}
                          />
                          <span 
                            className={`text-sm ${!isActive ? 'text-gray-900' : 'font-medium'}`}
                            style={isActive ? { color: brandTheme.colors.primary } : {}}
                          >
                            {item.label}
                          </span>
                        </div>
                        {item.count >= 0 ? (
                          <span className="text-xs text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full">
                            {item.count}
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border-2 border-gray-300 bg-transparent"></span>
                        )}
                      </>
                    )}
                  </button>
                  
                  {isLeftContentCollapsed && hoveredCategory === item.id && (
                    <div 
                      className="absolute left-full top-0 ml-2 bg-gray-900 text-white px-3 py-2.5 rounded-lg shadow-lg pointer-events-none min-w-[200px]"
                      style={{ zIndex: 1000 }}
                    >
                      <div className="font-semibold text-sm mb-0.5">{item.label}</div>
                      <div className="text-xs text-gray-300 opacity-90">{item.description}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
      <main 
          className={`h-full overflow-y-auto transition-all duration-300 ${isMainCollapsed ? 'w-16' : ''} bg-white border-r border-gray-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
          style={isMainCollapsed ? undefined : (activeItem === ACTIVE_ITEMS.CALENDAR || activeItem === ACTIVE_ITEMS.LEADERBOARD ? { flex: 1, minWidth: '320px' } : { minWidth: '320px', maxWidth: '600px', width: '600px' })}
        >
          {isMainCollapsed ? (
            <div className="h-full flex flex-col">
              <div className="p-4 flex items-center justify-center">
                <button 
                  onClick={() => { userInteractedMain.current = true; setIsMainCollapsed(false); }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Expand"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center space-y-4">
                {activeItem === ACTIVE_ITEMS.EXAMS && (
                  <>
                    <FontAwesomeIcon icon={faClipboardList} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Exams
                    </div>
                  </>
                )}
                {activeItem === ACTIVE_ITEMS.RESULTS && (
                  <>
                    <FontAwesomeIcon icon={faTrophy} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Results
                    </div>
                  </>
                )}
                {activeItem === ACTIVE_ITEMS.QUESTIONS && (
                  <>
                    <FontAwesomeIcon icon={faLayerGroup} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Questions
                    </div>
                  </>
                )}
                {/* ADD THIS SECTION FOR ROOMS */}
                {activeItem === ACTIVE_ITEMS.ROOMS && (
                  <>
                    <FontAwesomeIcon icon={faDoorOpen} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Rooms
                    </div>
                  </>
                )}
                {/* ADD THIS SECTION FOR REPORTS */}
                {activeItem === ACTIVE_ITEMS.REPORTS && (
                  <>
                    <FontAwesomeIcon icon={faChartBar} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Reports
                    </div>
                  </>
                )}
                {activeItem === ACTIVE_ITEMS.USERS && (
                  <>
                    <FontAwesomeIcon icon={faGraduationCap} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Classes
                    </div>
                  </>
                )}
                {/* ADDED: Calendar to collapsed view */}
                {activeItem === ACTIVE_ITEMS.CALENDAR && (
                  <>
                    <FontAwesomeIcon icon={faCalendarDays} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Calendar
                    </div>
                  </>
                )}
                {activeItem === ACTIVE_ITEMS.HALLTICKETS && (
                  <>
                    <FontAwesomeIcon icon={faIdCard} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Hall Tickets
                    </div>
                  </>
                )}
                {/* ADDED: Audit Trail to collapsed view - Non-students only */}
                {activeItem === 'audit' && currentUser?.userType !== USER_TYPES.STUDENT && (
                  <>
                    <FontAwesomeIcon icon={faClipboardCheck} className="text-gray-600" />
                    <div className="text-gray-600 font-semibold text-sm tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      Audit Trail
                    </div>
                  </>
                )}
                
              </div>
            </div>
          ) : (
            <>
              {activeItem === ACTIVE_ITEMS.EXAMS && (
                <Exams
                  key={`${examsRefreshKey}-${getActiveCollegeId() || 'none'}`}
                  activeCollegeId={getActiveCollegeId() ?? null}
                  selectedYear={selectedYear}
                  brandTheme={brandTheme}
                  onExamSelect={handleExamsOnExamSelect}
                  selectedExam={selectedExam}
                  onCreateExam={() => setIsCreateModalOpen(true)}
                  isMainCollapsed={isMainCollapsed}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                  onExamsListChange={setCurrentExamsList}
                  newlyCreatedExamId={newlyCreatedExamId}
                  onExamAutoSelected={() => setNewlyCreatedExamId(null)}
                  showStudentPreview={showStudentPreview}
                  onStudentPreviewClose={() => setShowStudentPreview(false)}
                  onCountsChange={refreshCounts}
                  userId={currentUser?.userId}
                  currentUserType={currentUser?.userType}
                />
              )}

              {activeItem === ACTIVE_ITEMS.RESULTS && (
                <Result
                  key={`results-${resultsResetKey}`}
                  activeCollegeId={getActiveCollegeId() || ''}
                  selectedYear={selectedYear}
                  brandTheme={brandTheme}
                  onExamSelect={handleResultsOnExamSelect}
                  selectedExam={selectedExam}
                  isMainCollapsed={isMainCollapsed}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                  onResultsListChange={handleResultsListChange}
                  onStudentsDataChange={handleStudentsDataChange}
                  onStudentSelect={handleStudentSelect}
                  selectedStudent={selectedStudentForDetail}
                  currentUserType={currentUser?.userType}
                  currentUserId={currentUser?.userId}
                />
              )}

              {activeItem === ACTIVE_ITEMS.QUESTIONS && (
                <Questions 
                  activeCollegeId={getActiveCollegeId() ?? ''} 
                  refreshTrigger={questionsRefreshKey}
                  onSubjectSelect={(subject, questionType) => {
                    setSelectedExamSafe(null);
                    setSelectedSubject(subject);
                    setSelectedQuestionType(questionType as any);
                  }}
                  selectedSubject={selectedSubject}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                  onCountsChange={refreshCounts}
                />
              )}

              {/* ADD THIS ROOMS SECTION */}
              {activeItem === ACTIVE_ITEMS.ROOMS && (
                <Rooms
                  activeCollegeId={getActiveCollegeId() ?? null}
                  refreshTrigger={roomRefreshTrigger}
                  onRoomSelect={handleRoomSelect}
                  selectedRoom={selectedRoom}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                />
              )}

              {/* ADD THIS REPORTS SECTION */}
              {activeItem === ACTIVE_ITEMS.REPORTS && (
                <Reports
                  activeCollegeId={getActiveCollegeId() ?? null}
                  refreshTrigger={reportRefreshTrigger}
                  onReportSelect={handleReportSelect}
                  selectedReport={selectedReport}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                />
              )}

              {activeItem === ACTIVE_ITEMS.USERS && (
                <Classes
                  activeCollegeId={getActiveCollegeId() ?? null}
                  onClassSelect={(className) => {
                    setSelectedExamSafe(null);
                    setSelectedSubject(null);
                    setSelectedClassForUsers(className);
                  }}
                  selectedClass={selectedClassForUsers}
                  brandTheme={brandTheme}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                  selectedAcademicYear={selectedYear}
                  refreshTrigger={usersRefreshTrigger}
                />
              )}
              {/* Calendar Component */}
              {activeItem === ACTIVE_ITEMS.CALENDAR && (
                <Calendar
                  activeCollegeId={getActiveCollegeId() ?? null}
                  selectedYear={selectedYear}
                  brandTheme={brandTheme}
                  currentUser={currentUser}
                  onEventsCountChange={(count) => setCalendarEventsCount(count)}
                  onExamSelect={handleCalendarOnExamSelect}
                />
              )}
              {/* Leader Board Component */}
              {activeItem === ACTIVE_ITEMS.LEADERBOARD && (
                <LeaderBoard
                  activeCollegeId={getActiveCollegeId() ?? null}
                  selectedYear={selectedYear}
                  brandTheme={brandTheme}
                  currentUser={currentUser}
                  allYears={allYears}
                  allClasses={allClasses}
                  allSubjects={allSubjects}
                />
              )}
              {/* Audit Trail Component - Middle Panel: User List - Non-students only */}
              {activeItem === 'audit' && currentUser?.userType !== USER_TYPES.STUDENT && (
                <AuditUserList
                  collegeId={getActiveCollegeId() ?? ''}
                  onUserSelect={(user) => {
                    if (user) {
                      // console.log('🔍 [AUDIT] User selected:', user.fullName, user.userId);
                    } else {
                      // console.log('🔍 [AUDIT] User selection cleared');
                    }
                    setSelectedAuditUser(user);
                  }}
                  selectedUser={selectedAuditUser}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                />
              )}
              {activeItem === ACTIVE_ITEMS.HALLTICKETS && (
                <HallTicket
                  activeCollegeId={getActiveCollegeId() ?? null}
                  selectedYear={selectedYear}
                  brandTheme={brandTheme}
                  onHallTicketSelect={handleHallTicketSelect}
                  selectedHallTicket={selectedHallTicket}
                  isMainCollapsed={isMainCollapsed}
                  onCollapse={() => { userInteractedMain.current = true; setIsMainCollapsed(true); }}
                  onCreateHallTicket={handleCreateHallTicket}
                  currentUser={currentUser}
                />
              )}
            </>
          )}
        </main>

         {/* Right Sidebar - Exam/Question Details Panel */}
       {(() => {
         const shouldShow = (selectedExam || 
          (activeItem === ACTIVE_ITEMS.USERS) || 
          (selectedSubject && activeItem === ACTIVE_ITEMS.QUESTIONS) || 
          (activeItem === ACTIVE_ITEMS.ROOMS) ||
          (activeItem === ACTIVE_ITEMS.REPORTS) ||
          (activeItem === ACTIVE_ITEMS.HALLTICKETS) ||
          (activeItem === 'audit' && (selectedAuditUser || auditTrailInitializing)) ||
          activeItem === ACTIVE_ITEMS.RESULTS || 
          activeItem === ACTIVE_ITEMS.EXAMS || 
          activeItem === ACTIVE_ITEMS.QUESTIONS) && 
          activeItem !== ACTIVE_ITEMS.CALENDAR && activeItem !== ACTIVE_ITEMS.LEADERBOARD;
         
         if (activeItem === 'audit') {
           // console.log('🔍 [AUDIT PANEL] activeItem:', activeItem);
           // console.log('🔍 [AUDIT PANEL] selectedAuditUser:', selectedAuditUser);
           // console.log('🔍 [AUDIT PANEL] auditTrailInitializing:', auditTrailInitializing);
           // console.log('🔍 [AUDIT PANEL] shouldShow:', shouldShow);
         }
         
         return shouldShow;
       })() && (
          <aside 
            className="h-full bg-white border-l border-gray-200 transition-all duration-300 flex flex-col overflow-hidden relative" 
            style={{ flex: 1, minWidth: 0 }}
          >
            {/* Hall Tickets List - Third Panel */}
            {activeItem === ACTIVE_ITEMS.HALLTICKETS ? (
              <HallTicketsList
                selectedHallTicketGroup={selectedHallTicket}
                activeCollegeId={getActiveCollegeId() ?? null}
                brandTheme={brandTheme}
                currentUser={currentUser}
                isSecureBrowser={isUsingSecureBrowser()}
                onClose={() => {
                  setSelectedHallTicket(null);
                }}
              />
            ) : activeItem === 'audit' && selectedAuditUser ? (
              // Audit Trail Detail - MUST come before selectedExam check!
              <UserAudit
                user={selectedAuditUser}
                onBack={() => setSelectedAuditUser(null)}
              />
            ) : activeItem === 'audit' && auditTrailInitializing ? (
              // Loading state for audit trail third panel - Same style as Result.tsx
              <div className="h-full flex flex-col bg-white" style={{ animation: 'fadeIn 0.2s ease-in' }}>
                <style>{`
                  @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                `}</style>
                <div className="flex-1 flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
                    style={{ 
                      borderColor: brandTheme.colors.primary + '20',
                      borderTopColor: brandTheme.colors.primary
                    }}
                  />
                  <p className="text-gray-600 font-medium">Loading audit trail...</p>
                </div>
              </div>
            ) : isLoadingExamDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <svg className="animate-spin h-8 w-8 mx-auto mb-3" style={{ color: brandTheme.colors.primary }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm font-medium text-gray-500">Loading exam details...</p>
                </div>
              </div>
            ) : selectedExam ? (
              // Show Student Exam Interface when student is in EXAMS section
              currentUser?.userType === USER_TYPES.STUDENT && activeItem === ACTIVE_ITEMS.EXAMS ? (
                (() => {
                  // Check if exam is currently live
                  const examIsLive = isExamLive(selectedExam.examDate, selectedExam.examTime, selectedExam.duration, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0);
                  const isSecureOnlineExam = selectedExam.mode === EXAM_MODES.ONLINE && selectedExam.securityLevel === SECURITY_LEVELS.SECURE;
                  const isExamOver = isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0);
                  const isSecureExamBlocked = isSecureOnlineExam && !isExamOver && !isUsingSecureBrowser();

                  // If secure exam and not over and NOT using secure browser, show secure browser message
                  if (isSecureExamBlocked) {
                    return (
                      <div className="flex-1 flex items-start justify-center px-6 py-8 bg-gradient-to-br from-red-50 to-orange-50 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <div className="text-center max-w-md">
                          {/* Shield Icon */}
                          <div className="mb-5 flex justify-center relative">
                            <div className="relative">
                              {/* Background decoration circles */}
                              <div className="absolute -top-2 -left-2 w-16 h-16 bg-red-100 rounded-full opacity-40"></div>
                              <div className="absolute -bottom-1 -right-1 w-14 h-14 bg-orange-100 rounded-full opacity-40"></div>
                              
                              {/* Main illustration */}
                              <div className="relative z-10 flex items-center justify-center space-x-2">
                                {/* Lock with shield */}
                                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-red-100 via-orange-100 to-amber-100 flex items-center justify-center shadow-md">
                                  <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                </div>
                                
                                {/* Computer icon */}
                                <div className="transform rotate-12">
                                  <div className="w-14 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg shadow-md relative flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Message */}
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            Secure Browser Required
                          </h3>
                          <p className="text-gray-600 mb-5 text-sm leading-relaxed">
                            This is a secure online exam that requires the EXAMINERS Secure Browser application.
                          </p>

                          {/* Exam Info Card */}
                          <div className="bg-white rounded-xl p-4 border-2 border-red-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Secure Exam</span>
                              </div>
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                <FontAwesomeIcon icon={faLock} className="mr-1" /> Protected
                              </span>
                            </div>
                            
                            <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">Date</span>
                                </div>
                                <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                              </div>
                              
                              {selectedExam.examTime && (
                                <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Time</span>
                                  </div>
                                  <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">Duration</span>
                                </div>
                                <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                              </div>
                            </div>
                          </div>

                          {/* Instructions */}
                          <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                            <div className="flex items-start space-x-2">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="text-left flex-1">
                                <p className="text-xs font-semibold text-red-900 mb-1">How to Access:</p>
                                <ul className="text-xs text-red-800 space-y-1">
                                  <li>1. Download EXAMINERS Secure Browser</li>
                                  <li>2. Install it on your device</li>
                                  <li>3. Login and access the exam through the app</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          {/* Download Link */}
                          <button 
                            onClick={() => setShowSecureBrowserModal(true)}
                            className="mt-4 w-full px-4 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:from-red-600 hover:to-orange-600 transition-all shadow-md"
                          >
                            Download Secure Browser
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // ✅ LOADING: Show loading state while checking submission (FIRST PRIORITY)
                  if (!hasCheckedSubmission) {
                    return (
                      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
                        <div className="text-center">
                          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
                          <p className="text-gray-600 font-medium">Checking exam status...</p>
                        </div>
                      </div>
                    );
                  }

                  // ✅ CHECK: If student already submitted, show submitted message
                  if (isSelectedExamSubmitted) {
                    return (
                      <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white">
                        <div className="flex-1 flex items-center justify-center px-6 py-8">
                          <div className="text-center max-w-xl">
                            {/* Same illustration as existing */}
                            <div className="mb-5 flex justify-center relative">
                              <div className="relative">
                                <div className="absolute -top-2 -left-2 w-16 h-16 bg-green-100 rounded-full opacity-40"></div>
                                <div className="absolute -bottom-1 -right-1 w-14 h-14 bg-blue-100 rounded-full opacity-40"></div>
                                
                                <div className="relative z-10 flex items-center justify-center space-x-2">
                                  <div className="transform -rotate-12">
                                    <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
                                      <path d="M30 50 L30 30 L35 25 L40 25 L45 30 L45 50 M45 40 L50 35 L55 35 L60 40 L60 60 M60 45 L65 40 L70 40 L75 45 L75 70 L70 80 L50 85 L35 80 L30 70 L30 50" 
                                            fill="#E8B4A0" stroke="#D4997C" strokeWidth="2"/>
                                      <circle cx="42" cy="35" r="3" fill="#C4896D"/>
                                    </svg>
                                  </div>
                                  
                                  <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 flex items-center justify-center shadow-md">
                                    <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  
                                  <div className="transform rotate-12">
                                    <div className="w-14 h-18 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg shadow-md relative">
                                      <div className="absolute top-1.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                      <div className="absolute top-3.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                      <div className="absolute top-5.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                      <div className="absolute bottom-2 right-1.5 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Message - matching existing design */}
                            <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                              <FontAwesomeIcon icon={faCheckCircle} className="mr-2" /> Exam Already Submitted
                            </h3>
                            <p className="text-gray-600 mb-5 text-sm leading-relaxed text-left">
                              You have already submitted this exam and cannot re-enter it. Check Results section for your performance.
                            </p>

                            {/* Exam Info Card - beautiful design matching scheduled card */}
                            <div className="bg-white rounded-xl p-5 border-2 border-green-200 shadow-sm">
                              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Submitted</span>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedExam.mode === EXAM_MODES.ONLINE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {selectedExam.mode === EXAM_MODES.ONLINE ? <><FontAwesomeIcon icon={faGlobe} className="mr-1" /> Online</> : <><FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Offline</>}
                                </span>
                              </div>

                              <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Date</span>
                                  </div>
                                  <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                                </div>
                                
                                {selectedExam.examTime && (
                                  <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span className="text-xs font-medium text-gray-700">Time</span>
                                    </div>
                                    <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Duration</span>
                                  </div>
                                  <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // If exam is live, show LiveExamInterface
                  if (examIsLive) {
                    return (
                      <LiveExamInterface
                        selectedExam={selectedExam}
                        currentUser={currentUser}
                        brandTheme={brandTheme}
                        onEnterExam={async () => {
                          // Block entry if already submitted
                          if (isSelectedExamSubmitted) return;
                          // Students: Check attendance before allowing to start exam
                          await handleExamStartClick(
                            selectedExam,
                            currentUser,
                            () => {
                              // Trigger pre-exam verification instead of directly showing exam
                              triggerPreExamVerification(
                                selectedExam,
                                currentUser,
                                () => {
                                  setActiveExam(selectedExam);
                                  setShowExamInterface(true);
                                },
                                () => {
                                  // console.log('Verification cancelled');
                                },
                                setShowPreExamVerification,
                                setPendingExam,
                                setActiveExam,
                                setShowExamInterface
                              );
                            },
                            (exam) => {
                              setPendingExamStart(exam);
                              setShowAttendanceWarningDialog(true);
                            },
                            (exam, cameraGranted, audioGranted) => {
                              setPendingProctoringExam(exam);
                              // Set permission status based on pre-check
                              setCameraPermissionStatus(cameraGranted ? 'granted' : 'denied');
                              setAudioPermissionStatus(audioGranted ? 'granted' : 'denied');
                              setShowProctoringSetupDialog(true);
                            }
                          );
                        }}
                      />
                    );
                  }

                  // If exam is not yet live, show waiting view
                  return (
                    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white">
                      {/* Student Waiting View */}
                      <div className="flex-1 flex items-center justify-center px-6 py-8">
                        <div className="text-center max-w-xl">
                          {/* Colorful Illustration */}
                          <div className="mb-5 flex justify-center relative">
                            <div className="relative">
                              {/* Background decoration circles */}
                              <div className="absolute -top-2 -left-2 w-16 h-16 bg-purple-100 rounded-full opacity-40"></div>
                              <div className="absolute -bottom-1 -right-1 w-14 h-14 bg-yellow-100 rounded-full opacity-40"></div>
                              
                              {/* Main illustration container */}
                              <div className="relative z-10 flex items-center justify-center space-x-2">
                                {/* Left hand pointing */}
                                <div className="transform -rotate-12">
                                  <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
                                    <path d="M30 50 L30 30 L35 25 L40 25 L45 30 L45 50 M45 40 L50 35 L55 35 L60 40 L60 60 M60 45 L65 40 L70 40 L75 45 L75 70 L70 80 L50 85 L35 80 L30 70 L30 50" 
                                          fill="#E8B4A0" stroke="#D4997C" strokeWidth="2"/>
                                    <circle cx="42" cy="35" r="3" fill="#C4896D"/>
                                  </svg>
                                </div>
                                
                                {/* Center lock icon */}
                                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex items-center justify-center shadow-md">
                                  <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </div>
                                
                                {/* Right document/calendar */}
                                <div className="transform rotate-12">
                                  <div className="w-14 h-18 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg shadow-md relative">
                                    <div className="absolute top-1.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                    <div className="absolute top-3.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                    <div className="absolute top-5.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                    <div className="absolute bottom-2 right-1.5 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                                      <svg className="w-3.5 h-3.5 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Message - Different for Not Started vs Ended */}
                          {(() => {
                            const examHasEnded = isExamCompleted(
                              selectedExam.examDate, 
                              selectedExam.examTime || '', 
                              selectedExam.duration, 
                              selectedExam.status,
                              selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0
                            );

                            if (examHasEnded) {
                              // Exam has ended - show ended message
                              return (
                                <>
                                  <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                                    <FontAwesomeIcon icon={faClock} className="mr-2" /> Exam Time Over
                                  </h3>
                                  <p className="text-gray-600 mb-5 text-sm leading-relaxed text-left">
                                    The exam window has closed and is no longer accepting submissions. Please contact your instructor for any queries.
                                  </p>

                                  {/* Exam Info Card */}
                                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm mt-2">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completed</span>
                                      </div>
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedExam.mode === EXAM_MODES.ONLINE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {selectedExam.mode === EXAM_MODES.ONLINE ? <><FontAwesomeIcon icon={faGlobe} className="mr-1" /> Online</> : <><FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Offline</>}
                                      </span>
                                    </div>
                                    
                                    <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <span className="text-xs font-medium text-gray-700">Date</span>
                                        </div>
                                        <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                                      </div>
                                      
                                      {selectedExam.examTime && (
                                        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                          <div className="flex items-center space-x-2">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="text-xs font-medium text-gray-700">Time</span>
                                          </div>
                                          <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="text-xs font-medium text-gray-700">Duration</span>
                                        </div>
                                        <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            } else {
                              // Exam hasn't started yet - show locked message
                              return (
                                <>
                                  <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                                    <FontAwesomeIcon icon={faLock} className="mr-2" /> Exam Scheduled
                                  </h3>
                                  <p className="text-gray-600 mb-5 text-sm leading-relaxed text-left">
                                    The exam will be available on the scheduled date and time. Stay prepared!
                                  </p>
                                  {/* Countdown Timer */}
                                  <CountdownTimer 
                                    examDate={selectedExam.examDate} 
                                    examTime={selectedExam.examTime}
                                    brandTheme={brandTheme}
                                  />

                                  {/* Exam Info Card */}
                                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm mt-6">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Scheduled</span>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedExam.mode === EXAM_MODES.ONLINE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {selectedExam.mode === EXAM_MODES.ONLINE ? <><FontAwesomeIcon icon={faGlobe} className="mr-1" /> Online</> : <><FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Offline</>}
                              </span>
                            </div>
                            
                            <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">Date</span>
                                </div>
                                <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                              </div>
                              
                              {selectedExam.examTime && (
                                <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Time</span>
                                  </div>
                                  <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">Duration</span>
                                </div>
                                <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                              </div>
                            </div>
                          </div>
                                </>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : 
              // Show Result Dashboard when in Results section
              activeItem === ACTIVE_ITEMS.RESULTS ? (
                (() => {
                  // console.log('🔍 [APP.TSX RENDER] Result section render check:', {
                    // userType: currentUser?.userType,
                    // selectedExam: selectedExam?.id,
                    // selectedStudent: selectedStudentForDetail?.studentName,
                    // isStudent: currentUser?.userType === USER_TYPES.STUDENT
                  // });
                  
                  // For students with both exam and student data selected
                  if (currentUser?.userType === USER_TYPES.STUDENT && selectedStudentForDetail) {
                    // console.log('✅ [APP.TSX RENDER] Rendering StudentExamDetail for student');
                    return (
                      <StudentExamDetail 
                        exam={selectedExam}
                        student={selectedStudentForDetail}
                        brandTheme={brandTheme}
                        currentUserType={currentUser?.userType}
                        onBack={() => {
                          setSelectedStudentForDetail(null);
                          setSelectedExamSafe(null);
                        }}
                      />
                    );
                  }
                  
                  // For students waiting for data
                  if (currentUser?.userType === USER_TYPES.STUDENT) {
                    // console.log('⏳ [APP.TSX RENDER] Student waiting for data');
                    return (
                      <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="text-gray-400 text-6xl mb-4">📋</div>
                          <p className="text-gray-600 text-lg font-medium">Select an exam to view your results</p>
                        </div>
                      </div>
                    );
                  }
                  
                  // For teacher/admin viewing specific student
                  if (selectedStudentForDetail) {
                    // console.log('✅ [APP.TSX RENDER] Rendering StudentExamDetail for teacher/admin');
                    return (
                      <StudentExamDetail 
                        exam={selectedExam}
                        student={selectedStudentForDetail}
                        brandTheme={brandTheme}
                        currentUserType={currentUser?.userType}
                        onBack={() => setSelectedStudentForDetail(null)}
                      />
                    );
                  }
                  
                  // For teacher/admin viewing dashboard
                  // console.log('📊 [APP.TSX RENDER] Rendering ExamDashboard for teacher/admin');
                  return (
                    <ExamDashboard
                      selectedExam={selectedExam}
                      brandTheme={brandTheme}
                      presentStudents={presentStudents}
                      absentStudents={absentStudents}
                      totalStudents={totalStudents}
                      onStudentPerformanceToggle={handleStudentPerformanceToggle}
                    />
                  );
                })()
              ) :
                            (() => {
                // TEACHER/ADMIN DETAILED VIEW - Only for non-students
                const isStudent = currentUser?.userType === USER_TYPES.STUDENT;
                
                // If student somehow ended up here (shouldn't happen), show a message
                if (isStudent) {
                  return (
                    <div className="flex-1 flex items-center justify-center px-6 py-8 bg-gradient-to-br from-gray-50 to-white">
                      <div className="text-center max-w-md">
                        <div className="mb-5">
                          <div className="w-24 h-24 mx-auto rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shadow-md">
                            <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          View Not Available
                        </h3>
                        <p className="text-gray-600 mb-5 text-sm leading-relaxed">
                          This view is only available for teachers and administrators. Please navigate to the Exams section to access your exams.
                        </p>
                        <button
                          onClick={() => setActiveItem(ACTIVE_ITEMS.EXAMS)}
                          className="px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-white"
                          style={{ background: brandTheme.gradients.primary }}
                        >
                          Go to Exams
                        </button>
                      </div>
                    </div>
                  );
                }
                
                // Check if user can access exam details (for teachers/admins)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const examDate = new Date(selectedExam.examDate);
                examDate.setHours(0, 0, 0, 0);
                const hasExamDateArrived = examDate <= today;
                const isCreator = selectedExam.createdById === currentUser?.userId;
                const isSecureOnlineExam = selectedExam.mode === EXAM_MODES.ONLINE && selectedExam.securityLevel === SECURITY_LEVELS.SECURE;
                
                // Note: Real students are filtered out above. This section is for teachers/admins only.
                // The showStudentPreview mode simulates student view for teachers.
                // Check if exam is over (past exam date + time + duration)
                const isExamOver = isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0);

                 // For preview mode, simulate student restrictions
                const isSecureExamBlocked = showStudentPreview && isSecureOnlineExam && !isExamOver;

                // Force student preview mode when showStudentPreview is true
                const canAccessDetails = showStudentPreview ? false : ((hasExamDateArrived || isCreator) && !isSecureExamBlocked);

                // Show secure browser required message for students trying to access secure exams
                if (isSecureExamBlocked) {
                  return (
                    <div className="flex-1 flex items-start justify-center px-6 py-8 bg-gradient-to-br from-red-50 to-orange-50 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <div className="text-center max-w-md">
                        {/* Shield Icon */}
                        <div className="mb-5 flex justify-center relative">
                          <div className="relative">
                            {/* Background decoration circles */}
                            <div className="absolute -top-2 -left-2 w-16 h-16 bg-red-100 rounded-full opacity-40"></div>
                            <div className="absolute -bottom-1 -right-1 w-14 h-14 bg-orange-100 rounded-full opacity-40"></div>
                            
                            {/* Main illustration */}
                            <div className="relative z-10 flex items-center justify-center space-x-2">
                              {/* Lock with shield */}
                              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-red-100 via-orange-100 to-amber-100 flex items-center justify-center shadow-md">
                                <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              </div>
                              
                              {/* Computer icon */}
                              <div className="transform rotate-12">
                                <div className="w-14 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg shadow-md relative flex items-center justify-center">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Message */}
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          Secure Browser Required
                        </h3>
                        <p className="text-gray-600 mb-5 text-sm leading-relaxed">
                          This is a secure online exam that requires the EXAMINERS Secure Browser application installed on your device.
                        </p>

                        {/* Exam Info Card */}
                        <div className="bg-white rounded-xl p-4 border-2 border-red-200 shadow-sm">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Secure Exam</span>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              <FontAwesomeIcon icon={faLock} className="mr-1" /> Protected
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-medium text-gray-700">Date</span>
                              </div>
                              <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                            </div>
                            
                            {selectedExam.examTime && (
                              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">Time</span>
                                </div>
                                <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-medium text-gray-700">Duration</span>
                              </div>
                              <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                            </div>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                          <div className="flex items-start space-x-2">
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-xs font-semibold text-red-900 mb-1">How to Access:</p>
                              <ul className="text-xs text-red-800 space-y-1">
                                <li>1. Download EXAMINERS Secure Browser</li>
                                <li>2. Install it on your device</li>
                                <li>3. Login and access the exam through the app</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Download Link (Optional) */}
                        <button 
                          onClick={() => setShowSecureBrowserModal(true)}
                          className="mt-4 w-full px-4 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:from-red-600 hover:to-orange-600 transition-all shadow-md"
                        >
                          Download Secure Browser
                        </button>
                      </div>
                    </div>
                  );
                }

                if (!canAccessDetails) {
                  // ✅ LOADING: Show loading state while checking submission (FIRST PRIORITY)
                  if (!hasCheckedSubmission) {
                    return (
                      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
                        <div className="text-center">
                          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
                          <p className="text-gray-600 font-medium">Checking exam status...</p>
                        </div>
                      </div>
                    );
                  }
                  
                  // ✅ CHECK: If student already submitted, show submitted message
                  if (isSelectedExamSubmitted) {
                    return (
                      <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white">
                        <div className="flex-1 flex items-center justify-center px-6 py-8">
                          <div className="text-center max-w-xl">
                            <div className="mb-5 flex justify-center relative">
                              <div className="relative">
                                <div className="absolute -top-2 -left-2 w-16 h-16 bg-green-100 rounded-full opacity-40"></div>
                                <div className="absolute -bottom-1 -right-1 w-14 h-14 bg-blue-100 rounded-full opacity-40"></div>
                                
                                <div className="relative z-10 flex items-center justify-center space-x-2">
                                  <div className="transform -rotate-12">
                                    <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
                                      <path d="M30 50 L30 30 L35 25 L40 25 L45 30 L45 50 M45 40 L50 35 L55 35 L60 40 L60 60 M60 45 L65 40 L70 40 L75 45 L75 70 L70 80 L50 85 L35 80 L30 70 L30 50" 
                                            fill="#E8B4A0" stroke="#D4997C" strokeWidth="2"/>
                                      <circle cx="42" cy="35" r="3" fill="#C4896D"/>
                                    </svg>
                                  </div>
                                  
                                  <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 flex items-center justify-center shadow-md">
                                    <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  
                                  <div className="transform rotate-12">
                                    <div className="w-14 h-18 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg shadow-md relative">
                                      <div className="absolute top-1.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                      <div className="absolute top-3.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                      <div className="absolute top-5.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                      <div className="absolute bottom-2 right-1.5 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                              <FontAwesomeIcon icon={faCheckCircle} className="mr-2" /> Exam Already Submitted
                            </h3>
                            <p className="text-gray-600 mb-5 text-sm leading-relaxed text-left">
                              You have already submitted this exam and cannot re-enter it. Check Results section for your performance.
                            </p>

                            <div className="bg-white rounded-xl p-5 border-2 border-green-200 shadow-sm">
                              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Submitted</span>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedExam.mode === EXAM_MODES.ONLINE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {selectedExam.mode === EXAM_MODES.ONLINE ? <><FontAwesomeIcon icon={faGlobe} className="mr-1" /> Online</> : <><FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Offline</>}
                                </span>
                              </div>

                              <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Date</span>
                                  </div>
                                  <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                                </div>
                                
                                {selectedExam.examTime && (
                                  <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span className="text-xs font-medium text-gray-700">Time</span>
                                    </div>
                                    <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Duration</span>
                                  </div>
                                  <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Check if exam is live
                  const examIsLive = isExamLive(selectedExam.examDate, selectedExam.examTime, selectedExam.duration, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0);
                  
                  if (examIsLive) {
                    // Show Live Exam Interface
                    return (
                      <LiveExamInterface
                        selectedExam={selectedExam}
                        currentUser={currentUser}
                        brandTheme={brandTheme}
                        onEnterExam={async () => {
                          const userRole = currentUser?.userType || 'student';
                          const isTeacherRole = ['admin', 'principal', 'dean', 'teacher', 'system_admin'].includes(userRole);
                          
                          // Block entry if student already submitted
                          if (!isTeacherRole && isSelectedExamSubmitted) return;
                          
                          if (!isTeacherRole && selectedExam) {
                            // Students: Check attendance before allowing to start exam
                            await handleExamStartClick(
                              selectedExam,
                              currentUser,
                              () => {
                                // Trigger pre-exam verification instead of directly showing exam
                                triggerPreExamVerification(
                                  selectedExam,
                                  currentUser,
                                  () => {
                                    setActiveExam(selectedExam);
                                    setShowExamInterface(true);
                                  },
                                  () => {
                                    // console.log('Verification cancelled');
                                  },
                                  setShowPreExamVerification,
                                  setPendingExam,
                                  setActiveExam,
                                  setShowExamInterface
                                );
                              },
                              (exam) => {
                                setPendingExamStart(exam);
                                setShowAttendanceWarningDialog(true);
                              },
                              (exam, cameraGranted, audioGranted) => {
                                setPendingProctoringExam(exam);
                                // Set permission status based on pre-check
                                setCameraPermissionStatus(cameraGranted ? 'granted' : 'denied');
                                setAudioPermissionStatus(audioGranted ? 'granted' : 'denied');
                                setShowProctoringSetupDialog(true);
                              }
                            );
                          } else if (isTeacherRole && selectedExam) {
                            // Admin/Principal/Teacher: Enter directly without attendance check
                            setActiveExam(selectedExam);
                            setShowExamInterface(true);
                          }
                        }}
                      />
                    );
                  }
                  
                  // Show locked state (Student View)
                  return (
                    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white">
                      {/* Student Preview Banner - Only shown when in preview mode */}
                      {showStudentPreview && (
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">👁️ Student View Preview</p>
                              <p className="text-white/80 text-xs">This is what students see before exam date</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowStudentPreview(false)}
                            className="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                          >
                            <FontAwesomeIcon icon={faXmark} />
                            <span>Exit Preview</span>
                          </button>
                        </div>
                      )}
                      
                      {/* Student Waiting View */}
                      <div className="flex-1 flex items-center justify-center px-6 py-8">
                      <div className="text-center max-w-xl">
                        {/* Colorful Illustration */}
                        <div className="mb-5 flex justify-center relative">
                          <div className="relative">
                            {/* Background decoration circles */}
                            <div className="absolute -top-2 -left-2 w-16 h-16 bg-purple-100 rounded-full opacity-40"></div>
                            <div className="absolute -bottom-1 -right-1 w-14 h-14 bg-yellow-100 rounded-full opacity-40"></div>
                            
                            {/* Main illustration container */}
                            <div className="relative z-10 flex items-center justify-center space-x-2">
                              {/* Left hand pointing */}
                              <div className="transform -rotate-12">
                                <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
                                  <path d="M30 50 L30 30 L35 25 L40 25 L45 30 L45 50 M45 40 L50 35 L55 35 L60 40 L60 60 M60 45 L65 40 L70 40 L75 45 L75 70 L70 80 L50 85 L35 80 L30 70 L30 50" 
                                        fill="#E8B4A0" stroke="#D4997C" strokeWidth="2"/>
                                  <circle cx="42" cy="35" r="3" fill="#C4896D"/>
                                </svg>
                              </div>
                              
                              {/* Center lock icon */}
                              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex items-center justify-center shadow-md">
                                <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                              
                              {/* Right document/calendar */}
                              <div className="transform rotate-12">
                                <div className="w-14 h-18 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-lg shadow-md relative">
                                  <div className="absolute top-1.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                  <div className="absolute top-3.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                  <div className="absolute top-5.5 left-1.5 right-1.5 h-0.5 bg-white/60 rounded"></div>
                                  <div className="absolute bottom-2 right-1.5 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                         {/* Message - Different for Not Started vs Ended */}
                        {(() => {
                          const examHasEnded = isExamCompleted(
                            selectedExam.examDate, 
                            selectedExam.examTime || '', 
                            selectedExam.duration, 
                            selectedExam.status,
                            selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0
                          );

                          if (examHasEnded) {
                            // Exam has ended - show ended message
                            return (
                              <>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                                  <FontAwesomeIcon icon={faClock} className="mr-2" /> Exam Time Over
                                </h3>
                                <p className="text-gray-600 mb-5 text-sm leading-relaxed text-left">
                                  The exam window has closed and is no longer accepting submissions. Please contact your instructor for any queries.
                                </p>

                                {/* Exam Info Card */}
                                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm mt-2">
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completed</span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedExam.mode === EXAM_MODES.ONLINE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {selectedExam.mode === EXAM_MODES.ONLINE ? <><FontAwesomeIcon icon={faGlobe} className="mr-1" /> Online</> : <><FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Offline</>}
                                    </span>
                                  </div>
                                  
                                  <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                      <div className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">Date</span>
                                      </div>
                                      <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                                    </div>
                                    
                                    {selectedExam.examTime && (
                                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="text-xs font-medium text-gray-700">Time</span>
                                        </div>
                                        <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                                      <div className="flex items-center space-x-2">
                                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">Duration</span>
                                      </div>
                                      <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          } else {
                            // Exam hasn't started yet - show locked message
                            return (
                              <>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                                  <FontAwesomeIcon icon={faLock} className="mr-2" /> Exam Details Locked
                                </h3>
                                <p className="text-gray-600 mb-5 text-sm leading-relaxed text-left">
                                  Full details will be available on the exam date. Only the exam creator can access them before then.
                                </p>
                                {/* Countdown Timer */}
                                <CountdownTimer 
                                  examDate={selectedExam.examDate} 
                                  examTime={selectedExam.examTime}
                                  brandTheme={brandTheme}
                                />
                              </>
                            );
                          }
                        })()}

                        {/* Exam Info Card */}
                        <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Scheduled</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedExam.mode === EXAM_MODES.ONLINE ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {selectedExam.mode === EXAM_MODES.ONLINE ? <><FontAwesomeIcon icon={faGlobe} className="mr-1" /> Online</> : <><FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Offline</>}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-gray-900 mb-3 text-base">{selectedExam.title}</h4>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-medium text-gray-700">Date</span>
                              </div>
                              <span className="text-xs font-bold text-purple-700">{formatExamDate(selectedExam.examDate)}</span>
                            </div>
                            
                            {selectedExam.examTime && (
                              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">Time</span>
                                </div>
                                <span className="text-xs font-bold text-blue-700">{formatExamTime(selectedExam.examTime || '')}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-medium text-gray-700">Duration</span>
                              </div>
                              <span className="text-xs font-bold text-orange-700">{formatDuration((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0))}</span>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-xs font-medium text-gray-700">Creator</span>
                              </div>
                              <span className="text-xs font-bold text-green-700">{(selectedExam.createdByName || selectedExam.createdBy || '').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Footer Note */}
                        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <div className="flex items-start space-x-2">
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xs text-blue-900 text-left flex-1">
                              Questions, answer keys, and detailed settings will unlock on <span className="font-bold">{formatExamDate(selectedExam.examDate)}</span>{selectedExam.examTime && <> at <span className="font-bold">{formatExamTime(selectedExam.examTime || '')}</span></>}
                            </p>
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                }

                // Show full exam details if access is granted
                return (
              <>
            {/* Show Live Stats or Exam Details View */}
            {isViewingLiveStats ? (
              <LiveStats 
                exam={selectedExam as any}
                brandTheme={brandTheme}
                userCollegeId={currentUser?.collegeId || ''}
                onBack={() => {
                  setIsViewingLiveStats(false);
                  // Restore panels when going back
                  setIsLeftCollapsed(false);
                  setIsMainCollapsed(false);
                }}
              />
            ) : isViewingAttendance ? (
              <Attendance 
                exam={selectedExam}
                brandTheme={brandTheme}
                currentUser={currentUser!}
                isExamOver={isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0)}
                onBack={() => {
                  setIsViewingAttendance(false);
                  // Restore panels when going back
                  setIsLeftCollapsed(false);
                  setIsMainCollapsed(false);
                }}
              />
            ) : (
            <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Header  */}
              <div className="bg-white sticky top-0 z-10 pt-6 pb-4 px-8 pr-12 mb-2 border-b border-gray-100">
               {/* Title Row with 3-dots Menu */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900">{safeRender(selectedExam.title)}</h1>
                    
                    {/* Live Indicator for Online Exams */}
                    {selectedExam.mode === EXAM_MODES.ONLINE && isExamLive(selectedExam.examDate, selectedExam.examTime, selectedExam.duration, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0) && (
                      <div className="flex items-center space-x-2">
                        <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </div>
                        <span className="text-sm font-semibold text-green-600">LIVE</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 3-dots Menu */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        // Toggle menu visibility
                        const menu = document.getElementById('exam-menu-dropdown');
                        if (menu) {
                          menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                        }
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                        <circle cx="12" cy="12" r="1" fill="currentColor"/>
                        <circle cx="12" cy="5" r="1" fill="currentColor"/>
                        <circle cx="12" cy="19" r="1" fill="currentColor"/>
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div
                      id="exam-menu-dropdown"
                      style={{ display: 'none' }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                    >
                      {(() => {
                        // Check if there's less than 24 hours until exam starts
                        const now = new Date();
                        const examStartTime = new Date(selectedExam.examDate);
                        
                        if (selectedExam.examTime) {
                          const [hours, minutes] = selectedExam.examTime.split(':').map(Number);
                          examStartTime.setHours(hours, minutes, 0, 0);
                        } else {
                          examStartTime.setHours(0, 0, 0, 0);
                        }
                        
                        // Calculate exam END time (start + duration)
                        const duration = parseInt(selectedExam.duration) || 60;
                        const examEndTime = new Date(examStartTime.getTime() + duration * 60 * 1000);

                        const timeDifference = examStartTime.getTime() - now.getTime();
                        const hoursUntilExam = timeDifference / (1000 * 60 * 60);
                        const isWithin24Hours = hoursUntilExam <= 24 && hoursUntilExam >= 0;

                        // Check exam status
                        const hasExamStarted = now.getTime() > examStartTime.getTime();  // ✅ For delete
                        const hasExamEnded = now.getTime() > examEndTime.getTime();      // ✅ For edit

                        // Separate restrictions for Edit vs Delete
                        const isEditRestricted = hasExamEnded;  // Only block AFTER exam ends
                        const isDeleteRestricted = isWithin24Hours || hasExamStarted;  // ✅ Block from 24h before through end

                        return (
                          <>
                            {/* 1. Student Page - Always first and clickable (Hidden for offline exams) */}
                            {selectedExam.mode !== EXAM_MODES.OFFLINE && (
                              <button
                                onClick={() => {
                                  const menu = document.getElementById('exam-menu-dropdown');
                                  if (menu) menu.style.display = 'none';
                                  setShowStudentPreview(true);
                                  setActiveItem('exams');
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors flex items-center space-x-3 border-b border-gray-200"
                              >
                                <FontAwesomeIcon icon={faClipboardList} className="text-purple-600" />
                                <span className="text-sm font-medium text-gray-900">Student Page</span>
                              </button>
                            )}

                            {/* 2. Edit - Show dialog if restricted */}
                            <button
                              onClick={() => {
                                
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                
                                if (isEditRestricted) {
                                  // Format exam date for display
                                  const examDateFormatted = new Date(selectedExam.examDate).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  });
                                  
                                  setRestrictionMessage({
                                    title: 'Cannot Edit Exam',
                                    message: 'Editing is not allowed after the exam has passed. This ensures exam integrity and prevents changes that could affect completed student submissions.',
                                    icon: '🔒',
                                    examDate: examDateFormatted,
                                    examTime: selectedExam.examTime,
                                    hoursRemaining: hasExamEnded ? 0 : Math.floor(hoursUntilExam)
                                  });
                                  setShowRestrictionDialog(true);
                                } else {
                                  setEditingExam(selectedExam);
                                  setIsCreateModalOpen(true);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faFileLines} className={isEditRestricted ? 'text-gray-400' : 'text-blue-600'} />
                              <span className={`text-sm font-medium ${isEditRestricted ? 'text-gray-500' : 'text-gray-900'}`}>
                                Edit
                              </span>
                            </button>

                            {/* 3. Delete - Show dialog if restricted */}
                            <button
                              onClick={() => {
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                
                                if (isDeleteRestricted) {
                                  // Format exam date for display
                                  const examDateFormatted = new Date(selectedExam.examDate).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  });
                                  
                                  setRestrictionMessage({
                                    title: 'Cannot Delete Exam',
                                    message: hasExamEnded 
                                    ? 'Deletion is not allowed after the exam has passed. This protects historical records, maintains audit trails, and ensures data integrity for all stakeholders.'
                                    : hasExamStarted
                                      ? 'Deletion is not allowed while the exam is in progress. This protects the integrity of the ongoing examination and prevents disruption to students currently taking the exam.'
                                      : 'Deletion is not allowed within 24 hours of the exam start time. This protects student preparation, maintains data integrity, and ensures that last-minute changes don\'t disrupt the examination process.',
                                    icon: '🛡️',
                                    examDate: examDateFormatted,
                                    examTime: selectedExam.examTime,
                                    hoursRemaining: hasExamEnded ? 0 : Math.floor(hoursUntilExam)
                                  });
                                  setShowRestrictionDialog(true);
                                } else {
                                  setExamToDelete(selectedExam);
                                  setShowDeleteExamDialog(true);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDeleteRestricted ? 'text-gray-400' : 'text-red-600'}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className={`text-sm font-medium ${isDeleteRestricted ? 'text-gray-500' : 'text-gray-900'}`}>
                                Delete
                              </span>
                            </button>

                            {/* 4. Attendance */}
                            <button
                              onClick={() => {
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                setIsLeftCollapsed(true);
                                setIsMainCollapsed(true);
                                setIsViewingAttendance(true);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faUserCheck} className={
                                canMarkAttendance(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration)
                                  ? 'text-green-600'
                                  : 'text-gray-400'
                              } />
                              <span className={`text-sm font-medium ${
                                canMarkAttendance(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration)
                                  ? 'text-gray-900'
                                  : 'text-gray-500'
                              }`}>
                                Attendance
                              </span>
                            </button>

                            {/* 5. Live Stats - Show dialog if restricted (Hidden for offline exams) */}
                            {selectedExam.mode !== EXAM_MODES.OFFLINE && (
                              <button
                                onClick={() => {
                                  const menu = document.getElementById('exam-menu-dropdown');
                                  if (menu) menu.style.display = 'none';
                                  
                                  const canView = canViewLiveStats(selectedExam.examDate, selectedExam.examTime || '');
                                  if (canView) {
                                    setIsViewingLiveStats(true);
                                    setIsLeftCollapsed(true);
                                    setIsMainCollapsed(true);
                                  } else {
                                    setRestrictionMessage({
                                      title: 'Live Stats Not Available Yet',
                                      message: 'Live statistics will be enabled 30 minutes before the exam starts and will remain accessible indefinitely. This allows you to monitor exam progress in real-time once the exam window opens.',
                                      icon: '📊'
                                    });
                                    setShowRestrictionDialog(true);
                                  }
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                              >
                                <FontAwesomeIcon icon={faChartBar} className={
                                  canViewLiveStats(selectedExam.examDate, selectedExam.examTime || '')
                                    ? 'text-blue-600'
                                    : 'text-gray-400'
                                } />
                                <span className={`text-sm font-medium ${
                                  canViewLiveStats(selectedExam.examDate, selectedExam.examTime || '')
                                    ? 'text-gray-900'
                                    : 'text-gray-500'
                                }`}>
                                  Live Stats
                                </span>
                              </button>
                            )}

                            {/* 6. View Result - Show dialog if restricted */}
                            <button
                              onClick={() => {
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                
                                const isCompleted = isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0);
                                if (isCompleted) {
                                  // Navigate to Results section and ensure exam stays selected
                                  setActiveItem(ACTIVE_ITEMS.RESULTS);
                                  // Reset other view states
                                  setIsViewingLiveStats(false);
                                  setIsViewingAttendance(false);
                                  setSelectedStudentForDetail(null);
                                } else {
                                  setRestrictionMessage({
                                    title: 'Results Not Available Yet',
                                    message: 'Exam results will be available only after the exam has completely ended. This ensures all students have completed the exam before results are accessible.',
                                    icon: '🏆'
                                  });
                                  setShowRestrictionDialog(true);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center space-x-3 cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faTrophy} className={isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0) ? 'text-green-600' : 'text-gray-400'} />
                              <span className={`text-sm font-medium ${isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0) ? 'text-gray-900' : 'text-gray-500'}`}>
                                View Result
                              </span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Created By Row */}
                <div className="mb-3">
                  <p className="text-[16px] font-medium text-gray-500">
                    Created By - {((selectedExam.createdByName || selectedExam.createdBy || '') as string).split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}, {((selectedExam.createdByRole || '') as string).split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                  </p>
                </div>
                
                {/* Metadata Row */}
                <div className="flex items-center flex-wrap gap-3 text-xs text-gray-700">
                  {/* Student Count */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faUsers} className="mr-1.5" />
                    {safeRender(selectedExam.totalStudents || 0)} Students
                  </span>
                  
                  {/* Exam Type */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faClipboardList} className="mr-1.5" />
                    {safeRender(selectedExam.type)}
                  </span>
                  
                  {/* Mode */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faCalendar} className="mr-1.5" />
                    {EXAM_MODE_LABELS[selectedExam.mode as keyof typeof EXAM_MODE_LABELS] || safeRender(selectedExam.mode)}
                  </span>
                  
                  {/* Status - Calculate real-time */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faTrophy} className="mr-1.5" />
                    {(() => {
                      const examIsLive = isExamLive(
                        selectedExam.examDate, 
                        selectedExam.examTime, 
                        selectedExam.duration,
                        selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0
                      );
                      const examIsCompleted = isExamCompleted(
                        selectedExam.examDate, 
                        selectedExam.examTime, 
                        selectedExam.duration, 
                        selectedExam.status,
                        selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0
                      );
                      
                      if (examIsCompleted) return 'Completed';
                      if (examIsLive) return 'Live';
                      return 'Upcoming';
                    })()}
                  </span>
                  
                  {/* Exam ID */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faFileLines} className="mr-1.5" />
                    {safeRender(selectedExam.id)}
                  </span>
                </div>
              </div>

              {/* Key Information Grid */}
              {(() => {
                const hasRegularQuestions = (selectedExam.questionsList?.length || 0) > 0;
                const hasPool = (selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0;
                const isPersonalityOnly = selectedExam.personalityAssessment && !hasRegularQuestions && !hasPool;
                return (
              <div className={`grid gap-3 mb-6 px-6 ${isPersonalityOnly ? 'grid-cols-3' : (actualRightWidth >= 600 ? 'grid-cols-4' : 'grid-cols-2')}`}>
                <div 
                  className="rounded-xl p-4 border"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${brandTheme.colors.primary}15, ${brandTheme.colors.primary}25)`,
                    borderColor: `${brandTheme.colors.primary}40`
                  }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <FontAwesomeIcon icon={faCalendar} style={{ color: brandTheme.colors.primary }} />
                    <p className="text-xs font-medium" style={{ color: brandTheme.colors.primary }}>Date & Time</p>
                  </div>
                  <p className="text-l font-bold text-gray-900">{formatExamDate(selectedExam.examDate)}</p>
                  {selectedExam.examTime && (
                    <p className="text-xs font-medium text-gray-600 mt-1">{formatExamTime(selectedExam.examTime || '')}</p>
                  )}
                </div>
                <div 
                  className="rounded-xl p-4 border"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${brandTheme.colors.secondary}15, ${brandTheme.colors.secondary}25)`,
                    borderColor: `${brandTheme.colors.secondary}40`
                  }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: brandTheme.colors.secondary }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-medium" style={{ color: brandTheme.colors.secondary }}>Duration</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {(() => {
                      const hasRegularQuestions = (selectedExam.questionsList?.length || 0) > 0;
                      const hasPool = (selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0;
                      const isPersonalityOnly = selectedExam.personalityAssessment && !hasRegularQuestions && !hasPool;
                      const examDuration = isPersonalityOnly ? 0 : parseInt(selectedExam.duration) || 0;
                      const likertDuration = selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0;
                      return formatDuration(examDuration + likertDuration);
                    })()}
                  </p>
                  {selectedExam.personalityAssessment && (selectedExam.likertDuration || 0) > 0 && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {(() => {
                        const hasRegularQuestions = (selectedExam.questionsList?.length || 0) > 0;
                        const hasPool = (selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0;
                        const isPersonalityOnly = !hasRegularQuestions && !hasPool;
                        if (isPersonalityOnly) return `${selectedExam.likertDuration}m assessment only`;
                        return `${selectedExam.likertDuration}m assessment + ${formatDuration(selectedExam.duration)} exam`;
                      })()}
                    </p>
                  )}
                </div>
                <div 
                  className="rounded-xl p-4 border"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${brandTheme.colors.primary}15, ${brandTheme.colors.primary}25)`,
                    borderColor: `${brandTheme.colors.primary}40`
                  }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <FontAwesomeIcon icon={faClipboardList} style={{ color: brandTheme.colors.primary }} />
                    <p className="text-xs font-medium" style={{ color: brandTheme.colors.primary }}>Questions</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{safeRender(selectedExam.totalQuestions)} Qs</p>
                  {selectedExam.personalityAssessment && (selectedExam.likertQuestions?.length || 0) > 0 && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {(() => {
                        const examCount = (selectedExam.totalQuestions || 0) - (selectedExam.likertQuestions?.length || 0);
                        if (examCount > 0) return `${(selectedExam.likertQuestions?.length || 0)} personality + ${examCount} exam`;
                        return `${selectedExam.likertQuestions?.length || 0} personality questions`;
                      })()}
                    </p>
                  )}
                </div>
                {!isPersonalityOnly && (
                <div 
                  className="rounded-xl p-4 border"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${brandTheme.colors.accent}15, ${brandTheme.colors.accent}25)`,
                    borderColor: `${brandTheme.colors.accent}40`
                  }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <FontAwesomeIcon icon={faTrophy} style={{ color: brandTheme.colors.accent }} />
                    <p className="text-xs font-medium" style={{ color: brandTheme.colors.accent }}>Max Marks</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{safeRender(selectedExam.maxMarks)}</p>
                </div>
                )}
              </div>
                );
              })()}

              

              {/* Question Paper / Questions List Section */}
              {selectedExam.mode === EXAM_MODES.OFFLINE ? (
                // Offline Exam - Show Scanned Images
                <div className="bg-white p-5 mb-6 mx-6 border border-gray-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                     <FontAwesomeIcon icon={faLayerGroup} className="text-gray-600" />
                    <span>Question Paper Images</span>
                    <span className="ml-auto text-xs font-medium text-gray-500">
                      {selectedExam.questionPaperImages?.length || 0} Pages
                    </span>
                  </h3>
                  {selectedExam.questionPaperImages && selectedExam.questionPaperImages.length > 0 ? (
                      <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <div className="flex flex-nowrap space-x-3" style={{ minWidth: 'max-content' }}>
                        {selectedExam.questionPaperImages.map((imageUrl, index) => (
                          <div 
                            key={index} 
                            className="flex-shrink-0 relative group cursor-pointer"
                            onClick={() => {
                              setCarouselImages(selectedExam.questionPaperImages || []);
                              setCurrentImageIndex(index);
                              setImageCarouselOpen(true);
                            }}
                          >
                            <div 
                              className="relative w-32 h-44 rounded-lg overflow-hidden border border-gray-200 transition-all shadow-sm hover:shadow-lg"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = brandTheme.colors.primary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              <img 
                                src={imageUrl} 
                                alt={`Page ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 group-hover:opacity-90 transition-opacity" />
                              <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
                                <span className="text-xs font-semibold text-white bg-black/50 px-2 py-1 rounded">
                                  Page {index + 1}
                                </span>
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-white/90 rounded-full p-2">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: brandTheme.colors.primary }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileLines} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">No Images Uploaded</p>
                          <p className="text-xs text-gray-500">Upload scanned pages</p>
                        </div>
                      </div>
                      <button 
                        className="text-xs font-medium px-3 py-1.5 bg-white rounded-md transition-colors border"
                        style={{ 
                          color: brandTheme.colors.primary,
                          borderColor: `${brandTheme.colors.primary}33`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Upload
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Online Exam - Show Questions List
                <>
                  {/* Personality Assessment (Likert) Section */}
                  {selectedExam.personalityAssessment && selectedExam.likertQuestions && selectedExam.likertQuestions.length > 0 && (
                    <div className="bg-white p-2 mb-4 px-6">
                      <div 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          const el = document.getElementById('likert-section-collapse');
                          if (el) el.classList.toggle('hidden');
                          const icon = document.getElementById('likert-chevron');
                          if (icon) icon.classList.toggle('rotate-180');
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                            <FontAwesomeIcon icon={faChartBar} className="text-purple-600" />
                            <span>{(() => { const _hq = (selectedExam.questionsList?.length || 0) > 0; const _hp = !!((selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0); return (_hq || _hp) ? 'Section A — ' : ''; })()}Personality Assessment</span>
                          </h3>
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full flex items-center space-x-1.5">
                              <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                              <span>{selectedExam.likertDuration || 10} min</span>
                            </span>
                            <FontAwesomeIcon 
                              id="likert-chevron"
                              icon={faChevronDown} 
                              className="text-gray-400 text-sm transition-transform duration-200" 
                            />
                          </div>
                        </div>
                        <div className="text-xs font-medium text-gray-500">
                          Total Questions: {selectedExam.likertQuestions.length} • Big-8 personality traits{((selectedExam.questionsList?.length || 0) > 0 || ((selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0)) ? ' • Completed before the main exam' : ''}
                        </div>
                      </div>

                      <div id="likert-section-collapse" className="">
                        <div className="space-y-4 mt-3">
                          {selectedExam.likertQuestions.map((q: any, idx: number) => {
                            const isLikertExpanded = expandedQuestionId === `likert-${q.id || idx}`;
                            return (
                            <div 
                              key={q.id || idx}
                              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200"
                              onMouseEnter={(e: any) => {
                                e.currentTarget.style.borderColor = brandTheme.colors.primary;
                              }}
                              onMouseLeave={(e: any) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              {/* Question Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                    style={{ background: brandTheme.gradients.primary }}
                                  >
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">
                                      LIKERT
                                    </span>
                                    {q.board && (
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">
                                        {q.board.toString().toUpperCase()}
                                      </span>
                                    )}
                                    {q.complexity && (
                                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                                        q.complexity === 'easy' ? 'bg-pink-100 text-pink-700' :
                                        q.complexity === 'medium' ? 'bg-green-100 text-green-700' :
                                        'bg-cyan-100 text-cyan-700'
                                      }`}>
                                        {q.complexity.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Question Text */}
                              <div className="text-sm text-gray-800 mb-3 leading-relaxed">
                                {q.questionText || q.question_text}
                              </div>

                              {/* Expanded Likert Detail */}
                              {isLikertExpanded && (
                                <div className="mt-3 mb-3 space-y-4">
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trait</span>
                                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                                        {q.likertTrait || q.chapter || '—'}
                                      </span>
                                    </div>
                                    {q.likertDirection && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direction</span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                          q.likertDirection === 'positive' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                          {q.likertDirection === 'positive' ? '↑ Positive' : '↓ Reverse'}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h4 className="text-base font-semibold text-gray-900 mb-2">Likert Scale</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                      {(q.options || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']).map((option: string, optIdx: number) => {
                                        const score = q.correctAnswers?.[optIdx];
                                        const isHighest = score && Number(score) === 5;
                                        const isLowest = score && Number(score) === 1;
                                        return (
                                          <div 
                                            key={optIdx}
                                            className={`rounded-xl p-2.5 text-center border-2 ${
                                              isHighest ? 'border-green-300 bg-green-50' :
                                              isLowest ? 'border-red-200 bg-red-50' :
                                              'border-gray-200 bg-gray-50'
                                            }`}
                                          >
                                            <div className={`text-xl font-bold mb-0.5 ${
                                              isHighest ? 'text-green-600' :
                                              isLowest ? 'text-red-500' :
                                              'text-gray-500'
                                            }`}>
                                              {score ?? (optIdx + 1)}
                                            </div>
                                            <div className="text-[9px] font-medium text-gray-600 leading-tight">{option}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {q.correctAnswers && (
                                      <p className="text-[10px] text-gray-400 mt-1.5 mb-2 text-center">
                                        Score mapping: {q.correctAnswers.join(' → ')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Footer */}
                              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  {/* Source Label */}
                                  <div className="flex items-center space-x-1">
                                    {q.source === 'custom' ? (
                                      <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                                        <FontAwesomeIcon icon={faLayerGroup} />
                                        <span className="font-semibold">Custom</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                                        <FontAwesomeIcon icon={faBookOpen} />
                                        <span className="font-semibold">Question Bank</span>
                                      </div>
                                    )}
                                  </div>
                                  {q.createdByName && (
                                    <div className="flex items-center space-x-1">
                                      <FontAwesomeIcon icon={faUser} />
                                      <span>Created by: {q.createdByName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>
                                    </div>
                                  )}
                                  {(() => {
                                    const qCreatedAt = q.createdAt || selectedExam.createdAt;
                                    const formatted = qCreatedAt ? formatDate(qCreatedAt) : '';
                                    return formatted ? (
                                    <div className="flex items-center space-x-1">
                                      <FontAwesomeIcon icon={faCalendar} />
                                      <span>{formatted}</span>
                                    </div>
                                    ) : null;
                                  })()}
                                </div>

                                <div className="flex items-center space-x-3">
                                  {q.source === 'custom' || q.isProprietaryQuestion ? (
                                    <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                                      <FontAwesomeIcon icon={faTrophy} />
                                      <span className="text-xs font-semibold">Private</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                        <path d="M2 12h20"/>
                                      </svg>
                                      <span className="text-xs font-semibold">Public</span>
                                    </div>
                                  )}
                                  
                                  <button
                                    onClick={() => setExpandedQuestionId(isLikertExpanded ? null : `likert-${q.id || idx}`)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors text-blue-600 hover:bg-blue-50"
                                  >
                                    {isLikertExpanded ? 'Hide Details' : 'View Details'}
                                  </button>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Questions List - shown only when questionsList has items */}
                  {(selectedExam.questionsList?.length || 0) > 0 && (
                  <div className="bg-white p-2 mb-6 px-6">
                  <div 
                    className="mb-4 cursor-pointer select-none"
                    onClick={() => {
                      const el = document.getElementById('questions-section-collapse');
                      if (el) el.classList.toggle('hidden');
                      const icon = document.getElementById('questions-chevron');
                      if (icon) icon.classList.toggle('rotate-180');
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                      <FontAwesomeIcon icon={faClipboardList} className="text-gray-600" />
                      <span>{(() => { const _hl = !!(selectedExam.personalityAssessment && (selectedExam.likertQuestions?.length || 0) > 0); const _hp = !!((selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0); if ([_hl, true, _hp].filter(Boolean).length < 2) return ''; return _hl ? 'Section B — ' : 'Section A — '; })()}Questions List</span>
                    </h3>
                    <FontAwesomeIcon 
                      id="questions-chevron"
                      icon={faChevronDown} 
                      className="text-gray-400 text-sm transition-transform duration-200" 
                    />
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                      {(() => {
                        if (!selectedExam.questionsList || selectedExam.questionsList.length === 0) {
                          return <span>Total Questions: {selectedExam.questionsList?.length || 0} • Max Marks: {safeRender(selectedExam.maxMarks)}</span>;
                        }
                        
                        const mcqCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.MCQ).length;
                        const fitbCount = selectedExam.questionsList.filter((q: any) => {
                          const typeStr = (q.type || '').toString().toLowerCase().replace(/\s+/g, '');
                          const hasBlanks = q.blanks && Array.isArray(q.blanks) && q.blanks.length > 0;
                          return hasBlanks || typeStr === QUESTION_TYPES.FITB || q.type === QUESTION_TYPES.FITB;
                        }).length;
                        const descriptiveCount = selectedExam.questionsList.filter((q: any) => {
                          const hasBlanks = q.blanks && Array.isArray(q.blanks) && q.blanks.length > 0;
                          return q.type === QUESTION_TYPES.DESCRIPTIVE && !hasBlanks;  // Don't count FITB questions stored as descriptive
                        }).length;
                        const jumbledCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.JUMBLED).length;
                        const codeCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.CODE).length;
                        const sqlCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.SQL).length;
                        
                        const parts = [
                          `Total Questions: ${selectedExam.questionsList.length}`,
                          `Max Marks: ${safeRender(selectedExam.maxMarks)}`
                        ];
                        
                        if (mcqCount > 0) parts.push(`MCQ: ${mcqCount}`);
                        if (fitbCount > 0) parts.push(`FITB: ${fitbCount}`);
                        if (descriptiveCount > 0) parts.push(`Descriptive: ${descriptiveCount}`);
                        if (jumbledCount > 0) parts.push(`Jumbled: ${jumbledCount}`);
                        if (codeCount > 0) parts.push(`Code: ${codeCount}`);
                        if (sqlCount > 0) parts.push(`SQL: ${sqlCount}`);
                        
                        return <span>{parts.join(' • ')}</span>;
                      })()}
                    </div>
                  </div>
                  
                  <div id="questions-section-collapse">
                  {selectedExam.questionsList && selectedExam.questionsList.length > 0 ? (
                   <div 
                      className="space-y-4"
                    >
                      {selectedExam.questionsList.map((question, index) => (
                        <div 
                          key={question.id} 
                          className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = brandTheme.colors.primary;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          {/* Question Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                style={{ background: brandTheme.gradients.primary }}
                              >
                                {index + 1}
                              </div>
<div>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 mr-2">
                                  {(() => {
                                    const typeStr = (question.type || '').toString().toLowerCase().replace(/\s+/g, '');
                                    // Check ONLY for blanks array (not correctAnswers, as MCQ uses that too!)
                                    const hasBlanks = (question as any).blanks && Array.isArray((question as any).blanks) && (question as any).blanks.length > 0;
                                    
                                    // Debug logging - check browser console for actual type value
                                    if (hasBlanks || question.type?.toString().toLowerCase().includes('fill')) {
                                      // console.log('🔍 FITB Question Debug:', {
                                        // originalType: question.type,
                                        // typeStr: typeStr,
                                        // hasBlanks: (question as any).blanks?.length || 0,
                                        // hasCorrectAnswers: question.correctAnswers?.length || 0,
                                        // questionTitle: question.title?.substring(0, 50),
                                        // detectedAs: hasBlanks ? 'FITB (by blanks array)' : 'checking type field...'
                                      // });
                                    }
                                    
                                    if (question.type === QUESTION_TYPES.MCQ) return QUESTION_TYPE_LABELS[QUESTION_TYPES.MCQ];
                                    // PRIORITY: Check blanks array first, then type
                                    if (hasBlanks || typeStr === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.FITB) return QUESTION_TYPE_LABELS[QUESTION_TYPES.FITB];
                                    if (question.type === QUESTION_TYPES.JUMBLED) return QUESTION_TYPE_LABELS[QUESTION_TYPES.JUMBLED];
                                    if (question.type === QUESTION_TYPES.CODE) return QUESTION_TYPE_LABELS[QUESTION_TYPES.CODE];
                                    if (question.type === QUESTION_TYPES.SQL) return QUESTION_TYPE_LABELS[QUESTION_TYPES.SQL];
                                    return QUESTION_TYPE_LABELS[QUESTION_TYPES.DESCRIPTIVE];
                                  })()}
                                </span>
                                {question.board && (
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">
                                    {safeRender(question.board).toUpperCase()}
                                  </span>
                                )}
                                {question.complexity && (
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                                    question.complexity === 'easy' ? 'bg-pink-100 text-pink-700' :
                                    question.complexity === 'medium' ? 'bg-green-100 text-green-700' :
                                    'bg-cyan-100 text-cyan-700'
                                  }`}>
                                    {typeof question.complexity === 'string' ? question.complexity.toUpperCase() : safeRender(question.complexity)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1">
                              {/* Image Gallery Icon - Show if question has images */}
                              {question.imageUrls && Array.isArray(question.imageUrls) && question.imageUrls.length > 0 && (
                                <button
                                  onClick={() => {
                                    const images = question.imageUrls || [];
                                    // console.log('🖼️ Opening carousel with images:', images);
                                    setCarouselImages(images);
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
                                <span className="text-sm font-bold text-gray-900">{safeRender(question.marks)}</span>
                                <span className="text-xs text-gray-600 ml-1">marks</span>
                              </div>
                              {expandedQuestionId === question.id && (
                                <button
                                  onClick={() => setExpandedQuestionId(null)}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Close details"
                                >
                                  <FontAwesomeIcon icon={faXmark} className="text-gray-600" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Question Text */}
                          <div className="mb-3">
                            <div className="space-y-3">
                              {(() => {
                                // Process the HTML to wrap code blocks with copy buttons and syntax highlighting
                                const processHTML = (html: string) => {
                                  // First, render math formulas before processing anything else
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
                                        console.error('KaTeX rendering error:', e);
                                        return match;
                                      }
                                    }
                                  );
                                  
                                  // Split by code tags (original logic)
                                  const parts = html.split(/(<code>.*?<\/code>)/gs);
                                  
                                  return parts.map((part, index) => {
                                    // Check if this is a code block
                                    const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                                    
                                    if (codeMatch) {
                                      const codeContent = codeMatch[1];
                                      const codeId = `code-${question.id}-${index}`;
                                      
                                      // Determine programming language
                                      const detectLanguage = (code: string): string => {
                                        // If it's a code question, use its language
                                        if ((question as any).programmingLanguage) {
                                          return (question as any).programmingLanguage.toLowerCase();
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
                                        <div key={index} className="relative rounded-lg overflow-hidden isolate">
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
                                          [&_li]:mb-1
                                          [&_.katex]:text-sm [&_.katex]:inline-block
                                          [&>pre:empty]:hidden [&>pre:empty]:opacity-0 [&>pre:empty]:h-0 [&>pre:empty]:m-0 [&>pre:empty]:p-0"
                                        dangerouslySetInnerHTML={{ __html: part }}
                                      />
                                    );
                                  });
                                };
                                
                                return processHTML(question.questionText);
                              })()}
                            </div>
                          </div>

                          {/* MCQ Options - Simple view without correct answer when collapsed */}
                          {question.type === QUESTION_TYPES.MCQ && question.options && question.options.length > 0 && expandedQuestionId !== question.id && (
                            <div className="mt-3 space-y-2">
                              {question.options.map((option: string, optIndex: number) => (
                                <div
                                  key={optIndex}
                                  className="flex items-center space-x-2 p-2.5 rounded-lg border bg-gray-50 border-gray-200"
                                >
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-300 text-gray-700">
                                    {String.fromCharCode(65 + optIndex)}
                                  </div>
                                  <div 
                                    className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                      [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                      [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                      [&_strong]:font-semibold"
                                    dangerouslySetInnerHTML={{ __html: option }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Jumbled Question Items - Simple display with grip dots (NO HEADING in collapsed view) */}
                         {question.type === QUESTION_TYPES.JUMBLED && expandedQuestionId !== question.id && (
                          <div className="mt-3 space-y-2">
                            {(() => {
                              // Get jumbledItems if they exist (pre-shuffled)
                              const jumbledItemsRaw = (question as any).jumbledItems;
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
                                    <div 
                                      className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                        [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                        [&_code]:bg-purple-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                        [&_strong]:font-semibold"
                                      dangerouslySetInnerHTML={{ __html: item }}
                                    />
                                  </div>
                                )) : null;
                              })()}
                            </div>
                          )}

                          {/* FITB - No special display in collapsed view, just the question text */}
                          {/* Filled answers will be shown in expanded "View Details" section */}

                                                   {/* FITB - No special display in collapsed view, just the question text */}
                          {/* Filled answers will be shown in expanded section */}

                          {/* ===== CODE QUESTIONS - Chapter Section (shown first for code) ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && 'chapter' in question && question.chapter && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                              <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                            </div>
                          )}

                          {/* ===== CODE QUESTIONS - Solution Hint ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.hint && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Solution Hint</h2>
                              <div 
                                className="text-sm text-gray-700 italic prose prose-sm max-w-none
                                  [&>p]:text-sm [&>p]:text-gray-700 [&>p]:mb-1
                                  [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                  [&_strong]:font-semibold"
                                dangerouslySetInnerHTML={{ __html: question.hint }}
                              />
                            </div>
                          )}

                          {/* ===== MCQ - Options with Correct Answer ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.MCQ && question.options && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Options with Correct Answer</h2>
                              <div className="space-y-2">
                                {question.options.map((option: string, optIndex: number) => {
                                  // Check if this option is correct
                                  // Method 1: Index-based (question.correctAnswer)
                                  const isCorrectByIndex = (question as any).correctAnswer === optIndex;
                                  
                                  // Method 2: Text-based (question.correctAnswers array)
                                  const isCorrectByText = question.correctAnswers && 
                                    Array.isArray(question.correctAnswers) && 
                                    question.correctAnswers.some((ans: string) => 
                                      ans.trim().toLowerCase() === option.trim().toLowerCase()
                                    );
                                  
                                  const isCorrect = isCorrectByIndex || isCorrectByText;
                                  
                                  return (
                                    <div
                                      key={optIndex}
                                      className={`flex items-center p-2.5 rounded-lg border ${
                                        isCorrect
                                          ? 'bg-green-50 border-green-300'
                                          : 'bg-white border-gray-200'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-2">
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
                                      </div>
                                      {isCorrect && (
                                        <span className="ml-auto text-xs font-semibold text-green-600 flex-shrink-0">✓ Correct Answer</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ===== FITB - Correct Answers ===== */}
                          {expandedQuestionId === question.id && (() => {
                            // Check all possible type variations
                            const typeStr = (question.type || '').toString().toLowerCase().replace(/\s+/g, '');
                            const isFITB = typeStr === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.FITB;
                            
                            // Get answers from correctAnswers
                            const answers = question.correctAnswers;
                            
                            if (!isFITB || !answers || !Array.isArray(answers) || answers.length === 0) {
                              return null;
                            }

                            return (
                              <div className="mt-4">
                                {/* Correct Answers - as h2 heading without box */}
                                <h2 className="text-lg font-bold text-gray-900 mb-3">Correct Answers:</h2>
                                <div className="flex flex-wrap gap-2">
                                  {answers.map((blank: string, blankIndex: number) => (
                                    <span
                                      key={blankIndex}
                                      className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg"
                                    >
                                      Blank {blankIndex + 1}: {safeRender(blank)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* ===== JUMBLED - Items to Arrange & Correct Sequence (Independent Headings) ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.JUMBLED && (() => {
                            // Convert correctAnswers from Firebase format if needed
                            const correctAnswersArray = convertToArray(question.correctAnswers);
                            const hasCorrectAnswers = correctAnswersArray && correctAnswersArray.length > 0;
                            
                            if (!hasCorrectAnswers) return null;
                            
                            return (
                              <>
                                {/* Jumbled Items (What student sees) */}
                                <div className="mt-4">
                                  <h2 className="text-lg font-bold text-gray-900 mb-3">Items to Arrange:</h2>
                                  <div className="space-y-2">
                                    {(() => {
                                      const jumbledItemsRaw = (question as any).jumbledItems;
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
                                          <div 
                                            className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                              [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                              [&_code]:bg-purple-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                              [&_strong]:font-semibold"
                                            dangerouslySetInnerHTML={{ __html: item }}
                                          />
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>

                                {/* Correct Sequence (The Answer) */}
                                <div className="mt-4">
                                  <h2 className="text-lg font-bold text-gray-900 mb-3">Correct Sequence:</h2>
                                  <div className="space-y-2">
                                    {correctAnswersArray.map((item: string, seqIndex: number) => (
                                      <div
                                        key={seqIndex}
                                        className="flex items-center space-x-2 p-2.5 rounded-lg border bg-green-50 border-green-300"
                                      >
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-green-500 text-white">
                                          {seqIndex + 1}
                                        </div>
                                        <div 
                                          className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                            [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                            [&_code]:bg-green-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                            [&_strong]:font-semibold"
                                          dangerouslySetInnerHTML={{ __html: item }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          })()}

                          {/* ===== LIKERT QUESTIONS - Detail ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.LIKERT && (
                            <div className="mt-4 space-y-4">
                              {/* Trait & Direction */}
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trait</span>
                                  <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                                    {(question as any).likertTrait || (question as any).chapter || '—'}
                                  </span>
                                </div>
                                {(question as any).likertDirection && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direction</span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                      (question as any).likertDirection === 'positive' 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {(question as any).likertDirection === 'positive' ? '↑ Positive' : '↓ Reverse'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Likert Scale Options with Scoring */}
                              <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3">Likert Scale</h2>
                                <div className="grid grid-cols-5 gap-2">
                                  {((question as any).options || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']).map((option: string, idx: number) => {
                                    const score = (question as any).correctAnswers?.[idx];
                                    const isHighest = score && Number(score) === 5;
                                    const isLowest = score && Number(score) === 1;
                                    return (
                                      <div 
                                        key={idx}
                                        className={`rounded-xl p-3 text-center border-2 transition-all ${
                                          isHighest ? 'border-green-300 bg-green-50' :
                                          isLowest ? 'border-red-200 bg-red-50' :
                                          'border-gray-200 bg-gray-50'
                                        }`}
                                      >
                                        <div className={`text-2xl font-bold mb-1 ${
                                          isHighest ? 'text-green-600' :
                                          isLowest ? 'text-red-500' :
                                          'text-gray-500'
                                        }`}>
                                          {score ?? (idx + 1)}
                                        </div>
                                        <div className="text-[10px] font-medium text-gray-600 leading-tight">{option}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {(question as any).correctAnswers && (
                                  <p className="text-xs text-gray-400 mt-2 mb-4 text-center">
                                    Score mapping: {(question as any).correctAnswers.join(' → ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ===== NON-CODE/SQL QUESTIONS - Chapter ===== */}
                          {expandedQuestionId === question.id && question.type !== 'code' && question.type !== QUESTION_TYPES.SQL && question.type !== QUESTION_TYPES.LIKERT && 'chapter' in question && question.chapter && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                              <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                            </div>
                          )}

                          {/* ===== NON-CODE/SQL QUESTIONS - Hint ===== */}
                          {expandedQuestionId === question.id && question.type !== 'code' && question.type !== QUESTION_TYPES.SQL && question.hint && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Hint</h2>
                              <div 
                                className="text-sm text-gray-700 italic prose prose-sm max-w-none
                                  [&>p]:text-sm [&>p]:text-gray-700 [&>p]:mb-1
                                  [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                  [&_strong]:font-semibold"
                                dangerouslySetInnerHTML={{ __html: question.hint }}
                              />
                            </div>
                          )}

                          {/* ===== NON-CODE/SQL QUESTIONS - Solution ===== */}
                          {expandedQuestionId === question.id && question.type !== 'code' && question.type !== QUESTION_TYPES.SQL && question.solution && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Solution</h2>
                              {(question.type === QUESTION_TYPES.MCQ || question.type === QUESTION_TYPES.JUMBLED || question.type === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.DESCRIPTIVE) ? (
                                // Enhanced solution display for MCQ, jumbled, FITB, and descriptive questions
                                <div>
                                    {(() => {
                                      // Parse the solution to extract sections
                                      const parser = new DOMParser();
                                      const doc = parser.parseFromString(question.solution, 'text/html');
                                      const elements: ReactElement[] = [];
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
                                            
                                            // Skip "Correct Answer:" heading - it's redundant in solution section
                                            if (text.match(/^Correct Answer:?$/i) || text.match(/^<strong>Correct Answer:?<\/strong>$/i)) {
                                              return;
                                            }
                                            
                                            const innerHTML = element.innerHTML?.trim() || '';
                                            if (innerHTML.match(/^<strong>Correct Answer:?<\/strong>$/i) || innerHTML.match(/^Correct Answer:?$/i)) {
                                              return;
                                            }
                                            
                                            if (text.includes('Correct Sequence:')) {
                                              const hasSpans = innerHTML.includes('<span');
                                              elements.push(
                                                <h3 
                                                  key={`heading-${keyCounter++}`} 
                                                  className="text-base font-bold text-gray-900 mb-2"
                                                  {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                                />
                                              );
                                            } else if (text.match(/^(Output:|Why this order:|Steps:|Note:|Important:)/i)) {
                                              const hasSpans = innerHTML.includes('<span');
                                              elements.push(
                                                <h4 
                                                  key={`subheading-${keyCounter++}`} 
                                                  className="text-sm font-semibold text-gray-800 mt-3 mb-1"
                                                  {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                                />
                                              );
                                            } else if (text) {
                                              const hasSpans = innerHTML.includes('<span');
                                              
                                              if (hasSpans) {
                                                elements.push(
                                                  <p 
                                                    key={`para-${keyCounter++}`} 
                                                    className="text-sm text-gray-700 leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: innerHTML }}
                                                  />
                                                );
                                              } else {
                                                elements.push(
                                                  <p key={`para-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                                    {text}
                                                  </p>
                                                );
                                              }
                                            }
                                          } else if (tagName === 'pre' || tagName === 'code') {
                                            // Check if this code has highlighting spans
                                            const innerHTML = element.innerHTML || '';
                                            const hasHighlights = innerHTML.includes('bg-yellow') || 
                                                                   innerHTML.includes('bg-amber') || 
                                                                   innerHTML.includes('bg-green') ||
                                                                   innerHTML.includes('background-color');
                                            
                                            if (hasHighlights) {
                                              // Preserve the HTML with highlights
                                              const codeId = `code-${question.id}-${keyCounter}`;
                                              elements.push(
                                                <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden bg-gray-900 isolate">
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
                                              const codeContent = element.textContent || '';
                                              const detectLanguage = (code: string): string => {
                                                // Priority 1: Use question's programming language if available
                                                if (question.programmingLanguage) {
                                                  return question.programmingLanguage.toLowerCase();
                                                }
                                                
                                                // Priority 2: Auto-detect based on code patterns
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
                                                return 'java';
                                              };
                                              
                                              const language = detectLanguage(codeContent);
                                              const codeId = `code-${question.id}-${keyCounter}`;
                                              
                                              elements.push(
                                                <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden isolate">
                                                  <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                                    <div className="flex items-center space-x-2">
                                                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                    </div>
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
                                          } else if (tagName === 'ul' || tagName === 'ol') {
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
                                            // Default: treat as paragraph
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
                                // Standard solution display for other question types (fallback)
                                <div 
                                  className="prose prose-sm max-w-none
                                    [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-2 [&>h1]:mt-1
                                    [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-2 [&>h2]:mt-1
                                    [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-1
                                    [&>p]:text-sm [&>p]:text-gray-800 [&>p]:mb-2 [&>p]:leading-relaxed
                                    [&_strong]:font-bold [&_strong]:text-gray-900
                                    [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-gray-800
                                    [&_br]:block [&_br]:mb-2
                                    [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2
                                    [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2
                                    [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ __html: question.solution }}
                                />
                              )}
                            </div>
                          )}

                          {/* ===== CODE QUESTIONS - Test Cases ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && 
                           (question as any).testCases && Array.isArray((question as any).testCases) && (question as any).testCases.length > 0 && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-bold text-gray-900">Test Cases</h2>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-medium text-gray-600">
                                    {(question as any).testCases.length} test cases
                                  </span>
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                                    Total: {(question as any).testCases.reduce((sum: number, tc: any) => sum + (Number(tc.marks) || 0), 0).toFixed(1)} marks
                                  </span>
                                </div>
                              </div>

                              <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-100 border-b border-gray-200">
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">#</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Input</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Expected Output</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Marks</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {(question as any).testCases.map((testCase: any, tcIndex: number) => {
                                      const formatTcValue = (val: any): string => {
                                        if (val == null) return 'N/A';
                                        if (typeof val === 'string') return val.replace(/\\n/g, '\n');
                                        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
                                        if (Array.isArray(val)) return val.join('\n');
                                        if (typeof val === 'object') return JSON.stringify(val, null, 2);
                                        return String(val);
                                      };
                                      return (
                                      <tr key={tcIndex} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-center">
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white bg-blue-500">
                                            {tcIndex + 1}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 whitespace-pre-wrap">
                                            {formatTcValue(testCase.input)}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-200 text-green-700 whitespace-pre-wrap">
                                            {formatTcValue(testCase.expected_output)}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
                                            {testCase.marks != null && !isNaN(Number(testCase.marks)) ? Number(testCase.marks).toFixed(1) : '0.0'}
                                          </span>
                                        </td>
                                      </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* ===== CODE QUESTIONS - Starter Code Template ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && ((question as any).testStub || (question as any).test_stub) && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Starter Code Template</h2>
                              <div className="relative rounded-lg overflow-hidden isolate">
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
                                    onClick={() => copyToClipboard((question as any).testStub || (question as any).test_stub, `stub-${question.id}`)}
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
                                    language={(question as any).programmingLanguage?.toLowerCase() || 'python'}
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
                                    {(question as any).testStub || (question as any).test_stub}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            </div>
                          )}


                          {/* ===== SQL QUESTIONS - Schema & Test Cases ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.SQL && (() => {
                            const sqlSchema = (question as any).sqlSchema || [];
                            const sqlTestCases = ((question as any).sqlTestCases || []).map((tc: any) => ({
                              ...tc,
                              table_data: typeof tc.table_data === 'string' ? JSON.parse(tc.table_data || '{}') : (tc.table_data || {}),
                              expected_output: typeof tc.expected_output === 'string' ? JSON.parse(tc.expected_output || '{"columns":[],"rows":[]}') : (tc.expected_output || { columns: [], rows: [] })
                            }));
                            return (
                              <div className="mt-3 space-y-4">
                                {/* Schema Tables */}
                                {sqlSchema.length > 0 && (
                                  <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-2">Table Schema</h2>
                                    <div className="space-y-3">
                                      {sqlSchema.map((table: any, tIdx: number) => (
                                        <div key={tIdx} className="border border-green-200 rounded-lg overflow-hidden">
                                          <div className="px-3 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
                                            <span className="text-sm font-bold text-green-700">{table.table_name || `Table ${tIdx + 1}`}</span>
                                            {table.primary_key && <span className="text-xs text-gray-500">PK: <span className="font-mono font-semibold">{table.primary_key}</span></span>}
                                          </div>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="bg-gray-50 border-b">
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Column</th>
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Type</th>
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Description</th>
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Constraints</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(table.columns || []).filter((c: any) => c.name).map((col: any, cIdx: number) => (
                                                  <tr key={cIdx} className={cIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                    <td className="px-3 py-1.5 font-mono font-semibold text-gray-900">{col.name}</td>
                                                    <td className="px-3 py-1.5 font-mono text-blue-600 uppercase">{col.type}</td>
                                                    <td className="px-3 py-1.5 text-gray-600">{col.description || '—'}</td>
                                                    <td className="px-3 py-1.5 text-gray-600">{col.constraints || '—'}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                          {table.note && <div className="px-3 py-1.5 bg-gray-50 border-t text-xs text-gray-500 italic">{table.note}</div>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* SQL Test Cases */}
                                {sqlTestCases.length > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h2 className="text-lg font-bold text-gray-900">Test Cases</h2>
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                                        Total: {sqlTestCases.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0).toFixed(1)} marks
                                      </span>
                                    </div>
                                    <div className="space-y-3">
                                      {sqlTestCases.map((tc: any, tcIdx: number) => (
                                        <div key={tcIdx} className="border border-amber-200 rounded-lg overflow-hidden">
                                          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                                            <span className="text-sm font-bold text-amber-700">{tc.title || `Test Case ${tcIdx + 1}`}</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">{(tc.marks || 0).toFixed(1)} marks</span>
                                          </div>
                                          <div className="p-3 space-y-3">
                                            {/* Input Tables */}
                                            {Object.entries(tc.table_data || {}).map(([tableName, rows]: [string, any]) => {
                                              const schemaColumns = (sqlSchema.find((t: any) => t.table_name === tableName)?.columns || []).filter((c: any) => c.name).map((c: any) => c.name);
                                              const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
                                              const isHeaderRow = schemaColumns.length > 0 && firstRow.length === schemaColumns.length && firstRow.every((cell: string, i: number) => cell === schemaColumns[i]);
                                              const dataRows = isHeaderRow ? (rows as string[][]).slice(1) : (rows as string[][]);
                                              return (
                                              <div key={tableName} className="border border-blue-100 rounded overflow-hidden">
                                                <div className="px-2 py-1 bg-blue-50 border-b border-blue-100">
                                                  <span className="text-[10px] font-bold text-blue-600">📥 Input: {tableName}</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-xs">
                                                    <thead><tr className="bg-gray-50">{schemaColumns.map((colName: string, ci: number) => (<th key={ci} className="px-2 py-1 text-left font-semibold text-gray-600 border-b">{colName}</th>))}</tr></thead>
                                                    <tbody>{dataRows.map((row: string[], rIdx: number) => (<tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>{row.map((cell: string, ci: number) => (<td key={ci} className="px-2 py-1 font-mono border-b border-gray-100">{cell}</td>))}</tr>))}</tbody>
                                                  </table>
                                                </div>
                                              </div>
                                              );
                                            })}
                                            {/* Expected Output */}
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
                                  </div>
                                )}

                                {/* Chapter for SQL */}
                                {(question as any).chapter && (
                                  <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                                    <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                                  </div>
                                )}

                                {/* Hint for SQL */}
                                {question.hint && (
                                  <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-2">Hint</h2>
                                    <div 
                                      className="text-sm text-gray-700 italic prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: question.hint }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}


                          
                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              {/* Source Label */}
                              <div className="flex items-center space-x-1">
                                {(question as any).source === 'custom' ? (
                                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                    <span className="font-semibold">Custom</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                                    <FontAwesomeIcon icon={faBookOpen} />
                                    <span className="font-semibold">Question Bank</span>
                                  </div>
                                )}
                              </div>
                              {(question as any).createdByName && (
                                <div className="flex items-center space-x-1">
                                  <FontAwesomeIcon icon={faUser} />
                                  <span>Created by: {(question as any).createdByName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>
                                </div>
                              )}
                              {(() => {
                                const qCreatedAt = question.createdAt || (question as any).createdAt || selectedExam.createdAt;
                                const formatted = qCreatedAt ? formatDate(qCreatedAt) : '';
                                return formatted ? (
                                <div className="flex items-center space-x-1">
                                  <FontAwesomeIcon icon={faCalendar} />
                                  <span>{formatted}</span>
                                </div>
                                ) : null;
                              })()}
                            </div>

                            <div className="flex items-center space-x-3">
                              {(question as any).source === 'custom' || question.isProprietaryQuestion ? (
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                                  <FontAwesomeIcon icon={faTrophy} />
                                  <span className="text-xs font-semibold">Private</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                    <path d="M2 12h20"/>
                                  </svg>
                                  <span className="text-xs font-semibold">Public</span>
                                </div>
                              )}
                              
                              <button
                                onClick={() => setExpandedQuestionId(expandedQuestionId === question.id ? null : question.id)}
                                className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors text-blue-600 hover:bg-blue-50"
                              >
                                {expandedQuestionId === question.id ? 'Hide Details' : 'View Details'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faClipboardList} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">No Questions Added</p>
                          <p className="text-xs text-gray-500">Add questions from question bank</p>
                        </div>
                      </div>
                      <button 
                        className="text-xs font-medium px-3 py-1.5 bg-white rounded-md transition-colors border"
                        style={{ 
                          color: brandTheme.colors.primary,
                          borderColor: `${brandTheme.colors.primary}33`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Add Questions
                      </button>
                    </div>
                  )}
                  </div>
                </div>
                )}

                {/* Question Pool Section */}
                {selectedExam.questionPool && Array.isArray(selectedExam.questionPool) && selectedExam.questionPool.length > 0 && selectedExam.pickRandomCount && selectedExam.pickRandomCount > 0 ? (
                  <div className="bg-white p-5 mb-6 mx-6 rounded-xl border-2 border-purple-200 shadow-md">
                    <div 
                      className="cursor-pointer select-none"
                      onClick={() => {
                        const el = document.getElementById('pool-section-collapse');
                        if (el) el.classList.toggle('hidden');
                        const icon = document.getElementById('pool-chevron');
                        if (icon) icon.classList.toggle('rotate-180');
                      }}
                    >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-md">
                          <FontAwesomeIcon icon={faLayerGroup} className="text-white text-lg" />
                        </div>
                        <span>{(() => { const _hl = !!(selectedExam.personalityAssessment && (selectedExam.likertQuestions?.length || 0) > 0); const _hq = (selectedExam.questionsList?.length || 0) > 0; if ([_hl, _hq, true].filter(Boolean).length < 2) return ''; if (_hl && _hq) return 'Section C — '; if (_hl || _hq) return 'Section B — '; return 'Section A — '; })()}Question Pool</span>
                      </h3>
                      <div className="flex items-center space-x-3">
                      <div className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
                        Random Selection
                      </div>
                      <FontAwesomeIcon 
                        id="pool-chevron"
                        icon={faChevronDown} 
                        className="text-gray-400 text-sm transition-transform duration-200" 
                      />
                      </div>
                    </div>
                    </div>

                    <div id="pool-section-collapse">

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Total Questions in Pool */}
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border-2 border-blue-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                            <FontAwesomeIcon icon={faCircleQuestion} className="text-white text-sm" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Pool Size</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">
                          {selectedExam.questionPool.length}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Total Questions</p>
                      </div>

                      {/* Random Count */}
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-gray-600">Random Pick</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-700">
                          {selectedExam.pickRandomCount || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Per Student</p>
                      </div>

                      {/* Marks Per Question */}
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border-2 border-orange-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                            <FontAwesomeIcon icon={faStar} className="text-white text-sm" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Marks/Question</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-700">
                          {selectedExam.poolQuestionMarks || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Each Question</p>
                      </div>

                      {/* Total Marks */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                            <FontAwesomeIcon icon={faAward} className="text-white text-sm" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Total Marks</span>
                        </div>
                        <p className="text-2xl font-bold text-green-700">
                          {(selectedExam.pickRandomCount || 0) * (selectedExam.poolQuestionMarks || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Maximum Score</p>
                      </div>
                    </div>

                    {/* Pool Question Categories */}
                    <div className="mt-4 pt-4 border-t border-purple-100">
                      <p className="text-xs font-semibold text-gray-700 mb-3">Question Categories in Pool:</p>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          // Get unique categories/boards from questionPool
                          const categories = new Map<string, number>();
                          selectedExam.questionPool.forEach((q: any) => {
                            const category = q.board || q.category || q.chapter || 'General';
                            categories.set(category, (categories.get(category) || 0) + 1);
                          });
                          
                          return Array.from(categories.entries()).map(([category, count], index) => (
                            <div key={index} className="px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                                {count}
                              </div>
                              <span className="text-sm font-semibold text-gray-900">{category}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Info Note */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-start space-x-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        <strong>Random Selection:</strong> Each student will receive a unique set of {selectedExam.pickRandomCount || 0} questions randomly selected from a pool of {selectedExam.questionPool.length} questions, with each question worth {selectedExam.poolQuestionMarks || 0} marks. This ensures fair and varied assessment.
                      </p>
                    </div>
                    </div>
                  </div>
                ) : null}

                </>
              )}

            </div>
            )}
              </>
                );
              })()
           ) : activeItem === ACTIVE_ITEMS.RESULTS ? (
              // Empty state for Results
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
                <div className="text-center max-w-md">
                  {/* Illustration */}
                  <div className="mb-8 relative">
                    {/* Background decoration */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-20 blur-3xl"></div>
                    </div>
                    
                    {/* Main illustration */}
                    <div className="relative">
                      {/* Trophy icon */}
                      <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 shadow-2xl mb-4">
                        <FontAwesomeIcon icon={faTrophy} className="text-white text-6xl" />
                      </div>
                      
                      {/* Floating elements */}
                      <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
                        <FontAwesomeIcon icon={faAward} className="text-white text-2xl" />
                      </div>
                      
                      <div className="absolute -bottom-2 -left-4 w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>
                        <FontAwesomeIcon icon={faCheckCircle} className="text-white text-xl" />
                      </div>
                      
                      <div className="absolute top-8 -left-8 w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '2.8s', animationDelay: '0.3s' }}>
                        <FontAwesomeIcon icon={faStar} className="text-white text-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Text content */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    No Exam Selected
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Select an exam from the list to view detailed results, student performance, and analytics.
                  </p>

                  {/* Feature highlights */}
                  <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faChartLine} className="text-blue-600 text-sm" />
                      </div>
                      <span className="font-medium">Analytics</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faUsers} className="text-purple-600 text-sm" />
                      </div>
                      <span className="font-medium">Students</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faTrophy} className="text-green-600 text-sm" />
                      </div>
                      <span className="font-medium">Performance</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeItem === ACTIVE_ITEMS.EXAMS ? (
              // Empty state for Exams
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
                <div className="text-center max-w-md">
                  {/* Illustration */}
                  <div className="mb-8 relative">
                    {/* Background decoration */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-56 h-56 bg-gradient-to-br from-orange-200 to-amber-200 rounded-full opacity-20 blur-3xl"></div>
                    </div>
                    
                    {/* Main illustration */}
                    <div className="relative">
                      {/* Main clipboard icon */}
                      <div className="inline-flex items-center justify-center w-36 h-36 rounded-full shadow-2xl mb-4 relative overflow-hidden" style={{ background: brandTheme.gradients.primary }}>
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-20 transform -skew-x-12" />
                        <FontAwesomeIcon icon={faClipboardList} className="text-white text-6xl relative z-10" />
                      </div>
                      
                      {/* Floating decorative elements */}
                      <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite' }}>
                        <FontAwesomeIcon icon={faCalendar} className="text-white text-2xl" />
                      </div>
                      
                      <div className="absolute -bottom-2 -left-4 w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite', animationDelay: '1s' }}>
                        <FontAwesomeIcon icon={faAward} className="text-white text-xl" />
                      </div>
                      
                      <div className="absolute top-6 -left-8 w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite', animationDelay: '0.5s' }}>
                        <FontAwesomeIcon icon={faClock} className="text-white text-lg" />
                      </div>

                      <div className="absolute -bottom-1 -right-6 w-11 h-11 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite', animationDelay: '1.5s' }}>
                        <FontAwesomeIcon icon={faUsers} className="text-white text-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Text content */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    No Exam Selected
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Select an exam from the list to view detailed information, question papers, and exam settings.
                  </p>

                  {/* Feature highlights */}
                  <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faCalendar} className="text-orange-600 text-sm" />
                      </div>
                      <span className="font-medium">Schedule</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faClipboardList} className="text-purple-600 text-sm" />
                      </div>
                      <span className="font-medium">Questions</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faGear} className="text-blue-600 text-sm" />
                      </div>
                      <span className="font-medium">Settings</span>
                    </div>
                  </div>
                </div>

                {/* Custom CSS for floating animation */}
                <style>{`
                  @keyframes float {
                    0%, 100% {
                      transform: translateY(0px);
                    }
                    50% {
                      transform: translateY(-12px);
                    }
                  }
                `}</style>
              </div>
            ) : (selectedSubject && activeItem === ACTIVE_ITEMS.QUESTIONS) ? (
              <>
              {/* Question Details View - With Questions List */}
                <QuestionList 
                  selectedSubject={selectedSubject}
                  activeCollegeId={getActiveCollegeId() || ''}
                  brandTheme={brandTheme}
                  questionType={selectedQuestionType}
                  onCreateQuestion={() => setIsCreateQuestionModalOpen(true)}
                  scrollToQuestionId={selectedQuestionId}
                  onQuestionScrolled={() => setSelectedQuestionId(null)}
                  currentUser={currentUser || undefined}
                  onQuestionDeleted={() => { setQuestionsRefreshKey(prev => prev + 1); refreshCounts(); }}
                />
               </>
            ) : activeItem === ACTIVE_ITEMS.ROOMS ? (
            <RoomDetail
              selectedRoom={selectedRoom}
              activeCollegeId={getActiveCollegeId() || ''}
              brandTheme={brandTheme}
              onClose={handleCloseRoomDetail}
              onRefresh={handleRoomAdded}
              currentUser={currentUser ? {
                userId: currentUser.userId,
                userName: currentUser.fullName || currentUser.email || 'User',
                userEmail: currentUser.email || '',
                userType: currentUser.userType
              } : undefined}
              isSuperUser={currentUser ? firebaseService.isSystemAdmin(currentUser) : false}
            />
            ) : activeItem === ACTIVE_ITEMS.REPORTS ? (
            <ReportDetail
              report={selectedReport}
              brandTheme={brandTheme}
              activeCollegeId={getActiveCollegeId() ?? undefined} 
            />
            ) : activeItem === ACTIVE_ITEMS.QUESTIONS ? (
              // Empty state for Questions
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
                <div className="text-center max-w-md">
                  {/* Illustration */}
                  <div className="mb-8 relative">
                    {/* Background decoration */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-56 h-56 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-20 blur-3xl"></div>
                    </div>
                    
                    {/* Main illustration */}
                    <div className="relative">
                      {/* Main book icon */}
                      <div className="inline-flex items-center justify-center w-36 h-36 rounded-full shadow-2xl mb-4 relative overflow-hidden" style={{ background: brandTheme.gradients.primary }}>
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-20 transform -skew-x-12" />
                        <FontAwesomeIcon icon={faCircleQuestion} className="text-white text-6xl relative z-10" />
                      </div>
                      
                      {/* Floating decorative elements */}
                      <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite' }}>
                        <FontAwesomeIcon icon={faBookOpen} className="text-white text-2xl" />
                      </div>
                      
                      <div className="absolute -bottom-2 -left-4 w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite', animationDelay: '1s' }}>
                        <FontAwesomeIcon icon={faListCheck} className="text-white text-xl" />
                      </div>
                      
                      <div className="absolute top-6 -left-8 w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite', animationDelay: '0.5s' }}>
                        <FontAwesomeIcon icon={faPenToSquare} className="text-white text-lg" />
                      </div>

                      <div className="absolute -bottom-1 -right-6 w-11 h-11 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg" style={{ animation: 'float 3s ease-in-out infinite', animationDelay: '1.5s' }}>
                        <FontAwesomeIcon icon={faTag} className="text-white text-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Text content */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    No Subject Selected
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Select a subject from the list to view questions, manage question banks, and create new questions.
                  </p>

                  {/* Feature highlights */}
                  <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faCircleQuestion} className="text-emerald-600 text-sm" />
                      </div>
                      <span className="font-medium">MCQ</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faFileLines} className="text-purple-600 text-sm" />
                      </div>
                      <span className="font-medium">Descriptive</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faListCheck} className="text-blue-600 text-sm" />
                      </div>
                      <span className="font-medium">All Types</span>
                    </div>
                  </div>
                </div>

                {/* Custom CSS for floating animation */}
                <style>{`
                  @keyframes float {
                    0%, 100% {
                      transform: translateY(0px);
                    }
                    50% {
                      transform: translateY(-12px);
                    }
                  }
                `}</style>
              </div>
              
            ) : activeItem === ACTIVE_ITEMS.CALENDAR ? (
              <Calendar
                activeCollegeId={getActiveCollegeId() ?? null}
                selectedYear={selectedYear}
                brandTheme={brandTheme}
                currentUser={currentUser}
                onEventsCountChange={(count) => setCalendarEventsCount(count)}
                onExamSelect={handleCalendarOnExamSelect}
              />
            ) : activeItem === ACTIVE_ITEMS.LEADERBOARD ? (
              <LeaderBoard
                activeCollegeId={getActiveCollegeId() ?? null}
                selectedYear={selectedYear}
                brandTheme={brandTheme}
                currentUser={currentUser}
                allYears={allYears}
                allClasses={allClasses}
                allSubjects={allSubjects}
              />
            ) : selectedClassForUsers && activeItem === ACTIVE_ITEMS.USERS ? (
                <UserList
                  selectedClass={selectedClassForUsers}
                  activeCollegeId={getActiveCollegeId() ?? null}
                  brandTheme={brandTheme}
                  onClose={() => setSelectedClassForUsers(null)}
                  currentUserRole={currentUser?.userType || 'student'}
                  isSuperUser={currentUser ? firebaseService.isSystemAdmin(currentUser) : false}
                  highlightUserId={highlightUserId}
                  onCountsChange={refreshCounts}
                />
            ) : !selectedClassForUsers && activeItem === ACTIVE_ITEMS.USERS ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="relative mb-6">
                    <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Class Selected</h3>
                  <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                    Select a class from the list to view and manage its students, teachers, and other users.
                  </p>
                  <div className="flex items-center gap-4 mt-6 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      Students
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                      Teachers
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      Settings
                    </span>
                  </div>
                </div>
            ) : activeItem === ACTIVE_ITEMS.HALLTICKETS ? (
                <HallTicketsList
                  selectedHallTicketGroup={selectedHallTicket}
                  activeCollegeId={getActiveCollegeId() ?? null}
                  brandTheme={brandTheme}
                  currentUser={currentUser}
                  isSecureBrowser={isUsingSecureBrowser()}
                  onClose={() => {
                    setSelectedHallTicket(null);
                  }}
                />
            ) : null}
          </aside>
        )}
        </>
        )}
      </div>
        
        {/* Create/Edit Exam Modal */}
        <CreateExamModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingExam(null);
          }}
          onSave={handleExamCreated}
          existingExam={editingExam}
          currentUser={currentUser!}
          activeCollegeId={getActiveCollegeId() || ''}
          activeCollegeName={getActiveCollegeName() || ''}
        />

        {/* Create Hall Ticket Modal */}
        <CreateHallTicketModal
          isOpen={isCreateHallTicketModalOpen}
          onClose={() => {
            setIsCreateHallTicketModalOpen(false);
          }}
          onSave={handleHallTicketCreated}
          currentUser={currentUser!}
          activeCollegeId={getActiveCollegeId() || ''}
          activeCollegeName={getActiveCollegeName() || ''}
        />

        
        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/70 z-[9998] backdrop-blur-sm"
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
            />
            
            {/* Modal Container */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div 
                className="relative bg-white rounded-2xl shadow-2xl max-w-5xl max-h-[90vh] w-full flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div 
                  className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
                  style={{ 
                    background: `linear-gradient(135deg, ${brandTheme.colors.primary}08 0%, ${brandTheme.colors.secondary}08 100%)`
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      <FontAwesomeIcon icon={faFileLines} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Question Paper - Page {selectedImage.pageNumber}</h2>
                      <p className="text-sm text-gray-500">{selectedExam?.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowImageModal(false);
                      setSelectedImage(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Close"
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-gray-500" />
                  </button>
                </div>

                {/* Modal Body - Scrollable Image */}
                <div className="flex-1 overflow-auto p-6 bg-gray-50">
                  <div className="flex items-center justify-center min-h-full">
                    <img 
                      src={selectedImage.url} 
                      alt={`Question Paper Page ${selectedImage.pageNumber}`}
                      className="max-w-full h-auto rounded-lg shadow-lg"
                      style={{ maxHeight: 'calc(90vh - 140px)' }}
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
                  <div className="text-sm text-gray-600">
                    Page {selectedImage.pageNumber} of {selectedExam?.questionPaperImages?.length || 0}
                  </div>
                  <div className="flex items-center space-x-3">
                    <a
                      href={selectedImage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span>Open in New Tab</span>
                    </a>
                    <button
                      onClick={() => {
                        setShowImageModal(false);
                        setSelectedImage(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-md hover:shadow-lg transition-all"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Create Notice Dialog */}
        {showNoticeDialogElement && (
          <>
            {/* Backdrop */}
            <div 
              id="notice-backdrop"
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] transition-opacity duration-500 opacity-0"
              onClick={() => setShowNoticeDialog(false)}
            />

            {/* Dialog - Slides in from right with margin and rounded corners */}
            <div 
              id="notice-dialog"
              className="fixed right-2 top-2 bottom-2 z-[10001] w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl transition-transform duration-500 ease-out overflow-hidden translate-x-full rounded-2xl"
            >
              <div className="h-full flex flex-col">
                {/* Header */}
                <div 
                  className="px-5 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
                  style={{ 
                    background: brandTheme.gradients.primary
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.2)' }}
                    >
                      <FontAwesomeIcon icon={faBullhorn} size="lg" className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Create Campus Notice</h2>
                      <p className="text-xs text-white/80">Share important updates with everyone</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNoticeDialog(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-white" />
                  </button>
                </div>

                {/* Form - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                  <form onSubmit={handleNoticeSubmit} className="p-5">
                    {/* Notice Title */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Notice Title *
                      </label>
                      <input
                        type="text"
                        value={noticeTitle}
                        onChange={handleNoticeTitleChange}
                        placeholder="Enter notice title..."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none transition-all text-sm"
                        onFocus={(e) => e.target.style.borderColor = brandTheme.colors.primary}
                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        maxLength={100}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">{noticeTitle.length}/100 characters</p>
                    </div>

                    {/* Notice Content */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Notice Content *
                      </label>
                      <textarea
                        value={noticeContent}
                        onChange={handleNoticeContentChange}
                        placeholder="Enter detailed notice content..."
                        rows={6}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none transition-all resize-none text-sm"
                        onFocus={(e) => e.target.style.borderColor = brandTheme.colors.primary}
                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        maxLength={1000}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">{noticeContent.length}/1000 characters</p>
                    </div>

                    {/* Priority Level and Category - Side by Side */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {/* Priority Level */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Priority Level
                        </label>
                        <div className="relative">
                          <select
                            value={noticePriority}
                            onChange={handleNoticePriorityChange}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none transition-all appearance-none bg-white text-sm cursor-pointer"
                            onFocus={(e) => e.target.style.borderColor = brandTheme.colors.primary}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          >
                            {priorityOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <FontAwesomeIcon icon={faChevronDown} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Category
                        </label>
                        <div className="relative">
                          <select
                            value={noticeCategory}
                            onChange={handleNoticeCategoryChange}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none transition-all appearance-none bg-white text-sm cursor-pointer"
                            onFocus={(e) => e.target.style.borderColor = brandTheme.colors.primary}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          >
                            {categoryOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <FontAwesomeIcon icon={faChevronDown} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Target Audience */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Target Audience
                      </label>
                      <div className="relative">
                        <select
                          value={noticeTargetAudience}
                          onChange={handleNoticeAudienceChange}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none transition-all appearance-none bg-white text-sm cursor-pointer"
                          onFocus={(e) => e.target.style.borderColor = brandTheme.colors.primary}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        >
                          {audienceOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <FontAwesomeIcon icon={faChevronDown} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={noticeExpiryDate}
                        onChange={handleNoticeExpiryChange}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none transition-all text-sm"
                        onFocus={(e) => e.target.style.borderColor = brandTheme.colors.primary}
                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for permanent notice</p>
                    </div>
                  </form>
                </div>

                {/* Footer - Fixed at bottom */}
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
                  <div className="text-xs text-gray-500">
                    Posted by <span className="font-medium text-gray-700">{currentUser?.fullName || currentUser?.email?.split('@')[0].replace(/[._]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'User'}</span> • {currentUser?.userType ? firebaseService.getUserTypeDisplayName(currentUser.userType) : 'User'}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowNoticeDialog(false)}
                      className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm"
                      disabled={isSubmittingNotice}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleNoticeSubmit}
                      disabled={isSubmittingNotice || !noticeTitle.trim() || !noticeContent.trim()}
                      className="px-5 py-2.5 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      {isSubmittingNotice ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faBullhorn} size="lg" />
                          <span>Create Notice</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmDialog && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[10002] flex items-center justify-center"
            onClick={() => setShowDeleteConfirmDialog(false)}
          >
            {/* Dialog */}
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Icon */}
              <div 
                className="px-6 py-8 text-center"
                style={{ 
                  background: 'linear-gradient(135deg, #FEE2E215 0%, #FCA5A515 100%)'
                }}
              >
                <div className="flex justify-center mb-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                    }}
                  >
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Delete Notice?
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">
                  Are you sure you want to delete this notice? This action cannot be undone.
                </p>
              </div>

              {/* Footer with Buttons */}
              <div className="px-6 py-4 bg-gray-50 flex justify-center space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirmDialog(false);
                    setNoticeToDelete(null);
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-all text-base min-w-[120px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (noticeToDelete) {
                      handleDeleteNotice(noticeToDelete);
                    }
                    setShowDeleteConfirmDialog(false);
                    setNoticeToDelete(null);
                  }}
                  className="px-6 py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-base min-w-[120px]"
                  style={{ 
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Custom Success/Error Dialog */}
      {showCustomDialog && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[10002] flex items-center justify-center"
            onClick={() => setShowCustomDialog(false)}
          >
            {/* Dialog */}
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Icon */}
              <div 
                className="px-6 py-8 text-center"
                style={{ 
                  background: customDialogType === 'success' 
                    ? `linear-gradient(135deg, ${brandTheme.colors.primary}15 0%, ${brandTheme.colors.secondary}15 100%)`
                    : 'linear-gradient(135deg, #FEE2E215 0%, #FCA5A515 100%)'
                }}
              >
                <div className="flex justify-center mb-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ 
                      background: customDialogType === 'success' 
                        ? brandTheme.gradients.primary
                        : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                    }}
                  >
                    {customDialogType === 'success' ? (
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {customDialogType === 'success' ? 'Success!' : 'Oops!'}
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">
                  {customDialogMessage}
                </p>
              </div>

              {/* Footer with Button */}
              <div className="px-6 py-4 bg-gray-50 flex justify-center">
                <button
                  onClick={() => setShowCustomDialog(false)}
                  className="px-8 py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-base min-w-[120px]"
                  style={{ 
                    background: customDialogType === 'success' 
                      ? brandTheme.gradients.primary
                      : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Notice Detail Modal */}
      {showNoticeDetailModal && selectedNotice && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4"
            onClick={() => {
              setShowNoticeDetailModal(false);
              setSelectedNotice(null);
            }}
          >
            {/* Modal */}
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div 
                className="px-6 py-5 border-b border-gray-200"
                style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}10 0%, ${brandTheme.colors.secondary}10 100%)` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedNotice.title}</h2>
                    <div className="flex items-center flex-wrap gap-2">
                      {(() => {
                        const priorityColors = {
                          high: { bg: 'bg-red-100', text: 'text-red-700' },
                          medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
                          low: { bg: 'bg-blue-100', text: 'text-blue-700' }
                        };
                        const colors = priorityColors[selectedNotice.priority as 'high' | 'medium' | 'low'] || priorityColors.medium;
                        return (
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                            {selectedNotice.priority.toUpperCase()} PRIORITY
                          </span>
                        );
                      })()}
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        {selectedNotice.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(selectedNotice.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowNoticeDetailModal(false);
                      setSelectedNotice(null);
                    }}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors ml-4"
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-gray-600" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="px-6 py-6 max-h-[400px] overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selectedNotice.content}
                  </p>
                </div>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  <p>Posted by <span className="font-semibold text-gray-900">{selectedNotice.createdByName}</span></p>
                  <p className="mt-0.5">
                    Role: <span className="font-medium">{selectedNotice.createdByRole}</span>
                    {selectedNotice.collegeName && (
                      <> • <span className="font-medium">{selectedNotice.collegeName}</span></>
                    )}
                  </p>
                  {selectedNotice.views > 0 && (
                    <p className="mt-0.5">
                      <span className="font-medium">{selectedNotice.views}</span> view{selectedNotice.views !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowNoticeDetailModal(false);
                    setSelectedNotice(null);
                  }}
                  className="px-6 py-2.5 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    {/* AI Assistant Dialog - Teaching Assistant for non-students */}
    <AIAssistant 
      isOpen={showAIAssistant}
      onClose={() => setShowAIAssistant(false)}
    />

    {/* AI Support Assistant - Generic support for students */}
    <AISupportAssistant
      isOpen={showAISupportAssistant}
      onClose={() => setShowAISupportAssistant(false)}
      userName={currentUser?.fullName?.split(' ')[0] || ''}
    />

    {/* Create Question Modal */}
    <CreateQuestionModal
      isOpen={isCreateQuestionModalOpen}
      onClose={() => setIsCreateQuestionModalOpen(false)}
      onBulkUpload={() => {
        setIsBulkUploadOpen(true);
      }}
      activeCollegeId={getActiveCollegeId() || ''}
      activeCollegeName={getActiveCollegeName() || ''}
      currentUser={currentUser}
      onQuestionAdded={() => {
        // console.log('✅ Question added, refreshing list...');
        // Refresh counts to update menu
        refreshCounts();
        // Increment refresh trigger to reload Questions component stats
        setQuestionsRefreshKey(prev => prev + 1);
      }}
    />

    <BulkUploadQuestions
      isOpen={isBulkUploadOpen}
      onClose={() => {
        setIsBulkUploadOpen(false);
      }}
      activeCollegeId={getActiveCollegeId() || ''}
      activeCollegeName={getActiveCollegeName() || ''}
      currentUser={currentUser}
      isSuperUser={currentUser ? firebaseService.isSystemAdmin(currentUser) : false}
      collegeData={collegeData}
      onUploadComplete={() => {
        // Refresh questions list
        // console.log('✅ Questions uploaded successfully!');
        // Refresh counts to update menu
        refreshCounts();
        // Trigger Questions component to refresh
        setQuestionsRefreshKey(prev => prev + 1);
      }}
    />

    {/* Create User Modal */}
    <CreateUserModal
      isOpen={isCreateUserModalOpen}
      onClose={() => setIsCreateUserModalOpen(false)}
      activeCollegeId={getActiveCollegeId() || ''}
      onUserAdded={() => {
        // console.log('✅ User added, refreshing list...');
        // Refresh counts to update menu
        refreshCounts();
        // Trigger Classes component refresh
        setUsersRefreshTrigger(prev => prev + 1);
      }}
    />

    {/* Create Learning Path Modal */}
    <CreateLearningPathModal
      isOpen={isCreateLearningPathModalOpen}
      onClose={() => setIsCreateLearningPathModalOpen(false)}
      brandTheme={brandTheme}
      currentUser={currentUser}
      selectedCollege={selectedCollege}
      onPathCreated={() => {
        // console.log('✅ Learning path created');
        setIsCreateLearningPathModalOpen(false);
      }}
    />

    {/* Bulk Upload Users Modal - Placeholder for now */}
    {isBulkUploadUsersOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Bulk Upload Users</h2>
            <button
              onClick={() => setIsBulkUploadUsersOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={faXmark} className="text-gray-500" />
            </button>
          </div>
          <div className="text-center py-12">
            <FontAwesomeIcon icon={faArrowUpFromBracket} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">Bulk Upload Users Feature</p>
            <p className="text-sm text-gray-500">
              This feature will allow you to upload multiple users at once using an Excel file.
            </p>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setIsBulkUploadUsersOpen(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Restriction Dialog - For restricted exam actions */}
    {showRestrictionDialog && (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden animate-scale-in">
          {/* Header with Icon */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-6 border-b border-amber-200">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  {restrictionMessage.icon}
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {restrictionMessage.title}
                </h2>
                <p className="text-sm text-gray-600">Action temporarily unavailable</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {restrictionMessage.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Exam Date/Time Info for Edit/Delete restrictions */}
            {(restrictionMessage.title.includes('Edit') || restrictionMessage.title.includes('Delete')) && restrictionMessage.examDate && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-semibold text-red-800">Exam Scheduled For</p>
                </div>
                <div className="ml-6">
                  <p className="text-sm text-red-700 font-medium">
                    📅 {restrictionMessage.examDate}
                    {restrictionMessage.examTime && ` at ${restrictionMessage.examTime}`}
                  </p>
                  {restrictionMessage.hoursRemaining !== undefined && restrictionMessage.hoursRemaining > 0 && (
                    <p className="text-xs text-red-600 mt-2">
                      ⏰ <strong>{restrictionMessage.hoursRemaining} hours</strong> remaining until exam starts
                    </p>
                  )}
                  <p className="text-xs text-red-600 mt-2">
                    {restrictionMessage.title.includes('Edit') 
                      ? '🔒 Editing is locked after the exam has ended to maintain exam integrity and protect submitted answers.'
                      : '🛡️ Deletion is locked within 24 hours of exam start time to protect data integrity.'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Additional info for time-based restrictions */}
            {(restrictionMessage.title.includes('Attendance') || restrictionMessage.title.includes('Live Stats')) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-green-800">When will this be available?</p>
                </div>
                <p className="text-xs text-green-700 ml-6">
                  {restrictionMessage.title.includes('Attendance') 
                    ? 'This feature activates automatically 30 minutes before the scheduled exam time.'
                    : 'Live statistics become available 30 minutes before the exam and remain accessible afterwards.'
                  }
                </p>
              </div>
            )}

            {restrictionMessage.title.includes('Result') && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-purple-800">When will results be ready?</p>
                </div>
                <p className="text-xs text-purple-700 ml-6">
                  Results will be automatically available once the exam duration has elapsed and all students have completed the exam.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
            <button
              onClick={() => setShowRestrictionDialog(false)}
              className="px-6 py-2.5 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
              style={{ background: brandTheme.gradients.primary }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Delete Exam Confirmation Dialog */}
    {showDeleteExamDialog && examToDelete && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-red-50 px-6 py-4 border-b border-red-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Delete Exam</h2>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <p className="text-gray-700 text-base mb-4">
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{examToDelete.title}"</span>?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600 flex-shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">
                  This action cannot be undone. All exam data, questions, and student submissions will be permanently deleted.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
            <button
              onClick={() => {
                setShowDeleteExamDialog(false);
                setExamToDelete(null);
              }}
              className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!examToDelete) return;
                
                try {
                  // Find the index of the exam to delete in the current list
                  const deletedExamIndex = currentExamsList.findIndex(exam => exam.id === examToDelete.id);
                  
                  const success = await firebaseService.deleteExam(examToDelete.id, currentUser!);
                  
                  if (success) {
                    // Close dialog
                    setShowDeleteExamDialog(false);
                    setExamToDelete(null);
                    
                    // Smart selection: Select next available exam
                    // Remove the deleted exam from the list
                    const remainingExams = currentExamsList.filter(exam => exam.id !== examToDelete.id);
                    
                    if (remainingExams.length > 0) {
                      // If there are remaining exams, select the next one
                      // If the deleted exam was not the last one, select the one at the same index
                      // Otherwise, select the previous exam (now at index length - 1)
                      const nextExamIndex = deletedExamIndex < remainingExams.length 
                        ? deletedExamIndex 
                        : remainingExams.length - 1;
                      setSelectedExamSafe(remainingExams[nextExamIndex]);
                    } else {
                      // No exams left, clear selection
                      setSelectedExamSafe(null);
                    }
                    
                    // Show success message
                    setCustomDialogMessage('Exam deleted successfully');
                    setCustomDialogType('success');
                    setShowCustomDialog(true);
                    
                    // Refresh exam counts
                    refreshCounts();
                    
                    // Trigger exams list refresh
                    setExamsRefreshKey(prev => prev + 1);
                  } else {
                    // Show error message
                    setCustomDialogMessage('Failed to delete exam. Please try again.');
                    setCustomDialogType('error');
                    setShowCustomDialog(true);
                  }
                } catch (error) {
                  console.error('Error deleting exam:', error);
                  setCustomDialogMessage('An error occurred while deleting the exam.');
                  setCustomDialogType('error');
                  setShowCustomDialog(true);
                }
              }}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Exam</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Attendance Warning Dialog */}
    {showAttendanceWarningDialog && (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-auto overflow-hidden animate-scale-in relative">
          {/* Close Button */}
          <button
            onClick={() => {
              setShowAttendanceWarningDialog(false);
              setPendingExamStart(null);
            }}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
            title="Close"
          >
            <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Icon Section */}
          <div className="flex flex-col items-center pt-12 pb-6 px-6">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-bounce-slow"
              style={{ 
                background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                boxShadow: '0 8px 32px rgba(251, 191, 36, 0.3)'
              }}
            >
              <FontAwesomeIcon icon={faUserCheck} className="text-amber-600" />
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
              Attendance Required
            </h2>
            
            {/* Message */}
            <p className="text-gray-700 text-center mb-6 text-lg">
              Please visit the <span className="text-amber-600">Exam Invigilator</span> to get your attendance marked first.
            </p>
            
            {/* Info Box */}
            <div className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <FontAwesomeIcon icon={faClock} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    <span className="font-semibold">Quick Tip:</span> Ask your invigilator to mark you present in the attendance system. Once marked, you can return here to start your exam.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Exam Details Card */}
            {pendingExamStart && (
              <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
                <div className="flex items-center space-x-3 mb-2">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    <FontAwesomeIcon icon={faFileLines} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{pendingExamStart.title}</p>
                    <p className="text-xs text-gray-600">{pendingExamStart.class} • {pendingExamStart.subject}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Button */}
          <div className="px-6 pb-6">
            <button
              onClick={() => {
                setShowAttendanceWarningDialog(false);
                setPendingExamStart(null);
              }}
              className="w-full py-3.5 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: brandTheme.gradients.primary }}
            >
              Got it, I'll mark attendance first
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Proctoring Setup Dialog */}
    {showProctoringSetupDialog && pendingProctoringExam && (
      <ProctoringSetupDialog
        exam={pendingProctoringExam}
        user={currentUser}
        brandTheme={brandTheme}
        onClose={() => {
          setShowProctoringSetupDialog(false);
          setPendingProctoringExam(null);
          // Reset permission states
          setCameraPermissionStatus('checking');
          setAudioPermissionStatus('checking');
          // Stop any media streams
          if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            setMediaStream(null);
          }
        }}
        onProceed={async () => {
          // Re-run the exam start check after setup is complete
          await handleExamStartClick(
            pendingProctoringExam,
            currentUser,
            () => {
              setShowProctoringSetupDialog(false);
              setPendingProctoringExam(null);
              setActiveExam(pendingProctoringExam);
              setShowExamInterface(true);
              // Stop any media streams from the setup dialog
              if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
                setMediaStream(null);
              }
            },
            (exam) => {
              setShowProctoringSetupDialog(false);
              setPendingProctoringExam(null);
              setPendingExamStart(exam);
              setShowAttendanceWarningDialog(true);
            },
            (exam) => {
              // Keep the dialog open if still missing proctoring photos
              setPendingProctoringExam(exam);
            }
          );
        }}
        onNavigateToProfile={() => {
          // console.log('🔄 Navigating to profile settings...');
          
          // Close the proctoring dialog
          setShowProctoringSetupDialog(false);
          setPendingProctoringExam(null);
          
          // Stop any media streams
          if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            setMediaStream(null);
          }
          
          // Reset permission states
          setCameraPermissionStatus('checking');
          setAudioPermissionStatus('checking');
          
          // Close any exam interfaces
          setShowExamInterface(false);
          setActiveExam(null);
          setSelectedExamSafe(null);
          
          // Navigate to profile settings
          // console.log('📍 Setting activeItem to: profile');
          setActiveItem('profile');
          
          // console.log('✅ Navigation complete');
        }}
        onRefreshUser={async () => {
          // Reload current user from Firestore
          if (currentUser?.userId) {
            try {
              const refreshedUser = await firebaseService.getUserById(currentUser.userId);
              if (refreshedUser) {
                setCurrentUser(refreshedUser);
                // console.log('✅ User data refreshed');
              }
            } catch (error) {
              console.error('❌ Failed to refresh user:', error);
            }
          }
        }}
        cameraStatus={cameraPermissionStatus}
        audioStatus={audioPermissionStatus}
        onCameraStatusChange={setCameraPermissionStatus}
        onAudioStatusChange={setAudioPermissionStatus}
        mediaStream={mediaStream}
        onMediaStreamChange={setMediaStream}
      />
    )}

    {/* Login Details Dialog */}
    {showLoginDetailsDialog && loginIPInfo && (
      <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity duration-300"
        style={{ opacity: loginDetailsAnimatedIn ? 1 : 0 }}
        onClick={() => setShowLoginDetailsDialog(false)}
      />
      <div
        className="fixed right-2 top-2 bottom-2 z-[10000] w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl overflow-hidden rounded-2xl flex flex-col transition-all duration-300 ease-out"
        style={{
          transform: loginDetailsAnimatedIn ? 'translateX(0)' : 'translateX(100%)',
          opacity: loginDetailsAnimatedIn ? 1 : 0,
        }}
      >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
            style={{ background: brandTheme.gradients.primary }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white">Login Details</h2>
            </div>
            <button
              onClick={() => setShowLoginDetailsDialog(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Location */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-red-500 text-sm" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Location</div>
                <div className="text-sm text-gray-900 font-medium">
                  {loginIPInfo.city}, {loginIPInfo.region}, {loginIPInfo.country}
                </div>
              </div>
            </div>

            {/* IP Address */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faGlobe} className="text-blue-500 text-sm" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">IP Address</div>
                <div className="text-sm text-blue-600 font-semibold">{loginIPInfo.ip}</div>
              </div>
            </div>

            {/* ISP */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faTowerBroadcast} className="text-purple-500 text-sm" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">ISP</div>
                <div className="text-sm text-gray-900">{loginIPInfo.isp}</div>
              </div>
            </div>

            {/* Device */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faLaptop} className="text-gray-500 text-sm" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Device</div>
                <div className="text-sm text-gray-900 capitalize">{loginIPInfo.deviceType}</div>
              </div>
            </div>

            {/* Timezone */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faEarthAmericas} className="text-green-500 text-sm" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Zone</div>
                <div className="text-sm text-gray-900">{loginIPInfo.timezone}</div>
              </div>
            </div>

            {/* Login Time */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faClock} className="text-amber-500 text-sm" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Login Time</div>
                <div className="text-sm text-gray-900">
                  {new Date(loginIPInfo.loginTimestamp).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-start space-x-2 bg-green-50 p-3 rounded-xl border border-green-100">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Login activity recorded for security. Contact admin if this wasn't you.
                </p>
              </div>
            </div>

            {/* Coordinates */}
            {loginIPInfo.latitude !== 0 && loginIPInfo.longitude !== 0 && (
              <div className="text-center pt-1">
                <div className="text-[11px] text-gray-300 flex items-center justify-center">
                  <FontAwesomeIcon icon={faChartLine} className="mr-2" /> {loginIPInfo.latitude.toFixed(4)}, {loginIPInfo.longitude.toFixed(4)}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={() => setShowLoginDetailsDialog(false)}
              className="w-full px-4 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              style={{ background: brandTheme.gradients.primary }}
            >
              Close
            </button>
          </div>
      </div>
      </>
    )}

    {/* Secure Browser Download Modal */}
    {showSecureBrowserModal && (
      <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity duration-300"
        style={{ opacity: secureBrowserAnimatedIn ? 1 : 0 }}
        onClick={() => setShowSecureBrowserModal(false)}
      />
      <div
        className="fixed right-2 top-2 bottom-2 z-[10000] w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl overflow-hidden rounded-2xl flex flex-col transition-all duration-300 ease-out"
        style={{
          transform: secureBrowserAnimatedIn ? 'translateX(0)' : 'translateX(100%)',
          opacity: secureBrowserAnimatedIn ? 1 : 0,
        }}
      >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl relative overflow-hidden"
            style={{ background: brandTheme.gradients.primary }}
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-24 translate-x-24"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-16 -translate-x-16"></div>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                <FontAwesomeIcon icon={faShieldCheck} className="text-white text-sm" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Download Secure Browser</h2>
                <p className="text-[11px] text-white/70">Choose your platform to download</p>
              </div>
            </div>
            <button
              onClick={() => setShowSecureBrowserModal(false)}
              className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col justify-center">
            <div className="grid grid-cols-3 gap-4">
              {/* Windows */}
              <div
                onClick={() => handleDownload('windows')}
                className="group relative bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-xl p-5 border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-lg cursor-pointer"
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <FontAwesomeIcon icon={faWindows} className="text-white text-xl" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Windows</h4>
                  <p className="text-[11px] text-gray-500 mb-3">For Windows 10 & 11</p>
                  <div className="inline-flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-[11px] font-semibold shadow-sm">
                    <span>Download</span>
                    <svg className="w-3 h-3 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                </div>
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-blue-600 text-[10px]" />
                </div>
              </div>

              {/* Mac */}
              <div
                onClick={() => handleDownload('mac')}
                className="group relative bg-gradient-to-br from-slate-50 to-gray-50 hover:from-slate-100 hover:to-gray-100 rounded-xl p-5 border-2 border-gray-300 hover:border-gray-500 transition-all duration-300 hover:shadow-lg cursor-pointer"
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <FontAwesomeIcon icon={faApple} className="text-white text-xl" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">macOS</h4>
                  <p className="text-[11px] text-gray-500 mb-3">For macOS 11 & later</p>
                  <div className="inline-flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg text-[11px] font-semibold shadow-sm">
                    <span>Download</span>
                    <svg className="w-3 h-3 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                </div>
                <div className="absolute top-2 right-2 w-6 h-6 bg-gray-500/20 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-gray-700 text-[10px]" />
                </div>
              </div>

              {/* Linux */}
              <div
                onClick={() => handleDownload('linux')}
                className="group relative bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-xl p-5 border-2 border-orange-200 hover:border-orange-400 transition-all duration-300 hover:shadow-lg cursor-pointer"
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <FontAwesomeIcon icon={faLinux} className="text-white text-xl" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Linux</h4>
                  <p className="text-[11px] text-gray-500 mb-3">For Ubuntu & Debian</p>
                  <div className="inline-flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-[11px] font-semibold shadow-sm">
                    <span>Download</span>
                    <svg className="w-3 h-3 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                </div>
                <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-orange-600 text-[10px]" />
                </div>
              </div>
            </div>

            {/* Installation Note */}
            <div className="mt-5 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h5 className="text-[12px] font-semibold text-gray-900 mb-0.5">Installation Instructions</h5>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    After downloading, run the installer and follow the on-screen instructions. 
                    Once installed, log in with your credentials to access secure exams.
                  </p>
                </div>
              </div>
            </div>

            {/* Installation Guides */}
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon={faFileLines} className="text-purple-600 text-sm" />
                  </div>
                  <div>
                    <h5 className="text-[12px] font-semibold text-gray-900 mb-0.5">macOS Installation Guide</h5>
                    <p className="text-[11px] text-gray-500">Step-by-step setup instructions for Mac users</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadGuide('Mac_Installation_Guide.pdf', 'Mac Installation Guide')}
                  className="flex-shrink-0 ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg text-[11px] font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
            <p className="text-[11px] text-gray-400">
              <FontAwesomeIcon icon={faLock} className="mr-1" /> 
              Secure & Verified Software
            </p>
            <button
              onClick={() => setShowSecureBrowserModal(false)}
              className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              style={{ background: brandTheme.gradients.primary }}
            >
              Close
            </button>
          </div>
      </div>
      </>
    )}

    {/* Image Carousel Modal */}
    {imageCarouselOpen && carouselImages.length > 0 && (
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
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
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
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
    {/* User Profile Modal */}
    <UserProfile
      isOpen={showUserProfile}
      onClose={() => { setShowUserProfile(false); setProfileInitialView('profile'); }}
      currentUser={currentUser}
      initialView={profileInitialView}
      onProfileUpdate={async () => {
        // Reload user data after profile update
        if (currentUser?.userId) {
          try {
            const updatedUser = await firebaseService.getUserProfile(currentUser.userId);
            if (updatedUser) {
              setCurrentUser(updatedUser);
            }
          } catch (error) {
            console.error('Error refreshing user data:', error);
          }
        }
      }}
    />
    {/* Room Modals */}
    <CreateRoomModal
      isOpen={isCreateRoomModalOpen}
      onClose={() => setIsCreateRoomModalOpen(false)}
      onBulkUpload={() => {
        setIsBulkUploadRoomsOpen(true);
      }}
      activeCollegeId={getActiveCollegeId() ?? ''}
      activeCollegeName={getActiveCollegeName() ?? ''}
      currentUser={currentUser}
      isSuperUser={currentUser ? firebaseService.isSystemAdmin(currentUser) : false}
      onRoomAdded={handleRoomAdded}
    />
    <BulkUploadRooms
      isOpen={isBulkUploadRoomsOpen}
      onClose={() => setIsBulkUploadRoomsOpen(false)}
      activeCollegeId={getActiveCollegeId() ?? ''}
      currentUser={currentUser}
      onUploadComplete={handleRoomAdded}
    />
    
    {/* Bulk Upload University/College Modal */}
    <BulkUploadUniversity
      isOpen={isBulkUploadUniversityOpen}
      onClose={() => setIsBulkUploadUniversityOpen(false)}
      currentUser={currentUser}
      onUploadComplete={() => {
        // Refresh colleges list to show newly added universities
        // console.log('✅ University upload complete - refreshing colleges list...');
        loadColleges();
      }}
    />

    {/* Problems List Modal */}
    <ProblemsListModal
      isOpen={showProblemsListModal}
      onClose={() => setShowProblemsListModal(false)}
      selectedProblemSlug={selectedProblemSlug}
      onSelectProblem={setSelectedProblemSlug}
      brandTheme={brandTheme}
      userId={currentUser?.userId}
    />
    </>
    </div>
    </BrandProvider>
  );
}
export default AppRouter;