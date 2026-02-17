import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faComments,
  faCircleCheck,
  faBookOpen,
  faBolt,
  faLock,
  faCircleInfo,
  faCirclePlay,
  faClock,
  faCheck,
  faSpinner,
  faChartColumn,
  faLockKeyhole,
  faChevronDown,
  faCircleXmark,
  faMessageLines,
  faChevronLeft,
  faChevronRight,
  faChevronsLeft,
  faChevronsRight,
  faRobot,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import AIInterviewChat from './AIInterviewChat';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CourseForInterview {
  id: string;
  courseId: number;
  enrollmentId: string;
  name: string;
  slug: string;
  thumbnailUrl?: string;
  totalVideos: number;
  watchedVideos: number;
  isCompleted: boolean;
  avatarColor: string;
  avatarLetter: string;
  interviewsPracticed: number;
  bestScore: number | null;
  topicsContext: string[]; // lecture titles for AI context
}

interface RecentInterview {
  id: string;
  courseId: number;
  courseName: string;
  courseThumbnail?: string;
  avatarColor: string;
  avatarLetter: string;
  date: string;
  questions: number;
  score: number;
  correctAnswers: number;
  status: string;
  terminatedAtGate?: number;
  feedback?: any;
}

interface AIInterviewPracticeProps {
  brandTheme: {
    colors: { primary: string; secondary: string };
    gradients: { primary: string };
  };
  currentUser: any;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_VIDEOS_FOR_UNLOCK = 3;

const AVATAR_COLORS: Record<string, { bg: string }> = {
  green:  { bg: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  blue:   { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  orange: { bg: 'linear-gradient(135deg, #f97316, #ea580c)' },
  purple: { bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  red:    { bg: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  teal:   { bg: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
  pink:   { bg: 'linear-gradient(135deg, #ec4899, #db2777)' },
  indigo: { bg: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  amber:  { bg: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  cyan:   { bg: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
};

const COLOR_KEYS = Object.keys(AVATAR_COLORS);

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_KEYS[Math.abs(hash) % COLOR_KEYS.length];
};

const formatTimeAgo = (date: Date | null): string => {
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
  if (diffHours < 24) {
    const isToday = now.toDateString() === date.toDateString();
    return isToday ? `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'Yesterday';
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Component ───────────────────────────────────────────────────────────────

const AIInterviewPractice: React.FC<AIInterviewPracticeProps> = ({
  brandTheme,
  currentUser,
}) => {
  const [courses, setCourses] = useState<CourseForInterview[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<RecentInterview[]>([]);
  const [stats, setStats] = useState({ totalInterviews: 0, avgScore: 0, thisMonthCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedInterviewId, setExpandedInterviewId] = useState<string | null>(null);

  // Interview history pagination
  const [interviewPage, setInterviewPage] = useState(1);
  const [interviewTotalCount, setInterviewTotalCount] = useState(0);
  const [interviewPageCache, setInterviewPageCache] = useState<Map<number, { interviews: RecentInterview[]; lastDoc: any }>>(new Map());
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);
  const interviewsPerPage = 5;

  // Interview chat modal state
  const [interviewChatOpen, setInterviewChatOpen] = useState(false);
  const [selectedCourseForInterview, setSelectedCourseForInterview] = useState<CourseForInterview | null>(null);

  const userId = currentUser?.uid || currentUser?.userId || '';
  const collegeId = currentUser?.collegeId || '';
  const userName = currentUser?.fullName || currentUser?.name || currentUser?.displayName || '';

  // ─── Fetch Data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // Fetch enrollments and interview stats in parallel
      const [enrollments, interviewStats] = await Promise.all([
        firebaseService.getStudentCourseEnrollmentsForInterview(userId),
        firebaseService.getStudentAIInterviewStats(userId),
      ]);

      // Transform enrollments into CourseForInterview
      const transformedCourses: CourseForInterview[] = enrollments.map(enrollment => {
        const lectures = enrollment.progress?.lectures || {};
        const completedLectures = enrollment.progress?.completedLectures || [];

        // Count watched videos+text lectures:
        // A lecture counts as "watched" if it appears in completedLectures OR has been accessed
        // and its type is video or text
        const accessedLectureIds = new Set<string>();

        // From completedLectures array
        completedLectures.forEach((id: string | number) => accessedLectureIds.add(String(id)));

        // From lectures map — count video and text types that have been accessed
        Object.entries(lectures).forEach(([lectureId, lectureData]: [string, any]) => {
          if (lectureData.type === 'video' || lectureData.type === 'text') {
            accessedLectureIds.add(lectureId);
          }
        });

        const watchedCount = accessedLectureIds.size;
        const name = enrollment.courseName || `Course ${enrollment.courseId}`;
        const courseStats = interviewStats.courseStats[enrollment.courseId];

        // Gather topics context (lecture titles the student has studied)
        const topicsContext: string[] = [];
        Object.values(lectures).forEach((l: any) => {
          if (l.title) topicsContext.push(l.title);
        });

        return {
          id: enrollment.enrollmentId,
          courseId: enrollment.courseId,
          enrollmentId: enrollment.enrollmentId,
          name,
          slug: enrollment.slug || '',
          thumbnailUrl: enrollment.thumbnailUrl,
          totalVideos: enrollment.totalLectures || 0,
          watchedVideos: watchedCount,
          isCompleted: (enrollment.progress?.percentage || 0) >= 100,
          avatarColor: getAvatarColor(name),
          avatarLetter: name.charAt(0).toUpperCase(),
          interviewsPracticed: courseStats?.practiced || 0,
          bestScore: courseStats?.bestScore ?? null,
          topicsContext,
        };
      });

      setCourses(transformedCourses);

      // Stats
      setStats({
        totalInterviews: interviewStats.totalInterviews,
        avgScore: interviewStats.avgScore,
        thisMonthCount: interviewStats.thisMonthCount,
      });

    } catch (error) {
      console.error('Error fetching AI Interview data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // ─── Paginated Interview Fetch ──────────────────────────────────────────────

  // Build a courseId → thumbnail map from enrolled courses
  const courseThumbnailMap = useMemo(() => {
    const map: Record<number, string> = {};
    courses.forEach(c => {
      if (c.thumbnailUrl) map[c.courseId] = c.thumbnailUrl;
    });
    return map;
  }, [courses]);

  const transformInterview = useCallback((ri: any): RecentInterview => {
    const cName = ri.courseName || `Course ${ri.courseId}`;
    const createdAt = ri.createdAt?.toDate?.() || (ri.createdAt?.__time__ ? new Date(ri.createdAt.__time__) : (ri.createdAt instanceof Date ? ri.createdAt : null));
    return {
      id: ri.id,
      courseId: ri.courseId,
      courseName: cName,
      courseThumbnail: courseThumbnailMap[ri.courseId] || undefined,
      avatarColor: getAvatarColor(cName),
      avatarLetter: cName.charAt(0).toUpperCase(),
      date: formatTimeAgo(createdAt),
      questions: ri.totalQuestions || 0,
      score: ri.score || 0,
      correctAnswers: ri.correctAnswers || 0,
      status: ri.status || 'completed',
      terminatedAtGate: ri.terminatedAtGate,
      feedback: ri.feedback || null,
    };
  }, [courseThumbnailMap]);

  const fetchInterviewPage = useCallback(async (page: number) => {
    if (!userId) return;

    // Check cache
    const cached = interviewPageCache.get(page);
    if (cached) {
      setRecentInterviews(cached.interviews);

      return;
    }

    setIsLoadingInterviews(true);
    try {
      // For page > 1, use the lastDoc from previous page
      const prevPageData = interviewPageCache.get(page - 1);
      const startAfterDoc = page > 1 ? prevPageData?.lastDoc : undefined;

      const result = await firebaseService.getStudentAIInterviewsPaginated({
        userId,
        limitCount: interviewsPerPage,
        startAfterDoc,
      });

      setInterviewTotalCount(result.totalCount);
      const formatted = result.interviews.map(transformInterview);
      setRecentInterviews(formatted);


      // Cache
      setInterviewPageCache(prev => new Map(prev).set(page, { interviews: formatted, lastDoc: result.lastDoc }));
    } catch (error) {
      console.error('Error fetching interview page:', error);
    } finally {
      setIsLoadingInterviews(false);
    }
  }, [userId, interviewPageCache, interviewsPerPage, transformInterview]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch interview page when page changes or after initial load
  useEffect(() => {
    if (!isLoading && userId) {
      fetchInterviewPage(interviewPage);
    }
  }, [interviewPage, isLoading, userId, fetchInterviewPage]);

  // Clear cache when courses load (so thumbnails get picked up)
  useEffect(() => {
    if (courses.length > 0 && interviewPageCache.size > 0) {
      setInterviewPageCache(new Map());
    }
  }, [courseThumbnailMap]);

  // Split into eligible and locked
  const { eligible, locked } = useMemo(() => {
    const e: CourseForInterview[] = [];
    const l: CourseForInterview[] = [];
    courses.forEach(c => {
      if (c.watchedVideos >= MIN_VIDEOS_FOR_UNLOCK) e.push(c);
      else l.push(c);
    });
    return { eligible: e, locked: l };
  }, [courses]);

  // Handle start interview
  const handleStartInterview = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourseForInterview(course);
      setInterviewChatOpen(true);
    }
  };

  const handleInterviewComplete = () => {
    setInterviewPageCache(new Map());
    setInterviewPage(1);
    fetchData();
  };

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center" style={{ background: '#f5f7fa' }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="text-3xl text-purple-500 animate-spin mb-3" />
          <p className="text-sm text-gray-500">Loading AI Interview Practice...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto" style={{ background: '#f5f7fa' }}>
        <div className="max-w-[1000px] mx-auto p-6 pb-10">

          {/* ── Page Header ──────────────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-7">
            <div className="flex items-center gap-3.5">
              <div
                className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}
              >
                <FontAwesomeIcon icon={faComments} className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight">AI Interview Practice</h1>
                <p className="text-sm text-gray-500 mt-0.5">Practice interviews based on your course progress</p>
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(124,58,237,0.05))',
                border: '1px solid rgba(139,92,246,0.2)',
                color: '#7c3aed',
              }}
            >
              <FontAwesomeIcon icon={faRobot} className="text-sm" />
              AI Powered
            </div>
          </div>

          {/* ── Stats Row ────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4 mb-7 max-[768px]:grid-cols-2">
            {[
              { icon: faComments, value: stats.totalInterviews, label: 'Total Interviews', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
              { icon: faCircleCheck, value: stats.avgScore > 0 ? `${stats.avgScore}%` : '0%', label: 'Avg. Score', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
              { icon: faBookOpen, value: eligible.length, label: 'Eligible Courses', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
              { icon: faBolt, value: stats.thisMonthCount, label: 'This Month', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-[14px] p-[18px] text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
                <div
                  className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center mx-auto mb-2.5"
                  style={{ background: stat.gradient }}
                >
                  <FontAwesomeIcon icon={stat.icon} className="text-white text-base" />
                </div>
                <div className="text-[28px] font-extrabold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-xs font-medium text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ── Info Banner ──────────────────────────────────────── */}
          <div
            className="flex items-start gap-3.5 px-5 py-4 rounded-xl mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.05))',
              borderLeft: '4px solid #3b82f6',
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
            >
              <FontAwesomeIcon icon={faCircleInfo} className="text-white text-sm" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">How AI Interview Works</h4>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Complete at least <strong className="text-gray-700">3 videos</strong> in any course to unlock AI interview practice. Our AI will ask you relevant questions based on what you've learned and provide instant feedback.
              </p>
            </div>
          </div>

          {/* ── Ready for Interview ─────────────────────────────── */}
          {eligible.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-5">
              <div className="flex items-center gap-2.5 mb-5">
                <FontAwesomeIcon icon={faCircleCheck} className="text-xl text-green-500" />
                <h2 className="text-base font-bold text-gray-900">Ready for Interview</h2>
                <span className="text-[13px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{eligible.length} courses</span>
              </div>
              <div className="flex flex-col gap-3">
                {eligible.map(course => (
                  <CourseInterviewCard key={course.id} course={course} onStart={handleStartInterview} />
                ))}
              </div>
            </div>
          )}

          {/* ── Locked Courses ──────────────────────────────────── */}
          {locked.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-5">
              <div className="flex items-center gap-2.5 mb-5">
                <FontAwesomeIcon icon={faLockKeyhole} className="text-xl text-gray-400" />
                <h2 className="text-base font-bold text-gray-900">Complete More to Unlock</h2>
                <span className="text-[13px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{locked.length} courses</span>
              </div>
              <div className="flex flex-col gap-3">
                {locked.map(course => (
                  <LockedCourseCard key={course.id} course={course} />
                ))}
              </div>
            </div>
          )}

          {/* ── Interview History ───────────────────────────────── */}
          {(recentInterviews.length > 0 || interviewTotalCount > 0) && (
            <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2.5 mb-5">
                <FontAwesomeIcon icon={faChartColumn} className="text-xl text-purple-500" />
                <h2 className="text-base font-bold text-gray-900">Interview History</h2>
                <span className="text-[13px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{interviewTotalCount}</span>
              </div>

              {isLoadingInterviews ? (
                <div className="flex items-center justify-center py-8">
                  <FontAwesomeIcon icon={faSpinner} className="text-xl text-purple-400 animate-spin" />
                </div>
              ) : (
              <div className="flex flex-col gap-3">
                {recentInterviews.map(r => {
                  const isExpanded = expandedInterviewId === r.id;
                  const scoreColor = r.score >= 80 ? 'text-green-600' : r.score >= 50 ? 'text-yellow-600' : 'text-red-500';
                  const scoreBg = r.score >= 80 ? 'bg-green-50' : r.score >= 50 ? 'bg-yellow-50' : 'bg-red-50';
                  const accuracy = r.questions > 0 ? Math.round((r.correctAnswers / r.questions) * 100) : 0;

                  return (
                    <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 hover:border-purple-300">
                      {/* Clickable header row */}
                      <button
                        onClick={() => setExpandedInterviewId(isExpanded ? null : r.id)}
                        className="w-full flex items-center gap-3 p-3.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border-none text-left"
                      >
                        <div
                          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
                          style={!r.courseThumbnail ? { background: AVATAR_COLORS[r.avatarColor]?.bg || AVATAR_COLORS.blue.bg } : {}}
                        >
                          {r.courseThumbnail ? (
                            <img src={r.courseThumbnail} alt={r.courseName} className="w-full h-full object-cover" />
                          ) : (
                            r.avatarLetter
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-gray-900 mb-0.5 truncate">{r.courseName}</div>
                          <div className="flex items-center gap-2.5 text-[11px] text-gray-500">
                            <span>{r.date}</span>
                            <span>•</span>
                            <span>{r.questions} Qs</span>
                            <span>•</span>
                            <span>{r.correctAnswers}/{r.questions} correct</span>
                          </div>
                        </div>
                        <div className={`text-base font-bold ${scoreColor} mr-2`}>{r.score}%</div>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`text-xs text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-3 bg-white border-t border-gray-100">
                          {/* Score breakdown */}
                          <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className={`text-center p-3 rounded-lg ${scoreBg}`}>
                              <div className={`text-base font-bold ${scoreColor}`}>{r.score}%</div>
                              <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5 font-medium">Score</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-blue-50">
                              <div className="text-base font-bold text-blue-600">{r.questions}</div>
                              <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5 font-medium">Questions</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-green-50">
                              <div className="text-base font-bold text-green-600">{r.correctAnswers}</div>
                              <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5 font-medium">Correct</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-purple-50">
                              <div className="text-base font-bold text-purple-600">{accuracy}%</div>
                              <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5 font-medium">Accuracy</div>
                            </div>
                          </div>

                          {/* Status badge */}
                          <div className="flex items-center gap-2 mb-3">
                            {r.status === 'completed' ? (
                              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-600">
                                <FontAwesomeIcon icon={faCircleCheck} className="text-[10px]" /> Completed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-500">
                                <FontAwesomeIcon icon={faCircleXmark} className="text-[10px]" /> Terminated at Gate {r.terminatedAtGate || '?'}
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400">{r.date}</span>
                          </div>

                          {/* Feedback */}
                          {r.feedback && (
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                              <div className="flex items-center gap-1.5 mb-3">
                                <FontAwesomeIcon icon={faMessageLines} className="text-xs text-purple-500" />
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">AI Feedback</span>
                              </div>
                              {typeof r.feedback === 'string' ? (
                                <p className="text-[13px] text-gray-600 leading-relaxed">{r.feedback}</p>
                              ) : (
                                <div className="space-y-3">
                                  {(r.feedback as any).overallSummary && (
                                    <p className="text-[13px] text-gray-700 leading-[1.6]">{(r.feedback as any).overallSummary}</p>
                                  )}
                                  {(r.feedback as any).performanceLevel && (
                                    <span className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 uppercase tracking-wider">
                                      {(r.feedback as any).performanceLevel}
                                    </span>
                                  )}
                                  {(r.feedback as any).strengths?.length > 0 && (
                                    <div>
                                      <span className="text-[11px] font-bold text-green-600 uppercase tracking-wider">Strengths: </span>
                                      <span className="text-[12px] text-gray-600 leading-[1.5]">{(r.feedback as any).strengths.join(', ')}</span>
                                    </div>
                                  )}
                                  {(r.feedback as any).weaknesses?.length > 0 && (
                                    <div>
                                      <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Improve: </span>
                                      <span className="text-[12px] text-gray-600 leading-[1.5]">{(r.feedback as any).weaknesses.join(', ')}</span>
                                    </div>
                                  )}
                                  {(r.feedback as any).topicsToReview?.length > 0 && (
                                    <div>
                                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Review: </span>
                                      <span className="text-[12px] text-gray-600 leading-[1.5]">{(r.feedback as any).topicsToReview.join(', ')}</span>
                                    </div>
                                  )}
                                  {(r.feedback as any).motivationalMessage && (
                                    <p className="text-[12px] text-gray-400 italic mt-1 leading-[1.5]">{(r.feedback as any).motivationalMessage}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Performance bar */}
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">
                              <span>Performance</span>
                              <span>{r.score}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${r.score}%`,
                                  background: r.score >= 80 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : r.score >= 50 ? 'linear-gradient(90deg, #eab308, #ca8a04)' : 'linear-gradient(90deg, #ef4444, #dc2626)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}

              {/* Pagination */}
              {interviewTotalCount > interviewsPerPage && (
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                  <span className="text-[12px] text-gray-400 font-medium">
                    Showing {((interviewPage - 1) * interviewsPerPage) + 1}–{Math.min(interviewPage * interviewsPerPage, interviewTotalCount)} of {interviewTotalCount}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setInterviewPage(1); setExpandedInterviewId(null); }}
                      disabled={interviewPage === 1}
                      className="w-8 h-8 rounded-lg text-[11px] font-medium border border-gray-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      <FontAwesomeIcon icon={faChevronsLeft} className="text-[10px] text-gray-500" />
                    </button>
                    <button
                      onClick={() => { setInterviewPage(p => Math.max(1, p - 1)); setExpandedInterviewId(null); }}
                      disabled={interviewPage === 1}
                      className="w-8 h-8 rounded-lg text-[11px] font-medium border border-gray-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="text-[10px] text-gray-500" />
                    </button>
                    {(() => {
                      const totalPages = Math.ceil(interviewTotalCount / interviewsPerPage);
                      const pages: (number | string)[] = [];
                      for (let i = 1; i <= totalPages; i++) {
                        if (i === 1 || i === totalPages || (i >= interviewPage - 1 && i <= interviewPage + 1)) {
                          pages.push(i);
                        } else if (pages[pages.length - 1] !== '...') {
                          pages.push('...');
                        }
                      }
                      return pages.map((p, idx) =>
                        typeof p === 'string' ? (
                          <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-[11px] text-gray-400">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => { setInterviewPage(p); setExpandedInterviewId(null); }}
                            className={`w-8 h-8 rounded-lg text-[12px] font-semibold flex items-center justify-center transition-colors ${
                              p === interviewPage
                                ? 'text-white shadow-sm'
                                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                            style={p === interviewPage ? { background: brandTheme.gradients.primary } : {}}
                          >
                            {p}
                          </button>
                        )
                      );
                    })()}
                    <button
                      onClick={() => { setInterviewPage(p => Math.min(Math.ceil(interviewTotalCount / interviewsPerPage), p + 1)); setExpandedInterviewId(null); }}
                      disabled={interviewPage >= Math.ceil(interviewTotalCount / interviewsPerPage)}
                      className="w-8 h-8 rounded-lg text-[11px] font-medium border border-gray-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-gray-500" />
                    </button>
                    <button
                      onClick={() => { setInterviewPage(Math.ceil(interviewTotalCount / interviewsPerPage)); setExpandedInterviewId(null); }}
                      disabled={interviewPage >= Math.ceil(interviewTotalCount / interviewsPerPage)}
                      className="w-8 h-8 rounded-lg text-[11px] font-medium border border-gray-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      <FontAwesomeIcon icon={faChevronsRight} className="text-[10px] text-gray-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────── */}
          {courses.length === 0 && (
            <div className="bg-white rounded-2xl p-10 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FontAwesomeIcon icon={faComments} className="text-3xl text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-2">No Courses Enrolled</h3>
              <p className="text-sm text-gray-500 max-w-[300px] mx-auto">
                Enroll in a course and watch at least 3 videos to unlock AI interview practice.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Interview Chat Modal ─────────────────────────────── */}
      {selectedCourseForInterview && (
        <AIInterviewChat
          isOpen={interviewChatOpen}
          onClose={() => {
            setInterviewChatOpen(false);
            setSelectedCourseForInterview(null);
          }}
          courseId={selectedCourseForInterview.courseId}
          courseSlug={selectedCourseForInterview.slug}
          courseName={selectedCourseForInterview.name}
          enrollmentId={selectedCourseForInterview.enrollmentId}
          topicsContext={selectedCourseForInterview.topicsContext}
          userId={userId}
          collegeId={collegeId}
          userName={userName}
          brandTheme={brandTheme}
          onInterviewComplete={handleInterviewComplete}
        />
      )}
    </>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const CourseInterviewCard: React.FC<{ course: CourseForInterview; onStart: (id: string) => void }> = ({ course, onStart }) => {
  const progressPct = course.totalVideos > 0 ? Math.round((course.watchedVideos / course.totalVideos) * 100) : 0;

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 transition-all duration-200 hover:border-purple-500 hover:bg-white hover:shadow-[0_4px_12px_rgba(139,92,246,0.1)] max-[640px]:flex-wrap">
      <div
        className="w-12 h-12 rounded-[10px] flex items-center justify-center text-lg font-bold text-white flex-shrink-0 overflow-hidden"
        style={!course.thumbnailUrl ? { background: AVATAR_COLORS[course.avatarColor]?.bg || AVATAR_COLORS.blue.bg } : {}}
      >
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt={course.name} className="w-full h-full object-cover" />
        ) : (
          course.avatarLetter
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-gray-900 mb-1.5 truncate">{course.name}</div>
        <div className="flex items-center gap-3 flex-wrap">
          {course.isCompleted ? (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600">
              <FontAwesomeIcon icon={faCheck} className="text-[10px]" /> Completed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
              <FontAwesomeIcon icon={faClock} className="text-[10px]" /> In Progress
            </span>
          )}
          {!course.isCompleted && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #3b82f6, #2563eb)' }} />
              </div>
              {course.watchedVideos}/{course.totalVideos} Videos
            </div>
          )}
          {course.isCompleted && (
            <span className="text-xs text-gray-500">{course.watchedVideos}/{course.totalVideos} Videos</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{course.interviewsPracticed}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Practiced</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{course.bestScore !== null ? `${course.bestScore}%` : '--'}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Best Score</div>
        </div>
      </div>
      <button
        onClick={() => onStart(course.id)}
        className="flex items-center gap-2 px-5 py-3 text-white text-[13px] font-semibold rounded-[10px] border-none cursor-pointer whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(139,92,246,0.35)]"
        style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
      >
        <FontAwesomeIcon icon={faCirclePlay} className="text-base" />
        Start Interview
      </button>
    </div>
  );
};

const LockedCourseCard: React.FC<{ course: CourseForInterview }> = ({ course }) => {
  const progressPct = course.totalVideos > 0 ? Math.round((course.watchedVideos / course.totalVideos) * 100) : 0;
  const videosNeeded = MIN_VIDEOS_FOR_UNLOCK - course.watchedVideos;

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 opacity-70 max-[640px]:flex-wrap">
      <div
        className="w-12 h-12 rounded-[10px] flex items-center justify-center text-lg font-bold text-white flex-shrink-0 overflow-hidden"
        style={!course.thumbnailUrl ? { background: AVATAR_COLORS[course.avatarColor]?.bg || AVATAR_COLORS.purple.bg } : {}}
      >
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt={course.name} className="w-full h-full object-cover" />
        ) : (
          course.avatarLetter
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-gray-900 mb-1.5 truncate">{course.name}</div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
            <FontAwesomeIcon icon={faClock} className="text-[10px]" /> In Progress
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #3b82f6, #2563eb)' }} />
            </div>
            {course.watchedVideos}/{course.totalVideos} Videos
          </div>
          {videosNeeded > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}>
              <FontAwesomeIcon icon={faCircleInfo} className="text-[10px]" />
              Complete {videosNeeded} more video{videosNeeded > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <button className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-400 text-[13px] font-semibold rounded-[10px] border-none cursor-not-allowed">
        <FontAwesomeIcon icon={faLock} className="text-sm" /> Locked
      </button>
    </div>
  );
};

export default AIInterviewPractice;