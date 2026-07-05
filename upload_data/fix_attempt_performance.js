#!/usr/bin/env node

/**
 * fix_attempt_performance.js — Recompute performance stats from graded responses
 * 
 * Reads responses from sub-collection (or main doc fallback), recomputes:
 *   - totalScore / obtainedMarks
 *   - correctAnswers
 *   - attemptedQuestions
 *   - performanceByChapter
 *   - performanceByType
 *   - performanceByComplexity
 *   - percentage
 * 
 * Usage:
 *   node fix_attempt_performance.js [--dry-run] [--attemptId=SINGLE] [--examId=EXAM] [--collegeId=COLLEGE]
 * 
 * Options:
 *   --dry-run         Preview changes without writing
 *   --attemptId       Fix a single attempt
 *   --examId          Fix all attempts for one exam
 *   --collegeId       Fix all attempts for one college
 *   --show-diff       Show detailed diff for each attempt
 * 
 * SAFE TO RE-RUN: Idempotent — recomputes from source responses every time.
 */

const admin = require('firebase-admin');

// ============================================
// FIREBASE INIT
// ============================================
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

const dryRun = args['dry-run'] === true;
const singleAttemptId = args.attemptId || null;
const examId = args.examId || null;
const collegeId = args.collegeId || null;
const showDiff = args['show-diff'] === true;
const BATCH_SIZE = parseInt(args['batch-size']) || 100;

// ============================================
// RECOMPUTE LOGIC (mirrors gradeAttempt in index.ts)
// ============================================
function recomputePerformance(responses, maximumScore) {
  let totalScore = 0;
  let correctAnswers = 0;
  let attemptedQuestions = 0;

  const byType = {};
  const byComplexity = {
    easy: { attempted: 0, score: 0, maxScore: 0 },
    medium: { attempted: 0, score: 0, maxScore: 0 },
    hard: { attempted: 0, score: 0, maxScore: 0 },
  };
  const byChapter = {};

  for (const r of responses) {
    const marksAwarded = r.marksAwarded || r.scoredMarks || 0;
    const maxMarks = r.maxMarks || 0;
    const isCorrect = r.isCorrect === true;
    const qType = r.questionType || 'unknown';
    const chapter = r.chapter || null;
    const complexity = (r.complexity || '').toLowerCase();

    // isAttempted — same logic as gradeAttempt
    const isAttempted = r.studentAnswer !== null &&
      r.studentAnswer !== undefined &&
      r.studentAnswer !== '' &&
      !(Array.isArray(r.studentAnswer) && r.studentAnswer.length === 0);

    totalScore += marksAwarded;
    if (isCorrect) correctAnswers++;
    if (isAttempted) attemptedQuestions++;

    // By type
    if (!byType[qType]) byType[qType] = { attempted: 0, score: 0, maxScore: 0 };
    byType[qType].maxScore += maxMarks;
    if (isAttempted) {
      byType[qType].attempted++;
      byType[qType].score += marksAwarded;
    }

    // By complexity
    if (complexity && byComplexity[complexity]) {
      byComplexity[complexity].maxScore += maxMarks;
      if (isAttempted) {
        byComplexity[complexity].attempted++;
        byComplexity[complexity].score += marksAwarded;
      }
    }

    // By chapter
    if (chapter) {
      if (!byChapter[chapter]) byChapter[chapter] = { attempted: 0, score: 0, maxScore: 0 };
      byChapter[chapter].maxScore += maxMarks;
      if (isAttempted) {
        byChapter[chapter].attempted++;
        byChapter[chapter].score += marksAwarded;
      }
    }
  }

  // Round scores to avoid floating point issues
  totalScore = Math.round(totalScore * 100) / 100;
  for (const t of Object.values(byType)) { t.score = Math.round(t.score * 100) / 100; t.maxScore = Math.round(t.maxScore * 100) / 100; }
  for (const c of Object.values(byComplexity)) { c.score = Math.round(c.score * 100) / 100; c.maxScore = Math.round(c.maxScore * 100) / 100; }
  for (const ch of Object.values(byChapter)) { ch.score = Math.round(ch.score * 100) / 100; ch.maxScore = Math.round(ch.maxScore * 100) / 100; }

  const effectiveMax = maximumScore || Object.values(byType).reduce((s, t) => s + t.maxScore, 0);
  const percentage = effectiveMax > 0 ? Math.round((totalScore / effectiveMax) * 10000) / 100 : 0;

  return {
    totalScore,
    correctAnswers,
    attemptedQuestions,
    percentage,
    performanceByType: byType,
    performanceByComplexity: byComplexity,
    performanceByChapter: byChapter,
  };
}

