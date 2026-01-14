import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faXmark, 
  faPlus, 
  faSave, 
  faCheckCircle, 
  faExclamationCircle, 
  faChevronDown, 
  faBuilding, 
  faMapMarkerAlt, 
  faUsers, 
  faGrid, 
  faUser,
  faFileLines,
  faDoorOpen,
  faSchool,
  faLaptop,
  faFlask,
  faBook,
  faUtensils,
  faFutbol,
  faMusic,
  faPalette,
  faGraduationCap,
  faWrench,
  faBoxes,
  faServer,
  faBriefcaseMedical,
  faTheaterMasks,
  faCouch,
  faPresentationScreen,
  faChalkboardUser
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { firebaseService } from './services/firebase_service';
import { 
  ROOM_STATUS,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  USER_TYPES,
  type RoomEventType,
  type RoomType
} from './constants';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkUpload: () => void;
  activeCollegeId: string;
  activeCollegeName: string;
  currentUser: any;
  isSuperUser: boolean;
  onRoomAdded: () => void;
  editMode?: boolean;  // NEW: Flag to indicate edit mode
  existingRoom?: {     // NEW: Existing room data for edit mode
    room_id: string;
    room_name: string;
    room_type: RoomType;
    room_address: string;
    room_capacity: number;
    sitting_matrix: string;
    room_incharge: string[];
  };
}

interface RoomSchedule {
  start_date_time: string;
  end_date_time: string;
  event: RoomEventType;
  users: string[];
}

interface RoomFormData {
  room_name: string;
  room_type: RoomType;
  room_address: string;
  room_capacity: number;
  sitting_matrix: string;
  room_schedule: RoomSchedule[];
  room_incharge: string[];
}


const roomTypes = [
  { value: ROOM_TYPES.CLASSROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.CLASSROOM], icon: faSchool },
  { value: ROOM_TYPES.ADMIN_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.ADMIN_ROOM], icon: faBuilding },
  { value: ROOM_TYPES.LIBRARY, label: ROOM_TYPE_LABELS[ROOM_TYPES.LIBRARY], icon: faBook },
  { value: ROOM_TYPES.LAB, label: ROOM_TYPE_LABELS[ROOM_TYPES.LAB], icon: faFlask },
  { value: ROOM_TYPES.COMPUTER_LAB, label: ROOM_TYPE_LABELS[ROOM_TYPES.COMPUTER_LAB], icon: faLaptop },
  { value: ROOM_TYPES.SCIENCE_LAB, label: ROOM_TYPE_LABELS[ROOM_TYPES.SCIENCE_LAB], icon: faFlask },
  { value: ROOM_TYPES.HALL, label: ROOM_TYPE_LABELS[ROOM_TYPES.HALL], icon: faBuilding },
  { value: ROOM_TYPES.AUDITORIUM, label: ROOM_TYPE_LABELS[ROOM_TYPES.AUDITORIUM], icon: faTheaterMasks },
  { value: ROOM_TYPES.LOUNGE, label: ROOM_TYPE_LABELS[ROOM_TYPES.LOUNGE], icon: faCouch },
  { value: ROOM_TYPES.CONFERENCE_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.CONFERENCE_ROOM], icon: faPresentationScreen },
  { value: ROOM_TYPES.FACULTY_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.FACULTY_ROOM], icon: faChalkboardUser },
  { value: ROOM_TYPES.CAFETERIA, label: ROOM_TYPE_LABELS[ROOM_TYPES.CAFETERIA], icon: faUtensils },
  { value: ROOM_TYPES.SPORTS_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.SPORTS_ROOM], icon: faFutbol },
  { value: ROOM_TYPES.MUSIC_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.MUSIC_ROOM], icon: faMusic },
  { value: ROOM_TYPES.ART_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.ART_ROOM], icon: faPalette },
  { value: ROOM_TYPES.SEMINAR_HALL, label: ROOM_TYPE_LABELS[ROOM_TYPES.SEMINAR_HALL], icon: faGraduationCap },
  { value: ROOM_TYPES.WORKSHOP, label: ROOM_TYPE_LABELS[ROOM_TYPES.WORKSHOP], icon: faWrench },
  { value: ROOM_TYPES.STORAGE, label: ROOM_TYPE_LABELS[ROOM_TYPES.STORAGE], icon: faBoxes },
  { value: ROOM_TYPES.SERVER_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.SERVER_ROOM], icon: faServer },
  { value: ROOM_TYPES.MEDICAL_ROOM, label: ROOM_TYPE_LABELS[ROOM_TYPES.MEDICAL_ROOM], icon: faBriefcaseMedical }
];

