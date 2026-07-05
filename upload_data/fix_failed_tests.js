/**
 * Fix Failed Tests - v3
 * 
 * Strategy (in order):
 *   1. Auto-fix known C issues (strtok parsing, stack overflow, N-ary tree)
 *   2. Fix blank/empty/corrupted test cases (including wrong expected values)
 *   3. Run ALL approach/lang combos through Judge0 to find which pass
 *   4. Per approach — two-path strategy:
 *      PATH A: At least one lang passes → TCs are correct → translate to failing langs
 *              (batch translate → compile → error-feedback retry x3 per lang)
 *      PATH B: No lang passes → fix code+TCs together until one lang passes
 *              (send problem+code+TCs to AI, ask to fix both → compile → retry x3)
 *              → once one passes, translate to all other langs (same as Path A)
 *   5. Final validation
 *
 * Usage:
 *   node fix_failed_tests.js --test <problem_id>
 *   node fix_failed_tests.js --test-apply <problem_id>
 *   node fix_failed_tests.js --list-failed [limit]
 *   node fix_failed_tests.js --fix-all [limit]
 *   node fix_failed_tests.js --fix-apply-all [limit]
 *   node fix_failed_tests.js --create-batch [limit]
 *   node fix_failed_tests.js --check-batch <batch_id>
 *   node fix_failed_tests.js --process-results <batch_id>
 */

const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const ANTHROPIC_API_KEY = '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';
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';
const JUDGE0_BASE_URL = 'https://tpcg2.tutorialspoint.com/judge0';
const MODEL_SONNET = 'claude-sonnet-4-20250514';
const MAX_COST_PER_PROBLEM = 0.25;
const MODEL_PRICING = {
  [MODEL_SONNET]: { input: 3, output: 15 },
};

const LANGUAGE_IDS = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  c: 50,
  go: 60,
};

// Preferred order for reference language selection
const LANG_PREFERENCE = ['python', 'javascript', 'java', 'cpp', 'go', 'c'];

// ==================== INITIALIZE SERVICES ====================
let db = null;

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
      projectId: FIREBASE_PROJECT_ID
    });
  }
  db = admin.firestore();
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// ==================== CODE CORRUPTION DETECTION ====================

function isCodeCorrupted(code) {
  if (!code || typeof code !== 'string') return true;
  const corruptionPatterns = [
    /__PLACEHOLDER_\d+__/,
    /\0/,
    /[\x00-\x08\x0E-\x1F]/,
  ];
  for (const pattern of corruptionPatterns) {
    if (pattern.test(code)) return true;
  }
  if (code.includes('{')) {
    const opens = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;
    if (opens - closes > 3) return true;
  }
  return false;
}

// ==================== C STRTOK AUTO-FIX ====================

function fixCStrtokParsing(code) {
  if (!code || typeof code !== 'string') return { code, fixed: false };
  if (!code.includes('strtok')) return { code, fixed: false };
  if (!/strtok\s*\([^)]*"[^"]*[\[\]]/.test(code)) return { code, fixed: false };
  if (code.includes('strtol') && code.includes('parseArray')) return { code, fixed: false };
  
  const parseArrayFunc = `void parseArray(const char* str, int* arr, int* size) {
    *size = 0;
    const char* p = str;
    while (*p && *p != '[') p++;
    if (*p == '[') p++;
    while (*p && *p != ']') {
        while (*p == ' ' || *p == ',') p++;
        if (*p == ']' || *p == '\\0') break;
        arr[(*size)++] = (int)strtol(p, (char**)&p, 10);
    }
}`;

  let fixed = code;
  const hasParseArrayFunc = /void\s+parseArray\s*\(/.test(fixed);
  
  if (hasParseArrayFunc) {
    fixed = fixed.replace(
      /void\s+parseArray\s*\([^)]*\)\s*\{[^}]*strtok[^}]*\}/s,
      parseArrayFunc
    );
  } else {
    fixed = fixed.replace(/(int\s+main\s*\()/, parseArrayFunc + '\n\n$1');
  }
  
  const wasFixed = fixed !== code;
  if (wasFixed) {
    const opens = (fixed.match(/\{/g) || []).length;
    const closes = (fixed.match(/\}/g) || []).length;
    if (Math.abs(opens - closes) > 3) return { code, fixed: false };
  }
  return { code: fixed, fixed: wasFixed };
}

function autoFixCParsing(problem) {
  const fixes = [];
  if (!problem.approaches) return { problem, fixes };
  for (const [approach, data] of Object.entries(problem.approaches)) {
    if (!data.code?.c) continue;
    const result = fixCStrtokParsing(data.code.c);
    if (result.fixed) {
      problem.approaches[approach].code.c = result.code;
      fixes.push(`${approach}/c`);
    }
  }
  if (fixes.length > 0) {
    console.log(`    🔧 Auto-fixed strtok→strtol parsing in: ${fixes.join(', ')}`);
  }
  return { problem, fixes };
}

// ==================== C STACK OVERFLOW AUTO-FIX ====================

function fixCStackOverflow(code) {
  if (!code || typeof code !== 'string') return { code, fixed: false };
  if (!code.includes('{')) return { code, fixed: false };
  
  const TYPE_SIZES = {
    'char': 1, 'unsigned char': 1, 'int': 4, 'unsigned int': 4,
    'long': 8, 'long long': 8, 'float': 4, 'double': 8,
    'bool': 1, '_Bool': 1, 'size_t': 8, 'int64_t': 8, 'int32_t': 4,
  };
  
  const lines = code.split('\n');
  const newLines = [];
  let braceDepth = 0;
  let madeChanges = false;
  const STACK_THRESHOLD = 1 * 1024 * 1024;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
    const openBraces = (stripped.match(/\{/g) || []).length;
    const closeBraces = (stripped.match(/\}/g) || []).length;
    
    let modified = false;
    if (braceDepth >= 1) {
      const arrMatch = line.match(/^(\s*)((?:static\s+)?)((?:unsigned\s+|signed\s+|long\s+|short\s+)?(?:char|int|short|long|float|double|bool|_Bool|size_t|u?int(?:8|16|32|64)_t|\w+))\s+(\w+)((?:\s*\[\s*[\w+*\/ ]+\s*\])+)\s*;/);
      
      if (arrMatch && !arrMatch[2].includes('static')) {
        const typeName = arrMatch[3].trim();
        const varName = arrMatch[4];
        const dims = arrMatch[5];
        let baseSize = TYPE_SIZES[typeName] || 8;
        let totalElements = 1;
        const dimPattern = /\[\s*([\w+*\/ ]+)\s*\]/g;
        let dimMatch;
        while ((dimMatch = dimPattern.exec(dims)) !== null) {
          try {
            const dimVal = Function('"use strict"; return (' + dimMatch[1].trim() + ')')();
            if (typeof dimVal === 'number' && dimVal > 0) totalElements *= dimVal;
          } catch (e) { totalElements *= 1000; }
        }
        const estimatedBytes = baseSize * totalElements;
        if (estimatedBytes >= STACK_THRESHOLD) {
          const newLine = line.replace(
            /^(\s*)((?:unsigned\s+|signed\s+|long\s+|short\s+)?(?:char|int|short|long|float|double|bool|_Bool|size_t|u?int(?:8|16|32|64)_t|\w+)\s+\w+(?:\s*\[\s*[\w+*\/ ]+\s*\])+\s*;)/,
            '$1static $2'
          );
          newLines.push(newLine);
          modified = true;
          madeChanges = true;
          const sizeMB = (estimatedBytes / 1024 / 1024).toFixed(1);
          console.log(`    🔧 Stack overflow fix: "${typeName} ${varName}${dims}" (~${sizeMB}MB) → added 'static'`);
        }
      }
    }
    if (!modified) newLines.push(line);
    braceDepth += openBraces - closeBraces;
    if (braceDepth < 0) braceDepth = 0;
  }
  
  return { code: madeChanges ? newLines.join('\n') : code, fixed: madeChanges };
}

function autoFixCStackOverflow(problem) {
  const fixes = [];
  if (!problem.approaches) return { problem, fixes };
  for (const [approach, data] of Object.entries(problem.approaches)) {
    if (!data.code?.c) continue;
    const result = fixCStackOverflow(data.code.c);
    if (result.fixed) {
      problem.approaches[approach].code.c = result.code;
      fixes.push(`${approach}/c`);
    }
  }
  if (fixes.length > 0) {
    console.log(`    🔧 Auto-fixed C stack overflow (large local arrays → static) in: ${fixes.join(', ')}`);
  }
  return { problem, fixes };
}


// ==================== C N-ARY TREE AUTO-FIX ====================

/**
 * Detects broken N-ary tree buildTree/printTree in C code and replaces both
 * with correct BFS-based implementations.
 *
 * Broken buildTree: two-pass (create all nodes, then link) — wrong for N-ary format.
 * Broken printTree: adds null after every individual node instead of after each
 *   node's children group.
 *
 * Correct serialization format: root_val, children_of_root..., null, children_of_c1..., null, ...
 *   - null comes AFTER each node's children group, not before
 *   - Trailing nulls stripped except the one null after the last non-null value
 */
