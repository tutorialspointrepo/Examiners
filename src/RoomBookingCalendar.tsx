import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faCalendar,
  faChair,
  faSpinner,
  faUsers,
  faDoorOpen
} from '@fortawesome/sharp-light-svg-icons';
import { getRoomAvailability, type BookedSlot } from './services/roomSchedulingService';

interface RoomBookingCalendarProps {
  roomId: string;
  roomName: string;
  roomCapacity: number;
  sittingMatrix: string;
  collegeId: string;
  brandTheme: any;
}

export default function RoomBookingCalendar({
  roomId,
  roomCapacity,
  sittingMatrix,
  collegeId,
  brandTheme
}: RoomBookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedSlots, setBookedSlots] = useState<Map<string, BookedSlot[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Safe theme colors with defaults
  const primaryColor = brandTheme?.colors?.primary || '#6366f1';
  const accentColor = brandTheme?.colors?.accent || '#6366f1';

  useEffect(() => {
    fetchMonthBookings();
  }, [currentMonth, roomId, collegeId]);

  const fetchMonthBookings = async () => {
    setIsLoading(true);
    try {
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const startDate = formatDateString(firstDay);
      const endDate = formatDateString(lastDay);

      const result = await getRoomAvailability(roomId, collegeId, startDate, endDate);

      if (result.success) {
        const slotsByDate = new Map<string, BookedSlot[]>();
        result.bookedSlots.forEach(slot => {
          const existing = slotsByDate.get(slot.date) || [];
          existing.push(slot);
          slotsByDate.set(slot.date, existing);
        });
        setBookedSlots(slotsByDate);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const isDateBooked = (date: Date): boolean => {
    const dateStr = formatDateString(date);
    return bookedSlots.has(dateStr) && bookedSlots.get(dateStr)!.length > 0;
  };

  const isDatePast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const getBookingInfo = (date: Date): BookedSlot[] | null => {
    const dateStr = formatDateString(date);
    return bookedSlots.get(dateStr) || null;
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatTimeForDisplay = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  /**
   * Parse intelligent sitting matrix patterns
   * Examples:
   * - "10x4" = 10 rows, 4 seats per row
   * - "10x2+4+2" = 10 rows, with 2 seats, aisle, 4 seats, aisle, 2 seats
   * - "8x3+3" = 8 rows, with 3 seats, aisle, 3 seats
   */
  const parseSittingMatrix = (matrixStr: string): { 
    rows: number; 
    seatGroups: number[]; 
    totalSeatsPerRow: number;
  } => {
    // Default fallback
    const defaultRows = Math.ceil(Math.sqrt(roomCapacity));
    const defaultSeats = Math.ceil(roomCapacity / defaultRows);
    
    // Match pattern: ROWSx(SEATS+SEATS+...)
    // e.g., "10x2+4+2" or "8x3+3" or simple "10x4"
    const match = matrixStr.match(/(\d+)\s*x\s*(.+)/i);
    
    if (!match) {
      return { 
        rows: defaultRows, 
        seatGroups: [defaultSeats], 
        totalSeatsPerRow: defaultSeats 
      };
    }
    
    const rows = parseInt(match[1]);
    const seatsPattern = match[2];
    
    // Split by + to get seat groups
    const seatGroups = seatsPattern.split('+').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    
    if (seatGroups.length === 0) {
      return { 
        rows: defaultRows, 
        seatGroups: [defaultSeats], 
        totalSeatsPerRow: defaultSeats 
      };
    }
    
    const totalSeatsPerRow = seatGroups.reduce((sum, seats) => sum + seats, 0);
    
    return { rows, seatGroups, totalSeatsPerRow };
  };

  // Generate seating visualization based on matrix type
  const renderSeatingMatrix = () => {
    const matrix = sittingMatrix.toLowerCase();
    const { rows, seatGroups, totalSeatsPerRow } = parseSittingMatrix(sittingMatrix);
    
    // Generate column labels for all seat groups
    const generateColumnLabels = () => {
      const labels: string[] = [];
      let currentCol = 0;
      
      seatGroups.forEach((groupSize) => {
        for (let i = 0; i < groupSize; i++) {
          labels.push(String.fromCharCode(65 + currentCol));
          currentCol++;
        }
      });
      
      return labels;
    };
    
    const columnLabels = generateColumnLabels();

    if (matrix.includes('theater') || matrix.includes('theatre')) {
      // Theater style - rows of seats with aisles
      return (
        <div className="inline-block mx-auto">
          {/* Column labels at top */}
          <div className="flex items-center mb-2">
            <div className="w-6 flex-shrink-0" /> {/* Space for row label - sticky column */}
            <div className="flex justify-center items-center">
              {seatGroups.map((groupSize, groupIndex) => (
                <div key={groupIndex} className="flex space-x-2">
                  {Array.from({ length: groupSize }).map((_, seatIndex) => {
                    const globalIndex = seatGroups.slice(0, groupIndex).reduce((sum, g) => sum + g, 0) + seatIndex;
                    return (
                      <div
                        key={seatIndex}
                        className="w-8 h-6 flex items-center justify-center text-xs font-bold text-gray-600"
                      >
                        {columnLabels[globalIndex]}
                      </div>
                    );
                  })}
                  {groupIndex < seatGroups.length - 1 && (
                    <div className="w-4" /> /* Aisle space */
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Rows with labels and aisles */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center">
              {/* Row number label - sticky on left */}
              <div className="w-6 flex-shrink-0 h-8 flex items-center justify-center text-xs font-bold text-gray-600 bg-gray-50">
                {rowIndex + 1}
              </div>
              
              {/* Seat groups with aisles */}
              <div className="flex justify-center items-center">
                {seatGroups.map((groupSize, groupIndex) => (
                  <div key={groupIndex} className="flex space-x-2">
                    {Array.from({ length: groupSize }).map((_, seatIndex) => {
                      const globalSeatIndex = seatGroups.slice(0, groupIndex).reduce((sum, g) => sum + g, 0) + seatIndex;
                      const seatNumber = rowIndex * totalSeatsPerRow + globalSeatIndex + 1;
                      
                      if (seatNumber > roomCapacity) {
                        return <div key={seatIndex} className="w-8 h-8" />;
                      }
                      
                      return (
                        <div
                          key={seatIndex}
                          className="w-8 h-8 rounded-t-lg flex items-center justify-center text-xs font-semibold relative group"
                          style={{ 
                            backgroundColor: primaryColor + '20',
                            border: `2px solid ${primaryColor}`
                          }}
                          title={`${columnLabels[globalSeatIndex]}${rowIndex + 1}`}
                        >
                          <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
                        </div>
                      );
                    })}
                    {groupIndex < seatGroups.length - 1 && (
                      <div className="w-4 h-8 flex items-center justify-center">
                        <div className="text-xs text-gray-400">│</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm font-semibold text-gray-700">STAGE</div>
          </div>
        </div>
      );
    } else if (matrix.includes('classroom')) {
      // Classroom style - use seat groups with aisles
      return (
        <div className="inline-block mx-auto">
          {/* Column labels at top */}
          <div className="flex items-center mb-2">
            <div className="w-6 flex-shrink-0" /> {/* Space for row label - sticky column */}
            <div className="flex justify-center items-center">
              {seatGroups.map((groupSize, groupIndex) => (
                <div key={groupIndex} className="flex space-x-2">
                  {Array.from({ length: groupSize }).map((_, seatIndex) => {
                    const globalIndex = seatGroups.slice(0, groupIndex).reduce((sum, g) => sum + g, 0) + seatIndex;
                    return (
                      <div
                        key={seatIndex}
                        className="w-8 h-6 flex items-center justify-center text-xs font-bold text-gray-600"
                      >
                        {columnLabels[globalIndex]}
                      </div>
                    );
                  })}
                  {groupIndex < seatGroups.length - 1 && (
                    <div className="w-4" /> /* Aisle space */
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Rows with labels and aisles */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center">
              {/* Row number label - sticky on left */}
              <div className="w-6 flex-shrink-0 h-8 flex items-center justify-center text-xs font-bold text-gray-600 bg-gray-50">
                {rowIndex + 1}
              </div>
              
              {/* Seat groups with aisles */}
              <div className="flex justify-center items-center">
                {seatGroups.map((groupSize, groupIndex) => (
                  <div key={groupIndex} className="flex space-x-2">
                    {Array.from({ length: groupSize }).map((_, seatIndex) => {
                      const globalSeatIndex = seatGroups.slice(0, groupIndex).reduce((sum, g) => sum + g, 0) + seatIndex;
                      const seatNumber = rowIndex * totalSeatsPerRow + globalSeatIndex + 1;
                      
                      if (seatNumber > roomCapacity) {
                        return <div key={seatIndex} className="w-8 h-8" />;
                      }
                      
                      return (
                        <div
                          key={seatIndex}
                          className="w-8 h-8 rounded flex items-center justify-center text-xs font-semibold"
                          style={{ 
                            backgroundColor: primaryColor + '20',
                            border: `2px solid ${primaryColor}`
                          }}
                          title={`${columnLabels[globalSeatIndex]}${rowIndex + 1}`}
                        >
                          <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
                        </div>
                      );
                    })}
                    {groupIndex < seatGroups.length - 1 && (
                      <div className="w-4 h-8 flex items-center justify-center">
                        <div className="text-xs text-gray-400">│</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm font-semibold text-gray-700 flex items-center justify-center space-x-2">
              <FontAwesomeIcon icon={faDoorOpen} className="text-gray-500" />
              <span>FRONT / BOARD</span>
            </div>
          </div>
        </div>
      );
    } else if (matrix.includes('u-shape') || matrix.includes('ushape')) {
      // U-Shape with labels
      const sideSeats = Math.floor(roomCapacity / 3);
      const bottomSeats = roomCapacity - (sideSeats * 2);
      
      return (
        <div className="relative space-y-2">
          {/* Column labels for top */}
          <div className="flex justify-between mb-2 px-4">
            <div className="flex space-x-2">
              <div className="w-8 h-6 flex items-center justify-center text-xs font-bold text-gray-600">
                1
              </div>
              {Array.from({ length: sideSeats }).map((_, i) => (
                <div key={i} className="w-8 h-6 flex items-center justify-center text-xs font-bold text-gray-600">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              {Array.from({ length: sideSeats }).map((_, i) => (
                <div key={i} className="w-8 h-6 flex items-center justify-center text-xs font-bold text-gray-600">
                  {String.fromCharCode(65 + sideSeats + i)}
                </div>
              ))}
              <div className="w-8 h-6 flex items-center justify-center text-xs font-bold text-gray-600">
                2
              </div>
            </div>
          </div>
          
          {/* Top sides */}
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <div className="w-8 h-8 flex items-center justify-center text-xs font-bold text-gray-600">1</div>
              {Array.from({ length: sideSeats }).map((_, i) => (
                <div
                  key={`left-${i}`}
                  className="w-8 h-8 rounded flex items-center justify-center"
                  style={{ 
                    backgroundColor: primaryColor + '20',
                    border: `2px solid ${primaryColor}`
                  }}
                  title={`${String.fromCharCode(65 + i)}1`}
                >
                  <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              {Array.from({ length: sideSeats }).map((_, i) => (
                <div
                  key={`right-${i}`}
                  className="w-8 h-8 rounded flex items-center justify-center"
                  style={{ 
                    backgroundColor: primaryColor + '20',
                    border: `2px solid ${primaryColor}`
                  }}
                  title={`${String.fromCharCode(65 + sideSeats + i)}2`}
                >
                  <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
                </div>
              ))}
              <div className="w-8 h-8 flex items-center justify-center text-xs font-bold text-gray-600">2</div>
            </div>
          </div>
          
          {/* Bottom */}
          <div className="flex justify-center items-center space-x-2 mt-4">
            <div className="w-8 h-8 flex items-center justify-center text-xs font-bold text-gray-600">3</div>
            {Array.from({ length: bottomSeats }).map((_, i) => (
              <div
                key={`bottom-${i}`}
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ 
                  backgroundColor: primaryColor + '20',
                  border: `2px solid ${primaryColor}`
                }}
                title={`${String.fromCharCode(65 + i)}3`}
              >
                <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
              </div>
            ))}
          </div>
          
          {/* Center table indicator */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-20 border border-dashed border-gray-400 rounded-lg flex items-center justify-center">
            <span className="text-xs text-gray-500 font-semibold">TABLE</span>
          </div>
        </div>
      );
    } else if (matrix.includes('boardroom') || matrix.includes('conference')) {
      // Boardroom - rectangular table with labels
      const longSideSeats = Math.floor(roomCapacity / 2);
      const shortSideSeats = Math.ceil((roomCapacity - longSideSeats * 2) / 2);
      
      return (
        <div className="relative space-y-2">
          {/* Top row with labels */}
          <div className="flex justify-center items-center space-x-2">
            <div className="w-8 h-8 flex items-center justify-center text-xs font-bold text-gray-600">1</div>
            {Array.from({ length: longSideSeats }).map((_, i) => (
              <div
                key={`top-${i}`}
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ 
                  backgroundColor: primaryColor + '20',
                  border: `2px solid ${primaryColor}`
                }}
                title={`${String.fromCharCode(65 + i)}1`}
              >
                <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
              </div>
            ))}
          </div>
          
          {/* Column labels for top */}
          <div className="flex justify-center items-center space-x-2">
            <div className="w-8" />
            {Array.from({ length: longSideSeats }).map((_, i) => (
              <div key={i} className="w-8 h-6 flex items-center justify-center text-xs font-bold text-gray-600">
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          
          {/* Sides */}
          <div className="flex justify-between items-center">
            <div className="flex flex-col items-center space-y-2">
              <div className="text-xs font-bold text-gray-600">A</div>
              {Array.from({ length: shortSideSeats }).map((_, i) => (
                <div key={i} className="flex items-center space-x-1">
                  <div className="w-6 text-xs font-bold text-gray-600 text-right">{i + 1}</div>
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center"
                    style={{ 
                      backgroundColor: primaryColor + '20',
                      border: `2px solid ${primaryColor}`
                    }}
                    title={`A${i + 1}`}
                  >
                    <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="w-32 flex items-center justify-center">
              <span className="text-xs text-gray-500 font-semibold">TABLE</span>
            </div>
            
            <div className="flex flex-col items-center space-y-2">
              <div className="text-xs font-bold text-gray-600">B</div>
              {Array.from({ length: shortSideSeats }).map((_, i) => (
                <div key={i} className="flex items-center space-x-1">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center"
                    style={{ 
                      backgroundColor: primaryColor + '20',
                      border: `2px solid ${primaryColor}`
                    }}
                    title={`B${i + 1}`}
                  >
                    <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
                  </div>
                  <div className="w-6 text-xs font-bold text-gray-600">{i + 1}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Bottom row */}
          <div className="flex justify-center items-center space-x-2">
            <div className="w-8 h-8 flex items-center justify-center text-xs font-bold text-gray-600">2</div>
            {Array.from({ length: longSideSeats }).map((_, i) => (
              <div
                key={`bottom-${i}`}
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ 
                  backgroundColor: primaryColor + '20',
                  border: `2px solid ${primaryColor}`
                }}
                title={`${String.fromCharCode(65 + i)}2`}
              >
                <FontAwesomeIcon icon={faChair} style={{ color: primaryColor }} />
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      // Default grid layout with intelligent seat groups and aisles
      return (
        <div className="inline-block mx-auto">
          {/* Column labels at top */}
          <div className="flex items-center mb-1">
            <div className="w-5 flex-shrink-0" /> {/* Space for row label - sticky column */}
            <div className="flex justify-center items-center">
              {seatGroups.map((groupSize, groupIndex) => (
                <div key={groupIndex} className="flex gap-1">
                  {Array.from({ length: groupSize }).map((_, seatIndex) => {
                    const globalIndex = seatGroups.slice(0, groupIndex).reduce((sum, g) => sum + g, 0) + seatIndex;
                    return (
                      <div
                        key={seatIndex}
                        className="w-6 h-5 flex items-center justify-center text-[10px] font-bold text-gray-600"
                      >
                        {columnLabels[globalIndex]}
                      </div>
                    );
                  })}
                  {groupIndex < seatGroups.length - 1 && (
                    <div className="w-3" /> /* Aisle space */
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Rows with labels and aisles */}
          <div className="flex flex-col gap-1">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex items-center">
                {/* Row number label - sticky on left */}
                <div className="w-5 flex-shrink-0 h-6 flex items-center justify-center text-[10px] font-bold text-gray-600 bg-gray-50">
                  {rowIndex + 1}
                </div>
                
                {/* Seat groups with aisles */}
                <div className="flex justify-center items-center">
                  {seatGroups.map((groupSize, groupIndex) => (
                    <div key={groupIndex} className="flex gap-1">
                      {Array.from({ length: groupSize }).map((_, seatIndex) => {
                        const globalSeatIndex = seatGroups.slice(0, groupIndex).reduce((sum, g) => sum + g, 0) + seatIndex;
                        const seatNumber = rowIndex * totalSeatsPerRow + globalSeatIndex + 1;
                        
                        if (seatNumber > roomCapacity) {
                          return <div key={seatIndex} className="w-6 h-6" />;
                        }
                        
                        return (
                          <div
                            key={seatIndex}
                            className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-semibold"
                            style={{ 
                              backgroundColor: primaryColor + '20',
                              border: `1.5px solid ${primaryColor}`
                            }}
                            title={`${columnLabels[globalSeatIndex]}${rowIndex + 1}`}
                          >
                            <FontAwesomeIcon icon={faChair} className="text-[10px]" style={{ color: primaryColor }} />
                          </div>
                        );
                      })}
                      {groupIndex < seatGroups.length - 1 && (
                        <div className="w-3 h-6 flex items-center justify-center">
                          <div className="text-[10px] text-gray-400">│</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <FontAwesomeIcon icon={faCalendar} className="mr-2" style={{ color: accentColor }} />
          Booking Calendar
        </h3>
        
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
              <FontAwesomeIcon 
                icon={faSpinner} 
                className="text-2xl animate-spin"
                style={{ color: primaryColor }}
              />
            </div>
          )}
          
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            
            <h4 className="text-base font-bold">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h4>
            
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
              const isBooked = isDateBooked(date);
              const isPast = isDatePast(date);
              const bookingInfo = getBookingInfo(date);

              return (
                <div
                  key={index}
                  className="aspect-square relative group"
                  onMouseEnter={() => setHoveredDate(dateStr)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  <div
                    className={`w-full h-full rounded-lg font-medium text-xs flex items-center justify-center transition-all relative ${
                      isPast
                        ? 'bg-gray-50 text-gray-300'
                        : isBooked
                        ? 'bg-red-50 text-red-700 border border-red-200 font-semibold'
                        : 'bg-white border border-gray-200 text-gray-700'
                    }`}
                  >
                    {date.getDate()}
                  </div>

                  {/* Tooltip for booked dates */}
                  {hoveredDate === dateStr && bookingInfo && bookingInfo.length > 0 && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 w-56">
                      <div className="bg-gray-900 text-white rounded-lg shadow-xl p-3 text-xs">
                        <p className="font-semibold mb-2">Bookings ({bookingInfo.length}):</p>
                        {bookingInfo.slice(0, 3).map((slot, idx) => (
                          <div key={idx} className="mb-2 pb-2 border-b border-gray-700 last:border-0 last:mb-0 last:pb-0">
                            <p className="font-medium">{slot.purpose}</p>
                            <p className="text-gray-300">
                              {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                            </p>
                          </div>
                        ))}
                        {bookingInfo.length > 3 && (
                          <p className="text-gray-400 text-center mt-1">+{bookingInfo.length - 3} more</p>
                        )}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                          <div className="border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5">
              <div className="w-4 h-4 rounded border border-gray-300 bg-white" />
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
              <span className="text-gray-600">Booked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seating Matrix Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <FontAwesomeIcon icon={faChair} className="mr-2" style={{ color: accentColor }} />
          Seating Layout
        </h3>
        
        <div className="mb-4 flex items-center space-x-6 text-sm text-gray-700">
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon icon={faUsers} className="text-gray-500" />
            <span className="font-semibold">Capacity:</span>
            <span>{roomCapacity} seats</span>
          </div>
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon icon={faDoorOpen} className="text-gray-500" />
            <span className="font-semibold">Sitting Matrix:</span>
            <span>{sittingMatrix}</span>
          </div>
        </div>

        <div 
          className="flex items-center justify-start min-h-[300px] py-4 pr-4 pl-2 bg-gray-50 rounded-lg overflow-x-auto"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <style>{`
            .overflow-x-auto::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {renderSeatingMatrix()}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>Visual representation of seating arrangement</p>
        </div>
      </div>
    </div>
  );
}