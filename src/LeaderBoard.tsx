import { useState, useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrophy,
  faAward,
  faMedal,
  faChevronDown,
  faGraduationCap,
  faBookOpen,
  faSpinnerThird,
  faStar,
  faChartLine,
  faCrown,
  faRankingStar
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { USER_TYPES } from './constants';

// ============================================
// STAR RATING HELPERS
// ============================================

/**
 * Calculate star rating based on average percentage
 */
const getStarRating = (averagePercentage: number): number => {
  if (averagePercentage >= 90) return 5;
  if (averagePercentage >= 75) return 4;
  if (averagePercentage >= 60) return 3;
  if (averagePercentage >= 40) return 2;
  return 1;
};

/**
 * Get star color based on rating
 */
const getStarColor = (rating: number): string => {
  if (rating === 5) return 'text-yellow-400';
  if (rating === 4) return 'text-yellow-500';
  if (rating === 3) return 'text-orange-400';
  if (rating === 2) return 'text-orange-500';
  return 'text-red-400';
};

/**
 * Stars Display Component
 */
const StarsDisplay = ({ rating, size = 'sm' }: { rating: number; size?: 'xs' | 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex items-center space-x-0.5 ${sizeClasses[size]}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FontAwesomeIcon
          key={star}
          icon={faStar}
          className={star <= rating ? getStarColor(rating) : 'text-gray-300'}
        />
      ))}
    </div>
  );
};

// ============================================
// INTERFACES
// ============================================


interface Student {
  userId: string;
  name: string;
  rollNumber?: string; 
  collegeId: string;
  class: string;
  board: string;
  totalMarks: number;
  totalExams: number;
  averagePercentage: number;
  rank: number;
}

interface LeaderBoardProps {
  activeCollegeId: string | null;
  selectedYear: string;
  brandTheme: any;
  currentUser: any;
  allYears: string[];
  allClasses: string[];
  allSubjects: string[];
}

