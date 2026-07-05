#!/usr/bin/env node

/**
 * migrate_exam_questions.js — Move exam questions to sub-collection
 * 
 * Migrates questionsList, questionPool, likertQuestions from parent exam docs
 * to exams/{examId}/examQuestions/main sub-collection doc.
 * 
 * Also handles exams that used Cloud Storage (questionsStorageUrl) by
 * fetching the JSON and writing it to the sub-collection.
 * 
 * After migration, removes question fields + storage refs from parent doc.
 * 
 * Usage:
 *   node migrate_exam_questions.js [--dry-run] [--examId=SINGLE_EXAM] [--collegeId=COLLEGE]
 * 
 * Options:
 *   --dry-run       Preview changes without writing to Firestore
 *   --examId        Optional. Migrate only a single exam (for testing)
 *   --collegeId     Optional. Migrate only exams for a specific college
 * 
 * SAFE TO RE-RUN: Skips exams that already have a sub-collection doc.
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

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
const singleExamId = args.examId || null;
const collegeId = args.collegeId || null;

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('='.repeat(80));
  console.log('EXAM QUESTIONS MIGRATION — Parent Doc → Sub-Collection');
  console.log(`  Target: ${singleExamId || (collegeId ? `College ${collegeId}` : 'ALL EXAMS')}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log('='.repeat(80));

  const stats = {
    totalExams: 0,
    alreadyMigrated: 0,
    migratedInline: 0,
    migratedFromStorage: 0,
    noQuestions: 0,
    errors: 0,
    errorDetails: [],
  };

  // 1. Fetch exams
  let examsSnapshot;
  if (singleExamId) {
    const doc = await db.collection('exams').doc(singleExamId).get();
    examsSnapshot = doc.exists ? [doc] : [];
    if (!doc.exists) {
      console.error(`\nExam ${singleExamId} not found`);
      return;
    }
  } else if (collegeId) {
    const snapshot = await db.collection('exams').where('collegeId', '==', collegeId).get();
    examsSnapshot = snapshot.docs;
  } else {
    const snapshot = await db.collection('exams').get();
    examsSnapshot = snapshot.docs;
  }

  stats.totalExams = examsSnapshot.length;
  console.log(`\nFound ${stats.totalExams} exam(s) to process\n`);

  for (let i = 0; i < examsSnapshot.length; i++) {
    const examDoc = examsSnapshot[i];
    const examId = examDoc.id;
    const examData = examDoc.data();
    const examTitle = examData.title || examId;

    console.log(`--- [${i + 1}/${stats.totalExams}] ${examId}: ${examTitle} ---`);

    try {
      // 2. Check if sub-collection already exists (safe to re-run)
      const subColDoc = await db
        .collection('exams')
        .doc(examId)
        .collection('examQuestions')
        .doc('main')
        .get();

      if (subColDoc.exists) {
        console.log(`  ⏭️  Already migrated — skipping`);
        stats.alreadyMigrated++;
        continue;
      }

      // 3. Gather questions
      let questionsList = examData.questionsList || [];
      const questionPool = examData.questionPool || [];
      const likertQuestions = examData.likertQuestions || [];
      let source = 'inline';

      // 4. If questions were in Cloud Storage, fetch them
      if (questionsList.length === 0 && examData.questionsStorageUrl) {
        source = 'storage';
        try {
          console.log(`  📥 Fetching questions from Cloud Storage...`);
          const response = await fetch(examData.questionsStorageUrl);
          if (response.ok) {
            questionsList = await response.json();
            console.log(`  ✅ Fetched ${questionsList.length} questions from Storage`);
          } else {
            console.error(`  ❌ Storage fetch failed: HTTP ${response.status}`);
            stats.errors++;
            stats.errorDetails.push(`${examId}: Storage fetch HTTP ${response.status}`);
            continue;
          }
        } catch (fetchErr) {
          console.error(`  ❌ Storage fetch error: ${fetchErr.message}`);
          stats.errors++;
          stats.errorDetails.push(`${examId}: Storage fetch error: ${fetchErr.message}`);
          continue;
        }
      }

      // 5. If no questions at all, skip (offline exam or empty)
      if (questionsList.length === 0 && questionPool.length === 0 && likertQuestions.length === 0) {
        console.log(`  ⏭️  No questions (offline/empty) — skipping`);
        stats.noQuestions++;
        continue;
      }

      // 6. Build sub-collection document
      const questionsSubDoc = {};
      if (questionsList.length > 0) questionsSubDoc.questionsList = questionsList;
      if (questionPool.length > 0) questionsSubDoc.questionPool = questionPool;
      if (likertQuestions.length > 0) questionsSubDoc.likertQuestions = likertQuestions;

      console.log(`  📊 Questions: ${questionsList.length} list, ${questionPool.length} pool, ${likertQuestions.length} likert (source: ${source})`);

      if (dryRun) {
        console.log(`  🔍 DRY RUN — would write sub-collection + clean parent doc`);
        if (source === 'storage') stats.migratedFromStorage++;
        else stats.migratedInline++;
        continue;
      }

      // 7. Write sub-collection doc
      await db
        .collection('exams')
        .doc(examId)
        .collection('examQuestions')
        .doc('main')
        .set(questionsSubDoc);

      // 8. Keep existing fields in parent doc as backup
      // Once migration is verified working, run with --cleanup to remove them
      console.log(`  ✅ Sub-collection written (parent doc fields kept as backup)`);

      if (source === 'storage') stats.migratedFromStorage++;
      else stats.migratedInline++;

    } catch (err) {
      console.error(`  ❌ ERROR: ${err.message}`);
      stats.errors++;
      stats.errorDetails.push(`${examId}: ${err.message}`);
    }
  }

  // Summary
  const totalMigrated = stats.migratedInline + stats.migratedFromStorage;
  console.log(`\n${'='.repeat(80)}`);
  console.log('MIGRATION SUMMARY');
  console.log(`  Total exams:          ${stats.totalExams}`);
  console.log(`  Already migrated:     ${stats.alreadyMigrated}`);
  console.log(`  Migrated (inline):    ${stats.migratedInline}`);
  console.log(`  Migrated (storage):   ${stats.migratedFromStorage}`);
  console.log(`  Total migrated:       ${totalMigrated}`);
  console.log(`  No questions (skip):  ${stats.noQuestions}`);
  console.log(`  Errors:               ${stats.errors}`);
  if (stats.errorDetails.length > 0) {
    console.log(`\n  Error details:`);
    stats.errorDetails.forEach(e => console.log(`    - ${e}`));
  }
  if (dryRun) console.log(`\n  ⚠️  DRY RUN — nothing was written to Firestore`);
  console.log('='.repeat(80));
}

main()
  .then(() => { console.log('\nDone'); process.exit(0); })
  .catch(err => { console.error('\nFatal:', err); process.exit(1); });
