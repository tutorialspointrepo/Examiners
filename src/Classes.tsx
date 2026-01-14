import { useState, useEffect, useRef } from 'react';
import { Users, GraduationCap, ChevronDown, ChevronLeft, UserPlus, Building2 } from 'lucide-react';
import { firebaseService } from './services/firebase_service';
import { USER_TYPES, USER_STATUS, FILTER_VALUES } from './constants';

interface ClassStats {
  className: string;
  totalStudents: number;
  totalTeachers: number;
  board: string;
  academicYear: string;
}

interface ClassesProps {
  activeCollegeId: string | null;
  onClassSelect: (className: string) => void;
  selectedClass: string | null;
  brandTheme: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    gradients: {
      primary: string;
      secondary: string;
    };
  };
  onCollapse: () => void;
  selectedAcademicYear?: string; // Add this prop
  refreshTrigger?: number;
}

export default function Classes({ activeCollegeId, onClassSelect, selectedClass, brandTheme, onCollapse, selectedAcademicYear = FILTER_VALUES.ALL, refreshTrigger = 0 }: ClassesProps) {
  const [classes, setClasses] = useState<ClassStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<string>(FILTER_VALUES.ALL);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(FILTER_VALUES.ALL);
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [isClassFilterDropdownOpen, setIsClassFilterDropdownOpen] = useState(false);
  const [boards, setBoards] = useState<string[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [administrativeCount, setAdministrativeCount] = useState<{ admins: number; principals: number; deans: number; teachers: number; total: number }>({
    admins: 0,
    principals: 0,
    deans: 0,
    teachers: 0,
    total: 0
  });

  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const classFilterDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-select Administrative & Faculty on mount
  useEffect(() => {
    if (activeCollegeId && !selectedClass) {
      onClassSelect('_administrative');
    }
  }, [activeCollegeId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(event.target as Node)) {
        setIsBoardDropdownOpen(false);
      }
      if (classFilterDropdownRef.current && !classFilterDropdownRef.current.contains(event.target as Node)) {
        setIsClassFilterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch classes data
  useEffect(() => {
    const fetchClassesData = async () => {
      if (!activeCollegeId) {
        setClasses([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔍 Fetching classes for college:', activeCollegeId);

        // Fetch all students and teachers for the college
        const [students, teachers] = await Promise.all([
          firebaseService.getUsersByType(USER_TYPES.STUDENT, activeCollegeId),
          firebaseService.getUsersByType(USER_TYPES.TEACHER, activeCollegeId)
        ]);

        console.log('📊 Students:', students.length, 'Teachers:', teachers.length);

        // Fetch administrative users
        const [admins, principals, deans] = await Promise.all([
          firebaseService.getUsersByType(USER_TYPES.ADMIN, activeCollegeId),
          firebaseService.getUsersByType(USER_TYPES.PRINCIPAL, activeCollegeId),
          firebaseService.getUsersByType(USER_TYPES.DEAN, activeCollegeId)
        ]);

        // Filter out disabled users for accurate counts
        const activeAdmins = admins.filter(u => u.status !== USER_STATUS.DISABLED);
        const activePrincipals = principals.filter(u => u.status !== USER_STATUS.DISABLED);
        const activeDeans = deans.filter(u => u.status !== USER_STATUS.DISABLED);
        const activeTeachers = teachers.filter(u => u.status !== USER_STATUS.DISABLED);

        const adminCount = {
          admins: activeAdmins.length,
          principals: activePrincipals.length,
          deans: activeDeans.length,
          teachers: activeTeachers.length,
          total: activeAdmins.length + activePrincipals.length + activeDeans.length + activeTeachers.length
        };

        setAdministrativeCount(adminCount);
        console.log('👔 Administrative & Faculty:', adminCount);

        // Get unique classes from students
        const classMap = new Map<string, ClassStats>();
        const boardsSet = new Set<string>();
        const classNamesSet = new Set<string>();

        students.forEach(student => {
          // Skip disabled users - only count active students
          if (student.status === USER_STATUS.DISABLED) return;
          
          const className = student.studentClass || 'Unassigned';
          const board = student.board || 'N/A';
          const academicYear = student.academicYear || 'N/A';
          
          boardsSet.add(board);
          classNamesSet.add(className);

          const key = `${className}-${board}-${academicYear}`;
          
          if (!classMap.has(key)) {
            classMap.set(key, {
              className,
              totalStudents: 0,
              totalTeachers: 0,
              board,
              academicYear
            });
          }

          const classData = classMap.get(key)!;
          classData.totalStudents++;
        });

        // Count teachers per class
        teachers.forEach(teacher => {
          // Skip disabled users - only count active teachers
          if (teacher.status === USER_STATUS.DISABLED) return;
          
          const teacherClasses = teacher.teacherClasses || [];
          teacherClasses.forEach((className: string) => {
            // Find all entries for this class (across different boards/years)
            classMap.forEach((classData) => {
              if (classData.className === className) {
                classData.totalTeachers++;
              }
            });
          });
        });

        const classesArray = Array.from(classMap.values())
          .sort((a, b) => {
            // Sort by class name numerically (1st, 2nd, 3rd... 10th, 11th, 12th)
            const aNum = parseInt(a.className.replace(/\D/g, '')) || 999;
            const bNum = parseInt(b.className.replace(/\D/g, '')) || 999;
            return aNum - bNum;
          });

        setClasses(classesArray);
        setBoards([FILTER_VALUES.ALL, ...Array.from(boardsSet).sort()]);
        
        // Sort class names numerically
        const sortedClassNames = Array.from(classNamesSet).sort((a, b) => {
          const aNum = parseInt(a.replace(/\D/g, '')) || 999;
          const bNum = parseInt(b.replace(/\D/g, '')) || 999;
          return aNum - bNum;
        });
        setClassNames([FILTER_VALUES.ALL, ...sortedClassNames]);
        
        console.log('✅ Classes loaded:', classesArray);
      } catch (error) {
        console.error('❌ Error fetching classes:', error);
        setClasses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClassesData();
  }, [activeCollegeId, refreshTrigger]);

  // Filter classes based on board, class name, and academic year
  const filteredClasses = classes.filter(classData => {
    const matchesBoard = selectedBoard === FILTER_VALUES.ALL || classData.board === selectedBoard;
    const matchesClass = selectedClassFilter === FILTER_VALUES.ALL || classData.className === selectedClassFilter;
    const matchesAcademicYear = selectedAcademicYear === FILTER_VALUES.ALL || classData.academicYear === selectedAcademicYear;
    return matchesBoard && matchesClass && matchesAcademicYear;
  });

  console.log('🔍 Classes Filter Applied:', {
    selectedAcademicYear,
    selectedBoard,
    selectedClassFilter,
    totalClasses: classes.length,
    filteredClasses: filteredClasses.length
  });

  if (!activeCollegeId) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <GraduationCap size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No College Selected</h3>
          <p className="text-sm text-gray-500">Please select a college to view classes</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header Section - Sticky */}
      <div className="sticky top-0 z-[100] h-[72px] bg-white px-6 py-4 pb-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <GraduationCap size={28} className="text-gray-900" />
              <h2 className="text-2xl font-bold text-gray-900">Classes</h2>
            </div>
            
            {/* Classes Dropdown - Local Filter */}
            <div ref={classFilterDropdownRef} className="relative z-[999]">
              <button 
                onClick={() => {
                  setIsClassFilterDropdownOpen(!isClassFilterDropdownOpen);
                  setIsBoardDropdownOpen(false);
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <GraduationCap size={16} />
                <span>{selectedClassFilter === FILTER_VALUES.ALL ? 'All Classes' : `Class ${selectedClassFilter}`}</span>
                <ChevronDown size={16} className={`transition-transform ${isClassFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isClassFilterDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000] max-h-64 overflow-y-auto">
                  {classNames.map((className) => (
                    <button
                      key={className}
                      onClick={() => {
                        setSelectedClassFilter(className);
                        setIsClassFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        selectedClassFilter === className
                          ? 'font-semibold text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      style={selectedClassFilter === className ? { color: brandTheme.colors.primary } : {}}
                    >
                      {className === FILTER_VALUES.ALL ? 'All Classes' : `Class ${className}`}
                      {selectedClassFilter === className && (
                        <span className="ml-2">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Board Dropdown - Local Filter - Only show if more than one board */}
            {boards.length > 2 && (
              <div ref={boardDropdownRef} className="relative z-[999]">
                <button 
                  onClick={() => {
                    setIsBoardDropdownOpen(!isBoardDropdownOpen);
                    setIsClassFilterDropdownOpen(false);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Building2 size={16} />
                  <span>{selectedBoard === FILTER_VALUES.ALL ? 'All Boards' : selectedBoard}</span>
                  <ChevronDown size={16} className={`transition-transform ${isBoardDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isBoardDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
                    {boards.map((board) => (
                      <button
                        key={board}
                        onClick={() => {
                          setSelectedBoard(board);
                          setIsBoardDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          selectedBoard === board
                            ? 'font-semibold text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={selectedBoard === board ? { color: brandTheme.colors.primary } : {}}
                      >
                        {board === FILTER_VALUES.ALL ? 'All Boards' : board}
                        {selectedBoard === board && (
                          <span className="ml-2">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collapse Button */}
          <button
            onClick={onCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Collapse panel"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Classes Grid - Scrollable Content */}
      <div className="pt-6 px-6 pb-20 bg-gray-50">
        {/* Administrative & Faculty Box */}
        <div
          onClick={() => onClassSelect('_administrative')}
          className={`rounded-xl shadow-sm border p-5 cursor-pointer transition-all duration-200 mb-6 ${
            selectedClass === '_administrative'
              ? 'shadow-md'
              : 'bg-white border-gray-200 hover:shadow-md'
          }`}
          style={selectedClass === '_administrative' ? {
            backgroundColor: `${brandTheme.colors.accent}08`,
            borderColor: brandTheme.colors.accent
          } : { 
            backgroundColor: 'white',
            borderColor: '#e5e7eb'
          }}
          onMouseEnter={(e) => {
            if (selectedClass !== '_administrative') {
              e.currentTarget.style.borderColor = brandTheme.colors.accent;
            }
          }}
          onMouseLeave={(e) => {
            if (selectedClass !== '_administrative') {
              e.currentTarget.style.borderColor = '#e5e7eb';
            }
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${brandTheme.colors.accent} 0%, ${brandTheme.colors.primary} 100%)` }}
              >
                <Users size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Administrative & Faculty
                </h3>
                <p className="text-sm text-gray-600">
                  Administrative and Faculty Staff
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div 
              className="p-3 rounded-lg border"
              style={{
                background: `${brandTheme.colors.accent}15`,
                borderColor: `${brandTheme.colors.accent}33`
              }}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Building2 size={16} style={{ color: brandTheme.colors.accent }} />
                <span className="text-xs font-medium" style={{ color: brandTheme.colors.accent }}>
                  Admins
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{administrativeCount.admins}</p>
            </div>

            <div 
              className="p-3 rounded-lg border"
              style={{
                background: `${brandTheme.colors.primary}15`,
                borderColor: `${brandTheme.colors.primary}33`
              }}
            >
              <div className="flex items-center space-x-2 mb-1">
                <GraduationCap size={16} style={{ color: brandTheme.colors.primary }} />
                <span className="text-xs font-medium" style={{ color: brandTheme.colors.primary }}>
                  Principals
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{administrativeCount.principals}</p>
            </div>

            <div 
              className="p-3 rounded-lg border"
              style={{
                background: `${brandTheme.colors.secondary}15`,
                borderColor: `${brandTheme.colors.secondary}33`
              }}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Users size={16} style={{ color: brandTheme.colors.secondary }} />
                <span className="text-xs font-medium" style={{ color: brandTheme.colors.secondary }}>
                  Deans
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{administrativeCount.deans}</p>
            </div>

            <div 
              className="p-3 rounded-lg border"
              style={{
                background: `${brandTheme.colors.primary}15`,
                borderColor: `${brandTheme.colors.primary}33`
              }}
            >
              <div className="flex items-center space-x-2 mb-1">
                <UserPlus size={16} style={{ color: brandTheme.colors.primary }} />
                <span className="text-xs font-medium" style={{ color: brandTheme.colors.primary }}>
                  Teachers
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{administrativeCount.teachers}</p>
            </div>
          </div>

          {/* Total Count */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total Staff & Faculty</span>
              <span className="text-xl font-bold" style={{ color: brandTheme.colors.accent }}>
                {administrativeCount.total}
              </span>
            </div>
          </div>
        </div>

        {filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <GraduationCap size={40} className="text-gray-400" />
            </div>
            <p className="text-gray-700 font-semibold text-lg mb-2">No classes found</p>
            <p className="text-sm text-gray-500">
              No classes available for the selected filters
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              filteredClasses.map((classData, index) => (
                <div
                  key={index}
                  onClick={() => onClassSelect(`${classData.className}|${classData.board}|${classData.academicYear}`)}
                  className={`rounded-xl shadow-sm border p-5 cursor-pointer transition-all duration-200 ${
                    selectedClass === `${classData.className}|${classData.board}|${classData.academicYear}`
                      ? 'shadow-md'
                      : 'bg-white border-gray-200 hover:shadow-md'
                  }`}
                  style={selectedClass === `${classData.className}|${classData.board}|${classData.academicYear}` ? {
                    backgroundColor: `${brandTheme.colors.primary}08`,
                    borderColor: brandTheme.colors.primary
                  } : {
                    backgroundColor: 'white',
                    borderColor: '#e5e7eb'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedClass !== `${classData.className}|${classData.board}|${classData.academicYear}`) {
                      e.currentTarget.style.borderColor = brandTheme.colors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedClass !== `${classData.className}|${classData.board}|${classData.academicYear}`) {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        {classData.className.replace(/\D/g, '')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                              Class {classData.className}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {classData.board} • {classData.academicYear}
                            </p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex space-x-3">
                          <div 
                            className="flex-1 px-3 py-2 rounded-lg border"
                            style={{
                              background: `${brandTheme.colors.primary}10`,
                              borderColor: `${brandTheme.colors.primary}30`
                            }}
                          >
                            <div className="flex items-center space-x-2">
                              <Users size={16} style={{ color: brandTheme.colors.primary }} />
                              <span className="text-xs font-medium text-gray-600">Students</span>
                            </div>
                            <p className="text-xl font-bold text-gray-900 mt-1">{classData.totalStudents}</p>
                          </div>

                          <div 
                            className="flex-1 px-3 py-2 rounded-lg border"
                            style={{
                              background: `${brandTheme.colors.secondary}10`,
                              borderColor: `${brandTheme.colors.secondary}30`
                            }}
                          >
                            <div className="flex items-center space-x-2">
                              <UserPlus size={16} style={{ color: brandTheme.colors.secondary }} />
                              <span className="text-xs font-medium text-gray-600">Teachers</span>
                            </div>
                            <p className="text-xl font-bold text-gray-900 mt-1">{classData.totalTeachers}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}