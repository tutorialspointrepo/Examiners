import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers,
  faCheckSquare,
  faClipboardList,
  faAward,
  faTrophy,
  faCheckCircle,
  faShield,
  faTable,
  faChartLine,
  faChevronDown,
  faChevronUp,
  faGripVertical,
  faXmark,
  faCopy,
  faCheck,
  // faGraduationCap, // unused
  faCalendar,
  faLayerGroup,
  faCircleQuestion,
  faStar,
  faClock,
  faSpinner,
  faChartBar,
  faBookOpen,
  faUser,
  faTimes,
  faPrint,
  faQuestionCircle,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/sharp-light-svg-icons';
import { exportStyledDashboardBrowser } from './exportStyledDashboard'; // Adjust path as needed
import { firebaseService } from './services/firebase_service'; // Adjust path as needed
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from './constants';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import katex from 'katex';

// ✅ Helper function to calculate total marks from exam
function getTotalMarks(exam: any): number {
  let total = 0;
  
  // Sum questionsList marks
  if (exam?.questionsList && Array.isArray(exam.questionsList) && exam.questionsList.length > 0) {
    total = exam.questionsList.reduce((sum: number, question: any) => {
      const marks = question.maximumMarks || question.marks || 0;
      return sum + Number(marks);
    }, 0);
  }
  
  // ✅ Add pool question marks (pickRandomCount × poolQuestionMarks)
  if (exam?.pickRandomCount && exam?.poolQuestionMarks) {
    total += Number(exam.pickRandomCount) * Number(exam.poolQuestionMarks);
  }
  
  // Fallback: Use exam.maxMarks if calculated total is 0
  if (total === 0 && exam?.maxMarks) {
    const marks = parseFloat(String(exam.maxMarks));
    if (!isNaN(marks) && marks > 0) {
      return marks;
    }
  }
  
  return total;
}

// ✅ Helper function to get obtained marks per question (matching Excel export logic)
function getQuestionObtainedMarks(questionAnswer: any): number {
  if (!questionAnswer) return 0;
  
  // EXACT SAME LOGIC as exportStyledDashboard line 908
  if (questionAnswer.marksAwarded != null && questionAnswer.marksAwarded !== '') {
    return Number(questionAnswer.marksAwarded);
  }
  if (questionAnswer.scoredMarks != null && questionAnswer.scoredMarks !== '') {
    return Number(questionAnswer.scoredMarks);
  }
  
  return 0;
}

// ✅ Helper function to calculate total obtained marks for a student
// @ts-ignore - kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getStudentObtainedMarks(attemptData: any): number {
  if (attemptData?.obtainedMarks != null) {
    return Number(attemptData.obtainedMarks);
  }
  
  if (Array.isArray(attemptData?.responses)) {
    let totalMarks = 0;
    attemptData.responses.forEach((response: any) => {
      totalMarks += getQuestionObtainedMarks(response);
    });
    return totalMarks;
  }
  
  return 0;
}

// ✅ Helper function to format any date (Firestore Timestamp, ISO string, or Date)
function formatAnyDate(dateVal: any): string {
  if (!dateVal) return '';
  try {
    const date = dateVal?.toDate ? dateVal.toDate() : (dateVal?.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal));
    if (isNaN(date.getTime())) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
  } catch { return ''; }
}

// ✅ Helper function to format exam date (DD-Mon-YYYY)
function formatExamDate(dateString: string): string {
  return formatAnyDate(dateString) || (dateString ? String(dateString) : 'N/A');
}

interface ExamDashboardProps {
  selectedExam: any;
  brandTheme: any;
  // These props are now optional since we'll fetch data ourselves
  presentStudents?: any[];
  absentStudents?: any[];
  totalStudents?: number;
  totalPresentCount?: number;
  totalAbsentCount?: number;
  onStudentPerformanceToggle?: (isShowing: boolean) => void; // ✅ NEW: Callback to notify parent
}

