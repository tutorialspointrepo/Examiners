import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser, 
  faShield,
  faUsers, 
  faXmark, 
  faMapMarkerAlt,
  faCrown,
  faBolt,
  faGraduationCap,
  faBooks,
  faBackpack,
  faUserCircle
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { type UserType } from './constants';

interface ProfileDropdownProps {
  user: {
    name: string;
    email: string;
    role: UserType;
    roleName?: string;
    avatar?: string;
    organization?: string;
    organizationId?: string;
  };
  onEditProfile?: () => void;
  onDownloadBrowser?: () => void;
  onManageUsers?: () => void;
  onViewLoginDetails?: () => void;
  onProfileClick?: () => void;
  onSignOut: () => void;
  isSecureBrowser?: boolean;
}

export default function ProfileDropdown({
  user,
  onEditProfile,
  onDownloadBrowser,
  onManageUsers,
  onViewLoginDetails,
  onSignOut,
  isSecureBrowser = false
}: ProfileDropdownProps) {
  const brand = useBrand();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getRoleDisplayName = () => {
    if (user.roleName) return user.roleName;
    
    const roleNames: Record<string, string> = {
      super_admin: 'Super_admin',
      admin: 'Admin',
      principal: 'Principal',
      teacher: 'Teacher',
      student: 'Student'
    };
    return roleNames[user.role] || 'User';
  };

  const getRoleIcon = () => {
    const roleIcons: Record<string, any> = {
      super_admin: faCrown,
      admin: faBolt,
      principal: faGraduationCap,
      teacher: faBooks,
      student: faBackpack
    };
    return roleIcons[user.role] || faUserCircle;
  };

  const getRoleStyle = () => {
    const styles: Record<string, { bg: string; text: string }> = {
      super_admin: { bg: 'bg-purple-100', text: 'text-purple-700' },
      admin: { bg: 'bg-blue-100', text: 'text-blue-700' },
      principal: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
      teacher: { bg: 'bg-green-100', text: 'text-green-700' },
      student: { bg: 'bg-gray-100', text: 'text-gray-700' }
    };
    return styles[user.role] || styles.student;
  };

  const canManageUsers = ['super_admin', 'admin', 'principal'].includes(user.role);

  return (
    <div className="relative z-[100]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        title={`${user.name} (${getRoleDisplayName()})`}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm border"
          style={{ 
            background: brand.gradients.primary,
            borderColor: brand.colors.primary // ✅ FIXED: Use brand.colors.primary
          }}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999]">
          {/* User Info Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-base shadow-sm flex-shrink-0 border"
                style={{ 
                  background: brand.gradients.primary,
                  borderColor: brand.colors.primary // ✅ FIXED: Use brand.colors.primary
                }}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  getInitials(user.name)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{user.name}</div>
                <div className="text-sm text-gray-500 truncate">{user.email}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleStyle().bg} ${getRoleStyle().text}`}>
                    <FontAwesomeIcon icon={getRoleIcon()} className="mr-1" />
                    <span>{getRoleDisplayName()}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {!isSecureBrowser && onEditProfile && (
              <button
                onClick={() => {
                  onEditProfile();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faUser} className="text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">Edit Profile</div>
                  <div className="text-xs text-gray-500">Update your information</div>
                </div>
              </button>
            )}

            {!isSecureBrowser && onDownloadBrowser && (
              <button
                onClick={() => {
                  onDownloadBrowser();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faShield} className="text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">Download Secure Browser</div>
                  <div className="text-xs text-gray-500">Get Examiners Secure Browser</div>
                </div>
              </button>
            )}

            {canManageUsers && onManageUsers && (
              <button
                onClick={() => {
                  onManageUsers();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faUsers} className="text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">Manage Users</div>
                  <div className="text-xs text-gray-500">
                    {user.role === 'super_admin' ? 'Manage all user accounts' :
                     user.role === 'admin' ? 'Add and manage users' :
                     'Add students and staff'}
                  </div>
                </div>
              </button>
            )}

            {onViewLoginDetails && (
              <button
                onClick={() => {
                  onViewLoginDetails();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">Login Details</div>
                  <div className="text-xs text-gray-500">View your login information</div>
                </div>
              </button>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100 my-2"></div>

            {/* Sign Out Button */}
            <button
              onClick={() => {
                onSignOut();
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faXmark} className="text-red-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">Sign Out</div>
                <div className="text-xs text-red-500">Return to login page</div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 p-3">
            <div className="text-center">
              <div className="text-xs text-gray-500">
                EXAMINERS • ❤️
              </div>
              <div className="text-xs text-gray-500 leading-tight mt-0.5">
                {user.organization || brand.collegeName}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}