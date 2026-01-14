import { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faCalendarDays,
  faClipboardList,
  faClock,
  faUsers,
  faShield,
  faGraduationCap,
  faBuilding,
  faSpinnerThird
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { EXAM_STATUS, EXAM_MODES, USER_TYPES } from './constants';

interface Exam {
  id: string;
  type: string;
  typeColor: string;
  year: string;
  class: string;
  subject?: string;
  title: string;
  board: string;
  status: string;
  mode: string;
  securityLevel?: string;
  attendance?: boolean;
  examDate: string;
  examTime?: string;
  duration: string;
  totalQuestions: number;
  maxMarks: string;
  totalStudents?: number;
  createdAt: Date; // Changed from string to Date to match ExamModel
  createdBy: string;
  createdById?: string; // Made optional to match ExamModel
  createdByRole: string;
}

interface CalendarProps {
  activeCollegeId: string | null;
  selectedYear: string;
  brandTheme: any;
  currentUser: any;
  onExamSelect?: (exam: Exam) => void;
  onEventsCountChange?: (count: number) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  exams: Exam[];
}

function Calendar({
  activeCollegeId,
  selectedYear,
  brandTheme,
  currentUser,
  onExamSelect,
  onEventsCountChange
}: CalendarProps) {
  // Current date state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // Auto-select today
  
  // Data state
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  
  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Check if user is student
  const isStudent = currentUser?.userType === USER_TYPES.STUDENT;
  
  // Fetch exams
  useEffect(() => {
    const fetchExams = async () => {
      if (!activeCollegeId) return;
      
      setIsLoading(true);
      try {
        const examsData = await firebaseService.getExams(activeCollegeId, selectedYear);
        
        // Filter exams based on user role
        let filteredExams = examsData;
        const userType = currentUser?.userType;
        
        if (userType === USER_TYPES.STUDENT && currentUser) {
          // Students see only their class and board exams
          filteredExams = examsData.filter(exam => 
            exam.class === currentUser.studentClass && 
            exam.board === currentUser.board
          );
        } else if (userType === USER_TYPES.TEACHER && currentUser?.teacherClasses) {
          // Teachers see exams for classes they teach
          filteredExams = examsData.filter(exam => 
            currentUser.teacherClasses?.includes(exam.class)
          );
        }
        // Admins/Principals see all exams (no filtering needed)
        
        setAllExams(filteredExams);
      } catch (error) {
        console.error('Error fetching exams:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchExams();
  }, [activeCollegeId, selectedYear, currentUser, isStudent]);
  
  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDate(null);
    setSelectedExam(null);
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDate(null);
    setSelectedExam(null);
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
    setSelectedExam(null);
  };
  
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const totalDaysInMonth = lastDayOfMonth.getDate();
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Previous month days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        exams: []
      });
    }
    
    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      
      // Find exams for this date (using local date comparison to avoid timezone issues)
      const examsOnDate = allExams.filter(exam => {
        if (!exam.examDate) return false;
        const examDate = new Date(exam.examDate);
        // Compare year, month, and day locally (not UTC)
        return examDate.getFullYear() === date.getFullYear() &&
               examDate.getMonth() === date.getMonth() &&
               examDate.getDate() === date.getDate();
      });
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        exams: examsOnDate
      });
    }
    
    // Next month days to complete the grid
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        exams: []
      });
    }
    
    return days;
  }, [currentYear, currentMonth, allExams]);
  
  // Get exams for selected date
  const selectedDateExams = useMemo(() => {
    if (!selectedDate) return [];
    
    // Use local date comparison to avoid timezone issues
    return allExams.filter(exam => {
      if (!exam.examDate) return false;
      const examDate = new Date(exam.examDate);
      // Compare year, month, and day locally (not UTC)
      return examDate.getFullYear() === selectedDate.getFullYear() &&
             examDate.getMonth() === selectedDate.getMonth() &&
             examDate.getDate() === selectedDate.getDate();
    }).sort((a, b) => {
      // Sort by time if available
      if (a.examTime && b.examTime) {
        return a.examTime.localeCompare(b.examTime);
      }
      return 0;
    });
  }, [selectedDate, allExams]);

  // Update events count when selected date changes
  useEffect(() => {
    if (onEventsCountChange) {
      onEventsCountChange(selectedDateExams.length);
    }
  }, [selectedDateExams, onEventsCountChange]);
  
  // Handle day click
  const handleDayClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
    if (day.exams.length === 1) {
      setSelectedExam(day.exams[0]);
    } else {
      setSelectedExam(null);
    }
  };
  
  // Handle exam click
  const handleExamClick = (exam: Exam) => {
    setSelectedExam(exam);
    if (onExamSelect) {
      onExamSelect(exam);
    }
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case EXAM_STATUS.UPCOMING:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case EXAM_STATUS.ONGOING:
        return 'bg-green-100 text-green-700 border-green-200';
      case EXAM_STATUS.COMPLETED:
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case EXAM_STATUS.CANCELLED:
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };
  
  // Get mode icon
  const getModeIcon = (mode: string) => {
    switch (mode) {
      case EXAM_MODES.ONLINE:
        return faGraduationCap;
      case EXAM_MODES.OFFLINE:
        return faBuilding;
      case EXAM_MODES.HYBRID:
        return faUsers;
      default:
        return faClipboardList;
    }
  };
  
  // Format time
  const formatTime = (time?: string) => {
    if (!time) return 'Time TBD';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };
  
  // Format text for display (capitalize first letter)
  const formatText = (text: string) => {
    if (!text) return '';
    // Capitalize first letter of each word
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: brandTheme.gradients.primary }}
            >
              <FontAwesomeIcon icon={faCalendarDays} className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Exam Calendar</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {isStudent ? 'Your exam schedule' : 'Complete exam schedule'}
              </p>
            </div>
          </div>
          
          {/* Month Navigation - Centered */}
          <div className="flex items-center space-x-4 absolute left-1/2 transform -translate-x-1/2">
            <button
              onClick={goToPreviousMonth}
              className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-gray-700" />
            </button>
            
            <div className="text-center min-w-[200px]">
              <h2 className="text-xl font-bold text-gray-900">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {allExams.length} exam{allExams.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <button
              onClick={goToNextMonth}
              className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <FontAwesomeIcon icon={faChevronRight} className="text-gray-700" />
            </button>
          </div>
          
          {/* Today Button */}
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            style={{ background: brandTheme.gradients.primary }}
          >
            Today
          </button>
        </div>
      </div>
      
      {/* Calendar Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FontAwesomeIcon 
                icon={faSpinnerThird} 
                className="text-4xl text-gray-400 mb-4 animate-spin" 
              />
              <p className="text-gray-500">Loading calendar...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
            {/* Calendar Grid */}
            <div className="lg:col-span-2 flex">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-1 flex flex-col">
                {/* Day Headers */}
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                  {dayNames.map(day => (
                    <div
                      key={day}
                      className="py-3 text-center text-sm font-semibold text-gray-600"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar Days */}
                <div className="grid grid-cols-7 flex-1 overflow-auto">
                  {calendarDays.map((day, index) => {
                    const isSelected = selectedDate?.toDateString() === day.date.toDateString();
                    const hasExams = day.exams.length > 0;
                    
                    return (
                      <div
                        key={index}
                        onClick={() => day.isCurrentMonth && handleDayClick(day)}
                        className={`
                          relative min-h-[100px] p-2 border-b border-r border-gray-200
                          ${day.isCurrentMonth ? 'bg-white cursor-pointer hover:bg-gray-50' : 'bg-gray-50'}
                          ${isSelected ? 'ring-2 ring-inset' : ''}
                          ${day.isToday ? 'bg-blue-50' : ''}
                          transition-colors duration-150
                        `}
                        style={isSelected ? { '--tw-ring-color': brandTheme.colors.primary } as React.CSSProperties : {}}
                      >
                        {/* Date Number */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`
                              text-sm font-semibold
                              ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
                              ${day.isToday ? 'text-white bg-gradient-to-br from-blue-500 to-blue-600 w-7 h-7 rounded-full flex items-center justify-center' : ''}
                            `}
                          >
                            {day.date.getDate()}
                          </span>
                          
                          {/* Exam Count Badge */}
                          {hasExams && day.isCurrentMonth && (
                            <span 
                              className="text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center"
                              style={{ background: brandTheme.gradients.primary }}
                            >
                              {day.exams.length}
                            </span>
                          )}
                        </div>
                        
                        {/* Exam Indicators */}
                        {hasExams && day.isCurrentMonth && (
                          <div className="space-y-1">
                            {day.exams.slice(0, 2).map(exam => (
                              <div
                                key={exam.id}
                                className={`text-xs px-2 py-1 rounded truncate border ${getStatusColor(exam.status)}`}
                                title={exam.title}
                              >
                                {exam.subject || exam.title}
                              </div>
                            ))}
                            {day.exams.length > 2 && (
                              <div className="text-xs text-gray-500 px-2">
                                +{day.exams.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Exam Details Panel */}
            <div className="lg:col-span-1 flex">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col">
                <div 
                  className="px-6 py-4 text-white font-semibold"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  {selectedDate ? (
                    <>
                      <div className="text-sm opacity-90">Exams on</div>
                      <div className="text-lg">
                        {selectedDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-lg">Select a date</div>
                  )}
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto">
                  {selectedDate ? (
                    selectedDateExams.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDateExams.map(exam => (
                          <div
                            key={exam.id}
                            onClick={() => handleExamClick(exam)}
                            className={`
                              p-4 rounded-lg border cursor-pointer transition-all duration-200
                              ${selectedExam?.id === exam.id 
                                ? 'border-grey-400 bg-white hover:border-blue-300 hover:shadow-sm' 
                                : 'border-grey-200 hover:border-blue-300 hover:shadow-sm bg-white'
                              }
                            `}
                          >
                            {/* Exam Title */}
                            <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">
                              {exam.title}
                            </h3>
                            
                            {/* Subject & Class */}
                            <div className="flex items-center space-x-2 mb-2">
                              {exam.subject && (
                                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded font-semibold">
                                  {exam.subject}
                                </span>
                              )}
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-semibold">
                                Class {exam.class}
                              </span>
                            </div>
                            
                            {/* Time */}
                            <div className="flex items-center text-sm text-gray-600 mb-2">
                              <FontAwesomeIcon icon={faClock} className="w-4 mr-2" />
                              {formatTime(exam.examTime)}
                            </div>
                            
                            {/* Duration & Questions */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{exam.duration} min</span>
                              <span>{exam.totalQuestions} questions</span>
                              <span>{exam.maxMarks} marks</span>
                            </div>
                            
                            {/* Status Badge */}
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <span className={`inline-block text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(exam.status)}`}>
                                {formatText(exam.status)}
                              </span>
                            </div>
                            
                            {/* Mode & Security */}
                            <div className="mt-2 flex items-center space-x-2">
                              <div className="flex items-center text-xs text-gray-600">
                                <FontAwesomeIcon icon={getModeIcon(exam.mode)} className="w-3 mr-1" />
                                {formatText(exam.mode)}
                              </div>
                              {exam.securityLevel && (
                                <div className="flex items-center text-xs text-gray-600">
                                  <FontAwesomeIcon icon={faShield} className="w-3 mr-1" />
                                  {formatText(exam.securityLevel)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FontAwesomeIcon 
                          icon={faCalendarDays} 
                          className="text-6xl text-gray-300 mb-4" 
                        />
                        <p className="text-gray-500">No exams scheduled</p>
                        <p className="text-sm text-gray-400 mt-1">on this date</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-12">
                      <FontAwesomeIcon 
                        icon={faCalendarDays} 
                        className="text-6xl text-gray-300 mb-4" 
                      />
                      <p className="text-gray-500">Select a date</p>
                      <p className="text-sm text-gray-400 mt-1">to view exams</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-center space-x-6 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600"></div>
            <span className="text-gray-600">Today</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
            <span className="text-gray-600">Upcoming</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
            <span className="text-gray-600">Live</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></div>
            <span className="text-gray-600">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Calendar;