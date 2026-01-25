/**
 * Notice priority levels
 */
export declare const NOTICE_PRIORITY: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
};
export type NoticePriority = typeof NOTICE_PRIORITY[keyof typeof NOTICE_PRIORITY];
/**
 * Notice categories
 */
export declare const NOTICE_CATEGORY: {
    readonly GENERAL: "general";
    readonly ACADEMIC: "academic";
    readonly ADMINISTRATIVE: "administrative";
    readonly EVENT: "event";
};
export type NoticeCategory = typeof NOTICE_CATEGORY[keyof typeof NOTICE_CATEGORY];
/**
 * Standard question types - USE THESE EVERYWHERE
 */
export declare const QUESTION_TYPES: {
    readonly MCQ: "mcq";
    readonly FITB: "fitb";
    readonly JUMBLED: "jumbled";
    readonly DESCRIPTIVE: "descriptive";
    readonly CODE: "code";
};
export type QuestionType = typeof QUESTION_TYPES[keyof typeof QUESTION_TYPES];
/**
 * UI labels for question types
 */
export declare const QUESTION_TYPE_LABELS: {
    readonly mcq: "MCQ";
    readonly fitb: "FITB";
    readonly jumbled: "Jumbled";
    readonly descriptive: "Descriptive";
    readonly code: "Code";
};
/**
 * User role types
 */
export declare const USER_TYPES: {
    readonly SYSTEM_ADMIN: "system_admin";
    readonly SUPER_ADMIN: "super_admin";
    readonly ADMIN: "admin";
    readonly PRINCIPAL: "principal";
    readonly DEAN: "dean";
    readonly TEACHER: "teacher";
    readonly STUDENT: "student";
};
export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];
/**
 * UI labels for user types
 */
export declare const USER_TYPE_LABELS: {
    readonly system_admin: "System Admin";
    readonly super_admin: "Super Admin";
    readonly admin: "Admin";
    readonly principal: "Principal";
    readonly dean: "Dean";
    readonly teacher: "Teacher";
    readonly student: "Student";
};
/**
 * User type icons for UI display
 */
export declare const USER_TYPE_ICONS: {
    readonly system_admin: "👨‍💼";
    readonly super_admin: "⚡";
    readonly admin: "⚙️";
    readonly principal: "🏆";
    readonly dean: "👔";
    readonly teacher: "👨‍🏫";
    readonly student: "🎓";
};
/**
 * User type hierarchy levels (for permission checks)
 */
export declare const USER_TYPE_LEVELS: {
    readonly super_admin: 110;
    readonly system_admin: 100;
    readonly admin: 90;
    readonly principal: 80;
    readonly dean: 70;
    readonly teacher: 50;
    readonly student: 10;
};
/**
 * Question complexity/difficulty levels
 */
export declare const COMPLEXITY_LEVELS: {
    readonly EASY: "easy";
    readonly MEDIUM: "medium";
    readonly HARD: "hard";
    readonly BASIC: "easy";
    readonly INTERMEDIATE: "medium";
    readonly ADVANCED: "hard";
};
export type ComplexityLevel = typeof COMPLEXITY_LEVELS[keyof typeof COMPLEXITY_LEVELS];
/**
 * UI labels for complexity levels
 */
export declare const COMPLEXITY_LABELS: {
    readonly easy: "Easy";
    readonly medium: "Medium";
    readonly hard: "Hard";
};
/**
 * Map legacy complexity values to current standard
 */
export declare const COMPLEXITY_LEGACY_MAP: {
    readonly Basic: "easy";
    readonly basic: "easy";
    readonly Intermediate: "medium";
    readonly intermediate: "medium";
    readonly Advanced: "hard";
    readonly advanced: "hard";
    readonly Easy: "easy";
    readonly easy: "easy";
    readonly Medium: "medium";
    readonly medium: "medium";
    readonly Hard: "hard";
    readonly hard: "hard";
};
/**
 * User account status
 */
export declare const USER_STATUS: {
    readonly ACTIVE: "active";
    readonly DISABLED: "disabled";
    readonly SUSPENDED: "suspended";
    readonly PENDING: "pending";
};
export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];
/**
 * Exam attempt status
 */
export declare const ATTEMPT_STATUS: {
    readonly IN_PROGRESS: "in_progress";
    readonly SUBMITTED: "submitted";
    readonly AUTO_SUBMITTED: "auto_submitted";
    readonly EVALUATED: "evaluated";
    readonly UNDER_REVIEW: "under_review";
    readonly PENDING: "pending";
};
export type AttemptStatus = typeof ATTEMPT_STATUS[keyof typeof ATTEMPT_STATUS];
/**
 * Evaluation status for questions/exams
 */
export declare const EVALUATION_STATUS: {
    readonly PENDING: "pending";
    readonly IN_PROGRESS: "in_progress";
    readonly EVALUATING: "evaluating";
    readonly COMPLETED: "completed";
    readonly NOT_ATTEMPTED: "not_attempted";
    readonly FAILED: "failed";
    readonly MANUAL_REVIEW: "manual_review";
};
export type EvaluationStatus = typeof EVALUATION_STATUS[keyof typeof EVALUATION_STATUS];
/**
 * Exam status
 */
export declare const EXAM_STATUS: {
    readonly DRAFT: "draft";
    readonly SCHEDULED: "scheduled";
    readonly ACTIVE: "active";
    readonly ONGOING: "ongoing";
    readonly UPCOMING: "upcoming";
    readonly COMPLETED: "completed";
    readonly CANCELLED: "cancelled";
    readonly INTERRUPTED: "interrupted";
};
export type ExamStatus = typeof EXAM_STATUS[keyof typeof EXAM_STATUS];
/**
 * UI labels for exam status
 */
export declare const EXAM_STATUS_LABELS: {
    readonly draft: "Draft";
    readonly scheduled: "Scheduled";
    readonly active: "Active";
    readonly ongoing: "Ongoing";
    readonly upcoming: "Upcoming";
    readonly completed: "Completed";
    readonly cancelled: "Cancelled";
    readonly interrupted: "Interrupted";
};
/**
 * Notification status
 */
export declare const NOTIFICATION_STATUS: {
    readonly ACTIVE: "active";
    readonly EXPIRED: "expired";
    readonly DRAFT: "draft";
};
export type NotificationStatus = typeof NOTIFICATION_STATUS[keyof typeof NOTIFICATION_STATUS];
/**
 * Priority levels
 */
export declare const PRIORITY_LEVELS: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
    readonly URGENT: "urgent";
};
export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];
/**
 * Severity levels
 */
export declare const SEVERITY_LEVELS: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
export type SeverityLevel = typeof SEVERITY_LEVELS[keyof typeof SEVERITY_LEVELS];
/**
 * Exam delivery modes
 */
export declare const EXAM_MODES: {
    readonly ONLINE: "online";
    readonly OFFLINE: "offline";
    readonly HYBRID: "hybrid";
};
export type ExamMode = typeof EXAM_MODES[keyof typeof EXAM_MODES];
/**
 * UI labels for exam modes
 */
export declare const EXAM_MODE_LABELS: {
    readonly online: "Online";
    readonly offline: "Offline";
    readonly hybrid: "Hybrid";
};
/**
 * Network connection types
 */
