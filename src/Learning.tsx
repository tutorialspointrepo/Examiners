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
  faUser,
  faRobot,
  faChevronLeft,
  faBookOpen,
  faBooks,
} from '@fortawesome/sharp-light-svg-icons';
import Courses from './Courses';
import LearningHome from './LearningHome';

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
  };
  currentUser: any;
}

const Learning: React.FC<LearningProps> = ({ onClose, brandTheme, currentUser }) => {
  const [activeMenuItem, setActiveMenuItem] = useState('courses');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isCoursesCollapsed, setIsCoursesCollapsed] = useState(false);

  // Menu items
  const menuItems = [
    { id: 'courses', name: 'Courses', icon: faBooks, description: 'Browse all available courses' },
    { id: 'students', name: 'My Students', icon: faUsers, description: 'View and manage students' },
    { id: 'progress', name: 'Study Progress', icon: faChartLine, description: 'Track learning progress' },
    { id: 'curriculum', name: 'Curriculum', icon: faListCheck, description: 'Course curriculum details' },
    { id: 'interviews', name: 'Interviews', icon: faComments, description: 'Interview preparation' },
    { id: 'marksheet', name: 'Marksheet', icon: faFileLines, description: 'View marksheets' },
    { id: 'jobs', name: 'Job Listing', icon: faBriefcase, description: 'Browse job opportunities' },
    { id: 'jdlearning', name: 'JD Based Learning', icon: faChartLine, description: 'Job description based learning' },
  ];

  // Bottom quick action icons
  const bottomIcons = [
    { id: 'code', icon: faCode, label: 'Coding Lab' },
    { id: 'profile', icon: faUser, label: 'Profile' },
    { id: 'ai', icon: faRobot, label: 'AI Assistant' },
  ];

  return (
    <div className="flex h-full w-full">
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
                className="w-10 h-10 rounded-xl bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                title={item.label}
              >
                <FontAwesomeIcon icon={item.icon} className="text-gray-600" />
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
            isMainCollapsed={isCoursesCollapsed}
            onCollapse={() => setIsCoursesCollapsed(true)}
            currentUser={currentUser}
          />
        )
      )}

      {/* Right Panel - Course Details or Home */}
      {activeMenuItem === 'courses' && (
        selectedCourse ? (
          // TODO: Course Detail Component
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCourse.name}</h2>
              <p className="text-gray-500">Course details will be shown here...</p>
              <button
                onClick={() => setSelectedCourse(null)}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: brandTheme.colors.primary, backgroundColor: `${brandTheme.colors.primary}10` }}
              >
                ← Back to Home
              </button>
            </div>
          </div>
        ) : (
          <LearningHome brandTheme={brandTheme} currentUser={currentUser} />
        )
      )}

      {/* Other menu items - placeholder */}
      {activeMenuItem !== 'courses' && (
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
    </div>
  );
};

export default Learning;