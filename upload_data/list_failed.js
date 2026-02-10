const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'examiners-app' });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('problems').where('tests_passed', '==', false).get();
  console.log('Total failed:', snap.size);
  snap.docs.forEach(d => console.log(d.id));
  process.exit(0);
})();
