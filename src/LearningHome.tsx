import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faVideo,
  faClipboardList,
  faRobot,
  faBookOpen,
  faChartLine,
  faTrophy,
  faUsers,
  faPlay,
  faArrowRight,
  faCode,
  faUser,
  faBrain,
  faSpinner,
  faEllipsisVertical,
  faCrown,
  faXmark,
  faCircleInfo,
  faClock,
  faChevronLeft,
  faChevronRight,
  faFire,
  faFlask,
  faDownload,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import AISupportAssistant from './AISupportAssistant';

interface LearningHomeProps {
  brandTheme: {
    colors: {
      primary: string;
      secondary: string;
    };
    gradients: {
      primary: string;
    };
    collegeName?: string;
  };
  currentUser: any;
  selectedCollege?: { id: string; name: string } | null;
  onOpenCourse?: (courseSlug: string, initialLectureId?: number) => void;
  onViewAllCourses?: () => void;
  onNavigate?: (menuId: string) => void;
}

const BADGE_ICONS: Record<string, { emoji: string; earnedBg: string; unearnedBg: string }> = {
  first_step:    { emoji: '👣', earnedBg: 'bg-blue-100',    unearnedBg: 'bg-gray-100' },
  bookworm:      { emoji: '📚', earnedBg: 'bg-indigo-100',  unearnedBg: 'bg-gray-100' },
  on_fire:       { emoji: '🔥', earnedBg: 'bg-orange-100',  unearnedBg: 'bg-gray-100' },
  dedicated:     { emoji: '⭐', earnedBg: 'bg-rose-100',    unearnedBg: 'bg-gray-100' },
  quiz_master:   { emoji: '🧠', earnedBg: 'bg-violet-100',  unearnedBg: 'bg-gray-100' },
  perfect_score: { emoji: '💯', earnedBg: 'bg-emerald-100', unearnedBg: 'bg-gray-100' },
  code_warrior:  { emoji: '⚔️', earnedBg: 'bg-cyan-100',    unearnedBg: 'bg-gray-100' },
  time_lord:     { emoji: '⏰', earnedBg: 'bg-amber-100',   unearnedBg: 'bg-gray-100' },
  finisher:      { emoji: '🎓', earnedBg: 'bg-teal-100',    unearnedBg: 'bg-gray-100' },
  champion:      { emoji: '🏆', earnedBg: 'bg-yellow-100',  unearnedBg: 'bg-gray-100' },
};

