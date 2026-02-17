import { useState, useMemo, useEffect } from 'react';
import { firebaseService } from './services/firebase_service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRoute,
  faSearch,
  faBookOpen,
  faClock,
  faUsers,
  faEdit,
  faLock,
  faArrowLeft,
  faLayerGroup,
  faBriefcase,
  faUserPlus,
  faChevronLeft,
} from '@fortawesome/sharp-light-svg-icons';

// ============ INTERFACES ============

interface LearningPathCourse {
  courseId: string;
  courseName: string;
  thumbnail: string;
  category: string;
  duration: string;
  lectures: number;
  sequenceOrder: number;
  isRequired: boolean;
  phase: string;
  phaseNumber: number;
}

interface LearningPath {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  thumbnail?: string;
  courses: LearningPathCourse[];
  totalCourses: number;
  totalDuration: string;
  estimatedWeeks: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  skills: string[];
  status: 'draft' | 'published';
  isSequential: boolean;
  createdBy: string;
  createdByName: string;
  collegeId: string;
  assignedStudents: string[];
  assignedClasses: string[];
  enrollmentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface LearningPathsProps {
  brandTheme: {
    colors: { primary: string; secondary: string };
    gradients: { primary: string };
    collegeName?: string;
  };
  currentUser: any;
  selectedCollege: any;
  availableCourses: any[];
  isCollapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}

// ============ HELPER FUNCTIONS ============

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'beginner': return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
    case 'intermediate': return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
    case 'advanced': return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' };
  }
};

