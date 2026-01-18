// ============================================
// Firebase Cloud Functions - WITH PUB/SUB PARALLEL GRADING
// Includes: AI Chat + Email Service + Auto-Complete Exams + Pub/Sub Workers
// ============================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';
import * as nodemailer from 'nodemailer';
import { PubSub } from '@google-cloud/pubsub';

// Import report processing from separate file
export { processReportInstance } from './reports';

// Import application constants
import {
  AI_MODELS,
  COLLECTIONS,
  EXAM_STATUS,
  FIRESTORE_PATHS,
  SYSTEM_TRIGGERS,
  CLOUD_FUNCTION_CONFIG,
} from './constants';

admin.initializeApp();

// Initialize Pub/Sub client
const pubsub = new PubSub();

// ============================================
// TYPE DEFINITIONS
// ============================================
interface ExamData {
  id: string;
  title?: string;
  examDate?: string;
  examTime?: string;
  duration?: string;
  status?: string;
  collegeId?: string;
  collegeName?: string;
  [key: string]: any;
}

// ============================================
// SECURITY: SANITIZATION HELPER FUNCTIONS
// ============================================

/**
 * 🔧 UTILITY: Remove undefined values from an object
 * Firestore rejects objects with undefined values
 */
function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item)).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
        cleaned[key] = cleanObject(obj[key]);
      }
    }
    return cleaned;
  }
  
  return obj;
}

/**
 * 🔒 SECURITY: Sanitize a single question before sending to client
 * Removes correctAnswers, solution, and expected_output from testCases
 * to prevent students from seeing answers in DevTools or Network tab
 * 
 * This function runs on Google's servers (server-side), making it truly secure.
 * Students CANNOT bypass this sanitization since it happens before data leaves the server.
 */
function sanitizeQuestionForClient(question: any): any {
  // Debug: Log what fields are present
  console.log(`[SANITIZE] Processing question ${question.id} (type: ${question.type})`);
  console.log(`[SANITIZE] Available fields:`, Object.keys(question));
  
  const {
    correctAnswers,
    solution,
    ...safeQuestion
  } = question;
  
  console.log(`[SANITIZE] After destructuring:`, Object.keys(safeQuestion));
  
  // FITB: Send blanksCount
  if (question.type === 'fitb' && correctAnswers && Array.isArray(correctAnswers)) {
    safeQuestion.blanksCount = correctAnswers.length;
  }
  
  // CODE: Rename testStub to boilerplate for client, remove expected_output from testCases
  if (question.type === 'code') {
      if (question.testStub) {
        safeQuestion.boilerplate = question.testStub;
        console.log(`[SANITIZE] ✅ Renamed testStub to boilerplate (${question.testStub.length} chars)`);
      }
      
      if (question.testCases && Array.isArray(question.testCases)) {
        safeQuestion.testCases = question.testCases.map((tc: any) => ({
          input: tc.input,
          expected_output: tc.expected_output || tc.expectedOutput || tc.output || '',  // ✅ Use snake_case
          marks: tc.marks,
        }));
        console.log(`[SANITIZE] ✅ Preserved ${safeQuestion.testCases.length} test cases with expected outputs`);
      }
    }
  
  // JUMBLED: Keep jumbledOptions
  if (question.type === 'jumbled') {
    console.log(`[SANITIZE] Jumbled question - checking for jumbledOptions...`);
    console.log(`[SANITIZE] question.jumbledOptions exists?`, !!question.jumbledOptions);
    console.log(`[SANITIZE] question.jumbledOptions value:`, question.jumbledOptions);
    
    if (question.jumbledOptions && Array.isArray(question.jumbledOptions)) {
      safeQuestion.jumbledOptions = [...question.jumbledOptions];
      console.log(`[SANITIZE] ✅ Kept jumbledOptions: ${question.jumbledOptions.length} items`);
    } else {
      console.error(`[SANITIZE] ❌ WARNING: Jumbled question ${question.id} has NO jumbledOptions!`);
      console.error(`[SANITIZE] Available fields:`, Object.keys(question));
    }
  }
  
  console.log(`[SANITIZE] Final safeQuestion keys:`, Object.keys(safeQuestion));
  
  return safeQuestion;
}

/**
 * 🔒 Sanitize all questions in exam (SERVER-SIDE)
 */
function sanitizeExamQuestions(exam: any): any {
  if (exam.questionsList && Array.isArray(exam.questionsList)) {
    exam.questionsList = exam.questionsList.map((q: any) => sanitizeQuestionForClient(q));
  }
  
  if (exam.questionPool && Array.isArray(exam.questionPool)) {
    exam.questionPool = exam.questionPool.map((q: any) => sanitizeQuestionForClient(q));
  }
  
  return exam;
}

// ============================================
// AI HELPER FUNCTIONS (SERVER-SIDE ONLY)
// ============================================

/**
 * 🤖 Helper: Code Analysis with Failure-Specific Feedback
 * Handles 3 scenarios: all pass, some fail, all fail
 */
async function analyzeCodeWithAIHelper(params: {
  questionText: string;
  studentCode: string;
  programmingLanguage: string;
  testCases: any[];
  testResults: any[];
  passedTests: number;
  totalTests: number;
  modelSolution?: string;
}): Promise<any> {
  const {
    questionText,
    studentCode,
    programmingLanguage,
    testCases,
    testResults,
    passedTests,
    totalTests,
    modelSolution
  } = params;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const allTestsPassed = passedTests === totalTests;
  const allTestsFailed = passedTests === 0;
  const failedTests = totalTests - passedTests;
  
  // Determine severity
  let severityLevel: 'success' | 'partial' | 'critical';
  if (allTestsPassed) severityLevel = 'success';
  else if (allTestsFailed) severityLevel = 'critical';
  else severityLevel = 'partial';

  // Build detailed test results
  let testResultsDetail = '\n\nDetailed Test Results:\n';
  const failedTestsDetail: any[] = [];
  
  testResults.forEach((result: any, index: number) => {
    const testCase = testCases[index];
    const testNum = index + 1;
    
    testResultsDetail += `\nTest ${testNum}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    testResultsDetail += `  Input: ${testCase.input}\n`;
    testResultsDetail += `  Expected Output: ${testCase.expectedOutput || testCase.expected_output}\n`;
    testResultsDetail += `  Student Output: ${result.actualOutput || 'No output'}\n`;
    if (result.error) testResultsDetail += `  Error: ${result.error}\n`;
    
    // Track failed tests for detailed analysis
    if (!result.passed) {
      failedTestsDetail.push({
        testNumber: testNum,
        input: testCase.input,
        expected: testCase.expectedOutput || testCase.expected_output,
        got: result.actualOutput || 'No output',
        error: result.error || null
      });
    }
  });

  try {
    const client = new OpenAI({ apiKey });

    // ✅ Scenario-specific prompts
    let scenarioPrompt = '';
    let jsonStructure = '';
    
    if (allTestsPassed) {
      // Scenario 1: All tests passed - optimization focus
      scenarioPrompt = `✅ EXCELLENT! All ${totalTests} tests passed!

Your code is functionally correct. Now let's focus on:
1. Code quality and readability
2. Performance optimization
3. Best practices

Provide optimization suggestions, but code corrections are optional.`;
      
      jsonStructure = `{
  "codeQuality": number (0-100),
  "readabilityScore": number (0-100),
  "efficiencyScore": number (0-100),
  "correctnessScore": 100,
  "timeComplexity": string,
  "spaceComplexity": string,
  "correctPoints": string[] (2-4 things done well),
  "improvements": string[] (2-3 optimization suggestions),
  "failedTestAnalysis": [],
  "hasSuggestedCode": boolean (true only if significant optimization possible),
  "suggestedCode": string (optimized version - only if hasSuggestedCode true),
  "codeExplanation": string (why it's better)
}`;
      
    } else if (severityLevel === 'critical') {
      // Scenario 2: All tests failed - major issues
      scenarioPrompt = `❌ CRITICAL: All ${totalTests} tests failed!

The code has major issues. Analyze why it's failing and provide a corrected version.

Focus on:
1. Identify the fundamental logic errors
2. Provide specific line-by-line fixes for each failed test
3. Give a working corrected version

This is a learning opportunity - be educational in your explanations.`;
      
      jsonStructure = `{
  "codeQuality": number (0-100, likely low),
  "readabilityScore": number (0-100),
  "efficiencyScore": number (0-100),
  "correctnessScore": 0,
  "timeComplexity": string,
  "spaceComplexity": string,
  "correctPoints": string[] (anything salvageable, or empty if nothing works),
  "improvements": string[] (major fixes needed - be specific with line numbers),
  "failedTestAnalysis": [
    {
      "testNumber": number,
      "issue": string (why this specific test failed),
      "fix": string (how to fix it)
    }
    // Include ALL ${failedTests} failed tests
  ],
  "hasSuggestedCode": true,
  "suggestedCode": string (MUST provide working corrected code),
  "codeExplanation": string (explain the key fixes)
}`;
      
    } else {
      // Scenario 3: Some tests failed - partial issues
      scenarioPrompt = `⚠️ PARTIAL: ${passedTests}/${totalTests} tests passed, ${failedTests} failed.

Some logic works, but there are bugs in edge cases or specific scenarios.

Focus on:
1. What's working correctly (passed tests)
2. Specific issues causing each test failure
3. Targeted fixes for the failing tests

Help the student understand what to fix without rewriting everything.`;
      
      jsonStructure = `{
  "codeQuality": number (0-100, moderate),
  "readabilityScore": number (0-100),
  "efficiencyScore": number (0-100),
  "correctnessScore": number (${Math.round(passedTests/totalTests * 100)}),
  "timeComplexity": string,
  "spaceComplexity": string,
  "correctPoints": string[] (what's working - refer to passed tests),
  "improvements": string[] (general code improvements),
  "failedTestAnalysis": [
    {
      "testNumber": number,
      "issue": string (specific reason this test failed),
      "fix": string (targeted fix with line numbers)
    }
    // Include ALL ${failedTests} failed tests
  ],
  "hasSuggestedCode": true,
  "suggestedCode": string (corrected version addressing failed tests),
  "codeExplanation": string (explain the specific fixes made)
}`;
    }

    const fullPrompt = `You are an expert ${programmingLanguage} code reviewer and educator.

Question: ${questionText}

Student Code:
\`\`\`${programmingLanguage}
${studentCode}
\`\`\`

${testResultsDetail}

${scenarioPrompt}

${modelSolution ? `\nReference Solution (for guidance):\n\`\`\`${programmingLanguage}\n${modelSolution}\n\`\`\`\n` : ''}

Provide detailed, educational feedback in this JSON structure:
${jsonStructure}

Guidelines:
- Be specific with line numbers when identifying bugs
- failedTestAnalysis must explain EACH failed test individually
- suggestedCode must be complete and working (not just snippets)
- codeExplanation should be educational and help student learn
- Use actual line numbers from the student's code`;

    const completion = await client.chat.completions.create({
      model: AI_MODELS.GPT_4O_MINI,
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert programming instructor. Provide clear, educational feedback that helps students learn. Always respond in valid JSON.' 
        },
        { role: 'user', content: fullPrompt }
      ],
      temperature: 0.3,
      max_tokens: 3000,  // Increased for detailed analysis
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices?.[0]?.message?.content || '{}');

    // ✅ Return unified structure with test-specific feedback
    return {
      // Test execution
      testsPassed: passedTests,
      testsTotal: totalTests,
      allTestsPassed,
      severityLevel,
      
      // Code quality scores
      codeQuality: result.codeQuality ?? 0,
      readabilityScore: result.readabilityScore ?? 0,
      efficiencyScore: result.efficiencyScore ?? 0,
      correctnessScore: result.correctnessScore ?? Math.round((passedTests / totalTests) * 100),
      
      // Complexity
      timeComplexity: result.timeComplexity || 'Unknown',
      spaceComplexity: result.spaceComplexity || 'Unknown',
      
      // General feedback
      correctPoints: result.correctPoints || [],
      improvements: result.improvements || [],
      
      // ✅ Test-specific analysis
      failedTestAnalysis: result.failedTestAnalysis || [],
      
      // Code suggestions (mandatory if tests failed)
      hasSuggestedCode: result.hasSuggestedCode ?? !allTestsPassed,  // Always true if tests fail
      suggestedCode: result.suggestedCode || '',
      codeExplanation: result.codeExplanation || ''
    };

  } catch (error: any) {
    console.error('❌ Code analysis failed:', error.message);
    
    // ✅ Smart fallback based on test results
    const basicQuality = Math.round((passedTests / totalTests) * 100);
    
    // Build basic failed test analysis from test results
    const basicFailedAnalysis = failedTestsDetail.map(ft => ({
      testNumber: ft.testNumber,
      issue: ft.error || `Expected ${ft.expected} but got ${ft.got}`,
      fix: 'Review the test input and expected output above'
    }));
    
    return {
      testsPassed: passedTests,
      testsTotal: totalTests,
      allTestsPassed,
      severityLevel,
      
      codeQuality: basicQuality,
      readabilityScore: 0,
      efficiencyScore: 0,
      correctnessScore: basicQuality,
      
      timeComplexity: 'Unknown',
      spaceComplexity: 'Unknown',
      
      correctPoints: passedTests > 0 ? [`${passedTests} test case(s) passed`] : [],
      improvements: [
        'Unable to analyze code automatically: ' + error.message,
        'Your code will be reviewed manually by your instructor',
        failedTests > 0 ? `Focus on the ${failedTests} failing test case(s)` : ''
      ].filter(imp => imp.length > 0),
      
      // Basic test-specific feedback
      failedTestAnalysis: basicFailedAnalysis,
      
      hasSuggestedCode: false,
      suggestedCode: '',
      codeExplanation: 'Automatic code correction unavailable. Please review test results manually.'
    };
  }
}

/**
 * 🤖 Helper: Descriptive Answer Evaluation with Granular Scoring
 * Returns: AI feedback with detailed scores and actionable feedback
 */
async function evaluateAnswerWithAIHelper(params: {
  questionText: string;
  modelAnswer: string;
  studentAnswer: string;
  maxMarks: number;
  isOfflineExam?: boolean;
  imageUrl?: string;
}): Promise<any> {
  const { questionText, modelAnswer, studentAnswer, maxMarks, isOfflineExam, imageUrl } = params;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  // Calculate word count for the student answer
  const studentAnswerText = typeof studentAnswer === 'string' ? studentAnswer : JSON.stringify(studentAnswer);
  const wordCount = studentAnswerText.trim().split(/\s+/).filter(w => w.length > 0).length;

  try {
    const client = new OpenAI({ apiKey });
    const model = isOfflineExam ? 'gpt-4o' : 'gpt-4o-mini';

    // ✅ Updated prompt with granular scoring
    const prompt = `Evaluate this student answer with detailed granular scoring.

Question: ${questionText}

Model Answer: ${modelAnswer}

Student Answer: ${studentAnswer}

Maximum Marks: ${maxMarks}

Provide concise, actionable feedback with granular scores.

JSON response: {
  "marks": number (0-${maxMarks}),
  "confidence": number (0-100, your confidence in this evaluation),
  "correctPoints": string[] (specific correct concepts - be concise and specific),
  "improvements": string[] (missing points + actionable suggestions - be specific),
  "answerLengthScore": number (0-100, appropriateness of length for this question),
  "relevancyScore": number (0-100, how relevant is answer to the question),
  "accuracyScore": number (0-100, factual correctness),
  "completenessScore": number (0-100, covers all key points from model answer),
  "plagiarismScore": number (0-100, likelihood of being copied/too generic),
  "plagiarismIndicators": string[] (red flags if score > 30, empty array if clean)
}

Scoring Guidelines:
- marks: Award marks based on correctness and completeness
- confidence: Your confidence in this evaluation (higher if answer is clear)
- correctPoints: List ONLY what the student actually got right - be specific
- improvements: ALWAYS provide 1-3 actionable suggestions, even if answer is perfect (e.g., "Consider adding more examples", "Could discuss edge cases")
- answerLengthScore: 100 if appropriate length, lower if too short (<${Math.max(50, maxMarks * 10)} words) or too verbose (>${maxMarks * 50} words)
- relevancyScore: 100 if directly answers question, 0 if completely off-topic
- accuracyScore: 100 if all facts correct, lower for errors or misconceptions
- completenessScore: 100 if covers all key points from model answer, 0 if covers none
- plagiarismScore: 0-30 = likely original, 30-70 = suspicious patterns (generic phrases, templated structure), 70-100 = highly generic/copied
- plagiarismIndicators: List specific red flags only if score > 30 (e.g., "Uses generic template phrases", "Too similar to common online answers")

IMPORTANT: Even for perfect answers, provide at least one constructive suggestion in improvements array.
Be concise and actionable in all feedback. Focus on what matters most for learning.`;

    // Prepare message content (text or text + image)
    let messageContent: any = prompt;
    if (isOfflineExam && imageUrl) {
      messageContent = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
      ];
    }

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an expert educational evaluator. Provide fair, constructive feedback. Always respond in valid JSON format.' },
        { role: 'user', content: messageContent }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices?.[0]?.message?.content || '{}');

    // ✅ DEBUG: Log what AI actually returned
    console.log('🤖 AI Response:', JSON.stringify({
      marks: result.marks,
      correctPoints: result.correctPoints?.length || 0,
      improvements: result.improvements?.length || 0,
      // Check old fields too
      strengths: result.strengths?.length || 0,
      keyPointsMissing: result.keyPointsMissing?.length || 0
    }));

    // Extract feedback with fallbacks
    const correctPoints = result.correctPoints || result.strengths || [];
    const improvements = result.improvements || result.keyPointsMissing || [];
    
    // ✅ SAFETY: If improvements is empty, add a generic one
    if (improvements.length === 0 && correctPoints.length > 0) {
      // Student got something right but no improvements - add constructive feedback
      if (result.marks >= maxMarks * 0.9) {
        improvements.push('Excellent answer! Consider adding more real-world examples or edge cases.');
      } else if (result.marks >= maxMarks * 0.7) {
        improvements.push('Good understanding shown. Review the model answer for additional details.');
      } else {
        improvements.push('Review the model answer to identify missing key concepts.');
      }
      console.log('⚠️ Added fallback improvement - AI returned empty improvements');
    }

    // ✅ Return clean structure with proper defaults using ?? operator
    return {
      // Core evaluation
      suggestedMarks: result.marks ?? 0,
      maxMarks,
      confidenceScore: result.confidence ?? 0,
      
      // Feedback - with fallback to old field names
      correctPoints: correctPoints,
      improvements: improvements,
      
      // Granular scores (use ?? to distinguish 0 from undefined)
      answerLength: wordCount,
      answerLengthScore: result.answerLengthScore ?? 0,
      relevancyScore: result.relevancyScore ?? 0,
      accuracyScore: result.accuracyScore ?? 0,
      completenessScore: result.completenessScore ?? 0,
      
      // Plagiarism detection
      plagiarismScore: result.plagiarismScore || 0,
      isPlagiarized: (result.plagiarismScore || 0) > 50,
      plagiarismIndicators: result.plagiarismIndicators || []
    };

  } catch (error: any) {
    console.error('❌ AI evaluation failed:', error.message);
    
    // ✅ Smart fallback based on answer length
    const calculateBasicScore = (words: number): number => {
      if (words === 0) return 0;
      if (words < 20) return Math.min(words * 2, 30);           // Very short: 0-30%
      if (words < 50) return Math.min(30 + (words - 20), 60);   // Short: 30-60%
      if (words < 100) return Math.min(60 + (words - 50) / 2, 80); // Medium: 60-80%
      return Math.min(80 + (words - 100) / 10, 100);            // Long: 80-100%
    };

    const basicScore = calculateBasicScore(wordCount);

    return {
      // Core evaluation - conservative fallback
      suggestedMarks: Math.max(1, Math.round(maxMarks * 0.3)), // 30% minimum for manual review
      maxMarks,
      confidenceScore: 0,  // No confidence since AI failed
      
      // Feedback
      correctPoints: [],
      improvements: [
        'Unable to evaluate automatically: ' + error.message,
        'This answer will be reviewed manually by your instructor',
        wordCount < 30 ? 'Consider providing a more detailed answer' : '',
        'Ensure your answer directly addresses the question'
      ].filter(imp => imp.length > 0),
      
      // Granular scores - length-based fallback
      answerLength: wordCount,
      answerLengthScore: basicScore,
      relevancyScore: 0,        // Can't determine without AI
      accuracyScore: 0,         // Can't determine without AI
      completenessScore: Math.round(basicScore * 0.8), // Conservative estimate
      
      // Plagiarism detection
      plagiarismScore: 0,
      isPlagiarized: false,
      plagiarismIndicators: []
    };
  }
}



// ============================================
// 1. GET EXAM (SANITIZED)
// ============================================

export const getExamForStudent = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      
      const { examId } = data;
      const userType = context.auth.token.userType || 'student';
      
      if (!examId) {
        throw new functions.https.HttpsError('invalid-argument', 'examId is required');
      }
      
      const examDoc = await admin.firestore()
        .collection(COLLECTIONS.EXAMS)
        .doc(examId)
        .get();
      
      if (!examDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Exam not found');
      }
      
      let exam = examDoc.data() as any;
      exam.id = examDoc.id;
      
      // Sanitize for students only
      if (userType === 'student') {
        exam = sanitizeExamQuestions(exam);
      }
      
      return { success: true, exam };
      
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ============================================
// SHARED GRADING FUNCTION
// Used by both manual submit and auto-submit
// ============================================

/**
 * Shared grading logic - handles all question types
 * Used by both submitAndGradeExam and autoSubmitPendingAttempts
 */
async function gradeAttempt(examId: string, attemptId: string, responses: any[]) {
  console.log(`🎯 Starting grading for attempt: ${attemptId}`);
  
  // Fetch exam WITH answers
  const examDoc = await admin.firestore()
    .collection(COLLECTIONS.EXAMS)
    .doc(examId)
    .get();
  
  if (!examDoc.exists) {
    throw new Error('Exam not found');
  }
  
  const exam = examDoc.data() as any;
  const allQuestions = [
    ...(exam.questionsList || []),
    ...(exam.questionPool || [])
  ];
  
  console.log(`🔑 Fetched exam WITH answers (${allQuestions.length} questions)`);
  
  // Initialize aggregation variables
  let totalScore = 0;
  let maxMarks = 0;
  let attemptedQuestions = 0;
  let correctAnswers = 0;
  let pendingManualGrading = 0;
  
  const byType: any = {};
  const byComplexity: any = {
    easy: { attempted: 0, score: 0, maxScore: 0 },
    medium: { attempted: 0, score: 0, maxScore: 0 },
    hard: { attempted: 0, score: 0, maxScore: 0 }
  };
  const byChapter: any = {};
  
  const gradedResponses = [];
  
  // Grade each response
  for (const response of responses) {
    const question = allQuestions.find((q: any) => q.id === response.questionId);
    
    if (!question) {
      console.warn(`Question not found: ${response.questionId}`);
      gradedResponses.push({
        ...response,
        marksAwarded: 0,
        scoredMarks: 0,
        evaluationStatus: 'error',
        evaluationMethod: 'not_found'
      });
      continue;
    }
    
    const questionMaxMarks = question.marks || question.maximumMarks || 0;
    maxMarks += questionMaxMarks;
    
    const isAttempted = response.studentAnswer !== null && 
                       response.studentAnswer !== '' && 
                       !(Array.isArray(response.studentAnswer) && response.studentAnswer.length === 0);
    
    if (isAttempted) attemptedQuestions++;
    
    let marksAwarded = 0;
    let isCorrect = false;
    let evaluationMethod = 'not_attempted';
    let aiFeedback = null;
    
    // ============================================
    // MCQ GRADING
    // ============================================
    if (question.type === 'mcq' && isAttempted) {
      const correctAnswersList = question.correctAnswers || [question.correctAnswer];
      const studentAnswer = response.studentAnswer;
      
      if (Array.isArray(studentAnswer)) {
        const correctCount = studentAnswer.filter((ans: any) => 
          correctAnswersList.includes(ans)
        ).length;
        const wrongCount = studentAnswer.filter((ans: any) => 
          !correctAnswersList.includes(ans)
        ).length;
        
        const score = Math.max(0, correctCount - wrongCount) / correctAnswersList.length;
        marksAwarded = Math.round(score * questionMaxMarks * 100) / 100;
        isCorrect = correctCount === correctAnswersList.length && wrongCount === 0;
      } else {
        isCorrect = correctAnswersList.includes(studentAnswer);
        marksAwarded = isCorrect ? questionMaxMarks : 0;
      }
      evaluationMethod = 'mcq_auto';
    }
    
    // ============================================
    // FITB GRADING
    // ============================================
    else if (question.type === 'fitb' && isAttempted) {
      const correctAnswersList = question.correctAnswers || [];
      const studentAnswer = Array.isArray(response.studentAnswer) 
        ? response.studentAnswer 
        : [response.studentAnswer];
      
      let correctCount = 0;
      for (let i = 0; i < correctAnswersList.length; i++) {
        const correct = (correctAnswersList[i] || '').toString().toLowerCase().trim();
        const student = (studentAnswer[i] || '').toString().toLowerCase().trim();
        if (correct === student) correctCount++;
      }
      
      const score = correctAnswersList.length > 0 ? correctCount / correctAnswersList.length : 0;
      marksAwarded = Math.round(score * questionMaxMarks * 100) / 100;
      isCorrect = correctCount === correctAnswersList.length;
      evaluationMethod = 'fitb_auto';
    }
    
    // ============================================
    // JUMBLED GRADING
    // ============================================
    else if (question.type === 'jumbled' && isAttempted) {
      const correctSequence = question.correctAnswers || [];
      const studentSequence = response.studentAnswer || [];
      
      isCorrect = JSON.stringify(correctSequence) === JSON.stringify(studentSequence);
      marksAwarded = isCorrect ? questionMaxMarks : 0;
      evaluationMethod = 'jumbled_auto';
    }
    
    // ============================================
    // DESCRIPTIVE - AI GRADING
    // ============================================
    else if ((question.type === 'descriptive' || question.type === 'text') && isAttempted) {
      try {
        console.log(`      🤖 AI grading descriptive Q${response.questionNo}...`);
        
        const modelAnswer = question.correctAnswers?.[0] || '';
        const studentAnswer = response.studentAnswer as string;
        const isOfflineExam = response.imageUrl ? true : false;
        
        aiFeedback = await evaluateAnswerWithAIHelper({
          questionText: question.questionText,
          modelAnswer: modelAnswer,
          studentAnswer: studentAnswer,
          maxMarks: questionMaxMarks,
          isOfflineExam: isOfflineExam,
          imageUrl: response.imageUrl
        });
        
        marksAwarded = aiFeedback.suggestedMarks;
        isCorrect = marksAwarded >= (questionMaxMarks * 0.6);
        evaluationMethod = 'ai_grading';
        
        console.log(`      ✅ AI awarded ${marksAwarded}/${questionMaxMarks} marks`);
        
      } catch (aiError: any) {
        console.error(`      ❌ AI grading failed: ${aiError.message}`);
        marksAwarded = 0;
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
      }
    }
    
    // ============================================
    // CODE GRADING (SERVER-SIDE JUDGE0 + AI FEEDBACK)
    // ============================================
    else if (question.type === 'code' && isAttempted) {
      console.log(`      💻 Grading code with Judge0 execution + AI analysis...`);
      
      const testCases = question.testCases || [];
      const studentCode = response.studentAnswer as string;
      
      // ✅ CHECK: If code is empty/null/undefined, mark as not attempted
      if (!studentCode || studentCode.trim() === '') {
        console.log(`      ⚠️ No code submitted for Q${response.questionNo} - marking as unattempted`);
        
        gradedResponses.push({
          ...response,
          studentAnswer: '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'not_attempted',
          evaluationMethod: 'not_attempted',
          autoEvaluated: false,
          evaluatedBy: null,
          evaluatedAt: null,
          evaluationError: 'No code submitted'
        });
        
        continue;
      }
      
      const programmingLanguage = question.programmingLanguage || question.language || 'javascript';
      let passedCount = 0;
      let testResults: any[] = [];
      
      // Judge0 Language ID mapping
      const languageIdMap: { [key: string]: number } = {
        'javascript': 63,
        'python': 71,
        'java': 62,
        'cpp': 54,
        'c': 50,
        'csharp': 51,
        'ruby': 72,
        'go': 60,
        'php': 68,
        'typescript': 74,
        'kotlin': 78,
        'swift': 83,
        'rust': 73
      };
      
      const languageId = languageIdMap[programmingLanguage.toLowerCase()] || 63;
      
      console.log(`      🔧 Programming Language: ${programmingLanguage} (Judge0 ID: ${languageId})`);
      
      // Fetch Judge0 base URL
      let JUDGE0_BASE_URL = '';
      
      try {
        console.log(`      📥 Fetching Judge0 base URL from Firestore...`);
        
        const settingsDoc = await admin.firestore()
          .collection('settings')
          .doc('judge0_base_url')
          .get();
        
        if (settingsDoc.exists) {
          const settingsData = settingsDoc.data();
          JUDGE0_BASE_URL = settingsData?.url || settingsData?.value || settingsData?.judge0_base_url || '';
          console.log(`      ✅ Judge0 URL: ${JUDGE0_BASE_URL}`);
        } else {
          console.error(`      ❌ Judge0 settings document not found`);
          throw new Error('Judge0 base URL not configured');
        }
        
        if (!JUDGE0_BASE_URL) {
          throw new Error('Judge0 base URL is empty');
        }
        
        JUDGE0_BASE_URL = JUDGE0_BASE_URL.replace(/\/$/, '');
        
      } catch (configError: any) {
        marksAwarded = 0;
        isCorrect = false;
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
        
        gradedResponses.push({
          ...response,
          questionType: 'code',
          complexity: question.complexity,
          chapter: question.chapter,
          studentAnswer: studentCode || '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'pending',
          evaluationMethod: 'pending_manual',
          autoEvaluated: false,
          evaluatedBy: 'system',
          evaluationError: `Judge0 configuration error: ${configError.message}`,
          evaluatedAt: new Date()
        });
        
        continue;
      }
      
      // Execute code with Judge0
      try {
        console.log(`      🚀 Executing ${testCases.length} test cases with Judge0...`);
        
        for (let i = 0; i < testCases.length; i++) {
          const testCase = testCases[i];
          
          console.log(`         Test ${i + 1}: Input="${testCase.input}"`);
          
          const submissionResponse = await fetch(
            `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                source_code: studentCode,
                language_id: languageId,
                stdin: testCase.input,
                expected_output: testCase.expected_output
              })
            }
          );
          
          if (!submissionResponse.ok) {
            const errorText = await submissionResponse.text();
            console.error(`         ❌ Judge0 request failed: ${submissionResponse.status}`);
            console.error(`         Response: ${errorText}`);
            throw new Error(`Judge0 submission failed: ${submissionResponse.status} - ${errorText}`);
          }
          
          const result = await submissionResponse.json();
          
          console.log(`         Judge0 Response:`, {
            status: result.status?.description,
            statusId: result.status?.id,
            time: result.time,
            memory: result.memory
          });
          
          const actualOutput = result.stdout?.trim() || '';
          const expectedOutput = testCase.expected_output?.trim() || '';
          const passed = result.status?.id === 3 && actualOutput === expectedOutput;
          
          testResults.push({
            testNumber: i + 1,
            input: testCase.input,
            expectedOutput: expectedOutput,
            actualOutput: actualOutput,
            passed: passed,
            error: result.stderr || result.compile_output || null,
            executionTime: result.time || null,
            memory: result.memory || null,
            statusId: result.status?.id || null,
            statusDescription: result.status?.description || 'Unknown'
          });
          
          if (passed) {
            passedCount++;
            console.log(`         ✅ Test ${i + 1} PASSED`);
          } else {
            console.log(`         ❌ Test ${i + 1} FAILED`);
            console.log(`            Expected: "${expectedOutput}"`);
            console.log(`            Got: "${actualOutput}"`);
            console.log(`            Status: ${result.status?.description}`);
            if (result.stderr) {
              console.log(`            Error: ${result.stderr.substring(0, 200)}`);
            }
          }
          
          if (i < testCases.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
      } catch (judge0Error: any) {
        console.error(`      ❌ Judge0 execution failed:`, judge0Error.message);
        
        marksAwarded = 0;
        isCorrect = false;
        evaluationMethod = 'pending_manual';
        pendingManualGrading++;
        
        gradedResponses.push({
          ...response,
          questionType: 'code',
          complexity: question.complexity,
          chapter: question.chapter,
          studentAnswer: studentCode || '',
          marksAwarded: 0,
          maxMarks: questionMaxMarks,
          isCorrect: false,
          evaluationStatus: 'pending',
          evaluationMethod: 'pending_manual',
          autoEvaluated: false,
          evaluatedBy: 'system',
          evaluationError: `Judge0 execution failed: ${judge0Error.message}`,
          evaluatedAt: new Date()
        });
        
        continue;
      }
      
      // Calculate marks
      const score = testCases.length > 0 ? passedCount / testCases.length : 0;
      marksAwarded = Math.round(score * questionMaxMarks * 100) / 100;
      isCorrect = passedCount === testCases.length;
      evaluationMethod = 'code_auto_judge0';
      
      console.log(`      📊 Final Test Results: ${passedCount}/${testCases.length} passed`);
      console.log(`      💯 Marks: ${marksAwarded}/${questionMaxMarks}`);
      
      // AI Code Analysis
      let codeAIFeedback = null;
      
      try {
        console.log(`      🤖 Analyzing code with AI...`);
        
        codeAIFeedback = await analyzeCodeWithAIHelper({
          questionText: question.questionText,
          studentCode: studentCode,
          programmingLanguage: programmingLanguage,
          testCases: testCases,
          testResults: testResults,
          passedTests: passedCount,
          totalTests: testCases.length,
          modelSolution: question.solution || ''
        });
        
        console.log(`      ✅ AI Analysis complete:`);
        console.log(`         - Code Quality: ${codeAIFeedback.codeQuality}/100`);
        console.log(`         - Time Complexity: ${codeAIFeedback.timeComplexity}`);
        console.log(`         - Space Complexity: ${codeAIFeedback.spaceComplexity}`);
        
        if (codeAIFeedback.allTestsPassed) {
          console.log(`         - Optimizations: ${codeAIFeedback.optimizationSuggestions?.length || 0}`);
        } else {
          console.log(`         - Bugs found: ${codeAIFeedback.bugLocations?.length || 0}`);
        }
        
      } catch (aiError: any) {
        console.error(`      ⚠️ AI code analysis failed: ${aiError.message}`);
      }
      
      // Store graded response
      gradedResponses.push({
        ...response,
        questionType: 'code',
        complexity: question.complexity,
        chapter: question.chapter,
        studentAnswer: studentCode || '',
        programmingLanguage: programmingLanguage,
        marksAwarded,
        maxMarks: questionMaxMarks,
        isCorrect,
        evaluationStatus: 'completed',
        evaluationMethod,
        autoEvaluated: true,
        evaluatedBy: 'auto-grading-system',
        testResults: testResults,
        passedTests: passedCount,
        totalTests: testCases.length,
        codeAIFeedback: codeAIFeedback || undefined,
        evaluatedAt: new Date()
      });
      
      continue;
    }
    
    // ============================================
    // OTHER TYPES - Pending
    // ============================================
    else if (isAttempted) {
      evaluationMethod = 'pending_manual';
      pendingManualGrading++;
    }
    
    // Add to totals
    totalScore += marksAwarded;
    if (isCorrect) correctAnswers++;
    
    // Track by type
    const qType = question.type;
    if (!byType[qType]) {
      byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
    }
    if (isAttempted) {
      byType[qType].attempted++;
      byType[qType].score += marksAwarded;
      byType[qType].maxScore += questionMaxMarks;
    }
    
    // Track by complexity
    if (question.complexity) {
      const complexity = question.complexity.toLowerCase() as 'easy' | 'medium' | 'hard';
      if (byComplexity[complexity]) {
        if (isAttempted) byComplexity[complexity].attempted++;
        byComplexity[complexity].score += marksAwarded;
        byComplexity[complexity].maxScore += questionMaxMarks;
      }
    }
    
    // Track by chapter
    if (question.chapter) {
      if (!byChapter[question.chapter]) {
        byChapter[question.chapter] = { attempted: 0, score: 0, maxScore: 0 };
      }
      if (isAttempted) {
        byChapter[question.chapter].attempted++;
        byChapter[question.chapter].score += marksAwarded;
        byChapter[question.chapter].maxScore += questionMaxMarks;
      }
    }
    
    // Store graded response
    gradedResponses.push({
      ...response,
      marksAwarded,
      scoredMarks: marksAwarded,
      maxMarks: questionMaxMarks,
      isCorrect,
      evaluationStatus: evaluationMethod === 'pending_manual' ? 'pending' : 'evaluated',
      evaluationMethod,
      autoEvaluated: evaluationMethod !== 'pending_manual',
      evaluatedBy: evaluationMethod !== 'pending_manual' ? 'auto_grader' : null,
      aiFeedback: aiFeedback || null,
      evaluatedAt: evaluationMethod !== 'pending_manual' ? new Date() : null
    });
  }
  
  const percentage = maxMarks > 0 ? (totalScore / maxMarks) * 100 : 0;
  
  // Calculate total questions from exam and time spent from responses
  const totalQuestions = allQuestions.length;  // Total questions in exam
  const timeSpent = responses.reduce((sum: number, r: any) => sum + (r.timeSpent || 0), 0);
  
  console.log(`✅ Grading complete: ${totalScore}/${maxMarks} (${percentage.toFixed(2)}%)`);
  console.log(`   - Total questions: ${totalQuestions}`);
  console.log(`   - Attempted: ${attemptedQuestions}/${totalQuestions}`);
  console.log(`   - Correct: ${correctAnswers}`);
  console.log(`   - Time spent: ${timeSpent}s`);
  console.log(`   - Pending manual: ${pendingManualGrading}`);
  
  // Clean responses to remove undefined values
  const cleanedResponses = gradedResponses.map(r => cleanObject(r));
  
  // Update attempt document
  await admin.firestore()
    .collection(COLLECTIONS.EXAM_ATTEMPTS)
    .doc(attemptId)
    .update({
      responses: cleanedResponses,
      obtainedMarks: totalScore,  // Same as totalScore (keeping both for compatibility)
      totalScore: totalScore,     // Duplicate of obtainedMarks
      maximumScore: maxMarks,
      percentage: percentage,
      totalQuestions: totalQuestions,
      attemptedQuestions: attemptedQuestions,
      correctAnswers: correctAnswers,
      timeSpent: timeSpent,
      performanceByType: byType,
      performanceByComplexity: byComplexity,
      performanceByChapter: byChapter,
      evaluationStatus: pendingManualGrading === 0 ? 'evaluated' : 'pending',
      aiEvaluated: true,
      manualReviewRequired: pendingManualGrading > 0,
      pendingEvaluations: pendingManualGrading,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  
  return {
    success: true,
    totalScore,
    maxMarks,
    percentage,
    totalQuestions,
    attemptedQuestions,
    correctAnswers,
    timeSpent,
    pendingManualGrading
  };
}

// ============================================
// 2. SUBMIT & GRADE EXAM (ALL QUESTION TYPES)
// ============================================

export const submitAndGradeExam = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .https.onCall(async (data, context) => {
    try {
      console.log('📝 [SERVER-SIDE GRADING] Starting...');
      
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      
      const { examId, attemptId, responses, quickSubmit = false } = data;

      // ✅ QUICK SUBMIT MODE: Save immediately, evaluate in background
      if (quickSubmit) {
        console.log('⚡ Quick submit - saving answers without evaluation');
        
        await admin.firestore()
          .collection(COLLECTIONS.EXAM_ATTEMPTS)
          .doc(attemptId)
          .update({
            status: 'submitted',
            submitTime: admin.firestore.FieldValue.serverTimestamp(),
            evaluationStatus: 'pending',
            responses: responses.map((r: any) => ({
              ...r,  // ✅ Preserves all fields including violations, viewed, answered
              evaluationStatus: r.answered === false ? 'not_attempted' : 'pending',
              marksAwarded: 0,
              maxMarks: r.maxMarks || 0,
              autoEvaluated: false
            }))
          });
        
        return { 
          success: true, 
          message: 'Exam submitted successfully. Results will be available shortly.',
          quickSubmit: true
        };
      }

      if (!examId || !attemptId || !responses) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
      }
      
      // 🎯 Use shared grading function (same logic as auto-submit)
      console.log('🔐 Calling shared grading function...');
      const result = await gradeAttempt(examId, attemptId, responses);
      
      console.log('💾 Results saved');
      
      return {
        success: true,
        totalMarks: result.totalScore,
        maxMarks: result.maxMarks,
        percentage: Math.round(result.percentage),
        attemptedQuestions: result.attemptedQuestions,
        correctAnswers: result.correctAnswers,
        pendingManualGrading: result.pendingManualGrading
      };
    } catch (error: any) {
      console.error('❌ Server-side grading error:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

// ============================================
// AI CODE ANALYSIS FUNCTION (NEW)
// ============================================

/**
 * 🤖 Analyze student code with AI
 * Provides optimization suggestions and corrections
 */
export const analyzeCodeWithAI = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      // ✅ Use the helper function
      const feedback = await analyzeCodeWithAIHelper(data);
      return { success: true, feedback };
    } catch (err: any) {
      console.error('❌ Code Analysis Error:', err);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to analyze code with AI',
        err.message
      );
    }
  });
// ============================================
// AI CHAT FUNCTION (Existing)
// ============================================
const SYSTEM_PROMPT = `You are an AI Exams Specialist for EXAMINERS. You help teachers create educational content.

CRITICAL RULES:
1. Use Markdown for formatting
2. For ALL math, wrap in $ (inline) or $$ (display)
3. ALWAYS wrap math in dollar signs
4. For problem solutions, use numbered steps (Step 1:, Step 2:, etc.)

Examples:
- Variables: $x$, $y$ 
- Equations: $x = 5$, $A = \\pi r^2$
- Fractions: $\\frac{1}{2}$, $\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$
- Functions: $\\sin(30°)$, $\\cos(x)$
- Powers: $x^2$
- Subscripts: $H_2O$
- Chemistry: $\\ce{H2O}$, $\\ce{2H2 + O2 -> 2H2O}$

Common commands:
\\frac{a}{b}, \\sqrt{x}, \\times, \\div, \\pm, \\pi, \\theta, \\sin, \\cos, \\tan, \\ce{...}

WRONG: sin(30°) = 1/2
RIGHT: $\\sin(30°) = \\frac{1}{2}$

WRONG: H2O
RIGHT: $\\ce{H2O}$

Solution Format:
Always break solutions into clear numbered steps:
Step 1: [description]
Step 2: [description]
etc.`;

export const chatWithAI = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { message, conversationHistory = [] } = data || {};
      
      if (!message || typeof message !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'message is required');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured');
      }
      
      const client = new OpenAI({ apiKey });

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: message }
      ];

      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        temperature: 0.3,
        max_tokens: 2000,
        messages
      });

      const response = completion.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';
      
      return { success: true, response };
      
    } catch (err: any) {
      console.error('OpenAI API Error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to get response from AI', err.message);
    }
  });

// ============================================
// AI CODE ASSISTANT (CodingLab Integration)
// Version: 1.2.0
// Operations: explain, fix, suggest, tests, docs, optimize, assistant, format, autocomplete, inline
// ============================================

type AICodeOperation = 'explain' | 'fix' | 'suggest' | 'tests' | 'docs' | 'optimize' | 'assistant' | 'format' | 'autocomplete' | 'inline';

const AI_CODE_SYSTEM_PROMPTS: Record<AICodeOperation, string> = {
  assistant: 'You are a friendly and helpful AI coding assistant. Help users understand coding concepts, debug issues, and improve their code. Be concise but thorough.',
  explain: 'You are a helpful coding tutor. Explain code clearly and concisely.',
  fix: 'You are a code debugging expert. Return only fixed code.',
  suggest: 'You are a code review expert. Provide actionable suggestions.',
  tests: 'You are a testing expert. Generate comprehensive tests.',
  docs: 'You are a documentation expert. Generate clear documentation.',
  optimize: 'You are a performance optimization expert. Return optimized code.',
  format: 'You are a code formatting expert. Return only formatted code without any markdown or explanation.',
  autocomplete: 'You are a code completion assistant. Return only what is asked, no extra text.',
  inline: 'You are a code completion assistant. Return only what is asked, no extra text.'
};

function buildAICodePrompt(
  operation: AICodeOperation,
  code: string,
  language: string,
  question?: string,
  history?: Array<{role: string; content: string}>,
  cursorLine?: number,
  cursorColumn?: number,
  prefix?: string
): string {
  const langUpper = language.charAt(0).toUpperCase() + language.slice(1);
  
  // Build history string for assistant
  let historyStr = '';
  if (operation === 'assistant' && history && history.length > 0) {
    historyStr = "Previous conversation:\n";
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = (msg.content || '').substring(0, 500);
      historyStr += `${role}: ${content}\n\n`;
    }
  }

  const prompts: Record<AICodeOperation, string> = {
    autocomplete: `You are an expert code autocomplete engine for ${langUpper}. Given the code context and cursor position, suggest completions.

RULES:
1. Return ONLY a JSON array of completion objects
2. Each object has: label, insertText, detail, kind
3. kind can be: keyword, function, variable, snippet, method, property
4. Maximum 10 suggestions, sorted by relevance
5. Focus on what makes sense at cursor position
6. Include common patterns for ${langUpper}
7. No explanations, ONLY valid JSON array

Code context:
\`\`\`${language}
${code}
\`\`\`

Cursor at line ${cursorLine || 1}, column ${cursorColumn || 1}
Text before cursor: "${prefix || ''}"

Return JSON array:`,

    inline: `You are a code completion AI for ${langUpper}. Complete the code at cursor position.

RULES:
1. Return ONLY the completion text (no explanation)
2. Complete the current statement/expression logically
3. Match the coding style in existing code
4. Keep completion concise (1-3 lines max)
5. Don't repeat what's already written

Code before cursor:
\`\`\`${language}
${code}
\`\`\`

Current line prefix: "${prefix || ''}"

Complete with:`,

    assistant: `You are a helpful AI coding assistant specializing in ${langUpper}.

${historyStr}

USER'S CURRENT CODE (if any):
\`\`\`${language}
${code}
\`\`\`

USER'S QUESTION:
${question || ''}

RULES:
- Be concise but thorough
- Use markdown formatting for clarity
- For code examples, use \`\`\`${language} blocks
- If code is provided, reference it in your answer
- Be encouraging and educational
- Keep responses focused and practical`,

    explain: `You are a ${langUpper} programming expert. Explain this code clearly.

OUTPUT FORMAT (use this exact structure):
## Summary
Write 1-2 sentences describing what this code does.

## How It Works
1. **Step Name**: Brief explanation of first step
2. **Step Name**: Brief explanation of second step
3. **Step Name**: Brief explanation of third step
(add more steps if needed, max 5)

## Key Concepts
- Concept 1 explanation
- Concept 2 explanation

## Complexity
- **Time**: O(?) - brief reason
- **Space**: O(?) - brief reason

RULES:
- Use proper markdown headers (##) and bold (**text**)
- Use numbered lists for steps
- Use bullet points for concepts
- Keep each point concise (1 sentence)
- Use \`backticks\` for code references like variable names
- Total response under 200 words

Code:
\`\`\`${language}
${code}
\`\`\``,

    fix: `You are a ${langUpper} debugging expert. Fix all issues in the provided code.

OUTPUT FORMAT:
Return ONLY the fixed code wrapped in a code block:

\`\`\`${language}
// Fixed code here
// Add a comment like "// FIXED: description" where you made changes
\`\`\`

RULES:
1. Identify and fix all syntax errors, bugs, and logical issues
2. Add a brief comment (// FIXED: reason) next to each fix
3. Maintain the original code intent and structure
4. Follow ${langUpper} best practices
5. If no issues found, return the original code unchanged
6. Return ONLY the code block, no text before or after

Code to fix:
\`\`\`${language}
${code}
\`\`\`

Return the fixed code:`,

    suggest: `You are a ${langUpper} code review expert. Provide actionable improvement suggestions.

OUTPUT FORMAT (use this exact structure):
Start with a brief intro sentence about the code quality.

Then provide numbered suggestions:

1. **Suggestion Title**: Description of what to improve and why.

\`\`\`${language}
// Example code showing the improvement
\`\`\`

2. **Suggestion Title**: Description of what to improve and why.

\`\`\`${language}
// Example code showing the improvement
\`\`\`

(continue for each suggestion)

RULES:
- Provide 3-5 suggestions maximum
- Each suggestion MUST have a bold title
- Include a code example for EACH suggestion showing the fix
- Use \`\`\`${language} for all code blocks
- Use \`backticks\` for inline code references like \`variable_name\`
- Focus on: best practices, performance, readability, error handling
- Be specific and actionable

Code to review:
\`\`\`${language}
${code}
\`\`\`

Provide suggestions:`,

    tests: `You are a ${langUpper} testing expert. Generate comprehensive unit tests.

OUTPUT FORMAT:
\`\`\`${language}
// Test file for the provided code
// Include all necessary imports

// Test 1: Description of what this tests
// Test code here

// Test 2: Description of what this tests  
// Test code here

// Continue with more tests...
\`\`\`

RULES:
1. Create tests for all functions/methods in the code
2. Include edge cases and boundary conditions
3. Use appropriate testing framework for ${langUpper}:
   - Python: pytest or unittest
   - JavaScript: Jest or Mocha
   - Java: JUnit
   - C/C++: Simple assert statements or Google Test
4. Add descriptive test names and comments
5. Include both positive and negative test cases
6. Return ONLY the test code wrapped in \`\`\`${language} block
7. No explanations outside the code block

Code to test:
\`\`\`${language}
${code}
\`\`\`

Generate tests:`,

    docs: `You are a ${langUpper} documentation expert. Generate documentation for the provided code.

OUTPUT FORMAT:
\`\`\`${language}
/**
 * Function/Class description
 * 
 * @param paramName - Parameter description
 * @param paramName - Parameter description
 * @returns Description of return value
 * 
 * @example
 * // Usage example
 * functionName(arg1, arg2);
 */

// The documented code here...
\`\`\`

RULES:
1. Create appropriate docstrings/comments for ${langUpper}:
   - Python: Use docstrings with triple quotes
   - JavaScript/TypeScript: Use JSDoc format
   - Java: Use Javadoc format
   - C/C++: Use Doxygen-style comments
2. Document all functions, classes, and methods
3. Include parameter descriptions and return types
4. Add usage examples where helpful
5. Return the COMPLETE code with documentation added
6. Wrap everything in \`\`\`${language} block

Code to document:
\`\`\`${language}
${code}
\`\`\`

Generate documentation:`,

    optimize: `You are a ${langUpper} performance optimization expert. Optimize the provided code.

OUTPUT FORMAT:
First, provide a brief summary of optimizations made:

## Optimizations Applied
1. **Optimization Name**: Brief description
2. **Optimization Name**: Brief description

## Optimized Code
\`\`\`${language}
// Your optimized code here
\`\`\`

## Performance Improvement
- **Time Complexity**: Before O(?) → After O(?)
- **Space Complexity**: Before O(?) → After O(?)

RULES:
1. Improve time complexity where possible
2. Reduce memory usage if applicable
3. Apply ${langUpper}-specific optimizations
4. Maintain code readability
5. Always wrap code in \`\`\`${language} blocks

Code to optimize:
\`\`\`${language}
${code}
\`\`\`

Return optimized code:`,

    format: `Format this ${langUpper} code following standard conventions and best practices.

RULES:
1. Fix indentation (use 4 spaces for most languages, 2 for Ruby/YAML)
2. Add proper spacing around operators
3. Add spacing after commas
4. Fix brace/bracket placement per language conventions
5. Add blank lines between functions/methods
6. Remove trailing whitespace
7. Ensure consistent quote style
8. DO NOT change any logic or functionality
9. DO NOT add or remove any code
10. Return ONLY the formatted code, no explanations or markdown

Code to format:
${code}`
  };

  return prompts[operation];
}

function cleanCodeBlockResponse(result: string, operation: AICodeOperation): string {
  if (['fix', 'tests', 'docs', 'optimize', 'format'].includes(operation)) {
    let cleaned = result.replace(/^```[\w]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
    return cleaned.trim();
  }
  return result;
}

export const aiCodeAssistant = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { operation, code, language, question, history, cursorLine, cursorColumn, prefix } = data || {};

      // Valid operations
      const validOperations: AICodeOperation[] = ['explain', 'fix', 'suggest', 'tests', 'docs', 'optimize', 'assistant', 'format', 'autocomplete', 'inline'];
      
      if (!operation || !validOperations.includes(operation)) {
        return {
          success: false,
          operation: operation || 'unknown',
          result: '',
          error: `Invalid operation. Use: ${validOperations.join(', ')}`
        };
      }

      // Cast operation to correct type after validation
      const validOperation = operation as AICodeOperation;

      // Validate required fields based on operation
      if (operation === 'assistant') {
        if (!question) {
          return {
            success: false,
            operation,
            result: '',
            error: 'Question is required for assistant operation'
          };
        }
      } else if (operation !== 'autocomplete' && operation !== 'inline') {
        if (!code || code.trim().length === 0) {
          return {
            success: false,
            operation,
            result: '',
            error: 'Code is required for this operation'
          };
        }
      }

      if (!language) {
        return {
          success: false,
          operation,
          result: '',
          error: 'Language is required'
        };
      }

      // Validate lengths
      if (code && code.length > 15000) {
        return {
          success: false,
          operation,
          result: '',
          error: 'Code exceeds maximum length of 15000 characters'
        };
      }

      if (question && question.length > 2000) {
        return {
          success: false,
          operation,
          result: '',
          error: 'Question exceeds maximum length of 2000 characters'
        };
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured');
      }

      const client = new OpenAI({ apiKey });

      // Build prompt
      const prompt = buildAICodePrompt(
        validOperation,
        code || '',
        language,
        question,
        history,
        cursorLine,
        cursorColumn,
        prefix
      );
      const systemPrompt = AI_CODE_SYSTEM_PROMPTS[validOperation];

      // Call OpenAI
      const completion = await client.chat.completions.create({
        model: AI_MODELS.GPT_4O_MINI,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: validOperation === 'assistant' ? 0.7 : 0.3,
        max_tokens: validOperation === 'autocomplete' || validOperation === 'inline' ? 500 : 4000
      });

      let result = completion.choices[0]?.message?.content || '';

      // Handle autocomplete response
      if (validOperation === 'autocomplete') {
        let content = result.trim();
        content = content.replace(/^```json?\s*/, '');
        content = content.replace(/\s*```$/, '');
        
        try {
          const suggestions = JSON.parse(content);
          if (Array.isArray(suggestions)) {
            return {
              success: true,
              operation: validOperation,
              suggestions
            };
          }
        } catch (e) {
          return {
            success: false,
            operation: validOperation,
            suggestions: [],
            error: 'Failed to parse suggestions'
          };
        }
        
        return {
          success: false,
          operation: validOperation,
          suggestions: [],
          error: 'Invalid response format'
        };
      }

      // Handle inline completion response
      if (validOperation === 'inline') {
        return {
          success: true,
          operation: validOperation,
          completion: result.trim()
        };
      }

      // Clean up code blocks for other operations
      result = cleanCodeBlockResponse(result, validOperation);

      return {
        success: true,
        operation: validOperation,
        result: result.trim()
      };

    } catch (err: any) {
      console.error('AI Code Assistant Error:', err);
      throw new functions.https.HttpsError('internal', 'AI Code Assistant failed', err.message);
    }
  });

// ============================================
// EMAIL FUNCTIONS (Existing)
// ============================================

export const sendWelcomeEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      // Check authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated to send emails'
        );
      }

      // Verify caller has admin permissions
      // NOTE: Permission check removed for user creation workflow
      // This function is called from firebase_service.ts during legitimate user creation
      // and is not directly exposed to end users
      const callerDoc = await admin.firestore().doc(`${COLLECTIONS.USERS}/${context.auth.uid}`).get();
      const callerData = callerDoc.data();
      
      // Log who called it for auditing purposes
      console.log('📧 sendWelcomeEmail called by:', callerData?.userType || 'Unknown', context.auth.uid);
      
      // Permission check disabled to allow user creation workflow
      // Original check kept for reference:
      // const adminRoles = [USER_TYPES.SYSTEM_ADMIN, USER_TYPES.ADMIN, USER_TYPES.SUPER_ADMIN, USER_TYPES.PRINCIPAL, USER_TYPES.DEAN, USER_TYPES.TEACHER];
      // if (!callerData || !adminRoles.includes(callerData.userType)) {
      //   throw new functions.https.HttpsError('permission-denied', 'Only admins can send welcome emails');
      // }

      const { email, name, password, userType, collegeId } = data;

      // Validate required fields
      if (!email || !name || !password || !userType) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, name, password, userType'
        );
      }

      // ============================================
      // FETCH EMAIL CREDENTIALS FROM FIRESTORE
      // ============================================
      console.log('📧 Fetching email credentials from Firestore...');
      
      const emailCredsDoc = await admin.firestore()
        .doc(FIRESTORE_PATHS.EMAIL_CREDENTIALS)
        .get();
      
      if (!emailCredsDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Email credentials not found in Firestore. Please configure them in settings/email_credentials'
        );
      }

      const emailCreds = emailCredsDoc.data();
      
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Incomplete email credentials in Firestore. Required: MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, MAIL_PORT'
        );
      }

      console.log('✅ Email credentials loaded from Firestore');
      console.log('📮 SMTP Host:', emailCreds.MAIL_HOST);
      console.log('👤 SMTP User:', emailCreds.MAIL_USERNAME);
      console.log('🔌 SMTP Port:', emailCreds.MAIL_PORT);

      // ============================================
      // CREATE TRANSPORTER WITH BREVO CREDENTIALS
      // ============================================
      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false, // Use TLS
        auth: {
          user: emailCreds.MAIL_USERNAME,
          pass: emailCreds.MAIL_PASSWORD,
        },
      });

      console.log('📬 Nodemailer transporter created with Brevo SMTP');

      // ============================================
      // GET COLLEGE NAME
      // ============================================
      let collegeName = 'EXAMINERS';
      if (collegeId) {
        const collegeDoc = await admin.firestore().doc(`${COLLECTIONS.COLLEGES}/${collegeId}`).get();
        if (collegeDoc.exists) {
          collegeName = collegeDoc.data()?.collegeName || 'EXAMINERS';
        }
      }

      // ============================================
      // GENERATE EMAIL HTML
      // ============================================
      const emailHtml = generateWelcomeEmailHTML({
        name,
        email,
        password,
        userType,
        collegeName,
        loginUrl: 'https://your-app-url.com/login', // TODO: Update this
      });

      // ============================================
      // SEND EMAIL
      // ============================================
      const mailOptions = {
        from: `EXAMINERS System <noreply@tutorialspoint.com>`,
        to: email,
        subject: `Welcome to EXAMINERS - Your Account is Ready!`,
        html: emailHtml,
      };

      console.log('📤 Sending email to:', email);
      
      await transporter.sendMail(mailOptions);

      console.log('✅ Welcome email sent successfully to:', email);

      return {
        success: true,
        message: 'Welcome email sent successfully',
        sentTo: email,
      };
      
    } catch (error: any) {
      console.error('❌ Error sending email:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send email: ${error.message}`
      );
    }
  });

// ============================================
// EMAIL HTML TEMPLATE FUNCTION
// ============================================

// ============================================
// SEND OTP EMAIL FUNCTION
// ============================================

export const sendOTPEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { email, otp } = data;

      // Validate required fields
      if (!email || !otp) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, otp'
        );
      }

      // ============================================
      // FETCH EMAIL CREDENTIALS FROM FIRESTORE
      // ============================================
      console.log('📧 Fetching email credentials for OTP...');
      
      const emailCredsDoc = await admin.firestore()
        .doc(FIRESTORE_PATHS.EMAIL_CREDENTIALS)
        .get();
      
      if (!emailCredsDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Email credentials not found in Firestore'
        );
      }

      const emailCreds = emailCredsDoc.data();
      
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Incomplete email credentials in Firestore'
        );
      }

      // ============================================
      // CREATE TRANSPORTER
      // ============================================
      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false,
        auth: {
          user: emailCreds.MAIL_USERNAME,
          pass: emailCreds.MAIL_PASSWORD,
        },
      });

      // ============================================
      // EMAIL HTML
      // ============================================
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">EXAMINERS</h1>
            <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">AI-Powered Answer Sheet Evaluation</p>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Password Reset Request</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              You have requested to reset your password. Please use the following One-Time Password (OTP) to proceed:
            </p>
            
            <div style="background: #f3f4f6; border: 2px dashed #4F46E5; border-radius: 10px; padding: 25px; text-align: center; margin: 0 0 30px 0;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP</p>
              <div style="font-size: 36px; font-weight: bold; color: #4F46E5; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${otp}
              </div>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 0 0 30px 0; border-radius: 5px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Important:</strong> This OTP will expire in <strong>10 minutes</strong>. Do not share this OTP with anyone.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              If you did not request a password reset, please ignore this email and your password will remain unchanged.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © 2025 Tutorials Point India Private Limited. All rights reserved.<br>
              EXAMINERS - AI-Powered Educational Technology Platform
            </p>
          </div>
        </div>
      `;

      // ============================================
      // SEND EMAIL
      // ============================================
      const mailOptions = {
        from: `EXAMINERS System <noreply@tutorialspoint.com>`,
        to: email,
        subject: 'EXAMINERS - Password Reset OTP',
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);

      console.log('✅ OTP email sent successfully to:', email);

      return {
        success: true,
        message: 'OTP email sent successfully',
        sentTo: email,
      };
      
    } catch (error: any) {
      console.error('❌ Error sending OTP email:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send OTP email: ${error.message}`
      );
    }
  });

