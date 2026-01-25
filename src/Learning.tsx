import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faUsers,
  faChartLine,
  faListCheck,
  faComments,
  faFileLines,
  faBriefcase,
  faCode,
  faRobot,
  faChevronLeft,
  faChevronDown,
  faBookOpen,
  faBooks,
  faCirclePlay,
  faFileText,
  faFilePdf,
  faDumbbell,
  faClipboardCheck,
  faLayerGroup,
  faBookBookmark,
  faBullseye,
  faAddressCard,
} from '@fortawesome/sharp-light-svg-icons';
import Courses from './Courses';
import LearningHome from './LearningHome';
import Classes from './Classes';
import UserList from './UserList';
import CodingLab from './CodingLab';
import ResumeBuilderApp from './ResumeBuilderApp';
import { firebaseService } from './services/firebase_service';

// Course interface
export interface Course {
  id: string;
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
  assessments?: number;
  students?: number;
  instructor?: string;
  level?: string;
  tags?: string[];
  rating?: number;
  createdAt?: string;
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
}

const Learning: React.FC<LearningProps> = ({ brandTheme, currentUser, selectedCollege, onActiveMenuChange, selectedProblemSlug }) => {
  const [activeMenuItem, setActiveMenuItem] = useState('courses');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isCoursesCollapsed, setIsCoursesCollapsed] = useState(false);
  
  // Users/Classes States
  const [selectedClassForUsers, setSelectedClassForUsers] = useState<string | null>(null);
  const [usersRefreshTrigger, setUsersRefreshTrigger] = useState(0);
  
  // Enroll Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isLoadingEnrollData, setIsLoadingEnrollData] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all');
  const [enrollCurrentPage, setEnrollCurrentPage] = useState(1);
  const enrollUsersPerPage = 5;
  
  // Curriculum Modal States
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false);
  const [curriculumData, setCurriculumData] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);

  // Student Progress Modal States
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<any | null>(null);
  const [isStudentProgressModalOpen, setIsStudentProgressModalOpen] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [isStudentProfileModalOpen, setIsStudentProfileModalOpen] = useState(false);

  // Sample enrolled courses for student profile
  const studentEnrolledCourses = [
    { id: 'CRS001', name: 'Data Structure and Algorithm in C++', lectures: 63, duration: '12h 55m', category: 'Coding', exercises: 275, notes: 63, quizzes: 570, assessments: 5, marks: 87, status: 'completed', assignedOn: 'Jan 10, 2025, 09:30 AM' },
    { id: 'CRS002', name: 'Advanced Java Programming', lectures: 45, duration: '10h 30m', category: 'Coding', exercises: 180, notes: 45, quizzes: 320, assessments: 4, progress: 65, status: 'in_progress', assignedOn: 'Jan 12, 2025, 02:15 PM' },
    { id: 'CRS003', name: 'Python for Data Science', lectures: 58, duration: '15h 20m', category: 'Data Science', exercises: 200, notes: 58, quizzes: 420, assessments: 6, progress: 30, status: 'in_progress', assignedOn: 'Jan 15, 2025, 11:00 AM' },
  ];

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

  // Fetch enrolled users when Enroll modal opens
  const openEnrollModal = async () => {
    setIsEnrollModalOpen(true);
    setIsLoadingEnrollData(true);
    setSelectedUsers([]);
    setUserSearchQuery('');
    setSelectedClassFilter('all');
    setSelectedSectionFilter('all');
    setEnrollCurrentPage(1);
    
    try {
      // TODO: Replace with actual API call
      // const users = await firebaseService.getAvailableUsersForCourse(selectedCollege?.id, selectedCourse?.id);
      
      // Simulating API call with sample data
      await new Promise(resolve => setTimeout(resolve, 800));
      const sampleUsers = [
        { id: '1', name: 'Rahul Sharma', email: 'rahul.s@email.com', className: 'Class 10', section: 'A', avatar: 'RS' },
        { id: '2', name: 'Priya Patel', email: 'priya.p@email.com', className: 'Class 10', section: 'B', avatar: 'PP' },
        { id: '3', name: 'Amit Kumar', email: 'amit.k@email.com', className: 'Class 9', section: 'A', avatar: 'AK' },
        { id: '4', name: 'Sneha Gupta', email: 'sneha.g@email.com', className: 'Class 10', section: 'A', avatar: 'SG' },
        { id: '5', name: 'Vikram Singh', email: 'vikram.s@email.com', className: 'Class 9', section: 'B', avatar: 'VS' },
        { id: '6', name: 'Ananya Reddy', email: 'ananya.r@email.com', className: 'Class 10', section: 'A', avatar: 'AR' },
        { id: '7', name: 'Karan Mehta', email: 'karan.m@email.com', className: 'Class 9', section: 'A', avatar: 'KM' },
        { id: '8', name: 'Neha Verma', email: 'neha.v@email.com', className: 'Class 10', section: 'B', avatar: 'NV' },
        { id: '9', name: 'Rohan Das', email: 'rohan.d@email.com', className: 'Class 9', section: 'B', avatar: 'RD' },
        { id: '10', name: 'Pooja Iyer', email: 'pooja.i@email.com', className: 'Class 10', section: 'A', avatar: 'PI' },
        { id: '11', name: 'Arjun Nair', email: 'arjun.n@email.com', className: 'Class 9', section: 'A', avatar: 'AN' },
        { id: '12', name: 'Meera Joshi', email: 'meera.j@email.com', className: 'Class 10', section: 'B', avatar: 'MJ' },
      ];
      setAvailableUsers(sampleUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setAvailableUsers([]);
    } finally {
      setIsLoadingEnrollData(false);
    }
  };

  // Fetch curriculum when Curriculum modal opens
  const openCurriculumModal = async () => {
    setIsCurriculumModalOpen(true);
    setIsLoadingCurriculum(true);
    setExpandedSections([]);
    setExpandedChapters([]);
    
    try {
      // TODO: Replace with actual API call
      // const curriculum = await firebaseService.getCourseCurriculum(selectedCourse?.id);
      
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
      // Expand all sections and chapters by default
      setExpandedSections(sampleCurriculum.map(section => section.id));
      setExpandedChapters(sampleCurriculum.flatMap(section => section.chapters.map(chapter => chapter.id)));
    } catch (error) {
      console.error('Error fetching curriculum:', error);
      setCurriculumData([]);
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => 
      prev.includes(chapterId) ? prev.filter(id => id !== chapterId) : [...prev, chapterId]
    );
  };

  const getItemIcon = (type: string) => {
    switch(type) {
      case 'video': return faCirclePlay;
      case 'text': return faFileText;
      case 'pdf': return faFilePdf;
      case 'exercise': return faDumbbell;
      case 'assessment': return faClipboardCheck;
      default: return faFileLines;
    }
  };

  const getItemColor = (type: string) => {
    switch(type) {
      case 'video': return '#8B5CF6';
      case 'text': return '#3B82F6';
      case 'pdf': return '#EF4444';
      case 'exercise': return '#10B981';
      case 'assessment': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  // Get unique classes and sections for filters
  const uniqueClasses = [...new Set(availableUsers.map(u => u.className))];

  const filteredUsers = availableUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesClass = selectedClassFilter === 'all' || user.className === selectedClassFilter;
    const matchesSection = selectedSectionFilter === 'all' || user.section === selectedSectionFilter;
    return matchesSearch && matchesClass && matchesSection;
  });

  // Pagination for enroll modal
  const totalEnrollPages = Math.ceil(filteredUsers.length / enrollUsersPerPage);
  const paginatedUsers = filteredUsers.slice(
    (enrollCurrentPage - 1) * enrollUsersPerPage,
    enrollCurrentPage * enrollUsersPerPage
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  // Menu items
  const menuItems = [
    { id: 'courses', name: 'Courses', icon: faBooks, description: 'Browse all available courses' },
    { id: 'students', name: 'Users', icon: faUsers, description: 'View and manage students' },
    { id: 'progress', name: 'Study Progress', icon: faChartLine, description: 'Track learning progress' },
    { id: 'curriculum', name: 'Curriculum', icon: faListCheck, description: 'Course curriculum details' },
    { id: 'interviews', name: 'Interviews', icon: faComments, description: 'Interview preparation' },
    { id: 'marksheet', name: 'Marksheet', icon: faFileLines, description: 'View marksheets' },
    { id: 'jobs', name: 'Job Listing', icon: faBriefcase, description: 'Browse job opportunities' },
    { id: 'jdlearning', name: 'JD Based Learning', icon: faChartLine, description: 'Job description based learning' },
    { id: 'resumebuilder', name: 'Resume Builder', icon: faAddressCard, description: 'Build your professional resume' },
  ];

  // Bottom quick action icons
  const bottomIcons = [
    { id: 'code', icon: faCode, label: 'Coding Lab' },
    { id: 'resumebuilder', icon: faAddressCard, label: 'Resume Builder' },
    { id: 'ai', icon: faRobot, label: 'AI Assistant' },
  ];

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden">
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
                <span className="text-sm font-semibold" style={{ color: brandTheme.colors.primary }}>Training Programs</span>
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
        </nav>

        {/* Bottom Icons */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center ${isLeftCollapsed ? 'flex-col space-y-3' : 'justify-center space-x-4'}`}>
            {bottomIcons.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'code') {
                    setActiveMenuItem('codinglab');
                    setIsLeftCollapsed(true);
                    if (onActiveMenuChange) onActiveMenuChange('codinglab');
                  } else if (item.id === 'resumebuilder') {
                    setActiveMenuItem('resumebuilder');
                    setIsLeftCollapsed(true);
                    if (onActiveMenuChange) onActiveMenuChange('resumebuilder');
                  }
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  (item.id === 'code' && activeMenuItem === 'codinglab') || (item.id === 'resumebuilder' && activeMenuItem === 'resumebuilder')
                    ? 'text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
                style={(item.id === 'code' && activeMenuItem === 'codinglab') || (item.id === 'resumebuilder' && activeMenuItem === 'resumebuilder') ? { background: brandTheme.gradients.primary } : {}}
                title={item.label}
              >
                <FontAwesomeIcon icon={item.icon} />
              </button>
            ))}
          </div>
        </div>
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
          <Courses
            brandTheme={brandTheme}
            onCourseSelect={setSelectedCourse}
            selectedCourse={selectedCourse}
            onCollapse={() => setIsCoursesCollapsed(true)}
            currentUser={currentUser}
          />
        )
      )}

      {/* Right Panel - Course Details or Home */}
      {activeMenuItem === 'courses' && (
        selectedCourse ? (
          // Course Detail View
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Course Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              {/* Header */}
              <div className="relative px-6 py-6 border-b border-gray-100">
                {/* Back, Curriculum & Enroll Buttons - Top Right */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all flex items-center gap-2"
                  >
                    <span>←</span> Back
                  </button>
                  <button
                    onClick={openCurriculumModal}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    style={{ backgroundColor: `${brandTheme.colors.primary}15`, color: brandTheme.colors.primary }}
                  >
                    <FontAwesomeIcon icon={faListCheck} className="text-xs" />
                    Curriculum
                  </button>
                  <button
                    onClick={openEnrollModal}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    Enroll Now
                  </button>
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
                      Instructor: {selectedCourse.instructor || 'Anadi Sharma'}
                    </p>
                    
                    {/* Rating & Stats */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-base ${star <= (selectedCourse.rating || 4) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                        ))}
                        <span className="ml-1 text-sm text-gray-500">{selectedCourse.rating || 4.5}/5</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <FontAwesomeIcon icon={faUsers} className="mr-1" />
                        {selectedCourse.students || 0} students
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
              
              {/* Course Description */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 text-lg mb-3">Course Description</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  This comprehensive course covers all the essential concepts and practical applications. 
                  Students will gain hands-on experience through interactive exercises, real-world projects, 
                  and assessments designed to reinforce learning outcomes. Perfect for beginners and intermediate 
                  learners looking to advance their skills.
                </p>
              </div>
            </div>
            
            {/* Enrolled Students Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">Enrolled Students</h3>
                  <p className="text-sm text-gray-500">{selectedCourse.students || 12} students enrolled in this course</p>
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
                  Showing 1-6 of {selectedCourse.students || 456} students
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
          </div>
        ) : (
          <LearningHome brandTheme={brandTheme} currentUser={currentUser} selectedCollege={selectedCollege} />
        )
      )}

      {/* Users Section - Classes in Main, UserList in Aside */}
      {activeMenuItem === 'students' && (
        <>
          {/* Main Content - Classes */}
          <main 
            className="h-full overflow-y-auto transition-all duration-300 bg-white border-r border-gray-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
              style={{ flex: 1, minWidth: 0 }}
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
        <div className="flex-1 overflow-hidden bg-gray-100">
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
        className="flex-1 overflow-hidden bg-gray-50" 
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

      {/* Other menu items - placeholder */}
      {activeMenuItem !== 'courses' && activeMenuItem !== 'students' && activeMenuItem !== 'codinglab' && activeMenuItem !== 'resumebuilder' && (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
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

      {/* Enroll Modal - Slide from Right */}
      {isEnrollModalOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsEnrollModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed inset-2 left-auto w-[560px] bg-white shadow-2xl z-50 flex flex-col rounded-2xl animate-slide-in-right overflow-hidden">
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
              {/* Search Input and Class Filter */}
              <div className="flex items-center gap-2">
                {/* Search Input */}
                <div className="w-1/2 relative">
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
                  className="w-1/2 px-3 py-2 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 transition-all bg-white"
                >
                  <option value="all">All Classes</option>
                  {uniqueClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ accentColor: brandTheme.colors.primary }}
                  />
                  <span className="text-sm text-gray-600">Select All</span>
                </label>
                <span className="text-sm text-gray-500">{selectedUsers.length} selected</span>
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
                  <p className="text-sm text-gray-500">Loading students...</p>
                </div>
              ) : (
                <>
                  {paginatedUsers.map((user) => (
                    <div 
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-all border-b border-gray-100 last:border-b-0 ${
                        selectedUsers.includes(user.id) 
                          ? 'bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 rounded border-gray-300"
                        style={{ accentColor: brandTheme.colors.primary }}
                      />
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs font-medium" style={{ color: brandTheme.colors.primary }}>{user.className} - Section {user.section}</div>
                        <div className="text-xs text-gray-400 truncate">{user.email}</div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No students found matching your filters.
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
                  className="px-4 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-white text-gray-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={selectedUsers.length === 0}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: brandTheme.gradients.primary }}
                >
                  Enroll {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
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
        </>
      )}

      {/* Curriculum Modal - Slide from Right */}
      {isCurriculumModalOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsCurriculumModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed inset-2 left-auto w-[600px] bg-white shadow-2xl z-50 flex flex-col rounded-2xl animate-slide-in-right overflow-hidden">
            {/* Modal Header - Gradient */}
            <div 
              className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
              style={{ background: brandTheme.gradients.primary }}
            >
              <div>
                <h3 className="font-bold text-white text-lg">{selectedCourse?.name}</h3>
                <p className="text-sm text-white/80">Course Curriculum</p>
              </div>
              <button 
                onClick={() => setIsCurriculumModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Curriculum Stats */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-6 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faLayerGroup} className="text-gray-500" />
                <span className="text-sm text-gray-600"><strong>{curriculumData.length}</strong> Sections</span>
              </div>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faBookBookmark} className="text-gray-500" />
                <span className="text-sm text-gray-600"><strong>{curriculumData.reduce((acc, sec) => acc + sec.chapters.length, 0)}</strong> Chapters</span>
              </div>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faBullseye} className="text-gray-500" />
                <span className="text-sm text-gray-600"><strong>{curriculumData.reduce((acc: number, sec: any) => acc + sec.chapters.reduce((a: number, ch: any) => a + ch.items.length, 0), 0)}</strong> Items</span>
              </div>
            </div>
            
            {/* Curriculum Content */}
            <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {isLoadingCurriculum ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div 
                    className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mb-3"
                    style={{ borderColor: brandTheme.colors.primary, borderTopColor: 'transparent' }}
                  />
                  <p className="text-sm text-gray-500">Loading curriculum...</p>
                </div>
              ) : curriculumData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FontAwesomeIcon icon={faListCheck} className="text-4xl text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">No curriculum available for this course.</p>
                </div>
              ) : (
                curriculumData.map((section, secIdx) => (
                  <div key={section.id} className="mb-3 border-b border-gray-100 pb-3 last:border-b-0">
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg transition-all hover:bg-gray-50"
                      style={{ backgroundColor: expandedSections.includes(section.id) ? `${brandTheme.colors.primary}10` : '' }}
                    >
                      <div 
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        {secIdx + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 text-sm">{section.title}</div>
                        <div className="text-xs text-gray-500">{section.chapters.length} chapters</div>
                      </div>
                      <FontAwesomeIcon 
                        icon={faChevronDown} 
                        className={`text-gray-400 text-xs transition-transform ${expandedSections.includes(section.id) ? 'rotate-180' : ''}`}
                      />
                    </button>
                    
                    {/* Chapters */}
                    {expandedSections.includes(section.id) && (
                      <div className="mt-1">
                        {section.chapters.map((chapter: any, chIdx: number) => (
                          <div key={chapter.id}>
                            {/* Chapter Header */}
                            <button
                              onClick={() => toggleChapter(chapter.id)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg transition-all hover:bg-gray-50"
                            >
                              <div 
                                className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold flex-shrink-0"
                                style={{ backgroundColor: `${brandTheme.colors.primary}20`, color: brandTheme.colors.primary }}
                              >
                                {secIdx + 1}.{chIdx + 1}
                              </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-gray-800 text-sm">{chapter.title}</div>
                              <div className="text-xs text-gray-400">{chapter.items.length} items</div>
                            </div>
                            <FontAwesomeIcon 
                              icon={faChevronDown} 
                              className={`text-gray-400 text-xs transition-transform ${expandedChapters.includes(chapter.id) ? 'rotate-180' : ''}`}
                            />
                          </button>
                          
                          {/* Items */}
                          {expandedChapters.includes(chapter.id) && (
                            <div className="mt-1 space-y-0.5">
                              {chapter.items.map((item: any) => (
                                <div 
                                  key={item.id}
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-all cursor-pointer group"
                                >
                                  <FontAwesomeIcon 
                                    icon={getItemIcon(item.type)} 
                                    className="w-4 flex-shrink-0"
                                    style={{ color: getItemColor(item.type) }}
                                  />
                                  <div className="flex-1 text-left">
                                    <div className="text-sm text-gray-700 group-hover:text-gray-900">{item.title}</div>
                                  </div>
                                  <div 
                                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: `${getItemColor(item.type)}15`, color: getItemColor(item.type) }}
                                  >
                                    {item.duration}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
              <div className="text-sm text-gray-500">
                Total Duration: <strong>2h 45m</strong>
              </div>
              <button
                onClick={() => setIsCurriculumModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: brandTheme.gradients.primary }}
              >
                Close
              </button>
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
        </>
      )}

      {/* Student Progress Modal - Slide from Right */}
      {isStudentProgressModalOpen && selectedStudentForProgress && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsStudentProgressModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed inset-2 left-auto w-[650px] bg-white shadow-2xl z-50 flex flex-col rounded-2xl animate-slide-in-right overflow-hidden">
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
        </>
      )}

      {/* Student Profile Modal - Shows all enrolled courses */}
      {isStudentProfileModalOpen && selectedStudentForProgress && (
        <>
          {/* Transparent overlay just for click handling - no darkening */}
          <div 
            className="fixed inset-0 z-[60]"
            onClick={() => setIsStudentProfileModalOpen(false)}
          />
          
          {/* Modal Panel */}
          <div className="fixed inset-2 left-auto w-[650px] bg-white shadow-2xl z-[70] flex flex-col rounded-2xl animate-slide-in-right overflow-hidden">
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
                  <p className="text-sm text-white/80">{selectedStudentForProgress.className} | 2025-26 | {studentEnrolledCourses.length} Enrollments</p>
                </div>
              </div>
              <button 
                onClick={() => setIsStudentProfileModalOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Scrollable Content - Course List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              
              {/* Contact Info Cards - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Email */}
                <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-[18px] h-[18px] text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{selectedStudentForProgress.email}</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-[18px] h-[18px] text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phone</p>
                    <p className="text-sm font-semibold text-gray-800">+91 9876543210</p>
                  </div>
                </div>

                {/* Class */}
                <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-[18px] h-[18px] text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Class</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedStudentForProgress.className}</p>
                  </div>
                </div>

                {/* Academic Year */}
                <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-[18px] h-[18px] text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Academic Year</p>
                    <p className="text-sm font-semibold text-gray-800">2025-26</p>
                  </div>
                </div>
              </div>

              {/* Assessment Stats - Section Header */}
              <div className="flex items-center gap-2 mt-4">
                <svg className="w-[18px] h-[18px]" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <h4 className="text-base font-bold text-gray-800">Assessments</h4>
              </div>

              {/* Assessment Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                {/* Total Assessments */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-xl font-bold text-gray-900">{studentEnrolledCourses.reduce((sum, c) => sum + (c.assessments || 0), 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Assessments Completed */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-100">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Completed</p>
                      <p className="text-xl font-bold text-gray-900">{studentEnrolledCourses.filter(c => c.status === 'completed').reduce((sum, c) => sum + (c.assessments || 0), 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Assessment Avg Marks */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg. %</p>
                      <p className="text-xl font-bold text-gray-900">
                        {Math.round(studentEnrolledCourses.filter(c => c.marks).reduce((sum, c) => sum + (c.marks || 0), 0) / Math.max(studentEnrolledCourses.filter(c => c.marks).length, 1) * 10) / 10}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Learning Stats - Section Header */}
              <div className="flex items-center gap-2 mt-4">
                <svg className="w-[18px] h-[18px]" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-base font-bold text-gray-800">Learning Activity</h4>
              </div>

              {/* Learning Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Total Learning Hours */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                    >
                      <svg className="w-5 h-5" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Learning</p>
                      <p className="text-xl font-bold text-gray-900">38 Hrs</p>
                    </div>
                  </div>
                </div>

                {/* Average Learning Per Day */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-100">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg/Day</p>
                      <p className="text-xl font-bold text-gray-900">2.5 Hrs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enrolled Courses Section Header */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <svg className="w-[18px] h-[18px]" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h4 className="text-base font-bold text-gray-800">Enrolled Courses</h4>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                  {studentEnrolledCourses.length} Courses
                </span>
              </div>

              {/* Course Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                {/* Courses Enrolled */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                    >
                      <svg className="w-5 h-5" style={{ color: brandTheme.colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Enrolled</p>
                      <p className="text-xl font-bold text-gray-900">{studentEnrolledCourses.length}</p>
                    </div>
                  </div>
                </div>

                {/* Courses Completed */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-100">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Completed</p>
                      <p className="text-xl font-bold text-gray-900">{studentEnrolledCourses.filter(c => c.status === 'completed').length}</p>
                    </div>
                  </div>
                </div>

                {/* Average Marks */}
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-100">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg. Marks</p>
                      <p className="text-xl font-bold text-gray-900">
                        {Math.round(studentEnrolledCourses.filter(c => c.marks).reduce((sum, c) => sum + (c.marks || 0), 0) / Math.max(studentEnrolledCourses.filter(c => c.marks).length, 1) * 10) / 10}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Cards */}
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
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="font-bold text-gray-900">{course.notes}</p>
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

              {/* End of List Indicator */}
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3 border-2 border-dashed border-gray-200">
                  <span className="text-3xl">📚</span>
                </div>
                <p className="font-semibold text-gray-700">That's everything!</p>
                <p className="text-sm text-gray-400">No more enrollments to show</p>
              </div>
            </div>

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
        </>
      )}
    </div>
  );
};

export default Learning;