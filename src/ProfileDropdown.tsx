import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser, 
  faShield,
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
  faBuilding,
  faClipboardCheck,
  faCode,
  faBookOpen,
  faChevronRight,
  faPalette,
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import BrandProfile from './BrandProfile';
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
    leetcodeUsername?: string;
  };
  onEditProfile?: () => void;
  onDownloadBrowser?: () => void;
  onManageUsers?: () => void;
  onViewLoginDetails?: () => void;
  onViewLeetCode?: () => void;
  onProfileClick?: () => void;
  onAddUniversity?: () => void;
  onBrandProfile?: () => void;
  onSignOut: () => void;
  onSwitchMode?: (mode: 'learning' | 'assessment') => void;
  currentMode?: 'learning' | 'assessment';
  isSecureBrowser?: boolean;
}

export default function ProfileDropdown({
  user,
  onEditProfile,
  onDownloadBrowser,
  onViewLoginDetails,
  onViewLeetCode,
  onAddUniversity,
  onBrandProfile,
  onSignOut,
  onSwitchMode,
  currentMode,
}: ProfileDropdownProps) {
  const brand = useBrand();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimatedIn, setIsAnimatedIn] = useState(false);
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
  const [showBrandProfile, setShowBrandProfile] = useState(false);

  // Slide-in animation
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => { requestAnimationFrame(() => setIsAnimatedIn(true)); });
    } else {
      setIsAnimatedIn(false);
    }
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

  const canAddUniversity = user.role === 'system_admin';
  const canManageBrand = user.role === 'system_admin';

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

      {/* Profile Panel - Slide from right */}
      {isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity duration-300"
            style={{ opacity: isAnimatedIn ? 1 : 0 }}
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            className="fixed right-2 top-2 bottom-2 z-[10000] w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl overflow-hidden rounded-2xl flex flex-col transition-all duration-300 ease-out"
            style={{
              transform: isAnimatedIn ? 'translateX(0)' : 'translateX(100%)',
              opacity: isAnimatedIn ? 1 : 0,
            }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
              style={{ background: brand.gradients.primary }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold text-base shadow-sm flex-shrink-0 border border-white/20 overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    getInitials(user.name)
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{user.name.replace(/\b\w/g, c => c.toUpperCase())}</h2>
                  <p className="text-[11px] text-white/70">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white/80 bg-white/15 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  <FontAwesomeIcon icon={getRoleIcon()} className="mr-1" />
                  {getRoleDisplayName()}
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3">
                {/* Menu Items */}
                <div className="space-y-1">
                  {/* Edit Profile */}
                  <button
                    onClick={() => {
                      if (onEditProfile) onEditProfile();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FontAwesomeIcon icon={faUser} className="text-blue-500 text-sm" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-[13px]">Edit Profile</div>
                      <div className="text-[11px] text-gray-400">Update your information</div>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} className="text-xs text-gray-500" />
                  </button>

                  {/* Change Password */}
                  <button
                    onClick={() => {
                      setShowChangePasswordModal(true);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <FontAwesomeIcon icon={faKey} className="text-indigo-500 text-sm" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-[13px]">Change Password</div>
                      <div className="text-[11px] text-gray-400">Update your password</div>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} className="text-xs text-gray-500" />
                  </button>

                  {/* Download Secure Browser */}
                  {onDownloadBrowser && (
                    <button
                      onClick={() => {
                        onDownloadBrowser();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faShield} className="text-green-500 text-sm" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[13px]">Download Secure Browser</div>
                        <div className="text-[11px] text-gray-400">Get Examiners Secure Browser</div>
                      </div>
                      <FontAwesomeIcon icon={faChevronRight} className="text-xs text-gray-500" />
                    </button>
                  )}

                  {/* Login Details */}
                  {onViewLoginDetails && (
                    <button
                      onClick={() => {
                        onViewLoginDetails();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-500 text-sm" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[13px]">Login Details</div>
                        <div className="text-[11px] text-gray-400">View your login information</div>
                      </div>
                      <FontAwesomeIcon icon={faChevronRight} className="text-xs text-gray-500" />
                    </button>
                  )}

                  {/* LeetCode Profile */}
                  {user.role === 'student' && user.leetcodeUsername && (
                    <button
                      onClick={() => {
                        if (onViewLeetCode) onViewLeetCode();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faCode} className="text-amber-500 text-sm" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[13px]">LeetCode Profile</div>
                        <div className="text-[11px] text-gray-400">@{user.leetcodeUsername}</div>
                      </div>
                      <FontAwesomeIcon icon={faChevronRight} className="text-xs text-gray-500" />
                    </button>
                  )}

                  {/* Add University (System Admin Only) */}
                  {canAddUniversity && onAddUniversity && (
                    <button
                      onClick={() => {
                        onAddUniversity();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faBuilding} className="text-purple-500 text-sm" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[13px]">Add University</div>
                        <div className="text-[11px] text-gray-400">Register a new institution</div>
                      </div>
                      <FontAwesomeIcon icon={faChevronRight} className="text-xs text-gray-500" />
                    </button>
                  )}

                  {/* Brand Profile (Admin & System Admin Only) */}
                  {canManageBrand && (
                    <button
                      onClick={() => {
                        setShowBrandProfile(true);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="w-9 h-9 bg-pink-100 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faPalette} className="text-pink-500 text-sm" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[13px]">Brand Profile</div>
                        <div className="text-[11px] text-gray-400">Logo, colors & branding</div>
                      </div>
                      <FontAwesomeIcon icon={faChevronRight} className="text-xs text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Switch Module */}
                {onSwitchMode && (
                <>
                <div className="border-t border-gray-100 my-3"></div>
                <div className="px-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Switch Module</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        onSwitchMode('learning');
                        setIsOpen(false);
                      }}
                      className="flex flex-col items-center py-4 px-3 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: currentMode === 'learning' ? brand.colors.primary : '#e5e7eb',
                        background: currentMode === 'learning' ? `${brand.colors.primary}08` : 'white',
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center mb-2"
                        style={{ background: currentMode === 'learning' ? brand.gradients.primary : '#f3f4f6' }}
                      >
                        <FontAwesomeIcon
                          icon={faBookOpen}
                          className={currentMode === 'learning' ? 'text-white' : 'text-gray-400'}
                        />
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
                        onSwitchMode('assessment');
                        setIsOpen(false);
                      }}
                      className="flex flex-col items-center py-4 px-3 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: currentMode === 'assessment' ? brand.colors.primary : '#e5e7eb',
                        background: currentMode === 'assessment' ? `${brand.colors.primary}08` : 'white',
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center mb-2"
                        style={{ background: currentMode === 'assessment' ? brand.gradients.primary : '#f3f4f6' }}
                      >
                        <FontAwesomeIcon
                          icon={faClipboardCheck}
                          className={currentMode === 'assessment' ? 'text-white' : 'text-gray-400'}
                        />
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
                </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-100">
              {/* Sign Out */}
              <button
                onClick={() => {
                  onSignOut();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-7 py-3.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faXmark} className="text-red-500 text-sm" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-[13px]">Sign Out</div>
                  <div className="text-[11px] text-red-400">Return to login page</div>
                </div>
              </button>

              {/* Branding */}
              <div className="border-t border-gray-100 px-5 py-3 text-center">
                <div className="text-[10px] text-gray-300 uppercase tracking-wider">
                  EXAMINERS • ❤️
                </div>
                <div className="text-[10px] text-gray-300 mt-0.5">
                  {user.organization || brand.collegeName}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
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

      {/* Brand Profile Panel */}
      <BrandProfile
        isOpen={showBrandProfile}
        onClose={() => setShowBrandProfile(false)}
        collegeId={user.organizationId || ''}
        onBrandUpdate={onBrandProfile}
      />
    </div>
  );
}