export declare const CONNECTION_TYPES: {
    readonly WIFI: "wifi";
    readonly CELLULAR: "cellular";
    readonly ETHERNET: "ethernet";
    readonly UNKNOWN: "unknown";
};
export type ConnectionType = typeof CONNECTION_TYPES[keyof typeof CONNECTION_TYPES];
/**
 * Maximum violations allowed per exam attempt
 */
export declare const MAX_VIOLATIONS = 250;
/**
 * Types of exam violations - Comprehensive list for proctoring
 */
export declare const VIOLATION_TYPES: {
    readonly WINDOW_BLUR: "WINDOW_BLUR";
    readonly TAB_SWITCH: "TAB_SWITCH";
    readonly WINDOW_MINIMIZE: "WINDOW_MINIMIZE";
    readonly FULLSCREEN_EXIT: "FULLSCREEN_EXIT";
    readonly COPY_ATTEMPT: "COPY_ATTEMPT";
    readonly PASTE_ATTEMPT: "PASTE_ATTEMPT";
    readonly CUT_ATTEMPT: "CUT_ATTEMPT";
    readonly RIGHT_CLICK: "RIGHT_CLICK";
    readonly PRINT_SCREEN: "PRINT_SCREEN";
    readonly SCREENSHOT_ATTEMPT: "SCREENSHOT_ATTEMPT";
    readonly DEVTOOLS_OPEN: "DEVTOOLS_OPEN";
    readonly CONSOLE_OPEN: "CONSOLE_OPEN";
    readonly MULTIPLE_TABS: "MULTIPLE_TABS";
    readonly NETWORK_DISCONNECT: "NETWORK_DISCONNECT";
    readonly TIME_MANIPULATION: "TIME_MANIPULATION";
    readonly SHORTCUT_CTRLC: "SHORTCUT_CTRLC";
    readonly SHORTCUT_CTRLV: "SHORTCUT_CTRLV";
    readonly SHORTCUT_CTRLX: "SHORTCUT_CTRLX";
    readonly SHORTCUT_CTRLA: "SHORTCUT_CTRLA";
    readonly SHORTCUT_ALTTAB: "SHORTCUT_ALTTAB";
    readonly SHORTCUT_CMDTAB: "SHORTCUT_CMDTAB";
    readonly SHORTCUT_CTRLSHIFTC: "SHORTCUT_CTRLSHIFTC";
    readonly SHORTCUT_F12: "SHORTCUT_F12";
    readonly SHORTCUT_CTRLP: "SHORTCUT_CTRLP";
    readonly SHORTCUT_CTRLS: "SHORTCUT_CTRLS";
    readonly SHORTCUT_DEVTOOLS: "SHORTCUT_DEVTOOLS";
    readonly MULTIPLE_FACES: "MULTIPLE_FACES";
    readonly NO_FACE: "NO_FACE";
    readonly FACE_MISMATCH: "FACE_MISMATCH";
    readonly HEAD_TURNED: "HEAD_TURNED";
    readonly LOUD_NOISE: "LOUD_NOISE";
    readonly HUMAN_VOICE_DETECTED: "HUMAN_VOICE_DETECTED";
    readonly SUSPICIOUS_MOVEMENT: "SUSPICIOUS_MOVEMENT";
    readonly PROHIBITED_OBJECT: "PROHIBITED_OBJECT";
    readonly VIRTUAL_MACHINE: "VIRTUAL_MACHINE";
    readonly DOM_TAMPERING: "DOM_TAMPERING";
    readonly DEVICE_CHANGE: "DEVICE_CHANGE";
};
export type ViolationType = typeof VIOLATION_TYPES[keyof typeof VIOLATION_TYPES];
/**
 * Violation severity mapping
 */
export declare const VIOLATION_SEVERITY_MAP: Record<ViolationType, SeverityLevel>;
/**
 * Violation descriptions for logging
 */
export declare const VIOLATION_DESCRIPTIONS: Record<ViolationType, string>;
/**
 * Firebase collection names
 */
export declare const COLLECTIONS: {
    readonly USERS: "users";
    readonly COLLEGES: "colleges";
    readonly QUESTION_BANK: "questionBank";
    readonly EXAMS: "exams";
    readonly EXAM_ATTEMPTS: "examAttempts";
    readonly STUDENT_RESPONSES: "studentResponses";
    readonly NOTIFICATIONS: "notifications";
    readonly ACTIVITIES: "activities";
    readonly VIOLATIONS: "violations";
    readonly INTERNET_STATUS: "internetStatus";
    readonly CHAT_MESSAGES: "chatMessages";
    readonly SYSTEM_LOGS: "systemLogs";
    readonly ATTENDANCE: "Attendance";
    readonly ROOMS: "rooms";
    readonly ROOM_BOOKINGS: "roomBookings";
    readonly SETTINGS: "settings";
    readonly PASSWORD_RESET_OTPS: "passwordResetOTPs";
    readonly PASSWORD_RESET_REQUESTS: "passwordResetRequests";
    readonly CODING_LANGUAGES: "CodingLanguages";
};
/**
 * Special college/organization identifiers
 */
export declare const SPECIAL_IDS: {
    readonly TUTORIALS_POINT: "tutorialspoint";
    readonly SYSTEM: "system";
    readonly COMMON: "common";
};
/**
 * Default college ID for common questions (shared across all colleges)
 */
export declare const DEFAULT_COLLEGE_ID: "tutorialspoint";
/**
 * Permission/access levels
 */
export declare const PERMISSION_LEVELS: {
    readonly SYSTEM: "system";
    readonly COLLEGE: "college";
    readonly DEPARTMENT: "department";
    readonly CLASS: "class";
    readonly PERSONAL: "personal";
};
export type PermissionLevel = typeof PERMISSION_LEVELS[keyof typeof PERMISSION_LEVELS];
/**
 * AI models used for evaluation
 */
export declare const AI_MODELS: {
    readonly GPT_4: "gpt-4";
    readonly GPT_4_TURBO: "gpt-4-turbo";
    readonly GPT_4O: "gpt-4o";
    readonly GPT_4O_MINI: "gpt-4o-mini";
    readonly GPT_3_5_TURBO: "gpt-3.5-turbo";
    readonly CLAUDE_3_OPUS: "claude-3-opus";
    readonly CLAUDE_3_SONNET: "claude-3-sonnet";
};
export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];
/**
 * Code execution status
 */
export declare const CODE_EXECUTION_STATUS: {
    readonly SUCCESS: "success";
    readonly ERROR: "error";
    readonly TIMEOUT: "timeout";
    readonly COMPILATION_ERROR: "compilation_error";
    readonly RUNTIME_ERROR: "runtime_error";
};
export type CodeExecutionStatus = typeof CODE_EXECUTION_STATUS[keyof typeof CODE_EXECUTION_STATUS];
/**
 * Supported programming languages
 */
export declare const PROGRAMMING_LANGUAGES: {
    readonly PYTHON: "python";
    readonly JAVA: "java";
    readonly JAVASCRIPT: "javascript";
    readonly CPP: "cpp";
    readonly C: "c";
    readonly CSHARP: "csharp";
    readonly GO: "go";
    readonly RUST: "rust";
};
export type ProgrammingLanguage = typeof PROGRAMMING_LANGUAGES[keyof typeof PROGRAMMING_LANGUAGES];
/**
 * UI labels for programming languages
 */
