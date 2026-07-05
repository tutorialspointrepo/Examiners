/**
 * Courses Deleter - Completely removes courses from Firestore
 *
 * Deletes root doc + ALL subcollections (details, curriculum, lectures),
 * since deleting a Firestore document does NOT delete its subcollections.
 *
 * Usage:
 *   node delete_courses.js <slug1> [slug2] [slug3] ...   ← delete specific course(s)
 *   node delete_courses.js --dry <slug1> [slug2] ...     ← preview only, deletes NOTHING
 */

const admin = require('firebase-admin');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'courses';

// Known subcollections created by the uploader
const SUBCOLLECTIONS = ['details', 'curriculum', 'lectures'];

// ==================== INITIALIZE SERVICES ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// ==================== HELPERS ====================

async function deleteSubcollection(docRef, subName) {
  const snap = await docRef.collection(subName).get();
  let count = 0;
  // Batch delete in chunks of 450 (Firestore batch limit is 500)
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
    await batch.commit();
    count += Math.min(450, docs.length - i);
  }
  return count;
}

async function deleteCourse(slug, dryRun) {
  const courseRef = db.collection(COLLECTION_NAME).doc(slug);
  const docSnap = await courseRef.get();

  if (!docSnap.exists) {
    console.log(`    ⚠️  Not found: ${slug}`);
    return { success: false, notFound: true };
  }

  try {
    if (dryRun) {
      // Count only — delete nothing
      for (const sub of SUBCOLLECTIONS) {
        const snap = await courseRef.collection(sub).get();
        if (snap.size > 0) console.log(`    🔍 ${sub}: ${snap.size} docs would be deleted`);
      }
      console.log(`    🔍 course doc would be deleted: ${slug}`);
      return { success: true };
    }

    // 1. Delete all subcollection documents first
    for (const sub of SUBCOLLECTIONS) {
      const n = await deleteSubcollection(courseRef, sub);
      if (n > 0) console.log(`    🗑️  ${sub}: ${n} docs`);
    }

    // 2. Delete the root document
    await courseRef.delete();
    console.log(`    ✅ Deleted course doc: ${slug}`);

    return { success: true };
  } catch (error) {
    console.error(`    ❌ Error deleting ${slug}: ${error.message}`);
    return { success: false };
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  // Detect --dry flag (anywhere in args); remaining args are slugs
  const dryRun = args.includes('--dry');
  const slugs = args.filter(a => a !== '--dry');

  if (slugs.length === 0) {
    console.log('Usage:');
    console.log('  node delete_courses.js <slug1> [slug2] ...         delete specific course(s)');
    console.log('  node delete_courses.js --dry <slug1> [slug2] ...   preview only, deletes NOTHING');
    process.exit(1);
  }

  console.log('========================================');
  console.log(dryRun ? '🔍 Courses Deleter (DRY RUN — no changes)' : '🧨 Courses Deleter');
  console.log('========================================\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    console.log(`[${i + 1}/${slugs.length}] ${slug}`);
    const result = await deleteCourse(slug, dryRun);
    if (result.success) successCount++;
    else failCount++;
  }

  console.log('\n========================================');
  console.log(dryRun ? '📊 DRY RUN SUMMARY' : '📊 DELETE SUMMARY');
  console.log('========================================');
  console.log(`${dryRun ? '🔍 Would delete' : '✅ Deleted'}: ${successCount}`);
  console.log(`❌ Failed/Not found: ${failCount}`);
  console.log('========================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