export default function ExamDashboard({
  selectedExam,
  brandTheme,
  presentStudents: propsPresentStudents,
  absentStudents: propsAbsentStudents,
  totalStudents: propsTotalStudents,
  totalPresentCount: propsTotalPresentCount,
  totalAbsentCount: propsTotalAbsentCount,
  onStudentPerformanceToggle // ✅ NEW: Callback
}: ExamDashboardProps) {

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStudentPerformance, setShowStudentPerformance] = useState(false);
  const hasLoggedView = useRef(false); // ✅ Track if we've logged this view // ✅ Renamed from showQuestionWise
  const [showQuestionPaper, setShowQuestionPaper] = useState(false); // ✅ NEW: For showing question paper view
  const [studentPerformanceData, setStudentPerformanceData] = useState<any>(null); // ✅ Renamed
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set()); // ✅ NEW: Track which students are expanded
  
  // Loading states for buttons
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [personalityAggregation, setPersonalityAggregation] = useState<any>(null);
  const [personalityAggLoading, setPersonalityAggLoading] = useState(false);

  // Fetch personality trait aggregation from Cloud Function
  useEffect(() => {
    const examId = selectedExam?.examId || selectedExam?.id;
    if (selectedExam?.personalityAssessment && selectedExam?.likertQuestions?.length > 0 && examId) {
      setPersonalityAggLoading(true);
      firebaseService.getPersonalityTraitAggregation(examId)
        .then((result: any) => {
          if (result.success) {
            setPersonalityAggregation(result);
          }
        })
        .catch((err: any) => console.error('Personality aggregation error:', err))
        .finally(() => setPersonalityAggLoading(false));
    }
  }, [selectedExam?.examId, selectedExam?.id, selectedExam?.personalityAssessment]);

  // Use dashboardData (full Firestore fetch) for accurate stats; props may be paginated/incomplete
  const presentStudents = dashboardData?.presentStudents || propsPresentStudents || [];
  const absentStudents = dashboardData?.absentStudents || propsAbsentStudents || [];
  const totalStudents = dashboardData?.totalStudents ?? propsTotalStudents ?? 0;
  const totalPresentCount = propsTotalPresentCount || presentStudents.length;
  const totalAbsentCount = propsTotalAbsentCount || absentStudents.length;

  useEffect(() => {
    const hasStudentData = propsPresentStudents && propsPresentStudents.length > 0;
    const examId = selectedExam?.examId || selectedExam?.id;
    
    console.log('🔍 ExamDashboard useEffect:', {
      hasStudentData,
      propsPresentStudentsLength: propsPresentStudents?.length,
      examId,
      willFetch: !!examId
    });
    
    // Always fetch full dashboard data for accurate stats (props may be paginated/incomplete)
    if (examId) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
    
    // Log view activity (non-blocking) - ONLY ONCE
    if (examId && !hasLoggedView.current) {
      hasLoggedView.current = true; // Mark as logged
      (async () => {
        try {
          const currentUser = await firebaseService.getCurrentUserProfile();
          if (currentUser && selectedExam) {
            await firebaseService.addActivityLog({
              userId: currentUser.userId,
              collegeId: selectedExam.collegeId || currentUser.collegeId,
              action: 'view_exam_dashboard',
              entityType: 'exam',
              entityId: examId,
              details: JSON.stringify({
                examTitle: selectedExam.title,
                examClass: selectedExam.class,
                examSubject: selectedExam.subject,
                examDate: selectedExam.examDate
              })
            });
          }
        } catch (logError) {
          console.warn('⚠️ Failed to log exam dashboard view:', logError);
        }
      })();
    }
  }, [selectedExam?.examId, selectedExam?.id, propsPresentStudents?.length]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const examId = selectedExam?.examId || selectedExam?.id;
      const data = await firebaseService.getExamDashboardData(examId);
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportReport = async () => {
  if (isExportingReport) return; // Prevent multiple clicks
  
  try {
    setIsExportingReport(true);
    const examId = selectedExam?.examId || selectedExam?.id;
    
    if (!examId) {
      alert('No exam selected');
      return;
    }
    
    // Fetch full exam with questions
    const fullExamData = await firebaseService.getExamWithQuestionDetails(examId);
    
    // 🔥 FETCH FRESH DASHBOARD DATA WITH SESSION INFO 🔥
    const dashboardData = await firebaseService.getExamDashboardData(examId);
    
    console.log('✅ Fresh dashboard data:', {
      presentStudents: dashboardData.presentStudents.length,
      firstStudent: dashboardData.presentStudents[0]
    });
    
    // Export with FRESH data (not props!)
    await exportStyledDashboardBrowser({
      selectedExam: fullExamData,
      brandTheme,
      presentStudents: dashboardData.presentStudents,  // ← Use fresh data!
      absentStudents: dashboardData.absentStudents,     // ← Use fresh data!
      totalStudents: dashboardData.totalStudents        // ← Use fresh data!
    });
    
    // Log download activity (non-blocking)
    try {
      const currentUser = await firebaseService.getCurrentUserProfile();
      if (currentUser) {
        await firebaseService.addActivityLog({
          userId: currentUser.userId,
          collegeId: selectedExam.collegeId || currentUser.collegeId,
          action: 'download_student_performance',
          entityType: 'report_download',
          entityId: examId,
          details: JSON.stringify({
            reportType: 'student_performance',
            examTitle: selectedExam.title,
            format: 'PDF',
            studentsIncluded: dashboardData.presentStudents.length
          })
        });
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log performance download:', logError);
    }
    
  } catch (error) {
    console.error('❌ Export error:', error);
    alert('Export failed: ' + (error instanceof Error ? error.message : String(error)));
  } finally {
    setIsExportingReport(false);
  }
};

  // ✅ Handler for student performance view
  const handleShowStudentPerformance = async () => {
    if (isLoadingPerformance) return; // Prevent multiple clicks
    
    try {
      setIsLoadingPerformance(true);
      const examId = selectedExam?.examId || selectedExam?.id;
      
      if (!examId) {
        alert('No exam selected');
        return;
      }
      
      // Fetch full exam with questions
      const fullExamData = await firebaseService.getExamWithQuestionDetails(examId);
      
      // Fetch fresh dashboard data
      const dashData = await firebaseService.getExamDashboardData(examId);
      
      setStudentPerformanceData({
        exam: fullExamData,
        presentStudents: dashData.presentStudents,
        questions: fullExamData.questionsList || []
      });
      
      setShowStudentPerformance(true);
      setShowQuestionPaper(false); // Hide question paper if it was shown
      setExpandedStudents(new Set()); // Reset expanded state
      
      // ✅ Notify parent to hide right panel
      onStudentPerformanceToggle?.(true);
      
    } catch (error) {
      console.error('❌ Error loading student performance data:', error);
      alert('Failed to load student performance');
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  // ✅ Handler for Question Paper view
  const handleShowQuestionPaper = () => {
    setShowQuestionPaper(true);
    setShowStudentPerformance(false); // Hide student performance if it was shown
    // Don't collapse right panel for question paper view
  };

  // ✅ Toggle student expanded/collapsed
  const toggleStudentExpanded = (studentId: string) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  // ✅ Handler to go back to dashboard
  const handleBackToDashboard = () => {
    setShowStudentPerformance(false);
    setShowQuestionPaper(false);
    // ✅ Notify parent to show right panel again
    onStudentPerformanceToggle?.(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-semibold">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if no exam is selected - show nice empty state
  if (!selectedExam) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-2xl px-8">
          {/* Animated Icons */}
          <div className="flex justify-center items-center space-x-8 mb-12">
            <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center animate-bounce" style={{ animationDelay: '0s', animationDuration: '2s' }}>
              <svg className="w-8 h-8 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform">
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '2s' }}>
              <svg className="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Text Content */}
          <h2 className="text-3xl font-bold text-gray-900 mb-3">No Exam Selected</h2>
          <p className="text-lg text-gray-600 mb-8">
            Select an exam from the list to view detailed results, student<br />
            performance, and analytics.
          </p>

          {/* Feature Pills */}
          <div className="flex justify-center space-x-4">
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-full">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium text-blue-700">Analytics</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-purple-50 rounded-full">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium text-purple-700">Students</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 rounded-full">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span className="text-sm font-medium text-green-700">Performance</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Dashboard Header */}
        {!showQuestionPaper && (
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="text-2xl font-bold text-gray-900">
              {showStudentPerformance ? 'Student Performance' : 'Exam Dashboard'}
            </h3>
            <div className="flex items-center gap-3">
              {!showStudentPerformance ? (
                <>
                  <button 
                    onClick={handleShowQuestionPaper}
                    className="w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors shadow-sm font-bold text-sm"
                    style={{ backgroundColor: brandTheme.colors.primary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = brandTheme.colors.primaryDark || brandTheme.colors.primary;
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = brandTheme.colors.primary;
                      e.currentTarget.style.opacity = '1';
                    }}
                    title="Question Paper"
                  >
                    QP
                  </button>
                  <button 
                    onClick={handleShowStudentPerformance}
                    disabled={isLoadingPerformance}
                    className={`w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors shadow-sm ${
                      isLoadingPerformance ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    title="Student Performance"
                  >
                    {isLoadingPerformance ? (
                      <FontAwesomeIcon icon={faSpinner} className="text-lg animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={faTable} className="text-lg" />
                    )}
                  </button>
                  <button 
                    onClick={handleExportReport}
                    disabled={isExportingReport}
                    className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-colors shadow-sm ${
                      isExportingReport ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isExportingReport ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faClipboardList} />
                        Export Report
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleBackToDashboard}
                  className="w-10 h-10 rounded-lg bg-gray-600 text-white hover:bg-gray-700 flex items-center justify-center transition-colors shadow-sm"
                  title="Back to Dashboard"
                >
                  <FontAwesomeIcon icon={faChartLine} className="text-lg" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Conditional Content: Dashboard OR Student Performance OR Question Paper */}
        {!showStudentPerformance && !showQuestionPaper ? (
          <div className="px-6 pb-4">
        {/* Key Metrics Grid - 3 columns */}
        <div className="grid grid-cols-3 gap-4">
          {/* Total Students Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandTheme.colors.primary}15` }}>
                <FontAwesomeIcon icon={faUsers} style={{ fontSize: '20px', color: brandTheme.colors.primary }} />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">{totalStudents}</p>
                <p className="text-xs text-gray-500 mt-1">Total Students</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-green-600 font-medium">{totalPresentCount} Present</span>
              <span className="text-xs text-red-600 font-medium">{totalAbsentCount} Absent</span>
            </div>
          </div>

          {/* Attendance Rate Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckSquare} style={{ fontSize: '20px' }} className="text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">
                  {totalStudents > 0 ? Math.round((totalPresentCount / totalStudents) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Attendance Rate</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 mt-3">
              <div 
                className="bg-green-500 h-1 rounded-full transition-all"
                style={{ width: `${totalStudents > 0 ? (totalPresentCount / totalStudents) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Submission Rate Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '20px' }} className="text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">
                  {presentStudents.filter((s: any) => s.hasAttempt).length}
                </p>
                <p className="text-xs text-gray-500 mt-1">Submissions</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-600">
                {totalPresentCount > 0 ? Math.round((presentStudents.filter((s: any) => s.hasAttempt).length / totalPresentCount) * 100) : 0}% of present
              </span>
            </div>
          </div>

          {/* Average Score, Highest Score, Pass Rate Cards - Hidden for personality-only exams */}
          {!(selectedExam.personalityAssessment && selectedExam.likertQuestions?.length > 0 && (!selectedExam.questionsList || selectedExam.questionsList.length === 0) && (!selectedExam.questionPool?.length || !selectedExam.pickRandomCount)) && (
          <>
          {/* Average Score Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faAward} style={{ fontSize: '20px' }} className="text-yellow-600" />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">
                  {(() => {
                    const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
                    if (submittedStudents.length === 0) return '0.00';
                    const avg = submittedStudents.reduce((sum: number, s: any) => sum + (s.attemptData?.percentage || 0), 0) / submittedStudents.length;
                    return avg.toFixed(2);
                  })()}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Average Score</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 mt-3">
              <div 
                className="h-1 rounded-full transition-all"
                style={{ 
                  width: `${(() => {
                    const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
                    if (submittedStudents.length === 0) return 0;
                    const avg = submittedStudents.reduce((sum: number, s: any) => sum + (s.attemptData?.percentage || 0), 0) / submittedStudents.length;
                    return avg;
                  })()}%`,
                  backgroundColor: brandTheme.colors.primary
                }}
              ></div>
            </div>
          </div>

          {/* Highest Score Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faTrophy} style={{ fontSize: '20px' }} className="text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">
                  {(() => {
                    const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
                    if (submittedStudents.length === 0) return '0.00';
                    const highest = Math.max(...submittedStudents.map((s: any) => s.attemptData?.percentage || 0));
                    return highest.toFixed(2);
                  })()}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Highest Score</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-purple-600 font-medium">Top performer</span>
            </div>
          </div>

          {/* Pass Rate Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '20px' }} className="text-emerald-600" />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">
                  {(() => {
                    const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
                    if (submittedStudents.length === 0) return '0';
                    const passed = submittedStudents.filter((s: any) => (s.attemptData?.percentage || 0) >= 40).length;
                    return Math.round((passed / submittedStudents.length) * 100);
                  })()}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Pass Rate</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-600">
                {(() => {
                  const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
                  const passed = submittedStudents.filter((s: any) => (s.attemptData?.percentage || 0) >= 40).length;
                  return `${passed} of ${submittedStudents.length}`;
                })()}
              </span>
            </div>
          </div>
          </>
          )}
        </div>

        {/* Performance Distribution - Hidden for personality-only exams */}
        {!(selectedExam.personalityAssessment && (!selectedExam.questionsList || selectedExam.questionsList.length === 0) && (!selectedExam.questionPool?.length || !selectedExam.pickRandomCount)) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Performance Distribution</h4>
          <div className="space-y-3">
            {(() => {
              const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
              const excellent = submittedStudents.filter((s: any) => (s.attemptData?.percentage || 0) >= 90).length;
              const good = submittedStudents.filter((s: any) => (s.attemptData?.percentage || 0) >= 75 && (s.attemptData?.percentage || 0) < 90).length;
              const average = submittedStudents.filter((s: any) => (s.attemptData?.percentage || 0) >= 60 && (s.attemptData?.percentage || 0) < 75).length;
              const poor = submittedStudents.filter((s: any) => (s.attemptData?.percentage || 0) < 60).length;
              const total = submittedStudents.length || 1;
              
              return (
                <>
                  {/* Excellent */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Excellent (90-100%)</span>
                      <span className="text-sm font-semibold text-green-600">{excellent} students</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-green-500 h-1 rounded-full" style={{ width: `${(excellent / total) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  {/* Good */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Good (75-89%)</span>
                      <span className="text-sm font-semibold text-blue-600">{good} students</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${(good / total) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  {/* Average */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Average (60-74%)</span>
                      <span className="text-sm font-semibold text-orange-600">{average} students</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-orange-500 h-1 rounded-full" style={{ width: `${(average / total) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  {/* Needs Improvement */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Needs Improvement (&lt;60%)</span>
                      <span className="text-sm font-semibold text-red-600">{poor} students</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-red-500 h-1 rounded-full" style={{ width: `${(poor / total) * 100}%` }}></div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        )}

        {/* Trait Distribution Overview - Visible only when Personality Assessment is true */}
        {selectedExam.personalityAssessment && selectedExam.likertQuestions?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mr-2">
              <FontAwesomeIcon icon={faStar} style={{ fontSize: '16px' }} className="text-purple-600" />
            </span>
            Trait Distribution Overview
          </h4>
          <p className="text-xs text-gray-500 mb-4">Average trait scores across all students who completed the personality assessment</p>
          {personalityAggLoading ? (
            <div className="flex items-center justify-center py-6">
              <FontAwesomeIcon icon={faSpinner} className="text-purple-500 animate-spin mr-2" />
              <span className="text-sm text-gray-400">Loading trait data...</span>
            </div>
          ) : !personalityAggregation || personalityAggregation.studentCount === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No personality assessment submissions yet</p>
          ) : (() => {
            const TRAIT_COLORS: Record<string, string> = {
              'Openness': '#3B82F6', 'Conscientiousness': '#10B981', 'Extraversion': '#F59E0B',
              'Agreeableness': '#EF4444', 'Emotional Stability': '#8B5CF6', 'Leadership': '#F97316',
              'Problem Solving': '#06B6D4', 'Communication': '#EC4899',
            };
            const getColor = (trait: string) => TRAIT_COLORS[trait] || '#6366F1';
            const sortedTraits = Object.entries(personalityAggregation.traits).sort((a: any, b: any) => b[1].average - a[1].average);

            return (
              <div className="space-y-3">
                {sortedTraits.map(([trait, data]: any) => {
                  const avg = data.average;
                  const color = getColor(trait);
                  const levelLabel = avg >= 80 ? 'High' : avg >= 50 ? 'Moderate' : 'Low';
                  const levelStyle = avg >= 80 ? { bg: '#DCFCE7', color: '#166534' } : avg >= 50 ? { bg: '#FEF9C3', color: '#854D0E' } : { bg: '#FEE2E2', color: '#991B1B' };
                  return (
                    <div key={trait}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                          <span className="text-sm font-medium text-gray-700">{trait}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: levelStyle.bg, color: levelStyle.color }}>{levelLabel}</span>
                          <span className="text-sm font-bold" style={{ color }}>{avg.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${avg}%`, backgroundColor: color, opacity: 0.85 }}></div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-end pt-2 border-t border-gray-100 mt-3">
                  <span className="text-xs text-gray-400">{personalityAggregation.studentCount} student{personalityAggregation.studentCount !== 1 ? 's' : ''} assessed</span>
                </div>
              </div>
            );
          })()}
        </div>
        )}

        {/* Personality Type Distribution - Visible only when Personality Assessment is true */}
        {selectedExam.personalityAssessment && selectedExam.likertQuestions?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mr-2">
              <FontAwesomeIcon icon={faUser} style={{ fontSize: '16px' }} className="text-blue-600" />
            </span>
            Personality Type Distribution
          </h4>
          <p className="text-xs text-gray-500 mb-4">How students are distributed across different personality types</p>
          {personalityAggLoading ? (
            <div className="flex items-center justify-center py-6">
              <FontAwesomeIcon icon={faSpinner} className="text-blue-500 animate-spin mr-2" />
              <span className="text-sm text-gray-400">Loading personality types...</span>
            </div>
          ) : !personalityAggregation || !personalityAggregation.personalityTypes?.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No personality assessment submissions yet</p>
          ) : (() => {
            const types = personalityAggregation.personalityTypes;
            const total = personalityAggregation.studentCount || 1;
            const TYPE_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'];

            return (
              <div className="space-y-3">
                {types.map((type: any, idx: number) => {
                  const color = TYPE_COLORS[idx % TYPE_COLORS.length];
                  const pct = Math.round((type.count / total) * 100);
                  return (
                    <div key={type.title} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                          <span className="text-sm font-semibold text-gray-800">{type.title}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold" style={{ color }}>{type.count} student{type.count !== 1 ? 's' : ''}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{type.desc ? type.desc.split('.')[0] : ''}</span>
                        {type.topTrait && (
                          <span className="text-xs text-gray-500">
                            Top: <strong className="text-gray-700">{type.topTrait}</strong>
                            {type.secondTrait && <> + <strong className="text-gray-700">{type.secondTrait}</strong></>}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-3">
                  <span className="text-xs text-gray-400">{types.length} personality type{types.length !== 1 ? 's' : ''} identified</span>
                  <span className="text-xs text-gray-400">{personalityAggregation.studentCount} student{personalityAggregation.studentCount !== 1 ? 's' : ''} assessed</span>
                </div>
              </div>
            );
          })()}
        </div>
        )}

        {/* Violations Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <FontAwesomeIcon icon={faShield} style={{ fontSize: '18px' }} className="text-red-600 mr-2" />
            Violations Summary
          </h4>
          <div className="grid grid-cols-4 gap-4">
            {(() => {
              const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
              const totalViolations = submittedStudents.reduce((sum: number, s: any) => sum + (s.attemptData?.violationCount || 0), 0);
              const studentsWithViolations = submittedStudents.filter((s: any) => (s.attemptData?.violationCount || 0) > 0).length;
              
              return (
                <>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-xl font-bold text-red-600">{totalViolations}</p>
                    <p className="text-xs text-gray-600 mt-1">Total Violations</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-xl font-bold text-orange-600">{studentsWithViolations}</p>
                    <p className="text-xs text-gray-600 mt-1">Students Flagged</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-xl font-bold text-green-600">{submittedStudents.length - studentsWithViolations}</p>
                    <p className="text-xs text-gray-600 mt-1">Clean Exams</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-xl font-bold text-blue-600">
                      {submittedStudents.length > 0 ? (totalViolations / submittedStudents.length).toFixed(1) : '0'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Avg per Student</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Top Performers - Hidden for personality-only exams */}
        {!(selectedExam.personalityAssessment && (!selectedExam.questionsList || selectedExam.questionsList.length === 0) && (!selectedExam.questionPool?.length || !selectedExam.pickRandomCount)) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <FontAwesomeIcon icon={faTrophy} style={{ fontSize: '18px' }} className="text-yellow-600 mr-2" />
            Top Performers
          </h4>
          <div className="space-y-3">
            {(() => {
              const submittedStudents = presentStudents
                .filter((s: any) => s.hasAttempt && s.attemptData)
                .sort((a: any, b: any) => (b.attemptData?.percentage || 0) - (a.attemptData?.percentage || 0))
                .slice(0, 5);
              
              return submittedStudents.length > 0 ? (
                submittedStudents.map((student: any, index: number) => (
                  <div key={student.studentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{student.studentName}</p>
                        <p className="text-xs text-gray-500">Roll: {student.rollNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ color: brandTheme.colors.primary }}>
                        {(() => {
                          const maxM = getTotalMarks(selectedExam) || student.attemptData?.maximumScore || 0;
                          const obtM = Number(student.attemptData?.obtainedMarks || student.attemptData?.totalScore || 0);
                          return maxM > 0 ? ((obtM / maxM) * 100).toFixed(2) : '0.00';
                        })()}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {student.attemptData?.obtainedMarks || student.attemptData?.totalScore || 0}/{getTotalMarks(selectedExam) || student.attemptData?.maximumScore || 0} marks
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No submissions yet</p>
              );
            })()}
          </div>
        </div>
        )}
        </div>
        ) : showStudentPerformance ? (
          /* ✅ Collapsible Student Performance View */
          <div className="px-6 pb-4">
          <StudentPerformanceView 
            data={studentPerformanceData}
            brandTheme={brandTheme}
            expandedStudents={expandedStudents}
            onToggleStudent={toggleStudentExpanded}
          />
          </div>
        ) : showQuestionPaper ? (
          /* ✅ NEW: Question Paper View */
          <div className="px-0 pb-4">
          <QuestionPaperView 
            selectedExam={selectedExam}
            brandTheme={brandTheme}
            onBackToDashboard={handleBackToDashboard}
          />
          </div>
        ) : null}
    </div>
  );
}

/* ✅ NEW: Question Paper View Component */
/* ✅ NEW: Question Paper View Component - Matches App.tsx rendering exactly */
function QuestionPaperView({ 
  selectedExam, 
  brandTheme,
  onBackToDashboard
}: { 
  selectedExam: any, 
  brandTheme: any,
  onBackToDashboard: () => void
}) {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!selectedExam) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No exam data available</p>
      </div>
    );
  }

  const safeRender = (value: any) => {
    if (value === undefined || value === null || value === '') {
      return 'N/A';
    }
    return String(value);
  };

  const convertToArray = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return [value];
      }
    }
    return [];
  };

  const copyToClipboard = (text: string, codeId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(codeId);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  return (
    <div className="bg-white h-full">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-white pt-4 pb-2">
        {/* Exam Title & Back Button */}
        <div className="px-6 pb-4">
          <div className="flex items-start justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">{selectedExam.title}</h1>
            <button 
              onClick={onBackToDashboard}
              className="w-10 h-10 rounded-lg bg-gray-600 text-white hover:bg-gray-700 flex items-center justify-center transition-colors shadow-sm flex-shrink-0 ml-4"
              title="Back to Dashboard"
            >
              <FontAwesomeIcon icon={faChartLine} className="text-lg" />
            </button>
          </div>
          
          {/* Created By */}
          <div className="mb-3">
            <p className="text-sm text-gray-600">
              Created By - <span className="text-gray-900 font-medium">{safeRender(selectedExam.createdByName || selectedExam.createdBy).split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>, {safeRender(selectedExam.createdByRole)}
            </p>
          </div>

          {/* Single Line Metadata with Icons */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
            <div className="flex items-center space-x-1.5">
              <FontAwesomeIcon icon={faUsers} className="text-gray-500" />
              <span>{safeRender(selectedExam.totalStudents || 0)} Students</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <FontAwesomeIcon icon={faClipboardList} className="text-gray-500" />
              <span>{safeRender(selectedExam.type)}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <FontAwesomeIcon icon={faCalendar} className="text-gray-500" />
              <span>{safeRender(selectedExam.mode || 'Online')}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <FontAwesomeIcon icon={faAward} className="text-gray-500" />
              <span>{safeRender(selectedExam.status)}</span>
            </div>
            {selectedExam.personalityAssessment && selectedExam.likertQuestions?.length > 0 && (
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                <FontAwesomeIcon icon={faChartBar} className="text-xs" />
                <span className="text-xs font-semibold">Personality Assessment</span>
              </div>
            )}
            {selectedExam.examCode && (
              <div className="flex items-center space-x-1.5">
                <FontAwesomeIcon icon={faClipboardList} className="text-gray-500" />
                <span>{safeRender(selectedExam.examCode)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exam Details Cards - 4 in a row, scrollable with content */}
      <div className="px-6 mb-6 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-4">
          {/* Date & Time Card */}
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <div className="flex items-center space-x-2 mb-2">
              <FontAwesomeIcon icon={faCalendar} className="text-orange-500 text-sm" />
              <span className="text-xs text-orange-500 font-medium">Date & Time</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mb-1">{formatExamDate(selectedExam.examDate)}</p>
            <p className="text-xs text-gray-600">{selectedExam.examTime || ''}</p>
          </div>
          
          {/* Duration Card */}
          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
            <div className="flex items-center space-x-2 mb-2">
              <FontAwesomeIcon icon={faClock} className="text-orange-500 text-sm" />
              <span className="text-xs text-orange-500 font-medium">Duration</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0)) || 'N/A'}
              {((parseInt(selectedExam.duration) || 0) + (selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0)) > 0 && <span className="text-sm font-medium text-gray-500 ml-1">min</span>}
            </p>
            {selectedExam.personalityAssessment && selectedExam.likertDuration > 0 && (
              <p className="text-xs text-gray-400 mt-1">{selectedExam.duration}m exam + {selectedExam.likertDuration}m personality</p>
            )}
          </div>
          
          {/* Questions Card */}
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <div className="flex items-center space-x-2 mb-2">
              <FontAwesomeIcon icon={faClipboardList} className="text-orange-500 text-sm" />
              <span className="text-xs text-orange-500 font-medium">Questions</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{(selectedExam.questionsList?.length || 0) + (selectedExam.pickRandomCount || 0)} Qs</p>
          </div>
          
          {/* Max Marks Card */}
          <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
            <div className="flex items-center space-x-2 mb-2">
              <FontAwesomeIcon icon={faTrophy} className="text-yellow-500 text-sm" />
              <span className="text-xs text-yellow-500 font-medium">Max Marks</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{getTotalMarks(selectedExam) || selectedExam.maxMarks || 0}</p>
          </div>
        </div>
      </div>

      {/* Section A — Personality Assessment (Likert) */}
      {selectedExam.personalityAssessment && selectedExam.likertQuestions && selectedExam.likertQuestions.length > 0 && (
        <div className="bg-white p-2 mb-4 px-6">
          <div
            className="cursor-pointer select-none"
            onClick={() => {
              const el = document.getElementById('dashboard-likert-section-collapse');
              if (el) el.classList.toggle('hidden');
              const icon = document.getElementById('dashboard-likert-chevron');
              if (icon) icon.classList.toggle('rotate-180');
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                <FontAwesomeIcon icon={faChartBar} className="text-purple-600" />
                <span>{(selectedExam.questionsList?.length > 0 || (selectedExam.questionPool?.length > 0 && selectedExam.pickRandomCount > 0)) ? 'Section A — ' : ''}Personality Assessment</span>
              </h3>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full flex items-center space-x-1.5">
                  <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                  <span>{selectedExam.likertDuration || 10} min</span>
                </span>
                <FontAwesomeIcon
                  id="dashboard-likert-chevron"
                  icon={faChevronDown}
                  className="text-gray-400 text-sm transition-transform duration-200"
                />
              </div>
            </div>
            <div className="text-xs font-medium text-gray-500">
              Total Questions: {selectedExam.likertQuestions.length} • Big-8 personality traits{(selectedExam.questionsList?.length > 0 || (selectedExam.questionPool?.length > 0 && selectedExam.pickRandomCount > 0)) ? ' • Completed before the main exam' : ''}
            </div>
          </div>
          <div id="dashboard-likert-section-collapse" className="">
            <div className="space-y-4 mt-3">
              {selectedExam.likertQuestions.map((q: any, idx: number) => {
                const isLikertExpanded = expandedQuestionId === `likert-${q.id || idx}`;
                return (
                  <div
                    key={q.id || idx}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200"
                    onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = brandTheme.colors.primary; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ background: brandTheme.gradients.primary }}>
                          {idx + 1}
                        </div>
                        <div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">LIKERT</span>
                          {q.board && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">{q.board.toString().toUpperCase()}</span>
                          )}
                          {q.complexity && (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${q.complexity === 'easy' ? 'bg-pink-100 text-pink-700' : q.complexity === 'medium' ? 'bg-green-100 text-green-700' : 'bg-cyan-100 text-cyan-700'}`}>
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
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${q.likertDirection === 'positive' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
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
                                <div key={optIdx} className={`rounded-xl p-2.5 text-center border-2 ${isHighest ? 'border-green-300 bg-green-50' : isLowest ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                                  <div className={`text-xl font-bold mb-0.5 ${isHighest ? 'text-green-600' : isLowest ? 'text-red-500' : 'text-gray-500'}`}>{score ?? (optIdx + 1)}</div>
                                  <div className="text-[9px] font-medium text-gray-600 leading-tight">{option}</div>
                                </div>
                              );
                            })}
                          </div>
                          {q.correctAnswers && (
                            <p className="text-[10px] text-gray-400 mt-1.5 mb-2 text-center">Score mapping: {q.correctAnswers.join(' → ')}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
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
                          const qCreatedAt = q.createdAt || selectedExam.createdAt || selectedExam.examDate;
                          const formatted = qCreatedAt ? formatAnyDate(qCreatedAt) : '';
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
                              <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
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

      {/* Section B — Questions List */}
      {!(selectedExam.personalityAssessment && selectedExam.likertQuestions?.length > 0 && (!selectedExam.questionsList || selectedExam.questionsList.length === 0) && (!selectedExam.questionPool?.length || !selectedExam.pickRandomCount)) && selectedExam.questionsList && selectedExam.questionsList.length > 0 && (
        <div className="bg-white p-2 mb-6 px-6">
          <div
            className="mb-4 cursor-pointer select-none"
            onClick={() => {
              const el = document.getElementById('dashboard-questions-section-collapse');
              if (el) el.classList.toggle('hidden');
              const icon = document.getElementById('dashboard-questions-chevron');
              if (icon) icon.classList.toggle('rotate-180');
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                <FontAwesomeIcon icon={faClipboardList} className="text-gray-600" />
                <span>{selectedExam.personalityAssessment && selectedExam.likertQuestions?.length > 0 ? 'Section B' : 'Section A'} — Questions List</span>
              </h3>
              <FontAwesomeIcon id="dashboard-questions-chevron" icon={faChevronDown} className="text-gray-400 text-sm transition-transform duration-200" />
            </div>
            <div className="text-xs font-medium text-gray-500">
              {(() => {
                const mcqCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.MCQ).length;
                const fitbCount = selectedExam.questionsList.filter((q: any) => { const t = (q.type || '').toString().toLowerCase().replace(/\s+/g, ''); const hasBlanks = q.blanks && Array.isArray(q.blanks) && q.blanks.length > 0; return hasBlanks || t === QUESTION_TYPES.FITB || q.type === QUESTION_TYPES.FITB; }).length;
                const descriptiveCount = selectedExam.questionsList.filter((q: any) => { const hasBlanks = q.blanks && Array.isArray(q.blanks) && q.blanks.length > 0; return q.type === QUESTION_TYPES.DESCRIPTIVE && !hasBlanks; }).length;
                const jumbledCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.JUMBLED).length;
                const codeCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.CODE).length;
                const sqlCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.SQL).length;
                const parts = [`Total Questions: ${selectedExam.questionsList.length}`, `Max Marks: ${safeRender(selectedExam.maxMarks)}`];
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
          <div id="dashboard-questions-section-collapse">
          <div className="space-y-4">
            {selectedExam.questionsList.map((question: any, index: number) => (
              <div 
                key={question.id} 
                className={`bg-white rounded-xl p-5 hover:shadow-lg transition-all duration-200 ${
                  expandedQuestionId === question.id 
                    ? 'border border-orange-400' 
                    : 'border border-gray-200'
                }`}
                style={expandedQuestionId === question.id ? { borderColor: '#fb923c' } : {}}
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
                          
                          if (question.type === QUESTION_TYPES.MCQ) return QUESTION_TYPE_LABELS[QUESTION_TYPES.MCQ];
                          if (typeStr === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.FITB) return QUESTION_TYPE_LABELS[QUESTION_TYPES.FITB];
                          if (question.type === QUESTION_TYPES.JUMBLED) return QUESTION_TYPE_LABELS[QUESTION_TYPES.JUMBLED];
                          if (question.type === QUESTION_TYPES.CODE) return QUESTION_TYPE_LABELS[QUESTION_TYPES.CODE];
                          if (question.type === QUESTION_TYPES.SQL) return QUESTION_TYPE_LABELS[QUESTION_TYPES.SQL] || 'SQL';
                          return QUESTION_TYPE_LABELS[QUESTION_TYPES.DESCRIPTIVE];
                        })()}
                      </span>
                      {question.type === QUESTION_TYPES.CODE && (question.programmingLanguage) && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 mr-2">
                          {(question.programmingLanguage.charAt(0).toUpperCase() + question.programmingLanguage.slice(1).toLowerCase())}
                        </span>
                      )}
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
                    <div className="h-8 bg-gray-100 px-3 rounded-lg flex items-center">
                      <span className="text-sm font-bold text-gray-900">{safeRender(question.marks || question.maximumMarks)}</span>
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
                              <div key={partIndex} className="relative rounded-lg overflow-hidden isolate">
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

                {/* Jumbled Question Items - Simple display with grip dots */}
                {question.type === QUESTION_TYPES.JUMBLED && expandedQuestionId !== question.id && (
                  <div className="mt-3 space-y-2">
                    {(() => {
                      // Get jumbledItems if they exist (pre-shuffled)
                      const jumbledItemsRaw = question.jumbledItems;
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

                {/* Question Footer - Badges and View Details */}
                {expandedQuestionId !== question.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      {(question as any).source === 'custom' ? (
                        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                          <FontAwesomeIcon icon={faLayerGroup} />
                          <span className="font-semibold">Custom</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                          <FontAwesomeIcon icon={faClipboardList} className="text-xs" />
                          <span className="font-semibold">Question Bank</span>
                        </div>
                      )}
                      {(question as any).createdByName && (
                        <div className="flex items-center space-x-1">
                          <FontAwesomeIcon icon={faUser} />
                          <span>Created by: {(question as any).createdByName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>
                        </div>
                      )}
                      {(() => {
                        const d = formatAnyDate((question as any).createdAt || selectedExam.createdAt || selectedExam.examDate);
                        return d ? (
                          <div className="flex items-center space-x-1">
                            <FontAwesomeIcon icon={faCalendar} />
                            <span>{d}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex items-center space-x-3">
                      {(question as any).source === 'custom' || (question as any).isProprietaryQuestion ? (
                        <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                          <FontAwesomeIcon icon={faTrophy} />
                          <span className="text-xs font-semibold">Private</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                          </svg>
                          <span className="text-xs font-semibold">Public</span>
                        </div>
                      )}
                      <button
                        onClick={() => setExpandedQuestionId(question.id)}
                        className="text-sm font-medium transition-colors hover:underline"
                        style={{ color: brandTheme.colors.primary }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Details Section */}
                {expandedQuestionId === question.id && (
                  <>
                    {/* MCQ - Options with Correct Answer */}
                    {question.type === QUESTION_TYPES.MCQ && question.options && (
                      <div className="mt-3">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Options with Correct Answer</h2>
                        <div className="space-y-2">
                          {question.options.map((option: string, optIndex: number) => {
                            // Check if this option is correct
                            const isCorrectByText = question.correctAnswers && 
                              Array.isArray(question.correctAnswers) && 
                              question.correctAnswers.some((ans: string) => 
                                ans.trim().toLowerCase() === option.trim().toLowerCase()
                              );
                            
                            return (
                              <div
                                key={optIndex}
                                className={`flex items-center p-2.5 rounded-lg border ${
                                  isCorrectByText
                                    ? 'bg-green-50 border-green-300'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                      isCorrectByText
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-300 text-gray-700'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + optIndex)}
                                  </div>
                                  <span className={`text-sm ${
                                    isCorrectByText
                                      ? 'text-green-900 font-medium'
                                      : 'text-gray-700'
                                  }`}>
                                    {option}
                                  </span>
                                </div>
                                {isCorrectByText && (
                                  <span className="ml-auto text-xs font-semibold text-green-600 flex-shrink-0">✓ Correct Answer</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* FITB - Correct Answers */}
                    {(() => {
                      const typeStr = (question.type || '').toString().toLowerCase().replace(/\s+/g, '');
                      const isFITB = typeStr === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.FITB;
                      
                      const answers = question.correctAnswers;
                      
                      if (!isFITB || !answers || !Array.isArray(answers) || answers.length === 0) {
                        return null;
                      }

                      return (
                        <div className="mt-4">
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

                    {/* Jumbled - Correct Sequence */}
                    {question.type === QUESTION_TYPES.JUMBLED && (() => {
                      const correctAnswersArray = convertToArray(question.correctAnswers);
                      const hasCorrectAnswers = correctAnswersArray && correctAnswersArray.length > 0;
                      
                      if (!hasCorrectAnswers) return null;
                      
                      return (
                        <div className="mt-4">
                          <h2 className="text-lg font-bold text-gray-900 mb-3">Correct Sequence:</h2>
                          <div className="space-y-2">
                            {correctAnswersArray.map((item: string, seqIndex: number) => (
                              <div
                                key={seqIndex}
                                className="flex items-center space-x-3 p-2.5 rounded-lg bg-green-50 border border-green-200"
                              >
                                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                                  {seqIndex + 1}
                                </div>
                                <div 
                                  className="text-sm text-gray-700 font-medium prose prose-sm max-w-none
                                    [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                    [&_code]:bg-green-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                    [&_strong]:font-semibold"
                                  dangerouslySetInnerHTML={{ __html: item }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Descriptive - Correct Answer & Hint */}
                    {(question.type === QUESTION_TYPES.DESCRIPTIVE && !(() => { const t = (question.type||'').toString().toLowerCase().replace(/\s+/g,''); return t === QUESTION_TYPES.FITB; })()) && (
                      <>
                        {question.correctAnswers && (Array.isArray(question.correctAnswers) ? question.correctAnswers.length > 0 : question.correctAnswers) && (
                          <div className="mt-3">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Model Answer</h2>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              {Array.isArray(question.correctAnswers)
                                ? question.correctAnswers.map((ans: string, i: number) => (
                                    <p key={i} className="text-sm text-green-900 font-mono whitespace-pre-wrap">{ans}</p>
                                  ))
                                : <p className="text-sm text-green-900 font-mono whitespace-pre-wrap">{String(question.correctAnswers)}</p>
                              }
                            </div>
                          </div>
                        )}
                        {question.hint && (
                          <div className="mt-3">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Hint</h2>
                            <div
                              className="text-sm text-gray-700 italic prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: question.hint }}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* SQL Questions - Schema & Test Cases (full App.tsx rendering) */}
                    {question.type === QUESTION_TYPES.SQL && (() => {
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

                          {/* Model Answer for SQL */}
                          {question.correctAnswers && (Array.isArray(question.correctAnswers) ? question.correctAnswers.length > 0 : question.correctAnswers) && (
                            <div>
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Model Answer</h2>
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                {Array.isArray(question.correctAnswers)
                                  ? question.correctAnswers.map((ans: string, i: number) => (
                                      <p key={i} className="text-sm text-green-900 font-mono whitespace-pre-wrap">{ans}</p>
                                    ))
                                  : <p className="text-sm text-green-900 font-mono whitespace-pre-wrap">{String(question.correctAnswers)}</p>
                                }
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
                              <div className="text-sm text-gray-700 italic prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: question.hint }} />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Code Questions - Chapter, Hint, Solution, Test Cases */}
                    {question.type === QUESTION_TYPES.CODE && (
                      <>
                        {/* Chapter */}
                        {'chapter' in question && question.chapter && (
                          <div className="mt-3">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                            <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                          </div>
                        )}

                        {/* Solution Hint */}
                        {question.hint && (
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

                        {/* Solution */}
                        {question.solution && (
                          <div className="mt-3">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Solution</h2>
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
                                  onClick={() => copyToClipboard(String(question.solution), `solution-${question.id}`)}
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
                                  showLineNumbers={true}
                                >
                                  {String(question.solution)}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Test Cases */}
                        {(question as any).testCases && Array.isArray((question as any).testCases) && (question as any).testCases.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <h2 className="text-lg font-bold text-gray-900">Test Cases</h2>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium text-gray-600">
                                  {(question as any).testCases.length} test cases
                                </span>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                                  Total: {(question as any).testCases.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0).toFixed(1)} marks
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
                                  {(question as any).testCases.map((testCase: any, tcIndex: number) => (
                                    <tr key={tcIndex} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-center">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white bg-blue-500">
                                          {tcIndex + 1}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 whitespace-pre-wrap">
                                          {testCase.input ? testCase.input.replace(/\\n/g, '\n') : 'N/A'}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-200 text-green-700 whitespace-pre-wrap">
                                          {testCase.expected_output ? testCase.expected_output.replace(/\\n/g, '\n') : 'N/A'}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
                                          {testCase.marks !== undefined ? testCase.marks.toFixed(1) : '0.0'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Expanded Footer */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          {(question as any).source === 'custom' ? (
                            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                              <FontAwesomeIcon icon={faLayerGroup} />
                              <span className="font-semibold">Custom</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                              <FontAwesomeIcon icon={faClipboardList} />
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
                          const qCreatedAt = (question as any).createdAt || selectedExam.createdAt || selectedExam.examDate;
                          const formatted = qCreatedAt ? formatAnyDate(qCreatedAt) : '';
                          return formatted ? (
                            <div className="flex items-center space-x-1">
                              <FontAwesomeIcon icon={faCalendar} />
                              <span>{formatted}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center space-x-3">
                        {(question as any).source === 'custom' || (question as any).isProprietaryQuestion ? (
                          <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                            <FontAwesomeIcon icon={faTrophy} />
                            <span className="text-xs font-semibold">Private</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                            </svg>
                            <span className="text-xs font-semibold">Public</span>
                          </div>
                        )}
                        <button
                          onClick={() => setExpandedQuestionId(null)}
                          className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors text-blue-600 hover:bg-blue-50"
                        >
                          Hide Details
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* Section C — Question Pool */}
      {selectedExam.questionPool && Array.isArray(selectedExam.questionPool) && selectedExam.questionPool.length > 0 && selectedExam.pickRandomCount && selectedExam.pickRandomCount > 0 ? (
        <div className="bg-white p-5 mb-6 mx-6 rounded-xl border-2 border-purple-200 shadow-md">
          <div
            className="cursor-pointer select-none"
            onClick={() => {
              const el = document.getElementById('dashboard-pool-section-collapse');
              if (el) el.classList.toggle('hidden');
              const icon = document.getElementById('dashboard-pool-chevron');
              if (icon) icon.classList.toggle('rotate-180');
            }}
          >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-md">
                <FontAwesomeIcon icon={faLayerGroup} className="text-white text-lg" />
              </div>
              <span>{selectedExam.personalityAssessment && selectedExam.likertQuestions?.length > 0 ? 'Section C' : selectedExam.questionsList?.length > 0 ? 'Section B' : 'Section A'} — Question Pool</span>
            </h3>
            <div className="flex items-center space-x-3">
            <div className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
              Random Selection
            </div>
            <FontAwesomeIcon id="dashboard-pool-chevron" icon={faChevronDown} className="text-gray-400 text-sm transition-transform duration-200" />
            </div>
          </div>
          </div>
          <div id="dashboard-pool-section-collapse">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Questions in Pool */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200">
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
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200">
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
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
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
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
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
    </div>
  );
}

// ✅ ADDED: Helper function to format time
function formatTime(seconds: number): string {
  if (!seconds || seconds === 0) return '0m 0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/* ✅ NEW: Collapsible Student Performance Component */
function StudentPerformanceView({ 
  data, 
  brandTheme, 
  expandedStudents, 
  onToggleStudent 
}: { 
  data: any, 
  brandTheme: any,
  expandedStudents: Set<string>,
  onToggleStudent: (studentId: string) => void
}) {
  const [personalityStudent, setPersonalityStudent] = useState<any>(null); // holds { student, attempt }
  const [showPersonalityHelp, setShowPersonalityHelp] = useState(false);
  const personalityReportRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const STUDENTS_PER_PAGE = 20;

  // Server-side pagination state for personality-only view
  const [paginatedPersonalityStudents, setPaginatedPersonalityStudents] = useState<any[]>([]);
  const [personalityLastDoc, setPersonalityLastDoc] = useState<any>(null);
  const [personalityHasMore, setPersonalityHasMore] = useState(true);
  const [personalityTotalCount, setPersonalityTotalCount] = useState(0);
  const [personalityLoading, setPersonalityLoading] = useState(false);
  const [personalityInitialLoaded, setPersonalityInitialLoaded] = useState(false);

  const { exam, presentStudents } = data || { exam: null, presentStudents: [] };
  const questions = data?.questions || [];
  const isPersonalityOnly = !!(exam?.personalityAssessment && (!exam?.questionsList || exam.questionsList.length === 0) && (!exam?.questionPool?.length || !exam?.pickRandomCount));

  // Load personality students via server-side pagination
  const loadPersonalityStudents = useCallback(async (isLoadMore = false) => {
    if (!exam || personalityLoading) return;
    setPersonalityLoading(true);
    try {
      const examId = exam.examId || exam.id;
      const result = await firebaseService.getExamPresentStudentsPaginated(
        examId,
        exam.class || '',
        exam.board || '',
        STUDENTS_PER_PAGE,
        isLoadMore ? personalityLastDoc : null,
        isLoadMore // skip total count on load more
      );
      if (isLoadMore) {
        setPaginatedPersonalityStudents(prev => [...prev, ...result.students]);
      } else {
        setPaginatedPersonalityStudents(result.students);
        setPersonalityTotalCount(result.totalCount);
      }
      setPersonalityLastDoc(result.lastDoc);
      setPersonalityHasMore(result.hasMore);
      setPersonalityInitialLoaded(true);
    } catch (err) {
      console.error('❌ Error loading personality students:', err);
    } finally {
      setPersonalityLoading(false);
    }
  }, [exam, personalityLastDoc, personalityLoading]);

  // Auto-load on mount for personality-only
  useEffect(() => {
    if (isPersonalityOnly && !personalityInitialLoaded && data) {
      loadPersonalityStudents(false);
    }
  }, [isPersonalityOnly, personalityInitialLoaded, data]);

  // ✅ DEBUG: Log incoming data
  console.log('🔍 StudentPerformanceView data:', {
    hasData: !!data,
    hasQuestions: data?.questions?.length,
    presentStudentsCount: data?.presentStudents?.length,
    presentStudentsWithAttempt: data?.presentStudents?.filter((s: any) => s.hasAttempt).length,
    presentStudentsWithAttemptData: data?.presentStudents?.filter((s: any) => s.attemptData).length,
    firstStudent: data?.presentStudents?.[0],
    examQuestionsList: exam?.questionsList?.length,
    examPickRandomCount: exam?.pickRandomCount,
    examPoolQuestionMarks: exam?.poolQuestionMarks,
    getTotalMarksResult: exam ? getTotalMarks(exam) : 'no exam',
  });
  
  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // If it's personality-only AND no questions, render the personality assessment view
  if (isPersonalityOnly && questions.length === 0) {
    const submittedStudents = paginatedPersonalityStudents.filter((s: any) => s.hasAttempt && s.attemptData && s.attemptData.personalityProfile);

    const TRAIT_COLORS: Record<string, string> = {
      'Openness': '#3B82F6', 'Conscientiousness': '#10B981', 'Extraversion': '#F59E0B',
      'Agreeableness': '#EF4444', 'Emotional Stability': '#8B5CF6', 'Leadership': '#F97316',
      'Problem Solving': '#06B6D4', 'Communication': '#EC4899',
    };
    const getColor = (trait: string) => TRAIT_COLORS[trait] || '#6366F1';

    const rsColor = (rs: string) => {
      if (rs === 'Genuine') return { color: '#166534', bg: '#DCFCE7' };
      if (rs === 'Central Tendency') return { color: '#854D0E', bg: '#FEF9C3' };
      return { color: '#991B1B', bg: '#FEE2E2' };
    };

    const getLevelStyle = (level: string) => {
      if (level === 'Very High' || level === 'High') return { bg: '#DCFCE7', color: '#166534' };
      if (level === 'Moderate') return { bg: '#FEF9C3', color: '#854D0E' };
      return { bg: '#FEE2E2', color: '#991B1B' };
    };

    // Collect all trait names across students
    const allTraits = Array.from(new Set(
      submittedStudents.flatMap((s: any) => Object.keys(s.attemptData.personalityProfile || {}))
    ));

    return (
      <div className="bg-white h-full">
        {/* Exam Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mx-6 mt-4 mb-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">{exam.name || exam.title}</h4>
          <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
            {(exam.examDate || exam.startDate) && (
              <span>Date: {formatAnyDate(exam.examDate || exam.startDate) || 'N/A'}</span>
            )}
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
              <FontAwesomeIcon icon={faChartBar} className="text-xs" />
              Personality Assessment
            </span>
            <span className="text-xs text-gray-500">{personalityTotalCount || submittedStudents.length} submitted</span>
          </div>
        </div>

        {/* Personality Assessment Students */}
        <div className="px-6 space-y-4">
          {submittedStudents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <FontAwesomeIcon icon={faChartBar} className="text-4xl text-gray-300 mb-3" />
              <p className="text-gray-500">No personality assessment submissions yet</p>
            </div>
          ) : (
            <>
              {/* Compact Table — one row per student, trait % as columns */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[160px]">Student</th>
                        <th className="text-center py-2.5 px-2 font-semibold text-gray-600 min-w-[70px]">Style</th>
                        <th className="text-center py-2.5 px-2 font-semibold text-gray-600 min-w-[130px]">Type</th>
                        {allTraits.map(trait => (
                          <th key={trait} className="text-center py-2.5 px-2 font-semibold text-gray-600 min-w-[60px]" title={trait}>
                            <div className="flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(trait) }} />
                              <span className="truncate">{trait.length > 10 ? trait.substring(0, 8) + '..' : trait}</span>
                            </div>
                          </th>
                        ))}
                        <th className="text-center py-2.5 px-2 font-semibold text-gray-600 min-w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {submittedStudents.map((student: any, idx: number) => {
                        const attempt = student.attemptData;
                        const profile = attempt?.personalityProfile || {};
                        const responseStyle = attempt?.responseStyle || 'Genuine';
                        const rs = rsColor(responseStyle);
                        const pType = attempt?.personalityType || {};

                        return (
                          <tr key={student.studentId} className={`border-b border-gray-50 hover:bg-gray-50/80 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                            <td className="py-2.5 px-4 sticky left-0 bg-white z-10" style={idx % 2 !== 0 ? { backgroundColor: '#fafafa' } : {}}>
                              <p className="font-semibold text-gray-900 text-sm leading-tight">{student.studentName}</p>
                              <p className="text-gray-400 text-xs">Roll: {student.rollNumber}</p>
                            </td>
                            <td className="text-center py-2.5 px-2">
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ color: rs.color, backgroundColor: rs.bg }}>
                                {responseStyle === 'Central Tendency' ? 'Central' : responseStyle === 'Extreme Responding' ? 'Extreme' : responseStyle === 'Careless Responding' ? 'Careless' : responseStyle}
                              </span>
                            </td>
                            <td className="text-center py-2.5 px-2">
                              {pType.title && (
                                <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap" title={pType.title}>
                                  {pType.title.length > 18 ? pType.title.substring(0, 16) + '..' : pType.title}
                                </span>
                              )}
                            </td>
                            {allTraits.map(trait => {
                              const d = profile[trait];
                              if (!d) return <td key={trait} className="text-center py-2.5 px-2 text-gray-300">—</td>;
                              const lvl = getLevelStyle(d.level);
                              return (
                                <td key={trait} className="text-center py-2.5 px-2">
                                  <span className="font-bold text-xs px-1.5 py-0.5 rounded" style={{ color: lvl.color, backgroundColor: lvl.bg }}>
                                    {d.percentage.toFixed(0)}%
                                  </span>
                                </td>
                              );
                            })}
                            <td className="text-center py-2.5 px-2">
                              <button
                                onClick={() => setPersonalityStudent({ student, attempt })}
                                className="text-indigo-500 hover:text-indigo-700 transition-colors"
                                title="Full Report"
                              >
                                <FontAwesomeIcon icon={faChartBar} style={{ fontSize: '14px' }} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Load More / Status */}
              <div className="flex items-center justify-between py-4">
                <p className="text-xs text-gray-500">
                  Showing {submittedStudents.length} of {personalityTotalCount || submittedStudents.length} students
                </p>
                {personalityHasMore && (
                  <button
                    onClick={() => loadPersonalityStudents(true)}
                    disabled={personalityLoading}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    style={{ color: brandTheme.colors.primary }}
                  >
                    {personalityLoading ? (
                      <><FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1.5" /> Loading...</>
                    ) : (
                      <>Load More (20)</>
                    )}
                  </button>
                )}
              </div>

              {/* Initial loading state */}
              {personalityLoading && submittedStudents.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-lg mr-2" style={{ color: brandTheme.colors.primary }} />
                  <span className="text-sm text-gray-500">Loading students...</span>
                </div>
              )}
            </>
          )}
        </div>

      {/* Personality Profile Modal */}
      {(() => {
        const attempt = personalityStudent?.attempt;
        const student = personalityStudent?.student;
        const isOpen = !!personalityStudent;
        if (!attempt) return null;

        const profile: Record<string, { score: number; maxScore: number; average: number; percentage: number; level: string }> = attempt?.personalityProfile || {};
        const traits = Object.entries(profile).sort((a: any, b: any) => b[1].percentage - a[1].percentage);

        const TRAIT_COLORS: Record<string, string> = {
          'Openness': '#3B82F6', 'Conscientiousness': '#10B981', 'Extraversion': '#F59E0B',
          'Agreeableness': '#EF4444', 'Emotional Stability': '#8B5CF6', 'Leadership': '#F97316',
          'Problem Solving': '#06B6D4', 'Communication': '#EC4899',
        };
        const getColor = (trait: string) => TRAIT_COLORS[trait] || '#6366F1';

        const TRAIT_DESCRIPTIONS: Record<string, string> = {
          'Openness': "Curious and receptive to new ideas, enjoys exploring unconventional approaches",
          'Conscientiousness': 'Organized, goal-oriented, and reliable in following through on commitments',
          'Extraversion': 'Energized by social interactions, expressive and outgoing in group settings',
          'Agreeableness': "Cooperative and empathetic, values harmony and others' feelings",
          'Emotional Stability': 'Maintains composure under pressure, resilient to stress and setbacks',
          'Leadership': 'Naturally takes charge, inspires teams, and accepts responsibility for outcomes',
          'Problem Solving': 'Excels at breaking down complex challenges and finding logical solutions',
          'Communication': 'Effectively expresses ideas clearly and adapts style for different audiences',
        };

        const getLevelStyle = (level: string) => {
          if (level === 'Very High' || level === 'High') return { bg: '#DCFCE7', color: '#166534' };
          if (level === 'Moderate') return { bg: '#FEF9C3', color: '#854D0E' };
          return { bg: '#FEE2E2', color: '#991B1B' };
        };

        const savedType = attempt?.personalityType || {};
        const pType = {
          title: savedType.title || 'The Well-Rounded Individual',
          desc: savedType.desc || 'You demonstrate a balanced personality profile with strengths across multiple dimensions.',
          careers: (savedType.careers || []) as string[],
        };
        const responseStyle: string = attempt?.responseStyle || 'Genuine';
        const responseStyleConfig: Record<string, { bg: string; color: string; desc: string }> = {
          'Genuine':             { bg: '#DCFCE7', color: '#166534', desc: 'Responses were varied and consistent, indicating honest and thoughtful self-evaluation.' },
          'Central Tendency':    { bg: '#FEF9C3', color: '#854D0E', desc: 'Student avoided taking strong positions. Results may not fully reflect true personality.' },
          'Acquiescence':        { bg: '#FEE2E2', color: '#991B1B', desc: 'Student agreed with most statements. Results may be unreliable.' },
          'Extreme Responding':  { bg: '#FEE2E2', color: '#991B1B', desc: 'Student only picked extremes. Results are questionable.' },
          'Careless Responding': { bg: '#FEE2E2', color: '#991B1B', desc: 'Student did not engage meaningfully. Recommend re-test.' },
        };
        const rsConfig = responseStyleConfig[responseStyle] || responseStyleConfig['Genuine'];
        const top3 = traits.slice(0, 3);
        const bottom3 = traits.slice(-3).reverse();

        return (
          <div className={`fixed inset-0 z-[9999] flex items-start justify-end p-2 transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0" onClick={() => { setPersonalityStudent(null); setShowPersonalityHelp(false); }} />
            <div className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[42rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
              isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
            }`} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
                style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2D1B69 50%, #4F46E5 100%)' }}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <FontAwesomeIcon icon={faChartBar} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Personality Profile</h2>
                    <p className="text-xs text-white/70">OCEAN + Custom Traits · Big 8 Framework</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const content = personalityReportRef.current;
                      if (!content) return;
                      const prev = document.getElementById('personality-print-clone');
                      if (prev) prev.remove();
                      const wrapper = document.createElement('div');
                      wrapper.id = 'personality-print-clone';
                      wrapper.style.cssText = 'position:absolute; left:-9999px; top:0; width:100%; background:#F8F7F4;';
                      const modalInner = content.parentElement;
                      if (modalInner) {
                        const headerEl = modalInner.querySelector('.rounded-t-2xl') as HTMLElement | null;
                        if (headerEl) {
                          const headerClone = headerEl.cloneNode(true) as HTMLElement;
                          headerClone.style.cssText = 'background:linear-gradient(135deg,#1A1A2E 0%,#2D1B69 50%,#4F46E5 100%);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;';
                          headerClone.querySelectorAll('button').forEach((b: HTMLElement) => b.style.display = 'none');
                          wrapper.appendChild(headerClone);
                        }
                      }
                      const contentClone = content.cloneNode(true) as HTMLElement;
                      contentClone.style.cssText = 'overflow:visible;height:auto;max-height:none;background:#F8F7F4;padding:20px;';
                      contentClone.querySelectorAll('*').forEach((el: Element) => {
                        const e = el as HTMLElement;
                        const cs = window.getComputedStyle(e);
                        if (cs.overflow === 'auto' || cs.overflow === 'hidden' || cs.overflowY === 'auto' || cs.overflowY === 'hidden') {
                          e.style.overflow = 'visible'; e.style.height = 'auto'; e.style.maxHeight = 'none';
                        }
                      });
                      wrapper.appendChild(contentClone);
                      document.body.appendChild(wrapper);
                      const styleId = 'personality-print-style';
                      let style = document.getElementById(styleId) as HTMLStyleElement | null;
                      if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
                      style.innerHTML = `@media print { @page { margin: 10mm; size: A4 portrait; } body > *:not(#personality-print-clone) { display: none !important; } #personality-print-clone { display: block !important; position: static !important; left: 0 !important; width: 100% !important; overflow: visible !important; height: auto !important; max-height: none !important; background: #F8F7F4 !important; } #personality-print-clone * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; overflow: visible !important; height: auto !important; max-height: none !important; } #personality-traits-section { page-break-after: always; break-after: page; } }`;
                      window.print();
                      setTimeout(() => { wrapper.remove(); if (style) style.innerHTML = ''; }, 2000);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all"
                    title="Print Report"
                  >
                    <FontAwesomeIcon icon={faPrint} className="text-white/80 text-sm" />
                  </button>
                  <button onClick={() => setShowPersonalityHelp(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all" title="How is this calculated?">
                    <FontAwesomeIcon icon={faQuestionCircle} className="text-white/80 text-sm" />
                  </button>
                  <button onClick={() => { setPersonalityStudent(null); setShowPersonalityHelp(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                    <FontAwesomeIcon icon={faTimes} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div id="personality-print-area" ref={personalityReportRef} className="flex-1 overflow-y-auto bg-[#F8F7F4]">
                {traits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <FontAwesomeIcon icon={faChartBar} className="text-4xl mb-3 opacity-30" />
                    <p className="text-sm">Personality profile not yet evaluated</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">

                    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap gap-4">
                      {[
                        { label: 'Student', value: student?.studentName || attempt?.studentName || '—' },
                        { label: 'Roll No', value: student?.rollNumber || attempt?.rollNumber || '—' },
                        { label: 'Class', value: attempt?.class || '—' },
                        { label: 'Assessment', value: exam?.title || '—' },
                        { label: 'Date', value: (() => {
                          const raw = attempt?.submitTime || attempt?.startTime || attempt?.likertCompletedAt;
                          if (!raw) return '—';
                          try {
                            const d = raw?.toDate ? raw.toDate() : new Date(raw);
                            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                          } catch { return '—'; }
                        })() },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                          <span className="text-sm font-semibold text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-gray-800 mb-0.5">Response Style</div>
                        <div className="text-xs text-gray-500">{rsConfig.desc}</div>
                      </div>
                      <span className="ml-4 flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: rsConfig.bg, color: rsConfig.color }}>
                        {responseStyle}
                      </span>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-indigo-600 mb-0.5">Personality Type</div>
                        <div className="text-lg font-bold text-gray-900">{pType.title}</div>
                        <div className="text-xs text-gray-500 leading-relaxed mt-1">{pType.desc}</div>
                      </div>
                    </div>

                    <div id="personality-traits-section" className="bg-white rounded-2xl p-5 border border-gray-100">
                      <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">All {traits.length} Traits</div>
                      <div className="space-y-3">
                        {traits.map(([trait, data]: any) => {
                          const color = getColor(trait);
                          const lvl = getLevelStyle(data.level);
                          return (
                            <div key={trait}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                  {trait}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: lvl.bg, color: lvl.color }}>{data.level}</span>
                                  <span className="text-sm font-bold" style={{ color }}>{data.percentage}%</span>
                                </div>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${data.percentage}%`, background: color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {(() => {
                      const BIG5 = ['Openness','Conscientiousness','Extraversion','Agreeableness','Emotional Stability'];
                      const big5Traits = BIG5.map(t => ({ name: t, pct: profile[t]?.percentage || 0, color: getColor(t) }));
                      const cx = 150, cy = 150, r = 110;
                      const angles = big5Traits.map((_, i) => (Math.PI * 2 * i) / 5 - Math.PI / 2);
                      const pt = (pct: number, i: number) => {
                        const d = (pct / 100) * r;
                        return { x: cx + d * Math.cos(angles[i]), y: cy + d * Math.sin(angles[i]) };
                      };
                      const dataPoints = big5Traits.map((t, i) => pt(t.pct, i));
                      const polyPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
                      const rings = [20, 40, 60, 80, 100];
                      const labelOffset = (i: number) => {
                        const a = angles[i];
                        return { x: cx + (r + 28) * Math.cos(a), y: cy + (r + 28) * Math.sin(a) };
                      };
                      return (
                        <div className="bg-white rounded-2xl p-5 border border-gray-100">
                          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Trait Overview · Big 5</div>
                          <div className="flex justify-center">
                            <svg width="300" height="300" viewBox="0 0 300 300">
                              {rings.map(pct => {
                                const rpts = angles.map((_, i) => { const p = pt(pct, i); return `${p.x},${p.y}`; }).join(' ');
                                return <polygon key={pct} points={rpts} fill="none" stroke="#E5E7EB" strokeWidth="0.8" opacity="0.7" />;
                              })}
                              {angles.map((_, i) => {
                                const end = pt(100, i);
                                return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#E5E7EB" strokeWidth="0.8" />;
                              })}
                              <polygon points={polyPoints} fill="rgba(79,70,229,0.15)" stroke="#4F46E5" strokeWidth="2.5" strokeLinejoin="round" />
                              {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="5" fill="#4F46E5" />)}
                              {big5Traits.map((t, i) => {
                                const lp = labelOffset(i);
                                return (
                                  <g key={t.name}>
                                    <text x={lp.x} y={lp.y - 5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1A1A2E">{t.name}</text>
                                    <text x={lp.x} y={lp.y + 8} textAnchor="middle" fontSize="10" fontWeight="700" fill={t.color}>{t.pct}%</text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        </div>
                      );
                    })()}

                    {top3.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {top3.map(([trait, d]: any, _i: number) => (
                          <div key={trait} className="bg-white rounded-2xl p-4 border border-gray-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: getColor(trait) }} />
                            <div className="text-2xl font-bold mt-1" style={{ color: getColor(trait) }}>{d.percentage}%</div>
                            <div className="text-[11px] font-semibold text-gray-500 mt-0.5">{trait}</div>
                            <div className="text-[10px] text-gray-400 mt-1 leading-tight">{TRAIT_DESCRIPTIONS[trait]?.split('.')[0] || ''}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-2xl p-4 border-l-4 border border-emerald-400">
                        <div className="flex items-center gap-2 font-bold text-gray-800 mb-3 text-sm"><span>⭐</span> Key Strengths</div>
                        {top3.map(([trait, _d]: any) => (
                          <div key={trait} className="flex gap-2 mb-2 text-xs text-gray-600 leading-relaxed">
                            <span className="flex-shrink-0">🔹</span>
                            <span><strong>{trait}</strong> — {TRAIT_DESCRIPTIONS[trait] || ''}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-white rounded-2xl p-4 border-l-4 border border-amber-400">
                        <div className="flex items-center gap-2 font-bold text-gray-800 mb-3 text-sm"><span>📈</span> Areas for Growth</div>
                        {bottom3.map(([trait, d]: any) => (
                          <div key={trait} className="flex gap-2 mb-2 text-xs text-gray-600 leading-relaxed">
                            <span className="flex-shrink-0">🔸</span>
                            <span><strong>{trait}</strong> at {d.percentage}% — consider focused development in this area</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const CAREER_MAP: Record<string, { label: string; bg: string; color: string }[]> = {
                        'Problem Solving':    [{ label:'Software Architect', bg:'#EEF2FF', color:'#4338CA' }, { label:'Data Scientist', bg:'#F0FDFA', color:'#0F766E' }, { label:'Systems Analyst', bg:'#FEF9C3', color:'#A16207' }],
                        'Openness':           [{ label:'R&D Engineer', bg:'#F5F3FF', color:'#7C3AED' }, { label:'UX Designer', bg:'#FDF2F8', color:'#DB2777' }, { label:'Product Strategist', bg:'#ECFDF5', color:'#059669' }],
                        'Leadership':         [{ label:'Technical Lead', bg:'#FFF7ED', color:'#EA580C' }, { label:'Product Manager', bg:'#ECFDF5', color:'#059669' }, { label:'Project Director', bg:'#EEF2FF', color:'#4338CA' }],
                        'Conscientiousness':  [{ label:'Quality Assurance', bg:'#F0FDFA', color:'#0F766E' }, { label:'DevOps Engineer', bg:'#EEF2FF', color:'#4338CA' }, { label:'Compliance Analyst', bg:'#FEF9C3', color:'#A16207' }],
                        'Extraversion':       [{ label:'Sales Engineer', bg:'#FFF7ED', color:'#EA580C' }, { label:'Developer Advocate', bg:'#F5F3FF', color:'#7C3AED' }, { label:'Team Lead', bg:'#ECFDF5', color:'#059669' }],
                        'Communication':      [{ label:'Technical Writer', bg:'#FDF2F8', color:'#DB2777' }, { label:'Scrum Master', bg:'#F0FDFA', color:'#0F766E' }, { label:'Business Analyst', bg:'#FEF9C3', color:'#A16207' }],
                        'Agreeableness':      [{ label:'HR Specialist', bg:'#ECFDF5', color:'#059669' }, { label:'UX Researcher', bg:'#F5F3FF', color:'#7C3AED' }, { label:'Support Engineer', bg:'#EEF2FF', color:'#4338CA' }],
                        'Emotional Stability':[{ label:'Crisis Manager', bg:'#FFF7ED', color:'#EA580C' }, { label:'SRE Engineer', bg:'#F0FDFA', color:'#0F766E' }, { label:'Security Analyst', bg:'#EEF2FF', color:'#4338CA' }],
                      };
                      const seen = new Set<string>();
                      const careers: { label: string; bg: string; color: string }[] = [];
                      for (const [trait] of traits) {
                        for (const c of (CAREER_MAP[trait] || [])) {
                          if (!seen.has(c.label)) { seen.add(c.label); careers.push(c); }
                          if (careers.length >= 6) break;
                        }
                        if (careers.length >= 6) break;
                      }
                      return (
                        <div className="bg-white rounded-2xl p-5 border border-gray-100">
                          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Suggested Career Paths</div>
                          <div className="flex flex-wrap gap-2">
                            {careers.map(c => (
                              <span key={c.label} className="px-4 py-2 rounded-full text-xs font-bold" style={{ background: c.bg, color: c.color }}>{c.label}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="text-center text-xs text-gray-400 pb-2">
                      <div className="font-bold text-indigo-600 mb-1">EXAMINERS</div>
                      <div>Auto-generated from self-reported responses. Results are indicative, not definitive.</div>
                    </div>

                  </div>
                )}
              </div>

              {showPersonalityHelp && (
                <div className="absolute inset-0 z-20 flex flex-col bg-white rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2D1B69 50%, #4F46E5 100%)' }}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <FontAwesomeIcon icon={faQuestionCircle} className="text-white text-sm" />
                      </div>
                      <h2 className="text-base font-bold text-white">How is this calculated?</h2>
                    </div>
                    <button onClick={() => setShowPersonalityHelp(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                      <FontAwesomeIcon icon={faTimes} className="text-white" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-[#F8F7F4] p-5 space-y-4">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">1</div>
                        <h4 className="font-bold text-gray-800">The 8 Personality Traits</h4>
                      </div>
                      <div className="space-y-2">
                        {([
                          ['Openness','#3B82F6','Curiosity, creativity, and willingness to explore new experiences and ideas'],
                          ['Conscientiousness','#10B981','Organization, discipline, and reliability in completing tasks and commitments'],
                          ['Extraversion','#F59E0B','Social energy, assertiveness, and preference for group interactions'],
                          ['Agreeableness','#EF4444','Cooperation, empathy, and tendency to prioritize harmony with others'],
                          ['Emotional Stability','#8B5CF6','Calm and composure under pressure, resilience to stress and setbacks'],
                          ['Leadership','#F97316','Initiative, decision-making, and ability to guide and inspire others'],
                          ['Problem Solving','#06B6D4','Analytical thinking, logical reasoning, and systematic approach to challenges'],
                          ['Communication','#EC4899','Clarity of expression, active listening, and adaptability in conveying ideas'],
                        ] as [string,string,string][]).map(([trait,color,desc]) => (
                          <div key={trait} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                            <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: color }} />
                            <div>
                              <div className="text-xs font-bold text-gray-800">{trait}</div>
                              <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
                      <strong>📌 Note:</strong> This assessment is based on self-reported responses. Results reflect answers at the time and should be treated as indicative tendencies, not definitive personality classifications.
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}
      </div>
    );
  }

  // ── Regular exam flow (has questions) ──
  const calculateStudentTotals = (student: any) => {
    if (!student.attemptData) {
      return { totalObtained: 0, totalMax: 0, totalViolations: 0, totalTime: 0, attemptedQuestions: 0, totalQuestions: 0 };
    }

    // ✅ Calculate violations — use pre-computed violationCount (Cloud Function strips arrays)
    let totalViolations = 0;
    if (typeof student.attemptData.violationCount === 'number') {
      totalViolations = student.attemptData.violationCount;
    } else if (student.attemptData.violationSummary?.total) {
      totalViolations = student.attemptData.violationSummary.total;
    } else if (student.attemptData.violations && Array.isArray(student.attemptData.violations)) {
      totalViolations = student.attemptData.violations.length;
    } else if (student.attemptData.responses && Array.isArray(student.attemptData.responses)) {
      totalViolations = student.attemptData.responses.reduce((sum: number, r: any) => 
        sum + (Array.isArray(r.violations) ? r.violations.length : 0), 0);
    }

    // ✅ Calculate time — use pre-computed timeSpent, cap at exam duration
    let totalTime = 0;
    
    // Priority 1: Pre-computed timeSpent (Cloud Function computes startTime→submitTime)
    if (student.attemptData.timeSpent && student.attemptData.timeSpent > 0) {
      totalTime = student.attemptData.timeSpent;
    }
    
    // Priority 2: Sum per-question timeSpent (if full responses available)
    if (totalTime === 0 && student.attemptData.responses && Array.isArray(student.attemptData.responses)) {
      totalTime = student.attemptData.responses.reduce((sum: number, r: any) => {
        return sum + (Number(r.timeSpent) || 0);
      }, 0);
    }
    
    // Priority 3: Compute from startTime → submitTime directly
    if (totalTime === 0) {
      const { startTime, submitTime } = student.attemptData;
      if (startTime && submitTime) {
        const start = startTime?.toDate ? startTime.toDate().getTime() : new Date(startTime).getTime();
        const end = submitTime?.toDate ? submitTime.toDate().getTime() : new Date(submitTime).getTime();
        if (end > start) totalTime = Math.floor((end - start) / 1000);
      }
    }
    
    // ✅ Cap at exam's total duration (in minutes → seconds)
    const examDurationSeconds = (parseInt(exam?.duration) || 0) * 60;
    if (examDurationSeconds > 0 && totalTime > examDurationSeconds) {
      totalTime = examDurationSeconds;
    }
    
    // ✅ Calculate marks totals
    let totalObtained = Number(student.attemptData.obtainedMarks || student.attemptData.totalScore || 0);
    
    // If obtainedMarks is 0 but responses available, sum from responses
    if (totalObtained === 0 && student.attemptData.responses && Array.isArray(student.attemptData.responses)) {
      student.attemptData.responses.forEach((r: any) => {
        if (r.questionType === 'likert') return;
        totalObtained += Number(r.marksAwarded || r.scoredMarks || 0);
      });
    }
    
    // ✅ Max marks: ALWAYS from exam config (source of truth, includes pool)
    // Never trust attempt's maximumScore — it may be stale/wrong
    let totalMax = getTotalMarks(exam);
    if (totalMax === 0) {
      // Fallback to attempt's stored value only if exam config gives 0
      totalMax = Number(student.attemptData.maximumScore || 0);
    }

    // ✅ Total questions count — from exam config
    const questionsListCount = exam?.questionsList?.length || 0;
    const poolCount = Number(exam?.pickRandomCount) || 0;
    let totalQuestions = questionsListCount + poolCount;
    if (totalQuestions === 0) {
      // Fallback
      totalQuestions = student.attemptData.totalQuestions || (student.attemptData.responses?.length || questions.length);
    }

    // Count attempted non-likert questions (non-empty answers)
    let attemptedQuestions = 0;
    if (student.attemptData.responses && Array.isArray(student.attemptData.responses)) {
      const PLACEHOLDER = '-- Write your SQL query here';
      attemptedQuestions = student.attemptData.responses.filter((r: any) => {
        if (r.questionType === 'likert') return false;
        const ans = r.studentAnswer;
        if (ans === undefined || ans === null || ans === '') return false;
        if (typeof ans === 'string' && ans.trim().startsWith(PLACEHOLDER.trim().substring(0, 10))) return false;
        if (Array.isArray(ans)) return ans.length > 0;
        return true;
      }).length;
    } else {
      attemptedQuestions = student.attemptData.attemptedQuestions || 0;
    }

    return { totalObtained, totalMax, totalViolations, totalTime, attemptedQuestions, totalQuestions };
  };

  return (
    <div className="bg-white h-full">
      {/* Exam Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mx-6 mt-4 mb-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{exam.name || exam.title}</h4>
        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
          {(exam.examDate || exam.startDate) && (
            <span>Date: {formatAnyDate(exam.examDate || exam.startDate) || 'N/A'}</span>
          )}
          {(exam.examTime || exam.startTime) && (
            <span>Time: {exam.examTime || exam.startTime}</span>
          )}
          {exam.duration && (
            <span>Duration: {(parseInt(exam.duration) || 0) + (parseInt(exam.likertDuration) || 0)} min
              {(parseInt(exam.likertDuration) || 0) > 0 && (
                <span className="text-xs text-gray-400 ml-1">({exam.duration}m + {exam.likertDuration}m personality)</span>
              )}
            </span>
          )}
          {exam.personalityAssessment && exam.likertQuestions?.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
              <FontAwesomeIcon icon={faChartBar} className="text-xs" />
              Personality Assessment
            </span>
          )}
        </div>
      </div>

      {/* Student Cards */}
      <div className="px-6 space-y-4">
      {(() => {
        const submittedStudents = presentStudents.filter((s: any) => s.hasAttempt && s.attemptData);
        const totalPages = Math.ceil(submittedStudents.length / STUDENTS_PER_PAGE);
        const paginatedStudents = submittedStudents.slice((currentPage - 1) * STUDENTS_PER_PAGE, currentPage * STUDENTS_PER_PAGE);

        return submittedStudents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No student submissions yet</p>
          </div>
        ) : (
          <>
          {paginatedStudents.map((student: any) => {
          const isExpanded = expandedStudents.has(student.studentId);
          const totals = calculateStudentTotals(student);

          return (
            <div key={student.studentId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Student Header - Always Visible */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleStudent(student.studentId)}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <FontAwesomeIcon 
                        icon={isExpanded ? faChevronUp : faChevronDown} 
                        className="text-gray-600"
                      />
                    </button>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900">{student.studentName}</h5>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-sm text-gray-600">Roll: {student.rollNumber}</p>
                        {student.attemptData?.personalityProfile && (
                          <button
                            onClick={() => setPersonalityStudent({ student, attempt: student.attemptData })}
                            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <FontAwesomeIcon icon={faChartBar} className="text-xs" />
                            <span>Personality Profile</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: brandTheme.colors.primary }}>
                      {totals.totalMax > 0 
                        ? ((totals.totalObtained / totals.totalMax) * 100).toFixed(2) 
                        : '0.00'}%
                    </p>
                    <p className="text-sm text-gray-600">
                      {totals.totalObtained}/{totals.totalMax} marks
                    </p>
                  </div>
                </div>

                {/* Summary Row - Always Visible */}
                <div className="grid grid-cols-6 gap-4 text-sm bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">Questions</p>
                    <p className="font-semibold text-gray-900">{totals.attemptedQuestions}/{totals.totalQuestions}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">Obtained</p>
                    <p className="font-semibold" style={{ color: brandTheme.colors.primary }}>{totals.totalObtained}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">Max Marks</p>
                    <p className="font-semibold text-gray-900">{totals.totalMax}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">Violations</p>
                    <p className={`font-semibold ${totals.totalViolations > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {totals.totalViolations}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">Time</p>
                    <p className="font-semibold text-gray-900">{formatTime(totals.totalTime)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">Enter/Exit</p>
                    <p className="font-semibold">
                      <span className="text-green-600">{student.attemptData?.enterCount || 0}</span>
                      {' / '}
                      <span className="text-red-600">{student.attemptData?.exitCount || 0}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Expanded Details - Only When Expanded */}
              {isExpanded && (
                <>
                  {/* Session Info */}
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                    <div className="grid grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Enter IP</p>
                        <p className="font-medium text-gray-900">{student.attemptData?.enterIPAddress || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Exit IP</p>
                        <p className="font-medium text-gray-900">{student.attemptData?.exitIPAddress || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Browser</p>
                        <p className="font-medium text-gray-900">{student.attemptData?.browser || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">OS</p>
                        <p className="font-medium text-gray-900">{student.attemptData?.operatingSystem || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Tab Switches</p>
                        <p className="font-medium text-red-600">{student.attemptData?.tabSwitchCount || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Questions Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Q#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Difficulty</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Max Marks</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Obtained</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Violations</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Time (sec)</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Revisits</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Attempts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // ✅ Build combined question list: questionsList + pool questions from responses
                          const allQuestions: any[] = [];
                          
                          // First add questionsList questions
                          if (questions && questions.length > 0) {
                            questions.forEach((q: any) => {
                              allQuestions.push({
                                id: q.id || q.questionId,
                                type: q.type,
                                difficulty: q.difficulty,
                                maxMarks: q.maximumMarks || q.marks || 0,
                                isPool: false,
                              });
                            });
                          }
                          
                          // Then add pool questions from responses (not in questionsList)
                          const questionsListIds = new Set(questions.map((q: any) => q.id || q.questionId));
                          if (student.attemptData?.responses && Array.isArray(student.attemptData.responses)) {
                            student.attemptData.responses.forEach((r: any) => {
                              if (r.questionType === 'likert') return;
                              if (!questionsListIds.has(r.questionId)) {
                                allQuestions.push({
                                  id: r.questionId,
                                  type: r.questionType || 'code',
                                  difficulty: r.complexity || r.difficulty || 'Medium',
                                  maxMarks: r.maxMarks || 0,
                                  isPool: true,
                                });
                              }
                            });
                          }
                          
                          return allQuestions.map((question: any, qIndex: number) => {
                          const questionId = question.id;
                          const questionAnswer = student.attemptData?.responses?.find((r: any) => r.questionId === questionId);
                          
                          const maxMarks = questionAnswer?.maxMarks || question.maxMarks || 0;
                          const obtainedMarks = getQuestionObtainedMarks(questionAnswer);
                          const timeSpent = questionAnswer?.timeSpent || 0;
                          const revisitCount = questionAnswer?.revisitCount || 0;
                          const attemptCount = questionAnswer?.attemptCount || 0;
                          const violations = questionAnswer?.violations || [];
                          
                          const typeLabels: any = {
                            mcq: 'MCQ',
                            fillInTheBlank: 'Fill Blank',
                            jumbledQuiz: 'Jumbled',
                            descriptive: 'Descriptive',
                            code: 'Code',
                            sql: 'SQL'
                          };
                          
                          const difficultyColors: any = {
                            Easy: 'text-green-600',
                            easy: 'text-green-600',
                            Medium: 'text-yellow-600',
                            medium: 'text-yellow-600',
                            Hard: 'text-red-600',
                            hard: 'text-red-600'
                          };

                          const diffLabel = question.difficulty || questionAnswer?.complexity || 'Medium';
                          const typeKey = questionAnswer?.questionType || question.type;

                          return (
                            <tr key={questionId} className={qIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                Q{qIndex + 1}
                                {question.isPool && <span className="ml-1 text-xs text-purple-500" title="Pool Question">★</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{typeLabels[typeKey] || typeKey}</td>
                              <td className={`px-4 py-3 text-sm font-medium ${difficultyColors[diffLabel] || 'text-yellow-600'}`}>
                                {diffLabel.charAt(0).toUpperCase() + diffLabel.slice(1).toLowerCase()}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{maxMarks}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`font-semibold ${obtainedMarks >= maxMarks * 0.7 ? 'text-green-600' : obtainedMarks >= maxMarks * 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {obtainedMarks}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`font-semibold ${violations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {violations.length}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{Math.round(timeSpent)}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{revisitCount}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">{attemptCount}</td>
                            </tr>
                          );
                        });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          );
        })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-4">
              <p className="text-xs text-gray-500">
                Showing {(currentPage - 1) * STUDENTS_PER_PAGE + 1}-{Math.min(currentPage * STUDENTS_PER_PAGE, submittedStudents.length)} of {submittedStudents.length} students
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1" /> Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium ${
                        currentPage === pageNum
                          ? 'text-white'
                          : 'text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                      style={currentPage === pageNum ? { backgroundColor: brandTheme.colors.primary } : {}}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
                </button>
              </div>
            </div>
          )}
          </>
        );
      })()}
      </div>

      {/* Personality Profile Modal */}
      {(() => {
        const attempt = personalityStudent?.attempt;
        const student = personalityStudent?.student;
        const isOpen = !!personalityStudent;
        if (!attempt) return null;

        const profile: Record<string, { score: number; maxScore: number; average: number; percentage: number; level: string }> = attempt?.personalityProfile || {};
        const traits = Object.entries(profile).sort((a: any, b: any) => b[1].percentage - a[1].percentage);

        const TRAIT_COLORS: Record<string, string> = {
          'Openness': '#3B82F6', 'Conscientiousness': '#10B981', 'Extraversion': '#F59E0B',
          'Agreeableness': '#EF4444', 'Emotional Stability': '#8B5CF6', 'Leadership': '#F97316',
          'Problem Solving': '#06B6D4', 'Communication': '#EC4899',
        };
        const getColor = (trait: string) => TRAIT_COLORS[trait] || '#6366F1';

        const TRAIT_DESCRIPTIONS: Record<string, string> = {
          'Openness': "Curious and receptive to new ideas, enjoys exploring unconventional approaches",
          'Conscientiousness': 'Organized, goal-oriented, and reliable in following through on commitments',
          'Extraversion': 'Energized by social interactions, expressive and outgoing in group settings',
          'Agreeableness': "Cooperative and empathetic, values harmony and others' feelings",
          'Emotional Stability': 'Maintains composure under pressure, resilient to stress and setbacks',
          'Leadership': 'Naturally takes charge, inspires teams, and accepts responsibility for outcomes',
          'Problem Solving': 'Excels at breaking down complex challenges and finding logical solutions',
          'Communication': 'Effectively expresses ideas clearly and adapts style for different audiences',
        };

        const getLevelStyle = (level: string) => {
          if (level === 'Very High' || level === 'High') return { bg: '#DCFCE7', color: '#166534' };
          if (level === 'Moderate') return { bg: '#FEF9C3', color: '#854D0E' };
          return { bg: '#FEE2E2', color: '#991B1B' };
        };

        const savedType = attempt?.personalityType || {};
        const pType = {
          title: savedType.title || 'The Well-Rounded Individual',
          desc: savedType.desc || 'You demonstrate a balanced personality profile with strengths across multiple dimensions.',
          careers: (savedType.careers || []) as string[],
        };
        const responseStyle: string = attempt?.responseStyle || 'Genuine';
        const responseStyleConfig: Record<string, { bg: string; color: string; desc: string }> = {
          'Genuine':             { bg: '#DCFCE7', color: '#166534', desc: 'Responses were varied and consistent, indicating honest and thoughtful self-evaluation.' },
          'Central Tendency':    { bg: '#FEF9C3', color: '#854D0E', desc: 'Student avoided taking strong positions. Results may not fully reflect true personality.' },
          'Acquiescence':        { bg: '#FEE2E2', color: '#991B1B', desc: 'Student agreed with most statements. Results may be unreliable.' },
          'Extreme Responding':  { bg: '#FEE2E2', color: '#991B1B', desc: 'Student only picked extremes. Results are questionable.' },
          'Careless Responding': { bg: '#FEE2E2', color: '#991B1B', desc: 'Student did not engage meaningfully. Recommend re-test.' },
        };
        const rsConfig = responseStyleConfig[responseStyle] || responseStyleConfig['Genuine'];
        const top3 = traits.slice(0, 3);
        const bottom3 = traits.slice(-3).reverse();

        return (
          <div className={`fixed inset-0 z-[9999] flex items-start justify-end p-2 transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0" onClick={() => { setPersonalityStudent(null); setShowPersonalityHelp(false); }} />
            <div className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[42rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
              isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
            }`} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
                style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2D1B69 50%, #4F46E5 100%)' }}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <FontAwesomeIcon icon={faChartBar} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Personality Profile</h2>
                    <p className="text-xs text-white/70">OCEAN + Custom Traits · Big 8 Framework</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const content = personalityReportRef.current;
                      if (!content) return;
                      const prev = document.getElementById('personality-print-clone');
                      if (prev) prev.remove();
                      const wrapper = document.createElement('div');
                      wrapper.id = 'personality-print-clone';
                      wrapper.style.cssText = 'position:absolute; left:-9999px; top:0; width:100%; background:#F8F7F4;';
                      const modalInner = content.parentElement;
                      if (modalInner) {
                        const headerEl = modalInner.querySelector('.rounded-t-2xl') as HTMLElement | null;
                        if (headerEl) {
                          const headerClone = headerEl.cloneNode(true) as HTMLElement;
                          headerClone.style.cssText = 'background:linear-gradient(135deg,#1A1A2E 0%,#2D1B69 50%,#4F46E5 100%);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;';
                          headerClone.querySelectorAll('button').forEach((b: HTMLElement) => b.style.display = 'none');
                          wrapper.appendChild(headerClone);
                        }
                      }
                      const contentClone = content.cloneNode(true) as HTMLElement;
                      contentClone.style.cssText = 'overflow:visible;height:auto;max-height:none;background:#F8F7F4;padding:20px;';
                      contentClone.querySelectorAll('*').forEach((el: Element) => {
                        const e = el as HTMLElement;
                        const cs = window.getComputedStyle(e);
                        if (cs.overflow === 'auto' || cs.overflow === 'hidden' || cs.overflowY === 'auto' || cs.overflowY === 'hidden') {
                          e.style.overflow = 'visible'; e.style.height = 'auto'; e.style.maxHeight = 'none';
                        }
                      });
                      wrapper.appendChild(contentClone);
                      document.body.appendChild(wrapper);
                      const styleId = 'personality-print-style';
                      let style = document.getElementById(styleId) as HTMLStyleElement | null;
                      if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
                      style.innerHTML = `@media print { @page { margin: 10mm; size: A4 portrait; } body > *:not(#personality-print-clone) { display: none !important; } #personality-print-clone { display: block !important; position: static !important; left: 0 !important; width: 100% !important; overflow: visible !important; height: auto !important; max-height: none !important; background: #F8F7F4 !important; } #personality-print-clone * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; overflow: visible !important; height: auto !important; max-height: none !important; } #personality-traits-section { page-break-after: always; break-after: page; } }`;
                      window.print();
                      setTimeout(() => { wrapper.remove(); if (style) style.innerHTML = ''; }, 2000);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all"
                    title="Print Report"
                  >
                    <FontAwesomeIcon icon={faPrint} className="text-white/80 text-sm" />
                  </button>
                  <button onClick={() => setShowPersonalityHelp(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all" title="How is this calculated?">
                    <FontAwesomeIcon icon={faQuestionCircle} className="text-white/80 text-sm" />
                  </button>
                  <button onClick={() => { setPersonalityStudent(null); setShowPersonalityHelp(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                    <FontAwesomeIcon icon={faTimes} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div id="personality-print-area" ref={personalityReportRef} className="flex-1 overflow-y-auto bg-[#F8F7F4]">
                {traits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <FontAwesomeIcon icon={faChartBar} className="text-4xl mb-3 opacity-30" />
                    <p className="text-sm">Personality profile not yet evaluated</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">

                    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap gap-4">
                      {[
                        { label: 'Student', value: student?.studentName || attempt?.studentName || '—' },
                        { label: 'Roll No', value: student?.rollNumber || attempt?.rollNumber || '—' },
                        { label: 'Class', value: attempt?.class || '—' },
                        { label: 'Assessment', value: exam?.title || '—' },
                        { label: 'Date', value: (() => {
                          const raw = attempt?.submitTime || attempt?.startTime || attempt?.likertCompletedAt;
                          if (!raw) return '—';
                          try {
                            const d = raw?.toDate ? raw.toDate() : new Date(raw);
                            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                          } catch { return '—'; }
                        })() },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                          <span className="text-sm font-semibold text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-gray-800 mb-0.5">Response Style</div>
                        <div className="text-xs text-gray-500">{rsConfig.desc}</div>
                      </div>
                      <span className="ml-4 flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: rsConfig.bg, color: rsConfig.color }}>
                        {responseStyle}
                      </span>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-indigo-600 mb-0.5">Personality Type</div>
                        <div className="text-lg font-bold text-gray-900">{pType.title}</div>
                        <div className="text-xs text-gray-500 leading-relaxed mt-1">{pType.desc}</div>
                      </div>
                    </div>

                    <div id="personality-traits-section" className="bg-white rounded-2xl p-5 border border-gray-100">
                      <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">All {traits.length} Traits</div>
                      <div className="space-y-3">
                        {traits.map(([trait, data]: any) => {
                          const color = getColor(trait);
                          const lvl = getLevelStyle(data.level);
                          return (
                            <div key={trait}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                  {trait}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: lvl.bg, color: lvl.color }}>{data.level}</span>
                                  <span className="text-sm font-bold" style={{ color }}>{data.percentage}%</span>
                                </div>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${data.percentage}%`, background: color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {(() => {
                      const BIG5 = ['Openness','Conscientiousness','Extraversion','Agreeableness','Emotional Stability'];
                      const big5Traits = BIG5.map(t => ({ name: t, pct: profile[t]?.percentage || 0, color: getColor(t) }));
                      const cx = 150, cy = 150, r = 110;
                      const angles = big5Traits.map((_, i) => (Math.PI * 2 * i) / 5 - Math.PI / 2);
                      const pt = (pct: number, i: number) => {
                        const d = (pct / 100) * r;
                        return { x: cx + d * Math.cos(angles[i]), y: cy + d * Math.sin(angles[i]) };
                      };
                      const dataPoints = big5Traits.map((t, i) => pt(t.pct, i));
                      const polyPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
                      const rings = [20, 40, 60, 80, 100];
                      const labelOffset = (i: number) => {
                        const a = angles[i];
                        return { x: cx + (r + 28) * Math.cos(a), y: cy + (r + 28) * Math.sin(a) };
                      };
                      return (
                        <div className="bg-white rounded-2xl p-5 border border-gray-100">
                          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Trait Overview · Big 5</div>
                          <div className="flex justify-center">
                            <svg width="300" height="300" viewBox="0 0 300 300">
                              {rings.map(pct => {
                                const rpts = angles.map((_, i) => { const p = pt(pct, i); return `${p.x},${p.y}`; }).join(' ');
                                return <polygon key={pct} points={rpts} fill="none" stroke="#E5E7EB" strokeWidth="0.8" opacity="0.7" />;
                              })}
                              {angles.map((_, i) => {
                                const end = pt(100, i);
                                return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#E5E7EB" strokeWidth="0.8" />;
                              })}
                              <polygon points={polyPoints} fill="rgba(79,70,229,0.15)" stroke="#4F46E5" strokeWidth="2.5" strokeLinejoin="round" />
                              {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="5" fill="#4F46E5" />)}
                              {big5Traits.map((t, i) => {
                                const lp = labelOffset(i);
                                return (
                                  <g key={t.name}>
                                    <text x={lp.x} y={lp.y - 5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1A1A2E">{t.name}</text>
                                    <text x={lp.x} y={lp.y + 8} textAnchor="middle" fontSize="10" fontWeight="700" fill={t.color}>{t.pct}%</text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        </div>
                      );
                    })()}

                    {top3.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {top3.map(([trait, d]: any, _i: number) => (
                          <div key={trait} className="bg-white rounded-2xl p-4 border border-gray-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: getColor(trait) }} />
                            <div className="text-2xl font-bold mt-1" style={{ color: getColor(trait) }}>{d.percentage}%</div>
                            <div className="text-[11px] font-semibold text-gray-500 mt-0.5">{trait}</div>
                            <div className="text-[10px] text-gray-400 mt-1 leading-tight">{TRAIT_DESCRIPTIONS[trait]?.split('.')[0] || ''}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-2xl p-4 border-l-4 border border-emerald-400">
                        <div className="flex items-center gap-2 font-bold text-gray-800 mb-3 text-sm"><span>⭐</span> Key Strengths</div>
                        {top3.map(([trait, _d]: any) => (
                          <div key={trait} className="flex gap-2 mb-2 text-xs text-gray-600 leading-relaxed">
                            <span className="flex-shrink-0">🔹</span>
                            <span><strong>{trait}</strong> — {TRAIT_DESCRIPTIONS[trait] || ''}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-white rounded-2xl p-4 border-l-4 border border-amber-400">
                        <div className="flex items-center gap-2 font-bold text-gray-800 mb-3 text-sm"><span>📈</span> Areas for Growth</div>
                        {bottom3.map(([trait, d]: any) => (
                          <div key={trait} className="flex gap-2 mb-2 text-xs text-gray-600 leading-relaxed">
                            <span className="flex-shrink-0">🔸</span>
                            <span><strong>{trait}</strong> at {d.percentage}% — consider focused development in this area</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const CAREER_MAP: Record<string, { label: string; bg: string; color: string }[]> = {
                        'Problem Solving':    [{ label:'Software Architect', bg:'#EEF2FF', color:'#4338CA' }, { label:'Data Scientist', bg:'#F0FDFA', color:'#0F766E' }, { label:'Systems Analyst', bg:'#FEF9C3', color:'#A16207' }],
                        'Openness':           [{ label:'R&D Engineer', bg:'#F5F3FF', color:'#7C3AED' }, { label:'UX Designer', bg:'#FDF2F8', color:'#DB2777' }, { label:'Product Strategist', bg:'#ECFDF5', color:'#059669' }],
                        'Leadership':         [{ label:'Technical Lead', bg:'#FFF7ED', color:'#EA580C' }, { label:'Product Manager', bg:'#ECFDF5', color:'#059669' }, { label:'Project Director', bg:'#EEF2FF', color:'#4338CA' }],
                        'Conscientiousness':  [{ label:'Quality Assurance', bg:'#F0FDFA', color:'#0F766E' }, { label:'DevOps Engineer', bg:'#EEF2FF', color:'#4338CA' }, { label:'Compliance Analyst', bg:'#FEF9C3', color:'#A16207' }],
                        'Extraversion':       [{ label:'Sales Engineer', bg:'#FFF7ED', color:'#EA580C' }, { label:'Developer Advocate', bg:'#F5F3FF', color:'#7C3AED' }, { label:'Team Lead', bg:'#ECFDF5', color:'#059669' }],
                        'Communication':      [{ label:'Technical Writer', bg:'#FDF2F8', color:'#DB2777' }, { label:'Scrum Master', bg:'#F0FDFA', color:'#0F766E' }, { label:'Business Analyst', bg:'#FEF9C3', color:'#A16207' }],
                        'Agreeableness':      [{ label:'HR Specialist', bg:'#ECFDF5', color:'#059669' }, { label:'UX Researcher', bg:'#F5F3FF', color:'#7C3AED' }, { label:'Support Engineer', bg:'#EEF2FF', color:'#4338CA' }],
                        'Emotional Stability':[{ label:'Crisis Manager', bg:'#FFF7ED', color:'#EA580C' }, { label:'SRE Engineer', bg:'#F0FDFA', color:'#0F766E' }, { label:'Security Analyst', bg:'#EEF2FF', color:'#4338CA' }],
                      };
                      const seen = new Set<string>();
                      const careers: { label: string; bg: string; color: string }[] = [];
                      for (const [trait] of traits) {
                        for (const c of (CAREER_MAP[trait] || [])) {
                          if (!seen.has(c.label)) { seen.add(c.label); careers.push(c); }
                          if (careers.length >= 6) break;
                        }
                        if (careers.length >= 6) break;
                      }
                      return (
                        <div className="bg-white rounded-2xl p-5 border border-gray-100">
                          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Suggested Career Paths</div>
                          <div className="flex flex-wrap gap-2">
                            {careers.map(c => (
                              <span key={c.label} className="px-4 py-2 rounded-full text-xs font-bold" style={{ background: c.bg, color: c.color }}>{c.label}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="text-center text-xs text-gray-400 pb-2">
                      <div className="font-bold text-indigo-600 mb-1">EXAMINERS</div>
                      <div>Auto-generated from self-reported responses. Results are indicative, not definitive.</div>
                    </div>

                  </div>
                )}
              </div>

              {showPersonalityHelp && (
                <div className="absolute inset-0 z-20 flex flex-col bg-white rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2D1B69 50%, #4F46E5 100%)' }}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <FontAwesomeIcon icon={faQuestionCircle} className="text-white text-sm" />
                      </div>
                      <h2 className="text-base font-bold text-white">How is this calculated?</h2>
                    </div>
                    <button onClick={() => setShowPersonalityHelp(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all">
                      <FontAwesomeIcon icon={faTimes} className="text-white" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-[#F8F7F4] p-5 space-y-4">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">1</div>
                        <h4 className="font-bold text-gray-800">The 8 Personality Traits</h4>
                      </div>
                      <div className="space-y-2">
                        {([
                          ['Openness','#3B82F6','Curiosity, creativity, and willingness to explore new experiences and ideas'],
                          ['Conscientiousness','#10B981','Organization, discipline, and reliability in completing tasks and commitments'],
                          ['Extraversion','#F59E0B','Social energy, assertiveness, and preference for group interactions'],
                          ['Agreeableness','#EF4444','Cooperation, empathy, and tendency to prioritize harmony with others'],
                          ['Emotional Stability','#8B5CF6','Calm and composure under pressure, resilience to stress and setbacks'],
                          ['Leadership','#F97316','Initiative, decision-making, and ability to guide and inspire others'],
                          ['Problem Solving','#06B6D4','Analytical thinking, logical reasoning, and systematic approach to challenges'],
                          ['Communication','#EC4899','Clarity of expression, active listening, and adaptability in conveying ideas'],
                        ] as [string,string,string][]).map(([trait,color,desc]) => (
                          <div key={trait} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                            <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: color }} />
                            <div>
                              <div className="text-xs font-bold text-gray-800">{trait}</div>
                              <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
                      <strong>📌 Note:</strong> This assessment is based on self-reported responses. Results reflect answers at the time and should be treated as indicative tendencies, not definitive personality classifications.
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

    </div>
  );
}