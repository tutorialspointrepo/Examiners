/**
 * Fix market-analysis-ii: 
 * - Ex1 user 3: 2nd sold item is LG, favorite is LG → should be 'yes' not 'no'
 * - Ex1 explanation also confirms this
 * Run: node fix_market_analysis2.js
 */
const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT), projectId: 'examiners-app' });
}
const db = admin.firestore();

function norm(d) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === 'object') return Object.keys(d).sort((a, b) => Number(a) - Number(b)).map(k => d[k]);
  return [];
}

async function main() {
  const ref = db.collection('problems').doc('market-analysis-ii');
  const doc = await ref.get();
  if (!doc.exists) { console.log('Not found'); process.exit(1); }
  const data = doc.data();
  const examples = norm(data.examples);

  // Fix Ex1 output: user 3 should be 'yes' (2nd item LG = favorite LG)
  const ex1 = examples[0];
  const outputRows = norm(ex1.output.rows);

  console.log('Before fix:', JSON.stringify(outputRows));

  for (const row of outputRows) {
    if (row.i0 === 3) {
      console.log('User 3 was:', row.i1, '→ changing to: yes');
      row.i1 = 'yes';
    }
  }

  // Also fix the explanation
  ex1.output.rows = outputRows;
  ex1.explanation = "<p>User 1 has no sales, so result is 'no'. User 2 sold HP first (2019-08-01) and Samsung second (2019-08-04) - Samsung matches their favorite brand, so 'yes'. User 3 sold Lenovo first (2019-08-02) and LG second (2019-08-03) - LG matches their favorite brand LG, so 'yes'. User 4 only sold one item, so 'no'.</p>";
  examples[0] = ex1;

  await ref.update({
    examples: examples,
    tests_passed: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('✅ Fixed: user 3 → yes (2nd item LG matches favorite LG)');
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