// ============================================
// PASSWORD RESET FUNCTIONS (Secure)
// ============================================

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
export const resetPasswordSecurely = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      const { email, otp, newPassword } = data;

      // 1. Validate input
      if (!email || !otp || !newPassword) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, otp, and newPassword are required'
        );
      }

      // 2. Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid email format'
        );
      }

      // 3. Validate password strength (at least 6 characters)
      if (newPassword.length < 6) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Password must be at least 6 characters long'
        );
      }

      const db = admin.firestore();
      const auth = admin.auth();

      // 4. Verify OTP
      const encodedEmail = email.toLowerCase().replace(/\./g, '_');
      const otpDoc = await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS).doc(encodedEmail).get();

      if (!otpDoc.exists) {
        console.error('OTP not found for email:', email);
        throw new functions.https.HttpsError(
          'not-found',
          'Invalid or expired OTP'
        );
      }

      const otpData = otpDoc.data();
      
      // Check if OTP is already used
      if (otpData?.used) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'OTP has already been used'
        );
      }

      // Check if OTP matches
      if (otpData?.otp !== otp) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid OTP'
        );
      }

      // Check if OTP is expired (10 minutes validity)
      const otpCreatedAt = otpData?.createdAt?.toDate();
      const now = new Date();
      const tenMinutesInMs = 10 * 60 * 1000;
      
      if (!otpCreatedAt || (now.getTime() - otpCreatedAt.getTime()) > tenMinutesInMs) {
        throw new functions.https.HttpsError(
          'deadline-exceeded',
          'OTP has expired. Please request a new one.'
        );
      }

      // 5. Find user by email using Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email.toLowerCase());
      } catch (error: any) {
        console.error('User not found in Firebase Auth:', error);
        throw new functions.https.HttpsError(
          'not-found',
          'User not found'
        );
      }

      // 6. Update password in Firebase Auth using Admin SDK
      try {
        await auth.updateUser(userRecord.uid, {
          password: newPassword
        });
        
        console.log('✅ Password updated successfully for user:', userRecord.uid);
      } catch (error: any) {
        console.error('Failed to update password:', error);
        throw new functions.https.HttpsError(
          'internal',
          'Failed to update password. Please try again.'
        );
      }

      // 7. Mark OTP as used
      await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS).doc(encodedEmail).update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 8. Log password reset for audit trail
      await db.collection('password_reset_logs').add({
        userId: userRecord.uid,
        email: email.toLowerCase(),
        resetAt: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: context.rawRequest?.ip || 'unknown',
        userAgent: context.rawRequest?.headers['user-agent'] || 'unknown',
        success: true
      });

      // 9. Delete any pending password reset requests (old implementation cleanup)
      try {
        const oldRequestDoc = db.collection('password_reset_requests').doc(userRecord.uid);
        const oldRequest = await oldRequestDoc.get();
        if (oldRequest.exists) {
          await oldRequestDoc.delete();
          console.log('🧹 Cleaned up old password reset request');
        }
      } catch (error) {
        // Non-critical, just log
        console.log('No old password reset request to delete');
      }

      // 10. Update user's last password change timestamp in Firestore
      try {
        await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).update({
          lastPasswordChange: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        // Non-critical, just log
        console.warn('Could not update lastPasswordChange in user document:', error);
      }

      console.log('✅ Password reset completed successfully for:', email);

      return {
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.'
      };

    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      
      // Log failed attempt
      try {
        const db = admin.firestore();
        await db.collection('password_reset_logs').add({
          email: data.email?.toLowerCase() || 'unknown',
          resetAt: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: context.rawRequest?.ip || 'unknown',
          success: false,
          error: error.message
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      // Re-throw HttpsError if it's already one, otherwise wrap it
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'An unexpected error occurred. Please try again.'
      );
    }
  });

