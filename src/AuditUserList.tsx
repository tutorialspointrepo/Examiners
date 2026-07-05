import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faUser,
  faEnvelope,
  faIdBadge,
  faUserTag,
  faChevronLeft,
  faChevronRight,
  faEye,
  faGraduationCap,
  faChalkboardUser,
  faUserTie
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService, type UserModel } from './services/firebase_service';
import { useBrand } from './BrandContext';

interface AuditUserListProps {
  collegeId: string;
  onUserSelect: (user: UserModel | null) => void;
  selectedUser?: UserModel | null;
  onCollapse: () => void;
}

const AuditUserList: React.FC<AuditUserListProps> = ({ collegeId, onUserSelect, selectedUser, onCollapse }) => {
  const brandTheme = useBrand();
  const [users, setUsers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [allClasses, setAllClasses] = useState<string[]>([]);
  const [pageCursors, setPageCursors] = useState<any[]>([]); // Store cursors for each page
  
  const usersPerPage = 10; // Changed to 10 for testing

  useEffect(() => {
    loadUsers(true, 'reset');
    loadClasses();
  }, [collegeId, userTypeFilter, classFilter]);

  const loadClasses = async () => {
    try {
      const collegeDoc = await firebaseService.getCollegeById(collegeId);
      if (collegeDoc && collegeDoc.validClasses) {
        setAllClasses(collegeDoc.validClasses);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadUsers = async (reset: boolean = false, direction: 'next' | 'prev' | 'reset' = 'reset') => {
    try {
      setLoading(true);
      
      let cursor = undefined;
      let newPage = page;
      
      if (direction === 'next') {
        cursor = lastVisible;
        newPage = page + 1;
      } else if (direction === 'prev' && page > 1) {
        // Get cursor for previous page (page - 2 because array is 0-indexed)
        cursor = page > 2 ? pageCursors[page - 3] : undefined;
        newPage = page - 1;
      } else if (reset || direction === 'reset') {
        cursor = undefined;
        newPage = 1;
        setPageCursors([]); // Clear page cursors on reset
      }
      
      // Use database-level pagination
      const result = await firebaseService.getUsersByCollegePaginated(
        collegeId,
        usersPerPage,
        cursor,
        userTypeFilter,
        classFilter
      );

      setUsers(result.users);
      setHasMore(result.hasMore);
      setLastVisible(result.lastDoc);
      setPage(newPage);
      
      // Store cursor for this page (for prev navigation)
      if (direction === 'next' && result.lastDoc) {
        setPageCursors(prev => [...prev, lastVisible]);
      } else if (reset || direction === 'reset') {
        setPageCursors([]);
      }
      
      // Auto-select first user on initial load (page 1 and no selection)
      if ((reset || newPage === 1) && result.users.length > 0 && !selectedUser) {
        console.log('🎯 [AUTO-SELECT] Selecting first user:', result.users[0].fullName);
        onUserSelect(result.users[0]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      loadUsers(false, 'next');
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      loadUsers(false, 'prev');
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType.toLowerCase()) {
      case 'student':
        return faGraduationCap;
      case 'teacher':
        return faChalkboardUser;
      case 'admin':
      case 'dean':
      case 'principal':
        return faUserTie;
      default:
        return faUser;
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType.toLowerCase()) {
      case 'student':
        return 'bg-blue-100 text-blue-700';
      case 'teacher':
        return 'bg-green-100 text-green-700';
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'dean':
        return 'bg-orange-100 text-orange-700';
      case 'principal':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      user.fullName?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.studentRoll?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="h-full flex flex-col bg-white animate-fadeIn">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              User Audit Trail
            </h2>
            <p className="text-gray-600 mt-1">
              Select a user to view their complete activity log and browsing history
            </p>
          </div>
          <button 
            onClick={onCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Collapse panel"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-gray-600" />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, email, or roll number"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
            />
          </div>

          <div>
            <select
              value={userTypeFilter}
              onChange={(e) => {
                setUserTypeFilter(e.target.value);
                setPage(1);
                onUserSelect(null); // Clear selection when filter changes
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
            >
              <option value="all">All User Types</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Admins</option>
              <option value="dean">Deans</option>
              <option value="principal">Principals</option>
            </select>
          </div>

          <div>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
                onUserSelect(null); // Clear selection when filter changes
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
            >
              <option value="all">All Classes</option>
              {allClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading && users.length === 0 ? (
          // Loading State - Same style as Result.tsx
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
              style={{ 
                borderColor: brandTheme.colors.primary + '20',
                borderTopColor: brandTheme.colors.primary
              }}
            />
            <p className="text-gray-600 font-medium">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FontAwesomeIcon icon={faUser} className="text-6xl mb-4 text-gray-300" />
            <p className="text-lg font-medium">No users found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div
                key={user.userId}
                className={`flex items-center p-4 rounded-lg cursor-pointer transition-all border ${
                  selectedUser?.userId === user.userId
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => {
                  console.log('🖱️ [USER CARD] Clicked user:', user.fullName, user.userId);
                  onUserSelect(user);
                }}
              >
                {/* Avatar */}
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  {user.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>

                {/* User Info */}
                <div className="flex-1 ml-4 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{user.fullName}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${getUserTypeColor(user.userType)}`}>
                      <FontAwesomeIcon icon={getUserTypeIcon(user.userType)} className="mr-1" />
                      {user.userType.charAt(0).toUpperCase() + user.userType.slice(1)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    {user.studentRoll && (
                      <div className="flex items-center">
                        <FontAwesomeIcon icon={faIdBadge} className="w-4 mr-2 text-gray-400" />
                        <span>{user.studentRoll}</span>
                      </div>
                    )}

                    {user.studentClass && (
                      <div className="flex items-center">
                        <FontAwesomeIcon icon={faUserTag} className="w-4 mr-2 text-gray-400" />
                        <span>{user.studentClass}</span>
                      </div>
                    )}

                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faEnvelope} className="w-4 mr-2 text-gray-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                </div>

                {/* Selection Indicator */}
                {selectedUser?.userId === user.userId && (
                  <div className="ml-4 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <FontAwesomeIcon icon={faEye} className="text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && filteredUsers.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {users.length} user{users.length !== 1 ? 's' : ''} (Page {page})
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handlePrevPage}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
                Previous
              </button>
              
              <div className="px-4 py-2 border border-gray-300 rounded-lg bg-white font-medium">
                Page {page}
              </div>
              
              <button
                onClick={handleNextPage}
                disabled={!hasMore}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Next
                <FontAwesomeIcon icon={faChevronRight} className="ml-2" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditUserList;