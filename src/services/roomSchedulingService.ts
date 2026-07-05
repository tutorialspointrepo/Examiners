// services/roomSchedulingService.ts - Firebase Firestore integration for room scheduling

import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { COLLECTIONS, USER_TYPES, USER_STATUS } from '../constants';

export interface RoomBookingRequest {
  roomId: string;
  collegeId: string;
  userId: string;
  userName: string;
  userEmail: string;
  purpose: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  notes?: string;
  participantCount?: number;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  roomName: string;
  collegeId: string;
  userId: string;
  userName: string;
  userEmail: string;
  purpose: string;
  startDateTime: string;
  endDateTime: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  participantCount?: number;
  createdAt: any;
  updatedAt: any;
}

export interface BookedSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  userName: string;
  userEmail: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

export interface AvailabilityResponse {
  success: boolean;
  date: string;
  bookedSlots: BookedSlot[];
  message?: string;
  error?: string;
}

export interface BookingResponse {
  success: boolean;
  bookingId?: string;
  message?: string;
  error?: string;
  booking?: RoomBooking;
}


/**
 * Get booked slots for a room on specific dates
 */
export const getRoomAvailability = async (
  roomId: string,
  collegeId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityResponse> => {
  try {
//     console.log('🔍 Fetching room availability:', { roomId, collegeId, startDate, endDate });

    const db = getFirestore();
    
    // Query bookings for the room within the date range
    const bookingsQuery = query(
      collection(db, COLLECTIONS.ROOM_BOOKINGS),
      where('roomId', '==', roomId),
      where('collegeId', '==', collegeId),
      where('status', 'in', ['pending', 'confirmed'])
    );

    const bookingsSnapshot = await getDocs(bookingsQuery);
//     console.log(`📊 Found ${bookingsSnapshot.size} active bookings for room ${roomId}`);
    
    const bookedSlots: BookedSlot[] = [];

    bookingsSnapshot.forEach((doc) => {
      const data = doc.data();
      
//       console.log(`📅 Checking booking ${doc.id}:`, {
//        dateRange: `${data.startDate} to ${data.endDate}`,
//        timeRange: `${data.startTime} to ${data.endTime}`,
//        purpose: data.purpose,
//        status: data.status
//      });
      
      // Check if this booking overlaps with our date range
      const bookingStartDate = data.startDate;
      const bookingEndDate = data.endDate;
      
      // Check if dates overlap: booking overlaps if it starts before our end and ends after our start
      if (bookingStartDate <= endDate && bookingEndDate >= startDate) {
//         console.log(`✅ Booking ${doc.id} overlaps with requested date range`);
        
        // Generate slots for each day in the booking that overlaps with our range
        const start = new Date(Math.max(new Date(data.startDate).getTime(), new Date(startDate).getTime()));
        const end = new Date(Math.min(new Date(data.endDate).getTime(), new Date(endDate).getTime()));
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          bookedSlots.push({
            id: doc.id,
            date: dateStr,
            startTime: data.startTime,
            endTime: data.endTime,
            purpose: data.purpose,
            userName: data.userName,
            userEmail: data.userEmail,
            userId: data.userId,
            status: data.status
          });
        }
      } else {
//         console.log(`⏭️ Booking ${doc.id} does not overlap with requested date range`);
      }
    });

//     console.log(`📋 Total booked slots in range: ${bookedSlots.length}`);

    return {
      success: true,
      date: startDate,
      bookedSlots
    };
    
  } catch (error: any) {
    console.error('Error fetching room availability:', error);
    
    return {
      success: false,
      date: startDate,
      bookedSlots: [],
      error: 'Failed to fetch room availability'
    };
  }
};

/**
 * Check if a time slot conflicts with existing bookings
 */
