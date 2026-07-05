/**
 * Solutions Section Regenerator
 * Reads existing problems from Firebase, regenerates ONLY the solutions section,
 * and writes back without touching the problem section.
 *
 * Solutions section = approaches, defaultCode, solutionSummary, analogy, visualize
 * Problem section   = description, descriptionText, examples, testCases, constraints,
 *                     paramOrder, tableSchema, title, difficulty, tags, topics, etc.
 *
 * Usage:
 *   node regenerate_solutions.js                        — run all problems
 *   node regenerate_solutions.js --problem knight-dialer — run single problem
 *   node regenerate_solutions.js --dry-run              — fetch + show prompt, no API call, no Firebase write
 *   node regenerate_solutions.js --dry-run --problem knight-dialer — dry run single problem
 */

const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const ANTHROPIC_API_KEY = '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';
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

// ==================== PROBLEM LIST ====================
const PROBLEM_IDS = [
  'iterator-for-combination',
  'json-deep-equal',
  'jump-game',
  'jump-game-ii',
  'jump-game-vi',
  'k-closest-points-to-origin',
  'k-diff-pairs-in-an-array',
  'k-highest-ranked-items-within-a-price-range',
  'k-th-largest-perfect-subtree-size-in-binary-tree',
  'keys-and-rooms',
  'kth-ancestor-of-a-tree-node',
  'kth-largest-element-in-a-stream',
];

// ==================== INITIALIZE SERVICES ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID,
});

const db = admin.firestore();
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ==================== HELPER ====================

function isSQLProblem(topics = []) {
  const sqlKeywords = ['sql', 'database', 'mysql', 'postgresql', 'sqlite', 'window functions', 'joins', 'aggregation'];
  return topics.some(t => sqlKeywords.includes(t.toLowerCase()));
}

/**
 * Score an approach label by how universally common/valuable it is as a teaching approach.
 * This is problem-agnostic — purely based on approach type importance.
 *
 * Tier 1 (90-100): Brute force baseline — always keep
 * Tier 2 (70-89):  Most common interview patterns taught everywhere
 * Tier 3 (50-69):  Common but slightly more specialized
 * Tier 4 (30-49):  Valid but less commonly the "main" approach
 * Tier 5 (0-29):   Advanced/niche — drop when better options exist
 */
function scoreApproachLabel(label) {
  const l = label.toLowerCase();

  // Tier 1 — Brute force (always baseline)
  if (l.includes('brute force') || l.includes('brute-force') ||
      l.includes('naive') || l.includes('recursive brute')) return 100;

  // Tier 2 — Most common interview patterns
  if (l.includes('optimal')) return 89;
  if (l.includes('two pointer') || l.includes('two-pointer')) return 88;
  if (l.includes('sliding window')) return 87;
  if (l.includes('dynamic programming') || l.includes('bottom-up dp') || l.includes('bottom up dp')) return 86;
  if (l.includes('memoization') || l.includes('top-down dp') || l.includes('top down dp')) return 85;
  if (l.includes('hash map') || l.includes('hashmap') || l.includes('hash table')) return 84;
  if (l.includes('binary search')) return 83;
  if (l.includes('greedy')) return 82;
  if (l.includes('bfs') || l.includes('breadth-first') || l.includes('breadth first')) return 81;
  if (l.includes('dfs') || l.includes('depth-first') || l.includes('depth first')) return 80;

  // Tier 3 — Common but more specialized
  if (l.includes('iterative')) return 69;
  if (l.includes('stack')) return 68;
  if (l.includes('heap') || l.includes('priority queue')) return 67;
  if (l.includes('prefix sum') || l.includes('prefix')) return 66;
  if (l.includes('sorting') || l.includes('sort first') || l.includes('sort-first')) return 65;
  if (l.includes('backtracking')) return 64;
  if (l.includes('union find') || l.includes('disjoint set')) return 63;
  if (l.includes('monotonic')) return 62;
  if (l.includes('divide and conquer') || l.includes('divide & conquer')) return 61;
  if (l.includes('recursion')) return 60;
  if (l.includes('frequency count') || l.includes('frequency map')) return 59;

  // Tier 4 — Valid but less commonly the main approach
  if (l.includes('trie')) return 49;
  if (l.includes('bit manipulation') || l.includes('bitwise')) return 48;
  if (l.includes('math') || l.includes('mathematical')) return 47;
  if (l.includes('simulation')) return 46;
  if (l.includes('kadane')) return 45;
  if (l.includes('dutch flag') || l.includes('three-way')) return 44;

  // Tier 5 — Advanced/niche (drop when better options exist)
  if (l.includes('matrix exponentiation')) return 20;
  if (l.includes('segment tree')) return 19;
  if (l.includes('fenwick') || l.includes('binary indexed tree')) return 18;
  if (l.includes('advanced')) return 15;
  if (l.includes('sqrt decomposition')) return 14;
  if (l.includes('suffix array') || l.includes('suffix automaton')) return 13;

  // Unknown — give a middle score so it's not immediately dropped
  return 50;
}

