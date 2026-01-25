import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faChevronLeft,
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
  faUsers,
} from '@fortawesome/sharp-light-svg-icons';
import type { Course } from './Learning';

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
}

const Courses: React.FC<CoursesProps> = ({
  brandTheme,
  onCourseSelect,
  selectedCourse,
  onCollapse,
  currentUser,
}) => {
  const [searchQuery, _setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'topRated' | 'recentlyAdded'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Check if user is a student
  const isStudent = currentUser?.userType === 'student';

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

  // Category options
  const categoryOptions = [
    { id: null, name: 'All Categories' },
    { id: 'Coding', name: 'Coding' },
    { id: 'Data Science', name: 'Data Science' },
    { id: 'Web Dev', name: 'Web Development' },
    { id: 'AI/ML', name: 'AI / Machine Learning' },
    { id: 'Database', name: 'Database' },
  ];

  // Sample courses data with new fields
  const courses: Course[] = [
    {
      id: '1',
      name: 'Data Structure and Algorithm in C++',
      thumbnail: '',
      category: 'Coding',
      lectures: 63,
      duration: '12h 55m',
      quizzes: 570,
      exercises: 275,
      progress: 65,
      isEnrolled: true,
      notes: 63,
      assessments: 5,
      students: 234,
      tags: ['LPU', '2025-26'],
      rating: 4.8,
      createdAt: '2025-01-10',
    },
    {
      id: '2',
      name: 'Advanced Java Programming',
      thumbnail: '',
      category: 'Coding',
      lectures: 45,
      duration: '10h 30m',
      quizzes: 320,
      exercises: 180,
      progress: 40,
      isEnrolled: true,
      notes: 45,
      assessments: 4,
      students: 189,
      tags: ['LPU', '2025-26'],
      rating: 4.5,
      createdAt: '2025-01-05',
    },
    {
      id: '3',
      name: 'Python for Data Science',
      thumbnail: '',
      category: 'Data Science',
      lectures: 58,
      duration: '15h 20m',
      quizzes: 420,
      exercises: 200,
      progress: 0,
      isEnrolled: false,
      notes: 58,
      assessments: 6,
      students: 312,
      tags: ['LPU', '2025-26'],
      rating: 4.9,
      createdAt: '2025-01-15',
    },
    {
      id: '4',
      name: 'Web Development with React',
      thumbnail: '',
      category: 'Web Dev',
      lectures: 72,
      duration: '18h 45m',
      quizzes: 380,
      exercises: 150,
      progress: 80,
      isEnrolled: true,
      notes: 72,
      assessments: 8,
      students: 456,
      tags: ['LPU', '2025-26'],
      rating: 4.7,
      createdAt: '2024-12-20',
    },
    {
      id: '5',
      name: 'Machine Learning Fundamentals',
      thumbnail: '',
      category: 'AI/ML',
      lectures: 40,
      duration: '14h 10m',
      quizzes: 290,
      exercises: 120,
      progress: 0,
      isEnrolled: false,
      notes: 40,
      assessments: 5,
      students: 278,
      tags: ['LPU', '2025-26'],
      rating: 4.6,
      createdAt: '2025-01-12',
    },
    {
      id: '6',
      name: 'Database Management Systems',
      thumbnail: '',
      category: 'Database',
      lectures: 35,
      duration: '9h 30m',
      quizzes: 250,
      exercises: 100,
      progress: 25,
      isEnrolled: true,
      notes: 35,
      assessments: 3,
      students: 167,
      tags: ['LPU', '2025-26'],
      rating: 4.3,
      createdAt: '2024-11-15',
    },
  ];

  // Filter and sort courses
  const filteredCourses = useMemo(() => {
    let result = courses.filter(course => {
      const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           course.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || course.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort based on selected filter
    if (selectedFilter === 'topRated') {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (selectedFilter === 'recentlyAdded') {
      result = [...result].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    return result;
  }, [searchQuery, selectedFilter, selectedCategory]);


  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200" style={{ minWidth: '600px', maxWidth: '600px', width: '600px' }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faBooks} className="text-xl" style={{ color: brandTheme.colors.primary }} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Courses</h2>
              <p className="text-sm text-gray-500">{filteredCourses.length} courses</p>
            </div>
          </div>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Collapse"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 mb-4 flex-wrap gap-y-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
              selectedFilter === 'all' ? 'text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={selectedFilter === 'all' ? { background: brandTheme.gradients.primary } : {}}
          >
            <FontAwesomeIcon icon={faBooks} />
            <span>All {courses.length}</span>
          </button>
          <button
            onClick={() => setSelectedFilter('topRated')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
              selectedFilter === 'topRated' ? 'shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={selectedFilter === 'topRated' ? { backgroundColor: `${brandTheme.colors.primary}20`, color: brandTheme.colors.primary } : {}}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Top Rated</span>
          </button>
          <button
            onClick={() => setSelectedFilter('recentlyAdded')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors text-xs flex items-center space-x-2 ${
              selectedFilter === 'recentlyAdded' ? 'shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={selectedFilter === 'recentlyAdded' ? { backgroundColor: `${brandTheme.colors.primary}20`, color: brandTheme.colors.primary } : {}}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Recently Added</span>
          </button>

          {/* Category Dropdown */}
          <div className="relative ml-auto" ref={categoryDropdownRef}>
            <button
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <FontAwesomeIcon icon={faFilter} />
              <span>{selectedCategory || 'Category'}</span>
              <FontAwesomeIcon icon={isCategoryDropdownOpen ? faChevronUp : faChevronDown} className="text-xs" />
            </button>

            {/* Dropdown Menu */}
            {isCategoryDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
                {categoryOptions.map((cat) => (
                  <button
                    key={cat.id || 'all'}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedCategory === cat.id
                        ? 'font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    style={selectedCategory === cat.id ? { 
                      backgroundColor: `${brandTheme.colors.primary}15`,
                      color: brandTheme.colors.primary 
                    } : {}}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        </div>

      {/* Course List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <FontAwesomeIcon icon={faSearch} className="text-4xl text-gray-300 mb-4" />
            <p className="text-gray-500">No courses found</p>
          </div>
        ) : (
          <>
            {filteredCourses.map(course => (
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
                      <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md ml-2 flex-shrink-0">ID: CRS-{course.id.padStart(2, '0')}</span>
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
                      <p className="text-xs text-gray-500">Assessments</p>
                      <p className="text-sm font-medium text-gray-900">{course.assessments}</p>
                    </div>
                  </div>
                </div>

                {/* Footer - Tags & Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center">
                    {/* Stats with pipe separator */}
                    <div className="flex items-center text-[11px] font-semibold text-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-1.5 rounded-lg shadow-sm">
                      {/* Enrollment Count */}
                      {course.students && (
                        <span className="inline-flex items-center">
                          <FontAwesomeIcon icon={faUsers} className="mr-1.5" />
                          {course.students} Enrolled
                        </span>
                      )}
                      
                      {/* For non-students: Completed count and Avg Marks */}
                      {!isStudent && course.students && (
                        <>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-green-600">
                            {Math.round(course.students * (course.progress || 0) / 100)} Completed
                          </span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-purple-600">
                            {(course as any).avgMarks || Math.round(70 + Math.random() * 20)}% Avg Marks
                          </span>
                        </>
                      )}
                      
                      {/* For students: Progress */}
                      {isStudent && course.progress > 0 && (
                        <>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-green-600">
                            {course.progress}% Completed
                          </span>
                        </>
                      )}
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

            {/* End of List Indicator */}
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3 border-2 border-dashed border-gray-200">
                <span className="text-3xl">📚</span>
              </div>
              <p className="font-semibold text-gray-700">That's everything!</p>
              <p className="text-sm text-gray-400">No more courses to load</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Courses;