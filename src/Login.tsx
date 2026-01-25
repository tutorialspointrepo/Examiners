// Login.tsx (with original design restored)
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faEnvelope, faLock, faCircleExclamation } from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { firebaseService, type UserModel } from './services/firebase_service';

interface LoginProps {
  onLoginSuccess: (user: UserModel) => void;
  onRequirePasswordChange: (user: UserModel) => void;
  onForgotPassword: () => void;
}

export default function Login({ onLoginSuccess, onRequirePasswordChange, onForgotPassword }: LoginProps) {
  const brand = useBrand();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    // Email validation
    if (!email) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check internet connectivity before attempting login
    if (!navigator.onLine) {
      setErrors({ general: 'Please check your network and try again.' });
      return;
    }

    setIsLoading(true);
    setErrors({}); // Clear previous errors

    try {
      // Call Firebase login
      const result = await firebaseService.login(email, password);
      
      if (result.success && result.user) {
        // Check if password change is required
        if (result.requiresPasswordChange) {
          onRequirePasswordChange(result.user);
        } else {
          onLoginSuccess(result.user);
        }
      } else {
        setErrors({ general: result.error || 'Login failed' });
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      setErrors({ general: error.message || 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (field: 'email' | 'password' | 'general') => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 py-8 overflow-y-auto"
      style={{ background: brand.gradients.background }}
    >
      {/* Background decorative elements using brand colors */}
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

      {/* Login Card */}
      <div className="relative w-full max-w-sm">
        {/* Main Card */}
        <div className="bg-white border rounded-2xl shadow-2xl p-6 md:p-8">
          {/* EXAMINERS Logo - AI Evaluation Theme */}
          <div className="flex justify-center mb-4">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl relative overflow-hidden group"
              style={{ background: brand.gradients.primary }}
            >
              {/* Animated background pulse */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent animate-pulse"></div>
              
              {/* Central Document with AI brain pattern */}
              <div className="relative z-10">
                {/* Document base */}
                <div className="relative">
                  {/* Paper sheet */}
                  <div className="bg-white rounded-lg shadow-lg p-2.5 relative transform group-hover:scale-110 transition-transform duration-300">
                    {/* Document lines */}
                    <div className="space-y-1">
                      <div className="h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full w-7"></div>
                      <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full w-5"></div>
                      <div className="h-1 bg-gradient-to-r from-pink-400 to-orange-400 rounded-full w-6"></div>
                    </div>
                    
                    {/* AI Checkmark overlay */}
                    <div className="absolute -top-2 -right-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full w-5 h-5 flex items-center justify-center shadow-lg animate-bounce">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  
                  {/* AI Neural nodes around document */}
                  <div className="absolute -top-1 -left-1 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse shadow-md"></div>
                  <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse shadow-md" style={{animationDelay: '0.5s'}}></div>
                  <div className="absolute top-1/2 -right-2 w-1 h-1 bg-pink-400 rounded-full animate-pulse shadow-md" style={{animationDelay: '1s'}}></div>
                  
                  {/* Connection lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-2.5 h-0.5 bg-gradient-to-r from-blue-400/60 to-transparent rotate-45"></div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-0.5 bg-gradient-to-l from-purple-400/60 to-transparent -rotate-45"></div>
                  </div>
                </div>
              </div>
              
              {/* Orbiting particles */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 right-2 w-1 h-1 bg-white/60 rounded-full animate-ping"></div>
                <div className="absolute bottom-2 left-2 w-1 h-1 bg-white/60 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="font-bold text-gray-900 mb-1" style={{ fontSize: '1.25rem' }}>
              {brand.collegeName}
            </h1>
            <p className="text-gray-600 text-sm">
              Sign in to your account to continue
            </p>
          </div>

          {/* General Error Message */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
              <FontAwesomeIcon icon={faCircleExclamation} className="text-red-600 flex-shrink-0 mt-0.5 text-sm" />
              <div>
                <p className="text-sm font-medium text-red-800">{errors.general}</p>
              </div>
            </div>
          )}

          {/* Form */}
         <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    errors.email ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <FontAwesomeIcon icon={faEnvelope} className={`text-sm ${errors.email ? 'text-red-600' : 'text-gray-600'}`} />
                  </div>
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError('email');
                    clearError('general');
                  }}
                  style={{
                    borderColor: errors.email ? '#f87171' : '#e5e7eb',
                  }}
                  onFocus={(e) => {
                    if (!errors.email) {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.email) {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                  className="w-full pl-14 pr-4 py-3 border rounded-xl transition-all outline-none font-medium text-sm"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <div className="flex items-center space-x-1 mt-1.5 text-red-600">
                  <FontAwesomeIcon icon={faCircleExclamation} className="text-xs" />
                  <p className="text-xs font-medium">{errors.email}</p>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    errors.password ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <FontAwesomeIcon icon={faLock} className={`text-sm ${errors.password ? 'text-red-600' : 'text-gray-600'}`} />
                  </div>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError('password');
                    clearError('general');
                  }}
                  style={{
                    borderColor: errors.password ? '#f87171' : '#e5e7eb',
                  }}
                  onFocus={(e) => {
                    if (!errors.password) {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.password) {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                  className="w-full pl-14 pr-12 py-3 border rounded-xl transition-all outline-none font-medium text-sm"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <FontAwesomeIcon icon={faEyeSlash} className="text-sm" /> : <FontAwesomeIcon icon={faEye} className="text-sm" />}
                </button>
              </div>
              {errors.password && (
                <div className="flex items-center space-x-1 mt-1.5 text-red-600">
                  <FontAwesomeIcon icon={faCircleExclamation} className="text-xs" />
                  <p className="text-xs font-medium">{errors.password}</p>
                </div>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm font-medium transition-colors"
                style={{ color: brand.colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.color = brand.colors.secondary}
                onMouseLeave={(e) => e.currentTarget.style.color = brand.colors.primary}
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ 
                background: isLoading ? '#9ca3af' : brand.gradients.primary 
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-600">
              Need access?{' '}
              <button 
                className="font-medium transition-colors"
                style={{ color: brand.colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.color = brand.colors.secondary}
                onMouseLeave={(e) => e.currentTarget.style.color = brand.colors.primary}
                disabled={isLoading}
              >
                Contact your organization administrator
              </button>
            </p>
          </div>
        </div>

        {/* Version Info */}
        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            EXAMINERS v1.0 • Powered by AI • © 2026 Tutorials Point India Pvt. Ltd.
          </p>
        </div>
      </div>
    </div>
  );
}