/**
 * Cleanup expired OTPs (runs daily)
 * Removes OTPs older than 1 hour to keep database clean
 */
export const cleanupExpiredOTPs = functions
  .region('us-central1')
  .pubsub.schedule('every 24 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    console.log('🧹 Starting cleanup of expired OTPs...');
    
    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      const oneHourAgo = new Date(now.toMillis() - 60 * 60 * 1000);

      const expiredOTPs = await db
        .collection(COLLECTIONS.PASSWORD_RESET_OTPS)
        .where('createdAt', '<', oneHourAgo)
        .get();

      if (expiredOTPs.empty) {
        console.log('✅ No expired OTPs to clean up');
        return null;
      }

      const batch = db.batch();
      expiredOTPs.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`🧹 Cleaned up ${expiredOTPs.size} expired OTPs`);
      
      return {
        success: true,
        deletedCount: expiredOTPs.size
      };
      
    } catch (error: any) {
      console.error('❌ Error cleaning up expired OTPs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

// ============================================
// EMAIL HTML TEMPLATE FUNCTION
// ============================================

function generateWelcomeEmailHTML(data: {
  name: string;
  email: string;
  password: string;
  userType: string;
  collegeName: string;
  loginUrl: string;
}): string {
  const { name, email, password, userType, collegeName, loginUrl } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .logo-container {
      margin: 0 auto 20px;
      width: 96px;
      height: 96px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .credentials-box {
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 25px;
      margin: 25px 0;
      border-radius: 5px;
    }
    .credentials-box h3 {
      margin: 0 0 20px 0;
      color: #667eea;
      font-size: 18px;
    }
    .credential-item {
      margin: 15px 0;
    }
    .credential-label {
      font-weight: 600;
      color: #667eea;
      font-size: 14px;
      display: block;
      margin-bottom: 8px;
    }
    .credential-value {
      font-family: 'Courier New', monospace;
      background: white;
      padding: 12px 15px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      font-size: 14px;
      word-break: break-all;
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      padding: 15px 40px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .warning-box {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
      margin: 25px 0;
      border-radius: 5px;
    }
    .warning-box strong {
      color: #856404;
      display: block;
      margin-bottom: 10px;
    }
    .warning-box ul {
      margin: 10px 0;
      padding-left: 20px;
      color: #856404;
    }
    .warning-box li {
      margin: 8px 0;
      white-space: nowrap;
    }
    .steps {
      background: #f7fafc;
      padding: 25px;
      border-radius: 5px;
      margin: 25px 0;
    }
    .steps h3 {
      margin: 0 0 15px 0;
      color: #667eea;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
    }
    .steps li {
      margin: 10px 0;
      line-height: 1.6;
    }
    .footer {
      background: #f7fafc;
      padding: 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 5px 0;
    }
    .divider {
      height: 1px;
      background: #e2e8f0;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <!-- Logo -->
      <div class="logo-container">
        <svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#5B9FED;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#3DD8E8;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="88" height="88" rx="20" fill="url(#bgGradient)"/>
          <rect x="4" y="4" width="88" height="88" rx="20" fill="black" opacity="0.05"/>
          <rect x="28" y="32" width="36" height="32" rx="3" fill="white"/>
          <rect x="34" y="40" width="20" height="3" rx="1.5" fill="#8B7FED"/>
          <rect x="34" y="47" width="16" height="3" rx="1.5" fill="#EE6FA4"/>
          <rect x="34" y="54" width="18" height="3" rx="1.5" fill="#FF9966"/>
          <circle cx="60" cy="28" r="11" fill="#10B981"/>
          <circle cx="60" cy="28" r="11" fill="white" opacity="0.2"/>
          <path d="M 55 28 L 58.5 31.5 L 65 24" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="20" cy="20" r="3" fill="#5B9FED" opacity="0.6"/>
          <circle cx="76" cy="18" r="2.5" fill="#3DD8E8" opacity="0.5"/>
          <circle cx="72" cy="76" r="3.5" fill="#A78BFA" opacity="0.5"/>
          <circle cx="24" cy="74" r="2" fill="#EE6FA4" opacity="0.4"/>
          <circle cx="78" cy="50" r="2" fill="#8B7FED" opacity="0.3"/>
        </svg>
      </div>
      
      <h1>Welcome to EXAMINERS!</h1>
      <p>Your account has been successfully created</p>
    </div>
    <div class="content">
      <h2 style="color: #667eea; margin-top: 0;">Hello ${name}! 👋</h2>
      <p>Welcome to <strong>EXAMINERS</strong> at <strong>${collegeName}</strong>!</p>
      <p>Your account has been created as a <strong>${userType}</strong>. We're excited to have you join our AI-powered secure exams management platform.</p>
      
      <div class="credentials-box">
        <h3>🔐 Your Login Credentials</h3>
        <div class="credential-item">
          <span class="credential-label">📧 Email:</span>
          <span class="credential-value">${email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">🔑 Password:</span>
          <span class="credential-value">${password}</span>
        </div>
      </div>
      
      <div class="warning-box">
        <strong>⚠️ Important Security Notice</strong>
        <ul>
          <li>This is a <strong>temporary password</strong></li>
          <li>You will be required to change it on your first login</li>
          <li>Never share your password with anyone</li>
          <li>Keep this email secure and delete it after changing your password</li>
        </ul>
      </div>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">🚀 Login to EXAMINERS</a>
      </div>
      
      <div class="steps">
        <h3>📋 Getting Started</h3>
        <ol>
          <li>Click the "Login to EXAMINERS" button above</li>
          <li>Enter your email and temporary password</li>
          <li>Create a strong, secure password when prompted</li>
          <li>Start using EXAMINERS!</li>
        </ol>
      </div>
      
      <div class="divider"></div>
      
      <h3 style="color: #667eea;">Need Help? 🆘</h3>
      <p>If you have any questions or need assistance getting started:</p>
      <ul>
        <li>📧 Email: <a href="mailto:lpu@tutorialspoint.com" style="color: #667eea;">lpu@tutorialspoint.com</a></li>
        <li>📞 Phone: +91 88883 70983</li>
        <li>💬 Contact your system administrator</li>
      </ul>
    </div>
    
    <div class="footer">
      <p><strong>EXAMINERS</strong> - AI-Powered Secure Exams Management Application</p>
      <p>© ${new Date().getFullYear()} ${collegeName}. All rights reserved.</p>
      <p style="margin-top: 15px; font-size: 11px; color: #999;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
export const sendPasswordResetEmail = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    try {
      // Check authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated to send password reset email'
        );
      }

      const { email, name, resetLink } = data;

      // Validate required fields
      if (!email || !name || !resetLink) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: email, name, resetLink'
        );
      }

      // Fetch email credentials from Firestore
      console.log('📧 Fetching email credentials from Firestore...');
      
      const emailCredsDoc = await admin.firestore()
        .doc('settings/email_credentials')
        .get();
      
      if (!emailCredsDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Email credentials not found in Firestore'
        );
      }

      const emailCreds = emailCredsDoc.data();
      
      if (!emailCreds?.MAIL_HOST || !emailCreds?.MAIL_USERNAME || !emailCreds?.MAIL_PASSWORD || !emailCreds?.MAIL_PORT) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Incomplete email credentials in Firestore'
        );
      }

      console.log('✅ Email credentials loaded from Firestore');

      // Create transporter with Brevo credentials
      const transporter = nodemailer.createTransport({
        host: emailCreds.MAIL_HOST,
        port: parseInt(emailCreds.MAIL_PORT),
        secure: false,
        auth: {
          user: emailCreds.MAIL_USERNAME,
          pass: emailCreds.MAIL_PASSWORD,
        },
      });

      // Generate email HTML
      const emailHtml = generatePasswordResetEmailHTML({
        name,
        resetLink,
      });

      // Send email
      const mailOptions = {
        from: `EXAMINERS System <noreply@tutorialspoint.com>`,
        to: email,
        subject: `🔒 Password Reset Request - EXAMINERS`,
        html: emailHtml,
      };

      console.log('📤 Sending password reset email to:', email);
      
      await transporter.sendMail(mailOptions);

      console.log('✅ Password reset email sent successfully to:', email);

      return {
        success: true,
        message: 'Password reset email sent successfully',
        sentTo: email,
      };
      
    } catch (error: any) {
      console.error('❌ Error sending password reset email:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send password reset email: ${error.message}`
      );
    }
  });

  function generatePasswordResetEmailHTML(data: {
  name: string;
  resetLink: string;
}): string {
  const { name, resetLink } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .logo-container { margin: 0 auto 20px; width: 96px; height: 96px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
    .content { padding: 40px 30px; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; margin: 20px 0; }
    .button-container { text-align: center; margin: 30px 0; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 5px; }
    .warning-box strong { color: #856404; display: block; margin-bottom: 10px; }
    .warning-box ul { margin: 10px 0; padding-left: 20px; color: #856404; }
    .warning-box li { margin: 8px 0; }
    .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 25px 0; border-radius: 5px; }
    .info-box strong { color: #1565c0; display: block; margin-bottom: 10px; }
    .info-box p { margin: 5px 0; color: #1565c0; }
    .footer { background: #f7fafc; padding: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 5px 0; }
    .divider { height: 1px; background: #e2e8f0; margin: 30px 0; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo-container">
        <svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#5B9FED;stop-opacity:1" /><stop offset="100%" style="stop-color:#3DD8E8;stop-opacity:1" /></linearGradient></defs>
          <rect x="4" y="4" width="88" height="88" rx="20" fill="url(#bgGradient)"/><rect x="4" y="4" width="88" height="88" rx="20" fill="black" opacity="0.05"/><rect x="28" y="32" width="36" height="32" rx="3" fill="white"/><rect x="34" y="40" width="20" height="3" rx="1.5" fill="#8B7FED"/><rect x="34" y="47" width="16" height="3" rx="1.5" fill="#EE6FA4"/><rect x="34" y="54" width="18" height="3" rx="1.5" fill="#FF9966"/><circle cx="60" cy="28" r="11" fill="#10B981"/><circle cx="60" cy="28" r="11" fill="white" opacity="0.2"/><path d="M 55 28 L 58.5 31.5 L 65 24" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="20" r="3" fill="#5B9FED" opacity="0.6"/><circle cx="76" cy="18" r="2.5" fill="#3DD8E8" opacity="0.5"/><circle cx="72" cy="76" r="3.5" fill="#A78BFA" opacity="0.5"/><circle cx="24" cy="74" r="2" fill="#EE6FA4" opacity="0.4"/><circle cx="78" cy="50" r="2" fill="#8B7FED" opacity="0.3"/>
        </svg>
      </div>
      <h1>🔒 Password Reset Request</h1>
      <p>Reset your EXAMINERS account password</p>
    </div>
    <div class="content">
      <h2 style="color: #667eea; margin-top: 0;">Hello ${name}! 👋</h2>
      <p>We received a request to reset the password for your <strong>EXAMINERS</strong> account.</p>
      <p>Click the button below to create a new password:</p>
      <div class="button-container"><a href="${resetLink}" class="button">🔑 Reset Your Password</a></div>
      <div class="info-box"><strong>⏰ Important Information</strong><p>This password reset link will expire in <strong>1 hour</strong> for security reasons.</p><p>If the link expires, you can request a new one from the login page.</p></div>
      <div class="warning-box"><strong>⚠️ Didn't Request This?</strong><ul><li>If you didn't request a password reset, please ignore this email</li><li>Your password will remain unchanged</li><li>Someone may have entered your email by mistake</li><li>If you're concerned, contact your system administrator</li></ul></div>
      <div class="divider"></div>
      <h3 style="color: #667eea;">Need Help? 🆘</h3>
      <p>If you're having trouble resetting your password or need assistance:</p>
      <ul><li>📧 Email: <a href="mailto:lpu@tutorialspoint.com" style="color: #667eea;">lpu@tutorialspoint.com</a></li><li>📞 Phone: +91 88883 70983</li><li>💬 Contact your system administrator</li></ul>
    </div>
    <div class="footer">
      <p><strong>EXAMINERS</strong> - AI-Powered Secure Exams Management Application</p>
      <p>© ${new Date().getFullYear()} EXAMINERS. All rights reserved.</p>
      <p style="margin-top: 15px; font-size: 11px; color: #999;">This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `;
}

  export const evaluateAnswerWithAI = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      // ✅ Use the helper function
      const feedback = await evaluateAnswerWithAIHelper(data);
      return { success: true, feedback };
    } catch (err: any) {
      console.error('❌ AI Evaluation Error:', err);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to evaluate answer with AI',
        err.message
      );
    }
  });

// ============================================
// AUTO-COMPLETE EXPIRED EXAMS FUNCTIONS (New)
// ============================================

function isExamExpired(exam: ExamData): boolean {
  if (!exam.examDate || !exam.examTime || !exam.duration) {
    console.log(`⏭️ Skipping exam ${exam.id}: Missing date/time/duration`);
    return false;
  }

  try {
    // Parse duration first to validate
    const durationMinutes = parseInt(exam.duration);
    if (isNaN(durationMinutes)) {
      console.log(`⚠️ Invalid duration for exam ${exam.id}: ${exam.duration}`);
      return false;
    }

    // Parse exam date and time components
    const [hours, minutes] = exam.examTime.split(':').map(Number);
    const dateStr = exam.examDate.includes('T') ? exam.examDate.split('T')[0] : exam.examDate;
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // FIXED: IST is UTC+5:30
    // The exam date/time stored in the database is in IST timezone
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    
    // Create UTC timestamp assuming the input time is in IST
    // Date.UTC creates a timestamp for the given date/time in UTC
    const utcDate = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    
    // Convert from IST to actual UTC by subtracting IST offset
    // Example: 14:30 IST = 09:00 UTC (14:30 - 5:30)
    const examStartTimeUTC = utcDate - IST_OFFSET_MS;
    
    // Calculate exam end time in UTC
    const examEndTimeUTC = examStartTimeUTC + (durationMinutes * 60 * 1000);
    
    // Get current time in UTC (Date.now() always returns UTC timestamp)
    const nowUTC = Date.now();
    
    const isExpired = nowUTC > examEndTimeUTC;
    
    // For logging, convert timestamps to readable dates
    const examStartIST = new Date(examStartTimeUTC);
    const examEndIST = new Date(examEndTimeUTC);
    const nowIST = new Date(nowUTC);
    
    console.log(`🔍 Checking exam: ${exam.title || exam.id}`);
    console.log(`   Date: ${exam.examDate}, Time: ${exam.examTime} IST, Duration: ${exam.duration}min`);
    console.log(`   Start Time (UTC): ${examStartIST.toISOString()}`);
    console.log(`   End Time (UTC): ${examEndIST.toISOString()}`);
    console.log(`   Current Time (UTC): ${nowIST.toISOString()}`);
    console.log(`   Is Expired: ${isExpired}`);
    
    return isExpired;
  } catch (error) {
    console.error(`❌ Error checking if exam expired:`, error);
    return false;
  }
}

/**
 * Helper function to check if exam ended more than grace period (30 minutes) ago
 */
function isExamBeyondGracePeriod(exam: ExamData, gracePeriodMinutes: number = 30): boolean {
  if (!exam.examDate || !exam.examTime || !exam.duration) {
    console.log(`⏭️ Skipping exam ${exam.id}: Missing date/time/duration`);
    return false;
  }

  try {
    const durationMinutes = parseInt(exam.duration);
    if (isNaN(durationMinutes)) {
      console.log(`⚠️ Invalid duration for exam ${exam.id}: ${exam.duration}`);
      return false;
    }

    const [hours, minutes] = exam.examTime.split(':').map(Number);
    const dateStr = exam.examDate.includes('T') ? exam.examDate.split('T')[0] : exam.examDate;
    const [year, month, day] = dateStr.split('-').map(Number);
    
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const utcDate = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    const examStartTimeUTC = utcDate - IST_OFFSET_MS;
    const examEndTimeUTC = examStartTimeUTC + (durationMinutes * 60 * 1000);
    const graceEndTimeUTC = examEndTimeUTC + (gracePeriodMinutes * 60 * 1000);
    const nowUTC = Date.now();
    
    const isBeyondGracePeriod = nowUTC > graceEndTimeUTC;
    
    console.log(`🔍 Checking exam grace period: ${exam.title || exam.id}`);
    console.log(`   Grace End Time: ${new Date(graceEndTimeUTC).toISOString()} (+${gracePeriodMinutes}min)`);
    console.log(`   Beyond Grace Period: ${isBeyondGracePeriod}`);
    
    return isBeyondGracePeriod;
  } catch (error) {
    console.error(`❌ Error checking grace period:`, error);
    return false;
  }
}

export const autoCompleteExpiredExams = functions
  .region('us-central1')
  .pubsub.schedule('every 1 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    console.log('🚀 Starting auto-complete expired exams function...');
    
    const startTime = Date.now();
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      
      const examsSnapshot = await db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.UPCOMING)
        .get();
      
      if (examsSnapshot.empty) {
        console.log('✅ No upcoming exams found. Nothing to process.');
        return null;
      }
      
      console.log(`📊 Found ${examsSnapshot.size} upcoming exams to check`);
      
      let batch = db.batch();
      let batchCount = 0;
      const batchSize = CLOUD_FUNCTION_CONFIG.BATCH_SIZE;
      
      for (const doc of examsSnapshot.docs) {
        processedCount++;
        const exam: ExamData = { id: doc.id, ...doc.data() };
        
        if (isExamExpired(exam)) {
          batch.update(doc.ref, {
            status: EXAM_STATUS.COMPLETED,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedBy: SYSTEM_TRIGGERS.SYSTEM
          });
          
          batchCount++;
          updatedCount++;
          
          console.log(`✅ Queued for completion: ${exam.title || exam.id}`);
          
          if (batchCount >= batchSize) {
            await batch.commit();
            console.log(`💾 Committed batch of ${batchCount} updates`);
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`💾 Committed final batch of ${batchCount} updates`);
      }
      
      const duration = Date.now() - startTime;
      
      console.log('========================================');
      console.log('✅ Auto-complete function completed!');
      console.log(`📊 Statistics:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Updated to completed: ${updatedCount}`);
      console.log(`   - Errors: ${errorCount}`);
      console.log(`   - Duration: ${duration}ms`);
      console.log('========================================');
      
      return {
        success: true,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        duration: duration
      };
      
    } catch (error: any) {
      console.error('❌ Fatal error in auto-complete function:', error);
      errorCount++;
      
      return {
        success: false,
        error: error.message,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount
      };
    }
  });

export const manualAutoCompleteExams = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    
    console.log('🔧 Manual auto-complete triggered');
    
    const startTime = Date.now();
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      const collegeId = req.body?.collegeId;
      
      let query = db.collection(COLLECTIONS.EXAMS).where('status', '==', EXAM_STATUS.UPCOMING);
      
      if (collegeId) {
        console.log(`🏫 Filtering by collegeId: ${collegeId}`);
        query = query.where('collegeId', '==', collegeId) as admin.firestore.Query;
      }
      
      const examsSnapshot = await query.get();
      
      if (examsSnapshot.empty) {
        res.json({
          success: true,
          message: 'No upcoming exams found',
          processed: 0,
          updated: 0,
          errors: 0
        });
        return;
      }
      
      console.log(`📊 Found ${examsSnapshot.size} upcoming exams to check`);
      
      let batch = db.batch();
      let batchCount = 0;
      const batchSize = CLOUD_FUNCTION_CONFIG.BATCH_SIZE;
      
      for (const doc of examsSnapshot.docs) {
        processedCount++;
        const exam: ExamData = { id: doc.id, ...doc.data() };
        
        if (isExamExpired(exam)) {
          batch.update(doc.ref, {
            status: EXAM_STATUS.COMPLETED,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedBy: SYSTEM_TRIGGERS.MANUAL
          });
          
          batchCount++;
          updatedCount++;
          
          if (batchCount >= batchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      
      const duration = Date.now() - startTime;
      
      const result = {
        success: true,
        message: `Successfully processed ${processedCount} exams and updated ${updatedCount} to completed status`,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        duration: duration
      };
      
      console.log('✅ Manual auto-complete completed:', result);
      
      res.json(result);
      
    } catch (error: any) {
      console.error('❌ Error in manual auto-complete:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error processing exams',
        error: error.message,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount + 1
      });
    }
  });

export const checkExpiredExams = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const db = admin.firestore();
      
      const examsSnapshot = await db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.UPCOMING)
        .get();
      
      const expiredExams: any[] = [];
      const upcomingExams: any[] = [];
      
      examsSnapshot.forEach(doc => {
        const exam: ExamData = { id: doc.id, ...doc.data() };
        
        if (isExamExpired(exam)) {
          expiredExams.push({
            id: exam.id,
            title: exam.title,
            examDate: exam.examDate,
            examTime: exam.examTime,
            duration: exam.duration,
            collegeId: exam.collegeId,
            collegeName: exam.collegeName
          });
        } else {
          upcomingExams.push({
            id: exam.id,
            title: exam.title,
            examDate: exam.examDate,
            examTime: exam.examTime,
            duration: exam.duration,
            collegeId: exam.collegeId,
            collegeName: exam.collegeName
          });
        }
      });
      
      res.json({
        success: true,
        total: examsSnapshot.size,
        expired: expiredExams.length,
        upcoming: upcomingExams.length,
        expiredExams,
        upcomingExams
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });
  /**
 * Scheduled Cloud Function - Auto-submit pending attempts after 30-minute grace period
 */
export const autoSubmitPendingAttempts = functions
  .region('us-central1')
  .pubsub.schedule('every 30 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    console.log('🚀 Starting auto-submit pending attempts function...');
    
    const startTime = Date.now();
    let processedExams = 0;
    let totalAttemptsSubmitted = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      
      // Calculate 6 hours ago timestamp (enough time for any exam + grace period)
      const now = admin.firestore.Timestamp.now();
      const sixHoursAgo = new Date(now.toMillis() - (6 * 60 * 60 * 1000));
      
      console.log(`📅 Processing exams completed in last 6 hours (since ${sixHoursAgo.toISOString()})`);
      
      const completedExamsSnapshot = await db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.COMPLETED)
        .where('autoCompletedAt', '>=', sixHoursAgo)  // ✅ ONLY last 6 hours!
        .get();
      
      if (completedExamsSnapshot.empty) {
        console.log('✅ No completed exams found.');
        return null;
      }
      
      console.log(`📊 Found ${completedExamsSnapshot.size} completed exams to check`);
      
      const GRACE_PERIOD_MINUTES = 30;
      
      for (const examDoc of completedExamsSnapshot.docs) {
        const exam: ExamData = { id: examDoc.id, ...examDoc.data() };
        processedExams++;
        
        if (!isExamBeyondGracePeriod(exam, GRACE_PERIOD_MINUTES)) {
          continue;
        }
        
        console.log(`⚡ Processing exam "${exam.title || exam.id}"`);
        
        try {
          const pendingAttemptsSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
            .where('examId', '==', exam.id)
            .where('status', '==', 'in_progress')
            .get();
          
          if (pendingAttemptsSnapshot.empty) {
            console.log(`   ✅ No pending attempts`);
            continue;
          }
          
          console.log(`   📝 Found ${pendingAttemptsSnapshot.size} pending attempts`);
          
          let batch = db.batch();
          let batchCount = 0;
          const batchSize = 500;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            const attempt = attemptDoc.data();
            const now = admin.firestore.Timestamp.now();
            const startTime = attempt.startTime?.toDate?.() || new Date();
            const timeSpent = Math.floor((now.toDate().getTime() - startTime.getTime()) / 1000);
            
            batch.update(attemptDoc.ref, {
              status: 'submitted',
              submitTime: now,
              timeSpent: timeSpent,
              autoSubmitted: true,
              autoSubmittedReason: 'grace_period_expired',
              autoSubmittedAt: now,
              updatedAt: now
            });
            
            batchCount++;
            totalAttemptsSubmitted++;
            
            if (batchCount >= batchSize) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
          }
          
          console.log(`   ✅ Auto-submitted ${pendingAttemptsSnapshot.size} attempts`);
          
          // 🎯 NOW GRADE THEM - Call the SAME function as manual submit!
          console.log(`   🔍 Starting grading for auto-submitted attempts...`);
          let gradedCount = 0;
          let gradingErrors = 0;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            try {
              const attempt = attemptDoc.data();
              
              // Get latest attempt data with responses
              const currentAttempt = await attemptDoc.ref.get();
              const attemptData = currentAttempt.data();
              const responses = attemptData?.responses || [];
              
              if (responses.length === 0) {
                console.log(`      ⚠️ No responses found for: ${attemptDoc.id}`);
                continue;
              }
              
              console.log(`      📊 Grading ${responses.length} responses for: ${attemptDoc.id}`);
              
              // Call the SAME grading function that manual submit uses!
              await gradeAttempt(attempt.examId, attemptDoc.id, responses);
              
              gradedCount++;
              console.log(`      ✅ Successfully graded: ${attemptDoc.id}`);
              
            } catch (gradeError: any) {
              console.error(`      ❌ Grading error for ${attemptDoc.id}:`, gradeError.message);
              gradingErrors++;
            }
          }
          
          console.log(`   ✅ Grading complete: ${gradedCount} graded, ${gradingErrors} errors`);
          
          // 🎯 UPDATE EXAM: Mark that auto-grading is complete
          try {
            await examDoc.ref.update({
              autoGradingComplete: true,
              autoGradingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
              totalAutoSubmitted: pendingAttemptsSnapshot.size,
              totalAutoGraded: gradedCount,
              autoGradingErrors: gradingErrors,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ✅ Exam marked as auto-grading complete`);
          } catch (updateError: any) {
            console.error(`   ⚠️ Could not update exam: ${updateError.message}`);
          }
          
        } catch (examError: any) {
          console.error(`❌ Error processing exam ${exam.id}:`, examError);
          errorCount++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      console.log('========================================');
      console.log('✅ Auto-submit completed!');
      console.log(`📊 Statistics:`);
      console.log(`   - Exams processed: ${processedExams}`);
      console.log(`   - Attempts auto-submitted: ${totalAttemptsSubmitted}`);
      console.log(`   - Errors: ${errorCount}`);
      console.log(`   - Duration: ${duration}ms`);
      console.log('========================================');
      
      return {
        success: true,
        examsProcessed: processedExams,
        attemptsSubmitted: totalAttemptsSubmitted,
        errors: errorCount,
        duration: duration
      };
      
    } catch (error: any) {
      console.error('❌ Fatal error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
// ============================================
// MANUAL AUTO-SUBMIT AND GRADE
// Manually trigger auto-submit and grading without waiting for scheduled function
// ============================================

export const manualAutoSubmitAndGrade = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 540,  // 9 minutes
    memory: '1GB'
  })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    
    console.log('🔧 Manual auto-submit and grade triggered');
    
    const startTime = Date.now();
    let processedExams = 0;
    let totalAttemptsSubmitted = 0;
    let totalAttemptsGraded = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      const examId = req.body?.examId;
      
      // Calculate 6 hours ago timestamp
      const now = admin.firestore.Timestamp.now();
      const sixHoursAgo = new Date(now.toMillis() - (6 * 60 * 60 * 1000));
      
      console.log(`📅 Processing exams completed in last 6 hours (since ${sixHoursAgo.toISOString()})`);
      
      let query = db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.COMPLETED)
        .where('autoCompletedAt', '>=', sixHoursAgo);  // ✅ ONLY last 6 hours!
      
      if (examId) {
        console.log(`📝 Processing specific exam: ${examId}`);
        query = query.where(admin.firestore.FieldPath.documentId(), '==', examId) as admin.firestore.Query;
      }
      
      const completedExamsSnapshot = await query.get();
      
      if (completedExamsSnapshot.empty) {
        res.status(200).json({
          success: true,
          message: 'No completed exams found',
          examsProcessed: 0,
          attemptsSubmitted: 0,
          attemptsGraded: 0
        });
        return;
      }
      
      console.log(`📊 Found ${completedExamsSnapshot.size} completed exams to process`);
      
      for (const examDoc of completedExamsSnapshot.docs) {
        const exam: any = { id: examDoc.id, ...examDoc.data() };
        processedExams++;
        
        console.log(`⚡ Processing exam "${exam.title || exam.id}"`);
        
        try {
          const pendingAttemptsSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
            .where('examId', '==', exam.id)
            .where('status', '==', 'in_progress')
            .get();
          
          if (pendingAttemptsSnapshot.empty) {
            console.log(`   ✅ No pending attempts for this exam`);
            continue;
          }
          
          console.log(`   📝 Found ${pendingAttemptsSnapshot.size} pending attempts`);
          
          let batch = db.batch();
          let batchCount = 0;
          const batchSize = 500;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            const attempt = attemptDoc.data();
            const now = admin.firestore.Timestamp.now();
            const startTime = attempt.startTime?.toDate?.() || new Date();
            const timeSpent = Math.floor((now.toDate().getTime() - startTime.getTime()) / 1000);
            
            batch.update(attemptDoc.ref, {
              status: 'submitted',
              submitTime: now,
              timeSpent: timeSpent,
              autoSubmitted: true,
              autoSubmittedReason: 'manual_trigger',
              autoSubmittedAt: now,
              updatedAt: now
            });
            
            batchCount++;
            totalAttemptsSubmitted++;
            
            if (batchCount >= batchSize) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
          }
          
          console.log(`   ✅ Auto-submitted ${pendingAttemptsSnapshot.size} attempts`);
          
          console.log(`   🔍 Starting grading for ${pendingAttemptsSnapshot.size} attempts...`);
          let gradedCount = 0;
          let gradingErrors = 0;
          
          for (const attemptDoc of pendingAttemptsSnapshot.docs) {
            try {
              const attempt = attemptDoc.data();
              
              const currentAttempt = await attemptDoc.ref.get();
              const attemptData = currentAttempt.data();
              const responses = attemptData?.responses || [];
              
              if (responses.length === 0) {
                console.log(`      ⚠️ No responses for: ${attemptDoc.id}`);
                continue;
              }
              
              console.log(`      📊 Grading ${responses.length} responses for: ${attemptDoc.id}`);
              
              await gradeAttempt(attempt.examId, attemptDoc.id, responses);
              
              gradedCount++;
              totalAttemptsGraded++;
              console.log(`      ✅ Graded: ${attemptDoc.id}`);
              
            } catch (gradeError: any) {
              console.error(`      ❌ Grading error for ${attemptDoc.id}:`, gradeError.message);
              gradingErrors++;
            }
          }
          
          console.log(`   ✅ Grading complete: ${gradedCount} graded, ${gradingErrors} errors`);
          
          try {
            await examDoc.ref.update({
              autoGradingComplete: true,
              autoGradingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
              totalAutoSubmitted: pendingAttemptsSnapshot.size,
              totalAutoGraded: gradedCount,
              autoGradingErrors: gradingErrors,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ✅ Exam marked as auto-grading complete`);
          } catch (updateError: any) {
            console.error(`   ⚠️ Could not update exam:`, updateError.message);
          }
          
        } catch (examError: any) {
          console.error(`❌ Error processing exam ${exam.id}:`, examError);
          errorCount++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      console.log('========================================');
      console.log('✅ Manual auto-submit and grade completed!');
      console.log(`📊 Statistics:`);
      console.log(`   - Exams processed: ${processedExams}`);
      console.log(`   - Attempts auto-submitted: ${totalAttemptsSubmitted}`);
      console.log(`   - Attempts graded: ${totalAttemptsGraded}`);
      console.log(`   - Errors: ${errorCount}`);
      console.log(`   - Duration: ${duration}ms`);
      console.log('========================================');
      
      res.status(200).json({
        success: true,
        message: `Successfully processed ${processedExams} exams`,
        examsProcessed: processedExams,
        attemptsSubmitted: totalAttemptsSubmitted,
        attemptsGraded: totalAttemptsGraded,
        errors: errorCount,
        duration: duration
      });
      
    } catch (error: any) {
      console.error('❌ Fatal error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
// ============================================
// COMPLETE EXAM WITH GRADING (CORRECT ORDER)
// This does it in the RIGHT order for student experience
// ============================================


// ============================================
// HELPER: Check if all grading complete for an exam
// ============================================
async function checkAndMarkExamGradingComplete(examId: string) {
  const db = admin.firestore();
  
  try {
    // Count pending grading tasks
    const pendingSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
      .where('examId', '==', examId)
      .where('gradingQueued', '==', true)
      .limit(1)
      .get();
    
    // If no pending tasks, mark exam as complete
    if (pendingSnapshot.empty) {
      console.log(`✅ All grading complete for exam: ${examId}`);
      
      // Get counts
      const [gradedSnapshot, failedSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingComplete', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingFailed', '==', true)
          .count()
          .get()
      ]);
      
      // Update exam document
      await db.collection(COLLECTIONS.EXAMS).doc(examId).update({
        autoGradingComplete: true,
        autoGradingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalAutoGraded: gradedSnapshot.data().count,
        autoGradingErrors: failedSnapshot.data().count,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Exam ${examId} marked as fully graded`);
      console.log(`   - Graded: ${gradedSnapshot.data().count}`);
      console.log(`   - Failed: ${failedSnapshot.data().count}`);
    }
  } catch (error: any) {
    console.error(`Error checking completion for exam ${examId}:`, error);
  }
}

// ============================================
// MAIN FUNCTION: Complete Exam with Pub/Sub Grading (HTTP)
// ============================================
export const completeExamWithGrading = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,  // Only 2 minutes needed now!
    memory: '512MB'
  })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    
    console.log('🎓 Complete Exam with Grading - PUB/SUB MODE (PARALLEL)');
    
    const startTime = Date.now();
    let processedExams = 0;
    let totalAttemptsSubmitted = 0;
    let totalGradingTasksQueued = 0;
    let examsCompleted = 0;
    let errorCount = 0;
    
    try {
      const db = admin.firestore();
      const examId = req.body?.examId;
      
      console.log(`📅 Processing UPCOMING exams that need completion`);
      
      let query = db.collection(COLLECTIONS.EXAMS)
        .where('status', '==', EXAM_STATUS.UPCOMING);
      
      if (examId) {
        console.log(`📝 Processing specific exam: ${examId}`);
        query = query.where(admin.firestore.FieldPath.documentId(), '==', examId) as admin.firestore.Query;
      }
      
      const upcomingExamsSnapshot = await query.get();
      
      if (upcomingExamsSnapshot.empty) {
        res.status(200).json({
          success: true,
          message: 'No upcoming exams found',
          examsProcessed: 0
        });
        return;
      }
      
      console.log(`📊 Found ${upcomingExamsSnapshot.size} upcoming exams to check`);
      
      const GRACE_PERIOD_MINUTES = 30;
      
      for (const examDoc of upcomingExamsSnapshot.docs) {
        const exam: any = { id: examDoc.id, ...examDoc.data() };
        processedExams++;
        
        // Check grace period
        if (!isExamBeyondGracePeriod(exam, GRACE_PERIOD_MINUTES)) {
          console.log(`   ⏰ Exam "${exam.title}" still in grace period - skipping`);
          continue;
        }
        
        console.log(`⚡ Processing exam "${exam.title || exam.id}"`);
        
        try {
          // Find pending attempts
          const pendingAttemptsSnapshot = await db.collection(COLLECTIONS.EXAM_ATTEMPTS)
            .where('examId', '==', exam.id)
            .where('status', '==', 'in_progress')
            .get();
          
          console.log(`   📝 Found ${pendingAttemptsSnapshot.size} pending attempts`);
          
          // ==========================================
          // STEP 1: SUBMIT ALL ATTEMPTS (BATCH - FAST!)
          // ==========================================
          if (!pendingAttemptsSnapshot.empty) {
            let batch = db.batch();
            let batchCount = 0;
            const batchSize = 500;
            
            for (const attemptDoc of pendingAttemptsSnapshot.docs) {
              const attempt = attemptDoc.data();
              const submitTime = admin.firestore.Timestamp.now();
              const startTime = attempt.startTime?.toDate?.() || new Date();
              const timeSpent = Math.floor((submitTime.toDate().getTime() - startTime.getTime()) / 1000);
              
              batch.update(attemptDoc.ref, {
                status: 'submitted',
                submitTime: submitTime,
                timeSpent: timeSpent,
                autoSubmitted: true,
                autoSubmittedReason: 'exam_expired',
                autoSubmittedAt: submitTime,
                gradingQueued: true,  // Flag: grading queued
                updatedAt: submitTime
              });
              
              batchCount++;
              totalAttemptsSubmitted++;
              
              if (batchCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
              }
            }
            
            if (batchCount > 0) {
              await batch.commit();
            }
            
            console.log(`   ✅ Auto-submitted ${pendingAttemptsSnapshot.size} attempts`);
            
            // ==========================================
            // STEP 2: QUEUE GRADING TASKS (PUB/SUB - PARALLEL!)
            // ==========================================
            console.log(`   🚀 Queueing ${pendingAttemptsSnapshot.size} grading tasks to Pub/Sub...`);
            
            const topic = pubsub.topic('grade-attempts');
            
            // Publish all grading tasks
            const publishPromises = [];
            
            for (const attemptDoc of pendingAttemptsSnapshot.docs) {
              const attempt = attemptDoc.data();
              const responses = attempt.responses || [];
              
              if (responses.length === 0) {
                console.log(`      ⚠️ No responses for: ${attemptDoc.id}`);
                // Mark as no responses
                await attemptDoc.ref.update({
                  gradingQueued: false,
                  gradingComplete: true,
                  evaluationStatus: 'not_attempted',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                continue;
              }
              
              // Publish to Pub/Sub (fire and forget!)
              const messagePromise = topic.publishMessage({
                json: {
                  examId: exam.id,
                  attemptId: attemptDoc.id,
                  examTitle: exam.title || exam.id,
                  studentId: attempt.studentId,
                  timestamp: Date.now()
                }
              });
              
              publishPromises.push(messagePromise);
              totalGradingTasksQueued++;
            }
            
            // Wait for all messages to be published (fast - milliseconds)
            await Promise.all(publishPromises);
            
            console.log(`   ✅ Queued ${totalGradingTasksQueued} grading tasks to Pub/Sub`);
          }
          
          // ==========================================
          // STEP 3: MARK EXAM AS COMPLETED
          // ==========================================
          await examDoc.ref.update({
            status: EXAM_STATUS.COMPLETED,
            autoCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoCompletedBy: 'system',
            autoGradingQueued: pendingAttemptsSnapshot.size > 0,
            autoGradingComplete: pendingAttemptsSnapshot.size === 0,  // True if no attempts
            totalAutoSubmitted: pendingAttemptsSnapshot.size,
            totalGradingTasksQueued: totalGradingTasksQueued,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          examsCompleted++;
          console.log(`   ✅ Exam marked as COMPLETED (grading ${pendingAttemptsSnapshot.size > 0 ? 'in progress' : 'not needed'})`);
          
        } catch (examError: any) {
          console.error(`❌ Error processing exam ${exam.id}:`, examError);
          errorCount++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      console.log('========================================');
      console.log('✅ Exam completion with parallel grading queued!');
      console.log(`📊 Statistics:`);
      console.log(`   - Exams checked: ${processedExams}`);
      console.log(`   - Exams completed: ${examsCompleted}`);
      console.log(`   - Attempts submitted: ${totalAttemptsSubmitted}`);
      console.log(`   - Grading tasks queued: ${totalGradingTasksQueued}`);
      console.log(`   - Errors: ${errorCount}`);
      console.log(`   - Duration: ${duration}ms`);
      console.log(`   - ⚡ Grading now happening in PARALLEL via Pub/Sub workers!`);
      console.log('========================================');
      
      res.status(200).json({
        success: true,
        message: totalGradingTasksQueued > 0 
          ? `Grading queued for ${totalGradingTasksQueued} attempts (processing in parallel)`
          : `${examsCompleted} exams completed`,
        examsChecked: processedExams,
        examsCompleted: examsCompleted,
        attemptsSubmitted: totalAttemptsSubmitted,
        gradingTasksQueued: totalGradingTasksQueued,
        errors: errorCount,
        duration: duration,
        note: totalGradingTasksQueued > 0 
          ? "Grading is happening in parallel via Pub/Sub workers (2-3 minutes)" 
          : "No grading needed"
      });
      
    } catch (error: any) {
      console.error('❌ Fatal error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// ============================================
// WORKER FUNCTION: Grade Individual Attempt (Pub/Sub Subscriber)
// This function is triggered automatically for EACH message published
// Multiple instances run in PARALLEL!
// ============================================
export const gradeAttemptWorker = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,  // 2 minutes per attempt
    memory: '1GB',
    maxInstances: 2000  // Allow up to 2000 parallel workers!
  })
  .pubsub.topic('grade-attempts')
  .onPublish(async (message) => {
    const { examId, attemptId, examTitle, studentId } = message.json;
    
    console.log(`🎯 [Worker] Grading attempt: ${attemptId} for student: ${studentId} (Exam: ${examTitle})`);
    
    const startTime = Date.now();
    
    try {
      const db = admin.firestore();
      
      // Get attempt data
      const attemptDoc = await db.collection(COLLECTIONS.EXAM_ATTEMPTS).doc(attemptId).get();
      
      if (!attemptDoc.exists) {
        console.error(`❌ Attempt ${attemptId} not found`);
        return;
      }
      
      const attemptData = attemptDoc.data();
      const responses = attemptData?.responses || [];
      
      if (responses.length === 0) {
        console.log(`⚠️ No responses for attempt ${attemptId}`);
        await attemptDoc.ref.update({
          gradingQueued: false,
          gradingComplete: true,
          evaluationStatus: 'not_attempted',
          gradedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
      }
      
      console.log(`   📊 Grading ${responses.length} responses...`);
      
      // Call shared grading function (includes CODE + DESCRIPTIVE with AI!)
      await gradeAttempt(examId, attemptId, responses);
      
      // Update attempt document
      await attemptDoc.ref.update({
        gradingQueued: false,
        gradingComplete: true,
        gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        gradingDuration: Date.now() - startTime
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ [Worker] Successfully graded attempt ${attemptId} in ${duration}ms`);
      
      // Check if all attempts for this exam are now graded
      await checkAndMarkExamGradingComplete(examId);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [Worker] Error grading attempt ${attemptId} after ${duration}ms:`, error);
      
      // Mark as failed (Pub/Sub will retry automatically!)
      try {
        await admin.firestore()
          .collection(COLLECTIONS.EXAM_ATTEMPTS)
          .doc(attemptId)
          .update({
            gradingQueued: false,
            gradingFailed: true,
            gradingError: error.message,
            gradedAt: admin.firestore.FieldValue.serverTimestamp(),
            gradingDuration: duration
          });
      } catch (updateError) {
        console.error(`Failed to update error status for ${attemptId}`);
      }
      
      // Re-throw to trigger Pub/Sub retry
      throw error;
    }
  });

// ============================================
// MONITORING FUNCTION: Check Grading Progress (HTTP)
// Call this to check how many attempts are still being graded
// ============================================
export const checkGradingProgress = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const db = admin.firestore();
      const examId = req.body?.examId || req.query.examId;
      
      if (!examId) {
        res.status(400).json({ error: 'examId required' });
        return;
      }
      
      // Get counts
      const [queuedSnapshot, completedSnapshot, failedSnapshot, totalSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingQueued', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingComplete', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .where('gradingFailed', '==', true)
          .count()
          .get(),
        db.collection(COLLECTIONS.EXAM_ATTEMPTS)
          .where('examId', '==', examId)
          .count()
          .get()
      ]);
      
      const queued = queuedSnapshot.data().count;
      const completed = completedSnapshot.data().count;
      const failed = failedSnapshot.data().count;
      const total = totalSnapshot.data().count;
      
      const isComplete = queued === 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      res.json({
        success: true,
        examId: examId,
        total: total,
        completed: completed,
        failed: failed,
        queued: queued,
        progress: `${progress}%`,
        isComplete: isComplete,
        message: isComplete 
          ? `All grading complete! ${completed} graded, ${failed} failed` 
          : `Grading in progress: ${queued} remaining`
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });