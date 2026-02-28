/**
 * Backfill shortId for existing jobs
 * Adds 8-char alphanumeric shortId to all jobs missing it
 * 
 * Usage:
 *   DRY RUN (show what would change):
 *     node backfill_job_shortids.js --dry-run
 * 
 *   APPLY FIXES:
 *     node backfill_job_shortids.js --apply
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'jobs';
const SHORT_ID_LENGTH = 8;

// ==================== INITIALIZE FIREBASE ====================
let db = null;

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
      projectId: FIREBASE_PROJECT_ID
    });
  }
  db = admin.firestore();
}

// ==================== SHORT ID GENERATION ====================

function generateShortId(length = SHORT_ID_LENGTH) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// ==================== MAIN LOGIC ====================

async function backfillShortIds(dryRun = true) {
  initFirebase();

  console.log(`🔍 Scanning all jobs in "${COLLECTION_NAME}"...\n`);

  const snapshot = await db.collection(COLLECTION_NAME).get();

  const needsFix = [];
  const alreadyHas = [];
  const usedIds = new Set();

  // First pass: collect existing shortIds to avoid collisions
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.shortId) {
      usedIds.add(data.shortId);
      alreadyHas.push(doc.id);
    } else {
      needsFix.push({ docId: doc.id, title: data.title || '', company: data.company || '', status: data.status || '' });
    }
  });

  console.log(`📊 Total jobs: ${snapshot.size}`);
  console.log(`✅ Already have shortId: ${alreadyHas.length}`);
  console.log(`⚠️  Missing shortId: ${needsFix.length}\n`);

  if (needsFix.length === 0) {
    console.log('✅ Nothing to do!\n');
    return;
  }

  // Generate unique shortIds
  const assignments = [];
  for (const job of needsFix) {
    let shortId;
    let attempts = 0;
    do {
      shortId = generateShortId();
      attempts++;
    } while (usedIds.has(shortId) && attempts < 20);

    if (usedIds.has(shortId)) {
      // Extremely unlikely fallback — use 10 chars
      shortId = generateShortId(10);
    }

    usedIds.add(shortId);
    assignments.push({ ...job, shortId });
  }

  // Display
  console.log('Jobs to update:');
  console.log('─'.repeat(90));
  assignments.forEach((a, i) => {
    const docIdShort = a.docId.length > 40 ? a.docId.substring(0, 40) + '...' : a.docId;
    console.log(`  ${String(i + 1).padStart(3)}. ${a.shortId}  ←  ${docIdShort}  |  ${(a.title || '').substring(0, 40)}  |  ${a.status}`);
  });
  console.log('─'.repeat(90));

  if (dryRun) {
    console.log(`\n🔍 DRY RUN — no changes made.`);
    console.log(`💡 To apply, run: node backfill_job_shortids.js --apply\n`);
    return;
  }

  // Apply in batches
  console.log(`\n🔧 Applying ${assignments.length} updates...\n`);

  const BATCH_SIZE = 400;
  let applied = 0;
  let errors = 0;

  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const chunk = assignments.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const a of chunk) {
      batch.update(db.collection(COLLECTION_NAME).doc(a.docId), { shortId: a.shortId });
    }

    try {
      await batch.commit();
      applied += chunk.length;
      console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} jobs updated`);
    } catch (error) {
      errors += chunk.length;
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`✅ Updated: ${applied}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('═'.repeat(50) + '\n');
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('========================================');
    console.log('🔧 Job shortId Backfill');
    console.log('   Adds 8-char SEO-friendly IDs to jobs');
    console.log('========================================\n');
    console.log('  node backfill_job_shortids.js --dry-run    (preview)');
    console.log('  node backfill_job_shortids.js --apply      (apply)\n');
    process.exit(1);
  }

  const dryRun = !args.includes('--apply');
  await backfillShortIds(dryRun);
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
