import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RichTextEditor from './RichTextEditor';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Extend Window interface for Monaco key tracking
declare global {
  interface Window {
    __lastMonacoKey?: string;
  }
}
import { 
  faGripVertical,
  faChevronUp,
  faChevronDown,
  faBookmark,
  faCircleCheck,
  faPaperPlane,
  faChevronLeft,
  faChevronRight,
  faCode,
  faPlay,
  faListCheck,
  faPenToSquare,
  faShuffle,
  faEllipsisVertical,
  faMoon,
  faSun,
  faClock,
  faChartLine,
  faCircleInfo,
  faLightbulb,
  faMemory,
  faHourglass,
  faXmark,
  faImage,
  faKeyboard,
  faTerminal
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service'; // Added Firebase import
import { useExamAttempt } from './useExamAttempt';
import { offlineQueueService, type SyncStatus } from './services/offline_queue_service';
import { violationQueueService } from './services/violation_queue_service';
import { 
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  COMPLEXITY_LEVELS,
  COMPLEXITY_LEGACY_MAP,
  EXAM_MODES,
  SUBMIT_STATUS,
  VIOLATION_TYPES,
  VIOLATION_SEVERITY_MAP,
  VIOLATION_DESCRIPTIONS,
  MAX_VIOLATIONS,
  type QuestionType,
  type ComplexityLevel,
  type SeverityLevel,
  type ViolationType,
  type SubmitStatus
} from './constants';
import TestCasesPanel from './TestCasesPanel';
import { judge0Service } from './services/judge0_service';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ExamMonitor from './ExamMonitor';
import * as faceapi from 'face-api.js';

// ==================== HELPER FUNCTIONS ====================

/**
 * Normalize SQL rows - handles both array and object formats from Firebase
 * Firebase may store rows as {0: {...}, 1: {...}} instead of [{...}, {...}]
 */
function normalizeRows(rows: any): any[] {
  if (!rows) return [];
  if (Array.isArray(rows)) return rows;
  if (typeof rows === 'object') {
    return Object.keys(rows).sort((a, b) => Number(a) - Number(b)).map(key => rows[key]);
  }
  return [];
}

/**
 * Normalize question type from various formats to standard QuestionType
 */
const normalizeQuestionType = (type: string): QuestionType => {
  const normalized = type.toLowerCase().replace(/ /g, '');
  const typeMap: Record<string, QuestionType> = {
    'mcq': QUESTION_TYPES.MCQ,
    'fitb': QUESTION_TYPES.FITB,
    'descriptive': QUESTION_TYPES.DESCRIPTIVE,
    'jumbled': QUESTION_TYPES.JUMBLED,
    'code': QUESTION_TYPES.CODE,
    'sql': QUESTION_TYPES.SQL,
    'likert': QUESTION_TYPES.LIKERT
  };
  return typeMap[normalized] || type as QuestionType;
};

/**
 * Normalize complexity level from various formats to standard ComplexityLevel
 */
const normalizeComplexity = (complexity: string): ComplexityLevel => {
  return (COMPLEXITY_LEGACY_MAP as any)[complexity] || COMPLEXITY_LEVELS.EASY;
};


interface Violation {
  type: ViolationType;
  timestamp: string;
  details?: string;
  severity: SeverityLevel;
  questionNo: number;
  questionId: string;
  proofUrl?: string;
}


interface Question {
  id: string;
  questionNo: number;
  questionText: string;
  description: string;
  type: QuestionType;
  maxMarks: number;
  complexity: ComplexityLevel;
  chapter?: string; 
  imageUrls?: string[];
  // MCQ specific
  options?: string[];
  blanksCount?: number;
  correctAnswer?: number | string; // Single correct answer (backward compatibility)
  correctAnswers?: (number | string)[]; // ✅ Used for MCQ (correct options), FITB (correct blanks), and Jumbled (correct sequence)
  multipleCorrect?: boolean; // Whether multiple answers are correct (MCQ only)
  // FITB specific - uses correctAnswers for the correct blank values
  correctBlanks?: string[]; // Alias for correctAnswers (for compatibility)
  // Jumbled specific - uses correctAnswers for the correct sequence
  jumbledItems?: string[]; // Items to be arranged (backend field name)
  jumbledOptions?: string[]; // Alternative field name for jumbled items
  // Coding specific
  boilerplate?: string; // Starting code (testStub in backend) - legacy single language
  starterCodes?: Array<{ code: string; language: string }>; // Multi-language starter codes
  testCases?: Array<{ input: string; expected_output?: string; output?: string; marks?: number; sqlInput?: any; sqlExpectedOutput?: any }>; // Test cases
  language?: string; // Programming language
  solution?: string; // Correct solution (for reference, not shown to student)
  hint?: string; // Optional hint
  // SQL specific
  isSql?: boolean; // Flag for SQL type questions
  tableSchema?: any; // Table schema(s) for SQL problems
  // Pool flag
  fromPool?: boolean; // Flag indicating if question is from random pool
}

interface ExamsInterfaceProps {
  examId: string;
  
  // User fields (matching unified User interface)
  userId: string;              // ✅ Already correct
  userFullName: string;        // Changed from 'userFullName'
  userEmail: string;           // ✅ Already correct
  userStudentRoll: string;     // Changed from 'userStudentRoll'
  userStudentClass: string;    // Changed from 'userStudentClass'
  userType: string;            // ✅ Already correct
  proctoringPhotos?: {
    front: string | null;
    left: string | null;
    right: string | null;
  };
  
  // Exam fields
  examTitle: string;
  examSubject: string;
  examType: string;
  board: string;
  academicYear: string;
  totalMarks: number;
  duration: number;
  examDate: string;
  examTime: string;
  completionPolicy?: 'strict' | 'flexible';
  collegeId: string;
  collegeName: string;
  selectedAudioDeviceId?: string;
  
  // Callbacks
  onSubmitExam: (attempt: any) => void;
  onExitExam: () => void;
  onDirectExit?: () => void;
}

// Drag and Drop Component for Jumbled Questions
interface DraggableItemProps {
  item: string;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  darkMode: boolean;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ item, index, moveItem, darkMode }) => {
  const [isDragging, setIsDragging] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const dragImageRef = useRef<HTMLElement | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Create a custom drag image to keep text visible
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const dragImage = itemRef.current.cloneNode(true) as HTMLElement;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-10000px';
      dragImage.style.left = '-10000px';
      dragImage.style.width = rect.width + 'px';
      dragImage.style.opacity = '1';
      dragImage.style.pointerEvents = 'none';
      document.body.appendChild(dragImage);
      dragImageRef.current = dragImage;
      
      // Calculate offset based on where the user clicked within the element
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      
      // Set the drag image with proper offset
      e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
    }
    
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (draggedIndex !== index && !isNaN(draggedIndex)) {
      moveItem(draggedIndex, index);
    }
    setIsDragging(false);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Clean up the drag image after drag ends
    if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
  };

  return (
    <div
      ref={itemRef}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      className={`flex items-center space-x-3 p-4 mb-3 rounded-lg cursor-move transition-all border ${
        isDragging 
          ? darkMode
            ? 'bg-gray-600 border-gray-500 opacity-50' 
            : 'bg-gray-100 border-gray-400 opacity-50'
          : darkMode 
            ? 'bg-gray-700 hover:bg-gray-600 border-gray-600' 
            : 'bg-white hover:bg-gray-50 shadow-md border-gray-300'
      }`}
    >
      <FontAwesomeIcon icon={faGripVertical} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
      <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        {index + 1}.
      </span>
      <span className={`flex-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {item}
      </span>
    </div>
  );
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Deterministic shuffle based on userId seed
 * Same userId will always get the same shuffle for the same questions
 */
const seededShuffle = <T,>(array: T[], seed: string): T[] => {
  // Create a copy to avoid mutating the original
  const shuffled = [...array];
  
  // Simple hash function to convert seed to number
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Seeded random number generator (LCG algorithm)
  let randomSeed = Math.abs(hash);
  const seededRandom = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  };
  
  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

/**
 * ✅ NEW: Get visible test cases for display (1/3 of total, minimum 2)
 * The full test cases are still used for evaluation
 */
const getVisibleTestCases = (testCases: any[], isSql?: boolean): any[] => {
  if (!testCases || testCases.length === 0) return [];
  
  // Calculate 1/3 of test cases, minimum 2
  const visibleCount = Math.max(2, Math.ceil(testCases.length / 3));
  
  // Return first N test cases
  return testCases.slice(0, visibleCount).map(tc => {
    // SQL test cases have sqlInput/sqlExpectedOutput, not string input/output
    if (isSql || tc.sqlInput || tc.sqlExpectedOutput) {
      return { ...tc };
    }
    // CODE test cases — unescape newlines
    return {
      ...tc,
      input: tc.input ? tc.input.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : tc.input,
      expected_output: tc.expected_output ? tc.expected_output.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : tc.expected_output,
      output: tc.output ? tc.output.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : tc.output
    };
  });
};

/**
 * ✅ NEW: Select random questions from pool with fair chapter distribution
 * Ensures questions are distributed evenly across all chapters/topics
 * Uses seeded randomization for consistency per student
 */
const selectQuestionsFromPool = (
  questionPool: any[],
  pickRandomCount: number,
  poolQuestionMarks: number,
  userId: string,
  examId: string
): any[] => {
  // console.log('\n🎲 QUESTION POOL SELECTION:');
  // console.log('  - Pool size:', questionPool.length);
  // console.log('  - Questions to pick:', pickRandomCount);
  // console.log('  - Marks per question:', poolQuestionMarks);
  
  // Edge case: If pool is empty, return empty
  if (!questionPool || questionPool.length === 0) {
    // console.warn('  ⚠️ Question pool is empty');
    return [];
  }
  
  // Edge case: If need more than available, take all
  if (pickRandomCount >= questionPool.length) {
    // console.warn(`  ⚠️ Picking all ${questionPool.length} questions (requested ${pickRandomCount})`);
    return questionPool.map(q => ({
      ...q,
      maxMarks: poolQuestionMarks,
      marks: poolQuestionMarks,
      fromPool: true
    }));
  }
  
  // Step 1: Group questions by chapter/board/topic
  const questionsByChapter = new Map<string, any[]>();
  
  questionPool.forEach(q => {
    // Use chapter, if not available use board, if not available use 'General'
    const chapter = q.chapter || q.board || q.subject || 'General';
    if (!questionsByChapter.has(chapter)) {
      questionsByChapter.set(chapter, []);
    }
    questionsByChapter.get(chapter)!.push(q);
  });
  
  // console.log('  - Chapters/topics found:', questionsByChapter.size);
  questionsByChapter.forEach((_questions, _chapter) => {
    // console.log(`    • ${chapter}: ${questions.length} questions`);
  });
  
  // Step 2: Calculate fair distribution
  const totalChapters = questionsByChapter.size;
  const baseQuota = Math.floor(pickRandomCount / totalChapters);
  
  // console.log('\n  📊 Distribution calculation:');
  // console.log(`    - Base quota per chapter: ${baseQuota}`);
  // console.log(`    - Remainder to distribute: ${remainder}`);
  
  // Step 3: Select questions from each chapter
  const selectedQuestions: any[] = [];
  let remainingToSelect = pickRandomCount;
  
  // Round 1: Give each chapter its base quota
  // console.log('\n  🔄 Round 1: Base distribution');
  const chaptersArray = Array.from(questionsByChapter.entries());
  
  chaptersArray.forEach(([chapter, questions]) => {
    const quota = Math.min(baseQuota, questions.length, remainingToSelect);
    
    if (quota > 0) {
      // Shuffle questions for this chapter with seeded randomization
      const shuffled = seededShuffle(questions, `${userId}_${examId}_${chapter}`);
      const selected = shuffled.slice(0, quota);
      
      // console.log(`    • ${chapter}: Selected ${selected.length}/${questions.length} questions`);
      selectedQuestions.push(...selected);
      remainingToSelect -= quota;
    }
  });
  
  // Round 2: Distribute remainder to chapters with capacity
  if (remainingToSelect > 0) {
    // console.log(`\n  🔄 Round 2: Distributing remainder (${remainingToSelect} questions)`);
    
    // Sort chapters by size (largest first) to prefer chapters with more questions
    const chaptersWithCapacity = chaptersArray
      .filter(([chapter, questions]) => {
        const alreadySelected = selectedQuestions.filter(q => 
          (q.chapter || q.board || q.subject || 'General') === chapter
        ).length;
        return questions.length > alreadySelected;
      })
      .sort((a, b) => b[1].length - a[1].length);
    
    for (const [chapter, questions] of chaptersWithCapacity) {
      if (remainingToSelect === 0) break;
      
      const alreadySelected = selectedQuestions.filter(q => 
        (q.chapter || q.board || q.subject || 'General') === chapter
      ).length;
      
      const capacity = questions.length - alreadySelected;
      const quota = Math.min(1, capacity, remainingToSelect);
      
      if (quota > 0) {
        // Shuffle and find questions not yet selected
        const shuffled = seededShuffle(questions, `${userId}_${examId}_${chapter}_extra`);
        const alreadySelectedIds = new Set(selectedQuestions.map(q => q.id));
        const notYetSelected = shuffled.filter(q => !alreadySelectedIds.has(q.id));
        
        const selected = notYetSelected.slice(0, quota);
        // console.log(`    • ${chapter}: +${selected.length} additional question(s)`);
        selectedQuestions.push(...selected);
        remainingToSelect -= selected.length;
      }
    }
  }
  
  // Step 4: Assign pool marks and flag
  const poolQuestions = selectedQuestions.map(q => ({
    ...q,
    maxMarks: poolQuestionMarks,
    marks: poolQuestionMarks,
    fromPool: true
  }));
  
  // console.log('\n  ✅ Pool selection complete:');
  // console.log(`    - Selected: ${poolQuestions.length} questions`);
  // console.log(`    - Distribution:`, 
    // Array.from(questionsByChapter.keys()).map(chapter => {
      // const count = poolQuestions.filter(q => 
        // (q.chapter || q.board || q.subject || 'General') === chapter
      // ).length;
      // return `${chapter}(${count})`;
    // }).join(', ')
  // );
  
  return poolQuestions;
};

// Configure Monaco Editor to load from local node_modules instead of CDN
import('@monaco-editor/react').then((module) => {
  if (module.loader) {
    module.loader.config({ monaco });
  }
});

const ExamsInterface: React.FC<ExamsInterfaceProps> = ({
  examId,
  userId,
  userFullName,
  userEmail,
  userStudentRoll,
  userStudentClass,
  userType: _userType,
  proctoringPhotos,
  examTitle,
  examSubject,
  examType,
  board,
  academicYear,
  totalMarks,
  duration,
  examDate,
  examTime,
  completionPolicy = 'strict',
  collegeId,
  collegeName,
  selectedAudioDeviceId,
  onSubmitExam,
  onExitExam,
  onDirectExit
}) => {

  // ==================== 🔒 SECURITY: Suppress console in production ====================
  // Prevents question text, answers, and exam data from leaking to DevTools console
  useEffect(() => {
    const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
    if (!isProduction) return; // Allow logging in development
    
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
      table: console.table,
      dir: console.dir,
      dirxml: console.dirxml,
      trace: console.trace,
      group: console.group,
      groupEnd: console.groupEnd,
    };
    
    const noop = () => {};
    // Suppress all console output during exam
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.table = noop;
    console.dir = noop;
    console.dirxml = noop;
    console.trace = noop;
    console.group = noop;
    console.groupEnd = noop;
    // Keep console.error for critical errors only
    console.error = (...args: any[]) => {
      // Filter out anything containing question/answer data
      const str = args.map(a => String(a)).join(' ');
      if (str.includes('questionText') || str.includes('correctAnswer') || str.includes('starterCode')) return;
      originalConsole.error(...args);
    };
    
    // Show a single warning that console is suppressed
    originalConsole.log('%c⛔ Console output disabled during exam for security.', 
      'color: red; font-size: 16px; font-weight: bold;');
    
    return () => {
      // Restore console on unmount (exam end)
      Object.assign(console, originalConsole);
    };
  }, []);

  // ==================== TIME EXPIRED OVERLAY STATE ====================
  const [showTimeExpiredOverlay, setShowTimeExpiredOverlay] = useState(false);
  const [isSubmittingFromOverlay, setIsSubmittingFromOverlay] = useState(false);
  
  
  // ==================== FETCH ACTUAL QUESTIONS FROM EXAM ====================
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const poolQuestionIdsRef = useRef<string[]>([]);
  const poolQuestionMarksRef = useRef<number>(0);

  // ── TWO-PHASE LIKERT STATE ─────────────────────────────────────────────
  // examPhase: 'likert' = showing personality questions, 'exam' = actual exam
  const [examPhase, setExamPhase] = useState<'likert' | 'exam'>('exam');
  const [likertOnlyQuestions, setLikertOnlyQuestions] = useState<Question[]>([]);
  const [likertDurationMins, setLikertDurationMins] = useState(0);
  const [likertTimeLeft, setLikertTimeLeft] = useState(0);
  const [_likertCurrentIndex, setLikertCurrentIndex] = useState(0);
  const [likertAnswers, setLikertAnswers] = useState<Record<string, string>>({});
  const likertAnswersRef = useRef<Record<string, string>>({});
  const likertAutoAdvanced = React.useRef(false);
  // ──────────────────────────────────────────────────────────────────────
  
  // Fetch questions from exam on mount (with retry to wait for attempt creation)
  useEffect(() => {
    const fetchExamQuestions = async () => {
      try {
        // console.log('\n' + '='.repeat(80));
        // console.log('🔍 FETCHING QUESTIONS FOR EXAM:', examId);
        // console.log('⏰ Fetch timestamp:', new Date().toISOString());
        // console.log('='.repeat(80));
        setQuestionsLoading(true);
        
        // 🔒 SECURITY: Fetch questions via getExamQuestionsList
        // Cloud Function only returns questions if student has an active attempt
        // Retry up to 5 times with delay to wait for attempt creation by useExamAttempt hook
        let examData = null;
        let lastError = null;
        for (let retryCount = 0; retryCount < 5; retryCount++) {
          try {
            examData = await firebaseService.getExamQuestionsList(examId);
            break; // Success, exit retry loop
          } catch (err: any) {
            lastError = err;
            // If it's "No active attempt" error, wait and retry (attempt is being created)
            if (err?.message?.includes('No active attempt') || err?.code === 'permission-denied') {
              console.log(`⏳ Waiting for exam attempt to be created... (retry ${retryCount + 1}/5)`);
              await new Promise(resolve => setTimeout(resolve, 1500 * (retryCount + 1)));
            } else {
              throw err; // Different error, don't retry
            }
          }
        }
        
        if (!examData) {
          if (lastError) {
            console.error('❌ Failed to fetch questions after retries:', lastError);
          } else {
            console.error('❌ No questions returned for exam:', examId);
          }
          setQuestionsLoading(false);
          return;
        }
        
        const { questionsList, questionPool, likertQuestions, enableQuestionPool: _enableQuestionPool, pickRandomCount, poolQuestionMarks, personalityAssessment, likertDuration: lDuration } = examData;
        
        // Check if exam has any questions
        const hasQuestionsList = questionsList && questionsList.length > 0;
        const hasPoolQuestions = questionPool && questionPool.length > 0 && pickRandomCount > 0;
        const hasLikertQuestions = personalityAssessment && likertQuestions && likertQuestions.length > 0;
        
        if (!hasQuestionsList && !hasPoolQuestions && !hasLikertQuestions) {
          console.error('❌ No questions found in exam (neither in questionsList nor questionPool nor likertQuestions)');
          setQuestionsLoading(false);
          return;
        }
        
        // 🚨 CHECK FOR DUPLICATES IN SOURCE DATA
        // console.log('\n🔍 CHECKING FOR DUPLICATES IN SOURCE:');
        const sourceIds = (questionsList || []).map((q: any) => q.id).filter(Boolean);
        const uniqueSourceIds = new Set(sourceIds);
        if (sourceIds.length !== uniqueSourceIds.size) {
          console.error('❌ DUPLICATE IDs FOUND IN FIREBASE DATA!');
          console.error(`  Total questions: ${questionsList?.length || 0}`);
          console.error(`  Unique IDs: ${uniqueSourceIds.size}`);
          console.error(`  Duplicates: ${sourceIds.length - uniqueSourceIds.size}`);
          
          // Find and log the duplicate IDs
          const idCounts = new Map<string, number>();
          sourceIds.forEach(id => {
            idCounts.set(id, (idCounts.get(id) || 0) + 1);
          });
          idCounts.forEach((count, id) => {
            if (count > 1) {
              console.error(`  - ID "${id}" appears ${count} times`);
            }
          });
        } else {
          // console.log('  ✅ All questions have unique IDs in source data');
        }
        
        // Check for duplicate content
        const contentHashes = (questionsList || []).map((q: any) => 
          `${q.questionText}_${q.description}_${q.type}`.toLowerCase()
        );
        const uniqueContentHashes = new Set(contentHashes);
        if (contentHashes.length !== uniqueContentHashes.size) {
          // console.warn('⚠️ DUPLICATE CONTENT FOUND IN FIREBASE DATA!');
          // console.warn(`  Total questions: ${questionsList?.length || 0}`);
          // console.warn(`  Unique content: ${uniqueContentHashes.size}`);
          // console.warn(`  Same content appears multiple times: ${contentHashes.length - uniqueContentHashes.size}`);
          
          // Find duplicate content
          const contentCounts = new Map<string, {count: number, questionTexts: string[]}>();
          (questionsList || []).forEach((q: any, idx: number) => {
            const hash = `${q.questionText}_${q.description}_${q.type}`.toLowerCase();
            const existing = contentCounts.get(hash) || {count: 0, questionTexts: []};
            existing.count++;
            existing.questionTexts.push(q.questionText || `Question ${idx + 1}`);
            contentCounts.set(hash, existing);
          });
          
          contentCounts.forEach((data) => {
            if (data.count > 1) {
              // console.warn(`  - Content appears ${data.count} times: "${data.questionTexts[0]}"`);
            }
          });
        } else {
          // console.log('  ✅ All questions have unique content');
        }
        // console.log('='.repeat(80));
        
        // ✅ NEW: Check for Question Pool configuration
        // console.log('\n🎯 QUESTION POOL CHECK:');
        if (hasPoolQuestions) {
          // console.log('  ✅ Question Pool enabled!');
          // console.log(`    - Pool size: ${questionPool.length}`);
          // console.log(`    - Pick random count: ${pickRandomCount}`);
          // console.log(`    - Pool question marks: ${poolQuestionMarks || 'N/A'}`);
          
          // Log chapter distribution in pool
          const poolChapters = new Map<string, number>();
          questionPool.forEach((q: any) => {
            const chapter = q.chapter || q.board || q.subject || 'General';
            poolChapters.set(chapter, (poolChapters.get(chapter) || 0) + 1);
          });
          // console.log('    - Chapters in pool:');
          poolChapters.forEach((_count, _chapter) => {
            // console.log(`      • ${chapter}: ${count} questions`);
          });
        } else {
          // console.log('  ℹ️ No question pool configured - using only questionsList');
        }
        // console.log('='.repeat(80));
        
        // Map exam questions to Question interface
        const examQuestions: Question[] = (questionsList || []).map((q: any, index: number) => {
          // console.log(`\n  🔍 Raw Question ${index + 1} from backend:`, {
            // id: q.id,
            // type: q.type,
            // chapter: q.chapter, // ✅ DEBUG: Check chapter in raw data
            // complexity: q.complexity, // ✅ DEBUG: Check complexity in raw data
            // hasTestStub: !!q.testStub,
            // testStubLength: q.testStub?.length || 0,
            // hasSolution: !!q.solution,
            // solutionLength: q.solution?.length || 0,
            // hasBoilerplate: !!q.boilerplate
          // });

          // ✅ DEBUG EVERY QUESTION'S CHAPTER
          // console.log(`\n📖 Question ${index + 1} RAW chapter:`, {
            // id: q.id,
            // 'q.chapter': q.chapter,
            // 'has chapter?': !!q.chapter,
            // 'all keys': Object.keys(q).slice(0, 10)
          // });
          
          // ✅ DEBUG: Detailed chapter check
          // console.log(`  📖 CHAPTER DEBUG for Question ${index + 1}:`, {
            // 'q.chapter value': q.chapter,
            // 'typeof chapter': typeof q.chapter,
            // 'chapter === undefined': q.chapter === undefined,
            // 'chapter === null': q.chapter === null,
            // 'chapter === ""': q.chapter === '',
            // 'chapter length': q.chapter?.length
          // });
          
          // Normalize question type using constants
          let questionType: QuestionType = QUESTION_TYPES.DESCRIPTIVE; // default
          const typeStr = (q.type || '').toLowerCase();
          
          // ✅ ENHANCED: Also check for field presence to determine type
          const hasOptions = q.options && q.options.length > 0;
          
          if (typeStr === QUESTION_TYPES.MCQ) {
            questionType = QUESTION_TYPES.MCQ;
          } else if (typeStr === QUESTION_TYPES.FITB) {
            questionType = QUESTION_TYPES.FITB;
          } else if (typeStr === QUESTION_TYPES.JUMBLED) {
            // ✅ FIX: Also detect jumbled by presence of jumbledOptions/jumbledItems
            questionType = QUESTION_TYPES.JUMBLED;
          } else if (typeStr === QUESTION_TYPES.CODE) {
            // ✅ FIX: Also detect coding by presence of testCases
            questionType = QUESTION_TYPES.CODE;
          } else if (typeStr === QUESTION_TYPES.SQL) {
            questionType = QUESTION_TYPES.SQL;
          } else if (typeStr === QUESTION_TYPES.DESCRIPTIVE) {
            questionType = QUESTION_TYPES.DESCRIPTIVE;
          } else if (hasOptions) {
            // ✅ FIX: Detect MCQ by presence of options
            questionType = QUESTION_TYPES.MCQ;
          } else {
            questionType = QUESTION_TYPES.DESCRIPTIVE;
          }
          
          // Normalize complexity
          let complexity: ComplexityLevel = COMPLEXITY_LEVELS.EASY; // default
          const complexityStr = (q.complexity || 'basic').toLowerCase();
          if (complexityStr === COMPLEXITY_LEVELS.MEDIUM) {
            complexity = COMPLEXITY_LEVELS.MEDIUM;
          } else if (complexityStr === COMPLEXITY_LEVELS.HARD) {
            complexity = COMPLEXITY_LEVELS.HARD;
          }
          
          const mappedQuestion = {
            // 🔑 ENSURE UNIQUE ID: Use Firebase ID if available, otherwise generate based on content hash
            id: q.id || `q_${q.questionText?.substring(0, 20).replace(/\s+/g, '_')}_${index}_${Date.now() % 10000}`,
            questionNo: index + 1,
            questionText: q.questionText || `Question ${index + 1}`,
            description: q.description || '',
            type: questionType,
            maxMarks: q.maxMarks || q.marks || 5,
            complexity: complexity,
            chapter: q.chapter || undefined,
            imageUrls: q.imageUrls, 
            // MCQ specific - options array and correctAnswers array
            options: q.options || [],
            correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',  // Keep for backward compatibility
            correctAnswers: q.correctAnswers || undefined,  // ✅ Used for MCQ, FITB, and Jumbled
            multipleCorrect: q.multipleCorrect !== undefined 
              ? q.multipleCorrect 
              : (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1),  // ✅ Auto-detect: if multiple correct answers, allow multiple selections
            // FITB specific - uses correctAnswers for correct blank values
            correctBlanks: q.correctAnswers || [],  // Alias for correctAnswers
            // Jumbled specific - uses correctAnswers for correct sequence
            jumbledOptions: q.jumbledOptions || q.jumbledItems || [],
            jumbledItems: q.jumbledItems || q.jumbledOptions || [], // Also set jumbledItems for compatibility
            // Coding specific - CRITICAL: Never load solution, only testStub
            starterCodes: q.starterCodes || q.starter_codes || [],
            boilerplate: (q.starterCodes || q.starter_codes)?.length > 0
              ? ((q.starterCodes || q.starter_codes)[0].code || '')
              : (q.testStub || q.boilerplate || ''),
            testCases: questionType === QUESTION_TYPES.SQL
              ? (q.sqlTestCases || q.sql_test_cases || []).map((tc: any) => ({
                  input: '', expected_output: '', marks: tc.marks || q.maxMarks || 5,
                  title: tc.title || '',
                  sqlInput: typeof tc.table_data === 'string' ? JSON.parse(tc.table_data || '{}') : (tc.table_data || {}),
                  sqlExpectedOutput: typeof tc.expected_output === 'string' ? JSON.parse(tc.expected_output || '{"columns":[],"rows":[]}') : (tc.expected_output || { columns: [], rows: [] })
                }))
              : (q.testCases || []),
            language: typeStr === QUESTION_TYPES.SQL
              ? 'sql'
              : (q.starterCodes || q.starter_codes)?.length > 0
                ? (q.starterCodes || q.starter_codes)[0].language.toLowerCase()
                : (q.programmingLanguage || q.programming_language || 'javascript').toLowerCase(),
            solution: q.solution || '', // ONLY for grading reference, NEVER shown to student
            hint: q.hint || '', // Optional hint
            // SQL specific
            isSql: questionType === QUESTION_TYPES.SQL,
            tableSchema: q.sqlSchema || q.sql_schema || q.tableSchema || null,
            fromPool: false // Flag to identify regular questions (not from pool)
          };
          
          // console.log(`\n  ✅ Mapped Question ${index + 1}:`);
          // console.log('    - ID:', mappedQuestion.id);
          // console.log('    - Question Text:', mappedQuestion.questionText);
          // console.log('    - Type (from backend):', q.type);
          // console.log('    - Type (detected):', mappedQuestion.type);
          // console.log('    - Max Marks:', mappedQuestion.maxMarks);
          
          // ✅ DEBUG: Chapter after mapping
          // console.log('    📖 CHAPTER AFTER MAPPING:');
          // console.log('       - mappedQuestion.chapter:', mappedQuestion.chapter);
          // console.log('       - typeof chapter:', typeof mappedQuestion.chapter);
          // console.log('       - chapter === undefined:', mappedQuestion.chapter === undefined);
          // console.log('       - Complexity:', mappedQuestion.complexity);
          
          // console.log('    - Detection flags:', {
            // hasJumbledOptions: !!(q.jumbledOptions || q.jumbledItems),
            // hasTestCases: !!(q.testCases && q.testCases.length > 0),
            // hasOptions: !!(q.options && q.options.length > 0),
            // hasCorrectAnswers: !!(q.correctAnswers && Array.isArray(q.correctAnswers))
          // });
          
          // Log type-specific fields
          if (questionType === QUESTION_TYPES.MCQ) {
            // console.log('    - Options count:', mappedQuestion.options.length);
            // console.log('    - Correct Answer index:', mappedQuestion.correctAnswer);
          } else if (questionType === QUESTION_TYPES.FITB) {
            // console.log('    - Number of blanks:', (mappedQuestion as any).blanksCount || mappedQuestion.correctAnswers?.length || 0);
            // console.log('    - Correct answers:', mappedQuestion.correctAnswers);
          } else if (questionType === QUESTION_TYPES.JUMBLED) {
            // console.log('    🔀 JUMBLED QUESTION DETAILS:');
            // console.log('       Raw from Firebase:');
            // console.log('         - q.jumbledOptions:', q.jumbledOptions);
            // console.log('         - q.jumbledItems:', q.jumbledItems);
            // console.log('         - q.correctAnswers:', q.correctAnswers);
            // console.log('       After mapping:');
            // console.log('         - mappedQuestion.jumbledOptions:', mappedQuestion.jumbledOptions);
            // console.log('         - mappedQuestion.jumbledItems:', mappedQuestion.jumbledItems);
            // console.log('         - Items count:', mappedQuestion.jumbledOptions.length);
            // console.log('         - Correct sequence (from correctAnswers):', mappedQuestion.correctAnswers);
            
            // ⚠️ WARNING: Check if jumbled items are empty
            if (mappedQuestion.jumbledOptions.length === 0 && mappedQuestion.jumbledItems.length === 0) {
              console.error('       ❌ ERROR: Jumbled question has NO items!');
              console.error('          This question will not display properly.');
              console.error('          Please check Firebase data for this question.');
            }
        } else if (questionType === QUESTION_TYPES.CODE || questionType === QUESTION_TYPES.SQL) {
            // console.log('    - Programming language:', mappedQuestion.language);
            // console.log('    - Has boilerplate/testStub:', !!mappedQuestion.boilerplate);
            // console.log('    - Boilerplate length:', mappedQuestion.boilerplate?.length || 0);
            // console.log('    - Has solution:', !!mappedQuestion.solution);
            // console.log('    - Solution length:', mappedQuestion.solution?.length || 0);
            // console.log('    - Test cases count:', mappedQuestion.testCases.length);
            
            // ✅ LOG TEST CASE DETAILS TO CHECK expectedOutput
            if (mappedQuestion.testCases.length > 0) {
              // console.log('    📊 TEST CASE DETAILS:');
              // console.log('       - First test case:', mappedQuestion.testCases[0]);
              // console.log('       - Has expectedOutput field?', 'expectedOutput' in mappedQuestion.testCases[0]);
              // console.log('       - expectedOutput value:', mappedQuestion.testCases[0].expectedOutput);
              // console.log('       - All fields in first test case:', Object.keys(mappedQuestion.testCases[0]));
            }
            
            // CRITICAL CHECK: Warn if testStub looks like full solution
            if (mappedQuestion.boilerplate && mappedQuestion.solution && 
                mappedQuestion.boilerplate.length > mappedQuestion.solution.length * 0.8) {
              // console.warn('⚠️ WARNING: testStub is very long (similar to solution length). Check if testStub contains solution!');
            }
          }
          
          return mappedQuestion;
        });
        
        // ✅ NEW: Add questions from Question Pool (if configured)
        let allQuestions = examQuestions;
        
        if (hasPoolQuestions) {
          // console.log('\n🎯 ADDING QUESTIONS FROM POOL:');
          
          const poolQuestions = selectQuestionsFromPool(
            questionPool,
            pickRandomCount,
            poolQuestionMarks || 5,
            userId,
            examId
          );
          
          // Map pool questions to the same Question interface
          const mappedPoolQuestions = poolQuestions.map((q: any, index: number) => {
            // ✅ DEBUG: Log raw pool question data
            // console.log(`\n  🔍 Pool Question ${index + 1} RAW data from Firebase:`);
            // console.log('    - id:', q.id);
            // console.log('    - chapter (raw):', q.chapter);
            // console.log('    - complexity (raw):', q.complexity);
            // console.log('    - typeof chapter:', typeof q.chapter);
            // console.log('    - typeof complexity:', typeof q.complexity);
            // console.log('    - chapter === undefined:', q.chapter === undefined);
            // console.log('    - chapter === null:', q.chapter === null);
            // console.log('    - chapter === "":', q.chapter === '');
            
            // Normalize question type
            let questionType: QuestionType = QUESTION_TYPES.DESCRIPTIVE;
            const typeStr = (q.type || '').toLowerCase();
            const hasOptions = q.options && q.options.length > 0;
            
            if (typeStr === QUESTION_TYPES.MCQ) questionType = QUESTION_TYPES.MCQ;
            else if (typeStr === QUESTION_TYPES.FITB) questionType = QUESTION_TYPES.FITB;
            else if (typeStr === QUESTION_TYPES.JUMBLED) questionType = QUESTION_TYPES.JUMBLED;
            else if (typeStr === QUESTION_TYPES.CODE) questionType = QUESTION_TYPES.CODE;
            else if (typeStr === QUESTION_TYPES.SQL) questionType = QUESTION_TYPES.SQL;
            else if (typeStr === QUESTION_TYPES.DESCRIPTIVE) questionType = QUESTION_TYPES.DESCRIPTIVE;
            else if (hasOptions) questionType = QUESTION_TYPES.MCQ;
            
            // Normalize complexity
            let complexity: ComplexityLevel = COMPLEXITY_LEVELS.EASY;
            const complexityStr = (q.complexity || 'basic').toLowerCase();
            if (complexityStr === COMPLEXITY_LEVELS.MEDIUM) complexity = COMPLEXITY_LEVELS.MEDIUM;
            else if (complexityStr === COMPLEXITY_LEVELS.HARD) complexity = COMPLEXITY_LEVELS.HARD;
            
            const mappedQuestion = {
              id: q.id || `pool_q_${index}_${Date.now() % 10000}`,
              questionNo: examQuestions.length + index + 1, // Temporary number, will be reassigned
              questionText: q.questionText || `Question ${index + 1}`,
              description: q.description || '',
              type: questionType,
              maxMarks: q.maxMarks || poolQuestionMarks || 5,
              chapter: q.chapter || undefined, 
              complexity: complexity,
              imageUrls: q.imageUrls,
              options: q.options || [],
              correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
              correctAnswers: q.correctAnswers || undefined,
              multipleCorrect: q.multipleCorrect !== undefined 
                ? q.multipleCorrect 
                : (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1),
              correctBlanks: q.correctAnswers || [],
              jumbledOptions: q.jumbledOptions || q.jumbledItems || [],
              jumbledItems: q.jumbledItems || q.jumbledOptions || [],
              starterCodes: q.starterCodes || q.starter_codes || [],
              boilerplate: (q.starterCodes || q.starter_codes)?.length > 0
                ? ((q.starterCodes || q.starter_codes)[0].code || '')
                : (q.testStub || q.boilerplate || ''),
              testCases: questionType === QUESTION_TYPES.SQL
                ? (q.sqlTestCases || q.sql_test_cases || []).map((tc: any) => ({
                    input: '', expected_output: '', marks: tc.marks || q.maxMarks || 5,
                    title: tc.title || '',
                    sqlInput: typeof tc.table_data === 'string' ? JSON.parse(tc.table_data || '{}') : (tc.table_data || {}),
                    sqlExpectedOutput: typeof tc.expected_output === 'string' ? JSON.parse(tc.expected_output || '{"columns":[],"rows":[]}') : (tc.expected_output || { columns: [], rows: [] })
                  }))
                : (q.testCases || []),
              language: typeStr === QUESTION_TYPES.SQL
                ? 'sql'
                : (q.starterCodes || q.starter_codes)?.length > 0
                  ? (q.starterCodes || q.starter_codes)[0].language.toLowerCase()
                  : (q.programmingLanguage || q.programming_language || 'javascript').toLowerCase(),
              solution: q.solution || '',
              hint: q.hint || '',
              isSql: questionType === QUESTION_TYPES.SQL,
              tableSchema: q.sqlSchema || q.sql_schema || q.tableSchema || null,
              fromPool: true // Flag to identify pool questions
            };
            
            // ✅ DEBUG: Log mapped pool question
            // console.log(`  ✅ Pool Question ${index + 1} AFTER mapping:`);
            // console.log('    - id:', mappedQuestion.id);
            // console.log('    - chapter (mapped):', mappedQuestion.chapter);
            // console.log('    - complexity (mapped):', mappedQuestion.complexity);
            // console.log('    - fromPool:', mappedQuestion.fromPool);
            
            return mappedQuestion;
          });
          
          // console.log(`  ✅ Mapped ${mappedPoolQuestions.length} pool questions`);
          // console.log(`  📊 Total questions: ${examQuestions.length} (fixed) + ${mappedPoolQuestions.length} (pool) = ${examQuestions.length + mappedPoolQuestions.length}`);
          
          // Merge questionsList and pool questions
          allQuestions = [...examQuestions, ...mappedPoolQuestions];
          
          // ✅ Store presented pool question IDs and marks for saving to attempt
          poolQuestionIdsRef.current = mappedPoolQuestions.map(q => q.id);
          poolQuestionMarksRef.current = poolQuestionMarks || 5;
          // console.log(`  📋 Stored ${poolQuestionIdsRef.current.length} pool question IDs (${poolQuestionMarksRef.current} marks each) for attempt`);
        }
        
        // 🎲 RANDOMIZE QUESTION ORDER FOR EACH STUDENT
        // Each student gets a different random order, but consistent for the same student
        const shuffledQuestions = seededShuffle(allQuestions, userId + examId);
        
        // console.log('\n🎲 RANDOMIZATION:');
        // console.log('  ✅ Original question order (before shuffle):', allQuestions.map(q => q.id));
        // console.log('  🎲 Randomized question order for user', userId, ':', shuffledQuestions.map(q => q.id));
        // console.log('  📝 Randomized questions:', shuffledQuestions.map(q => q.questionText.substring(0, 50) + '...'));
        
        // 🚨 DUPLICATE DETECTION: Check for duplicate questions
        const seenIds = new Set<string>();
        const seenContent = new Map<string, number>(); // Track by content hash
        const duplicates: Array<{original: number, duplicate: number, id: string, questionText: string}> = [];
        
        shuffledQuestions.forEach((q, index) => {
          // Check for duplicate IDs
          if (seenIds.has(q.id)) {
            const originalIndex = shuffledQuestions.findIndex(sq => sq.id === q.id);
            duplicates.push({
              original: originalIndex + 1,
              duplicate: index + 1,
              id: q.id,
             questionText: q.questionText
            });
          }
          seenIds.add(q.id);
          
          // Check for duplicate content (same title + description)
          const contentHash = `${q.questionText}_${q.description}_${q.type}`;

          if (seenContent.has(contentHash)) {
            // const _originalIndex = seenContent.get(contentHash)!;
            // console.warn(`⚠️ DUPLICATE CONTENT detected at position ${index + 1}, original at ${originalIndex + 1}`);
            // console.warn(`   Question Text: \"${q.questionText}\"`);
            // console.warn(`   Type: ${q.type}`);
            // console.warn(`   This question may be a duplicate!`);
          }
          seenContent.set(contentHash, index);
        });
        
        // 🚨 REMOVE DUPLICATES: Keep only unique questions by ID
        const uniqueQuestions = shuffledQuestions.filter((q, index, self) => 
          index === self.findIndex((t) => t.id === q.id)
        );
        
        if (duplicates.length > 0) {
          console.error('\n❌❌❌ DUPLICATE QUESTIONS DETECTED! ❌❌❌');
          console.error(`  Found ${duplicates.length} duplicate question(s):`);
          duplicates.forEach(dup => {
            console.error(`  - Question ID "${dup.id}" appears at positions ${dup.original} and ${dup.duplicate}`);
            console.error(`    Question Text: "${dup.questionText}"`);
          });
          console.error(`  🔧 FIXED: Removed ${shuffledQuestions.length - uniqueQuestions.length} duplicate(s)`);
          console.error(`  ✅ Proceeding with ${uniqueQuestions.length} unique questions`);
          console.error('='.repeat(80));
        }
        
        // Update questionNo to reflect new order
        const finalQuestions = uniqueQuestions.map((q, index) => ({
          ...q,
          questionNo: index + 1
        }));
        
        // console.log('\n✅ QUESTIONS LOADED SUCCESSFULLY');
        // console.log('  - Total questions loaded:', finalQuestions.length);
        // console.log('  - Fetch completed at:', new Date().toISOString());
        
        // ✅ DEBUG: Final chapter check before setting state
        // console.log('\n📖 FINAL CHAPTER CHECK - Before setQuestions():');
        // console.log('  - Total questions:', finalQuestions.length);
        finalQuestions.slice(0, 3).forEach((_q, _i) => {
          // console.log(`  - Question ${i + 1}:`, {
            // id: q.id,
            // questionNo: q.questionNo,
            // chapter: q.chapter,
            // complexity: q.complexity,
            // fromPool: q.fromPool,
            // 'typeof chapter': typeof q.chapter,
            // 'chapter === undefined': q.chapter === undefined
          // });
        });
        if (finalQuestions.length > 3) {
          // console.log('  ... (showing first 3 of', finalQuestions.length, 'questions)');
        }
        
        // console.log('='.repeat(80) + '\n');
        
        setQuestions(finalQuestions);

        // ── DETECT LIKERT PHASE ────────────────────────────────────────────
        if (personalityAssessment && likertQuestions.length > 0 && lDuration > 0) {
          const likertMapped: Question[] = likertQuestions.map((lq: any, idx: number) => ({
            id: lq.id || `likert_${idx}`,
            questionNo: idx + 1,
            questionText: lq.questionText || lq.statement || lq.text || `Statement ${idx + 1}`,
            description: lq.description || '',
            type: QUESTION_TYPES.LIKERT as QuestionType,
            options: lq.options || [],
            correctAnswer: '',
            maxMarks: 0,
            marks: 0,
            complexity: 'easy' as any,
            chapter: lq.trait || lq.chapter || 'Personality',
            likertTrait: lq.trait || lq.likertTrait || '',
            likertDirection: lq.direction || lq.likertDirection || 'positive',
          }));
          setLikertOnlyQuestions(likertMapped);
          setLikertDurationMins(lDuration);
          // Prepend likert questions into main questions array so they use the normal interface
          const likertWithFlag = likertMapped.map(q => ({ ...q, isFromLikert: true }));
          setQuestions(prev => [...likertWithFlag, ...prev.map((q, i) => ({ ...q, questionNo: likertMapped.length + i + 1 }))]);
          // Phase & timer will be resolved in loadAnswers (after attempt is ready)
          // so we can check how much time has already elapsed
        }
        // ──────────────────────────────────────────────────────────────────

        setQuestionsLoading(false);
        
      } catch (error) {
        console.error('❌ Error fetching exam questions:', error);
        setQuestionsLoading(false);
      }
    };
    
    fetchExamQuestions();
  }, [examId, userId]);
  
  // 🔥 DEBUG: Track component lifecycle
  useEffect(() => {
    // console.log('🚀🚀🚀 ExamsInterface MOUNTED 🚀🚀🚀');
    // console.log('📋 examId:', examId, '| userId:', userId);
    return () => {
      // console.log('💀💀💀 ExamsInterface UNMOUNTED 💀💀💀');
    };
  }, []);
  
  // 🔥 CLEANUP: Reset all state when examId changes (entering a new exam)
  useEffect(() => {
    // console.log('🔄 examId changed, resetting all state:', examId);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setCodeInput('');
    setMcqAnswer([]);
    setDescriptiveAnswer('');
    setFillBlanksAnswers([]);
    setJumbledAnswers([]);
    // ✅ FIX: Reload bookmarks from localStorage instead of wiping them
    const saved = localStorage.getItem(`examBookmarks_${examId}_${userId}`);
    if (saved) {
      try {
        setBookmarkedQuestions(new Set(JSON.parse(saved)));
      } catch {
        setBookmarkedQuestions(new Set());
      }
    } else {
      setBookmarkedQuestions(new Set());
    }
    setAnswersInitialized(false); // ✅ Reset answers initialized flag
    setIsCleanupComplete(false); // ✅ Reset cleanup flag for new exam
    // console.log('✅ State reset complete');
  }, [examId]);
  
  // 1. Memoize User Object (Stable Reference)
  const userObj = useMemo(() => ({
    userId,
    fullName: userFullName,
    email: userEmail,
    rollNumber: userStudentRoll,
    class: userStudentClass,
  }), [userId, userFullName, userEmail, userStudentRoll, userStudentClass]);

  // 2. Memoize Exam Data Object (Stable Reference)
  // This prevents the infinite loop caused by questions.map() creating a new array every render
  const examObj = useMemo(() => ({
    id: examId,
    title: examTitle || 'Exam',
    subject: examSubject || 'General',
    type: examType || 'Online',
    board: board || 'CBSE',
    year: academicYear || new Date().getFullYear().toString(),
    duration: (duration || 60).toString(),
    maxMarks: (totalMarks || 100).toString(),
    mode: EXAM_MODES.ONLINE,
    collegeId: collegeId || 'default',
    collegeName: collegeName || 'School',
    totalQuestions: questions.length,
    questionsList: questions.map(q => ({
      ...q,
      type: normalizeQuestionType(q.type),
      complexity: normalizeComplexity(q.complexity),
    })),
  }), [examId, examTitle, examSubject, examType, board, academicYear, duration, totalMarks, collegeId, collegeName, questions]);

  // 3. Pass Stable Objects to Hook
  const {
    attempt,
    loading: attemptLoading,
    error: attemptError,
    isAlreadySubmitted,
    refreshAttempt,   
    addViolation: addViolationToAttempt,
    submitExam: submitExamToFirebase,
  } = useExamAttempt(
    examId,
    userObj,   // ✅ Now Stable
    examObj    // ✅ Now Stable
  );

