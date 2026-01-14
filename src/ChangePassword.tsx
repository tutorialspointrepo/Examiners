import { useState } from 'react';
import { firebaseService, type UserModel } from './services/firebase_service';
import { useBrand } from './BrandContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faCircleExclamation, faShield, faCheckCircle } from '@fortawesome/sharp-light-svg-icons';

interface ChangePasswordProps {
  user: UserModel;
  onPasswordChanged: (user: UserModel) => void;
  onCancel: () => void;
}

export default function ChangePassword({ user, onPasswordChanged, onCancel }: ChangePasswordProps) {
  const brand = useBrand();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; new?: string; confirm?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: { current?: string; new?: string; confirm?: string } = {};

    if (!currentPassword) {
      newErrors.current = 'Current password is required';
    }

    if (!newPassword) {
      newErrors.new = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.new = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])/.test(newPassword)) {
      newErrors.new = 'Password must contain at least one lowercase letter';
    } else if (!/(?=.*[A-Z])/.test(newPassword)) {
      newErrors.new = 'Password must contain at least one uppercase letter';
    } else if (!/(?=.*[0-9])/.test(newPassword)) {
      newErrors.new = 'Password must contain at least one number';
    }

    if (!confirmPassword) {
      newErrors.confirm = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await firebaseService.changePassword(currentPassword, newPassword);

      if (result.success) {
        // Password changed successfully
        onPasswordChanged(user);
      } else {
        setErrors({ general: result.error || 'Failed to change password' });
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      setErrors({ general: error.message || 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (field: 'current' | 'new' | 'confirm' | 'general') => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: brand.gradients.background }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-20 left-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: brand.colors.primary + '40' }}
        ></div>
        <div 
          className="absolute bottom-20 right-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: brand.colors.accent + '40', animationDelay: '1s' }}
        ></div>
        <div 
          className="absolute top-40 right-20 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: brand.colors.secondary + '40', animationDelay: '0.5s' }}
        ></div>
      </div>

      {/* Change Password Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10">
          {/* Header Icon */}
          <div className="flex justify-center mb-6">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: brand.gradients.primary }}
            >
              <FontAwesomeIcon icon={faShield} className="text-white text-3xl" />
            </div>
          </div>

          {/* Header Text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Change Your Password
            </h1>
            <p className="text-gray-600 text-sm">
              This is your first login. Please create a strong password to secure your account.
            </p>
          </div>

          {/* General Error Message */}
          {errors.general && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
              <FontAwesomeIcon icon={faCircleExclamation} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{errors.general}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {/* Current Password */}
            <div>
              <label htmlFor="current-password" className="block text-sm font-semibold text-gray-700 mb-2">
                Current Password (Temporary)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    errors.current ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <FontAwesomeIcon icon={faLock} className={errors.current ? 'text-red-600' : 'text-gray-600'} />
                  </div>
                </div>
                <input
                  id="current-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="off"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    clearError('current');
                    clearError('general');
                  }}
                  style={{
                    borderColor: errors.current ? '#f87171' : '#e5e7eb',
                  }}
                  onFocus={(e) => {
                    if (!errors.current) {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.current) {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                  className="w-full pl-16 pr-4 py-3.5 border-2 rounded-xl transition-all outline-none font-medium"
                  placeholder="Enter temporary password"
                  disabled={isLoading}
                />
              </div>
              {errors.current && (
                <div className="flex items-center space-x-1 mt-2 text-red-600">
                  <FontAwesomeIcon icon={faCircleExclamation} />
                  <p className="text-xs font-medium">{errors.current}</p>
                </div>
              )}
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    errors.new ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <FontAwesomeIcon icon={faLock} className={errors.new ? 'text-red-600' : 'text-gray-600'} />
                  </div>
                </div>
                <input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearError('new');
                    clearError('general');
                  }}
                  style={{
                    borderColor: errors.new ? '#f87171' : '#e5e7eb',
                  }}
                  onFocus={(e) => {
                    if (!errors.new) {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.new) {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                  className="w-full pl-16 pr-4 py-3.5 border-2 rounded-xl transition-all outline-none font-medium"
                  placeholder="Create a strong password"
                  disabled={isLoading}
                />
              </div>
              {errors.new && (
                <div className="flex items-center space-x-1 mt-2 text-red-600">
                  <FontAwesomeIcon icon={faCircleExclamation} />
                  <p className="text-xs font-medium">{errors.new}</p>
                </div>
              )}
              {!errors.new && newPassword && (
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon 
                      icon={newPassword.length >= 8 ? faCheckCircle : faCircleExclamation} 
                      className={newPassword.length >= 8 ? 'text-green-600' : 'text-gray-400'}
                    />
                    <span>At least 8 characters</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon 
                      icon={/(?=.*[a-z])/.test(newPassword) ? faCheckCircle : faCircleExclamation} 
                      className={/(?=.*[a-z])/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}
                    />
                    <span>One lowercase letter</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon 
                      icon={/(?=.*[A-Z])/.test(newPassword) ? faCheckCircle : faCircleExclamation} 
                      className={/(?=.*[A-Z])/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}
                    />
                    <span>One uppercase letter</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon 
                      icon={/(?=.*[0-9])/.test(newPassword) ? faCheckCircle : faCircleExclamation} 
                      className={/(?=.*[0-9])/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}
                    />
                    <span>One number</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    errors.confirm ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <FontAwesomeIcon icon={faLock} className={errors.confirm ? 'text-red-600' : 'text-gray-600'} />
                  </div>
                </div>
                <input
                  id="confirm-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearError('confirm');
                    clearError('general');
                  }}
                  style={{
                    borderColor: errors.confirm ? '#f87171' : '#e5e7eb',
                  }}
                  onFocus={(e) => {
                    if (!errors.confirm) {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.confirm) {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                  className="w-full pl-16 pr-4 py-3.5 border-2 rounded-xl transition-all outline-none font-medium"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
              </div>
              {errors.confirm && (
                <div className="flex items-center space-x-1 mt-2 text-red-600">
                  <FontAwesomeIcon icon={faCircleExclamation} />
                  <p className="text-xs font-medium">{errors.confirm}</p>
                </div>
              )}
            </div>

            {/* Show Passwords Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="show-passwords"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-offset-0"
                style={{ 
                  accentColor: brand.colors.primary,
                  cursor: 'pointer'
                }}
                disabled={isLoading}
              />
              <label htmlFor="show-passwords" className="ml-2 text-sm text-gray-600 cursor-pointer">
                Show passwords
              </label>
            </div>

            {/* Change Password Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ 
                background: isLoading ? '#9ca3af' : brand.gradients.primary 
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Changing Password...</span>
                </div>
              ) : (
                'Change Password'
              )}
            </button>
            {/* Cancel Button */}
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full mt-3 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start space-x-3">
              <FontAwesomeIcon icon={faShield} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  <span className="font-semibold">Security Tip:</span> Use a unique password that you don't use on other websites. Your password should be at least 8 characters with uppercase, lowercase, and numbers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Version Info */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            EXAMINERS v1.0 • Secure Password Change
          </p>
        </div>
      </div>
    </div>
  );
}