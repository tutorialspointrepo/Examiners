import { useState, useEffect } from 'react';
import { useBrand } from './BrandContext';
import { type UserModel } from './services/firebase_service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faXmark, 
  faCalendar,
  faChartBar,
  faGraduationCap,
  faChevronDown,
  faFileLines,
  faCheckCircle,
  faBook,
  faClipboardList,
  faAward,
  faListCheck,
  faChartLine,
  faTrophy,
  faUserGraduate,
  faFilter,
  faSparkles,
  faFileText
} from '@fortawesome/sharp-light-svg-icons';

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: any) => void;
  currentUser: UserModel;
  activeCollegeId?: string;
  activeCollegeName?: string;
}

const REPORT_TYPES = [
  { 
    id: 'performance', 
    label: 'Student Performance', 
    icon: faChartLine,
    description: 'Analyze student academic performance',
    color: 'blue'
  },
  { 
    id: 'attendance', 
    label: 'Attendance Report', 
    icon: faUserGraduate,
    description: 'Track student attendance patterns',
    color: 'green'
  },
  { 
    id: 'exam_analysis', 
    label: 'Exam Analysis', 
    icon: faClipboardList,
    description: 'Detailed exam statistics and insights',
    color: 'purple'
  },
  { 
    id: 'class_summary', 
    label: 'Class Summary', 
    icon: faGraduationCap,
    description: 'Overall class performance overview',
    color: 'orange'
  },
  { 
    id: 'individual_progress', 
    label: 'Individual Progress', 
    icon: faAward,
    description: 'Track individual student progress',
    color: 'pink'
  },
  { 
    id: 'comparative', 
    label: 'Comparative Analysis', 
    icon: faChartBar,
    description: 'Compare classes or time periods',
    color: 'teal'
  },
  { 
    id: 'leaderboard', 
    label: 'Leaderboard Report', 
    icon: faTrophy,
    description: 'Top performers and rankings',
    color: 'yellow'
  },
  { 
    id: 'custom', 
    label: 'Custom Report', 
    icon: faFileText,
    description: 'Create a custom report template',
    color: 'indigo'
  }
];

const REPORT_FORMATS = [
  { id: 'pdf', label: 'PDF Document', icon: faFileLines },
  { id: 'excel', label: 'Excel Spreadsheet', icon: faListCheck },
  { id: 'dashboard', label: 'Interactive Dashboard', icon: faChartBar }
];

const TIME_PERIODS = [
  { id: 'custom', label: 'Custom Date Range' },
  { id: 'current_month', label: 'Current Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'current_quarter', label: 'Current Quarter' },
  { id: 'last_quarter', label: 'Last Quarter' },
  { id: 'current_year', label: 'Current Academic Year' },
  { id: 'last_year', label: 'Last Academic Year' }
];

const getReportTypeColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    'blue': '#3B82F6',
    'green': '#10B981',
    'purple': '#8B5CF6',
    'orange': '#F59E0B',
    'pink': '#EC4899',
    'teal': '#14B8A6',
    'yellow': '#EAB308',
    'indigo': '#6366F1',
    'red': '#EF4444'
  };
  return colorMap[color] || '#6B7280';
};

export default function CreateReportModal({
  isOpen,
  onClose,
  onSave,
  currentUser,
  activeCollegeId,
  activeCollegeName
}: CreateReportModalProps) {
  const brand = useBrand();
  
  // Form states
  const [step, setStep] = useState(1); // 1: Type Selection, 2: Configuration, 3: Filters
  const [reportType, setReportType] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportFormat, setReportFormat] = useState('pdf');
  const [timePeriod, setTimePeriod] = useState('custom');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [includeGraphs, setIncludeGraphs] = useState(true);
  const [includeComparisons, setIncludeComparisons] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  // Sample data - replace with actual data from Firebase
  const availableClasses = ['VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const availableSubjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Computer Science'];

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep(1);
        setReportType('');
        setReportTitle('');
        setReportDescription('');
        setReportFormat('pdf');
        setTimePeriod('custom');
        setStartDate('');
        setEndDate('');
        setSelectedClasses([]);
        setSelectedSubjects([]);
        setIncludeGraphs(true);
        setIncludeComparisons(false);
        setIsSubmitting(false);
      }, 300);
    }
  }, [isOpen]);

  // Auto-generate title based on report type
  useEffect(() => {
    if (reportType && !reportTitle) {
      const type = REPORT_TYPES.find(t => t.id === reportType);
      if (type) {
        const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        setReportTitle(`${type.label} - ${date}`);
      }
    }
  }, [reportType]);

  const handleSubmit = async () => {
    if (!reportType || !reportTitle || (timePeriod === 'custom' && (!startDate || !endDate))) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const reportData = {
        type: reportType,
        title: reportTitle,
        description: reportDescription,
        format: reportFormat,
        timePeriod,
        startDate: timePeriod === 'custom' ? startDate : undefined,
        endDate: timePeriod === 'custom' ? endDate : undefined,
        filters: {
          classes: selectedClasses,
          subjects: selectedSubjects
        },
        options: {
          includeGraphs,
          includeComparisons
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
        createdById: currentUser.userId,
        createdByRole: currentUser.userType,
        collegeId: activeCollegeId,
        collegeName: activeCollegeName
      };

      // Call onSave callback
      onSave(reportData);
      onClose();
    } catch (error) {
      console.error('Error creating report:', error);
      alert('Failed to create report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleClass = (className: string) => {
    setSelectedClasses(prev => 
      prev.includes(className) 
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  if (!isOpen) return null;

  const selectedReportType = REPORT_TYPES.find(t => t.id === reportType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="px-8 py-6 border-b-2 border-gray-100 flex-shrink-0"
          style={{ 
            background: `linear-gradient(135deg, ${brand.colors.primary}05 0%, ${brand.colors.secondary}05 100%)`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ background: brand.gradients.primary }}
              >
                <FontAwesomeIcon icon={faChartBar} className="text-white text-2xl" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create Report</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {step === 1 && 'Select report type'}
                  {step === 2 && 'Configure report settings'}
                  {step === 3 && 'Apply filters and options'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <FontAwesomeIcon icon={faXmark} className="text-gray-600 text-xl" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-3 mt-6">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      step >= stepNum 
                        ? 'text-white shadow-lg scale-110' 
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    style={step >= stepNum ? { background: brand.gradients.primary } : {}}
                  >
                    {step > stepNum ? (
                      <FontAwesomeIcon icon={faCheckCircle} />
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${step >= stepNum ? 'text-gray-900' : 'text-gray-500'}`}>
                    {stepNum === 1 && 'Type'}
                    {stepNum === 2 && 'Configure'}
                    {stepNum === 3 && 'Finalize'}
                  </span>
                </div>
                {stepNum < 3 && (
                  <div 
                    className={`w-16 h-1 mx-2 rounded-full transition-colors ${
                      step > stepNum ? 'opacity-100' : 'bg-gray-200'
                    }`}
                    style={step > stepNum ? { background: brand.gradients.primary } : {}}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Step 1: Report Type Selection */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setReportType(type.id);
                  }}
                  className={`relative p-4 rounded-2xl border transition-all hover:shadow-xl ${
                    reportType === type.id
                      ? 'shadow-lg scale-105'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{
                    borderColor: reportType === type.id ? getReportTypeColor(type.color) : undefined,
                    background: reportType === type.id 
                      ? `linear-gradient(135deg, ${getReportTypeColor(type.color)}10 0%, ${getReportTypeColor(type.color)}05 100%)`
                      : undefined
                  }}
                >
                  {reportType === type.id && (
                    <div 
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: getReportTypeColor(type.color) }}
                    >
                      <FontAwesomeIcon icon={faCheckCircle} className="text-white text-xs" />
                    </div>
                  )}
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ 
                      backgroundColor: `${getReportTypeColor(type.color)}15`,
                      color: getReportTypeColor(type.color)
                    }}
                  >
                    <FontAwesomeIcon icon={type.icon} className="text-xl" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-base">{type.label}</h3>
                  <p className="text-xs text-gray-600 leading-snug">{type.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Selected Report Type Banner */}
              {selectedReportType && (
                <div 
                  className="p-4 rounded-2xl flex items-center space-x-4"
                  style={{ 
                    background: `linear-gradient(135deg, ${getReportTypeColor(selectedReportType.color)}15 0%, ${getReportTypeColor(selectedReportType.color)}05 100%)`
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: getReportTypeColor(selectedReportType.color) }}
                  >
                    <FontAwesomeIcon icon={selectedReportType.icon} className="text-white text-xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{selectedReportType.label}</h4>
                    <p className="text-xs text-gray-600">{selectedReportType.description}</p>
                  </div>
                </div>
              )}

              {/* Report Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Report Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Enter report title"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none transition-colors"
                  style={{ 
                    borderColor: reportTitle ? brand.colors.primary + '40' : undefined,
                    backgroundColor: reportTitle ? brand.colors.primary + '05' : undefined
                  }}
                />
              </div>

              {/* Report Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Add a description for this report"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none transition-colors resize-none"
                  style={{ 
                    borderColor: reportDescription ? brand.colors.primary + '40' : undefined,
                    backgroundColor: reportDescription ? brand.colors.primary + '05' : undefined
                  }}
                />
              </div>

              {/* Time Period */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Time Period <span className="text-red-500">*</span>
                </label>
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none transition-colors"
                  style={{ 
                    borderColor: brand.colors.primary + '40',
                    backgroundColor: brand.colors.primary + '05'
                  }}
                >
                  {TIME_PERIODS.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Date Range */}
              {timePeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FontAwesomeIcon 
                        icon={faCalendar} 
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none transition-colors"
                        style={{ 
                          borderColor: startDate ? brand.colors.primary + '40' : undefined,
                          backgroundColor: startDate ? brand.colors.primary + '05' : undefined
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FontAwesomeIcon 
                        icon={faCalendar} 
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none transition-colors"
                        style={{ 
                          borderColor: endDate ? brand.colors.primary + '40' : undefined,
                          backgroundColor: endDate ? brand.colors.primary + '05' : undefined
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Report Format */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Output Format
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {REPORT_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setReportFormat(format.id)}
                      className={`p-4 rounded-xl border transition-all ${
                        reportFormat === format.id
                          ? 'shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{
                        borderColor: reportFormat === format.id ? brand.colors.primary : undefined,
                        background: reportFormat === format.id 
                          ? `linear-gradient(135deg, ${brand.colors.primary}10 0%, ${brand.colors.secondary}05 100%)`
                          : undefined
                      }}
                    >
                      <FontAwesomeIcon 
                        icon={format.icon} 
                        className="text-2xl mb-2"
                        style={{ color: reportFormat === format.id ? brand.colors.primary : '#9CA3AF' }}
                      />
                      <p className="text-xs font-medium text-gray-900">{format.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Filters and Options */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Classes Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FontAwesomeIcon icon={faGraduationCap} className="mr-2" />
                  Select Classes (Optional)
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowClassDropdown(!showClassDropdown)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 flex items-center justify-between transition-colors"
                  >
                    <span className="text-gray-700">
                      {selectedClasses.length === 0 
                        ? 'Select classes' 
                        : `${selectedClasses.length} class${selectedClasses.length > 1 ? 'es' : ''} selected`}
                    </span>
                    <FontAwesomeIcon icon={faChevronDown} className="text-gray-400" />
                  </button>
                  {showClassDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-10 max-h-48 overflow-y-auto">
                      {availableClasses.map((cls) => (
                        <button
                          key={cls}
                          onClick={() => toggleClass(cls)}
                          className="w-full px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between transition-colors"
                        >
                          <span className="text-gray-700">Class {cls}</span>
                          {selectedClasses.includes(cls) && (
                            <FontAwesomeIcon 
                              icon={faCheckCircle} 
                              style={{ color: brand.colors.primary }} 
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedClasses.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedClasses.map((cls) => (
                      <span 
                        key={cls}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center space-x-2"
                        style={{ background: brand.gradients.primary }}
                      >
                        <span>Class {cls}</span>
                        <button onClick={() => toggleClass(cls)}>
                          <FontAwesomeIcon icon={faXmark} className="text-white/80 hover:text-white" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Subjects Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FontAwesomeIcon icon={faBook} className="mr-2" />
                  Select Subjects (Optional)
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 flex items-center justify-between transition-colors"
                  >
                    <span className="text-gray-700">
                      {selectedSubjects.length === 0 
                        ? 'Select subjects' 
                        : `${selectedSubjects.length} subject${selectedSubjects.length > 1 ? 's' : ''} selected`}
                    </span>
                    <FontAwesomeIcon icon={faChevronDown} className="text-gray-400" />
                  </button>
                  {showSubjectDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-10 max-h-48 overflow-y-auto">
                      {availableSubjects.map((subject) => (
                        <button
                          key={subject}
                          onClick={() => toggleSubject(subject)}
                          className="w-full px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between transition-colors"
                        >
                          <span className="text-gray-700">{subject}</span>
                          {selectedSubjects.includes(subject) && (
                            <FontAwesomeIcon 
                              icon={faCheckCircle} 
                              style={{ color: brand.colors.primary }} 
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedSubjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedSubjects.map((subject) => (
                      <span 
                        key={subject}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center space-x-2"
                        style={{ background: brand.gradients.primary }}
                      >
                        <span>{subject}</span>
                        <button onClick={() => toggleSubject(subject)}>
                          <FontAwesomeIcon icon={faXmark} className="text-white/80 hover:text-white" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional Options */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <FontAwesomeIcon icon={faSparkles} className="mr-2" />
                  Additional Options
                </label>
                
                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon icon={faChartLine} className="text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">Include Graphs & Charts</p>
                      <p className="text-xs text-gray-600">Visual representation of data</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeGraphs}
                    onChange={(e) => setIncludeGraphs(e.target.checked)}
                    className="w-5 h-5 rounded accent-current"
                    style={{ color: brand.colors.primary }}
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon icon={faFilter} className="text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">Include Comparisons</p>
                      <p className="text-xs text-gray-600">Compare with previous periods</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeComparisons}
                    onChange={(e) => setIncludeComparisons(e.target.checked)}
                    className="w-5 h-5 rounded accent-current"
                    style={{ color: brand.colors.primary }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-8 py-5 border-t-2 border-gray-200 flex items-center justify-between flex-shrink-0 rounded-b-3xl">
          <div className="flex items-center space-x-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-5 py-2.5 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
            
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && !reportType) {
                    alert('Please select a report type');
                    return;
                  }
                  if (step === 2 && !reportTitle) {
                    alert('Please enter a report title');
                    return;
                  }
                  if (step === 2 && timePeriod === 'custom' && (!startDate || !endDate)) {
                    alert('Please select start and end dates');
                    return;
                  }
                  setStep(step + 1);
                }}
                disabled={step === 1 && !reportType}
                className="px-6 py-2.5 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: brand.gradients.primary }}
              >
                <span>Continue</span>
                <FontAwesomeIcon icon={faChevronDown} className="rotate-[-90deg]" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: brand.gradients.primary }}
              >
                <FontAwesomeIcon icon={faCheckCircle} />
                <span>{isSubmitting ? 'Generating...' : 'Generate Report'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}