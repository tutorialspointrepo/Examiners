import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Building2 } from 'lucide-react';
import { useBrand } from './BrandContext';
import * as XLSX from 'xlsx';
import { firebaseService } from './services/firebase_service';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface BulkUploadUniversityProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  currentUser: any;
}

interface CollegeRow {
  college_name: string;
  college_id: string;
  academicYear?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  established_year?: number;
  supported_boards?: string;
  subjects?: string;
  valid_classes?: string;
  exam_types?: string;
  college_type?: string;
  created_by?: string;
  features?: string;
}

export default function BulkUploadUniversity({
  isOpen,
  onClose,
  onUploadComplete,
  currentUser
}: BulkUploadUniversityProps) {
  const brandTheme = useBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadStep, setUploadStep] = useState<'select' | 'preview' | 'uploading' | 'complete'>('select');
  const [parsedColleges, setParsedColleges] = useState<CollegeRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    skipped: number;
    failed: number;
    details: Array<{
      rowNumber: number;
      collegeName: string;
      collegeId: string;
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
    const template = [
      {
        college_name: 'Tutorials Point India Private Limited',
        college_id: 'TPX',
        academicYear: 'April',
        address: 'Tutorials Point India Private Limited, 1st Floor, Incor9 Building, Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        phone: '+91 70321 55786',
        email: 'contact@tutorialspoint.com',
        website: 'https://www.tutorialspoint.com/',
        established_year: 2014,
        supported_boards: 'TPX',
        subjects: 'C Programming, C++, Java, Python, DSA, Machine Learning',
        valid_classes: 'MCA-1, MCA-2, MCA-3, BEC-1, BEC-2, BEC-3, BEC-4',
        exam_types: 'Home Work, Subject Assessment, Sample Test, Practice Session, Unit Test, Quarterly, Half Yearly, Yearly, Pre-Board, Lab Assessment',
        college_type: 'University',
        created_by: '',
        features: 'exams, results, users, calender, questions, leader board, reports, rooms, hall tickets'
      },
      {
        college_name: 'Sample Institute of Technology',
        college_id: 'SIT',
        academicYear: 'June',
        address: '123 Education Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        phone: '+91 22 12345678',
        email: 'info@sample.edu',
        website: 'https://www.sample.edu/',
        established_year: 2010,
        supported_boards: 'CBSE, ICSE',
        subjects: 'Mathematics, Physics, Chemistry, Biology',
        valid_classes: 'Class 1, Class 2, Class 3, Class 4, Class 5',
        exam_types: 'Unit Test, Mid Term, Final Exam',
        college_type: 'School',
        created_by: '',
        features: 'exams, results, users, reports'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 35 }, // college_name
      { wch: 12 }, // college_id
      { wch: 12 }, // academicYear
      { wch: 50 }, // address
      { wch: 15 }, // city
      { wch: 15 }, // state
      { wch: 10 }, // pincode
      { wch: 18 }, // phone
      { wch: 25 }, // email
      { wch: 30 }, // website
      { wch: 15 }, // established_year
      { wch: 20 }, // supported_boards
      { wch: 50 }, // subjects
      { wch: 50 }, // valid_classes
      { wch: 80 }, // exam_types
      { wch: 12 }, // college_type
      { wch: 15 }, // created_by
      { wch: 60 }, // features
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Colleges');
    XLSX.writeFile(wb, 'university_upload_template.xlsx');
  };

  // Parse Excel file
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Look for Colleges sheet
        const collegesSheet = workbook.Sheets['Colleges'];
        if (!collegesSheet) {
          showNotification('error', 'Excel file must have a "Colleges" sheet');
          return;
        }
        
        const colleges: CollegeRow[] = XLSX.utils.sheet_to_json(collegesSheet);
        
        if (colleges.length === 0) {
          showNotification('error', 'No data found in Colleges sheet');
          return;
        }

        // Validate required fields
        const validColleges: CollegeRow[] = [];
        const errors: string[] = [];

        colleges.forEach((college, index) => {
          const rowNum = index + 2; // +2 for header row and 0-index
          
          if (!college.college_name || !college.college_id) {
            errors.push(`Row ${rowNum}: Missing college_name or college_id`);
            return;
          }
          
          validColleges.push(college);
        });

        if (errors.length > 0 && validColleges.length === 0) {
          showNotification('error', `Validation errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`);
          return;
        }

        if (errors.length > 0) {
          showNotification('warning', `${errors.length} row(s) have validation issues and will be skipped`);
        }

        setParsedColleges(validColleges);
        setUploadStep('preview');
        
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        showNotification('error', 'Failed to parse Excel file. Please ensure it\'s a valid .xlsx file.');
      }
    };
    
    reader.onerror = () => {
      showNotification('error', 'Failed to read file');
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showNotification('error', 'Please upload an Excel file (.xlsx or .xls)');
        return;
      }
      parseExcelFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showNotification('error', 'Please upload an Excel file (.xlsx or .xls)');
        return;
      }
      parseExcelFile(file);
    }
  };

  // Upload colleges to Firebase
  const uploadColleges = async () => {
    setUploadStep('uploading');
    setUploadProgress(0);
    
    const results: typeof uploadResults = {
      success: 0,
      skipped: 0,
      failed: 0,
      details: []
    };

    for (let i = 0; i < parsedColleges.length; i++) {
      const college = parsedColleges[i];
      const rowNumber = i + 2; // +2 for header and 0-index
      
      try {
        // Check if college already exists by college_id
        const existingCollege = await firebaseService.getCollegeById(college.college_id);
        
        if (existingCollege) {
          // Skip existing college
          results.skipped++;
          results.details.push({
            rowNumber,
            collegeName: college.college_name,
            collegeId: college.college_id,
            status: 'skipped',
            reason: 'College ID already exists'
          });
        } else {
          // Parse comma-separated fields
          const supportedBoards = college.supported_boards
            ? college.supported_boards.split(',').map(b => b.trim()).filter(b => b.length > 0)
            : [];
          
          const subjects = college.subjects
            ? college.subjects.split(',').map(s => s.trim()).filter(s => s.length > 0)
            : [];
          
          const validClasses = college.valid_classes
            ? college.valid_classes.split(',').map(c => c.trim()).filter(c => c.length > 0)
            : [];
          
          const examTypes = college.exam_types
            ? college.exam_types.split(',').map(e => e.trim()).filter(e => e.length > 0)
            : [];
          
          const features = college.features
            ? college.features.split(',').map(f => f.trim()).filter(f => f.length > 0)
            : [];

          // Initialize board-wise counts
          const boardWiseCounts: Record<string, { totalStudents: number; totalTeachers: number }> = {};
          supportedBoards.forEach(board => {
            boardWiseCounts[board] = {
              totalStudents: 0,
              totalTeachers: 0
            };
          });

          // Prepare college data
          const collegeData = {
            collegeId: college.college_id,
            collegeName: college.college_name,
            academicYear: college.academicYear || 'April',
            address: college.address || '',
            city: college.city || '',
            state: college.state || '',
            pincode: college.pincode || '',
            phone: college.phone || '',
            email: college.email || '',
            website: college.website || '',
            establishedYear: college.established_year || null,
            collegeType: college.college_type || 'school',
            supportedBoards,
            subjects,
            validClasses,
            examTypes,
            features,
            boardWiseCounts,
            roleCounts: {
              system_admin: 0,
              admin: 0,
              principal: 0,
              dean: 0,
              teacher: 0,
              student: 0
            },
            totalTeachers: 0,
            totalStudents: 0,
            totalRooms: 0,
            status: 'active',
            createdBy: currentUser?.userId || currentUser?.uid || ''
          };

          // Add college to Firebase using Cloud Function
          const functions = getFunctions();
          const addCollegeFn = httpsCallable(functions, 'addCollege');
          await addCollegeFn(collegeData);
          
          results.success++;
          results.details.push({
            rowNumber,
            collegeName: college.college_name,
            collegeId: college.college_id,
            status: 'success'
          });
        }
      } catch (error: any) {
        console.error(`Error uploading college ${college.college_name}:`, error);
        results.failed++;
        results.details.push({
          rowNumber,
          collegeName: college.college_name,
          collegeId: college.college_id,
          status: 'failed',
          reason: error?.message || error?.details || 'Unknown error'
        });
      }

      // Update progress
      setUploadProgress(Math.round(((i + 1) / parsedColleges.length) * 100));
    }

    setUploadResults(results);
    setUploadStep('complete');
    
    // Always call onUploadComplete - results screen will show success/skipped/failed
    onUploadComplete();
  };

  // Handle close
  const handleClose = () => {
    setUploadStep('select');
    setParsedColleges([]);
    setUploadProgress(0);
    setUploadResults({ success: 0, skipped: 0, failed: 0, details: [] });
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />
      
      {/* Sidebar Panel - with margin and rounded corners matching UserProfile */}
      <div 
        className={`fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl z-[10001] transition-transform duration-200 ease-out rounded-2xl overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)] pointer-events-none'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header with gradient matching UserProfile style */}
          <div 
            className="relative overflow-hidden rounded-t-2xl px-6 py-5"
            style={{ 
              background: `linear-gradient(135deg, ${brandTheme.colors.primary} 0%, ${brandTheme.colors.secondary || brandTheme.colors.primary} 100%)`
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-4 left-8 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute bottom-4 right-8 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all flex items-center justify-center z-50"
            >
              <X size={18} />
            </button>

            {/* Header content */}
            <div className="relative z-10 flex items-center space-x-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Building2 size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Add University/College</h2>
                <p className="text-white/80 text-sm">Upload Excel file with college information</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
          
            {/* Notification */}
            {notification.visible && (
              <div className={`mb-4 p-4 rounded-xl flex items-start space-x-3 ${
                notification.type === 'error' ? 'bg-red-50 border border-red-200' :
                notification.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <AlertCircle size={20} className={
                  notification.type === 'error' ? 'text-red-500' :
                  notification.type === 'warning' ? 'text-yellow-500' :
                  'text-blue-500'
                } />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    notification.type === 'error' ? 'text-red-800' :
                    notification.type === 'warning' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <button
                  onClick={() => setNotification(prev => ({ ...prev, visible: false }))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            )}

          {/* Step 1: Select File */}
          {uploadStep === 'select' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Instructions</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Download the template and fill in college information</li>
                  <li>• Required fields: college_name, college_id</li>
                  <li>• Use comma-separated values for subjects, valid_classes, exam_types, features</li>
                  <li>• Existing colleges (by college_id) will be skipped</li>
                </ul>
              </div>

              {/* Download Template */}
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                <Download size={20} />
                <span className="font-medium">Download Excel Template</span>
              </button>

              {/* Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Upload size={28} className="text-indigo-600" />
                </div>
                <p className="text-gray-900 font-medium mb-1">
                  {isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-gray-500">Excel files only (.xlsx, .xls)</p>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {uploadStep === 'preview' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
                <FileSpreadsheet size={24} className="text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">
                    {parsedColleges.length} college(s) ready to upload
                  </p>
                  <p className="text-sm text-green-600">Review the data before uploading</p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Row</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">College Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">College ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">City</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedColleges.slice(0, 10).map((college, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600 font-mono">{idx + 2}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">{college.college_name}</td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                              {college.college_id}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{college.city || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{college.college_type || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedColleges.length > 10 && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500 text-center">
                    ... and {parsedColleges.length - 10} more college(s)
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setUploadStep('select');
                    setParsedColleges([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={uploadColleges}
                  className="flex-1 px-4 py-3 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary} 0%, ${brandTheme.colors.secondary || brandTheme.colors.primary} 100%)` }}
                >
                  Upload {parsedColleges.length} College(s)
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Uploading */}
          {uploadStep === 'uploading' && (
            <div className="space-y-6 text-center py-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-indigo-100 flex items-center justify-center">
                <Loader2 size={40} className="text-indigo-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Uploading Colleges...</h3>
                <p className="text-gray-600">Please wait while we process your data</p>
              </div>
              
              {/* Progress Bar */}
              <div className="max-w-md mx-auto">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${uploadProgress}%`,
                      background: `linear-gradient(135deg, ${brandTheme.colors.primary} 0%, ${brandTheme.colors.secondary || brandTheme.colors.primary} 100%)`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {uploadStep === 'complete' && (
            <div className="space-y-6">
              {/* Status Header */}
              <div className="text-center py-4">
                {uploadResults.success > 0 && uploadResults.failed === 0 && uploadResults.skipped === 0 ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={48} className="text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Complete!</h3>
                    <p className="text-gray-600">All {uploadResults.success} colleges were uploaded successfully</p>
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
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">College Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
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
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{detail.collegeName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                  {detail.collegeId}
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
                className="w-full px-4 py-3 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary} 0%, ${brandTheme.colors.secondary || brandTheme.colors.primary} 100%)` }}
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