/**
 * Extract top 3 approach labels from analogy.approaches, ranked by pedagogical value.
 * Brute force is always first. Remaining 2 are the highest-scoring non-brute approaches.
 * Throws if analogy is missing or has no approaches.
 */
function extractApproachLabels(doc) {
  if (!doc.analogy || typeof doc.analogy !== 'object') {
    throw new Error('analogy field is missing or invalid — cannot determine expected approaches');
  }
  if (!Array.isArray(doc.analogy.approaches) || doc.analogy.approaches.length === 0) {
    throw new Error('analogy.approaches is missing or empty — cannot determine expected approaches');
  }

  const all = doc.analogy.approaches.map((a, i) => ({
    label: a.label || a.title || `Approach ${i + 1}`,
    originalIndex: i,
    score: scoreApproachLabel(a.label || a.title || ''),
  }));

  // Always put brute force first (highest score among brute-type, or first entry as fallback)
  const bruteIdx = all.findIndex(a => a.score >= 100);
  const brute = bruteIdx !== -1 ? all[bruteIdx] : all[0];

  // Remaining approaches sorted by score descending
  const rest = all
    .filter(a => a !== brute)
    .sort((a, b) => b.score - a.score);

  // Pick top 2 from rest
  const selected = [brute, ...rest.slice(0, 2)];

  return selected.map(a => a.label);
}

// ==================== PROMPT ====================

/**
 * Build a prompt that includes the full problem context (read from Firestore)
 * but asks Claude to generate ONLY the solutions section fields.
 */
function buildSolutionsPrompt(doc) {
  const isSQL = doc.problemType === 'sql' || isSQLProblem(doc.tags || []);

  // Extract required approach labels from analogy — throws if missing
  const approachLabels = extractApproachLabels(doc);

  const problemContext = `
Problem ID: ${doc.problem_id || doc.id}
Title: ${doc.title}
Difficulty: ${doc.difficulty}
Type: ${isSQL ? 'SQL/Database' : 'Coding'}
Topics/Tags: ${(doc.tags || []).join(', ')}
Description (plain text): ${doc.descriptionText || doc.description?.replace(/<[^>]*>/g, '') || ''}
${!isSQL && doc.paramOrder ? `Parameter Order: ${JSON.stringify(doc.paramOrder)}` : ''}
${!isSQL && doc.testCases?.length ? `Sample Test Cases:\n${JSON.stringify(doc.testCases.slice(0, 3), null, 2)}` : ''}
${doc.examples?.length ? `Examples:\n${JSON.stringify(doc.examples.slice(0, 2), null, 2)}` : ''}
${doc.constraints?.length ? `Constraints:\n${doc.constraints.join('\n')}` : ''}
`.trim();

  if (isSQL) {
    return buildSQLSolutionsPrompt(doc, problemContext, approachLabels);
  } else {
    return buildCodingSolutionsPrompt(doc, problemContext, approachLabels);
  }
}