export const checkSlotConflict = async (
  roomId: string,
  collegeId: string,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<{
  hasConflict: boolean;
  conflictingBookings?: BookedSlot[];
  error?: string;
}> => {
  try {
//     console.log('🔍 Checking slot conflict:', {
//      roomId,
//      dateRange: `${startDate} to ${endDate}`,
//      timeRange: `${startTime} to ${endTime}`,
//      excludeBookingId
//    });
    
    const availability = await getRoomAvailability(roomId, collegeId, startDate, endDate);
    
    if (!availability.success) {
//       console.log('⚠️ Failed to get availability:', availability.error);
      return {
        hasConflict: false,
        error: availability.error
      };
    }

//     console.log(`📋 Found ${availability.bookedSlots.length} existing bookings for this room`);

    // Check for time conflicts
    const conflicts = availability.bookedSlots.filter(slot => {
      // Skip if it's the same booking we're updating
      if (excludeBookingId && slot.id === excludeBookingId) {
//         console.log(`⏭️ Skipping excluded booking: ${slot.id}`);
        return false;
      }

      // Check if times overlap
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      const reqStart = timeToMinutes(startTime);
      const reqEnd = timeToMinutes(endTime);

      const hasTimeOverlap = (reqStart < slotEnd && reqEnd > slotStart);
      
      if (hasTimeOverlap) {
//         console.log(`❌ Conflict found with booking ${slot.id}:`, {
//          existingSlot: `${slot.startTime}-${slot.endTime}`,
//          requestedSlot: `${startTime}-${endTime}`,
//          purpose: slot.purpose,
//          status: slot.status
//        });
      }
      
      return hasTimeOverlap;
    });

    if (conflicts.length > 0) {
//       console.log(`🚫 Total conflicts: ${conflicts.length}`);
    } else {
//       console.log('✅ No conflicts found');
    }

    return {
      hasConflict: conflicts.length > 0,
      conflictingBookings: conflicts
    };
    
  } catch (error: any) {
    console.error('Error checking slot conflict:', error);
    
    return {
      hasConflict: false,
      error: 'Failed to check slot availability'
    };
  }
};

/**
 * Create a new room booking
 */
export const createRoomBooking = async (
  bookingData: RoomBookingRequest
): Promise<BookingResponse> => {
  try {
//     console.log('Creating room booking:', bookingData);

    // Validate required fields
    if (!bookingData.roomId?.trim()) {
      return {
        success: false,
        error: 'Room ID is required'
      };
    }

    if (!bookingData.purpose?.trim()) {
      return {
        success: false,
        error: 'Purpose is required'
      };
    }

    if (!bookingData.startDate || !bookingData.endDate) {
      return {
        success: false,
        error: 'Start and end dates are required'
      };
    }

    if (!bookingData.startTime || !bookingData.endTime) {
      return {
        success: false,
        error: 'Start and end times are required'
      };
    }

    // Validate date range
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);
    
    if (endDate < startDate) {
      return {
        success: false,
        error: 'End date cannot be before start date'
      };
    }

    // Validate time range
    if (timeToMinutes(bookingData.endTime) <= timeToMinutes(bookingData.startTime)) {
      return {
        success: false,
        error: 'End time must be after start time'
      };
    }

    // Check for conflicts
    const conflictCheck = await checkSlotConflict(
      bookingData.roomId,
      bookingData.collegeId,
      bookingData.startDate,
      bookingData.endDate,
      bookingData.startTime,
      bookingData.endTime
    );

    if (conflictCheck.hasConflict) {
      return {
        success: false,
        error: 'This time slot conflicts with an existing booking'
      };
    }

    // Get room name
    const { firebaseService } = await import('./firebase_service');
    const room = await firebaseService.getRoomById(bookingData.collegeId, bookingData.roomId);
    
    if (!room) {
      return {
        success: false,
        error: 'Room not found'
      };
    }

    // Create booking
    const db = getFirestore();
    const now = Timestamp.now();
    
    const startDateTime = `${bookingData.startDate}T${bookingData.startTime}:00`;
    const endDateTime = `${bookingData.endDate}T${bookingData.endTime}:00`;

    const newBooking = {
      roomId: bookingData.roomId,
      roomName: room.room_name,
      collegeId: bookingData.collegeId,
      userId: bookingData.userId,
      userName: bookingData.userName,
      userEmail: bookingData.userEmail,
      purpose: bookingData.purpose.trim(),
      startDate: bookingData.startDate,
      endDate: bookingData.endDate,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      startDateTime,
      endDateTime,
      status: 'confirmed' as const,
      notes: bookingData.notes?.trim() || '',
      participantCount: bookingData.participantCount || 1,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.ROOM_BOOKINGS), newBooking);
    
//     console.log('Room booking created successfully:', docRef.id);
    
    return {
      success: true,
      bookingId: docRef.id,
      message: 'Room booked successfully',
      booking: {
        id: docRef.id,
        ...newBooking
      }
    };
    
  } catch (error: any) {
    console.error('Error creating room booking:', error);
    
    return {
      success: false,
      error: error.message || 'Failed to create room booking'
    };
  }
};

/**
 * Update room booking status
 */
export const updateBookingStatus = async (
  bookingId: string,
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
  userId: string
): Promise<BookingResponse> => {
  try {
//     console.log('Updating booking status:', { bookingId, status, userId });

    const db = getFirestore();
    const bookingRef = doc(db, COLLECTIONS.ROOM_BOOKINGS, bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return {
        success: false,
        error: 'Booking not found'
      };
    }

    const bookingData = bookingSnap.data();

    // Check if user has permission to update (owner or admin)
    if (bookingData.userId !== userId) {
      // TODO: Add admin check here
      return {
        success: false,
        error: 'You do not have permission to update this booking'
      };
    }

    await updateDoc(bookingRef, {
      status,
      updatedAt: Timestamp.now()
    });

//     console.log('Booking status updated successfully');
    
    return {
      success: true,
      message: 'Booking status updated successfully'
    };
    
  } catch (error: any) {
    console.error('Error updating booking status:', error);
    
    return {
      success: false,
      error: error.message || 'Failed to update booking status'
    };
  }
};

/**
 * Cancel a room booking
 */
export const cancelRoomBooking = async (
  bookingId: string,
  userId: string
): Promise<BookingResponse> => {
  return updateBookingStatus(bookingId, 'cancelled', userId);
};

/**
 * Delete a room booking
 */
export const deleteRoomBooking = async (
  bookingId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<BookingResponse> => {
  try {
//     console.log('Deleting room booking:', { bookingId, userId, isAdmin });

    const db = getFirestore();
    const bookingRef = doc(db, COLLECTIONS.ROOM_BOOKINGS, bookingId);
    const bookingSnap = await getDoc(bookingRef);

    if (!bookingSnap.exists()) {
      return {
        success: false,
        error: 'Booking not found'
      };
    }

    const bookingData = bookingSnap.data();

    // Check permissions: only booking owner or admin can delete
    if (!isAdmin && bookingData.userId !== userId) {
      return {
        success: false,
        error: 'You do not have permission to delete this booking'
      };
    }

    // Delete the booking
    await deleteDoc(bookingRef);

//     console.log('Booking deleted successfully:', bookingId);

    return {
      success: true,
      message: 'Booking deleted successfully'
    };
    
  } catch (error: any) {
    console.error('Error deleting booking:', error);
    
    return {
      success: false,
      error: error.message || 'Failed to delete booking'
    };
  }
};

/**
 * Get bookings for a specific room
 */
export const getRoomBookings = async (
  roomId: string,
  collegeId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  bookings?: RoomBooking[];
  error?: string;
}> => {
  try {
//     console.log('Fetching room bookings:', { roomId, collegeId, startDate, endDate });

    const db = getFirestore();
    
    let bookingsQuery = query(
      collection(db, COLLECTIONS.ROOM_BOOKINGS),
      where('roomId', '==', roomId),
      where('collegeId', '==', collegeId),
      where('status', 'in', ['pending', 'confirmed']),
      orderBy('startDateTime', 'asc')
    );

    const bookingsSnapshot = await getDocs(bookingsQuery);
    const bookings: RoomBooking[] = [];

    bookingsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Filter by date range if provided
      if (startDate && endDate) {
        if (data.startDate <= endDate && data.endDate >= startDate) {
          bookings.push({
            id: doc.id,
            ...data
          } as RoomBooking);
        }
      } else {
        bookings.push({
          id: doc.id,
          ...data
        } as RoomBooking);
      }
    });

//     console.log('Found bookings:', bookings.length);

    return {
      success: true,
      bookings
    };
    
  } catch (error: any) {
    console.error('Error fetching room bookings:', error);
    
    return {
      success: false,
      bookings: [],
      error: error.message || 'Failed to fetch room bookings'
    };
  }
};

/**
 * Get user's bookings
 */
