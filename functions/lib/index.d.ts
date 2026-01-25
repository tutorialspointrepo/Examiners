import * as functions from 'firebase-functions';
export { processReportInstance } from './reports';
/**
 * 📝 Resume Content Enhancement with AI
 * Enhances resume summaries, job descriptions, and skills using GPT
 */
export declare const enhanceResumeContent: functions.HttpsFunction & functions.Runnable<any>;
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
//# sourceMappingURL=index.d.ts.map