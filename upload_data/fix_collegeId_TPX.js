/**
 * Fix collegeId from 'tutorialspoint' to 'TPX'
 * Also sets isProprietaryQuestion=false and board='TPX'
 * Run: node fix_collegeId_TPX.js
 */

const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();

const BATCH_SIZE = 500; // Firestore batch limit

async function fixCollection(collectionName) {
  console.log(`\n📂 Processing collection: ${collectionName}`);
  
  const snapshot = await db.collection(collectionName)
    .where('collegeId', '==', 'tutorialspoint')
    .get();

  if (snapshot.empty) {
    console.log(`  ⏭️  No documents with collegeId='tutorialspoint' found`);
    return 0;
  }

  console.log(`  📋 Found ${snapshot.size} documents to fix`);

  let fixed = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      collegeId: 'TPX',
      collegeName: 'Tutorials Point',
      isProprietaryQuestion: false,
      board: 'TPX',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    batchCount++;
    fixed++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  ✅ Committed batch of ${batchCount} documents`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  ✅ Committed final batch of ${batchCount} documents`);
  }

  return fixed;
}

async function main() {
  console.log('🔧 Fixing collegeId: tutorialspoint → TPX\n');
  console.log('Updates per document:');
  console.log('  • collegeId: tutorialspoint → TPX');
  console.log('  • isProprietaryQuestion → false');
  console.log('  • board → TPX');
  console.log('  • updatedAt → now');

  const collections = ['questionBank'];
  let totalFixed = 0;

  for (const col of collections) {
    const count = await fixCollection(col);
    totalFixed += count;
  }

  console.log(`\n✅ Done! Fixed ${totalFixed} documents total.`);
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
