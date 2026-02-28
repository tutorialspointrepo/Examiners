/**
 * regrade_pool_exam.js - Regrade pool exam attempts (v2 - firebase-admin)
 * 
 * Fixes marks for pool-based exams where regular questions were incorrectly
 * scored using poolQuestionMarks instead of their own marks.
 *
 * Rules:
 *   - Pool questions → poolQuestionMarks
 *   - QuestionsList questions → question.maximumMarks
 *   - Likert questions → 0 marks (personality trait scoring only)
 *
 * Prerequisites:
 *   npm install firebase-admin
 *
 * Usage:
 *   node regrade_pool_exam.js --examId=EXAM_ID --studentId=STUDENT_ID   (test one student)
 *   node regrade_pool_exam.js --examId=EXAM_ID                          (all students)
 *   node regrade_pool_exam.js --examId=EXAM_ID --dry-run                (preview only)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ============================================
// INIT FIREBASE ADMIN
// ============================================
const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('❌ serviceAccountKey.json not found in the same directory as this script.');
  console.error('   Download it from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================
// PARSE CLI ARGS
// ============================================
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const examIdArg = args.find(a => a.startsWith('--examId='));
const studentIdArg = args.find(a => a.startsWith('--studentId='));

const examId = examIdArg ? examIdArg.split('=')[1] : null;
const studentId = studentIdArg ? studentIdArg.split('=')[1] : null;

if (!examId) {
  console.error('❌ --examId=EXAM_ID is required');
  process.exit(1);
}

console.log('=== Pool Exam Regrade Script (v2 - Admin SDK) ===');
console.log(`Exam ID:    ${examId}`);
console.log(`Student ID: ${studentId || 'ALL'}`);
console.log(`Mode:       ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

// ============================================
// FETCH EXAM
// ============================================
async function fetchExam(examId) {
  console.log('📥 Fetching exam...');
  const doc = await db.collection('exams').doc(examId).get();
  if (!doc.exists) throw new Error('Exam not found');

  const data = doc.data();
  const exam = {
    enableQuestionPool: data.enableQuestionPool || false,
    poolQuestionMarks: data.poolQuestionMarks,
    pickRandomCount: data.pickRandomCount,
    maxMarks: data.maxMarks,
    questionPool: data.questionPool || [],
    questionsList: data.questionsList || [],
    likertQuestions: data.likertQuestions || [],
  };

  console.log(`  - enableQuestionPool: ${exam.enableQuestionPool}`);
  console.log(`  - poolQuestionMarks: ${exam.poolQuestionMarks}`);
  console.log(`  - pickRandomCount: ${exam.pickRandomCount}`);
  console.log(`  - maxMarks: ${exam.maxMarks}`);
  console.log(`  - questionsList size: ${exam.questionsList.length}`);
  console.log(`  - questionPool size: ${exam.questionPool.length}`);
  console.log(`  - likertQuestions size: ${exam.likertQuestions.length}\n`);

  if (!exam.enableQuestionPool) {
    console.log('⚠️ This exam does not use question pool. Nothing to regrade.');
    process.exit(0);
  }

  return exam;
}

// ============================================
// FETCH ATTEMPTS
// ============================================
async function fetchAttempts(examId, studentId) {
  console.log('📥 Fetching attempts...');

  let query = db.collection('examAttempts')
    .where('examId', '==', examId)
    .where('status', '==', 'submitted');

  if (studentId) {
    query = query.where('studentId', '==', studentId);
  }

  const snapshot = await query.limit(500).get();
  const attempts = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    attempts.push({
      docId: doc.id,
      studentId: data.studentId,
      studentName: data.studentName,
      rollNumber: data.rollNumber,
      responses: data.responses || [],
      poolQuestionIds: data.poolQuestionIds || [],
      totalScore: data.totalScore || 0,
      maxMarks: data.maximumScore || 0,
      percentage: data.percentage || 0,
      performanceByChapter: data.performanceByChapter || {},
      performanceByType: data.performanceByType || {},
      performanceByComplexity: data.performanceByComplexity || {},
    });
  });

  console.log(`  Found ${attempts.length} submitted attempt(s)\n`);
  return attempts;
}

// ============================================
// REGRADE ONE ATTEMPT
// ============================================
function regradeAttempt(attempt, exam) {
  const poolQuestionMarks = Number(exam.poolQuestionMarks) || 0;
  const pickRandomCount = Number(exam.pickRandomCount) || 0;

  // Build lookup maps
  const poolQuestionIdSet = new Set(exam.questionPool.map(q => q.id));
  const questionsListMap = new Map(exam.questionsList.map(q => [q.id, q]));
  const likertIdSet = new Set(exam.likertQuestions.map(q => q.id));

  // Determine presented pool questions
  let presentedPoolQuestions = [];

  if (attempt.poolQuestionIds.length > 0) {
    const idSet = new Set(attempt.poolQuestionIds);
    presentedPoolQuestions = exam.questionPool.filter(q => idSet.has(q.id));
    console.log(`    📋 Using exact poolQuestionIds: ${presentedPoolQuestions.length} questions`);
  } else {
    console.log('    ⚠️ No poolQuestionIds — using distribution estimate');
    const poolByChapter = new Map();
    for (const q of exam.questionPool) {
      const ch = q.chapter || q.board || q.subject || 'General';
      if (!poolByChapter.has(ch)) poolByChapter.set(ch, []);
      poolByChapter.get(ch).push(q);
    }
    const totalChapters = poolByChapter.size;
    const baseQuota = Math.floor(pickRandomCount / totalChapters);
    const chapterCount = new Map();
    let assigned = 0;
    for (const [ch, qs] of poolByChapter) {
      const quota = Math.min(baseQuota, qs.length);
      chapterCount.set(ch, quota);
      assigned += quota;
    }
    let remaining = pickRandomCount - assigned;
    if (remaining > 0) {
      const sorted = Array.from(poolByChapter.entries())
        .filter(([ch, qs]) => qs.length > (chapterCount.get(ch) || 0))
        .sort((a, b) => b[1].length - a[1].length);
      for (const [ch] of sorted) {
        if (remaining === 0) break;
        chapterCount.set(ch, (chapterCount.get(ch) || 0) + 1);
        remaining--;
      }
    }
    for (const [ch, count] of chapterCount) {
      const chapQs = poolByChapter.get(ch) || [];
      for (let i = 0; i < count && i < chapQs.length; i++) {
        presentedPoolQuestions.push(chapQs[i]);
      }
    }
  }

  // Build corrected performance maps
  const byChapter = {};
  const byType = {};
  const byComplexity = {};

  const correctedResponses = [];
  
  for (const r of attempt.responses) {
    const isLikert = likertIdSet.has(r.questionId) || r.questionType === 'likert';
    const isPool = poolQuestionIdSet.has(r.questionId);
    const listQuestion = questionsListMap.get(r.questionId);
    
    const chapter = r.chapter || 'Uncategorized';
    const qType = r.questionType || 'unknown';
    const complexity = (r.complexity || 'easy').toLowerCase();
    
    let correctedMarks = r.marksAwarded || 0;
    let correctedMaxMarks = r.maxMarks || 0;
    
    if (isLikert) {
      // Likert: 0 marks always — personality trait scoring only
      correctedMarks = 0;
      correctedMaxMarks = 0;
      if (r.maxMarks !== 0 || r.marksAwarded !== 0) {
        console.log(`    Q${r.questionNo} [LIKERT]: ${r.marksAwarded}/${r.maxMarks} → 0/0`);
      }
    } else if (isPool) {
      // Pool question: should use poolQuestionMarks
      const oldMaxMarks = r.maxMarks || 0;
      correctedMaxMarks = poolQuestionMarks;
      
      if (oldMaxMarks > 0 && r.marksAwarded > 0) {
        correctedMarks = Math.round((r.marksAwarded / oldMaxMarks) * poolQuestionMarks * 100) / 100;
      } else {
        correctedMarks = 0;
      }
      
      if (correctedMarks !== r.marksAwarded || correctedMaxMarks !== r.maxMarks) {
        console.log(`    Q${r.questionNo} [POOL/${qType}]: ${r.marksAwarded}/${r.maxMarks} → ${correctedMarks}/${correctedMaxMarks}`);
      }
    } else if (listQuestion) {
      // Regular question: should use questionsList maximumMarks
      const correctMaxMarks = Number(listQuestion.maximumMarks || listQuestion.marks || 0);
      correctedMaxMarks = correctMaxMarks;
      
      if (r.maxMarks !== correctMaxMarks && r.maxMarks > 0 && correctMaxMarks > 0) {
        correctedMarks = Math.round((r.marksAwarded / r.maxMarks) * correctMaxMarks * 100) / 100;
        console.log(`    Q${r.questionNo} [LIST/${qType}]: ${r.marksAwarded}/${r.maxMarks} → ${correctedMarks}/${correctMaxMarks}`);
      }
    }
    
    correctedResponses.push({
      ...r,
      marksAwarded: correctedMarks,
      scoredMarks: correctedMarks,
      maxMarks: correctedMaxMarks,
    });
    
    const isAttempted = r.answered !== false && r.studentAnswer !== null && r.studentAnswer !== '' &&
      !(Array.isArray(r.studentAnswer) && r.studentAnswer.length === 0);

    // Likert doesn't contribute to performance maps for marks
    if (isLikert) continue;

    if (!byChapter[chapter]) byChapter[chapter] = { attempted: 0, score: 0, maxScore: 0 };
    if (isAttempted) { byChapter[chapter].attempted++; byChapter[chapter].score += correctedMarks; }
    if (!isPool) byChapter[chapter].maxScore += correctedMaxMarks;

    if (!byType[qType]) byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
    if (isAttempted) { byType[qType].attempted++; byType[qType].score += correctedMarks; }
    if (!isPool) byType[qType].maxScore += correctedMaxMarks;

    if (!byComplexity[complexity]) byComplexity[complexity] = { attempted: 0, score: 0, maxScore: 0 };
    if (isAttempted) { byComplexity[complexity].attempted++; byComplexity[complexity].score += correctedMarks; }
    if (!isPool) byComplexity[complexity].maxScore += correctedMaxMarks;
  }

  // Add maxScore from presented pool questions
  for (const q of presentedPoolQuestions) {
    const chapter = q.chapter || q.board || q.subject || 'General';
    const qType = q.type || 'mcq';
    const complexity = (q.complexity || 'easy').toLowerCase();

    if (!byChapter[chapter]) byChapter[chapter] = { attempted: 0, score: 0, maxScore: 0 };
    byChapter[chapter].maxScore += poolQuestionMarks;

    if (!byType[qType]) byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
    byType[qType].maxScore += poolQuestionMarks;

    if (!byComplexity[complexity]) byComplexity[complexity] = { attempted: 0, score: 0, maxScore: 0 };
    byComplexity[complexity].maxScore += poolQuestionMarks;
  }

  const totalScore = Object.values(byChapter).reduce((sum, c) => sum + c.score, 0);
  const totalMaxMarks = Object.values(byChapter).reduce((sum, c) => sum + c.maxScore, 0);
  const percentage = totalMaxMarks > 0 ? Math.round((totalScore / totalMaxMarks) * 100 * 100) / 100 : 0;

  return {
    byChapter,
    byType,
    byComplexity,
    totalScore,
    maxMarks: totalMaxMarks,
    percentage,
    presentedCount: presentedPoolQuestions.length,
    correctedResponses,
  };
}

// ============================================
// MAIN
// ============================================
async function main() {
  const exam = await fetchExam(examId);
  const attempts = await fetchAttempts(examId, studentId);

  if (attempts.length === 0) {
    console.log('No attempts to regrade.');
    return;
  }

  let regraded = 0, failed = 0;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    console.log(`\n[${i + 1}/${attempts.length}] ${attempt.studentName} (${attempt.rollNumber})`);
    console.log(`  Attempt: ${attempt.docId}`);
    console.log(`  Responses: ${attempt.responses.length}`);
    console.log(`  OLD: ${attempt.totalScore}/${attempt.maxMarks} (${attempt.percentage}%)`);

    const result = regradeAttempt(attempt, exam);

    // ============================================
    // BEFORE vs AFTER comparison
    // ============================================
    console.log('\n  ┌─────────────────────────────────────────────────────────────────┐');
    console.log('  │                    BEFORE vs AFTER                              │');
    console.log('  └─────────────────────────────────────────────────────────────────┘');
    
    console.log('\n  📊 OVERALL:');
    console.log(`     BEFORE: ${attempt.totalScore}/${attempt.maxMarks} (${attempt.percentage}%)`);
    console.log(`     AFTER:  ${result.totalScore}/${result.maxMarks} (${result.percentage}%)`);
    
    // Per-response marks changes
    const changedResponses = result.correctedResponses.filter((r, idx) => 
      r.marksAwarded !== attempt.responses[idx].marksAwarded || r.maxMarks !== attempt.responses[idx].maxMarks
    );
    if (changedResponses.length > 0) {
      console.log(`\n  📝 RESPONSES (${changedResponses.length} corrected):`);
      console.log('     Q#   Type          Before        After');
      console.log('     ───  ────────────  ────────────  ────────────');
      for (let j = 0; j < result.correctedResponses.length; j++) {
        const oldR = attempt.responses[j];
        const newR = result.correctedResponses[j];
        if (oldR.marksAwarded !== newR.marksAwarded || oldR.maxMarks !== newR.maxMarks) {
          const qType = (oldR.questionType || 'unknown').padEnd(12);
          const before = `${oldR.marksAwarded}/${oldR.maxMarks}`.padEnd(12);
          const after = `${newR.marksAwarded}/${newR.maxMarks}`;
          console.log(`     Q${String(oldR.questionNo).padEnd(3)} ${qType}  ${before}  ${after}`);
        }
      }
    } else {
      console.log('\n  📝 RESPONSES: No marks changes needed');
    }
    
    // Chapter comparison
    const allChapters = new Set([
      ...Object.keys(attempt.performanceByChapter),
      ...Object.keys(result.byChapter)
    ]);
    if (allChapters.size > 0) {
      console.log('\n  📚 CHAPTERS:');
      console.log('     Chapter                    Before              After');
      console.log('     ────────────────────────── ──────────────────  ──────────────────');
      for (const ch of allChapters) {
        const old = attempt.performanceByChapter[ch] || { score: 0, maxScore: 0, attempted: 0 };
        const neu = result.byChapter[ch] || { score: 0, maxScore: 0, attempted: 0 };
        if (neu.maxScore === 0 && old.maxScore === 0) continue;
        const oldPct = old.maxScore > 0 ? Math.round((old.score / old.maxScore) * 100) : 0;
        const newPct = neu.maxScore > 0 ? Math.round((neu.score / neu.maxScore) * 100) : 0;
        const chName = ch.substring(0, 26).padEnd(26);
        const before = `${old.score}/${old.maxScore} (${oldPct}%)`.padEnd(18);
        const after = `${neu.score}/${neu.maxScore} (${newPct}%)`;
        const changed = (old.score !== neu.score || old.maxScore !== neu.maxScore) ? ' ← CHANGED' : '';
        console.log(`     ${chName} ${before}  ${after}${changed}`);
      }
    }
    
    console.log('\n  ─────────────────────────────────────────────────────────────────');

    if (dryRun) {
      console.log('  🔍 DRY RUN — skipping update');
      regraded++;
      continue;
    }

    // Build corrected responses — preserve ALL original fields, only patch marks
    const patchedResponses = attempt.responses.map((origR, idx) => {
      const corrected = result.correctedResponses[idx];
      return {
        ...origR,
        marksAwarded: corrected.marksAwarded,
        scoredMarks: corrected.scoredMarks,
        maxMarks: corrected.maxMarks,
      };
    });

    try {
      await db.collection('examAttempts').doc(attempt.docId).update({
        performanceByChapter: result.byChapter,
        performanceByType: result.byType,
        performanceByComplexity: result.byComplexity,
        maximumScore: result.maxMarks,
        totalScore: result.totalScore,
        obtainedMarks: result.totalScore,
        percentage: result.percentage,
        responses: patchedResponses,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('  ✅ Updated in Firestore');
      regraded++;
    } catch (err) {
      console.log(`  ❌ Firestore update FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total:    ${attempts.length}`);
  console.log(`Regraded: ${regraded}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Mode:     ${dryRun ? 'DRY RUN' : 'LIVE'}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