export declare const PROGRAMMING_LANGUAGE_LABELS: {
    readonly python: "Python";
    readonly java: "Java";
    readonly javascript: "Javascript";
    readonly cpp: "C++";
    readonly c: "C";
    readonly csharp: "C#";
    readonly go: "Go";
    readonly rust: "Rust";
};
/**
 * Default pagination settings
 */
export declare const PAGINATION: {
    readonly DEFAULT_PAGE_SIZE: 25;
    readonly MAX_PAGE_SIZE: 100;
    readonly QUESTIONS_PER_PAGE: 50;
    readonly STUDENTS_PER_PAGE: 25;
    readonly EXAMS_PER_PAGE: 20;
};
/**
 * Time-related constants (in milliseconds)
 */
export declare const TIME_CONSTANTS: {
    readonly ONE_SECOND: 1000;
    readonly ONE_MINUTE: number;
    readonly ONE_HOUR: number;
    readonly ONE_DAY: number;
    readonly ONE_WEEK: number;
};
/**
 * Notification/announcement target audiences
 */
export declare const TARGET_AUDIENCES: {
    readonly ALL: "all";
    readonly STUDENTS: "students";
    readonly FACULTY: "faculty";
    readonly TEACHERS: "teachers";
    readonly PARENTS: "parents";
    readonly STAFF: "staff";
};
export type TargetAudience = typeof TARGET_AUDIENCES[keyof typeof TARGET_AUDIENCES];
/**
 * Device types for tracking
 */
export declare const DEVICE_TYPES: {
    readonly DESKTOP: "desktop";
    readonly MOBILE: "mobile";
    readonly TABLET: "tablet";
    readonly UNKNOWN: "unknown";
};
export type DeviceType = typeof DEVICE_TYPES[keyof typeof DEVICE_TYPES];
/**
 * Common filter values
 */
export declare const FILTER_VALUES: {
    readonly ALL: "all";
    readonly NONE: "none";
};
/**
 * Notice/notification filter values
 */
export declare const NOTICE_FILTER: {
    readonly ALL: "all";
    readonly UNREAD: "unread";
};
export type NoticeFilter = typeof NOTICE_FILTER[keyof typeof NOTICE_FILTER];
/**
 * Active navigation items in the UI
 */
export declare const ACTIVE_ITEMS: {
    readonly EXAMS: "exams";
    readonly RESULTS: "results";
    readonly QUESTIONS: "questions";
    readonly USERS: "users";
    readonly ROOMS: "rooms";
    readonly REPORTS: "reports";
    readonly AUDIT: "audit";
    readonly HALLTICKETS: "halltickets";
    readonly CALENDAR: "calendar";
    readonly LEADERBOARD: "leaderboard";
};
export type ActiveItem = typeof ACTIVE_ITEMS[keyof typeof ACTIVE_ITEMS];
/**
 * UI section categories for styling
 */
export declare const SECTION_CATEGORIES: {
    readonly MANAGEMENT: "management";
    readonly ACADEMIC: "academic";
    readonly ANALYTICS: "analytics";
    readonly MEMBERS: "members";
    readonly ACTIVITY: "activity";
    readonly RESOURCES: "resources";
};
export type SectionCategory = typeof SECTION_CATEGORIES[keyof typeof SECTION_CATEGORIES];
/**
 * Search result types
 */
export declare const SEARCH_RESULT_TYPES: {
    readonly USER: "user";
    readonly EXAM: "exam";
    readonly QUESTION: "question";
};
export type SearchResultType = typeof SEARCH_RESULT_TYPES[keyof typeof SEARCH_RESULT_TYPES];
/**
 * Proprietary/visibility filter values for questions
 */
export declare const PROPRIETARY_FILTER: {
    readonly ALL: "all";
    readonly PROPRIETARY: "proprietary";
    readonly COMMON: "common";
};
export type ProprietaryFilter = typeof PROPRIETARY_FILTER[keyof typeof PROPRIETARY_FILTER];
/**
 * UI labels for proprietary filters
 */
export declare const PROPRIETARY_FILTER_LABELS: {
    readonly all: "All Questions";
    readonly proprietary: "Private";
    readonly common: "Public";
};
/**
 * Validation limits and constraints
 */
export declare const VALIDATION: {
    readonly MIN_PASSWORD_LENGTH: 8;
    readonly MAX_PASSWORD_LENGTH: 128;
    readonly MIN_QUESTION_LENGTH: 10;
    readonly MAX_QUESTION_LENGTH: 5000;
    readonly MIN_ANSWER_LENGTH: 1;
    readonly MAX_ANSWER_LENGTH: 10000;
    readonly MAX_FILE_SIZE: number;
    readonly MAX_IMAGE_SIZE: number;
    readonly MAX_LOGIN_ATTEMPTS: 5;
    readonly MIN_EXAM_DURATION: 5;
    readonly MAX_EXAM_DURATION: 300;
};
/**
 * Score and percentage thresholds
 */
export declare const SCORE_THRESHOLDS: {
    readonly PASSING_PERCENTAGE: 40;
    readonly GOOD_PERCENTAGE: 60;
    readonly EXCELLENT_PERCENTAGE: 80;
    readonly HIGH_PLAGIARISM: 70;
    readonly MEDIUM_PLAGIARISM: 40;
    readonly LOW_CONFIDENCE: 50;
    readonly HIGH_CONFIDENCE: 80;
};
/**
 * Common Firestore document/collection paths
 */
export declare const FIRESTORE_PATHS: {
    readonly EMAIL_CREDENTIALS: "settings/email_credentials";
    readonly SYSTEM_SETTINGS: "settings/system";
    readonly APP_CONFIG: "settings/app_config";
};
export type FirestorePath = typeof FIRESTORE_PATHS[keyof typeof FIRESTORE_PATHS];
/**
 * System trigger identifiers for automated actions
 */
export declare const SYSTEM_TRIGGERS: {
    readonly SYSTEM: "system";
    readonly MANUAL: "manual-trigger";
    readonly SCHEDULED: "scheduled";
    readonly WEBHOOK: "webhook";
};
export type SystemTrigger = typeof SYSTEM_TRIGGERS[keyof typeof SYSTEM_TRIGGERS];
/**
 * Cloud function configuration constants
 */
export declare const CLOUD_FUNCTION_CONFIG: {
    readonly REGION: "us-central1";
    readonly BATCH_SIZE: 500;
    readonly TIMEZONE: "Asia/Kolkata";
    readonly AUTO_COMPLETE_SCHEDULE: "every 1 hours";
};
/**
 * Notification/announcement types
 */
export declare const NOTIFICATION_TYPES: {
    readonly ANNOUNCEMENT: "announcement";
    readonly REMINDER: "reminder";
    readonly ALERT: "alert";
    readonly INFO: "info";
};
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
/**
 * Notification categories
 */
export declare const NOTIFICATION_CATEGORIES: {
    readonly ACADEMIC: "academic";
    readonly ADMINISTRATIVE: "administrative";
    readonly EVENT: "event";
    readonly GENERAL: "general";
};
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[keyof typeof NOTIFICATION_CATEGORIES];
/**
 * Activity tracking types
 */
