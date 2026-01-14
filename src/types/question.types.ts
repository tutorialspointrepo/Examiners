// ============================================
// UNIFIED QUESTION TYPES & INTERFACES
// Central type definitions for question data across the entire application
// Use these interfaces everywhere: Question Bank, Exams, Reports, Evaluation, etc.
// ============================================

import { Timestamp } from 'firebase/firestore';

// Import existing constants instead of duplicating
import {
  QUESTION_TYPES,
  COMPLEXITY_LEVELS,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  type ComplexityLevel
} from '../constants';

// ============================================
// QUESTION TYPE ICONS (Add to constants.ts)
// ============================================

/**
 * Question type icons for display
 * TODO: Move this to constants.ts as QUESTION_TYPE_ICONS
 */
export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  [QUESTION_TYPES.MCQ]: '📝',
  [QUESTION_TYPES.FITB]: '✍️',
  [QUESTION_TYPES.JUMBLED]: '🔀',
  [QUESTION_TYPES.DESCRIPTIVE]: '📄',
  [QUESTION_TYPES.CODE]: '💻'
};

/**
 * Complexity level icons for display
 */
export const COMPLEXITY_ICONS: Record<ComplexityLevel, string> = {
  [COMPLEXITY_LEVELS.EASY]: '😊',
  [COMPLEXITY_LEVELS.MEDIUM]: '🤔',
  [COMPLEXITY_LEVELS.HARD]: '😰'
};

/**
 * Complexity level colors for UI
 */
export const COMPLEXITY_COLORS: Record<ComplexityLevel, string> = {
  [COMPLEXITY_LEVELS.EASY]: 'green',
  [COMPLEXITY_LEVELS.MEDIUM]: 'yellow',
  [COMPLEXITY_LEVELS.HARD]: 'red'
};

// ============================================
// CORE QUESTION INTERFACES
// ============================================

/**
 * Base question fields common to all question types
 * This is the foundation - every question has these fields
 */
export interface BaseQuestion {
  // Identity
  questionId?: string; // Optional for creation, required after save
  
  // Content
  questionText: string; // HTML content
  imageUrls?: string[]; // Array of image URLs (max 5)
  
  // Classification
  type: QuestionType;
  subject: string;
  subjectCode?: string;
  class: string; // e.g., "MCA-1", "10th"
  board?: string; // e.g., "CBSE", "State Board"
  chapter?: string; // Required in most cases
  year?: string; // Academic year or question year
  
  // Evaluation
  marks: number; // Maximum marks for the question
  complexity: ComplexityLevel; // easy, medium, hard
  
  // Educational Support
  hint?: string;
  solution?: string; // HTML content for descriptive/MCQ, code for programming
  
  // Organization
  isProprietaryQuestion: boolean; // true = private, false = public/common
  collegeId: string; // College that owns the question
  collegeName: string;
  
  // Metadata
  createdBy: string; // User ID
  createdByName: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  
  // Tags for search/filtering
  tags?: string[];
}

/**
 * MCQ-specific fields
 */
export interface MCQFields {
  options: string[]; // Array of option strings
  correctAnswers: string[]; // Array of correct answer strings (not indices!)
}

/**
 * Fill in the Blanks specific fields
 */
export interface FITBFields {
  correctAnswers: string[]; // Array of acceptable answers (one per blank)
  // For multiple acceptable answers per blank, use pipe-separated: ["answer1|answer2", "answer3"]
}

/**
 * Jumbled/Sequence specific fields
 */
export interface JumbledFields {
  correctAnswers: string[]; // Correct sequence
  jumbledItems: string[]; // Shuffled items for display
}

/**
 * Descriptive/Long answer specific fields
 */
export interface DescriptiveFields {
  // No specific fields - evaluated manually
  // Can have hint and solution from BaseQuestion
  correctAnswers?: string[]; // Optional model answers for reference
}

/**
 * Code/Programming specific fields
 */
export interface CodeFields {
  programmingLanguage: string; // e.g., "Python", "Java", "C++"
  testCases: TestCase[]; // Array of test cases
  testStub?: string; // Starter code for students
}

/**
 * Test case structure for code questions
 */
export interface TestCase {
  input: string;
  expected_output: string;
  marks?: number; // Marks for this specific test case
  isHidden?: boolean; // Hidden test cases not shown to students
}

// ============================================
// UNIFIED QUESTION TYPE (Main Interface)
// ============================================

/**
 * Complete question object - use this everywhere!
 * Includes all possible fields (base + type-specific)
 * Fields are optional based on question type
 */
export interface Question extends BaseQuestion {
  // MCQ-specific (only for MCQ questions)
  options?: string[];
  correctAnswers?: string[];
  
  // FITB-specific (only for FITB questions)
  // Uses correctAnswers from MCQ
  
  // Jumbled-specific (only for jumbled questions)
  jumbledItems?: string[];
  
  // Code-specific (only for code questions)
  programmingLanguage?: string;
  testCases?: TestCase[];
  testStub?: string;
}

// ============================================
// TYPE-SPECIFIC QUESTION TYPES
// ============================================

/**
 * MCQ Question (with required MCQ fields)
 */
export type MCQQuestion = BaseQuestion & Required<MCQFields> & {
  type: typeof QUESTION_TYPES.MCQ;
};

/**
 * Fill in the Blanks Question (with required FITB fields)
 */
export type FITBQuestion = BaseQuestion & Required<FITBFields> & {
  type: typeof QUESTION_TYPES.FITB;
};

/**
 * Jumbled/Sequence Question (with required jumbled fields)
 */
export type JumbledQuestion = BaseQuestion & Required<JumbledFields> & {
  type: typeof QUESTION_TYPES.JUMBLED;
};

/**
 * Descriptive Question (with optional descriptive fields)
 */
export type DescriptiveQuestion = BaseQuestion & DescriptiveFields & {
  type: typeof QUESTION_TYPES.DESCRIPTIVE;
};

/**
 * Code/Programming Question (with required code fields)
 */
export type CodeQuestion = BaseQuestion & Required<CodeFields> & {
  type: typeof QUESTION_TYPES.CODE;
};

// ============================================
// QUESTION CREATION INTERFACES
// ============================================

/**
 * Input data for creating a new question (from UI)
 * Used by both manual and bulk creation
 * Uses snake_case to match UI field names
 */
export interface CreateQuestionInput {
  // Required fields
  question_text: string;
  subject: string;
  class: string;
  type: QuestionType;
  maximum_marks: number;
  difficulty_level: ComplexityLevel;
  
  // Optional base fields
  board?: string;
  chapter?: string;
  year?: string;
  hint?: string;
  solution?: string;
  question_image_urls?: string[];
  
  // Organization
  is_public: boolean; // true = public, false = private
  college_id: string;
  college_name: string;
  created_by: string;
  created_by_name: string;
  
  // MCQ-specific (required if type is MCQ)
  options?: string[];
  correct_answers?: string[];
  
  // FITB-specific (required if type is FITB)
  // Uses correct_answers
  
  // Jumbled-specific (required if type is JUMBLED)
  // Uses correct_answers for correct sequence
  // jumbledItems auto-generated if not provided
  
  // Code-specific (required if type is CODE)
  programming_language?: string;
  test_cases?: TestCase[];
  test_stub?: string;
}

/**
 * Result after creating a question
 */
export interface CreateQuestionResult {
  success: boolean;
  questionId?: string;
  error?: string;
}

/**
 * Input data for updating a question
 */
export interface UpdateQuestionInput {
  questionId: string;
  question_text?: string;
  subject?: string;
  class?: string;
  board?: string;
  chapter?: string;
  year?: string;
  type?: QuestionType;
  maximum_marks?: number;
  difficulty_level?: ComplexityLevel;
  hint?: string;
  solution?: string;
  question_image_urls?: string[];
  is_public?: boolean;
  