function fixCNaryTree(code) {
  if (!code || typeof code !== 'string') return { code, fixed: false };

  const hasBrokenBuildTree = (
    /First pass.*create.*node/i.test(code) ||
    /Second pass.*build.*parent/i.test(code) ||
    (/buildTree\s*\(\s*\)/.test(code) && /nodesCount\s*=\s*0/.test(code) && /nodeIdx/.test(code))
  );

  const hasBrokenPrintTree = (
    /childrenSize\s*>\s*0[\s\S]{0,200}printf.*null/m.test(code) &&
    /front\s*<\s*rear[\s\S]{0,100}printf.*null/m.test(code)
  );

  if (!hasBrokenBuildTree && !hasBrokenPrintTree) return { code, fixed: false };

  const maxNMatch = code.match(/#define\s+MAX[_N]*\s+(\d+)/);
  const maxN = maxNMatch ? Math.max(parseInt(maxNMatch[1]), 1000) : 1000;

  const correctBuildTree = `
/* ---- FIXED buildTree: BFS-based N-ary deserialization ---- */
/* Format: root, children_of_root..., null, children_of_c1..., null, ... */
struct Node* buildTree() {
    if (dataSize == 0 || isNullData[0]) return NULL;
    nodesCount = 0;
    nodes[nodesCount] = createNode(parseData[0]);
    nodesCount++;

    struct Node* bfsQ[${maxN}];
    int bfsF = 0, bfsR = 0;
    bfsQ[bfsR++] = nodes[0];

    int i = 1;
    while (bfsF < bfsR && i < dataSize) {
        struct Node* cur = bfsQ[bfsF++];
        while (i < dataSize && !isNullData[i]) {
            struct Node* child = createNode(parseData[i++]);
            addChild(cur, child);
            nodes[nodesCount++] = child;
            bfsQ[bfsR++] = child;
        }
        if (i < dataSize && isNullData[i]) i++;
    }
    return nodes[0];
}`;

  const correctPrintTree = `
/* ---- FIXED printTree: BFS N-ary serialization ---- */
/* Format: root_val, children_of_root..., null, children_of_c1..., null, ... */
void printTree(struct Node* root) {
    if (!root) { printf("[]"); return; }

    static int outVals[${maxN * 4}];
    static int outIsNull[${maxN * 4}];
    int outSize = 0;

    outIsNull[outSize] = 0; outVals[outSize] = root->val; outSize++;

    struct Node* bfsQ[${maxN}];
    int bfsF = 0, bfsR = 0;
    bfsQ[bfsR++] = root;

    while (bfsF < bfsR) {
        struct Node* node = bfsQ[bfsF++];
        for (int ci = 0; ci < node->childrenSize; ci++) {
            struct Node* child = node->children[ci];
            outIsNull[outSize] = 0; outVals[outSize] = child->val; outSize++;
            bfsQ[bfsR++] = child;
        }
        outIsNull[outSize] = 1; outVals[outSize] = 0; outSize++;
    }

    /* Keep through null after last non-null value, drop the rest */
    int lastVal = -1;
    for (int i = outSize - 1; i >= 0; i--) { if (!outIsNull[i]) { lastVal = i; break; } }
    if (lastVal >= 0 && lastVal + 1 < outSize && outIsNull[lastVal + 1]) outSize = lastVal + 2;
    else if (lastVal >= 0) outSize = lastVal + 1;
    else { printf("[]"); return; }

    printf("[");
    for (int i = 0; i < outSize; i++) {
        if (i) printf(",");
        if (outIsNull[i]) printf("null"); else printf("%d", outVals[i]);
    }
    printf("]");
}`;

  let fixed = code;
  if (hasBrokenBuildTree) {
    fixed = fixed.replace(
      /struct\s+Node\*\s+buildTree\s*\(\s*\)\s*\{[\s\S]*?\n\}/,
      correctBuildTree
    );
  }
  if (hasBrokenPrintTree) {
    fixed = fixed.replace(
      /void\s+printTree\s*\(\s*struct\s+Node\*\s+\w+\s*\)\s*\{[\s\S]*?\n\}/,
      correctPrintTree
    );
  }

  const wasFixed = fixed !== code;
  if (wasFixed) {
    const opens = (fixed.match(/\{/g) || []).length;
    const closes = (fixed.match(/\}/g) || []).length;
    if (Math.abs(opens - closes) > 3) return { code, fixed: false };
  }
  return { code: fixed, fixed: wasFixed };
}

function autoFixCNaryTree(problem) {
  const fixes = [];
  if (!problem.approaches) return { problem, fixes };
  for (const [approach, data] of Object.entries(problem.approaches)) {
    if (!data.code?.c) continue;
    const result = fixCNaryTree(data.code.c);
    if (result.fixed) {
      problem.approaches[approach].code.c = result.code;
      fixes.push(`${approach}/c`);
    }
  }
  if (fixes.length > 0) {
    console.log(`    🔧 Auto-fixed N-ary tree buildTree/printTree in: ${fixes.join(', ')}`);
  }
  return { problem, fixes };
}

/**
 * Returns true if the problem appears to use N-ary tree node/children structure.
 */
function isNaryTreeProblem(problem) {
  const code = Object.values(problem.approaches || {})
    .flatMap(a => Object.values(a.code || {})).join('\n');
  return /struct\s+Node/.test(code) && /children/.test(code) && /buildTree|printTree/.test(code);
}

function parseNaryTree(s) {
  s = (s || '').trim();
  if (s === '[]') return { children: {}, root: null };
  const raw = s.slice(1, -1).split(',').map(t => t.trim() === 'null' ? null : parseInt(t.trim()));
  if (!raw.length || raw[0] === null) return { children: {}, root: null };
  const root = raw[0];
  const children = { [root]: [] };
  const queue = [root];
  let front = 0, i = 1;
  while (front < queue.length && i < raw.length) {
    const cur = queue[front++];
    if (!children[cur]) children[cur] = [];
    while (i < raw.length && raw[i] !== null) {
      const child = raw[i++];
      children[cur].push(child);
      if (!children[child]) children[child] = [];
      queue.push(child);
    }
    if (i < raw.length && raw[i] === null) i++;
  }
  return { children, root };
}

function serializeNaryTree(children, root) {
  if (root === null || root === undefined) return '[]';
  const out = [root];
  const queue = [root]; let front = 0;
  while (front < queue.length) {
    const node = queue[front++];
    for (const child of (children[node] || [])) { out.push(child); queue.push(child); }
    out.push(null);
  }
  let lastVal = -1;
  for (let i = out.length - 1; i >= 0; i--) { if (out[i] !== null) { lastVal = i; break; } }
  if (lastVal < 0) return '[]';
  const trimmed = (lastVal + 1 < out.length && out[lastVal + 1] === null)
    ? out.slice(0, lastVal + 2) : out.slice(0, lastVal + 1);
  return '[' + trimmed.map(x => x === null ? 'null' : String(x)).join(',') + ']';
}

function computeNaryMoveResult(rootStr, p, q) {
  try {
    let { children, root } = parseNaryTree(rootStr);
    if (root === null) return null;
    p = parseInt(p); q = parseInt(q);
    if (p === q) return serializeNaryTree(children, root);

    let pParent = null;
    for (const [node, ch] of Object.entries(children)) {
      if (ch.includes(p)) { pParent = parseInt(node); break; }
    }
    if (pParent === q) return serializeNaryTree(children, root); // already direct child of q

    // Is q in p's subtree?
    const subtree = new Set();
    const stk = [p];
    while (stk.length) { const n = stk.pop(); subtree.add(n); for (const c of (children[n] || [])) stk.push(c); }

    if (subtree.has(q)) {
      if (pParent !== null) children[pParent] = children[pParent].filter(c => c !== p);
      children[q].push(p);
      return serializeNaryTree(children, pParent === null ? q : root);
    } else {
      if (pParent !== null) children[pParent] = children[pParent].filter(c => c !== p);
      children[q].push(p);
      return serializeNaryTree(children, root);
    }
  } catch (e) { return null; }
}

/**
 * Recomputes correct expected values for all N-ary tree test cases.
 * Returns array of { index, expected } fixes for any that are wrong.
 */
function autoFixNaryTestCases(problem) {
  if (!isNaryTreeProblem(problem)) return [];
  const testCases = problem.testCases || [];
  if (!testCases.length) return [];

  const paramOrder = problem.paramOrder || [];
  const rootKey = paramOrder.find(k => /root/i.test(k)) || 'root';
  const pKey = paramOrder.find(k => k === 'p') || 'p';
  const qKey = paramOrder.find(k => k === 'q') || 'q';

  const fixes = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const input = tc.input || {};
    const rootStr = input[rootKey];
    const p = input[pKey];
    const q = input[qKey];
    if (!rootStr || p === undefined || q === undefined) continue;

    const correct = computeNaryMoveResult(rootStr, p, q);
    if (correct === null) continue;

    const current = String(tc.expected || '').trim();
    if (current !== correct) {
      console.log(`    🔧 N-ary TC${i + 1}: expected="${current}" → correct="${correct}"`);
      fixes.push({ index: i, expected: correct });
    }
  }
  return fixes;
}

// ==================== TEST CASE SANITIZATION ====================

function isInputValueBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function checkTestCaseForBlanks(testCase) {
  if (!testCase.input) return { hasBlank: true, blankKeys: ['(no input)'] };
  const blankKeys = [];
  if (typeof testCase.input === 'string') {
    if (testCase.input.trim() === '') blankKeys.push('(entire input)');
  } else if (typeof testCase.input === 'object') {
    for (const [key, value] of Object.entries(testCase.input)) {
      if (isInputValueBlank(value)) blankKeys.push(key);
    }
  }
  return { hasBlank: blankKeys.length > 0, blankKeys };
}

function findBlankTestCases(testCases) {
  const blanks = [];
  for (let i = 0; i < testCases.length; i++) {
    const check = checkTestCaseForBlanks(testCases[i]);
    if (check.hasBlank) {
      blanks.push({ index: i, tc: i + 1, blankKeys: check.blankKeys, testCase: testCases[i] });
    }
  }
  return blanks;
}

async function fixBlankTestCases(problem) {
  const testCases = problem.testCases || [];
  if (testCases.length === 0) return null;

  const blanks = findBlankTestCases(testCases);
  if (blanks.length === 0) return null;

  console.log(`    ⚠️  Found ${blanks.length} test case(s) with blank/empty input values:`);
  for (const b of blanks) {
    console.log(`      TC${b.tc}: blank keys=[${b.blankKeys.join(', ')}]`);
  }

  // Build input structure from a non-blank TC
  let inputStructure = '{}';
  const nonBlankTc = testCases.find(tc => !checkTestCaseForBlanks(tc).hasBlank);
  if (nonBlankTc) {
    const structKeys = {};
    for (const [key, value] of Object.entries(nonBlankTc.input || {})) {
      structKeys[key] = Array.isArray(value) ? 'array of integers' : typeof value;
    }
    inputStructure = JSON.stringify(structKeys);
  }

  const blankDetails = blanks.map(b => `  TC${b.tc} (index ${b.index}): blank keys=[${b.blankKeys.join(', ')}], current=${JSON.stringify(b.testCase)}`).join('\n');
  const allTcJson = testCases.map((tc, i) => `  TC${i + 1}: ${JSON.stringify(tc)}`).join('\n');

  const prompt = `You are a test case generator. Some test cases have BLANK/EMPTY input values.

**PROBLEM:** ${problem.title}
- Description: ${problem.description || problem.descriptionText}
- Parameter order: ${JSON.stringify(problem.paramOrder || [])}
- Input structure: ${inputStructure}

**ALL CURRENT TEST CASES:**
${allTcJson}

**BLANK TEST CASES THAT NEED FIXING:**
${blankDetails}

For each blank test case, generate a REPLACEMENT with:
1. Non-empty input values for ALL keys
2. Correct expected output
3. Simple, small values easy to verify

Return ONLY valid JSON:
{
  "fixes": {
    "testCases": [
      { "index": 0, "input": { ... }, "expected": "value", "explanation": "..." }
    ]
  }
}`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET, max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });
    const cost = calcCost(resp.usage);
    console.log(`    📊 [TC Fix] ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

    const parsed = parseJsonResponse(resp.content[0]?.text || '');
    if (parsed?.fixes?.testCases?.length > 0) {
      const validFixes = parsed.fixes.testCases.filter(fix => {
        if (fix.index === undefined || fix.index < 0 || fix.index >= testCases.length) return false;
        if (!fix.input || typeof fix.input !== 'object') return false;
        for (const [key, value] of Object.entries(fix.input)) {
          if (isInputValueBlank(value)) return false;
        }
        return true;
      });
      if (validFixes.length > 0) {
        console.log(`    ✅ Generated ${validFixes.length} replacement test case(s)`);
        return { fixed: true, testCaseFixes: validFixes, cost };
      }
    }
    console.log(`    ⚠️  No valid test case replacements produced`);
    return null;
  } catch (err) {
    console.log(`    ❌ Test case fix API error: ${err.message}`);
    return null;
  }
}

// ==================== JUDGE0 HELPERS ====================

function b64Encode(str) { return Buffer.from(str, 'utf8').toString('base64'); }
function b64Decode(str) { return Buffer.from(str, 'base64').toString('utf8'); }

async function judge0Submit(sourceCode, languageId, stdin) {
  const url = `${JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=true`;
  const payload = {
    source_code: b64Encode(sourceCode),
    language_id: languageId,
    stdin: stdin ? b64Encode(stdin) : '',
  };
  // Pass -lm for C (50) and C++ (54) so math.h functions link properly
  if (languageId === 50) {
    payload.additional_files = b64Encode('');
    payload.compiler_options = '-lm';
  } else if (languageId === 54) {
    payload.compiler_options = '-lm';
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Judge0 HTTP ${resp.status}: ${resp.statusText}`);
  const result = await resp.json();
  for (const field of ['stdout', 'stderr', 'compile_output', 'message']) {
    if (result[field]) { try { result[field] = b64Decode(result[field]); } catch (_) {} }
  }
  if (result.token && result.status && result.status.id <= 2) {
    return await judge0Poll(result.token);
  }
  return result;
}

