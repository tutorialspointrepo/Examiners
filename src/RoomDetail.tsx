import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faUser,
  faCalendar,
  faXmark,
  faUsers,
  faDoorOpen,
  faEdit,
  faTrash,
  faBriefcase,
  faEllipsisVertical,
  faCalendarPlus,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { getRoomBookings, deleteRoomBooking, type RoomBooking } from './services/roomSchedulingService';
import { 
  ROOM_TYPE_LABELS,
  USER_TYPES,
  hasPermissionLevel,
  type RoomStatus,
  type RoomType
} from './constants';
import ScheduleRoomModal from './ScheduleRoomModal';
import CreateRoomModal from './CreateRoomModal';
import RoomBookingCalendar from './RoomBookingCalendar';

interface RoomDetailProps {
  selectedRoom: any;
  activeCollegeId: string;
  brandTheme: any;
  onClose: () => void;
  onCreateRoom?: () => void;
  onRefresh?: () => void;
  currentUser?: {
    userId: string;
    userName: string;
    userEmail: string;
    userType?: string;
  };
  isSuperUser?: boolean;
}

interface RoomData {
  room_id: string;
  room_name: string;
  room_type: RoomType;
  room_address: string;
  room_capacity: number;
  sitting_matrix: string;
  room_status: RoomStatus;
  room_incharge: string[];
  created_at?: string;
  created_by?: string;
}

export default function RoomDetail({
  selectedRoom,
  activeCollegeId,
  brandTheme,
  onClose,
  onRefresh,
  currentUser,
  isSuperUser = false
}: RoomDetailProps) {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userNames, setUserNames] = useState<{[key: string]: string}>({});
  const [userEmails, setUserEmails] = useState<{[key: string]: string}>({});
  const [userTitles, setUserTitles] = useState<{[key: string]: string}>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    bookingId: string;
    bookingUserId: string;
    bookingTitle: string;
    isDeleting: boolean;
    status: 'idle' | 'success' | 'error';
    message: string;
  }>({ isOpen: false, bookingId: '', bookingUserId: '', bookingTitle: '', isDeleting: false, status: 'idle', message: '' });
  const [isInChargeDialogOpen, setIsInChargeDialogOpen] = useState(false);
  const [deleteRoomConfirmation, setDeleteRoomConfirmation] = useState<{
    isOpen: boolean;
    isDeleting: boolean;
    status: 'idle' | 'checking' | 'has-bookings' | 'success' | 'error';
    message: string;
    bookingsCount: number;
  }>({ isOpen: false, isDeleting: false, status: 'idle', message: '', bookingsCount: 0 });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Permission check: Students cannot create, edit, delete, or schedule rooms
  const canManageRooms = currentUser?.userType !== USER_TYPES.STUDENT;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch room details
  useEffect(() => {
    const fetchRoomDetails = async () => {
      if (!selectedRoom || !activeCollegeId) {
        setRoomData(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Fetch room data from Firebase
        const room = await firebaseService.getRoomById(activeCollegeId, selectedRoom.room_id);
        
        if (room) {
          setRoomData(room as RoomData);
          
          // Fetch user names based on email IDs from room_incharge
          if (room.room_incharge && room.room_incharge.length > 0) {
            const names: {[key: string]: string} = {};
            const emails: {[key: string]: string} = {};
            const titles: {[key: string]: string} = {};
            
            for (const inchargeString of room.room_incharge) {
              // Parse email from string format: "dean@lpu.com (dean)"
              const emailMatch = inchargeString.match(/^(.+?)\s*\(/);
              const email = emailMatch ? emailMatch[1].trim() : '';
              
              // Parse fallback name from parentheses: "(dean)"
              const nameMatch = inchargeString.match(/\((.+?)\)$/);
              const fallbackName = nameMatch ? nameMatch[1].trim() : email.split('@')[0];
              
              emails[inchargeString] = email;
              
              try {
                // Fetch user from Users table by email using getUserByEmail method
                const user = await firebaseService.getUserByEmail(email);
                
                if (user) {
                  names[inchargeString] = user.fullName || fallbackName;
                  titles[inchargeString] = user.title || '';
                } else {
                  // Fallback to the name in parentheses
                  names[inchargeString] = fallbackName;
                  titles[inchargeString] = '';
                }
              } catch (error) {
                console.error(`Error fetching user for email ${email}:`, error);
                // Use fallback on error
                names[inchargeString] = fallbackName;
                titles[inchargeString] = '';
              }
            }
            
            setUserNames(names);
            setUserEmails(emails);
            setUserTitles(titles);
          }
        }
      } catch (error) {
        console.error('Error fetching room details:', error);
        setRoomData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoomDetails();
  }, [selectedRoom, activeCollegeId]);


  const handleDelete = async () => {
    if (!roomData || !currentUser) return;
    
    // Check if user has permission to delete room
    // Only TEACHER level and above can delete rooms (TEACHER, DEAN, PRINCIPAL, ADMIN, SUPER_ADMIN, SYSTEM_ADMIN)
    const userType = currentUser.userType;
    
    console.log(' Delete room check - User Type:', userType);
    console.log(' Current User:', currentUser);
    
    // First check for existing bookings before permission check
    setDeleteRoomConfirmation({
      isOpen: true,
      isDeleting: false,
      status: 'checking',
      message: 'Checking for existing bookings...',
      bookingsCount: 0
    });

    try {
      // Get ALL bookings count (including past bookings)
      const totalBookings = await getAllBookingsCount();
      
      console.log(' Total bookings for room (including past):', totalBookings);
      
      if (totalBookings > 0) {
        setDeleteRoomConfirmation({
          isOpen: true,
          isDeleting: false,
          status: 'has-bookings',
          message: `This room has ${totalBookings} booking${totalBookings > 1 ? 's' : ''} (including past bookings). Please delete all bookings before deleting the room.`,
          bookingsCount: totalBookings
        });
        return;
      }
      
      // No bookings found, now check permissions
      const hasPermission = userType && hasPermissionLevel(userType as any, USER_TYPES.TEACHER);
      
      console.log(' Has permission:', hasPermission);
      
      if (!hasPermission) {
        setDeleteRoomConfirmation({
          isOpen: true,
          isDeleting: false,
          status: 'error',
          message: 'You do not have permission to delete rooms. Only Teacher, Dean, Principal, Admin, Super Admin, or System Admin can delete rooms.',
          bookingsCount: 0
        });
        return;
      }

      // No bookings and has permission, show confirmation
      setDeleteRoomConfirmation({
        isOpen: true,
        isDeleting: false,
        status: 'idle',
        message: '',
        bookingsCount: 0
      });
    } catch (error) {
      console.error('Error checking bookings:', error);
      setDeleteRoomConfirmation({
        isOpen: true,
        isDeleting: false,
        status: 'error',
        message: 'Failed to check bookings. Please try again.',
        bookingsCount: 0
      });
    }
  };

  const confirmDeleteRoom = async () => {
    if (!roomData) return;

    setDeleteRoomConfirmation(prev => ({ ...prev, isDeleting: true }));

    try {
      await firebaseService.deleteRoom(activeCollegeId, roomData.room_id, roomData.room_name || '');
      
      setDeleteRoomConfirmation({
        isOpen: true,
        isDeleting: false,
        status: 'success',
        message: 'Room deleted successfully!',
        bookingsCount: 0
      });

      // Wait a moment then close and refresh
      setTimeout(() => {
        if (onRefresh) onRefresh();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error deleting room:', error);
      setDeleteRoomConfirmation(prev => ({
        ...prev,
        isDeleting: false,
        status: 'error',
        message: 'Failed to delete room. Please try again.'
      }));
    }
  };

  const cancelDeleteRoom = () => {
    setDeleteRoomConfirmation({
      isOpen: false,
      isDeleting: false,
      status: 'idle',
      message: '',
      bookingsCount: 0
    });
  };

  const handleEdit = () => {
    if (!roomData || !currentUser) return;
    
    // Check permission - same as delete (Teacher level and above)
    const userType = currentUser.userType;
    
    console.log(' Edit room check - User Type:', userType);
    console.log(' Current User:', currentUser);
    
    const hasPermission = userType && hasPermissionLevel(userType as any, USER_TYPES.TEACHER);
    
    console.log(' Has permission to edit:', hasPermission);
    
    if (!hasPermission) {
      alert('You do not have permission to edit rooms. Only Teacher, Dean, Principal, Admin, Super Admin, or System Admin can edit rooms.');
      return;
    }
    
    // Open CreateRoomModal in edit mode
    setIsEditModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleScheduleClick = () => {
    if (!currentUser) {
      alert('Please log in to schedule a room');
      return;
    }
    setIsScheduleModalOpen(true);
  };

  const handleScheduleSuccess = () => {
    // Refresh room data after successful booking
    if (onRefresh) onRefresh();
    
    // Re-fetch room details and bookings
    fetchRoomDetailsAndBookings();
  };

  const fetchRoomDetailsAndBookings = async () => {
    if (!selectedRoom || !activeCollegeId) return;
    try {
      const room = await firebaseService.getRoomById(activeCollegeId, selectedRoom.room_id);
      if (room) {
        setRoomData(room as RoomData);
      }
      
      // Fetch bookings
      await fetchBookings();
    } catch (error) {
      console.error('Error fetching room details:', error);
    }
  };

  const fetchBookings = async () => {
    if (!selectedRoom?.room_id || !activeCollegeId) {
      console.log(' Cannot fetch bookings - missing roomId or collegeId', {
        roomId: selectedRoom?.room_id,
        collegeId: activeCollegeId
      });
      return;
    }
    
    console.log(' Fetching bookings for room:', {
      roomId: selectedRoom.room_id,
      collegeId: activeCollegeId
    });
    setIsLoadingBookings(true);
    
    try {
      const result = await getRoomBookings(selectedRoom.room_id, activeCollegeId);
      console.log(' Bookings fetch result:', {
        success: result.success,
        bookingsCount: result.bookings?.length || 0,
        error: result.error,
        bookings: result.bookings
      });
      
      if (result.success && result.bookings) {
        console.log(' Raw bookings received:', result.bookings);
        
        // Filter to show only upcoming bookings
        const now = new Date();
        console.log(' Current time:', now.toISOString());
        
        const upcomingBookings = result.bookings.filter(booking => {
          const bookingDate = new Date(booking.startDateTime);
          const isUpcoming = bookingDate >= now;
          console.log(`   Booking: ${booking.purpose} at ${booking.startDateTime} - ${isUpcoming ? 'UPCOMING' : 'PAST'}`);
          return isUpcoming;
        });
        
        console.log(' Upcoming bookings:', upcomingBookings.length, upcomingBookings);
        setRoomBookings(upcomingBookings);
      } else {
        console.log(' No bookings found or error:', result.error);
        setRoomBookings([]);
      }
    } catch (error) {
      console.error(' Error fetching bookings:', error);
      setRoomBookings([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const getAllBookingsCount = async (): Promise<number> => {
    if (!roomData?.room_id || !activeCollegeId) {
      return 0;
    }
    
    try {
      const result = await getRoomBookings(roomData.room_id, activeCollegeId);
      console.log(' All bookings check (including past):', result);
      
      if (result.success && result.bookings) {
        // Return ALL bookings count (including past bookings)
        return result.bookings.length;
      }
      return 0;
    } catch (error) {
      console.error('Error getting all bookings count:', error);
      return 0;
    }
  };

  const handleDeleteBooking = async (bookingId: string, bookingUserId: string, bookingTitle: string) => {
    if (!currentUser) {
      alert('Please log in to delete bookings');
      return;
    }

    const isOwner = currentUser.userId === bookingUserId;
    const isAdmin = isSuperUser;
    
    if (!isOwner && !isAdmin) {
      alert('Only the booking owner or admin can delete this booking');
      return;
    }

    // Show custom confirmation dialog
    setDeleteConfirmation({
      isOpen: true,
      bookingId,
      bookingUserId,
      bookingTitle,
      isDeleting: false,
      status: 'idle',
      message: ''
    });
  };

  const confirmDelete = async () => {
    const { bookingId } = deleteConfirmation;
    const isAdmin = isSuperUser;

    // Set deleting state
    setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));

    try {
      const result = await deleteRoomBooking(bookingId, currentUser!.userId, isAdmin || false);
      
      if (result.success) {
        // Show success message in dialog (don't refresh yet)
        setDeleteConfirmation(prev => ({ 
          ...prev, 
          isDeleting: false, 
          status: 'success', 
          message: 'Booking deleted successfully!',
          needsRefresh: true  // Flag to refresh when dialog closes
        }));
      } else {
        // Show error message in dialog
        setDeleteConfirmation(prev => ({ 
          ...prev, 
          isDeleting: false, 
          status: 'error', 
          message: result.error || 'Failed to delete booking' 
        }));
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      // Show error message in dialog
      setDeleteConfirmation(prev => ({ 
        ...prev, 
        isDeleting: false, 
        status: 'error', 
        message: 'Failed to delete booking. Please try again.' 
      }));
    }
  };

  const cancelDelete = async () => {
    const needsRefresh = deleteConfirmation.status === 'success';
    
    setDeleteConfirmation({ 
      isOpen: false, 
      bookingId: '', 
      bookingUserId: '', 
      bookingTitle: '', 
      isDeleting: false, 
      status: 'idle', 
      message: '' 
    });

    // Refresh bookings only after closing dialog on success
    if (needsRefresh) {
      await fetchBookings();
      if (onRefresh) onRefresh();
    }
  };

  // Fetch bookings when room data is loaded
  useEffect(() => {
    if (selectedRoom?.room_id && activeCollegeId) {
      fetchBookings();
    }
  }, [selectedRoom?.room_id, activeCollegeId]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Sticky Header - Only show when we have room data */}
      {roomData && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-6">
          <>
            {/* Room Name with Room In Charge, Schedule Button and Three Vertical Dots Menu */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{roomData.room_name}</h1>
              <div className="flex items-center space-x-3">
                {/* Room In Charge Icon Button */}
                {roomData.room_incharge && roomData.room_incharge.length > 0 && (
                  <button
                    onClick={() => setIsInChargeDialogOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-all border border-gray-300"
                    title="View Room In Charge"
                  >
                    <FontAwesomeIcon icon={faUser} className="text-gray-600" />
                  </button>
                )}
                
                {/* Schedule Room Button - Hidden for students */}
                {canManageRooms && (
                  <button
                    onClick={handleScheduleClick}
                    className="p-2 rounded-lg text-white hover:shadow-lg transition-all"
                    style={{ backgroundColor: brandTheme?.colors?.primary || '#6366f1' }}
                    title="Schedule Room"
                  >
                    <FontAwesomeIcon icon={faCalendarPlus} />
                  </button>
                )}
                
                {/* Three Dots Menu - Hidden for students */}
                {canManageRooms && (
                  <div className="relative" ref={menuRef}>
                  <button
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="More options"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} className="text-gray-500 text-xl" />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleScheduleClick();
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <FontAwesomeIcon icon={faCalendarPlus} className="text-green-500" />
                        <span>Schedule Room</span>
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={handleEdit}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <FontAwesomeIcon icon={faEdit} className="text-gray-500" />
                        <span>Edit Room</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleDelete();
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-red-500" />
                        <span>Delete Room</span>
                      </button>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>

            {/* Icon Details Row */}
            <div className="flex items-center space-x-6 text-sm text-gray-700 mb-4">
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faUsers} className="text-gray-500" />
                <span>{roomData.room_capacity} Capacity</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faBuilding} className="text-gray-500" />
                <span>{ROOM_TYPE_LABELS[roomData.room_type]}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faDoorOpen} className="text-gray-500" />
                <span>{roomData.sitting_matrix}</span>
              </div>
            </div>

            {/* Room Address - Third Row */}
            <p className="text-gray-500 text-sm">
              {roomData.room_address || 'No address specified'}
            </p>
          </>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
              style={{ 
                borderColor: (brandTheme?.colors?.primary || '#6366f1') + '20',
                borderTopColor: brandTheme?.colors?.primary || '#6366f1'
              }}
            />
            <p className="text-gray-600 font-medium">Loading room details...</p>
          </div>
        ) : !selectedRoom || !selectedRoom.room_id ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            {/* Beautiful SVG Illustration - No Room Selected */}
            <div className="mb-8">
              <svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background Circle */}
                <circle cx="120" cy="120" r="100" fill="#F3F4F6" opacity="0.5"/>
                
                {/* Multiple Doors */}
                <g opacity="0.6">
                  <rect x="50" y="70" width="40" height="70" rx="3" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2"/>
                  <rect x="53" y="73" width="34" height="64" rx="2" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="1"/>
                  <circle cx="80" cy="105" r="2" fill="#6B7280"/>
                </g>
                
                <g opacity="0.8">
                  <rect x="100" y="60" width="40" height="80" rx="3" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2"/>
                  <rect x="103" y="63" width="34" height="74" rx="2" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="1"/>
                  <circle cx="130" cy="100" r="2" fill="#6B7280"/>
                </g>
                
                <g>
                  <rect x="150" y="65" width="40" height="75" rx="3" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2"/>
                  <rect x="153" y="68" width="34" height="69" rx="2" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="1.5"/>
                  <circle cx="180" cy="102" r="2.5" fill="#6B7280"/>
                </g>
                
                {/* Click/Touch Indicator */}
                <g transform="translate(110, 160)">
                  <circle cx="10" cy="10" r="18" fill={`${brandTheme?.colors?.primary || '#6366f1'}20`}/>
                  <path d="M10 4 L10 16 M4 10 L16 10" stroke={brandTheme?.colors?.primary || '#6366f1'} strokeWidth="2" strokeLinecap="round"/>
                </g>
              </svg>
            </div>
            
            {/* Text Content */}
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No room selected
            </h3>
            <p className="text-gray-500 text-center max-w-md mb-6">
              Select a room from the list on the left to view its details, schedule bookings, and manage availability.
            </p>
            
            {/* Action Hint */}
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V8L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span>Click on any room card to get started</span>
            </div>
          </div>
        ) : !roomData ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            {/* Beautiful SVG Illustration - Room Not Found */}
            <div className="mb-8">
              <svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background Circle */}
                <circle cx="120" cy="120" r="100" fill="#FEE2E2" opacity="0.3"/>
                
                {/* Broken Door */}
                <g>
                  {/* Left part of broken door */}
                  <rect x="70" y="65" width="30" height="80" rx="3" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2" transform="rotate(-5 85 105)"/>
                  <rect x="73" y="68" width="24" height="74" rx="2" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="1" transform="rotate(-5 85 105)"/>
                  
                  {/* Right part of broken door */}
                  <rect x="130" y="65" width="30" height="80" rx="3" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2" transform="rotate(5 145 105)"/>
                  <rect x="133" y="68" width="24" height="74" rx="2" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="1" transform="rotate(5 145 105)"/>
                  
                  {/* Crack lines */}
                  <path d="M100 65 L105 95 L110 85 L115 105 L120 95 L125 115" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4"/>
                </g>
                
                {/* Warning/Error Icon */}
                <circle cx="120" cy="160" r="20" fill="#FEE2E2"/>
                <circle cx="120" cy="160" r="16" fill="#EF4444"/>
                <text x="120" y="170" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">!</text>
              </svg>
            </div>
            
            {/* Text Content */}
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Room not found
            </h3>
            <p className="text-gray-500 text-center max-w-md mb-6">
              This room may have been deleted, moved, or you don't have permission to view it. Please select another room or contact your administrator.
            </p>
            
            {/* Action Hint */}
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2L2 8L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 2L14 8L10 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Go back and select a different room</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Booking Calendar & Seating Matrix */}
            <RoomBookingCalendar
              roomId={roomData.room_id}
              roomName={roomData.room_name}
              roomCapacity={roomData.room_capacity}
              sittingMatrix={roomData.sitting_matrix}
              collegeId={activeCollegeId}
              brandTheme={brandTheme}
            />

            {/* Upcoming Bookings from room_bookings collection */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FontAwesomeIcon icon={faCalendar} className="mr-2" style={{ color: brandTheme?.colors?.accent || '#6366f1' }} />
                Upcoming Bookings {roomBookings.length > 0 && `(${roomBookings.length})`}
              </h3>
              
              {isLoadingBookings ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">Loading bookings...</p>
                </div>
              ) : roomBookings.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">No upcoming bookings for this room</p>
                  <p className="text-gray-400 text-xs mt-1">Bookings created through "Schedule Room" will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {roomBookings.map((booking) => {
                    const isOwner = currentUser?.userId === booking.userId;
                    const isAdmin = isSuperUser;
                    const canDelete = isOwner || isAdmin;

                    return (
                      <div 
                        key={booking.id} 
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {/* Title and Status */}
                            <div className="flex items-center space-x-2 mb-3">
                              <h4 className="font-semibold text-gray-900">{booking.purpose || 'Booking'}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                booking.status === 'confirmed' 
                                  ? 'bg-green-100 text-green-700' 
                                  : booking.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            
                            {/* Metadata in Single Row */}
                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                              <div className="flex items-center space-x-2">
                                <FontAwesomeIcon icon={faCalendar} className="text-gray-400" />
                                <span>{booking.startDate} at {booking.startTime} - {booking.endTime}</span>
                              </div>
                              
                              {booking.participantCount && booking.participantCount > 0 && (
                                <div className="flex items-center space-x-2">
                                  <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                                  <span>{booking.participantCount} participant{booking.participantCount !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                              
                              {booking.userName && (
                                <div className="flex items-center space-x-2">
                                  <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                                  <span>Booked by: {booking.userName}</span>
                                  {isOwner && <span className="text-xs text-blue-600">(You)</span>}
                                </div>
                              )}
                            </div>

                            {/* Note on separate line if exists */}
                            {booking.notes && (
                              <div className="mt-2 text-sm text-gray-600 italic">
                                Note: {booking.notes}
                              </div>
                            )}
                          </div>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteBooking(booking.id!, booking.userId, booking.purpose || 'Booking')}
                              className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                              title="Delete booking"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Room Modal */}
      {roomData && currentUser && (
        <ScheduleRoomModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          roomId={roomData.room_id}
          roomName={roomData.room_name}
          roomCapacity={roomData.room_capacity}
          sittingMatrix={roomData.sitting_matrix}
          collegeId={activeCollegeId}
          userId={currentUser.userId}
          userName={currentUser.userName}
          userEmail={currentUser.userEmail}
          brandTheme={brandTheme}
          onSuccess={handleScheduleSuccess}
        />
      )}

      {/* Beautiful Delete Confirmation Dialog */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  deleteConfirmation.status === 'success' 
                    ? 'bg-green-100' 
                    : deleteConfirmation.status === 'error'
                    ? 'bg-red-100'
                    : 'bg-red-100'
                }`}>
                  {deleteConfirmation.status === 'success' ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : deleteConfirmation.status === 'error' ? (
                    <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <FontAwesomeIcon icon={faTrash} className="text-red-600 text-xl" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {deleteConfirmation.status === 'success' 
                      ? 'Success!' 
                      : deleteConfirmation.status === 'error'
                      ? 'Error'
                      : 'Delete Booking'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {deleteConfirmation.status === 'idle' && 'This action cannot be undone'}
                    {deleteConfirmation.status === 'success' && 'Booking has been deleted'}
                    {deleteConfirmation.status === 'error' && 'Something went wrong'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {deleteConfirmation.status === 'idle' && (
                <>
                  <p className="text-gray-700 mb-4">
                    Are you sure you want to delete the booking <span className="font-semibold text-gray-900">"{deleteConfirmation.bookingTitle}"</span>?
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-800">Warning</p>
                        <p className="text-sm text-red-700 mt-1">
                          This will permanently remove this booking. Participants will no longer have access to this scheduled time.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {deleteConfirmation.status === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Success</p>
                      <p className="text-sm text-green-700 mt-1">{deleteConfirmation.message}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {deleteConfirmation.status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-800">Error</p>
                      <p className="text-sm text-red-700 mt-1">{deleteConfirmation.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end space-x-3">
              {deleteConfirmation.status === 'idle' && (
                <>
                  <button
                    onClick={cancelDelete}
                    disabled={deleteConfirmation.isDeleting}
                    className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleteConfirmation.isDeleting}
                    className="px-6 py-2.5 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {deleteConfirmation.isDeleting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete Booking</span>
                    )}
                  </button>
                </>
              )}
              
              {(deleteConfirmation.status === 'success' || deleteConfirmation.status === 'error') && (
                <button
                  onClick={cancelDelete}
                  className="px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Room In Charge Dialog */}
      {isInChargeDialogOpen && roomData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl transform transition-all animate-scaleIn max-h-[90vh] overflow-hidden">
            {/* Gradient Header with Pattern */}
            <div className="relative sticky top-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-8 py-6 overflow-hidden">
              {/* Decorative Background Circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-lg border border-white/30">
                    <FontAwesomeIcon icon={faUser} className="text-white text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white drop-shadow-lg">Room In-Charge</h3>
                    <p className="text-purple-100 text-sm font-medium mt-0.5">{roomData.room_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInChargeDialogOpen(false)}
                  className="p-2.5 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm border border-white/20"
                  title="Close"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-white text-xl" />
                </button>
              </div>
            </div>

            {/* Content with Custom Scrollbar */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]" style={{ scrollbarWidth: 'thin' }}>
              {roomData.room_incharge && roomData.room_incharge.length > 0 ? (
                <div className="space-y-4">
                  {roomData.room_incharge.map((inchargeString, index) => {
                    const displayName = userNames[inchargeString] || 'Loading...';
                    const displayEmail = userEmails[inchargeString] || '';
                    const displayTitle = userTitles[inchargeString] || '';
                    
                    return (
                      <div 
                        key={index} 
                        className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start space-x-4">
                          {/* Simple Avatar with Number Badge */}
                          <div className="flex-shrink-0 relative">
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                              <FontAwesomeIcon icon={faUser} className="text-gray-400 text-lg" />
                            </div>
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center border-2 border-white">
                              <span className="text-white text-xs font-semibold">{index + 1}</span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-gray-900 mb-1">
                              {displayName}
                            </h4>
                            
                            {/* Title and Email on same line */}
                            <div className="text-sm text-gray-600 mb-3">
                              {displayTitle && (
                                <div className="flex items-center gap-1.5 mb-1">
                                  <FontAwesomeIcon icon={faBriefcase} className="text-gray-500 text-xs" />
                                  <span className="font-medium">{displayTitle}</span>
                                </div>
                              )}
                              {displayEmail && (
                                <div className="flex items-center gap-1.5">
                                  <FontAwesomeIcon icon={faUser} className="text-gray-500 text-xs" />
                                  <span>{inchargeString}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <FontAwesomeIcon icon={faUser} className="text-gray-400 text-4xl" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg mb-2">No Room In-Charge Assigned</p>
                  <p className="text-sm text-gray-500">This room doesn't have any in-charge assigned yet</p>
                </div>
              )}
            </div>

            {/* Gradient Footer */}
            <div className="sticky bottom-0 px-8 py-5 bg-gradient-to-r from-gray-50 to-slate-50 border-t border-gray-200">
              <button
                onClick={() => setIsInChargeDialogOpen(false)}
                className="w-full px-6 py-3.5 rounded-xl font-semibold text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Delete Room Confirmation Dialog */}
      {deleteRoomConfirmation.isOpen && roomData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  deleteRoomConfirmation.status === 'success' 
                    ? 'bg-green-100' 
                    : deleteRoomConfirmation.status === 'error' || deleteRoomConfirmation.status === 'has-bookings'
                    ? 'bg-red-100'
                    : deleteRoomConfirmation.status === 'checking'
                    ? 'bg-blue-100'
                    : 'bg-red-100'
                }`}>
                  {deleteRoomConfirmation.status === 'success' ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : deleteRoomConfirmation.status === 'checking' ? (
                    <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : deleteRoomConfirmation.status === 'error' || deleteRoomConfirmation.status === 'has-bookings' ? (
                    <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <FontAwesomeIcon icon={faTrash} className="text-red-600 text-xl" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {deleteRoomConfirmation.status === 'success' 
                      ? 'Success!' 
                      : deleteRoomConfirmation.status === 'error'
                      ? 'Error'
                      : deleteRoomConfirmation.status === 'has-bookings'
                      ? 'Cannot Delete Room'
                      : deleteRoomConfirmation.status === 'checking'
                      ? 'Checking...'
                      : 'Delete Room'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {deleteRoomConfirmation.status === 'idle' && 'This action cannot be undone'}
                    {deleteRoomConfirmation.status === 'checking' && 'Please wait'}
                    {deleteRoomConfirmation.status === 'success' && 'Room has been deleted'}
                    {deleteRoomConfirmation.status === 'has-bookings' && 'Bookings must be deleted first'}
                    {deleteRoomConfirmation.status === 'error' && 'Something went wrong'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {deleteRoomConfirmation.status === 'idle' && (
                <>
                  <p className="text-gray-700 mb-4">
                    Are you sure you want to delete the room <span className="font-semibold text-gray-900">"{roomData.room_name}"</span>?
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-800">Warning</p>
                        <p className="text-sm text-red-700 mt-1">
                          This will permanently remove this room and all its data. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {deleteRoomConfirmation.status === 'checking' && (
                <div className="text-center py-4">
                  <p className="text-gray-600">{deleteRoomConfirmation.message}</p>
                </div>
              )}
              
              {deleteRoomConfirmation.status === 'has-bookings' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Room Has Active Bookings</p>
                      <p className="text-sm text-yellow-700 mt-2">
                        This room has <span className="font-semibold">{deleteRoomConfirmation.bookingsCount}</span> booking{deleteRoomConfirmation.bookingsCount > 1 ? 's' : ''} (including past bookings).
                      </p>
                      <p className="text-sm text-yellow-700 mt-2 font-medium">
                        Please delete all bookings before deleting this room.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {deleteRoomConfirmation.status === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Success</p>
                      <p className="text-sm text-green-700 mt-1">{deleteRoomConfirmation.message}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {deleteRoomConfirmation.status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-800">Error</p>
                      <p className="text-sm text-red-700 mt-1">{deleteRoomConfirmation.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end space-x-3">
              {deleteRoomConfirmation.status === 'idle' && !deleteRoomConfirmation.isDeleting && (
                <>
                  <button
                    onClick={cancelDeleteRoom}
                    className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteRoom}
                    className="px-6 py-2.5 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl transition-all"
                  >
                    Delete Room
                  </button>
                </>
              )}
              
              {deleteRoomConfirmation.isDeleting && (
                <button
                  disabled
                  className="px-6 py-2.5 rounded-lg font-semibold text-white bg-red-400 cursor-not-allowed flex items-center space-x-2"
                >
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Deleting...</span>
                </button>
              )}
              
              {(deleteRoomConfirmation.status === 'success' || 
                deleteRoomConfirmation.status === 'error' || 
                deleteRoomConfirmation.status === 'has-bookings' ||
                deleteRoomConfirmation.status === 'checking') && 
                !deleteRoomConfirmation.isDeleting && (
                <button
                  onClick={cancelDeleteRoom}
                  className="px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                >
                  {deleteRoomConfirmation.status === 'success' ? 'Close' : 'OK'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Room Modal - Using CreateRoomModal */}
      {isEditModalOpen && roomData && (
        <CreateRoomModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onBulkUpload={() => {}} // Not used in edit mode
          activeCollegeId={activeCollegeId}
          activeCollegeName="" // Not needed for edit
          currentUser={currentUser}
          isSuperUser={isSuperUser}
          onRoomAdded={() => {
            // Refresh the room details after update
            if (onRefresh) onRefresh();
            fetchRoomDetailsAndBookings();
          }}
          editMode={true}
          existingRoom={{
            room_id: roomData.room_id,
            room_name: roomData.room_name,
            room_type: roomData.room_type,
            room_address: roomData.room_address,
            room_capacity: roomData.room_capacity,
            sitting_matrix: roomData.sitting_matrix,
            room_incharge: roomData.room_incharge || []
          }}
        />
      )}
    </div>
  );
}