export const getUserBookings = async (
  userId: string,
  status?: string,
  limit: number = 50
): Promise<{
  success: boolean;
  bookings?: RoomBooking[];
  error?: string;
}> => {
  try {
//     console.log('Fetching user bookings:', { userId, status });

    const db = getFirestore();
    
    let bookingsQuery = query(
      collection(db, COLLECTIONS.ROOM_BOOKINGS),
      where('userId', '==', userId),
      orderBy('startDateTime', 'desc'),
      firestoreLimit(limit)
    );

    if (status && status !== 'all') {
      bookingsQuery = query(
        collection(db, COLLECTIONS.ROOM_BOOKINGS),
        where('userId', '==', userId),
        where('status', '==', status),
        orderBy('startDateTime', 'desc'),
        firestoreLimit(limit)
      );
    }

    const bookingsSnapshot = await getDocs(bookingsQuery);
    const bookings: RoomBooking[] = [];

    bookingsSnapshot.forEach((doc) => {
      bookings.push({
        id: doc.id,
        ...doc.data()
      } as RoomBooking);
    });

    return {
      success: true,
      bookings
    };
    
  } catch (error: any) {
    console.error('Error fetching user bookings:', error);
    
    return {
      success: false,
      error: 'Failed to fetch user bookings'
    };
  }
};

/**
 * Helper function to convert time string to minutes
 */
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Generate academic years based on current date
 * Academic year runs from April to March
 * @param yearsBack - Number of past years to include (default: 2)
 * @param yearsForward - Number of future years to include (default: 1)
 */
export const getAcademicYears = (startMonth: string, yearsBack: number = 2, yearsForward: number = 1): string[] => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();
  
  const monthMap: Record<string, number> = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
    'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
    'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
  };
  
  const startMonthNum = monthMap[startMonth.toLowerCase()] || 4;
  const currentAcademicStartYear = currentMonth >= startMonthNum ? currentYear : currentYear - 1;
  
  const academicYears: string[] = [];
  
  for (let i = -yearsBack; i <= yearsForward; i++) {
    const startYear = currentAcademicStartYear + i;
    const endYear = startYear + 1;
    const endYearShort = endYear.toString().slice(-2);
    academicYears.push(`${startYear}-${endYearShort}`);
  }
  
  return academicYears;
};

// Get current academic year based on college's start month
export const getCurrentAcademicYear = (startMonth: string): string => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const monthMap: Record<string, number> = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
    'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
    'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
  };
  
  const startMonthNum = monthMap[startMonth.toLowerCase()] || 4;
  
  if (currentMonth >= startMonthNum) {
    return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  } else {
    return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
  }
};

/**
 * Helper function to format date for display
 */
export const formatDateForDisplay = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
};

/**
 * Helper function to format time for display
 */
export const formatTimeForDisplay = (timeString: string): string => {
  try {
    const [hour, minute] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hour), parseInt(minute));
    
    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return timeString;
  }
};

/**
 * Helper function to get date range array
 */
export const getDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
};

/**
 * Validate booking data
 */
export const validateBookingRequest = (bookingData: RoomBookingRequest): string | null => {
  if (!bookingData.roomId?.trim()) {
    return 'Room ID is required';
  }

  if (!bookingData.purpose?.trim()) {
    return 'Purpose is required';
  }

  if (!bookingData.startDate) {
    return 'Start date is required';
  }

  if (!bookingData.endDate) {
    return 'End date is required';
  }

  if (!bookingData.startTime) {
    return 'Start time is required';
  }

  if (!bookingData.endTime) {
    return 'End time is required';
  }

  const startDate = new Date(bookingData.startDate);
  const endDate = new Date(bookingData.endDate);
  
  if (endDate < startDate) {
    return 'End date cannot be before start date';
  }

  if (timeToMinutes(bookingData.endTime) <= timeToMinutes(bookingData.startTime)) {
    return 'End time must be after start time';
  }

  return null;
};

// =====================================================
// HALL TICKET MANAGEMENT METHODS
// =====================================================

/**
 * Get all unique classes for a college from college document
 */
export const getClassesByCollege = async (collegeId: string): Promise<Array<{
  id: string;
  className: string;
  board: string;
  academicYear: string;
  studentCount: number;
}>> => {
  try {
    const db = getFirestore();
    
//     console.log('🔍 [getClassesByCollege] Starting with collegeId:', collegeId);
    
    // Get college document to fetch validClasses
    const collegeRef = doc(db, COLLECTIONS.COLLEGES, collegeId);
    const collegeDoc = await getDoc(collegeRef);
    
    if (!collegeDoc.exists()) {
//       console.warn('⚠️ [getClassesByCollege] College not found:', collegeId);
      return [];
    }
    
    const collegeData = collegeDoc.data();
//     console.log('📄 [getClassesByCollege] College data:', collegeData);
    
    const validClasses = collegeData.validClasses || [];
    const supportedBoards = collegeData.supportedBoards || ['CBSE'];
    const collegeAcademicYearStartMonth = collegeData.academicYear || 'April';
    
//     console.log('✅ [getClassesByCollege] validClasses:', validClasses);
//     console.log('✅ [getClassesByCollege] supportedBoards:', supportedBoards);
    
    if (validClasses.length === 0) {
//       console.warn('⚠️ [getClassesByCollege] No classes configured for college:', collegeId);
      return [];
    }
    
    // Get current academic year based on college's start month
    const currentAcademicYear = getCurrentAcademicYear(collegeAcademicYearStartMonth);
//     console.log('📅 [getClassesByCollege] Current academic year:', currentAcademicYear);
    
    // Query students to get counts for each class
    const studentsQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', USER_TYPES.STUDENT),
      where('collegeId', '==', collegeId)
    );

    const snapshot = await getDocs(studentsQuery);
//     console.log('👥 [getClassesByCollege] Total students found:', snapshot.size);
    
    // Count students per class/board/year combination
    const classCountMap = new Map<string, number>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const className = data.studentClass || data.class || '';
      const board = data.board || supportedBoards[0];
      const academicYear = data.academicYear || currentAcademicYear;
      
      if (className) {
        const key = `${className}_${board}_${academicYear}`;
        classCountMap.set(key, (classCountMap.get(key) || 0) + 1);
//         console.log(`   Student: class="${className}", board="${board}", year="${academicYear}", key="${key}"`);
      }
    });

//     console.log('📊 [getClassesByCollege] Class count map:', Object.fromEntries(classCountMap));

    // Create class entries for all valid classes across all boards
    const classes: Array<{
      id: string;
      className: string;
      board: string;
      academicYear: string;
      studentCount: number;
    }> = [];
    
    validClasses.forEach((className: string) => {
      supportedBoards.forEach((board: string) => {
        const key = `${className}_${board}_${currentAcademicYear}`;
        const studentCount = classCountMap.get(key) || 0;
        
        classes.push({
          id: key,
          className: className,
          board: board,
          academicYear: currentAcademicYear,
          studentCount: studentCount
        });
        
//         console.log(`   Creating class entry: ${className} (${board}) - ${studentCount} students`);
      });
    });

    // Sort by class name (numerically if possible, then alphabetically)
    classes.sort((a, b) => {
      const aNum = parseInt(a.className);
      const bNum = parseInt(b.className);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      return a.className.localeCompare(b.className);
    });

//     console.log('✅ [getClassesByCollege] Final classes array:', classes);
//     console.log('📈 [getClassesByCollege] Total classes returned:', classes.length);
    
    return classes;

  } catch (error) {
    console.error('❌ [getClassesByCollege] Error fetching classes:', error);
    return [];
  }
};

/**
 * Get exam types for a college
 * Returns configured exam types from college or default exam types
 * Handles both array of strings and array of objects from Firestore
 */
export const getExamTypesByCollege = async (collegeId: string): Promise<Array<{
  id: string;
  name: string;
  color: string;
}>> => {
  try {
    const db = getFirestore();
    
    // Get college document to fetch exam types
    const collegeRef = doc(db, COLLECTIONS.COLLEGES, collegeId);
    const collegeDoc = await getDoc(collegeRef);
    
    if (collegeDoc.exists()) {
      const collegeData = collegeDoc.data();
      
      // Check if college has custom exam types configured
      if (collegeData.examTypes && Array.isArray(collegeData.examTypes) && collegeData.examTypes.length > 0) {
//         console.log('Using configured exam types from college');
        
        // Handle two formats:
        // 1. Array of strings: ["Home Work", "Unit Test", ...]
        // 2. Array of objects: [{id: "homework", name: "Home Work", color: "blue"}, ...]
        
        const firstItem = collegeData.examTypes[0];
        
        // If first item is a string, convert all to objects
        if (typeof firstItem === 'string') {
//           console.log('Converting string array to exam type objects');
          
          // Default colors to cycle through
          const colors = ['blue', 'purple', 'green', 'orange', 'pink', 'red', 'indigo', 'teal', 'cyan', 'amber'];
          
          return collegeData.examTypes.map((typeName: string, index: number) => ({
            id: typeName.toLowerCase().replace(/\s+/g, '-'), // "Home Work" → "home-work"
            name: typeName,
            color: colors[index % colors.length]
          }));
        }
        
        // If first item is already an object, use as is
        if (typeof firstItem === 'object' && firstItem !== null) {
//           console.log('Using object array exam types');
          return collegeData.examTypes;
        }
      }
    }
    
    // Return default exam types if not configured
//     console.log('Using default exam types');
    return [
      { id: 'homework', name: 'Homework', color: 'blue' },
      { id: 'subject-assessment', name: 'Subject Assessment', color: 'purple' },
      { id: 'unit-test', name: 'Unit Test', color: 'green' },
      { id: 'quarterly', name: 'Quarterly', color: 'orange' },
      { id: 'half-yearly', name: 'Half Yearly', color: 'pink' },
      { id: 'yearly', name: 'Yearly', color: 'red' },
      { id: 'pre-board', name: 'Pre-Board', color: 'indigo' },
      { id: 'lab-assessment', name: 'Lab Assessment', color: 'teal' }
    ];

  } catch (error) {
    console.error('Error fetching exam types:', error);
    // Return default exam types on error
    return [
      { id: 'homework', name: 'Homework', color: 'blue' },
      { id: 'subject-assessment', name: 'Subject Assessment', color: 'purple' },
      { id: 'unit-test', name: 'Unit Test', color: 'green' },
      { id: 'quarterly', name: 'Quarterly', color: 'orange' },
      { id: 'half-yearly', name: 'Half Yearly', color: 'pink' },
      { id: 'yearly', name: 'Yearly', color: 'red' },
      { id: 'pre-board', name: 'Pre-Board', color: 'indigo' },
      { id: 'lab-assessment', name: 'Lab Assessment', color: 'teal' }
    ];
  }
};

/**
 * Get all rooms for a college
 */
export const getRoomsByCollege = async (collegeId: string): Promise<Array<{
  id: string;
  roomName: string;
  roomAddress: string;
  capacity: number;
  building?: string;
  floor?: string;
  roomType?: string;
  status?: string;
  sittingMatrix?: string;
}>> => {
  try {
    const db = getFirestore();

    const roomsQuery = query(
      collection(db, COLLECTIONS.ROOMS),
      where('college_id', '==', collegeId)
    );

    const snapshot = await getDocs(roomsQuery);
    
    const rooms = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        roomName: data.room_name || '',
        roomAddress: data.room_address || '',
        capacity: data.room_capacity || 0,
        building: data.room_building || '',
        floor: data.room_floor || '',
        roomType: data.room_type || '',
        status: data.room_status || 'available',
        sittingMatrix: data.sitting_matrix || ''
      };
    });

//     console.log('Rooms fetched:', rooms.length);
    return rooms;

  } catch (error) {
    console.error('Error fetching rooms:', error);
    return [];
  }
};

/**
 * Get students by class
 */
export const getStudentsByClass = async (
  className: string,
  collegeId: string,
  board: string,
  academicYear: string
): Promise<any[]> => {
  try {
    const db = getFirestore();
    
    const studentsQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', USER_TYPES.STUDENT),
      where('collegeId', '==', collegeId),
      where('studentClass', '==', className),
      where('board', '==', board),
      where('academicYear', '==', academicYear),
      where('status', '==', USER_STATUS.ACTIVE)
    );

    const snapshot = await getDocs(studentsQuery);
    
//     console.log('📚 Firestore returned', snapshot.size, 'student documents');
    
    const students = snapshot.docs.map((doc, index) => {
      const data = doc.data();
      const student = {
        userId: doc.id,
        ...data
      };
      
      if (index === 0) {
//         console.log('📚 First student doc.id:', doc.id);
//         console.log('📚 First student data fields:', Object.keys(data));
//         console.log('📚 First student after mapping:', student);
      }
      
      return student;
    });

//     console.log('📚 Returning', students.length, 'students');
    return students;

  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};

/**
 * Create hall ticket group
 */
export const createHallTicketGroup = async (hallTicketGroup: any): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> => {
  try {
    const db = getFirestore();

//     console.log('Creating hall ticket group:', hallTicketGroup);

    // Add server timestamp and flat studentIds for querying
    const studentIds = (hallTicketGroup.students || []).map((s: any) => s.studentId).filter(Boolean);
    const groupData = {
      ...hallTicketGroup,
      studentIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Create document in hallTicketGroups collection
    const docRef = await addDoc(
      collection(db, 'hallTicketGroups'),
      groupData
    );

//     console.log('✅ Hall ticket group created:', docRef.id);

    return {
      success: true,
      id: docRef.id
    };

  } catch (error: any) {
    console.error('❌ Error creating hall ticket group:', error);
    return {
      success: false,
      error: error.message || 'Failed to create hall ticket group'
    };
  }
};

/**
 * Diagnostic function to check hall ticket groups collection
 * This helps debug why queries might be returning 0 results
 */
export const diagnoseHallTicketGroups = async (): Promise<void> => {
  try {
//     console.log('🔍 === HALL TICKET GROUPS DIAGNOSTIC START ===');
    const db = getFirestore();
    
    // Get all documents
    const allDocsQuery = query(collection(db, 'hallTicketGroups'));
    const allDocsSnapshot = await getDocs(allDocsQuery);
    
//     console.log('📊 Total documents in hallTicketGroups collection:', allDocsSnapshot.size);
    
    if (allDocsSnapshot.size === 0) {
//       console.warn('⚠️ The hallTicketGroups collection is empty or does not exist!');
//       console.log('💡 Make sure you have created at least one hall ticket group.');
      return;
    }
    
    // Analyze each document
    allDocsSnapshot.docs.forEach((_doc) => {
//       const data = doc.data();
//       console.log(`\n📄 Document ${index + 1}/${allDocsSnapshot.size}:`);
//       console.log('  ID:', doc.id);
//       console.log('  collegeId:', data.collegeId, `(type: ${typeof data.collegeId})`);
//       console.log('  academicYear:', data.academicYear);
//       console.log('  studentClass:', data.studentClass);
//       console.log('  examType:', data.examType);
//       console.log('  status:', data.status);
//       console.log('  numberOfStudents:', data.numberOfStudents);
//       console.log('  students array length:', data.students?.length || 0);
//       console.log('  createdAt:', data.createdAt);
//       console.log('  All fields:', Object.keys(data).join(', '));
    });
    
//     console.log('\n🔍 === HALL TICKET GROUPS DIAGNOSTIC END ===\n');
    
  } catch (error) {
    console.error('❌ Error in diagnostic:', error);
  }
};

/**
 * Get hall ticket groups for a college
 */
export const getHallTicketGroups = async (
  collegeId: string,
  filters?: {
    academicYear?: string;
    className?: string;
    examType?: string;
    status?: string;
    studentId?: string;
  }
): Promise<any[]> => {
  try {
    const db = getFirestore();

    // First, try to get all documents without orderBy to see if collegeId filtering works
    const constraints: any[] = [
      where('collegeId', '==', collegeId)
    ];

    // For students, query only groups they belong to using their authenticated UID
    // We use getAuth().currentUser.uid to prevent spoofing — this can't be tampered with
    if (filters?.studentId) {
      const authUid = getAuth().currentUser?.uid;
      if (!authUid) {
//         console.warn('⚠️ No authenticated user found, returning empty');
        return [];
      }
      // Always use the authenticated UID, ignore the passed studentId for security
      constraints.push(where('studentIds', 'array-contains', authUid));
    }

    let hallTicketsQuery = query(
      collection(db, 'hallTicketGroups'),
      ...constraints
    );

    const snapshot = await getDocs(hallTicketsQuery);

    if (snapshot.empty) {
//       console.log('📋 No hall ticket groups found matching the query.');
    }
    
    let hallTickets: any[] = snapshot.docs.map(doc => {
      const data = doc.data();
//       console.log('📄 Document:', doc.id, 'has collegeId:', data.collegeId);
      return {
        id: doc.id,
        ...data
      };
    });

    // Apply additional filters in memory
    if (filters?.academicYear && filters.academicYear !== 'all') {
      hallTickets = hallTickets.filter(ht => ht.academicYear === filters.academicYear);
//       console.log(`🔍 Academic year filter (${filters.academicYear}): ${beforeFilter} → ${hallTickets.length}`);
    } else if (filters?.academicYear === 'all') {
//       console.log(`✅ Skipping academic year filter (showing all years): ${hallTickets.length} documents`);
    }
    
    if (filters?.className && filters.className !== 'all') {
      hallTickets = hallTickets.filter(ht => ht.studentClass === filters.className);
//       console.log(`🔍 Class filter (${filters.className}): ${beforeFilter} → ${hallTickets.length}`);
    }
    
    if (filters?.examType && filters.examType !== 'all') {
      hallTickets = hallTickets.filter(ht => ht.examType === filters.examType);
//       console.log(`🔍 Exam type filter (${filters.examType}): ${beforeFilter} → ${hallTickets.length}`);
    }

//     console.log('✅ Hall ticket groups fetched:', hallTickets.length);
    return hallTickets;

  } catch (error) {
    console.error('❌ Error fetching hall ticket groups:', error);
    return [];
  }
};

/**
 * Get a single hall ticket group by ID
 */
export const getHallTicketGroupById = async (
  groupId: string
): Promise<any | null> => {
  try {
    const db = getFirestore();
    const groupRef = doc(db, 'hallTicketGroups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      console.error('Hall ticket group not found:', groupId);
      return null;
    }

//     console.log('Hall ticket group fetched:', groupId);
    return {
      id: groupDoc.id,
      ...groupDoc.data()
    };

  } catch (error) {
    console.error('Error fetching hall ticket group:', error);
    return null;
  }
};

/**
 * Update hall ticket group status
 */
export const updateHallTicketGroupStatus = async (
  groupId: string,
  status: 'active' | 'suspended' | 'completed' | 'cancelled'
): Promise<boolean> => {
  try {
    const db = getFirestore();

    const groupRef = doc(db, 'hallTicketGroups', groupId);
    
    await updateDoc(groupRef, {
      status,
      updatedAt: serverTimestamp()
    });

//     console.log('✅ Hall ticket group status updated:', groupId, status);
    return true;

  } catch (error) {
    console.error('❌ Error updating hall ticket group status:', error);
    return false;
  }
};

/**
 * Update individual hall ticket status
 */
export const updateHallTicketStatus = async (
  groupId: string,
  studentId: string,
  status: 'active' | 'suspended' | 'revoked'
): Promise<boolean> => {
  try {
    const db = getFirestore();

    const groupRef = doc(db, 'hallTicketGroups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      console.error('Hall ticket group not found:', groupId);
      return false;
    }

    const groupData = groupDoc.data();
    const students = groupData.students || [];
    
    // Update the specific student's status
    const updatedStudents = students.map((student: any) => {
      if (student.studentId === studentId) {
        return {
          ...student,
          hallTicketStatus: status
        };
      }
      return student;
    });

    await updateDoc(groupRef, {
      students: updatedStudents,
      updatedAt: serverTimestamp()
    });

//     console.log('✅ Hall ticket status updated:', studentId, status);
    return true;

  } catch (error) {
    console.error('❌ Error updating hall ticket status:', error);
    return false;
  }
};

// =====================================================
// END OF HALL TICKET MANAGEMENT METHODS
// =====================================================


export default {
  getRoomAvailability,
  checkSlotConflict,
  createRoomBooking,
  updateBookingStatus,
  cancelRoomBooking,
  getUserBookings,
  getRoomBookings,
  formatDateForDisplay,
  formatTimeForDisplay,
  getDateRange,
  validateBookingRequest,
  // Academic Year Functions
  getAcademicYears,
  getCurrentAcademicYear,
  // Hall Ticket Methods
  getClassesByCollege,
  getRoomsByCollege,
  getStudentsByClass,
  getExamTypesByCollege,
  createHallTicketGroup,
  getHallTicketGroups,
  getHallTicketGroupById,
  updateHallTicketGroupStatus,
  updateHallTicketStatus,
  // Diagnostic
  diagnoseHallTicketGroups
};