export declare const ACTIVITY_TYPES: {
    readonly ENTER: "enter";
    readonly EXIT: "exit";
};
export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES];
/**
 * Attendance status values
 */
export declare const ATTENDANCE_STATUS: {
    readonly PRESENT: "present";
    readonly ABSENT: "absent";
};
export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];
/**
 * Network connection status
 */
export declare const CONNECTION_STATUS: {
    readonly DISCONNECTED: "disconnected";
    readonly RECONNECTED: "reconnected";
    readonly CONNECTED: "connected";
};
export type ConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];
/**
 * Security level options
 */
export declare const SECURITY_LEVELS: {
    readonly SECURE: "secure";
    readonly NORMAL: "normal";
};
export type SecurityLevel = typeof SECURITY_LEVELS[keyof typeof SECURITY_LEVELS];
export declare const COMPLETION_POLICY: {
    readonly STRICT: "strict";
    readonly FLEXIBLE: "flexible";
};
export type CompletionPolicy = typeof COMPLETION_POLICY[keyof typeof COMPLETION_POLICY];
export declare const COMPLETION_POLICY_LABELS: {
    readonly strict: "Strict Completion";
    readonly flexible: "Flexible Completion";
};
export declare const MAX_GRACE_PERIOD_MINUTES = 30;
/**
 * Upload workflow steps for bulk operations
 */
export declare const UPLOAD_STEPS: {
    readonly SELECT: "select";
    readonly PREVIEW: "preview";
    readonly UPLOADING: "uploading";
    readonly COMPLETE: "complete";
};
export type UploadStep = typeof UPLOAD_STEPS[keyof typeof UPLOAD_STEPS];
/**
 * Notification message types
 */
export declare const NOTIFICATION_TYPES_UI: {
    readonly ERROR: "error";
    readonly WARNING: "warning";
    readonly INFO: "info";
    readonly SUCCESS: "success";
};
export type NotificationTypeUI = typeof NOTIFICATION_TYPES_UI[keyof typeof NOTIFICATION_TYPES_UI];
/**
 * Supported Excel file extensions
 */
export declare const EXCEL_FILE_EXTENSIONS: {
    readonly XLSX: ".xlsx";
    readonly XLS: ".xls";
};
/**
 * Excel sheet names for bulk upload
 */
export declare const EXCEL_SHEET_NAMES: {
    readonly QUESTIONS: "Questions";
    readonly REFERENCE: "Reference";
    readonly INSTRUCTIONS: "Instructions";
    readonly ROOMS: "Rooms";
};
/**
 * Template filename for question upload
 */
export declare const TEMPLATE_FILENAME = "questions_template.xlsx";
/**
 * Required columns for question upload
 */
export declare const REQUIRED_QUESTION_COLUMNS: readonly ["class", "subject", "chapter", "question_text", "type", "maximum_marks", "difficulty_level"];
/**
 * Excel column widths for template
 */
export declare const EXCEL_COLUMN_WIDTHS: {
    readonly NARROW: 10;
    readonly SMALL: 12;
    readonly MEDIUM: 15;
    readonly STANDARD: 18;
    readonly LARGE: 20;
    readonly XLARGE: 22;
    readonly WIDER: 25;
    readonly EXTRA_WIDE: 30;
    readonly DESCRIPTION: 40;
    readonly CONTENT_MEDIUM: 50;
    readonly CONTENT_LARGE: 60;
    readonly CONTENT_XLARGE: 70;
    readonly CONTENT_XXLARGE: 80;
};
/**
 * Delimiter characters used in parsing
 */
export declare const DELIMITERS: {
    readonly PIPE: "|";
    readonly COMMA: ",";
    readonly NEWLINE: "\n";
    readonly TAB: "\t";
};
/**
 * Regex patterns for text processing
 */
export declare const REGEX_PATTERNS: {
    readonly WHITESPACE: RegExp;
    readonly TRIM: RegExp;
    readonly NEWLINES: RegExp;
};
/**
 * UI timing and delays (in milliseconds)
 */
export declare const UI_TIMINGS: {
    readonly COPY_FEEDBACK_DURATION: 2000;
    readonly NOTIFICATION_TIMEOUT: 10000;
    readonly DEBOUNCE_DELAY: 300;
    readonly ANIMATION_DURATION: 300;
};
/**
 * Icon sizes used throughout UI
 */
export declare const ICON_SIZES: {
    readonly TINY: 12;
    readonly SMALL: 16;
    readonly MEDIUM: 18;
    readonly LARGE: 24;
    readonly XLARGE: 32;
    readonly XXLARGE: 48;
    readonly XXXLARGE: 64;
};
/**
 * Excel row offset for error messages (header row + 1)
 */
export declare const EXCEL_ROW_OFFSET = 2;
/**
 * Default values for questions
 */
export declare const QUESTION_DEFAULTS: {
    readonly MARKS: 1;
    readonly EMPTY_STRING: "";
};
/**
 * Pagination settings for question lists
 */
export declare const QUESTION_PAGINATION: {
    readonly INITIAL_COUNT: 10;
    readonly INCREMENT: 10;
    readonly STARTING_INDEX: 1;
};
/**
 * Standard notification messages
 */
export declare const NOTIFICATION_MESSAGES: {
    readonly TEMPLATE_DOWNLOADED: "Template downloaded successfully!";
    readonly FILE_EMPTY: "The Excel file is empty.";
    readonly INVALID_FILE_TYPE: "Please upload an Excel file";
    readonly PARSE_ERROR: "Error parsing Excel file.";
    readonly UPLOAD_SUCCESS: "Questions uploaded successfully!";
    readonly CHAPTER_REQUIRED: "Chapter is required";
};
/**
 * Submit dialog states for exam submission flow
 */
export declare const SUBMIT_STATUS: {
    readonly IDLE: "idle";
    readonly SUBMITTING: "submitting";
    readonly SUCCESS: "success";
    readonly ERROR: "error";
};
export type SubmitStatus = typeof SUBMIT_STATUS[keyof typeof SUBMIT_STATUS];
/**
 * Short month name abbreviations for date formatting
 */
export declare const MONTH_NAMES_SHORT: readonly ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/**
 * Configuration for Live Stats monitoring
 */
export declare const LIVE_STATS_CONFIG: {
    readonly AUTO_REFRESH_INTERVAL: 60000;
    readonly MAX_VIOLATIONS_DISPLAY: 5;
    readonly ROLL_NUMBER_LENGTH: 4;
};
/**
 * Time unit conversions for calculations
 */
export declare const TIME_UNITS: {
    readonly SECONDS_IN_MINUTE: 60;
    readonly SECONDS_IN_HOUR: 3600;
    readonly MINUTES_IN_HOUR: 60;
};
/**
 * Academic year options for the application
 * Format: YYYY-YY (e.g., "2025-26" represents academic year 2025-2026)
 */
export declare const ACADEMIC_YEARS: readonly ["2025-26", "2026-27", "2027-28", "2028-29", "2029-30", "2030-31", "2031-32"];
/**
 * Academic years with "All" option for filters
 */
export declare const ACADEMIC_YEARS_WITH_ALL: readonly ["all", "2025-26", "2026-27", "2027-28", "2028-29", "2029-30", "2030-31", "2031-32"];
export type AcademicYear = typeof ACADEMIC_YEARS[number];
/**
 * Student activity status during exam
 */
export declare const STUDENT_STATUS: {
    readonly ACTIVE: "active";
    readonly IDLE: "idle";
    readonly SUBMITTED: "submitted";
    readonly ABSENT: "absent";
};
export type StudentStatus = typeof STUDENT_STATUS[keyof typeof STUDENT_STATUS];
/**
 * Tailwind CSS classes for severity level styling
 */
export declare const SEVERITY_COLOR_CLASSES: {
    readonly critical: "bg-red-100 border-red-300 text-red-800";
    readonly high: "bg-orange-100 border-orange-300 text-orange-800";
    readonly medium: "bg-yellow-100 border-yellow-300 text-yellow-800";
    readonly low: "bg-blue-100 border-blue-300 text-blue-800";
};
/**
 * Badge classes for violation severity badges
 */
export declare const SEVERITY_BADGE_CLASSES: {
    readonly critical: "bg-red-200 text-red-900";
    readonly high: "bg-orange-200 text-orange-900";
    readonly medium: "bg-yellow-200 text-yellow-900";
    readonly low: "bg-blue-200 text-blue-900";
};
/**
 * Text color classes for violation severity
 */
export declare const SEVERITY_TEXT_CLASSES: {
    readonly critical: "text-red-600";
    readonly high: "text-orange-600";
    readonly medium: "text-yellow-600";
    readonly low: "text-blue-600";
};
/**
 * Color classes for student status indicators
 */
export declare const STUDENT_STATUS_COLORS: {
    readonly active: "text-green-600 bg-green-100";
    readonly idle: "text-yellow-600 bg-yellow-100";
    readonly submitted: "text-blue-600 bg-blue-100";
    readonly absent: "text-red-600 bg-red-100";
};
/**
 * Check if user type has sufficient permissions
 */
export declare function hasPermissionLevel(userType: UserType, requiredType: UserType): boolean;
/**
 * Export all constants as a single object (optional convenience export)
 */
