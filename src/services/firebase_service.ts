// firebase_service.ts
// Comprehensive Firebase service for EXAMINERS React Web Application
import { getFunctions, httpsCallable, type Functions  } from 'firebase/functions';

import { 
  initializeApp, 
  type FirebaseApp 
} from 'firebase/app';

import { 
  getAuth, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  type User,
  type UserCredential,
  type Auth
} from 'firebase/auth';

import { 
  getFirestore, 
  collection, 
  doc,
  addDoc, 
  getDoc, 
  getDocs,
  getDocsFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  serverTimestamp,
  increment,
  arrayUnion,
  onSnapshot,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
  type DocumentData
} from 'firebase/firestore';

import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  type FirebaseStorage 
} from 'firebase/storage';

// Import application constants
import {
  QUESTION_TYPES,
  USER_TYPES,
  USER_STATUS,
  ATTEMPT_STATUS,
  EVALUATION_STATUS,
  COMPLEXITY_LEVELS,
  COLLECTIONS,
  DEFAULT_COLLEGE_ID,
  FILTER_VALUES,
  EXAM_MODES,
  NOTIFICATION_STATUS,
  ACTIVITY_TYPES,
  ATTENDANCE_STATUS,
  CONNECTION_STATUS,
  VIOLATION_TYPES,
  type QuestionType,
  type UserType,
  type UserStatus,
  type AttemptStatus,
  type EvaluationStatus,
  type ExamStatus,
  type ComplexityLevel,
  type ExamMode,
  type ConnectionType,
  type PriorityLevel,
  type SeverityLevel,
  type NotificationStatus,
  type TargetAudience,
  type CodeExecutionStatus,
  type PermissionLevel,
  type NotificationType,
  type NotificationCategory,
  type ActivityType,
  type AttendanceStatus,
  type ConnectionStatus,
  type SecurityLevel,
} from '../constants';

// Import unified question types
import type {
  CreateQuestionInput,
  CreateQuestionResult,
} from '../types/question.types';

// Transformation helper functions (inline definitions since types file is missing)
function createQuestionInputToQuestion(input: CreateQuestionInput): Partial<QuestionBankItem> {
  return {
    questionText: input.question_text,
    subject: input.subject,
    subjectCode: (input as any).subject_code,
    class: input.class,
    board: input.board,
    year: input.year,
    type: input.type,
    complexity: input.difficulty_level,
    marks: input.maximum_marks,
    chapter: input.chapter,
    hint: input.hint,
    solution: input.solution,
    imageUrls: input.question_image_urls,
    tags: (input as any).tags || [], // ✅ CRITICAL: Include tags!
    
    // Organization
    isProprietaryQuestion: !input.is_public,
    collegeId: input.college_id,
    collegeName: input.college_name,
    createdBy: input.created_by,
    createdByName: input.created_by_name,
    
    // Type-specific fields
    options: input.options,
    correctAnswers: input.correct_answers,
    jumbledItems: input.correct_answers, // For jumbled questions
    programmingLanguage: input.programming_language,
    testCases: input.test_cases,
    testStub: input.test_stub,
  };
}

function validateQuestionData(questionData: Partial<QuestionBankItem>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!questionData.questionText) errors.push('Question text is required');
  if (!questionData.subject) errors.push('Subject is required');
  if (!questionData.class) errors.push('Class is required');
  if (!questionData.type) errors.push('Question type is required');
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ==================== TYPE DEFINITIONS ====================

/**
 * Leaderboard data interface
 */
export interface LeaderboardStudent {
  userId: string;
  userName: string;
  rollNumber?: string;
  collegeId: string;
  class: string;
  board: string;
  academicYear: string;
  subject?: string;
  totalExams: number;
  totalMarks: number;
  totalMaxMarks: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  rank: number;
  lastExamDate?: Date;
}


// Type definitions to add to your firebase_service.ts
export interface DetailedExamAttempt {
  attemptId: string;
  studentId: string;
  examId: string;
  
  // Score
  percentage: number;
  obtainedMarks: number;
  totalScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unattemptedQuestions: number;
  totalQuestions: number;
  attemptedQuestions: number;
  
  // Session
  enterIPAddress: string;
  exitIPAddress: string;
  ipAddress: string;
  
  // System
  browser: string;
  operatingSystem: string;
  deviceType: string;
  
  // Violations
  violationCount: number;
  violations: any[];
  tabSwitchCount: number;
  totalEntries: number;
  
  // Timing
  startTime: any;
  submitTime: any;
  timeSpent: number;
  totalTimeSpent: number;
  
  // Status
  status: string;
  
  // Question-level
  answers: QuestionAnswer[];
  questionResponses: QuestionAnswer[];
  
  // Metadata
  submittedAt: any;
  lastUpdated: any;
}

interface QuestionAnswer {
  questionId: string;
  answer: any;
  isCorrect: boolean;
  obtainedMarks: number;
  maximumMarks: number;
  timeSpent: number;
  revisitCount: number;
  attemptCount: number;
  markedForReview?: boolean;
  answeredAt?: any;
}

interface QuestionDetail {
  id: string;
  questionId: string;
  type: string;
  questionText: string;
  maximumMarks: number;
  difficulty: string;
  difficultyLevel: string;
  chapter: string;
  subject: string;
  options?: string[];
  correctAnswers?: string[];
  order: number;
}

export interface ExamWithQuestions {
  examId: string;
  id: string;
  name: string;
  title: string;
  class: string;
  subject: string;
  board: string;
  year: string;
  duration: number;
  totalMarks: number;
  totalQuestions: number;
  passingMarks: number;
  questionsList: QuestionDetail[];
  createdAt: any;
  status: string;
}
interface ExamDashboardData {
  exam: {
    examId: string;
    name: string;
    subject: string;
    class: string;
    duration: number;
    totalMarks: number;
    passingMarks: number;
    totalQuestions: number;
    startDate: Date;
    endDate: Date;
  };
  presentStudents: DashboardStudent[];
  absentStudents: DashboardStudent[];
  totalStudents: number;
  attempts: StudentExamAttempt[];
}

interface DashboardStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  rollNumber: string;
  class: string;
  hasAttempt: boolean;
  attemptData?: {
    attemptId: string;
    percentage: number;
    obtainedMarks: number;
    totalScore: number;
    violationCount: number;
    status: AttemptStatus;
    startTime: Date;
    submitTime?: Date;
    timeSpent?: number;
    correctAnswers: number;
    attemptedQuestions: number;
    totalQuestions: number;
  };
}

export interface ExamAttendanceData {
  examId: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number;
  presentStudents: Array<{
    studentId: string;
    studentName: string;
    rollNumber: string;
  }>;
  absentStudents: Array<{
    studentId: string;
    studentName: string;
    rollNumber: string;
  }>;
}

interface ExamPerformanceMetrics {
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  passCount: number;
  failCount: number;
  distribution: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
}

interface ExamViolationStats {
  totalViolations: number;
  studentsWithViolations: number;
  cleanExams: number;
  averageViolationsPerStudent: number;
} 

interface AIEvaluationFeedback {
  // Core evaluation
  suggestedMarks: number;
  maxMarks: number;
  confidenceScore: number;
  
  // ✅ Merged feedback (new structure)
  correctPoints?: string[];
  improvements?: string[];
  
  // ✅ Granular scores (0-100 scale)
  answerLength: number;           // Character/word count
  answerLengthScore: number;      // 0-100: Is length appropriate?
  relevancyScore: number;         // 0-100: How relevant to question?
  accuracyScore: number;          // 0-100: How accurate are facts?
  completenessScore: number;      // 0-100: How complete is answer?
  
  // ✅ Plagiarism detection
  plagiarismScore?: number;       // 0-100: Likelihood of plagiarism
  isPlagiarized?: boolean;        // Flag if score > 50
  plagiarismIndicators?: string[]; // Reasons if flagged
}

interface CodeEvaluationFeedback {
  // Test execution results
  testsPassed: number;
  testsTotal: number;
  allTestsPassed: boolean;
  severityLevel: 'success' | 'partial' | 'critical';
  
  // Code quality scores (0-100)
  codeQuality: number;
  readabilityScore: number;
  efficiencyScore: number;
  correctnessScore: number;
  
  // Complexity analysis
  timeComplexity: string;
  spaceComplexity: string;
  
  // Unified feedback
  correctPoints: string[];
  improvements: string[];
  
  // Failed test specific analysis
  failedTestAnalysis: Array<{
    testNumber: number;
    issue: string;
    fix: string;
  }>;
  
  // Code suggestions
  hasSuggestedCode: boolean;
  suggestedCode: string;
  codeExplanation: string;
}
// Export for use in components
export type { AIEvaluationFeedback, CodeEvaluationFeedback };

export interface StudentExamAttempt {
  attemptId: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  rollNumber: string;
  class: string;
  board: string;
  examTitle: string;
  subject: string;
  academicYear: string;
  examType: string;
  collegeId: string;
  collegeName: string;
  mode: ExamMode;
  maximumScore: number;
  duration: number;
  startTime: Date;
  submitTime?: Date;
  timeSpent?: number;
  status: AttemptStatus;
  isLocked: boolean;
  totalScore: number;
  obtainedMarks: number;
  percentage: number;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  aiEvaluated: boolean;
  manualReviewRequired: boolean;
  evaluationStatus: EvaluationStatus;
  pendingEvaluations: number;
  responses: StudentQuestionResponse[];
  violations?: any[];
  violationCount?: number;  // ✅ ADDED: Total count of violations
  activities?: any[];
  deviceInfo?: {
    userAgent: string;
    platform: string;
    screenResolution: string;
    ipAddress: string;
  };
  createdAt: Date;
  updatedAt: Date;
  violationSummary?: {
    total: number;
    critical: number;
    moderate: number;
    minor: number;
  };
  performanceByType?: Record<string, { score: number; maxScore: number; attempted: number }>;
  performanceByChapter?: Record<string, { score: number; maxScore: number; attempted: number }>;
  actualDuration?: number;
  scheduledDuration?: number;
  performanceByComplexity?: Record<string, { score: number; maxScore: number; attempted: number }>;
}

export interface StudentQuestionResponse {
  responseId: string;
  attemptId: string;
  questionId: string;
  questionNo: number;
  questionType: QuestionType;
  maxMarks: number;
  complexity: ComplexityLevel;
  chapter?: string;
  studentAnswer: string | string[];
  answerText?: string;
  imageUrl?: string;
  ocrText?: string;
  codeSubmitted?: string;
  language?: string;
  timeSpent?: number;
  answeredAt: Date;
  isAnswered: boolean;
  markedForReview: boolean;
  isSkipped: boolean;
  evaluationStatus: EvaluationStatus;
  scoredMarks: number;
  marksAwarded?: number;
  isCorrect?: boolean;
  revisitCount?: number;
  feedback?: AIEvaluationFeedback;
  codeAIFeedback?: CodeEvaluationFeedback;
  violations?: ExamViolation[];
  versionCount: number;
  attemptCount?: number;
  questionBankId?: string;
  evaluationRetries?: number;
  lastEvaluationAttempt?: Date;
  evaluationError?: string;
  pool?: boolean;  // Flag to indicate if question is from question pool
  createdAt: Date;
  updatedAt: Date;
}

interface CodeExecutionResult {
  status: CodeExecutionStatus;
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  testCasesPassed: number;
  testCasesFailed: number;
}

export interface PlagiarismResult {
  score: number;
  sources: string[];
  details?: string;
}

interface ExamClassAnalytics {
  analyticsId?: string;
  examId: string;
  collegeId: string;
  class: string;
  totalStudents: number;
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  medianScore: number;
  standardDeviation: number;
  generatedAt: Date;
}


// UserType is now imported from constants.ts

export interface UserPermissions {
  canEvaluate: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canManageColleges: boolean;
  canManageRooms: boolean;
  canManageClasses: boolean;
  canManageSubjects: boolean;
  canManageBoards: boolean;
  canManageExamTypes: boolean;
  canManageSystem: boolean;
  canAccessAllColleges: boolean;
  level: PermissionLevel;
}

// Permission structure aligned with user.types.ts

export interface StudentHistoryEntry {
  academicYear: string;
  className: string;
  rollNumber: string;
  board: string;
  collegeId: string;
}

export interface UserModel {
  userId: string;
  fullName: string;
  title?: string;
  email?: string;
  phone: string;
  phoneRaw: string;
  profilePicture?: string;
  proctoringPhotos?: {
    front: string | null;
    left: string | null;
    right: string | null;
  };
  userType: UserType;
  permissions: UserPermissions;
  status: UserStatus;
  board?: string;
  collegeId: string;
  collegeName?: string;
  createdBy: string;
  createdAt: Date | Timestamp | null;
  updatedAt: Date | Timestamp | null;
  
  // Security fields
  mustChangePassword: boolean;
  firstLogin: boolean;
  passwordChangedAt: Date | Timestamp | null;
  temporaryPassword: boolean;
  accountLocked: boolean;
  failedLoginAttempts: number;
  lastLoginAt: Date | Timestamp | null;
  lastLoginIP?: LoginIPInfo;
  loginHistory?: LoginIPInfo[];
  
  // Student-specific
  studentRoll?: string;
  academicYear?: string;
  studentClass?: string;
  parentPhone?: string;
  studentHistory?: StudentHistoryEntry[];
  
  // Teacher-specific
  teacherClasses?: string[];
  teacherSubjects?: string[];
}

export interface LoginIPInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  org: string;
  asn: string;
  loginTimestamp: Date;
  userAgent: string;
  deviceType: string;
}

export interface InternetStatusEntry {
  id: string;
  examId: string;
  userId: string;
  connectionType: ConnectionType;
  disconnectionTimestamp: Date;
  reconnectionTimestamp?: Date;
  internetUnavailableDuration?: number; // in seconds - duration when internet was unavailable
  status: ConnectionStatus;
  deviceInfo: {
    userAgent: string;
    deviceType: string;
    platform: string;
  };
  networkQuality?: {
    downlink?: number; // Mbps
    effectiveType?: string; // '4g', '3g', etc.
    rtt?: number; // Round trip time in ms
  };
  createdAt: Date;
  updatedAt?: Date;
}

export interface BoardWiseCount {
  totalStudents: number;
  totalTeachers: number;
}

export interface RoleCounts {
  system_admin: number;
  admin: number;
  principal: number;
  dean: number;
  teacher: number;
  student: number;
}

export interface PaginatedUsersResult {
  users: UserModel[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  total: number;
}

export interface CollegeModel {
  collegeId: string;
  collegeName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  establishedYear?: number;
  collegeType: string;
  supportedBoards: string[];
  subjects: string[];
  validClasses: string[];
  examTypes: string[];
  features: string[];
  boardWiseCounts: Record<string, BoardWiseCount>;
  roleCounts: RoleCounts;
  totalTeachers: number;
  totalStudents: number;
  totalRooms: number;
  status: string;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface RoomModel {
  // IDs
  id: string;
  room_id: string;
  college_id: string;
  
  // Basic Information
  room_name: string;
  room_type: string; // classroom, lab, library, etc.
  room_address: string;
  room_capacity: number;
  sitting_matrix: string;
  room_status: string; // available, busy
  
  // Schedule
  room_schedule: Array<{
    start_date_time: string;
    end_date_time: string;
    event: string; // exams, function, meeting, show
    users: string[];
  }>;
  
  // In-charge
  room_incharge: string[]; // Array of user IDs
  
  // Optional
  seats_allotment?: any;
  
  // Metadata
  created_by: string;
  created_date_time: Date;
  updated_date_time: Date;
}

export interface RoomStats {
  room_id: string;
  room_name: string;
  room_type: string;
  room_address: string;
  room_capacity: number;
  sitting_matrix: string;
  room_status: string;
  schedule_count: number;
  room_incharge: string[];
}

export interface NotificationModel {
  id: string;
  title: string;
  message: string;
  sentBy: string;
  sentByName: string;
  sentByRole: string;
  collegeId?: string;
  collegeName?: string;
  createdAt: Date;
  targetUserTypes: string[];
  priority: PriorityLevel;
  type: NotificationType;
}

export interface ExamActivity {
  type: ActivityType;
  timestamp: Date;
  ipAddress?: string;
}

export interface ExamViolation {
  type: string;
  timestamp: Date;
  details?: string;
  severity?: SeverityLevel;
  questionNo: number;     // ✅ ADD: Track which question
  questionId: string;     // ✅ ADD: Track question ID
  proofUrl?: string;
}

export interface ExamActivityLog {
  id?: string;
  examId: string;
  examTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  userType: string;
  entryTime: Date;
  exitTime?: Date;
  ipAddress?: string;
  invigilatorIpAddress?: string;
  ipMatch?: boolean;
  activities: ExamActivity[];
  violations: ExamViolation[];
  questionsAnswered?: Array<{
    questionId: string;
    questionNo: number;
    timestamp: Date;
    updated?: boolean;
  }>;
  totalDuration?: number;
  logoutDuration?: number;
  status: ExamStatus;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    screenResolution: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Question interface - Used both server-side and client-side
 * 
 * 🔒 SECURITY NOTE: When sending to client, certain fields are removed:
 * - correctAnswers (shows the answer!)
 * - solution (shows the explanation!)
 * - expected_output in testCases (shows test case answers!)
 * 
 * Use sanitizeQuestionForClient() before sending to client.
 */
export interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  title?: string;
  maximumMarks: number;
  marks?: number;
  complexity?: string;
  board?: string;
  chapter?: string;  // Chapter field for analytics
  
  // MCQ specific
  options?: string[];
  
  // Jumbled specific
  jumbledOptions?: string[];
  
  // 🔒 SENSITIVE: Not sent to client (removed by sanitizeQuestionForClient)
  correctAnswers?: string[]; // Server-side only for grading
  solution?: string; // Server-side only for grading
  
  // FITB specific (client-side)
  blanksCount?: number; // Number of blanks (sent instead of correctAnswers)
  
  // Code question specific
  programmingLanguage?: string; // Python, Java, C++, C, JavaScript
  programming_language?: string;
  testCases?: Array<{ 
    input: string; 
    expected_output?: string; // 🔒 Removed by sanitizer before sending to client
    marks?: number; 
  }>;
  testStub?: string; // Server-side field name
  boilerplate?: string; // Client-side field name (renamed from testStub)
  
  // Additional fields
  hint?: string; // OK to send - meant to help students
  createdByName?: string;
  createdAt?: string;
  isProprietaryQuestion?: boolean;
  source?: 'questionBank' | 'custom';
  questionBankId?: string;
  questionNo?: number;
  
  // Image URLs
  imageUrls?: string[];
  
  // Pool flag
  fromPool?: boolean; // Indicates if question is from random pool
}
export interface ExamModel {
  id: string;
  type: string;
  typeColor: string;
  year: string;
  class: string;
  subject: string;
  title: string;
  board: string;
  status: ExamStatus;
  mode: ExamMode;
  securityLevel?: SecurityLevel;
  attendance?: boolean;
  avProctoring?: boolean;
  examDate: string;
  examTime?: string;
  duration: string;
  totalQuestions: number;
  maxMarks: string;
  totalStudents?: number;
  questionPaperImages?: string[];
  questionsList?: Question[];
  completionPolicy?: 'strict' | 'flexible'; 
  // Question Pool for random selection
  questionPool?: Question[]; // Array of questions for random selection
  pickRandomCount?: number; // Number of questions to randomly pick per student
  poolQuestionMarks?: number; // Marks per question in the pool
  // Storage reference for large question lists
  questionsStoragePath?: string; // Path to questions JSON in Storage
  questionsStorageUrl?: string; // Download URL for questions JSON
  collegeId: string;
  collegeName: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  updatedAt: Date;
}

export interface NoticeModel {
  id: string;
  title: string;
  content: string;
  priority: PriorityLevel;
  category: NotificationCategory;
  targetAudience: TargetAudience | string; // string for specific class
  expiryDate?: string; // ISO date string
  status: NotificationStatus;
  collegeId: string;
  collegeName: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  updatedAt: Date;
  readBy: string[]; // Array of user IDs who have read this notice
  views: number; // Count of total views
}

export interface AttendanceRecord {
  id: string;
  examId: string;
  studentId: string;
  userId: string; 
  studentName: string;
  studentRollNumber: string;
  examinerId: string;
  examinerName: string;
  examinerRole: string;
  status: AttendanceStatus;
  markedAt: Date;
  updatedAt: Date;
  collegeId: string;
}

export interface LoginResult {
  success: boolean;
  user?: UserModel;
  requiresPasswordChange?: boolean;
  error?: string;
}

export interface QuestionBankItem {
  id: string;
  questionText: string;
  subject: string;
  subjectCode?: string;
  class: string;
  board: string;
  year: string;
  type: QuestionType;
  complexity: ComplexityLevel;
  marks: number;
  isProprietaryQuestion: boolean;
  collegeId: string;
  collegeName: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  
  // Additional fields from Excel import
  chapter?: string;
  hint?: string;
  solution?: string;
  imageUrls?: string[];
  
  // MCQ specific fields
  options?: string[];
  correctAnswers?: string[];
  
  // Jumbled specific fields
  jumbledItems?: string[];
  
  // Code specific fields
  programmingLanguage?: string;
  testCases?: Array<{ input: string; expected_output: string }>;
  testStub?: string;
}

export interface SubjectQuestionStats {
  subject: string;
  subjectCode?: string;
  class: string;
  board: string;
  totalQuestions: number;
  proprietaryQuestions: number;
  easyQuestions: number;
  mediumQuestions: number;
  hardQuestions: number;
  mcqCount: number;
  fitbCount: number;
  longCount: number;
  jumbledCount: number;
  descriptiveCount: number;
  codeCount: number;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Deeply removes undefined and null values from objects and arrays
 * This ensures Firebase doesn't receive invalid data
 */
function deepCleanObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj
      .map(item => deepCleanObject(item))
      .filter(item => item !== undefined && item !== null);
  }

  // ✅ FIX: Handle Date objects BEFORE checking for plain objects
  if (obj instanceof Date) {
    return obj; // Return Date as-is
  }

  // Handle objects
  if (typeof obj === 'object' && obj !== null) {
    // Preserve Firebase special values (serverTimestamp, increment, etc.)
    if (obj._methodName || obj.constructor?.name === 'FieldValue') {
      return obj;
    }
    
    // ✅ CRITICAL: Fields that should KEEP null values (don't remove)
    const keepNullFields = [
      'evaluatedBy',
      'evaluatedAt', 
      'firstAttemptedAt',
      'studentAnswer',
      'aiFeedback',
      'imageUrl'
    ];
    
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const cleanedValue = deepCleanObject(obj[key]);
        
        // ✅ Keep field if:
        // 1. Value is not undefined AND not null, OR
        // 2. Value is null BUT field is in keepNullFields list
        if (cleanedValue !== undefined && (cleanedValue !== null || keepNullFields.includes(key))) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }

  // Return primitive values as-is
  return obj;
}
// ==================== FIREBASE SERVICE CLASS ====================

class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private firestore: Firestore | null = null;
  private storage: FirebaseStorage | null = null;
  private functions: Functions | null = null;

  private static instance: FirebaseService | null = null;
  
  // GEO API Configuration
  private geoApiKey: string | null = null;
  private geoApiUrl: string = 'https://pro.ip-api.com/json/';
  
  // 🔥 Track attempts being created to prevent duplicates from race conditions
  private creatingAttempts: Map<string, Promise<StudentExamAttempt>> = new Map();
  
// ==================== FIREBASE SERVICE METHODS - COMPLETE ====================
// This file contains ALL methods for AI-powered exam evaluation
// 
// HOW TO USE:
// 1. Open your src/services/firebase_service.ts
// 2. Find your FirebaseService class
// 3. Copy ALL methods from this file
// 4. Paste them INSIDE the FirebaseService class (before the closing brace)
// 

/**
   * Upload proctoring evidence (snapshot or video clip)
   * Returns the download URL
   */
  /**
   * Upload proctoring evidence (snapshot or video/audio clip)
   * Automatically handles file extensions based on violation type.
   */
  async uploadProctoringEvidence(
    examId: string,
    userId: string,
    violationType: string,
    file: Blob
  ): Promise<string | null> {
    try {
      if (!this.storage) throw new Error('Firebase Storage not initialized');

      console.log(`📤 Uploading proctoring evidence for ${violationType}...`);

      const timestamp = Date.now();
      
      // ✅ LOGIC: ALL violations get 10-second video clips for solid proof
      // Video format: .webm (works for all violation types)
      const fileExtension = 'webm';
      const contentType = 'video/webm';
      
      // Path: proctoring_evidence/{examId}/{userId}/{timestamp}_{violation}.{ext}
      const storagePath = `proctoring_evidence/${examId}/${userId}/${timestamp}_${violationType}.${fileExtension}`;
      const storageRef = ref(this.storage, storagePath);

      // Add metadata for easier tracking/lifecycle management
      const metadata = {
        contentType: contentType,
        customMetadata: {
          examId,
          userId,
          violationType,
          uploadedAt: new Date().toISOString(),
          evidenceType: 'video_clip' // All violations now use video clips
        }
      };

      // Upload
      await uploadBytes(storageRef, file, metadata);
      
      // Get URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log(`✅ Evidence uploaded (${fileExtension}):`, downloadURL);
      
      return downloadURL;

    } catch (error) {
      console.error('❌ Error uploading evidence:', error);
      return null;
    }
  }
/**
 * Start a new exam attempt for a student
 * 🔥 RACE CONDITION FIX: Uses in-memory lock to prevent duplicate creation
 */
async startExamAttempt(
  examId: string,
  student: {
    userId: string;
    fullName: string;
    email: string;
    rollNumber: string;
    class: string;
  },
  exam: ExamModel,
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenResolution: string;
    ipAddress: string;
  }
): Promise<StudentExamAttempt> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  // 🔥 FIX: Create unique key for this student + exam combo
  const attemptKey = `${examId}_${student.userId}`;

  // 🔥 FIX: If we're already creating this attempt, wait for it
  if (this.creatingAttempts.has(attemptKey)) {
    console.log('⏳ Attempt creation already in progress, waiting for existing creation...');
    return this.creatingAttempts.get(attemptKey)!;
  }

  // 🔥 FIX: Create the promise and store it
  const creationPromise = this._createAttemptInternal(
    examId,
    student,
    exam,
    deviceInfo
  );

  this.creatingAttempts.set(attemptKey, creationPromise);

  try {
    const result = await creationPromise;
    return result;
  } finally {
    // Clean up after 5 seconds to prevent memory leaks
    setTimeout(() => {
      this.creatingAttempts.delete(attemptKey);
      console.log('🧹 Cleaned up attempt creation lock for:', attemptKey);
    }, 5000);
  }
}

/**
 * Internal method to actually create the exam attempt
 * 🔥 PRIVATE: Called only by startExamAttempt with race condition protection
 */
private async _createAttemptInternal(
  examId: string,
  student: {
    userId: string;
    fullName: string;
    email: string;
    rollNumber: string;
    class: string;
  },
  exam: ExamModel,
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenResolution: string;
    ipAddress: string;
  }
): Promise<StudentExamAttempt> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  // ✅ FIX: If roll number is missing or "N/A", fetch from user document
  let rollNumber = student.rollNumber;
  if (!rollNumber || rollNumber.trim() === '' || rollNumber === 'N/A') {
    console.log('🔍 Roll number missing or N/A, fetching from user document...');
    try {
      const userDoc = await getDoc(doc(this.firestore, COLLECTIONS.USERS, student.userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        rollNumber = userData.rollNumber || userData.studentRoll || 'N/A';
        console.log('✅ Fetched roll number from user document:', rollNumber);
      } else {
        console.warn('⚠️ User document not found, keeping roll number as:', rollNumber);
      }
    } catch (error) {
      console.error('❌ Error fetching roll number:', error);
      rollNumber = student.rollNumber || 'N/A';
    }
  }

  // 🔥 PREVENT DUPLICATES: Check if an active attempt already exists
  const existingAttempt = await this.getActiveAttempt(examId, student.userId);
  if (existingAttempt) {
    console.log('⚠️ Active attempt already exists, returning existing:', existingAttempt.attemptId);
    return existingAttempt;
  }

  const attemptId = doc(collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS)).id;
  const now = new Date();

  const attempt: StudentExamAttempt = {
    // IDs
    attemptId,
    examId,
    studentId: student.userId,
    
    // Student context
    studentName: student.fullName,
    studentEmail: student.email,
    rollNumber: rollNumber,  // ✅ Use fetched roll number
    class: student.class,
    board: exam.board,
    
    // Exam context
    examTitle: exam.title,
    subject: exam.subject,
    academicYear: exam.year,
    examType: exam.type,
    collegeId: exam.collegeId,
    collegeName: exam.collegeName,
    
    // ✅ FIX 1: Use 'mode' not 'examMode'
    mode: (exam.mode || EXAM_MODES.ONLINE) as ExamMode,
    
    // ✅ FIX 2: Use 'maximumScore' and 'duration' (correct names)
    maximumScore: parseInt(exam.maxMarks),
    duration: parseInt(exam.duration),
    
    // Timing
    startTime: now,
    // submitTime will be set when exam is submitted (optional field, don't set undefined)
    
    // ✅ FIX 4: Add 'timeSpent'
    timeSpent: 0,
    
    // Status
    status: ATTEMPT_STATUS.IN_PROGRESS,
    
    // ✅ FIX 5: Add 'isLocked'
    isLocked: false,
    
    // Performance
    totalScore: 0,
    
    // ✅ FIX 6: Add 'obtainedMarks'
    obtainedMarks: 0,
    
    percentage: 0,
    
    // Question tracking
    // ✅ Use exam.totalQuestions directly from database (NOT calculated from questionsList or questionPool)
    totalQuestions: exam.totalQuestions || 0,
    
    // ✅ FIX 8: Add 'attemptedQuestions'
    attemptedQuestions: 0,
    
    // ✅ FIX 9: Add 'correctAnswers'
    correctAnswers: 0,
    
    // Evaluation
    // ✅ FIX 10: Add 'aiEvaluated'
    aiEvaluated: false,
    
    // ✅ FIX 11: Add 'manualReviewRequired'
    manualReviewRequired: false,
    
    // ✅ FIX 12: Add 'evaluationStatus'
    evaluationStatus: EVALUATION_STATUS.PENDING,
    
    pendingEvaluations: 0,
    
    // Responses
    responses: [],
    
    // Proctoring
    activities: [], // Start empty - activities will be logged explicitly
    deviceInfo,
    
    // Metadata
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId), attempt);
  
  console.log('✅ Exam attempt started:', attemptId);
  return attempt;
}

/**
 * Log 'enter' activity when user re-enters the exam
 */
async logEnterActivity(attemptId: string, ipAddress: string): Promise<void> {
  try {
    if (!this.firestore) {
      console.warn('⚠️ Firestore not initialized');
      return;
    }

    const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
    const attemptDoc = await getDoc(attemptRef);
    
    if (!attemptDoc.exists()) {
      console.warn('⚠️ Attempt not found');
      return;
    }

    const attempt = attemptDoc.data() as StudentExamAttempt;
    
    // 🔥 PREVENT DUPLICATES: Check if there's already a recent 'enter' activity (within last 10 seconds)
    const now = new Date();
    const recentEnter = attempt.activities?.find(activity => {
      if (activity.type !== 'enter') return false;
      
      const activityTime = activity.timestamp instanceof Date 
        ? activity.timestamp 
        : (activity.timestamp as any)?.toDate?.() || new Date(0);
      
      const timeDiff = now.getTime() - activityTime.getTime();
      return timeDiff < 10000; // Within last 10 seconds
    });

    if (recentEnter) {
      console.log('⏭️ Recent enter activity found (within 10s), skipping duplicate');
      return;
    }

    const enterActivity = {
      type: ACTIVITY_TYPES.ENTER,
      timestamp: now,
      ipAddress: ipAddress
    };

    await updateDoc(attemptRef, {
      activities: arrayUnion(enterActivity),
      updatedAt: now
    });

    console.log('✅ Enter activity logged for attempt:', attemptId);
  } catch (error) {
    console.error('❌ Error logging enter activity:', error);
  }
}

/**
 * Get active attempt for a student
 */
async getActiveAttempt(examId: string, studentId: string): Promise<StudentExamAttempt | null> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  // ✅ FIX: Only return IN_PROGRESS attempts (not SUBMITTED)
  // This prevents students from re-entering submitted exams
  const q = query(
    collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
    where('examId', '==', examId),
    where('studentId', '==', studentId),
    where('status', '==', ATTEMPT_STATUS.IN_PROGRESS),  // Only IN_PROGRESS
    orderBy('startTime', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as StudentExamAttempt;
}

/**
 * Get any attempt (including submitted) for a student on an exam
 * Used to check if student already has a submitted attempt
 */
async getAnyAttempt(examId: string, studentId: string): Promise<StudentExamAttempt | null> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  const q = query(
    collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
    where('examId', '==', examId),
    where('studentId', '==', studentId),
    orderBy('startTime', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as StudentExamAttempt;
}

/**
 * Check if student has submitted specific exams
 * Returns a map of examId -> boolean (true if submitted)
 */
async checkSubmittedExams(examIds: string[], studentId: string): Promise<Record<string, boolean>> {
  if (!this.firestore) throw new Error('Firestore not initialized');
  
  console.log('🔍 [checkSubmittedExams] Checking submissions for:', {
    studentId,
    examCount: examIds.length,
    examIds
  });
  
  const submittedMap: Record<string, boolean> = {};
  
  // Initialize all as false
  examIds.forEach(id => submittedMap[id] = false);
  
  if (examIds.length === 0) return submittedMap;
  
  try {
    // Query for all attempts by this student for these exams
    const q = query(
      collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
      where('studentId', '==', studentId),
      where('examId', 'in', examIds.slice(0, 10)) // Firestore 'in' limit is 10
    );
    
    const snapshot = await getDocs(q);
    
    console.log('🔍 [checkSubmittedExams] Found attempts:', snapshot.size);
    
    snapshot.docs.forEach(doc => {
      const attempt = doc.data() as StudentExamAttempt;
      const isSubmitted = !!(
        attempt.submitTime || 
        attempt.status === 'submitted' || 
        attempt.status === 'evaluated' || 
        attempt.status === 'under_review'
      );
      
      if (isSubmitted) {
        submittedMap[attempt.examId] = true;
        console.log('✅ [checkSubmittedExams] Exam submitted:', {
          examId: attempt.examId,
          status: attempt.status,
          submitTime: attempt.submitTime
        });
      }
    });
    
    // Handle remaining exams if more than 10 (Firestore limitation)
    if (examIds.length > 10) {
      const remainingExamIds = examIds.slice(10);
      const remainingMap = await this.checkSubmittedExams(remainingExamIds, studentId);
      Object.assign(submittedMap, remainingMap);
    }
    
    console.log('📊 [checkSubmittedExams] Final result:', submittedMap);
    return submittedMap;
  } catch (error) {
    console.error('❌ [checkSubmittedExams] Error:', error);
    return submittedMap;
  }
}


// ==================== SEARCH METHODS ====================
// Add these inside your FirebaseService class

/**
 * Search all entities (users, exams, questions) with a single search term
 * Usage: const results = await firebaseService.searchAll('physics', collegeId);
 */
async searchAll(
  searchTerm: string,
  collegeId?: string,
  searchAllColleges: boolean = false
): Promise<{
  users: Array<{
    id: string;
    type: 'user';
    title: string;
    subtitle?: string;
    metadata?: string;
    badge?: string;
  }>;
  exams: Array<{
    id: string;
    type: 'exam';
    title: string;
    subtitle?: string;
    metadata?: string;
    badge?: string;
  }>;
  questions: Array<{
    id: string;
    type: 'question';
    title: string;
    subtitle?: string;
    metadata?: string;
    badge?: string;
  }>;
}> {
  const term = searchTerm.toLowerCase().trim();
  
  if (!term) {
    return { users: [], exams: [], questions: [] };
  }

  try {
    console.log('🔍 [SEARCH_ALL] Starting search for:', term, 'collegeId:', collegeId, 'searchAllColleges:', searchAllColleges);
    
    // Run all searches in parallel
    const [users, exams, questions] = await Promise.all([
      this.searchUsersForGlobalSearch(term, collegeId),
      this.searchExamsForGlobalSearch(term, collegeId),
      this.searchQuestionsForGlobalSearch(term, collegeId)
    ]);

    console.log('✅ [SEARCH_ALL] Results:', {
      users: users.length,
      exams: exams.length,
      questions: questions.length
    });
    
    console.log('📊 [SEARCH_ALL] User results structure:', users);

    return { users, exams, questions };
  } catch (error) {
    console.error('❌ Error in searchAll:', error);
    return { users: [], exams: [], questions: [] };
  }
}

/**
 * Search users for global search - returns formatted results
 * Internal method used by searchAll
 */
private async searchUsersForGlobalSearch(
  searchTerm: string,
  collegeId?: string
): Promise<Array<{
  id: string;
  type: 'user';
  title: string;
  subtitle?: string;
  metadata?: string;
  badge?: string;
}>> {
  try {
    if (!this.isInitialized() || !this.firestore) {
      console.warn('⚠️ Firebase not initialized');
      return [];
    }

    // ✅ PRIVACY: Only search own college users
    if (!collegeId) {
      console.warn('⚠️ [USER_SEARCH] No collegeId provided - returning empty results');
      return [];
    }

    const results: Array<any> = [];
    const usersRef = collection(this.firestore!, COLLECTIONS.USERS);
    
    // Build query with filters - ALWAYS filter by collegeId
    const constraints: any[] = [
      where('status', '==', USER_STATUS.ACTIVE),
      where('collegeId', '==', collegeId)
    ];
    
    console.log(`🔍 [USER_SEARCH] Searching users from college: ${collegeId}`);
    
    const q = query(usersRef, ...constraints);
    const snapshot = await getDocs(q);
    
    console.log(`🔍 [USER_SEARCH] Found ${snapshot.size} active users to search through`);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // Try multiple field name variations - ensure all are strings
      const fullName = String(data.fullName || data.name || data.displayName || '');
      const email = String(data.email || '');
      const studentRoll = String(data.studentRoll || data.rollNumber || data.roll || '');
      const phone = String(data.phone || data.phoneRaw || data.phoneNumber || '');
      const parentPhone = String(data.parentPhone || '');
      
      const searchableName = fullName.toLowerCase();
      const searchableEmail = email.toLowerCase();
      const searchableRoll = studentRoll.toLowerCase();
      const searchablePhone = phone.toLowerCase().replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
      const searchableParentPhone = parentPhone.toLowerCase().replace(/[\s\-\(\)]/g, '');
      const cleanSearchTerm = searchTerm.toLowerCase().replace(/[\s\-\(\)]/g, '');
      
      // Check if search term matches
      if (
        searchableName.includes(searchTerm) ||
        searchableEmail.includes(searchTerm) ||
        searchableRoll.includes(searchTerm) ||
        searchablePhone.includes(cleanSearchTerm) ||
        searchableParentPhone.includes(cleanSearchTerm)
      ) {
        console.log(`✅ [SEARCH] Match found:`, {
          id: doc.id,
          fullName,
          email,
          studentRoll,
          phone,
          userType: data.userType
        });
        
        // Build subtitle with email and phone
        let subtitle = '';
        if (email && phone) {
          subtitle = `${email} • ${phone}`;
        } else if (email) {
          subtitle = email;
        } else if (phone) {
          subtitle = phone;
        }
        
        // Build metadata
        let metadata = '';
        if (studentRoll) {
          metadata = `Roll: ${studentRoll}`;
        } else if (data.studentClass) {
          metadata = `Class: ${data.studentClass}`;
        } else if (data.class) {
          metadata = `Class: ${data.class}`;
        }
        
        // Add parent phone for students if available
        if (parentPhone && data.userType === 'student') {
          metadata = metadata ? `${metadata} • Parent: ${parentPhone}` : `Parent: ${parentPhone}`;
        }
        
        results.push({
          id: doc.id,
          type: 'user' as const,
          title: fullName || email || phone || 'Unknown User',
          subtitle: subtitle || undefined,
          metadata: metadata || undefined,
          badge: this.getUserTypeBadge(data.userType),
          userType: data.userType || 'student',
          studentClass: data.studentClass || data.class || undefined
        });
      }
    });

    console.log(`🎯 [SEARCH] Returning ${results.length} user results`);

    // Sort by relevance
    return results
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aExact = aTitle === searchTerm;
        const bExact = bTitle === searchTerm;
        const aStarts = aTitle.startsWith(searchTerm);
        const bStarts = bTitle.startsWith(searchTerm);
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aTitle.localeCompare(bTitle);
      })
      .slice(0, 10); // Increased from 5 to 10
  } catch (error) {
    console.error('❌ Error searching users:', error);
    return [];
  }
}

/**
 * Search exams for global search - returns formatted results
 * Internal method used by searchAll
 */
private async searchExamsForGlobalSearch(
  searchTerm: string,
  collegeId?: string
): Promise<Array<{
  id: string;
  type: 'exam';
  title: string;
  subtitle?: string;
  metadata?: string;
  badge?: string;
}>> {
  try {
    if (!this.isInitialized() || !this.firestore) {
      console.warn('⚠️ Firebase not initialized');
      return [];
    }

    // ✅ PRIVACY: Only search own college exams
    if (!collegeId) {
      console.warn('⚠️ [EXAM_SEARCH] No collegeId provided - returning empty results');
      return [];
    }

    const results: Array<any> = [];
    const examsRef = collection(this.firestore!, COLLECTIONS.EXAMS);
    
    // Build query - filter by collegeId
    const constraints: any[] = [
      where('collegeId', '==', collegeId),
      orderBy('createdAt', 'desc')
    ];
    
    console.log(`🔍 [EXAM_SEARCH] Searching exams from college: ${collegeId}`);
    
    const q = query(examsRef, ...constraints);
    const snapshot = await getDocs(q);
    
    console.log(`🔍 [EXAM_SEARCH] Found ${snapshot.size} exams to search through`);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const className = (data.class || '').toLowerCase();
      const subject = (data.subject || '').toLowerCase();
      const examType = (data.examType || '').toLowerCase();
      
      // Check if search term matches
      if (
        title.includes(searchTerm) ||
        className.includes(searchTerm) ||
        subject.includes(searchTerm) ||
        examType.includes(searchTerm)
      ) {
        console.log(`✅ [EXAM_SEARCH] Exam match:`, {
          id: doc.id,
          title: data.title,
          class: data.class,
          subject: data.subject
        });
        
        results.push({
          id: doc.id,
          type: 'exam' as const,
          title: data.title || 'Untitled Exam',
          subtitle: `${data.class || 'N/A'} • ${data.subject || 'N/A'}`,
          metadata: data.date ? this.formatSearchDate(data.date) : 
                    data.examType ? data.examType : undefined,
          badge: this.getExamStatusBadge(data.status, data.date, data.time)
        });
      }
    });

    console.log(`🎯 [SEARCH] Returning ${results.length} exam results`);

    // Sort by relevance and date
    return results
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aStarts = aTitle.startsWith(searchTerm);
        const bStarts = bTitle.startsWith(searchTerm);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      })
      .slice(0, 10); // Increased from 5 to 10
  } catch (error) {
    console.error('❌ Error searching exams:', error);
    return [];
  }
}

/**
 * Search questions for global search - returns formatted results
 * Internal method used by searchAll
 */
private async searchQuestionsForGlobalSearch(
  searchTerm: string,
  collegeId?: string
): Promise<Array<{
  id: string;
  type: 'question';
  title: string;
  subtitle?: string;
  metadata?: string;
  badge?: string;
}>> {
  try {
    if (!this.isInitialized() || !this.firestore) {
      console.warn('⚠️ Firebase not initialized');
      return [];
    }

    console.log('🔍 [QUESTION_SEARCH] Starting search for:', searchTerm, 'collegeId:', collegeId);
    console.log('🔍 [QUESTION_SEARCH] Privacy: Public questions + Own college private questions');

    const results: Array<any> = [];
    const questionsRef = collection(this.firestore!, COLLECTIONS.QUESTION_BANK);
    
    // Helper function to strip HTML tags
    const stripHtml = (html: string): string => {
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    };
    
    // Fetch ALL questions (we'll filter by privacy in code)
    console.log('🔍 [QUESTION_SEARCH] Fetching ALL questions from database...');
    const snapshot = await getDocs(questionsRef);
    console.log('🔍 [QUESTION_SEARCH] Found', snapshot.size, 'total questions in database');
    
    let matchCount = 0;
    let sampleCount = 0;
    let skippedPrivate = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // ✅ PRIVACY CHECK: Filter by public/private + collegeId
      const isPublic = data.isProprietaryQuestion === false;
      const isOwnCollege = collegeId && data.collegeId === collegeId;
      
      // Skip if private question from another college
      if (!isPublic && !isOwnCollege) {
        skippedPrivate++;
        return; // Skip this question
      }
      
      // Strip HTML from questionText before searching
      const questionTextRaw = data.questionText || '';
      const questionText = stripHtml(questionTextRaw).toLowerCase();
      const subject = (data.subject || '').toLowerCase();
      const className = (data.class || '').toLowerCase();
      const chapter = (data.chapter || '').toLowerCase();
      const tags = (data.tags || []).map((t: string) => String(t).toLowerCase());
      
      // Log first 5 questions for debugging (regardless of match)
      if (sampleCount < 5) {
        sampleCount++;
        console.log(`🔍 [QUESTION_SEARCH] Sample question #${sampleCount}:`, {
          id: doc.id,
          questionTextStripped: questionText.substring(0, 100),
          subject,
          class: className,
          collegeId: data.collegeId,
          isPublic,
          isOwnCollege,
          searchTerm: searchTerm
        });
      }
      
      // Check if search term matches
      const matchesQuestionText = questionText.includes(searchTerm);
      const matchesSubject = subject.includes(searchTerm);
      const matchesClass = className.includes(searchTerm);
      const matchesChapter = chapter.includes(searchTerm);
      const matchesTags = tags.some((tag: string) => tag.includes(searchTerm));
      
      // Log detailed matching info for first question
      if (sampleCount === 1) {
        console.log('🔍 [QUESTION_SEARCH] Detailed match check for first question:', {
          searchTerm: `"${searchTerm}"`,
          questionText: `"${questionText.substring(0, 150)}"`,
          matchesQuestionText,
          matchesSubject,
          matchesClass,
          matchesChapter,
          matchesTags,
          tags
        });
      }
      
      if (matchesQuestionText || matchesSubject || matchesClass || matchesChapter || matchesTags) {
        matchCount++;
        
        if (matchCount <= 5) {
          console.log('✅ [QUESTION_SEARCH] Match found:', {
            id: doc.id,
            matchType: matchesQuestionText ? 'questionText' : 
                       matchesSubject ? 'subject' :
                       matchesClass ? 'class' :
                       matchesChapter ? 'chapter' : 'tags',
            questionPreview: questionText.substring(0, 80),
            collegeId: data.collegeId,
            isPublic,
            isOwnCollege
          });
        }
        
        // Show college info if from different college
        let subtitle = `${data.class || 'N/A'} • ${data.subject || 'N/A'}`;
        if (data.collegeId && collegeId && data.collegeId !== collegeId) {
          subtitle += ` • 🏢 ${data.collegeId}`;
        }
        
        results.push({
          id: doc.id,
          type: 'question' as const,
          title: this.truncateQuestionText(stripHtml(data.questionText || 'Untitled Question'), 70),
          subtitle: subtitle,
          metadata: data.marks ? `${data.marks} marks` : 
                    data.chapter ? `Ch: ${data.chapter}` : undefined,
          badge: this.getQuestionTypeBadge(data.type)
        });
      }
    });

    console.log('🎯 [QUESTION_SEARCH] Search complete:', {
      totalQuestionsSearched: snapshot.size,
      skippedPrivate: skippedPrivate,
      matchesFound: matchCount,
      rawResultsCount: results.length,
      searchTerm: `"${searchTerm}"`,
      collegeId: collegeId
    });
    
    // Log first few results to check for duplicates
    if (results.length > 0) {
      console.log('🔍 [QUESTION_SEARCH] First 5 raw results:');
      results.slice(0, 5).forEach((r, idx) => {
        console.log(`   ${idx + 1}. ID: ${r.id}, Title: ${r.title.substring(0, 50)}`);
      });
    }

    // Deduplicate results by question ID
    const uniqueResults = Array.from(
      new Map(results.map(item => [item.id, item])).values()
    );
    
    const duplicatesRemoved = results.length - uniqueResults.length;
    if (duplicatesRemoved > 0) {
      console.log(`⚠️ [QUESTION_SEARCH] Removed ${duplicatesRemoved} duplicate(s)`);
    }
    
    console.log('🎯 [QUESTION_SEARCH] After dedup:', uniqueResults.length, 'unique results');
    console.log('🎯 [QUESTION_SEARCH] Returning top', Math.min(uniqueResults.length, 10), 'unique results');

    // Sort by relevance
    return uniqueResults
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aStarts = aTitle.startsWith(searchTerm);
        const bStarts = bTitle.startsWith(searchTerm);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      })
      .slice(0, 10); // Return top 10 results
  } catch (error) {
    console.error('❌ Error searching questions:', error);
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

// ==================== HELPER METHODS ====================

/**
 * Get user type badge for display
 */
private getUserTypeBadge(userType: UserType): string {
  const badges: { [key in UserType]: string } = {
    'system_admin': 'System Admin',
    'super_admin': 'Super Admin',
    'admin': 'Admin',
    'principal': 'Principal',
    'dean': 'Dean',
    'teacher': 'Teacher',
    'student': 'Student'
  };
  return badges[userType] || userType;
}

/**
 * Get exam status badge for display
 */
private getExamStatusBadge(status: string, date?: string, time?: string): string | undefined {
  // If status is explicitly set, use it
  if (status && status !== USER_STATUS.ACTIVE) {
    const badges: { [key: string]: string } = {
      'upcoming': 'Upcoming',
      'live': 'Live',
      'completed': 'Completed',
      'draft': 'Draft',
      'cancelled': 'Cancelled'
    };
    return badges[status];
  }

  // Otherwise, calculate based on date and time
  if (!date) return undefined;

  try {
    const examDate = new Date(date);
    const now = new Date();
    
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      examDate.setHours(hours, minutes, 0, 0);
    } else {
      examDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
    }

    if (examDate > now) return 'Upcoming';
    if (examDate.toDateString() === now.toDateString()) return 'Live';
    return 'Completed';
  } catch {
    return undefined;
  }
}

/**
 * Get question type badge for display
 */
private getQuestionTypeBadge(type: string): string {
  const badges: { [key: string]: string } = {
    'mcq': 'MCQ',
    'mca': 'MCA',
    'true_false': 'T/F',
    'short': 'Short',
    'long': 'Long',
    [QUESTION_TYPES.FITB]: 'FITB',
    [QUESTION_TYPES.JUMBLED]: 'Jumbled',
    [QUESTION_TYPES.DESCRIPTIVE]: 'Descriptive',
    [QUESTION_TYPES.CODE]: 'Code',
  };
  return badges[type] || type.toUpperCase();
}

/**
 * Truncate question text for display
 */
private truncateQuestionText(text: string, maxLength: number): string {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, '');
  
  if (cleanText.length <= maxLength) {
    return cleanText;
  }
  
  return cleanText.substring(0, maxLength) + '...';
}

/**
 * Format date for search results display
 */
private formatSearchDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

// ==================== END OF SEARCH METHODS ====================
// ==================== ANSWER SUBMISSION ====================

/**
 * Helper: Convert violation timestamp to IST format
 * Ensures every violation has a valid IST timestamp string
 */
private ensureViolationIST(violation: any): any {
  const convertToIST = (date: Date): string => {
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istTime = new Date(date.getTime() + istOffset);
    
    // Format: YYYY-MM-DD HH:mm:ss IST
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} IST`;
  };
  
  let dateObj: Date;
  
  // Check if timestamp exists and is valid
  if (!violation.timestamp || 
      (typeof violation.timestamp === 'object' && Object.keys(violation.timestamp).length === 0)) {
    // No timestamp or empty object - use current time
    console.warn('⚠️ Violation missing timestamp, using current time');
    dateObj = new Date();
  } else if (violation.timestamp instanceof Date) {
    dateObj = violation.timestamp;
  } else if (typeof violation.timestamp === 'string') {
    // Check if already in IST format
    if (violation.timestamp.includes(' IST')) {
      return violation; // Already in IST format
    }
    dateObj = new Date(violation.timestamp);
  } else if (typeof violation.timestamp === 'object' && 'seconds' in violation.timestamp) {
    // Firestore Timestamp format
    const firestoreTimestamp = violation.timestamp as { seconds: number; nanoseconds?: number };
    dateObj = new Date(firestoreTimestamp.seconds * 1000 + (firestoreTimestamp.nanoseconds || 0) / 1000000);
  } else {
    console.warn('⚠️ Invalid timestamp format, using current time');
    dateObj = new Date();
  }
  
  // Validate the date
  if (isNaN(dateObj.getTime())) {
    console.error('❌ Invalid date created, using current time');
    dateObj = new Date();
  }
  
  return {
    ...violation,
    timestamp: convertToIST(dateObj)
  };
}

/**
 * Submit/update an answer for a question
 * This is ASYNC - student doesn't wait for evaluation
 */
/**
 * Submit/update an answer for a question
 * This is ASYNC - student doesn't wait for evaluation
 * ✅ FIXED: Now properly handles violations at both question and global levels
 */
async submitAnswer(
  attemptId: string,
  questionNo: number,
  answer: string | string[],
  question: Question,
  questionBankItem?: QuestionBankItem,
  timeSpent?: number,
  markedForReview: boolean = false,
  imageUrl?: string,
  violations?: any[]
): Promise<{ success: boolean; message: string }> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  console.log(`📝 submitAnswer called for Q${questionNo} (ID: ${question.id})`);

  try {
    // ✅ DEBUG: Log incoming question data for MCQ and FITB
    if (question.type === QUESTION_TYPES.MCQ) {
      console.log('🔍 MCQ Question Data Received in submitAnswer:', {
        questionNo,
        hasOptions: !!question.options,
        optionsCount: question.options?.length || 0,
        options: question.options,
        hasCorrectAnswers: !!question.correctAnswers,
        correctAnswers: question.correctAnswers,
        studentAnswer: answer
      });
    } else if (question.type === QUESTION_TYPES.FITB) {
      console.log('🔍 FITB Question Data Received in submitAnswer:', {
        questionNo,
        hasCorrectAnswers: !!question.correctAnswers,
        correctAnswersCount: question.correctAnswers?.length || 0,
        correctAnswers: question.correctAnswers,
        studentAnswer: answer
      });
    }
    
    const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
    const attemptDoc = await getDoc(attemptRef);
    
    if (!attemptDoc.exists()) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptDoc.data() as StudentExamAttempt;
    
    // Find existing response or create new
    const existingIndex = attempt.responses.findIndex(r => r.questionNo === questionNo);
    const isNewResponse = existingIndex === -1;
    
    const now = new Date();

    // Create or update response
    let response: StudentQuestionResponse;
    
    if (isNewResponse) {
      // Build response object, filtering out undefined values
      const newResponse: any = {
        questionId: question.id,
        questionNo,
        questionType: question.type,
        maxMarks: question.maximumMarks,
        questionText: question.questionText,
        options: question.options,              // ✅ ADD: Save options array for MCQ
        correctAnswers: question.correctAnswers,
        
        studentAnswer: answer,
        viewed: true,
        answered: true,  // ✅ NEW: Mark as answered (not a placeholder)
        attemptCount: 1,  // ✅ FIX: Track number of attempts instead of history
        
        marksAwarded: 0,
        autoEvaluated: false,
        evaluationStatus: EVALUATION_STATUS.PENDING,
        evaluatedBy: 'system',
        evaluationMethod: 'exact_match',
        evaluatedAt: null,
        
        violations: (violations || []).map(v => this.ensureViolationIST(v)),  // ✅ Convert all violations to IST format
        
        timeSpent: timeSpent || 0,
        markedForReview,
        attemptSequence: attempt.responses.filter(r => 
          r.studentAnswer !== null && 
          r.studentAnswer !== undefined && 
          r.studentAnswer !== ''
        ).length + 1,
        revisitCount: 0,
        
        pool: question.fromPool === true,  // ✅ ADD: Flag if question is from pool
        
        firstAttemptedAt: now,
        lastModifiedAt: now,
      };
      
      // ✅ DEBUG: Log questionBankItem received
      console.log('📖 CHAPTER DEBUG - firebase_service.submitAnswer():');
      console.log('  1. questionBankItem received:', questionBankItem);
      console.log('  2. questionBankItem?.chapter:', questionBankItem?.chapter);
      console.log('  3. questionBankItem?.complexity:', questionBankItem?.complexity);
      console.log('  4. typeof chapter:', typeof questionBankItem?.chapter);
      console.log('  5. chapter !== undefined:', questionBankItem?.chapter !== undefined);
      
      // Only add optional fields if they have values
      if (questionBankItem?.complexity !== undefined) {
        newResponse.complexity = questionBankItem.complexity;
        console.log('  ✅ Added complexity to response:', questionBankItem.complexity);
      }
      if (questionBankItem?.chapter !== undefined) {
        newResponse.chapter = questionBankItem.chapter;
        console.log('  ✅ Added chapter to response:', questionBankItem.chapter);
      } else {
        console.log('  ❌ Chapter NOT added - questionBankItem?.chapter is undefined');
      }
      if (imageUrl !== undefined) {
        newResponse.imageUrl = imageUrl;
      }
      
      console.log('📖 CHAPTER DEBUG - Final newResponse object:', {
        questionNo: newResponse.questionNo,
        chapter: newResponse.chapter,
        complexity: newResponse.complexity,
        hasChapter: 'chapter' in newResponse,
      });
      
      // ✅ DEBUG: Log what's being saved for MCQ and FITB
      if (question.type === QUESTION_TYPES.MCQ) {
        console.log('💾 MCQ Response Being Saved to Firebase:', {
          questionNo: newResponse.questionNo,
          hasOptions: !!newResponse.options,
          optionsCount: newResponse.options?.length || 0,
          options: newResponse.options,
          hasCorrectAnswers: !!newResponse.correctAnswers,
          correctAnswers: newResponse.correctAnswers,
          studentAnswer: newResponse.studentAnswer
        });
      } else if (question.type === QUESTION_TYPES.FITB) {
        console.log('💾 FITB Response Being Saved to Firebase:', {
          questionNo: newResponse.questionNo,
          hasCorrectAnswers: !!newResponse.correctAnswers,
          correctAnswersCount: newResponse.correctAnswers?.length || 0,
          correctAnswers: newResponse.correctAnswers,
          studentAnswer: newResponse.studentAnswer
        });
      }
      
      response = newResponse as StudentQuestionResponse;
      attempt.responses.push(response);
      
      // ✅ Violations stored at question level only (in response.violations)
      if (violations && violations.length > 0) {
        console.log(`📋 Stored ${violations.length} violations at question level for Q${questionNo}`);
      }
      
    } else {
      response = attempt.responses[existingIndex];
      
      // ✅ Mark placeholder as answered (if it was a placeholder)
      if ((response as any).answered === false) {
        (response as any).answered = true;
        (response as any).firstAttemptedAt = now;
        console.log(`✅ Q${questionNo}: Placeholder converted to answered response`);
      }
      
      // ✅ ALWAYS increment revisitCount (even if answer unchanged)
      (response as any).revisitCount = ((response as any).revisitCount || 0) + 1;
      (response as any).lastModifiedAt = now;
      
      // Update time spent regardless of answer change
      if (timeSpent) response.timeSpent = (response.timeSpent || 0) + timeSpent;
      
      // Update markedForReview flag
      response.markedForReview = markedForReview;
      
      // ✅ FIX: ALWAYS update correctAnswers and options from question data even if answer unchanged
      // This ensures if the data was missing before, it gets updated on revisit
      if (question.correctAnswers !== undefined && !(response as any).correctAnswers) {
        (response as any).correctAnswers = question.correctAnswers;
        console.log(`📝 Updated missing correctAnswers for Q${questionNo}`);
      }
      if (question.options !== undefined && !(response as any).options) {
        (response as any).options = question.options;
        console.log(`📝 Updated missing options for Q${questionNo}`);
      }
      
      // ✅ ADD: Update pool flag if not present or different
      if (question.fromPool !== undefined && (response as any).pool !== question.fromPool) {
        (response as any).pool = question.fromPool === true;
        console.log(`📝 Updated pool flag for Q${questionNo}: ${(response as any).pool}`);
      }
      
      // ✅ FIX 1: Check if answer actually changed
      const previousAnswer = response.studentAnswer;
      const answerChanged = JSON.stringify(previousAnswer) !== JSON.stringify(answer);
      
      if (!answerChanged) {
        // Still update Firebase with revisitCount and timeSpent
        const updateData = deepCleanObject({
          responses: attempt.responses,
          updatedAt: now
        });
        
        await updateDoc(attemptRef, updateData);
        
        console.log(`⏭️ Q${questionNo} answer unchanged but visit counted (revisitCount: ${(response as any).revisitCount})`);
        return { 
          success: true, 
          message: 'Visit counted - no answer change' 
        };
      }
      
      console.log(`📝 Q${questionNo} answer changed, updating Firebase & triggering evaluation`);
      
      // Only increment attemptCount if answer actually changed
      response.studentAnswer = answer;
      response.attemptCount = (response.attemptCount || 0) + 1;  // ✅ Only when answer changes

      // ✅ STEP 3 FIX: Mark as answered and update evaluationStatus
      if ((response as any).answered === false) {
        (response as any).answered = true;
        console.log(`✅ Q${questionNo}: answered changed from false → true`);
      }

      // ✅ Update evaluationStatus from 'not_attempted' to 'pending'
      if (response.evaluationStatus === 'not_attempted') {
        response.evaluationStatus = EVALUATION_STATUS.PENDING;
        console.log(`✅ Q${questionNo}: evaluationStatus changed from not_attempted → pending`);
      }

      // ✅ Set firstAttemptedAt if this is the first answer
      if (!(response as any).firstAttemptedAt) {
        (response as any).firstAttemptedAt = now;
      }
      
      // ✅ FIX: ALWAYS update correctAnswers and options from the question data
      // This ensures if the data was missing before, it gets updated now
      if (question.correctAnswers !== undefined) {
        (response as any).correctAnswers = question.correctAnswers;
      }
      if (question.options !== undefined) {
        (response as any).options = question.options;
      }
      
      // Update imageUrl if provided
      if (imageUrl !== undefined) {
        (response as any).imageUrl = imageUrl;
      }
      
      // ✅ FIX: Append new violations to existing ones at BOTH levels
      if (violations && violations.length > 0) {
        console.log(`📋 Processing ${violations.length} violations for EXISTING response Q${questionNo}`);
        
        // Add to question-level - convert violations to IST format first
        const convertedViolations = violations.map(v => this.ensureViolationIST(v));
        response.violations = [...(response.violations || []), ...convertedViolations];
        console.log(`✅ Added to question-level: Q${questionNo} now has ${response.violations.length} violations`);
      }
      // Reset evaluation if answer changed
      if (response.evaluationStatus === EVALUATION_STATUS.COMPLETED) {
        response.evaluationStatus = EVALUATION_STATUS.PENDING;
        (response as any).marksAwarded = 0;
        (response as any).evaluatedAt = null;
      }
    }

    // Update attempt document - use deep cleaning utility
    attempt.updatedAt = now;
    
    // ✅ FIX: Include violations and violationSummary in update (NEW CODE)
     const updateData = deepCleanObject({
      responses: attempt.responses,
      updatedAt: now
    });
    
    await updateDoc(attemptRef, updateData);

    // ✅ Evaluation happens server-side when exam is submitted via Cloud Function
    console.log(`✅ Answer saved for Q${questionNo} - will be graded server-side on exam submission`);

    return { 
      success: true, 
      message: response.evaluationStatus === EVALUATION_STATUS.PENDING 
        ? 'Answer submitted successfully. Evaluation in progress...' 
        : 'Answer submitted successfully.'
    };

  } catch (error: any) {
    console.error('❌ Error submitting answer:', error);
    return { 
      success: false, 
      message: error.message 
    };
  }
}

/**
 * Update response evaluation status
 */
// @ts-ignore - Unused method preserved for potential future use
private async updateResponseStatus(
  attemptId: string,
  questionNo: number,
  status: EvaluationStatus,
  error?: string
): Promise<void> {
  if (!this.firestore) return;

  const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
  const attemptDoc = await getDoc(attemptRef);
  
  if (!attemptDoc.exists()) return;

  const attempt = attemptDoc.data() as StudentExamAttempt;
  const responseIndex = attempt.responses.findIndex(r => r.questionNo === questionNo);
  
  if (responseIndex === -1) return;

  attempt.responses[responseIndex].evaluationStatus = status;
  if (error) {
    (attempt.responses[responseIndex] as any).evaluatedBy = 'system';
  }

  const updateData = deepCleanObject({
    responses: attempt.responses,
    updatedAt: new Date()
  });

  await updateDoc(attemptRef, updateData);
}

/**
 * Update response retry tracking
 */
// @ts-ignore - Unused method preserved for potential future use
private async updateResponseRetryStatus(
  attemptId: string,
  questionNo: number,
  retries: number,
  errorMessage: string
): Promise<void> {
  if (!this.firestore) return;

  const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
  const attemptDoc = await getDoc(attemptRef);
  
  if (!attemptDoc.exists()) return;

  const attempt = attemptDoc.data() as StudentExamAttempt;
  const responseIndex = attempt.responses.findIndex(r => r.questionNo === questionNo);
  
  if (responseIndex === -1) return;

  attempt.responses[responseIndex].evaluationRetries = retries;
  attempt.responses[responseIndex].lastEvaluationAttempt = new Date();
  attempt.responses[responseIndex].evaluationError = errorMessage;
  attempt.responses[responseIndex].evaluationStatus = EVALUATION_STATUS.PENDING;

  const updateData = deepCleanObject({
    responses: attempt.responses,
    updatedAt: new Date()
  });

  await updateDoc(attemptRef, updateData);
  console.log(`✅ Updated retry status for Q${questionNo}: retry ${retries}, next attempt scheduled`);
}

/**
 * Update response with evaluation results
 */
// @ts-ignore - Unused method preserved for potential future use
private async updateResponseWithEvaluation(
  attemptId: string,
  questionNo: number,
  evaluation: {
    marksAwarded: number;
    isCorrect?: boolean;
    evaluationMethod: string;
    codeExecution?: CodeExecutionResult;
    aiFeedback?: AIEvaluationFeedback;
  }
): Promise<void> {
  if (!this.firestore) return;

  const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
  const attemptDoc = await getDoc(attemptRef);
  
  if (!attemptDoc.exists()) return;

  const attempt = attemptDoc.data() as StudentExamAttempt;
  const responseIndex = attempt.responses.findIndex(r => r.questionNo === questionNo);
  
  if (responseIndex === -1) return;

  const response = attempt.responses[responseIndex];
  (response as any).marksAwarded = evaluation.marksAwarded;
  (response as any).isCorrect = evaluation.isCorrect;
  (response as any).evaluationMethod = evaluation.evaluationMethod;
  response.evaluationStatus = EVALUATION_STATUS.COMPLETED;
  (response as any).autoEvaluated = true;
  (response as any).evaluatedBy = evaluation.aiFeedback ? 'AI' : 'system';
  (response as any).evaluatedAt = new Date();
  
  if (evaluation.codeExecution) {
    (response as any).codeExecution = evaluation.codeExecution;
  }
  
  if (evaluation.aiFeedback) {
    (response as any).aiFeedback = evaluation.aiFeedback;
    (response as any).aiSuggestedMarks = evaluation.marksAwarded;
  }

  const updateData = deepCleanObject({
    responses: attempt.responses,
    updatedAt: new Date()
  });

  await updateDoc(attemptRef, updateData);
}

// ==================== QUESTION TYPE EVALUATORS ====================

/**
 * Round marks to 2 decimal places
 */
// @ts-ignore - Unused method preserved for potential future use
private roundMarks(marks: number): number {
  return Math.round(marks * 100) / 100;
}

// ==================== EXAM SUBMISSION ====================

/**
 * Submit exam (final submission)
 */
async submitExam(
  attemptId: string,
  autoSubmitted: boolean = false
): Promise<{ success: boolean; message: string }> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
    const attemptDoc = await getDoc(attemptRef);
    
    if (!attemptDoc.exists()) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptDoc.data() as StudentExamAttempt;
    const now = new Date();

    const startTime = attempt.startTime instanceof Date 
      ? attempt.startTime 
      : (attempt.startTime as any).toDate();

    const timeSpent = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    if (attempt.activities) {
      attempt.activities.push({
        type: ACTIVITY_TYPES.EXIT,
        timestamp: now,
        ipAddress: attempt.deviceInfo?.ipAddress || '',
      });
    }

    await updateDoc(attemptRef, {
      status: autoSubmitted ? ATTEMPT_STATUS.AUTO_SUBMITTED : ATTEMPT_STATUS.SUBMITTED,
      submitTime: now,
      timeSpent: timeSpent,
      autoSubmitted: autoSubmitted,
      activities: attempt.activities,
      updatedAt: now,
    });
    
    // Call Cloud Function for secure server-side grading (fire and forget)
    console.log('🔐 Triggering Cloud Function for background grading...');

    const functions = getFunctions();
    const submitAndGradeExam = httpsCallable(functions, 'submitAndGradeExam');

    // ✅ Fire and forget - don't await, let it run in background
    submitAndGradeExam({
      examId: attempt.examId,
      attemptId: attemptId,
      responses: attempt.responses
    }).then(() => {
      console.log(`✅ Background grading completed for: ${attemptId}`);
    }).catch((error) => {
      console.error(`❌ Background grading failed for ${attemptId}:`, error);
    });

    console.log(`✅ Exam submitted, grading in progress: ${attemptId}`);

    // ✅ Return immediately - don't wait for grading
    return {
      success: true,
      message: 'Exam submitted successfully. Results will be available shortly.',
    };


  } catch (error: any) {
    console.error('❌ Error submitting exam:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async getAllTagsForSubject(collegeId: string, classId: string, subject: string): Promise<string[]> {
  if (!this.firestore) throw new Error('Firestore not initialized');
  
  try {
    const questionsRef = collection(this.firestore, COLLECTIONS.QUESTION_BANK);
    const q = query(
      questionsRef,
      where('class', '==', classId),
      where('subject', '==', subject)
    );
    
    const snapshot = await getDocs(q);
    const tags = new Set<string>();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Filter by collegeId (include both tutorialspoint and specific college)
      if (data.collegeId === DEFAULT_COLLEGE_ID || data.collegeId === collegeId) {
        data.tags?.forEach((tag: string) => tags.add(tag));
      }
    });
    
    return Array.from(tags).sort();
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

// ==================== PROCTORING ====================

/**
 * Add violation to attempt
 * ✅ FIXED: Now creates question response placeholder if it doesn't exist
 * This ensures violations are consistently tracked at BOTH question and global levels
 */
async addViolation(
  attemptId: string,
  violation: ExamViolation
): Promise<void> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
  const attemptDoc = await getDoc(attemptRef);
  
  if (!attemptDoc.exists()) return;

  const attempt = attemptDoc.data() as StudentExamAttempt;
  
  // 🔥 FIX: Convert timestamp to IST format string
  const convertToIST = (date: Date): string => {
    // Get IST time (UTC + 5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istTime = new Date(date.getTime() + istOffset);
    
    // Format: YYYY-MM-DD HH:mm:ss IST
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} IST`;
  };
  
  let timestampToStore: string = '';
  let dateObj: Date = new Date();
  
  // ✅ Check if timestamp is missing or empty object
  if (!violation.timestamp || 
      (typeof violation.timestamp === 'object' && Object.keys(violation.timestamp).length === 0)) {
    console.warn('⚠️ Violation missing or has empty timestamp, using current time');
    dateObj = new Date();
  } else if (violation.timestamp instanceof Date) {
    dateObj = violation.timestamp;
  } else if (typeof violation.timestamp === 'string') {
    // Store timestamp as string to help TypeScript narrow the type
    const timestampStr = violation.timestamp as string;
    // Check if already in IST format
    if (timestampStr.includes(' IST')) {
      timestampToStore = timestampStr;
      console.log('✅ Violation already has IST timestamp:', timestampToStore);
    } else {
      dateObj = new Date(timestampStr);
    }
  } else if (violation.timestamp && typeof violation.timestamp === 'object' && 'seconds' in violation.timestamp) {
    // Firestore Timestamp format
    const firestoreTimestamp = violation.timestamp as { seconds: number; nanoseconds?: number };
    dateObj = new Date(firestoreTimestamp.seconds * 1000 + (firestoreTimestamp.nanoseconds || 0) / 1000000);
  } else {
    console.warn('⚠️ Invalid timestamp format, using current time');
    dateObj = new Date();
  }
  
  // Only convert if we haven't already set timestampToStore
  if (!timestampToStore) {
    // Validate the date
    if (isNaN(dateObj.getTime())) {
      console.error('❌ Invalid date created, using current time');
      dateObj = new Date();
    }
    timestampToStore = convertToIST(dateObj);
  }
  
  console.log('✅ Storing violation with IST timestamp:', {
    type: violation.type,
    originalTimestamp: violation.timestamp,
    storedAsIST: timestampToStore,
    utcTime: dateObj.toISOString()
  });
  
  // 🔥 QUESTION-LEVEL: Find the specific question response
  let questionResponse = attempt.responses.find(r => r.questionNo === violation.questionNo);
  
  // ❌ CRITICAL FIX: DO NOT create placeholder responses for violations
  // Violations should ONLY be added to existing responses or stored at attempt level
  // Creating placeholders with fake questionIds breaks answer loading
  if (!questionResponse) {
    console.warn(`⚠️ Violation for Q${violation.questionNo} but no response exists yet`);
    console.warn(`⚠️ This should not happen if placeholder creation is working`);
    console.warn(`⚠️ Skipping violation save to Firebase - will be saved when answer is submitted`);
    // Violation remains in localStorage and will be saved when answer is submitted
    return; // Exit early - violation will be saved from localStorage when answer submitted
  } else {
    console.log(`✅ Found existing response for Q${violation.questionNo} - adding violation`);
    
    // ✅ Initialize violations array if it doesn't exist
    if (!questionResponse.violations) {
      questionResponse.violations = [];
    }
  
    console.log(`✅ Q${violation.questionNo} has ${questionResponse.violations.length} violations before adding`);

    // Store violation with ISO string timestamp
    const violationWithTimestamp = {
      ...violation,
      timestamp: timestampToStore  // Store as ISO string
    };
    
    // ✅ Add violation to question level
    questionResponse.violations.push(violationWithTimestamp as any);
    console.log(`🚨 Violation added to Q${violation.questionNo}:`, violation.type);
    console.log(`   Timestamp stored: ${timestampToStore}`);
    console.log(`   Total violations on Q${violation.questionNo}:`, questionResponse.violations.length);
  }
  
  // ✅ Violations are stored at question level only
  console.log(`✅ Violation stored at question level for Q${violation.questionNo}`);

  // Update Firebase with responses only
  await updateDoc(attemptRef, {
    responses: attempt.responses,  // ✅ Updated responses (includes violation at question level)
    updatedAt: new Date(),
  });
  
  
  console.log('✅ Violation synced to Firebase:', violation.type, `(Q${violation.questionNo})`);
  
  // ℹ️ NOTE: Global violations may be > question-level violations
  // This is intentional: violations on unanswered questions only go to global level
}
// ==================== CREATE PLACEHOLDER RESPONSE ====================
/**
 * Create placeholder response when student views a question (for violation tracking)
 * This ensures violations are never lost, even if question is never answered
 */
async createPlaceholderResponse(
  attemptId: string,
  questionNo: number,
  questionId: string,
  questionType: string,
  maxMarks: number,
  questionText?: string,
  options?: string[],
  complexity?: string,
  chapter?: string,
  pool?: boolean
): Promise<{ success: boolean; message: string }> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
    const attemptDoc = await getDoc(attemptRef);
    
    if (!attemptDoc.exists()) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptDoc.data() as StudentExamAttempt;
    
    // Check if response already exists
    const existingResponse = attempt.responses.find(r => r.questionNo === questionNo);
    if (existingResponse) {
      console.log(`⏭️ Response for Q${questionNo} already exists - skipping placeholder creation`);
      return { success: true, message: 'Response already exists' };
    }

    const now = new Date();

    // Create placeholder response
    const placeholderResponse: any = {
      questionId,
      questionNo,
      questionType,
      maxMarks,
      
      // Mark as viewed but NOT answered
      studentAnswer: null,
      viewed: true,
      answered: false,  // ✅ CRITICAL: Not answered yet
      
      violations: [],
      timeSpent: 0,
      attemptCount: 0,
      revisitCount: 0,
      markedForReview: false,
      
      evaluationStatus: EVALUATION_STATUS.NOT_ATTEMPTED,
      evaluatedBy: null,
      evaluationMethod: 'pending',
      evaluatedAt: null,
      
      marksAwarded: 0,
      autoEvaluated: false,
      
      attemptSequence: attempt.responses.filter(r => 
        r.studentAnswer !== null && 
        r.studentAnswer !== undefined && 
        r.studentAnswer !== ''
      ).length + 1,

      firstAttemptedAt: null,
      firstViewedAt: now,
      lastModifiedAt: now,
    };

    // Add optional fields
    if (questionText !== undefined) placeholderResponse.questionText = questionText;
    if (options !== undefined) placeholderResponse.options = options;
    if (complexity !== undefined) placeholderResponse.complexity = complexity;
    if (chapter !== undefined) placeholderResponse.chapter = chapter;
    if (pool !== undefined) placeholderResponse.pool = pool;

    // Add placeholder to responses array
    attempt.responses.push(placeholderResponse as StudentQuestionResponse);

    // 🐛 DEBUG: Check ALL responses for undefined values
    console.log('🐛 DEBUG - Total responses before save:', attempt.responses.length);
    attempt.responses.forEach((r: any, index: number) => {
      const undefinedFields: string[] = [];
      Object.keys(r).forEach(key => {
        if (r[key] === undefined) {
          undefinedFields.push(key);
        }
      });
      if (undefinedFields.length > 0) {
        console.log(`🐛 Response #${index} (Q${r.questionNo}) has undefined fields:`, undefinedFields);
      }
    });

    // Update Firebase
    await updateDoc(attemptRef, {
      responses: attempt.responses,
      updatedAt: now
    });

    console.log(`✅ Placeholder created for Q${questionNo} (viewed but not answered)`);
    
    return { success: true, message: 'Placeholder response created' };
  } catch (error) {
    console.error('❌ Error creating placeholder response:', error);
    throw error;
  }
}
// ==================== TEACHER OVERRIDE ====================

/**
 * Allow teacher to override AI-evaluated marks
 */
async overrideMarks(
  attemptId: string,
  questionNo: number,
  newMarks: number,
  teacherId: string,
  teacherName: string,
  comment?: string
): Promise<{ success: boolean; message: string }> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
    const attemptDoc = await getDoc(attemptRef);
    
    if (!attemptDoc.exists()) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptDoc.data() as StudentExamAttempt;
    const responseIndex = attempt.responses.findIndex(r => r.questionNo === questionNo);
    
    if (responseIndex === -1) {
      throw new Error('Question not found');
    }

    const response = attempt.responses[responseIndex];
    
    // Validate marks
    if (newMarks < 0 || newMarks > response.maxMarks) {
      throw new Error(`Marks must be between 0 and ${response.maxMarks}`);
    }

    // Store original AI marks if not already stored
    if (!(response as any).aiSuggestedMarks && (response as any).evaluatedBy === 'AI') {
      (response as any).aiSuggestedMarks = (response as any).marksAwarded;
    }

    // Update marks
    (response as any).marksAwarded = newMarks;
    (response as any).teacherOverride = true;
    (response as any).teacherOverrideBy = `${teacherId} (${teacherName})`;
    (response as any).teacherOverrideAt = new Date();
    if (comment) {
      (response as any).teacherComment = comment;
    }

    // Update response
    const updateData = deepCleanObject({
      responses: attempt.responses,
      updatedAt: new Date(),
    });

    // ✅ Recalculate total score manually (server-side function removed)
    const allResponses = attempt.responses || [];
    const totalMarks = allResponses.reduce((sum, r) => sum + (r.marksAwarded || 0), 0);
    const maxMarks = allResponses.reduce((sum, r) => sum + (r.maxMarks || 0), 0);
    const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

    await updateDoc(attemptRef, {
      ...updateData,
      totalMarks,
      maxMarks,
      percentage
    });

    console.log(`✅ Marks overridden by ${teacherName} for Q${questionNo}: ${newMarks}/${response.maxMarks}`);
    console.log(`✅ Total score recalculated: ${totalMarks}/${maxMarks} (${percentage}%)`);

    return {
      success: true,
      message: 'Marks updated successfully',
    };

  } catch (error: any) {
    console.error('❌ Error overriding marks:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Manually trigger re-evaluation (for teachers/admins)
 */
async retriggerEvaluation(
  attemptId: string,
  questionNo: number
): Promise<{ success: boolean; message: string }> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
    const attemptDoc = await getDoc(attemptRef);
    
    if (!attemptDoc.exists()) {
      throw new Error('Attempt not found');
    }

    const attempt = attemptDoc.data() as StudentExamAttempt;
    const response = attempt.responses.find(r => r.questionNo === questionNo);
    
    if (!response) {
      throw new Error('Response not found');
    }

    // Get question details
    const questionRef = doc(this.firestore, COLLECTIONS.QUESTION_BANK, response.questionId);
    const questionDoc = await getDoc(questionRef);
    
    if (!questionDoc.exists()) {
      throw new Error('Question not found');
    }



    // Reset evaluation status and retry count
    response.evaluationStatus = EVALUATION_STATUS.PENDING;
    response.evaluationRetries = 0;
    response.evaluationError = undefined;
    response.lastEvaluationAttempt = new Date();

    const updateData = deepCleanObject({
      responses: attempt.responses,
      updatedAt: new Date()
    });

    await updateDoc(attemptRef, updateData);

    // ✅ Individual question re-evaluation removed - call Cloud Function to re-grade entire attempt
    console.log(`🔄 Triggering server-side re-evaluation for entire attempt ${attemptId}...`);
    
    try {
      const functions = getFunctions();
      const submitAndGradeExam = httpsCallable(functions, 'submitAndGradeExam');
      
      await submitAndGradeExam({
        examId: attempt.examId,
        attemptId: attemptId,
        responses: attempt.responses
      });
      
      console.log(`✅ Entire attempt re-graded successfully via Cloud Function`);
      
      return {
        success: true,
        message: 'Entire attempt re-graded successfully by server'
      };
      
    } catch (error: any) {
      console.error('❌ Re-evaluation failed:', error);
      return {
        success: false,
        message: `Re-evaluation failed: ${error.message}`
      };
    }

  } catch (error: any) {
    console.error('❌ Error retriggering evaluation:', error);
    return {
      success: false,
      message: error.message
    };
  }
}


// ==================== REPORT QUERIES ====================
/**
 * Search students by name for a specific exam
 */
async searchStudentsByName(
  examId: string,
  classId: string,
  board: string,
  searchQuery: string
): Promise<any[]> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  const lowerQuery = searchQuery.toLowerCase().trim();
  
  try {
    // Get all attempts for this exam
    const attemptsQuery = query(
      collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
      where('examId', '==', examId),
      where('class', '==', classId),
      where('board', '==', board)
    );
    
    const attemptsSnapshot = await getDocs(attemptsQuery);
    const students: any[] = [];
    
    attemptsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const studentName = (data.studentName || '').toLowerCase();
      const rollNumber = (data.rollNumber || '').toLowerCase();
      
      // Check if name or roll number matches
      if (studentName.includes(lowerQuery) || rollNumber.includes(lowerQuery)) {
        students.push({
          studentId: data.studentId,
          studentName: data.studentName,
          rollNumber: data.rollNumber,
          hasAttempt: true,
          attemptData: {
            obtainedMarks: data.obtainedMarks,
            totalScore: data.totalScore,
            percentage: data.percentage,
            attemptedQuestions: data.attemptedQuestions,
            totalQuestions: data.totalQuestions,
            timeSpent: data.timeSpent,
            violationCount: data.violationCount,
            status: data.status
          }
        });
      }
    });
    
    return students;
  } catch (error) {
    console.error('Error searching students:', error);
    return [];
  }
}

/**
 * Get student's exam attempt with all details
 */
async getStudentAttempt(attemptId: string): Promise<StudentExamAttempt | null> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  const attemptDoc = await getDoc(doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId));
  
  if (!attemptDoc.exists()) return null;
  
  return attemptDoc.data() as StudentExamAttempt;
}

/**
 * Get all attempts for an exam (for class report)
 */
async getExamAttempts(examId: string): Promise<StudentExamAttempt[]> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  const q = query(
    collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
    where('examId', '==', examId),
    orderBy('totalScore', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    
    // ✅ CORRECT: Calculate violationCount from responses array
    let violationCount = 0;
    
    // Priority 1: Check if violationCount already exists in Firestore
    if (typeof data.violationCount === 'number') {
      violationCount = data.violationCount;
    }
    // Priority 2: Check violationSummary.total (if exists)
    else if (data.violationSummary && typeof data.violationSummary.total === 'number') {
      violationCount = data.violationSummary.total;
    }
    // Priority 3: Count from top-level violations array (if exists)
    else if (data.violations && Array.isArray(data.violations)) {
      violationCount = data.violations.length;
    }
    // Priority 4: ✅ Count violations from ALL responses
    else if (data.responses && Array.isArray(data.responses)) {
      violationCount = data.responses.reduce((total: number, response: any) => {
        if (response.violations && Array.isArray(response.violations)) {
          return total + response.violations.length;
        }
        return total;
      }, 0);
    }
    // Default: 0
    else {
      violationCount = 0;
    }
    
    // ✅ ADDED: Calculate timeSpent from responses array (consistent with violations!)
    let calculatedTimeSpent = data.timeSpent || 0;  // Start with existing value as fallback
    
    // If responses exist, sum timeSpent from each response (most accurate)
    if (data.responses && Array.isArray(data.responses)) {
      const summedTime = data.responses.reduce((total: number, response: any) => {
        if (response.timeSpent && typeof response.timeSpent === 'number') {
          return total + response.timeSpent;
        }
        return total;
      }, 0);
      
      // Use summed time if it's greater than 0
      if (summedTime > 0) {
        calculatedTimeSpent = summedTime;
      }
    }
    
    // Return new object with calculated fields included
    return {
      ...data,
      violationCount,  // ✅ Calculated from responses
      timeSpent: calculatedTimeSpent  // ✅ Calculated from responses (like violations!)
    } as StudentExamAttempt;
  });
}

/**
 * Listen to real-time updates for an exam attempt
 * Replaces polling with Firebase realtime listener for better performance
 * @param attemptId - The attempt ID to listen to
 * @param callback - Function called when attempt updates
 * @returns Unsubscribe function to stop listening
 */
listenToAttempt(attemptId: string, callback: (attempt: StudentExamAttempt) => void): () => void {
  if (!this.firestore) throw new Error('Firestore not initialized');
  
  const attemptRef = doc(this.firestore, COLLECTIONS.EXAM_ATTEMPTS, attemptId);
  
  const unsubscribe = onSnapshot(
    attemptRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as StudentExamAttempt;
        
        // Ensure violationCount is set
        if (!(data as any).violationCount && data.violations) {
          (data as any).violationCount = data.violations.length;
        } else if (!(data as any).violationCount) {
          (data as any).violationCount = 0;
        }
        
        callback(data);
      }
    },
    (error) => {
      console.error('❌ Error listening to attempt:', error);
    }
  );
  
  return unsubscribe;
}

/**
 * ==================== LEADERBOARD METHODS ====================
 * These methods fetch and aggregate student performance data for leaderboards
 */

/**
 * Get leaderboard for entire college (all classes, all subjects)
 * 
 * REQUIRED FIRESTORE COMPOSITE INDEX:
 * Collection: examAttempts
 * Fields: collegeId (Ascending), academicYear (Ascending), status (Ascending)
 */
async getCollegeLeaderboard(collegeId: string, academicYear?: string): Promise<LeaderboardStudent[]> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    // Build query based on parameters
    let q;
    if (academicYear && academicYear !== 'all') {
      // Requires composite index: collegeId, academicYear, status
      q = query(
        collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
        where('collegeId', '==', collegeId),
        where('academicYear', '==', academicYear),
        where('status', '==', ATTEMPT_STATUS.SUBMITTED)
      );
    } else {
      // Requires composite index: collegeId, status
      q = query(
        collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
        where('collegeId', '==', collegeId),
        where('status', '==', ATTEMPT_STATUS.SUBMITTED)
      );
    }

    const snapshot = await getDocs(q);
    const attempts = snapshot.docs.map(doc => doc.data() as StudentExamAttempt);

    // Group by student
    const studentMap = new Map<string, {
      userId: string;
      userName: string;
      rollNumber?: string;  // ✅ ADD THIS
      collegeId: string;
      class: string;
      board: string;
      academicYear: string;
      totalExams: number;
      totalMarks: number;
      totalMaxMarks: number;
      scores: number[];
      lastExamDate?: Date;
    }>();

    attempts.forEach(attempt => {
      const key = attempt.studentId;
      
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          userId: attempt.studentId,
          userName: attempt.studentName,
          rollNumber: attempt.rollNumber,  // ✅ ADD THIS
          collegeId: attempt.collegeId,
          class: attempt.class,
          board: attempt.board,
          academicYear: attempt.academicYear,
          totalExams: 0,
          totalMarks: 0,
          totalMaxMarks: 0,
          scores: [],
          lastExamDate: attempt.submitTime || attempt.startTime
        });
      }
      
      const student = studentMap.get(key)!;
      student.totalExams += 1;
      student.totalMarks += attempt.obtainedMarks || 0;
      student.totalMaxMarks += attempt.maximumScore || 0;
      student.scores.push(attempt.percentage || 0);
      
      // Update last exam date if this is more recent
      const examDate = attempt.submitTime || attempt.startTime;
      if (examDate && (!student.lastExamDate || examDate > student.lastExamDate)) {
        student.lastExamDate = examDate;
      }
    });

    // Convert to leaderboard array
    const leaderboard: LeaderboardStudent[] = Array.from(studentMap.values()).map(student => ({
      userId: student.userId,
      userName: student.userName,
      rollNumber: student.rollNumber,  // ✅ ADD THIS
      collegeId: student.collegeId,
      class: student.class,
      board: student.board,
      academicYear: student.academicYear,
      totalExams: student.totalExams,
      totalMarks: student.totalMarks,
      totalMaxMarks: student.totalMaxMarks,
      averagePercentage: student.totalMaxMarks > 0 ? (student.totalMarks / student.totalMaxMarks) * 100 : 0,
      highestScore: student.scores.length > 0 ? Math.max(...student.scores) : 0,
      lowestScore: student.scores.length > 0 ? Math.min(...student.scores) : 0,
      rank: 0,
      lastExamDate: student.lastExamDate
    }));

    // Sort by average percentage (descending) and assign ranks
    leaderboard.sort((a, b) => b.averagePercentage - a.averagePercentage);
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

    return leaderboard;
  } catch (error) {
    console.error('Error fetching college leaderboard:', error);
    throw error;
  }
}

/**
 * Get leaderboard for a specific class
 * 
 * REQUIRED FIRESTORE COMPOSITE INDEX:
 * Collection: examAttempts
 * Fields: collegeId (Ascending), academicYear (Ascending), class (Ascending), status (Ascending)
 */
async getClassLeaderboard(
  collegeId: string, 
  classValue: string, 
  academicYear?: string
): Promise<LeaderboardStudent[]> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    // Build query based on parameters
    let q;
    if (academicYear && academicYear !== 'all') {
      // Requires composite index: collegeId, academicYear, class, status
      q = query(
        collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
        where('collegeId', '==', collegeId),
        where('academicYear', '==', academicYear),
        where('class', '==', classValue),
        where('status', '==', ATTEMPT_STATUS.SUBMITTED)
      );
    } else {
      // Requires composite index: collegeId, class, status
      q = query(
        collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
        where('collegeId', '==', collegeId),
        where('class', '==', classValue),
        where('status', '==', ATTEMPT_STATUS.SUBMITTED)
      );
    }

    const snapshot = await getDocs(q);
    const attempts = snapshot.docs.map(doc => doc.data() as StudentExamAttempt);

    // Group by student (same logic as college leaderboard)
    const studentMap = new Map<string, {
      userId: string;
      userName: string;
      collegeId: string;
      class: string;
      board: string;
      academicYear: string;
      totalExams: number;
      totalMarks: number;
      totalMaxMarks: number;
      scores: number[];
      lastExamDate?: Date;
    }>();

    attempts.forEach(attempt => {
      const key = attempt.studentId;
      
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          userId: attempt.studentId,
          userName: attempt.studentName,
          collegeId: attempt.collegeId,
          class: attempt.class,
          board: attempt.board,
          academicYear: attempt.academicYear,
          totalExams: 0,
          totalMarks: 0,
          totalMaxMarks: 0,
          scores: [],
          lastExamDate: attempt.submitTime || attempt.startTime
        });
      }
      
      const student = studentMap.get(key)!;
      student.totalExams += 1;
      student.totalMarks += attempt.obtainedMarks || 0;
      student.totalMaxMarks += attempt.maximumScore || 0;
      student.scores.push(attempt.percentage || 0);
      
      const examDate = attempt.submitTime || attempt.startTime;
      if (examDate && (!student.lastExamDate || examDate > student.lastExamDate)) {
        student.lastExamDate = examDate;
      }
    });

    // Convert to leaderboard array
    const leaderboard: LeaderboardStudent[] = Array.from(studentMap.values()).map(student => ({
      userId: student.userId,
      userName: student.userName,
      collegeId: student.collegeId,
      class: student.class,
      board: student.board,
      academicYear: student.academicYear,
      totalExams: student.totalExams,
      totalMarks: student.totalMarks,
      totalMaxMarks: student.totalMaxMarks,
      averagePercentage: student.totalMaxMarks > 0 ? (student.totalMarks / student.totalMaxMarks) * 100 : 0,
      highestScore: student.scores.length > 0 ? Math.max(...student.scores) : 0,
      lowestScore: student.scores.length > 0 ? Math.min(...student.scores) : 0,
      rank: 0,
      lastExamDate: student.lastExamDate
    }));

    // Sort by average percentage (descending) and assign ranks
    leaderboard.sort((a, b) => b.averagePercentage - a.averagePercentage);
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

    return leaderboard;
  } catch (error) {
    console.error('Error fetching class leaderboard:', error);
    throw error;
  }
}

/**
 * Get leaderboard for a specific subject
 * 
 * REQUIRED FIRESTORE COMPOSITE INDEX:
 * Collection: examAttempts
 * Fields: collegeId (Ascending), academicYear (Ascending), class (Ascending), subject (Ascending), status (Ascending)
 */
async getSubjectLeaderboard(
  collegeId: string,
  classValue: string,
  subject: string,
  academicYear?: string
): Promise<LeaderboardStudent[]> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    // Build query based on parameters
    let q;
    if (academicYear && academicYear !== 'all') {
      // Requires composite index: collegeId, academicYear, class, subject, status
      q = query(
        collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
        where('collegeId', '==', collegeId),
        where('academicYear', '==', academicYear),
        where('class', '==', classValue),
        where('subject', '==', subject),
        where('status', '==', ATTEMPT_STATUS.SUBMITTED)
      );
    } else {
      // Requires composite index: collegeId, class, subject, status
      q = query(
        collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
        where('collegeId', '==', collegeId),
        where('class', '==', classValue),
        where('subject', '==', subject),
        where('status', '==', ATTEMPT_STATUS.SUBMITTED)
      );
    }

    const snapshot = await getDocs(q);
    const attempts = snapshot.docs.map(doc => doc.data() as StudentExamAttempt);

    // Group by student
    const studentMap = new Map<string, {
      userId: string;
      userName: string;
      collegeId: string;
      class: string;
      board: string;
      academicYear: string;
      subject: string;
      totalExams: number;
      totalMarks: number;
      totalMaxMarks: number;
      scores: number[];
      lastExamDate?: Date;
    }>();

    attempts.forEach(attempt => {
      const key = attempt.studentId;
      
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          userId: attempt.studentId,
          userName: attempt.studentName,
          collegeId: attempt.collegeId,
          class: attempt.class,
          board: attempt.board,
          academicYear: attempt.academicYear,
          subject: attempt.subject,
          totalExams: 0,
          totalMarks: 0,
          totalMaxMarks: 0,
          scores: [],
          lastExamDate: attempt.submitTime || attempt.startTime
        });
      }
      
      const student = studentMap.get(key)!;
      student.totalExams += 1;
      student.totalMarks += attempt.obtainedMarks || 0;
      student.totalMaxMarks += attempt.maximumScore || 0;
      student.scores.push(attempt.percentage || 0);
      
      const examDate = attempt.submitTime || attempt.startTime;
      if (examDate && (!student.lastExamDate || examDate > student.lastExamDate)) {
        student.lastExamDate = examDate;
      }
    });

    // Convert to leaderboard array
    const leaderboard: LeaderboardStudent[] = Array.from(studentMap.values()).map(student => ({
      userId: student.userId,
      userName: student.userName,
      collegeId: student.collegeId,
      class: student.class,
      board: student.board,
      academicYear: student.academicYear,
      subject: student.subject,
      totalExams: student.totalExams,
      totalMarks: student.totalMarks,
      totalMaxMarks: student.totalMaxMarks,
      averagePercentage: student.totalMaxMarks > 0 ? (student.totalMarks / student.totalMaxMarks) * 100 : 0,
      highestScore: student.scores.length > 0 ? Math.max(...student.scores) : 0,
      lowestScore: student.scores.length > 0 ? Math.min(...student.scores) : 0,
      rank: 0,
      lastExamDate: student.lastExamDate
    }));

    // Sort by average percentage (descending) and assign ranks
    leaderboard.sort((a, b) => b.averagePercentage - a.averagePercentage);
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

    return leaderboard;
  } catch (error) {
    console.error('Error fetching subject leaderboard:', error);
    throw error;
  }
}

/**
 * Get comprehensive leaderboard with filters
 * This is a unified method that calls appropriate specific methods based on filters
 */
async getLeaderboard(
  collegeId: string,
  filters: {
    academicYear?: string;
    class?: string;
    subject?: string;
  }
): Promise<LeaderboardStudent[]> {
  const { academicYear, class: classValue, subject } = filters;

  // Determine which method to call based on filters
  if (subject && subject !== 'all' && classValue && classValue !== 'all') {
    // Subject-specific leaderboard (most specific)
    return this.getSubjectLeaderboard(collegeId, classValue, subject, academicYear);
  } else if (classValue && classValue !== 'all') {
    // Class-specific leaderboard
    return this.getClassLeaderboard(collegeId, classValue, academicYear);
  } else {
    // College-wide leaderboard
    return this.getCollegeLeaderboard(collegeId, academicYear);
  }
}

/**
 * Get student's rank in the leaderboard
 */
async getStudentRank(
  collegeId: string,
  studentId: string,
  filters: {
    academicYear?: string;
    class?: string;
    subject?: string;
  }
): Promise<{
  rank: number;
  totalStudents: number;
  studentData: LeaderboardStudent | null;
}> {
  const leaderboard = await this.getLeaderboard(collegeId, filters);
  const studentData = leaderboard.find(s => s.userId === studentId);
  
  return {
    rank: studentData?.rank || 0,
    totalStudents: leaderboard.length,
    studentData: studentData || null
  };
}

/**
 * Get student's all attempts (for student history)
 */
async getStudentAttempts(studentId: string, collegeId?: string): Promise<StudentExamAttempt[]> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  let q;
  if (collegeId) {
    q = query(
      collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
      where('studentId', '==', studentId),
      where('collegeId', '==', collegeId),
      orderBy('startTime', 'desc')
    );
  } else {
    q = query(
      collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
      where('studentId', '==', studentId),
      orderBy('startTime', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as StudentExamAttempt);
}

/**
 * Generate class analytics for an exam
 */
async generateClassAnalytics(examId: string, classId: string): Promise<ExamClassAnalytics> {
  const attempts = await this.getExamAttempts(examId);
  const classAttempts = attempts.filter(a => a.class === classId);

  if (classAttempts.length === 0) {
    throw new Error('No attempts found for this class');
  }

  // Get exam info from first attempt
  const firstAttempt = classAttempts[0];

  // Calculate statistics
  const scores = classAttempts.map(a => a.totalScore);
  
  const stats = this.calculateStatistics(scores);
  
  // Score distribution
  const distribution = {
    '90-100': 0,
    '80-89': 0,
    '70-79': 0,
    '60-69': 0,
    '50-59': 0,
    'below-50': 0,
  };

  for (const attempt of classAttempts) {
    const percentage = attempt.percentage;
    if (percentage >= 90) distribution['90-100']++;
    else if (percentage >= 80) distribution['80-89']++;
    else if (percentage >= 70) distribution['70-79']++;
    else if (percentage >= 60) distribution['60-69']++;
    else if (percentage >= 50) distribution['50-59']++;
    else distribution['below-50']++;
  }

  // Performance by type, chapter, etc.
  const performanceByType: any = {};
  const performanceByChapter: any = {};

  // Aggregate performance data
  for (const attempt of classAttempts) {
    // By type
    for (const [type, perf] of Object.entries(attempt.performanceByType || {})) {
      if (!performanceByType[type]) {
        performanceByType[type] = { totalScore: 0, maxScore: 0, attemptedBy: 0 };
      }
      performanceByType[type].totalScore += (perf as any).score;
      performanceByType[type].maxScore += (perf as any).maxScore;
      performanceByType[type].attemptedBy++;
    }

    // By chapter
    for (const [chapter, perf] of Object.entries(attempt.performanceByChapter || {})) {
      if (!performanceByChapter[chapter]) {
        performanceByChapter[chapter] = { totalScore: 0, maxScore: 0, attempts: 0 };
      }
      performanceByChapter[chapter].totalScore += (perf as any).score;
      performanceByChapter[chapter].maxScore += (perf as any).maxScore;
      performanceByChapter[chapter].attempts++;
    }
  }

  // Calculate averages
  for (const type in performanceByType) {
    const data = performanceByType[type];
    performanceByType[type] = {
      averageScore: data.totalScore / data.attemptedBy,
      successRate: (data.totalScore / data.maxScore) * 100,
      attemptedBy: data.attemptedBy,
    };
  }

  for (const chapter in performanceByChapter) {
    const data = performanceByChapter[chapter];
    performanceByChapter[chapter] = {
      averageScore: data.totalScore / data.attempts,
      maxScore: data.maxScore / data.attempts,
      successRate: (data.totalScore / data.maxScore) * 100,
    };
  }

  // Violations summary - calculate from question-level data
  let totalViolations = 0;
  let criticalViolations = 0;
  let studentsWithViolations = 0;

  for (const attempt of classAttempts) {
    // ✅ Calculate violations from responses (question-level)
    const attemptViolations = attempt.responses?.flatMap(r => r.violations || []) || [];
    totalViolations += attemptViolations.length;
    criticalViolations += attemptViolations.filter(v => 
      v.severity === 'critical' || v.severity === 'high'
    ).length;
    if (attemptViolations.length > 0) studentsWithViolations++;
  }

  const analytics: ExamClassAnalytics = {
    analyticsId: `${examId}_${classId}_${Date.now()}`,
    examId,
    collegeId: firstAttempt.collegeId || DEFAULT_COLLEGE_ID,
    class: classId, 
    
    totalStudents: classAttempts.length,
    totalAttempts: classAttempts.length,
    completedAttempts: classAttempts.filter(a => a.status === ATTEMPT_STATUS.SUBMITTED || a.status === ATTEMPT_STATUS.AUTO_SUBMITTED).length,
    
    averageScore: stats.mean,
    medianScore: stats.median,
    highestScore: stats.max,
    lowestScore: stats.min,
    standardDeviation: stats.stdDev,
    
    generatedAt: new Date()
  };

  return analytics;
}

/**
 * Calculate statistical measures
 */
private calculateStatistics(numbers: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
} {
  const sorted = [...numbers].sort((a, b) => a - b);
  const n = sorted.length;
  
  const mean = sorted.reduce((sum, val) => sum + val, 0) / n;
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[n - 1],
    stdDev,
  };
}

// ==================== END OF SERVICE METHODS ====================

  // Singleton pattern
  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }
  
  // Initialize Firebase
  initialize(firebaseConfig: any): void {
    if (this.app) {
      console.log('Firebase already initialized');
      return;
    }

    
    try {
      this.app = initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      this.firestore = getFirestore(this.app);
      this.storage = getStorage(this.app);
      this.functions = getFunctions(this.app);
      console.log('✅ Functions initialized');
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      throw error;
    }
  }
  

  
  // Check if Firebase is initialized and ready
  isInitialized(): boolean {
    return !!(this.app && this.auth && this.firestore && this.storage);
  }
  
  // Get current user
  getCurrentUser(): User | null {
    return this.auth?.currentUser || null;
  }
  
  // Get current user ID
  getCurrentUserId(): string | null {
    return this.auth?.currentUser?.uid || null;
  }
  
  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    if (!this.auth) throw new Error('Firebase not initialized');
    return onAuthStateChanged(this.auth, callback);
  }
  

  private async sendWelcomeEmail(
  email: string,
  name: string,
  password: string,
  userType: string,
  collegeId?: string
): Promise<void> {
  try {
    if (!this.functions) {
      console.warn('⚠️ Firebase Functions not initialized, skipping email');
      return;
    }

    console.log('📧 Calling Cloud Function to send welcome email...');
    
    const sendWelcomeEmailFn = httpsCallable(this.functions, 'sendWelcomeEmail');
    
    const result = await sendWelcomeEmailFn({
      email,
      name,
      password,
      userType,
      collegeId,
    });

    const response = result.data as any;
    
    if (response.success) {
      console.log('✅ Welcome email sent successfully to:', email);
    } else {
      console.warn('⚠️ Email sending failed:', response.message);
    }
  } catch (error: any) {
    console.error('❌ Error calling sendWelcomeEmail function:', error);
  }
}

  /**
   * Fetch GEO API key from Firestore settings
   * Caches the key after first fetch for better performance
   */
  private async getGeoApiKey(): Promise<string | null> {
    try {
      // Return cached key if available
      if (this.geoApiKey) {
        return this.geoApiKey;
      }

      if (!this.firestore) {
        console.warn('⚠️ Firebase not initialized, using free API');
        return null;
      }

      // Fetch from Firestore settings document
      const settingsDoc = await getDoc(doc(this.firestore, COLLECTIONS.SETTINGS, 'api_keys'));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        this.geoApiKey = data.geoApiKey || null;
        
        if (this.geoApiKey) {
          console.log('✅ GEO API key loaded from Firestore');
        } else {
          console.warn('⚠️ GEO API key not found in settings, using free API');
        }
        
        return this.geoApiKey;
      } else {
        console.warn('⚠️ Settings document not found, using free API');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error fetching GEO API key:', error);
      return null;
    }
  }

  /**
   * Fetch IP information using pro.ip-api.com (with API key) or fallback to free version
   */
  private async fetchIPInfo(): Promise<LoginIPInfo | null> {
    try {
      // Get API key from Firestore
      const apiKey = await this.getGeoApiKey();
      
      let apiUrl: string;
      let fields = 'status,message,country,countryCode,region,city,lat,lon,timezone,isp,org,as,query';
      
      if (apiKey) {
        // Use PRO API with key
        apiUrl = `${this.geoApiUrl}?key=${apiKey}&fields=${fields}`;
        console.log('🌐 Using PRO Geo API');
      } else {
        // Fallback to free API
        apiUrl = `http://ip-api.com/json/?fields=${fields}`;
        console.log('🌐 Using FREE Geo API');
      }
      
      // Get IP and geolocation data
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch IP information');
      }
      
      const data = await response.json();
      
      if (data.status === 'fail') {
        console.error('IP API error:', data.message);
        return null;
      }
      
      // Get user agent and device information
      const userAgent = navigator.userAgent;
      const deviceType = this.detectDeviceType(userAgent);
      
      return {
        ip: data.query,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'Unknown',
        latitude: data.lat || 0,
        longitude: data.lon || 0,
        timezone: data.timezone || 'Unknown',
        isp: data.isp || 'Unknown',
        org: data.org || 'Unknown',
        asn: data.as || 'Unknown',
        loginTimestamp: new Date(),
        userAgent: userAgent,
        deviceType: deviceType
      };
      
    } catch (error) {
      console.error('Error fetching IP info:', error);
      return null;
    }
  }
  
  /**
   * Detect device type from user agent
   */
  private detectDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'Mobile';
    }
    return 'Desktop';
  }


  // ==================== AUTHENTICATION ====================
  
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      if (!this.auth || !this.firestore) {
        throw new Error('Firebase not initialized');
      }
      
      // Sign in with Firebase Auth
      const userCredential: UserCredential = await signInWithEmailAndPassword(
        this.auth, 
        email, 
        password
      );
      
      const userId = userCredential.user.uid;
      
      // Fetch user profile from Firestore
      const userDoc = await getDoc(doc(this.firestore, COLLECTIONS.USERS, userId));
      
      if (!userDoc.exists()) {
        console.warn('⚠️ User exists in Auth but not in Firestore. Creating profile...');
        
        // Get email from Firebase Auth user
        const authUser = userCredential.user;
        const userEmail = authUser.email || '';
        
        // Create basic user profile in Firestore
        const basicUserData = {
          userId: userId,
          fullName: userEmail.split('@')[0] || 'User',
          email: userEmail.toLowerCase(),
          phone: '',
          phoneRaw: '',
          userType: 'student', // Default to student
          collegeId: 'default',
          board: 'Not Specified',
          status: USER_STATUS.ACTIVE,
          createdBy: 'auto-system',
          permissions: this.getPermissions('student'),
          
          // Security fields
          mustChangePassword: true,
          firstLogin: true,
          passwordChangedAt: null,
          temporaryPassword: false,
          accountLocked: false,
          failedLoginAttempts: 0,
          lastLoginAt: null,
          
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        try {
          // Create the user document
          await setDoc(doc(this.firestore, COLLECTIONS.USERS, userId), basicUserData);
          console.log('✅ User profile created in Firestore');
          
          // Now fetch the newly created document
          const newUserDoc = await getDoc(doc(this.firestore, COLLECTIONS.USERS, userId));
          if (!newUserDoc.exists()) {
            throw new Error('Failed to create user profile');
          }
          
          // Continue with login using the new profile
          const userData = this.parseUserFromFirestore(newUserDoc);
          
          return {
            success: true,
            user: userData,
            requiresPasswordChange: true // Force password change for auto-created users
          };
          
        } catch (createError) {
          console.error('❌ Failed to create user profile:', createError);
          await this.signOut();
          return { 
            success: false, 
            error: 'Failed to create user profile. Please contact administrator.' 
          };
        }
      }
      
      const userData = this.parseUserFromFirestore(userDoc);
      
      // Check if account is locked
      if (userData.accountLocked) {
        await this.signOut();
        return { 
          success: false, 
          error: 'Account is locked. Please contact administrator.' 
        };
      }
      
      // Check if account is inactive
      if (userData.status !== USER_STATUS.ACTIVE) {
        await this.signOut();
        return { 
          success: false, 
          error: 'Account is not active. Please contact administrator.' 
        };
      }
      
      // Fetch IP information
      const ipInfo = await this.fetchIPInfo();
      
      // Prepare login history entry
      const loginHistoryEntry = ipInfo ? {
        ...ipInfo,
        loginTimestamp: new Date()
      } : null;
      
      // Update last login with IP information
      const updateData: any = {
        lastLoginAt: serverTimestamp(),
        failedLoginAttempts: 0,
        firstLogin: false
      };
      
      if (ipInfo) {
        updateData.lastLoginIP = ipInfo;
        
        // Add to login history (keep last 50 entries)
        const userDocData = userDoc.data();
        const currentHistory = userDocData.loginHistory || [];
        const updatedHistory = [loginHistoryEntry, ...currentHistory].slice(0, 50);
        updateData.loginHistory = updatedHistory;
        
        console.log('📍 Login from:', ipInfo.city, ipInfo.region, ipInfo.country);
        console.log('🌐 ISP:', ipInfo.isp);
        console.log('💻 Device:', ipInfo.deviceType);
      }
      
      await updateDoc(doc(this.firestore, COLLECTIONS.USERS, userId), updateData);
      
      userData.lastLoginAt = new Date();
      userData.failedLoginAttempts = 0;
      userData.firstLogin = false;
      if (ipInfo) {
        userData.lastLoginIP = ipInfo;
      }
      
      // Check if password change is required
      if (userData.mustChangePassword) {
        return {
          success: true,
          user: userData,
          requiresPasswordChange: true
        };
      }
      
      return {
        success: true,
        user: userData
      };
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      if (!this.auth) throw new Error('Firebase not initialized');
      await firebaseSignOut(this.auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
  
  /**
   * Change password
   */
  async changePassword(
    currentPassword: string, 
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.auth || !this.firestore) {
        throw new Error('Firebase not initialized');
      }
      
      const user = this.getCurrentUser();
      if (!user || !user.email) {
        throw new Error('No user logged in');
      }
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      // Update user document
      await updateDoc(doc(this.firestore, COLLECTIONS.USERS, user.uid), {
        mustChangePassword: false,
        temporaryPassword: false,
        passwordChangedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Change password error:', error);
      let errorMessage = 'Failed to change password';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      }
      
      return { success: false, error: errorMessage };
    }
  }
  
  // ==================== USER MANAGEMENT ====================
  
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserModel | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return null; // Return null to match UserModel | null return type
      }
      
      if (!this.firestore) throw new Error('Firestore not initialized');
      const userDoc = await getDoc(doc(this.firestore, COLLECTIONS.USERS, userId));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      return this.parseUserFromFirestore(userDoc);
      
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }
  
  /**
   * Get current user profile
   */
  async getCurrentUserProfile(): Promise<UserModel | null> {
    const userId = this.getCurrentUserId();
    if (!userId) return null;
    return this.getUserProfile(userId);
  }
  

  /**
   * Get user details by userId
   */
  async getUserDetails(userId: string): Promise<UserModel | null> {
    try {
      if (!this.firestore) throw new Error('Firebase not initialized');

      const userDoc = await getDoc(doc(this.firestore, COLLECTIONS.USERS, userId));
      
      if (!userDoc.exists()) {
        console.warn('⚠️ User not found:', userId);
        return null;
      }

      const userData = userDoc.data();
      
      // Convert Firestore Timestamps to Dates
      return {
        ...userData,
        createdAt: userData.createdAt?.toDate() || null,
        updatedAt: userData.updatedAt?.toDate() || null
      } as UserModel;
      
    } catch (error) {
      console.error('❌ Error fetching user details:', error);
      throw error;
    }
  }
  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string, 
    updates: Partial<UserModel>,
    currentUser: UserModel
  ): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return false to match boolean return type
      }
      
      if (!this.firestore) throw new Error('Firestore not initialized');
      
      // Remove undefined values
      const cleanUpdates: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      });
      
      cleanUpdates.updatedAt = serverTimestamp();
      
      if (!this.firestore) throw new Error('Firestore not initialized');
      await updateDoc(doc(this.firestore, COLLECTIONS.USERS, userId), cleanUpdates);
      
      // Log activity (non-blocking - won't affect user update)
      try {
        await this.addActivityLog({
          userId: currentUser.userId,
          collegeId: currentUser.collegeId,
          action: 'update_user',
          entityType: 'user',
          entityId: userId,
          details: JSON.stringify({
            changedFields: Object.keys(cleanUpdates).filter(k => k !== 'updatedAt'),
            fullName: cleanUpdates.fullName,
            userType: cleanUpdates.userType
          })
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log user update (non-critical):', logError);
      }
      
      return true;
      
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Upload profile picture to Firebase Storage
   * Stores in: profile_pictures/{userId}/profile_{timestamp}.jpg
   * @param file - Image file to upload
   * @param userId - User ID (optional, uses current user if not provided)
   * @returns Download URL of uploaded image
   */
  async uploadProfilePicture(file: File, userId?: string): Promise<string | null> {
    try {
      const currentUser = this.getCurrentUser();
      const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      if (!this.storage) {
        throw new Error('Firebase Storage not initialized');
      }

      console.log('📤 Starting profile picture upload...');

      // Use the actual filename passed from the component
      // This allows for standardized names like 'profile_picture.jpg', 'proctoring_front.jpg', etc.
      const fileName = file.name;
      const path = `profile_pictures/${targetUserId}/${fileName}`;

      console.log('📍 Upload path:', path);

      // Get storage reference
      const storageRef = ref(this.storage, path);

      // Upload with metadata
      const metadata = {
        contentType: file.type || 'image/jpeg',
        customMetadata: {
          userId: targetUserId,
          uploadedAt: new Date().toISOString(),
        },
      };

      console.log('📤 Uploading to Firebase Storage...');
      await uploadBytes(storageRef, file, metadata);
      console.log('✅ Upload complete');

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);
      console.log('✅ Download URL obtained');
      console.log('✅ URL:', downloadUrl);

      return downloadUrl;
    } catch (error) {
      console.error('❌ Error uploading profile picture:', error);
      return null;
    }
  }

 /**
   * Update profile picture URL in Firestore user document
   */
  async updateProfilePictureUrl(imageUrl: string, userId?: string): Promise<boolean> {
    try {
      const currentUser = this.getCurrentUser();
      const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      if (!this.firestore) throw new Error('Firestore not initialized');
      await updateDoc(doc(this.firestore, COLLECTIONS.USERS, targetUserId), {
        profilePicture: imageUrl,
        updatedAt: serverTimestamp(),
      });

      console.log('✅ Profile picture URL updated in Firestore');
      return true;
    } catch (error) {
      console.error('❌ Error updating profile picture URL:', error);
      return false;
    }
  }

  async removeProfilePicture(userId?: string): Promise<boolean> {
    try {
      const currentUser = this.getCurrentUser();
      const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      if (!this.firestore) throw new Error('Firestore not initialized');

      console.log('🗑️ Removing profile picture...');

      const userDoc = await getDoc(doc(this.firestore, COLLECTIONS.USERS, targetUserId));
      const userData = userDoc.data();
      const profilePictureUrl = userData?.profilePictureUrl;

      if (profilePictureUrl && this.storage) {
        try {
          const storageRef = ref(this.storage, profilePictureUrl);
          await deleteObject(storageRef);
          console.log('✅ Deleted profile picture from storage');
        } catch (error) {
          console.warn('⚠️ Error deleting from storage:', error);
        }
      }

      if (!this.firestore) throw new Error('Firestore not initialized');
      await updateDoc(doc(this.firestore, COLLECTIONS.USERS, targetUserId), {
        profilePictureUrl: deleteField(),
        updatedAt: serverTimestamp(),
      });

      console.log('✅ Profile picture removed from Firestore');
      return true;
    } catch (error) {
      console.error('❌ Error removing profile picture:', error);
      return false;
    }
  }
  
  /**
   * Upload and update profile picture (convenience method)
   * Combines upload + update Firestore URL in one call
   * @param file - Image file to upload
   * @param userId - User ID (optional, uses current user if not provided)
   * @returns Download URL of uploaded image, or null on failure
   */
  async uploadAndUpdateProfilePicture(file: File, userId?: string): Promise<string | null> {
    try {
      const currentUser = this.getCurrentUser();
const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      // Upload to Storage
      const downloadUrl = await this.uploadProfilePicture(file, targetUserId);
      if (!downloadUrl) {
        throw new Error('Failed to upload profile picture');
      }

      // Update Firestore
      const success = await this.updateProfilePictureUrl(downloadUrl, targetUserId);
      if (!success) {
        throw new Error('Failed to update profile picture URL');
      }

      console.log('✅ Profile picture uploaded and updated successfully');
      return downloadUrl;
    } catch (error) {
      console.error('❌ Error in uploadAndUpdateProfilePicture:', error);
      return null;
    }
  }
  
  /**
   * Get users by type
   */
  async getUsersByType(userType: UserType, collegeId?: string): Promise<UserModel[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      let usersQuery = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('userType', '==', userType),
        where('status', '==', USER_STATUS.ACTIVE)
      );
      
      if (collegeId) {
        usersQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          where('userType', '==', userType),
          where('collegeId', '==', collegeId),
          where('status', '==', USER_STATUS.ACTIVE)
        );
      }
      
      const snapshot = await getDocs(usersQuery);
      return snapshot.docs.map(doc => this.parseUserFromFirestore(doc));
      
    } catch (error) {
      console.error('Error fetching users by type:', error);
      return [];
    }
  }

  /**
   * Get all users for a specific college (all roles)
   */
  async getAllUsers(collegeId: string): Promise<UserModel[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      const usersQuery = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('collegeId', '==', collegeId),
        where('status', '==', USER_STATUS.ACTIVE)
      );
      
      const snapshot = await getDocs(usersQuery);
      return snapshot.docs.map(doc => this.parseUserFromFirestore(doc));
      
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }

  /**
   * Get count of all users for a specific college
   */
  async getUsersCount(collegeId: string): Promise<number> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return 0; // Return empty string instead of throwing error
      }
      
      const usersQuery = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('collegeId', '==', collegeId),
        where('status', '==', USER_STATUS.ACTIVE)
      );
      
      const snapshot = await getDocs(usersQuery);
      return snapshot.size;
      
    } catch (error) {
      console.error('Error fetching users count:', error);
      return 0;
    }
  }

  /**
   * Get paginated users by type (for administrative view)
   * NOTE: Fetches all administrative users and paginates in memory.
   * This is reasonable as admin/principal/dean counts are typically small.
   */
  async getUsersByTypePaginated(
    userTypes: UserType[],
    collegeId: string,
    pageSize: number = 10,
    currentPage: number = 1,
    roleFilter: 'all' | 'admin' | 'principal' | 'dean' | 'teacher' = 'all'
  ): Promise<PaginatedUsersResult> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return {
          users: [],
          lastDoc: null,
          hasMore: false,
          total: 0
        };
      }
      
      // Filter userTypes based on roleFilter
      const typesToFetch = roleFilter === 'all' 
        ? userTypes 
        : userTypes.filter(type => type === roleFilter);
      
      // Fetch users for each type and combine
      const allUsers: UserModel[] = [];
      
      for (const userType of typesToFetch) {
        let usersQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          where('userType', '==', userType),
          where('collegeId', '==', collegeId),
          // Removed status filter - let client handle filtering by status
          orderBy('fullName'),
          limit(500) // Reasonable limit per type
        );
        
        const snapshot = await getDocs(usersQuery);
        const users = snapshot.docs.map(doc => this.parseUserFromFirestore(doc));
        allUsers.push(...users);
      }
      
      // Sort all users by role hierarchy then name
      allUsers.sort((a, b) => {
        const roleOrder: Record<string, number> = {
          'admin': 1,
          'principal': 2,
          'dean': 3,
          'teacher': 4
        };
        const aOrder = roleOrder[a.userType] || 999;
        const bOrder = roleOrder[b.userType] || 999;
        
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.fullName || '').localeCompare(b.fullName || '');
      });
      
      // Calculate pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedUsers = allUsers.slice(startIndex, endIndex);
      const hasMore = endIndex < allUsers.length;
      
      return {
        users: paginatedUsers,
        lastDoc: null,
        hasMore,
        total: allUsers.length
      };
      
    } catch (error) {
      console.error('Error fetching paginated users by type:', error);
      return { users: [], lastDoc: null, hasMore: false, total: 0 };
    }
  }

  /**
   * Get paginated users by class, board, and academic year
   * NOTE: This implementation fetches all matching users and paginates in memory
   * due to Firestore's limitations with complex queries across multiple user types.
   * For truly large datasets (10000+), consider restructuring data model.
   */
  async getUsersByClassPaginated(
    className: string,
    board: string | null,
    academicYear: string | null,
    collegeId: string,
    pageSize: number = 10,
    currentPage: number = 1,
    roleFilter: 'all' | 'student' | 'teacher' = 'all'
  ): Promise<PaginatedUsersResult> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return {
          users: [],
          lastDoc: null,
          hasMore: false,
          total: 0
        };
      }
      
      let allUsers: UserModel[] = [];
      
      // Fetch based on role filter
      if (roleFilter === 'all' || roleFilter === 'student') {
        // Build query for students
        let studentQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          where('userType', '==', USER_TYPES.STUDENT),
          where('collegeId', '==', collegeId),
          where('studentClass', '==', className),
          // Removed status filter - let client handle filtering by status
          orderBy('fullName'),
          limit(1000)
        );
        
        if (board) {
          studentQuery = query(
            collection(this.firestore, COLLECTIONS.USERS),
            where('userType', '==', USER_TYPES.STUDENT),
            where('collegeId', '==', collegeId),
            where('studentClass', '==', className),
            where('board', '==', board),
            // Removed status filter - let client handle filtering by status
            orderBy('fullName'),
            limit(1000)
          );
        }
        
        const studentSnapshot = await getDocs(studentQuery);
        let students = studentSnapshot.docs.map(doc => this.parseUserFromFirestore(doc));
        
        // Filter by academic year if provided
        if (academicYear) {
          students = students.filter(s => s.academicYear === academicYear);
        }
        
        allUsers = [...students];
      }
      
      if (roleFilter === 'all' || roleFilter === 'teacher') {
        // Build query for teachers
        const teacherQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          where('userType', '==', USER_TYPES.TEACHER),
          where('collegeId', '==', collegeId),
          // Removed status filter - let client handle filtering by status
          orderBy('fullName'),
          limit(100)
        );
        
        const teacherSnapshot = await getDocs(teacherQuery);
        const allTeachers = teacherSnapshot.docs.map(doc => this.parseUserFromFirestore(doc));
        
        // Filter teachers who teach this class
        const teachers = allTeachers.filter(t => {
          const teacherClasses = t.teacherClasses || [];
          return teacherClasses.includes(className);
        });
        
        // If showing all, teachers go first; otherwise just teachers
        allUsers = roleFilter === 'all' ? [...teachers, ...allUsers] : teachers;
      }
      
      // Calculate pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedUsers = allUsers.slice(startIndex, endIndex);
      const hasMore = endIndex < allUsers.length;
      
      return {
        users: paginatedUsers,
        lastDoc: null,
        hasMore,
        total: allUsers.length
      };
      
    } catch (error) {
      console.error('Error fetching paginated users by class:', error);
      return { users: [], lastDoc: null, hasMore: false, total: 0 };
    }
  }
  
  /**
   * Get all students in a specific class (non-paginated, for attendance)
   */
  async getStudentsByClass(
    className: string,
    collegeId: string,
    board?: string,
    academicYear?: string
  ): Promise<UserModel[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty array
      }
      
      // Build base query for students
      let studentQuery = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('userType', '==', USER_TYPES.STUDENT),
        where('collegeId', '==', collegeId),
        where('studentClass', '==', className),
        where('status', '==', USER_STATUS.ACTIVE),
        orderBy('studentRoll')
      );
      
      // Add board filter if provided
      if (board) {
        studentQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          where('userType', '==', USER_TYPES.STUDENT),
          where('collegeId', '==', collegeId),
          where('studentClass', '==', className),
          where('board', '==', board),
          where('status', '==', USER_STATUS.ACTIVE),
          orderBy('studentRoll')
        );
      }
      
      const snapshot = await getDocs(studentQuery);
      let students = snapshot.docs.map(doc => this.parseUserFromFirestore(doc));
      
      // Filter by academic year if provided
      if (academicYear) {
        students = students.filter(s => s.academicYear === academicYear);
      }
      
      return students;
      
    } catch (error) {
      console.error('Error fetching students by class:', error);
      return [];
    }
  }
  
  /**
   * Get students for an exam with pagination (database-level)
   */
  async getStudentsByExamPaginated(
    examId: string,
    pageSize: number = 4,
    lastDoc: DocumentSnapshot | null = null
  ): Promise<{
    students: UserModel[];
    lastDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return { students: [], lastDoc: null, hasMore: false }; // Return proper object
      }
      
      // First, get the exam to know which class/college to query
      const examDoc = await getDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId));
      if (!examDoc.exists()) {
        console.error('❌ Exam not found with ID:', examId);
        return { students: [], lastDoc: null, hasMore: false };
      }
      
      const examData = examDoc.data();
      const className = examData.class;
      const collegeId = examData.collegeId;
      const board = examData.board;
      const academicYear = examData.year || examData.academicYear; // Support both field names
      
      console.log('📚 Exam Details:');
      console.log('  - Exam ID:', examId);
      console.log('  - Class:', className);
      console.log('  - College ID:', collegeId);
      console.log('  - Board:', board);
      console.log('  - Academic Year:', academicYear);
      
      // Validate required fields
      if (!className) {
        console.error('❌ Exam missing "class" field');
        return { students: [], lastDoc: null, hasMore: false };
      }
      if (!collegeId) {
        console.error('❌ Exam missing "collegeId" field');
        return { students: [], lastDoc: null, hasMore: false };
      }
      
      console.log('🔍 Searching for students with:');
      console.log('  - userType: student');
      console.log('  - collegeId:', collegeId);
      console.log('  - studentClass:', className);
      console.log('  - board:', board || '(any)');
      console.log('  - academicYear:', academicYear || '(any)');
      console.log('  - status: active');
      
      // Build paginated query dynamically
      let studentQuery;
      
      // Build where clauses dynamically
      const buildWhereClause = () => {
        const clauses: any[] = [
          where('userType', '==', USER_TYPES.STUDENT),
          where('collegeId', '==', collegeId),
          where('studentClass', '==', className),
          where('status', '==', USER_STATUS.ACTIVE)
        ];
        
        // Add optional filters
        if (board) {
          clauses.push(where('board', '==', board));
        }
        if (academicYear) {
          clauses.push(where('academicYear', '==', academicYear));
        }
        
        return clauses;
      };
      
      // Build query with or without pagination
      if (lastDoc) {
        studentQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          ...buildWhereClause(),
          orderBy('studentRoll'),
          startAfter(lastDoc),
          limit(pageSize)
        );
      } else {
        studentQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          ...buildWhereClause(),
          orderBy('studentRoll'),
          limit(pageSize)
        );
      }
      
      console.log('⏳ Executing Firestore query...');
      const snapshot = await getDocs(studentQuery);
      const students = snapshot.docs.map(doc => this.parseUserFromFirestore(doc));
      
      console.log(`✅ Query returned ${students.length} students`);
      
      if (students.length > 0) {
        console.log('📋 Sample student data:');
        console.log('  - Name:', students[0].fullName);
        console.log('  - Roll:', students[0].studentRoll);
        console.log('  - Class:', students[0].studentClass);
        console.log('  - Board:', students[0].board);
        console.log('  - Status:', students[0].status);
      }
      
      // Get the last document for next pagination
      const newLastDoc = snapshot.docs.length > 0 
        ? snapshot.docs[snapshot.docs.length - 1] 
        : null;
      
      // Check if there are more students
      let hasMore = false;
      if (newLastDoc) {
        // Build same where clauses for check query
        const checkClauses: any[] = [
          where('userType', '==', USER_TYPES.STUDENT),
          where('collegeId', '==', collegeId),
          where('studentClass', '==', className),
          where('status', '==', USER_STATUS.ACTIVE)
        ];
        
        if (board) {
          checkClauses.push(where('board', '==', board));
        }
        if (academicYear) {
          checkClauses.push(where('academicYear', '==', academicYear));
        }
        
        const checkQuery = query(
          collection(this.firestore, COLLECTIONS.USERS),
          ...checkClauses,
          orderBy('studentRoll'),
          startAfter(newLastDoc),
          limit(1)
        );
        
        const checkSnapshot = await getDocs(checkQuery);
        hasMore = !checkSnapshot.empty;
      }
      
      console.log(`✅ Fetched ${students.length} students, hasMore: ${hasMore}`);
      
      return {
        students,
        lastDoc: newLastDoc,
        hasMore
      };
      
    } catch (error) {
      console.error('❌ Error fetching paginated students by exam:', error);
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      return { students: [], lastDoc: null, hasMore: false };
    }
  }
  
  /**
   * DEBUG HELPER: Manually check all students in a college/class
   * Call this from browser console to diagnose student fetch issues
   * Usage: await firebaseService.debugStudentsForClass('chaitanaya_hyderabad', '10th', 'CBSE');
   */
  async debugStudentsForClass(
    collegeId: string,
    className: string,
    board?: string
  ): Promise<void> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return ; // Return empty string instead of throwing error
      }
      
      console.log('🐛 DEBUG: Checking students in Firestore');
      console.log('==========================================');
      console.log('Search Parameters:');
      console.log('  - College ID:', collegeId);
      console.log('  - Class:', className);
      console.log('  - Board:', board || '(any)');
      console.log('');
      
      // Query all students without status filter first
      const allStudentsQuery = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('userType', '==', USER_TYPES.STUDENT),
        where('collegeId', '==', collegeId),
        where('studentClass', '==', className)
      );
      
      console.log('⏳ Querying all students (no status filter)...');
      const allSnapshot = await getDocs(allStudentsQuery);
      console.log(`📊 Found ${allSnapshot.size} total students`);
      console.log('');
      
      if (allSnapshot.size === 0) {
        console.log('❌ NO STUDENTS FOUND!');
        console.log('');
        console.log('Possible reasons:');
        console.log('  1. No students exist in this college/class');
        console.log('  2. collegeId mismatch - check exact spelling');
        console.log('  3. studentClass mismatch - check exact value');
        console.log('');
        console.log('Try this query in Firebase Console:');
        console.log(`  Collection: users`);
        console.log(`  Filter: userType == "student"`);
        console.log(`  Filter: collegeId == "${collegeId}"`);
        console.log(`  Filter: studentClass == "${className}"`);
        return;
      }
      
      // Analyze each student
      console.log('📋 Student Analysis:');
      console.log('----------------------------------------');
      
      const statusCounts: Record<string, number> = {};
      const boardCounts: Record<string, number> = {};
      const activeStudents: any[] = [];
      
      allSnapshot.docs.forEach(doc => {
        const student = this.parseUserFromFirestore(doc);
        const status = student.status || 'undefined';
        const studentBoard = student.board || 'undefined';
        
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        boardCounts[studentBoard] = (boardCounts[studentBoard] || 0) + 1;
        
        if (status === USER_STATUS.DISABLED || status === USER_STATUS.SUSPENDED || status === USER_STATUS.PENDING){
          activeStudents.push(student);
        }
      });
      
      console.log('Status Breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count} students`);
      });
      console.log('');
      
      console.log('Board Breakdown:');
      Object.entries(boardCounts).forEach(([b, count]) => {
        console.log(`  - ${b}: ${count} students`);
      });
      console.log('');
      
      console.log(`✅ Active Students: ${activeStudents.length}`);
      
      if (activeStudents.length > 0) {
        console.log('');
        console.log('Sample Active Students:');
        activeStudents.slice(0, 3).forEach(s => {
          console.log(`  - ${s.studentRoll}: ${s.fullName}`);
          console.log(`    Class: ${s.studentClass}, Board: ${s.board}, Status: ${s.status}`);
        });
      }
      
      console.log('');
      console.log('==========================================');
      
      if (board) {
        const boardFilteredCount = activeStudents.filter(s => s.board === board).length;
        console.log(`📊 Active students with board "${board}": ${boardFilteredCount}`);
        
        if (boardFilteredCount === 0 && activeStudents.length > 0) {
          console.log(`⚠️  WARNING: No active students match board "${board}"`);
          console.log(`   Available boards:`, Object.keys(boardCounts).join(', '));
        }
      }
      
    } catch (error) {
      console.error('❌ Debug query failed:', error);
    }
  }
  
  // ==================== COLLEGE MANAGEMENT ====================
  
  /**
   * Get college by ID
   */
  async getCollege(collegeId: string): Promise<CollegeModel | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return null as any; // Return empty string instead of throwing error
      }
      
      const collegeDoc = await getDoc(doc(this.firestore, COLLECTIONS.COLLEGES, collegeId));
      
      if (!collegeDoc.exists()) {
        return null;
      }
      
      return this.parseCollegeFromFirestore(collegeDoc);
      
    } catch (error) {
      console.error('Error fetching college:', error);
      return null;
    }
  }
  
  /**
   * Alias for getCollege (for consistency)
   */
  async getCollegeById(collegeId: string): Promise<CollegeModel | null> {
    return this.getCollege(collegeId);
  }
  
  /**
   * Get all active colleges
   */
  async getAllColleges(): Promise<CollegeModel[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      const collegesQuery = query(
        collection(this.firestore, COLLECTIONS.COLLEGES),
        where('status', '==', USER_STATUS.ACTIVE)
      );
      
      const snapshot = await getDocs(collegesQuery);
      return snapshot.docs.map(doc => this.parseCollegeFromFirestore(doc));
      
    } catch (error) {
      console.error('Error fetching colleges:', error);
      return [];
    }
  }
  
  /**
   * Update college
   */
  async updateCollege(
    collegeId: string, 
    updates: Partial<CollegeModel>
  ): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      
      const cleanUpdates: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      });
      
      cleanUpdates.updatedAt = serverTimestamp();
      
      await updateDoc(doc(this.firestore, COLLECTIONS.COLLEGES, collegeId), cleanUpdates);
      return true;
      
    } catch (error) {
      console.error('Error updating college:', error);
      return false;
    }
  }
  
  // ==================== CODING LANGUAGES ====================
  
  /**
   * Get all available programming/coding languages
   * Fetches from CodingLanguages collection
   */
  async getCodingLanguages(): Promise<string[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      const codingLanguagesRef = collection(this.firestore, COLLECTIONS.CODING_LANGUAGES);
      const snapshot = await getDocs(codingLanguagesRef);
      
      // Extract languages from all documents
      const languagesSet = new Set<string>();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Check if there's a Languages array field
        if (data.Languages && Array.isArray(data.Languages)) {
          data.Languages.forEach((lang: string) => {
            if (lang && typeof lang === 'string') {
              languagesSet.add(lang.trim());
            }
          });
        }
        
        // Also check if there's a Language string field
        if (data.Language && typeof data.Language === 'string') {
          languagesSet.add(data.Language.trim());
        }
      });
      
      // Convert Set to Array and sort alphabetically
      const languagesArray = Array.from(languagesSet).sort();
      
      console.log('✅ Fetched coding languages:', languagesArray);
      return languagesArray;
      
    } catch (error) {
      console.error('❌ Error fetching coding languages:', error);
      // Return default languages if fetch fails
      return ['C', 'C++', 'Go', 'Java', 'JavaScript', 'Python', 'Ruby'];
    }
  }
  
  // ==================== ROOM MANAGEMENT ====================
  
  // ==================== ROOMS ====================
  
  /**
   * Get room statistics with filters
   */
  async getRoomStats(
    collegeId: string,
    roomType?: string,
    roomStatus?: string
  ): Promise<RoomStats[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return [];
      }

      let roomsQuery = query(
        collection(this.firestore, COLLECTIONS.ROOMS),
        where('college_id', '==', collegeId)
      );

      if (roomType && roomType !== 'all') {
        roomsQuery = query(roomsQuery, where('room_type', '==', roomType));
      }

      if (roomStatus && roomStatus !== 'all') {
        roomsQuery = query(roomsQuery, where('room_status', '==', roomStatus));
      }

      const snapshot = await getDocs(roomsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          room_id: doc.id,
          room_name: data.room_name || '',
          room_type: data.room_type || '',
          room_address: data.room_address || '',
          room_capacity: data.room_capacity || 0,
          sitting_matrix: data.sitting_matrix || '',
          room_status: data.room_status || 'available',
          schedule_count: data.room_schedule?.length || 0,
          room_incharge: data.room_incharge || [],
        };
      });
    } catch (error) {
      console.error('Error fetching room stats:', error);
      return [];
    }
  }

  /**
   * Get room by ID
   */
  async getRoomById(collegeId: string, roomId: string): Promise<RoomModel | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return null;
      }

      const roomRef = doc(this.firestore, COLLECTIONS.ROOMS, roomId);
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        return null;
      }

      const data = roomDoc.data();
      if (data.college_id !== collegeId) {
        return null;
      }

      return {
        id: roomDoc.id,
        room_id: roomDoc.id,
        college_id: data.college_id,
        room_name: data.room_name,
        room_type: data.room_type,
        room_address: data.room_address,
        room_capacity: data.room_capacity,
        sitting_matrix: data.sitting_matrix,
        room_status: data.room_status,
        room_schedule: data.room_schedule || [],
        room_incharge: data.room_incharge || [],
        seats_allotment: data.seats_allotment,
        created_by: data.created_by,
        created_date_time: data.created_date_time?.toDate() || new Date(),
        updated_date_time: data.updated_date_time?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error fetching room:', error);
      return null;
    }
  }

  /**
   * Add new room
   */
  async addRoom(roomData: Omit<RoomModel, 'id' | 'room_id' | 'created_date_time' | 'updated_date_time'>): Promise<string | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return null;
      }

      const roomRef = doc(collection(this.firestore, COLLECTIONS.ROOMS));
      
      const newRoom = {
        ...roomData,
        room_id: roomRef.id,
        created_date_time: serverTimestamp(),
        updated_date_time: serverTimestamp(),
      };

      await setDoc(roomRef, newRoom);
      
      // Log activity
      await this.addActivityLog({
        userId: roomData.created_by,
        collegeId: roomData.college_id,
        action: 'create_room',
        entityType: 'room',
        entityId: roomRef.id,
        details: `Created room: ${roomData.room_name}`,
      });

      return roomRef.id;
    } catch (error) {
      console.error('Error adding room:', error);
      return null;
    }
  }

  /**
   * Update room
   */
  async updateRoom(
    roomId: string,
    updates: Partial<RoomModel>,
    userId: string
  ): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return false;
      }

      const roomRef = doc(this.firestore, COLLECTIONS.ROOMS, roomId);
      
      const updateData: any = {
        ...updates,
        updated_date_time: serverTimestamp(),
      };

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.room_id;
      delete updateData.created_by;
      delete updateData.created_date_time;

      await updateDoc(roomRef, updateData);

      // Log activity
      const roomDoc = await getDoc(roomRef);
      if (roomDoc.exists()) {
        await this.addActivityLog({
          userId: userId,
          collegeId: roomDoc.data().college_id,
          action: 'update_room',
          entityType: 'room',
          entityId: roomId,
          details: `Updated room: ${roomDoc.data().room_name}`,
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating room:', error);
      return false;
    }
  }

  /**
   * Delete room
   */
  async deleteRoom(roomId: string, collegeId: string, userId: string): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return false;
      }

      const roomRef = doc(this.firestore, COLLECTIONS.ROOMS, roomId);
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        return false;
      }

      const roomName = roomDoc.data()?.room_name;

      await deleteDoc(roomRef);

      // Log activity
      await this.addActivityLog({
        userId: userId,
        collegeId: collegeId,
        action: 'delete_room',
        entityType: 'room',
        entityId: roomId,
        details: `Deleted room: ${roomName}`,
      });

      return true;
    } catch (error) {
      console.error('Error deleting room:', error);
      return false;
    }
  }

  /**
   * Get college users (for room in-charge selection)
   */
  async getCollegeUsers(collegeId: string): Promise<Array<{ userId: string; name: string; userType: string }>> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return [];
      }

      const usersQuery = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('collegeId', '==', collegeId),
        where('status', '==', USER_STATUS.ACTIVE)
      );

      const snapshot = await getDocs(usersQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: doc.id,
          name: data.name || data.email || 'Unknown',
          userType: data.userType || 'student',
        };
      });
    } catch (error) {
      console.error('Error fetching college users:', error);
      return [];
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return null;
      }

      const userRef = doc(this.firestore, COLLECTIONS.USERS, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return null;
      }

      return {
        userId: userDoc.id,
        ...userDoc.data(),
      };
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<any | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return null;
      }

      if (!this.firestore) throw new Error('Firestore not initialized');
const usersRef = collection(this.firestore, COLLECTIONS.USERS);
      const q = query(usersRef, where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log(`No user found with email: ${email}`);
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      return {
        userId: userDoc.id,
        ...userDoc.data(),
      };
    } catch (error) {
      console.error(`Error fetching user by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Add schedule to room
   */
  async addScheduleToRoom(
    roomId: string,
    schedule: {
      start_date_time: string;
      end_date_time: string;
      event: string;
      users: string[];
    },
    userId: string
  ): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return false;
      }

      const roomRef = doc(this.firestore, COLLECTIONS.ROOMS, roomId);
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        return false;
      }

      const currentSchedule = roomDoc.data()?.room_schedule || [];
      
      await updateDoc(roomRef, {
        room_schedule: [...currentSchedule, schedule],
        updated_date_time: serverTimestamp(),
      });

      // Log activity
      await this.addActivityLog({
        userId: userId,
        collegeId: roomDoc.data()?.college_id,
        action: 'add_schedule',
        entityType: 'room',
        entityId: roomId,
        details: `Added schedule for ${schedule.event}`,
      });

      return true;
    } catch (error) {
      console.error('Error adding schedule:', error);
      return false;
    }
  }

  /**
   * Update room status
   */
  async updateRoomStatus(
    roomId: string,
    status: string,
    userId: string
  ): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return false;
      }

      const roomRef = doc(this.firestore, COLLECTIONS.ROOMS, roomId);
      
      await updateDoc(roomRef, {
        room_status: status,
        updated_date_time: serverTimestamp(),
      });

      // Log activity
      const roomDoc = await getDoc(roomRef);
      if (roomDoc.exists()) {
        await this.addActivityLog({
          userId: userId,
          collegeId: roomDoc.data()?.college_id,
          action: 'update_room_status',
          entityType: 'room',
          entityId: roomId,
          details: `Changed status to ${status}`,
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating room status:', error);
      return false;
    }
  }

  /**
   * Bulk upload rooms
   */
  async bulkUploadRooms(
    rooms: Array<Omit<RoomModel, 'id' | 'room_id' | 'created_date_time' | 'updated_date_time'>>,
    //userId: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rooms.length; i++) {
      try {
        const roomId = await this.addRoom(rooms[i]);
        if (roomId) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Failed to create room`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }
  
  // ==================== EXAMS ====================
  
  /**
   * Generate readable exam ID (unique system-wide)
   */
  private async generateExamId(collegeId: string, examType: string): Promise<string> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log', examType);
        return ''; // Return empty string instead of throwing error
      }
      
      // Get college prefix (first 3 characters of collegeId in uppercase)
      const collegePrefix = collegeId.substring(0, 3).toUpperCase();
      
      // Get year (last 2 digits)
      const year = new Date().getFullYear().toString().slice(-2);
      
      // Maximum attempts to generate a unique ID
      const maxAttempts = 5;
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        attempts++;
        
        // Use Firebase auto-generated ID for guaranteed uniqueness
        const examsRef = collection(this.firestore, COLLECTIONS.EXAMS);
        const newExamRef = doc(examsRef);
        const firebaseId = newExamRef.id;
        
        // Take last 6 characters of Firebase ID for short unique suffix
        const uniqueSuffix = firebaseId.substring(firebaseId.length - 6).toUpperCase();
        
        // Format: COLLEGE-YY-XXXXXX (e.g., CHA-25-A3F9K2)
        const examId = `${collegePrefix}-${year}-${uniqueSuffix}`;
        
        // Check if this ID already exists
        const examDoc = await getDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId));
        
        if (!examDoc.exists()) {
          console.log(`✅ Generated unique exam ID: ${examId} (attempt ${attempts})`);
          return examId;
        }
        
        console.warn(`⚠️ Exam ID ${examId} already exists, regenerating... (attempt ${attempts})`);
      }
      
      // If all attempts failed (extremely unlikely), use timestamp-based fallback
      const fallbackId = `${collegePrefix}-${year}-${Date.now().toString().slice(-6)}`;
      console.warn(`⚠️ Using fallback exam ID: ${fallbackId}`);
      return fallbackId;
      
    } catch (error) {
      console.error('Error generating exam ID:', error);
      // Fallback to timestamp-based ID (guaranteed unique)
      return `EXM-${Date.now()}`;
    }
  }
  
  /**
   * Upload exam questions to Firebase Storage
   * @param examId - Exam ID to use in storage path
   * @param questions - Questions array to upload
   * @returns Storage path and download URL
   */
  private async uploadQuestionsToStorage(
    examId: string,
    questions: Question[]
  ): Promise<{ path: string; url: string } | null> {
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage not initialized');
      }

      console.log(`📄 Starting upload for ${questions.length} questions...`);
      
      // Use same path pattern as mobile app: question_papers/{examId}/
      const storagePath = `question_papers/${examId}/questions.json`;
      const storageRef = ref(this.storage, storagePath);
      
      console.log(`📍 Upload path: ${storagePath}`);

      // Convert questions to JSON blob
      const questionsJson = JSON.stringify(questions);
      const blob = new Blob([questionsJson], { type: 'application/json' });
      
      console.log(`📦 Data size: ${(blob.size / 1024).toFixed(2)} KB`);
      console.log(`📤 Uploading to Firebase Storage...`);

      // Upload to Storage with metadata like mobile app
      const metadata = {
        contentType: 'application/json',
        customMetadata: {
          examId: examId,
          questionCount: questions.length.toString(),
          uploadedBy: this.getCurrentUser()?.uid || 'unknown',
          uploadedAt: new Date().toISOString(),
          type: 'questions'
        }
      };
      
      await uploadBytes(storageRef, blob, metadata);
      console.log(`✅ Upload complete`);

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`✅ Download URL obtained`);
      console.log(`✅ URL: ${downloadUrl}`);

      return { path: storagePath, url: downloadUrl };
    } catch (error) {
      console.error('❌ Error uploading questions to Storage:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return null;
    }
  }

  /**
   * Fetch exam questions from Firebase Storage
   * @param url - Download URL of questions JSON
   * @returns Questions array
   */
  // @ts-ignore - Unused method preserved for potential future use
  private async fetchQuestionsFromStorage(url: string): Promise<Question[] | null> {
    try {
      console.log(`📥 Fetching questions from Storage: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const questions = await response.json();
      console.log(`✅ Questions fetched successfully from Storage (${questions.length} questions)`);
      return questions;
    } catch (error) {
      console.error('❌ Error fetching questions from Storage:', error);
      return null;
    }
  }

  /**
   * Check if exam data exceeds Firestore size limit
   * @param data - Data to check
   * @returns true if data is too large
   */
  /* private isDataTooLarge(data: any): boolean {
    try {
      // Check if questionsList exists and has items
      if (!data.questionsList || !Array.isArray(data.questionsList) || data.questionsList.length === 0) {
        return false;
      }

      // Serialize the data to JSON (similar to what Firestore does)
      const jsonString = JSON.stringify(data);
      const sizeInBytes = new Blob([jsonString]).size;
      
      // Use a very conservative threshold: 500KB instead of 900KB
      // Firestore limit is 1MB (1048576 bytes), but we use 500KB to be safe
      // because Firestore adds metadata and indexes
      const threshold = 500 * 1024; // 500KB
      
      console.log(`📏 Data size check: ${Math.round(sizeInBytes / 1024)}KB (threshold: ${Math.round(threshold / 1024)}KB)`);
      
      if (sizeInBytes > threshold) {
        console.warn(`⚠️ Data size (${Math.round(sizeInBytes / 1024)}KB) exceeds threshold (${Math.round(threshold / 1024)}KB)`);
        console.warn(`⚠️ Number of questions: ${data.questionsList.length}`);
        return true;
      }
      
      // Also check based on number of questions as a safety
      // If more than 30 questions, automatically use Storage
      if (data.questionsList.length > 30) {
        console.warn(`⚠️ Question count (${data.questionsList.length}) exceeds safe limit (30)`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking data size:', error);
      // If we can't check the size, assume it's too large to be safe
      return true;
    }
  } */
  
  /**
   * Create exam
   */
  async createExam(
    examData: Partial<ExamModel>, 
    currentUser: UserModel
  ): Promise<string | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return ''; // Return empty string instead of throwing error
      }
      
      // Generate readable exam ID
      const examId = await this.generateExamId(examData.collegeId!, examData.type!);
      const examRef = doc(this.firestore, COLLECTIONS.EXAMS, examId);
      
      // Prepare data and remove undefined values
      let dataToSave: any = {
        ...examData,
        createdBy: currentUser.userId,
        createdByName: currentUser.fullName,
        createdByRole: this.getUserTypeDisplayName(currentUser.userType),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // CRITICAL: Check if questions list exists and force Storage
      // We use VERY conservative thresholds to avoid ANY Firestore size errors
      if (dataToSave.questionsList && Array.isArray(dataToSave.questionsList)) {
        const questionCount = dataToSave.questionsList.length;
        console.log(`📊 Exam has ${questionCount} questions`);
        
        // Calculate actual size
        const examSize = new Blob([JSON.stringify(dataToSave)]).size;
        const examSizeKB = Math.round(examSize / 1024);
        console.log(`📏 Exam data size: ${examSizeKB}KB`);
        
        // ULTRA AGGRESSIVE: Force Storage for ANY of these conditions:
        // 1. More than 20 questions (was 30)
        // 2. Data size over 200KB (was 500KB)
        // 3. ANY exam with questionsList array (safest option)
        const shouldUseStorage = questionCount > 20 || examSizeKB > 200;
        
        if (shouldUseStorage) {
          console.log('📦 Questions list detected, moving to Storage for safety...');
          console.log(`   - Question count: ${questionCount} (threshold: 20)`);
          console.log(`   - Data size: ${examSizeKB}KB (threshold: 200KB)`);
          console.log(`   - Using Storage to avoid Firestore 1MB limit`);
          
          // Upload questions to Storage
          const storageResult = await this.uploadQuestionsToStorage(
            examId,
            dataToSave.questionsList
          );
          
          if (storageResult) {
            // Store reference to Storage file instead of the actual questions
            dataToSave.questionsStoragePath = storageResult.path;
            dataToSave.questionsStorageUrl = storageResult.url;
            // Remove questionsList from Firestore document
            delete dataToSave.questionsList;
            console.log('✅ Questions moved to Storage, Firestore will store reference only');
          } else {
            console.error('❌ Failed to upload to Storage, will try Firestore');
            // Don't throw error, let it try Firestore
          }
        } else {
          console.log(`   - Small exam (${questionCount} questions, ${examSizeKB}KB), using Firestore`);
        }
      }

      // CRITICAL: Check if question paper images exist (OFFLINE EXAMS)
      // ALWAYS upload offline exam images to Storage - they're always large base64 data
      if (dataToSave.questionPaperImages && Array.isArray(dataToSave.questionPaperImages) && dataToSave.questionPaperImages.length > 0) {
        const imageCount = dataToSave.questionPaperImages.length;
        console.log(`📸 Offline exam detected with ${imageCount} question paper images`);
        console.log(`📦 Uploading all images to Storage (offline exams always use Storage)...`);
        
        try {
          // Upload each image to Storage (like mobile app does)
          const uploadedImages: Array<{page_number: number; image_url: string}> = [];
          
          for (let i = 0; i < dataToSave.questionPaperImages.length; i++) {
            const imageData = dataToSave.questionPaperImages[i];
            const pageNumber = imageData.page_number || (i + 1);
            const base64Data = imageData.image || imageData.base64 || imageData.data || imageData;
            
            if (base64Data && typeof base64Data === 'string') {
              console.log(`📤 Uploading page ${pageNumber}...`);
              
              // Convert base64 to blob
              const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
              const binaryString = atob(base64Clean);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              const blob = new Blob([bytes], { type: 'image/png' });
              
              // Upload to Storage: question_papers/{examId}/page_{number}.png
              const timestamp = Date.now();
              const imagePath = `question_papers/${examId}/page_${pageNumber}_${timestamp}.png`;
              if (!this.storage) throw new Error('Storage not initialized');
                const imageRef = ref(this.storage, imagePath);
              
              await uploadBytes(imageRef, blob, {
                contentType: 'image/png',
                customMetadata: {
                  examId: examId,
                  pageNumber: pageNumber.toString(),
                  uploadedBy: this.getCurrentUser()?.uid || 'unknown',
                  uploadedAt: new Date().toISOString(),
                  type: 'question_paper'
                }
              });
              
              const imageUrl = await getDownloadURL(imageRef);
              uploadedImages.push({
                page_number: pageNumber,
                image_url: imageUrl
              });
              
              console.log(`✅ Uploaded page ${pageNumber}`);
            }
          }
          
          // Replace questionPaperImages with URLs only (like mobile app)
          dataToSave.questionPaperPages = uploadedImages;
          delete dataToSave.questionPaperImages;
          
          console.log(`✅ All ${uploadedImages.length} images uploaded to Storage`);
          console.log('✅ Firestore will store image URLs only, not base64 data');
        } catch (error) {
          console.error('❌ Error uploading question paper images:', error);
          throw new Error('Failed to upload question paper images to Storage');
        }
      }
      
      // Debug: Log data before cleaning
      console.log('📝 Data before cleaning:', {
        hasQuestionsList: !!dataToSave.questionsList,
        hasStorageRef: !!dataToSave.questionsStoragePath,
        totalQuestions: dataToSave.totalQuestions
      });
      
      // Deep clean to remove all undefined and null values (including nested)
      const cleanedData = deepCleanObject(dataToSave);
      
      // CRITICAL SAFETY CHECK: Verify questionsList was removed if using Storage
      if (cleanedData.questionsStorageUrl && cleanedData.questionsList) {
        console.error('❌ SAFETY ERROR: questionsList should have been removed!');
        delete cleanedData.questionsList;
        console.log('✅ Removed questionsList as safety measure');
      }
      
      // Final size check before writing to Firestore
      const finalSize = new Blob([JSON.stringify(cleanedData)]).size;
      console.log(`📏 Final document size: ${Math.round(finalSize / 1024)}KB`);
      
      if (finalSize > 1000000) {
        console.error(`❌ CRITICAL: Document size ${Math.round(finalSize / 1024)}KB exceeds 1MB limit!`);
        throw new Error(`Document too large (${Math.round(finalSize / 1024)}KB). This should not happen.`);
      }
      
      // Debug: Log data after cleaning
      console.log('✨ Data after cleaning:', {
        hasQuestionsList: !!cleanedData.questionsList,
        hasStorageRef: !!cleanedData.questionsStoragePath,
        totalQuestions: cleanedData.totalQuestions,
        sizeKB: Math.round(finalSize / 1024)
      });
      
      await setDoc(examRef, cleanedData);
      
      console.log('✅ Exam created successfully:', examId);
      
      // Log activity (non-blocking - won't affect exam creation)
      try {
        await this.addActivityLog({
          userId: currentUser.userId,
          collegeId: examData.collegeId!,
          action: 'create_exam',
          entityType: 'exam',
          entityId: examId,
          details: JSON.stringify({
            title: examData.title,
            class: examData.class,
            subject: examData.subject,
            examDate: examData.examDate,
            totalQuestions: examData.totalQuestions,
            maxMarks: examData.maxMarks,
            mode: examData.mode,
            type: examData.type
          })
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log exam creation (non-critical):', logError);
        // Don't throw - logging failure shouldn't break exam creation
      }
      
      return examId;
      
    } catch (error) {
      console.error('Error creating exam:', error);
      return null;
    }
  }
  
  /**
   * Get exam by ID
   */
  async getExamById(examId: string): Promise<ExamModel | null> {
  try {
    console.log('🔍 Calling Cloud Function to get sanitized exam:', examId);
    
    const functions = getFunctions();
    const getExamForStudent = httpsCallable(functions, 'getExamForStudent');
    
    const result = await getExamForStudent({ examId });
    const response = result.data as { success: boolean; exam: any };
    
    if (!response.success || !response.exam) {
      console.error('❌ Cloud Function returned error');
      return null;
    }
    
    console.log('✅ Received sanitized exam from server');
    console.log('   - Questions count:', response.exam.questionsList?.length || 0);
    
    // ✅ Return exam directly (Cloud Function already structured it correctly)
    const exam = response.exam as ExamModel;
    exam.id = response.exam.id || examId;
    
    // Debug: Check questions
    if (exam.questionsList && exam.questionsList.length > 0) {
      exam.questionsList.forEach((q: any, index: number) => {
        console.log(`   Q${index + 1} (${q.type}):`, {
          hasJumbledOptions: !!q.jumbledOptions,
          jumbledOptionsCount: q.jumbledOptions?.length || 0,
          hasBoilerplate: !!q.boilerplate,
          boilerplateLength: q.boilerplate?.length || 0
        });
      });
    }
    
    return exam;
    
  } catch (error) {
    console.error('❌ Error fetching exam:', error);
    return null;
  }
}
  
  /**
   * Get exams for a college
   */
  async getExams(collegeId?: string, academicYear?: string): Promise<ExamModel[]> {
    console.log('🔍 [FIREBASE_SERVICE] getExams called with:', { collegeId, academicYear });
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      // Build query constraints
      const constraints: any[] = [];
      
      // Add filters first
      if (collegeId) {
        console.log('🔍 [FIREBASE_SERVICE] Adding collegeId filter:', collegeId);
        constraints.push(where('collegeId', '==', collegeId));
      }
      if (academicYear && academicYear !== 'all') {
        console.log('🔍 [FIREBASE_SERVICE] Adding academicYear filter:', academicYear);
        constraints.push(where('year', '==', academicYear));
      }
      
      // Add ordering and limit
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(100));
      
      console.log('🔍 [FIREBASE_SERVICE] Executing query with', constraints.length, 'constraints');
      const examsQuery = query(
        collection(this.firestore, COLLECTIONS.EXAMS),
        ...constraints
      );
      
      // Force fetch from server to get latest data including new questionPool fields
      const snapshot = await getDocsFromServer(examsQuery);
      console.log('🔍 [FIREBASE_SERVICE] Query returned', snapshot.docs.length, 'documents');
      
      const parsedExams = snapshot.docs.map((doc, index) => {
        console.log(`🔍 [FIREBASE_SERVICE] Parsing exam ${index + 1}/${snapshot.docs.length}: ${doc.id}`);
        return this.parseExamFromFirestore(doc);
      });
      
      console.log('✅ [FIREBASE_SERVICE] getExams completed successfully');
      
      // ✅ Return full exam data for teachers/admins (no sanitization)
      // Students should use getExamById() which calls Cloud Function for sanitized data
      console.log('📋 Returning', parsedExams.length, 'exams (full data for teachers)');
      
      return parsedExams;
      
    } catch (error) {
      console.error('❌ [FIREBASE_SERVICE] Error fetching exams:', error);
      console.error('❌ [FIREBASE_SERVICE] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }
  
  /**
   * Update exam
   */
  async updateExam(examId: string, updates: Partial<ExamModel>, currentUser: UserModel): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, cannot update exam');
        return false;
      }
      
      console.log('\n🔥 FIREBASE: Updating exam');
      console.log('  - Exam ID:', examId);
      console.log('  - Update keys:', Object.keys(updates));
      console.log('  - Timestamp:', new Date().toISOString());
      
      // Special logging for questionsList updates
      if (updates.questionsList) {
        console.log('  - Updating questionsList:');
        console.log('    • New question count:', updates.questionsList.length);
        if (updates.questionsList.length > 0) {
          console.log('    • First question title:', updates.questionsList[0].title || updates.questionsList[0].questionText);
          console.log('    • First question keys:', Object.keys(updates.questionsList[0]));
        }
      }
      
      // Add timestamp
      let dataToUpdate: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      // CRITICAL: Check if questions list exists and force Storage
      if (dataToUpdate.questionsList && Array.isArray(dataToUpdate.questionsList)) {
        const questionCount = dataToUpdate.questionsList.length;
        console.log(`📊 Update has ${questionCount} questions`);
        
        // Calculate actual size
        const updateSize = new Blob([JSON.stringify(dataToUpdate)]).size;
        const updateSizeKB = Math.round(updateSize / 1024);
        console.log(`📏 Update data size: ${updateSizeKB}KB`);
        
        // ULTRA AGGRESSIVE: Force Storage for ANY of these conditions:
        const shouldUseStorage = questionCount > 20 || updateSizeKB > 200;
        
        if (shouldUseStorage) {
          console.log('📦 Questions list detected, moving to Storage...');
          console.log(`   - Question count: ${questionCount} (threshold: 20)`);
          console.log(`   - Data size: ${updateSizeKB}KB (threshold: 200KB)`);
          
          // Upload questions to Storage
          const storageResult = await this.uploadQuestionsToStorage(
            examId,
            dataToUpdate.questionsList
          );
          
          if (storageResult) {
            // Store reference to Storage file instead of the actual questions
            dataToUpdate.questionsStoragePath = storageResult.path;
            dataToUpdate.questionsStorageUrl = storageResult.url;
            // Remove questionsList from Firestore document
            delete dataToUpdate.questionsList;
            console.log('✅ Questions moved to Storage, Firestore will store reference only');
          } else {
            console.error('❌ Failed to upload to Storage');
          }
        } else {
          console.log(`   - Small update (${questionCount} questions, ${updateSizeKB}KB), using Firestore`);
        }
      }
      
      // Deep clean to remove all undefined/null values
      const cleanUpdates = deepCleanObject(dataToUpdate);
      
      // CRITICAL SAFETY CHECK: Verify questionsList was removed if using Storage
      if (cleanUpdates.questionsStorageUrl && cleanUpdates.questionsList) {
        console.error('❌ SAFETY ERROR: questionsList should have been removed!');
        delete cleanUpdates.questionsList;
        console.log('✅ Removed questionsList as safety measure');
      }
      
      // Final size check
      const finalSize = new Blob([JSON.stringify(cleanUpdates)]).size;
      console.log(`📏 Final update size: ${Math.round(finalSize / 1024)}KB`);
      
      if (finalSize > 1000000) {
        console.error(`❌ CRITICAL: Update size ${Math.round(finalSize / 1024)}KB exceeds 1MB limit!`);
        throw new Error(`Update too large (${Math.round(finalSize / 1024)}KB). This should not happen.`);
      }
      
      console.log('  - Clean updates keys:', Object.keys(cleanUpdates));
      if (cleanUpdates.questionsList) {
        console.log('  - Cleaned questionsList length:', cleanUpdates.questionsList.length);
      } else if (cleanUpdates.questionsStoragePath) {
        console.log('  - Questions stored in Storage:', cleanUpdates.questionsStoragePath);
      }
      
      await updateDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId), cleanUpdates);
      
      console.log('✅ FIREBASE: Exam updated successfully');
      
      // Log activity (non-blocking - won't affect exam update)
      try {
        await this.addActivityLog({
          userId: currentUser.userId,
          collegeId: cleanUpdates.collegeId || updates.collegeId || '',
          action: 'update_exam',
          entityType: 'exam',
          entityId: examId,
          details: JSON.stringify({
            title: cleanUpdates.title || updates.title,
            changedFields: Object.keys(cleanUpdates).filter(k => k !== 'updatedAt'),
            hasQuestionsList: !!cleanUpdates.questionsList,
            hasStorageRef: !!cleanUpdates.questionsStorageUrl
          })
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log exam update (non-critical):', logError);
      }
      
      // Verify the update by fetching the document
      const verifyDoc = await getDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId));
      if (verifyDoc.exists()) {
        const verifyData = verifyDoc.data();
        console.log('  ✅ VERIFICATION: Document refetched after update');
        console.log('    • questionsList count:', verifyData?.questionsList?.length || 0);
        console.log('    • questionsStorageUrl exists:', !!verifyData?.questionsStorageUrl);
        if (verifyData?.questionsList && verifyData.questionsList.length > 0) {
          console.log('    • First question title:', verifyData.questionsList[0].title || verifyData.questionsList[0].questionText);
        }
      }
      console.log('');
      
      return true;
      
    } catch (error) {
      console.error('Error updating exam:', error);
      return false;
    }
  }
  
  /**
   * Delete exam
   */
  /**
   * Delete exam
   */
  async deleteExam(examId: string, currentUser: UserModel): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false;
      }
      
      // First, check if exam has questions in Storage
      const examDoc = await getDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId));
      if (examDoc.exists()) {
        const examData = examDoc.data();
        
        // If questions are stored in Storage, delete them
        if (examData.questionsStoragePath) {
          try {
            console.log('🗑️ Deleting questions from Storage:', examData.questionsStoragePath);
            const storageRef = ref(this.storage!, examData.questionsStoragePath);
            await deleteObject(storageRef);
            console.log('✅ Questions deleted from Storage');
          } catch (storageError) {
            console.warn('⚠️ Failed to delete questions from Storage:', storageError);
            // Continue with Firestore deletion even if Storage deletion fails
          }
        }
      }
      
      // Get exam data before deletion for audit trail
      const examData = examDoc.exists() ? examDoc.data() : null;
      
      // Delete the Firestore document
      await deleteDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId));
      console.log('✅ Exam deleted from Firestore');
      
      // Log activity (non-blocking - won't affect exam deletion)
      try {
        if (examData) {
          await this.addActivityLog({
            userId: currentUser.userId,
            collegeId: examData.collegeId || '',
            action: 'delete_exam',
            entityType: 'exam',
            entityId: examId,
            details: JSON.stringify({
              title: examData.title,
              class: examData.class,
              subject: examData.subject,
              examDate: examData.examDate,
              totalQuestions: examData.totalQuestions,
              deletedAt: new Date().toISOString()
            })
          });
        }
      } catch (logError) {
        console.warn('⚠️ Failed to log exam deletion (non-critical):', logError);
      }
      
      return true;
      
    } catch (error) {
      console.error('Error deleting exam:', error);
      return false;
    }
  }
  
  // ==================== ATTENDANCE ====================
  
  /**
   * Mark or update attendance for a student in an exam
   */
  async markAttendance(
    examId: string,
    studentId: string,
    status: AttendanceStatus,
    examiner: UserModel
  ): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      
      // Create a unique ID for the attendance record: examId_studentId
      const attendanceId = `${examId}_${studentId}`;
      const attendanceRef = doc(this.firestore, COLLECTIONS.ATTENDANCE, attendanceId);
      
      // Check if attendance record already exists
      const existingRecord = await getDoc(attendanceRef);
      
      // Get student details
      const studentDoc = await getDoc(doc(this.firestore, COLLECTIONS.USERS, studentId));
      if (!studentDoc.exists()) {
        console.error('Student not found');
        return false;
      }
      
      const studentData = studentDoc.data() as UserModel;
      
      const now = new Date();
      
      if (existingRecord.exists()) {
        // Update existing record
        await updateDoc(attendanceRef, {
          status,
          examinerId: examiner.userId,
          examinerName: examiner.fullName,
          examinerRole: this.getUserTypeDisplayName(examiner.userType),
          updatedAt: now
        });
      } else {
        // Create new record
        const attendanceData: AttendanceRecord = {
          id: attendanceId,
          examId,
          studentId,
          userId: studentId,
          studentName: studentData.fullName,
          studentRollNumber: studentData.studentRoll || 'N/A',
          examinerId: examiner.userId,
          examinerName: examiner.fullName,
          examinerRole: this.getUserTypeDisplayName(examiner.userType),
          status,
          markedAt: now,
          updatedAt: now,
          collegeId: examiner.collegeId || ''
        };
        
        await setDoc(attendanceRef, attendanceData);
      }
      
      return true;
      
    } catch (error) {
      console.error('Error marking attendance:', error);
      return false;
    }
  }
  
  /**
   * Get attendance records for a specific exam
   */
  async getExamAttendance(examId: string): Promise<AttendanceRecord[]> {

    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      const attendanceQuery = query(
        collection(this.firestore, COLLECTIONS.ATTENDANCE),
        where('examId', '==', examId)
      );

      const querySnapshot = await getDocs(attendanceQuery);
      
      const attendanceRecords: AttendanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        attendanceRecords.push({
          id: doc.id,
          examId: data.examId,
          studentId: data.studentId,
          userId: data.studentId,
          studentName: data.studentName,
          studentRollNumber: data.studentRollNumber,
          examinerId: data.examinerId,
          examinerName: data.examinerName,
          examinerRole: data.examinerRole,
          status: data.status,
          markedAt: data.markedAt?.toDate ? data.markedAt.toDate() : new Date(data.markedAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          collegeId: data.collegeId
        });
      });
      
      console.log('Attendance records', attendanceRecords);

      return attendanceRecords;
      
    } catch (error) {
      console.error('Error getting exam attendance:', error);
      return [];
    }
  }
  
  /**
   * Get attendance record for a specific student in an exam
   */
  async getStudentAttendance(examId: string, studentId: string): Promise<AttendanceRecord | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return null as any; // Return empty string instead of throwing error
      }
      
      const attendanceId = `${examId}_${studentId}`;
      const attendanceRef = doc(this.firestore, COLLECTIONS.ATTENDANCE, attendanceId);
      const attendanceDoc = await getDoc(attendanceRef);
      
      if (!attendanceDoc.exists()) {
        return null;
      }
      
      const data = attendanceDoc.data();
      return {
        id: data.id,
        examId: data.examId,
        studentId: data.studentId,
        userId: data.studentId,
        studentName: data.studentName,
        studentRollNumber: data.studentRollNumber,
        examinerId: data.examinerId,
        examinerName: data.examinerName,
        examinerRole: data.examinerRole,
        status: data.status,
        markedAt: data.markedAt?.toDate ? data.markedAt.toDate() : new Date(data.markedAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        collegeId: data.collegeId
      };
      
    } catch (error) {
      console.error('Error getting student attendance:', error);
      return null;
    }
  }
  
  /**
   * Bulk mark attendance for multiple students
   */
  async bulkMarkAttendance(
    examId: string,
    studentIds: string[],
    status: AttendanceStatus,
    examiner: UserModel
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const studentId of studentIds) {
      const result = await this.markAttendance(examId, studentId, status, examiner);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
    
    return { success, failed };
  }
  
  /**
   * Get attendance statistics for an exam
   */
  async getAttendanceStats(examId: string): Promise<{
    totalStudents: number;
    present: number;
    absent: number;
    notMarked: number;
    attendanceRate: number;
  }> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return { totalStudents: 0, present: 0, absent: 0, notMarked: 0, attendanceRate: 0 }; // Return empty string instead of throwing error
      }
      
      // Get exam details to know the class
      const examDoc = await getDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId));
      if (!examDoc.exists()) {
        return { totalStudents: 0, present: 0, absent: 0, notMarked: 0, attendanceRate: 0 };
      }
      
      const examData = examDoc.data();
      
      // Get all students in the exam's class
      const studentsQuery = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('userType', '==', USER_TYPES.STUDENT),
        where('className', '==', examData.class),
        where('collegeId', '==', examData.collegeId)
      );
      
      const studentsSnapshot = await getDocs(studentsQuery);
      const totalStudents = studentsSnapshot.size;
      
      // Get attendance records for this exam
      const attendanceRecords = await this.getExamAttendance(examId);
      
      const present = attendanceRecords.filter(r => r.status === 'present').length;
      const absent = attendanceRecords.filter(r => r.status === 'absent').length;
      const notMarked = totalStudents - attendanceRecords.length;
      const attendanceRate = totalStudents > 0 ? (present / totalStudents) * 100 : 0;
      
      return {
        totalStudents,
        present,
        absent,
        notMarked,
        attendanceRate: Math.round(attendanceRate * 100) / 100
      };
      
    } catch (error) {
      console.error('Error getting attendance stats:', error);
      return { totalStudents: 0, present: 0, absent: 0, notMarked: 0, attendanceRate: 0 };
    }
  }
  
  /**
   * Delete attendance record
   */
  async deleteAttendance(examId: string, studentId: string): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      
      const attendanceId = `${examId}_${studentId}`;
      await deleteDoc(doc(this.firestore, COLLECTIONS.ATTENDANCE, attendanceId));
      
      return true;
      
    } catch (error) {
      console.error('Error deleting attendance:', error);
      return false;
    }
  }
  
  // ==================== NOTICES ====================
  
  /**
   * Create a new notice
   */
  async createNotice(
    noticeData: Partial<NoticeModel>, 
    currentUser: UserModel
  ): Promise<string | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
       return ''; // Return empty string instead of throwing error
      }
      
      // Generate notice ID
      const noticeId = `NOTICE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const noticeRef = doc(this.firestore, COLLECTIONS.NOTIFICATIONS, noticeId);
      
      // Check if expiry date is provided and determine status
      let status: NotificationStatus = NOTIFICATION_STATUS.ACTIVE;
      if (noticeData.expiryDate) {
        const expiryDate = new Date(noticeData.expiryDate);
        const currentDate = new Date();
        status = expiryDate < currentDate ? NOTIFICATION_STATUS.EXPIRED : NOTIFICATION_STATUS.ACTIVE;
      }
      
      // Prepare data and remove undefined values
      const dataToSave: any = {
        ...noticeData,
        id: noticeId,
        status,
        createdBy: currentUser.userId,
        createdByName: currentUser.fullName,
        createdByRole: this.getUserTypeDisplayName(currentUser.userType),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: [],
        views: 0
      };
      
      // Remove undefined values
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) {
          delete dataToSave[key];
        }
      });
      
      await setDoc(noticeRef, dataToSave);
      
      console.log('✅ Notice created successfully:', noticeId);
      return noticeId;
      
    } catch (error) {
      console.error('❌ Error creating notice:', error);
      return null;
    }
  }
  
  /**
   * Get notice by ID
   */
  async getNoticeById(noticeId: string): Promise<NoticeModel | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return null as any; // Return empty string instead of throwing error
      }
      
      const noticeDoc = await getDoc(doc(this.firestore, COLLECTIONS.NOTIFICATIONS, noticeId));
      
      if (!noticeDoc.exists()) {
        return null;
      }
      
      return this.parseNoticeFromFirestore(noticeDoc);
      
    } catch (error) {
      console.error('Error fetching notice:', error);
      return null;
    }
  }
  
  /**
   * Get active notices for a specific user based on their role and class
   */
  async getNoticesForUser(
    userId: string,
    collegeId: string,
    userType: UserType,
    studentClass?: string
  ): Promise<NoticeModel[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log userID - ', userId);
       return []; // Return empty string instead of throwing error
      }
      
      const allNotices = await this.getNotices(collegeId, '');
      
      // Filter notices based on target audience
      const filteredNotices = allNotices.filter(notice => {
        if (notice.targetAudience === 'all') {
          return true;
        }
        
        if (notice.targetAudience === 'faculty' && ['teacher', 'principal', 'admin', 'dean'].includes(userType)) {
          return true;
        }
        
        if (notice.targetAudience === 'students' && userType === 'student') {
          return true;
        }
        
        if (notice.targetAudience === 'parents') {
          return true; // For now, return all parent notices
        }
        
        // Check for specific class targeting
        if (studentClass && notice.targetAudience === studentClass) {
          return true;
        }
        
        return false;
      });
      
      return filteredNotices;
      
    } catch (error) {
      console.error('Error fetching notices for user:', error);
      return [];
    }
  }
  
  /**
   * Update notice
   */
  async updateNotice(noticeId: string, updates: Partial<NoticeModel>): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      
      const noticeRef = doc(this.firestore, COLLECTIONS.NOTIFICATIONS, noticeId);
      
      // Prepare updates and remove undefined values
      const dataToUpdate: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      // Remove undefined values and id field
      Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key] === undefined || key === 'id') {
          delete dataToUpdate[key];
        }
      });
      
      await updateDoc(noticeRef, dataToUpdate);
      
      console.log('✅ Notice updated successfully:', noticeId);
      return true;
      
    } catch (error) {
      console.error('❌ Error updating notice:', error);
      return false;
    }
  }
  

  
  /**
   * Get unread notice count for user
   */
  async getUnreadNoticeCount(userId: string, collegeId: string, userType: UserType, studentClass?: string): Promise<number> {
    try {
      const notices = await this.getNoticesForUser(userId, collegeId, userType, studentClass);
      const unreadCount = notices.filter(notice => !notice.readBy.includes(userId)).length;
      return unreadCount;
    } catch (error) {
      console.error('Error getting unread notice count:', error);
      return 0;
    }
  }
  
  // ==================== QUESTION BANK METHODS ====================
  
  /**
   * Parse question from Firestore document
   */
 private parseQuestionFromFirestore(doc: DocumentSnapshot): QuestionBankItem {
    const data = doc.data() as DocumentData;
    
    return {
      id: doc.id,
      questionText: data.questionText || '',
      subject: data.subject || '',
      subjectCode: data.subjectCode,
      class: data.class || '',
      board: data.board || '',
      year: data.year || '',
      type: data.type || 'mcq',
      complexity: data.complexity || 'medium',
      marks: data.marks || 0,
      isProprietaryQuestion: data.isProprietaryQuestion || false,
      collegeId: data.collegeId || '',
      collegeName: data.collegeName || '',
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()) || new Date(),
      updatedAt: data.updatedAt?.toDate || new Date(),
      tags: data.tags || [],
      
      // Additional fields
      chapter: data.chapter,
      hint: data.hint,
      solution: data.solution,
      imageUrls: data.imageUrls,
      
      // MCQ specific fields
      options: data.options,
      
      // FITB specific fields
      correctAnswers: data.correctAnswers,
      
      // Jumbled specific fields
      jumbledItems: data.jumbledItems,
      
      // Code specific fields
      programmingLanguage: data.programmingLanguage,
      testCases: data.testCases,
      testStub: data.testStub
    };
  }
  
  /**
   * Get all questions from question bank with optional filters
   * Questions with collegeId = "tutorialspoint" are common questions shown to all colleges
   * Questions with other collegeIds are college-specific
   */
  async getQuestions(
    collegeId?: string,
    classFilter?: string,
    boardFilter?: string,
    subjectFilter?: string
  ): Promise<QuestionBankItem[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return [];// Return empty string instead of throwing error
      }
      
      console.log('\n' + '═'.repeat(80));
      console.log('🔥 FIREBASE SERVICE - getQuestions() called');
      console.log('═'.repeat(80));
      console.log('Parameters received:');
      console.log('  collegeId:', collegeId || 'undefined');
      console.log('  classFilter:', classFilter || 'undefined');
      console.log('  boardFilter:', boardFilter || 'undefined');
      console.log('  subjectFilter:', subjectFilter || 'undefined');
      
      if (classFilter && classFilter !== 'all') {
        console.log('\n📤 CLASS FILTER WILL BE APPLIED:');
        console.log('   where("class", "==", "' + classFilter + '")');
        console.log('   Filter value type:', typeof classFilter);
        console.log('   Filter value length:', classFilter.length);
        console.log('   Filter char codes:', `[${Array.from(classFilter).map(c => c.charCodeAt(0)).join(', ')}]`);
      } else {
        console.log('\n⚠️  NO CLASS FILTER - will return all classes');
      }
      console.log('═'.repeat(80) + '\n');
      
      let questionsQuery = query(
        collection(this.firestore, COLLECTIONS.QUESTION_BANK),
        orderBy('createdAt', 'desc')
      );
      
      // Apply class filter
      if (classFilter && classFilter !== FILTER_VALUES.ALL) {
        questionsQuery = query(questionsQuery, where('class', '==', classFilter));
      }
      
      // Apply board filter
      if (boardFilter && boardFilter !== FILTER_VALUES.ALL) {
        questionsQuery = query(questionsQuery, where('board', '==', boardFilter));
      }
      
      // Apply subject filter
      if (subjectFilter && subjectFilter !== FILTER_VALUES.ALL) {
        questionsQuery = query(questionsQuery, where('subject', '==', subjectFilter));
      }
      
      console.log('\n' + '═'.repeat(80));
      console.log('🔥 FIREBASE - Executing query...');
      console.log('═'.repeat(80));
      
      const querySnapshot = await getDocs(questionsQuery);
      const allQuestions: QuestionBankItem[] = [];
      
      console.log('\n📊 Query returned', querySnapshot.size, 'documents');
      
      querySnapshot.forEach((doc) => {
        const question = this.parseQuestionFromFirestore(doc);
        allQuestions.push(question);
      });
      
      // Log first 3 questions to see actual class values
      if (allQuestions.length > 0) {
        console.log('\n📝 First', Math.min(3, allQuestions.length), 'questions from database:');
        allQuestions.slice(0, 3).forEach((q, i) => {
          console.log(`\n  [${i}] Question ID: ${q.id}`);
          console.log(`      Subject: ${q.subject}`);
          console.log(`      Class: "${q.class}"`);
          console.log(`      Class type: ${typeof q.class}`);
          console.log(`      Class length: ${q.class.length}`);
          console.log(`      Class char codes: [${Array.from(q.class).map(c => c.charCodeAt(0)).join(', ')}]`);
          console.log(`      Board: ${q.board}`);
          
          if (classFilter && classFilter !== 'all') {
            console.log(`      Matches filter? ${q.class === classFilter ? '✓ YES' : '✗ NO'}`);
            if (q.class !== classFilter) {
              console.log(`      Why no match?`);
              console.log(`        DB value: "${q.class}" [${Array.from(q.class).map(c => c.charCodeAt(0)).join(', ')}]`);
              console.log(`        Filter:   "${classFilter}" [${Array.from(classFilter).map(c => c.charCodeAt(0)).join(', ')}]`);
            }
          }
        });
      } else {
        console.log('\n⚠️  NO QUESTIONS RETURNED FROM QUERY!');
        if (classFilter && classFilter !== 'all') {
          console.log('\n🔍 Troubleshooting:');
          console.log('   1. The query was: where("class", "==", "' + classFilter + '")');
          console.log('   2. Check Firebase Console → questionBank collection');
          console.log('   3. Look at the "class" field in documents');
          console.log('   4. Does it match exactly?');
        }
      }
      
      // Filter by collegeId:
      // - Include questions with collegeId = DEFAULT_COLLEGE_ID (common questions for all)
      // - Include questions with matching collegeId (college-specific questions)
      let questions: QuestionBankItem[];
      
      if (collegeId) {
        questions = allQuestions.filter(q => {
          return q.collegeId === DEFAULT_COLLEGE_ID || q.collegeId === collegeId;
        });
        const commonCount = allQuestions.filter(q => q.collegeId === DEFAULT_COLLEGE_ID).length;
        const collegeSpecificCount = questions.length - commonCount;
        console.log(`\n✅ After collegeId filter: ${questions.length} questions (${commonCount} common + ${collegeSpecificCount} college-specific)`);
      } else {
        // If no collegeId provided, show all questions
        questions = allQuestions;
        console.log(`\n✅ Total questions: ${questions.length}`);
      }
      
      console.log('═'.repeat(80) + '\n');
      
      return questions;
      
    } catch (error) {
      console.error('❌ Error fetching questions:', error);
      return [];
    }
  }
  
  /**
   * Get questions with pagination and filtering at Firebase level
   * Filters are applied BEFORE fetching to avoid client-side filtering issues
   * Search is applied client-side after Firebase filters
   */
  async getQuestionsPaginated(
    collegeId: string | undefined,
    classFilter: string | undefined,
    boardFilter: string | undefined,
    subjectFilter: string | undefined,
    questionTypeFilter: 'all' | 'mcq' | 'fitb' | 'long' | 'jumbled' | 'descriptive' | 'code' = 'all',
    proprietaryFilter: 'all' | 'proprietary' | 'common' = 'all',
    pageSize: number = 10,
    currentPage: number = 1,
    searchQuery?: string,
    complexityFilter?: string,
    chapterFilter?: string,
    tagFilter?: string
  ): Promise<{ questions: QuestionBankItem[]; lastDoc: DocumentSnapshot | null; hasMore: boolean; total: number }> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return { questions: [], lastDoc: null, hasMore: false, total: 0 }; // Return empty string instead of throwing error
      }
      
      console.log('🔍 Fetching paginated questions:', {
        collegeId,
        classFilter,
        boardFilter,
        subjectFilter,
        chapterFilter,
        tagFilter,
        questionTypeFilter,
        proprietaryFilter,
        complexityFilter,
        pageSize,
        currentPage,
        searchQuery: searchQuery || 'NONE'
      });
      
      // Build constraints array for proper query construction
      const constraints: any[] = [];
      
      // Apply class filter
      if (classFilter && classFilter !== 'all') {
        constraints.push(where('class', '==', classFilter));
        console.log(`🔍 Applying class filter: "${classFilter}"`);
      }
      
      // Apply board filter
      if (boardFilter && boardFilter !== 'all') {
        constraints.push(where('board', '==', boardFilter));
        console.log(`🔍 Applying board filter: "${boardFilter}"`);
      }
      
      // Apply subject filter
      // IMPORTANT: Firestore queries are case-sensitive!
      // Make sure your database has subjects stored in the same case format
      if (subjectFilter && subjectFilter !== 'all') {
        constraints.push(where('subject', '==', subjectFilter));
        console.log(`🔍 Applying subject filter: "${subjectFilter}"`);
        console.log(`⚠️  Note: Firebase query is case-sensitive. Ensure database subjects match exactly.`);
      }
      
      // Apply question type filter at Firebase level
      if (questionTypeFilter !== 'all') {
        constraints.push(where('type', '==', questionTypeFilter));
        console.log(`🔍 Applying question type filter: "${questionTypeFilter}"`);
      }
      
      // Apply complexity filter at Firebase level if specified
      if (complexityFilter && complexityFilter !== 'all') {
        constraints.push(where('complexity', '==', complexityFilter));
        console.log(`🔍 Applying complexity filter: "${complexityFilter}"`);
      }
      
      // Apply chapter filter at Firebase level if specified
      if (chapterFilter && chapterFilter !== 'all') {
        constraints.push(where('chapter', '==', chapterFilter));
        console.log(`🔍 Applying chapter filter: "${chapterFilter}"`);
      }
      
      // Add orderBy and limit at the end
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(1000)); // Reasonable limit to prevent excessive data fetch
      
      // Build the final query with all constraints
      const questionsQuery = query(
        collection(this.firestore, COLLECTIONS.QUESTION_BANK),
        ...constraints
      );
      
      console.log(`📊 Total constraints applied: ${constraints.length - 2} filters + orderBy + limit`);
      
      const querySnapshot = await getDocs(questionsQuery);
      let allQuestions: QuestionBankItem[] = [];
      
      querySnapshot.forEach((doc) => {
        const question = this.parseQuestionFromFirestore(doc);
        allQuestions.push(question);
      });
      
      // Filter by collegeId
      if (collegeId) {
        allQuestions = allQuestions.filter(q => {
          return q.collegeId === DEFAULT_COLLEGE_ID || q.collegeId === collegeId;
        });
      }
      
      // CRITICAL: Additional client-side subject filter verification
      // This ensures subject filtering works even if Firestore query has issues
      if (subjectFilter && subjectFilter !== 'all') {
        const beforeSubjectFilter = allQuestions.length;
        allQuestions = allQuestions.filter(q => {
          const matches = q.subject === subjectFilter;
          if (!matches) {
            console.log(`⚠️ Filtering out question "${q.id}" - subject mismatch: "${q.subject}" !== "${subjectFilter}"`);
          }
          return matches;
        });
        console.log(`✅ Subject filter verification: ${beforeSubjectFilter} → ${allQuestions.length} questions`);
      }
      
      // Apply proprietary filter (can't be done at Firebase level due to field structure)
      if (proprietaryFilter === 'proprietary') {
        allQuestions = allQuestions.filter(q => q.isProprietaryQuestion === true);
      } else if (proprietaryFilter === 'common') {
        allQuestions = allQuestions.filter(q => !q.isProprietaryQuestion);
      }
      
      // Apply search filter (client-side)
      if (searchQuery && searchQuery.trim().length >= 2) {
        const searchLower = searchQuery.trim().toLowerCase();
        const beforeSearchCount = allQuestions.length;
        
        console.log(`🔎 Applying search filter: "${searchQuery}"`);
        
        allQuestions = allQuestions.filter(q => {
          // Search in question title/text
          const titleMatch = q.questionText?.toLowerCase().includes(searchLower) || false;
          
          // Search in options (for MCQ)
          const optionsMatch = q.options?.some(opt => 
            opt?.toLowerCase().includes(searchLower)
          ) || false;
          
          // Search in correct answers (for FITB)
          const answersMatch = q.correctAnswers?.some(ans => 
            ans?.toLowerCase().includes(searchLower)
          ) || false;
          
          // Search in hint
          const hintMatch = q.hint?.toLowerCase().includes(searchLower) || false;
          
          // Search in solution
          const solutionMatch = q.solution?.toLowerCase().includes(searchLower) || false;
          
          // Search in tags
          const tagsMatch = q.tags?.some(tag => 
            tag?.toLowerCase().includes(searchLower)
          ) || false;
          
          return titleMatch || optionsMatch || answersMatch || hintMatch || solutionMatch || tagsMatch;
        });
        
        console.log(`✅ Search filter applied: ${beforeSearchCount} → ${allQuestions.length} questions`);
        
        if (allQuestions.length > 0) {
          console.log(`📋 First 3 matching questions:`);
          allQuestions.slice(0, 3).forEach((q, idx) => {
            console.log(`  ${idx + 1}. "${q.questionText}" ✓`);
          });
        }
      }
      
      // Apply tag filter (client-side)
      if (tagFilter && tagFilter !== 'all') {
        const beforeTagFilter = allQuestions.length;
        allQuestions = allQuestions.filter(q => 
          q.tags?.some(tag => tag.toLowerCase() === tagFilter.toLowerCase())
        );
        console.log(`✅ Tag filter applied: ${beforeTagFilter} → ${allQuestions.length} questions (tag: "${tagFilter}")`);
      }
      
      // Calculate pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedQuestions = allQuestions.slice(startIndex, endIndex);
      const hasMore = endIndex < allQuestions.length;
      
      console.log(`✅ Paginated: showing ${paginatedQuestions.length} of ${allQuestions.length} questions (page ${currentPage})`);
      if (searchQuery) {
        console.log(`   Search: "${searchQuery}" applied`);
      }
      
      return {
        questions: paginatedQuestions,
        lastDoc: null,
        hasMore,
        total: allQuestions.length
      };
      
    } catch (error) {
      console.error('❌ Error fetching paginated questions:', error);
      return { questions: [], lastDoc: null, hasMore: false, total: 0 };
    }
  }
  
  /**
   * Get available chapters for a specific class and subject
   */
  async getChaptersForSubject(
    collegeId: string,
    classFilter: string,
    subjectFilter: string
  ): Promise<string[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return [];
      }
      
      console.log('📚 Fetching chapters for:', {
        collegeId,
        class: classFilter,
        subject: subjectFilter
      });
      
      // Build query to get all questions for the class and subject
      let questionsQuery = query(
        collection(this.firestore, COLLECTIONS.QUESTION_BANK),
        where('class', '==', classFilter),
        where('subject', '==', subjectFilter)
      );
      
      const querySnapshot = await getDocs(questionsQuery);
      const chaptersSet = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by collegeId (include both tutorialspoint and specific college)
        if (data.collegeId === DEFAULT_COLLEGE_ID || data.collegeId === collegeId) {
          if (data.chapter && data.chapter.trim() !== '') {
            chaptersSet.add(data.chapter);
          }
        }
      });
      
      // Convert set to sorted array
      const chapters = Array.from(chaptersSet).sort();
      
      console.log(`✅ Found ${chapters.length} unique chapters:`, chapters);
      
      return chapters;
      
    } catch (error) {
      console.error('❌ Error fetching chapters:', error);
      return [];
    }
  }
  
  /**
   * Get subject-wise question statistics
   */
  async getSubjectQuestionStats(
    collegeId?: string,
    classFilter?: string,
    boardFilter?: string,
    questionTypeFilter?: string  // Simple string, uses QUESTION_TYPES constants
  ): Promise<SubjectQuestionStats[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      // Helper function to generate subject code from subject name and class
      const generateSubjectCode = (subject: string, classValue: string): string => {
        // Remove special characters and spaces, convert to uppercase
        const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanClass = classValue.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        
        // Take first 4 characters of subject, pad if needed
        const subjectPart = cleanSubject.substring(0, 4).padEnd(4, 'X');
        
        // Take first 4 characters of class, pad if needed
        const classPart = cleanClass.substring(0, 4).padEnd(4, '0');
        
        // Generate a simple hash from the full subject+class string for uniqueness
        let hash = 0;
        const fullString = subject + classValue;
        for (let i = 0; i < fullString.length; i++) {
          hash = ((hash << 5) - hash) + fullString.charCodeAt(i);
          hash = hash & hash; // Convert to 32-bit integer
        }
        const hashPart = Math.abs(hash).toString().substring(0, 4).padStart(4, '0');
        
        // Format: SUBJ-CLSS-HASH (e.g., MATH-CL10-2341)
        return `${subjectPart}-${classPart}-${hashPart}`;
      };
      
      // Fetch all questions with filters
      let questions = await this.getQuestions(collegeId, classFilter, boardFilter);
      
      // Apply question type filter if specified
      if (questionTypeFilter) {
        questions = questions.filter(q => q.type === questionTypeFilter);
        console.log(`📊 Calculating stats for ${questions.length} ${questionTypeFilter} questions`);
      } else {
        console.log(`📊 Calculating stats for ${questions.length} questions`);
      }
      
      // Group by subject (normalize to handle case differences)
      const subjectMap = new Map<string, SubjectQuestionStats>();
      
      questions.forEach(question => {
        // Normalize subject and class for consistent grouping
        const normalizedSubject = question.subject.trim();
        const normalizedClass = question.class.trim();
        
        // Create key ONLY with Subject + Class (board should not create separate boxes)
        const key = `${normalizedSubject.toUpperCase()}-${normalizedClass.toUpperCase()}`;
        
        // Debug logging to track what's happening
        console.log(`🔍 Question: "${question.subject}" | "${question.class}" → Key: "${key}"`);
        
        if (!subjectMap.has(key)) {
          // Generate subject code if not available
          const subjectCode = question.subjectCode || generateSubjectCode(normalizedSubject, normalizedClass);
          
          // For board, use the first board encountered or default
          const firstBoard = question.board.trim().toUpperCase();
          
          subjectMap.set(key, {
            subject: normalizedSubject,
            subjectCode: subjectCode,
            class: normalizedClass,
            board: firstBoard, // Store first board, but it won't affect grouping
            totalQuestions: 0,
            proprietaryQuestions: 0,
            easyQuestions: 0,
            mediumQuestions: 0,
            hardQuestions: 0,
            mcqCount: 0,
            fitbCount: 0,
            longCount: 0,
            jumbledCount: 0,
            descriptiveCount: 0,
            codeCount: 0
          });
        }
        
        const stats = subjectMap.get(key)!;
        
        // Increment counts
        stats.totalQuestions++;
        
        if (question.isProprietaryQuestion) {
          stats.proprietaryQuestions++;
        }
        
        // Complexity counts using constants
        if (question.complexity === COMPLEXITY_LEVELS.EASY) stats.easyQuestions++;
        if (question.complexity === COMPLEXITY_LEVELS.MEDIUM) stats.mediumQuestions++;
        if (question.complexity === COMPLEXITY_LEVELS.HARD) stats.hardQuestions++;
        
        // Type counts using constants (exact matching - database should be standardized)
        if (question.type === QUESTION_TYPES.MCQ) {
          stats.mcqCount++;
        }
        else if (question.type === QUESTION_TYPES.FITB) {
          stats.fitbCount++;
        }
        else if (question.type === QUESTION_TYPES.JUMBLED) {
          stats.jumbledCount++;
        }
        else if (question.type === QUESTION_TYPES.DESCRIPTIVE) {
          stats.descriptiveCount++;
        }
        else if (question.type === QUESTION_TYPES.CODE) {
          stats.codeCount++;
        }
      });
      
      // Convert map to array and sort by subject name
      const statsArray = Array.from(subjectMap.values()).sort((a, b) => 
        a.subject.localeCompare(b.subject)
      );
      
      console.log(`✅ Calculated stats for ${statsArray.length} unique Class + Subject combinations (boards merged)`);
      statsArray.forEach(s => {
        console.log(`   📊 ${s.subject} | Class ${s.class} | Total: ${s.totalQuestions} (MCQ: ${s.mcqCount}, FITB: ${s.fitbCount}, Long: ${s.longCount}, Jumbled: ${s.jumbledCount}, Descriptive: ${s.descriptiveCount}, Code: ${s.codeCount})`);
      });
      
      return statsArray;
      
    } catch (error) {
      console.error('❌ Error calculating subject stats:', error);
      return [];
    }
  }
  
  /**
   * Generate 10-character alphanumeric question ID
   */
  private generateQuestionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'Q'; // Start with Q for Question
    
    for (let i = 0; i < 9; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return id;
  }

  /**
   * Check if question ID already exists
   */
  private async isQuestionIdUnique(questionId: string): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      const questionDoc = await getDoc(doc(this.firestore, COLLECTIONS.QUESTION_BANK, questionId));
      return !questionDoc.exists();
    } catch (error) {
      console.error('Error checking question ID:', error);
      return false;
    }
  }

  /**
   * Generate unique question ID
   */
  private async generateUniqueQuestionId(): Promise<string> {
    let questionId: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      questionId = this.generateQuestionId();
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique question ID after multiple attempts');
      }
    } while (!(await this.isQuestionIdUnique(questionId)));
    
    return questionId;
  }

  /**
   * Add a new question to the question bank
   */
  async addQuestion(questionData: Partial<QuestionBankItem>): Promise<{
    success: boolean;
    questionId?: string;
    error?: string;
  }> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return { success: false, error: 'Firebase not initialized' }; // Return empty string instead of throwing error
      }

      console.log('\n🔥 Adding new question to Firebase...');

      // Validate required fields
      if (!questionData.questionText || !questionData.subject || !questionData.class) {
        throw new Error('Missing required fields: questionText, subject, or class');
      }

      // Generate unique question ID
      const questionId = await this.generateUniqueQuestionId();
      console.log('✅ Generated question ID:', questionId);

      // Get current year for academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1) % 100}`;

      // Prepare base question document
      const questionDoc: any = {
        questionText: questionData.questionText,
        subject: questionData.subject,
        subjectCode: questionData.subjectCode || null,
        class: questionData.class,
        board: questionData.board || '',
        year: questionData.year || academicYear,
        type: questionData.type || 'long',
        complexity: questionData.complexity || 'medium',
        marks: questionData.marks || 1,
        isProprietaryQuestion: questionData.isProprietaryQuestion || false,
        collegeId: questionData.collegeId || DEFAULT_COLLEGE_ID,
        collegeName: questionData.collegeName || 'Tutorials Point',
        createdBy: questionData.createdBy || 'system',
        createdByName: questionData.createdByName || 'System Admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tags: questionData.tags || []
      };

      // Add optional fields if present
      if (questionData.chapter) {
        questionDoc.chapter = questionData.chapter;
      }
      if (questionData.hint) {
        questionDoc.hint = questionData.hint;
      }
      if (questionData.solution) {
        questionDoc.solution = questionData.solution;
      }
      if (questionData.imageUrls) {
        questionDoc.imageUrls = questionData.imageUrls;
      }

      // Add type-specific fields
      if (questionData.type === QUESTION_TYPES.MCQ) {
        if (!questionData.options || questionData.options.length < 2) {
          throw new Error('MCQ questions must have at least 2 options');
        }
        questionDoc.options = questionData.options;
        
        // Support both old format (correctAnswer as index) and new format (correctAnswers as array)
        if (questionData.correctAnswers && Array.isArray(questionData.correctAnswers)) {
          // New format: array of correct answer strings
          questionDoc.correctAnswers = questionData.correctAnswers;
          console.log('📝 MCQ Question (Multiple Correct Answers):');
          console.log('   Options:', questionData.options);
          console.log('   Correct Answers:', questionData.correctAnswers);
        } else {
          // Old format: single index
          questionDoc.correctAnswers = [questionData.correctAnswers ?? 0];
          console.log('📝 MCQ Question (Single Correct Answer):');
          console.log('   Options:', questionData.options);
        }
      } 
      else if (questionData.type === QUESTION_TYPES.FITB) {
        if (!questionData.correctAnswers || questionData.correctAnswers.length === 0) {
          throw new Error('FITB questions must have at least one correct answer');
        }
        questionDoc.correctAnswers = questionData.correctAnswers;
        
        console.log('📝 FITB Question:');
        console.log('   Correct Answers:', questionData.correctAnswers);
      }
      else if (questionData.type === QUESTION_TYPES.JUMBLED) {
        // Store both correctAnswers (the correct order) and jumbledItems (shuffled for display)
        if (!questionData.correctAnswers || questionData.correctAnswers.length === 0) {
          throw new Error('Jumbled questions must have correctAnswers');
        }
        questionDoc.correctAnswers = questionData.correctAnswers;
        
        // If jumbledItems provided, use it; otherwise create shuffled version
        if (questionData.jumbledItems && questionData.jumbledItems.length > 0) {
          questionDoc.jumbledItems = questionData.jumbledItems;
        } else {
          // Create shuffled version from correctAnswers
          questionDoc.jumbledItems = [...questionData.correctAnswers].sort(() => Math.random() - 0.5);
        }
        
        console.log('📝 Jumbled Question:');
        console.log('   Correct Answers:', questionData.correctAnswers);
        console.log('   Jumbled Items:', questionDoc.jumbledItems);
      }
      else if (questionData.type === QUESTION_TYPES.CODE) {
        // Programming language
        if (questionData.programmingLanguage) {
          questionDoc.programmingLanguage = questionData.programmingLanguage;
        }
        
        // Test cases with marks per test case
        if (questionData.testCases && Array.isArray(questionData.testCases)) {
          questionDoc.testCases = questionData.testCases;
        } else {
          questionDoc.testCases = [];
        }
        
        // Test stub (starter code)
        if (questionData.testStub) {
          questionDoc.testStub = questionData.testStub;
        }
        
        console.log('📝 Code Question:');
        console.log('   Programming Language:', questionData.programmingLanguage || 'Not specified');
        console.log('   Test Cases:', questionData.testCases?.length || 0);
        console.log('   Has Test Stub:', !!questionData.testStub);
      }

      // Save to Firestore
      await setDoc(doc(this.firestore, COLLECTIONS.QUESTION_BANK, questionId), questionDoc);

      console.log(`✅ Question ${questionId} added successfully!`);
      console.log('   Type:', questionDoc.type);
      console.log('   Subject:', questionDoc.subject);
      console.log('   Class:', questionDoc.class);
      console.log('   Board:', questionDoc.board);
      console.log('   College:', questionDoc.collegeId);
      console.log('   Proprietary:', questionDoc.isProprietaryQuestion);

      // Log activity (non-blocking - won't affect question creation)
      try {
        await this.addActivityLog({
          userId: questionDoc.createdBy,
          collegeId: questionDoc.collegeId,
          action: 'create_question',
          entityType: 'question',
          entityId: questionId,
          details: JSON.stringify({
            questionText: questionDoc.questionText.substring(0, 100), // First 100 chars
            type: questionDoc.type,
            subject: questionDoc.subject,
            class: questionDoc.class,
            board: questionDoc.board,
            marks: questionDoc.marks,
            complexity: questionDoc.complexity
          })
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log question creation (non-critical):', logError);
      }

      return {
        success: true,
        questionId
      };

    } catch (error: any) {
      console.error('❌ Error adding question:', error);
      return {
        success: false,
        error: error.message || 'Failed to add question'
      };
    }
  }

  /**
   * Create a new question using unified types
   * Handles all question types with centralized transformation
   */
  async createQuestion(input: CreateQuestionInput): Promise<CreateQuestionResult> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return { success: false, error: 'Firebase not initialized' };
      }

      console.log('\n🔥 Creating new question...');
      console.log('Question input:', input);

      // Transform input to Question format using unified function
      const questionData = createQuestionInputToQuestion(input);
      
      // Validate the transformed data
      const validation = validateQuestionData(questionData);
      if (!validation.valid) {
        console.error('❌ Validation failed:', validation.errors);
        return { 
          success: false, 
          error: validation.errors.join(', ') 
        };
      }
      
      // Use the existing addQuestion method for storage
      const result = await this.addQuestion(questionData);
      
      if (!result.success) {
        console.error('❌ Failed to add question:', result.error);
      } else {
        console.log('✅ Question created successfully!');
      }
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Error creating question:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create question' 
      };
    }
  }

  /**
   * Upload question image to Firebase Storage
   * @param collegeId - College ID for organizing images
   * @param file - Image file to upload
   * @returns Download URL of the uploaded image
   */
  async uploadQuestionImage(collegeId: string, file: File): Promise<string> {
    try {
      if (!this.storage) throw new Error('Firebase Storage not initialized');
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload a valid image file');
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image size should be less than 10MB');
      }
      
      // Generate unique filename with timestamp
      const fileExtension = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `questions/${collegeId}/${timestamp}_${randomStr}.${fileExtension}`;
      
      // Create storage reference
      const storageRef = ref(this.storage, fileName);
      
      // Upload file
      console.log('📤 Uploading image to Firebase Storage...');
      const snapshot = await uploadBytes(storageRef, file);
      console.log('✅ Image uploaded successfully');
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('🔗 Image URL:', downloadURL);
      
      return downloadURL;
    } catch (error: any) {
      console.error('❌ Error uploading image:', error);
      throw new Error(error.message || 'Failed to upload image. Please try again.');
    }
  }

  /**
   * Get question by ID
   */
  async getQuestionById(questionId: string): Promise<QuestionBankItem | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return null as any; // Return empty string instead of throwing error
      }
      
      const questionDoc = await getDoc(doc(this.firestore, COLLECTIONS.QUESTION_BANK, questionId));
      
      if (!questionDoc.exists()) {
        return null;
      }
      
      return this.parseQuestionFromFirestore(questionDoc);
      
    } catch (error) {
      console.error('Error fetching question:', error);
      return null;
    }
  }
  
  /**
   * Get questions by specific filters (subject, class, board, type)
   */
  async getQuestionsByFilters(
    collegeId: string,
    subject: string,
    className: string,
    board: string,
    questionType?: QuestionType
  ): Promise<QuestionBankItem[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return [];// Return empty string instead of throwing error
      }
      
      // Fetch all questions for the subject, class, and board
      const questions = await this.getQuestions(collegeId, className, board, subject);
      
      // Filter by question type if specified
      let filteredQuestions = questions;
      if (questionType) {
        filteredQuestions = questions.filter(q => q.type === questionType);
      }
      
      // Sort by complexity (hard -> medium -> easy) and then by created date
      filteredQuestions.sort((a, b) => {
        const complexityOrder = { 'hard': 1, 'medium': 2, 'easy': 3 };
        const complexityDiff = complexityOrder[a.complexity] - complexityOrder[b.complexity];
        
        if (complexityDiff !== 0) return complexityDiff;
        
        // If same complexity, sort by date (newest first)
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any).toDate().getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any).toDate().getTime();
        return bTime - aTime;
      });
      
      console.log(`✅ Fetched ${filteredQuestions.length} questions for ${subject} - ${className} - ${board}${questionType ? ` (${questionType})` : ''}`);
      return filteredQuestions;
      
    } catch (error) {
      console.error('❌ Error fetching questions by filters:', error);
      return [];
    }
  }
  
  // ==================== NOTIFICATIONS ====================
  
  /**
   * Get notifications for user
   */
  async getNotifications(
    userType: UserType, 
    collegeId?: string
  ): Promise<NotificationModel[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      let notificationsQuery = query(
        collection(this.firestore, COLLECTIONS.NOTIFICATIONS),
        where('targetUserTypes', 'array-contains-any', ['all', userType]),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(notificationsQuery);
      const notifications = snapshot.docs.map(doc => this.parseNotificationFromFirestore(doc));
      
      // Filter by college if specified
      if (collegeId) {
        return notifications.filter(n => !n.collegeId || n.collegeId === collegeId);
      }
      
      return notifications;
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }
  
  /**
   * Create notification
   */
  async createNotification(notificationData: Omit<NotificationModel, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return ''; // Return empty string instead of throwing error
      }
      
      const notificationRef = doc(collection(this.firestore, COLLECTIONS.NOTIFICATIONS));
      
      await setDoc(notificationRef, {
        ...notificationData,
        createdAt: serverTimestamp()
      });
      
      return notificationRef.id;
      
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }
  
  // ==================== NOTICES ====================
  
  /**
   * Get notices for a specific college and user type
   */
  async getNotices(collegeId: string, userType: string): Promise<NoticeModel[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty string instead of throwing error
      }
      
      const noticesRef = collection(this.firestore, COLLECTIONS.NOTIFICATIONS);
      const q = query(
        noticesRef,
        where('collegeId', '==', collegeId),
        where('status', '==', USER_STATUS.ACTIVE),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const notices: NoticeModel[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Check if notice is for this user type
        if (data.targetAudience === 'all' || data.targetAudience === userType) {
          notices.push(this.parseNoticeFromFirestore(doc));
        }
      });
      
      return notices;
      
    } catch (error) {
      console.error('Error fetching notices:', error);
      return [];
    }
  }
  
  /**
   * Subscribe to real-time notice updates
   */
  subscribeToNotices(
    collegeId: string, 
    userType: string, 
    callback: (notices: NoticeModel[]) => void
  ): (() => void) | null {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return () => {}; // Return empty string instead of throwing error
      }
      
      const noticesRef = collection(this.firestore, COLLECTIONS.NOTIFICATIONS);
      const q = query(
        noticesRef,
        where('collegeId', '==', collegeId),
        where('status', '==', USER_STATUS.ACTIVE),
        orderBy('createdAt', 'desc')
      );
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notices: NoticeModel[] = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          
          // Check if notice is for this user type
          if (data.targetAudience === 'all' || data.targetAudience === userType) {
            notices.push(this.parseNoticeFromFirestore(doc));
          }
        });
        
        callback(notices);
      }, (error) => {
        console.error('Error in notices subscription:', error);
      });
      
      return unsubscribe;
      
    } catch (error) {
      console.error('Error setting up notices subscription:', error);
      return null;
    }
  }
  
  /**
   * Mark notice as read
   */
  async markNoticeAsRead(noticeId: string, userId: string): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      
      const noticeRef = doc(this.firestore, COLLECTIONS.NOTIFICATIONS, noticeId);
      const noticeDoc = await getDoc(noticeRef);
      
      if (!noticeDoc.exists()) {
        console.error('Notice not found');
        return false;
      }
      
      const data = noticeDoc.data();
      const readBy = data.readBy || [];
      
      // Only update if user hasn't read it yet
      if (!readBy.includes(userId)) {
        await updateDoc(noticeRef, {
          readBy: [...readBy, userId],
          views: increment(1)
        });
      }
      
      return true;
      
    } catch (error) {
      console.error('Error marking notice as read:', error);
      return false;
    }
  }
  
  /**
   * Delete notice
   */
  async deleteNotice(noticeId: string): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      
      const noticeRef = doc(this.firestore, COLLECTIONS.NOTIFICATIONS, noticeId);
      await deleteDoc(noticeRef);
      
      return true;
      
    } catch (error) {
      console.error('Error deleting notice:', error);
      return false;
    }
  }
  
  /**
   * Parse notice from Firestore document
   */
  private parseNoticeFromFirestore(doc: DocumentSnapshot): NoticeModel {
    const data = doc.data() as DocumentData;
    
    return {
      id: doc.id,
      title: data.title || '',
      content: data.content || '',
      priority: data.priority || 'medium',
      category: data.category || 'general',
      targetAudience: data.targetAudience || 'all',
      expiryDate: data.expiryDate,
      status: data.status || NOTIFICATION_STATUS.ACTIVE,
      collegeId: data.collegeId || '',
      collegeName: data.collegeName || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()) || new Date(),
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
      createdByRole: data.createdByRole || '',
      updatedAt: data.updatedAt?.toDate() || new Date(),
      readBy: data.readBy || [],
      views: data.views || 0
    };
  }
  
  // ==================== STORAGE ====================
  
  /**
   * Upload file to Firebase Storage
   */
  async uploadFile(
    file: File, 
    path: string
  ): Promise<string | null> {
    try {
      if (!this.storage) throw new Error('Firebase not initialized');
      
      const storageRef = ref(this.storage, path);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  }
  
  /**
   * Delete file from Firebase Storage
   */
  async deleteFile(path: string): Promise<boolean> {
    try {
      if (!this.storage) throw new Error('Firebase not initialized');
      
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
      
      return true;
      
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
  
  // ==================== HELPER METHODS ====================
  
  /**
   * Parse user from Firestore document
   */
  private parseUserFromFirestore(doc: DocumentSnapshot): UserModel {
    const data = doc.data() as DocumentData;
    
    return {
      userId: doc.id,
      fullName: (data.fullName && data.fullName !== 'Current User') ? data.fullName : data.email?.split('@')[0] || '',
      title: data.title || '',  // ✅ ADDED: Read title from Firestore
      profilePicture: data.profilePicture || '',  // ✅ ADDED: Read profilePicture from Firestore
      proctoringPhotos: data.proctoringPhotos || { front: null, left: null, right: null },  // ✅ ADDED: Read proctoring photos
      //questionText: data.questionText || '',
      email: data.email || '',
      phone: data.phone || '',
      phoneRaw: data.phoneRaw || '',
      userType: data.userType || 'student',
      permissions: this.parsePermissions(data.permissions || {}),
      status: data.status || NOTIFICATION_STATUS.ACTIVE,
      board: data.board || 'Not Specified',
      collegeId: data.collegeId,
      collegeName: data.collegeName,
      createdBy: data.createdBy || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()) || null,
      updatedAt: data.updatedAt?.toDate() || null,
      
      // Security fields
      mustChangePassword: data.mustChangePassword || false,
      firstLogin: data.firstLogin || false,
      passwordChangedAt: data.passwordChangedAt?.toDate() || null,
      temporaryPassword: data.temporaryPassword || false,
      accountLocked: data.accountLocked || false,
      failedLoginAttempts: data.failedLoginAttempts || 0,
      lastLoginAt: data.lastLoginAt?.toDate() || null,
      
      // Student-specific
      studentRoll: data.studentRoll,
      academicYear: data.academicYear,
      studentClass: data.studentClass,
      parentPhone: data.parentPhone,
      studentHistory: data.studentHistory || [],
      
      // Teacher-specific
      teacherClasses: data.teacherClasses || [],
      teacherSubjects: data.teacherSubjects || []
    };
  }
  
  /**
   * Parse permissions
   */
  private parsePermissions(data: any): UserPermissions {
    return {
      canEvaluate: data.canEvaluate || false,
      canViewReports: data.canViewReports || false,
      canManageUsers: data.canManageUsers || false,
      canManageColleges: data.canManageColleges || false,
      canManageRooms: data.canManageRooms || false,
      canManageClasses: data.canManageClasses || false,
      canManageSubjects: data.canManageSubjects || false,
      canManageBoards: data.canManageBoards || false,
      canManageExamTypes: data.canManageExamTypes || false,
      canManageSystem: data.canManageSystem || false,
      canAccessAllColleges: data.canAccessAllColleges || false,
      level: data.level || 'personal'
    };
  }
  
  /**
   * Parse college from Firestore document
   */
  private parseCollegeFromFirestore(doc: DocumentSnapshot): CollegeModel {
    const data = doc.data() as DocumentData;
    
    return {
      collegeId: doc.id,
      collegeName: data.collegeName || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      phone: data.phone || '',
      email: data.email || '',
      website: data.website || '',
      establishedYear: data.establishedYear,
      collegeType: data.collegeType || 'school',
      supportedBoards: data.supportedBoards || [],
      subjects: data.subjects || [],
      validClasses: data.validClasses || [],
      examTypes: data.examTypes || [],
      features: data.features || [],
      boardWiseCounts: data.boardWiseCounts || {},
      roleCounts: data.roleCounts || {
        system_admin: 0,
        admin: 0,
        principal: 0,
        dean: 0,
        teacher: 0,
        student: 0
      },
      totalTeachers: data.totalTeachers || 0,
      totalStudents: data.totalStudents || 0,
      totalRooms: data.totalRooms || 0,
      status: data.status || NOTIFICATION_STATUS.ACTIVE,
      createdBy: data.createdBy || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()) || null,
      updatedAt: data.updatedAt?.toDate() || null
    };
  }
  
  /**
   * Parse room from Firestore document
   */
  /**
   * Parse notification from Firestore document
   */
  private parseNotificationFromFirestore(doc: DocumentSnapshot): NotificationModel {
    const data = doc.data() as DocumentData;
    
    return {
      id: doc.id,
      title: data.title || '',
      message: data.message || '',
      sentBy: data.sentBy || '',
      sentByName: data.sentByName || '',
      sentByRole: data.sentByRole || '',
      collegeId: data.collegeId,
      collegeName: data.collegeName,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()) || new Date(),
      targetUserTypes: data.targetUserTypes || ['all'],
      priority: data.priority || 'medium',
      type: data.type || 'announcement'
    };
  }
  
  /**
   * Parse exam from Firestore document
   */
private parseExamFromFirestore(doc: DocumentSnapshot): ExamModel {
  console.log('🔍 [FIREBASE_SERVICE] parseExamFromFirestore called for doc:', doc.id);
  const data = doc.data() as DocumentData;
  
  // ✅ ADD THIS COMPLETE DEBUG BLOCK
  console.log('🔥🔥🔥 RAW FIRESTORE DATA:', {
    examId: doc.id,
    examTitle: data?.title,
    examClass: data?.class,
    examSubject: data?.subject,
    hasCompletionPolicy: 'completionPolicy' in data,
    completionPolicyValue: data?.completionPolicy,
    completionPolicyType: typeof data?.completionPolicy,
    allFields: data ? Object.keys(data) : [],
    firstFewCharsOfEachField: data ? Object.keys(data).reduce((acc, key) => {
      acc[key] = typeof data[key] === 'string' ? data[key].substring(0, 30) : typeof data[key];
      return acc;
    }, {} as any) : {}
  });
  
  if (!data) {
    console.error('❌ [FIREBASE_SERVICE] Document data is null/undefined for:', doc.id);
  } else {
      console.log('🔍 [FIREBASE_SERVICE] Document data keys:', Object.keys(data));
      console.log('🔍 [FIREBASE_SERVICE] Raw document data:', {
        id: doc.id,
        type: data.type,
        title: data.title,
        mode: data.mode,
        status: data.status,
        class: data.class,
        board: data.board,
        examDate: data.examDate,
        examTime: data.examTime,
        totalStudents: data.totalStudents,  // ✅ ADDED: Show totalStudents
        collegeId: data.collegeId,  // ✅ Show collegeId
        college_id: data.college_id,  // ✅ Check alternative name
        createdBy: data.createdBy,
        createdByRole: data.createdByRole,
        questionPaperImagesCount: data.questionPaperImages?.length || 0,
        questionsListCount: data.questionsList?.length || 0,
        hasQuestionPool: !!data.questionPool,
        questionPoolCount: data.questionPool?.length || 0,
        pickRandomCount: data.pickRandomCount,
        poolQuestionMarks: data.poolQuestionMarks
      });
      
      // ✅ ADDED: Explicit field comparison
      console.log('🔍 [FIREBASE_SERVICE] Critical fields comparison:', {
        'totalStudents': {
          value: data.totalStudents,
          type: typeof data.totalStudents,
          exists: 'totalStudents' in data,
          truthy: !!data.totalStudents
        },
        'collegeId': {
          value: data.collegeId,
          type: typeof data.collegeId,
          exists: 'collegeId' in data,
          truthy: !!data.collegeId
        }
      });
      
      // ✅ ADDED: Explicit collegeId check
      console.log('🏢 [FIREBASE_SERVICE] College ID fields check:', {
        'data.collegeId': data.collegeId,
        'data.college_id': data.college_id,
        'data.collegeName': data.collegeName,
        'collegeId exists': 'collegeId' in data,
        'college_id exists': 'college_id' in data
      });
    }
    
    // Parse questionsList to ensure all fields are preserved
    const parsedQuestionsList = data.questionsList ? data.questionsList.map((q: any) => {
      // Normalize type to standard question types
      // All types should now be: 'mcq', 'fitb', 'jumbled', 'code', 'descriptive'
      let normalizedType = q.type?.toLowerCase() || QUESTION_TYPES.DESCRIPTIVE;
      
      // Validate and standardize type
      const validTypes = Object.values(QUESTION_TYPES);
      if (!validTypes.includes(normalizedType)) {
        // Fallback to descriptive for invalid types
        normalizedType = QUESTION_TYPES.DESCRIPTIVE;
      }
      
      // Handle marks: Firebase uses 'maxMarks', frontend uses 'marks' and 'maximumMarks'
      const marksValue = typeof q.maxMarks === 'number' ? q.maxMarks : 
                        (typeof q.maximumMarks === 'number' ? q.maximumMarks : 
                        (typeof q.marks === 'number' ? q.marks : 0));
      
      // Handle question text: Firebase uses 'description', frontend uses 'questionText'
      const questionTextValue = q.description || q.questionText || q.title || '';
      const titleValue = q.title || q.description || q.questionText || '';
      
      // Ensure all critical fields are present
      const parsedQuestion: any = {
        id: q.id || '',
        type: normalizedType,
        questionText: questionTextValue,
        title: titleValue,
        maximumMarks: marksValue,
        marks: marksValue,
        source: q.source || 'custom'
      };
      
      // Copy optional fields if they exist
      if (q.complexity) parsedQuestion.complexity = q.complexity;
      if (q.board) parsedQuestion.board = q.board;
      if (q.options) parsedQuestion.options = q.options;
      if (q.correctAnswers) parsedQuestion.correctAnswers = q.correctAnswers;
      if (typeof q.correctAnswer === 'number') parsedQuestion.correctAnswer = q.correctAnswer;
      if (q.hint) parsedQuestion.hint = q.hint;
      if (q.chapter) parsedQuestion.chapter = q.chapter;
      if (q.solution) parsedQuestion.solution = q.solution;
      if (q.createdByName) parsedQuestion.createdByName = q.createdByName;
      if (q.createdAt) parsedQuestion.createdAt = q.createdAt;
      if (typeof q.isProprietaryQuestion === 'boolean') parsedQuestion.isProprietaryQuestion = q.isProprietaryQuestion;
      if (q.questionBankId) parsedQuestion.questionBankId = q.questionBankId;
      
      // Code question specific fields
      // Firebase uses 'language' and 'boilerplate', frontend uses 'programmingLanguage' and 'testStub'
      if (q.language) parsedQuestion.programmingLanguage = q.language;
      if (q.programmingLanguage) parsedQuestion.programmingLanguage = q.programmingLanguage;
      if (q.programming_language) parsedQuestion.programming_language = q.programming_language;
      if (q.boilerplate) parsedQuestion.testStub = q.boilerplate;
      if (q.testStub) parsedQuestion.testStub = q.testStub;
      if (q.testCases) parsedQuestion.testCases = q.testCases;
      
      // Jumbled question specific fields
      // Firebase stores as 'jumbledOptions' or 'jumbledItems', copy both for compatibility
      if (q.jumbledOptions) parsedQuestion.jumbledOptions = q.jumbledOptions;
      if (q.jumbledItems) parsedQuestion.jumbledItems = q.jumbledItems;
      
      // Image URLs
      if (q.imageUrls && Array.isArray(q.imageUrls)) parsedQuestion.imageUrls = q.imageUrls;
      
      return parsedQuestion;
    }) : [];
    
    console.log(`📋 [FIREBASE_SERVICE] Parsed ${parsedQuestionsList.length} questions with preserved fields`);
    if (parsedQuestionsList.length > 0) {
      const firstQ = parsedQuestionsList[0];
      const rawFirstQ = data.questionsList[0];
      console.log('  Sample question RAW from Firebase:', {
        type: rawFirstQ.type,
        maxMarks: rawFirstQ.maxMarks,
        description: rawFirstQ.description?.substring(0, 30) + '...',
        title: rawFirstQ.title?.substring(0, 30) + '...'
      });
      console.log('  Sample question PARSED for frontend:', {
        type: firstQ.type,
        marks: firstQ.marks,
        maximumMarks: firstQ.maximumMarks,
        questionText: firstQ.questionText?.substring(0, 30) + '...',
        title: firstQ.title?.substring(0, 30) + '...'
      });
    }
    
    // 🔥 CRITICAL DEBUG: Show raw questionPool data BEFORE parsing
    console.log('🔥🔥🔥 RAW FIREBASE DATA - QUESTION POOL FIELDS:', {
      hasQuestionPool: 'questionPool' in data,
      questionPoolType: typeof data.questionPool,
      questionPoolValue: data.questionPool,
      questionPoolLength: Array.isArray(data.questionPool) ? data.questionPool.length : 'not array',
      hasPickRandomCount: 'pickRandomCount' in data,
      pickRandomCountValue: data.pickRandomCount,
      hasPoolQuestionMarks: 'poolQuestionMarks' in data,
      poolQuestionMarksValue: data.poolQuestionMarks,
      allDataKeys: Object.keys(data)
    });
    
    const parsedExam = {
      id: doc.id,
      type: data.type || '',
      typeColor: data.typeColor || 'blue',
      year: data.year || '',
      class: data.class || '',
      subject: data.subject || '',
      title: data.title || '',  // ✅ FIXED: Added missing title field
      board: data.board || '',
      status: data.status || 'upcoming',
      mode: data.mode || 'offline',
      securityLevel: data.securityLevel,
      attendance: data.attendance,
      avProctoring: data.avProctoring,
      examDate: data.examDate || '',
      examTime: data.examTime || '',
      duration: data.duration || '',
      completionPolicy: data.completionPolicy || 'strict',
      totalQuestions: data.totalQuestions || 0,
      maxMarks: data.maxMarks || '0',
      totalStudents: data.totalStudents || 0,
      // Handle both formats: questionPaperPages (new, from Storage) and questionPaperImages (old, base64)
      questionPaperImages: data.questionPaperPages 
        ? data.questionPaperPages.map((page: any) => page.image_url) // New format: extract URLs from {page_number, image_url}
        : (data.questionPaperImages || []), // Old format: direct array of URLs/base64
      questionsList: parsedQuestionsList,
      // Question Pool fields for random selection
      questionPool: data.questionPool || [],
      pickRandomCount: data.pickRandomCount || 0,
      poolQuestionMarks: data.poolQuestionMarks || 0,
      collegeId: data.collegeId,  // ✅ NO FALLBACK - must be present in Firestore
      collegeName: data.collegeName || '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()) || new Date(),
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
      createdByRole: data.createdByRole || '',
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
    };
    
    console.log('🔥 PARSER - completionPolicy:', data.completionPolicy, '→', parsedExam.completionPolicy);

    // 🔥 CRITICAL DEBUG: Verify questionPool fields are in parsedExam
    console.log('🔥🔥🔥 PARSED EXAM - QUESTION POOL FIELDS:', {
      hasQuestionPool: 'questionPool' in parsedExam,
      questionPoolValue: (parsedExam as any).questionPool,
      questionPoolLength: Array.isArray((parsedExam as any).questionPool) ? (parsedExam as any).questionPool.length : 'not array',
      pickRandomCount: (parsedExam as any).pickRandomCount,
      poolQuestionMarks: (parsedExam as any).poolQuestionMarks
    });
    
    // ✅ CRITICAL CHECK: collegeId must exist
    if (!parsedExam.collegeId) {
      console.error('🚨 [FIREBASE_SERVICE] CRITICAL ERROR: Exam document is missing collegeId field!');
      console.error('📋 Exam details:', {
        examId: doc.id,
        examTitle: parsedExam.title,
        examClass: parsedExam.class,
        examBoard: parsedExam.board,
        createdBy: parsedExam.createdBy,
        createdByName: parsedExam.createdByName
      });
      console.error('📄 Available fields in Firestore document:', Object.keys(data));
      console.error('⚠️ This exam MUST have a collegeId field in Firestore!');
      console.error('💡 Raw collegeId value from Firestore:', {
        value: data.collegeId,
        type: typeof data.collegeId,
        isUndefined: data.collegeId === undefined,
        isNull: data.collegeId === null,
        isEmpty: data.collegeId === '',
      });
    } else {
      console.log('✅ [FIREBASE_SERVICE] Exam has collegeId:', parsedExam.collegeId);
    }
    
    console.log('✅ [FIREBASE_SERVICE] Parsed exam:', {
      id: parsedExam.id,
      title: parsedExam.title,
      totalStudents: parsedExam.totalStudents,  // ✅ Show what was parsed
      avProctoring: (parsedExam as any).avProctoring,  // ✅ Show avProctoring value
      attendance: parsedExam.attendance,  // ✅ Show attendance for comparison
      collegeId: parsedExam.collegeId,  // ✅ Show what was parsed
      collegeName: parsedExam.collegeName,
      hasQuestionsList: !!parsedExam.questionsList,
      questionsCount: parsedExam.questionsList?.length || 0,
      hasQuestionPool: !!(parsedExam as any).questionPool,
      questionPoolCount: ((parsedExam as any).questionPool || []).length,
      pickRandomCount: (parsedExam as any).pickRandomCount,
      poolQuestionMarks: (parsedExam as any).poolQuestionMarks
    });
    
    // CRITICAL DEBUG: Check if examTime is being retrieved
    if (data.examTime) {
      console.log(`🕐 [EXAM TIME DEBUG] ${parsedExam.id}: Firebase has examTime="${data.examTime}", Parsed has examTime="${parsedExam.examTime}"`);
    } else {
      console.log(`⚠️ [EXAM TIME DEBUG] ${parsedExam.id}: No examTime in Firebase document`);
    }
    
    return parsedExam;
  }
  
  /**
   * Check if user has specific permission
   */
  hasPermission(user: UserModel, permission: keyof UserPermissions): boolean {
    return user.permissions[permission] === true;
  }
  
  /**
   * Check if user is system admin
   */
  isSystemAdmin(user: UserModel): boolean {
    return user.userType === 'system_admin' && user.permissions.canAccessAllColleges;
  }
  
  /**
   * Check if user is admin
   */
  isAdmin(user: UserModel): boolean {
    return user.userType === 'admin' || user.userType === 'system_admin';
  }
  
  /**
   * Check if user belongs to same college
   */
  isSameCollege(user: UserModel, collegeId: string): boolean {
    return user.collegeId === collegeId;
  }
  
  /**
   * Get user type display name
   */
  getUserTypeDisplayName(userType: UserType): string {
    const names: Record<UserType, string> = {
      system_admin: 'System Admin',
      super_admin: 'Super Admin',
      admin: 'Admin',
      principal: 'Principal',
      dean: 'Dean',
      teacher: 'Teacher',
      student: 'Student',
    };
    return names[userType] || 'Unknown';
  }

  // ==================== PASSWORD RESET WITH OTP ====================
  
  /**
   * Generate a 4-digit OTP
   */
  private generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  
  /**
   * Encode email for use as Firestore document ID
   * Replaces . with _dot_ and @ with _at_
   */
  private encodeEmailForDocId(email: string): string {
    return email.toLowerCase().replace(/\./g, '_dot_').replace(/@/g, '_at_');
  }
  
  /**
   * Send OTP to email for password reset
   */
  async sendPasswordResetOTP(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return { success: false, error: 'Firebase not initialized' };// Return empty string instead of throwing error
      }
      
      console.log('🔍 Starting password reset for:', email);
      
      // Check if user exists
      if (!this.firestore) throw new Error('Firestore not initialized');
      const usersRef = collection(this.firestore, COLLECTIONS.USERS);
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      
      console.log('🔍 Checking if user exists...');
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('❌ No user found with email:', email);
        return {
          success: false,
          error: 'No account found with this email address'
        };
      }
      
      console.log('✅ User found');
      
      // Generate OTP
      const otp = this.generateOTP();
      const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      
      // Encode email for document ID
      const encodedEmail = this.encodeEmailForDocId(email);
      console.log('🔍 Encoded email for doc ID:', encodedEmail);
      
      // Store OTP in Firestore
      const otpRef = doc(this.firestore, COLLECTIONS.PASSWORD_RESET_OTPS, encodedEmail);
      console.log('🔍 Attempting to write to Firestore path: passwordResetOTPs/', encodedEmail);
      
      await setDoc(otpRef, {
        otp: otp,
        email: email.toLowerCase(),
        expiresAt: expiryTime,
        createdAt: new Date(),
        used: false
      });
      
      console.log('✅ OTP stored successfully in Firestore');
      
      // Send email via API call
      const emailSent = await this.sendOTPEmail(email, otp);
      
      if (!emailSent) {
        return {
          success: false,
          error: 'Failed to send OTP email. Please try again.'
        };
      }
      
      console.log('✅ OTP sent successfully');
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Send OTP error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to send OTP'
      };
    }
  }
  
/**
   * Send OTP via email (using contact@tutorialspoint.com)
   */
  private async sendOTPEmail(toEmail: string, otp: string): Promise<boolean> {
    try {
      if (!this.functions) {
        throw new Error('Firebase Functions not initialized');
      }

      console.log(`📧 Sending OTP email to: ${toEmail}`);
      
      // Call the Cloud Function to send OTP email
      const sendOTPEmailFn = httpsCallable(this.functions, 'sendOTPEmail');
      
      const result = await sendOTPEmailFn({
        email: toEmail,
        otp: otp,
        name: 'User'
      });
      
      const response = result.data as { success: boolean; message: string };
      
      if (response.success) {
        console.log(`✅ OTP email sent successfully to: ${toEmail}`);
        return true;
      } else {
        console.error(`❌ Failed to send OTP email:`, response.message);
        return false;
      }
      
  } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      // Log OTP to console as fallback for development
      console.log(`📧 [FALLBACK] OTP for ${toEmail}: ${otp}`);
      return false;
    }
  }
  
  /**
   * Verify OTP for password reset
   */
  async verifyPasswordResetOTP(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return { success: false, error: 'Firebase not initialized' };// Return empty string instead of throwing error
      }
      
      const encodedEmail = this.encodeEmailForDocId(email);
      const otpRef = doc(this.firestore, COLLECTIONS.PASSWORD_RESET_OTPS, encodedEmail);
      const otpDoc = await getDoc(otpRef);
      
      if (!otpDoc.exists()) {
        return {
          success: false,
          error: 'Invalid or expired OTP'
        };
      }
      
      const otpData = otpDoc.data();
      
      // Check if OTP is already used
      if (otpData.used) {
        return {
          success: false,
          error: 'This OTP has already been used'
        };
      }
      
      // Check if OTP is expired
      const expiryTime = otpData.expiresAt.toDate();
      if (new Date() > expiryTime) {
        return {
          success: false,
          error: 'OTP has expired. Please request a new one'
        };
      }
      
      // Verify OTP
      if (otpData.otp !== otp) {
        return {
          success: false,
          error: 'Invalid OTP. Please check and try again'
        };
      }
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify OTP'
      };
    }
  }
  
  /**
   * Reset password with verified OTP
   */
  /**
   * Reset password with verified OTP
   * This method calls a secure Cloud Function that uses Firebase Admin SDK
   * to update the password without storing it in plain text
   */
  async resetPasswordWithOTP(email: string, otp: string, newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      if (!this.functions) throw new Error('Firebase Functions not initialized');
      
      // Validate input on client side
      if (!email || !otp || !newPassword) {
        return {
          success: false,
          error: 'All fields are required'
        };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          error: 'Invalid email format'
        };
      }

      // Validate password strength
      if (newPassword.length < 6) {
        return {
          success: false,
          error: 'Password must be at least 6 characters long'
        };
      }

      console.log('🔒 Calling secure Cloud Function to reset password...');
      
      // Call the secure Cloud Function
      const resetPasswordFn = httpsCallable(this.functions, 'resetPasswordSecurely');
      const result = await resetPasswordFn({
        email: email.toLowerCase(),
        otp: otp,
        newPassword: newPassword
      });

      const data = result.data as { success: boolean; error?: string; message?: string };
      
      if (data.success) {
        console.log('✅ Password reset successful via Cloud Function');
        return {
          success: true,
          message: data.message || 'Password has been reset successfully'
        };
      } else {
        console.error('❌ Password reset failed:', data.error);
        return {
          success: false,
          error: data.error || 'Failed to reset password'
        };
      }
      
    } catch (error: any) {
      console.error('❌ Reset password error:', error);
      
      // Handle specific Firebase error codes
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (error.code === 'functions/not-found') {
        errorMessage = 'Password reset service is not available. Please contact support.';
      } else if (error.code === 'functions/internal') {
        errorMessage = 'An internal error occurred. Please try again later.';
      } else if (error.code === 'functions/unauthenticated') {
        errorMessage = 'Authentication failed. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  // ADD THIS METHOD TO YOUR firebase_service.ts FILE
// Place it in the FirebaseService class with your other user-related methods

  /**
   * Delete expired OTPs (cleanup function)
   */
  async cleanupExpiredOTPs(): Promise<void> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return; // Return empty string instead of throwing error
      }
      
      const otpsRef = collection(this.firestore, COLLECTIONS.PASSWORD_RESET_OTPS);
      const q = query(otpsRef, where('expiresAt', '<', new Date()));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`🧹 Cleaned up ${querySnapshot.size} expired OTPs`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // ==================== BULK USER UPLOAD METHODS ====================
  
  /**
   * Check if user exists by phone number
   */
  async checkUserExistsByPhone(phone: string): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      
      if (!this.firestore) throw new Error('Firestore not initialized');
      const usersRef = collection(this.firestore, COLLECTIONS.USERS);
      const q = query(usersRef, where('phone', '==', phone), limit(1));
      const snapshot = await getDocs(q);
      
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking user by phone:', error);
      throw error;
    }
  }

  /**
   * Check if user exists by email
   */
  async checkUserExistsByEmail(email: string): Promise<boolean> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return false; // Return empty string instead of throwing error
      }
      if (!email || !email.trim()) return false;
      
      if (!this.firestore) throw new Error('Firestore not initialized');
      const usersRef = collection(this.firestore, COLLECTIONS.USERS);
      const q = query(usersRef, where('email', '==', email.toLowerCase()), limit(1));
      const snapshot = await getDocs(q);
      
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking user by email:', error);
      throw error;
    }
  }

  /**
   * Get permissions based on user type
   */
  private getPermissions(userType: UserType): UserPermissions {
    const permissions: Record<UserType, UserPermissions> = {
      super_admin: {
        canEvaluate: true,
        canViewReports: true,
        canManageUsers: true,
        canManageColleges: true,
        canManageRooms: true,
        canManageClasses: true,
        canManageSubjects: true,
        canManageBoards: true,
        canManageExamTypes: true,
        canManageSystem: true,
        canAccessAllColleges: true,
        level: 'system'
      },
      system_admin: {
        canEvaluate: true,
        canViewReports: true,
        canManageUsers: true,
        canManageColleges: true,
        canManageRooms: true,
        canManageClasses: true,
        canManageSubjects: true,
        canManageBoards: true,
        canManageExamTypes: true,
        canManageSystem: true,
        canAccessAllColleges: true,
        level: 'system'
      },
      admin: {
        canEvaluate: true,
        canViewReports: true,
        canManageUsers: true,
        canManageColleges: false,
        canManageRooms: true,
        canManageClasses: true,
        canManageSubjects: true,
        canManageBoards: false,
        canManageExamTypes: true,
        canManageSystem: false,
        canAccessAllColleges: false,
        level: 'college'
      },
      principal: {
        canEvaluate: true,
        canViewReports: true,
        canManageUsers: true,
        canManageColleges: false,
        canManageRooms: true,
        canManageClasses: true,
        canManageSubjects: true,
        canManageBoards: false,
        canManageExamTypes: true,
        canManageSystem: false,
        canAccessAllColleges: false,
        level: 'college'
      },
      dean: {
        canEvaluate: true,
        canViewReports: true,
        canManageUsers: true,
        canManageColleges: false,
        canManageRooms: true,
        canManageClasses: false,
        canManageSubjects: true,
        canManageBoards: false,
        canManageExamTypes: false,
        canManageSystem: false,
        canAccessAllColleges: false,
        level: 'department'
      },
      teacher: {
        canEvaluate: true,
        canViewReports: true,
        canManageUsers: false,
        canManageColleges: false,
        canManageRooms: false,
        canManageClasses: false,
        canManageSubjects: false,
        canManageBoards: false,
        canManageExamTypes: false,
        canManageSystem: false,
        canAccessAllColleges: false,
        level: 'class'
      },
      student: {
        canEvaluate: false,
        canViewReports: true,
        canManageUsers: false,
        canManageColleges: false,
        canManageRooms: false,
        canManageClasses: false,
        canManageSubjects: false,
        canManageBoards: false,
        canManageExamTypes: false,
        canManageSystem: false,
        canAccessAllColleges: false,
        level: 'personal'
      }
    };
    
    return permissions[userType] || permissions.student;
  }

  /**
   * Create bulk user (for bulk upload)
   * Note: This creates the Firestore document directly
   * For production, you should use a Cloud Function with Firebase Admin SDK
   * to create the Firebase Auth user first
   */
  /**
   * UNIFIED BASE FUNCTION for creating users
   * Used by both manual and bulk creation to ensure consistency
   */
  private async createUserBase(userData: {
    fullName: string;
    title?: string;
    email?: string;
    phone: string;
    userType: UserType;
    collegeId: string;
    board?: string;
    createdBy: string;
    studentRoll?: string;
    academicYear?: string;
    studentClass?: string;
    parentPhone?: string;
    teacherClasses?: string[];
    teacherSubjects?: string[];
    shouldCreateAuthAccount?: boolean;
    shouldSendWelcomeEmail?: boolean;
  }): Promise<{ userId: string; temporaryPassword?: string }> {
    let createdAuthUser: User | null = null;
    let authAccountCreated = false;
    let temporaryPassword: string | undefined;
    
    try {
      if (!this.isInitialized() || !this.firestore) {
        throw new Error('Firebase not initialized');
      }
      
      // Normalize phone number (add +91 if just 10 digits)
      const normalizePhone = (phone: string): string => {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
          return `+91${cleaned}`;
        }
        return phone.startsWith('+') ? phone : `+${phone}`;
      };

      const normalizedPhone = normalizePhone(userData.phone);
      const phoneRaw = normalizedPhone.replace('+91', '');
      
      // Check if user already exists
      if (normalizedPhone) {
        const phoneExists = await this.checkUserExistsByPhone(normalizedPhone);
        if (phoneExists) {
          throw new Error('A user with this phone number already exists.');
        }
      }
      
      if (userData.email) {
        const emailExists = await this.checkUserExistsByEmail(userData.email);
        if (emailExists) {
          throw new Error('A user with this email address already exists.');
        }
      }

      // Generate userId and optionally create auth account
      let userId: string;
      
      if (userData.shouldCreateAuthAccount && userData.email && userData.email.trim()) {
        // Generate random 8-character password
        const generatePassword = (): string => {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
          let password = '';
          for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return password;
        };

        temporaryPassword = generatePassword();
        
        try {
          if (!this.auth) throw new Error('Firebase Auth not initialized');
          
          console.log('🔐 Creating Firebase Auth user...');
          const userCredential = await createUserWithEmailAndPassword(
            this.auth,
            userData.email,
            temporaryPassword
          );
          createdAuthUser = userCredential.user;
          userId = createdAuthUser.uid;
          authAccountCreated = true;
          console.log('✅ Auth user created:', userId);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            throw new Error('This email address is already registered.');
          }
          throw authError;
        }
      } else {
        // Generate unique ID for users without auth account
        if (!this.firestore) throw new Error('Firestore not initialized');
        const usersRef = collection(this.firestore, COLLECTIONS.USERS);
        const newUserRef = doc(usersRef);
        userId = newUserRef.id;
      }

      // Generate permissions based on user type
      const permissions = this.getPermissions(userData.userType);

      // Create standardized user document (all camelCase)
      const userDoc: any = {
        userId: userId,
        fullName: userData.fullName,
        title: userData.title || '',
        email: userData.email ? userData.email.toLowerCase() : '',
        phone: normalizedPhone,
        phoneRaw: phoneRaw,
        userType: userData.userType,
        collegeId: userData.collegeId,
        board: userData.board || 'Not Specified',
        status: USER_STATUS.ACTIVE,
        createdBy: userData.createdBy,
        permissions: permissions,
        
        // Security fields
        mustChangePassword: true,
        firstLogin: true,
        passwordChangedAt: null,
        temporaryPassword: authAccountCreated,
        accountLocked: false,
        failedLoginAttempts: 0,
        lastLoginAt: null,
        
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add student-specific fields
      if (userData.userType === 'student') {
        userDoc.studentRoll = userData.studentRoll;
        userDoc.academicYear = userData.academicYear;
        userDoc.studentClass = userData.studentClass;
        userDoc.parentPhone = userData.parentPhone || '';
        userDoc.studentHistory = [{
          academicYear: userData.academicYear,
          className: userData.studentClass, // Standardized to 'className'
          rollNumber: userData.studentRoll,
          board: userData.board || 'Not Specified',
          collegeId: userData.collegeId
        }];
      }

      // Add teacher/principal/dean-specific fields (always arrays)
      if (userData.userType === 'teacher' || userData.userType === 'principal' || userData.userType === 'dean') {
        userDoc.teacherClasses = userData.teacherClasses || [];
        userDoc.teacherSubjects = userData.teacherSubjects || [];
      }

      // Save to Firestore
      console.log('💾 Saving user document to Firestore...');
      await setDoc(doc(this.firestore, COLLECTIONS.USERS, userId), userDoc);
      console.log('✅ User document saved to Firestore');

      // Save credentials if auth account was created
      if (authAccountCreated && temporaryPassword) {
        console.log('💾 Saving temporary credentials...');
        await setDoc(doc(this.firestore, 'pending_user_credentials', userId), {
          email: userData.email,
          fullName: userData.fullName,
          userType: userData.userType,
          temporaryPassword: temporaryPassword,
          createdAt: serverTimestamp(),
          shared: false
        });
      }

      // Update college counts
      if (userData.collegeId) {
        await this.updateCollegeCountsForUser(
          userData.collegeId,
          userData.userType,
          userData.board
        );
      }

      // Send welcome email if requested and auth account created
      if (userData.shouldSendWelcomeEmail && authAccountCreated && userData.email && temporaryPassword) {
        console.log('📧 Sending welcome email...');
        await this.sendWelcomeEmail(
          userData.email,
          userData.fullName,
          temporaryPassword,
          userData.userType,
          userData.collegeId
        );
      }

      console.log(`✅ Created user: ${userData.fullName}`);
      
      // Log activity (non-blocking - won't affect user creation)
      try {
        await this.addActivityLog({
          userId: userData.createdBy,
          collegeId: userData.collegeId,
          action: 'create_user',
          entityType: 'user',
          entityId: userId,
          details: JSON.stringify({
            fullName: userData.fullName,
            email: userData.email,
            userType: userData.userType,
            studentClass: userData.studentClass,
            studentRoll: userData.studentRoll,
            authAccountCreated: authAccountCreated
          })
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log user creation (non-critical):', logError);
      }
      
      return { userId, temporaryPassword };
      
  } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Rollback: Delete auth account if created
      if (authAccountCreated && createdAuthUser) {
        try {
          console.log('🔄 Rolling back: Deleting auth account...');
          await createdAuthUser.delete();
          console.log('✅ Auth account deleted');
        } catch (deleteError) {
          console.error('❌ Failed to delete auth account:', deleteError);
        }
      }
      
      // Don't wrap the error again if it's already a clear message
      if (error.message.includes('already exists') || 
          error.message.includes('email address') || 
          error.message.includes('phone number')) {
        throw error; // Pass through as-is
      }
      
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Unified function to update college counts
   * Works for both manual and bulk creation
   */
  private async updateCollegeCountsForUser(
    collegeId: string,
    userType: UserType,
    board?: string
  ): Promise<void> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping college count update');
        return;
      }
      
      const collegeRef = doc(this.firestore, COLLECTIONS.COLLEGES, collegeId);
      const incrementValue = increment(1);
      
      const updates: any = {
        updatedAt: serverTimestamp()
      };
      
      // Update role-specific count
      updates[`roleCounts.${userType}`] = incrementValue;
      
      // Update teacher/student totals and board-wise counts
      if (userType === 'teacher' || userType === 'principal' || userType === 'dean') {
        updates.totalTeachers = incrementValue;
        
        if (board && board !== 'Not Specified') {
          const teacherBoards = board.includes(',') 
            ? board.split(',').map(b => b.trim())
            : [board];
          
          teacherBoards.forEach(b => {
            if (b && b !== 'Not Specified') {
              updates[`boardWiseCounts.${b}.totalTeachers`] = incrementValue;
            }
          });
        }
      } else if (userType === 'student') {
        updates.totalStudents = incrementValue;
        
        if (board && board !== 'Not Specified') {
          updates[`boardWiseCounts.${board}.totalStudents`] = incrementValue;
        }
      }
      
      await updateDoc(collegeRef, updates);
      console.log('✅ College counts updated');
    } catch (error) {
      console.error('Error updating college counts:', error);
      // Don't throw - we don't want to fail user creation if count update fails
    }
  }

  async createBulkUser(userData: any): Promise<void> {
    try {
      // Call unified base function with bulk-specific settings
      await this.createUserBase({
        fullName: userData.fullName,
        title: userData.title,
        email: userData.email,
        phone: userData.phone,
        userType: userData.userType,
        collegeId: userData.collegeId,
        board: userData.board,
        createdBy: userData.createdBy,
        studentRoll: userData.studentRoll,
        academicYear: userData.academicYear,
        studentClass: userData.studentClass,
        parentPhone: userData.parentPhone,
        teacherClasses: userData.teacherClasses,
        teacherSubjects: userData.teacherSubjects,
        shouldCreateAuthAccount: true,  // ✅ Now creates auth accounts
        shouldSendWelcomeEmail: true    // ✅ Now sends welcome emails
      });
    } catch (error: any) {
      console.error('Error creating bulk user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Create single user (for CreateUserModal)
   * Creates user with Firebase Authentication and stores in Firestore
   */
  async createUser(userData: any): Promise<void> {
    try {
      console.log('Creating user with data:', userData);
      
      // Convert snake_case to camelCase and prepare data
      const teacherClasses = Array.isArray(userData.teacher_classes)
        ? userData.teacher_classes
        : userData.teacher_classes 
          ? userData.teacher_classes.split(',').map((c: string) => c.trim())
          : [];
      
      const teacherSubjects = Array.isArray(userData.teacher_subjects)
        ? userData.teacher_subjects
        : userData.teacher_subjects
          ? userData.teacher_subjects.split(',').map((s: string) => s.trim())
          : [];
      
      // Call unified base function
      await this.createUserBase({
        fullName: userData.full_name,
        title: userData.title,
        email: userData.email,
        phone: userData.phone,
        userType: userData.user_type,
        collegeId: userData.college_id,
        board: userData.board,
        createdBy: userData.created_by || 'admin',
        studentRoll: userData.student_roll,
        academicYear: userData.academic_year,
        studentClass: userData.student_class,
        parentPhone: '', // Can be added to CreateUserModal if needed
        teacherClasses: teacherClasses,
        teacherSubjects: teacherSubjects,
        shouldCreateAuthAccount: true,
        shouldSendWelcomeEmail: true
      });
      
      console.log('✅ User created successfully');
      
    } catch (error: any) {
      console.error('Error in createUser:', error);
      // Don't double-wrap duplicate errors
      throw error;
    }
  }

  // ==================== EXAM STUDENTS WITH ATTENDANCE ====================
  
  /**
   * Get exam students based on attendance and their attempt data
   * Logic: Get all students from Users table (by class + board), then check Attendance table
   * - Students IN Attendance table for this exam = Present
   * - Students NOT IN Attendance table = Absent
   * @param examId - The exam ID to fetch students for
   * @param className - The class name to filter students
   * @param board - The board name to filter students
   * @returns Object containing present students (with attempts), absent students, and total count
   */
  async getExamStudentsWithAttendance(examId: string, className: string, board: string): Promise<{
    presentStudents: any[];
    absentStudents: any[];
    totalStudents: number;
  }> {
    try {
      // ========== STEP 1: Initialization Check ==========
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, cannot fetch exam students');
        return { presentStudents: [], absentStudents: [], totalStudents: 0 };
      }

      console.log('🔍 Fetching exam students for:', { examId, className, board });

      // ========== STEP 2: Get ALL students from Users table ==========
      if (!this.firestore) throw new Error('Firestore not initialized');
const usersRef = collection(this.firestore, COLLECTIONS.USERS);
      const studentsQuery = query(
        usersRef,
        where('userType', '==', USER_TYPES.STUDENT),
        where('studentClass', '==', className),
        where('board', '==', board)
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      console.log('📋 Total students in Users table:', studentsSnapshot.size);

      if (studentsSnapshot.empty) {
        console.warn('⚠️ No students found for class:', className, 'board:', board);
        return { presentStudents: [], absentStudents: [], totalStudents: 0 };
      }

      // Create a map of all students with their details
      const allStudentsMap = new Map<string, any>();
      studentsSnapshot.docs.forEach(doc => {
        const studentData = doc.data();
        allStudentsMap.set(doc.id, {
          studentId: doc.id,
          studentName: studentData.fullName || studentData.name || 'Unknown',
          rollNumber: studentData.studentRoll || studentData.rollNumber || 'N/A',
          email: studentData.email || '',
          className: studentData.studentClass,
          board: studentData.board
        });
      });

      // ========== STEP 3: Query Attendance table for this exam ==========
      const attendanceRef = collection(this.firestore, COLLECTIONS.ATTENDANCE);
      const attendanceQuery = query(
        attendanceRef,
        where('examId', '==', examId)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      console.log('✅ Attendance records found for this exam:', attendanceSnapshot.size);

      // ========== STEP 4: Identify Present Students ==========
      // Students who HAVE attendance records = Present
      const presentStudentIds = new Set<string>();
      const attendanceDataMap = new Map<string, any>();

      attendanceSnapshot.docs.forEach(doc => {
        const attendanceData = doc.data();
        const studentId = attendanceData.studentId || attendanceData.userId;
        
        if (studentId && allStudentsMap.has(studentId)) {
          presentStudentIds.add(studentId);
          attendanceDataMap.set(studentId, {
            attendanceDocId: doc.id,
            markedAt: attendanceData.markedAt || attendanceData.createdAt,
            ...attendanceData
          });
        }
      });

      // ========== STEP 5: Separate Present and Absent Students ==========
      const presentStudentsData: any[] = [];
      const absentStudents: any[] = [];

      allStudentsMap.forEach((studentData, studentId) => {
        if (presentStudentIds.has(studentId)) {
          // Student IS in Attendance = Present
          presentStudentsData.push({
            ...studentData,
            ...attendanceDataMap.get(studentId)
          });
        } else {
          // Student NOT in Attendance = Absent
          absentStudents.push({
            ...studentData,
            status: ATTENDANCE_STATUS.ABSENT,
            hasAttempt: false,
            attemptData: null
          });
        }
      });

      console.log('📊 Student breakdown:', {
        total: allStudentsMap.size,
        present: presentStudentsData.length,
        absent: absentStudents.length
      });

      // ========== STEP 6: Fetch Exam Attempts for Present Students (Parallel) ==========
      const presentStudents: any[] = [];

      if (presentStudentsData.length > 0) {
        console.log('🔄 Fetching exam attempts for', presentStudentsData.length, 'present students...');

        const attemptPromises = presentStudentsData.map(async (student) => {
          try {
            if (!this.firestore) throw new Error('Firestore not initialized');
            const attemptRef = collection(this.firestore, 'examAttempts');
            const attemptQuery = query(
              attemptRef,
              where('examId', '==', examId),
              where('studentId', '==', student.studentId),
              limit(1)
            );
            const attemptSnapshot = await getDocs(attemptQuery);

            if (!attemptSnapshot.empty) {
              const attemptDoc = attemptSnapshot.docs[0];
              const attemptData = attemptDoc.data();
              
              return {
                ...student,
                attemptId: attemptDoc.id,
                attemptData: {
                  ...attemptData,
                  startTime: attemptData.startTime?.toDate ? attemptData.startTime.toDate() : attemptData.startTime,
                  submitTime: attemptData.submitTime?.toDate ? attemptData.submitTime.toDate() : attemptData.submitTime,
                  createdAt: attemptData.createdAt?.toDate ? attemptData.createdAt.toDate() : attemptData.createdAt,
                  updatedAt: attemptData.updatedAt?.toDate ? attemptData.updatedAt.toDate() : attemptData.updatedAt,
                },
                status: ATTENDANCE_STATUS.PRESENT,
                hasAttempt: true
              };
            } else {
              // Present but no attempt yet
              return {
                ...student,
                attemptId: null,
                attemptData: null,
                status: ATTENDANCE_STATUS.PRESENT,
                hasAttempt: false
              };
            }
          } catch (error) {
            console.error('❌ Error fetching attempt for student:', student.studentId, error);
            return {
              ...student,
              attemptId: null,
              attemptData: null,
              status: ATTENDANCE_STATUS.PRESENT,
              hasAttempt: false,
              error: 'Failed to fetch attempt data'
            };
          }
        });

        const results = await Promise.all(attemptPromises);
        presentStudents.push(...results);
        
        console.log('✅ Exam attempts fetched:', {
          withAttempts: presentStudents.filter(s => s.hasAttempt).length,
          withoutAttempts: presentStudents.filter(s => !s.hasAttempt).length
        });
      }

      // ========== STEP 7: Calculate Final Statistics ==========
      const totalStudents = presentStudents.length + absentStudents.length;

      console.log('✅ Successfully fetched exam students:', {
        total: totalStudents,
        present: presentStudents.length,
        absent: absentStudents.length,
        withSubmissions: presentStudents.filter(s => s.hasAttempt).length,
        pendingSubmissions: presentStudents.filter(s => !s.hasAttempt).length
      });

      return {
        presentStudents,
        absentStudents,
        totalStudents
      };

    } catch (error) {
      console.error('❌ Error fetching exam students with attendance:', error);
      throw error;
    }
  }

  // ==================== INTERNET CONNECTIVITY TRACKING ====================

  /**
   * Get user's network and geo information for connectivity tracking
   */
  /**
   * Get user's network information for connectivity tracking (simplified - no API calls)
   */
  private async getUserNetworkInfo(): Promise<{
    connectionType: ConnectionType;
    deviceInfo: { userAgent: string; deviceType: string; platform: string; };
    networkQuality?: { downlink?: number; effectiveType?: string; rtt?: number; };
  }> {
    try {
      // Get connection type from Network Information API
      let connectionType: ConnectionType = 'unknown';
      let networkQuality: { downlink?: number; effectiveType?: string; rtt?: number; } | undefined;

      if ('connection' in navigator && (navigator as any).connection) {
        const connection = (navigator as any).connection;
        
        // Map connection types
        if (connection.type) {
          switch (connection.type) {
            case 'wifi':
              connectionType = 'wifi';
              break;
            case 'cellular':
              connectionType = 'cellular';
              break;
            case 'ethernet':
              connectionType = 'ethernet';
              break;
            default:
              connectionType = 'unknown';
          }
        }

        // Get network quality metrics
        networkQuality = {
          downlink: connection.downlink,
          effectiveType: connection.effectiveType,
          rtt: connection.rtt
        };
      }

      // Get device information
      const deviceInfo = {
        userAgent: navigator.userAgent,
        deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        platform: navigator.platform
      };

      return {
        connectionType,
        deviceInfo,
        networkQuality
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      
      // Fallback with basic info
      return {
        connectionType: 'unknown',
        deviceInfo: {
          userAgent: navigator.userAgent,
          deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          platform: navigator.platform
        }
      };
    }
  }

  /**
   * Log internet disconnection event
   */
  async logInternetDisconnection(examId: string, userId: string): Promise<string> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return ''; // Return empty string instead of throwing error
      }

      console.log('🔌 Logging internet disconnection for exam:', examId, 'user:', userId);

      const networkInfo = await this.getUserNetworkInfo();
      const entryId = `${examId}_${userId}_${Date.now()}`;

      const internetStatusEntry: Partial<InternetStatusEntry> = {
        id: entryId,
        examId,
        userId,
        connectionType: networkInfo.connectionType,
        disconnectionTimestamp: new Date(),
        status: CONNECTION_STATUS.DISCONNECTED,
        deviceInfo: networkInfo.deviceInfo,
        createdAt: new Date(),
        ...(networkInfo.networkQuality !== undefined &&
          networkInfo.networkQuality !== null && {
            networkQuality: networkInfo.networkQuality,
          }),
      };

      // Save to InternetStatus collection
      await setDoc(doc(this.firestore, COLLECTIONS.INTERNET_STATUS, entryId), internetStatusEntry);

      console.log('✅ Internet disconnection logged successfully:', entryId);
      return entryId;
    } catch (error) {
      console.error('❌ Error logging internet disconnection:', error);
      throw error;
    }
  }

  /**
   * Log internet reconnection event
   */
  async logInternetReconnection(disconnectionEntryId: string, internetUnavailableDuration: number): Promise<void> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return; // Return empty string instead of throwing error
      }

      console.log('🔌 Logging internet reconnection for entry:', disconnectionEntryId);

      const entryRef = doc(this.firestore, COLLECTIONS.INTERNET_STATUS, disconnectionEntryId);
      
      // Update the existing entry with reconnection info
      await updateDoc(entryRef, {
        reconnectionTimestamp: new Date(),
        internetUnavailableDuration: internetUnavailableDuration, // in seconds
        status: CONNECTION_STATUS.RECONNECTED,
        updatedAt: new Date()
      });

      console.log('✅ Internet reconnection logged successfully');
    } catch (error) {
      console.error('❌ Error logging internet reconnection:', error);
      throw error;
    }
  }

  /**
   * Log complete connectivity cycle (disconnection + reconnection) in ONE operation
   * This is the recommended approach - creates a complete entry at once when reconnection happens
   */
  async logConnectivityCycle(
    examId: string, 
    userId: string,
    disconnectionTimestamp: Date,
    reconnectionTimestamp: Date
  ): Promise<string> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return ''; // Return empty string instead of throwing error
      }

      console.log('🔌 Logging complete connectivity cycle for exam:', examId, 'user:', userId);

      // Calculate duration when internet was unavailable
      const internetUnavailableDuration = Math.round((reconnectionTimestamp.getTime() - disconnectionTimestamp.getTime()) / 1000);

      // Get current network info (at reconnection time)
      const networkInfo = await this.getUserNetworkInfo();
      const entryId = `${examId}_${userId}_${disconnectionTimestamp.getTime()}`;

      // Create ONE complete entry with all information
      const internetStatusEntry: Partial<InternetStatusEntry> = {
        id: entryId,
        examId,
        userId,
        connectionType: networkInfo.connectionType,
        disconnectionTimestamp,
        reconnectionTimestamp,
        internetUnavailableDuration, // in seconds
        status: CONNECTION_STATUS.RECONNECTED,
        deviceInfo: networkInfo.deviceInfo,
        ...(networkInfo.networkQuality != null && {
          networkQuality: networkInfo.networkQuality,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to InternetStatus collection - ONE operation with ALL data
      await setDoc(doc(this.firestore, COLLECTIONS.INTERNET_STATUS, entryId), internetStatusEntry);

      console.log('✅ Complete connectivity cycle logged successfully:', entryId);
      console.log('   Disconnection:', disconnectionTimestamp);
      console.log('   Reconnection:', reconnectionTimestamp);
      console.log('   Internet Unavailable Duration:', internetUnavailableDuration, 'seconds');
      
      return entryId;
    } catch (error) {
      console.error('❌ Error logging connectivity cycle:', error);
      throw error;
    }
  }

  /**
   * Get internet connectivity statistics for an exam
   */
  async getExamConnectivityStats(examId: string): Promise<{
    totalDisconnections: number;
    totalInternetUnavailableDuration: number;
    affectedUsers: number;
    averageUnavailableDurationPerIncident: number;
    disconnectionsByConnectionType: Record<string, number>;
  }> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return { totalDisconnections: 0, totalInternetUnavailableDuration: 0, affectedUsers: 0, averageUnavailableDurationPerIncident: 0, disconnectionsByConnectionType: {} };
      }

      const internetStatusRef = collection(this.firestore, COLLECTIONS.INTERNET_STATUS);
      const q = query(internetStatusRef, where('examId', '==', examId));
      const querySnapshot = await getDocs(q);

      const stats = {
        totalDisconnections: 0,
        totalInternetUnavailableDuration: 0,
        affectedUsers: new Set<string>(),
        disconnectionsByConnectionType: {} as Record<string, number>
      };

      querySnapshot.forEach((doc) => {
        const data = doc.data() as InternetStatusEntry;
        
        stats.totalDisconnections++;
        stats.affectedUsers.add(data.userId);
        
        if (data.internetUnavailableDuration) {
          stats.totalInternetUnavailableDuration += data.internetUnavailableDuration;
        }

        // Count by connection type
        if (!stats.disconnectionsByConnectionType[data.connectionType]) {
          stats.disconnectionsByConnectionType[data.connectionType] = 0;
        }
        stats.disconnectionsByConnectionType[data.connectionType]++;
      });

      return {
        totalDisconnections: stats.totalDisconnections,
        totalInternetUnavailableDuration: stats.totalInternetUnavailableDuration,
        affectedUsers: stats.affectedUsers.size,
        averageUnavailableDurationPerIncident: stats.totalDisconnections > 0 ? stats.totalInternetUnavailableDuration / stats.totalDisconnections : 0,
        disconnectionsByConnectionType: stats.disconnectionsByConnectionType
      };
    } catch (error) {
      console.error('❌ Error getting connectivity stats:', error);
      throw error;
    }
  }

  /**
   * Get user's connectivity history for an exam
   */
  async getUserConnectivityHistory(examId: string, userId: string): Promise<InternetStatusEntry[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
       return []; // Return empty string instead of throwing error
      }

      console.log('📡 getUserConnectivityHistory called:', { examId, userId });
      console.log('📡 Collection name from COLLECTIONS:', COLLECTIONS.INTERNET_STATUS);

      // Try different collection name variations
      const collectionNames = [
        COLLECTIONS.INTERNET_STATUS,  // From constants
        'internetStatus',              // camelCase
        'internet_status',             // snake_case
        'InternetStatus'               // PascalCase
      ];

      let history: InternetStatusEntry[] = [];
      let successfulCollection: string | null = null;

      for (const collectionName of collectionNames) {
        try {
          console.log(`📡 Trying collection: "${collectionName}"`);
          const internetStatusRef = collection(this.firestore, collectionName);
          
          // Try with orderBy first (requires composite index)
          let querySnapshot;
          try {
            const q = query(
              internetStatusRef, 
              where('examId', '==', examId),
              where('userId', '==', userId),
              orderBy('disconnectionTimestamp', 'desc')
            );
            
            querySnapshot = await getDocs(q);
            console.log(`✅ Query with orderBy successful for "${collectionName}", documents found:`, querySnapshot.size);
          } catch (indexError: any) {
            // If composite index is missing, try without orderBy
            if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
              console.warn(`⚠️ Composite index missing for "${collectionName}", trying without orderBy`);
              const simpleQuery = query(
                internetStatusRef, 
                where('examId', '==', examId),
                where('userId', '==', userId)
              );
              querySnapshot = await getDocs(simpleQuery);
              console.log(`✅ Simple query successful for "${collectionName}", documents found:`, querySnapshot.size);
            } else {
              throw indexError;
            }
          }

          if (querySnapshot.size > 0) {
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              console.log('📡 Processing connectivity document:', {
                docId: doc.id,
                examId: data.examId,
                userId: data.userId,
                duration: data.internetUnavailableDuration,
                status: data.status
              });
              
              history.push({
                ...data,
                disconnectionTimestamp: data.disconnectionTimestamp.toDate(),
                reconnectionTimestamp: data.reconnectionTimestamp?.toDate(),
                createdAt: data.createdAt.toDate(),
                updatedAt: data.updatedAt?.toDate()
              } as InternetStatusEntry);
            });
            
            successfulCollection = collectionName;
            console.log(`✅ Found ${history.length} records in collection "${collectionName}"`);
            break; // Stop trying other collection names
          } else {
            console.log(`⚠️ No documents found in "${collectionName}"`);
          }
        } catch (collectionError: any) {
          console.warn(`⚠️ Error querying "${collectionName}":`, collectionError.message);
          // Continue to next collection name
        }
      }

      if (history.length === 0) {
        console.warn('❌ No connectivity data found in any collection variation');
        console.warn('   Tried collections:', collectionNames);
        console.warn('   examId:', examId);
        console.warn('   userId:', userId);
      } else {
        console.log(`✅ getUserConnectivityHistory returning ${history.length} records from "${successfulCollection}"`);
      }

      return history;
    } catch (error) {
      console.error('❌ Error getting user connectivity history:', error);
      console.error('   examId:', examId);
      console.error('   userId:', userId);
      console.error('   Error details:', error);
      return []; // Return empty array instead of throwing to prevent LiveStats from breaking
    }
  }

  /**
   * Calculate duration when internet was unavailable between two timestamps
   */
  calculateInternetUnavailableDuration(disconnectionTime: Date, reconnectionTime: Date): number {
    const timeDiffMs = reconnectionTime.getTime() - disconnectionTime.getTime();
    return Math.round(timeDiffMs / 1000); // Return in seconds
  }

  // ==================== EXAM ACTIVITY MONITORING ====================
  // examActivities collection removed - all activities tracked in examAttempts.activities array

  /**
   * Get all connectivity records for an exam (for admin/teacher review)
   */
  async getAllExamConnectivityRecords(examId: string): Promise<InternetStatusEntry[]> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return []; // Return empty array instead of throwing error
      }

      console.log('📡 getAllExamConnectivityRecords called for exam:', examId);
      console.log('📡 Collection name from COLLECTIONS:', COLLECTIONS.INTERNET_STATUS);

      // Try different collection name variations
      const collectionNames = [
        COLLECTIONS.INTERNET_STATUS,  // From constants
        'internetStatus',              // camelCase
        'internet_status',             // snake_case
        'InternetStatus'               // PascalCase
      ];

      let records: InternetStatusEntry[] = [];
      let successfulCollection: string | null = null;

      for (const collectionName of collectionNames) {
        try {
          console.log(`📡 Trying collection: "${collectionName}" for exam records`);
          const internetStatusRef = collection(this.firestore, collectionName);
          
          // Try with orderBy first (requires composite index)
          let querySnapshot;
          try {
            const q = query(
              internetStatusRef, 
              where('examId', '==', examId),
              orderBy('disconnectionTimestamp', 'desc')
            );
            
            querySnapshot = await getDocs(q);
            console.log(`✅ Query with orderBy successful for "${collectionName}", documents found:`, querySnapshot.size);
          } catch (indexError: any) {
            // If composite index is missing, try without orderBy
            if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
              console.warn(`⚠️ Composite index missing for "${collectionName}", trying without orderBy`);
              const simpleQuery = query(
                internetStatusRef, 
                where('examId', '==', examId)
              );
              querySnapshot = await getDocs(simpleQuery);
              console.log(`✅ Simple query successful for "${collectionName}", documents found:`, querySnapshot.size);
            } else {
              throw indexError;
            }
          }

          if (querySnapshot.size > 0) {
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              records.push({
                ...data,
                disconnectionTimestamp: data.disconnectionTimestamp.toDate(),
                reconnectionTimestamp: data.reconnectionTimestamp?.toDate(),
                createdAt: data.createdAt.toDate(),
                updatedAt: data.updatedAt?.toDate()
              } as InternetStatusEntry);
            });
            
            successfulCollection = collectionName;
            console.log(`✅ Found ${records.length} records in collection "${collectionName}"`);
            break; // Stop trying other collection names
          } else {
            console.log(`⚠️ No documents found in "${collectionName}"`);
          }
        } catch (collectionError: any) {
          console.warn(`⚠️ Error querying "${collectionName}":`, collectionError.message);
          // Continue to next collection name
        }
      }

      if (records.length === 0) {
        console.warn('❌ No connectivity records found in any collection variation');
        console.warn('   Tried collections:', collectionNames);
        console.warn('   examId:', examId);
      } else {
        console.log(`✅ getAllExamConnectivityRecords returning ${records.length} records from "${successfulCollection}"`);
      }

      return records;
    } catch (error) {
      console.error('❌ Error getting exam connectivity records:', error);
      console.error('   examId:', examId);
      console.error('   Error details:', error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Delete connectivity records for an exam (admin cleanup)
   */
  async deleteExamConnectivityRecords(examId: string): Promise<void> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized, skipping activity log');
        return; // Return empty string instead of throwing error
      }

      const internetStatusRef = collection(this.firestore, COLLECTIONS.INTERNET_STATUS);
      const q = query(internetStatusRef, where('examId', '==', examId));
      const querySnapshot = await getDocs(q);

      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });

      await Promise.all(deletePromises);
      console.log('✅ All connectivity records deleted for exam:', examId);
    } catch (error) {
      console.error('❌ Error deleting connectivity records:', error);
      throw error;
    }
  }

  /**
   * Get exams with pagination support
   * @param collegeId - College ID to filter exams
   * @param academicYear - Academic year to filter
   * @param pageSize - Number of exams to fetch per page (default: 25)
   * @param lastDocument - Last document from previous page for pagination
   * @returns Object containing exams array, last document, and hasMore flag
   */
  async getExamsPaginated(
    collegeId?: string, 
    academicYear?: string, 
    pageSize: number = 25,
    lastDocument?: DocumentSnapshot | null
  ): Promise<{
    exams: ExamModel[];
    lastDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    console.log('🔍 [FIREBASE_SERVICE] getExamsPaginated called with:', { 
      collegeId, 
      academicYear, 
      pageSize,
      hasLastDoc: !!lastDocument 
    });
    
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return { exams: [], lastDoc: null, hasMore: false };
      }
      
      // Build query constraints
      const constraints: any[] = [];
      
      // Add filters first
      if (collegeId) {
        console.log('🔍 [FIREBASE_SERVICE] Adding collegeId filter:', collegeId);
        constraints.push(where('collegeId', '==', collegeId));
      }
      if (academicYear && academicYear !== 'all') {
        console.log('🔍 [FIREBASE_SERVICE] Adding academicYear filter:', academicYear);
        constraints.push(where('year', '==', academicYear));
      }
      
      // Add ordering
      constraints.push(orderBy('createdAt', 'desc'));
      
      // Add pagination - start after last document if provided
      if (lastDocument) {
        console.log('🔍 [FIREBASE_SERVICE] Adding startAfter pagination');
        constraints.push(startAfter(lastDocument));
      }
      
      // Add limit (fetch one extra to check if there are more)
      constraints.push(limit(pageSize + 1));
      
      console.log('🔍 [FIREBASE_SERVICE] Executing paginated query with', constraints.length, 'constraints');
      const examsQuery = query(
        collection(this.firestore, COLLECTIONS.EXAMS),
        ...constraints
      );
      
      // Force fetch from server to get latest data including new questionPool fields
      const snapshot = await getDocsFromServer(examsQuery);
      console.log('🔍 [FIREBASE_SERVICE] Query returned', snapshot.docs.length, 'documents');
      
      // Check if there are more documents
      const hasMore = snapshot.docs.length > pageSize;
      
      // Get the actual documents (excluding the extra one if present)
      const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
      
            // Parse exams
      const parsedExams = docs.map((doc, index) => {
        console.log(`🔍 [FIREBASE_SERVICE] Parsing exam ${index + 1}/${docs.length}: ${doc.id}`);
        // ✅ Return full exam data for teachers/admins (no sanitization)
        // Students should use getExamById() which calls Cloud Function for sanitized data
        return this.parseExamFromFirestore(doc);
      });
      
      // Get the last document for next pagination
      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
      
      // 🔥 CRITICAL DEBUG: Verify questionPool fields are in returned exams
      console.log('✅ [FIREBASE_SERVICE] getExamsPaginated completed:', {
        examsFetched: parsedExams.length,
        hasMore,
        lastDocId: lastDoc?.id
      });
      
      // Log first exam's questionPool data if available
      if (parsedExams.length > 0) {
        const firstExam = parsedExams[0];
        console.log('🔥🔥🔥 FIRST EXAM RETURNED BY getExamsPaginated:', {
          examId: firstExam.id,
          hasQuestionPool: 'questionPool' in firstExam,
          questionPoolLength: Array.isArray(firstExam.questionPool) ? firstExam.questionPool.length : 'not array',
          pickRandomCount: firstExam.pickRandomCount,
          poolQuestionMarks: firstExam.poolQuestionMarks,
          questionPoolValue: firstExam.questionPool
        });
      }
      
      return {
        exams: parsedExams,
        lastDoc,
        hasMore
      };
      
    } catch (error) {
      console.error('❌ [FIREBASE_SERVICE] Error fetching paginated exams:', error);
      console.error('❌ [FIREBASE_SERVICE] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return { exams: [], lastDoc: null, hasMore: false };
    }
  }
  /**
 * Advanced user search with filters
 * Searches users by multiple criteria
 */
async searchUsers(
  searchTerm: string,
  filters?: {
    collegeId?: string;
    userType?: UserType | UserType[];
    status?: UserStatus;
    studentClass?: string;
    board?: string;
  },
  limitCount: number = 20
): Promise<UserModel[]> {
  try {
    if (!this.isInitialized() || !this.firestore) {
      throw new Error('Firebase not initialized');
    }

    if (!this.firestore) throw new Error('Firestore not initialized');
const usersRef = collection(this.firestore, COLLECTIONS.USERS);
    const constraints: any[] = [];

    // Add filters
    if (filters?.collegeId) {
      constraints.push(where('collegeId', '==', filters.collegeId));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.studentClass) {
      constraints.push(where('studentClass', '==', filters.studentClass));
    }
    if (filters?.board) {
      constraints.push(where('board', '==', filters.board));
    }

    // Add userType filter (single or multiple)
    if (filters?.userType) {
      if (Array.isArray(filters.userType)) {
        constraints.push(where('userType', 'in', filters.userType));
      } else {
        constraints.push(where('userType', '==', filters.userType));
      }
    }

    constraints.push(limit(limitCount * 2)); // Fetch more for client-side filtering

    const q = query(usersRef, ...constraints);
    const snapshot = await getDocs(q);

    const term = searchTerm.toLowerCase().trim();
    const results: UserModel[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const fullName = String(data.fullName || '').toLowerCase();
      const email = String(data.email || '').toLowerCase();
      const studentRoll = String(data.studentRoll || '').toLowerCase();
      const phone = String(data.phone || data.phoneRaw || '').toLowerCase().replace(/[\s\-\(\)]/g, '');
      const parentPhone = String(data.parentPhone || '').toLowerCase().replace(/[\s\-\(\)]/g, '');
      const cleanTerm = term.replace(/[\s\-\(\)]/g, '');

      // Match search term
      if (
        !term ||
        fullName.includes(term) ||
        email.includes(term) ||
        studentRoll.includes(term) ||
        phone.includes(cleanTerm) ||
        parentPhone.includes(cleanTerm)
      ) {
        results.push({
          userId: doc.id,
          ...data
        } as UserModel);
      }
    });

    // Sort by relevance
    return results
      .sort((a, b) => {
        const aName = a.fullName.toLowerCase();
        const bName = b.fullName.toLowerCase();
        const aExact = aName === term;
        const bExact = bName === term;
        const aStarts = aName.startsWith(term);
        const bStarts = bName.startsWith(term);

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      })
      .slice(0, limitCount);
  } catch (error) {
    console.error('❌ Error searching users:', error);
    throw error;
  }
}

/**
 * Advanced exam search with filters
 */
async searchExams(
  searchTerm: string,
  filters?: {
    collegeId?: string;
    class?: string;
    subject?: string;
    board?: string;
    academicYear?: string;
    status?: string;
    examType?: string;
    dateRange?: { start: Date; end: Date };
  },
  limitCount: number = 20
): Promise<any[]> {
  try {
    if (!this.isInitialized() || !this.firestore) {
      throw new Error('Firebase not initialized');
    }

    const examsRef = collection(this.firestore, COLLECTIONS.EXAMS);
    const constraints: any[] = [orderBy('createdAt', 'desc')];

    // Add filters
    if (filters?.collegeId) {
      constraints.unshift(where('collegeId', '==', filters.collegeId));
    }
    if (filters?.class) {
      constraints.unshift(where('class', '==', filters.class));
    }
    if (filters?.subject) {
      constraints.unshift(where('subject', '==', filters.subject));
    }
    if (filters?.board) {
      constraints.unshift(where('board', '==', filters.board));
    }
    if (filters?.academicYear) {
      constraints.unshift(where('academicYear', '==', filters.academicYear));
    }
    if (filters?.status) {
      constraints.unshift(where('status', '==', filters.status));
    }
    if (filters?.examType) {
      constraints.unshift(where('examType', '==', filters.examType));
    }

    constraints.push(limit(limitCount * 3));

    const q = query(examsRef, ...constraints);
    const snapshot = await getDocs(q);

    const term = searchTerm.toLowerCase().trim();
    const results: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const className = (data.class || '').toLowerCase();
      const subject = (data.subject || '').toLowerCase();

      // Match search term
      if (
        !term ||
        title.includes(term) ||
        className.includes(term) ||
        subject.includes(term)
      ) {
        // Date range filter (client-side)
        if (filters?.dateRange) {
          const examDate = new Date(data.date);
          if (
            examDate < filters.dateRange.start ||
            examDate > filters.dateRange.end
          ) {
            return; // Skip this exam
          }
        }

        results.push({
          id: doc.id,
          ...data
        });
      }
    });

    // Sort by relevance and date
    return results
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aStarts = aTitle.startsWith(term);
        const bStarts = bTitle.startsWith(term);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Otherwise maintain date order
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limitCount);
  } catch (error) {
    console.error('❌ Error searching exams:', error);
    throw error;
  }
}

/**
 * Advanced question search with filters
 */
async searchQuestions(
  searchTerm: string,
  filters?: {
    collegeId?: string;
    class?: string;
    subject?: string;
    board?: string;
    type?: string;
    chapter?: string;
    complexity?: ComplexityLevel;
    tags?: string[];
  },
  limitCount: number = 20
): Promise<any[]> {
  try {
    if (!this.isInitialized() || !this.firestore) {
      throw new Error('Firebase not initialized');
    }

    const questionsRef = collection(this.firestore, COLLECTIONS.QUESTION_BANK);
    const constraints: any[] = [];

    // Add filters
    if (filters?.collegeId) {
      constraints.push(where('collegeId', '==', filters.collegeId));
    }
    if (filters?.class) {
      constraints.push(where('class', '==', filters.class));
    }
    if (filters?.subject) {
      constraints.push(where('subject', '==', filters.subject));
    }
    if (filters?.board) {
      constraints.push(where('board', '==', filters.board));
    }
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters?.chapter) {
      constraints.push(where('chapter', '==', filters.chapter));
    }
    if (filters?.complexity) {
      constraints.push(where('complexity', '==', filters.complexity));
    }

    constraints.push(limit(limitCount * 3));

    const q = query(questionsRef, ...constraints);
    const snapshot = await getDocs(q);

    const term = searchTerm.toLowerCase().trim();
    const results: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const question = (data.question || '').toLowerCase();
      const subject = (data.subject || '').toLowerCase();
      const className = (data.class || '').toLowerCase();
      const chapter = (data.chapter || '').toLowerCase();
      const tags = (data.tags || []).map((t: string) => t.toLowerCase());

      // Match search term
      if (
        !term ||
        question.includes(term) ||
        subject.includes(term) ||
        className.includes(term) ||
        chapter.includes(term) ||
        tags.some((tag: string) => tag.includes(term))
      ) {
        // Tags filter (client-side)
        if (filters?.tags && filters.tags.length > 0) {
          const hasMatchingTag = filters.tags.some(filterTag =>
            tags.includes(filterTag.toLowerCase())
          );
          if (!hasMatchingTag) {
            return; // Skip this question
          }
        }

        results.push({
          id: doc.id,
          ...data
        });
      }
    });

    // Sort by relevance
    return results
      .sort((a, b) => {
        const aQuestion = (a.question || '').toLowerCase();
        const bQuestion = (b.question || '').toLowerCase();
        const aStarts = aQuestion.startsWith(term);
        const bStarts = bQuestion.startsWith(term);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      })
      .slice(0, limitCount);
  } catch (error) {
    console.error('❌ Error searching questions:', error);
    throw error;
  }
}

/**
 * Quick search across all entities
 * Returns top results from each category
 */
async quickSearch(
  searchTerm: string,
  collegeId?: string
): Promise<{
  users: UserModel[];
  exams: any[];
  questions: any[];
  totalResults: number;
}> {
  try {
    const [users, exams, questions] = await Promise.all([
      this.searchUsers(searchTerm, { collegeId, status: USER_STATUS.ACTIVE }, 5),
      this.searchExams(searchTerm, { collegeId }, 5),
      this.searchQuestions(searchTerm, { collegeId }, 5)
    ]);

    return {
      users,
      exams,
      questions,
      totalResults: users.length + exams.length + questions.length
    };
  } catch (error) {
    console.error('❌ Error in quick search:', error);
    throw error;
  }
}

/**
 * Get search suggestions based on partial input
 * Useful for autocomplete functionality
 */
async getSearchSuggestions(
  partialTerm: string,
  type: 'users' | 'exams' | 'questions' | 'all',
  collegeId?: string,
  limitCount: number = 5
): Promise<string[]> {
  try {
    if (!this.isInitialized() || !partialTerm.trim()) {
      return [];
    }

    const suggestions = new Set<string>();
    const term = partialTerm.toLowerCase().trim();

    if (type === 'users' || type === 'all') {
      const users = await this.searchUsers(term, { collegeId }, limitCount);
      users.forEach(user => {
        suggestions.add(user.fullName);
        if (user.email && user.email.toLowerCase().includes(term)) {
          suggestions.add(user.email);
        }
      });
    }

    if (type === 'exams' || type === 'all') {
      const exams = await this.searchExams(term, { collegeId }, limitCount);
      exams.forEach(exam => {
        suggestions.add(exam.title);
        if (exam.subject?.toLowerCase().includes(term)) {
          suggestions.add(exam.subject);
        }
      });
    }

    if (type === 'questions' || type === 'all') {
      const questions = await this.searchQuestions(term, { collegeId }, limitCount);
      questions.forEach(question => {
        if (question.subject?.toLowerCase().includes(term)) {
          suggestions.add(question.subject);
        }
        if (question.chapter?.toLowerCase().includes(term)) {
          suggestions.add(question.chapter);
        }
      });
    }

    return Array.from(suggestions).slice(0, limitCount);
  } catch (error) {
    console.error('❌ Error getting search suggestions:', error);
    return [];
  }
}
  /**
 * Get exam students with attendance - PAGINATED VERSION for Present Students
 * @param examId - Exam ID
 * @param className - Class name
 * @param board - Board name
 * @param pageSize - Number of students to fetch per page (default: 25)
 * @param lastDocument - Last document from previous page for pagination
 * @returns Present students with pagination info
 */
async getExamPresentStudentsPaginated(
  examId: string, 
  className: string, 
  board: string,
  pageSize: number = 25,
  lastDocument?: DocumentSnapshot | null
): Promise<{
  students: any[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalCount: number;
}> {
  console.log('👥 [FIREBASE_SERVICE] getExamPresentStudentsPaginated called:', { 
    examId, 
    className, 
    board,
    pageSize,
    hasLastDoc: !!lastDocument 
  });
  
  try {
    if (!this.isInitialized() || !this.firestore) {
      console.warn('⚠️ Firebase not initialized');
      return { students: [], lastDoc: null, hasMore: false, totalCount: 0 };
    }

    // Get exam attempts for this exam
    const attemptsRef = collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS);
    const constraints: any[] = [
      where('examId', '==', examId),
      orderBy('studentName', 'asc')
    ];

    // Add pagination
    if (lastDocument) {
      constraints.push(startAfter(lastDocument));
    }
    
    // Fetch one extra to check if there are more
    constraints.push(limit(pageSize + 1));

    const attemptsQuery = query(attemptsRef, ...constraints);
    const attemptsSnapshot = await getDocs(attemptsQuery);

    // Get all students from class for this board (to find absent students)
    //const studentsRef = collection(this.firestore, COLLECTIONS.USERS);
    // const studentsQuery = query(
    //   studentsRef,
    //   where('userType', '==', USER_TYPES.STUDENT),
    //   where('studentClass', '==', className),
    //   where('board', '==', board)
    // );

    // Map student IDs who attempted
    const attemptedStudentIds = new Set<string>();
    attemptsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      attemptedStudentIds.add(data.studentId);
    });

    // Check if there are more documents
    const hasMore = attemptsSnapshot.docs.length > pageSize;
    const docs = hasMore ? attemptsSnapshot.docs.slice(0, pageSize) : attemptsSnapshot.docs;

    // Build present students array
    const presentStudents = docs.map(attemptDoc => {
      const attemptData = attemptDoc.data();
      return {
        studentId: attemptData.studentId,
        studentName: attemptData.studentName,
        studentEmail: attemptData.studentEmail,
        rollNumber: attemptData.rollNumber,
        hasAttempt: true,
        attemptData: {
          attemptId: attemptDoc.id,
          obtainedMarks: attemptData.obtainedMarks || 0,
          totalScore: attemptData.maximumScore || 0,
          percentage: attemptData.percentage || 0,
          attemptedQuestions: attemptData.attemptedQuestions || 0,
          totalQuestions: attemptData.totalQuestions || 0,
          status: attemptData.status || ATTEMPT_STATUS.PENDING,
          timeSpent: attemptData.timeSpent || 0,
          violationCount: attemptData.violations?.length || 0,
          startTime: attemptData.startTime,
          submitTime: attemptData.submitTime
        }
      };
    });

    const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

    // Get total count of students who attempted (for progress tracking)
    const totalAttemptsQuery = query(
      attemptsRef,
      where('examId', '==', examId)
    );
    const totalAttemptsSnapshot = await getDocs(totalAttemptsQuery);
    const totalCount = totalAttemptsSnapshot.size;

    console.log('✅ [FIREBASE_SERVICE] Present students paginated:', {
      fetched: presentStudents.length,
      hasMore,
      totalCount
    });

    return {
      students: presentStudents,
      lastDoc,
      hasMore,
      totalCount
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE_SERVICE] Error fetching paginated present students:', error);
    return { students: [], lastDoc: null, hasMore: false, totalCount: 0 };
  }
}

/**
 * Get exam students with attendance - PAGINATED VERSION for Absent Students
 * @param examId - Exam ID
 * @param className - Class name
 * @param board - Board name
 * @param pageSize - Number of students to fetch per page (default: 25)
 * @param lastDocument - Last document from previous page for pagination
 * @returns Absent students with pagination info
 */
async getExamAbsentStudentsPaginated(
  examId: string, 
  className: string, 
  board: string,
  pageSize: number = 25,
  lastDocument?: DocumentSnapshot | null
): Promise<{
  students: any[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalCount: number;
}> {
  console.log('👥 [FIREBASE_SERVICE] getExamAbsentStudentsPaginated called:', { 
    examId, 
    className, 
    board,
    pageSize,
    hasLastDoc: !!lastDocument 
  });
  
  try {
    if (!this.isInitialized() || !this.firestore) {
      console.warn('⚠️ Firebase not initialized');
      return { students: [], lastDoc: null, hasMore: false, totalCount: 0 };
    }

    // Get all students who attempted this exam
    const attemptsRef = collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS);
    const attemptsQuery = query(
      attemptsRef,
      where('examId', '==', examId)
    );
    const attemptsSnapshot = await getDocs(attemptsQuery);

    // Map student IDs who attempted
    const attemptedStudentIds = new Set<string>();
    attemptsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      attemptedStudentIds.add(data.studentId);
    });

    // Get all students from class for this board
    const studentsRef = collection(this.firestore, COLLECTIONS.USERS);
    const constraints: any[] = [
      where('userType', '==', USER_TYPES.STUDENT),
      where('studentClass', '==', className),
      where('board', '==', board),
      orderBy('fullName', 'asc')
    ];

    // Add pagination
    if (lastDocument) {
      constraints.push(startAfter(lastDocument));
    }
    
    // Fetch more than needed since we'll filter out attempted students
    constraints.push(limit(pageSize * 3)); // Fetch 3x to account for filtering

    const studentsQuery = query(studentsRef, ...constraints);
    const studentsSnapshot = await getDocs(studentsQuery);

    // Filter out students who attempted (to get absent students)
    const absentStudentDocs: DocumentSnapshot[] = [];
    for (const studentDoc of studentsSnapshot.docs) {
      // const studentData = studentDoc.data();
      if (!attemptedStudentIds.has(studentDoc.id)) {
        absentStudentDocs.push(studentDoc);
        if (absentStudentDocs.length >= pageSize + 1) {
          break; // Got enough
        }
      }
    }

    // Check if there are more documents
    const hasMore = absentStudentDocs.length > pageSize;
    const docs = hasMore ? absentStudentDocs.slice(0, pageSize) : absentStudentDocs;

    // Build absent students array
    const absentStudents = docs.map(studentDoc => {
      const studentData = studentDoc.data();
      return {
        studentId: studentDoc.id,
        studentName: studentData?.fullName,
        studentEmail: studentData?.email,
        rollNumber: studentData?.studentRoll || studentData?.rollNumber || 'N/A',
        hasAttempt: false,
        attemptData: null
      };
    });

    const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

    // Calculate total absent count
    const allStudentsQuery = query(
      studentsRef,
      where('userType', '==', USER_TYPES.STUDENT),
      where('studentClass', '==', className),
      where('board', '==', board)
    );
    const allStudentsSnapshot = await getDocs(allStudentsQuery);
    const totalStudents = allStudentsSnapshot.size;
    const totalAbsent = totalStudents - attemptedStudentIds.size;

    console.log('✅ [FIREBASE_SERVICE] Absent students paginated:', {
      fetched: absentStudents.length,
      hasMore,
      totalAbsent
    });

    return {
      students: absentStudents,
      lastDoc,
      hasMore,
      totalCount: totalAbsent
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE_SERVICE] Error fetching paginated absent students:', error);
    return { students: [], lastDoc: null, hasMore: false, totalCount: 0 };
  }
}

/**
   * Add activity log for tracking user actions
   * @param logData - Activity log data
   */
  async addActivityLog(logData: {
    userId: string;
    collegeId: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
  }): Promise<void> {
    try {
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized - cannot add activity log');
        return;
      }

      const activityRef = collection(this.firestore, 'activityLogs');
      await addDoc(activityRef, {
        ...logData,
        timestamp: serverTimestamp(),
      });
      
      console.log('✅ Activity logged:', logData.action);
    } catch (error) {
      console.error('❌ Error adding activity log:', error);
      // Don't throw - logging shouldn't break the main operation
    }
  }

  /**
   * Get connectivity summary for exam report
   */
  async getConnectivitySummaryForReport(examId: string): Promise<{
    examId: string;
    totalStudents: number;
    studentsWithDisconnections: number;
    totalDisconnectionEvents: number;
    totalInternetUnavailableMinutes: number;
    averageUnavailableDurationPerStudent: number;
    mostAffectedConnectionType: string;
    connectivityScore: number; // 0-100, 100 being perfect connectivity
  }> {
    try {
      const stats = await this.getExamConnectivityStats(examId);
      const exam = await this.getExamById(examId);
      
      const totalStudents = exam?.totalStudents || 0;
      const connectivityScore = totalStudents > 0 
        ? Math.max(0, 100 - (stats.affectedUsers / totalStudents * 100))
        : 100;

      // Find most affected connection type
      const mostAffectedConnectionType = Object.entries(stats.disconnectionsByConnectionType)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

      return {
        examId,
        totalStudents,
        studentsWithDisconnections: stats.affectedUsers,
        totalDisconnectionEvents: stats.totalDisconnections,
        totalInternetUnavailableMinutes: Math.round(stats.totalInternetUnavailableDuration / 60),
        averageUnavailableDurationPerStudent: stats.affectedUsers > 0 ? stats.totalInternetUnavailableDuration / stats.affectedUsers : 0,
        mostAffectedConnectionType,
        connectivityScore: Math.round(connectivityScore)
      };
    } catch (error) {
      console.error('❌ Error getting connectivity summary:', error);
      throw error;
    }
  }

  /**
   * Get all students for a specific class and board
   * Wrapper method for Result.tsx component
   * @param collegeId - The college ID
   * @param classId - The class ID (e.g., "10", "12")
   * @param board - The board name (e.g., "CBSE", "ICSE")
   * @returns Promise<UserModel[]> - Array of student objects
   */
  async getAllStudentsByClass(
    collegeId: string,
    classId: string,
    board: string
  ): Promise<UserModel[]> {
    try {
      console.log('👥 [FIREBASE_SERVICE] Getting all students for class:', { collegeId, classId, board });
      
      // Use existing getStudentsByClass method with reordered parameters
      const students = await this.getStudentsByClass(classId, collegeId, board);
      
      console.log('✅ [FIREBASE_SERVICE] Retrieved students:', students.length);
      return students;
      
    } catch (error) {
      console.error('❌ [FIREBASE_SERVICE] Error getting all students by class:', error);
      return [];
    }
  }

  /**
   * Get attendance records for a specific exam
   * Note: Attendance table only has examId and studentId
   * No class/board fields in attendance records
   * @param examId - The exam ID
   * @param classId - Not used, kept for API compatibility
   * @param board - Not used, kept for API compatibility
   * @returns Promise<AttendanceRecord[]> - Array of attendance records
   */
  async getAttendanceByExam(
    examId: string,
    _classId: string,
    _board: string
  ): Promise<AttendanceRecord[]> {
    try {
      console.log('📊 [FIREBASE_SERVICE] Getting attendance for exam:', { examId });
      
      if (!this.isInitialized() || !this.firestore) {
        console.warn('⚠️ Firebase not initialized');
        return [];
      }
      
      // Query attendance - ONLY filter by examId
      // Attendance records don't have class/board fields
      // Class/board filtering happens by matching with Users table
      const attendanceQuery = query(
        collection(this.firestore, COLLECTIONS.ATTENDANCE),
        where('examId', '==', examId)
      );
      
      const querySnapshot = await getDocs(attendanceQuery);
      
      const attendanceRecords: AttendanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        attendanceRecords.push({
          id: doc.id,
          examId: data.examId,
          studentId: data.studentId,
          userId: data.studentId,
          studentName: data.studentName,
          studentRollNumber: data.studentRollNumber,
          examinerId: data.examinerId,
          examinerName: data.examinerName,
          examinerRole: data.examinerRole,
          status: data.status,
          markedAt: data.markedAt?.toDate ? data.markedAt.toDate() : new Date(data.markedAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          collegeId: data.collegeId
        });
      });
      
      console.log('✅ [FIREBASE_SERVICE] Retrieved attendance records:', attendanceRecords.length);
      return attendanceRecords;
      
    } catch (error) {
      console.error('❌ [FIREBASE_SERVICE] Error getting attendance by exam:', error);
      return [];
    }
  }

/**
 * Helper: Extract session data from attempt (IPs, browser, OS)
 */
private extractSessionData(attemptData: any): any {


  console.log('🔥🔥 🔥 🔥 🔥 extractSessionData CALLED');
  console.log('   attemptData keys:', attemptData ? Object.keys(attemptData) : 'null');
  console.log('   activities:', attemptData?.activities?.length || 0);
  console.log('   deviceInfo:', !!attemptData?.deviceInfo);


  // Extract IPs from activities array
  const activities = attemptData.activities || [];
  const enterActivity = activities.find((a: any) => a.type === 'enter');
  const exitActivities = activities.filter((a: any) => a.type === 'exit');
  const exitActivity = exitActivities.length > 0 ? exitActivities[exitActivities.length - 1] : null;
  
  const enterIP = enterActivity?.ipAddress || attemptData.deviceInfo?.ipAddress || 'N/A';
  const exitIP = exitActivity?.ipAddress || attemptData.deviceInfo?.ipAddress || 'N/A';
  
  // Parse browser and OS from userAgent
  const userAgent = attemptData.deviceInfo?.userAgent || '';
  let browser = 'N/A';
  let os = 'N/A';
  
  if (userAgent) {
    // Extract browser
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      const match = userAgent.match(/Chrome\/([0-9.]+)/);
      browser = match ? `Chrome ${match[1]}` : 'Chrome';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      const match = userAgent.match(/Version\/([0-9.]+)/);
      browser = match ? `Safari ${match[1]}` : 'Safari';
    } else if (userAgent.includes('Firefox')) {
      const match = userAgent.match(/Firefox\/([0-9.]+)/);
      browser = match ? `Firefox ${match[1]}` : 'Firefox';
    } else if (userAgent.includes('Edg')) {
      const match = userAgent.match(/Edg\/([0-9.]+)/);
      browser = match ? `Edge ${match[1]}` : 'Edge';
    }
    
    // Extract OS
    if (userAgent.includes('Windows NT 10.0')) {
      os = 'Windows 10';
    } else if (userAgent.includes('Windows NT 11.0')) {
      os = 'Windows 11';
    } else if (userAgent.includes('Windows NT')) {
      const match = userAgent.match(/Windows NT ([0-9.]+)/);
      os = match ? `Windows ${match[1]}` : 'Windows';
    } else if (userAgent.includes('Mac OS X')) {
      const match = userAgent.match(/Mac OS X ([0-9_]+)/);
      if (match) {
        const version = match[1].replace(/_/g, '.');
        os = `macOS ${version}`;
      } else {
        os = 'macOS';
      }
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      const match = userAgent.match(/Android ([0-9.]+)/);
      os = match ? `Android ${match[1]}` : 'Android';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) {
      const match = userAgent.match(/OS ([0-9_]+)/);
      if (match) {
        const version = match[1].replace(/_/g, '.');
        os = `iOS ${version}`;
      } else {
        os = 'iOS';
      }
    }
  }
  
  // Count tab switches from violations
  const tabSwitchCount = attemptData.violations?.filter((v: any) => v.type === 'TAB_SWITCH').length || 0;
  
  // ✅ Count enter and exit activities separately
  const enterCount = activities.filter((a: any) => a.type === 'enter').length;
  const exitCount = activities.filter((a: any) => a.type === 'exit').length;
  
  const result = {
    enterIPAddress: enterIP,
    exitIPAddress: exitIP,
    browser,
    operatingSystem: os,
    deviceType: attemptData.deviceInfo?.platform || 'N/A',
    tabSwitchCount,
    totalEntries: activities.length, // Total activities count
    enterCount,  // ✅ NEW: Count of enter activities
    exitCount    // ✅ NEW: Count of exit activities
  };
  
  // ADD THIS LOG 👇
  console.log('✅✅✅ extractSessionData RETURNING:', result);
  
  return result;

}

async getExamDashboardData(examId: string): Promise<ExamDashboardData> {

  console.log('🔥🔥🔥 getExamDashboardData CALLED with examId:', examId);

  if (!this.firestore) throw new Error('Firestore not initialized');

  // 1. Get exam details
  const examDoc = await getDoc(doc(this.firestore, COLLECTIONS.EXAMS, examId));
  if (!examDoc.exists()) {
    throw new Error('Exam not found');
  }
  const examData = examDoc.data();

  // 2. Get students using the SAME logic as Attendance page (getStudentsByExamPaginated)
  const className = examData.class;
  const collegeId = examData.collegeId;
  const board = examData.board;
  const academicYear = examData.year || examData.academicYear;
  
  console.log('📚 Fetching students with filters:');
  console.log('  - Class:', className);
  console.log('  - College ID:', collegeId);
  console.log('  - Board:', board);
  console.log('  - Academic Year:', academicYear);
  
  // Build where clauses dynamically (same as getStudentsByExamPaginated)
  const clauses: any[] = [
    where('userType', '==', USER_TYPES.STUDENT),
    where('collegeId', '==', collegeId),
    where('studentClass', '==', className), // Note: using 'studentClass' field
    where('status', '==', USER_STATUS.ACTIVE)
  ];
  
  if (board) {
    clauses.push(where('board', '==', board));
  }
  if (academicYear) {
    clauses.push(where('academicYear', '==', academicYear));
  }
  
  const studentsQuery = query(
    collection(this.firestore, COLLECTIONS.USERS),
    ...clauses
  );

  const studentsSnapshot = await getDocs(studentsQuery);
  const allStudents = studentsSnapshot.docs.map(doc => ({
    studentId: doc.id,
    studentName: doc.data().fullName || doc.data().displayName,
    studentEmail: doc.data().email,
    rollNumber: doc.data().rollNumber,
    class: doc.data().studentClass,
    ...doc.data()
  }));

  console.log('✅ Found students:', allStudents.length);

  // 3. Get attendance records from Attendance table  
  const attendanceRecords = await this.getExamAttendance(examId);
  const attendanceMap = new Map(
    attendanceRecords.map(record => [record.studentId, record])
  );

  console.log('✅ Found attendance records:', attendanceRecords.length);

  // 4. Get all exam attempts
  const attemptsQuery = query(
    collection(this.firestore, COLLECTIONS.EXAM_ATTEMPTS),
    where('examId', '==', examId),
    orderBy('percentage', 'desc')
  );

  const attemptsSnapshot = await getDocs(attemptsQuery);
 const attempts = attemptsSnapshot.docs.map(doc => {
    const data = doc.data() as StudentExamAttempt;
    
    // ✅ Calculate violationCount from responses array (consistent with getExamAttempts)
    let violationCount = 0;
    
    // Priority 1: Check if violationCount already exists
    if (typeof data.violationCount === 'number') {
      violationCount = data.violationCount;
    }
    // Priority 2: Check violationSummary.total
    else if (data.violationSummary && typeof data.violationSummary.total === 'number') {
      violationCount = data.violationSummary.total;
    }
    // Priority 3: Count from top-level violations array
    else if (data.violations && Array.isArray(data.violations)) {
      violationCount = data.violations.length;
    }
    // Priority 4: ✅ Count violations from ALL responses (most accurate!)
    else if (data.responses && Array.isArray(data.responses)) {
      violationCount = data.responses.reduce((total: number, response: any) => {
        if (response.violations && Array.isArray(response.violations)) {
          return total + response.violations.length;
        }
        return total;
      }, 0);
    }
    
    // ✅ Calculate timeSpent from responses array (consistent with getExamAttempts)
    let calculatedTimeSpent = data.timeSpent || 0;
    
    // Sum timeSpent from each response
    if (data.responses && Array.isArray(data.responses)) {
      const summedTime = data.responses.reduce((total: number, response: any) => {
        if (response.timeSpent && typeof response.timeSpent === 'number') {
          return total + response.timeSpent;
        }
        return total;
      }, 0);
      
      // Use summed time if it's greater than 0
      if (summedTime > 0) {
        calculatedTimeSpent = summedTime;
      }
    }
    
    return {
      ...data,
      violationCount,  // ✅ Calculated from responses
      timeSpent: calculatedTimeSpent  // ✅ Calculated from responses
    };
  });

  console.log('✅ Found attempts:', attempts.length);

  // 5. Create a map of attempts by studentId
  const attemptsByStudent = new Map<string, StudentExamAttempt>();
  attempts.forEach(attempt => {
    attemptsByStudent.set(attempt.studentId, attempt);
  });

  // 6. Categorize students based on ATTENDANCE (not attempts!)
  const presentStudents: DashboardStudent[] = [];
  const absentStudents: DashboardStudent[] = [];

  allStudents.forEach(student => {
    const attendanceRecord = attendanceMap.get(student.studentId);
    const attempt = attemptsByStudent.get(student.studentId);
    const isPresent = attendanceRecord?.status === 'present'; // ✅ Use attendance status!
    
    if (isPresent) {
      // Student is marked PRESENT in attendance
      if (attempt) {
        // Present AND has attempted the exam
        const sessionData = this.extractSessionData(attempt);
        
        presentStudents.push({
        studentId: student.studentId,
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        rollNumber: student.rollNumber || attempt.rollNumber, 
        class: student.class,
        hasAttempt: true,
        attemptData: {
          attemptId: attempt.attemptId,
          percentage: attempt.percentage,
          obtainedMarks: attempt.obtainedMarks,
          totalScore: attempt.totalScore,
          violationCount: (attempt as any).violationCount || 0,
          status: attempt.status,
          startTime: attempt.startTime,
          submitTime: attempt.submitTime,
          timeSpent: attempt.timeSpent,
          correctAnswers: attempt.correctAnswers,
          attemptedQuestions: attempt.attemptedQuestions,
          totalQuestions: attempt.totalQuestions,
          
          // ADD SESSION DATA HERE 👇
          enterIPAddress: sessionData.enterIPAddress,
          exitIPAddress: sessionData.exitIPAddress,
          browser: sessionData.browser,
          operatingSystem: sessionData.operatingSystem,
          deviceType: sessionData.deviceType,
          tabSwitchCount: sessionData.tabSwitchCount,
          totalEntries: sessionData.totalEntries,
          enterCount: sessionData.enterCount,  // ✅ NEW: Enter activities count
          exitCount: sessionData.exitCount,    // ✅ NEW: Exit activities count
          
          // ADD RESPONSES/ANSWERS HERE 👇
          answers: (attempt as any).responses || [],
          responses: (attempt as any).responses || [],
          questionResponses: (attempt as any).responses || []
        } as any
      });
      } else {
        // Present but hasn't attempted yet
        presentStudents.push({
          studentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          rollNumber: student.rollNumber,
          class: student.class,
          hasAttempt: false
        });
      }
    } else {
      // Student is marked ABSENT in attendance (or not marked at all)
      absentStudents.push({
        studentId: student.studentId,
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        rollNumber: student.rollNumber,
        class: student.class,
        hasAttempt: false
      });
    }
  });

  // 6. Return structured data
  return {
    exam: {
      examId: examData.examId,
      name: examData.name || examData.title,
      subject: examData.subject,
      class: examData.class,
      duration: examData.duration,
      totalMarks: examData.totalMarks,
      passingMarks: examData.passingMarks || 40,
      totalQuestions: examData.totalQuestions,
      startDate: examData.startDate,
      endDate: examData.endDate
    },
    presentStudents,
    absentStudents,
    totalStudents: allStudents.length,
    attempts
  };
}

/**
 * Get exam performance metrics
 * Calculates all performance statistics
 */
async getExamPerformanceMetrics(examId: string): Promise<ExamPerformanceMetrics> {
  const dashboardData = await this.getExamDashboardData(examId);
  const submittedStudents = dashboardData.presentStudents.filter(s => s.hasAttempt && s.attemptData);

  if (submittedStudents.length === 0) {
    return {
      totalSubmissions: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passRate: 0,
      passCount: 0,
      failCount: 0,
      distribution: {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0
      }
    };
  }

  const scores = submittedStudents.map(s => s.attemptData!.percentage);
  const passingPercentage = 40; // Can be customized

  const passCount = scores.filter(s => s >= passingPercentage).length;
  const failCount = scores.filter(s => s < passingPercentage).length;

  return {
    totalSubmissions: submittedStudents.length,
    averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    passRate: Math.round((passCount / submittedStudents.length) * 100),
    passCount,
    failCount,
    distribution: {
      excellent: scores.filter(s => s >= 90).length,
      good: scores.filter(s => s >= 75 && s < 90).length,
      average: scores.filter(s => s >= 60 && s < 75).length,
      poor: scores.filter(s => s < 60).length
    }
  };
}

/**
 * Get violation statistics for an exam
 */
async getExamViolationStats(examId: string): Promise<ExamViolationStats> {
  const dashboardData = await this.getExamDashboardData(examId);
  const submittedStudents = dashboardData.presentStudents.filter(s => s.hasAttempt && s.attemptData);

  const totalViolations = submittedStudents.reduce(
    (sum, s) => sum + (s.attemptData?.violationCount || 0), 
    0
  );
  
  const studentsWithViolations = submittedStudents.filter(
    s => (s.attemptData?.violationCount || 0) > 0
  ).length;

  return {
    totalViolations,
    studentsWithViolations,
    cleanExams: submittedStudents.length - studentsWithViolations,
    averageViolationsPerStudent: submittedStudents.length > 0 
      ? totalViolations / submittedStudents.length 
      : 0
  };
}
/**
 * Get detailed exam attempts with all question-level data for export
 * Includes IP addresses, browser info, OS, violations, and per-question performance
 */
// ==========================================
// DEBUG VERSION: getDetailedExamAttemptsForExport
// With extensive console logging at every stage
// Replace in firebase_service.ts (line ~10971)
// ==========================================

async getDetailedExamAttemptsForExport(examId: string): Promise<any[]> {
  console.log('🔍 ========== getDetailedExamAttemptsForExport START ==========');
  console.log('📋 Input examId:', examId);
  console.log('📋 examId type:', typeof examId);
  console.log('📋 examId length:', examId?.length);
  
  if (!this.firestore) {
    console.error('❌ Firestore not initialized!');
    throw new Error('Firestore not initialized');
  }
  
  console.log('✅ Firestore is initialized');

  try {
    // ✅ Use lowercase collection name
    console.log('🔍 Step 1: Creating query...');
    console.log('   Collection: examAttempts (lowercase)');
    console.log('   Where: examId ==', examId);
    console.log('   Where: status == submitted');
    
    const attemptsRef = collection(this.firestore, 'examAttempts');
    console.log('✅ Collection reference created');
    
    const q = query(
      attemptsRef,
      where('examId', '==', examId),
      where('status', '==', 'submitted')
    );
    console.log('✅ Query created');

    console.log('🔍 Step 2: Executing query...');
    const snapshot = await getDocs(q);
    console.log('✅ Query executed');
    console.log('📊 Documents found:', snapshot.docs.length);
    
    if (snapshot.docs.length === 0) {
      console.warn('⚠️ No submitted attempts found!');
      console.warn('   Trying to fetch ALL attempts (any status) for this exam...');
      
      const allQuery = query(attemptsRef, where('examId', '==', examId));
      const allSnapshot = await getDocs(allQuery);
      console.log('📊 Total attempts (all statuses):', allSnapshot.docs.length);
      
      if (allSnapshot.docs.length > 0) {
        allSnapshot.docs.forEach((doc, index) => {
          console.log(`   Attempt ${index + 1}: status = ${doc.data().status}`);
        });
      }
      
      return [];
    }
    
    console.log('🔍 Step 3: Processing', snapshot.docs.length, 'attempts...');
    
    const detailedAttempts = snapshot.docs.map((doc, index) => {
      console.log(`\n📄 Processing attempt ${index + 1}/${snapshot.docs.length}`);
      console.log('   Document ID:', doc.id);
      
      const data = doc.data();
      console.log('   Student ID:', data.studentId);
      console.log('   Status:', data.status);
      console.log('   Has activities:', !!data.activities);
      console.log('   Has deviceInfo:', !!data.deviceInfo);
      console.log('   Has responses:', !!data.responses);
      console.log('   Has answers:', !!data.answers);
      
      // ✅ Extract IPs from activities array
      const activities = data.activities || [];
      console.log('   Activities count:', activities.length);
      
      const enterActivity = activities.find((a: any) => a.type === 'enter');
      const exitActivity = activities.find((a: any) => a.type === 'exit');
      
      console.log('   Enter activity found:', !!enterActivity);
      console.log('   Exit activity found:', !!exitActivity);
      
      // ✅ Also get from deviceInfo as fallback
      const deviceInfo = data.deviceInfo || {};
      console.log('   Device info IP:', deviceInfo.ipAddress || 'none');
      
      const enterIP = enterActivity?.ipAddress || deviceInfo.ipAddress || 'N/A';
      const exitIP = exitActivity?.ipAddress || deviceInfo.ipAddress || enterIP || 'N/A';
      
      console.log('   ✅ Enter IP:', enterIP);
      console.log('   ✅ Exit IP:', exitIP);
      
      // ✅ Extract browser/OS from deviceInfo
      const userAgent = deviceInfo.userAgent || '';
      console.log('   User Agent:', userAgent ? userAgent.substring(0, 50) + '...' : 'none');
      
      let browser = 'N/A';
      let os = 'N/A';
      
      if (userAgent) {
        // Parse browser from userAgent
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
          const version = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '';
          browser = `Chrome ${version}`;
        } else if (userAgent.includes('Edg')) {
          const version = userAgent.match(/Edg\/([\d.]+)/)?.[1] || '';
          browser = `Edge ${version}`;
        } else if (userAgent.includes('Firefox')) {
          const version = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || '';
          browser = `Firefox ${version}`;
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
          browser = 'Safari';
        }
        
        // Parse OS from userAgent
        if (userAgent.includes('Macintosh')) {
          const version = userAgent.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
          os = `macOS ${version}`;
        } else if (userAgent.includes('Windows NT 10')) {
          os = 'Windows 10/11';
        } else if (userAgent.includes('Windows')) {
          os = 'Windows';
        } else if (userAgent.includes('Linux')) {
          os = 'Linux';
        } else if (userAgent.includes('Android')) {
          os = 'Android';
        } else if (userAgent.includes('iOS')) {
          os = 'iOS';
        }
      }
      
      // Use platform as fallback
      if (os === 'N/A' && deviceInfo.platform) {
        os = deviceInfo.platform;
      }
      
      console.log('   ✅ Browser:', browser);
      console.log('   ✅ OS:', os);
      
      // ✅ CRITICAL: Get responses/answers
      const responses = data.responses || data.answers || [];
      console.log('   ✅ Responses count:', responses.length);
      
      if (responses.length > 0) {
        console.log('   Sample response:', {
          questionId: responses[0].questionId,
          obtainedMarks: responses[0].obtainedMarks,
          hasStudentAnswer: !!responses[0].studentAnswer
        });
      }
      
      const result = {
        attemptId: doc.id,
        studentId: data.studentId,
        examId: data.examId,
        
        // Score data
        percentage: data.percentage || 0,
        obtainedMarks: data.obtainedMarks || 0,
        totalScore: data.totalScore || data.maximumScore || 0,
        correctAnswers: data.correctAnswers || 0,
        incorrectAnswers: data.incorrectAnswers || 0,
        unattemptedQuestions: data.unattemptedQuestions || 0,
        totalQuestions: data.totalQuestions || 0,
        attemptedQuestions: data.attemptedQuestions || 0,
        
        // ✅ Session data from activities array
        enterIPAddress: enterIP,
        exitIPAddress: exitIP,
        ipAddress: enterIP,
        
        // ✅ Browser/System info from deviceInfo
        browser: browser,
        operatingSystem: os,
        deviceType: deviceInfo.platform?.includes('Mobile') ? 'Mobile' : 'Desktop',
        userAgent: userAgent,
        screenResolution: deviceInfo.screenResolution || 'N/A',
        
        // Violations
        violationCount: data.violations?.length || 0,
        violations: data.violations || [],
        violationSummary: data.violationSummary || {},
        tabSwitchCount: data.violations?.filter((v: any) => v.type === 'TAB_SWITCH').length || 0,
        totalEntries: activities.length || 0,
        
        // Timing
        startTime: data.startTime || data.createdAt,
        submitTime: data.submitTime || data.evaluatedAt,
        timeSpent: data.timeSpent || 0,
        totalTimeSpent: data.timeSpent || 0,
        
        // Status
        status: data.status,
        
        // ✅ CRITICAL: Answers are in "responses" array (not "answers")
        answers: responses,
        questionResponses: responses,
        responses: responses,
        
        // Performance analytics
        performanceByComplexity: data.performanceByComplexity || {},
        performanceByChapter: data.performanceByChapter || {},
        
        // Metadata
        submittedAt: data.submitTime || data.evaluatedAt,
        evaluatedAt: data.evaluatedAt,
        lastUpdated: data.updatedAt,
        evaluationStatus: data.evaluationStatus,
        evaluationComplete: data.evaluationComplete,
        
        // Student info
        studentName: data.studentName,
        studentEmail: data.studentEmail,
        rollNumber: data.rollNumber,
        class: data.class,
        
        // Store raw data for reference
        _rawActivities: activities,
        _rawDeviceInfo: deviceInfo
      };
      
      console.log('   ✅ Attempt processed successfully');
      
      return result;
    });

    console.log('\n✅ ========== Processing Complete ==========');
    console.log('📊 Total attempts processed:', detailedAttempts.length);
    
    if (detailedAttempts.length > 0) {
      const sample = detailedAttempts[0];
      console.log('\n📊 Sample Result:');
      console.log('   Enter IP:', sample.enterIPAddress);
      console.log('   Exit IP:', sample.exitIPAddress);
      console.log('   Browser:', sample.browser);
      console.log('   OS:', sample.operatingSystem);
      console.log('   Answers count:', sample.answers?.length || 0);
      console.log('   Responses count:', sample.responses?.length || 0);
    }
    
    console.log('✅ ========== getDetailedExamAttemptsForExport END ==========\n');
    
    return detailedAttempts;

  } catch (error) {
    console.error('❌ ========== ERROR in getDetailedExamAttemptsForExport ==========');
    console.error('❌ Error:', error);
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : undefined);
    console.error('❌ Exam ID was:', examId);
    throw error;
  }
}

// ==========================================
// USAGE:
// 1. Replace the function in firebase_service.ts
// 2. Open browser console
// 3. Click "Export Report"
// 4. Watch the detailed logs
// 5. Share the console output here
// ==========================================

/**
 * Get exam with all question details for export
 */
async getExamWithQuestionDetails(examId: string): Promise<any> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    console.log('📊 Fetching exam with question details for:', examId);
    
    // Use existing getExamById which handles both Storage and Firestore questions
    const exam = await this.getExamById(examId);
    
    if (!exam) {
      throw new Error('Exam not found');
    }

    console.log('✅ Exam fetched:', {
      name: exam.title,
      totalQuestions: exam.totalQuestions || 0,
      hasQuestionsInStorage: !!exam.questionsStorageUrl
    });

    // Format questions for export
    let questionsList: any[] = [];
    
    if (exam.questionsList && exam.questionsList.length > 0) {
      questionsList = exam.questionsList.map((q: any, index: number) => ({
        id: q.id || q.questionId || `Q${index + 1}`,
        questionId: q.id || q.questionId || `Q${index + 1}`,
        type: q.type || 'mcq',
        questionText: q.questionText || q.title || q.question || '',
        maximumMarks: q.maximumMarks || q.marks || 1,
        difficulty: q.difficulty || q.difficultyLevel || 'Medium',
        difficultyLevel: q.difficulty || q.difficultyLevel || 'Medium',
        chapter: q.chapter || q.topic || 'N/A',
        subject: q.subject || exam.subject || 'N/A',
        options: q.options || [],
        correctAnswers: q.correctAnswers || [],
        order: index + 1
      }));
      
      console.log('✅ Formatted questions:', {
        total: questionsList.length,
        first: questionsList[0]?.questionId,
        types: [...new Set(questionsList.map(q => q.type))]
      });
    } else {
      console.warn('⚠️ No questions found in exam');
    }

    return {
      examId: exam.id,
      id: exam.id,
      name: exam.title,
      title: exam.title,
      class: exam.class,
      subject: exam.subject,
      board: exam.board,
      year: exam.year,
      duration: exam.duration,
      totalMarks: parseInt(exam.maxMarks) || 0,
      totalQuestions: exam.totalQuestions || 0,
      passingMarks: 40,
      questionsList: questionsList,
      createdAt: exam.createdAt,
      status: exam.status
    };

  } catch (error) {
    console.error('❌ Error fetching exam with question details:', error);
    throw error;
  }
}

/**
 * Get comprehensive export data (all sheets data in one call)
 */


// ==========================================
// FIX: getComprehensiveExportData
// Replace in firebase_service.ts (line ~11145)
// Make it ignore classId and fetch ALL students like dashboard does
// ==========================================

async getComprehensiveExportData(examId: string, classId?: string): Promise<any> {
  if (!this.firestore) throw new Error('Firestore not initialized');

  try {
    console.log('🔍 ========== getComprehensiveExportData START ==========');
    console.log('📋 Input examId:', examId);
    console.log('📋 Input classId:', classId, '(will be ignored for export)');
    console.log('📊 Fetching comprehensive export data...');

    // 1. Get exam with all question details
    console.log('\n🔍 Step 1: Fetching exam with questions...');
    const examWithQuestions = await this.getExamWithQuestionDetails(examId);
    console.log('✅ Exam fetched:', {
      name: examWithQuestions.name,
      questionCount: examWithQuestions.questionsList?.length || 0
    });

    // 2. Get all detailed attempts
    console.log('\n🔍 Step 2: Fetching detailed attempts...');
    const detailedAttempts = await this.getDetailedExamAttemptsForExport(examId);
    console.log('✅ Detailed attempts fetched:', detailedAttempts.length);
    if (detailedAttempts.length > 0) {
      console.log('   First attempt:', {
        studentId: detailedAttempts[0].studentId,
        hasAnswers: !!detailedAttempts[0].answers,
        answersCount: detailedAttempts[0].answers?.length || 0
      });
    }

    // 3. Get dashboard data (students, attendance)
    // ✅ FIX: Don't pass classId - get ALL students who attempted
    console.log('\n🔍 Step 3: Fetching dashboard data...');
    console.log('   NOT passing classId - will fetch ALL students');
    const dashboardData = await this.getExamDashboardData(examId);
    console.log('✅ Dashboard data fetched:');
    console.log('   Present students:', dashboardData.presentStudents?.length || 0);
    console.log('   Absent students:', dashboardData.absentStudents?.length || 0);
    console.log('   Total students:', dashboardData.totalStudents);
    
    if (dashboardData.presentStudents?.length > 0) {
      console.log('   First present student:', {
        studentId: dashboardData.presentStudents[0].studentId,
        studentName: dashboardData.presentStudents[0].studentName,
        hasAttempt: dashboardData.presentStudents[0].hasAttempt
      });
    } else {
      console.warn('⚠️ No present students found!');
    }

    // 4. Enrich student data with attempt details
    console.log('\n🔍 Step 4: Enriching student data...');
    const enrichedPresentStudents = dashboardData.presentStudents.map((student: any) => {
      const attempt = detailedAttempts.find(a => a.studentId === student.studentId);
      
      if (attempt && student.hasAttempt) {
        console.log('   ✅ Enriching student:', student.studentId, 'with', attempt.answers?.length || 0, 'answers');
        return {
          ...student,
          attemptData: {
            ...student.attemptData,
            ...attempt,
            // Ensure all fields are present
            enterIPAddress: attempt.enterIPAddress,
            exitIPAddress: attempt.exitIPAddress,
            browser: attempt.browser,
            operatingSystem: attempt.operatingSystem,
            deviceType: attempt.deviceType,
            tabSwitchCount: attempt.tabSwitchCount,
            totalEntries: attempt.totalEntries,
            answers: attempt.answers,
            questionResponses: attempt.questionResponses || attempt.answers,
            responses: attempt.responses
          }
        };
      }
      
      return student;
    });

    console.log('✅ Enrichment complete');
    console.log('   Enriched students count:', enrichedPresentStudents.length);

    const result = {
      exam: examWithQuestions,
      presentStudents: enrichedPresentStudents,
      absentStudents: dashboardData.absentStudents,
      totalStudents: dashboardData.totalStudents,
      attempts: detailedAttempts
    };

    console.log('\n📊 Final Result:');
    console.log('   Exam:', !!result.exam);
    console.log('   Exam name:', result.exam?.name || result.exam?.title);
    console.log('   Exam questionsList:', result.exam?.questionsList?.length || 0);
    console.log('   Present students:', result.presentStudents.length);
    console.log('   Absent students:', result.absentStudents.length);
    console.log('   Total students:', result.totalStudents);
    console.log('   Attempts:', result.attempts.length);
    
    if (result.presentStudents.length > 0 && result.presentStudents[0].attemptData) {
      console.log('\n   First student enriched data check:');
      console.log('     - answers:', result.presentStudents[0].attemptData.answers?.length || 0);
      console.log('     - responses:', result.presentStudents[0].attemptData.responses?.length || 0);
      console.log('     - enterIPAddress:', result.presentStudents[0].attemptData.enterIPAddress);
      console.log('     - browser:', result.presentStudents[0].attemptData.browser);
    }
    
    console.log('✅ ========== getComprehensiveExportData END ==========\n');

    return result;

  } catch (error) {
    console.error('❌ Error fetching comprehensive export data:', error);
    console.error('❌ Stack:', error instanceof Error ? error.stack : undefined);
    throw error;
  }
}
// ==========================================
// KEY CHANGE:
// Line 47: const dashboardData = await this.getExamDashboardData(examId);
// Instead of: await this.getExamDashboardData(examId, classId);
// 
// This makes it behave exactly like the dashboard - fetch ALL students
// ==========================================

  /**
   * Get Firestore instance
   */
  getDb(): Firestore | null {
    return this.firestore;
  }

  /**
   * Get activity logs for a specific user
   */
  async getActivityLogs(
    userId: string,
    limitCount: number = 50,
    lastVisible?: any
  ): Promise<{ logs: any[]; lastDoc: any; hasMore: boolean }> {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      let q = query(
        collection(this.firestore, 'activityLogs'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      if (lastVisible) {
        q = query(
          collection(this.firestore, 'activityLogs'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          startAfter(lastVisible),
          limit(limitCount)
        );
      }

      const snapshot = await getDocs(q);
      const logs: any[] = [];
      
      snapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return {
        logs,
        lastDoc: snapshot.docs[snapshot.docs.length - 1],
        hasMore: snapshot.docs.length === limitCount
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return { logs: [], lastDoc: null, hasMore: false };
    }
  }

  /**
   * Log user activity
   */
  async logActivity(
    userId: string,
    userName: string,
    userType: string,
    action: string,
    section: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string,
    location?: string
  ): Promise<void> {
    try {
      if (!this.firestore) {
        console.warn('⚠️ Firestore not initialized, skipping activity log');
        return;
      }

      await addDoc(collection(this.firestore, 'activityLogs'), {
        userId,
        userName,
        userType,
        action,
        section,
        details: details || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        location: location || null,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw error - logging shouldn't break the app
    }
  }

  /**
   * Get users by college (for audit trail)
   */
  async getUsersByCollege(collegeId: string): Promise<UserModel[]> {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      const q = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('collegeId', '==', collegeId),
        orderBy('fullName')
      );

      const snapshot = await getDocs(q);
      const users: UserModel[] = [];
      
      snapshot.forEach((doc) => {
        users.push({
          userId: doc.id,
          ...doc.data()
        } as UserModel);
      });

      return users;
    } catch (error) {
      console.error('Error fetching users by college:', error);
      return [];
    }
  }

  /**
   * Get users by college with pagination (for audit trail)
   */
  async getUsersByCollegePaginated(
    collegeId: string,
    pageSize: number = 20,
    lastVisible?: any,
    userTypeFilter?: string,
    classFilter?: string
  ): Promise<{ users: UserModel[]; lastDoc: any; hasMore: boolean }> {
    try {
      if (!this.firestore) {
        throw new Error('Firestore not initialized');
      }

      let q = query(
        collection(this.firestore, COLLECTIONS.USERS),
        where('collegeId', '==', collegeId),
        orderBy('fullName'),
        limit(pageSize + 1) // Get one extra to check if there's more
      );

      // Apply filters
      if (userTypeFilter && userTypeFilter !== 'all') {
        q = query(
          collection(this.firestore, COLLECTIONS.USERS),
          where('collegeId', '==', collegeId),
          where('userType', '==', userTypeFilter),
          orderBy('fullName'),
          limit(pageSize + 1)
        );
      }

      if (classFilter && classFilter !== 'all') {
        if (userTypeFilter && userTypeFilter !== 'all') {
          q = query(
            collection(this.firestore, COLLECTIONS.USERS),
            where('collegeId', '==', collegeId),
            where('userType', '==', userTypeFilter),
            where('studentClass', '==', classFilter),
            orderBy('fullName'),
            limit(pageSize + 1)
          );
        } else {
          q = query(
            collection(this.firestore, COLLECTIONS.USERS),
            where('collegeId', '==', collegeId),
            where('studentClass', '==', classFilter),
            orderBy('fullName'),
            limit(pageSize + 1)
          );
        }
      }

      // Add pagination cursor
      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      const users: UserModel[] = [];
      
      const hasMore = snapshot.docs.length > pageSize;
      const docsToReturn = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

      docsToReturn.forEach((doc) => {
        users.push({
          userId: doc.id,
          ...doc.data()
        } as UserModel);
      });

      return {
        users,
        lastDoc: docsToReturn[docsToReturn.length - 1] || null,
        hasMore
      };
    } catch (error) {
      console.error('Error fetching users by college paginated:', error);
      return { users: [], lastDoc: null, hasMore: false };
    }
  }

}

// Export singleton instance
export const firebaseService = FirebaseService.getInstance();

// Export default
export default firebaseService;