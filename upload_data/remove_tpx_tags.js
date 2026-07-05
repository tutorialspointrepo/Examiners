// remove_tpx_tags.js
// Remove all tags from questions belonging to TPX college
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');

async function removeTPXTags() {
  console.log(`${DRY_RUN ? '🔍 DRY RUN — no changes' : '🔴 LIVE RUN — removing tags'}\n`);

  const questionsSnap = await db.collection('questionBank')
    .where('collegeId', '==', 'TPX')
    .get();

  console.log(`📊 TPX questions found: ${questionsSnap.size}\n`);

  let updated = 0;
  let skipped = 0;

  for (const doc of questionsSnap.docs) {
    const q = doc.data();
    const tags = q.tags || [];

    if (!Array.isArray(tags) || tags.length === 0) {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await doc.ref.update({ tags: [] });
    }
    updated++;
    console.log(`  ✅ ${doc.id}: removed ${tags.length} tag(s) — [${tags.join(', ')}]`);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  SUMMARY`);
  console.log(`═══════════════════════════════════════`);
  console.log(`  Total TPX questions:   ${questionsSnap.size}`);
  console.log(`  Tags removed from:     ${updated}`);
  console.log(`  Already no tags:       ${skipped}`);
  if (DRY_RUN) console.log('\n⚠️  Dry run. Run without --dry-run to apply.');

  process.exit(0);
}

removeTPXTags().catch(console.error);
