import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Search, UserCheck, UserX, Loader } from 'lucide-react';
import { firebaseService } from './services/firebase_service';

interface AttendanceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  collegeId: string;
  filter: 'present' | 'absent';
  presentCount: number;
  absentCount: number;
  brandTheme: any;
}

interface StudentRecord {
  userId: string;
  fullName: string;
  studentRoll: string;
  status?: string;
  questionsAnswered?: number;
  totalQuestions?: number;
  progressPercent?: number;
  markedAt?: string;
  entryTime?: string;
  violationCount?: number;
}

const PAGE_SIZE = 20;

export default function AttendanceListModal({
  isOpen,
  onClose,
  examId,
  collegeId,
  filter,
  presentCount,
  absentCount,
  brandTheme,
}: AttendanceListModalProps) {
  const [activeTab, setActiveTab] = useState<'present' | 'absent'>(filter);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Cache: key = "present_1" or "absent_2" etc.
  const cacheRef = useRef<Map<string, { students: StudentRecord[]; totalPages: number; totalStudents: number }>>(new Map());

  const getCacheKey = (tab: string, pg: number) => `${tab}_${pg}`;

  const fetchStudents = useCallback(async (tab: 'present' | 'absent', pageNum: number, searchStr: string = '', forceRefresh = false) => {
    const key = getCacheKey(tab, pageNum) + `_${searchStr}`;
    const cached = cacheRef.current.get(key);

    if (cached && !forceRefresh) {
      setStudents(cached.students);
      setTotalPages(cached.totalPages);
      setTotalStudents(cached.totalStudents);
      setPage(pageNum);
      return;
    }

    setLoading(true);
    try {
      const result = await firebaseService.getLiveExamStats(examId, collegeId, pageNum, PAGE_SIZE, tab, { search: searchStr });
      const data = {
        students: result.students || [],
        totalPages: result.pagination.totalPages,
        totalStudents: result.pagination.totalStudents,
      };
      cacheRef.current.set(key, data);
      setStudents(data.students);
      setTotalPages(data.totalPages);
      setTotalStudents(data.totalStudents);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch attendance list:', err);
    } finally {
      setLoading(false);
    }
  }, [examId, collegeId]);

  // Fetch when tab or open state changes — clear cache on fresh open
  useEffect(() => {
    if (isOpen) {
      cacheRef.current.clear();
      setActiveTab(filter);
      setPage(1);
      setSearchQuery('');
      fetchStudents(filter, 1, '');
    }
  }, [isOpen, filter]);

  const handleTabChange = (tab: 'present' | 'absent') => {
    setActiveTab(tab);
    setPage(1);
    setSearchQuery('');
    fetchStudents(tab, 1, '');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchStudents(activeTab, newPage, searchQuery);
    }
  };

  // Debounced search — triggers fetch across all students
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchStudents(activeTab, 1, value);
    }, 300);
  };

  const totalCount = activeTab === 'present' ? presentCount : absentCount;

  // Status badge
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'submitted':
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-700">Submitted</span>;
      case 'active':
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-700">Active</span>;
      case 'expired':
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-100 text-orange-700">Expired</span>;
      case 'not_started':
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">Not Started</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">—</span>;
    }
  };

  // Page numbers to show (max 5)
  const getPageNumbers = () => {
    const pages: number[] = [];
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[42rem] bg-white shadow-2xl z-[10001] transition-transform duration-200 ease-out rounded-2xl overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between flex-shrink-0"
            style={{ backgroundColor: `${brandTheme.colors.primary}08`, borderBottom: `1px solid ${brandTheme.colors.primary}20` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
              >
                {activeTab === 'present' ? (
                  <UserCheck size={18} style={{ color: brandTheme.colors.primary }} />
                ) : (
                  <UserX size={18} className="text-red-500" />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Attendance List</h2>
                <p className="text-xs text-gray-500">{totalCount} students</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => handleTabChange('present')}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors relative ${
                activeTab === 'present' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Present ({presentCount})
              {activeTab === 'present' && (
                <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full" style={{ backgroundColor: brandTheme.colors.primary }} />
              )}
            </button>
            <button
              onClick={() => handleTabChange('absent')}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors relative ${
                activeTab === 'absent' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Absent ({absentCount})
              {activeTab === 'absent' && (
                <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-red-500" />
              )}
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 flex-shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or roll..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-gray-300 bg-gray-50"
              />
            </div>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader size={24} className="animate-spin text-gray-400" />
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                {searchQuery ? (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mb-4">
                      <Search size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No matching students</p>
                    <p className="text-xs text-gray-400 mt-1">Try a different name or roll number</p>
                  </>
                ) : activeTab === 'present' ? (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-dashed border-blue-200 flex items-center justify-center mb-4">
                      <UserCheck size={32} className="text-blue-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">No present students</p>
                    <p className="text-xs text-gray-400 mt-1.5 text-center max-w-[240px]">
                      No students have been marked present for this exam yet
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-dashed border-green-200 flex items-center justify-center mb-4">
                      <div className="text-3xl">🎉</div>
                    </div>
                    <p className="text-sm font-semibold text-gray-600">Perfect attendance!</p>
                    <p className="text-xs text-gray-400 mt-1.5 text-center max-w-[240px]">
                      All enrolled students are present — no absentees
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {students.map((student, idx) => (
                  <div
                    key={student.userId}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    {/* Serial number */}
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-medium text-gray-500">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm"
                      style={{
                        backgroundColor: activeTab === 'present'
                          ? brandTheme.colors.primary
                          : '#ef4444',
                      }}
                    >
                      {(student.fullName || '?')[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {student.fullName || 'Unknown'}
                        </p>
                        {activeTab === 'present' && getStatusBadge(student.status)}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        Roll Number: {student.studentRoll || 'N/A'}
                        {activeTab === 'present' && student.entryTime && (
                          <span className="ml-2 text-gray-400">· Joined {student.entryTime}</span>
                        )}
                        {activeTab === 'present' && (student.violationCount || 0) > 0 && (
                          <span className="ml-2 text-red-500">· {student.violationCount} violation{student.violationCount !== 1 ? 's' : ''}</span>
                        )}
                      </p>
                    </div>

                    {/* Right side info */}
                    {activeTab === 'present' && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-gray-700">
                          {student.questionsAnswered ?? 0}/{student.totalQuestions ?? 0}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {student.progressPercent ?? 0}%
                        </p>
                      </div>
                    )}

                  </div>
                ))}

                {/* End of list indicator */}
                {page === totalPages && students.length > 0 && (
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
                    <p className="text-xs text-gray-400 mt-1">No more students to show</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
              <span className="text-xs text-gray-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalStudents)} of {totalStudents}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={12} />
                  Prev
                </button>
                {getPageNumbers().map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-7 h-7 rounded-md text-xs font-medium flex items-center justify-center transition-colors ${
                      p === page
                        ? 'text-white shadow-sm'
                        : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                    style={p === page ? { backgroundColor: brandTheme.colors.primary } : {}}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}