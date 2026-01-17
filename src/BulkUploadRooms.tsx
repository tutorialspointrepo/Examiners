import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faXmark, 
  faUpload, 
  faDownload, 
  faCheckCircle, 
  faExclamationCircle, 
  faSpinner,
  faEye,
  faFileCircleInfo
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import * as XLSX from 'xlsx';
import { firebaseService } from './services/firebase_service';
import {
  ROOM_STATUS,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  UPLOAD_STEPS,
  NOTIFICATION_TYPES_UI,
  EXCEL_SHEET_NAMES,
  ROOM_TEMPLATE_FILENAME,
  EXCEL_COLUMN_WIDTHS,
  DELIMITERS,
  UI_TIMINGS,
  ROOM_PAGINATION,
  type RoomType,
  type UploadStep,
  type NotificationTypeUI
} from './constants';

interface BulkUploadRoomsProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollegeId: string;
  currentUser: any;
  onUploadComplete: () => void;
}

interface RoomRow {
  college_id?: string;
  room_name: string;
  room_type: RoomType | string;
  room_address: string;
  room_capacity: number;
  sitting_matrix: string;
  room_incharge?: string; // Pipe-separated user IDs/emails
}

export default function BulkUploadRooms({
  isOpen,
  onClose,
  activeCollegeId,
  currentUser,
  onUploadComplete
}: BulkUploadRoomsProps) {
  const brandTheme = useBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadStep, setUploadStep] = useState<UploadStep>(UPLOAD_STEPS.SELECT);
  const [parsedRooms, setParsedRooms] = useState<RoomRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [visibleRoomsCount, setVisibleRoomsCount] = useState(10);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  }>({ success: 0, failed: 0, errors: [] });
  const [isDragging, setIsDragging] = useState(false);
  
  const [notification, setNotification] = useState<{
    type: NotificationTypeUI;
    message: string;
    visible: boolean;
  }>({ type: NOTIFICATION_TYPES_UI.INFO, message: '', visible: false });

  const showNotification = (type: NotificationTypeUI, message: string) => {
    setNotification({ type, message, visible: true });
  };

  const loadMoreRooms = () => {
    setVisibleRoomsCount(prev => Math.min(prev + ROOM_PAGINATION.INCREMENT, parsedRooms.length));
  };

  useEffect(() => {
    if (notification.visible) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, UI_TIMINGS.NOTIFICATION_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [notification.visible]);

  useEffect(() => {
    if (!isOpen) {
      setNotification({ type: NOTIFICATION_TYPES_UI.INFO, message: '', visible: false });
    }
  }, [isOpen]);

  const downloadTemplate = () => {
    // Create main data sheet
    const mainData = [
      {
        room_name: 'Room 101',
        room_type: ROOM_TYPES.CLASSROOM,
        room_address: 'D Block, Campus',
        room_capacity: 24,
        sitting_matrix: '4x6',
        room_incharge: 'teacher@example.com (Teacher)|admin@example.com (Admin)'
      },
      {
        room_name: 'Auditorium',
        room_type: ROOM_TYPES.AUDITORIUM,
        room_address: 'Main Building',
        room_capacity: 200,
        sitting_matrix: '10x8+4+8',
        room_incharge: 'admin@example.com (Admin)'
      },
      {
        room_name: 'Computer Lab 201',
        room_type: ROOM_TYPES.COMPUTER_LAB,
        room_address: 'C Block, 2nd Floor',
        room_capacity: 40,
        sitting_matrix: '5x4+4',
        room_incharge: ''
      },
      {
        room_name: 'Library',
        room_type: ROOM_TYPES.LIBRARY,
        room_address: 'A Block, Ground Floor',
        room_capacity: 80,
        sitting_matrix: '10x2+4+2',
        room_incharge: ''
      },
      {
        room_name: 'Seminar Hall',
        room_type: ROOM_TYPES.SEMINAR_HALL,
        room_address: 'E Block, 1st Floor',
        room_capacity: 60,
        sitting_matrix: '10x3+3',
        room_incharge: 'faculty@example.com (Faculty)'
      }
    ];

    // Create Reference sheet with allowed values
    const referenceData = [
      { Category: 'Room Types', 'Allowed Values': '' },
      { Category: '', 'Allowed Values': ROOM_TYPES.CLASSROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.ADMIN_ROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.LIBRARY },
      { Category: '', 'Allowed Values': ROOM_TYPES.LAB },
      { Category: '', 'Allowed Values': ROOM_TYPES.COMPUTER_LAB },
      { Category: '', 'Allowed Values': ROOM_TYPES.SCIENCE_LAB },
      { Category: '', 'Allowed Values': ROOM_TYPES.HALL },
      { Category: '', 'Allowed Values': ROOM_TYPES.AUDITORIUM },
      { Category: '', 'Allowed Values': ROOM_TYPES.LOUNGE },
      { Category: '', 'Allowed Values': ROOM_TYPES.CONFERENCE_ROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.FACULTY_ROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.CAFETERIA },
      { Category: '', 'Allowed Values': ROOM_TYPES.SPORTS_ROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.MUSIC_ROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.ART_ROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.SEMINAR_HALL },
      { Category: '', 'Allowed Values': ROOM_TYPES.WORKSHOP },
      { Category: '', 'Allowed Values': ROOM_TYPES.STORAGE },
      { Category: '', 'Allowed Values': ROOM_TYPES.SERVER_ROOM },
      { Category: '', 'Allowed Values': ROOM_TYPES.MEDICAL_ROOM },
      { Category: '', 'Allowed Values': '' },
      { Category: 'Sitting Matrix Format', 'Allowed Values': '' },
      { Category: '', 'Allowed Values': 'Format: ROWSxCOL1+COL2+COL3...' },
      { Category: '', 'Allowed Values': 'ROWS = Number of rows' },
      { Category: '', 'Allowed Values': 'COL1, COL2, COL3 = Column sections (separated by spaces/aisles)' },
      { Category: '', 'Allowed Values': '' },
      { Category: 'Examples:', 'Allowed Values': '' },
      { Category: '4x6', 'Allowed Values': '4 rows, 6 columns in single section = 24 seats total' },
      { Category: '10x2+4+2', 'Allowed Values': '10 rows: 2 cols + (space) + 4 cols + (space) + 2 cols = 80 seats' },
      { Category: '10x8+4+8', 'Allowed Values': '10 rows: 8 cols + (space) + 4 cols + (space) + 8 cols = 200 seats' },
      { Category: '5x4+4', 'Allowed Values': '5 rows: 4 cols + (space) + 4 cols = 40 seats' },
      { Category: '10x3+3', 'Allowed Values': '10 rows: 3 cols + (space) + 3 cols = 60 seats' },
      { Category: '', 'Allowed Values': '' },
      { Category: 'Calculation:', 'Allowed Values': 'Total Seats = ROWS × (sum of all column sections)' },
      { Category: 'Example Calc:', 'Allowed Values': '10x2+4+2 = 10 × (2+4+2) = 10 × 8 = 80 seats' },
      { Category: '', 'Allowed Values': '' },
      { Category: 'Note:', 'Allowed Values': 'Capacity must match the total seats calculated from sitting matrix' },
    ];

    const ws = XLSX.utils.json_to_sheet(mainData);
    const wsRef = XLSX.utils.json_to_sheet(referenceData);

    // Set column widths for main sheet
    ws['!cols'] = [
      { wch: EXCEL_COLUMN_WIDTHS.LARGE },      // room_name
      { wch: EXCEL_COLUMN_WIDTHS.LARGE },      // room_type
      { wch: EXCEL_COLUMN_WIDTHS.LARGE },      // room_address
      { wch: EXCEL_COLUMN_WIDTHS.MEDIUM },     // room_capacity
      { wch: EXCEL_COLUMN_WIDTHS.MEDIUM },     // sitting_matrix
      { wch: EXCEL_COLUMN_WIDTHS.XLARGE }      // room_incharge
    ];

    // Set column widths for reference sheet
    wsRef['!cols'] = [
      { wch: EXCEL_COLUMN_WIDTHS.LARGE },
      { wch: EXCEL_COLUMN_WIDTHS.LARGE }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, EXCEL_SHEET_NAMES.ROOMS || 'Rooms');
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
    
    XLSX.writeFile(wb, ROOM_TEMPLATE_FILENAME);
    showNotification(NOTIFICATION_TYPES_UI.SUCCESS, 'Template downloaded successfully!');
  };

  const normalizeRoomType = (type: string): RoomType => {
    const normalized = type.toLowerCase().trim().replace(/\s+/g, '_');
    
    // Try to match with existing room types
    for (const [key, value] of Object.entries(ROOM_TYPES)) {
      if (value === normalized || key.toLowerCase() === normalized) {
        return value as RoomType;
      }
    }
    
    // Default to classroom if no match
    return ROOM_TYPES.CLASSROOM;
  };

  const handleFileSelect = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const validExtensions = ['xlsx', 'xls'];
    
    if (!validExtensions.includes(fileExtension)) {
      showNotification(NOTIFICATION_TYPES_UI.ERROR, 'Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet (assuming it's the Rooms sheet)
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (jsonData.length === 0) {
          showNotification(NOTIFICATION_TYPES_UI.ERROR, 'Excel file is empty');
          return;
        }

        // Validate required columns
        const firstRow = jsonData[0];
        const requiredColumns = ['room_name', 'room_type', 'room_address', 'room_capacity', 'sitting_matrix'];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          showNotification(
            NOTIFICATION_TYPES_UI.ERROR, 
            `Missing required columns: ${missingColumns.join(', ')}`
          );
          return;
        }

        // Parse and validate data
        const rooms: RoomRow[] = jsonData.map((row: any) => ({
          room_name: String(row.room_name || '').trim(),
          room_type: normalizeRoomType(String(row.room_type || ROOM_TYPES.CLASSROOM)),
          room_address: String(row.room_address || '').trim(),
          room_capacity: parseInt(String(row.room_capacity || 0)),
          sitting_matrix: String(row.sitting_matrix || '').trim(),
          room_incharge: String(row.room_incharge || '').trim()
        }));

        // Filter out invalid rows
        const validRooms = rooms.filter(room => 
          room.room_name && 
          room.room_capacity > 0 &&
          room.sitting_matrix
        );

        if (validRooms.length === 0) {
          showNotification(NOTIFICATION_TYPES_UI.ERROR, 'No valid rooms found in the file');
          return;
        }

        setParsedRooms(validRooms);
        setVisibleRoomsCount(ROOM_PAGINATION.INITIAL_COUNT);
        setUploadStep(UPLOAD_STEPS.PREVIEW);
        showNotification(
          NOTIFICATION_TYPES_UI.SUCCESS, 
          `Successfully parsed ${validRooms.length} room${validRooms.length !== 1 ? 's' : ''}`
        );

      } catch (error) {
        console.error('Error parsing Excel file:', error);
        showNotification(NOTIFICATION_TYPES_UI.ERROR, 'Failed to parse Excel file. Please check the format.');
      }
    };

    reader.onerror = () => {
      showNotification(NOTIFICATION_TYPES_UI.ERROR, 'Failed to read file');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    setUploadStep(UPLOAD_STEPS.UPLOADING);
    setUploadProgress(0);
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < parsedRooms.length; i++) {
      try {
        const room = parsedRooms[i];
        
        // Parse room_incharge from pipe-separated format
        const roomInchargeArray = room.room_incharge 
          ? room.room_incharge.split(DELIMITERS.PIPE).filter(id => id.trim())
          : [];

        // Create room data matching RoomModel interface
        const roomData = {
          college_id: activeCollegeId,
          room_name: room.room_name,
          room_type: normalizeRoomType(room.room_type as string),
          room_address: room.room_address,
          room_capacity: room.room_capacity,
          sitting_matrix: room.sitting_matrix,
          room_status: ROOM_STATUS.AVAILABLE, // Default status for new rooms
          room_schedule: [], // Empty schedule for bulk upload
          room_incharge: roomInchargeArray,
          created_by: currentUser?.uid || '',
        };

        const roomId = await firebaseService.addRoom(roomData);
        
        if (roomId) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Failed to upload room: ${room.room_name}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error uploading room ${parsedRooms[i].room_name}: ${error}`);
      }
      
      // Update progress
      setUploadProgress(Math.round(((i + 1) / parsedRooms.length) * 100));
    }

    setUploadResults(results);
    setUploadStep(UPLOAD_STEPS.COMPLETE);
    
    if (results.success > 0) {
      onUploadComplete();
    }
  };

  const reset = () => {
    setUploadStep(UPLOAD_STEPS.SELECT);
    setParsedRooms([]);
    setUploadProgress(0);
    setUploadResults({ success: 0, failed: 0, errors: [] });
    setVisibleRoomsCount(ROOM_PAGINATION.INITIAL_COUNT);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      
      <div className={`fixed inset-0 z-[10001] flex items-start justify-start p-2 transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
          onClick={onClose}
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
              <FontAwesomeIcon icon={faUpload} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Upload Rooms</h2>
              <p className="text-xs text-white/80">Import multiple rooms using Excel file</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={downloadTemplate}
              className="px-3 py-1.5 text-white/90 font-medium text-sm rounded-lg transition-all duration-200 flex items-center space-x-2 hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faDownload} className="text-sm" />
              <span>Download template</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white" />
            </button>
          </div>
        </div>

        {/* Notification Banner */}
        {notification.visible && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-lg border ${
            notification.type === NOTIFICATION_TYPES_UI.SUCCESS 
              ? 'bg-green-50 border-green-200 text-green-800'
              : notification.type === NOTIFICATION_TYPES_UI.ERROR
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon 
                icon={notification.type === NOTIFICATION_TYPES_UI.SUCCESS ? faCheckCircle : faExclamationCircle}
              />
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* Step 1: Upload File */}
          {uploadStep === UPLOAD_STEPS.SELECT && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border border-dashed rounded-2xl p-12 text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 scale-105'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div 
                  className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <FontAwesomeIcon icon={faUpload} size="2x" className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Upload Excel File
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Drag and drop your Excel file here, or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                  id="file-upload-rooms"
                />
                <label
                  htmlFor="file-upload-rooms"
                  className="inline-flex items-center space-x-2 px-8 py-3 text-white font-semibold rounded-xl cursor-pointer transition-all shadow-md hover:shadow-lg"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <span>Choose File</span>
                </label>
                <p className="text-xs text-gray-500 mt-4">
                  Supported: .xlsx, .xls
                </p>
              </div>

              {/* Important Instructions */}
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-5">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-pink-500 flex items-center justify-center">
                    <FontAwesomeIcon icon={faFileCircleInfo} className="text-white" size="lg" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-orange-600 mb-3">Important Instructions</h3>
                    <ul className="space-y-2.5 text-sm text-gray-700">
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span>
                          Check the <span className="font-bold">"Reference"</span> sheet for all allowed values
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span>
                          <span className="font-bold">Required columns:</span> room_name, room_type, room_address, room_capacity, sitting_matrix
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span>
                          <span className="font-bold">Optional:</span> room_incharge (use pipe separator for multiple: "email1 (role1)|email2 (role2)")
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span>
                          <span className="font-bold">Sitting matrix format:</span> ROWSxCOL1+COL2+COL3 (e.g., "4x6" = 4 rows × 6 cols, "10x2+4+2" = 10 rows with 2, 4, and 2 column sections separated by aisles)
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold mr-2">•</span>
                        <span>
                          <span className="font-bold">Room capacity:</span> Must be a positive number
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {uploadStep === UPLOAD_STEPS.PREVIEW && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <div className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" size="lg" />
                  <div>
                    <h3 className="font-bold text-green-900">File Parsed Successfully</h3>
                    <p className="text-sm text-green-700">
                      Found {parsedRooms.length} room{parsedRooms.length !== 1 ? 's' : ''} in the file
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Preview Rooms</h3>
                
                {parsedRooms.slice(0, visibleRoomsCount).map((room, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all bg-white">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Room Name</p>
                        <p className="text-sm font-medium text-gray-900">{room.room_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Room Type</p>
                        <p className="text-sm font-medium text-gray-900">
                          {ROOM_TYPE_LABELS[normalizeRoomType(room.room_type as string)]}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Address</p>
                        <p className="text-sm font-medium text-gray-900">{room.room_address}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Capacity</p>
                        <p className="text-sm font-medium text-gray-900">{room.room_capacity} seats</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Sitting Matrix</p>
                        <p className="text-sm font-medium text-gray-900">{room.sitting_matrix}</p>
                      </div>
                      {room.room_incharge && (
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Room In-charge</p>
                          <p className="text-sm font-medium text-gray-900">{room.room_incharge}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {visibleRoomsCount < parsedRooms.length && (
                  <button
                    onClick={loadMoreRooms}
                    className="w-full py-3 border border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all font-medium text-gray-700"
                  >
                    <FontAwesomeIcon icon={faEye} className="mr-2" />
                    Show More ({parsedRooms.length - visibleRoomsCount} remaining)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Uploading */}
          {uploadStep === UPLOAD_STEPS.UPLOADING && (
            <div className="flex flex-col items-center justify-center py-20">
              <FontAwesomeIcon 
                icon={faSpinner} 
                size="4x" 
                className="text-blue-600 mb-6" 
                spin
              />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Uploading Rooms...</h3>
              <p className="text-gray-600 mb-6">Please wait while we process your data</p>
              <div className="w-full max-w-md">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${uploadProgress}%`,
                      background: brandTheme.gradients.primary
                    }}
                  />
                </div>
                <p className="text-center text-sm text-gray-600 mt-2 font-medium">{uploadProgress}% Complete</p>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {uploadStep === UPLOAD_STEPS.COMPLETE && (
            <div className="space-y-6">
              <div className={`border rounded-xl p-6 ${
                uploadResults.failed === 0 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center space-x-3 mb-4">
                  {uploadResults.failed === 0 ? (
                    <FontAwesomeIcon icon={faCheckCircle} size="2x" className="text-green-600" />
                  ) : (
                    <FontAwesomeIcon icon={faExclamationCircle} size="2x" className="text-yellow-600" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Upload Complete</h3>
                    <p className="text-sm text-gray-700">
                      {uploadResults.success} room{uploadResults.success !== 1 ? 's' : ''} uploaded successfully
                      {uploadResults.failed > 0 && `, ${uploadResults.failed} failed`}
                    </p>
                  </div>
                </div>

                {uploadResults.errors.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-semibold text-gray-900">Errors:</h4>
                    <div className="bg-white border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                      {uploadResults.errors.map((error, index) => (
                        <p key={index} className="text-sm text-red-700 mb-1">• {error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-white border border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all font-medium text-gray-700"
                >
                  Upload More Rooms
                </button>
                <button
                  onClick={() => {
                    reset();
                    onClose();
                  }}
                  className="px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {uploadStep === UPLOAD_STEPS.PREVIEW && (
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex justify-between">
              <button
                onClick={reset}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="px-5 py-2 text-white font-semibold text-sm rounded-lg transition-all shadow-md hover:shadow-lg"
                style={{ background: brandTheme.gradients.primary }}
              >
                Upload {parsedRooms.length} Room{parsedRooms.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}