async function judge0Poll(token, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const resp = await fetch(`${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true`);
    const result = await resp.json();
    for (const field of ['stdout', 'stderr', 'compile_output', 'message']) {
      if (result[field]) { try { result[field] = b64Decode(result[field]); } catch (_) {} }
    }
    if (result.status && result.status.id > 2) return result;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Judge0 poll timeout');
}

function buildStdin(testCase, problem) {
  const input = testCase.input;
  if (!input) return '';
  if (typeof input === 'string') return input;
  // Use paramOrder to guarantee correct key ordering (Object.values insertion order is unreliable)
  const order = (problem && problem.paramOrder && problem.paramOrder.length > 0)
    ? problem.paramOrder
    : (testCase.paramOrder && testCase.paramOrder.length > 0)
      ? testCase.paramOrder
      : Object.keys(input);
  return order.map(k => (input[k] !== undefined ? input[k] : '')).join('\n');
}

function compareOutputs(actual, expected) {
  if (actual === expected) return true;
  if (actual.toLowerCase() === expected.toLowerCase()) return true;
  const actualNum = parseFloat(actual);
  const expectedNum = parseFloat(expected);
  if (!isNaN(actualNum) && !isNaN(expectedNum) &&
      /^-?\d+\.?\d*$/.test(actual) && /^-?\d+\.?\d*$/.test(expected)) {
    return Math.abs(actualNum - expectedNum) < 1e-6;
  }
  if ((actual.startsWith('[') && actual.endsWith(']')) ||
      (actual.startsWith('{') && actual.endsWith('}'))) {
    try {
      const a = JSON.parse(actual);
      const e = JSON.parse(expected);
      if (JSON.stringify(a) === JSON.stringify(e)) return true;
      if (Array.isArray(a) && Array.isArray(e) && a.length === e.length) {
        // Only sort-compare for flat 1D arrays of primitives.
        // Do NOT sort 2D arrays (e.g. edge lists) — that corrupts element order.
        const isFlat = (arr) => arr.every(x => !Array.isArray(x) && typeof x !== 'object');
        if (isFlat(a) && isFlat(e)) {
          if (JSON.stringify([...a].sort()) === JSON.stringify([...e].sort())) return true;
        }
      }
    } catch (e) {}
  }
  if (actual.replace(/\s+/g, ' ') === expected.replace(/\s+/g, ' ')) return true;
  if (actual.replace(/\n+$/, '') === expected.replace(/\n+$/, '')) return true;
  return false;
}

// ==================== HELPER: TEST CODE AGAINST JUDGE0 ====================

/**
 * Test a piece of code against all test cases via Judge0.
 * Returns { passed: boolean, failedTests: [...] }
 * Each failedTest includes: tc, expected, actual, error, status, memory, time
 */
async function testCodeAgainstJudge0(code, lang, testCases, { collectAll = false, indent = '      ', problem = null } = {}) {
  const langId = LANGUAGE_IDS[lang];
  let allPassed = true;
  const failedTests = [];

  for (let i = 0; i < (testCases || []).length; i++) {
    const tc = testCases[i];
    const stdin = buildStdin(tc, problem || { testCases });
    const expected = String(tc.expected ?? '').trim();
    try {
      const result = await judge0Submit(code, langId, stdin);
      const actual = (result.stdout || '').trim();
      const passed = result.status.id === 3 && compareOutputs(actual, expected);
      const error = result.compile_output || result.stderr || result.message || null;

      if (!passed) {
        allPassed = false;
        // Capture memory and time for OOM/TLE diagnosis
        const memoryKB = result.memory || 0;
        const memoryMB = (memoryKB / 1024).toFixed(2);
        const timeSec = result.time || '0';
        const wallTimeSec = result.wall_time || result.time || '0';

        // Build rich error info
        const isCompileError = result.status.id === 6 || result.status.description?.includes('Compilation');
        let richError = error ? error.substring(0, isCompileError ? 800 : 300) : '';
        if (result.status.id === 5) richError = `Time Limit Exceeded (${timeSec}s, ${memoryMB}MB)`;
        else if (result.status.id === 6 || result.status.description?.includes('Killed')) richError = `Process Killed — Out of Memory (${memoryMB}MB used, ${timeSec}s). Reduce memory usage: avoid HashMap/HashSet in recursion, use primitive arrays.`;
        else if (!actual && result.status.id !== 3) richError = richError || `Program crashed with no output (${result.status.description}, ${memoryMB}MB, ${timeSec}s)`;

        failedTests.push({
          tc: i + 1, expected, actual: actual || '(empty)',
          error: richError || null,
          status: result.status.description,
          memory: `${memoryMB}MB`,
          time: `${timeSec}s`,
        });
        console.log(`${indent}❌ TC${i + 1}: expected="${expected}" got="${actual || '(empty)'}" [${result.status.description}] (${memoryMB}MB, ${timeSec}s)`);
        if (!collectAll) break;
      } else {
        console.log(`${indent}✅ TC${i + 1} passed`);
      }
    } catch (err) {
      allPassed = false;
      failedTests.push({ tc: i + 1, expected, actual: '', error: err.message, status: 'Error' });
      console.log(`${indent}❌ TC${i + 1}: ERROR - ${err.message}`);
      if (!collectAll) break;
    }
    if (i < (testCases || []).length - 1) await new Promise(r => setTimeout(r, 300));
  }

  return { passed: allPassed, failedTests };
}

// ==================== STEP 3: RUN ALL THROUGH JUDGE0 ====================

/**
 * Run ALL approach/lang combos through Judge0 and collect results.
 * Returns: {
 *   passingCode: { approach: { lang: code } },     // langs that pass ALL TCs
 *   failingCode: { approach: { lang: { code, failedTests } } },  // langs that fail
 *   tcOutputs: { tcNum: { output: count } },        // per-TC output consensus
 *   allPassed: boolean,
 *   report: { approach: { lang: { passed, results } } }
 * }
 */
