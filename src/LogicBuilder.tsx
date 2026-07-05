import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPenToSquare,
  faPlus,
  faPrint,
  faRotate,
  faTag,
  faBuilding,
  faClock,
  faLightbulb,
  faTriangleExclamation,
  faBolt,
  faRoute,
  faShieldCheck,
  faBullseye,
  faLayerGroup,
  faArrowRightArrowLeft,
  faEye,
  faChevronDown,
  faChevronRight,
  faCode,
  faDiagramProject,
  faChartLine,
  faStairs,
  faCircleInfo,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';

// Types
interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  tags: string[];
  companies: string[];
  similar_problems?: string[];
  hints: string[];
}

interface LogicTemplate {
  id: string;
  problem_id: string;
  title: string;
  algorithm: string[];
  pseudocode: string;
  flowchart: string;
  approach: string;
  complexity: string;
}

// Problem list - 130 problems
const PROBLEMS = [
  { key: 'fibonacci', label: 'Fibonacci' },
  { key: 'palindrome', label: 'Valid Palindrome' },
  { key: 'anagram', label: 'Valid Anagram' },
  { key: 'contains_duplicate', label: 'Contains Duplicate' },
  { key: 'missing_number', label: 'Missing Number' },
  { key: 'single_number', label: 'Single Number' },
  { key: 'majority_element', label: 'Majority Element' },
  { key: 'power_of_two', label: 'Power of Two' },
  { key: 'power_of_four', label: 'Power of Four' },
  { key: 'happy_number', label: 'Happy Number' },
  { key: 'number_of_1_bits', label: 'Number of 1 Bits' },
  { key: 'reverse_bits', label: 'Reverse Bits' },
  { key: 'two_sum', label: 'Two Sum' },
  { key: 'remove_duplicates_sorted', label: 'Remove Duplicates from Sorted Array' },
  { key: 'move_zeroes', label: 'Move Zeroes' },
  { key: 'rotate_array', label: 'Rotate Array' },
  { key: 'merge_sorted_arrays', label: 'Merge Sorted Arrays' },
  { key: 'intersection', label: 'Array Intersection' },
  { key: 'first_unique_character', label: 'First Unique Character' },
  { key: 'longest_common_prefix', label: 'Longest Common Prefix' },
  { key: 'valid_parentheses', label: 'Valid Parentheses' },
  { key: 'string_compression', label: 'String Compression' },
  { key: 'reverse_words', label: 'Reverse Words in String' },
  { key: 'string_to_integer', label: 'String to Integer (atoi)' },
  { key: 'climbing_stairs', label: 'Climbing Stairs' },
  { key: 'maximum_subarray', label: 'Maximum Subarray' },
  { key: 'best_time_buy_sell', label: 'Best Time to Buy and Sell Stock' },
  { key: 'house_robber', label: 'House Robber' },
  { key: 'coin_change', label: 'Coin Change' },
  { key: 'longest_increasing_subsequence', label: 'Longest Increasing Subsequence' },
  { key: 'jump_game', label: 'Jump Game' },
  { key: 'unique_paths', label: 'Unique Paths' },
  { key: 'word_break', label: 'Word Break' },
  { key: 'decode_ways', label: 'Decode Ways' },
  { key: 'longest_palindromic_substring', label: 'Longest Palindromic Substring' },
  { key: 'edit_distance', label: 'Edit Distance' },
  { key: 'reverse_linked_list', label: 'Reverse Linked List' },
  { key: 'merge_two_sorted_lists', label: 'Merge Two Sorted Lists' },
  { key: 'linked_list_cycle', label: 'Linked List Cycle' },
  { key: 'remove_nth_node', label: 'Remove Nth Node From End' },
  { key: 'add_two_numbers', label: 'Add Two Numbers' },
  { key: 'intersection_linked_lists', label: 'Intersection of Two Linked Lists' },
  { key: 'palindrome_linked_list', label: 'Palindrome Linked List' },
  { key: 'reorder_list', label: 'Reorder List' },
  { key: 'copy_list_random_pointer', label: 'Copy List with Random Pointer' },
  { key: 'lru_cache', label: 'LRU Cache' },
  { key: 'binary_tree_inorder', label: 'Binary Tree Inorder Traversal' },
  { key: 'binary_tree_level_order', label: 'Binary Tree Level Order Traversal' },
  { key: 'maximum_depth_binary_tree', label: 'Maximum Depth of Binary Tree' },
  { key: 'symmetric_tree', label: 'Symmetric Tree' },
  { key: 'invert_binary_tree', label: 'Invert Binary Tree' },
  { key: 'validate_bst', label: 'Validate Binary Search Tree' },
  { key: 'lowest_common_ancestor', label: 'Lowest Common Ancestor' },
  { key: 'binary_tree_paths', label: 'Binary Tree Paths' },
  { key: 'path_sum', label: 'Path Sum' },
  { key: 'construct_tree_preorder_inorder', label: 'Construct Tree from Preorder and Inorder' },
  { key: 'serialize_deserialize_tree', label: 'Serialize and Deserialize Binary Tree' },
  { key: 'kth_smallest_bst', label: 'Kth Smallest Element in BST' },
  { key: 'binary_search', label: 'Binary Search' },
  { key: 'search_rotated_array', label: 'Search in Rotated Sorted Array' },
  { key: 'find_minimum_rotated', label: 'Find Minimum in Rotated Sorted Array' },
  { key: 'search_2d_matrix', label: 'Search a 2D Matrix' },
  { key: 'find_peak_element', label: 'Find Peak Element' },
  { key: 'first_bad_version', label: 'First Bad Version' },
  { key: 'sqrt_x', label: 'Sqrt(x)' },
  { key: 'median_two_sorted_arrays', label: 'Median of Two Sorted Arrays' },
  { key: 'number_of_islands', label: 'Number of Islands' },
  { key: 'clone_graph', label: 'Clone Graph' },
  { key: 'course_schedule', label: 'Course Schedule' },
  { key: 'word_ladder', label: 'Word Ladder' },
  { key: 'pacific_atlantic', label: 'Pacific Atlantic Water Flow' },
  { key: 'surrounded_regions', label: 'Surrounded Regions' },
  { key: 'graph_valid_tree', label: 'Graph Valid Tree' },
  { key: 'alien_dictionary', label: 'Alien Dictionary' },
  { key: 'network_delay_time', label: 'Network Delay Time' },
  { key: 'min_cost_connect_points', label: 'Min Cost to Connect All Points' },
  { key: 'subsets', label: 'Subsets' },
  { key: 'permutations', label: 'Permutations' },
  { key: 'combination_sum', label: 'Combination Sum' },
  { key: 'letter_combinations_phone', label: 'Letter Combinations of Phone Number' },
  { key: 'generate_parentheses', label: 'Generate Parentheses' },
  { key: 'n_queens', label: 'N-Queens' },
  { key: 'word_search', label: 'Word Search' },
  { key: 'sudoku_solver', label: 'Sudoku Solver' },
  { key: 'palindrome_partitioning', label: 'Palindrome Partitioning' },
  { key: 'restore_ip_addresses', label: 'Restore IP Addresses' },
  { key: 'implement_trie', label: 'Implement Trie' },
  { key: 'add_search_word', label: 'Add and Search Word' },
  { key: 'word_search_ii', label: 'Word Search II' },
  { key: 'top_k_frequent', label: 'Top K Frequent Elements' },
  { key: 'find_median_data_stream', label: 'Find Median from Data Stream' },
  { key: 'kth_largest_element', label: 'Kth Largest Element in Array' },
  { key: 'merge_k_sorted_lists', label: 'Merge K Sorted Lists' },
  { key: 'task_scheduler', label: 'Task Scheduler' },
  { key: 'min_stack', label: 'Min Stack' },
  { key: 'daily_temperatures', label: 'Daily Temperatures' },
  { key: 'largest_rectangle_histogram', label: 'Largest Rectangle in Histogram' },
  { key: 'trapping_rain_water', label: 'Trapping Rain Water' },
  { key: 'sliding_window_maximum', label: 'Sliding Window Maximum' },
  { key: 'merge_intervals', label: 'Merge Intervals' },
  { key: 'insert_interval', label: 'Insert Interval' },
  { key: 'non_overlapping_intervals', label: 'Non-overlapping Intervals' },
  { key: 'meeting_rooms', label: 'Meeting Rooms' },
  { key: 'meeting_rooms_ii', label: 'Meeting Rooms II' },
  { key: 'minimum_window_substring', label: 'Minimum Window Substring' },
  { key: 'longest_substring_no_repeat', label: 'Longest Substring Without Repeating' },
  { key: 'longest_repeating_character', label: 'Longest Repeating Character Replacement' },
  { key: 'permutation_in_string', label: 'Permutation in String' },
  { key: 'find_all_anagrams', label: 'Find All Anagrams in String' },
  { key: 'container_most_water', label: 'Container With Most Water' },
  { key: 'three_sum', label: '3Sum' },
  { key: 'three_sum_closest', label: '3Sum Closest' },
  { key: 'four_sum', label: '4Sum' },
  { key: 'remove_duplicates_ii', label: 'Remove Duplicates II' },
  { key: 'sort_colors', label: 'Sort Colors' },
  { key: 'next_permutation', label: 'Next Permutation' },
  { key: 'rotate_image', label: 'Rotate Image' },
  { key: 'spiral_matrix', label: 'Spiral Matrix' },
  { key: 'set_matrix_zeroes', label: 'Set Matrix Zeroes' },
  { key: 'game_of_life', label: 'Game of Life' },
  { key: 'longest_consecutive_sequence', label: 'Longest Consecutive Sequence' },
  { key: 'group_anagrams', label: 'Group Anagrams' },
  { key: 'valid_sudoku', label: 'Valid Sudoku' },
  { key: 'encode_decode_strings', label: 'Encode and Decode Strings' },
  { key: 'product_except_self', label: 'Product of Array Except Self' },
];

