import React, { useState, useEffect, useMemo } from 'react';
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

const LearningHome: React.FC<LearningHomeProps> = ({ brandTheme, currentUser, selectedCollege, onOpenCourse, onViewAllCourses, onNavigate }) => {
  // Check if user is a student
  const isStudent = currentUser?.userType === 'student';
  const userId = currentUser?.userId || currentUser?.uid || '';
  const collegeId = currentUser?.collegeId || selectedCollege?.id || '';

  // Fetch student learning detail
  const [learningData, setLearningData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

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
    if (!isStudent || !userId) return;
    firebaseService.getStudentDailyLearningLog(userId, activityDays)
      .then(data => setActivityData(data))
      .catch(err => console.error('Error loading activity:', err));
  }, [isStudent, userId, activityDays]);

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
  const adminStats = [
    { label: 'Total Students', value: '1,234', icon: faUsers, color: '#8B5CF6' },
    { label: 'Courses Completed', value: '856', icon: faGraduationCap, color: '#10B981' },
    { label: 'Avg Completion Rate', value: '72%', icon: faChartLine, color: '#3B82F6' },
    { label: 'Total Learning Hours', value: '4,520', icon: faVideo, color: '#F59E0B' },
  ];

  // Use appropriate stats based on user type
  const stats = isStudent ? studentStats : adminStats;

  // Featured courses
  const featuredCourses = [
    { name: 'JEE Advanced Prep', students: 1200, rating: 4.8 },
    { name: 'NEET Biology', students: 980, rating: 4.7 },
    { name: 'Data Structures', students: 750, rating: 4.9 },
  ];

  // Top performing students (for non-students view)
  const topStudents = [
    { name: 'Rahul Sharma', course: 'Python Programming', score: 98, avatar: 'RS' },
    { name: 'Priya Patel', course: 'Data Structures', score: 96, avatar: 'PP' },
    { name: 'Amit Kumar', course: 'Web Development', score: 94, avatar: 'AK' },
  ];

  // Recent student activity (for non-students view)
  const recentStudentActivity = [
    { student: 'Rahul Sharma', action: 'Completed Assessment', course: 'Python Programming', time: '1 hour ago' },
    { student: 'Priya Patel', action: 'Enrolled in course', course: 'Machine Learning', time: '3 hours ago' },
    { student: 'Amit Kumar', action: 'Submitted Assignment', course: 'Data Structures', time: '5 hours ago' },
  ];

  // Quick access items
  const quickAccessItems = [
    { id: 'ai', name: '24x7 AI Based Support', icon: faRobot, menuId: 'ai-interview' },
    { id: 'coding', name: 'Online Coding Lab', icon: faCode, menuId: 'codinglab' },
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
      <div className="mx-6 mb-6 grid grid-cols-4 gap-4">
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
                <h3 className="text-lg font-bold text-gray-900">Top Performing Students</h3>
              </div>
              <div className="space-y-4">
                {topStudents.map((student, idx) => (
                  <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ background: brandTheme.gradients.primary }}>
                      {student.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{student.name}</p>
                      <p className="text-xs text-gray-500 truncate">{student.course}</p>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <FontAwesomeIcon icon={faTrophy} className="text-yellow-500 text-xs" />
                      <span className="text-sm font-bold" style={{ color: brandTheme.colors.primary }}>{student.score}%</span>
                    </div>
                  </div>
                ))}
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
                <h3 className="text-lg font-bold text-gray-900">Recent Student Activity</h3>
                <button className="text-sm font-medium flex items-center space-x-1" style={{ color: brandTheme.colors.primary }}>
                  <span>View All</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </button>
              </div>
              <div className="space-y-4">
                {recentStudentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}15 0%, ${brandTheme.colors.secondary}15 100%)` }}>
                      <FontAwesomeIcon icon={faUsers} style={{ color: brandTheme.colors.primary }} className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{activity.student}</p>
                      <p className="text-xs text-gray-500 truncate">{activity.action} • {activity.course}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{activity.time}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Featured Courses */}
      <div className="mx-6 mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Featured Courses</h3>
          <button onClick={onViewAllCourses} className="text-sm font-medium flex items-center space-x-1" style={{ color: brandTheme.colors.primary }}>
            <span>Browse All</span>
            <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {featuredCourses.map((course, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-full h-24 rounded-lg mb-3 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}20 0%, ${brandTheme.colors.secondary}30 100%)` }}>
                <FontAwesomeIcon icon={faGraduationCap} style={{ color: brandTheme.colors.primary }} className="text-3xl" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{course.name}</h4>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <FontAwesomeIcon icon={faUsers} />
                  <span>{course.students}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span>⭐</span>
                  <span>{course.rating}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Support Assistant */}
      <AISupportAssistant isOpen={showAIAssistant} onClose={() => setShowAIAssistant(false)} userName={currentUser?.displayName?.split(' ')[0] || ''} />
    </div>
  );
};

export default LearningHome;