async function runFullJudge0Scan(problem, testCaseFixes = [], existingReport = null) {
  const testCases = [...(problem.testCases || [])];
  // Apply any test case fixes
  for (const fix of testCaseFixes) {
    if (fix.index >= 0 && fix.index < testCases.length) {
      if (fix.expected !== undefined) testCases[fix.index] = { ...testCases[fix.index], expected: fix.expected };
      if (fix.input !== undefined) testCases[fix.index] = { ...testCases[fix.index], input: fix.input };
    }
  }

  if (testCases.length === 0) {
    console.log(`    ⚠️  No test cases`);
    return { passingCode: {}, failingCode: {}, tcOutputs: {}, allPassed: true, report: {} };
  }

  const passingCode = {};
  const failingCode = {};
  const tcOutputs = {}; // { tcNum: { approach: { lang: { actual, status } } } }
  const report = {};
  let allPassed = true;
  // Track if test cases were modified — if so, can't trust existing report
  const tcModified = testCaseFixes.length > 0;

  for (const [approach, approachData] of Object.entries(problem.approaches || {})) {
    if (!approachData.code) continue;
    report[approach] = {};

    for (const lang of LANG_PREFERENCE) {
      const code = approachData.code[lang];
      if (!code) continue;
      const langId = LANGUAGE_IDS[lang];
      if (!langId) continue;

      // Skip if existing report shows this combo already passes and test cases weren't modified
      if (!tcModified && existingReport && existingReport[approach]?.[lang]?.passed === true) {
        report[approach][lang] = existingReport[approach][lang];
        if (!passingCode[approach]) passingCode[approach] = {};
        passingCode[approach][lang] = code;
        console.log(`      ⏭️  ${approach}/${lang}: already passing — skipped`);
        continue;
      }

      if (isCodeCorrupted(code)) {
        console.log(`      ⚠️  ${approach}/${lang}: corrupted code — skipping scan`);
        if (!failingCode[approach]) failingCode[approach] = {};
        failingCode[approach][lang] = { code, failedTests: [{ tc: 0, error: 'Corrupted code', status: 'Corrupted' }] };
        report[approach][lang] = { passed: false, results: [{ tc: 0, passed: false, status: 'Corrupted' }] };
        allPassed = false;
        continue;
      }

      console.log(`      🧪 Testing ${approach}/${lang}...`);
      let langPassed = true;
      const tcResults = [];
      const failedTests = [];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const stdin = buildStdin(tc, problem);
        const expected = String(tc.expected ?? '').trim();

        try {
          const result = await judge0Submit(code, langId, stdin);
          const actual = (result.stdout || '').trim();
          const passed = result.status.id === 3 && compareOutputs(actual, expected);
          const error = result.compile_output || result.stderr || result.message || null;

          tcResults.push({
            tc: i + 1, passed, status: result.status.description,
            ...(passed ? {} : { expected, actual, ...(error ? { error: error.substring(0, result.status?.id === 6 || result.status?.description?.includes('Compilation') ? 800 : 300) } : {}) })
          });

          // Track per-TC outputs for consensus detection
          if (!tcOutputs[i + 1]) tcOutputs[i + 1] = {};
          if (!tcOutputs[i + 1][approach]) tcOutputs[i + 1][approach] = {};
          tcOutputs[i + 1][approach][lang] = { actual, status: result.status.description, statusId: result.status.id };

          if (!passed) {
            langPassed = false;
            // Detect crash pattern: empty output with non-Accepted status or empty output with Accepted
            const isCrash = !actual && (result.status.id !== 3 || !error);
            const crashHint = isCrash ? ' [CRASH: empty output — likely segfault, missing -lm for math.h, or bad parsing]' : '';
            failedTests.push({
              tc: i + 1, expected, actual,
              error: error ? error.substring(0, result.status?.id === 6 || result.status?.description?.includes('Compilation') ? 800 : 300) : (isCrash ? 'Program produced no output (crash/segfault). If using math.h log/pow/sqrt in C/C++, Judge0 may not link -lm. Use integer alternatives.' : null),
              status: result.status.description,
              memory: result.memory ? `${(result.memory / 1024).toFixed(2)}MB` : undefined,
              time: result.time ? `${result.time}s` : undefined,
            });
            console.log(`        ❌ TC${i + 1}: expected="${expected}" got="${actual || '(empty)'}" [${result.status.description}]${crashHint}`);
          } else {
            console.log(`        ✅ TC${i + 1} passed`);
          }
        } catch (err) {
          langPassed = false;
          tcResults.push({ tc: i + 1, passed: false, status: 'Error', expected, actual: '', error: err.message });
          failedTests.push({ tc: i + 1, expected, actual: '', error: err.message, status: 'Error' });
          console.log(`        ❌ TC${i + 1}: ERROR - ${err.message}`);
        }
        if (i < testCases.length - 1) await new Promise(r => setTimeout(r, 300));
      }

      report[approach][lang] = { passed: langPassed, results: tcResults };

      if (langPassed) {
        if (!passingCode[approach]) passingCode[approach] = {};
        passingCode[approach][lang] = code;
      } else {
        allPassed = false;
        if (!failingCode[approach]) failingCode[approach] = {};
        failingCode[approach][lang] = { code, failedTests };
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { passingCode, failingCode, tcOutputs, allPassed, report };
}

// ==================== STEP 5: TRANSLATE FROM PASSING REFERENCE ====================

function generateTranslationPrompt(problem, approach, workingCode, targetLanguages, existingCodes, sourceLang) {
  const { title, description, descriptionText, testCases } = problem;

  const targetCodesSection = targetLanguages.map(lang => {
    const existing = existingCodes[lang] || '';
    return `### ${lang} (current broken code — only copy the I/O parsing style):
\`\`\`${lang}
${existing}
\`\`\``;
  }).join('\n\n');

  const tcSection = (testCases || []).map((tc, i) => {
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    return `  TC${i + 1}: input=${inputStr} → expected="${String(tc.expected ?? '').trim()}"`;
  }).join('\n');

  const stdinSection = (testCases || []).slice(0, 3).map((tc, i) => {
    const stdin = buildStdin(tc, problem);
    return `  TC${i + 1} stdin:\n${stdin.split('\n').map(line => `    | ${line}`).join('\n')}`;
  }).join('\n');

  return `You are a mechanical code translator. Convert working ${sourceLang} code to other languages. Do NOT change the algorithm logic.

## RULES:
1. The ${sourceLang} code below PASSES all test cases. It is 100% correct.
2. Produce IDENTICAL behavior — same loops, conditions, math.
3. Do NOT change loop bounds, conditions, or add optimizations.
4. Keep the I/O format from the EXISTING code for each target language (how it reads stdin).

**STDIN FORMAT:**
${stdinSection}

**WORKING ${sourceLang} code (approach: ${approach}):**
\`\`\`${sourceLang}
${workingCode}
\`\`\`

**Expected outputs:**
${tcSection}

**Target languages:** ${targetLanguages.join(', ')}

${targetCodesSection}

## Language-specific notes:
- Java: handle empty array "[]" gracefully
- JavaScript: use BigInt for large numbers if needed
- C/C++ CRITICAL RULES (Judge0 environment):
  * NEVER use math.h functions like log(), pow(), sqrt(), ceil(), floor() — Judge0 may not link -lm, causing silent crash with empty output. Use INTEGER alternatives instead:
    - log base B: use a while loop (n /= B; count++)
    - pow: use a for loop multiplying
    - sqrt: use integer binary search or Newton's method
    - ceil(a/b): use (a + b - 1) / b
  * NEVER use strtok with "[,]" delimiters — use strtol-based parsing
  * NEVER declare large arrays (>1MB) as local variables — use static or global scope
  * NEVER use threading (<thread>, <mutex>, <future>, <atomic>, pthread) — Judge0 does NOT support -pthread. Rewrite multithreaded code as single-threaded (sequential BFS/DFS).
  * If the source code uses math functions (math.log, Math.log, etc.), you MUST convert them to integer-only equivalents in C/C++
  * If the source code uses threading/concurrency, you MUST convert to single-threaded in C/C++
  * Parse 2D arrays like [[1,2],[3,4]] by looking for inner '[', parsing numbers with strtol, then skipping inner ']'
- After each translation, trace TC1 to verify.

Return ONLY valid JSON:
{
  "status": "needs_fixes",
  "summary": "Translated working ${sourceLang} to ${targetLanguages.join(', ')}",
  "fixes": {
    "approaches": {
      "${approach}": {
        "code": {
${targetLanguages.map(l => `          "${l}": "FULL ${l} CODE HERE"`).join(',\n')}
        }
      }
    }
  }
}`;
}

// ==================== ERROR FEEDBACK FIX PROMPT ====================

/**
 * Generate a prompt to fix a specific language that failed compilation/runtime/wrong output.
 * Sends the actual errors from Judge0 back to AI so it can see exactly what went wrong.
 * If a passing reference exists, include it so AI can compare.
 */
function generateErrorFeedbackPrompt(problem, approach, lang, code, failedTests, refLang, refCode) {
  const { title, description, descriptionText, testCases } = problem;

  const stdinSection = (testCases || []).slice(0, 3).map((tc, i) => {
    const stdin = buildStdin(tc, problem);
    return `  TC${i + 1} stdin:\n${stdin.split('\n').map(line => `    | ${line}`).join('\n')}`;
  }).join('\n');

  const tcSection = (testCases || []).map((tc, i) => {
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    return `  TC${i + 1}: input=${inputStr} → expected="${String(tc.expected ?? '').trim()}"`;
  }).join('\n');

  // Format the actual errors from Judge0
  const errorDetails = failedTests.map(ft => {
    let detail = `  TC${ft.tc}: status="${ft.status}"`;
    if (ft.expected) detail += `, expected="${ft.expected}"`;
    if (ft.actual) detail += `, got="${ft.actual}"`;
    if (ft.memory) detail += `, memory=${ft.memory}`;
    if (ft.time) detail += `, time=${ft.time}`;
    if (ft.error) detail += `\n    Error: ${ft.error}`;
    return detail;
  }).join('\n');

  // Detect if this is an OOM/Killed issue
  const hasOOM = failedTests.some(ft => 
    (ft.status && ft.status.includes('Killed')) || 
    (ft.error && ft.error.includes('Out of Memory')) ||
    (ft.error && ft.error.includes('Killed'))
  );
  // Detect if this is a Wrong Answer issue (code runs but output is wrong)
  const hasWrongAnswer = failedTests.some(ft => 
    ft.status === 'Accepted' && ft.actual && ft.actual !== '(empty)' && ft.actual !== ft.expected
  );

  let specialHint = '';
  if (hasOOM) {
    specialHint = `
## ⚠️ CRITICAL: This program was KILLED due to OUT OF MEMORY (OOM).
The Judge0 environment has a strict memory limit (~128MB for Java).
You MUST reduce memory usage:
- Replace HashMap/HashSet/LinkedHashSet with primitive int[]/boolean[]/char[] arrays (e.g., int[256] for char-to-digit mapping)
- Avoid autoboxing (Integer vs int) — use primitive types everywhere
- Minimize object creation inside recursive calls
- Use static/class-level arrays instead of creating new objects per call
- For Java: use int[] mapping = new int[256] instead of Map<Character, Integer>
- For Java: use boolean[] instead of Set<Character>
- The working ${refLang || 'C'} code uses primitive arrays — follow the same pattern.
`;
  } else if (hasWrongAnswer) {
    specialHint = `
## ⚠️ CRITICAL: This program produces WRONG OUTPUT — the algorithm logic is INCORRECT.
The code compiles and runs without errors, but the output does not match the expected values.
- Do NOT just fix parsing or syntax — the ALGORITHM ITSELF is wrong
- ${refLang && refCode ? `The working ${refLang} code is PROVEN correct — TRANSLATE its algorithm directly to ${lang}` : 'Carefully re-read the problem description and rewrite the algorithm from scratch'}
- Trace through the failing test cases to understand what the code is doing wrong
- You ARE allowed to completely rewrite the algorithm — just keep the same I/O format
`;
  } else if (failedTests.some(ft => ft.status === 'Accepted' && (!ft.actual || ft.actual === '(empty)'))) {
    specialHint = `
## ⚠️ CRITICAL: This program runs successfully (status "Accepted") but produces EMPTY OUTPUT.
The program does not crash — it simply prints nothing for certain inputs. Common causes:
- Off-by-one error in line/index counting
- Input parsing reads fewer lines than available in stdin
- A condition prevents output (wrong variable check, early return)
- Program tries to read from a file instead of stdin
- ${refLang && refCode ? `The working ${refLang} code handles this correctly — TRANSLATE its logic directly to ${lang}` : 'Carefully trace through the failing test cases with the given stdin'}
- You ARE allowed to completely rewrite the logic — just keep the same I/O format
`;
  }

  let referenceSection = '';
  if (refLang && refCode) {
    const refInstruction = hasWrongAnswer 
      ? `The ${lang} algorithm is WRONG. This ${refLang} code is PROVEN correct — REWRITE the ${lang} code by translating this ${refLang} algorithm directly. Do NOT try to patch the broken ${lang} logic.`
      : `Translate the logic from this working code. Only adapt syntax for ${lang}.`;
    referenceSection = `
## 🟢 WORKING ${refLang} code (PASSES all tests — use as algorithm reference):
\`\`\`${refLang}
${refCode}
\`\`\`
${refInstruction}
`;
  }

  return `You are an expert code fixer. This ${lang} code was compiled and executed via Judge0 but FAILED. Fix it.

**PROBLEM:** ${title}
${description || descriptionText || ''}

**STDIN FORMAT:**
${stdinSection}

**TEST CASES:**
${tcSection}

## ❌ ACTUAL ERRORS FROM JUDGE0 (these are REAL compilation/runtime results):
${errorDetails}
${specialHint}
## FAILING ${lang} CODE:
\`\`\`${lang}
${code}
\`\`\`
${referenceSection}
## FIX INSTRUCTIONS:
1. Read the ACTUAL ERRORS above carefully — they tell you exactly what went wrong.
2. If output is EMPTY with 0s time and 0KB memory → the program CRASHED before producing output. Common causes:
   - C/C++ using math.h functions (log, pow, sqrt) — Judge0 may not link -lm. REPLACE with integer alternatives:
     * log base B → while loop (n /= B; count++)
     * pow → for loop multiplying
     * sqrt → integer binary search
     * ceil(a/b) → (a + b - 1) / b
   - Segfault from bad array parsing (strtok with "[,]" delimiters)
   - Stack overflow from large local arrays (use static/global)
   - Reading input in wrong format (check STDIN format above)
3. If "Compilation Error" — fix the syntax/missing includes for ${lang}.
${failedTests.some(ft => ft.status && ft.status.includes('Compilation')) ? `   ⚠️ JUDGE0 COMPILER LIMITATIONS: C++ has NO -pthread flag. <thread>, <mutex>, <condition_variable>, <future>, <atomic> headers will cause LINKER ERRORS. C has no pthread support. If the code uses multithreading, you MUST rewrite as SINGLE-THREADED (use sequential BFS/DFS instead). Do NOT use std::thread, std::mutex, std::async, pthread_create or any threading API.` : ''}
4. If "Runtime Error" / "NZEC" — fix null pointer, array bounds, stack overflow, segfault.
5. If "Wrong Answer" — the algorithm output doesn't match expected. Fix the logic.
6. If "Time Limit Exceeded" — optimize the solution.
7. Make sure the program reads input from STDIN properly — each parameter on a separate line.
8. For C: use strtol-based parsing (NOT strtok with "[,]"), declare large arrays as static/global.
9. For C/C++: parse 2D arrays like [[1,2],[3,4]] by looking for inner '[', parsing with strtol, skipping inner ']'.
10. Provide the COMPLETE fixed code.

Return ONLY valid JSON:
{
  "status": "needs_fixes",
  "summary": "Brief description of what was wrong and how you fixed it",
  "fixes": {
    "approaches": {
      "${approach}": {
        "code": {
          "${lang}": "FULL CORRECTED ${lang} CODE HERE"
        }
      }
    }
  }
}`;
}

// ==================== COST TRACKING HELPERS ====================

function calcCost(usage) {
  const pricing = MODEL_PRICING[MODEL_SONNET];
  return ((usage?.input_tokens || 0) / 1000000) * pricing.input + ((usage?.output_tokens || 0) / 1000000) * pricing.output;
}

function fmtTokens(usage) {
  return `${(usage?.input_tokens || 0).toLocaleString()} in / ${(usage?.output_tokens || 0).toLocaleString()} out`;
}

// ==================== JSON PARSER ====================

function parseJsonResponse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {}
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[1]); } catch (e) {} }
  const s = text.indexOf('{'), en = text.lastIndexOf('}');
  if (s !== -1 && en !== -1) { try { return JSON.parse(text.substring(s, en + 1)); } catch (e) {} }
  return null;
}

