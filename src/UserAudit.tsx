import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser, 
  faUsers,
  faEnvelope, 
  faShield,
  faCalendar,
  faClock,
  faGlobe,
  faMapMarkerAlt,
  faDesktop,
  faEye,
  faMousePointer,
  faDownload,
  faSearch,
  faFileExport,
  faPlus,
  faPenToSquare,
  faTrash,
  faArrowUpFromBracket,
  faClipboardList,
  faGraduationCap,
  faChartBar,
  faLock,
  faKey,
  faClipboardCheck,
  faChartLine,
  faMobile,
  faFilter,
  faMagnifyingGlass
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { useBrand } from './BrandContext';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  section: string;
  entityType?: string;
  details: string;
  timestamp: any;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  deviceType?: string;
}

interface UserAuditProps {
  user: any;
  onBack: () => void;
}

// Action type to human-readable label mapping
const ACTION_LABELS: Record<string, string> = {
  // Exam Operations
  create_exam: 'Exam Created',
  update_exam: 'Exam Updated',
  delete_exam: 'Exam Deleted',
  
  // User Operations
  create_user: 'User Created',
  update_user: 'User Updated',
  bulk_upload_users: 'Users Bulk Uploaded',
  
  // Question Operations
  create_question: 'Question Created',
  bulk_upload_questions: 'Questions Bulk Uploaded',
  
  // Room Operations
  create_room: 'Room Created',
  update_room: 'Room Updated',
  delete_room: 'Room Deleted',
  bulk_upload_rooms: 'Rooms Bulk Uploaded',
  
  // Report Operations
  generate_report: 'Report Generated',
  download_report: 'Report Downloaded',
  delete_report: 'Report Deleted',
  export_audit_trail: 'Audit Trail Exported',
  
  // View Operations
  view_exam_dashboard: 'Exam Dashboard Viewed',
  view_student_exam_detail: 'Student Exam Detail Viewed',
  list_exam_results: 'Exam Results Listed',
  view_live_stats: 'Live Statistics Viewed',
  view_attendance: 'Attendance Viewed',
  view_user_profile: 'User Profile Viewed',
  view_user_list: 'User List Viewed',
  download_student_performance: 'Student Performance Downloaded',
  
  // Authentication
  password_reset_request: 'Password Reset Requested',
  password_changed: 'Password Changed'
};

// Format details JSON into readable JSX with FontAwesome icons
const formatDetails = (details: string, action: string, deviceType?: string): React.ReactElement => {
  try {
    const data = JSON.parse(details);
    
    // Device type badge component for mobile logs
    const MobileBadge = deviceType === 'Mobile' ? (
      <><FontAwesomeIcon icon={faMobile} className="mr-1" />Mobile • </>
    ) : null;
    
    // Format based on action type
    switch (action) {
      case 'create_exam':
      case 'update_exam':
        return (
          <>
            {MobileBadge}
            {data.title || 'Exam'} • {data.class || ''} {data.subject || ''} • {data.totalQuestions || 0} questions • {data.maxMarks || 0} marks
          </>
        );
      
      case 'delete_exam':
        return (
          <>
            {MobileBadge}
            {data.title || 'Exam'} • {data.class || ''} {data.subject || ''} • Deleted on {data.deletedAt ? new Date(data.deletedAt).toLocaleDateString() : 'N/A'}
          </>
        );
      
      case 'create_user':
      case 'update_user':
        return <>{data.fullName || 'User'} • {data.userType || ''} • {data.email || ''}</>;
      
      case 'create_question':
        return <>{data.type || 'Question'} • {data.subject || ''} {data.class || ''} • {data.marks || 0} marks • {data.complexity || ''}</>;
      
      case 'create_room':
      case 'update_room':
      case 'delete_room':
        return <>{data.roomName || data.room_name || 'Room'}</>;
      
      case 'generate_report':
        return <>{data.reportName || 'Report'} • {data.reportType || ''}</>;
      
      case 'download_report':
        return <>{data.reportName || 'Report'} • Generated: {data.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : 'N/A'}</>;
      
      case 'delete_report':
        return <>{data.reportName || 'Report'} • {data.reportType || ''}</>;
      
      case 'export_audit_trail':
        return <>{data.exportedUser || 'User'} ({data.exportedUserType || ''}) • {data.totalRecords || 0} records • {data.exportFormat || 'CSV'}</>;
      
      case 'view_exam_dashboard':
      case 'view_live_stats':
      case 'view_attendance':
        return <>{data.examTitle || 'Exam'} • {data.examClass || ''} {data.examSubject || ''}</>;
      
      case 'view_student_exam_detail':
        return <>{data.studentName || 'Student'} (Roll: {data.studentRoll || 'N/A'}) • Exam: {data.examTitle || 'N/A'} • Score: {data.score || 0}/{data.totalMarks || 0}</>;
      
      case 'list_exam_results':
        {
          const classLabel = data.selectedClass && data.selectedClass !== 'all' ? data.selectedClass : 'All Classes';
          const boardLabel = data.selectedBoard && data.selectedBoard !== 'all' ? data.selectedBoard : 'All Boards';
          const yearLabel = data.selectedYear || 'All Years';
          return <>{classLabel} • {boardLabel} • {yearLabel}</>;
        }
      
      case 'view_user_profile':
        {
          const userName = data.viewedUserName || data.fullName || 'User';
          const userType = data.viewedUserType || data.userType || '';
          return (
            <>
              {MobileBadge}
              {userName} • {userType}
            </>
          );
        }
      
      case 'view_user_list':
        {
          const parts: React.ReactElement[] = [];
          let key = 0;
          
          // Mobile badge
          if (deviceType === 'Mobile') {
            parts.push(<span key={key++}><FontAwesomeIcon icon={faMobile} className="mr-1" />Mobile</span>);
          }
          
          // Class/College information
          if (data.className) {
            const displayClassName = data.className === '_administrative' 
              ? 'Administrative & Faculty' 
              : data.className;
            parts.push(<span key={key++}>Class: {displayClassName}</span>);
          } else if (data.collegeId && data.collegeId !== 'LPU') {
            parts.push(<span key={key++}>College: {data.collegeId}</span>);
          }
          
          // Role filter
          const roleFilter = data.roleFilter || data.filterRole;
          if (roleFilter && roleFilter !== 'All' && roleFilter !== 'all') {
            parts.push(<span key={key++}><FontAwesomeIcon icon={faFilter} className="mr-1" />Filter: {roleFilter}</span>);
          } else if (!data.searchQuery && !data.totalUsers && parts.length === 0) {
            parts.push(<span key={key++}>Filter: All</span>);
          }
          
          // Search query
          if (data.searchQuery) {
            parts.push(<span key={key++}><FontAwesomeIcon icon={faMagnifyingGlass} className="mr-1" />Search: "{data.searchQuery}"</span>);
          }
          
          // Total users
          if (data.totalUsers !== undefined && data.totalUsers !== null) {
            parts.push(<span key={key++}><FontAwesomeIcon icon={faUsers} className="mr-1" />{data.totalUsers} users</span>);
          }
          
          // Page number
          if (data.page) {
            parts.push(<span key={key++}>Page {data.page}</span>);
          }
          
          if (parts.length === 0) {
            return <>User list viewed</>;
          }
          
          return (
            <>
              {parts.map((part, index) => (
                <React.Fragment key={index}>
                  {index > 0 && ' • '}
                  {part}
                </React.Fragment>
              ))}
            </>
          );
        }
      
      case 'download_student_performance':
        return <>{data.examTitle || 'Exam'} • {data.studentsIncluded || 0} students • {data.format || 'PDF'}</>;
      
      default:
        {
          const entries = Object.entries(data)
            .filter(([key]) => !key.includes('Id') && !key.includes('At'))
            .slice(0, 3)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' • ');
          return <>{entries || 'No details available'}</>;
        }
    }
  } catch (error) {
    return <>{details}</>;
  }
};

