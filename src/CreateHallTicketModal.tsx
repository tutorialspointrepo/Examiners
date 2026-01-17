import { useState, useEffect, useRef } from 'react';
import { useBrand } from './BrandContext';
import { type UserModel } from './services/firebase_service';
import { 
  checkSlotConflict, 
  createRoomBooking,
  getCurrentAcademicYear,
  getClassesByCollege,
  getRoomsByCollege,
  getStudentsByClass,
  getExamTypesByCollege,
  createHallTicketGroup,
  type RoomBookingRequest 
} from './services/roomSchedulingService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faXmark,
  faCalendar,
  faUsers,
  faCheckCircle,
  faGraduationCap,
  faCheck,
  faExclamationTriangle,
  faTrash,
  faDoorOpen,
  faChevronDown,
  faIdCard,
  faClipboardList,
  faClock,
  faCalendarDays,
  faSchool
} from '@fortawesome/sharp-light-svg-icons';

interface HallTicketStudent {
  studentId: string;
  studentName: string;
  rollNumber: string;
  email: string;
  hallTicketSent: boolean;
  hallTicketSentDate?: string;
  hallTicketStatus: 'active' | 'suspended' | 'revoked';
  hallTicketNumber: string;
  seatNumber: string;
  roomId?: string;
  roomName?: string;
  roomAddress?: string;
}

interface Room {
  id: string;
  roomName: string;
  roomAddress: string;
  capacity: number;
  building?: string;
  floor?: string;
  roomType?: string;
  isAvailable?: boolean;
  bookedSlots?: any[];
  sittingMatrix?: string;
}

interface ClassInfo {
  id: string;
  className: string;
  board: string;
  academicYear: string;
  studentCount: number;
}

interface ExamType {
  id: string;
  name: string;
  color: string;
  icon?: any;
}

interface CreateHallTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hallTicketGroup: any) => void;
  currentUser: UserModel;
  activeCollegeId?: string;
  activeCollegeName?: string;
}

// Default exam timings
const DEFAULT_EXAM_START_TIME = '09:00';
const DEFAULT_EXAM_END_TIME = '17:00';

