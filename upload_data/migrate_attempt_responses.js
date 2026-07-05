#!/usr/bin/env node

/**
 * migrate_attempt_responses.js — Move responses to sub-collection
 * 
 * Migrates responses[] array from examAttempts parent docs
 * to examAttempts/{attemptId}/attemptResponses/main sub-collection doc.
 * 
 * Also computes and writes top-level summary fields:
 *   - answeredCount  (for live progress tracking)
 *   - violationCount (for live violation tracking)
 *   - violationSummary { total, byType }
 * 
 * Usage:
 *   node migrate_attempt_responses.js [--dry-run] [--attemptId=SINGLE] [--examId=EXAM] [--collegeId=COLLEGE] [--batch-size=100]
 * 
 * Options:
 *   --dry-run         Preview changes without writing to Firestore
 *   --attemptId       Optional. Migrate only a single attempt (for testing)
 *   --examId          Optional. Migrate only attempts for a specific exam
 *   --collegeId       Optional. Migrate only attempts for a specific college
 *   --batch-size      Optional. Number of attempts per batch (default: 100)
 * 
 * SAFE TO RE-RUN: Skips attempts that already have a sub-collection doc.
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
const BATCH_SIZE = parseInt(args['batch-size']) || 100;

// ============================================
// HELPERS
// ============================================
function computeAnsweredCount(responses) {
  return responses.filter(r => {
    if (r.isAnswered === true) return true;
    if (r.studentAnswer) {
      if (typeof r.studentAnswer === 'string' && r.studentAnswer.trim().length > 0) return true;
      if (Array.isArray(r.studentAnswer) && r.studentAnswer.length > 0) return true;
    }
    return false;
  }).length;
}

function computeViolationSummary(responses) {
  let total = 0;
  const byType = {};
  for (const r of responses) {
    if (r.violations && Array.isArray(r.violations)) {
      total += r.violations.length;
      for (const v of r.violations) {
        const vType = v.type || v.violationType || 'UNKNOWN';
        byType[vType] = (byType[vType] || 0) + 1;
      }
    }
  }
  return { total, byType };
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('='.repeat(80));
  console.log('ATTEMPT RESPONSES MIGRATION — Parent Doc → Sub-Collection');
  console.log(`  Target: ${singleAttemptId || (examId ? `Exam ${examId}` : (collegeId ? `College ${collegeId}` : 'ALL ATTEMPTS'))}`);
  console.log(`  Batch Size: ${BATCH_SIZE}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log('='.repeat(80));

  const stats = {
    totalAttempts: 0,
    alreadyMigrated: 0,
    migrated: 0,
    noResponses: 0,
    errors: 0,
    errorDetails: [],
    totalResponsesMoved: 0,
    totalViolationsFound: 0,
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
    // Paginate through all attempts using batched reads
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

  stats.totalAttempts = attemptDocs.length;
  console.log(`\nProcessing ${stats.totalAttempts} attempt(s)...\n`);

  // 2. Process in batches (for Firestore write limits)
  for (let i = 0; i < attemptDocs.length; i++) {
    const attemptDoc = attemptDocs[i];
    const attemptId = attemptDoc.id;
    const data = attemptDoc.data();

    // Progress
    if ((i + 1) % 50 === 0 || i === 0) {
      console.log(`\n--- Progress: ${i + 1}/${stats.totalAttempts} (migrated: ${stats.migrated}, skipped: ${stats.alreadyMigrated}, errors: ${stats.errors}) ---`);
    }

    try {
      // 3. Check if sub-collection already exists (safe to re-run)
      const subColDoc = await db
        .collection('examAttempts')
        .doc(attemptId)
        .collection('attemptResponses')
        .doc('main')
        .get();

      if (subColDoc.exists) {
        stats.alreadyMigrated++;
        continue;
      }

      // 4. Get responses from parent doc
      const responses = data.responses || [];

      if (responses.length === 0) {
        stats.noResponses++;
        continue;
      }

      // 5. Compute summary fields for main doc
      const answeredCount = computeAnsweredCount(responses);
      const violationSummary = computeViolationSummary(responses);
      const violationCount = violationSummary.total;

      if (dryRun) {
        console.log(`  🔍 [${attemptId}] DRY RUN — ${responses.length} responses, ${answeredCount} answered, ${violationCount} violations`);
        stats.migrated++;
        stats.totalResponsesMoved += responses.length;
        stats.totalViolationsFound += violationCount;
        continue;
      }

      // 6. Write sub-collection doc + update main doc in a batch
      const batch = db.batch();

      // 6a. Write responses to sub-collection
      const subColRef = db
        .collection('examAttempts')
        .doc(attemptId)
        .collection('attemptResponses')
        .doc('main');
      batch.set(subColRef, { responses });

      // 6b. Add summary fields to main doc + remove responses array
      const attemptRef = db.collection('examAttempts').doc(attemptId);
      batch.update(attemptRef, {
        answeredCount,
        violationCount,
        violationSummary,
        responses: admin.firestore.FieldValue.delete(),
      });

      await batch.commit();

      stats.migrated++;
      stats.totalResponsesMoved += responses.length;
      stats.totalViolationsFound += violationCount;

    } catch (err) {
      console.error(`  ❌ [${attemptId}] ERROR: ${err.message}`);
      stats.errors++;
      stats.errorDetails.push(`${attemptId}: ${err.message}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('MIGRATION SUMMARY');
  console.log(`  Total attempts:         ${stats.totalAttempts}`);
  console.log(`  Already migrated:       ${stats.alreadyMigrated}`);
  console.log(`  Migrated:               ${stats.migrated}`);
  console.log(`  No responses (skip):    ${stats.noResponses}`);
  console.log(`  Errors:                 ${stats.errors}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Total responses moved:  ${stats.totalResponsesMoved}`);
  console.log(`  Total violations found: ${stats.totalViolationsFound}`);
  if (stats.errorDetails.length > 0) {
    console.log(`\n  Error details (first 20):`);
    stats.errorDetails.slice(0, 20).forEach(e => console.log(`    - ${e}`));
    if (stats.errorDetails.length > 20) {
      console.log(`    ... and ${stats.errorDetails.length - 20} more`);
    }
  }
  if (dryRun) console.log(`\n  ⚠️  DRY RUN — nothing was written to Firestore`);
  console.log('='.repeat(80));
}

main()
  .then(() => { console.log('\nDone'); process.exit(0); })
  .catch(err => { console.error('\nFatal:', err); process.exit(1); });
