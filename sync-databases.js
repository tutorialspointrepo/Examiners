/**
 * sync-databases.js
 * 
 * Full deep sync between Firestore databases within the same project.
 * Auto-discovers ALL collections and recursively copies ALL subcollections.
 * 
 * Usage:
 *   node sync-databases.js prod-to-dev     → Copy (default) production → examiners-dev
 *   node sync-databases.js dev-to-prod     → Copy examiners-dev → (default) production
 * 
 * ⚠️  WARNING: This OVERWRITES documents in target with same IDs.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ============================================================
// CONFIGURATION
// ============================================================
const SERVICE_ACCOUNT_PATH = './upload_data/serviceAccountKey.json';

// ============================================================
// SCRIPT
// ============================================================
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
const app = initializeApp({ credential: cert(serviceAccount) });

const prodDb = getFirestore(app);                     // (default)
const devDb = getFirestore(app, 'examiners-dev');     // named database

// Stats
let totalDocs = 0;
let totalCollections = 0;

/**
 * Recursively copy a collection and all its subcollections
 */
async function copyCollection(sourceDb, targetDb, collectionPath) {
  const snapshot = await sourceDb.collection(collectionPath).get();

  if (snapshot.empty) {
    return;
  }

  // Check if target already has this collection with same doc count → skip
  const targetSnapshot = await targetDb.collection(collectionPath).count().get();
  const targetCount = targetSnapshot.data().count;

  if (targetCount >= snapshot.size) {
    console.log(`⏭️  ${collectionPath} (${snapshot.size} docs) — already synced, skipping`);
    totalCollections++;
    // Still recurse subcollections in case nested ones are missing
    for (const docSnap of snapshot.docs) {
      const subcollections = await docSnap.ref.listCollections();
      for (const subcol of subcollections) {
        await copyCollection(sourceDb, targetDb, `${collectionPath}/${docSnap.id}/${subcol.id}`);
      }
    }
    return;
  }

  totalCollections++;
  console.log(`📦 ${collectionPath} (${snapshot.size} docs, target has ${targetCount})`);

  // Batch write documents (smaller batches to avoid payload size limit)
  const batchSize = 50;
  let batch = targetDb.batch();
  let batchCount = 0;
  let batchDocs = []; // track docs in current batch for fallback

  for (const docSnap of snapshot.docs) {
    const targetRef = targetDb.doc(`${collectionPath}/${docSnap.id}`);
    batch.set(targetRef, docSnap.data());
    batchCount++;
    batchDocs.push(docSnap);

    if (batchCount >= batchSize) {
      try {
        await batch.commit();
      } catch (err) {
        if (err.code === 3 && err.details?.includes('payload size')) {
          console.log(`   ⚠️  Batch too large, writing ${batchCount} docs individually...`);
          for (const doc of batchDocs) {
            const ref = targetDb.doc(`${collectionPath}/${doc.id}`);
            await ref.set(doc.data());
          }
        } else {
          throw err;
        }
      }
      totalDocs += batchCount;
      batch = targetDb.batch();
      batchCount = 0;
      batchDocs = [];
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      if (err.code === 3 && err.details?.includes('payload size')) {
        console.log(`   ⚠️  Batch too large, writing ${batchCount} docs individually...`);
        for (const doc of batchDocs) {
          const ref = targetDb.doc(`${collectionPath}/${doc.id}`);
          await ref.set(doc.data());
        }
      } else {
        throw err;
      }
    }
    totalDocs += batchCount;
  }

  // Recurse into subcollections of each document
  for (const docSnap of snapshot.docs) {
    const subcollections = await docSnap.ref.listCollections();
    for (const subcol of subcollections) {
      await copyCollection(sourceDb, targetDb, `${collectionPath}/${docSnap.id}/${subcol.id}`);
    }
  }
}

async function main() {
  const direction = process.argv[2];

  if (!direction || !['prod-to-dev', 'dev-to-prod'].includes(direction)) {
    console.log('');
    console.log('Usage:');
    console.log('  node sync-databases.js prod-to-dev     → Copy production → dev');
    console.log('  node sync-databases.js dev-to-prod     → Copy dev → production');
    console.log('');
    process.exit(1);
  }

  const sourceDb = direction === 'prod-to-dev' ? prodDb : devDb;
  const targetDb = direction === 'prod-to-dev' ? devDb : prodDb;
  const sourceLabel = direction === 'prod-to-dev' ? '(default) PRODUCTION' : 'examiners-dev';
  const targetLabel = direction === 'prod-to-dev' ? 'examiners-dev' : '(default) PRODUCTION';

  console.log('');
  console.log('🔥 Firestore Full Sync');
  console.log(`   Source: ${sourceLabel}`);
  console.log(`   Target: ${targetLabel}`);
  console.log('━'.repeat(50));

  // Auto-discover all root collections
  const rootCollections = await sourceDb.listCollections();

  if (rootCollections.length === 0) {
    console.log('⚠️  No collections found in source database.');
    process.exit(0);
  }

  console.log(`Found ${rootCollections.length} root collections\n`);

  for (const col of rootCollections) {
    await copyCollection(sourceDb, targetDb, col.id);
  }

  console.log('\n' + '━'.repeat(50));
  console.log(`🎉 Sync complete!`);
  console.log(`   Collections: ${totalCollections}`);
  console.log(`   Documents:   ${totalDocs}`);
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
