#!/usr/bin/env node

/**
 * cleanup_exam_parent_docs.js — Remove question data from parent exam docs
 * 
 * PREREQUISITE: Run migrate_exam_questions.js FIRST to copy questions to sub-collections.
 * This script ONLY cleans parent docs where sub-collection already exists.
 * 
 * Removes from parent doc:
 *   - questionsList
 *   - questionPool  
 *   - likertQuestions
 *   - questionsStoragePath
 *   - questionsStorageUrl
 * 
 * Usage:
 *   node cleanup_exam_parent_docs.js --dry-run                    # Preview
 *   node cleanup_exam_parent_docs.js --examId=EXAM_ID             # Single exam
 *   node cleanup_exam_parent_docs.js --collegeId=COLLEGE           # One college
 *   node cleanup_exam_parent_docs.js                               # All exams
 * 
 * SAFE: Only removes fields from exams that have a verified sub-collection doc.
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
const singleExamId = args.examId || null;
const collegeId = args.collegeId || null;

const FIELDS_TO_REMOVE = [
  'questionsList',
  'questionPool',
  'likertQuestions',
  'questionsStoragePath',
  'questionsStorageUrl',
];

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('='.repeat(80));
  console.log('CLEANUP — Remove question fields from parent exam docs');
  console.log(`  Target: ${singleExamId || (collegeId ? `College ${collegeId}` : 'ALL EXAMS')}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Fields to remove: ${FIELDS_TO_REMOVE.join(', ')}`);
  console.log('='.repeat(80));

  const stats = {
    totalExams: 0,
    cleaned: 0,
    noSubCollection: 0,
    alreadyClean: 0,
    errors: 0,
    errorDetails: [],
    savedBytes: 0,
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

    try {
      // 2. Check which fields exist in parent doc
      const fieldsPresent = FIELDS_TO_REMOVE.filter(f => examData[f] !== undefined && examData[f] !== null);

      if (fieldsPresent.length === 0) {
        stats.alreadyClean++;
        continue;
      }

      // 3. SAFETY: Only clean if sub-collection exists
      const subColDoc = await db
        .collection('exams')
        .doc(examId)
        .collection('examQuestions')
        .doc('main')
        .get();

      if (!subColDoc.exists) {
        console.log(`  ⚠️  [${i + 1}/${stats.totalExams}] ${examId}: No sub-collection — SKIPPING (run migrate first)`);
        stats.noSubCollection++;
        continue;
      }

      // 4. Estimate size savings
      let estimatedBytes = 0;
      const fieldSummary = [];
      for (const field of fieldsPresent) {
        const val = examData[field];
        const size = JSON.stringify(val).length;
        estimatedBytes += size;
        if (Array.isArray(val)) {
          fieldSummary.push(`${field}: ${val.length} items (~${Math.round(size / 1024)}KB)`);
        } else {
          fieldSummary.push(`${field}: ~${Math.round(size / 1024)}KB`);
        }
      }

      console.log(`  [${i + 1}/${stats.totalExams}] ${examId}: ${examTitle}`);
      console.log(`    Removing: ${fieldSummary.join(', ')}`);

      if (dryRun) {
        console.log(`    🔍 DRY RUN — would save ~${Math.round(estimatedBytes / 1024)}KB`);
        stats.cleaned++;
        stats.savedBytes += estimatedBytes;
        continue;
      }

      // 5. Remove fields
      const deleteFields = {};
      for (const field of fieldsPresent) {
        deleteFields[field] = admin.firestore.FieldValue.delete();
      }

      await db.collection('exams').doc(examId).update(deleteFields);
      console.log(`    ✅ Cleaned — saved ~${Math.round(estimatedBytes / 1024)}KB`);
      stats.cleaned++;
      stats.savedBytes += estimatedBytes;

    } catch (err) {
      console.error(`  ❌ ${examId}: ${err.message}`);
      stats.errors++;
      stats.errorDetails.push(`${examId}: ${err.message}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('CLEANUP SUMMARY');
  console.log(`  Total exams:          ${stats.totalExams}`);
  console.log(`  Cleaned:              ${stats.cleaned}`);
  console.log(`  Already clean:        ${stats.alreadyClean}`);
  console.log(`  No sub-collection:    ${stats.noSubCollection} (run migrate_exam_questions.js first)`);
  console.log(`  Errors:               ${stats.errors}`);
  console.log(`  Estimated savings:    ~${Math.round(stats.savedBytes / 1024)}KB (~${(stats.savedBytes / (1024 * 1024)).toFixed(1)}MB)`);
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
