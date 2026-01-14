// ============================================
// UNIFIED USER TYPES & INTERFACES
// Central type definitions for user data across the entire application
// Use these interfaces everywhere: Forms, Firebase, Exams, Reports, etc.
// ============================================

import { Timestamp } from 'firebase/firestore';

// Import existing constants instead of duplicating
import {
  USER_TYPES,
  USER_STATUS,
  USER_TYPE_LABELS,
  USER_TYPE_LEVELS,
  type UserType,
  type UserStatus
} from '../constants';

// ============================================
// USER TYPE ICONS (Add to constants.ts)
// ============================================

/**
 * User role icons for display
 * TODO: Move this to constants.ts as USER_TYPE_ICONS
 */
export const USER_TYPE_ICONS: Record<UserType, string> = {
  [USER_TYPES.SYSTEM_ADMIN]: '👨‍💼',
  [USER_TYPES.SUPER_ADMIN]: '⚡',
  [USER_TYPES.ADMIN]: '⚙️',
  [USER_TYPES.PRINCIPAL]: '🏆',
  [USER_TYPES.DEAN]: '👔',
  [USER_TYPES.TEACHER]: '👨‍🏫',
  [USER_TYPES.STUDENT]: '🎓'
};

// ============================================
// CORE USER INTERFACES
// ============================================

/**
 * Base user fields common to all user types
 * This is the foundation - every user has these fields
 */
export interface BaseUser {
  // Identity
  userId: string;
  fullName: string;
  title?: string;
  email: string;
  
  // Contact
  phone: string;
  phoneRaw: string; // Without country code, e.g., "9876543210"
  
  // Role & Organization
  userType: UserType;
  collegeId: string;
  board?: string;
  
  // Status
  status: UserStatus;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  
  // Security
  permissions: Permission[];
  mustChangePassword: boolean;
  firstLogin: boolean;
  passwordChangedAt: Timestamp | Date | null;
  temporaryPassword: boolean;
  accountLocked: boolean;
  failedLoginAttempts: number;
  lastLoginAt: Timestamp | Date | null;
}

/**
 * Student-specific fields
 */
export interface StudentFields {
  studentRoll: string;
  academicYear: string;
  studentClass: string;
  parentPhone?: string;
  studentHistory: StudentHistoryEntry[];
}

/**
 * Teacher/Principal/Dean-specific fields
 */
export interface TeacherFields {
  teacherClasses: string[]; // Always array: ["10th", "11th", "12th"]
  teacherSubjects: string[]; // Always array: ["Mathematics", "Physics"]
}

/**
 * Student history entry (for tracking class progression)
 */
export interface StudentHistoryEntry {
  academicYear: string;
  className: string; // Standardized field name
  rollNumber: string;
  board: string;
  collegeId: string;
  promotedOn?: Timestamp | Date;
}

/**
 * Permission structure
 */
export interface Permission {
  module: string;
  actions: string[];
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
// ============================================
// UNIFIED USER TYPE (Main Interface)
// ============================================

/**
 * Complete user object - use this everywhere!
 * Includes all possible fields (base + student + teacher)
 * Fields are optional based on user type
 */
export interface User extends BaseUser {
  // Student-specific (only for students)
  studentRoll?: string;
  academicYear?: string;
  studentClass?: string;
  parentPhone?: string;
  studentHistory?: StudentHistoryEntry[];
  
  // Teacher-specific (for teachers, principals, deans)
  teacherClasses?: string[];
  teacherSubjects?: string[];
}

// ============================================
// TYPE-SPECIFIC USER TYPES
// ============================================

/**
 * Student User (with required student fields)
 */
export type StudentUser = BaseUser & Required<StudentFields>;

/**
 * Teacher User (with required teacher fields)
 */
export type TeacherUser = BaseUser & Required<TeacherFields>;

/**
 * Principal User (with required teacher fields)
 */
export type PrincipalUser = BaseUser & Required<TeacherFields>;

/**
 * Dean User (with required teacher fields)
 */
export type DeanUser = BaseUser & Required<TeacherFields>;

/**
 * Admin User (base fields only)
 */
export type AdminUser = BaseUser;

/**
 * System Admin User (base fields only)
 */
export type SystemAdminUser = BaseUser;

// ============================================
// USER CREATION INTERFACES
// ============================================

/**
 * Input data for creating a new user
 * Used by both manual and bulk creation
 */
export interface CreateUserInput {
  // Required fields
  fullName: string;
  phone: string;
  userType: UserType;
  collegeId: string;
  createdBy: string;
  
  // Optional base fields
  title?: string;
  email?: string;
  board?: string;
  
  // Student-specific (required if userType is student)
  studentRoll?: string;
  academicYear?: string;
  studentClass?: string;
  parentPhone?: string;
  
  // Teacher-specific (required if userType is teacher/principal/dean)
  teacherClasses?: string[];
  teacherSubjects?: string[];
  
  // Creation options
  shouldCreateAuthAccount?: boolean;
  shouldSendWelcomeEmail?: boolean;
}

/**
 * Result after creating a user
 */
export interface CreateUserResult {
  userId: string;
  temporaryPassword?: string;
  authAccountCreated: boolean;
  emailSent: boolean;
}

/**
 * Input data for updating a user
 */
export interface UpdateUserInput {
  userId: string;
  fullName?: string;
  title?: string;
  email?: string;
  phone?: string;
  userType?: UserType;
  board?: string;
  status?: UserStatus;
  
  // Student fields
  studentRoll?: string;
  academicYear?: string;
  studentClass?: string;
  parentPhone?: string;
  
  // Teacher fields
  teacherClasses?: string[];
  teacherSubjects?: string[];
}

// ============================================
// USER QUERY/FILTER INTERFACES
// ============================================

/**
 * Filter options for querying users
 */
export interface UserQueryFilter {
  collegeId?: string;
  userType?: UserType | UserType[];
  status?: UserStatus | UserStatus[];
  board?: string | string[];
  studentClass?: string | string[];
  academicYear?: string;
  teacherSubjects?: string[];
  searchText?: string; // For name/email/phone search
}

/**
 * Sorting options for user queries
 */
export interface UserQuerySort {
  field: 'fullName' | 'createdAt' | 'studentRoll' | 'userType';
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface UserQueryPagination {
  limit: number;
  offset?: number;
  lastDoc?: any; // For cursor-based pagination
}

/**
 * Complete query options
 */
export interface UserQueryOptions {
  filter?: UserQueryFilter;
  sort?: UserQuerySort;
  pagination?: UserQueryPagination;
}

// ============================================
// USER DISPLAY/UI INTERFACES
// ============================================

/**
 * Simplified user info for display in lists/dropdowns
 */
export interface UserListItem {
  userId: string;
  fullName: string;
  email?: string;
  phone: string;
  userType: UserType;
  status: UserStatus;
  studentRoll?: string; // For students
  studentClass?: string; // For students
}

/**
 * User profile for display
 */
export interface UserProfile extends User {
  // Additional computed fields for UI
  displayName: string; // Formatted name with title
  roleLabel: string; // User-friendly role name
  roleIcon: string; // Emoji for role
  isActive: boolean; // status === 'active'
  canLogin: boolean; // Has auth account
  needsPasswordChange: boolean; // mustChangePassword
}

/**
 * User statistics (for dashboards)
 */
export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  byRole: Record<UserType, number>;
  byBoard: Record<string, number>;
  byClass: Record<string, number>;
  recentLogins: number; // Last 7 days
  pendingPasswordChanges: number;
}

// ============================================
// EXAM-RELATED USER INTERFACES
// ============================================

/**
 * User info needed for exam assignment
 */
export interface ExamAssignableUser {
  userId: string;
  fullName: string;
  email?: string;
  userType: UserType;
  collegeId: string;
  board?: string;
  studentClass?: string; // For students
  studentRoll?: string; // For students
  teacherSubjects?: string[]; // For teachers
}

/**
 * User info in exam context
 */
export interface ExamParticipant extends ExamAssignableUser {
  examId: string;
  assignedAt: Timestamp | Date;
  assignedBy: string;
  hasAttempted: boolean;
  attemptId?: string;
  score?: number;
  percentage?: number;
}

/**
 * Student with exam performance data
 */
export interface StudentWithExamData extends StudentUser {
  totalExams: number;
  completedExams: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  rank?: number;
  lastExamDate?: Timestamp | Date;
}

// ============================================
// BULK UPLOAD INTERFACES
// ============================================

/**
 * User data from Excel import
 */
export interface BulkUserImportRow {
  // Excel column names (snake_case to match template)
  full_name: string;
  title?: string;
  email?: string;
  phone: string;
  user_type: string;
  college_id?: string;
  student_roll?: string;
  academic_year?: string;
  student_class?: string;
  teacher_classes?: string; // Comma-separated
  teacher_subjects?: string; // Comma-separated
  board?: string;
  parent_phone?: string;
  created_by?: string;
}

/**
 * Result of bulk import operation
 */
export interface BulkImportResult {
  success: number;
  skipped: number;
  failed: number;
  errors: BulkImportError[];
  createdUsers: string[]; // User IDs
}

/**
 * Error during bulk import
 */
export interface BulkImportError {
  row: number;
  data: BulkUserImportRow;
  error: string;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if user is a student
 */
export function isStudent(user: User): user is StudentUser {
  return user.userType === USER_TYPES.STUDENT && 
         !!user.studentRoll && 
         !!user.studentClass;
}

/**
 * Check if user is a teacher
 */
export function isTeacher(user: User): user is TeacherUser {
  return user.userType === USER_TYPES.TEACHER && 
         !!user.teacherClasses && 
         !!user.teacherSubjects;
}

/**
 * Check if user is a principal
 */
export function isPrincipal(user: User): user is PrincipalUser {
  return user.userType === USER_TYPES.PRINCIPAL;
}

/**
 * Check if user is a dean
 */
export function isDean(user: User): user is DeanUser {
  return user.userType === USER_TYPES.DEAN;
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: User): user is AdminUser {
  return user.userType === USER_TYPES.ADMIN || 
         user.userType === USER_TYPES.SUPER_ADMIN || 
         user.userType === USER_TYPES.SYSTEM_ADMIN;
}

/**
 * Check if user can teach (teacher, principal, or dean)
 */
export function canTeach(user: User): boolean {
  return user.userType === USER_TYPES.TEACHER || 
         user.userType === USER_TYPES.PRINCIPAL || 
         user.userType === USER_TYPES.DEAN;
}

/**
 * Check if user has admin privileges
 */
export function hasAdminPrivileges(user: User): boolean {
  return user.userType === USER_TYPES.SYSTEM_ADMIN || 
         user.userType === USER_TYPES.SUPER_ADMIN || 
         user.userType === USER_TYPES.ADMIN || 
         user.userType === USER_TYPES.PRINCIPAL || 
         user.userType === USER_TYPES.DEAN;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert User to UserProfile (with computed fields)
 */
export function toUserProfile(user: User): UserProfile {
  return {
    ...user,
    displayName: user.title ? `${user.title} ${user.fullName}` : user.fullName,
    roleLabel: USER_TYPE_LABELS[user.userType],
    roleIcon: USER_TYPE_ICONS[user.userType],
    isActive: user.status === USER_STATUS.ACTIVE,
    canLogin: !!user.email && !user.accountLocked,
    needsPasswordChange: user.mustChangePassword
  };
}

/**
 * Convert User to UserListItem (for dropdowns/lists)
 */
export function toUserListItem(user: User): UserListItem {
  return {
    userId: user.userId,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    userType: user.userType,
    status: user.status,
    studentRoll: user.studentRoll,
    studentClass: user.studentClass
  };
}

/**
 * Convert User to ExamAssignableUser
 */
export function toExamAssignableUser(user: User): ExamAssignableUser {
  return {
    userId: user.userId,
    fullName: user.fullName,
    email: user.email,
    userType: user.userType,
    collegeId: user.collegeId,
    board: user.board,
    studentClass: user.studentClass,
    studentRoll: user.studentRoll,
    teacherSubjects: user.teacherSubjects
  };
}

/**
 * Format user name for display
 */
export function formatUserName(user: User | UserListItem, includeRole: boolean = false): string {
  let name = user.fullName;
  
  if ('title' in user && user.title) {
    name = `${user.title} ${name}`;
  }
  
  if (includeRole) {
    name += ` (${USER_TYPE_LABELS[user.userType]})`;
  }
  
  return name;
}

/**
 * Get user's primary identifier (roll number for students, email for others)
 */
export function getUserIdentifier(user: User): string {
  if (isStudent(user) && user.studentRoll) {
    return user.studentRoll;
  }
  return user.email || user.phone;
}

/**
 * Validate user data completeness
 */
export function validateUserData(user: Partial<User>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required base fields
  if (!user.fullName) errors.push('Full name is required');
  if (!user.phone) errors.push('Phone number is required');
  if (!user.userType) errors.push('User type is required');
  if (!user.collegeId && user.userType !== USER_TYPES.SYSTEM_ADMIN) {
    errors.push('College ID is required');
  }
  
  // Student-specific validation
  if (user.userType === USER_TYPES.STUDENT) {
    if (!user.studentRoll) errors.push('Student roll number is required');
    if (!user.studentClass) errors.push('Student class is required');
    if (!user.academicYear) errors.push('Academic year is required');
  }
  
  // Teacher-specific validation
  if (canTeach(user as User)) {
    if (!user.teacherClasses || user.teacherClasses.length === 0) {
      errors.push('Teacher classes are required');
    }
    if (!user.teacherSubjects || user.teacherSubjects.length === 0) {
      errors.push('Teacher subjects are required');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize user data for storage (remove undefined/null, normalize)
 */
export function sanitizeUserData(data: Partial<User>): Partial<User> {
  const sanitized: any = {};
  
  // Copy defined values only
  Object.keys(data).forEach(key => {
    const value = (data as any)[key];
    if (value !== undefined && value !== null) {
      sanitized[key] = value;
    }
  });
  
  // Normalize phone if present
  if (sanitized.phone) {
    sanitized.phone = normalizePhoneNumber(sanitized.phone);
    sanitized.phoneRaw = sanitized.phone.replace('+91', '');
  }
  
  // Normalize email if present
  if (sanitized.email) {
    sanitized.email = sanitized.email.toLowerCase().trim();
  }
  
  return sanitized;
}

/**
 * Normalize phone number to +91XXXXXXXXXX format
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}

/**
 * Check if two users are the same
 */
export function isSameUser(user1: User | string, user2: User | string): boolean {
  const id1 = typeof user1 === 'string' ? user1 : user1.userId;
  const id2 = typeof user2 === 'string' ? user2 : user2.userId;
  return id1 === id2;
}

/**
 * Check if user has sufficient permission level
 * Uses the USER_TYPE_LEVELS from constants.ts
 */
export function hasPermissionLevel(
  userType: UserType,
  requiredType: UserType
): boolean {
  return USER_TYPE_LEVELS[userType] >= USER_TYPE_LEVELS[requiredType];
}

// ============================================
// CONSTANTS FOR VALIDATION
// ============================================

export const USER_VALIDATION_RULES = {
  FULL_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z\s.'-]+$/
  },
  PHONE: {
    LENGTH: 10, // Without country code
    PATTERN: /^[6-9]\d{9}$/ // Indian mobile numbers
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  STUDENT_ROLL: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 20,
    PATTERN: /^[A-Z0-9-]+$/i
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    PATTERN: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/
  }
};

// ============================================
// RE-EXPORT CONSTANTS FROM constants.ts
// ============================================

// Re-export so users can import everything from one place
export {
  USER_TYPES,
  USER_STATUS,
  USER_TYPE_LABELS,
  USER_TYPE_LEVELS,
  type UserType,
  type UserStatus
};

// ============================================
// EXPORT ALL
// ============================================