// ==================== DEBUG: Track isAlreadySubmitted from hook ====================
useEffect(() => {
  // console.log('\n' + '🎯'.repeat(40));
  // console.log('🎯 ExamsInterface RECEIVED isAlreadySubmitted from hook');
  // console.log('  - Value:', isAlreadySubmitted);
  // console.log('  - Type:', typeof isAlreadySubmitted);
  // console.log('  - Has attempt:', !!attempt);
  // console.log('  - Attempt ID:', attempt?.attemptId || 'none');
  // console.log('  - Attempt status:', attempt?.status || 'none');
  // console.log('🎯'.repeat(40) + '\n');
}, [isAlreadySubmitted, attempt?.attemptId, attempt?.status]);

// ✅ Save presented pool question IDs to attempt document (once both are ready)
const poolIdsSavedRef = useRef(false);
useEffect(() => {
  if (
    attempt?.attemptId && 
    poolQuestionIdsRef.current.length > 0 && 
    !poolIdsSavedRef.current &&
    !isAlreadySubmitted
  ) {
    poolIdsSavedRef.current = true;
    firebaseService.savePoolQuestionIds(attempt.attemptId, poolQuestionIdsRef.current, poolQuestionMarksRef.current);
  }
}, [attempt?.attemptId, questions.length, isAlreadySubmitted]);

// ==================== REGISTER VIOLATION QUEUE SYNC CALLBACK ====================
useEffect(() => {
  // Register callback to sync violations from queue to Firebase
  violationQueueService.setSyncCallback(async (queuedViolation) => {
    try {
      // console.log(`🔄 Syncing queued violation from offline storage: ${queuedViolation.type}`);
      
      // Upload proof if exists
      let proofUrl: string | undefined = undefined;
      const proofBlob = queuedViolation.videoProof || queuedViolation.frameProof;
      if (proofBlob) {
        try {
          // console.log(`📤 Uploading proof for ${queuedViolation.type}... (examId=${queuedViolation.examId})`);
          const uploadResult = await firebaseService.uploadViolationProof(
            queuedViolation.examId,
            proofBlob
          );
          
          if (uploadResult.success) {
            proofUrl = uploadResult.url;
            // console.log(`✅ Proof uploaded successfully for ${queuedViolation.type}`);
          } else {
            // console.warn(`⚠️ Failed to upload proof for ${queuedViolation.type}, will save violation without proof`);
          }
        } catch (uploadError) {
          console.error('❌ Failed to upload queued violation proof:', uploadError);
          // Continue without proof rather than failing the entire violation sync
        }
      }

      // ✅ FIX: Use current question info from ref (not hardcoded 0)
      const currentQuestionId = currentQuestionRef.current.id;
      const currentQuestionNo = currentQuestionRef.current.no;

      // Create violation object with proof URL if available
      const violation: Violation = {
        type: queuedViolation.type as ViolationType,
        timestamp: new Date(queuedViolation.timestamp).toISOString(),
        details: queuedViolation.details,
        severity: VIOLATION_SEVERITY_MAP[queuedViolation.type as ViolationType] || 'medium',
        questionNo: currentQuestionNo,
        questionId: currentQuestionId,
        proofUrl, // Add proof URL if uploaded
      };

      // Add to Firebase
      await addViolationToAttempt(violation);
      // console.log(`✅ Successfully synced queued violation: ${queuedViolation.type} on Q${currentQuestionNo}${proofUrl ? ' (with proof)' : ' (no proof)'}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync queued violation:', error);
      return false;
    }
  });
}, [addViolationToAttempt]);


// ==================== REMOVED: Roll number now handled in firebase_service.startExamAttempt ====================
  
  // Sync status for UI
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    queueLength: 0,
    lastSyncTime: null,
    failedCount: 0,
  });
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [, setLastSavedAnswers] = useState<Record<string, any>>({}); // 🔥 DIRTY FLAG: Track last saved answers
  const [answersInitialized, setAnswersInitialized] = useState(false); // 🔥 NEW: Track if initial answers are loaded
  const answersRef = useRef<Record<string, any>>({}); // ✅ NEW: Ref to always access latest answers
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(() => {
    // Load bookmarks from localStorage on mount
    const saved = localStorage.getItem(`examBookmarks_${examId}_${userId}`);
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load bookmarks:', error);
      }
    }
    return new Set();
  });
  const [viewedQuestions, setViewedQuestions] = useState<Set<string>>(new Set());
  const [darkMode, setDarkMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [showExamInfoDialog, setShowExamInfoDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(SUBMIT_STATUS.IDLE);
  const [submitMessage, setSubmitMessage] = useState('');
  const [showActivityMonitorDialog, setShowActivityMonitorDialog] = useState(false);
  const [showOfflineSubmitDialog, setShowOfflineSubmitDialog] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [lastSavedQuestion, setLastSavedQuestion] = useState<string | null>(null);
  const [showTestCasesPanel, setShowTestCasesPanel] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [show15MinWarning, setShow15MinWarning] = useState(false);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [phaseTransitionCount, setPhaseTransitionCount] = useState(60);
  const [has15MinWarningShown, setHas15MinWarningShown] = useState(false);
  
  // ==================== TIME TRACKING STATE ====================
  // Track when student started viewing current question
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  // ✅ NEW: Track the actual previous question ID (not calculated from index)
  const [previousQuestionId, setPreviousQuestionId] = useState<string | null>(null);
  // Store total time spent on each question (by question ID)
  const [questionTimeTracking, setQuestionTimeTracking] = useState<Record<string, number>>({});
  // Store time data in localStorage key (for persistence)
  const TIME_TRACKING_KEY = `exam_time_tracking_${examId}_${userId}`;
  
  // ==================== MONITORING STATE ====================
  const [violations, setViolations] = useState<Violation[]>([]);
  
  // ==================== PER-QUESTION VIOLATION TRACKING ====================
  // Track violations grouped by question ID
  const [questionViolations, setQuestionViolations] = useState<Record<string, Violation[]>>({});
  // Store violations data in localStorage key (for persistence)
  const VIOLATIONS_TRACKING_KEY = `exam_violations_${examId}_${userId}`;
  const [violationsLoaded, setViolationsLoaded] = useState(false);
  
  // ✅ REMOVED: pendingViolationsSync - now handled by violationQueueService
  
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);
  const fullscreenEnteredRef = useRef(false);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const [showDevToolsOverlay, setShowDevToolsOverlay] = useState(false);
  const [baselineDescriptors, setBaselineDescriptors] = useState<Float32Array[]>([]);
  const [faceMonitoringEnabled, setFaceMonitoringEnabled] = useState(false);
  const [currentIpAddress, setCurrentIpAddress] = useState<string>('');
  const violationTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastViolationLoggedTime = useRef<Map<ViolationType, number>>(new Map()); // ✅ Track cooldown per violation type
  const violationLimitReached = useRef<boolean>(false);
  const entryTimeRef = useRef<Date>(new Date());
  const tabId = useRef<string>(`exam_tab_${Date.now()}`);
  const currentQuestionRef = useRef<{ index: number; id: string; no: number }>({ 
    index: 0, 
    id: 'unknown', 
    no: 1 
  });
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex >= 0) {
      currentQuestionRef.current = {
        index: currentQuestionIndex,
        id: questions[currentQuestionIndex]?.id || 'unknown',
        no: questions[currentQuestionIndex]?.questionNo || currentQuestionIndex + 1
      };
      // console.log(`📌 Question ref initialized: Q${currentQuestionRef.current.no}`);
    }
  }, [questions.length, currentQuestionIndex]);
  const monitoringStartTime = useRef<number>(0); // Track when monitoring actually starts
  const [isOnline, setIsOnline] = useState(true);
  const connectivityCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineConfirmationTimeout = useRef<number | null>(null);
  
  // Connectivity tracking - using refs to prevent race conditions
  // APPROACH: Track disconnection locally, wait for reconnection, then create ONE Firebase entry
  // When internet disconnects: Store disconnection timestamp locally (can't send to Firebase - no internet!)
  // When internet reconnects: Create ONE complete Firebase entry with:
  //   - Disconnection timestamp
  //   - Reconnection timestamp  
  //   - Exam time loss (calculated difference)
  //   - User IP, ISP info, connection type, etc.
  // Result: ONE Firebase operation with ALL data (not split into create + update)
  const disconnectionStartTime = useRef<Date | null>(null);
  const isProcessingReconnection = useRef<boolean>(false);
  const isProcessingQueue = useRef<boolean>(false);
  const autoSubmitTriggered = useRef<boolean>(false); // ✅ Track if auto-submit has been triggered
  const submittedAttemptData = useRef<any>(null); // ✅ Store attempt data after auto-submit
  
  // ==================== SYNC MONITORING ====================
  useEffect(() => {
    const unsubscribe = offlineQueueService.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);
  
  // ==================== LOAD TIME TRACKING FROM STORAGE ====================
  useEffect(() => {
    // Load time tracking from localStorage on component mount
    try {
      const storedTimeTracking = localStorage.getItem(TIME_TRACKING_KEY);
      if (storedTimeTracking) {
        const parsed = JSON.parse(storedTimeTracking);
        setQuestionTimeTracking(parsed);
        // console.log('⏱️ Loaded time tracking from storage:', Object.keys(parsed).length, 'questions');
      }
    } catch (error) {
      console.error('❌ Error loading time tracking from storage:', error);
    }
  }, [TIME_TRACKING_KEY]);
  
  // ==================== INITIALIZE QUESTION START TIME WHEN EXAM STARTS ====================
  useEffect(() => {
    // Initialize questionStartTime only when attempt is created
    if (attempt && attempt.startTime && questionStartTime === 0) {
      const examStartTime = attempt.startTime instanceof Date 
        ? attempt.startTime.getTime()
        : (attempt.startTime as any).toDate().getTime();
      
      setQuestionStartTime(examStartTime);
      // console.log('⏱️ Initialized questionStartTime to exam start time');
    }
  }, [attempt, questionStartTime]);
  
  // ==================== TRACK TIME WHEN QUESTION CHANGES ====================
  useEffect(() => {
    const currentQuestionId = questions[currentQuestionIndex]?.id;
    
    if (!currentQuestionId) return;
    
    // ✅ CREATE PLACEHOLDER ON-DEMAND (when student views question)
    const currentQ = questions[currentQuestionIndex];
    if (currentQ && attempt?.attemptId) {
      const hasResponse = attempt.responses.some(
        (r) => r.questionId === currentQ.id
      );
      
      if (!hasResponse) {
        // console.log(`📝 Creating placeholder for Q${currentQ.questionNo} (on-demand)`);
        
        // 🐛 DEBUG: Log all parameters
        // console.log('🐛 DEBUG - Placeholder Parameters:');
        // console.log('  attemptId:', attempt.attemptId);
        // console.log('  questionNo:', currentQ.questionNo);
        // console.log('  questionId:', currentQ.id);
        // console.log('  type:', currentQ.type);
        // console.log('  maxMarks:', currentQ.maxMarks);
        // console.log('  questionText:', currentQ.questionText, '(type:', typeof currentQ.questionText, ')');
        // console.log('  options:', currentQ.options, '(type:', typeof currentQ.options, ')');
        // console.log('  complexity:', currentQ.complexity, '(type:', typeof currentQ.complexity, ')');
        // console.log('  chapter:', currentQ.chapter, '(type:', typeof currentQ.chapter, ')');
        // console.log('  fromPool:', currentQ.fromPool, '(type:', typeof currentQ.fromPool, ')');
        
        firebaseService.createPlaceholderResponse(
          attempt.attemptId,
          currentQ.questionNo,
          currentQ.id,
          currentQ.type,
          currentQ.maxMarks,
          currentQ.questionText || '',           // ✅ Default to empty string
          currentQ.options || [],                // ✅ Default to empty array
          currentQ.complexity || undefined,      // ✅ Keep undefined (function will omit)
          currentQ.chapter || undefined,         // ✅ Keep undefined (function will omit)
          currentQ.fromPool || false             // ✅ Default to false
        );
      }
    }
    
    // ✅ FIX: Don't calculate time if questionStartTime hasn't been initialized
    if (questionStartTime === 0) {
      // console.log('⏱️ Skipping time calculation - questionStartTime not initialized yet');
      setPreviousQuestionId(currentQuestionId);
      return;
    }
    
    // Calculate time spent on the PREVIOUS question (before switching)
    const now = Date.now();
    let timeSpentOnPrevious = Math.floor((now - questionStartTime) / 1000); // in seconds
    
    // ✅ CRITICAL FIX: Don't count time from before exam started
    if (attempt && attempt.startTime) {
      const examStartTime = attempt.startTime instanceof Date 
        ? attempt.startTime.getTime()
        : (attempt.startTime as any).toDate().getTime();
      
      // If questionStartTime is before exam start, only count from exam start
      if (questionStartTime < examStartTime) {
        timeSpentOnPrevious = Math.floor((now - examStartTime) / 1000);
        // console.log(`⏱️ Adjusted time: not counting ${Math.floor((examStartTime - questionStartTime) / 1000)}s before exam started`);
      }
    }
    
    // Only record if time is reasonable (between 1 second and 1 hour) AND we have a previous question
    if (timeSpentOnPrevious > 0 && timeSpentOnPrevious < 3600 && previousQuestionId && previousQuestionId !== currentQuestionId) {
      // ✅ FIX: Use the ACTUAL previous question ID (not calculated from index)
      // Add time to previous question's total
      setQuestionTimeTracking(prev => {
        const updated = {
          ...prev,
          [previousQuestionId]: (prev[previousQuestionId] || 0) + timeSpentOnPrevious
        };
        
        // Save to localStorage immediately
        try {
          localStorage.setItem(TIME_TRACKING_KEY, JSON.stringify(updated));
        } catch (error) {
          console.error('❌ Error saving time tracking to storage:', error);
        }
        
        // const _prevQuestionNo = questions.find(q => q.id === previousQuestionId)?.questionNo || '?';
        // console.log(`⏱️ Q${prevQuestionNo}: Added ${timeSpentOnPrevious}s (total: ${updated[previousQuestionId]}s)`);
        return updated;
      });
    }
    
    // ✅ Update previous question ID for next time
    setPreviousQuestionId(currentQuestionId);
    
    // Reset timer for NEW question
    setQuestionStartTime(now);
    // console.log(`⏱️ Started timer for Q${currentQuestionIndex + 1} (ID: ${currentQuestionId})`);
    
    // Cleanup function - runs when component unmounts or before next effect
    return () => {
      // ✅ FIX: Don't calculate time if questionStartTime hasn't been initialized
      if (questionStartTime === 0) {
        // console.log('⏱️ Cleanup skipped - questionStartTime not initialized');
        return;
      }
      
      let finalTime = Math.floor((Date.now() - questionStartTime) / 1000);
      
      // ✅ CRITICAL FIX: Don't count time from before exam started
      if (attempt && attempt.startTime) {
        const examStartTime = attempt.startTime instanceof Date 
          ? attempt.startTime.getTime()
          : (attempt.startTime as any).toDate().getTime();
        
        // If questionStartTime is before exam start, only count from exam start
        if (questionStartTime < examStartTime) {
          finalTime = Math.floor((Date.now() - examStartTime) / 1000);
        }
      }
      
      // Save final time before unmounting
      if (finalTime > 0 && finalTime < 3600 && currentQuestionId) {
        setQuestionTimeTracking(prev => {
          const updated = {
            ...prev,
            [currentQuestionId]: (prev[currentQuestionId] || 0) + finalTime
          };
          
          try {
            localStorage.setItem(TIME_TRACKING_KEY, JSON.stringify(updated));
          } catch (error) {
            console.error('❌ Error saving final time:', error);
          }
          
          return updated;
        });
      }
    };
  }, [currentQuestionIndex, questions, TIME_TRACKING_KEY]);
  
  // ==================== LOAD VIOLATIONS FROM FIREBASE (ONLY ON MOUNT) ====================
  useEffect(() => {
    // ✅ STRATEGY: Load violations from Firebase attempt (single source of truth)
    // localStorage is ONLY used as temporary backup during the session
    
    // 🔥 CRITICAL: Only load once to prevent overwriting during active session
    if (violationsLoaded) {
      // console.log('⏭️ Violations already loaded, skipping to prevent overwrite');
      return;
    }
    
    if (!attempt || !attempt.responses) {
      // console.log('⏳ No attempt or responses to load yet');
      return;
    }
    
    try {
      // console.log('\n' + '='.repeat(80));
      // console.log('🚨 LOADING VIOLATIONS FROM QUESTION-LEVEL DATA (INITIAL LOAD ONLY)');
      // console.log('  - Attempt ID:', attempt.attemptId);
      // console.log('='.repeat(80));
      
      // ✅ Load violations from question-level responses
      const groupedViolations: Record<string, Violation[]> = {};
      const allViolations: Violation[] = [];
      let totalViolationCount = 0;
      
      if (attempt.responses && attempt.responses.length > 0) {
        attempt.responses.forEach((response: any) => {
          if (response.violations && response.violations.length > 0) {
            const questionId = response.questionId || 'unknown';
            
            response.violations.forEach((v: any) => {
              // Parse timestamp — handle IST strings, ISO strings, Firestore Timestamps, Date objects
              let parsedTimestamp: Date;
              const ts = v.timestamp;
              if (ts instanceof Date && !isNaN(ts.getTime())) {
                parsedTimestamp = ts;
              } else if (typeof ts === 'string' && ts.includes(' IST')) {
                parsedTimestamp = new Date(ts.replace(' IST', '+05:30').replace(' ', 'T'));
              } else if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
                parsedTimestamp = new Date(ts.seconds * 1000);
              } else if (typeof ts === 'string') {
                parsedTimestamp = new Date(ts);
              } else {
                parsedTimestamp = new Date();
              }
              if (isNaN(parsedTimestamp.getTime())) parsedTimestamp = new Date();
              
              const violation = {
                type: v.type,
                timestamp: parsedTimestamp.toISOString(),
                details: v.details,
                severity: v.severity,
                questionNo: response.questionNo || 0,
                questionId: questionId
              };
              
              // Add to grouped violations
              if (!groupedViolations[questionId]) {
                groupedViolations[questionId] = [];
              }
              groupedViolations[questionId].push(violation);
              
              // Add to all violations list
              allViolations.push(violation);
              totalViolationCount++;
            });
          }
        });
      }
      
      // console.log('  - Total violations found:', totalViolationCount);
      // console.log('  - Questions affected:', Object.keys(groupedViolations).length);
      
      if (totalViolationCount > 0) {
        setQuestionViolations(groupedViolations);
        setViolations(allViolations);
        
        // ✅ Save to localStorage as backup
        localStorage.setItem(VIOLATIONS_TRACKING_KEY, JSON.stringify(groupedViolations));
        
        // console.log('✅ Loaded', totalViolationCount, 'violations from question-level data');
      } else {
        // console.log('📭 No violations found in responses');
        // Clear localStorage if no violations
        localStorage.removeItem(VIOLATIONS_TRACKING_KEY);
        setQuestionViolations({});
        setViolations([]);
      }
      
      // 🔥 MARK AS LOADED: Prevent future overwrites
      setViolationsLoaded(true);
      
      // console.log('='.repeat(80) + '\n');
      
    } catch (error) {
      console.error('❌ Error loading violations from question-level data:', error);
    }
  }, [attempt?.attemptId]); // 🔥 ONLY trigger on attemptId change (mount)
  
  // ✅ FIXED: Auto-refresh when there are pending evaluations
  // Refresh every 3 seconds to check if evaluations have completed
  // This will show updated status when 'evaluating' becomes 'completed'
  useEffect(() => {
    // Only setup refresh if there are pending evaluations
    if (attempt && attempt.pendingEvaluations && attempt.pendingEvaluations > 0) {
      // console.log(`🔄 Setting up auto-refresh for ${attempt.pendingEvaluations} pending evaluations`);
      
      const interval = setInterval(() => {
        // console.log(`🔄 Auto-refreshing attempt to check evaluation status...`);
        refreshAttempt();
      }, 3000); // Refresh every 3 seconds
      
      return () => {
        // console.log('🛑 Clearing auto-refresh interval (no pending evaluations)');
        clearInterval(interval);
      };
    }
  }, [attempt?.attemptId, attempt?.pendingEvaluations ? 1 : 0]); // ✅ REMOVED refreshAttempt to prevent constant re-creation
  
  // Restore from enhanced backup
  useEffect(() => {
    if (attempt) {
      const backup = offlineQueueService.loadAnswersFromBackup(attempt.attemptId);
      if (Object.keys(backup).length > 0) {
        // console.log(`📦 Enhanced backup restored: ${Object.keys(backup).length} answers`);
      }
    }
 }, [attempt?.attemptId]); // ✅ REMOVED questions.length to prevent constant re-loading
  
  // Offline queue for events that couldn't be sent when internet was down
  const [offlineEventQueue, setOfflineEventQueue] = useState<Array<{
    type: 'connectivity_cycle' | 'answer_save' | 'exam_submit';
    data: any;
    timestamp: Date;
    failedAttempts?: number; // Track processing failures
  }>>([]);
  
  // Load offline queue from localStorage on component mount
useEffect(() => {
  // ✅ DON'T load queue if exam is already submitted
  if (isAlreadySubmitted) {
    // console.log('⚠️ Exam already submitted, skipping queue load');
    // Clear any existing queue
    localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
    setOfflineEventQueue([]);
    return;
  }
  
  const savedQueue = localStorage.getItem(`examOfflineQueue_${examId}_${userId}`);
  if (savedQueue) {
    try {
      const parsedQueue = JSON.parse(savedQueue);
      
      // Validate parsed data
      if (Array.isArray(parsedQueue)) {
        const queueWithDates = parsedQueue.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
          data: {
            ...event.data,
            disconnectionTimestamp: event.data.disconnectionTimestamp ? new Date(event.data.disconnectionTimestamp) : undefined,
            reconnectionTimestamp: event.data.reconnectionTimestamp ? new Date(event.data.reconnectionTimestamp) : undefined
          }
        }));
        
        // Filter out:
        // 1. Stale events (older than 24 hours)
        // 2. exam_submit events (shouldn't persist across sessions)
        const now = new Date().getTime();
        const freshEvents = queueWithDates.filter((event: any) => {
          const eventAge = now - event.timestamp.getTime();
          const isStale = eventAge > 24 * 60 * 60 * 1000; // 24 hours
          const isExamSubmit = event.type === 'exam_submit';
          
          if (isStale) {
            // console.log('🧹 Removing stale queue event:', event.type, 'age:', Math.round(eventAge / 1000 / 60), 'minutes');
          }
          if (isExamSubmit) {
            // console.log('🧹 Removing exam_submit event (should not persist):', event.type);
          }
          
          return !isStale && !isExamSubmit; // ✅ Filter out both stale and exam_submit
        });
        
        if (freshEvents.length > 0) {
          setOfflineEventQueue(freshEvents);
          // console.log('📦 ✅ Restored offline queue from localStorage:', freshEvents.length, 'events');
          // console.log('📦 Event details:', freshEvents.map(e => ({ 
            // type: e.type, 
            // timestamp: e.timestamp,
            // age: Math.round((now - e.timestamp.getTime()) / 1000 / 60) + ' minutes ago'
          // })));
        } else {
          // console.log('📦 All queue events were stale or invalid, clearing localStorage');
          localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
        }
      } else {
        // console.warn('⚠️ Invalid queue data format, clearing localStorage');
        localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
      }
    } catch (error) {
      console.error('❌ Failed to restore offline queue:', error);
      localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
    }
  } else {
    // console.log('📦 No saved offline queue found');
  }
}, [examId, userId, isAlreadySubmitted]);

  // Save offline queue to localStorage whenever it changes
  useEffect(() => {
    try {
      if (offlineEventQueue.length > 0) {
        localStorage.setItem(`examOfflineQueue_${examId}_${userId}`, JSON.stringify(offlineEventQueue));
        // console.log('📦 ✅ Saved offline queue to localStorage:', offlineEventQueue.length, 'events');
      } else {
        localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
        // console.log('📦 ✅ Cleared offline queue from localStorage (empty)');
      }
    } catch (error) {
      console.error('❌ Failed to save offline queue:', error);
    }
  }, [offlineEventQueue, examId, userId]);

  
  // Track if cleanup has completed (starts true, set to false when cleanup begins)
  const [isCleanupComplete, setIsCleanupComplete] = useState(true);
  