// ==================== APPROACH CARDS COMPONENT ====================
// Smartly parses the approach text into sections and renders each as a card

// Icon helper for section config

// Section config: maps known header keywords to icons, colors, and priority
const SECTION_CONFIG: { keyword: string; icon: any; bg: string; border: string; accent: string }[] = [
  { keyword: 'approach',        icon: faLightbulb,            bg: 'bg-amber-50',    border: 'border-amber-200',   accent: 'text-amber-600' },
  { keyword: 'primary',         icon: faBullseye,             bg: 'bg-blue-50',     border: 'border-blue-200',    accent: 'text-blue-600' },
  { keyword: 'strategy',        icon: faRoute,                bg: 'bg-indigo-50',   border: 'border-indigo-200',  accent: 'text-indigo-600' },
  { keyword: 'alternative',     icon: faArrowRightArrowLeft,  bg: 'bg-purple-50',   border: 'border-purple-200',  accent: 'text-purple-600' },
  { keyword: 'edge',            icon: faTriangleExclamation,  bg: 'bg-red-50',      border: 'border-red-200',     accent: 'text-red-500' },
  { keyword: 'corner',          icon: faShieldCheck,          bg: 'bg-orange-50',   border: 'border-orange-200',  accent: 'text-orange-500' },
  { keyword: 'optimization',    icon: faBolt,                 bg: 'bg-emerald-50',  border: 'border-emerald-200', accent: 'text-emerald-600' },
  { keyword: 'key',             icon: faEye,                  bg: 'bg-cyan-50',     border: 'border-cyan-200',    accent: 'text-cyan-600' },
  { keyword: 'observation',     icon: faEye,                  bg: 'bg-cyan-50',     border: 'border-cyan-200',    accent: 'text-cyan-600' },
  { keyword: 'insight',         icon: faLightbulb,            bg: 'bg-yellow-50',   border: 'border-yellow-200',  accent: 'text-yellow-600' },
  { keyword: 'step',            icon: faStairs,               bg: 'bg-sky-50',      border: 'border-sky-200',     accent: 'text-sky-600' },
  { keyword: 'implementation',  icon: faLayerGroup,           bg: 'bg-slate-50',    border: 'border-slate-200',   accent: 'text-slate-600' },
  { keyword: 'complexity',      icon: faClock,                bg: 'bg-violet-50',   border: 'border-violet-200',  accent: 'text-violet-600' },
  { keyword: 'time',            icon: faClock,                bg: 'bg-violet-50',   border: 'border-violet-200',  accent: 'text-violet-600' },
  { keyword: 'space',           icon: faLayerGroup,           bg: 'bg-fuchsia-50',  border: 'border-fuchsia-200', accent: 'text-fuchsia-600' },
];