const CreateHallTicketModal: React.FC<CreateHallTicketModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentUser,
  activeCollegeId,
  activeCollegeName
}) => {
  const brand = useBrand();
  
  // Refs for click-outside detection
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const examTypeDropdownRef = useRef<HTMLDivElement>(null);
  const roomDropdownRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [selectedExamType, setSelectedExamType] = useState<ExamType | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
  const [academicYear, setAcademicYear] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [examStartTime, setExamStartTime] = useState<string>(DEFAULT_EXAM_START_TIME);
  const [examEndTime, setExamEndTime] = useState<string>(DEFAULT_EXAM_END_TIME);
  
  // Dropdown states
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showExamTypeDropdown, setShowExamTypeDropdown] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  
  // Data lists
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  
  // Validation state
  const [roomCapacityError, setRoomCapacityError] = useState<string | null>(null);
  
  // Result dialog state
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [resultType, setResultType] = useState<'success' | 'error'>('success');
  const [resultMessage, setResultMessage] = useState<string>('');
  const [hallTicketGroupId, setHallTicketGroupId] = useState<string>('');
  const [createdHallTicket, setCreatedHallTicket] = useState<any>(null);
  
  // Debug: Log when dialog state changes
  useEffect(() => {
    console.log('🔔 Dialog state changed:', { showResultDialog, resultType, resultMessage });
  }, [showResultDialog, resultType, resultMessage]);
  
  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setShowClassDropdown(false);
      }
      if (examTypeDropdownRef.current && !examTypeDropdownRef.current.contains(event.target as Node)) {
        setShowExamTypeDropdown(false);
      }
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target as Node)) {
        setShowRoomDropdown(false);
      }
    };
    
    if (showClassDropdown || showExamTypeDropdown || showRoomDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showClassDropdown, showExamTypeDropdown, showRoomDropdown]);
  
  // Load initial data
  useEffect(() => {
    if (isOpen && activeCollegeId) {
      loadInitialData();
    }
  }, [isOpen, activeCollegeId]);
  
  // Load initial data (classes and exam types from college)
  const loadInitialData = async () => {
    if (!activeCollegeId) return;
    
    try {
      setLoading(true);
      
      // Set current academic year
      const currentYear = getCurrentAcademicYear();
      setAcademicYear(currentYear);
      
      // Load classes from college document
      console.log('📚 Loading classes for college:', activeCollegeId);
      const classesData = await getClassesByCollege(activeCollegeId);
      console.log('✅ Classes loaded:', classesData.length);
      setClasses(classesData);
      
      // Load exam types from college document
      console.log('📋 Loading exam types for college:', activeCollegeId);
      const examTypesData = await getExamTypesByCollege(activeCollegeId);
      console.log('✅ Exam types loaded:', examTypesData.length);
      setExamTypes(examTypesData);
      
    } catch (err) {
      console.error('❌ Error loading initial data:', err);
      setError('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };
  
  // Load rooms when dates are selected
  useEffect(() => {
    if (startDate && endDate && activeCollegeId) {
      loadRoomsWithAvailability();
    }
  }, [startDate, endDate, activeCollegeId, examStartTime, examEndTime]);
  
  // Load rooms with real-time availability check
  const loadRoomsWithAvailability = async () => {
    if (!activeCollegeId || !startDate || !endDate) return;
    
    try {
      setCheckingAvailability(true);
      console.log('🏢 Loading rooms for college:', activeCollegeId);
      
      const allRooms = await getRoomsByCollege(activeCollegeId);
      console.log('✅ Rooms loaded:', allRooms.length);
      
      const roomsWithAvailability = await Promise.all(
        allRooms.map(async (room) => {
          try {
            const conflict = await checkSlotConflict(
              room.id,
              activeCollegeId,
              startDate,
              endDate,
              examStartTime,
              examEndTime
            );
            
            return {
              ...room,
              isAvailable: !conflict.hasConflict,
              bookedSlots: conflict.conflictingBookings || []
            };
          } catch (error) {
            console.error(`Error checking availability for room ${room.id}:`, error);
            return {
              ...room,
              isAvailable: false,
              bookedSlots: []
            };
          }
        })
      );
      
      console.log('✅ Room availability checked:', roomsWithAvailability.length);
      setRooms(roomsWithAvailability);
      
    } catch (err) {
      console.error('❌ Error loading rooms:', err);
      setError('Failed to load rooms');
    } finally {
      setCheckingAvailability(false);
    }
  };
  
  // Load students from Firebase when class is selected
  const loadStudents = async (classInfo: ClassInfo) => {
    if (!activeCollegeId) return;
    
    try {
      setLoading(true);
      console.log('👨‍🎓 Loading students for class:', classInfo.className);
      
      const studentsData = await getStudentsByClass(
        classInfo.className,
        activeCollegeId,
        classInfo.board,
        classInfo.academicYear
      );
      
      console.log('✅ Students loaded:', studentsData.length);
      setStudents(studentsData);
      
    } catch (err) {
      console.error('❌ Error loading students:', err);
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle class selection
  const handleClassSelect = (classInfo: ClassInfo) => {
    setSelectedClass(classInfo);
    setShowClassDropdown(false);
    setSelectedRooms([]);
    loadStudents(classInfo);
  };
  
  // Handle room selection
  const handleRoomSelect = (room: Room) => {
    if (!room.isAvailable) return;
    
    const isAlreadySelected = selectedRooms.some(r => r.id === room.id);
    
    if (isAlreadySelected) {
      // Allow removing rooms
      setSelectedRooms(selectedRooms.filter(r => r.id !== room.id));
    } else {
      // Check if capacity is already sufficient
      const currentCapacity = selectedRooms.reduce((sum, r) => sum + r.capacity, 0);
      const studentCount = students.length;
      
      if (currentCapacity >= studentCount) {
        // Capacity already sufficient - show error
        setError(`Capacity already sufficient! Current: ${currentCapacity} students, Required: ${studentCount} students. Remove existing rooms to select different ones.`);
        setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
        return;
      }
      
      // Add room
      setSelectedRooms([...selectedRooms, room]);
    }
  };
  
  // Remove a selected room
  const removeRoom = (roomId: string) => {
    setSelectedRooms(selectedRooms.filter(r => r.id !== roomId));
  };
  
  // Check if rooms are sufficient
  const checkRoomCapacity = (): boolean => {
    if (!selectedClass || selectedRooms.length === 0) return false;
    
    const totalCapacity = selectedRooms.reduce((sum, room) => sum + room.capacity, 0);
    const studentCount = students.length;
    
    if (totalCapacity < studentCount) {
      setRoomCapacityError(`Selected rooms can accommodate ${totalCapacity} students, but you have ${studentCount} students. Please select more rooms.`);
      return false;
    }
    
    setRoomCapacityError(null);
    return true;
  };
  
  // Generate hall ticket number
  const generateHallTicketNumber = (studentIndex: number): string => {
    const year = academicYear.split('-')[0];
    const classCode = selectedClass?.className.replace(/[^A-Z0-9]/g, '');
    const examCode = selectedExamType?.id.toUpperCase().substring(0, 3);
    const studentNum = String(studentIndex + 1).padStart(4, '0');
    return `HT-${year}-${classCode}-${examCode}-${studentNum}`;
  };
  
  // Parse sitting matrix to generate seat numbers
  const parseSittingMatrix = (sittingMatrix: string): string[] => {
    try {
      // Format: "10x2+4+2" means 10 rows with columns [2, 4, 2]
      const [rowsPart, columnsPart] = sittingMatrix.split('x');
      const rows = parseInt(rowsPart);
      
      // Parse column sections (e.g., "2+4+2" -> [2, 4, 2])
      const columnSections = columnsPart.split('+').map(n => parseInt(n));
      const totalColumns = columnSections.reduce((sum, n) => sum + n, 0);
      
      const seats: string[] = [];
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      
      // Generate column labels considering sections
      let columnIndex = 0;
      const columnLabels: string[] = [];
      
      for (const sectionColumns of columnSections) {
        for (let col = 0; col < sectionColumns; col++) {
          columnLabels.push(letters[columnIndex]);
          columnIndex++;
        }
      }
      
      // Generate seats: Column + Row format (A1, B1, C1, ... A2, B2, C2, ...)
      for (let row = 1; row <= rows; row++) {
        for (const columnLabel of columnLabels) {
          const seatNumber = `${columnLabel}${row}`;
          seats.push(seatNumber);
        }
      }
      
      console.log(`📐 Parsed matrix ${sittingMatrix}: ${rows} rows × ${totalColumns} columns = ${seats.length} seats`);
      console.log(`🪑 Sample seats: ${seats.slice(0, 5).join(', ')}...${seats.slice(-5).join(', ')}`);
      
      return seats;
    } catch (error) {
      console.error('Error parsing sitting matrix:', sittingMatrix, error);
      return [];
    }
  };
  
  // Generate all available seats across all rooms
  const generateAllSeats = (): Array<{ seatNumber: string; roomId: string; roomName: string; roomAddress: string }> => {
    const allSeats: Array<{ seatNumber: string; roomId: string; roomName: string; roomAddress: string }> = [];
    
    for (const room of selectedRooms) {
      // Check if room has sitting_matrix
      const sittingMatrix = (room as any).sittingMatrix || (room as any).sitting_matrix;
      
      if (sittingMatrix) {
        // Parse sitting matrix to get seat numbers
        const roomSeats = parseSittingMatrix(sittingMatrix);
        console.log(`🪑 Room ${room.roomName}: Generated ${roomSeats.length} seats from matrix ${sittingMatrix}`);
        
        roomSeats.forEach(seatNumber => {
          allSeats.push({
            seatNumber,
            roomId: room.id,
            roomName: room.roomName || room.roomAddress,
            roomAddress: room.roomAddress || ''
          });
        });
      } else {
        // Fallback: Generate simple seat numbers based on capacity
        console.warn(`⚠️ Room ${room.roomName} has no sitting_matrix, using capacity-based seats`);
        const capacity = room.capacity || 30;
        
        for (let i = 1; i <= capacity; i++) {
          allSeats.push({
            seatNumber: `S-${String(i).padStart(3, '0')}`,
            roomId: room.id,
            roomName: room.roomName || room.roomAddress,
            roomAddress: room.roomAddress || ''
          });
        }
      }
    }
    
    console.log(`🪑 Total seats available across all rooms: ${allSeats.length}`);
    return allSeats;
  };
  
  // Book rooms using real API
  const bookRooms = async (): Promise<string[]> => {
    if (!activeCollegeId || !currentUser) {
      throw new Error('Missing college or user information');
    }
    
    console.log('🔖 Booking rooms sequentially:', selectedRooms.length);
    console.log('🔖 Booking details:', {
      startDate,
      endDate,
      startTime: examStartTime,
      endTime: examEndTime
    });
    
    const bookingIds: string[] = [];
    const failedBookings: { room: string; error: string }[] = [];
    
    // Book rooms sequentially to avoid race conditions
    for (let i = 0; i < selectedRooms.length; i++) {
      const room = selectedRooms[i];
      console.log(`🔖 Booking room ${i + 1}/${selectedRooms.length}: ${room.roomName} (${room.id})`);
      
      const bookingRequest: RoomBookingRequest = {
        roomId: room.id,
        collegeId: activeCollegeId,
        userId: currentUser.userId || '',
        userName: (currentUser as any).name || (currentUser as any).userName || '',
        userEmail: currentUser.email || '',
        purpose: `Hall Ticket Examination - ${selectedClass?.className} - ${selectedExamType?.name}`,
        startDate: startDate,
        endDate: endDate,
        startTime: examStartTime,
        endTime: examEndTime,
        notes: `Hall tickets for ${students.length} students`,
        participantCount: students.length
      };
      
      const result = await createRoomBooking(bookingRequest);
      
      if (result.success && result.bookingId) {
        console.log(`✅ Room ${room.roomName} booked successfully: ${result.bookingId}`);
        bookingIds.push(result.bookingId);
      } else {
        console.error(`❌ Failed to book room ${room.roomName}:`, result.error);
        failedBookings.push({ room: room.roomName, error: result.error || 'Unknown error' });
      }
    }
    
    if (failedBookings.length > 0) {
      const errorMessages = failedBookings.map(f => `${f.room}: ${f.error}`).join('; ');
      throw new Error(`Failed to book rooms: ${errorMessages}`);
    }
    
    console.log('✅ All rooms booked successfully:', bookingIds.length);
    
    return bookingIds;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedClass) {
      setError('Please select a class');
      return;
    }
    
    if (!selectedExamType) {
      setError('Please select an exam type');
      return;
    }
    
    if (selectedRooms.length === 0) {
      setError('Please select at least one room');
      return;
    }
    
    if (!startDate || !endDate) {
      setError('Please select validity dates');
      return;
    }
    
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }
    
    if (!examStartTime || !examEndTime) {
      setError('Please select exam timings');
      return;
    }
    
    if (!checkRoomCapacity()) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('📝 Creating hall ticket group...');
      console.log('🔖 Booking rooms...');
      const roomBookingIds = await bookRooms();
      console.log('✅ Rooms booked successfully:', roomBookingIds);
      
      // Log what we actually have in students array
      console.log('👥 Students array length:', students.length);
      if (students.length > 0) {
        console.log('👥 First student object:', students[0]);
        console.log('👥 First student keys:', Object.keys(students[0]));
      }
      
      // Generate all available seats across selected rooms
      console.log('🪑 Generating seat assignments...');
      const availableSeats = generateAllSeats();
      
      if (availableSeats.length < students.length) {
        console.error('❌ Not enough seats for all students!');
        throw new Error(`Not enough seats! Need ${students.length} seats but only ${availableSeats.length} available.`);
      }
      
      // Assign seats to students
      const hallTicketStudents: HallTicketStudent[] = students.map((student, index) => {
        const assignedSeat = availableSeats[index];
        
        return {
          studentId: student.userId,
          studentName: student.fullName,
          rollNumber: student.studentRoll,
          email: student.email || '',
          hallTicketSent: false,
          hallTicketStatus: 'active',
          hallTicketNumber: generateHallTicketNumber(index),
          seatNumber: assignedSeat.seatNumber,
          roomId: assignedSeat.roomId,
          roomName: assignedSeat.roomName,
          roomAddress: assignedSeat.roomAddress
        };
      });
      
      console.log('✅ Seat assignments completed:', {
        totalStudents: hallTicketStudents.length,
        firstStudent: hallTicketStudents[0],
        lastStudent: hallTicketStudents[hallTicketStudents.length - 1]
      });
      
      // Build hall ticket group with only defined fields
      const hallTicketGroup: any = {
        hallTicketsGroupId: `HT-GROUP-${Date.now()}`,
        studentClass: selectedClass.className,
        classId: selectedClass.id,
        examType: selectedExamType.name,
        examTypeId: selectedExamType.id,
        academicYear: academicYear,
        numberOfStudents: students.length,
        examStartDate: startDate,  // Added examStartDate
        startDate: startDate,
        endDate: endDate,
        examStartTime: examStartTime,
        examEndTime: examEndTime,
        roomBookingIds: roomBookingIds,
        rooms: selectedRooms.map(room => ({
          room_id: room.id,
          room_name: room.roomName,
          room_address: room.roomAddress,
          room_capacity: room.capacity,
          room_type: room.roomType || ''
        })),
        students: hallTicketStudents,
        createdAt: new Date().toISOString(),
        status: 'active'
      };
      
      // Add optional fields only if defined
      if (selectedClass.board !== undefined) hallTicketGroup.board = selectedClass.board;
      if (activeCollegeId !== undefined) hallTicketGroup.collegeId = activeCollegeId;
      if (activeCollegeName !== undefined) hallTicketGroup.collegeName = activeCollegeName;
      if ((currentUser as any).name !== undefined) hallTicketGroup.createdBy = (currentUser as any).name;
      if ((currentUser as any).id !== undefined) hallTicketGroup.createdById = (currentUser as any).id;
      if ((currentUser as any).role !== undefined) hallTicketGroup.createdByRole = (currentUser as any).role;
      
      console.log('📦 Hall Ticket Group object:', JSON.stringify(hallTicketGroup, null, 2));
      
      console.log('💾 Saving to Firebase...');
      const result = await createHallTicketGroup(hallTicketGroup);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create hall tickes');
      }
      
      console.log('✅ Hall Ticket Group Created:', result.id);
      
      // Store the created hall ticket data
      const createdData = {
        ...hallTicketGroup,
        id: result.id
      };
      setCreatedHallTicket(createdData);
      
      // Show success dialog FIRST (before calling onSave)
      // Use setTimeout to ensure React processes the state update
      console.log('🎉 Showing success dialog...');
      setHallTicketGroupId(hallTicketGroup.hallTicketsGroupId);
      setResultType('success');
      setResultMessage(`Hall Ticket Group created successfully!\n\nGroup ID: ${hallTicketGroup.hallTicketsGroupId}\n${students.length} students assigned\n${selectedRooms.length} room(s) booked`);
      
      // Force dialog to show after a brief delay to ensure render
      setTimeout(() => {
        setShowResultDialog(true);
        console.log('🎉 Dialog state set:', { showResultDialog: true, resultType: 'success' });
      }, 100);
      
    } catch (err: any) {
      console.error('❌ Error creating hall ticket group:', err);
      
      // Show error dialog
      console.log('❌ Showing error dialog...');
      setResultType('error');
      setResultMessage(err.message || 'Failed to create hall tickets. Please try again.');
      
      // Force dialog to show after a brief delay to ensure render
      setTimeout(() => {
        setShowResultDialog(true);
        console.log('❌ Dialog state set:', { showResultDialog: true, resultType: 'error' });
      }, 100);
    } finally {
      // Delay setting loading to false to not interfere with dialog
      setTimeout(() => {
        setLoading(false);
      }, 150);
    }
  };
  
  // Handle result dialog OK button
  const handleResultDialogOk = () => {
    setShowResultDialog(false);
    if (resultType === 'success') {
      // Call onSave with the created data
      if (createdHallTicket) {
        onSave(createdHallTicket);
      }
      resetForm();
      onClose();
    }
  };
  
  // Reset form
  const resetForm = () => {
    setSelectedClass(null);
    setSelectedExamType(null);
    setSelectedRooms([]);
    setAcademicYear('');
    setStartDate('');
    setEndDate('');
    setExamStartTime(DEFAULT_EXAM_START_TIME);
    setExamEndTime(DEFAULT_EXAM_END_TIME);
    setStudents([]);
    setError(null);
    setRoomCapacityError(null);
  };
  
  // Close modal
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  // Calculate total capacity
  const getTotalCapacity = (): number => {
    return selectedRooms.reduce((sum, room) => sum + room.capacity, 0);
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
      
      {/* Main Modal */}
      <div className={`fixed inset-0 z-[9999] flex items-start justify-start p-2 transition-opacity duration-300 ${
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
        {/* Header with Gradient */}
        <div 
          className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
          style={{ 
            background: `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.secondary} 100%)`
          }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <FontAwesomeIcon icon={faIdCard} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Create Hall Tickets
              </h2>
              <p className="text-xs text-white/80">
                Generate hall tickets and book examination rooms
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
          >
            <FontAwesomeIcon icon={faXmark} className="text-white" />
          </button>
        </div>
        
        {/* Body with Sections */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 shadow-sm">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 text-lg mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          )}
          
          {/* Section 1: Academic Year */}
          <div className="mb-6">
            <div className="flex items-center space-x-3 mb-5">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                style={{ background: brand.gradients.primary }}
              >
                <FontAwesomeIcon icon={faCalendarDays} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Academic Information</h3>
                <p className="text-sm text-gray-500">Current academic year for hall tickets</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                <FontAwesomeIcon icon={faGraduationCap} className="text-indigo-500" />
                <span>Academic Year</span>
              </label>
              <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Session</p>
                    <p className="text-2xl font-bold text-indigo-600">{academicYear || 'Loading...'}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <FontAwesomeIcon icon={faCalendarDays} className="text-indigo-600 text-xl" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Section 2: Class & Exam Type */}
          <div className="mb-6">
            <div className="flex items-center space-x-2.5 mb-3">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)' }}
              >
                <FontAwesomeIcon icon={faSchool} size="sm" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Class & Examination Details</h3>
                <p className="text-xs text-gray-500">Select the class and type of examination</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
              {/* Class Selection */}
              <div>
                <label className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faGraduationCap} className="text-purple-500" size="sm" />
                  <span>Select Class *</span>
                </label>
                <div className="relative" ref={classDropdownRef}>
                  <button
                    onClick={() => setShowClassDropdown(!showClassDropdown)}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-left hover:border-gray-300 focus:outline-none focus:ring-2 transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      ['--focus-ring-color' as any]: brand.colors.primary + '40'
                    }}
                  >
                    <span className={selectedClass ? 'text-gray-900 font-medium text-base' : 'text-gray-400'}>
                      {selectedClass ? `${selectedClass.className} (${students.length || selectedClass.studentCount} students)` : loading ? 'Loading classes...' : 'Choose a class...'}
                    </span>
                    <FontAwesomeIcon 
                      icon={faChevronDown} 
                      className={`text-gray-400 transition-transform ${showClassDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>
                  
                  {showClassDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                      {classes.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No classes available
                        </div>
                      ) : (
                        classes.map((classInfo) => (
                          <button
                            key={classInfo.id}
                            onClick={() => handleClassSelect(classInfo)}
                            className="w-full px-5 py-4 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all border-b border-gray-100 last:border-b-0 flex items-center justify-between group"
                          >
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-purple-700 text-base">
                                {classInfo.className}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {classInfo.board} • {classInfo.academicYear}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                              {classInfo.studentCount} students
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Exam Type Selection */}
              <div>
                <label className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faClipboardList} className="text-blue-500" size="sm" />
                  <span>Select Exam Type *</span>
                </label>
                <div className="relative" ref={examTypeDropdownRef}>
                  <button
                    onClick={() => setShowExamTypeDropdown(!showExamTypeDropdown)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-left hover:border-gray-300 focus:outline-none focus:ring-2 transition-all flex items-center justify-between"
                    style={{
                      ['--focus-ring-color' as any]: brand.colors.primary + '40'
                    }}
                  >
                    <span className={selectedExamType ? 'text-gray-900 font-medium text-base' : 'text-gray-400'}>
                      {selectedExamType ? selectedExamType.name : 'Choose exam type...'}
                    </span>
                    <FontAwesomeIcon 
                      icon={faChevronDown} 
                      className={`text-gray-400 transition-transform ${showExamTypeDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>
                  
                  {showExamTypeDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                      {examTypes.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No exam types available
                        </div>
                      ) : (
                        examTypes.map((examType) => (
                          <button
                            key={examType.id}
                            onClick={() => {
                              setSelectedExamType(examType);
                              setShowExamTypeDropdown(false);
                            }}
                            className="w-full px-5 py-4 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all border-b border-gray-100 last:border-b-0 flex items-center space-x-3 group"
                          >
                            <div 
                              className="w-4 h-4 rounded-full shadow-sm"
                              style={{ backgroundColor: `var(--color-${examType.color}-500, #6B7280)` }}
                            />
                            <span className="font-semibold text-gray-900 group-hover:text-blue-700">{examType.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Section 3: Timing & Schedule */}
          <div className="mb-6">
            <div className="flex items-center space-x-2.5 mb-3">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' }}
              >
                <FontAwesomeIcon icon={faClock} size="sm" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Examination Schedule</h3>
                <p className="text-xs text-gray-500">Set dates and times for the examination</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faCalendar} className="text-orange-500" size="sm" />
                    <span>Validity Start Date *</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm"
                    style={{
                      colorScheme: 'light'
                    }}
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faCalendar} className="text-red-500" size="sm" />
                    <span>Validity End Date *</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm"
                    style={{
                      colorScheme: 'light'
                    }}
                  />
                </div>
              </div>
              
              {/* Exam Timings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faClock} className="text-blue-500" size="sm" />
                    <span>Exam Start Time *</span>
                  </label>
                  <input
                    type="time"
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm"
                    style={{
                      colorScheme: 'light'
                    }}
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faClock} className="text-indigo-500" size="sm" />
                    <span>Exam End Time *</span>
                  </label>
                  <input
                    type="time"
                    value={examEndTime}
                    onChange={(e) => setExamEndTime(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm"
                    style={{
                      colorScheme: 'light'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Section 4: Room Selection */}
          <div className="mb-6">
            <div className="flex items-center space-x-2.5 mb-3">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                <FontAwesomeIcon icon={faDoorOpen} size="sm" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Room Allocation</h3>
                <p className="text-xs text-gray-500">
                  Select examination rooms 
                  {students.length > 0 && (
                    <span className="text-blue-600 font-medium ml-1">
                      ({students.length} students need accommodation)
                    </span>
                  )}
                  {checkingAvailability && (
                    <span className="text-blue-600 font-medium ml-1 animate-pulse">
                      • Checking availability...
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              {!startDate || !endDate ? (
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 flex items-center space-x-2">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500 text-xl" />
                  <div>
                    <p className="font-semibold">Date Selection Required</p>
                    <p className="text-yellow-700 mt-1">Please select start and end dates first to check room availability</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Selected Rooms */}
                  {selectedRooms.length > 0 && (
                    <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-bold text-gray-800">Selected Rooms</h4>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-semibold text-gray-600 bg-white px-4 py-2 rounded-lg shadow-sm">
                            Total Capacity: <span className={getTotalCapacity() >= students.length ? 'text-green-600' : 'text-red-600'}>
                              {getTotalCapacity()}
                            </span>
                            {students.length > 0 && (
                              <span className="text-gray-500"> / {students.length}</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {selectedRooms.map((room) => (
                          <div 
                            key={room.id}
                            className="flex items-center justify-between bg-white p-4 rounded-xl border border-green-100 hover:border-green-200 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <FontAwesomeIcon icon={faDoorOpen} className="text-green-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {room.roomName}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {room.building && `${room.building} • `}
                                  {room.floor && `${room.floor} • `}
                                  Room {room.roomAddress}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                                {room.capacity} seats
                              </span>
                              <button
                                onClick={() => removeRoom(room.id)}
                                className="w-9 h-9 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-all flex items-center justify-center"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {roomCapacityError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center space-x-2">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      <span>{roomCapacityError}</span>
                    </div>
                  )}
                  
                  {/* Room Dropdown */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-3 block">
                      {selectedRooms.length > 0 ? 'Add More Rooms' : 'Select Rooms'} *
                    </label>
                    
                    {/* Capacity Sufficient Info */}
                    {selectedRooms.length > 0 && getTotalCapacity() >= students.length && (
                      <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-green-700">
                          <span className="font-semibold">Capacity Sufficient!</span> You have {getTotalCapacity()} seats for {students.length} students. Remove existing rooms to select different ones.
                        </div>
                      </div>
                    )}
                    
                    <div className="relative" ref={roomDropdownRef}>
                      <button
                        onClick={() => setShowRoomDropdown(!showRoomDropdown)}
                        disabled={checkingAvailability}
                        className="w-full px-5 py-4 bg-white border border-gray-200 rounded-xl text-left hover:border-gray-300 focus:outline-none focus:ring-2 transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          ['--focus-ring-color' as any]: brand.colors.primary + '40'
                        }}
                      >
                        <span className="text-gray-400">
                          {checkingAvailability ? 'Checking availability...' : selectedRooms.length > 0 ? 'Add more rooms...' : 'Choose rooms...'}
                        </span>
                        <FontAwesomeIcon 
                          icon={faChevronDown} 
                          className={`text-gray-400 transition-transform ${showRoomDropdown ? 'rotate-180' : ''}`}
                        />
                      </button>
                      
                      {showRoomDropdown && !checkingAvailability && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                          {rooms.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                              No rooms available
                            </div>
                          ) : (
                            rooms.map((room) => {
                              const isSelected = selectedRooms.some(r => r.id === room.id);
                              const isUnavailable = !room.isAvailable;
                              
                              // Check if capacity is already sufficient (only for non-selected rooms)
                              const currentCapacity = selectedRooms.reduce((sum, r) => sum + r.capacity, 0);
                              const studentCount = students.length;
                              const isCapacitySufficient = !isSelected && currentCapacity >= studentCount;
                              const isDisabled = isUnavailable || isCapacitySufficient;
                              
                              return (
                                <button
                                  key={room.id}
                                  onClick={() => handleRoomSelect(room)}
                                  disabled={isDisabled}
                                  className={`w-full px-5 py-4 text-left transition-all border-b border-gray-100 last:border-b-0 flex items-center justify-between group ${
                                    isDisabled 
                                      ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                                      : isSelected 
                                        ? 'bg-green-50 hover:bg-green-100' 
                                        : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                      isSelected ? 'bg-green-100' : 'bg-gray-100'
                                    }`}>
                                      {isSelected ? (
                                        <FontAwesomeIcon icon={faCheck} className="text-green-600" />
                                      ) : (
                                        <FontAwesomeIcon icon={faDoorOpen} className="text-gray-400" />
                                      )}
                                    </div>
                                    <div>
                                      <div className={`font-semibold ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>
                                        {room.roomName}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {room.building && `${room.building} • `}
                                        {room.floor && `${room.floor} • `}
                                        Room {room.roomAddress}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                                      isSelected 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {room.capacity} seats
                                    </span>
                                    {isCapacitySufficient ? (
                                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                                        Capacity OK
                                      </span>
                                    ) : !room.isAvailable && (
                                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                                        Booked
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Summary Section */}
          {selectedClass && selectedRooms.length > 0 && students.length > 0 && (
            <div className="p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white">
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <h4 className="text-lg font-bold text-gray-900">Summary</h4>
              </div>
              <div className="space-y-3">
                {/* First Row - Class, Students, Exam Time */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Class</p>
                    <p className="font-bold text-gray-900">{selectedClass.className}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Students</p>
                    <p className="font-bold text-blue-600">{students.length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Exam Time</p>
                    <p className="font-bold text-gray-900 text-sm">{examStartTime} - {examEndTime}</p>
                  </div>
                </div>
                
                {/* Second Row - Rooms and Duration */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm col-span-2">
                    <p className="text-xs text-gray-500 mb-2">Rooms Selected ({selectedRooms.length}) • Capacity: <span className={`font-bold ${
                      getTotalCapacity() >= students.length ? 'text-green-600' : 'text-red-600'
                    }`}>{getTotalCapacity()}</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRooms.slice(0, 4).map((room) => (
                        <span 
                          key={room.id}
                          className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200"
                        >
                          <FontAwesomeIcon icon={faDoorOpen} className="mr-1.5 text-blue-500" size="sm" />
                          {room.roomName || room.roomAddress}
                        </span>
                      ))}
                      {selectedRooms.length > 4 && (
                        <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">
                          +{selectedRooms.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Duration</p>
                    <p className="font-bold text-gray-900 text-xs">{startDate} to {endDate}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with Actions */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end space-x-3 bg-gray-50 flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || checkingAvailability || !selectedClass || !selectedExamType || selectedRooms.length === 0 || !startDate || !endDate || students.length === 0}
            className="px-5 py-2 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
            style={{ background: brand.gradients.primary }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faCheck} className="text-xs" />
                <span>Create Hall Tickets</span>
              </>
            )}
          </button>
        </div>
      </div>
      </div>
      
      {/* Result Dialog - Rendered separately */}
      {showResultDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn">
            {/* Header */}
            <div 
              className="px-6 py-5 text-white relative overflow-hidden"
              style={{ 
                background: resultType === 'success' 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <FontAwesomeIcon 
                    icon={resultType === 'success' ? faCheckCircle : faExclamationTriangle} 
                    className="text-2xl"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {resultType === 'success' ? 'Success!' : 'Error'}
                  </h3>
                  <p className="text-sm text-white/90">
                    {resultType === 'success' ? 'Hall Ticket Group Created' : 'Creation Failed'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className={`p-4 rounded-xl mb-6 ${
                resultType === 'success' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`text-sm whitespace-pre-line ${
                  resultType === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {resultMessage}
                </p>
              </div>

              {/* Success details */}
              {resultType === 'success' && hallTicketGroupId && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FontAwesomeIcon icon={faIdCard} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Group ID</p>
                      <p className="font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded">
                        {hallTicketGroupId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FontAwesomeIcon icon={faUsers} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Students Assigned</p>
                      <p className="font-semibold text-gray-900">{students.length}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FontAwesomeIcon icon={faDoorOpen} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Rooms Booked</p>
                      <p className="font-semibold text-gray-900">{selectedRooms.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* OK Button */}
              <button
                onClick={handleResultDialogOk}
                className="w-full py-3 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl"
                style={{ 
                  background: resultType === 'success' 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateHallTicketModal;