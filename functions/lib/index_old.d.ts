import * as functions from 'firebase-functions';
export declare const getExamForStudent: functions.HttpsFunction & functions.Runnable<any>;
export declare const submitAndGradeExam: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 🤖 Analyze student code with AI
 * Provides optimization suggestions and corrections
 */
export declare const analyzeCodeWithAI: functions.HttpsFunction & functions.Runnable<any>;
export declare const chatWithAI: functions.HttpsFunction & functions.Runnable<any>;
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
//# sourceMappingURL=index_old.d.ts.map