  // Type-specific fields
  options?: string[];
  correct_answers?: string[];
  jumbledItems?: string[];
  programming_language?: string;
  test_cases?: TestCase[];
  test_stub?: string;
}

// ============================================
// QUESTION QUERY/FILTER INTERFACES
// ============================================

/**
 * Filter options for querying questions
 */
export interface QuestionQueryFilter {
  collegeId?: string;
  type?: QuestionType | QuestionType[];
  subject?: string | string[];
  class?: string | string[];
  board?: string | string[];
  chapter?: string | string[];
  complexity?: ComplexityLevel | ComplexityLevel[];
  year?: string | string[];
  isProprietaryQuestion?: boolean;
  createdBy?: string;
  tags?: string[];
  searchText?: string; // For question text search
  marksRange?: { min: number; max: number };
}

/**
 * Sorting options for question queries
 */
export interface QuestionQuerySort {
  field: 'createdAt' | 'marks' | 'complexity' | 'questionText';
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface QuestionQueryPagination {
  limit: number;
  offset?: number;
  lastDoc?: any; // For cursor-based pagination
}

/**
 * Complete query options
 */
export interface QuestionQueryOptions {
  filter?: QuestionQueryFilter;
  sort?: QuestionQuerySort;
  pagination?: QuestionQueryPagination;
}

// ============================================
// QUESTION DISPLAY/UI INTERFACES
// ============================================

/**
 * Simplified question info for display in lists/exam builders
 */
export interface QuestionListItem {
  questionId: string;
  questionText: string; // Truncated if needed
  type: QuestionType;
  subject: string;
  class: string;
  chapter?: string;
  marks: number;
  complexity: ComplexityLevel;
  isProprietaryQuestion: boolean;
}

/**
 * Question preview (for exam builders/question bank)
 */
export interface QuestionPreview extends Question {
  // Additional computed fields for UI
  displayType: string; // User-friendly type name
  typeIcon: string; // Emoji for type
  complexityIcon: string; // Emoji for complexity
  complexityColor: string; // Color for complexity badge
  truncatedText: string; // First 100 chars of question
  hasImages: boolean;
  hasHint: boolean;
  hasSolution: boolean;
  isPublic: boolean; // Inverse of isProprietaryQuestion
}

/**
 * Question statistics (for dashboards)
 */
export interface QuestionStatistics {
  totalQuestions: number;
  byType: Record<QuestionType, number>;
  byComplexity: Record<ComplexityLevel, number>;
  bySubject: Record<string, number>;
  byClass: Record<string, number>;
  publicQuestions: number;
  privateQuestions: number;
  questionsWithImages: number;
  questionsWithHints: number;
  questionsWithSolutions: number;
  averageMarks: number;
}

// ============================================
// EXAM-RELATED INTERFACES
// ============================================

/**
 * Question in exam context
 */
export interface ExamQuestion extends Question {
  questionNumber: number; // Position in exam
  sectionName?: string; // Section it belongs to
  isAttempted?: boolean; // For student view
  studentAnswer?: any; // Student's answer
  marksObtained?: number; // After evaluation
  isCorrect?: boolean; // Auto-evaluated questions
}

/**
 * Question selection criteria for exam creation
 */
export interface QuestionSelectionCriteria {
  subject: string;
  class: string;
  chapter?: string;
  type?: QuestionType[];
  complexity?: ComplexityLevel[];
  marksPerQuestion?: number;
  count: number; // Number of questions to select
  randomize?: boolean;
  excludeQuestionIds?: string[]; // Already selected questions
}

// ============================================
// BULK IMPORT/EXPORT INTERFACES
// ============================================

/**
 * Excel row format for bulk question import
 */
export interface BulkQuestionImportRow {
  // Excel column names (snake_case to match template)
  board?: string;
  is_public?: string | boolean;
  class: string;
  subject: string;
  chapter?: string;
  type: string;
  programming_language?: string;
  question_text: string;
  question_image_urls?: string; // Pipe-separated URLs
  options?: string; // Pipe-separated
  correct_answers?: string; // Pipe-separated
  maximum_marks: number | string;
  difficulty_level: string;
  hint?: string;
  solution?: string;
  test_cases?: string; // JSON string
  test_stub?: string;
}

/**
 * Result of bulk import operation
 */
export interface BulkImportResult {
  success: number;
  failed: number;
  errors: BulkImportError[];
  createdQuestionIds: string[]; // Question IDs
}

/**
 * Error during bulk import
 */
export interface BulkImportError {
  row: number;
  data: BulkQuestionImportRow;
  error: string;
}

/**
 * Excel export format
 */
export interface QuestionExportRow {
  question_id: string;
  board: string;
  is_public: string;
  class: string;
  subject: string;
  chapter: string;
  type: string;
  question_text: string;
  options: string; // Pipe-separated
  correct_answers: string; // Pipe-separated
  maximum_marks: number;
  difficulty_level: string;
  hint: string;
  solution: string;
  programming_language: string;
  test_cases: string; // JSON string
  created_by: string;
  created_at: string;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if question is MCQ
 */
export function isMCQQuestion(question: Question): question is MCQQuestion {
  return question.type === QUESTION_TYPES.MCQ && 
         !!question.options && 
         !!question.correctAnswers;
}

/**
 * Check if question is FITB
 */
export function isFITBQuestion(question: Question): question is FITBQuestion {
  return question.type === QUESTION_TYPES.FITB && 
         !!question.correctAnswers;
}

/**
 * Check if question is Jumbled
 */
export function isJumbledQuestion(question: Question): question is JumbledQuestion {
  return question.type === QUESTION_TYPES.JUMBLED && 
         !!question.correctAnswers && 
         !!question.jumbledItems;
}

/**
 * Check if question is Descriptive
 */
export function isDescriptiveQuestion(question: Question): question is DescriptiveQuestion {
  return question.type === QUESTION_TYPES.DESCRIPTIVE;
}

/**
 * Check if question is Code
 */
export function isCodeQuestion(question: Question): question is CodeQuestion {
  return question.type === QUESTION_TYPES.CODE && 
         !!question.programmingLanguage;
}

/**
 * Check if question can be auto-evaluated
 */
export function isAutoEvaluable(question: Question): boolean {
  return question.type === QUESTION_TYPES.MCQ || 
         question.type === QUESTION_TYPES.FITB || 
         question.type === QUESTION_TYPES.JUMBLED ||
         question.type === QUESTION_TYPES.CODE;
}

/**
 * Check if question requires manual evaluation
 */
export function requiresManualEvaluation(question: Question): boolean {
  return question.type === QUESTION_TYPES.DESCRIPTIVE;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert Question to QuestionPreview (with computed fields)
 */
export function toQuestionPreview(question: Question): QuestionPreview {
  // Strip HTML tags for truncated text
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
  const plainText = stripHtml(question.questionText);
  
  return {
    ...question,
    displayType: QUESTION_TYPE_LABELS[question.type],
    typeIcon: QUESTION_TYPE_ICONS[question.type],
    complexityIcon: COMPLEXITY_ICONS[question.complexity],
    complexityColor: COMPLEXITY_COLORS[question.complexity],
    truncatedText: plainText.substring(0, 100) + (plainText.length > 100 ? '...' : ''),
    hasImages: !!(question.imageUrls && question.imageUrls.length > 0),
    hasHint: !!question.hint,
    hasSolution: !!question.solution,
    isPublic: !question.isProprietaryQuestion
  };
}

/**
 * Convert Question to QuestionListItem (for dropdowns/lists)
 */
export function toQuestionListItem(question: Question): QuestionListItem {
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
  const plainText = stripHtml(question.questionText);
  
  return {
    questionId: question.questionId || '',
    questionText: plainText.substring(0, 150) + (plainText.length > 150 ? '...' : ''),
    type: question.type,
    subject: question.subject,
    class: question.class,
    chapter: question.chapter,
    marks: question.marks,
    complexity: question.complexity,
    isProprietaryQuestion: question.isProprietaryQuestion
  };
}

/**
 * Convert CreateQuestionInput to Question format (for Firebase)
 * This is the main transformation function that both manual and bulk should use
 */
export function createQuestionInputToQuestion(input: CreateQuestionInput): Omit<Question, 'questionId' | 'createdAt' | 'updatedAt'> {
  // Get current year for academic year if not provided
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${(currentYear + 1) % 100}`;
  
  // Base question data
  const baseQuestion: any = {
    questionText: input.question_text,
    imageUrls: input.question_image_urls || [],
    type: input.type,
    subject: input.subject,
    class: input.class,
    board: input.board || '',
    chapter: input.chapter || '',
    year: input.year || academicYear,
    marks: input.maximum_marks,
    complexity: input.difficulty_level,
    hint: input.hint || '',
    solution: input.solution || '',
    isProprietaryQuestion: !input.is_public,
    collegeId: input.college_id,
    collegeName: input.college_name,
    createdBy: input.created_by,
    createdByName: input.created_by_name,
    tags: []
  };
  
  // Add type-specific fields
  if (input.type === QUESTION_TYPES.MCQ) {
    if (!input.options || input.options.length < 2) {
      throw new Error('MCQ questions must have at least 2 options');
    }
    if (!input.correct_answers || input.correct_answers.length === 0) {
      throw new Error('MCQ questions must have at least 1 correct answer');
    }
    baseQuestion.options = input.options;
    baseQuestion.correctAnswers = input.correct_answers;
  } 
  else if (input.type === QUESTION_TYPES.FITB) {
    if (!input.correct_answers || input.correct_answers.length === 0) {
      throw new Error('FITB questions must have at least 1 correct answer');
    }
    baseQuestion.correctAnswers = input.correct_answers;
  }
  else if (input.type === QUESTION_TYPES.JUMBLED) {
    if (!input.correct_answers || input.correct_answers.length === 0) {
      throw new Error('Jumbled questions must have correct answers');
    }
    baseQuestion.correctAnswers = input.correct_answers;
    // Auto-generate jumbled items if not provided
    baseQuestion.jumbledItems = [...input.correct_answers].sort(() => Math.random() - 0.5);
  }
  else if (input.type === QUESTION_TYPES.DESCRIPTIVE) {
    // Descriptive questions don't require specific fields
    baseQuestion.correctAnswers = input.correct_answers || [];
  }
  else if (input.type === QUESTION_TYPES.CODE) {
    baseQuestion.programmingLanguage = input.programming_language || detectLanguageFromSubject(input.subject) || 'Python';
    baseQuestion.testCases = input.test_cases || [];
    baseQuestion.testStub = input.test_stub || '';
  }
  
  return baseQuestion;
}

/**
 * Detect programming language from subject name
 */
export function detectLanguageFromSubject(subject: string): string | null {
  const SUBJECT_TO_LANGUAGE_MAP: { [key: string]: string } = {
    'C Programming': 'C', 'C': 'C',
    'C++ Programming': 'C++', 'C++': 'C++',
    'Java Programming': 'Java', 'Java': 'Java',
    'Python Programming': 'Python', 'Python': 'Python',
    'JavaScript Programming': 'JavaScript', 'JavaScript': 'JavaScript',
    'Ruby Programming': 'Ruby', 'Ruby': 'Ruby',
    'Go Programming': 'Go', 'Go': 'Go',
    'PHP Programming': 'PHP', 'PHP': 'PHP',
    'Rust Programming': 'Rust', 'Rust': 'Rust',
    'Swift Programming': 'Swift', 'Swift': 'Swift',
    'Kotlin Programming': 'Kotlin', 'Kotlin': 'Kotlin',
    'TypeScript Programming': 'TypeScript', 'TypeScript': 'TypeScript',
    'C# Programming': 'C#', 'C#': 'C#',
    'R Programming': 'R', 'R': 'R',
    'SQL Programming': 'SQL', 'SQL': 'SQL',
  };
  
  // Direct match
  if (SUBJECT_TO_LANGUAGE_MAP[subject]) {
    return SUBJECT_TO_LANGUAGE_MAP[subject];
  }
  
  // Try without "Programming" suffix
  const withoutProgramming = subject.replace(/\s+Programming$/i, '').trim();
  if (SUBJECT_TO_LANGUAGE_MAP[withoutProgramming]) {
    return SUBJECT_TO_LANGUAGE_MAP[withoutProgramming];
  }
  
  // Check if subject contains language name
  for (const [key, value] of Object.entries(SUBJECT_TO_LANGUAGE_MAP)) {
    if (subject.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return null;
}

/**
 * Format question for display
 */
export function formatQuestionDisplay(question: Question, maxLength: number = 100): string {
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
  const plainText = stripHtml(question.questionText);
  return plainText.substring(0, maxLength) + (plainText.length > maxLength ? '...' : '');
}

/**
 * Validate question data completeness
 */
export function validateQuestionData(question: Partial<Question>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required base fields
  if (!question.questionText) errors.push('Question text is required');
  if (!question.type) errors.push('Question type is required');
  if (!question.subject) errors.push('Subject is required');
  if (!question.class) errors.push('Class is required');
  if (!question.marks || question.marks <= 0) errors.push('Valid marks required');
  if (!question.complexity) errors.push('Difficulty level is required');
  if (!question.chapter) errors.push('Chapter is required');
  
  // Type-specific validation
  if (question.type === QUESTION_TYPES.MCQ) {
    if (!question.options || question.options.length < 2) {
      errors.push('MCQ must have at least 2 options');
    }
    if (!question.correctAnswers || question.correctAnswers.length === 0) {
      errors.push('MCQ must have at least 1 correct answer');
    }
  }
  
  if (question.type === QUESTION_TYPES.FITB) {
    if (!question.correctAnswers || question.correctAnswers.length === 0) {
      errors.push('FITB must have at least 1 correct answer');
    }
  }
  
  if (question.type === QUESTION_TYPES.JUMBLED) {
    if (!question.correctAnswers || question.correctAnswers.length < 2) {
      errors.push('Jumbled must have at least 2 items');
    }
  }
  
  if (question.type === QUESTION_TYPES.CODE) {
    if (!question.programmingLanguage) {
      errors.push('Code question must have programming language');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize question data for storage (remove undefined/null)
 */
export function sanitizeQuestionData(data: Partial<Question>): Partial<Question> {
  const sanitized: any = {};
  
  Object.keys(data).forEach(key => {
    const value = (data as any)[key];
    if (value !== undefined && value !== null) {
      // Convert empty strings to undefined for optional fields
      if (typeof value === 'string' && value.trim() === '' && 
          ['hint', 'solution', 'board', 'year', 'testStub'].includes(key)) {
        return; // Skip empty optional string fields
      }
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}

/**
 * Calculate total marks for a set of questions
 */
export function calculateTotalMarks(questions: Question[]): number {
  return questions.reduce((total, q) => total + q.marks, 0);
}

/**
 * Group questions by subject
 */
export function groupQuestionsBySubject(questions: Question[]): Record<string, Question[]> {
  return questions.reduce((acc, question) => {
    if (!acc[question.subject]) {
      acc[question.subject] = [];
    }
    acc[question.subject].push(question);
    return acc;
  }, {} as Record<string, Question[]>);
}

/**
 * Group questions by complexity
 */
export function groupQuestionsByComplexity(questions: Question[]): Record<ComplexityLevel, Question[]> {
  const grouped: any = {
    [COMPLEXITY_LEVELS.EASY]: [],
    [COMPLEXITY_LEVELS.MEDIUM]: [],
    [COMPLEXITY_LEVELS.HARD]: []
  };
  
  questions.forEach(q => grouped[q.complexity].push(q));
  return grouped;
}

/**
 * Filter questions by criteria
 */
export function filterQuestions(
  questions: Question[],
  criteria: Partial<QuestionQueryFilter>
): Question[] {
  return questions.filter(q => {
    if (criteria.type && (Array.isArray(criteria.type) ? !criteria.type.includes(q.type) : q.type !== criteria.type)) {
      return false;
    }
    if (criteria.subject && (Array.isArray(criteria.subject) ? !criteria.subject.includes(q.subject) : q.subject !== criteria.subject)) {
      return false;
    }
    if (criteria.class && (Array.isArray(criteria.class) ? !criteria.class.includes(q.class) : q.class !== criteria.class)) {
      return false;
    }
    if (criteria.complexity && (Array.isArray(criteria.complexity) ? !criteria.complexity.includes(q.complexity) : q.complexity !== criteria.complexity)) {
      return false;
    }
    if (criteria.isProprietaryQuestion !== undefined && q.isProprietaryQuestion !== criteria.isProprietaryQuestion) {
      return false;
    }
    if (criteria.marksRange) {
      if (q.marks < criteria.marksRange.min || q.marks > criteria.marksRange.max) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Generate question statistics
 */
export function generateQuestionStatistics(questions: Question[]): QuestionStatistics {
  const stats: QuestionStatistics = {
    totalQuestions: questions.length,
    byType: {
      [QUESTION_TYPES.MCQ]: 0,
      [QUESTION_TYPES.FITB]: 0,
      [QUESTION_TYPES.JUMBLED]: 0,
      [QUESTION_TYPES.DESCRIPTIVE]: 0,
      [QUESTION_TYPES.CODE]: 0
    },
    byComplexity: {
      [COMPLEXITY_LEVELS.EASY]: 0,
      [COMPLEXITY_LEVELS.MEDIUM]: 0,
      [COMPLEXITY_LEVELS.HARD]: 0
    },
    bySubject: {},
    byClass: {},
    publicQuestions: 0,
    privateQuestions: 0,
    questionsWithImages: 0,
    questionsWithHints: 0,
    questionsWithSolutions: 0,
    averageMarks: 0
  };
  
  let totalMarks = 0;
  
  questions.forEach(q => {
    // Type
    stats.byType[q.type]++;
    
    // Complexity
    stats.byComplexity[q.complexity]++;
    
    // Subject
    stats.bySubject[q.subject] = (stats.bySubject[q.subject] || 0) + 1;
    
    // Class
    stats.byClass[q.class] = (stats.byClass[q.class] || 0) + 1;
    
    // Public/Private
    if (q.isProprietaryQuestion) {
      stats.privateQuestions++;
    } else {
      stats.publicQuestions++;
    }
    
    // Features
    if (q.imageUrls && q.imageUrls.length > 0) stats.questionsWithImages++;
    if (q.hint) stats.questionsWithHints++;
    if (q.solution) stats.questionsWithSolutions++;
    
    // Marks
    totalMarks += q.marks;
  });
  
  stats.averageMarks = questions.length > 0 ? totalMarks / questions.length : 0;
  
  return stats;
}

// ============================================
// CONSTANTS FOR VALIDATION
// ============================================

export const QUESTION_VALIDATION_RULES = {
  QUESTION_TEXT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 10000
  },
  MARKS: {
    MIN: 0.5,
    MAX: 100
  },
  OPTIONS: {
    MIN_COUNT: 2,
    MAX_COUNT: 10,
    MIN_LENGTH: 1,
    MAX_LENGTH: 500
  },
  IMAGE_URLS: {
    MAX_COUNT: 5,
    ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  },
  TEST_CASES: {
    MIN_COUNT: 1,
    MAX_COUNT: 20
  }
};

// ============================================
// RE-EXPORT CONSTANTS FROM constants.ts
// ============================================

export {
  QUESTION_TYPES,
  COMPLEXITY_LEVELS,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  type ComplexityLevel
};

// ============================================
// EXPORT ALL
// ============================================