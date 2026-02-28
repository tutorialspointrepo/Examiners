#!/usr/bin/env node

/**
 * regrade_exam.js — FULL EXAM REGRADE
 * 
 * Fixes ALL grading bugs across ALL question types:
 *   1. MCQ/FITB/Jumbled: Re-evaluates against correct answers from exam config
 *   2. Code/SQL: Re-runs Judge0 test cases + AI feedback
 *   3. maxMarks per question: Uses correct source (questionsList.marks vs poolQuestionMarks)
 *   4. maximumScore: Recalculated from scratch
 *   5. obtainedMarks/percentage: Recalculated from all responses
 *   6. performanceByType/Complexity/Chapter: Rebuilt from scratch
 *   7. totalQuestions/correctAnswers/attemptedQuestions: Fixed
 * 
 * Usage:
 *   node regrade_exam.js --examId=EXAM_ID [--dry-run] [--fix-language] [--skip-ai] [--attemptId=SINGLE]
 * 
 * Options:
 *   --examId        Required. The exam to regrade
 *   --attemptId     Optional. Regrade only a single attempt (otherwise all attempts)
 *   --dry-run       Show changes without writing to Firestore
 *   --fix-language  Auto-detect code language from source (for code questions)
 *   --skip-ai       Skip OpenAI feedback for code questions (saves cost/time)
 *   --skip-code     Skip code question regrading entirely (only fix MCQ/marks/scores)
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

// ============================================
// ENV + FIREBASE INIT
// ============================================
const envPaths = ['.env', 'functions/.env', '../functions/.env', '../../functions/.env'];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const val = trimmed.substring(eqIndex + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
    console.log(`Loaded env from: ${envPath}`);
    break;
  }
}

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Parse CLI args
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, val] = arg.substring(2).split('=');
    args[key] = val || true;
  }
});

const examId = args.examId || null;
const singleAttemptId = args.attemptId || null;
const dryRun = args['dry-run'] === true;
const fixLanguage = args['fix-language'] === true;
const skipAI = args['skip-ai'] === true;
const skipCode = args['skip-code'] === true;

if (!examId) {
  console.error('Usage: node regrade_exam.js --examId=EXAM_ID [--dry-run] [--fix-language] [--skip-ai] [--skip-code] [--attemptId=ID]');
  process.exit(1);
}

// ============================================
// LANGUAGE DETECTION
// ============================================
const LANGUAGE_ID_MAP = {
  'javascript': 63, 'python': 71, 'java': 62, 'cpp': 54, 'c': 50,
  'csharp': 51, 'ruby': 72, 'go': 60, 'php': 68, 'typescript': 74,
  'kotlin': 78, 'swift': 83, 'rust': 73
};

function detectLanguageFromCode(code) {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim();
  if (/^#include\s*<(stdio|stdlib|string|math|ctype|stdbool)\.h>/m.test(trimmed) &&
      !trimmed.includes('cout') && !trimmed.includes('cin') &&
      !trimmed.includes('class ') && !trimmed.includes('namespace')) return 'c';
  if (/^#include\s*<(iostream|vector|string|algorithm|map|set|queue|stack|unordered_map)>/m.test(trimmed) ||
      trimmed.includes('cout') || trimmed.includes('cin') ||
      trimmed.includes('using namespace std')) return 'cpp';
  if (/^#include\s*</m.test(trimmed) && trimmed.includes('printf') && !trimmed.includes('cout')) return 'c';
  if (/\bpublic\s+class\s+/m.test(trimmed) || /^import\s+java\./m.test(trimmed) ||
      trimmed.includes('System.out.println') || trimmed.includes('public static void main')) return 'java';
  if (/^(def |import |from |class \w+:)/m.test(trimmed) ||
      trimmed.includes('elif ') || (/\bprint\s*\(/.test(trimmed) && !trimmed.includes(';'))) return 'python';
  if (/^(function |const |let |var )/m.test(trimmed) || trimmed.includes('console.log')) return 'javascript';
  return null;
}

// ============================================
// AI CODE ANALYSIS (same as regrade_code_questions.js)
// ============================================
async function analyzeCodeWithAI(params) {
  const { questionText, studentCode, programmingLanguage, testCases, testResults, passedTests, totalTests, modelSolution } = params;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const allTestsPassed = passedTests === totalTests;
  const allTestsFailed = passedTests === 0;
  const severityLevel = allTestsPassed ? 'success' : allTestsFailed ? 'critical' : 'partial';

  let testResultsDetail = '\n\nDetailed Test Results:\n';
  testResults.forEach((result, index) => {
    const tc = testCases[index];
    testResultsDetail += `\nTest ${index + 1}: ${result.passed ? 'PASSED' : 'FAILED'}\n`;
    testResultsDetail += `  Input: ${tc.input}\n  Expected: ${tc.expectedOutput || tc.expected_output}\n  Got: ${result.actualOutput || 'No output'}\n`;
    if (result.error) testResultsDetail += `  Error: ${result.error}\n`;
  });

  let scenarioPrompt, jsonStructure;
  if (allTestsPassed) {
    scenarioPrompt = `All ${totalTests} tests passed. Focus on code quality, readability, and optimization.`;
    jsonStructure = `{ "codeQuality": number(0-100), "readabilityScore": number(0-100), "efficiencyScore": number(0-100), "correctnessScore": 100, "timeComplexity": string, "spaceComplexity": string, "correctPoints": string[], "improvements": string[], "failedTestAnalysis": [], "hasSuggestedCode": boolean, "suggestedCode": string, "codeExplanation": string }`;
  } else if (allTestsFailed) {
    scenarioPrompt = `All ${totalTests} tests failed. Identify fundamental errors and provide corrected code.`;
    jsonStructure = `{ "codeQuality": number(0-100), "readabilityScore": number(0-100), "efficiencyScore": number(0-100), "correctnessScore": 0, "timeComplexity": string, "spaceComplexity": string, "correctPoints": string[], "improvements": string[], "failedTestAnalysis": [{"testNumber": number, "issue": string, "fix": string}], "hasSuggestedCode": true, "suggestedCode": string, "codeExplanation": string }`;
  } else {
    scenarioPrompt = `${passedTests}/${totalTests} passed. Identify bugs causing failures.`;
    jsonStructure = `{ "codeQuality": number(0-100), "readabilityScore": number(0-100), "efficiencyScore": number(0-100), "correctnessScore": number(${Math.round(passedTests/totalTests*100)}), "timeComplexity": string, "spaceComplexity": string, "correctPoints": string[], "improvements": string[], "failedTestAnalysis": [{"testNumber": number, "issue": string, "fix": string}], "hasSuggestedCode": true, "suggestedCode": string, "codeExplanation": string }`;
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert programming instructor. Respond in valid JSON only.' },
        { role: 'user', content: `Expert ${programmingLanguage} review.\n\nQuestion: ${questionText}\n\nStudent Code:\n\`\`\`${programmingLanguage}\n${studentCode}\n\`\`\`\n${testResultsDetail}\n\n${scenarioPrompt}\n\n${modelSolution ? `Reference:\n\`\`\`${programmingLanguage}\n${modelSolution}\n\`\`\`\n` : ''}\n\nRespond with JSON:\n${jsonStructure}` }
      ],
      temperature: 0.3, max_tokens: 3000, response_format: { type: 'json_object' }
    });
    const result = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    return {
      testsPassed: passedTests, testsTotal: totalTests, allTestsPassed, severityLevel,
      codeQuality: result.codeQuality ?? 0, readabilityScore: result.readabilityScore ?? 0,
      efficiencyScore: result.efficiencyScore ?? 0,
      correctnessScore: result.correctnessScore ?? Math.round((passedTests / totalTests) * 100),
      timeComplexity: result.timeComplexity || 'Unknown', spaceComplexity: result.spaceComplexity || 'Unknown',
      correctPoints: result.correctPoints || [], improvements: result.improvements || [],
      failedTestAnalysis: result.failedTestAnalysis || [],
      hasSuggestedCode: result.hasSuggestedCode ?? !allTestsPassed,
      suggestedCode: result.suggestedCode || '', codeExplanation: result.codeExplanation || ''
    };
  } catch (err) {
    console.error(`       AI error: ${err.message}`);
    return null;
  }
}

// ============================================
// MCQ GRADING — matches index.ts logic exactly
// ============================================
function gradeMCQ(question, response) {
  const correctAnswersList = Array.isArray(question.correctAnswers) ? question.correctAnswers
    : question.correctAnswers != null ? [question.correctAnswers] : [];

  if (correctAnswersList.length === 0) {
    return { marksAwarded: 0, isCorrect: false, evaluationMethod: 'mcq_no_answer_key' };
  }

  const studentAnswer = response.studentAnswer;
  const isAttempted = studentAnswer !== null && studentAnswer !== '' &&
    !(Array.isArray(studentAnswer) && studentAnswer.length === 0);

  if (!isAttempted) {
    return { marksAwarded: 0, isCorrect: false, evaluationMethod: 'not_attempted' };
  }

  // Multi-select MCQ
  if (Array.isArray(studentAnswer)) {
    const correctCount = studentAnswer.filter(ans => correctAnswersList.includes(ans)).length;
    const wrongCount = studentAnswer.filter(ans => !correctAnswersList.includes(ans)).length;

    // Partial marking: (correct - wrong) / total correct answers
    const score = Math.max(0, correctCount - wrongCount) / correctAnswersList.length;
    const isCorrect = correctCount === correctAnswersList.length && wrongCount === 0;
    return { marksAwarded: score, isCorrect, evaluationMethod: 'mcq_auto' };
  }

  // Single-select MCQ
  const isCorrect = correctAnswersList.includes(studentAnswer);
  return { marksAwarded: isCorrect ? 1 : 0, isCorrect, evaluationMethod: 'mcq_auto' };
}

// ============================================
// FITB GRADING
// ============================================
function gradeFITB(question, response) {
  const correctAnswersList = question.correctAnswers || [];
  const studentAnswer = Array.isArray(response.studentAnswer) ? response.studentAnswer : [response.studentAnswer];

  const isAttempted = studentAnswer.some(a => a !== null && a !== '' && a !== undefined);
  if (!isAttempted) return { marksAwarded: 0, isCorrect: false, evaluationMethod: 'not_attempted' };

  let correctCount = 0;
  for (let i = 0; i < correctAnswersList.length; i++) {
    const correct = (correctAnswersList[i] || '').toString().toLowerCase().trim();
    const student = (studentAnswer[i] || '').toString().toLowerCase().trim();
    if (correct === student) correctCount++;
  }
  const score = correctAnswersList.length > 0 ? correctCount / correctAnswersList.length : 0;
  return { marksAwarded: score, isCorrect: correctCount === correctAnswersList.length, evaluationMethod: 'fitb_auto' };
}

// ============================================
// JUMBLED GRADING
// ============================================
function gradeJumbled(question, response) {
  const correctSequence = question.correctAnswers || [];
  const studentSequence = response.studentAnswer || [];

  const isAttempted = Array.isArray(studentSequence) && studentSequence.length > 0;
  if (!isAttempted) return { marksAwarded: 0, isCorrect: false, evaluationMethod: 'not_attempted' };

  const isCorrect = JSON.stringify(correctSequence) === JSON.stringify(studentSequence);
  return { marksAwarded: isCorrect ? 1 : 0, isCorrect, evaluationMethod: 'jumbled_auto' };
}

// ============================================
// CODE GRADING (Judge0)
// ============================================
async function gradeCode(question, response, JUDGE0_URL, fixLang, skipAIFlag) {
  const studentCode = response.studentAnswer || response.codeSubmitted || response.code || '';
  const testCases = question.testCases || [];

  if (!studentCode || studentCode.trim() === '' || testCases.length === 0) {
    return { skip: true, reason: !studentCode?.trim() ? 'No code' : 'No test cases' };
  }

  let programmingLanguage = response.programmingLanguage || question.programmingLanguage || question.language || 'javascript';
  const originalLanguage = programmingLanguage;

  console.log(`       Saved lang: ${response.programmingLanguage || '(none)'} | Question default: ${question.programmingLanguage || question.language || '(none)'}`);

  if (fixLang) {
    const detected = detectLanguageFromCode(studentCode);
    if (detected && detected !== programmingLanguage.toLowerCase()) {
      console.log(`       LANGUAGE FIX: "${programmingLanguage}" -> "${detected}"`);
      programmingLanguage = detected;
    } else {
      console.log(`       Language OK: ${programmingLanguage}${detected ? ' (confirmed)' : ' (no detection)'}`);
    }
  }

  const languageId = LANGUAGE_ID_MAP[programmingLanguage.toLowerCase()] || 63;
  console.log(`       Judge0 ID: ${languageId} | Test cases: ${testCases.length}`);

  let passedCount = 0;
  const testResults = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    try {
      const submissionResponse = await fetch(
        `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_code: studentCode, language_id: languageId,
            stdin: tc.input, expected_output: tc.expected_output
          })
        }
      );
      if (!submissionResponse.ok) throw new Error(`Judge0 ${submissionResponse.status}`);

      const result = await submissionResponse.json();
      const actualOutput = result.stdout?.trim() || '';
      const expectedOutput = (tc.expected_output || '').trim();
      const passed = result.status?.id === 3 && actualOutput === expectedOutput;

      testResults.push({
        testNumber: i + 1, input: tc.input, expectedOutput, actualOutput, passed,
        error: result.stderr || result.compile_output || null,
        executionTime: result.time || null, memory: result.memory || null,
        statusId: result.status?.id || null, statusDescription: result.status?.description || 'Unknown'
      });

      if (passed) passedCount++;
      const icon = passed ? '[PASS]' : '[FAIL]';
      const statusInfo = result.status?.description || 'Unknown';
      if (passed) {
        console.log(`         ${icon} Test ${i + 1}/${testCases.length}: ${statusInfo} (${result.time || '?'}s)`);
      } else {
        console.log(`         ${icon} Test ${i + 1}/${testCases.length}: ${statusInfo}`);
        if (result.stderr || result.compile_output) {
          console.log(`                ${(result.stderr || result.compile_output || '').split('\n')[0].substring(0, 100)}`);
        } else {
          console.log(`                Expected: "${expectedOutput.substring(0, 50)}" | Got: "${actualOutput.substring(0, 50)}"`);
        }
      }
    } catch (err) {
      testResults.push({ testNumber: i + 1, passed: false, error: err.message });
      console.log(`         [ERR] Test ${i + 1}: ${err.message}`);
    }
    if (i < testCases.length - 1) await new Promise(r => setTimeout(r, 100));
  }

  const score = testCases.length > 0 ? passedCount / testCases.length : 0;

  // AI feedback
  let codeAIFeedback = null;
  if (!skipAIFlag && process.env.OPENAI_API_KEY) {
    try {
      codeAIFeedback = await analyzeCodeWithAI({
        questionText: question.questionText, studentCode, programmingLanguage,
        testCases, testResults, passedTests: passedCount, totalTests: testCases.length,
        modelSolution: question.solution || ''
      });
      if (codeAIFeedback) {
        console.log(`       AI: Quality=${codeAIFeedback.codeQuality}/100 | Correctness=${codeAIFeedback.correctnessScore}/100`);
      }
    } catch (e) { console.error(`       AI error: ${e.message}`); }
  }

  return {
    skip: false, score, passedCount, totalTests: testCases.length, testResults,
    programmingLanguage, originalLanguage, codeAIFeedback, isCorrect: passedCount === testCases.length
  };
}

// ============================================
// REGRADE A SINGLE ATTEMPT
// ============================================
async function regradeAttempt(attemptId, examCache) {
  const { exam, questionMap, questionsListMap, poolQuestionIdSet, JUDGE0_URL,
          enableQuestionPool, poolQuestionMarks, pickRandomCount } = examCache;

  const attemptDoc = await db.collection('examAttempts').doc(attemptId).get();
  if (!attemptDoc.exists) { console.error(`  Attempt ${attemptId} not found`); return null; }

  const attempt = attemptDoc.data();
  const responses = attempt.responses || [];

  console.log(`\n  Student: ${attempt.studentName} (${attempt.studentEmail}) -- ${attemptId}`);
  console.log(`     Current: ${attempt.obtainedMarks || 0}/${attempt.maximumScore || 0} (${attempt.percentage || 0}%)`);

  // Determine which pool questions THIS student got
  const studentPoolIds = new Set(attempt.poolQuestionIds || []);

  // ── Build new responses + aggregations ──
  let newMaximumScore = 0;
  let newObtainedMarks = 0;
  let newAttempted = 0;
  let newCorrect = 0;
  const byType = {};
  const byComplexity = { easy: { attempted: 0, score: 0, maxScore: 0 }, medium: { attempted: 0, score: 0, maxScore: 0 }, hard: { attempted: 0, score: 0, maxScore: 0 } };
  const byChapter = {};
  const newResponses = [];
  let anyChanged = false;

  for (let ri = 0; ri < responses.length; ri++) {
    const response = { ...responses[ri] };
    const questionId = response.questionId;
    const question = questionMap[questionId];

    if (!question) {
      console.log(`     Q${response.questionNo}: Question ${questionId} not found in exam -- keeping as-is`);
      newResponses.push(response);
      continue;
    }

    // Skip likert
    if (question.type === 'likert' || response.questionType === 'likert') {
      newResponses.push(response);
      continue;
    }

    // ── Determine correct maxMarks ──
    const isPoolQ = enableQuestionPool && poolQuestionIdSet.has(questionId);
    const correctMaxMarks = isPoolQ && poolQuestionMarks != null
      ? Number(poolQuestionMarks)
      : Number(question.marks || question.maximumMarks || 0);

    newMaximumScore += correctMaxMarks;

    const isAttempted = response.studentAnswer !== null && response.studentAnswer !== '' &&
      !(Array.isArray(response.studentAnswer) && response.studentAnswer.length === 0);
    if (isAttempted) newAttempted++;

    const qType = question.type || response.questionType || 'unknown';
    const qLabel = `Q${response.questionNo} (${questionId})`;
    const shortText = (question.questionText || '').replace(/<[^>]*>/g, '').substring(0, 50);

    let marksAwarded = 0;
    let isCorrect = false;
    let evaluationMethod = response.evaluationMethod || 'unknown';
    let extraFields = {};

    // ── MCQ ──
    if (qType === 'mcq') {
      const result = gradeMCQ(question, response);
      marksAwarded = Math.round(result.marksAwarded * correctMaxMarks * 100) / 100;
      isCorrect = result.isCorrect;
      evaluationMethod = result.evaluationMethod;

      const oldMarks = response.marksAwarded || 0;
      const oldMax = response.maxMarks || 0;
      const changed = oldMarks !== marksAwarded || oldMax !== correctMaxMarks;
      if (changed) anyChanged = true;

      const status = isCorrect ? 'CORRECT' : isAttempted ? 'WRONG' : 'NOT ATTEMPTED';
      console.log(`     ${qLabel}: ${shortText}...`);
      console.log(`       MCQ [${status}]: ${oldMarks}/${oldMax} -> ${marksAwarded}/${correctMaxMarks}${!changed ? ' (no change)' : ''}`);
    }
    // ── FITB ──
    else if (qType === 'fitb' || (question.blanks && Array.isArray(question.blanks) && question.blanks.length > 0)) {
      const result = gradeFITB(question, response);
      marksAwarded = Math.round(result.marksAwarded * correctMaxMarks * 100) / 100;
      isCorrect = result.isCorrect;
      evaluationMethod = result.evaluationMethod;
      const oldMarks = response.marksAwarded || 0;
      const oldMax = response.maxMarks || 0;
      if (oldMarks !== marksAwarded || oldMax !== correctMaxMarks) anyChanged = true;
      console.log(`     ${qLabel}: FITB: ${oldMarks}/${oldMax} -> ${marksAwarded}/${correctMaxMarks}`);
    }
    // ── JUMBLED ──
    else if (qType === 'jumbled') {
      const result = gradeJumbled(question, response);
      marksAwarded = Math.round(result.marksAwarded * correctMaxMarks * 100) / 100;
      isCorrect = result.isCorrect;
      evaluationMethod = result.evaluationMethod;
      const oldMarks = response.marksAwarded || 0;
      const oldMax = response.maxMarks || 0;
      if (oldMarks !== marksAwarded || oldMax !== correctMaxMarks) anyChanged = true;
      console.log(`     ${qLabel}: JUMBLED: ${oldMarks}/${oldMax} -> ${marksAwarded}/${correctMaxMarks}`);
    }
    // ── CODE / SQL ──
    else if ((qType === 'code' || qType === 'sql') && !skipCode) {
      console.log(`     ${qLabel}: ${shortText}...`);
      const result = await gradeCode(question, response, JUDGE0_URL, fixLanguage, skipAI);
      if (result.skip) {
        console.log(`       >> ${result.reason} -- skipping`);
        marksAwarded = 0;
        evaluationMethod = 'not_attempted';
      } else {
        marksAwarded = Math.round(result.score * correctMaxMarks * 100) / 100;
        isCorrect = result.isCorrect;
        evaluationMethod = 'code_auto_judge0';
        extraFields = {
          programmingLanguage: result.programmingLanguage,
          testResults: result.testResults,
          passedTests: result.passedCount,
          totalTests: result.totalTests,
          evaluationStatus: 'completed',
          evaluatedBy: 'auto-grading-system',
          autoEvaluated: true,
          evaluatedAt: new Date()
        };
        if (result.codeAIFeedback) extraFields.codeAIFeedback = result.codeAIFeedback;
      }
      const oldMarks = response.marksAwarded || 0;
      const oldMax = response.maxMarks || 0;
      if (oldMarks !== marksAwarded || oldMax !== correctMaxMarks) anyChanged = true;
      console.log(`       CODE: ${oldMarks}/${oldMax} -> ${marksAwarded}/${correctMaxMarks}`);
    }
    // ── CODE/SQL but --skip-code ──
    else if ((qType === 'code' || qType === 'sql') && skipCode) {
      // Keep existing code grading, just fix maxMarks
      marksAwarded = response.marksAwarded || 0;
      isCorrect = response.isCorrect || false;
      evaluationMethod = response.evaluationMethod || 'code_auto_judge0';
      // Preserve existing code-specific fields
      extraFields = {};
      if (response.testResults) extraFields.testResults = response.testResults;
      if (response.passedTests != null) extraFields.passedTests = response.passedTests;
      if (response.totalTests != null) extraFields.totalTests = response.totalTests;
      if (response.codeAIFeedback) extraFields.codeAIFeedback = response.codeAIFeedback;
      if (response.programmingLanguage) extraFields.programmingLanguage = response.programmingLanguage;
      if (response.evaluationStatus) extraFields.evaluationStatus = response.evaluationStatus;
      if (response.evaluatedBy) extraFields.evaluatedBy = response.evaluatedBy;

      const oldMax = response.maxMarks || 0;
      if (oldMax !== correctMaxMarks) anyChanged = true;
      console.log(`     ${qLabel}: CODE/SQL (kept): ${marksAwarded}/${oldMax} -> ${marksAwarded}/${correctMaxMarks}`);
    }
    // ── DESCRIPTIVE (keep existing AI grading) ──
    else if (qType === 'descriptive') {
      marksAwarded = response.marksAwarded || 0;
      isCorrect = response.isCorrect || false;
      evaluationMethod = response.evaluationMethod || 'pending';
      const oldMax = response.maxMarks || 0;
      if (oldMax !== correctMaxMarks) anyChanged = true;
      console.log(`     ${qLabel}: DESCRIPTIVE (kept): ${marksAwarded}/${oldMax} -> ${marksAwarded}/${correctMaxMarks}`);
    }
    // ── Unknown type ──
    else {
      marksAwarded = response.marksAwarded || 0;
      isCorrect = response.isCorrect || false;
      evaluationMethod = response.evaluationMethod || 'unknown';
      console.log(`     ${qLabel}: ${qType} (kept) ${marksAwarded}/${correctMaxMarks}`);
    }

    if (isCorrect) newCorrect++;
    newObtainedMarks += marksAwarded;

    // ── Performance tracking ──
    if (!byType[qType]) byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
    byType[qType].maxScore += correctMaxMarks;
    if (isAttempted) { byType[qType].attempted++; byType[qType].score += marksAwarded; }

    const complexity = (question.complexity || '').toLowerCase();
    if (byComplexity[complexity]) {
      byComplexity[complexity].maxScore += correctMaxMarks;
      if (isAttempted) { byComplexity[complexity].attempted++; byComplexity[complexity].score += marksAwarded; }
    }

    const chapter = question.chapter || response.chapter;
    if (chapter) {
      if (!byChapter[chapter]) byChapter[chapter] = { attempted: 0, score: 0, maxScore: 0 };
      byChapter[chapter].maxScore += correctMaxMarks;
      if (isAttempted) { byChapter[chapter].attempted++; byChapter[chapter].score += marksAwarded; }
    }

    // ── Build updated response ──
    newResponses.push({
      ...response,
      marksAwarded,
      scoredMarks: marksAwarded,
      maxMarks: correctMaxMarks,
      isCorrect,
      evaluationMethod,
      evaluationStatus: evaluationMethod === 'not_attempted' ? 'evaluated' : (response.evaluationStatus || 'evaluated'),
      evaluatedBy: response.evaluatedBy || 'auto_grader',
      autoEvaluated: true,
      pool: isPoolQ,
      ...extraFields
    });
  }

  // ── Calculate totals ──
  newObtainedMarks = Math.round(newObtainedMarks * 100) / 100;
  const newPercentage = newMaximumScore > 0 ? Math.round((newObtainedMarks / newMaximumScore) * 100 * 100) / 100 : 0;
  const totalQuestions = exam.totalQuestions || (exam.questionsList?.length || 0) + (pickRandomCount || 0) + (exam.likertQuestions?.length || 0);

  console.log(`\n     --- BEFORE -> AFTER ---`);
  console.log(`     Score:      ${attempt.obtainedMarks || 0}/${attempt.maximumScore || 0} (${attempt.percentage || 0}%)  ->  ${newObtainedMarks}/${newMaximumScore} (${newPercentage}%)`);
  console.log(`     Attempted:  ${attempt.attemptedQuestions || '?'}  ->  ${newAttempted}`);
  console.log(`     Correct:    ${attempt.correctAnswers || '?'}  ->  ${newCorrect}`);
  console.log(`     Total Q:    ${attempt.totalQuestions || '?'}  ->  ${totalQuestions}`);

  // Check if maxMarks or score changed from original
  const scoreChanged = (attempt.obtainedMarks || 0) !== newObtainedMarks ||
                       (attempt.maximumScore || 0) !== newMaximumScore;
  if (scoreChanged) anyChanged = true;

  if (!anyChanged) {
    console.log(`     No changes needed.`);
    return { changed: false };
  }

  if (dryRun) {
    console.log(`     DRY RUN -- not writing`);
    return { changed: true, dryRun: true };
  }

  // ── Write to Firestore ──
  const cleanedResponses = newResponses.map(r => cleanObject(r));
  const updateData = {
    responses: cleanedResponses,
    obtainedMarks: newObtainedMarks,
    totalScore: newObtainedMarks,
    maximumScore: newMaximumScore,
    percentage: newPercentage,
    attemptedQuestions: newAttempted,
    correctAnswers: newCorrect,
    totalQuestions: totalQuestions,
    performanceByType: cleanObject(byType),
    performanceByComplexity: cleanObject(byComplexity),
    performanceByChapter: cleanObject(byChapter),
    aiEvaluated: true,
    evaluationStatus: 'evaluated',
    pendingEvaluations: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('examAttempts').doc(attemptId).update(cleanObject(updateData));
  console.log(`     WRITTEN to Firestore`);
  return { changed: true };
}

// ============================================
// HELPERS
// ============================================
function cleanObject(obj) {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object' && obj.constructor && obj.constructor.name === 'FieldValue') return obj;
  if (Array.isArray(obj)) return obj.map(item => cleanObject(item)).filter(item => item !== undefined);
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
        cleaned[key] = cleanObject(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('='.repeat(80));
  console.log(`FULL EXAM REGRADE`);
  console.log(`  Exam: ${examId}`);
  console.log(`  Attempt: ${singleAttemptId || 'ALL'}`);
  console.log(`  Fix Language: ${fixLanguage} | Skip AI: ${skipAI} | Skip Code: ${skipCode} | Dry Run: ${dryRun}`);
  console.log('='.repeat(80));

  // 1. Fetch exam config
  const examDoc = await db.collection('exams').doc(examId).get();
  if (!examDoc.exists) { console.error(`Exam ${examId} not found`); return; }
  const exam = examDoc.data();

  console.log(`\n  Exam: ${exam.title || exam.examTitle || examId}`);
  console.log(`  maxMarks: ${exam.maxMarks}`);
  console.log(`  questionsList: ${exam.questionsList?.length || 0} questions`);
  console.log(`  questionPool: ${exam.questionPool?.length || 0} questions, pickRandomCount: ${exam.pickRandomCount || 0}`);
  console.log(`  poolQuestionMarks: ${exam.poolQuestionMarks || 'N/A'}`);
  console.log(`  enableQuestionPool: ${exam.enableQuestionPool}`);

  const enableQuestionPool = !!exam.enableQuestionPool;
  const poolQuestionMarks = exam.poolQuestionMarks != null ? Number(exam.poolQuestionMarks) : null;
  const pickRandomCount = exam.pickRandomCount || 0;

  // 2. Build question lookup
  const questionMap = {};
  const questionsListMap = {};
  const poolQuestionIdSet = new Set();

  (exam.questionsList || []).forEach(q => {
    questionMap[q.id] = q;
    questionsListMap[q.id] = q;
  });
  (exam.questionPool || []).forEach(q => {
    questionMap[q.id] = q;
    poolQuestionIdSet.add(q.id);
  });
  (exam.likertQuestions || []).forEach(q => {
    questionMap[q.id || q.questionId] = q;
  });

  console.log(`  Question map: ${Object.keys(questionMap).length} total (${poolQuestionIdSet.size} pool)`);

  // Show maxMarks breakdown
  let listMarksTotal = 0;
  (exam.questionsList || []).forEach(q => { listMarksTotal += Number(q.marks || q.maximumMarks || 0); });
  const poolMarksTotal = pickRandomCount * (poolQuestionMarks || 0);
  console.log(`  Correct maxMarks: questionsList=${listMarksTotal} + pool=${pickRandomCount}x${poolQuestionMarks || 0}=${poolMarksTotal} = ${listMarksTotal + poolMarksTotal}`);

  // 3. Get Judge0 URL (for code questions)
  let JUDGE0_URL = '';
  if (!skipCode) {
    try {
      const settingsDoc = await db.collection('settings').doc('judge0_base_url').get();
      if (settingsDoc.exists) {
        const settingsData = settingsDoc.data();
        JUDGE0_URL = (settingsData?.url || settingsData?.value || settingsData?.judge0_base_url || '').replace(/\/$/, '');
      }
    } catch (e) {}
    if (!JUDGE0_URL) JUDGE0_URL = exam.judge0Url || exam.judge0_url || '';
    if (JUDGE0_URL) console.log(`  Judge0: ${JUDGE0_URL}`);
    else console.log(`  Judge0: NOT FOUND -- code questions will be skipped`);
  }

  const examCache = {
    exam, questionMap, questionsListMap, poolQuestionIdSet, JUDGE0_URL,
    enableQuestionPool, poolQuestionMarks, pickRandomCount
  };

  // 4. Fetch attempts
  let attempts;
  if (singleAttemptId) {
    attempts = [{ id: singleAttemptId }];
  } else {
    const snapshot = await db.collection('examAttempts').where('examId', '==', examId).get();
    attempts = snapshot.docs.map(d => ({ id: d.id }));
  }

  console.log(`\n  Found ${attempts.length} attempt(s)\n`);

  let totalChanged = 0;
  for (let i = 0; i < attempts.length; i++) {
    console.log(`--- [${i + 1}/${attempts.length}] ---`);
    try {
      const result = await regradeAttempt(attempts[i].id, examCache);
      if (result && result.changed) totalChanged++;
    } catch (err) {
      console.error(`  ERROR on ${attempts[i].id}: ${err.message}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETE: ${totalChanged}/${attempts.length} attempts changed`);
  if (dryRun) console.log(`(DRY RUN -- nothing was written)`);
}

main()
  .then(() => { console.log('\nDone'); process.exit(0); })
  .catch(err => { console.error('\nFatal:', err); process.exit(1); });
