// cleanup_orphan_questions.js
// Find and remove questions with invalid collegeId (not LPU, MITAOE, TPX)
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const VALID_COLLEGE_IDS = ['LPU', 'MITAOE', 'TPX'];
const DRY_RUN = process.argv.includes('--dry-run');

async function cleanupOrphanQuestions() {
  console.log(`${DRY_RUN ? '🔍 DRY RUN — no deletions' : '🔴 LIVE RUN — deleting orphan questions'}`);
  console.log(`Valid colleges: ${VALID_COLLEGE_IDS.join(', ')}\n`);

  const questionsSnap = await db.collection('questionBank').get();
  console.log(`📊 Total questions: ${questionsSnap.size}\n`);

  const orphans = {};  // collegeId → array of docs
  let validCount = 0;

  questionsSnap.forEach(doc => {
    const q = doc.data();
    const collegeId = q.collegeId || q.board || '(empty)';

    if (VALID_COLLEGE_IDS.includes(collegeId)) {
      validCount++;
      return;
    }

    if (!orphans[collegeId]) orphans[collegeId] = [];
    orphans[collegeId].push({
      docId: doc.id,
      subject: q.subject || 'N/A',
      chapter: q.chapter || 'N/A',
      type: q.type || 'N/A',
      text: (q.questionText || '').substring(0, 60)
    });
  });

  const totalOrphans = Object.values(orphans).reduce((sum, arr) => sum + arr.length, 0);

  // Show grouped summary
  console.log('═══════════════════════════════════════');
  console.log('  ORPHAN QUESTIONS BY COLLEGE ID');
  console.log('═══════════════════════════════════════');
  for (const [collegeId, questions] of Object.entries(orphans)) {
    console.log(`\n  "${collegeId}": ${questions.length} questions`);
    // Show first 5 as sample
    questions.slice(0, 5).forEach(q => {
      console.log(`    - ${q.docId} | ${q.subject} | ${q.chapter} | ${q.type}`);
    });
    if (questions.length > 5) {
      console.log(`    ... and ${questions.length - 5} more`);
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Valid questions:    ${validCount}`);
  console.log(`  Orphan questions:  ${totalOrphans}`);
  console.log(`═══════════════════════════════════════`);

  if (DRY_RUN) {
    console.log('\n⚠️  Dry run. Run without --dry-run to delete orphans.');
    process.exit(0);
  }

  // Delete orphans
  console.log(`\n🔴 Deleting ${totalOrphans} orphan questions...\n`);
  let deleted = 0;
  let failed = 0;

  for (const [collegeId, questions] of Object.entries(orphans)) {
    // Batch delete (500 per batch — Firestore limit)
    const batches = [];
    let batch = db.batch();
    let batchCount = 0;

    for (const q of questions) {
      batch.delete(db.collection('questionBank').doc(q.docId));
      batchCount++;

      if (batchCount === 500) {
        batches.push(batch);
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) batches.push(batch);

    for (const b of batches) {
      try {
        await b.commit();
        deleted += Math.min(500, questions.length - (batches.indexOf(b) * 500));
      } catch (err) {
        console.error(`  ❌ Batch delete failed for "${collegeId}": ${err.message}`);
        failed += 500;
      }
    }
    console.log(`  ✅ Deleted ${questions.length} questions from "${collegeId}"`);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  DELETION COMPLETE`);
  console.log(`═══════════════════════════════════════`);
  console.log(`  Deleted:  ${deleted}`);
  console.log(`  Failed:   ${failed}`);

  process.exit(0);
}

cleanupOrphanQuestions().catch(console.error);
