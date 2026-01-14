import { useState, useEffect, useRef } from 'react';
import { Users, Mail, Phone, User, Calendar, Shield, BookOpen, GraduationCap, Search, ChevronLeft, ChevronRight, Layers, Edit, MoreVertical, UserX, AlertCircle } from 'lucide-react';
import { firebaseService, type UserModel } from './services/firebase_service';
import CreateUserModal from './CreateUserModal';
import { USER_TYPES, USER_STATUS, FILTER_VALUES } from './constants';

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
  highlightUserId = null
}: UserListProps) {
  const [users, setUsers] = useState<UserModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<typeof FILTER_VALUES.ALL | typeof USER_TYPES.STUDENT | typeof USER_TYPES.TEACHER | typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN>(FILTER_VALUES.ALL);
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserModel | null>(null);
  
  // 3-dot menu state
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Disable confirmation modal state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [userToDisable, setUserToDisable] = useState<UserModel | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);
  
  // Status filter state
  const [filterStatus, setFilterStatus] = useState<typeof USER_STATUS.ACTIVE | typeof USER_STATUS.DISABLED | typeof FILTER_VALUES.ALL>(FILTER_VALUES.ALL);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const usersPerPage = 10;
  
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

  // Fetch users from Firebase with pagination
  useEffect(() => {
    const fetchUsers = async () => {
      if (!activeCollegeId || !selectedClass) {
        setUsers([]);
        setTotalUsers(0);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔍 Fetching page', currentPage, 'for class:', selectedClass, 'with filter:', filterRole);

        // Check if it's the administrative/faculty selection
        if (selectedClass === '_administrative') {
          // Fetch administrative users with pagination and role filter
          const userTypes: (typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN | typeof USER_TYPES.TEACHER)[] = [USER_TYPES.ADMIN, USER_TYPES.PRINCIPAL, USER_TYPES.DEAN, USER_TYPES.TEACHER];
          const result = await firebaseService.getUsersByTypePaginated(
            userTypes,
            activeCollegeId,
            usersPerPage,
            currentPage,
            filterRole as typeof FILTER_VALUES.ALL | typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN | typeof USER_TYPES.TEACHER
          );

          setUsers(result.users);
          setTotalUsers(result.total);
          
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
            currentPage,
            filterRole as typeof FILTER_VALUES.ALL | typeof USER_TYPES.STUDENT | typeof USER_TYPES.TEACHER
          );

          setUsers(result.users);
          setTotalUsers(result.total);

          console.log('✅ Users loaded:', result.users.length, 'of', result.total);
        }
      } catch (error) {
        console.error('❌ Error fetching users:', error);
        setUsers([]);
        setTotalUsers(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
    
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
              entityId: selectedClass,
              details: JSON.stringify({
                className: selectedClass,
                filterRole: filterRole,
                page: currentPage,
                usersPerPage: usersPerPage
              })
            });
          }
        } catch (logError) {
          console.warn('⚠️ Failed to log user list view:', logError);
        }
      })();
    }
  }, [activeCollegeId, selectedClass, currentPage, filterRole]); // Added filterRole to dependencies

  // Fetch role counts independently (for filter buttons)
  useEffect(() => {
    const fetchRoleCounts = async () => {
      if (!activeCollegeId || !selectedClass) {
        setRoleCounts({
          students: 0,
          teachers: 0,
          admins: 0,
          principals: 0,
          deans: 0,
          total: 0
        });
        setTotalDisabledCount(0);
        return;
      }

      try {
        if (selectedClass === '_administrative') {
          // Fetch counts for administrative users (active only)
          const [adminResult, principalResult, deanResult, teacherResult] = await Promise.all([
            firebaseService.getUsersByTypePaginated([USER_TYPES.ADMIN], activeCollegeId, 999, 1, USER_TYPES.ADMIN),
            firebaseService.getUsersByTypePaginated([USER_TYPES.PRINCIPAL], activeCollegeId, 999, 1, USER_TYPES.PRINCIPAL),
            firebaseService.getUsersByTypePaginated([USER_TYPES.DEAN], activeCollegeId, 999, 1, USER_TYPES.DEAN),
            firebaseService.getUsersByTypePaginated([USER_TYPES.TEACHER], activeCollegeId, 999, 1, USER_TYPES.TEACHER)
          ]);
          
          // Count only active users for each role
          const activeAdmins = adminResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) !== USER_STATUS.DISABLED).length;
          const activePrincipals = principalResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) !== USER_STATUS.DISABLED).length;
          const activeDeans = deanResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) !== USER_STATUS.DISABLED).length;
          const activeTeachers = teacherResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) !== USER_STATUS.DISABLED).length;
          
          // Count total disabled users across all roles
          const totalDisabled = 
            adminResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) === USER_STATUS.DISABLED).length +
            principalResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) === USER_STATUS.DISABLED).length +
            deanResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) === USER_STATUS.DISABLED).length +
            teacherResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) === USER_STATUS.DISABLED).length;
          
          const total = activeAdmins + activePrincipals + activeDeans + activeTeachers;
          
          setRoleCounts({
            students: 0,
            teachers: activeTeachers,
            admins: activeAdmins,
            principals: activePrincipals,
            deans: activeDeans,
            total: total
          });
          setTotalDisabledCount(totalDisabled);
        } else {
          // Fetch counts for class users
          const [className, board, academicYear] = selectedClass.includes('|') 
            ? selectedClass.split('|')
            : [selectedClass, null, null];

          const [studentResult, teacherResult] = await Promise.all([
            firebaseService.getUsersByClassPaginated(className, board, academicYear, activeCollegeId, 999, 1, USER_TYPES.STUDENT),
            firebaseService.getUsersByClassPaginated(className, board, academicYear, activeCollegeId, 999, 1, USER_TYPES.TEACHER)
          ]);
          
          // Count only active users for each role
          const activeStudents = studentResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) !== USER_STATUS.DISABLED).length;
          const activeTeachers = teacherResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) !== USER_STATUS.DISABLED).length;
          
          // Count total disabled users across all roles
          const totalDisabled = 
            studentResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) === USER_STATUS.DISABLED).length +
            teacherResult.users.filter(u => (u.status || USER_STATUS.ACTIVE) === USER_STATUS.DISABLED).length;
          
          const total = activeStudents + activeTeachers;
          
          setRoleCounts({
            students: activeStudents,
            teachers: activeTeachers,
            admins: 0,
            principals: 0,
            deans: 0,
            total: total
          });
          setTotalDisabledCount(totalDisabled);
        }
      } catch (error) {
        console.error('❌ Error fetching role counts:', error);
      }
    };

    fetchRoleCounts();
  }, [activeCollegeId, selectedClass]); // Only when class/college changes, NOT filter

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, filterRole, filterStatus, searchQuery]);

  // Filter users based on search and status
  const searchFilteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = searchQuery
      ? (user.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (user.phone?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      : true;
    
    // Status filter - treat missing/undefined status as 'active'
    const userStatus = user.status || USER_STATUS.ACTIVE;
    const matchesStatus = filterStatus === FILTER_VALUES.ALL
      ? true 
      : userStatus === filterStatus;
    
    return matchesSearch && matchesStatus;
  });


  const isAdministrativeView = selectedClass === '_administrative';
  
  // Helper function to check if current user can edit target user
  const canEditUser = (targetUserType: string): boolean => {
    // Teachers and students cannot edit anyone
    if (currentUserRole === USER_TYPES.TEACHER || currentUserRole === USER_TYPES.STUDENT) {
      return false;
    }
    
    // Super Admin and System Admin can modify Admin, Dean, Principal, Teachers and Students
    if (isSuperUser || currentUserRole === USER_TYPES.SYSTEM_ADMIN) {
      return ([USER_TYPES.ADMIN, USER_TYPES.DEAN, USER_TYPES.PRINCIPAL, USER_TYPES.TEACHER, USER_TYPES.STUDENT] as string[]).includes(targetUserType);
    }
    
    // Admin can modify Dean, Principal, Teachers and Students
    if (currentUserRole === USER_TYPES.ADMIN) {
      return ([USER_TYPES.DEAN, USER_TYPES.PRINCIPAL, USER_TYPES.TEACHER, USER_TYPES.STUDENT] as string[]).includes(targetUserType);
    }
    
    // Dean can modify Principal, Teachers and Students
    if (currentUserRole === USER_TYPES.DEAN) {
      return ([USER_TYPES.PRINCIPAL, USER_TYPES.TEACHER, USER_TYPES.STUDENT] as string[]).includes(targetUserType);
    }
    
    // Principal can modify Teachers and Students
    if (currentUserRole === USER_TYPES.PRINCIPAL) {
      return ([USER_TYPES.TEACHER, USER_TYPES.STUDENT] as string[]).includes(targetUserType);
    }
    
    return false;
  };
  
  // Handle edit button click
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
    // Trigger refresh by changing currentPage briefly
    const page = currentPage;
    setCurrentPage(0);
    setTimeout(() => setCurrentPage(page), 10);
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

  const getRoleBadgeColor = (userType: string) => {
    switch (userType) {
      case USER_TYPES.STUDENT:
        return { bg: 'bg-blue-100', text: 'text-blue-700' };
      case USER_TYPES.TEACHER:
        return { bg: 'bg-purple-100', text: 'text-purple-700' };
      case USER_TYPES.PRINCIPAL:
        return { bg: 'bg-red-100', text: 'text-red-700' };
      case USER_TYPES.DEAN:
        return { bg: 'bg-indigo-100', text: 'text-indigo-700' };
      case USER_TYPES.ADMIN:
        return { bg: 'bg-orange-100', text: 'text-orange-700' };
      case USER_TYPES.SYSTEM_ADMIN:
        return { bg: 'bg-pink-100', text: 'text-pink-700' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700' };
    }
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto h-[calc(100vh-80px)] user-list-container [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-5">
        <div className="mb-4">
          <div className="flex items-center space-x-3 mb-2">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: brandTheme.gradients.primary }}
            >
              {isAdministrativeView ? <Users size={24} className="text-white" /> : <GraduationCap size={24} className="text-white" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isAdministrativeView ? 'Administrative & Faculty' : `Class ${displayClassName}`}
              </h2>
              <p className="text-sm text-gray-600">
                {roleCounts.total} Total User{roleCounts.total !== 1 ? 's' : ''}{displayBoard ? ` • ${displayBoard}` : ''}{displayYear ? ` • ${displayYear}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={currentUserRole === USER_TYPES.STUDENT ? "Search by name..." : "Search by name, email, or phone..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm focus:outline-none transition-all"
            style={{
              borderColor: searchQuery ? brandTheme.colors.primary : '#e5e7eb'
            }}
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
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
      <div className="px-6 py-4">
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
              const roleBadge = getRoleBadgeColor(user.userType || USER_TYPES.STUDENT);
              const isDisabled = user.status === USER_STATUS.DISABLED;
              
              return (
                <div
                  id={`user-card-${user.userId}`}
                  key={user.userId}
                  className={`bg-white border-2 rounded-xl p-4 hover:shadow-md transition-all ${
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
                        <div className="flex-1 flex items-center space-x-2">
                          <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
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
                              onClick={() => handleMenuToggle(user.userId)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical size={18} className="text-gray-600" />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openMenuUserId === user.userId && (
                              <div className="absolute right-0 top-8 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                                <button
                                  onClick={() => {
                                    handleEditUser(user);
                                    setOpenMenuUserId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <Edit size={14} />
                                  <span>Edit User</span>
                                </button>
                                {isDisabled ? (
                                  <button
                                    onClick={() => handleEnableClick(user)}
                                    className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center space-x-2"
                                  >
                                    <User size={14} />
                                    <span>Enable User</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDisableClick(user)}
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

                      {/* Contact Info */}
                      <div className="space-y-1.5">
                        {/* Email and Phone - Only visible to non-students */}
                        {currentUserRole !== USER_TYPES.STUDENT && user.email && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Mail size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        )}
                        {currentUserRole !== USER_TYPES.STUDENT && user.phone && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone size={14} className="text-gray-400 flex-shrink-0" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                        {(user.userType === USER_TYPES.TEACHER || user.userType === USER_TYPES.DEAN || user.userType === USER_TYPES.PRINCIPAL) && user.teacherSubjects && user.teacherSubjects.length > 0 && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <BookOpen size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-medium">Subjects:</span>
                            <div className="flex flex-wrap gap-1">
                              {user.teacherSubjects.map((subject, idx) => (
                                <span key={idx} className="inline-block bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded">
                                  {subject}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(user.userType === USER_TYPES.TEACHER || user.userType === USER_TYPES.DEAN || user.userType === USER_TYPES.PRINCIPAL) && user.teacherClasses && user.teacherClasses.length > 0 && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <GraduationCap size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-medium">Classes:</span>
                            <div className="flex flex-wrap gap-1">
                              {user.teacherClasses.map((cls, idx) => (
                                <span key={idx} className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                                  {cls}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(user.userType === USER_TYPES.TEACHER || user.userType === USER_TYPES.DEAN || user.userType === USER_TYPES.PRINCIPAL) && user.board && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Layers size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-medium">Board:</span>
                            <span className="inline-block bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded">
                              {user.board}
                            </span>
                          </div>
                        )}
                        {user.userType === USER_TYPES.STUDENT && user.studentClass && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <GraduationCap size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-medium">Class:</span>
                            <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                              {user.studentClass}
                            </span>
                          </div>
                        )}
                        {user.userType === USER_TYPES.STUDENT && user.board && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Layers size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-medium">Board:</span>
                            <span className="inline-block bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded">
                              {user.board}
                            </span>
                          </div>
                        )}
                        {user.userType === USER_TYPES.STUDENT && user.academicYear && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500 font-medium">Academic Year:</span>
                            <span className="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">
                              {user.academicYear}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Role Badge */}
                      <div className="mt-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${roleBadge.bg} ${roleBadge.text}`}>
                          <Shield size={12} className="mr-1" />
                          {(user.userType || USER_TYPES.STUDENT).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && searchFilteredUsers.length > 0 && (
          <div className="mt-6 flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                    // Scroll to top of user list
                    document.querySelector('.user-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-all ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-md'
                }`}
                style={currentPage > 1 ? {
                  borderColor: brandTheme.colors.primary + '40'
                } : {}}
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.ceil(totalUsers / usersPerPage) }, (_, i) => i + 1)
                  .filter(page => {
                    // Show first page, last page, current page, and pages around current
                    const totalPages = Math.ceil(totalUsers / usersPerPage);
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    );
                  })
                  .map((page, index, array) => {
                    // Add ellipsis
                    const prevPage = array[index - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;

                    return (
                      <div key={page} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => {
                            setCurrentPage(page);
                            document.querySelector('.user-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`min-w-[40px] h-10 rounded-lg font-semibold transition-all ${
                            currentPage === page
                              ? 'text-white shadow-md'
                              : 'text-gray-700 bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                          style={currentPage === page ? {
                            background: brandTheme.gradients.primary
                          } : {}}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                onClick={() => {
                  if (currentPage < Math.ceil(totalUsers / usersPerPage)) {
                    setCurrentPage(currentPage + 1);
                    document.querySelector('.user-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                disabled={currentPage >= Math.ceil(totalUsers / usersPerPage)}
                className={`p-2 rounded-lg transition-all ${
                  currentPage >= Math.ceil(totalUsers / usersPerPage)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-md'
                }`}
                style={currentPage < Math.ceil(totalUsers / usersPerPage) ? {
                  borderColor: brandTheme.colors.primary + '40'
                } : {}}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
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
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
    </>
  );
}