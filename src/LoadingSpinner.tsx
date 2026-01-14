// src/components/LoadingSpinner.tsx - EXAMINERS AI Evaluation Theme
import React from 'react';
import { useBrand } from './BrandContext';

interface LoginIPInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  org: string;
  asn: string;
  loginTimestamp: Date;
  userAgent: string;
  deviceType: string;
}

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  duration?: number;
  ipInfo?: LoginIPInfo;
  showIPInfo?: boolean;
}

// Custom CSS for animations
const spinnerStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  
  @keyframes float-slow {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  
  @keyframes scan {
    0% { transform: translateY(-100%); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(200%); opacity: 0; }
  }
  
  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.2); opacity: 0.5; }
    100% { transform: scale(0.8); opacity: 0; }
  }
  
  @keyframes check-draw {
    0% { stroke-dashoffset: 100; }
    100% { stroke-dashoffset: 0; }
  }
  
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  
  @keyframes orbit {
    0% { transform: rotate(0deg) translateX(40px) rotate(0deg); }
    100% { transform: rotate(360deg) translateX(40px) rotate(-360deg); }
  }
  
  @keyframes orbit-reverse {
    0% { transform: rotate(0deg) translateX(50px) rotate(0deg); }
    100% { transform: rotate(-360deg) translateX(50px) rotate(360deg); }
  }
  
  .float-animation {
    animation: float 3s ease-in-out infinite;
  }
  
  .float-slow {
    animation: float-slow 4s ease-in-out infinite;
  }
  
  .scan-line {
    animation: scan 2s ease-in-out infinite;
  }
  
  .pulse-ring {
    animation: pulse-ring 2s ease-out infinite;
  }
  
  .gradient-shift {
    background-size: 200% 200%;
    animation: gradient-shift 3s ease infinite;
  }
  
  .orbit {
    animation: orbit 8s linear infinite;
  }
  
  .orbit-reverse {
    animation: orbit-reverse 10s linear infinite;
  }
  
  .delay-100 { animation-delay: 0.1s; }
  .delay-200 { animation-delay: 0.2s; }
  .delay-300 { animation-delay: 0.3s; }
  .delay-400 { animation-delay: 0.4s; }
  .delay-500 { animation-delay: 0.5s; }
  .delay-600 { animation-delay: 0.6s; }
  .delay-700 { animation-delay: 0.7s; }
  .delay-1000 { animation-delay: 1s; }
  .delay-1500 { animation-delay: 1.5s; }
  .delay-2000 { animation-delay: 2s; }
  
  @media (prefers-reduced-motion: reduce) {
    .float-animation, .float-slow, .scan-line, .pulse-ring, .orbit, .orbit-reverse, .animate-bounce, .animate-ping, .animate-pulse, .gradient-shift {
      animation: none;
    }
  }
`;

export function LoadingSpinner({ 
  message = "Loading...", 
  size = 'md',
  fullScreen = true,
  duration = 5000,
  ipInfo,
  showIPInfo = false
}: LoadingSpinnerProps) {
  const brand = useBrand();
  
  // DEBUG: Verify brand colors
  React.useEffect(() => {
    console.log('🔍 [LOADING SPINNER] Brand Colors:', {
      primary: brand.colors.primary,
      secondary: brand.colors.secondary,
      accent: brand.colors.accent,
      collegeName: brand.collegeName
    });
  }, [brand]);
  
  const styleId = 'examiners-spinner-styles';
  const [progress, setProgress] = React.useState(0);
  const [loadingStatus, setLoadingStatus] = React.useState('Initializing...');
  
  React.useEffect(() => {
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = spinnerStyles;
      document.head.appendChild(styleElement);
    }
    
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle && !document.querySelector('[data-loading-spinner]')) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  // Animate progress bar and status messages
  React.useEffect(() => {
    const startTime = Date.now();
    const interval = 100;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress < 15) {
        setLoadingStatus('Connecting to server...');
      } else if (newProgress < 30) {
        setLoadingStatus('Loading your profile...');
      } else if (newProgress < 50) {
        setLoadingStatus('Fetching exams data...');
      } else if (newProgress < 65) {
        setLoadingStatus('Loading questions bank...');
      } else if (newProgress < 80) {
        setLoadingStatus('Preparing user data...');
      } else if (newProgress < 95) {
        setLoadingStatus('Finalizing workspace...');
      } else {
        setLoadingStatus('Almost ready...');
      }

      if (elapsed >= duration) {
        setProgress(100);
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [duration]);

  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const titleSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  };

  return (
    <div 
      data-loading-spinner
      className={`${fullScreen ? 'fixed inset-0 z-50' : 'relative'} flex items-center justify-center`}
      style={{ background: brand.gradients.background }}
    >
      <div className="text-center px-6 relative">
        {/* Animated Logo Container with Glow Effect */}
        <div className={`${sizeClasses[size]} mx-auto mb-8 relative`}>
          {/* Glow background */}
          <div 
            className="absolute inset-0 rounded-3xl blur-xl"
            style={{ 
              background: `linear-gradient(to bottom right, ${brand.colors.primary}4D, ${brand.colors.secondary}4D, ${brand.colors.accent}4D)` 
            }}
          ></div>
          
          {/* Main icon card with gradient background */}
          <div className="relative flex items-center justify-center">
            <div 
              className="rounded-3xl shadow-2xl p-1 float-animation"
              style={{ background: brand.gradients.primary }}
            >
              {/* Inner content */}
              <div 
                className={`rounded-3xl flex items-center justify-center relative ${sizeClasses[size]}`}
                style={{ background: brand.gradients.primary }}
              >
                {/* Animated scanning line */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden">
                  <div className={`absolute inset-x-0 bg-gradient-to-b from-transparent via-white/40 to-transparent scan-line ${
                    size === 'sm' ? 'h-8' : size === 'md' ? 'h-12' : 'h-16'
                  }`}></div>
                </div>
                
                {/* Answer Sheet Document with animated elements */}
                <div className={`relative bg-white rounded-xl shadow-lg ${
                  size === 'sm' ? 'w-12 h-14' : size === 'md' ? 'w-16 h-20' : 'w-20 h-24'
                }`}>
                  {/* Document lines representing questions */}
                  <div className={`absolute inset-0 flex flex-col justify-center ${
                    size === 'sm' ? 'px-2 space-y-1.5' : size === 'md' ? 'px-3 space-y-2' : 'px-4 space-y-2.5'
                  }`}>
                    <div className={`bg-gradient-to-r from-blue-400 to-blue-500 rounded-full ${
                      size === 'sm' ? 'h-1' : size === 'md' ? 'h-1.5' : 'h-2'
                    }`}></div>
                    <div className={`bg-gradient-to-r from-purple-400 to-purple-500 rounded-full ${
                      size === 'sm' ? 'h-1 w-4/5' : size === 'md' ? 'h-1.5 w-4/5' : 'h-2 w-4/5'
                    }`}></div>
                    <div className={`bg-gradient-to-r from-pink-400 to-pink-500 rounded-full ${
                      size === 'sm' ? 'h-1 w-3/5' : size === 'md' ? 'h-1.5 w-3/5' : 'h-2 w-3/5'
                    }`}></div>
                  </div>
                  
                  {/* AI Checkmark Badge */}
                  <div className={`absolute bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-pulse ${
                    size === 'sm' ? '-top-1.5 -right-1.5 w-4 h-4' : size === 'md' ? '-top-2 -right-2 w-5 h-5' : '-top-3 -right-3 w-6 h-6'
                  }`}>
                    <svg 
                      width={size === 'sm' ? '10' : size === 'md' ? '14' : '18'} 
                      height={size === 'sm' ? '10' : size === 'md' ? '14' : '18'} 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M5 13l4 4L19 7" 
                        stroke="white" 
                        strokeWidth="3" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        strokeDasharray="100"
                        className="animate-pulse"
                      />
                    </svg>
                  </div>
                  
                  {/* Grade Badge */}
                  <div className={`absolute bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg animate-pulse ${
                    size === 'sm' ? '-top-1.5 -left-1.5 w-4 h-4' : size === 'md' ? '-top-2 -left-2 w-5 h-5' : '-top-3 -left-3 w-6 h-6'
                  }`}>
                    <span className="text-white font-bold" style={{fontSize: size === 'sm' ? '8px' : size === 'md' ? '10px' : '12px'}}>A+</span>
                  </div>
                </div>
                
                {/* Floating decorative elements */}
                <div className={`absolute bg-blue-400 rounded-full shadow-md animate-pulse ${
                  size === 'sm' ? '-top-2 -left-2 w-2 h-2' : size === 'md' ? '-top-3 -left-3 w-3 h-3' : '-top-4 -left-4 w-4 h-4'
                }`}></div>
                <div className={`absolute bg-purple-400 rounded-full shadow-md animate-pulse delay-300 ${
                  size === 'sm' ? '-bottom-2 -right-2 w-2 h-2' : size === 'md' ? '-bottom-3 -right-3 w-3 h-3' : '-bottom-4 -right-4 w-4 h-4'
                }`}></div>
                <div className={`absolute bg-pink-400 rounded-full shadow-md animate-pulse delay-600 ${
                  size === 'sm' ? 'top-1/2 -right-3 w-1.5 h-1.5' : size === 'md' ? 'top-1/2 -right-4 w-2 h-2' : 'top-1/2 -right-5 w-3 h-3'
                }`}></div>
                <div className={`absolute bg-indigo-400 rounded-full shadow-md animate-pulse delay-1000 ${
                  size === 'sm' ? 'top-1/2 -left-3 w-1.5 h-1.5' : size === 'md' ? 'top-1/2 -left-4 w-2 h-2' : 'top-1/2 -left-5 w-3 h-3'
                }`}></div>
                
                {/* Light rays emanating from document */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className={`absolute top-0 left-0 bg-gradient-to-r from-blue-400/60 to-transparent rotate-45 ${
                    size === 'sm' ? 'w-4 h-0.5' : size === 'md' ? 'w-6 h-0.5' : 'w-8 h-0.5'
                  }`}></div>
                  <div className={`absolute bottom-0 right-0 bg-gradient-to-l from-purple-400/60 to-transparent -rotate-45 ${
                    size === 'sm' ? 'w-4 h-0.5' : size === 'md' ? 'w-6 h-0.5' : 'w-8 h-0.5'
                  }`}></div>
                  <div className={`absolute top-1/2 right-0 bg-gradient-to-l from-pink-400/60 to-transparent ${
                    size === 'sm' ? 'w-3 h-0.5' : size === 'md' ? 'w-5 h-0.5' : 'w-7 h-0.5'
                  }`}></div>
                  <div className={`absolute top-1/2 left-0 bg-gradient-to-r from-indigo-400/60 to-transparent ${
                    size === 'sm' ? 'w-3 h-0.5' : size === 'md' ? 'w-5 h-0.5' : 'w-7 h-0.5'
                  }`}></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Orbiting AI indicators */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`absolute bg-cyan-400 rounded-full shadow-lg orbit ${
              size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3 h-3'
            }`}></div>
            <div className={`absolute bg-emerald-400 rounded-full shadow-lg orbit-reverse ${
              size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3 h-3'
            }`}></div>
          </div>
          
          {/* Pulsing rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`absolute border-2 border-white/30 rounded-full pulse-ring ${
              size === 'sm' ? 'w-16 h-16' : size === 'md' ? 'w-24 h-24' : 'w-32 h-32'
            }`}></div>
            <div className={`absolute border-2 border-white/20 rounded-full pulse-ring delay-1000 ${
              size === 'sm' ? 'w-20 h-20' : size === 'md' ? 'w-28 h-28' : 'w-36 h-36'
            }`}></div>
          </div>
          
          {/* Corner sparkles */}
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute bg-white/80 rounded-full animate-ping ${
              size === 'sm' ? 'top-3 right-3 w-1 h-1' : size === 'md' ? 'top-4 right-4 w-1 h-1' : 'top-6 right-6 w-1.5 h-1.5'
            }`}></div>
            <div className={`absolute bg-white/80 rounded-full animate-ping delay-500 ${
              size === 'sm' ? 'bottom-3 left-3 w-1 h-1' : size === 'md' ? 'bottom-4 left-4 w-1 h-1' : 'bottom-6 left-6 w-1.5 h-1.5'
            }`}></div>
            <div className={`absolute bg-white/60 rounded-full animate-ping delay-1000 ${
              size === 'sm' ? 'top-6 left-6 w-0.5 h-0.5' : size === 'md' ? 'top-8 left-8 w-1 h-1' : 'top-12 left-12 w-1 h-1'
            }`}></div>
            <div className={`absolute bg-white/60 rounded-full animate-ping delay-1500 ${
              size === 'sm' ? 'bottom-6 right-6 w-0.5 h-0.5' : size === 'md' ? 'bottom-8 right-8 w-1 h-1' : 'bottom-12 right-12 w-1 h-1'
            }`}></div>
          </div>
        </div>
        
        {/* Title with gradient */}
        <h2 
          className={`font-bold mb-2 ${titleSizes[size]}`}
          style={{ 
            background: brand.gradients.primary,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          EXAMINERS
        </h2>
        
        {/* Subtitle */}
        <p className={`text-gray-500 mb-1 font-medium ${textSizes[size]}`}>
          AI-Powered Evaluation
        </p>
        
        {/* Message */}
        <p className={`text-gray-600 mb-2 ${textSizes[size]}`}>
          {message}
        </p>
        
        {/* Loading Status */}
        <p 
          className={`font-semibold mb-6 ${textSizes[size]}`}
          style={{ color: brand.colors.primary }}
        >
          {loadingStatus}
        </p>
        
        {/* Progress bar with gradient - Enhanced */}
        <div className="max-w-sm mx-auto mb-3">
          <div className="bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div 
              className="h-3 rounded-full transition-all duration-200 ease-linear relative overflow-hidden" 
              style={{ 
                width: `${progress}%`,
                background: brand.gradients.primary
              }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* Progress percentage */}
        <p className="text-sm font-bold text-gray-700 mb-6">
          {Math.round(progress)}%
        </p>
        
        {/* Animated status dots */}
        <div className="flex justify-center space-x-1.5">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100"></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-200"></div>
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce delay-300"></div>
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce delay-400"></div>
        </div>

        {/* Compact IP Information at Bottom - Exactly like in Screenshot */}
        {showIPInfo && ipInfo && (
          <div className="mt-8 pt-6 border-t border-gray-300">
            {/* Single line with IP, Location, ISP - Small font */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
              <span className="flex items-center">
                🌐 <strong className="ml-1 mr-1">IP:</strong>
                <span>{ipInfo.ip}</span>
              </span>
              <span className="flex items-center">
                📍 <strong className="ml-1 mr-1">Location:</strong>
                <span>{ipInfo.city}, {ipInfo.region}, {ipInfo.country}</span>
              </span>
              <span className="flex items-center">
                📡 <strong className="ml-1 mr-1">ISP:</strong>
                <span>{ipInfo.isp}</span>
              </span>
            </div>

            {/* Security note with green checkmark */}
            <div className="flex items-center justify-center space-x-1.5 text-xs text-gray-500 mb-1">
              <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Login activity recorded for security. Contact admin if this wasn't you.</span>
            </div>

            {/* Coordinates - Very small at bottom */}
            {ipInfo.latitude !== 0 && ipInfo.longitude !== 0 && (
              <div className="flex items-center justify-center text-xs text-gray-400 mt-1">
                <span>📊 {ipInfo.latitude.toFixed(4)}, {ipInfo.longitude.toFixed(4)}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Floating AI icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={`absolute text-blue-300 opacity-20 ${
            size === 'sm' ? 'top-1/4 left-1/4 text-2xl' : size === 'md' ? 'top-1/4 left-1/4 text-3xl' : 'top-1/4 left-1/4 text-4xl'
          } float-slow`}>✓</div>
          <div className={`absolute text-purple-300 opacity-20 ${
            size === 'sm' ? 'top-3/4 right-1/4 text-2xl' : size === 'md' ? 'top-3/4 right-1/4 text-3xl' : 'top-3/4 right-1/4 text-4xl'
          } float-slow delay-500`}>★</div>
          <div className={`absolute text-pink-300 opacity-20 ${
            size === 'sm' ? 'bottom-1/4 left-3/4 text-xl' : size === 'md' ? 'bottom-1/4 left-3/4 text-2xl' : 'bottom-1/4 left-3/4 text-3xl'
          } float-slow delay-1000`}>◆</div>
        </div>
      </div>
    </div>
  );
}