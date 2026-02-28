#!/usr/bin/env node

/**
 * patch_exam_correct_answers.js
 * 
 * Step 1: Patches exam document — fetches correctAnswers from Question Bank
 *         and writes them into questionsList and questionPool MCQ entries.
 * 
 * Step 2: Regrades all MCQ/FITB/Jumbled responses in exam attempts using
 *         the now-correct answers.
 * 
 * Usage:
 *   node patch_exam_correct_answers.js --examId=EXAM_ID [--dry-run] [--patch-only] [--regrade-only]
 * 
 * Options:
 *   --examId        Required. The exam to fix.
 *   --dry-run       Show what would change without writing to Firestore.
 *   --patch-only    Only patch the exam document (skip regrading attempts).
 *   --regrade-only  Only regrade attempts (assumes exam already patched).
 *   --attemptId     Regrade only a single attempt.
 */

const admin = require('firebase-admin');
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
const dryRun = args['dry-run'] === true;
const patchOnly = args['patch-only'] === true;
const regradeOnly = args['regrade-only'] === true;
const singleAttemptId = args.attemptId || null;

if (!examId) {
  console.error('Usage: node patch_exam_correct_answers.js --examId=EXAM_ID [--dry-run] [--patch-only] [--regrade-only] [--attemptId=ID]');
  process.exit(1);
}

console.log(`\n${'='.repeat(70)}`);
console.log(`  PATCH EXAM CORRECT ANSWERS + REGRADE MCQ`);
console.log(`${'='.repeat(70)}`);
console.log(`  Exam ID:      ${examId}`);
console.log(`  Dry Run:      ${dryRun}`);
console.log(`  Patch Only:   ${patchOnly}`);
console.log(`  Regrade Only: ${regradeOnly}`);
if (singleAttemptId) console.log(`  Attempt ID:   ${singleAttemptId}`);
console.log(`${'='.repeat(70)}\n`);

// ============================================
// STEP 1: PATCH EXAM DOCUMENT
// ============================================
async function patchExamDocument(examDoc) {
  const exam = examDoc.data();
  const allQuestions = [
    ...(exam.questionsList || []),
    ...(exam.questionPool || [])
  ];

  // Find MCQ/FITB/Jumbled questions missing correctAnswers
  // Code, SQL, Descriptive don't use correctAnswers — they use testCases
  const TYPES_NEEDING_CORRECT_ANSWERS = ['mcq', 'fitb', 'jumbled'];
  const needsPatch = allQuestions.filter(q =>
    q.questionBankId &&
    !q.correctAnswers &&
    TYPES_NEEDING_CORRECT_ANSWERS.includes(q.type)
  );

  if (needsPatch.length === 0) {
    console.log('✅ All questions already have correctAnswers. No patching needed.');
    return exam;
  }

  console.log(`\n🔍 Found ${needsPatch.length} questions missing correctAnswers.`);

  // Batch fetch from Question Bank
  const uniqueIds = [...new Set(needsPatch.map(q => q.questionBankId))];
  console.log(`📥 Fetching ${uniqueIds.length} Question Bank documents...`);

  const qbMap = new Map();
  for (let i = 0; i < uniqueIds.length; i += 30) {
    const chunk = uniqueIds.slice(i, i + 30);
    const refs = chunk.map(id => db.collection('questionBank').doc(id));
    const docs = await db.getAll(...refs);
    docs.forEach(d => {
      if (d.exists) {
        qbMap.set(d.id, d.data());
      }
    });
  }

  console.log(`📦 Fetched ${qbMap.size} Question Bank documents.\n`);

  // Patch questionsList
  let patchedCount = 0;
  let notFoundCount = 0;

  const patchList = (list) => {
    if (!list) return list;
    return list.map(q => {
      if (q.questionBankId && !q.correctAnswers && qbMap.has(q.questionBankId)) {
        const qb = qbMap.get(q.questionBankId);
        if (qb.correctAnswers) {
          patchedCount++;
          console.log(`  ✅ ${q.id} (${q.type}) source="${q.source || 'N/A'}" "${(q.questionText || '').replace(/<[^>]*>/g, '').substring(0, 50)}..." → correctAnswers: [${qb.correctAnswers.map(a => `"${a.substring(0, 30)}..."`).join(', ')}]`);
          return { ...q, correctAnswers: qb.correctAnswers };
        }
      }
      if (q.questionBankId && !q.correctAnswers && !qbMap.has(q.questionBankId) && TYPES_NEEDING_CORRECT_ANSWERS.includes(q.type)) {
        notFoundCount++;
        console.log(`  ❌ ${q.id} (${q.type}) source="${q.source || 'N/A'}" — NOT FOUND in Question Bank (${q.questionBankId})`);
      }
      if (!q.questionBankId && !q.correctAnswers && TYPES_NEEDING_CORRECT_ANSWERS.includes(q.type)) {
        console.log(`  ⚠️  ${q.id} (${q.type}) source="${q.source || 'N/A'}" — No questionBankId, cannot enrich`);
      }
      return q;
    });
  };

  const patchedQuestionsList = patchList(exam.questionsList);
  const patchedQuestionPool = patchList(exam.questionPool);

  console.log(`\n📊 Summary: ${patchedCount} patched, ${notFoundCount} not found in QB.`);

  if (patchedCount === 0) {
    console.log('⚠️  Nothing to patch.');
    return exam;
  }

  // Write back to Firestore
  const updateData = {};
  if (exam.questionsList) updateData.questionsList = patchedQuestionsList;
  if (exam.questionPool) updateData.questionPool = patchedQuestionPool;
  updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  if (dryRun) {
    console.log('\n🔸 DRY RUN — would update exam document with patched questions.');
  } else {
    await examDoc.ref.update(updateData);
    console.log('\n✅ Exam document patched successfully!');
  }

  // Return the patched exam for regrading
  return {
    ...exam,
    questionsList: patchedQuestionsList,
    questionPool: patchedQuestionPool
  };
}

// ============================================
// STEP 2: REGRADE MCQ/FITB/JUMBLED
// ============================================
function gradeMCQ(question, studentAnswer) {
  const correctAnswersList = Array.isArray(question.correctAnswers) ? question.correctAnswers
    : question.correctAnswers != null ? [question.correctAnswers] : [];

  if (correctAnswersList.length === 0) {
    return { marksAwarded: 0, isCorrect: false, evaluationMethod: 'mcq_no_answer_key' };
  }

  const maxMarks = question.marks || question.maximumMarks || 0;

  // Multi-select MCQ (student answered with array)
  if (Array.isArray(studentAnswer)) {
    const correctCount = studentAnswer.filter(ans => correctAnswersList.includes(ans)).length;
    const wrongCount = studentAnswer.filter(ans => !correctAnswersList.includes(ans)).length;

    // Partial marking with negative for wrong selections
    const score = Math.max(0, correctCount - wrongCount) / correctAnswersList.length;
    const isCorrect = correctCount === correctAnswersList.length && wrongCount === 0;
    return { marksAwarded: Math.round(score * maxMarks * 100) / 100, isCorrect, evaluationMethod: 'mcq_multi_auto' };
  }

  // Single-select MCQ
  const isCorrect = correctAnswersList.includes(studentAnswer);
  return { marksAwarded: isCorrect ? maxMarks : 0, isCorrect, evaluationMethod: 'mcq_single_auto' };
}

function gradeFITB(question, studentAnswer) {
  const correctAnswersList = question.correctAnswers || [];
  if (correctAnswersList.length === 0) {
    return { marksAwarded: 0, isCorrect: false, evaluationMethod: 'fitb_no_answer_key' };
  }

  const maxMarks = question.marks || question.maximumMarks || 0;
  const answers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
  let correctCount = 0;

  for (let i = 0; i < correctAnswersList.length; i++) {
    const correct = (correctAnswersList[i] || '').toString().toLowerCase().trim();
    const student = (answers[i] || '').toString().toLowerCase().trim();
    if (correct === student) correctCount++;
  }

  const score = correctAnswersList.length > 0 ? correctCount / correctAnswersList.length : 0;
  return {
    marksAwarded: Math.round(score * maxMarks * 100) / 100,
    isCorrect: correctCount === correctAnswersList.length,
    evaluationMethod: 'fitb_auto'
  };
}