export default function CreateRoomModal({
  isOpen,
  onClose,
  onBulkUpload,
  activeCollegeId,
  currentUser,
  onRoomAdded,
  editMode = false,
  existingRoom
}: CreateRoomModalProps) {
  const brandTheme = useBrand();
  const [view, setView] = useState<'choice' | 'form' | 'success'>('choice');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  const [formData, setFormData] = useState<RoomFormData>({
    room_name: '',
    room_type: ROOM_TYPES.CLASSROOM,
    room_address: '',
    room_capacity: 0,
    sitting_matrix: '',
    room_schedule: [],
    room_incharge: []
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editMode && existingRoom) {
        // Edit mode: pre-fill with existing data and skip choice view
        console.log('🔍 EDIT MODE - Existing Room:', existingRoom);
        console.log('🔍 Room In-charge array:', existingRoom.room_incharge);
        setView('form');
        setError(null);
        setErrors({});
        setFormData({
          room_name: existingRoom.room_name,
          room_type: existingRoom.room_type,
          room_address: existingRoom.room_address,
          room_capacity: existingRoom.room_capacity,
          sitting_matrix: existingRoom.sitting_matrix,
          room_schedule: [],
          room_incharge: existingRoom.room_incharge || []
        });
        console.log('🔍 Form data set with room_incharge:', existingRoom.room_incharge || []);
      } else {
        // Create mode: reset to defaults
        setView('choice');
        setError(null);
        setErrors({});
        setFormData({
          room_name: '',
          room_type: ROOM_TYPES.CLASSROOM,
          room_address: '',
          room_capacity: 0,
          sitting_matrix: '',
          room_schedule: [],
          room_incharge: []
        });
      }
    }
  }, [isOpen, editMode, existingRoom]);

  // Load users when switching to form view
  useEffect(() => {
    const loadUsers = async () => {
      if (!activeCollegeId || view !== 'form') return;
      
      setIsLoadingUsers(true);
      try {
        const collegeUsers = await firebaseService.getCollegeUsers(activeCollegeId);
        const eligibleUsers = collegeUsers.filter(user =>
          [USER_TYPES.TEACHER, USER_TYPES.DEAN, USER_TYPES.PRINCIPAL, USER_TYPES.ADMIN].includes(user.userType as any)
        );
        setUsers(eligibleUsers);
      } catch (error) {
        console.error('Error loading users:', error);
        setError('Failed to load users. You can still create the room without assigning in-charge.');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    if (view === 'form') {
      loadUsers();
    }
  }, [activeCollegeId, view]);

  const handleClose = () => {
    setView('choice');
    setError(null);
    setErrors({});
    onClose();
  };

  const handleInputChange = (field: keyof RoomFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.room_name.trim()) {
      newErrors.room_name = 'Room name is required';
    }
    if (!formData.room_address.trim()) {
      newErrors.room_address = 'Room address is required';
    }
    if (formData.room_capacity <= 0) {
      newErrors.room_capacity = 'Room capacity must be greater than 0';
    }
    if (!formData.sitting_matrix.trim()) {
      newErrors.sitting_matrix = 'Sitting matrix is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setError('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editMode && existingRoom) {
        // Edit mode: update existing room
        await firebaseService.updateRoom(existingRoom.room_id, {
          room_name: formData.room_name.trim(),
          room_type: formData.room_type,
          room_address: formData.room_address.trim(),
          room_capacity: formData.room_capacity,
          sitting_matrix: formData.sitting_matrix.trim(),
          room_incharge: formData.room_incharge
        }, currentUser?.uid || 'unknown');
        
        setView('success');
        setTimeout(() => {
          onRoomAdded();
          handleClose();
        }, 2000);
      } else {
        // Create mode: add new room
        const roomData = {
          college_id: activeCollegeId,
          room_name: formData.room_name.trim(),
          room_type: formData.room_type,
          room_address: formData.room_address.trim(),
          room_capacity: formData.room_capacity,
          sitting_matrix: formData.sitting_matrix.trim(),
          room_status: ROOM_STATUS.AVAILABLE, // Set default status for new rooms
          room_schedule: formData.room_schedule,
          room_incharge: formData.room_incharge,
          created_by: currentUser?.uid || 'unknown'
        };

        const roomId = await firebaseService.addRoom(roomData);
        
        if (roomId) {
          setView('success');
          setTimeout(() => {
            onRoomAdded();
            handleClose();
          }, 2000);
        } else {
          setError('Failed to create room. Please try again.');
        }
      }
    } catch (error) {
      console.error(editMode ? 'Error updating room:' : 'Error adding room:', error);
      setError(error instanceof Error ? error.message : `Failed to ${editMode ? 'update' : 'create'} room. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes bounceIn {
            0% {
              opacity: 0;
              transform: scale(0.3);
            }
            50% {
              transform: scale(1.05);
            }
            70% {
              transform: scale(0.9);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div 
          className={`bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden ${view === 'form' ? 'flex flex-col' : ''}`}
          style={{ maxWidth: view === 'choice' ? '700px' : '1000px', maxHeight: '90vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          
          
          {/* Choice View */}
          {view === 'choice' && (
            <>
              <div className="px-8 py-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Create Room</h2>
                    <p className="text-sm text-gray-500 mt-1">Choose how you want to add rooms</p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FontAwesomeIcon icon={faXmark} size="lg" className="text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-2 gap-6">
                  {/* Bulk Upload Option */}
                  <button
                    onClick={() => {
                      onBulkUpload();
                      handleClose();
                    }}
                    className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-xl"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        <FontAwesomeIcon icon={faFileLines} size="2x" className="text-white" />
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Bulk Upload</h3>
                        <p className="text-sm text-gray-600">
                          Upload multiple rooms at once using Excel file
                        </p>
                      </div>

                      <div className="space-y-1.5 text-xs text-gray-600">
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span>Fast & Efficient</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span>Supports Excel/CSV</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span>Add 100s at once</span>
                        </div>
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300"></div>
                  </button>

                  {/* Manual Creation Option */}
                  <button
                    onClick={() => setView('form')}
                    className="group relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-xl"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300"
                        style={{ background: brandTheme.gradients.secondary || brandTheme.gradients.primary }}
                      >
                        <FontAwesomeIcon icon={faPlus} size="2x" className="text-white" />
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Manual Creation</h3>
                        <p className="text-sm text-gray-600">
                          Create rooms one by one with full control
                        </p>
                      </div>

                      <div className="space-y-1.5 text-xs text-gray-600">
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                          <span>Full Customization</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                          <span>Set Capacity</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                          <span>Assign In-charge</span>
                        </div>
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-purple-500 opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300"></div>
                  </button>
                </div>

                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">💡 Tip:</span> Use Bulk Upload for importing existing room inventory, 
                    and Manual Creation for adding detailed room information with schedules and in-charge assignments.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Form View - BEAUTIFUL REDESIGN */}
          {view === 'form' && (
            <>
              {/* Beautiful Gradient Header */}
              <div 
                className="px-6 py-5 relative overflow-hidden"
                style={{ background: brandTheme.gradients.primary }}
              >
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full translate-x-20 translate-y-20"></div>
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <FontAwesomeIcon icon={faDoorOpen} size="lg" className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{editMode ? 'Edit Room' : 'Create New Room'}</h2>
                      <p className="text-white/90 text-sm">{editMode ? 'Update the room details below' : 'Fill in the room details below'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-colors"
                    disabled={isSubmitting}
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                <div className="px-6 py-6 space-y-6">
                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-start space-x-3 rounded-lg">
                      <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-900">Error</p>
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Basic Information Card */}
                  <div className="border-2 rounded-xl p-5"
                    style={{ 
                      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                      borderColor: brandTheme.colors.primary + '33'
                    }}>
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: brandTheme.colors.primary + '20' }}>
                        <FontAwesomeIcon icon={faBuilding} size="lg" style={{ color: brandTheme.colors.primary }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Basic Information</h3>
                        <p className="text-xs text-gray-600">Enter the room details</p>
                      </div>
                    </div>

                    <div className="space-y-4 bg-white rounded-lg p-4">
                      {/* Room Name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Room Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.room_name}
                          onChange={(e) => handleInputChange('room_name', e.target.value)}
                          placeholder="e.g., Room 101, Auditorium, Library Hall"
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                            errors.room_name ? 'border-red-500' : 'border-gray-200 focus:border-blue-300'
                          }`}
                        />
                        {errors.room_name && (
                          <p className="text-red-500 text-xs mt-1.5 flex items-center">
                            <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                            {errors.room_name}
                          </p>
                        )}
                      </div>

                      {/* Room Type */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Room Type <span className="text-red-500">*</span>
                        </label>
                        <div className="relative dropdown-container">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === 'roomType' ? null : 'roomType')}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-left flex items-center justify-between hover:border-blue-300 transition-all"
                          >
                            <span className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: brandTheme.colors.primary + '15' }}>
                                <FontAwesomeIcon 
                                  icon={roomTypes.find(t => t.value === formData.room_type)?.icon || faBuilding}
                                  style={{ color: brandTheme.colors.primary }}
                                />
                              </div>
                              <span className="font-medium text-gray-900">
                                {roomTypes.find(t => t.value === formData.room_type)?.label}
                              </span>
                            </span>
                            <FontAwesomeIcon icon={faChevronDown} className="text-gray-400" />
                          </button>
                          {openDropdown === 'roomType' && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl z-20 max-h-64 overflow-y-auto">
                              {roomTypes.map((type) => (
                                <button
                                  key={type.value}
                                  onClick={() => {
                                    handleInputChange('room_type', type.value);
                                    setOpenDropdown(null);
                                  }}
                                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-all flex items-center space-x-3 ${
                                    formData.room_type === type.value ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: brandTheme.colors.primary + '15' }}>
                                    <FontAwesomeIcon icon={type.icon} style={{ color: brandTheme.colors.primary }} />
                                  </div>
                                  <span className="font-medium text-gray-900">{type.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Room Address */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Room Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            value={formData.room_address}
                            onChange={(e) => handleInputChange('room_address', e.target.value)}
                            placeholder="e.g., D Block, 2nd Floor, Campus"
                            className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                              errors.room_address ? 'border-red-500' : 'border-gray-200 focus:border-blue-300'
                            }`}
                          />
                        </div>
                        {errors.room_address && (
                          <p className="text-red-500 text-xs mt-1.5 flex items-center">
                            <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                            {errors.room_address}
                          </p>
                        )}
                      </div>

                      {/* Capacity and Sitting Matrix - Beautiful Side by Side */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Capacity <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                              <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                            </div>
                            <input
                              type="number"
                              value={formData.room_capacity || ''}
                              onChange={(e) => handleInputChange('room_capacity', parseInt(e.target.value))}
                              placeholder="e.g., 50"
                              className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                                errors.room_capacity ? 'border-red-500' : 'border-gray-200 focus:border-blue-300'
                              }`}
                            />
                          </div>
                          {errors.room_capacity && (
                            <p className="text-red-500 text-xs mt-1.5 flex items-center">
                              <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                              {errors.room_capacity}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Sitting Matrix <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                              <FontAwesomeIcon icon={faGrid} className="text-gray-400" />
                            </div>
                            <input
                              type="text"
                              value={formData.sitting_matrix}
                              onChange={(e) => handleInputChange('sitting_matrix', e.target.value)}
                              placeholder="e.g., 5x2+4+2"
                              className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                                errors.sitting_matrix ? 'border-red-500' : 'border-gray-200 focus:border-blue-300'
                              }`}
                            />
                          </div>
                          {errors.sitting_matrix && (
                            <p className="text-red-500 text-xs mt-1.5 flex items-center">
                              <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                              {errors.sitting_matrix}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Room In-charge Card */}
                  <div className="border-2 rounded-xl p-5"
                    style={{ 
                      background: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
                      borderColor: '#fdcb6e' + '33'
                    }}>
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/50">
                        <FontAwesomeIcon icon={faUser} size="lg" className="text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Room In-charge</h3>
                        <p className="text-xs text-gray-600">Assign responsible persons (Optional)</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4">
                      {isLoadingUsers ? (
                        <div className="text-center py-8">
                          <div className="w-8 h-8 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-xs text-gray-600">Loading users...</p>
                        </div>
                      ) : (
                        <>
                          {/* Show currently selected count */}
                          {formData.room_incharge.length > 0 && (
                            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm font-semibold text-blue-900">
                                {formData.room_incharge.length} {formData.room_incharge.length === 1 ? 'person' : 'people'} selected
                              </p>
                            </div>
                          )}

                          {/* Checkbox list of users */}
                          <div className="max-h-64 overflow-y-auto border-2 border-gray-200 rounded-xl divide-y divide-gray-100">
                            {users.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                No users available
                              </div>
                            ) : (
                              users.map((user, index) => {
                                // Use email as the unique identifier (since uid is undefined)
                                const userEmail = user.email || user.name;
                                
                                // Check if this user is selected
                                // room_incharge might contain "email (role)" format, so check both ways
                                const isSelected = formData.room_incharge.some(incharge => {
                                  // Check exact match with stored format: "email (role)"
                                  const expectedFormat = `${userEmail} (${user.userType})`;
                                  return incharge === expectedFormat || incharge === userEmail;
                                });
                                
                                console.log('🔍 User:', user.name, 'Email:', userEmail, 'Selected:', isSelected);
                                console.log('🔍 InCharge Array:', formData.room_incharge);
                                
                                return (
                                  <div
                                    key={`${userEmail}-${index}`}
                                    className={`flex items-center p-3 transition-colors ${
                                      isSelected 
                                        ? 'bg-blue-50 hover:bg-blue-100' 
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        // Store in format: "email (role)"
                                        const formattedId = `${userEmail} (${user.userType})`;
                                        
                                        if (e.target.checked) {
                                          // Add user to room_incharge
                                          const newArray = [...formData.room_incharge, formattedId];
                                          console.log('📝 Adding user:', formattedId);
                                          handleInputChange('room_incharge', newArray);
                                        } else {
                                          // Remove user from room_incharge (check both formats)
                                          const newArray = formData.room_incharge.filter(id => 
                                            id !== formattedId && id !== userEmail
                                          );
                                          console.log('📝 Removing user:', formattedId);
                                          handleInputChange('room_incharge', newArray);
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                    />
                                    <div className="ml-3 flex-1 cursor-pointer" onClick={() => {
                                      const formattedId = `${userEmail} (${user.userType})`;
                                      
                                      // Toggle selection when clicking the user info
                                      if (isSelected) {
                                        const newArray = formData.room_incharge.filter(id => 
                                          id !== formattedId && id !== userEmail
                                        );
                                        handleInputChange('room_incharge', newArray);
                                      } else {
                                        const newArray = [...formData.room_incharge, formattedId];
                                        handleInputChange('room_incharge', newArray);
                                      }
                                    }}>
                                      <div className="flex items-center space-x-2">
                                        <FontAwesomeIcon icon={faUser} className={isSelected ? 'text-blue-600' : 'text-gray-400'} />
                                        <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                          {user.name}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500 ml-5 mt-0.5">
                                        {user.email || user.userEmail || user.name} • {user.userType}
                                      </p>
                                    </div>
                                    {isSelected && (
                                      <div className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                        Selected
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-2 flex items-center">
                            <FontAwesomeIcon icon={faUser} className="mr-1.5 text-gray-400" />
                            Select one or more users as room in-charge
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Beautiful Action Buttons */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-end space-x-3">
                  {editMode ? (
                    // Edit mode: Show Cancel and Update Room buttons side by side
                    <>
                      <button
                        onClick={() => {
                          onClose();
                        }}
                        className="px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-100 transition-all"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-8 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faSave} />
                            <span>Update Room</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    // Create mode: Show Back button on left, Create Room on right
                    <>
                      <button
                        onClick={() => setView('choice')}
                        className="px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-100 transition-all mr-auto"
                        disabled={isSubmitting}
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-8 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faSave} />
                            <span>Create Room</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Success View */}
          {view === 'success' && (
            <div className="flex flex-col items-center justify-center p-12">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                style={{ background: brandTheme.gradients.primary }}
              >
                <FontAwesomeIcon icon={faCheckCircle} size="2x" className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Room Created Successfully!</h3>
              <p className="text-gray-600">Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}