export declare const APP_CONSTANTS: {
    readonly QUESTION_TYPES: {
        readonly MCQ: "mcq";
        readonly FITB: "fitb";
        readonly JUMBLED: "jumbled";
        readonly DESCRIPTIVE: "descriptive";
        readonly CODE: "code";
    };
    readonly QUESTION_TYPE_LABELS: {
        readonly mcq: "MCQ";
        readonly fitb: "FITB";
        readonly jumbled: "Jumbled";
        readonly descriptive: "Descriptive";
        readonly code: "Code";
    };
    readonly USER_TYPES: {
        readonly SYSTEM_ADMIN: "system_admin";
        readonly SUPER_ADMIN: "super_admin";
        readonly ADMIN: "admin";
        readonly PRINCIPAL: "principal";
        readonly DEAN: "dean";
        readonly TEACHER: "teacher";
        readonly STUDENT: "student";
    };
    readonly USER_TYPE_LABELS: {
        readonly system_admin: "System Admin";
        readonly super_admin: "Super Admin";
        readonly admin: "Admin";
        readonly principal: "Principal";
        readonly dean: "Dean";
        readonly teacher: "Teacher";
        readonly student: "Student";
    };
    readonly USER_TYPE_LEVELS: {
        readonly super_admin: 110;
        readonly system_admin: 100;
        readonly admin: 90;
        readonly principal: 80;
        readonly dean: 70;
        readonly teacher: 50;
        readonly student: 10;
    };
    readonly COMPLEXITY_LEVELS: {
        readonly EASY: "easy";
        readonly MEDIUM: "medium";
        readonly HARD: "hard";
        readonly BASIC: "easy";
        readonly INTERMEDIATE: "medium";
        readonly ADVANCED: "hard";
    };
    readonly COMPLEXITY_LABELS: {
        readonly easy: "Easy";
        readonly medium: "Medium";
        readonly hard: "Hard";
    };
    readonly COMPLEXITY_LEGACY_MAP: {
        readonly Basic: "easy";
        readonly basic: "easy";
        readonly Intermediate: "medium";
        readonly intermediate: "medium";
        readonly Advanced: "hard";
        readonly advanced: "hard";
        readonly Easy: "easy";
        readonly easy: "easy";
        readonly Medium: "medium";
        readonly medium: "medium";
        readonly Hard: "hard";
        readonly hard: "hard";
    };
    readonly USER_STATUS: {
        readonly ACTIVE: "active";
        readonly DISABLED: "disabled";
        readonly SUSPENDED: "suspended";
        readonly PENDING: "pending";
    };
    readonly ATTEMPT_STATUS: {
        readonly IN_PROGRESS: "in_progress";
        readonly SUBMITTED: "submitted";
        readonly AUTO_SUBMITTED: "auto_submitted";
        readonly EVALUATED: "evaluated";
        readonly UNDER_REVIEW: "under_review";
        readonly PENDING: "pending";
    };
    readonly EVALUATION_STATUS: {
        readonly PENDING: "pending";
        readonly IN_PROGRESS: "in_progress";
        readonly EVALUATING: "evaluating";
        readonly COMPLETED: "completed";
        readonly NOT_ATTEMPTED: "not_attempted";
        readonly FAILED: "failed";
        readonly MANUAL_REVIEW: "manual_review";
    };
    readonly EXAM_STATUS: {
        readonly DRAFT: "draft";
        readonly SCHEDULED: "scheduled";
        readonly ACTIVE: "active";
        readonly ONGOING: "ongoing";
        readonly UPCOMING: "upcoming";
        readonly COMPLETED: "completed";
        readonly CANCELLED: "cancelled";
        readonly INTERRUPTED: "interrupted";
    };
    readonly EXAM_STATUS_LABELS: {
        readonly draft: "Draft";
        readonly scheduled: "Scheduled";
        readonly active: "Active";
        readonly ongoing: "Ongoing";
        readonly upcoming: "Upcoming";
        readonly completed: "Completed";
        readonly cancelled: "Cancelled";
        readonly interrupted: "Interrupted";
    };
    readonly NOTIFICATION_STATUS: {
        readonly ACTIVE: "active";
        readonly EXPIRED: "expired";
        readonly DRAFT: "draft";
    };
    readonly PRIORITY_LEVELS: {
        readonly LOW: "low";
        readonly MEDIUM: "medium";
        readonly HIGH: "high";
        readonly CRITICAL: "critical";
        readonly URGENT: "urgent";
    };
    readonly SEVERITY_LEVELS: {
        readonly LOW: "low";
        readonly MEDIUM: "medium";
        readonly HIGH: "high";
        readonly CRITICAL: "critical";
    };
    readonly EXAM_MODES: {
        readonly ONLINE: "online";
        readonly OFFLINE: "offline";
        readonly HYBRID: "hybrid";
    };
    readonly EXAM_MODE_LABELS: {
        readonly online: "Online";
        readonly offline: "Offline";
        readonly hybrid: "Hybrid";
    };
    readonly CONNECTION_TYPES: {
        readonly WIFI: "wifi";
        readonly CELLULAR: "cellular";
        readonly ETHERNET: "ethernet";
        readonly UNKNOWN: "unknown";
    };
    readonly VIOLATION_TYPES: {
        readonly WINDOW_BLUR: "WINDOW_BLUR";
        readonly TAB_SWITCH: "TAB_SWITCH";
        readonly WINDOW_MINIMIZE: "WINDOW_MINIMIZE";
        readonly FULLSCREEN_EXIT: "FULLSCREEN_EXIT";
        readonly COPY_ATTEMPT: "COPY_ATTEMPT";
        readonly PASTE_ATTEMPT: "PASTE_ATTEMPT";
        readonly CUT_ATTEMPT: "CUT_ATTEMPT";
        readonly RIGHT_CLICK: "RIGHT_CLICK";
        readonly PRINT_SCREEN: "PRINT_SCREEN";
        readonly SCREENSHOT_ATTEMPT: "SCREENSHOT_ATTEMPT";
        readonly DEVTOOLS_OPEN: "DEVTOOLS_OPEN";
        readonly CONSOLE_OPEN: "CONSOLE_OPEN";
        readonly MULTIPLE_TABS: "MULTIPLE_TABS";
        readonly NETWORK_DISCONNECT: "NETWORK_DISCONNECT";
        readonly TIME_MANIPULATION: "TIME_MANIPULATION";
        readonly SHORTCUT_CTRLC: "SHORTCUT_CTRLC";
        readonly SHORTCUT_CTRLV: "SHORTCUT_CTRLV";
        readonly SHORTCUT_CTRLX: "SHORTCUT_CTRLX";
        readonly SHORTCUT_CTRLA: "SHORTCUT_CTRLA";
        readonly SHORTCUT_ALTTAB: "SHORTCUT_ALTTAB";
        readonly SHORTCUT_CMDTAB: "SHORTCUT_CMDTAB";
        readonly SHORTCUT_CTRLSHIFTC: "SHORTCUT_CTRLSHIFTC";
        readonly SHORTCUT_F12: "SHORTCUT_F12";
        readonly SHORTCUT_CTRLP: "SHORTCUT_CTRLP";
        readonly SHORTCUT_CTRLS: "SHORTCUT_CTRLS";
        readonly SHORTCUT_DEVTOOLS: "SHORTCUT_DEVTOOLS";
        readonly MULTIPLE_FACES: "MULTIPLE_FACES";
        readonly NO_FACE: "NO_FACE";
        readonly FACE_MISMATCH: "FACE_MISMATCH";
        readonly HEAD_TURNED: "HEAD_TURNED";
        readonly LOUD_NOISE: "LOUD_NOISE";
        readonly HUMAN_VOICE_DETECTED: "HUMAN_VOICE_DETECTED";
        readonly SUSPICIOUS_MOVEMENT: "SUSPICIOUS_MOVEMENT";
        readonly PROHIBITED_OBJECT: "PROHIBITED_OBJECT";
        readonly VIRTUAL_MACHINE: "VIRTUAL_MACHINE";
        readonly DOM_TAMPERING: "DOM_TAMPERING";
        readonly DEVICE_CHANGE: "DEVICE_CHANGE";
    };
    readonly VIOLATION_SEVERITY_MAP: Record<ViolationType, SeverityLevel>;
    readonly VIOLATION_DESCRIPTIONS: Record<ViolationType, string>;
    readonly COLLECTIONS: {
        readonly USERS: "users";
        readonly COLLEGES: "colleges";
        readonly QUESTION_BANK: "questionBank";
        readonly EXAMS: "exams";
        readonly EXAM_ATTEMPTS: "examAttempts";
        readonly STUDENT_RESPONSES: "studentResponses";
        readonly NOTIFICATIONS: "notifications";
        readonly ACTIVITIES: "activities";
        readonly VIOLATIONS: "violations";
        readonly INTERNET_STATUS: "internetStatus";
        readonly CHAT_MESSAGES: "chatMessages";
        readonly SYSTEM_LOGS: "systemLogs";
        readonly ATTENDANCE: "Attendance";
        readonly ROOMS: "rooms";
        readonly ROOM_BOOKINGS: "roomBookings";
        readonly SETTINGS: "settings";
        readonly PASSWORD_RESET_OTPS: "passwordResetOTPs";
        readonly PASSWORD_RESET_REQUESTS: "passwordResetRequests";
        readonly CODING_LANGUAGES: "CodingLanguages";
    };
    readonly SPECIAL_IDS: {
        readonly TUTORIALS_POINT: "tutorialspoint";
        readonly SYSTEM: "system";
        readonly COMMON: "common";
    };
    readonly DEFAULT_COLLEGE_ID: "tutorialspoint";
    readonly PERMISSION_LEVELS: {
        readonly SYSTEM: "system";
        readonly COLLEGE: "college";
        readonly DEPARTMENT: "department";
        readonly CLASS: "class";
        readonly PERSONAL: "personal";
    };
    readonly AI_MODELS: {
        readonly GPT_4: "gpt-4";
        readonly GPT_4_TURBO: "gpt-4-turbo";
        readonly GPT_4O: "gpt-4o";
        readonly GPT_4O_MINI: "gpt-4o-mini";
        readonly GPT_3_5_TURBO: "gpt-3.5-turbo";
        readonly CLAUDE_3_OPUS: "claude-3-opus";
        readonly CLAUDE_3_SONNET: "claude-3-sonnet";
    };
    readonly CODE_EXECUTION_STATUS: {
        readonly SUCCESS: "success";
        readonly ERROR: "error";
        readonly TIMEOUT: "timeout";
        readonly COMPILATION_ERROR: "compilation_error";
        readonly RUNTIME_ERROR: "runtime_error";
    };
    readonly PROGRAMMING_LANGUAGES: {
        readonly PYTHON: "python";
        readonly JAVA: "java";
        readonly JAVASCRIPT: "javascript";
        readonly CPP: "cpp";
        readonly C: "c";
        readonly CSHARP: "csharp";
        readonly GO: "go";
        readonly RUST: "rust";
    };
    readonly PROGRAMMING_LANGUAGE_LABELS: {
        readonly python: "Python";
        readonly java: "Java";
        readonly javascript: "Javascript";
        readonly cpp: "C++";
        readonly c: "C";
        readonly csharp: "C#";
        readonly go: "Go";
        readonly rust: "Rust";
    };
    readonly PAGINATION: {
        readonly DEFAULT_PAGE_SIZE: 25;
        readonly MAX_PAGE_SIZE: 100;
        readonly QUESTIONS_PER_PAGE: 50;
        readonly STUDENTS_PER_PAGE: 25;
        readonly EXAMS_PER_PAGE: 20;
    };
    readonly TIME_CONSTANTS: {
        readonly ONE_SECOND: 1000;
        readonly ONE_MINUTE: number;
        readonly ONE_HOUR: number;
        readonly ONE_DAY: number;
        readonly ONE_WEEK: number;
    };
    readonly TARGET_AUDIENCES: {
        readonly ALL: "all";
        readonly STUDENTS: "students";
        readonly FACULTY: "faculty";
        readonly TEACHERS: "teachers";
        readonly PARENTS: "parents";
        readonly STAFF: "staff";
    };
    readonly DEVICE_TYPES: {
        readonly DESKTOP: "desktop";
        readonly MOBILE: "mobile";
        readonly TABLET: "tablet";
        readonly UNKNOWN: "unknown";
    };
    readonly FILTER_VALUES: {
        readonly ALL: "all";
        readonly NONE: "none";
    };
    readonly NOTICE_FILTER: {
        readonly ALL: "all";
        readonly UNREAD: "unread";
    };
    readonly ACTIVE_ITEMS: {
        readonly EXAMS: "exams";
        readonly RESULTS: "results";
        readonly QUESTIONS: "questions";
        readonly USERS: "users";
        readonly ROOMS: "rooms";
        readonly REPORTS: "reports";
        readonly AUDIT: "audit";
        readonly HALLTICKETS: "halltickets";
        readonly CALENDAR: "calendar";
        readonly LEADERBOARD: "leaderboard";
    };
    readonly SECTION_CATEGORIES: {
        readonly MANAGEMENT: "management";
        readonly ACADEMIC: "academic";
        readonly ANALYTICS: "analytics";
        readonly MEMBERS: "members";
        readonly ACTIVITY: "activity";
        readonly RESOURCES: "resources";
    };
    readonly SEARCH_RESULT_TYPES: {
        readonly USER: "user";
        readonly EXAM: "exam";
        readonly QUESTION: "question";
    };
    readonly PROPRIETARY_FILTER: {
        readonly ALL: "all";
        readonly PROPRIETARY: "proprietary";
        readonly COMMON: "common";
    };
    readonly PROPRIETARY_FILTER_LABELS: {
        readonly all: "All Questions";
        readonly proprietary: "Private";
        readonly common: "Public";
    };
    readonly VALIDATION: {
        readonly MIN_PASSWORD_LENGTH: 8;
        readonly MAX_PASSWORD_LENGTH: 128;
        readonly MIN_QUESTION_LENGTH: 10;
        readonly MAX_QUESTION_LENGTH: 5000;
        readonly MIN_ANSWER_LENGTH: 1;
        readonly MAX_ANSWER_LENGTH: 10000;
        readonly MAX_FILE_SIZE: number;
        readonly MAX_IMAGE_SIZE: number;
        readonly MAX_LOGIN_ATTEMPTS: 5;
        readonly MIN_EXAM_DURATION: 5;
        readonly MAX_EXAM_DURATION: 300;
    };
    readonly SCORE_THRESHOLDS: {
        readonly PASSING_PERCENTAGE: 40;
        readonly GOOD_PERCENTAGE: 60;
        readonly EXCELLENT_PERCENTAGE: 80;
        readonly HIGH_PLAGIARISM: 70;
        readonly MEDIUM_PLAGIARISM: 40;
        readonly LOW_CONFIDENCE: 50;
        readonly HIGH_CONFIDENCE: 80;
    };
    readonly FIRESTORE_PATHS: {
        readonly EMAIL_CREDENTIALS: "settings/email_credentials";
        readonly SYSTEM_SETTINGS: "settings/system";
        readonly APP_CONFIG: "settings/app_config";
    };
    readonly SYSTEM_TRIGGERS: {
        readonly SYSTEM: "system";
        readonly MANUAL: "manual-trigger";
        readonly SCHEDULED: "scheduled";
        readonly WEBHOOK: "webhook";
    };
    readonly CLOUD_FUNCTION_CONFIG: {
        readonly REGION: "us-central1";
        readonly BATCH_SIZE: 500;
        readonly TIMEZONE: "Asia/Kolkata";
        readonly AUTO_COMPLETE_SCHEDULE: "every 1 hours";
    };
    readonly NOTIFICATION_TYPES: {
        readonly ANNOUNCEMENT: "announcement";
        readonly REMINDER: "reminder";
        readonly ALERT: "alert";
        readonly INFO: "info";
    };
    readonly NOTIFICATION_CATEGORIES: {
        readonly ACADEMIC: "academic";
        readonly ADMINISTRATIVE: "administrative";
        readonly EVENT: "event";
        readonly GENERAL: "general";
    };
    readonly ACTIVITY_TYPES: {
        readonly ENTER: "enter";
        readonly EXIT: "exit";
    };
    readonly ATTENDANCE_STATUS: {
        readonly PRESENT: "present";
        readonly ABSENT: "absent";
    };
    readonly CONNECTION_STATUS: {
        readonly DISCONNECTED: "disconnected";
        readonly RECONNECTED: "reconnected";
        readonly CONNECTED: "connected";
    };
    readonly SECURITY_LEVELS: {
        readonly SECURE: "secure";
        readonly NORMAL: "normal";
    };
    readonly UPLOAD_STEPS: {
        readonly SELECT: "select";
        readonly PREVIEW: "preview";
        readonly UPLOADING: "uploading";
        readonly COMPLETE: "complete";
    };
    readonly NOTIFICATION_TYPES_UI: {
        readonly ERROR: "error";
        readonly WARNING: "warning";
        readonly INFO: "info";
        readonly SUCCESS: "success";
    };
    readonly EXCEL_FILE_EXTENSIONS: {
        readonly XLSX: ".xlsx";
        readonly XLS: ".xls";
    };
    readonly EXCEL_SHEET_NAMES: {
        readonly QUESTIONS: "Questions";
        readonly REFERENCE: "Reference";
        readonly INSTRUCTIONS: "Instructions";
        readonly ROOMS: "Rooms";
    };
    readonly TEMPLATE_FILENAME: "questions_template.xlsx";
    readonly REQUIRED_QUESTION_COLUMNS: readonly ["class", "subject", "chapter", "question_text", "type", "maximum_marks", "difficulty_level"];
    readonly EXCEL_COLUMN_WIDTHS: {
        readonly NARROW: 10;
        readonly SMALL: 12;
        readonly MEDIUM: 15;
        readonly STANDARD: 18;
        readonly LARGE: 20;
        readonly XLARGE: 22;
        readonly WIDER: 25;
        readonly EXTRA_WIDE: 30;
        readonly DESCRIPTION: 40;
        readonly CONTENT_MEDIUM: 50;
        readonly CONTENT_LARGE: 60;
        readonly CONTENT_XLARGE: 70;
        readonly CONTENT_XXLARGE: 80;
    };
    readonly DELIMITERS: {
        readonly PIPE: "|";
        readonly COMMA: ",";
        readonly NEWLINE: "\n";
        readonly TAB: "\t";
    };
    readonly REGEX_PATTERNS: {
        readonly WHITESPACE: RegExp;
        readonly TRIM: RegExp;
        readonly NEWLINES: RegExp;
    };
    readonly UI_TIMINGS: {
        readonly COPY_FEEDBACK_DURATION: 2000;
        readonly NOTIFICATION_TIMEOUT: 10000;
        readonly DEBOUNCE_DELAY: 300;
        readonly ANIMATION_DURATION: 300;
    };
    readonly ICON_SIZES: {
        readonly TINY: 12;
        readonly SMALL: 16;
        readonly MEDIUM: 18;
        readonly LARGE: 24;
        readonly XLARGE: 32;
        readonly XXLARGE: 48;
        readonly XXXLARGE: 64;
    };
    readonly EXCEL_ROW_OFFSET: 2;
    readonly QUESTION_DEFAULTS: {
        readonly MARKS: 1;
        readonly EMPTY_STRING: "";
    };
    readonly QUESTION_PAGINATION: {
        readonly INITIAL_COUNT: 10;
        readonly INCREMENT: 10;
        readonly STARTING_INDEX: 1;
    };
    readonly NOTIFICATION_MESSAGES: {
        readonly TEMPLATE_DOWNLOADED: "Template downloaded successfully!";
        readonly FILE_EMPTY: "The Excel file is empty.";
        readonly INVALID_FILE_TYPE: "Please upload an Excel file";
        readonly PARSE_ERROR: "Error parsing Excel file.";
        readonly UPLOAD_SUCCESS: "Questions uploaded successfully!";
        readonly CHAPTER_REQUIRED: "Chapter is required";
    };
    readonly SUBMIT_STATUS: {
        readonly IDLE: "idle";
        readonly SUBMITTING: "submitting";
        readonly SUCCESS: "success";
        readonly ERROR: "error";
    };
    readonly MONTH_NAMES_SHORT: readonly ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    readonly LIVE_STATS_CONFIG: {
        readonly AUTO_REFRESH_INTERVAL: 60000;
        readonly MAX_VIOLATIONS_DISPLAY: 5;
        readonly ROLL_NUMBER_LENGTH: 4;
    };
    readonly TIME_UNITS: {
        readonly SECONDS_IN_MINUTE: 60;
        readonly SECONDS_IN_HOUR: 3600;
        readonly MINUTES_IN_HOUR: 60;
    };
    readonly ACADEMIC_YEARS: readonly ["2025-26", "2026-27", "2027-28", "2028-29", "2029-30", "2030-31", "2031-32"];
    readonly ACADEMIC_YEARS_WITH_ALL: readonly ["all", "2025-26", "2026-27", "2027-28", "2028-29", "2029-30", "2030-31", "2031-32"];
    readonly STUDENT_STATUS: {
        readonly ACTIVE: "active";
        readonly IDLE: "idle";
        readonly SUBMITTED: "submitted";
        readonly ABSENT: "absent";
    };
    readonly SEVERITY_COLOR_CLASSES: {
        readonly critical: "bg-red-100 border-red-300 text-red-800";
        readonly high: "bg-orange-100 border-orange-300 text-orange-800";
        readonly medium: "bg-yellow-100 border-yellow-300 text-yellow-800";
        readonly low: "bg-blue-100 border-blue-300 text-blue-800";
    };
    readonly SEVERITY_BADGE_CLASSES: {
        readonly critical: "bg-red-200 text-red-900";
        readonly high: "bg-orange-200 text-orange-900";
        readonly medium: "bg-yellow-200 text-yellow-900";
        readonly low: "bg-blue-200 text-blue-900";
    };
    readonly SEVERITY_TEXT_CLASSES: {
        readonly critical: "text-red-600";
        readonly high: "text-orange-600";
        readonly medium: "text-yellow-600";
        readonly low: "text-blue-600";
    };
    readonly STUDENT_STATUS_COLORS: {
        readonly active: "text-green-600 bg-green-100";
        readonly idle: "text-yellow-600 bg-yellow-100";
        readonly submitted: "text-blue-600 bg-blue-100";
        readonly absent: "text-red-600 bg-red-100";
    };
};
/**
 * Room status types
 */
export declare const ROOM_STATUS: {
    readonly AVAILABLE: "available";
    readonly BUSY: "busy";
};
export type RoomStatus = typeof ROOM_STATUS[keyof typeof ROOM_STATUS];
/**
 * UI labels for room status
 */
export declare const ROOM_STATUS_LABELS: {
    readonly available: "Available";
    readonly busy: "Busy";
};
/**
 * Event types for room scheduling
 */
export declare const ROOM_EVENT_TYPES: {
    readonly EXAM: "exams";
    readonly FUNCTION: "function";
    readonly MEETING: "meeting";
    readonly SHOW: "show";
};
export type RoomEventType = typeof ROOM_EVENT_TYPES[keyof typeof ROOM_EVENT_TYPES];
/**
 * UI labels for room event types
 */
export declare const ROOM_EVENT_TYPE_LABELS: {
    readonly exams: "Exam";
    readonly function: "Function";
    readonly meeting: "Meeting";
    readonly show: "Show";
};
/**
 * Template filename for room upload
 */
export declare const ROOM_TEMPLATE_FILENAME = "rooms_template.xlsx";
/**
 * Required columns for room upload
 */
export declare const REQUIRED_ROOM_COLUMNS: readonly ["room_name", "room_address", "room_capacity", "sitting_matrix", "room_status"];
/**
 * Room types
 */
