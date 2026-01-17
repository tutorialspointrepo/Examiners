/**
 * StudentExamDetail Component
 * 
 * Displays detailed view of a student's exam attempt with:
 * - Question-wise performance breakdown
 * - Type-specific answer display (MCQ, Code, Descriptive, etc.)
 * - Test case results for code questions
 * - AI feedback and plagiarism detection for descriptive questions
 * - Violation tracking and re-evaluation capabilities
 * 
 * Uses centralized constants from constants.ts:
 * - QUESTION_TYPES: Standard question type identifiers
 * - EVALUATION_STATUS: Evaluation state tracking
 * - COMPLEXITY_LEVELS: Question difficulty levels
 * - QUESTION_TYPE_LABELS: Display labels for question types
 * 
 * Formatting matches QuestionList.tsx for consistency
 */

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft,
  faChevronRight,
  faClock,
  faAward,
  faExclamationTriangle,
  faQuestionCircle,
  faClipboardList,
  faChartLine,
  faArrowRotateRight,
  faTimes,
  faCode,
  faImage,
  faCopy,
  faCheck,
  faGripVertical,
  faLayerGroup,
  faBook,
  faTrophy,
  faCheckCircle,
  faChartBar,
  faPercentage,
  faChevronDown,
  faChevronUp,
  faInfoCircle,
  faEye,
  faArrowsRotate,
  faExpand,
  faClipboard,
  faThumbTack,
  faScissors,
  faComputer,
  faCamera,
  faScrewdriverWrench,
  faLaptopCode,
  faTowerBroadcast,
  faClockRotateLeft,
  faKeyboard,
  faRightLeft,
  faMagnifyingGlass,
  faWrench,
  faPrint,
  faFloppyDisk,
  faTriangleExclamation,
  faPlay
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { 
  EVALUATION_STATUS, 
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  COMPLEXITY_LEVELS,
  COMPLEXITY_LABELS,
  VIOLATION_DESCRIPTIONS,
  type ViolationType
} from './constants';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface StudentExamDetailProps {
  exam: any;
  student: any;
  brandTheme: any;
  onBack: () => void;
  currentUserType?: string;
}

interface MergedQuestion {
  questionNo: number;
  questionId?: string;
  questionText?: string;
  questionType: string;
  maxMarks: number;
  complexity?: string;
  pool?: boolean;  // ✅ ADDED: Indicates if question is from pool
  isAnswered: boolean;
  studentAnswer?: any;
  scoredMarks: number;
  marksAwarded?: number;
  timeSpent: number;
  attemptCount?: number;
  revisitCount?: number;
  violations?: any[];
  evaluationStatus: string;
  markedForReview?: boolean;
  options?: any[];
  correctAnswer?: any;
  correctAnswers?: any;
  answerText?: string;
  imageUrl?: string;
  ocrText?: string;
  feedback?: {
      correctPoints: string[];
      improvements: string[];
      answerLength: number;
      answerLengthScore: number;
      relevancyScore: number;
      accuracyScore: number;
      completenessScore: number;
      plagiarismScore: number;
      isPlagiarized: boolean;
      plagiarismIndicators: string[];
  };
  codeAIFeedback?: {
    testsPassed: number;
    testsTotal: number;
    allTestsPassed: boolean;
    severityLevel: 'success' | 'partial' | 'critical';
    codeQuality: number;
    readabilityScore: number;
    efficiencyScore: number;
    correctnessScore: number;
    timeComplexity: string;
    spaceComplexity: string;
    correctPoints: string[];
    improvements: string[];
    failedTestAnalysis: Array<{
      testNumber: number;
      issue: string;
      fix: string;
    }>;
    hasSuggestedCode: boolean;
    suggestedCode: string;
    codeExplanation: string;
  };
  codeSubmitted?: string;
  code?: string;
  language?: string;
  testCases?: any[];
  hint?: string;
  testCaseResults?: any[];
  codeExecution?: any;
  passedTestCases?: number;
  testCaseMarks?: number;
  averageExecutionTime?: number;
  totalExecutionTime?: number;
  responseId?: string;
  evaluationRetries?: number;
  lastEvaluationAttempt?: any;
}

interface ChapterPerformance {
  attempted: number;
  maxScore: number;
  score: number;
}

export default function StudentExamDetail({ exam, student, brandTheme, onBack, currentUserType }: StudentExamDetailProps) {
  const [attemptData, setAttemptData] = useState<any>(null);
  const [fullAttempt, setFullAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [reEvalMessage, setReEvalMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [stuckQuestionsToRetry, setStuckQuestionsToRetry] = useState<any[]>([]);
  const [mergedQuestions, setMergedQuestions] = useState<MergedQuestion[]>([]);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [selectedViolations, setSelectedViolations] = useState<any[]>([]);
  const [selectedQuestionNo, setSelectedQuestionNo] = useState<number>(0);
  const [violationsCurrentPage, setViolationsCurrentPage] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [isChapterAnalysisExpanded, setIsChapterAnalysisExpanded] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState<{ url: string; type: 'video' | 'image' } | null>(null);
  const hasLoggedView = useRef(false); // Track if we've logged this view
  
  const VIOLATIONS_PER_PAGE = 25;

  // Helper function to get violation icon
  const getViolationIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'WINDOW_BLUR': faEye,
      'TAB_SWITCH': faArrowsRotate,
      'WINDOW_MINIMIZE': faChevronDown,
      'FULLSCREEN_EXIT': faExpand,
      'COPY_ATTEMPT': faClipboard,
      'PASTE_ATTEMPT': faThumbTack,
      'CUT_ATTEMPT': faScissors,
      'RIGHT_CLICK': faComputer,
      'PRINT_SCREEN': faCamera,
      'SCREENSHOT_ATTEMPT': faCamera,
      'DEVTOOLS_OPEN': faScrewdriverWrench,
      'CONSOLE_OPEN': faLaptopCode,
      'MULTIPLE_TABS': faCopy,
      'NETWORK_DISCONNECT': faTowerBroadcast,
      'TIME_MANIPULATION': faClockRotateLeft,
      'SHORTCUT_CTRLC': faKeyboard,
      'SHORTCUT_CTRLV': faKeyboard,
      'SHORTCUT_CTRLX': faKeyboard,
      'SHORTCUT_CTRLA': faKeyboard,
      'SHORTCUT_ALTTAB': faRightLeft,
      'SHORTCUT_CTRLSHIFTC': faMagnifyingGlass,
      'SHORTCUT_F12': faWrench,
      'SHORTCUT_CTRLP': faPrint,
      'SHORTCUT_CTRLS': faFloppyDisk,
      'SHORTCUT_DEVTOOLS': faScrewdriverWrench,
      'NO_FACE_DETECTED': faCamera,
      'FACE_MISMATCH': faCamera,
      'HEAD_TURNED': faEye,
      'MULTIPLE_FACES': faCamera
    };
    return iconMap[type] || faTriangleExclamation;
  };

  // Helper function to get violation label
  const getViolationLabel = (type: string) => {
    return VIOLATION_DESCRIPTIONS[type as ViolationType] || type.replace(/_/g, ' ');
  };

  useEffect(() => {
    const loadAttemptData = async () => {
      console.log('📊 [STUDENT_EXAM_DETAIL] Loading attempt data for student:', student?.studentName);
      console.log('📊 [STUDENT_EXAM_DETAIL] Student object:', student);
      console.log('📊 [STUDENT_EXAM_DETAIL] Exam object:', exam?.id);
      
      if (student?.attemptData) {
        console.log('✅ [STUDENT_EXAM_DETAIL] Student has attemptData');
        setAttemptData(student.attemptData);
        
        if (student.attemptData.responses && student.attemptData.responses.length > 0) {
          console.log('✅ [STUDENT_EXAM_DETAIL] Setting full attempt with responses');
          setFullAttempt(student.attemptData);
          mergeQuestionsWithResponses(student.attemptData);
        } else if (student.attemptData.attemptId) {
          console.log('📥 [STUDENT_EXAM_DETAIL] Fetching full attempt data from attemptId');
          try {
            const fullData = await firebaseService.getStudentAttempt(student.attemptData.attemptId);
            setFullAttempt(fullData);
            mergeQuestionsWithResponses(fullData);
          } catch (error) {
            console.error('❌ [STUDENT_EXAM_DETAIL] Error fetching attempt:', error);
            // Even if fetch fails, still set attemptData so component renders
            setAttemptData(student.attemptData);
          }
        } else {
          console.log('⚠️ [STUDENT_EXAM_DETAIL] attemptData exists but no responses or attemptId');
          // Student was present but didn't attempt - still valid state
          setAttemptData(student.attemptData);
        }
      } else {
        console.log('⚠️ [STUDENT_EXAM_DETAIL] No attemptData - student may not have been present');
        // Set a minimal attemptData object so component still renders
        setAttemptData({
          studentId: student?.studentId,
          examId: exam?.id,
          attemptedQuestions: 0,
          obtainedMarks: 0,
          timeSpent: 0,
          violationCount: 0
        });
      }
      
      if (!hasLoggedView.current) {
        hasLoggedView.current = true; // Mark as logged
        (async () => {
          try {
            const currentUser = await firebaseService.getCurrentUserProfile();
            if (currentUser && exam && student) {
              // Try multiple fields for roll number
              const rollNumber = student.studentRoll || student.rollNumber || student.roll || student.studentRollNumber || 'N/A';
              
              await firebaseService.addActivityLog({
                userId: currentUser.userId,
                collegeId: exam.collegeId || currentUser.collegeId,
                action: 'view_student_exam_detail',
                entityType: 'answer_sheet',
                entityId: `${exam.id}_${student.studentId}`,
                details: JSON.stringify({
                  examTitle: exam.title,
                  studentName: student.studentName || student.fullName || 'Unknown',
                  studentRoll: rollNumber,
                  studentClass: student.studentClass || student.class || 'N/A',
                  score: student.attemptData?.obtainedMarks || 0,
                  totalMarks: exam.maxMarks || 0
                })
              });
            }
          } catch (logError) {
            console.warn('⚠️ Failed to log student exam detail view:', logError);
          }
        })();
      }
      
      setLoading(false);
    };
    
    loadAttemptData();
  }, [student, exam]);

  const mergeQuestionsWithResponses = (attempt: any) => {
    // Start with questions from questionsList (regular questions everyone gets)
    const allQuestions: any[] = [];
    
    if (exam?.questionsList && Array.isArray(exam.questionsList)) {
      allQuestions.push(...exam.questionsList);
    }
    
    // Get questionIds from questionsList to identify pool questions
    const questionListIds = new Set(
      allQuestions.map(q => q.id || q.questionId).filter(Boolean)
    );
    
    // Get student's responses
    let responsesArray: any[] = [];
    if (attempt?.responses) {
      responsesArray = Array.isArray(attempt.responses) ? attempt.responses : Object.values(attempt.responses);
    }
    
    // For each response, if it's a pool question (not in questionsList), add it from questionPool
    if (exam?.questionPool && Array.isArray(exam.questionPool)) {
      responsesArray.forEach((response: any) => {
        const questionId = response.questionId;
        
        // If this question is NOT in questionsList, it must be from the pool
        if (questionId && !questionListIds.has(questionId)) {
          // Find the full question data from questionPool
          const poolQuestion = exam.questionPool.find((q: any) => 
            (q.id === questionId || q.questionId === questionId)
          );
          
          if (poolQuestion) {
            allQuestions.push(poolQuestion);
          }
        }
      });
    }
    
    // If no questions at all, set empty array
    if (allQuestions.length === 0) {
      setMergedQuestions([]);
      return;
    }

    const responsesById: { [key: string]: any } = {};
    const responsesByNo: { [key: number]: any } = {};
    
    responsesArray.forEach((response: any) => {
      if (response.questionId) {
        responsesById[response.questionId] = response;
      }
      if (response.questionNo !== undefined) {
        responsesByNo[response.questionNo] = response;
      }
    });

    const merged: MergedQuestion[] = allQuestions.map((question: any, idx: number) => {
      let response = responsesById[question.id] || responsesById[question.questionId];
      if (!response && question.questionNo !== undefined) {
        response = responsesByNo[question.questionNo];
      }
      
      const questionType = (response?.questionType || question.type || question.questionType || '').toLowerCase();
      
      if (!response) {
        return {
          questionNo: question.questionNo || idx + 1,
          questionId: question.id || question.questionId,
          questionText: question.questionText || question.question,
          questionType: question.type || question.questionType || 'text',
          maxMarks: question.maximumMarks || question.marks || 0,
          complexity: question.complexity || question.difficulty,
          correctAnswers: question.correctAnswers,
          correctAnswer: question.correctAnswers || question.correctAnswer,
          options: question.options,
          hint: question.hint,
          testCases: question.testCases,
          isAnswered: false,
          studentAnswer: null,
          scoredMarks: 0,
          marksAwarded: 0,
          timeSpent: 0,
          attemptCount: 0,
          revisitCount: 0,
          violations: [],
          evaluationStatus: EVALUATION_STATUS.PENDING
        };
      }

      const baseData = {
        questionNo: response.questionNo || question.questionNo || idx + 1,
        questionId: response.questionId || question.id,
        questionText: response.questionText || question.questionText || question.question,
        questionType: response.questionType || question.type,
        maxMarks: response.maxMarks || question.maximumMarks || question.marks || 0,
        complexity: response.complexity || question.complexity,
        pool: response.pool || false,  // ✅ ADDED: Include pool field from response
        isAnswered: !!(response.studentAnswer !== undefined && response.studentAnswer !== null && response.studentAnswer !== '' && !(Array.isArray(response.studentAnswer) && response.studentAnswer.length === 0)),
        studentAnswer: response.studentAnswer,
        scoredMarks: response.marksAwarded || response.scoredMarks || 0,
        marksAwarded: response.marksAwarded || 0,
        timeSpent: response.timeSpent || 0,
        attemptCount: response.attemptCount || 0,
        revisitCount: response.revisitCount || 0,
        violations: response.violations || [],
        evaluationStatus: response.evaluationStatus || EVALUATION_STATUS.PENDING,
        markedForReview: response.markedForReview || false,
        responseId: response.responseId,
        evaluationRetries: response.evaluationRetries || 0,
        lastEvaluationAttempt: response.lastEvaluationAttempt
      };

      let typeSpecific: any = {};

      switch (questionType) {
        case QUESTION_TYPES.MCQ:
          typeSpecific = {
            options: response.options || question.options || [],
            correctAnswers: response.correctAnswers || question.correctAnswers,
            correctAnswer: response.correctAnswers || question.correctAnswers || question.correctAnswer,
            hint: question.hint
          };
          break;
        case QUESTION_TYPES.FITB:
          typeSpecific = {
            correctAnswers: response.correctAnswers || question.correctAnswers,
            correctAnswer: response.correctAnswers || question.correctAnswers,
            hint: question.hint
          };
          break;
        case QUESTION_TYPES.JUMBLED:
          typeSpecific = {
            options: response.options || question.options || [],
            correctAnswers: response.correctAnswers || question.correctAnswers,
            correctAnswer: response.correctAnswers || question.correctAnswers,
            hint: question.hint
          };
          break;
        case QUESTION_TYPES.DESCRIPTIVE:
          typeSpecific = {
            correctAnswers: response.correctAnswers || question.correctAnswers,
            correctAnswer: response.correctAnswers || question.correctAnswers || question.correctAnswer,
            answerText: response.answerText || response.studentAnswer,
            imageUrl: response.imageUrl,
            ocrText: response.ocrText,
            feedback: response.aiFeedback || null,
            hint: question.hint
          };
          break;
        case QUESTION_TYPES.CODE:
          // Extract test case data from codeExecution object
          const codeExecution = response.codeExecution || {};
          const testCaseResults = codeExecution.testCaseResults || response.testCaseResults || [];
          const passedTestCases = codeExecution.passedTestCases ?? response.passedTestCases ?? 
            testCaseResults.filter((tc: any) => tc.passed === true).length;
          const testCaseMarks = codeExecution.testCaseMarks ?? response.testCaseMarks ?? 
            testCaseResults.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0);
          
          typeSpecific = {
            codeSubmitted: response.codeSubmitted || response.code || response.studentAnswer,
            code: response.code || response.codeSubmitted,
            language: response.language || question.programmingLanguage || question.programming_language,
            testCases: question.testCases || [],
            hint: question.hint,
            testCaseResults: testCaseResults,
            codeExecution: codeExecution,
            passedTestCases: passedTestCases,
            testCaseMarks: testCaseMarks,
            averageExecutionTime: codeExecution.averageExecutionTime || response.averageExecutionTime || 0,
            totalExecutionTime: codeExecution.totalExecutionTime || 0,
            correctAnswers: response.correctAnswers || question.correctAnswers,
            correctAnswer: response.correctAnswers || question.correctAnswers,
            codeAIFeedback: response.codeAIFeedback || response.aiFeedback || null,
          };
          break;
        default:
          typeSpecific = { answerText: response.answerText || response.studentAnswer };
      }

      return { ...baseData, ...typeSpecific } as MergedQuestion;
    });

    merged.sort((a, b) => a.questionNo - b.questionNo);
    setMergedQuestions(merged);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Helper function to get performance grade
  const getPerformanceGrade = (percentage: number): { grade: string; color: string; bgColor: string } => {
    if (percentage >= 90) return { grade: 'A+', color: '#10b981', bgColor: '#d1fae5' };
    if (percentage >= 80) return { grade: 'A', color: '#22c55e', bgColor: '#dcfce7' };
    if (percentage >= 70) return { grade: 'B+', color: '#84cc16', bgColor: '#ecfccb' };
    if (percentage >= 60) return { grade: 'B', color: '#eab308', bgColor: '#fef9c3' };
    if (percentage >= 50) return { grade: 'C', color: '#f59e0b', bgColor: '#fed7aa' };
    if (percentage >= 40) return { grade: 'D', color: '#f97316', bgColor: '#fed7aa' };
    return { grade: 'F', color: '#ef4444', bgColor: '#fecaca' };
  };

  // Helper function to get chapter theme color
  const getChapterThemeColor = (index: number): { bg: string; border: string; accent: string } => {
    const themes = [
      { bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '#bfdbfe', accent: '#3b82f6' }, // Blue
      { bg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: '#e9d5ff', accent: '#a855f7' }, // Purple
      { bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '#a7f3d0', accent: '#10b981' }, // Green
      { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#fde047', accent: '#eab308' }, // Yellow
      { bg: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)', border: '#fda4af', accent: '#f43f5e' }, // Rose
      { bg: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', border: '#99f6e4', accent: '#14b8a6' }, // Teal
      { bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', border: '#fecaca', accent: '#ef4444' }, // Red
      { bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '#fed7aa', accent: '#f97316' }, // Orange
      { bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '#ddd6fe', accent: '#8b5cf6' }, // Violet
      { bg: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)', border: '#f5d0fe', accent: '#d946ef' }, // Fuchsia
    ];
    return themes[index % themes.length];
  };

  const getComplexityStyle = (complexity?: string) => {
    if (!complexity) return { className: 'bg-gray-100 text-gray-700', label: 'N/A' };
    
    const normalizedComplexity = complexity.toLowerCase();
    
    if (normalizedComplexity === COMPLEXITY_LEVELS.EASY) {
      return { className: 'bg-green-100 text-green-700', label: COMPLEXITY_LABELS.easy };
    } else if (normalizedComplexity === COMPLEXITY_LEVELS.MEDIUM) {
      return { className: 'bg-yellow-100 text-yellow-700', label: COMPLEXITY_LABELS.medium };
    } else if (normalizedComplexity === COMPLEXITY_LEVELS.HARD) {
      return { className: 'bg-cyan-100 text-cyan-700', label: COMPLEXITY_LABELS.hard };
    }
    
    return { className: 'bg-gray-100 text-gray-700', label: complexity };
  };

  const isQuestionType = (questionType: string | undefined, type: string) => {
    if (!questionType) return false;
    const normalized = questionType.toLowerCase().replace(/[-_\s]/g, '');
    const targetType = type.toLowerCase().replace(/[-_\s]/g, '');
    return normalized === targetType || normalized === targetType.replace('choice', '');
  };

  const isQuestionFromPool = (questionId: string | undefined): boolean => {
    if (!questionId || !exam?.questionPool || !Array.isArray(exam.questionPool)) {
      return false;
    }
    return exam.questionPool.some((q: any) => q.id === questionId || q.questionId === questionId);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };
/* 
  const safeRender = (text: string): string => {
    if (!text) return '';
    return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }; */

  const containsHTML = (text: string): boolean => {
    if (!text) return false;
    return /<[^>]+>/.test(text);
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    try {
      let date: Date;
      
      // Handle Firestore Timestamp object
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // Handle Date object
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      // Handle timestamp number (milliseconds)
      else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      // Handle object with seconds and nanoseconds (Firestore format)
      else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
        date = new Date(timestamp.seconds * 1000);
      }
      // Handle string formats
      else if (typeof timestamp === 'string') {
        // ✅ FIXED: Handle "YYYY-MM-DD HH:MM:SS IST" format from violations
        if (timestamp.includes('IST') || timestamp.includes('UTC') || timestamp.includes('GMT')) {
          // Remove timezone suffix and parse
          const cleanTimestamp = timestamp.replace(/\s+(IST|UTC|GMT)$/i, '').trim();
          date = new Date(cleanTimestamp);
        } else {
          date = new Date(timestamp);
        }
      }
      // Handle empty objects
      else if (timestamp && typeof timestamp === 'object' && Object.keys(timestamp).length === 0) {
        return 'N/A';
      }
      else {
        return 'Invalid Date';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      // Format as: "Dec 4, 2025, 8:41:37 PM"
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid Date';
    }
  };

  const detectLanguage = (code: string, questionLanguage?: string): string => {
    if (questionLanguage) {
      return questionLanguage.toLowerCase();
    }
    
    if (code.includes('def ') || code.includes('import numpy') || code.includes('print(')) {
      return 'python';
    }
    if (code.includes('function ') || code.includes('const ') || code.includes('let ') || code.includes('=>')) {
      return 'javascript';
    }
    if (code.includes('public class') || code.includes('public static void') || code.includes('System.out')) {
      return 'java';
    }
    if (code.includes('#include') || code.includes('int main()')) {
      return 'cpp';
    }
    if (code.includes('SELECT') || code.includes('FROM') || code.includes('WHERE')) {
      return 'sql';
    }
    
    return 'java';
  };

  const processHTMLWithCode = (html: string, questionId: string) => {
    const parts = html.split(/(<code>.*?<\/code>)/gs);
    
    return parts.map((part, index) => {
      const codeMatch = part.match(/<code>(.*?)<\/code>/s);
      
      if (codeMatch) {
        const codeContent = codeMatch[1];
        const codeId = `code-${questionId}-${index}`;
        const language = detectLanguage(codeContent);
        
        return (
          <div key={index} className="relative rounded-lg overflow-hidden my-3">
            <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <button
                onClick={() => copyToClipboard(codeContent, codeId)}
                className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                title="Copy to clipboard"
              >
                {copiedCode === codeId ? (
                  <FontAwesomeIcon icon={faCheck} className="text-sm" />
                ) : (
                  <FontAwesomeIcon icon={faCopy} className="text-sm" />
                )}
              </button>
            </div>
            <div className="pt-10">
              <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  borderBottomLeftRadius: '0.5rem',
                  borderBottomRightRadius: '0.5rem',
                  fontSize: '0.875rem',
                  padding: '1rem',
                  paddingTop: '0.5rem'
                }}
                showLineNumbers={false}
              >
                {codeContent}
              </SyntaxHighlighter>
            </div>
          </div>
        );
      }
      
      return (
        <div
          key={index}
          className="prose prose-sm max-w-none
            [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-3 [&>h1]:mt-2
            [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-2 [&>h2]:mt-2
            [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-2 [&>h3]:mt-2
            [&>p]:text-base [&>p]:text-gray-800 [&>p]:mb-2 [&>p]:leading-relaxed
            [&_strong]:font-bold [&_strong]:text-gray-900
            [&_br]:block [&_br]:mb-2
            [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2
            [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2
            [&_li]:mb-1
            [&_.katex]:text-sm [&_.katex]:inline-block
            [&>pre:empty]:hidden [&>pre:empty]:opacity-0 [&>pre:empty]:h-0 [&>pre:empty]:m-0 [&>pre:empty]:p-0"
          dangerouslySetInnerHTML={{ __html: part }}
        />
      );
    });
  };

  const getStats = () => {
    const attempt = fullAttempt || attemptData;
    
    // Use exam's totalQuestions if available, otherwise use mergedQuestions length
    const totalQuestions = exam?.totalQuestions || exam?.numberOfQuestions || mergedQuestions.length || attempt?.totalQuestions || 0;
    
    // Calculate actual violation count from mergedQuestions to match modal
    const actualViolationCount = mergedQuestions.reduce((total, question) => {
      return total + (question.violations?.length || 0);
    }, 0);
    
    // ✅ Calculate total time spent by summing individual question times (same as violations)
    const calculatedTimeSpent = mergedQuestions.reduce((total, question) => {
      return total + (question.timeSpent || 0);
    }, 0);
    
    if (!attempt) {
      return {
        totalQuestions: totalQuestions,
        attemptedQuestions: 0,
        totalMarks: parseInt(exam?.maxMarks || '0') || 0,
        obtainedMarks: 0,
        totalTimeSpent: calculatedTimeSpent,
        violationCount: actualViolationCount
      };
    }
    return {
      totalQuestions: totalQuestions,
      attemptedQuestions: attempt.attemptedQuestions || 0,
      totalMarks: parseInt(exam?.maxMarks || '0') || attempt.totalScore || 0,
      obtainedMarks: attempt.obtainedMarks || 0,
      totalTimeSpent: calculatedTimeSpent,  // ✅ Sum from responses (like violations)
      violationCount: actualViolationCount
    };
  };

  const hasPendingEvaluations = () => {
    return mergedQuestions.some(q => q.isAnswered && (q.evaluationStatus === EVALUATION_STATUS.PENDING || q.evaluationStatus === EVALUATION_STATUS.EVALUATING || q.evaluationStatus === EVALUATION_STATUS.FAILED));
  };

  const handleReEvaluateStuck = async () => {
    if (!fullAttempt || !mergedQuestions) {
      setReEvalMessage('❌ No data available');
      return;
    }
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const stuckResponses = mergedQuestions.filter((question: MergedQuestion) => {
      if (!question.isAnswered) return false;
      const isStuckStatus = question.evaluationStatus === EVALUATION_STATUS.PENDING || question.evaluationStatus === EVALUATION_STATUS.EVALUATING || question.evaluationStatus === EVALUATION_STATUS.FAILED;
      if (!isStuckStatus) return false;
      if (question.lastEvaluationAttempt) {
        const lastAttempt = question.lastEvaluationAttempt.toDate ? question.lastEvaluationAttempt.toDate() : new Date(question.lastEvaluationAttempt);
        return lastAttempt < tenMinutesAgo;
      }
      return true;
    });
    if (stuckResponses.length === 0) {
      setReEvalMessage('✅ No stuck evaluations found');
      setTimeout(() => setReEvalMessage(''), 3000);
      return;
    }
    setStuckQuestionsToRetry(stuckResponses);
    setShowConfirmModal(true);
  };

  const handleConfirmReEvaluate = async () => {
    setShowConfirmModal(false);
    setReEvaluating(true);
    setReEvalMessage(`🔄 Re-evaluating ${stuckQuestionsToRetry.length} question(s)...`);
    let successCount = 0;
    let failCount = 0;
    for (const question of stuckQuestionsToRetry) {
      try {
        const result = await firebaseService.retriggerEvaluation(fullAttempt.attemptId, question.questionNo);
        if (result.success) successCount++; else failCount++;
      } catch (error) {
        failCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setReEvaluating(false);
    setReEvalMessage(`✅ Complete: ${successCount} succeeded, ${failCount} failed`);
    setTimeout(async () => {
      try {
        if (student?.attemptData?.attemptId) {
          const refreshedData = await firebaseService.getStudentAttempt(student.attemptData.attemptId);
          setFullAttempt(refreshedData);
          mergeQuestionsWithResponses(refreshedData);
          setReEvalMessage('✅ Data refreshed!');
        }
      } catch (error) {
        setReEvalMessage('⚠️ Refresh manually');
      }
      setTimeout(() => setReEvalMessage(''), 3000);
    }, 2000);
  };

  const handleShowViolations = (violations: any[], questionNo: number) => {
    setSelectedViolations(violations);
    setSelectedQuestionNo(questionNo);
    setShowViolationsModal(true);
  };

  const handleShowAllViolations = () => {
    // Collect all violations from all questions with question number info
    const allViolations: any[] = [];
    mergedQuestions.forEach((question: MergedQuestion, index: number) => {
      if (question.violations && question.violations.length > 0) {
        question.violations.forEach((violation: any) => {
          allViolations.push({
            ...violation,
            questionNo: index + 1,
            questionText: question.questionText
          });
        });
      }
    });
    
    if (allViolations.length > 0) {
      setSelectedViolations(allViolations);
      setSelectedQuestionNo(0); // 0 means "all violations"
      setShowViolationsModal(true);
    }
  };

  // Render chapter analysis section
  const renderChapterAnalysis = () => {
    if (!fullAttempt?.performanceByChapter) {
      return null;
    }

    const chapters = Object.entries(fullAttempt.performanceByChapter) as [string, ChapterPerformance][];
    
    if (chapters.length === 0) {
      return null;
    }

    return (
      <div className="px-6 mb-6">
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #a8c1ffff' }}>
          {/* Header with Toggle Button */}
          <div 
            className="px-6 py-5 border-b border-gray-100"
            style={{ 
              background: `linear-gradient(135deg, ${brandTheme.colors.primary}05 0%, ${brandTheme.colors.primary}02 100%)`
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ 
                    backgroundColor: `${brandTheme.colors.primary}15`,
                    border: `2px solid ${brandTheme.colors.primary}30`
                  }}
                >
                  <FontAwesomeIcon 
                    icon={faBook} 
                    className="text-xl" 
                    style={{ color: brandTheme.colors.primary }} 
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Chapter-wise Performance</h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Detailed analysis across {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
                  </p>
                </div>
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => setIsChapterAnalysisExpanded(!isChapterAnalysisExpanded)}
                className="group flex items-center justify-center p-2.5 rounded-xl transition-all duration-300 hover:shadow-md w-10 h-10"
                style={{
                  backgroundColor: `${brandTheme.colors.primary}10`,
                  border: `1.5px solid ${brandTheme.colors.primary}30`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}20`;
                  e.currentTarget.style.borderColor = `${brandTheme.colors.primary}50`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                  e.currentTarget.style.borderColor = `${brandTheme.colors.primary}30`;
                }}
                title={isChapterAnalysisExpanded ? 'Collapse section' : 'Expand section'}
              >
                <FontAwesomeIcon 
                  icon={isChapterAnalysisExpanded ? faChevronUp : faChevronDown}
                  className="text-base transition-transform duration-300"
                  style={{ color: brandTheme.colors.primary }}
                />
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{
              maxHeight: isChapterAnalysisExpanded ? '3000px' : '0',
              opacity: isChapterAnalysisExpanded ? 1 : 0
            }}
          >
            {/* Chapter Strips - Horizontal Rows */}
            <div className="p-6">
              <div className="space-y-3">
                {chapters.map(([chapterName, performance], index) => {
                  const percentage = performance.maxScore > 0 
                    ? Math.round((performance.score / performance.maxScore) * 100)
                    : 0;
                  const gradeInfo = getPerformanceGrade(percentage);
                  const themeColor = getChapterThemeColor(index);

                  return (
                    <div
                      key={chapterName}
                      className="group relative rounded-xl p-4 hover:shadow-md transition-all duration-300"
                      style={{
                        backgroundColor: `${themeColor.accent}08`,
                        animationDelay: `${index * 50}ms`,
                        animation: isChapterAnalysisExpanded ? 'fadeInUp 0.5s ease-out forwards' : 'none',
                        opacity: isChapterAnalysisExpanded ? 0 : 1
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {/* Left Section: Chapter Info & Grade */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Grade Badge - Clickable */}
                          <button
                            onClick={() => setShowGradeModal(true)}
                            className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm flex-shrink-0 transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer"
                            style={{ 
                              backgroundColor: `${themeColor.accent}15`,
                              color: themeColor.accent
                            }}
                            title="Click to view grade criteria"
                          >
                            {gradeInfo.grade}
                          </button>

                          {/* Chapter Name & Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-1 h-8 rounded-full"
                                style={{ backgroundColor: themeColor.accent }}
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base font-bold text-gray-900 truncate group-hover:text-gray-700 transition-colors">
                                  {chapterName}
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {performance.attempted} {performance.attempted === 1 ? 'question' : 'questions'} attempted
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Middle Section: Score Display */}
                        <div className="flex items-center gap-6 flex-shrink-0">
                          {/* Marks */}
                          <div className="text-center">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-gray-900">
                                {performance.score.toFixed(2)}
                              </span>
                              <span className="text-sm text-gray-500">/ {performance.maxScore}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">Marks</p>
                          </div>

                          {/* Percentage */}
                          <div className="text-center">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${gradeInfo.color}15` }}>
                              <FontAwesomeIcon icon={faPercentage} className="text-xs" style={{ color: gradeInfo.color }} />
                              <span className="text-xl font-bold" style={{ color: gradeInfo.color }}>
                                {percentage}%
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">Percentage</p>
                          </div>
                        </div>

                        {/* Right Section: Progress Bar & Status */}
                        <div className="flex-1 min-w-[200px] max-w-[300px]">
                          {/* Progress Bar */}
                          <div className="mb-2">
                            <div 
                              className="relative w-full h-3 rounded-full overflow-hidden"
                              style={{ 
                                backgroundColor: `${themeColor.accent}15`
                              }}
                            >
                              <div
                                className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${percentage}%`,
                                  background: `linear-gradient(90deg, ${gradeInfo.color} 0%, ${gradeInfo.color}cc 100%)`,
                                  boxShadow: `0 0 10px ${gradeInfo.color}30`
                                }}
                              />
                            </div>
                          </div>

                          {/* Status & Points */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <FontAwesomeIcon 
                                icon={performance.score === performance.maxScore ? faCheckCircle : faChartBar} 
                                className="text-xs"
                                style={{ color: performance.score === performance.maxScore ? gradeInfo.color : themeColor.accent }}
                              />
                              <span className="text-xs font-medium text-gray-600">
                                {performance.score === performance.maxScore ? 'Perfect!' : 'In Progress'}
                              </span>
                            </div>
                            {performance.score > 0 && (
                              <div className="flex items-center gap-1">
                                <FontAwesomeIcon icon={faTrophy} className="text-xs" style={{ color: gradeInfo.color }} />
                                <span className="text-xs font-semibold" style={{ color: gradeInfo.color }}>
                                  {performance.score} pts
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Subtle Hover Effect Overlay */}
                      <div 
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{
                          background: `linear-gradient(90deg, ${themeColor.accent}03 0%, transparent 100%)`
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Overall Summary */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Total Chapters */}
                  <div 
                    className="rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ 
                          backgroundColor: 'rgba(59, 130, 246, 0.15)'
                        }}
                      >
                        <FontAwesomeIcon icon={faBook} className="text-base" style={{ color: '#3b82f6' }} />
                      </div>
                      <span 
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ 
                          color: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.15)'
                        }}
                      >
                        Total
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{chapters.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Chapters</p>
                  </div>

                  {/* Total Questions */}
                  <div 
                    className="rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ backgroundColor: 'rgba(168, 85, 247, 0.08)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ 
                          backgroundColor: 'rgba(168, 85, 247, 0.15)'
                        }}
                      >
                        <FontAwesomeIcon icon={faQuestionCircle} className="text-base" style={{ color: '#a855f7' }} />
                      </div>
                      <span 
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ 
                          color: '#a855f7',
                          backgroundColor: 'rgba(168, 85, 247, 0.15)'
                        }}
                      >
                        Attempted
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {chapters.reduce((sum, [, perf]) => sum + perf.attempted, 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Questions</p>
                  </div>

                  {/* Total Score */}
                  <div 
                    className="rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ 
                          backgroundColor: 'rgba(16, 185, 129, 0.15)'
                        }}
                      >
                        <FontAwesomeIcon icon={faTrophy} className="text-base" style={{ color: '#10b981' }} />
                      </div>
                      <span 
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ 
                          color: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)'
                        }}
                      >
                        Earned
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {chapters.reduce((sum, [, perf]) => sum + perf.score, 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Total Points</p>
                  </div>

                  {/* Average Performance */}
                  <div 
                    className="rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ backgroundColor: 'rgba(249, 115, 22, 0.08)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ 
                          backgroundColor: 'rgba(249, 115, 22, 0.15)'
                        }}
                      >
                        <FontAwesomeIcon 
                          icon={faChartLine} 
                          className="text-base" 
                          style={{ color: '#f97316' }}
                        />
                      </div>
                      <span 
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ 
                          color: '#f97316',
                          backgroundColor: 'rgba(249, 115, 22, 0.15)'
                        }}
                      >
                        Average
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(
                        chapters.reduce((sum, [, perf]) => {
                          const pct = perf.maxScore > 0 ? (perf.score / perf.maxScore) * 100 : 0;
                          return sum + pct;
                        }, 0) / chapters.length
                      )}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Performance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grade Criteria Modal */}
        {showGradeModal && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={() => setShowGradeModal(false)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide"
              onClick={(e) => e.stopPropagation()}
              style={{
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none' // IE and Edge
              }}
            >
              {/* Modal Header */}
              <div 
                className="sticky top-0 px-6 py-5 border-b border-gray-200 bg-white rounded-t-2xl z-10"
                style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}08 0%, ${brandTheme.colors.primary}03 100%)` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ 
                        backgroundColor: `${brandTheme.colors.primary}15`,
                        border: `2px solid ${brandTheme.colors.primary}30`
                      }}
                    >
                      <FontAwesomeIcon 
                        icon={faTrophy} 
                        className="text-xl" 
                        style={{ color: brandTheme.colors.primary }}
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Grade Criteria</h2>
                      <p className="text-sm text-gray-600 mt-0.5">Performance evaluation standards</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGradeModal(false)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-gray-100"
                    style={{ color: brandTheme.colors.primary }}
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-xl" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-6">
                <div className="space-y-3">
                  {/* A+ Grade */}
                  <div 
                    className="group bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ border: '2px solid #d1fae5' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '2px solid #d1fae5'
                        }}
                      >
                        A+
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">Excellent</h3>
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              color: '#10b981',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)'
                            }}
                          >
                            90% - 100%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Outstanding performance with comprehensive understanding</p>
                      </div>
                    </div>
                  </div>

                  {/* A Grade */}
                  <div 
                    className="group bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ border: '2px solid #bbf7d0' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(34, 197, 94, 0.15)',
                          color: '#22c55e',
                          border: '2px solid #bbf7d0'
                        }}
                      >
                        A
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">Very Good</h3>
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              color: '#22c55e',
                              backgroundColor: 'rgba(34, 197, 94, 0.15)'
                            }}
                          >
                            80% - 89%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Very good performance with strong understanding</p>
                      </div>
                    </div>
                  </div>

                  {/* B+ Grade */}
                  <div 
                    className="group bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ border: '2px solid #bfdbfe' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          border: '2px solid #bfdbfe'
                        }}
                      >
                        B+
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">Good</h3>
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              color: '#3b82f6',
                              backgroundColor: 'rgba(59, 130, 246, 0.15)'
                            }}
                          >
                            70% - 79%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Good performance with solid understanding</p>
                      </div>
                    </div>
                  </div>

                  {/* B Grade */}
                  <div 
                    className="group bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ border: '2px solid #dbeafe' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(96, 165, 250, 0.15)',
                          color: '#60a5fa',
                          border: '2px solid #dbeafe'
                        }}
                      >
                        B
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">Above Average</h3>
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              color: '#60a5fa',
                              backgroundColor: 'rgba(96, 165, 250, 0.15)'
                            }}
                          >
                            60% - 69%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Above average performance with good grasp of concepts</p>
                      </div>
                    </div>
                  </div>

                  {/* C Grade */}
                  <div 
                    className="group bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ border: '2px solid #fde68a' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(234, 179, 8, 0.15)',
                          color: '#eab308',
                          border: '2px solid #fde68a'
                        }}
                      >
                        C
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">Average</h3>
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              color: '#eab308',
                              backgroundColor: 'rgba(234, 179, 8, 0.15)'
                            }}
                          >
                            50% - 59%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Average performance with basic understanding</p>
                      </div>
                    </div>
                  </div>

                  {/* D Grade */}
                  <div 
                    className="group bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ border: '2px solid #fed7aa' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(249, 115, 22, 0.15)',
                          color: '#f97316',
                          border: '2px solid #fed7aa'
                        }}
                      >
                        D
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">Below Average</h3>
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              color: '#f97316',
                              backgroundColor: 'rgba(249, 115, 22, 0.15)'
                            }}
                          >
                            40% - 49%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Below average performance, needs improvement</p>
                      </div>
                    </div>
                  </div>

                  {/* F Grade */}
                  <div 
                    className="group bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md"
                    style={{ border: '2px solid #fecaca' }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
                        style={{ 
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '2px solid #fecaca'
                        }}
                      >
                        F
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">Needs Significant Improvement</h3>
                          <span 
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              color: '#ef4444',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)'
                            }}
                          >
                            0% - 39%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Unsatisfactory performance, requires significant improvement</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Footer */}
                <div 
                  className="mt-6 p-4 rounded-xl"
                  style={{ 
                    backgroundColor: `${brandTheme.colors.primary}08`,
                    border: `1px solid ${brandTheme.colors.primary}20`
                  }}
                >
                  <div className="flex items-start gap-3">
                    <FontAwesomeIcon 
                      icon={faInfoCircle} 
                      className="text-lg mt-0.5" 
                      style={{ color: brandTheme.colors.primary }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 mb-1">How Grades Are Calculated</p>
                      <p className="text-xs text-gray-600">
                        Grades are automatically calculated based on the percentage of marks obtained out of the total marks available for each chapter. Click on any grade badge in the chapter performance section to view this information.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Hide scrollbar while maintaining scroll functionality */
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: brandTheme.colors.primary + '20', borderTopColor: brandTheme.colors.primary }} />
      </div>
    );
  }

  if (!attemptData || !student) {
    // Student data not loaded yet or invalid
    return (
      <div className="h-screen flex flex-col bg-white overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{student?.studentName || 'Student'}</h2>
              <p className="text-sm text-gray-600">Roll No: {student?.rollNumber || 'N/A'}</p>
            </div>
            {currentUserType !== 'student' ? (
              <button onClick={onBack} className="p-3 hover:bg-gray-100 rounded-lg transition-colors" title="Back to Dashboard">
                <FontAwesomeIcon icon={faChartLine} className="text-gray-600 text-2xl" />
              </button>
            ) : (
              <button onClick={onBack} className="p-3 hover:bg-gray-100 rounded-lg transition-colors" title="Back to Results">
                <FontAwesomeIcon icon={faChevronLeft} className="text-gray-600 text-2xl" />
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faClipboardList} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Attempted</p>
                <p className="text-lg font-bold text-gray-900">0/{exam?.questionsList?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faAward} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Score</p>
                <p className="text-lg font-bold text-gray-900">0/{exam?.maxMarks || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faClock} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Time Spent</p>
                <p className="text-lg font-bold text-gray-900">0m 0s</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Violations</p>
                <p className="text-lg font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-scroll px-6 py-4 bg-gray-50">
          <div className="flex flex-col items-center justify-center py-20 px-4">
            {/* Empty State Graphic */}
            <div className="relative mb-8">
              {/* Decorative circles */}
              <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-100 rounded-full opacity-50"></div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-100 rounded-full opacity-50"></div>
              
              {/* Main illustration container */}
              <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-12 shadow-lg">
                {/* Clipboard icon */}
                <div className="relative">
                  <FontAwesomeIcon icon={faClipboardList} className="text-gray-300 text-8xl" />
                  {/* Icon overlay */}
                  <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-3 shadow-md">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandTheme.colors.primary}20` }}>
                      <FontAwesomeIcon icon={faQuestionCircle} style={{ color: brandTheme.colors.primary }} className="text-xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="text-center max-w-md">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">No Attempt Data Found</h3>
              <p className="text-gray-600 text-base leading-relaxed mb-2">
                This student has not started the exam yet or their attempt data is unavailable.
              </p>
              <p className="text-gray-500 text-sm">
                Please check if the student was present during the exam.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{student.studentName}</h2>
            <p className="text-sm text-gray-600">Roll No: {student.rollNumber}</p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Only show Re-evaluate button for teachers and admins */}
            {currentUserType !== 'student' && hasPendingEvaluations() && (
              <button onClick={handleReEvaluateStuck} disabled={reEvaluating} className={`p-3 rounded-lg transition-colors ${reEvaluating ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:bg-blue-50 text-blue-600'}`} title="Re-evaluate stuck questions">
                <FontAwesomeIcon icon={faArrowRotateRight} className={`text-2xl ${reEvaluating ? 'animate-spin' : ''}`} />
              </button>
            )}
            {/* Only show Dashboard icon for teachers and admins */}
            {currentUserType !== 'student' ? (
              <button onClick={onBack} className="p-3 hover:bg-gray-100 rounded-lg transition-colors" title="Back to Dashboard">
                <FontAwesomeIcon icon={faChartLine} className="text-gray-600 text-2xl" />
              </button>
            ) : (
              <button onClick={onBack} className="p-3 hover:bg-gray-100 rounded-lg transition-colors" title="Back to Results">
                <FontAwesomeIcon icon={faChevronLeft} className="text-gray-600 text-2xl" />
              </button>
            )}
          </div>
        </div>
        {reEvalMessage && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${reEvalMessage.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : reEvalMessage.includes('❌') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
            {reEvalMessage}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-scroll bg-white">
        {/* Stats Cards - Matching Chapter Performance Design */}
        <div className="px-6 pt-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Attempted Card */}
            <div className="bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5" style={{ border: '2px solid #bfdbfe' }}>
              <div className="flex items-center justify-between mb-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    border: '2px solid #bfdbfe'
                  }}
                >
                  <FontAwesomeIcon icon={faClipboardList} className="text-base" style={{ color: '#3b82f6' }} />
                </div>
                <span 
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ 
                    color: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)'
                  }}
                >
                  Attempted
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.attemptedQuestions}/{stats.totalQuestions}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">Questions</p>
                {(() => {
                  // ✅ FIXED: Only count ATTEMPTED questions (isAnswered = true) and use pool field
                  const attemptedQuestions = mergedQuestions.filter(q => q.isAnswered);
                  const regularCount = attemptedQuestions.filter(q => !q.pool).length;
                  const poolCount = attemptedQuestions.filter(q => q.pool).length;
                  
                  return (
                    <div className="flex items-center gap-1.5 ml-auto">
                      {regularCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-semibold flex items-center gap-1">
                          <FontAwesomeIcon icon={faClipboardList} className="text-xs" />
                          {regularCount}
                        </span>
                      )}
                      {poolCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-semibold flex items-center gap-1">
                          <FontAwesomeIcon icon={faLayerGroup} className="text-xs" />
                          {poolCount}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Score Card */}
            <div className="bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5" style={{ border: '2px solid #a7f3d0' }}>
              <div className="flex items-center justify-between mb-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid #a7f3d0'
                  }}
                >
                  <FontAwesomeIcon icon={faAward} className="text-base" style={{ color: '#10b981' }} />
                </div>
                <span 
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ 
                    color: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)'
                  }}
                >
                  Score
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.obtainedMarks.toFixed(2)}/{stats.totalMarks}</p>
              <p className="text-xs text-gray-500 mt-1">Marks</p>
            </div>
            
            {/* Time Spent Card */}
            <div className="bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5" style={{ border: '2px solid #e9d5ff' }}>
              <div className="flex items-center justify-between mb-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    border: '2px solid #e9d5ff'
                  }}
                >
                  <FontAwesomeIcon icon={faClock} className="text-base" style={{ color: '#a855f7' }} />
                </div>
                <span 
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ 
                    color: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)'
                  }}
                >
                  Time
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatTime(stats.totalTimeSpent)}</p>
              <p className="text-xs text-gray-500 mt-1">Duration</p>
            </div>
            
            {/* Violations Card */}
            <button 
              onClick={handleShowAllViolations}
              disabled={stats.violationCount === 0}
              className={`bg-white rounded-xl p-4 text-left transition-all duration-300 ${
                stats.violationCount > 0 ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'
              }`}
              style={{ border: '2px solid #fecaca' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '2px solid #fecaca'
                  }}
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-base" style={{ color: '#ef4444' }} />
                </div>
                <span 
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ 
                    color: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)'
                  }}
                >
                  Violations
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.violationCount}</p>
              <p className="text-xs text-gray-500 mt-1">Detected</p>
            </button>
          </div>
        </div>

        {/* Chapter-wise Performance Analysis - NEW SECTION */}
        {renderChapterAnalysis()}

        
        
        {mergedQuestions && mergedQuestions.length > 0 && stats.attemptedQuestions > 0 ? (
          <div className="px-6 space-y-4 pb-6">
            {mergedQuestions.map((question: MergedQuestion, index: number) => (
              <div key={question.responseId || `question-${index}`} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-6">
                  {/* Header with badges and marks */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {/* Purple circle badge for question number */}
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        {index + 1}
                      </div>
                      
                      {/* Type badge */}
                      <span className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold uppercase tracking-wide">
                        {QUESTION_TYPE_LABELS[question.questionType as keyof typeof QUESTION_TYPE_LABELS] || question.questionType}
                      </span>
                      
                      {/* Complexity badge */}
                      {question.complexity && (
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wide ${getComplexityStyle(question.complexity).className}`}>
                          {getComplexityStyle(question.complexity).label}
                        </span>
                      )}
                      
                      {/* Question Pool badge */}
                      {isQuestionFromPool(question.questionId) && (
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faLayerGroup} className="text-xs" />
                          Pool
                        </span>
                      )}
                    </div>
                    
                    {/* Evaluation Status */}
                    <div className="text-right">
                      {question.isAnswered && question.evaluationStatus === EVALUATION_STATUS.COMPLETED ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-sm font-semibold">
                          ✓ Evaluated
                        </span>
                      ) : question.isAnswered && question.evaluationStatus === EVALUATION_STATUS.PENDING ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 text-sm font-semibold">
                          ⏳ Pending
                        </span>
                      ) : question.isAnswered && question.evaluationStatus === EVALUATION_STATUS.EVALUATING ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-sm font-semibold">
                          🔄 Evaluating
                        </span>
                      ) : question.isAnswered ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-semibold">
                          ⚠️ {question.evaluationStatus}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold">
                          Not Attempted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question content */}
                  <div className="space-y-4">
                  {question.questionText && (
                    <div>
                      <div className="space-y-3">
                        {containsHTML(question.questionText) ? (
                          processHTMLWithCode(question.questionText, question.questionId || question.questionNo.toString())
                        ) : (
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{question.questionText}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {isQuestionType(question.questionType, QUESTION_TYPES.MCQ) && question.options && question.options.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Options:</p>
                      <div className="space-y-2">
                        {question.options.map((option: any, optIndex: number) => {
                          const optionText = typeof option === 'string' ? option : option.text || option.option;
                          
                          // Check if this question is expanded
                          const isExpanded = expandedQuestionId === (question.responseId || `question-${index}`);
                          
                          // Only calculate correctness and student selection when expanded
                          let isCorrect = false;
                          let isStudentAnswer = false;
                          
                          if (isExpanded) {
                            // Normalize correctAnswers to array
                            const correctAnswersArray = Array.isArray(question.correctAnswers) 
                              ? question.correctAnswers 
                              : question.correctAnswers !== undefined && question.correctAnswers !== null
                              ? [question.correctAnswers]
                              : [];
                            
                            // Check if this option is correct
                            isCorrect = correctAnswersArray.some((ans: any) => {
                              if (typeof ans === 'number') return ans === optIndex;
                              if (typeof ans === 'string') return ans.trim().toLowerCase() === optionText.trim().toLowerCase();
                              return false;
                            });
                            
                            // Normalize studentAnswer to array
                            const studentAnswersArray = question.isAnswered 
                              ? (Array.isArray(question.studentAnswer) 
                                ? question.studentAnswer 
                                : question.studentAnswer !== undefined && question.studentAnswer !== null
                                ? [question.studentAnswer]
                                : [])
                              : [];
                            
                            // Check if student selected this option
                            isStudentAnswer = studentAnswersArray.some((ans: any) => {
                              if (typeof ans === 'number') return ans === optIndex;
                              if (typeof ans === 'string') return ans.trim().toLowerCase() === optionText.trim().toLowerCase();
                              return false;
                            });
                          }

                          return (
                            <div
                              key={optIndex}
                              className={`flex items-center space-x-2 p-2.5 rounded-lg border ${
                                isExpanded
                                  ? (isStudentAnswer && isCorrect
                                    ? 'bg-green-50 border-green-300'
                                    : isStudentAnswer && !isCorrect
                                    ? 'bg-red-50 border-red-300'
                                    : isCorrect
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200')
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                isExpanded
                                  ? (isStudentAnswer && isCorrect
                                    ? 'bg-green-500 text-white'
                                    : isStudentAnswer && !isCorrect
                                    ? 'bg-red-500 text-white'
                                    : isCorrect
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-300 text-gray-700')
                                  : 'bg-gray-300 text-gray-700'
                              }`}>
                                {String.fromCharCode(65 + optIndex)}
                              </div>
                              <span className={`text-sm flex-1 ${
                                isExpanded
                                  ? (isStudentAnswer && isCorrect
                                    ? 'text-green-900 font-medium'
                                    : isStudentAnswer && !isCorrect
                                    ? 'text-red-900 font-medium'
                                    : isCorrect
                                    ? 'text-green-900 font-medium'
                                    : 'text-gray-700')
                                  : 'text-gray-700'
                              }`}>
                                {optionText}
                              </span>
                              {isExpanded && isStudentAnswer && (
                                <span className="text-xs font-semibold text-blue-600">← Student's Answer</span>
                              )}
                              {isExpanded && isCorrect && (
                                <span className="text-xs font-semibold text-green-600">✓ Correct</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isQuestionType(question.questionType, QUESTION_TYPES.JUMBLED) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Items to Arrange:</p>
                      <div className="space-y-2">
                        {(() => {
                          const jumbledItems = (question as any).jumbledOptions || (question as any).jumbledItems;
                          const correctSequence = question.correctAnswers || question.correctAnswer;
                          
                          const itemsToShow = jumbledItems && Array.isArray(jumbledItems) && jumbledItems.length > 0
                            ? jumbledItems
                            : correctSequence && Array.isArray(correctSequence)
                            ? [...correctSequence].sort(() => Math.random() - 0.5)
                            : [];

                          return itemsToShow.length > 0 ? itemsToShow.map((item: string, itemIndex: number) => (
                            <div
                              key={itemIndex}
                              className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200"
                            >
                              <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                                <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                              </div>
                              <span className="text-sm text-gray-700">
                                {item}
                              </span>
                            </div>
                          )) : null;
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Expandable Answer Details */}
                  {expandedQuestionId === (question.responseId || `question-${index}`) && (
                    <>
                  {isQuestionType(question.questionType, QUESTION_TYPES.FITB) && question.correctAnswers && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Correct Answers:</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(question.correctAnswers) ? (
                          question.correctAnswers.map((answer: string, idx: number) => (
                            <span key={idx} className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                              Blank {idx + 1}: {answer}
                            </span>
                          ))
                        ) : (
                          <span className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                            {question.correctAnswers}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isQuestionType(question.questionType, QUESTION_TYPES.JUMBLED) && (question.correctAnswers || question.correctAnswer) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Correct Sequence:</p>
                      <div className="space-y-2">
                        {(() => {
                          const correctSequence = question.correctAnswers || question.correctAnswer;
                          const sequenceArray = Array.isArray(correctSequence) ? correctSequence : [correctSequence];
                          
                          return sequenceArray.map((item: string, seqIndex: number) => (
                            <div
                              key={seqIndex}
                              className="flex items-center space-x-2 p-2.5 rounded-lg border bg-green-50 border-green-300"
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-green-500 text-white">
                                {seqIndex + 1}
                              </div>
                              <span className="text-sm text-gray-700">
                                {item}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Expected Answer for Descriptive Questions */}
                  {(() => {
                    if (!isQuestionType(question.questionType, QUESTION_TYPES.DESCRIPTIVE)) return null;
                    // Use correctAnswers directly from question object
                    const expectedAnswer = question.correctAnswers?.[0] || question.correctAnswer;
                    if (!expectedAnswer) return null;
                    
                    return (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Expected Answer:</p>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          {containsHTML(expectedAnswer) ? (
                            processHTMLWithCode(expectedAnswer, `expected-${question.questionNo}`)
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {expectedAnswer}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expected Solution for CODE Questions */}
                  {(() => {
                    if (!isQuestionType(question.questionType, QUESTION_TYPES.CODE)) return null;
                    const expectedSolution = question.correctAnswers?.[0];
                    if (!expectedSolution) return null;
                    
                    return (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Expected Solution:</p>
                        <div className="relative rounded-lg overflow-hidden isolate">
                          <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(expectedSolution, `expected-solution-${question.questionNo}`)}
                              className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                              title="Copy to clipboard"
                            >
                              {copiedCode === `expected-solution-${question.questionNo}` ? (
                                <FontAwesomeIcon icon={faCheck} className="text-sm" />
                              ) : (
                                <FontAwesomeIcon icon={faCopy} className="text-sm" />
                              )}
                            </button>
                          </div>
                          <div className="pt-10">
                            <SyntaxHighlighter
                              language={question.language?.toLowerCase() || 'java'}
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                borderRadius: 0,
                                borderBottomLeftRadius: '0.5rem',
                                borderBottomRightRadius: '0.5rem',
                                fontSize: '0.875rem',
                                padding: '1rem',
                                paddingTop: '0.5rem'
                              }}
                              showLineNumbers={false}
                            >
                              {expectedSolution}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Student's Answer Section - Show for non-MCQ questions only */}
                  <div className="space-y-4">
                    {/* Don't show "Not Attempted" for MCQ - it's already visible in the options */}
                    {!question.isAnswered && !isQuestionType(question.questionType, QUESTION_TYPES.MCQ) ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Student's Answer:</p>
                        <p className="text-sm text-gray-500 italic">Not Attempted</p>
                      </div>
                    ) : (
                      <>
                      {/* Only show student answer section for non-MCQ questions since MCQ already shows it in options */}
                      {!isQuestionType(question.questionType, QUESTION_TYPES.MCQ) && (
                      <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Student's Answer:</p>

                        {isQuestionType(question.questionType, QUESTION_TYPES.FITB) && (
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(question.studentAnswer) ? (
                              question.studentAnswer.map((answer: string, idx: number) => (
                                <span key={idx} className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
                                  Blank {idx + 1}: {answer}
                                </span>
                              ))
                            ) : (
                              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
                                {question.studentAnswer}
                              </span>
                            )}
                          </div>
                        )}

                        {isQuestionType(question.questionType, QUESTION_TYPES.JUMBLED) && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Student's Sequence:</p>
                            <div className="space-y-2">
                              {(() => {
                                const studentSequence = question.studentAnswer;
                                const sequenceArray = Array.isArray(studentSequence) ? studentSequence : [];
                                
                                return sequenceArray.length > 0 ? sequenceArray.map((item: string, seqIndex: number) => (
                                  <div
                                    key={seqIndex}
                                    className="flex items-center space-x-2 p-2.5 rounded-lg border bg-blue-50 border-blue-300"
                                  >
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-blue-500 text-white">
                                      {seqIndex + 1}
                                    </div>
                                    <span className="text-sm text-gray-700">
                                      {item}
                                    </span>
                                  </div>
                                )) : (
                                  <p className="text-sm text-gray-500">No sequence provided</p>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {isQuestionType(question.questionType, QUESTION_TYPES.CODE) && (
                          <div>
                            {question.language && (
                              <p className="text-xs text-gray-500 mb-2">
                                <FontAwesomeIcon icon={faCode} className="mr-1" />
                                Language: {question.language}
                              </p>
                            )}
                            <div className="relative rounded-lg overflow-hidden isolate">
                              {/* Terminal-style header with dots and copy button */}
                              <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                {/* macOS-style dots */}
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div>
                                
                                {/* Copy button */}
                                <button
                                  onClick={() => copyToClipboard(question.codeSubmitted || question.code || '', `answer-${question.questionNo}`)}
                                  className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                  title="Copy to clipboard"
                                >
                                  {copiedCode === `answer-${question.questionNo}` ? (
                                    <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                  ) : (
                                    <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                  )}
                                </button>
                              </div>
                              
                              {/* Code content with top padding for header */}
                              <div className="pt-10">
                                <SyntaxHighlighter
                                  language={question.language?.toLowerCase() || 'python'}
                                  style={vscDarkPlus}
                                  customStyle={{
                                    margin: 0,
                                    borderRadius: 0,
                                    borderBottomLeftRadius: '0.5rem',
                                    borderBottomRightRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    padding: '1rem',
                                    paddingTop: '0.5rem'
                                  }}
                                  showLineNumbers={false}
                                >
                                  {question.codeSubmitted || question.code || 'No code submitted'}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                            
                            {question.testCaseResults && question.testCaseResults.length > 0 && (
                              <div className="mt-3">
                                {/* Test Case Summary Header */}
                                <div className="flex items-center justify-between mb-3">
                                  <h2 className="text-lg font-bold text-gray-900">Test Case Results</h2>
                                  <div className="flex items-center space-x-2">
                                    {(() => {
                                      const passedCount = question.testCaseResults.filter((tc: any) => tc.passed).length;
                                      const totalCount = question.testCaseResults.length;
                                      const allPassed = passedCount === totalCount;
                                      const nonePassed = passedCount === 0;
                                      
                                      return (
                                        <>
                                          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                                            allPassed ? 'bg-green-100 text-green-800' : 
                                            nonePassed ? 'bg-rose-100 text-rose-800' : 
                                            'bg-yellow-100 text-yellow-800'
                                          }`}>
                                            {passedCount}/{totalCount} Passed
                                          </span>
                                          <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-100 text-blue-700">
                                            {question.testCaseMarks || 0} marks
                                          </span>
                                          {(question.averageExecutionTime ?? 0) > 0 && (
                                            <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-purple-100 text-purple-700">
                                              Avg: {question.averageExecutionTime?.toFixed(0)}ms
                                            </span>
                                          )}
                                          {(question.totalExecutionTime ?? 0) > 0 && (
                                            <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-100 text-indigo-700">
                                              Total: {question.totalExecutionTime?.toFixed(0)}ms
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-gray-100 border-b-2 border-gray-200">
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Test</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Input</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Expected Output</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Actual Output</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Status</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Time (ms)</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Marks</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {question.testCaseResults.map((tc: any, tcIdx: number) => (
                                        <tr key={tcIdx} className={`transition-colors ${tc.passed ? 'bg-green-50 hover:bg-green-100' : 'bg-rose-50/50 hover:bg-rose-50/70'}`}>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white shadow-sm ${tc.passed ? 'bg-green-600' : 'bg-rose-500'}`}>
                                                {tc.testCaseNo || tcIdx + 1}
                                              </span>
                                              <span className={`text-sm font-bold ${tc.passed ? 'text-green-700' : 'text-rose-600'}`}>
                                                {tc.passed ? '✓' : '✗'}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="font-mono text-xs bg-white px-2 py-1.5 rounded border border-gray-300 whitespace-pre-wrap max-w-xs overflow-auto shadow-sm">
                                              {tc.input || 'N/A'}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="font-mono text-xs bg-green-50 border-green-300 px-2 py-1.5 rounded border whitespace-pre-wrap max-w-xs overflow-auto shadow-sm">
                                              {tc.expectedOutput || 'N/A'}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className={`font-mono text-xs px-2 py-1.5 rounded border whitespace-pre-wrap max-w-xs overflow-auto shadow-sm ${
                                              tc.passed ? 'bg-green-50 border-green-300 text-green-900' : 
                                              tc.error ? 'bg-rose-50 border-rose-300 text-rose-900' : 
                                              'bg-rose-50 border-rose-300 text-rose-900'
                                            }`}>
                                              {tc.actualOutput || tc.error || 'N/A'}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                                              tc.passed ? 'bg-green-600 text-white' : 'bg-rose-500 text-white'
                                            }`}>
                                              {tc.passed ? '✓ PASSED' : '✗ FAILED'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-700">
                                              {tc.executionTime ? `${tc.executionTime}ms` : 'N/A'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                                              tc.passed ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                              {tc.marks !== undefined ? tc.marks : 0}/{tc.maxMarks || 0}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>  
                                </div>
                              </div>
                            )}
                            {/* ✅ CODE AI FEEDBACK - Beautiful Display */}
                            {question.codeAIFeedback && (
                              <div className="mt-4">
                                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center">
                                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                                  </svg>
                                  AI Code Analysis
                                </h3>
                                
                                <div className={`rounded-lg border p-4 ${
                                  question.codeAIFeedback.severityLevel === 'success' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
                                  question.codeAIFeedback.severityLevel === 'critical' ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200' :
                                  'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200'
                                }`}>
                                  
                                  {/* Code Quality Scores Grid */}
                                  <div className="mb-4">
                                    <p className="text-xs font-semibold text-gray-700 mb-3">Code Quality Metrics</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      
                                      {/* Overall Quality */}
                                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs text-gray-600">Overall</span>
                                          <span className="text-sm font-bold text-gray-900">{question.codeAIFeedback.codeQuality}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full transition-all ${
                                              question.codeAIFeedback.codeQuality >= 80 ? 'bg-green-500' :
                                              question.codeAIFeedback.codeQuality >= 60 ? 'bg-blue-500' :
                                              question.codeAIFeedback.codeQuality >= 40 ? 'bg-yellow-500' :
                                              'bg-red-500'
                                            }`}
                                            style={{ width: `${question.codeAIFeedback.codeQuality}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                      
                                      {/* Readability */}
                                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs text-gray-600">Readability</span>
                                          <span className="text-sm font-bold text-gray-900">{question.codeAIFeedback.readabilityScore}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full transition-all ${
                                              question.codeAIFeedback.readabilityScore >= 80 ? 'bg-green-500' :
                                              question.codeAIFeedback.readabilityScore >= 60 ? 'bg-blue-500' :
                                              question.codeAIFeedback.readabilityScore >= 40 ? 'bg-yellow-500' :
                                              'bg-red-500'
                                            }`}
                                            style={{ width: `${question.codeAIFeedback.readabilityScore}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                      
                                      {/* Efficiency */}
                                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs text-gray-600">Efficiency</span>
                                          <span className="text-sm font-bold text-gray-900">{question.codeAIFeedback.efficiencyScore}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full transition-all ${
                                              question.codeAIFeedback.efficiencyScore >= 80 ? 'bg-green-500' :
                                              question.codeAIFeedback.efficiencyScore >= 60 ? 'bg-blue-500' :
                                              question.codeAIFeedback.efficiencyScore >= 40 ? 'bg-yellow-500' :
                                              'bg-red-500'
                                            }`}
                                            style={{ width: `${question.codeAIFeedback.efficiencyScore}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                      
                                      {/* Correctness */}
                                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs text-gray-600">Correctness</span>
                                          <span className="text-sm font-bold text-gray-900">{question.codeAIFeedback.correctnessScore}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full transition-all ${
                                              question.codeAIFeedback.correctnessScore >= 80 ? 'bg-green-500' :
                                              question.codeAIFeedback.correctnessScore >= 60 ? 'bg-blue-500' :
                                              question.codeAIFeedback.correctnessScore >= 40 ? 'bg-yellow-500' :
                                              'bg-red-500'
                                            }`}
                                            style={{ width: `${question.codeAIFeedback.correctnessScore}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Complexity Analysis */}
                                  <div className="mb-4 flex items-center space-x-4">
                                    <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                                      <span className="text-xs text-gray-600">Time:</span>
                                      <span className="ml-2 text-sm font-mono font-bold text-indigo-700">{question.codeAIFeedback.timeComplexity}</span>
                                    </div>
                                    <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                                      <span className="text-xs text-gray-600">Space:</span>
                                      <span className="ml-2 text-sm font-mono font-bold text-indigo-700">{question.codeAIFeedback.spaceComplexity}</span>
                                    </div>
                                  </div>
                                  
                                  {/* What You Did Right */}
                                  {question.codeAIFeedback.correctPoints && question.codeAIFeedback.correctPoints.length > 0 && (
                                    <div className="mb-4">
                                      <p className="text-xs font-semibold text-green-800 mb-2 flex items-center">
                                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        What You Did Right
                                      </p>
                                      <ul className="space-y-1.5 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                        {question.codeAIFeedback.correctPoints.map((point: string, i: number) => (
                                          <li key={i} className="flex items-start text-xs text-gray-800">
                                            <span className="text-green-600 font-bold mr-2 mt-0.5">✓</span>
                                            <span>{point}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* General Improvements */}
                                  {question.codeAIFeedback.improvements && question.codeAIFeedback.improvements.length > 0 && (
                                    <div className="mb-4">
                                      <p className="text-xs font-semibold text-orange-800 mb-2 flex items-center">
                                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        General Improvements
                                      </p>
                                      <ul className="space-y-1.5 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                        {question.codeAIFeedback.improvements.map((improvement: string, i: number) => (
                                          <li key={i} className="flex items-start text-xs text-gray-800">
                                            <span className="text-orange-600 font-bold mr-2 mt-0.5">→</span>
                                            <span>{improvement}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Failed Test Analysis - Critical Section */}
                                  {question.codeAIFeedback.failedTestAnalysis && question.codeAIFeedback.failedTestAnalysis.length > 0 && (
                                    <div className="mb-4">
                                      <p className="text-xs font-semibold text-red-800 mb-2 flex items-center">
                                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        Why Tests Failed & How to Fix
                                      </p>
                                      <div className="space-y-3">
                                        {question.codeAIFeedback.failedTestAnalysis.map((analysis: any, i: number) => (
                                          <div key={i} className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-red-500">
                                            <div className="flex items-start mb-2">
                                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold mr-2 flex-shrink-0">
                                                {analysis.testNumber}
                                              </span>
                                              <div className="flex-1">
                                                <p className="text-xs font-semibold text-red-900 mb-1">Issue:</p>
                                                <p className="text-xs text-gray-800 mb-2">{analysis.issue}</p>
                                                <p className="text-xs font-semibold text-green-900 mb-1">Fix:</p>
                                                <p className="text-xs text-gray-800 font-mono bg-green-50 px-2 py-1 rounded border border-green-200">
                                                  {analysis.fix}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Suggested Code - Expandable */}
                                  {question.codeAIFeedback.hasSuggestedCode && question.codeAIFeedback.suggestedCode && (
                                    <div className="mt-4">
                                      <details className="group">
                                        <summary className="cursor-pointer bg-indigo-100 hover:bg-indigo-200 rounded-lg px-4 py-3 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-indigo-900">
                                              {question.codeAIFeedback.severityLevel === 'critical' ? 'Corrected Code' : 'Optimized Code'}
                                            </span>
                                            <svg className="w-5 h-5 text-indigo-700 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </div>
                                        </summary>
                                        <div className="mt-3 bg-white rounded-lg p-4 border border-indigo-200">
                                          {question.codeAIFeedback.codeExplanation && (
                                            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                              <p className="text-xs font-semibold text-blue-900 mb-1">Explanation:</p>
                                              <p className="text-xs text-gray-800">{question.codeAIFeedback.codeExplanation}</p>
                                            </div>
                                          )}
                                          
                                          {/* Apple-style Terminal with Syntax Highlighting */}
                                          <div className="relative rounded-lg overflow-hidden isolate">
                                            <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                              <div className="flex items-center space-x-2">
                                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const codeId = `optimized-code-${question.questionNo}`;
                                                  copyToClipboard(question.codeAIFeedback?.suggestedCode || '', codeId);
                                                }}
                                                className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                                title="Copy to clipboard"
                                              >
                                                {copiedCode === `optimized-code-${question.questionNo}` ? (
                                                  <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                                ) : (
                                                  <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                                )}
                                              </button>
                                            </div>
                                            <div className="pt-10">
                                              <SyntaxHighlighter
                                                language={question.language?.toLowerCase() || 'java'}
                                                style={vscDarkPlus}
                                                customStyle={{
                                                  margin: 0,
                                                  borderRadius: 0,
                                                  borderBottomLeftRadius: '0.5rem',
                                                  borderBottomRightRadius: '0.5rem',
                                                  fontSize: '0.875rem',
                                                  padding: '1rem',
                                                  paddingTop: '0.5rem'
                                                }}
                                                showLineNumbers={false}
                                              >
                                                {question.codeAIFeedback.suggestedCode}
                                              </SyntaxHighlighter>
                                            </div>
                                          </div>
                                        </div>
                                      </details>
                                    </div>
                                  )}
                                  
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {question.imageUrl && (
                          <div>
                            <div className="mb-2">
                              <FontAwesomeIcon icon={faImage} className="text-gray-500 mr-1" />
                              <span className="text-xs text-gray-500">Image Answer</span>
                            </div>
                            <img src={question.imageUrl} alt={`Answer ${question.questionNo}`} className="max-w-full h-auto rounded border border-gray-300" />
                            {question.ocrText && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">Extracted Text (OCR):</p>
                                <p className="text-sm text-gray-700">{question.ocrText}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {!question.imageUrl && !question.codeSubmitted && !isQuestionType(question.questionType, QUESTION_TYPES.MCQ) && !isQuestionType(question.questionType, QUESTION_TYPES.FITB) && !isQuestionType(question.questionType, QUESTION_TYPES.JUMBLED) && (
                          <div className="space-y-3">
                            {containsHTML(question.answerText || question.studentAnswer) ? (
                              processHTMLWithCode(question.answerText || question.studentAnswer, `answer-${question.questionNo}`)
                            ) : (
                              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                {question.answerText || question.studentAnswer || 'No answer provided'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      )}
                      </>
                    )}
                  </div>

                  {/* Show Hint if available */}
                  {question.hint && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        {isQuestionType(question.questionType, QUESTION_TYPES.CODE) ? 'Solution Hint:' : 'Hint:'}
                      </p>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div 
                          className="text-sm text-gray-700 italic prose prose-sm max-w-none
                            [&>p]:text-sm [&>p]:text-gray-700 [&>p]:mb-1
                            [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                            [&_strong]:font-semibold"
                          dangerouslySetInnerHTML={{ __html: question.hint }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Show Solution if available */}
                  {(() => {
                    const matchedQuestion = exam?.questionsList?.find((q: any) => q.id === question.questionId);
                    return matchedQuestion?.solution && !isQuestionType(question.questionType, QUESTION_TYPES.CODE) && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Solution:</p>
                        {(() => {
                          const solution = matchedQuestion.solution;
                        // Parse the solution to extract sections
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(solution, 'text/html');
                        const elements: React.ReactElement[] = [];
                        let keyCounter = 0;

                        // Process all child nodes
                        Array.from(doc.body.childNodes).forEach((node) => {
                          if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.textContent?.trim();
                            if (text) {
                              elements.push(
                                <p key={`text-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                  {text}
                                </p>
                              );
                            }
                          } else if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as HTMLElement;
                            const tagName = element.tagName.toLowerCase();
                            const content = element.textContent || '';

                            // Handle different HTML tags
                            if (tagName === 'p') {
                              const text = content.trim();
                              
                              // Skip "Correct Answer:" heading
                              if (text.match(/^Correct Answer:?$/i)) {
                                return;
                              }
                              
                              const innerHTML = element.innerHTML?.trim() || '';
                              if (innerHTML.match(/^<strong>Correct Answer:?<\/strong>$/i)) {
                                return;
                              }
                              
                              if (text) {
                                const hasSpans = innerHTML.includes('<span');
                                
                                if (hasSpans) {
                                  elements.push(
                                    <p 
                                      key={`para-${keyCounter++}`} 
                                      className="text-sm text-gray-700 leading-relaxed"
                                      dangerouslySetInnerHTML={{ __html: innerHTML }}
                                    />
                                  );
                                } else {
                                  elements.push(
                                    <p key={`para-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                      {text}
                                    </p>
                                  );
                                }
                              }
                            } else if (tagName === 'pre' || tagName === 'code') {
                              const innerHTML = element.innerHTML || '';
                              const hasYellowHighlights = innerHTML.includes('bg-yellow') || 
                                                         innerHTML.includes('bg-amber') || 
                                                         innerHTML.includes('bg-green') ||
                                                         innerHTML.includes('background-color');
                              
                              if (hasYellowHighlights) {
                                const codeId = `solution-code-${question.questionNo}-${keyCounter}`;
                                elements.push(
                                  <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden bg-gray-900 isolate">
                                    <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                      </div>
                                      <button
                                        onClick={() => copyToClipboard(element.textContent || '', codeId)}
                                        className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                        title="Copy to clipboard"
                                      >
                                        {copiedCode === codeId ? (
                                          <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                        ) : (
                                          <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                        )}
                                      </button>
                                    </div>
                                    <div className="pt-10 pb-4 px-4">
                                      <pre 
                                        className="text-sm font-mono text-gray-100 whitespace-pre-wrap [&_span]:inline [&_.bg-yellow-400]:bg-yellow-400 [&_.text-gray-900]:text-gray-900 [&_.px-1]:px-1 [&_.rounded]:rounded"
                                        style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                                        dangerouslySetInnerHTML={{ __html: innerHTML }}
                                      />
                                    </div>
                                  </div>
                                );
                              } else {
                                const content = element.textContent || '';
                                const detectLanguage = (code: string): string => {
                                  if (code.includes('System.out.println') || code.includes('public class')) {
                                    return 'java';
                                  } else if (code.includes('print(') || code.includes('def ')) {
                                    return 'python';
                                  } else if (code.includes('console.log') || code.includes('const ')) {
                                    return 'javascript';
                                  } else if (code.includes('#include') || code.includes('cout')) {
                                    return 'cpp';
                                  }
                                  return 'java';
                                };
                                
                                const language = detectLanguage(content);
                                const codeId = `solution-code-${question.questionNo}-${keyCounter}`;
                                
                                elements.push(
                                  <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden isolate">
                                    <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                      </div>
                                      <button
                                        onClick={() => copyToClipboard(content, codeId)}
                                        className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                        title="Copy to clipboard"
                                      >
                                        {copiedCode === codeId ? (
                                          <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                        ) : (
                                          <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                        )}
                                      </button>
                                    </div>
                                    <div className="pt-10">
                                      <SyntaxHighlighter
                                        language={language}
                                        style={vscDarkPlus}
                                        customStyle={{
                                          margin: 0,
                                          borderRadius: 0,
                                          borderBottomLeftRadius: '0.5rem',
                                          borderBottomRightRadius: '0.5rem',
                                          fontSize: '0.875rem',
                                          padding: '1rem',
                                          paddingTop: '0.5rem'
                                        }}
                                        showLineNumbers={false}
                                      >
                                        {content}
                                      </SyntaxHighlighter>
                                    </div>
                                  </div>
                                );
                              }
                            } else if (tagName === 'ul' || tagName === 'ol') {
                              const listItems = Array.from(element.querySelectorAll('li'));
                              elements.push(
                                <ul key={`list-${keyCounter++}`} className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                                  {listItems.map((li, idx) => {
                                    const liInnerHTML = li.innerHTML || '';
                                    const hasSpans = liInnerHTML.includes('<span');
                                    
                                    return hasSpans ? (
                                      <li key={idx} dangerouslySetInnerHTML={{ __html: liInnerHTML }} />
                                    ) : (
                                      <li key={idx}>{li.textContent}</li>
                                    );
                                  })}
                                </ul>
                              );
                            }
                          }
                        });

                        // If no elements were parsed and it's a code question, render as code
                        if (elements.length === 0 && isQuestionType(question.questionType, QUESTION_TYPES.CODE)) {
                          const codeId = `solution-code-${question.questionNo}`;
                          const detectLanguage = (code: string): string => {
                            if (code.includes('System.out.println') || code.includes('public class')) {
                              return 'java';
                            } else if (code.includes('print(') || code.includes('def ')) {
                              return 'python';
                            } else if (code.includes('console.log') || code.includes('const ')) {
                              return 'javascript';
                            } else if (code.includes('#include') || code.includes('cout')) {
                              return 'cpp';
                            }
                            return 'java';
                          };
                          
                          const language = detectLanguage(solution);
                          
                          return (
                            <div className="relative rounded-lg overflow-hidden isolate">
                              <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(solution, codeId)}
                                  className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                  title="Copy to clipboard"
                                >
                                  {copiedCode === codeId ? (
                                    <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                  ) : (
                                    <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                  )}
                                </button>
                              </div>
                              <div className="pt-10">
                                <SyntaxHighlighter
                                  language={language}
                                  style={vscDarkPlus}
                                  customStyle={{
                                    margin: 0,
                                    borderRadius: 0,
                                    borderBottomLeftRadius: '0.5rem',
                                    borderBottomRightRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    padding: '1rem',
                                    paddingTop: '0.5rem'
                                  }}
                                  showLineNumbers={false}
                                >
                                  {solution}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          );
                        }
                        
                        return <div className="space-y-2">{elements}</div>;
                      })()}
                    </div>
                    );
                  })()}

                  {/* Show Solution for CODE questions - separate handling */}
                  {(() => {
                    if (!isQuestionType(question.questionType, QUESTION_TYPES.CODE)) return null;
                    const matchedQuestion = exam?.questionsList?.find((q: any) => q.id === question.questionId);
                    if (!matchedQuestion?.solution) return null;
                    
                    // Check if solution has HTML highlighting (for FITB-style code with spans)
                    const hasHTMLHighlighting = matchedQuestion.solution.includes('<span') && 
                                               (matchedQuestion.solution.includes('bg-yellow') || 
                                                matchedQuestion.solution.includes('bg-amber') || 
                                                matchedQuestion.solution.includes('bg-green'));
                    
                    return (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Solution:</p>
                        <div className="relative rounded-lg overflow-hidden isolate">
                          {/* Terminal-style header with dots and copy button */}
                          <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                            {/* macOS-style dots */}
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            
                            {/* Copy button */}
                            <button
                              onClick={() => {
                                const textToCopy = hasHTMLHighlighting 
                                  ? matchedQuestion.solution.replace(/<[^>]+>/g, '') 
                                  : matchedQuestion.solution;
                                copyToClipboard(textToCopy, `solution-${question.questionNo}`);
                              }}
                              className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                              title="Copy to clipboard"
                            >
                              {copiedCode === `solution-${question.questionNo}` ? (
                                <FontAwesomeIcon icon={faCheck} className="text-sm" />
                              ) : (
                                <FontAwesomeIcon icon={faCopy} className="text-sm" />
                              )}
                            </button>
                          </div>
                          
                          {/* Code content with top padding for header */}
                          <div className="pt-10">
                            {hasHTMLHighlighting ? (
                              // Render with HTML highlighting preserved
                              <div className="pb-4 px-4">
                                <pre 
                                  className="text-sm font-mono text-gray-100 whitespace-pre-wrap"
                                  style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                                  dangerouslySetInnerHTML={{ __html: matchedQuestion.solution }}
                                />
                              </div>
                            ) : (
                              // Render with syntax highlighting
                              <SyntaxHighlighter
                                language={matchedQuestion.programmingLanguage?.toLowerCase() || 'java'}
                                style={vscDarkPlus}
                                customStyle={{
                                  margin: 0,
                                  borderRadius: 0,
                                  borderBottomLeftRadius: '0.5rem',
                                  borderBottomRightRadius: '0.5rem',
                                  fontSize: '0.875rem',
                                  padding: '1rem',
                                  paddingTop: '0.5rem'
                                }}
                                showLineNumbers={false}
                              >
                                {matchedQuestion.solution}
                              </SyntaxHighlighter>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {question.feedback && isQuestionType(question.questionType, QUESTION_TYPES.DESCRIPTIVE) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">AI Evaluation Feedback:</p>
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                        
                        {/* Correct Points */}
                        {question.feedback.correctPoints && question.feedback.correctPoints.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-green-700 mb-2 flex items-center">
                              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              What You Got Right
                            </p>
                            <ul className="space-y-1.5">
                              {question.feedback.correctPoints.map((point: string, i: number) => (
                                <li key={i} className="flex items-start text-xs text-gray-700">
                                  <span className="text-green-600 font-bold mr-2 mt-0.5">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Improvements */}
                        {question.feedback.improvements && question.feedback.improvements.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center">
                              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                              </svg>
                              Areas for Improvement
                            </p>
                            <ul className="space-y-1.5">
                              {question.feedback.improvements.map((improvement: string, i: number) => (
                                <li key={i} className="flex items-start text-xs text-gray-700">
                                  <span className="text-orange-600 font-bold mr-2 mt-0.5">→</span>
                                  <span>{improvement}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Granular Scores */}
                        <div className="pt-3 border-t border-blue-200">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Detailed Scores</p>
                          <div className="grid grid-cols-2 gap-2">
                            
                            {/* Answer Length */}
                            <div className="bg-white px-2.5 py-2 rounded-md border border-gray-200">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">Length</span>
                                <span className="text-xs font-semibold text-gray-800">{question.feedback.answerLength} words</span>
                              </div>
                              <div className="flex items-center">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden mr-2">
                                  <div 
                                    className={`h-full transition-all ${
                                      question.feedback.answerLengthScore >= 70 ? 'bg-green-500' :
                                      question.feedback.answerLengthScore >= 40 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${question.feedback.answerLengthScore}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium text-gray-700">{question.feedback.answerLengthScore}%</span>
                              </div>
                            </div>
                            
                            {/* Relevancy */}
                            <div className="bg-white px-2.5 py-2 rounded-md border border-gray-200">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">Relevancy</span>
                                <span className="text-xs font-semibold text-gray-800">{question.feedback.relevancyScore}%</span>
                              </div>
                              <div className="flex items-center">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${
                                      question.feedback.relevancyScore >= 70 ? 'bg-green-500' :
                                      question.feedback.relevancyScore >= 40 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${question.feedback.relevancyScore}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Accuracy */}
                            <div className="bg-white px-2.5 py-2 rounded-md border border-gray-200">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">Accuracy</span>
                                <span className="text-xs font-semibold text-gray-800">{question.feedback.accuracyScore}%</span>
                              </div>
                              <div className="flex items-center">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${
                                      question.feedback.accuracyScore >= 70 ? 'bg-green-500' :
                                      question.feedback.accuracyScore >= 40 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${question.feedback.accuracyScore}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Completeness */}
                            <div className="bg-white px-2.5 py-2 rounded-md border border-gray-200">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">Completeness</span>
                                <span className="text-xs font-semibold text-gray-800">{question.feedback.completenessScore}%</span>
                              </div>
                              <div className="flex items-center">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${
                                      question.feedback.completenessScore >= 70 ? 'bg-green-500' :
                                      question.feedback.completenessScore >= 40 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${question.feedback.completenessScore}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Plagiarism Warning */}
                        {question.feedback.plagiarismScore > 30 && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <div className={`px-3 py-2 rounded-md ${
                              question.feedback.plagiarismScore > 70 ? 'bg-red-50 border border-red-200' :
                              question.feedback.plagiarismScore > 50 ? 'bg-orange-50 border border-orange-200' :
                              'bg-yellow-50 border border-yellow-200'
                            }`}>
                              <p className={`text-xs font-semibold mb-1 ${
                                question.feedback.plagiarismScore > 70 ? 'text-red-700' :
                                question.feedback.plagiarismScore > 50 ? 'text-orange-700' :
                                'text-yellow-700'
                              }`}>
                                ⚠️ Plagiarism Score: {question.feedback.plagiarismScore}%
                                {question.feedback.isPlagiarized && <span className="ml-2 font-bold">FLAGGED</span>}
                              </p>
                              {question.feedback.plagiarismIndicators && question.feedback.plagiarismIndicators.length > 0 && (
                                <ul className="text-xs text-gray-700 space-y-0.5 mt-1">
                                  {question.feedback.plagiarismIndicators.map((indicator: string, i: number) => (
                                    <li key={i}>• {indicator}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                        
                      </div>
                    </div>
                  )}

                  {question.markedForReview && (
                    <div className="flex items-center space-x-2 text-sm text-yellow-700">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      <span>Marked for review by student</span>
                    </div>
                  )}
                  </>
                  )}

                  {/* Footer section with stats */}
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr_auto] gap-6 items-center">
                      {/* Marks */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Marks</p>
                        <p className="text-lg font-bold text-gray-900">
                          <span style={{ color: brandTheme.colors.primary }}>{(question.scoredMarks || 0).toFixed(2)}</span>
                          <span className="text-gray-400"> / {question.maxMarks}</span>
                        </p>
                      </div>
                      
                      {/* Time */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Time</p>
                        <p className="text-lg font-bold text-gray-900">
                          {question.timeSpent ? formatTime(question.timeSpent) : 'N/A'}
                        </p>
                      </div>
                      
                      {/* Violations */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Violations</p>
                        {question.violations && question.violations.length > 0 ? (
                          <button 
                            onClick={() => handleShowViolations(question.violations || [], index + 1)} 
                            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-lg transition-colors border border-red-200"
                          >
                            {question.violations.length}
                          </button>
                        ) : (
                          <p className="text-lg font-bold text-gray-900">0</p>
                        )}
                      </div>

                      {/* Attempts/Revisits */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">Activity</p>
                        <div className="flex flex-col gap-1">
                          {(question.attemptCount ?? 0) > 0 && (
                            <p className="text-sm text-gray-700 font-medium">Attempts: {question.attemptCount}</p>
                          )}
                          {(question.revisitCount ?? 0) > 0 && (
                            <p className="text-sm text-gray-700 font-medium">Revisits: {question.revisitCount}</p>
                          )}
                          {!(question.attemptCount ?? 0) && !(question.revisitCount ?? 0) && (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </div>
                      </div>

                      {/* View Details Button */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => {
                            const questionKey = question.responseId || `question-${index}`;
                            setExpandedQuestionId(expandedQuestionId === questionKey ? null : questionKey);
                          }}
                          className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                          style={{ color: brandTheme.colors.primary }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {expandedQuestionId === (question.responseId || `question-${index}`) ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            {/* Empty State Graphic */}
            <div className="relative mb-8">
              {/* Decorative circles */}
              <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-100 rounded-full opacity-50"></div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-100 rounded-full opacity-50"></div>
              
              {/* Main illustration container */}
              <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-12 shadow-lg">
                {/* Clipboard icon */}
                <div className="relative">
                  <FontAwesomeIcon icon={faClipboardList} className="text-gray-300 text-8xl" />
                  {/* Checkmark overlay */}
                  <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-3 shadow-md">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandTheme.colors.primary}20` }}>
                      <FontAwesomeIcon icon={faQuestionCircle} style={{ color: brandTheme.colors.primary }} className="text-xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="text-center max-w-md">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">No Questions Attempted</h3>
              <p className="text-gray-600 text-base leading-relaxed mb-2">
                This student was present for the exam but did not attempt any questions.
              </p>
              <p className="text-gray-500 text-sm">
                Check the exam settings or reach out to the student for more information.
              </p>
            </div>

            {/* Additional context */}
            <div className="mt-10 flex items-center space-x-2 text-sm text-gray-500">
              <FontAwesomeIcon icon={faClock} />
              <span>Time spent: {attemptData?.timeSpent ? formatTime(attemptData.timeSpent) : '0m 0s'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Violations Modal - Slide from Right */}
      <div className={`fixed inset-0 z-[9999] flex items-start justify-end p-2 transition-opacity duration-300 ${
        showViolationsModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
          onClick={() => { setShowViolationsModal(false); setSelectedViolations([]); setSelectedQuestionNo(0); setViolationsCurrentPage(1); }}
        />
        
        <div 
          className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[35rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
            showViolationsModal ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Gradient - Red */}
          <div 
            className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
            style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {selectedQuestionNo === 0 ? 'Violations' : `Violations - Q${selectedQuestionNo}`}
                  {selectedViolations.length > 0 && ` (${selectedViolations.length})`}
                </h2>
                <p className="text-xs text-white/80">
                  {student?.studentName || student?.fullName || 'Student'} • Roll No: {student?.studentRoll || student?.rollNumber || '—'}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setShowViolationsModal(false); setSelectedViolations([]); setSelectedQuestionNo(0); setViolationsCurrentPage(1); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faTimes} className="text-white" />
            </button>
          </div>
          
          {/* Violation Summary Badges */}
          {selectedViolations.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center space-x-2 flex-wrap gap-y-2">
              {(() => {
                const summary = {
                  critical: selectedViolations.filter(v => v.severity === 'critical').length,
                  high: selectedViolations.filter(v => v.severity === 'high').length,
                  medium: selectedViolations.filter(v => v.severity === 'medium').length,
                  low: selectedViolations.filter(v => v.severity === 'low' || !v.severity).length
                };
                
                return (
                  <>
                    {summary.critical > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span>Critical: {summary.critical}</span>
                      </span>
                    )}
                    {summary.high > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        <span>High: {summary.high}</span>
                      </span>
                    )}
                    {summary.medium > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span>Medium: {summary.medium}</span>
                      </span>
                    )}
                    {summary.low > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>Low: {summary.low}</span>
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          
          {/* Violations Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {selectedViolations.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const startIdx = (violationsCurrentPage - 1) * VIOLATIONS_PER_PAGE;
                  const endIdx = startIdx + VIOLATIONS_PER_PAGE;
                  const pageViolations = selectedViolations.slice(startIdx, endIdx);
                  
                  return pageViolations.map((violation: any, vIdx: number) => {
                    const severityLevel = violation.severity || 'low';
                    return (
                      <div 
                        key={startIdx + vIdx} 
                        className={`p-3 rounded-xl border ${
                          severityLevel === 'critical' 
                            ? 'bg-red-50 border-red-200' 
                            : severityLevel === 'high'
                            ? 'bg-orange-50 border-orange-200'
                            : severityLevel === 'medium'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        {/* Top Row: Icon, Title, Play Button */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              severityLevel === 'critical' ? 'bg-red-100' :
                              severityLevel === 'high' ? 'bg-orange-100' :
                              severityLevel === 'medium' ? 'bg-yellow-100' :
                              'bg-blue-100'
                            }`}>
                              <FontAwesomeIcon 
                                icon={getViolationIcon(violation.type)} 
                                className={`text-sm ${
                                  severityLevel === 'critical' ? 'text-red-600' :
                                  severityLevel === 'high' ? 'text-orange-600' :
                                  severityLevel === 'medium' ? 'text-yellow-600' :
                                  'text-blue-600'
                                }`}
                              />
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900">{getViolationLabel(violation.type)}</h4>
                          </div>
                          
                          {/* Play/View Evidence Button */}
                          {violation.proofUrl && (
                            <button 
                              onClick={() => {
                                const url = violation.proofUrl;
                                const isVideo = url.includes('.webm') || url.includes('.mp4') || url.includes('.mov');
                                setEvidenceModal({ url, type: isVideo ? 'video' : 'image' });
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                severityLevel === 'critical' ? 'bg-red-200 hover:bg-red-300 text-red-700' :
                                severityLevel === 'high' ? 'bg-orange-200 hover:bg-orange-300 text-orange-700' :
                                severityLevel === 'medium' ? 'bg-yellow-200 hover:bg-yellow-300 text-yellow-700' :
                                'bg-blue-200 hover:bg-blue-300 text-blue-700'
                              }`}
                              title="View evidence"
                            >
                              <FontAwesomeIcon 
                                icon={(violation.proofUrl.includes('.webm') || violation.proofUrl.includes('.mp4')) ? faPlay : faImage} 
                                className="text-xs" 
                              />
                            </button>
                          )}
                        </div>
                        
                        {/* Details Text */}
                        {(violation.details || violation.description) && (
                          <p className="text-xs text-gray-600 mb-2 pl-[42px]">{violation.details || violation.description}</p>
                        )}
                        
                        {/* Bottom Row: Badges and Timestamp */}
                        <div className="flex items-center justify-between pl-[42px]">
                          <div className="flex items-center space-x-1.5">
                            {violation.questionNo && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                                Q{violation.questionNo}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              severityLevel === 'critical' ? 'bg-red-200 text-red-800' :
                              severityLevel === 'high' ? 'bg-orange-200 text-orange-800' :
                              severityLevel === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-blue-200 text-blue-800'
                            }`}>
                              {(severityLevel || 'LOW').toUpperCase()}
                            </span>
                          </div>
                          {violation.timestamp && (
                            <p className="text-[10px] text-gray-500">
                              <FontAwesomeIcon icon={faClock} className="mr-1" />
                              {formatTimestamp(violation.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-5xl mb-4" />
                <p className="text-gray-600 text-sm">No violations detected</p>
              </div>
            )}
          </div>

          {/* Footer with Pagination */}
          {selectedViolations.length > VIOLATIONS_PER_PAGE && (
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div className="text-xs text-gray-600">
                Showing {((violationsCurrentPage - 1) * VIOLATIONS_PER_PAGE) + 1} to {Math.min(violationsCurrentPage * VIOLATIONS_PER_PAGE, selectedViolations.length)} of {selectedViolations.length}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViolationsCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={violationsCurrentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    violationsCurrentPage === 1
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1" />
                  Previous
                </button>
                
                <span className="text-xs font-medium text-gray-700">
                  Page {violationsCurrentPage} of {Math.ceil(selectedViolations.length / VIOLATIONS_PER_PAGE)}
                </span>
                
                <button
                  onClick={() => setViolationsCurrentPage(prev => Math.min(Math.ceil(selectedViolations.length / VIOLATIONS_PER_PAGE), prev + 1))}
                  disabled={violationsCurrentPage >= Math.ceil(selectedViolations.length / VIOLATIONS_PER_PAGE)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    violationsCurrentPage >= Math.ceil(selectedViolations.length / VIOLATIONS_PER_PAGE)
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Next
                  <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Close Footer */}
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex justify-end flex-shrink-0 rounded-b-2xl">
            <button 
              onClick={() => { setShowViolationsModal(false); setSelectedViolations([]); setSelectedQuestionNo(0); setViolationsCurrentPage(1); }} 
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Evidence Modal Overlay - for playing violation videos/images */}
      {evidenceModal && (
        <div 
          className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4"
          onClick={() => setEvidenceModal(null)}
        >
          <div 
            className="relative bg-gray-900 rounded-2xl overflow-hidden max-w-full max-h-full shadow-2xl p-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close and Open in New Tab */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-t-xl">
              <span className="text-xs text-gray-400 font-medium">
                {evidenceModal.type === 'video' ? '🎬 Video Evidence' : '🖼️ Image Evidence'}
              </span>
              <div className="flex items-center space-x-2">
                <a
                  href={evidenceModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all flex items-center space-x-1"
                >
                  <FontAwesomeIcon icon={faExpand} className="text-[10px]" />
                  <span>Open in New Tab</span>
                </a>
                <button
                  onClick={() => setEvidenceModal(null)}
                  className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition-all"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-white text-sm" />
                </button>
              </div>
            </div>
            
            {/* Media Content */}
            <div className="bg-black rounded-b-xl flex items-center justify-center min-h-[200px] min-w-[300px]">
              {evidenceModal.type === 'video' ? (
                <video 
                  key={evidenceModal.url}
                  controls 
                  autoPlay
                  playsInline
                  className="max-w-[80vw] max-h-[70vh] rounded-b-lg"
                >
                  <source src={evidenceModal.url} type="video/webm" />
                  <source src={evidenceModal.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img 
                  key={evidenceModal.url}
                  src={evidenceModal.url} 
                  alt="Evidence" 
                  className="max-w-[80vw] max-h-[70vh] object-contain rounded-b-lg"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-orange-600 text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Re-evaluate Questions</h3>
                  <p className="text-sm text-gray-600">Found {stuckQuestionsToRetry.length} stuck evaluation(s)</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700 mb-4">Would you like to re-evaluate these stuck questions?</p>
              <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {stuckQuestionsToRetry.map((question: any) => (
                    <div key={question.questionNo} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold">Q{question.questionNo}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{question.evaluationStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end space-x-3">
              <button onClick={() => { setShowConfirmModal(false); setStuckQuestionsToRetry([]); }} className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">
                Cancel
              </button>
              <button onClick={handleConfirmReEvaluate} className="px-6 py-2.5 rounded-lg font-medium text-white" style={{ backgroundColor: brandTheme.colors.primary }}>
                Re-evaluate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}