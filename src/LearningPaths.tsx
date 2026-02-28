import { useState, useMemo, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { firebaseService } from './services/firebase_service';
import CreateLearningPathModal from './CreateLearningPathModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRoute,
  faSearch,
  faBookOpen,
  faClock,
  faUsers,
  faEdit,
  faLock,
  faLayerGroup,
  faBriefcase,
  faUserPlus,
  faChevronLeft,
  faChevronDown,
} from '@fortawesome/sharp-light-svg-icons';

// ============ INTERFACES ============

interface LearningPathCourse {
  courseId: string;
  courseName: string;
  thumbnail: string;
  category: string;
  duration: string;
  lectures: number;
  sequenceOrder: number;
  isRequired: boolean;
  phase: string;
  phaseNumber: number;
}

interface LearningPath {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  thumbnail?: string;
  courses: LearningPathCourse[];
  totalCourses: number;
  totalDuration: string;
  estimatedWeeks: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  skills: string[];
  status: 'draft' | 'published';
  isSequential: boolean;
  createdBy: string;
  createdByName: string;
  collegeId: string;
  assignedStudents: string[];
  assignedClasses: string[];
  enrollmentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface LearningPathsProps {
  brandTheme: {
    colors: { primary: string; secondary: string; success?: string };
    gradients: { primary: string };
    collegeName?: string;
  };
  currentUser: any;
  selectedCollege: any;
  availableCourses: any[];
  isCollapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  onOpenPathCourses?: (courseIds: number[], pathName: string) => void;
}

// ============ HELPER FUNCTIONS ============

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'beginner': return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
    case 'intermediate': return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
    case 'advanced': return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' };
  }
};