const getPhaseColor = (phaseNumber: number, _brandPrimary: string) => {
  const colors = [
    { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', iconBg: 'bg-blue-100' },
    { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500', iconBg: 'bg-purple-100' },
    { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-500', iconBg: 'bg-teal-100' },
    { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', iconBg: 'bg-amber-100' },
  ];
  return colors[(phaseNumber - 1) % colors.length];
};

// ============ MAIN COMPONENT ============

export default function LearningPaths({ brandTheme, currentUser, selectedCollege, isCollapsed, onCollapse, onExpand }: LearningPathsProps) {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

  // Fetch learning paths from Firebase
  useEffect(() => {
    const fetchPaths = async () => {
      setIsLoading(true);
      try {
        const collegeId = selectedCollege?.id || selectedCollege?.collegeId || '';
        if (!collegeId) {
          setLearningPaths([]);
          setIsLoading(false);
          return;
        }
        const rawPaths = await firebaseService.getLearningPaths(collegeId);
        const paths: LearningPath[] = rawPaths.map((p: any) => ({
          id: p.id,
          name: p.pathName || p.name || '',
          description: p.description || '',
          targetRole: p.targetRole || '',
          thumbnail: p.thumbnail || undefined,
          courses: (p.courses || []).map((c: any, idx: number) => ({
            courseId: c.courseId || c.id || '',
            courseName: c.courseName || c.name || '',
            thumbnail: c.thumbnail || '',
            category: c.category || '',
            duration: c.duration || '0h',
            lectures: c.lectures || 0,
            sequenceOrder: c.sequenceOrder || idx + 1,
            isRequired: c.isRequired !== false,
            phase: c.phase || `Phase ${c.phaseNumber || 1}`,
            phaseNumber: c.phaseNumber || 1,
          })),
          totalCourses: p.totalCourses || (p.courses || []).length,
          totalDuration: p.totalDurationHours ? `${p.totalDurationHours}h` : p.totalDuration || '0h',
          estimatedWeeks: p.estimatedWeeks || 0,
          difficulty: p.difficulty || 'beginner',
          skills: (p.skills || []).map((s: any) => typeof s === 'string' ? s : s.name || s.skill || ''),
          status: p.status || 'draft',
          isSequential: p.isSequential || false,
          createdBy: p.createdBy || '',
          createdByName: p.createdByName || '',
          collegeId: p.collegeId || '',
          assignedStudents: p.assignedStudents || [],
          assignedClasses: p.assignedClasses || [],
          enrollmentCount: p.enrollmentCount || 0,
          createdAt: p.createdAt || '',
          updatedAt: p.updatedAt || '',
        }));
        setLearningPaths(paths);
      } catch (err) {
        console.error('Error fetching learning paths:', err);
        setLearningPaths([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPaths();
  }, [selectedCollege]);


  const isStudent = currentUser?.userType === 'student';
  const isAdmin = ['admin', 'teacher', 'principal', 'system_admin', 'dean'].includes(currentUser?.userType);

  // Filter paths based on role
  const filteredPaths = useMemo(() => {
    let paths = learningPaths;

    // Students only see published + assigned paths
    if (isStudent) {
      paths = paths.filter(p => p.status === 'published' && (
        p.assignedStudents.includes(currentUser?.userId || '') ||
        p.assignedClasses.some((cls: string) => currentUser?.classId === cls)
      ));
    }

    // Filter by status
    if (filterStatus !== 'all') {
      paths = paths.filter(p => p.status === filterStatus);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      paths = paths.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.targetRole.toLowerCase().includes(q) ||
        p.skills.some(s => s.toLowerCase().includes(q))
      );
    }

    return paths;
  }, [learningPaths, isStudent, currentUser, filterStatus, searchQuery]);

  // Group courses by phase for detail view
  const groupedCourses = useMemo(() => {
    if (!selectedPath) return [];
    const phases: { phase: string; phaseNumber: number; courses: LearningPathCourse[] }[] = [];
    selectedPath.courses.forEach(course => {
      const existing = phases.find(p => p.phaseNumber === course.phaseNumber);
      if (existing) {
        existing.courses.push(course);
      } else {
        phases.push({ phase: course.phase, phaseNumber: course.phaseNumber, courses: [course] });
      }
    });
    return phases.sort((a, b) => a.phaseNumber - b.phaseNumber);
  }, [selectedPath]);

  // Auto-select first path
  useEffect(() => {
    if (!selectedPath && filteredPaths.length > 0) {
      setSelectedPath(filteredPaths[0]);
    }
  }, [filteredPaths]);

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* ============ MIDDLE PANEL - Path Cards (matches Courses panel) ============ */}
      {isCollapsed ? (
        <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-4 flex items-center justify-center">
            <button 
              onClick={onExpand}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Expand"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="rotate-180" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center pt-4">
            <FontAwesomeIcon icon={faRoute} className="text-gray-600 mb-2" />
            <div className="text-gray-600 font-semibold text-sm tracking-wider"
                 style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              Learning Paths
            </div>
          </div>
        </div>
      ) : (
      <div 
        className="h-full overflow-hidden bg-white border-r border-gray-200 flex-shrink-0 flex flex-col"
        style={{ minWidth: '600px', maxWidth: '600px', width: '600px' }}
      >        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${brandTheme.colors.primary}15` }}>
                <FontAwesomeIcon icon={faRoute} style={{ color: brandTheme.colors.primary }} className="text-sm" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Learning Paths</h1>
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  {(['all', 'published', 'draft'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3.5 py-1 text-xs font-medium rounded-full border transition-all ${
                        filterStatus === status
                          ? 'text-white border-transparent'
                          : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      style={filterStatus === status ? { background: brandTheme.colors.primary, borderColor: brandTheme.colors.primary } : {}}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              )}
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

          {/* Search */}
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search paths, roles, or skills..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-300 transition-colors"
            />
          </div>
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-4" style={{ borderColor: brandTheme.colors.primary }}></div>
              <p className="text-sm text-gray-500">Loading learning paths...</p>
            </div>
          ) : filteredPaths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faRoute} className="text-gray-300 text-2xl" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {isStudent ? 'No learning paths assigned yet' : 'No learning paths found'}
              </p>
              <p className="text-[11px] text-gray-400">
                {isStudent ? 'Your teacher will assign paths to guide your learning' : 'Create your first learning path to get started'}
              </p>
            </div>
          ) : (
            filteredPaths.map(path => {
              const isSelected = selectedPath?.id === path.id;
              const diffColor = getDifficultyColor(path.difficulty);
              
              return (
                <div
                  key={path.id}
                  onClick={() => setSelectedPath(path)}
                  className={`relative bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    isSelected
                      ? 'shadow-md'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                  style={isSelected ? { borderColor: brandTheme.colors.primary + '60' } : {}}
                >
                  {/* Status badge for admin */}
                  {isAdmin && path.status === 'draft' && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-md uppercase">Draft</span>
                    </div>
                  )}

                  {/* Top row: Title + Role */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      <FontAwesomeIcon icon={faBriefcase} className="text-white text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-bold text-gray-900 line-clamp-1">{path.name}</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">Target: {path.targetRole}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[12px] text-gray-500 line-clamp-2 mb-3 leading-relaxed">{path.description}</p>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <FontAwesomeIcon icon={faBookOpen} className="text-gray-400" />
                      <span className="font-medium text-gray-700">{path.totalCourses}</span> courses
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                      <span className="font-medium text-gray-700">{path.totalDuration}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <FontAwesomeIcon icon={faLayerGroup} className="text-gray-400" />
                      <span className="font-medium text-gray-700">{path.estimatedWeeks}</span> weeks
                    </div>
                    {!isStudent && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                        <span className="font-medium text-gray-700">{path.enrollmentCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills tags + Difficulty */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                      {path.skills.slice(0, 4).map((skill, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-md">{skill}</span>
                      ))}
                      {path.skills.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{path.skills.length - 4}</span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 ${diffColor.bg} ${diffColor.text} text-[10px] font-semibold rounded-md capitalize flex-shrink-0`}>
                      {path.difficulty}
                    </span>
                  </div>

                  {/* Student progress bar (placeholder) */}
                  {isStudent && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-gray-600">Progress</span>
                        <span className="text-[11px] font-bold" style={{ color: brandTheme.colors.primary }}>0%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: '0%', background: brandTheme.gradients.primary }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* ============ RIGHT PANEL - Path Details (matches Courses detail panel) ============ */}
      {selectedPath ? (
        <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {/* Header Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            {/* Gradient Header */}
            <div className="relative px-6 py-5" style={{ background: brandTheme.gradients.primary }}>
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-24 translate-x-24" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-16 -translate-x-16" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md capitalize ${getDifficultyColor(selectedPath.difficulty).bg} ${getDifficultyColor(selectedPath.difficulty).text}`}>
                      {selectedPath.difficulty}
                    </span>
                    {selectedPath.status === 'draft' && (
                      <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-semibold rounded-md uppercase">Draft</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedPath(null)}
                      className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} />
                      Back
                    </button>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{selectedPath.name}</h2>
                <p className="text-white/70 text-[12px] flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faBriefcase} />
                  Target Role: {selectedPath.targetRole}
                </p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="px-6 py-4 grid grid-cols-4 gap-4 border-b border-gray-100">
              {[
                { label: 'Courses', value: selectedPath.totalCourses, icon: faBookOpen },
                { label: 'Duration', value: selectedPath.totalDuration, icon: faClock },
                { label: 'Weeks', value: `${selectedPath.estimatedWeeks}w`, icon: faLayerGroup },
                { label: 'Students', value: selectedPath.enrollmentCount, icon: faUsers },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-lg font-bold text-gray-900">{stat.value}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Description + Skills */}
            <div className="px-6 py-4">
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">{selectedPath.description}</p>
              <div className="flex items-center flex-wrap gap-1.5">
                {selectedPath.skills.map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-gray-100 text-gray-600">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Course Roadmap Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
                <FontAwesomeIcon icon={faRoute} style={{ color: brandTheme.colors.primary }} />
                Course Roadmap
              </h3>
              {selectedPath.isSequential && (
                <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-lg flex items-center gap-1">
                  <FontAwesomeIcon icon={faLock} className="text-[8px]" /> Sequential
                </span>
              )}
            </div>

            <div className="px-6 py-4">
              <div className="space-y-5">
                {groupedCourses.map((phase, phaseIdx) => {
                  const phaseColor = getPhaseColor(phase.phaseNumber, brandTheme.colors.primary);
                  const isLastPhase = phaseIdx === groupedCourses.length - 1;

                  return (
                    <div key={phase.phaseNumber}>
                      {/* Phase Header */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={`w-7 h-7 rounded-lg ${phaseColor.iconBg} flex items-center justify-center`}>
                          <span className={`text-[11px] font-bold ${phaseColor.icon}`}>{phase.phaseNumber}</span>
                        </div>
                        <div>
                          <span className="text-[13px] font-semibold text-gray-800">{phase.phase}</span>
                          <span className="text-[11px] text-gray-400 ml-2">{phase.courses.length} course{phase.courses.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Courses in Phase */}
                      <div className="ml-3.5 pl-5 border-l-2 border-gray-100 space-y-2.5 pb-1">
                        {phase.courses.map((course) => (
                          <div
                            key={course.courseId}
                            className={`relative flex items-center gap-3 p-3.5 rounded-xl ${phaseColor.bg} border ${phaseColor.border} transition-all hover:shadow-sm`}
                          >
                            {/* Connector dot */}
                            <div className="absolute -left-[27px] w-3 h-3 rounded-full border-2 border-white" style={{ background: brandTheme.colors.primary + '40' }} />

                            {/* Sequence number */}
                            <div className={`w-8 h-8 rounded-lg ${phaseColor.iconBg} flex items-center justify-center flex-shrink-0`}>
                              <span className={`text-[12px] font-bold ${phaseColor.icon}`}>{course.sequenceOrder}</span>
                            </div>

                            {/* Course Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[13px] font-semibold text-gray-900 line-clamp-1">{course.courseName}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[11px] text-gray-500">{course.lectures} lectures</span>
                                <span className="text-[11px] text-gray-500">{course.duration}</span>
                                <span className="text-[10px] text-gray-400">{course.category}</span>
                              </div>
                            </div>

                            {/* Required badge */}
                            {course.isRequired ? (
                              <span className="text-[9px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-md flex-shrink-0">Required</span>
                            ) : (
                              <span className="text-[9px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded-md flex-shrink-0">Optional</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Phase connector */}
                      {!isLastPhase && (
                        <div className="flex items-center justify-center my-1 ml-3.5">
                          <div className="w-0.5 h-3 rounded-full" style={{ background: brandTheme.colors.primary + '30' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Info Footer Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="text-[11px] text-gray-400">
                Created by <span className="font-medium text-gray-600">{selectedPath.createdByName}</span>
              </div>
              <div className="text-[11px] text-gray-400">
                Updated {new Date(selectedPath.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                className="flex-1 py-3 text-sm font-semibold rounded-xl border-2 transition-all hover:shadow-sm"
                style={{ borderColor: brandTheme.colors.primary, color: brandTheme.colors.primary }}
              >
                <FontAwesomeIcon icon={faUserPlus} className="mr-2 text-xs" />
                Assign Students
              </button>
              <button
                className="flex-1 py-3 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                style={{ background: brandTheme.gradients.primary }}
              >
                <FontAwesomeIcon icon={faEdit} className="mr-2 text-xs" />
                Edit Path
              </button>
            </div>
          )}

          {isStudent && (
            <button
              className="w-full py-3 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
              style={{ background: brandTheme.gradients.primary }}
            >
              Start Learning Path
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faRoute} className="text-gray-300 text-3xl" />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">Select a Learning Path</p>
            <p className="text-[11px] text-gray-400">Choose a path from the left to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}