function LeaderBoard({
  activeCollegeId,
  selectedYear,
  brandTheme,
  currentUser,
  allYears,
  allClasses,
  allSubjects
}: LeaderBoardProps) {
  // Filter states
  const [filterYear, setFilterYear] = useState(selectedYear || 'all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  
  // Data state
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;
  
  // Dropdown states
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  
  // Dropdown refs for click outside detection
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);
  
  // Check if user is student
  const isStudent = currentUser?.userType === USER_TYPES.STUDENT;

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setShowYearDropdown(false);
      }
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setShowClassDropdown(false);
      }
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node)) {
        setShowSubjectDropdown(false);
      }
    };

    if (showYearDropdown || showClassDropdown || showSubjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showYearDropdown, showClassDropdown, showSubjectDropdown]);

  // Update filter year when selectedYear prop changes
  useEffect(() => {
    if (selectedYear) {
      setFilterYear(selectedYear);
    }
  }, [selectedYear]);

  // Fetch and calculate leaderboard data
  useEffect(() => {
    const fetchLeaderBoard = async () => {
      if (!activeCollegeId) return;
      
      setIsLoading(true);
      setStudents([]);
      setLastDocId(null);
      setHasMore(false);
      try {
        const result = await firebaseService.getLeaderboardPaginated(activeCollegeId, {
          academicYear: filterYear !== 'all' ? filterYear : undefined,
          class: filterClass !== 'all' ? filterClass : undefined,
          subject: filterSubject !== 'all' ? filterSubject : undefined,
          pageSize: PAGE_SIZE,
          lastDocId: null,
        });

        const studentsArray: Student[] = result.students.map((student, index) => ({
          userId: student.userId,
          name: student.userName,
          rollNumber: student.rollNumber,
          collegeId: student.collegeId,
          class: student.class,
          board: student.board,
          totalMarks: student.totalMarks,
          totalExams: student.totalExams,
          averagePercentage: student.averagePercentage,
          rank: index + 1
        }));
        
        setStudents(studentsArray);
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
        setTotalCount(result.totalCount);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLeaderBoard();
  }, [activeCollegeId, filterYear, filterClass, filterSubject, currentUser, isStudent]);

  // Load more handler
  const loadMore = async () => {
    if (!activeCollegeId || !hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const result = await firebaseService.getLeaderboardPaginated(activeCollegeId, {
        academicYear: filterYear !== 'all' ? filterYear : undefined,
        class: filterClass !== 'all' ? filterClass : undefined,
        subject: filterSubject !== 'all' ? filterSubject : undefined,
        pageSize: PAGE_SIZE,
        lastDocId,
      });

      const currentCount = students.length;
      const newStudents: Student[] = result.students.map((student, index) => ({
        userId: student.userId,
        name: student.userName,
        rollNumber: student.rollNumber,
        collegeId: student.collegeId,
        class: student.class,
        board: student.board,
        totalMarks: student.totalMarks,
        totalExams: student.totalExams,
        averagePercentage: student.averagePercentage,
        rank: currentCount + index + 1
      }));
      
      setStudents(prev => [...prev, ...newStudents]);
      setHasMore(result.hasMore);
      setLastDocId(result.lastDocId);
    } catch (error) {
      console.error('Error loading more leaderboard data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Get top 3 students
  const topThree = useMemo(() => students.slice(0, 3), [students]);

  // Get filter description (reserved for future use)
  // const getFilterDescription = () => {
  //   const parts = [];
  //   if (filterYear !== 'all') parts.push(`Year: ${filterYear}`);
  //   if (filterClass !== 'all') parts.push(`Class: ${filterClass}`);
  //   if (filterSubject !== 'all') parts.push(`Subject: ${filterSubject}`);
  //   return parts.length > 0 ? parts.join(' • ') : 'All Students';
  // };

  // Get medal color
  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-yellow-400 to-yellow-600';
      case 2: return 'from-gray-300 to-gray-500';
      case 3: return 'from-orange-400 to-orange-600';
      default: return 'from-gray-200 to-gray-400';
    }
  };

  // Get trophy icon based on rank
  const getTrophyIcon = (rank: number) => {
    switch (rank) {
      case 1: return faCrown;
      case 2: return faTrophy;
      case 3: return faMedal;
      default: return faAward;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ background: brandTheme.gradients.primary }}
            >
              <FontAwesomeIcon icon={faTrophy} className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leader Board</h1>
              <p className="text-sm text-gray-500">Student performance rankings</p>
            </div>
          </div>

          {/* Star Ratings Legend */}
          <div className="flex items-center space-x-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg px-4 py-2 border border-yellow-200">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon icon={faStar} className="text-yellow-400 text-sm" />
              <span className="text-xs font-semibold text-gray-700">Star Ratings:</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <StarsDisplay rating={5} size="xs" />
                <span className="text-xs text-gray-600">90%+</span>
              </div>
              <div className="flex items-center space-x-1">
                <StarsDisplay rating={4} size="xs" />
                <span className="text-xs text-gray-600">75-89%</span>
              </div>
              <div className="flex items-center space-x-1">
                <StarsDisplay rating={3} size="xs" />
                <span className="text-xs text-gray-600">60-74%</span>
              </div>
              <div className="flex items-center space-x-1">
                <StarsDisplay rating={2} size="xs" />
                <span className="text-xs text-gray-600">40-59%</span>
              </div>
              <div className="flex items-center space-x-1">
                <StarsDisplay rating={1} size="xs" />
                <span className="text-xs text-gray-600">&lt;40%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Academic Year Filter */}
          <div className="relative">
            <div className="relative" ref={yearDropdownRef}>
              <button
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-left hover:border-gray-300 focus:outline-none focus:ring-2 transition-all flex items-center justify-between"
                style={{
                  ['--tw-ring-color' as any]: brandTheme.colors.primary + '40'
                }}
              >
                <span className="text-gray-900 font-medium flex items-center gap-2">
                  <FontAwesomeIcon icon={faGraduationCap} className="text-gray-400" />
                  {filterYear === 'all' ? 'All Years' : filterYear}
                </span>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`text-gray-400 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`}
                />
              </button>
              
              {showYearDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                  <button
                    onClick={() => {
                      setFilterYear('all');
                      setFilterClass('all');
                      setFilterSubject('all');
                      setShowYearDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all border-b border-gray-100 ${
                      filterYear === 'all' ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    ✓ All Years
                  </button>
                  {allYears.map(year => (
                    <button
                      key={year}
                      onClick={() => {
                        setFilterYear(year);
                        setFilterClass('all');
                        setFilterSubject('all');
                        setShowYearDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all border-b border-gray-100 last:border-b-0 ${
                        filterYear === year ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {filterYear === year && '✓ '}{year}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Class Filter */}
          <div className="relative">
            <div className="relative" ref={classDropdownRef}>
              <button
                onClick={() => setShowClassDropdown(!showClassDropdown)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-left hover:border-gray-300 focus:outline-none focus:ring-2 transition-all flex items-center justify-between"
                style={{
                  ['--tw-ring-color' as any]: brandTheme.colors.primary + '40'
                }}
              >
                <span className="text-gray-900 font-medium flex items-center gap-2">
                  <FontAwesomeIcon icon={faBookOpen} className="text-gray-400" />
                  {filterClass === 'all' ? 'All Classes' : `Class ${filterClass}`}
                </span>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`text-gray-400 transition-transform ${showClassDropdown ? 'rotate-180' : ''}`}
                />
              </button>
              
              {showClassDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                  <button
                    onClick={() => {
                      setFilterClass('all');
                      setFilterSubject('all');
                      setShowClassDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all border-b border-gray-100 ${
                      filterClass === 'all' ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    ✓ All Classes
                  </button>
                  {allClasses.map(cls => (
                    <button
                      key={cls}
                      onClick={() => {
                        setFilterClass(cls);
                        setFilterSubject('all');
                        setShowClassDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all border-b border-gray-100 last:border-b-0 ${
                        filterClass === cls ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {filterClass === cls && '✓ '}Class {cls}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subject Filter */}
          <div className="relative">
            <div className="relative" ref={subjectDropdownRef}>
              <button
                onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-left hover:border-gray-300 focus:outline-none focus:ring-2 transition-all flex items-center justify-between"
                style={{
                  ['--tw-ring-color' as any]: brandTheme.colors.primary + '40'
                }}
              >
                <span className="text-gray-900 font-medium flex items-center gap-2">
                  <FontAwesomeIcon icon={faChartLine} className="text-gray-400" />
                  {filterSubject === 'all' ? 'All Subjects' : filterSubject}
                </span>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`text-gray-400 transition-transform ${showSubjectDropdown ? 'rotate-180' : ''}`}
                />
              </button>
              
              {showSubjectDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                  <button
                    onClick={() => {
                      setFilterSubject('all');
                      setShowSubjectDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all border-b border-gray-100 ${
                      filterSubject === 'all' ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    ✓ All Subjects
                  </button>
                  {allSubjects.map(subject => (
                    <button
                      key={subject}
                      onClick={() => {
                        setFilterSubject(subject);
                        setShowSubjectDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all border-b border-gray-100 last:border-b-0 ${
                        filterSubject === subject ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {filterSubject === subject && '✓ '}{subject}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Description removed - Total Students moved to Rankings header */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FontAwesomeIcon 
                icon={faSpinnerThird} 
                className="text-5xl text-gray-400 mb-4 animate-spin" 
              />
              <p className="text-gray-500 font-medium">Loading leaderboard...</p>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FontAwesomeIcon 
                icon={faTrophy} 
                className="text-6xl text-gray-300 mb-4" 
              />
              <p className="text-gray-500 font-medium">No results found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-hidden p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Leaderboard Table - Takes 2 columns */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                <div 
                  className="px-6 py-4 text-white font-semibold flex items-center justify-between"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <span className="text-lg">Rankings</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium opacity-90">Total Students:</span>
                    <span className="bg-white/20 px-2.5 py-0.5 rounded-md text-sm font-bold">
                      {totalCount || students.length}
                    </span>
                    <FontAwesomeIcon icon={faRankingStar} className="text-xl ml-1" />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Class
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Exams
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Total Marks
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Average %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Rating
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student, index) => (
                        <tr 
                          key={student.userId}
                          className={`
                            hover:bg-gray-50 transition-colors
                            ${index < 3 ? 'bg-gradient-to-r from-yellow-50/40 to-transparent' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                          `}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {index < 3 ? (
                                <div 
                                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${getMedalColor(index + 1)} flex items-center justify-center text-white font-bold shadow-md`}
                                >
                                  {index + 1}
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-semibold">
                                  {index + 1}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                                {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-semibold text-gray-900">{student.name}</div>
                                <div className="text-xs text-gray-500">{student.rollNumber ? `Roll: ${student.rollNumber}` : student.board}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                             {student.class}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {student.totalExams}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-gray-900">
                              {student.totalMarks.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-gray-900">
                              {student.averagePercentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StarsDisplay rating={getStarRating(student.averagePercentage)} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Load More */}
                {hasMore && (
                  <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-center">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                      style={{ color: brandTheme?.colors?.primary || '#6366f1' }}
                    >
                      {isLoadingMore ? 'Loading...' : `Load More (${totalCount - students.length} remaining)`}
                    </button>
                  </div>
                )}
              </div>

              {/* Top 3 Champions - Takes 1 column */}
              <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                <div 
                  className="px-6 py-4 text-white font-semibold flex items-center justify-between"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  <span className="text-lg">Top Champions</span>
                  <FontAwesomeIcon icon={faCrown} className="text-xl" />
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {topThree.length > 0 ? (
                    <div className="space-y-6">
                      {topThree.map((student, index) => (
                        <div 
                          key={student.userId}
                          className={`
                            relative rounded-2xl p-6 border transition-all hover:scale-105
                            ${index === 0 ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-xl' : ''}
                            ${index === 1 ? 'border-gray-400 bg-gradient-to-br from-gray-50 to-slate-50 shadow-lg' : ''}
                            ${index === 2 ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-red-50 shadow-lg' : ''}
                          `}
                        >
                          {/* Rank Badge */}
                          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-gradient-to-br shadow-lg flex items-center justify-center border-4 border-white"
                            style={{
                              background: index === 0 
                                ? 'linear-gradient(to bottom right, #fbbf24, #f59e0b)' 
                                : index === 1 
                                ? 'linear-gradient(to bottom right, #d1d5db, #9ca3af)' 
                                : 'linear-gradient(to bottom right, #fb923c, #f97316)'
                            }}
                          >
                            <FontAwesomeIcon 
                              icon={getTrophyIcon(index + 1)} 
                              className="text-2xl text-white"
                            />
                          </div>

                          {/* Student Avatar */}
                          <div className="flex justify-center mb-4">
                            <div 
                              className={`
                                w-20 h-20 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl shadow-lg border-4 border-white
                                ${index === 0 ? 'from-yellow-400 to-amber-500' : ''}
                                ${index === 1 ? 'from-gray-300 to-gray-500' : ''}
                                ${index === 2 ? 'from-orange-400 to-red-500' : ''}
                              `}
                            >
                              {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                          </div>

                          {/* Student Name */}
                          <h3 className="text-center text-lg font-bold text-gray-900 mb-2">
                            {student.name}
                          </h3>

                        {/* Roll Number, Class & Board */}
                        <div className="flex items-center justify-center space-x-2 mb-4 flex-wrap gap-2">
                        {student.rollNumber && (
                            <span className="text-xs px-3 py-1 bg-white rounded-full font-semibold text-gray-700 shadow-sm">
                            Roll: {student.rollNumber}
                            </span>
                        )}
                        <span className="text-xs px-3 py-1 bg-white rounded-full font-semibold text-gray-700 shadow-sm">
                            Class {student.class}
                        </span>
                        <span className="text-xs px-3 py-1 bg-white rounded-full font-semibold text-gray-700 shadow-sm">
                            {student.board}
                        </span>
                        </div>

                          {/* Stars */}
                          <div className="flex justify-center mb-3">
                            <StarsDisplay rating={getStarRating(student.averagePercentage)} size="md" />
                          </div>

                          {/* Stats */}
                          <div className="space-y-3">
                            {/* Average Percentage */}
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Average
                                </span>
                                <span 
                                  className="text-2xl font-bold"
                                  style={{ color: brandTheme.colors.primary }}
                                >
                                  {student.averagePercentage.toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full transition-all"
                                  style={{ 
                                    width: `${Math.min(student.averagePercentage, 100)}%`,
                                    background: brandTheme.gradients.primary
                                  }}
                                />
                              </div>
                            </div>

                            {/* Other Stats */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                  Exams
                                </div>
                                <div className="text-xl font-bold text-gray-900">
                                  {student.totalExams}
                                </div>
                              </div>
                              <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                  Total Marks
                                </div>
                                <div className="text-xl font-bold text-gray-900">
                                  {student.totalMarks.toFixed(0)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Star Rating */}
                          <div className="flex items-center justify-center space-x-1 mt-4">
                            {[...Array(5)].map((_, i) => (
                              <FontAwesomeIcon 
                                key={i}
                                icon={faStar} 
                                className={`
                                  ${i < Math.floor(student.averagePercentage / 20) ? 'text-yellow-400' : 'text-gray-300'}
                                `}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FontAwesomeIcon 
                        icon={faTrophy} 
                        className="text-6xl text-gray-300 mb-4" 
                      />
                      <p className="text-gray-500 font-medium">No champions yet</p>
                      <p className="text-sm text-gray-400 mt-1">Complete exams to appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderBoard;