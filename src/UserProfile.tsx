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
  ExternalLink,
  Code2,
  Loader,
  Flame,
} from 'lucide-react';
import { firebaseService } from './services/firebase_service';
import { useBrand } from './BrandContext';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onProfileUpdate?: () => void;
  initialView?: 'profile' | 'leetcode';
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
  leetcodeUsername?: string;
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

export default function UserProfile({ isOpen, onClose, currentUser, onProfileUpdate, initialView }: UserProfileProps) {
  const brandTheme = useBrand();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasLoggedView = useRef(false);
  const savedLeetcodeUsername = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Student proctoring photos
  const [proctoringPhotos, setProctoringPhotos] = useState({
    front: null as string | null,
    left: null as string | null,
    right: null as string | null
  });
  const [uploadingPhoto, setUploadingPhoto] = useState<'front' | 'left' | 'right' | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState<'front' | 'left' | 'right' | 'profile' | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'left' | 'right' | 'profile' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);
  
  // LeetCode stats
  const [leetcodeStats, setLeetcodeStats] = useState<any>(null);
  const [leetcodeLoading, setLeetcodeLoading] = useState(false);
  const [leetcodeError, setLeetcodeError] = useState<string | null>(null);
  const [, setShowLeetcodeStats] = useState(false);
  const [profileView, setProfileView] = useState<'profile' | 'leetcode'>('profile');
  
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
    teacherSubjects: [],
    leetcodeUsername: '',
  });

  // Initialize once when modal opens
  useEffect(() => {
    if (isOpen && currentUser && !isInitialized) {
      console.log('🔵 === MODAL OPENED - INITIALIZING ===');
      
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
        teacherSubjects: currentUser.teacherSubjects || [],
        leetcodeUsername: savedLeetcodeUsername.current || currentUser.leetcodeUsername || '',
      });
      
      // Clear the ref once currentUser has caught up
      if (currentUser.leetcodeUsername && savedLeetcodeUsername.current) {
        savedLeetcodeUsername.current = null;
      }
      
      setProfilePictureUrl(currentUser.profilePicture || null);
      
      // Initialize proctoring photos for students
      if (currentUser.userType === 'student') {
        console.log('📸 Loading proctoring photos from currentUser:', currentUser.proctoringPhotos);
        setProctoringPhotos({
          front: currentUser.proctoringPhotos?.front || null,
          left: currentUser.proctoringPhotos?.left || null,
          right: currentUser.proctoringPhotos?.right || null
        });
        console.log('📸 Proctoring photos state set to:', {
          front: currentUser.proctoringPhotos?.front || null,
          left: currentUser.proctoringPhotos?.left || null,
          right: currentUser.proctoringPhotos?.right || null
        });
      }
      
      setError(null);
      setSuccess(null);
      setIsInitialized(true);
      
      // Handle initialView prop - auto-open LeetCode profile
      if (initialView === 'leetcode' && currentUser.leetcodeUsername) {
        fetchLeetCodeStats(currentUser.leetcodeUsername);
      }
      
      // Log view activity (non-blocking) - ONLY ONCE
      if (!hasLoggedView.current) {
        hasLoggedView.current = true;
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

  // Sync proctoring photos whenever currentUser changes (after parent refreshes data)
  useEffect(() => {
    if (currentUser?.userType === 'student' && currentUser?.proctoringPhotos && isOpen) {
      console.log('🔄 Syncing proctoring photos from updated currentUser:', currentUser.proctoringPhotos);
      setProctoringPhotos({
        front: currentUser.proctoringPhotos.front || null,
        left: currentUser.proctoringPhotos.left || null,
        right: currentUser.proctoringPhotos.right || null
      });
    }
  }, [currentUser?.proctoringPhotos, isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Delay state reset to allow animation to complete
      const timer = setTimeout(() => {
        setIsEditing(false);
        setError(null);
        setSuccess(null);
        setIsInitialized(false);
        hasLoggedView.current = false;
        savedLeetcodeUsername.current = null;
        
        // Stop camera if active
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        setShowCameraModal(false);
        setCameraPosition(null);
        setProfileView('profile');
        setShowLeetcodeStats(false);
        setLeetcodeStats(null);
        setLeetcodeError(null);
      }, 250);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, cameraStream]);

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation checks
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!currentUser?.userId) {
      setError('User not found. Please try logging in again.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Store previous photo URL for rollback
    const previousPhotoUrl = profilePictureUrl;

    setIsUploading(true);
    setError(null);

    try {
      console.log('📤 Uploading profile picture...');
      
      // Use standardized filename - will overwrite existing profile picture
      const standardFileName = `profile_picture.jpg`;
      const renamedFile = new File([file], standardFileName, { type: 'image/jpeg' });
      
      const downloadURL = await firebaseService.uploadProfilePicture(renamedFile, currentUser.userId);
      
      if (!downloadURL) {
        throw new Error('Failed to upload image - no URL returned');
      }
      
      console.log('✅ Profile picture uploaded to storage:', downloadURL);
      
      // Optimistically update local state
      setProfilePictureUrl(downloadURL);
      
      console.log('💾 Updating database with new profile picture...');
      await firebaseService.updateUserProfile(currentUser.userId, { 
        profilePicture: downloadURL 
      }, currentUser);

      console.log('✅ Profile picture saved to database successfully');
      
      setSuccess('Profile picture updated successfully!');
      
      setTimeout(() => {
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      }, 2000);
      
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('❌ Profile picture upload error:', err);
      
      // Rollback local state to previous value
      setProfilePictureUrl(previousPhotoUrl);
      
      // Determine error message
      let errorMessage = 'Failed to upload profile picture';
      
      if (err.code === 'storage/unauthorized') {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (err.code === 'storage/canceled') {
        errorMessage = 'Upload canceled.';
      } else if (err.code === 'storage/unknown') {
        errorMessage = 'Unknown error occurred. Please try again.';
      } else if (err.code === 'storage/retry-limit-exceeded') {
        errorMessage = 'Upload timeout. Please check your connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
      
    } finally {
      setIsUploading(false);
      
      // Clear file input to allow re-uploading the same file
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleProctoringPhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    position: 'front' | 'left' | 'right'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation checks
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!currentUser?.userId) {
      setError('User not found. Please try logging in again.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Store previous photo URL for rollback
    const previousPhotoUrl = proctoringPhotos[position];
    
    setUploadingPhoto(position);
    setError(null);

    try {
      console.log(`📤 Uploading ${position} proctoring photo...`);
      
      // Rename file to standardized name before uploading
      const standardFileName = `proctoring_${position}.jpg`;
      const renamedFile = new File([file], standardFileName, { type: 'image/jpeg' });
      
      // Upload to Firebase Storage
      const downloadURL = await firebaseService.uploadProfilePicture(
        renamedFile, 
        currentUser.userId
      );
      
      if (!downloadURL) {
        throw new Error('Failed to upload image - no URL returned');
      }
      
      console.log(`✅ ${position} photo uploaded to storage:`, downloadURL);
      
      // Update local state first
      const updatedPhotos = {
        ...proctoringPhotos,
        [position]: downloadURL
      };
      
      setProctoringPhotos(updatedPhotos);
      
      console.log(`💾 Saving to database:`, updatedPhotos);
      console.log(`📊 Current proctoringPhotos state before save:`, proctoringPhotos);
      
      // Update database
      await firebaseService.updateUserProfile(currentUser.userId, { 
        proctoringPhotos: updatedPhotos
      }, currentUser);

      console.log(`✅ ${position} photo saved to database successfully`);
      console.log(`📊 Updated proctoringPhotos state after save:`, updatedPhotos);
      
      setSuccess(`${position.charAt(0).toUpperCase() + position.slice(1)} photo updated successfully!`);
      
      setTimeout(() => {
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      }, 2000);
      
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error(`❌ ${position} photo upload error:`, err);
      
      // Rollback local state to previous value
      setProctoringPhotos(prev => ({
        ...prev,
        [position]: previousPhotoUrl
      }));
      
      // Determine error message
      let errorMessage = `Failed to upload ${position} photo`;
      
      if (err.code === 'storage/unauthorized') {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (err.code === 'storage/canceled') {
        errorMessage = 'Upload canceled.';
      } else if (err.code === 'storage/unknown') {
        errorMessage = 'Unknown error occurred. Please try again.';
      } else if (err.code === 'storage/retry-limit-exceeded') {
        errorMessage = 'Upload timeout. Please check your connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
      
    } finally {
      setUploadingPhoto(null);
      
      // Clear file input to allow re-uploading the same file
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Fetch LeetCode stats via Cloud Function (with 6-hour client cache)
  const fetchLeetCodeStats = async (username: string, forceRefresh = false) => {
    if (!username.trim()) return;
    
    const cacheKey = `leetcode_stats_${username.trim().toLowerCase()}`;
    const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
    
    // Check localStorage cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            console.log('📦 LeetCode stats loaded from cache');
            setLeetcodeStats({ ...data, fromCache: true });
            setShowLeetcodeStats(true);
            setProfileView('leetcode');
            return;
          }
        }
      } catch (e) {
        // Cache read failed, continue to fetch
      }
    }
    
    setLeetcodeLoading(true);
    setLeetcodeError(null);
    setShowLeetcodeStats(true);
    setProfileView('leetcode');

    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const fetchStats = httpsCallable(functions, 'fetchLeetCodeStats');
      const result = await fetchStats({ username: username.trim(), forceRefresh });
      const data = result.data as any;
      console.log('LeetCode stats response:', data);
      if (data.error || data.success === false) {
        setLeetcodeError(data.error || 'Failed to fetch stats');
      } else {
        setLeetcodeStats(data);
        // Save to localStorage cache
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (e) {
          // Cache write failed, ignore
        }
      }
    } catch (err: any) {
      console.error('LeetCode fetch error:', err);
      setLeetcodeError('Failed to fetch LeetCode data. Please try again.');
    } finally {
      setLeetcodeLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (!currentUser?.userId) {
        throw new Error('User not found');
      }

      // Email validation for students
      if (currentUser.userType === 'student' && formData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          throw new Error('Please enter a valid email address');
        }
        
        // Check if email is being changed
        const newEmail = formData.email.trim().toLowerCase();
        if (newEmail !== currentUser.email.toLowerCase()) {
          console.log('🔍 Checking email uniqueness across database...');
          
          // Check if email already exists for another user
          const existingUser = await firebaseService.getUserByEmail(newEmail);
          const emailExists = existingUser !== null && existingUser.userId !== currentUser.userId;
          
          if (emailExists) {
            throw new Error('This email address is already registered to another user. Please use a different email.');
          }
          
          console.log('✅ Email is unique and available');
        }
      }

      const updates: any = {
        fullName: formData.fullName,
        phone: formData.phone
      };

      // Allow students to update email
      if (currentUser.userType === 'student' && formData.email && formData.email !== currentUser.email) {
        updates.email = formData.email.trim().toLowerCase();
      }

      if (formData.title && formData.title.trim()) {
        updates.title = formData.title.trim();
      }

      // Save leetcode username for students
      if (currentUser.userType === 'student') {
        updates.leetcodeUsername = (formData.leetcodeUsername || '').trim();
      }

      console.log('💾 Updating user profile with:', updates);
      
      await firebaseService.updateUserProfile(currentUser.userId, updates, currentUser);

      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      
      // Store the saved leetcodeUsername so it survives re-initialization
      if (currentUser.userType === 'student' && formData.leetcodeUsername) {
        savedLeetcodeUsername.current = formData.leetcodeUsername.trim();
      }
      
      // Refresh parent immediately and reinitialize modal with fresh data
      if (onProfileUpdate) {
        await onProfileUpdate();
        setIsInitialized(false);
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('❌ Save error:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Camera functions
  const startCamera = async (position: 'front' | 'left' | 'right' | 'profile') => {
    setCameraPosition(position);
    setCameraError(null);
    setShowCameraModal(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      
      let errorMessage = 'Failed to access camera';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not supported.';
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setShowCameraModal(false);
    setCameraPosition(null);
    setCameraError(null);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraPosition) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set capturing state
    setCapturingPhoto(cameraPosition);

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Flip the image horizontally to remove mirror effect
    context.save();
    context.scale(-1, 1);
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    context.restore();

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Failed to capture photo');
        setCapturingPhoto(null);
        return;
      }

      // Create a File object from blob
      const file = new File([blob], `${cameraPosition}_photo.jpg`, { type: 'image/jpeg' });

      // Stop camera
      stopCamera();

      // Upload the captured photo
      if (cameraPosition === 'profile') {
        await uploadProfilePictureFile(file);
      } else {
        await uploadProctoringPhotoFile(file, cameraPosition);
      }
      
      // Clear capturing state
      setCapturingPhoto(null);
    }, 'image/jpeg', 0.9);
  };

  const uploadProfilePictureFile = async (file: File) => {
    if (!currentUser?.userId) {
      setError('User not found. Please try logging in again.');
      return;
    }

    const previousPhotoUrl = profilePictureUrl;
    
    // Only set uploading if not capturing (i.e., manual upload)
    const isFromCamera = capturingPhoto === 'profile';
    if (!isFromCamera) {
      setIsUploading(true);
    }
    
    setError(null);

    try {
      // Use standardized filename - will overwrite existing profile picture
      const standardFileName = `profile_picture.jpg`;
      const renamedFile = new File([file], standardFileName, { type: 'image/jpeg' });
      
      const downloadURL = await firebaseService.uploadProfilePicture(renamedFile, currentUser.userId);
      
      if (!downloadURL) {
        throw new Error('Failed to upload image - no URL returned');
      }
      
      setProfilePictureUrl(downloadURL);
      
      await firebaseService.updateUserProfile(currentUser.userId, { 
        profilePicture: downloadURL 
      }, currentUser);

      setSuccess('Profile picture updated successfully!');
      
      setTimeout(() => {
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      }, 2000);
      
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('❌ Profile picture upload error:', err);
      setProfilePictureUrl(previousPhotoUrl);
      
      let errorMessage = 'Failed to upload profile picture';
      if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
      
    } finally {
      setIsUploading(false);
    }
  };

  const uploadProctoringPhotoFile = async (file: File, position: 'front' | 'left' | 'right') => {
    if (!currentUser?.userId) {
      setError('User not found. Please try logging in again.');
      return;
    }

    const previousPhotoUrl = proctoringPhotos[position];
    
    // Only set uploading if not capturing (i.e., manual upload)
    const isFromCamera = capturingPhoto === position;
    if (!isFromCamera) {
      setUploadingPhoto(position);
    }
    
    setError(null);

    try {
      console.log(`📤 Uploading ${position} proctoring photo...`);
      
      // Use standardized filename - will overwrite existing proctoring photo
      const standardFileName = `proctoring_${position}.jpg`;
      const renamedFile = new File([file], standardFileName, { type: 'image/jpeg' });
      
      // Upload using the standard method with standardized filename
      const downloadURL = await firebaseService.uploadProfilePicture(
        renamedFile, 
        currentUser.userId
      );
      
      if (!downloadURL) {
        throw new Error('Failed to upload image - no URL returned');
      }
      
      console.log(`✅ ${position} photo uploaded to storage:`, downloadURL);
      
      // Update local state first
      const updatedPhotos = {
        ...proctoringPhotos,
        [position]: downloadURL
      };
      
      setProctoringPhotos(updatedPhotos);
      
      console.log(`💾 Saving to database:`, updatedPhotos);
      
      await firebaseService.updateUserProfile(currentUser.userId, { 
        proctoringPhotos: updatedPhotos
      }, currentUser);

      console.log(`✅ ${position} photo saved to database successfully`);
      
      setSuccess(`${position.charAt(0).toUpperCase() + position.slice(1)} photo updated successfully!`);
      
      setTimeout(() => {
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      }, 2000);
      
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error(`❌ ${position} photo upload error:`, err);
      
      setProctoringPhotos(prev => ({
        ...prev,
        [position]: previousPhotoUrl
      }));
      
      let errorMessage = `Failed to upload ${position} photo`;
      if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
      
    } finally {
      setUploadingPhoto(null);
    }
  };

  const formatFirebaseDate = (timestamp: any): string => {
    if (!timestamp) return '—';
    
    try {
      let date: Date;
      
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp && timestamp.seconds !== undefined) {
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else {
        return '—';
      }
      
      if (isNaN(date.getTime())) {
        return '—';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('❌ Error formatting date:', error);
      return '—';
    }
  };

  const roleConfig = userRoleConfig[currentUser?.userType as keyof typeof userRoleConfig] || userRoleConfig.student;
  const primaryColor = brandTheme?.colors?.primary || '#6366f1';
  const secondaryColor = brandTheme?.colors?.secondary || brandTheme?.colors?.primary || '#8b5cf6';

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar Panel - with margin and rounded corners */}
      <div 
        className={`fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl z-[10001] transition-transform duration-200 ease-out rounded-2xl overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="h-full flex flex-col">
          {profileView === 'leetcode' ? (
            /* ===== FULL LEETCODE PROFILE VIEW ===== */
            <>
              {/* LeetCode Header */}
              <div className="relative overflow-hidden rounded-t-2xl" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', minHeight: '140px' }}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #ffa116 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ffa116 0%, transparent 50%)' }}></div>
                <button onClick={() => { setProfileView('profile'); setShowLeetcodeStats(false); }} className="absolute top-4 left-4 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors z-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  Back
                </button>
                <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center z-50"><X size={18} /></button>

                {leetcodeStats && (
                  <div className="relative z-10 flex items-center gap-4 px-6 pt-14 pb-5">
                    {leetcodeStats.avatar ? (
                      <img 
                        src={leetcodeStats.avatar} 
                        alt="" 
                        className="w-16 h-16 rounded-xl border-2 border-amber-400/30 shadow-lg" 
                        crossOrigin="anonymous"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`w-16 h-16 rounded-xl border-2 border-amber-400/30 shadow-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center ${leetcodeStats.avatar ? 'hidden' : ''}`}>
                      <span className="text-2xl font-black text-amber-600">{(leetcodeStats.username || 'L')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-white">{leetcodeStats.name || leetcodeStats.username}</h2>
                      <a href={`https://leetcode.com/u/${leetcodeStats.username}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 text-sm hover:text-amber-300 flex items-center gap-1">
                        @{leetcodeStats.username} <ExternalLink size={11} />
                      </a>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Code2 size={16} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">LeetCode</span>
                      </div>
                      {leetcodeStats.ranking > 0 && (
                        <p className="text-xs text-white/50">Rank #{leetcodeStats.ranking.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* LeetCode Content */}
              <div className="flex-1 overflow-y-auto bg-gray-50">
                {leetcodeLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                      <Loader size={24} className="animate-spin text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Fetching LeetCode profile...</p>
                    <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
                  </div>
                ) : leetcodeError ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                      <X size={28} className="text-red-400" />
                    </div>
                    <p className="text-base font-semibold text-gray-800 mb-1">Could not load profile</p>
                    <p className="text-sm text-red-500 mb-5 text-center">{leetcodeError}</p>
                    <div className="flex gap-3">
                      <button onClick={() => fetchLeetCodeStats(currentUser?.leetcodeUsername || savedLeetcodeUsername.current || formData.leetcodeUsername || '', true)} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#ffa116' }}>Try Again</button>
                      <button onClick={() => { setProfileView('profile'); setShowLeetcodeStats(false); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Go Back</button>
                    </div>
                  </div>
                ) : leetcodeStats ? (
                  <div className="p-5 space-y-4">

                    {/* Row 1: Problems Donut + Badges */}
                    <div className="grid grid-cols-5 gap-4">
                      {/* Problems Solved - Donut Chart */}
                      <div className="col-span-3 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-start gap-5">
                          {/* SVG Donut */}
                          <div className="relative flex-shrink-0" style={{ width: '120px', height: '120px' }}>
                            <svg viewBox="0 0 120 120" className="w-full h-full">
                              <circle cx="60" cy="60" r="48" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                              {(() => {
                                const easy = leetcodeStats.easySolved || 0;
                                const med = leetcodeStats.mediumSolved || 0;
                                const hard = leetcodeStats.hardSolved || 0;
                                const total = leetcodeStats.totalQuestions || 1;
                                const circumference = 2 * Math.PI * 48;
                                const easyPct = (easy / total) * circumference;
                                const medPct = (med / total) * circumference;
                                const hardPct = (hard / total) * circumference;
                                let offset = circumference * 0.25; // start from top
                                const segments = [
                                  { len: easyPct, color: '#22c55e', offset },
                                  { len: medPct, color: '#f59e0b', offset: offset - easyPct },
                                  { len: hardPct, color: '#ef4444', offset: offset - easyPct - medPct },
                                ];
                                return segments.map((s, i) => (
                                  <circle key={i} cx="60" cy="60" r="48" fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${s.len} ${circumference - s.len}`} strokeDashoffset={s.offset} strokeLinecap="round" className="transition-all duration-700" />
                                ));
                              })()}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-2xl font-black text-gray-900">{leetcodeStats.totalSolved}</span>
                              <span className="text-xs text-gray-400">/{leetcodeStats.totalQuestions}</span>
                              <span className="text-xs text-green-500 flex items-center gap-0.5 mt-0.5">
                                <CheckCircle size={10} /> Solved
                              </span>
                            </div>
                          </div>

                          {/* Difficulty Breakdown */}
                          <div className="flex-1 space-y-3 pt-1">
                            {[
                              { label: 'Easy', count: leetcodeStats.easySolved || 0, total: leetcodeStats.totalEasy || 0, color: '#22c55e', bg: '#dcfce7' },
                              { label: 'Med.', count: leetcodeStats.mediumSolved || 0, total: leetcodeStats.totalMedium || 0, color: '#f59e0b', bg: '#fef3c7' },
                              { label: 'Hard', count: leetcodeStats.hardSolved || 0, total: leetcodeStats.totalHard || 0, color: '#ef4444', bg: '#fee2e2' },
                            ].map(d => (
                              <div key={d.label}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold" style={{ color: d.color }}>{d.label}</span>
                                  <span className="text-xs text-gray-600 font-semibold">{d.count}<span className="text-gray-400">/{d.total}</span></span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${d.total > 0 ? (d.count / d.total) * 100 : 0}%`, backgroundColor: d.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Badges Card */}
                      <div className="col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-gray-500 uppercase">Badges</p>
                          <span className="text-lg font-black text-gray-800">{leetcodeStats.badges?.length || 0}</span>
                        </div>
                        {leetcodeStats.badges && leetcodeStats.badges.length > 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center">
                            {leetcodeStats.badges[0]?.icon && (
                              <img src={leetcodeStats.badges[0].icon} alt="" className="w-14 h-14 mb-2" crossOrigin="anonymous" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                            )}
                            <p className="text-xs text-gray-400">Most Recent Badge</p>
                            <p className="text-sm font-bold text-gray-800">{leetcodeStats.badges[0]?.name}</p>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-gray-300">
                            <Award size={32} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Contest Rating Card - Full Width with Line Graph */}
                    {(leetcodeStats.contestRating > 0 || leetcodeStats.contestsAttended > 0) && (
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        {/* Header stats row */}
                        <div className="flex items-center gap-5 mb-1">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Contest Rating</p>
                            <p className="text-3xl font-black text-gray-900">{leetcodeStats.contestRating.toLocaleString()}</p>
                          </div>
                          {leetcodeStats.badges?.[0] && (
                            <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
                              {leetcodeStats.badges[0].icon && <img src={leetcodeStats.badges[0].icon} alt="" className="w-8 h-8" crossOrigin="anonymous" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />}
                              <div>
                                <p className="text-xs text-gray-400">Level</p>
                                <p className="text-sm font-bold text-blue-600">{leetcodeStats.badges[0].name}</p>
                              </div>
                            </div>
                          )}
                          <div className="ml-auto flex items-center gap-5">
                            <div className="text-center">
                              <p className="text-xs text-gray-400">Global Ranking</p>
                              <p className="text-sm font-bold text-gray-800">{leetcodeStats.contestGlobalRanking > 0 ? `${leetcodeStats.contestGlobalRanking.toLocaleString()}` : '—'}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-400">Attended</p>
                              <p className="text-sm font-bold text-gray-800">{leetcodeStats.contestsAttended}</p>
                            </div>
                            {leetcodeStats.contestTopPercentage > 0 && (
                              <div className="text-center">
                                <p className="text-xs text-gray-400">Top</p>
                                <p className="text-sm font-bold text-green-600">{leetcodeStats.contestTopPercentage}%</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Contest Rating Line Chart - Interactive */}
                        {leetcodeStats.contestHistory && leetcodeStats.contestHistory.length > 1 ? (
                          <div 
                            className="relative mt-2 cursor-crosshair" 
                            style={{ height: '130px' }}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = (e.clientX - rect.left) / rect.width;
                              const idx = Math.round(x * (leetcodeStats.contestHistory.length - 1));
                              const clamped = Math.max(0, Math.min(leetcodeStats.contestHistory.length - 1, idx));
                              const el = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
                              const dot = e.currentTarget.querySelector('[data-dot]') as HTMLElement;
                              const line = e.currentTarget.querySelector('[data-vline]') as HTMLElement;
                              if (el && dot && line) {
                                const h = leetcodeStats.contestHistory[clamped];
                                const ratings = leetcodeStats.contestHistory.map((r: any) => r.rating);
                                const minR = Math.min(...ratings) - 100;
                                const maxR = Math.max(...ratings) + 100;
                                const range = maxR - minR || 1;
                                const px = (clamped / (leetcodeStats.contestHistory.length - 1)) * 100;
                                const py = 100 - ((h.rating - minR) / range) * 85;
                                dot.style.left = `${px}%`;
                                dot.style.top = `${py}%`;
                                dot.style.display = 'block';
                                line.style.left = `${px}%`;
                                line.style.display = 'block';
                                el.style.left = `${Math.min(Math.max(px, 15), 85)}%`;
                                el.style.display = 'block';
                                el.innerHTML = `<div class="text-xs font-bold text-gray-800">${h.rating.toLocaleString()}</div><div class="text-xs text-gray-400">${h.title || ''}</div>${h.timestamp ? `<div class="text-xs text-gray-400">${new Date(h.timestamp * 1000).toLocaleDateString()}</div>` : ''}`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              const el = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
                              const dot = e.currentTarget.querySelector('[data-dot]') as HTMLElement;
                              const line = e.currentTarget.querySelector('[data-vline]') as HTMLElement;
                              if (el) el.style.display = 'none';
                              if (dot) dot.style.display = 'none';
                              if (line) line.style.display = 'none';
                            }}
                          >
                            {/* SVG Chart */}
                            <svg viewBox="0 0 500 130" className="w-full h-full" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
                              {(() => {
                                const history = leetcodeStats.contestHistory;
                                const ratings = history.map((h: any) => h.rating);
                                const minR = Math.min(...ratings) - 100;
                                const maxR = Math.max(...ratings) + 100;
                                const range = maxR - minR || 1;
                                const pts = history.map((h: any, i: number) => {
                                  const x = (i / (history.length - 1)) * 480 + 10;
                                  const y = 115 - ((h.rating - minR) / range) * 95;
                                  return `${x},${y}`;
                                });
                                const line = pts.join(' ');
                                const firstYear = history[0]?.timestamp ? new Date(history[0].timestamp * 1000).getFullYear() : '';
                                const lastYear = history[history.length - 1]?.timestamp ? new Date(history[history.length - 1].timestamp * 1000).getFullYear() : '';
                                return (
                                  <>
                                    <defs>
                                      <linearGradient id="lcRatingGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                                      </linearGradient>
                                    </defs>
                                    <polygon points={`10,118 ${line} 490,118`} fill="url(#lcRatingGrad)" />
                                    <polyline points={line} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                                    {firstYear && <text x="12" y="128" fill="#9ca3af" fontSize="10">{firstYear}</text>}
                                    {lastYear && <text x="488" y="128" fill="#9ca3af" fontSize="10" textAnchor="end">{lastYear}</text>}
                                  </>
                                );
                              })()}
                            </svg>
                            {/* Hover vertical line */}
                            <div data-vline="" className="absolute top-0 bottom-4 w-px bg-amber-300/50 pointer-events-none" style={{ display: 'none', transform: 'translateX(-50%)' }}></div>
                            {/* Hover dot */}
                            <div data-dot="" className="absolute w-3 h-3 rounded-full bg-white border-2 border-amber-500 pointer-events-none shadow-sm" style={{ display: 'none', transform: 'translate(-50%, -50%)' }}></div>
                            {/* Tooltip */}
                            <div data-tooltip="" className="absolute pointer-events-none bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 -top-2" style={{ display: 'none', transform: 'translate(-50%, -100%)', zIndex: 10 }}></div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-6">Not enough contest data for chart</p>
                        )}
                      </div>
                    )}

                    {/* Row 3: Top Percentile Card - Full Width */}
                    {leetcodeStats.contestHistory && leetcodeStats.contestHistory.length > 0 && (
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs text-gray-400">Top</p>
                            <p className="text-3xl font-black text-gray-900">{leetcodeStats.contestTopPercentage > 0 ? `${leetcodeStats.contestTopPercentage}%` : '—'}</p>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-xs text-gray-400">Rating Range</p>
                              <p className="text-xs font-semibold text-gray-600">
                                {(() => {
                                  const ratings = leetcodeStats.contestHistory.map((h: any) => h.rating);
                                  return `${Math.min(...ratings).toLocaleString()} – ${Math.max(...ratings).toLocaleString()}`;
                                })()}
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Rating Distribution Histogram - Interactive */}
                        <div className="relative flex items-end gap-0.5" style={{ height: '80px' }}>
                          {(() => {
                            const history = leetcodeStats.contestHistory;
                            const ratings = history.map((h: any) => h.rating);
                            const minR = Math.floor(Math.min(...ratings) / 100) * 100;
                            const maxR = Math.ceil(Math.max(...ratings) / 100) * 100;
                            const bucketSize = Math.max(50, Math.round((maxR - minR) / 20));
                            const bucketRanges: { from: number; to: number; count: number }[] = [];
                            for (let b = minR; b <= maxR; b += bucketSize) {
                              bucketRanges.push({
                                from: b,
                                to: b + bucketSize,
                                count: ratings.filter((r: number) => r >= b && r < b + bucketSize).length
                              });
                            }
                            const maxCount = Math.max(...bucketRanges.map(b => b.count), 1);
                            const currentBucket = Math.floor((ratings[ratings.length - 1] - minR) / bucketSize);
                            return bucketRanges.map((bucket, i) => (
                              <div
                                key={i}
                                className="flex-1 relative group cursor-pointer"
                                style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
                              >
                                <div
                                  className="w-full rounded-t-sm transition-all group-hover:opacity-80"
                                  style={{
                                    height: `${Math.max(3, (bucket.count / maxCount) * 100)}%`,
                                    backgroundColor: i === currentBucket ? '#f59e0b' : '#d1d5db',
                                  }}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                                  <div className="bg-gray-800 text-white rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
                                    <p className="font-semibold">{bucket.from.toLocaleString()} – {bucket.to.toLocaleString()}</p>
                                    <p className="text-gray-300">{bucket.count} contest{bucket.count !== 1 ? 's' : ''}</p>
                                  </div>
                                  <div className="w-2 h-2 bg-gray-800 rotate-45 mx-auto -mt-1"></div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Row 3: Stats Grid */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                        <Flame size={18} className="text-orange-500 mx-auto mb-1.5" />
                        <p className="text-xl font-black text-gray-900">{leetcodeStats.currentStreak ?? leetcodeStats.streak ?? 0}</p>
                        <p className="text-xs text-gray-400">Streak</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                        <Flame size={18} className="text-red-500 mx-auto mb-1.5" />
                        <p className="text-xl font-black text-gray-900">{leetcodeStats.maxStreak || 0}</p>
                        <p className="text-xs text-gray-400">Max Streak</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                        <Calendar size={18} className="text-indigo-500 mx-auto mb-1.5" />
                        <p className="text-xl font-black text-gray-900">{leetcodeStats.totalActiveDays || 0}</p>
                        <p className="text-xs text-gray-400">Active Days</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                        <CheckCircle size={18} className="text-green-500 mx-auto mb-1.5" />
                        <p className="text-xl font-black text-gray-900">{leetcodeStats.acceptanceRate || 0}%</p>
                        <p className="text-xs text-gray-400">Acceptance</p>
                      </div>
                    </div>

                    {/* Row 4: Recent Submissions */}
                    {leetcodeStats.recentSubmissions && leetcodeStats.recentSubmissions.length > 0 && (
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Submissions</h4>
                        <div className="space-y-1.5">
                          {leetcodeStats.recentSubmissions.map((sub: any, i: number) => (
                            <a key={i} href={`https://leetcode.com/problems/${sub.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${(sub.status || sub.statusDisplay) === 'Accepted' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                  {(sub.status || sub.statusDisplay) === 'Accepted' ? '✓' : '✗'}
                                </span>
                                <span className="text-sm text-gray-700 truncate group-hover:text-gray-900">{sub.title}</span>
                              </div>
                              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded font-mono">{sub.lang}</span>
                                {sub.timestamp && <span className="text-xs text-gray-300">{new Date(sub.timestamp * 1000).toLocaleDateString()}</span>}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Badges */}
                    {leetcodeStats.badges && leetcodeStats.badges.length > 1 && (
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">All Badges</h4>
                        <div className="flex flex-wrap gap-2">
                          {leetcodeStats.badges.map((badge: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-full px-3 py-1.5">
                              {badge.icon && <img src={badge.icon} alt="" className="w-5 h-5" crossOrigin="anonymous" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />}
                              <span className="text-xs font-semibold text-amber-800">{badge.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cache Info */}
                    {leetcodeStats.fromCache && (
                      <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                        <Clock size={10} /> Cached data • <button onClick={() => fetchLeetCodeStats(currentUser?.leetcodeUsername || savedLeetcodeUsername.current || formData.leetcodeUsername || '', true)} className="underline hover:text-gray-600">Refresh</button>
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
          <>
          {/* Compact Header - Profile pic left, name/role right */}
          <div 
            className="relative overflow-hidden rounded-t-2xl"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            }}
          >
            <div className="absolute inset-0 opacity-20" style={{ background: roleConfig.pattern }}></div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all flex items-center justify-center z-50"
              type="button"
            >
              <X size={18} />
            </button>

            <div className="relative z-10 flex items-center gap-4 px-6 py-5">
              <div className="relative group flex-shrink-0">
                <div className="relative w-16 h-16 rounded-full border-3 border-white shadow-xl overflow-hidden bg-white">
                  {profilePictureUrl ? (
                    <img 
                      src={profilePictureUrl} 
                      alt={currentUser?.fullName || 'Profile'}
                      className="w-full h-full object-cover"
                      key={profilePictureUrl}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br ${roleConfig.gradient}`}>
                      <span className="drop-shadow-lg">{roleConfig.icon}</span>
                    </div>
                  )}
                  
                  {isEditing && (
                    <div className="absolute inset-0 bg-black/50 hover:bg-black/70 transition-all flex items-center justify-center gap-1">
                      <label 
                        htmlFor="profile-picture-upload"
                        className="cursor-pointer p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-all"
                        title="Upload from computer"
                      >
                        {isUploading ? (
                          <Clock size={12} className="text-white animate-spin" />
                        ) : (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        )}
                      </label>
                      
                      <button
                        type="button"
                        onClick={() => startCamera('profile')}
                        className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-all"
                        title="Take photo with camera"
                        disabled={isUploading}
                      >
                        <Camera size={12} className="text-white" />
                      </button>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  id="profile-picture-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePictureUpload}
                  disabled={isUploading || !isEditing}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white truncate">
                  {formData.fullName || currentUser?.fullName || 'User'}
                </h2>
                <div className="flex items-center space-x-1.5 text-white/90 text-sm mt-0.5">
                  <span className="text-base">{roleConfig.icon}</span>
                  <span className="font-semibold">{roleConfig.label}</span>
                </div>
                {currentUser?.userType !== 'student' && formData.title && (
                  <p className="text-white/70 text-xs mt-0.5 truncate">{formData.title}</p>
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm flex items-start">
                <X className="mr-2 flex-shrink-0 mt-0.5" size={16} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded text-green-700 text-sm flex items-start">
                <CheckCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Contact Information */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Contact Information
              </h3>
              <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
                <div className="space-y-4">
                  {/* Full Name */}
                  {isEditing && (
                    <div className="flex items-start space-x-3">
                      <User size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-semibold mb-2">Full Name</p>
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                          placeholder="Enter full name"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Email */}
                  <div className={`flex items-start space-x-3 ${isEditing ? 'pt-4 border-t border-gray-100' : ''}`}>
                    <Mail size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {isEditing && currentUser?.userType === 'student' ? (
                        <>
                          <p className="text-xs text-gray-500 font-semibold mb-2">Email</p>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                            placeholder="Email address"
                          />
                        </>
                      ) : (
                        <p className="text-sm text-gray-900 break-all">{currentUser?.email || '—'}</p>
                      )}
                      {currentUser?.userType !== 'student' && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center">
                          <Shield size={12} className="mr-1" />
                          Email cannot be changed
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start space-x-3 pt-4 border-t border-gray-100">
                    <Phone size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {isEditing ? (
                        <>
                          <p className="text-xs text-gray-500 font-semibold mb-2">Phone</p>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                            placeholder="Phone number"
                          />
                        </>
                      ) : (
                        <p className="text-sm text-gray-900">{formData.phone || '—'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Proctoring Photos Section - For Students Only */}
            {currentUser?.userType === 'student' && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Proctoring Photos
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
                  <div className="flex items-start space-x-2 text-blue-700">
                    <Shield size={16} className="flex-shrink-0 mt-0.5" />
                    <p className="text-xs">
                      Upload your photos from three angles (Front, Left, Right) for exam proctoring verification.
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    {/* Front Photo */}
                    <div className="border border-dashed border-gray-200 rounded-xl p-3 bg-white hover:border-blue-300 transition-colors">
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Front</p>
                        <div className="relative w-full aspect-square mb-2 rounded-lg overflow-hidden bg-gray-100">
                          {proctoringPhotos.front ? (
                            <img 
                              key={proctoringPhotos.front}
                              src={proctoringPhotos.front} 
                              alt="Front view"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Hide broken image and show placeholder instead
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling;
                                if (placeholder) placeholder.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center text-gray-400 ${proctoringPhotos.front ? 'hidden' : ''}`}>
                            <User size={40} strokeWidth={1.5} />
                          </div>
                        </div>
                        
                        {isEditing && (
                          <div className="flex items-center justify-center gap-2">
                            <label 
                              htmlFor="front-photo-upload"
                              className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center border ${
                                uploadingPhoto !== null || capturingPhoto !== null
                                  ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer'
                              }`}
                              title="Upload from computer"
                            >
                              {uploadingPhoto === 'front' ? (
                                <Clock size={20} className="text-blue-600 animate-spin" />
                              ) : (
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                              )}
                            </label>
                            
                            <button
                              type="button"
                              onClick={() => startCamera('front')}
                              className="flex-1 p-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all flex items-center justify-center border border-purple-200 disabled:bg-gray-100 disabled:border-gray-200 disabled:cursor-not-allowed"
                              title="Take photo with camera"
                              disabled={uploadingPhoto !== null || capturingPhoto !== null}
                            >
                              {capturingPhoto === 'front' ? (
                                <Clock size={20} className="text-purple-600 animate-spin" />
                              ) : (
                                <Camera size={20} className={uploadingPhoto !== null || capturingPhoto !== null ? 'text-gray-400' : 'text-purple-600'} />
                              )}
                            </button>
                          </div>
                        )}
                        
                        <input
                          ref={frontInputRef}
                          id="front-photo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleProctoringPhotoUpload(e, 'front')}
                          disabled={uploadingPhoto !== null || capturingPhoto !== null}
                        />
                      </div>
                    </div>

                    {/* Left Photo */}
                    <div className="border border-dashed border-gray-200 rounded-xl p-3 bg-white hover:border-blue-300 transition-colors">
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Left</p>
                        <div className="relative w-full aspect-square mb-2 rounded-lg overflow-hidden bg-gray-100">
                          {proctoringPhotos.left ? (
                            <img 
                              key={proctoringPhotos.left}
                              src={proctoringPhotos.left} 
                              alt="Left view"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Hide broken image and show placeholder instead
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling;
                                if (placeholder) placeholder.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center text-gray-400 ${proctoringPhotos.left ? 'hidden' : ''}`}>
                            <User size={40} strokeWidth={1.5} />
                          </div>
                        </div>
                        
                        {isEditing && (
                          <div className="flex items-center justify-center gap-2">
                            <label 
                              htmlFor="left-photo-upload"
                              className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center border ${
                                uploadingPhoto !== null || capturingPhoto !== null
                                  ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer'
                              }`}
                              title="Upload from computer"
                            >
                              {uploadingPhoto === 'left' ? (
                                <Clock size={20} className="text-blue-600 animate-spin" />
                              ) : (
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                              )}
                            </label>
                            
                            <button
                              type="button"
                              onClick={() => startCamera('left')}
                              className="flex-1 p-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all flex items-center justify-center border border-purple-200 disabled:bg-gray-100 disabled:border-gray-200 disabled:cursor-not-allowed"
                              title="Take photo with camera"
                              disabled={uploadingPhoto !== null || capturingPhoto !== null}
                            >
                              {capturingPhoto === 'left' ? (
                                <Clock size={20} className="text-purple-600 animate-spin" />
                              ) : (
                                <Camera size={20} className={uploadingPhoto !== null || capturingPhoto !== null ? 'text-gray-400' : 'text-purple-600'} />
                              )}
                            </button>
                          </div>
                        )}
                        
                        <input
                          ref={leftInputRef}
                          id="left-photo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleProctoringPhotoUpload(e, 'left')}
                          disabled={uploadingPhoto !== null || capturingPhoto !== null}
                        />
                      </div>
                    </div>

                    {/* Right Photo */}
                    <div className="border border-dashed border-gray-200 rounded-xl p-3 bg-white hover:border-blue-300 transition-colors">
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Right</p>
                        <div className="relative w-full aspect-square mb-2 rounded-lg overflow-hidden bg-gray-100">
                          {proctoringPhotos.right ? (
                            <img 
                              key={proctoringPhotos.right}
                              src={proctoringPhotos.right} 
                              alt="Right view"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Hide broken image and show placeholder instead
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling;
                                if (placeholder) placeholder.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center text-gray-400 ${proctoringPhotos.right ? 'hidden' : ''}`}>
                            <User size={40} strokeWidth={1.5} />
                          </div>
                        </div>
                        
                        {isEditing && (
                          <div className="flex items-center justify-center gap-2">
                            <label 
                              htmlFor="right-photo-upload"
                              className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center border ${
                                uploadingPhoto !== null || capturingPhoto !== null
                                  ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer'
                              }`}
                              title="Upload from computer"
                            >
                              {uploadingPhoto === 'right' ? (
                                <Clock size={20} className="text-blue-600 animate-spin" />
                              ) : (
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                              )}
                            </label>
                            
                            <button
                              type="button"
                              onClick={() => startCamera('right')}
                              className="flex-1 p-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all flex items-center justify-center border border-purple-200 disabled:bg-gray-100 disabled:border-gray-200 disabled:cursor-not-allowed"
                              title="Take photo with camera"
                              disabled={uploadingPhoto !== null || capturingPhoto !== null}
                            >
                              {capturingPhoto === 'right' ? (
                                <Clock size={20} className="text-purple-600 animate-spin" />
                              ) : (
                                <Camera size={20} className={uploadingPhoto !== null || capturingPhoto !== null ? 'text-gray-400' : 'text-purple-600'} />
                              )}
                            </button>
                          </div>
                        )}
                        
                        <input
                          ref={rightInputRef}
                          id="right-photo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleProctoringPhotoUpload(e, 'right')}
                          disabled={uploadingPhoto !== null || capturingPhoto !== null}
                        />
                      </div>
                    </div>
                  </div>
              </div>
            )}

            {/* Academic Details (Students) */}
            {currentUser?.userType === 'student' && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Academic Details
                </h3>
                <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <GraduationCap size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-semibold mb-0.5">Class</p>
                        <p className="text-sm text-gray-900">{currentUser?.studentClass || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 pt-4 border-t border-gray-100">
                      <Award size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-semibold mb-0.5">Roll Number</p>
                        <p className="text-sm text-gray-900">{currentUser?.studentRoll || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 pt-4 border-t border-gray-100">
                      <Building2 size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-semibold mb-0.5">Board</p>
                        <p className="text-sm text-gray-900">{currentUser?.board || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 pt-4 border-t border-gray-100">
                      <Calendar size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-semibold mb-0.5">Academic Year</p>
                        <p className="text-sm text-gray-900">{currentUser?.academicYear || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Coding Profiles (Students) */}
            {currentUser?.userType === 'student' && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Coding Profiles
                </h3>
                {isEditing ? (
                  <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Code2 size={16} className="text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">LeetCode Username</p>
                    </div>
                    <input
                      type="text"
                      value={formData.leetcodeUsername || ''}
                      onChange={(e) => setFormData({...formData, leetcodeUsername: e.target.value})}
                      placeholder="e.g. neal_wu"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>
                ) : (currentUser.leetcodeUsername || savedLeetcodeUsername.current || formData.leetcodeUsername) ? (
                  <button
                    onClick={() => fetchLeetCodeStats(currentUser.leetcodeUsername || savedLeetcodeUsername.current || formData.leetcodeUsername || '')}
                    className="w-full group"
                  >
                    <div className="relative overflow-hidden rounded-xl border border-dashed border-gray-200 bg-white p-4 transition-all hover:shadow-lg hover:scale-[1.01]">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                          <Code2 size={20} className="text-amber-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">LeetCode</span>
                            <span className="text-xs text-amber-600 font-medium">@{currentUser.leetcodeUsername || savedLeetcodeUsername.current || formData.leetcodeUsername}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">Tap to view full profile & stats</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white text-center">
                    <Code2 size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No coding profiles linked</p>
                    <p className="text-xs text-gray-300 mt-1">Edit profile to add your LeetCode username</p>
                  </div>
                )}
              </div>
            )}

            {/* Teaching Information (Teachers) */}
            {currentUser?.userType === 'teacher' && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Teaching Information
                </h3>
                <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
                  <div className="space-y-4">
                    {/* Classes */}
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Users size={18} className="text-gray-400" />
                        <p className="text-xs text-gray-500 font-semibold">Assigned Classes</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentUser?.teacherClasses && currentUser.teacherClasses.length > 0 ? (
                          currentUser.teacherClasses.map((cls: string, index: number) => (
                            <span 
                              key={index}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
                            >
                              {cls}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic">No classes assigned</p>
                        )}
                      </div>
                    </div>

                    {/* Subjects */}
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-2 mb-2">
                        <BookOpen size={18} className="text-gray-400" />
                        <p className="text-xs text-gray-500 font-semibold">Teaching Subjects</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentUser?.teacherSubjects && currentUser.teacherSubjects.length > 0 ? (
                          currentUser.teacherSubjects.map((subject: string, index: number) => (
                            <span 
                              key={index}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm"
                            >
                              {subject}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400 italic">No subjects assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Title/Designation (for non-students in edit mode) */}
            {currentUser?.userType !== 'student' && isEditing && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Professional Information
                </h3>
                <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start space-x-3">
                    <User size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-semibold mb-2">Title / Designation</p>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                        placeholder="e.g., Senior Professor, Head of Department"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Account Status */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Account Status
              </h3>
              <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <span className="inline-flex items-center space-x-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-semibold text-sm">
                        <CheckCircle size={16} />
                        <span>Active</span>
                      </span>
                    </div>
                  </div>

                  {/* User ID */}
                  <div className="flex items-start space-x-3 pt-4 border-t border-gray-100">
                    <Shield size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-semibold mb-1">User ID</p>
                      <p className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1.5 rounded border border-gray-200 break-all">
                        {currentUser?.userId || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="flex items-start space-x-3 pt-4 border-t border-gray-100">
                    <Clock size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-semibold mb-0.5">Last Updated</p>
                      <p className="text-sm text-gray-900">
                        {formatFirebaseDate(currentUser?.updatedAt || currentUser?.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Institution (for admin/principal/dean) */}
            {(currentUser?.userType === 'admin' || currentUser?.userType === 'principal' || 
              currentUser?.userType === 'dean' || currentUser?.userType === 'system_admin') && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Institution
                </h3>
                <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start space-x-3">
                    <Building2 size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 font-medium">
                        {currentUser?.collegeName || brandTheme.collegeName || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit/Save Buttons */}
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              >
                <Edit2 size={18} />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex space-x-3">
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
                      teacherSubjects: currentUser?.teacherSubjects || [],
                      leetcodeUsername: currentUser?.leetcodeUsername || ''
                    });
                    setError(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-xl text-white font-semibold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                >
                  {isSaving ? (
                    <>
                      <Clock size={18} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            )}
            </div>
          </>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black/80 z-[10002] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Camera className="text-white" size={24} />
                <h3 className="text-white font-bold text-lg">
                  {cameraPosition === 'profile' ? 'Take Profile Picture' : `Take ${cameraPosition?.charAt(0).toUpperCase()}${cameraPosition?.slice(1)} Photo`}
                </h3>
              </div>
              <button
                onClick={stopCamera}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {cameraError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <div className="text-red-500 mb-4">
                    <Camera size={48} className="mx-auto opacity-50" />
                  </div>
                  <p className="text-red-700 font-semibold mb-2">Camera Access Error</p>
                  <p className="text-red-600 text-sm">{cameraError}</p>
                </div>
              ) : (
                <>
                  <div className="relative bg-black rounded-xl overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    {cameraPosition && (
                      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm">
                        {cameraPosition === 'profile' ? 'Profile' : `${cameraPosition.charAt(0).toUpperCase()}${cameraPosition.slice(1)} View`}
                      </div>
                    )}
                  </div>

                  <canvas ref={canvasRef} className="hidden" />

                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={stopCamera}
                      className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg flex items-center space-x-2"
                    >
                      <Camera size={20} />
                      <span>Capture Photo</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}