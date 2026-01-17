import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useBrand } from './BrandContext';
import * as XLSX from 'xlsx';
import { firebaseService } from './services/firebase_service';

interface BulkUploadUsersProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollegeId: string;
  onUploadComplete: () => void;
}

interface UserRow {
  full_name: string;
  title?: string;
  email?: string;
  phone: string;
  user_type: string;
  college_id?: string;
  student_roll?: string;
  academic_year?: string;
  student_class?: string;
  teacher_classes?: string;
  teacher_subjects?: string;
  board?: string;
  parent_phone?: string;
  created_by?: string;
}

export default function BulkUploadUsers({
  isOpen,
  onClose,
  activeCollegeId,
  onUploadComplete
}: BulkUploadUsersProps) {
  const brandTheme = useBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadStep, setUploadStep] = useState<'select' | 'preview' | 'uploading' | 'complete'>('select');
  const [parsedUsers, setParsedUsers] = useState<UserRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    skipped: number;
    failed: number;
    details: Array<{
      rowNumber: number;
      fullName: string;
      userType: string;
      status: 'success' | 'skipped' | 'failed';
      reason?: string;
    }>;
  }>({ success: 0, skipped: 0, failed: 0, details: [] });
  const [isDragging, setIsDragging] = useState(false);
  
  // Pagination state for results
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Error/Warning display state
  const [notification, setNotification] = useState<{
    type: 'error' | 'warning' | 'info';
    message: string;
    visible: boolean;
  }>({ type: 'info', message: '', visible: false });

  // Show notification with auto-dismiss after 10 seconds
  const showNotification = (type: 'error' | 'warning' | 'info', message: string) => {
    setNotification({ type, message, visible: true });
  };

  // Auto-dismiss notification after 10 seconds
  useEffect(() => {
    if (notification.visible) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [notification.visible]);

  // Reset notification when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNotification({ type: 'info', message: '', visible: false });
    }
  }, [isOpen]);

  // Download Excel template
  const downloadTemplate = () => {
    // Sample data rows
    const template = [
      {
        full_name: 'Mr John Admin',
        title: 'Senior Admin',
        email: 'john.admin@example.com',
        phone: '9876543210',
        user_type: 'admin',
        college_id: activeCollegeId,
        student_roll: '',
        academic_year: '',
        student_class: '',
        teacher_classes: '',
        teacher_subjects: '',
        board: '',
        parent_phone: '',
        created_by: 'system'
      },
      {
        full_name: 'Dr Sarah Principal',
        title: 'School Principal',
        email: 'sarah.principal@example.com',
        phone: '9876543214',
        user_type: 'principal',
        college_id: activeCollegeId,
        student_roll: '',
        academic_year: '',
        student_class: '',
        teacher_classes: '11th, 12th',
        teacher_subjects: 'Mathematics',
        board: 'CBSE',
        parent_phone: '',
        created_by: 'system'
      },
      {
        full_name: 'Prof Michael Dean',
        title: 'Academic Dean',
        email: 'michael.dean@example.com',
        phone: '9876543215',
        user_type: 'dean',
        college_id: activeCollegeId,
        student_roll: '',
        academic_year: '',
        student_class: '',
        teacher_classes: '10th, 11th',
        teacher_subjects: 'Physics, Chemistry',
        board: 'CBSE',
        parent_phone: '',
        created_by: 'system'
      },
      {
        full_name: 'Ms Jane Teacher',
        title: 'Mathematics Teacher',
        email: 'jane.teacher@example.com',
        phone: '9876543211',
        user_type: 'teacher',
        college_id: activeCollegeId,
        student_roll: '',
        academic_year: '',
        student_class: '',
        teacher_classes: '10th, 11th, 12th',
        teacher_subjects: 'Mathematics, Physics',
        board: 'CBSE',
        parent_phone: '',
        created_by: 'system'
      },
      {
        full_name: 'Master Ram Student',
        title: 'Student',
        email: 'ram.student@example.com',
        phone: '9876543212',
        user_type: 'student',
        college_id: activeCollegeId,
        student_roll: 'STU001',
        academic_year: '2024-25',
        student_class: '10th',
        teacher_classes: '',
        teacher_subjects: '',
        board: 'CBSE',
        parent_phone: '9876543213',
        created_by: 'system'
      }
    ];

    // Create worksheet from template data
    const ws = XLSX.utils.json_to_sheet(template);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 20 }, // full_name
      { wch: 20 }, // title
      { wch: 25 }, // email
      { wch: 15 }, // phone
      { wch: 15 }, // user_type
      { wch: 20 }, // college_id
      { wch: 15 }, // student_roll
      { wch: 15 }, // academic_year
      { wch: 15 }, // student_class
      { wch: 25 }, // teacher_classes
      { wch: 25 }, // teacher_subjects
      { wch: 12 }, // board
      { wch: 15 }, // parent_phone
      { wch: 15 }  // created_by
    ];

    // Create workbook and add worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    
    // Create Reference sheet with allowed values
    const referenceData = [
      ['ALLOWED VALUES FOR DROPDOWNS'],
      [''],
      ['User Types (Select from these):'],
      ['system_admin'],
      ['admin'],
      ['principal'],
      ['dean'],
      ['teacher'],
      ['student'],
      [''],
      ['IMPORTANT VALIDATION RULES:'],
      [''],
      ['Phone Number:'],
      ['- Must be exactly 10 digits'],
      ['- Example: 9876543210'],
      ['- No country code, spaces, or special characters'],
      [''],
      ['Email:'],
      ['- Optional but recommended'],
      ['- Must be unique if provided'],
      [''],
      ['Academic Year Format:'],
      ['- YYYY-YY (e.g., 2024-25, 2025-26)'],
      ['- Required for students only'],
      [''],
      ['DUPLICATE HANDLING:'],
      ['Users with existing phone OR email will be SKIPPED']
    ];

    const wsReference = XLSX.utils.aoa_to_sheet(referenceData);
    wsReference['!cols'] = [{ wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsReference, 'Reference');
    
    // Add instructions sheet
    const instructions = [
      ['INSTRUCTIONS FOR BULK USER UPLOAD'],
      [''],
      ['IMPORTANT: Check the "Reference" sheet for allowed values and validation rules'],
      [''],
      ['Column Descriptions:'],
      ['full_name', 'REQUIRED - User\'s full name (e.g., Mr John Doe, Ms Jane Teacher)'],
      ['title', 'Optional - Designation/Title (e.g., Senior Admin, Mathematics Teacher)'],
      ['email', 'Optional - Email address (must be unique)'],
      ['phone', 'REQUIRED - 10-digit mobile number (e.g., 9876543210)'],
      ['user_type', 'REQUIRED - Copy from Reference sheet: system_admin, admin, principal, dean, teacher, student'],
      ['college_id', 'REQUIRED (except system_admin) - College identifier'],
      ['student_roll', 'REQUIRED for students - Student roll number'],
      ['academic_year', 'REQUIRED for students - Format: YYYY-YY (e.g., 2024-25)'],
      ['student_class', 'REQUIRED for students - Class (e.g., 10th, 11th, 12th)'],
      ['teacher_classes', 'Optional for teachers/principals/deans - Comma-separated classes (e.g., 10th, 11th, 12th)'],
      ['teacher_subjects', 'Optional for teachers/principals/deans - Comma-separated subjects (e.g., Mathematics, Physics)'],
      ['board', 'Optional - Board name (e.g., CBSE, ICSE)'],
      ['parent_phone', 'Optional for students - Parent contact number'],
      ['created_by', 'Optional - Creator identifier (default: system)'],
      [''],
      ['User Type Requirements:'],
      ['system_admin', 'No college_id required - System-wide administrator'],
      ['admin', 'Requires college_id - College-level administrator'],
      ['principal', 'Requires college_id - College principal (can have teacher_classes, teacher_subjects, board)'],
      ['dean', 'Requires college_id - Department dean (can have teacher_classes, teacher_subjects, board)'],
      ['teacher', 'Requires college_id - Faculty member (can have teacher_classes, teacher_subjects, board)'],
      ['student', 'Requires college_id, student_roll, academic_year, student_class'],
      [''],
      ['Validation Rules:'],
      ['- Phone must be exactly 10 digits'],
      ['- Email must be unique (if provided)'],
      ['- Users with existing phone OR email will be SKIPPED'],
      ['- Academic year must be in YYYY-YY format'],
      ['- Student fields are mandatory for user_type=student'],
      [''],
      ['Tips:'],
      ['- Check the "Reference" sheet for all allowed user types'],
      ['- Copy exact values from Reference sheet to avoid errors'],
      ['- Use comma to separate multiple classes/subjects for teachers/principals/deans'],
      ['- Principals and Deans can also teach - add their classes, subjects, and board'],
      ['- Fill all REQUIRED columns for the user type you\'re creating'],
      ['- Test with a few users first before uploading large batches'],
      ['- Duplicate phone/email users will be automatically skipped']
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 20 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Download the file
    XLSX.writeFile(wb, 'users_template.xlsx');
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  // Parse Excel file
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames.includes('Users')) {
          showNotification('error', 'Excel file must contain a "Users" sheet');
          return;
        }
        
        const worksheet = workbook.Sheets['Users'];
        const users: UserRow[] = XLSX.utils.sheet_to_json(worksheet);
        
        if (users.length === 0) {
          showNotification('warning', 'The Users sheet is empty');
          return;
        }
        
        console.log(`📊 Parsed ${users.length} users from Excel`);
        setParsedUsers(users);
        setUploadStep('preview');
        
      } catch (error: any) {
        showNotification('error', `Failed to parse Excel file: ${error.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  // Normalize phone number
  const normalizePhoneNumber = (phone: string): string => {
    if (!phone) throw new Error('Phone number is required');
    
    let cleaned = phone.toString().trim().replace(/[\s\-\(\)]/g, '');
    cleaned = cleaned.replace(/^\+/, '');
    
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }
    
    if (cleaned.length !== 10 || !/^\d{10}$/.test(cleaned)) {
      throw new Error(`Invalid phone number: ${phone}. Must be 10 digits`);
    }
    
    return `+91${cleaned}`;
  };

  // Validate academic year format
  const isValidAcademicYear = (year: string): boolean => {
    if (!year) return false;
    const pattern = /^\d{4}-\d{2}$/;
    return pattern.test(year);
  };

  // Upload users to Firebase
  const uploadUsers = async () => {
    setUploadStep('uploading');
    setUploadProgress(0);
    setCurrentPage(1); // Reset pagination

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{
        rowNumber: number;
        fullName: string;
        userType: string;
        status: 'success' | 'skipped' | 'failed';
        reason?: string;
      }>
    };

    try {
      const currentUser = await firebaseService.getCurrentUserProfile();
      const createdBy = currentUser?.userId || 'system';

      for (let i = 0; i < parsedUsers.length; i++) {
        const user = parsedUsers[i];
        const rowNumber = i + 1;
        const progress = Math.round(((i + 1) / parsedUsers.length) * 100);
        setUploadProgress(progress);

        try {
          // Validate required fields
          if (!user.full_name) {
            throw new Error('full_name is required');
          }
          if (!user.phone) {
            throw new Error('phone is required');
          }
          if (!user.user_type) {
            throw new Error('user_type is required');
          }

          // Normalize user type
          const userType = user.user_type.trim().toLowerCase().replace(/\s+/g, '_');
          const validUserTypes = ['system_admin', 'admin', 'principal', 'dean', 'teacher', 'student'];
          
          if (!validUserTypes.includes(userType)) {
            throw new Error(`Invalid user_type: ${user.user_type}`);
          }

          // Validate college_id for non-system_admin users
          const collegeId = user.college_id || activeCollegeId;
          if (userType !== 'system_admin' && !collegeId) {
            throw new Error('college_id is required for non-system_admin users');
          }

          // Validate student-specific fields
          if (userType === 'student') {
            if (!user.student_roll) throw new Error('student_roll is required for students');
            if (!user.academic_year) throw new Error('academic_year is required for students');
            if (!user.student_class) throw new Error('student_class is required for students');
            if (!isValidAcademicYear(user.academic_year)) {
              throw new Error(`Invalid academic_year format: ${user.academic_year}. Must be YYYY-YY`);
            }
          }

          // Normalize phone number
          const normalizedPhone = normalizePhoneNumber(user.phone);

          // Check if user already exists (by phone or email)
          const phoneExists = await firebaseService.checkUserExistsByPhone(normalizedPhone);
          const emailExists = user.email ? await firebaseService.checkUserExistsByEmail(user.email) : false;

          if (phoneExists || emailExists) {
            console.log(`⏭️  Skipped: ${user.full_name} - User already exists`);
            results.skipped++;
            results.details.push({
              rowNumber,
              fullName: user.full_name,
              userType: user.user_type,
              status: 'skipped',
              reason: phoneExists ? 'Phone number already exists' : 'Email already exists'
            });
            continue;
          }

          // Prepare user data
          const userData: any = {
            fullName: user.full_name.trim(),
            title: user.title ? user.title.trim() : '',
            email: user.email ? user.email.trim().toLowerCase() : '',
            phone: normalizedPhone,
            phoneRaw: normalizedPhone.replace('+91', ''),
            userType: userType,
            collegeId: collegeId,
            board: user.board ? user.board.trim() : 'Not Specified',
            status: 'active',
            createdBy: user.created_by || createdBy
          };

          // Add student-specific fields
          if (userType === 'student') {
            userData.studentRoll = user.student_roll!.trim();
            userData.academicYear = user.academic_year!.trim();
            userData.studentClass = user.student_class!.trim();
            userData.parentPhone = user.parent_phone ? user.parent_phone.trim() : '';
            userData.studentHistory = [{
              academicYear: user.academic_year!.trim(),
              class: user.student_class!.trim(),
              rollNumber: user.student_roll!.trim(),
              board: user.board ? user.board.trim() : 'Not Specified',
              collegeId: collegeId
            }];
          }

          // Add teacher/principal/dean-specific fields (they may also teach)
          if (userType === 'teacher' || userType === 'principal' || userType === 'dean') {
            userData.teacherClasses = user.teacher_classes 
              ? user.teacher_classes.split(',').map((c: string) => c.trim())
              : [];
            userData.teacherSubjects = user.teacher_subjects
              ? user.teacher_subjects.split(',').map((s: string) => s.trim())
              : [];
          }

          // Create user in Firebase
          await firebaseService.createBulkUser(userData);

          console.log(`✅ Added: ${user.full_name}`);
          results.success++;
          results.details.push({
            rowNumber,
            fullName: user.full_name,
            userType: user.user_type,
            status: 'success'
          });

        } catch (error: any) {
          console.error(`❌ Failed: ${user.full_name} - ${error.message}`);
          results.failed++;
          results.details.push({
            rowNumber,
            fullName: user.full_name,
            userType: user.user_type,
            status: 'failed',
            reason: error.message
          });
        }
      }

      setUploadResults(results);
      setUploadStep('complete');
      
      // Don't auto-close - let user review results and close manually

    } catch (error: any) {
      console.error('Bulk upload error:', error);
      showNotification('error', `Upload failed: ${error.message}`);
      setUploadStep('select');
    }
  };

  // Reset and close modal
  const handleClose = () => {
    // Call onUploadComplete if there were any successful uploads
    if (uploadResults.success > 0) {
      onUploadComplete();
    }
    
    setUploadStep('select');
    setParsedUsers([]);
    setUploadProgress(0);
    setUploadResults({ success: 0, skipped: 0, failed: 0, details: [] });
    setNotification({ type: 'info', message: '', visible: false });
    onClose();
  };

  return (
    <>
      <style>{`
        /* Custom scrollbar styling - Hidden */
        .custom-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}</style>
      
      <div className={`fixed inset-0 z-[60000] flex items-start justify-start p-2 transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
          onClick={handleClose}
        />
        
        <div 
          className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[50rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div 
          className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
          style={{ background: brandTheme.gradients.primary }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Upload size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Upload Users</h2>
              <p className="text-xs text-white/80">Import multiple users using Excel file</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={downloadTemplate}
              className="px-3 py-1.5 text-white/90 font-medium text-sm rounded-lg transition-all duration-200 flex items-center space-x-2 hover:bg-white/20"
            >
              <Download size={14} className="text-white" />
              <span>Download template</span>
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Inline Notification */}
        {notification.visible && (
          <div 
            className={`mx-8 mt-6 p-4 rounded-lg border-l-4 flex items-start space-x-3 transition-all duration-500 ease-in-out ${
              notification.type === 'error' 
                ? 'bg-red-50 border-red-500' 
                : notification.type === 'warning'
                ? 'bg-amber-50 border-amber-500'
                : ''
            }`}
            style={notification.type === 'info' ? {
              backgroundColor: brandTheme.colors.primary + '10',
              borderLeftColor: brandTheme.colors.primary
            } : {}}
          >
            <div className="flex-shrink-0 mt-0.5">
              {notification.type === 'error' && (
                <AlertCircle size={20} className="text-red-600" />
              )}
              {notification.type === 'warning' && (
                <AlertCircle size={20} className="text-amber-600" />
              )}
              {notification.type === 'info' && (
                <CheckCircle size={20} style={{ color: brandTheme.colors.primary }} />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                notification.type === 'error' 
                  ? 'text-red-800' 
                  : notification.type === 'warning'
                  ? 'text-amber-800'
                  : ''
              }`}
              style={notification.type === 'info' ? { color: brandTheme.colors.primary } : {}}>
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(prev => ({ ...prev, visible: false }))}
              className="flex-shrink-0 p-1 hover:bg-white rounded transition-colors"
            >
              <X size={16} className={
                notification.type === 'error' 
                  ? 'text-red-600' 
                  : notification.type === 'warning'
                  ? 'text-amber-600'
                  : ''
              }
              style={notification.type === 'info' ? { color: brandTheme.colors.primary } : {}} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {uploadStep === 'select' && (
            <div className="space-y-6">
              {/* Drag and Drop Upload Area */}
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border border-dashed rounded-xl transition-all duration-300 ${
                  isDragging
                    ? 'scale-[1.02]'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={isDragging ? {
                  borderColor: brandTheme.colors.primary,
                  backgroundColor: brandTheme.colors.primary + '10'
                } : {
                  background: `linear-gradient(135deg, ${brandTheme.colors.primary}05 0%, ${brandTheme.colors.secondary}05 100%)`
                }}
              >
                <div className="p-8 text-center">
                  {/* Upload Icon */}
                  <div className="mb-4 flex justify-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDragging 
                        ? 'scale-110' 
                        : ''
                    }`}
                    style={{ background: brandTheme.gradients.primary }}>
                      <Upload size={32} className="text-white" />
                    </div>
                  </div>

                  {/* Text */}
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    {isDragging ? 'Drop your file here' : 'Upload Excel File'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Drag and drop your Excel file here, or click to browse
                  </p>

                  {/* Upload Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    <FileSpreadsheet size={20} />
                    <span>Choose Excel File</span>
                  </button>

                  {/* Supported Formats */}
                  <p className="text-xs text-gray-500 mt-4">
                    Supported formats: .xlsx, .xls
                  </p>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 rounded-tl-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 rounded-tr-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 rounded-bl-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 rounded-br-lg opacity-50"
                  style={{ borderColor: brandTheme.colors.primary }}></div>
              </div>

              {/* Instructions */}
              <div className="border rounded-xl p-5 shadow-sm"
                style={{ 
                  background: `linear-gradient(to right, ${brandTheme.colors.accent}10, ${brandTheme.colors.accent}15)`,
                  borderColor: brandTheme.colors.accent + '40'
                }}>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: brandTheme.colors.accent }}>
                    <FileText size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold mb-3" style={{ color: brandTheme.colors.accent }}>Important Instructions</h4>
                    <ul className="space-y-2 text-xs" style={{ color: brandTheme.colors.accent }}>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Check the <strong>"Reference"</strong> sheet for all allowed values for user_type and validation rules</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Required columns:</strong> full_name, phone, user_type</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Phone format:</strong> Must be exactly 10 digits (no spaces or special characters)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span><strong>Duplicates:</strong> Users with existing phone OR email will be skipped</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {uploadStep === 'preview' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
                <CheckCircle size={24} className="text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">File parsed successfully!</p>
                  <p className="text-sm text-green-700">Found {parsedUsers.length} users ready to upload</p>
                </div>
              </div>

              {/* Preview */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Users Preview</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {parsedUsers.slice(0, 10).map((u, idx) => (
                    <div key={idx} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold px-2 py-1 rounded"
                            style={{ 
                              backgroundColor: brandTheme.colors.primary + '20',
                              color: brandTheme.colors.primary
                            }}>
                            {u.user_type}
                          </span>
                          {u.board && (
                            <span className="text-xs font-semibold px-2 py-1 rounded"
                              style={{ 
                                backgroundColor: brandTheme.colors.secondary + '20',
                                color: brandTheme.colors.secondary
                              }}>
                              {u.board}
                            </span>
                          )}
                          {u.student_class && (
                            <span className="text-xs font-semibold px-2 py-1 rounded"
                              style={{ 
                                backgroundColor: brandTheme.colors.accent + '20',
                                color: brandTheme.colors.accent
                              }}>
                              Class {u.student_class}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{u.phone}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                      {u.email && (
                        <p className="text-xs text-gray-600">{u.email}</p>
                      )}
                    </div>
                  ))}
                  {parsedUsers.length > 10 && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      ... and {parsedUsers.length - 10} more users
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setUploadStep('select')}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Choose Different File
                </button>
                <button
                  onClick={uploadUsers}
                  className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <Upload size={18} />
                  <span>Upload {parsedUsers.length} Users</span>
                </button>
              </div>
            </div>
          )}

          {uploadStep === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={64} className="animate-spin mb-6" style={{ color: brandTheme.colors.primary }} />
              <h3 className="text-base font-semibold text-gray-900 mb-2">Uploading Users...</h3>
              <p className="text-gray-600 mb-6">Please wait while we process your users</p>
              <div className="w-full max-w-md">
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${uploadProgress}%`,
                      background: brandTheme.gradients.primary
                    }}
                  />
                </div>
                <p className="text-center mt-2 text-sm font-medium text-gray-700">{uploadProgress}%</p>
              </div>
            </div>
          )}

          {uploadStep === 'complete' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                {uploadResults.success > 0 && uploadResults.failed === 0 && uploadResults.skipped === 0 ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={48} className="text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Complete!</h3>
                    <p className="text-gray-600">All {uploadResults.success} users were uploaded successfully</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={48} className="text-amber-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Complete</h3>
                    <p className="text-gray-600">
                      {uploadResults.success} succeeded, {uploadResults.skipped} skipped, {uploadResults.failed} failed
                    </p>
                  </>
                )}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{uploadResults.success}</p>
                  <p className="text-sm text-green-700 font-medium">Successful</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-600">{uploadResults.skipped}</p>
                  <p className="text-sm text-yellow-700 font-medium">Skipped</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{uploadResults.failed}</p>
                  <p className="text-sm text-red-700 font-medium">Failed</p>
                </div>
              </div>

              {/* Detailed Results List */}
              {uploadResults.details.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900">Detailed Results ({uploadResults.details.length})</h4>
                  </div>
                  
                  {/* Results Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Row</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploadResults.details
                          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                          .map((detail, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono">{detail.rowNumber}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{detail.fullName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                  {detail.userType}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {detail.status === 'success' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle size={14} className="mr-1" />
                                    Success
                                  </span>
                                )}
                                {detail.status === 'skipped' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <AlertCircle size={14} className="mr-1" />
                                    Skipped
                                  </span>
                                )}
                                {detail.status === 'failed' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <X size={14} className="mr-1" />
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {detail.reason || '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {uploadResults.details.length > ITEMS_PER_PAGE && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, uploadResults.details.length)} of {uploadResults.details.length} results
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        
                        {/* Page numbers */}
                        {Array.from({ length: Math.ceil(uploadResults.details.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                          .filter(page => {
                            // Show first, last, current, and adjacent pages
                            const totalPages = Math.ceil(uploadResults.details.length / ITEMS_PER_PAGE);
                            return page === 1 || 
                                   page === totalPages || 
                                   page === currentPage || 
                                   page === currentPage - 1 || 
                                   page === currentPage + 1;
                          })
                          .map((page, idx, arr) => {
                            // Add ellipsis if there's a gap
                            const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                            return (
                              <div key={page} className="flex items-center">
                                {showEllipsis && <span className="px-2 text-gray-500">...</span>}
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`px-3 py-1 border rounded-md text-sm font-medium transition-colors ${
                                    currentPage === page
                                      ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              </div>
                            );
                          })}
                        
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(uploadResults.details.length / ITEMS_PER_PAGE), prev + 1))}
                          disabled={currentPage === Math.ceil(uploadResults.details.length / ITEMS_PER_PAGE)}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full px-4 py-3 text-white font-medium text-sm rounded-lg transition-all shadow-md hover:shadow-lg"
                style={{ background: brandTheme.gradients.primary }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}