function hasDiff(old, computed) {
  if (old.totalScore !== computed.totalScore) return true;
  if (old.correctAnswers !== computed.correctAnswers) return true;
  if (old.attemptedQuestions !== computed.attemptedQuestions) return true;
  if (JSON.stringify(old.performanceByChapter) !== JSON.stringify(computed.performanceByChapter)) return true;
  if (JSON.stringify(old.performanceByType) !== JSON.stringify(computed.performanceByType)) return true;
  if (JSON.stringify(old.performanceByComplexity) !== JSON.stringify(computed.performanceByComplexity)) return true;
  return false;
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('='.repeat(80));
  console.log('FIX ATTEMPT PERFORMANCE — Recompute from graded responses');
  console.log(`  Target: ${singleAttemptId || (examId ? `Exam ${examId}` : (collegeId ? `College ${collegeId}` : 'ALL ATTEMPTS'))}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Show Diff: ${showDiff}`);
  console.log('='.repeat(80));

  const stats = {
    total: 0,
    fixed: 0,
    alreadyCorrect: 0,
    noResponses: 0,
    notGraded: 0,
    errors: 0,
    errorDetails: [],
  };

  // 1. Fetch attempts
  let attemptDocs = [];

  if (singleAttemptId) {
    const doc = await db.collection('examAttempts').doc(singleAttemptId).get();
    if (!doc.exists) {
      console.error(`\nAttempt ${singleAttemptId} not found`);
      return;
    }
    attemptDocs = [doc];
  } else {
    let query = db.collection('examAttempts');
    if (examId) query = query.where('examId', '==', examId);
    if (collegeId) query = query.where('collegeId', '==', collegeId);

    let lastDoc = null;
    let batchNum = 0;
    console.log(`\nFetching attempts in batches of ${BATCH_SIZE}...`);

    while (true) {
      let batchQuery = query.limit(BATCH_SIZE);
      if (lastDoc) batchQuery = batchQuery.startAfter(lastDoc);
      const snapshot = await batchQuery.get();
      if (snapshot.empty) break;
      attemptDocs.push(...snapshot.docs);
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      batchNum++;
      process.stdout.write(`  Fetched batch ${batchNum} (${attemptDocs.length} total)\r`);
    }
    console.log(`  Fetched ${attemptDocs.length} attempts in ${batchNum} batch(es)        `);
  }

  stats.total = attemptDocs.length;
  console.log(`\nProcessing ${stats.total} attempt(s)...\n`);

  for (let i = 0; i < attemptDocs.length; i++) {
    const attemptDoc = attemptDocs[i];
    const attemptId = attemptDoc.id;
    const data = attemptDoc.data();

    if ((i + 1) % 100 === 0 || i === 0) {
      console.log(`--- Progress: ${i + 1}/${stats.total} (fixed: ${stats.fixed}, correct: ${stats.alreadyCorrect}, errors: ${stats.errors}) ---`);
    }

    try {
      // Skip if not graded yet
      if (!data.evaluationStatus || data.evaluationStatus === 'pending' || data.evaluationStatus === 'not_attempted') {
        stats.notGraded++;
        continue;
      }

      // 2. Read responses — try sub-collection first, fallback to main doc
      let responses = [];
      const subColDoc = await db
        .collection('examAttempts')
        .doc(attemptId)
        .collection('attemptResponses')
        .doc('main')
        .get();

      if (subColDoc.exists) {
        responses = subColDoc.data()?.responses || [];
      } else if (data.responses && Array.isArray(data.responses)) {
        responses = data.responses;
      }

      if (responses.length === 0) {
        stats.noResponses++;
        continue;
      }

      // 3. Recompute
      const computed = recomputePerformance(responses, data.maximumScore);

      // 4. Compare with stored
      const old = {
        totalScore: data.totalScore ?? data.obtainedMarks ?? 0,
        correctAnswers: data.correctAnswers ?? 0,
        attemptedQuestions: data.attemptedQuestions ?? 0,
        performanceByChapter: data.performanceByChapter || {},
        performanceByType: data.performanceByType || {},
        performanceByComplexity: data.performanceByComplexity || {},
      };

      if (!hasDiff(old, computed)) {
        stats.alreadyCorrect++;
        continue;
      }

      // 5. Show diff
      if (showDiff || dryRun) {
        console.log(`\n  📋 [${attemptId}] ${data.studentName || 'Unknown'} — ${data.examTitle || data.examId}`);
        if (old.totalScore !== computed.totalScore)
          console.log(`     totalScore: ${old.totalScore} → ${computed.totalScore}`);
        if (old.correctAnswers !== computed.correctAnswers)
          console.log(`     correctAnswers: ${old.correctAnswers} → ${computed.correctAnswers}`);
        if (old.attemptedQuestions !== computed.attemptedQuestions)
          console.log(`     attemptedQuestions: ${old.attemptedQuestions} → ${computed.attemptedQuestions}`);
        
        // Chapter diff
        const allChapters = new Set([...Object.keys(old.performanceByChapter), ...Object.keys(computed.performanceByChapter)]);
        for (const ch of allChapters) {
          const o = old.performanceByChapter[ch] || { attempted: 0, score: 0, maxScore: 0 };
          const n = computed.performanceByChapter[ch] || { attempted: 0, score: 0, maxScore: 0 };
          if (o.attempted !== n.attempted || o.score !== n.score || o.maxScore !== n.maxScore) {
            console.log(`     chapter[${ch}]: attempted ${o.attempted}→${n.attempted}, score ${o.score}→${n.score}, maxScore ${o.maxScore}→${n.maxScore}`);
          }
        }
      }

      if (dryRun) {
        stats.fixed++;
        continue;
      }

      // 6. Write fix
      await db.collection('examAttempts').doc(attemptId).update({
        totalScore: computed.totalScore,
        obtainedMarks: computed.totalScore,
        correctAnswers: computed.correctAnswers,
        attemptedQuestions: computed.attemptedQuestions,
        percentage: computed.percentage,
        performanceByType: computed.performanceByType,
        performanceByComplexity: computed.performanceByComplexity,
        performanceByChapter: computed.performanceByChapter,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      stats.fixed++;

    } catch (err) {
      console.error(`  ❌ [${attemptId}] ERROR: ${err.message}`);
      stats.errors++;
      if (stats.errorDetails.length < 20) stats.errorDetails.push(`${attemptId}: ${err.message}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('FIX SUMMARY');
  console.log(`  Total attempts:       ${stats.total}`);
  console.log(`  Fixed (updated):      ${stats.fixed}`);
  console.log(`  Already correct:      ${stats.alreadyCorrect}`);
  console.log(`  Not graded (skip):    ${stats.notGraded}`);
  console.log(`  No responses (skip):  ${stats.noResponses}`);
  console.log(`  Errors:               ${stats.errors}`);
  if (stats.errorDetails.length > 0) {
    console.log(`\n  Error details:`);
    stats.errorDetails.forEach(e => console.log(`    - ${e}`));
  }
  if (dryRun) console.log(`\n  ⚠️  DRY RUN — nothing was written`);
  console.log('='.repeat(80));
}

main()
  .then(() => { console.log('\nDone'); process.exit(0); })
  .catch(err => { console.error('\nFatal:', err); process.exit(1); });
