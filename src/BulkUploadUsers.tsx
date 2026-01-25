import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useBrand } from './BrandContext';
import * as XLSX from 'xlsx';
import { firebaseService } from './services/firebase_service';

/**
 * Calculate academic year based on college's academic year start month
 * @param startMonth - The month when academic year starts (e.g., "April", "January", "June")
 *                     Defaults to "April" if not provided
 */
const calculateAcademicYear = (startMonth?: string): string => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();
  
  // Map month names to numbers
  const monthMap: Record<string, number> = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
  };
  
  // Default to April (month 4) if not provided or invalid
  const startMonthNum = startMonth 
    ? (monthMap[startMonth.toLowerCase()] || 4)
    : 4;
  
  // If current month >= start month, academic year is currentYear-(currentYear+1)
  // If current month < start month, academic year is (currentYear-1)-currentYear
  let startYear = currentMonth >= startMonthNum ? currentYear : currentYear - 1;
  
  const endYear = startYear + 1;
  const endYearShort = endYear.toString().slice(-2);
  
  return `${startYear}-${endYearShort}`;
};

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
  student_class?: string;
  teacher_classes?: string;
  teacher_subjects?: string;
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
  const [collegeAcademicYearStartMonth, setCollegeAcademicYearStartMonth] = useState<string>('April');
  const [collegeValidClasses, setCollegeValidClasses] = useState<string[]>([]); // ✅ Valid classes from college
  const [collegeSubjects, setCollegeSubjects] = useState<string[]>([]); // ✅ Valid subjects from college
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
  
  // Pagination state for preview
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_ITEMS_PER_PAGE = 10;
  
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

  // ✅ Load college data to get academic year start month, valid classes, and subjects
  useEffect(() => {
    const loadCollegeData = async () => {
      if (!activeCollegeId) return;
      
      try {
        const college = await firebaseService.getCollegeById(activeCollegeId);
        if (college) {
          if (college.academicYear) {
            console.log('📅 College academic year starts in:', college.academicYear);
            setCollegeAcademicYearStartMonth(college.academicYear);
          }
          if (college.validClasses && Array.isArray(college.validClasses)) {
            console.log('📚 College valid classes:', college.validClasses);
            setCollegeValidClasses(college.validClasses);
          }
          if (college.subjects && Array.isArray(college.subjects)) {
            console.log('📖 College subjects:', college.subjects);
            setCollegeSubjects(college.subjects);
          }
        }
      } catch (error) {
        console.error('Error loading college data:', error);
      }
    };
    
    if (isOpen) {
      loadCollegeData();
    }
  }, [isOpen, activeCollegeId]);

  // Download Excel template - University friendly with valid classes and subjects
  const downloadTemplate = () => {
    // Sample data rows - university friendly
    const template = [
      {
        full_name: 'Mr John Admin',
        title: 'Senior Admin',
        email: 'john.admin@example.com',
        phone: '9876543210',
        user_type: 'admin',
        college_id: activeCollegeId,
        student_roll: '',
        student_class: '',
        teacher_classes: '',
        teacher_subjects: ''
      },
      {
        full_name: 'Dr Sarah Principal',
        title: 'Principal',
        email: 'sarah.principal@example.com',
        phone: '9876543214',
        user_type: 'principal',
        college_id: activeCollegeId,
        student_roll: '',
        student_class: '',
        teacher_classes: collegeValidClasses.slice(0, 2).join(', ') || 'MCA-1, MCA-2',
        teacher_subjects: collegeSubjects.slice(0, 1).join(', ') || 'Python'
      },
      {
        full_name: 'Prof Michael Dean',
        title: 'Dean - Computer Science',
        email: 'michael.dean@example.com',
        phone: '9876543215',
        user_type: 'dean',
        college_id: activeCollegeId,
        student_roll: '',
        student_class: '',
        teacher_classes: collegeValidClasses.slice(0, 2).join(', ') || 'MCA-1, MCA-2',
        teacher_subjects: collegeSubjects.slice(0, 2).join(', ') || 'Java, Python'
      },
      {
        full_name: 'Ms Jane Faculty',
        title: 'Assistant Professor',
        email: 'jane.faculty@example.com',
        phone: '9876543211',
        user_type: 'teacher',
        college_id: activeCollegeId,
        student_roll: '',
        student_class: '',
        teacher_classes: collegeValidClasses.slice(0, 3).join(', ') || 'MCA-1, MCA-2, MCA-3',
        teacher_subjects: collegeSubjects.slice(0, 2).join(', ') || 'C Programming, DSA'
      },
      {
        full_name: 'Rahul Kumar',
        title: 'Student',
        email: 'rahul.kumar@example.com',
        phone: '9876543212',
        user_type: 'student',
        college_id: activeCollegeId,
        student_roll: '2024MCA001',
        student_class: collegeValidClasses[0] || 'MCA-1',
        teacher_classes: '',
        teacher_subjects: ''
      },
      {
        full_name: 'Priya Sharma',
        title: 'Student',
        email: 'priya.sharma@example.com',
        phone: '9876543213',
        user_type: 'student',
        college_id: activeCollegeId,
        student_roll: '2024BEC001',
        student_class: collegeValidClasses[3] || 'BEC-1',
        teacher_classes: '',
        teacher_subjects: ''
      }
    ];

    // Create worksheet from template data
    const ws = XLSX.utils.json_to_sheet(template);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 22 }, // full_name
      { wch: 25 }, // title
      { wch: 28 }, // email
      { wch: 15 }, // phone
      { wch: 12 }, // user_type
      { wch: 20 }, // college_id
      { wch: 15 }, // student_roll
      { wch: 15 }, // student_class
      { wch: 30 }, // teacher_classes
      { wch: 35 }  // teacher_subjects
    ];

    // Create workbook and add worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    
    // Create Reference sheet with allowed values - Include college's valid classes and subjects
    const referenceData: any[][] = [
      ['ALLOWED VALUES FOR THIS COLLEGE'],
      [''],
      ['User Types:'],
      ['admin'],
      ['principal'],
      ['dean'],
      ['teacher'],
      ['student'],
      [''],
      ['VALID CLASSES (Use exact values):'],
      ...(collegeValidClasses.length > 0 
        ? collegeValidClasses.map(cls => [cls])
        : [['(No classes configured - contact admin)']]),
      [''],
      ['VALID SUBJECTS (Use exact values):'],
      ...(collegeSubjects.length > 0 
        ? collegeSubjects.map(sub => [sub])
        : [['(No subjects configured - contact admin)']]),
      [''],
      ['VALIDATION RULES:'],
      [''],
      ['Phone Number:'],
      ['- Must be exactly 10 digits'],
      ['- Example: 9876543210'],
      [''],
      ['Student Roll Number:'],
      ['- Required for students'],
      ['- Must be unique per class and academic year'],
      ['- Example: 2024MCA001, 2024BEC001'],
      [''],
      ['Student Class:'],
      ['- Must match one of the VALID CLASSES listed above'],
      ['- Required for students'],
      [''],
      ['Teacher Classes:'],
      ['- Comma-separated list from VALID CLASSES'],
      ['- Example: MCA-1, MCA-2, MCA-3'],
      [''],
      ['Teacher Subjects:'],
      ['- Comma-separated list from VALID SUBJECTS'],
      ['- Example: Python, Java, DSA'],
      [''],
      ['DUPLICATE HANDLING:'],
      ['- Users with existing phone OR email will be SKIPPED'],
      ['- Students with existing roll number in same class will be SKIPPED']
    ];

    const wsReference = XLSX.utils.aoa_to_sheet(referenceData);
    wsReference['!cols'] = [{ wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsReference, 'Reference');
    
    // Add instructions sheet
    const instructions = [
      ['BULK USER UPLOAD - INSTRUCTIONS'],
      [''],
      ['⚠️ IMPORTANT: Check the "Reference" sheet for valid classes and subjects for your college'],
      [''],
      ['Column Descriptions:'],
      ['full_name', 'REQUIRED - Full name (e.g., Dr. John Smith, Prof. Jane Doe)'],
      ['title', 'Optional - Designation (e.g., Assistant Professor, Associate Professor, Student)'],
      ['email', 'Optional - Email address (must be unique)'],
      ['phone', 'REQUIRED - 10-digit mobile number (e.g., 9876543210)'],
      ['user_type', 'REQUIRED - One of: admin, principal, dean, teacher, student'],
      ['college_id', 'Pre-filled - Do not change'],
      ['student_roll', 'REQUIRED for students - Unique roll number (e.g., 2024MCA001)'],
      ['student_class', 'REQUIRED for students - Must match a class from Reference sheet'],
      ['teacher_classes', 'For faculty - Comma-separated classes from Reference sheet'],
      ['teacher_subjects', 'For faculty - Comma-separated subjects from Reference sheet'],
      [''],
      ['AUTOMATICALLY SET FIELDS:'],
      ['board', 'Set from college configuration'],
      ['academic_year', 'Calculated based on college academic year settings'],
      ['created_by', 'Set to the user uploading the file'],
      [''],
      ['User Type Requirements:'],
      ['admin', 'College administrator - no class/subject assignment needed'],
      ['principal', 'Can optionally have teacher_classes and teacher_subjects'],
      ['dean', 'Can optionally have teacher_classes and teacher_subjects'],
      ['teacher', 'Should have teacher_classes and teacher_subjects assigned'],
      ['student', 'MUST have student_roll and student_class'],
      [''],
      ['TIPS:'],
      ['- Copy exact class/subject names from Reference sheet'],
      ['- Test with a few users first'],
      ['- Invalid classes/subjects will cause the row to fail'],
      ['- Duplicate phone/email/roll numbers will be skipped']
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 20 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Download the file
    XLSX.writeFile(wb, 'users_upload_template.xlsx');
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
        setPreviewPage(1); // Reset preview pagination
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
  // Upload users to Firebase - UPDATED: board from collegeId, createdBy from current user
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
      // ✅ Get current user for createdBy field
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
            if (!user.student_class) throw new Error('student_class is required for students');
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

          // ✅ Calculate academic year based on college settings
          const academicYear = calculateAcademicYear(collegeAcademicYearStartMonth);

          // ✅ Validate student class against college's valid classes
          if (userType === 'student') {
            const studentClass = user.student_class!.trim();
            if (collegeValidClasses.length > 0 && !collegeValidClasses.includes(studentClass)) {
              throw new Error(`Invalid class '${studentClass}'. Valid classes: ${collegeValidClasses.join(', ')}`);
            }
          }

          // ✅ Validate teacher/principal/dean classes and subjects
          if (userType === 'teacher' || userType === 'principal' || userType === 'dean') {
            // Validate classes
            if (user.teacher_classes) {
              const classes = user.teacher_classes.split(',').map((c: string) => c.trim()).filter(Boolean);
              if (collegeValidClasses.length > 0) {
                const invalidClasses = classes.filter(cls => !collegeValidClasses.includes(cls));
                if (invalidClasses.length > 0) {
                  throw new Error(`Invalid class(es): ${invalidClasses.join(', ')}. Valid: ${collegeValidClasses.join(', ')}`);
                }
              }
            }
            
            // Validate subjects
            if (user.teacher_subjects) {
              const subjects = user.teacher_subjects.split(',').map((s: string) => s.trim()).filter(Boolean);
              if (collegeSubjects.length > 0) {
                const invalidSubjects = subjects.filter(sub => !collegeSubjects.includes(sub));
                if (invalidSubjects.length > 0) {
                  throw new Error(`Invalid subject(s): ${invalidSubjects.join(', ')}. Valid: ${collegeSubjects.join(', ')}`);
                }
              }
            }
          }

          // ✅ Check if student roll number already exists (for students only)
          if (userType === 'student') {
            const rollExists = await firebaseService.checkStudentRollExists(
              collegeId,
              user.student_class!.trim(),
              academicYear,
              user.student_roll!.trim()
            );
            
            if (rollExists) {
              console.log(`⏭️  Skipped: ${user.full_name} - Roll number already exists`);
              results.skipped++;
              results.details.push({
                rowNumber,
                fullName: user.full_name,
                userType: user.user_type,
                status: 'skipped',
                reason: `Roll number '${user.student_roll}' already exists for class ${user.student_class} in ${academicYear}`
              });
              continue;
            }
          }

          // Prepare user data - UPDATED: board = collegeId, createdBy = current user
          const userData: any = {
            fullName: user.full_name.trim(),
            title: user.title ? user.title.trim() : '',
            email: user.email ? user.email.trim().toLowerCase() : '',
            phone: normalizedPhone,
            phoneRaw: normalizedPhone.replace('+91', ''),
            userType: userType,
            collegeId: collegeId,
            board: collegeId, // ✅ Use collegeId as board
            academicYear: academicYear, // ✅ Add academic year for all users
            status: 'active',
            createdBy: createdBy // ✅ Set to current user who is uploading
          };

          // Add student-specific fields
          if (userType === 'student') {
            userData.studentRoll = user.student_roll!.trim();
            userData.studentClass = user.student_class!.trim();
            userData.parentPhone = ''; // No parent phone in bulk upload
            userData.studentHistory = [{
              academicYear: academicYear,
              class: user.student_class!.trim(),
              rollNumber: user.student_roll!.trim(),
              board: collegeId, // ✅ Use collegeId as board
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
          className="absolute inset-0 bg-black/30 z-0"
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
              <Download size={16} />
              <span>Template</span>
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notification Banner */}
        {notification.visible && (
          <div 
            className={`mx-4 mt-4 px-4 py-3 rounded-lg flex items-center space-x-3 ${
              notification.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
              notification.type === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
              'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
          >
            <AlertCircle size={18} />
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button 
              onClick={() => setNotification(prev => ({ ...prev, visible: false }))}
              className="p-1 hover:opacity-70"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {uploadStep === 'select' && (
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ backgroundColor: brandTheme.colors.primary + '15' }}
                >
                  <FileSpreadsheet size={40} style={{ color: brandTheme.colors.primary }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Drop your Excel file here
                </h3>
                <p className="text-gray-500 mb-5">
                  or click to browse from your computer
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2.5 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  Select File
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText size={18} className="mr-2" style={{ color: brandTheme.colors.primary }} />
                  Instructions
                </h4>
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li>Download the template by clicking the "Template" button above</li>
                  <li>Fill in user details in the Excel file (Users sheet)</li>
                  <li>Check the Reference sheet for allowed values</li>
                  <li>Upload the filled Excel file</li>
                  <li>Review and confirm the upload</li>
                </ol>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Board, Academic Year, and Created By are automatically set based on college settings and the uploading user.
                  </p>
                </div>
              </div>
            </div>
          )}

          {uploadStep === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Preview Users</h3>
                  <p className="text-sm text-gray-500">{parsedUsers.length} users found in file</p>
                </div>
                <button
                  onClick={() => {
                    setUploadStep('select');
                    setParsedUsers([]);
                    setPreviewPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Change File
                </button>
              </div>

              {/* Auto-set fields notice */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Auto-set:</strong> Board = College ID, Academic Year = {calculateAcademicYear(collegeAcademicYearStartMonth)}, Created By = Current User
                </p>
              </div>

              {/* Preview Table with Pagination */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Class/Roll</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {parsedUsers
                        .slice((previewPage - 1) * PREVIEW_ITEMS_PER_PAGE, previewPage * PREVIEW_ITEMS_PER_PAGE)
                        .map((user, idx) => {
                          const actualIndex = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE + idx;
                          const userTypeLower = user.user_type?.toLowerCase().trim();
                          return (
                            <tr key={actualIndex} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-600">{actualIndex + 1}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{user.full_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{user.phone}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                  {user.user_type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {userTypeLower === 'student' 
                                  ? `${user.student_class || '—'} / ${user.student_roll || '—'}`
                                  : user.teacher_classes || '—'
                                }
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Preview Pagination */}
                {parsedUsers.length > PREVIEW_ITEMS_PER_PAGE && (
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {((previewPage - 1) * PREVIEW_ITEMS_PER_PAGE) + 1} to {Math.min(previewPage * PREVIEW_ITEMS_PER_PAGE, parsedUsers.length)} of {parsedUsers.length} users
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPreviewPage(prev => Math.max(1, prev - 1))}
                        disabled={previewPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.ceil(parsedUsers.length / PREVIEW_ITEMS_PER_PAGE) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalPages = Math.ceil(parsedUsers.length / PREVIEW_ITEMS_PER_PAGE);
                          return page === 1 || 
                                 page === totalPages || 
                                 page === previewPage || 
                                 page === previewPage - 1 || 
                                 page === previewPage + 1;
                        })
                        .map((page, idx, arr) => {
                          const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsis && <span className="px-2 text-gray-500">...</span>}
                              <button
                                onClick={() => setPreviewPage(page)}
                                className={`px-3 py-1 border rounded-md text-sm font-medium transition-colors ${
                                  previewPage === page
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
                        onClick={() => setPreviewPage(prev => Math.min(Math.ceil(parsedUsers.length / PREVIEW_ITEMS_PER_PAGE), prev + 1))}
                        disabled={previewPage === Math.ceil(parsedUsers.length / PREVIEW_ITEMS_PER_PAGE)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setUploadStep('select');
                    setParsedUsers([]);
                    setPreviewPage(1);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadUsers}
                  className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  Upload {parsedUsers.length} Users
                </button>
              </div>
            </div>
          )}

          {uploadStep === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
                style={{ backgroundColor: brandTheme.colors.primary + '15' }}
              >
                <Loader2 size={48} className="animate-spin" style={{ color: brandTheme.colors.primary }} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Uploading Users...</h3>
              <p className="text-gray-500 mb-6">Please wait while we process your file</p>
              
              {/* Progress Bar */}
              <div className="w-full max-w-md">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${uploadProgress}%`,
                      background: brandTheme.gradients.primary
                    }}
                  />
                </div>
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