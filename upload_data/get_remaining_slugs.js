const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: 'examiners-app'
  });
}
const db = admin.firestore();

const EXCLUDE = new Set([
  'coin-change-ii',
  'random-flip-matrix',
  'longest-uncommon-subsequence-i',
  'longest-uncommon-subsequence-ii',
  'continuous-subarray-sum',
  'vowels-of-all-substrings',
  'longest-word-in-dictionary-through-deleting',
  'minimized-maximum-of-products-distributed-to-any-store',
  'maximum-path-quality-of-a-graph',
  'add-two-numbers',
  'number-of-equal-count-substrings',
  'longest-substring-without-repeating-characters',
  'check-whether-two-strings-are-almost-equivalent',
  'walking-robot-simulation-ii',
  'maximum-number-of-tasks-you-can-assign',
  'contiguous-array',
  'time-needed-to-buy-tickets',
  'decode-the-slanted-ciphertext',
  'reverse-nodes-in-even-length-groups',
  'beautiful-arrangement',
  'word-abbreviation',
  'minimum-cost-to-cut-a-stick',
  'the-most-similar-path-in-a-graph',
  'the-most-recent-orders-for-each-product',
  'three-consecutive-odds',
  'minimum-operations-to-make-array-equal',
  'magnetic-force-between-two-balls',
  'minimum-number-of-days-to-eat-n-oranges',
  'strings-differ-by-one-character',
  'thousand-separator',
  'split-the-array-to-make-coprime-products',
  'number-of-ways-to-earn-points',
  'kth-largest-sum-in-a-binary-tree',
  'pass-the-pillow',
  'minimum-time-to-visit-a-cell-in-a-grid',
  'split-with-minimum-sum',
  'count-total-number-of-colored-cells',
  'count-ways-to-group-overlapping-ranges',
  'count-number-of-possible-root-nodes',
  'find-the-maximum-number-of-marked-indices',
  'maximum-sum-of-two-non-overlapping-subarrays',
  'stream-of-characters',
  'moving-stones-until-consecutive',
  'coloring-a-border',
  'uncrossed-lines',
  'binary-search-tree-to-greater-sum-tree',
  'escape-a-large-maze',
  'minimum-score-triangulation-of-polygon',
  'moving-stones-until-consecutive-ii',
  'flower-planting-with-no-adjacent',
  'partition-array-for-maximum-sum',
]);

async function main() {
  console.log('Fetching all problems...');
  const snapshot = await db.collection('problems').get();
  
  const remaining = [];
  let excluded = 0;

  snapshot.forEach(doc => {
    const slug = doc.data().slug || doc.id;
    if (EXCLUDE.has(slug)) {
      excluded++;
    } else {
      remaining.push(slug);
    }
  });

  remaining.sort();

  // Write to file
  require('fs').writeFileSync('remaining_slugs.txt', remaining.join('\n'));

  console.log(`Total: ${snapshot.size}`);
  console.log(`Excluded: ${excluded}`);
  console.log(`Remaining: ${remaining.length}`);
  console.log(`Saved to: remaining_slugs.txt`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