function buildCodingSolutionsPrompt(doc, problemContext, approachLabels) {
  const approachList = approachLabels.map((label, i) => `   ${i + 1}. "${label}"`).join('\n');

  return `You are an expert algorithm instructor generating the SOLUTIONS SECTION for a coding practice platform.

You are given the problem details below. Generate ONLY the solutions section — do NOT change or re-generate the problem description, examples, testCases, or constraints.

=== PROBLEM CONTEXT ===
${problemContext}

=== REQUIRED APPROACHES ===
You MUST generate EXACTLY these approaches in this order — these were pre-defined for this problem:
${approachList}

Map each label to the closest matching approach key from this list:
- "brute-force", "two-pointers", "sliding-window", "prefix-sum", "kadane", "dutch-flag"
- "hash-map", "two-pass-hash", "frequency-count"
- "binary-search", "binary-search-answer"
- "dfs", "bfs", "backtracking"
- "dp-1d", "dp-2d", "memoization"
- "greedy", "stack", "heap", "sort-first", "math", "bit-manipulation", "optimized"

Use the label text to infer the best key. For example:
- "Recursive Brute Force (Brute Force)" → key: "brute-force"
- "Dynamic Programming with Memoization (Optimal)" → key: "memoization"
- "Bottom-Up Dynamic Programming (Iterative)" → key: "dp-1d"
- "Matrix Exponentiation (Advanced)" → key: "optimized"

Do NOT add extra approaches. Do NOT skip any from the list above.

=== WHAT TO GENERATE ===
Generate a JSON object with EXACTLY these top-level keys:
- approaches
- solutionSummary

DO NOT generate "analogy", "visualize", or "defaultCode" fields — those belong to the problem section and must not be touched.

=== INSTRUCTIONS ===

1. APPROACHES:
   Generate EXACTLY the approaches listed in "REQUIRED APPROACHES" above — no more, no less.
   Use the mapped key for each approach (e.g. "brute-force", "memoization", etc.).
   
   COMMON APPROACH KEYS:
   - "brute-force" — naive solution
   - "two-pointers", "sliding-window", "prefix-sum", "kadane", "dutch-flag"
   - "hash-map", "two-pass-hash", "frequency-count"
   - "binary-search", "binary-search-answer"
   - "dfs", "bfs", "backtracking"
   - "dp-1d", "dp-2d", "memoization"
   - "greedy", "stack", "heap", "sort-first", "math", "bit-manipulation"

   Each approach must have WORKING code in all 6 languages: python, javascript, java, cpp, go, c.
   Function name MUST be "solution" in all languages.

   INPUT FORMAT (how test runner sends data to stdin):
   - Strings: plain text (NO quotes, NO json.loads for strings)
   - Integers: plain number
   - Arrays: JSON format [1,2,3]
   - Boolean: "true" or "false" (lowercase)
   - Each parameter on a NEW LINE

   OUTPUT FORMAT:
   - Strings: plain text (NO quotes around output)
   - Arrays: JSON [1,2,3]
   - Boolean: lowercase true/false
   - Integers/floats: plain number

   For Linked List or Tree problems: include ListNode/TreeNode class definition at the TOP of code in all languages.

   Each approach JSON shape:
   {
     "title": "...",
     "icon": "...",
     "summary": "one-liner",
     "description": "2-3 sentences",
     "steps": ["..."],
     "pros": ["..."],
     "cons": ["..."],
     "complexity": {
       "time": "O(?)", "timeExplain": "why",
       "space": "O(?)", "spaceExplain": "why"
     },
     "code": { "python": "...", "javascript": "...", "java": "...", "cpp": "...", "go": "...", "c": "..." },
     "visualization": {
       "title": "...", "description": "...",
       "steps": [{"stepNumber": 1, "title": "...", "description": "..."}],
       "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'>...</svg>"
     }
   }

2. SOLUTION SUMMARY:
   Brief HTML string highlighting the key insight and best approach. Use <strong> and <code> tags.

SVG RULES:
- viewBox="0 0 800 400", background #f8f9fa
- Use actual data from the problem examples
- No overlapping elements, min font size 14px
- Must start with <svg xmlns='http://www.w3.org/2000/svg' ...>
- Do NOT include XML comments inside SVG
- Keep SVG CONCISE — max ~20 elements, avoid excessive detail. Simple boxes, arrows, labels only.

COMPLEXITY COLORS:
- Time Green: O(1), O(n) | Orange: O(log n), O(n log n) | Red: O(n²)+
- Space Green: O(1) | Orange: O(n), O(log n) | Red: O(n²)+
- Use "O(n²)" not "O(n^2)"

Return ONLY the JSON object with keys: approaches, solutionSummary. No markdown.`;
}

