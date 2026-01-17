import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft,
  faChartBar,
  faFileChartColumn,
  faUserCheck,
  faShieldExclamation,
  faChartLine,
  faClock,
  faScaleBalanced,
  faBookOpen,
  faCalendarDays,
  faUsers,
  faTrophy,
  faGraduationCap,
  faChartPie,
  faFileExport
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';

// Report types
export const REPORT_TYPES = {
  EXAM_RESULTS: 'exam_results',
  ATTENDANCE: 'attendance',
  PERFORMANCE: 'performance',
  VIOLATIONS: 'violations',
  STUDENT_PROGRESS: 'student_progress',
  QUESTION_ANALYTICS: 'question_analytics',
  TIME_ANALYSIS: 'time_analysis',
  COMPARATIVE: 'comparative',
  LEADERBOARD: 'leaderboard',
  EXAM_SCHEDULE: 'exam_schedule',
  CLASS_PERFORMANCE: 'class_performance',
  SUBJECT_WISE: 'subject_wise'
} as const;

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];

// Report type labels
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  [REPORT_TYPES.EXAM_RESULTS]: 'Exam Results',
  [REPORT_TYPES.ATTENDANCE]: 'Attendance',
  [REPORT_TYPES.PERFORMANCE]: 'Performance Analytics',
  [REPORT_TYPES.VIOLATIONS]: 'Violation Summary',
  [REPORT_TYPES.STUDENT_PROGRESS]: 'Student Progress',
  [REPORT_TYPES.QUESTION_ANALYTICS]: 'Question Analytics',
  [REPORT_TYPES.TIME_ANALYSIS]: 'Time Analysis',
  [REPORT_TYPES.COMPARATIVE]: 'Comparative Analysis',
  [REPORT_TYPES.LEADERBOARD]: 'Leaderboard',
  [REPORT_TYPES.EXAM_SCHEDULE]: 'Exam Schedule',
  [REPORT_TYPES.CLASS_PERFORMANCE]: 'Class Performance',
  [REPORT_TYPES.SUBJECT_WISE]: 'Subject-wise Report'
};

interface Report {
  id: string;
  name: string;
  type: ReportType;
  description: string;
  collegeId: string;
  lastGenerated?: string;
  totalRecords?: number;
  status: 'available' | 'generating' | 'error';
}

interface ReportsProps {
  activeCollegeId: string | null;
  refreshTrigger?: number;
  onReportSelect: (report: Report | null) => void;
  selectedReport?: Report | null;
  onCollapse: () => void;
}

// Helper function to get icon for report type
const getReportTypeIcon = (type: ReportType) => {
  const iconMap: Record<ReportType, any> = {
    [REPORT_TYPES.EXAM_RESULTS]: faFileChartColumn,
    [REPORT_TYPES.ATTENDANCE]: faUserCheck,
    [REPORT_TYPES.PERFORMANCE]: faChartLine,
    [REPORT_TYPES.VIOLATIONS]: faShieldExclamation,
    [REPORT_TYPES.STUDENT_PROGRESS]: faGraduationCap,
    [REPORT_TYPES.QUESTION_ANALYTICS]: faBookOpen,
    [REPORT_TYPES.TIME_ANALYSIS]: faClock,
    [REPORT_TYPES.COMPARATIVE]: faScaleBalanced,
    [REPORT_TYPES.LEADERBOARD]: faTrophy,
    [REPORT_TYPES.EXAM_SCHEDULE]: faCalendarDays,
    [REPORT_TYPES.CLASS_PERFORMANCE]: faUsers,
    [REPORT_TYPES.SUBJECT_WISE]: faChartPie
  };
  return iconMap[type] || faChartBar;
};

export default function Reports({ 
  activeCollegeId, 
  onReportSelect, 
  selectedReport: externalSelectedReport, 
  onCollapse,
  refreshTrigger = 0
}: ReportsProps) {
  // Safe usage - catch error and use default if needed
  let brandTheme;
  try {
    brandTheme = useBrand();
  } catch (error) {
    brandTheme = {
      colors: {
        primary: '#4F46E5',
        secondary: '#7C3AED',
        accent: '#EC4899'
      },
      gradients: {
        primary: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        header: 'linear-gradient(to right, #4F46E5, #7C3AED)',
        card: 'linear-gradient(135deg, #4F46E510 0%, #7C3AED10 100%)',
        background: 'linear-gradient(to bottom right, #4F46E508, #7C3AED08, #EC489908)'
      },
      collegeName: 'EXAMINERS',
      collegeId: 'default'
    };
  }
  
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | ReportType>('all');
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);

  // Fetch reports
  useEffect(() => {
    const loadReports = async () => {
      console.log('📊 Loading reports for college:', activeCollegeId);
      
      if (!activeCollegeId) {
        console.log('⚠️ No college ID, clearing reports');
        setReports([]);
        setAllReports([]);
        setIsLoadingReports(false);
        return;
      }

      try {
        setIsLoadingReports(true);
        console.log('📊 Fetching reports data...');
        
        // TODO: Replace with actual Firebase call
        // For now, using mock data
        const mockReports: Report[] = [
          {
            id: 'R001',
            name: 'Final Exam Results - December 2024',
            type: REPORT_TYPES.EXAM_RESULTS,
            description: 'Comprehensive results analysis for all final exams conducted in December 2024',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-22',
            totalRecords: 245,
            status: 'available'
          },
          {
            id: 'R002',
            name: 'Monthly Attendance Report - December',
            type: REPORT_TYPES.ATTENDANCE,
            description: 'Student attendance summary for December 2024 across all classes',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-23',
            totalRecords: 1850,
            status: 'available'
          },
          {
            id: 'R003',
            name: 'Student Performance Analytics - Semester 1',
            type: REPORT_TYPES.PERFORMANCE,
            description: 'Detailed performance metrics and trends for Semester 1',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-20',
            totalRecords: 320,
            status: 'available'
          },
          {
            id: 'R004',
            name: 'Exam Violations Summary - Q4 2024',
            type: REPORT_TYPES.VIOLATIONS,
            description: 'Summary of all exam violations including fullscreen exits, tab switches, and window blur events',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-21',
            totalRecords: 156,
            status: 'available'
          },
          {
            id: 'R005',
            name: 'Top Performers Leaderboard - December',
            type: REPORT_TYPES.LEADERBOARD,
            description: 'Top 100 students ranked by overall performance in December exams',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-23',
            totalRecords: 100,
            status: 'available'
          },
          {
            id: 'R006',
            name: 'Question Bank Analytics',
            type: REPORT_TYPES.QUESTION_ANALYTICS,
            description: 'Analysis of question difficulty, usage frequency, and student success rates',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-19',
            totalRecords: 450,
            status: 'available'
          },
          {
            id: 'R007',
            name: 'Class-wise Performance Comparison',
            type: REPORT_TYPES.CLASS_PERFORMANCE,
            description: 'Comparative analysis of performance across different classes and sections',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-20',
            totalRecords: 15,
            status: 'available'
          },
          {
            id: 'R008',
            name: 'Subject-wise Performance Report',
            type: REPORT_TYPES.SUBJECT_WISE,
            description: 'Detailed breakdown of student performance in each subject',
            collegeId: activeCollegeId,
            lastGenerated: '2024-12-21',
            totalRecords: 8,
            status: 'available'
          }
        ];
        
        setAllReports(mockReports);
        
        // Apply filters
        let filteredReports = [...mockReports];
        
        // Filter by report type
        if (reportTypeFilter !== 'all') {
          filteredReports = filteredReports.filter(report => report.type === reportTypeFilter);
        }
        
        console.log('📊 Reports loaded:', {
          total: mockReports.length,
          filtered: filteredReports.length,
          filter: reportTypeFilter,
          firstReport: filteredReports[0]?.name
        });
        
        setReports(filteredReports);
      } catch (error) {
        console.error('Error loading reports:', error);
        setReports([]);
        setAllReports([]);
      } finally {
        setIsLoadingReports(false);
      }
    };

    loadReports();
  }, [activeCollegeId, reportTypeFilter, refreshTrigger]);

  // Auto-select first report when data loads
  useEffect(() => {
    console.log('📊 Reports auto-select check:', {
      hasExternalSelected: !!externalSelectedReport,
      reportsCount: reports.length,
      firstReport: reports[0]?.name
    });
    
    if (!externalSelectedReport && reports.length > 0) {
      console.log('✅ Auto-selecting first report:', reports[0].name);
      onReportSelect?.(reports[0]);
    } else if (reports.length === 0) {
      console.log('⚠️ No reports available, clearing selection');
      onReportSelect?.(null);
    } else {
      console.log('ℹ️ Report already selected:', externalSelectedReport?.name);
    }
  }, [reports, externalSelectedReport, onReportSelect]);

  // Calculate total reports for each filter type
  const totalReportsByType = {
    all: allReports.length,
    ...Object.values(REPORT_TYPES).reduce((acc, type) => ({
      ...acc,
      [type]: allReports.filter(r => r.type === type).length
    }), {} as Record<ReportType, number>)
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reports</h2>
            <p className="text-sm text-gray-600">{reports.length} available</p>
          </div>
          <button 
            onClick={onCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-gray-600" />
          </button>
        </div>

        {/* Report Type Filter Buttons */}
        <div className="bg-gray-50 px-6 py-4 flex border-b border-gray-200 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Sticky All Button */}
          <button 
            onClick={() => setReportTypeFilter('all')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
              reportTypeFilter === 'all' ? 'text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={reportTypeFilter === 'all' ? { 
              background: brandTheme.gradients.primary
            } : {}}
          >
            <FontAwesomeIcon icon={faChartBar} />
            <span>All Reports</span>
            <span className="ml-1 text-xs font-semibold">{totalReportsByType.all}</span>
          </button>
          
          {/* Scrollable Container for Other Filters */}
          <div className="flex space-x-2 overflow-x-auto ml-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {Object.values(REPORT_TYPES).map((reportType) => (
              totalReportsByType[reportType] > 0 && (
                <button 
                  key={reportType}
                  onClick={() => setReportTypeFilter(reportType)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                    reportTypeFilter === reportType ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={reportTypeFilter === reportType ? { 
                    backgroundColor: `${brandTheme.colors.primary}20`, 
                    color: brandTheme.colors.primary 
                  } : {}}
                >
                  <FontAwesomeIcon icon={getReportTypeIcon(reportType)} />
                  <span>{REPORT_TYPE_LABELS[reportType]}</span>
                  <span className="ml-1 text-xs font-semibold">{totalReportsByType[reportType]}</span>
                </button>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Report Cards */}
      <div 
        className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {isLoadingReports ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: brandTheme.colors.primary }}></div>
            <p className="mt-4 text-gray-600">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            {/* Beautiful SVG Illustration */}
            <div className="mb-8">
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background Circle */}
                <circle cx="100" cy="100" r="90" fill="#F3F4F6" opacity="0.5"/>
                
                {/* Document */}
                <rect x="60" y="40" width="80" height="110" rx="4" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="2"/>
                
                {/* Chart Bars */}
                <rect x="70" y="70" width="15" height="40" rx="2" fill={`${brandTheme.colors.primary}40`} stroke={brandTheme.colors.primary} strokeWidth="1"/>
                <rect x="92" y="60" width="15" height="50" rx="2" fill={`${brandTheme.colors.primary}60`} stroke={brandTheme.colors.primary} strokeWidth="1"/>
                <rect x="115" y="80" width="15" height="30" rx="2" fill={`${brandTheme.colors.primary}40`} stroke={brandTheme.colors.primary} strokeWidth="1"/>
                
                {/* Lines */}
                <line x1="70" y1="125" x2="125" y2="125" stroke="#D1D5DB" strokeWidth="2"/>
                <line x1="70" y1="135" x2="110" y2="135" stroke="#D1D5DB" strokeWidth="2"/>
                
                {/* Magnifying Glass */}
                <circle cx="140" cy="140" r="20" fill="none" stroke={brandTheme.colors.primary} strokeWidth="3"/>
                <circle cx="140" cy="140" r="12" fill={`${brandTheme.colors.primary}20`}/>
                <line x1="154" y1="154" x2="168" y2="168" stroke={brandTheme.colors.primary} strokeWidth="3" strokeLinecap="round"/>
                
                {/* Question Mark */}
                <text x="140" y="147" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="bold" fill={brandTheme.colors.primary} textAnchor="middle">?</text>
              </svg>
            </div>
            
            {/* Text Content */}
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No {reportTypeFilter === 'all' ? 'reports' : REPORT_TYPE_LABELS[reportTypeFilter as ReportType].toLowerCase()} found
            </h3>
            <p className="text-gray-500 text-center max-w-sm mb-6">
              {reportTypeFilter === 'all' 
                ? 'There are no reports available at the moment. Reports will appear here once generated.' 
                : `There are no ${REPORT_TYPE_LABELS[reportTypeFilter as ReportType].toLowerCase()} available. Try selecting a different report type.`
              }
            </p>
            
            {/* Action Hint */}
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <FontAwesomeIcon icon={faChartBar} />
              <span>Use the toggle above to switch between report types</span>
            </div>
          </div>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              onClick={() => onReportSelect?.(report)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                externalSelectedReport?.id === report.id
                  ? 'shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              style={externalSelectedReport?.id === report.id ? {
                borderColor: brandTheme.colors.primary,
                backgroundColor: `${brandTheme.colors.primary}05`
              } : {}}
            >
              {/* LINE 1: Icon + Report Name + Status Badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <FontAwesomeIcon 
                    icon={getReportTypeIcon(report.type)} 
                    className="text-2xl flex-shrink-0"
                    style={{ color: brandTheme.colors.primary }}
                  />
                  <h3 className="font-bold text-base text-gray-900 truncate">{report.name}</h3>
                </div>
                
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ml-2"
                  style={{
                    backgroundColor: report.status === 'available' 
                      ? '#D1FAE5' 
                      : report.status === 'generating'
                      ? '#FEF3C7'
                      : '#FEE2E2',
                    color: report.status === 'available' 
                      ? '#059669' 
                      : report.status === 'generating'
                      ? '#D97706'
                      : '#DC2626'
                  }}
                >
                  {report.status === 'available' ? 'Available' : report.status === 'generating' ? 'Generating' : 'Error'}
                </span>
              </div>
              
              {/* LINE 2: Report Type + Total Records */}
              <div className="flex items-center space-x-6 mb-2 text-gray-600">
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faChartBar} className="text-gray-400" />
                  <span className="text-sm">{REPORT_TYPE_LABELS[report.type]}</span>
                </div>
                
                {report.totalRecords && (
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faFileExport} className="text-gray-400" />
                    <span className="text-sm">{report.totalRecords} records</span>
                  </div>
                )}
              </div>
              
              {/* LINE 3: Description */}
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {report.description}
              </p>
              
              {/* LINE 4: Last Generated + View Button */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {report.lastGenerated && (
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <FontAwesomeIcon icon={faClock} />
                    <span>Last generated: {report.lastGenerated}</span>
                  </div>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReportSelect?.(report);
                  }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all hover:shadow-md"
                  style={{
                    background: brandTheme.gradients.primary,
                    color: 'white'
                  }}
                >
                  View Report
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}