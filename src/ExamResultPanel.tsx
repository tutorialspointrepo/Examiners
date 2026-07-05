// =============================================================================
// ExamResultPanel.tsx
// Self-contained "Exam Result" view = Dashboard stats (top) + student result
// cards (below), for one selected exam. Logic copied from ExamDashboard.tsx and
// Result.tsx so those two files can be removed later. No imports from them.
//
// Data source: firebaseService.getExamDashboardData(examId) → { presentStudents,
// absentStudents, totalStudents }. Each student: { studentName, rollNumber,
// hasAttempt, attemptData:{ percentage, obtainedMarks, timeSpent, responses,
// attemptedQuestions, totalQuestions, violationCount } }.
//
// Clicking a student card fires onStudentSelect(student) — the parent renders
// the detail (e.g. StudentExamDetail) however it likes.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser, faClipboardList, faAward, faClock, faTrophy,
  faCircleCheck, faTriangleExclamation, faSpinner, faChartBar, faChevronDown,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { exportStyledDashboardBrowser } from './exportStyledDashboard';

interface ExamResultPanelProps {
  selectedExam: any;
  brandTheme: any;
  currentUserType?: string;
  onStudentSelect?: (student: any) => void;
}

// ── Helpers (ported verbatim from Result.tsx / ExamDashboard.tsx) ────────────
function getTotalMarks(exam: any): number {
  if (exam?.maxMarks) {
    const marks = parseFloat(exam.maxMarks);
    if (!isNaN(marks) && marks > 0) return marks;
  }
  if (exam?.questionsList && exam.questionsList.length > 0) {
    return exam.questionsList.reduce((total: number, q: any) => total + (q.maximumMarks || q.marks || 0), 0);
  }
  return 0;
}

function getQuestionCount(exam: any): number | string {
  if (exam?.totalQuestions && exam.totalQuestions > 0) return exam.totalQuestions;
  return '-';
}

function formatTimeSpent(seconds: number): string {
  if (!seconds || seconds === 0) return '0m 0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function isAnswered(r: any): boolean {
  const ans = r?.studentAnswer;
  if (ans === undefined || ans === null || ans === '') return false;
  if (Array.isArray(ans)) return ans.length > 0;
  return true;
}

function getAttemptedCount(attemptData: any): number {
  const responses = attemptData?.responses;
  if (responses) {
    const responsesArray = Array.isArray(responses) ? responses : Object.values(responses);
    if (responsesArray.length > 0) return responsesArray.filter(isAnswered).length;
  }
  if (typeof attemptData?.attemptedQuestions === 'number') return attemptData.attemptedQuestions;
  return 0;
}

export default function ExamResultPanel({ selectedExam, brandTheme, currentUserType, onStudentSelect }: ExamResultPanelProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const PAGE_SIZE = 5;
  void currentUserType; // reserved for future per-role rendering; App passes it

  const examId = selectedExam?.examId || selectedExam?.id;
  const primary = brandTheme?.colors?.primary || '#4F46E5';

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!examId) { setLoading(false); return; }
      try {
        setLoading(true);
        setError(null);
        const data = await firebaseService.getExamDashboardData(examId);
        if (alive) { setDashboardData(data); setPage(1); }
      } catch (err) {
        console.error('❌ [ExamResultPanel] load error:', err);
        if (alive) setError('Failed to load results');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [examId]);

  // Server-side search (debounced) — queries getExamStudentsPaginated with searchQuery.
  useEffect(() => {
    if (!examId) return;
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); return; }
    let alive = true;
    const t = window.setTimeout(async () => {
      try {
        const res: any = await firebaseService.getExamStudentsPaginated(examId, { page: 1, pageSize: 200, filter: 'all', searchQuery: q });
        if (alive) {
          const present = Array.isArray(res?.present) ? res.present : [];
          const absent = Array.isArray(res?.absent) ? res.absent.map((s: any) => ({ ...s, hasAttempt: false })) : [];
          setSearchResults([...present, ...absent]);
          setPage(1);
        }
      } catch (err) {
        console.error('❌ [ExamResultPanel] search error:', err);
        if (alive) setSearchResults([]);
      }
    }, 600);
    return () => { alive = false; window.clearTimeout(t); };
  }, [searchQuery, examId]);

  // Report export — same logic as ExamDashboard's "Export Report".
  const handleExportReport = async () => {
    if (isExportingReport) return;
    try {
      setIsExportingReport(true);
      if (!examId) { alert('No exam selected'); return; }
      const fullExamData = await firebaseService.getExamWithQuestionDetails(examId);
      const dd = await firebaseService.getExamDashboardData(examId);
      await exportStyledDashboardBrowser({
        selectedExam: fullExamData,
        brandTheme,
        presentStudents: dd.presentStudents,
        absentStudents: dd.absentStudents,
        totalStudents: dd.totalStudents,
      });
      try {
        const currentUser = await firebaseService.getCurrentUserProfile();
        if (currentUser) {
          await firebaseService.addActivityLog({
            userId: currentUser.userId,
            collegeId: selectedExam.collegeId || currentUser.collegeId,
            action: 'download_student_performance',
            entityType: 'report_download',
            entityId: examId,
            details: JSON.stringify({ reportType: 'student_performance', examTitle: selectedExam.title, format: 'PDF', studentsIncluded: dd.presentStudents.length }),
          });
        }
      } catch (logError) { console.warn('⚠️ [ExamResultPanel] log failed:', logError); }
    } catch (error) {
      console.error('❌ [ExamResultPanel] export error:', error);
      alert('Export failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExportingReport(false);
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return primary;
    if (percentage >= 75) return '#3b82f6';
    if (percentage >= 60) return '#f59e0b';
    if (percentage >= 40) return '#f97316';
    return '#ef4444';
  };

  const presentStudents: any[] = dashboardData?.presentStudents || [];
  const absentStudents: any[] = dashboardData?.absentStudents || [];
  const totalStudents: number = dashboardData?.totalStudents ?? (presentStudents.length + absentStudents.length);
  const totalPresentCount = presentStudents.length;
  const totalAbsentCount = absentStudents.length;

  const submitted = presentStudents.filter((s) => s.hasAttempt && s.attemptData);
  const submittedCount = submitted.length;
  const avgScore = submittedCount > 0 ? submitted.reduce((sum, s) => sum + (s.attemptData?.percentage || 0), 0) / submittedCount : 0;
  const highestScore = submittedCount > 0 ? Math.max(...submitted.map((s) => s.attemptData?.percentage || 0)) : 0;
  const passedCount = submitted.filter((s) => (s.attemptData?.percentage || 0) >= 40).length;
  const passRate = submittedCount > 0 ? Math.round((passedCount / submittedCount) * 100) : 0;
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresentCount / totalStudents) * 100) : 0;

  // Performance distribution (from submitted students)
  const dExcellent = submitted.filter((s) => (s.attemptData?.percentage || 0) >= 90).length;
  const dGood = submitted.filter((s) => { const p = s.attemptData?.percentage || 0; return p >= 75 && p < 90; }).length;
  const dAverage = submitted.filter((s) => { const p = s.attemptData?.percentage || 0; return p >= 60 && p < 75; }).length;
  const dPoor = submitted.filter((s) => (s.attemptData?.percentage || 0) < 60).length;
  const distTotal = submitted.length || 1;
  const distRows = [
    { label: 'Excellent (90–100%)', count: dExcellent, color: '#22c55e', tcls: 'text-green-600' },
    { label: 'Good (75–89%)', count: dGood, color: '#3b82f6', tcls: 'text-blue-600' },
    { label: 'Average (60–74%)', count: dAverage, color: '#f59e0b', tcls: 'text-amber-600' },
    { label: 'Needs Improvement (<60%)', count: dPoor, color: '#ef4444', tcls: 'text-red-600' },
  ];

  // Violations summary
  const totalViolations = submitted.reduce((sum, s) => sum + (s.attemptData?.violationCount || 0), 0);
  const studentsFlagged = submitted.filter((s) => (s.attemptData?.violationCount || 0) > 0).length;
  const cleanExams = submitted.length - studentsFlagged;
  const avgViolations = submitted.length > 0 ? (totalViolations / submitted.length).toFixed(1) : '0';

  // Combined list + client-side pagination (all students already loaded via getExamDashboardData)
  const allStudents = [...presentStudents, ...absentStudents.map((s) => ({ ...s, hasAttempt: false }))];
  const isSearching = searchQuery.trim().length > 0;
  const listStudents = isSearching ? (searchResults || []) : allStudents;
  const totalCount = listStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStudents = listStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Loading / error / empty states ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: `${primary}20`, borderTopColor: primary }} />
          <p className="text-sm font-medium text-gray-500">Loading results...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 28 }} className="text-red-400 mb-3" />
          <p className="text-gray-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // ── Stat card ───────────────────────────────────────────────────────────────
  // ── Donut ring (hero) ────────────────────────────────────────────────────────
  const Donut: React.FC<{ pct: number; color: string }> = ({ pct, color }) => {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    return (
      <svg width="72" height="72" viewBox="0 0 42 42" className="flex-none">
        <circle cx="21" cy="21" r="16" fill="none" stroke="#eef1f5" strokeWidth="3.5" />
        <circle cx="21" cy="21" r="16" fill="none" stroke={color} strokeWidth="3.5" pathLength={100} strokeDasharray={`${p} 100`} strokeLinecap="round" transform="rotate(-90 21 21)" />
        <text x="21" y="24" textAnchor="middle" fontSize="9" fontWeight={700} fill="#0f172a">{p}%</text>
      </svg>
    );
  };

  // ── Student result card ──────────────────────────────────────────────────────
  const StudentCard: React.FC<{ student: any }> = ({ student }) => {
    const pct = student.attemptData?.percentage || 0;
    const violations = student.attemptData?.violationCount ?? student.attemptData?.violations ?? 0;
    return (
      <button
        type="button"
        onClick={() => onStudentSelect?.(student)}
        className="w-full text-left bg-white border border-gray-200 rounded-2xl p-5 transition-all hover:shadow-md"
        style={{ borderColor: '#e5e7eb' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = primary; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{student.studentName || 'Student'}</h3>
            <span className="flex items-center text-sm text-gray-600">
              <FontAwesomeIcon icon={faUser} style={{ fontSize: 13 }} className="mr-1.5" />
              Roll: {student.rollNumber || 'N/A'}
            </span>
          </div>
          <div
            className="text-xl font-bold px-4 py-2 rounded-lg"
            style={student.hasAttempt && student.attemptData
              ? { color: getScoreColor(pct), backgroundColor: `${getScoreColor(pct)}15` }
              : { color: '#9ca3af', backgroundColor: '#f3f4f6' }}
          >
            {(student.hasAttempt && student.attemptData ? pct : 0).toFixed(2)}%
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg mb-4"
          style={{ backgroundColor: student.hasAttempt ? `${primary}08` : '#fef3c7' }}>
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 18 }} className="text-gray-500 mt-1" />
            <div>
              <p className="text-xs text-gray-500">Attempted</p>
              <p className="text-sm font-bold text-gray-900">
                {getAttemptedCount(student.attemptData)} / {getQuestionCount(selectedExam)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faAward} style={{ fontSize: 18 }} className="text-gray-500 mt-1" />
            <div>
              <p className="text-xs text-gray-500">Score</p>
              <p className="text-sm font-bold text-gray-900">
                {student.attemptData?.obtainedMarks || 0} / {getTotalMarks(selectedExam)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faClock} style={{ fontSize: 18 }} className="text-gray-500 mt-1" />
            <div>
              <p className="text-xs text-gray-500">Time Spent</p>
              <p className="text-sm font-bold text-gray-900">
                {student.attemptData?.timeSpent ? formatTimeSpent(student.attemptData.timeSpent) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {student.hasAttempt ? (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 11 }} /> Submitted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
              <FontAwesomeIcon icon={faClock} style={{ fontSize: 11 }} /> Absent
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${violations > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            Violation ({violations})
          </span>
        </div>
      </button>
    );
  };

  // ── Render: Dashboard (top) + Student cards (below) ──────────────────────────
  return (
    <div className="flex-1 h-full flex flex-col" style={{ background: '#eef1f6' }}>
      <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Dashboard card */}
        <div className="mb-5" style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 20, padding: 26 }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-none w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${primary}15` }}>
              <FontAwesomeIcon icon={faTrophy} style={{ fontSize: 20, color: primary }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{selectedExam?.title || 'Exam Results'}</h1>
              <p className="text-sm text-gray-500">
                {totalStudents} Students{examId ? ` · ID: ${examId}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleExportReport}
            disabled={isExportingReport}
            title="Download report"
            className={`flex-none flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm transition-all shadow-sm ${isExportingReport ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-110'}`}
            style={{ background: `linear-gradient(135deg, ${primary} 0%, #7c3aed 100%)` }}
          >
            {isExportingReport ? (
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            ) : (
              <>
                <FontAwesomeIcon icon={faChartBar} />
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 11 }} />
              </>
            )}
          </button>
        </div>

        {/* Hero — attendance + pass-rate donuts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-5 shadow-sm">
            <Donut pct={attendanceRate} color="#10b981" />
            <div>
              <div className="text-2xl font-extrabold text-gray-900 leading-none">{attendanceRate}%</div>
              <p className="text-xs text-gray-500 mt-1">Attendance · {totalPresentCount} of {totalStudents}</p>
              <div className="text-xs font-semibold mt-2">
                <span className="text-green-600">{totalPresentCount} Present</span> · <span className="text-red-500">{totalAbsentCount} Absent</span>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-5 shadow-sm">
            <Donut pct={passRate} color="#22c55e" />
            <div>
              <div className="text-2xl font-extrabold text-gray-900 leading-none">{passRate}%</div>
              <p className="text-xs text-gray-500 mt-1">Pass Rate (≥40%)</p>
              <p className="text-xs text-gray-500 mt-2">{passedCount} of {submittedCount} passed</p>
            </div>
          </div>
        </div>

        {/* Hero — 4 compact stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm"><div className="text-xl font-extrabold text-gray-900 leading-none">{totalStudents}</div><p className="text-xs text-gray-500 mt-1.5">Total</p></div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm"><div className="text-xl font-extrabold text-gray-900 leading-none">{submittedCount}</div><p className="text-xs text-gray-500 mt-1.5">Submitted</p></div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm"><div className="text-xl font-extrabold text-amber-600 leading-none">{avgScore.toFixed(1)}%</div><p className="text-xs text-gray-500 mt-1.5">Average</p></div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm"><div className="text-xl font-extrabold text-violet-600 leading-none">{highestScore.toFixed(1)}%</div><p className="text-xs text-gray-500 mt-1.5">Highest</p></div>
        </div>

        {/* Performance Distribution */}
        <h2 className="text-sm font-bold tracking-wider text-gray-700 uppercase mb-3">Performance Distribution</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-8 shadow-sm">
          {distRows.map((r, i) => (
            <div key={r.label} className={i < distRows.length - 1 ? 'mb-4' : ''}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-700">{r.label}</span>
                <span className={`text-sm font-bold ${r.tcls}`}>{r.count} {r.count === 1 ? 'student' : 'students'}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(r.count / distTotal) * 100}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Violations Summary */}
        <h2 className="text-sm font-bold tracking-wider text-gray-700 uppercase mb-3">Violations Summary</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-around text-center flex-wrap gap-4">
            <div><div className="text-2xl font-extrabold text-red-600 leading-none">{totalViolations}</div><p className="text-xs text-gray-500 mt-1.5">Total</p></div>
            <div><div className="text-2xl font-extrabold text-orange-600 leading-none">{studentsFlagged}</div><p className="text-xs text-gray-500 mt-1.5">Flagged</p></div>
            <div><div className="text-2xl font-extrabold text-green-600 leading-none">{cleanExams}</div><p className="text-xs text-gray-500 mt-1.5">Clean</p></div>
            <div><div className="text-2xl font-extrabold text-blue-600 leading-none">{avgViolations}</div><p className="text-xs text-gray-500 mt-1.5">Avg / Student</p></div>
          </div>
        </div>
        </div>

        {/* Students card */}
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 20, padding: 26 }}>
        {/* Student result cards */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold tracking-wider text-gray-700 uppercase">Student Results</h2>
          <span className="text-sm text-gray-400">{totalCount} students</span>
        </div>

        {/* Search (server-side) */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search by name or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
            style={{ outlineColor: primary }}
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {totalCount === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 28 }} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">{isSearching ? 'No students match your search.' : 'No students found for this exam.'}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {pageStudents.map((s, i) => (
                <StudentCard key={`${s.studentId || s.rollNumber || i}-${(safePage - 1) * PAGE_SIZE + i}`} student={s} />
              ))}
            </div>

          </>
        )}
        </div>
      </div>
      </div>

      {/* Sticky pagination footer */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 h-14 flex items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="w-full max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-gray-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
              >
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .map((n, idx, arr) => (
                  <span key={n} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-1 text-gray-400">…</span>}
                    <button
                      onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${n === safePage ? '' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                      style={n === safePage ? { background: primary, color: '#fff' } : {}}
                    >
                      {n}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