export declare const ROOM_TYPES: {
    readonly CLASSROOM: "classroom";
    readonly ADMIN_ROOM: "admin_room";
    readonly LIBRARY: "library";
    readonly LAB: "lab";
    readonly COMPUTER_LAB: "computer_lab";
    readonly SCIENCE_LAB: "science_lab";
    readonly HALL: "hall";
    readonly AUDITORIUM: "auditorium";
    readonly LOUNGE: "lounge";
    readonly CONFERENCE_ROOM: "conference_room";
    readonly FACULTY_ROOM: "faculty_room";
    readonly CAFETERIA: "cafeteria";
    readonly SPORTS_ROOM: "sports_room";
    readonly MUSIC_ROOM: "music_room";
    readonly ART_ROOM: "art_room";
    readonly SEMINAR_HALL: "seminar_hall";
    readonly WORKSHOP: "workshop";
    readonly STORAGE: "storage";
    readonly SERVER_ROOM: "server_room";
    readonly MEDICAL_ROOM: "medical_room";
};
export type RoomType = typeof ROOM_TYPES[keyof typeof ROOM_TYPES];
/**
 * UI labels for room types
 */
export declare const ROOM_TYPE_LABELS: {
    readonly classroom: "Class Room";
    readonly admin_room: "Admin Room";
    readonly library: "Library";
    readonly lab: "Lab";
    readonly computer_lab: "Computer Lab";
    readonly science_lab: "Science Lab";
    readonly hall: "Hall";
    readonly auditorium: "Auditorium";
    readonly lounge: "Lounge";
    readonly conference_room: "Conference Room";
    readonly faculty_room: "Faculty Room";
    readonly cafeteria: "Cafeteria";
    readonly sports_room: "Sports Room";
    readonly music_room: "Music Room";
    readonly art_room: "Art Room";
    readonly seminar_hall: "Seminar Hall";
    readonly workshop: "Workshop";
    readonly storage: "Storage";
    readonly server_room: "Server Room";
    readonly medical_room: "Medical Room";
};
/**
 * Room pagination settings
 */
export declare const ROOM_PAGINATION: {
    readonly INITIAL_COUNT: 10;
    readonly INCREMENT: 10;
    readonly STARTING_INDEX: 1;
};
export interface ColorTheme {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    lightAccent: string;
}
export declare const COLOR_PALETTES: Record<string, ColorTheme>;
export declare const DEFAULT_COLOR = "blue";
export declare const getColorTheme: (colorKey: string) => ColorTheme;
export default APP_CONSTANTS;
//# sourceMappingURL=constants.d.ts.map