const getPhaseColor = (phaseNumber: number, _brandPrimary: string) => {
  const colors = [
    { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', iconBg: 'bg-blue-100' },
    { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500', iconBg: 'bg-purple-100' },
    { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-500', iconBg: 'bg-teal-100' },
    { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', iconBg: 'bg-amber-100' },
  ];
  return colors[(phaseNumber - 1) % colors.length];
};

// ============ MAIN COMPONENT ============

export default function LearningPaths({ brandTheme, currentUser, selectedCollege, isCollapsed, onCollapse, onExpand, onOpenPathCourses }: LearningPathsProps) {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [studentFilter, setStudentFilter] = useState<'all' | 'completed'>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPathData, setEditPathData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Enroll Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isLoadingEnrollData, setIsLoadingEnrollData] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<{ success: boolean; message: string } | null>(null);
  const [enrollAvailableUsers, setEnrollAvailableUsers] = useState<any[]>([]);
  const [enrollSelectedUsers, setEnrollSelectedUsers] = useState<string[]>([]);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');
  const [enrollClassFilter, setEnrollClassFilter] = useState('all');
  const [enrollCurrentPage, setEnrollCurrentPage] = useState(1);
  const [enrollValidClasses, setEnrollValidClasses] = useState<string[]>([]);
  const [enrollmentEndDate, setEnrollmentEndDate] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date().getMonth());
  const [datePickerYear, setDatePickerYear] = useState(new Date().getFullYear());
  const enrollUsersPerPage = 25;

  // Enrolled Students Section States
  const [pathEnrolledStudents, setPathEnrolledStudents] = useState<any[]>([]);
  const [isLoadingEnrolledStudents, setIsLoadingEnrolledStudents] = useState(false);
  const [enrolledStudentsPage, setEnrolledStudentsPage] = useState(1);
  const enrolledStudentsPerPage = 6;
  const [isRoadmapCollapsed, setIsRoadmapCollapsed] = useState(false);

  // Fetch learning paths from Firebase
  useEffect(() => {
    const fetchPaths = async () => {
      setIsLoading(true);
      try {
        const collegeId = selectedCollege?.id || selectedCollege?.collegeId || '';
        if (!collegeId) {
          setLearningPaths([]);
          setIsLoading(false);
          return;
        }
        const rawPaths = await firebaseService.getLearningPaths(collegeId);
        console.log('📚 [LearningPaths] Fetched', rawPaths.length, 'paths for collegeId:', collegeId, rawPaths);
        const paths: LearningPath[] = rawPaths.map((p: any) => ({
          id: p.id,
          name: p.pathName || p.name || '',
          description: p.description || '',
          targetRole: p.targetRole || '',
          thumbnail: p.thumbnail || undefined,
          courses: (p.courses || []).map((c: any, idx: number) => ({
            courseId: c.courseId || c.id || '',
            courseName: c.courseName || c.name || '',
            thumbnail: c.thumbnail || '',
            category: c.category || '',
            duration: c.duration || '0h',
            lectures: c.lectures || 0,
            sequenceOrder: c.sequenceOrder || idx + 1,
            isRequired: c.isRequired !== false,
            phase: c.phase || `Phase ${c.phaseNumber || 1}`,
            phaseNumber: c.phaseNumber || 1,
          })),
          totalCourses: p.totalCourses || (p.courses || []).length,
          totalDuration: p.totalDurationHours ? `${p.totalDurationHours}h` : p.totalDuration || '0h',
          estimatedWeeks: p.estimatedWeeks || 0,
          difficulty: p.difficulty || 'beginner',
          skills: (p.skills || []).map((s: any) => typeof s === 'string' ? s : s.name || s.skill || ''),
          status: p.status || 'draft',
          isSequential: p.isSequential || false,
          createdBy: p.createdBy || '',
          createdByName: p.createdBy || '',
          collegeId: p.collegeId || '',
          assignedStudents: p.assignedStudents || [],
          assignedClasses: p.assignedClasses || [],
          enrollmentCount: p.enrollmentCount || 0,
          createdAt: p.createdAt || '',
          updatedAt: p.updatedAt || '',
        }));
        setLearningPaths(paths);
      } catch (err) {
        console.error('Error fetching learning paths:', err);
        setLearningPaths([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPaths();
  }, [selectedCollege, refreshKey]);


  const isStudent = currentUser?.userType === 'student';
  const isAdmin = ['admin', 'teacher', 'principal', 'system_admin', 'dean'].includes(currentUser?.userType);

  // Fetch student's path enrollments from path_enrollments collection
  const [studentEnrolledPathIds, setStudentEnrolledPathIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isStudent || !currentUser?.userId) return;
    const fetchStudentEnrollments = async () => {
      try {
        const enrollments = await firebaseService.getUserPathEnrollments(currentUser.userId);
        const pathIds = new Set(enrollments.map((e: any) => e.pathId));
        console.log('📋 Student enrolled path IDs:', [...pathIds]);
        setStudentEnrolledPathIds(pathIds);
      } catch (err) {
        console.warn('Failed to fetch student path enrollments:', err);
      }
    };
    fetchStudentEnrollments();
  }, [isStudent, currentUser?.userId]);

  // Filter paths based on role
  const filteredPaths = useMemo(() => {
    let paths = learningPaths;

    // Students only see published + (assigned OR enrolled) paths
    if (isStudent) {
      paths = paths.filter(p => p.status === 'published' && (
        p.assignedStudents.includes(currentUser?.userId || '') ||
        p.assignedClasses.some((cls: string) => 
          currentUser?.classId === cls || currentUser?.studentClass === cls
        ) ||
        studentEnrolledPathIds.has(p.id)
      ));
    }

    // Filter by status
    if (filterStatus !== 'all') {
      paths = paths.filter(p => p.status === filterStatus);
    }

    // Student completion filter
    if (isStudent && studentFilter === 'completed') {
      // For now, filter paths where progress is 100% (placeholder until path progress tracking is implemented)
      paths = paths.filter(p => (p as any).progressPercent === 100);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      paths = paths.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.targetRole.toLowerCase().includes(q) ||
        p.skills.some(s => s.toLowerCase().includes(q))
      );
    }

    return paths;
  }, [learningPaths, isStudent, currentUser, filterStatus, studentFilter, searchQuery]);

  // Group courses by phase for detail view
  const groupedCourses = useMemo(() => {
    if (!selectedPath) return [];
    const phases: { phase: string; phaseNumber: number; courses: LearningPathCourse[] }[] = [];
    selectedPath.courses.forEach(course => {
      const existing = phases.find(p => p.phaseNumber === course.phaseNumber);
      if (existing) {
        existing.courses.push(course);
      } else {
        phases.push({ phase: course.phase, phaseNumber: course.phaseNumber, courses: [course] });
      }
    });
    return phases.sort((a, b) => a.phaseNumber - b.phaseNumber);
  }, [selectedPath]);

  // Auto-select first path
  useEffect(() => {
    if (!selectedPath && filteredPaths.length > 0) {
      setSelectedPath(filteredPaths[0]);
    }
  }, [filteredPaths]);

  // Fetch enrolled students for the selected path
    useEffect(() => {
      // FIX: Only fetch the full student list if the user is NOT a student
      if (!selectedPath?.id || isStudent) { 
        setPathEnrolledStudents([]); 
        return; 
      }
      const fetchEnrolledStudents = async () => {
      setIsLoadingEnrolledStudents(true);
      setEnrolledStudentsPage(1);
      try {
        let collegeIdToUse = currentUser?.userType === 'system_admin'
          ? (selectedCollege?.id || null)
          : (currentUser?.collegeId || null);
        if (!collegeIdToUse) collegeIdToUse = selectedCollege?.id || selectedCollege?.collegeId || null;
        if (!collegeIdToUse) { setPathEnrolledStudents([]); setIsLoadingEnrolledStudents(false); return; }

        console.log('📋 Fetching enrolled students for path:', selectedPath.id, 'college:', collegeIdToUse);

        // Fetch all enrollments
        let allEnrollments: any[] = [];
        let lastDocRef = null;
        let hasMore = true;
        while (hasMore) {
          const result = await firebaseService.getPathEnrollmentsPaginated(selectedPath.id, collegeIdToUse, 100, lastDocRef);
          allEnrollments = [...allEnrollments, ...result.enrollments];
          lastDocRef = result.lastDoc;
          hasMore = result.hasMore;
        }

        console.log('📋 Found', allEnrollments.length, 'enrollments for path');

        // Fetch user details for enrolled students
        const users = await firebaseService.getUsersByCollege(collegeIdToUse);
        const userMap = new Map<string, any>();
        users.forEach((u: any) => userMap.set(u.userId, u));

        const enriched = allEnrollments.map((e: any) => {
          const user = userMap.get(e.userId);
          const fullName = user?.fullName || user?.email?.split('@')[0] || 'Unknown';
          const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          return {
            ...e,
            name: fullName,
            email: user?.email || '',
            className: user?.studentClass || 'Unassigned',
            avatar: initials,
            enrolledDate: e.enrolledAt?.toDate?.() ? e.enrolledAt.toDate() : (e.enrolledAt ? new Date(e.enrolledAt) : null),
            progressPercent: e.progress?.percentage || 0,
            completedCourses: e.progress?.completedCourses?.length || 0,
            totalCourses: selectedPath.totalCourses || 0,
          };
        });

        setPathEnrolledStudents(enriched);
      } catch (err) {
        console.warn('Failed to fetch enrolled students for path:', err);
        setPathEnrolledStudents([]);
      }
      setIsLoadingEnrolledStudents(false);
    };
    fetchEnrolledStudents();
  }, [selectedPath?.id, selectedPath?.enrollmentCount]);

  // Paginated enrolled students
  const paginatedEnrolledStudents = useMemo(() => {
    const start = (enrolledStudentsPage - 1) * enrolledStudentsPerPage;
    return pathEnrolledStudents.slice(start, start + enrolledStudentsPerPage);
  }, [pathEnrolledStudents, enrolledStudentsPage]);

  const totalEnrolledPages = Math.max(1, Math.ceil(pathEnrolledStudents.length / enrolledStudentsPerPage));

  // Export enrolled students report
  const exportEnrolledReport = () => {
    if (pathEnrolledStudents.length === 0) return;
    const headers = ['Name', 'Email', 'Class', 'Enrolled Date', 'Progress %', 'Completed Courses', 'Total Courses', 'Status'];
    const rows = pathEnrolledStudents.map(s => [
      s.name,
      s.email,
      s.className,
      s.enrolledDate ? new Date(s.enrolledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      s.progressPercent,
      s.completedCourses,
      s.totalCourses,
      s.status || (s.progressPercent === 100 ? 'Completed' : 'In Progress'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPath?.name || 'path'}_enrolled_students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== Enrollment Modal Logic ====================

  const openAssignModal = async () => {
    setIsEnrollModalOpen(true);
    setIsLoadingEnrollData(true);
    setEnrollSelectedUsers([]);
    setEnrollSearchQuery('');
    setEnrollClassFilter('all');
    setEnrollCurrentPage(1);
    setEnrollValidClasses([]);
    setEnrollmentEndDate('');
    setIsDatePickerOpen(false);
    setEnrollmentResult(null);

    try {
      let collegeIdToUse: string | null = null;
      if (currentUser?.userType === 'system_admin') {
        collegeIdToUse = selectedCollege?.id || null;
      } else if (currentUser?.userType !== 'student') {
        collegeIdToUse = currentUser?.collegeId || null;
      }
      if (!collegeIdToUse) {
        collegeIdToUse = selectedCollege?.id || selectedCollege?.collegeId || null;
      }
      if (!collegeIdToUse) { setEnrollAvailableUsers([]); setIsLoadingEnrollData(false); return; }

      const collegeData = await firebaseService.getCollege(collegeIdToUse);
      if (collegeData?.validClasses) setEnrollValidClasses(collegeData.validClasses);

      // FIX: Only fetch all college users if the user is an Admin/Staff
      let users = [];
      if (isAdmin) {
        users = await firebaseService.getUsersByCollege(collegeIdToUse);
      } else {
        // Students should only see their own data
        const myProfile = await firebaseService.getUserProfile(currentUser.userId);
        users = myProfile ? [myProfile] : [];
      }

      // Fetch existing path enrollments from path_enrollments collection
      let enrollmentMap: Map<string, any> = new Map();
      if (selectedPath?.id && collegeIdToUse) {
        try {
          let allEnrollments: any[] = [];
          let lastDocRef = null;
          let hasMore = true;
          while (hasMore) {
            const result = await firebaseService.getPathEnrollmentsPaginated(selectedPath.id, collegeIdToUse, 100, lastDocRef);
            allEnrollments = [...allEnrollments, ...result.enrollments];
            lastDocRef = result.lastDoc;
            hasMore = result.hasMore;
          }
          allEnrollments.forEach((e: any) => {
            enrollmentMap.set(e.userId, {
              enrollmentId: e.enrollmentId || e.id,
              expiryDate: e.expiryDate?.toDate?.() || e.expiryDate || null,
              enrolledAt: e.enrolledAt?.toDate?.() || e.enrolledAt || null,
            });
          });
        } catch (err) {
          console.warn('path_enrollments query failed, falling back to assignedStudents:', err);
        }
      }

      // Also include users from assignedStudents array (legacy/fallback)
      const assignedSet = new Set(selectedPath?.assignedStudents || []);

      const studentUsers = users
        .filter((u: any) => u.userType === 'student')
        .map((u: any) => {
          const enrollment = enrollmentMap.get(u.userId);
          const isEnrolled = !!enrollment || assignedSet.has(u.userId);
          return {
            id: u.userId,
            name: u.fullName || u.email?.split('@')[0] || 'Unknown',
            email: u.email || '',
            className: u.studentClass || 'Unassigned',
            section: u.studentClass?.includes('-') ? u.studentClass.split('-')[1] : '',
            avatar: (u.fullName || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
            isEnrolled,
            enrollmentId: enrollment?.enrollmentId || null,
            expiryDate: enrollment?.expiryDate || null,
            enrolledAt: enrollment?.enrolledAt || null,
          };
        });

      setEnrollAvailableUsers(studentUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setEnrollAvailableUsers([]);
    } finally {
      setIsLoadingEnrollData(false);
    }
  };

  // Filtered & paginated users for enrollment modal
  const enrollFilteredUsers = enrollAvailableUsers.filter((user: any) => {
    const matchesSearch = user.name.toLowerCase().includes(enrollSearchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(enrollSearchQuery.toLowerCase());
    const matchesClass = enrollClassFilter === 'all' || user.className === enrollClassFilter;
    return matchesSearch && matchesClass;
  });

  const enrollSelectableUsers = enrollFilteredUsers.filter((u: any) => !u.isEnrolled);
  const enrollTotalPages = Math.ceil(enrollFilteredUsers.length / enrollUsersPerPage);
  const enrollPaginatedUsers = enrollFilteredUsers.slice(
    (enrollCurrentPage - 1) * enrollUsersPerPage,
    enrollCurrentPage * enrollUsersPerPage
  );

  const toggleEnrollUser = (userId: string) => {
    setEnrollSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleEnrollSelectAll = () => {
    if (enrollSelectedUsers.length === enrollSelectableUsers.length && enrollSelectableUsers.length > 0) {
      setEnrollSelectedUsers([]);
    } else {
      setEnrollSelectedUsers(enrollSelectableUsers.map((u: any) => u.id));
    }
  };

  const handleAssignStudents = async () => {
    if (enrollSelectedUsers.length === 0 || !selectedPath) return;
    setIsEnrolling(true);
    setEnrollmentResult(null);

    try {
      let collegeId = '';
      if (currentUser?.userType === 'system_admin') {
        collegeId = selectedCollege?.id || '';
      } else {
        collegeId = currentUser?.collegeId || selectedCollege?.id || selectedCollege?.collegeId || '';
      }

      // Parse expiry date if set
      const expiryDate = enrollmentEndDate ? new Date(enrollmentEndDate) : null;

      const result = await firebaseService.enrollUsersToLearningPath(
        selectedPath.id,
        enrollSelectedUsers,
        currentUser?.userId || currentUser?.uid || '',
        collegeId,
        expiryDate,
        'manual'
      );

      if (result.enrolledCount > 0) {
        // Mark newly enrolled users in the list
        setEnrollAvailableUsers(prev => prev.map(u =>
          enrollSelectedUsers.includes(u.id) ? { ...u, isEnrolled: true, expiryDate: expiryDate, enrolledAt: new Date() } : u
        ));

        // Update enrollment count in UI — count actual enrolled users from the list
        const updatedAssigned = [...new Set([...(selectedPath.assignedStudents || []), ...enrollSelectedUsers])];
        const actualEnrolledCount = enrollAvailableUsers.filter(u => u.isEnrolled).length + result.enrolledCount;
        setSelectedPath({ ...selectedPath, assignedStudents: updatedAssigned, enrollmentCount: actualEnrolledCount });
        setLearningPaths(prev => prev.map(p =>
          p.id === selectedPath.id ? { ...p, assignedStudents: updatedAssigned, enrollmentCount: actualEnrolledCount } : p
        ));

        setEnrollmentResult({
          success: true,
          message: `Successfully enrolled ${result.enrolledCount} student${result.enrolledCount > 1 ? 's' : ''} to this learning path!`
        });
        setEnrollSelectedUsers([]);
        setEnrollmentEndDate('');
      } else {
        setEnrollmentResult({
          success: false,
          message: result.errors.length > 0 ? result.errors[0] : 'Failed to enroll students. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error enrolling students:', error);
      setEnrollmentResult({
        success: false,
        message: 'Failed to enroll students. Please try again.'
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* ============ MIDDLE PANEL - Path Cards (matches Courses panel) ============ */}
      {isCollapsed ? (
        <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-4 flex items-center justify-center">
            <button 
              onClick={onExpand}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Expand"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="rotate-180" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center pt-4">
            <FontAwesomeIcon icon={faRoute} className="text-gray-600 mb-2" />
            <div className="text-gray-600 font-semibold text-sm tracking-wider"
                 style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              Learning Paths
            </div>
          </div>
        </div>
      ) : (
      <div 
        className="h-full overflow-hidden bg-white border-r border-gray-200 flex-shrink-0 flex flex-col"
        style={{ minWidth: '600px', maxWidth: '600px', width: '600px' }}
      >        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${brandTheme.colors.primary}15` }}>
                <FontAwesomeIcon icon={faRoute} style={{ color: brandTheme.colors.primary }} className="text-sm" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Learning Paths</h1>
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  {(['all', 'published', 'draft'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3.5 py-1 text-xs font-medium rounded-full border transition-all ${
                        filterStatus === status
                          ? 'text-white border-transparent'
                          : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      style={filterStatus === status ? { background: brandTheme.colors.primary, borderColor: brandTheme.colors.primary } : {}}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              {isStudent && (
                <div className="flex items-center gap-1.5">
                  {(['all', 'completed'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setStudentFilter(f)}
                      className={`px-3.5 py-1 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                        studentFilter === f
                          ? 'text-white border-transparent'
                          : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      style={studentFilter === f ? { background: brandTheme.colors.primary, borderColor: brandTheme.colors.primary } : {}}
                    >
                      {f === 'all' ? 'All' : 'Completed'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Collapse"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search paths, roles, or skills..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-300 transition-colors"
            />
          </div>
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-4" style={{ borderColor: brandTheme.colors.primary }}></div>
              <p className="text-sm text-gray-500">Loading learning paths...</p>
            </div>
          ) : filteredPaths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faRoute} className="text-gray-300 text-2xl" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {isStudent && studentFilter === 'completed' ? 'No completed learning paths yet' : isStudent ? 'No learning paths assigned yet' : 'No learning paths found'}
              </p>
              <p className="text-[11px] text-gray-400">
                {isStudent && studentFilter === 'completed' ? 'Complete all courses in a path to see it here' : isStudent ? 'Your teacher will assign paths to guide your learning' : 'Create your first learning path to get started'}
              </p>
            </div>
          ) : (
            filteredPaths.map(path => {
              const isSelected = selectedPath?.id === path.id;
              const diffColor = getDifficultyColor(path.difficulty);
              
              return (
                <div
                  key={path.id}
                  onClick={() => setSelectedPath(path)}
                  className={`relative bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    isSelected
                      ? 'shadow-md'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                  style={isSelected ? { borderColor: brandTheme.colors.primary + '60' } : {}}
                >
                  {/* Status badge for admin */}
                  {isAdmin && path.status === 'draft' && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-md uppercase">Draft</span>
                    </div>
                  )}

                  {/* Top row: Title + Role */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      <FontAwesomeIcon icon={faBriefcase} className="text-white text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-bold text-gray-900 line-clamp-1">{path.name}</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">Target: {path.targetRole}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[12px] text-gray-500 line-clamp-2 mb-3 leading-relaxed">{path.description}</p>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <FontAwesomeIcon icon={faBookOpen} className="text-gray-400" />
                      <span className="font-medium text-gray-700">{path.totalCourses}</span> courses
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                      <span className="font-medium text-gray-700">{path.totalDuration}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <FontAwesomeIcon icon={faLayerGroup} className="text-gray-400" />
                      <span className="font-medium text-gray-700">{path.estimatedWeeks}</span> weeks
                    </div>
                    {!isStudent && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                        <span className="font-medium text-gray-700">{path.enrollmentCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills tags + Difficulty */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                      {path.skills.slice(0, 4).map((skill, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-md">{skill}</span>
                      ))}
                      {path.skills.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{path.skills.length - 4}</span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 ${diffColor.bg} ${diffColor.text} text-[10px] font-semibold rounded-md capitalize flex-shrink-0`}>
                      {path.difficulty}
                    </span>
                  </div>

                  {/* Student progress bar (placeholder) */}
                  {isStudent && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-gray-600">Progress</span>
                        <span className="text-[11px] font-bold" style={{ color: brandTheme.colors.primary }}>0%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: '0%', background: brandTheme.gradients.primary }} />
                      </div>
                    </div>
                  )}

                  {/* Card Footer - Enrollment stats + Actions */}
                  {!isStudent && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-[11px] text-gray-500">
                        <span>Enrolments: <strong className="text-gray-700">{path.enrollmentCount}</strong></span>
                        <span>Completed: <strong style={{ color: brandTheme.colors.success || '#22c55e' }}>0</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPath(path);
                            setEditPathData(path);
                            setEditModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <FontAwesomeIcon icon={faEdit} className="mr-1.5 text-[10px]" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPath(path);
                          }}
                          className="px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors"
                          style={{ borderColor: brandTheme.colors.primary + '40', color: brandTheme.colors.primary }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = brandTheme.colors.primary + '10'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* ============ RIGHT PANEL - Path Details (matches Courses detail panel) ============ */}
      {selectedPath ? (
        <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {/* Header Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            {/* Header */}
            <div className="relative px-6 py-6 border-b border-gray-100">
              {/* Back, Assign & Enroll Buttons - Top Right */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => setSelectedPath(null)}
                  className="h-10 px-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all flex items-center justify-center gap-2"
                  title="Back"
                >
                  <span>←</span>
                  <span className="hidden 2xl:inline">Back</span>
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={openAssignModal}
                      className="h-10 px-4 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2"
                      style={{ background: brandTheme.gradients.primary }}
                      title="Enroll"
                    >
                      <FontAwesomeIcon icon={faUserPlus} className="text-sm" />
                      <span className="hidden 2xl:inline">Enroll Now</span>
                      <span className="2xl:hidden">Enroll</span>
                    </button>
                  </>
                )}
                {isStudent && (
                  <button
                    className="h-10 px-4 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2"
                    style={{ background: brandTheme.gradients.primary }}
                    title="Start Learning"
                  >
                    <span className="hidden 2xl:inline">Start Learning</span>
                    <span className="2xl:hidden">Start</span>
                  </button>
                )}
              </div>

              <div className="flex items-start gap-5">
                {/* Path Icon */}
                <div 
                  className="w-24 h-24 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <FontAwesomeIcon icon={faRoute} className="text-white text-3xl" />
                </div>
                
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getDifficultyColor(selectedPath.difficulty).bg} ${getDifficultyColor(selectedPath.difficulty).text}`}
                    >
                      {selectedPath.difficulty}
                    </span>
                    {selectedPath.status === 'draft' && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 uppercase">Draft</span>
                    )}
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">{selectedPath.name}</h1>
                  <p className="text-gray-500 text-sm mb-3">
                    Target Role: {selectedPath.targetRole}
                  </p>
                  
                  {/* Stats Row */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <FontAwesomeIcon icon={faBookOpen} className="text-gray-400" />
                      <span className="font-medium text-gray-700">{selectedPath.totalCourses}</span> courses
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                      {selectedPath.totalDuration}
                    </div>
                    <div className="text-sm text-gray-500">
                      <FontAwesomeIcon icon={faUsers} className="mr-1 text-gray-400" />
                      {selectedPath.enrollmentCount} students
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats Bar */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-4 gap-4">
              {[
                { label: 'Courses', value: selectedPath.totalCourses, icon: faBookOpen },
                { label: 'Duration', value: selectedPath.totalDuration, icon: faClock },
                { label: 'Weeks', value: `${selectedPath.estimatedWeeks}w`, icon: faLayerGroup },
                { label: 'Students', value: selectedPath.enrollmentCount, icon: faUsers },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Description + Skills */}
            <div className="px-6 py-4">
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">{selectedPath.description}</p>
              <div className="flex items-center flex-wrap gap-1.5">
                {selectedPath.skills.map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-gray-100 text-gray-600">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Course Roadmap Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div 
              className="px-6 py-4 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setIsRoadmapCollapsed(!isRoadmapCollapsed)}
            >
              <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
                <FontAwesomeIcon icon={faRoute} style={{ color: brandTheme.colors.primary }} />
                Course Roadmap
              </h3>
              <div className="flex items-center gap-2">
                {selectedPath.isSequential && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-lg flex items-center gap-1">
                    <FontAwesomeIcon icon={faLock} className="text-[8px]" /> Sequential
                  </span>
                )}
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`text-gray-400 text-xs transition-transform duration-200 ${isRoadmapCollapsed ? '-rotate-90' : ''}`} 
                />
              </div>
            </div>

            {!isRoadmapCollapsed && (
            <div className="px-6 py-4">
              <div className="space-y-5">
                {groupedCourses.map((phase, phaseIdx) => {
                  const phaseColor = getPhaseColor(phase.phaseNumber, brandTheme.colors.primary);
                  const isLastPhase = phaseIdx === groupedCourses.length - 1;

                  return (
                    <div key={phase.phaseNumber}>
                      {/* Phase Header */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={`w-7 h-7 rounded-lg ${phaseColor.iconBg} flex items-center justify-center`}>
                          <span className={`text-[11px] font-bold ${phaseColor.icon}`}>{phase.phaseNumber}</span>
                        </div>
                        <div>
                          <span className="text-[13px] font-semibold text-gray-800">{phase.phase}</span>
                          <span className="text-[11px] text-gray-400 ml-2">{phase.courses.length} course{phase.courses.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Courses in Phase */}
                      <div className="ml-3.5 pl-5 border-l-2 border-gray-100 space-y-2.5 pb-1">
                        {phase.courses.map((course) => (
                          <div
                            key={course.courseId}
                            onClick={() => {
                              if (onOpenPathCourses && selectedPath) {
                                const courseIds = selectedPath.courses.map(c => {
                                  const id = typeof c.courseId === 'number' ? c.courseId : parseInt(String(c.courseId), 10);
                                  return isNaN(id) ? null : id;
                                }).filter((id): id is number => id !== null);
                                onOpenPathCourses(courseIds, selectedPath.name);
                              }
                            }}
                            className={`relative flex items-center gap-3 p-3.5 rounded-xl ${phaseColor.bg} border ${phaseColor.border} transition-all hover:shadow-sm cursor-pointer`}
                          >
                            {/* Connector dot */}
                            <div className="absolute -left-[27px] w-3 h-3 rounded-full border-2 border-white" style={{ background: brandTheme.colors.primary + '40' }} />

                            {/* Sequence number */}
                            <div className={`w-8 h-8 rounded-lg ${phaseColor.iconBg} flex items-center justify-center flex-shrink-0`}>
                              <span className={`text-[12px] font-bold ${phaseColor.icon}`}>{course.sequenceOrder}</span>
                            </div>

                            {/* Course Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[13px] font-semibold text-gray-900 line-clamp-1">{course.courseName}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[11px] text-gray-500">{course.lectures} lectures</span>
                                <span className="text-[11px] text-gray-500">{course.duration}</span>
                                <span className="text-[10px] text-gray-400">{course.category}</span>
                              </div>
                            </div>

                            {/* Required badge */}
                            {course.isRequired ? (
                              <span className="text-[9px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-md flex-shrink-0">Required</span>
                            ) : (
                              <span className="text-[9px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded-md flex-shrink-0">Optional</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Phase connector */}
                      {!isLastPhase && (
                        <div className="flex items-center justify-center my-1 ml-3.5">
                          <div className="w-0.5 h-3 rounded-full" style={{ background: brandTheme.colors.primary + '30' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>
          {/* Only show the administrative student tracking to Staff/Admins */}
          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">Enrolled Students</h3>
                  <p className="text-sm text-gray-500">{pathEnrolledStudents.length} students enrolled in this path</p>
                </div>
                <button 
                  onClick={exportEnrolledReport}
                  disabled={pathEnrolledStudents.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `${brandTheme.colors.primary}10`, color: brandTheme.colors.primary }}
                >
                  Export Report
                </button>
              </div>

              {isLoadingEnrolledStudents ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-current rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: brandTheme.colors.primary }} />
                  <p className="text-sm text-gray-500">Loading enrolled students...</p>
                </div>
              ) : pathEnrolledStudents.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <FontAwesomeIcon icon={faUsers} className="text-3xl text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">No students enrolled yet</p>
                </div>
              ) : (
                <>
                  {/* Students Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrolled Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Courses</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedEnrolledStudents.map((student, idx) => {
                          const statusText = student.status === 'completed' || student.progressPercent === 100 ? 'Completed' : 'In Progress';
                          return (
                            <tr key={student.id || idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                    style={{ background: brandTheme.gradients.primary }}
                                  >
                                    {student.avatar}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{student.name}</div>
                                    <div className="text-xs font-medium" style={{ color: brandTheme.colors.primary }}>{student.className}</div>
                                    <div className="text-xs text-gray-400">{student.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {student.enrolledDate
                                  ? new Date(student.enrolledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : '—'}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden" style={{ maxWidth: '100px' }}>
                                    <div 
                                      className="h-full rounded-full transition-all"
                                      style={{ 
                                        width: `${student.progressPercent}%`, 
                                        background: student.progressPercent === 100 ? '#10B981' : brandTheme.colors.primary 
                                      }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-gray-700">{student.progressPercent}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  statusText === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {statusText}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm font-medium text-gray-700">
                                  {student.completedCourses}/{student.totalCourses}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="text-sm text-gray-500">
                      Showing {((enrolledStudentsPage - 1) * enrolledStudentsPerPage) + 1}-{Math.min(enrolledStudentsPage * enrolledStudentsPerPage, pathEnrolledStudents.length)} of {pathEnrolledStudents.length} students
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEnrolledStudentsPage(p => Math.max(1, p - 1))}
                        disabled={enrolledStudentsPage === 1}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(totalEnrolledPages, 5) }, (_, i) => {
                        let pageNum: number;
                        if (totalEnrolledPages <= 5) {
                          pageNum = i + 1;
                        } else if (enrolledStudentsPage <= 3) {
                          pageNum = i + 1;
                        } else if (enrolledStudentsPage >= totalEnrolledPages - 2) {
                          pageNum = totalEnrolledPages - 4 + i;
                        } else {
                          pageNum = enrolledStudentsPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setEnrolledStudentsPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                              enrolledStudentsPage === pageNum
                                ? 'text-white'
                                : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                            }`}
                            style={enrolledStudentsPage === pageNum ? { background: brandTheme.gradients.primary } : {}}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {totalEnrolledPages > 5 && enrolledStudentsPage < totalEnrolledPages - 2 && (
                        <>
                          <span className="text-gray-400">...</span>
                          <button
                            onClick={() => setEnrolledStudentsPage(totalEnrolledPages)}
                            className="w-8 h-8 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all"
                          >
                            {totalEnrolledPages}
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setEnrolledStudentsPage(p => Math.min(totalEnrolledPages, p + 1))}
                        disabled={enrolledStudentsPage === totalEnrolledPages}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons - kept for additional actions if needed */}
        </div>
      ) : (
        <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faRoute} className="text-gray-300 text-3xl" />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Select a Learning Path</p>
            <p className="text-[11px] text-gray-400">Choose a path from the left to view details</p>
          </div>
        </div>
      )}

      {/* Edit Learning Path Modal */}
      <CreateLearningPathModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditPathData(null);
        }}
        brandTheme={brandTheme}
        currentUser={currentUser}
        selectedCollege={selectedCollege}
        editPath={editPathData}
        onPathCreated={() => {
          setRefreshKey(k => k + 1);
          setSelectedPath(null);
        }}
      />

      {/* Assign Students Modal */}
      {isEnrollModalOpen && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] transition-opacity"
            onClick={() => setIsEnrollModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed top-4 bottom-4 right-4 w-[560px] bg-white shadow-2xl z-[10000] flex flex-col rounded-2xl overflow-hidden">
            {/* Modal Header */}
            <div 
              className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
              style={{ background: brandTheme.gradients.primary }}
            >
              <div>
                <h3 className="font-bold text-white text-lg">{selectedPath?.name}</h3>
                <p className="text-sm text-white/80">Target Role: {selectedPath?.targetRole}</p>
              </div>
              <button 
                onClick={() => setIsEnrollModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Search & Filters */}
            <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.3-4.3"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={enrollSearchQuery}
                    onChange={(e) => { setEnrollSearchQuery(e.target.value); setEnrollCurrentPage(1); }}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 transition-all bg-white"
                  />
                </div>
                
                {/* Class Filter */}
                <select
                  value={enrollClassFilter}
                  onChange={(e) => { setEnrollClassFilter(e.target.value); setEnrollCurrentPage(1); }}
                  className="w-40 px-3 py-2 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 transition-all bg-white"
                >
                  <option value="all">All Students</option>
                  {enrollValidClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>

                {/* Expiry Date Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className={`w-40 px-3 py-2 h-10 rounded-lg border text-sm text-left transition-all bg-white flex items-center justify-between ${
                      isDatePickerOpen ? 'border-blue-400' : 'border-gray-200'
                    }`}
                  >
                    <span className={enrollmentEndDate ? 'text-gray-900' : 'text-gray-400'}>
                      {enrollmentEndDate 
                        ? new Date(enrollmentEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Expiry Date'
                      }
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </button>
                  
                  {isDatePickerOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-[10001]" 
                        onClick={() => setIsDatePickerOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-[10002] w-72">
                        <div className="text-center mb-3 pb-2 border-b border-gray-100">
                          <h4 className="text-sm font-semibold text-gray-900">Expiry Date</h4>
                          <p className="text-xs text-gray-400 mt-0.5">Select when enrollment expires</p>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (datePickerMonth === 0) { setDatePickerMonth(11); setDatePickerYear(datePickerYear - 1); }
                              else { setDatePickerMonth(datePickerMonth - 1); }
                            }}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                          >‹</button>
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(datePickerYear, datePickerMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (datePickerMonth === 11) { setDatePickerMonth(0); setDatePickerYear(datePickerYear + 1); }
                              else { setDatePickerMonth(datePickerMonth + 1); }
                            }}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                          >›</button>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1 mb-1">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">{day}</div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const firstDay = new Date(datePickerYear, datePickerMonth, 1).getDay();
                            const daysInMonth = new Date(datePickerYear, datePickerMonth + 1, 0).getDate();
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const days = [];
                            for (let i = 0; i < firstDay; i++) { days.push(<div key={`empty-${i}`} className="w-8 h-8" />); }
                            for (let day = 1; day <= daysInMonth; day++) {
                              const date = new Date(datePickerYear, datePickerMonth, day);
                              const dateStr = date.toISOString().split('T')[0];
                              const isSelected = enrollmentEndDate === dateStr;
                              const isPast = date < today;
                              const isToday = date.getTime() === today.getTime();
                              days.push(
                                <button
                                  key={day} type="button" disabled={isPast}
                                  onClick={() => { setEnrollmentEndDate(dateStr); setIsDatePickerOpen(false); }}
                                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                                    isSelected ? 'text-white' : isPast ? 'text-gray-300 cursor-not-allowed' : isToday ? 'text-blue-600 font-bold hover:bg-blue-50' : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                                  style={isSelected ? { background: brandTheme.gradients.primary } : {}}
                                >{day}</button>
                              );
                            }
                            return days;
                          })()}
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <button type="button" onClick={() => { setEnrollmentEndDate(''); setIsDatePickerOpen(false); }} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">Clear</button>
                          <button type="button" onClick={() => { setDatePickerMonth(new Date().getMonth()); setDatePickerYear(new Date().getFullYear()); }} className="text-xs font-medium transition-colors" style={{ color: brandTheme.colors.primary }}>Today</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <label className={`flex items-center gap-2 ${enrollSelectableUsers.length > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={enrollSelectedUsers.length === enrollSelectableUsers.length && enrollSelectableUsers.length > 0}
                    onChange={handleEnrollSelectAll}
                    disabled={enrollSelectableUsers.length === 0}
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ accentColor: brandTheme.colors.primary }}
                  />
                  <span className="text-sm text-gray-600">Select All</span>
                </label>
                <span className="text-sm text-gray-500">
                  {enrollSelectedUsers.length} selected
                  {enrollFilteredUsers.length > enrollSelectableUsers.length && (
                    <span className="text-green-600 ml-1">
                      ({enrollFilteredUsers.length - enrollSelectableUsers.length} already enrolled)
                    </span>
                  )}
                </span>
              </div>
            </div>
            
            {/* Users List */}
            <div className="flex-1 overflow-y-auto px-5 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {isLoadingEnrollData ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div 
                    className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mb-3"
                    style={{ borderColor: brandTheme.colors.primary, borderTopColor: 'transparent' }}
                  />
                  <p className="text-sm text-gray-500">Loading students...</p>
                </div>
              ) : (
                <>
                  {enrollPaginatedUsers.map((user: any) => {
                    const isSelected = enrollSelectedUsers.includes(user.id);
                    const isAlreadyDone = user.isEnrolled;
                    
                    return (
                    <Fragment key={user.id}>
                    <div className={`${isAlreadyDone ? 'border border-green-200 rounded-lg my-2 overflow-hidden' : ''}`}>
                    <div 
                      onClick={() => !isAlreadyDone && toggleEnrollUser(user.id)}
                      className={`flex items-center gap-3 p-3 transition-all ${
                        isAlreadyDone 
                          ? 'bg-green-50/50 cursor-default' 
                          : isSelected 
                            ? 'bg-blue-50 cursor-pointer' 
                            : 'hover:bg-gray-50 cursor-pointer'
                      } ${!isAlreadyDone ? 'border-b border-gray-100' : ''}`}
                    >
                      {isAlreadyDone ? (
                        <div className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleEnrollUser(user.id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          style={{ accentColor: brandTheme.colors.primary }}
                        />
                      )}
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${isAlreadyDone ? 'opacity-60' : ''}`}
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${isAlreadyDone ? 'text-gray-500' : 'text-gray-900'}`}>
                          {user.name}
                        </div>
                        <div className={`text-xs font-medium ${isAlreadyDone ? 'text-gray-400' : ''}`} style={!isAlreadyDone ? { color: brandTheme.colors.primary } : {}}>
                          {user.className}{user.section ? ` - Section ${user.section}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{user.email}</div>
                      </div>
                    </div>
                    
                    {/* Footer strip for enrolled users */}
                    {isAlreadyDone && (
                      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Enrolled
                          </span>
                          <span className={`text-xs flex items-center gap-1 ${user.expiryDate ? 'text-amber-600' : 'text-gray-400'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            {user.expiryDate 
                              ? `Expires: ${new Date(user.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                              : 'No expiry (Unlimited)'
                            }
                          </span>
                        </div>
                      </div>
                    )}
                    </div>
                    </Fragment>
                    );
                  })}
                  
                  {enrollFilteredUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No students found matching your filters.
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Footer - Pagination + Actions */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
              <div className="text-sm text-gray-500">
                Showing {enrollFilteredUsers.length > 0 ? (enrollCurrentPage - 1) * enrollUsersPerPage + 1 : 0}-{Math.min(enrollCurrentPage * enrollUsersPerPage, enrollFilteredUsers.length)} of {enrollFilteredUsers.length}
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setEnrollCurrentPage(p => Math.max(1, p - 1))}
                  disabled={enrollCurrentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-white text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {Array.from({ length: enrollTotalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (enrollTotalPages <= 5) return true;
                    if (enrollCurrentPage <= 3) return page <= 4 || page === enrollTotalPages;
                    if (enrollCurrentPage >= enrollTotalPages - 2) return page >= enrollTotalPages - 3 || page === 1;
                    return page === 1 || page === enrollTotalPages || (page >= enrollCurrentPage - 1 && page <= enrollCurrentPage + 1);
                  })
                  .map((page, idx, arr) => (
                    <Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && <span className="text-gray-400 text-xs px-1">...</span>}
                      <button
                        onClick={() => setEnrollCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                          enrollCurrentPage === page ? 'text-white' : 'border border-gray-200 hover:bg-white text-gray-600'
                        }`}
                        style={enrollCurrentPage === page ? { background: brandTheme.gradients.primary } : {}}
                      >
                        {page}
                      </button>
                    </Fragment>
                  ))
                }
                <button 
                  onClick={() => setEnrollCurrentPage(p => Math.min(enrollTotalPages, p + 1))}
                  disabled={enrollCurrentPage === enrollTotalPages || enrollTotalPages === 0}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-white text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEnrollModalOpen(false)}
                  disabled={isEnrolling}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-white text-gray-600 transition-all disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  onClick={handleAssignStudents}
                  disabled={enrollSelectedUsers.length === 0 || isEnrolling}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  {isEnrolling ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>Enroll{enrollSelectedUsers.length > 0 ? ` (${enrollSelectedUsers.length})` : ''}</>
                  )}
                </button>
              </div>
            </div>
            
            {/* Result Message */}
            {enrollmentResult && (
              <div 
                className={`mx-5 mb-4 px-4 py-3 rounded-xl flex items-center gap-3 ${
                  enrollmentResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <span className={`text-sm ${enrollmentResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {enrollmentResult.message}
                </span>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}