import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  faUserCircle,
  faKey,
  faEye,
  faEyeSlash,
  faSpinner,
  faCircleExclamation,
  faBuilding
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { type UserType } from './constants';
import { firebaseService } from './services/firebase_service';

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
  onAddUniversity?: () => void;
  onSignOut: () => void;
  onSwitchMode?: (mode: 'learning' | 'assessment') => void;
  currentMode?: 'learning' | 'assessment';
  isSecureBrowser?: boolean;
}

export default function ProfileDropdown({
  user,
  onEditProfile,
  onDownloadBrowser,
  onManageUsers,
  onViewLoginDetails,
  onAddUniversity,
  onSignOut,
  isSecureBrowser = false
}: ProfileDropdownProps) {
  const brand = useBrand();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Change Password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

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

  const canManageUsers = ['super_admin', 'system_admin', 'admin', 'principal'].includes(user.role);
  const canAddUniversity = user.role === 'system_admin';

  // Handle change password modal open
  const handleOpenChangePassword = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
    setShowChangePasswordModal(true);
    setIsOpen(false);
  };

  // Handle change password modal close
  const handleCloseChangePassword = () => {
    setShowChangePasswordModal(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  // Handle change password submit
  const handleChangePasswordSubmit = async () => {
    // Validation
    if (!oldPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    
    if (!newPassword) {
      setPasswordError('Please enter a new password');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (oldPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }
    
    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    
    try {
      const result = await firebaseService.changePassword(oldPassword, newPassword);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to change password');
      }
      
      setPasswordSuccess('Password changed successfully!');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        handleCloseChangePassword();
      }, 2000);
      
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="relative z-[9999]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        title={`${user.name} (${getRoleDisplayName()})`}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm border"
          style={{ 
            background: brand.gradients.primary,
            borderColor: brand.colors.primary
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
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-[10000]">
          {/* User Info Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-base shadow-sm flex-shrink-0 border"
                style={{ 
                  background: brand.gradients.primary,
                  borderColor: brand.colors.primary
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

            {/* Change Password Option */}
            {!isSecureBrowser && (
              <button
                onClick={handleOpenChangePassword}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faKey} className="text-indigo-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">Change Password</div>
                  <div className="text-xs text-gray-500">Update your password</div>
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

            {/* Add University/College Option - Only for system_admin */}
            {canAddUniversity && onAddUniversity && (
              <button
                onClick={() => {
                  onAddUniversity();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faBuilding} className="text-orange-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">Add University/College</div>
                  <div className="text-xs text-gray-500">Bulk upload colleges via Excel</div>
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
            
            {/* Mode Switch - Learning / Assessment - COMMENTED OUT
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-gray-500 mb-2">Switch Module</div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (onSwitchMode) onSwitchMode('learning');
                    setIsOpen(false);
                  }}
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all hover:shadow-md ${
                    currentMode === 'learning' ? '' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={currentMode === 'learning' ? {
                    borderColor: brand.colors.primary,
                    background: `linear-gradient(135deg, ${brand.colors.primary}15 0%, ${brand.colors.primary}05 100%)`
                  } : {
                    background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-1.5 text-white"
                    style={currentMode === 'learning' ? { 
                      background: brand.gradients.primary 
                    } : {
                      background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)'
                    }}
                  >
                    <FontAwesomeIcon icon={faBooks} className="text-lg" />
                  </div>
                  <span 
                    className="text-xs font-semibold"
                    style={{ color: currentMode === 'learning' ? brand.colors.primary : '#6b7280' }}
                  >
                    Learning
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (onSwitchMode) onSwitchMode('assessment');
                    setIsOpen(false);
                  }}
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all hover:shadow-md ${
                    currentMode === 'assessment' ? '' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={currentMode === 'assessment' ? {
                    borderColor: brand.colors.primary,
                    background: `linear-gradient(135deg, ${brand.colors.primary}15 0%, ${brand.colors.primary}05 100%)`
                  } : {
                    background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-1.5 text-white"
                    style={currentMode === 'assessment' ? { 
                      background: brand.gradients.primary 
                    } : {
                      background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)'
                    }}
                  >
                    <FontAwesomeIcon icon={faClipboardCheck} className="text-lg" />
                  </div>
                  <span 
                    className="text-xs font-semibold"
                    style={{ color: currentMode === 'assessment' ? brand.colors.primary : '#6b7280' }}
                  >
                    Assessment
                  </span>
                </button>
              </div>
            </div>
            <div className="border-t border-gray-100 my-2"></div>
            */}

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

      {/* Change Password Modal - rendered via portal to escape stacking context */}
      {showChangePasswordModal && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={handleCloseChangePassword}
          />
          
          {/* Slide-out Panel from Right */}
          <div 
            className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl overflow-hidden rounded-2xl"
            style={{ zIndex: 1000000, animation: 'slideInRight 0.3s ease-out' }}
          >
            {/* Header */}
            <div 
              className="px-6 py-5 border-b border-gray-200"
              style={{ background: brand.gradients.card }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                  >
                    <FontAwesomeIcon icon={faKey} className="text-white text-xl" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
                    <p className="text-sm text-gray-600">Update your account password</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseChangePassword}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-gray-500 text-lg" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {/* User Info Card */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-md"
                    style={{ background: brand.gradients.primary }}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Success Message */}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2 mb-5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Password Form */}
              <div className="space-y-5">
                {/* Old Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => {
                        setOldPassword(e.target.value);
                        setPasswordError(null);
                      }}
                      placeholder="Enter current password"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-gray-900"
                      style={{ '--tw-ring-color': brand.colors.primary } as React.CSSProperties}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={showOldPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>

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
                      style={{ '--tw-ring-color': brand.colors.primary } as React.CSSProperties}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm New Password
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
                      style={{ '--tw-ring-color': brand.colors.primary } as React.CSSProperties}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
                    <FontAwesomeIcon icon={faCircleExclamation} />
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
                    <li className={`flex items-center space-x-2 ${newPassword && oldPassword && newPassword !== oldPassword ? 'text-green-600' : ''}`}>
                      <span>{newPassword && oldPassword && newPassword !== oldPassword ? '✓' : '•'}</span>
                      <span>Must be different from current password</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer with Buttons */}
            <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-white border-t border-gray-200">
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseChangePassword}
                  disabled={isChangingPassword}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  onClick={handleChangePasswordSubmit}
                  disabled={isChangingPassword || !oldPassword || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-3 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  style={{ background: brand.gradients.primary }}
                >
                  {isChangingPassword ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                      <span>Changing...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faKey} />
                      <span>Change Password</span>
                    </>
                  )}
                </button>
              </div>
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
        </>,
        document.body
      )}
    </div>
  );
}