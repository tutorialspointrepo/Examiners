// constants.ts
// Centralized constants for EXAMINERS Application
// CLEAN & SIMPLE - Direct values only

/**
 * Notice priority levels
 */
export const NOTICE_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
} as const;

export type NoticePriority = typeof NOTICE_PRIORITY[keyof typeof NOTICE_PRIORITY];

/**
 * Notice categories
 */
export const NOTICE_CATEGORY = {
  GENERAL: 'general',
  ACADEMIC: 'academic',
  ADMINISTRATIVE: 'administrative',
  EVENT: 'event'
} as const;

export type NoticeCategory = typeof NOTICE_CATEGORY[keyof typeof NOTICE_CATEGORY];

// ==================== QUESTION TYPES ====================

/**
 * Standard question types - USE THESE EVERYWHERE
 */
export const QUESTION_TYPES = {
  MCQ: 'mcq',
  FITB: 'fitb',
  JUMBLED: 'jumbled',
  DESCRIPTIVE: 'descriptive',
  CODE: 'code',
} as const;

export type QuestionType = typeof QUESTION_TYPES[keyof typeof QUESTION_TYPES];

/**
 * UI labels for question types
 */
export const QUESTION_TYPE_LABELS = {
  [QUESTION_TYPES.MCQ]: 'MCQ',
  [QUESTION_TYPES.FITB]: 'FITB',
  [QUESTION_TYPES.JUMBLED]: 'Jumbled',
  [QUESTION_TYPES.DESCRIPTIVE]: 'Descriptive',
  [QUESTION_TYPES.CODE]: 'Code',
} as const;

// ==================== USER TYPES ====================

/**
 * User role types
 */
export const USER_TYPES = {
  SYSTEM_ADMIN: 'system_admin',
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PRINCIPAL: 'principal',
  DEAN: 'dean',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

/**
 * UI labels for user types
 */
export const USER_TYPE_LABELS = {
  [USER_TYPES.SYSTEM_ADMIN]: 'System Admin',
  [USER_TYPES.SUPER_ADMIN]: 'Super Admin',
  [USER_TYPES.ADMIN]: 'Admin',
  [USER_TYPES.PRINCIPAL]: 'Principal',
  [USER_TYPES.DEAN]: 'Dean',
  [USER_TYPES.TEACHER]: 'Teacher',
  [USER_TYPES.STUDENT]: 'Student',
} as const;

/**
 * User type icons for UI display
 */
export const USER_TYPE_ICONS = {
  [USER_TYPES.SYSTEM_ADMIN]: '👨‍💼',
  [USER_TYPES.SUPER_ADMIN]: '⚡',
  [USER_TYPES.ADMIN]: '⚙️',
  [USER_TYPES.PRINCIPAL]: '🏆',
  [USER_TYPES.DEAN]: '👔',
  [USER_TYPES.TEACHER]: '👨‍🏫',
  [USER_TYPES.STUDENT]: '🎓',
} as const;

/**
 * User type hierarchy levels (for permission checks)
 */
export const USER_TYPE_LEVELS = {
  [USER_TYPES.SUPER_ADMIN]: 110,
  [USER_TYPES.SYSTEM_ADMIN]: 100,
  [USER_TYPES.ADMIN]: 90,
  [USER_TYPES.PRINCIPAL]: 80,
  [USER_TYPES.DEAN]: 70,
  [USER_TYPES.TEACHER]: 50,
  [USER_TYPES.STUDENT]: 10,
} as const;

// ==================== COMPLEXITY LEVELS ====================

/**
 * Question complexity/difficulty levels
 */
export const COMPLEXITY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  // Legacy aliases for backward compatibility
  BASIC: 'easy',
  INTERMEDIATE: 'medium',
  ADVANCED: 'hard',
} as const;

export type ComplexityLevel = typeof COMPLEXITY_LEVELS[keyof typeof COMPLEXITY_LEVELS];

/**
 * UI labels for complexity levels
 */
export const COMPLEXITY_LABELS = {
  [COMPLEXITY_LEVELS.EASY]: 'Easy',
  [COMPLEXITY_LEVELS.MEDIUM]: 'Medium',
  [COMPLEXITY_LEVELS.HARD]: 'Hard',
} as const;

/**
 * Map legacy complexity values to current standard
 */
export const COMPLEXITY_LEGACY_MAP = {
  'Basic': COMPLEXITY_LEVELS.EASY,
  'basic': COMPLEXITY_LEVELS.EASY,
  'Intermediate': COMPLEXITY_LEVELS.MEDIUM,
  'intermediate': COMPLEXITY_LEVELS.MEDIUM,
  'Advanced': COMPLEXITY_LEVELS.HARD,
  'advanced': COMPLEXITY_LEVELS.HARD,
  'Easy': COMPLEXITY_LEVELS.EASY,
  'easy': COMPLEXITY_LEVELS.EASY,
  'Medium': COMPLEXITY_LEVELS.MEDIUM,
  'medium': COMPLEXITY_LEVELS.MEDIUM,
  'Hard': COMPLEXITY_LEVELS.HARD,
  'hard': COMPLEXITY_LEVELS.HARD,
} as const;

// ==================== STATUS VALUES ====================

/**
 * User account status
 */
export const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

/**
 * Exam attempt status
 */
export const ATTEMPT_STATUS = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  AUTO_SUBMITTED: 'auto_submitted',
  EVALUATED: 'evaluated',
  UNDER_REVIEW: 'under_review',
  PENDING: 'pending',
} as const;

export type AttemptStatus = typeof ATTEMPT_STATUS[keyof typeof ATTEMPT_STATUS];

/**
 * Evaluation status for questions/exams
 */
export const EVALUATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  NOT_ATTEMPTED: 'not_attempted',
  FAILED: 'failed',
  MANUAL_REVIEW: 'manual_review',
} as const;