function buildSQLSolutionsPrompt(doc, problemContext, approachLabels) {
  const approachList = approachLabels.map((label, i) => `   ${i + 1}. "${label}"`).join('\n');

  return `You are an expert SQL instructor generating the SOLUTIONS SECTION for a coding practice platform.

You are given the problem details below. Generate ONLY the solutions section — do NOT change or re-generate the problem description, examples, testCases, tableSchema, or constraints.

=== PROBLEM CONTEXT ===
${problemContext}

=== REQUIRED APPROACHES ===
You MUST generate EXACTLY these approaches in this order — these were pre-defined for this problem:
${approachList}

Map each label to the closest matching approach key from this list:
basic-query, inner-join, left-join, self-join, cross-join, group-by, having,
window-rank, window-aggregate, window-lead-lag, running-total,
subquery, correlated-subquery, cte, derived-table, union, case-when,
string-functions, date-functions, null-handling

Do NOT add extra approaches. Do NOT skip any from the list above.

=== WHAT TO GENERATE ===
Generate a JSON object with EXACTLY these top-level keys:
- approaches
- solutionSummary

DO NOT generate "analogy", "visualize", or "defaultCode" fields — those belong to the problem section and must not be touched.

=== INSTRUCTIONS ===

1. APPROACHES (SQL):
   Generate EXACTLY the approaches listed in "REQUIRED APPROACHES" above — no more, no less.
   Each approach must have working PostgreSQL (PGLite) compatible SQL code.
   
   Common approach keys: basic-query, inner-join, left-join, self-join, cross-join,
   group-by, having, window-rank, window-aggregate, window-lead-lag, running-total,
   subquery, correlated-subquery, cte, derived-table, union, case-when, string-functions,
   date-functions, null-handling

   Each approach JSON shape (same as coding but code only has "sql" key):
   {
     "title": "...", "icon": "...", "summary": "...", "description": "...",
     "steps": ["..."], "pros": ["..."], "cons": ["..."],
     "complexity": { "time": "O(...)", "timeExplain": "...", "space": "O(...)", "spaceExplain": "..." },
     "code": { "sql": "SELECT ..." },
     "visualization": { "title": "...", "description": "...", "steps": [...], "svg": "<svg ...>...</svg>" }
   }

2. SOLUTION SUMMARY:
   Brief HTML string. Use <strong> and <code>.

SVG RULES: viewBox="0 0 800 400", show actual table data, min font 12px, no overlapping. Keep SVG CONCISE — max ~20 elements, simple tables only.

Return ONLY the JSON object with keys: approaches, solutionSummary. No markdown.`;
}

// ==================== CORE LOGIC ====================

async function fetchFromFirebase(problemId) {
  const doc = await db.collection(COLLECTION_NAME).doc(problemId).get();
  if (!doc.exists) {
    throw new Error(`Document not found: ${problemId}`);
  }
  return doc.data();
}

async function generateSolutions(doc) {
  const prompt = buildSolutionsPrompt(doc);
  const isSQL = doc.problemType === 'sql' || isSQLProblem(doc.tags || []);

  console.log(`    🤖 Calling Claude for: ${doc.title}`);
  console.log(`    📋 Type: ${isSQL ? 'SQL' : 'Coding'}`);

  // Use streaming — required for max_tokens > ~8k to avoid timeout errors
  let responseText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason = null;

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 32000,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      responseText += event.delta.text;
    }
    if (event.type === 'message_delta') {
      stopReason = event.delta?.stop_reason || stopReason;
      outputTokens = event.usage?.output_tokens || outputTokens;
    }
    if (event.type === 'message_start') {
      inputTokens = event.message?.usage?.input_tokens || inputTokens;
    }
  }

  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;
  const totalCost = inputCost + outputCost;

  console.log(`    📊 Tokens — Input: ${inputTokens.toLocaleString()}, Output: ${outputTokens.toLocaleString()}`);
  console.log(`    💰 Cost: $${totalCost.toFixed(4)}`);

  if (stopReason === 'max_tokens') {
    console.log(`    ⚠️  WARNING: Response was TRUNCATED at 32,000 tokens — JSON may be incomplete`);
  }

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[1]); } catch {}
    }
    if (!parsed) {
      const s = responseText.indexOf('{');
      const e = responseText.lastIndexOf('}');
      if (s !== -1 && e !== -1) {
        try { parsed = JSON.parse(responseText.substring(s, e + 1)); } catch {}
      }
    }
    if (!parsed) throw new Error('Could not parse JSON response from Claude');
  }

  parsed._tokenUsage = { inputTokens, outputTokens, totalCost };
  return parsed;
}

async function updateFirebase(problemId, solutionsData, existingDoc, selectedLabels) {
  const SOLUTIONS_FIELDS = ['approaches', 'solutionSummary'];

  const update = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  for (const field of SOLUTIONS_FIELDS) {
    if (solutionsData[field] !== undefined) {
      update[field] = solutionsData[field];
    }
  }

  // Trim analogy.approaches to exactly the selected labels (same 3 passed to Claude)
  if (existingDoc.analogy && Array.isArray(existingDoc.analogy.approaches)) {
    const trimmedApproaches = existingDoc.analogy.approaches.filter(a =>
      selectedLabels.includes(a.label || a.title || '')
    );
    update.analogy = {
      ...existingDoc.analogy,
      approaches: trimmedApproaches,
    };
    const removed = existingDoc.analogy.approaches.length - trimmedApproaches.length;
    if (removed > 0) {
      console.log(`    ✂️  Trimmed analogy.approaches: ${existingDoc.analogy.approaches.length} → ${trimmedApproaches.length} (removed ${removed})`);
    }
  }

  if (solutionsData._tokenUsage) {
    update._generationMeta = {
      tokenUsage: solutionsData._tokenUsage,
      regeneratedAt: new Date().toISOString(),
      model: 'claude-sonnet-4-20250514',
      type: 'solutions-only',
    };
  }

  await db.collection(COLLECTION_NAME).doc(problemId).update(update);
  console.log(`    ✅ Updated solutions in Firebase: ${problemId}`);
}