// ==================== MERGE FIXES ====================

function mergeFixes(prev, next) {
  const merged = { ...prev };
  if (next.approaches) {
    if (!merged.approaches) merged.approaches = {};
    for (const [approach, data] of Object.entries(next.approaches)) {
      if (!merged.approaches[approach]) merged.approaches[approach] = {};
      if (data.code) {
        merged.approaches[approach].code = { ...(merged.approaches[approach].code || {}), ...data.code };
      }
    }
  }
  if (next.analogy && Object.keys(next.analogy).length > 0) {
    merged.analogy = { ...(merged.analogy || {}), ...next.analogy };
  }
  if (next.testCases && next.testCases.length > 0) {
    const tcMap = {};
    for (const tc of (merged.testCases || [])) { tcMap[tc.index] = tc; }
    for (const tc of next.testCases) { tcMap[tc.index] = tc; }
    merged.testCases = Object.values(tcMap);
  }
  return merged;
}

// ==================== CONSENSUS TC AUTO-FIX ====================

/**
 * If ALL languages produce the same output for a TC but it differs from expected,
 * the test case expected value is wrong — auto-correct it.
 * Requires at least 3 languages agreeing (or per-approach consensus with 50%+ pass rate).
 */
function detectAndFixWrongTestCases(tcOutputs, problem) {
  const testCases = problem.testCases || [];
  const testCaseFixes = [];
  const fixedTcIndices = new Set();

  const allApproachLangs = [];
  for (const [approach, approachData] of Object.entries(problem.approaches || {})) {
    for (const lang of Object.keys(approachData.code || {})) {
      if (LANGUAGE_IDS[lang]) allApproachLangs.push(`${approach}/${lang}`);
    }
  }

  // --- Pass 1: Global consensus (all approaches agree on same output) ---
  for (const [tcNumStr, approaches] of Object.entries(tcOutputs)) {
    const tcNum = parseInt(tcNumStr);
    const tcIndex = tcNum - 1;
    if (tcIndex < 0 || tcIndex >= testCases.length) continue;
    const expected = String(testCases[tcIndex].expected ?? '').trim();

    const outputCounts = new Map();
    const rawOutputs = new Map();
    let totalTested = 0;

    for (const [approach, langs] of Object.entries(approaches)) {
      for (const [lang, data] of Object.entries(langs)) {
        if (data.statusId !== 3) continue;
        totalTested++;
        const actual = data.actual;
        if (!actual && actual !== '0') continue;
        let normalized = actual;
        if (actual.startsWith('[') || actual.startsWith('{')) {
          normalized = actual.replace(/\s+/g, '');
        } else {
          const numVal = parseFloat(actual);
          if (!isNaN(numVal)) normalized = String(Math.round(numVal * 100000) / 100000);
        }
        outputCounts.set(normalized, (outputCounts.get(normalized) || 0) + 1);
        if (!rawOutputs.has(normalized) || actual.length > rawOutputs.get(normalized).length) {
          rawOutputs.set(normalized, actual);
        }
      }
    }

    if (outputCounts.size === 1 && totalTested >= 3) {
      const [unanimousOutput] = [...outputCounts.entries()][0];
      const rawOutput = rawOutputs.get(unanimousOutput);
      const fixValue = (rawOutput.startsWith('[') || rawOutput.startsWith('{')) ? rawOutput.replace(/\s+/g, '') : rawOutput;
      if (!compareOutputs(rawOutput, expected)) {
        console.log(`    🔧 TC${tcNum}: ALL ${totalTested} lang(s) output "${fixValue}" but expected="${expected}" → auto-correcting`);
        testCaseFixes.push({ index: tcIndex, expected: fixValue });
        fixedTcIndices.add(tcIndex);
      }
    } else if (outputCounts.size === 1 && totalTested === 2) {
      const rawOutput = rawOutputs.get([...outputCounts.keys()][0]);
      if (!compareOutputs(rawOutput, expected)) {
        console.log(`    ⚠️  TC${tcNum}: 2 lang(s) output "${rawOutput}" but expected="${expected}" — needs 1 more to auto-correct`);
      }
    }
  }

  // --- Pass 2: Per-approach consensus ---
  const approachPassCounts = {};
  for (const [tcNumStr, approaches] of Object.entries(tcOutputs)) {
    const tcIndex = parseInt(tcNumStr) - 1;
    if (tcIndex < 0 || tcIndex >= testCases.length) continue;
    const expected = String(testCases[tcIndex].expected ?? '').trim();
    for (const [approach, langs] of Object.entries(approaches)) {
      if (!approachPassCounts[approach]) approachPassCounts[approach] = 0;
      const langOutputs = Object.values(langs).filter(d => d.statusId === 3);
      if (langOutputs.length > 0 && langOutputs.every(d => compareOutputs(d.actual, expected))) {
        approachPassCounts[approach]++;
      }
    }
  }

  for (const [tcNumStr, approaches] of Object.entries(tcOutputs)) {
    const tcNum = parseInt(tcNumStr);
    const tcIndex = tcNum - 1;
    if (tcIndex < 0 || tcIndex >= testCases.length || fixedTcIndices.has(tcIndex)) continue;
    const expected = String(testCases[tcIndex].expected ?? '').trim();

    const approachOutputs = {};
    for (const [approach, langs] of Object.entries(approaches)) {
      const langData = Object.values(langs).filter(d => d.statusId === 3);
      if (langData.length < 2) continue;
      const outputs = langData.map(d => d.actual).filter(a => a || a === '0');
      if (outputs.length === 0) continue;
      const normalized = outputs.map(a => {
        if (a.startsWith('[') || a.startsWith('{')) return a.replace(/\s+/g, '');
        const n = parseFloat(a);
        return !isNaN(n) ? String(Math.round(n * 100000) / 100000) : a.trim();
      });
      if ([...new Set(normalized)].length === 1) {
        approachOutputs[approach] = { normalized: normalized[0], raw: outputs[0], count: outputs.length };
      }
    }

    const disagreeingApproaches = Object.keys(approachOutputs).filter(a => !compareOutputs(approachOutputs[a].raw, expected));
    if (disagreeingApproaches.length === 0) continue;

    let bestApproach = null, bestPassCount = -1, bestOutput = null;
    for (const approach of disagreeingApproaches) {
      const pc = approachPassCounts[approach] || 0;
      if (pc > bestPassCount) { bestPassCount = pc; bestApproach = approach; bestOutput = approachOutputs[approach]; }
    }

    const totalTCs = testCases.length;
    const passPct = totalTCs > 1 ? bestPassCount / (totalTCs - 1) : 0;
    if (bestOutput && bestOutput.count >= 3 && passPct >= 0.5) {
      const agreesWithExpected = Object.keys(approachOutputs).filter(
        a => compareOutputs(approachOutputs[a].raw, expected) && (approachPassCounts[a] || 0) >= bestPassCount
      );
      if (agreesWithExpected.length === 0) {
        const fixValue = (bestOutput.raw.startsWith('[') || bestOutput.raw.startsWith('{')) ? bestOutput.raw.replace(/\s+/g, '') : bestOutput.raw;
        console.log(`    🔧 TC${tcNum}: "${bestApproach}" (${bestOutput.count} langs, ${bestPassCount}/${totalTCs - 1} other TCs pass) outputs "${fixValue}" but expected="${expected}" → auto-correcting`);
        testCaseFixes.push({ index: tcIndex, expected: fixValue });
        fixedTcIndices.add(tcIndex);
      }
    }
  }

  return testCaseFixes;
}

// ==================== MAIN FIX STRATEGY ====================

/**
 * Prompt: send problem + one lang's code + all TCs.
 * Ask AI to fix BOTH the code AND/OR the test case expected values.
 */