export type EvaluationStatus = typeof EVALUATION_STATUS[keyof typeof EVALUATION_STATUS];

/**
 * Exam status
 */
export const EXAM_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  ONGOING: 'ongoing',
  UPCOMING: 'upcoming',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  INTERRUPTED: 'interrupted',
} as const;

export type ExamStatus = typeof EXAM_STATUS[keyof typeof EXAM_STATUS];

/**
 * UI labels for exam status
 */
export const EXAM_STATUS_LABELS = {
  [EXAM_STATUS.DRAFT]: 'Draft',
  [EXAM_STATUS.SCHEDULED]: 'Scheduled',
  [EXAM_STATUS.ACTIVE]: 'Active',
  [EXAM_STATUS.ONGOING]: 'Ongoing',
  [EXAM_STATUS.UPCOMING]: 'Upcoming',
  [EXAM_STATUS.COMPLETED]: 'Completed',
  [EXAM_STATUS.CANCELLED]: 'Cancelled',
  [EXAM_STATUS.INTERRUPTED]: 'Interrupted',
} as const;

/**
 * Notification status
 */
export const NOTIFICATION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  DRAFT: 'draft',
} as const;

export type NotificationStatus = typeof NOTIFICATION_STATUS[keyof typeof NOTIFICATION_STATUS];

// ==================== PRIORITY & SEVERITY ====================

/**
 * Priority levels
 */
export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
  URGENT: 'urgent',
} as const;

export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];

/**
 * Severity levels
 */
export const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type SeverityLevel = typeof SEVERITY_LEVELS[keyof typeof SEVERITY_LEVELS];

// ==================== EXAM & CONNECTION ====================

/**
 * Exam delivery modes
 */
export const EXAM_MODES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  HYBRID: 'hybrid',
} as const;

export type ExamMode = typeof EXAM_MODES[keyof typeof EXAM_MODES];

/**
 * UI labels for exam modes
 */
export const EXAM_MODE_LABELS = {
  [EXAM_MODES.ONLINE]: 'Online',
  [EXAM_MODES.OFFLINE]: 'Offline',
  [EXAM_MODES.HYBRID]: 'Hybrid',
} as const;

/**
 * Network connection types
 */
export const CONNECTION_TYPES = {
  WIFI: 'wifi',
  CELLULAR: 'cellular',
  ETHERNET: 'ethernet',
  UNKNOWN: 'unknown',
} as const;

export type ConnectionType = typeof CONNECTION_TYPES[keyof typeof CONNECTION_TYPES];

// ==================== VIOLATION TYPES ====================

/**
 * Maximum violations allowed per exam attempt
 */
export const MAX_VIOLATIONS = 250;

/**
 * Types of exam violations - Comprehensive list for proctoring
 */
export const VIOLATION_TYPES = {
  // Window/Focus Violations
  WINDOW_BLUR: 'WINDOW_BLUR',
  TAB_SWITCH: 'TAB_SWITCH',
  WINDOW_MINIMIZE: 'WINDOW_MINIMIZE',
  FULLSCREEN_EXIT: 'FULLSCREEN_EXIT',
  
  // Input Violations
  COPY_ATTEMPT: 'COPY_ATTEMPT',
  PASTE_ATTEMPT: 'PASTE_ATTEMPT',
  CUT_ATTEMPT: 'CUT_ATTEMPT',
  RIGHT_CLICK: 'RIGHT_CLICK',
  PRINT_SCREEN: 'PRINT_SCREEN',
  SCREENSHOT_ATTEMPT: 'SCREENSHOT_ATTEMPT',
  
  // System Violations
  DEVTOOLS_OPEN: 'DEVTOOLS_OPEN',
  CONSOLE_OPEN: 'CONSOLE_OPEN',
  MULTIPLE_TABS: 'MULTIPLE_TABS',
  NETWORK_DISCONNECT: 'NETWORK_DISCONNECT',
  TIME_MANIPULATION: 'TIME_MANIPULATION',
  
  // Keyboard Shortcuts
  SHORTCUT_CTRLC: 'SHORTCUT_CTRLC',
  SHORTCUT_CTRLV: 'SHORTCUT_CTRLV',
  SHORTCUT_CTRLX: 'SHORTCUT_CTRLX',
  SHORTCUT_CTRLA: 'SHORTCUT_CTRLA',
  SHORTCUT_ALTTAB: 'SHORTCUT_ALTTAB',
  SHORTCUT_CMDTAB: 'SHORTCUT_CMDTAB', // ✅ NEW: Mac Cmd+Tab
  SHORTCUT_CTRLSHIFTC: 'SHORTCUT_CTRLSHIFTC',
  SHORTCUT_F12: 'SHORTCUT_F12',
  SHORTCUT_CTRLP: 'SHORTCUT_CTRLP',
  SHORTCUT_CTRLS: 'SHORTCUT_CTRLS',
  SHORTCUT_DEVTOOLS: 'SHORTCUT_DEVTOOLS',
  
  // Proctoring Violations (Face Detection)
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  NO_FACE: 'NO_FACE',
  FACE_MISMATCH: 'FACE_MISMATCH',
  HEAD_TURNED: 'HEAD_TURNED',
  
  // Proctoring Violations (Audio)
  LOUD_NOISE: 'LOUD_NOISE',
  HUMAN_VOICE_DETECTED: 'HUMAN_VOICE_DETECTED',
  
  // Proctoring Violations (Movement)
  SUSPICIOUS_MOVEMENT: 'SUSPICIOUS_MOVEMENT',
  // Advanced AI & Integrity Violations
  PROHIBITED_OBJECT: 'PROHIBITED_OBJECT', // Cell phone, book, etc.
  VIRTUAL_MACHINE: 'VIRTUAL_MACHINE',     // Virtual camera/OBS/VM
  DOM_TAMPERING: 'DOM_TAMPERING',         // Inspect Element/Deleting video
  DEVICE_CHANGE: 'DEVICE_CHANGE',         // Unplugging camera/mic
} as const;

export type ViolationType = typeof VIOLATION_TYPES[keyof typeof VIOLATION_TYPES];

/**
 * Violation severity mapping
 */
export const VIOLATION_SEVERITY_MAP: Record<ViolationType, SeverityLevel> = {
  [VIOLATION_TYPES.DEVTOOLS_OPEN]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.CONSOLE_OPEN]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.SHORTCUT_F12]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.SHORTCUT_DEVTOOLS]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.MULTIPLE_TABS]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.TIME_MANIPULATION]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.MULTIPLE_FACES]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.NO_FACE]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.FACE_MISMATCH]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.TAB_SWITCH]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.FULLSCREEN_EXIT]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.WINDOW_MINIMIZE]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.SHORTCUT_ALTTAB]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.SHORTCUT_CMDTAB]: SEVERITY_LEVELS.HIGH, // ✅ NEW: Mac Cmd+Tab
  [VIOLATION_TYPES.PRINT_SCREEN]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.SCREENSHOT_ATTEMPT]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.SHORTCUT_CTRLP]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.NETWORK_DISCONNECT]: SEVERITY_LEVELS.HIGH,
  [VIOLATION_TYPES.HEAD_TURNED]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.WINDOW_BLUR]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.COPY_ATTEMPT]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.PASTE_ATTEMPT]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.CUT_ATTEMPT]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.SHORTCUT_CTRLC]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.SHORTCUT_CTRLV]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.SHORTCUT_CTRLX]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.SHORTCUT_CTRLS]: SEVERITY_LEVELS.MEDIUM,
  [VIOLATION_TYPES.SHORTCUT_CTRLSHIFTC]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.SUSPICIOUS_MOVEMENT]: SEVERITY_LEVELS.LOW,
  [VIOLATION_TYPES.LOUD_NOISE]: SEVERITY_LEVELS.LOW,
  [VIOLATION_TYPES.RIGHT_CLICK]: SEVERITY_LEVELS.LOW,
  [VIOLATION_TYPES.SHORTCUT_CTRLA]: SEVERITY_LEVELS.LOW,
  [VIOLATION_TYPES.HUMAN_VOICE_DETECTED]: SEVERITY_LEVELS.CRITICAL,
  // New Advanced Violations
  [VIOLATION_TYPES.PROHIBITED_OBJECT]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.VIRTUAL_MACHINE]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.DOM_TAMPERING]: SEVERITY_LEVELS.CRITICAL,
  [VIOLATION_TYPES.DEVICE_CHANGE]: SEVERITY_LEVELS.HIGH,
};

/**
 * Violation descriptions for logging
 */
export const VIOLATION_DESCRIPTIONS: Record<ViolationType, string> = {
  [VIOLATION_TYPES.WINDOW_BLUR]: 'Window lost focus',
  [VIOLATION_TYPES.TAB_SWITCH]: 'Switched to another tab',
  [VIOLATION_TYPES.WINDOW_MINIMIZE]: 'Window was minimized',
  [VIOLATION_TYPES.FULLSCREEN_EXIT]: 'Exited fullscreen mode',
  [VIOLATION_TYPES.COPY_ATTEMPT]: 'Attempted to copy content',
  [VIOLATION_TYPES.PASTE_ATTEMPT]: 'Attempted to paste content',
  [VIOLATION_TYPES.CUT_ATTEMPT]: 'Attempted to cut content',
  [VIOLATION_TYPES.RIGHT_CLICK]: 'Right-click menu attempted',
  [VIOLATION_TYPES.PRINT_SCREEN]: 'Print Screen key pressed',
  [VIOLATION_TYPES.SCREENSHOT_ATTEMPT]: 'Screenshot shortcut detected (Windows/Mac/Linux)',
  [VIOLATION_TYPES.DEVTOOLS_OPEN]: 'Developer tools detected',
  [VIOLATION_TYPES.CONSOLE_OPEN]: 'Browser console opened',
  [VIOLATION_TYPES.MULTIPLE_TABS]: 'Multiple exam tabs detected',
  [VIOLATION_TYPES.NETWORK_DISCONNECT]: 'Internet connection lost',
  [VIOLATION_TYPES.TIME_MANIPULATION]: 'System time changed',
  [VIOLATION_TYPES.SHORTCUT_CTRLC]: 'Ctrl+C pressed',
  [VIOLATION_TYPES.SHORTCUT_CTRLV]: 'Ctrl+V pressed',
  [VIOLATION_TYPES.SHORTCUT_CTRLX]: 'Ctrl+X pressed',
  [VIOLATION_TYPES.SHORTCUT_CTRLA]: 'Ctrl+A pressed',
  [VIOLATION_TYPES.SHORTCUT_ALTTAB]: 'Alt+Tab pressed',
  [VIOLATION_TYPES.SHORTCUT_CMDTAB]: 'Cmd+Tab pressed (Mac app switcher)', // ✅ NEW
  [VIOLATION_TYPES.SHORTCUT_CTRLSHIFTC]: 'Ctrl+Shift+C pressed (Inspect)',
  [VIOLATION_TYPES.SHORTCUT_F12]: 'F12 pressed (DevTools)',
  [VIOLATION_TYPES.SHORTCUT_CTRLP]: 'Ctrl+P pressed (Print)',
  [VIOLATION_TYPES.SHORTCUT_CTRLS]: 'Ctrl+S pressed (Save)',
  [VIOLATION_TYPES.SHORTCUT_DEVTOOLS]: 'DevTools shortcut pressed',
  [VIOLATION_TYPES.MULTIPLE_FACES]: 'Multiple faces detected in frame',
  [VIOLATION_TYPES.NO_FACE]: 'No face detected in frame',
  [VIOLATION_TYPES.FACE_MISMATCH]: 'Face does not match registered student',
  [VIOLATION_TYPES.HEAD_TURNED]: 'Head turned away from camera',
  [VIOLATION_TYPES.LOUD_NOISE]: 'Loud noise detected',
  [VIOLATION_TYPES.SUSPICIOUS_MOVEMENT]: 'Suspicious body movement detected',
  [VIOLATION_TYPES.HUMAN_VOICE_DETECTED]: 'Human speech detected in environment',
  [VIOLATION_TYPES.PROHIBITED_OBJECT]: 'Prohibited object detected (Phone/Book)',
  [VIOLATION_TYPES.VIRTUAL_MACHINE]: 'Virtual camera or broadcasting software detected',
  [VIOLATION_TYPES.DOM_TAMPERING]: 'Critical: Tampering with exam interface detected',
  [VIOLATION_TYPES.DEVICE_CHANGE]: 'Hardware input device removed or changed',
};

