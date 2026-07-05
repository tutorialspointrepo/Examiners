
// list_all_tags.js
// List all unique tags across all questions, grouped by college, with count
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function listAllTags() {
  console.log('🔍 Fetching all questions to extract tags...\n');

  const questionsSnap = await db.collection('questionBank').get();
  console.log(`📊 Total questions: ${questionsSnap.size}\n`);

  // Global tags: tag → count
  const globalTags = {};
  // Per college: collegeId → { tag → count }
  const collegeTags = {};
  let questionsWithNoTags = 0;
  let questionsWithTags = 0;

  questionsSnap.forEach(doc => {
    const q = doc.data();
    const collegeId = q.collegeId || q.board || '(unknown)';
    const tags = q.tags || [];

    if (!collegeTags[collegeId]) collegeTags[collegeId] = {};

    if (!Array.isArray(tags) || tags.length === 0) {
      questionsWithNoTags++;
      return;
    }

    questionsWithTags++;
    tags.forEach(tag => {
      const t = (tag || '').toString().trim();
      if (!t) return;
      globalTags[t] = (globalTags[t] || 0) + 1;
      collegeTags[collegeId][t] = (collegeTags[collegeId][t] || 0) + 1;
    });
  });

  // Print per college
  for (const [collegeId, tags] of Object.entries(collegeTags)) {
    const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) continue;

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  📚 ${collegeId} — ${sorted.length} unique tags`);
    console.log(`═══════════════════════════════════════`);
    console.table(sorted.map(([tag, count]) => ({ Tag: tag, Questions: count })));
  }

  // Global summary
  const globalSorted = Object.entries(globalTags).sort((a, b) => b[1] - a[1]);
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  🌐 ALL TAGS (Global) — ${globalSorted.length} unique`);
  console.log(`═══════════════════════════════════════`);
  console.table(globalSorted.map(([tag, count]) => ({ Tag: tag, Questions: count })));

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  SUMMARY`);
  console.log(`═══════════════════════════════════════`);
  console.log(`  Total questions:       ${questionsSnap.size}`);
  console.log(`  With tags:             ${questionsWithTags}`);
  console.log(`  Without tags:          ${questionsWithNoTags}`);
  console.log(`  Unique tags (global):  ${globalSorted.length}`);
  console.log(`  Colleges:              ${Object.keys(collegeTags).join(', ')}`);

  process.exit(0);
}

listAllTags().catch(console.error);
