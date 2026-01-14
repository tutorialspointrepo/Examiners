import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faClock,
  faUser,
  faEnvelope,
  faNoteSticky,
  faUsers,
  faExclamationTriangle,
  faCheckCircle,
  faSpinner,
  faChevronLeft,
  faChevronRight,
  faBan,
  faDoorOpen
} from '@fortawesome/sharp-light-svg-icons';
import {
  getRoomAvailability,
  createRoomBooking,
  type RoomBookingRequest,
  type BookedSlot,
  formatDateForDisplay,
  formatTimeForDisplay,
  getDateRange
} from './services/roomSchedulingService';

interface ScheduleRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  roomCapacity: number;
  sittingMatrix: string;
  collegeId: string;
  userId: string;
  userName: string;
  userEmail: string;
  brandTheme: any;
  onSuccess?: () => void;
}

export default function ScheduleRoomModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  roomCapacity,
  sittingMatrix,
  collegeId,
  userId,
  userName,
  userEmail,
  brandTheme,
  onSuccess
}: ScheduleRoomModalProps) {
  const [step, setStep] = useState(1); // 1: Date & Time, 2: Details, 3: Confirmation
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<string>('');
  const [selectedEndDate, setSelectedEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [bookedSlots, setBookedSlots] = useState<Map<string, BookedSlot[]>>(new Map());
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Time slots from 9 AM to 10 PM
  const timeSlots = [];
  for (let hour = 9; hour <= 22; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      timeSlots.push(time);
    }
  }

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedStartDate('');
      setSelectedEndDate('');
      setStartTime('09:00');
      setEndTime('10:00');
      setPurpose('');
      setNotes('');
      setParticipantCount(1);
      setError('');
      setBookedSlots(new Map());
      setCurrentMonth(new Date());
    }
  }, [isOpen]);

  // Fetch availability when modal opens or month changes
  useEffect(() => {
    if (isOpen && roomId && collegeId) {
      fetchMonthAvailability();
    }
  }, [isOpen, currentMonth, roomId, collegeId]);

  // Fetch availability when dates change
  useEffect(() => {
    if (selectedStartDate && selectedEndDate) {
      fetchAvailability();
    }
  }, [selectedStartDate, selectedEndDate]);

  const fetchMonthAvailability = async () => {
    setIsLoadingAvailability(true);
    try {
      // Get first and last day of current month
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const startDate = formatDateString(firstDay);
      const endDate = formatDateString(lastDay);

      const result = await getRoomAvailability(
        roomId,
        collegeId,
        startDate,
        endDate
      );

      if (result.success) {
        // Group booked slots by date
        const slotsByDate = new Map<string, BookedSlot[]>();
        result.bookedSlots.forEach(slot => {
          const existing = slotsByDate.get(slot.date) || [];
          existing.push(slot);
          slotsByDate.set(slot.date, existing);
        });
        setBookedSlots(slotsByDate);
      }
    } catch (error) {
      console.error('Error fetching month availability:', error);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedStartDate || !selectedEndDate) return;

    setIsLoadingAvailability(true);
    try {
      const result = await getRoomAvailability(
        roomId,
        collegeId,
        selectedStartDate,
        selectedEndDate
      );

      if (result.success) {
        // Group booked slots by date
        const slotsByDate = new Map<string, BookedSlot[]>();
        result.bookedSlots.forEach(slot => {
          const existing = slotsByDate.get(slot.date) || [];
          existing.push(slot);
          slotsByDate.set(slot.date, existing);
        });
        setBookedSlots(slotsByDate);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDateDisabled = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Disable if past date or Sunday
    if (checkDate < today || checkDate.getDay() === 0) {
      return true;
    }
    
    // Disable if date has any bookings
    const dateStr = formatDateString(date);
    const bookings = bookedSlots.get(dateStr);
    if (bookings && bookings.length > 0) {
      return true; // Date is booked, disable it completely
    }
    
    return false;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!selectedStartDate || !selectedEndDate) return false;
    const dateStr = formatDateString(date);
    return dateStr >= selectedStartDate && dateStr <= selectedEndDate;
  };

  const isDateBooked = (date: Date): boolean => {
    const dateStr = formatDateString(date);
    return bookedSlots.has(dateStr) && bookedSlots.get(dateStr)!.length > 0;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;
    
    const dateStr = formatDateString(date);
    
    // If no start date, or if we're starting a new selection (both dates already set)
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Start new selection
      setSelectedStartDate(dateStr);
      setSelectedEndDate(''); // Clear end date to allow range selection
    } else {
      // We have a start date but no end date - complete the range
      if (dateStr >= selectedStartDate) {
        // Clicking a date after start - set as end date
        setSelectedEndDate(dateStr);
      } else {
        // Clicking a date before start - swap them
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(dateStr);
      }
    }
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleContinue = () => {
    if (step === 1) {
      if (!selectedStartDate || !selectedEndDate) {
        setError('Please select start and end dates');
        return;
      }
      if (!startTime || !endTime) {
        setError('Please select start and end times');
        return;
      }
      if (startTime >= endTime) {
        setError('End time must be after start time');
        return;
      }
      setError('');
      setStep(2);
    } else if (step === 2) {
      if (!purpose.trim()) {
        setError('Please enter the purpose of booking');
        return;
      }
      if (!participantCount || participantCount < 1) {
        setError('Please enter number of participants (minimum 1)');
        return;
      }
      if (participantCount > roomCapacity) {
        setError(`Number of participants (${participantCount}) exceeds room capacity (${roomCapacity})`);
        return;
      }
      setError('');
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const bookingData: RoomBookingRequest = {
        roomId,
        collegeId,
        userId,
        userName,
        userEmail,
        purpose: purpose.trim(),
        startDate: selectedStartDate,
        endDate: selectedEndDate,
        startTime,
        endTime,
        notes: notes.trim(),
        participantCount
      };

      const result = await createRoomBooking(bookingData);

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'Failed to create booking');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getBookingTooltip = (date: Date): BookedSlot[] | null => {
    const dateStr = formatDateString(date);
    return bookedSlots.get(dateStr) || null;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div 
          className="px-6 py-4 text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${brandTheme.colors.primary} 0%, ${brandTheme.colors.accent} 100%)`
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold">Schedule a Room</h2>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faXmark} className="text-lg" />
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <FontAwesomeIcon icon={faDoorOpen} className="text-white text-opacity-80" />
                <p className="text-white text-opacity-90 text-sm font-semibold">{roomName}</p>
                <span className="text-white text-opacity-50">•</span>
                <div className="flex items-center space-x-1.5 text-xs text-white text-opacity-80">
                  <FontAwesomeIcon icon={faUsers} className="text-white text-opacity-70" />
                  <span>{roomCapacity}</span>
                </div>
                <span className="text-white text-opacity-50">•</span>
                <div className="flex items-center space-x-1.5 text-xs text-white text-opacity-80">
                  <span>{sittingMatrix}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center space-x-3 mt-4 relative z-10">
            <div className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step >= 1 ? 'bg-white text-gray-900' : 'bg-white bg-opacity-30 text-white'
                }`}
              >
                1
              </div>
              <div className="ml-2">
                <p className={`text-xs font-semibold ${step >= 1 ? 'text-white' : 'text-white text-opacity-60'}`}>
                  Date & Time
                </p>
              </div>
            </div>
            
            <div className="flex-1 h-0.5 bg-white bg-opacity-30" />
            
            <div className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step >= 2 ? 'bg-white text-gray-900' : 'bg-white bg-opacity-30 text-white'
                }`}
              >
                2
              </div>
              <div className="ml-2">
                <p className={`text-xs font-semibold ${step >= 2 ? 'text-white' : 'text-white text-opacity-60'}`}>
                  Details
                </p>
              </div>
            </div>
            
            <div className="flex-1 h-0.5 bg-white bg-opacity-30" />
            
            <div className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step >= 3 ? 'bg-white text-gray-900' : 'bg-white bg-opacity-30 text-white'
                }`}
              >
                3
              </div>
              <div className="ml-2">
                <p className={`text-xs font-semibold ${step >= 3 ? 'text-white' : 'text-white text-opacity-60'}`}>
                  Confirm
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: Date & Time Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Calendar */}
                <div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
                    {/* Loading Overlay */}
                    {isLoadingAvailability && (
                      <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                        <div className="flex flex-col items-center space-y-2">
                          <FontAwesomeIcon 
                            icon={faSpinner} 
                            className="text-2xl animate-spin"
                            style={{ color: brandTheme.colors.primary }}
                          />
                          <span className="text-sm text-gray-600">Loading availability...</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={previousMonth}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <FontAwesomeIcon icon={faChevronLeft} />
                      </button>
                      
                      <h3 className="text-base font-bold">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      
                      <button
                        onClick={nextMonth}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {getDaysInMonth(currentMonth).map((date, index) => {
                        if (!date) {
                          return <div key={`empty-${index}`} className="aspect-square" />;
                        }

                        const dateStr = formatDateString(date);
                        const isDisabled = isDateDisabled(date);
                        const isInRange = isDateInRange(date);
                        const isBooked = isDateBooked(date);
                        const isStart = dateStr === selectedStartDate;
                        const isEnd = dateStr === selectedEndDate;
                        const bookingInfo = getBookingTooltip(date);

                        return (
                          <div
                            key={index}
                            className="aspect-square relative group"
                            onMouseEnter={() => setHoveredDate(dateStr)}
                            onMouseLeave={() => setHoveredDate(null)}
                          >
                            <button
                              onClick={() => handleDateClick(date)}
                              disabled={isDisabled}
                              className={`w-full h-full rounded-lg font-medium text-sm transition-all relative ${
                                isStart || isEnd
                                  ? 'text-white font-bold shadow-md'
                                  : isInRange
                                  ? 'bg-opacity-20 text-gray-900'
                                  : isDisabled && isBooked
                                  ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-200'
                                  : isDisabled
                                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : 'bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                              }`}
                              style={
                                isStart || isEnd
                                  ? { backgroundColor: brandTheme.colors.primary }
                                  : isInRange
                                  ? { backgroundColor: `${brandTheme.colors.primary}20` }
                                  : {}
                              }
                            >
                              {date.getDate()}
                              {isBooked && (
                                <div className="absolute top-0.5 right-0.5">
                                  <FontAwesomeIcon 
                                    icon={faBan} 
                                    className="text-red-400 text-xs" 
                                  />
                                </div>
                              )}
                            </button>

                            {/* Tooltip for booked dates */}
                            {hoveredDate === dateStr && bookingInfo && bookingInfo.length > 0 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 w-64">
                                <div className="bg-gray-900 text-white rounded-lg shadow-xl p-3 text-xs">
                                  <p className="font-semibold mb-2">Existing Bookings:</p>
                                  {bookingInfo.map((slot, idx) => (
                                    <div key={idx} className="mb-2 pb-2 border-b border-gray-700 last:border-0 last:mb-0 last:pb-0">
                                      <p className="font-medium">{slot.purpose}</p>
                                      <p className="text-gray-300">
                                        {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                                      </p>
                                      <p className="text-gray-400">{slot.userName}</p>
                                    </div>
                                  ))}
                                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                    <div className="border-8 border-transparent border-t-gray-900" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-center space-x-3 text-xs">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-4 h-4 rounded border border-gray-300 bg-white" />
                        <span className="text-gray-600">Available</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <div className="w-4 h-4 rounded bg-red-50 border border-red-200 relative">
                          <FontAwesomeIcon icon={faBan} className="text-red-400 text-[8px] absolute top-0 right-0" />
                        </div>
                        <span className="text-gray-600">Booked (Disabled)</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: brandTheme.colors.primary }}
                        />
                        <span className="text-gray-600">Selected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Time Selection */}
                <div className="space-y-3">
                  {selectedStartDate && (
                    <div className={`border rounded-lg p-4 ${
                      selectedEndDate 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <h4 className={`font-semibold text-sm mb-3 ${
                        selectedEndDate ? 'text-green-900' : 'text-blue-900'
                      }`}>
                        {selectedEndDate ? 'Selected Date' : 'Select End Date'}
                      </h4>
                      
                      {/* Single Day Booking - Show only one date */}
                      {selectedEndDate && selectedStartDate === selectedEndDate ? (
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            {formatDateForDisplay(selectedStartDate)}
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Single day booking
                          </p>
                        </div>
                      ) : selectedEndDate ? (
                        /* Multi-Day Booking - Show start and end dates */
                        <>
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-600 mb-0.5">Start Date</p>
                            <p className="text-sm font-medium text-green-800">
                              {formatDateForDisplay(selectedStartDate)}
                            </p>
                          </div>
                          
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-600 mb-0.5">End Date</p>
                            <p className="text-sm font-medium text-green-800">
                              {formatDateForDisplay(selectedEndDate)}
                            </p>
                          </div>
                          
                          <div className="pt-2 mt-2 border-t border-green-300">
                            <p className="text-xs font-semibold text-green-700">
                              Total: {getDateRange(selectedStartDate, selectedEndDate).length} day(s)
                            </p>
                          </div>
                        </>
                      ) : (
                        /* Only start date selected */
                        <>
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-600 mb-0.5">Start Date</p>
                            <p className="text-sm font-medium text-blue-800">
                              {formatDateForDisplay(selectedStartDate)}
                            </p>
                          </div>
                          <p className="text-xs text-blue-600 mt-2">
                            Click another date for multi-day booking, or continue for single day
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
                      <FontAwesomeIcon icon={faClock} className="mr-2" style={{ color: brandTheme.colors.accent }} />
                      Select Time
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Start Time
                        </label>
                        <select
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent"
                          style={{ '--tw-ring-color': brandTheme.colors.primary } as React.CSSProperties}
                        >
                          {timeSlots.map(time => (
                            <option key={time} value={time}>
                              {formatTimeForDisplay(time)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          End Time
                        </label>
                        <select
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent"
                          style={{}}
                        >
                          {timeSlots.map(time => (
                            <option key={time} value={time}>
                              {formatTimeForDisplay(time)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {startTime >= endTime && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 mt-0.5" />
                        <p className="text-sm text-red-700">End time must be after start time</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Booking Details */}
          {step === 2 && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
                <FontAwesomeIcon icon={faNoteSticky} className="text-blue-600 text-lg mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm mb-0.5">Provide booking details</h3>
                  <p className="text-xs text-blue-700">
                    Tell us about your booking to help us serve you better
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Purpose of Booking <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g., Team Meeting, Workshop, Seminar"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent"
                    style={{}}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Additional Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requirements or additional information..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent resize-none"
                    style={{}}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Expected Number of Participants <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={roomCapacity}
                    value={participantCount || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                      setParticipantCount(value);
                    }}
                    placeholder="Enter number of participants"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent ${
                      participantCount > roomCapacity 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300'
                    }`}
                    style={{}}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-500">
                      Room capacity: {roomCapacity} people
                    </p>
                    {participantCount > roomCapacity && (
                      <p className="text-xs text-red-600 font-semibold">
                        Exceeds capacity!
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Your Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 text-sm">
                      <FontAwesomeIcon icon={faUser} className="text-gray-400 w-5" />
                      <span className="text-gray-700"><span className="font-semibold">Name:</span> {userName}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <FontAwesomeIcon icon={faEnvelope} className="text-gray-400 w-5" />
                      <span className="text-gray-700"><span className="font-semibold">Email:</span> {userEmail}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start space-x-2">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 text-lg mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 text-sm mb-0.5">Review your booking</h3>
                  <p className="text-xs text-green-700">
                    Please review the details before confirming
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Room Info */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-0.5">{roomName}</h3>
                  <p className="text-xs text-gray-600">Room Booking Confirmation</p>
                </div>

                {/* Booking Details */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Date Range</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDateForDisplay(selectedStartDate)}
                      </p>
                      {selectedStartDate !== selectedEndDate && (
                        <p className="text-sm text-gray-600">
                          to {formatDateForDisplay(selectedEndDate)}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {getDateRange(selectedStartDate, selectedEndDate).length} day(s)
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Time</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatTimeForDisplay(startTime)} - {formatTimeForDisplay(endTime)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Indian Standard Time (IST)</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Purpose</p>
                    <p className="text-sm text-gray-900">{purpose}</p>
                  </div>

                  {notes && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</p>
                      <p className="text-sm text-gray-700">{notes}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Expected Participants</p>
                    <div className="flex items-center space-x-2">
                      <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">
                        {participantCount} {participantCount === 1 ? 'person' : 'people'}
                      </span>
                      <span className="text-xs text-gray-500">
                        (Room capacity: {roomCapacity})
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Booked By</p>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                        <span className="text-gray-900">{userName}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <FontAwesomeIcon icon={faEnvelope} className="text-gray-400" />
                        <span className="text-gray-700">{userEmail}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 text-xl mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (step > 1) {
                  setStep(step - 1);
                  setError('');
                } else {
                  onClose();
                }
              }}
              className="px-5 py-2 border border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={isSubmitting}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                onClick={handleContinue}
                className="px-6 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandTheme.colors.primary }}
                disabled={isLoadingAvailability}
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-6 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                style={{ backgroundColor: brandTheme.colors.primary }}
                disabled={isSubmitting}
              >
              {isSubmitting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Confirm Booking</span>
                </>
              )}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}