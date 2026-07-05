/**
 * fix_problems.js
 * Does two things across all problems:
 *   1. Fixes missing/empty paramOrder for coding problems (inferred from approaches.code.python)
 *   2. Removes tests_passed, tests_report, tests_validated_at from ALL problems
 *
 * Usage:
 *   node fix_problems.js              — run on all problems
 *   node fix_problems.js --dry-run    — preview without writing
 *   node fix_problems.js --problem knight-dialer  — single problem
 */

const admin = require('firebase-admin');

const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

// Fields to delete from every document
const FIELDS_TO_DELETE = ['tests_passed', 'tests_report', 'tests_validated_at'];

// ==================== INFER paramOrder ====================

/**
 * Infer paramOrder from approaches[x].code.python function signature.
 * Looks for: def solution(param1, param2, ...):
 * Uses the first approach that has python code.
 */
function inferParamOrder(doc) {
  const approaches = doc.approaches;

  if (!approaches || typeof approaches !== 'object') return null;

  for (const key of Object.keys(approaches)) {
    const pythonCode = approaches[key]?.code?.python;
    if (!pythonCode) continue;

    // Match first function def: def anyFunctionName(param1, param2, ...):
    const match = pythonCode.match(/def\s+\w+\s*\(([^)]*)\)/);
    if (!match) continue;

    const paramStr = match[1].trim();
    if (!paramStr) return [];

    const params = paramStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (params.length > 0) return params;
  }

  return null;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const problemIdx = args.indexOf('--problem');
  const singleProblem = problemIdx !== -1 ? args[problemIdx + 1] : null;

  console.log('========================================');
  console.log('🔧 Problem Fixer');
  console.log('   1. Fix missing paramOrder (coding problems)');
  console.log('   2. Remove tests_passed, tests_report, tests_validated_at');
  if (isDryRun) console.log('🧪 DRY RUN — no writes');
  if (singleProblem) console.log(`🎯 Single: ${singleProblem}`);
  else console.log('🌐 All problems');
  console.log('========================================\n');

  let docs = [];

  if (singleProblem) {
    const snap = await db.collection(COLLECTION_NAME).doc(singleProblem).get();
    if (!snap.exists) {
      console.error(`❌ Not found: ${singleProblem}`);
      process.exit(1);
    }
    docs = [snap];
  } else {
    const snap = await db.collection(COLLECTION_NAME).get();
    docs = snap.docs;
    console.log(`📊 Found ${docs.length} total problems\n`);
  }

  let paramFixed = 0;
  let paramSkipped = 0;
  let paramFailed = 0;
  let fieldsRemoved = 0;

  for (const docSnap of docs) {
    const slug = docSnap.id;
    const doc = docSnap.data();
    const isSQL = doc.problemType === 'sql';
    const update = {};

    // ── Task 1: Fix paramOrder (coding only) ──
    let paramStatus = '';
    if (!isSQL) {
      if (Array.isArray(doc.paramOrder) && doc.paramOrder.length > 0) {
        paramStatus = `paramOrder ✓ ${JSON.stringify(doc.paramOrder)}`;
        paramSkipped++;
      } else {
        const inferred = inferParamOrder(doc);
        if (inferred) {
          update.paramOrder = inferred;
          paramStatus = `paramOrder → ${JSON.stringify(inferred)}`;
          paramFixed++;
        } else {
          paramStatus = `paramOrder ✗ cannot infer`;
          paramFailed++;
        }
      }
    } else {
      paramStatus = 'SQL — skip paramOrder';
    }

    // ── Task 2: Remove test fields from ALL problems ──
    const presentTestFields = FIELDS_TO_DELETE.filter(f => f in doc);
    if (presentTestFields.length > 0) {
      for (const f of presentTestFields) {
        update[f] = admin.firestore.FieldValue.delete();
      }
      fieldsRemoved += presentTestFields.length;
    }

    // ── Log ──
    const hasUpdate = Object.keys(update).length > 0;
    const deleteStr = presentTestFields.length > 0
      ? `🗑️  removed: ${presentTestFields.join(', ')}`
      : '🗑️  nothing to remove';

    console.log(`${slug}`);
    console.log(`   ${paramStatus}`);
    console.log(`   ${deleteStr}`);

    // ── Write ──
    if (hasUpdate && !isDryRun) {
      await db.collection(COLLECTION_NAME).doc(slug).update(update);
      console.log(`   ✅ written`);
    } else if (hasUpdate && isDryRun) {
      console.log(`   ⏸️  dry run — not written`);
    }
  }

  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`paramOrder fixed:   ${paramFixed}`);
  console.log(`paramOrder skipped: ${paramSkipped} (already had it)`);
  console.log(`paramOrder failed:  ${paramFailed} (could not infer)`);
  console.log(`test fields removed: ${fieldsRemoved}`);
  if (isDryRun) console.log('🧪 DRY RUN — nothing was written');
  console.log('========================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
