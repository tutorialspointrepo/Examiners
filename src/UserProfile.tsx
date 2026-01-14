import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  Building2, 
  BookOpen, 
  Calendar,
  Edit2,
  Save,
  Camera,
  Shield,
  Award,
  Users,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { firebaseService } from './services/firebase_service';
import { useBrand } from './BrandContext';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onProfileUpdate?: () => void;
}

interface ProfileFormData {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  studentRoll?: string;
  academicYear?: string;
  studentClass?: string;
  board?: string;
  teacherClasses?: string[];
  teacherSubjects?: string[];
}

const userRoleConfig = {
  student: {
    icon: '🎓',
    label: 'Student',
    gradient: 'from-blue-500 via-purple-500 to-pink-500',
    bgGradient: 'from-blue-50 via-purple-50 to-pink-50',
    accentColor: '#6366f1',
    textColor: 'text-indigo-600',
    badgeBg: 'bg-gradient-to-r from-blue-500 to-purple-600',
    pattern: 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)'
  },
  teacher: {
    icon: '👨‍🏫',
    label: 'Teacher',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    bgGradient: 'from-emerald-50 via-teal-50 to-cyan-50',
    accentColor: '#10b981',
    textColor: 'text-emerald-600',
    badgeBg: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    pattern: 'radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(20, 184, 166, 0.3) 0%, transparent 50%)'
  },
  principal: {
    icon: '🏆',
    label: 'Principal',
    gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
    bgGradient: 'from-purple-50 via-fuchsia-50 to-pink-50',
    accentColor: '#a855f7',
    textColor: 'text-purple-600',
    badgeBg: 'bg-gradient-to-r from-purple-500 to-fuchsia-600',
    pattern: 'radial-gradient(circle at 20% 50%, rgba(168, 85, 247, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)'
  },
  dean: {
    icon: '👔',
    label: 'Dean',
    gradient: 'from-orange-500 via-red-500 to-rose-500',
    bgGradient: 'from-orange-50 via-red-50 to-rose-50',
    accentColor: '#f97316',
    textColor: 'text-orange-600',
    badgeBg: 'bg-gradient-to-r from-orange-500 to-red-600',
    pattern: 'radial-gradient(circle at 20% 50%, rgba(249, 115, 22, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(239, 68, 68, 0.3) 0%, transparent 50%)'
  },
  admin: {
    icon: '⚙️',
    label: 'Admin',
    gradient: 'from-slate-600 via-gray-700 to-zinc-800',
    bgGradient: 'from-slate-50 via-gray-50 to-zinc-50',
    accentColor: '#64748b',
    textColor: 'text-slate-600',
    badgeBg: 'bg-gradient-to-r from-slate-600 to-gray-800',
    pattern: 'radial-gradient(circle at 20% 50%, rgba(100, 116, 139, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(71, 85, 105, 0.3) 0%, transparent 50%)'
  },
  system_admin: {
    icon: '👑',
    label: 'System Admin',
    gradient: 'from-yellow-500 via-amber-500 to-orange-500',
    bgGradient: 'from-yellow-50 via-amber-50 to-orange-50',
    accentColor: '#f59e0b',
    textColor: 'text-amber-600',
    badgeBg: 'bg-gradient-to-r from-yellow-500 to-amber-600',
    pattern: 'radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(251, 191, 36, 0.3) 0%, transparent 50%)'
  }
};

