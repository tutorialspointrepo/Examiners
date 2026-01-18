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
  faSliders,
  faExpand,
  faMoon,
  faGrid2,
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

const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  c: 50,
  go: 60
};

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
  };
  code: Record<string, string>;
  isOptimal?: boolean;
}

interface Analogy {
  icon: string;
  title: string;
  scenario: string;
  bruteForce: string;
  optimal: string;
  keyInsight: string;
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
  defaultCode: Record<string, string>;
  relatedProblems: RelatedProblem[];
  views: number;
  likes: number;
  frequency: string;
  avgTime: string;
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
}

// ==================== FIREBASE SERVICE ====================

/**
 * Transform Firebase problem data to CodingLab format
 */
function transformProblemData(data: any): ProblemData | null {
  if (!data) return null;

  try {
    // Transform examples from Firebase format
    const examples: Example[] = (data.examples || []).map((ex: any, idx: number) => ({
      input: ex.input || {},
      output: ex.output || '',
      explanation: ex.explanation || ''
    }));

    // Transform test cases from Firebase format  
    const testCases: TestCase[] = (data.testCases || []).map((tc: any, idx: number) => ({
      id: tc.id || idx + 1,
      params: tc.input || {},
      expected_output: tc.expected || '',
      explanation: tc.explanation || ''
    }));

    // Transform approaches from Firebase format
    const approaches: Record<string, Approach> = {};
    if (data.approaches) {
      Object.entries(data.approaches).forEach(([key, value]: [string, any]) => {
        approaches[key] = {
          name: value.title || value.name || key,
          description: value.description || '',
          complexity: {
            time: value.complexity?.time || 'O(?)',
            space: value.complexity?.space || 'O(?)'
          },
          code: value.code || {},
          isOptimal: key === 'one-pass-hash' || key === 'optimal' || value.isOptimal
        };
      });
    }

    // Transform analogy from Firebase format
    const analogy: Analogy = {
      icon: data.analogy?.icon || '💡',
      title: data.analogy?.title || 'Understanding the Problem',
      scenario: data.analogy?.description || '',
      bruteForce: data.analogy?.bruteForce || '',
      optimal: data.analogy?.optimal || data.analogy?.twoPass || '',
      keyInsight: data.analogy?.keyInsight || ''
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
      defaultCode: data.defaultCode || {},
      relatedProblems,
      views: data.views || data.stats?.views || 0,
      likes: data.likes || data.stats?.likes || 0,
      frequency: data.frequency || data.stats?.frequency || 'Medium',
      avgTime: data.avgTime || data.stats?.avgTime || '~20 min'
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
  onClose,
  problemSlug = 'two-sum'
}) => {
  // Use problemSlug prop or default
  const PROBLEM_ID = problemSlug;
  
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
  });
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [selectedApproach, setSelectedApproach] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [isLiked, setIsLiked] = useState(false);
  const [solutionLanguage, setSolutionLanguage] = useState('c');
  const [showVisualizationModal, setShowVisualizationModal] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [editorState, setEditorState] = useState<'normal' | 'maximized' | 'minimized'>('normal');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTestCasesPanel, setShowTestCasesPanel] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [outputPanelState, setOutputPanelState] = useState<'normal' | 'expanded' | 'minimized'>('normal');
  const [executionStats, setExecutionStats] = useState<{ time: string; memory: string } | null>(null);
  const [editorHeight, setEditorHeight] = useState(70); // percentage of available space
  const [isVerticalResizing, setIsVerticalResizing] = useState(false);
  const [aiOperationLoading, setAiOperationLoading] = useState<string | null>(null); // Track which AI operation is loading
  const [showAIResultModal, setShowAIResultModal] = useState(false);
  const [aiResultContent, setAiResultContent] = useState<{ title: string; content: string; operation: string } | null>(null);
  
  // Slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [slashCommandLine, setSlashCommandLine] = useState<number | null>(null);
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<any>(null); // Reference to Monaco editor instance

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
      try {
        console.log('🔄 Fetching problem:', PROBLEM_ID);
        const data = await codingLabService.getProblem(PROBLEM_ID);
        console.log('📦 Fetched data:', data);
        
        if (data) {
          setProblem(data);
          // Set first approach as selected
          const firstApproach = Object.keys(data.approaches || {})[0];
          if (firstApproach) setSelectedApproach(firstApproach);
          // Set default code for selected language
          if (data.defaultCode?.[selectedLanguage]) {
            setCode(data.defaultCode[selectedLanguage]);
          }
          // Initialize test results
          setTestResults(data.testCases?.map((tc, idx) => ({
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
          })) || []);
          
          // Check like status
          const hasLiked = await codingLabService.checkLikeStatus(PROBLEM_ID);
          setIsLiked(hasLiked);
        } else {
          setError(`Problem "${PROBLEM_ID}" not found in database`);
        }
      } catch (err: any) {
        console.error('❌ Error loading problem:', err);
        setError(err.message || 'Failed to load problem');
      } finally {
        setIsLoading(false);
      }
    };

    loadProblem();
  }, [PROBLEM_ID]);

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

  const runCode = async () => {
    setIsRunning(true);
    setActiveOutputTab('output');
    setOutput('⏳ Running code...');
    setExecutionStats(null);
    
    try {
      const result = await executeCode(code, selectedLanguage, stdinInput);
      if (result.error) {
        setOutput(`❌ ${result.status}\n${result.error}`);
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
    const result = await codingLabService.toggleLike(PROBLEM_ID, isLiked);
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
    
    const elements: JSX.Element[] = [];
    
    // First, extract all code blocks and replace with placeholders
    // Handle multiple formats: ```lang\ncode```, ```lang code```, ``` code ```
    const codeBlocks: { lang: string; code: string }[] = [];
    
    // Pattern 1: ```lang\ncode\n``` (standard)
    let processedText = text.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
      codeBlocks.push({ lang: lang || '', code: code.trim() });
      return `\n__CODE_BLOCK_${codeBlocks.length - 1}__\n`;
    });
    
    // Pattern 2: ```lang\ncode``` (no trailing newline)
    processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      codeBlocks.push({ lang: lang || '', code: code.trim() });
      return `\n__CODE_BLOCK_${codeBlocks.length - 1}__\n`;
    });
    
    // Pattern 3: ```code``` (inline, no language)
    processedText = processedText.replace(/```([\s\S]*?)```/g, (match, code) => {
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
    processed = processed.replace(/``([^`]+)``/g, (match, code) => {
      inlineCodes.push(code);
      return `__INLINE_CODE_${inlineCodes.length - 1}__`;
    });
    
    // Then replace `code` (single backticks)
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
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
    const testCase = testResults[index];
    if (!testCase) return;

    // Set running state
    setTestResults(prev => prev.map((r, i) => i === index ? { ...r, running: true } : r));

    try {
      // Convert params to stdin - use values from testCase.params directly
      const paramValues = Object.values(testCase.params || {});
      const stdin = paramValues.join('\n');
      
      const result = await executeCode(code, selectedLanguage, stdin);
      
      // Normalize outputs for comparison
      const actualOutput = (result.output || '').trim();
      const expectedOutput = (testCase.expected || '').trim();
      const passed = actualOutput === expectedOutput;

      setTestResults(prev => prev.map((r, i) => i === index ? {
        ...r,
        actual: actualOutput,
        passed: result.error ? false : passed,
        error: result.error || null,
        time: result.time || '0',
        memory: result.memory || '0 KB',
        status: result.error ? 'Error' : (passed ? 'Accepted' : 'Wrong Answer'),
        running: false
      } : r));
    } catch (err: any) {
      setTestResults(prev => prev.map((r, i) => i === index ? {
        ...r,
        passed: false,
        error: err.message,
        status: 'Error',
        running: false
      } : r));
    }
  };

  // Run all test cases
  const runAllTestCases = async () => {
    for (let i = 0; i < testResults.length; i++) {
      await runSingleTestCase(i);
    }
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
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-700 border border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-700 border border-red-200';
      default: return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

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
  
  const renderProblemPanel = () => (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto">
        {/* Problem Header - Title & Tags */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{problem.title}</h1>
            <button 
              onClick={() => {
                const allExpanded = expandedSections.io && expandedSections.constraints && expandedSections.visualization && expandedSections.complexity && expandedSections.related;
                setExpandedSections({
                  io: !allExpanded,
                  constraints: !allExpanded,
                  hints: !allExpanded,
                  visualization: !allExpanded,
                  complexity: !allExpanded,
                  related: !allExpanded,
                  companies: !allExpanded,
                  approaches: expandedSections.approaches,
                  code: expandedSections.code
                });
              }} 
              className="w-7 h-7 flex items-center justify-center border border-blue-300 rounded-lg hover:bg-blue-50 transition-all"
              title="Toggle All Sections"
              style={{ borderColor: brandTheme.colors.primary }}
            >
              <FontAwesomeIcon 
                icon={faChevronDown} 
                className={`w-3 h-3 transition-transform duration-300 ${(expandedSections.io && expandedSections.constraints && expandedSections.visualization && expandedSections.complexity && expandedSections.related) ? '' : '-rotate-90'}`}
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
          <p className="text-gray-700 leading-relaxed text-base">{problem.description}</p>
        </div>

        <div className="h-px bg-gray-100 mx-6"></div>

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
                <div key={idx} className="rounded-xl overflow-hidden border border-gray-200" style={{ background: '#fefdfb' }}>
                  {/* Terminal Header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                    <span className="w-3 h-3 rounded-full bg-red-400"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                    <span className="w-3 h-3 rounded-full bg-green-400"></span>
                    <span className="ml-3 text-sm text-gray-500 font-mono">example_{idx + 1}.py — Python</span>
                  </div>
                  {/* Terminal Body */}
                  <div className="p-4 font-mono text-xs">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-green-600 font-bold">$</span>
                      <span className="text-orange-500">Input:</span>
                      <span className="text-gray-800">
                        {typeof example.input === 'string' 
                          ? example.input 
                          : Object.entries(example.input).map(([k, v]) => `${k} = ${v}`).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">›</span>
                      <span className="text-orange-500">Output:</span>
                      <span className="text-gray-800">{example.output}</span>
                    </div>
                    {example.explanation && (
                      <div className="mt-4 p-3 rounded-lg border-l-4 border-yellow-400" style={{ background: '#fffbeb' }}>
                        <div className="flex items-start gap-2 font-mono text-xs">
                          <span className="text-yellow-600">✓</span>
                          <span className="text-orange-500">Note:</span>
                          <span className="text-gray-700">{example.explanation}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visualization Section */}
        {problem.analogy && (
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
                {/* SVG Visualization Box */}
                <div className="rounded-xl border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow" style={{ background: '#f9fbfd' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" className="w-full">
                    <defs>
                      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.2"/>
                      </filter>
                      <linearGradient id="shelfGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e0e0e0"/>
                        <stop offset="100%" stopColor="#bdbdbd"/>
                      </linearGradient>
                    </defs>
                    <rect width="800" height="500" fill="#f9fbfd" rx="10"/>
                    <text x="400" y="35" fontFamily="Arial" fontSize="22" fontWeight="bold" textAnchor="middle" fill="#333">Two Sum: The Smart Shopper Method</text>
                    <text x="400" y="60" fontFamily="Arial" fontSize="14" textAnchor="middle" fill="#666">Array: [2, 7, 11, 15] | Target: 9</text>
                    
                    {/* Gift Card */}
                    <g transform="translate(50, 90)">
                      <rect width="140" height="75" rx="8" fill="#ffecb3" stroke="#ffc107" strokeWidth="2" filter="url(#shadow)"/>
                      <text x="70" y="28" fontFamily="Arial" fontSize="13" fontWeight="bold" fill="#f57f17" textAnchor="middle">🎁 GIFT CARD</text>
                      <text x="70" y="55" fontFamily="Arial" fontSize="28" fontWeight="bold" fill="#333" textAnchor="middle">$9</text>
                    </g>
                    
                    {/* Thinking bubble */}
                    <g transform="translate(240, 105)">
                      <path d="M0,0 H175 A10,10 0 0 1 185,10 V65 A10,10 0 0 1 175,75 H35 L18,92 L18,75 H10 A10,10 0 0 1 0,65 V10 A10,10 0 0 1 10,0 Z" fill="#fff" stroke="#333" strokeWidth="2" filter="url(#shadow)"/>
                      <text x="92" y="24" fontFamily="Arial" fontSize="12" fill="#333" textAnchor="middle">💭 Thinking...</text>
                      <text x="92" y="50" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#d32f2f" textAnchor="middle">$9 - $7 = Need $2</text>
                    </g>
                    
                    {/* Store Shelf */}
                    <g transform="translate(50, 220)">
                      <rect x="-10" y="55" width="450" height="18" fill="url(#shelfGradient)" rx="4"/>
                      <text x="-10" y="-20" fontFamily="Arial" fontSize="16" fontWeight="bold" fill="#333">🛒 Store Shelf (Array)</text>
                      
                      {/* Item $2 - Seen */}
                      <g transform="translate(15, 0)">
                        <rect width="75" height="55" rx="5" fill="#e3f2fd" stroke="#2196f3" strokeWidth="2" filter="url(#shadow)"/>
                        <text x="37" y="33" fontFamily="Arial" fontSize="20" fontWeight="bold" fill="#1565c0" textAnchor="middle">$2</text>
                        <text x="37" y="85" fontFamily="Arial" fontSize="11" textAnchor="middle" fill="#666">Index 0</text>
                        <text x="37" y="-8" fontFamily="Arial" fontSize="10" fill="#1565c0" fontStyle="italic" textAnchor="middle">Seen</text>
                      </g>
                      
                      {/* Item $7 - Current */}
                      <g transform="translate(115, 0)">
                        <rect width="75" height="55" rx="5" fill="#fff3e0" stroke="#ff9800" strokeWidth="3" filter="url(#shadow)"/>
                        <text x="37" y="33" fontFamily="Arial" fontSize="20" fontWeight="bold" fill="#e65100" textAnchor="middle">$7</text>
                        <text x="37" y="85" fontFamily="Arial" fontSize="11" textAnchor="middle" fill="#666">Index 1</text>
                        <text x="37" y="-8" fontFamily="Arial" fontSize="11" fill="#e65100" fontWeight="bold" textAnchor="middle">Current</text>
                      </g>
                      
                      {/* Items $11 and $15 - Dimmed */}
                      <g transform="translate(215, 0)" opacity="0.4">
                        <rect width="75" height="55" rx="5" fill="#f5f5f5" stroke="#999"/>
                        <text x="37" y="33" fontFamily="Arial" fontSize="20" textAnchor="middle" fill="#999">$11</text>
                        <text x="37" y="85" fontFamily="Arial" fontSize="11" textAnchor="middle" fill="#999">Index 2</text>
                      </g>
                      <g transform="translate(315, 0)" opacity="0.4">
                        <rect width="75" height="55" rx="5" fill="#f5f5f5" stroke="#999"/>
                        <text x="37" y="33" fontFamily="Arial" fontSize="20" textAnchor="middle" fill="#999">$15</text>
                        <text x="37" y="85" fontFamily="Arial" fontSize="11" textAnchor="middle" fill="#999">Index 3</text>
                      </g>
                    </g>
                    
                    {/* Notebook (Hash Map) */}
                    <g transform="translate(530, 180)">
                      <rect width="220" height="200" rx="6" fill="#fff" stroke="#333" strokeWidth="2" filter="url(#shadow)"/>
                      <rect x="8" y="-8" width="8" height="216" rx="2" fill="#ddd"/>
                      <circle cx="12" cy="15" r="4" fill="#333"/>
                      <text x="110" y="28" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#333" textAnchor="middle">📓 Notebook</text>
                      <text x="110" y="45" fontFamily="Arial" fontSize="11" fill="#666" textAnchor="middle">(Hash Map)</text>
                      <line x1="30" y1="58" x2="200" y2="58" stroke="#ccc"/>
                      <text x="60" y="78" fontFamily="Arial" fontSize="12" fontWeight="bold" fill="#333">Price</text>
                      <text x="155" y="78" fontFamily="Arial" fontSize="12" fontWeight="bold" fill="#333">Location</text>
                      <line x1="30" y1="85" x2="200" y2="85" stroke="#333" strokeWidth="2"/>
                      <rect x="28" y="95" width="175" height="32" fill="#e3f2fd" rx="4"/>
                      <text x="65" y="116" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#1565c0">$2</text>
                      <text x="155" y="116" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#1565c0">0</text>
                      <text x="110" y="155" fontFamily="Arial" fontSize="11" fill="#00aa00" textAnchor="middle" fontWeight="bold">✓ MATCH FOUND!</text>
                      <text x="110" y="175" fontFamily="Arial" fontSize="10" fill="#666" textAnchor="middle">Found $2 at index 0</text>
                    </g>
                    
                    {/* Result Box */}
                    <g transform="translate(100, 410)">
                      <rect width="600" height="70" fill="#e8f5e9" stroke="#4caf50" strokeWidth="2" rx="8" filter="url(#shadow)"/>
                      <text x="300" y="28" fontFamily="Arial" fontSize="17" fontWeight="bold" textAnchor="middle" fill="#2e7d32">✅ Perfect Match Found!</text>
                      <text x="300" y="52" fontFamily="Arial" fontSize="13" textAnchor="middle" fill="#333">Return [0, 1] — Items at indices 0 and 1 cost $2 + $7 = $9</text>
                    </g>
                  </svg>
                </div>
                
                {/* Understanding Steps - with primary color left border */}
                <div className="rounded-xl border-l-4" style={{ borderColor: brandTheme.colors.primary, background: 'rgb(254, 253, 251)' }}>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <FontAwesomeIcon icon={faLightbulb} style={{ color: brandTheme.colors.primary }} className="w-5 h-5" />
                      <span className="font-bold text-gray-900">Understanding the Visualization</span>
                    </div>
                    
                    <div className="space-y-5">
                      {/* Step 1 */}
                      <div className="flex gap-4 items-start">
                        <div className="w-7 h-7 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: brandTheme.gradients.primary }}>
                          1
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1 text-sm">🛍️ Pick up first item ($2)</div>
                          <div className="text-gray-600 text-sm leading-relaxed">
                            We see an item costing $2 at position 0. We write it down in our notebook and continue shopping.
                          </div>
                        </div>
                      </div>
                      
                      {/* Step 2 */}
                      <div className="flex gap-4 items-start">
                        <div className="w-7 h-7 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: brandTheme.gradients.primary }}>
                          2
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1 text-sm">🛍️ Pick up second item ($7)</div>
                          <div className="text-gray-600 text-sm leading-relaxed">
                            We see an item costing $7 at position 1. We quickly calculate: $9 - $7 = need $2
                          </div>
                        </div>
                      </div>
                      
                      {/* Step 3 */}
                      <div className="flex gap-4 items-start">
                        <div className="w-7 h-7 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: brandTheme.gradients.primary }}>
                          3
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1 text-sm">📓 Check our notebook</div>
                          <div className="text-gray-600 text-sm leading-relaxed">
                            We look in our notebook - YES! We saw a $2 item earlier at position 0!
                          </div>
                        </div>
                      </div>
                      
                      {/* Step 4 */}
                      <div className="flex gap-4 items-start">
                        <div className="w-7 h-7 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: brandTheme.gradients.primary }}>
                          4
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 mb-1 text-sm">✅ Done! Return [0, 1]</div>
                          <div className="text-gray-600 text-sm leading-relaxed">
                            We found our pair! Items at positions 0 and 1 cost exactly $9 together. Mission accomplished in just ONE walk through the store!
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Key Takeaway */}
                    <div className="mt-5 p-4 rounded-lg flex items-start gap-3" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}15, ${brandTheme.colors.primary}08)`, border: `1px solid ${brandTheme.colors.primary}30` }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: brandTheme.colors.primary }}>
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold mb-1 text-sm" style={{ color: brandTheme.colors.primary }}>Key Takeaway</div>
                        <div className="text-sm leading-relaxed" style={{ color: brandTheme.colors.primary }}>
                          🎯 Key Insight: By keeping a notebook (hash map) of items we've seen, we only need to walk through the store ONCE instead of checking every possible pair. This is why the optimal solution is O(n) instead of O(n²)!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Time & Space Complexity Section */}
        <div className="px-6 py-5">
          <div 
            className="flex justify-between items-center cursor-pointer select-none" 
            onClick={() => toggleSection('complexity')}
          >
            <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900">
              <FontAwesomeIcon icon={faChartLine} className="w-5 h-5 text-gray-400" />
              Time & Space Complexity
            </h2>
            <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.complexity ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
          </div>
          
          {expandedSections.complexity && (
            <div className="mt-4 space-y-4">
              {/* Time Complexity Card */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${brandTheme.colors.primary}40` }}>
                <div className="p-4" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}08 0%, ${brandTheme.colors.secondary}05 100%)` }}>
                  <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Time Complexity</div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">⏱️</div>
                    <span className={`text-3xl font-bold font-mono ${getComplexityColor('O(n)', 'time')}`}>O(n)</span>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    We make only ONE pass through the array. For each element, hash map lookup and insertion are O(1) operations. Total: n elements × O(1) = O(n).
                  </p>
                  {/* Progress Bars */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-5">n</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-5">2n</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: '80%' }}></div>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 text-green-600">
                    <span>✓</span> Linear Growth
                  </span>
                </div>
              </div>

              {/* Space Complexity Card */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${brandTheme.colors.primary}40` }}>
                <div className="p-4" style={{ background: `linear-gradient(135deg, ${brandTheme.colors.primary}08 0%, ${brandTheme.colors.secondary}05 100%)` }}>
                  <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Space Complexity</div>
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faMicrochip} className={`w-6 h-6 ${getComplexityColor('O(n)', 'space')}`} />
                    <span className={`text-3xl font-bold font-mono ${getComplexityColor('O(n)', 'space')}`}>O(n)</span>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    In the worst case, we might store all n elements in the hash map before finding the solution. Space usage grows linearly with input size.
                  </p>
                  {/* Progress Bars */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-5">n</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-yellow-500" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-5">2n</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-yellow-500" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-600">
                    <span>⚡</span> Linear Space
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

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
                  <a 
                    key={i} 
                    href={`${rp.slug}.htm`}
                    className="flex items-center py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group"
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
                  </a>
                ))}
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
            <FontAwesomeIcon icon={faChevronDown} className={`w-4 h-4 transition-transform duration-300 ${expandedSections.constraints ? '' : '-rotate-90'}`} style={{ color: brandTheme.colors.primary }} />
          </div>
          {expandedSections.constraints && (
            <div className="mt-4 p-5 rounded-xl border border-gray-200 bg-gray-50">
              <ul className="space-y-4">
                {problem.constraints?.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-700 text-sm">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span dangerouslySetInnerHTML={{ __html: c }} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

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
          <span className="font-semibold text-gray-800">{formatNumber(problem.views || 12)}</span>
          <span className="text-gray-500">Views</span>
        </div>
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faFire} className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-gray-800">{problem.frequency || 'Very High'}</span>
          <span className="text-gray-500">Frequency</span>
        </div>
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800">{problem.avgTime || '~15 min'}</span>
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
            {formatNumber(problem.likes || 0)}
          </span>
          <span className="text-gray-500">Likes</span>
        </button>
      </div>
    </div>
  );

  const renderSolutionPanel = () => {
    const approaches = Object.entries(problem.approaches || {});
    const currentApproach = problem.approaches?.[selectedApproach];

    // Get complexity level for styling
    const getComplexityLevel = (complexity: string): 'good' | 'medium' | 'bad' => {
      if (!complexity) return 'medium';
      if (complexity === 'O(1)' || complexity === 'O(n)') return 'good';
      if (complexity.includes('log')) return 'medium';
      if (complexity.includes('²') || complexity.includes('^2') || complexity.includes('n²')) return 'bad';
      return 'medium';
    };

    const getComplexityBadge = (complexity: string, type: 'time' | 'space') => {
      const level = getComplexityLevel(complexity);
      if (type === 'time') {
        if (level === 'good') return { text: 'Linear', color: 'bg-green-100 text-green-600' };
        if (level === 'medium') return { text: 'Linearithmic', color: 'bg-yellow-100 text-yellow-600' };
        return { text: 'Quadratic', color: 'bg-red-100 text-red-600' };
      } else {
        if (complexity === 'O(1)') return { text: 'Constant Space', color: 'bg-green-100 text-green-600' };
        if (complexity.includes('n')) return { text: 'Linear Space', color: 'bg-yellow-100 text-yellow-600' };
        return { text: 'Variable', color: 'bg-gray-100 text-gray-600' };
      }
    };

    const getComplexityBarWidth = (complexity: string): number => {
      if (complexity === 'O(1)') return 20;
      if (complexity === 'O(log n)') return 35;
      if (complexity === 'O(n)') return 50;
      if (complexity.includes('log')) return 65;
      if (complexity.includes('²') || complexity.includes('^2')) return 85;
      return 50;
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
                  const allExpanded = expandedSections.approaches && expandedSections.code && expandedSections.complexity && expandedSections.constraints;
                  setExpandedSections(prev => ({
                    ...prev,
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
                  className={`w-3 h-3 text-amber-600 transition-transform duration-300 ${(expandedSections.approaches && expandedSections.code) ? '' : '-rotate-90'}`}
                />
              </button>
            </div>
            {/* Solution Summary */}
            <p className="text-gray-700 leading-relaxed">
              The optimal solution uses a <strong>Hash Map</strong> to achieve O(n) time complexity. 
              Instead of checking every pair (brute force <strong>O(n²)</strong>), we store each number 
              and check if its complement (target - current number) already exists in the map.
            </p>
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
              <div className="mt-4 overflow-x-auto">
                <div className="rounded-xl border-2 border-amber-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-amber-50">
                        <th className="px-4 py-3 text-left text-gray-700 font-semibold border-b border-amber-200">Approach</th>
                        <th className="px-4 py-3 text-center text-gray-700 font-semibold border-b border-amber-200">Time</th>
                        <th className="px-4 py-3 text-center text-gray-700 font-semibold border-b border-amber-200">Space</th>
                        <th className="px-4 py-3 text-left text-gray-700 font-semibold border-b border-amber-200">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approaches.map(([key, approach], index) => (
                        <tr 
                          key={key}
                          onClick={() => setSelectedApproach(key)}
                          className={`cursor-pointer transition-all ${
                            selectedApproach === key 
                              ? 'bg-green-50 border-l-4 border-l-green-500' 
                              : 'bg-white hover:bg-amber-50/50'
                          } ${index !== approaches.length - 1 ? 'border-b border-amber-100' : ''}`}
                        >
                          <td className="px-4 py-4 text-gray-800">
                            {selectedApproach === key && (
                              <span className="text-green-600 mr-2">✓</span>
                            )}
                            {approach.name}
                          </td>
                          <td className={`px-4 py-4 text-center font-mono font-semibold ${getComplexityColor(approach.complexity?.time, 'time')}`}>
                            {approach.complexity?.time}
                          </td>
                          <td className={`px-4 py-4 text-center font-mono font-semibold ${getComplexityColor(approach.complexity?.space, 'space')}`}>
                            {approach.complexity?.space}
                          </td>
                          <td className="px-4 py-4 text-gray-500 text-sm">
                            {approach.description?.slice(0, 60)}{approach.description?.length > 60 ? '...' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <p className="text-gray-700 leading-relaxed mb-4">{currentApproach.description}</p>
                  
                  {/* Step by Step Walkthrough */}
                  <div className="p-4 bg-amber-50/50 rounded-lg border-l-4 border-amber-400">
                    <div className="flex items-center gap-2 mb-3 text-amber-700 font-semibold">
                      <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4" />
                      Step-by-Step Walkthrough
                    </div>
                    <div className="space-y-3">
                      {currentApproach.name?.toLowerCase().includes('hash') ? (
                        <>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Initialize Hash Map</div>
                              <div className="text-gray-500 text-xs">Create empty map to store {'{'}value → index{'}'}</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Iterate Through Array</div>
                              <div className="text-gray-500 text-xs">For each element, calculate complement = target - current</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Check Complement</div>
                              <div className="text-gray-500 text-xs">If complement exists in map, return both indices</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">4</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">✅ Store Current Element</div>
                              <div className="text-gray-500 text-xs">Add current {'{'}value → index{'}'} to map and continue</div>
                            </div>
                          </div>
                        </>
                      ) : currentApproach.name?.toLowerCase().includes('pointer') ? (
                        <>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Sort Array (preserve indices)</div>
                              <div className="text-gray-500 text-xs">Create pairs of (value, original_index) and sort by value</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Initialize Pointers</div>
                              <div className="text-gray-500 text-xs">Set left = 0, right = n - 1</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Calculate Sum</div>
                              <div className="text-gray-500 text-xs">sum = nums[left] + nums[right]</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">4</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">✅ Adjust Pointers</div>
                              <div className="text-gray-500 text-xs">If sum {'<'} target: left++, if sum {'>'} target: right--, else found!</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Start Processing</div>
                              <div className="text-gray-500 text-xs">Begin with the first element</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">Apply Algorithm Logic</div>
                              <div className="text-gray-500 text-xs">{currentApproach.description?.slice(0, 80)}</div>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                            <div>
                              <div className="font-semibold text-gray-800 text-sm">✅ Return Result</div>
                              <div className="text-gray-500 text-xs">Return the solution indices</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
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
                    {LANGUAGE_CONFIG.map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => setSolutionLanguage(lang.id)}
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
                  {/* Terminal Header - Light Theme */}
                  <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-400"></span>
                      <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                      <span className="w-3 h-3 rounded-full bg-green-400"></span>
                    </div>
                    <span className="text-gray-600 text-sm font-mono">
                      solution.{LANGUAGE_CONFIG.find(l => l.id === solutionLanguage)?.extension} — {LANGUAGE_CONFIG.find(l => l.id === solutionLanguage)?.name}
                    </span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(currentApproach.code?.[solutionLanguage] || '')}
                      className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
                    >
                      📋 Copy
                    </button>
                  </div>
                  {/* Terminal Body - Light Theme with max height */}
                  <div className="bg-amber-50/30 p-4 overflow-auto max-h-96">
                    <pre className="text-sm font-mono leading-relaxed text-gray-800 whitespace-pre-wrap">
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

  const renderAnalogyPanel = () => (
    <div className="h-full overflow-y-auto bg-white p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">{problem.analogy?.icon || '🔍'}</span>
        <h3 className="text-xl font-semibold text-gray-900">{problem.analogy?.title || 'Real World Analogy'}</h3>
      </div>
      <div className="p-5 rounded-xl border-l-4 border-amber-400 mb-5" style={{ backgroundColor: 'rgb(254, 253, 251)' }}>
        <div className="text-gray-700 leading-relaxed">
          <div className="text-amber-700 font-semibold text-lg mb-3">{problem.analogy?.title}</div>
          <p className="mb-4">{problem.analogy?.scenario}</p>
          <p className="mb-4">
            <strong className="text-gray-900">Brute Force Way:</strong>{' '}
            {renderInlineMarkdown(problem.analogy?.bruteForce || '')}
          </p>
          <p>
            <strong className="text-gray-900">Optimal Way:</strong>{' '}
            {renderInlineMarkdown(problem.analogy?.optimal || '')}
          </p>
        </div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="text-sm text-gray-600">
          <span className="text-blue-700 font-semibold">💡 Key Insight:</span>{' '}
          {renderInlineMarkdown(problem.analogy?.keyInsight || '')}
        </div>
      </div>
    </div>
  );

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
                setAiInput(`Please Simplify the following problem statement for me.\n\n${problem?.description || ''}`);
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
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-gray-600 cursor-pointer focus:outline-none text-xs"
            >
              {LANGUAGE_CONFIG.map(lang => (
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
              wordWrap: 'off',
              folding: true,
              lineNumbersMinChars: 3,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'line',
              renderLineHighlightOnlyWhenFocus: false,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
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
              editor.onDidChangeModelContent((e) => {
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
            <div className="text-sm text-gray-500">
              <p>Test cases will appear here...</p>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowVisualizationModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
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

      {/* Help Modal - Slide in from right like profile modal */}
      {showHelpModal && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] transition-opacity duration-200"
            onClick={() => setShowHelpModal(false)}
          />
          
          {/* Sidebar Panel */}
          <div 
            className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white shadow-2xl z-[2001] rounded-2xl overflow-hidden flex flex-col"
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1998]"
            onClick={() => setShowTestCasesPanel(false)}
          />
          
          {/* Panel */}
          <div 
            className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] sm:w-[35rem] bg-white z-[1999] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideInRight 0.3s ease-out' }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faClipboardList} className="w-5 h-5" />
                <span className="text-lg font-semibold">Test Cases</span>
              </div>
              <button 
                onClick={() => setShowTestCasesPanel(false)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
              >
                <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
              </button>
            </div>
            
            {/* Summary Bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-sm text-green-600">
                  <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                  <span>{testResults.filter(r => r.passed === true).length} passed</span>
                </span>
                <span className="flex items-center gap-1.5 text-sm text-red-500">
                  <FontAwesomeIcon icon={faCircleXmark} className="w-4 h-4" />
                  <span>{testResults.filter(r => r.passed === false).length} failed</span>
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-400">
                  <FontAwesomeIcon icon={faClock} className="w-4 h-4" />
                  <span>{testResults.filter(r => r.passed === null).length} pending</span>
                </span>
              </div>
              <span className="text-sm text-gray-500">{testResults.length} test cases</span>
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
                  <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {result.running ? (
                        <span className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></span>
                      ) : result.passed === true ? (
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-green-500" />
                      ) : result.passed === false ? (
                        <FontAwesomeIcon icon={faCircleXmark} className="w-4 h-4 text-red-500" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300"></span>
                      )}
                      <span className="font-semibold text-gray-800">Case {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!result.running && (
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
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
                        className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        {result.running ? (
                          <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
                        )}
                        Run
                      </button>
                      <button 
                        onClick={() => deleteTestCase(idx)}
                        disabled={testResults.length <= 1}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Test Case Body */}
                  <div className="p-4 space-y-3">
                    {/* Input params - get keys from the params object itself */}
                    {Object.keys(result.params || {}).map((paramName, pi) => (
                      <div key={pi} className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-600 min-w-[60px]">{paramName}</span>
                        <span className="text-gray-400">=</span>
                        <input
                          type="text"
                          value={result.params[paramName] || ''}
                          onChange={(e) => updateTestCaseParam(idx, paramName, e.target.value)}
                          placeholder={paramName === 'nums' ? '[2, 7, 11, 15]' : paramName === 'target' ? '9' : ''}
                          className="flex-1 px-3 py-1.5 text-sm font-mono bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-green-400"
                        />
                      </div>
                    ))}
                    
                    {/* If no params, show message */}
                    {Object.keys(result.params || {}).length === 0 && (
                      <div className="text-sm text-gray-400 italic">No input parameters</div>
                    )}
                    
                    {/* Separator */}
                    <div className="border-t border-dashed border-gray-200 my-2"></div>
                    
                    {/* Expected output */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-green-600 min-w-[60px]">expected</span>
                      <span className="text-gray-400">=</span>
                      <input
                        type="text"
                        value={result.expected || ''}
                        onChange={(e) => updateTestCaseExpected(idx, e.target.value)}
                        placeholder="[0, 1]"
                        className="flex-1 px-3 py-1.5 text-sm font-mono bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-green-400"
                      />
                    </div>
                    
                    {/* Actual output (if run) */}
                    {result.passed !== null && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-600 min-w-[60px]">output</span>
                          <span className="text-gray-400">=</span>
                          <span className={`flex-1 px-3 py-1.5 text-sm font-mono rounded-lg ${
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
                  </div>
                </div>
              ))}
            </div>
            
            {/* Panel Footer */}
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button 
                onClick={addTestCase}
                className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition"
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                Add Test Case
              </button>
              <button 
                onClick={runAllTestCases}
                className="flex items-center gap-2 px-5 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition"
              >
                <FontAwesomeIcon icon={faPlay} className="w-4 h-4" />
                Run All
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