// ==================== MAIN ====================

async function main() {
  // --- Parse CLI args ---
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const problemIdx = args.indexOf('--problem');
  const singleProblem = problemIdx !== -1 ? args[problemIdx + 1] : null;

  // Validate --problem value
  if (problemIdx !== -1 && !singleProblem) {
    console.error('❌ --problem flag requires a problem ID. Example: --problem knight-dialer');
    process.exit(1);
  }
  if (singleProblem && !PROBLEM_IDS.includes(singleProblem)) {
    console.error(`❌ Problem ID "${singleProblem}" not found in PROBLEM_IDS list.`);
    console.error(`   Available IDs:\n   ${PROBLEM_IDS.join('\n   ')}`);
    process.exit(1);
  }

  const queue = singleProblem ? [singleProblem] : PROBLEM_IDS;

  console.log('========================================');
  console.log('🔧 Solutions Section Regenerator');
  if (isDryRun) console.log('🧪 MODE: DRY RUN — no API calls, no Firebase writes');
  if (singleProblem) console.log(`🎯 MODE: Single problem — ${singleProblem}`);
  console.log(`📌 Problems to process: ${queue.length}`);
  console.log('========================================\n');

  let successCount = 0;
  let failCount = 0;
  let totalCost = 0;

  for (let i = 0; i < queue.length; i++) {
    const problemId = queue[i];
    console.log(`\n[${i + 1}/${queue.length}] Processing: ${problemId}`);
    console.log('─'.repeat(50));

    try {
      // 1. Fetch existing doc from Firebase
      console.log(`    📖 Fetching from Firebase...`);
      const existingDoc = await fetchFromFirebase(problemId);
      console.log(`    📌 Title:      ${existingDoc.title}`);
      console.log(`    📋 Type:       ${existingDoc.problemType || 'coding'}`);
      console.log(`    🏷️  Tags:       ${(existingDoc.tags || []).join(', ')}`);
      console.log(`    📐 paramOrder: ${JSON.stringify(existingDoc.paramOrder || [])}`);

      // Extract approach labels early — fail fast if analogy is missing
      const approachLabels = extractApproachLabels(existingDoc);
      const totalAnalogy = existingDoc.analogy?.approaches?.length || 0;
      console.log(`    🗂️  Approaches (top 3 of ${totalAnalogy}): ${approachLabels.map(l => `"${l}"`).join(', ')}`);
      if (totalAnalogy > 3) {
        console.log(`    ✂️  Will trim analogy.approaches from ${totalAnalogy} → 3`);
      }

      if (isDryRun) {
        // Show the prompt that would be sent — useful to verify before real run
        const prompt = buildSolutionsPrompt(existingDoc);
        console.log(`\n    ── PROMPT PREVIEW (first 800 chars) ──`);
        console.log(prompt.substring(0, 800) + (prompt.length > 800 ? '\n    ...[truncated]' : ''));
        console.log(`    ── END PREVIEW (total ${prompt.length} chars) ──`);
        console.log(`    ✅ Dry run complete for: ${problemId} — no writes made`);
        successCount++;
        continue;
      }

      // 2. Generate solutions via Claude
      const solutions = await generateSolutions(existingDoc);
      totalCost += solutions._tokenUsage?.totalCost || 0;

      // 3. Write only solutions fields back to Firebase
      await updateFirebase(problemId, solutions, existingDoc, approachLabels);
      successCount++;

    } catch (error) {
      console.error(`    ❌ Error: ${error.message}`);
      failCount++;
    }

    // Delay between requests (skip delay after last item or in dry run)
    if (!isDryRun && i < queue.length - 1) {
      console.log('    ⏳ Waiting 2 seconds...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  if (isDryRun) console.log('🧪 DRY RUN — nothing was written');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed:     ${failCount}`);
  if (!isDryRun) console.log(`💵 Total Cost: $${totalCost.toFixed(4)}`);
  console.log('========================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
