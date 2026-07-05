import * as functions from 'firebase-functions';
export { processReportInstance } from './reports';
export declare const generateLearningPathAI: functions.HttpsFunction & functions.Runnable<any>;
export declare const generateLogicAnalysis: functions.HttpsFunction & functions.Runnable<any>;
export declare const chatWithLearningAI: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 📝 Submit Exercise for Evaluation (Pub/Sub Publisher)
 * Saves submission to Firestore and queues for AI evaluation
 * Returns immediately - evaluation happens in background
 */
export declare const submitExerciseForEvaluation: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 🤖 Exercise Evaluation Worker (Pub/Sub Subscriber)
 * Triggered automatically for each exercise submission
 * Multiple instances run in PARALLEL for scalability
 *
 * NOTE: Pub/Sub has built-in retry on failure - no need for scheduled retry!
 */
export declare const exerciseEvaluationWorker: functions.CloudFunction<functions.pubsub.Message>;
/**
 * 📝 Resume Content Enhancement with AI
 * Enhances resume summaries, job descriptions, and skills using GPT
 */
export declare const enhanceResumeContent: functions.HttpsFunction & functions.Runnable<any>;
export declare const getExamMetadata: functions.HttpsFunction & functions.Runnable<any>;
export declare const getExamQuestionsList: functions.HttpsFunction & functions.Runnable<any>;
export declare const getExamForStudent: functions.HttpsFunction & functions.Runnable<any>;
export declare const submitAndGradeExam: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 🤖 Analyze student code with AI
 * Provides optimization suggestions and corrections
 */
export declare const analyzeCodeWithAI: functions.HttpsFunction & functions.Runnable<any>;
export declare const chatWithAI: functions.HttpsFunction & functions.Runnable<any>;
export declare const aiCodeAssistant: functions.HttpsFunction & functions.Runnable<any>;
export declare const sendWelcomeEmail: functions.HttpsFunction & functions.Runnable<any>;
export declare const sendOTPEmail: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Secure Password Reset Cloud Function
 * Uses Firebase Admin SDK to update user passwords securely
 *
 * Security Features:
 * - Never stores plain text passwords
 * - Validates OTP before password update
 * - Implements rate limiting
 * - Logs all password reset attempts for audit trail
 */
export declare const resetPasswordSecurely: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cleanup expired OTPs (runs daily)
 * Removes OTPs older than 1 hour to keep database clean
 */
export declare const cleanupExpiredOTPs: functions.CloudFunction<unknown>;
export declare const sendPasswordResetEmail: functions.HttpsFunction & functions.Runnable<any>;
export declare const evaluateAnswerWithAI: functions.HttpsFunction & functions.Runnable<any>;
export declare const autoCompleteExpiredExams: functions.CloudFunction<unknown>;
export declare const manualAutoCompleteExams: functions.HttpsFunction;
export declare const checkExpiredExams: functions.HttpsFunction;
/**
* Scheduled Cloud Function - Auto-submit pending attempts after 30-minute grace period
*/
export declare const autoSubmitPendingAttempts: functions.CloudFunction<unknown>;
export declare const manualAutoSubmitAndGrade: functions.HttpsFunction;
export declare const completeExamWithGrading: functions.HttpsFunction;
export declare const gradeAttemptWorker: functions.CloudFunction<functions.pubsub.Message>;
export declare const checkGradingProgress: functions.HttpsFunction;
export declare const changeUserPasswordAdmin: functions.HttpsFunction & functions.Runnable<any>;
export declare const createUser: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 🏫 Add College/University
 * Creates a new college/university document in Firestore
 * Only system_admin can add colleges
 */
export declare const addCollege: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 🔄 Get Previous and Next Problems
 * Returns the previous and next problems based on the current problem's number
 * This is a public HTTP function (no authentication required)
 */
export declare const getProblemNavigation: functions.HttpsFunction;
/**
 * 📋 Get All Problems List
 * Returns a list of all problems (id, slug, number, title only)
 * Useful for sidebar or problem list page
 */
export declare const getProblemsList: functions.HttpsFunction;
/**
 * Generate CloudFront signed cookies for video playback
 * Requires CF_PRIVATE_KEY secret to be set in Firebase
 */
export declare const getVideoSignedCookies: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 🕛 Nightly Cron - Sync Student Learning Details
 * Runs at 12:00 AM IST every night
 */
export declare const syncStudentLearningDetailsCron: functions.CloudFunction<unknown>;
/**
 * 🔄 Manual Sync - Callable by system_admin only
 */
export declare const syncStudentLearningDetailsManual: functions.HttpsFunction & functions.Runnable<any>;
export declare const fetchLeetCodeStats: functions.HttpsFunction & functions.Runnable<any>;
export declare const aiInterviewChat: functions.HttpsFunction & functions.Runnable<any>;
export declare const getPersonalityTraitAggregation: functions.HttpsFunction & functions.Runnable<any>;
export declare const updateLeaderboardStats: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
export declare const getLeaderboardPaginated: functions.HttpsFunction & functions.Runnable<any>;
export declare const migrateLeaderboardStats: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 📧 Send Email Verification for Resume Builder External Signups
 * Called from resume-builder.php after createUserWithEmailAndPassword succeeds.
 * Stores { emailVerified: false, verificationToken, verificationSentAt } in Firestore,
 * then sends a branded verification email via Brevo SMTP.
 *
 * Callable — requires the user to be authenticated (just signed up).
 */
export declare const sendResumeVerificationEmail: functions.HttpsFunction & functions.Runnable<any>;
/**
 * ✅ Verify Resume Builder Email Token
 * Called when user clicks the verification link.
 * Matches token + uid, marks emailVerified: true in Firestore,
 * and updates Firebase Auth emailVerified flag via Admin SDK.
 *
 * Public callable — no auth required (user may not be signed in when clicking link).
 */
export declare const verifyResumeEmail: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 🧹 Cleanup Unverified Resume Builder Accounts (runs daily at 2:00 AM IST)
 * Deletes Firebase Auth accounts and Firestore docs for users who signed up
 * but never verified their email within 24 hours.
 * Also tracks cleanup in resume_cleanup_log for auditing.
 */
export declare const cleanupUnverifiedResumeAccounts: functions.CloudFunction<unknown>;
//# sourceMappingURL=index-examiners.d.ts.map