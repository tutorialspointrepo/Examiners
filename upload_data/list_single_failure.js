const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: 'examiners-app'
  });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('problems').where('tests_passed', '==', false).get();
  
  const results = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const report = data.tests_report;
    if (!report) return;
    
    let totalCombos = 0;
    let failingCombos = [];
    
    for (const [approach, langs] of Object.entries(report)) {
      if (typeof langs !== 'object') continue;
      for (const [lang, info] of Object.entries(langs)) {
        totalCombos++;
        if (info.passed === false) {
          // Count how many TCs failed in this combo
          const failedTCs = (info.results || []).filter(r => !r.passed).length;
          const statuses = [...new Set((info.results || []).filter(r => !r.passed).map(r => r.status))];
          failingCombos.push({ approach, lang, failedTCs, statuses: statuses.join(', ') });
        }
      }
    }
    
    if (failingCombos.length === 1) {
      results.push({
        id: doc.id,
        title: data.title || '',
        total: totalCombos,
        failing: failingCombos[0]
      });
    }
  });
  
  // Sort by id
  results.sort((a, b) => a.id.localeCompare(b.id));
  
  console.log(`\n📋 Problems with exactly 1 failing approach/lang combo: ${results.length}\n`);
  console.log('─'.repeat(120));
  
  for (const r of results) {
    const f = r.failing;
    console.log(`  ${r.id}`);
    console.log(`    ❌ ${f.approach}/${f.lang} — ${f.failedTCs} TC(s) failed [${f.statuses}]`);
    console.log(`    ✅ ${r.total - 1}/${r.total} combos passing`);
    console.log('');
  }
  
  console.log(`\nTotal: ${results.length} problems`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
