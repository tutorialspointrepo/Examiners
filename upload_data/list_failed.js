const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'examiners-app' });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('problems').where('problemType', '!=', 'sql').get();
  const failed = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.tests_passed !== true) failed.push(doc.id);
  });
  failed.sort();
  console.log(`❌ ${failed.length} problems with tests_passed !== true:\n`);
  failed.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
  process.exit(0);
})();