// ==================== FIREBASE COLLECTIONS ====================

/**
 * Firebase collection names
 */
export const COLLECTIONS = {
  USERS: 'users',
  COLLEGES: 'colleges',
  QUESTION_BANK: 'questionBank',
  EXAMS: 'exams',
  EXAM_ATTEMPTS: 'examAttempts',
  STUDENT_RESPONSES: 'studentResponses',
  NOTIFICATIONS: 'notifications',
  ACTIVITIES: 'activities',
  VIOLATIONS: 'violations',
  INTERNET_STATUS: 'internetStatus',
  CHAT_MESSAGES: 'chatMessages',
  SYSTEM_LOGS: 'systemLogs',
  ATTENDANCE: 'Attendance',
  ROOMS: 'rooms',
  ROOM_BOOKINGS: 'roomBookings',
  SETTINGS: 'settings',
  PASSWORD_RESET_OTPS: 'passwordResetOTPs',
  PASSWORD_RESET_REQUESTS: 'passwordResetRequests',
  CODING_LANGUAGES: 'CodingLanguages',
} as const;

// ==================== SPECIAL IDENTIFIERS ====================

/**
 * Special college/organization identifiers
 */
export const SPECIAL_IDS = {
  TUTORIALS_POINT: 'tutorialspoint',
  SYSTEM: 'system',
  COMMON: 'common',
} as const;

/**
 * Default college ID for common questions (shared across all colleges)
 */
export const DEFAULT_COLLEGE_ID = SPECIAL_IDS.TUTORIALS_POINT;

// ==================== PERMISSION LEVELS ====================

/**
 * Permission/access levels
 */
export const PERMISSION_LEVELS = {
  SYSTEM: 'system',
  COLLEGE: 'college',
  DEPARTMENT: 'department',
  CLASS: 'class',
  PERSONAL: 'personal',
} as const;

export type PermissionLevel = typeof PERMISSION_LEVELS[keyof typeof PERMISSION_LEVELS];

// ==================== AI MODELS ====================

/**
 * AI models used for evaluation
 */
export const AI_MODELS = {
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo',
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  CLAUDE_3_OPUS: 'claude-3-opus',
  CLAUDE_3_SONNET: 'claude-3-sonnet',
} as const;

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];

// ==================== CODE EXECUTION ====================

/**
 * Code execution status
 */
export const CODE_EXECUTION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  COMPILATION_ERROR: 'compilation_error',
  RUNTIME_ERROR: 'runtime_error',
} as const;

export type CodeExecutionStatus = typeof CODE_EXECUTION_STATUS[keyof typeof CODE_EXECUTION_STATUS];

/**
 * Supported programming languages
 */
export const PROGRAMMING_LANGUAGES = {
  PYTHON: 'python',
  JAVA: 'java',
  JAVASCRIPT: 'javascript',
  CPP: 'cpp',
  C: 'c',
  CSHARP: 'csharp',
  GO: 'go',
  RUST: 'rust',
} as const;

export type ProgrammingLanguage = typeof PROGRAMMING_LANGUAGES[keyof typeof PROGRAMMING_LANGUAGES];

/**
 * UI labels for programming languages
 */
export const PROGRAMMING_LANGUAGE_LABELS = {
  [PROGRAMMING_LANGUAGES.PYTHON]: 'Python',
  [PROGRAMMING_LANGUAGES.JAVA]: 'Java',
  [PROGRAMMING_LANGUAGES.JAVASCRIPT]: 'Javascript',
  [PROGRAMMING_LANGUAGES.CPP]: 'C++',
  [PROGRAMMING_LANGUAGES.C]: 'C',
  [PROGRAMMING_LANGUAGES.CSHARP]: 'C#',
  [PROGRAMMING_LANGUAGES.GO]: 'Go',
  [PROGRAMMING_LANGUAGES.RUST]: 'Rust',
} as const;

// ==================== PAGINATION ====================

/**
 * Default pagination settings
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
  QUESTIONS_PER_PAGE: 50,
  STUDENTS_PER_PAGE: 25,
  EXAMS_PER_PAGE: 20,
} as const;

// ==================== TIME CONSTANTS ====================

/**
 * Time-related constants (in milliseconds)
 */
export const TIME_CONSTANTS = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// ==================== TARGET AUDIENCES ====================

/**
 * Notification/announcement target audiences
 */
export const TARGET_AUDIENCES = {
  ALL: 'all',
  STUDENTS: 'students',
  FACULTY: 'faculty',
  TEACHERS: 'teachers',
  PARENTS: 'parents',
  STAFF: 'staff',
} as const;

export type TargetAudience = typeof TARGET_AUDIENCES[keyof typeof TARGET_AUDIENCES];

// ==================== DEVICE TYPES ====================

/**
 * Device types for tracking
 */
export const DEVICE_TYPES = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  TABLET: 'tablet',
  UNKNOWN: 'unknown',
} as const;

export type DeviceType = typeof DEVICE_TYPES[keyof typeof DEVICE_TYPES];

// ==================== FILTER VALUES ====================

/**
 * Common filter values
 */
export const FILTER_VALUES = {
  ALL: 'all',
  NONE: 'none',
} as const;

/**
 * Notice/notification filter values
 */
export const NOTICE_FILTER = {
  ALL: 'all',
  UNREAD: 'unread',
} as const;

export type NoticeFilter = typeof NOTICE_FILTER[keyof typeof NOTICE_FILTER];

/**
 * Active navigation items in the UI
 */
export const ACTIVE_ITEMS = {
  EXAMS: 'exams',
  RESULTS: 'results',
  QUESTIONS: 'questions',
  USERS: 'users',
  ROOMS: 'rooms',
  REPORTS: 'reports',        // ← ADD THIS LINE
  AUDIT: 'audit',
  HALLTICKETS: 'halltickets',
  CALENDAR: 'calendar',
  LEADERBOARD: 'leaderboard'
} as const;

export type ActiveItem = typeof ACTIVE_ITEMS[keyof typeof ACTIVE_ITEMS];

/**
 * UI section categories for styling
 */
export const SECTION_CATEGORIES = {
  MANAGEMENT: 'management',
  ACADEMIC: 'academic',
  ANALYTICS: 'analytics',
  MEMBERS: 'members',
  ACTIVITY: 'activity',
  RESOURCES: 'resources',
} as const;

export type SectionCategory = typeof SECTION_CATEGORIES[keyof typeof SECTION_CATEGORIES];

/**
 * Search result types
 */
export const SEARCH_RESULT_TYPES = {
  USER: 'user',
  EXAM: 'exam',
  QUESTION: 'question',
} as const;

export type SearchResultType = typeof SEARCH_RESULT_TYPES[keyof typeof SEARCH_RESULT_TYPES];

/**
 * Proprietary/visibility filter values for questions
 */
export const PROPRIETARY_FILTER = {
  ALL: 'all',
  PROPRIETARY: 'proprietary',
  COMMON: 'common',
} as const;

export type ProprietaryFilter = typeof PROPRIETARY_FILTER[keyof typeof PROPRIETARY_FILTER];

/**
 * UI labels for proprietary filters
 */
export const PROPRIETARY_FILTER_LABELS = {
  [PROPRIETARY_FILTER.ALL]: 'All Questions',
  [PROPRIETARY_FILTER.PROPRIETARY]: 'Private',
  [PROPRIETARY_FILTER.COMMON]: 'Public',
} as const;

// ==================== VALIDATION CONSTANTS ====================

/**
 * Validation limits and constraints
 */
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_QUESTION_LENGTH: 10,
  MAX_QUESTION_LENGTH: 5000,
  MIN_ANSWER_LENGTH: 1,
  MAX_ANSWER_LENGTH: 10000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_LOGIN_ATTEMPTS: 5,
  MIN_EXAM_DURATION: 5, // minutes
  MAX_EXAM_DURATION: 300, // minutes (5 hours)
} as const;

// ==================== SCORE THRESHOLDS ====================

/**
 * Score and percentage thresholds
 */
export const SCORE_THRESHOLDS = {
  PASSING_PERCENTAGE: 40,
  GOOD_PERCENTAGE: 60,
  EXCELLENT_PERCENTAGE: 80,
  HIGH_PLAGIARISM: 70,
  MEDIUM_PLAGIARISM: 40,
  LOW_CONFIDENCE: 50,
  HIGH_CONFIDENCE: 80,
} as const;

// ==================== FIRESTORE PATHS ====================

/**
 * Common Firestore document/collection paths
 */
export const FIRESTORE_PATHS = {
  EMAIL_CREDENTIALS: 'settings/email_credentials',
  SYSTEM_SETTINGS: 'settings/system',
  APP_CONFIG: 'settings/app_config',
} as const;

export type FirestorePath = typeof FIRESTORE_PATHS[keyof typeof FIRESTORE_PATHS];

// ==================== SYSTEM TRIGGERS ====================

/**
 * System trigger identifiers for automated actions
 */
export const SYSTEM_TRIGGERS = {
  SYSTEM: 'system',
  MANUAL: 'manual-trigger',
  SCHEDULED: 'scheduled',
  WEBHOOK: 'webhook',
} as const;

export type SystemTrigger = typeof SYSTEM_TRIGGERS[keyof typeof SYSTEM_TRIGGERS];

// ==================== CLOUD FUNCTION CONFIG ====================

/**
 * Cloud function configuration constants
 */
export const CLOUD_FUNCTION_CONFIG = {
  REGION: 'us-central1',
  BATCH_SIZE: 500,
  TIMEZONE: 'Asia/Kolkata',
  AUTO_COMPLETE_SCHEDULE: 'every 1 hours',
} as const;

// ==================== NOTIFICATION TYPES ====================

/**
 * Notification/announcement types
 */
export const NOTIFICATION_TYPES = {
  ANNOUNCEMENT: 'announcement',
  REMINDER: 'reminder',
  ALERT: 'alert',
  INFO: 'info',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// ==================== NOTIFICATION CATEGORIES ====================

/**
 * Notification categories
 */
export const NOTIFICATION_CATEGORIES = {
  ACADEMIC: 'academic',
  ADMINISTRATIVE: 'administrative',
  EVENT: 'event',
  GENERAL: 'general',
} as const;

export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[keyof typeof NOTIFICATION_CATEGORIES];

// ==================== ACTIVITY TYPES ====================

/**
 * Activity tracking types
 */
export const ACTIVITY_TYPES = {
  ENTER: 'enter',
  EXIT: 'exit',
} as const;

export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES];

// ==================== ATTENDANCE STATUS ====================

/**
 * Attendance status values
 */
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
} as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

// ==================== CONNECTION STATUS ====================

/**
 * Network connection status
 */
export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  RECONNECTED: 'reconnected',
  CONNECTED: 'connected',
} as const;

export type ConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

// ==================== SECURITY LEVELS ====================

/**
 * Security level options
 */
export const SECURITY_LEVELS = {
  SECURE: 'secure',
  NORMAL: 'normal',
} as const;

export type SecurityLevel = typeof SECURITY_LEVELS[keyof typeof SECURITY_LEVELS];


export const COMPLETION_POLICY = {
  STRICT: 'strict',
  FLEXIBLE: 'flexible',
} as const;

export type CompletionPolicy = typeof COMPLETION_POLICY[keyof typeof COMPLETION_POLICY];

export const COMPLETION_POLICY_LABELS = {
  [COMPLETION_POLICY.STRICT]: 'Strict Completion',
  [COMPLETION_POLICY.FLEXIBLE]: 'Flexible Completion',
} as const;

export const MAX_GRACE_PERIOD_MINUTES = 30;

// ==================== UI CONSTANTS ====================

/**
 * Upload workflow steps for bulk operations
 */
export const UPLOAD_STEPS = {
  SELECT: 'select',
  PREVIEW: 'preview',
  UPLOADING: 'uploading',
  COMPLETE: 'complete',
} as const;

export type UploadStep = typeof UPLOAD_STEPS[keyof typeof UPLOAD_STEPS];

/**
 * Notification message types
 */
export const NOTIFICATION_TYPES_UI = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success',
} as const;

export type NotificationTypeUI = typeof NOTIFICATION_TYPES_UI[keyof typeof NOTIFICATION_TYPES_UI];

// ==================== FILE & EXCEL CONSTANTS ====================

/**
 * Supported Excel file extensions
 */
export const EXCEL_FILE_EXTENSIONS = {
  XLSX: '.xlsx',
  XLS: '.xls',
} as const;

/**
 * Excel sheet names for bulk upload
 */
export const EXCEL_SHEET_NAMES = {
  QUESTIONS: 'Questions',
  REFERENCE: 'Reference',
  INSTRUCTIONS: 'Instructions',
  ROOMS: "Rooms"
} as const;

/**
 * Template filename for question upload
 */
export const TEMPLATE_FILENAME = 'questions_template.xlsx';

/**
 * Required columns for question upload
 */
export const REQUIRED_QUESTION_COLUMNS = [
  'class',
  'subject',
  'chapter',
  'question_text',
  'type',
  'maximum_marks',
  'difficulty_level',
] as const;

/**
 * Excel column widths for template
 */
export const EXCEL_COLUMN_WIDTHS = {
  NARROW: 10,
  SMALL: 12,
  MEDIUM: 15,
  STANDARD: 18,
  LARGE: 20,
  XLARGE: 22,
  WIDER: 25,
  EXTRA_WIDE: 30,
  DESCRIPTION: 40,
  CONTENT_MEDIUM: 50,
  CONTENT_LARGE: 60,
  CONTENT_XLARGE: 70,
  CONTENT_XXLARGE: 80,
} as const;

// ==================== SEPARATOR & DELIMITER CONSTANTS ====================

/**
 * Delimiter characters used in parsing
 */
export const DELIMITERS = {
  PIPE: '|',
  COMMA: ',',
  NEWLINE: '\n',
  TAB: '\t',
} as const;

/**
 * Regex patterns for text processing
 */
export const REGEX_PATTERNS = {
  WHITESPACE: /\s+/g,
  TRIM: /^\s+|\s+$/g,
  NEWLINES: /\n+/g,
} as const;

// ==================== UI TIMING CONSTANTS ====================

/**
 * UI timing and delays (in milliseconds)
 */
export const UI_TIMINGS = {
  COPY_FEEDBACK_DURATION: 2000,
  NOTIFICATION_TIMEOUT: 10000,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 300,
} as const;

// ==================== UI SIZING CONSTANTS ====================

/**
 * Icon sizes used throughout UI
 */
export const ICON_SIZES = {
  TINY: 12,
  SMALL: 16,
  MEDIUM: 18,
  LARGE: 24,
  XLARGE: 32,
  XXLARGE: 48,
  XXXLARGE: 64,
} as const;

// ==================== UPLOAD & PROCESSING CONSTANTS ====================

/**
 * Excel row offset for error messages (header row + 1)
 */
export const EXCEL_ROW_OFFSET = 2;

/**
 * Default values for questions
 */
export const QUESTION_DEFAULTS = {
  MARKS: 1,
  EMPTY_STRING: '',
} as const;

/**
 * Pagination settings for question lists
 */
export const QUESTION_PAGINATION = {
  INITIAL_COUNT: 10,
  INCREMENT: 10,
  STARTING_INDEX: 1,
} as const;

// ==================== NOTIFICATION MESSAGES ====================

/**
 * Standard notification messages
 */
export const NOTIFICATION_MESSAGES = {
  TEMPLATE_DOWNLOADED: 'Template downloaded successfully!',
  FILE_EMPTY: 'The Excel file is empty.',
  INVALID_FILE_TYPE: 'Please upload an Excel file',
  PARSE_ERROR: 'Error parsing Excel file.',
  UPLOAD_SUCCESS: 'Questions uploaded successfully!',
  CHAPTER_REQUIRED: 'Chapter is required',
} as const;


// ==================== UI SUBMIT STATUS ====================

/**
 * Submit dialog states for exam submission flow
 */
export const SUBMIT_STATUS = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type SubmitStatus = typeof SUBMIT_STATUS[keyof typeof SUBMIT_STATUS];

// ==================== MONTH NAMES ====================

/**
 * Short month name abbreviations for date formatting
 */
export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

// ==================== LIVE STATS CONFIGURATION ====================

/**
 * Configuration for Live Stats monitoring
 */
export const LIVE_STATS_CONFIG = {
  AUTO_REFRESH_INTERVAL: 60000, // 10 seconds
  MAX_VIOLATIONS_DISPLAY: 5,
  ROLL_NUMBER_LENGTH: 4,
} as const;

// ==================== TIME UNITS ====================

/**
 * Time unit conversions for calculations
 */
export const TIME_UNITS = {
  SECONDS_IN_MINUTE: 60,
  SECONDS_IN_HOUR: 3600,
  MINUTES_IN_HOUR: 60,
} as const;

// ==================== ACADEMIC YEARS ====================

/**
 * Academic year options for the application
 * Format: YYYY-YY (e.g., "2025-26" represents academic year 2025-2026)
 */
export const ACADEMIC_YEARS = [
  '2025-26',
  '2026-27',
  '2027-28',
  '2028-29',
  '2029-30',
  '2030-31',
  '2031-32',
] as const;

/**
 * Academic years with "All" option for filters
 */
export const ACADEMIC_YEARS_WITH_ALL = [
  'all',
  ...ACADEMIC_YEARS
] as const;

export type AcademicYear = typeof ACADEMIC_YEARS[number];

// ==================== STUDENT STATUS ====================

/**
 * Student activity status during exam
 */
export const STUDENT_STATUS = {
  ACTIVE: 'active',
  IDLE: 'idle',
  SUBMITTED: 'submitted',
  ABSENT: 'absent',
} as const;

export type StudentStatus = typeof STUDENT_STATUS[keyof typeof STUDENT_STATUS];

// ==================== SEVERITY STYLING ====================

/**
 * Tailwind CSS classes for severity level styling
 */
export const SEVERITY_COLOR_CLASSES = {
  [SEVERITY_LEVELS.CRITICAL]: 'bg-red-100 border-red-300 text-red-800',
  [SEVERITY_LEVELS.HIGH]: 'bg-orange-100 border-orange-300 text-orange-800',
  [SEVERITY_LEVELS.MEDIUM]: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  [SEVERITY_LEVELS.LOW]: 'bg-blue-100 border-blue-300 text-blue-800',
} as const;

/**
 * Badge classes for violation severity badges
 */
export const SEVERITY_BADGE_CLASSES = {
  [SEVERITY_LEVELS.CRITICAL]: 'bg-red-200 text-red-900',
  [SEVERITY_LEVELS.HIGH]: 'bg-orange-200 text-orange-900',
  [SEVERITY_LEVELS.MEDIUM]: 'bg-yellow-200 text-yellow-900',
  [SEVERITY_LEVELS.LOW]: 'bg-blue-200 text-blue-900',
} as const;

/**
 * Text color classes for violation severity
 */
export const SEVERITY_TEXT_CLASSES = {
  [SEVERITY_LEVELS.CRITICAL]: 'text-red-600',
  [SEVERITY_LEVELS.HIGH]: 'text-orange-600',
  [SEVERITY_LEVELS.MEDIUM]: 'text-yellow-600',
  [SEVERITY_LEVELS.LOW]: 'text-blue-600',
} as const;

// ==================== STUDENT STATUS STYLING ====================

/**
 * Color classes for student status indicators
 */
export const STUDENT_STATUS_COLORS = {
  [STUDENT_STATUS.ACTIVE]: 'text-green-600 bg-green-100',
  [STUDENT_STATUS.IDLE]: 'text-yellow-600 bg-yellow-100',
  [STUDENT_STATUS.SUBMITTED]: 'text-blue-600 bg-blue-100',
  [STUDENT_STATUS.ABSENT]: 'text-red-600 bg-red-100',
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if user type has sufficient permissions
 */
export function hasPermissionLevel(
  userType: UserType,
  requiredType: UserType
): boolean {
  return USER_TYPE_LEVELS[userType] >= USER_TYPE_LEVELS[requiredType];
}

// ==================== EXPORTS ====================

/**
 * Export all constants as a single object (optional convenience export)
 */
export const APP_CONSTANTS = {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  USER_TYPES,
  USER_TYPE_LABELS,
  USER_TYPE_LEVELS,
  COMPLEXITY_LEVELS,
  COMPLEXITY_LABELS,
  COMPLEXITY_LEGACY_MAP,
  USER_STATUS,
  ATTEMPT_STATUS,
  EVALUATION_STATUS,
  EXAM_STATUS,
  EXAM_STATUS_LABELS,
  NOTIFICATION_STATUS,
  PRIORITY_LEVELS,
  SEVERITY_LEVELS,
  EXAM_MODES,
  EXAM_MODE_LABELS,
  CONNECTION_TYPES,
  VIOLATION_TYPES,
  VIOLATION_SEVERITY_MAP,
  VIOLATION_DESCRIPTIONS,
  COLLECTIONS,
  SPECIAL_IDS,
  DEFAULT_COLLEGE_ID,
  PERMISSION_LEVELS,
  AI_MODELS,
  CODE_EXECUTION_STATUS,
  PROGRAMMING_LANGUAGES,
  PROGRAMMING_LANGUAGE_LABELS,
  PAGINATION,
  TIME_CONSTANTS,
  TARGET_AUDIENCES,
  DEVICE_TYPES,
  FILTER_VALUES,
  NOTICE_FILTER,
  ACTIVE_ITEMS,
  SECTION_CATEGORIES,
  SEARCH_RESULT_TYPES,
  PROPRIETARY_FILTER,
  PROPRIETARY_FILTER_LABELS,
  VALIDATION,
  SCORE_THRESHOLDS,
  FIRESTORE_PATHS,
  SYSTEM_TRIGGERS,
  CLOUD_FUNCTION_CONFIG,
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  ACTIVITY_TYPES,
  ATTENDANCE_STATUS,
  CONNECTION_STATUS,
  SECURITY_LEVELS,
  UPLOAD_STEPS,
  NOTIFICATION_TYPES_UI,
  EXCEL_FILE_EXTENSIONS,
  EXCEL_SHEET_NAMES,
  TEMPLATE_FILENAME,
  REQUIRED_QUESTION_COLUMNS,
  EXCEL_COLUMN_WIDTHS,
  DELIMITERS,
  REGEX_PATTERNS,
  UI_TIMINGS,
  ICON_SIZES,
  EXCEL_ROW_OFFSET,
  QUESTION_DEFAULTS,
  QUESTION_PAGINATION,
  NOTIFICATION_MESSAGES,
  SUBMIT_STATUS,
  MONTH_NAMES_SHORT,
  LIVE_STATS_CONFIG,
  TIME_UNITS,
  ACADEMIC_YEARS,
  ACADEMIC_YEARS_WITH_ALL,
  STUDENT_STATUS,
  SEVERITY_COLOR_CLASSES,
  SEVERITY_BADGE_CLASSES,
  SEVERITY_TEXT_CLASSES,
  STUDENT_STATUS_COLORS,
} as const;
// Add these new constants to your existing constants.ts file

// ==================== ROOM CONSTANTS ====================

/**
 * Room status types
 */
export const ROOM_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
} as const;