const UserAudit: React.FC<UserAuditProps> = ({ user }) => {
  const brandTheme = useBrand();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const logsPerPage = 50;

  useEffect(() => {
    loadAuditLogs(true);
  }, [user.userId]);

  const loadAuditLogs = async (reset: boolean = false) => {
    try {
      setLoading(true);
      
      const result = await firebaseService.getActivityLogs(
        user.userId,
        logsPerPage,
        reset ? undefined : lastDoc
      );

      if (reset) {
        setAuditLogs(result.logs);
        setPage(1);
      } else {
        setAuditLogs(prev => [...prev, ...result.logs]);
      }

      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
      setLoading(false);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    setPage(page + 1);
    loadAuditLogs(false);
  };

  const handleExport = async () => {
    try {
      // Get all logs for this user (fetch in batches)
      const allLogs: AuditLog[] = [];
      let hasMore = true;
      let lastVisible: any = undefined;
      
      while (hasMore) {
        const result = await firebaseService.getActivityLogs(user.userId, 100, lastVisible);
        allLogs.push(...result.logs);
        hasMore = result.hasMore;
        lastVisible = result.lastDoc;
      }

      // Convert to CSV
      const headers = ['Date', 'Time', 'Action', 'Section', 'Details', 'IP Address', 'User Agent', 'Location'];
      const csvContent = [
        headers.join(','),
        ...allLogs.map(log => [
          formatDate(log.timestamp),
          formatTime(log.timestamp),
          log.action || '',
          log.section || '',
          log.details ? JSON.stringify(log.details).replace(/,/g, ';') : '',
          log.ipAddress || '',
          log.userAgent ? log.userAgent.replace(/,/g, ';') : '',
          log.location || ''
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_trail_${user.fullName}_${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Log activity (non-blocking)
      try {
        const currentUser = await firebaseService.getCurrentUserProfile();
        if (currentUser) {
          await firebaseService.addActivityLog({
            userId: currentUser.userId,
            collegeId: currentUser.collegeId,
            action: 'export_audit_trail',
            entityType: 'audit_trail',
            entityId: user.userId,
            details: JSON.stringify({
              exportedUser: user.fullName,
              exportedUserType: user.userType,
              totalRecords: allLogs.length,
              exportFormat: 'CSV'
            })
          });
        }
      } catch (logError) {
        console.warn('⚠️ Failed to log audit trail export:', logError);
      }
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      alert('Failed to export audit trail');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    
    // Exam operations
    if (actionLower.includes('create_exam')) return faPlus;
    if (actionLower.includes('update_exam')) return faPenToSquare;
    if (actionLower.includes('delete_exam')) return faTrash;
    if (actionLower.includes('view_exam') || actionLower.includes('exam_dashboard')) return faGraduationCap;
    
    // User operations
    if (actionLower.includes('create_user')) return faPlus;
    if (actionLower.includes('update_user')) return faPenToSquare;
    if (actionLower.includes('view_user_profile')) return faUser;
    if (actionLower.includes('view_user_list')) return faUsers;
    if (actionLower.includes('bulk_upload_users')) return faArrowUpFromBracket;
    
    // Question operations
    if (actionLower.includes('create_question')) return faPlus;
    if (actionLower.includes('bulk_upload_questions')) return faArrowUpFromBracket;
    
    // Room operations
    if (actionLower.includes('create_room')) return faPlus;
    if (actionLower.includes('update_room')) return faPenToSquare;
    if (actionLower.includes('delete_room')) return faTrash;
    if (actionLower.includes('bulk_upload_rooms')) return faArrowUpFromBracket;
    
    // Report operations
    if (actionLower.includes('generate_report')) return faChartBar;
    if (actionLower.includes('download_report') || actionLower.includes('download_student_performance')) return faDownload;
    if (actionLower.includes('delete_report')) return faTrash;
    if (actionLower.includes('export_audit_trail')) return faFileExport;
    
    // View operations
    if (actionLower.includes('view_student_exam_detail')) return faGraduationCap;
    if (actionLower.includes('list_exam_results')) return faClipboardList;
    if (actionLower.includes('view_live_stats')) return faChartLine;
    if (actionLower.includes('view_attendance')) return faClipboardCheck;
    
    // Password operations
    if (actionLower.includes('password_reset')) return faKey;
    if (actionLower.includes('password_changed')) return faLock;
    
    // Generic fallbacks
    if (actionLower.includes('view') || actionLower.includes('open')) return faEye;
    if (actionLower.includes('create') || actionLower.includes('add')) return faPlus;
    if (actionLower.includes('update') || actionLower.includes('edit')) return faPenToSquare;
    if (actionLower.includes('delete') || actionLower.includes('remove')) return faTrash;
    if (actionLower.includes('download') || actionLower.includes('export')) return faDownload;
    if (actionLower.includes('upload') || actionLower.includes('bulk')) return faArrowUpFromBracket;
    if (actionLower.includes('search')) return faSearch;
    if (actionLower.includes('click') || actionLower.includes('select')) return faMousePointer;
    
    return faMousePointer;
  };

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    
    // Delete operations - Red
    if (actionLower.includes('delete') || actionLower.includes('remove')) return 'text-red-600';
    
    // Create operations - Green
    if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('generate')) return 'text-green-600';
    
    // Update/Edit operations - Amber
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('change')) return 'text-amber-600';
    
    // Download/Export operations - Purple
    if (actionLower.includes('download') || actionLower.includes('export')) return 'text-purple-600';
    
    // Upload operations - Indigo
    if (actionLower.includes('upload') || actionLower.includes('bulk')) return 'text-indigo-600';
    
    // View/List operations - Blue
    if (actionLower.includes('view') || actionLower.includes('open') || actionLower.includes('list')) return 'text-blue-600';
    
    // Password/Security operations - Pink
    if (actionLower.includes('password') || actionLower.includes('security') || actionLower.includes('lock')) return 'text-pink-600';
    
    // Stats/Analytics operations - Cyan
    if (actionLower.includes('stats') || actionLower.includes('analytics') || actionLower.includes('report')) return 'text-cyan-600';
    
    return 'text-gray-600';
  };

  const filteredLogs = auditLogs.filter(log => {
    if (actionFilter && !log.action?.toLowerCase().includes(actionFilter.toLowerCase())) return false;
    if (searchTerm && !log.section?.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !log.action?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (startDate) {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      if (logDate < new Date(startDate)) return false;
    }
    if (endDate) {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (logDate > end) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">

        {/* User Info Card with Export Button */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center justify-between">
            {/* User Info Section */}
            <div className="flex items-center space-x-4">
              {/* Avatar */}
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: brandTheme.gradients.primary }}
              >
                {user.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>

              {/* User Details - Compact Single Row */}
              <div className="flex items-center space-x-6">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Full Name</p>
                  <p className="font-semibold text-gray-900">{user.fullName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 flex items-center">
                    <FontAwesomeIcon icon={faEnvelope} className="mr-1" />
                    Email
                  </p>
                  <p className="text-sm text-gray-700">{user.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 flex items-center">
                    <FontAwesomeIcon icon={faShield} className="mr-1" />
                    User Type
                  </p>
                  <p className="text-sm font-medium text-gray-900">{user.userType || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Export Button - Right Aligned */}
            <button
              onClick={handleExport}
              className="flex flex-col items-center justify-center px-6 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg"
              style={{ background: brandTheme.gradients.primary }}
            >
              <FontAwesomeIcon icon={faFileExport} className="text-xl mb-1" />
              <span className="text-xs font-medium">Export</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Action Type</label>
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder="e.g., create, view"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <div className="relative">
                <FontAwesomeIcon 
                  icon={faSearch} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search section or action"
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Trail List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
        {loading && auditLogs.length === 0 ? (
          // Loading State - Same style as Result.tsx
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
              style={{ 
                borderColor: brandTheme.colors.primary + '20',
                borderTopColor: brandTheme.colors.primary
              }}
            />
            <p className="text-gray-600 font-medium">Loading activity logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FontAwesomeIcon icon={faUser} className="text-6xl mb-4 text-gray-300" />
            <p className="text-lg font-medium">No activity logs found</p>
            <p className="text-sm">This user hasn't performed any tracked actions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${getActionColor(log.action)}`}
                      style={{ backgroundColor: `${brandTheme.colors.primary}15` }}
                    >
                      <FontAwesomeIcon icon={getActionIcon(log.action)} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {ACTION_LABELS[log.action] || log.action}
                        </h4>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                          {log.entityType || log.section}
                        </span>
                      </div>

                      {log.details && (
                        <p className="text-sm text-gray-600 mb-2">
                          {formatDetails(log.details, log.action, log.deviceType)}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>
                          <FontAwesomeIcon icon={faCalendar} className="mr-1" />
                          {formatDate(log.timestamp)}
                        </span>
                        <span>
                          <FontAwesomeIcon icon={faClock} className="mr-1" />
                          {formatTime(log.timestamp)}
                        </span>
                        {log.ipAddress && (
                          <span>
                            <FontAwesomeIcon icon={faGlobe} className="mr-1" />
                            {log.ipAddress}
                          </span>
                        )}
                        {log.location && (
                          <span>
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1" />
                            {log.location}
                          </span>
                        )}
                      </div>

                      {log.userAgent && (
                        <div className="mt-2 text-xs text-gray-400 truncate">
                          <FontAwesomeIcon icon={faDesktop} className="mr-1" />
                          {log.userAgent}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !loading && filteredLogs.length > 0 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              className="px-6 py-2 rounded-lg transition-colors"
              style={{
                background: brandTheme.gradients.primary,
                color: 'white'
              }}
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAudit;