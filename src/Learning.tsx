import React, { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faUsers,
  faChartLine,
  faRoute,
  faListCheck,
  faComments,
  faFileLines,
  faBriefcase,
  faCode,
  faChevronLeft,
  faChevronDown,
  faChevronRight,
  faChevronsLeft,
  faChevronsRight,
  faBookOpen,
  faBooks,
  faAddressCard,
  faPlay,
  faDumbbell,
  faFileAlt,
  faClipboardList,
  faWrench,
  faBrain,
  faRotateRight,
  faRobot,
} from '@fortawesome/sharp-light-svg-icons';
import Courses from './Courses';
import LearningHome from './LearningHome';
import AISupportAssistant from './AISupportAssistant';
import Classes from './Classes';
import UserList from './UserList';
import CodingLab from './CodingLab';
import ResumeBuilderApp from './ResumeBuilderApp';
import LogicBuilder from './LogicBuilder';
import AIInterviewPractice from './AIInterviewPractice';
import JobListing from './JobListing';
import LearningPaths from './LearningPaths';
import type { Job } from './JobListing';
import { firebaseService } from './services/firebase_service';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Course interface
export interface Course {
  id: string;
  courseId?: string;
  name: string;
  thumbnail: string;
  category: string;
  lectures: number;
  duration: string;
  quizzes: number;
  exercises: number;
  progress: number;
  isEnrolled: boolean;
  notes?: number;
  totalChapters?: number;
  assessments?: number;
  completedCount?: number;
  instructor?: string;
  level?: string;
  tags?: string[];
  rating?: number;
  totalRatings?: number;
  createdAt?: string;
  tagLine?: string;
  description?: string;
  language?: string;
  enrollmentCount?: number;
  enrollmentId?: string;
}

interface LearningProps {
  onClose: () => void;
  brandTheme: {
    colors: {
      primary: string;
      secondary: string;
    };
    gradients: {
      primary: string;
    };
    collegeName?: string;
  };
  currentUser: any;
  selectedCollege?: { id: string; name: string } | null;
  onActiveMenuChange?: (menuItem: string) => void;
  selectedProblemSlug?: string;
  onOpenCurriculum?: (data: { courseName: string; courseSlug: string; curriculumData: any[]; isLoading: boolean; enrollmentId?: string; initialLectureId?: number }) => void;
}

// Helper function to decode HTML entities and render HTML
const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  
  // Create a textarea element to decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  let decoded = textarea.value;
  
  // Handle double-encoded entities (e.g., &amp;rsquo; -> &rsquo; -> ')
  textarea.innerHTML = decoded;
  decoded = textarea.value;
  
  // Replace common HTML entity patterns
  decoded = decoded
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  return decoded;
};

// Expandable Card Component
interface ExpandableCardProps {
  title: string;
  icon: any;
  iconBgColor: string;
  iconColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  headerBorderColor: string;
  content: string;
  brandTheme: any;
  isLoading?: boolean;
  markerColor?: string;
}

