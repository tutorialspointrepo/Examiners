import React, { useState, useEffect, useRef } from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faIdCard,
  faGraduationCap,
  faChevronDown,
  faChevronLeft,
  faCalendar,
  faUsers,
  faClipboardList,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { FILTER_VALUES } from './constants';
import { getHallTicketGroups, diagnoseHallTicketGroups } from './services/roomSchedulingService';

interface HallTicketProps {
  activeCollegeId: string | null;
  selectedYear: string;
  brandTheme: any;
  onHallTicketSelect: (hallTicket: any) => void;
  selectedHallTicket: any;
  isMainCollapsed: boolean;
  onCollapse: () => void;
  onCreateHallTicket: () => void;
  currentUser: any;
}

const HallTicket: React.FC<HallTicketProps> = ({
  activeCollegeId,
  selectedYear,
  brandTheme,
  onHallTicketSelect,
  selectedHallTicket,
  onCollapse,
  currentUser,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'upcoming' | 'expired'>('all');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isExamTypeDropdownOpen, setIsExamTypeDropdownOpen] = useState(false);
  const [hallTicketGroups, setHallTicketGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>(FILTER_VALUES.ALL);
  const [selectedExamType, setSelectedExamType] = useState<string>(FILTER_VALUES.ALL);

  // College data
  const [classes, setClasses] = useState<string[]>([FILTER_VALUES.ALL]);
  const [examTypes, setExamTypes] = useState<string[]>([FILTER_VALUES.ALL]);

  // Refs for dropdown click outside detection
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const examTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Filter counts
  const allCount = hallTicketGroups.length;
  const activeCount = hallTicketGroups.filter((ht) => ht.status === 'active').length;
  const upcomingCount = hallTicketGroups.filter((ht) => ht.status === 'upcoming').length;
  const expiredCount = hallTicketGroups.filter((ht) => ht.status === 'expired').length;

  // Filtered hall ticket groups
  const filteredHallTicketGroups = hallTicketGroups.filter((ht) => {
    const statusMatch = activeFilter === 'all' || ht.status === activeFilter;
    const classMatch = selectedClass === FILTER_VALUES.ALL || ht.class === selectedClass;
    const examTypeMatch = selectedExamType === FILTER_VALUES.ALL || ht.examType === selectedExamType;
    return statusMatch && classMatch && examTypeMatch;
  });

  // Load college data (classes and exam types)
  useEffect(() => {
    const loadCollegeData = async () => {
      if (!activeCollegeId) {
        setClasses([FILTER_VALUES.ALL]);
        setExamTypes([FILTER_VALUES.ALL]);
        return;
      }

      try {
        const college = await firebaseService.getCollegeById(activeCollegeId);
        
        console.log('🏛️ College Document Loaded:', {
          collegeId: activeCollegeId,
          collegeName: college?.collegeName,
          hasValidClasses: !!college?.validClasses,
          validClasses: college?.validClasses,
          hasExamTypes: !!college?.examTypes,
          examTypes: college?.examTypes,
          rawCollege: college
        });
        
        if (college) {
          // Load classes
          if (college.validClasses && college.validClasses.length > 0) {
            setClasses([FILTER_VALUES.ALL, ...college.validClasses]);
            console.log('✅ Classes set:', [FILTER_VALUES.ALL, ...college.validClasses]);
          } else {
            setClasses([FILTER_VALUES.ALL]);
            console.warn('⚠️ No validClasses found in college document');
          }
          
          // Load exam types
          if (college.examTypes && college.examTypes.length > 0) {
            setExamTypes([FILTER_VALUES.ALL, ...college.examTypes]);
            console.log('✅ Exam Types set:', [FILTER_VALUES.ALL, ...college.examTypes]);
          } else {
            setExamTypes([FILTER_VALUES.ALL]);
            console.warn('⚠️ No examTypes found in college document');
            console.warn('⚠️ Check Firebase: Does your college document have an "examTypes" field (exact spelling)?');
          }
        } else {
          console.error('❌ College document not found for ID:', activeCollegeId);
        }
      } catch (error) {
        console.error('❌ Error loading college data:', error);
      }
    };

    loadCollegeData();
  }, [activeCollegeId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
      if (examTypeDropdownRef.current && !examTypeDropdownRef.current.contains(event.target as Node)) {
        setIsExamTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadHallTicketGroups();
  }, [activeCollegeId, selectedYear, currentUser]);

  // 🔥 AUTO-SELECT: Select first hall ticket group when groups load
  useEffect(() => {
    console.log('🔍 [AUTO-SELECT] Checking:', {
      groupsLoaded: hallTicketGroups.length,
      hasSelection: !!selectedHallTicket,
      firstGroupId: hallTicketGroups[0]?.id
    });
    
    if (hallTicketGroups.length > 0 && !selectedHallTicket) {
      console.log('✅ [AUTO-SELECT] Selecting first hall ticket group:', {
        id: hallTicketGroups[0].id,
        class: hallTicketGroups[0].class,
        examName: hallTicketGroups[0].examName
      });
      onHallTicketSelect(hallTicketGroups[0]);
    } else if (selectedHallTicket) {
      console.log('⏭️ [AUTO-SELECT] Already selected:', selectedHallTicket.id);
    }
  }, [hallTicketGroups]);

  const loadHallTicketGroups = async () => {
    setLoading(true);
    try {
      if (!activeCollegeId) {
        console.log('⚠️ No active college ID, skipping load');
        setHallTicketGroups([]);
        setLoading(false);
        return;
      }

      console.log('📋 Loading hall ticket groups from Firebase...', { 
        activeCollegeId, 
        selectedYear,
        currentUser: currentUser?.userId,
        userType: currentUser?.userType
      });
      
      // Fetch hall ticket groups from Firebase
      const filters: any = {
        academicYear: selectedYear,
      };
      
      // Students only fetch their own hall tickets
      if (currentUser?.userType === 'student' && currentUser?.userId) {
        filters.studentId = currentUser.userId;
      }
      
      const data = await getHallTicketGroups(activeCollegeId, filters);
      
      console.log('✅ Raw hall ticket groups from Firebase:', data.length, 'groups');
      
      // Run diagnostics if no groups found (skip for students - they may just have no hall tickets)
      if (data.length === 0 && currentUser?.userType !== 'student') {
        console.warn('⚠️ No hall ticket groups found. Running diagnostics...');
        await diagnoseHallTicketGroups();
      }
      
      // Filter already applied server-side for students via studentId query param
      let filteredData = data;
      
      // Map Firebase data to component format and determine status
      const mappedGroups = filteredData.map((group: any) => {
        // Determine status based on validity dates
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate date comparison
        
        const startDate = new Date(group.startDate);
        const endDate = new Date(group.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        let status = 'active';
        if (today < startDate) {
          status = 'upcoming';
        } else if (today > endDate) {
          status = 'expired';
        } else {
          status = 'active';
        }
        
        // Override with explicit status if present
        if (group.status) {
          status = group.status;
        }
        
        // Format venue from rooms array
        let venue = 'Not specified';
        if (group.rooms && group.rooms.length > 0) {
          if (group.rooms.length === 1) {
            venue = group.rooms[0].room_name || group.rooms[0].room_address || 'Room';
          } else {
            const roomNames = group.rooms.map((r: any) => r.room_name || r.room_address).filter(Boolean);
            venue = roomNames.length > 0 ? roomNames.join(', ') : `${group.rooms.length} Rooms`;
          }
        }
        
        return {
          id: group.id,
          hallTicketsGroupId: group.hallTicketsGroupId,
          examName: `${group.studentClass} - ${group.examType}`,
          examType: group.examType,
          class: group.studentClass,
          board: group.board || '',
          numberOfStudents: group.numberOfStudents || (group.students ? group.students.length : 0),
          validityFrom: group.startDate,
          validityTo: group.endDate,
          examDate: group.examStartDate || group.startDate,
          examTime: group.examStartTime || '',
          examEndTime: group.examEndTime || '',
          duration: group.examStartTime && group.examEndTime 
            ? calculateDuration(group.examStartTime, group.examEndTime)
            : '',
          venue: venue,
          status: status,
          createdDate: group.createdAt,
          year: group.academicYear,
          students: group.students || [],
          rooms: group.rooms || [],
          roomBookingIds: group.roomBookingIds || [],
          // Keep original data for reference
          _originalData: group
        };
      });
      
      console.log('✅ Mapped hall ticket groups:', mappedGroups.length, 'groups');
      console.log('📊 Status breakdown:', {
        active: mappedGroups.filter((g: any) => g.status === 'active').length,
        upcoming: mappedGroups.filter((g: any) => g.status === 'upcoming').length,
        expired: mappedGroups.filter((g: any) => g.status === 'expired').length
      });
      
      setHallTicketGroups(mappedGroups);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading hall ticket groups:', error);
      setHallTicketGroups([]);
      setLoading(false);
    }
  };
  
  // Helper function to calculate duration between two times
  const calculateDuration = (startTime: string, endTime: string): string => {
    try {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      const durationMinutes = endMinutes - startMinutes;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      
      if (hours > 0 && minutes > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
      } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        return `${minutes} minutes`;
      }
    } catch (e) {
      return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            ✅ Active
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
            📝 Upcoming
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
            ⏰ Expired
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 w-full max-w-full">
      {/* Top Header */}
      <div className="sticky top-0 z-[100] h-[72px] bg-white px-6 py-4 pb-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FontAwesomeIcon icon={faIdCard} style={{ fontSize: '28px' }} className="text-gray-900" />
            <h2 className="text-2xl font-bold text-gray-900">Hall Ticket Groups</h2>

            {/* Class Dropdown */}
            <div ref={classDropdownRef} className="relative class-dropdown-container">
              <button
                onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: '16px' }} />
                <span>{selectedClass === FILTER_VALUES.ALL ? 'Class' : selectedClass}</span>
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className={`transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isClassDropdownOpen && classDropdownRef.current && (() => {
                const buttonRect = classDropdownRef.current.getBoundingClientRect();
                return (
                  <div 
                    className="fixed bg-white rounded-xl shadow-2xl border border-gray-300 py-2 max-h-96 overflow-y-auto"
                    style={{
                      maxHeight: '400px',
                      zIndex: 999999,
                      top: `${buttonRect.bottom + 8}px`,
                      left: `${buttonRect.left}px`,
                      width: '176px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {classes.map((classItem) => (
                      <button
                        key={classItem}
                        onClick={() => {
                          setSelectedClass(classItem);
                          setIsClassDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          selectedClass === classItem ? 'font-medium' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        style={
                          selectedClass === classItem
                            ? {
                                backgroundColor: `${brandTheme.colors.primary}15`,
                                color: brandTheme.colors.primary,
                              }
                            : {}
                        }
                      >
                        {classItem === FILTER_VALUES.ALL ? 'All Classes' : classItem}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={onCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Filter Tabs Row - Sticky */}
      <div className="sticky top-0 z-[10] bg-white pt-4 px-6 border-b border-gray-200" style={{ paddingBottom: '20px' }}>
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* All Tab */}
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
              activeFilter === 'all'
                ? 'text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={
              activeFilter === 'all'
                ? { background: brandTheme.gradients.primary }
                : {}
            }
          >
            <span>📊</span>
            <span>All</span>
            <span className="ml-1 text-xs font-semibold">{allCount}</span>
          </button>

          {/* Upcoming Tab */}
          <button
            onClick={() => setActiveFilter('upcoming')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
              activeFilter === 'upcoming'
                ? 'shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={
              activeFilter === 'upcoming'
                ? {
                    backgroundColor: `${brandTheme.colors.primary}20`,
                    color: brandTheme.colors.primary,
                  }
                : {}
            }
          >
            <span>📝</span>
            <span>Upcoming</span>
            <span className="ml-1 text-xs font-semibold">{upcomingCount}</span>
          </button>

          {/* Active Tab */}
          <button
            onClick={() => setActiveFilter('active')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
              activeFilter === 'active'
                ? 'shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={
              activeFilter === 'active'
                ? {
                    backgroundColor: `${brandTheme.colors.primary}20`,
                    color: brandTheme.colors.primary,
                  }
                : {}
            }
          >
            <span>✅</span>
            <span>Active</span>
            <span className="ml-1 text-xs font-semibold">{activeCount}</span>
          </button>

          {/* Expired Tab */}
          <button
            onClick={() => setActiveFilter('expired')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
              activeFilter === 'expired'
                ? 'shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={
              activeFilter === 'expired'
                ? {
                    backgroundColor: `${brandTheme.colors.primary}20`,
                    color: brandTheme.colors.primary,
                  }
                : {}
            }
          >
            <span>⏰</span>
            <span>Expired</span>
            <span className="ml-1 text-xs font-semibold">{expiredCount}</span>
          </button>

          {/* Exam Type Filter */}
          <div ref={examTypeDropdownRef} className="relative ml-auto exam-type-dropdown">
            <button
              onClick={() => {
                console.log('📋 Exam Type Dropdown Clicked');
                console.log('Current examTypes state:', examTypes);
                console.log('Number of exam types:', examTypes.length);
                setIsExamTypeDropdownOpen(!isExamTypeDropdownOpen);
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 max-w-[180px]"
            >
              <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '16px' }} />
              <span className="truncate flex-1 min-w-0">
                {selectedExamType === FILTER_VALUES.ALL ? 'Exam Type' : selectedExamType}
              </span>
              <FontAwesomeIcon
                icon={faChevronDown}
                style={{ fontSize: '16px' }}
                className={`transition-transform flex-shrink-0 ${
                  isExamTypeDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isExamTypeDropdownOpen && examTypeDropdownRef.current && (() => {
              const buttonRect = examTypeDropdownRef.current.getBoundingClientRect();
              return (
                <div 
                  className="fixed bg-white rounded-xl shadow-2xl border border-gray-300 py-2 max-h-96 overflow-y-auto"
                  style={{ 
                    maxHeight: '400px',
                    zIndex: 999999,
                    top: `${buttonRect.bottom + 8}px`,
                    right: `${window.innerWidth - buttonRect.right}px`,
                    width: '192px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                {examTypes.length === 0 && (
                  <div className="px-4 py-2 text-sm text-gray-500">No exam types available</div>
                )}
                {examTypes.map((type, index) => {
                  console.log(`  ${index + 1}. Rendering exam type:`, type);
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        console.log('🎯 Exam type selected:', type);
                        setSelectedExamType(type);
                        setIsExamTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        selectedExamType === type ? 'font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      style={
                        selectedExamType === type
                          ? {
                              backgroundColor: `${brandTheme.colors.primary}15`,
                              color: brandTheme.colors.primary,
                            }
                          : {}
                      }
                    >
                      {type === FILTER_VALUES.ALL ? 'All Types' : type}
                    </button>
                  );
                })}
              </div>
            );
            })()}
          </div>
        </div>
      </div>

      {/* Count Display */}
      <div className="px-6 py-3 bg-white">
        <p className="text-sm text-gray-600">
          {filteredHallTicketGroups.length} hall ticket group{filteredHallTicketGroups.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Hall Ticket Groups List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border rounded-full animate-spin mb-4"
              style={{ 
                borderColor: brandTheme.colors.primary + '20',
                borderTopColor: brandTheme.colors.primary
              }}
            />
            <p className="text-gray-600 font-medium">Loading hall tickets...</p>
          </div>
        ) : filteredHallTicketGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <FontAwesomeIcon icon={faIdCard} style={{ fontSize: '80px' }} className="text-gray-300" />
              <div className="absolute -top-2 -right-4 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <div className="absolute top-4 -left-6 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="absolute -bottom-2 right-8 w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
            <p className="text-gray-700 font-semibold text-lg mb-2">
              {activeFilter !== 'all' ? `No ${activeFilter} hall ticket groups found` : 'No hall ticket groups found'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {activeFilter !== 'all'
                ? 'Try selecting a different status filter or clearing filters'
                : 'Create your first hall ticket group to get started!'}
            </p>
            {(activeFilter !== 'all' || selectedClass !== 'all' || selectedExamType !== 'all') && (
              <button
                onClick={() => {
                  setActiveFilter('all');
                  setSelectedClass('all');
                  setSelectedExamType('all');
                }}
                className="px-6 py-2.5 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                style={{ background: brandTheme.gradients.primary }}
              >
                Show All Groups
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredHallTicketGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => {
                  console.log('🖱️ [CLICK] Hall ticket group clicked:', group);
                  onHallTicketSelect(group);
                }}
                className={`bg-white rounded-2xl p-6 cursor-pointer transition-all duration-200 ${
                  selectedHallTicket?.id === group.id 
                    ? 'border-[1px] shadow-2xl scale-[1.02]' 
                    : 'border border-gray-200 hover:shadow-md hover:scale-[1.01]'
                }`}
                style={
                  selectedHallTicket?.id === group.id
                    ? {
                        backgroundColor: `${brandTheme.colors.primary}08`,
                        borderColor: brandTheme.colors.primary,
                        boxShadow: `0 0 0 3px ${brandTheme.colors.primary}15`,
                      } as React.CSSProperties
                    : {}
                }
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    {group.class}  Exams {group.year || '2025-26'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {selectedHallTicket?.id === group.id && (
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1"
                        style={{ backgroundColor: brandTheme.colors.primary }}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        Selected
                      </span>
                    )}
                    {getStatusBadge(group.status)}
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                  {/* Left Column - Number of Students */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FontAwesomeIcon icon={faUsers} className="text-blue-500 text-base" />
                      <p className="text-base text-gray-600">Number of Students</p>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{group.numberOfStudents}</p>
                  </div>

                  {/* Right Column - Exam Type */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FontAwesomeIcon icon={faClipboardList} className="text-purple-500 text-base" />
                      <p className="text-base text-gray-600">Exam</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-l font-bold text-gray-900">{group.examType}</p>
                      <span className="text-gray-400">•</span>
                    </div>
                  </div>
                </div>

                {/* Footer - Validity and View Detail Button */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendar} className="text-orange-500" />
                    <span className="text-sm text-gray-700">
                      <span className="font-semibold">Validity:</span>{' '}
                      <span className="font-medium">
                        {formatDate(group.validityFrom)}
                      </span>
                      <span className="text-gray-400 mx-2">to</span>
                      <span className="font-medium">
                        {formatDate(group.validityTo)}
                      </span>
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onHallTicketSelect(group);
                    }}
                    className="px-4 py-2 text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors"
                  >
                    View Detail
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default HallTicket;