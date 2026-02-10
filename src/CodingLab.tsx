import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { firebaseService } from './services/firebase_service';
import { judge0Service } from './services/judge0_service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faPenField,
  faDiagramProject,
  faLightbulb,
  faCheck,
  faGearComplexCode,
  faClock,
  faMicrochip,
  faLayerGroup,
  faTriangleExclamation,
  faBuilding,
  faEye,
  faFire,
  faThumbsUp,
  faCircleXmark,
  faHexagonNodes,
  faRobot,
  faChartLine,
  faListCheck,
  faStairs,
  faCode,
  faPlay,
  faCircleInfo,
  faWrench,
  faWandMagicSparkles,
  faPenToSquare,
  faCircleQuestion,
  faCopy,
  faPaste,
  faExpand,
  faTerminal,
  faKeyboard,
  faClipboardList,
  faRotate,
  faInfo,
  faMinus,
  faPlus,
  faCompress,
  faXmark,
  faTrash,
  faArrowUp
} from '@fortawesome/sharp-light-svg-icons';

// ==================== CONSTANTS ====================
// Using judge0Service for code execution and firebaseService.chatWithAI for AI assistant

const LANGUAGE_CONFIG = [
  { id: 'c', name: 'C', extension: 'c' },
  { id: 'cpp', name: 'C++', extension: 'cpp' },
  { id: 'java', name: 'Java', extension: 'java' },
  { id: 'python', name: 'Python', extension: 'py' },
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'go', name: 'Go', extension: 'go' },
];

// ==================== TYPES ====================
interface TestCase {
  id: number;
  params: Record<string, string>;
  expected_output: string;
  explanation?: string;
}

interface Example {
  input: Record<string, string>;
  output: string;
  explanation?: string;
}

interface Approach {
  name: string;
  description: string;
  complexity: {
    time: string;
    space: string;
    timeExplain?: string;
    spaceExplain?: string;
  };
  code: Record<string, string>;
  isOptimal?: boolean;
  icon?: string;
  summary?: string;
  steps?: string[];
  pros?: string[];
  cons?: string[];
  visualization?: {
    title?: string;
    description?: string;
    svg?: string;
    steps?: { stepNumber: number; title: string; description: string }[];
  };
}

interface Analogy {
  icon: string;
  title: string;
  description: string;  // scenario/description from database
  keyInsight: string;
  // Dynamic approach fields - can have any combination
  approaches: { key: string; label: string; content: string }[];
}

interface Company {
  name: string;
  logo?: string;
  count?: number;
}

interface RelatedProblem {
  title: string;
  slug: string;
  difficulty: string;
}

interface ProblemData {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  examples: Example[];
  testCases: TestCase[];
  constraints: string[];
  companies: Company[];
  approaches: Record<string, Approach>;
  analogy: Analogy;
  hints: string[];
  params: { name: string; type: string }[];
  paramOrder?: string[];
  defaultCode: Record<string, string>;
  relatedProblems: RelatedProblem[];
  views: number;
  likes: number;
  frequency: string;
  avgTime: string;
  isSql?: boolean;
  tableSchema?: any; // Table schema(s) for SQL problems - single object or array
  // Problem visualization (separate from analogy)
  visualize?: {
    title?: string;
    description?: string;
    svg?: string;
    conclusion?: string;
    steps?: { stepNumber: number; title: string; description: string }[];
  };
}

interface CodingLabProps {
  brandTheme: {
    colors: {
      primary: string;
      secondary: string;
    };
    gradients: {
      primary: string;
    };
  };
  currentUser?: any;
  onClose: () => void;
  problemSlug?: string;
}

interface TestResult {
  id: number;
  params: Record<string, string>;
  expected: string;
  actual: string;
  passed: boolean | null;
  error: string | null;
  time: string;
  memory: string;
  status: string;
  running: boolean;
  // SQL-specific fields
  sqlInput?: any;
  sqlExpectedOutput?: any;
  sqlActualHeaders?: string[];
  sqlActualRows?: any[];
}

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
 * Strip HTML tags from a string and return well-formatted plain text
 */
function stripHtml(html: string): string {
  if (!html) return '';
  
  // Replace block elements with newlines for better formatting
  let text = html
    // Add newlines before/after block elements
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Add bullet points for list items
    .replace(/<li[^>]*>/gi, '• ')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up excessive whitespace but preserve intentional line breaks
    .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs to single space
    .replace(/\n[ \t]+/g, '\n')  // Remove leading spaces on lines
    .replace(/[ \t]+\n/g, '\n')  // Remove trailing spaces on lines
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .trim();
  
  return text;
}

// ==================== FIREBASE SERVICE ====================
    
/**
 * Transform Firebase problem data to CodingLab format
 */
