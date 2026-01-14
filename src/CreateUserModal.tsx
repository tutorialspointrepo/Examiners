import { X, User, Upload, UserPlus, Users, Save, CheckCircle, Mail, Phone, Building2, GraduationCap, ChevronDown, FileText } from 'lucide-react';

import { useState, useEffect, useRef } from 'react';
import BulkUploadUsers from './BulkUploadUsers';
import { useBrand } from './BrandContext';
import { firebaseService } from './services/firebase_service';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollegeId: string;
  onUserAdded: () => void;
  editUser?: any; // User to edit (optional)
  currentUserRole?: string; // Current logged-in user's role
}

interface UserFormData {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  userType: 'student' | 'teacher' | 'principal' | 'dean' | 'admin';
  studentRoll: string;
  academicYear: string;
  studentClass: string;
  teacherClasses: string[];
  teacherSubjects: string[];
  board: string;
}

interface CollegeData {
  boards: string[];
  classes: string[];
  subjects: string[];
  academicYears: string[];
}

const userRoles = [
  { 
    value: 'student', 
    label: 'Student', 
    icon: '🎓', 
    gradient: 'from-blue-500 to-indigo-500',
    description: 'Regular student account'
  },
  { 
    value: 'teacher', 
    label: 'Teacher', 
    icon: '👨‍🏫', 
    gradient: 'from-green-500 to-teal-500',
    description: 'Faculty member'
  },
  { 
    value: 'principal', 
    label: 'Principal', 
    icon: '🏆', 
    gradient: 'from-purple-500 to-pink-500',
    description: 'School principal'
  },
  { 
    value: 'dean', 
    label: 'Dean', 
    icon: '👔', 
    gradient: 'from-orange-500 to-red-500',
    description: 'Academic dean'
  },
  { 
    value: 'admin', 
    label: 'Admin', 
    icon: '⚙️', 
    gradient: 'from-gray-600 to-gray-800',
    description: 'System administrator'
  }
];

export default function CreateUserModal({
  isOpen,
  onClose,
  activeCollegeId,
  onUserAdded,
  editUser,
}: CreateUserModalProps) {
  const brandTheme = useBrand();
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [view, setView] = useState<'choice' | 'manual' | 'success'>('choice');
  const [collegeData, setCollegeData] = useState<CollegeData>({
    boards: [],
    classes: [],
    subjects: [],
    academicYears: []
  });
  const [isLoadingCollegeData, setIsLoadingCollegeData] = useState(false);
  
  const [formData, setFormData] = useState<UserFormData>({
    fullName: '',
    title: '',
    email: '',
    phone: '',
    userType: 'student',
    studentRoll: '',
    academicYear: '',
    studentClass: '',
    teacherClasses: [],
    teacherSubjects: [],
    board: ''
  });

const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Ref for scrollable container to scroll to top on error
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when error is set
  useEffect(() => {
    if (error && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [error]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  // Reset view to 'choice' when modal opens
  useEffect(() => {
    if (isOpen) {
      // If editing user, go directly to manual view with pre-filled data
      if (editUser) {
        setView('manual');
        setFormData({
          fullName: editUser.fullName || '',
          title: editUser.title || '',
          email: editUser.email || '',
          phone: editUser.phone || '',
          userType: editUser.userType || 'student',
          studentRoll: editUser.studentRoll || '',
          academicYear: editUser.academicYear || '',
          studentClass: editUser.studentClass || '',
          teacherClasses: editUser.teacherClasses || [],
          teacherSubjects: editUser.teacherSubjects || [],
          board: editUser.board || ''
        });
      } else {
        setView('choice');
      }
      setError(null);
      setIsSubmitting(false);
    } else {
      setView('choice');
      setFormData({
        fullName: '',
        title: '',
        email: '',
        phone: '',
        userType: 'student',
        studentRoll: '',
        academicYear: '',
        studentClass: '',
        teacherClasses: [],
        teacherSubjects: [],
        board: ''
      });
    }
  }, [isOpen, editUser]);

  // Load college data when modal opens or when switching to manual view
  useEffect(() => {
    if (isOpen && activeCollegeId && (view === 'manual' || view === 'choice')) {
      loadCollegeData();
    }
  }, [isOpen, activeCollegeId, view]);

  const loadCollegeData = async () => {
    setIsLoadingCollegeData(true);
    setError(null);
    try {
      console.log('Loading college data for:', activeCollegeId);
      const college = await firebaseService.getCollegeById(activeCollegeId);
      console.log('College data received:', college);
      
      if (!college) {
        throw new Error('College not found');
      }
      
      // Get data from college or use fallback
      const boards = (college.supportedBoards && college.supportedBoards.length > 0)
        ? college.supportedBoards
        : ['CBSE', 'ICSE', 'State Board'];
      
      const classes = (college.validClasses && college.validClasses.length > 0)
        ? college.validClasses
        : ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
      
      const subjects = (college.subjects && college.subjects.length > 0)
        ? college.subjects
        : ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Physics', 'Chemistry', 'Biology'];
      
      const academicYears = ['2024-25', '2025-26', '2026-27', '2027-28', '2028-29', '2029-30'];
      
      console.log('Setting college data:', { boards, classes, subjects, academicYears });
      setCollegeData({ boards, classes, subjects, academicYears });
      
      // Set initial form values when switching to manual view
      if (view === 'manual') {
        setFormData(prev => ({
          ...prev,
          board: boards[0] || '',
          studentClass: classes[0] || '',
          academicYear: academicYears[0] || ''
        }));
      }
    } catch (error) {
      console.error('Error loading college data:', error);
      setError('Failed to load college data. Using default values.');
      
      // Set fallback values even on error
      const fallbackData = {
        boards: ['CBSE', 'ICSE', 'State Board'],
        classes: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'],
        subjects: ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Physics', 'Chemistry', 'Biology'],
        academicYears: ['2025-26', '2026-27', '2027-28', '2028-29', '2029-30']
      };
      setCollegeData(fallbackData);
      
      if (view === 'manual') {
        setFormData(prev => ({
          ...prev,
          board: fallbackData.boards[0],
          studentClass: fallbackData.classes[0],
          academicYear: fallbackData.academicYears[0]
        }));
      }
    } finally {
      setIsLoadingCollegeData(false);
    }
  };

  const handleInputChange = (field: keyof UserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleMultiSelectChange = (field: 'teacherClasses' | 'teacherSubjects', value: string) => {
    setFormData(prev => {
      const currentValues = prev[field];
      const isSelected = currentValues.includes(value);
      
      return {
        ...prev,
        [field]: isSelected
          ? currentValues.filter(v => v !== value)
          : [...currentValues, value]
      };
    });
    if (error) setError(null);
  };

  const handleSingleUserClick = () => {
    setView('manual');
  };

  const handleBulkUploadClick = () => {
    setShowBulkUploadModal(true);
  };

  const handleBulkUploadClose = () => {
    setShowBulkUploadModal(false);
  };

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      setError('Please enter user\'s full name');
      return false;
    }
    
    if (!formData.email.trim()) {
      setError('Please enter email address');
      return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    // Role-specific validation
    if (formData.userType === 'student') {
      if (!formData.studentClass) {
        setError('Please select a class for the student');
        return false;
      }
      if (!formData.studentRoll.trim()) {
        setError('Please enter roll number for the student');
        return false;
      }
      if (!formData.academicYear) {
        setError('Please select academic year for the student');
        return false;
      }
      if (!formData.board) {
        setError('Please select board for the student');
        return false;
      }
    }
    
    if (formData.userType === 'teacher' || formData.userType === 'principal' || formData.userType === 'dean') {
      if (formData.teacherClasses.length === 0) {
        setError(`Please select classes taught by ${formData.userType}`);
        return false;
      }
      if (formData.teacherSubjects.length === 0) {
        setError(`Please select subjects taught by ${formData.userType}`);
        return false;
      }
      if (!formData.board) {
        setError(`Please select board for the ${formData.userType}`);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const currentUser = await firebaseService.getCurrentUserProfile();
      if (!currentUser) {
        throw new Error('You must be logged in to create users');
      }

      // If editing, use update instead of create
      if (editUser) {
        // Prepare update data
        const updateData: any = {
          fullName: formData.fullName.trim(),
          title: formData.title.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          userType: formData.userType,
          board: formData.board || 'Not Specified'
        };

        // Add student-specific fields
        if (formData.userType === 'student') {
          updateData.studentRoll = formData.studentRoll.trim();
          updateData.academicYear = formData.academicYear;
          updateData.studentClass = formData.studentClass;
        }

        // Add teacher/principal/dean-specific fields
        if (formData.userType === 'teacher' || formData.userType === 'principal' || formData.userType === 'dean') {
          updateData.teacherClasses = formData.teacherClasses;
          updateData.teacherSubjects = formData.teacherSubjects;
        }

        console.log('Updating user data:', updateData);

        await firebaseService.updateUserProfile(editUser.userId, updateData, currentUser);

        // Show success view
        setView('success');

        // Reset form after 2 seconds and close modal
        setTimeout(() => {
          setFormData({
            fullName: '',
            title: '',
            email: '',
            phone: '',
            userType: 'student',
            studentRoll: '',
            academicYear: '',
            studentClass: '',
            teacherClasses: [],
            teacherSubjects: [],
            board: ''
          });
          onUserAdded();
          onClose();
        }, 2000);

      } else {
        // Create new user
        const userData: any = {
          full_name: formData.fullName.trim(),
          title: formData.title.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          user_type: formData.userType,
          college_id: activeCollegeId,
          board: formData.board || 'Not Specified',
          created_by: currentUser.userId
        };

        // Add student-specific fields
        if (formData.userType === 'student') {
          userData.student_roll = formData.studentRoll.trim();
          userData.academic_year = formData.academicYear;
          userData.student_class = formData.studentClass;
        }

        // Add teacher/principal/dean-specific fields (keep as arrays)
        if (formData.userType === 'teacher' || formData.userType === 'principal' || formData.userType === 'dean') {
          userData.teacher_classes = formData.teacherClasses; // Keep as array
          userData.teacher_subjects = formData.teacherSubjects; // Keep as array
        }

        console.log('Submitting user data:', userData);

        await firebaseService.createUser(userData);

        // Show success view
        setView('success');

        // Reset form after 2 seconds and close modal
        setTimeout(() => {
          setFormData({
            fullName: '',
            title: '',
            email: '',
            phone: '',
            userType: 'student',
            studentRoll: '',
            academicYear: '',
            studentClass: '',
            teacherClasses: [],
            teacherSubjects: [],
            board: ''
          });
          onUserAdded();
          onClose();
        }, 2000);
      }

    } catch (error: any) {
      console.error('Error creating/updating user:', error);
      
      // Create user-friendly error messages
      let errorMessage = error.message || 'Failed to create user';
      
      // Make duplicate errors more friendly
      if (errorMessage.includes('phone number already exists')) {
        errorMessage = '📱 This phone number is already registered. Please use a different phone number or update the existing user.';
      } else if (errorMessage.includes('email address already exists')) {
        errorMessage = '📧 This email address is already registered. Please use a different email or update the existing user.';
      } else if (errorMessage.includes('already exists')) {
        errorMessage = '⚠️ A user with these details already exists. Please check the phone number and email address.';
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden ${view === 'manual' ? 'max-w-4xl max-h-[90vh] flex flex-col' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between flex-shrink-0"
          style={{ background: brandTheme.gradients.header }}>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <UserPlus size={26} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {view === 'choice' ? 'Create User' : view === 'manual' ? (editUser ? 'Edit User Details' : 'Add User Details') : 'Success!'}
              </h2>
              <p className="text-sm text-white text-opacity-90">
                {view === 'choice' ? 'Choose how you want to add users' : view === 'manual' ? (editUser ? 'Update the user information' : 'Fill in the user information') : 'User ' + (editUser ? 'updated' : 'created') + ' successfully'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Choice View */}
        {view === 'choice' && (
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bulk Upload Option */}
              <button
                onClick={handleBulkUploadClick}
                className="group relative hover:opacity-90 border-2 rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{ 
                  background: `linear-gradient(135deg, ${brandTheme.colors.primary}10 0%, ${brandTheme.colors.secondary}10 100%)`,
                  borderColor: brandTheme.colors.primary + '40'
                }}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                    style={{ background: brandTheme.gradients.primary }}>
                    <Upload size={32} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Bulk Upload</h3>
                    <p className="text-sm text-gray-600">
                      Upload multiple users at once using Excel file
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-2">
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ 
                        backgroundColor: brandTheme.colors.primary + '20',
                        color: brandTheme.colors.primary
                      }}>
                      📊 Excel
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ 
                        backgroundColor: brandTheme.colors.secondary + '20',
                        color: brandTheme.colors.secondary
                      }}>
                      Multiple Users
                    </span>
                  </div>
                </div>
                <div className="absolute inset-0 border-2 border-transparent rounded-xl transition-all duration-300"
                  style={{ borderColor: 'transparent' }}></div>
              </button>

              {/* Single User Creation Option */}
              <button
                onClick={handleSingleUserClick}
                className="group relative hover:opacity-90 border-2 rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{ 
                  background: `linear-gradient(135deg, ${brandTheme.colors.primary}10 0%, ${brandTheme.colors.secondary}10 100%)`,
                  borderColor: brandTheme.colors.primary + '40'
                }}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                    style={{ background: brandTheme.gradients.primary }}>
                    <User size={32} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Create Single User</h3>
                    <p className="text-sm text-gray-600">
                      Add one user at a time with detailed information
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-2">
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ 
                        backgroundColor: brandTheme.colors.primary + '20',
                        color: brandTheme.colors.primary
                      }}>
                      Student
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ 
                        backgroundColor: brandTheme.colors.secondary + '20',
                        color: brandTheme.colors.secondary
                      }}>
                      Teacher
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ 
                        backgroundColor: brandTheme.colors.accent + '20',
                        color: brandTheme.colors.accent
                      }}>
                      Admin
                    </span>
                  </div>
                </div>
                <div className="absolute inset-0 border-2 border-transparent rounded-xl transition-all duration-300"></div>
              </button>
            </div>

            {/* Info Section */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start space-x-3">
                <Users size={20} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">User Types Available</h4>
                  <p className="text-xs text-gray-600">
                    You can create Students, Teachers, Principals, Deans, and Admins. Each user type has specific permissions and access levels within the system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual View - Form */}
        {view === 'manual' && (
          <>
            <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
              <div className="p-8 space-y-6">
                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <X size={12} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-red-800 font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Basic Information */}
                <div className="border-2 rounded-xl p-4"
                  style={{ 
                    background: brandTheme.gradients.card,
                    borderColor: brandTheme.colors.secondary + '33'
                  }}>
                  <div className="flex items-center space-x-2.5 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: brandTheme.colors.secondary + '20' }}>
                      <FileText size={20} style={{ color: brandTheme.colors.secondary }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Basic Information</h3>
                      <p className="text-xs" style={{ color: brandTheme.colors.secondary, opacity: 0.9 }}>Fill in the user details</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                  {/* Full Name - Single Row */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="userFullNameField"
                        value={formData.fullName}
                        onChange={(e) => handleInputChange('fullName', e.target.value)}
                        placeholder="Enter full name (e.g., Mr John Doe)"
                        autoComplete="off"
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                      />
                    </div>
                  </div>

                  {/* Title - Single Row */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Title / Designation <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="userTitleField"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="e.g., Senior Teacher, Head of Department"
                        autoComplete="off"
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                      />
                    </div>
                  </div>

                  {/* Email Address - Single Row */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                      {editUser && <span className="text-xs text-gray-500 ml-2">(Cannot be changed)</span>}
                    </label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="userEmailIdentifier_x9z4"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="user@example.com"
                        autoComplete="off"
                        disabled={!!editUser}
                        className={`w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium ${editUser ? 'bg-gray-100 cursor-not-allowed text-gray-600' : 'hover:border-gray-400 bg-white'}`}
                      />
                    </div>
                    {editUser && (
                      <p className="mt-1 text-xs text-gray-500">
                        Email cannot be changed after user creation for security reasons
                      </p>
                    )}
                  </div>

                  {/* Phone Number - Single Row */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                      Phone Number <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        name="userPhoneContactField"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="9876543210"
                        autoComplete="off"
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                      />
                    </div>
                  </div>

                  {/* Password Info Note - Only show in create mode */}
                  {!editUser && (
                    <div className="border rounded-lg p-3 flex items-start space-x-2"
                      style={{ 
                        backgroundColor: brandTheme.colors.primary + '10',
                        borderColor: brandTheme.colors.primary + '33'
                      }}>
                      <Mail size={16} className="mt-0.5 flex-shrink-0" style={{ color: brandTheme.colors.primary }} />
                      <p className="text-xs" style={{ color: brandTheme.colors.primary }}>
                        <strong>Note:</strong> A temporary password will be automatically generated and sent to the user's email address.
                      </p>
                    </div>
                  )}
                  </div>
                </div>

                {/* User Role Selection - All in One Row */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                    User Type <span className="text-red-500">*</span>
                    {editUser && <span className="text-xs text-gray-500 ml-2 font-normal">(Cannot be changed)</span>}
                  </h3>
                  <div className="grid grid-cols-5 gap-3">
                    {userRoles.map(role => {
                      const isSelected = formData.userType === role.value;
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => !editUser && handleInputChange('userType', role.value)}
                          disabled={!!editUser}
                          className={`relative p-4 rounded-xl border-2 transition-all ${
                            isSelected 
                              ? 'border-transparent shadow-lg' 
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          } ${editUser ? 'cursor-not-allowed opacity-60' : ''}`}
                          style={isSelected ? {
                            background: brandTheme.gradients.primary
                          } : {}}
                        >
                          <div className={`text-center ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            <div className="text-3xl mb-2">{role.icon}</div>
                            <p className="text-sm font-bold">{role.label}</p>
                            <p className={`text-xs mt-1 ${isSelected ? 'text-white text-opacity-90' : 'text-gray-500'}`}>
                              {role.description}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle size={16} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {editUser && (
                    <p className="text-xs text-gray-500">
                      User role cannot be changed after creation to maintain data integrity and college statistics
                    </p>
                  )}
                </div>

                {/* Student-Specific Fields */}
                {formData.userType === 'student' && (
                  <div className="space-y-4 p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: brandTheme.colors.primary + '10',
                      borderColor: brandTheme.colors.primary + '33'
                    }}>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center">
                      <GraduationCap size={18} className="mr-2" />
                      Student Details <span className="text-red-500 ml-1">*</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-900 mb-1.5">
                          Roll Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.studentRoll}
                          onChange={(e) => handleInputChange('studentRoll', e.target.value)}
                          placeholder="e.g., STU001"
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm font-medium hover:border-gray-400 bg-white"
                        />
                      </div>

                      <div className="dropdown-container">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Academic Year <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === 'academicYear' ? null : 'academicYear')}
                            className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white"
                          >
                            <span className="text-gray-900">{formData.academicYear || 'Select Academic Year'}</span>
                            <ChevronDown size={16} className="text-gray-500" />
                          </button>
                          {openDropdown === 'academicYear' && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                              {collegeData.academicYears.map((year) => (
                                <button
                                  key={year}
                                  onClick={() => {
                                    handleInputChange('academicYear', year);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                >
                                  {year}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="dropdown-container">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Class <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === 'studentClass' ? null : 'studentClass')}
                            className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white"
                          >
                            <span className="text-gray-900">{formData.studentClass || 'Select Class'}</span>
                            <ChevronDown size={16} className="text-gray-500" />
                          </button>
                          {openDropdown === 'studentClass' && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                              {collegeData.classes.map((cls) => (
                                <button
                                  key={cls}
                                  onClick={() => {
                                    handleInputChange('studentClass', cls);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                >
                                  {cls}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="dropdown-container">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Board <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === 'studentBoard' ? null : 'studentBoard')}
                            className="w-full px-3 py-3 border rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm focus:ring-2 focus:border-transparent border-gray-300 hover:border-gray-400 bg-white"
                          >
                            <span className="text-gray-900">{formData.board || 'Select Board'}</span>
                            <ChevronDown size={16} className="text-gray-500" />
                          </button>
                          {openDropdown === 'studentBoard' && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                              {collegeData.boards.map((board) => (
                                <button
                                  key={board}
                                  onClick={() => {
                                    handleInputChange('board', board);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm"
                                >
                                  {board}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Teacher/Principal/Dean-Specific Fields */}
                {(formData.userType === 'teacher' || formData.userType === 'principal' || formData.userType === 'dean') && (
                  <div className="space-y-4 p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: brandTheme.colors.secondary + '10',
                      borderColor: brandTheme.colors.secondary + '33'
                    }}>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center">
                      <Building2 size={18} className="mr-2" />
                      {formData.userType === 'teacher' ? 'Teacher' : 
                       formData.userType === 'principal' ? 'Principal' : 'Dean'} Details 
                      <span className="text-red-500 ml-1">*</span>
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Classes Taught <span className="text-red-500">*</span>
                      </label>
                      <div className="border border-gray-300 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                        {collegeData.classes.length === 0 ? (
                          <p className="text-sm text-gray-500">Loading classes...</p>
                        ) : (
                          <div className="space-y-2">
                            {collegeData.classes.map((cls) => (
                              <label
                                key={cls}
                                className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.teacherClasses.includes(cls)}
                                  onChange={() => handleMultiSelectChange('teacherClasses', cls)}
                                  className="w-4 h-4 border-gray-300 rounded focus:ring-2"
                                  style={{ 
                                    accentColor: brandTheme.colors.primary
                                  }}
                                />
                                <span className="text-sm text-gray-700">{cls}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {formData.teacherClasses.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {formData.teacherClasses.map((cls) => (
                            <span
                              key={cls}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                              style={{ 
                                backgroundColor: brandTheme.colors.primary + '20',
                                color: brandTheme.colors.primary
                              }}
                            >
                              {cls}
                              <button
                                type="button"
                                onClick={() => handleMultiSelectChange('teacherClasses', cls)}
                                className="ml-2 hover:opacity-75"
                                style={{ color: brandTheme.colors.primary }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Selected: {formData.teacherClasses.length} class(es)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subjects Taught <span className="text-red-500">*</span>
                      </label>
                      <div className="border border-gray-300 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                        {collegeData.subjects.length === 0 ? (
                          <p className="text-sm text-gray-500">Loading subjects...</p>
                        ) : (
                          <div className="space-y-2">
                            {collegeData.subjects.map((subject) => (
                              <label
                                key={subject}
                                className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.teacherSubjects.includes(subject)}
                                  onChange={() => handleMultiSelectChange('teacherSubjects', subject)}
                                  className="w-4 h-4 border-gray-300 rounded focus:ring-2"
                                  style={{ 
                                    accentColor: brandTheme.colors.secondary
                                  }}
                                />
                                <span className="text-sm text-gray-700">{subject}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {formData.teacherSubjects.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {formData.teacherSubjects.map((subject) => (
                            <span
                              key={subject}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                              style={{ 
                                backgroundColor: brandTheme.colors.secondary + '20',
                                color: brandTheme.colors.secondary
                              }}
                            >
                              {subject}
                              <button
                                type="button"
                                onClick={() => handleMultiSelectChange('teacherSubjects', subject)}
                                className="ml-2 hover:opacity-75"
                                style={{ color: brandTheme.colors.secondary }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Selected: {formData.teacherSubjects.length} subject(s)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Board <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.board}
                        onChange={(e) => handleInputChange('board', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">Select Board</option>
                        {collegeData.boards.map(board => (
                          <option key={board} value={board}>{board}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <div className="flex space-x-3">
                  {!editUser && (
                    <button
                      onClick={() => setView('choice')}
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isLoadingCollegeData}
                    className="px-6 py-2.5 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center space-x-2"
                    style={{ background: isSubmitting ? brandTheme.colors.primary : brandTheme.gradients.primary }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{editUser ? 'Updating...' : 'Creating...'}</span>
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        <span>{editUser ? 'Update User' : 'Create User'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Success View */}
        {view === 'success' && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"
                style={{ backgroundColor: `${brandTheme.colors.primary}20` }}
              >
                <CheckCircle size={56} style={{ color: brandTheme.colors.primary }} />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-3">{editUser ? 'User Updated!' : 'User Created!'}</h3>
              <p className="text-gray-600 text-lg">Successfully {editUser ? 'updated in' : 'added to'} the system</p>
            </div>
          </div>
        )}
      </div>
      </div>
      )}

      {/* Bulk User Upload Modal */}
      <BulkUploadUsers
        isOpen={showBulkUploadModal}
        onClose={handleBulkUploadClose}
        activeCollegeId={activeCollegeId}
        onUploadComplete={() => {
          handleBulkUploadClose();
          onUserAdded();
          onClose();
        }}
      />
    </>
  );
}