const DEFAULT_SECTION = { icon: faCircleInfo, bg: 'bg-gray-50', border: 'border-gray-200', accent: 'text-gray-600' };

function getConfigForHeader(header: string) {
  const lower = header.toLowerCase();
  for (const cfg of SECTION_CONFIG) {
    if (lower.includes(cfg.keyword)) return cfg;
  }
  return DEFAULT_SECTION;
}

interface ApproachSection {
  title: string;
  lines: string[];
  config: { icon: any; bg: string; border: string; accent: string };
}

function parseApproachSections(text: string): ApproachSection[] {
  if (!text) return [];

  const lines = text.split('\n');
  const sections: ApproachSection[] = [];
  let currentSection: ApproachSection | null = null;
  const introLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers: "**Header:**", "Header:", or "## Header"
    const isHeader =
      trimmed.match(/^\*\*[^*]+\*\*:?\s*$/) ||
      trimmed.match(/^[A-Z][^:]{2,}:\s*$/) ||
      trimmed.match(/^#{1,3}\s+.+/);

    if (isHeader) {
      if (currentSection) sections.push(currentSection);

      const cleanTitle = trimmed
        .replace(/^\*\*/, '').replace(/\*\*:?\s*$/, '')
        .replace(/^#+\s*/, '')
        .replace(/:$/, '')
        .trim();

      currentSection = {
        title: cleanTitle,
        lines: [],
        config: getConfigForHeader(cleanTitle),
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      introLines.push(line);
    }
  }

  if (currentSection) sections.push(currentSection);

  // Intro lines → "Overview" card
  if (introLines.some(l => l.trim().length > 0)) {
    sections.unshift({
      title: 'Overview',
      lines: introLines,
      config: { icon: faBullseye, bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-600' },
    });
  }

  // No headers found at all → single card
  if (sections.length === 0) {
    sections.push({
      title: 'Solution Approach',
      lines: lines,
      config: { icon: faLightbulb, bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-600' },
    });
  }

  return sections;
}

// Inline markdown renderer
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

// Render section body lines
function renderSectionBody(lines: string[]) {
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    if (trimmed.match(/^\d+\.\s*\*\*/)) {
      return <p key={i} className="pl-2 py-0.5">{renderInlineMarkdown(trimmed)}</p>;
    }
    if (trimmed.match(/^\d+\./)) {
      return <p key={i} className="font-medium text-gray-800 pl-2 py-0.5">{renderInlineMarkdown(trimmed)}</p>;
    }
    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      return (
        <div key={i} className="flex gap-2 pl-2 py-0.5">
          <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
          <span className="text-gray-600">{renderInlineMarkdown(trimmed.replace(/^[-•]\s*/, ''))}</span>
        </div>
      );
    }
    if (trimmed.match(/^\*\*[^*]+\*\*:?\s*$/) && trimmed.length < 60) {
      const clean = trimmed.replace(/\*\*/g, '').replace(/:$/, '');
      return <p key={i} className="font-semibold text-gray-800 mt-3 mb-1 text-sm">{clean}</p>;
    }
    return <p key={i} className="py-0.5">{renderInlineMarkdown(trimmed)}</p>;
  }).filter(Boolean);
}

const ApproachCards: React.FC<{ approachText: string }> = ({ approachText }) => {
  const sections = parseApproachSections(approachText);
  const [collapsedCards, setCollapsedCards] = useState<Record<number, boolean>>({});

  const toggleCard = (idx: number) => {
    setCollapsedCards(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-3">
      {sections.map((section, idx) => {
        const isCollapsed = collapsedCards[idx] === true;
        const bodyContent = renderSectionBody(section.lines);
        const hasContent = bodyContent.length > 0;

        return (
          <div
            key={idx}
            className={`rounded-xl border ${section.config.border} ${section.config.bg} overflow-hidden transition-all duration-200`}
          >
            {/* Card Header */}
            <button
              onClick={() => hasContent && toggleCard(idx)}
              className={`w-full flex items-center gap-3 px-5 py-4 text-left ${hasContent ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`flex-shrink-0 w-8 h-8 rounded-lg bg-white border ${section.config.border} flex items-center justify-center ${section.config.accent}`}>
                <FontAwesomeIcon icon={section.config.icon} className="w-4 h-4" />
              </span>
              <span className="flex-1 font-semibold text-gray-800 text-[15px]">{section.title}</span>
              {hasContent && (
                <FontAwesomeIcon
                  icon={isCollapsed ? faChevronRight : faChevronDown}
                  className={`w-3.5 h-3.5 ${section.config.accent} flex-shrink-0 transition-transform`}
                />
              )}
            </button>

            {/* Card Body */}
            {hasContent && !isCollapsed && (
              <div className="px-5 pb-4 text-sm text-gray-700 leading-relaxed border-t border-white/60">
                <div className="pt-3 space-y-0.5">
                  {bodyContent}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const LogicBuilder: React.FC = () => {
  // State
  const [currentProblemKey, setCurrentProblemKey] = useState<string>('fibonacci');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedContent, setGeneratedContent] = useState<LogicTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<string>('algorithm');
  
  // Loading steps state
  const [loadingSteps, setLoadingSteps] = useState<{
    id: string;
    title: string;
    status: 'pending' | 'active' | 'completed';
  }[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load problem from JSON
  const loadProblem = async (key: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/problems/${key}.problem.json`);
      if (response.ok) {
        const data = await response.json();
        setProblem(data);
        setCurrentProblemKey(key);
        setGeneratedContent(null);
      }
    } catch (error) {
      console.error('Failed to load problem:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load algorithm from JSON
  const loadAlgorithm = async (key: string): Promise<LogicTemplate | null> => {
    try {
      const response = await fetch(`/problems/${key}.algorithm.json`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Failed to load algorithm:', error);
    }
    return null;
  };

  // Generate logic analysis with animated steps
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedContent(null);
    setOverallProgress(0);
    
    const steps = [
      { id: 'analyze', title: 'Analyzing problem structure', status: 'pending' as const },
      { id: 'algorithm', title: 'Generating algorithm steps', status: 'pending' as const },
      { id: 'pseudocode', title: 'Creating pseudocode', status: 'pending' as const },
      { id: 'flowchart', title: 'Building visual flowchart', status: 'pending' as const },
      { id: 'complexity', title: 'Computing complexity analysis', status: 'pending' as const },
    ];
    
    setLoadingSteps(steps);
    
    try {
      if (isCustomMode && customText.trim()) {
        // For custom problems, call the AI API
        // Start the API call immediately
        const apiPromise = firebaseService.generateLogicAnalysis(customText.trim());
        
        // Animate through each step while API is processing
        for (let i = 0; i < steps.length; i++) {
          setLoadingSteps(prev => prev.map((step, idx) => ({
            ...step,
            status: idx === i ? 'active' : idx < i ? 'completed' : 'pending'
          })));
          setOverallProgress(((i) / steps.length) * 100);
          
          await new Promise(resolve => setTimeout(resolve, 800));
          
          setLoadingSteps(prev => prev.map((step, idx) => ({
            ...step,
            status: idx <= i ? 'completed' : 'pending'
          })));
          setOverallProgress(((i + 1) / steps.length) * 100);
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Wait for API response
        const result = await apiPromise;
        
        if (result?.success && result?.data) {
          setGeneratedContent(result.data as LogicTemplate);
        } else {
          console.error('API returned error:', result?.error);
          alert(result?.error || 'Failed to generate analysis. Please try again.');
        }
      } else {
        // For preset problems, load from JSON files
        // Animate through each step
        for (let i = 0; i < steps.length; i++) {
          setLoadingSteps(prev => prev.map((step, idx) => ({
            ...step,
            status: idx === i ? 'active' : idx < i ? 'completed' : 'pending'
          })));
          setOverallProgress(((i) / steps.length) * 100);
          
          await new Promise(resolve => setTimeout(resolve, 600));
          
          setLoadingSteps(prev => prev.map((step, idx) => ({
            ...step,
            status: idx <= i ? 'completed' : 'pending'
          })));
          setOverallProgress(((i + 1) / steps.length) * 100);
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Load actual algorithm data
        const algorithm = await loadAlgorithm(currentProblemKey);
        if (algorithm) {
          setGeneratedContent(algorithm);
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate analysis. Please try again.');
    }
    
    // Final delay before showing results
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsGenerating(false);
    setLoadingSteps([]);
  };

  const handleNewProblem = () => {
    setIsCustomMode(true);
    setCustomText('');
    setGeneratedContent(null);
    setProblem(null);
  };

  const handlePrint = () => {
    if (!generatedContent) {
      alert('Please generate content first before printing.');
      return;
    }

    const problemTitle = isCustomMode ? 'Custom Problem Analysis' : (problem?.title || 'Algorithm Analysis');
    
    // Convert complexity text to HTML with proper table rendering
    const formatComplexity = (text: string) => {
      const lines = text.split('\n');
      let html = '';
      let tableRows: string[][] = [];
      
      const flushTable = () => {
        if (tableRows.length >= 2) {
          html += '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">';
          tableRows.forEach((cells, idx) => {
            if (idx === 0) {
              html += '<tr>' + cells.map(c => 
                `<th style="background:#7c3aed;color:white;padding:10px 12px;text-align:left;border:1px solid #d1d5db;font-weight:600;">${c}</th>`
              ).join('') + '</tr>';
            } else {
              html += '<tr>' + cells.map(c => 
                `<td style="padding:10px 12px;border:1px solid #d1d5db;background:${idx % 2 === 0 ? '#f9fafb' : 'white'};">${c}</td>`
              ).join('') + '</tr>';
            }
          });
          html += '</table>';
        }
        tableRows = [];
      };
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) continue;
        
        // Skip box drawing borders (┌┐└┘├┤┬┴┼─) and dashed separators
        if (trimmed.match(/^[┌┐└┘├┤┬┴┼─│\-\+\s]+$/) && !trimmed.match(/[a-zA-Z0-9]/)) {
          continue;
        }
        
        // Check for table row - either │ separated or | separated
        const isBoxTable = trimmed.includes('│');
        const isPipeTable = trimmed.startsWith('|') && trimmed.endsWith('|');
        
        if (isBoxTable || isPipeTable) {
          const separator = isBoxTable ? '│' : '|';
          const cells = trimmed.split(separator)
            .map(c => c.trim())
            .filter(c => c.length > 0 && !c.match(/^[\-─]+$/));
          
          if (cells.length >= 2) {
            tableRows.push(cells);
            continue;
          }
        }
        
        // Not a table row - flush any pending table first
        if (tableRows.length > 0) {
          flushTable();
        }
        
        // Format regular content
        const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Headers (ending with :)
        if (trimmed.match(/^[A-Z][^:]*:$/)) {
          html += `<h4 style="font-weight:600;font-size:14px;margin:20px 0 10px;padding-top:12px;border-top:1px solid #e5e7eb;">${formatted}</h4>`;
        }
        // Bold headers like **Text:**
        else if (trimmed.match(/^\*\*[^*]+\*\*:?$/)) {
          html += `<h4 style="font-weight:600;font-size:14px;margin:20px 0 10px;padding-top:12px;border-top:1px solid #e5e7eb;">${trimmed.replace(/\*\*/g, '')}</h4>`;
        }
        // Bullet points
        else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          html += `<p style="padding-left:20px;margin:6px 0;color:#4b5563;">${formatted}</p>`;
        }
        // Regular text
        else {
          html += `<p style="margin:6px 0;">${formatted}</p>`;
        }
      }
      
      // Flush remaining table
      if (tableRows.length > 0) {
        flushTable();
      }
      
      return html;
    };

    // Helper to format approach text
    const formatApproach = (text: string) => {
      return text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        
        // Headers (bold text ending with :)
        if (trimmed.match(/^\*\*[^*]+\*\*:?$/) || trimmed.match(/^[A-Z][^:]*:$/)) {
          const clean = trimmed.replace(/\*\*/g, '');
          return `<h4>${clean}</h4>`;
        }
        
        // Numbered items
        if (trimmed.match(/^\d+\./)) {
          const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          return `<p class="numbered">${formatted}</p>`;
        }
        
        // Bullet points
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          return `<p class="bullet">${formatted}</p>`;
        }
        
        const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        return `<p>${formatted}</p>`;
      }).join('');
    };
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${problemTitle} - Logic Builder</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 850px;
            margin: 0 auto;
            color: #1f2937;
            line-height: 1.6;
            font-size: 14px;
          }
          h1 { 
            font-size: 26px;
            margin-bottom: 8px;
            color: #7c3aed;
          }
          .header-line {
            height: 3px;
            background: linear-gradient(to right, #ec4899, #8b5cf6, #3b82f6);
            border-radius: 2px;
            margin-bottom: 30px;
          }
          h2 { 
            font-size: 16px;
            margin: 25px 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          h2 .number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            background: #7c3aed;
            color: white;
            border-radius: 50%;
            font-size: 13px;
            flex-shrink: 0;
          }
          .section { margin-bottom: 20px; }
          
          /* Algorithm Steps */
          .steps-container {
            background: #f8fafc;
            border-radius: 8px;
            padding: 15px;
          }
          .step {
            display: flex;
            align-items: flex-start;
            margin: 8px 0;
          }
          .step-number {
            flex-shrink: 0;
            width: 22px;
            height: 22px;
            background: #dbeafe;
            color: #2563eb;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            margin-right: 10px;
            margin-top: 2px;
          }
          .step-text { font-size: 13px; }
          
          /* Pseudocode */
          pre {
            background: #1e293b;
            color: #4ade80;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre-wrap;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          }
          
          /* Flowchart */
          .flowchart {
            background: #f8fafc;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 11px;
            white-space: pre-wrap;
            line-height: 1.4;
          }
          
          /* Approach */
          .approach { padding: 0 5px; }
          .approach h4 {
            font-size: 14px;
            font-weight: 600;
            color: #1f2937;
            margin: 15px 0 8px 0;
          }
          .approach h4:first-child { margin-top: 0; }
          .approach p { margin: 6px 0; font-size: 13px; }
          .approach p.numbered { padding-left: 10px; }
          .approach p.bullet { padding-left: 15px; color: #4b5563; }
          .approach strong { color: #1f2937; }
          
          /* Complexity */
          .complexity-box {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            font-size: 13px;
          }
          .complexity-box p { margin: 6px 0; }
          .complexity-box p.bullet {
            padding-left: 15px;
            color: #4b5563;
          }
          .complexity-box h4 {
            font-size: 14px;
            font-weight: 600;
            color: #1f2937;
            margin: 16px 0 8px 0;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
          }
          .complexity-box h4:first-child {
            margin-top: 0;
            padding-top: 0;
            border-top: none;
          }
          .complexity-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 12px;
          }
          .complexity-table th,
          .complexity-table td {
            border: 1px solid #d1d5db;
            padding: 10px 14px;
            text-align: left;
          }
          .complexity-table th {
            background: #7c3aed;
            color: white;
            font-weight: 600;
          }
          .complexity-table td {
            background: white;
          }
          .complexity-table tr:nth-child(even) td {
            background: #f9fafb;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #9ca3af;
            text-align: center;
          }
          
          @media print {
            body { padding: 20px; }
            .section { page-break-inside: avoid; }
            pre { background: #f1f5f9 !important; color: #166534 !important; }
          }
        </style>
      </head>
      <body>
        <h1>${problemTitle}</h1>
        <div class="header-line"></div>

        <div class="section">
          <h2><span class="number">1</span>Step-by-Step Algorithm</h2>
          <div class="steps-container">
            ${generatedContent.algorithm.map((step, i) => `
              <div class="step">
                <span class="step-number">${i + 1}</span>
                <span class="step-text">${step.replace(/^Step \d+:\s*/i, '')}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="section">
          <h2><span class="number">2</span>Pseudocode</h2>
          <pre>${generatedContent.pseudocode}</pre>
        </div>

        <div class="section">
          <h2><span class="number">3</span>Flowchart Description</h2>
          <div class="flowchart">${generatedContent.flowchart}</div>
        </div>

        <div class="section">
          <h2><span class="number">4</span>Solution Approach</h2>
          <div class="approach">
            ${formatApproach(generatedContent.approach)}
          </div>
        </div>

        <div class="section">
          <h2><span class="number">5</span>Complexity Analysis</h2>
          <div class="complexity-box">
            ${formatComplexity(generatedContent.complexity)}
          </div>
        </div>

        <div class="footer">
          Generated by Logic Builder - TutorialsPoint
        </div>
      </body>
      </html>
    `;
    
    // Create hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();
      
      // Wait for content to load then print
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Remove iframe after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 250);
      };
    }
  };

  // Resizer
  const handleMouseDown = () => setIsResizing(true);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPanelWidth(Math.min(Math.max(newWidth, 25), 75));
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  useEffect(() => {
    loadProblem('fibonacci');
  }, []);

  // Parse HTML in description
  const renderHTML = (text: string) => {
    return <span dangerouslySetInnerHTML={{ __html: text.replace(/`<code>(.*?)<\/code>`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">$1</code>') }} />;
  };

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'hard': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Main Content */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="flex flex-col overflow-hidden" style={{ width: `${leftPanelWidth}%` }}>
          {/* Header with Problem Tabs */}
          <div className="border-b border-gray-200 flex-shrink-0">
            {/* Problem Tabs - Scrollable */}
            <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto bg-white"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap flex-shrink-0">
                PROBLEMS ({PROBLEMS.length}):
              </span>
              {PROBLEMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setIsCustomMode(false);
                    loadProblem(p.key);
                  }}
                  disabled={isGenerating}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all border flex-shrink-0
                    ${currentProblemKey === p.key && !isCustomMode
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
                    ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <FontAwesomeIcon icon={faRotate} className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : isCustomMode ? (
              <div className="h-full flex flex-col gap-4">
                {/* Textarea */}
                <div className="relative">
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value.slice(0, 1024))}
                    maxLength={1024}
                    placeholder="Describe your algorithm problem here (max 1024 characters)...

Example: Write a function that finds the maximum sum of any contiguous subarray..."
                    className="w-full h-48 p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">{customText.length}/1024</div>
                </div>

                {/* What we're looking for */}
                <div className="border-l-4 border-green-500 bg-white rounded-r-xl p-4">
                  <h4 className="font-semibold text-green-600 flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    What we're looking for:
                  </h4>
                  
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4 text-sm">
                    <p>
                      <span className="mr-2">📄</span>
                      <span className="font-semibold">Problem Description:</span> Clear explanation of what the algorithm should do, input/output format, and any special requirements.
                    </p>
                    <p>
                      <span className="mr-2">💡</span>
                      <span className="font-semibold">Example Cases:</span> Include sample inputs and expected outputs to illustrate the problem clearly.
                    </p>
                    <p>
                      <span className="mr-2">⚡</span>
                      <span className="font-semibold">Constraints:</span> Any limitations on input size, time complexity requirements, or edge cases to consider.
                    </p>
                    <p>
                      <span className="mr-2">🎯</span>
                      <span className="font-semibold">Good Examples:</span> "Find longest palindromic substring", "Implement LRU Cache", "Merge K sorted arrays".
                    </p>
                    <p>
                      <span className="mr-2">✏️</span>
                      <span className="font-semibold">Character Limit:</span> Maximum 1024 characters to ensure focused problem descriptions.
                    </p>
                    <p className="mt-4 pt-4 border-t border-gray-200">
                      <span className="mr-2">🚀</span>
                      <span className="font-semibold text-green-600">Click the "Generate" button</span> above to generate the algorithm analysis for your problem.
                    </p>
                  </div>
                </div>
              </div>
            ) : problem ? (
              <div className="space-y-5">
                {/* Title */}
                <div className="pb-3 mb-4">
                  <h1 className="text-2xl font-bold">
                    <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                      {problem.title}
                    </span>
                  </h1>
                  <div className="h-0.5 mt-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-full" />
                </div>

                {/* Difficulty & Category Tags */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 text-xs font-bold rounded ${getDifficultyStyle(problem.difficulty)}`}>
                    {problem.difficulty?.toUpperCase()}
                  </span>
                  {problem.category?.split(',').map((cat, i) => (
                    <span key={i} className="px-3 py-1 text-xs font-medium bg-white text-gray-700 rounded border border-gray-300">
                      {cat.trim()}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-700 leading-relaxed">
                  {renderHTML(problem.description)}
                </p>

                {/* Examples */}
                {problem.examples?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-green-600">Examples</h3>
                    {problem.examples.map((ex, i) => (
                      <div key={i} className="bg-white rounded-lg p-4 border-l-4 border-green-500 shadow-sm">
                        <p className="font-semibold text-gray-800 mb-2">Example {i + 1}:</p>
                        <p className="text-sm text-gray-700"><span className="font-semibold">Input:</span> nums = {ex.input}</p>
                        <p className="text-sm text-gray-700"><span className="font-semibold">Output:</span> {ex.output}</p>
                        {ex.explanation && (
                          <p className="text-sm text-gray-600 mt-1"><span className="font-semibold">Explanation:</span> {renderHTML(ex.explanation)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Constraints */}
                {problem.constraints?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-blue-600">Constraints</h3>
                    <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500 shadow-sm">
                      {problem.constraints.map((c, i) => (
                        <p key={i} className="text-sm text-gray-700 py-0.5">{renderHTML(c)}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <hr className="border-gray-200" />

                {/* Tags & Companies - Side by Side */}
                <div className="flex gap-8">
                  {/* Tags */}
                  {problem.tags?.length > 0 && (
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2 mb-3">
                        <FontAwesomeIcon icon={faTag} className="w-4 h-4" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {problem.tags.map((tag, i) => (
                          <span key={i} className="px-3 py-1 text-xs font-medium bg-white text-gray-700 rounded border border-gray-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Companies */}
                  {problem.companies?.length > 0 && (
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2 mb-3">
                        <FontAwesomeIcon icon={faBuilding} className="w-4 h-4" />
                        Companies
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {problem.companies.map((company, i) => (
                          <span key={i} className="px-3 py-1 text-xs font-medium bg-white text-gray-700 rounded border border-gray-300">
                            {company}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hints */}
                {problem.hints?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <FontAwesomeIcon icon={faClock} className="w-4 h-4" />
                      Hints
                    </h3>
                    <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-400 space-y-3">
                      {problem.hints.map((hint, i) => (
                        <p key={i} className="text-sm text-gray-700 flex gap-2">
                          <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                          {hint}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Select a problem to view
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-1 cursor-col-resize relative transition-colors flex-shrink-0
            ${isResizing ? 'bg-gradient-to-b from-pink-500 via-purple-500 to-blue-500' : 'bg-gray-200 hover:bg-gradient-to-b hover:from-pink-500 hover:via-purple-500 hover:to-blue-500'}
          `}
        >
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-8 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors
            ${isResizing ? 'bg-gradient-to-b from-pink-500 via-purple-500 to-blue-500' : 'bg-gray-300 hover:bg-gradient-to-b hover:from-pink-500 hover:via-purple-500 hover:to-blue-500'}
          `}>
            <div className={`w-1 h-1 rounded-full ${isResizing ? 'bg-white' : 'bg-gray-500'}`} />
            <div className={`w-1 h-1 rounded-full ${isResizing ? 'bg-white' : 'bg-gray-500'}`} />
            <div className={`w-1 h-1 rounded-full ${isResizing ? 'bg-white' : 'bg-gray-500'}`} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {/* Header with Buttons */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
            <h2 className="text-base font-bold flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <path stroke="url(#iconGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                Logic Analysis
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || (isCustomMode && !customText.trim())}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <FontAwesomeIcon icon={faRotate} className="w-4 h-4 animate-spin" /> : <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4" />}
                Generate
              </button>
              <button
                onClick={handleNewProblem}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                New Problem
              </button>
              <button
                onClick={handlePrint}
                disabled={isGenerating || !generatedContent}
                className="flex items-center justify-center w-9 h-9 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Print Analysis"
              >
                <FontAwesomeIcon icon={faPrint} className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Generated Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Loading Animation */}
            {isGenerating && loadingSteps.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="w-full max-w-lg">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                        Analyzing {isCustomMode ? 'Custom Problem' : problem?.title || 'Problem'}
                      </h2>
                    </div>
                    <p className="text-gray-500">AI-powered algorithm analysis in progress</p>
                  </div>

                  {/* Overall Progress */}
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
                      <span className="text-sm font-bold text-blue-600">{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    {loadingSteps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300
                          ${step.status === 'completed' 
                            ? 'bg-green-50 border-green-400' 
                            : step.status === 'active'
                            ? 'bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 border-purple-400'
                            : 'bg-gray-50 border-gray-200'
                          }
                        `}
                      >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                          ${step.status === 'completed'
                            ? 'bg-green-500'
                            : step.status === 'active'
                            ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 animate-pulse'
                            : 'bg-gray-300'
                          }
                        `}>
                          {step.status === 'completed' ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : step.status === 'active' ? (
                            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full" />
                          )}
                        </div>

                        {/* Text */}
                        <div className="flex-1">
                          <p className={`font-semibold transition-colors duration-300
                            ${step.status === 'completed'
                              ? 'text-green-600'
                              : step.status === 'active'
                              ? 'text-purple-600'
                              : 'text-gray-400'
                            }
                          `}>
                            {step.title}
                          </p>
                          <p className={`text-sm transition-colors duration-300
                            ${step.status === 'completed'
                              ? 'text-green-500'
                              : step.status === 'active'
                              ? 'text-purple-400'
                              : 'text-gray-400'
                            }
                          `}>
                            {step.status === 'completed' ? 'Completed' : step.status === 'active' ? 'Processing...' : 'Pending'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-8 text-center">
                    <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
                      Please wait while we process your request
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ) : !generatedContent ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="font-medium text-gray-600">
                  {problem?.title || 'No problem selected'}
                </p>
                <p className="text-sm mt-1">Click "Generate" to analyze this problem</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Beautiful Tabs */}
                <div className="flex border-b border-gray-200 bg-white px-4">
                  {[
                    { key: 'algorithm', label: 'Algorithm', icon: (
                      <FontAwesomeIcon icon={faStairs} className="w-4 h-4" />
                    )},
                    { key: 'pseudocode', label: 'Pseudocode', icon: (
                      <FontAwesomeIcon icon={faCode} className="w-4 h-4" />
                    )},
                    { key: 'flowchart', label: 'Flowchart', icon: (
                      <FontAwesomeIcon icon={faDiagramProject} className="w-4 h-4" />
                    )},
                    { key: 'approach', label: 'Approach', icon: (
                      <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4" />
                    )},
                    { key: 'complexity', label: 'Complexity', icon: (
                      <FontAwesomeIcon icon={faChartLine} className="w-4 h-4" />
                    )},
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative
                        ${activeTab === tab.key
                          ? 'text-gray-800'
                          : 'text-gray-500 hover:text-gray-700'
                        }
                      `}
                    >
                      {tab.icon}
                      {tab.label}
                      {activeTab === tab.key && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Algorithm Tab */}
                  {activeTab === 'algorithm' && (
                    <div className="bg-white rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                        <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-1.5 rounded-lg">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </span>
                        Step-by-Step Algorithm
                      </h3>
                      <ol className="space-y-4">
                        {generatedContent.algorithm.map((step, i) => (
                          <li key={i} className="flex gap-4 items-start">
                            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                              {i + 1}
                            </span>
                            <span className="text-sm text-gray-700 pt-1.5">{step.replace(/^Step \d+:\s*/i, '')}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Pseudocode Tab */}
                  {activeTab === 'pseudocode' && (
                    <div className="bg-gray-900 rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <span className="text-gray-400 text-sm ml-2">pseudocode</span>
                      </div>
                      <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                        {generatedContent.pseudocode}
                      </pre>
                    </div>
                  )}

                  {/* Flowchart Tab */}
                  {activeTab === 'flowchart' && (
                    <div className="bg-white rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                        <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-1.5 rounded-lg">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                        </span>
                        Flowchart Description
                      </h3>
                      <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap text-center leading-relaxed">
                        {generatedContent.flowchart}
                      </pre>
                    </div>
                  )}

                  {/* Approach Tab - Smart Cards */}
                  {activeTab === 'approach' && (
                    <ApproachCards approachText={generatedContent.approach} />
                  )}

                  {/* Complexity Tab - Rich UI */}
                  {activeTab === 'complexity' && (
                    <div className="space-y-4">
                      {/* Performance Analysis Card */}
                      <div className="bg-white rounded-xl p-6">
                          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-1.5 rounded-lg">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </span>
                            Performance Analysis
                          </h3>
                          
                          {/* Complexity Cards */}
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-50 rounded-xl p-5 text-center">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">TIME COMPLEXITY</p>
                              <p className="text-4xl font-bold text-green-600 my-3">O(1)</p>
                              <p className="text-xs text-gray-500 mb-3">Execution Time Growth</p>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full w-1/4 bg-gradient-to-r from-green-400 to-green-500 rounded-full" />
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-5 text-center">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">SPACE COMPLEXITY</p>
                              <p className="text-4xl font-bold text-green-600 my-3">O(1)</p>
                              <p className="text-xs text-gray-500 mb-3">Memory Usage Growth</p>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full w-1/4 bg-gradient-to-r from-green-400 to-teal-500 rounded-full" />
                              </div>
                            </div>
                          </div>

                          {/* Complexity Description */}
                          <div className="text-sm text-gray-700 space-y-2 mb-6">
                            {generatedContent.complexity.split('\n').filter(line => line.trim() && !line.includes('─') && !line.includes('│')).slice(0, 4).map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                      </div>

                      {/* Key Insight - Complexity Comparison */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-600 flex items-center gap-2 mb-2">
                          <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4 text-yellow-500" />
                          Key Insight
                        </h4>
                        <p className="text-sm text-gray-800 font-semibold">Complexity Comparison:</p>
                      </div>

                      {/* Comparison Table */}
                      <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-100 text-gray-700">
                              <th className="px-6 py-4 text-left text-sm font-semibold">Approach</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold">Time Complexity</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold">Space Complexity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            <tr className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-700">Looping Method</td>
                              <td className="px-6 py-4 text-sm text-gray-700 font-mono">O(n)</td>
                              <td className="px-6 py-4 text-sm text-gray-700 font-mono">O(1)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Key Insight - Performance Analysis */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-600 flex items-center gap-2 mb-2">
                          <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4 text-yellow-500" />
                          Key Insight
                        </h4>
                        <p className="text-sm text-gray-800 font-semibold">Performance Analysis:</p>
                      </div>

                      {/* Performance Description */}
                      <div className="text-sm text-gray-700 leading-relaxed px-2">
                        <p>The performance of the operation is optimal as it runs in constant time. However, if extended to handle multiple operations, the time complexity would increase linearly with the number of operations.</p>
                      </div>

                      {/* Key Insight - Practical Considerations */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-600 flex items-center gap-2 mb-2">
                          <FontAwesomeIcon icon={faLightbulb} className="w-4 h-4 text-yellow-500" />
                          Key Insight
                        </h4>
                        <p className="text-sm text-gray-800 font-semibold">Practical Considerations:</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Bar */}
                <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 text-center">
                  <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Status: Analysis complete - Interactive dashboard ready!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogicBuilder;