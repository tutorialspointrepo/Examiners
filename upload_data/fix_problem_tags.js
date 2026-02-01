/**
 * Fix Problematic Tags in Problems Collection
 * 
 * Usage: 
 *   node fix_problem_tags.js --check     (Preview changes without applying)
 *   node fix_problem_tags.js --fix       (Apply fixes)
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

// ==================== TAG FIXES ====================
// Format: 'old tag' : 'new tag' (or null to remove)

const TAG_REPLACEMENTS = {
  // Typos
  'Databse': 'Database',
  'Javascript': 'JavaScript',
  
  // Standardize naming (singular → plural, etc.)
  'Two Pointer': 'Two Pointers',
  'Sort': 'Sorting',
  'Pandas/Dataframe': 'Pandas',
  'Array manipulation': 'Array',
};

const TAGS_TO_REMOVE = [
  // Invalid tags (problem descriptions)
  'You are given a 0-indexed array nums consisting of n positive integers.',
  'The array nums is called alternating if:',
  'nums[i - 2] == nums[i]',
  'where 2 <= i <= n - 1.\nnums[i - 1] != nums[i]',
  'where 2 <= i <= n - 1.',
  'nums[i - 1] != nums[i]',
  'where 1 <= i <= n - 1.\nIn one operation',
  'where 1 <= i <= n - 1.',
  'In one operation',
  'you can choose an index i and change nums[i] into any positive integer.',
  'Return the minimum number of operations required to make the array alternating.',
  
  // Invalid single character or empty
  '\\',
  
  // Database-specific tags (not algorithm topics) - keep or remove based on preference
  'Window Functions',
  'Grouping & Aggregation', 
  'Conditional Logic',
];

// Tags longer than this will be removed (likely problem descriptions)
const MAX_TAG_LENGTH = 50;

async function fixTags(applyFix = false) {
  console.log('========================================');
  console.log(applyFix ? '🔧 FIXING Problem Tags' : '🔍 CHECKING Problem Tags (Preview)');
  console.log('========================================\n');

  const problemsSnapshot = await db.collection('problems').get();
  console.log(`📊 Total problems: ${problemsSnapshot.size}\n`);

  const changes = {
    replacements: [],
    removals: [],
    tooLong: [],
  };

  const problemsToUpdate = [];

  problemsSnapshot.forEach(doc => {
    const data = doc.data();
    const oldTags = data.tags || [];
    let newTags = [...oldTags];
    let hasChanges = false;
    const problemChanges = [];

    oldTags.forEach(tag => {
      if (!tag) return;

      // Check for replacements
      if (TAG_REPLACEMENTS[tag]) {
        const newTag = TAG_REPLACEMENTS[tag];
        changes.replacements.push({ problemId: doc.id, oldTag: tag, newTag });
        problemChanges.push(`Replace: "${tag}" → "${newTag}"`);
        newTags = newTags.map(t => t === tag ? newTag : t);
        hasChanges = true;
      }

      // Check for removals
      if (TAGS_TO_REMOVE.some(r => tag.includes(r) || r.includes(tag))) {
        changes.removals.push({ problemId: doc.id, tag });
        problemChanges.push(`Remove: "${tag.substring(0, 40)}${tag.length > 40 ? '...' : ''}"`);
        newTags = newTags.filter(t => t !== tag);
        hasChanges = true;
      }

      // Check for too long tags
      if (tag.length > MAX_TAG_LENGTH && !TAGS_TO_REMOVE.some(r => tag.includes(r))) {
        changes.tooLong.push({ problemId: doc.id, tag });
        problemChanges.push(`Remove (too long): "${tag.substring(0, 40)}..."`);
        newTags = newTags.filter(t => t !== tag);
        hasChanges = true;
      }
    });

    // Remove duplicates
    newTags = [...new Set(newTags)];

    if (hasChanges) {
      problemsToUpdate.push({
        id: doc.id,
        title: data.title,
        oldTags,
        newTags,
        changes: problemChanges
      });
    }
  });

  // Report
  console.log('────────────────────────────────────────');
  console.log('📋 CHANGES SUMMARY:');
  console.log('────────────────────────────────────────');
  console.log(`🔄 Tag replacements:    ${changes.replacements.length}`);
  console.log(`🗑️  Tag removals:        ${changes.removals.length}`);
  console.log(`📏 Too long removals:   ${changes.tooLong.length}`);
  console.log(`📝 Problems to update:  ${problemsToUpdate.length}`);

  // Show unique replacements
  const uniqueReplacements = [...new Set(changes.replacements.map(r => `${r.oldTag} → ${r.newTag}`))];
  if (uniqueReplacements.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log('🔄 UNIQUE REPLACEMENTS:');
    console.log('────────────────────────────────────────');
    uniqueReplacements.forEach((r, i) => console.log(`${i + 1}. ${r}`));
  }

  // Show problems being updated
  console.log('\n────────────────────────────────────────');
  console.log('📝 PROBLEMS TO UPDATE:');
  console.log('────────────────────────────────────────');
  problemsToUpdate.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.id}`);
    p.changes.forEach(c => console.log(`   ${c}`));
  });

  // Apply fixes if requested
  if (applyFix && problemsToUpdate.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log('🔧 APPLYING FIXES...');
    console.log('────────────────────────────────────────');

    const BATCH_SIZE = 400;
    let updated = 0;

    for (let i = 0; i < problemsToUpdate.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = problemsToUpdate.slice(i, i + BATCH_SIZE);

      chunk.forEach(p => {
        const docRef = db.collection('problems').doc(p.id);
        batch.update(docRef, { 
          tags: p.newTags,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      updated += chunk.length;
      console.log(`   ✅ Updated ${updated}/${problemsToUpdate.length} problems`);
    }

    console.log('\n========================================');
    console.log('✅ ALL FIXES APPLIED!');
    console.log('========================================');
  } else if (!applyFix && problemsToUpdate.length > 0) {
    console.log('\n========================================');
    console.log('⚠️  PREVIEW ONLY - No changes applied');
    console.log('   Run with --fix to apply changes');
    console.log('========================================');
  } else {
    console.log('\n========================================');
    console.log('✅ No issues found!');
    console.log('========================================');
  }

  return { changes, problemsToUpdate };
}

// Main
const args = process.argv.slice(2);
const applyFix = args.includes('--fix');

if (!args.includes('--check') && !args.includes('--fix')) {
  console.log('Usage:');
  console.log('  node fix_problem_tags.js --check   (Preview changes)');
  console.log('  node fix_problem_tags.js --fix     (Apply fixes)');
  process.exit(1);
}

fixTags(applyFix)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