function transformProblemData(data: any): ProblemData | null {
  if (!data) return null;

  try {
    // Transform examples from Firebase format
    const examples: Example[] = (data.examples || []).map((ex: any) => ({
      input: ex.input || {},
      output: ex.output || '',
      explanation: ex.explanation || ''
    }));

    // Detect SQL problem
    const isSql = (data.problemType === 'sql') || (data.category === 'Database') || !!data.tableSchema;

    // Transform test cases from Firebase format
    // For SQL problems: use examples as test cases (same as PHP template)
    let testCases: TestCase[];
    if (isSql) {
      testCases = (data.examples || []).map((ex: any, idx: number) => ({
        id: idx + 1,
        params: {},
        expected_output: '',
        explanation: typeof ex.explanation === 'object' ? JSON.stringify(ex.explanation) : String(ex.explanation ?? ''),
        // Store raw SQL data for table rendering
        _sqlInput: ex.input || {},
        _sqlExpectedOutput: ex.output || {}
      }));
    } else {
      testCases = (data.testCases || []).map((tc: any, idx: number) => {
        const params: Record<string, string> = {};
        if (tc.input) {
          // Use paramOrder from Firebase (same as PHP), fallback to sorted keys
          const paramOrder: string[] = data.paramOrder && data.paramOrder.length > 0
            ? data.paramOrder
            : Object.keys(tc.input).sort();
          paramOrder.forEach((k: string) => {
            if (k in tc.input) {
              const v = tc.input[k];
              params[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
            }
          });
          // Include any keys not in paramOrder
          Object.keys(tc.input).forEach((k: string) => {
            if (!(k in params)) {
              const v = tc.input[k];
              params[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
            }
          });
        }
        return {
          id: tc.id || idx + 1,
          params,
          expected_output: typeof tc.expected === 'object' ? JSON.stringify(tc.expected) : String(tc.expected ?? ''),
          explanation: typeof tc.explanation === 'object' ? JSON.stringify(tc.explanation) : String(tc.explanation ?? '')
        };
      });
    }

    // Transform approaches from Firebase format
    const approaches: Record<string, Approach> = {};
    if (data.approaches) {
      Object.entries(data.approaches).forEach(([key, value]: [string, any]) => {
        approaches[key] = {
          name: value.title || value.name || key,
          description: value.description || '',
          complexity: {
            time: value.complexity?.time || 'O(?)',
            space: value.complexity?.space || 'O(?)',
            timeExplain: value.complexity?.timeExplain || '',
            spaceExplain: value.complexity?.spaceExplain || ''
          },
          code: value.code || {},
          isOptimal: key === 'one-pass-hash' || key === 'optimal' || value.isOptimal,
          icon: value.icon || '',
          summary: value.summary || '',
          steps: value.steps || [],
          pros: value.pros || [],
          cons: value.cons || [],
          visualization: value.visualization ? {
            title: value.visualization.title || '',
            description: value.visualization.description || '',
            svg: value.visualization.svg || '',
            steps: value.visualization.steps || []
          } : undefined
        };
      });
    }

    // Transform analogy from Firebase format
    const analogyApproaches: { key: string; label: string; content: string }[] = [];
    
    if (data.analogy) {
      // Get approaches — Firebase may serialize arrays as objects {0: {...}, 1: {...}}
      const rawApproaches = data.analogy.approaches;
      const approachList = Array.isArray(rawApproaches)
        ? rawApproaches
        : (rawApproaches && typeof rawApproaches === 'object')
          ? Object.keys(rawApproaches).sort((a, b) => Number(a) - Number(b)).map(k => rawApproaches[k])
          : [];
      
      if (approachList.length > 0) {
        approachList.forEach((a: any, idx: number) => {
          if (a.label && a.content && a.content.trim() && a.content.trim().toLowerCase() !== 'n/a') {
            analogyApproaches.push({
              key: `approach-${idx}`,
              label: a.label,
              content: a.content
            });
          }
        });
      }
    }
    
    const analogy: Analogy = {
      icon: data.analogy?.icon || '💡',
      title: data.analogy?.title || 'Understanding the Problem',
      description: data.analogy?.description || data.analogy?.scenario || '',
      keyInsight: data.analogy?.keyInsight || '',
      approaches: analogyApproaches
    };

    // Transform companies
    const companies: Company[] = (data.companies || []).map((c: any) => ({
      name: c.name || '',
      logo: c.logo || c.name?.[0] || '?',
      count: c.count || 0
    }));

    // Transform related problems
    const relatedProblems: RelatedProblem[] = (data.related || []).map((r: any) => ({
      title: r.title || '',
      slug: r.id || r.slug || '',
      difficulty: r.difficulty || 'Medium'
    }));

    return {
      id: data.id || data.slug || '',
      title: data.title || '',
      slug: data.slug || data.id || '',
      description: data.description || data.descriptionText || '',
      difficulty: data.difficulty || data.level || 'Medium',
      tags: data.tags || [],
      examples,
      testCases,
      constraints: data.constraints || [],
      companies,
      approaches,
      analogy,
      hints: data.hints || [],
      params: data.params || [],
      paramOrder: data.paramOrder || [],
      defaultCode: data.defaultCode || {},
      relatedProblems,
      isSql,
      tableSchema: data.tableSchema || null,
      // Prioritize stats field values over root level values
      views: data.stats?.views || data.views || 0,
      likes: data.stats?.likes || data.likes || 0,
      frequency: data.stats?.frequency || data.frequency || 'Medium',
      avgTime: data.stats?.avgTime || data.avgTime || '~20 min',
      // Problem visualization (root level visualize field)
      visualize: data.visualize ? {
        title: data.visualize.title || '',
        description: data.visualize.description || '',
        svg: data.visualize.svg || '',
        conclusion: data.visualize.conclusion || '',
        steps: data.visualize.steps || []
      } : undefined
    };
  } catch (error) {
    console.error('Error transforming problem data:', error);
    return null;
  }
}

class CodingLabService {
  async getProblem(slug: string): Promise<ProblemData | null> {
    try {
      const data = await firebaseService.getCodingProblem(slug);
      return transformProblemData(data);
    } catch (error) {
      console.error('Error fetching problem:', error);
      return null;
    }
  }

  async checkLikeStatus(slug: string): Promise<boolean> {
    try {
      return await firebaseService.hasLikedProblem(slug);
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
  }

  async toggleLike(slug: string, currentlyLiked: boolean): Promise<{ success: boolean; liked: boolean; totalLikes: number }> {
    try {
      if (currentlyLiked) {
        const result = await firebaseService.unlikeCodingProblem(slug);
        return { success: result.success, liked: false, totalLikes: result.totalLikes };
      } else {
        const result = await firebaseService.likeCodingProblem(slug);
        return { success: result.success, liked: !result.alreadyLiked, totalLikes: result.totalLikes };
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      return { success: false, liked: currentlyLiked, totalLikes: 0 };
    }
  }

  async getStats(slug: string): Promise<{ views: number; likes: number; hasLiked: boolean }> {
    try {
      return await firebaseService.getProblemStats(slug);
    } catch (error) {
      console.error('Error getting stats:', error);
      return { views: 0, likes: 0, hasLiked: false };
    }
  }
}

const codingLabService = new CodingLabService();

// ==================== JUDGE0 SERVICE ====================
async function executeCode(
  code: string, 
  language: string, 
  stdin: string = ''
): Promise<{ output: string; error?: string; time?: string; memory?: string; status: string }> {
  try {
    // Use judge0Service for code execution
    const result = await judge0Service.executeCode(code, language, stdin);
    
    return {
      output: result.output || '',
      error: result.error || undefined,
      time: result.time ? `${(parseFloat(result.time) * 1000).toFixed(0)}ms` : 'N/A',
      memory: result.memory || 'N/A',
      status: result.success ? 'success' : result.status || 'error'
    };

  } catch (error: any) {
    return { output: '', error: error.message, status: 'error' };
  }
}

// ==================== COMPONENT ====================
const CodingLab: React.FC<CodingLabProps> = ({ 
  brandTheme,
  currentUser,
  problemSlug = 'two-sum'
}) => {
  // Current problem slug - can be changed to load different problems
  const [currentProblemSlug, setCurrentProblemSlug] = useState(problemSlug);
  
  // Sync problemSlug prop with state when it changes from parent
  useEffect(() => {
    if (problemSlug && problemSlug !== currentProblemSlug) {
      setCurrentProblemSlug(problemSlug);
    }
  }, [problemSlug]);
  
  // State
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('c');
  const [currentView, setCurrentView] = useState<'problem' | 'solution'>('problem');
  const [rightPanelMode, setRightPanelMode] = useState<'editor' | 'analogy' | 'ai'>('editor');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeOutputTab, setActiveOutputTab] = useState<'output' | 'stdin' | 'testcases'>('output');
  const [stdinInput, setStdinInput] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    description: true,
    io: true,
    constraints: true,
    hints: false,
    approaches: true,
    code: true,
    complexity: true,
    visualization: true,
    solutionVisualization: true,
    related: true,
    companies: true,
    tableSchema: true,
    solutionSummary: true,
  });
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [selectedApproach, setSelectedApproach] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [isLiked, setIsLiked] = useState(false);
  const [solutionLanguage, setSolutionLanguage] = useState('c');
  const [showVisualizationModal, setShowVisualizationModal] = useState(false);
  const [showProblemVisualizationModal, setShowProblemVisualizationModal] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [editorState, setEditorState] = useState<'normal' | 'maximized' | 'minimized'>('normal');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTestCasesPanel, setShowTestCasesPanel] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [solutionCodeCopied, setSolutionCodeCopied] = useState(false);
  const [outputPanelState, setOutputPanelState] = useState<'normal' | 'expanded' | 'minimized'>('normal');
  const [executionStats, setExecutionStats] = useState<{ time: string; memory: string } | null>(null);
  const [editorHeight, setEditorHeight] = useState(70); // percentage of available space
  const [isVerticalResizing, setIsVerticalResizing] = useState(false);
  const [aiOperationLoading, setAiOperationLoading] = useState<string | null>(null); // Track which AI operation is loading
  const [showAIResultModal, setShowAIResultModal] = useState(false);
  const [aiResultContent, setAiResultContent] = useState<{ title: string; content: string; operation: string } | null>(null);
  const [_problemAttemptRefreshTrigger, setProblemAttemptRefreshTrigger] = useState(0); // Trigger to refresh problems list attempts
  
  // Slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [slashCommandLine, setSlashCommandLine] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<any>(null); // Reference to Monaco editor instance

  // PGlite (PostgreSQL in browser) for SQL problems
  const pgliteRef = useRef<any>(null);
  const [_pgliteReady, setPgliteReady] = useState(false);
  const [_pgliteLoading, setPgliteLoading] = useState(false);

  // Resizer mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      let leftPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      leftPercent = Math.max(20, Math.min(80, leftPercent)); // Clamp between 20% and 80%
      setLeftPanelWidth(leftPercent);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Vertical resizer mouse event handlers
  useEffect(() => {
    const handleVerticalMouseMove = (e: MouseEvent) => {
      if (!isVerticalResizing || !editorContainerRef.current) return;
      
      const containerRect = editorContainerRef.current.getBoundingClientRect();
      let heightPercent = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      heightPercent = Math.max(30, Math.min(85, heightPercent)); // Clamp between 30% and 85%
      setEditorHeight(heightPercent);
    };

    const handleVerticalMouseUp = () => {
      if (isVerticalResizing) {
        setIsVerticalResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isVerticalResizing) {
      document.addEventListener('mousemove', handleVerticalMouseMove);
      document.addEventListener('mouseup', handleVerticalMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleVerticalMouseMove);
      document.removeEventListener('mouseup', handleVerticalMouseUp);
    };
  }, [isVerticalResizing]);

  // Load problem data
  useEffect(() => {
    const loadProblem = async () => {
      setIsLoading(true);
      setError(null);
      // Reset states when loading new problem
      setOutput('');
      setCurrentView('problem');
      setRightPanelMode('editor');
      setAiMessages([]);
      
      // Cleanup PGlite when switching problems
      if (pgliteRef.current) {
        try { await pgliteRef.current.close(); } catch (e) { /* ignore */ }
        pgliteRef.current = null;
        setPgliteReady(false);
        setPgliteLoading(false);
      }
      setAiInput('');
      
      try {
        console.log('🔄 Fetching problem:', currentProblemSlug);
        
        // First check raw Firebase data
        const rawData = await firebaseService.getCodingProblem(currentProblemSlug);
        console.log('📦 Raw Firebase data:', rawData);
        console.log('📦 Raw data keys:', rawData ? Object.keys(rawData) : 'null');
        console.log('📦 Raw description:', rawData?.description);
        console.log('📦 Raw constraints:', rawData?.constraints);
        console.log('📦 Raw examples:', rawData?.examples);
        console.log('📦 Raw approaches:', rawData?.approaches);
        console.log('📦 Raw analogy:', rawData?.analogy);
        console.log('📦 Raw related:', rawData?.related);
        console.log('📦 Raw visualize:', rawData?.visualize);
        console.log('📦 Raw visualize.steps:', rawData?.visualize?.steps);
        console.log('📦 Raw stats:', rawData?.stats);
        
        const data = await codingLabService.getProblem(currentProblemSlug);
        console.log('📦 Transformed data:', data);
        console.log('📦 Transformed description:', data?.description);
        console.log('📦 Transformed constraints:', data?.constraints);
        console.log('📦 Transformed examples:', data?.examples);
        console.log('📦 Transformed approaches:', data?.approaches);
        console.log('📦 Transformed analogy:', data?.analogy);
        console.log('📦 Transformed relatedProblems:', data?.relatedProblems);
        console.log('📦 Transformed visualize:', data?.visualize);
        console.log('📦 Transformed visualize.steps:', data?.visualize?.steps);
        console.log('📦 Transformed stats - views:', data?.views, 'likes:', data?.likes, 'frequency:', data?.frequency, 'avgTime:', data?.avgTime);
        console.log('📦 Transformed testCases:', data?.testCases);
        
        if (data) {
          setProblem(data);
          // Set first approach as selected (sorted by name)
          const sortedKeys = Object.entries(data.approaches || {}).sort(([, a]: any, [, b]: any) => (a.name || '').localeCompare(b.name || '')).map(([k]) => k);
          const firstApproach = sortedKeys[0];
          if (firstApproach) setSelectedApproach(firstApproach);
          // For SQL problems, force SQL language
          if (data.isSql) {
            setSolutionLanguage('sql');
            setSelectedLanguage('sql');
            if (data.defaultCode?.['sql']) {
              setCode(data.defaultCode['sql']);
            }
          } else if (data.defaultCode?.[selectedLanguage]) {
            setCode(data.defaultCode[selectedLanguage]);
          }
          // Initialize test results
          setTestResults(data.testCases?.map((tc: any, idx: number) => ({
            id: idx,
            params: { ...tc.params },
            expected: tc.expected_output,
            actual: '',
            passed: null,
            error: null,
            time: '0',
            memory: '0 KB',
            status: 'Not Run',
            running: false,
            // SQL-specific: carry raw input/output for table rendering
            sqlInput: tc._sqlInput || undefined,
            sqlExpectedOutput: tc._sqlExpectedOutput || undefined
          })) || []);
          
          // Pre-populate Stdin with first test case (coding problems only)
          if (!data.isSql && data.testCases?.length > 0) {
            const firstTC = data.testCases[0];
            const paramKeys = (data.params || []).length > 0
              ? data.params.map((p: any) => p.name)
              : data.paramOrder!;
            const stdinValue = paramKeys.map((k: string) => firstTC.params?.[k] ?? '').join('\n');
            if (stdinValue.trim()) {
              setStdinInput(stdinValue);
            }
          }
          
          // Check like status
          const hasLiked = await codingLabService.checkLikeStatus(currentProblemSlug);
          setIsLiked(hasLiked);
        } else {
          setError(`Problem "${currentProblemSlug}" not found in database`);
        }
      } catch (err: any) {
        console.error('❌ Error loading problem:', err);
        setError(err.message || 'Failed to load problem');
      } finally {
        setIsLoading(false);
      }
    };

    loadProblem();
  }, [currentProblemSlug]);

  // Update code when language changes
  useEffect(() => {
    if (problem?.defaultCode?.[selectedLanguage]) {
      setCode(problem.defaultCode[selectedLanguage]);
    }
  }, [selectedLanguage, problem]);

  // Handlers
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // ==================== PGlite SQL Functions ====================
  
  /** Initialize PGlite and create tables from problem.tableSchema */
  const initPGliteForProblem = async (problemData: ProblemData): Promise<boolean> => {
    if (pgliteRef.current) return true; // Already initialized
    
    setPgliteLoading(true);
    setOutput('🐘 Initializing PostgreSQL database...\n⏳ Please wait (first time may take a few seconds)...');
    
    try {
      const { PGlite } = await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js' as any);
      pgliteRef.current = new PGlite();
      await pgliteRef.current.waitReady;
      
      const tableSchema = problemData.tableSchema;
      if (tableSchema) {
        const isMultiTable = Array.isArray(tableSchema);
        const schemas = isMultiTable ? tableSchema : [tableSchema];
        
        // Create all tables
        for (const schema of schemas) {
          let columns = schema.columns;
          if (columns && typeof columns === 'object' && !Array.isArray(columns)) {
            columns = Object.keys(columns).sort((a: string, b: string) => Number(a) - Number(b)).map((key: string) => columns[key]);
          }
          if (!columns || columns.length === 0) continue;
          
          const tableName = schema.tableName || 'Table';
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
          console.log(`✅ Table ${tableName} created`);
        }
        
        // Insert data from first example
        const examples = problemData.examples;
        if (examples && examples.length > 0) {
          const firstExample = examples[0];
          if (firstExample?.input) {
            await insertSqlTestData(firstExample.input, schemas);
          }
        }
      }
      
      setPgliteReady(true);
      setPgliteLoading(false);
      setOutput('🐘 PostgreSQL Ready\n✓ Database initialized. Click "Run" to execute your SQL query.');
      return true;
    } catch (initError: any) {
      console.error('PGlite initialization error:', initError);
      setPgliteLoading(false);
      setOutput(`❌ Failed to initialize PostgreSQL database.\n\nError: ${initError.message}\n\n💡 Please check your internet connection and try again.`);
      return false;
    }
  };
  
  /** Insert test data into PGlite tables (handles both multi-table and single-table formats) */
  const insertSqlTestData = async (input: any, schemas: any[]) => {
    if (!pgliteRef.current || !input) return;
    
    // Multi-table format: input.tables array
    if (input.tables && Array.isArray(input.tables)) {
      for (const tableData of input.tables) {
        const tableName = tableData.name;
        const headers = tableData.headers || [];
        let rows = normalizeRows(tableData.rows);
        
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
    // Single-table format: input.headers and input.rows
    else if (input.headers && input.rows) {
      const tableName = schemas[0]?.tableName || 'Table';
      const headers = input.headers;
      let rows = normalizeRows(input.rows);
      
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
  
  /** Compare SQL results (headers + rows) against expected output */
  const compareSqlResults = (actualHeaders: string[], actualRows: any[], expectedHeaders: string[], expectedRows: any[]): boolean => {
    const normalizedActualHeaders = actualHeaders.map(h => h.toLowerCase());
    const normalizedExpectedHeaders = expectedHeaders.map(h => h.toLowerCase());
    
    if (normalizedActualHeaders.length !== normalizedExpectedHeaders.length) return false;
    
    const normalizedExpectedRows = normalizeRows(expectedRows);
    if (actualRows.length !== normalizedExpectedRows.length) return false;
    
    for (let i = 0; i < normalizedExpectedRows.length; i++) {
      const expectedRow = normalizedExpectedRows[i];
      const actualRow = actualRows[i];
      
      for (let j = 0; j < expectedHeaders.length; j++) {
        const expectedVal = expectedRow['i' + j];
        const headerName = expectedHeaders[j];
        const actualKey = actualHeaders.find(h => h.toLowerCase() === headerName.toLowerCase()) || actualHeaders[j];
        const actualVal = actualRow[actualKey];
        
        // Compare values
        if (!compareSqlValues(actualVal, expectedVal)) return false;
      }
    }
    return true;
  };
  
  /** Compare two SQL values (handles null, numeric, string) */
  const compareSqlValues = (actual: any, expected: any): boolean => {
    if (actual === null && expected === null) return true;
    if (actual === null || expected === null) return false;
    
    const actualStr = String(actual).trim().toLowerCase();
    const expectedStr = String(expected).trim().toLowerCase();
    if (actualStr === expectedStr) return true;
    
    const actualNum = parseFloat(actual);
    const expectedNum = parseFloat(expected);
    if (!isNaN(actualNum) && !isNaN(expectedNum)) {
      return Math.abs(actualNum - expectedNum) < 0.0001;
    }
    return false;
  };
  
  /** Run user's SQL code in PGlite (for the "Run" button output panel) */
  const runSqlCode = async () => {
    if (!problem) return;
    
    setIsRunning(true);
    setActiveOutputTab('output');
    setOutput('🔄 Executing SQL...');
    setExecutionStats(null);
    
    // Small delay to allow UI to update before heavy PGlite processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Initialize PGlite if needed
    if (!pgliteRef.current) {
      const success = await initPGliteForProblem(problem);
      if (!success) { setIsRunning(false); return; }
    }
    
    try {
      const startTime = performance.now();
      
      // Remove comments, split by semicolon
      const codeWithoutComments = code
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
          } else if (upperStatement.startsWith('CREATE TABLE')) {
            const tName = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)?.[1] || 'table';
            outputText += `\n✅ Table "${tName}" created successfully\n`;
          } else if (upperStatement.startsWith('DROP TABLE')) {
            const tName = statement.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i)?.[1] || 'table';
            outputText += `\n✅ Table "${tName}" dropped successfully\n`;
          } else {
            outputText += `\n✅ Query executed successfully\n`;
          }
        } catch (stmtError: any) {
          outputText += `\n❌ Error: ${stmtError.message}\n`;
        }
      }
      
      const endTime = performance.now();
      const execTime = ((endTime - startTime) / 1000).toFixed(3);
      
      setOutput(`🐘 PostgreSQL (PGlite)\n════════════════════════════════\n${outputText}\n════════════════════════════════`);
      setExecutionStats({ time: `${execTime}s`, memory: 'In-Browser' });
    } catch (error: any) {
      setOutput(`❌ SQL Error: ${error.message}`);
      setExecutionStats(null);
    } finally {
      setIsRunning(false);
    }
  };
  
  /** Run a single SQL test case: truncate → insert test data → run query → compare */
  const runSingleSqlTestCase = async (index: number) => {
    if (!problem || !problem.tableSchema) return;
    
    // Initialize PGlite if needed
    if (!pgliteRef.current) {
      const success = await initPGliteForProblem(problem);
      if (!success) return;
    }
    
    const testCase = testResults[index];
    if (!testCase) return;
    
    // Set running state
    setTestResults(prev => prev.map((r, i) => i === index ? { ...r, running: true, passed: null } : r));
    
    // Small delay to allow UI to update before heavy PGlite processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      const tableSchema = problem.tableSchema;
      const isMultiTable = Array.isArray(tableSchema);
      const schemas = isMultiTable ? tableSchema : [tableSchema];
      
      // Step 1: Truncate all tables
      for (const schema of schemas) {
        const tableName = schema?.tableName || 'Table';
        try { await pgliteRef.current.query(`DELETE FROM ${tableName}`); } catch (e) { /* ignore */ }
      }
      
      // Step 2: Insert this test case's data
      const sqlInput = testCase.sqlInput;
      if (sqlInput) {
        await insertSqlTestData(sqlInput, schemas);
      }
      
      // Step 3: Run user's query
      const startTime = performance.now();
      const result = await pgliteRef.current.query(code);
      const endTime = performance.now();
      const execTime = (endTime - startTime).toFixed(2);
      
      // Step 4: Compare with expected output
      const actualRows = result.rows || [];
      const actualHeaders = actualRows.length > 0 ? Object.keys(actualRows[0]) : [];
      
      const expectedHeaders = testCase.sqlExpectedOutput?.headers || [];
      const expectedRowsRaw = testCase.sqlExpectedOutput?.rows || [];
      
      const isCorrect = compareSqlResults(actualHeaders, actualRows, expectedHeaders, expectedRowsRaw);
      
      setTestResults(prev => {
        const newResults = prev.map((r, i) => i === index ? {
          ...r,
          actual: JSON.stringify(actualRows),
          passed: isCorrect,
          error: null,
          time: `${execTime}ms`,
          memory: 'In-Browser',
          status: isCorrect ? 'Accepted' : 'Wrong Answer',
          running: false,
          sqlActualHeaders: actualHeaders,
          sqlActualRows: actualRows
        } : r);
        setTimeout(() => recordProblemAttempt(newResults), 50);
        return newResults;
      });
    } catch (err: any) {
      setTestResults(prev => {
        const newResults = prev.map((r, i) => i === index ? {
          ...r,
          passed: false,
          error: err.message,
          status: 'Error',
          running: false
        } : r);
        setTimeout(() => recordProblemAttempt(newResults), 50);
        return newResults;
      });
    }
  };
  
  // ==================== End PGlite SQL Functions ====================

  const runCode = async () => {
    // For SQL problems, use PGlite instead of Judge0
    if (problem?.isSql) {
      await runSqlCode();
      return;
    }
    
    setIsRunning(true);
    setActiveOutputTab('output');
    setOutput('⏳ Running code...');
    setExecutionStats(null);
    
    try {
      const result = await executeCode(code, selectedLanguage, stdinInput);
      if (result.error) {
        // Show status only if it's different from the error message
        const statusText = result.status && result.status !== 'Error' ? `❌ ${result.status}\n` : '❌ Error\n';
        setOutput(`${statusText}${result.error}`);
        setExecutionStats(null);
      } else {
        setOutput(result.output);
        if (result.time && result.memory) {
          setExecutionStats({ time: result.time, memory: result.memory });
        }
      }
    } catch (error: any) {
      setOutput(`❌ Error: ${error.message}`);
      setExecutionStats(null);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLike = async () => {
    const result = await codingLabService.toggleLike(currentProblemSlug, isLiked);
    if (result.success) {
      setIsLiked(result.liked);
      setProblem(prev => prev ? { ...prev, likes: result.totalLikes } : prev);
    }
  };

  const sendAIMessage = useCallback(async () => {
    if (!aiInput.trim()) return;
    
    const userMessage = aiInput;
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiInput('');

    // Add typing indicator
    setAiMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

    try {
      // Build context-aware message for the AI
      const contextMessage = `Problem: ${problem?.title || 'Unknown'}\n\nUser Code (${selectedLanguage}):\n${code}\n\nUser Question: ${userMessage}`;
      
      // Use Firebase Cloud Function for AI chat
      const result = await firebaseService.chatWithAI(contextMessage, aiMessages.slice(-10));
      
      const aiResponse = result.response || 'Sorry, I could not process that request.';

      // Remove typing indicator and add response
      setAiMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      setAiMessages(prev => [...prev.slice(0, -1), { 
        role: 'assistant', 
        content: 'Sorry, the AI service is temporarily unavailable.' 
      }]);
    }
  }, [aiInput, code, selectedLanguage, aiMessages, problem?.title]);

  // AI Code Operations Handler
  const handleAIOperation = useCallback(async (operation: 'explain' | 'fix' | 'suggest' | 'format' | 'tests' | 'docs' | 'optimize') => {
    if (!code.trim()) {
      setAiResultContent({
        title: 'No Code',
        content: 'Please write some code first before using AI features.',
        operation: 'error'
      });
      setShowAIResultModal(true);
      return;
    }

    setAiOperationLoading(operation);
    
    try {
      let result;
      const titles: Record<string, string> = {
        explain: 'Code Explanation',
        fix: 'Fixed Code',
        suggest: 'Suggestions',
        format: 'Formatted Code',
        tests: 'Generated Tests',
        docs: 'Documentation',
        optimize: 'Optimized Code'
      };

      switch (operation) {
        case 'explain':
          result = await firebaseService.explainCode(code, selectedLanguage);
          break;
        case 'fix':
          result = await firebaseService.fixCode(code, selectedLanguage);
          break;
        case 'suggest':
          result = await firebaseService.suggestImprovements(code, selectedLanguage);
          break;
        case 'format':
          result = await firebaseService.formatCode(code, selectedLanguage);
          break;
        case 'tests':
          result = await firebaseService.generateTests(code, selectedLanguage);
          break;
        case 'docs':
          result = await firebaseService.generateDocs(code, selectedLanguage);
          break;
        case 'optimize':
          result = await firebaseService.optimizeCode(code, selectedLanguage);
          break;
      }

      if (result?.success) {
        setAiResultContent({
          title: titles[operation],
          content: result.result,
          operation: operation
        });
        setShowAIResultModal(true);
      } else {
        setAiResultContent({
          title: '❌ Error',
          content: result?.error || 'AI operation failed. Please try again.',
          operation: 'error'
        });
        setShowAIResultModal(true);
      }
    } catch (error: any) {
      setAiResultContent({
        title: '❌ Error',
        content: error.message || 'AI service is temporarily unavailable.',
        operation: 'error'
      });
      setShowAIResultModal(true);
    } finally {
      setAiOperationLoading(null);
    }
  }, [code, selectedLanguage]);

  // Apply AI-generated code to editor
  const applyAICode = useCallback(() => {
    if (aiResultContent && ['fix', 'format', 'optimize', 'tests', 'docs'].includes(aiResultContent.operation)) {
      // Extract code from markdown code blocks if present
      const content = aiResultContent.content;
      const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
      const codeToApply = codeBlockMatch ? codeBlockMatch[1].trim() : content;
      
      setCode(codeToApply);
      setShowAIResultModal(false);
      setAiResultContent(null);
    }
  }, [aiResultContent]);
  
  // Extract code from AI response for copying
  const extractCodeFromAIResponse = useCallback((content: string, operation: string): string => {
    if (['fix', 'format', 'optimize', 'tests', 'docs'].includes(operation)) {
      // Try to extract code from markdown code block
      const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
      }
    }
    return content;
  }, []);

  // Slash Commands Definition
  const slashCommands = [
    { 
      command: '/fix', 
      label: 'Fix', 
      description: 'Find and fix issues in your code',
      icon: faWrench,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      operation: 'fix' as const
    },
    { 
      command: '/explain', 
      label: 'Explain', 
      description: 'Get a detailed explanation of your code',
      icon: faCircleInfo,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      operation: 'explain' as const
    },
    { 
      command: '/tests', 
      label: 'Tests', 
      description: 'Generate unit tests for your code',
      icon: faClipboardList,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      operation: 'tests' as const
    },
    { 
      command: '/docs', 
      label: 'Docs', 
      description: 'Generate documentation for your code',
      icon: faPenToSquare,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      operation: 'docs' as const
    },
    { 
      command: '/optimize', 
      label: 'Optimize', 
      description: 'Optimize your code for better performance',
      icon: faGearComplexCode,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      operation: 'optimize' as const
    },
    { 
      command: '/suggest', 
      label: 'Suggest', 
      description: 'Get improvement suggestions',
      icon: faLightbulb,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      operation: 'suggest' as const
    },
    { 
      command: '/format', 
      label: 'Format', 
      description: 'Format your code properly',
      icon: faCode,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      operation: 'format' as const
    },
  ];

  // Filter slash commands based on input
  const filteredSlashCommands = slashCommands.filter(cmd => 
    cmd.command.toLowerCase().includes(slashFilter.toLowerCase()) ||
    cmd.label.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // Execute slash command
  const executeSlashCommand = useCallback((command: typeof slashCommands[0]) => {
    // Remove the slash command text from editor
    if (monacoEditorRef.current && slashCommandLine !== null) {
      const model = monacoEditorRef.current.getModel();
      if (model) {
        const lineContent = model.getLineContent(slashCommandLine);
        const slashIndex = lineContent.indexOf('/');
        if (slashIndex !== -1) {
          // Remove the slash command from the line
          const range = {
            startLineNumber: slashCommandLine,
            startColumn: slashIndex + 1,
            endLineNumber: slashCommandLine,
            endColumn: lineContent.length + 1
          };
          monacoEditorRef.current.executeEdits('slash-command', [{
            range,
            text: ''
          }]);
        }
      }
    }
    
    // Close menu and execute
    setShowSlashMenu(false);
    setSlashFilter('');
    setSelectedSlashIndex(0);
    setSlashCommandLine(null);
    
    // Execute the AI operation
    handleAIOperation(command.operation);
  }, [slashCommandLine, handleAIOperation]);

  // Handle keyboard navigation in slash menu
  const handleSlashMenuKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showSlashMenu) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSlashIndex(prev => 
        prev < filteredSlashCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSlashIndex(prev => 
        prev > 0 ? prev - 1 : filteredSlashCommands.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filteredSlashCommands[selectedSlashIndex]) {
        executeSlashCommand(filteredSlashCommands[selectedSlashIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSlashMenu(false);
      setSlashFilter('');
      setSelectedSlashIndex(0);
    }
  }, [showSlashMenu, filteredSlashCommands, selectedSlashIndex, executeSlashCommand]);

  // Add keyboard listener for slash menu
  useEffect(() => {
    if (showSlashMenu) {
      window.addEventListener('keydown', handleSlashMenuKeyDown);
      return () => window.removeEventListener('keydown', handleSlashMenuKeyDown);
    }
  }, [showSlashMenu, handleSlashMenuKeyDown]);

  // Simple Markdown Renderer for AI responses
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const elements: React.ReactElement[] = [];
    
    // First, extract all code blocks and replace with placeholders
    // Handle multiple formats: ```lang\ncode```, ```lang code```, ``` code ```
    const codeBlocks: { lang: string; code: string }[] = [];
    
    // Pattern 1: ```lang\ncode\n``` (standard)
    let processedText = text.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_match, lang, code) => {
      codeBlocks.push({ lang: lang || '', code: code.trim() });
      return `\n__CODE_BLOCK_${codeBlocks.length - 1}__\n`;
    });
    
    // Pattern 2: ```lang\ncode``` (no trailing newline)
    processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      codeBlocks.push({ lang: lang || '', code: code.trim() });
      return `\n__CODE_BLOCK_${codeBlocks.length - 1}__\n`;
    });
    
    // Pattern 3: ```code``` (inline, no language)
    processedText = processedText.replace(/```([\s\S]*?)```/g, (_match, code) => {
      codeBlocks.push({ lang: '', code: code.trim() });
      return `\n__CODE_BLOCK_${codeBlocks.length - 1}__\n`;
    });
    
    // Process the text line by line
    const lines = processedText.split('\n');
    let currentListItems: { num: string; content: string }[] = [];
    
    const flushList = () => {
      if (currentListItems.length > 0) {
        elements.push(
          <div key={`list-${elements.length}`} className="my-4 space-y-3">
            {currentListItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                  {item.num}
                </span>
                <div className="flex-1 pt-1 text-gray-700 leading-relaxed">{renderInlineMarkdown(item.content)}</div>
              </div>
            ))}
          </div>
        );
        currentListItems = [];
      }
    };
    
    lines.forEach((line, index) => {
      // Check for code block placeholder
      const codeBlockMatch = line.trim().match(/^__CODE_BLOCK_(\d+)__$/);
      if (codeBlockMatch) {
        flushList();
        const blockIndex = parseInt(codeBlockMatch[1]);
        const block = codeBlocks[blockIndex];
        if (block) {
          elements.push(
            <div key={`code-${index}`} className="my-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                </div>
                {block.lang && (
                  <span className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-1 rounded">
                    {block.lang}
                  </span>
                )}
              </div>
              <div className="bg-gray-900 p-4 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed">
                  <code className="text-gray-100">{block.code}</code>
                </pre>
              </div>
            </div>
          );
        }
        return;
      }
      
      // Skip lines that are just backticks (leftover from malformed code blocks)
      if (line.trim().match(/^`{3}\w*$/)) {
        return;
      }
      
      // Headers - clean without bars
      if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={index} className="text-base font-bold text-gray-800 mt-6 mb-3">
            {line.slice(4)}
          </h3>
        );
        return;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="text-lg font-bold text-gray-800 mt-6 mb-3">
            {line.slice(3)}
          </h2>
        );
        return;
      }
      if (line.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={index} className="text-xl font-bold text-gray-800 mt-6 mb-3">
            {line.slice(2)}
          </h1>
        );
        return;
      }
      
      // Bold headers like **Summary:** or **Input Validation**:
      if (line.match(/^\*\*[^*]+\*\*:?/)) {
        flushList();
        const match = line.match(/^\*\*([^*]+)\*\*:?\s*(.*)/);
        if (match) {
          elements.push(
            <div key={index} className="mt-4 mb-2">
              <span className="font-bold text-gray-900 text-base">{match[1]}</span>
              {match[2] && <span className="text-gray-600 ml-1">{renderInlineMarkdown(match[2])}</span>}
            </div>
          );
          return;
        }
      }
      
      // Bullet points
      if (line.match(/^[\s]*[-•*]\s/)) {
        flushList();
        const content = line.replace(/^[\s]*[-•*]\s/, '');
        elements.push(
          <div key={index} className="flex items-start gap-3 my-2 pl-2">
            <span className="w-2 h-2 mt-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex-shrink-0"></span>
            <span className="text-gray-700 leading-relaxed">{renderInlineMarkdown(content)}</span>
          </div>
        );
        return;
      }
      
      // Numbered list - collect items
      if (line.match(/^[\s]*\d+\.\s/)) {
        const match = line.match(/^[\s]*(\d+)\.\s+(.+)/);
        if (match) {
          currentListItems.push({ num: match[1], content: match[2] });
          return;
        }
      }
      
      // If we hit a non-list line, flush any pending list
      if (currentListItems.length > 0 && line.trim() !== '') {
        flushList();
      }
      
      // Empty line
      if (line.trim() === '') {
        if (currentListItems.length > 0) {
          // Don't flush yet, might be more list items
          return;
        }
        elements.push(<div key={index} className="h-3" />);
        return;
      }
      
      // Regular paragraph
      elements.push(
        <p key={index} className="text-gray-700 my-2 leading-relaxed">{renderInlineMarkdown(line)}</p>
      );
    });
    
    // Flush any remaining list items
    flushList();
    
    return <div className="space-y-1">{elements}</div>;
  };
  
  // Render inline markdown (bold, italic, code)
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;
    
    // First, replace all inline code patterns with a placeholder
    // Match `code` or ``code`` patterns
    let processed = text;
    const inlineCodes: string[] = [];
    
    // Replace ``code`` first (double backticks)
    processed = processed.replace(/``([^`]+)``/g, (_match, code) => {
      inlineCodes.push(code);
      return `__INLINE_CODE_${inlineCodes.length - 1}__`;
    });
    
    // Then replace `code` (single backticks)
    processed = processed.replace(/`([^`]+)`/g, (_match, code) => {
      inlineCodes.push(code);
      return `__INLINE_CODE_${inlineCodes.length - 1}__`;
    });
    
    // Now process bold text
    const parts = processed.split(/(\*\*[^*]+\*\*|__INLINE_CODE_\d+__)/g);
    
    return parts.map((part, i) => {
      if (!part) return null;
      
      // Check for inline code placeholder
      const codeMatch = part.match(/^__INLINE_CODE_(\d+)__$/);
      if (codeMatch) {
        const codeContent = inlineCodes[parseInt(codeMatch[1])];
        return (
          <code key={i} className="px-2 py-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-md text-sm font-mono border border-green-200 mx-0.5">
            {codeContent}
          </code>
        );
      }
      
      // Check for bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      
      return <span key={i}>{part}</span>;
    });
  };

  // Run a single test case
  const runSingleTestCase = async (index: number) => {
    // For SQL problems, use PGlite path
    if (problem?.isSql) {
      await runSingleSqlTestCase(index);
      return;
    }
    
    const testCase = testResults[index];
    if (!testCase) return;

    // Set running state
    setTestResults(prev => prev.map((r, i) => i === index ? { ...r, running: true } : r));

    try {
      // Convert params to stdin - respect param order from problem definition (matches PHP behavior)
      const paramKeys = (problem?.params || []).length > 0
        ? problem!.params.map((p: any) => p.name)
        : problem!.paramOrder!;
      const stdin = paramKeys.map((k: string) => testCase.params[k]).join('\n');
      
      const result = await executeCode(code, selectedLanguage, stdin);
      
      // Normalize outputs for comparison - handle non-string expected values
      const actualOutput = (result.output || '').trim();
      const expectedRaw = testCase.expected;
      const expectedOutput = typeof expectedRaw === 'string' 
        ? expectedRaw.trim() 
        : JSON.stringify(expectedRaw);
      
      // Smart output comparison - handles common variations
      const compareOutputs = (actual: string, expected: string): boolean => {
        if (actual === null || actual === undefined) actual = '';
        if (expected === null || expected === undefined) expected = '';
        
        // Convert to strings and trim whitespace
        actual = String(actual).trim();
        expected = String(expected).trim();
        
        // 1. Exact match (fast path)
        if (actual === expected) return true;
        
        // 2. Case-insensitive match (String == string == STRING)
        const actualLower = actual.toLowerCase();
        const expectedLower = expected.toLowerCase();
        
        if (actualLower === expectedLower) return true;
        
        // 3. Boolean normalization (True/true/TRUE/1/0/False/false/FALSE)
        const boolMap: Record<string, string> = {
          'true': 'true', 'True': 'true', 'TRUE': 'true', '1': 'true',
          'false': 'false', 'False': 'false', 'FALSE': 'false', '0': 'false'
        };
        if (boolMap[actual] !== undefined && boolMap[expected] !== undefined) {
          return boolMap[actual] === boolMap[expected];
        }
        
        // 4. Numeric comparison (handles "20" vs "20.0" vs "20.00", "11" vs "11.0")
        const actualNum = parseFloat(actual);
        const expectedNum = parseFloat(expected);
        if (!isNaN(actualNum) && !isNaN(expectedNum)) {
          // Check if both are purely numeric
          if (/^-?\d+\.?\d*$/.test(actual) && /^-?\d+\.?\d*$/.test(expected)) {
            return Math.abs(actualNum - expectedNum) < 1e-9;
          }
        }
        
        // 5. Array/JSON comparison (normalize spacing and formatting)
        if ((actual.startsWith('[') && actual.endsWith(']')) || 
            (actual.startsWith('{') && actual.endsWith('}'))) {
          try {
            const actualJson = JSON.parse(actual);
            const expectedJson = JSON.parse(expected);
            
            // Deep comparison with case-insensitive string elements
            const deepCompare = (a: any, b: any): boolean => {
              if (typeof a === 'string' && typeof b === 'string') {
                return a.toLowerCase() === b.toLowerCase();
              }
              if (typeof a === 'number' && typeof b === 'number') {
                return Math.abs(a - b) < 1e-9;
              }
              if (Array.isArray(a) && Array.isArray(b)) {
                if (a.length !== b.length) return false;
                return a.every((val, idx) => deepCompare(val, b[idx]));
              }
              if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
                const keysA = Object.keys(a);
                const keysB = Object.keys(b);
                if (keysA.length !== keysB.length) return false;
                return keysA.every(key => deepCompare(a[key], b[key]));
              }
              return a === b;
            };
            
            if (deepCompare(actualJson, expectedJson)) return true;
            
            // Fallback to stringified comparison
            return JSON.stringify(actualJson) === JSON.stringify(expectedJson);
          } catch (e) {
            // Not valid JSON, try normalizing whitespace
            const normalizeJson = (s: string) => s.replace(/\s+/g, '').replace(/,/g, ', ').replace(/:/g, ': ');
            return normalizeJson(actual) === normalizeJson(expected);
          }
        }
        
        // 6. Whitespace normalization (multiple spaces, newlines, tabs)
        const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim();
        if (normalizeWs(actual) === normalizeWs(expected)) return true;
        
        // 7. Handle trailing newlines from stdout
        if (actual.replace(/\n+$/, '') === expected.replace(/\n+$/, '')) return true;
        
        // 8. Case-insensitive + whitespace normalized
        if (normalizeWs(actualLower) === normalizeWs(expectedLower)) return true;
        
        return false;
      };
      
      const passed = compareOutputs(actualOutput, expectedOutput);

      setTestResults(prev => {
        const newResults = prev.map((r, i) => i === index ? {
          ...r,
          actual: actualOutput,
          passed: result.error ? false : passed,
          error: result.error || null,
          time: result.time || '0',
          memory: result.memory || '0 KB',
          status: result.error ? 'Error' : (passed ? 'Accepted' : 'Wrong Answer'),
          running: false
        } : r);
        
        // Record attempt after state update
        setTimeout(() => recordProblemAttempt(newResults), 50);
        
        return newResults;
      });
    } catch (err: any) {
      setTestResults(prev => {
        const newResults = prev.map((r, i) => i === index ? {
          ...r,
          passed: false,
          error: err.message,
          status: 'Error',
          running: false
        } : r);
        
        // Record attempt even on error
        setTimeout(() => recordProblemAttempt(newResults), 50);
        
        return newResults;
      });
    }
  };

  // Helper: Record problem attempt to database
  const recordProblemAttempt = async (results: TestResult[]) => {
    const userId = currentUser?.userId;
    const slug = problem?.slug;
    
    console.log('🔍 Recording attempt - userId:', userId, 'slug:', slug);
    
    if (!userId || !slug) {
      console.log('⚠️ Cannot record attempt: missing userId or problemSlug', { userId, slug });
      return;
    }

    const passedCount = results.filter(r => r.passed === true).length;
    const totalCount = results.length;
    const allPassed = passedCount === totalCount && totalCount > 0;
    const status: 'attempted' | 'completed' = allPassed ? 'completed' : 'attempted';

    try {
      await firebaseService.recordProblemAttempt(userId, slug, status, {
        language: selectedLanguage,
        passedTests: passedCount,
        totalTests: totalCount,
      });
      
      // Trigger refresh of problems list
      setProblemAttemptRefreshTrigger(prev => prev + 1);
      
      console.log(`✅ Recorded ${status} for problem ${slug} (${passedCount}/${totalCount} passed)`);
    } catch (error) {
      console.error('Error recording attempt:', error);
    }
  };

  // Run all test cases
  const runAllTestCases = async () => {
    for (let i = 0; i < testResults.length; i++) {
      await runSingleTestCase(i);
    }
    
    // Record attempt after all tests complete
    // Need to get fresh state after all tests have run
    setTimeout(async () => {
      // Get the latest testResults from state
      setTestResults(currentResults => {
        recordProblemAttempt(currentResults);
        return currentResults;
      });
    }, 100);
  };

  // Add a new test case
  const addTestCase = () => {
    // Get param keys from first existing test case or from problem.params
    const existingParams = testResults.length > 0 ? testResults[0].params : {};
    const newParams: Record<string, string> = {};
    
    // Copy structure from existing test case params
    Object.keys(existingParams).forEach(key => { newParams[key] = ''; });
    
    // Fallback to problem.params if no existing test cases
    if (Object.keys(newParams).length === 0 && problem?.params) {
      problem.params.forEach(p => { newParams[p.name] = ''; });
    }
    
    setTestResults(prev => [...prev, {
      id: prev.length,
      params: newParams,
      expected: '',
      actual: '',
      passed: null,
      error: null,
      time: '0',
      memory: '0 KB',
      status: 'Not Run',
      running: false
    }]);
  };

  // Delete a test case
  const deleteTestCase = (index: number) => {
    if (testResults.length <= 1) return;
    setTestResults(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, id: i })));
  };

  // Update test case param
  const updateTestCaseParam = (index: number, paramName: string, value: string) => {
    setTestResults(prev => prev.map((r, i) => i === index ? {
      ...r,
      params: { ...r.params, [paramName]: value }
    } : r));
  };

  // Update test case expected output
  const updateTestCaseExpected = (index: number, value: string) => {
    setTestResults(prev => prev.map((r, i) => i === index ? { ...r, expected: value } : r));
  };

  // Syntax highlighting helper function
  const highlightCode = (code: string, language: string): string => {
    if (!code) return '';
    
    // Light theme colors
    const colors = {
      keyword: '#7f0798',
      string: '#c41a16',
      comment: '#4a7c23',
      number: '#1c6b48',
      function: '#6f4e1a',
      type: '#1a6b8a'
    };

    // Keywords by language
    const keywords: Record<string, string[]> = {
      c: ['int', 'char', 'void', 'return', 'if', 'else', 'for', 'while', 'struct', 'NULL', 'sizeof', 'malloc', 'free', 'const', 'static', 'typedef'],
      cpp: ['int', 'char', 'void', 'return', 'if', 'else', 'for', 'while', 'class', 'public', 'private', 'vector', 'unordered_map', 'pair', 'auto', 'nullptr', 'using', 'namespace', 'std', 'sort', 'begin', 'end', 'push_back', 'find', 'first', 'second', 'size'],
      java: ['int', 'void', 'return', 'if', 'else', 'for', 'while', 'class', 'public', 'private', 'new', 'null', 'Map', 'HashMap', 'Arrays', 'Integer', 'compare', 'length', 'put', 'get', 'containsKey'],
      python: ['def', 'return', 'if', 'else', 'for', 'while', 'in', 'range', 'len', 'class', 'self', 'None', 'True', 'False', 'and', 'or', 'not', 'enumerate', 'sort', 'lambda'],
      javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'null', 'undefined', 'Map', 'Math', 'floor', 'length', 'push', 'map', 'sort', 'has', 'get', 'set'],
      go: ['func', 'return', 'if', 'else', 'for', 'range', 'var', 'const', 'type', 'struct', 'map', 'make', 'len', 'append', 'nil', 'package', 'import', 'int', 'string', 'bool', 'true', 'false']
    };

    const langKeywords = keywords[language] || keywords.c;

    // Escape HTML first
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Use placeholders to prevent double-processing
    const placeholders: string[] = [];
    const placeholder = (match: string): string => {
      placeholders.push(match);
      return `__PLACEHOLDER_${placeholders.length - 1}__`;
    };

    // Store strings first (before comments can contain them)
    highlighted = highlighted.replace(/("(?:[^"\\]|\\.)*")/g, (m) => placeholder(`<span style="color: ${colors.string};">${m}</span>`));
    highlighted = highlighted.replace(/('(?:[^'\\]|\\.)*')/g, (m) => placeholder(`<span style="color: ${colors.string};">${m}</span>`));

    // Comments (single line)
    highlighted = highlighted.replace(/(\/\/.*$)/gm, (m) => placeholder(`<span style="color: ${colors.comment};">${m}</span>`));
    
    // Comments (multi-line)
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, (m) => placeholder(`<span style="color: ${colors.comment};">${m}</span>`));
    
    // Python comments
    if (language === 'python') {
      highlighted = highlighted.replace(/(#.*$)/gm, (m) => placeholder(`<span style="color: ${colors.comment};">${m}</span>`));
    }

    // Numbers
    highlighted = highlighted.replace(/\b(\d+)\b/g, `<span style="color: ${colors.number};">$1</span>`);

    // Keywords
    langKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
      highlighted = highlighted.replace(regex, `<span style="color: ${colors.keyword};">$1</span>`);
    });

    // Function calls
    highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, `<span style="color: ${colors.function};">$1</span>(`);

    // Types (capitalized words)
    highlighted = highlighted.replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, `<span style="color: ${colors.type};">$1</span>`);

    // Restore placeholders
    placeholders.forEach((val, idx) => {
      highlighted = highlighted.replace(`__PLACEHOLDER_${idx}__`, val);
    });

    return highlighted;
  };

  // Helper functions
  const getTagColor = (index: number) => {
    const colors = [
      'bg-green-50 text-green-700 border border-green-200',
      'bg-blue-50 text-blue-700 border border-blue-200',
      'bg-orange-50 text-orange-700 border border-orange-200',
      'bg-purple-50 text-purple-700 border border-purple-200',
    ];
    return colors[index % colors.length];
  };

  const getComplexityColor = (complexity: string, type: 'time' | 'space' = 'time') => {
    if (!complexity) return 'text-gray-600';
    
    // For TIME complexity
    if (type === 'time') {
      // Red - bad
      if (complexity.includes('n²') || complexity.includes('n³') || 
          complexity.includes('n^2') || complexity.includes('n^3') ||
          complexity.includes('2^n') || complexity.includes('n!')) {
        return 'text-red-600';
      }
      // Orange - medium
      if (complexity.includes('log')) {
        return 'text-yellow-600';
      }
      // Green - good (O(1) or O(n))
      if (complexity === 'O(1)' || complexity === 'O(n)') {
        return 'text-green-600';
      }
      return 'text-green-600';
    }
    
    // For SPACE complexity
    if (type === 'space') {
      // Red - bad
      if (complexity.includes('n²') || complexity.includes('n³') || 
          complexity.includes('n^2') || complexity.includes('n^3') ||
          complexity.includes('2^n') || complexity.includes('n!')) {
        return 'text-red-600';
      }
      // Orange - ANY n usage
      if (complexity.includes('n')) {
        return 'text-yellow-600';
      }
      // Green - O(1) ONLY
      if (complexity === 'O(1)') {
        return 'text-green-600';
      }
      return 'text-green-600';
    }
    
    return 'text-gray-600';
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Loading state - Smooth skeleton loader
  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden bg-gray-100 font-sans">
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel Skeleton */}
          <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
            {/* Header Skeleton */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse mb-4"></div>
              <div className="flex gap-2 mb-4">
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4/6 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            {/* Content Skeleton */}
            <div className="flex-1 p-6 space-y-6">
              <div className="space-y-3">
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-24 w-full bg-gray-100 rounded-lg animate-pulse"></div>
              </div>
              <div className="space-y-3">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-20 w-full bg-gray-100 rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
          
          {/* Right Panel Skeleton - Editor */}
          <div className="flex-1 flex flex-col bg-gray-100">
            {/* Toolbar Skeleton */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-100">
              <div className="flex items-center gap-4">
                <div className="h-8 w-20 bg-green-200 rounded-lg animate-pulse"></div>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-12 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            {/* Editor Skeleton */}
            <div className="flex-1 mx-2 mb-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 space-y-2">
                <div className="flex gap-3">
                  <div className="w-8 text-right">
                    <div className="h-4 w-4 bg-gray-100 rounded animate-pulse ml-auto"></div>
                  </div>
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 text-right">
                    <div className="h-4 w-4 bg-gray-100 rounded animate-pulse ml-auto"></div>
                  </div>
                  <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 text-right">
                    <div className="h-4 w-4 bg-gray-100 rounded animate-pulse ml-auto"></div>
                  </div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 text-right">
                    <div className="h-4 w-4 bg-gray-100 rounded animate-pulse ml-auto"></div>
                  </div>
                  <div className="h-4 w-56 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 text-right">
                    <div className="h-4 w-4 bg-gray-100 rounded animate-pulse ml-auto"></div>
                  </div>
                  <div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
            {/* Output Panel Skeleton */}
            <div className="mx-2 mb-2 h-32 bg-white rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
                <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 w-12 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="p-4">
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Center Loading Indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-xl border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-gray-900 font-semibold">Loading Problem</p>
                <p className="text-gray-500 text-sm">Please wait...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER FUNCTIONS ====================
  
  const renderProblemPanel = () => {
    if (!problem) return null;
    
    return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto">
        {/* Problem Header - Title & Tags */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{problem.title}</h1>
            <button 
              onClick={() => {
                const allExpanded = expandedSections.description && expandedSections.io && expandedSections.constraints && expandedSections.visualization && expandedSections.complexity && expandedSections.related;
                setExpandedSections({
                  description: !allExpanded,
                  io: !allExpanded,
                  constraints: !allExpanded,
                  hints: !allExpanded,
                  visualization: !allExpanded,
                  complexity: !allExpanded,
                  related: !allExpanded,
                  companies: !allExpanded,
                  tableSchema: !allExpanded,
                  approaches: expandedSections.approaches,
                  code: expandedSections.code,
                  solutionSummary: expandedSections.solutionSummary
                });
              }} 
              className="w-7 h-7 flex items-center justify-center border border-blue-300 rounded-lg hover:bg-blue-50 transition-all"
              title="Toggle All Sections"
              style={{ borderColor: brandTheme.colors.primary }}
            >
              <FontAwesomeIcon 
                icon={faChevronDown} 
                className={`w-3 h-3 transition-transform duration-300 ${(expandedSections.description && expandedSections.io && expandedSections.constraints && expandedSections.visualization && expandedSections.complexity && expandedSections.related) ? '' : '-rotate-90'}`}
                style={{ color: brandTheme.colors.primary }}
              />
            </button>
          </div>
          
          {/* Tags - matching exact colors from screenshot */}
          <div className="flex flex-wrap gap-2 mb-5">
            {problem.tags?.map((tag, i) => {
              // Specific tag colors matching screenshot
              const tagStyles: Record<string, string> = {
                'Array': 'bg-blue-50 text-blue-700 border border-blue-200',
                'Hash Table': 'bg-purple-50 text-purple-700 border border-purple-200',
                'Two Pointers': 'bg-orange-50 text-orange-600 border border-orange-200',
              };
              return (
                <a 
                  key={i} 
                  href="#" 
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors hover:opacity-80 ${tagStyles[tag] || getTagColor(i)}`}
                >
                  {tag}
                </a>
              );
            })}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
              problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {problem.difficulty}
            </span>
          </div>

          {/* Problem Description */}
          <div 
            className="flex justify-between items-center cursor-pointer select-none mb-3" 
            onClick={() => toggleSection('description')}
          >
            <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
              <FontAwesomeIcon icon={faCircleInfo} className="w-5 h-5 text-gray-400" />
              Problem Description
            </h2>
            <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.description ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
          </div>
          {expandedSections.description && (
          <div 
            className="text-gray-700 leading-relaxed text-base max-w-none
              [&>p]:mb-3 [&>ul]:my-3 [&>ul]:pl-5 [&>ul]:list-disc 
              [&>ol]:my-3 [&>ol]:pl-5 [&>ol]:list-decimal
              [&>li]:mb-1 [&_li]:mb-1
              [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-gray-800
              [&_code]:before:content-none [&_code]:after:content-none"
            dangerouslySetInnerHTML={{ __html: problem.description }}
          />
          )}
        </div>

        <div className="h-px bg-gray-100 mx-6"></div>

        {/* Table Schema Section - SQL Problems Only */}
        {problem.isSql && problem.tableSchema && (
          <>
            <div className="px-6 py-5">
              <div 
                className="flex justify-between items-center cursor-pointer select-none" 
                onClick={() => toggleSection('tableSchema')}
              >
                <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <FontAwesomeIcon icon={faLayerGroup} className="w-5 h-5 text-gray-400" />
                  Table Schema
                </h2>
                <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.tableSchema ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
              </div>
              
              {expandedSections.tableSchema && (
                <div className="mt-4 space-y-5">
                  {(Array.isArray(problem.tableSchema) ? problem.tableSchema : [problem.tableSchema]).map((schema: any, si: number) => {
                    const columns = schema.columns 
                      ? (Array.isArray(schema.columns) ? schema.columns : Object.keys(schema.columns).sort((a: string, b: string) => Number(a) - Number(b)).map((key: string) => schema.columns[key]))
                      : [];
                    const primaryKey = schema.primaryKey || '';
                    
                    return (
                      <div key={si} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                        {/* Table Name Header */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <FontAwesomeIcon icon={faLayerGroup} className="w-4 h-4" style={{ color: brandTheme.colors.primary }} />
                          <span className="font-bold text-gray-800">{schema.tableName || 'Table'}</span>
                        </div>
                        
                        {/* Columns Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50/80">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Column Name</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Type</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {columns.map((col: any, ci: number) => (
                                <tr key={ci} className="border-b border-gray-100 last:border-b-0">
                                  <td className="px-4 py-2.5">
                                    <code className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs font-mono font-medium">{col.name}</code>
                                    {primaryKey && primaryKey.includes(col.name) && (
                                      <span className="ml-1.5 px-1.5 py-0.5 bg-orange-400 text-white text-[10px] font-bold rounded">PK</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{col.type || 'TEXT'}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-gray-600">{col.description || ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Primary Key & Notes */}
                        {(primaryKey || schema.notes) && (
                          <div className="px-4 py-2.5 bg-green-50/50 border-t border-gray-100">
                            {primaryKey && (
                              <div className="flex items-center gap-2 text-xs text-gray-600 border-l-3 border-green-500 pl-2" style={{ borderLeft: '3px solid #22c55e' }}>
                                <span className="font-bold text-gray-700">Primary Key:</span> {primaryKey}
                              </div>
                            )}
                            {schema.notes && (
                              <div className={`flex items-center gap-2 text-xs text-gray-600 ${primaryKey ? 'mt-1.5' : ''}`}>
                                <span className="font-bold text-gray-700">Note:</span> {schema.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100 mx-6"></div>
          </>
        )}

        {/* Input & Output Section */}
        <div className="px-6 py-5">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('io')}
          >
            <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
              <FontAwesomeIcon icon={faPenField} className="w-5 h-5 text-gray-400" />
              Input & Output
            </h2>
            <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.io ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
          </div>
          
          {expandedSections.io && (
            <div className="mt-4 space-y-4">
              {problem.examples?.map((example, idx) => (
                problem.isSql && ((example.input as any)?.headers || (example.input as any)?.tables) ? (
                  /* ===== SQL Example: Clean card layout ===== */
                  <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                    {/* Example Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                      <span className="text-sm font-semibold text-gray-700">Example {idx + 1}</span>
                      <span className="text-[10px] text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-100">SQL</span>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {/* Input Section */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          <FontAwesomeIcon icon={faLayerGroup} className="w-3 h-3" />
                          Input {(example.input as any)?.tables ? 'Tables' : 'Table'}
                        </div>
                        {(example.input as any)?.tables && Array.isArray((example.input as any).tables) ? (
                          /* Multi-table */
                          <div className="space-y-3">
                            {(example.input as any).tables.map((t: any, ti: number) => (
                              <div key={ti}>
                                <div className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                  {t.name}
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-gray-50">
                                        {(t.headers || []).map((h: string, hi: number) => (
                                          <th key={hi} className="px-3 py-2 text-left text-gray-500 font-semibold border-b border-gray-200 text-[11px]">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {normalizeRows(t.rows).map((row: any, ri: number) => (
                                        <tr key={ri} className="border-b border-gray-100 last:border-b-0">
                                          {(t.headers || []).map((_: string, ci: number) => {
                                            const val = row['i' + ci];
                                            return <td key={ci} className="px-3 py-1.5 text-gray-700 font-mono text-xs">{val === null || val === undefined ? <span className="text-gray-400 italic">NULL</span> : String(val)}</td>;
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (example.input as any)?.headers ? (
                          /* Single-table */
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50">
                                  {((example.input as any).headers || []).map((h: string, hi: number) => (
                                    <th key={hi} className="px-3 py-2 text-left text-gray-500 font-semibold border-b border-gray-200 text-[11px]">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {normalizeRows((example.input as any).rows).map((row: any, ri: number) => (
                                  <tr key={ri} className="border-b border-gray-100 last:border-b-0">
                                    {((example.input as any).headers || []).map((_: string, ci: number) => {
                                      const val = row['i' + ci];
                                      return <td key={ci} className="px-3 py-1.5 text-gray-700 font-mono text-xs">{val === null || val === undefined ? <span className="text-gray-400 italic">NULL</span> : String(val)}</td>;
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                      
                      {/* Output Section */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-green-500" />
                          <span className="text-green-600">Output</span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-green-200 bg-green-50/30">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-green-50">
                                {((example.output as any)?.headers || []).map((h: string, hi: number) => (
                                  <th key={hi} className="px-3 py-2 text-left text-green-700 font-semibold border-b border-green-200 text-[11px]">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {normalizeRows((example.output as any)?.rows).map((row: any, ri: number) => (
                                <tr key={ri} className="border-b border-green-100 last:border-b-0">
                                  {((example.output as any)?.headers || []).map((_: string, ci: number) => {
                                    const val = row['i' + ci];
                                    return <td key={ci} className="px-3 py-1.5 text-gray-700 font-mono text-xs">{val === null || val === undefined ? <span className="text-gray-400 italic">NULL</span> : String(val)}</td>;
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      {/* Explanation */}
                      {example.explanation && (
                        <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-xs text-gray-600 leading-relaxed">
                          <span className="font-semibold text-amber-600">Note: </span>
                          {typeof example.explanation === 'object' ? JSON.stringify(example.explanation) : stripHtml(String(example.explanation))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ===== Regular coding example: Terminal style ===== */
                  <div key={idx} className="rounded-xl overflow-hidden border border-gray-200" style={{ background: '#fefdfb' }}>
                    {/* Terminal Header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                      <span className="w-3 h-3 rounded-full bg-red-400"></span>
                      <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                      <span className="w-3 h-3 rounded-full bg-green-400"></span>
                      <span className="ml-3 text-sm text-gray-500 font-mono">{(example as any).title || `example_${idx + 1}.py`}</span>
                    </div>
                    {/* Terminal Body */}
                    <div className="p-4 font-mono text-xs">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="text-green-600 font-bold">$</span>
                        <span className="text-orange-500">Input:</span>
                        <span className="text-gray-800">
                          {typeof example.input === 'string' 
                            ? example.input 
                            : Object.entries(example.input).map(([k, v]) => `${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">›</span>
                        <span className="text-orange-500">Output:</span>
                        <span className="text-gray-800">{typeof example.output === 'object' ? JSON.stringify(example.output) : example.output}</span>
                      </div>
                      {example.explanation && (
                        <div className="mt-4 p-3 rounded-lg border-l-4 border-yellow-400" style={{ background: '#fffbeb' }}>
                          <div className="flex items-start gap-2 font-mono text-xs">
                            <span className="text-yellow-600">✓</span>
                            <span className="text-orange-500">Note:</span>
                            <span className="text-gray-700">{typeof example.explanation === 'object' ? JSON.stringify(example.explanation) : stripHtml(String(example.explanation))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* Constraints Section - Right after Input/Output */}
        {problem.constraints?.length > 0 && (
          <div className="px-6 py-5">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('constraints')}
            >
              <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5 text-gray-400" />
                Constraints
              </h2>
              <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.constraints ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
            </div>
            {expandedSections.constraints && (
              <div className="mt-4 p-5 rounded-xl border border-gray-200 bg-gray-50">
                <ul className="space-y-3">
                  {problem.constraints.map((c, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-700 text-sm">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span dangerouslySetInnerHTML={{ __html: c }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Visualization Section - Only shows visualize.svg from database */}
        {problem.visualize?.svg && (
          <div className="px-6 py-5">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('visualization')}
            >
              <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <FontAwesomeIcon icon={faDiagramProject} className="w-5 h-5 text-gray-400" />
                Visualization
              </h2>
              <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.visualization ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
            </div>
            
            {expandedSections.visualization && (
              <div className="mt-4 space-y-4">
                {/* Problem Overview SVG from visualize field */}
                <div 
                  className="rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" 
                  style={{ background: '#f9fbfd' }}
                  onClick={() => setShowProblemVisualizationModal(true)}
                >
                  {/* Tap to expand bar */}
                  <div className="p-3 text-center text-xs text-gray-400 border-b border-gray-100 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                    </svg>
                    Tap to expand
                  </div>
                  {problem.visualize.title && (
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-semibold text-gray-900">{problem.visualize.title}</h3>
                      {problem.visualize.description && (
                        <p className="text-sm text-gray-600 mt-1">{problem.visualize.description}</p>
                      )}
                    </div>
                  )}
                  <div className="p-4 overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto" dangerouslySetInnerHTML={{ __html: problem.visualize.svg }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Related Problems Section */}
        {problem.relatedProblems?.length > 0 && (
          <div className="px-6 py-5">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('related')}
            >
              <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <FontAwesomeIcon icon={faLayerGroup} className="w-5 h-5 text-gray-400" />
                Related Problems
              </h2>
              <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.related ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
            </div>
            {expandedSections.related && (
              <div className="mt-4">
                {problem.relatedProblems.map((rp, i) => (
                  <div 
                    key={i} 
                    onClick={() => setCurrentProblemSlug(rp.slug)}
                    className="flex items-center py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <span className="text-sm text-gray-400 font-mono w-10">#{i + 1}</span>
                    <span className="flex-1 text-gray-800 font-medium text-sm group-hover:text-green-600 transition-colors">{rp.title}</span>
                    <span className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                      rp.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      rp.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {rp.difficulty}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Asked in (Companies) - Inline with header */}
        {problem.companies?.length > 0 && (
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                <FontAwesomeIcon icon={faBuilding} className="w-4 h-4 text-gray-400" />
                Asked in
              </div>
              {problem.companies.map((company, i) => {
                const logoStyles: Record<string, { bg: string; color: string }> = {
                  'Google': { bg: '#4285F4', color: 'white' },
                  'Amazon': { bg: '#FF9900', color: 'white' },
                  'Meta': { bg: '#1877F2', color: 'white' },
                  'Microsoft': { bg: '#00A4EF', color: 'white' },
                };
                const logoText: Record<string, string> = {
                  'Google': 'G',
                  'Amazon': 'a',
                  'Meta': 'f',
                  'Microsoft': '⊞',
                };
                const style = logoStyles[company.name] || { bg: '#6b7280', color: 'white' };
                return (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 text-xs font-medium text-gray-700 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      {logoText[company.name] || company.name.charAt(0)}
                    </span>
                    <span>{company.name}</span>
                    {company.count && (
                      <span className="text-gray-400 text-xs">{company.count}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Hints Section */}
        {problem.hints?.length > 0 && (
          <div className="px-6 py-5">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('hints')}
            >
              <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <FontAwesomeIcon icon={faLightbulb} className="w-5 h-5 text-yellow-500" />
                Hints
              </h2>
              <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.hints ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
            </div>
            {expandedSections.hints && (
              <div className="mt-4 space-y-3">
                {problem.hints.map((hint, i) => (
                  <div key={i} className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-gray-700 text-sm">
                    <strong className="text-yellow-700">Hint {i + 1}:</strong> {hint}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Stats Bar - matching screenshot exactly */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faEye} className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800">{formatNumber(problem.views)}</span>
          <span className="text-gray-500">Views</span>
        </div>
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faFire} className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-gray-800">{problem.frequency}</span>
          <span className="text-gray-500">Frequency</span>
        </div>
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800">{problem.avgTime}</span>
          <span className="text-gray-500">Avg. Time</span>
        </div>
        <button 
          onClick={handleLike}
          className={`flex items-center gap-2 transition-all ${isLiked ? 'text-green-600' : 'text-gray-600 hover:text-green-600'} cursor-pointer`}
          title={isLiked ? 'Click to unlike' : 'Click to like this problem'}
        >
          <FontAwesomeIcon 
            icon={faThumbsUp} 
            className={`w-4 h-4 transition-transform ${isLiked ? 'text-green-500 scale-110' : 'text-gray-400'}`} 
          />
          <span className={`font-semibold ${isLiked ? 'text-green-600' : 'text-gray-800'}`}>
            {formatNumber(problem.likes)}
          </span>
          <span className="text-gray-500">Likes</span>
        </button>
      </div>
    </div>
    );
  };

  const renderSolutionPanel = () => {
    if (!problem) return null;
    
    const approaches = Object.entries(problem.approaches || {}).sort(([, a]: any, [, b]: any) => (a.name || '').localeCompare(b.name || ''));
    const currentApproach = problem.approaches?.[selectedApproach];

    // Get complexity level for styling
    const getComplexityLevel = (complexity: string): 'good' | 'medium' | 'bad' => {
      if (!complexity) return 'medium';
      if (complexity === 'O(1)' || complexity === 'O(n)') return 'good';
      if (complexity.includes('log')) return 'medium';
      if (complexity.includes('²') || complexity.includes('^2') || complexity.includes('n²')) return 'bad';
      return 'medium';
    };

    return (
      <div className="h-full flex flex-col overflow-hidden bg-amber-50/30">
        <div className="flex-1 overflow-y-auto">
          {/* Solution Header */}
          <div className="px-6 pt-5 pb-4 border-b border-amber-200/50">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-bold text-gray-900">{problem.title} — Solution</h1>
              <button 
                onClick={() => {
                  const allExpanded = expandedSections.solutionSummary && expandedSections.approaches && expandedSections.code && expandedSections.complexity && expandedSections.constraints;
                  setExpandedSections(prev => ({
                    ...prev,
                    solutionSummary: !allExpanded,
                    approaches: !allExpanded,
                    code: !allExpanded,
                    complexity: !allExpanded,
                    constraints: !allExpanded,
                    visualization: !allExpanded,
                  }));
                }} 
                className="w-7 h-7 flex items-center justify-center border border-amber-300 rounded-lg hover:bg-amber-100 transition-all"
                title="Toggle All Sections"
              >
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`w-3 h-3 text-amber-600 transition-transform duration-300 ${(expandedSections.solutionSummary && expandedSections.approaches && expandedSections.code) ? '' : '-rotate-90'}`}
                />
              </button>
            </div>
            {/* Solution Summary */}
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('solutionSummary')}
            >
              <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <FontAwesomeIcon icon={faCircleInfo} className="w-5 h-5 text-gray-400" />
                Solution Summary
              </h2>
              <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${expandedSections.solutionSummary ? '' : '-rotate-90'}`} />
            </div>
            {expandedSections.solutionSummary && (
            <p className="text-gray-700 leading-relaxed mt-3">
              The optimal solution uses a <strong>Hash Map</strong> to achieve O(n) time complexity. 
              Instead of checking every pair (brute force <strong>O(n²)</strong>), we store each number 
              and check if its complement (target - current number) already exists in the map.
            </p>
            )}
          </div>

          {/* Common Approaches Table */}
          <div className="px-6 py-5 border-b border-amber-200/50">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('approaches')}
            >
              <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <FontAwesomeIcon icon={faListCheck} className="w-5 h-5 text-gray-400" />
                Common Approaches
              </h2>
              <FontAwesomeIcon 
                icon={faChevronDown} 
                className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${expandedSections.approaches ? '' : '-rotate-90'}`}
              />
            </div>
            {expandedSections.approaches && (
              <div className="mt-4">
                <div className="flex flex-col">
                  {approaches.map(([key, approach], index) => (
                    <div 
                      key={key}
                      onClick={() => setSelectedApproach(key)}
                      className={`px-4 py-3.5 cursor-pointer transition-all ${
                        selectedApproach === key 
                          ? 'bg-green-50/60 border-l-[3px] border-l-green-500' 
                          : 'border-l-[3px] border-l-transparent hover:bg-amber-50/30'
                      } ${index !== approaches.length - 1 ? 'border-b border-gray-200' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-gray-800 font-semibold text-[14.5px] mb-1.5">
                        {selectedApproach === key && (
                          <span className="text-green-600 text-[15px]">✓</span>
                        )}
                        {approach.name}
                      </div>
                      <div className="flex items-center gap-3.5 mb-1.5">
                        <span className={`text-xs font-semibold font-mono flex items-center gap-1 ${getComplexityColor(approach.complexity?.time, 'time')}`}>
                          <span>⏱️</span> Time: {approach.complexity?.time}
                        </span>
                        <span className={`text-xs font-semibold font-mono flex items-center gap-1 ${getComplexityColor(approach.complexity?.space, 'space')}`}>
                          <FontAwesomeIcon icon={faMicrochip} className="w-3 h-3" /> Space: {approach.complexity?.space}
                        </span>
                      </div>
                      {approach.description && (
                        <div className="text-gray-500 text-[13px] leading-relaxed">
                          {approach.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Algorithm Steps */}
          {currentApproach && (
            <div className="px-6 py-5 border-b border-amber-200/50">
              <div 
                className="flex justify-between items-center cursor-pointer select-none" 
                onClick={() => toggleSection('visualization')}
              >
                <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <FontAwesomeIcon icon={faStairs} className="w-5 h-5 text-gray-400" />
                  {currentApproach.name} — Algorithm Steps
                </h2>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${expandedSections.visualization ? '' : '-rotate-90'}`}
                />
              </div>
              {expandedSections.visualization && (
                <div className="mt-4 p-5 bg-white rounded-xl border border-amber-200">
                  {/* Summary */}
                  {currentApproach.summary && (
                    <p className="text-gray-800 font-medium mb-3">{currentApproach.summary}</p>
                  )}
                  <p className="text-gray-700 leading-relaxed mb-4">{currentApproach.description}</p>
                  
                  {/* Step by Step Walkthrough from Database */}
                  {currentApproach.steps && currentApproach.steps.length > 0 && (
                    <div className="p-4 bg-amber-50/50 rounded-lg border-l-4 border-amber-400 mb-4">
                      <div className="flex items-center gap-2 mb-3 text-amber-700 font-semibold">
                        <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4" />
                        Step-by-Step Walkthrough
                      </div>
                      <div className="space-y-3">
                        {currentApproach.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-3 items-start">
                            <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                              idx === currentApproach.steps!.length - 1 
                                ? 'bg-gradient-to-br from-green-500 to-green-600' 
                                : 'bg-gradient-to-br from-amber-500 to-amber-600'
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <div className="text-gray-700 text-sm">{step}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Pros and Cons */}
                  {((currentApproach.pros?.length ?? 0) > 0 || (currentApproach.cons?.length ?? 0) > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      {currentApproach.pros && currentApproach.pros.length > 0 && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-2 text-green-700 font-semibold text-sm">
                            <span>✓</span> Pros
                          </div>
                          <ul className="space-y-1">
                            {currentApproach.pros.map((pro, idx) => (
                              <li key={idx} className="text-green-700 text-xs flex items-start gap-1">
                                <span className="mt-1">•</span>
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {currentApproach.cons && currentApproach.cons.length > 0 && (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-center gap-2 mb-2 text-red-700 font-semibold text-sm">
                            <span>✗</span> Cons
                          </div>
                          <ul className="space-y-1">
                            {currentApproach.cons.map((con, idx) => (
                              <li key={idx} className="text-red-700 text-xs flex items-start gap-1">
                                <span className="mt-1">•</span>
                                <span>{con}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Visualization Section */}
          {currentApproach && (
            <div className="px-6 py-5 border-b border-amber-200/50">
              <div 
                className="flex justify-between items-center cursor-pointer select-none" 
                onClick={() => toggleSection('solutionVisualization')}
              >
                <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <FontAwesomeIcon icon={faDiagramProject} className="w-5 h-5 text-gray-400" />
                  Visualization
                </h2>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${expandedSections.solutionVisualization ? '' : '-rotate-90'}`}
                />
              </div>
              {expandedSections.solutionVisualization && (
                <div className="mt-4">
                  {/* SVG Visualization Box */}
                  <div 
                    className="rounded-xl border border-amber-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    style={{ background: '#f9fbfd' }}
                    onClick={() => setShowVisualizationModal(true)}
                  >
                    <div className="p-3 text-center text-xs text-gray-400 border-b border-amber-100 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                      </svg>
                      Tap to expand
                    </div>
                    <div className="p-4">
                      {/* Determine visualization type based on selectedApproach key or name */}
                      {(() => {
                        const approachKey = selectedApproach?.toLowerCase() || '';
                        const approachName = currentApproach?.name?.toLowerCase() || '';
                        
                        // Two Pointers visualization
                        if (approachKey.includes('pointer') || approachName.includes('pointer')) {
                          return (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 480" className="w-full h-auto">
                              <rect width="700" height="480" fill="#f5f5f5"/>
                              <text x="350" y="30" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#333">Two Pointers: Sort First, Then Search</text>
                              <text x="350" y="55" fontSize="14" textAnchor="middle" fill="#666">Original: [2, 7, 11, 15] → Sorted: [2, 7, 11, 15], Target: 9</text>
                              
                              <g transform="translate(80, 90)">
                                <text x="270" y="-10" fontSize="13" fontWeight="bold" fill="#333">Step 1: Array is already sorted</text>
                                <rect x="0" y="0" width="80" height="60" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2"/>
                                <text x="40" y="38" fontSize="20" fontWeight="bold" textAnchor="middle">2</text>
                                <text x="40" y="80" fontSize="11" textAnchor="middle" fill="#666">idx: 0</text>
                                <text x="40" y="-15" fontSize="12" fill="#2196f3" fontWeight="bold">← LEFT</text>
                                
                                <rect x="120" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                                <text x="160" y="38" fontSize="20" textAnchor="middle">7</text>
                                <text x="160" y="80" fontSize="11" textAnchor="middle" fill="#666">idx: 1</text>
                                
                                <rect x="240" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                                <text x="280" y="38" fontSize="20" textAnchor="middle">11</text>
                                <text x="280" y="80" fontSize="11" textAnchor="middle" fill="#666">idx: 2</text>
                                
                                <rect x="360" y="0" width="80" height="60" fill="#fff3e0" stroke="#ff9800" strokeWidth="2"/>
                                <text x="400" y="38" fontSize="20" fontWeight="bold" textAnchor="middle">15</text>
                                <text x="400" y="80" fontSize="11" textAnchor="middle" fill="#666">idx: 3</text>
                                <text x="400" y="-15" fontSize="12" fill="#ff9800" fontWeight="bold">RIGHT →</text>
                              </g>
                              
                              <g transform="translate(150, 200)">
                                <rect width="400" height="100" fill="#fff3e0" stroke="#ff9800" strokeWidth="2" rx="8"/>
                                <text x="200" y="30" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#e65100">🧮 First Check</text>
                                <text x="200" y="55" fontSize="13" textAnchor="middle" fill="#333">Sum = nums[left] + nums[right]</text>
                                <text x="200" y="75" fontSize="13" textAnchor="middle" fill="#333">Sum = 2 + 15 = 17</text>
                                <text x="200" y="95" fontSize="13" fontWeight="bold" textAnchor="middle" fill="#d32f2f">17 &gt; 9 → Move RIGHT pointer left ←</text>
                              </g>
                              
                              <g transform="translate(80, 330)">
                                <text x="270" y="-10" fontSize="13" fontWeight="bold" fill="#333">Step 2: Move right pointer (right--)</text>
                                <rect x="0" y="0" width="80" height="60" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2"/>
                                <text x="40" y="38" fontSize="20" fontWeight="bold" textAnchor="middle">2</text>
                                <text x="40" y="80" fontSize="11" textAnchor="middle" fill="#666">idx: 0</text>
                                <text x="40" y="-15" fontSize="12" fill="#2196f3" fontWeight="bold">← LEFT</text>
                                
                                <rect x="120" y="0" width="80" height="60" fill="#c8e6c9" stroke="#4caf50" strokeWidth="3"/>
                                <text x="160" y="38" fontSize="20" fontWeight="bold" textAnchor="middle">7</text>
                                <text x="160" y="80" fontSize="11" textAnchor="middle" fill="#666">idx: 1</text>
                                <text x="160" y="-15" fontSize="12" fill="#4caf50" fontWeight="bold">RIGHT →</text>
                                
                                <rect x="240" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1" opacity="0.5"/>
                                <text x="280" y="38" fontSize="20" textAnchor="middle" fill="#999">11</text>
                                
                                <rect x="360" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1" opacity="0.5"/>
                                <text x="400" y="38" fontSize="20" textAnchor="middle" fill="#999">15</text>
                                
                                <text x="220" y="125" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#00aa00">✓ Sum = 2 + 7 = 9 (Match!)</text>
                              </g>
                            </svg>
                          );
                        }
                        
                        // Hash Map visualization (one-pass or two-pass)
                        if (approachKey.includes('hash') || approachName.includes('hash')) {
                          return (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 500" className="w-full h-auto">
                              <rect width="700" height="500" fill="#f5f5f5"/>
                              <text x="350" y="30" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#333">Hash Map: {currentApproach?.name || 'Hash Table Solution'}</text>
                              <text x="350" y="55" fontSize="14" textAnchor="middle" fill="#666">Array: [2, 7, 11, 15], Target: 9</text>
                              
                              <g transform="translate(50, 90)">
                                <text x="0" y="-10" fontSize="13" fontWeight="bold" fill="#333">Array</text>
                                <rect x="0" y="0" width="60" height="50" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2"/>
                                <text x="30" y="32" fontSize="18" fontWeight="bold" textAnchor="middle">2</text>
                                <text x="30" y="65" fontSize="10" textAnchor="middle" fill="#666">i=0</text>
                                
                                <rect x="70" y="0" width="60" height="50" fill="#c8e6c9" stroke="#4caf50" strokeWidth="2"/>
                                <text x="100" y="32" fontSize="18" fontWeight="bold" textAnchor="middle">7</text>
                                <text x="100" y="65" fontSize="10" textAnchor="middle" fill="#666">i=1</text>
                                
                                <rect x="140" y="0" width="60" height="50" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                                <text x="170" y="32" fontSize="18" textAnchor="middle">11</text>
                                <text x="170" y="65" fontSize="10" textAnchor="middle" fill="#666">i=2</text>
                                
                                <rect x="210" y="0" width="60" height="50" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                                <text x="240" y="32" fontSize="18" textAnchor="middle">15</text>
                                <text x="240" y="65" fontSize="10" textAnchor="middle" fill="#666">i=3</text>
                              </g>
                              
                              <g transform="translate(400, 90)">
                                <text x="0" y="-10" fontSize="13" fontWeight="bold" fill="#333">Hash Map {'{'}value → index{'}'}</text>
                                <rect x="0" y="0" width="200" height="40" fill="#fff3e0" stroke="#ff9800" strokeWidth="2" rx="4"/>
                                <text x="100" y="26" fontSize="14" textAnchor="middle" fill="#333">2 → 0</text>
                              </g>
                              
                              <g transform="translate(50, 200)">
                                <rect width="600" height="80" fill="#e8f5e9" stroke="#4caf50" strokeWidth="2" rx="8"/>
                                <text x="300" y="25" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#2e7d32">Step 1: Check index 0 (value = 2)</text>
                                <text x="300" y="48" fontSize="13" textAnchor="middle" fill="#333">Need: 9 - 2 = 7. Is 7 in map? NO</text>
                                <text x="300" y="68" fontSize="13" textAnchor="middle" fill="#666">Action: Add {'{'}2 → 0{'}'} to map</text>
                              </g>
                              
                              <g transform="translate(50, 300)">
                                <rect width="600" height="80" fill="#c8e6c9" stroke="#4caf50" strokeWidth="3" rx="8"/>
                                <text x="300" y="25" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#1b5e20">Step 2: Check index 1 (value = 7)</text>
                                <text x="300" y="48" fontSize="13" textAnchor="middle" fill="#333">Need: 9 - 7 = 2. Is 2 in map? YES! At index 0</text>
                                <text x="300" y="68" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#1b5e20">✓ Found pair! Return [0, 1]</text>
                              </g>
                              
                              <g transform="translate(150, 410)">
                                <rect width="400" height="60" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" rx="8"/>
                                <text x="200" y="25" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#1565c0">✅ Result: [0, 1]</text>
                                <text x="200" y="48" fontSize="13" textAnchor="middle" fill="#333">nums[0] + nums[1] = 2 + 7 = 9</text>
                              </g>
                            </svg>
                          );
                        }
                        
                        // Binary Search visualization
                        if (approachKey.includes('binary') || approachName.includes('binary') || approachName.includes('sorting')) {
                          return (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 500" className="w-full h-auto">
                              <rect width="700" height="500" fill="#f5f5f5"/>
                              <text x="350" y="30" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#333">Sorting + Binary Search</text>
                              <text x="350" y="55" fontSize="14" textAnchor="middle" fill="#666">Array: [2, 7, 11, 15], Target: 9</text>
                              
                              <g transform="translate(80, 100)">
                                <text x="0" y="-15" fontSize="13" fontWeight="bold" fill="#333">Sorted Array (with original indices)</text>
                                <rect x="0" y="0" width="80" height="60" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2"/>
                                <text x="40" y="30" fontSize="18" fontWeight="bold" textAnchor="middle">2</text>
                                <text x="40" y="50" fontSize="10" textAnchor="middle" fill="#666">orig: 0</text>
                                
                                <rect x="100" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                                <text x="140" y="30" fontSize="18" textAnchor="middle">7</text>
                                <text x="140" y="50" fontSize="10" textAnchor="middle" fill="#666">orig: 1</text>
                                
                                <rect x="200" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                                <text x="240" y="30" fontSize="18" textAnchor="middle">11</text>
                                <text x="240" y="50" fontSize="10" textAnchor="middle" fill="#666">orig: 2</text>
                                
                                <rect x="300" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                                <text x="340" y="30" fontSize="18" textAnchor="middle">15</text>
                                <text x="340" y="50" fontSize="10" textAnchor="middle" fill="#666">orig: 3</text>
                              </g>
                              
                              <g transform="translate(50, 200)">
                                <rect width="600" height="80" fill="#fff3e0" stroke="#ff9800" strokeWidth="2" rx="8"/>
                                <text x="300" y="25" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#e65100">Step 1: For element 2, search for 7</text>
                                <text x="300" y="48" fontSize="13" textAnchor="middle" fill="#333">Need: 9 - 2 = 7. Binary search for 7 in remaining array</text>
                                <text x="300" y="68" fontSize="13" textAnchor="middle" fill="#666">Search range: [7, 11, 15] → mid = 11 → go left → found 7!</text>
                              </g>
                              
                              <g transform="translate(50, 300)">
                                <rect width="600" height="80" fill="#c8e6c9" stroke="#4caf50" strokeWidth="3" rx="8"/>
                                <text x="300" y="25" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#1b5e20">✓ Binary Search Found 7!</text>
                                <text x="300" y="48" fontSize="13" textAnchor="middle" fill="#333">Element 2 at original index 0, Element 7 at original index 1</text>
                                <text x="300" y="68" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#1b5e20">Return [0, 1]</text>
                              </g>
                              
                              <g transform="translate(150, 410)">
                                <rect width="400" height="60" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" rx="8"/>
                                <text x="200" y="25" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#1565c0">✅ Result: [0, 1]</text>
                                <text x="200" y="48" fontSize="13" textAnchor="middle" fill="#333">nums[0] + nums[1] = 2 + 7 = 9</text>
                              </g>
                            </svg>
                          );
                        }
                        
                        // Brute Force visualization (default)
                        return (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" className="w-full h-auto">
                            <rect width="700" height="400" fill="#f5f5f5"/>
                            <text x="350" y="30" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#333">Brute Force: Check All Pairs</text>
                            <text x="350" y="55" fontSize="14" textAnchor="middle" fill="#666">Array: [2, 7, 11, 15], Target: 9</text>
                            
                            <g transform="translate(150, 90)">
                              <rect x="0" y="0" width="80" height="60" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2"/>
                              <text x="40" y="38" fontSize="20" fontWeight="bold" textAnchor="middle">2</text>
                              <text x="40" y="75" fontSize="11" textAnchor="middle" fill="#666">idx: 0</text>
                              
                              <rect x="100" y="0" width="80" height="60" fill="#c8e6c9" stroke="#4caf50" strokeWidth="2"/>
                              <text x="140" y="38" fontSize="20" fontWeight="bold" textAnchor="middle">7</text>
                              <text x="140" y="75" fontSize="11" textAnchor="middle" fill="#666">idx: 1</text>
                              
                              <rect x="200" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                              <text x="240" y="38" fontSize="20" textAnchor="middle">11</text>
                              <text x="240" y="75" fontSize="11" textAnchor="middle" fill="#666">idx: 2</text>
                              
                              <rect x="300" y="0" width="80" height="60" fill="#f5f5f5" stroke="#999" strokeWidth="1"/>
                              <text x="340" y="38" fontSize="20" textAnchor="middle">15</text>
                              <text x="340" y="75" fontSize="11" textAnchor="middle" fill="#666">idx: 3</text>
                            </g>
                            
                            <g transform="translate(100, 200)">
                              <text x="0" y="0" fontSize="14" fontWeight="bold" fill="#333">Pairs to check (O(n²)):</text>
                              <text x="0" y="30" fontSize="13" fill="#4caf50">✓ (0,1): 2 + 7 = 9 ← Match!</text>
                              <text x="0" y="55" fontSize="13" fill="#999">(0,2): 2 + 11 = 13</text>
                              <text x="0" y="80" fontSize="13" fill="#999">(0,3): 2 + 15 = 17</text>
                              <text x="250" y="30" fontSize="13" fill="#999">(1,2): 7 + 11 = 18</text>
                              <text x="250" y="55" fontSize="13" fill="#999">(1,3): 7 + 15 = 22</text>
                              <text x="250" y="80" fontSize="13" fill="#999">(2,3): 11 + 15 = 26</text>
                            </g>
                            
                            <g transform="translate(150, 320)">
                              <rect width="400" height="50" fill="#e8f5e9" stroke="#4caf50" strokeWidth="2" rx="8"/>
                              <text x="200" y="32" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#2e7d32">✅ Found at first pair! Return [0, 1]</text>
                            </g>
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* Step-by-Step Walkthrough below visualization */}
                  <div className="mt-4 p-4 rounded-lg border-l-4 border-amber-400" style={{ background: 'rgb(254, 253, 251)' }}>
                    <div className="flex items-center gap-2 mb-3 text-amber-700 font-semibold">
                      <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4" />
                      Step-by-Step Walkthrough
                    </div>
                    <div className="space-y-3">
                      {(() => {
                        const approachKey = selectedApproach?.toLowerCase() || '';
                        const approachName = currentApproach?.name?.toLowerCase() || '';
                        
                        // Hash Map walkthrough
                        if (approachKey.includes('hash') || approachName.includes('hash')) {
                          return (
                            <>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">Initialize empty hash map</div>
                                  <div className="text-gray-500 text-xs">Map will store {'{'}value → index{'}'} pairs</div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">Check value 2: Need 9-2=7</div>
                                  <div className="text-gray-500 text-xs">7 not in map yet, add {'{'}2 → 0{'}'}</div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">✅ Check value 7: Need 9-7=2</div>
                                  <div className="text-gray-500 text-xs">2 IS in map at index 0! Return [0, 1]</div>
                                </div>
                              </div>
                            </>
                          );
                        }
                        
                        // Two Pointers walkthrough
                        if (approachKey.includes('pointer') || approachName.includes('pointer')) {
                          return (
                            <>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">Sort array (already sorted here)</div>
                                  <div className="text-gray-500 text-xs">Array: [2, 7, 11, 15]. Set left=0, right=3</div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">Check: 2 + 15 = 17 &gt; 9</div>
                                  <div className="text-gray-500 text-xs">Sum too large, move right pointer left (right = 2)</div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">Check: 2 + 11 = 13 &gt; 9</div>
                                  <div className="text-gray-500 text-xs">Still too large, move right pointer left (right = 1)</div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">4</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">✅ Check: 2 + 7 = 9</div>
                                  <div className="text-gray-500 text-xs">Match found! Return [0, 1]</div>
                                </div>
                              </div>
                            </>
                          );
                        }
                        
                        // Binary Search walkthrough
                        if (approachKey.includes('binary') || approachName.includes('binary') || approachName.includes('sorting')) {
                          return (
                            <>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">Sort array while preserving indices</div>
                                  <div className="text-gray-500 text-xs">Store (value, original_index) pairs and sort by value</div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">For element 2, binary search for 7</div>
                                  <div className="text-gray-500 text-xs">Need: 9 - 2 = 7. Search in [7, 11, 15]</div>
                                </div>
                              </div>
                              <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                                <div>
                                  <div className="font-semibold text-gray-800 text-sm">✅ Found 7 at original index 1</div>
                                  <div className="text-gray-500 text-xs">Return original indices [0, 1]</div>
                                </div>
                              </div>
                            </>
                          );
                        }
                        
                        // Brute Force walkthrough (default)
                        return (
                          <>
                            <div className="flex gap-3 items-start">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                              <div>
                                <div className="font-semibold text-gray-800 text-sm">Start with first element</div>
                                <div className="text-gray-500 text-xs">Pick nums[0] = 2, check all pairs</div>
                              </div>
                            </div>
                            <div className="flex gap-3 items-start">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                              <div>
                                <div className="font-semibold text-gray-800 text-sm">✅ Check pair (0, 1): 2 + 7 = 9</div>
                                <div className="text-gray-500 text-xs">Match found on first pair! Return [0, 1]</div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Code Section - Terminal Style */}
          {currentApproach && (
            <div className="px-6 py-5 border-b border-amber-200/50">
              <div 
                className="flex justify-between items-center cursor-pointer select-none" 
                onClick={() => toggleSection('code')}
              >
                <div className="flex items-center gap-3">
                  <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                    <FontAwesomeIcon icon={faCode} className="w-5 h-5 text-gray-400" />
                    Code -
                  </h2>
                  {/* Language Pills */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(problem?.isSql 
                      ? [{ id: 'sql', name: 'SQL', extension: 'sql' }] 
                      : LANGUAGE_CONFIG
                    ).map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => {
                          setSolutionLanguage(lang.id);
                          setSelectedLanguage(lang.id);
                          // Update editor with default code for the selected language
                          if (problem?.defaultCode?.[lang.id]) {
                            setCode(problem.defaultCode[lang.id]);
                          }
                          // Reset test results to initial state
                          if (problem?.testCases) {
                            setTestResults(problem.testCases.map((tc, idx) => ({
                              id: idx,
                              params: { ...tc.params },
                              expected: tc.expected_output,
                              actual: '',
                              passed: null,
                              error: null,
                              time: '0',
                              memory: '0 KB',
                              status: 'Not Run',
                              running: false
                            })));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          solutionLanguage === lang.id 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${expandedSections.code ? '' : '-rotate-90'}`}
                />
              </div>
              {expandedSections.code && currentApproach.code?.[solutionLanguage] && (
                <div className="mt-4 rounded-xl overflow-hidden border-2 border-amber-200">
                  {/* Terminal Header - traffic lights left, filename right */}
                  <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-400"></span>
                      <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                      <span className="w-3 h-3 rounded-full bg-green-400"></span>
                    </div>
                    <span className="text-gray-600 text-sm font-mono">
                      solution.{LANGUAGE_CONFIG.find(l => l.id === solutionLanguage)?.extension} — {LANGUAGE_CONFIG.find(l => l.id === solutionLanguage)?.name}
                    </span>
                  </div>
                  {/* Terminal Body with sticky copy button */}
                  <div className="relative bg-amber-50/30 overflow-auto max-h-96">
                    <button 
                      onClick={() => {
                        setCode(currentApproach.code?.[solutionLanguage] || '');
                        setSolutionCodeCopied(true);
                        setTimeout(() => setSolutionCodeCopied(false), 2000);
                      }}
                      className={`sticky top-2 float-right mr-3 mt-2 p-1.5 rounded border transition-all z-10 ${
                        solutionCodeCopied 
                          ? 'text-green-600 bg-green-50 border-green-300' 
                          : 'text-gray-400 border-transparent hover:text-gray-600 hover:border-amber-200'
                      }`}
                      title={solutionCodeCopied ? 'Copied to Editor!' : 'Copy to Editor'}
                    >
                      <FontAwesomeIcon icon={solutionCodeCopied ? faCheck : faPaste} className="w-4 h-4" />
                    </button>
                    <pre className="text-sm font-mono leading-relaxed text-gray-800 whitespace-pre-wrap p-4 pt-0">
                      <code dangerouslySetInnerHTML={{ __html: highlightCode(currentApproach.code[solutionLanguage] || '', solutionLanguage) }} />
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time & Space Complexity */}
          {currentApproach && (
            <div className="px-6 py-5 border-b border-amber-200/50">
              <div 
                className="flex justify-between items-center cursor-pointer select-none" 
                onClick={() => toggleSection('complexity')}
              >
                <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <FontAwesomeIcon icon={faChartLine} className="w-5 h-5 text-gray-400" />
                  Time & Space Complexity
                </h2>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${expandedSections.complexity ? '' : '-rotate-90'}`}
                />
              </div>
              {expandedSections.complexity && (
                <div className="mt-4 space-y-4">
                  {/* Time Complexity Card */}
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-white border-b border-gray-100">
                      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Time Complexity</div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⏱️</span>
                        <span className={`text-3xl font-bold font-mono ${getComplexityColor(currentApproach.complexity?.time, 'time')}`}>
                          {currentApproach.complexity?.time}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50">
                      <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                        {currentApproach.complexity?.time === 'O(n)' 
                          ? 'We make only ONE pass through the array. For each element, hash map lookup and insertion are O(1) operations. Total: n elements × O(1) = O(n).'
                          : currentApproach.complexity?.time?.includes('log')
                          ? 'Sorting takes O(n log n) time. The subsequent traversal takes O(n) time. Total: O(n log n).'
                          : 'For each element, we check all other elements, resulting in n × n comparisons.'
                        }
                      </p>
                      {/* Progress Bars */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 w-6">n</span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                getComplexityLevel(currentApproach.complexity?.time) === 'good' ? 'bg-green-500' :
                                getComplexityLevel(currentApproach.complexity?.time) === 'medium' ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`} 
                              style={{ width: '50%' }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 w-6">2n</span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                getComplexityLevel(currentApproach.complexity?.time) === 'good' ? 'bg-green-500' :
                                getComplexityLevel(currentApproach.complexity?.time) === 'medium' ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`} 
                              style={{ width: '85%' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                        getComplexityLevel(currentApproach.complexity?.time) === 'good' ? 'bg-green-100 text-green-600' :
                        getComplexityLevel(currentApproach.complexity?.time) === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        <span>✓</span> {getComplexityLevel(currentApproach.complexity?.time) === 'good' ? 'Linear Growth' : getComplexityLevel(currentApproach.complexity?.time) === 'medium' ? 'Linearithmic' : 'Quadratic'}
                      </span>
                    </div>
                  </div>

                  {/* Space Complexity Card */}
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-white border-b border-gray-100">
                      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Space Complexity</div>
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faMicrochip} className={`w-6 h-6 ${getComplexityColor(currentApproach.complexity?.space, 'space')}`} />
                        <span className={`text-3xl font-bold font-mono ${getComplexityColor(currentApproach.complexity?.space, 'space')}`}>
                          {currentApproach.complexity?.space}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50">
                      <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                        {currentApproach.complexity?.space === 'O(1)' 
                          ? 'Only constant extra space is used for variables.'
                          : 'In the worst case, we might store all n elements in the hash map before finding the solution. Space usage grows linearly with input size.'
                        }
                      </p>
                      {/* Progress Bars */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 w-6">n</span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                currentApproach.complexity?.space === 'O(1)' ? 'bg-green-500' : 'bg-yellow-500'
                              }`} 
                              style={{ width: currentApproach.complexity?.space === 'O(1)' ? '20%' : '60%' }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 w-6">2n</span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                currentApproach.complexity?.space === 'O(1)' ? 'bg-green-500' : 'bg-yellow-500'
                              }`} 
                              style={{ width: currentApproach.complexity?.space === 'O(1)' ? '40%' : '100%' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                        currentApproach.complexity?.space === 'O(1)' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        <span>⚡</span> {currentApproach.complexity?.space === 'O(1)' ? 'Constant Space' : 'Linear Space'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Constraints Section */}
          <div className="px-6 py-5">
            <div 
              className="flex justify-between items-center cursor-pointer select-none" 
              onClick={() => toggleSection('constraints')}
            >
              <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5 text-gray-400" />
                Constraints
              </h2>
              <FontAwesomeIcon 
                icon={faChevronDown} 
                className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${expandedSections.constraints ? '' : '-rotate-90'}`}
              />
            </div>
            {expandedSections.constraints && (
              <div className="mt-4 p-5 rounded-xl border border-amber-200 bg-amber-50/30">
                <ul className="space-y-3">
                  {problem.constraints?.map((c, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-700 text-sm">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span dangerouslySetInnerHTML={{ __html: c }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalogyPanel = () => {
    if (!problem) return null;

    // Markdown to HTML converter for rich analogy content
    const mdToHtml = (text: string): string => {
      if (!text) return '';
      return text
        // Convert \n to actual newlines (JSON escape)
        .replace(/\\n/g, '\n')
        // Bold: **text** → <strong>text</strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Bullet lines: - text → <li>text</li>
        .replace(/^- (.+)$/gm, '<li style="margin-bottom: 6px; color: #4b5563; font-size: 14px; line-height: 1.6;">$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul style="list-style: none; padding-left: 8px; margin: 10px 0;">$1</ul>')
        // Paragraphs: double newline → paragraph break
        .replace(/\n\n/g, '</p><p style="color: #4b5563; font-size: 14px; line-height: 1.7; margin: 0 0 10px 0;">')
        // Single newlines → <br>
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^/, '<p style="color: #4b5563; font-size: 14px; line-height: 1.7; margin: 0 0 10px 0;">')
        .replace(/$/, '</p>')
        // Clean up: remove <p> wrapping around <ul>
        .replace(/<p[^>]*>\s*(<ul)/g, '$1')
        .replace(/<\/ul>\s*<\/p>/g, '</ul>')
        // Clean up empty paragraphs
        .replace(/<p[^>]*>\s*<\/p>/g, '');
    };

    const renderMarkdown = (text: string) => (
      <div dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />
    );
    
    return (
    <div className="h-full overflow-y-auto bg-white p-6">
      {/* Analogy Card */}
      <div className="rounded-xl border border-gray-200 p-5 mb-5" style={{ background: '#f9fbfd' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{problem.analogy?.icon || '💡'}</span>
          <h3 className="text-lg font-bold text-gray-900">{problem.analogy?.title || 'Understanding the Problem'}</h3>
        </div>
        {problem.analogy?.description && (
          <div className="text-gray-700 text-sm leading-relaxed">
            {renderMarkdown(problem.analogy.description)}
          </div>
        )}
      </div>
      
      {/* Approach Cards — each approach gets its own card */}
      {problem.analogy?.approaches && problem.analogy.approaches.length > 0 && 
        problem.analogy.approaches.map((approach, idx) => (
          <div key={approach.key} className="rounded-xl border-l-4 mb-4" style={{ 
            borderColor: idx === 0 ? '#f97316' : idx === problem.analogy.approaches.length - 1 ? brandTheme.colors.primary : '#6b7280', 
            background: 'rgb(254, 253, 251)' 
          }}>
            <div className="p-5">
              <div className="flex gap-3 items-center mb-3">
                <div 
                  className="w-7 h-7 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ 
                    background: idx === 0 ? '#f97316' : 
                               idx === problem.analogy.approaches.length - 1 ? brandTheme.colors.primary : 
                               '#6b7280'
                  }}
                >
                  {idx + 1}
                </div>
                <div className="font-bold text-gray-900 text-sm">{approach.label}</div>
              </div>
              <div className="ml-10">
                {renderMarkdown(approach.content)}
              </div>
            </div>
          </div>
        ))
      }

      {/* Key Insight */}
      {problem.analogy?.keyInsight && (
        <div className="mb-5 p-4 rounded-lg flex items-start gap-3" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}15, ${brandTheme.colors.primary}08)`, border: `1px solid ${brandTheme.colors.primary}30` }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: brandTheme.colors.primary }}>
            <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold mb-1 text-sm" style={{ color: brandTheme.colors.primary }}>Key Insight</div>
            <div className="text-sm leading-relaxed" style={{ color: brandTheme.colors.primary }} dangerouslySetInnerHTML={{ __html: problem.analogy.keyInsight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          </div>
        </div>
      )}
    </div>
    );
  };

  const renderAIPanel = () => (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto p-5">
        {aiMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-6">
              <FontAwesomeIcon icon={faRobot} className="text-6xl text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">AI Assistant</h3>
            <p className="text-gray-500 max-w-xs mb-5">Ask questions about this problem and get instant help.</p>
            <button 
              onClick={() => {
                setAiMessages([{ role: 'assistant', content: "Hi there! I'm your AI Reading Assistant. Ask me about the content!" }]);
                setAiInput(`Please Simplify the following problem statement for me.\n\n${stripHtml(problem?.description || '')}`);
              }}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              Start Chat
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {aiMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'gap-3'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                    <FontAwesomeIcon icon={faRobot} className="text-white text-lg" />
                  </div>
                )}
                <div className={`${msg.role === 'user' ? 'max-w-[80%]' : 'flex-1'}`}>
                  {msg.role === 'assistant' && (
                    <div className="font-semibold text-gray-900 mb-1">AI Assistant</div>
                  )}
                  <div className={`${
                    msg.role === 'user' 
                      ? 'p-3 bg-green-600 text-white rounded-2xl rounded-br-sm' 
                      : 'text-gray-700'
                  }`}>
                    {msg.content === '...' ? (
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      </div>
                    ) : msg.role === 'assistant' ? (
                      renderMarkdown(msg.content)
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Input Area */}
      {aiMessages.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* Text input */}
            <div className="p-4">
              <textarea 
                value={aiInput.split('\n\n')[0] || ''} 
                onChange={(e) => {
                  const problemDesc = aiInput.includes('\n\n') ? '\n\n' + aiInput.split('\n\n').slice(1).join('\n\n') : '';
                  setAiInput(e.target.value + problemDesc);
                }} 
                onKeyDown={(e) => { 
                  if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    sendAIMessage(); 
                  } 
                }} 
                placeholder="Add more context if you like..." 
                className="w-full text-gray-800 resize-none focus:outline-none bg-transparent" 
                rows={1} 
              />
            </div>
            
            {/* Problem description quote box */}
            {aiInput.includes('\n\n') && (
              <div className="mx-4 mb-4 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                <p className="text-gray-700 italic text-sm leading-relaxed">
                  {aiInput.split('\n\n').slice(1).join('\n\n')}
                </p>
              </div>
            )}
            
            {/* Footer with send button */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-400">
                <span className="font-mono">⌥+Enter</span> for new line | AI can make mistakes. Verify important information.
              </div>
              <button 
                onClick={sendAIMessage} 
                className="w-10 h-10 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center justify-center transition"
              >
                <FontAwesomeIcon icon={faArrowUp} className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCodeEditor = () => (
    <div 
      ref={editorContainerRef}
      className={`h-full flex flex-col ${
        editorState === 'maximized' ? 'fixed inset-0 z-[2000]' : ''
      }`} 
      style={{ backgroundColor: '#f3f4f6' }}
    >
      {/* Top Toolbar - clean simple design */}
      <div className="flex items-center justify-between px-3 py-1" style={{ backgroundColor: '#f3f4f6' }}>
        <div className="flex items-center gap-4">
          {/* Run Button */}
          <button 
            onClick={runCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 text-xs font-medium"
          >
            {isRunning ? (
              <>
                <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Running...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPlay} className="w-2.5 h-2.5" />
                <span>Run</span>
              </>
            )}
          </button>
          
          {/* Explain */}
          <button 
            onClick={() => handleAIOperation('explain')}
            disabled={aiOperationLoading !== null}
            className={`flex items-center gap-1 text-xs transition-all ${
              aiOperationLoading === 'explain' 
                ? 'text-blue-600' 
                : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            {aiOperationLoading === 'explain' ? (
              <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <FontAwesomeIcon icon={faCircleInfo} className="w-3 h-3" />
            )}
            <span>Explain</span>
          </button>
          
          {/* Fix */}
          <button 
            onClick={() => handleAIOperation('fix')}
            disabled={aiOperationLoading !== null}
            className={`flex items-center gap-1 text-xs transition-all ${
              aiOperationLoading === 'fix' 
                ? 'text-orange-600' 
                : 'text-gray-500 hover:text-orange-600'
            }`}
          >
            {aiOperationLoading === 'fix' ? (
              <span className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <FontAwesomeIcon icon={faWrench} className="w-3 h-3" />
            )}
            <span>Fix</span>
          </button>
          
          {/* Suggest */}
          <button 
            onClick={() => handleAIOperation('suggest')}
            disabled={aiOperationLoading !== null}
            className={`flex items-center gap-1 text-xs transition-all ${
              aiOperationLoading === 'suggest' 
                ? 'text-amber-600' 
                : 'text-gray-500 hover:text-amber-600'
            }`}
          >
            {aiOperationLoading === 'suggest' ? (
              <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <FontAwesomeIcon icon={faLightbulb} className="w-3 h-3" />
            )}
            <span>Suggest</span>
          </button>
          
          {/* Format */}
          <button 
            onClick={() => handleAIOperation('format')}
            disabled={aiOperationLoading !== null}
            className={`flex items-center gap-1 text-xs transition-all ${
              aiOperationLoading === 'format' 
                ? 'text-purple-600' 
                : 'text-gray-500 hover:text-purple-600'
            }`}
          >
            {aiOperationLoading === 'format' ? (
              <span className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <FontAwesomeIcon icon={faPenToSquare} className="w-3 h-3" />
            )}
            <span>Format</span>
          </button>
          
          {/* Help */}
          <button 
            onClick={() => setShowHelpModal(true)}
            className="text-gray-400 hover:text-gray-600 transition-all"
            title="AI Features Help"
          >
            <FontAwesomeIcon icon={faCircleQuestion} className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Right side icons */}
        <div className="flex items-center gap-2">
          {/* Language Dropdown */}
          <div className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs cursor-pointer">
            <FontAwesomeIcon icon={faCode} className="w-3 h-3 text-gray-400" />
            <select 
              value={selectedLanguage}
              onChange={(e) => {
                const newLang = e.target.value;
                setSelectedLanguage(newLang);
                setSolutionLanguage(newLang);
                // Update editor with default code for the selected language
                if (problem?.defaultCode?.[newLang]) {
                  setCode(problem.defaultCode[newLang]);
                }
                // Reset test results to initial state
                if (problem?.testCases) {
                  setTestResults(problem.testCases.map((tc, idx) => ({
                    id: idx,
                    params: { ...tc.params },
                    expected: tc.expected_output,
                    actual: '',
                    passed: null,
                    error: null,
                    time: '0',
                    memory: '0 KB',
                    status: 'Not Run',
                    running: false
                  })));
                }
              }}
              className="bg-transparent text-gray-600 cursor-pointer focus:outline-none text-xs"
            >
              {(problem?.isSql 
                ? [{ id: 'sql', name: 'SQL', extension: 'sql' }] 
                : LANGUAGE_CONFIG
              ).map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCodeCopied(true);
              setTimeout(() => setCodeCopied(false), 2000);
            }} 
            className={`p-1 transition-all ${codeCopied ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`} 
            title={codeCopied ? 'Copied!' : 'Copy'}
          >
            <FontAwesomeIcon icon={codeCopied ? faCheck : faCopy} className="w-3.5 h-3.5" />
          </button>
          {/* Minimize Button - only show when not maximized */}
          {editorState !== 'maximized' && (
            <button 
              onClick={() => setEditorState(editorState === 'minimized' ? 'normal' : 'minimized')}
              className="p-1 text-gray-400 hover:text-gray-600 transition-all" 
              title={editorState === 'minimized' ? 'Restore' : 'Minimize Editor'}
            >
              <FontAwesomeIcon icon={editorState === 'minimized' ? faExpand : faCompress} className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Maximize/Restore Button */}
          <button 
            onClick={() => setEditorState(editorState === 'maximized' ? 'normal' : 'maximized')}
            className="p-1 text-gray-400 hover:text-gray-600 transition-all" 
            title={editorState === 'maximized' ? 'Restore' : 'Maximize Editor'}
          >
            <FontAwesomeIcon icon={editorState === 'maximized' ? faCompress : faExpand} className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Code Editor Box - with margin and rounded corners */}
      <div 
        className="mt-1 mr-2 flex flex-col rounded-xl overflow-hidden bg-white shadow-sm border border-gray-200 transition-all duration-300"
        style={{ 
          height: outputPanelState === 'minimized' 
            ? 'calc(100% - 100px)' 
            : outputPanelState === 'expanded'
            ? '200px'
            : `calc(${editorHeight}% - 50px)` 
        }}
      >
        {/* Monaco Code Editor */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage}
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: 'on',
              folding: false,
              stickyScroll: { enabled: false },
              lineNumbersMinChars: 3,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'line',
              renderLineHighlightOnlyWhenFocus: false,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              overviewRulerLanes: 0,
              guides: {
                indentation: false,
                bracketPairs: false,
                highlightActiveIndentation: false,
              },
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
            onMount={(editor, monaco) => {
              // Store editor reference
              monacoEditorRef.current = editor;
              
              // Define custom theme with the background color
              monaco.editor.defineTheme('customLight', {
                base: 'vs',
                inherit: true,
                rules: [],
                colors: {
                  'editor.background': '#FEFDFB',
                  'editorLineNumber.foreground': '#9ca3af',
                  'editorLineNumber.activeForeground': '#6b7280',
                  'editor.lineHighlightBackground': '#f5f5f0',
                  'editor.lineHighlightBorder': '#00000000',
                }
              });
              monaco.editor.setTheme('customLight');
              
              // Track cursor position
              editor.onDidChangeCursorPosition((e) => {
                setCursorPosition({
                  line: e.position.lineNumber,
                  col: e.position.column
                });
              });
              
              // Detect slash commands
             editor.onDidChangeModelContent(() => {
                const model = editor.getModel();
                if (!model) return;
                
                const position = editor.getPosition();
                if (!position) return;
                
                const lineContent = model.getLineContent(position.lineNumber);
                const textBeforeCursor = lineContent.substring(0, position.column - 1);
                
                // Check if user typed a slash at the beginning of line or after whitespace
                const slashMatch = textBeforeCursor.match(/(?:^|\s)(\/\w*)$/);
                
                if (slashMatch) {
                  const slashText = slashMatch[1];
                  setSlashFilter(slashText.substring(1)); // Remove the leading /
                  setSlashCommandLine(position.lineNumber);
                  setSelectedSlashIndex(0);
                  
                  // Get cursor coordinates for menu positioning
                  const editorDomNode = editor.getDomNode();
                  if (editorDomNode) {
                    const cursorCoords = editor.getScrolledVisiblePosition(position);
                    if (cursorCoords) {
                      const editorRect = editorDomNode.getBoundingClientRect();
                      setSlashMenuPosition({
                        x: editorRect.left + cursorCoords.left,
                        y: editorRect.top + cursorCoords.top + 24
                      });
                      setShowSlashMenu(true);
                    }
                  }
                } else {
                  // Hide menu if no slash command
                  if (showSlashMenu) {
                    setShowSlashMenu(false);
                    setSlashFilter('');
                  }
                }
              });
              
              // Close slash menu on blur
              editor.onDidBlurEditorText(() => {
                // Delay to allow click on menu items
                setTimeout(() => {
                  setShowSlashMenu(false);
                  setSlashFilter('');
                }, 200);
              });
            }}
          />
        </div>

        {/* Status Bar - Ln, Col */}
        <div 
          className="px-4 py-1 text-right border-t"
          style={{ backgroundColor: 'rgb(254, 253, 251)', borderColor: '#f0ebe0' }}
        >
          <span className="text-xs text-gray-400 font-mono">Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
        </div>
      </div>

      {/* Vertical Resizer */}
      <div 
        className="h-2 mr-2 cursor-row-resize flex items-center justify-center z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsVerticalResizing(true);
        }}
      >
        <div 
          className={`w-12 h-1 rounded-full transition-all ${
            isVerticalResizing ? 'bg-green-500' : 'bg-gray-300 hover:bg-green-400'
          }`}
        />
      </div>

      {/* Output Panel Box - with margin and rounded corners */}
      <div 
        className={`mb-2 mr-2 flex flex-col rounded-xl overflow-hidden bg-white shadow-sm border border-gray-200 transition-all duration-300 ${
          outputPanelState === 'minimized' ? 'h-[42px]' : 
          outputPanelState === 'expanded' ? 'flex-1 min-h-[300px]' : 
          'flex-1 min-h-[100px]'
        }`}
      >
        {/* Output Tabs Header */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-0">
            {/* Output Tab */}
            <button
              onClick={() => setActiveOutputTab('output')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 ${
                activeOutputTab === 'output' 
                  ? 'text-green-600 border-green-500' 
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <FontAwesomeIcon icon={faTerminal} className="w-4 h-4 text-gray-400" />
              <span>Output</span>
            </button>
            
            {/* Stdin Tab */}
            <button
              onClick={() => setActiveOutputTab('stdin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 ${
                activeOutputTab === 'stdin' 
                  ? 'text-green-600 border-green-500' 
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <FontAwesomeIcon icon={faKeyboard} className="w-4 h-4" />
              <span>Stdin</span>
            </button>
            
            {/* Test Cases Tab */}
            <button
              onClick={() => setShowTestCasesPanel(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 ${
                activeOutputTab === 'testcases' 
                  ? 'text-green-600 border-green-500' 
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <FontAwesomeIcon icon={faClipboardList} className="w-4 h-4" />
              <span>Test Cases</span>
              {/* Badge showing passed/total */}
              {testResults.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  testResults.filter(r => r.passed === true).length === testResults.length && testResults.some(r => r.passed !== null)
                    ? 'bg-green-100 text-green-600'
                    : testResults.some(r => r.passed === false)
                    ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {testResults.filter(r => r.passed === true).length}/{testResults.length}
                </span>
              )}
            </button>
            
            {/* Refresh/Reset */}
            <button 
              onClick={() => {
                setOutput('');
                setStdinInput('');
                setExecutionStats(null);
              }} 
              className="p-1.5 ml-1 text-gray-400 hover:text-gray-600 rounded"
              title="Reset Output & Stdin"
            >
              <FontAwesomeIcon icon={faRotate} className="w-4 h-4" />
            </button>
          </div>
          
          {/* Right side - colored circles */}
          <div className="flex items-center gap-1.5 pr-2">
            <button 
              onClick={() => setShowHelpModal(true)}
              className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center hover:bg-blue-600" 
              title="AI Features Help"
            >
              <FontAwesomeIcon icon={faInfo} className="w-2.5 h-2.5" />
            </button>
            <button 
              onClick={() => setOutputPanelState(outputPanelState === 'minimized' ? 'normal' : 'minimized')}
              className="w-5 h-5 rounded-full bg-orange-400 text-white text-xs flex items-center justify-center hover:bg-orange-500" 
              title={outputPanelState === 'minimized' ? 'Restore' : 'Minimize'}
            >
              <FontAwesomeIcon icon={faMinus} className="w-2.5 h-2.5" />
            </button>
            <button 
              onClick={() => setOutputPanelState(outputPanelState === 'expanded' ? 'normal' : 'expanded')}
              className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center hover:bg-green-600" 
              title={outputPanelState === 'expanded' ? 'Restore' : 'Expand'}
            >
              <FontAwesomeIcon icon={faPlus} className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
        
        {/* Output Content - hidden when minimized */}
        {outputPanelState !== 'minimized' && (
          <div className="flex-1 p-4 overflow-auto bg-gray-50">
          {activeOutputTab === 'output' ? (
            <div className="h-full">
              {/* AI Operation Loading State */}
              {aiOperationLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <div className="relative mb-4">
                    <FontAwesomeIcon icon={faRobot} className="w-12 h-12 text-green-500" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
                      <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">
                    {aiOperationLoading === 'explain' && 'Analyzing your code...'}
                    {aiOperationLoading === 'fix' && 'Finding and fixing issues...'}
                    {aiOperationLoading === 'suggest' && 'Generating suggestions...'}
                    {aiOperationLoading === 'format' && 'Formatting code...'}
                    {aiOperationLoading === 'tests' && 'Generating tests...'}
                    {aiOperationLoading === 'docs' && 'Creating documentation...'}
                    {aiOperationLoading === 'optimize' && 'Optimizing performance...'}
                  </p>
                  <p className="text-gray-400 text-sm">This may take a few seconds...</p>
                </div>
              ) : output ? (
                <div>
                  <pre className="font-mono text-sm text-green-600 whitespace-pre-wrap">{output}</pre>
                  {executionStats && (
                    <div className="mt-2 text-xs text-gray-500 font-mono">
                      <span className="text-gray-400">✓</span> Executed in {executionStats.time} <span className="text-gray-400">✓</span> Memory: {executionStats.memory}
                    </div>
                  )}
                </div>
              ) : (
                <pre className="font-mono text-sm text-gray-400 italic">// Output will appear here after running code</pre>
              )}
            </div>
          ) : activeOutputTab === 'stdin' ? (
            <textarea
              value={stdinInput}
              onChange={(e) => setStdinInput(e.target.value)}
              placeholder="Enter input for your program..."
              className="w-full h-full bg-transparent text-gray-800 font-mono text-sm resize-none focus:outline-none"
            />
          ) : (
            /* Test Cases Tab Content */
            <div className="space-y-3 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No test cases available</p>
              ) : (
                testResults.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border ${
                      result.passed === true 
                        ? 'bg-green-50 border-green-200' 
                        : result.passed === false 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-700">Test Case {idx + 1}</span>
                      {result.passed === true && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Passed</span>
                      )}
                      {result.passed === false && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">✗ Failed</span>
                      )}
                      {result.passed === null && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Not Run</span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      {problem?.isSql && result.sqlExpectedOutput ? (
                        <>
                          <div>
                            <span className="text-gray-500">Expected: </span>
                            <span className="text-green-700">[{(result.sqlExpectedOutput?.headers || []).join(', ')}] → {normalizeRows(result.sqlExpectedOutput?.rows).length} row(s)</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-gray-500">Input: </span>
                            <span className="text-gray-800">
                              {Object.entries(result.params || {}).map(([key, val]) => `${key}=${val}`).join(', ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Expected: </span>
                            <span className="text-green-700">{result.expected}</span>
                          </div>
                        </>
                      )}
                      {result.actual && (
                        <div>
                          <span className="text-gray-500">Output: </span>
                          <span className={result.passed ? 'text-green-700' : 'text-red-600'}>{result.actual}</span>
                        </div>
                      )}
                      {result.error && (
                        <div className="text-red-600 mt-1">{result.error}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================
  
  // Loading state
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading problem...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !problem) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FontAwesomeIcon icon={faCircleXmark} className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Problem</h2>
          <p className="text-gray-600 mb-4">{error || 'Problem data not found'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-gray-100 font-sans">
      {/* Main Content - Two Panels */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div 
          className={`flex flex-col border-r border-gray-200 overflow-hidden bg-white transition-all ${
            editorState === 'minimized' ? 'flex-1' : ''
          }`}
          style={{ 
            width: editorState === 'minimized' ? 'auto' : editorState === 'maximized' ? '0' : `${leftPanelWidth}%`,
            display: editorState === 'maximized' ? 'none' : 'flex'
          }}
        >
          {/* Left Panel Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
            {/* Left side - Logo + Problem/Solution */}
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="flex items-center justify-center">
                <FontAwesomeIcon icon={faHexagonNodes} className="w-6 h-6 text-gray-400" />
              </div>
              
              {/* Problem / Solution tabs */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setCurrentView('problem'); setRightPanelMode('editor'); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${currentView === 'problem' ? 'text-white' : 'text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                  style={currentView === 'problem' ? { background: brandTheme.gradients.primary } : {}}
                >
                  Problem
                </button>
                <button
                  onClick={() => { setCurrentView('solution'); setRightPanelMode('editor'); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${currentView === 'solution' ? 'text-white' : 'text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                  style={currentView === 'solution' ? { background: brandTheme.gradients.primary } : {}}
                >
                  Solution
                </button>
              </div>
            </div>
            
            {/* Right side - Terminal / Analogy / AI Assistant */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRightPanelMode('editor')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${rightPanelMode === 'editor' ? 'border-gray-400 bg-gray-50 text-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Terminal
              </button>
              <button
                onClick={() => setRightPanelMode('analogy')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${rightPanelMode === 'analogy' ? 'border-gray-400 bg-gray-50 text-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Analogy
              </button>
              <button
                onClick={() => setRightPanelMode('ai')}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all ${rightPanelMode === 'ai' ? '' : 'text-gray-600 hover:text-gray-800'}`}
                style={rightPanelMode === 'ai' ? { color: brandTheme.colors.primary } : {}}
              >
                <FontAwesomeIcon icon={faRobot} className="w-3.5 h-3.5" /> Ai Assistant
              </button>
            </div>
          </div>
          
          {/* Left Panel Content - Always Problem or Solution */}
          <div className="flex-1 overflow-hidden">
            {currentView === 'problem' ? renderProblemPanel() : renderSolutionPanel()}
          </div>
        </div>

        {/* Horizontal Resizer - hidden when minimized or maximized */}
        {editorState === 'normal' && (
          <div 
            className="w-2 cursor-col-resize flex items-center justify-center z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          >
            <div 
              className={`h-12 w-1 rounded-full transition-all ${
                isResizing ? 'bg-green-500' : 'bg-gray-300 hover:bg-green-400'
              }`}
            />
          </div>
        )}

        {/* Right Panel - Editor / Analogy / AI Assistant */}
        {editorState !== 'minimized' && (
          <div 
            className={`flex flex-col overflow-hidden ${
              editorState === 'maximized' ? '' : 'flex-1'
            } ${rightPanelMode !== 'editor' ? 'mt-2 mb-2 mr-2' : ''}`}
            style={rightPanelMode !== 'editor' ? { backgroundColor: '#f3f4f6' } : {}}
          >
            {rightPanelMode === 'editor' && renderCodeEditor()}
            {rightPanelMode === 'analogy' && (
              <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {renderAnalogyPanel()}
              </div>
            )}
            {rightPanelMode === 'ai' && (
              <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {renderAIPanel()}
              </div>
            )}
          </div>
        )}

        {/* Minimized Editor Strip */}
        {editorState === 'minimized' && (
          <div 
            className="w-10 flex flex-col items-center py-3 bg-gray-50 border-l border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setEditorState('normal')}
            title="Restore Editor"
          >
            <FontAwesomeIcon icon={faExpand} className="w-4 h-4 text-gray-500" />
          </div>
        )}
      </div>

      {/* Visualization Modal */}
      {showVisualizationModal && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowVisualizationModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden z-[10001]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="text-lg font-semibold text-gray-900">Visualization</h3>
              </div>
              <button 
                onClick={() => setShowVisualizationModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]" style={{ background: '#f8f9fa' }}>
              {(() => {
                const approachKey = selectedApproach?.toLowerCase() || '';
                const approachName = problem?.approaches?.[selectedApproach]?.name?.toLowerCase() || '';
                
                // Two Pointers visualization
                if (approachKey.includes('pointer') || approachName.includes('pointer')) {
                  return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 580" className="w-full h-auto">
                      <rect width="700" height="580" fill="#f8f9fa"/>
                      
                      {/* Title */}
                      <text x="350" y="35" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#333">Two Pointers: Sort First, Then Search</text>
                      <text x="350" y="58" fontSize="14" textAnchor="middle" fill="#666">Original: [2, 7, 11, 15] → Sorted: [2, 7, 11, 15], Target: 9</text>
                      
                      {/* Step 1 Label */}
                      <text x="530" y="95" fontSize="13" fontWeight="bold" fill="#333">Step 1: Array is already sorted</text>
                      
                      {/* Step 1 - LEFT pointer label */}
                      <text x="135" y="95" fontSize="12" fill="#2196f3" fontWeight="bold" textAnchor="middle">← LEFT</text>
                      
                      {/* Step 1 - RIGHT pointer label */}
                      <text x="465" y="95" fontSize="12" fill="#ff9800" fontWeight="bold" textAnchor="middle">RIGHT →</text>
                      
                      {/* Step 1 Array */}
                      <g transform="translate(90, 110)">
                        <rect x="0" y="0" width="90" height="70" fill="#e3f2fd" stroke="#2196f3" strokeWidth="3" rx="6"/>
                        <text x="45" y="45" fontSize="28" fontWeight="bold" textAnchor="middle" fill="#333">2</text>
                        <text x="45" y="95" fontSize="12" textAnchor="middle" fill="#666">idx: 0</text>
                        
                        <rect x="110" y="0" width="90" height="70" fill="white" stroke="#e0e0e0" strokeWidth="2" rx="6"/>
                        <text x="155" y="45" fontSize="28" textAnchor="middle" fill="#333">7</text>
                        <text x="155" y="95" fontSize="12" textAnchor="middle" fill="#666">idx: 1</text>
                        
                        <rect x="220" y="0" width="90" height="70" fill="white" stroke="#e0e0e0" strokeWidth="2" rx="6"/>
                        <text x="265" y="45" fontSize="28" textAnchor="middle" fill="#333">11</text>
                        <text x="265" y="95" fontSize="12" textAnchor="middle" fill="#666">idx: 2</text>
                        
                        <rect x="330" y="0" width="90" height="70" fill="#fff3e0" stroke="#ff9800" strokeWidth="3" rx="6"/>
                        <text x="375" y="45" fontSize="28" fontWeight="bold" textAnchor="middle" fill="#333">15</text>
                        <text x="375" y="95" fontSize="12" textAnchor="middle" fill="#666">idx: 3</text>
                      </g>
                      
                      {/* First Check Box */}
                      <g transform="translate(115, 260)">
                        <rect width="470" height="110" fill="#fff3e0" stroke="#ff9800" strokeWidth="2" rx="12"/>
                        <text x="235" y="32" fontSize="16" fontWeight="bold" textAnchor="middle" fill="#e65100">🧮 First Check</text>
                        <text x="235" y="55" fontSize="14" textAnchor="middle" fill="#333">Sum = nums[left] + nums[right]</text>
                        <text x="235" y="75" fontSize="14" textAnchor="middle" fill="#333">Sum = 2 + 15 = 17</text>
                        <text x="235" y="98" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#d32f2f">17 {'>'} 9 → Move RIGHT pointer left ←</text>
                      </g>
                      
                      {/* Step 2 Label */}
                      <text x="530" y="400" fontSize="13" fontWeight="bold" fill="#333">Step 2: Move right pointer (right--)</text>
                      
                      {/* Step 2 - LEFT pointer label */}
                      <text x="135" y="400" fontSize="12" fill="#2196f3" fontWeight="bold" textAnchor="middle">← LEFT</text>
                      
                      {/* Step 2 - RIGHT pointer label */}
                      <text x="245" y="400" fontSize="12" fill="#4caf50" fontWeight="bold" textAnchor="middle">RIGHT →</text>
                      
                      {/* Step 2 Array */}
                      <g transform="translate(90, 415)">
                        <rect x="0" y="0" width="90" height="70" fill="#e3f2fd" stroke="#2196f3" strokeWidth="3" rx="6"/>
                        <text x="45" y="45" fontSize="28" fontWeight="bold" textAnchor="middle" fill="#333">2</text>
                        <text x="45" y="95" fontSize="12" textAnchor="middle" fill="#666">idx: 0</text>
                        
                        <rect x="110" y="0" width="90" height="70" fill="#c8e6c9" stroke="#4caf50" strokeWidth="3" rx="6"/>
                        <text x="155" y="45" fontSize="28" fontWeight="bold" textAnchor="middle" fill="#333">7</text>
                        <text x="155" y="95" fontSize="12" textAnchor="middle" fill="#666">idx: 1</text>
                        
                        <rect x="220" y="0" width="90" height="70" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" rx="6"/>
                        <text x="265" y="45" fontSize="28" textAnchor="middle" fill="#bbb">11</text>
                        
                        <rect x="330" y="0" width="90" height="70" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" rx="6"/>
                        <text x="375" y="45" fontSize="28" textAnchor="middle" fill="#bbb">15</text>
                      </g>
                      
                      {/* Result */}
                      <text x="350" y="555" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#4caf50">✓ Sum = 2 + 7 = 9 (Match!)</text>
                    </svg>
                  );
                }
                
                // Hash Map visualization
                if (approachKey.includes('hash') || approachName.includes('hash')) {
                  return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 520" className="w-full h-auto">
                      <rect width="700" height="520" fill="#f8f9fa"/>
                      <text x="350" y="35" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#333">Hash Map: {problem?.approaches?.[selectedApproach]?.name || 'Hash Table Solution'}</text>
                      <text x="350" y="60" fontSize="14" textAnchor="middle" fill="#666">Array: [2, 7, 11, 15], Target: 9</text>
                      
                      {/* Array */}
                      <g transform="translate(60, 100)">
                        <text x="0" y="-10" fontSize="14" fontWeight="bold" fill="#333">Array</text>
                        <rect x="0" y="0" width="70" height="55" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" rx="4"/>
                        <text x="35" y="35" fontSize="22" fontWeight="bold" textAnchor="middle">2</text>
                        <text x="35" y="70" fontSize="11" textAnchor="middle" fill="#666">i=0</text>
                        
                        <rect x="85" y="0" width="70" height="55" fill="#c8e6c9" stroke="#4caf50" strokeWidth="2" rx="4"/>
                        <text x="120" y="35" fontSize="22" fontWeight="bold" textAnchor="middle">7</text>
                        <text x="120" y="70" fontSize="11" textAnchor="middle" fill="#666">i=1</text>
                        
                        <rect x="170" y="0" width="70" height="55" fill="white" stroke="#ddd" strokeWidth="1" rx="4"/>
                        <text x="205" y="35" fontSize="22" textAnchor="middle">11</text>
                        <text x="205" y="70" fontSize="11" textAnchor="middle" fill="#666">i=2</text>
                        
                        <rect x="255" y="0" width="70" height="55" fill="white" stroke="#ddd" strokeWidth="1" rx="4"/>
                        <text x="290" y="35" fontSize="22" textAnchor="middle">15</text>
                        <text x="290" y="70" fontSize="11" textAnchor="middle" fill="#666">i=3</text>
                      </g>
                      
                      {/* Hash Map */}
                      <g transform="translate(420, 100)">
                        <text x="0" y="-10" fontSize="14" fontWeight="bold" fill="#333">Hash Map {'{'} value → index {'}'}</text>
                        <rect x="0" y="0" width="220" height="45" fill="#fff3e0" stroke="#ff9800" strokeWidth="2" rx="6"/>
                        <text x="110" y="30" fontSize="15" textAnchor="middle" fill="#333">2 → 0</text>
                      </g>
                      
                      {/* Step 1 */}
                      <g transform="translate(60, 210)">
                        <rect width="580" height="90" fill="#e8f5e9" stroke="#4caf50" strokeWidth="2" rx="10"/>
                        <text x="290" y="30" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#2e7d32">Step 1: Check index 0 (value = 2)</text>
                        <text x="290" y="55" fontSize="14" textAnchor="middle" fill="#333">Need: 9 - 2 = 7. Is 7 in map? NO</text>
                        <text x="290" y="78" fontSize="14" textAnchor="middle" fill="#666">Action: Add {'{'} 2 → 0 {'}'} to map</text>
                      </g>
                      
                      {/* Step 2 */}
                      <g transform="translate(60, 320)">
                        <rect width="580" height="90" fill="#c8e6c9" stroke="#4caf50" strokeWidth="3" rx="10"/>
                        <text x="290" y="30" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#1b5e20">Step 2: Check index 1 (value = 7)</text>
                        <text x="290" y="55" fontSize="14" textAnchor="middle" fill="#333">Need: 9 - 7 = 2. Is 2 in map? YES! At index 0</text>
                        <text x="290" y="78" fontSize="16" fontWeight="bold" textAnchor="middle" fill="#1b5e20">✓ Found pair! Return [0, 1]</text>
                      </g>
                      
                      {/* Result */}
                      <g transform="translate(150, 440)">
                        <rect width="400" height="60" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" rx="10"/>
                        <text x="200" y="28" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#1565c0">✅ Result: [0, 1]</text>
                        <text x="200" y="50" fontSize="14" textAnchor="middle" fill="#333">nums[0] + nums[1] = 2 + 7 = 9</text>
                      </g>
                    </svg>
                  );
                }
                
                // Binary Search visualization
                if (approachKey.includes('binary') || approachName.includes('binary') || approachName.includes('sorting')) {
                  return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 520" className="w-full h-auto">
                      <rect width="700" height="520" fill="#f8f9fa"/>
                      <text x="350" y="35" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#333">Sorting + Binary Search</text>
                      <text x="350" y="60" fontSize="14" textAnchor="middle" fill="#666">Array: [2, 7, 11, 15], Target: 9</text>
                      
                      <g transform="translate(100, 110)">
                        <text x="0" y="-15" fontSize="14" fontWeight="bold" fill="#333">Sorted Array (with original indices)</text>
                        <rect x="0" y="0" width="90" height="70" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" rx="4"/>
                        <text x="45" y="35" fontSize="22" fontWeight="bold" textAnchor="middle">2</text>
                        <text x="45" y="55" fontSize="11" textAnchor="middle" fill="#666">orig: 0</text>
                        
                        <rect x="110" y="0" width="90" height="70" fill="white" stroke="#ddd" strokeWidth="1" rx="4"/>
                        <text x="155" y="35" fontSize="22" textAnchor="middle">7</text>
                        <text x="155" y="55" fontSize="11" textAnchor="middle" fill="#666">orig: 1</text>
                        
                        <rect x="220" y="0" width="90" height="70" fill="white" stroke="#ddd" strokeWidth="1" rx="4"/>
                        <text x="265" y="35" fontSize="22" textAnchor="middle">11</text>
                        <text x="265" y="55" fontSize="11" textAnchor="middle" fill="#666">orig: 2</text>
                        
                        <rect x="330" y="0" width="90" height="70" fill="white" stroke="#ddd" strokeWidth="1" rx="4"/>
                        <text x="375" y="35" fontSize="22" textAnchor="middle">15</text>
                        <text x="375" y="55" fontSize="11" textAnchor="middle" fill="#666">orig: 3</text>
                      </g>
                      
                      <g transform="translate(60, 220)">
                        <rect width="580" height="90" fill="#fff3e0" stroke="#ff9800" strokeWidth="2" rx="10"/>
                        <text x="290" y="30" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#e65100">Step 1: For element 2, search for 7</text>
                        <text x="290" y="55" fontSize="14" textAnchor="middle" fill="#333">Need: 9 - 2 = 7. Binary search for 7 in remaining array</text>
                        <text x="290" y="78" fontSize="14" textAnchor="middle" fill="#666">Search range: [7, 11, 15] → mid = 11 → go left → found 7!</text>
                      </g>
                      
                      <g transform="translate(60, 330)">
                        <rect width="580" height="90" fill="#c8e6c9" stroke="#4caf50" strokeWidth="3" rx="10"/>
                        <text x="290" y="30" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#1b5e20">✓ Binary Search Found 7!</text>
                        <text x="290" y="55" fontSize="14" textAnchor="middle" fill="#333">Element 2 at original index 0, Element 7 at original index 1</text>
                        <text x="290" y="78" fontSize="16" fontWeight="bold" textAnchor="middle" fill="#1b5e20">Return [0, 1]</text>
                      </g>
                      
                      <g transform="translate(150, 450)">
                        <rect width="400" height="55" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" rx="10"/>
                        <text x="200" y="25" fontSize="15" fontWeight="bold" textAnchor="middle" fill="#1565c0">✅ Result: [0, 1]</text>
                        <text x="200" y="45" fontSize="14" textAnchor="middle" fill="#333">nums[0] + nums[1] = 2 + 7 = 9</text>
                      </g>
                    </svg>
                  );
                }
                
                // Brute Force visualization (default)
                return (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 450" className="w-full h-auto">
                    <rect width="700" height="450" fill="#f8f9fa"/>
                    <text x="350" y="35" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#333">Brute Force: Check All Pairs</text>
                    <text x="350" y="60" fontSize="14" textAnchor="middle" fill="#666">Array: [2, 7, 11, 15], Target: 9</text>
                    
                    <g transform="translate(130, 100)">
                      <rect x="0" y="0" width="90" height="70" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" rx="4"/>
                      <text x="45" y="45" fontSize="24" fontWeight="bold" textAnchor="middle">2</text>
                      <text x="45" y="90" fontSize="12" textAnchor="middle" fill="#666">idx: 0</text>
                      
                      <rect x="110" y="0" width="90" height="70" fill="#c8e6c9" stroke="#4caf50" strokeWidth="2" rx="4"/>
                      <text x="155" y="45" fontSize="24" fontWeight="bold" textAnchor="middle">7</text>
                      <text x="155" y="90" fontSize="12" textAnchor="middle" fill="#666">idx: 1</text>
                      
                      <rect x="220" y="0" width="90" height="70" fill="white" stroke="#ddd" strokeWidth="1" rx="4"/>
                      <text x="265" y="45" fontSize="24" textAnchor="middle">11</text>
                      <text x="265" y="90" fontSize="12" textAnchor="middle" fill="#666">idx: 2</text>
                      
                      <rect x="330" y="0" width="90" height="70" fill="white" stroke="#ddd" strokeWidth="1" rx="4"/>
                      <text x="375" y="45" fontSize="24" textAnchor="middle">15</text>
                      <text x="375" y="90" fontSize="12" textAnchor="middle" fill="#666">idx: 3</text>
                    </g>
                    
                    <g transform="translate(120, 230)">
                      <text x="0" y="0" fontSize="15" fontWeight="bold" fill="#333">Pairs to check (O(n²)):</text>
                      <text x="0" y="30" fontSize="14" fill="#4caf50" fontWeight="bold">✓ (0,1): 2 + 7 = 9 ← Match!</text>
                      <text x="0" y="55" fontSize="14" fill="#999">(0,2): 2 + 11 = 13</text>
                      <text x="0" y="80" fontSize="14" fill="#999">(0,3): 2 + 15 = 17</text>
                      <text x="250" y="30" fontSize="14" fill="#999">(1,2): 7 + 11 = 18</text>
                      <text x="250" y="55" fontSize="14" fill="#999">(1,3): 7 + 15 = 22</text>
                      <text x="250" y="80" fontSize="14" fill="#999">(2,3): 11 + 15 = 26</text>
                    </g>
                    
                    <g transform="translate(150, 360)">
                      <rect width="400" height="55" fill="#e8f5e9" stroke="#4caf50" strokeWidth="2" rx="10"/>
                      <text x="200" y="35" fontSize="16" fontWeight="bold" textAnchor="middle" fill="#2e7d32">✅ Found at first pair! Return [0, 1]</text>
                    </g>
                  </svg>
                );
              })()}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
              🔍 Pinch / Scroll to zoom
            </div>
          </div>
        </div>
      )}

      {/* Problem Visualization Modal */}
      {showProblemVisualizationModal && problem?.visualize?.svg && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowProblemVisualizationModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden z-[10001]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {problem.visualize.title || 'Problem Visualization'}
                </h3>
              </div>
              <button 
                onClick={() => setShowProblemVisualizationModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]" style={{ background: '#f8f9fa' }}>
              {/* Description */}
              {problem.visualize.description && (
                <p className="text-gray-600 mb-4">{problem.visualize.description}</p>
              )}
              
              {/* SVG Visualization */}
              <div 
                className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto"
                dangerouslySetInnerHTML={{ __html: problem.visualize.svg }} 
              />
              
              {/* Steps */}
              {problem.visualize.steps && problem.visualize.steps.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4" style={{ color: brandTheme.colors.primary }} />
                    Understanding the Visualization
                  </h4>
                  {problem.visualize.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4 items-start">
                      <div 
                        className="w-7 h-7 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: brandTheme.colors.primary }}
                      >
                        {step.stepNumber || idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 mb-1 text-sm">{step.title}</div>
                        <div className="text-gray-600 text-sm leading-relaxed">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Conclusion */}
              {problem.visualize.conclusion && (
                <div className="mt-5 p-4 rounded-lg flex items-start gap-3" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}15, ${brandTheme.colors.primary}08)`, border: `1px solid ${brandTheme.colors.primary}30` }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: brandTheme.colors.primary }}>
                    <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1 text-sm" style={{ color: brandTheme.colors.primary }}>Key Takeaway</div>
                    <div className="text-sm leading-relaxed" style={{ color: brandTheme.colors.primary }} dangerouslySetInnerHTML={{ __html: problem.visualize.conclusion.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
              🔍 Pinch / Scroll to zoom
            </div>
          </div>
        </div>
      )}

      {/* Help Modal - Slide in from right like profile modal */}
      {showHelpModal && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] transition-opacity duration-200"
            onClick={() => setShowHelpModal(false)}
          />
          
          {/* Sidebar Panel */}
          <div 
            className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl z-[10001] rounded-2xl overflow-hidden flex flex-col"
            style={{ animation: 'slideInRight 0.3s ease-out' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faRobot} className="w-5 h-5" />
                <span className="text-lg font-semibold">AI Features Help</span>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
              >
                <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header Buttons Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  <FontAwesomeIcon icon={faGearComplexCode} className="w-4 h-4" />
                  Header Buttons
                </div>
                
                {[
                  { icon: '💡', title: 'Explain', color: 'blue', desc: 'Get a detailed explanation of your code. Select specific code or analyze the entire file. Understand algorithms, logic flow, and complexity.' },
                  { icon: '🔧', title: 'Fix', color: 'red', desc: 'Automatically detect and fix issues in your code. Finds bugs, syntax errors, and common mistakes. Shows you what was fixed.' },
                  { icon: '💡', title: 'Suggest', color: 'purple', desc: 'Get improvement suggestions for your code. Best practices, performance tips, and code quality recommendations.' },
                  { icon: '💬', title: 'Ask AI', color: 'green', desc: 'Open an AI chat assistant to ask any coding questions. Have a conversation about your code, get help with debugging, or learn new concepts.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-3 hover:border-green-300 transition">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      item.color === 'blue' ? 'bg-blue-100' : 
                      item.color === 'red' ? 'bg-red-100' : 
                      item.color === 'purple' ? 'bg-purple-100' : 'bg-green-100'
                    }`}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 mb-1">{item.title}</div>
                      <div className="text-sm text-gray-500 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Smart Actions Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  <FontAwesomeIcon icon={faWandMagicSparkles} className="w-4 h-4" />
                  Smart Actions (Slash Commands)
                </div>
                
                {[
                  { icon: '🔧', title: '/fix', color: 'red', desc: 'Find and fix issues in your code. Detects common problems and applies automatic fixes.' },
                  { icon: '💡', title: '/explain', color: 'blue', desc: 'Get a detailed explanation of what your code does, including time/space complexity analysis.' },
                  { icon: '🧪', title: '/tests', color: 'purple', desc: 'Automatically generate unit tests for your code. Creates comprehensive test cases.' },
                  { icon: '📝', title: '/docs', color: 'green', desc: 'Generate documentation for your code. Creates docstrings, JSDoc comments, and type hints.' },
                  { icon: '⚡', title: '/optimize', color: 'orange', desc: 'Get performance optimization suggestions. Improve speed and reduce memory usage.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-3 hover:border-green-300 transition">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      item.color === 'blue' ? 'bg-blue-100' : 
                      item.color === 'red' ? 'bg-red-100' : 
                      item.color === 'purple' ? 'bg-purple-100' : 
                      item.color === 'orange' ? 'bg-orange-100' : 'bg-green-100'
                    }`}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        {item.title}
                        <code className="px-2 py-0.5 bg-gray-200 rounded text-xs text-green-600">Enter</code>
                      </div>
                      <div className="text-sm text-gray-500 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pro Tip */}
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border-l-4 border-green-500">
                <span className="text-lg">💡</span>
                <div className="text-sm text-gray-700">
                  <strong className="text-green-600">Pro Tip:</strong> Select specific code before using Explain, Fix, or Smart Actions to analyze only that portion. Otherwise, the entire file will be analyzed.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Test Cases Panel (Slide-in from right) */}
      {showTestCasesPanel && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
            onClick={() => setShowTestCasesPanel(false)}
          />
          
          {/* Panel */}
          <div 
            className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white z-[10001] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideInRight 0.3s ease-out' }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faClipboardList} className="w-4 h-4" />
                <div>
                  <span className="text-sm font-extrabold">Test Cases</span>
                  <p className="text-xs text-white/70">{testResults.length} test case{testResults.length !== 1 ? 's' : ''} available</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTestCasesPanel(false)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
              >
                <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
              </button>
            </div>
            
            {/* Summary Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-green-600">
                  <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                  <span>{testResults.filter(r => r.passed === true).length} passed</span>
                </span>
                <span className="flex items-center gap-1.5 text-red-500">
                  <FontAwesomeIcon icon={faCircleXmark} className="w-3 h-3" />
                  <span>{testResults.filter(r => r.passed === false).length} failed</span>
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                  <span>{testResults.filter(r => r.passed === null).length} pending</span>
                </span>
              </div>
              <span className="text-xs text-gray-500">{testResults.length} test cases</span>
            </div>
            
            {/* Test Cases Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {testResults.map((result, idx) => (
                <div 
                  key={idx}
                  className={`bg-gray-50 rounded-xl border overflow-hidden transition-all ${
                    result.passed === true ? 'border-l-4 border-l-green-500 border-gray-200' :
                    result.passed === false ? 'border-l-4 border-l-red-500 border-gray-200' :
                    result.running ? 'border-l-4 border-l-yellow-500 border-gray-200' :
                    'border-gray-200'
                  }`}
                >
                  {/* Test Case Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      {result.running ? (
                        <span className="w-3.5 h-3.5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></span>
                      ) : result.passed === true ? (
                        <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-green-500" />
                      ) : result.passed === false ? (
                        <FontAwesomeIcon icon={faCircleXmark} className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-gray-300"></span>
                      )}
                      <span className="text-xs font-semibold text-gray-800">Case {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!result.running && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                          result.passed === true ? 'bg-green-100 text-green-600' :
                          result.passed === false ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {result.passed === true ? 'Accepted' : result.passed === false ? (result.error ? 'Error' : 'Wrong Answer') : 'Not Run'}
                        </span>
                      )}
                      <button 
                        onClick={() => runSingleTestCase(idx)}
                        disabled={result.running}
                        className="px-2.5 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        {result.running ? (
                          <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <FontAwesomeIcon icon={faPlay} className="w-2.5 h-2.5" />
                        )}
                        Run
                      </button>
                      <button 
                        onClick={() => deleteTestCase(idx)}
                        disabled={testResults.length <= 1}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Test Case Body */}
                  <div className="px-3 py-2.5 space-y-2">
                    {problem?.isSql && result.sqlInput ? (
                      /* ===== SQL Test Case: Table rendering ===== */
                      <>
                        {/* Input Table(s) */}
                        <div>
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Input Tables
                          </div>
                          {result.sqlInput?.tables && Array.isArray(result.sqlInput.tables) ? (
                            result.sqlInput.tables.map((t: any, ti: number) => (
                              <div key={ti} className="mb-2">
                                {t.name && <p className="text-[10px] font-semibold mb-1 text-blue-600">📥 {t.name}</p>}
                                <div className="overflow-x-auto rounded border border-gray-200">
                                  <table className="w-full text-xs font-mono">
                                    <thead><tr className="bg-gray-100">{(t.headers || []).map((h: string, hi: number) => <th key={hi} className="px-2 py-1 text-left text-gray-600 font-semibold border-b border-gray-200">{h}</th>)}</tr></thead>
                                    <tbody>{normalizeRows(t.rows).map((row: any, ri: number) => <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">{(t.headers || []).map((_: string, ci: number) => { const val = row['i' + ci]; return <td key={ci} className="px-2 py-1 text-gray-700">{val === null ? <span className="text-gray-400 italic">NULL</span> : String(val)}</td>; })}</tr>)}</tbody>
                                  </table>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="overflow-x-auto rounded border border-gray-200">
                              <table className="w-full text-xs font-mono">
                                <thead><tr className="bg-gray-100">{(result.sqlInput?.headers || []).map((h: string, hi: number) => <th key={hi} className="px-2 py-1 text-left text-gray-600 font-semibold border-b border-gray-200">{h}</th>)}</tr></thead>
                                <tbody>{normalizeRows(result.sqlInput?.rows).map((row: any, ri: number) => <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">{(result.sqlInput?.headers || []).map((_: string, ci: number) => { const val = row['i' + ci]; return <td key={ci} className="px-2 py-1 text-gray-700">{val === null ? <span className="text-gray-400 italic">NULL</span> : String(val)}</td>; })}</tr>)}</tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-dashed border-gray-200 my-2"></div>

                        {/* Expected Output Table */}
                        <div>
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Expected Output
                          </div>
                          <div className="overflow-x-auto rounded border border-green-200">
                            <table className="w-full text-xs font-mono">
                              <thead><tr className="bg-green-50">{(result.sqlExpectedOutput?.headers || []).map((h: string, hi: number) => <th key={hi} className="px-2 py-1 text-left text-green-700 font-semibold border-b border-green-200">{h}</th>)}</tr></thead>
                              <tbody>{normalizeRows(result.sqlExpectedOutput?.rows).map((row: any, ri: number) => <tr key={ri} className="border-b border-green-100 hover:bg-green-50/50">{(result.sqlExpectedOutput?.headers || []).map((_: string, ci: number) => { const val = row['i' + ci]; return <td key={ci} className="px-2 py-1 text-gray-700">{val === null ? <span className="text-gray-400 italic">NULL</span> : String(val)}</td>; })}</tr>)}</tbody>
                            </table>
                          </div>
                        </div>

                        {/* Actual Output (after run) */}
                        {result.passed !== null && result.sqlActualHeaders && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: result.passed ? '#40A944' : '#ef4444' }}>
                              Your Output
                            </div>
                            <div className={`overflow-x-auto rounded border ${result.passed ? 'border-green-200' : 'border-red-200'}`}>
                              <table className="w-full text-xs font-mono">
                                <thead><tr className={result.passed ? 'bg-green-50' : 'bg-red-50'}>{(result.sqlActualHeaders || []).map((h: string, hi: number) => <th key={hi} className={`px-2 py-1 text-left font-semibold border-b ${result.passed ? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'}`}>{h}</th>)}</tr></thead>
                                <tbody>{(result.sqlActualRows || []).length === 0 ? (
                                  <tr><td colSpan={(result.sqlActualHeaders || []).length || 1} className="px-2 py-1 text-center text-gray-400 italic">No rows returned</td></tr>
                                ) : (result.sqlActualRows || []).map((row: any, ri: number) => <tr key={ri} className="border-b border-gray-100">{(result.sqlActualHeaders || []).map((h: string, ci: number) => { const val = row[h]; return <td key={ci} className="px-2 py-1 text-gray-700">{val === null ? <span className="text-gray-400 italic">NULL</span> : String(val)}</td>; })}</tr>)}</tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {result.error && <div className="text-[10px] text-red-500 bg-red-50 p-2 rounded">{result.error}</div>}
                      </>
                    ) : (
                      /* ===== Coding Test Case: param=value style ===== */
                      <>
                        {/* Input params */}
                        {Object.keys(result.params || {}).map((paramName, pi) => (
                          <div key={pi} className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-600 min-w-[60px]">{paramName}</span>
                            <span className="text-gray-400">=</span>
                            <input
                              type="text"
                              value={result.params[paramName] || ''}
                              onChange={(e) => updateTestCaseParam(idx, paramName, e.target.value)}
                              placeholder={paramName === 'nums' ? '[2, 7, 11, 15]' : paramName === 'target' ? '9' : ''}
                              className="flex-1 px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded focus:outline-none focus:border-green-400"
                            />
                          </div>
                        ))}
                        
                        {Object.keys(result.params || {}).length === 0 && (
                          <div className="text-xs text-gray-400 italic">No input parameters</div>
                        )}
                        
                        <div className="border-t border-dashed border-gray-200 my-2"></div>
                        
                        {/* Expected output */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-green-600 min-w-[60px]">expected</span>
                          <span className="text-gray-400">=</span>
                          <input
                            type="text"
                            value={result.expected || ''}
                            onChange={(e) => updateTestCaseExpected(idx, e.target.value)}
                            placeholder="[0, 1]"
                            className="flex-1 px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded focus:outline-none focus:border-green-400"
                          />
                        </div>
                        
                        {/* Actual output (if run) */}
                        {result.passed !== null && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-600 min-w-[60px]">output</span>
                              <span className="text-gray-400">=</span>
                              <span className={`flex-1 px-2 py-1 text-xs font-mono rounded ${
                                result.passed ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                              }`}>
                                {result.actual || result.error || '(empty)'}
                              </span>
                            </div>
                            
                            {/* Metrics */}
                            <div className="flex items-center gap-4 mt-2">
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                                {result.time}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <FontAwesomeIcon icon={faMicrochip} className="w-3 h-3" />
                                {result.memory}
                              </span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Panel Footer */}
            <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button 
                onClick={addTestCase}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-600 hover:bg-green-50 rounded-md transition"
              >
                <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
                Add Test Case
              </button>
              <button 
                onClick={runAllTestCases}
                disabled={testResults.some(r => r.running)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 disabled:opacity-50 transition"
              >
                {testResults.some(r => r.running) ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
                )}
                {testResults.some(r => r.running) ? 'Running...' : 'Run All Tests'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* CSS for slide animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Slash Command Menu */}
      {showSlashMenu && filteredSlashCommands.length > 0 && (
        <div 
          className="fixed z-[2002] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ 
            left: slashMenuPosition.x, 
            top: slashMenuPosition.y,
            minWidth: '280px',
            maxWidth: '320px'
          }}
        >
          {/* Menu Header */}
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3 h-3" />
              <span>AI Commands</span>
              <span className="ml-auto text-gray-400">↑↓ Navigate • Enter Select</span>
            </div>
          </div>
          
          {/* Command List */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {filteredSlashCommands.map((cmd, index) => (
              <button
                key={cmd.command}
                onClick={() => executeSlashCommand(cmd)}
                onMouseEnter={() => setSelectedSlashIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === selectedSlashIndex 
                    ? 'bg-green-50' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${cmd.bgColor} flex items-center justify-center`}>
                  <FontAwesomeIcon icon={cmd.icon} className={`w-4 h-4 ${cmd.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{cmd.command}</span>
                    {index === selectedSlashIndex && (
                      <span className="text-xs text-green-600 font-medium">Press Enter</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{cmd.description}</p>
                </div>
              </button>
            ))}
          </div>
          
          {/* Menu Footer */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">Esc</span>
              <span>to close</span>
            </div>
          </div>
        </div>
      )}

      {/* AI Result Modal - Slide in from right */}
      {showAIResultModal && aiResultContent && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
            onClick={() => {
              setShowAIResultModal(false);
              setAiResultContent(null);
            }}
          />
          
          {/* Panel - Slide in from right - wider for code operations */}
          <div 
            className={`fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] ${
              ['fix', 'format', 'optimize', 'tests', 'docs'].includes(aiResultContent.operation)
                ? 'sm:w-[50rem]'  // Wider for code
                : 'sm:w-[35rem]'  // Normal for explanations
            } bg-white z-[2001] flex flex-col rounded-2xl shadow-2xl overflow-hidden`}
            style={{ animation: 'slideInRight 0.3s ease-out' }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faRobot} className="w-5 h-5" />
                <span className="text-lg font-semibold">{aiResultContent.title}</span>
              </div>
              <button 
                onClick={() => {
                  setShowAIResultModal(false);
                  setAiResultContent(null);
                }}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
              >
                <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {['fix', 'format', 'optimize', 'tests', 'docs'].includes(aiResultContent.operation) ? (
                /* Code display using Monaco Editor */
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-400"></span>
                      <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                      <span className="w-3 h-3 rounded-full bg-green-400"></span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono bg-gray-200 px-2 py-1 rounded">{selectedLanguage}</span>
                  </div>
                  <div className="flex-1">
                    <Editor
                      height="100%"
                      language={selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage}
                      value={extractCodeFromAIResponse(aiResultContent.content, aiResultContent.operation)}
                      theme="vs"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'off',
                        folding: false,
                        lineNumbersMinChars: 4,
                        glyphMargin: false,
                        lineDecorationsWidth: 16,
                        padding: { top: 12, bottom: 12 },
                        renderLineHighlight: 'none',
                        hideCursorInOverviewRuler: true,
                        overviewRulerBorder: false,
                        domReadOnly: true,
                        guides: {
                          indentation: false,
                          bracketPairs: false,
                          highlightActiveIndentation: false,
                        },
                        scrollbar: {
                          vertical: 'auto',
                          horizontal: 'auto',
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                        },
                      }}
                      onMount={(editor, monaco) => {
                        // Scroll to top
                        editor.setScrollTop(0);
                        editor.setPosition({ lineNumber: 1, column: 1 });
                        
                        // Highlight FIXED lines with green background
                        const model = editor.getModel();
                        if (model) {
                          const decorations: any[] = [];
                          const lineCount = model.getLineCount();
                          for (let i = 1; i <= lineCount; i++) {
                            const lineContent = model.getLineContent(i);
                            if (lineContent.includes('// FIXED:') || lineContent.includes('# FIXED:')) {
                              decorations.push({
                                range: new monaco.Range(i, 1, i, 1),
                                options: {
                                  isWholeLine: true,
                                  className: 'fixed-line-highlight',
                                }
                              });
                            }
                          }
                          editor.deltaDecorations([], decorations);
                        }
                      }}
                    />
                  </div>
                  {/* CSS for FIXED line highlighting */}
                  <style>{`
                    .fixed-line-highlight {
                      background-color: rgba(34, 197, 94, 0.15) !important;
                      border-left: 3px solid #22c55e !important;
                    }
                    .fixed-line-glyph {
                      background-color: #22c55e;
                    }
                  `}</style>
                </div>
              ) : (
                /* Markdown display for explanations/suggestions */
                <div className="p-5 max-w-none">
                  {renderMarkdown(aiResultContent.content)}
                </div>
              )}
            </div>
            
            {/* Panel Footer */}
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    // For code operations, extract just the code; otherwise copy all
                    const contentToCopy = extractCodeFromAIResponse(aiResultContent.content, aiResultContent.operation);
                    navigator.clipboard.writeText(contentToCopy);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  <FontAwesomeIcon icon={faCopy} className="w-4 h-4" />
                  {['fix', 'format', 'optimize', 'tests', 'docs'].includes(aiResultContent.operation) ? 'Copy Code' : 'Copy'}
                </button>
                
                {/* Show Apply button only for code-returning operations */}
                {['fix', 'format', 'optimize', 'tests', 'docs'].includes(aiResultContent.operation) && (
                  <button
                    onClick={applyAICode}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium"
                  >
                    <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                    Apply to Editor
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setShowAIResultModal(false);
                    setAiResultContent(null);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition font-medium shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CodingLab;