import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft, 
  faChevronDown, 
  faDoorOpen,
  faBuilding,
  faFlask,
  faChalkboardTeacher,
  faBookOpen,
  faUsers,
  faCalendarAlt,
  faLocationDot,
  faEllipsis,
  faLaptop,
  faCouch,
  faUserTie,
  faUtensils,
  faBaseball,
  faMusic,
  faPaintBrush,
  faHammer,
  faBox,
  faServer,
  faBriefcaseMedical,
  faGraduationCap
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { firebaseService, type RoomStats } from './services/firebase_service';
import {
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  ROOM_STATUS,
  ROOM_STATUS_LABELS,
  type RoomType,
  type RoomStatus
} from './constants';

interface RoomsProps {
  activeCollegeId: string | null;
  refreshTrigger: number;
  onRoomSelect: (room: RoomStats | null) => void;
  selectedRoom?: RoomStats | null;
  onCollapse: () => void;
}

export default function Rooms({ 
  activeCollegeId, 
  onRoomSelect, 
  selectedRoom: externalSelectedRoom, 
  onCollapse, 
  refreshTrigger 
}: RoomsProps) {
  // Safe usage - catch error and use default if needed
  let brandTheme;
  try {
    brandTheme = useBrand();
  } catch (error) {
    // If useBrand throws (not in provider), use default theme
    brandTheme = {
      colors: {
        primary: '#4F46E5',
        secondary: '#7C3AED',
        accent: '#EC4899'
      },
      gradients: {
        primary: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        header: 'linear-gradient(to right, #4F46E5, #7C3AED)',
        card: 'linear-gradient(135deg, #4F46E510 0%, #7C3AED10 100%)',
        background: 'linear-gradient(to bottom right, #4F46E508, #7C3AED08, #EC489908)'
      },
      collegeName: 'EXAMINERS',
      collegeId: 'default'
    };
  }
  
  const [roomTypeFilter, setRoomTypeFilter] = useState<'all' | RoomType>('all');
  
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomStats, setRoomStats] = useState<RoomStats[]>([]);
  const [allRoomStats, setAllRoomStats] = useState<RoomStats[]>([]);

  // Refs for click-outside detection
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Statuses from constants
  const [statuses] = useState<string[]>(['all', ROOM_STATUS.AVAILABLE, ROOM_STATUS.BUSY]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch room statistics
  useEffect(() => {
    const loadRoomStats = async () => {
      if (!activeCollegeId) {
        setRoomStats([]);
        setAllRoomStats([]);
        setIsLoadingRooms(false);
        return;
      }

      try {
        setIsLoadingRooms(true);
        
        // Fetch ALL stats first (for filter button counts)
        const allStats = await firebaseService.getRoomStats(
          activeCollegeId,
          undefined,
          undefined
        );
        setAllRoomStats(allStats);
        
        // Apply filters
        let filteredStats = [...allStats];
        
        // Filter by status
        if (selectedStatus !== 'all') {
          filteredStats = filteredStats.filter(room => room.room_status === selectedStatus);
        }
        
        // Filter by room type
        if (roomTypeFilter !== 'all') {
          filteredStats = filteredStats.filter(room => room.room_type === roomTypeFilter);
        }
        
        setRoomStats(filteredStats);
      } catch (error) {
        console.error('Error loading room stats:', error);
        setRoomStats([]);
        setAllRoomStats([]);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    loadRoomStats();
  }, [activeCollegeId, selectedStatus, roomTypeFilter, refreshTrigger]);

  // Auto-select first room when data loads
  useEffect(() => {
    if (!externalSelectedRoom && roomStats.length > 0) {
      onRoomSelect?.(roomStats[0]);
    } else if (roomStats.length === 0) {
      onRoomSelect?.(null);
    }
  }, [roomStats]);

  // Filter room stats based on room type filter
  const filteredRoomStats = roomStats.filter(room => {
    if (roomTypeFilter === 'all') return true;
    return room.room_type === roomTypeFilter;
  });

  // Calculate total rooms for each filter type from ALL stats (not filtered)
  const totalRoomsByType = {
    all: allRoomStats.length,
    [ROOM_TYPES.CLASSROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.CLASSROOM).length,
    [ROOM_TYPES.ADMIN_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.ADMIN_ROOM).length,
    [ROOM_TYPES.LIBRARY]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.LIBRARY).length,
    [ROOM_TYPES.LAB]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.LAB).length,
    [ROOM_TYPES.COMPUTER_LAB]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.COMPUTER_LAB).length,
    [ROOM_TYPES.SCIENCE_LAB]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.SCIENCE_LAB).length,
    [ROOM_TYPES.HALL]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.HALL).length,
    [ROOM_TYPES.AUDITORIUM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.AUDITORIUM).length,
    [ROOM_TYPES.LOUNGE]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.LOUNGE).length,
    [ROOM_TYPES.CONFERENCE_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.CONFERENCE_ROOM).length,
    [ROOM_TYPES.FACULTY_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.FACULTY_ROOM).length,
    [ROOM_TYPES.CAFETERIA]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.CAFETERIA).length,
    [ROOM_TYPES.SPORTS_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.SPORTS_ROOM).length,
    [ROOM_TYPES.MUSIC_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.MUSIC_ROOM).length,
    [ROOM_TYPES.ART_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.ART_ROOM).length,
    [ROOM_TYPES.SEMINAR_HALL]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.SEMINAR_HALL).length,
    [ROOM_TYPES.WORKSHOP]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.WORKSHOP).length,
    [ROOM_TYPES.STORAGE]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.STORAGE).length,
    [ROOM_TYPES.SERVER_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.SERVER_ROOM).length,
    [ROOM_TYPES.MEDICAL_ROOM]: allRoomStats.filter(r => r.room_type === ROOM_TYPES.MEDICAL_ROOM).length,
  };

  // Icon mapping for room types
  const getRoomTypeIcon = (type: RoomType | 'all') => {
    switch(type) {
      case ROOM_TYPES.CLASSROOM: return faChalkboardTeacher;
      case ROOM_TYPES.ADMIN_ROOM: return faUserTie;
      case ROOM_TYPES.LIBRARY: return faBookOpen;
      case ROOM_TYPES.LAB: return faFlask;
      case ROOM_TYPES.COMPUTER_LAB: return faLaptop;
      case ROOM_TYPES.SCIENCE_LAB: return faFlask;
      case ROOM_TYPES.HALL: return faBuilding;
      case ROOM_TYPES.AUDITORIUM: return faUsers;
      case ROOM_TYPES.LOUNGE: return faCouch;
      case ROOM_TYPES.CONFERENCE_ROOM: return faUsers;
      case ROOM_TYPES.FACULTY_ROOM: return faGraduationCap;
      case ROOM_TYPES.CAFETERIA: return faUtensils;
      case ROOM_TYPES.SPORTS_ROOM: return faBaseball;
      case ROOM_TYPES.MUSIC_ROOM: return faMusic;
      case ROOM_TYPES.ART_ROOM: return faPaintBrush;
      case ROOM_TYPES.SEMINAR_HALL: return faUsers;
      case ROOM_TYPES.WORKSHOP: return faHammer;
      case ROOM_TYPES.STORAGE: return faBox;
      case ROOM_TYPES.SERVER_ROOM: return faServer;
      case ROOM_TYPES.MEDICAL_ROOM: return faBriefcaseMedical;
      default: return faDoorOpen;
    }
  };

  return (
    <>
      <div className="sticky top-0 z-[100] bg-white px-6 py-4 pb-3 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <FontAwesomeIcon icon={faDoorOpen} className="text-gray-900" />
            <h2 className="text-2xl font-bold text-gray-900">Rooms</h2>
            
            {/* Status Dropdown */}
            <div ref={statusDropdownRef} className="relative status-dropdown-container z-[999]">
              <button 
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <FontAwesomeIcon icon={faCalendarAlt} />
                <span>{selectedStatus === 'all' ? 'Status' : ROOM_STATUS_LABELS[selectedStatus as RoomStatus]}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Menu */}
              {isStatusDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setSelectedStatus(status);
                        setIsStatusDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        selectedStatus === status 
                          ? 'font-medium' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      style={selectedStatus === status ? {
                        backgroundColor: `${brandTheme.colors.primary}15`,
                        color: brandTheme.colors.primary
                      } : {}}
                    >
                      {status === 'all' ? 'All Status' : ROOM_STATUS_LABELS[status as RoomStatus]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {onCollapse && (
            <button 
              onClick={onCollapse}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Collapse"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
          )}
        </div>
      
        {/* Room Type Filter Buttons */}
        <div className="bg-gray-50 -mx-6 px-6 py-4 flex border-t border-gray-200">
          {/* Sticky All Button */}
          <button 
            onClick={() => setRoomTypeFilter('all')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
              roomTypeFilter === 'all' ? 'text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={roomTypeFilter === 'all' ? { 
              background: brandTheme.gradients.primary
            } : {}}
          >
            <FontAwesomeIcon icon={faDoorOpen} />
            <span>All</span>
            <span className="ml-1 text-xs font-semibold">{totalRoomsByType.all}</span>
          </button>
          
          {/* Scrollable Container for Other Filters - Dynamically Generated */}
          <div className="flex space-x-2 overflow-x-auto ml-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {Object.values(ROOM_TYPES).map((roomType) => (
              <button 
                key={roomType}
                onClick={() => setRoomTypeFilter(roomType)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                  roomTypeFilter === roomType ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={roomTypeFilter === roomType ? { 
                  backgroundColor: `${brandTheme.colors.primary}20`, 
                  color: brandTheme.colors.primary 
                } : {}}
              >
                <FontAwesomeIcon icon={getRoomTypeIcon(roomType)} />
                <span>{ROOM_TYPE_LABELS[roomType]}</span>
                <span className="ml-1 text-xs font-semibold">{totalRoomsByType[roomType]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Room Cards */}
      <div className="p-6 space-y-4 overflow-y-auto flex-1">
        {isLoadingRooms ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: brandTheme.colors.primary }}></div>
            <p className="mt-4 text-gray-600">Loading rooms...</p>
          </div>
        ) : filteredRoomStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            {/* Beautiful SVG Illustration */}
            <div className="mb-8">
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background Circle */}
                <circle cx="100" cy="100" r="90" fill="#F3F4F6" opacity="0.5"/>
                
                {/* Door Frame */}
                <rect x="65" y="50" width="70" height="100" rx="4" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2"/>
                
                {/* Door */}
                <rect x="70" y="55" width="60" height="90" rx="3" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="2"/>
                
                {/* Door Handle */}
                <circle cx="115" cy="100" r="4" fill="#6B7280"/>
                <rect x="115" y="98" width="8" height="4" rx="2" fill="#6B7280"/>
                
                {/* Door Panels */}
                <rect x="77" y="62" width="46" height="35" rx="2" fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="1"/>
                <rect x="77" y="103" width="46" height="35" rx="2" fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="1"/>
                
                {/* Magnifying Glass */}
                <circle cx="140" cy="140" r="20" fill="none" stroke={brandTheme.colors.primary} strokeWidth="3"/>
                <circle cx="140" cy="140" r="12" fill={`${brandTheme.colors.primary}20`}/>
                <line x1="154" y1="154" x2="168" y2="168" stroke={brandTheme.colors.primary} strokeWidth="3" strokeLinecap="round"/>
                
                {/* Question Mark */}
                <text x="100" y="110" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold" fill="#9CA3AF" textAnchor="middle">?</text>
              </svg>
            </div>
            
            {/* Text Content */}
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No {roomTypeFilter === 'all' ? 'rooms' : ROOM_TYPE_LABELS[roomTypeFilter as RoomType].toLowerCase()} found
            </h3>
            <p className="text-gray-500 text-center max-w-sm mb-6">
              {roomTypeFilter === 'all' 
                ? 'There are no rooms available at the moment. Try creating a new room to get started.' 
                : `There are no ${ROOM_TYPE_LABELS[roomTypeFilter as RoomType].toLowerCase()} available. Try selecting a different room type or create a new room.`
              }
            </p>
            
            {/* Action Hint */}
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Use the toggle above to switch between room types</span>
            </div>
          </div>
        ) : (
          filteredRoomStats.map((room) => (
            <div
              key={room.room_id}
              onClick={() => onRoomSelect?.(room)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                externalSelectedRoom?.room_id === room.room_id
                  ? 'shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              style={externalSelectedRoom?.room_id === room.room_id ? {
                borderColor: brandTheme.colors.primary,
                backgroundColor: `${brandTheme.colors.primary}05`
              } : {}}
            >
              {/* LINE 1: Icon + Room Name + Status Badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <FontAwesomeIcon 
                    icon={getRoomTypeIcon(room.room_type as RoomType)} 
                    className="text-2xl"
                    style={{ color: brandTheme.colors.primary }}
                  />
                  <h3 className="font-bold text-lg text-gray-900">{room.room_name}</h3>
                </div>
                
                <span
                  className="px-4 py-1 rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: room.room_status === ROOM_STATUS.AVAILABLE 
                      ? '#D1FAE5' 
                      : '#FEE2E2',
                    color: room.room_status === ROOM_STATUS.AVAILABLE 
                      ? '#059669' 
                      : '#DC2626'
                  }}
                >
                  {ROOM_STATUS_LABELS[room.room_status as RoomStatus]}
                </span>
              </div>
              
              {/* LINE 2: Room Type + Capacity + Matrix */}
              <div className="flex items-center space-x-6 mb-2 text-gray-600">
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faBuilding} className="text-gray-400" />
                  <span className="text-sm">{ROOM_TYPE_LABELS[room.room_type as RoomType]}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                  <span className="text-sm">Capacity: {room.room_capacity}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faBuilding} className="text-gray-400" />
                  <span className="text-sm">{room.sitting_matrix}</span>
                </div>
              </div>
              
              {/* LINE 3: Address + View Details */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon 
                    icon={faLocationDot} 
                    className="text-blue-500" 
                  />
                  <span className="text-sm text-gray-900">
                    {room.room_address || 'Address will go here.....'}
                  </span>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRoomSelect?.(room);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  style={{ color: brandTheme.colors.primary }}
                  title="View Details"
                >
                  <FontAwesomeIcon icon={faEllipsis} className="text-lg" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}