// Load saved answers when attempt is initialized OR when responses change
  useEffect(() => {
    if (!attempt) {
      // console.log('⏳ No attempt yet, waiting...');
      return;
    }
    
    // ✅ Wait for cleanup to complete before loading answers
    if (!isCleanupComplete) {
      // console.log('⏳ Waiting for cleanup to complete before loading answers...');
      return;
    }
    
    const loadAnswers = async () => {
      if (questions.length === 0) {
        // console.log('⏳ Waiting for questions to load before mapping answers...');
        return;
      }
      
      // console.log('\n' + '='.repeat(80));
      // console.log('🔍 LOADING SAVED ANSWERS');
      // console.log('  - Attempt ID:', attempt.attemptId);
      // console.log('  - Questions loaded:', questions.length);
      // console.log('  - Responses count:', attempt.responses?.length || 0);
      // console.log('='.repeat(80));
      
      const hasActiveEvaluation = attempt.responses?.some(
        r => r.evaluationStatus === 'evaluating' || r.evaluationStatus === 'pending'
      );
      
      if (hasActiveEvaluation && answersInitialized) {
        // console.log('⏭️ Skipping answer reload - evaluation in progress (answers already loaded)');
        return;
      }
      
      // ==================== STEP 1: Load from Firebase (DB) — PRIMARY SOURCE ====================
      let answersMap: Record<string, any> = {};
      
      if (attempt.responses && attempt.responses.length > 0) {
        // console.log('\n📥 STEP 1: Loading from Firebase (DB):', attempt.responses.length, 'responses');
        
        for (const response of attempt.responses) {
          if (response.studentAnswer === null || response.studentAnswer === undefined) continue;
          
          const questionId = (response as any).questionId;
          if (!questionId) {
            console.error(`  ❌ Response missing questionId for questionNo ${response.questionNo} — SKIPPED`);
            continue;
          }
          
          const question = questions.find(q => q.id === questionId);
          if (!question) {
            console.error(`  ❌ Question not found for questionId: ${questionId} — SKIPPED`);
            continue;
          }
          
          answersMap[questionId] = response.studentAnswer;
          // console.log(`  ✅ DB → Q${question.questionNo} (ID: ${questionId})`);
        }
        
        // console.log(`\n✅ Loaded ${Object.keys(answersMap).length} answers from DB`);
      } else {
        // console.log('📭 No responses in Firebase');
      }
      
      // ==================== STEP 2: localStorage fallback — ONLY for questions NOT in DB ====================
      // Check offline queue backup (keyed by questionId)
      try {
        const offlineBackup = offlineQueueService.loadAnswersFromBackup(attempt.attemptId);
        if (Object.keys(offlineBackup).length > 0) {
          // console.log('\n📦 STEP 2: Checking offline backup (by questionId):', Object.keys(offlineBackup).length, 'entries');
          
          for (const [questionId, entry] of Object.entries(offlineBackup)) {
            // Only use backup if DB doesn't have this answer
            if (!answersMap[questionId]) {
              const question = questions.find(q => q.id === questionId);
              if (question) {
                const backupAnswer = entry?.answer !== undefined ? entry.answer : entry;
                answersMap[questionId] = backupAnswer;
                // console.log(`  ✅ Offline backup → Q${question.questionNo} (ID: ${questionId}) — not in DB`);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to load offline backup:', error);
      }
      
      // Also check periodic backup (keyed by questionId)
      try {
        const backupKey = `examBackup_${examId}_${userId}`;
        const backup = localStorage.getItem(backupKey);
        
        if (backup) {
          const backupData = JSON.parse(backup);
          if (backupData.answers && typeof backupData.answers === 'object') {
            // console.log('\n📦 STEP 2b: Checking periodic backup:', Object.keys(backupData.answers).length, 'entries');
            
            for (const [questionId, backupEntry] of Object.entries(backupData.answers as Record<string, any>)) {
              // Only use backup if DB doesn't have this answer
              if (!answersMap[questionId]) {
                const question = questions.find(q => q.id === questionId);
                if (question) {
                  const backupAnswer = backupEntry?.answer !== undefined ? backupEntry.answer : backupEntry;
                  answersMap[questionId] = backupAnswer;
                  // console.log(`  ✅ Periodic backup → Q${question.questionNo} (ID: ${questionId}) — not in DB`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to load periodic backup:', error);
      }
      
      // console.log('\n🎯 FINAL ANSWERS STATE:');
      // console.log('  - Total answers:', Object.keys(answersMap).length);
      // Object.entries(answersMap).forEach(([qId, _ans]) => {
        // const _q = questions.find(q => q.id === qId);
        // console.log(`  - Q${q?.questionNo || '?'} (${qId}): ${typeof ans === 'string' ? ans.slice(0, 50) + '...' : JSON.stringify(ans)}`);
      // });
      
      // ✅ FIX: Merge Firebase answers with existing local answers instead of full replacement
      // This prevents locally-submitted answers from being lost when Firebase listener 
      // triggers a reload before the write is reflected back
      setAnswers(prev => {
        let result: Record<string, any>;
        if (!answersInitialized) {
          // First load (or after reset): Firebase is the source of truth
          // console.log('  📥 First load — using Firebase answers as base');
          result = answersMap;
        } else {
          // Subsequent reloads (triggered by responses.length change):
          // Keep ALL local answers, only ADD new answers from Firebase that don't exist locally
          result = { ...prev };
          for (const [qId, firebaseAnswer] of Object.entries(answersMap)) {
            if (!(qId in prev)) {
              // New answer from Firebase that we don't have locally (e.g., from another device/tab)
              result[qId] = firebaseAnswer;
              // const _q = questions.find(q => q.id === qId);
              // console.log(`  📥 Added new Firebase answer for Q${q?.questionNo || '?'}`);
            }
            // If local already has this answer, keep local version (it's more recent)
          }
        }
        // 🔥 CRITICAL: Sync answersRef immediately so useLayoutEffect reads fresh data
        answersRef.current = result;
        return result;
      });
      setAnswersInitialized(true);
      // console.log('✅ answersInitialized set to TRUE');
      // console.log('='.repeat(80) + '\n');

      // ✅ Restore bookmarks from attempt responses (markedForReview field)
      if (attempt.responses && attempt.responses.length > 0) {
        const restoredBookmarks = new Set<string>();
        // First load from localStorage
        const savedBookmarks = localStorage.getItem(`examBookmarks_${examId}_${userId}`);
        if (savedBookmarks) {
          try {
            JSON.parse(savedBookmarks).forEach((id: string) => restoredBookmarks.add(id));
          } catch { /* ignore */ }
        }
        // Merge with Firestore markedForReview
        for (const response of attempt.responses) {
          if (response.markedForReview && response.questionId) {
            restoredBookmarks.add(response.questionId);
          }
        }
        if (restoredBookmarks.size > 0) {
          setBookmarkedQuestions(restoredBookmarks);
          // console.log('🔖 Restored', restoredBookmarks.size, 'bookmarks from attempt responses');
        }
      }

      // ✅ Restore likert answers from answersMap into likertAnswers state/ref
      const restoredLikertAnswers: Record<string, string> = {};
      Object.entries(answersMap).forEach(([questionId, answer]) => {
        const q = questions.find(q => q.id === questionId);
        if (q && (q as any).type === 'likert' && answer !== null && answer !== undefined && answer !== '') {
          restoredLikertAnswers[questionId] = String(answer);
        }
      });
      if (Object.keys(restoredLikertAnswers).length > 0) {
        likertAnswersRef.current = restoredLikertAnswers;
        setLikertAnswers(restoredLikertAnswers);
        // console.log('✅ Restored', Object.keys(restoredLikertAnswers).length, 'likert answers');
      }

      // ── DETERMINE EXAM PHASE ON (RE-)ENTRY ────────────────────────────
      // Only relevant for exams that have both likert AND actual questions
      if (likertOnlyQuestions.length > 0 && questions.length > 0 && likertDurationMins > 0 && attempt.startTime) {
        const [eh, em] = examTime.split(':').map(Number);
        const scheduledStart = new Date(examDate);
        scheduledStart.setHours(eh, em, 0, 0);

        // Compute when likert window ends:
        // strict  → scheduledStart + likertDuration (fixed wall-clock)
        // flexible → attempt.startTime + likertDuration (student gets full time)
        const st = attempt.startTime instanceof Date
          ? attempt.startTime
          : (attempt.startTime as any).toDate();

        const likertWindowEnd = completionPolicy === 'flexible'
          ? new Date(st.getTime() + likertDurationMins * 60 * 1000)
          : new Date(scheduledStart.getTime() + likertDurationMins * 60 * 1000);

        const nowMs = Date.now();
        const secsRemaining = Math.floor((likertWindowEnd.getTime() - nowMs) / 1000);

        if (secsRemaining > 0 && !likertAutoAdvanced.current) {
          // Likert window still open → show likert phase
          setExamPhase('likert');
          setLikertTimeLeft(secsRemaining);
          setLikertCurrentIndex(0);
          setCurrentQuestionIndex(0);
          // console.log(`🧠 Starting LIKERT phase — ${secsRemaining}s remaining`);
        } else {
          // Likert window closed → go straight to actual exam
          setExamPhase('exam');
          setCurrentQuestionIndex(likertOnlyQuestions.length); // skip past likert questions
          // console.log(`⏭️ LIKERT window expired — entering EXAM phase directly`);
        }
      }
      // ──────────────────────────────────────────────────────────────────
    };
    
    loadAnswers();
  }, [attempt?.attemptId, attempt?.responses?.length, isCleanupComplete, questions.length, likertOnlyQuestions.length, likertDurationMins]); // includes likert phase deps

  // ✅ Initialize answersInitialized even without attempt (for editor rendering)
  useEffect(() => {
    if (questions.length > 0 && !answersInitialized && !attempt?.attemptId) {
      // console.log('✅ No attempt yet - initializing answersInitialized for editor rendering');
      setAnswersInitialized(true);

      // Initialize phase based on current time (same logic as with attempt)
      if (likertOnlyQuestions.length > 0 && likertDurationMins > 0) {
        const [eh, em] = (examTime || '00:00').split(':').map(Number);
        const scheduledStart = new Date(examDate);
        scheduledStart.setHours(eh, em, 0, 0);
        const likertWindowEnd = new Date(scheduledStart.getTime() + likertDurationMins * 60 * 1000);
        const secsRemaining = Math.floor((likertWindowEnd.getTime() - Date.now()) / 1000);
        if (secsRemaining > 0) {
          setExamPhase('likert');
          setLikertTimeLeft(secsRemaining);
          setCurrentQuestionIndex(0);
        } else {
          setExamPhase('exam');
          setCurrentQuestionIndex(likertOnlyQuestions.length);
        }
      }
    }
  }, [questions.length, answersInitialized, attempt?.attemptId, likertOnlyQuestions.length, likertDurationMins, examDate, examTime]);

  // Save bookmarks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`examBookmarks_${examId}_${userId}`, JSON.stringify([...bookmarkedQuestions]));
      // console.log('💾 Bookmarks saved:', bookmarkedQuestions.size);
    } catch (error) {
      console.error('❌ Failed to save bookmarks:', error);
    }
  }, [bookmarkedQuestions, examId, userId]);
 
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('All Questions');
  
  const [imageCarouselOpen, setImageCarouselOpen] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Filter states
  const [showNotViewed, setShowNotViewed] = useState(true);
  const [showAnswered, setShowAnswered] = useState(true);
  const [showBookmarked, setShowBookmarked] = useState(true);
  const [showSkipped, setShowSkipped] = useState(true);
  
  // Answer inputs for different question types
  const [codeInput, setCodeInput] = useState('');
  const [mcqAnswer, setMcqAnswer] = useState<string[]>([]);
  const [descriptiveAnswer, setDescriptiveAnswer] = useState('');
  const [fillBlanksAnswers, setFillBlanksAnswers] = useState<string[]>([]);
  const [jumbledAnswers, setJumbledAnswers] = useState<string[]>([]);
  
  // ✅ FIX: Refs to access latest answer values in auto-save interval (prevents stale closure)
  const mcqAnswerRef = useRef<string[]>([]);
  const descriptiveAnswerRef = useRef<string>('');
  const fillBlanksAnswersRef = useRef<string[]>([]);
  const jumbledAnswersRef = useRef<string[]>([]);
  
  // 🔥 Track initial code length for stable editor key (doesn't change while typing)
  const initialCodeLengthRef = useRef<Record<string, number>>({});
  const codeInputRef = useRef<string>('');
  
  // 🔥 Track which question the user has actively modified (dirty flag per question ID)
  // Prevents late-arriving Firebase data from overwriting in-progress typing
  const dirtyQuestionsRef = useRef<Set<string>>(new Set());
  
  // 🔥 Track answer load version for RichTextEditor key (increments only when loading from Firebase)
  const answerLoadVersionRef = useRef<Record<string, number>>({});
  
  // Monaco editor instance and editable range
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  
  // PGlite (PostgreSQL in browser) for SQL problems
  const pgliteRef = useRef<any>(null);
  
  // Code execution states
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('cpp'); // Default to C++
  const selectedLanguagePerQuestion = useRef<Record<string, string>>({}); // ✅ Track language per question
  const [langSwitchConfirm, setLangSwitchConfirm] = useState<{ newLang: string; starterCode: string } | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'output' | 'stdin'>('output'); // Tabbed panel
  
  // Resizer states
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [editorHeight, setEditorHeight] = useState(65); // percentage
  const isResizingHorizontal = useRef(false);
  const isResizingVertical = useRef(false);
  const resizeContainerRef = useRef<HTMLDivElement>(null);
  const [executionTime, setExecutionTime] = useState('0ms');
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);
  const [executionMemory, setExecutionMemory] = useState('0KB');

  const currentQuestion = questions[currentQuestionIndex];

  const handleViewImages = () => {
    if (currentQuestion.imageUrls && currentQuestion.imageUrls.length > 0) {
      setCarouselImages(currentQuestion.imageUrls);
      setCurrentImageIndex(0);
      setImageCarouselOpen(true);
    }
  };

  // ✅ FIX: Keep answer refs in sync with state (for auto-save interval)
  useEffect(() => { mcqAnswerRef.current = mcqAnswer; }, [mcqAnswer]);
  useEffect(() => { descriptiveAnswerRef.current = descriptiveAnswer; }, [descriptiveAnswer]);
  useEffect(() => { fillBlanksAnswersRef.current = fillBlanksAnswers; }, [fillBlanksAnswers]);
  useEffect(() => { jumbledAnswersRef.current = jumbledAnswers; }, [jumbledAnswers]);

  // ✅ NEW: Calculate visible test cases for UI display
  const visibleTestCases = currentQuestion?.testCases 
    ? getVisibleTestCases(currentQuestion.testCases, currentQuestion.type === QUESTION_TYPES.SQL) 
    : [];
  const visibleTestCasesCount = visibleTestCases.length;
// ==================== CLEAR OLD QUEUE ON EXAM START ====================
useEffect(() => {
  // Clear old offline queue and backups when starting/resuming exam
  const clearOldData = () => {
    try {
      // console.log('🧹 Starting cleanup of old exam data...');
      
      // ✅ CRITICAL: Reset answers initialized flag to force fresh load
      setAnswersInitialized(false);
      // console.log('  🔄 Reset answersInitialized to force fresh answer load');
      
      // ✅ CRITICAL: Clear answer submission queue (offlineQueueService)
      const oldAnswerQueue = localStorage.getItem('exam_answer_queue');
      if (oldAnswerQueue) {
        // console.log('  🗑️ Clearing answer submission queue');
        localStorage.removeItem('exam_answer_queue');
        offlineQueueService.clearQueue();
      }
      
      // ✅ Clear event queue (connectivity + exam submissions) ONLY IF already submitted
      if (isAlreadySubmitted) {
        const oldEventQueue = localStorage.getItem(`examOfflineQueue_${examId}_${userId}`);
        if (oldEventQueue) {
          // console.log('  🗑️ Clearing event queue (exam already submitted)');
          localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
          setOfflineEventQueue([]);
        }
      }

      // Clear old backups from DIFFERENT attempts only
      const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('exam_backup_'));
      backupKeys.forEach(key => {
        if (attempt && !key.includes(attempt.attemptId)) {
          // console.log('  🗑️ Clearing old backup:', key);
          localStorage.removeItem(key);
        }
      });

      // Clear answers from DIFFERENT exams only (keep current exam answers!)
      const answerKeys = Object.keys(localStorage).filter(key => key.startsWith('examAnswers_'));
      answerKeys.forEach(key => {
        if (!key.includes(`${examId}_${userId}`)) {
          // console.log('  🗑️ Clearing old answers:', key);
          localStorage.removeItem(key);
        } else {
          // console.log('  ✅ Keeping current exam answers:', key);
        }
      });
      
      // ✅ CLEAR VIOLATIONS: Remove old violations from OTHER exams only (keep current!)
      const violationKeys = Object.keys(localStorage).filter(key => key.startsWith('exam_violations_'));
      violationKeys.forEach(key => {
        if (!key.includes(`${examId}_${userId}`)) {
          // console.log('  🗑️ Clearing old violations:', key);
          localStorage.removeItem(key);
        } else {
          // console.log('  ✅ Keeping current exam violations:', key);
        }
      });
      
      // ✅ CLEAR TIME TRACKING: Remove old time tracking data from OTHER exams only
      const timeKeys = Object.keys(localStorage).filter(key => key.startsWith('exam_time_tracking_'));
      timeKeys.forEach(key => {
        if (!key.includes(`${examId}_${userId}`)) {
          // console.log('  🗑️ Clearing old time tracking:', key);
          localStorage.removeItem(key);
        } else {
          // console.log('  ✅ Keeping current exam time tracking:', key);
        }
      });
      
      // console.log('✅ Old data cleared, starting fresh exam session');
      setIsCleanupComplete(true); // ✅ Signal that cleanup is done
    } catch (error) {
      console.error('❌ Error clearing old data:', error);
      setIsCleanupComplete(true); // ✅ Continue even if cleanup fails
    }
  };
  
  // Only clear on first load of this attempt
  if (attempt && !isAlreadySubmitted) {
    clearOldData();
  } else if (attempt) {
    // ✅ If exam is already submitted, skip cleanup and proceed
    // console.log('⏭️ Exam already submitted, skipping cleanup');
    setIsCleanupComplete(true);
  }
}, [attempt?.attemptId, examId, userId, isAlreadySubmitted]);

// ==================== INITIALIZE ACTIVITY LOG ====================
useEffect(() => {
  const initializeMonitoring = async () => {
    try {
      // console.log('🚀 Initializing exam monitoring...');
        
        // Check if Firebase is initialized
        if (!firebaseService.isInitialized()) {
          // console.warn('⚠️ Firebase not initialized yet, enabling local monitoring');
          setIsMonitoringActive(true);
          entryTimeRef.current = new Date();
          return;
        }
        
        // Check if user is authenticated
        const currentUserId = firebaseService.getCurrentUserId();
        if (!currentUserId) {
          // console.warn('⚠️ No authenticated user, enabling local monitoring only');
          setIsMonitoringActive(true);
          entryTimeRef.current = new Date();
          return;
        }
        
        // Get IP address
        const ipAddress = await getCurrentIpAddress();
        setCurrentIpAddress(ipAddress);
        
        // console.log('👤 User:', userFullName, '| Email:', userEmail, '| Type:', userType);
        // console.log('📊 IP:', ipAddress);
        
        // Log 'enter' activity - Firebase will check for duplicates within 10 seconds
        if (attempt && attempt.attemptId) {
          await firebaseService.logEnterActivity(attempt.attemptId, ipAddress);
        }
        
        // Always enable monitoring for local violation tracking
        setIsMonitoringActive(true);
        entryTimeRef.current = new Date();
        monitoringStartTime.current = Date.now(); // ✅ Record when monitoring started
        
        // 🎥 Initialize face-api and load baseline descriptors if proctoring photos exist
        // console.log('🔍 Checking proctoring photos:', {
          // hasFront: !!proctoringPhotos?.front,
          // hasLeft: !!proctoringPhotos?.left,
          // hasRight: !!proctoringPhotos?.right,
          // proctoringPhotos
        // });
        
        if (proctoringPhotos?.front && proctoringPhotos?.left && proctoringPhotos?.right) {
          // console.log('🎥 Initializing face-api for proctoring...');
          try {
            // Check if face-api models are already loaded from PreExamVerification
            // console.log('📦 Checking face-api models...');
            // console.log('  - SsdMobilenetv1:', faceapi.nets.ssdMobilenetv1.isLoaded ? '✅ Loaded' : '❌ Not loaded');
            // console.log('  - TinyFaceDetector:', faceapi.nets.tinyFaceDetector.isLoaded ? '✅ Loaded' : '❌ Not loaded');
            // console.log('  - FaceLandmark68Net:', faceapi.nets.faceLandmark68Net.isLoaded ? '✅ Loaded' : '❌ Not loaded');
            // console.log('  - FaceRecognitionNet:', faceapi.nets.faceRecognitionNet.isLoaded ? '✅ Loaded' : '❌ Not loaded');
            
            // Warn if SsdMobilenetv1 not loaded (should be loaded by PreExamVerification)
            if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
              // console.warn('⚠️ SsdMobilenetv1 not loaded - using TinyFaceDetector (less accurate)');
              // console.warn('   This may cause false NO_FACE violations. Ensure SsdMobilenetv1 loads in PreExamVerification.');
            }
            
            // All models MUST be loaded by PreExamVerification before starting exam
            if (!faceapi.nets.faceLandmark68Net.isLoaded || !faceapi.nets.faceRecognitionNet.isLoaded) {
              throw new Error('Face-api models not loaded. Please complete PreExamVerification first.');
            }
            
            if (!faceapi.nets.ssdMobilenetv1.isLoaded && !faceapi.nets.tinyFaceDetector.isLoaded) {
              throw new Error('No face detector loaded. Please complete PreExamVerification first.');
            }
            
            // console.log('✅ All required face-api models are loaded from PreExamVerification');
            
            // Load baseline descriptors
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const photos = [proctoringPhotos.front, proctoringPhotos.left, proctoringPhotos.right];
            const descriptors: Float32Array[] = [];
            
            for (const photoUrl of photos) {
              try {
                let detection;
                
                if (isLocalhost) {
                  // Use blob method for localhost
                  const response = await fetch(photoUrl);
                  const blob = await response.blob();
                  const img = await createImageBitmap(blob);
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    
                    // Prefer SsdMobilenetv1 (more accurate) if loaded
                    if (faceapi.nets.ssdMobilenetv1.isLoaded) {
                      // console.log('    - Using SsdMobilenetv1 for baseline detection');
                      detection = await faceapi
                        .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({
                          minConfidence: 0.3
                        }))
                        .withFaceLandmarks()
                        .withFaceDescriptor();
                    } else if (faceapi.nets.tinyFaceDetector.isLoaded) {
                      // console.log('    - Using TinyFaceDetector for baseline detection');
                      detection = await faceapi
                        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({
                          inputSize: 416,
                          scoreThreshold: 0.2  // Lower = more sensitive
                        }))
                        .withFaceLandmarks()
                        .withFaceDescriptor();
                    } else {
                      throw new Error('No face detector model loaded');
                    }
                  }
                } else {
                  // Production: use standard method
                  const img = await faceapi.fetchImage(photoUrl);
                  
                  // Prefer SsdMobilenetv1 (more accurate) if loaded
                  if (faceapi.nets.ssdMobilenetv1.isLoaded) {
                    // console.log('    - Using SsdMobilenetv1 for baseline detection');
                    detection = await faceapi
                      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({
                        minConfidence: 0.3
                      }))
                      .withFaceLandmarks()
                      .withFaceDescriptor();
                  } else if (faceapi.nets.tinyFaceDetector.isLoaded) {
                    // console.log('    - Using TinyFaceDetector for baseline detection');
                    detection = await faceapi
                      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
                        inputSize: 416,
                        scoreThreshold: 0.2  // Lower = more sensitive
                      }))
                      .withFaceLandmarks()
                      .withFaceDescriptor();
                  } else {
                    throw new Error('No face detector model loaded');
                  }
                }
                
                if (detection) {
                  descriptors.push(detection.descriptor);
                }
              } catch (err) {
                console.error('❌ Error loading baseline photo:', err);
              }
            }
            
            if (descriptors.length > 0) {
              setBaselineDescriptors(descriptors);
              setFaceMonitoringEnabled(true);
              // console.log(`✅ Loaded ${descriptors.length} baseline descriptors, face monitoring enabled`);
              // console.log('🎥 ExamMonitor should now be active with monitoring:', {
                // descriptorsCount: descriptors.length,
                // monitoringEnabled: true,
                // isMonitoringActive
              // });
            } else {
              // console.warn('⚠️ No baseline descriptors loaded, face monitoring disabled');
            }
          } catch (error) {
            console.error('❌ Failed to initialize face monitoring:', error);
          }
        } else {
          // console.log('⏭️ Proctoring disabled - skipping face-api model checks and face monitoring');
        }
        
        // 🔥 Note: Fullscreen will be requested on first user interaction
        // Browser security prevents automatic fullscreen in useEffect
        // console.log('ℹ️ Fullscreen will be activated on first user interaction');
        
        // console.log('🔒 Exam monitoring enabled');
        
      } catch (error) {
        console.error('❌ Failed to initialize monitoring:', error);
        // console.log('📝 Enabling local monitoring only');
        // Enable monitoring anyway for local tracking
        setIsMonitoringActive(true);
        entryTimeRef.current = new Date();
      }
    };
    
    // Only run when attempt is available
    if (attempt && attempt.attemptId) {
      initializeMonitoring();
    }
  }, [attempt?.attemptId]); // Only trigger when attemptId changes

  // ==================== BLOCK RIGHT-CLICK IMMEDIATELY ON MOUNT ====================
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Don't stopPropagation — let the monitoring handler in setupMonitoring also fire to log the violation
      return false;
    };
    document.addEventListener('contextmenu', blockContextMenu, true); // capture phase
    return () => document.removeEventListener('contextmenu', blockContextMenu, true);
  }, []);

  // ==================== SETUP MONITORING ====================
  useEffect(() => {
    if (!isMonitoringActive) return;
    
    // console.log('🔒 Setting up exam monitoring...');
    const cleanup = setupMonitoring();
    return cleanup;
  }, [isMonitoringActive]);

  // ==================== REQUEST FULLSCREEN ON FIRST USER INTERACTION ====================
  useEffect(() => {
    // Wait until monitoring is active and we haven't successfully entered fullscreen yet
    if (!isMonitoringActive || fullscreenRequested) return;
    
    const requestFullscreenOnce = async () => {
      try {
        // console.log('🎬 Requesting fullscreen...');
        const elem = document.documentElement;
        
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen(); // Safari/Chrome
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen(); // Firefox
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen(); // IE/Edge
        }
        
        // ✅ SUCCESS: Only set this to true if the promise actually resolves
        setFullscreenRequested(true);
        fullscreenEnteredRef.current = true;
        // console.log('✅ Fullscreen activated successfully');
        
      } catch (error) {
        // ❌ FAIL: Do NOT set fullscreenRequested(true) here. 
        // Let the listener stay attached so it retries on the next click.
        // console.warn('⚠️ Fullscreen request failed (will retry on next interaction):', error);
      }
    };
    
    // Try immediately when monitoring becomes active
    requestFullscreenOnce();
    
    // Also listen for interactions in case immediate request fails
    const handleInteraction = (_e: Event) => {
      // ✅ Only request if not already in fullscreen
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      if (!isCurrentlyFullscreen && !fullscreenRequested) {
        // console.log('🖱️ User interaction detected - requesting fullscreen...');
        requestFullscreenOnce();
      }
    };
    
    // ✅ USE CAPTURE: Pass { capture: true } or true as the 3rd argument
    // This ensures we catch the click even if a child component calls e.stopPropagation()
    document.addEventListener('click', handleInteraction, true);
    document.addEventListener('keydown', handleInteraction, true);
    document.addEventListener('touchstart', handleInteraction, true); // Add touch for mobile
    
    return () => {
      document.removeEventListener('click', handleInteraction, true);
      document.removeEventListener('keydown', handleInteraction, true);
      document.removeEventListener('touchstart', handleInteraction, true);
    };
  }, [isMonitoringActive, fullscreenRequested]);

  useEffect(() => {
    if (!imageCarouselOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setImageCarouselOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageCarouselOpen, carouselImages.length]);

  // ==================== SAVE CURRENT ANSWER ====================
  const saveCurrentAnswer = useCallback(async (_syncToBackend: boolean = false) => {

  // 🔥 CAPTURE ID IMMEDIATELY — prevents saving Question A's answer into Question B's slot
  // if the user navigates while this async function is still executing
  const savingQuestion = currentQuestion;
  const savingQuestionId = currentQuestion?.id;

  if (!savingQuestion || !savingQuestionId) {
    // console.warn('⚠️ Cannot save answer: currentQuestion is undefined');
    return;
  }

  let answer: any;
  
  // Normalize question type to lowercase for matching
  const questionType = savingQuestion.type.toLowerCase();
  
  switch (questionType) {
    case QUESTION_TYPES.SQL:
    case QUESTION_TYPES.CODE:
      answer = codeInputRef.current || (editorRef.current ? editorRef.current.getValue() : codeInput);
      break;
    case QUESTION_TYPES.MCQ:
      answer = mcqAnswerRef.current;
      // console.log('🔍 MCQ Answer Debug:');
      // console.log('  - mcqAnswer state:', mcqAnswer);
      // console.log('  - Array?', Array.isArray(mcqAnswer));
      // console.log('  - Length:', mcqAnswer.length);
      if (mcqAnswer.length > 0) {
        // console.log('  - First item:', mcqAnswer[0]);
        // console.log('  - First item type:', typeof mcqAnswer[0]);
        // console.log('  - Is valid option?', savingQuestion.options?.includes(mcqAnswer[0]));
        
        // ✅ CRITICAL: Validate MCQ answer is actually from the options array
        const invalidAnswers = mcqAnswer.filter(ans => !savingQuestion.options?.includes(ans));
        if (invalidAnswers.length > 0) {
          console.error('❌ CRITICAL ERROR: MCQ answer contains invalid options!');
          console.error('   Question:', savingQuestion.questionNo);
          console.error('   Invalid answers:', invalidAnswers);
          console.error('   Valid options:', savingQuestion.options);
          console.error('   All states:');
          console.error('   - mcqAnswer:', mcqAnswer);
          console.error('   - jumbledAnswers:', jumbledAnswers);
          console.error('   - fillBlanksAnswers:', fillBlanksAnswers);
          alert(`ERROR: Invalid MCQ answer detected for Q${savingQuestion.questionNo}. Please reselect your answer.`);
          return; // Don't save invalid answer
        }
      }
      break;
    case QUESTION_TYPES.DESCRIPTIVE:
      answer = descriptiveAnswerRef.current;
      // console.log('📝 DESCRIPTIVE Answer Details:');
      // console.log('  - Full HTML:', descriptiveAnswer);
      // console.log('  - Contains <span data-latex:', descriptiveAnswer.includes('data-latex'));
      // console.log('  - Contains <span class="math:', descriptiveAnswer.includes('class="math'));
      break;
    case QUESTION_TYPES.FITB:
      answer = fillBlanksAnswersRef.current;  // ✅ Use REF for latest value
      break;
    case QUESTION_TYPES.JUMBLED:
      answer = jumbledAnswersRef.current;
      break;
    case QUESTION_TYPES.LIKERT:
      answer = likertAnswersRef.current[savingQuestion.id] || '';
      break;
  }
  
  // Validate answer is not empty
  let isEmptyAnswer = false;
  
  // 🔍 DEBUG: Log the answer we're trying to save
  // console.log('🔍 DEBUG - saveCurrentAnswer called:');
  // console.log('  Question type:', savingQuestion.type);
  // console.log('  Answer value:', answer);
  // console.log('  Answer type:', typeof answer);
  // console.log('  Answer length:', typeof answer === 'string' ? answer.length : 'N/A');
  // console.log('  descriptiveAnswer state:', descriptiveAnswer);

  // console.log(`Answer: ${answer})`);


  if (!answer) {
    isEmptyAnswer = true;
  } else if (typeof answer === 'string') {
    // String answer (Descriptive, Coding)
    if (savingQuestion.type === QUESTION_TYPES.CODE || savingQuestion.type === QUESTION_TYPES.SQL) {
      // For coding, allow submission even if code matches boilerplate (student may want partial credit)
      isEmptyAnswer = !answer.trim();
    } else if (savingQuestion.type === QUESTION_TYPES.DESCRIPTIVE) {
      // For descriptive (HTML from RichTextEditor), strip HTML tags and check content
      const textContent = answer.replace(/<[^>]*>/g, '').trim();
      isEmptyAnswer = !textContent || textContent === '';
    } else {
      isEmptyAnswer = !answer.trim();
    }
  } else if (Array.isArray(answer)) {
    // Array answer (MCQ, Fill in the Blank, Jumbled)
    if (answer.length === 0) {
      isEmptyAnswer = true;
    } else if (savingQuestion.type === QUESTION_TYPES.FITB) {
      // For FITB, check if at least one blank is filled
      isEmptyAnswer = !answer.some((item: string) => item && item.trim() !== '');
    }
    // For Jumbled and MCQ, having items in array is enough
  }
  
  if (isEmptyAnswer) {
    // console.log('📭 Clearing answer for Q' + savingQuestion.questionNo);
    
    // ✅ Show saving state
    setIsSavingAnswer(true);
    
    // ✅ Clear from local state and ref
    const updatedRef = { ...answersRef.current };
    delete updatedRef[savingQuestion.id];
    answersRef.current = updatedRef;
    
    setAnswers(prev => {
      if (prev[savingQuestion.id] !== undefined) {
        const newAnswers = { ...prev };
        delete newAnswers[savingQuestion.id];
        return newAnswers;
      }
      return prev;
    });
    
    // ✅ Also clear from Firebase if online
    if (isOnline && attempt) {
      try {
        const questionData = questions.find(q => q.id === savingQuestion.id);
        if (questionData) {
          // console.log(`🌐 Clearing answer for Q${savingQuestion.questionNo} from Firebase...`);
          // ✅ Send empty value based on question type to clear the answer
          const emptyAnswer = 
            savingQuestion.type === QUESTION_TYPES.MCQ ? [] :
            savingQuestion.type === QUESTION_TYPES.FITB ? [] :
            savingQuestion.type === QUESTION_TYPES.JUMBLED ? [] :
            '';  // For CODE and DESCRIPTIVE
          
          await offlineQueueService.queueAnswer(
            attempt.attemptId,
            savingQuestion.id,
            savingQuestion.questionNo,
            emptyAnswer,
            {
              id: questionData.id,
              type: questionData.type,
              questionText: questionData.questionText,
              maximumMarks: questionData.maxMarks,
              options: questionData.options,
              correctAnswers: questionData.correctAnswers,
              fromPool: questionData.fromPool || false,
            } as any,
            {
              complexity: questionData.complexity || 'easy',
              chapter: questionData.chapter,
            } as any,
            0,
            bookmarkedQuestions.has(savingQuestion.id),
            undefined,
            undefined // ✅ Violations handled by dedicated addViolation()
          );
          // console.log(`✅ Answer cleared for Q${savingQuestion.questionNo}`);
        }
      } catch (error) {
        console.error(`❌ Error clearing answer:`, error);
      }
    }
    
    // ✅ Show visual feedback
    setLastSavedQuestion(savingQuestion.id);
    setTimeout(() => setLastSavedQuestion(null), 2000);
    
    setIsSavingAnswer(false);
    return;
  }

  setIsSavingAnswer(true);
  
  // 🔥 CRITICAL: Update answersRef IMMEDIATELY (before async setAnswers) so navigation reads latest value
  answersRef.current = { ...answersRef.current, [savingQuestion.id]: answer };
  
  setAnswers(prev => {
    return { ...prev, [savingQuestion.id]: answer };
  });
  
  // ✅ Mark question as viewed when answered
  setViewedQuestions(prev => new Set([...prev, savingQuestion.id]));
  
  // console.log('💾 Saving Q' + savingQuestion.questionNo + ':', { isOnline, syncToBackend });
  
  // ==================== HELPER: GET TIME SPENT ON CURRENT QUESTION ====================
  /**
   * Get total time spent on current question including current session
   */
  const getTotalTimeSpent = (questionId: string): number => {
    // ✅ FIX: Return 0 if questionStartTime hasn't been initialized
    if (questionStartTime === 0) {
      // console.log('⏱️ getTotalTimeSpent called before initialization - returning 0');
      return 0;
    }
    
    const now = Date.now();
    let currentSessionTime = Math.floor((now - questionStartTime) / 1000);
    
    // ✅ CRITICAL FIX: Don't count time from before exam started
    if (attempt && attempt.startTime) {
      const examStartTime = attempt.startTime instanceof Date 
        ? attempt.startTime.getTime()
        : (attempt.startTime as any).toDate().getTime();
      
      // If questionStartTime is before exam start, only count from exam start
      if (questionStartTime < examStartTime) {
        currentSessionTime = Math.floor((now - examStartTime) / 1000);
        // console.log(`⏱️ Adjusted time: not counting ${Math.floor((examStartTime - questionStartTime) / 1000)}s before exam started`);
      }
    }
    
    const previousTime = questionTimeTracking[questionId] || 0;
    
    // Add current session time to previously tracked time
    const totalTime = previousTime + (currentSessionTime > 0 && currentSessionTime < 3600 ? currentSessionTime : 0);
    
    return totalTime;
  };
  
  // ==================== ONLINE: Save to Firebase ====================
  if (isOnline && attempt) {
    try {
      const questionData = questions.find(q => q.id === savingQuestion.id);
      if (questionData) {
        // console.log(`🌐 ONLINE: Submitting Q${savingQuestion.questionNo} (ID: ${questionData.id}) to Firebase...`);
        
        // ✅ DEBUG: Track chapter field through the entire flow
        // console.log('📖 CHAPTER DEBUG - Start of submission:');
        // console.log('  1. questionData object:', questionData);
        // console.log('  2. questionData.chapter value:', questionData.chapter);
        // console.log('  3. typeof chapter:', typeof questionData.chapter);
        // console.log('  3. typeof chapter:', typeof savingQuestion.chapter);
        // console.log('  4. Is undefined?', questionData.chapter === undefined);
        // console.log('  5. Is null?', questionData.chapter === null);
        // console.log('  6. Is empty string?', questionData.chapter === '');
        // console.log('  7. Complexity:', COMPLEXITY_LEGACY_MAP[questionData.complexity] || COMPLEXITY_LEVELS.EASY);
        
        // Get violations for current question
        
        // ✅ DEBUG: Log what's being passed to questionBankItem
        const questionBankItemParam = {
          complexity: COMPLEXITY_LEGACY_MAP[questionData.complexity] || COMPLEXITY_LEVELS.EASY,
          chapter: savingQuestion.chapter || questionData?.chapter, 
        };
        // console.log('📦 CHAPTER DEBUG - questionBankItem parameter:', questionBankItemParam);
        // console.log('  - chapter value being passed:', questionBankItemParam.chapter);
        // console.log('  - chapter !== undefined:', questionBankItemParam.chapter !== undefined);
        // console.log('  - complexity value:', questionBankItemParam.complexity);
        
        // ✅ DEBUG: Log the complete Question parameter object
        const questionParam = {
          id: questionData.id,
          type: questionData.type,
          questionText: questionData.questionText,
          maximumMarks: questionData.maxMarks,
          options: questionData.options,
          correctAnswers: (questionData.type.toLowerCase() === QUESTION_TYPES.DESCRIPTIVE || 
              questionData.type.toLowerCase() === QUESTION_TYPES.CODE ||
              questionData.type.toLowerCase() === QUESTION_TYPES.SQL) && questionData.solution
            ? [questionData.solution]
            : (questionData as any).correctAnswers,
          programmingLanguage: (questionData.type.toLowerCase() === QUESTION_TYPES.CODE || questionData.type.toLowerCase() === QUESTION_TYPES.SQL)
            ? selectedLanguage
            : questionData.language,
          testCases: questionData.testCases,
          testStub: questionData.boilerplate,
          fromPool: questionData.fromPool || false,
          likertTrait: (questionData as any).likertTrait,
          likertDirection: (questionData as any).likertDirection,
        };
        // console.log('📋 CHAPTER DEBUG - Question parameter being passed:', {
          // id: questionParam.id,
          // type: questionParam.type,
          // fromPool: questionParam.fromPool,
          // hasChapter: 'chapter' in questionParam, // This will be false since we don't include chapter in Question param
        // });
        // console.log('  ⚠️ NOTE: Chapter is passed via questionBankItem, not Question parameter');
        
        const result = await offlineQueueService.queueAnswer(
          attempt.attemptId,
          savingQuestion.id,
          savingQuestion.questionNo,
          answer,
          questionParam as any,
          questionBankItemParam as any,
          getTotalTimeSpent(savingQuestion.id),
          bookmarkedQuestions.has(savingQuestion.id),
          undefined,
          undefined // ✅ Violations handled by dedicated addViolation() — not answer saves
        );

        // Handle the result
        if (result.success) {
          if (!result.queued) {
            // console.log(`✅ Q${savingQuestion.questionNo} saved to Firebase immediately`);
          } else {
            // console.log(`📦 Q${savingQuestion.questionNo} queued for later sync`);
          }
          
          // 🔥 DIRTY FLAG: Update last saved answer to prevent re-saving unchanged content
          setLastSavedAnswers(prev => ({
            ...prev,
            [savingQuestion.id]: answer
          }));
          
          // Show success feedback
          setLastSavedQuestion(savingQuestion.id);
          setTimeout(() => setLastSavedQuestion(null), 2000);
        }
      }
    } catch (error) {
      console.error(`❌ Error saving Q${savingQuestion.questionNo}:`, error);
    }
  } 
  // ==================== OFFLINE: Save to queue (which handles localStorage) ====================
  else if (!isOnline && attempt) {
    // console.log(`📴 OFFLINE: Saving Q${savingQuestion.questionNo} to queue`);
    
    // Queue for sync when online (offlineQueueService handles localStorage backup)
    const questionData = questions.find(q => q.id === savingQuestion.id);
    if (questionData) {
      // Get violations for current question
      

      // 🔍 COMPREHENSIVE CHAPTER DEBUG
      // console.log('\n========== CHAPTER DEBUG ==========');
      // console.log('1. Current Question:', {
        // id: currentQuestion?.id,
        // questionNo: currentQuestion?.questionNo,
        // chapter: currentQuestion?.chapter,
        // hasChapter: !!currentQuestion?.chapter,
        // complexity: currentQuestion?.complexity,
        // allKeys: Object.keys(currentQuestion || {})
      // });

      // console.log('2. Question Data:', {
        // id: questionData.id,
        // chapter: questionData.chapter,
        // hasChapter: !!questionData.chapter,
        // complexity: questionData.complexity
      // });

      // console.log('3. Will pass to Firebase as questionBankItem:', {
        // chapter: questionData.chapter || savingQuestion.chapter,
        // complexity: COMPLEXITY_LEGACY_MAP[questionData.complexity] || COMPLEXITY_LEVELS.EASY
      // });

      // console.log('4. Is chapter defined?', {
        // 'questionData.chapter': questionData.chapter !== undefined,
        // 'savingQuestion.chapter': savingQuestion.chapter !== undefined,
        // 'value': questionData.chapter || savingQuestion.chapter || 'UNDEFINED'
      // });
      // console.log('===================================\n');

      await offlineQueueService.queueAnswer(
        attempt.attemptId,
        savingQuestion.id,
        savingQuestion.questionNo,
        answer,
        {
          id: questionData.id,
          type: questionData.type,
          questionText: questionData.questionText,
          maximumMarks: questionData.maxMarks,
          options: questionData.options,
          correctAnswers: (questionData.type === QUESTION_TYPES.DESCRIPTIVE || 
                questionData.type === QUESTION_TYPES.CODE ||
                questionData.type === QUESTION_TYPES.SQL) && questionData.solution
              ? [questionData.solution]  // ✅ For Descriptive & Code: use solution field
              : (questionData as any).correctAnswers,  // ✅ For MCQ, FITB, Jumbled: use correctAnswers array
          programmingLanguage: (questionData.type === QUESTION_TYPES.CODE || questionData.type === QUESTION_TYPES.SQL)
            ? selectedLanguage
            : questionData.language,
          testCases: questionData.testCases,
          testStub: questionData.boilerplate,
          fromPool: questionData.fromPool || false,  // ✅ ADD: Pass pool flag
        } as any,
        {
          complexity: COMPLEXITY_LEGACY_MAP[questionData.complexity] || COMPLEXITY_LEVELS.EASY,
          chapter: questionData.chapter || savingQuestion.chapter, 
        } as any,
        getTotalTimeSpent(savingQuestion.id),
        bookmarkedQuestions.has(savingQuestion.id),
        undefined,
        undefined // ✅ Violations handled by dedicated addViolation() — not answer saves
      );
      // console.log(`📦 Q${savingQuestion.questionNo} queued for sync when online`);
      
      // 🔥 DIRTY FLAG: Update last saved answer even when offline
      setLastSavedAnswers(prev => ({
        ...prev,
        [savingQuestion.id]: answer
      }));
    }
    
    // Show success feedback
    setLastSavedQuestion(savingQuestion.id);
    setTimeout(() => setLastSavedQuestion(null), 2000);
  }
  
  setIsSavingAnswer(false);
}, [
  currentQuestion,
  editorRef,
  codeInput,
  selectedLanguage,
  mcqAnswer,
  descriptiveAnswer,
  fillBlanksAnswers,
  jumbledAnswers,
  questionStartTime,
  attempt,
  questionTimeTracking,
  isOnline,
  questions,
  questionViolations,
  bookmarkedQuestions
]);

  // ==================== SUBMIT EXAM HANDLER ====================
  const handleSubmitExam = useCallback(async () => {
  // Set submitting state
  setSubmitStatus(SUBMIT_STATUS.SUBMITTING);
  setSubmitMessage('');

  // ==================== CHECK IF OFFLINE ====================
  if (!isOnline) {
    // console.log('🚫 Cannot submit exam - offline');
    setSubmitStatus(SUBMIT_STATUS.ERROR);
    setSubmitMessage('Cannot submit exam while offline. Please check your internet connection.');
    return;
  }
  
  // ==================== SAVE FINAL TIME FOR CURRENT QUESTION ====================
  const currentQuestionId = questions[currentQuestionIndex]?.id;
  if (currentQuestionId && questionStartTime > 0) {
    let finalTime = Math.floor((Date.now() - questionStartTime) / 1000);
    
    // ✅ CRITICAL FIX: Don't count time from before exam started
    if (attempt && attempt.startTime) {
      const examStartTime = attempt.startTime instanceof Date 
        ? attempt.startTime.getTime()
        : (attempt.startTime as any).toDate().getTime();
      
      // If questionStartTime is before exam start, only count from exam start
      if (questionStartTime < examStartTime) {
        finalTime = Math.floor((Date.now() - examStartTime) / 1000);
      }
    }
    
    if (finalTime > 0 && finalTime < 3600) {
      setQuestionTimeTracking(prev => {
        const updated = {
          ...prev,
          [currentQuestionId]: (prev[currentQuestionId] || 0) + finalTime
        };
        localStorage.setItem(TIME_TRACKING_KEY, JSON.stringify(updated));
        // console.log(`⏱️ Saved final time for Q${currentQuestionIndex + 1}: ${finalTime}s (total: ${updated[currentQuestionId]}s)`);
        return updated;
      });
    }
  }  
  await saveCurrentAnswer(true);
  // Get final answers including the current question
  const finalAnswers = { ...answers };
  if (currentQuestion) {
    let currentAnswer: any;
    switch (currentQuestion.type) {
      case QUESTION_TYPES.SQL:
    case QUESTION_TYPES.CODE:
        currentAnswer = editorRef.current ? editorRef.current.getValue() : codeInput;
        break;
      case QUESTION_TYPES.MCQ:
        currentAnswer = mcqAnswerRef.current;  // ✅ Use REF for latest value
        break;
      case QUESTION_TYPES.DESCRIPTIVE:
        currentAnswer = descriptiveAnswerRef.current;  // ✅ Use REF for latest value
        break;
      case QUESTION_TYPES.FITB:
        currentAnswer = fillBlanksAnswersRef.current;  // ✅ Use REF for latest value
        break;
      case QUESTION_TYPES.JUMBLED:
        currentAnswer = jumbledAnswersRef.current;  // ✅ Use REF for latest value
        break;
    }
    if (currentAnswer && (typeof currentAnswer === 'string' ? currentAnswer.trim() : true)) {
      finalAnswers[currentQuestion.id] = currentAnswer;
    }
  }
  
  // ==================== LOG EXAM COMPLETION ====================
  // Exit activity is automatically logged in submitExam function
  // console.log('✅ Exam will be submitted');
  // console.log('📊 Total questions answered:', Object.keys(finalAnswers).length);
  // console.log('⚠️ Total violations:', violations.length);
  
  setIsMonitoringActive(false);
  (window as any).__EXAMINERS_STUDENT_IN_EXAM = false; // ✅ Clear secure browser token on submission
  
  // ==================== SYNC PENDING VIOLATIONS ====================
  // ✅ Force sync any pending violations before submission via violationQueueService
  // console.log('🔄 Force syncing all pending violations before submission...');
  try {
    await violationQueueService.forceSyncNow();
    // console.log('✅ Successfully synced all pending violations');
  } catch (error) {
    console.error('❌ Failed to sync some violations before submission:', error);
    // Continue with submission anyway - violations are saved in localStorage
  }
  
  // ==================== ENHANCED SUBMISSION ====================
  // Force sync queued answers
  if (syncStatus.queueLength > 0) {
    // console.log('🔄 Syncing queued answers...');
    await offlineQueueService.forceSyncNow();
  }

  // Submit exam (we already checked isOnline above)
  if (attempt) {
    try {
      // console.log('📤 Submitting exam with AI evaluation...');
      const result = await submitExamToFirebase(false);
      
      if (result.success) {
        // console.log('✅ Exam submitted successfully');
        
        // Clear ALL offline data after successful submission
        offlineQueueService.clearBackup(attempt.attemptId);
        offlineQueueService.clearQueue(); // ✅ Clear the answer queue
        violationQueueService.clearQueue(); // ✅ Clear the violation queue
        
        // Clear localStorage backups
        try {
          // Clear exam-specific data
          localStorage.removeItem(`examAnswers_${examId}_${userId}`);
          localStorage.removeItem(`examBackup_${examId}_${userId}`);  // ✅ Periodic backup
          localStorage.removeItem(`exam_backup_${attempt.attemptId}`);  // ✅ Attempt backup
          localStorage.removeItem(`examBookmarks_${examId}_${userId}`);
          localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
          localStorage.removeItem(TIME_TRACKING_KEY); // ✅ Clear time tracking data
          localStorage.removeItem(VIOLATIONS_TRACKING_KEY); // ✅ Clear violations data
          
          // ✅ Remove this tab from activeExamTabs
          const activeTabs = (localStorage.getItem('activeExamTabs') || '')
            .split(',')
            .filter(t => t && t !== tabId.current);
          if (activeTabs.length > 0) {
            localStorage.setItem('activeExamTabs', activeTabs.join(','));
          } else {
            localStorage.removeItem('activeExamTabs');
          }
          
          // console.log('🧹 All offline data cleared after successful submission');
          // console.log('⏱️ Time tracking data cleared');
          // console.log('🚨 Violations data cleared');
          // console.log('📑 Exam backup data cleared');
          // console.log('🪟 Active tab tracking cleared');
        } catch (error) {
          console.error('❌ Error clearing localStorage:', error);
        }
        
        // Show success state briefly
        setSubmitStatus(SUBMIT_STATUS.SUCCESS);
        setSubmitMessage('Your exam has been submitted successfully!');
        
        // console.log('🟢 SUCCESS STATUS SET, showSubmitDialog should be:', showSubmitDialog); // ADD THIS
        // Helper function to safely convert timestamps
        const toDate = (timestamp: any): Date => {
          if (!timestamp) return new Date();
          if (timestamp instanceof Date) return timestamp;
          if (typeof timestamp.toDate === 'function') return timestamp.toDate();
          if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
          return new Date();
        };
        
        // Convert Firestore Timestamps to Date objects before passing to parent
        const attemptWithDates = {
          ...attempt,
          startTime: toDate(attempt.startTime),
          submitTime: attempt.submitTime ? toDate(attempt.submitTime) : undefined,
          createdAt: toDate(attempt.createdAt),
          updatedAt: toDate(attempt.updatedAt),
          responses: attempt.responses?.map((r: any) => ({
            ...r,
            answeredAt: toDate(r.answeredAt),
            createdAt: toDate(r.createdAt),
            updatedAt: toDate(r.updatedAt),
            feedback: r.feedback ? {
              ...r.feedback,
              evaluatedAt: toDate(r.feedback.evaluatedAt),
            } : undefined,
          })) || [],
          violations: attempt.violations?.map((v: any) => ({
            ...v,
            timestamp: toDate(v.timestamp),
          })) || [],
          questionViolations: questionViolations,  // ✅ ADD: Include per-question violations
          activities: attempt.activities?.map((a: any) => ({
            ...a,
            timestamp: toDate(a.timestamp),
          })) || [],
        };
        
        // ✅ Store attempt data for manual navigation - NO AUTO REDIRECT
        submittedAttemptData.current = attemptWithDates;
        // console.log('✅ Exam submitted - waiting for user to click Go to Home');
      } else {
        setSubmitStatus(SUBMIT_STATUS.ERROR);
        setSubmitMessage(result.message || 'Failed to submit exam. Please try again.');
      }
    } catch (error: any) {
      setSubmitStatus(SUBMIT_STATUS.ERROR);
      setSubmitMessage(error.message || 'An unexpected error occurred. Please try again.');
    }
  } else {
    setSubmitStatus(SUBMIT_STATUS.ERROR);
    const isStudentUser = !!(userStudentRoll && userStudentRoll.trim() !== '' && userStudentRoll !== 'N/A');
    setSubmitMessage(
      isStudentUser
        ? 'No active exam attempt found. Please refresh and try again.'
        : 'You are viewing this exam in preview mode. Only students can submit exams.'
    );
  }
}, [
  isOnline, 
  questions, 
  currentQuestionIndex, 
  questionStartTime, 
  attempt, 
  answers, 
  currentQuestion, 
  codeInput, 
  mcqAnswer, 
  descriptiveAnswer, 
  fillBlanksAnswers, 
  jumbledAnswers, 
  violations, 
  syncStatus, 
  questionViolations, 
  examId, 
  userId, 
  saveCurrentAnswer, 
  submitExamToFirebase, 
  onSubmitExam
]);

   // Timer effect - Calculate remaining time based on exam end time
useEffect(() => {
  const calculateTimeLeft = () => {    
    // Get student's actual start time from attempt
    const studentStartTime = attempt?.startTime instanceof Date 
      ? attempt.startTime 
      : new Date((attempt?.startTime as any)?.toDate?.() || Date.now());

    // Calculate this student's end time
    // duration is the actual exam duration (separate from likertDuration)
    // The exam timer starts from when likert phase ends, so offset startTime by likertDurationMins
    const effectiveStartTime = (likertOnlyQuestions.length > 0 && likertDurationMins > 0)
      ? new Date(studentStartTime.getTime() + likertDurationMins * 60 * 1000)
      : studentStartTime;

    const endTime = calculateStudentEndTime(
      examDate,
      examTime || '00:00',
      duration,
      completionPolicy,
      effectiveStartTime,
      likertDurationMins
    );
    
    const now = new Date().getTime();
    const end = endTime.getTime();
    const difference = end - now;
    
    const secondsLeft = Math.floor(difference / 1000);
    
    if (secondsLeft <= 0) {
      setTimeLeft(0);
      
      // ✅ Don't trigger time expired or auto-submit during likert phase
      // The main exam timer should not fire while student is still in personality assessment
      if (examPhase === 'likert') return;
      
      setShowTimeExpiredOverlay(true);
      
      // Auto-submit logic (existing code)
      if (!autoSubmitTriggered.current && questions.length > 0 && attempt?.attemptId && isOnline && !isAlreadySubmitted) {
        autoSubmitTriggered.current = true;
        (window as any).__EXAMINERS_STUDENT_IN_EXAM = false; // ✅ Clear token on auto-submit so student can exit
        // console.log(`⏰ TIME EXPIRED (${completionPolicy} mode) - Auto-submitting exam...`);
        handleSubmitExam().catch(err => {
          console.error('❌ Auto-submit failed:', err);
          autoSubmitTriggered.current = false;
        });
      }
      
      return;
    }
  
  setTimeLeft(secondsLeft);

    // Show 15-minute warning (900 seconds = 15 minutes)
    if (secondsLeft <= 900 && secondsLeft > 898 && !has15MinWarningShown) {
      setShow15MinWarning(true);
      setHas15MinWarningShown(true);
    }
  };

  calculateTimeLeft();
  const timer = setInterval(calculateTimeLeft, 1000);

  return () => clearInterval(timer);
}, [examDate, examTime, duration, completionPolicy, attempt?.startTime, has15MinWarningShown, questions.length, attempt?.attemptId, isOnline, isAlreadySubmitted, handleSubmitExam, likertOnlyQuestions.length, likertDurationMins, examPhase]);

  // ── LIKERT PHASE TIMER ─────────────────────────────────────────────────
  useEffect(() => {
    if (examPhase !== 'likert' || likertTimeLeft <= 0) return;
    const t = setInterval(() => {
      setLikertTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [examPhase]); // only restart when phase changes, not on every tick

  // Auto-advance to exam when likert timer hits 0
  useEffect(() => {
    if (examPhase === 'likert' && likertTimeLeft === 0 && likertOnlyQuestions.length > 0 && !likertAutoAdvanced.current) {
      likertAutoAdvanced.current = true;
      // console.log('⏰ Likert timer expired — advancing to EXAM phase');
      setShowPhaseTransition(true);
      setPhaseTransitionCount(60);
      const countInterval = setInterval(() => {
        setPhaseTransitionCount(prev => {
          if (prev <= 1) { clearInterval(countInterval); return 0; }
          return prev - 1;
        });
      }, 1000);
      setTimeout(() => {
        clearInterval(countInterval);
        setExamPhase('exam');
        setTimeLeft(duration * 60);
        setCurrentQuestionIndex(likertOnlyQuestions.length);
        setShowPhaseTransition(false);
      }, 60000);
    }
  }, [examPhase, likertTimeLeft, likertOnlyQuestions.length]);
  // ──────────────────────────────────────────────────────────────────────

  // ==================== OFFLINE QUEUE MANAGEMENT ====================
  
  // Queue complete connectivity cycle when reconnection happens
  const queueConnectivityCycle = (disconnectionTime: Date, reconnectionTime: Date) => {
    // Prevent duplicate connectivity cycle events
    if (isProcessingReconnection.current) {
      // console.log('⚠️ Connectivity cycle already queued, skipping duplicate');
      return;
    }
    
    isProcessingReconnection.current = true;
    
    const connectivityEvent = {
      type: 'connectivity_cycle' as const,
      data: {
        examId,
        userId,
        disconnectionTimestamp: disconnectionTime,
        reconnectionTimestamp: reconnectionTime,
        internetUnavailableDuration: Math.round((reconnectionTime.getTime() - disconnectionTime.getTime()) / 1000)
      },
      timestamp: reconnectionTime
    };
    
    setOfflineEventQueue(prev => [...prev, connectivityEvent]);
    // console.log('📦 Complete connectivity cycle queued:', connectivityEvent.data.internetUnavailableDuration, 'seconds');
  };

  // Process offline queue when internet is restored
  const processOfflineQueue = async () => {
    if (offlineEventQueue.length === 0) {
      // console.log('📡 No events in offline queue to process');
      return;
    }
    
    // console.log('\n🔍 ========== OFFLINE QUEUE PROCESSING DEBUG ==========');
    // console.log('📡 🔄 Processing offline queue:', offlineEventQueue.length, 'events');
    // console.log('📡 Queue contents:', offlineEventQueue.map(e => ({ 
      // type: e.type, 
      // timestamp: e.timestamp,
      // data: e.data,
      // failedAttempts: (e as any).failedAttempts || 0
    // })));
    // console.log('🔍 ===================================================\n');
    
    try {
      const processedEvents: typeof offlineEventQueue = [];
      const failedEvents: typeof offlineEventQueue = [];
      let processedCount = 0;
      let failedCount = 0;
      let removedCount = 0;
      
      for (const event of offlineEventQueue) {
        const currentAttempts = event.failedAttempts || 0;
        
        // If event has failed 3+ times, just remove it
        if (currentAttempts >= 3) {
          // console.log(`🗑️ Removing event after ${currentAttempts} failed attempts:`, event.type);
          processedEvents.push(event); // Mark for removal
          removedCount++;
          continue;
        }
        
        // console.log(`📡 Processing event ${processedCount + failedCount + 1}/${offlineEventQueue.length}:`, event.type);
        
        if (event.type === 'connectivity_cycle') {
          try {
            // console.log('🔍 Processing connectivity_cycle event:', {
              // examId: event.data.examId,
              // userId: event.data.userId,
              // disconnectionTimestamp: event.data.disconnectionTimestamp,
              // reconnectionTimestamp: event.data.reconnectionTimestamp,
              // disconnectionType: typeof event.data.disconnectionTimestamp,
              // reconnectionType: typeof event.data.reconnectionTimestamp
            // });
            
            // ✅ FIX: Convert timestamps to Date objects if they're strings (from localStorage)
            const disconnectionTimestamp = event.data.disconnectionTimestamp instanceof Date 
              ? event.data.disconnectionTimestamp 
              : new Date(event.data.disconnectionTimestamp);
            
            const reconnectionTimestamp = event.data.reconnectionTimestamp instanceof Date
              ? event.data.reconnectionTimestamp
              : new Date(event.data.reconnectionTimestamp);
            
            // console.log('🔍 Converted timestamps:', {
              // disconnectionTimestamp,
              // reconnectionTimestamp,
              // duration: Math.round((reconnectionTimestamp.getTime() - disconnectionTimestamp.getTime()) / 1000) + 's'
            // });
            
            // Send complete connectivity cycle to Firebase in ONE operation
            await firebaseService.logConnectivityCycle(
              event.data.examId,
              event.data.userId,
              disconnectionTimestamp,
              reconnectionTimestamp
            );
            // console.log('✅ Connectivity cycle logged successfully:', entryId);
            // console.log('   Internet unavailable for:', event.data.internetUnavailableDuration, 'seconds');
            processedEvents.push(event);
            processedCount++;
            isProcessingReconnection.current = false; // Reset the flag
          } catch (error) {
            console.error('❌ Failed to log connectivity cycle (attempt', currentAttempts + 1, '):', error);
            console.error('   Event data:', event.data);
            console.error('   Error details:', error);
            failedEvents.push({ ...event, failedAttempts: currentAttempts + 1 });
            failedCount++;
          }
        } else if (event.type === 'answer_save') {
          try {
            // console.log('💾 Processing queued answer save:', event.data.questionId);
            // For now, just mark as processed since answers are already in localStorage
            processedEvents.push(event);
            processedCount++;
            // console.log('✅ Answer save processed successfully');
          } catch (error) {
            console.error('❌ Failed to save queued answer (attempt', currentAttempts + 1, '):', error);
            failedEvents.push({ ...event, failedAttempts: currentAttempts + 1 });
            failedCount++;
          }
        } else if (event.type === 'exam_submit') {
          try {
            // console.log('📤 Processing queued exam submission');
            onSubmitExam(event.data.answers);
            localStorage.removeItem(`examAnswers_${examId}_${userId}`);
            localStorage.removeItem(`examBackup_${examId}_${userId}`);
            // console.log('✅ Queued exam submission processed successfully');
            processedEvents.push(event);
            processedCount++;
          } catch (error) {
            console.error('❌ Failed to process queued exam submission (attempt', currentAttempts + 1, '):', error);
            failedEvents.push({ ...event, failedAttempts: currentAttempts + 1 });
            failedCount++;
            alert('❌ Failed to submit your exam. Your answers are still saved locally. Please contact your exam supervisor.');
          }
        } else {
          // Unknown event type - remove it
          // console.warn('⚠️ Unknown event type:', event.type, '- removing from queue');
          processedEvents.push(event);
          removedCount++;
        }
      }
      
      // Update queue: remove processed, update failed with new attempt count
      const remainingEvents = failedEvents;
      setOfflineEventQueue(remainingEvents);
      
      // console.log(`📡 Processing complete: ${processedCount} succeeded, ${failedCount} will retry, ${removedCount} removed`);
      
      if (remainingEvents.length === 0) {
        // console.log('✅ 🎉 All offline events processed successfully!');
        
        // Show success message if exam was submitted
        const hadExamSubmission = processedEvents.some(e => e.type === 'exam_submit');
        if (hadExamSubmission) {
          alert('✅ Your exam has been successfully submitted!');
        }
      } else if (processedCount > 0) {
        // console.log(`⚠️ Partially processed: ${processedCount} successful, ${remainingEvents.length} remain for retry.`);
      } else {
        // console.log('❌ No events could be processed. Will retry later (attempt counts updated).');
      }
      
    } catch (error) {
      console.error('❌ Critical error processing offline queue:', error);
    }
  };

  // Auto-process queue when online and queue has items
useEffect(() => {
  // Don't process queue if exam is already submitted
  if (isAlreadySubmitted) {
    // console.log('⚠️ Exam already submitted, ignoring offline queue');
    // Clear the queue since exam is done
    if (offlineEventQueue.length > 0) {
      setOfflineEventQueue([]);
      localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
      // console.log('🧹 Cleared offline queue (exam already submitted)');
    }
    return;
  }
  
  if (isOnline && offlineEventQueue.length > 0 && !isProcessingQueue.current) {
    // console.log('🔄 Auto-processing triggered: online with', offlineEventQueue.length, 'queued events');
    isProcessingQueue.current = true;
    
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      processOfflineQueue().finally(() => {
        isProcessingQueue.current = false;
      });
    }, 1000);
    
    return () => {
      clearTimeout(timer);
      isProcessingQueue.current = false;
    };
  }
}, [isOnline, offlineEventQueue.length, isAlreadySubmitted, examId, userId]);

  // ==================== AUTOMATIC QUEUE CLEANUP ====================
  
  /**
   * Automatically clean stuck/old events from offline queue
   */
  const cleanupOfflineQueue = useCallback(() => {
    if (offlineEventQueue.length === 0) return;

    const now = Date.now();
    const MAX_EVENT_AGE = 10 * 60 * 1000; // 10 minutes
    const MAX_CONNECTIVITY_EVENT_AGE = 5 * 60 * 1000; // 5 minutes for connectivity events
    
    // console.log('🧹 Running automatic queue cleanup...');
    
    const cleanedQueue = offlineEventQueue.filter((event) => {
      const eventAge = now - (typeof event.timestamp === 'number' ? event.timestamp : event.timestamp.getTime());
      
      // Remove old connectivity events (not critical)
      if (event.type === 'connectivity_cycle') {
        if (eventAge > MAX_CONNECTIVITY_EVENT_AGE) {
          // console.log(`🗑️ Removing old connectivity event (${Math.round(eventAge / 1000)}s old)`);
          return false;
        }
      }
      
      // Remove events that failed 3+ times
      if ((event.failedAttempts || 0) >= 3) {
        // console.log(`🗑️ Removing event after ${event.failedAttempts} failed attempts:`, event.type);
        return false;
      }
      
      // Remove very old events (regardless of type)
      if (eventAge > MAX_EVENT_AGE) {
        // console.log(`🗑️ Removing stale event (${Math.round(eventAge / 1000)}s old):`, event.type);
        return false;
      }
      
      return true; // Keep event
    });
    
    if (cleanedQueue.length !== offlineEventQueue.length) {
      // const _removedCount = offlineEventQueue.length - cleanedQueue.length;
      // console.log(`🧹 Cleanup removed ${removedCount} stuck event(s)`);
      setOfflineEventQueue(cleanedQueue);
      
      // Update localStorage
      if (cleanedQueue.length === 0) {
        localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
      } else {
        localStorage.setItem(`examOfflineQueue_${examId}_${userId}`, JSON.stringify(cleanedQueue));
      }
    } else {
      // console.log('✅ Queue is clean - no stuck events found');
    }
  }, [offlineEventQueue, examId, userId]);

  /**
   * Run cleanup 30 seconds after connection is restored (as precaution)
   */
  useEffect(() => {
    let cleanupTimer: number | null = null;
    
    if (isOnline && offlineEventQueue.length > 0) {
      // console.log('🌐 Connection restored - will check for stuck events in 30 seconds...');
      
      // Wait 30 seconds after connection restoration, then cleanup
      cleanupTimer = window.setTimeout(() => {
        // console.log('⏰ 30 seconds passed since reconnection - running safety cleanup...');
        cleanupOfflineQueue();
      }, 1 * 60 * 1000);
    }
    
    return () => {
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
      }
    };
  }, [isOnline, cleanupOfflineQueue, offlineEventQueue.length]);

  // Auto-save current answer to Firebase every 60 seconds when online
// WITH DIRTY FLAG - Only save if answer actually changed!
useEffect(() => {
  if (!isOnline || !currentQuestion || !attempt?.attemptId || attemptLoading || !answersInitialized) {
    return;
  }
  
  // console.log('⏰ AUTO-SAVE STARTED at', new Date().toLocaleTimeString(), '- Will save every 60 seconds');
  
  const autoSaveInterval = setInterval(() => {
    // const _triggerTime = new Date().toLocaleTimeString();
    
    // ✅ FIX: Get current question index from REF (not stale closure)
    const currentIdx = currentQuestionRef.current.index;
    const currentQ = questions[currentIdx];
    if (!currentQ) {
      // console.log('⏭️ Auto-save skipped - no current question');
      return;
    }
    
    // console.log('\n⏰ AUTO-SAVE TRIGGER at', triggerTime, '- Question', currentQ.questionNo);
    
    // ✅ FIX: Get current answer from REFS (not stale closure values)
    let currentAnswer: any;
    
    switch (currentQ.type) {
      case QUESTION_TYPES.SQL:
    case QUESTION_TYPES.CODE:
        // editorRef is already a ref, so this is safe
        currentAnswer = editorRef.current ? editorRef.current.getValue() : '';
        break;
      case QUESTION_TYPES.MCQ:
        currentAnswer = mcqAnswerRef.current; // ✅ USE REF
        break;
      case QUESTION_TYPES.DESCRIPTIVE:
        currentAnswer = descriptiveAnswerRef.current; // ✅ USE REF
        break;
      case QUESTION_TYPES.FITB:
        currentAnswer = fillBlanksAnswersRef.current; // ✅ USE REF
        break;
      case QUESTION_TYPES.JUMBLED:
        currentAnswer = jumbledAnswersRef.current; // ✅ USE REF
        break;
    }
    
    // Check if there's an answer
    let hasAnswer = false;
    
    switch (currentQ.type) {
      case QUESTION_TYPES.SQL:
    case QUESTION_TYPES.CODE:
        hasAnswer = currentAnswer && currentAnswer.trim() !== (currentQ.boilerplate || '');
        break;
      case QUESTION_TYPES.MCQ:
        hasAnswer = Array.isArray(currentAnswer) && currentAnswer.length > 0;
        break;
      case QUESTION_TYPES.DESCRIPTIVE:
        hasAnswer = !!currentAnswer && currentAnswer.trim() !== '';
        break;
      case QUESTION_TYPES.FITB:
        hasAnswer = Array.isArray(currentAnswer) && currentAnswer.some((a: string) => a && a.trim() !== '');
        break;
      case QUESTION_TYPES.JUMBLED:
        hasAnswer = Array.isArray(currentAnswer) && currentAnswer.length > 0;
        break;
    }
    
    if (!hasAnswer) {
      // console.log('⏭️ Auto-save skipped for Q' + currentQ.questionNo + ' - no answer');
      return;
    }
    
    // 🔥 DIRTY FLAG CHECK: Compare with last saved answer (use answersRef for latest)
    const lastSaved = answersRef.current[currentQ.id];
    const currentSerialized = JSON.stringify(currentAnswer);
    const lastSavedSerialized = JSON.stringify(lastSaved);
    
    if (currentSerialized === lastSavedSerialized) {
      // const _skipTime = new Date().toLocaleTimeString();
      // console.log('⏭️ Auto-save SKIPPED at', skipTime, '- Q' + currentQ.questionNo + ' - no changes since last save');
      return;
    }

    // const _saveTime = new Date().toLocaleTimeString();
    // console.log('⏰ Auto-save triggered for Q' + currentQ.questionNo + ' - answer changed!');
    // console.log('💾 SAVING NOW at', saveTime);
    // console.log('  - Code length:', currentQ.type === QUESTION_TYPES.CODE || currentQ.type === QUESTION_TYPES.SQL ? currentAnswer?.length : 'N/A');
    // console.log('  - Last saved length:', currentQ.type === QUESTION_TYPES.CODE || currentQ.type === QUESTION_TYPES.SQL ? lastSaved?.length : 'N/A');
    saveCurrentAnswer(true);
  }, 60000); // 60 seconds

  return () => {
    // console.log('⏰ AUTO-SAVE INTERVAL CLEARED');
    clearInterval(autoSaveInterval);
  };
}, [isOnline, attempt?.attemptId, attemptLoading, answersInitialized]); // ✅ MINIMAL DEPENDENCIES - only recreate when these critical values change

// ✅ Keep answersRef in sync with answers state
useEffect(() => {
  answersRef.current = answers;
}, [answers]);

// Periodic backup save (every 60 seconds) - extra safety
useEffect(() => {
  const backupInterval = setInterval(() => {
    const currentAnswers = answersRef.current; // ✅ Use ref to get latest answers
    if (Object.keys(currentAnswers).length > 0) {
      try {
        const backup = {
          answers: currentAnswers,
          timestamp: new Date().toISOString(),
          examId,
          userId
        };
        localStorage.setItem(`examBackup_${examId}_${userId}`, JSON.stringify(backup));
        // console.log('💾 🔒 Backup save completed:', Object.keys(currentAnswers).length, 'answers');
      } catch (error) {
        console.error('❌ Backup save failed:', error);
      }
    }
  }, 60000); // 60 seconds
  
  return () => clearInterval(backupInterval);
}, [examId, userId]);


  // ✅ Keep answersRef in sync with answers state
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  
  // Robust internet connectivity monitoring with actual network checks
  useEffect(() => {
    let failedAttempts = 0;
    const MAX_FAILED_ATTEMPTS = 3; // Must fail 3 times before showing dialog
    const CHECK_INTERVAL = 10000; // Check every 10 seconds
    const TIMEOUT = 5000; // 5 second timeout for each request
    
    // Use ref to track online state within this effect (avoids stale closure)
    let wasOnline = isOnline;

    // Check connectivity by loading an image (no CORS restrictions)
    const checkConnectivity = () => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          img.src = ''; // Cancel loading
          reject(new Error('Timeout'));
        }, TIMEOUT);

        img.onload = () => {
          clearTimeout(timeout);
          resolve(true);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load'));
        };

        // Use a reliable CDN endpoint with cache-busting
        // This endpoint is fast, reliable, and has no CORS issues for image loading
        img.src = `https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png?${Date.now()}`;
      });
    };

    const performCheck = async () => {
      try {
        await checkConnectivity();
        
        // Connection successful - reset everything
        failedAttempts = 0;
        
        // If we were previously offline and have tracked disconnection, queue the complete connectivity cycle
        if (!wasOnline && disconnectionStartTime.current) {
          const reconnectionTime = new Date();
          
          // console.log('✅ Internet reconnected! Creating connectivity cycle event...');
          // console.log('   Disconnection:', disconnectionStartTime.current);
          // console.log('   Reconnection:', reconnectionTime);
          
          // Queue complete connectivity cycle (disconnection + reconnection in ONE entry)
          queueConnectivityCycle(disconnectionStartTime.current, reconnectionTime);
          
          // Reset tracking variables after queueing
          disconnectionStartTime.current = null;
        }
        
        // Update local tracking flag
        wasOnline = true;
        
        // Seamless reconnection - indicator turns green automatically
        // Note: Queue processing is handled by dedicated useEffect
        setIsOnline(true);
        
        // Clear any pending offline confirmation
        if (offlineConfirmationTimeout.current) {
          clearTimeout(offlineConfirmationTimeout.current);
          offlineConfirmationTimeout.current = null;
        }
      } catch (error) {
        // Request failed - increment counter
        failedAttempts++;
        
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          // After 3 consecutive failures, confirm offline
          
          // Track disconnection time locally (don't queue yet, wait for reconnection)
          if (wasOnline && !disconnectionStartTime.current) {
            disconnectionStartTime.current = new Date();
            // console.log('📡 Internet disconnected at:', disconnectionStartTime.current);
          }
          
          // Update local tracking flag
          wasOnline = false;
          
          // Update UI state
          setIsOnline(false);
        }
      }
    };

    // Initial check
    performCheck();

    // Set up periodic checks
    connectivityCheckInterval.current = setInterval(performCheck, CHECK_INTERVAL);

    // Also listen to browser events as additional signals
    const handleBrowserOnline = () => {
      performCheck();
    };

    const handleBrowserOffline = () => {
      failedAttempts = MAX_FAILED_ATTEMPTS; // Force immediate offline detection
      performCheck();
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    return () => {
      if (connectivityCheckInterval.current) {
        clearInterval(connectivityCheckInterval.current);
      }
      if (offlineConfirmationTimeout.current) {
        clearTimeout(offlineConfirmationTimeout.current);
      }
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
    };
  }, []); // Empty dependencies - this effect should run once and persist

  // ==================== DEBUG: Expose functions to window for testing ====================
  useEffect(() => {
    (window as any).debugOfflineQueue = {
      viewQueue: () => {
        // console.log('\n📋 ========== OFFLINE EVENT QUEUE ==========');
        // console.log('Total events:', offlineEventQueue.length);
        // console.log('Events:', offlineEventQueue.map((e, i) => ({
          // index: i,
          // type: e.type,
          // timestamp: e.timestamp,
          // data: e.data,
          // failedAttempts: (e as any).failedAttempts || 0
        // })));
        // console.log('📋 =========================================\n');
        
        // console.log('\n📋 ========== ANSWER QUEUE (offlineQueueService) ==========');
        // const _answerQueueStatus = offlineQueueService.getStatus();
        // console.log('Status:', answerQueueStatus);
        // console.log('Items:', offlineQueueService.getQueue());
        // console.log('📋 ======================================================\n');
      },
      processQueue: async () => {
        // console.log('\n🔧 Manually triggering queue processing...');
        await processOfflineQueue();
        // console.log('🔧 Processing complete\n');
      },
      clearQueue: () => {
        // console.log('\n🗑️ Manually clearing offline event queue...');
        setOfflineEventQueue([]);
        localStorage.removeItem(`examOfflineQueue_${examId}_${userId}`);
        // console.log('🗑️ Queue cleared\n');
      },
      testConnectivity: () => {
        // console.log('\n🧪 Testing connectivity cycle...');
        const now = new Date();
        const before = new Date(now.getTime() - 30000); // 30 seconds ago
        queueConnectivityCycle(before, now);
        // console.log('🧪 Connectivity cycle queued\n');
      }
    };
    
    // console.log('🔧 Debug functions available: window.debugOfflineQueue');
    // console.log('   - window.debugOfflineQueue.viewQueue() - View both queues');
    // console.log('   - window.debugOfflineQueue.processQueue() - Process queue manually');
    // console.log('   - window.debugOfflineQueue.clearQueue() - Clear event queue');
    // console.log('   - window.debugOfflineQueue.testConnectivity() - Test connectivity cycle');
    
    return () => {
      delete (window as any).debugOfflineQueue;
    };
  }, [offlineEventQueue, examId, userId]);

  // Inject CSS for read-only lines in Monaco editor
  useEffect(() => {
    const styleId = 'monaco-readonly-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .read-only-line-light {
          background-color: rgba(0, 0, 0, 0.03) !important;
        }
        .read-only-line-dark {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
        .read-only-glyph {
          opacity: 0.5;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes pulse-green {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
            box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.4);
          }
        }
        .animate-pulse-green {
          animation: pulse-green 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        /* Remove ALL Monaco editor shadows */
        .monaco-editor .scroll-decoration,
        .monaco-editor .minimap-shadow-visible,
        .monaco-editor .shadow,
        .monaco-editor .decorationsOverviewRuler,
        .monaco-scrollable-element > .shadow,
        .monaco-scrollable-element > .shadow.top-left-corner,
        .monaco-scrollable-element > .shadow.left,
        .monaco-scrollable-element > .shadow.right,
        .monaco-scrollable-element > .shadow.top,
        .monaco-editor .visible.scrollbar,
        .monaco-editor .scrollbar.vertical,
        .monaco-editor .minimap-shadow-hidden {
          display: none !important;
          box-shadow: none !important;
          width: 0 !important;
          opacity: 0 !important;
        }
        .monaco-editor,
        .monaco-editor .overflow-guard,
        .monaco-editor .monaco-scrollable-element {
          box-shadow: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ==================== UNIFIED ANSWER LOAD + CLEAR EFFECT ====================
  // 🔥 REFACTORED: Single useLayoutEffect that:
  //   1. FIRST clears ALL input fields to prevent cross-contamination
  //   2. THEN loads the correct answer for the current question using answersRef (never stale)
  //   3. Eliminates race conditions between separate clear/load effects
  //   4. Protects user's in-progress typing from late Firebase sync
  const lastLoadedQuestionIdRef = useRef<string | null>(null);
  
  useLayoutEffect(() => {
    if (!currentQuestion) {
      // console.log('⏳ No current question yet...');
      return;
    }

    const isQuestionChange = lastLoadedQuestionIdRef.current !== currentQuestion.id;

    // ════════════════════════════════════════════════════════════════════
    // DIRTY GUARD: If this is NOT a question change (e.g. answersInitialized toggled)
    // and the user has already started typing on this question, do NOT touch anything
    // ════════════════════════════════════════════════════════════════════
    if (!isQuestionChange && dirtyQuestionsRef.current.has(currentQuestion.id)) {
      // console.log(`⏭️ Skipping re-load for Q${currentQuestion.questionNo} — user has active edits (dirty)`);
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // PHASE 1: CLEAR EVERYTHING — prevent any cross-question contamination
    // ════════════════════════════════════════════════════════════════════

    // 🔥 Destroy PGlite instance (each SQL question has its own schema)
    if (pgliteRef.current) {
      // console.log(`🗑️ Destroying PGlite instance for question change to Q${currentQuestion.questionNo}`);
      try { pgliteRef.current.close(); } catch (e) { /* ignore */ }
      pgliteRef.current = null;
    }

    // 🔥 Reset ALL input fields unconditionally — they will be re-populated below
    setCodeInput('');
    codeInputRef.current = '';
    setMcqAnswer([]);
    mcqAnswerRef.current = [];
    setDescriptiveAnswer('');
    descriptiveAnswerRef.current = '';
    setFillBlanksAnswers([]);
    fillBlanksAnswersRef.current = [];
    setJumbledAnswers([]);
    jumbledAnswersRef.current = [];

    // 🔥 Clear the dirty flag for the NEW question (fresh start)
    if (isQuestionChange) {
      dirtyQuestionsRef.current.delete(currentQuestion.id);
    }

    // Track which question we last loaded
    lastLoadedQuestionIdRef.current = currentQuestion.id;

    // console.log(`🧹 Cleared ALL answer fields for Q${currentQuestion.questionNo} (type: ${currentQuestion.type})`);

    // ════════════════════════════════════════════════════════════════════
    // PHASE 2: READ saved answer from REF (always latest, never stale)
    // ════════════════════════════════════════════════════════════════════

    // 🔥 CRITICAL: Use answersRef instead of answers state to avoid stale closures
    const savedAnswer = answersRef.current[currentQuestion.id];

    if (!answersInitialized && savedAnswer) {
      // console.log('⏳ Waiting for saved answer to be loaded from Firebase...');
      return;
    }

    // Allow loading default content for all question types without waiting for attempt
    const immediateLoadTypes: QuestionType[] = [
      QUESTION_TYPES.CODE, 
      QUESTION_TYPES.SQL,
      QUESTION_TYPES.JUMBLED, 
      QUESTION_TYPES.DESCRIPTIVE,
      QUESTION_TYPES.MCQ,
      QUESTION_TYPES.FITB
    ];
    const shouldWaitForAttempt = !immediateLoadTypes.includes(currentQuestion.type);

    if (shouldWaitForAttempt && (!attempt || attemptLoading)) {
      // console.log('⏳ Waiting for attempt to load before setting question answer...');
      return;
    }
    
    setViewedQuestions(prev => new Set([...prev, currentQuestion.id]));

    // ════════════════════════════════════════════════════════════════════
    // PHASE 3: LOAD the correct answer for the current question type
    // ════════════════════════════════════════════════════════════════════
      
      // console.log('\n' + '='.repeat(80));
      // console.log(`📝 LOADING ANSWER FOR Q${currentQuestion.questionNo}`);
      // console.log(`  - Question ID: ${currentQuestion.id}`);
      // console.log(`  - Question Type: ${currentQuestion.type}`);
      // console.log(`  - Saved answer found?`, savedAnswer ? 'YES' : 'NO');
      if (savedAnswer) {
        // console.log(`  - Saved answer type:`, typeof savedAnswer);
        // console.log(`  - Saved answer preview:`, typeof savedAnswer === 'string' ? savedAnswer.slice(0, 100) + '...' : JSON.stringify(savedAnswer));
      }
      // console.log('='.repeat(80) + '\n');
      
      switch (currentQuestion.type) {
        case QUESTION_TYPES.SQL:
    case QUESTION_TYPES.CODE: {
          // Auto-set language: local ref (most recent) > saved response > question data
          const localLang = selectedLanguagePerQuestion.current[currentQuestion.id];
          const savedResponse = attempt?.responses?.find((r: any) => r.questionId === currentQuestion.id);
          const savedLang = savedResponse?.programmingLanguage;
          const defaultLang = currentQuestion.language || 'javascript';
          if (currentQuestion.type === QUESTION_TYPES.SQL) {
            setSelectedLanguage('sql');
          } else if (localLang) {
            setSelectedLanguage(localLang.toLowerCase());
          } else if (savedLang) {
            setSelectedLanguage(savedLang.toLowerCase());
          } else if (currentQuestion.starterCodes && currentQuestion.starterCodes.length > 0) {
            setSelectedLanguage(currentQuestion.starterCodes[0].language.toLowerCase());
          } else if (defaultLang) {
            setSelectedLanguage(defaultLang);
          }

          // Determine the code to load: saved answer > starter code > boilerplate
          let newCode = (savedAnswer && typeof savedAnswer === 'string') ? savedAnswer : '';
          if (!newCode) {
            if (currentQuestion.starterCodes && currentQuestion.starterCodes.length > 0) {
              const lang = currentQuestion.type === QUESTION_TYPES.SQL ? 'sql'
                : currentQuestion.starterCodes[0].language.toLowerCase();
              const starterCode = currentQuestion.starterCodes.find(
                (sc: any) => sc.language.toLowerCase() === lang
              );
              newCode = starterCode?.code || currentQuestion.boilerplate || '';
            } else {
              newCode = currentQuestion.boilerplate || '';
            }
          }
          
          // Defensive check: Ensure we're not accidentally loading solution
          if (newCode === currentQuestion.solution && currentQuestion.solution) {
            console.error('⚠️ CRITICAL ERROR: Attempting to load solution instead of testStub!');
            newCode = '// Error: No starter code available\n';
          }
          
          // Store initial length for stable editor key
          initialCodeLengthRef.current[currentQuestion.id] = newCode.length;
          
          // SQL: Default placeholder if no code
          if (!newCode && currentQuestion.type === QUESTION_TYPES.SQL) {
            newCode = '-- Write your SQL query here\n';
          }
          
          // console.log(`🔧 Setting codeInput for Q${currentQuestion.questionNo}: ${newCode.slice(0, 50)}...`);
          setCodeInput(newCode);
          codeInputRef.current = newCode;
          
          // Auto-populate customInput with first test case input
          if (currentQuestion.testCases && currentQuestion.testCases.length > 0 && currentQuestion.testCases[0].input) {
            const sampleInput = currentQuestion.testCases[0].input;
            const unescapedInput = sampleInput.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
            setCustomInput(unescapedInput);
          } else {
            setCustomInput('');
          }
          break;
        }
        case QUESTION_TYPES.MCQ: {
          // MCQ answer should be an array of actual option text (not indices)
          if (savedAnswer !== undefined && Array.isArray(savedAnswer)) {
            // Convert old index-based answers to actual option text
            const convertedAnswer = savedAnswer.map((item: any) => {
              if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
                const numIndex = parseInt(item);
                if (currentQuestion.options && currentQuestion.options[numIndex]) {
                  return currentQuestion.options[numIndex];
                }
              } else if (typeof item === 'number') {
                if (currentQuestion.options && currentQuestion.options[item]) {
                  return currentQuestion.options[item];
                }
              }
              return item;
            });
            
            // Filter out invalid options
            const validOptions = convertedAnswer.filter((ans: string) => currentQuestion.options?.includes(ans));
            
            if (validOptions.length !== convertedAnswer.length) {
              // const _invalidOptions = convertedAnswer.filter((ans: string) => !currentQuestion.options?.includes(ans));
              // console.warn(`⚠️ Filtered out ${invalidOptions.length} invalid MCQ options for Q${currentQuestion.questionNo}:`, invalidOptions);
              // Auto-fix the answers state
              setAnswers(prev => ({
                ...prev,
                [currentQuestion.id]: validOptions
              }));
              answersRef.current[currentQuestion.id] = validOptions;
            }
            
            setMcqAnswer(validOptions);
            mcqAnswerRef.current = validOptions;
            // console.log(`✅ MCQ Q${currentQuestion.questionNo}: Loaded ${validOptions.length} selected option(s)`);
          } else if (savedAnswer !== undefined && typeof savedAnswer === 'string') {
            // Backward compatibility: convert string to array
            if (/^\d+$/.test(savedAnswer.trim())) {
              const numIndex = parseInt(savedAnswer);
              if (currentQuestion.options && currentQuestion.options[numIndex]) {
                const converted = [currentQuestion.options[numIndex]];
                setMcqAnswer(converted);
                mcqAnswerRef.current = converted;
              } else {
                // console.warn(`⚠️ Invalid index ${numIndex} for Q${currentQuestion.questionNo}`);
                setMcqAnswer([]);
                mcqAnswerRef.current = [];
              }
            } else if (currentQuestion.options?.includes(savedAnswer)) {
              const converted = [savedAnswer];
              setMcqAnswer(converted);
              mcqAnswerRef.current = converted;
            } else {
              // console.warn(`⚠️ Invalid option "${savedAnswer}" for Q${currentQuestion.questionNo}`);
              setMcqAnswer([]);
              mcqAnswerRef.current = [];
            }
          } else {
            setMcqAnswer([]);
            mcqAnswerRef.current = [];
          }
          break;
        }
        case QUESTION_TYPES.DESCRIPTIVE: {
          if (savedAnswer !== undefined && typeof savedAnswer === 'string') {
            setDescriptiveAnswer(savedAnswer);
            descriptiveAnswerRef.current = savedAnswer;
            // Only increment version if answer is different from current (prevents unnecessary remounts)
            answerLoadVersionRef.current[currentQuestion.id] = (answerLoadVersionRef.current[currentQuestion.id] || 0) + 1;
            // console.log(`✅ Descriptive Q${currentQuestion.questionNo} loaded: ${savedAnswer.substring(0, 50)}...`);
          } else {
            if (savedAnswer !== undefined) {
              console.error(`⚠️ WRONG TYPE: Descriptive Q${currentQuestion.questionNo} has non-string answer:`, typeof savedAnswer);
            }
            setDescriptiveAnswer('');
            descriptiveAnswerRef.current = '';
            answerLoadVersionRef.current[currentQuestion.id] = (answerLoadVersionRef.current[currentQuestion.id] || 0) + 1;
          }
          break;
        }
        case QUESTION_TYPES.FITB: {
          const blanksCount = currentQuestion.blanksCount || 
                             currentQuestion.correctAnswers?.length || 
                             (currentQuestion.questionText?.match(/_{3,}/g) || []).length || 
                             0;
          
          if (savedAnswer && Array.isArray(savedAnswer)) {
            // Ensure the array has the right length
            const padded = [...savedAnswer];
            while (padded.length < blanksCount) padded.push('');
            setFillBlanksAnswers(padded.slice(0, Math.max(blanksCount, padded.length)));
            fillBlanksAnswersRef.current = padded.slice(0, Math.max(blanksCount, padded.length));
            // console.log(`✅ FITB Q${currentQuestion.questionNo}: Loaded ${savedAnswer.length} answers for ${blanksCount} blanks`);
          } else {
            if (savedAnswer) {
              console.error(`⚠️ WRONG TYPE: FITB Q${currentQuestion.questionNo} has non-array answer:`, typeof savedAnswer);
            }
            const empty = Array(blanksCount).fill('');
            setFillBlanksAnswers(empty);
            fillBlanksAnswersRef.current = empty;
            // console.log(`📝 FITB Q${currentQuestion.questionNo}: Initialized ${blanksCount} blank(s)`);
          }
          break;
        }
      case QUESTION_TYPES.JUMBLED: {
          const jumbledItems = currentQuestion.jumbledOptions || currentQuestion.jumbledItems || [];
          
          if (savedAnswer && Array.isArray(savedAnswer) && savedAnswer.length > 0) {
            setJumbledAnswers(savedAnswer);
            jumbledAnswersRef.current = savedAnswer;
            // console.log(`✅ Jumbled Q${currentQuestion.questionNo}: Loaded saved answer with ${savedAnswer.length} items`);
          } else if (savedAnswer && !Array.isArray(savedAnswer)) {
            console.error(`⚠️ WRONG TYPE: Jumbled Q${currentQuestion.questionNo} has non-array answer:`, typeof savedAnswer);
            setJumbledAnswers(jumbledItems);
            jumbledAnswersRef.current = jumbledItems;
          } else {
            setJumbledAnswers(jumbledItems);
            jumbledAnswersRef.current = jumbledItems;
            // console.log(`📝 Jumbled Q${currentQuestion.questionNo}: Initialized with ${jumbledItems.length} items`);
          }
          break;
        }
      }
  }, [currentQuestion?.id, answersInitialized]); // 🔥 Only re-run when question ID changes or answers first load

  // DEBUG: Track when codeInput actually changes
  useEffect(() => {
    // console.log(`🔄 codeInput state changed for Q${currentQuestion?.questionNo}, length: ${codeInput.length}, preview: ${codeInput.slice(0, 50)}...`);
  }, [codeInput]);

  // ✅ Track selected language per question so navigating back restores the correct dropdown
  useEffect(() => {
    if (currentQuestion?.id && (currentQuestion.type === QUESTION_TYPES.CODE || currentQuestion.type === QUESTION_TYPES.SQL)) {
      selectedLanguagePerQuestion.current[currentQuestion.id] = selectedLanguage;
    }
  }, [selectedLanguage, currentQuestion?.id]);

  /**
   * Smart timestamp parser — handles ALL possible violation timestamp formats
   * Returns a valid Date object or null if unparseable
   */
  const parseViolationTimestamp = (ts: any): Date | null => {
    try {
      // 1. null / undefined / empty
      if (!ts) return null;

      // 2. Already a Date object
      if (ts instanceof Date) {
        return isNaN(ts.getTime()) ? null : ts;
      }

      // 3. Number (Unix ms or seconds)
      if (typeof ts === 'number') {
        const ms = ts < 1e10 ? ts * 1000 : ts;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }

      // 4. String formats
      if (typeof ts === 'string') {
        // 4a. IST format: "2026-02-22 00:03:41 IST"
        if (ts.includes(' IST')) {
          const d = new Date(ts.replace(' IST', '+05:30').replace(' ', 'T'));
          if (!isNaN(d.getTime())) return d;
        }
        // 4b. ISO format: "2026-02-22T00:03:41.000Z" or "2026-02-22T00:03:41+05:30"
        if (ts.includes('T') || ts.includes('Z')) {
          const d = new Date(ts);
          if (!isNaN(d.getTime())) return d;
        }
        // 4c. Space-separated without timezone: "2026-02-22 00:03:41"
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts)) {
          const d = new Date(ts.replace(' ', 'T'));
          if (!isNaN(d.getTime())) return d;
        }
        // 4d. Date-only: "2026-02-22"
        if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) {
          const d = new Date(ts);
          if (!isNaN(d.getTime())) return d;
        }
        // 4e. Any other string JS can parse
        const d = new Date(ts);
        if (!isNaN(d.getTime())) return d;
      }

      // 5. Firestore Timestamp object: { seconds: ..., nanoseconds: ... }
      if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
        const d = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
        if (!isNaN(d.getTime())) return d;
      }

      // 6. Firestore Timestamp with toDate()
      if (typeof ts === 'object' && ts !== null && typeof ts.toDate === 'function') {
        const d = ts.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      }

      // 7. Serialized Firestore Timestamp { _seconds: ... }
      if (typeof ts === 'object' && ts !== null && '_seconds' in ts) {
        const d = new Date(ts._seconds * 1000);
        if (!isNaN(d.getTime())) return d;
      }

      return null;
    } catch {
      return null;
    }
  };

  /** Format a violation timestamp for display — returns static string, never changes */
  const formatViolationTime = (ts: any): string => {
    const d = parseViolationTimestamp(ts);
    if (!d) return '—';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== MONITORING HELPER FUNCTIONS ====================

  /**
   * Get current IP address
   */
  const getCurrentIpAddress = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get IP address:', error);
      return 'unknown';
    }
  };

  /**
   * Log a violation with debouncing to avoid duplicate entries
   */
  /**
   * Log a violation for UI tracking only
   * 
   * ✅ NOTE: Evidence upload and Firebase sync is handled by ExamMonitor via violationQueueService
   * This function only updates local UI state (violations array, localStorage)
   * 
   * Supports overloaded signatures:
   * 1. logViolation(type, details, debounceMs) - Legacy/Internal calls
   * 2. logViolation(type, details, proofBlob, debounceMs) - ExamMonitor calls (proofBlob ignored)
   */
  const logViolation = useCallback(async (
    type: ViolationType,
    details?: string,
    arg3?: Blob | number, // Can be proof blob OR debounce time (blob ignored - handled by ExamMonitor)
    arg4?: number         // Optional debounce time if blob is present
  ) => {
    // console.log(`📝 logViolation called: ${type} (UI update only)`);
    
    // 1. Parse debounce time from overloaded arguments
    let debounceMs = 1000;

    if (typeof arg3 === 'number') {
      debounceMs = arg3; // Legacy call: logViolation('WINDOW_BLUR', 'msg', 5000)
    } else if (arg3 instanceof Blob && typeof arg4 === 'number') {
      debounceMs = arg4; // New call: logViolation('NO_FACE', 'msg', blob, 1000)
    }
    // Note: proofBlob (arg3 as Blob) is ignored - ExamMonitor handles upload via violationQueueService

    if (!isMonitoringActive) {
      // console.log(`⏭️ Skipping ${type} - monitoring not active`);
      return;
    }
    
    // ✅ Skip violations during exam submission to prevent false fullscreen exit violations
    if (isSubmittingFromOverlay) {
      // console.log(`⏭️ Skipping ${type} - exam submission in progress`);
      return;
    }
    
    // Grace period check - 60 seconds for fullscreen/blur violations at exam start, 2s for others
    const timeSinceMonitoringStart = Date.now() - monitoringStartTime.current;
    const STARTUP_SENSITIVE_VIOLATIONS = ['FULLSCREEN_EXIT', 'WINDOW_BLUR', 'WINDOW_MINIMIZE', 'TAB_SWITCH'];
    const gracePeriodMs = STARTUP_SENSITIVE_VIOLATIONS.includes(type) ? 60000 : 2000; // 60s for startup-sensitive, 2s for others
    
    if (timeSinceMonitoringStart < gracePeriodMs) { 
      // console.log(`⏭️ Skipping ${type} violation - within ${gracePeriodMs/1000}s grace period (${Math.round(timeSinceMonitoringStart/1000)}s elapsed)`);
      return;
    }

    // Violation limit check (Stop at MAX_VIOLATIONS to prevent database spam)
    const totalViolations = Object.values(questionViolations).reduce((sum, arr) => sum + arr.length, 0);
    if (totalViolations >= MAX_VIOLATIONS) {
      if (!violationLimitReached.current) {
        // console.warn(`🚫 VIOLATION LIMIT REACHED: ${MAX_VIOLATIONS} violations logged. No more violations will be recorded.`);
        violationLimitReached.current = true;
      }
      return;
    }

    // ✅ IMPROVED: Cooldown check with grouped violations to prevent duplicates
    // WINDOW_BLUR, TAB_SWITCH, WINDOW_MINIMIZE are related - if one fires, block others
    const VIOLATION_COOLDOWN_MS = 30000; // 30 seconds
    const FOCUS_RELATED_VIOLATIONS: ViolationType[] = ['WINDOW_BLUR', 'TAB_SWITCH', 'WINDOW_MINIMIZE'];
    
    // Check cooldown for this type AND related types
    const typesToCheck = FOCUS_RELATED_VIOLATIONS.includes(type) 
      ? FOCUS_RELATED_VIOLATIONS 
      : [type];
    
    for (const checkType of typesToCheck) {
      const lastLoggedTime = lastViolationLoggedTime.current.get(checkType);
      if (lastLoggedTime && (Date.now() - lastLoggedTime) < VIOLATION_COOLDOWN_MS) {
        // console.log(`⏭️ Skipping ${type} - related violation ${checkType} within cooldown (${Math.round((Date.now() - lastLoggedTime) / 1000)}s < 30s)`);
        return;
      }
    }
    
    // ✅ FIX: Set cooldown IMMEDIATELY to prevent race conditions from async state updates
    lastViolationLoggedTime.current.set(type, Date.now());
    
    // console.log(`✅ ${type} passed checks - scheduling with ${debounceMs}ms debounce`);

    // ✅ Determine if this is from ExamMonitor vs browser events
    // ExamMonitor violations: NO_FACE, HEAD_TURNED, MULTIPLE_FACES, FACE_MISMATCH, SUSPICIOUS_MOVEMENT, HUMAN_VOICE_DETECTED
    // Browser violations: WINDOW_BLUR, TAB_SWITCH, FULLSCREEN_EXIT, DEVTOOLS_OPEN, etc.
    const EXAM_MONITOR_VIOLATION_TYPES = ['NO_FACE', 'HEAD_TURNED', 'MULTIPLE_FACES', 'FACE_MISMATCH', 'SUSPICIOUS_MOVEMENT', 'HUMAN_VOICE_DETECTED'];
    const isFromExamMonitor = EXAM_MONITOR_VIOLATION_TYPES.includes(type);

    // Debounce logic (Clear existing timeout for this specific violation type)
    const existingTimeout = violationTimeouts.current.get(type);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      // 🔥 FIX: Get current question info from REF (always fresh)
      const currentQuestionId = currentQuestionRef.current.id;
      const currentQuestionNo = currentQuestionRef.current.no;
      
      // console.log(`🚨 Processing violation: ${type} on Q${currentQuestionNo}`);
      
      // Note: Cooldown timestamp already set BEFORE debounce to prevent race conditions
      
      // 3. Create Violation Object (Using Constants)
      const violation: Violation = {
        type,
        timestamp: new Date().toISOString(),
        details: details || VIOLATION_DESCRIPTIONS[type],
        severity: VIOLATION_SEVERITY_MAP[type],
        questionNo: currentQuestionNo,
        questionId: currentQuestionId,
      };

      // 4. Update State & Local Storage (for UI display)
      setViolations(prev => [...prev, violation]);
      
      if (currentQuestionId && currentQuestionId !== 'unknown') {
        setQuestionViolations(prev => {
          const updated = {
            ...prev,
            [currentQuestionId]: [...(prev[currentQuestionId] || []), violation]
          };
          
          try {
            localStorage.setItem(VIOLATIONS_TRACKING_KEY, JSON.stringify(updated));
            // const _newTotal = Object.values(updated).reduce((sum, arr) => sum + arr.length, 0);
            // console.log(`🚨 Q${currentQuestionNo}: Violation tracked - ${type} [Total: ${newTotal}/${MAX_VIOLATIONS}]`);
          } catch (error) {
            console.error('❌ Error saving violations to storage:', error);
          }
          
          return updated;
        });
      }

      // ✅ 5. Save to Firebase
      // Browser violations (WINDOW_BLUR, TAB_SWITCH, FULLSCREEN_EXIT, etc.) need to be saved here
      // ExamMonitor violations are already saved via violationQueueService syncCallback
      // console.log(`🔍 Firebase save check: isFromExamMonitor=${isFromExamMonitor}, attemptId=${attempt?.attemptId}`);
      
      if (!isFromExamMonitor && attempt?.attemptId) {
        try {
          // console.log(`📤 Saving browser violation to Firebase: ${type}...`);
          await addViolationToAttempt(violation);
          // console.log(`✅ Browser violation saved to Firebase: ${type}`);
        } catch (error) {
          console.error(`❌ Failed to save browser violation to Firebase: ${type}`, error);
        }
      } else {
        // console.log(`⏭️ Skipping Firebase save: isFromExamMonitor=${isFromExamMonitor}, hasAttemptId=${!!attempt?.attemptId}`);
      }

      violationTimeouts.current.delete(type);
    }, debounceMs);

    violationTimeouts.current.set(type, timeout);
  }, [isMonitoringActive, isSubmittingFromOverlay, questions, currentQuestionIndex, attempt, questionViolations, examId, userId, addViolationToAttempt]);
  
  // ✅ REMOVED: Old batch sync effects - now handled by violationQueueService
  // The service handles:
  // - Automatic sync every 10 seconds when online
  // - Offline queuing with localStorage persistence
  // - Retry logic for failed syncs
  // - Sync on network reconnection

  /**
   * Setup all monitoring event listeners
   */
  const setupMonitoring = useCallback(() => {
    if (!isMonitoringActive) return;

    // console.log('🔒 Exam monitoring activated');

    // ✅ Set secure browser token so Python app knows student is in active exam
    const _isStudentInExam = !!(userStudentRoll && userStudentRoll.trim() !== '' && userStudentRoll !== 'N/A');
    if (_isStudentInExam) {
      (window as any).__EXAMINERS_STUDENT_IN_EXAM = true;
      // console.log('🔐 Student-in-exam token SET for secure browser');
    } else {
      (window as any).__EXAMINERS_STUDENT_IN_EXAM = false;
      // console.log('🔐 Non-student user — token remains false');
    }

    // ✅ IMMEDIATE CHECK: DevTools already open?
    const checkDevToolsImmediate = () => {
      // Size-based (docked DevTools)
      const threshold = 100;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      return widthThreshold || heightThreshold;
    };
    
    // ✅ IMMEDIATE CHECK: Not in fullscreen?
    const checkFullscreenImmediate = () => {
      return !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
    };
    
    // ✅ Run immediate checks after a short delay (let monitoring initialize)
    setTimeout(() => {
      // Check DevTools
      if (checkDevToolsImmediate()) {
        // console.log('🚨 IMMEDIATE: DevTools already open on exam start!');
        logViolation('DEVTOOLS_OPEN', 'DevTools was already open when exam started', 0);
        setShowDevToolsOverlay(true);
      }
      
      // Check Fullscreen - but don't log if we're still showing the prompt
      // The prompt gives user a chance to enter fullscreen
      if (!checkFullscreenImmediate()) {
        // console.log('⚠️ Not in fullscreen on exam start - prompt should be showing');
        // Don't log violation immediately - give user time via the prompt
        // Violation will be logged after 1 minute via checkFullscreenStatus
      }
    }, 3000); // 3 second delay to let user enter fullscreen

    let lastClipboardCheck = Date.now();

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Skip during grace period (first 60 seconds)
        const timeSinceMonitoringStart = Date.now() - monitoringStartTime.current;
        if (timeSinceMonitoringStart < 60000) {
          // console.log('⏭️ Skipping visibility change - within 60s grace period');
          return;
        }
        
        // console.log('👁️ Document hidden - checking for minimize');
        
        // Check multiple signals for minimize
        const isLikelyMinimized = 
          window.innerWidth === 0 || 
          window.innerHeight === 0 ||
          (window.outerWidth === 0 && window.outerHeight === 0) ||
          window.screenLeft < -10000 ||
          window.screenTop < -10000;
        
        if (isLikelyMinimized) {
          // console.log('🚨 WINDOW_MINIMIZE detected - calling logViolation...');
          logViolation(VIOLATION_TYPES.WINDOW_MINIMIZE, VIOLATION_DESCRIPTIONS[VIOLATION_TYPES.WINDOW_MINIMIZE], 5000);
        } else {
          // console.log('🚨 TAB_SWITCH detected - calling logViolation...');
          logViolation(VIOLATION_TYPES.TAB_SWITCH, VIOLATION_DESCRIPTIONS[VIOLATION_TYPES.TAB_SWITCH], 5000);
        }
      } else {
        // When page becomes visible again, check clipboard for potential screenshot
        if (Date.now() - lastClipboardCheck > 1000) {
          lastClipboardCheck = Date.now();
          
          try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
              if (item.types.some(type => type.startsWith('image/'))) {
                logViolation('SCREENSHOT_ATTEMPT', 'Screenshot detected in clipboard (Mac/Win/Linux)', 3000);
                break;
              }
            }
          } catch (error) {
            // Clipboard access denied or not available - silent fail
          }
        }
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('COPY_ATTEMPT', undefined, 3000); // 3 second grace period
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('CUT_ATTEMPT', undefined, 3000); // 3 second grace period
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('PASTE_ATTEMPT', undefined, 3000); // 3 second grace period
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('RIGHT_CLICK', undefined, 2000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 🔥 BLOCK ESCAPE KEY — prevent students from exiting fullscreen
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // console.log('🚫 Escape key blocked — fullscreen exit prevented');
        return;
      }

      // ✅ Allow Ctrl+Z (undo) and Ctrl+Y (redo) to work normally
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        // Don't prevent default - let undo/redo work in inputs and Monaco editor
        return;
      }

      if (e.key === 'F12') {
        e.preventDefault();
        logViolation('SHORTCUT_F12');
        setShowDevToolsOverlay(true);
        // Auto-hide after 5 seconds since they can't actually open DevTools
        setTimeout(() => setShowDevToolsOverlay(false), 5000);
        return;
      }

      // Screenshot Detection - All Platforms
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Detect specific screenshot combinations
        if (e.altKey) {
          logViolation('SCREENSHOT_ATTEMPT', 'Alt+PrintScreen (Active window screenshot)');
        } else if (e.ctrlKey) {
          logViolation('SCREENSHOT_ATTEMPT', 'Ctrl+PrintScreen (Screenshot to clipboard)');
        } else if (e.shiftKey) {
          logViolation('SCREENSHOT_ATTEMPT', 'Shift+PrintScreen (Area selection screenshot)');
        } else {
          logViolation('PRINT_SCREEN');
        }
        return;
      }

      // Mac Screenshot Shortcuts (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (['3', '4', '5'].includes(e.key)) {
          e.preventDefault();
          const descriptions = {
            '3': 'Cmd+Shift+3 (Full screen screenshot - Mac)',
            '4': 'Cmd+Shift+4 (Selection screenshot - Mac)',
            '5': 'Cmd+Shift+5 (Screenshot utility - Mac)'
          };
          logViolation('SCREENSHOT_ATTEMPT', descriptions[e.key as '3' | '4' | '5']);
          return;
        }
        
        // Windows Snipping Tool (Win+Shift+S) - Note: Windows key detection is limited
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          logViolation('SCREENSHOT_ATTEMPT', 'Windows Snipping Tool shortcut detected');
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            logViolation('SHORTCUT_CTRLC');
            break;
          case 'v':
            e.preventDefault();
            logViolation('SHORTCUT_CTRLV');
            break;
          case 'x':
            e.preventDefault();
            logViolation('SHORTCUT_CTRLX');
            break;
          case 'a':
            const target = e.target as HTMLElement;
            if (!target.closest('.monaco-editor') && target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
              e.preventDefault();
              logViolation('SHORTCUT_CTRLA');
            }
            break;
          case 'p':
            e.preventDefault();
            logViolation('SHORTCUT_CTRLP');
            break;
          case 's':
            // Check if it's a screenshot attempt (already handled above)
            if (!e.shiftKey) {
              e.preventDefault();
              logViolation('SHORTCUT_CTRLS');
            }
            break;
        }

        if (e.shiftKey) {
          if (['c', 'i', 'j'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            logViolation('SHORTCUT_DEVTOOLS');
            setShowDevToolsOverlay(true);
            setTimeout(() => setShowDevToolsOverlay(false), 5000);
          }
        }
      }

      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        logViolation('SHORTCUT_ALTTAB');
      }
      
      // ✅ Mac: Cmd+Tab (App switcher)
      if (e.metaKey && e.key === 'Tab') {
        e.preventDefault();
        logViolation(VIOLATION_TYPES.SHORTCUT_CMDTAB, VIOLATION_DESCRIPTIONS[VIOLATION_TYPES.SHORTCUT_CMDTAB]);
      }
    };

    // Store initial dimensions when monitoring starts
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;
    let screenResizeViolationLogged = false; // Only log once per resize event
    
    const handleResize = () => {

      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Compare against initial dimensions
      const widthDiff = Math.abs(width - initialWidth);
      const heightDiff = Math.abs(height - initialHeight);
      
      // console.log('📐 Window resized:', {
        // initial: { width: initialWidth, height: initialHeight },
        // current: { width, height },
        // diff: { widthDiff, heightDiff }
      // });
      
      // Detect minimize by checking multiple signals
      const isMinimized = 
        (width === 0 && height === 0) ||
        (window.outerWidth === 0 && window.outerHeight === 0) ||
        (window.screenLeft < -10000 || window.screenTop < -10000);
      
      if (isMinimized) {
        // console.log('🚨 WINDOW MINIMIZED (via resize) - Logging violation!');
        logViolation(VIOLATION_TYPES.WINDOW_MINIMIZE, VIOLATION_DESCRIPTIONS[VIOLATION_TYPES.WINDOW_MINIMIZE]);
        return;
      }
      
      // Only trigger SCREEN_RESIZE if change is significant (> 150px)
      if ((widthDiff > 150 || heightDiff > 150) && !screenResizeViolationLogged) {
        const timeSinceMonitoringStart = Date.now() - monitoringStartTime.current;
        // Check if grace period (1st minute) has passed
        if (timeSinceMonitoringStart > 60000) {
          // console.log('🚨 SCREEN_RESIZE detected - Logging violation!');
          logViolation(VIOLATION_TYPES.SCREEN_RESIZE, `Window resized to ${width}x${height}`, 5000);
          screenResizeViolationLogged = true;
        }
      }
      
      // Reset flag if user returns to initial size
      if (widthDiff <= 50 && heightDiff <= 50) {
        screenResizeViolationLogged = false;
      }
    };

    const handleOffline = () => {
      // Network disconnect is NOT counted as a violation - it's a connectivity issue, not cheating
      // console.log('⚠️ Network disconnected - not counting as violation');
    };

    const handleOnline = async () => {
      // console.log('✅ Network reconnected');
    };

    let devToolsWasDetected = false;
    
    const detectDevTools = () => {
      let detected = false;
      
      // Size-based detection (catches docked DevTools — left, right, bottom)
      const threshold = 100;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      if (widthThreshold || heightThreshold) {
        detected = true;
      }
      
      // 🔥 ALWAYS clear console and show warning — if DevTools is open they see ONLY this
      // If DevTools is closed, this is invisible and costs nothing
      try {
        console.clear();
        console.log(
          '%c ⛔ EXAM IN PROGRESS ',
          'background: #DC2626; color: white; font-size: 60px; font-weight: 900; padding: 20px 40px; border-radius: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);'
        );
        console.log(
          '%c 🚫 DEVELOPER TOOLS ARE STRICTLY PROHIBITED DURING EXAMS ',
          'background: #450a0a; color: #fca5a5; font-size: 24px; font-weight: bold; padding: 15px 30px; border: 3px solid #DC2626; border-radius: 8px;'
        );
        console.log(
          '%c ⚠️  This violation has been RECORDED and REPORTED to your examiner. \n ⚠️  Close Developer Tools IMMEDIATELY to continue your exam. \n ⚠️  Repeated violations may result in exam cancellation. ',
          'color: #DC2626; font-size: 16px; font-weight: bold; background: #FEE2E2; padding: 12px 20px; border-left: 6px solid #DC2626; border-radius: 4px; line-height: 2;'
        );
        console.log(
          '%c' + '█'.repeat(80),
          'color: #DC2626; font-size: 8px;'
        );
      } catch (_) { /* ignore */ }
      
      if (detected) {
        devToolsWasDetected = true;
        setShowDevToolsOverlay(true);
        logViolation(VIOLATION_TYPES.DEVTOOLS_OPEN, VIOLATION_DESCRIPTIONS[VIOLATION_TYPES.DEVTOOLS_OPEN], 5000);
      } else if (devToolsWasDetected) {
        devToolsWasDetected = false;
        setShowDevToolsOverlay(false);
      }
    };
    
    const checkFullscreenStatus = () => {
      // Skip during grace period (first 60 seconds)
      const timeSinceMonitoringStart = Date.now() - monitoringStartTime.current;
      if (timeSinceMonitoringStart < 60000) {
        return;
      }
      
      // Check fullscreen API
      const apiFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      // Visual fallback: Check if window fills the screen (20px tolerance for taskbar/dock)
      const isVisuallyFullscreen = 
        Math.abs(window.screen.width - window.innerWidth) < 20 &&
        Math.abs(window.screen.height - window.innerHeight) < 20;
      
      const isFullscreen = apiFullscreen || isVisuallyFullscreen;
      
      // Not in fullscreen? Log violation (cooldown handled by logViolation)
      if (!isFullscreen) {
        logViolation(VIOLATION_TYPES.FULLSCREEN_EXIT, VIOLATION_DESCRIPTIONS[VIOLATION_TYPES.FULLSCREEN_EXIT], 5000);
      }
    };

    // ✅ Clean up stale tabs before registering - prevents false MULTIPLE_TABS violations
    localStorage.removeItem('activeExamTabs');
    
    localStorage.setItem('activeExamTabs', 
      (localStorage.getItem('activeExamTabs') || '') + ',' + tabId.current
    );

    const checkMultipleTabs = () => {
      const tabs = (localStorage.getItem('activeExamTabs') || '').split(',').filter(Boolean);
      if (tabs.length > 1) {
        logViolation(VIOLATION_TYPES.MULTIPLE_TABS, `${tabs.length} tabs detected`, 5000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    
    // Add all browser-specific fullscreen change events
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      if (!isCurrentlyFullscreen) {
        // ✅ Show overlay immediately on any fullscreen exit during monitoring
        // console.log('🚨 Student exited fullscreen — showing re-entry overlay');
        setShowFullscreenOverlay(true);
        logViolation(VIOLATION_TYPES.FULLSCREEN_EXIT, 'Student exited fullscreen mode');
      } else {
        // ✅ Track that fullscreen was entered (for any entry method)
        fullscreenEnteredRef.current = true;
        setShowFullscreenOverlay(false);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    // console.log('✅ All event listeners attached for exam monitoring');

    const devToolsInterval = setInterval(() => {
      detectDevTools();
      checkFullscreenStatus(); // Check fullscreen status every 12 seconds
    }, 12000);
    const multipleTabsInterval = setInterval(checkMultipleTabs, 3000);

    return () => {
      // console.log('🔓 Exam monitoring deactivated');

      // ✅ Clear secure browser token
      (window as any).__EXAMINERS_STUDENT_IN_EXAM = false;
      // console.log('🔐 Student-in-exam token CLEARED');
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);

      clearInterval(devToolsInterval);
      clearInterval(multipleTabsInterval);

      violationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      violationTimeouts.current.clear();

      const tabs = (localStorage.getItem('activeExamTabs') || '')
        .split(',')
        .filter(t => t !== tabId.current);
      localStorage.setItem('activeExamTabs', tabs.join(','));
    };
  }, [isMonitoringActive, logViolation]);


  const handlePrevious = async () => {
    // Phase boundary: during likert phase, don't go below index 0; during exam phase, don't go into likert questions
    const minIndex = examPhase === 'exam' ? likertOnlyQuestions.length : 0;
    if (currentQuestionIndex > minIndex) {
      await saveCurrentAnswer(true);
      const newIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(newIndex);
      // Clear terminal output
      setCodeOutput('');
      setExecutionTime('0ms');
      setExecutionMemory('0KB');
      setIsRunning(false);
      setActiveCodeTab('output');
      // 🔥 UPDATE REF: Keep ref in sync
      currentQuestionRef.current = {
        index: newIndex,
        id: questions[newIndex]?.id || 'unknown',
        no: questions[newIndex]?.questionNo || newIndex + 1
      };
    }
  };

  const handleNext = async () => {
    // Phase boundary: during likert phase, don't go past last likert question
    const maxIndex = examPhase === 'likert' && likertOnlyQuestions.length > 0
      ? likertOnlyQuestions.length - 1
      : questions.length - 1;
    if (currentQuestionIndex < maxIndex) {
      await saveCurrentAnswer(true);
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      // Clear terminal output
      setCodeOutput('');
      setExecutionTime('0ms');
      setExecutionMemory('0KB');
      setIsRunning(false);
      setActiveCodeTab('output');
      // 🔥 UPDATE REF: Keep ref in sync
      currentQuestionRef.current = {
        index: newIndex,
        id: questions[newIndex]?.id || 'unknown',
        no: questions[newIndex]?.questionNo || newIndex + 1
      };
    }
  };

  const handleQuestionClick = async (index: number) => {
    // Phase boundary: don't allow crossing into the other phase's questions
    if (examPhase === 'likert' && index >= likertOnlyQuestions.length) return;
    if (examPhase === 'exam' && index < likertOnlyQuestions.length) return;
    await saveCurrentAnswer(true); // ✅ Save before navigating
    setCurrentQuestionIndex(index);
    // Clear terminal output
    setCodeOutput('');
    setExecutionTime('0ms');
    setExecutionMemory('0KB');
    setIsRunning(false);
    setActiveCodeTab('output');
    // 🔥 UPDATE REF: Keep ref in sync
    currentQuestionRef.current = {
      index: index,
      id: questions[index]?.id || 'unknown',
      no: questions[index]?.questionNo || index + 1
    };
  };

  const toggleBookmark = () => {
    setBookmarkedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestion.id)) {
        // console.log('🔖 Removing bookmark from question:', currentQuestion.questionNo);
        newSet.delete(currentQuestion.id);
      } else {
        // console.log('🔖 Adding bookmark to question:', currentQuestion.questionNo);
        newSet.add(currentQuestion.id);
      }
      // console.log('🔖 Total bookmarked questions:', newSet.size);
      return newSet;
    });
  };