function generateVerifyAndFixPrompt(problem, approach, lang, code, failedTests) {
  const { title, description, descriptionText, testCases, paramOrder, constraints, examples } = problem;

  const tcSection = (testCases || []).map((tc, i) => {
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    return `  TC${i + 1}: input=${inputStr} → expected="${String(tc.expected ?? '').trim()}"`;
  }).join('\n');

  const stdinSection = (testCases || []).slice(0, 3).map((tc, i) => {
    const stdin = buildStdin(tc, problem);
    return `  TC${i + 1} stdin:\n${stdin.split('\n').map(l => `    | ${l}`).join('\n')}`;
  }).join('\n');

  const errorSection = failedTests && failedTests.length > 0
    ? `\n## ERRORS FROM LAST RUN:\n${failedTests.map(ft => {
        let s = `  TC${ft.tc}: status="${ft.status}", expected="${ft.expected}", got="${ft.actual || '(empty)'}"`;
        if (ft.error) s += `\n    ${ft.error}`;
        return s;
      }).join('\n')}`
    : '';

  return `You are an expert developer. Analyze this problem, its code, and test cases. Fix whatever is wrong — the code, the test case expected values, or both.

**PROBLEM:** ${title}
${description || descriptionText || ''}
${constraints?.length ? `\nConstraints: ${constraints.join(', ')}` : ''}
${examples?.length ? `\nExamples: ${JSON.stringify(examples)}` : ''}

**STDIN FORMAT (each param on its own line):**
${stdinSection}

**TEST CASES:**
${tcSection}

**CURRENT ${lang} CODE:**
\`\`\`${lang}
${code}
\`\`\`
${errorSection}

## YOUR JOB:
1. Verify each test case expected value is correct per the problem description. Fix any that are wrong.
2. Fix the ${lang} code so it passes ALL test cases.
3. Read from STDIN (one param per line), write to STDOUT.

## LANGUAGE RULES:
- C/C++: strtol-based parsing (NOT strtok), large arrays static/global, no math.h (log/pow/sqrt) use integer alternatives, no threading
- Go: bufio.NewReader(os.Stdin) NOT fmt.Scanln for multi-word/array input
- Java: BufferedReader, handle empty array "[]"

Return ONLY valid JSON:
{
  "summary": "what you found and fixed",
  "fixes": {
    "approaches": { "${approach}": { "code": { "${lang}": "FULL FIXED CODE" } } },
    "testCases": [ { "index": 0, "expected": "correct_value", "explanation": "why" } ]
  }
}
Only include testCases entries that actually need changing.`;
}

/**
 * Try each language one at a time until one passes all TCs.
 * For each candidate: ask AI to fix code+TCs → compile → feed errors back → repeat maxRetries times.
 * Returns { fixedCode, fixedTcChanges, lang, cost } or null.
 */
async function getOneLanguagePassing(problem, approach, failingLangs, maxRetries = 3) {
  let totalCost = 0;
  const candidates = LANG_PREFERENCE.filter(l => failingLangs[l]?.code);
  if (candidates.length === 0) return null;

  for (const lang of candidates) {
    let currentCode = failingLangs[lang].code;
    let currentTcChanges = [];
    let lastFailedTests = null;
    console.log(`    🔧 Trying "${approach}/${lang}" (up to ${maxRetries} attempts)...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;
      console.log(`      🤖 Attempt ${attempt}/${maxRetries}...`);

      let aiFixedCode = null;
      try {
        const prompt = generateVerifyAndFixPrompt(problem, approach, lang, currentCode, lastFailedTests);
        const resp = await anthropic.messages.create({
          model: MODEL_SONNET, max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }]
        });
        const cost = calcCost(resp.usage);
        totalCost += cost;
        console.log(`      📊 AI fix #${attempt}: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

        const parsed = parseJsonResponse(resp.content[0]?.text || '');
        aiFixedCode = parsed?.fixes?.approaches?.[approach]?.code?.[lang] || null;
        const aiTcChanges = parsed?.fixes?.testCases || [];

        if (aiTcChanges.length > 0) {
          console.log(`      🔧 AI updated ${aiTcChanges.length} test case expected value(s)`);
          for (const fix of aiTcChanges) {
            if (fix.index >= 0 && fix.index < (problem.testCases || []).length) {
              problem.testCases[fix.index].expected = fix.expected;
            }
            const existing = currentTcChanges.findIndex(f => f.index === fix.index);
            if (existing >= 0) currentTcChanges[existing] = fix;
            else currentTcChanges.push(fix);
          }
        }
      } catch (err) {
        console.log(`      ❌ AI call failed: ${err.message}`);
        break;
      }

      if (!aiFixedCode) { console.log(`      ⚠️  AI returned no code`); break; }
      currentCode = aiFixedCode;

      console.log(`      🧪 Testing ${lang} attempt ${attempt}...`);
      const testResult = await testCodeAgainstJudge0(currentCode, lang, problem.testCases || [], { collectAll: true, indent: '      ', problem });

      if (testResult.passed) {
        console.log(`      ✅ ${lang} passes all TCs on attempt ${attempt}!`);
        return { fixedCode: currentCode, fixedTcChanges: currentTcChanges, lang, cost: totalCost };
      }

      console.log(`      ❌ Attempt ${attempt} failed — ${testResult.failedTests.length} error(s)`);
      lastFailedTests = testResult.failedTests;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 300));
    }
    console.log(`    ⚠️  "${approach}/${lang}" exhausted retries — trying next language`);
  }
  return null;
}

/**
 * Given a passing reference lang+code, translate to all targetLangs.
 * Per lang: batch translate → compile → error-feedback retry (up to 3x).
 */
async function translateToOtherLanguages(problem, approach, refLang, refCode, targetLangs, existingCodes) {
  const langFixes = {};
  let totalCost = 0;
  if (targetLangs.length === 0) return { langFixes, cost: totalCost };

  console.log(`    🌐 Translating "${approach}/${refLang}" → [${targetLangs.join(', ')}]...`);

  let batchResult = null;
  try {
    const prompt = generateTranslationPrompt(problem, approach, refCode, targetLangs, existingCodes, refLang);
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET, max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });
    const cost = calcCost(resp.usage);
    totalCost += cost;
    console.log(`    📊 Translation batch: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);
    batchResult = parseJsonResponse(resp.content[0]?.text || '');
  } catch (err) {
    console.log(`    ❌ Translation batch error: ${err.message}`);
  }

  for (const lang of targetLangs) {
    if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;
    let lastCode = batchResult?.fixes?.approaches?.[approach]?.code?.[lang] || existingCodes[lang] || '';
    if (!lastCode) { console.log(`      ⚠️  No code for ${lang} from translation`); continue; }

    let passed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`      🧪 Testing translated ${lang} (attempt ${attempt})...`);
      const result = await testCodeAgainstJudge0(lastCode, lang, problem.testCases || [], { collectAll: true, indent: '      ', problem });
      if (result.passed) {
        console.log(`      ✅ ${lang} translation passed!`);
        langFixes[lang] = lastCode;
        passed = true;
        break;
      }
      if (attempt < 3) {
        console.log(`      ❌ Attempt ${attempt} failed — sending ${result.failedTests.length} error(s) to AI...`);
        try {
          const errPrompt = generateErrorFeedbackPrompt(problem, approach, lang, lastCode, result.failedTests, refLang, refCode);
          const errResp = await anthropic.messages.create({ model: MODEL_SONNET, max_tokens: 8000, messages: [{ role: 'user', content: errPrompt }] });
          totalCost += calcCost(errResp.usage);
          const errParsed = parseJsonResponse(errResp.content[0]?.text || '');
          const newCode = errParsed?.fixes?.approaches?.[approach]?.code?.[lang];
          if (newCode) lastCode = newCode;
        } catch (e) { console.log(`      ❌ Error feedback failed: ${e.message}`); break; }
        await new Promise(r => setTimeout(r, 300));
      }
    }
    if (!passed) console.log(`      ⚠️  ${lang} translation failed after retries`);
    await new Promise(r => setTimeout(r, 300));
  }
  return { langFixes, cost: totalCost };
}

async function smartFixProblem(problem) {
  let totalCost = 0;
  let allFixes = {};

  // === STEP 1: Auto-fix known C issues ===
  const cParsingFix = autoFixCParsing(problem);
  const cStackFix = autoFixCStackOverflow(problem);
  const cNaryFix = autoFixCNaryTree(problem);

  if (cParsingFix.fixes.length > 0 || cStackFix.fixes.length > 0 || cNaryFix.fixes.length > 0) {
    if (!allFixes.approaches) allFixes.approaches = {};
    for (const key of [...cParsingFix.fixes, ...cStackFix.fixes, ...cNaryFix.fixes]) {
      const [approach, lang] = key.split('/');
      if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
      allFixes.approaches[approach].code[lang] = problem.approaches[approach].code[lang];
    }
  }

  // === STEP 1B: Recompute N-ary tree test case expected values ===
  const naryTcFixes = autoFixNaryTestCases(problem);
  if (naryTcFixes.length > 0) {
    allFixes = mergeFixes(allFixes, { testCases: naryTcFixes });
    for (const fix of naryTcFixes) {
      if (fix.index >= 0 && fix.index < problem.testCases.length) {
        problem.testCases[fix.index].expected = fix.expected;
      }
    }
    console.log(`    ✅ Recomputed ${naryTcFixes.length} N-ary tree test case(s)`);
  }

  // === STEP 2: Fix blank/empty/corrupted test cases ===
  const blankTcResult = await fixBlankTestCases(problem);
  let testCaseFixes = [];
  if (blankTcResult?.fixed) {
    for (const fix of blankTcResult.testCaseFixes) {
      if (fix.index >= 0 && fix.index < problem.testCases.length) {
        if (fix.input) problem.testCases[fix.index].input = fix.input;
        if (fix.expected !== undefined) problem.testCases[fix.index].expected = fix.expected;
        if (fix.explanation) problem.testCases[fix.index].explanation = fix.explanation;
      }
    }
    testCaseFixes = blankTcResult.testCaseFixes;
    allFixes.testCases = testCaseFixes;
    totalCost += blankTcResult.cost || 0;
    console.log(`    ✅ Sanitized ${testCaseFixes.length} test case(s)`);
  }

  // === STEP 3: Scan all approaches/langs through Judge0 ===
  console.log(`    🔍 Running Judge0 scan...`);
  const scan = await runFullJudge0Scan(problem, testCaseFixes, problem.tests_report || null);

  if (scan.allPassed) {
    console.log(`    ✅ All code already passes!`);
    return {
      problemId: problem.id,
      result: { status: 'already_passing', summary: 'All code passes', fixes: allFixes, validationPassed: true },
      validationReport: scan.report,
      cost: { total: totalCost },
    };
  }

  // === STEP 3B: Auto-fix test cases by consensus ===
  // If ALL languages agree on the same output for a TC but it differs from expected → fix the TC
  const tcAutoFixes = detectAndFixWrongTestCases(scan.tcOutputs, problem);
  if (tcAutoFixes.length > 0) {
    allFixes = mergeFixes(allFixes, { testCases: tcAutoFixes });
    for (const fix of tcAutoFixes) {
      if (fix.index >= 0 && fix.index < problem.testCases.length) {
        problem.testCases[fix.index].expected = fix.expected;
      }
    }
    console.log(`    🔄 Re-scanning after auto-correcting ${tcAutoFixes.length} test case(s)...`);
    const reScan = await runFullJudge0Scan(problem, allFixes.testCases || []);
    if (reScan.allPassed) {
      console.log(`    ✅ All tests passed after auto-correcting test cases!`);
      return {
        problemId: problem.id,
        result: { status: 'needs_fixes', summary: 'Fixed wrong test case expected values', fixes: allFixes, validationPassed: true },
        validationReport: reScan.report,
        cost: { total: totalCost },
      };
    }
    Object.assign(scan, reScan);
  }

  // === STEP 4: Per approach — two-path strategy ===
  for (const [approach, approachData] of Object.entries(problem.approaches || {})) {
    if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) {
      console.log(`    💰 Cost cap reached. Stopping.`);
      break;
    }

    const allLangs = Object.keys(approachData.code || {}).filter(l => LANGUAGE_IDS[l]);
    if (allLangs.length === 0) continue;

    const passing = allLangs.filter(l => scan.report?.[approach]?.[l]?.passed === true);
    const failing  = allLangs.filter(l => !passing.includes(l));

    console.log(`\n  📌 "${approach}": ${passing.length} passing [${passing.join(', ') || 'none'}], ${failing.length} failing [${failing.join(', ')}]`);
    if (failing.length === 0) continue;

    // ── PATH A: at least one lang passes → TCs are valid → translate to the rest ──
    if (passing.length > 0) {
      const refLang = LANG_PREFERENCE.find(l => passing.includes(l)) || passing[0];
      const refCode = approachData.code[refLang];
      const existingCodes = Object.fromEntries(failing.map(l => [l, approachData.code[l] || '']));

      const { langFixes, cost } = await translateToOtherLanguages(problem, approach, refLang, refCode, failing, existingCodes);
      totalCost += cost;

      for (const [lang, code] of Object.entries(langFixes)) {
        if (!allFixes.approaches) allFixes.approaches = {};
        if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
        allFixes.approaches[approach].code[lang] = code;
      }
      continue;
    }

    // ── PATH B: nothing passes → fix code+TCs until one lang passes → then translate ──
    console.log(`    🔧 No language passes for "${approach}" — entering fix loop...`);

    const failingLangsMap = {};
    for (const l of failing) {
      failingLangsMap[l] = {
        code: approachData.code[l] || '',
        failedTests: scan.failingCode?.[approach]?.[l]?.failedTests || [],
      };
    }

    const fixResult = await getOneLanguagePassing(problem, approach, failingLangsMap);
    if (!fixResult) {
      console.log(`    ❌ Could not get any language passing for "${approach}"`);
      continue;
    }
    totalCost += fixResult.cost;

    if (!allFixes.approaches) allFixes.approaches = {};
    if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
    allFixes.approaches[approach].code[fixResult.lang] = fixResult.fixedCode;

    for (const fix of fixResult.fixedTcChanges) {
      if (!allFixes.testCases) allFixes.testCases = [];
      const idx = allFixes.testCases.findIndex(f => f.index === fix.index);
      if (idx >= 0) allFixes.testCases[idx] = fix; else allFixes.testCases.push(fix);
    }

    const otherLangs = failing.filter(l => l !== fixResult.lang);
    if (otherLangs.length > 0) {
      const existingCodes = Object.fromEntries(otherLangs.map(l => [l, approachData.code[l] || '']));
      const { langFixes, cost } = await translateToOtherLanguages(problem, approach, fixResult.lang, fixResult.fixedCode, otherLangs, existingCodes);
      totalCost += cost;
      for (const [lang, code] of Object.entries(langFixes)) {
        allFixes.approaches[approach].code[lang] = code;
      }
    }
  }

  // === STEP 5: Final validation ===
  console.log(`\n    🧪 Final validation...`);
  const finalScan = await runFullJudge0Scan(applyFixesToProblemInMemory(problem, allFixes), allFixes.testCases || []);

  const passCount = Object.values(finalScan.report || {}).reduce((s, a) => s + Object.values(a).filter(r => r.passed).length, 0);
  const totalCount = Object.values(finalScan.report || {}).reduce((s, a) => s + Object.keys(a).length, 0);
  console.log(`    ${finalScan.allPassed ? '✅' : '⚠️ '} Final: ${passCount}/${totalCount} passing`);

  return {
    problemId: problem.id,
    result: {
      status: Object.keys(allFixes).length > 0 ? 'needs_fixes' : 'already_passing',
      summary: `${passCount}/${totalCount} passing after fix`,
      fixes: allFixes,
      validationPassed: finalScan.allPassed,
    },
    validationReport: finalScan.report,
    cost: { total: totalCost },
  };
}


/**
 * Apply code fixes to a problem object in-memory (for validation).
 * Returns a new object — does not mutate original.
 */
function applyFixesToProblemInMemory(problem, fixes) {
  const result = { ...problem, approaches: { ...problem.approaches } };
  if (fixes.approaches) {
    for (const [approach, data] of Object.entries(fixes.approaches)) {
      if (data.code && result.approaches[approach]) {
        result.approaches[approach] = {
          ...result.approaches[approach],
          code: { ...result.approaches[approach].code, ...data.code },
        };
      }
    }
  }
  return result;
}

// ==================== APPLY FIXES TO FIREBASE ====================

async function applyFixes(problemId, fixes, validationReport = null) {
  if (!fixes) return true;
  try {
    const docRef = db.collection(COLLECTION_NAME).doc(problemId);
    const doc = await docRef.get();
    if (!doc.exists) { console.error(`    ❌ Problem not found: ${problemId}`); return false; }

    const currentData = doc.data();
    const updates = {};

    if (fixes.approaches) {
      const updatedApproaches = { ...currentData.approaches };
      for (const [approachName, approachFixes] of Object.entries(fixes.approaches)) {
        if (approachFixes.code) {
          if (!updatedApproaches[approachName]) updatedApproaches[approachName] = {};
          updatedApproaches[approachName].code = { ...updatedApproaches[approachName]?.code, ...approachFixes.code };
        }
      }
      updates.approaches = updatedApproaches;
    }

    if (fixes.analogy && Object.keys(fixes.analogy).length > 0) {
      updates.analogy = { ...(currentData.analogy || {}), ...fixes.analogy };
    }

    if (fixes.testCases && fixes.testCases.length > 0) {
      const updatedTestCases = [...(currentData.testCases || [])];
      for (const fix of fixes.testCases) {
        const idx = fix.index;
        if (idx >= 0 && idx < updatedTestCases.length) {
          if (fix.expected !== undefined) updatedTestCases[idx].expected = fix.expected;
          if (fix.input !== undefined) updatedTestCases[idx].input = fix.input;
          if (fix.explanation !== undefined) updatedTestCases[idx].explanation = fix.explanation;
        }
      }
      updates.testCases = updatedTestCases;
    }

    updates.tests_passed = null;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates._lastValidation = {
      validatedAt: new Date().toISOString(),
      fixesApplied: true,
      fixType: 'failed_tests_fix_v2'
    };

    if (validationReport) {
      updates.tests_report = validationReport;
      let allPassed = true;
      for (const [approach, langs] of Object.entries(validationReport)) {
        if (typeof langs !== 'object') continue;
        for (const [lang, data] of Object.entries(langs)) {
          if (data.passed === false) { allPassed = false; break; }
        }
        if (!allPassed) break;
      }
      updates.tests_passed = allPassed;
      updates._lastValidation.judge0Validated = true;
    }

    await docRef.update(updates);
    console.log(`    ✅ Applied fixes to ${problemId}`);
    return true;
  } catch (error) {
    console.error(`    ❌ Error applying fixes: ${error.message}`);
    return false;
  }
}

// ==================== FIREBASE HELPERS ====================

async function fetchFailedProblems(limit = null, skip = 0, reverse = false) {
  initFirebase();
  console.log(`📥 Fetching coding problems where tests_passed is false...${skip > 0 ? ` (skipping first ${skip})` : ''}${reverse ? ' (reverse Z→A)' : ''}`);
  try {
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding')
      .where('tests_passed', '==', false)
      .get();
    const allProblems = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      allProblems.push({ id: doc.id, ...data });
    });
    allProblems.sort((a, b) => reverse ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
    const problems = skip > 0 ? allProblems.slice(skip) : allProblems;
    const finalProblems = limit ? problems.slice(0, limit) : problems;
    console.log(`✅ Found ${allProblems.length} total failed/unvalidated, skipped ${skip}, returning ${finalProblems.length} problems\n`);
    return finalProblems;
  } catch (error) {
    console.error('❌ Error fetching:', error.message);
    return [];
  }
}

async function fetchUnpassedProblems(limit = null, skip = 0, reverse = false) {
  initFirebase();
  console.log(`📥 Fetching coding problems where tests_passed is false or missing...${skip > 0 ? ` (skipping first ${skip})` : ''}${reverse ? ' (reverse Z→A)' : ''}`);
  try {
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding')
      .get();
    const allProblems = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.tests_passed !== true) {
        allProblems.push({ id: doc.id, ...data });
      }
    });
    allProblems.sort((a, b) => reverse ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
    const problems = skip > 0 ? allProblems.slice(skip) : allProblems;
    const finalProblems = limit ? problems.slice(0, limit) : problems;
    console.log(`✅ Found ${allProblems.length} total failed/unvalidated, skipped ${skip}, returning ${finalProblems.length} problems\n`);
    return finalProblems;
  } catch (error) {
    console.error('❌ Error fetching:', error.message);
    return [];
  }
}

async function fetchProblemById(problemId) {
  initFirebase();
  try {
    const doc = await db.collection(COLLECTION_NAME).doc(problemId).get();
    if (!doc.exists) { console.error(`❌ Problem not found: ${problemId}`); return null; }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`❌ Error fetching: ${error.message}`);
    return null;
  }
}

// ==================== COMMANDS ====================

async function listFailed(limit, skip = 0, reverse = false) {
  const problems = await fetchFailedProblems(limit, skip, reverse);
  if (problems.length === 0) { console.log('✅ No failed problems found!'); return; }
  console.log(`\n📋 Problems with failed tests:`);
  console.log('─'.repeat(80));
  problems.forEach((p, i) => {
    const approaches = Object.keys(p.approaches || {});
    const langs = new Set();
    for (const a of approaches) {
      for (const l of Object.keys(p.approaches[a]?.code || {})) langs.add(l);
    }
    console.log(`${i + 1}. ${p.id}`);
    console.log(`   Title: ${p.title}`);
    console.log(`   Approaches: ${approaches.join(', ')} | Languages: ${[...langs].join(', ')}`);
    console.log('');
  });
}

async function runTestMode(problemId) {
  const problem = await fetchProblemById(problemId);
  if (!problem) return;
  console.log(`\n🔍 Analyzing: ${problem.title}`);
  console.log('─'.repeat(60));
  const result = await smartFixProblem(problem);
  if (!result) { console.log('❌ Fix attempt failed'); return; }
  console.log(`\n📋 Result: ${result.result.status} — ${result.result.summary}`);
  const fixesFile = `fixes_failed_${problemId}.json`;
  fs.writeFileSync(fixesFile, JSON.stringify(result.result, null, 2));
  console.log(`📁 Fixes saved to: ${fixesFile}`);
}

async function runTestApply(problemId) {
  const problem = await fetchProblemById(problemId);
  if (!problem) return;
  console.log(`\n🔍 Fixing: ${problem.title}`);
  console.log('─'.repeat(60));
  const result = await smartFixProblem(problem);
  if (!result) { console.log('❌ Fix attempt failed'); return; }
  console.log(`\n📋 Result: ${result.result.status} — ${result.result.summary}`);
  if (result.result.fixes) {
    const success = await applyFixes(problemId, result.result.fixes, result.validationReport || null);
    if (success) {
      console.log(result.result.validationPassed ? `✅ Fixes applied & validated!` : `⚠️  Fixes applied but some tests still fail.`);
    } else {
      console.log(`❌ Failed to apply fixes`);
    }
  }
}

async function runFixAll(limit, apply = false, skip = 0, reverse = false) {
  const problems = apply
    ? await fetchUnpassedProblems(limit, skip, reverse)
    : await fetchFailedProblems(limit, skip, reverse);
  if (problems.length === 0) { console.log('✅ No failed problems!'); return; }

  console.log(`\n🔧 Fixing ${problems.length} problems (apply=${apply})`);
  console.log('═'.repeat(60));

  let totalCost = 0, fixedCount = 0, validatedCount = 0, errorCount = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`\n[${i + 1}/${problems.length}] ${problem.id}`);
    console.log(`   📌 ${problem.title}`);
    console.log('─'.repeat(50));

    const result = await smartFixProblem(problem);
    if (!result) { errorCount++; printProgress(i + 1, problems.length, validatedCount, fixedCount, errorCount, totalCost); continue; }

    totalCost += result.cost?.total || 0;

    if (result.result.status === 'already_passing') {
      if (apply) {
        try {
          initFirebase();
          await db.collection(COLLECTION_NAME).doc(problem.id).update({
            tests_passed: true, tests_report: result.validationReport,
            tests_validated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) { console.log(`    ⚠️  Firebase update failed: ${err.message}`); }
      }
      validatedCount++;
    } else if (result.result.fixes) {
      if (apply) {
        const success = await applyFixes(problem.id, result.result.fixes, result.validationReport || null);
        if (success) { result.result.validationPassed ? validatedCount++ : fixedCount++; }
        else errorCount++;
      } else {
        result.result.validationPassed ? validatedCount++ : fixedCount++;
      }
    }

    printProgress(i + 1, problems.length, validatedCount, fixedCount, errorCount, totalCost);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 FINAL: ✅ Validated: ${validatedCount} | 🔧 Fixed: ${fixedCount} | ❌ Errors: ${errorCount} | 💰 $${totalCost.toFixed(4)}`);
  console.log(`${'═'.repeat(60)}`);
}

function printProgress(current, total, validated, fixed, errors, cost) {
  console.log(`\n  📈 Progress: ${current}/${total} | ✅ ${validated} | 🔧 ${fixed} | ❌ ${errors} | 💰 $${cost.toFixed(4)}`);
}

// ==================== BATCH MODE ====================

async function createBatch(limit, skip = 0, reverse = false) {
  const problems = await fetchFailedProblems(limit, skip, reverse);
  if (problems.length === 0) { console.log('✅ No failed problems!'); return; }

  console.log(`📦 Creating batch for ${problems.length} problems...`);
  const requests = [];

  for (const problem of problems) {
    // For batch, we generate a combined fix prompt per problem
    const approaches = Object.keys(problem.approaches || {});
    if (approaches.length === 0) continue;

    // Build a simplified prompt for batch mode
    const failingCodes = {};
    for (const approach of approaches) {
      failingCodes[approach] = {};
      for (const [lang, code] of Object.entries(problem.approaches[approach]?.code || {})) {
        if (LANGUAGE_IDS[lang]) failingCodes[approach][lang] = { code };
      }
    }

    const stdinExamples = (problem.testCases || []).map((tc, i) => {
      const stdin = buildStdin(tc, problem);
      return `  TC${i + 1} stdin:\n${stdin.split('\n').map(line => `    | ${line}`).join('\n')}`;
    }).join('\n');

    const prompt = `You are an expert code fixer. Fix ALL failing code for this problem.

**PROBLEM DATA:**
\`\`\`json
${JSON.stringify({
  title: problem.title,
  description: problem.description || problem.descriptionText,
  paramOrder: problem.paramOrder || [],
  constraints: problem.constraints || [],
  examples: problem.examples || [],
  testCases: problem.testCases || [],
  failingCodes,
}, null, 2)}
\`\`\`

## STDIN FORMAT:
${stdinExamples}

## RULES:
- Keep same I/O format
- For C: use strtol (not strtok), declare large arrays as static
- Provide COMPLETE code for each fix
- Check STDIN parsing is correct

Return ONLY valid JSON:
{
  "status": "needs_fixes",
  "summary": "description",
  "fixes": {
    "approaches": { "approach-name": { "code": { "lang": "FULL CODE" } } },
    "testCases": []
  }
}`;

    let customId = problem.id;
    if (customId.length > 64) customId = customId.substring(0, 58) + '-' + requests.length;

    requests.push({
      custom_id: customId,
      params: { model: MODEL_SONNET, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }
    });
  }

  if (requests.length === 0) { console.log('ℹ️  No problems to batch'); return; }
  console.log(`📝 Prepared ${requests.length} requests`);

  try {
    const batch = await anthropic.messages.batches.create({ requests });
    console.log(`\n✅ Batch created: ${batch.id}`);
    console.log(`Next: node fix_failed_tests.js --check-batch ${batch.id}`);
    console.log(`      node fix_failed_tests.js --process-results ${batch.id}`);

    const idMapping = {};
    requests.forEach((req, idx) => { idMapping[req.custom_id] = problems[idx].id; });
    fs.writeFileSync(`fix_batch_${batch.id}.json`, JSON.stringify({
      batchId: batch.id, createdAt: new Date().toISOString(),
      problemCount: requests.length, problemIds: problems.map(p => p.id), idMapping
    }, null, 2));
  } catch (error) {
    console.error(`❌ Batch creation error: ${error.message}`);
  }
}

async function checkBatch(batchId) {
  try {
    const batch = await anthropic.messages.batches.retrieve(batchId);
    console.log(`\n📋 Batch: ${batchId} | Status: ${batch.processing_status}`);
    if (batch.request_counts) {
      console.log(`Succeeded: ${batch.request_counts.succeeded}, Errored: ${batch.request_counts.errored}, Processing: ${batch.request_counts.processing}`);
    }
    if (batch.processing_status === 'ended') {
      console.log(`✅ Complete! Run: node fix_failed_tests.js --process-results ${batchId}`);
    }
  } catch (error) { console.error(`❌ Error: ${error.message}`); }
}

async function processResults(batchId) {
  initFirebase();
  console.log(`\n📦 Processing batch: ${batchId}`);

  let idMapping = {};
  const infoFile = `fix_batch_${batchId}.json`;
  if (fs.existsSync(infoFile)) {
    try { idMapping = JSON.parse(fs.readFileSync(infoFile, 'utf8')).idMapping || {}; } catch (e) {}
  }

  let fixedCount = 0, errorCount = 0;

  try {
    const results = await anthropic.messages.batches.results(batchId);
    for await (const result of results) {
      const problemId = idMapping[result.custom_id] || result.custom_id;
      console.log(`\n[${problemId}]`);

      if (result.result.type !== 'succeeded') {
        console.log(`   ❌ Error: ${result.result.error?.message || 'Unknown'}`);
        errorCount++; continue;
      }

      const responseText = result.result.message.content[0]?.text || '';
      const parsed = parseJsonResponse(responseText);
      if (!parsed?.fixes) { console.log(`   ❌ Parse failed`); errorCount++; continue; }

      console.log(`   📋 ${parsed.status}: ${parsed.summary}`);

      if (parsed.fixes) {
        // Fetch problem, validate, apply
        const problem = await fetchProblemById(problemId);
        if (problem) {
          const fixedProblem = applyFixesToProblemInMemory(problem, parsed.fixes);
          const validation = await runFullJudge0Scan(fixedProblem, parsed.fixes.testCases || []);
          const success = await applyFixes(problemId, parsed.fixes, validation.report);
          if (success) fixedCount++; else errorCount++;
        } else {
          const success = await applyFixes(problemId, parsed.fixes);
          if (success) fixedCount++; else errorCount++;
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🔧 Fixed: ${fixedCount} | ❌ Errors: ${errorCount}`);
  console.log(`${'═'.repeat(50)}`);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('═══════════════════════════════════════════');
    console.log('🔧 Fix Failed Tests v2 (Streamlined)');
    console.log('═══════════════════════════════════════════\n');
    console.log('Commands:');
    console.log('  --list-failed [limit]         List problems with failed tests');
    console.log('  --test <problem_id>           Analyze & show fixes (no apply)');
    console.log('  --test-apply <problem_id>     Analyze & apply fixes');
    console.log('  --fix-all [limit]             Fix all failed (show only)');
    console.log('  --fix-apply-all [limit]       Fix all failed & apply');
    console.log('  --create-batch [limit]        Create batch job (50% cheaper)');
    console.log('  --check-batch <batch_id>      Check batch status');
    console.log('  --process-results <batch_id>  Process & apply batch results');
    console.log('\n  Optional: --skip <n>          Skip first n problems');
    console.log('  Optional: --reverse           Process in reverse order\n');
    process.exit(1);
  }

  const command = args[0];
  const param = args[1] && !args[1].startsWith('--') ? args[1] : null;
  const skipIdx = args.indexOf('--skip');
  const skip = skipIdx !== -1 && args[skipIdx + 1] ? parseInt(args[skipIdx + 1]) : 0;
  const reverse = args.includes('--reverse');

  switch (command) {
    case '--list-failed':
      await listFailed(param ? parseInt(param) : null, skip, reverse);
      break;
    case '--test':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runTestMode(param);
      break;
    case '--test-apply':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runTestApply(param);
      break;
    case '--fix-all':
      await runFixAll(param ? parseInt(param) : null, false, skip, reverse);
      break;
    case '--fix-apply-all':
      await runFixAll(param ? parseInt(param) : null, true, skip, reverse);
      break;
    case '--create-batch':
      await createBatch(param ? parseInt(param) : null, skip, reverse);
      break;
    case '--check-batch':
      if (!param) { console.error('❌ Provide batch_id'); process.exit(1); }
      await checkBatch(param);
      break;
    case '--process-results':
      if (!param) { console.error('❌ Provide batch_id'); process.exit(1); }
      await processResults(param);
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
