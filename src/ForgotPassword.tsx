// ForgotPassword.tsx - Full screen component matching Login design
import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { useBrand } from './BrandContext';
import { firebaseService } from './services/firebase_service';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const brand = useBrand();
  
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleSendOTP = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setIsSendingOTP(true);
    setMessage(null);

    try {
      const result = await firebaseService.sendPasswordResetOTP(email);
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: 'OTP sent successfully! Please check your email.' 
        });
        setStep('verify');
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to send OTP' 
        });
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to send OTP. Please try again.' 
      });
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleResetPassword = async () => {
    // Validate OTP
    if (!otp || otp.length !== 4) {
      setMessage({ type: 'error', text: 'Please enter a valid 4-digit OTP' });
      return;
    }

    // Validate new password
    if (!newPassword) {
      setMessage({ type: 'error', text: 'Please enter a new password' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    // Validate confirm password
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setIsResettingPassword(true);
    setMessage(null);

    try {
      const result = await firebaseService.resetPasswordWithOTP(email, otp, newPassword);
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: 'Password reset successful! You can now login with your new password.' 
        });
        
        // Navigate back to login after 2 seconds
        setTimeout(() => {
          onBackToLogin();
        }, 2000);
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to reset password' 
        });
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to reset password. Please try again.' 
      });
    } finally {
      setIsResettingPassword(false);
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

      {/* Forgot Password Card */}
      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-7">
          {/* Logo with Brand Colors */}
          <div className="flex justify-center mb-4">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: brand.gradients.primary }}
            >
              <Lock size={32} className="text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-5">
            <h1 className="font-bold text-gray-900 mb-1.5" style={{ fontSize: '1.375rem' }}>
              {step === 'email' ? 'Forgot Password' : 'Reset Password'}
            </h1>
            <p className="text-gray-600 text-sm">
              {step === 'email' 
                ? 'Enter your email to receive an OTP' 
                : 'Enter OTP and set new password'}
            </p>
          </div>

          {/* Message */}
          {message && (
            <div 
              className={`mb-4 p-3 rounded-lg flex items-start space-x-2.5 ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <AlertCircle 
                size={18} 
                className={`flex-shrink-0 mt-0.5 ${
                  message.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`} 
              />
              <p className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          {/* Step 1: Email Input */}
          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                      <Mail size={16} className="text-gray-600" />
                    </div>
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && email && !isSendingOTP) {
                        handleSendOTP();
                      }
                    }}
                    placeholder="Enter your email"
                    className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-xl transition-all outline-none"
                    onFocus={(e) => {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                    disabled={isSendingOTP}
                  />
                </div>
              </div>

              <button
                onClick={handleSendOTP}
                disabled={isSendingOTP || !email}
                className="w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  background: (isSendingOTP || !email) ? '#9ca3af' : brand.gradients.primary 
                }}
              >
                {isSendingOTP ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending OTP...</span>
                  </div>
                ) : (
                  'Send OTP'
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={onBackToLogin}
                  disabled={isSendingOTP}
                  className="text-sm font-medium transition-colors"
                  style={{ color: brand.colors.primary }}
                  onMouseEnter={(e) => e.currentTarget.style.color = brand.colors.secondary}
                  onMouseLeave={(e) => e.currentTarget.style.color = brand.colors.primary}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* Step 2: OTP and New Password */}
          {step === 'verify' && (
            <div className="space-y-4">
              {/* Email Display */}
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 text-center">
                  OTP sent to <span className="font-semibold text-gray-900">{email}</span>
                </p>
              </div>

              {/* OTP Input */}
              <div>
                <label htmlFor="otp-input" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Enter 4-Digit OTP
                </label>
                <input
                  id="otp-input"
                  type="text"
                   autoComplete="off"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setOtp(value);
                  }}
                  placeholder="• • • •"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl transition-all outline-none font-bold text-center text-xl tracking-[0.8rem]"
                  onFocus={(e) => {
                    e.target.style.borderColor = brand.colors.primary;
                    e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  disabled={isResettingPassword}
                />
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                      <Lock size={16} className="text-gray-600" />
                    </div>
                  </div>
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-14 pr-12 py-3 border border-gray-300 rounded-xl transition-all outline-none"
                    onFocus={(e) => {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                    disabled={isResettingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={isResettingPassword}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                      <Lock size={16} className="text-gray-600" />
                    </div>
                  </div>
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                     autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && otp && newPassword && confirmPassword && !isResettingPassword) {
                        handleResetPassword();
                      }
                    }}
                    placeholder="Re-enter new password"
                    className="w-full pl-14 pr-12 py-3 border border-gray-300 rounded-xl transition-all outline-none"
                    onFocus={(e) => {
                      e.target.style.borderColor = brand.colors.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${brand.colors.primary}20`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                    disabled={isResettingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={isResettingPassword}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Reset Password Button */}
              <button
                onClick={handleResetPassword}
                disabled={isResettingPassword || !otp || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  background: (isResettingPassword || !otp || !newPassword || !confirmPassword) ? '#9ca3af' : brand.gradients.primary 
                }}
              >
                {isResettingPassword ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Resetting...</span>
                  </div>
                ) : (
                  'Reset Password'
                )}
              </button>

              {/* Footer Links */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setMessage(null);
                  }}
                  disabled={isResettingPassword}
                  className="text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ color: brand.colors.primary }}
                  onMouseEnter={(e) => e.currentTarget.style.color = brand.colors.secondary}
                  onMouseLeave={(e) => e.currentTarget.style.color = brand.colors.primary}
                >
                  ← Change Email
                </button>
                <button
                  onClick={handleSendOTP}
                  disabled={isSendingOTP || isResettingPassword}
                  className="text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ color: brand.colors.primary }}
                  onMouseEnter={(e) => e.currentTarget.style.color = brand.colors.secondary}
                  onMouseLeave={(e) => e.currentTarget.style.color = brand.colors.primary}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Version Info */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            EXAMINERS v1.0 • Powered by AI • © 2026 Tutorials Point India Pvt. Ltd.
          </p>
        </div>
      </div>
    </div>
  );
}