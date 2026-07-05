import * as functions from 'firebase-functions';
/**
 * 🎤 aiInterviewStartVoiceSession
 * Mints a Gemini Live token and returns everything the frontend needs to open the session.
 * Input: { courseId?, courseName, candidateName?, curriculumBlueprint, language?, voicePersona? }
 */
export declare const aiInterviewStartVoiceSession: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 💾 aiInterviewSaveResult — saves scorecard under users/{uid}/ai_interviews/{conversationId}
 * and the transcript in its own doc users/{uid}/ai_interview_transcripts/{conversationId}.
 */
export declare const aiInterviewSaveResult: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 📜 aiInterviewListPast — lists the caller's completed interviews (optional courseId filter).
 */
export declare const aiInterviewListPast: functions.HttpsFunction & functions.Runnable<any>;
/**
 * 📄 aiInterviewGetTranscript — full transcript + report detail for one past interview.
 */
export declare const aiInterviewGetTranscript: functions.HttpsFunction & functions.Runnable<any>;
//# sourceMappingURL=aiInterview.d.ts.map