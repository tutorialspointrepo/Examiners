import { useState, useEffect, useRef } from 'react';
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
  faGraduationCap,
  faCalendar,
  faLayerGroup,
  faCircleQuestion,
  faStar,
  faClock,
  faSpinner
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
  // Priority 1: Calculate from questionsList if available
  if (exam?.questionsList && Array.isArray(exam.questionsList) && exam.questionsList.length > 0) {
    return exam.questionsList.reduce((total: number, question: any) => {
      const marks = question.maximumMarks || question.marks || 0;
      return total + Number(marks);
    }, 0);
  }
  
  // Priority 2: Use exam.maxMarks
  if (exam?.maxMarks) {
    const marks = parseFloat(String(exam.maxMarks));
    if (!isNaN(marks) && marks > 0) {
      return marks;
    }
  }
  
  return 0;
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

// ✅ Helper function to format exam date (DD-Mon-YYYY)
function formatExamDate(dateString: string): string {
  if (!dateString) return 'N/A';
  
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

interface ExamDashboardProps {
  selectedExam: any;
  brandTheme: any;
  // These props are now optional since we'll fetch data ourselves
  presentStudents?: any[];
  absentStudents?: any[];
  totalStudents?: number;
  onStudentPerformanceToggle?: (isShowing: boolean) => void; // ✅ NEW: Callback to notify parent
}

export default function ExamDashboard({
  selectedExam,
  brandTheme,
  presentStudents: propsPresentStudents,
  absentStudents: propsAbsentStudents,
  totalStudents: propsTotalStudents,
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

  // Use props if provided, otherwise use fetched data
  const presentStudents = propsPresentStudents || dashboardData?.presentStudents || [];
  const absentStudents = propsAbsentStudents || dashboardData?.absentStudents || [];
  const totalStudents = propsTotalStudents ?? dashboardData?.totalStudents ?? 0;

  useEffect(() => {
    const hasStudentData = propsPresentStudents && propsPresentStudents.length > 0;
    const examId = selectedExam?.examId || selectedExam?.id;
    
    console.log('🔍 ExamDashboard useEffect:', {
      hasStudentData,
      propsPresentStudentsLength: propsPresentStudents?.length,
      examId,
      willFetch: !hasStudentData && examId
    });
    
    if (!hasStudentData && examId) {
      fetchDashboardData();
    } else {
      console.log('⚠️ NOT fetching - using props!');
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
                <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
                <p className="text-xs text-gray-500 mt-1">Total Students</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-green-600 font-medium">{presentStudents.length} Present</span>
              <span className="text-xs text-red-600 font-medium">{absentStudents.length} Absent</span>
            </div>
          </div>

          {/* Attendance Rate Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckSquare} style={{ fontSize: '20px' }} className="text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {totalStudents > 0 ? Math.round((presentStudents.length / totalStudents) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Attendance Rate</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${totalStudents > 0 ? (presentStudents.length / totalStudents) * 100 : 0}%` }}
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
                <p className="text-3xl font-bold text-gray-900">
                  {presentStudents.filter((s: any) => s.hasAttempt).length}
                </p>
                <p className="text-xs text-gray-500 mt-1">Submissions</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-600">
                {presentStudents.length > 0 ? Math.round((presentStudents.filter((s: any) => s.hasAttempt).length / presentStudents.length) * 100) : 0}% of present
              </span>
            </div>
          </div>

          {/* Average Score Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faAward} style={{ fontSize: '20px' }} className="text-yellow-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
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
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div 
                className="h-2 rounded-full transition-all"
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
                <p className="text-3xl font-bold text-gray-900">
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
                <p className="text-3xl font-bold text-gray-900">
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
        </div>

        {/* Performance Distribution */}
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
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${(excellent / total) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  {/* Good */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Good (75-89%)</span>
                      <span className="text-sm font-semibold text-blue-600">{good} students</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${(good / total) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  {/* Average */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Average (60-74%)</span>
                      <span className="text-sm font-semibold text-orange-600">{average} students</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${(average / total) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  {/* Needs Improvement */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Needs Improvement (&lt;60%)</span>
                      <span className="text-sm font-semibold text-red-600">{poor} students</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-red-500 h-2.5 rounded-full" style={{ width: `${(poor / total) * 100}%` }}></div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

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
                    <p className="text-3xl font-bold text-red-600">{totalViolations}</p>
                    <p className="text-xs text-gray-600 mt-1">Total Violations</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-3xl font-bold text-orange-600">{studentsWithViolations}</p>
                    <p className="text-xs text-gray-600 mt-1">Students Flagged</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{submittedStudents.length - studentsWithViolations}</p>
                    <p className="text-xs text-gray-600 mt-1">Clean Exams</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">
                      {submittedStudents.length > 0 ? (totalViolations / submittedStudents.length).toFixed(1) : '0'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Avg per Student</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Top Performers */}
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
                        {(student.attemptData?.percentage || 0).toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {student.attemptData?.obtainedMarks || 0}/{getTotalMarks(selectedExam)}
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
            <h1 className="text-3xl font-bold text-gray-900">{selectedExam.title}</h1>
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
              Created By - <span className="text-gray-900 font-medium">{safeRender(selectedExam.createdByName || selectedExam.createdBy)}</span>, {safeRender(selectedExam.createdByRole)}
            </p>
          </div>

          {/* Single Line Metadata with Icons */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
            <div className="flex items-center space-x-1.5">
              <FontAwesomeIcon icon={faUsers} className="text-gray-500" />
              <span>{safeRender(selectedExam.totalStudents || 0)} Students</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <FontAwesomeIcon icon={faGraduationCap} className="text-gray-500" />
              <span>Class {safeRender(selectedExam.class)}</span>
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
            <p className="text-2xl font-bold text-gray-900">{selectedExam.duration || 'N/A'}</p>
          </div>
          
          {/* Questions Card */}
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <div className="flex items-center space-x-2 mb-2">
              <FontAwesomeIcon icon={faClipboardList} className="text-orange-500 text-sm" />
              <span className="text-xs text-orange-500 font-medium">Questions</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{selectedExam.totalQuestions || selectedExam.questionsList?.length || 0} Qs</p>
          </div>
          
          {/* Max Marks Card */}
          <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
            <div className="flex items-center space-x-2 mb-2">
              <FontAwesomeIcon icon={faTrophy} className="text-yellow-500 text-sm" />
              <span className="text-xs text-yellow-500 font-medium">Max Marks</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{selectedExam.maxMarks || 0}</p>
          </div>
        </div>
      </div>

      {/* Questions List Header */}
      {selectedExam.questionsList && selectedExam.questionsList.length > 0 && (
        <div className="px-6 mb-6 mt-4">
          <div className="mb-4">
            <h3 className="text-2xl font-semibold text-gray-900 mb-2 flex items-center space-x-2">
              <FontAwesomeIcon icon={faClipboardList} className="text-gray-600" />
              <span>Questions List</span>
            </h3>
            <div className="text-sm font-medium text-gray-600">
              {(() => {
                if (!selectedExam.questionsList || selectedExam.questionsList.length === 0) {
                  return <span>Total Questions: {selectedExam.questionsList?.length || 0} • Max Marks: {safeRender(selectedExam.maxMarks)}</span>;
                }
                
                const mcqCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.MCQ).length;
                const fitbCount = selectedExam.questionsList.filter((q: any) => {
                  const typeStr = (q.type || '').toString().toLowerCase().replace(/\s+/g, '');
                  return typeStr === QUESTION_TYPES.FITB || q.type === QUESTION_TYPES.FITB;
                }).length;
                const descriptiveCount = selectedExam.questionsList.filter((q: any) => {
                  return q.type === QUESTION_TYPES.DESCRIPTIVE;
                }).length;
                const jumbledCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.JUMBLED).length;
                const codeCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.CODE).length;
                
                const parts = [
                  `Total Questions: ${selectedExam.questionsList.length}`,
                  `Max Marks: ${safeRender(selectedExam.maxMarks)}`
                ];
                
                if (mcqCount > 0) parts.push(`MCQ: ${mcqCount}`);
                if (fitbCount > 0) parts.push(`FITB: ${fitbCount}`);
                if (descriptiveCount > 0) parts.push(`Descriptive: ${descriptiveCount}`);
                if (jumbledCount > 0) parts.push(`Jumbled: ${jumbledCount}`);
                if (codeCount > 0) parts.push(`Code: ${codeCount}`);
                
                return <span>{parts.join(' • ')}</span>;
              })()}
            </div>
          </div>

          {/* Questions rendering - exactly like App.tsx */}
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
                    <div className="flex items-center space-x-2">
                      {/* Question Bank Badge */}
                      {question.questionBankId && (
                        <span className="inline-flex items-center space-x-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          <FontAwesomeIcon icon={faClipboardList} className="text-xs" />
                          <span>Question Bank</span>
                        </span>
                      )}
                      
                      {/* Calendar Icon (if needed) */}
                      <FontAwesomeIcon icon={faCalendar} className="text-gray-400 text-sm" />
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Public Badge */}
                      {question.visibility === 'public' || !question.visibility && (
                        <span className="inline-flex items-center space-x-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                          <span>🌐</span>
                          <span>Public</span>
                        </span>
                      )}
                      
                      {/* View Details Link */}
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
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question Pool Section */}
      {selectedExam.questionPool && Array.isArray(selectedExam.questionPool) && selectedExam.questionPool.length > 0 && selectedExam.pickRandomCount && selectedExam.pickRandomCount > 0 ? (
        <div className="bg-white p-5 mb-6 mx-6 rounded-xl border border-purple-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-md">
                <FontAwesomeIcon icon={faLayerGroup} className="text-white text-lg" />
              </div>
              <span>Question Pool Configuration</span>
            </h3>
            <div className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
              Random Selection
            </div>
          </div>

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
  if (!data || !data.questions || data.questions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No question data available</p>
      </div>
    );
  }

  const { exam, presentStudents, questions } = data;

  // Calculate totals for collapsed view
  const calculateStudentTotals = (student: any) => {
    if (!student.attemptData) {
      return { totalObtained: 0, totalMax: 0, totalViolations: 0, totalTime: 0 };
    }

    // ✅ Use pre-calculated values from firebase_service
    const totalViolations = student.attemptData.violationCount || 0;
    const totalTime = student.attemptData.timeSpent || 0;
    
    // Calculate marks totals
    let totalObtained = 0;
    let totalMax = 0;
    
    if (student.attemptData.responses && questions) {
      questions.forEach((question: any) => {
        const questionId = question.id || question.questionId;
        const questionAnswer = student.attemptData.responses.find((r: any) => r.questionId === questionId);
        
        const maxMarks = question.maximumMarks || question.marks || 0;
        const obtainedMarks = getQuestionObtainedMarks(questionAnswer);
        
        totalMax += maxMarks;
        totalObtained += obtainedMarks;
      });
    } else {
      totalObtained = student.attemptData.obtainedMarks || 0;
      totalMax = student.attemptData.totalScore || exam?.totalMarks || 0;
    }

    return { totalObtained, totalMax, totalViolations, totalTime };
  };

  return (
    <div className="bg-white h-full">
      {/* Exam Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mx-6 mt-4 mb-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{exam.name || exam.title}</h4>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span>Class: {exam.class}</span>
          <span>Subject: {exam.subject}</span>
          {(exam.examDate || exam.startDate) && (
            <span>Date: {(() => {
              const dateStr = exam.examDate || exam.startDate;
              if (!dateStr) return 'N/A';
              try {
                // Handle Firestore Timestamp or date string
                const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
                return date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
              } catch (e) {
                return dateStr;
              }
            })()}</span>
          )}
          {(exam.examTime || exam.startTime) && (
            <span>Time: {exam.examTime || exam.startTime}</span>
          )}
          {exam.duration && <span>Duration: {exam.duration} min</span>}
        </div>
      </div>

      {/* Student Cards */}
      <div className="px-6 space-y-4">
      {presentStudents
        .filter((s: any) => s.hasAttempt && s.attemptData && s.attemptData.totalScore != null)
        .map((student: any) => {
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
                      <p className="text-sm text-gray-600">Roll: {student.rollNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: brandTheme.colors.primary }}>
                      {student.attemptData?.percentage != null && !isNaN(student.attemptData.percentage) 
                        ? student.attemptData.percentage.toFixed(2) 
                        : '0.00'}%
                    </p>
                    <p className="text-sm text-gray-600">
                      {getStudentObtainedMarks(student.attemptData)}/{getTotalMarks(exam)} marks
                    </p>
                  </div>
                </div>

                {/* Summary Row - Always Visible */}
                <div className="grid grid-cols-6 gap-4 text-sm bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">Questions</p>
                    <p className="font-semibold text-gray-900">{questions.length}</p>
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
                        {questions.map((question: any, qIndex: number) => {
                          const questionId = question.id || question.questionId;
                          const questionAnswer = student.attemptData?.responses?.find((r: any) => r.questionId === questionId);
                          
                          const maxMarks = question.maximumMarks || question.marks || 0;
                          const obtainedMarks = getQuestionObtainedMarks(questionAnswer); // ✅ FIXED: Use helper function
                          const timeSpent = questionAnswer?.timeSpent || 0;
                          const revisitCount = questionAnswer?.revisitCount || 0;
                          const attemptCount = questionAnswer?.attemptCount || 0;
                          const violations = questionAnswer?.violations || [];
                          
                          const typeLabels: any = {
                            mcq: 'MCQ',
                            fillInTheBlank: 'Fill Blank',
                            jumbledQuiz: 'Jumbled',
                            descriptive: 'Descriptive',
                            code: 'Code'
                          };
                          
                          const difficultyColors: any = {
                            Easy: 'text-green-600',
                            Medium: 'text-yellow-600',
                            Hard: 'text-red-600'
                          };

                          return (
                            <tr key={questionId} className={qIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">Q{qIndex + 1}</td>
                              <td className="px-4 py-3 text-sm text-gray-700">{typeLabels[question.type] || question.type}</td>
                              <td className={`px-4 py-3 text-sm font-medium ${difficultyColors[question.difficulty || 'Medium']}`}>
                                {question.difficulty || 'Medium'}
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          );
        })}

      {/* No submissions message */}
      {presentStudents.filter((s: any) => s.hasAttempt && s.attemptData && s.attemptData.totalScore != null).length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No student submissions yet</p>
        </div>
      )}
      </div>
    </div>
  );
}