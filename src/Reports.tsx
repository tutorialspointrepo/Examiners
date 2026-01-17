import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft,
  faChartBar,
  faFileChartColumn,
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
  faFileExport,
  faClipboardUser
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// Report Template Interface
export interface ReportTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  icon?: string;
  filters: any[];
  dataSource: {
    collection: string;
    fields: any[];
  };
  settings: {
    sortBy: string;
    sortOrder: string;
    groupBy?: string;
    format: string;
  };
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

interface ReportsProps {
  activeCollegeId: string | null;
  refreshTrigger?: number;
  onReportSelect: (report: ReportTemplate | null) => void;
  selectedReport?: ReportTemplate | null;
  onCollapse: () => void;
}

// Helper function to get icon for report type
const getReportTypeIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    'examResults': faFileChartColumn,
    'attendance': faClipboardUser,
    'performance': faChartLine,
    'violations': faShieldExclamation,
    'studentProgress': faGraduationCap,
    'questionAnalytics': faBookOpen,
    'timeAnalysis': faClock,
    'comparative': faScaleBalanced,
    'leaderboard': faTrophy,
    'examSchedule': faCalendarDays,
    'classPerformance': faUsers,
    'subjectWise': faChartPie
  };
  return iconMap[type] || faChartBar;
};

// Helper function to get readable label for report type
const getReportTypeLabel = (type: string): string => {
  const labelMap: Record<string, string> = {
    'examResults': 'Exam Results',
    'attendance': 'Attendance',
    'performance': 'Performance Analytics',
    'violations': 'Violation Summary',
    'studentProgress': 'Student Progress',
    'questionAnalytics': 'Question Analytics',
    'timeAnalysis': 'Time Analysis',
    'comparative': 'Comparative Analysis',
    'leaderboard': 'Leaderboard',
    'examSchedule': 'Exam Schedule',
    'classPerformance': 'Class Performance',
    'subjectWise': 'Subject-wise Report'
  };
  return labelMap[type] || type;
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
  
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | string>('all');
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reports, setReports] = useState<ReportTemplate[]>([]);
  const [allReports, setAllReports] = useState<ReportTemplate[]>([]);

  const db = getFirestore();

  // Fetch reports from Firebase
  useEffect(() => {
    const loadReports = async () => {
      console.log('📊 Loading report templates...');
      
      if (!activeCollegeId) {
        console.log('⚠️ No college ID, clearing reports');
        setReports([]);
        setAllReports([]);
        setIsLoadingReports(false);
        return;
      }

      try {
        setIsLoadingReports(true);
        console.log('📊 Fetching report templates from Firestore...');
        
        // Fetch all active report templates
        const templatesRef = collection(db, 'reportTemplates');
        const q = query(
          templatesRef,
          where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        console.log(`📊 Found ${snapshot.size} report templates`);
        
        const fetchedReports: ReportTemplate[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedReports.push({
            id: doc.id,
            name: data.name || 'Unnamed Report',
            type: data.type || 'general',
            category: data.category || 'general',
            description: data.description || 'No description available',
            icon: data.icon,
            filters: data.filters || [],
            dataSource: data.dataSource || { collection: 'examAttempts', fields: [] },
            settings: data.settings || { sortBy: 'id', sortOrder: 'asc', format: 'xlsx' },
            isActive: data.isActive !== false,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        });
        
        console.log('📊 Report templates loaded:', fetchedReports.map(r => r.name));
        
        setAllReports(fetchedReports);
        
        // Apply filters
        let filteredReports = [...fetchedReports];
        
        // Filter by report type
        if (reportTypeFilter !== 'all') {
          filteredReports = filteredReports.filter(report => report.type === reportTypeFilter);
        }
        
        console.log('📊 Filtered reports:', {
          total: fetchedReports.length,
          filtered: filteredReports.length,
          filter: reportTypeFilter
        });
        
        setReports(filteredReports);
      } catch (error) {
        console.error('❌ Error loading report templates:', error);
        setReports([]);
        setAllReports([]);
      } finally {
        setIsLoadingReports(false);
      }
    };

    loadReports();
  }, [activeCollegeId, reportTypeFilter, refreshTrigger, db]);

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
  const reportTypes = Array.from(new Set(allReports.map(r => r.type)));
  const totalReportsByType: Record<string, number> = {
    all: allReports.length,
    ...reportTypes.reduce((acc, type) => ({
      ...acc,
      [type]: allReports.filter(r => r.type === type).length
    }), {} as Record<string, number>)
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
          {/* All Reports Button */}
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
            {reportTypes.map((reportType) => (
              totalReportsByType[reportType] > 0 && (
                <button 
                  key={reportType}
                  onClick={() => setReportTypeFilter(reportType)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 whitespace-nowrap ${
                    reportTypeFilter === reportType ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={reportTypeFilter === reportType ? { 
                    backgroundColor: `${brandTheme.colors.primary}20`, 
                    color: brandTheme.colors.primary 
                  } : {}}
                >
                  <FontAwesomeIcon icon={getReportTypeIcon(reportType)} />
                  <span>{getReportTypeLabel(reportType)}</span>
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
              No {reportTypeFilter === 'all' ? 'report templates' : getReportTypeLabel(reportTypeFilter as string).toLowerCase()} found
            </h3>
            <p className="text-gray-500 text-center max-w-sm mb-6">
              {reportTypeFilter === 'all' 
                ? 'There are no report templates available. Please set up report templates using the setup script.' 
                : `There are no ${getReportTypeLabel(reportTypeFilter as string).toLowerCase()} templates available. Try selecting a different report type.`
              }
            </p>
            
            {/* Action Hint */}
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <FontAwesomeIcon icon={faChartBar} />
              <span>Run: node setup_all_reports.js to create templates</span>
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
              {/* LINE 1: Icon + Report Name */}
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
                    backgroundColor: '#D1FAE5',
                    color: '#059669'
                  }}
                >
                  Active
                </span>
              </div>
              
              {/* LINE 2: Report Type + Fields Count + Filters Count */}
              <div className="flex items-center space-x-6 mb-2 text-gray-600">
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faChartBar} className="text-gray-400" />
                  <span className="text-sm">{getReportTypeLabel(report.type)}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faFileExport} className="text-gray-400" />
                  <span className="text-sm">{report.dataSource?.fields?.length || 0} fields</span>
                </div>

                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faChartLine} className="text-gray-400" />
                  <span className="text-sm">{report.filters?.length || 0} filters</span>
                </div>
              </div>
              
              {/* LINE 3: Description */}
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {report.description}
              </p>
              
              {/* LINE 4: View Button */}
              <div className="flex items-center justify-end pt-2 border-t border-gray-100">
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