function gradeJumbled(question, studentAnswer) {
  const correctSequence = question.correctAnswers || [];
  if (correctSequence.length === 0) {
    return { marksAwarded: 0, isCorrect: false, evaluationMethod: 'jumbled_no_answer_key' };
  }

  const maxMarks = question.marks || question.maximumMarks || 0;
  const studentSequence = Array.isArray(studentAnswer) ? studentAnswer : [];
  let correctCount = 0;

  for (let i = 0; i < correctSequence.length; i++) {
    if ((correctSequence[i] || '').toString().trim() === (studentSequence[i] || '').toString().trim()) {
      correctCount++;
    }
  }

  const score = correctSequence.length > 0 ? correctCount / correctSequence.length : 0;
  return {
    marksAwarded: Math.round(score * maxMarks * 100) / 100,
    isCorrect: correctCount === correctSequence.length,
    evaluationMethod: 'jumbled_auto'
  };
}

async function regradeAttempts(exam) {
  // Build question map from exam
  const questionMap = new Map();
  (exam.questionsList || []).forEach(q => questionMap.set(q.id, q));
  (exam.questionPool || []).forEach(q => questionMap.set(q.id, q));

  const poolQuestionIdSet = new Set((exam.questionPool || []).map(q => q.id));
  const pickRandomCount = exam.pickRandomCount || 0;
  const poolQuestionMarks = exam.poolQuestionMarks || 0;

  // Fetch attempts
  let attemptsQuery = db.collection('examAttempts').where('examId', '==', examId);
  if (singleAttemptId) {
    attemptsQuery = db.collection('examAttempts').where('examId', '==', examId);
  }
  const attemptsSnap = await attemptsQuery.get();

  let attempts = attemptsSnap.docs;
  if (singleAttemptId) {
    attempts = attempts.filter(d => d.id === singleAttemptId);
  }

  console.log(`\n📝 Found ${attempts.length} attempt(s) to regrade.\n`);

  let totalUpdated = 0;

  for (const attemptDoc of attempts) {
    const attempt = attemptDoc.data();
    const studentName = attempt.studentName || attempt.studentId || attemptDoc.id;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`👤 ${studentName} (${attemptDoc.id})`);

    if (!attempt.responses || !Array.isArray(attempt.responses)) {
      console.log('   ⚠️  No responses array, skipping.');
      continue;
    }

    let changed = false;
    let newObtained = 0;
    let newCorrectCount = 0;
    let newAttempted = 0;

    const updatedResponses = attempt.responses.map(resp => {
      const question = questionMap.get(resp.questionId);
      if (!question) {
        // Keep existing marks
        newObtained += (resp.marksAwarded || 0);
        if (resp.studentAnswer != null && resp.studentAnswer !== '' && resp.studentAnswer !== '[]') newAttempted++;
        if (resp.isCorrect) newCorrectCount++;
        return resp;
      }

      // Determine max marks for this question
      const maxMarks = poolQuestionIdSet.has(question.id)
        ? (poolQuestionMarks / Math.max(pickRandomCount, 1))
        : (question.marks || question.maximumMarks || 0);

      const qType = question.type;
      const studentAnswer = resp.studentAnswer;
      const hasAnswer = studentAnswer != null && studentAnswer !== '' &&
        !(Array.isArray(studentAnswer) && studentAnswer.length === 0);

      if (hasAnswer) newAttempted++;

      // Only regrade MCQ/FITB/Jumbled — leave code/descriptive/sql alone
      if (qType === 'mcq' || qType === 'fitb' || qType === 'jumbled') {
        let result;
        if (qType === 'mcq') result = gradeMCQ(question, studentAnswer);
        else if (qType === 'fitb') result = gradeFITB(question, studentAnswer);
        else result = gradeJumbled(question, studentAnswer);

        const oldMarks = resp.marksAwarded || 0;
        const newMarks = result.marksAwarded;
        const oldCorrect = resp.isCorrect || false;
        const newCorrect = result.isCorrect;

        if (oldMarks !== newMarks || oldCorrect !== newCorrect) {
          console.log(`   📌 Q${question.questionNo || '?'} (${qType}): ${oldMarks} → ${newMarks} marks | correct: ${oldCorrect} → ${newCorrect}`);
          changed = true;
        }

        newObtained += newMarks;
        if (newCorrect) newCorrectCount++;

        return {
          ...resp,
          marksAwarded: newMarks,
          isCorrect: newCorrect,
          evaluationMethod: result.evaluationMethod
        };
      } else {
        // Keep existing grading for code/descriptive/sql
        newObtained += (resp.marksAwarded || 0);
        if (resp.isCorrect) newCorrectCount++;
        return resp;
      }
    });

    // Calculate new totals
    const maxScore = parseFloat(exam.maxMarks) || 0;
    newObtained = Math.round(newObtained * 100) / 100;
    const newPercentage = maxScore > 0 ? Math.round((newObtained / maxScore) * 10000) / 100 : 0;
    const totalQuestions = exam.totalQuestions || (exam.questionsList?.length || 0) + (pickRandomCount || 0);

    const oldObtained = attempt.obtainedMarks || 0;
    const oldCorrect = attempt.correctAnswers || 0;
    const oldPercentage = attempt.percentage || 0;

    if (changed || oldObtained !== newObtained || oldCorrect !== newCorrectCount) {
      console.log(`\n   📊 Score:      ${oldObtained} → ${newObtained} / ${maxScore}`);
      console.log(`   📊 Correct:    ${oldCorrect} → ${newCorrectCount}`);
      console.log(`   📊 Percentage: ${oldPercentage}% → ${newPercentage}%`);
      console.log(`   📊 Attempted:  ${attempt.attemptedQuestions || '?'} → ${newAttempted}`);

      const updateData = {
        responses: updatedResponses,
        obtainedMarks: newObtained,
        correctAnswers: newCorrectCount,
        percentage: newPercentage,
        attemptedQuestions: newAttempted,
        totalQuestions: totalQuestions,
        maximumScore: maxScore,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        regradedAt: admin.firestore.FieldValue.serverTimestamp(),
        regradedReason: 'patch_correct_answers_from_question_bank'
      };

      if (dryRun) {
        console.log(`   🔸 DRY RUN — would update attempt.`);
      } else {
        await attemptDoc.ref.update(updateData);
        console.log(`   ✅ Attempt updated!`);
      }
      totalUpdated++;
    } else {
      console.log(`   ✔️  No changes needed.`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Regrading complete: ${totalUpdated}/${attempts.length} attempts updated.`);
}

// ============================================
// MAIN
// ============================================
async function main() {
  try {
    // Load exam
    const examDoc = await db.collection('exams').doc(examId).get();
    if (!examDoc.exists) {
      console.error(`❌ Exam ${examId} not found!`);
      process.exit(1);
    }

    let exam = examDoc.data();
    console.log(`📄 Exam: "${exam.title}" (${exam.status})`);
    console.log(`   Questions: ${exam.questionsList?.length || 0} in list, ${exam.questionPool?.length || 0} in pool`);

    // Also fetch from Storage if needed
    if ((!exam.questionsList || exam.questionsList.length === 0) && exam.questionsStorageUrl) {
      console.log('📦 Fetching questions from Cloud Storage...');
      const fetch = require('node-fetch');
      const storageResponse = await fetch(exam.questionsStorageUrl);
      if (storageResponse.ok) {
        exam.questionsList = await storageResponse.json();
        console.log(`   Loaded ${exam.questionsList.length} questions from Storage.`);
      }
    }

    // Step 1: Patch exam
    if (!regradeOnly) {
      console.log('\n' + '═'.repeat(60));
      console.log('  STEP 1: PATCH EXAM — Add correctAnswers from Question Bank');
      console.log('═'.repeat(60));
      exam = await patchExamDocument(examDoc);
    }

    // Step 2: Regrade attempts
    if (!patchOnly) {
      console.log('\n' + '═'.repeat(60));
      console.log('  STEP 2: REGRADE MCQ/FITB/JUMBLED RESPONSES');
      console.log('═'.repeat(60));
      await regradeAttempts(exam);
    }

    console.log('\n🎉 Done!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  }
}

main();
