/**
 * Fix Failed Tests - v2 (Streamlined)
 * 
 * Strategy (in order):
 *   1. Auto-fix known C issues (strtok parsing, stack overflow)
 *   2. Fix blank/empty test cases
 *   3. Run ALL approach/lang combos through Judge0 to find which pass
 *   4. If same TC fails across ALL languages → fix the test case (not code)
 *   5. Intelligent per-language fix (when a passing reference exists):
 *      A. Self-diagnose: Ask AI to analyze the failing code + errors, fix it without showing reference
 *      B. Test Phase A fix via Judge0 — if all TCs pass, done for that lang
 *      C. Reference-fix: If Phase A failed, show the working reference code and ask AI to fix
 *   6. If NO language passes → validate test cases via AI, then fix code via AI
 *   7. Final validation
 *   8. Still-failing langs get Phase A/B retry (self-fix → reference-fix)
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

function buildStdin(testCase) {
  const input = testCase.input;
  if (!input) return '';
  if (typeof input === 'string') return input;
  return Object.values(input).join('\n');
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
        const sortKey = (item) => JSON.stringify(Array.isArray(item) ? [...item].sort() : item);
        if (JSON.stringify([...a].map(sortKey).sort()) === JSON.stringify([...e].map(sortKey).sort())) return true;
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
async function testCodeAgainstJudge0(code, lang, testCases, { collectAll = false, indent = '      ' } = {}) {
  const langId = LANGUAGE_IDS[lang];
  let allPassed = true;
  const failedTests = [];

  for (let i = 0; i < (testCases || []).length; i++) {
    const tc = testCases[i];
    const stdin = buildStdin(tc);
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
        const stdin = buildStdin(tc);
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

// ==================== STEP 4: AUTO-FIX TEST CASES BY CONSENSUS ====================

/**
 * If ALL languages produce the same output for a TC but it differs from expected,
 * the test case expected value is wrong. Fix it.
 */
function detectAndFixWrongTestCases(tcOutputs, problem) {
  const testCases = problem.testCases || [];
  const testCaseFixes = [];
  const fixedTcIndices = new Set();

  // Count total approach/lang combos
  const allApproachLangs = [];
  for (const [approach, approachData] of Object.entries(problem.approaches || {})) {
    for (const lang of Object.keys(approachData.code || {})) {
      if (LANGUAGE_IDS[lang]) allApproachLangs.push(`${approach}/${lang}`);
    }
  }
  const totalCombos = allApproachLangs.length;

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
        // Normalize arrays: remove spaces after commas/brackets
        if (actual.startsWith('[') || actual.startsWith('{')) {
          normalized = actual.replace(/\s+/g, '');
        } else {
          const numVal = parseFloat(actual);
          if (!isNaN(numVal) && actual.trim() === String(actual).trim()) {
            normalized = String(Math.round(numVal * 100000) / 100000);
          }
        }
        
        outputCounts.set(normalized, (outputCounts.get(normalized) || 0) + 1);
        if (!rawOutputs.has(normalized) || actual.length > rawOutputs.get(normalized).length) {
          rawOutputs.set(normalized, actual);
        }
      }
    }

    if (outputCounts.size === 1 && totalTested >= 3) {
      const [unanimousOutput, count] = [...outputCounts.entries()][0];
      const rawOutput = rawOutputs.get(unanimousOutput);
      // Use compact form (no extra spaces) for the expected value
      const fixValue = (rawOutput.startsWith('[') || rawOutput.startsWith('{')) ? rawOutput.replace(/\s+/g, '') : rawOutput;
      
      if (!compareOutputs(rawOutput, expected)) {
        console.log(`    🔧 TC${tcNum}: ALL ${count} lang(s) output "${fixValue}" but expected="${expected}" → auto-correcting`);
        testCaseFixes.push({ index: tcIndex, expected: fixValue });
        fixedTcIndices.add(tcIndex);
      }
    } else if (outputCounts.size === 1 && totalTested >= 2 && totalTested < 3) {
      const [unanimousOutput, count] = [...outputCounts.entries()][0];
      const rawOutput = rawOutputs.get(unanimousOutput);
      if (!compareOutputs(rawOutput, expected)) {
        console.log(`    ⚠️  TC${tcNum}: ${count} lang(s) output "${rawOutput}" but expected="${expected}" — likely wrong TC (needs ${3 - count} more to auto-correct)`);
      }
    }
  }

  // --- Pass 2: Per-approach consensus (when approaches disagree) ---
  // If ALL languages within one approach unanimously agree on an output different
  // from expected, and that approach passes more OTHER test cases than competing
  // approaches, trust that approach's output and auto-correct the TC.
  
  // Compute per-approach pass rates (how many TCs each approach's langs match expected)
  const approachPassCounts = {};
  for (const [tcNumStr, approaches] of Object.entries(tcOutputs)) {
    const tcNum = parseInt(tcNumStr);
    const tcIndex = tcNum - 1;
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
    if (tcIndex < 0 || tcIndex >= testCases.length) continue;
    if (fixedTcIndices.has(tcIndex)) continue;
    const expected = String(testCases[tcIndex].expected ?? '').trim();

    // Collect per-approach unanimous outputs
    const approachOutputs = {};
    for (const [approach, langs] of Object.entries(approaches)) {
      const langData = Object.values(langs).filter(d => d.statusId === 3);
      if (langData.length < 2) continue;
      
      const outputs = langData.map(d => d.actual).filter(a => a || a === '0');
      if (outputs.length === 0) continue;

      const normalized = outputs.map(a => {
        // Normalize arrays: remove spaces after commas/brackets
        if (a.startsWith('[') || a.startsWith('{')) {
          return a.replace(/\s+/g, '');
        }
        const numVal = parseFloat(a);
        if (!isNaN(numVal) && a.trim() === String(a).trim()) {
          return String(Math.round(numVal * 100000) / 100000);
        }
        return a.trim();
      });

      const unique = [...new Set(normalized)];
      if (unique.length === 1) {
        approachOutputs[approach] = {
          normalized: unique[0],
          raw: outputs[0],
          count: outputs.length,
        };
      }
    }

    const approachNames = Object.keys(approachOutputs);
    if (approachNames.length === 0) continue;

    // Find approaches that disagree with expected
    const disagreeingApproaches = approachNames.filter(
      a => !compareOutputs(approachOutputs[a].raw, expected)
    );
    if (disagreeingApproaches.length === 0) continue;

    // Pick the best approach (highest pass rate on other TCs)
    let bestApproach = null;
    let bestPassCount = -1;
    let bestOutput = null;

    for (const approach of disagreeingApproaches) {
      const passCount = approachPassCounts[approach] || 0;
      if (passCount > bestPassCount) {
        bestPassCount = passCount;
        bestApproach = approach;
        bestOutput = approachOutputs[approach];
      }
    }

    const totalTCs = testCases.length;
    const passPct = totalTCs > 1 ? bestPassCount / (totalTCs - 1) : 0;

    if (bestOutput && bestOutput.count >= 3 && passPct >= 0.5) {
      // Ensure no other approach with equal/better pass rate agrees with expected
      const agreesWithExpected = approachNames.filter(
        a => compareOutputs(approachOutputs[a].raw, expected) && (approachPassCounts[a] || 0) >= bestPassCount
      );
      
      if (agreesWithExpected.length === 0) {
        const fixValue = (bestOutput.raw.startsWith('[') || bestOutput.raw.startsWith('{')) ? bestOutput.raw.replace(/\s+/g, '') : bestOutput.raw;
        console.log(`    🔧 TC${tcNum}: "${bestApproach}" (${bestOutput.count} langs, ${bestPassCount}/${totalTCs - 1} other TCs pass) unanimously outputs "${fixValue}" but expected="${expected}" → auto-correcting`);
        testCaseFixes.push({ index: tcIndex, expected: fixValue });
        fixedTcIndices.add(tcIndex);
      }
    } else if (bestOutput && bestOutput.count >= 2 && !fixedTcIndices.has(tcIndex)) {
      const displayVal = (bestOutput.raw.startsWith('[') || bestOutput.raw.startsWith('{')) ? bestOutput.raw.replace(/\s+/g, '') : bestOutput.raw;
      console.log(`    ⚠️  TC${tcNum}: "${bestApproach}" (${bestOutput.count} langs, ${bestPassCount}/${totalTCs - 1} other TCs pass) outputs "${displayVal}" but expected="${expected}" — needs more evidence`);
    }
  }

  return testCaseFixes;
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
    const stdin = buildStdin(tc);
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

// ==================== STEP 5A: SELF-DIAGNOSE & FIX (no reference shown) ====================

function generateSelfFixPrompt(problem, approach, lang, code, failedTests) {
  const { title, description, descriptionText, testCases } = problem;

  const stdinSection = (testCases || []).slice(0, 3).map((tc, i) => {
    const stdin = buildStdin(tc);
    return `  TC${i + 1} stdin:\n${stdin.split('\n').map(line => `    | ${line}`).join('\n')}`;
  }).join('\n');

  const tcSection = (testCases || []).map((tc, i) => {
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    return `  TC${i + 1}: input=${inputStr} → expected="${String(tc.expected ?? '').trim()}"`;
  }).join('\n');

  const errorDetails = failedTests.map(ft => {
    let detail = `  TC${ft.tc}: status="${ft.status}"`;
    if (ft.expected) detail += `, expected="${ft.expected}"`;
    if (ft.actual) detail += `, got="${ft.actual || '(empty)'}"`;
    if (ft.memory) detail += `, memory=${ft.memory}`;
    if (ft.time) detail += `, time=${ft.time}`;
    if (ft.error) detail += `\n    Error: ${ft.error}`;
    return detail;
  }).join('\n');

  return `You are an expert ${lang} developer. This ${lang} program implements the correct algorithm but FAILS when executed. Diagnose the problem and fix it.

**PROBLEM:** ${title}
${description || descriptionText || ''}

**STDIN FORMAT:**
${stdinSection}

**TEST CASES:**
${tcSection}

## THE FAILING ${lang} CODE:
\`\`\`${lang}
${code}
\`\`\`

## ACTUAL EXECUTION RESULTS (from Judge0 online judge):
${errorDetails}

## YOUR TASK:
1. Read the code carefully and identify WHY it fails (compilation error, runtime crash, wrong output, OOM killed, etc.)
2. ${(() => {
  const hasOOM = failedTests.some(ft => (ft.status && ft.status.includes('Killed')) || (ft.error && (ft.error.includes('Killed') || ft.error.includes('Out of Memory'))));
  const hasWrongAnswer = failedTests.some(ft => ft.status === 'Accepted' && ft.actual && ft.actual !== '(empty)' && ft.actual !== ft.expected);
  const hasEmptyOutput = failedTests.some(ft => ft.status === 'Accepted' && (!ft.actual || ft.actual === '(empty)'));
  if (hasOOM) return `The program was KILLED due to OUT OF MEMORY. You MUST optimize memory usage:
   - Replace HashMap/HashSet/LinkedHashSet with primitive int[]/boolean[]/char[] arrays (e.g., int[128] for char-to-digit mapping)
   - Avoid autoboxing (Integer vs int) — use primitive types everywhere
   - Minimize object creation inside recursive calls
   - Add pruning to reduce search space (e.g., weight-based pruning, column-by-column validation)
   - You ARE allowed to restructure the algorithm to reduce memory — the core problem-solving approach must stay the same but the implementation can change significantly`;
  if (hasWrongAnswer) return `The program compiles and runs but produces WRONG OUTPUT. The algorithm logic itself is INCORRECT.
   - You MUST fix the algorithm logic — not just parsing or syntax
   - Carefully re-read the problem description and trace through the failing test cases
   - Compare expected vs actual output to understand what the code is doing wrong
   - You ARE allowed to rewrite the algorithm entirely if needed — just keep the same I/O format (stdin/stdout)`;
  if (hasEmptyOutput) return `The program compiles and runs (status "Accepted") but produces EMPTY OUTPUT for some test cases.
   - This is NOT a crash — the program runs but prints nothing for certain inputs
   - The algorithm or input parsing has a bug that prevents output in some cases
   - Check: off-by-one errors, input parsing reading wrong number of lines, conditions that skip output
   - You ARE allowed to rewrite the algorithm if needed — just keep the same I/O format`;
  return `The ALGORITHM LOGIC is correct — do NOT change the core algorithm. Only fix:
   - Compilation/syntax errors
   - Input parsing issues (stdin reading)
   - Runtime crashes (segfault, stack overflow, null pointer)
   - Language-specific quirks (imports, type casting, I/O buffering)`;
})()}
3. Provide the COMPLETE fixed ${lang} program.

## LANGUAGE-SPECIFIC HINTS:
- Go: NEVER use fmt.Scanln for complex input (stops at spaces). Use bufio.NewReader(os.Stdin) with ReadString('\\n').
- Go: For parsing arrays like [1,2,3] or [[1,2],[3,4]], read the full line first then parse character by character.
- C/C++: NEVER use math.h functions (log, pow, sqrt) — Judge0 may not link -lm. Use integer alternatives.
- C/C++: Use strtol-based parsing, NOT strtok with "[,]" delimiters.
- C/C++: Large local arrays cause stack overflow — use static or global.
- Java: handle empty arrays "[]" gracefully, use BufferedReader for large input.
- JavaScript: use readline for stdin, handle BigInt for large numbers if needed.
${failedTests.some(ft => ft.status && ft.status.includes('Compilation')) ? `
## ⚠️ JUDGE0 COMPILER LIMITATIONS (CRITICAL):
- C++ compiler: GCC with C++17 support but NO -pthread flag. Threading headers (<thread>, <mutex>, <condition_variable>, <future>, <atomic>) will cause linker errors.
- If the code uses multithreading/concurrency, you MUST rewrite it as SINGLE-THREADED. Remove all thread/mutex/lock usage and implement a simple sequential solution.
- C compiler: GCC with -lm flag only. No POSIX threads (pthread).
- Do NOT use: std::thread, std::mutex, std::async, std::future, pthread_create, or any threading API.
- Instead: implement the algorithm sequentially (BFS/DFS with a queue/stack).
` : ''}

Return ONLY valid JSON:
{
  "status": "needs_fixes",
  "summary": "Brief diagnosis of what was wrong and how you fixed it",
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

// ==================== STEP 5B: FIX WITH WORKING REFERENCE ====================

function generateFixWithReferencePrompt(problem, approach, lang, failingCode, failedTests, refLang, refCode) {
  const { title, description, descriptionText, testCases } = problem;

  const stdinSection = (testCases || []).slice(0, 3).map((tc, i) => {
    const stdin = buildStdin(tc);
    return `  TC${i + 1} stdin:\n${stdin.split('\n').map(line => `    | ${line}`).join('\n')}`;
  }).join('\n');

  const tcSection = (testCases || []).map((tc, i) => {
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    return `  TC${i + 1}: input=${inputStr} → expected="${String(tc.expected ?? '').trim()}"`;
  }).join('\n');

  const errorDetails = failedTests.map(ft => {
    let detail = `  TC${ft.tc}: status="${ft.status}"`;
    if (ft.expected) detail += `, expected="${ft.expected}"`;
    if (ft.actual) detail += `, got="${ft.actual || '(empty)'}"`;
    if (ft.memory) detail += `, memory=${ft.memory}`;
    if (ft.time) detail += `, time=${ft.time}`;
    if (ft.error) detail += `\n    Error: ${ft.error}`;
    return detail;
  }).join('\n');

  return `You are an expert ${lang} developer. The ${lang} code below implements the same algorithm as the working ${refLang} code, but the ${lang} version FAILS. Fix the ${lang} code so it produces identical output.

**PROBLEM:** ${title}
${description || descriptionText || ''}

**STDIN FORMAT:**
${stdinSection}

**TEST CASES:**
${tcSection}

## ✅ WORKING ${refLang} CODE (passes ALL tests — this is your reference):
\`\`\`${refLang}
${refCode}
\`\`\`

## ❌ FAILING ${lang} CODE:
\`\`\`${lang}
${failingCode}
\`\`\`

## ACTUAL EXECUTION RESULTS OF THE FAILING CODE:
${errorDetails}

## YOUR TASK:
1. Compare the working ${refLang} code with the failing ${lang} code.
2. The algorithm in ${refLang} is PROVEN correct. Make the ${lang} version behave identically.
3. Focus on: input parsing, data types, I/O format, language-specific idioms.
4. ${(() => {
  const hasOOM = failedTests.some(ft => (ft.status && ft.status.includes('Killed')) || (ft.error && (ft.error.includes('Killed') || ft.error.includes('Out of Memory'))));
  const hasWrongAnswer = failedTests.some(ft => ft.status === 'Accepted' && ft.actual && ft.actual !== '(empty)' && ft.actual !== ft.expected);
  const hasEmptyOutput = failedTests.some(ft => ft.status === 'Accepted' && (!ft.actual || ft.actual === '(empty)'));
  if (hasOOM) return `The ${lang} program was KILLED due to OUT OF MEMORY. The ${refLang} version passes because it uses less memory. You MUST:
   - Use primitive arrays (int[], boolean[], char[]) instead of HashMap/HashSet/LinkedHashSet
   - Avoid autoboxing — use int not Integer, boolean not Boolean
   - Minimize object creation in recursion
   - Add pruning to cut the search space (e.g., weight-based approach, partial-sum validation)
   - You ARE allowed to restructure the ${lang} implementation to be more memory-efficient — as long as the algorithm produces the same results as the ${refLang} version`;
  if (hasWrongAnswer) return `The ${lang} program produces WRONG OUTPUT — the algorithm logic is incorrect. The ${refLang} version is PROVEN correct.
   - Do NOT try to patch the existing ${lang} code — the algorithm itself is wrong
   - TRANSLATE the working ${refLang} algorithm directly to ${lang}
   - Ensure the ${lang} version implements the EXACT same logic as the ${refLang} version
   - Keep the same I/O format (stdin/stdout parsing) from the existing ${lang} code`;
  if (hasEmptyOutput) return `The ${lang} program runs (status "Accepted") but produces EMPTY OUTPUT for some test cases. The ${refLang} version works correctly.
   - Do NOT try to patch the existing code — TRANSLATE the working ${refLang} algorithm directly to ${lang}
   - The existing ${lang} code has a logic bug causing no output on certain inputs
   - Pay special attention to how the ${refLang} code reads input and produces output`;
  return `Keep the same algorithm structure — just make it work correctly in ${lang}.`;
})()}

## LANGUAGE-SPECIFIC HINTS:
- Go: NEVER use fmt.Scanln for complex input (stops at spaces). Use bufio.NewReader(os.Stdin) with ReadString('\\n').
- C/C++: NEVER use math.h functions (log, pow, sqrt) — use integer alternatives.
- C/C++: Use strtol-based parsing, NOT strtok. Large arrays must be static/global.
- Java: handle empty arrays "[]", use BufferedReader.
- JavaScript: use readline, BigInt for large numbers if needed.
${failedTests.some(ft => ft.status && ft.status.includes('Compilation')) ? `
## ⚠️ JUDGE0 COMPILER LIMITATIONS (CRITICAL):
- C++ compiler: GCC with C++17 support but NO -pthread flag. Threading headers (<thread>, <mutex>, <condition_variable>, <future>, <atomic>) will cause linker errors.
- If the code uses multithreading/concurrency, you MUST rewrite it as SINGLE-THREADED. Remove all thread/mutex/lock usage and implement a simple sequential solution.
- C compiler: GCC with -lm flag only. No POSIX threads (pthread).
- Do NOT use: std::thread, std::mutex, std::async, std::future, pthread_create, or any threading API.
- Instead: implement the algorithm sequentially (BFS/DFS with a queue/stack).
` : ''}

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

// ==================== STEP 6: FIX CODE VIA AI (no passing reference) ====================

function generateFixPromptFromScan(problem, approach, failingLangs, scanResults) {
  const { title, description, descriptionText, testCases, examples, paramOrder, constraints } = problem;

  const failingCodes = {};
  for (const [lang, data] of Object.entries(failingLangs)) {
    failingCodes[lang] = {
      code: data.code,
      failedTests: data.failedTests,
    };
  }

  const stdinExamples = (testCases || []).map((tc, i) => {
    const stdin = buildStdin(tc);
    return `  TC${i + 1} stdin:\n${stdin.split('\n').map(line => `    | ${line}`).join('\n')}`;
  }).join('\n');

  const promptData = {
    title,
    description: description || descriptionText,
    paramOrder: paramOrder || [],
    constraints: constraints || [],
    examples: examples || [],
    testCases: testCases || [],
    approach,
    failingCodes,
  };

  return `You are an expert code fixer. Fix ALL the failing code for approach "${approach}".

**PROBLEM DATA:**
\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\`

## STDIN FORMAT:
${stdinExamples}

## What's happening:
- Each failing language has the current code and failedTests showing actual Judge0 execution results.
- Fix the algorithm logic so ALL test cases pass for ALL languages.

## CRITICAL RULES:
- Keep the same I/O format (stdin/stdout)
- For Java: handle empty array "[]" gracefully
- For JavaScript: use BigInt for large numbers if needed
- For C/C++:
  * NEVER use math.h functions (log, pow, sqrt, ceil, floor) — Judge0 may not link -lm, causing silent crash with EMPTY output and 0s/0KB. Use integer-only alternatives:
    - log base B → while loop (n /= B; count++)
    - pow → for loop multiplying
    - sqrt → integer binary search
    - ceil(a/b) → (a + b - 1) / b
  * Use strtol-based parsing (NOT strtok with "[,]")
  * Declare large arrays as static/global (stack limit ~8MB)
  * If output is EMPTY with 0s time → it's a crash, not wrong answer. Check for: missing -lm (math.h), segfault from bad parsing, stack overflow from large arrays
- Provide COMPLETE corrected code for each language
- Check that programs read input from STDIN properly — each parameter on a separate line

## Response format:
Return ONLY valid JSON:
{
  "status": "needs_fixes",
  "summary": "Brief description",
  "fixes": {
    "approaches": {
      "${approach}": {
        "code": {
          "language": "FULL CORRECTED CODE"
        }
      }
    },
    "testCases": []
  }
}

Only include "testCases" if expected values are genuinely wrong.
Begin now.`;
}

/**
 * Generate a prompt to validate test cases using AI
 * (when no language passes all TCs)
 */
function generateTestCaseValidationPrompt(problem, approach, tcOutputs) {
  const { title, description, descriptionText, examples, testCases, paramOrder, constraints } = problem;

  // Build consensus info per TC
  const tcInfo = (testCases || []).map((tc, i) => {
    const tcNum = i + 1;
    const expected = String(tc.expected ?? '').trim();
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    
    // Get all outputs for this TC
    const outputs = {};
    if (tcOutputs[tcNum]) {
      for (const [app, langs] of Object.entries(tcOutputs[tcNum])) {
        for (const [lang, data] of Object.entries(langs)) {
          if (data.statusId === 3) {
            outputs[`${app}/${lang}`] = data.actual;
          }
        }
      }
    }
    
    const uniqueOutputs = [...new Set(Object.values(outputs))];
    return `  TC${tcNum}: input=${inputStr}, expected="${expected}", actual outputs from code: ${JSON.stringify(uniqueOutputs)}`;
  }).join('\n');

  return `You are a test case validator. Check if the expected values of these test cases are correct for the given problem.

**PROBLEM:**
- Title: ${title}
- Description: ${description || descriptionText}
- Examples: ${JSON.stringify(examples || [])}
- Constraints: ${JSON.stringify(constraints || [])}
- Parameter order: ${JSON.stringify(paramOrder || [])}

**TEST CASES (with what ALL language implementations actually output):**
${tcInfo}

## Your task:
1. For each test case, manually compute the correct expected output based on the problem description.
2. Compare with the current expected value AND with what the code implementations output.
3. If the expected value is wrong, provide the correct value.
4. If the code outputs are ALL wrong (and agree), the algorithm is wrong — expected value is likely correct.

Return ONLY valid JSON:
{
  "status": "validated",
  "summary": "Brief summary",
  "fixes": {
    "testCases": [
      { "index": 0, "expected": "correct_value", "reason": "why" }
    ]
  }
}

Only include testCases that need fixing. Empty array if all are correct.`;
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
    const stdin = buildStdin(tc);
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

// ==================== BATCH FIX: MULTIPLE LANGS IN ONE CALL ====================

/**
 * Generate a prompt to fix multiple failing languages at once using a working reference.
 * Groups langs with the same error type to save API calls.
 */
function generateBatchFixPrompt(problem, approach, failingLangsMap, refLang, refCode, errorCategory) {
  const { title, description, descriptionText, testCases } = problem;
  const targetLangs = Object.keys(failingLangsMap);

  const stdinSection = (testCases || []).slice(0, 3).map((tc, i) => {
    const stdin = buildStdin(tc);
    return `  TC${i + 1} stdin:\n${stdin.split('\n').map(line => `    | ${line}`).join('\n')}`;
  }).join('\n');

  const tcSection = (testCases || []).map((tc, i) => {
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    return `  TC${i + 1}: input=${inputStr} → expected="${String(tc.expected ?? '').trim()}"`;
  }).join('\n');

  // Show each failing lang's code and errors
  const failingSection = targetLangs.map(lang => {
    const data = failingLangsMap[lang];
    const errorDetails = (data.failedTests || []).map(ft => {
      let detail = `    TC${ft.tc}: status="${ft.status}", expected="${ft.expected}", got="${ft.actual || '(empty)'}"`;
      if (ft.memory) detail += `, memory=${ft.memory}`;
      if (ft.time) detail += `, time=${ft.time}`;
      if (ft.error) detail += `\n      Error: ${ft.error}`;
      return detail;
    }).join('\n');

    return `### ❌ ${lang} — ${errorCategory}:
\`\`\`${lang}
${data.code}
\`\`\`
Errors:
${errorDetails}`;
  }).join('\n\n');

  let categoryInstruction = '';
  if (errorCategory === 'Wrong Answer') {
    categoryInstruction = `All these languages produce WRONG OUTPUT — the algorithm logic is INCORRECT in each.
The working ${refLang} code is PROVEN correct. For each failing language:
- Do NOT try to patch the existing code — the algorithm itself is wrong
- TRANSLATE the working ${refLang} algorithm directly to each target language
- Keep the I/O parsing format (stdin reading) from each language's existing code`;
  } else if (errorCategory === 'Compilation Error') {
    categoryInstruction = `All these languages have COMPILATION ERRORS. For each:
- Read the compilation error carefully and fix syntax/imports
- Keep the same algorithm logic, just fix what doesn't compile
- For C/C++: Judge0 has NO -pthread. Threading headers cause linker errors. Rewrite as single-threaded.`;
  } else if (errorCategory === 'OOM/Killed') {
    categoryInstruction = `All these languages are KILLED due to OUT OF MEMORY. For each:
- Use primitive arrays instead of HashMap/HashSet
- Minimize object creation in recursion
- Add pruning to reduce search space`;
  } else if (errorCategory === 'Empty Output') {
    categoryInstruction = `All these languages compile and run (status "Accepted") but produce EMPTY OUTPUT for some test cases.
This is NOT a crash — the program runs successfully but prints nothing. Common causes:
- Off-by-one error in line counting or indexing
- Input parsing reads fewer lines than expected (check stdin format carefully)
- Condition that prevents output from being printed (e.g., checking wrong variable)
- Program reads from a file instead of stdin
The working ${refLang} code handles all test cases correctly. For each failing language:
- TRANSLATE the working ${refLang} algorithm directly — do not try to patch the broken code
- Pay special attention to how the ${refLang} code reads input and when it decides to print output
- Keep each language's I/O style (stdin/stdout) but fix the core logic`;
  } else {
    categoryInstruction = `Fix each failing language. The ${refLang} reference is proven correct.`;
  }

  return `You are an expert multi-language code fixer. Fix ALL ${targetLangs.length} failing languages in ONE response.

**PROBLEM:** ${title}
${description || descriptionText || ''}

**STDIN FORMAT:**
${stdinSection}

**TEST CASES:**
${tcSection}

## ✅ WORKING ${refLang} CODE (passes ALL tests — this is your reference):
\`\`\`${refLang}
${refCode}
\`\`\`

## ${categoryInstruction}

${failingSection}

## Language-specific notes:
- Java: handle empty array "[]" gracefully, use BufferedReader
- JavaScript: use readline for stdin, BigInt for large numbers if needed
- Go: use bufio.NewReader(os.Stdin) with ReadString('\\n'), NOT fmt.Scanln
- C/C++: NO -pthread (no threading), NO math.h functions (use integer alternatives), use strtol parsing, large arrays as static/global

Return ONLY valid JSON with ALL ${targetLangs.length} languages fixed:
{
  "status": "needs_fixes",
  "summary": "Brief description",
  "fixes": {
    "approaches": {
      "${approach}": {
        "code": {
${targetLangs.map(l => `          "${l}": "FULL CORRECTED ${l} CODE HERE"`).join(',\n')}
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

// ==================== MAIN FIX STRATEGY ====================

async function smartFixProblem(problem) {
  let totalCost = 0;
  let allFixes = {};

  // === STEP 1: Auto-fix known C issues ===
  const cParsingFix = autoFixCParsing(problem);
  const cStackFix = autoFixCStackOverflow(problem);

  // Include auto-fixed C code in fixes
  if (cParsingFix.fixes.length > 0 || cStackFix.fixes.length > 0) {
    if (!allFixes.approaches) allFixes.approaches = {};
    for (const key of [...cParsingFix.fixes, ...cStackFix.fixes]) {
      const [approach, lang] = key.split('/');
      if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
      allFixes.approaches[approach].code[lang] = problem.approaches[approach].code[lang];
    }
  }

  // === STEP 2: Fix blank/empty test cases ===
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
    console.log(`    ✅ Sanitized ${testCaseFixes.length} blank test case(s)`);
  }

  // === STEP 3: Run ALL approach/lang combos through Judge0 ===
  console.log(`    🔍 Running full Judge0 scan...`);
  const scan = await runFullJudge0Scan(problem, testCaseFixes, problem.tests_report || null);

  if (scan.allPassed) {
    console.log(`    ✅ All code passes!`);
    return {
      problemId: problem.id,
      result: { status: 'already_passing', summary: 'All code passes', fixes: allFixes, validationPassed: true },
      validationReport: scan.report,
      cost: { total: totalCost },
    };
  }

  // === STEP 4: Auto-fix test cases by consensus ===
  const tcAutoFixes = detectAndFixWrongTestCases(scan.tcOutputs, problem);
  if (tcAutoFixes.length > 0) {
    allFixes = mergeFixes(allFixes, { testCases: tcAutoFixes });
    // Apply fixes to problem in-memory
    for (const fix of tcAutoFixes) {
      if (fix.index >= 0 && fix.index < problem.testCases.length) {
        problem.testCases[fix.index].expected = fix.expected;
      }
    }
    // Re-scan after TC fixes
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
    // Update scan results
    Object.assign(scan, reScan);
  }

  // === STEP 5 & 6: Intelligent per-language fix (self-fix → reference-fix → bulk fallback) ===
  for (const [approach, failingLangs] of Object.entries(scan.failingCode)) {
    const passingRef = scan.passingCode[approach] || {};
    const passingLangs = Object.keys(passingRef);
    const failingLangNames = Object.keys(failingLangs);

    if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) {
      console.log(`    💰 Cost cap reached ($${totalCost.toFixed(4)}). Skipping "${approach}".`);
      continue;
    }

    // If NO language passes at all within this approach, check for cross-approach reference
    if (passingLangs.length === 0) {
      // Look for a passing reference from ANY other approach
      let crossRefLang = null;
      let crossRefCode = null;
      let crossRefApproach = null;
      for (const [otherApproach, otherPassingLangs] of Object.entries(scan.passingCode)) {
        if (otherApproach === approach) continue;
        const otherLangs = Object.keys(otherPassingLangs);
        if (otherLangs.length > 0) {
          crossRefLang = LANG_PREFERENCE.find(l => otherLangs.includes(l)) || otherLangs[0];
          crossRefCode = otherPassingLangs[crossRefLang];
          crossRefApproach = otherApproach;
          break;
        }
      }

      if (crossRefCode) {
        // Another approach passes all TCs — TCs are validated, skip TC validation
        // Use cross-approach reference to fix each failing lang via Phase A then Phase B
        console.log(`    📝 "${approach}": No passing language — but "${crossRefApproach}" passes all TCs. Skipping TC validation.`);
        console.log(`    🔍 Fixing "${approach}" langs using "${crossRefApproach}/${crossRefLang}" as cross-approach reference...`);

        // === BATCH FIX: Group failing langs by error category ===
        const crossBatchGroups = {};
        for (const lang of failingLangNames) {
          const failData = failingLangs[lang];
          const fts = failData.failedTests || [];
          if (!failData.code || fts.length === 0) continue;

          const hasWrongAnswer = fts.some(ft => ft.status === 'Accepted' && ft.actual && ft.actual !== '(empty)' && ft.actual !== ft.expected);
          const hasCompileError = fts.some(ft => ft.status && ft.status.includes('Compilation'));
          const hasOOM = fts.some(ft => (ft.status && ft.status.includes('Killed')) || (ft.error && (ft.error.includes('Killed') || ft.error.includes('Out of Memory'))));
          const hasEmptyOutput = fts.some(ft => ft.status === 'Accepted' && (!ft.actual || ft.actual === '(empty)'));

          let category = 'other';
          if (hasWrongAnswer) category = 'Wrong Answer';
          else if (hasCompileError) category = 'Compilation Error';
          else if (hasOOM) category = 'OOM/Killed';
          else if (hasEmptyOutput) category = 'Empty Output';

          if (!crossBatchGroups[category]) crossBatchGroups[category] = {};
          crossBatchGroups[category][lang] = failData;
        }

        const crossBatchFixed = new Set();
        for (const [category, langsMap] of Object.entries(crossBatchGroups)) {
          const batchLangs = Object.keys(langsMap);
          if (batchLangs.length < 2) continue;
          if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;

          console.log(`    📦 Batch fixing ${batchLangs.length} ${category} langs: ${batchLangs.join(', ')} (using ${crossRefApproach}/${crossRefLang} reference)...`);

          try {
            const batchPrompt = generateBatchFixPrompt(problem, approach, langsMap, crossRefLang, crossRefCode, category);
            const resp = await anthropic.messages.create({
              model: MODEL_SONNET, max_tokens: 16000,
              messages: [{ role: 'user', content: batchPrompt }]
            });
            const cost = calcCost(resp.usage);
            totalCost += cost;
            console.log(`      📊 Batch fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

            const parsed = parseJsonResponse(resp.content[0]?.text || '');

            for (const lang of batchLangs) {
              const fixedCode = parsed?.fixes?.approaches?.[approach]?.code?.[lang];
              if (!fixedCode) {
                console.log(`      ⚠️  ${lang}: no code in batch response`);
                continue;
              }

              console.log(`      🧪 Testing batch-fixed ${lang}...`);
              const testResult = await testCodeAgainstJudge0(fixedCode, lang, problem.testCases || [], { collectAll: false, indent: '      ' });

              if (testResult.passed) {
                console.log(`      ✅ ${lang} batch-fixed successfully!`);
                allFixes = mergeFixes(allFixes, { approaches: { [approach]: { code: { [lang]: fixedCode } } } });
                crossBatchFixed.add(lang);
              } else {
                console.log(`      ❌ ${lang} batch fix failed — will retry individually`);
              }
              await new Promise(r => setTimeout(r, 300));
            }
          } catch (err) {
            console.log(`      ❌ Batch fix error: ${err.message}`);
          }
        }

        for (const lang of failingLangNames) {
          if (crossBatchFixed.has(lang)) continue;
          if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) {
            console.log(`    💰 Cost cap reached. Skipping ${approach}/${lang}.`);
            break;
          }

          const failData = failingLangs[lang];
          const failingCode = failData.code || '';
          const failedTests = failData.failedTests || [];
          if (!failingCode || failedTests.length === 0) continue;

          // Phase A: Self-diagnose
          const errorTypes = [...new Set(failedTests.map(ft => ft.status))].join(', ');
          console.log(`    🔧 "${approach}/${lang}": Phase A — self-diagnosis [${errorTypes}]...`);

          let phaseAFixed = false;
          try {
            const selfFixPrompt = generateSelfFixPrompt(problem, approach, lang, failingCode, failedTests);
            const resp = await anthropic.messages.create({
              model: MODEL_SONNET, max_tokens: 8000,
              messages: [{ role: 'user', content: selfFixPrompt }]
            });
            const cost = calcCost(resp.usage);
            totalCost += cost;
            console.log(`      📊 Self-fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

            const parsed = parseJsonResponse(resp.content[0]?.text || '');
            if (parsed?.fixes?.approaches?.[approach]?.code?.[lang]) {
              const fixedCode = parsed.fixes.approaches[approach].code[lang];
              console.log(`      🧪 Testing self-fixed ${lang}...`);

              let selfFixPassed = true;
              for (let i = 0; i < (problem.testCases || []).length; i++) {
                const tc = problem.testCases[i];
                const stdin = buildStdin(tc);
                const expected = String(tc.expected ?? '').trim();
                try {
                  const result = await judge0Submit(fixedCode, LANGUAGE_IDS[lang], stdin);
                  const actual = (result.stdout || '').trim();
                  const passed = result.status.id === 3 && compareOutputs(actual, expected);
                  if (!passed) {
                    selfFixPassed = false;
                    console.log(`      ❌ TC${i + 1}: expected="${expected}" got="${actual || '(empty)'}" [${result.status.description}]`);
                    break;
                  } else {
                    console.log(`      ✅ TC${i + 1} passed`);
                  }
                } catch (err) {
                  selfFixPassed = false;
                  console.log(`      ❌ TC${i + 1}: ERROR - ${err.message}`);
                  break;
                }
                if (i < (problem.testCases || []).length - 1) await new Promise(r => setTimeout(r, 300));
              }

              if (selfFixPassed) {
                console.log(`      ✅ Phase A success — ${lang} self-fixed!`);
                allFixes = mergeFixes(allFixes, parsed.fixes);
                phaseAFixed = true;
              } else {
                console.log(`      ⚠️  Phase A failed — moving to Phase B (with ${crossRefApproach}/${crossRefLang} reference)...`);
              }
            }
          } catch (err) {
            console.log(`      ❌ Phase A error: ${err.message}`);
          }

          if (phaseAFixed) continue;
          if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) continue;

          // Phase B: Fix using cross-approach reference
          console.log(`    🚀 "${approach}/${lang}": Phase B — fix using ${crossRefApproach}/${crossRefLang} reference...`);
          try {
            const refFixPrompt = generateFixWithReferencePrompt(problem, approach, lang, failingCode, failedTests, crossRefLang, crossRefCode);
            const resp = await anthropic.messages.create({
              model: MODEL_SONNET, max_tokens: 8000,
              messages: [{ role: 'user', content: refFixPrompt }]
            });
            const cost = calcCost(resp.usage);
            totalCost += cost;
            console.log(`      📊 Reference fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

            const parsed = parseJsonResponse(resp.content[0]?.text || '');
            if (parsed?.fixes?.approaches?.[approach]?.code?.[lang]) {
              const fixedCode = parsed.fixes.approaches[approach].code[lang];
              console.log(`      🧪 Testing reference-fixed ${lang}...`);

              let phaseBPassed = true;
              const phaseBFailedTests = [];
              for (let i = 0; i < (problem.testCases || []).length; i++) {
                const tc = problem.testCases[i];
                const stdin = buildStdin(tc);
                const expected = String(tc.expected ?? '').trim();
                try {
                  const result = await judge0Submit(fixedCode, LANGUAGE_IDS[lang], stdin);
                  const actual = (result.stdout || '').trim();
                  const passed = result.status.id === 3 && compareOutputs(actual, expected);
                  if (!passed) {
                    phaseBPassed = false;
                    const error = result.compile_output || result.stderr || result.message || null;
                    phaseBFailedTests.push({ tc: i + 1, expected, actual: actual || '(empty)', error: error ? error.substring(0, result.status?.description?.includes('Compilation') ? 800 : 300) : null, status: result.status.description, memory: result.memory ? `${(result.memory / 1024).toFixed(2)}MB` : undefined, time: result.time ? `${result.time}s` : undefined });
                    console.log(`      ❌ TC${i + 1}: expected="${expected}" got="${actual || '(empty)'}" [${result.status.description}]`);
                  } else {
                    console.log(`      ✅ TC${i + 1} passed`);
                  }
                } catch (err) {
                  phaseBPassed = false;
                  phaseBFailedTests.push({ tc: i + 1, expected, actual: '', error: err.message, status: 'Error' });
                  console.log(`      ❌ TC${i + 1}: ERROR - ${err.message}`);
                }
                if (i < (problem.testCases || []).length - 1) await new Promise(r => setTimeout(r, 300));
              }

              if (phaseBPassed) {
                console.log(`      ✅ Phase B success — ${lang} fixed!`);
                allFixes = mergeFixes(allFixes, parsed.fixes);
              } else if (!(MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) && phaseBFailedTests.length > 0) {
                // Phase C: Error feedback retry loop (up to 3 attempts)
                let lastCode = fixedCode;
                let lastFailedTests = phaseBFailedTests;
                let retrySolved = false;

                const maxRetries = 3;
                for (let retryNum = 1; retryNum <= maxRetries; retryNum++) {
                  if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;

                  console.log(`      🔄 Phase C attempt ${retryNum}/${maxRetries} — sending Judge0 errors to AI...`);
                  try {
                    const errPrompt = generateErrorFeedbackPrompt(problem, approach, lang, lastCode, lastFailedTests, crossRefLang, crossRefCode);
                    const errResp = await anthropic.messages.create({
                      model: MODEL_SONNET, max_tokens: 8000,
                      messages: [{ role: 'user', content: errPrompt }]
                    });
                    const errCost = calcCost(errResp.usage);
                    totalCost += errCost;
                    console.log(`      📊 Error feedback fix #${retryNum}: ${fmtTokens(errResp.usage)} ($${errCost.toFixed(4)})`);

                    const errParsed = parseJsonResponse(errResp.content[0]?.text || '');
                    if (errParsed?.fixes?.approaches?.[approach]?.code?.[lang]) {
                      const retryCode = errParsed.fixes.approaches[approach].code[lang];
                      console.log(`      🧪 Testing error-feedback-fixed ${lang} (attempt ${retryNum})...`);

                      const retryResult = await testCodeAgainstJudge0(retryCode, lang, problem.testCases || [], { collectAll: true, indent: '      ' });

                      if (retryResult.passed) {
                        console.log(`      ✅ Phase C attempt ${retryNum} success — ${lang} fixed!`);
                        allFixes = mergeFixes(allFixes, errParsed.fixes);
                        retrySolved = true;
                        break;
                      } else {
                        console.log(`      ❌ Phase C attempt ${retryNum} failed for ${lang}`);
                        lastCode = retryCode;
                        lastFailedTests = retryResult.failedTests;
                      }
                    } else {
                      console.log(`      ⚠️  Phase C attempt ${retryNum}: AI returned no code`);
                      break;
                    }
                  } catch (err) {
                    console.log(`      ❌ Phase C attempt ${retryNum} error: ${err.message}`);
                    break;
                  }
                  await new Promise(r => setTimeout(r, 300));
                }

                if (!retrySolved) {
                  allFixes = mergeFixes(allFixes, parsed.fixes);
                }
              } else {
                // Merge anyway for final validation
                allFixes = mergeFixes(allFixes, parsed.fixes);
              }
            } else if (parsed?.fixes) {
              allFixes = mergeFixes(allFixes, parsed.fixes);
            }
          } catch (err) {
            console.log(`      ❌ Phase B error: ${err.message}`);
          }

          await new Promise(r => setTimeout(r, 300));
        }
        continue; // Done with this approach via cross-reference path
      }

      // No cross-approach reference available — fall back to TC validation + bulk AI fix
      console.log(`    📝 "${approach}": No passing language — validating test cases first...`);

      // Validate test cases via AI
      const tcValPrompt = generateTestCaseValidationPrompt(problem, approach, scan.tcOutputs);
      try {
        const tcResp = await anthropic.messages.create({
          model: MODEL_SONNET, max_tokens: 4000,
          messages: [{ role: 'user', content: tcValPrompt }]
        });
        const cost = calcCost(tcResp.usage);
        totalCost += cost;
        console.log(`    📊 TC Validation: ${fmtTokens(tcResp.usage)} ($${cost.toFixed(4)})`);

        const tcParsed = parseJsonResponse(tcResp.content[0]?.text || '');
        if (tcParsed?.fixes?.testCases?.length > 0) {
          console.log(`    🔧 AI found ${tcParsed.fixes.testCases.length} wrong test case(s)`);
          allFixes = mergeFixes(allFixes, { testCases: tcParsed.fixes.testCases });
          for (const fix of tcParsed.fixes.testCases) {
            if (fix.index >= 0 && fix.index < problem.testCases.length) {
              problem.testCases[fix.index].expected = fix.expected;
            }
          }
        }
      } catch (err) {
        console.log(`    ⚠️  TC validation error: ${err.message}`);
      }

      if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) {
        console.log(`    💰 Cost cap reached. Skipping AI code fix for "${approach}".`);
        continue;
      }

      console.log(`    🔍 Fixing code for "${approach}" via AI (no reference)...`);
      const fixPrompt = generateFixPromptFromScan(problem, approach, failingLangs, scan);
      try {
        const resp = await anthropic.messages.create({
          model: MODEL_SONNET, max_tokens: 16000,
          messages: [{ role: 'user', content: fixPrompt }]
        });
        const cost = calcCost(resp.usage);
        totalCost += cost;
        console.log(`    📊 Fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

        const parsed = parseJsonResponse(resp.content[0]?.text || '');
        if (parsed?.fixes) allFixes = mergeFixes(allFixes, parsed.fixes);
      } catch (err) {
        console.log(`    ❌ Fix error: ${err.message}`);
      }
      continue;
    }

    // We have passing reference — fix each failing lang individually
    const refLang = LANG_PREFERENCE.find(l => passingLangs.includes(l)) || passingLangs[0];
    const refCode = passingRef[refLang];

    // === BATCH FIX: Group failing langs by error category and fix together ===
    const batchGroups = {}; // { category: { lang: failData } }

    for (const lang of failingLangNames) {
      const failData = failingLangs[lang];
      const fts = failData.failedTests || [];
      if (!failData.code || fts.length === 0) continue;

      const hasWrongAnswer = fts.some(ft => ft.status === 'Accepted' && ft.actual && ft.actual !== '(empty)' && ft.actual !== ft.expected);
      const hasCompileError = fts.some(ft => ft.status && ft.status.includes('Compilation'));
      const hasOOM = fts.some(ft => (ft.status && ft.status.includes('Killed')) || (ft.error && (ft.error.includes('Killed') || ft.error.includes('Out of Memory'))));
      const hasEmptyOutput = fts.some(ft => ft.status === 'Accepted' && (!ft.actual || ft.actual === '(empty)'));

      let category = 'other';
      if (hasWrongAnswer) category = 'Wrong Answer';
      else if (hasCompileError) category = 'Compilation Error';
      else if (hasOOM) category = 'OOM/Killed';
      else if (hasEmptyOutput) category = 'Empty Output';

      if (!batchGroups[category]) batchGroups[category] = {};
      batchGroups[category][lang] = failData;
    }

    // Batch fix each category with 2+ langs in one API call
    const batchFixedLangs = new Set();
    for (const [category, langsMap] of Object.entries(batchGroups)) {
      const batchLangs = Object.keys(langsMap);
      if (batchLangs.length < 2) continue;
      if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;

      console.log(`    📦 Batch fixing ${batchLangs.length} ${category} langs: ${batchLangs.join(', ')} (using ${refLang} reference)...`);

      try {
        const batchPrompt = generateBatchFixPrompt(problem, approach, langsMap, refLang, refCode, category);
        const resp = await anthropic.messages.create({
          model: MODEL_SONNET, max_tokens: 16000,
          messages: [{ role: 'user', content: batchPrompt }]
        });
        const cost = calcCost(resp.usage);
        totalCost += cost;
        console.log(`      📊 Batch fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

        const parsed = parseJsonResponse(resp.content[0]?.text || '');

        // Test each lang from the batch
        for (const lang of batchLangs) {
          const fixedCode = parsed?.fixes?.approaches?.[approach]?.code?.[lang];
          if (!fixedCode) {
            console.log(`      ⚠️  ${lang}: no code in batch response`);
            continue;
          }

          console.log(`      🧪 Testing batch-fixed ${lang}...`);
          const testResult = await testCodeAgainstJudge0(fixedCode, lang, problem.testCases || [], { collectAll: false, indent: '      ' });

          if (testResult.passed) {
            console.log(`      ✅ ${lang} batch-fixed successfully!`);
            allFixes = mergeFixes(allFixes, { approaches: { [approach]: { code: { [lang]: fixedCode } } } });
            batchFixedLangs.add(lang);
          } else {
            console.log(`      ❌ ${lang} batch fix failed — will retry individually`);
          }
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (err) {
        console.log(`      ❌ Batch fix error: ${err.message}`);
      }
    }

    // Per-lang fix: skip batch-fixed langs, process remaining individually
    for (const lang of failingLangNames) {
      if (batchFixedLangs.has(lang)) continue;
      if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) {
        console.log(`    💰 Cost cap reached. Skipping ${approach}/${lang}.`);
        break;
      }

      const failData = failingLangs[lang];
      const failingCode = failData.code || '';
      const failedTests = failData.failedTests || [];
      if (!failingCode || failedTests.length === 0) continue;

      // --- PHASE A: Self-diagnose & fix (no reference shown) ---
      const errorTypes = [...new Set(failedTests.map(ft => ft.status))].join(', ');
      console.log(`    🔧 "${approach}/${lang}": Phase A — self-diagnosis [${errorTypes}]...`);

      let phaseAFixed = false;
      try {
        const selfFixPrompt = generateSelfFixPrompt(problem, approach, lang, failingCode, failedTests);
        const resp = await anthropic.messages.create({
          model: MODEL_SONNET, max_tokens: 8000,
          messages: [{ role: 'user', content: selfFixPrompt }]
        });
        const cost = calcCost(resp.usage);
        totalCost += cost;
        console.log(`      📊 Self-fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

        const parsed = parseJsonResponse(resp.content[0]?.text || '');
        if (parsed?.fixes?.approaches?.[approach]?.code?.[lang]) {
          const fixedCode = parsed.fixes.approaches[approach].code[lang];
          console.log(`      🧪 Testing self-fixed ${lang}...`);

          // Quick-test the fixed code against all TCs
          let selfFixPassed = true;
          for (let i = 0; i < (problem.testCases || []).length; i++) {
            const tc = problem.testCases[i];
            const stdin = buildStdin(tc);
            const expected = String(tc.expected ?? '').trim();
            try {
              const result = await judge0Submit(fixedCode, LANGUAGE_IDS[lang], stdin);
              const actual = (result.stdout || '').trim();
              const passed = result.status.id === 3 && compareOutputs(actual, expected);
              if (!passed) {
                selfFixPassed = false;
                console.log(`      ❌ TC${i + 1}: expected="${expected}" got="${actual || '(empty)'}" [${result.status.description}]`);
                break;
              } else {
                console.log(`      ✅ TC${i + 1} passed`);
              }
            } catch (err) {
              selfFixPassed = false;
              console.log(`      ❌ TC${i + 1}: ERROR - ${err.message}`);
              break;
            }
            if (i < (problem.testCases || []).length - 1) await new Promise(r => setTimeout(r, 300));
          }

          if (selfFixPassed) {
            console.log(`      ✅ Phase A success — ${lang} self-fixed!`);
            allFixes = mergeFixes(allFixes, parsed.fixes);
            phaseAFixed = true;
          } else {
            console.log(`      ⚠️  Phase A failed — moving to Phase B (with ${refLang} reference)...`);
          }
        }
      } catch (err) {
        console.log(`      ❌ Phase A error: ${err.message}`);
      }

      if (phaseAFixed) continue;
      if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) continue;

      // --- PHASE B: Show working reference and ask to fix ---
      console.log(`    🚀 "${approach}/${lang}": Phase B — fix using working ${refLang} reference...`);

      try {
        const refFixPrompt = generateFixWithReferencePrompt(problem, approach, lang, failingCode, failedTests, refLang, refCode);
        const resp = await anthropic.messages.create({
          model: MODEL_SONNET, max_tokens: 8000,
          messages: [{ role: 'user', content: refFixPrompt }]
        });
        const cost = calcCost(resp.usage);
        totalCost += cost;
        console.log(`      📊 Reference fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

        const parsed = parseJsonResponse(resp.content[0]?.text || '');
        if (parsed?.fixes?.approaches?.[approach]?.code?.[lang]) {
          const fixedCode = parsed.fixes.approaches[approach].code[lang];
          console.log(`      🧪 Testing reference-fixed ${lang}...`);

          // Quick-test the fixed code against all TCs
          let phaseBPassed = true;
          const phaseBFailedTests = [];
          for (let i = 0; i < (problem.testCases || []).length; i++) {
            const tc = problem.testCases[i];
            const stdin = buildStdin(tc);
            const expected = String(tc.expected ?? '').trim();
            try {
              const result = await judge0Submit(fixedCode, LANGUAGE_IDS[lang], stdin);
              const actual = (result.stdout || '').trim();
              const passed = result.status.id === 3 && compareOutputs(actual, expected);
              if (!passed) {
                phaseBPassed = false;
                const error = result.compile_output || result.stderr || result.message || null;
                phaseBFailedTests.push({
                  tc: i + 1, expected, actual: actual || '(empty)',
                  error: error ? error.substring(0, result.status?.description?.includes('Compilation') ? 800 : 300) : null,
                  status: result.status.description,
                  memory: result.memory ? `${(result.memory / 1024).toFixed(2)}MB` : undefined,
                  time: result.time ? `${result.time}s` : undefined,
                });
                console.log(`      ❌ TC${i + 1}: expected="${expected}" got="${actual || '(empty)'}" [${result.status.description}]`);
                // Don't break — collect all failures for error feedback
              } else {
                console.log(`      ✅ TC${i + 1} passed`);
              }
            } catch (err) {
              phaseBPassed = false;
              phaseBFailedTests.push({ tc: i + 1, expected, actual: '', error: err.message, status: 'Error' });
              console.log(`      ❌ TC${i + 1}: ERROR - ${err.message}`);
            }
            if (i < (problem.testCases || []).length - 1) await new Promise(r => setTimeout(r, 300));
          }

          if (phaseBPassed) {
            console.log(`      ✅ Phase B success — ${lang} fixed with ${refLang} reference!`);
            allFixes = mergeFixes(allFixes, parsed.fixes);
          } else if (!(MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) && phaseBFailedTests.length > 0) {
            // Phase C: Error feedback retry loop (up to 3 attempts)
            let lastCode = fixedCode;
            let lastFailedTests = phaseBFailedTests;
            let retrySolved = false;

            const maxRetries = 3;
            for (let retryNum = 1; retryNum <= maxRetries; retryNum++) {
              if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;

              console.log(`      🔄 Phase C attempt ${retryNum}/${maxRetries} — sending Judge0 errors to AI...`);
              try {
                const errPrompt = generateErrorFeedbackPrompt(problem, approach, lang, lastCode, lastFailedTests, refLang, refCode);
                const errResp = await anthropic.messages.create({
                  model: MODEL_SONNET, max_tokens: 8000,
                  messages: [{ role: 'user', content: errPrompt }]
                });
                const errCost = calcCost(errResp.usage);
                totalCost += errCost;
                console.log(`      📊 Error feedback fix #${retryNum}: ${fmtTokens(errResp.usage)} ($${errCost.toFixed(4)})`);

                const errParsed = parseJsonResponse(errResp.content[0]?.text || '');
                if (errParsed?.fixes?.approaches?.[approach]?.code?.[lang]) {
                  const retryCode = errParsed.fixes.approaches[approach].code[lang];
                  console.log(`      🧪 Testing error-feedback-fixed ${lang} (attempt ${retryNum})...`);

                  const retryResult = await testCodeAgainstJudge0(retryCode, lang, problem.testCases || [], { collectAll: true, indent: '      ' });

                  if (retryResult.passed) {
                    console.log(`      ✅ Phase C attempt ${retryNum} success — ${lang} fixed!`);
                    allFixes = mergeFixes(allFixes, errParsed.fixes);
                    retrySolved = true;
                    break;
                  } else {
                    console.log(`      ❌ Phase C attempt ${retryNum} failed for ${lang}`);
                    // Update lastCode and lastFailedTests for next retry with fresh errors
                    lastCode = retryCode;
                    lastFailedTests = retryResult.failedTests;
                  }
                } else {
                  console.log(`      ⚠️  Phase C attempt ${retryNum}: AI returned no code`);
                  break;
                }
              } catch (err) {
                console.log(`      ❌ Phase C attempt ${retryNum} error: ${err.message}`);
                break;
              }
              await new Promise(r => setTimeout(r, 300));
            }

            if (!retrySolved) {
              // Merge the best attempt (Phase B output) so final validation can try
              allFixes = mergeFixes(allFixes, parsed.fixes);
            }
          } else {
            // Merge Phase B attempt anyway for final validation
            allFixes = mergeFixes(allFixes, parsed.fixes);
          }
        } else if (parsed?.fixes) {
          allFixes = mergeFixes(allFixes, parsed.fixes);
        }
      } catch (err) {
        console.log(`      ❌ Phase B error: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }

  const hasCodeFixes = allFixes.approaches && Object.keys(allFixes.approaches).length > 0;
  const hasTcFixes = allFixes.testCases?.length > 0;
  const hasPassingCode = Object.keys(scan.passingCode).length > 0;

  if (!hasCodeFixes && !hasTcFixes && !hasPassingCode) {
    console.log(`    ❌ No fixes produced and no passing code`);
    return null;
  }

  if (!hasCodeFixes && !hasTcFixes) {
    // Most/all langs already pass, only a few failed and couldn't be fixed
    // Still proceed to final validation to confirm passing state
    console.log(`    ⚠️  No code fixes produced for failing lang(s), but other langs pass — proceeding to validation`);
  }

  // === STEP 7: Final validation ===
  console.log(`    🧪 Final validation...`);
  // Pass scan.report so already-passing combos (that weren't fixed) are skipped
  let finalScan = await runFullJudge0Scan(
    applyFixesToProblemInMemory(problem, allFixes),
    allFixes.testCases || [],
    scan.report
  );

  // One more auto-correct pass on final results
  if (!finalScan.allPassed) {
    const finalTcFixes = detectAndFixWrongTestCases(finalScan.tcOutputs, applyFixesToProblemInMemory(problem, allFixes));
    if (finalTcFixes.length > 0) {
      allFixes = mergeFixes(allFixes, { testCases: finalTcFixes });
      console.log(`    🔧 Final auto-correct: ${finalTcFixes.length} TC(s)`);
      for (const fix of finalTcFixes) {
        if (fix.index >= 0 && fix.index < problem.testCases.length) {
          problem.testCases[fix.index].expected = fix.expected;
        }
      }
      finalScan = await runFullJudge0Scan(
        applyFixesToProblemInMemory(problem, allFixes),
        allFixes.testCases || []
      );
    }
  }

  // === STEP 8: Phase A/B fix for still-failing langs (uses final scan results) ===
  if (!finalScan.allPassed && !(MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM)) {
    const stillFailingCount = Object.keys(finalScan.failingCode).reduce((sum, a) => sum + Object.keys(finalScan.failingCode[a]).length, 0);
    console.log(`    🔄 Phase A/B retry: ${stillFailingCount} lang(s) still failing after initial fixes...`);

    for (const [approach, failingLangs] of Object.entries(finalScan.failingCode)) {
      if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) {
        console.log(`    💰 Cost cap reached. Stopping retry.`);
        break;
      }

      // Find a passing reference for this approach (if any)
      let refLang = null, refCode = null;
      const passingRef = finalScan.passingCode[approach] || {};
      const passingRefLangs = Object.keys(passingRef);
      if (passingRefLangs.length > 0) {
        refLang = LANG_PREFERENCE.find(l => passingRefLangs.includes(l)) || passingRefLangs[0];
        refCode = passingRef[refLang];
      }

      // === BATCH FIX in retry: Group failing langs by error category ===
      if (refLang && refCode) {
        const retryBatchGroups = {};
        for (const [lang, data] of Object.entries(failingLangs)) {
          const fts = data.failedTests || [];
          const currentCode = allFixes.approaches?.[approach]?.code?.[lang] || 
                             problem.approaches?.[approach]?.code?.[lang] || data.code || '';
          if (!currentCode || fts.length === 0) continue;

          const hasWA = fts.some(ft => ft.status === 'Accepted' && ft.actual && ft.actual !== '(empty)' && ft.actual !== ft.expected);
          const hasCompile = fts.some(ft => ft.status && ft.status.includes('Compilation'));
          const hasOOM = fts.some(ft => (ft.status && ft.status.includes('Killed')) || (ft.error && (ft.error.includes('Killed') || ft.error.includes('Out of Memory'))));
          const hasEmpty = fts.some(ft => ft.status === 'Accepted' && (!ft.actual || ft.actual === '(empty)'));

          let category = 'other';
          if (hasWA) category = 'Wrong Answer';
          else if (hasCompile) category = 'Compilation Error';
          else if (hasOOM) category = 'OOM/Killed';
          else if (hasEmpty) category = 'Empty Output';

          if (!retryBatchGroups[category]) retryBatchGroups[category] = {};
          retryBatchGroups[category][lang] = { code: currentCode, failedTests: fts };
        }

        for (const [category, langsMap] of Object.entries(retryBatchGroups)) {
          const batchLangs = Object.keys(langsMap);
          if (batchLangs.length < 2) continue;
          if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;

          console.log(`      📦 Batch retry fixing ${batchLangs.length} ${category} langs: ${batchLangs.join(', ')}...`);

          try {
            const batchPrompt = generateBatchFixPrompt(problem, approach, langsMap, refLang, refCode, category);
            const resp = await anthropic.messages.create({
              model: MODEL_SONNET, max_tokens: 16000,
              messages: [{ role: 'user', content: batchPrompt }]
            });
            const cost = calcCost(resp.usage);
            totalCost += cost;
            console.log(`        📊 Batch retry fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

            const parsed = parseJsonResponse(resp.content[0]?.text || '');

            for (const lang of batchLangs) {
              const fixedCode = parsed?.fixes?.approaches?.[approach]?.code?.[lang];
              if (!fixedCode) continue;

              console.log(`        🧪 Testing batch-retry-fixed ${lang}...`);
              const testResult = await testCodeAgainstJudge0(fixedCode, lang, problem.testCases || [], { collectAll: false, indent: '        ' });

              if (testResult.passed) {
                console.log(`        ✅ ${lang} batch-retry-fixed!`);
                allFixes = mergeFixes(allFixes, { approaches: { [approach]: { code: { [lang]: fixedCode } } } });
                delete failingLangs[lang];
              } else {
                console.log(`        ❌ ${lang} batch retry failed`);
              }
              await new Promise(r => setTimeout(r, 300));
            }
          } catch (err) {
            console.log(`        ❌ Batch retry error: ${err.message}`);
          }
        }
      }

      for (const [lang, data] of Object.entries(failingLangs)) {
        if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) break;

        const failedTests = data.failedTests || [];
        if (failedTests.length === 0) continue;

        // Get the current code (with any fixes applied)
        const currentCode = allFixes.approaches?.[approach]?.code?.[lang] || 
                           problem.approaches?.[approach]?.code?.[lang] || data.code || '';
        if (!currentCode) continue;

        const errorTypes = [...new Set(failedTests.map(ft => ft.status))].join(', ');

        // --- PHASE A: Self-diagnose & fix (no reference) ---
        console.log(`      🔧 ${approach}/${lang}: Phase A — self-diagnosis [${errorTypes}]...`);

        let phaseAFixed = false;
        try {
          const selfFixPrompt = generateSelfFixPrompt(problem, approach, lang, currentCode, failedTests);
          const resp = await anthropic.messages.create({
            model: MODEL_SONNET, max_tokens: 8000,
            messages: [{ role: 'user', content: selfFixPrompt }]
          });
          const cost = calcCost(resp.usage);
          totalCost += cost;
          console.log(`        📊 Self-fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

          const parsed = parseJsonResponse(resp.content[0]?.text || '');
          if (parsed?.fixes?.approaches?.[approach]?.code?.[lang]) {
            const fixedCode = parsed.fixes.approaches[approach].code[lang];
            console.log(`        🧪 Testing self-fixed ${lang}...`);

            let selfFixPassed = true;
            for (let i = 0; i < (problem.testCases || []).length; i++) {
              const tc = problem.testCases[i];
              const stdin = buildStdin(tc);
              const expected = String(tc.expected ?? '').trim();
              try {
                const result = await judge0Submit(fixedCode, LANGUAGE_IDS[lang], stdin);
                const actual = (result.stdout || '').trim();
                const passed = result.status.id === 3 && compareOutputs(actual, expected);
                if (!passed) {
                  selfFixPassed = false;
                  console.log(`        ❌ TC${i + 1}: expected="${expected}" got="${actual || '(empty)'}" [${result.status.description}]`);
                  break;
                } else {
                  console.log(`        ✅ TC${i + 1} passed`);
                }
              } catch (err) {
                selfFixPassed = false;
                console.log(`        ❌ TC${i + 1}: ERROR - ${err.message}`);
                break;
              }
              if (i < (problem.testCases || []).length - 1) await new Promise(r => setTimeout(r, 300));
            }

            if (selfFixPassed) {
              console.log(`        ✅ Phase A success — ${lang} self-fixed!`);
              allFixes = mergeFixes(allFixes, parsed.fixes);
              phaseAFixed = true;
            } else {
              console.log(`        ⚠️  Phase A failed — moving to Phase B...`);
            }
          }
        } catch (err) {
          console.log(`        ❌ Phase A error: ${err.message}`);
        }

        if (phaseAFixed) continue;
        if (MAX_COST_PER_PROBLEM > 0 && totalCost >= MAX_COST_PER_PROBLEM) continue;

        // --- PHASE B: Fix with working reference (if available) ---
        if (refLang && refCode) {
          console.log(`      🚀 ${approach}/${lang}: Phase B — fix using working ${refLang} reference...`);
          try {
            const refFixPrompt = generateFixWithReferencePrompt(problem, approach, lang, currentCode, failedTests, refLang, refCode);
            const resp = await anthropic.messages.create({
              model: MODEL_SONNET, max_tokens: 8000,
              messages: [{ role: 'user', content: refFixPrompt }]
            });
            const cost = calcCost(resp.usage);
            totalCost += cost;
            console.log(`        📊 Reference fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

            const parsed = parseJsonResponse(resp.content[0]?.text || '');
            if (parsed?.fixes) {
              allFixes = mergeFixes(allFixes, parsed.fixes);
            }
          } catch (err) {
            console.log(`        ❌ Phase B error: ${err.message}`);
          }
        } else {
          // No reference available — use generic error feedback prompt
          console.log(`      🔧 ${approach}/${lang}: No reference — sending error feedback to AI...`);
          try {
            const errorPrompt = generateErrorFeedbackPrompt(problem, approach, lang, currentCode, failedTests, null, null);
            const resp = await anthropic.messages.create({
              model: MODEL_SONNET, max_tokens: 8000,
              messages: [{ role: 'user', content: errorPrompt }]
            });
            const cost = calcCost(resp.usage);
            totalCost += cost;
            console.log(`        📊 Error fix: ${fmtTokens(resp.usage)} ($${cost.toFixed(4)})`);

            const parsed = parseJsonResponse(resp.content[0]?.text || '');
            if (parsed?.fixes) {
              allFixes = mergeFixes(allFixes, parsed.fixes);
            }
          } catch (err) {
            console.log(`        ❌ Error fix failed: ${err.message}`);
          }
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Re-validate after Phase A/B fixes
    console.log(`    🧪 Re-validating after Phase A/B retry...`);
    finalScan = await runFullJudge0Scan(
      applyFixesToProblemInMemory(problem, allFixes),
      allFixes.testCases || []
    );
  }

  if (finalScan.allPassed) {
    console.log(`    ✅ All tests passed!`);
  } else {
    const failCount = Object.keys(finalScan.failingCode).reduce((sum, a) => sum + Object.keys(finalScan.failingCode[a]).length, 0);
    console.log(`    ⚠️  ${failCount} approach/lang combo(s) still failing`);
  }

  return {
    problemId: problem.id,
    result: { status: 'needs_fixes', summary: 'Smart fix applied', fixes: allFixes, validationPassed: finalScan.allPassed },
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
  console.log(`📥 Fetching coding problems where tests_passed is missing or false...${skip > 0 ? ` (skipping first ${skip})` : ''}${reverse ? ' (reverse Z→A)' : ''}`);
  try {
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding')
      .get();
    const allProblems = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Pick up if tests_passed doesn't exist OR is false/null/undefined
      if (!data.tests_passed) {
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
  const problems = await fetchFailedProblems(limit, skip, reverse);
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
      const stdin = buildStdin(tc);
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