export type RoomStatus = typeof ROOM_STATUS[keyof typeof ROOM_STATUS];

/**
 * UI labels for room status
 */
export const ROOM_STATUS_LABELS = {
  [ROOM_STATUS.AVAILABLE]: 'Available',
  [ROOM_STATUS.BUSY]: 'Busy',
} as const;

/**
 * Event types for room scheduling
 */
export const ROOM_EVENT_TYPES = {
  EXAM: 'exams',
  FUNCTION: 'function',
  MEETING: 'meeting',
  SHOW: 'show',
} as const;

export type RoomEventType = typeof ROOM_EVENT_TYPES[keyof typeof ROOM_EVENT_TYPES];

/**
 * UI labels for room event types
 */
export const ROOM_EVENT_TYPE_LABELS = {
  [ROOM_EVENT_TYPES.EXAM]: 'Exam',
  [ROOM_EVENT_TYPES.FUNCTION]: 'Function',
  [ROOM_EVENT_TYPES.MEETING]: 'Meeting',
  [ROOM_EVENT_TYPES.SHOW]: 'Show',
} as const;

/**
 * Template filename for room upload
 */
export const ROOM_TEMPLATE_FILENAME = 'rooms_template.xlsx';

/**
 * Required columns for room upload
 */
export const REQUIRED_ROOM_COLUMNS = [
  'room_name',
  'room_address',
  'room_capacity',
  'sitting_matrix',
  'room_status',
] as const;

/**
 * Room types
 */
export const ROOM_TYPES = {
  CLASSROOM: 'classroom',
  ADMIN_ROOM: 'admin_room',
  LIBRARY: 'library',
  LAB: 'lab',
  COMPUTER_LAB: 'computer_lab',
  SCIENCE_LAB: 'science_lab',
  HALL: 'hall',
  AUDITORIUM: 'auditorium',
  LOUNGE: 'lounge',
  CONFERENCE_ROOM: 'conference_room',
  FACULTY_ROOM: 'faculty_room',
  CAFETERIA: 'cafeteria',
  SPORTS_ROOM: 'sports_room',
  MUSIC_ROOM: 'music_room',
  ART_ROOM: 'art_room',
  SEMINAR_HALL: 'seminar_hall',
  WORKSHOP: 'workshop',
  STORAGE: 'storage',
  SERVER_ROOM: 'server_room',
  MEDICAL_ROOM: 'medical_room',
} as const;

export type RoomType = typeof ROOM_TYPES[keyof typeof ROOM_TYPES];

/**
 * UI labels for room types
 */
export const ROOM_TYPE_LABELS = {
  [ROOM_TYPES.CLASSROOM]: 'Class Room',
  [ROOM_TYPES.ADMIN_ROOM]: 'Admin Room',
  [ROOM_TYPES.LIBRARY]: 'Library',
  [ROOM_TYPES.LAB]: 'Lab',
  [ROOM_TYPES.COMPUTER_LAB]: 'Computer Lab',
  [ROOM_TYPES.SCIENCE_LAB]: 'Science Lab',
  [ROOM_TYPES.HALL]: 'Hall',
  [ROOM_TYPES.AUDITORIUM]: 'Auditorium',
  [ROOM_TYPES.LOUNGE]: 'Lounge',
  [ROOM_TYPES.CONFERENCE_ROOM]: 'Conference Room',
  [ROOM_TYPES.FACULTY_ROOM]: 'Faculty Room',
  [ROOM_TYPES.CAFETERIA]: 'Cafeteria',
  [ROOM_TYPES.SPORTS_ROOM]: 'Sports Room',
  [ROOM_TYPES.MUSIC_ROOM]: 'Music Room',
  [ROOM_TYPES.ART_ROOM]: 'Art Room',
  [ROOM_TYPES.SEMINAR_HALL]: 'Seminar Hall',
  [ROOM_TYPES.WORKSHOP]: 'Workshop',
  [ROOM_TYPES.STORAGE]: 'Storage',
  [ROOM_TYPES.SERVER_ROOM]: 'Server Room',
  [ROOM_TYPES.MEDICAL_ROOM]: 'Medical Room',
} as const;

/**
 * Room pagination settings
 */
export const ROOM_PAGINATION = {
  INITIAL_COUNT: 10,
  INCREMENT: 10,
  STARTING_INDEX: 1,
} as const;



export default APP_CONSTANTS;