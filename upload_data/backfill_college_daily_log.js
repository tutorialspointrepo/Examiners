#!/usr/bin/env node

/**
 * Backfill collegeDailyLearningLog from historical dailyLearningLog data
 * 
 * Usage:
 *   node backfill_college_daily_log.js --college TPX
 *   node backfill_college_daily_log.js --college TPX --project examiners-app
 */

const admin = require('firebase-admin');

// ─── CLI Arguments ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const COLLEGE_ID = getArg('--college');
const PROJECT = getArg('--project') || 'examiners-app';

if (!COLLEGE_ID) {
  console.log('Usage: node backfill_college_daily_log.js --college TPX');
  process.exit(1);
}

// ─── Init Firebase ──────────────────────────────────────────────────────────
const SERVICE_ACCOUNT = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT),
  projectId: PROJECT,
});
const db = admin.firestore();

async function main() {
  console.log(`\n📅 Backfilling collegeDailyLearningLog for college: ${COLLEGE_ID}`);
  console.log(`🔥 Project: ${PROJECT}\n`);

  // Fetch all dailyLearningLog docs for this college
  console.log('📊 Fetching dailyLearningLog...');
  const snapshot = await db.collection('dailyLearningLog')
    .where('collegeId', '==', COLLEGE_ID)
    .get();

  console.log(`   Found ${snapshot.size} daily log entries\n`);

  if (snapshot.size === 0) {
    console.log('⚠️  No daily logs found for this college. Nothing to backfill.');
    process.exit(0);
  }

  // Aggregate by date
  const dateAgg = new Map();
  snapshot.docs.forEach(d => {
    const data = d.data();
    const date = data.date || '';
    if (!date) return;

    if (!dateAgg.has(date)) {
      dateAgg.set(date, { timeSpent: 0, studentIds: new Set() });
    }
    const agg = dateAgg.get(date);
    agg.timeSpent += data.timeSpent || 0;
    if (data.userId) agg.studentIds.add(data.userId);
  });

  console.log(`📆 Aggregated into ${dateAgg.size} unique dates\n`);

  // Batch write (max 400 per batch)
  let totalWritten = 0;
  const entries = Array.from(dateAgg.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + 400);

    for (const [date, agg] of chunk) {
      const docRef = db.collection('collegeDailyLearningLog').doc(`${COLLEGE_ID}_${date}`);
      batch.set(docRef, {
        collegeId: COLLEGE_ID,
        date,
        timeSpent: agg.timeSpent,
        activeStudentIds: Array.from(agg.studentIds),
      });
    }

    await batch.commit();
    totalWritten += chunk.length;

    const firstDate = chunk[0][0];
    const lastDate = chunk[chunk.length - 1][0];
    console.log(`  ✅ Batch ${Math.floor(i / 400) + 1}: ${chunk.length} days written (${firstDate} → ${lastDate})`);
  }

  // Print summary
  const dates = entries.map(e => e[0]);
  const totalHours = Math.round(Array.from(dateAgg.values()).reduce((s, a) => s + a.timeSpent, 0) / 3600 * 10) / 10;
  const allStudents = new Set();
  dateAgg.forEach(agg => agg.studentIds.forEach(id => allStudents.add(id)));

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  📊 Backfill Complete`);
  console.log(`  College:       ${COLLEGE_ID}`);
  console.log(`  Days written:  ${totalWritten}`);
  console.log(`  Date range:    ${dates[0]} → ${dates[dates.length - 1]}`);
  console.log(`  Total hours:   ${totalHours}h`);
  console.log(`  Unique students: ${allStudents.size}`);
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
