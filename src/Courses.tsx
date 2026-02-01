import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faChevronLeft,
  faChevronRight,
  faBooks,
  faLayerGroup,
  faVideo,
  faCode,
  faFileAlt,
  faClock,
  faClipboardList,
  faClipboardCheck,
  faFilter,
  faChevronDown,
  faChevronUp,
  faSpinner,
  faChevronsLeft,
  faChevronsRight,
} from '@fortawesome/sharp-light-svg-icons';
import type { Course } from './Learning';
import { firebaseService } from './services/firebase_service';

interface CoursesProps {
  brandTheme: {
    colors: {
      primary: string;
      secondary: string;
    };
    gradients: {
      primary: string;
    };
  };
  onCourseSelect: (course: Course | null) => void;
  selectedCourse: Course | null;
  onCollapse?: () => void;
  currentUser?: any;
  selectedCollege?: { id: string; name: string } | null;
}

const Courses: React.FC<CoursesProps> = ({
  brandTheme,
  onCourseSelect,
  selectedCourse,
  onCollapse,
  currentUser,
  selectedCollege,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'topRated' | 'recentlyAdded'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCourses, setTotalCourses] = useState(0);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [pageCache, setPageCache] = useState<Map<number, { courses: Course[], lastDoc: any }>>(new Map());
  const coursesPerPage = 10;

  // Check if user is a student
  const isStudent = currentUser?.userType === 'student';

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track filter changes to bypass cache
  const [filterVersion, setFilterVersion] = useState(0);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setPageCache(new Map());
    setLastDoc(null);
    setFilterVersion(v => v + 1); // Force fresh fetch
  }, [selectedCategory, selectedFilter, debouncedSearchQuery]);

  // Fetch courses from Firebase with pagination
  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get the lastDoc from previous page for cursor-based pagination
        const previousPageCache = currentPage > 1 ? pageCache.get(currentPage - 1) : null;
        const startAfterDoc = previousPageCache?.lastDoc || null;

        const result = await firebaseService.getCoursesPaginated({
          category: selectedCategory || undefined,
          limit: coursesPerPage,
          orderBy: selectedFilter === 'recentlyAdded' ? 'dateOfPublishing' : 'courseName',
          orderDirection: selectedFilter === 'recentlyAdded' ? 'desc' : 'asc',
          startAfterDoc: startAfterDoc,
          searchQuery: debouncedSearchQuery.length > 0 ? debouncedSearchQuery : undefined,
        });
        
        // Determine college ID for enrollment counts
        let collegeIdForCounts: string | null = null;
        if (currentUser?.userType === 'system_admin') {
          collegeIdForCounts = selectedCollege?.id || null;
        } else if (currentUser?.userType !== 'student') {
          collegeIdForCounts = currentUser?.collegeId || null;
        }
        
        console.log('🎓 collegeIdForCounts:', collegeIdForCounts);
        
        // Transform to Course type expected by UI
        const transformedCourses: Course[] = result.courses.map(course => {
          const courseData = course as any;
          
          console.log('📚 Course:', course.courseName);
          console.log('📊 collegeEnrollmentCounts:', courseData.collegeEnrollmentCounts);
          console.log('🔢 Count for college:', courseData.collegeEnrollmentCounts?.[collegeIdForCounts || '']);
          
          // Use college-specific count from the map if available
          const collegeEnrollmentCount = collegeIdForCounts && courseData.collegeEnrollmentCounts
            ? (courseData.collegeEnrollmentCounts[collegeIdForCounts] || 0)
            : (course.enrollmentCount || 0);
          
          console.log('✅ Final count:', collegeEnrollmentCount);
            
          return {
            id: course.slug,
            courseId: course.courseId,
            name: course.courseName,
            thumbnail: course.thumbnailUrl,
            category: course.courseCategories?.[0] || 'General',
            lectures: course.totalLectures || 0,
            duration: formatDuration(course.totalDuration || 0),
            quizzes: courseData.totalQuizzes || 0,
            exercises: courseData.totalExercises || 0,
            progress: 0,
            isEnrolled: false,
            notes: courseData.totalNotes || 0,
            assessments: course.totalUnits || 0,
            completedCount: course.completedCount || 0,
            tags: course.courseCategories,
            rating: course.rating?.average || 0,
            totalRatings: course.rating?.totalRatings || 0,
            createdAt: course.dateOfPublishing || '',
            instructor: courseData.courseAuthor || '',
            level: courseData.complexityLevel === 1 ? 'Beginner' : courseData.complexityLevel === 2 ? 'Intermediate' : courseData.complexityLevel === 3 ? 'Advanced' : 'All Levels',
            tagLine: courseData.tagLine || '',
            language: courseData.language || 'English',
            collegeEnrollmentCounts: courseData.collegeEnrollmentCounts || {},
            enrollmentCount: course.enrollmentCount || 0,
          };
        });
        
        setCourses(transformedCourses);
        setTotalCourses(result.totalCount);
        setLastDoc(result.lastDoc);

        // Cache this page
        setPageCache(prev => new Map(prev).set(currentPage, {
          courses: transformedCourses,
          lastDoc: result.lastDoc
        }));

      } catch (err) {
        console.error('Error fetching courses:', err);
        setError('Failed to load courses. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [selectedCategory, selectedFilter, currentPage, debouncedSearchQuery, filterVersion, currentUser, selectedCollege]);

  // Category options
  const categoryOptions = [
    { id: null, name: 'All Categories' },
    { id: 'Development', name: 'Development' },
    { id: 'IT and Software', name: 'IT and Software' },
    { id: 'Data Science', name: 'Data Science' },
    { id: 'Personal Development', name: 'Personal Development' },
  ];

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalCourses / coursesPerPage);

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    // Scroll to top of list
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsisThreshold = 7;
    
    if (totalPages <= showEllipsisThreshold) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex-shrink-0">
        {/* Title Row with Filters */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <FontAwesomeIcon icon={faBooks} className="mr-2" style={{ color: brandTheme.colors.primary }} />
              Courses
            </h2>
            
            {/* Filter Pills */}
            <div className="flex gap-1 ml-2">
              {['all', 'topRated', 'recentlyAdded'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedFilter === filter
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={selectedFilter === filter ? { backgroundColor: brandTheme.colors.primary } : {}}
                >
                  {filter === 'all' ? 'All' : filter === 'topRated' ? 'Top Rated' : 'Recent'}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <div ref={categoryDropdownRef} className="relative">
              <button
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium hover:bg-gray-50"
              >
                <FontAwesomeIcon icon={faFilter} className="text-gray-400" style={{ fontSize: '10px' }} />
                <span className="text-gray-600">{selectedCategory || 'All Categories'}</span>
                <FontAwesomeIcon 
                  icon={isCategoryDropdownOpen ? faChevronUp : faChevronDown} 
                  className="text-gray-400"
                  style={{ fontSize: '10px' }}
                />
              </button>
              
              {isCategoryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {categoryOptions.map(option => (
                    <button
                      key={option.id || 'all'}
                      onClick={() => {
                        setSelectedCategory(option.id);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        selectedCategory === option.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <FontAwesomeIcon 
            icon={faSearch} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Courses List */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FontAwesomeIcon 
              icon={faSpinner} 
              className="text-4xl mb-4 animate-spin"
              style={{ color: brandTheme.colors.primary }}
            />
            <p className="text-gray-500">Loading courses...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: `${brandTheme.colors.primary}10` }}
            >
              <FontAwesomeIcon 
                icon={debouncedSearchQuery ? faSearch : faBooks} 
                className="text-3xl"
                style={{ color: brandTheme.colors.primary }}
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {debouncedSearchQuery ? 'No courses found' : 'No courses available'}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-xs mb-4">
              {debouncedSearchQuery 
                ? `We couldn't find any courses matching "${debouncedSearchQuery}". Try a different search term.`
                : selectedCategory 
                  ? `No courses available in ${selectedCategory} category.`
                  : 'There are no courses available at the moment.'
              }
            </p>
            {(debouncedSearchQuery || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  setSelectedFilter('all');
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ 
                  backgroundColor: `${brandTheme.colors.primary}15`,
                  color: brandTheme.colors.primary
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {courses.map(course => (
              <div
                key={course.id}
                onClick={() => onCourseSelect(course)}
                className={`relative rounded-xl shadow-sm border p-5 transition-all duration-500 cursor-pointer ${
                  selectedCourse?.id === course.id 
                    ? 'shadow-md' 
                    : 'bg-white border-gray-200 hover:shadow-md'
                }`}
                style={selectedCourse?.id === course.id ? {
                  backgroundColor: `${brandTheme.colors.primary}08`,
                  borderColor: brandTheme.colors.primary
                } : {}}
                onMouseEnter={(e) => {
                  if (selectedCourse?.id !== course.id) {
                    e.currentTarget.style.borderColor = brandTheme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCourse?.id !== course.id) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              >
                {/* Header Row - Thumbnail, Title & ID */}
                <div className="flex items-start gap-4 mb-4">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                    {course.thumbnail ? (
                      <img 
                        src={course.thumbnail} 
                        alt={course.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                      >
                        <FontAwesomeIcon icon={faBooks} style={{ color: brandTheme.colors.primary }} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {course.name}
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md ml-2 flex-shrink-0">
                        {course.id.substring(0, 15)}...
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 flex items-center gap-3">
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faVideo} style={{ fontSize: '12px' }} className="mr-1" />
                        <span className="font-medium">{course.lectures} Lectures</span>
                      </span>
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faClock} style={{ fontSize: '12px' }} className="mr-1" />
                        <span>{course.duration}</span>
                      </span>
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: '12px' }} className="mr-1" />
                        <span>{course.category}</span>
                      </span>
                    </p>
                  </div>
                </div>

                {/* Stats Box */}
                <div 
                  className={`grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg ${
                    selectedCourse?.id !== course.id ? 'bg-gray-50' : ''
                  }`}
                  style={selectedCourse?.id === course.id ? {
                    backgroundColor: `${brandTheme.colors.primary}15`
                  } : {}}
                >
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faCode} style={{ fontSize: '16px' }} className="text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Exercises</p>
                      <p className="text-sm font-medium text-gray-900">{course.exercises}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faFileAlt} style={{ fontSize: '16px' }} className="text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="text-sm font-medium text-gray-900">{course.notes}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '16px' }} className="text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Quizzes</p>
                      <p className="text-sm font-medium text-gray-900">{course.quizzes}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: '16px' }} className="text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Units</p>
                      <p className="text-sm font-medium text-gray-900">{course.assessments}</p>
                    </div>
                  </div>
                </div>

                {/* Footer - Stats & Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-4">
                    {/* Enrolments Count */}
                    <div className="flex items-center text-xs">
                      <span className="text-gray-500">Enrolments:</span>
                      <span className="font-semibold text-gray-700 ml-1">
                        {(() => {
                          let collegeId: string | null = null;
                          if (currentUser?.userType === 'system_admin') {
                            collegeId = selectedCollege?.id || null;
                          } else if (currentUser?.userType !== 'student') {
                            collegeId = currentUser?.collegeId || null;
                          }
                          return collegeId && course.collegeEnrollmentCounts
                            ? (course.collegeEnrollmentCounts[collegeId] || 0)
                            : (course.enrollmentCount || 0);
                        })()}
                      </span>
                    </div>
                    {/* Completed Count */}
                    <div className="flex items-center text-xs">
                      <span className="text-gray-500">Completed:</span>
                      <span className="font-semibold text-green-600 ml-1">{course.completedCount || 0}</span>
                    </div>
                  </div>
                  
                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    {/* View Details Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onCourseSelect(course);
                      }}
                      className="inline-flex items-center text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                      style={{ 
                        color: brandTheme.colors.primary,
                        backgroundColor: `${brandTheme.colors.primary}15`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}25`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}15`;
                      }}
                    >
                      View Details
                    </button>

                    {/* Start Learning / Continue Button - Only show for students */}
                    {isStudent && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle start learning action
                        }}
                        className="inline-flex items-center text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 text-white"
                        style={{ 
                          background: brandTheme.gradients.primary
                        }}
                      >
                        {course.isEnrolled ? 'Continue' : 'Start Learning'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Sticky Pagination Footer */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 sticky bottom-0 z-10">
          <div className="flex items-center justify-between">
            {/* Page Info */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">{((currentPage - 1) * coursesPerPage) + 1}</span>
              <span className="mx-1">-</span>
              <span className="font-medium">{Math.min(currentPage * coursesPerPage, totalCourses)}</span>
              <span className="mx-1">of</span>
              <span className="font-medium">{totalCourses}</span>
              <span className="ml-1 text-gray-400">courses</span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              {/* First Page Button */}
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === 1
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="First page"
              >
                <FontAwesomeIcon icon={faChevronsLeft} className="text-xs" />
              </button>

              {/* Previous Button */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === 1
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="Previous page"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1.5 mx-1">
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-1.5 text-gray-400 text-sm">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page as number)}
                      className={`min-w-[36px] h-9 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        currentPage === page
                          ? 'text-white shadow-lg transform scale-105'
                          : 'text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      style={currentPage === page ? { 
                        background: brandTheme.gradients.primary 
                      } : {}}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>

              {/* Next Button */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === totalPages
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="Next page"
              >
                <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
              </button>

              {/* Last Page Button */}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === totalPages
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="Last page"
              >
                <FontAwesomeIcon icon={faChevronsRight} className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;