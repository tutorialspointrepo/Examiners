import { useState, useEffect, useRef } from 'react';
import { Users, Mail, Phone, User, Calendar, Shield, BookOpen, GraduationCap, Search, Layers, Edit, MoreVertical, UserX, AlertCircle, X, Clock, CheckCircle, FileText, TrendingUp, Award, BarChart3, Target, Key, Eye, EyeOff } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCode,
  faLaptopCode,
  faDatabase,
  faRobot,
  faChartLine,
  faFlask,
  faAtom,
  faDna,
  faCalculator,
  faGlobe,
  faLanguage,
  faLandmark,
  faCoins,
  faBriefcase,
  faCloud,
  faShieldHalved,
  faNetworkWired,
  faMobileScreen,
  faServer,
  faGear,
  faBookOpen as faBookOpenFA,
  faMicrochip,
  faBrain,
  faChartPie,
  faTerminal,
  faLayerGroup,
  faCubes,
  faFileCode,
  faPalette,
  faWrench,
  faGraduationCap as faGraduationCapFA
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService, type UserModel } from './services/firebase_service';
import CreateUserModal from './CreateUserModal';
import { USER_TYPES, USER_STATUS, FILTER_VALUES } from './constants';

// Enrollment interface
interface EnrollmentInfo {
  examId: string;
  examName: string;
  subjectName?: string;
  enrolledAt: Date | null;
  status: string;
  progress?: number;
  marks?: number;
  duration?: string;
  category?: string;
  lectures?: number;
  exercises?: number;
  notes?: number;
  quizzes?: number;
  assessments?: number;
}

// User Profile Stats interface
interface UserProfileStats {
  coursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  averageMarks: number;
  totalAssessments: number;
  assessmentsCompleted: number;
  assessmentAverageMarks: number;
  totalLearningHours: number;
  averageLearningPerDay: string;
  enrollments: EnrollmentInfo[];
}

interface UserListProps {
  selectedClass: string;
  activeCollegeId: string | null;
  brandTheme: any;
  onClose: () => void;
  currentUserRole?: string;
  isSuperUser?: boolean;
  highlightUserId?: string | null;
  onCountsChange?: () => Promise<void>; 
}

export default function UserList({ 
  selectedClass, 
  activeCollegeId, 
  brandTheme, 

  currentUserRole = USER_TYPES.STUDENT,  // Production default - must be overridden by parent
  isSuperUser = false,
  highlightUserId = null,
  onCountsChange
}: UserListProps) {
  const [users, setUsers] = useState<UserModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<typeof FILTER_VALUES.ALL | typeof USER_TYPES.STUDENT | typeof USER_TYPES.TEACHER | typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN>(FILTER_VALUES.ALL);
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserModel | null>(null);
  
  // User Profile slide-out modal state
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<UserModel | null>(null);
  const [userProfileStats, setUserProfileStats] = useState<UserProfileStats | null>(null);
  const [isLoadingProfile, _setIsLoadingProfile] = useState(false);
  
  // 3-dot menu state
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Disable confirmation modal state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [userToDisable, setUserToDisable] = useState<UserModel | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);
  
  // Status filter state
  const [filterStatus, setFilterStatus] = useState<typeof USER_STATUS.ACTIVE | typeof USER_STATUS.DISABLED | typeof FILTER_VALUES.ALL>(FILTER_VALUES.ALL);
  
  // Change Password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [userForPasswordChange, setUserForPasswordChange] = useState<UserModel | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Pagination state - cursor-based
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const usersPerPage = 20;
  
  // Role counts - independent of current filter (active users only)
  // Auto-scroll to highlighted user
  useEffect(() => {
    if (highlightUserId) {
      setTimeout(() => {
        const element = document.getElementById(`user-card-${highlightUserId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300); // Small delay to ensure render is complete
    }
  }, [highlightUserId]);

  const [roleCounts, setRoleCounts] = useState({
    students: 0,
    teachers: 0,
    admins: 0,
    principals: 0,
    deans: 0,
    total: 0
  });
  
  // Total disabled users count - independent of role filter
  const [totalDisabledCount, setTotalDisabledCount] = useState(0);
  const hasLoggedView = useRef(false); // Track if we've logged this view

  // Fetch users from Firebase with cursor-based pagination
  const fetchUsers = async (loadMore: boolean = false) => {
    if (!activeCollegeId || !selectedClass) {
      setUsers([]);
      setTotalUsers(0);
      setIsLoading(false);
      return;
    }

    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setLastDoc(null); // Reset cursor for fresh fetch
      }
      
      const cursorDoc = loadMore ? lastDoc : null;
      console.log('🔍 Fetching users for class:', selectedClass, 'with filter:', filterRole, 'loadMore:', loadMore);

      // Check if it's the administrative/faculty selection
      if (selectedClass === '_administrative') {
        // Fetch administrative users with pagination and role filter
        const userTypes: (typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN | typeof USER_TYPES.TEACHER)[] = [USER_TYPES.ADMIN, USER_TYPES.PRINCIPAL, USER_TYPES.DEAN, USER_TYPES.TEACHER];
        const result = await firebaseService.getUsersByTypePaginated(
          userTypes,
          activeCollegeId,
          usersPerPage,
          cursorDoc,
          filterRole as typeof FILTER_VALUES.ALL | typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN | typeof USER_TYPES.TEACHER
        );

        if (loadMore) {
          // Filter out duplicates when loading more
          setUsers(prev => {
            const existingIds = new Set(prev.map(u => u.userId));
            const newUsers = result.users.filter(u => !existingIds.has(u.userId));
            return [...prev, ...newUsers];
          });
        } else {
          setUsers(result.users);
        }
        setTotalUsers(result.total);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        
        // Update role counts from backend
        if (result.roleCounts) {
          setRoleCounts({
            students: result.roleCounts.students,
            teachers: result.roleCounts.teachers,
            admins: result.roleCounts.admins,
            principals: result.roleCounts.principals,
            deans: result.roleCounts.deans,
            total: result.roleCounts.admins + result.roleCounts.principals + result.roleCounts.deans + result.roleCounts.teachers + result.roleCounts.disabled
          });
          setTotalDisabledCount(result.roleCounts.disabled);
        }
        
        console.log('✅ Administrative & Faculty users loaded:', result.users.length, 'of', result.total);
      } else {
        // Parse class selection (format: "className|board|academicYear" or just "className")
        const [className, board, academicYear] = selectedClass.includes('|') 
          ? selectedClass.split('|')
          : [selectedClass, null, null];

        // Fetch class users with pagination and role filter
        const result = await firebaseService.getUsersByClassPaginated(
          className,
          board,
          academicYear,
          activeCollegeId,
          usersPerPage,
          cursorDoc,
          filterRole as typeof FILTER_VALUES.ALL | typeof USER_TYPES.STUDENT | typeof USER_TYPES.TEACHER
        );

        if (loadMore) {
          // Filter out duplicates when loading more
          setUsers(prev => {
            const existingIds = new Set(prev.map(u => u.userId));
            const newUsers = result.users.filter(u => !existingIds.has(u.userId));
            return [...prev, ...newUsers];
          });
        } else {
          setUsers(result.users);
        }
        setTotalUsers(result.total);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        
        // Update role counts from backend
        if (result.roleCounts) {
          setRoleCounts({
            students: result.roleCounts.students,
            teachers: result.roleCounts.teachers,
            admins: result.roleCounts.admins,
            principals: result.roleCounts.principals,
            deans: result.roleCounts.deans,
            total: result.roleCounts.students + result.roleCounts.teachers + result.roleCounts.disabled
          });
          setTotalDisabledCount(result.roleCounts.disabled);
        }

        console.log('✅ Users loaded:', result.users.length, 'of', result.total);
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Reset filters to 'All' when switching classes
  useEffect(() => {
    setFilterRole(FILTER_VALUES.ALL);
    setFilterStatus(FILTER_VALUES.ALL);
    setSearchQuery('');
  }, [selectedClass]);

  // Initial fetch when class/filter changes
  useEffect(() => {
    fetchUsers(false);
    
    // Log view activity (non-blocking) - ONLY ONCE per class selection
    if (activeCollegeId && selectedClass && !hasLoggedView.current) {
      hasLoggedView.current = true; // Mark as logged
      (async () => {
        try {
          const currentUser = await firebaseService.getCurrentUserProfile();
          if (currentUser) {
            await firebaseService.addActivityLog({
              userId: currentUser.userId,
              collegeId: activeCollegeId,
              action: 'view_user_list',
              entityType: 'users',
              entityId: selectedClass || 'all',
              details: JSON.stringify({ selectedClass, filterRole })
            });
          }
        } catch (logError) {
          console.warn('Activity log failed:', logError);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollegeId, selectedClass, filterRole]);

  // Filter logic
  const isAdministrativeView = selectedClass === '_administrative';

  // Filter users by search, role, and status
  const searchFilteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = !searchQuery || 
      (user.fullName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.phone?.includes(searchQuery));
    
    // Status filter
    const matchesStatus = filterStatus === FILTER_VALUES.ALL ||
      (filterStatus === USER_STATUS.DISABLED && user.status === USER_STATUS.DISABLED) ||
      (filterStatus === USER_STATUS.ACTIVE && user.status !== USER_STATUS.DISABLED);

    return matchesSearch && matchesStatus;
  });

  // Check if current user can edit another user based on role hierarchy
  const canEditUser = (targetUserType: string): boolean => {
    // Super users can edit anyone
    if (isSuperUser) return true;
    
    // System admins can edit anyone
    if (currentUserRole === USER_TYPES.SYSTEM_ADMIN) return true;
    
    // Admins can edit teachers and students
    if (currentUserRole === USER_TYPES.ADMIN) {
      return [USER_TYPES.TEACHER, USER_TYPES.STUDENT].includes(targetUserType as any);
    }
    
    // Principals can edit deans, teachers, and students
    if (currentUserRole === USER_TYPES.PRINCIPAL) {
      return [USER_TYPES.DEAN, USER_TYPES.TEACHER, USER_TYPES.STUDENT].includes(targetUserType as any);
    }
    
    // Deans can edit teachers and students
    if (currentUserRole === USER_TYPES.DEAN) {
      return [USER_TYPES.TEACHER, USER_TYPES.STUDENT].includes(targetUserType as any);
    }
    
    // Teachers can only edit students
    if (currentUserRole === USER_TYPES.TEACHER) {
      return targetUserType === USER_TYPES.STUDENT;
    }
    
    // Students cannot edit anyone
    return false;
  };

  // Check if current user can change password for another user
  // Rules: 
  // - Only Admin can change password for any user except Admin
  // - Anyone can change password for Students except Students themselves
  const canChangePassword = (targetUserType: string): boolean => {
    // Super users can change anyone's password
    if (isSuperUser) return true;
    
    // System admins can change anyone's password
    if (currentUserRole === USER_TYPES.SYSTEM_ADMIN) return true;
    
    // Admins can change password for anyone EXCEPT other Admins
    if (currentUserRole === USER_TYPES.ADMIN) {
      return targetUserType !== USER_TYPES.ADMIN && targetUserType !== USER_TYPES.SYSTEM_ADMIN;
    }
    
    // Anyone (Principal, Dean, Teacher) can change password for Students
    if (targetUserType === USER_TYPES.STUDENT) {
      // But Students cannot change their own or other students' passwords via this menu
      return currentUserRole !== USER_TYPES.STUDENT;
    }
    
    // No one else can change passwords for non-students
    return false;
  };

  // Handle edit user
  const handleEditUser = (user: UserModel) => {
    setUserToEdit(user);
    setIsEditModalOpen(true);
  };
  
  // Handle edit modal close
  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setUserToEdit(null);
  };
  
  // Handle user updated - refresh the list
  const handleUserUpdated = () => {
    // Refresh the user list
    fetchUsers(false);
    // Notify parent to refresh counts (Classes component)
    if (onCountsChange) {
      onCountsChange();
    }
  };
  
  /* TODO: Uncomment when course enrollment functionality is implemented
  // Handle User Card Click - Open Profile Modal
  const handleUserCardClick = async (user: UserModel) => {
    setSelectedUserForProfile(user);
    setShowUserProfileModal(true);
    setIsLoadingProfile(true);
    
    try {
      // TODO: Replace with actual API call
      // const profileStats = await firebaseService.getUserProfileStats(user.userId);
      
      // Dummy data for testing
      const dummyEnrollments: EnrollmentInfo[] = [
        {
          examId: 'CRS001',
          examName: 'Data Structure and Algorithm in C++',
          subjectName: 'Computer Science',
          enrolledAt: new Date('2025-01-10T09:30:00'),
          status: 'completed',
          progress: 100,
          marks: 87,
          duration: '12h 55m',
          category: 'Coding',
          lectures: 63,
          exercises: 275,
          notes: 63,
          quizzes: 570,
          assessments: 5
        },
        {
          examId: 'CRS002',
          examName: 'Advanced Java Programming',
          subjectName: 'Programming',
          enrolledAt: new Date('2025-01-12T14:15:00'),
          status: 'completed',
          progress: 100,
          marks: 92,
          duration: '10h 30m',
          category: 'Coding',
          lectures: 45,
          exercises: 180,
          notes: 45,
          quizzes: 320,
          assessments: 4
        },
        {
          examId: 'CRS003',
          examName: 'Python for Data Science',
          subjectName: 'Data Science',
          enrolledAt: new Date('2025-01-14T11:00:00'),
          status: 'in_progress',
          progress: 65,
          duration: '15h 20m',
          category: 'Data Science',
          lectures: 58,
          exercises: 200,
          notes: 58,
          quizzes: 420,
          assessments: 6
        },
        {
          examId: 'CRS004',
          examName: 'Web Development with React',
          subjectName: 'Web Development',
          enrolledAt: new Date('2025-01-15T16:45:00'),
          status: 'in_progress',
          progress: 45,
          duration: '18h 45m',
          category: 'Web Dev',
          lectures: 72,
          exercises: 150,
          notes: 72,
          quizzes: 380,
          assessments: 8
        },
        {
          examId: 'CRS005',
          examName: 'Machine Learning Fundamentals',
          subjectName: 'AI/ML',
          enrolledAt: new Date('2025-01-16T10:00:00'),
          status: 'enrolled',
          progress: 25,
          duration: '14h 10m',
          category: 'AI/ML',
          lectures: 40,
          exercises: 120,
          notes: 40,
          quizzes: 290,
          assessments: 5
        }
      ];
      
      const dummyStats: UserProfileStats = {
        coursesEnrolled: 5,
        coursesCompleted: 2,
        coursesInProgress: 3,
        averageMarks: 78.5,
        totalAssessments: 28,
        assessmentsCompleted: 18,
        assessmentAverageMarks: 82.3,
        totalLearningHours: 72,
        averageLearningPerDay: '2.5 Hrs',
        enrollments: dummyEnrollments
      };
      
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setUserProfileStats(dummyStats);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfileStats(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };
  */
  
  // Close user profile modal
  const closeUserProfileModal = () => {
    setShowUserProfileModal(false);
    setSelectedUserForProfile(null);
    setUserProfileStats(null);
  };
  
  // Handle 3-dot menu toggle
  const handleMenuToggle = (userId: string) => {
    setOpenMenuUserId(openMenuUserId === userId ? null : userId);
  };
  
  // Handle click outside menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuUserId(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle disable user click
  const handleDisableClick = (user: UserModel) => {
    setUserToDisable(user);
    setShowDisableConfirm(true);
    setOpenMenuUserId(null); // Close menu
  };
  
  // Handle enable user click
  const handleEnableClick = (user: UserModel) => {
    setUserToDisable(user);
    setShowDisableConfirm(true);
    setOpenMenuUserId(null); // Close menu
  };
  
  // Handle change password click
  const handleChangePasswordClick = (user: UserModel) => {
    setUserForPasswordChange(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowChangePasswordModal(true);
    setOpenMenuUserId(null); // Close menu
  };
  
  // Handle change password submit
  const handleChangePasswordSubmit = async () => {
    if (!userForPasswordChange) return;
    
    // Validation
    if (!newPassword) {
      setPasswordError('Please enter a new password');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    setIsChangingPassword(true);
    setPasswordError(null);
    
    try {
      // Get current user for audit logging
      const currentUser = await firebaseService.getCurrentUserProfile();
      if (!currentUser) {
        throw new Error('You must be logged in to change passwords');
      }
      
      // Call Firebase service to change password
      const result = await firebaseService.changeUserPassword(userForPasswordChange.userId, newPassword, currentUser);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to change password');
      }
      
      // Close modal on success
      setShowChangePasswordModal(false);
      setUserForPasswordChange(null);
      setNewPassword('');
      setConfirmPassword('');
      
      // Success message is now shown inside ChangePassword modal
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  // Close change password modal
  const closeChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setUserForPasswordChange(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };
  
  // Confirm disable/enable user
  const confirmDisableUser = async () => {
    if (!userToDisable) return;
    
    const isCurrentlyDisabled = userToDisable.status === USER_STATUS.DISABLED;
    const newStatus = isCurrentlyDisabled ? USER_STATUS.ACTIVE : USER_STATUS.DISABLED;
    
    setIsDisabling(true);
    try {
      // Get current user for audit logging
      const currentUser = await firebaseService.getCurrentUserProfile();
      if (!currentUser) {
        throw new Error('You must be logged in to modify users');
      }
      
      await firebaseService.updateUserProfile(userToDisable.userId, {
        status: newStatus
      }, currentUser);
      
      // Refresh the list
      handleUserUpdated();
      
      // Close modal
      setShowDisableConfirm(false);
      setUserToDisable(null);
    } catch (error) {
      console.error(`Error ${isCurrentlyDisabled ? 'enabling' : 'disabling'} user:`, error);
      alert(`Failed to ${isCurrentlyDisabled ? 'enable' : 'disable'} user. Please try again.`);
    } finally {
      setIsDisabling(false);
    }
  };
  
  // Parse class info for display
  const [displayClassName, displayBoard, displayYear] = selectedClass.includes('|')
    ? selectedClass.split('|')
    : [selectedClass, null, null];


  return (
    <>
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div 
        className="px-6 py-4 border-b border-gray-200 flex-shrink-0"
        style={{ background: brandTheme.gradients.card }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: brandTheme.gradients.primary }}
            >
              <Users size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isAdministrativeView ? 'Administrative & Faculty' : displayClassName}
              </h2>
              <p className="text-sm text-gray-600">
                {isAdministrativeView 
                  ? 'Managing administrators, principals, deans & teachers'
                  : `${displayBoard || 'All Boards'} • ${displayYear || 'All Years'}`
                }
              </p>
            </div>
          </div>
          
          {/* Total Count Badge */}
          <div 
            className="px-4 py-2 rounded-xl text-white font-bold text-lg shadow-lg"
            style={{ background: brandTheme.gradients.primary }}
          >
            {totalUsers} Users
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent shadow-sm"
            style={{ '--tw-ring-color': brandTheme.colors.primary } as React.CSSProperties}
          />
        </div>

        {/* Role Filter Pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setFilterRole(FILTER_VALUES.ALL);
              setFilterStatus(USER_STATUS.ACTIVE); // Deactivate disabled filter
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              filterRole === FILTER_VALUES.ALL && filterStatus !== USER_STATUS.DISABLED
                ? 'text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={filterRole === FILTER_VALUES.ALL && filterStatus !== USER_STATUS.DISABLED ? { background: brandTheme.gradients.primary } : {}}
          >
            All ({roleCounts.total})
          </button>
          {isAdministrativeView ? (
            <>
              <button
                onClick={() => {
                  setFilterRole(USER_TYPES.ADMIN);
                  setFilterStatus(USER_STATUS.ACTIVE); // Deactivate disabled filter
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterRole === USER_TYPES.ADMIN && filterStatus !== USER_STATUS.DISABLED
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Admins ({roleCounts.admins})
              </button>
              <button
                onClick={() => {
                  setFilterRole(USER_TYPES.PRINCIPAL);
                  setFilterStatus(USER_STATUS.ACTIVE); // Deactivate disabled filter
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterRole === USER_TYPES.PRINCIPAL && filterStatus !== USER_STATUS.DISABLED
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Principals ({roleCounts.principals})
              </button>
              <button
                onClick={() => {
                  setFilterRole(USER_TYPES.DEAN);
                  setFilterStatus(USER_STATUS.ACTIVE); // Deactivate disabled filter
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterRole === USER_TYPES.DEAN && filterStatus !== USER_STATUS.DISABLED
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Deans ({roleCounts.deans})
              </button>
              <button
                onClick={() => {
                  setFilterRole(USER_TYPES.TEACHER);
                  setFilterStatus(USER_STATUS.ACTIVE); // Deactivate disabled filter
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterRole === USER_TYPES.TEACHER && filterStatus !== USER_STATUS.DISABLED
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Teachers ({roleCounts.teachers})
              </button>
              
              {/* Disabled Filter - mutually exclusive with all role filters */}
              <button
                onClick={() => {
                  if (filterStatus === USER_STATUS.DISABLED) {
                    setFilterStatus(USER_STATUS.ACTIVE);
                    setFilterRole(FILTER_VALUES.ALL); // Reset to All when deactivating
                  } else {
                    setFilterStatus(USER_STATUS.DISABLED);
                    setFilterRole(FILTER_VALUES.ALL); // Show ALL disabled users
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterStatus === USER_STATUS.DISABLED
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Disabled ({totalDisabledCount})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setFilterRole(USER_TYPES.STUDENT);
                  setFilterStatus(USER_STATUS.ACTIVE); // Deactivate disabled filter
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterRole === USER_TYPES.STUDENT && filterStatus !== USER_STATUS.DISABLED
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Students ({roleCounts.students})
              </button>
              <button
                onClick={() => {
                  setFilterRole(USER_TYPES.TEACHER);
                  setFilterStatus(USER_STATUS.ACTIVE); // Deactivate disabled filter
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterRole === USER_TYPES.TEACHER && filterStatus !== USER_STATUS.DISABLED
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Teachers ({roleCounts.teachers})
              </button>
              
              {/* Disabled Filter - mutually exclusive with all role filters */}
              <button
                onClick={() => {
                  if (filterStatus === USER_STATUS.DISABLED) {
                    setFilterStatus(USER_STATUS.ACTIVE);
                    setFilterRole(FILTER_VALUES.ALL); // Reset to All when deactivating
                  } else {
                    setFilterStatus(USER_STATUS.DISABLED);
                    setFilterRole(FILTER_VALUES.ALL); // Show ALL disabled users
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterStatus === USER_STATUS.DISABLED
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Disabled ({totalDisabledCount})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="px-6 py-4 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div 
                className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                style={{ borderColor: brandTheme.colors.primary, borderTopColor: 'transparent' }}
              />
              <p className="text-gray-600 font-medium">Loading users...</p>
            </div>
          </div>
        ) : searchFilteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <div className="relative inline-block mb-6">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: brandTheme.gradients.card }}
              >
                <Users size={40} style={{ color: brandTheme.colors.primary }} />
              </div>
            </div>
            <p className="text-gray-700 font-semibold text-lg mb-2">No users found</p>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'Try adjusting your search' : 'No users in this class'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {searchFilteredUsers.map((user) => {
              const isDisabled = user.status === USER_STATUS.DISABLED;
              
              return (
                <div
                  id={`user-card-${user.userId}`}
                  key={user.userId}
                  // TODO: Uncomment when course enrollment functionality is implemented
                  // onClick={() => handleUserCardClick(user)}
                  className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all ${
                    isDisabled ? 'opacity-60' : ''
                  } ${
                    highlightUserId === user.userId 
                      ? 'border-blue-500 shadow-lg shadow-blue-200 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                  onMouseEnter={(e) => {
                    if (!isDisabled && highlightUserId !== user.userId) {
                      e.currentTarget.style.borderColor = brandTheme.colors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (highlightUserId === user.userId) {
                      e.currentTarget.style.borderColor = '#3b82f6';
                    } else {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                  style={highlightUserId === user.userId ? {
                    animation: 'pulse 2s ease-in-out 3',
                    borderColor: '#3b82f6'
                  } : {}}
                >
                  <div className="flex items-start space-x-4">
                    {/* Avatar */}
                    <div 
                      className={`w-7 h-7 rounded flex items-center justify-center text-lg font-bold text-white flex-shrink-0 shadow-md ${
                        isDisabled ? 'grayscale' : ''
                      }`}
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      {(user.fullName || 'U').charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900 truncate">
                            {user.fullName || 'Unnamed User'}
                          </h3>
                          {isDisabled && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-red-100 text-red-700">
                              DISABLED
                            </span>
                          )}
                        </div>
                        
                        {/* 3-Dot Menu */}
                        {canEditUser(user.userType || USER_TYPES.STUDENT) && (
                          <div className="relative" ref={openMenuUserId === user.userId ? menuRef : null}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMenuToggle(user.userId);
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical size={18} className="text-gray-600" />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openMenuUserId === user.userId && (
                              <div className="absolute right-0 top-8 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditUser(user);
                                    setOpenMenuUserId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <Edit size={14} />
                                  <span>Edit User</span>
                                </button>
                                {canChangePassword(user.userType || USER_TYPES.STUDENT) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleChangePasswordClick(user);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                                  >
                                    <Key size={14} />
                                    <span>Change Password</span>
                                  </button>
                                )}
                                {isDisabled ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEnableClick(user);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center space-x-2"
                                  >
                                    <User size={14} />
                                    <span>Enable User</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDisableClick(user);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                                  >
                                    <UserX size={14} />
                                    <span>Disable User</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Contact Info - New Layout */}
                      <div className="space-y-2">
                        {/* Row 1: Roll Number (for Students), Email & Phone */}
                        {currentUserRole !== USER_TYPES.STUDENT && (user.studentRoll || user.email || user.phone) && (
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {/* Show Roll Number for students */}
                            {user.userType === USER_TYPES.STUDENT && user.studentRoll && (
                              <div className="flex items-center gap-1.5">
                                <Shield size={14} className="text-purple-400 flex-shrink-0" />
                                <span className="font-medium text-purple-600">{user.studentRoll}</span>
                              </div>
                            )}
                            {user.email && (
                              <div className="flex items-center gap-1.5">
                                <Mail size={14} className="text-gray-400 flex-shrink-0" />
                                <span className="truncate">{user.email}</span>
                              </div>
                            )}
                            {user.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone size={14} className="text-gray-400 flex-shrink-0" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Row 2: Subjects (for Teacher/Dean/Principal) */}
                        {(user.userType === USER_TYPES.TEACHER || user.userType === USER_TYPES.DEAN || user.userType === USER_TYPES.PRINCIPAL) && user.teacherSubjects && user.teacherSubjects.length > 0 && (
                          <div className="flex items-center text-xs text-gray-600">
                            <BookOpen size={14} className="text-purple-500 flex-shrink-0 mr-2" />
                            {user.teacherSubjects.map((subject, idx) => (
                              <span key={idx} className="flex items-center">
                                <span className="text-purple-600">{subject}</span>
                                {idx < (user.teacherSubjects?.length ?? 0) - 1 && <span className="mx-2 text-gray-300">|</span>}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Row 3: Role + Classes (for Teacher/Dean/Principal) */}
                        {(user.userType === USER_TYPES.TEACHER || user.userType === USER_TYPES.DEAN || user.userType === USER_TYPES.PRINCIPAL) && (
                          <div className="flex items-center text-xs text-gray-600">
                            <span className="text-purple-600 font-medium">
                              {(user.userType || USER_TYPES.TEACHER).charAt(0).toUpperCase() + (user.userType || USER_TYPES.TEACHER).slice(1)}
                            </span>
                            {user.teacherClasses && user.teacherClasses.length > 0 && (
                              <>
                                {user.teacherClasses.map((cls, idx) => (
                                  <span key={idx} className="flex items-center">
                                    <span className="mx-2 text-gray-300">|</span>
                                    <GraduationCap size={12} className="text-blue-500 mr-1" />
                                    <span>{cls}</span>
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        )}

                        {/* Row 2: Role + Class & Academic Year & Enrollments (for Students) */}
                        {user.userType === USER_TYPES.STUDENT && (
                          <div className="flex items-center text-xs text-gray-600">
                            <span className="text-purple-600 font-medium">Student</span>
                            {user.studentClass && (
                              <>
                                <span className="mx-2 text-gray-300">|</span>
                                <span className="flex items-center gap-1">
                                  <GraduationCap size={12} className="text-blue-500" />
                                  <span>{user.studentClass}</span>
                                </span>
                              </>
                            )}
                            {user.academicYear && (
                              <>
                                <span className="mx-2 text-gray-300">|</span>
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} className="text-indigo-500" />
                                  <span>{user.academicYear}</span>
                                </span>
                              </>
                            )}
                            {/* TODO: Uncomment when course enrollment functionality is implemented
                            <span className="mx-2 text-gray-300">|</span>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                _handleUserCardClick(user);
                              }}
                              className="flex items-center gap-1 cursor-pointer hover:text-green-700 transition-colors text-green-600"
                            >
                              <Layers size={12} />
                              <span>Enrollments: {user.enrollmentCount ?? 5}</span>
                            </span>
                            */}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Sticky Pagination Toolbar */}
      {!isLoading && users.length > 0 && (
        <div 
          className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 shadow-lg z-10"
          style={{ 
            background: 'linear-gradient(to top, white 0%, white 85%, rgba(255,255,255,0.95) 100%)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div className="flex items-center justify-between">
            {/* Left: Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                >
                  <Users size={16} style={{ color: brandTheme.colors.primary }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Loaded</p>
                  <p className="text-sm font-bold text-gray-900">{users.length} <span className="font-normal text-gray-500">/ {totalUsers}</span></p>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${totalUsers > 0 ? (users.length / totalUsers) * 100 : 0}%`,
                      background: brandTheme.gradients.primary
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {totalUsers > 0 ? Math.round((users.length / totalUsers) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Center: Quick Stats (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-3">
              {isAdministrativeView ? (
                <>
                  {roleCounts.admins > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      {roleCounts.admins} Admins
                    </span>
                  )}
                  {roleCounts.principals > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      {roleCounts.principals} Principals
                    </span>
                  )}
                  {roleCounts.deans > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {roleCounts.deans} Deans
                    </span>
                  )}
                  {roleCounts.teachers > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      {roleCounts.teachers} Teachers
                    </span>
                  )}
                </>
              ) : (
                <>
                  {roleCounts.teachers > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      {roleCounts.teachers} Teachers
                    </span>
                  )}
                </>
              )}
              {totalDisabledCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  {totalDisabledCount} Disabled
                </span>
              )}
            </div>

            {/* Right: Load More Button */}
            <div className="flex items-center gap-3">
              {hasMore ? (
                <button
                  onClick={() => fetchUsers(true)}
                  disabled={isLoadingMore}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all text-white shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">
                        +{Math.min(usersPerPage, totalUsers - users.length)}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl">
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">All Loaded</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Disable/Enable User Confirmation Modal */}
    {showDisableConfirm && userToDisable && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                userToDisable.status === USER_STATUS.DISABLED ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {userToDisable.status === USER_STATUS.DISABLED ? (
                  <User size={24} className="text-green-600" />
                ) : (
                  <AlertCircle size={24} className="text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {userToDisable.status === USER_STATUS.DISABLED ? 'Enable User' : 'Disable User'}
                </h3>
                <p className="text-sm text-gray-600">This action can be reversed later</p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-700 mb-4">
              Are you sure you want to {userToDisable.status === USER_STATUS.DISABLED ? 'enable' : 'disable'} <strong>{userToDisable.fullName}</strong>?
            </p>
            <div className={`border rounded-lg p-3 mb-4 ${
              userToDisable.status === USER_STATUS.DISABLED
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <p className={`text-sm ${
                userToDisable.status === USER_STATUS.DISABLED ? 'text-green-800' : 'text-yellow-800'
              }`}>
                <strong>Note:</strong> {userToDisable.status === USER_STATUS.DISABLED
                  ? 'This user will be able to login to the system again.'
                  : 'This user will no longer be able to login to the system. You can re-enable them later from the disabled users list.'
                }
              </p>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {currentUserRole !== USER_TYPES.STUDENT && <p><strong>Email:</strong> {userToDisable.email}</p>}
              <p><strong>Role:</strong> {(userToDisable.userType || USER_TYPES.STUDENT).toUpperCase()}</p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
            <button
              onClick={() => {
                setShowDisableConfirm(false);
                setUserToDisable(null);
              }}
              disabled={isDisabling}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDisableUser}
              disabled={isDisabling}
              className={`px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2 ${
                userToDisable.status === USER_STATUS.DISABLED
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isDisabling ? (
                <>
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                  <span>{userToDisable.status === USER_STATUS.DISABLED ? 'Enabling...' : 'Disabling...'}</span>
                </>
              ) : (
                <>
                  {userToDisable.status === USER_STATUS.DISABLED ? (
                    <User size={16} />
                  ) : (
                    <UserX size={16} />
                  )}
                  <span>{userToDisable.status === USER_STATUS.DISABLED ? 'Enable User' : 'Disable User'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit User Modal */}
    <CreateUserModal
      isOpen={isEditModalOpen}
      onClose={handleEditModalClose}
      activeCollegeId={activeCollegeId || ''}
      onUserAdded={handleUserUpdated}
      editUser={userToEdit}
      currentUserRole={currentUserRole}
    />

    {/* User Profile Slide-out Modal */}
    {showUserProfileModal && (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] transition-opacity"
          onClick={closeUserProfileModal}
        />
        
        {/* Slide-out Panel */}
        <div 
          className="fixed inset-2 left-auto w-[600px] bg-white shadow-2xl z-[9999] flex flex-col rounded-2xl overflow-hidden"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          {/* Header - Gradient */}
          <div 
            className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
            style={{ background: brandTheme.gradients.primary }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {(selectedUserForProfile?.fullName || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">
                  {selectedUserForProfile?.fullName || 'User'}
                </h3>
                <p className="text-sm text-white/80">
                  {selectedUserForProfile?.userType === USER_TYPES.STUDENT 
                    ? `${selectedUserForProfile?.studentRoll ? `${selectedUserForProfile.studentRoll} | ` : ''}${selectedUserForProfile?.studentClass || 'N/A'} | ${selectedUserForProfile?.academicYear || 'N/A'}`
                    : `${(selectedUserForProfile?.userType || '').charAt(0).toUpperCase() + (selectedUserForProfile?.userType || '').slice(1)}`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={closeUserProfileModal}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {isLoadingProfile ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div 
                  className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mb-3"
                  style={{ borderColor: brandTheme.colors.primary, borderTopColor: 'transparent' }}
                />
                <p className="text-sm text-gray-500">Loading profile...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Common Contact Info for All Users */}
                <div className="bg-gradient-to-r from-gray-50 to-slate-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={22} className="text-gray-600" />
                    <h4 className="text-lg font-bold text-gray-800">Profile Information</h4>
                  </div>
                <div className="grid grid-cols-2 gap-3">
                  {currentUserRole !== USER_TYPES.STUDENT && selectedUserForProfile?.email && (
                    <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Mail size={18} className="text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Email</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{selectedUserForProfile.email}</p>
                      </div>
                    </div>
                  )}
                  {selectedUserForProfile?.phone && (
                    <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Phone size={18} className="text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phone</p>
                        <p className="text-sm font-semibold text-gray-800">{selectedUserForProfile.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Student-specific: Class & Academic Year */}
                  {selectedUserForProfile?.userType === USER_TYPES.STUDENT && selectedUserForProfile?.studentClass && (
                    <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <GraduationCap size={18} className="text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Class</p>
                        <p className="text-sm font-semibold text-gray-800">{selectedUserForProfile.studentClass}</p>
                      </div>
                    </div>
                  )}
                  {selectedUserForProfile?.userType === USER_TYPES.STUDENT && selectedUserForProfile?.academicYear && (
                    <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Calendar size={18} className="text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Academic Year</p>
                        <p className="text-sm font-semibold text-gray-800">{selectedUserForProfile.academicYear}</p>
                      </div>
                    </div>
                  )}
                </div>
                </div>

                {/* ===== TEACHER / PRINCIPAL / DEAN PROFILE ===== */}
                {(selectedUserForProfile?.userType === USER_TYPES.TEACHER || 
                  selectedUserForProfile?.userType === USER_TYPES.PRINCIPAL || 
                  selectedUserForProfile?.userType === USER_TYPES.DEAN) && (
                  <>
                    {/* Subjects Taught Section */}
                    {selectedUserForProfile?.teacherSubjects && selectedUserForProfile.teacherSubjects.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 mt-4">
                          <BookOpen size={18} style={{ color: brandTheme.colors.primary }} />
                          <h4 className="text-base font-bold text-gray-800">Subjects Taught</h4>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg ml-auto">
                            {selectedUserForProfile.teacherSubjects.length} Subject(s)
                          </span>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                          {selectedUserForProfile.teacherSubjects.map((subject, idx) => {
                            // Subject icon mapping using FontAwesome Sharp Light
                            const getSubjectIcon = (subjectName: string): { icon: any; color: string; bg: string } => {
                              const name = subjectName.toLowerCase();
                              
                              // Programming Languages
                              if (name.includes('python')) return { icon: faCode, color: '#3776AB', bg: 'bg-blue-50' };
                              if (name.includes('java') && !name.includes('javascript')) return { icon: faCode, color: '#ED8B00', bg: 'bg-orange-50' };
                              if (name.includes('javascript') || name.includes('js')) return { icon: faFileCode, color: '#F7DF1E', bg: 'bg-yellow-50' };
                              if (name.includes('typescript') || name.includes('ts')) return { icon: faFileCode, color: '#3178C6', bg: 'bg-blue-50' };
                              if (name.includes('c++') || name.includes('cpp')) return { icon: faCode, color: '#00599C', bg: 'bg-blue-50' };
                              if (name.includes('c programming') || name === 'c') return { icon: faCode, color: '#A8B9CC', bg: 'bg-gray-100' };
                              if (name.includes('c#') || name.includes('csharp')) return { icon: faCode, color: '#68217A', bg: 'bg-purple-50' };
                              if (name.includes('ruby')) return { icon: faCode, color: '#CC342D', bg: 'bg-red-50' };
                              if (name.includes('php')) return { icon: faCode, color: '#777BB4', bg: 'bg-indigo-50' };
                              if (name.includes('swift')) return { icon: faCode, color: '#FA7343', bg: 'bg-orange-50' };
                              if (name.includes('kotlin')) return { icon: faCode, color: '#7F52FF', bg: 'bg-purple-50' };
                              if (name.includes('go') || name.includes('golang')) return { icon: faCode, color: '#00ADD8', bg: 'bg-cyan-50' };
                              if (name.includes('rust')) return { icon: faCode, color: '#DEA584', bg: 'bg-orange-50' };
                              if (name.includes('r programming') || name === 'r') return { icon: faChartPie, color: '#276DC3', bg: 'bg-blue-50' };
                              
                              // Web Development
                              if (name.includes('html')) return { icon: faFileCode, color: '#E34F26', bg: 'bg-orange-50' };
                              if (name.includes('css')) return { icon: faPalette, color: '#1572B6', bg: 'bg-blue-50' };
                              if (name.includes('react')) return { icon: faLaptopCode, color: '#61DAFB', bg: 'bg-cyan-50' };
                              if (name.includes('angular')) return { icon: faLaptopCode, color: '#DD0031', bg: 'bg-red-50' };
                              if (name.includes('vue')) return { icon: faLaptopCode, color: '#4FC08D', bg: 'bg-green-50' };
                              if (name.includes('node')) return { icon: faServer, color: '#339933', bg: 'bg-green-50' };
                              if (name.includes('web')) return { icon: faGlobe, color: '#4285F4', bg: 'bg-blue-50' };
                              
                              // Data & AI
                              if (name.includes('data structure') || name.includes('dsa')) return { icon: faCubes, color: '#6366F1', bg: 'bg-indigo-50' };
                              if (name.includes('algorithm')) return { icon: faGear, color: '#6B7280', bg: 'bg-gray-100' };
                              if (name.includes('machine learning') || name.includes('ml')) return { icon: faBrain, color: '#8B5CF6', bg: 'bg-purple-50' };
                              if (name.includes('artificial intelligence') || name.includes('ai')) return { icon: faRobot, color: '#EC4899', bg: 'bg-pink-50' };
                              if (name.includes('deep learning')) return { icon: faBrain, color: '#7C3AED', bg: 'bg-purple-50' };
                              if (name.includes('data science')) return { icon: faChartLine, color: '#10B981', bg: 'bg-green-50' };
                              if (name.includes('big data')) return { icon: faDatabase, color: '#3B82F6', bg: 'bg-blue-50' };
                              if (name.includes('database') || name.includes('sql')) return { icon: faDatabase, color: '#06B6D4', bg: 'bg-cyan-50' };
                              if (name.includes('mongodb') || name.includes('nosql')) return { icon: faDatabase, color: '#47A248', bg: 'bg-green-50' };
                              
                              // Computer Science
                              if (name.includes('operating system') || name.includes('os')) return { icon: faTerminal, color: '#1F2937', bg: 'bg-gray-100' };
                              if (name.includes('network')) return { icon: faNetworkWired, color: '#3B82F6', bg: 'bg-blue-50' };
                              if (name.includes('cyber') || name.includes('security')) return { icon: faShieldHalved, color: '#EF4444', bg: 'bg-red-50' };
                              if (name.includes('cloud')) return { icon: faCloud, color: '#0EA5E9', bg: 'bg-sky-50' };
                              if (name.includes('devops')) return { icon: faGear, color: '#6366F1', bg: 'bg-indigo-50' };
                              if (name.includes('computer')) return { icon: faLaptopCode, color: '#6B7280', bg: 'bg-gray-100' };
                              if (name.includes('software')) return { icon: faLayerGroup, color: '#3B82F6', bg: 'bg-blue-50' };
                              
                              // Mobile
                              if (name.includes('android')) return { icon: faMobileScreen, color: '#3DDC84', bg: 'bg-green-50' };
                              if (name.includes('ios')) return { icon: faMobileScreen, color: '#6B7280', bg: 'bg-gray-100' };
                              if (name.includes('flutter')) return { icon: faMobileScreen, color: '#02569B', bg: 'bg-cyan-50' };
                              if (name.includes('mobile')) return { icon: faMobileScreen, color: '#6366F1', bg: 'bg-indigo-50' };
                              
                              // Sciences
                              if (name.includes('physics')) return { icon: faAtom, color: '#3B82F6', bg: 'bg-blue-50' };
                              if (name.includes('chemistry')) return { icon: faFlask, color: '#10B981', bg: 'bg-green-50' };
                              if (name.includes('biology')) return { icon: faDna, color: '#059669', bg: 'bg-emerald-50' };
                              if (name.includes('math') || name.includes('calculus') || name.includes('algebra')) return { icon: faCalculator, color: '#6366F1', bg: 'bg-indigo-50' };
                              if (name.includes('statistics')) return { icon: faChartPie, color: '#8B5CF6', bg: 'bg-purple-50' };
                              
                              // Languages & Arts
                              if (name.includes('english')) return { icon: faLanguage, color: '#EF4444', bg: 'bg-red-50' };
                              if (name.includes('hindi')) return { icon: faLanguage, color: '#F97316', bg: 'bg-orange-50' };
                              if (name.includes('french')) return { icon: faLanguage, color: '#3B82F6', bg: 'bg-blue-50' };
                              if (name.includes('spanish')) return { icon: faLanguage, color: '#EAB308', bg: 'bg-yellow-50' };
                              if (name.includes('german')) return { icon: faLanguage, color: '#6B7280', bg: 'bg-gray-100' };
                              if (name.includes('history')) return { icon: faLandmark, color: '#D97706', bg: 'bg-amber-50' };
                              if (name.includes('geography')) return { icon: faGlobe, color: '#10B981', bg: 'bg-green-50' };
                              if (name.includes('economics')) return { icon: faCoins, color: '#EAB308', bg: 'bg-yellow-50' };
                              if (name.includes('commerce') || name.includes('business')) return { icon: faBriefcase, color: '#3B82F6', bg: 'bg-blue-50' };
                              if (name.includes('account')) return { icon: faCalculator, color: '#10B981', bg: 'bg-green-50' };
                              
                              // Others
                              if (name.includes('git')) return { icon: faCode, color: '#F05032', bg: 'bg-orange-50' };
                              if (name.includes('linux') || name.includes('unix')) return { icon: faTerminal, color: '#FCC624', bg: 'bg-yellow-50' };
                              if (name.includes('docker')) return { icon: faServer, color: '#2496ED', bg: 'bg-blue-50' };
                              if (name.includes('api')) return { icon: faNetworkWired, color: '#8B5CF6', bg: 'bg-purple-50' };
                              if (name.includes('testing')) return { icon: faWrench, color: '#10B981', bg: 'bg-green-50' };
                              if (name.includes('design')) return { icon: faPalette, color: '#EC4899', bg: 'bg-pink-50' };
                              if (name.includes('hardware') || name.includes('electronics')) return { icon: faMicrochip, color: '#6B7280', bg: 'bg-gray-100' };
                              
                              // Default
                              return { icon: faBookOpenFA, color: brandTheme.colors.primary, bg: 'bg-purple-50' };
                            };
                            
                            const { icon, color, bg } = getSubjectIcon(subject);
                            
                            return (
                              <div 
                                key={idx}
                                className={`flex items-center gap-3 px-4 py-3 ${
                                  idx !== (selectedUserForProfile.teacherSubjects?.length ?? 0) - 1 
                                    ? 'border-b border-dashed border-gray-200' 
                                    : ''
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                                  <FontAwesomeIcon icon={icon} className="text-base" style={{ color }} />
                                </div>
                                <span className="text-sm font-medium text-gray-800">{subject}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Classes Taught Section */}
                    {selectedUserForProfile?.teacherClasses && selectedUserForProfile.teacherClasses.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 mt-4">
                          <GraduationCap size={18} style={{ color: brandTheme.colors.primary }} />
                          <h4 className="text-base font-bold text-gray-800">Classes Taught</h4>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg ml-auto">
                            {selectedUserForProfile.teacherClasses.length} Class(es)
                          </span>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                          {selectedUserForProfile.teacherClasses.map((cls, idx) => (
                            <div 
                              key={idx}
                              className={`flex items-center gap-3 px-4 py-3 ${
                                idx !== (selectedUserForProfile.teacherClasses?.length ?? 0) - 1 
                                  ? 'border-b border-dashed border-gray-200' 
                                  : ''
                              }`}
                            >
                              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                <FontAwesomeIcon icon={faGraduationCapFA} className="text-base text-purple-500" />
                              </div>
                              <span className="text-sm font-medium text-gray-800">{cls}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* End of Profile for Teacher/Principal/Dean */}
                    <div className="flex flex-col items-center justify-center py-6 text-center mt-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-2 border-2 border-dashed border-gray-200">
                        <span className="text-xl">
                          {selectedUserForProfile?.userType === USER_TYPES.TEACHER ? '👨‍🏫' : 
                           selectedUserForProfile?.userType === USER_TYPES.PRINCIPAL ? '🏆' : '👔'}
                        </span>
                      </div>
                      <p className="font-medium text-gray-600 text-sm">End of Profile</p>
                    </div>
                  </>
                )}

                {/* ===== ADMIN PROFILE ===== */}
                {selectedUserForProfile?.userType === USER_TYPES.ADMIN && (
                  <>
                    {/* Admin Info Card */}
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border border-gray-100 shadow-sm mt-2">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                          <Shield size={20} className="text-gray-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-800">System Administrator</h4>
                          <p className="text-xs text-gray-500">Full system access</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <CheckCircle size={14} className="text-green-500" />
                          <span>User Management</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <CheckCircle size={14} className="text-green-500" />
                          <span>Course Management</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <CheckCircle size={14} className="text-green-500" />
                          <span>Reports Access</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <CheckCircle size={14} className="text-green-500" />
                          <span>Settings Control</span>
                        </div>
                      </div>
                    </div>

                    {/* End of Profile for Admin */}
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-2 border-2 border-dashed border-gray-200">
                        <span className="text-xl">⚙️</span>
                      </div>
                      <p className="font-medium text-gray-600 text-sm">End of Profile</p>
                    </div>
                  </>
                )}

                {/* ===== STUDENT PROFILE ===== */}
                {selectedUserForProfile?.userType === USER_TYPES.STUDENT && userProfileStats && (
                  <>
                    {/* Assessment Stats - Section Header */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 mt-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Target size={22} className="text-blue-600" />
                        <h4 className="text-lg font-bold text-blue-800">Assessments</h4>
                      </div>

                    {/* Assessment Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Total Assessments */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100">
                            <FileText size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.totalAssessments}</p>
                          </div>
                        </div>
                      </div>

                      {/* Assessments Completed */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-100">
                            <CheckCircle size={20} className="text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Completed</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.assessmentsCompleted}</p>
                          </div>
                        </div>
                      </div>

                      {/* Assessment Avg Marks */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100">
                            <BarChart3 size={20} className="text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Avg. %</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.assessmentAverageMarks}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Learning Stats - Section Header */}
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 mt-4 border border-purple-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock size={22} className="text-purple-600" />
                        <h4 className="text-lg font-bold text-purple-800">Learning Activity</h4>
                      </div>

                    {/* Learning Stats Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Total Learning Hours */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                          >
                            <Clock size={20} style={{ color: brandTheme.colors.primary }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total Learning</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.totalLearningHours} Hrs</p>
                          </div>
                        </div>
                      </div>

                      {/* Average Learning Per Day */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-100">
                            <TrendingUp size={20} className="text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Avg/Day</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.averageLearningPerDay}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Enrolled Courses Section Header */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-100 rounded-xl p-4 mt-4 border border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Layers size={22} className="text-green-600" />
                          <h4 className="text-lg font-bold text-green-800">Enrolled Courses</h4>
                        </div>
                        <span className="text-xs font-semibold text-green-700 bg-white px-2.5 py-1 rounded-lg border border-green-200">
                          {userProfileStats.enrollments.length} Courses
                        </span>
                      </div>

                    {/* Course Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Courses Enrolled */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                          >
                            <BookOpen size={20} style={{ color: brandTheme.colors.primary }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Enrolled</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.coursesEnrolled}</p>
                          </div>
                        </div>
                      </div>

                      {/* Courses Completed */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-100">
                            <CheckCircle size={20} className="text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Completed</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.coursesCompleted}</p>
                          </div>
                        </div>
                      </div>

                      {/* Average Marks */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-100">
                            <Award size={20} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Avg. Marks</p>
                            <p className="text-xl font-bold text-gray-900">{userProfileStats.averageMarks}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Enrolled Courses List */}
                    {userProfileStats.enrollments.map((enrollment, index) => (
                      <div 
                        key={enrollment.examId || index}
                        className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all hover:border-gray-300"
                      >
                        {/* Header Row - Icon, Title & ID */}
                        <div className="flex items-start gap-4 mb-4">
                          {/* Thumbnail */}
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                          >
                            <BookOpen size={24} style={{ color: brandTheme.colors.primary }} />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {enrollment.examName || 'Unnamed Course'}
                              </h3>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md ml-2 flex-shrink-0">
                                ID: {enrollment.examId.toUpperCase().slice(0, 8)}
                              </span>
                            </div>
                            {/* Second row: Lectures | Duration | Category */}
                            <p className="text-xs text-gray-600 flex items-center gap-3">
                              <span className="flex items-center">
                                <FileText size={12} className="mr-1" />
                                <span className="font-medium">{enrollment.lectures || 12} Lectures</span>
                              </span>
                              <span className="flex items-center">
                                <Clock size={12} className="mr-1" />
                                <span>{enrollment.duration || '2h 30m'}</span>
                              </span>
                              <span className="flex items-center">
                                <GraduationCap size={12} className="mr-1" />
                                <span>{enrollment.category || 'General'}</span>
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Stats Box - Exercises, Notes, Quizzes, Assessments */}
                        <div 
                          className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-400 text-xl font-mono">&lt;/&gt;</span>
                            <div>
                              <p className="text-xs text-gray-500">Exercises</p>
                              <p className="text-base font-semibold text-gray-900">{enrollment.exercises || 25}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <FileText size={20} className="text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Notes</p>
                              <p className="text-base font-semibold text-gray-900">{enrollment.notes || 8}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <CheckCircle size={20} className="text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Quizzes</p>
                              <p className="text-base font-semibold text-gray-900">{enrollment.quizzes || 15}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <BookOpen size={20} className="text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Assessments</p>
                              <p className="text-base font-semibold text-gray-900">{enrollment.assessments || 3}</p>
                            </div>
                          </div>
                        </div>

                        {/* Footer - Progress/Marks & Assigned Date */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            {/* Progress or Marks */}
                            {(enrollment.progress || 0) >= 100 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-sm text-green-700 bg-gradient-to-r from-green-50 to-green-100">
                                <CheckCircle size={12} />
                                {enrollment.marks || 85}% Marks
                              </span>
                            ) : (
                              <span className={`inline-flex items-center text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-sm ${
                                (enrollment.progress || 0) >= 50
                                  ? 'text-purple-700 bg-gradient-to-r from-purple-50 to-purple-100'
                                  : (enrollment.progress || 0) > 0
                                  ? 'text-orange-700 bg-gradient-to-r from-orange-50 to-orange-100'
                                  : 'text-gray-600 bg-gradient-to-r from-gray-50 to-gray-100'
                              }`}>
                                {enrollment.progress || 0}% Completed
                              </span>
                            )}
                          </div>
                          
                          {/* Assigned Date */}
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar size={12} className="mr-1.5" />
                            <span>Assigned: {enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString('en-US', { 
                              day: 'numeric',
                              month: 'short', 
                              year: 'numeric'
                            }) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* End of Profile for Student */}
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-2 border-2 border-dashed border-gray-200">
                        <span className="text-xl">🎓</span>
                      </div>
                      <p className="font-medium text-gray-600 text-sm">End of Profile</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Animation keyframes */}
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
        `}</style>
      </>
    )}

    {/* Change Password Slide-out Modal */}
    {showChangePasswordModal && userForPasswordChange && (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 z-[9999]"
          onClick={closeChangePasswordModal}
        />
        
        {/* Slide-out Panel from Right */}
        <div 
          className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl z-[10000] overflow-hidden rounded-2xl"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          {/* Header */}
          <div 
            className="px-6 py-5 border-b border-gray-200"
            style={{ background: brandTheme.gradients.card }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
                >
                  <Key size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
                  <p className="text-sm text-gray-600">Set a new password for this user</p>
                </div>
              </div>
              <button
                onClick={closeChangePasswordModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
            {/* User Info Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-md"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  {(userForPasswordChange.fullName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{userForPasswordChange.fullName || 'Unnamed User'}</h3>
                  <p className="text-sm text-gray-600">{userForPasswordChange.email}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 mt-1">
                    {(userForPasswordChange.userType || 'student').charAt(0).toUpperCase() + (userForPasswordChange.userType || 'student').slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Password Form */}
            <div className="space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900"
                    style={{ '--tw-ring-color': brandTheme.colors.primary } as React.CSSProperties}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Re-enter New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    placeholder="Re-enter new password"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900"
                    style={{ '--tw-ring-color': brandTheme.colors.primary } as React.CSSProperties}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
                  <AlertCircle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* Password Requirements */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">Password Requirements:</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li className={`flex items-center space-x-2 ${newPassword.length >= 6 ? 'text-green-600' : ''}`}>
                    <span>{newPassword.length >= 6 ? '✓' : '•'}</span>
                    <span>At least 6 characters</span>
                  </li>
                  <li className={`flex items-center space-x-2 ${newPassword && confirmPassword && newPassword === confirmPassword ? 'text-green-600' : ''}`}>
                    <span>{newPassword && confirmPassword && newPassword === confirmPassword ? '✓' : '•'}</span>
                    <span>Passwords must match</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer with Buttons */}
          <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-white border-t border-gray-200">
            <div className="flex space-x-3">
              <button
                onClick={closeChangePasswordModal}
                disabled={isChangingPassword}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={handleChangePasswordSubmit}
                disabled={isChangingPassword || !newPassword || !confirmPassword}
                className="flex-1 px-4 py-3 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                style={{ background: brandTheme.gradients.primary }}
              >
                {isChangingPassword ? (
                  <>
                    <Clock size={18} className="animate-spin" />
                    <span>Changing...</span>
                  </>
                ) : (
                  <>
                    <Key size={18} />
                    <span>Change Password</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </>
    )}

    </>
  );
}