/**
 * Calculate student's individual end time based on completion policy
 * @param examDate Exam date (YYYY-MM-DD)
 * @param examTime Exam start time (HH:MM)
 * @param duration Exam duration in minutes
 * @param completionPolicy 'strict' or 'flexible'
 * @param studentStartTime When student actually started (Date object)
 * @returns End time for this specific student (Date object)
 */
const calculateStudentEndTime = (
  examDate: string,
  examTime: string,
  duration: number,
  completionPolicy: string,
  studentStartTime: Date,
  likertDurationMins: number = 0
): Date => {
  // Parse exam scheduled start time
  const [hours, minutes] = examTime.split(':').map(Number);
  const examStartDate = new Date(examDate);
  examStartDate.setHours(hours, minutes, 0, 0);
  
  // Calculate scheduled end time — include likert duration since exam starts AFTER likert
  const scheduledEndTime = new Date(examStartDate.getTime() + (likertDurationMins + duration) * 60 * 1000);
  
  // STRICT MODE: Everyone ends at scheduled time (likert + exam duration from scheduled start)
  if (completionPolicy === 'strict') {
    return scheduledEndTime;
  }
  
  // FLEXIBLE MODE: Calculate individual end time
  const studentStartTimestamp = studentStartTime.getTime();
  const examStartTimestamp = examStartDate.getTime();
  
  // Check if student started late
  const lateBy = Math.max(0, (studentStartTimestamp - examStartTimestamp) / 1000 / 60); // minutes
  
  if (lateBy === 0) {
    // Student started on time → no grace period
    return scheduledEndTime;
  }
  
  // Student started late → add grace period (max 30 minutes)
  const gracePeriod = Math.min(lateBy, 30); // Cap at 30 minutes
  const studentEndTime = new Date(scheduledEndTime.getTime() + gracePeriod * 60 * 1000);
  
  // console.log(`📅 Flexible Completion Calculation:
    // - Scheduled Start: ${examStartDate.toLocaleTimeString()}
    // - Student Started: ${studentStartTime.toLocaleTimeString()}
    // - Late By: ${lateBy.toFixed(1)} minutes
    // - Grace Period: ${gracePeriod.toFixed(1)} minutes
    // - Student End Time: ${studentEndTime.toLocaleTimeString()}`);
  
  return studentEndTime;
};


  const phaseQuestions = examPhase === 'likert'
    ? questions.filter(q => (q as any).isFromLikert)
    : questions.filter(q => !(q as any).isFromLikert);

  // True when exam has ONLY likert questions and no actual exam questions
  const isLikertOnlyExam = likertOnlyQuestions.length > 0 && 
    questions.filter(q => !(q as any).isFromLikert).length === 0;

  const stats = {
    notViewed: phaseQuestions.filter(q => !viewedQuestions.has(q.id)).length,
    answered: phaseQuestions.filter(q => answers[q.id]).length,
    bookmarked: phaseQuestions.filter(q => bookmarkedQuestions.has(q.id)).length,
    skipped: phaseQuestions.filter(q => 
      viewedQuestions.has(q.id) && 
      !answers[q.id] && 
      !bookmarkedQuestions.has(q.id) &&
      q.id !== questions[currentQuestionIndex]?.id
    ).length
  };

  const getStatusColor = (questionId: string, index: number) => {
    const isCurrent = index === currentQuestionIndex;
    const isAnswered = !!answers[questionId];
    const isBookmarked = bookmarkedQuestions.has(questionId);
    const isViewed = viewedQuestions.has(questionId);
    
    // Current question shows blue gradient with purple border if bookmarked
    if (isCurrent) {
      return isBookmarked 
        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg border-[4px] border-purple-500'
        : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg';
    }
    
    // Other questions show their status
    if (isAnswered && isBookmarked) return 'bg-green-500 text-white border-[4px] border-purple-500 shadow-md'; // Answered + Bookmarked
    if (isAnswered) return 'bg-green-500 text-white'; // Just answered
    if (isBookmarked) return 'bg-purple-500 text-white border-[4px] border-purple-300'; // Just bookmarked
    if (isViewed) return 'bg-orange-400 text-white'; // Skipped
    return 'bg-gray-300 text-gray-700'; // Not viewed
  };

  // Handle Fill in the Blank answer change
  const handleBlankChange = (index: number, value: string) => {
    const newAnswers = [...fillBlanksAnswers];
    newAnswers[index] = value;
    setFillBlanksAnswers(newAnswers);
    fillBlanksAnswersRef.current = newAnswers;
    if (currentQuestion?.id) dirtyQuestionsRef.current.add(currentQuestion.id);
  };

  // Handle Jumbled drag and drop
  const moveJumbledItem = (dragIndex: number, hoverIndex: number) => {
    const newItems = [...jumbledAnswers];
    const draggedItem = newItems[dragIndex];
    
    // Remove the dragged item
    newItems.splice(dragIndex, 1);
    // Insert it at the new position
    newItems.splice(hoverIndex, 0, draggedItem);
    
    setJumbledAnswers(newItems);
    jumbledAnswersRef.current = newItems;
    if (currentQuestion?.id) dirtyQuestionsRef.current.add(currentQuestion.id);
  };

  // ==================== PGlite SQL Functions ====================
  
  /** Initialize PGlite and create tables from question.tableSchema */
  const initPGliteForQuestion = async (question: Question): Promise<boolean> => {
    if (pgliteRef.current) return true; // Already initialized
    
    setCodeOutput('🐘 Initializing PostgreSQL database...\n⏳ Please wait (first time may take a few seconds)...');
    
    try {
      const { PGlite } = await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js' as any);
      pgliteRef.current = new PGlite();
      await pgliteRef.current.waitReady;
      
      const tableSchema = question.tableSchema;
      if (tableSchema) {
        const isMultiTable = Array.isArray(tableSchema);
        const schemas = isMultiTable ? tableSchema : [tableSchema];
        
        for (const schema of schemas) {
          let columns = schema.columns;
          if (columns && typeof columns === 'object' && !Array.isArray(columns)) {
            columns = Object.keys(columns).sort((a: string, b: string) => Number(a) - Number(b)).map((key: string) => columns[key]);
          }
          if (!columns || columns.length === 0) continue;
          
          const tableName = schema.tableName || schema.table_name || 'Table';
          let createSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (`;
          createSQL += columns.map((col: any) => {
            let type = (col.type || 'TEXT').toUpperCase();
            if (type.includes('ENUM')) type = 'TEXT';
            if (type.includes('INT')) type = 'INTEGER';
            if (type.includes('VARCHAR')) type = 'TEXT';
            if (type.includes('DATE')) type = 'TEXT';
            return `${col.name} ${type}`;
          }).join(', ');
          createSQL += ')';
          
          await pgliteRef.current.query(createSQL);
          // console.log(`✅ Table ${tableName} created`);
        }
        
        // Insert data from first test case
        if (question.testCases && question.testCases.length > 0) {
          const firstTC = question.testCases[0];
          if (firstTC?.sqlInput) {
            await insertSqlTestData(firstTC.sqlInput, schemas);
          }
        }
      }
      
      setCodeOutput('🐘 PostgreSQL Ready\n✓ Database initialized. Click "Run" to execute your SQL query.');
      return true;
    } catch (initError: any) {
      console.error('PGlite initialization error:', initError);
      setCodeOutput(`❌ Failed to initialize PostgreSQL database.\n\nError: ${initError.message}\n\n💡 Please check your internet connection and try again.`);
      return false;
    }
  };
  
  /** Insert test data into PGlite tables - handles Firebase format:
   *  table_data: { "TableName": [["col1","col2"], ["val1","val2"], ...] }
   *  First row is headers, rest are data rows.
   *  Also supports CodePractice format with input.tables[].headers/rows */
  const insertSqlTestData = async (input: any, schemas: any[]) => {
    if (!pgliteRef.current || !input) return;
    
    // Firebase exam format: input = { "TableName": [["headers..."],["row1..."],...] }
    const tableNames = Object.keys(input);
    if (tableNames.length > 0 && Array.isArray(input[tableNames[0]])) {
      for (const tableName of tableNames) {
        const tableRows = input[tableName];
        if (!Array.isArray(tableRows) || tableRows.length < 2) continue;
        const headers = tableRows[0]; // First row is headers
        const dataRows = tableRows.slice(1); // Rest are data
        
        for (const row of dataRows) {
          const vals = headers.map((_h: string, i: number) => {
            const val = row[i];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            return val;
          });
          const insertSQL = `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${vals.join(', ')})`;
          await pgliteRef.current.query(insertSQL);
        }
      }
      return;
    }

    // CodePractice format: input.tables array
    if (input.tables && Array.isArray(input.tables)) {
      for (const tableData of input.tables) {
        const tableName = tableData.name;
        const headers = tableData.headers || [];
        const rows = normalizeRows(tableData.rows);
        
        for (const row of rows) {
          const vals = headers.map((_header: string, i: number) => {
            const val = row['i' + i];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            return val;
          });
          const insertSQL = `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${vals.join(', ')})`;
          await pgliteRef.current.query(insertSQL);
        }
      }
    }
    // CodePractice single-table format
    else if (input.headers && input.rows) {
      const tableName = schemas[0]?.tableName || schemas[0]?.table_name || 'Table';
      const headers = input.headers;
      const rows = normalizeRows(input.rows);
      
      for (const row of rows) {
        const vals = headers.map((_header: string, i: number) => {
          const val = row['i' + i];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          return val;
        });
        const insertSQL = `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${vals.join(', ')})`;
        await pgliteRef.current.query(insertSQL);
      }
    }
  };
  
  /** Compare SQL results against expected output
   *  Handles Firebase format: expected_output.columns + expected_output.rows (string[][])
   *  And CodePractice format: headers + rows (object with i0, i1 keys) */
  const compareSqlResults = (actualHeaders: string[], actualRows: any[], expectedColumns: string[], expectedRowsRaw: any[]): boolean => {
    const normalizedActualHeaders = actualHeaders.map(h => h.toLowerCase());
    const normalizedExpectedHeaders = expectedColumns.map(h => h.toLowerCase());
    
    if (normalizedActualHeaders.length !== normalizedExpectedHeaders.length) return false;
    
    // Normalize expected rows - could be string[][] (Firebase) or object[] (CodePractice)
    const expectedRows = Array.isArray(expectedRowsRaw) ? expectedRowsRaw : normalizeRows(expectedRowsRaw);
    if (actualRows.length !== expectedRows.length) return false;
    
    for (let i = 0; i < expectedRows.length; i++) {
      const expectedRow = expectedRows[i];
      const actualRow = actualRows[i];
      
      for (let j = 0; j < expectedColumns.length; j++) {
        // Firebase format: expectedRow is string[] (array), CodePractice: object with 'i0','i1' keys
        const expectedVal = Array.isArray(expectedRow) ? expectedRow[j] : expectedRow['i' + j];
        const headerName = expectedColumns[j];
        const actualKey = actualHeaders.find(h => h.toLowerCase() === headerName.toLowerCase()) || actualHeaders[j];
        const actualVal = actualRow[actualKey];
        
        // Compare values with tolerance
        if (actualVal === null && expectedVal === null) continue;
        if (actualVal === null || expectedVal === null) return false;
        
        const actualStr = String(actualVal).trim().toLowerCase();
        const expectedStr = String(expectedVal).trim().toLowerCase();
        if (actualStr !== expectedStr) {
          const actualNum = parseFloat(String(actualVal));
          const expectedNum = parseFloat(String(expectedVal));
          if (isNaN(actualNum) || isNaN(expectedNum) || Math.abs(actualNum - expectedNum) >= 0.0001) {
            return false;
          }
        }
      }
    }
    return true;
  };
  
  /** Run user's SQL code in PGlite */
  const handleRunSqlCode = async () => {
    if (!currentQuestion) return;
    
    setIsRunning(true);
    setActiveCodeTab('output');
    setCodeOutput('🔄 Executing SQL...');
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (!pgliteRef.current) {
      const success = await initPGliteForQuestion(currentQuestion);
      if (!success) { setIsRunning(false); return; }
    }
    
    try {
      const freshCode = editorRef.current ? editorRef.current.getValue() : codeInput;
      const startTime = performance.now();
      
      const codeWithoutComments = freshCode
        .split('\n')
        .map((line: string) => {
          const commentIndex = line.indexOf('--');
          if (commentIndex !== -1) return line.substring(0, commentIndex).trim();
          return line;
        })
        .join('\n');
      
      const statements = codeWithoutComments.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      
      let outputText = '';
      for (const statement of statements) {
        if (!statement) continue;
        try {
          const result = await pgliteRef.current.query(statement);
          const upperStatement = statement.toUpperCase().trim();
          
          if (upperStatement.startsWith('SELECT') || upperStatement.startsWith('TABLE') || upperStatement.startsWith('WITH')) {
            if (result && result.rows && result.rows.length > 0) {
              const columns = result.fields?.map((f: any) => f.name) || Object.keys(result.rows[0]);
              const colWidths = columns.map((col: string) => {
                const maxDataWidth = Math.max(...result.rows.map((row: any) => String(row[col] ?? 'NULL').length));
                return Math.max(col.length, maxDataWidth, 4);
              });
              const header = columns.map((col: string, i: number) => col.padEnd(colWidths[i])).join(' │ ');
              const separator = colWidths.map((w: number) => '─'.repeat(w)).join('─┼─');
              const rows = result.rows.map((row: any) =>
                columns.map((col: string, i: number) => String(row[col] ?? 'NULL').padEnd(colWidths[i])).join(' │ ')
              ).join('\n');
              outputText += `\n${header}\n${separator}\n${rows}\n\n(${result.rows.length} row${result.rows.length !== 1 ? 's' : ''})\n`;
            } else {
              outputText += `\n(0 rows)\n`;
            }
          } else if (upperStatement.startsWith('INSERT')) {
            const count = result?.affectedRows ?? result?.rowCount ?? 1;
            outputText += `\n✅ INSERT ${count} row${count !== 1 ? 's' : ''}\n`;
          } else if (upperStatement.startsWith('UPDATE')) {
            const count = result?.affectedRows ?? result?.rowCount ?? 0;
            outputText += `\n✅ UPDATE ${count} row${count !== 1 ? 's' : ''}\n`;
          } else if (upperStatement.startsWith('DELETE')) {
            const count = result?.affectedRows ?? result?.rowCount ?? 0;
            outputText += `\n✅ DELETE ${count} row${count !== 1 ? 's' : ''}\n`;
          } else {
            outputText += `\n✅ Query executed successfully\n`;
          }
        } catch (stmtError: any) {
          outputText += `\n❌ Error: ${stmtError.message}\n`;
        }
      }
      
      const endTime = performance.now();
      const execTime = ((endTime - startTime) / 1000).toFixed(3);
      setCodeOutput(`🐘 PostgreSQL (PGlite)\n════════════════════════════════\n${outputText}\n════════════════════════════════`);
      setExecutionTime(`${execTime}s`);
      setExecutionMemory('In-Browser');
    } catch (error: any) {
      setCodeOutput(`❌ SQL Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  // Run single SQL test case (for TestCasesPanel)
  const runSingleSqlTestCase = async (index: number): Promise<{passed: boolean; actual?: string; error?: string}> => {
    if (!currentQuestion || !currentQuestion.tableSchema) return { passed: false, error: 'No schema' };
    
    // Initialize PGlite if needed
    if (!pgliteRef.current) {
      const success = await initPGliteForQuestion(currentQuestion);
      if (!success) return { passed: false, error: 'PGlite init failed' };
    }
    
    const freshCode = editorRef.current ? editorRef.current.getValue() : codeInput;
    const tableSchema = currentQuestion.tableSchema;
    const schemas = Array.isArray(tableSchema) ? tableSchema : [tableSchema];
    const tc = visibleTestCases[index];
    if (!tc) return { passed: false, error: 'Test case not found' };
    
    try {
      // Truncate all tables
      for (const schema of schemas) {
        const tableName = schema?.tableName || schema?.table_name || 'Table';
        try { await pgliteRef.current.query(`DELETE FROM ${tableName}`); } catch (e) { /* ignore */ }
      }
      
      // Insert test data
      if (tc.sqlInput) {
        await insertSqlTestData(tc.sqlInput, schemas);
      }
      
      // Run user query
      const result = await pgliteRef.current.query(freshCode);
      const actualRows = result.rows || [];
      const actualHeaders = actualRows.length > 0 ? Object.keys(actualRows[0]) : [];
      
      // Compare with expected
      const expectedColumns = tc.sqlExpectedOutput?.columns || [];
      const expectedRows = tc.sqlExpectedOutput?.rows || [];
      const isCorrect = compareSqlResults(actualHeaders, actualRows, expectedColumns, expectedRows);
      
      // Format actual output for display
      const actualStr = actualHeaders.join(' | ') + '\n' + actualRows.map((row: any) => actualHeaders.map(h => String(row[h] ?? 'NULL')).join(' | ')).join('\n');
      
      return { passed: isCorrect, actual: actualStr } as any;
    } catch (err: any) {
      return { passed: false, error: err.message };
    }
  };
  
  // ==================== End PGlite SQL Functions ====================

  // Run code (Judge0 for code, PGlite for SQL)
  const handleRunCode = async () => {
    // For SQL questions, use PGlite instead of Judge0
    if (currentQuestion?.type === QUESTION_TYPES.SQL) {
      await handleRunSqlCode();
      return;
    }

    if (!isOnline) {
      setCodeOutput('❌ Cannot run code while offline. Please check your internet connection.');
      return;
    }

    setIsRunning(true);
    setCodeOutput('⏳ Compiling and running code...\n⏳ Please wait...');
    setActiveCodeTab('output'); // Auto-switch to output tab

    try {
      // ✅ Get fresh code from editor
      const freshCode = editorRef.current ? editorRef.current.getValue() : codeInput;
      
      // console.log('🚀 Running with fresh code, length:', freshCode.length);
      
      const result = await judge0Service.executeCode(
        freshCode,  // ✅ FRESH FROM EDITOR
        selectedLanguage,
        customInput
      );

      if (result.success) {
        setCodeOutput(
          `✅ Execution successful!\n\n` +
          `Output:\n${result.output || '(no output)'}\n`
        );
        setExecutionTime(`${result.time}s`);
        setExecutionMemory(result.memory);
      } else {
        setCodeOutput(
          `❌ Execution failed!\n\n` +
          `Error:\n${result.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      setCodeOutput(
        `❌ Error: ${error.message}\n` +
        `Please check your code and try again.`
      );
    } finally {
      setIsRunning(false);
    }
  };

  const progress = Math.round((stats.answered / (phaseQuestions.length || 1)) * 100);

  // Filter questions based on active filters (OR logic for multiple states)
  const getFilteredQuestions = () => {
    return questions.filter((question) => {
      const isAnswered = !!answers[question.id];
      const isBookmarked = bookmarkedQuestions.has(question.id);
      const isViewed = viewedQuestions.has(question.id);
      
      // Check if question matches ANY active filter
      const matchesAnswered = isAnswered && showAnswered;
      const matchesBookmarked = isBookmarked && showBookmarked;
      const matchesSkipped = isViewed && !isAnswered && !isBookmarked && showSkipped;
      const matchesNotViewed = !isViewed && showNotViewed;
      
      // Show question if it matches at least one active filter
      return matchesAnswered || matchesBookmarked || matchesSkipped || matchesNotViewed;
    });
  };

  const filteredQuestions = getFilteredQuestions();


  // Handle Monaco editor mount
  // Memoize handleEditorMount to prevent recreating on every render
  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Customize line highlight to use subtle grey background instead of border
    monaco.editor.defineTheme('custom-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.lineHighlightBackground': '#f0f0f0',
        'editor.lineHighlightBorder': '#00000000',
      }
    });
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      guides: { indentation: false, bracketPairs: false, highlightActiveIndentation: false },
      colors: {
        'editor.lineHighlightBackground': '#2a2d35',
        'editor.lineHighlightBorder': '#00000000',
      }
    });
    monaco.editor.setTheme(darkMode ? 'custom-dark' : 'custom-light');
    
    // Track cursor position for Ln/Col display
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorLine(e.position.lineNumber);
      setCursorColumn(e.position.column);
    });
    
    const code = editor.getValue();
    const lines = code.split('\n');
    const commentIndex = lines.findIndex((line: string) => line.trim().includes('Write your code here'));
    
    if (commentIndex !== -1) {
      // commentIndex is 0-based, Monaco is 1-based
      // Protect lines 1 through (commentIndex + 1) which includes the comment line
      const protectedEndLine = commentIndex + 1;
      
      // Add visual decoration for protected lines
      editor.deltaDecorations([], [{
        range: new monaco.Range(1, 1, protectedEndLine, Number.MAX_SAFE_INTEGER),
        options: {
          isWholeLine: true,
          className: darkMode ? 'read-only-line-dark' : 'read-only-line-light',
        }
      }]);
      
      // 🔥 Protected-line undo logic — only needed when boilerplate has read-only header
      let preventUndo = false;
      
      editor.onDidChangeModelContent((e: any) => {
        if (preventUndo) return;
        
        const changes = e.changes;
        let hasProtectedEdit = false;
        
        for (const change of changes) {
          if (change.range.startLineNumber <= protectedEndLine) {
            hasProtectedEdit = true;
            break;
          }
        }
        
        if (hasProtectedEdit) {
          preventUndo = true;
          editor.trigger('keyboard', 'undo', {});
          preventUndo = false;
        } else {
          const val = editor.getValue();
          setCodeInput(val);
          codeInputRef.current = val;
        }
      });
      
      // Position cursor in editable area (line after comment)
      setTimeout(() => {
        editor.setPosition({ lineNumber: protectedEndLine + 1, column: 5 });
        editor.focus();
      }, 100);
    } else {
      // No protected region — onChange prop handles state sync
      // Just focus the editor
      setTimeout(() => {
        editor.focus();
      }, 100);
    }
  }, [darkMode]); // Only recreate if darkMode changes


  // ========== Resizer Handlers ==========
  const handleHorizontalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingHorizontal.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingHorizontal.current || !resizeContainerRef.current) return;
      const rect = resizeContainerRef.current.getBoundingClientRect();
      const percentage = ((e.clientX - rect.left) / rect.width) * 100;
      // Ensure left panel min 300px and right panel min 400px
      const minLeftPercent = (400 / rect.width) * 100;
      const maxLeftPercent = 100 - (400 / rect.width) * 100;
      setLeftPanelWidth(Math.min(Math.max(percentage, minLeftPercent), maxLeftPercent));
    };

    const handleMouseUp = () => {
      isResizingHorizontal.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleVerticalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingVertical.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const startY = e.clientY;
    const startHeight = editorHeight;
    const parentEl = (e.target as HTMLElement).parentElement;
    const parentHeight = parentEl?.clientHeight || 600;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingVertical.current) return;
      const deltaY = e.clientY - startY;
      const deltaPercent = (deltaY / parentHeight) * 100;
      setEditorHeight(Math.min(Math.max(startHeight + deltaPercent, 20), 85));
    };

    const handleMouseUp = () => {
      isResizingVertical.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [editorHeight]);

  // Render answer input based on question type
  const renderAnswerSection = () => {
    const normalizedType = normalizeQuestionType(currentQuestion.type);
    switch (normalizedType) {
      case QUESTION_TYPES.SQL:
    case QUESTION_TYPES.CODE:
        return (
          <div className="flex flex-col h-full">
            {/* Header with Buttons in Same Row */}
            <div className={`px-4 py-1.5 border-b ${darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex items-center justify-between gap-2 overflow-hidden`}>
              <h4 className={`text-xs font-bold flex items-center space-x-2 flex-shrink-0 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                <FontAwesomeIcon icon={faCode} />
                <span>{currentQuestion.type === QUESTION_TYPES.SQL ? 'SQL Editor' : 'Code Editor'}</span>
              </h4>
              <div className="flex items-center space-x-2 overflow-x-auto flex-shrink-0">
                {/* Language Selector Dropdown - hidden for SQL */}
                {currentQuestion.type === QUESTION_TYPES.SQL ? (
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'
                  }`}>SQL</span>
                ) : (
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    // If question has starterCodes, load the matching boilerplate
                    if (currentQuestion.starterCodes && currentQuestion.starterCodes.length > 0) {
                      const currentCode = editorRef.current ? editorRef.current.getValue() : codeInput;
                      // Only switch boilerplate if current code is empty or matches another starterCode
                      const normalizeCode = (code: string) => code.replace(/\s+/g, ' ').trim();
                      const normalizedCurrent = normalizeCode(currentCode);
                      const isBoilerplate = !currentCode.trim() || currentQuestion.starterCodes.some(
                        (sc: any) => normalizeCode(sc.code) === normalizedCurrent
                      );
                      if (isBoilerplate) {
                        // Code is unedited — switch silently
                        setSelectedLanguage(newLang);
                        const starterCode = currentQuestion.starterCodes.find(
                          (sc: any) => sc.language.toLowerCase() === newLang
                        );
                        if (starterCode) {
                          setCodeInput(starterCode.code);
                          if (editorRef.current) {
                            editorRef.current.setValue(starterCode.code);
                          }
                          codeInputRef.current = starterCode.code;
                          initialCodeLengthRef.current[currentQuestion.id] = starterCode.code.length;
                        }
                      } else {
                        // Code has been edited — show confirmation dialog
                        const starterCode = currentQuestion.starterCodes.find(
                          (sc: any) => sc.language.toLowerCase() === newLang
                        );
                        if (starterCode) {
                          setLangSwitchConfirm({ newLang, starterCode: starterCode.code });
                        } else {
                          // No starter code for this language — just switch language, keep code
                          setSelectedLanguage(newLang);
                        }
                      }
                    } else {
                      // No starterCodes — just switch language
                      setSelectedLanguage(newLang);
                    }
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' 
                      : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                  }`}
                  title="Select programming language"
                >
                  {currentQuestion.starterCodes && currentQuestion.starterCodes.length > 0
                    ? currentQuestion.starterCodes.map((sc: any) => {
                        const lang = sc.language.toLowerCase();
                        const labels: Record<string, string> = {
                          cpp: 'C++', c: 'C', java: 'Java', python: 'Python',
                          javascript: 'JavaScript', typescript: 'TypeScript',
                          csharp: 'C#', go: 'Go', rust: 'Rust', ruby: 'Ruby',
                          kotlin: 'Kotlin', swift: 'Swift', sql: 'SQL'
                        };
                        return <option key={lang} value={lang}>{labels[lang] || lang}</option>;
                      })
                    : currentQuestion.language
                      ? <option value={currentQuestion.language.toLowerCase()}>{currentQuestion.language}</option>
                      : <option value="javascript">JavaScript</option>
                  }
                </select>
                )}
                <button 
                  onClick={() => saveCurrentAnswer(true)}
                  disabled={isSavingAnswer}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                    isSavingAnswer 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : lastSavedQuestion === currentQuestion.id
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-orange-500 hover:bg-orange-600'
                  } text-white`}
                >
                  {isSavingAnswer ? (
                    <>
                      <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full" />
                      <span>Saving...</span>
                    </>
                  ) : lastSavedQuestion === currentQuestion.id ? (
                    <>
                      <FontAwesomeIcon icon={faCircleCheck} />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPaperPlane} />
                      <span>Submit</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center space-x-1"
                >
                  <FontAwesomeIcon icon={faPlay} />
                  <span>Run</span>
                </button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div 
              className="border border-gray-300 mx-1.5 mt-1.5 rounded-lg overflow-hidden relative"
              style={{ height: `${editorHeight}%`, flexShrink: 0 }}
              onClick={() => {
                if (editorRef.current) {
                  editorRef.current.focus();
                }
              }}
            >
              {(() => {
                return (
                  <Editor
                    key={`editor-${currentQuestion.id}-${selectedLanguage}`}
                    height="100%"
                    language={selectedLanguage}
                    value={codeInput}
                    onMount={handleEditorMount}
                    onChange={(val) => {
                      const newVal = val || '';
                      setCodeInput(newVal);
                      codeInputRef.current = newVal;
                      // 🔥 Mark this question as dirty — user has actively typed
                      if (currentQuestion?.id) dirtyQuestionsRef.current.add(currentQuestion.id);
                    }}
                    theme={darkMode ? 'custom-dark' : 'custom-light'}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      readOnly: false,
                      contextmenu: false,
                      selectOnLineNumbers: true,
                      roundedSelection: false,
                      cursorStyle: 'line',
                      wordWrap: 'on',
                      glyphMargin: false,
                      renderLineHighlight: 'all',
                      renderLineHighlightOnlyWhenFocus: false,
                      quickSuggestions: false,
                      suggestOnTriggerCharacters: false,
                      wordBasedSuggestions: 'off',
                      parameterHints: { enabled: false },
                      suggest: { showWords: false },
                      scrollbar: {
                        vertical: 'hidden',
                        horizontal: 'hidden',
                        verticalScrollbarSize: 0,
                        horizontalScrollbarSize: 0,
                      },
                    }}
                  />
                );
              })()}
              {/* Ln/Col Indicator */}
              <div className={`absolute bottom-1 right-3 text-xs px-2 py-0.5 rounded ${
                darkMode ? 'text-gray-400 bg-gray-800/80' : 'text-gray-500 bg-white/80'
              }`}>
                Ln {cursorLine}, Col {cursorColumn}
              </div>
            </div>

            {/* Tabbed Panel: Output | Stdin | Test Cases */}
            {/* Vertical Resizer */}
            <div
              onMouseDown={handleVerticalResizeStart}
              className="h-1 mx-1.5 cursor-row-resize flex-shrink-0"
              title="Drag to resize editor and output"
            />

            <div className={`mx-1.5 mb-1.5 border rounded-lg overflow-hidden flex flex-col flex-1 ${
              darkMode ? 'border-gray-700' : 'border-gray-300'
            }`}>
              {/* Tab Headers */}
              <div className={`flex items-center border-b ${
                darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              }`}>
                <button
                  onClick={() => setActiveCodeTab('output')}
                  className={`px-4 py-2 text-sm font-medium flex items-center space-x-2 border-b-2 transition-colors ${
                    activeCodeTab === 'output'
                      ? darkMode 
                        ? 'border-blue-400 text-blue-400 bg-gray-750' 
                        : 'border-blue-600 text-blue-600 bg-white'
                      : darkMode
                        ? 'border-transparent text-gray-400 hover:text-gray-200'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FontAwesomeIcon icon={faTerminal} className="text-sm" />
                  <span>Output</span>
                </button>
                {/* Stdin tab - not needed for SQL */}
                {currentQuestion.type !== QUESTION_TYPES.SQL && (
                <button
                  onClick={() => setActiveCodeTab('stdin')}
                  className={`px-4 py-2 text-sm font-medium flex items-center space-x-2 border-b-2 transition-colors ${
                    activeCodeTab === 'stdin'
                      ? darkMode 
                        ? 'border-blue-400 text-blue-400 bg-gray-750' 
                        : 'border-blue-600 text-blue-600 bg-white'
                      : darkMode
                        ? 'border-transparent text-gray-400 hover:text-gray-200'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FontAwesomeIcon icon={faKeyboard} className="text-sm" />
                  <span>Stdin</span>
                </button>
                )}
                <button
                  onClick={async () => {
                    // Open TestCasesPanel overlay for both CODE and SQL
                    if (editorRef.current) {
                      const latestCode = editorRef.current.getValue();
                      setCodeInput(latestCode);
                    }
                    setTimeout(() => {
                      setShowTestCasesPanel(true);
                    }, 100);
                  }}
                  disabled={!currentQuestion.testCases || currentQuestion.testCases.length === 0}
                  className={`px-4 py-2 text-sm font-medium flex items-center space-x-2 transition-colors ${
                    !currentQuestion.testCases || currentQuestion.testCases.length === 0
                      ? 'text-gray-400 opacity-50 cursor-not-allowed'
                      : darkMode
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FontAwesomeIcon icon={faListCheck} className="text-sm" />
                  <span>Test Cases{currentQuestion.testCases && currentQuestion.testCases.length > 0 ? ` (${visibleTestCasesCount})` : ''}</span>
                </button>

              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Output Tab */}
                {activeCodeTab === 'output' && (
                  <div className={`px-4 py-3 h-full font-mono text-xs ${
                    darkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-50 text-gray-800'
                  }`}>
                    {codeOutput ? (
                      <pre className="whitespace-pre-wrap">{codeOutput}</pre>
                    ) : (
                      <span className={`italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        // Output will appear here after running code
                      </span>
                    )}
                  </div>
                )}

                {/* Stdin Tab */}
                {activeCodeTab === 'stdin' && (
                  <div className="px-4 py-3 h-full">
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      className={`w-full h-full p-2 rounded border resize-none font-mono text-sm transition-colors ${
                        darkMode
                          ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-blue-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                      placeholder="Enter input for your program (e.g., test data, numbers)..."
                      style={{ minHeight: '120px' }}
                    />
                  </div>
                )}

              </div>
            </div>

            {/* Stats Footer Strip */}
            <div className={`w-full flex items-center justify-between px-6 py-2 border-t ${
              darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-600'
            }`} style={{ fontSize: '10px' }}>
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <FontAwesomeIcon icon={faClock} />
                  <span>Time: {executionTime}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <FontAwesomeIcon icon={faMemory} />
                  <span>Memory: {executionMemory}</span>
                </span>
              </div>
              <span className={`font-semibold flex items-center space-x-1 ${
                isRunning ? 'text-yellow-600' : 'text-green-600'
              }`}>
                <FontAwesomeIcon icon={isRunning ? faHourglass : faCircleCheck} />
                <span>Status: {isRunning ? 'Running' : 'Ready'}</span>
              </span>
            </div>
          </div>
        );

      case QUESTION_TYPES.MCQ:
        return (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`px-6 py-3 border-b ${darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
              <h4 className={`text-sm font-bold flex items-center space-x-2 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                <FontAwesomeIcon icon={faListCheck} />
                <span>Multiple Choice Question</span>
              </h4>
              <button 
                onClick={() => saveCurrentAnswer(true)}
                disabled={isSavingAnswer}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                  isSavingAnswer 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : lastSavedQuestion === currentQuestion.id
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white`}
              >
                {isSavingAnswer ? (
                  <>
                    <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full" />
                    <span>Saving...</span>
                  </>
                ) : lastSavedQuestion === currentQuestion.id ? (
                  <>
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} />
                    <span>Submit Answer</span>
                  </>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className={`text-sm font-semibold mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Select the correct answer(s):
              </p>
              <div className="space-y-3">
                {currentQuestion.options?.map((option, index) => {
                  // ✅ Check if actual option text is selected (not index)
                  const isSelected = mcqAnswer.includes(option);
                  
                  let buttonClasses = 'w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center ';
                  
                  if (darkMode) {
                    buttonClasses += isSelected 
                      ? 'border-blue-500 bg-gray-700' 
                      : 'border-gray-600 bg-gray-700 hover:border-gray-500';
                  } else {
                    buttonClasses += isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 bg-white hover:border-gray-400';
                  }
                  
                  return (
                    <button
                      key={`${currentQuestion.id}-opt-${index}`}
                      onClick={() => {
                        // ✅ CHECKBOX MODE: Always allow multiple selections
                        let newAnswer: string[];
                        if (isSelected) {
                          // Remove from selection
                          newAnswer = mcqAnswer.filter(ans => ans !== option);
                        } else {
                          // Add to selection
                          newAnswer = currentQuestion.multipleCorrect ? [...mcqAnswer, option] : [option];
                        }
                        setMcqAnswer(newAnswer);
                        mcqAnswerRef.current = newAnswer; // ✅ Sync ref immediately
                        if (currentQuestion?.id) dirtyQuestionsRef.current.add(currentQuestion.id);
                      }}
                      className={buttonClasses}
                    >
                      {/* Selection Indicator: Checkbox */}
                      <div className="mr-3 flex-shrink-0">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected 
                            ? 'bg-blue-500 border-blue-500' 
                            : darkMode ? 'border-gray-500' : 'border-gray-400'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      
                      {/* Option Letter */}
                      <span className={`font-bold mr-3 ${darkMode ? 'text-gray-400' : isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                        {String.fromCharCode(65 + index)}.
                      </span>
                      
                      {/* Option Text */}
                      <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>{option}</span>
                    </button>
                  );
                })}
              </div>
              <div className={`mt-6 p-3 rounded-lg ${darkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'} flex items-start space-x-2`}>
                
                <div className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  <p> 
                    <strong><FontAwesomeIcon icon={faCircleInfo} className="text-blue-500 mt-0.5" /></strong> Click on options to select your answer(s). You can select one or more options.
                  </p>
                  <p className={`mt-1 font-semibold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                    ⚠ Wrong options will face negative marking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case QUESTION_TYPES.DESCRIPTIVE:
        return (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`px-6 py-3 border-b ${darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
              <h4 className={`text-sm font-bold flex items-center space-x-2 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                <FontAwesomeIcon icon={faPenToSquare} />
                <span>Text Editor</span>
              </h4>
              <button 
                onClick={() => saveCurrentAnswer(true)}
                disabled={isSavingAnswer}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                  isSavingAnswer 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : lastSavedQuestion === currentQuestion.id
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white`}
              >
                {isSavingAnswer ? (
                  <>
                    <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full" />
                    <span>Saving...</span>
                  </>
                ) : lastSavedQuestion === currentQuestion.id ? (
                  <>
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} />
                    <span>Submit Answer</span>
                  </>
                )}
              </button>
            </div>

            {/* Quill Rich Text Editor */}
            <div className="flex-1 overflow-hidden px-6 pb-6 flex flex-col" style={{ minHeight: 0 }}>
              {answersInitialized ? (
                <div className="h-full flex flex-col" style={{ maxHeight: '100%' }}>
                  <style>{`
                    .rich-text-editor-container {
                      height: 100%;
                      display: flex;
                      flex-direction: column;
                    }
                    .rich-text-editor-container > div {
                      height: 100%;
                      display: flex;
                      flex-direction: column;
                    }
                    .rich-text-editor-container .overflow-y-auto {
                      flex: 1;
                      min-height: 0;
                    }
                    .rich-text-editor-container .ProseMirror {
                      min-height: 100%;
                    }
                  `}</style>
                  <div className="rich-text-editor-container h-full">
                    <RichTextEditor
                      key={`${currentQuestion.id}-v${answerLoadVersionRef.current[currentQuestion.id] || 0}`}
                      value={descriptiveAnswer}
                      onChange={(value: string) => {
                        setDescriptiveAnswer(value);
                        descriptiveAnswerRef.current = value; // ✅ Sync ref immediately
                        if (currentQuestion?.id) dirtyQuestionsRef.current.add(currentQuestion.id);
                      }}
                      darkMode={darkMode}
                      placeholder="Type your answer here... Use the toolbar to format text, add code blocks, images, and more."
                      height="100%"
                    />
                  </div>
                </div>
              ) : (
                <div className={`flex items-center justify-center h-32 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Loading editor...
                </div>
              )}
            </div>
          </div>
        );

      case QUESTION_TYPES.FITB:
        // Calculate blank count with fallback
        const blanksCount = currentQuestion.blanksCount || 
                           currentQuestion.correctAnswers?.length || 
                           (currentQuestion.questionText?.match(/_{3,}/g) || []).length || 
                           0;
        
        return (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`px-6 py-3 border-b ${darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
              <h4 className={`text-sm font-bold flex items-center space-x-2 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                <FontAwesomeIcon icon={faPenToSquare} />
                <span>Fill in the Blanks</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs ${darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                  {blanksCount} {blanksCount === 1 ? 'blank' : 'blanks'}
                </span>
              </h4>
              <button 
                onClick={() => saveCurrentAnswer(true)}
                disabled={isSavingAnswer}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                  isSavingAnswer 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : lastSavedQuestion === currentQuestion.id
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white`}
              >
                {isSavingAnswer ? (
                  <>
                    <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full" />
                    <span>Saving...</span>
                  </>
                ) : lastSavedQuestion === currentQuestion.id ? (
                  <>
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} />
                    <span>Submit Answer</span>
                  </>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {blanksCount === 0 ? (
                <div className={`mt-6 p-6 rounded-lg text-center ${
                  darkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className={`text-base font-bold mb-2 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                    No Blanks Found
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                    This question has no blanks to fill. Please contact your instructor.
                  </p>
                </div>
              ) : (
                <>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Fill in the blanks:
                  </h3>
                  <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Enter your answers in the text boxes below. Make sure to spell correctly!
                  </p>
                  
                  <div className="space-y-4">
                    {Array.from({ length: blanksCount }).map((_, index) => {
                      const isFilled = fillBlanksAnswers[index] && fillBlanksAnswers[index].trim() !== '';
                      
                      return (
                        <div key={index} className="flex items-start space-x-4">
                          {/* Blank number badge */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            isFilled 
                              ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                              : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          
                          {/* Input field */}
                          <div className="flex-1">
                            <input
                              id={`blank-${index}`}
                              type="text"
                              value={fillBlanksAnswers[index] || ''}
                              onChange={(e) => handleBlankChange(index, e.target.value)}
                              placeholder={`Enter answer for blank ${index + 1}`}
                              className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none ${
                                isFilled
                                  ? darkMode 
                                    ? 'bg-gray-800 text-white border-green-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
                                    : 'bg-white text-gray-900 border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
                                  : darkMode
                                    ? 'bg-gray-800 text-white border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                                    : 'bg-white text-gray-900 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                              } ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'}`}
                              autoComplete="off"
                            />
                            
                            {/* Character count (optional) */}
                            {fillBlanksAnswers[index] && (
                              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                {fillBlanksAnswers[index].length} characters
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Progress indicator */}
                  <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Progress
                      </span>
                      <span className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                        {fillBlanksAnswers.filter(a => a && a.trim() !== '').length} / {blanksCount} filled
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(fillBlanksAnswers.filter(a => a && a.trim() !== '').length / blanksCount) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case QUESTION_TYPES.JUMBLED:
        return (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`px-6 py-3 border-b ${darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
              <h4 className={`text-sm font-bold flex items-center space-x-2 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                <FontAwesomeIcon icon={faShuffle} />
                <span>Jumbled Question</span>
              </h4>
              <button 
                onClick={() => saveCurrentAnswer(true)}
                disabled={isSavingAnswer}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                  isSavingAnswer 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : lastSavedQuestion === currentQuestion.id
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white`}
              >
                {isSavingAnswer ? (
                  <>
                    <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full" />
                    <span>Saving...</span>
                  </>
                ) : lastSavedQuestion === currentQuestion.id ? (
                  <>
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} />
                    <span>Submit Answer</span>
                  </>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Drag and drop to arrange in correct order:
              </h3>
              
              {jumbledAnswers.length === 0 ? (
                <div className={`mt-6 p-6 rounded-lg text-center ${
                  darkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className={`text-base font-bold mb-2 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                    No Items to Arrange
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                    This jumbled question has no items configured. Please contact your teacher.
                  </p>
                  <div className={`mt-4 p-3 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <strong>Technical Details:</strong><br/>
                      Question ID: {currentQuestion.id}<br/>
                      Question Type: {currentQuestion.type}<br/>
                      Items Array Length: {jumbledAnswers.length}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  {jumbledAnswers.map((item, index) => (
                    <DraggableItem
                      key={`${currentQuestion.id}-${index}`}
                      item={item}
                      index={index}
                      moveItem={moveJumbledItem}
                      darkMode={darkMode}
                    />
                  ))}
                </div>
              )}
              
              <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-blue-50 border border-blue-200'} flex items-start space-x-2`}>
                <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Tip:</strong> Click and drag the items to reorder them. The correct sequence will be validated when you submit.
                </p>
              </div>
            </div>
          </div>
        );

      case QUESTION_TYPES.LIKERT: {
        const LIKERT_OPTIONS = [
          { value: 1, label: 'Strongly Disagree', emoji: '😤', sel: 'bg-red-500 border-red-500 text-white shadow-md',    hover: 'hover:border-red-300 hover:bg-red-50' },
          { value: 2, label: 'Disagree',          emoji: '🙁', sel: 'bg-orange-400 border-orange-400 text-white shadow-md', hover: 'hover:border-orange-300 hover:bg-orange-50' },
          { value: 3, label: 'Neutral',           emoji: '😐', sel: 'bg-yellow-400 border-yellow-400 text-white shadow-md', hover: 'hover:border-yellow-300 hover:bg-yellow-50' },
          { value: 4, label: 'Agree',             emoji: '🙂', sel: 'bg-lime-500 border-lime-500 text-white shadow-md',     hover: 'hover:border-lime-300 hover:bg-lime-50' },
          { value: 5, label: 'Strongly Agree',    emoji: '😄', sel: 'bg-green-500 border-green-500 text-white shadow-md',   hover: 'hover:border-green-300 hover:bg-green-50' },
        ];
        const subLabels: Record<number,string> = {
          1: 'I strongly disagree with this statement',
          2: 'I somewhat disagree with this statement',
          3: 'I neither agree nor disagree',
          4: 'I somewhat agree with this statement',
          5: 'I strongly agree with this statement',
        };
        const curVal = likertAnswers[currentQuestion.id] ? parseInt(likertAnswers[currentQuestion.id]) : 0;
        return (
          <div className={`flex flex-col h-full ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className={`px-5 py-3 border-b flex-shrink-0 flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
              <h4 className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>🧠 Rate your agreement</h4>
              <button
                onClick={() => saveCurrentAnswer(true)}
                disabled={isSavingAnswer || !curVal}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                  isSavingAnswer || !curVal
                    ? 'bg-gray-400 cursor-not-allowed'
                    : lastSavedQuestion === currentQuestion.id
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white`}
              >
                {isSavingAnswer ? (
                  <>
                    <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full" />
                    <span>Saving...</span>
                  </>
                ) : lastSavedQuestion === currentQuestion.id ? (
                  <>
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {LIKERT_OPTIONS.map((opt) => {
                const isSelected = curVal === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      likertAnswersRef.current = { ...likertAnswersRef.current, [currentQuestion.id]: String(opt.value) };
                      setLikertAnswers(prev => ({ ...prev, [currentQuestion.id]: String(opt.value) }));
                      saveCurrentAnswer(true);
                    }}
                    className={`w-full flex items-center space-x-4 px-4 py-4 rounded-xl border-2 transition-all duration-150 text-left group ${
                      isSelected
                        ? opt.sel + ' scale-[1.02]'
                        : darkMode
                          ? 'bg-gray-700 border-gray-600 hover:border-gray-400'
                          : 'bg-white border-gray-200 hover:scale-[1.01] ' + opt.hover
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0 transition-transform duration-150 group-hover:scale-110">{opt.emoji}</span>
                    <div className="flex-1">
                      <div className={`text-base font-semibold ${isSelected ? 'text-white' : darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{opt.label}</div>
                      <div className={`text-xs mt-0.5 ${isSelected ? 'text-white/75' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{subLabels[opt.value]}</div>
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div className={`px-5 py-3 border-t flex-shrink-0 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'}`}>
              <p className={`text-[11px] text-center italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>There are no right or wrong answers — respond honestly</p>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // ==================== LOADING STATES ====================
  if (questionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-lg text-gray-700">Loading exam questions...</p>
        </div>
      </div>
    );
  }

  if (attemptLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-lg text-gray-700">Loading exam with AI evaluation...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-lg text-gray-700 mb-4">No questions found in this exam</p>
          <button
            onClick={onExitExam}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Exit Exam
          </button>
        </div>
      </div>
    );
  }

  const isStudent = !!(userStudentRoll && userStudentRoll.trim() !== '' && userStudentRoll !== 'N/A');
  if ((attemptError || !attempt) && isStudent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-lg text-gray-700 mb-4">{attemptError || 'Failed to load exam'}</p>
          <button
            onClick={onExitExam}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Exit Exam
          </button>
        </div>
      </div>
    );
  }


  // ✅ CRITICAL: Prevent re-entry if exam is already submitted
  // BUT: Don't block if success dialog is currently showing OR phase transition is active
  if (isAlreadySubmitted && !(showSubmitDialog && submitStatus === SUBMIT_STATUS.SUCCESS) && !showPhaseTransition) {
    // console.log('🚫 BLOCKING ACCESS - Showing "Already Submitted" screen');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-100">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-lg text-gray-700 mb-4">This exam has already been submitted</p>
          <p className="text-sm text-gray-600 mb-6">You cannot re-enter or make changes to a submitted exam</p>
          <button
            onClick={onDirectExit || onExitExam}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className={`h-screen w-screen flex ${darkMode ? 'bg-gray-900 exam-dark-mode' : 'bg-white'}`}>
      {darkMode && (
        <style>{`
          .exam-dark-mode .prose, .exam-dark-mode .prose * { color: #f3f4f6 !important; }
          .exam-dark-mode .prose strong, .exam-dark-mode .prose b { color: #ffffff !important; }
          .exam-dark-mode .prose h1, .exam-dark-mode .prose h2, .exam-dark-mode .prose h3 { color: #ffffff !important; }
          .exam-dark-mode .prose code { color: #f3f4f6 !important; background: #374151 !important; }
          .exam-dark-mode .prose pre { background: #1f2937 !important; color: #f3f4f6 !important; }
          .exam-dark-mode table { color: #f3f4f6 !important; }
          .exam-dark-mode table th, .exam-dark-mode table td { color: #f3f4f6 !important; border-color: #4b5563 !important; }
          .exam-dark-mode table thead { background: #1f2937 !important; }
          .exam-dark-mode table tbody tr { background: #111827 !important; }
          .exam-dark-mode [style*="color"] { color: #f3f4f6 !important; }
          .exam-dark-mode [style*="background-color"] { background-color: rgba(255,255,255,0.1) !important; }
        `}</style>
      )}
      {/* Proctoring Monitor - Hidden component */}
      {faceMonitoringEnabled && baselineDescriptors.length > 0 && attempt?.attemptId && (
        <ExamMonitor
          baselineDescriptors={baselineDescriptors}
          onViolation={logViolation as (type: string, details?: string, proof?: Blob) => void}
          monitoringEnabled={isMonitoringActive}
          selectedAudioDeviceId={selectedAudioDeviceId}
          examId={examId}
          studentId={userId}
          attemptId={attempt.attemptId}
          initialViolationCount={Object.values(questionViolations).reduce((sum, arr) => sum + arr.length, 0)}
        />
      )}

      {/* Left Sidebar - Question Numbers */}
      <div className={`w-14 flex flex-col ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border-r`}>
        {/* Up Arrow */}
        <button 
          className={`h-12 flex items-center justify-center border-b ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} transition-colors`}
          onClick={() => {
            const container = document.getElementById('question-numbers-container');
            if (container) container.scrollBy({ top: -200, behavior: 'smooth' });
          }}
        >
          <FontAwesomeIcon icon={faChevronUp} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
        </button>

        {/* Question Numbers Container */}
        <div 
          id="question-numbers-container"
          className="flex-1 overflow-y-auto py-4 space-y-3 flex flex-col items-center scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredQuestions
            .filter(question => examPhase === 'likert' ? (question as any).isFromLikert : !(question as any).isFromLikert)
            .map((question) => {
            const actualIndex = questions.findIndex(q => q.id === question.id);
            return (
              <button
                key={question.id}
                onClick={() => handleQuestionClick(actualIndex)}
                className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${getStatusColor(question.id, actualIndex)} hover:scale-110`}
              >
                {examPhase === 'likert' ? question.questionNo : question.questionNo - likertOnlyQuestions.length}
              </button>
            );
          })}
        </div>

        {/* Down Arrow */}
        <button 
          className={`h-12 flex items-center justify-center border-t ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} transition-colors`}
          onClick={() => {
            const container = document.getElementById('question-numbers-container');
            if (container) container.scrollBy({ top: 200, behavior: 'smooth' });
          }}
        >
          <FontAwesomeIcon icon={faChevronDown} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Content with Question and Answer panels */}
        <div className="flex-1 flex overflow-hidden" ref={resizeContainerRef}>
          {/* Question Panel */}
          <div className={`flex flex-col relative ${darkMode ? 'bg-gray-900' : 'bg-white'}`} style={{ width: `${leftPanelWidth}%`, minWidth: '400px' }}>
            {/* Question Header */}
            <div className={`px-4 py-1.5 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'} border-b`}>
              <div className="flex items-center justify-between gap-4">
                {/* Question Info */}
                <div className="flex-shrink-0">
                  <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Question No {examPhase === 'likert' ? currentQuestion.questionNo : currentQuestion.questionNo - likertOnlyQuestions.length}/{examPhase === 'likert' ? likertOnlyQuestions.length : questions.length - likertOnlyQuestions.length}
                  </h2>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                   {currentQuestion.type === QUESTION_TYPES.LIKERT ? 'Personality Assessment' : ((QUESTION_TYPE_LABELS as any)[currentQuestion.type] || currentQuestion.type)}, Marks: {currentQuestion.maxMarks}
                  </p>
                </div>

 {              /* Action Buttons - Scrollable on small screens */}
                <div className="overflow-x-auto flex-shrink-0 max-w-[60%] sm:max-w-none scroll-smooth">
                  <div className="flex items-center space-x-2 min-w-max pb-1">
                    <button
                      onClick={toggleBookmark}
                      className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
                        bookmarkedQuestions.has(currentQuestion.id)
                          ? 'bg-purple-500 text-white border-purple-500'
                          : darkMode
                          ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      title={bookmarkedQuestions.has(currentQuestion.id) ? 'Bookmarked' : 'Bookmark'}
                    >
                      <FontAwesomeIcon 
                        icon={faBookmark} 
                        className="text-base"
                      />
                    </button>

                    <button
                      onClick={() => {
                        setShowSubmitDialog(true);
                        setSubmitStatus(SUBMIT_STATUS.IDLE);
                        setSubmitMessage('');
                      }}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                    >
                      <FontAwesomeIcon icon={faCircleCheck} />
                      <span>Submit Exam</span>
                    </button>

                    <button
                      onClick={handlePrevious}
                      disabled={currentQuestionIndex === 0}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                        currentQuestionIndex === 0
                          ? darkMode
                            ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : darkMode
                          ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                      <span>Previous</span>
                    </button>

                    <button
                      onClick={handleNext}
                      disabled={currentQuestionIndex === questions.length - 1}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                        currentQuestionIndex === questions.length - 1
                          ? darkMode
                            ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : darkMode
                          ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span>Next</span>
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Question Content */}
            <div className={`flex-1 overflow-y-auto px-8 pt-4 pb-8 scrollbar-hide ${darkMode ? 'text-gray-100' : 'text-gray-900'} relative`}>
              {/* Image Icon - Top Right Corner */}
              {currentQuestion.imageUrls && currentQuestion.imageUrls.length > 0 && (
                <button
                  onClick={handleViewImages}
                  className={`absolute top-4 right-8 flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-110 shadow-lg z-10 ${
                    darkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  title={`View ${currentQuestion.imageUrls.length} image${currentQuestion.imageUrls.length > 1 ? 's' : ''}`}
                >
                  <FontAwesomeIcon icon={faImage} className="text-base" />
                </button>
              )}
              <div className="space-y-3">
                {(() => {
                  // Process the HTML to wrap code blocks with syntax highlighting
                  const processHTML = (html: string) => {
                    // Split by code tags
                    const parts = html.split(/(<code>.*?<\/code>)/gs);
                    
                    return parts.map((part, index) => {
                      // Check if this is a code block
                      const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                      
                      if (codeMatch) {
                        const codeContent = codeMatch[1];
                        
                        // Determine programming language
                        const detectLanguage = (code: string): string => {
                          // If it's a code question, use its language
                          if (selectedLanguage) {
                            return selectedLanguage.toLowerCase();
                          }
                          
                          // Simple auto-detection based on code patterns
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
                          
                          // Default to java for educational content
                          return 'java';
                        };
                        
                        const language = detectLanguage(codeContent);
                        
                        return (
                          <div key={index} className="relative rounded-lg overflow-hidden">
                            {/* Terminal-style header with macOS dots and code icon */}
                            <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                              {/* macOS-style dots */}
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              </div>
                              
                              {/* Code icon (decoration) */}
                              <div className="text-white font-bold">
                                <FontAwesomeIcon icon={faCode} className="text-base" />
                              </div>
                            </div>
                            
                            {/* Code content with top padding for header */}
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
                      
                      // Regular HTML content
                      return (
                        <div
                          key={index}
                          className="prose prose-sm max-w-none
                            [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-3 [&>h1]:mt-2
                            [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-2 [&>h2]:mt-2
                            [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-2
                            [&>p]:text-base [&>p]:mb-2 [&>p]:leading-relaxed
                            [&_strong]:font-bold
                            [&_br]:block [&_br]:mb-2
                            [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2
                            [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2
                            [&_li]:mb-1
                            [&>pre:not(:has(*))]:hidden
                            [&>pre]:bg-gray-900 [&>pre]:text-gray-100 [&>pre]:p-3 [&>pre]:rounded [&>pre]:my-2
                            [&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded"
                          style={{
                            color: darkMode ? '#f3f4f6' : '#111827',
                            ...(currentQuestion.type === QUESTION_TYPES.LIKERT && { fontSize: '1.2rem', fontWeight: 500, lineHeight: '1.8' })
                          }}
                          dangerouslySetInnerHTML={{ __html: part }}
                        />
                      );
                    });
                  };
                  
                  return processHTML(currentQuestion.questionText || '');
                })()}
              </div>

              {/* SQL Schema - Right below question text, inside scrollable area */}
              {currentQuestion.type === QUESTION_TYPES.SQL && currentQuestion.tableSchema && (() => {
                const schemas = Array.isArray(currentQuestion.tableSchema) ? currentQuestion.tableSchema : [currentQuestion.tableSchema];
                if (schemas.length === 0 || !schemas[0]) return null;
                return (
                  <div className="mt-6">
                    <h3 className={`text-base font-bold mb-3 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Table Schema</h3>
                    <div className="space-y-3">
                      {schemas.map((schema: any, sIdx: number) => {
                        const tableName = schema?.tableName || schema?.table_name || `Table ${sIdx + 1}`;
                        const columns = schema?.columns || [];
                        const pk = schema?.primaryKey || schema?.primary_key || '';
                        const note = schema?.note || '';
                        return (
                          <div key={sIdx} className={`border rounded-lg overflow-hidden ${darkMode ? 'border-gray-700' : 'border-green-200'}`}>
                            <div className={`px-3 py-2 flex items-center justify-between ${darkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-green-50 border-b border-green-200'}`}>
                              <span className={`text-sm font-bold font-mono ${darkMode ? 'text-green-400' : 'text-green-700'}`}>{tableName}</span>
                              {pk && <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>PK: <span className="font-mono font-semibold">{pk}</span></span>}
                            </div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className={darkMode ? 'bg-gray-800/50' : 'bg-gray-50'}>
                                  <th className={`px-3 py-2 text-left font-semibold border-b ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`}>Column</th>
                                  <th className={`px-3 py-2 text-left font-semibold border-b ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`}>Type</th>
                                  <th className={`px-3 py-2 text-left font-semibold border-b ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`}>Description</th>
                                  <th className={`px-3 py-2 text-left font-semibold border-b ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`}>Constraints</th>
                                </tr>
                              </thead>
                              <tbody>
                                {columns.filter((c: any) => c.name).map((col: any, cIdx: number) => (
                                  <tr key={cIdx} className={cIdx % 2 === 0 ? '' : (darkMode ? 'bg-gray-800/30' : 'bg-gray-50/50')}>
                                    <td className={`px-3 py-2 font-mono font-semibold border-b ${darkMode ? 'border-gray-700/50 text-gray-200' : 'border-gray-100 text-gray-900'}`}>{col.name}</td>
                                    <td className={`px-3 py-2 font-mono border-b ${darkMode ? 'border-gray-700/50 text-blue-400' : 'border-gray-100 text-blue-600'}`}>{col.type}</td>
                                    <td className={`px-3 py-2 border-b ${darkMode ? 'border-gray-700/50 text-gray-400' : 'border-gray-100 text-gray-600'}`}>{col.description || '—'}</td>
                                    <td className={`px-3 py-2 border-b ${darkMode ? 'border-gray-700/50 text-gray-500' : 'border-gray-100 text-gray-500'}`}>{col.constraints || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {note && <div className={`px-2 py-1 text-[10px] italic border-t ${darkMode ? 'border-gray-700 text-gray-500 bg-gray-800/30' : 'border-gray-100 text-gray-500 bg-gray-50/50'}`}>📝 {note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Image Carousel - Opens in Left Panel */}
            {imageCarouselOpen && carouselImages.length > 0 && (
              <div className={`absolute inset-0 z-[100] flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`} onClick={() => setImageCarouselOpen(false)}>
                <div className="relative w-full h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                    <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'}`}>
                      {currentImageIndex + 1} / {carouselImages.length}
                    </div>
                    <button onClick={() => setImageCarouselOpen(false)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`} title="Close (Esc)">
                      <FontAwesomeIcon icon={faXmark} />
                      <span>Close</span>
                    </button>
                  </div>
                  <div className={`flex-1 relative overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                      <img src={carouselImages[currentImageIndex]} alt={`Question Image ${currentImageIndex + 1}`} className="w-full h-full object-contain" />
                    </div>
                    {carouselImages.length > 1 && (
                      <>
                        <button onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1))} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110" title="Previous (←)">
                          <FontAwesomeIcon icon={faChevronLeft} size="lg" />
                        </button>
                        <button onClick={() => setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1))} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110" title="Next (→)">
                          <FontAwesomeIcon icon={faChevronRight} size="lg" />
                        </button>
                        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                          <div className="flex items-center justify-center space-x-2 overflow-x-auto">
                            {carouselImages.map((img, idx) => (
                              <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border transition-all ${idx === currentImageIndex ? 'border-white scale-110 shadow-lg' : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'}`}>
                                <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Answer Section */}
          <div className={`border-l ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} flex flex-col relative overflow-hidden`} style={{ width: `${100 - leftPanelWidth}%`, minWidth: '400px' }}>
            {/* Resize handle on the left border */}
            <div
              onMouseDown={handleHorizontalResizeStart}
              className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group flex items-center justify-center"
              style={{ marginLeft: '-4px' }}
              title="Drag to resize panels"
            >
              <div className="flex flex-col gap-[4px]">
                <div className={`w-[4px] h-[4px] rounded-full transition-colors group-hover:bg-blue-500 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
                <div className={`w-[4px] h-[4px] rounded-full transition-colors group-hover:bg-blue-500 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
                <div className={`w-[4px] h-[4px] rounded-full transition-colors group-hover:bg-blue-500 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
              </div>
            </div>
            {renderAnswerSection()}
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className={`px-6 py-3 border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'} flex items-center justify-between`}>
          {/* Status Indicators with Colored Checkboxes */}
          <div className="flex items-center space-x-6 text-sm">
            {/* 3-Dot Menu Icon */}
            <button 
              onClick={() => setShowExamInfoDialog(true)}
              className={`flex items-center justify-center w-8 h-8 rounded-full border ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-200'} transition-colors`}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
            </button>

            {/* Not Viewed Checkbox - Gray */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border border-gray-400 appearance-none cursor-pointer bg-gray-300 checked:bg-gray-400"
                  checked={showNotViewed}
                  onChange={(e) => setShowNotViewed(e.target.checked)}
                />
                {showNotViewed && (
                  <svg className="w-4 h-4 absolute top-0 left-0 pointer-events-none text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </div>
              <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Not Viewed: {stats.notViewed}/{phaseQuestions.length}</span>
            </label>

            {/* Answered Checkbox - Green */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border border-green-500 appearance-none cursor-pointer bg-green-500 checked:bg-green-600"
                  checked={showAnswered}
                  onChange={(e) => setShowAnswered(e.target.checked)}
                />
                {showAnswered && (
                  <svg className="w-4 h-4 absolute top-0 left-0 pointer-events-none text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </div>
              <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Answered: {stats.answered}/{phaseQuestions.length}</span>
            </label>

            {/* Bookmarked Checkbox - Purple */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border border-purple-500 appearance-none cursor-pointer bg-purple-500 checked:bg-purple-600"
                  checked={showBookmarked}
                  onChange={(e) => setShowBookmarked(e.target.checked)}
                />
                {showBookmarked && (
                  <svg className="w-4 h-4 absolute top-0 left-0 pointer-events-none text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </div>
              <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Bookmarked: {stats.bookmarked}/{phaseQuestions.length}</span>
            </label>

            {/* Skipped Checkbox - Orange */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border border-orange-400 appearance-none cursor-pointer bg-orange-400 checked:bg-orange-500"
                  checked={showSkipped}
                  onChange={(e) => setShowSkipped(e.target.checked)}
                />
                {showSkipped && (
                  <svg className="w-4 h-4 absolute top-0 left-0 pointer-events-none text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </div>
              <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Skipped: {stats.skipped}/{phaseQuestions.length}</span>
            </label>
          </div>

          {/* Right Side - Internet Status, Dark Mode, Progress, Timer */}
          <div className="flex items-center space-x-6">
            {/* Internet Connectivity Indicator */}
            <div className="flex items-center space-x-2">
              {/* Activity Monitor Icon */}
              <button
                onClick={() => setShowActivityMonitorDialog(true)}
                className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-blue-400 hover:text-blue-300' 
                    : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'
                }`}
                title="View Activity Monitor"
              >
                <FontAwesomeIcon icon={faChartLine} className="w-4 h-4" />
              </button>
              
              <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse-green' : 'bg-red-500'}`}></div>
              <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {/* Enhanced Queue Status */}
              {syncStatus.queueLength > 0 && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  darkMode ? 'bg-yellow-800 text-yellow-200' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {syncStatus.isSyncing ? 'Syncing' : 'Queued'} {syncStatus.queueLength}
                </span>
              )}
              {/* Old queue display for compatibility */}
              {offlineEventQueue.length > 0 && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  darkMode ? 'bg-orange-800 text-orange-200' : 'bg-orange-100 text-orange-800'
                }`}>
                  {offlineEventQueue.length} queued
                </span>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
                darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
              <span className="text-xs font-medium">{darkMode ? 'Light' : 'Dark'}</span>
            </button>

            {/* Progress */}
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Progress: {progress}%
              </span>
              <div className="w-32 h-2 bg-gray-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon 
                icon={faHourglass} 
                className={`${(examPhase === 'likert' ? likertTimeLeft : timeLeft) < 300 ? 'text-red-500' : darkMode ? 'text-green-400' : 'text-green-600'}`}
              />
              <span className={`text-xs font-bold ${(examPhase === 'likert' ? likertTimeLeft : timeLeft) < 300 ? 'text-red-500' : darkMode ? 'text-green-400' : 'text-green-600'}`}>
                Time Left: {formatTime(examPhase === 'likert' ? likertTimeLeft : timeLeft)}
              </span>
            </div>


            {/* TEMPORARY DEBUG - ALWAYS VISIBLE */}
            {/* Completion Policy Indicator */}
            {completionPolicy && completionPolicy === 'flexible' && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                darkMode 
                  ? 'bg-green-900 border border-green-700 text-green-300'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}>
                <FontAwesomeIcon icon={faHourglass} className={darkMode ? 'text-green-400' : 'text-green-600'} />
                <span className="font-medium">Flexible Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exam Info Dialog */}
      {showExamInfoDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onContextMenu={e => e.preventDefault()}>
          <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col relative z-10`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between sticky top-0 z-20 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex-1">
                <h3 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {examTitle}
                </h3>
                <p className={`text-xs font-medium mt-0.5 ${examPhase === 'likert' ? 'text-purple-500' : 'text-blue-500'}`}>
                  {examPhase === 'likert' ? '🧠 Personality Assessment Phase' : '📝 Actual Exam Phase'}
                </p>
              </div>
              <button 
                onClick={() => setShowExamInfoDialog(false)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'} transition-colors`}
              >
                <FontAwesomeIcon icon={faXmark} className="text-xl" />
              </button>
            </div>

            {/* Exam Statistics */}
            <div className={`mx-6 my-4 px-8 py-4 rounded-lg ${darkMode ? 'bg-gray-750' : 'bg-gray-50'}`}>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Max Marks</p>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {phaseQuestions.reduce((sum, q) => sum + q.maxMarks, 0)}
                  </p>
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Questions</p>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {phaseQuestions.length}
                  </p>
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Duration</p>
                  <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {examPhase === 'likert' ? likertDurationMins : duration} min
                  </p>
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Time Remaining</p>
                  <p className={`text-lg font-bold ${(examPhase === 'likert' ? likertTimeLeft : timeLeft) < 300 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatTime(examPhase === 'likert' ? likertTimeLeft : timeLeft)}
                  </p>
                </div>
              </div>

            </div>

            {/* Search Box */}
            <div className="px-6 py-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className={`w-full px-4 py-3 pr-10 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
                <FontAwesomeIcon 
                  icon={faCircleInfo} 
                  className={`absolute right-4 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}
                />
              </div>
            </div>

            {/* Chapter Filter Dropdown - Dynamic based on question complexity */}
            <div className="px-6 pb-4">
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="All Questions">All Questions</option>
                {/* Generate options dynamically based on available question types and complexity */}
                {Array.from(new Set(phaseQuestions.map(q => q.type))).sort().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="---" disabled>────────</option>
                {Array.from(new Set(phaseQuestions.map(q => q.complexity))).sort().map(complexity => (
                  <option key={complexity} value={complexity}>{complexity}</option>
                ))}
              </select>
            </div>

            {/* Questions List */}
            <div className={`flex-1 overflow-y-auto px-6 pb-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
              <div className="space-y-2">
                {phaseQuestions
                  .filter(q => {
                    // Search filter
                    const matchesSearch = searchQuery === '' || 
                     q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      q.description.toLowerCase().includes(searchQuery.toLowerCase());
                    
                    // Chapter/Type/Complexity filter
                    const matchesChapter = selectedChapter === 'All Questions' ||
                      q.type === selectedChapter ||
                      q.complexity === selectedChapter;
                    
                    return matchesSearch && matchesChapter;
                  })
                  .map((question) => {
                    const actualIndex = questions.findIndex(q => q.id === question.id);
                    return (
                    <button
                      key={question.id}
                      onClick={() => {
                        handleQuestionClick(actualIndex);
                        setShowExamInfoDialog(false);
                      }}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        currentQuestionIndex === actualIndex
                          ? darkMode
                            ? 'bg-blue-900/20 border-blue-500'
                            : 'bg-blue-50 border-blue-500'
                          : darkMode
                          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Header Row with Question Number, Type, and Status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`font-bold text-sm ${
                            currentQuestionIndex === actualIndex
                              ? 'text-blue-500'
                              : darkMode
                              ? 'text-gray-400'
                              : 'text-gray-600'
                          }`}>
                            Q{examPhase === 'likert' ? question.questionNo : question.questionNo - likertOnlyQuestions.length} -
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {question.type === QUESTION_TYPES.LIKERT ? 'Personality Assessment' : (QUESTION_TYPE_LABELS[question.type] || question.type)} • {question.maxMarks} mark{question.maxMarks !== 1 ? 's' : ''}
                          </span>
                          {/* Complexity Badge */}
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                             question.complexity === 'easy' ? 'bg-green-100 text-green-700' :
                             question.complexity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                             question.complexity === 'hard' ? 'bg-red-100 text-red-700' :
                            darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {question.complexity || 'Easy'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {answers[question.id] && (
                            <span className="flex items-center space-x-1 text-green-500 text-xs">
                              <FontAwesomeIcon icon={faCircleCheck} />
                              <span>Answered</span>
                            </span>
                          )}
                          {bookmarkedQuestions.has(question.id) && (
                            <span className="text-purple-500 text-sm">
                              <FontAwesomeIcon icon={faBookmark} />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Question Text with HTML Rendering */}
                      <div 
                        className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}
                          [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1 [&_h2]:${darkMode ? 'text-white' : 'text-gray-900'}
                          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1
                          [&_p]:text-sm [&_p]:mb-1 [&_p]:leading-relaxed
                          [&_strong]:font-semibold [&_strong]:${darkMode ? 'text-blue-400' : 'text-blue-600'}
                          [&_code]:${darkMode ? 'bg-gray-700' : 'bg-gray-200'} [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:${darkMode ? 'text-green-400' : 'text-green-700'}
                          [&_pre]:${darkMode ? 'bg-gray-800' : 'bg-gray-100'} [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:my-1
                          [&_pre_code]:bg-transparent [&_pre_code]:p-0
                          [&_br]:block [&_br]:my-1
                          max-h-24 overflow-hidden`}
                        dangerouslySetInnerHTML={{ __html: question.questionText }}
                        style={{
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      />
                    </button>
                  ); })}
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowExamInfoDialog(false)}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language Switch Confirmation Dialog */}
      {langSwitchConfirm && (() => {
        const langLabels: Record<string, string> = {
          cpp: 'C++', c: 'C', java: 'Java', python: 'Python',
          javascript: 'JavaScript', typescript: 'TypeScript',
          csharp: 'C#', go: 'Go', rust: 'Rust', ruby: 'Ruby',
          kotlin: 'Kotlin', swift: 'Swift', sql: 'SQL'
        };
        const langLabel = langLabels[langSwitchConfirm.newLang] || langSwitchConfirm.newLang;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10000] p-4">
            <div className={`rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all ${
              darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}>
              <div className={`px-5 py-4 border-b ${
                darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-amber-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    darkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <FontAwesomeIcon icon={faCode} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Switch to {langLabel}?
                    </h3>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Language change
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Your current code will be replaced with the <span className="font-semibold">{langLabel}</span> starter code. This action cannot be undone.
                </p>
              </div>
              <div className={`px-5 py-3 flex justify-end space-x-2 border-t ${
                darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'
              }`}>
                <button
                  onClick={() => setLangSwitchConfirm(null)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    darkMode
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Keep Current
                </button>
                <button
                  onClick={() => {
                    setSelectedLanguage(langSwitchConfirm.newLang);
                    setCodeInput(langSwitchConfirm.starterCode);
                    if (editorRef.current) {
                      editorRef.current.setValue(langSwitchConfirm.starterCode);
                    }
                    codeInputRef.current = langSwitchConfirm.starterCode;
                    if (currentQuestion) {
                      initialCodeLengthRef.current[currentQuestion.id] = langSwitchConfirm.starterCode.length;
                    }
                    setLangSwitchConfirm(null);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    darkMode
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  Switch to {langLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Submit Confirmation Dialog */}
      {showSubmitDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4" onContextMenu={e => e.preventDefault()}>
          <div className={`rounded-lg shadow-2xl w-full max-w-md overflow-hidden ${
            darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}>
            {/* Header */}
            <div className={`px-5 py-3 border-b ${
              darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">
                    <FontAwesomeIcon 
                      icon={
                        submitStatus === SUBMIT_STATUS.SUCCESS ? faCircleCheck :
                        submitStatus === SUBMIT_STATUS.ERROR ? faCircleInfo :
                        faPaperPlane
                      } 
                      className={
                        submitStatus === SUBMIT_STATUS.SUCCESS ? 'text-green-500' :
                        submitStatus === SUBMIT_STATUS.ERROR ? 'text-red-500' :
                        darkMode ? 'text-green-400' : 'text-blue-600'
                      } 
                    />
                  </span>
                  <div>
                    <h2 className={`text-base font-bold ${
                      submitStatus === SUBMIT_STATUS.SUCCESS ? 'text-green-500' :
                      submitStatus === SUBMIT_STATUS.ERROR ? 'text-red-500' :
                      darkMode ? 'text-green-400' : 'text-blue-600'
                    }`}>
                      {submitStatus === SUBMIT_STATUS.SUBMITTING ? 'Submitting Exam...' :
                       submitStatus === SUBMIT_STATUS.SUCCESS ? 'Submitted Successfully!' :
                       submitStatus === SUBMIT_STATUS.ERROR ? 'Submission Failed' :
                       'Submit Exam?'}
                    </h2>
                    <p className={`text-xs ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {submitStatus === SUBMIT_STATUS.SUBMITTING ? 'Please wait while we process your submission' :
                       submitStatus === SUBMIT_STATUS.SUCCESS ? 'Your exam has been submitted' :
                       submitStatus === SUBMIT_STATUS.ERROR ? 'An error occurred' :
                       'Review your submission details'}
                    </p>
                  </div>
                </div>
                {submitStatus === SUBMIT_STATUS.IDLE && (
                  <button
                    onClick={() => setShowSubmitDialog(false)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      darkMode 
                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                        : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* IDLE STATE - Show Summary */}
              {submitStatus === SUBMIT_STATUS.IDLE && (
                <>
                  {/* LIKERT PHASE BLOCK */}
                  {examPhase === 'likert' ? (
                    isLikertOnlyExam ? (
                      // Likert-only exam — allow submission
                      <>
                        <div className={`mb-5 p-3 rounded-lg ${
                          darkMode ? 'bg-orange-900/20 border border-orange-800' : 'bg-orange-50 border border-orange-200'
                        }`}>
                          <p className={`text-sm ${darkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                            ⚠️ Once submitted, you cannot make any changes to your answers. Please review before proceeding.
                          </p>
                        </div>
                        <div className="space-y-2.5 mb-5">
                          <div className={`flex justify-between items-center border-b pb-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex items-center space-x-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Questions Answered:</span>
                            </div>
                            <span className={`text-sm font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                              {stats.answered}/{likertOnlyQuestions.length}
                            </span>
                          </div>
                          <div className={`flex justify-between items-center border-b pb-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex items-center space-x-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Not Answered:</span>
                            </div>
                            <span className={`text-sm font-semibold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                              {likertOnlyQuestions.length - stats.answered}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                    // Likert phase with actual exam after — block submission
                    <div className="py-6 flex flex-col items-center text-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-blue-900/40' : 'bg-blue-50'}`}>
                        <span className="text-3xl">🧠</span>
                      </div>
                      <h3 className={`text-base font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Personality Assessment in Progress
                      </h3>
                      <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        You are currently in the <strong>Personality Assessment</strong> section. The actual exam has not started yet.
                      </p>
                      <div className={`w-full p-3 rounded-lg text-sm ${darkMode ? 'bg-yellow-900/20 border border-yellow-700 text-yellow-300' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
                        ⏳ Please complete the personality questions first. The exam will begin automatically once this section ends.
                      </div>
                    </div>
                    )
                  ) : (
                  <>
                  {/* Warning Message */}
                  <div className={`mb-5 p-3 rounded-lg ${
                    darkMode ? 'bg-orange-900/20 border border-orange-800' : 'bg-orange-50 border border-orange-200'
                  }`}>
                    <p className={`text-sm ${darkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                      ⚠️ Once submitted, you cannot make any changes to your answers. Please review before proceeding.
                    </p>
                  </div>

                  {/* Submission Summary */}
                  <div className="space-y-2.5 mb-5">
                    <div className={`flex justify-between items-center border-b pb-2 ${
                      darkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Questions Answered:</span>
                      </div>
                      <span className={`text-sm font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {stats.answered}/{phaseQuestions.length}
                      </span>
                    </div>

                    <div className={`flex justify-between items-center border-b pb-2 ${
                      darkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Not Answered:</span>
                      </div>
                      <span className={`text-sm font-semibold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                        {phaseQuestions.length - stats.answered}
                      </span>
                    </div>

                    <div className={`flex justify-between items-center border-b pb-2 ${
                      darkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Bookmarked:</span>
                      </div>
                      <span className={`text-sm font-semibold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        {stats.bookmarked}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Time Remaining:</span>
                      </div>
                      <span className={`text-sm font-semibold ${
                        timeLeft < 300 
                          ? 'text-red-500' 
                          : (darkMode ? 'text-blue-400' : 'text-blue-600')
                      }`}>
                        {formatTime(timeLeft)}
                      </span>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {(phaseQuestions.length - stats.answered) > 0 && (
                    <div className={`mb-5 p-3 rounded-lg ${
                      darkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start space-x-2">
                        <FontAwesomeIcon icon={faCircleInfo} className="text-red-500 mt-0.5 text-sm" />
                        <p className={`text-xs ${darkMode ? 'text-red-300' : 'text-red-800'}`}>
                          <strong>Note:</strong> You have {phaseQuestions.length - stats.answered} unanswered question{(phaseQuestions.length - stats.answered) > 1 ? 's' : ''}. These will be marked as incorrect.
                        </p>
                      </div>
                    </div>
                  )}
                  </>
                  )} {/* end examPhase ternary */}
                </>
              )}

              {/* SUBMITTING STATE - Show Loading Animation */}
              {submitStatus === SUBMIT_STATUS.SUBMITTING && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FontAwesomeIcon icon={faPaperPlane} className="text-blue-600 text-2xl" />
                    </div>
                  </div>
                  <p className={`mt-6 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Processing your submission...
                  </p>
                  <p className={`mt-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    This may take a few seconds
                  </p>
                </div>
              )}

              {/* SUCCESS STATE - Show Success Message */}
              {submitStatus === SUBMIT_STATUS.SUCCESS && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4 animate-bounce">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-green-600 text-5xl" />
                  </div>
                  <h3 className="text-xl font-bold text-green-600 mb-2">Exam Submitted Successfully!</h3>
                  <p className={`text-sm text-center mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Your exam has been submitted and is being evaluated.
                  </p>
                  <p className={`text-xs text-center mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Results will be available shortly. Check your dashboard.
                  </p>
                  <button
                    onClick={() => {
                      setShowSubmitDialog(false);
                      setSubmitStatus(SUBMIT_STATUS.IDLE);
                      if (submittedAttemptData.current) {
                        onSubmitExam(submittedAttemptData.current);
                      }
                    }}
                    className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Go to Home
                  </button>
                </div>
              )}

              {/* ERROR STATE - Show Error Message */}
              {submitStatus === SUBMIT_STATUS.ERROR && (
                <div className="py-8">
                  <div className="flex flex-col items-center justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
                      <FontAwesomeIcon icon={faCircleInfo} className="text-red-600 text-5xl" />
                    </div>
                    <h3 className="text-xl font-bold text-red-600 mb-2">Submission Failed</h3>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    darkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-800'}`}>
                      {submitMessage}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-5 py-4 border-t flex items-center justify-end space-x-3 ${
              darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              {submitStatus === SUBMIT_STATUS.IDLE && (
                <>
                  <button
                    onClick={() => setShowSubmitDialog(false)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 text-white hover:bg-gray-600' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {examPhase === 'likert' && !isLikertOnlyExam ? 'Close' : 'Cancel'}
                  </button>
                  {(examPhase !== 'likert' || isLikertOnlyExam) && (
                  <button
                    onClick={handleSubmitExam}
                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    Submit
                  </button>
                  )}
                </>
              )}
              {submitStatus === SUBMIT_STATUS.ERROR && (
                <>
                  <button
                    onClick={() => {
                      setShowSubmitDialog(false);
                      setSubmitStatus(SUBMIT_STATUS.IDLE);
                      setSubmitMessage('');
                    }}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 text-white hover:bg-gray-600' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Close
                  </button>
                  {submitMessage.includes('preview mode') ? (
                    <button
                      onClick={onExitExam}
                      className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSubmitStatus(SUBMIT_STATUS.IDLE);
                        setSubmitMessage('');
                      }}
                      className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      Try Again
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Monitor Dialog */}
      {showActivityMonitorDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4" onContextMenu={e => e.preventDefault()}>
          <div className={`rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden ${
            darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}>
            {/* Header */}
            <div className={`px-5 py-3 border-b ${
              darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">📊</span>
                  <div>
                    <h2 className={`text-base font-bold ${
                      darkMode ? 'text-green-400' : 'text-blue-600'
                    }`}>Activity Monitor</h2>
                    <p className={`text-xs ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Real-time exam session tracking</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowActivityMonitorDialog(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    darkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                      : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[calc(85vh-130px)]">
              {/* Session Info */}
              <div className="space-y-2 mb-5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Exam Duration:</span>
                  </div>
                  <span className={`text-sm font-semibold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    {Math.floor((Date.now() - entryTimeRef.current.getTime()) / 1000)}s
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Questions Answered:</span>
                  </div>
                  <span className={`text-sm font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {Object.keys(answers).length}/{phaseQuestions.length}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${violations.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Violations:</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    violations.length >= MAX_VIOLATIONS 
                      ? 'text-red-600 dark:text-red-400'
                      : violations.length >= MAX_VIOLATIONS - 25
                      ? 'text-orange-600 dark:text-orange-400'
                      : violations.length > 0 
                      ? (darkMode ? 'text-red-400' : 'text-red-600') 
                      : (darkMode ? 'text-green-400' : 'text-green-600')
                  }`}>
                    {violations.length}/{MAX_VIOLATIONS}
                    {violations.filter(v => v.severity === 'critical').length > 0 && (
                      <span className="ml-2 text-xs">
                        ({violations.filter(v => v.severity === 'critical').length} critical)
                      </span>
                    )}
                    {violations.length >= MAX_VIOLATIONS && (
                      <span className="ml-2 text-xs font-normal">
                        (LIMIT REACHED)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Connection Status:</span>
                  </div>
                  <span className={`text-sm font-semibold flex items-center space-x-2 ${
                    isOnline 
                      ? (darkMode ? 'text-green-400' : 'text-green-600') 
                      : (darkMode ? 'text-amber-400' : 'text-amber-600')
                  }`}>
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      isOnline 
                        ? (darkMode ? 'bg-green-400' : 'bg-green-500') + ' animate-pulse' 
                        : (darkMode ? 'bg-red-400' : 'bg-red-500')
                    }`}></span>
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>IP Address:</span>
                  </div>
                  <span className={`font-mono text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {currentIpAddress || 'Detecting...'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${isMonitoringActive ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Monitoring Status:</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    isMonitoringActive 
                      ? (darkMode ? 'text-green-400' : 'text-green-600') 
                      : (darkMode ? 'text-red-400' : 'text-red-600')
                  }`}>
                    {isMonitoringActive ? '✓ Active' : '✗ Inactive'}
                  </span>
                </div>
              </div>

              {/* Violations List */}
              {violations.length > 0 && (
                <div className={`mt-5 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className={`text-sm font-bold mb-3 flex items-center space-x-2 ${
                    darkMode ? 'text-red-400' : 'text-red-600'
                  }`}>
                    <span>⚠️</span>
                    <span>Recent Violations</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {[...violations].reverse().map((violation, index) => (
                      <div 
                        key={index} 
                        className={`rounded-lg p-2.5 border transition-colors ${
                          darkMode 
                            ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                              violation.severity === 'critical' ? 'bg-red-500' :
                              violation.severity === 'high' ? 'bg-orange-500' :
                              violation.severity === 'medium' ? 'bg-yellow-500' :
                              'bg-blue-500'
                            }`}></span>
                            <span className={`text-xs font-medium ${
                              darkMode ? 'text-gray-200' : 'text-gray-800'
                            }`}>
                              {violation.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            violation.severity === 'critical' 
                              ? (darkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700') :
                            violation.severity === 'high' 
                              ? (darkMode ? 'bg-orange-900/50 text-orange-400' : 'bg-orange-100 text-orange-700') :
                            violation.severity === 'medium' 
                              ? (darkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700') :
                            (darkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700')
                          }`}>
                            {violation.severity}
                          </span>
                        </div>
                        <div className={`text-xs ml-3.5 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {violation.details}
                        </div>
                        <div className={`text-xs ml-3.5 mt-0.5 ${
                          darkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {formatViolationTime(violation.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {violations.length === 0 && (
                <div className={`mt-5 pt-4 border-t text-center py-6 ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className="text-3xl mb-2">✅</div>
                  <p className={`text-xs font-medium ${
                    darkMode ? 'text-green-400' : 'text-green-600'
                  }`}>No violations detected</p>
                  <p className={`text-xs mt-1 ${
                    darkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>Keep up the good work!</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t flex items-center justify-between ${
              darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className={`text-xs flex items-center space-x-2 ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {isMonitoringActive && (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        darkMode ? 'bg-green-400' : 'bg-green-500'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        darkMode ? 'bg-green-500' : 'bg-green-600'
                      }`}></span>
                    </span>
                    <span>Actively monitoring your exam session</span>
                  </>
                )}
                {!isMonitoringActive && <span>Monitoring is currently inactive</span>}
              </div>
              <button
                onClick={() => setShowActivityMonitorDialog(false)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Offline Submit Dialog */}
      {showOfflineSubmitDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4" onContextMenu={e => e.preventDefault()}>
          <div className={`rounded-2xl shadow-2xl max-w-md w-full mx-4 ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            {/* Icon Header */}
            <div className={`px-6 pt-6 pb-4 text-center`}>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-orange-100 mb-4">
                <svg className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Cannot Submit Exam Offline
              </h3>
            </div>

            {/* Content */}
            <div className="px-6 pb-4">
              <div className={`rounded-lg p-4 mb-4 ${
                darkMode ? 'bg-orange-900/20 border border-orange-800' : 'bg-orange-50 border border-orange-200'
              }`}>
                <p className={`text-sm leading-relaxed mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  You are currently offline. The exam cannot be submitted without an internet connection.
                </p>
                <div className={`flex items-start space-x-2 mb-3`}>
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <strong>All your answers are safely saved</strong> on this device and will be submitted automatically when your connection is restored.
                  </p>
                </div>
                <div className={`flex items-start space-x-2`}>
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Answers submitted <strong>during the exam time</strong> will be counted, even if you reconnect after the timer ends.
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className={`rounded-lg p-3 mb-4 ${
                darkMode ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Answers Saved:
                  </span>
                  <span className={`text-sm font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {Object.keys(answers).length} / {phaseQuestions.length}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Queued for Sync:
                  </span>
                  <span className={`text-sm font-bold ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                    {syncStatus.queueLength} answers
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Time Remaining:
                  </span>
                  <span className={`text-sm font-bold ${timeLeft < 300 ? 'text-red-500' : (darkMode ? 'text-blue-400' : 'text-blue-600')}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className={`p-3 rounded-lg ${
                darkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
              }`}>
                <p className={`text-sm font-semibold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  What to do:
                </p>
                <ol className={`text-sm space-y-1 list-decimal list-inside ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <li>Check your internet connection</li>
                  <li>Wait for the connection indicator to turn green</li>
                  <li>Click "Submit Exam" again</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-between ${
              darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
            }`}>
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {/* Close Button */}
              <button
                onClick={() => setShowOfflineSubmitDialog(false)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  darkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Cases Panel - CODE and SQL */}
      {currentQuestion && (currentQuestion.type === QUESTION_TYPES.CODE || currentQuestion.type === QUESTION_TYPES.SQL) && (
        <TestCasesPanel
          key={currentQuestion.id}
          isOpen={showTestCasesPanel}
          onClose={() => setShowTestCasesPanel(false)}
          testCases={visibleTestCases}
          code={codeInput}
          language={selectedLanguage}
          darkMode={darkMode}
          editorRef={editorRef}
          isSql={currentQuestion.type === QUESTION_TYPES.SQL}
          onRunSqlTestCase={currentQuestion.type === QUESTION_TYPES.SQL ? runSingleSqlTestCase : undefined}
        />
      )}

      {/* Phase Transition Overlay - Likert → Exam */}
      {showPhaseTransition && (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center z-[10002]" onContextMenu={e => e.preventDefault()}>
          <div className="text-center max-w-md px-6">
            {/* Trophy SVG */}
            <div className="mx-auto mb-6" style={{ width: 100, height: 100, animation: 'phaseFloat 3s ease-in-out infinite' }}>
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                <rect x="24" y="48" width="16" height="4" rx="2" fill="#fbbf24"/>
                <rect x="20" y="52" width="24" height="4" rx="2" fill="#f59e0b"/>
                <path d="M20 16h24v18c0 6.6-5.4 12-12 12s-12-5.4-12-12V16z" fill="#fbbf24"/>
                <path d="M32 16v30c6.6 0 12-5.4 12-12V16H32z" fill="#f59e0b"/>
                <path d="M20 20c-4 0-6 3-6 6s2 6 6 6" stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M44 20c4 0 6 3 6 6s-2 6-6 6" stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M25 22c2-1 5-1 7 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
                <path d="M32 24l1.5 4h4l-3 2.5 1.2 4L32 32l-3.7 2.5 1.2-4-3-2.5h4z" fill="#fff" opacity=".7"/>
                <circle cx="14" cy="12" r="2" fill="#f472b6"/>
                <rect x="48" y="10" width="4" height="4" rx="1" fill="#34d399" transform="rotate(20 48 10)"/>
                <circle cx="52" cy="36" r="1.5" fill="#60a5fa"/>
                <rect x="10" y="38" width="3" height="3" rx="1" fill="#a78bfa" transform="rotate(-15 10 38)"/>
              </svg>
            </div>
            <style>{`@keyframes phaseFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`}</style>

            <h2 className="text-2xl font-bold text-white mb-3">Personality Assessment Complete</h2>
            <p className="text-gray-300 mb-6">The personality section has ended. Your actual exam is starting now...</p>

            {/* Progress bar */}
            <div className="w-48 h-1.5 bg-gray-700 rounded-full mx-auto overflow-hidden mb-0">
              <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #f97316)',
                  animation: 'phaseGrow 60s linear forwards'
                }}
              />
            </div>
            <style>{`@keyframes phaseGrow { from { width: 0%; } to { width: 100%; } }`}</style>

            {/* Wait + countdown */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <p className="text-gray-500 text-sm">Please wait...</p>
              <p className="text-sm font-bold" style={{ background: 'linear-gradient(90deg, #fbbf24, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {phaseTransitionCount}s
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Time Expired Overlay */}
      {showTimeExpiredOverlay && (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center z-[10001]" onContextMenu={e => e.preventDefault()}>
          <div className="text-center max-w-2xl px-6">
            {/* Animated Clock Icon */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full opacity-20 animate-ping"></div>
                <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-2xl">
                  <FontAwesomeIcon icon={faClock} className="text-white text-6xl" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-5xl font-bold text-white mb-4">
              Time's Up!
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl text-gray-300 mb-8">
              The exam duration has ended
            </p>

            {/* Info Box */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FontAwesomeIcon icon={faCircleInfo} className="text-blue-400 text-xl" />
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Your exam time has expired
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed mb-3">
                    {autoSubmitTriggered.current 
                      ? "Your exam has been automatically submitted. Click the button below to return to the overview."
                      : "All your answers have been saved automatically during the exam. Click the button below to submit your exam and return to the overview."
                    }
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                    <FontAwesomeIcon icon={faCircleInfo} />
                    <span>Please read this message carefully before proceeding</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {stats.answered}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  Answered
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-300 mb-1">
                  {phaseQuestions.length}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  Total Questions
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-400 mb-1">
                  {formatTime(0)}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  Time Remaining
                </div>
              </div>
            </div>

            {/* Submission Progress Indicator */}
            {isSubmittingFromOverlay && (
              <div className="mb-6 bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-300 mb-1">
                      Submitting your exam...
                    </p>
                    <p className="text-xs text-blue-400">
                      This may take a few moments. Please do not close this window.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Exit Button */}
            <button
              onClick={async () => {
                // Prevent multiple clicks
                if (isSubmittingFromOverlay) return;
                
                // console.log('🔵 Setting loading state to TRUE');
                // Set loading state and wait for React to render it
                setIsSubmittingFromOverlay(true);
                
                // Force React to render the loading state before continuing
                await new Promise(resolve => setTimeout(resolve, 100));
                // console.log('🔵 Loading state should be visible now');
                
                try {
                  // If auto-submit already happened, just exit with the stored data
                  if (autoSubmitTriggered.current) {
                    // console.log('⏰ Auto-submit already completed - Navigating to overview...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Use the stored attempt data if available, otherwise just call onSubmitExam with null
                    // Never call onExitExam after auto-submit - exam is already submitted!
                    if (submittedAttemptData.current) {
                      // console.log('✅ Using stored attempt data from auto-submit');
                      onSubmitExam(submittedAttemptData.current);
                    } else {
                      // console.log('⚠️ No stored attempt data, but exam was auto-submitted - calling onSubmitExam with null');
                      onSubmitExam(null);
                    }
                  }
                  // Otherwise submit exam when user clicks exit
                  else if (questions.length > 0 && attempt?.attemptId && isOnline) {
                    // console.log('⏰ User clicked exit - Submitting exam...');
                    
                    // Add minimum display time for loading state
                    const submitPromise = handleSubmitExam();
                    const minDisplayTime = new Promise(resolve => setTimeout(resolve, 1000));
                    
                    await Promise.all([submitPromise, minDisplayTime]);
                    // console.log('🔵 Submission complete');
                    // Keep loading state visible while navigation happens
                  } else if (!isOnline) {
                    // console.log('⏰ Offline - Showing offline dialog');
                    setIsSubmittingFromOverlay(false);
                    setShowOfflineSubmitDialog(true);
                    setShowTimeExpiredOverlay(false);
                  } else {
                    // No submission needed, just exit
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    onExitExam();
                  }
                } catch (error) {
                  console.error('Error submitting exam:', error);
                  setIsSubmittingFromOverlay(false);
                }
              }}
              disabled={isSubmittingFromOverlay}
              className={`px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-lg font-semibold rounded-xl shadow-2xl transition-all flex items-center justify-center mx-auto space-x-2 ${
                isSubmittingFromOverlay 
                  ? 'opacity-75 cursor-not-allowed' 
                  : 'transform hover:scale-105 active:scale-95'
              }`}
            >
              {isSubmittingFromOverlay ? (
                <>
                  <div className="w-5 h-5 border border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{autoSubmitTriggered.current ? 'Exiting...' : 'Submitting Exam...'}</span>
                </>
              ) : (
                <>
                  <span>{autoSubmitTriggered.current ? 'Exit to Overview' : 'Submit Exam & Exit'}</span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </>
              )}
            </button>
            
            <p className="text-xs text-gray-400 mt-4">
              {isSubmittingFromOverlay 
                ? (autoSubmitTriggered.current ? 'Please wait...' : 'Please wait while we submit your exam...')
                : (autoSubmitTriggered.current 
                    ? 'Your exam has been submitted. Click above to view your results.' 
                    : 'Your exam will be submitted when you click the button above')}
            </p>
          </div>
        </div>
      )}

      {/* 15-Minute Warning Dialog */}
      {show15MinWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4" onContextMenu={e => e.preventDefault()}>
          <div className={`rounded-lg shadow-2xl w-full max-w-md overflow-hidden ${
            darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}>
            {/* Header */}
            <div className={`px-5 py-3 border-b ${
              darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gradient-to-r from-orange-50 to-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">
                    <FontAwesomeIcon 
                      icon={faClock} 
                      className="text-orange-500 animate-pulse"
                    />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-orange-600">
                      Time Warning!
                    </h2>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      15 minutes remaining
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShow15MinWarning(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    darkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                      : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* Warning Icon */}
              <div className="flex flex-col items-center justify-center mb-5">
                <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-4 animate-bounce">
                  <FontAwesomeIcon icon={faClock} className="text-orange-600 text-4xl" />
                </div>
                <h3 className="text-lg font-bold text-orange-600 mb-2">Only 15 Minutes Left!</h3>
              </div>

              {/* Warning Message */}
              <div className={`mb-4 p-4 rounded-lg ${
                darkMode ? 'bg-orange-900/20 border border-orange-800' : 'bg-orange-50 border border-orange-200'
              }`}>
                <p className={`text-sm leading-relaxed ${darkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                  ⚠️ Your exam will automatically submit when the time expires. Please review and complete any remaining questions.
                </p>
              </div>

              {/* Current Status */}
              <div className="space-y-2.5 mb-4">
                <div className={`flex justify-between items-center border-b pb-2 ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Questions Answered:</span>
                  </div>
                  <span className={`text-sm font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {stats.answered}/{phaseQuestions.length}
                  </span>
                </div>

                <div className={`flex justify-between items-center border-b pb-2 ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Not Answered:</span>
                  </div>
                  <span className={`text-sm font-semibold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                    {phaseQuestions.length - stats.answered}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Time Remaining:</span>
                  </div>
                  <span className="text-sm font-semibold text-orange-600">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {/* Additional Notice */}
              {(phaseQuestions.length - stats.answered) > 0 && (
                <div className={`p-3 rounded-lg ${
                  darkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start space-x-2">
                    <FontAwesomeIcon icon={faCircleInfo} className="text-red-500 mt-0.5 text-sm" />
                    <p className={`text-xs ${darkMode ? 'text-red-300' : 'text-red-800'}`}>
                      <strong>Reminder:</strong> You still have {phaseQuestions.length - stats.answered} unanswered question{(phaseQuestions.length - stats.answered) > 1 ? 's' : ''}. Make sure to answer them before time runs out!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-5 py-4 border-t flex items-center justify-end ${
              darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <button
                onClick={() => setShow15MinWarning(false)}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                  darkMode 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                Continue Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 FULLSCREEN RE-ENTRY OVERLAY — blocks exam until student returns to fullscreen */}
      {showFullscreenOverlay && isMonitoringActive && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[10003]"
          onContextMenu={e => e.preventDefault()}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-5">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Fullscreen Required</h3>
                  <p className="text-white/80 text-sm">Exam cannot continue without fullscreen</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-600 text-sm mb-1">
                You have exited fullscreen mode. This has been recorded as a violation.
              </p>
              <p className="text-gray-600 text-sm mb-5">
                Please return to fullscreen to continue your exam.
              </p>
              <button
                onClick={async () => {
                  try {
                    const elem = document.documentElement;
                    if (elem.requestFullscreen) {
                      await elem.requestFullscreen();
                    } else if ((elem as any).webkitRequestFullscreen) {
                      await (elem as any).webkitRequestFullscreen();
                    } else if ((elem as any).msRequestFullscreen) {
                      await (elem as any).msRequestFullscreen();
                    }
                    setShowFullscreenOverlay(false);
                  } catch (err) {
                    // console.warn('⚠️ Failed to re-enter fullscreen:', err);
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold rounded-xl hover:from-red-600 hover:to-orange-600 transition-all shadow-lg"
              >
                Return to Fullscreen
              </button>
              <p className="text-xs text-gray-400 text-center mt-3">
                ⚠️ This violation has been logged and will be visible to your examiner
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ⛔ DevTools Detected Overlay — blocks entire exam UI */}
      {showDevToolsOverlay && isMonitoringActive && (
        <div 
          className="fixed inset-0 bg-black flex items-center justify-center z-[10004]"
          onContextMenu={e => e.preventDefault()}
        >
          <div className="text-center px-8 max-w-2xl">
            <div className="text-8xl mb-6">⛔</div>
            <h1 className="text-red-500 text-5xl font-black mb-4 tracking-tight">
              DEVTOOLS PROHIBITED
            </h1>
            <p className="text-red-400 text-2xl font-bold mb-6">
              Developer Tools usage is STRICTLY PROHIBITED during exams
            </p>
            <div className="bg-red-950 border-2 border-red-600 rounded-xl p-6 mb-6">
              <p className="text-red-300 text-lg mb-2">
                ⚠️ This violation has been recorded and reported to your examiner.
              </p>
              <p className="text-red-400 text-base">
                If DevTools is docked, close it to continue. This warning will auto-dismiss.
              </p>
            </div>
            <p className="text-gray-500 text-sm">
              Your exam content is hidden while this warning is displayed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamsInterface;