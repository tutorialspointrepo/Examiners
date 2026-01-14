import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar,
  faFilter,
  faFileExport,
  faXmark,
  faSpinner,
  faDownload,
  faArrowRight,
  faClipboardList,
  faClock,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faTrash
} from '@fortawesome/sharp-light-svg-icons';
import { getFirestore, collection, doc, getDoc, setDoc, query, where, orderBy, getDocs, deleteDoc, onSnapshot, limit, startAfter } from 'firebase/firestore';

// Toast Notification Component
interface ToastProps {
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const bgColors = {
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200'
  };

  const textColors = {
    success: 'text-green-800',
    warning: 'text-yellow-800',
    error: 'text-red-800',
    info: 'text-blue-800'
  };

  const icons = {
    success: faCircleCheck,
    warning: faCircleExclamation,
    error: faCircleExclamation,
    info: faCircleCheck
  };

  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className={`fixed top-4 right-4 z-50 flex items-center space-x-3 px-4 py-3 rounded-lg border-2 shadow-lg animate-[slideIn_0.3s_ease-out] ${bgColors[type]}`}
      style={{ minWidth: '300px', maxWidth: '500px' }}
    >
      <FontAwesomeIcon 
        icon={icons[type]} 
        className={`text-xl ${textColors[type]}`}
      />
      <span className={`flex-1 font-medium ${textColors[type]}`}>
        {message}
      </span>
      <button 
        onClick={onClose}
        className={`${textColors[type]} hover:opacity-70 transition-opacity`}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
};

// Delete Confirmation Dialog Component
interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  reportName?: string;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ isOpen, onConfirm, onCancel, reportName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-200"
        onClick={onCancel}
      ></div>

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="flex items-center space-x-3 p-6 border-b border-gray-100">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <FontAwesomeIcon icon={faTrash} className="text-red-600 text-xl" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">Delete Report</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 leading-relaxed">
            Are you sure you want to delete this report?
            {reportName && (
              <span className="block mt-2 font-semibold text-gray-900">
                "{reportName}"
              </span>
            )}
          </p>
          <p className="mt-3 text-sm text-gray-500">
            The report file will be permanently removed from storage.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg transition-all duration-200"
          >
            Delete Report
          </button>
        </div>
      </div>
    </div>
  );
};

import type { ReportTemplate } from './Reports';

interface ReportDetailProps {
  report: ReportTemplate | null;
  brandTheme: any;
  activeCollegeId?: string;
  onClose?: () => void;
  onRefresh?: () => void;
}

interface GeneratedReport {
  id: string;
  name: string;
  reportType: string;
  status: 'available' | 'generating' | 'error';
  generatedAt: string;
  generatedBy: string;
  parameters: Record<string, any>;
  totalRecords?: number;
  dataUrl?: string;
}