const LearningHome: React.FC<LearningHomeProps> = ({ brandTheme, currentUser, selectedCollege, onOpenCourse, onViewAllCourses, onNavigate }) => {
  // Check if user is a student
  const isStudent = currentUser?.userType === 'student';
  const userId = currentUser?.userId || currentUser?.uid || '';
  const collegeId = selectedCollege?.id || currentUser?.collegeId || '';

  // Fetch student learning detail
  const [learningData, setLearningData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Admin/Teacher dashboard stats
  const [adminDashStats, setAdminDashStats] = useState<any>(null);
  const [isLoadingAdminStats, setIsLoadingAdminStats] = useState(false);

  useEffect(() => {
    if (!isStudent || !userId || !collegeId) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    firebaseService.getStudentLearningDetail(userId, collegeId)
      .then(data => { setLearningData(data); })
      .catch(err => console.error('Error loading learning detail:', err))
      .finally(() => setIsLoadingData(false));
  }, [isStudent, userId, collegeId]);

  // Fetch college dashboard stats for non-students
  useEffect(() => {
    if (isStudent || !collegeId) return;
    setIsLoadingAdminStats(true);
    firebaseService.getCollegeDashboardStats(collegeId)
      .then(data => { setAdminDashStats(data); })
      .catch(err => console.error('Error loading college dashboard stats:', err))
      .finally(() => setIsLoadingAdminStats(false));
  }, [isStudent, collegeId]);

  // Activity chart filter
  const [activityFilter, setActivityFilter] = useState<'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_3_months' | 'last_6_months' | 'custom'>('this_week');
  const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // Calculate days to fetch based on filter
  const activityDays = useMemo(() => {
    if (activityFilter === 'custom' && customDateRange.from && customDateRange.to) {
      const from = new Date(customDateRange.from);
      const to = new Date(customDateRange.to);
      const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(diff, 1);
    }
    switch (activityFilter) {
      case 'today': return 1;
      case 'yesterday': return 2;
      case 'this_week': return 7;
      case 'last_week': return 14;
      case 'this_month': return 30;
      case 'last_3_months': return 90;
      case 'last_6_months': return 180;
      default: return 7;
    }
  }, [activityFilter, customDateRange]);

  // Fetch activity data
  const [activityData, setActivityData] = useState<any[]>([]);
  useEffect(() => {
    if (isStudent) {
      if (!userId) return;
      firebaseService.getStudentDailyLearningLog(userId, activityDays)
        .then(data => setActivityData(data))
        .catch(err => console.error('Error loading activity:', err));
    } else {
      if (!collegeId) return;
      firebaseService.getCollegeDailyLearningStats(collegeId, activityDays)
        .then(data => setActivityData(data.map(d => ({
          date: d.date,
          timeSpent: d.hours * 3600,
          lecturesCompleted: 0,
          quizzesCompleted: 0,
          exercisesCompleted: 0,
          assessmentsCompleted: 0,
          activeStudents: d.activeStudents,
        }))))
        .catch(err => console.error('Error loading college activity:', err));
    }
  }, [isStudent, userId, collegeId, activityDays]);

  // Top learners state
  const [topLearners, setTopLearners] = useState<any[]>([]);
  const [isLoadingLearners, setIsLoadingLearners] = useState(false);

  // Badges state
  const [badges, setBadges] = useState<any[]>([]);
  const [streakDailyLogs, setStreakDailyLogs] = useState<any[]>([]);

  // Fetch last 365 days of logs for streak calculation (once)
  useEffect(() => {
    if (!isStudent || !userId) return;
    firebaseService.getStudentDailyLearningLog(userId, 365)
      .then(data => setStreakDailyLogs(data))
      .catch(() => {});
  }, [isStudent, userId]);

  // Calculate badges when data is available
  useEffect(() => {
    if (!isStudent || !userId || !collegeId) return;
    firebaseService.getStudentLearningDetail(userId, collegeId).then(detail => {
      if (!detail) return;
      const myRank = topLearners.find(l => l.userId === userId)?.rank || 0;
      const computed = firebaseService.getStudentBadges(detail, streakDailyLogs, myRank);
      setBadges(computed);
    }).catch(() => {});
  }, [isStudent, userId, collegeId, streakDailyLogs, topLearners]);

  // Leaderboard modal state
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardTotalCount, setLeaderboardTotalCount] = useState(0);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const leaderboardPageSize = 10;
  const [leaderboardClassFilter, setLeaderboardClassFilter] = useState('all');
  const [leaderboardCourseFilter, setLeaderboardCourseFilter] = useState('all');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<{ id: string; name: string }[]>([]);

  const totalLeaderboardPages = Math.ceil(leaderboardTotalCount / leaderboardPageSize);

  // Fetch top learners - 5 for non-students, 3 for students
  useEffect(() => {
    if (!collegeId) return;
    setIsLoadingLearners(true);
    firebaseService.getTopLearners(collegeId, { limit: isStudent ? 3 : 5 })
      .then(result => setTopLearners(result.learners))
      .catch(err => console.error('Error loading top learners:', err))
      .finally(() => setIsLoadingLearners(false));
  }, [collegeId]);

  // Fetch leaderboard data (called on modal open, page change, or filter change)
  const fetchLeaderboard = useCallback((page: number, classFilter: string, courseFilter: string) => {
    if (!collegeId) return;
    setIsLoadingLeaderboard(true);
    firebaseService.getTopLearners(collegeId, {
      limit: leaderboardPageSize,
      page,
      classFilter,
      courseFilter,
    })
      .then(result => {
        setLeaderboardData(result.learners);
        setLeaderboardTotalCount(result.totalCount);
        if (result.classes.length > 0) setAvailableClasses(result.classes);
        if (result.courses.length > 0) setAvailableCourses(result.courses);
      })
      .catch(err => console.error('Error loading leaderboard:', err))
      .finally(() => setIsLoadingLeaderboard(false));
  }, [collegeId]);

  const handleOpenLeaderboard = useCallback(() => {
    setShowLeaderboardModal(true);
    setLeaderboardPage(1);
    setLeaderboardClassFilter('all');
    setLeaderboardCourseFilter('all');
    fetchLeaderboard(1, 'all', 'all');
  }, [fetchLeaderboard]);

  const handleLeaderboardPageChange = useCallback((newPage: number) => {
    setLeaderboardPage(newPage);
    fetchLeaderboard(newPage, leaderboardClassFilter, leaderboardCourseFilter);
  }, [fetchLeaderboard, leaderboardClassFilter, leaderboardCourseFilter]);

  const handleLeaderboardClassChange = useCallback((value: string) => {
    setLeaderboardClassFilter(value);
    setLeaderboardPage(1);
    fetchLeaderboard(1, value, leaderboardCourseFilter);
  }, [fetchLeaderboard, leaderboardCourseFilter]);

  const handleLeaderboardCourseChange = useCallback((value: string) => {
    setLeaderboardCourseFilter(value);
    setLeaderboardPage(1);
    fetchLeaderboard(1, leaderboardClassFilter, value);
  }, [fetchLeaderboard, leaderboardClassFilter]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportLeaderboard = useCallback(async () => {
    if (!collegeId || isExporting) return;
    setIsExporting(true);
    try {
      const data = await firebaseService.exportLeaderboardData(collegeId, {
        classFilter: leaderboardClassFilter,
        courseFilter: leaderboardCourseFilter,
      });
      if (data.length === 0) {
        setIsExporting(false);
        return;
      }

      // Build CSV
      const headers = ['Rank', 'Student Name', 'Email', 'Class', 'Hours Studied', 'Lectures Completed', 'Quizzes Completed', 'Exercises Completed', 'Courses Enrolled', 'Quiz Marks', 'Quiz Max Marks', 'Exercise Marks', 'Exercise Max Marks', 'Composite Score'];
      const rows = data.map(l => [
        l.rank, l.userName, l.userEmail, l.studentClass, l.timeHours,
        l.totalLecturesCompleted, l.totalQuizzesCompleted, l.totalExercisesCompleted,
        l.totalCoursesEnrolled, l.quizMarksObtained, l.quizMaxMarks,
        l.exerciseMarksObtained, l.exerciseMaxMarks, l.compositeScore,
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => {
          const str = String(cell ?? '');
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','))
        .join('\n');

      // Add BOM for Excel UTF-8 compatibility
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filterLabel = leaderboardClassFilter !== 'all' ? `_${leaderboardClassFilter}` : '';
      link.download = `Leaderboard${filterLabel}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [collegeId, leaderboardClassFilter, leaderboardCourseFilter, isExporting]);

  // Build chart data based on filter
  const activityChartData = useMemo(() => {
    const days: any[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let startDate: Date;
    let endDate: Date;

    if (activityFilter === 'custom' && customDateRange.from && customDateRange.to) {
      startDate = new Date(customDateRange.from);
      endDate = new Date(customDateRange.to);
    } else {
      endDate = new Date();
      startDate = new Date();
      switch (activityFilter) {
        case 'today':
          break;
        case 'yesterday':
          startDate.setDate(startDate.getDate() - 1);
          endDate.setDate(endDate.getDate() - 1);
          break;
        case 'this_week':
          startDate.setDate(startDate.getDate() - 6);
          break;
        case 'last_week':
          startDate.setDate(startDate.getDate() - 13);
          endDate.setDate(endDate.getDate() - 7);
          break;
        case 'this_month':
          startDate.setDate(startDate.getDate() - 29);
          break;
        case 'last_3_months':
          startDate.setDate(startDate.getDate() - 89);
          break;
        case 'last_6_months':
          startDate.setDate(startDate.getDate() - 179);
          break;
      }
    }

    const numDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // For large ranges (>60 days), aggregate by week
    if (numDays > 60) {
      const weekMap = new Map<string, { timeSpent: number; lectures: number; quizzes: number; exercises: number; assessments: number; label: string }>();
      for (let i = 0; i < numDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // Week key: start of that week's Monday
        const weekStart = new Date(d);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        const entry = activityData.find(a => a.date === dateStr);
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, { timeSpent: 0, lectures: 0, quizzes: 0, exercises: 0, assessments: 0, label: `${weekStart.getDate()} ${monthNames[weekStart.getMonth()]}` });
        }
        const w = weekMap.get(weekKey)!;
        w.timeSpent += entry?.timeSpent || 0;
        w.lectures += entry?.lecturesCompleted || 0;
        w.quizzes += entry?.quizzesCompleted || 0;
        w.exercises += entry?.exercisesCompleted || 0;
        w.assessments += entry?.assessmentsCompleted || 0;
      }
      return Array.from(weekMap.entries()).map(([key, w]) => ({
        day: w.label,
        date: key,
        ...w,
      }));
    }

    // Daily view
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = activityData.find(a => a.date === dateStr);
      days.push({
        day: numDays <= 7 ? dayNames[d.getDay()] : `${d.getDate()} ${monthNames[d.getMonth()]}`,
        date: dateStr,
        timeSpent: entry?.timeSpent || 0,
        lectures: entry?.lecturesCompleted || 0,
        quizzes: entry?.quizzesCompleted || 0,
        exercises: entry?.exercisesCompleted || 0,
        assessments: entry?.assessmentsCompleted || 0,
      });
    }
    return days;
  }, [activityData, activityFilter, customDateRange]);

  // Format seconds to display hours
  const formatHours = (totalSeconds: number) => {
    if (!totalSeconds) return '0';
    const hours = totalSeconds / 3600;
    if (hours < 1) return `${Math.round(totalSeconds / 60)}m`;
    return hours.toFixed(1);
  };

  // Format relative time

  // Build continue learning courses from data
  const continueLearningCourses = useMemo(() => {
    if (!learningData?.courses) return [];
    return Object.entries(learningData.courses)
      .filter(([_, c]: any) => c.status === 'active')
      .sort((a: any, b: any) => {
        const aTime = a[1].lastAccessedAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b[1].lastAccessedAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 3)
      .map(([slug, course]: any) => {
        const lecturesCompleted = course.lecturesCompleted || 0;
        const totalLectures = course.totalLectures || 0;
        const pct = course.percentage || (totalLectures > 0 && lecturesCompleted > 0 ? Math.max(1, Math.round((lecturesCompleted / totalLectures) * 100)) : 0);
        return {
          slug,
          name: course.courseName || slug,
          chapter: course.lastChapterName || '',
          percentage: pct,
          thumbnailUrl: course.thumbnailUrl || '',
          totalLectures,
          totalExercises: course.totalExercises || 0,
          totalQuizzes: course.totalQuizzes || 0,
          totalUnits: course.totalUnits || 0,
          lastLectureId: course.lastLectureId ? parseInt(course.lastLectureId) : undefined,
        };
      });
  }, [learningData]);

  // Stats for Students — dynamic from learningData
  const studentStats = [
    { label: 'Courses Enrolled', value: isLoadingData ? '...' : String(learningData?.totalCoursesEnrolled || 0), icon: faBookOpen, color: '#8B5CF6' },
    { label: 'Hours Learned', value: isLoadingData ? '...' : formatHours(learningData?.totalTimeSpent || 0), icon: faVideo, color: '#3B82F6' },
    { label: 'Assessment Completed', value: isLoadingData ? '...' : String(learningData?.totalQuizzesCompleted || 0), icon: faClipboardList, color: '#10B981' },
    { label: 'Lectures Completed', value: isLoadingData ? '...' : String(learningData?.totalLecturesCompleted || 0), icon: faTrophy, color: '#F59E0B' },
  ];

  // Stats for Non-Students (Teachers/Admins)
  const _loading = isLoadingAdminStats ? '...' : null;
  const adminStats = [
    { label: 'Total Students', value: _loading ?? (adminDashStats?.totalStudents || 0).toLocaleString(), icon: faUsers, color: '#8B5CF6' },
    { label: 'Total Enrollments', value: _loading ?? (adminDashStats?.totalEnrollments || 0).toLocaleString(), icon: faBookOpen, color: '#3B82F6' },
    { label: 'Courses Completed', value: _loading ?? (adminDashStats?.totalCoursesCompleted || 0).toLocaleString(), icon: faGraduationCap, color: '#10B981' },
    { label: 'Avg Completion Rate', value: _loading ?? `${adminDashStats?.avgCompletionRate || 0}%`, icon: faChartLine, color: '#F59E0B' },
    { label: 'Total Learning Hours', value: _loading ?? (adminDashStats?.totalLearningHours || 0).toLocaleString(), icon: faVideo, color: '#EF4444' },
  ];

  // Use appropriate stats based on user type
  const stats = isStudent ? studentStats : adminStats;

  // Quick access items
  const quickAccessItems = [
    { id: 'ai', name: '24x7 AI Based Support', icon: faRobot, menuId: 'ai-interview' },
    { id: 'coding', name: 'Online Code Practice', icon: faCode, menuId: 'codinglab' },
    { id: 'resume', name: 'Resume Builder', icon: faUser, menuId: 'resumebuilder' },
    { id: 'logic', name: 'Logic Builder', icon: faBrain, menuId: 'logicbuilder' },
  ];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide bg-gray-50">
      {/* Banner */}
      <div className="relative mb-6 overflow-hidden rounded-2xl px-8 py-6 mt-5 mx-6" style={{ backgroundColor: '#eeeeee' }}>
        {/* Decorative elements */}
        <div className="absolute top-6 left-8 h-6 w-6 rotate-45 transform border-2 border-cyan-400 opacity-70 shadow-lg" />
        <div className="absolute top-16 left-14 h-3 w-3 rotate-45 transform bg-gradient-to-br from-pink-400 to-rose-500 opacity-60 shadow-md" />
        <div className="absolute top-4 right-24 h-8 w-8 rotate-12 transform border-2 border-yellow-400 opacity-50 shadow-lg" />

        <div className="relative z-10">
          {/* Top row - Robot icon, Title, Button */}
          <div className="mb-6 flex items-center justify-between">
            <div className="ml-12 flex flex-1 items-center gap-4">
              {/* Robot Icon */}
              <div className="flex-shrink-0">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-lg bg-blue-600 shadow-lg">
                  <div className="relative flex flex-col items-center">
                    {/* Antenna */}
                    <div className="mb-0.5 h-1.5 w-0.5" style={{ backgroundColor: '#ea580c' }}></div>
                    <div className="mb-0.5 h-1 w-1 rounded-full bg-yellow-400"></div>
                    {/* Head */}
                    <div className="relative mb-0.5 flex h-5 w-6 items-center justify-center rounded-sm" style={{ backgroundColor: '#f97316' }}>
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 rounded-sm bg-black"></div>
                        <div className="h-1.5 w-1.5 rounded-sm bg-black"></div>
                      </div>
                    </div>
                    {/* Neck */}
                    <div className="relative mb-0.5 h-4 w-5 rounded-sm" style={{ backgroundColor: '#f97316' }}>
                      <div className="absolute inset-x-1 top-1 h-1 w-3 rounded-sm" style={{ backgroundColor: '#ea580c' }}></div>
                    </div>
                    {/* Arms */}
                    <div className="absolute top-6 -left-1 h-3 w-1 rounded-sm" style={{ backgroundColor: '#ea580c' }}></div>
                    <div className="absolute top-6 -right-1 h-3 w-1 rounded-sm" style={{ backgroundColor: '#ea580c' }}></div>
                    {/* Body */}
                    <div className="h-3 w-4 rounded-sm bg-teal-500"></div>
                    {/* Feet */}
                    <div className="mt-0.5 flex gap-0.5">
                      <div className="h-1 w-1.5 rounded-sm bg-teal-600"></div>
                      <div className="h-1 w-1.5 rounded-sm bg-teal-600"></div>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 h-2 w-12 rounded-sm bg-blue-500 opacity-70"></div>
                </div>
              </div>
              
              {/* Title */}
              <div className="flex-1 text-gray-800 min-w-0">
                <h1 className="mb-2 font-bold text-2xl leading-tight">
                  <span 
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: brandTheme.gradients.primary }}
                  >{selectedCollege?.name || brandTheme.collegeName || 'Your Institution'}®</span>
                </h1>
                <p className="text-gray-600 text-lg">Your journey to a successful career starts here...</p>
              </div>
            </div>
            
            {/* Button */}
            <div className="flex-shrink-0 text-center ml-8">
              <button 
                className="transform whitespace-nowrap rounded-lg px-6 py-3 font-bold text-sm text-white shadow-lg transition-all duration-200 hover:shadow-xl"
                style={{ background: brandTheme.gradients.primary }}
              >
                HAPPY LEARNING
              </button>
              <p className="mt-2 text-gray-600 text-sm">Anytime, Anywhere</p>
            </div>
          </div>

          {/* Bottom row - Quick access */}
          <div>
            <h3 className="mb-4 font-medium text-base text-gray-800">Get instant access to</h3>
            <div className="flex flex-wrap lg:flex-nowrap gap-8">
              {quickAccessItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.id === 'ai' ? setShowAIAssistant(true) : onNavigate?.(item.menuId)}
                  className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-600 bg-opacity-80">
                    <FontAwesomeIcon icon={item.icon} className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium text-sm">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`mx-6 mb-6 grid gap-4 ${isStudent ? 'grid-cols-4' : 'grid-cols-5'}`}>
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}15` }}
              >
                <FontAwesomeIcon icon={stat.icon} style={{ color: stat.color }} />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
            </div>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>



      {/* Two Column Layout */}
      <div className="mx-6 mb-6 grid grid-cols-2 gap-6">
        {/* Left Card - Learning Activity Chart (Students) / Top Performing Students (Non-Students) */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          {isStudent ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Learning Activity</h3>
                <div className="flex items-center gap-2">
                  {activityFilter === 'custom' ? (
                    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                      <input type="date" value={customDateRange.from} onChange={e => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))} className="text-xs border-0 bg-transparent px-0 py-0 focus:outline-none w-24" />
                      <span className="text-xs text-gray-400">–</span>
                      <input type="date" value={customDateRange.to} onChange={e => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))} max={new Date().toISOString().split('T')[0]} className="text-xs border-0 bg-transparent px-0 py-0 focus:outline-none w-24" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                      {activityFilter === 'today' ? 'Today' : activityFilter === 'yesterday' ? 'Yesterday' : activityFilter === 'this_week' ? 'This Week' : activityFilter === 'last_week' ? 'Last Week' : activityFilter === 'this_month' ? 'This Month' : activityFilter === 'last_3_months' ? '3 Months' : '6 Months'}
                    </span>
                  )}
                  <div className="relative">
                    <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                      <FontAwesomeIcon icon={faEllipsisVertical} className="text-gray-500" />
                    </button>
                    {showFilterDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20 w-44">
                          {([
                            { key: 'today', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: 'this_week', label: 'This Week' },
                            { key: 'last_week', label: 'Last Week' },
                            { key: 'this_month', label: 'This Month' },
                            { key: 'last_3_months', label: 'Last 3 Months' },
                            { key: 'last_6_months', label: 'Last 6 Months' },
                            { key: 'custom', label: 'Custom Range' },
                          ] as { key: typeof activityFilter; label: string }[]).map(f => (
                            <button
                              key={f.key}
                              onClick={() => {
                                setActivityFilter(f.key);
                                setShowFilterDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                activityFilter === f.key 
                                  ? 'font-semibold' 
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                              style={activityFilter === f.key ? { color: brandTheme.colors.primary, backgroundColor: `${brandTheme.colors.primary}08` } : {}}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Chart */}
              {(() => {
                const chartW = 500;
                const chartH = 200;
                const padL = 40;
                const padR = 15;
                const padT = 10;
                const padB = 28;
                const plotW = chartW - padL - padR;
                const plotH = chartH - padT - padB;
                const data = activityChartData;
                const maxMinutes = Math.max(...data.map(d => d.timeSpent / 60), 0.1);
                const yMax = maxMinutes <= 1 ? 1 : maxMinutes <= 5 ? 5 : maxMinutes <= 15 ? 15 : maxMinutes <= 30 ? 30 : maxMinutes <= 60 ? 60 : Math.ceil(maxMinutes / 30) * 30;
                const yTicks = yMax <= 1 ? [0, 1] : yMax <= 5 ? [0, 1, 3, 5] : [0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round(yMax * 3 / 4), yMax];
                
                const points = data.map((d, i) => ({
                  x: padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
                  y: padT + plotH - (plotH * Math.min(d.timeSpent / 60, yMax) / yMax),
                  ...d,
                }));

                const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const areaPath = points.length > 1 ? `${linePath} L ${points[points.length - 1].x} ${padT + plotH} L ${points[0].x} ${padT + plotH} Z` : '';
                const labelInterval = data.length <= 7 ? 1 : data.length <= 14 ? 2 : data.length <= 30 ? 5 : 7;

                return (
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={brandTheme.colors.primary} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={brandTheme.colors.primary} stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={brandTheme.colors.primary} />
                        <stop offset="100%" stopColor={brandTheme.colors.secondary || brandTheme.colors.primary} />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {yTicks.map(tick => {
                      const y = padT + plotH - (plotH * tick / yMax);
                      return (
                        <g key={tick}>
                          <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#F3F4F6" strokeWidth="0.8" />
                          <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#B0B8C4">{tick > 0 ? `${tick}m` : '0'}</text>
                        </g>
                      );
                    })}

                    {/* Baseline */}
                    <line x1={padL} y1={padT + plotH} x2={chartW - padR} y2={padT + plotH} stroke="#E5E7EB" strokeWidth="1" />

                    {/* Area fill */}
                    {points.length > 1 && <path d={areaPath} fill="url(#areaGrad)" />}

                    {/* Line */}
                    {points.length > 1 && <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                    {/* Data points */}
                    {points.map((p, i) => (
                      <g key={i} className="group cursor-pointer">
                        <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
                        <circle cx={p.x} cy={p.y} r={data.length > 30 ? 2 : 4} fill="white" stroke={p.timeSpent > 0 ? brandTheme.colors.primary : '#D1D5DB'} strokeWidth="2" />
                        {p.timeSpent > 0 && <circle cx={p.x} cy={p.y} r="1.5" fill={brandTheme.colors.primary} />}
                        <foreignObject x={p.x - 65} y={p.y - 60} width="130" height="55" className="pointer-events-none" style={{ overflow: 'visible' }}>
                          <div className="hidden group-hover:block bg-gray-800 text-white rounded-lg px-2.5 py-1.5 text-center shadow-lg" style={{ width: 'fit-content', margin: '0 auto', fontSize: '10px', lineHeight: '1.4' }}>
                            <p className="font-semibold">{p.date}</p>
                            <p>{Math.round(p.timeSpent / 60)} min studied</p>
                            {(p.lectures > 0 || p.quizzes > 0 || p.exercises > 0) && (
                              <p className="opacity-80">{[p.lectures > 0 && `${p.lectures} lec`, p.quizzes > 0 && `${p.quizzes} quiz`, p.exercises > 0 && `${p.exercises} ex`].filter(Boolean).join(' · ')}</p>
                            )}
                          </div>
                        </foreignObject>
                      </g>
                    ))}

                    {/* X-axis labels */}
                    {data.map((d, i) => {
                      if (data.length > 1 && i % labelInterval !== 0 && i !== data.length - 1) return null;
                      const x = padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
                      return <text key={i} x={x} y={chartH - 8} textAnchor="middle" fontSize="9" fill="#9CA3AF">{d.day}</text>;
                    })}
                  </svg>
                );
              })()}

              {/* Summary */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Time: <strong className="text-gray-700">{Math.round(activityChartData.reduce((s, d) => s + d.timeSpent, 0) / 60)}m</strong></span>
                  <span>Lectures: <strong className="text-gray-700">{activityChartData.reduce((s, d) => s + d.lectures, 0)}</strong></span>
                  <span>Quizzes: <strong className="text-gray-700">{activityChartData.reduce((s, d) => s + d.quizzes, 0)}</strong></span>
                  <span>Exercises: <strong className="text-gray-700">{activityChartData.reduce((s, d) => s + d.exercises, 0)}</strong></span>
                </div>
                {activityChartData.length > 1 && (
                  <span className="text-xs text-gray-500">{activityChartData.filter(d => d.timeSpent > 0).length}/{activityChartData.length}d active</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Learning Activity</h3>
                <div className="flex items-center gap-2">
                  {activityFilter === 'custom' ? (
                    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                      <input type="date" value={customDateRange.from} onChange={e => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))} className="text-xs border-0 bg-transparent px-0 py-0 focus:outline-none w-24" />
                      <span className="text-xs text-gray-400">–</span>
                      <input type="date" value={customDateRange.to} onChange={e => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))} max={new Date().toISOString().split('T')[0]} className="text-xs border-0 bg-transparent px-0 py-0 focus:outline-none w-24" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                      {activityFilter === 'today' ? 'Today' : activityFilter === 'yesterday' ? 'Yesterday' : activityFilter === 'this_week' ? 'This Week' : activityFilter === 'last_week' ? 'Last Week' : activityFilter === 'this_month' ? 'This Month' : activityFilter === 'last_3_months' ? '3 Months' : '6 Months'}
                    </span>
                  )}
                  <div className="relative">
                    <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                      <FontAwesomeIcon icon={faEllipsisVertical} className="text-gray-500" />
                    </button>
                    {showFilterDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                          {(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_3_months', 'last_6_months', 'custom'] as const).map(f => (
                            <button key={f} onClick={() => { setActivityFilter(f); setShowFilterDropdown(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${activityFilter === f ? 'font-semibold text-blue-600 bg-blue-50' : 'text-gray-700'}`}>
                              {f === 'today' ? 'Today' : f === 'yesterday' ? 'Yesterday' : f === 'this_week' ? 'This Week' : f === 'last_week' ? 'Last Week' : f === 'this_month' ? 'This Month' : f === 'last_3_months' ? 'Last 3 Months' : f === 'last_6_months' ? 'Last 6 Months' : 'Custom Range'}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Chart - College */}
              {(() => {
                const chartW = 500;
                const chartH = 200;
                const padL = 40;
                const padR = 15;
                const padT = 10;
                const padB = 28;
                const plotW = chartW - padL - padR;
                const plotH = chartH - padT - padB;
                const data = activityChartData;
                const maxHours = Math.max(...data.map(d => d.timeSpent / 3600), 0.1);
                const yMax = maxHours <= 1 ? 1 : maxHours <= 5 ? 5 : maxHours <= 10 ? 10 : maxHours <= 24 ? 24 : Math.ceil(maxHours / 10) * 10;
                const yTicks = yMax <= 1 ? [0, 0.5, 1] : yMax <= 5 ? [0, 1, 3, 5] : [0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round(yMax * 3 / 4), yMax];

                const points = data.map((d, i) => ({
                  x: padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
                  y: padT + plotH - (plotH * Math.min(d.timeSpent / 3600, yMax) / yMax),
                  ...d,
                }));

                const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const areaPath = points.length > 1 ? `${linePath} L ${points[points.length - 1].x} ${padT + plotH} L ${points[0].x} ${padT + plotH} Z` : '';
                const labelInterval = data.length <= 7 ? 1 : data.length <= 14 ? 2 : data.length <= 30 ? 5 : 7;

                return (
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="areaGradAdmin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={brandTheme.colors.primary} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={brandTheme.colors.primary} stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="lineGradAdmin" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={brandTheme.colors.primary} />
                        <stop offset="100%" stopColor={brandTheme.colors.secondary || brandTheme.colors.primary} />
                      </linearGradient>
                    </defs>

                    {yTicks.map(tick => {
                      const y = padT + plotH - (plotH * tick / yMax);
                      return (
                        <g key={tick}>
                          <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#F3F4F6" strokeWidth="0.8" />
                          <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#B0B8C4">{tick > 0 ? `${tick}h` : '0'}</text>
                        </g>
                      );
                    })}

                    <line x1={padL} y1={padT + plotH} x2={chartW - padR} y2={padT + plotH} stroke="#E5E7EB" strokeWidth="1" />

                    {points.length > 1 && <path d={areaPath} fill="url(#areaGradAdmin)" />}
                    {points.length > 1 && <path d={linePath} fill="none" stroke="url(#lineGradAdmin)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                    {points.map((p, i) => (
                      <g key={i} className="group cursor-pointer">
                        <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
                        <circle cx={p.x} cy={p.y} r={data.length > 30 ? 2 : 4} fill="white" stroke={p.timeSpent > 0 ? brandTheme.colors.primary : '#D1D5DB'} strokeWidth="2" />
                        {p.timeSpent > 0 && <circle cx={p.x} cy={p.y} r="1.5" fill={brandTheme.colors.primary} />}
                        <foreignObject x={p.x - 65} y={p.y - 50} width="130" height="45" className="pointer-events-none" style={{ overflow: 'visible' }}>
                          <div className="hidden group-hover:block bg-gray-800 text-white rounded-lg px-2.5 py-1.5 text-center shadow-lg" style={{ width: 'fit-content', margin: '0 auto', fontSize: '10px', lineHeight: '1.4' }}>
                            <p className="font-semibold">{p.date}</p>
                            <p>{Math.round(p.timeSpent / 3600 * 10) / 10}h learning • {p.activeStudents || 0} students</p>
                          </div>
                        </foreignObject>
                      </g>
                    ))}

                    {data.map((d, i) => {
                      if (data.length > 1 && i % labelInterval !== 0 && i !== data.length - 1) return null;
                      const x = padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
                      return <text key={i} x={x} y={chartH - 8} textAnchor="middle" fontSize="9" fill="#9CA3AF">{d.day}</text>;
                    })}
                  </svg>
                );
              })()}

              {/* Summary */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Total: <strong className="text-gray-700">{Math.round(activityChartData.reduce((s, d) => s + d.timeSpent, 0) / 3600 * 10) / 10}h</strong></span>
                </div>
                {activityChartData.length > 1 && (
                  <span className="text-xs text-gray-500">{activityChartData.filter(d => d.timeSpent > 0).length}/{activityChartData.length}d active</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Card - Continue Learning (Students) / Recent Student Activity (Non-Students) */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          {isStudent ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Continue Learning</h3>
                <button onClick={onViewAllCourses} className="text-sm font-medium flex items-center space-x-1" style={{ color: brandTheme.colors.primary }}>
                  <span>View All</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </button>
              </div>
              <div className="space-y-4">
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400 text-xl" />
                  </div>
                ) : continueLearningCourses.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FontAwesomeIcon icon={faBookOpen} className="text-3xl mb-2" />
                    <p className="text-sm">No courses yet. Enroll in a course to get started!</p>
                  </div>
                ) : (
                  continueLearningCourses.map((course) => (
                    <div key={course.slug} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}20 0%, ${brandTheme.colors.secondary}20 100%)` }}>
                            {course.thumbnailUrl ? (
                              <img src={course.thumbnailUrl} alt={course.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faBookOpen} style={{ color: brandTheme.colors.primary }} />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{course.name}</h4>
                            {course.chapter && <p className="text-xs text-gray-500">{course.chapter}</p>}
                          </div>
                        </div>
                        <button onClick={() => onOpenCourse?.(course.slug, course.lastLectureId)} className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: brandTheme.gradients.primary }}>
                          <FontAwesomeIcon icon={faPlay} />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><FontAwesomeIcon icon={faVideo} className="text-blue-400" />{course.totalLectures} Lectures</span>
                        <span className="flex items-center gap-1"><FontAwesomeIcon icon={faCode} className="text-green-400" />{course.totalExercises} Exercises</span>
                        <span className="flex items-center gap-1"><FontAwesomeIcon icon={faClipboardList} className="text-orange-400" />{course.totalQuizzes} Quizzes</span>
                        <span className="flex items-center gap-1"><FontAwesomeIcon icon={faTrophy} className="text-purple-400" />{course.totalUnits} Units</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-semibold" style={{ color: brandTheme.colors.primary }}>{course.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${course.percentage}%`, background: brandTheme.gradients.primary }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, #f59e0b, #ef4444)` }}>
                    <FontAwesomeIcon icon={faFire} className="text-white text-sm" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Top Learners</h3>
                </div>
                <button onClick={handleOpenLeaderboard} className="text-sm font-medium flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: brandTheme.colors.primary }}>
                  <span>View All</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </button>
              </div>
              {isLoadingLearners ? (
                <div className="flex items-center justify-center py-8">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-gray-300 text-xl" />
                </div>
              ) : topLearners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2.5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, #fef3c7, #fde68a)` }}>
                    <FontAwesomeIcon icon={faTrophy} className="text-amber-400 text-xl" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No learners yet</p>
                  <p className="text-xs text-gray-400 text-center max-w-[200px]">Leaderboard will update as students start learning</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topLearners.map((learner, idx) => {
                    const rankColors = [
                      { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'from-amber-400 to-yellow-500', text: 'text-amber-700' },
                      { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'from-slate-400 to-slate-500', text: 'text-slate-600' },
                      { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'from-orange-400 to-orange-500', text: 'text-orange-700' },
                    ];
                    const rc = rankColors[idx] || rankColors[2];
                    const initials = (learner.userName || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                    return (
                      <div key={learner.userId} className={`flex items-center gap-3 p-3 rounded-xl ${rc.bg} border ${rc.border} transition-all hover:shadow-sm`}>
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${rc.badge} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          {idx === 0 ? (
                            <FontAwesomeIcon icon={faCrown} className="text-white text-xs" />
                          ) : (
                            <span className="text-white text-[10px] font-bold">{idx + 1}</span>
                          )}
                        </div>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold" style={{ background: brandTheme.gradients.primary }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{learner.userName}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                              <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                              {learner.timeHours}h
                            </span>
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                              <FontAwesomeIcon icon={faBookOpen} className="text-[9px]" />
                              {learner.totalLecturesCompleted}
                            </span>
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                              <FontAwesomeIcon icon={faFlask} className="text-[9px]" />
                              {learner.totalQuizzesCompleted + learner.totalExercisesCompleted}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${rc.text}`}>{learner.compositeScore}</p>
                          <p className="text-[10px] text-gray-400">pts</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Top Learners & Achievements Row - Students only (Non-students see Top Learners in the right card above) */}
      {isStudent && (
      <div className="mx-6 mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Learners Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, #f59e0b, #ef4444)` }}>
                <FontAwesomeIcon icon={faFire} className="text-white text-sm" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Top Learners</h3>
            </div>
            <button onClick={handleOpenLeaderboard} className="text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: brandTheme.colors.primary }}>
              <span>View All</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
            </button>
          </div>

          <div className="px-5 pb-5">
            {isLoadingLearners ? (
              <div className="flex items-center justify-center py-8">
                <FontAwesomeIcon icon={faSpinner} spin className="text-gray-300 text-xl" />
              </div>
            ) : topLearners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2.5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, #fef3c7, #fde68a)` }}>
                  <FontAwesomeIcon icon={faTrophy} className="text-amber-400 text-xl" />
                </div>
                <p className="text-sm font-medium text-gray-500">No learners yet</p>
                <p className="text-xs text-gray-400 text-center max-w-[200px]">Leaderboard will update as students start learning</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topLearners.map((learner, idx) => {
                  const rankColors = [
                    { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'from-amber-400 to-yellow-500', text: 'text-amber-700' },
                    { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'from-slate-400 to-slate-500', text: 'text-slate-600' },
                    { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'from-orange-400 to-orange-500', text: 'text-orange-700' },
                  ];
                  const rc = rankColors[idx] || rankColors[2];
                  const initials = (learner.userName || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                  return (
                    <div key={learner.userId} className={`flex items-center gap-3 p-3 rounded-xl ${rc.bg} border ${rc.border} transition-all hover:shadow-sm`}>
                      {/* Rank Icon */}
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${rc.badge} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        {idx === 0 ? (
                          <FontAwesomeIcon icon={faCrown} className="text-white text-xs" />
                        ) : (
                          <span className="text-white text-[10px] font-bold">{idx + 1}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold" style={{ background: brandTheme.gradients.primary }}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{learner.userName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                            {learner.timeHours}h
                          </span>
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <FontAwesomeIcon icon={faBookOpen} className="text-[9px]" />
                            {learner.totalLecturesCompleted}
                          </span>
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <FontAwesomeIcon icon={faFlask} className="text-[9px]" />
                            {learner.totalQuizzesCompleted + learner.totalExercisesCompleted}
                          </span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${rc.text}`}>{learner.compositeScore}</p>
                        <p className="text-[10px] text-gray-400">pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Achievements / Badges */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: brandTheme.gradients.primary }}>
              🏅
            </div>
            <h3 className="text-base font-bold text-gray-800">Achievements</h3>
            {badges.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}>
                  {badges.filter(b => b.earned).length}/{badges.length}
                </span>
                <button onClick={() => setShowBadgesModal(true)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <FontAwesomeIcon icon={faCircleInfo} className="text-gray-400 text-xs" />
                </button>
              </div>
            )}
          </div>
          {badges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <FontAwesomeIcon icon={faSpinner} spin className="text-gray-300 text-xl" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {badges.map(badge => {
                const iconData = BADGE_ICONS[badge.id];
                return (
                  <div key={badge.id} className="flex flex-col items-center group relative">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${badge.earned ? `${iconData?.earnedBg || 'bg-amber-100'} shadow-md shadow-gray-200 ring-2 ring-white` : `${iconData?.unearnedBg || 'bg-gray-100'} opacity-40 grayscale`}`}>
                      {iconData?.emoji || badge.icon}
                    </div>
                    <span className={`text-[10px] mt-1.5 text-center leading-tight font-medium ${badge.earned ? 'text-gray-700' : 'text-gray-400'}`}>
                      {badge.name}
                    </span>
                    {!badge.earned && badge.target > 1 && (
                      <div className="w-full mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(badge.progress / badge.target) * 100}%`, backgroundColor: brandTheme.colors.primary, opacity: 0.6 }} />
                      </div>
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {badge.description}
                      {!badge.earned && badge.target > 1 && ` (${badge.progress}/${badge.target})`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Leaderboard Modal (Slide-in from right) */}
      {showLeaderboardModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] transition-opacity duration-200 opacity-100"
            onClick={() => setShowLeaderboardModal(false)} 
          />

          {/* Panel */}
          <div className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl z-[10001] transition-transform duration-200 ease-out rounded-2xl overflow-hidden translate-x-0">
            <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 rounded-t-2xl" style={{ background: brandTheme.gradients.primary }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrophy} className="text-white text-lg" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Learning Leaderboard</h2>
                    <p className="text-xs text-white/70">{leaderboardTotalCount} students ranked</p>
                  </div>
                </div>
                <button onClick={() => setShowLeaderboardModal(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
              <select
                value={leaderboardClassFilter}
                onChange={e => handleLeaderboardClassChange(e.target.value)}
                className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
              >
                <option value="all">All Classes</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={leaderboardCourseFilter}
                onChange={e => handleLeaderboardCourseChange(e.target.value)}
                className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
              >
                <option value="all">All Courses</option>
                {availableCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleExportLeaderboard}
                disabled={isExporting || leaderboardTotalCount === 0}
                className="flex-shrink-0 h-[38px] px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Export to Excel"
              >
                {isExporting ? (
                  <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                ) : (
                  <FontAwesomeIcon icon={faDownload} className="text-xs" />
                )}
                <span>Export</span>
              </button>
            </div>

            {/* Column Headers */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-12 gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Student</div>
              <div className="col-span-2 text-center">Hours</div>
              <div className="col-span-2 text-center">Lectures</div>
              <div className="col-span-1 text-center">Q</div>
              <div className="col-span-2 text-right">Score</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingLeaderboard ? (
                <div className="flex flex-col items-center justify-center h-60 gap-3">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-gray-300 text-xl" />
                  <p className="text-sm text-gray-400">Loading leaderboard...</p>
                </div>
              ) : leaderboardData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrophy} className="text-gray-200 text-2xl" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">No learning activity yet</p>
                  <p className="text-xs text-gray-300">Students will appear here once they start learning</p>
                </div>
              ) : (
                leaderboardData.map((learner) => {
                  const isCurrentUser = learner.userId === userId;
                  const initials = (learner.userName || '??').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                  const rankColor = learner.rank === 1 ? 'text-amber-500' : learner.rank === 2 ? 'text-slate-400' : learner.rank === 3 ? 'text-orange-400' : 'text-gray-400';
                  const rankBadgeGradient = learner.rank === 1 ? 'from-amber-400 to-yellow-500' : learner.rank === 2 ? 'from-slate-400 to-slate-500' : learner.rank === 3 ? 'from-orange-400 to-orange-500' : '';

                  return (
                    <div
                      key={learner.userId}
                      className={`px-6 py-3.5 grid grid-cols-12 gap-2 items-center border-b border-gray-50 transition-colors ${isCurrentUser ? 'bg-violet-50/50' : 'hover:bg-gray-50/50'}`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex items-center justify-center">
                        {learner.rank <= 3 ? (
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${rankBadgeGradient} flex items-center justify-center shadow-sm`}>
                            {learner.rank === 1 ? (
                              <FontAwesomeIcon icon={faCrown} className="text-white text-xs" />
                            ) : (
                              <span className="text-white text-[10px] font-bold">{learner.rank}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">{learner.rank}</span>
                        )}
                      </div>

                      {/* Student */}
                      <div className="col-span-4 flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-semibold" style={{ background: isCurrentUser ? brandTheme.gradients.primary : `linear-gradient(135deg, #94a3b8, #64748b)` }}>
                          {initials}
                        </div>
                        <p className={`text-sm truncate ${isCurrentUser ? 'font-bold text-violet-700' : 'font-medium text-gray-900'}`}>
                          {learner.userName}{isCurrentUser ? ' (You)' : ''}
                        </p>
                      </div>

                      {/* Hours */}
                      <div className="col-span-2 text-center">
                        <span className="text-sm text-gray-700 font-medium">{learner.timeHours}</span>
                      </div>

                      {/* Lectures */}
                      <div className="col-span-2 text-center">
                        <span className="text-sm text-gray-700 font-medium">{learner.totalLecturesCompleted}</span>
                      </div>

                      {/* Quizzes + Exercises */}
                      <div className="col-span-1 text-center">
                        <span className="text-sm text-gray-700 font-medium">{learner.totalQuizzesCompleted + learner.totalExercisesCompleted}</span>
                      </div>

                      {/* Score */}
                      <div className="col-span-2 text-right">
                        <span className={`text-sm font-bold ${learner.rank <= 3 ? rankColor : 'text-gray-700'}`}>{learner.compositeScore}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {totalLeaderboardPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  Page {leaderboardPage} of {totalLeaderboardPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLeaderboardPageChange(Math.max(1, leaderboardPage - 1))}
                    disabled={leaderboardPage === 1}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                  </button>
                  <button
                    onClick={() => handleLeaderboardPageChange(Math.min(totalLeaderboardPages, leaderboardPage + 1))}
                    disabled={leaderboardPage === totalLeaderboardPages}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </>
      )}

      {/* Badges Info Modal (Slide-in from right) */}
      {showBadgesModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] transition-opacity duration-200 opacity-100"
            onClick={() => setShowBadgesModal(false)} 
          />
          <div className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl z-[10001] transition-transform duration-200 ease-out rounded-2xl overflow-hidden translate-x-0">
            <div className="h-full flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 rounded-t-2xl" style={{ background: brandTheme.gradients.primary }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg">
                    🏅
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Achievements Guide</h2>
                    <p className="text-xs text-white/70">{badges.filter(b => b.earned).length} of {badges.length} earned</p>
                  </div>
                </div>
                <button onClick={() => setShowBadgesModal(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <FontAwesomeIcon icon={faXmark} className="text-white text-sm" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                {badges.map(badge => {
                  const iconData = BADGE_ICONS[badge.id];
                  return (
                  <div key={badge.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${badge.earned ? `${iconData?.earnedBg || 'bg-amber-100'} border-transparent` : 'bg-gray-50/50 border-gray-100'}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${badge.earned ? 'bg-white/60 shadow-sm' : 'bg-gray-100 grayscale opacity-40'}`}>
                      {iconData?.emoji || badge.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm font-semibold ${badge.earned ? 'text-gray-800' : 'text-gray-500'}`}>{badge.name}</h4>
                        {badge.earned && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Earned</span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${badge.earned ? 'text-gray-600' : 'text-gray-400'}`}>{badge.description}</p>
                      {!badge.earned && badge.target > 1 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${(badge.progress / badge.target) * 100}%`, backgroundColor: brandTheme.colors.primary }} />
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">{badge.progress}/{badge.target}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        </>
      )}

      {/* AI Support Assistant */}
      <AISupportAssistant isOpen={showAIAssistant} onClose={() => setShowAIAssistant(false)} userName={currentUser?.displayName?.split(' ')[0] || ''} />
    </div>
  );
};

export default LearningHome;