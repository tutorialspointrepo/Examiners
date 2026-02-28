import { useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft, 
  faChevronDown, 
  faListCheck, 
  faGraduationCap, 
  faTrophy, 
  faFileLines, 
  faClipboardList 
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { firebaseService, type SubjectQuestionStats } from './services/firebase_service';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from './constants';

interface QuestionsProps {
  activeCollegeId?: string;
  onSubjectSelect?: (subject: SubjectQuestionStats | null, questionType: 'all' | 'mcq' | 'fitb' | 'descriptive' | 'jumbled' | 'code' | 'sql' | 'likert') => void;
  selectedSubject?: SubjectQuestionStats | null;
  onCollapse?: () => void;
  refreshTrigger?: number; // Increment this to force reload of question stats
  onCountsChange?: () => Promise<void>;
}

export default function Questions({ activeCollegeId, onSubjectSelect, selectedSubject: externalSelectedSubject, onCollapse, refreshTrigger }: QuestionsProps) {
  const brandTheme = useBrand();
  const [questionFilter, setQuestionFilter] = useState<'all' | 'mcq' | 'fitb' | 'descriptive' | 'jumbled' | 'code' | 'sql' | 'likert'>('all');
  
  // Map filter to question type constant
  const getQuestionType = (filter: typeof questionFilter): string | undefined => {
    if (filter === 'all') return undefined;
    if (filter === 'mcq') return QUESTION_TYPES.MCQ;           // 'mcq'
    if (filter === 'fitb') return QUESTION_TYPES.FITB;         // 'fitb'
    if (filter === 'jumbled') return QUESTION_TYPES.JUMBLED;   // 'jumbled'
    if (filter === 'descriptive') return QUESTION_TYPES.DESCRIPTIVE; // 'descriptive'
    if (filter === 'code') return QUESTION_TYPES.CODE;         // 'code'
    if (filter === 'sql') return QUESTION_TYPES.SQL;           // 'sql'
    if (filter === 'likert') return QUESTION_TYPES.LIKERT;     // 'likert'
    return undefined;
  };
  
  // Get display label for question type
  const getQuestionTypeLabel = (filter: typeof questionFilter): string => {
    if (filter === 'all') return 'All';
    if (filter === 'mcq') return QUESTION_TYPE_LABELS[QUESTION_TYPES.MCQ];
    if (filter === 'fitb') return QUESTION_TYPE_LABELS[QUESTION_TYPES.FITB];
    if (filter === 'jumbled') return QUESTION_TYPE_LABELS[QUESTION_TYPES.JUMBLED];
    if (filter === 'descriptive') return QUESTION_TYPE_LABELS[QUESTION_TYPES.DESCRIPTIVE];
    if (filter === 'code') return QUESTION_TYPE_LABELS[QUESTION_TYPES.CODE];
    if (filter === 'sql') return QUESTION_TYPE_LABELS[QUESTION_TYPES.SQL];
    if (filter === 'likert') return QUESTION_TYPE_LABELS[QUESTION_TYPES.LIKERT];
    return 'All';
  };
  
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [subjectStats, setSubjectStats] = useState<SubjectQuestionStats[]>([]);
  const [allSubjectStats, setAllSubjectStats] = useState<SubjectQuestionStats[]>([]);


  // Refs for click-outside detection
  const classDropdownRef = useRef<HTMLDivElement>(null);
  
  // Classes from Firebase
  const [classes, setClasses] = useState<string[]>(['all']);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch classes from Firebase based on selected college
  useEffect(() => {
    const loadCollegeData = async () => {
      if (!activeCollegeId) {
        setClasses(['all']);
        return;
      }

      try {
        const college = await firebaseService.getCollegeById(activeCollegeId);
        
        if (college) {
          // Load classes
          if (college.validClasses && college.validClasses.length > 0) {
            console.log('📚 Valid Classes from Firebase:', college.validClasses);
            
            // Use classes directly - no normalization needed!
            setClasses(['all', ...college.validClasses]);
          } else {
            setClasses(['all']);
          }
        } else {
          setClasses(['all']);
        }
      } catch (error) {
        console.error('Error loading college data:', error);
        setClasses(['all']);
      }
    };

    loadCollegeData();
  }, [activeCollegeId]);

  // Fetch question statistics from Firebase
  useEffect(() => {
    const loadQuestionStats = async () => {
      if (!activeCollegeId) {
        setSubjectStats([]);
        setAllSubjectStats([]);
        setIsLoadingQuestions(false);
        return;
      }

    try {
        setIsLoadingQuestions(true);
        
        // Use selected class directly - no mapping needed!
        let classValue = undefined;
        if (selectedClass !== 'all') {
          classValue = selectedClass;
        }        
        console.log('🔍 Class Filter Debug:', {
          selectedClass,
          originalClassValue: classValue,
          willFilterByClass: classValue !== undefined
        });
        
        // Get the question type for Firebase query
        const questionType = getQuestionType(questionFilter);
        console.log('🎯 Question Type Filter:', {
          selectedFilter: questionFilter,
          questionType: questionType
        });
        
        // Fetch ALL stats (for filter button counts)
        const allStats = await firebaseService.getSubjectQuestionStats(
          activeCollegeId,
          classValue,
          undefined // Don't filter by board - boards are merged
        );
        setAllSubjectStats(allStats);
        
        // Fetch filtered stats (for displaying subject boxes)
        const stats = await firebaseService.getSubjectQuestionStats(
          activeCollegeId,
          classValue,
          undefined, // Don't filter by board - boards are merged
          questionType // Pass question type constant
        );
        
        console.log('📊 Question Stats Result:', {
          totalSubjects: stats.length,
          firstSubject: stats[0],
          classFilter: classValue
        });
        
        setSubjectStats(stats);
      } catch (error) {
        console.error('Error loading question stats:', error);
        setSubjectStats([]);
        setAllSubjectStats([]);
      } finally {
        setIsLoadingQuestions(false);
      }
    };

    loadQuestionStats();
  }, [activeCollegeId, selectedClass, questionFilter, refreshTrigger]); // Add refreshTrigger to reload when parent signals

  // Auto-select first subject when data changes
  useEffect(() => {
    const filteredStats = subjectStats.filter(subject => {
      if (questionFilter === 'all') return true;
      if (questionFilter === 'mcq') return subject.mcqCount > 0;
      if (questionFilter === 'fitb') return subject.fitbCount > 0;
      if (questionFilter === 'descriptive') return subject.descriptiveCount > 0;
      if (questionFilter === 'jumbled') return subject.jumbledCount > 0;
      if (questionFilter === 'code') return subject.codeCount > 0;
      if (questionFilter === 'sql') return (subject.sqlCount || 0) > 0;
      if (questionFilter === 'likert') return (subject.likertCount || 0) > 0;
      return true;
    });
    
    // Auto-select the first subject when data arrives
    if (filteredStats.length > 0) {
      // If there's a currently selected subject, try to keep it selected
      if (externalSelectedSubject) {
        const currentStillExists = filteredStats.find(
          s => s.subject === externalSelectedSubject.subject
        );
        if (currentStillExists) {
          console.log('🔄 Keeping current subject selected after refresh:', currentStillExists.subject);
          onSubjectSelect?.(currentStillExists, questionFilter);
          return;
        }
      }
      console.log('🔄 Auto-selecting first subject after data load:', filteredStats[0].subject, filteredStats[0].class, questionFilter);
      onSubjectSelect?.(filteredStats[0], questionFilter);
    } else {
      // Clear selection if no subjects available
      console.log('🔄 Clearing selection - no subjects match filters');
      onSubjectSelect?.(null, questionFilter);
    }
  }, [subjectStats]); // Only trigger when subjectStats changes, not when filters change

  // Filter subject stats based on question type filter
  const filteredSubjectStats = subjectStats.filter(subject => {
    if (questionFilter === 'all') return true;
    
    // Only show subjects that have at least one question of the selected type
    if (questionFilter === 'mcq') return subject.mcqCount > 0;
    if (questionFilter === 'fitb') return subject.fitbCount > 0;
    if (questionFilter === 'descriptive') return subject.descriptiveCount > 0;
    if (questionFilter === 'jumbled') return subject.jumbledCount > 0;
    if (questionFilter === 'code') return subject.codeCount > 0;
    if (questionFilter === 'sql') return (subject.sqlCount || 0) > 0;
    if (questionFilter === 'likert') return (subject.likertCount || 0) > 0;
    
    return true;
  });

  // Group filtered subjects by subject name (merge classes)
  const groupedSubjects = useMemo(() => {
    const grouped: Record<string, {
      subject: string;
      classes: string[];
      subjectCode: string;
      totalQuestions: number;
      mcqCount: number;
      fitbCount: number;
      descriptiveCount: number;
      jumbledCount: number;
      codeCount: number;
      sqlCount: number;
      likertCount: number;
      proprietaryQuestions: number;
      easyQuestions: number;
      mediumQuestions: number;
      hardQuestions: number;
      originalStats: SubjectQuestionStats[];
    }> = {};

    filteredSubjectStats.forEach(stat => {
      const key = stat.subject;
      if (!grouped[key]) {
        grouped[key] = {
          subject: stat.subject,
          classes: [],
          subjectCode: stat.subjectCode || '',
          totalQuestions: 0,
          mcqCount: 0,
          fitbCount: 0,
          descriptiveCount: 0,
          jumbledCount: 0,
          codeCount: 0,
          sqlCount: 0,
          likertCount: 0,
          proprietaryQuestions: 0,
          easyQuestions: 0,
          mediumQuestions: 0,
          hardQuestions: 0,
          originalStats: []
        };
      }
      // Split comma-separated class values and deduplicate
      const classValues = stat.class.split(',').map(c => c.trim()).filter(c => c);
      classValues.forEach(cls => {
        if (!grouped[key].classes.includes(cls)) {
          grouped[key].classes.push(cls);
        }
      });
      if (!grouped[key].subjectCode && stat.subjectCode) {
        grouped[key].subjectCode = stat.subjectCode;
      }
      grouped[key].totalQuestions += stat.totalQuestions;
      grouped[key].mcqCount += stat.mcqCount;
      grouped[key].fitbCount += stat.fitbCount;
      grouped[key].descriptiveCount += stat.descriptiveCount;
      grouped[key].jumbledCount += stat.jumbledCount;
      grouped[key].codeCount += stat.codeCount;
      grouped[key].sqlCount += (stat.sqlCount || 0);
      grouped[key].likertCount += (stat.likertCount || 0);
      grouped[key].proprietaryQuestions += (stat.proprietaryQuestions || 0);
      grouped[key].easyQuestions += (stat.easyQuestions || 0);
      grouped[key].mediumQuestions += (stat.mediumQuestions || 0);
      grouped[key].hardQuestions += (stat.hardQuestions || 0);
      grouped[key].originalStats.push(stat);
    });

    return Object.values(grouped);
  }, [filteredSubjectStats]);

  // Calculate total questions for each filter type from ALL stats (not filtered)
  const totalQuestionsByType = {
    all: allSubjectStats.reduce((sum, s) => sum + s.totalQuestions, 0),
    mcq: allSubjectStats.reduce((sum, s) => sum + s.mcqCount, 0),
    fitb: allSubjectStats.reduce((sum, s) => sum + s.fitbCount, 0),
    descriptive: allSubjectStats.reduce((sum, s) => sum + (s.descriptiveCount || 0), 0),
    jumbled: allSubjectStats.reduce((sum, s) => sum + s.jumbledCount, 0),
    code: allSubjectStats.reduce((sum, s) => sum + (s.codeCount || 0), 0),
    sql: allSubjectStats.reduce((sum, s) => sum + (s.sqlCount || 0), 0),
    likert: allSubjectStats.reduce((sum, s) => sum + (s.likertCount || 0), 0)
  };

  return (
    <>
        <div className="sticky top-0 z-[100] bg-white px-6 py-4 pb-3 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <FontAwesomeIcon icon={faListCheck} className="text-gray-900" />
                <h2 className="text-2xl font-bold text-gray-900">Questions</h2>
                {/* Class Dropdown */}
                <div ref={classDropdownRef} className="relative class-dropdown-container z-[999]">
                  <button 
                    onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-colors text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <FontAwesomeIcon icon={faGraduationCap} />
                    <span>{selectedClass === 'all' ? 'Class' : selectedClass}</span>
                    <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isClassDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000]">
                      {classes.map((classItem) => (
                        <button
                          key={classItem}
                          onClick={() => {
                            console.log('🎯 Class Selected:', classItem);
                            setSelectedClass(classItem);
                            setIsClassDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            selectedClass === classItem 
                              ? 'font-medium' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          style={selectedClass === classItem ? {
                            backgroundColor: `${brandTheme.colors.primary}15`,
                            color: brandTheme.colors.primary
                          } : {}}
                        >
                          {classItem === 'all' ? 'All Classes' : classItem}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {onCollapse && (
                <button 
                  onClick={onCollapse}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Collapse"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
              )}
            </div>
          
          {/* Question Type Filter Buttons */}
          <div className="bg-gray-50 -mx-6 px-6 py-4 flex border-t border-gray-200">
            {/* Sticky All Button */}
            <button 
              onClick={() => setQuestionFilter('all')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'all' ? 'text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'all' ? { 
                background: brandTheme.gradients.primary
              } : {}}
            >
              <FontAwesomeIcon icon={faListCheck} />
              <span>All</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.all}</span>
            </button>
            
            {/* Scrollable Container for Other Filters */}
            <div className="flex space-x-2 overflow-x-auto ml-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button 
              onClick={() => setQuestionFilter('descriptive')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'descriptive' ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'descriptive' ? { 
                backgroundColor: `${brandTheme.colors.primary}20`, 
                color: brandTheme.colors.primary 
              } : {}}
            >
              <FontAwesomeIcon icon={faFileLines} />
              <span>Descriptive</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.descriptive}</span>
            </button>
            
            <button 
              onClick={() => setQuestionFilter('code')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'code' ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'code' ? { 
                backgroundColor: `${brandTheme.colors.primary}20`, 
                color: brandTheme.colors.primary 
              } : {}}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>Code</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.code}</span>
            </button>
            
            <button 
              onClick={() => setQuestionFilter('mcq')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'mcq' ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'mcq' ? { 
                backgroundColor: `${brandTheme.colors.primary}20`, 
                color: brandTheme.colors.primary 
              } : {}}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>MCQ</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.mcq}</span>
            </button>
            
            <button 
              onClick={() => setQuestionFilter('jumbled')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'jumbled' ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'jumbled' ? { 
                backgroundColor: `${brandTheme.colors.primary}20`, 
                color: brandTheme.colors.primary 
              } : {}}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span>Jumbled</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.jumbled}</span>
            </button>
            
            <button 
              onClick={() => setQuestionFilter('fitb')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'fitb' ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'fitb' ? { 
                backgroundColor: `${brandTheme.colors.primary}20`, 
                color: brandTheme.colors.primary 
              } : {}}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>FITB</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.fitb}</span>
            </button>
            <button 
              onClick={() => setQuestionFilter('sql')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'sql' ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'sql' ? { 
                backgroundColor: `${brandTheme.colors.primary}20`, 
                color: brandTheme.colors.primary 
              } : {}}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span>SQL</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.sql}</span>
            </button>
            <button 
              onClick={() => setQuestionFilter('likert')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium transition-colors text-xs flex-shrink-0 ${
                questionFilter === 'likert' ? '' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={questionFilter === 'likert' ? { 
                backgroundColor: `${brandTheme.colors.primary}20`, 
                color: brandTheme.colors.primary 
              } : {}}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Likert</span>
              <span className="ml-1 text-xs font-semibold">{totalQuestionsByType.likert}</span>
            </button>
            </div>
          </div>
        </div>
          
         <div className="px-6 pb-6 pt-4"> 
      
        <p className="text-sm text-gray-600 mb-4">
          {groupedSubjects.length} subject{groupedSubjects.length !== 1 ? 's' : ''}
          {questionFilter !== 'all' && ` with ${getQuestionTypeLabel(questionFilter)} questions`}
        </p>

        {isLoadingQuestions ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
              style={{ 
                borderColor: brandTheme.colors.primary + '20',
                borderTopColor: brandTheme.colors.primary
              }}
            />
            <p className="text-gray-600 font-medium">Loading questions...</p>
          </div>
        ) : groupedSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="relative mb-6">
                <FontAwesomeIcon icon={faListCheck} style={{ fontSize: '80px' }} className="text-gray-300" />
                <div className="absolute -top-2 -right-4 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <div className="absolute top-4 -left-6 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                <div className="absolute -bottom-2 right-8 w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
            <p className="text-gray-700 font-semibold text-lg mb-2">
              {questionFilter !== 'all' ? 'No questions found for the selected type' : 'No questions found'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {questionFilter !== 'all' ? 'Try selecting a different question type filter' : 'Looking for questions? Create your first one to get started!'}
            </p>
            {questionFilter !== 'all' && (
              <button
                onClick={() => setQuestionFilter('all')}
                className="px-6 py-2.5 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                style={{ background: brandTheme.gradients.primary }}
              >
                Show All Questions
              </button>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4 pb-20">
          {groupedSubjects.map((group) => {
            // Get the count for the active filter, or total if 'all'
            const displayCount = questionFilter === 'all' ? group.totalQuestions :
                               questionFilter === 'mcq' ? group.mcqCount :
                               questionFilter === 'fitb' ? group.fitbCount :
                               questionFilter === 'descriptive' ? group.descriptiveCount :
                               questionFilter === 'jumbled' ? group.jumbledCount :
                               questionFilter === 'code' ? group.codeCount :
                               questionFilter === 'likert' ? group.likertCount :
                               group.sqlCount;

            // Check if this grouped subject is selected
            const isSelected = externalSelectedSubject?.subject === group.subject;

            return (
            <div 
                key={group.subject} 
                onClick={() => onSubjectSelect?.(group.originalStats[0], questionFilter)}
                className={`rounded-xl shadow-sm border p-5 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'shadow-md' 
                    : 'bg-white border-gray-200 hover:shadow-md'
                }`}
                style={isSelected ? {
                  backgroundColor: `${brandTheme.colors.primary}08`,
                  borderColor: brandTheme.colors.primary
                } : {}}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = brandTheme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {group.subject}{group.likertCount > 0 && group.likertCount === group.totalQuestions ? ' (Likert)' : ''}
                    </h3>
                  </div>
                  <div className="flex-shrink-0 bg-gray-100 px-4 py-2 rounded-lg">
                    <span className="text-sm font-semibold text-gray-700">
                      {group.subjectCode}
                    </span>
                  </div>
                </div>
                
                {/* Info Grid */}
                <div 
                  className={`grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg ${
                    !isSelected ? 'bg-gray-50' : ''
                  }`}
                  style={isSelected ? {
                    backgroundColor: `${brandTheme.colors.primary}15`
                  } : {}}
                >
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faFileLines} className="text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Type</p>
                      <p className="text-sm font-medium text-gray-900">
                        {getQuestionTypeLabel(questionFilter)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faGraduationCap} className="text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Class</p>
                      {group.classes.length === 1 ? (
                        <p className="text-sm font-medium text-gray-900">Class {group.classes[0]}</p>
                      ) : (
                        <div className="relative group/classes">
                          <p className="text-sm font-medium text-gray-900 cursor-default">{group.classes.length} Classes</p>
                          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 z-20 hidden group-hover/classes:block min-w-[140px]">
                            {group.classes.map(cls => (
                              <div key={cls} className="px-3 py-1 text-xs text-gray-700">{cls}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faClipboardList} className="text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Questions</p>
                      <p className="text-sm font-medium text-gray-900">{displayCount} Qs</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faTrophy} className="text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Proprietary</p>
                      <p className="text-sm font-medium text-gray-900">{group.proprietaryQuestions > 0 ? `${group.proprietaryQuestions} Qs` : 'None'}</p>
                    </div>
                  </div>
                </div>

                {/* Complexity Breakdown */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-3">
                    {group.hardQuestions > 0 && (
                      <span className="text-xs font-semibold bg-cyan-100 text-cyan-700 px-2.5 py-1 rounded-md">
                        Complex {group.hardQuestions}
                      </span>
                    )}
                    {group.mediumQuestions > 0 && (
                      <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-md">
                        Medium {group.mediumQuestions}
                      </span>
                    )}
                    {group.easyQuestions > 0 && (
                      <span className="text-xs font-semibold bg-pink-100 text-pink-700 px-2.5 py-1 rounded-md">
                        Easy {group.easyQuestions}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSubjectSelect?.(group.originalStats[0], questionFilter);
                      }}
                      className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{ color: brandTheme.colors.primary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
          </div>

    </>
  );
}