const ExpandableCard: React.FC<ExpandableCardProps> = ({
  title,
  icon,
  iconBgColor,
  iconColor,
  cardBgColor,
  cardBorderColor,
  headerBorderColor,
  content,
  brandTheme,
  isLoading = false,
  markerColor,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  
  // Check if content needs expansion (more than ~10 lines)
  React.useEffect(() => {
    if (contentRef.current) {
      const lineHeight = 22;
      const maxLines = 10;
      const maxHeight = lineHeight * maxLines;
      setNeedsExpansion(contentRef.current.scrollHeight > maxHeight);
    }
  }, [content]);

  const isGradient = cardBgColor.includes('gradient');
  const collapsedHeight = 220; // pixels for ~10 lines

  return (
    <div 
      className="rounded-xl border shadow-sm overflow-hidden"
      style={{ 
        background: isGradient ? cardBgColor : undefined,
        backgroundColor: !isGradient ? cardBgColor : undefined,
        borderColor: cardBorderColor
      }}
    >
      <div 
        className="px-5 py-3 border-b flex items-center gap-2"
        style={{ borderColor: headerBorderColor }}
      >
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconBgColor }}
        >
          <FontAwesomeIcon icon={icon} className="text-sm" style={{ color: iconColor }} />
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
            Loading...
          </div>
        ) : (
          <div className="relative">
            {/* Content container */}
            <div 
              ref={contentRef}
              className={`text-gray-600 text-sm leading-relaxed prose prose-sm max-w-none [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1 overflow-hidden`}
              style={{ 
                maxHeight: !isExpanded && needsExpansion ? `${collapsedHeight}px` : 'none',
                ...(markerColor ? { ['--marker-color' as any]: markerColor } : {})
              }}
              dangerouslySetInnerHTML={{ 
                __html: decodeHtmlEntities(content)
              }}
            />
            
            {/* Gradient Fade overlay when collapsed */}
            {needsExpansion && !isExpanded && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                style={{
                  background: isGradient 
                    ? 'linear-gradient(to top, rgb(240 253 244), transparent)' 
                    : `linear-gradient(to top, ${cardBgColor || 'white'}, transparent)`
                }}
              />
            )}
            
            {/* Show More/Less Button */}
            {needsExpansion && (
              <div className={`${!isExpanded ? 'pt-2' : 'pt-4'}`}>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-2 text-sm font-medium transition-all hover:gap-3"
                  style={{ color: brandTheme.colors.primary }}
                >
                  <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`text-xs transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Learning: React.FC<LearningProps> = ({ brandTheme, currentUser, selectedCollege, onActiveMenuChange, selectedProblemSlug, onOpenCurriculum }) => {
  const [activeMenuItem, setActiveMenuItem] = useState('progress');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(window.innerWidth < 1400);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const isSystemAdmin = currentUser?.userType === 'system_admin';
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [pendingCourseOpen, setPendingCourseOpen] = useState<{ lectureId?: number; trigger: number } | null>(null);
  const [isCoursesCollapsed, setIsCoursesCollapsed] = useState(false);
  const [isLearningPathsCollapsed, setIsLearningPathsCollapsed] = useState(false);
  const [isJobsCollapsed, setIsJobsCollapsed] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false); // Tools section expanded by default
  const [showAISupportFromSidebar, setShowAISupportFromSidebar] = useState(false);
  
  // Check if current user is a student
  const isStudent = currentUser?.userType === 'student';
  
  // Cached curriculum for student view
  const [cachedCurriculum, setCachedCurriculum] = useState<any[] | null>(null);
  const [isLoadingCachedCurriculum, setIsLoadingCachedCurriculum] = useState(false);
  const [expandedCurriculumUnits, setExpandedCurriculumUnits] = useState<string[]>([]);
  const [expandedCurriculumChapters, setExpandedCurriculumChapters] = useState<string[]>([]);
  
  // Auto-collapse left panel when window width < 1400px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1400) {
        setIsLeftCollapsed(true);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Fetch and cache curriculum for student when course is selected
  useEffect(() => {
    const fetchCurriculumForStudent = async () => {
      if (!isStudent || !selectedCourse?.id) {
        setCachedCurriculum(null);
        return;
      }
      
      setIsLoadingCachedCurriculum(true);
      try {
        const curriculum = await firebaseService.getCourseCurriculum(selectedCourse.id);
        // Transform curriculum data - V2 structure: unitName, chapterName, lectureName
        const transformedCurriculum = curriculum.map((unit: any, unitIndex: number) => ({
          id: unit.unitId || `unit-${unitIndex}`,
          title: unit.unitName || unit.title || `Unit ${unitIndex + 1}`,
          chapters: (unit.chapters || []).map((chapter: any, chapterIndex: number) => ({
            id: chapter.chapterId || `chapter-${unitIndex}-${chapterIndex}`,
            title: chapter.chapterName || chapter.title || `Chapter ${chapterIndex + 1}`,
            lectures: (chapter.lectures || []).map((lecture: any, lectureIndex: number) => ({
              id: lecture.lectureId || lecture.id || `lecture-${unitIndex}-${chapterIndex}-${lectureIndex}`,
              title: lecture.lectureName || lecture.title || `Lecture ${lectureIndex + 1}`,
              type: (lecture.lectureType || lecture.type || 'video').toLowerCase(),
              duration: lecture.durationInSeconds 
                ? `${Math.floor(lecture.durationInSeconds / 60)}:${String(lecture.durationInSeconds % 60).padStart(2, '0')}` 
                : (lecture.duration || ''),
              videoUrl: lecture.videoUrl || '',
            }))
          }))
        }));
        setCachedCurriculum(transformedCurriculum);
        // Auto-expand first unit and all its chapters by default
        if (transformedCurriculum.length > 0) {
          const firstUnit = transformedCurriculum[0];
          setExpandedCurriculumUnits([firstUnit.id]);
          const firstUnitChapterKeys = (firstUnit.chapters || []).map((ch: any) => `${firstUnit.id}-${ch.id}`);
          setExpandedCurriculumChapters(firstUnitChapterKeys);
        }
      } catch (error) {
        console.error('Error fetching curriculum for student:', error);
        setCachedCurriculum(null);
      } finally {
        setIsLoadingCachedCurriculum(false);
      }
    };

    fetchCurriculumForStudent();
  }, [isStudent, selectedCourse?.id]);
  
  // College-specific enrollment count for selected course
  const [collegeEnrollmentCount, setCollegeEnrollmentCount] = useState<number>(0);
  
  // Course Details State (fetched from details/content subcollection)
  const [courseDetails, setCourseDetails] = useState<{
    courseDescription?: string;
    coursePurpose?: string;
    coursePrerequisite?: string;
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Course info section collapse state (tagline + description + what you'll learn + prerequisites)
  const [isCourseInfoExpanded, setIsCourseInfoExpanded] = useState(false);

  // Fetch course details when a course is selected
  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (!selectedCourse?.id) {
        setCourseDetails(null);
        return;
      }
      
      console.log('Fetching details for course slug:', selectedCourse.id);
      setIsLoadingDetails(true);
      try {
        const details = await firebaseService.getCourseDetails(selectedCourse.id);
        console.log('Fetched course details:', details);
        setCourseDetails(details);
      } catch (error) {
        console.error('Error fetching course details:', error);
        setCourseDetails(null);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchCourseDetails();
  }, [selectedCourse?.id]);

  // Clear selected course when college changes (for system admin)
  useEffect(() => {
    if (currentUser?.userType === 'system_admin') {
      setSelectedCourse(null);
      setCollegeEnrollmentCount(0);
    }
  }, [selectedCollege?.id]);

  // Fetch college features
  useEffect(() => {
    const fetchCollegeFeatures = async () => {
      let collegeIdToUse: string | null = null;
      
      if (currentUser?.userType === 'system_admin') {
        collegeIdToUse = selectedCollege?.id || null;
      } else {
        collegeIdToUse = currentUser?.collegeId || null;
      }
      
      if (!collegeIdToUse) {
        setCollegeFeatures([]);
        return;
      }
      
      try {
        const collegeData = await firebaseService.getCollege(collegeIdToUse);
        if (collegeData?.features) {
          setCollegeFeatures(collegeData.features);
        } else {
          setCollegeFeatures([]);
        }
      } catch (error) {
        console.error('Error fetching college features:', error);
        setCollegeFeatures([]);
      }
    };
    
    fetchCollegeFeatures();
  }, [selectedCollege?.id, currentUser?.collegeId, currentUser?.userType]);

  // Set college-specific enrollment count when course changes
  useEffect(() => {
    if (!selectedCourse) {
      setCollegeEnrollmentCount(0);
      return;
    }
    
    // If enrollmentCount already available, use it
    if (selectedCourse.enrollmentCount && selectedCourse.enrollmentCount > 0) {
      setCollegeEnrollmentCount(selectedCourse.enrollmentCount);
      return;
    }

    // Otherwise fetch from college_courses or course_enrollments
    const fetchCount = async () => {
      try {
        const collegeId = currentUser?.userType === 'system_admin' 
          ? (selectedCollege?.id || '') 
          : (currentUser?.collegeId || '');
        if (collegeId && selectedCourse.courseId) {
          const count = await firebaseService.getCourseEnrollmentCountByCollege(
            String(selectedCourse.courseId), collegeId, selectedCourse.id
          );
          setCollegeEnrollmentCount(count);
        }
      } catch (err) {
        console.error('Error fetching enrollment count:', err);
      }
    };
    fetchCount();
  }, [selectedCourse]);
  
  // Users/Classes States
  const [selectedClassForUsers, setSelectedClassForUsers] = useState<string | null>(null);
  const [usersRefreshTrigger, setUsersRefreshTrigger] = useState(0);
  
  // Enroll Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isLoadingEnrollData, setIsLoadingEnrollData] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all');
  const [enrollCurrentPage, setEnrollCurrentPage] = useState(1);
  const [enrollmentEndDate, setEnrollmentEndDate] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date().getMonth());
  const [datePickerYear, setDatePickerYear] = useState(new Date().getFullYear());
  const [editingExpiryUserId, setEditingExpiryUserId] = useState<string | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [isUpdatingExpiry, setIsUpdatingExpiry] = useState(false);
  const enrollUsersPerPage = 25;
  
  // Admin Assignment States (for administrators tab)
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [, setAdminSearchQuery] = useState('');
  const [isAssigningToAdmins, setIsAssigningToAdmins] = useState(false);

  // Student Progress Modal States
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<any | null>(null);
  const [isStudentProgressModalOpen, setIsStudentProgressModalOpen] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [isStudentProfileModalOpen, setIsStudentProfileModalOpen] = useState(false);

  // Student enrolled courses - paginated from server
  const [studentEnrolledCourses, setStudentEnrolledCourses] = useState<any[]>([]);
  const [studentEnrollCurrentPage, setStudentEnrollCurrentPage] = useState(1);
  const [studentEnrollTotalCount, setStudentEnrollTotalCount] = useState(0);
  const [studentEnrollPageCache, setStudentEnrollPageCache] = useState<Map<number, { courses: any[], lastDoc: any }>>(new Map());
  const [isLoadingStudentEnrollments, setIsLoadingStudentEnrollments] = useState(false);
  const studentEnrollPerPage = 5;
  const studentEnrollScrollRef = React.useRef<HTMLDivElement>(null);

  // Enrolled Students Data
  const enrolledStudentsList = [
    { id: '1', name: 'Rahul Sharma', className: 'Class 10-A', email: 'rahul.s@email.com', enrolled: '10 Jan 2026', progress: 85, status: 'In Progress', score: null, avatar: 'RS', totalMarks: 3100, maxMarks: 3649, exerciseMarks: 1950, maxExerciseMarks: 2290, quizMarks: 280, maxQuizMarks: 329, lectures: 70, maxLectures: 82, assessments: 740, maxAssessments: 870, completedDate: null, certificateId: null, feedback: null, totalCourseDuration: '12h 55m', learningTime: '10h 58m', avgDailyLearningTime: '45m' },
    { id: '2', name: 'Priya Patel', className: 'Class 10-B', email: 'priya.p@email.com', enrolled: '08 Jan 2026', progress: 100, status: 'Completed', score: 92, avatar: 'PP', totalMarks: 3357, maxMarks: 3649, exerciseMarks: 2107, maxExerciseMarks: 2290, quizMarks: 302, maxQuizMarks: 329, lectures: 82, maxLectures: 82, assessments: 800, maxAssessments: 870, completedDate: '26/08/2025', certificateId: 'TP-KHYXCQNR', feedback: { rating: 5, comment: 'Excellent course! The content was well-structured and the exercises were very helpful. Highly recommend for beginners.', date: '27/08/2025' }, totalCourseDuration: '12h 55m', learningTime: '12h 55m', avgDailyLearningTime: '52m' },
    { id: '3', name: 'Amit Kumar', className: 'Class 9-A', email: 'amit.k@email.com', enrolled: '12 Jan 2026', progress: 45, status: 'In Progress', score: null, avatar: 'AK', totalMarks: 1642, maxMarks: 3649, exerciseMarks: 1030, maxExerciseMarks: 2290, quizMarks: 148, maxQuizMarks: 329, lectures: 37, maxLectures: 82, assessments: 391, maxAssessments: 870, completedDate: null, certificateId: null, feedback: null, totalCourseDuration: '12h 55m', learningTime: '5h 49m', avgDailyLearningTime: '35m' },
    { id: '4', name: 'Sneha Gupta', className: 'Class 10-A', email: 'sneha.g@email.com', enrolled: '05 Jan 2026', progress: 100, status: 'Completed', score: 88, avatar: 'SG', totalMarks: 3211, maxMarks: 3649, exerciseMarks: 2015, maxExerciseMarks: 2290, quizMarks: 289, maxQuizMarks: 329, lectures: 82, maxLectures: 82, assessments: 765, maxAssessments: 870, completedDate: '15/09/2025', certificateId: 'TP-ABCD1234', feedback: null, totalCourseDuration: '12h 55m', learningTime: '12h 55m', avgDailyLearningTime: '48m' },
    { id: '5', name: 'Vikram Singh', className: 'Class 9-B', email: 'vikram.s@email.com', enrolled: '15 Jan 2026', progress: 20, status: 'In Progress', score: null, avatar: 'VS', totalMarks: 729, maxMarks: 3649, exerciseMarks: 458, maxExerciseMarks: 2290, quizMarks: 65, maxQuizMarks: 329, lectures: 16, maxLectures: 82, assessments: 174, maxAssessments: 870, completedDate: null, certificateId: null, feedback: null, totalCourseDuration: '12h 55m', learningTime: '2h 35m', avgDailyLearningTime: '26m' },
    { id: '6', name: 'Ananya Reddy', className: 'Class 10-A', email: 'ananya.r@email.com', enrolled: '03 Jan 2026', progress: 100, status: 'Completed', score: 95, avatar: 'AR', totalMarks: 3466, maxMarks: 3649, exerciseMarks: 2175, maxExerciseMarks: 2290, quizMarks: 312, maxQuizMarks: 329, lectures: 82, maxLectures: 82, assessments: 826, maxAssessments: 870, completedDate: '20/08/2025', certificateId: 'TP-WXYZ5678', feedback: { rating: 4, comment: 'Great course overall. Would love more advanced topics in future updates.', date: '22/08/2025' }, totalCourseDuration: '12h 55m', learningTime: '12h 55m', avgDailyLearningTime: '58m' },
  ];

  // Navigate to previous student
  const goToPreviousStudent = () => {
    if (currentStudentIndex > 0) {
      const newIndex = currentStudentIndex - 1;
      setCurrentStudentIndex(newIndex);
      setSelectedStudentForProgress(enrolledStudentsList[newIndex]);
    }
  };

  // Navigate to next student
  const goToNextStudent = () => {
    if (currentStudentIndex < enrolledStudentsList.length - 1) {
      const newIndex = currentStudentIndex + 1;
      setCurrentStudentIndex(newIndex);
      setSelectedStudentForProgress(enrolledStudentsList[newIndex]);
    }
  };

  // Notify parent component when activeMenuItem changes
  React.useEffect(() => {
    if (onActiveMenuChange) {
      onActiveMenuChange(activeMenuItem);
    }
  }, [activeMenuItem, onActiveMenuChange]);

  // Fetch student enrolled courses (paginated) when modal opens or page changes
  React.useEffect(() => {
    if (!isStudentProfileModalOpen || !selectedStudentForProgress) return;
    
    const fetchStudentEnrollments = async () => {
      setIsLoadingStudentEnrollments(true);
      try {
        const userId = (selectedStudentForProgress as any).userId 
          || (selectedStudentForProgress as any).id 
          || (selectedStudentForProgress as any).uid
          || (selectedStudentForProgress as any).studentId;
        
        if (!userId) {
          setStudentEnrolledCourses([]);
          setStudentEnrollTotalCount(0);
          setIsLoadingStudentEnrollments(false);
          return;
        }

        // Get cursor from previous page cache
        const previousPageCache = studentEnrollCurrentPage > 1 ? studentEnrollPageCache.get(studentEnrollCurrentPage - 1) : null;
        const startAfterDoc = previousPageCache?.lastDoc || null;

        const result = await firebaseService.getStudentCourseEnrollmentsPaginated({
          userId,
          limit: studentEnrollPerPage,
          startAfterDoc: startAfterDoc,
        });

        // Transform enrollment data to course card format
        const courses = result.enrollments.map((enrollment: any) => ({
          id: enrollment.courseId || enrollment.id,
          name: enrollment.courseName || enrollment.courseTitle || `Course ${enrollment.courseId}`,
          lectures: enrollment.totalLectures || 0,
          duration: enrollment.totalDuration || '0m',
          category: enrollment.category || '',
          exercises: enrollment.totalExercises || 0,
          totalChapters: enrollment.totalChapters || 0,
          quizzes: enrollment.totalQuizzes || 0,
          assessments: enrollment.totalAssessments || 0,
          marks: enrollment.progress?.percentage === 100 ? (enrollment.marks || 0) : undefined,
          progress: enrollment.progress?.percentage || 0,
          status: enrollment.progress?.percentage === 100 ? 'completed' : 'in_progress',
          assignedOn: enrollment.enrolledAt?.toDate ? 
            enrollment.enrolledAt.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) :
            (enrollment.enrolledAt?.seconds ? 
              new Date(enrollment.enrolledAt.seconds * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) :
              'N/A'),
        }));

        setStudentEnrolledCourses(courses);
        setStudentEnrollTotalCount(result.totalCount);
        
        // Cache this page
        setStudentEnrollPageCache(prev => new Map(prev).set(studentEnrollCurrentPage, {
          courses,
          lastDoc: result.lastDoc
        }));
      } catch (error) {
        console.error('Error fetching student enrollments:', error);
        setStudentEnrolledCourses([]);
        setStudentEnrollTotalCount(0);
      } finally {
        setIsLoadingStudentEnrollments(false);
      }
    };

    fetchStudentEnrollments();
  }, [isStudentProfileModalOpen, selectedStudentForProgress, studentEnrollCurrentPage]);

  // Reset pagination when student changes
  React.useEffect(() => {
    setStudentEnrollCurrentPage(1);
    setStudentEnrollPageCache(new Map());
    setStudentEnrolledCourses([]);
    setStudentEnrollTotalCount(0);
  }, [(selectedStudentForProgress as any)?.userId || selectedStudentForProgress?.id]);

  // Student enrollment pagination helpers
  const studentEnrollTotalPages = Math.ceil(studentEnrollTotalCount / studentEnrollPerPage);

  const handleStudentEnrollPageChange = (page: number) => {
    if (page < 1 || page > studentEnrollTotalPages || page === studentEnrollCurrentPage) return;
    setStudentEnrollCurrentPage(page);
    if (studentEnrollScrollRef.current) {
      studentEnrollScrollRef.current.scrollTop = 0;
    }
  };

  const getStudentEnrollPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsisThreshold = 7;
    
    if (studentEnrollTotalPages <= showEllipsisThreshold) {
      for (let i = 1; i <= studentEnrollTotalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (studentEnrollCurrentPage > 3) pages.push('...');
      const start = Math.max(2, studentEnrollCurrentPage - 1);
      const end = Math.min(studentEnrollTotalPages - 1, studentEnrollCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (studentEnrollCurrentPage < studentEnrollTotalPages - 2) pages.push('...');
      if (!pages.includes(studentEnrollTotalPages)) pages.push(studentEnrollTotalPages);
    }
    return pages;
  };

  // State for valid classes in enroll modal
  const [enrollValidClasses, setEnrollValidClasses] = useState<string[]>([]);
  const [collegeFeatures, setCollegeFeatures] = useState<string[]>([]);

  // Fetch enrolled users when Enroll modal opens
  const openEnrollModal = async () => {
    setIsEnrollModalOpen(true);
    setIsLoadingEnrollData(true);
    setSelectedUsers([]);
    setUserSearchQuery('');
    setSelectedClassFilter('all');
    setSelectedSectionFilter('all');
    setEnrollCurrentPage(1);
    setEnrollValidClasses([]);
    setEnrollmentEndDate('');
    setEnrollmentResult(null);
    setAdminUsers([]);
    setSelectedAdmins([]);
    setAdminSearchQuery('');
    
    try {
      // Determine which college to use based on user type
      let collegeIdToUse: string | null = null;
      
      if (currentUser?.userType === 'system_admin') {
        // System Admin: Use the selected college from dropdown
        collegeIdToUse = selectedCollege?.id || null;
      } else if (currentUser?.userType !== 'student') {
        // Other roles (admin, principal, dean, teacher): Use their own college
        collegeIdToUse = currentUser?.collegeId || null;
      }
      
      if (!collegeIdToUse) {
        console.error('No college ID available');
        setAvailableUsers([]);
        setEnrollValidClasses([]);
        return;
      }
      
      // Fetch college data to get valid classes
      const collegeData = await firebaseService.getCollege(collegeIdToUse);
      if (collegeData?.validClasses) {
        setEnrollValidClasses(collegeData.validClasses);
      }
      
      // Fetch users from the college (all users)
      const users = await firebaseService.getUsersByCollege(collegeIdToUse);
      
      // Fetch already enrolled users for this course
      const courseId = selectedCourse?.courseId || selectedCourse?.id;
      let enrollmentMap: Map<string, any> = new Map();
      if (courseId && collegeIdToUse) {
        console.log('📚 Fetching enrollments for courseId:', courseId);
        // Fetch all enrollments for this college (paginated, but we need all for the modal)
        let allEnrollments: any[] = [];
        let lastDoc = null;
        let hasMore = true;
        
        while (hasMore) {
          const result = await firebaseService.getCourseEnrollmentsPaginated(courseId, collegeIdToUse, 100, lastDoc);
          allEnrollments = [...allEnrollments, ...result.enrollments];
          lastDoc = result.lastDoc;
          hasMore = result.hasMore;
        }
        
        console.log('📚 Enrollments found:', allEnrollments.length);
        // Create a map of userId -> enrollment data
        allEnrollments.forEach((e: any) => {
          enrollmentMap.set(e.userId, {
            enrollmentId: e.enrollmentId || e.id,
            expiryDate: e.expiryDate?.toDate?.() || e.expiryDate || null,
            enrolledAt: e.enrolledAt?.toDate?.() || e.enrolledAt || null,
          });
        });
        console.log('📚 Enrolled user IDs:', Array.from(enrollmentMap.keys()));
      }
      
      // Filter to only show students and transform data, marking enrolled users
      const studentUsers = users
        .filter(user => user.userType === 'student')
        .map(user => {
          const enrollment = enrollmentMap.get(user.userId);
          const isEnrolled = !!enrollment;
          if (isEnrolled) {
            console.log(`✅ User ${user.fullName} (${user.userId}) is enrolled`);
          }
          return {
            id: user.userId,
            name: user.fullName || user.email?.split('@')[0] || 'Unknown',
            email: user.email || '',
            className: user.studentClass || 'Unassigned',
            section: user.studentClass?.includes('-') ? user.studentClass.split('-')[1] : '',
            avatar: (user.fullName || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
            isEnrolled,
            enrollmentId: enrollment?.enrollmentId || null,
            expiryDate: enrollment?.expiryDate || null,
            enrolledAt: enrollment?.enrolledAt || null,
          };
        });
      
      // Filter admin users (admin, teacher, dean, principal)
      const adminTypes = ['admin', 'teacher', 'dean', 'principal'];
      const adminUsersList = users
        .filter(user => adminTypes.includes(user.userType))
        .map(user => {
          const enrollment = enrollmentMap.get(user.userId);
          const isAssigned = !!enrollment;
          return {
            id: user.userId,
            name: user.fullName || user.email?.split('@')[0] || 'Unknown',
            email: user.email || '',
            userType: user.userType,
            avatar: (user.fullName || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
            isAssigned,
            assignedAt: enrollment?.enrolledAt || null,
          };
        });
      
      console.log('📚 Total students:', studentUsers.length, 'Enrolled:', studentUsers.filter(u => u.isEnrolled).length);
      console.log('👤 Total admins:', adminUsersList.length, 'Assigned:', adminUsersList.filter(u => u.isAssigned).length);
      setAvailableUsers(studentUsers);
      setAdminUsers(adminUsersList);
    } catch (error) {
      console.error('Error fetching users:', error);
      setAvailableUsers([]);
      setAdminUsers([]);
    } finally {
      setIsLoadingEnrollData(false);
    }
  };

  // Auto-open curriculum when triggered from LearningHome play button
  useEffect(() => {
    if (pendingCourseOpen && selectedCourse) {
      openCurriculumPage(pendingCourseOpen.lectureId);
      setPendingCourseOpen(null);
    }
  }, [pendingCourseOpen, selectedCourse]);

  // Fetch curriculum when Curriculum page opens
  const openCurriculumPage = async (initialLectureId?: number) => {
    // Call App.tsx callback to show curriculum page (this unmounts Learning)
    if (onOpenCurriculum) {
      // Use enrollmentId from selectedCourse if available (already fetched for students)
      const enrollmentId = selectedCourse?.enrollmentId;
      
      // For students, use cached curriculum if available
      if (isStudent && cachedCurriculum && cachedCurriculum.length > 0) {
        // Transform cached curriculum to the format expected by CourseCurriculum
        const transformedCurriculum = cachedCurriculum.map((unit: any) => ({
          id: unit.id,
          title: unit.title,
          chapters: unit.chapters.map((chapter: any) => ({
            id: chapter.id,
            title: chapter.title,
            items: chapter.lectures.map((lecture: any) => ({
              id: lecture.id,
              type: lecture.type,
              title: lecture.title,
              duration: lecture.duration,
              videoUrl: lecture.videoUrl || '',
            }))
          }))
        }));
        
        onOpenCurriculum({
          courseName: selectedCourse?.name || '',
          courseSlug: selectedCourse?.id || '',
          curriculumData: transformedCurriculum,
          isLoading: false,
          enrollmentId,
          initialLectureId
        });
        return;
      }
      
      onOpenCurriculum({
        courseName: selectedCourse?.name || '',
        courseSlug: selectedCourse?.id || '',
        curriculumData: [],
        isLoading: true,
        enrollmentId,
        initialLectureId
      });
      
      try {
        // Fetch real curriculum from Firebase (V2 structure)
        const curriculum = await firebaseService.getCourseCurriculum(selectedCourse?.id || '');
        
        // Transform Firebase data to page format
        // V2 structure: Unit.chapters is array, Chapter.lectures is array
        const transformedCurriculum = curriculum.map((unit: any, unitIndex: number) => ({
          id: unit.unitId || `unit-${unitIndex + 1}`,
          title: unit.unitName || `Unit ${unitIndex + 1}`,
          chapters: (unit.chapters || []).map((chapter: any) => ({
            id: chapter.chapterId,
            title: chapter.chapterName,
            items: (chapter.lectures || []).map((lecture: any) => ({
              id: lecture.lectureId,
              type: (lecture.lectureType || 'video').toLowerCase(),
              title: lecture.lectureName,
              duration: lecture.durationInSeconds ? `${Math.floor(lecture.durationInSeconds / 60)}:${String(lecture.durationInSeconds % 60).padStart(2, '0')}` : '',
              videoUrl: lecture.videoUrl || '',
            }))
          }))
        }));
        
        // Update with loaded data
        onOpenCurriculum({
          courseName: selectedCourse?.name || '',
          courseSlug: selectedCourse?.id || '',
          curriculumData: transformedCurriculum,
          isLoading: false,
          enrollmentId,
          initialLectureId
        });
      } catch (error) {
        console.error('Error fetching curriculum:', error);
        onOpenCurriculum({
          courseName: selectedCourse?.name || '',
          courseSlug: selectedCourse?.id || '',
          curriculumData: [],
          isLoading: false,
          enrollmentId
        });
      }
      return;
    }
    
    // Fallback if no callback (shouldn't happen)
    /* FALLBACK DISABLED - state variables removed
    setShowCurriculumPage(true);
    setIsLoadingCurriculum(true);
    
    try {
      const curriculum = await firebaseService.getCourseCurriculum(selectedCourse?.id || '');
      
      const transformedCurriculum = curriculum.map((unit: any, unitIndex: number) => ({
        id: unit.unitId || `unit-${unitIndex + 1}`,
        title: unit.unitName || `Unit ${unitIndex + 1}`,
        chapters: (unit.chapters || []).map((chapter: any) => ({
          id: chapter.chapterId,
          title: chapter.chapterName,
          items: (chapter.lectures || []).map((lecture: any) => ({
            id: lecture.lectureId,
            type: (lecture.lectureType || 'video').toLowerCase(),
            title: lecture.lectureName,
            duration: lecture.durationInSeconds ? `${Math.floor(lecture.durationInSeconds / 60)}:${String(lecture.durationInSeconds % 60).padStart(2, '0')}` : '',
            videoUrl: lecture.videoUrl || '',
          }))
        }))
      }));
      
      setCurriculumData(transformedCurriculum);

      COMMENTED OUT - Sample Data
      // Simulating API call with sample data
      await new Promise(resolve => setTimeout(resolve, 800));
      const sampleCurriculum = [
        {
          id: 'sec-1',
          title: 'Introduction to Programming',
          chapters: [
            {
              id: 'ch-1-1',
              title: 'Getting Started',
              items: [
                { id: 'item-1-1-1', type: 'video', title: 'Welcome to the Course', duration: '5:30' },
                { id: 'item-1-1-2', type: 'text', title: 'Course Overview', duration: '3 min read' },
                { id: 'item-1-1-3', type: 'exercise', title: 'Setup Your Environment', duration: '15 min' },
              ]
            },
            {
              id: 'ch-1-2',
              title: 'Basic Concepts',
              items: [
                { id: 'item-1-2-1', type: 'video', title: 'Variables and Data Types', duration: '12:45' },
                { id: 'item-1-2-2', type: 'pdf', title: 'Quick Reference Guide', duration: '5 pages' },
                { id: 'item-1-2-3', type: 'exercise', title: 'Practice Variables', duration: '20 min' },
                { id: 'item-1-2-4', type: 'assessment', title: 'Quiz: Basic Concepts', duration: '10 questions' },
              ]
            }
          ]
        },
        {
          id: 'sec-2',
          title: 'Control Structures',
          chapters: [
            {
              id: 'ch-2-1',
              title: 'Conditional Statements',
              items: [
                { id: 'item-2-1-1', type: 'video', title: 'If-Else Statements', duration: '15:20' },
                { id: 'item-2-1-2', type: 'video', title: 'Switch Cases', duration: '10:15' },
                { id: 'item-2-1-3', type: 'exercise', title: 'Conditional Practice', duration: '25 min' },
              ]
            },
            {
              id: 'ch-2-2',
              title: 'Loops',
              items: [
                { id: 'item-2-2-1', type: 'video', title: 'For Loops', duration: '14:30' },
                { id: 'item-2-2-2', type: 'video', title: 'While Loops', duration: '11:45' },
                { id: 'item-2-2-3', type: 'text', title: 'Loop Best Practices', duration: '4 min read' },
                { id: 'item-2-2-4', type: 'exercise', title: 'Loop Challenges', duration: '30 min' },
                { id: 'item-2-2-5', type: 'assessment', title: 'Quiz: Loops', duration: '15 questions' },
              ]
            }
          ]
        },
        {
          id: 'sec-3',
          title: 'Functions & Methods',
          chapters: [
            {
              id: 'ch-3-1',
              title: 'Function Basics',
              items: [
                { id: 'item-3-1-1', type: 'video', title: 'Defining Functions', duration: '18:00' },
                { id: 'item-3-1-2', type: 'video', title: 'Parameters & Return Values', duration: '16:30' },
                { id: 'item-3-1-3', type: 'pdf', title: 'Function Cheat Sheet', duration: '3 pages' },
                { id: 'item-3-1-4', type: 'exercise', title: 'Create Your Functions', duration: '35 min' },
                { id: 'item-3-1-5', type: 'assessment', title: 'Module Assessment', duration: '20 questions' },
              ]
            }
          ]
        }
      ];
      setCurriculumData(sampleCurriculum);
      setExpandedSections(sampleCurriculum.map(section => section.id));
      setExpandedChapters(sampleCurriculum.flatMap(section => section.chapters.map(chapter => chapter.id)));
      END COMMENTED OUT
    } catch (error) {
      console.error('Error fetching curriculum:', error);
      setCurriculumData([]);
    } finally {
      setIsLoadingCurriculum(false);
    }
    END FALLBACK DISABLED */
    console.warn('openCurriculumPage: No onOpenCurriculum callback provided');
  };

  // Get unique classes and sections for filters

  // Filter users based on search and class filter
  const filteredUsers = selectedClassFilter === 'administrators' 
    ? adminUsers.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
        return matchesSearch;
      })
    : availableUsers.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
        const matchesClass = selectedClassFilter === 'all' || user.className === selectedClassFilter;
        const matchesSection = selectedSectionFilter === 'all' || user.section === selectedSectionFilter;
        return matchesSearch && matchesClass && matchesSection;
      });

  // Check if we're in administrators mode
  const isAdminMode = selectedClassFilter === 'administrators';

  // Pagination for enroll modal
  const totalEnrollPages = Math.ceil(filteredUsers.length / enrollUsersPerPage);
  const paginatedUsers = filteredUsers.slice(
    (enrollCurrentPage - 1) * enrollUsersPerPage,
    enrollCurrentPage * enrollUsersPerPage
  );

  const toggleUserSelection = (userId: string) => {
    if (isAdminMode) {
      setSelectedAdmins(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    } else {
      setSelectedUsers(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    }
  };

  // Get users available for selection (not already enrolled/assigned)
  const selectableUsers = isAdminMode 
    ? filteredUsers.filter((u: any) => !u.isAssigned)
    : filteredUsers.filter((u: any) => !u.isEnrolled);

  const handleSelectAll = () => {
    if (isAdminMode) {
      if (selectedAdmins.length === selectableUsers.length && selectableUsers.length > 0) {
        setSelectedAdmins([]);
      } else {
        setSelectedAdmins(selectableUsers.map((u: any) => u.id));
      }
    } else {
      if (selectedUsers.length === selectableUsers.length && selectableUsers.length > 0) {
        setSelectedUsers([]);
      } else {
        setSelectedUsers(selectableUsers.map((u: any) => u.id));
      }
    }
  };

  // Get current selection count
  const currentSelectionCount = isAdminMode ? selectedAdmins.length : selectedUsers.length;

  // Handle enrollment submission
  const handleEnrollUsers = async () => {
    if (selectedUsers.length === 0 || !selectedCourse) return;
    
    setIsEnrolling(true);
    setEnrollmentResult(null);
    
    try {
      // Determine collegeId
      let collegeId = '';
      if (currentUser?.userType === 'system_admin') {
        collegeId = selectedCollege?.id || '';
      } else {
        collegeId = currentUser?.collegeId || '';
      }
      
      // Parse expiry date if set
      const expiryDate = enrollmentEndDate ? new Date(enrollmentEndDate) : null;
      
      // Call the enrollment service - use numeric courseId for enrollment record, slug for course update
      const result = await firebaseService.enrollUsersToCourse(
        selectedCourse.courseId || selectedCourse.id,
        selectedUsers,
        currentUser?.userId || currentUser?.uid || '',
        collegeId,
        expiryDate,
        'manual',
        selectedCourse.id  // Pass slug (id) for updating course document
      );
      
      if (result.success && result.enrolledCount > 0) {
        // Mark newly enrolled users in the list
        setAvailableUsers(prev => prev.map(user => 
          selectedUsers.includes(user.id) ? { ...user, isEnrolled: true } : user
        ));
        
        // Update the enrollment count in UI
        setCollegeEnrollmentCount(prev => prev + result.enrolledCount);
        
        // Update selectedCourse with new count
        if (selectedCourse) {
          setSelectedCourse({
            ...selectedCourse,
            enrollmentCount: (selectedCourse.enrollmentCount || 0) + result.enrolledCount
          });
        }
        
        setEnrollmentResult({
          success: true,
          message: `Successfully enrolled ${result.enrolledCount} student${result.enrolledCount > 1 ? 's' : ''} to the course!`
        });
        // Clear selected users after successful enrollment
        setSelectedUsers([]);
        setEnrollmentEndDate('');
      } else if (result.enrolledCount > 0) {
        // Mark newly enrolled users in the list
        setAvailableUsers(prev => prev.map(user => 
          selectedUsers.includes(user.id) ? { ...user, isEnrolled: true } : user
        ));
        
        // Update the enrollment count in UI
        setCollegeEnrollmentCount(prev => prev + result.enrolledCount);
        
        // Update selectedCourse with new count
        if (selectedCourse) {
          setSelectedCourse({
            ...selectedCourse,
            enrollmentCount: (selectedCourse.enrollmentCount || 0) + result.enrolledCount
          });
        }
        
        setEnrollmentResult({
          success: true,
          message: `Enrolled ${result.enrolledCount} student${result.enrolledCount > 1 ? 's' : ''}. Some users may already be enrolled.`
        });
        setSelectedUsers([]);
      } else {
        setEnrollmentResult({
          success: false,
          message: result.errors.length > 0 ? result.errors[0] : 'Failed to enroll students. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error enrolling users:', error);
      setEnrollmentResult({
        success: false,
        message: 'An error occurred while enrolling students. Please try again.'
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  // Handle assigning course to administrators
  const handleAssignToAdmins = async () => {
    if (selectedAdmins.length === 0 || !selectedCourse) return;
    
    setIsAssigningToAdmins(true);
    setEnrollmentResult(null);
    
    try {
      // Determine collegeId
      let collegeId = '';
      if (currentUser?.userType === 'system_admin') {
        collegeId = selectedCollege?.id || '';
      } else {
        collegeId = currentUser?.collegeId || '';
      }
      
      // For admins, we use the same enrollment mechanism but mark them differently
      // This gives them access to the course and ability to assign it to students
      const result = await firebaseService.enrollUsersToCourse(
        selectedCourse.courseId || selectedCourse.id,
        selectedAdmins,
        currentUser?.userId || currentUser?.uid || '',
        collegeId,
        null, // No expiry for admins
        'manual',
        selectedCourse.id
      );
      
      if (result.success && result.enrolledCount > 0) {
        // Mark newly assigned admins in the list
        setAdminUsers(prev => prev.map(user => 
          selectedAdmins.includes(user.id) ? { ...user, isAssigned: true } : user
        ));
        
        setEnrollmentResult({
          success: true,
          message: `Successfully assigned course to ${result.enrolledCount} administrator${result.enrolledCount > 1 ? 's' : ''}!`
        });
        setSelectedAdmins([]);
      } else if (result.enrolledCount > 0) {
        setAdminUsers(prev => prev.map(user => 
          selectedAdmins.includes(user.id) ? { ...user, isAssigned: true } : user
        ));
        
        setEnrollmentResult({
          success: true,
          message: `Assigned to ${result.enrolledCount} administrator${result.enrolledCount > 1 ? 's' : ''}. Some may already have access.`
        });
        setSelectedAdmins([]);
      } else {
        setEnrollmentResult({
          success: false,
          message: result.errors.length > 0 ? result.errors[0] : 'Failed to assign course. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error assigning to admins:', error);
      setEnrollmentResult({
        success: false,
        message: 'An error occurred while assigning course to administrators. Please try again.'
      });
    } finally {
      setIsAssigningToAdmins(false);
    }
  };

  // Handle expiry date update for enrolled user
  const handleUpdateExpiry = async (userId: string, enrollmentId: string) => {
    if (!enrollmentId) return;
    
    setIsUpdatingExpiry(true);
    try {
      const newExpiryDate = editExpiryDate ? new Date(editExpiryDate) : null;
      
      await firebaseService.updateEnrollmentExpiry(enrollmentId, newExpiryDate);
      
      // Update local state
      setAvailableUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, expiryDate: newExpiryDate }
          : user
      ));
      
      setEditingExpiryUserId(null);
      setEditExpiryDate('');
      
      setEnrollmentResult({
        success: true,
        message: newExpiryDate 
          ? `Expiry date updated to ${newExpiryDate.toLocaleDateString()}`
          : 'Expiry date removed (unlimited access)'
      });
    } catch (error) {
      console.error('Error updating expiry:', error);
      setEnrollmentResult({
        success: false,
        message: 'Failed to update expiry date'
      });
    } finally {
      setIsUpdatingExpiry(false);
    }
  };

  // ===== Manual Sync Handler (system_admin only) =====
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const fns = getFunctions(undefined, 'us-central1');
      const syncFn = httpsCallable(fns, 'syncStudentLearningDetailsManual');
      const result: any = await syncFn();
      setSyncResult(result.data?.message || 'Sync complete');
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err: any) {
      console.error('❌ Sync failed:', err);
      setSyncResult(`Error: ${err.message || 'Sync failed'}`);
      setTimeout(() => setSyncResult(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Menu items - filter based on user type
  const allMenuItems = [
    { id: 'progress', name: 'Study Progress', icon: faChartLine, description: 'Track learning progress' },
    { id: 'courses', name: 'Courses', icon: faBooks, description: 'Browse all available courses' },
    { id: 'learningpaths', name: 'Learning Paths', icon: faRoute, description: 'Guided course roadmaps' },
    { id: 'students', name: 'Users', icon: faUsers, description: 'View and manage students', hideForStudent: true },
    { id: 'interviews', name: 'AI Interview', icon: faComments, description: 'AI-powered interview preparation' },
    { id: 'jobs', name: 'Job Listing', icon: faBriefcase, description: 'Browse job opportunities' },
  ];
  
  // Filter out items that should be hidden for students
  const menuItems = currentUser?.userType === 'student' 
    ? allMenuItems.filter(item => !item.hideForStudent)
    : allMenuItems;

  return (
    <div className="flex flex-1 h-full w-full overflow-y-hidden overflow-x-auto">
      {/* Left Sidebar - Collapsible */}
      <aside 
        className="h-full bg-gray-50 border-r border-gray-200 transition-all duration-300 flex flex-col overflow-visible relative flex-shrink-0"
        style={{ width: isLeftCollapsed ? '63px' : '256px', minWidth: isLeftCollapsed ? '63px' : '256px' }}
      >
        {/* Header with collapse toggle */}
        <div className={`p-4 flex items-center ${isLeftCollapsed ? 'justify-center' : 'justify-between'}`}>
          {isLeftCollapsed ? (
            <button 
              onClick={() => setIsLeftCollapsed(false)} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex flex-col space-y-1.5">
                <div className="w-5 h-0.5 bg-gray-600"></div>
                <div className="w-5 h-0.5 bg-gray-600"></div>
                <div className="w-5 h-0.5 bg-gray-600"></div>
              </div>
            </button>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900">Menu</h2>
              <button 
                onClick={() => setIsLeftCollapsed(true)} 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
            </>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto overflow-x-visible p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Static Header - Training Programs */}
          {!isLeftCollapsed && (
            <div className="px-3 py-2.5 mb-2 rounded-lg" style={{ backgroundColor: `${brandTheme.colors.primary}10` }}>
              <div className="flex items-center space-x-3">
                <FontAwesomeIcon icon={faGraduationCap} style={{ color: brandTheme.colors.primary }} />
                <span className="text-sm font-semibold" style={{ color: brandTheme.colors.primary }}>Learning Programs</span>
              </div>
            </div>
          )}
          {isLeftCollapsed && (
            <div className="py-4 my-2 flex flex-col items-center" style={{ backgroundColor: `${brandTheme.colors.primary}10` }}>
              <FontAwesomeIcon icon={faGraduationCap} className="mb-3" style={{ color: brandTheme.colors.primary }} />
              <div 
                className="font-semibold text-sm tracking-wider"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', color: brandTheme.colors.primary }}
              >
                Training
              </div>
            </div>
          )}
          
          <div className="space-y-1">
            {menuItems.map((item) => {
              const isActive = activeMenuItem === item.id;
              
              return (
                <div key={item.id} className="relative mb-1">
                  <button
                    onClick={() => setActiveMenuItem(item.id)}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`w-full flex items-center ${isLeftCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-3 rounded-lg transition-all relative hover:bg-gray-100`}
                    style={isActive ? { backgroundColor: `${brandTheme.colors.primary}15` } : {}}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                        style={{ backgroundColor: brandTheme.colors.primary }}
                      />
                    )}
                    
                    {isLeftCollapsed ? (
                      <FontAwesomeIcon 
                        icon={item.icon} 
                        className="text-gray-600"
                        style={isActive ? { color: brandTheme.colors.primary } : {}}
                      />
                    ) : (
                      <>
                        <div className="flex items-center space-x-3 flex-1">
                          <FontAwesomeIcon 
                            icon={item.icon} 
                            className="text-gray-600"
                            style={isActive ? { color: brandTheme.colors.primary } : {}}
                          />
                          <span 
                            className={`text-sm ${isActive ? 'font-medium' : 'text-gray-900'}`}
                            style={isActive ? { color: brandTheme.colors.primary } : {}}
                          >
                            {item.name}
                          </span>
                        </div>
                      </>
                    )}
                  </button>
                  
                  {/* Tooltip on hover when collapsed */}
                  {isLeftCollapsed && hoveredItem === item.id && (
                    <div 
                      className="absolute left-full top-0 ml-2 bg-gray-900 text-white px-3 py-2.5 rounded-lg shadow-lg pointer-events-none min-w-[200px]"
                      style={{ zIndex: 1000 }}
                    >
                      <div className="font-semibold text-sm mb-0.5">{item.name}</div>
                      <div className="text-xs text-gray-300 opacity-90">{item.description}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tools Section - Show if college has ResumeBuilder, LogicBuilder, or CodingLab features */}
          {(collegeFeatures.includes('ResumeBuilder') || collegeFeatures.includes('LogicBuilder') || collegeFeatures.includes('CodingLab')) && (
            <>
              {/* Tools Header - Clickable to toggle */}
              {!isLeftCollapsed && (
                <div 
                  className="px-3 py-2.5 mt-4 mb-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity" 
                  style={{ backgroundColor: `${brandTheme.colors.primary}10` }}
                  onClick={() => setIsToolsCollapsed(!isToolsCollapsed)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FontAwesomeIcon icon={faWrench} style={{ color: brandTheme.colors.primary }} />
                      <span className="text-sm font-semibold" style={{ color: brandTheme.colors.primary }}>Tools</span>
                    </div>
                    <FontAwesomeIcon 
                      icon={faChevronDown} 
                      className={`w-3 h-3 transition-transform duration-300 ${isToolsCollapsed ? '-rotate-90' : ''}`}
                      style={{ color: brandTheme.colors.primary }} 
                    />
                  </div>
                </div>
              )}
              {isLeftCollapsed && (
                <div 
                  className="py-4 mt-4 mb-2 flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity" 
                  style={{ backgroundColor: `${brandTheme.colors.primary}10` }}
                  onClick={() => setIsToolsCollapsed(!isToolsCollapsed)}
                >
                  <FontAwesomeIcon icon={faWrench} className="mb-3" style={{ color: brandTheme.colors.primary }} />
                  <div 
                    className="font-semibold text-sm tracking-wider"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', color: brandTheme.colors.primary }}
                  >
                    Tools
                  </div>
                </div>
              )}

              {/* Tools Menu Items - Only show when not collapsed */}
              {!isToolsCollapsed && (
              <div className="space-y-1">
                {/* 24x7 AI Support */}
                <div className="relative mb-1">
                  <button
                    onClick={() => setShowAISupportFromSidebar(true)}
                    onMouseEnter={() => setHoveredItem('tool-aisupport')}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`w-full flex items-center ${isLeftCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-3 rounded-lg transition-all relative hover:bg-gray-100`}
                  >
                    {isLeftCollapsed ? (
                      <FontAwesomeIcon 
                        icon={faRobot} 
                        className="text-gray-600"
                      />
                    ) : (
                      <div className="flex items-center space-x-3 flex-1">
                        <FontAwesomeIcon 
                          icon={faRobot} 
                          className="text-gray-600"
                        />
                        <span className="text-sm text-gray-900">
                          AI Support
                        </span>
                      </div>
                    )}
                  </button>
                  {isLeftCollapsed && hoveredItem === 'tool-aisupport' && (
                    <div 
                      className="absolute left-full top-0 ml-2 bg-gray-900 text-white px-3 py-2.5 rounded-lg shadow-lg pointer-events-none min-w-[200px]"
                      style={{ zIndex: 1000 }}
                    >
                      <div className="font-semibold text-sm mb-0.5">24x7 AI Support</div>
                      <div className="text-xs text-gray-300 opacity-90">Get help with courses, study tips & career</div>
                    </div>
                  )}
                </div>

                {/* Coding Lab */}
                {collegeFeatures.includes('CodingLab') && (
                  <div className="relative mb-1">
                    <button
                      onClick={() => {
                        setActiveMenuItem('codinglab');
                        setIsLeftCollapsed(true);
                        if (onActiveMenuChange) onActiveMenuChange('codinglab');
                      }}
                      onMouseEnter={() => setHoveredItem('tool-codinglab')}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`w-full flex items-center ${isLeftCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-3 rounded-lg transition-all relative hover:bg-gray-100`}
                      style={activeMenuItem === 'codinglab' ? { backgroundColor: `${brandTheme.colors.primary}15` } : {}}
                    >
                      {activeMenuItem === 'codinglab' && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                          style={{ backgroundColor: brandTheme.colors.primary }}
                        />
                      )}
                      {isLeftCollapsed ? (
                        <FontAwesomeIcon 
                          icon={faCode} 
                          className="text-gray-600"
                          style={activeMenuItem === 'codinglab' ? { color: brandTheme.colors.primary } : {}}
                        />
                      ) : (
                        <div className="flex items-center space-x-3 flex-1">
                          <FontAwesomeIcon 
                            icon={faCode} 
                            className="text-gray-600"
                            style={activeMenuItem === 'codinglab' ? { color: brandTheme.colors.primary } : {}}
                          />
                          <span 
                            className={`text-sm ${activeMenuItem === 'codinglab' ? 'font-medium' : 'text-gray-900'}`}
                            style={activeMenuItem === 'codinglab' ? { color: brandTheme.colors.primary } : {}}
                          >
                            Coding Lab
                          </span>
                        </div>
                      )}
                    </button>
                    {isLeftCollapsed && hoveredItem === 'tool-codinglab' && (
                      <div 
                        className="absolute left-full top-0 ml-2 bg-gray-900 text-white px-3 py-2.5 rounded-lg shadow-lg pointer-events-none min-w-[200px]"
                        style={{ zIndex: 1000 }}
                      >
                        <div className="font-semibold text-sm mb-0.5">Coding Lab Problems</div>
                        <div className="text-xs text-gray-300 opacity-90">Practice coding problems</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Resume Builder */}
                {collegeFeatures.includes('ResumeBuilder') && (
                  <div className="relative mb-1">
                    <button
                      onClick={() => {
                        setActiveMenuItem('resumebuilder');
                        setIsLeftCollapsed(true);
                        if (onActiveMenuChange) onActiveMenuChange('resumebuilder');
                      }}
                      onMouseEnter={() => setHoveredItem('tool-resumebuilder')}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`w-full flex items-center ${isLeftCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-3 rounded-lg transition-all relative hover:bg-gray-100`}
                      style={activeMenuItem === 'resumebuilder' ? { backgroundColor: `${brandTheme.colors.primary}15` } : {}}
                    >
                      {activeMenuItem === 'resumebuilder' && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                          style={{ backgroundColor: brandTheme.colors.primary }}
                        />
                      )}
                      {isLeftCollapsed ? (
                        <FontAwesomeIcon 
                          icon={faAddressCard} 
                          className="text-gray-600"
                          style={activeMenuItem === 'resumebuilder' ? { color: brandTheme.colors.primary } : {}}
                        />
                      ) : (
                        <div className="flex items-center space-x-3 flex-1">
                          <FontAwesomeIcon 
                            icon={faAddressCard} 
                            className="text-gray-600"
                            style={activeMenuItem === 'resumebuilder' ? { color: brandTheme.colors.primary } : {}}
                          />
                          <span 
                            className={`text-sm ${activeMenuItem === 'resumebuilder' ? 'font-medium' : 'text-gray-900'}`}
                            style={activeMenuItem === 'resumebuilder' ? { color: brandTheme.colors.primary } : {}}
                          >
                            Resume Builder
                          </span>
                        </div>
                      )}
                    </button>
                    {isLeftCollapsed && hoveredItem === 'tool-resumebuilder' && (
                      <div 
                        className="absolute left-full top-0 ml-2 bg-gray-900 text-white px-3 py-2.5 rounded-lg shadow-lg pointer-events-none min-w-[200px]"
                        style={{ zIndex: 1000 }}
                      >
                        <div className="font-semibold text-sm mb-0.5">Resume Builder</div>
                        <div className="text-xs text-gray-300 opacity-90">Build your professional resume</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Logic Builder */}
                {collegeFeatures.includes('LogicBuilder') && (
                  <div className="relative mb-1">
                    <button
                      onClick={() => {
                        setActiveMenuItem('logicbuilder');
                        setIsLeftCollapsed(true);
                        if (onActiveMenuChange) onActiveMenuChange('logicbuilder');
                      }}
                      onMouseEnter={() => setHoveredItem('tool-logicbuilder')}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`w-full flex items-center ${isLeftCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-3 rounded-lg transition-all relative hover:bg-gray-100`}
                      style={activeMenuItem === 'logicbuilder' ? { backgroundColor: `${brandTheme.colors.primary}15` } : {}}
                    >
                      {activeMenuItem === 'logicbuilder' && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                          style={{ backgroundColor: brandTheme.colors.primary }}
                        />
                      )}
                      {isLeftCollapsed ? (
                        <FontAwesomeIcon 
                          icon={faBrain} 
                          className="text-gray-600"
                          style={activeMenuItem === 'logicbuilder' ? { color: brandTheme.colors.primary } : {}}
                        />
                      ) : (
                        <div className="flex items-center space-x-3 flex-1">
                          <FontAwesomeIcon 
                            icon={faBrain} 
                            className="text-gray-600"
                            style={activeMenuItem === 'logicbuilder' ? { color: brandTheme.colors.primary } : {}}
                          />
                          <span 
                            className={`text-sm ${activeMenuItem === 'logicbuilder' ? 'font-medium' : 'text-gray-900'}`}
                            style={activeMenuItem === 'logicbuilder' ? { color: brandTheme.colors.primary } : {}}
                          >
                            Logic Builder
                          </span>
                        </div>
                      )}
                    </button>
                    {isLeftCollapsed && hoveredItem === 'tool-logicbuilder' && (
                      <div 
                        className="absolute left-full top-0 ml-2 bg-gray-900 text-white px-3 py-2.5 rounded-lg shadow-lg pointer-events-none min-w-[200px]"
                        style={{ zIndex: 1000 }}
                      >
                        <div className="font-semibold text-sm mb-0.5">Logic Builder</div>
                        <div className="text-xs text-gray-300 opacity-90">Build and test logical flows</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </nav>

        {/* Sync Button - system_admin only */}
        {isSystemAdmin && (
          <div className="mt-auto p-3 border-t border-gray-200 flex-shrink-0 relative">
            {syncResult && !isLeftCollapsed && (
              <div className={`mb-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                syncResult.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {syncResult}
              </div>
            )}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              onMouseEnter={() => setHoveredItem('sync')}
              onMouseLeave={() => setHoveredItem(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all disabled:opacity-50 hover:bg-gray-100 ${
                isLeftCollapsed ? 'justify-center' : ''
              }`}
              title="Sync Student Learning Data"
            >
              <FontAwesomeIcon 
                icon={faRotateRight} 
                className={`text-gray-500 ${isSyncing ? 'animate-spin' : ''}`}
                style={isSyncing ? { color: brandTheme.colors.primary } : {}}
              />
              {!isLeftCollapsed && (
                <span className="text-sm text-gray-600">
                  {isSyncing ? 'Syncing...' : 'Sync Learning Data'}
                </span>
              )}
            </button>
            {isLeftCollapsed && hoveredItem === 'sync' && (
              <div 
                className="absolute left-full bottom-0 ml-2 bg-gray-900 text-white px-3 py-2.5 rounded-lg shadow-lg pointer-events-none min-w-[200px]"
                style={{ zIndex: 1000 }}
              >
                <div className="font-semibold text-sm mb-0.5">Sync Learning Data</div>
                <div className="text-xs text-gray-300 opacity-90">Recalculate all student progress</div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Middle Panel - Courses List (collapsible) */}
      {activeMenuItem === 'courses' && (
        isCoursesCollapsed ? (
          <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-4 flex items-center justify-center">
              <button 
                onClick={() => setIsCoursesCollapsed(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Expand"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="rotate-180" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center pt-4">
              <FontAwesomeIcon icon={faBookOpen} className="text-gray-600 mb-2" />
              <div className="text-gray-600 font-semibold text-sm tracking-wider"
                   style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                Courses
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="h-full overflow-hidden bg-white border-r border-gray-200 flex-shrink-0"
            style={{ minWidth: '600px', maxWidth: '600px', width: '600px' }}
          >
            <Courses
              brandTheme={brandTheme}
              onCourseSelect={(course) => {
                setSelectedCourse(course);
                // Only auto-collapse if screen width <= 1400px
                if (course && !isLeftCollapsed && window.innerWidth <= 1400) {
                  setIsLeftCollapsed(true);
                }
              }}
              selectedCourse={selectedCourse}
              onCollapse={() => setIsCoursesCollapsed(true)}
              currentUser={currentUser}
              selectedCollege={selectedCollege}
              onOpenCurriculum={(course) => {
                setSelectedCourse(course);
                openCurriculumPage();
              }}
              onCoursesLoaded={(courses) => {
                // Auto-select first course if none selected
                if (!selectedCourse && courses && courses.length > 0) {
                  setSelectedCourse(courses[0]);
                }
              }}
            />
          </div>
        )
      )}

      {/* Right Panel - Course Details (always shown when course is selected) */}
      {activeMenuItem === 'courses' && (
        selectedCourse ? (
          // Course Detail View
          <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Course Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              {/* Header */}
              <div className="relative px-6 py-6 border-b border-gray-100">
                {/* Back, Curriculum & Enroll Buttons - Top Right */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="h-10 px-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all flex items-center justify-center gap-2"
                    title="Back"
                  >
                    <span>←</span>
                    <span className="hidden 2xl:inline">Back</span>
                  </button>
                  <button
                    onClick={() => openCurriculumPage()}
                    className="h-10 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}
                    title="Curriculum"
                  >
                    <FontAwesomeIcon icon={faListCheck} className="text-sm" />
                    <span className="hidden 2xl:inline">Curriculum</span>
                  </button>
                  {!isStudent && (
                  <button
                    onClick={openEnrollModal}
                    className="h-10 px-4 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2"
                    style={{ background: brandTheme.gradients.primary }}
                    title="Enroll"
                  >
                    <span className="hidden 2xl:inline">Enroll Now</span>
                    <span className="2xl:hidden">Enroll</span>
                  </button>
                  )}
                </div>
                
                <div className="flex items-start gap-5">
                  {/* Course Thumbnail */}
                  <div 
                    className="w-24 h-24 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                  >
                    {selectedCourse.thumbnail ? (
                      <img src={selectedCourse.thumbnail} alt={selectedCourse.name} className="w-full h-full object-cover" />
                    ) : (
                      <FontAwesomeIcon icon={faBookOpen} className="text-3xl" style={{ color: brandTheme.colors.primary }} />
                    )}
                  </div>
                  
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}
                      >
                        {selectedCourse.category || 'General'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {selectedCourse.level || 'All Levels'}
                      </span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-1">{selectedCourse.name}</h1>
                    <p className="text-gray-500 text-sm mb-3">
                      Instructor: {selectedCourse.instructor || 'Not Assigned'}
                    </p>
                    
                    {/* Rating & Stats */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-base ${star <= Math.round(selectedCourse.rating || 0) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                        ))}
                        <span className="ml-1 text-sm text-gray-500">{selectedCourse.rating || 0}/5</span>
                        {selectedCourse.totalRatings ? (
                          <span className="text-sm text-gray-400 ml-1">({selectedCourse.totalRatings} reviews)</span>
                        ) : null}
                      </div>
                      <div className="text-sm text-gray-500">
                        <FontAwesomeIcon icon={faUsers} className="mr-1" />
                        {collegeEnrollmentCount} students
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Course Stats Bar */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{selectedCourse.lectures || 0}</div>
                  <div className="text-xs text-gray-500">Lectures</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{selectedCourse.duration || '0h'}</div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{selectedCourse.quizzes || 0}</div>
                  <div className="text-xs text-gray-500">Quizzes</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{selectedCourse.exercises || 0}</div>
                  <div className="text-xs text-gray-500">Exercises</div>
                </div>
              </div>
              
              {/* Course Info Collapsible Section */}
              <div className="border-t border-gray-100">
                {/* Collapsible Header */}
                <button
                  onClick={() => setIsCourseInfoExpanded(!isCourseInfoExpanded)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon 
                      icon={faFileLines} 
                      className="text-sm"
                      style={{ color: brandTheme.colors.primary }}
                    />
                    <span className="font-medium text-gray-700 text-sm">Course Details</span>
                    {selectedCourse.tagLine && (
                      <span className="text-xs text-gray-400 italic ml-2 hidden sm:inline">
                        "{selectedCourse.tagLine.substring(0, 50)}{selectedCourse.tagLine.length > 50 ? '...' : ''}"
                      </span>
                    )}
                  </div>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className={`text-gray-400 text-xs transition-transform duration-200 ${isCourseInfoExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                
                {/* Collapsible Content */}
                {isCourseInfoExpanded && (
                  <>
                    {/* Tagline - On grey background inside white card */}
                    <div className="px-6 pt-4">
                      {selectedCourse.tagLine && (
                        <div 
                          className="p-4 rounded-xl border-l-4 italic"
                          style={{ 
                            backgroundColor: `${brandTheme.colors.primary}10`,
                            borderLeftColor: brandTheme.colors.primary
                          }}
                        >
                          <p className="text-gray-700 text-sm font-medium">
                            "{selectedCourse.tagLine}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Course Info Cards */}
                    <div className="p-6 space-y-4">
                      {/* Description Card */}
                      <ExpandableCard
                        title="Course Description"
                        icon={faFileLines}
                        iconBgColor={`${brandTheme.colors.primary}15`}
                        iconColor={brandTheme.colors.primary}
                        cardBgColor={`${brandTheme.colors.primary}05`}
                        cardBorderColor={`${brandTheme.colors.primary}20`}
                        headerBorderColor={`${brandTheme.colors.primary}15`}
                        isLoading={isLoadingDetails}
                        content={courseDetails?.courseDescription || 'No description available for this course.'}
                        brandTheme={brandTheme}
                      />

                      {/* What You'll Learn Card */}
                      {courseDetails?.coursePurpose && (
                        <ExpandableCard
                          title="What You'll Learn"
                          icon={faGraduationCap}
                          iconBgColor="rgb(220 252 231)"
                          iconColor="rgb(22 163 74)"
                          cardBgColor="linear-gradient(to bottom right, rgb(240 253 244), rgb(236 253 245))"
                          cardBorderColor="rgb(209 250 229)"
                          headerBorderColor="rgb(209 250 229)"
                          content={courseDetails.coursePurpose}
                          brandTheme={brandTheme}
                          markerColor="rgb(34 197 94)"
                        />
                      )}

                      {/* Prerequisites Card */}
                      {courseDetails?.coursePrerequisite && (
                        <ExpandableCard
                          title="Prerequisites"
                          icon={faListCheck}
                          iconBgColor="rgb(254 243 199)"
                          iconColor="rgb(217 119 6)"
                          cardBgColor="linear-gradient(to bottom right, rgb(255 251 235), rgb(255 247 237))"
                          cardBorderColor="rgb(253 230 138)"
                          headerBorderColor="rgb(253 230 138)"
                          content={courseDetails.coursePrerequisite}
                          brandTheme={brandTheme}
                          markerColor="rgb(245 158 11)"
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* For Students: Show Curriculum | For Others: Show Enrolled Students */}
            {isStudent ? (
              /* Course Curriculum Section - For Students */
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Course Curriculum</h3>
                    <p className="text-sm text-gray-500">
                      {cachedCurriculum ? `${cachedCurriculum.length} units, ${cachedCurriculum.reduce((acc, unit) => acc + (unit.chapters?.length || 0), 0)} chapters` : 'Loading...'}
                    </p>
                  </div>
                </div>
                
                {/* Curriculum Content - Accordion Style */}
                <div className="max-h-[600px] overflow-y-auto p-4">
                  {isLoadingCachedCurriculum ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-10 h-10 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
                    </div>
                  ) : cachedCurriculum && cachedCurriculum.length > 0 ? (
                    <div className="space-y-3">
                      {cachedCurriculum.map((unit, unitIndex) => {
                        const isUnitExpanded = expandedCurriculumUnits.includes(unit.id);
                        return (
                          <div key={unit.id} className="border border-gray-200 rounded-xl overflow-hidden">
                            {/* Unit Header */}
                            <button
                              onClick={() => {
                                setExpandedCurriculumUnits(prev => 
                                  prev.includes(unit.id) 
                                    ? prev.filter(id => id !== unit.id)
                                    : [...prev, unit.id]
                                );
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                            >
                              <span 
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                style={{ background: brandTheme.gradients.primary }}
                              >
                                {unitIndex + 1}
                              </span>
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-gray-900">{unit.title}</div>
                                <div className="text-xs text-gray-500">{unit.chapters?.length || 0} chapters</div>
                              </div>
                              <FontAwesomeIcon 
                                icon={faChevronDown} 
                                className={`text-gray-400 transition-transform ${isUnitExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>
                            
                            {/* Unit Content - Chapters */}
                            {isUnitExpanded && unit.chapters && (
                              <div className="border-t border-gray-100 bg-gray-50/50">
                                {unit.chapters.map((chapter: any, chapterIndex: number) => {
                                  const chapterKey = `${unit.id}-${chapter.id}`;
                                  const isChapterExpanded = expandedCurriculumChapters.includes(chapterKey);
                                  return (
                                    <div key={chapter.id} className="border-b border-gray-100 last:border-b-0">
                                      {/* Chapter Header */}
                                      <button
                                        onClick={() => {
                                          setExpandedCurriculumChapters(prev => 
                                            prev.includes(chapterKey) 
                                              ? prev.filter(id => id !== chapterKey)
                                              : [...prev, chapterKey]
                                          );
                                        }}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors"
                                      >
                                        <span 
                                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
                                          style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}
                                        >
                                          {unitIndex + 1}.{chapterIndex + 1}
                                        </span>
                                        <div className="flex-1 text-left">
                                          <div className="font-medium text-gray-800 text-sm">{chapter.title}</div>
                                          <div className="text-xs text-gray-500">{chapter.lectures?.length || 0} items</div>
                                        </div>
                                        <FontAwesomeIcon 
                                          icon={faChevronDown} 
                                          className={`text-gray-400 text-sm transition-transform ${isChapterExpanded ? 'rotate-180' : ''}`}
                                        />
                                      </button>
                                      
                                      {/* Chapter Content - Lectures */}
                                      {isChapterExpanded && chapter.lectures && (
                                        <div className="bg-white">
                                          {chapter.lectures.map((lecture: any, _lectureIndex: number) => {
                                            const isVideo = lecture.type === 'video';
                                            const isQuiz = lecture.type === 'quiz' || lecture.type === 'mcq';
                                            const isExercise = lecture.type === 'exercise';
                                            
                                            return (
                                              <div 
                                                key={lecture.id}
                                                className="flex items-center gap-3 px-4 py-3 border-t border-dashed border-gray-200 hover:bg-purple-50 cursor-pointer transition-colors"
                                                onClick={() => openCurriculumPage(lecture.id)}
                                              >
                                                <div 
                                                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                    isQuiz ? 'bg-amber-100 text-amber-600' :
                                                    isExercise ? 'bg-emerald-100 text-emerald-600' :
                                                    ''
                                                  }`}
                                                  style={!isQuiz && !isExercise ? { backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary } : {}}
                                                >
                                                  <FontAwesomeIcon 
                                                    icon={
                                                      isVideo ? faPlay :
                                                      isQuiz ? faClipboardList :
                                                      isExercise ? faDumbbell :
                                                      faFileAlt
                                                    } 
                                                    className="text-xs"
                                                  />
                                                </div>
                                                <span className="flex-1 text-sm text-gray-700">{lecture.title}</span>
                                                {lecture.duration && (
                                                  <span 
                                                    className="px-2 py-1 rounded text-xs font-medium"
                                                    style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}
                                                  >
                                                    {lecture.duration}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <FontAwesomeIcon icon={faListCheck} className="text-4xl mb-3 text-gray-300" />
                      <p>No curriculum available</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Enrolled Students Section - For Non-Students */
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Enrolled Students</h3>
                    <p className="text-sm text-gray-500">{collegeEnrollmentCount} students enrolled in this course</p>
                  </div>
                  <button 
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ backgroundColor: `${brandTheme.colors.primary}10`, color: brandTheme.colors.primary }}
                  >
                    Export Report
                  </button>
                </div>
                
                {/* Students Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrolled Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Enrolled students data */}
                      {enrolledStudentsList.map((student, idx) => (
                        <tr 
                          key={idx} 
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setCurrentStudentIndex(idx);
                            setSelectedStudentForProgress(student);
                            setIsStudentProgressModalOpen(true);
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                style={{ background: brandTheme.gradients.primary }}
                              >
                                {student.avatar}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{student.name}</div>
                                <div className="text-xs font-medium" style={{ color: brandTheme.colors.primary }}>{student.className}</div>
                                <div className="text-xs text-gray-400">{student.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{student.enrolled}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden" style={{ maxWidth: '100px' }}>
                                <div 
                                  className="h-full rounded-full transition-all"
                                  style={{ 
                                    width: `${student.progress}%`, 
                                    background: student.progress === 100 ? '#10B981' : brandTheme.colors.primary 
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-700">{student.progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span 
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                student.status === 'Completed' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {student.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {student.score !== null ? (
                              <span className="font-semibold text-gray-900">{student.score}%</span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="text-sm text-gray-500">
                    Showing 1-{Math.min(6, collegeEnrollmentCount)} of {collegeEnrollmentCount} students
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                      Previous
                    </button>
                    <button 
                      className="w-8 h-8 rounded-lg text-sm font-medium text-white transition-all"
                      style={{ background: brandTheme.gradients.primary }}
                    >
                      1
                    </button>
                    <button className="w-8 h-8 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all">
                      2
                    </button>
                    <button className="w-8 h-8 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all">
                      3
                    </button>
                    <span className="text-gray-400">...</span>
                    <button className="w-8 h-8 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all">
                      76
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all">
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // No Course Selected - Show appropriate message
          <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faBooks} className="text-3xl text-purple-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Courses Available</h3>
              <p className="text-gray-500 max-w-sm">There are no courses assigned yet. Please contact your administrator to get enrolled in courses.</p>
            </div>
          </div>
        )
      )}

      {/* Middle Panel - Job Listing (collapsible) */}
      {activeMenuItem === 'jobs' && (
        isJobsCollapsed ? (
          <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-4 flex items-center justify-center">
              <button 
                onClick={() => setIsJobsCollapsed(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Expand"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="rotate-180" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center pt-4">
              <FontAwesomeIcon icon={faBriefcase} className="text-gray-600 mb-2" />
              <div className="text-gray-600 font-semibold text-sm tracking-wider"
                   style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                Jobs
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="h-full overflow-hidden bg-white border-r border-gray-200 flex-shrink-0"
            style={{ minWidth: '600px', maxWidth: '600px', width: '600px' }}
          >
            <JobListing
              brandTheme={brandTheme}
              onJobSelect={(job) => {
                setSelectedJob(job);
                if (job && !isLeftCollapsed && window.innerWidth <= 1400) {
                  setIsLeftCollapsed(true);
                }
              }}
              selectedJob={selectedJob}
              onCollapse={() => setIsJobsCollapsed(true)}
              currentUser={currentUser}
            />
          </div>
        )
      )}

      {/* Right Panel - Job Details */}
      {activeMenuItem === 'jobs' && (
        selectedJob ? (
          <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Job Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="relative px-6 py-6 border-b border-gray-100">
                {/* Back + Apply Buttons */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="h-10 px-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all flex items-center justify-center gap-2"
                  >
                    <span>←</span>
                    <span className="hidden 2xl:inline">Back</span>
                  </button>
                  {selectedJob.applyOptions?.[0]?.link && (() => {
                    const companyName = (selectedJob.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const directLink = selectedJob.applyOptions.find((opt: any) => {
                      const source = (opt.source || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                      const link = (opt.link || '').toLowerCase();
                      return (source && companyName && (source.includes(companyName) || companyName.includes(source))) ||
                        (link && !link.includes('indeed.') && !link.includes('linkedin.') && !link.includes('glassdoor.') &&
                         !link.includes('naukri.') && !link.includes('shine.') && !link.includes('simplyhired.') &&
                         !link.includes('talent.com') && !link.includes('bebee.') && !link.includes('jobrapido.') &&
                         !link.includes('whatjobs.') && !link.includes('jooble.') && !link.includes('adzuna.') &&
                         !link.includes('ziprecruiter.') && !link.includes('monster.') && !link.includes('internshala.') &&
                         !link.includes('foundit.') && !link.includes('apnajobs.') && !link.includes('freshersworld.') &&
                         !link.includes('pangian.') && !link.includes('freelancejobs.'));
                    });
                    const bestLink = directLink?.link || selectedJob.applyOptions[0].link;
                    return (
                      <a
                        href={bestLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 px-4 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        Apply Now
                      </a>
                    );
                  })()}
                </div>

                <div className="flex items-start gap-5">
                  {/* Company Logo/Initial */}
                  <div 
                    className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                  >
                    {selectedJob.thumbnail ? (
                      <img src={selectedJob.thumbnail} alt={selectedJob.company} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-3xl font-bold" style={{ color: brandTheme.colors.primary }}>
                        {selectedJob.company?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-32">
                    {/* Category + Schedule badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" 
                        style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}>
                        {selectedJob.category}
                      </span>
                      {selectedJob.scheduleType && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {selectedJob.scheduleType}
                        </span>
                      )}
                      {selectedJob.isRemote && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                          Remote
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl font-bold text-gray-900 mb-1">{selectedJob.title.replace(/\b\w/g, c => c.toUpperCase())}</h1>
                    <p className="text-sm text-gray-600 mb-1">{selectedJob.company}</p>
                    <p className="text-xs text-gray-400">{selectedJob.location}</p>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 divide-x divide-gray-100">
                <div className="px-4 py-4 text-center">
                  <div className="text-lg font-bold text-gray-900">{selectedJob.salary || 'N/A'}</div>
                  <div className="text-xs text-gray-500">Salary</div>
                </div>
                <div className="px-4 py-4 text-center">
                  <div className="text-lg font-bold text-gray-900">{selectedJob.scheduleType || 'N/A'}</div>
                  <div className="text-xs text-gray-500">Type</div>
                </div>
                <div className="px-4 py-4 text-center">
                  <div className="text-lg font-bold text-gray-900">{selectedJob.via?.replace('via ', '') || 'Direct'}</div>
                  <div className="text-xs text-gray-500">Source</div>
                </div>
                <div className="px-4 py-4 text-center">
                  <div className="text-lg font-bold text-gray-900">{(() => {
                    const ts = selectedJob.postedTimestamp || selectedJob.firstSeen;
                    if (!ts) return selectedJob.postedAt || 'Recent';
                    try {
                      const date = ts?.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
                      const diffMs = Date.now() - date.getTime();
                      const mins = Math.floor(diffMs / 60000);
                      if (mins < 1) return 'Just now';
                      if (mins < 60) return `${mins} min ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
                      const days = Math.floor(hrs / 24);
                      if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
                      return `${Math.floor(days / 30)} mo ago`;
                    } catch { return selectedJob.postedAt || 'Recent'; }
                  })()}</div>
                  <div className="text-xs text-gray-500">Posted</div>
                </div>
              </div>
            </div>

            {/* Job Description */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faFileLines} style={{ color: brandTheme.colors.primary }} />
                Job Description
              </h2>
              <div className="text-sm text-gray-700 leading-relaxed">
                {(() => {
                  const desc = selectedJob.description || 'No description available.';
                  // Split by newlines and process
                  const lines = desc.split('\n');
                  const elements: React.ReactNode[] = [];
                  let bulletBuffer: string[] = [];
                  
                  const flushBullets = () => {
                    if (bulletBuffer.length > 0) {
                      elements.push(
                        <ul key={`bullets-${elements.length}`} className="space-y-2 my-3 ml-1">
                          {bulletBuffer.map((item, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: brandTheme.colors.primary }}></span>
                              <span className="text-gray-600">{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                      bulletBuffer = [];
                    }
                  };
                  
                  lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                      flushBullets();
                      return;
                    }
                    
                    // Detect bullet points (•, -, *, ·)
                    const bulletMatch = trimmed.match(/^[•\-\*·]\s*(.*)/);
                    if (bulletMatch) {
                      bulletBuffer.push(bulletMatch[1]);
                      return;
                    }
                    
                    flushBullets();
                    
                    // Detect section headings (short lines ending with : or all bold-like text)
                    const isHeading = (
                      (trimmed.endsWith(':') && trimmed.length < 80) ||
                      (trimmed.length < 60 && !trimmed.includes('.') && idx > 0 && !lines[idx - 1]?.trim())
                    );
                    
                    if (isHeading) {
                      elements.push(
                        <h3 key={`heading-${idx}`} className="font-semibold text-gray-900 mt-5 mb-2 text-[13px] uppercase tracking-wide" style={{ color: brandTheme.colors.primary }}>
                          {trimmed}
                        </h3>
                      );
                    } else {
                      elements.push(
                        <p key={`para-${idx}`} className="text-gray-600 mb-2 leading-relaxed">
                          {trimmed}
                        </p>
                      );
                    }
                  });
                  
                  flushBullets();
                  return elements;
                })()}
              </div>
            </div>

            {/* Qualifications */}
            {selectedJob.qualifications && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faListCheck} style={{ color: brandTheme.colors.primary }} />
                  Qualifications
                </h2>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {(() => {
                    const qual = selectedJob.qualifications || '';
                    const lines = qual.split('\n');
                    const elements: React.ReactNode[] = [];
                    let bulletBuffer: string[] = [];
                    
                    const flushBullets = () => {
                      if (bulletBuffer.length > 0) {
                        elements.push(
                          <ul key={`qbullets-${elements.length}`} className="space-y-2 my-3 ml-1">
                            {bulletBuffer.map((item, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: brandTheme.colors.primary }}></span>
                                <span className="text-gray-600">{item}</span>
                              </li>
                            ))}
                          </ul>
                        );
                        bulletBuffer = [];
                      }
                    };
                    
                    lines.forEach((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) { flushBullets(); return; }
                      const bulletMatch = trimmed.match(/^[•\-\*·]\s*(.*)/);
                      if (bulletMatch) { bulletBuffer.push(bulletMatch[1]); return; }
                      flushBullets();
                      const isHeading = (trimmed.endsWith(':') && trimmed.length < 80) || (trimmed.length < 60 && !trimmed.includes('.') && idx > 0 && !lines[idx - 1]?.trim());
                      if (isHeading) {
                        elements.push(<h3 key={`qh-${idx}`} className="font-semibold text-gray-900 mt-5 mb-2 text-[13px] uppercase tracking-wide" style={{ color: brandTheme.colors.primary }}>{trimmed}</h3>);
                      } else {
                        elements.push(<p key={`qp-${idx}`} className="text-gray-600 mb-2 leading-relaxed">{trimmed}</p>);
                      }
                    });
                    flushBullets();
                    return elements;
                  })()}
                </div>
              </div>
            )}

            {/* Highlights */}
            {selectedJob.highlights && selectedJob.highlights.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faChartLine} style={{ color: brandTheme.colors.primary }} />
                  Highlights
                </h2>
                {selectedJob.highlights.map((highlight: any, idx: number) => (
                  <div key={idx} className="mb-4">
                    {highlight.title && (
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">{highlight.title}</h3>
                    )}
                    {highlight.items && (
                      <ul className="list-disc list-inside space-y-1">
                        {highlight.items.map((item: string, i: number) => (
                          <li key={i} className="text-sm text-gray-600">{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Apply Options */}
            {selectedJob.applyOptions && selectedJob.applyOptions.length > 0 && (() => {
              const companyName = (selectedJob.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const directOption = selectedJob.applyOptions.find((opt: any) => {
                const source = (opt.source || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const link = (opt.link || '').toLowerCase();
                // Match if source contains company name or vice versa
                return (source && companyName && (source.includes(companyName) || companyName.includes(source))) ||
                  // Or if the URL domain looks like a company career page (not a job board)
                  (link && !link.includes('indeed.') && !link.includes('linkedin.') && !link.includes('glassdoor.') && 
                   !link.includes('naukri.') && !link.includes('shine.') && !link.includes('simplyhired.') &&
                   !link.includes('talent.com') && !link.includes('bebee.') && !link.includes('jobrapido.') &&
                   !link.includes('whatjobs.') && !link.includes('jooble.') && !link.includes('adzuna.') &&
                   !link.includes('ziprecruiter.') && !link.includes('monster.') && !link.includes('internshala.') &&
                   !link.includes('foundit.') && !link.includes('apnajobs.') && !link.includes('freshersworld.') &&
                   !link.includes('pangian.') && !link.includes('freelancejobs.'));
              });
              const otherOptions = selectedJob.applyOptions.filter((opt: any) => opt !== directOption);

              return (
                <>
                  {/* Direct Company Apply Card */}
                  {directOption && (
                    <div className="rounded-2xl shadow-sm border-2 p-5 mb-4" style={{ borderColor: `${brandTheme.colors.primary}40`, background: `linear-gradient(135deg, ${brandTheme.colors.primary}08, ${brandTheme.colors.primary}03)` }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: brandTheme.gradients.primary }}>
                          <FontAwesomeIcon icon={faBriefcase} className="text-white text-xs" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-gray-900">Apply on Company Website</h2>
                          <p className="text-[11px] text-gray-500">Apply directly to {selectedJob.company}</p>
                        </div>
                      </div>
                      <a
                        href={directOption.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white border-2 hover:shadow-md transition-all group"
                        style={{ borderColor: `${brandTheme.colors.primary}30` }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = brandTheme.colors.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${brandTheme.colors.primary}30`; }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: brandTheme.gradients.primary }}>
                            {(directOption.source || selectedJob.company || 'C')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-gray-800">{directOption.source || selectedJob.company}</span>
                            <p className="text-[10px] text-gray-400 mt-0.5">Direct application • Recommended</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold px-5 py-2 rounded-full text-white shadow-sm"
                          style={{ background: brandTheme.gradients.primary }}>
                          Apply ↗
                        </span>
                      </a>
                    </div>
                  )}

                  {/* Other Sources Card */}
                  {otherOptions.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                      <h2 className="text-sm font-semibold text-gray-600 mb-3">{directOption ? 'Also Available On' : 'Apply Through'}</h2>
                      <div className="space-y-2">
                        {otherOptions.map((option: any, idx: number) => (
                          <a
                            key={idx}
                            href={option.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:shadow-sm transition-all group"
                            style={{ borderColor: `${brandTheme.colors.primary}20` }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${brandTheme.colors.primary}40`; e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}05`; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${brandTheme.colors.primary}20`; e.currentTarget.style.backgroundColor = ''; }}
                          >
                            <span className="text-sm font-medium text-gray-700">{option.source || `Source ${idx + 1}`}</span>
                            <span className="text-xs font-medium px-4 py-1.5 rounded-full text-white shadow-sm"
                              style={{ background: brandTheme.gradients.primary }}>
                              Apply
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="w-56 h-56 mx-auto mb-6">
                <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Ground shadow */}
                  <ellipse cx="120" cy="210" rx="85" ry="12" fill="#e5e7eb" opacity="0.5" />
                  
                  {/* Newspaper - JOBS */}
                  <g transform="translate(20, 70)">
                    <rect x="0" y="0" rx="3" width="90" height="110" fill="white" stroke="#d1d5db" strokeWidth="1" />
                    <rect x="6" y="8" rx="1" width="22" height="10" fill={brandTheme.colors.primary} />
                    <text x="8" y="16" fontSize="7" fontWeight="bold" fill="white">JOBS</text>
                    <rect x="32" y="8" rx="1" width="50" height="3" fill={`${brandTheme.colors.primary}40`} />
                    <rect x="32" y="14" rx="1" width="40" height="2" fill="#e5e7eb" />
                    {/* Column lines */}
                    <rect x="6" y="24" rx="1" width="36" height="20" fill="#f3f4f6" />
                    <rect x="46" y="24" rx="1" width="36" height="20" fill="#f3f4f6" />
                    <rect x="6" y="48" rx="1" width="76" height="2" fill="#e5e7eb" />
                    <rect x="6" y="54" rx="1" width="76" height="2" fill="#e5e7eb" />
                    <rect x="6" y="60" rx="1" width="60" height="2" fill="#e5e7eb" />
                    <rect x="6" y="70" rx="1" width="36" height="16" fill="#f3f4f6" />
                    <rect x="46" y="70" rx="1" width="36" height="16" fill="#f3f4f6" />
                    <rect x="6" y="92" rx="1" width="76" height="2" fill="#e5e7eb" />
                    <rect x="6" y="98" rx="1" width="50" height="2" fill="#e5e7eb" />
                  </g>
                  
                  {/* Tablet/Phone with job cards popping out */}
                  <g transform="translate(85, 45)">
                    {/* Device body */}
                    <rect x="0" y="20" rx="8" width="80" height="120" fill="#1f2937" />
                    <rect x="4" y="26" rx="4" width="72" height="105" fill="white" />
                    {/* Screen header bar */}
                    <rect x="4" y="26" rx="4" width="72" height="14" fill={brandTheme.colors.primary} />
                    <rect x="10" y="30" rx="1" width="30" height="3" fill="white" opacity="0.7" />
                    <circle cx="68" cy="33" r="3" fill="white" opacity="0.5" />
                    
                    {/* Job cards on screen */}
                    <rect x="8" y="44" rx="2" width="64" height="18" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.5" />
                    <rect x="12" y="48" rx="1" width="24" height="2.5" fill={`${brandTheme.colors.primary}60`} />
                    <rect x="12" y="53" rx="1" width="40" height="2" fill="#d1d5db" />
                    <circle cx="64" cy="53" r="4" fill="#FCD34D" />
                    <path d="M62.5 53L63.5 54L65.5 52" stroke="#92400E" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                    
                    <rect x="8" y="66" rx="2" width="64" height="18" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.5" />
                    <rect x="12" y="70" rx="1" width="30" height="2.5" fill={`${brandTheme.colors.primary}60`} />
                    <rect x="12" y="75" rx="1" width="36" height="2" fill="#d1d5db" />
                    <circle cx="64" cy="75" r="4" fill="#FCA5A5" />
                    
                    <rect x="8" y="88" rx="2" width="64" height="18" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.5" />
                    <rect x="12" y="92" rx="1" width="28" height="2.5" fill={`${brandTheme.colors.primary}60`} />
                    <rect x="12" y="97" rx="1" width="44" height="2" fill="#d1d5db" />
                    <circle cx="64" cy="97" r="4" fill="#86EFAC" />
                    <path d="M62.5 97L63.5 98L65.5 96" stroke="#166534" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                    
                    {/* Floating card popping out */}
                    <g transform="translate(-8, -10)">
                      <rect x="12" y="0" rx="4" width="72" height="28" fill="white" stroke={brandTheme.colors.primary} strokeWidth="1.5" filter="url(#cardShadow)" />
                      <rect x="18" y="6" rx="2" width="10" height="10" fill={`${brandTheme.colors.primary}20`} />
                      <rect x="20" y="9" rx="0.5" width="6" height="4" fill={brandTheme.colors.primary} opacity="0.5" />
                      <rect x="32" y="7" rx="1" width="28" height="3" fill={brandTheme.colors.primary} opacity="0.7" />
                      <rect x="32" y="13" rx="1" width="40" height="2" fill="#9ca3af" />
                      <rect x="32" y="18" rx="1" width="20" height="2" fill="#d1d5db" />
                      <rect x="62" y="17" rx="2" width="16" height="7" fill="#EF4444" />
                      <text x="65" y="22.5" fontSize="4.5" fontWeight="bold" fill="white">Apply</text>
                    </g>
                  </g>
                  
                  {/* Person standing */}
                  <g transform="translate(175, 95)">
                    {/* Head */}
                    <circle cx="12" cy="0" r="10" fill="#FBBF24" />
                    {/* Hair */}
                    <path d="M3 -2 Q3 -10 12 -11 Q21 -10 21 -2 Q18 -5 12 -5 Q6 -5 3 -2Z" fill="#1f2937" />
                    {/* Body - shirt */}
                    <path d="M2 10 Q2 14 4 20 L4 50 L20 50 L20 20 Q22 14 22 10 Q12 7 2 10Z" fill={brandTheme.colors.primary} opacity="0.8" />
                    {/* Collar */}
                    <path d="M8 10 L12 16 L16 10" fill="white" opacity="0.6" />
                    {/* Arm pointing at tablet */}
                    <path d="M2 18 Q-8 22 -18 28" stroke={brandTheme.colors.primary} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
                    {/* Hand */}
                    <circle cx="-18" cy="28" r="3" fill="#FBBF24" />
                    {/* Other arm */}
                    <path d="M22 18 Q26 28 24 38" stroke={brandTheme.colors.primary} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
                    {/* Pants */}
                    <rect x="4" y="50" rx="2" width="6" height="30" fill="#4B5563" />
                    <rect x="14" y="50" rx="2" width="6" height="30" fill="#374151" />
                    {/* Shoes */}
                    <rect x="2" y="78" rx="2" width="10" height="5" fill="#1f2937" />
                    <rect x="13" y="78" rx="2" width="10" height="5" fill="#1f2937" />
                  </g>
                  
                  {/* Magnifying glass */}
                  <g transform="translate(30, 175)">
                    <line x1="18" y1="18" x2="38" y2="38" stroke="#4B5563" strokeWidth="6" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="18" fill={`${brandTheme.colors.primary}15`} stroke={brandTheme.colors.primary} strokeWidth="3" />
                    <circle cx="12" cy="12" r="12" fill="white" opacity="0.6" />
                    <path d="M4 8 Q8 2 18 6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
                  </g>
                  
                  {/* Floating icons - money, people, briefcase */}
                  <g transform="translate(195, 50)">
                    <circle cx="0" cy="0" r="10" fill="#FCD34D" />
                    <text x="-3.5" y="4" fontSize="10" fontWeight="bold" fill="#92400E">$</text>
                  </g>
                  <g transform="translate(200, 75)">
                    <circle cx="0" cy="0" r="9" fill="#FCA5A5" />
                    <circle cx="0" cy="-2" r="3" fill="#991B1B" opacity="0.5" />
                    <path d="M-5 5 Q0 2 5 5" stroke="#991B1B" strokeWidth="1.2" fill="none" opacity="0.5" />
                  </g>
                  <g transform="translate(205, 102)">
                    <circle cx="0" cy="0" r="8" fill={`${brandTheme.colors.primary}30`} />
                    <rect x="-4" y="-3" rx="1" width="8" height="6" fill={brandTheme.colors.primary} opacity="0.5" />
                    <rect x="-2" y="-5" rx="0.5" width="4" height="2.5" fill="none" stroke={brandTheme.colors.primary} strokeWidth="0.8" opacity="0.5" />
                  </g>
                  
                  {/* Decorative plants */}
                  <g transform="translate(10, 190)" opacity="0.6">
                    <path d="M5 15 Q2 8 5 2 Q8 8 5 15Z" fill={brandTheme.colors.primary} opacity="0.4" />
                    <path d="M5 15 Q9 10 12 4 Q8 10 5 15Z" fill={brandTheme.colors.primary} opacity="0.3" />
                    <path d="M5 15 Q1 10 -2 5 Q2 10 5 15Z" fill={brandTheme.colors.primary} opacity="0.3" />
                  </g>
                  <g transform="translate(210, 195)" opacity="0.6">
                    <path d="M5 12 Q2 6 5 0 Q8 6 5 12Z" fill="#EF4444" opacity="0.3" />
                    <path d="M5 12 Q8 7 11 2 Q7 7 5 12Z" fill="#EF4444" opacity="0.25" />
                    <path d="M5 12 Q2 7 -1 3 Q3 7 5 12Z" fill="#EF4444" opacity="0.25" />
                  </g>
                  
                  {/* Shadow filter */}
                  <defs>
                    <filter id="cardShadow" x="-4" y="-4" width="108%" height="120%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                    </filter>
                  </defs>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Select a Job</h3>
              <p className="text-gray-500 max-w-sm">Choose a job from the list to view details, qualifications, and apply.</p>
            </div>
          </div>
        )
      )}

      {/* Study Progress Section - LearningHome */}
      {activeMenuItem === 'progress' && (
        <div className="flex-1 min-w-[500px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <LearningHome brandTheme={brandTheme} currentUser={currentUser} selectedCollege={selectedCollege} onViewAllCourses={() => setActiveMenuItem('courses')} onNavigate={(menuId) => { setActiveMenuItem(menuId); if (onActiveMenuChange) onActiveMenuChange(menuId); }} onOpenCourse={async (courseId, lectureId) => {
            try {
              const courses = await firebaseService.getCoursesByCourseId([parseInt(courseId, 10)]);
              if (courses && courses.length > 0) {
                const c = courses[0] as any;
                const courseObj = {
                  id: c.slug,
                  courseId: String(c.courseId),
                  name: c.courseName,
                  thumbnail: c.thumbnailUrl || '',
                  category: c.courseCategories?.[0] || '',
                  lectures: c.totalLectures || 0,
                  duration: '',
                  quizzes: 0,
                  exercises: 0,
                  progress: 0,
                  isEnrolled: true,
                };
                setSelectedCourse(courseObj as any);
                setPendingCourseOpen({ lectureId: lectureId || undefined, trigger: Date.now() });
              }
            } catch (err) {
              console.error('Failed to open course from LearningHome:', err);
            }
          }} />
        </div>
      )}

      {/* Users Section - Classes in Main, UserList in Aside */}
      {activeMenuItem === 'students' && (
        <>
          {/* Main Content - Classes */}
          <main 
            className="h-full overflow-y-auto transition-all duration-300 bg-white border-r border-gray-200 flex-shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ minWidth: '600px', maxWidth: '600px', width: '600px' }}
          >
            <Classes
              activeCollegeId={selectedCollege?.id ?? null}
              onClassSelect={(className) => {
                setSelectedClassForUsers(className);
              }}
              selectedClass={selectedClassForUsers}
              brandTheme={brandTheme as any}
              onCollapse={() => {}}
              refreshTrigger={usersRefreshTrigger}
            />
          </main>
          
          {/* Right Panel - UserList */}
          {selectedClassForUsers && (
            <aside 
              className="h-full bg-white border-l border-gray-200 transition-all duration-300 flex flex-col overflow-hidden relative"
              style={{ flex: 1, minWidth: '500px' }}
            >
              <UserList
                selectedClass={selectedClassForUsers}
                activeCollegeId={selectedCollege?.id ?? null}
                brandTheme={brandTheme}
                onClose={() => setSelectedClassForUsers(null)}
                currentUserRole={currentUser?.userType || 'student'}
                isSuperUser={currentUser ? firebaseService.isSystemAdmin(currentUser) : false}
                onCountsChange={async () => {
                  setUsersRefreshTrigger(prev => prev + 1);
                }}
              />
            </aside>
          )}
        </>
      )}

      {/* Coding Lab Section */}
      {activeMenuItem === 'codinglab' && (
        <div className="flex-1 min-w-[500px] overflow-hidden bg-gray-100">
          <CodingLab
            brandTheme={brandTheme}
            currentUser={currentUser}
            onClose={() => {
              setActiveMenuItem('courses');
              setIsLeftCollapsed(false);
              if (onActiveMenuChange) onActiveMenuChange('courses');
            }}
            problemSlug={selectedProblemSlug}
          />
        </div>
      )}

      {/* Resume Builder Section - Always mounted to preserve state */}
      <div 
        className="flex-1 min-w-[500px] overflow-hidden bg-gray-50" 
        style={{ 
          display: activeMenuItem === 'resumebuilder' ? 'flex' : 'none', 
          flexDirection: 'column' 
        }}
      >
        <ResumeBuilderApp
          isOpen={activeMenuItem === 'resumebuilder'}
          onClose={() => {
            setActiveMenuItem('courses');
            setIsLeftCollapsed(false);
            if (onActiveMenuChange) onActiveMenuChange('courses');
          }}
          currentUser={currentUser}
        />
      </div>

      {/* AI Interview Practice */}
      {activeMenuItem === 'interviews' && (
        <AIInterviewPractice
          brandTheme={brandTheme}
          currentUser={currentUser}
        />
      )}

      {/* Learning Paths */}
      {activeMenuItem === 'learningpaths' && (
        <LearningPaths
          brandTheme={brandTheme}
          currentUser={currentUser}
          selectedCollege={selectedCollege}
          availableCourses={[]}
          isCollapsed={isLearningPathsCollapsed}
          onCollapse={() => setIsLearningPathsCollapsed(true)}
          onExpand={() => setIsLearningPathsCollapsed(false)}
        />
      )}

      {/* Other menu items - placeholder */}
      {activeMenuItem !== 'courses' && activeMenuItem !== 'jobs' && activeMenuItem !== 'students' && activeMenuItem !== 'codinglab' && activeMenuItem !== 'resumebuilder' && activeMenuItem !== 'logicbuilder' && activeMenuItem !== 'progress' && activeMenuItem !== 'interviews' && activeMenuItem !== 'learningpaths' && (
        <div className="flex-1 min-w-[500px] overflow-y-auto bg-gray-50 p-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <FontAwesomeIcon 
              icon={menuItems.find(m => m.id === activeMenuItem)?.icon || faBookOpen} 
              className="text-4xl mb-4"
              style={{ color: brandTheme.colors.primary }}
            />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {menuItems.find(m => m.id === activeMenuItem)?.name}
            </h2>
            <p className="text-gray-500">This section is coming soon...</p>
          </div>
        </div>
      )}

      {/* Logic Builder */}
      {activeMenuItem === 'logicbuilder' && (
        <div className="flex-1 min-w-[500px] overflow-hidden bg-gray-100">
          <LogicBuilder />
        </div>
      )}

      {/* Enroll Modal - Slide from Right */}
      {isEnrollModalOpen && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] transition-opacity"
            onClick={() => setIsEnrollModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed top-4 bottom-4 right-4 w-[560px] bg-white shadow-2xl z-[10000] flex flex-col rounded-2xl animate-slide-in-right overflow-hidden">
            {/* Modal Header - Gradient with Course Name */}
            <div 
              className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
              style={{ background: brandTheme.gradients.primary }}
            >
              <div>
                <h3 className="font-bold text-white text-lg">{selectedCourse?.name}</h3>
                <p className="text-sm text-white/80">Instructor: {selectedCourse?.instructor || 'Not Assigned'}</p>
              </div>
              <button 
                onClick={() => setIsEnrollModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Search & Filters */}
            <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
              {/* Search Input, Class Filter, and End Date */}
              <div className="flex items-center gap-2">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.3-4.3"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={userSearchQuery}
                    onChange={(e) => { setUserSearchQuery(e.target.value); setEnrollCurrentPage(1); }}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 transition-all bg-white"
                  />
                </div>
                
                {/* Class Filter */}
                <select
                  value={selectedClassFilter}
                  onChange={(e) => { setSelectedClassFilter(e.target.value); setEnrollCurrentPage(1); }}
                  className="w-40 px-3 py-2 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 transition-all bg-white"
                >
                  <option value="administrators" className="font-medium">── Administrators ──</option>
                  <option value="all">All Students</option>
                  {enrollValidClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                
                {/* Custom End Date Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className={`w-40 px-3 py-2 h-10 rounded-lg border text-sm text-left transition-all bg-white flex items-center justify-between ${
                      isDatePickerOpen ? 'border-blue-400' : 'border-gray-200'
                    }`}
                  >
                    <span className={enrollmentEndDate ? 'text-gray-900' : 'text-gray-400'}>
                      {enrollmentEndDate 
                        ? new Date(enrollmentEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Expiry Date'
                      }
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </button>
                  
                  {/* Date Picker Dropdown */}
                  {isDatePickerOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-[10001]" 
                        onClick={() => setIsDatePickerOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-[10002] w-72">
                        {/* Header */}
                        <div className="text-center mb-3 pb-2 border-b border-gray-100">
                          <h4 className="text-sm font-semibold text-gray-900">Expiry Date</h4>
                          <p className="text-xs text-gray-400 mt-0.5">Select when enrollment expires</p>
                        </div>
                        
                        {/* Month/Year Navigation */}
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (datePickerMonth === 0) {
                                setDatePickerMonth(11);
                                setDatePickerYear(datePickerYear - 1);
                              } else {
                                setDatePickerMonth(datePickerMonth - 1);
                              }
                            }}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                          >
                            ‹
                          </button>
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(datePickerYear, datePickerMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (datePickerMonth === 11) {
                                setDatePickerMonth(0);
                                setDatePickerYear(datePickerYear + 1);
                              } else {
                                setDatePickerMonth(datePickerMonth + 1);
                              }
                            }}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
                          >
                            ›
                          </button>
                        </div>
                        
                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-1 mb-1">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar Days */}
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const firstDay = new Date(datePickerYear, datePickerMonth, 1).getDay();
                            const daysInMonth = new Date(datePickerYear, datePickerMonth + 1, 0).getDate();
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const days = [];
                            
                            // Empty cells for days before first of month
                            for (let i = 0; i < firstDay; i++) {
                              days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
                            }
                            
                            // Days of the month
                            for (let day = 1; day <= daysInMonth; day++) {
                              const date = new Date(datePickerYear, datePickerMonth, day);
                              const dateStr = date.toISOString().split('T')[0];
                              const isSelected = enrollmentEndDate === dateStr;
                              const isPast = date < today;
                              const isToday = date.getTime() === today.getTime();
                              
                              days.push(
                                <button
                                  key={day}
                                  type="button"
                                  disabled={isPast}
                                  onClick={() => {
                                    setEnrollmentEndDate(dateStr);
                                    setIsDatePickerOpen(false);
                                  }}
                                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                                    isSelected 
                                      ? 'text-white' 
                                      : isPast 
                                        ? 'text-gray-300 cursor-not-allowed' 
                                        : isToday
                                          ? 'text-blue-600 font-bold hover:bg-blue-50'
                                          : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                                  style={isSelected ? { background: brandTheme.gradients.primary } : {}}
                                >
                                  {day}
                                </button>
                              );
                            }
                            
                            return days;
                          })()}
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => {
                              setEnrollmentEndDate('');
                              setIsDatePickerOpen(false);
                            }}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const today = new Date();
                              setDatePickerMonth(today.getMonth());
                              setDatePickerYear(today.getFullYear());
                            }}
                            className="text-xs font-medium transition-colors"
                            style={{ color: brandTheme.colors.primary }}
                          >
                            Today
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <label className={`flex items-center gap-2 ${selectableUsers.length > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={currentSelectionCount === selectableUsers.length && selectableUsers.length > 0}
                    onChange={handleSelectAll}
                    disabled={selectableUsers.length === 0}
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ accentColor: brandTheme.colors.primary }}
                  />
                  <span className="text-sm text-gray-600">Select All</span>
                </label>
                <span className="text-sm text-gray-500">
                  {currentSelectionCount} selected
                  {filteredUsers.length > selectableUsers.length && (
                    <span className="text-green-600 ml-1">
                      ({filteredUsers.length - selectableUsers.length} already {isAdminMode ? 'assigned' : 'enrolled'})
                    </span>
                  )}
                </span>
              </div>
            </div>
            
            {/* Users List */}
            <div className="flex-1 overflow-y-auto px-5 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {isLoadingEnrollData ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div 
                    className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mb-3"
                    style={{ borderColor: brandTheme.colors.primary, borderTopColor: 'transparent' }}
                  />
                  <p className="text-sm text-gray-500">Loading {isAdminMode ? 'administrators' : 'students'}...</p>
                </div>
              ) : (
                <>
                  {paginatedUsers.map((user: any) => {
                    const isSelected = isAdminMode ? selectedAdmins.includes(user.id) : selectedUsers.includes(user.id);
                    const isAlreadyDone = isAdminMode ? user.isAssigned : user.isEnrolled;
                    
                    return (
                    <Fragment key={user.id}>
                    <div 
                      className={`${isAlreadyDone ? 'border border-green-200 rounded-lg my-2 overflow-hidden' : ''}`}
                    >
                    <div 
                      onClick={() => !isAlreadyDone && toggleUserSelection(user.id)}
                      className={`flex items-center gap-3 p-3 transition-all ${
                        isAlreadyDone 
                          ? 'bg-green-50/50 cursor-default' 
                          : isSelected 
                            ? 'bg-blue-50 cursor-pointer' 
                            : 'hover:bg-gray-50 cursor-pointer'
                      } ${!isAlreadyDone ? 'border-b border-gray-100' : ''}`}
                    >
                      {isAlreadyDone ? (
                        <div className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleUserSelection(user.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          style={{ accentColor: brandTheme.colors.primary }}
                        />
                      )}
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${isAlreadyDone ? 'opacity-60' : ''}`}
                        style={{ background: isAdminMode ? 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)' : brandTheme.gradients.primary }}
                      >
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${isAlreadyDone ? 'text-gray-500' : 'text-gray-900'}`}>
                          {user.name}
                        </div>
                        <div className={`text-xs font-medium ${isAlreadyDone ? 'text-gray-400' : ''}`} style={!isAlreadyDone ? { color: isAdminMode ? '#7C3AED' : brandTheme.colors.primary } : {}}>
                          {isAdminMode ? (
                            <span className="capitalize">{user.userType}</span>
                          ) : (
                            <>{user.className}{user.section ? ` - Section ${user.section}` : ''}</>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{user.email}</div>
                      </div>
                    </div>
                    
                    {/* Footer strip for enrolled/assigned users */}
                    {isAlreadyDone && (
                      <div 
                        className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            {isAdminMode ? 'Assigned' : 'Enrolled'}
                          </span>
                          {!isAdminMode && (
                          <span className={`text-xs flex items-center gap-1 ${user.expiryDate ? 'text-amber-600' : 'text-gray-400'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            {user.expiryDate 
                              ? `Expires: ${new Date(user.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                              : 'No expiry (Unlimited)'
                            }
                          </span>
                          )}
                        </div>
                        
                        {!isAdminMode && (
                        <>
                        {editingExpiryUserId === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editExpiryDate}
                              onChange={(e) => setEditExpiryDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              className="px-2 py-1 text-xs rounded-md border border-gray-300 focus:outline-none focus:border-blue-400 bg-white"
                            />
                            <button
                              onClick={() => handleUpdateExpiry(user.id, user.enrollmentId)}
                              disabled={isUpdatingExpiry}
                              className="px-3 py-1 text-xs font-semibold text-white rounded-md transition-all disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 active:scale-95"
                              style={{ background: brandTheme.gradients.primary }}
                            >
                              {isUpdatingExpiry ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                  Save
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => { setEditingExpiryUserId(null); setEditExpiryDate(''); }}
                              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingExpiryUserId(user.id);
                              setEditExpiryDate(user.expiryDate ? new Date(user.expiryDate).toISOString().split('T')[0] : '');
                            }}
                            className="text-xs font-medium text-blue-500 hover:text-blue-700 flex items-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                          </button>
                        )}
                        </>
                        )}
                      </div>
                    )}
                    </div>
                  </Fragment>
                  );
                  })}
                  
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No {isAdminMode ? 'administrators' : 'students'} found matching your filters.
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Pagination */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
              <div className="text-sm text-gray-500">
                Showing {filteredUsers.length > 0 ? (enrollCurrentPage - 1) * enrollUsersPerPage + 1 : 0}-{Math.min(enrollCurrentPage * enrollUsersPerPage, filteredUsers.length)} of {filteredUsers.length}
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setEnrollCurrentPage(p => Math.max(1, p - 1))}
                  disabled={enrollCurrentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-white text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                
                {/* Page 1 */}
                <button
                  onClick={() => setEnrollCurrentPage(1)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                    enrollCurrentPage === 1 ? 'text-white' : 'border border-gray-200 hover:bg-white text-gray-600'
                  }`}
                  style={enrollCurrentPage === 1 ? { background: brandTheme.gradients.primary } : {}}
                >
                  1
                </button>
                
                {/* Left ellipsis */}
                {totalEnrollPages > 4 && enrollCurrentPage > 3 && (
                  <span className="text-gray-400 text-xs px-1">...</span>
                )}
                
                {/* Middle pages */}
                {Array.from({ length: totalEnrollPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalEnrollPages <= 4) return page !== 1 && page !== totalEnrollPages;
                    if (enrollCurrentPage <= 3) return page > 1 && page <= 4 && page !== totalEnrollPages;
                    if (enrollCurrentPage >= totalEnrollPages - 2) return page >= totalEnrollPages - 3 && page !== 1 && page !== totalEnrollPages;
                    return page >= enrollCurrentPage - 1 && page <= enrollCurrentPage + 1 && page !== 1 && page !== totalEnrollPages;
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => setEnrollCurrentPage(page)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                        enrollCurrentPage === page ? 'text-white' : 'border border-gray-200 hover:bg-white text-gray-600'
                      }`}
                      style={enrollCurrentPage === page ? { background: brandTheme.gradients.primary } : {}}
                    >
                      {page}
                    </button>
                  ))
                }
                
                {/* Right ellipsis */}
                {totalEnrollPages > 4 && enrollCurrentPage < totalEnrollPages - 2 && (
                  <span className="text-gray-400 text-xs px-1">...</span>
                )}
                
                {/* Last page */}
                {totalEnrollPages > 1 && (
                  <button
                    onClick={() => setEnrollCurrentPage(totalEnrollPages)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                      enrollCurrentPage === totalEnrollPages ? 'text-white' : 'border border-gray-200 hover:bg-white text-gray-600'
                    }`}
                    style={enrollCurrentPage === totalEnrollPages ? { background: brandTheme.gradients.primary } : {}}
                  >
                    {totalEnrollPages}
                  </button>
                )}
                
                <button 
                  onClick={() => setEnrollCurrentPage(p => Math.min(totalEnrollPages, p + 1))}
                  disabled={enrollCurrentPage === totalEnrollPages || totalEnrollPages === 0}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-white text-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEnrollModalOpen(false)}
                  disabled={isEnrolling}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-white text-gray-600 transition-all disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  onClick={isAdminMode ? handleAssignToAdmins : handleEnrollUsers}
                  disabled={(isAdminMode ? selectedAdmins.length === 0 : selectedUsers.length === 0) || isEnrolling || isAssigningToAdmins}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{ background: isAdminMode ? 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)' : brandTheme.gradients.primary }}
                >
                  {isEnrolling || isAssigningToAdmins ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isAdminMode ? 'Assigning...' : 'Enrolling...'}
                    </>
                  ) : (
                    <>{isAdminMode ? `Assign (${selectedAdmins.length})` : `Enroll ${selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}`}</>
                  )}
                </button>
              </div>
            </div>
            
            {/* Enrollment Result Message */}
            {enrollmentResult && (
              <div 
                className={`mx-5 mb-4 px-4 py-3 rounded-xl flex items-center gap-3 ${
                  enrollmentResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  enrollmentResult.success ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {enrollmentResult.success ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  )}
                </div>
                <p className={`text-sm font-medium ${enrollmentResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {enrollmentResult.message}
                </p>
                <button 
                  onClick={() => setEnrollmentResult(null)}
                  className={`ml-auto p-1 rounded-lg hover:bg-white/50 transition-colors ${
                    enrollmentResult.success ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            )}
          </div>
          
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            .animate-slide-in-right {
              animation: slideInRight 0.5s ease-in-out forwards;
            }
          `}</style>
        </>,
        document.body
      )}


      {/* Student Progress Modal - Slide from Right */}
      {isStudentProgressModalOpen && selectedStudentForProgress && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] transition-opacity"
            onClick={() => setIsStudentProgressModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed top-4 bottom-4 right-4 w-[650px] bg-white shadow-2xl z-[10000] flex flex-col rounded-2xl animate-slide-in-right overflow-hidden">
            {/* Modal Header */}
            <div 
              className="px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
              style={{ background: brandTheme.gradients.primary }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                  {selectedStudentForProgress.avatar}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedStudentForProgress.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white/80">{selectedStudentForProgress.className} • {selectedStudentForProgress.email}</p>
                    <span className="text-white/50">•</span>
                    <button 
                      onClick={() => setIsStudentProfileModalOpen(true)}
                      className="text-sm text-white/80 hover:text-white underline underline-offset-2 transition-colors"
                    >
                      Check Profile
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsStudentProgressModalOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Course Info Banner */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{selectedCourse?.name}</span>
              </p>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              
              {/* Completion Status Card - Only for Completed Students */}
              {selectedStudentForProgress.status === 'Completed' && (
                <div 
                  className="rounded-2xl p-5 border"
                  style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Course Completed Successfully!</h4>
                      <p className="text-sm text-gray-600">Congratulations on completing this course</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-green-200">
                      <p className="text-xs font-medium text-green-600 mb-1">Final Score</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedStudentForProgress.score}%</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">A+</span>
                        <span className="text-xs text-green-600">Excellent</span>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-4 border border-green-200">
                      <p className="text-xs font-medium text-blue-600 mb-1">Certificate</p>
                      <p className="text-sm font-semibold text-gray-900">ID: {selectedStudentForProgress.certificateId}</p>
                      <button 
                        className="flex items-center gap-1 mt-2 text-xs font-medium"
                        style={{ color: brandTheme.colors.primary }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Certificate
                      </button>
                    </div>
                    
                    <div className="bg-white rounded-xl p-4 border border-green-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">Status</p>
                      <p className="text-sm text-gray-900">Completed: <span className="font-semibold">{selectedStudentForProgress.completedDate}</span></p>
                      {currentUser?.userType === 'student' && (
                        <button 
                          className="flex items-center gap-1 mt-2 text-xs font-medium"
                          style={{ color: brandTheme.colors.primary }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Restart Course
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* In Progress Status Card */}
              {selectedStudentForProgress.status === 'In Progress' && (
                <div 
                  className="rounded-2xl p-5 border"
                  style={{ backgroundColor: `${brandTheme.colors.primary}08`, borderColor: `${brandTheme.colors.primary}30` }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Course In Progress</h4>
                        <p className="text-sm text-gray-600">Keep up the great work!</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold" style={{ color: brandTheme.colors.primary }}>{selectedStudentForProgress.progress}%</p>
                      <p className="text-xs text-gray-500">Completed</p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ width: `${selectedStudentForProgress.progress}%`, background: brandTheme.gradients.primary }}
                    />
                  </div>
                </div>
              )}

              {/* Stats Cards Grid */}
              <div className="grid grid-cols-5 gap-3">
                {/* Total Marks */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                  <div 
                    className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: `${brandTheme.colors.primary}15` }}
                  >
                    <svg className="w-6 h-6" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium mb-1" style={{ color: brandTheme.colors.primary }}>Total Marks</p>
                  <p className="text-xl font-bold text-gray-900">{selectedStudentForProgress.totalMarks.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">/ {selectedStudentForProgress.maxMarks.toLocaleString()}</p>
                </div>

                {/* Exercise Marks */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-orange-100">
                    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-orange-500 mb-1">Exercise Marks</p>
                  <p className="text-xl font-bold text-gray-900">{selectedStudentForProgress.exerciseMarks.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">/ {selectedStudentForProgress.maxExerciseMarks.toLocaleString()}</p>
                </div>

                {/* Quiz Marks */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-green-100">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-green-500 mb-1">Quizzes Marks</p>
                  <p className="text-xl font-bold text-gray-900">{selectedStudentForProgress.quizMarks}</p>
                  <p className="text-xs text-gray-400">/ {selectedStudentForProgress.maxQuizMarks}</p>
                </div>

                {/* Lectures */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-blue-100">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-blue-500 mb-1">Lectures</p>
                  <p className="text-xl font-bold text-gray-900">{selectedStudentForProgress.lectures}</p>
                  <p className="text-xs text-gray-400">/ {selectedStudentForProgress.maxLectures}</p>
                </div>

                {/* Assessments */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-red-100">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-red-500 mb-1">Assessments</p>
                  <p className="text-xl font-bold text-gray-900">{selectedStudentForProgress.assessments.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">/ {selectedStudentForProgress.maxAssessments}</p>
                </div>
              </div>

              {/* Daily Learning Progress Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h4 className="font-bold text-gray-900 text-lg mb-4">Overall Daily Learning Progress</h4>
                
                {/* Simple Line Chart Visualization */}
                <div className="relative h-48">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-400">
                    <span>80</span>
                    <span>60</span>
                    <span>40</span>
                    <span>20</span>
                    <span>0</span>
                  </div>
                  
                  {/* Chart Area */}
                  <div className="ml-12 h-40 relative border-b border-l border-gray-200">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="border-t border-gray-100 w-full" />
                      ))}
                    </div>
                    
                    {/* SVG Line Chart */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke="#4ade80"
                        strokeWidth="2"
                        points="0,160 20,12 40,20 60,24 80,108 100,64 120,40 140,72 160,88 180,68 200,128 220,56 240,20 260,64 280,24 300,80 320,112 340,88 360,108 380,32 400,40 420,88 440,156"
                      />
                      {/* Data points */}
                      {[
                        [0, 160], [20, 12], [40, 20], [60, 24], [80, 108], [100, 64], [120, 40], [140, 72],
                        [160, 88], [180, 68], [200, 128], [220, 56], [240, 20], [260, 64], [280, 24], [300, 80],
                        [320, 112], [340, 88], [360, 108], [380, 32], [400, 40], [420, 88], [440, 156]
                      ].map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r="4" fill="#4ade80" />
                      ))}
                    </svg>
                  </div>
                  
                  {/* X-axis labels */}
                  <div className="ml-12 flex justify-between text-xs text-gray-400 mt-2">
                    <span>19-Jun</span>
                    <span>23-Jun</span>
                    <span>07-Jul</span>
                    <span>11-Jul</span>
                    <span>17-Jul</span>
                    <span>22-Jul</span>
                    <span>08-Jan</span>
                  </div>
                </div>
                
                <p className="text-center text-sm text-gray-500 mt-4">Total learning time across all courses (in minutes)</p>
              </div>

              {/* Time Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                {/* Course Duration */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                  >
                    <svg className="w-6 h-6" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Course Duration</p>
                    <p className="text-lg font-bold text-gray-900">50 Hrs</p>
                  </div>
                </div>

                {/* Total Learning */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-100">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Learning</p>
                    <p className="text-lg font-bold text-gray-900">20 Hrs</p>
                  </div>
                </div>

                {/* Average Learning */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100">
                    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Learning</p>
                    <p className="text-lg font-bold text-gray-900">2 Hrs/Day</p>
                  </div>
                </div>
              </div>

              {/* Feedback Section - For All Students */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h4 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2v-2zm1-10c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
                  </svg>
                  Student Feedback
                </h4>
                
                {selectedStudentForProgress.feedback ? (
                  <div className="space-y-3">
                    {/* Rating Stars */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg 
                            key={star} 
                            className={`w-5 h-5 ${star <= selectedStudentForProgress.feedback.rating ? 'text-yellow-400' : 'text-gray-300'}`} 
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{selectedStudentForProgress.feedback.rating}/5</span>
                    </div>
                    
                    {/* Feedback Comment */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-gray-700 text-sm italic">"{selectedStudentForProgress.feedback.comment}"</p>
                      <p className="text-xs text-gray-400 mt-2">Submitted on {selectedStudentForProgress.feedback.date}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 text-center">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-yellow-800">No feedback submitted yet</p>
                    <p className="text-xs text-yellow-600 mt-1">Student hasn't provided feedback for this course</p>
                  </div>
                )}
              </div>

              {/* Enrollment Info */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Enrolled on</p>
                    <p className="font-semibold text-gray-900">{selectedStudentForProgress.enrolled}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last Active</p>
                    <p className="font-semibold text-gray-900">Today, 2:30 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
              <span className="text-sm text-gray-600 font-medium">
                Showing {currentStudentIndex + 1} of {enrolledStudentsList.length}
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousStudent}
                  disabled={currentStudentIndex === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    currentStudentIndex === 0 
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100 bg-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                
                <button
                  onClick={goToNextStudent}
                  disabled={currentStudentIndex === enrolledStudentsList.length - 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    currentStudentIndex === enrolledStudentsList.length - 1 
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100 bg-white'
                  }`}
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            .animate-slide-in-right {
              animation: slideInRight 0.5s ease-in-out forwards;
            }
          `}</style>
        </>,
        document.body
      )}

      {/* Student Profile Modal - Shows all enrolled courses */}
      {isStudentProfileModalOpen && selectedStudentForProgress && createPortal(
        <>
          {/* Transparent overlay just for click handling - no darkening */}
          <div 
            className="fixed inset-0 z-[9999]"
            onClick={() => setIsStudentProfileModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed top-4 bottom-4 right-4 w-[650px] bg-white shadow-2xl z-[10000] flex flex-col rounded-2xl animate-slide-in-right overflow-hidden">
            {/* Modal Header */}
            <div 
              className="px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
              style={{ background: brandTheme.gradients.primary }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                  {selectedStudentForProgress.avatar}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedStudentForProgress.name}</h3>
                  <p className="text-sm text-white/80">{selectedStudentForProgress.className} | 2025-26 | {studentEnrollTotalCount} Enrollments</p>
                </div>
              </div>
              <button 
                onClick={() => setIsStudentProfileModalOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div ref={studentEnrollScrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              
              {/* ── Contact Info Card ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-gray-700">Student Info</h4>
                </div>
                <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Email</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{selectedStudentForProgress.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Phone</p>
                      <p className="text-sm font-medium text-gray-800">+91 9876543210</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Class</p>
                      <p className="text-sm font-medium text-gray-800">{selectedStudentForProgress.className}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Academic Year</p>
                      <p className="text-sm font-medium text-gray-800">2025-26</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Overview Stats (Assessments + Learning in one row) ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-gray-700">Overview</h4>
                </div>
                <div className="p-4 grid grid-cols-5 gap-3">
                  {/* Assessments Total */}
                  <div className="text-center p-3 rounded-xl bg-blue-50/60">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{studentEnrolledCourses.reduce((sum, c) => sum + (c.assessments || 0), 0)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Assessments</p>
                  </div>
                  {/* Assessments Done */}
                  <div className="text-center p-3 rounded-xl bg-green-50/60">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-1.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{studentEnrolledCourses.filter(c => c.status === 'completed').reduce((sum, c) => sum + (c.assessments || 0), 0)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Completed</p>
                  </div>
                  {/* Avg Marks */}
                  <div className="text-center p-3 rounded-xl bg-orange-50/60">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center mx-auto mb-1.5">
                      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {Math.round(studentEnrolledCourses.filter(c => c.marks).reduce((sum, c) => sum + (c.marks || 0), 0) / Math.max(studentEnrolledCourses.filter(c => c.marks).length, 1) * 10) / 10}%
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Avg. Marks</p>
                  </div>
                  {/* Learning Time */}
                  <div className="text-center p-3 rounded-xl" style={{ backgroundColor: `${brandTheme.colors.primary}08` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5" style={{ backgroundColor: `${brandTheme.colors.primary}15` }}>
                      <svg className="w-4 h-4" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-gray-900">38h</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Learning</p>
                  </div>
                  {/* Avg/Day */}
                  <div className="text-center p-3 rounded-xl bg-indigo-50/60">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center mx-auto mb-1.5">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-gray-900">2.5h</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Avg/Day</p>
                  </div>
                </div>
              </div>

              {/* ── Enrolled Courses Card ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <h4 className="text-sm font-semibold text-gray-700">Enrolled Courses</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${brandTheme.colors.primary}12`, color: brandTheme.colors.primary }}>
                      {studentEnrollTotalCount} Enrolled
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                      {studentEnrolledCourses.filter(c => c.status === 'completed').length} Done
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
              {studentEnrolledCourses.map((course) => (
                <div 
                  key={course.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all"
                >
                  {/* Course Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                      >
                        <svg className="w-6 h-6" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{course.name}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {course.lectures} Lectures
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {course.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {course.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                      ID: {course.id}
                    </span>
                  </div>

                  {/* Course Stats - 2 Column Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="text-xl font-mono" style={{ color: brandTheme.colors.primary }}>&lt;/&gt;</span>
                      <div>
                        <p className="text-xs text-gray-500">Exercises</p>
                        <p className="font-bold text-gray-900">{course.exercises}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Chapters</p>
                        <p className="font-bold text-gray-900">{(course as any).totalChapters || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Quizzes</p>
                        <p className="font-bold text-gray-900">{course.quizzes}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Assessments</p>
                        <p className="font-bold text-gray-900">{course.assessments}</p>
                      </div>
                    </div>
                  </div>

                  {/* Course Footer - Status and Assigned Date */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    {course.status === 'completed' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {course.marks}% Marks
                      </span>
                    ) : (
                      <span 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}
                      >
                        {course.progress}% Completed
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Assigned on: {course.assignedOn}
                    </span>
                  </div>
                </div>
              ))}

              {/* Loading State */}
              {isLoadingStudentEnrollments && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandTheme.colors.primary }}></div>
                  <span className="ml-3 text-sm text-gray-500">Loading enrollments...</span>
                </div>
              )}

              {/* No Enrollments State */}
              {!isLoadingStudentEnrollments && studentEnrolledCourses.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                    <span className="text-2xl">📚</span>
                  </div>
                  <p className="text-sm font-medium text-gray-500">No enrollments found</p>
                  <p className="text-xs text-gray-400 mt-0.5">This student has no active course enrollments</p>
                </div>
              )}

              {/* End of List for last page */}
              {!isLoadingStudentEnrollments && studentEnrolledCourses.length > 0 && studentEnrollCurrentPage === studentEnrollTotalPages && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-xs text-gray-400">No more enrollments to show</p>
                </div>
              )}
                </div>
              </div>
            </div>

            {/* Pagination Footer */}
            {!isLoadingStudentEnrollments && studentEnrollTotalPages > 1 && (
              <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  {/* Page Info */}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{((studentEnrollCurrentPage - 1) * studentEnrollPerPage) + 1}</span>
                    <span className="mx-1">-</span>
                    <span className="font-medium">{Math.min(studentEnrollCurrentPage * studentEnrollPerPage, studentEnrollTotalCount)}</span>
                    <span className="mx-1">of</span>
                    <span className="font-medium">{studentEnrollTotalCount}</span>
                    <span className="ml-1 text-gray-400">courses</span>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-2">
                    {/* First Page Button */}
                    <button
                      onClick={() => handleStudentEnrollPageChange(1)}
                      disabled={studentEnrollCurrentPage === 1}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                        studentEnrollCurrentPage === 1
                          ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }`}
                      title="First page"
                    >
                      <FontAwesomeIcon icon={faChevronsLeft} className="text-xs" />
                    </button>

                    {/* Previous Button */}
                    <button
                      onClick={() => handleStudentEnrollPageChange(studentEnrollCurrentPage - 1)}
                      disabled={studentEnrollCurrentPage === 1}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                        studentEnrollCurrentPage === 1
                          ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }`}
                      title="Previous page"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 mx-1">
                      {getStudentEnrollPageNumbers().map((page, index) => (
                        page === '...' ? (
                          <span key={`ellipsis-${index}`} className="px-1.5 text-gray-400 text-sm">...</span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => handleStudentEnrollPageChange(page as number)}
                            className={`min-w-[32px] h-8 rounded-xl text-sm font-semibold transition-all duration-200 ${
                              studentEnrollCurrentPage === page
                                ? 'text-white shadow-lg transform scale-105'
                                : 'text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                            style={studentEnrollCurrentPage === page ? { 
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
                      onClick={() => handleStudentEnrollPageChange(studentEnrollCurrentPage + 1)}
                      disabled={studentEnrollCurrentPage === studentEnrollTotalPages}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                        studentEnrollCurrentPage === studentEnrollTotalPages
                          ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }`}
                      title="Next page"
                    >
                      <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                    </button>

                    {/* Last Page Button */}
                    <button
                      onClick={() => handleStudentEnrollPageChange(studentEnrollTotalPages)}
                      disabled={studentEnrollCurrentPage === studentEnrollTotalPages}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                        studentEnrollCurrentPage === studentEnrollTotalPages
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

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end flex-shrink-0 bg-gray-50">
              <button
                onClick={() => setIsStudentProfileModalOpen(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: brandTheme.gradients.primary }}
              >
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* AI Support Assistant - Sidebar trigger */}
      <AISupportAssistant
        isOpen={showAISupportFromSidebar}
        onClose={() => setShowAISupportFromSidebar(false)}
        userName={currentUser?.displayName?.split(' ')[0] || ''}
      />
    </div>
  );
};

export default Learning;