export default function UserProfile({ isOpen, onClose, currentUser, onProfileUpdate }: UserProfileProps) {
  const brandTheme = useBrand();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasLoggedView = useRef(false);
  
  const [formData, setFormData] = useState<ProfileFormData>({
    fullName: '',
    title: '',
    email: '',
    phone: '',
    studentRoll: '',
    academicYear: '',
    studentClass: '',
    board: '',
    teacherClasses: [],
    teacherSubjects: []
  });

  // ✅ FIXED: Only initialize once when modal opens, not on every currentUser change
  useEffect(() => {
    if (isOpen && currentUser && !isInitialized) {
      console.log('🔵 === MODAL OPENED - INITIALIZING ===');
      console.log('📋 Initializing formData from currentUser (one time)');
      console.log('👤 Current User Object:', currentUser);
      console.log('📌 Title from DB:', currentUser.title);
      console.log('📌 FullName from DB:', currentUser.fullName);
      console.log('📌 Phone from DB:', currentUser.phone);
      console.log('📌 ProfilePicture from DB:', currentUser.profilePicture);
      
      setFormData({
        fullName: currentUser.fullName || '',
        title: currentUser.title || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        studentRoll: currentUser.studentRoll || '',
        academicYear: currentUser.academicYear || '',
        studentClass: currentUser.studentClass || '',
        board: currentUser.board || '',
        teacherClasses: currentUser.teacherClasses || [],
        teacherSubjects: currentUser.teacherSubjects || []
      });
      
      setProfilePictureUrl(currentUser.profilePicture || null);
      setError(null);
      setSuccess(null);
      setIsInitialized(true);
      console.log('✅ Initialization complete');
      console.log('🔵 =====================================');
      
      // Log view activity (non-blocking) - ONLY ONCE
      if (!hasLoggedView.current) {
        hasLoggedView.current = true; // Mark as logged
        (async () => {
          try {
            await firebaseService.addActivityLog({
              userId: currentUser.userId,
              collegeId: currentUser.collegeId,
              action: 'view_user_profile',
              entityType: 'user',
              entityId: currentUser.userId,
              details: JSON.stringify({
                fullName: currentUser.fullName,
                userType: currentUser.userType,
                viewedOwnProfile: true
              })
            });
          } catch (logError) {
            console.warn('⚠️ Failed to log profile view:', logError);
          }
        })();
      }
    }
  }, [isOpen, currentUser, isInitialized]);

  // ✅ Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      console.log('🔴 === MODAL CLOSING ===');
      console.log('🔴 Resetting state and initialization flag');
      setIsEditing(false);
      setError(null);
      setSuccess(null);
      setIsInitialized(false); // Reset initialization flag
      console.log('🔴 =======================');
    }
  }, [isOpen]);

  // ✅ Watch for currentUser changes (for debugging)
  useEffect(() => {
    console.log('🟡 currentUser changed:', {
      userId: currentUser?.userId,
      title: currentUser?.title,
      fullName: currentUser?.fullName,
      phone: currentUser?.phone,
      profilePicture: currentUser?.profilePicture
    });
  }, [currentUser]);

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (!currentUser?.userId) {
      setError('User not found. Please try logging in again.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      console.log('📤 Uploading profile picture...');
      const downloadURL = await firebaseService.uploadProfilePicture(file, currentUser.userId);
      
      if (!downloadURL) {
        throw new Error('Failed to upload image');
      }
      
      console.log('✅ Image uploaded, URL:', downloadURL);
      
      // Update local state immediately for instant UI update
      setProfilePictureUrl(downloadURL);
      
      // ✅ FIXED: Use consistent field name - profilePicture (not profilePictureUrl)
      console.log('💾 Updating user profile with new picture...');
      await firebaseService.updateUserProfile(currentUser.userId, { 
        profilePicture: downloadURL 
      }, currentUser);

      console.log('✅ Profile picture saved to database');
      setSuccess('Profile picture updated successfully!');
      
      // ✅ FIXED: Trigger parent refresh with proper delay for Firebase to sync
        setTimeout(() => {
        if (onProfileUpdate) {
            onProfileUpdate();
        }
        }, 2000);  // Increased from 0ms to 1000ms
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('❌ Profile picture upload error:', err);
      setError(err.message || 'Failed to upload profile picture');
      // ✅ FIXED: Revert local state on error
      setProfilePictureUrl(currentUser.profilePicture || null);
    } finally {
      setIsUploading(false);
    }
  };

const handleSaveProfile = async () => {
  setIsSaving(true);
  setError(null);

  try {
    if (!currentUser?.userId) {
      throw new Error('User not found');
    }

    console.log('🟢 === SAVING PROFILE ===');
    console.log('📝 User ID:', currentUser.userId);
    console.log('📝 Title to save:', formData.title);
    console.log('📝 FullName to save:', formData.fullName);
    console.log('📝 Phone to save:', formData.phone);

    const updates: any = {
      fullName: formData.fullName,
      phone: formData.phone
    };

    if (formData.title && formData.title.trim()) {
      updates.title = formData.title.trim();
    }

    console.log('💾 Final updates object:', JSON.stringify(updates, null, 2));
    
    await firebaseService.updateUserProfile(currentUser.userId, updates, currentUser);
    
    console.log('✅ firebaseService.updateUserProfile completed');
    console.log('🟢 ========================');

    setSuccess('Profile updated successfully!');
    setIsEditing(false);
    
    // ✅ Now safe to call onProfileUpdate - won't overwrite because isInitialized prevents re-init
    setTimeout(() => {
      console.log('🔄 Calling onProfileUpdate to refresh parent...');
      if (onProfileUpdate) {
        onProfileUpdate();
      }
    }, 2000);
    
    setTimeout(() => setSuccess(null), 3000);
  } catch (err: any) {
    console.error('❌ Save error:', err);
    setError(err.message || 'Failed to update profile');
  } finally {
    setIsSaving(false);
  }
};

  if (!isOpen) return null;

  const roleConfig = userRoleConfig[currentUser?.userType as keyof typeof userRoleConfig] || userRoleConfig.student;

  // Get brand colors with fallbacks
  const primaryColor = brandTheme?.colors?.primary || '#6366f1';
  const secondaryColor = brandTheme?.colors?.secondary || brandTheme?.colors?.primary || '#8b5cf6';

  // Helper function to format Firebase Timestamp
  const formatFirebaseDate = (timestamp: any): string => {
    if (!timestamp) return '—';
    
    try {
      let date: Date;
      
      console.log('📅 Formatting timestamp:', timestamp);
      console.log('🔍 Timestamp type:', typeof timestamp);
      console.log('🔑 Timestamp keys:', timestamp ? Object.keys(timestamp) : 'null');
      
      // Handle Firebase Timestamp object with toDate method (most common)
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
        console.log('✅ Used toDate():', date);
      }
      // Handle Firebase Timestamp object with seconds and nanoseconds
      else if (timestamp && timestamp.seconds !== undefined) {
        date = new Date(timestamp.seconds * 1000);
        console.log('✅ Used seconds:', date);
      }
      // Handle if it's already a Date object
      else if (timestamp instanceof Date) {
        date = timestamp;
        console.log('✅ Already a Date:', date);
      }
      // Handle ISO string
      else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
        console.log('✅ Parsed string:', date);
      }
      // Handle milliseconds timestamp
      else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
        console.log('✅ Used number:', date);
      }
      else {
        console.warn('⚠️ Unknown timestamp format:', timestamp);
        return '—';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('❌ Invalid date after conversion:', date);
        return '—';
      }
      
      const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      console.log('✅ Formatted date:', formatted);
      return formatted;
    } catch (error) {
      console.error('❌ Error formatting date:', error);
      return '—';
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col relative">
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: roleConfig.pattern }}></div>
        
        <div className="relative overflow-hidden">
          <div className="relative" style={{ height: '20rem', background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
            <div className="absolute inset-0">
              <div className="absolute top-6 left-10 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute bottom-6 right-10 w-28 h-28 bg-white/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="absolute top-4 right-20">
              <Sparkles className="text-white/40 w-5 h-5 animate-pulse" />
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all hover:rotate-90 duration-300 z-10"
          >
            <X size={20} />
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ bottom: '1.0rem' }}>
            <div className="relative group">
              <div className="absolute -inset-1.5 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}></div>
              
              <div className="relative w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white">
                {profilePictureUrl ? (
                  <img 
                    src={profilePictureUrl} 
                    alt={currentUser.fullName}
                    className="w-full h-full object-cover"
                    key={profilePictureUrl} // Force re-render when URL changes
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br ${roleConfig.gradient}`}>
                    <span className="drop-shadow-lg">{roleConfig.icon}</span>
                  </div>
                )}
                
                {/* Camera button INSIDE the circle - Only visible in edit mode */}
                {isEditing && (
                  <label 
                    htmlFor="profile-picture-upload"
                    className="absolute bottom-0 right-0 left-0 bg-black/50 hover:bg-black/70 cursor-pointer transition-all py-2 flex items-center justify-center"
                    title="Upload Photo"
                  >
                    {isUploading ? (
                      <Clock size={20} className="text-white animate-spin" />
                    ) : (
                      <Camera size={20} className="text-white" />
                    )}
                  </label>
                )}
              </div>

              <input
                id="profile-picture-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePictureUpload}
                disabled={isUploading || !isEditing}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 mt-8 relative">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 text-sm animate-slideIn flex items-center">
              <X className="mr-2" size={18} />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg text-green-700 text-sm animate-slideIn flex items-center">
              <CheckCircle size={18} className="mr-2" />
              {success}
            </div>
          )}

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                {formData.fullName || currentUser?.fullName || 'User'}
              </span>
            </h2>
            {/* Student badge - around line 417 */}
            <div className="inline-flex items-center space-x-2 px-5 py-1.5 rounded-full shadow-lg mb-3" 
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
            <span className="text-xl">{roleConfig.icon}</span>
            <span className="font-bold text-white text-sm tracking-wide">
                {roleConfig.label}
            </span>
            </div>

            {/* Edit Profile button - around line 425 */}
            {!isEditing && (
            <button
                onClick={() => setIsEditing(true)}
                className="mt-3 inline-flex items-center space-x-2 px-5 py-2 rounded-full text-white transition-all duration-300 shadow-md hover:shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
            >
                <Edit2 size={16} />
                <span className="font-semibold text-sm">Edit Profile</span>
            </button>
            )}
          </div>

          <div className="space-y-6">
            {/* Basic Information Card */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-2 rounded-lg ${roleConfig.badgeBg}`}>
                  <User size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
              </div>
              
              <div className="space-y-4">
                {/* Title - Only for non-students */}
                {currentUser?.userType !== 'student' && (
                  <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${roleConfig.bgGradient}`}>
                      <User size={18} className={roleConfig.textColor} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title / Designation</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                          placeholder="e.g., Senior Professor, Head of Department, Principal"
                        />
                      ) : (
                        <p className="text-base text-gray-900">
                          {formData.title || '—'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Full Name */}
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${roleConfig.bgGradient}`}>
                    <User size={18} className={roleConfig.textColor} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="Enter full name"
                      />
                    ) : (
                      <p className="text-base text-gray-900">
                        {formData.fullName || '—'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-gray-100">
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${roleConfig.bgGradient}`}>
                    <Mail size={18} className={roleConfig.textColor} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-base text-gray-900 break-all">
                      {currentUser?.email || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <Shield size={12} className="mr-1" />
                      Email cannot be changed
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${roleConfig.bgGradient}`}>
                    <Phone size={18} className={roleConfig.textColor} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone</p>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="Phone number"
                      />
                    ) : (
                      <p className="text-base text-gray-900">
                        {formData.phone || '—'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information - For All Users */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-r from-slate-600 to-gray-700">
                  <Shield size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Account Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Type */}
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-slate-100">
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${roleConfig.bgGradient}`}>
                    <User size={18} className={roleConfig.textColor} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">User Type</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{roleConfig.icon}</span>
                      <span className="text-base text-gray-900">{roleConfig.label}</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-slate-100">
                  <div className="p-2.5 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50">
                    <CheckCircle size={18} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                    <div className="inline-flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-base font-semibold text-green-700">Active</span>
                    </div>
                  </div>
                </div>

                {/* User ID */}
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-slate-100">
                  <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50">
                    <Shield size={18} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">User ID</p>
                    <p className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 break-all">
                      {currentUser?.userId || '—'}
                    </p>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-white border border-slate-100">
                  <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50">
                    <Clock size={18} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Last Updated</p>
                    <p className="text-sm text-gray-900">
                      {formatFirebaseDate(currentUser?.updatedAt || currentUser?.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Information */}
            {currentUser?.userType === 'student' && (
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600">
                    <GraduationCap size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Academic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3 p-4 rounded-xl bg-white border border-blue-100">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                      <Award size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Roll Number</p>
                      <p className="text-base text-gray-900">
                        {currentUser?.studentRoll || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-xl bg-white border border-blue-100">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                      <GraduationCap size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Class</p>
                      <p className="text-base text-gray-900">
                        {currentUser?.studentClass || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-xl bg-white border border-blue-100">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Board</p>
                      <p className="text-base text-gray-900">
                        {currentUser?.board || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-xl bg-white border border-blue-100">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                      <Calendar size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Academic Year</p>
                      <p className="text-base text-gray-900">
                        {currentUser?.academicYear || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Teacher Information */}
            {currentUser?.userType === 'teacher' && (
              <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl p-6 shadow-lg border border-green-100 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600">
                    <BookOpen size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Teaching Information</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white border border-green-100">
                    <div className="flex items-center space-x-2 mb-3">
                      <Users size={18} className="text-emerald-600" />
                      <p className="text-sm font-semibold text-gray-700">Assigned Classes</p>
                    </div>
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {currentUser?.teacherClasses && currentUser.teacherClasses.length > 0 ? (
                        currentUser.teacherClasses.map((cls: string, index: number) => (
                          <span 
                            key={index}
                            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                          >
                            {cls}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic">No classes assigned</p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-green-100">
                    <div className="flex items-center space-x-2 mb-3">
                      <BookOpen size={18} className="text-emerald-600" />
                      <p className="text-sm font-semibold text-gray-700">Teaching Subjects</p>
                    </div>
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {currentUser?.teacherSubjects && currentUser.teacherSubjects.length > 0 ? (
                        currentUser.teacherSubjects.map((subject: string, index: number) => (
                          <span 
                            key={index}
                            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                          >
                            {subject}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic">No subjects assigned</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admin/Principal/Dean - Institution Information */}
            {(currentUser?.userType === 'admin' || currentUser?.userType === 'principal' || currentUser?.userType === 'dean' || currentUser?.userType === 'system_admin') && (
              <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-6 shadow-lg border border-purple-100 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-2 rounded-lg ${roleConfig.badgeBg}`}>
                    <Building2 size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Institution Information</h3>
                </div>
                
                <div className="p-4 rounded-xl bg-white border border-purple-100">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${roleConfig.bgGradient}`}>
                      <Building2 size={18} className={roleConfig.textColor} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Institution Name</p>
                      <p className="text-base text-gray-900">
                        {currentUser?.collegeName || brandTheme.collegeName || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="px-8 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 flex items-center justify-end space-x-3 relative">
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  fullName: currentUser?.fullName || '',
                  title: currentUser?.title || '',
                  email: currentUser?.email || '',
                  phone: currentUser?.phone || '',
                  studentRoll: currentUser?.studentRoll || '',
                  academicYear: currentUser?.academicYear || '',
                  studentClass: currentUser?.studentClass || '',
                  board: currentUser?.board || '',
                  teacherClasses: currentUser?.teacherClasses || [],
                  teacherSubjects: currentUser?.teacherSubjects || []
                });
                setError(null);
              }}
              className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-white hover:border-gray-400 transition-all shadow-sm hover:shadow-md"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="px-6 py-3 rounded-xl text-white font-semibold flex items-center space-x-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin">
                    <Clock size={18} />
                  </div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}