export default function ReportDetail({
  report,
  brandTheme,
  activeCollegeId,
  onClose,
  onRefresh: _onRefresh
}: ReportDetailProps) {
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, any[]>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' | 'info' } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  
  // Pagination state
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 10;

  const db = getFirestore();

  // Helper function to check if a report matches current filters
  const reportMatchesFilters = (reportParams: Record<string, any>): boolean => {
    if (!filterValues || Object.keys(filterValues).length === 0) return false;
    
    return Object.keys(filterValues).every(key => {
      return reportParams[key] === filterValues[key];
    });
  };

  // Helper function to format parameter values for display
  const formatParameterValue = (key: string, value: any): string => {
    // Format date fields (startDate, endDate)
    if ((key === 'startDate' || key === 'endDate') && typeof value === 'string') {
      try {
        const date = new Date(value);
        return date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });
      } catch {
        return value;
      }
    }
    
    // Format month numbers to month names (legacy support)
    if ((key === 'examMonth' || key === 'month') && typeof value === 'string') {
      const monthMap: Record<string, string> = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
        '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
        '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
      };
      return monthMap[value] || value;
    }
    return value;
  };

  const formatParameterLabel = (key: string): string => {
    const labelMap: Record<string, string> = {
      'class': 'Class',
      'subject': 'Subject',
      'academicYear': 'Year',
      'examType': 'Exam Type',
      'status': 'Status',
      'startDate': 'Date Range',
      'endDate': 'Date Range'
    };
    return labelMap[key] || key.replace(/([A-Z])/g, ' $1').trim();
  };

  const getParametersToDisplay = (parameters: Record<string, any>): Array<{key: string, label: string, value: string}> => {
    const params: Array<{key: string, label: string, value: string}> = [];
    
    // Check if we have date range
    if (parameters.startDate && parameters.endDate) {
      params.push({
        key: 'dateRange',
        label: 'Date Range',
        value: `${formatParameterValue('startDate', parameters.startDate)} - ${formatParameterValue('endDate', parameters.endDate)}`
      });
    }
    
    // Add other parameters (excluding startDate and endDate individually)
    Object.entries(parameters).forEach(([key, value]) => {
      if (key !== 'startDate' && key !== 'endDate') {
        params.push({
          key,
          label: formatParameterLabel(key),
          value: formatParameterValue(key, value) as string
        });
      }
    });
    
    return params;
  };

  // Helper function to show toast
  const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Reset state when report changes
  useEffect(() => {
    setFilterValues({});
    setErrorMessage('');
  }, [report?.id]);

  // Load filter options (both static and dynamic) - EXACT SAME AS MODAL
  useEffect(() => {
    const loadFilterOptions = async () => {
      console.log('🔍 DEBUG - report:', report?.name || 'null');
      console.log('🔍 DEBUG - activeCollegeId:', activeCollegeId);
      
      if (!report || !activeCollegeId) {
        console.log('⚠️ Cannot load options - missing report or collegeId');
        console.log('   - report exists:', !!report);
        console.log('   - activeCollegeId exists:', !!activeCollegeId);
        return;
      }

      try {
        console.log('📋 Loading filter options for:', report.name);
        console.log('📋 Active College ID:', activeCollegeId);
        console.log('📋 Filters:', report.filters);
        
        const collegeRef = doc(db, 'colleges', activeCollegeId);
        const collegeSnap = await getDoc(collegeRef);
        
        if (!collegeSnap.exists()) {
          console.error('❌ College document not found');
          return;
        }
        
        const collegeData = collegeSnap.data();
        console.log('📋 College data:', collegeData);
        
        const options: Record<string, any[]> = {};
        
        // Load options for each filter (EXACT SAME LOGIC AS MODAL)
        if (report.filters && Array.isArray(report.filters)) {
          report.filters.forEach((filter: any) => {
            console.log('📋 Processing filter:', filter.id);
            
            if (filter.dynamicOptions) {
              // Dynamic options from college document
              const { source, field } = filter.dynamicOptions;
              console.log('   - Dynamic options from:', source, field);
              
              if (source === 'college' && collegeData[field]) {
                // Convert array to options format
                options[filter.id] = collegeData[field].map((value: string) => ({
                  value,
                  label: value
                }));
                console.log('   ✅ Loaded', options[filter.id].length, 'dynamic options');
              }
            } else if (filter.options) {
              // Static options already in template
              options[filter.id] = filter.options;
              console.log('   ✅ Loaded', options[filter.id].length, 'static options');
            }
          });
        }
        
        console.log('📋 Final options:', options);
        setDynamicOptions(options);
      } catch (error) {
        console.error('❌ Error loading options:', error);
      }
    };

    loadFilterOptions();
  }, [report, activeCollegeId, db]);

  // Load exams dynamically when dependent filters change
  useEffect(() => {
    const loadExamsForFilter = async () => {
      if (!report || !activeCollegeId) return;

      // Find the examId filter
      const examFilter = report.filters?.find((f: any) => f.id === 'examId');
      if (!examFilter || !examFilter.dynamicOptions) return;

      const { source, dependsOn } = examFilter.dynamicOptions;
      if (source !== 'exams' || !dependsOn) return;

      // Check if all dependent filters have values
      const allDependenciesMet = dependsOn.every((dep: string) => filterValues[dep]);
      
      if (!allDependenciesMet) {
        console.log('⏳ Waiting for dependent filters:', dependsOn);
        console.log('   Current values:', dependsOn.map((dep: string) => `${dep}: ${filterValues[dep] || 'not set'}`).join(', '));
        setDynamicOptions(prev => ({ ...prev, examId: [] }));
        return;
      }

      try {
        console.log('🔍 Loading exams for filter values:', filterValues);
        
        // Build query for exams
        const examsRef = collection(db, 'exams');
        let examsQuery = query(
          examsRef,
          where('collegeId', '==', activeCollegeId)
        );

        console.log('📋 Query filters:');
        console.log('   - collegeId:', activeCollegeId);

        // Add filters from dependencies
        // NOTE: Exam schema uses 'year' field, not 'academicYear'
        if (filterValues.academicYear) {
          examsQuery = query(examsQuery, where('year', '==', filterValues.academicYear));
          console.log('   - year:', filterValues.academicYear);
        }
        if (filterValues.class) {
          examsQuery = query(examsQuery, where('class', '==', filterValues.class));
          console.log('   - class:', filterValues.class);
        }
        if (filterValues.subject) {
          examsQuery = query(examsQuery, where('subject', '==', filterValues.subject));
          console.log('   - subject:', filterValues.subject);
        }

        // Execute query
        const examsSnapshot = await getDocs(examsQuery);
        console.log(`📊 Found ${examsSnapshot.size} exams before month filter`);

        // Filter by month using examDate string field
        let filteredExams = examsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (filterValues.month) {
          const selectedMonth = filterValues.month.padStart(2, '0'); // "11" or "12"
          
          filteredExams = filteredExams.filter((exam: any) => {
            if (!exam.examDate) return false;
            
            // examDate format: "2025-12-01"
            // Extract month: "2025-12-01".substring(5, 7) = "12"
            const examMonth = exam.examDate.substring(5, 7);
            
            return examMonth === selectedMonth;
          });
          
          console.log(`📊 After month filter: ${filteredExams.length} exams in month ${selectedMonth}`);
        }

        // Convert to options format
        const examOptions = filteredExams.map((exam: any) => {
          let examDate = '';
          if (exam.createdAt) {
            let date;
            if (exam.createdAt.toDate && typeof exam.createdAt.toDate === 'function') {
              date = exam.createdAt.toDate();
            } else {
              date = new Date(exam.createdAt);
            }
            examDate = date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
          }
          
          return {
            value: exam.id,
            label: `${exam.examTitle || exam.title || 'Untitled Exam'} - ${examDate}`
          };
        });

        console.log('✅ Loaded', examOptions.length, 'exam options');
        setDynamicOptions(prev => ({ ...prev, examId: examOptions }));

      } catch (error) {
        console.error('❌ Error loading exams:', error);
        setDynamicOptions(prev => ({ ...prev, examId: [] }));
      }
    };

    loadExamsForFilter();
  }, [report, activeCollegeId, db, filterValues.academicYear, filterValues.class, filterValues.subject, filterValues.month]);

  // Load previously generated reports for this template WITH REAL-TIME UPDATES AND PAGINATION
  useEffect(() => {
    if (!report || !activeCollegeId) {
      setGeneratedReports([]);
      setIsLoadingReports(false);
      setLastVisible(null);
      setHasMore(true);
      return;
    }

    setIsLoadingReports(true);
    
    const instancesRef = collection(db, 'reportInstances');
    const q = query(
      instancesRef,
      where('templateId', '==', report.id),
      where('collegeId', '==', activeCollegeId),
      orderBy('generatedAt', 'desc'),
      limit(PAGE_SIZE) // Load first page
    );
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('📊 Reports updated from Firestore (Page 1)');
        const reports: GeneratedReport[] = [];
      
        snapshot.forEach((doc) => {
          const data = doc.data();
          reports.push({
            id: doc.id,
            name: data.name || data.reportName || 'Untitled Report',
            reportType: data.reportType || data.type || 'unknown',  // ← Handle different field names
            status: data.status || 'available',
            generatedAt: data.generatedAt || data.createdAt,
            generatedBy: data.generatedBy || data.createdBy,
            parameters: data.parameters || {},
            totalRecords: data.totalRecords,
            dataUrl: data.dataUrl
          });
        });
        
        // Update pagination state
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
        
        setGeneratedReports(reports);
        setIsLoadingReports(false);
      },
      (error) => {
        console.error('❌ Error loading reports:', error);
        setIsLoadingReports(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🔌 Unsubscribing from reports listener');
      unsubscribe();
    };
  }, [report, activeCollegeId, db]);

  // Load more reports (pagination)
  const loadMoreReports = async () => {
    if (!report || !activeCollegeId || !lastVisible || !hasMore || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      
      const instancesRef = collection(db, 'reportInstances');
      const q = query(
        instancesRef,
        where('templateId', '==', report.id),
        where('collegeId', '==', activeCollegeId),
        orderBy('generatedAt', 'desc'),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
      
      const snapshot = await getDocs(q);
      console.log(`📊 Loaded ${snapshot.docs.length} more reports`);
      
      const newReports: GeneratedReport[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        newReports.push({
          id: docSnap.id,
          name: data.name,
          reportType: data.reportType || data.type || 'unknown',
          status: data.status,
          generatedAt: data.generatedAt,
          generatedBy: data.generatedBy,
          parameters: data.parameters,
          totalRecords: data.totalRecords,
          dataUrl: data.dataUrl || data.downloadUrl || data.url // Try multiple field names
        });
      });
      
      // Update pagination state
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      
      // Append new reports to existing ones
      setGeneratedReports(prev => [...prev, ...newReports]);
      
    } catch (error) {
      console.error('❌ Error loading more reports:', error);
      showToast('Failed to load more reports', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle report generation
  const handleGenerateReport = async () => {
    if (!report || !activeCollegeId) return;

    // Validate required filters
    const missingFilters = (report.filters || [])
      .filter((f: any) => f.required && !filterValues[f.id])
      .map((f: any) => f.label);
    
    if (missingFilters.length > 0) {
      setErrorMessage(`Please select: ${missingFilters.join(', ')}`);
      return;
    }

    // Check for duplicate reports with same parameters
    const existingReport = generatedReports.find(r => {
      // Only check reports that are available (completed successfully)
      if (r.status !== 'available') return false;
      
      // Check if all parameters match
      const paramsMatch = Object.keys(filterValues).every(key => {
        return r.parameters[key] === filterValues[key];
      });
      
      return paramsMatch;
    });

    if (existingReport) {
      showToast(
        'A report with these exact filters already exists! Please download the existing report or change the filters.',
        'warning'
      );
      // Don't set error message - toast is enough
      setIsGenerating(false);
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage('');
      
      const instanceId = `report-${activeCollegeId}-${report.id}-${Date.now()}`;
      
      // Format report name with actual month and year
      let reportName = report.name;
      
      // Replace Mon YYYY with actual values if filters exist
      if (reportName.includes('Mon YYYY')) {
        const monthMap: Record<string, string> = {
          '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
          '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
          '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
        };
        
        // Get month from filters (examMonth or month)
        const monthValue = filterValues.examMonth || filterValues.month;
        const monthName = monthValue ? monthMap[monthValue] || monthValue : 'Mon';
        
        // Get year from filters (academicYear like "2025-26")
        const academicYear = filterValues.academicYear;
        const yearValue = academicYear ? academicYear.split('-')[0] : new Date().getFullYear().toString();
        
        // Replace Mon YYYY with formatted values
        reportName = reportName.replace('Mon YYYY', `${monthName} ${yearValue}`);
      }
      
      const reportInstance = {
        id: instanceId,
        templateId: report.id,
        name: reportName,
        type: report.type,
        description: report.description,
        collegeId: activeCollegeId,
        status: 'generating',
        generatedBy: 'current-user-id', // TODO: Get from auth
        generatedAt: new Date().toISOString(),
        lastGenerated: new Date().toLocaleDateString('en-GB'),
        parameters: filterValues
      };
      
      await setDoc(doc(db, 'reportInstances', instanceId), reportInstance);
      
      console.log('✅ Report created:', instanceId);
      console.log('⏳ Real-time listener will detect and update automatically');
      
      // Log activity (non-blocking)
      try {
        const { firebaseService } = await import('./services/firebase_service');
        const currentUser = await firebaseService.getCurrentUserProfile();
        if (currentUser && activeCollegeId) {
          await firebaseService.addActivityLog({
            userId: currentUser.userId,
            collegeId: activeCollegeId,
            action: 'generate_report',
            entityType: 'report',
            entityId: instanceId,
            details: JSON.stringify({
              reportName: reportName,
              reportType: report.type,
              templateId: report.id,
              parameters: filterValues
            })
          });
        }
      } catch (logError) {
        console.warn('⚠️ Failed to log report generation:', logError);
      }
      
      // DON'T clear form - keep filters selected for easy regeneration
      // User can manually change filters if needed
      // Real-time listener will automatically show the new report!
      
    } catch (error) {
      console.error('❌ Error generating report:', error);
      setErrorMessage('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle delete report - open confirmation dialog
  const handleDeleteReport = (reportId: string, _reportName?: string) => {
    setReportToDelete(reportId);
    setDeleteDialogOpen(true);
  };

  // Confirm delete report
  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;

    try {
      // Get report details before deletion
      const reportDoc = await getDoc(doc(db, 'reportInstances', reportToDelete));
      const reportData = reportDoc.data();
      
      await deleteDoc(doc(db, 'reportInstances', reportToDelete));
      setGeneratedReports(prev => prev.filter(r => r.id !== reportToDelete));
      showToast('Report deleted successfully', 'success');
      
      // Log activity (non-blocking)
      try {
        const { firebaseService } = await import('./services/firebase_service');
        const currentUser = await firebaseService.getCurrentUserProfile();
        if (currentUser && activeCollegeId && reportData) {
          await firebaseService.addActivityLog({
            userId: currentUser.userId,
            collegeId: activeCollegeId,
            action: 'delete_report',
            entityType: 'report',
            entityId: reportToDelete,
            details: JSON.stringify({
              reportName: reportData.name,
              reportType: reportData.type,
              templateId: reportData.templateId,
              generatedAt: reportData.generatedAt
            })
          });
        }
      } catch (logError) {
        console.warn('⚠️ Failed to log report deletion:', logError);
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      showToast('Failed to delete report', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  // Cancel delete report
  const cancelDeleteReport = () => {
    setDeleteDialogOpen(false);
    setReportToDelete(null);
  };

  // Format date
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format report name with actual month and year from filter values
  const getFormattedReportName = () => {
    if (!report) return '';
    
    let formattedName = report.name;
    
    // Replace Mon YYYY with actual values if pattern exists and filters selected
    if (formattedName.includes('Mon YYYY')) {
      const monthMap: Record<string, string> = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
        '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
        '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
      };
      
      // Get month from filters
      const monthValue = filterValues.examMonth || filterValues.month;
      const monthName = monthValue ? monthMap[monthValue] || monthValue : 'Mon';
      
      // Get year from academic year filter
      const academicYear = filterValues.academicYear;
      const yearValue = academicYear ? academicYear.split('-')[0] : 'YYYY';
      
      // Replace placeholder
      formattedName = formattedName.replace('Mon YYYY', `${monthName} ${yearValue}`);
    }
    
    return formattedName;
  };

  // Empty state
  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
        <div className="text-center max-w-md">
          <div className="mb-8 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-56 h-56 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-20 blur-3xl"></div>
            </div>
            <div className="relative">
              <FontAwesomeIcon 
                icon={faChartBar} 
                className="text-8xl"
                style={{ color: `${brandTheme.colors.primary}40` }}
              />
            </div>
          </div>
          
          <h2 
            className="text-3xl font-bold mb-4"
            style={{ 
              background: brandTheme.gradients.primary,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Select a Report Template
          </h2>
          <p className="text-gray-600 text-lg mb-6">
            Choose a report template from the left panel to view its filters and generate reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div 
        className="flex-shrink-0 p-6 text-white relative overflow-hidden"
        style={{ background: brandTheme.gradients.primary }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{getFormattedReportName()}</h2>
              <p className="text-white/90 text-sm">{report.description}</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faXmark} size="lg" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon icon={faClipboardList} />
              <span>{report.dataSource?.fields?.length || 0} fields</span>
            </div>
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon icon={faFilter} />
              <span>{report.filters?.length || 0} filters</span>
            </div>
            <div className="flex items-center space-x-1">
              <FontAwesomeIcon icon={faFileExport} />
              <span>{report.settings?.format?.toUpperCase() || 'XLSX'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Generate New Report Section */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${brandTheme.colors.primary}20` }}
                  >
                    <FontAwesomeIcon 
                      icon={faFilter} 
                      style={{ color: brandTheme.colors.primary }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Generate New Report</h3>
                    <p className="text-sm text-gray-600">Select filters and generate report</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {errorMessage && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                  <FontAwesomeIcon icon={faXmark} className="text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6">
                {(report.filters || []).map((filter: any) => {
                  console.log('🎨 Rendering filter:', filter.id, 'Options:', dynamicOptions[filter.id]?.length || 0);
                  
                  return (
                    <div key={filter.id}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {filter.label}
                        {filter.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      
                      {filter.type === 'select' && (
                        <select
                          value={filterValues[filter.id] || ''}
                          onChange={(e) => setFilterValues({
                            ...filterValues,
                            [filter.id]: e.target.value
                          })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                          style={{ outlineColor: brandTheme.colors.primary }}
                        >
                          <option value="">Select {filter.label}</option>
                          {dynamicOptions[filter.id]?.map((option: any) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {filter.type === 'date' && (
                        <input
                          type="date"
                          value={filterValues[filter.id] || ''}
                          onChange={(e) => setFilterValues({
                            ...filterValues,
                            [filter.id]: e.target.value
                          })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                          style={{ outlineColor: brandTheme.colors.primary }}
                          placeholder={filter.placeholder}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="w-full px-6 py-3 rounded-lg font-semibold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                style={{
                  background: brandTheme.gradients.primary,
                  color: 'white'
                }}
              >
                {isGenerating ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faFileExport} />
                    <span>Generate Report</span>
                    <FontAwesomeIcon icon={faArrowRight} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Reports List */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${brandTheme.colors.primary}20` }}
                  >
                    <FontAwesomeIcon 
                      icon={faFileExport} 
                      style={{ color: brandTheme.colors.primary }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Generated Reports</h3>
                    <p className="text-sm text-gray-600">
                      {generatedReports.length} report{generatedReports.length !== 1 ? 's' : ''} generated
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {isLoadingReports ? (
                <div className="p-12 text-center">
                  <FontAwesomeIcon 
                    icon={faSpinner} 
                    className="animate-spin text-3xl mb-3"
                    style={{ color: brandTheme.colors.primary }}
                  />
                  <p className="text-gray-600">Loading reports...</p>
                </div>
              ) : generatedReports.length === 0 ? (
                <div className="p-12 text-center">
                  <FontAwesomeIcon 
                    icon={faFileExport} 
                    className="text-5xl mb-4"
                    style={{ color: `${brandTheme.colors.primary}30` }}
                  />
                  <h4 className="font-semibold text-gray-700 mb-2">No Reports Generated Yet</h4>
                  <p className="text-sm text-gray-600">
                    Use the form above to generate your first report
                  </p>
                </div>
              ) : (
                <>
                  {generatedReports.map((genReport) => {
                    const matchesFilters = reportMatchesFilters(genReport.parameters);
                    
                    return (
                      <div 
                        key={genReport.id} 
                        className={`p-6 transition-all ${
                          matchesFilters 
                            ? 'bg-blue-50 border-l-4 border-blue-500 shadow-sm' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {matchesFilters && (
                          <div className="mb-2">
                            <span className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                              <FontAwesomeIcon icon={faCircleCheck} className="text-xs" />
                              <span>Matches Current Filters</span>
                            </span>
                          </div>
                        )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {genReport.name}
                          </h4>
                          <span
                            className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                            style={{
                              backgroundColor: genReport.status === 'available' 
                                ? '#D1FAE5' 
                                : genReport.status === 'generating'
                                ? '#FEF3C7'
                                : '#FEE2E2',
                              color: genReport.status === 'available' 
                                ? '#059669' 
                                : genReport.status === 'generating'
                                ? '#D97706'
                                : '#DC2626'
                            }}
                          >
                            {genReport.status === 'available' && (
                              <FontAwesomeIcon icon={faCircleCheck} className="mr-1" />
                            )}
                            {genReport.status === 'generating' && (
                              <FontAwesomeIcon icon={faSpinner} className="mr-1 animate-spin" />
                            )}
                            {genReport.status === 'error' && (
                              <FontAwesomeIcon icon={faCircleExclamation} className="mr-1" />
                            )}
                            {genReport.status === 'available' ? 'Ready' : genReport.status === 'generating' ? 'Processing' : 'Failed'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <FontAwesomeIcon icon={faClock} />
                            <span>{formatDate(genReport.generatedAt)}</span>
                          </div>
                          {genReport.totalRecords && (
                            <div className="flex items-center space-x-1">
                              <FontAwesomeIcon icon={faClipboardList} />
                              <span>{genReport.totalRecords} records</span>
                            </div>
                          )}
                        </div>

                        {/* Show applied filters */}
                        {genReport.parameters && Object.keys(genReport.parameters).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
                            {getParametersToDisplay(genReport.parameters).map((param) => (
                              <span 
                                key={param.key}
                                className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs whitespace-nowrap"
                              >
                                <span className="font-semibold">
                                  {param.label}:
                                </span> {param.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {genReport.status === 'available' ? (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {genReport.dataUrl ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {/* Download Button - Light Green (matches Share and View style) */}
                              <a
                                href={genReport.dataUrl}
                                download
                                onClick={async () => {
                                  // Log download activity
                                  try {
                                    const { firebaseService } = await import('./services/firebase_service');
                                    const currentUser = await firebaseService.getCurrentUserProfile();
                                    if (currentUser && activeCollegeId) {
                                      await firebaseService.addActivityLog({
                                        userId: currentUser.userId,
                                        collegeId: activeCollegeId,
                                        action: 'download_report',
                                        entityType: 'report',
                                        entityId: genReport.id,
                                        details: JSON.stringify({
                                          reportName: genReport.name,
                                          reportType: genReport.reportType,
                                          generatedAt: genReport.generatedAt,
                                          parameters: genReport.parameters
                                        })
                                      });
                                    }
                                  } catch (logError) {
                                    console.warn('⚠️ Failed to log report download:', logError);
                                  }
                                }}
                                className="inline-flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg font-semibold text-sm transition-colors"
                                title="Download Report"
                              >
                                <FontAwesomeIcon icon={faDownload} />
                                <span>Download</span>
                              </a>

                              {/* Share Button */}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(genReport.dataUrl!);
                                  showToast('Download link copied to clipboard!', 'success');
                                }}
                                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-semibold text-sm transition-colors"
                                title="Share Report"
                              >
                                <FontAwesomeIcon icon={faArrowRight} className="rotate-45" />
                                <span>Share</span>
                              </button>
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteReport(genReport.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Report"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            {genReport.totalRecords === 0 ? (
                              <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg flex items-center space-x-2">
                                <FontAwesomeIcon icon={faCircleInfo} />
                                <span>No records found for the selected filters</span>
                              </div>
                            ) : (
                              <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg flex items-center space-x-2">
                                <FontAwesomeIcon icon={faCircleExclamation} />
                                <span>Report file URL is missing. Check Cloud Function logs.</span>
                              </div>
                            )}
                            <button
                              onClick={() => handleDeleteReport(genReport.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Report"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center justify-end pt-4 border-t border-gray-200">
                        {/* Delete Button for non-ready reports */}
                        <button
                          onClick={() => handleDeleteReport(genReport.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Report"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    )}
                  </div>
                    );
                  })}
                  
                  {/* Load More Button */}
                  {hasMore && (
                    <div className="p-6 text-center border-t border-gray-200">
                      <button
                        onClick={loadMoreReports}
                        disabled={loadingMore}
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingMore ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faArrowRight} className="rotate-90" />
                            <span>Load More Reports</span>
                          </>
                        )}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        Showing {generatedReports.length} reports
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Toast Notification */}
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)}
      />
    )}

    {/* Delete Confirmation Dialog */}
    <DeleteConfirmDialog
      isOpen={deleteDialogOpen}
      onConfirm={confirmDeleteReport}
      onCancel={cancelDeleteReport}
      reportName={generatedReports.find(r => r.id === reportToDelete)?.name}
    />
  </>
  );
}