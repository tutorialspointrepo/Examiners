import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faVideo,
  faClipboardList,
  faRobot,
  faFileAlt,
  faBookOpen,
  faChartLine,
  faTrophy,
  faUsers,
  faPlay,
  faArrowRight,
  faCode,
  faUser,
  faBrain,
} from '@fortawesome/sharp-light-svg-icons';

interface LearningHomeProps {
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
}

const LearningHome: React.FC<LearningHomeProps> = ({ brandTheme, currentUser, selectedCollege }) => {
  // Check if user is a student
  const isStudent = currentUser?.userType === 'student';

  // Stats for Students
  const studentStats = [
    { label: 'Courses Enrolled', value: '4', icon: faBookOpen, color: '#8B5CF6' },
    { label: 'Hours Learned', value: '28', icon: faVideo, color: '#3B82F6' },
    { label: 'Assessment Completed', value: '12', icon: faClipboardList, color: '#10B981' },
    { label: 'Achievements', value: '5', icon: faTrophy, color: '#F59E0B' },
  ];

  // Stats for Non-Students (Teachers/Admins)
  const adminStats = [
    { label: 'Total Students', value: '1,234', icon: faUsers, color: '#8B5CF6' },
    { label: 'Courses Completed', value: '856', icon: faGraduationCap, color: '#10B981' },
    { label: 'Avg Completion Rate', value: '72%', icon: faChartLine, color: '#3B82F6' },
    { label: 'Total Learning Hours', value: '4,520', icon: faVideo, color: '#F59E0B' },
  ];

  // Use appropriate stats based on user type
  const stats = isStudent ? studentStats : adminStats;

  // Featured courses
  const featuredCourses = [
    { name: 'JEE Advanced Prep', students: 1200, rating: 4.8 },
    { name: 'NEET Biology', students: 980, rating: 4.7 },
    { name: 'Data Structures', students: 750, rating: 4.9 },
  ];

  // Recent activity for students
  const recentActivity = [
    { course: 'Python Programming', action: 'Completed Quiz 5', time: '2 hours ago' },
    { course: 'Mathematics', action: 'Watched Lecture 12', time: '5 hours ago' },
    { course: 'Physics', action: 'Started new chapter', time: '1 day ago' },
  ];

  // Top performing students (for non-students view)
  const topStudents = [
    { name: 'Rahul Sharma', course: 'Python Programming', score: 98, avatar: 'RS' },
    { name: 'Priya Patel', course: 'Data Structures', score: 96, avatar: 'PP' },
    { name: 'Amit Kumar', course: 'Web Development', score: 94, avatar: 'AK' },
  ];

  // Recent student activity (for non-students view)
  const recentStudentActivity = [
    { student: 'Rahul Sharma', action: 'Completed Assessment', course: 'Python Programming', time: '1 hour ago' },
    { student: 'Priya Patel', action: 'Enrolled in course', course: 'Machine Learning', time: '3 hours ago' },
    { student: 'Amit Kumar', action: 'Submitted Assignment', course: 'Data Structures', time: '5 hours ago' },
  ];

  // Quick access items
  const quickAccessItems = [
    { id: 'ai', name: '24x7 AI Based Support', icon: faRobot },
    { id: 'coding', name: 'Online Coding Lab', icon: faCode },
    { id: 'resume', name: 'Resume Builder', icon: faUser },
    { id: 'logic', name: 'Logic Builder', icon: faBrain },
  ];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide bg-gray-50">
      {/* Banner */}
      <div className="relative mb-6 overflow-hidden rounded-2xl px-8 py-6 mt-5 mx-6" style={{ backgroundColor: '#eeeeee' }}>
        {/* Decorative elements */}
        <div className="absolute top-6 left-8 h-6 w-6 rotate-45 transform border-2 border-cyan-400 opacity-70 shadow-lg" />
        <div className="absolute top-16 left-14 h-3 w-3 rotate-45 transform bg-gradient-to-br from-pink-400 to-rose-500 opacity-60 shadow-md" />
        <div className="absolute top-4 right-24 h-8 w-8 rotate-12 transform border-2 border-yellow-400 opacity-50 shadow-lg" />

        <div className="relative z-10">
          {/* Top row - Robot icon, Title, Button */}
          <div className="mb-6 flex items-center justify-between">
            <div className="ml-12 flex flex-1 items-center gap-4">
              {/* Robot Icon */}
              <div className="flex-shrink-0">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-lg bg-blue-600 shadow-lg">
                  <div className="relative flex flex-col items-center">
                    {/* Antenna */}
                    <div className="mb-0.5 h-1.5 w-0.5" style={{ backgroundColor: '#ea580c' }}></div>
                    <div className="mb-0.5 h-1 w-1 rounded-full bg-yellow-400"></div>
                    {/* Head */}
                    <div className="relative mb-0.5 flex h-5 w-6 items-center justify-center rounded-sm" style={{ backgroundColor: '#f97316' }}>
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 rounded-sm bg-black"></div>
                        <div className="h-1.5 w-1.5 rounded-sm bg-black"></div>
                      </div>
                    </div>
                    {/* Neck */}
                    <div className="relative mb-0.5 h-4 w-5 rounded-sm" style={{ backgroundColor: '#f97316' }}>
                      <div className="absolute inset-x-1 top-1 h-1 w-3 rounded-sm" style={{ backgroundColor: '#ea580c' }}></div>
                    </div>
                    {/* Arms */}
                    <div className="absolute top-6 -left-1 h-3 w-1 rounded-sm" style={{ backgroundColor: '#ea580c' }}></div>
                    <div className="absolute top-6 -right-1 h-3 w-1 rounded-sm" style={{ backgroundColor: '#ea580c' }}></div>
                    {/* Body */}
                    <div className="h-3 w-4 rounded-sm bg-teal-500"></div>
                    {/* Feet */}
                    <div className="mt-0.5 flex gap-0.5">
                      <div className="h-1 w-1.5 rounded-sm bg-teal-600"></div>
                      <div className="h-1 w-1.5 rounded-sm bg-teal-600"></div>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 h-2 w-12 rounded-sm bg-blue-500 opacity-70"></div>
                </div>
              </div>
              
              {/* Title */}
              <div className="flex-1 text-gray-800 min-w-0">
                <h1 className="mb-2 font-bold text-2xl leading-tight">
                  <span 
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: brandTheme.gradients.primary }}
                  >{selectedCollege?.name || brandTheme.collegeName || 'Your Institution'}®</span>
                </h1>
                <p className="text-gray-600 text-lg">Your journey to a successful career starts here...</p>
              </div>
            </div>
            
            {/* Button */}
            <div className="flex-shrink-0 text-center ml-8">
              <button 
                className="transform whitespace-nowrap rounded-lg px-6 py-3 font-bold text-sm text-white shadow-lg transition-all duration-200 hover:shadow-xl"
                style={{ background: brandTheme.gradients.primary }}
              >
                HAPPY LEARNING
              </button>
              <p className="mt-2 text-gray-600 text-sm">Anytime, Anywhere</p>
            </div>
          </div>

          {/* Bottom row - Quick access */}
          <div>
            <h3 className="mb-4 font-medium text-base text-gray-800">Get instant access to</h3>
            <div className="flex flex-wrap lg:flex-nowrap gap-8">
              {quickAccessItems.map((item) => (
                <button
                  key={item.id}
                  className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-600 bg-opacity-80">
                    <FontAwesomeIcon icon={item.icon} className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium text-sm">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mx-6 mb-6 grid grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}15` }}
              >
                <FontAwesomeIcon icon={stat.icon} style={{ color: stat.color }} />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
            </div>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="mx-6 mb-6 grid grid-cols-2 gap-6">
        {/* Left Card - Continue Learning (Students) / Top Performing Students (Non-Students) */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              {isStudent ? 'Continue Learning' : 'Top Performing Students'}
            </h3>
            <button className="text-sm font-medium flex items-center space-x-1" style={{ color: brandTheme.colors.primary }}>
              <span>View All</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>
          </div>
          
          {isStudent ? (
            /* Student View - Continue Learning */
            <div className="space-y-4">
              {/* Course Progress Card */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}20 0%, ${brandTheme.colors.secondary}20 100%)` }}
                    >
                      <FontAwesomeIcon icon={faBookOpen} style={{ color: brandTheme.colors.primary }} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Python Programming</h4>
                      <p className="text-xs text-gray-500">Chapter 8: Functions</p>
                    </div>
                  </div>
                  <button 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    <FontAwesomeIcon icon={faPlay} />
                  </button>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-semibold" style={{ color: brandTheme.colors.primary }}>80%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="h-1.5 rounded-full"
                    style={{ width: '80%', background: brandTheme.gradients.primary }}
                  />
                </div>
              </div>

              {/* Another Course */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, #3B82F620 0%, #1D4ED820 100%)` }}
                    >
                      <FontAwesomeIcon icon={faChartLine} className="text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Mathematics</h4>
                      <p className="text-xs text-gray-500">Chapter 5: Calculus</p>
                    </div>
                  </div>
                  <button 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-blue-500"
                  >
                    <FontAwesomeIcon icon={faPlay} />
                  </button>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-semibold text-blue-500">65%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: '65%' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Non-Student View - Top Performing Students */
            <div className="space-y-4">
              {topStudents.map((student, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ background: brandTheme.gradients.primary }}
                  >
                    {student.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{student.name}</p>
                    <p className="text-xs text-gray-500 truncate">{student.course}</p>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <FontAwesomeIcon icon={faTrophy} className="text-yellow-500 text-xs" />
                    <span className="text-sm font-bold" style={{ color: brandTheme.colors.primary }}>{student.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Card - Recent Activity (Students) / Recent Student Activity (Non-Students) */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              {isStudent ? 'Recent Activity' : 'Recent Student Activity'}
            </h3>
            <button className="text-sm font-medium flex items-center space-x-1" style={{ color: brandTheme.colors.primary }}>
              <span>View All</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>
          </div>
          
          <div className="space-y-4">
            {isStudent ? (
              /* Student View */
              recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}15 0%, ${brandTheme.colors.secondary}15 100%)` }}
                  >
                    <FontAwesomeIcon icon={faBookOpen} style={{ color: brandTheme.colors.primary }} className="text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{activity.course}</p>
                    <p className="text-xs text-gray-500 truncate">{activity.action}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{activity.time}</span>
                </div>
              ))
            ) : (
              /* Non-Student View */
              recentStudentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}15 0%, ${brandTheme.colors.secondary}15 100%)` }}
                  >
                    <FontAwesomeIcon icon={faUsers} style={{ color: brandTheme.colors.primary }} className="text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{activity.student}</p>
                    <p className="text-xs text-gray-500 truncate">{activity.action} • {activity.course}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{activity.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Featured Courses */}
      <div className="mx-6 mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Featured Courses</h3>
          <button className="text-sm font-medium flex items-center space-x-1" style={{ color: brandTheme.colors.primary }}>
            <span>Browse All</span>
            <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {featuredCourses.map((course, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
              <div 
                className="w-full h-24 rounded-lg mb-3 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}20 0%, ${brandTheme.colors.secondary}30 100%)` }}
              >
                <FontAwesomeIcon icon={faGraduationCap} style={{ color: brandTheme.colors.primary }} className="text-3xl" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{course.name}</h4>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <FontAwesomeIcon icon={faUsers} />
                  <span>{course.students}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span>⭐</span>
                  <span>{course.rating}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LearningHome;