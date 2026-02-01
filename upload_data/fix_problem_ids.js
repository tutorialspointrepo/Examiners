/**
 * Fix problem document IDs with trailing hyphens
 * 
 * Usage: node fix_problem_ids.js
 */

const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();

// Problems to fix
const problemsToFix = [
  {
    oldId: 'partition-string-',
    newId: 'partition-string',
    newTitle: 'Partition String'
  },
  {
    oldId: 'shortest-common-supersequence-',
    newId: 'shortest-common-supersequence',
    newTitle: 'Shortest Common Supersequence'
  }
];

async function fixProblemIds() {
  console.log('========================================');
  console.log('🔧 Fixing Problem IDs');
  console.log('========================================\n');

  for (const problem of problemsToFix) {
    console.log(`\n📝 Processing: "${problem.oldId}"`);
    console.log(`   → New ID: "${problem.newId}"`);

    try {
      // 1. Get old document
      const oldDocRef = db.collection('problems').doc(problem.oldId);
      const oldDoc = await oldDocRef.get();

      if (!oldDoc.exists) {
        console.log(`   ⚠️  Old document not found, skipping...`);
        continue;
      }

      // 2. Get data and update fields
      const data = oldDoc.data();
      data.id = problem.newId;
      data.slug = problem.newId;
      data.problem_id = problem.newId;
      data.title = problem.newTitle;
      data.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      // Update SEO fields if they exist
      if (data.seo) {
        data.seo.canonical = data.seo.canonical?.replace(problem.oldId, problem.newId);
        data.seo.ogImage = data.seo.ogImage?.replace(problem.oldId, problem.newId);
      }

      // 3. Create new document with correct ID
      const newDocRef = db.collection('problems').doc(problem.newId);
      await newDocRef.set(data);
      console.log(`   ✅ Created new document: "${problem.newId}"`);

      // 4. Delete old document
      await oldDocRef.delete();
      console.log(`   🗑️  Deleted old document: "${problem.oldId}"`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('✅ Fix Complete!');
  console.log('========================================\n');
}

fixProblemIds()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
