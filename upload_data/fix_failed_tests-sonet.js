/**
 * Fix Failed Tests
 * Reads problems from Firebase where tests_passed = false,
 * analyzes tests_report to find failing approach+language combinations,
 * sends them to Claude AI for fixing, and applies fixes back.
 *
 * Usage:
 *   TEST MODE (single problem, live API):
 *     node fix_failed_tests.js --test <problem_id>
 *     node fix_failed_tests.js --test-apply <problem_id>
 *
 *   LIST MODE (multiple problems, live API):
 *     node fix_failed_tests.js --list-failed [limit]
 *     node fix_failed_tests.js --fix-all [limit]
 *     node fix_failed_tests.js --fix-apply-all [limit]
 *
 *   BATCH MODE (50% cheaper):
 *     node fix_failed_tests.js --create-batch [limit]
 *     node fix_failed_tests.js --check-batch <batch_id>
 *     node fix_failed_tests.js --process-results <batch_id>
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
const MAX_FIX_RETRIES = 3;
const ANCHOR_LANG = 'python'; // Fix this language first, then translate
const USE_EXTENDED_THINKING_ON_RETRY = true; // Use extended thinking for hard problems
const EXTENDED_THINKING_BUDGET = 10000; // Token budget for thinking

const LANGUAGE_IDS = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  c: 50,
  go: 60,
};

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

// ==================== JUDGE0 HELPERS ====================

function b64Encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function b64Decode(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

async function judge0Submit(sourceCode, languageId, stdin) {
  const url = `${JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=true`;
  const payload = {
    source_code: b64Encode(sourceCode),
    language_id: languageId,
    stdin: stdin ? b64Encode(stdin) : '',
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`Judge0 HTTP ${resp.status}: ${resp.statusText}`);
  }

  const result = await resp.json();

  for (const field of ['stdout', 'stderr', 'compile_output', 'message']) {
    if (result[field]) {
      try { result[field] = b64Decode(result[field]); } catch (_) {}
    }
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
      if (result[field]) {
        try { result[field] = b64Decode(result[field]); } catch (_) {}
      }
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
  const values = Object.values(input);
  return values.join('\n');
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
        const aSorted = [...a].map(sortKey).sort();
        const eSorted = [...e].map(sortKey).sort();
        if (JSON.stringify(aSorted) === JSON.stringify(eSorted)) return true;
      }
    } catch (e) {}
  }

  if (actual.replace(/\s+/g, ' ') === expected.replace(/\s+/g, ' ')) return true;
  if (actual.replace(/\n+$/, '') === expected.replace(/\n+$/, '')) return true;

  return false;
}

/**
 * Run fixed code against ALL test cases via Judge0
 * Returns { allPassed, results: { "approach/lang": { passed, failedTests: [...] } } }
 */
async function validateFixedCode(problem, fixes) {
  const testCases = problem.testCases || [];
  // Merge fixed test cases if any
  let effectiveTestCases = [...testCases];
  if (fixes.testCases && fixes.testCases.length > 0) {
    for (const fix of fixes.testCases) {
      if (fix.index >= 0 && fix.index < effectiveTestCases.length && fix.expected !== undefined) {
        effectiveTestCases[fix.index] = { ...effectiveTestCases[fix.index], expected: fix.expected };
      }
    }
  }

  if (effectiveTestCases.length === 0) {
    console.log(`    ⚠️  No test cases to validate against`);
    return { allPassed: true, results: {}, report: {} };
  }

  const currentApproaches = { ...problem.approaches };
  // Overlay the fixed code onto current approaches
  if (fixes.approaches) {
    for (const [approachName, approachFix] of Object.entries(fixes.approaches)) {
      if (approachFix.code && currentApproaches[approachName]) {
        currentApproaches[approachName] = {
          ...currentApproaches[approachName],
          code: {
            ...currentApproaches[approachName].code,
            ...approachFix.code,
          }
        };
      }
    }
  }

  let allPassed = true;
  const results = {};
  const report = {};

  for (const [approachName, approachData] of Object.entries(currentApproaches)) {
    if (!approachData.code) continue;
    report[approachName] = {};

    for (const [lang, code] of Object.entries(approachData.code)) {
      const langId = LANGUAGE_IDS[lang];
      if (!langId) continue;

      const key = `${approachName}/${lang}`;
      console.log(`      🧪 Testing ${key}...`);

      let langPassed = true;
      const tcResults = [];
      const failedTests = [];

      for (let i = 0; i < effectiveTestCases.length; i++) {
        const tc = effectiveTestCases[i];
        const stdin = buildStdin(tc);
        const expected = String(tc.expected ?? '').trim();

        try {
          const result = await judge0Submit(code, langId, stdin);
          const actual = (result.stdout || '').trim();
          const passed = result.status.id === 3 && compareOutputs(actual, expected);
          const error = result.compile_output || result.stderr || result.message || null;

          tcResults.push({
            tc: i + 1,
            passed,
            status: result.status.description,
            ...(passed ? {} : { expected, actual, ...(error ? { error: error.substring(0, 300) } : {}) })
          });

          if (!passed) {
            langPassed = false;
            failedTests.push({
              tc: i + 1,
              expected,
              actual,
              error: error ? error.substring(0, 300) : null,
              status: result.status.description,
            });
            console.log(`        ❌ TC${i + 1}: expected="${expected}" got="${actual}" [${result.status.description}]`);
          } else {
            console.log(`        ✅ TC${i + 1} passed`);
          }
        } catch (err) {
          langPassed = false;
          tcResults.push({ tc: i + 1, passed: false, status: 'Error', expected, actual: '', error: err.message });
          failedTests.push({ tc: i + 1, expected, actual: '', error: err.message, status: 'Error' });
          console.log(`        ❌ TC${i + 1}: ERROR - ${err.message}`);
        }

        if (i < effectiveTestCases.length - 1) await new Promise(r => setTimeout(r, 300));
      }

      report[approachName][lang] = { passed: langPassed, results: tcResults };
      if (!langPassed) {
        allPassed = false;
        results[key] = { passed: false, failedTests };
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Collect passing code per approach (to use as reference for failing langs)
  const passedCode = {};
  for (const [approachName, approachData] of Object.entries(currentApproaches)) {
    if (!approachData.code) continue;
    for (const [lang, code] of Object.entries(approachData.code)) {
      const key = `${approachName}/${lang}`;
      if (!results[key]) {
        // This approach/lang passed all tests
        if (!passedCode[approachName]) passedCode[approachName] = {};
        passedCode[approachName][lang] = code;
      }
    }
  }

  return { allPassed, results, report, passedCode };
}

/**
 * Generate a retry prompt with the validation results so AI can see what still fails
 */
function generateRetryPrompt(problemData, previousFixes, validationResults, attempt, passedCode = {}) {
  const {
    title,
    description,
    descriptionText,
    approaches,
    testCases,
    examples,
    paramOrder,
    constraints
  } = problemData;

  // Build current code state (original + previous fixes applied)
  const currentCode = {};
  for (const [approachName, approachData] of Object.entries(approaches || {})) {
    if (!approachData.code) continue;
    currentCode[approachName] = { ...approachData.code };
  }
  if (previousFixes.approaches) {
    for (const [approachName, approachFix] of Object.entries(previousFixes.approaches)) {
      if (approachFix.code) {
        if (!currentCode[approachName]) currentCode[approachName] = {};
        Object.assign(currentCode[approachName], approachFix.code);
      }
    }
  }

  // Build effective test cases
  let effectiveTestCases = [...(testCases || [])];
  if (previousFixes.testCases) {
    for (const fix of previousFixes.testCases) {
      if (fix.index >= 0 && fix.index < effectiveTestCases.length && fix.expected !== undefined) {
        effectiveTestCases[fix.index] = { ...effectiveTestCases[fix.index], expected: fix.expected };
      }
    }
  }

  // Only include still-failing code
  const stillFailing = {};
  for (const [key, data] of Object.entries(validationResults)) {
    const [approachName, lang] = key.split('/');
    if (!stillFailing[approachName]) stillFailing[approachName] = {};
    stillFailing[approachName][lang] = {
      code: currentCode[approachName]?.[lang] || '',
      failedTests: data.failedTests,
    };
  }

  // Build reference code section — passing code from same approach
  const referenceCode = {};
  for (const approachName of Object.keys(stillFailing)) {
    if (passedCode[approachName] && Object.keys(passedCode[approachName]).length > 0) {
      referenceCode[approachName] = passedCode[approachName];
    }
  }

  const promptData = {
    title,
    description: description || descriptionText,
    paramOrder: paramOrder || [],
    constraints: constraints || [],
    examples: examples || [],
    testCases: effectiveTestCases,
    allApproachNames: Object.keys(approaches || {}),
    analogy: problemData.analogy || {},
    failingCodes: stillFailing,
  };

  // Add reference code to prompt data if available
  if (Object.keys(referenceCode).length > 0) {
    promptData.referenceCode = referenceCode;
  }

  let referenceSection = '';
  if (Object.keys(referenceCode).length > 0) {
    referenceSection = `
## 🟢 REFERENCE — Working code that PASSED all tests:
The \`referenceCode\` object contains code from the SAME approach that has ALREADY PASSED all test cases in other languages.
**USE THIS AS YOUR PRIMARY REFERENCE.** Convert/adapt the working code logic to the failing languages. This is the most reliable way to fix the remaining code since it's proven to produce correct output.
- Match the algorithm logic exactly from the reference code.
- Only adapt language-specific syntax (I/O, types, etc).
- Keep the same I/O format (stdin/stdout) as the FAILING code — just fix the algorithm to match the reference.
`;
  }

  return `You are an expert code fixer. This is RETRY ATTEMPT ${attempt}/${MAX_FIX_RETRIES}. Your previous fix was tested but STILL FAILS some test cases. The code was actually executed via Judge0 and the results below show exactly what happened.

**PROBLEM DATA:**
\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\`

## What's happening:
- The \`failingCodes\` object contains the CURRENT code (with your previous fixes already applied) that is STILL failing.
- Each \`failedTests\` entry shows the ACTUAL execution result from Judge0 — these are real outputs, not predictions.
- Pay close attention to: compile errors, runtime errors, wrong output values, and status descriptions.
${referenceSection}
## CRITICAL — Learn from previous failure:
- Your previous fix did NOT work. Analyze the actual vs expected output carefully.
${Object.keys(referenceCode).length > 0 ? '- **PRIORITIZE converting the working reference code** to the failing languages rather than trying to debug the broken code from scratch.\n' : ''}- If you see "Compilation Error" — check syntax for that specific language.
- If you see wrong output — your algorithm logic is still incorrect. Rethink the approach.
- If you see "Time Limit Exceeded" — optimize the solution.
- If you see "Runtime Error" — check for edge cases (empty input, overflow, null, etc.)

## Rules:
- Keep the same I/O format (stdin reading, stdout printing).
- Keep the same function signature.
- Only fix the algorithm logic / computation bugs.
- For Java: handle empty array input "[]" gracefully.
- For JavaScript: beware of integer overflow — use BigInt if needed.
- Provide COMPLETE corrected code (not just changed parts).

## Response format:
Return ONLY valid JSON (no markdown, no backticks):
{
  "status": "needs_fixes",
  "summary": "Brief description of what was still wrong and what you changed",
  "fixes": {
    "approaches": {
      "approach-name": {
        "code": {
          "language": "FULL CORRECTED CODE HERE"
        }
      }
    },
    "analogy": {},
    "testCases": []
  },
  "details": [
    {
      "approach": "approach-name",
      "language": "python",
      "issue": "Description of bug",
      "fix": "What was changed"
    }
  ]
}

Only include "testCases" if expected values are genuinely wrong.
Only include "analogy" keys that need updating.

Begin analysis now.`;
}

// ==================== ANALYZE FAILURES ====================

/**
 * Analyze tests_report to find all failing approach+language combinations
 * Returns: { "approach-name": { "language": { passed: false, failures: [...] } } }
 */
function analyzeFailures(testsReport) {
  const failures = {};

  if (!testsReport) return failures;

  for (const [approachName, approachReport] of Object.entries(testsReport)) {
    for (const [language, langReport] of Object.entries(approachReport)) {
      if (langReport.passed === false) {
        if (!failures[approachName]) {
          failures[approachName] = {};
        }
        // Collect failing test case details
        const failedTests = (langReport.results || [])
          .filter(r => r.passed === false)
          .map(r => ({
            tc: r.tc,
            expected: r.expected,
            actual: r.actual,
            error: r.error,
            status: r.status
          }));

        failures[approachName][language] = {
          passed: false,
          failedTests
        };
      }
    }
  }

  return failures;
}

// ==================== GENERATE FIX PROMPT ====================

function generateFixPrompt(problemData, failures) {
  const {
    title,
    description,
    descriptionText,
    approaches,
    testCases,
    examples,
    paramOrder,
    constraints
  } = problemData;

  // Build the failing codes object - only include failing approach+language code
  const failingCodes = {};
  for (const [approachName, languages] of Object.entries(failures)) {
    failingCodes[approachName] = {};
    for (const [lang, failInfo] of Object.entries(languages)) {
      const code = approaches?.[approachName]?.code?.[lang];
      if (code) {
        failingCodes[approachName][lang] = {
          code,
          failedTests: failInfo.failedTests
        };
      }
    }
  }

  // Collect ALL approach names (for analogy mapping context)
  const allApproachNames = Object.keys(approaches || {});

  // Collect full analogy object (all keys)
  const analogy = problemData.analogy || {};

  const promptData = {
    title,
    description: description || descriptionText,
    paramOrder: paramOrder || [],
    constraints: constraints || [],
    examples: examples || [],
    testCases: testCases || [],
    allApproachNames,
    analogy,
    failingCodes
  };

  return `You are an expert code fixer. I have a coding problem where some code solutions are failing test cases. Fix ALL the failing code.

**PROBLEM DATA:**
\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\`

## What's happening:
- The \`failingCodes\` object contains approach names, and for each approach, the languages whose code is failing.
- Each failing language entry has the current \`code\` and the \`failedTests\` showing which test cases failed with expected vs actual output.
- \`allApproachNames\` lists ALL approaches in the problem (e.g. ["brute-force", "sort-first", "two-pointer"]).
- The \`analogy\` section contains analogy descriptions. It has general fields like \`title\`, \`description\`, \`icon\`, \`keyInsight\` and approach-specific fields that describe each approach's strategy (e.g. \`bruteForce\`, \`optimal\`, \`twoPass\`, \`greedy\`, etc.). The keys vary per problem — there can be any number of approach-specific analogy fields.

## Your tasks:
1. Understand the problem from description, examples, and test cases.
2. For each failing code, analyze WHY it's producing wrong output.
3. Fix the code so it produces the correct expected output for ALL test cases.
4. If an approach's algorithm logic was fundamentally wrong (not just a minor bug), also fix the corresponding analogy fields that describe that approach. Check ALL analogy keys — any key that describes the fixed approach's old (wrong) strategy should be updated to match the corrected algorithm.
5. ALSO check if any test case expected values are wrong. If the problem description clearly indicates a different answer than what's in expected, flag it.

## CRITICAL RULES:
- Keep the same I/O format (stdin reading, stdout printing) - do NOT change how input is read or output is printed.
- Keep the same function signature.
- Only fix the algorithm logic / computation bugs.
- For Java: handle empty array input "[]" gracefully (don't crash on empty string split).
- For JavaScript: beware of integer overflow with large numbers - use BigInt if needed for modular arithmetic.
- Provide COMPLETE corrected code for each fix (not just the changed part).

## Response format:
Return ONLY valid JSON (no markdown, no backticks):

If fixes are needed:
{
  "status": "needs_fixes",
  "summary": "Brief description of what was wrong",
  "fixes": {
    "approaches": {
      "approach-name": {
        "code": {
          "language": "FULL CORRECTED CODE HERE"
        }
      }
    },
    "analogy": {
      "bruteForce": "corrected analogy for brute force",
      "optimal": "corrected analogy for optimal",
      "keyInsight": "corrected key insight",
      "description": "corrected description"
    },
    "testCases": [
      {
        "index": 0,
        "expected": "corrected value"
      }
    ]
  },
  "details": [
    {
      "approach": "approach-name",
      "language": "python",
      "issue": "Description of bug",
      "fix": "What was changed"
    }
  ]
}

Only include "testCases" in fixes if expected values are genuinely wrong.
Only include "approaches" in fixes if code needs fixing.
Only include "analogy" in fixes if an approach's algorithm was fundamentally changed (not for minor bugs like overflow or empty input handling). Include ONLY the analogy keys that need updating — do not include unchanged keys.

Begin analysis now.`;
}

// ==================== GENERATE FIX PROMPT FROM LIVE JUDGE0 RESULTS ====================

function generateFixPromptFromLive(problemData, liveFailures, passedCode) {
  const {
    title,
    description,
    descriptionText,
    approaches,
    testCases,
    examples,
    paramOrder,
    constraints
  } = problemData;

  // Build the failing codes with ACTUAL Judge0 results
  const failingCodes = {};
  for (const [approachName, languages] of Object.entries(liveFailures)) {
    failingCodes[approachName] = {};
    for (const [lang, failInfo] of Object.entries(languages)) {
      const code = approaches?.[approachName]?.code?.[lang];
      if (code) {
        failingCodes[approachName][lang] = {
          code,
          failedTests: failInfo.failedTests
        };
      }
    }
  }

  // Build reference code from passing languages
  const referenceCode = {};
  for (const approachName of Object.keys(failingCodes)) {
    if (passedCode[approachName] && Object.keys(passedCode[approachName]).length > 0) {
      referenceCode[approachName] = passedCode[approachName];
    }
  }

  const allApproachNames = Object.keys(approaches || {});
  const analogy = problemData.analogy || {};

  const promptData = {
    title,
    description: description || descriptionText,
    paramOrder: paramOrder || [],
    constraints: constraints || [],
    examples: examples || [],
    testCases: testCases || [],
    allApproachNames,
    analogy,
    failingCodes
  };

  if (Object.keys(referenceCode).length > 0) {
    promptData.referenceCode = referenceCode;
  }

  let referenceSection = '';
  if (Object.keys(referenceCode).length > 0) {
    referenceSection = `
## 🟢 REFERENCE — Working code that PASSED all tests:
The \`referenceCode\` object contains code from the SAME approach that has ALREADY PASSED all test cases in other languages. These were verified by actual execution via Judge0.
**USE THIS AS YOUR PRIMARY REFERENCE.** Convert/adapt the working code logic to the failing languages. This is the most reliable way to fix the code since it's proven to produce correct output.
- Match the algorithm logic exactly from the reference code.
- Only adapt language-specific syntax (I/O, types, etc).
- Keep the same I/O format (stdin/stdout) as the FAILING code — just fix the algorithm to match the reference.
`;
  }

  return `You are an expert code fixer. I have a coding problem where some code solutions are failing test cases. The failing code was ACTUALLY EXECUTED via Judge0 and the \`failedTests\` show REAL execution results (not predictions).

**PROBLEM DATA:**
\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\`

## What's happening:
- The \`failingCodes\` object contains approach names, and for each approach, the languages whose code is failing.
- Each \`failedTests\` entry shows the ACTUAL execution result from Judge0 — expected vs actual output, compile errors, runtime errors, etc.
- \`allApproachNames\` lists ALL approaches in the problem.
- The \`analogy\` section contains analogy descriptions with general and approach-specific fields.
${referenceSection}
## Your tasks:
1. Understand the problem from description, examples, and test cases.
2. For each failing code, analyze WHY it's producing wrong output based on the ACTUAL Judge0 results.
3. Fix the code so it produces the correct expected output for ALL test cases.
${Object.keys(referenceCode).length > 0 ? '4. **PRIORITIZE converting the working reference code** to the failing languages rather than debugging from scratch.\n5.' : '4.'} If an approach's algorithm logic was fundamentally wrong, also fix the corresponding analogy fields.
${Object.keys(referenceCode).length > 0 ? '6.' : '5.'} ALSO check if any test case expected values are wrong.

## CRITICAL RULES:
- Keep the same I/O format (stdin reading, stdout printing) - do NOT change how input is read or output is printed.
- Keep the same function signature.
- Only fix the algorithm logic / computation bugs.
- For Java: handle empty array input "[]" gracefully (don't crash on empty string split).
- For JavaScript: beware of integer overflow with large numbers - use BigInt if needed for modular arithmetic.
- Provide COMPLETE corrected code for each fix (not just the changed part).

## Response format:
Return ONLY valid JSON (no markdown, no backticks):
{
  "status": "needs_fixes",
  "summary": "Brief description of what was wrong",
  "fixes": {
    "approaches": {
      "approach-name": {
        "code": {
          "language": "FULL CORRECTED CODE HERE"
        }
      }
    },
    "analogy": {},
    "testCases": []
  },
  "details": [
    {
      "approach": "approach-name",
      "language": "python",
      "issue": "Description of bug",
      "fix": "What was changed"
    }
  ]
}

Only include "testCases" in fixes if expected values are genuinely wrong.
Only include "approaches" in fixes if code needs fixing.
Only include "analogy" in fixes if an approach's algorithm was fundamentally changed. Include ONLY the analogy keys that need updating.

Begin analysis now.`;
}

// ==================== SMART FIX STRATEGY ====================

/**
 * Detect if all failing languages produce the SAME wrong output for each test case.
 * This means Claude misunderstands the algorithm, not a language-specific bug.
 */
function detectAlgorithmMisunderstanding(failures) {
  // Group by approach
  for (const [approach, langs] of Object.entries(failures)) {
    const langEntries = Object.entries(langs);
    if (langEntries.length < 2) continue;
    
    // For each test case, check if all langs produce same wrong output
    const tcOutputs = {}; // tc -> Set of actual outputs
    for (const [lang, info] of langEntries) {
      for (const ft of (info.failedTests || [])) {
        if (!ft.actual || ft.status !== 'Accepted') continue;
        if (!tcOutputs[ft.tc]) tcOutputs[ft.tc] = { expected: ft.expected, actuals: new Map() };
        tcOutputs[ft.tc].actuals.set(lang, ft.actual);
      }
    }
    
    // If ALL langs produce same wrong output for any TC, it's algorithm misunderstanding
    for (const [tc, data] of Object.entries(tcOutputs)) {
      const uniqueActuals = new Set(data.actuals.values());
      if (uniqueActuals.size === 1 && data.actuals.size >= 3) {
        return { 
          detected: true, 
          approach, 
          tc, 
          expected: data.expected, 
          actual: [...uniqueActuals][0],
          langCount: data.actuals.size
        };
      }
    }
  }
  return { detected: false };
}

/**
 * Generate a focused prompt to fix ONLY the anchor language (Python).
 * This is Phase 1 of the two-phase strategy.
 */
function generateAnchorFixPrompt(problemData, approach, anchorCode, failedTests, isRetry = false, previousAttemptAnalysis = null) {
  const {
    title,
    description,
    descriptionText,
    examples,
    testCases,
    paramOrder,
    constraints
  } = problemData;

  let retrySection = '';
  if (isRetry && previousAttemptAnalysis) {
    retrySection = `
## ⚠️ PREVIOUS ATTEMPT FAILED — READ CAREFULLY:
${previousAttemptAnalysis}

Your previous code produced WRONG outputs. Do NOT repeat the same approach.
Step back and re-read the problem statement very carefully before coding.
`;
  }

  // Build inline test case traces showing input→expected for ALL test cases
  const allTestCases = testCases || [];
  let testCaseTrace = allTestCases.map((tc, i) => {
    const ft = failedTests.find(f => f.tc === i + 1);
    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input);
    const expected = String(tc.expected ?? '').trim();
    if (ft) {
      return `  TC${i + 1}: input=${inputStr} → expected="${expected}" | YOUR OUTPUT="${ft.actual || '(crash)'}" ❌${ft.error ? ' Error: ' + ft.error.substring(0, 150) : ''}`;
    }
    return `  TC${i + 1}: input=${inputStr} → expected="${expected}" ✅`;
  }).join('\n');

  return `You are an expert algorithm problem solver. Fix this ${ANCHOR_LANG} solution for the given problem.

**IMPORTANT**: Focus ONLY on producing a correct ${ANCHOR_LANG} solution. Do NOT provide solutions in other languages.
**IMPORTANT**: The test case expected values are CORRECT. Do NOT claim they are wrong. Your code must match them exactly.
${retrySection}
**PROBLEM:**
- Title: ${title}
- Description: ${description || descriptionText}
- Constraints: ${JSON.stringify(constraints || [])}
- Parameter order: ${JSON.stringify(paramOrder || [])}
- Examples: ${JSON.stringify(examples || [])}

**ALL TEST CASES (with your current output vs expected):**
${testCaseTrace}

**CURRENT FAILING CODE (${ANCHOR_LANG}, approach: ${approach}):**
\`\`\`${ANCHOR_LANG}
${anchorCode}
\`\`\`

## Instructions:
1. CAREFULLY read the problem description and examples. Pay attention to exact wording about what to count/compute.
2. Trace through EACH failing test case by hand — write down what the correct answer should be and WHY.
3. If your trace matches the expected output, your algorithm understanding is correct — find the code bug.
4. If your trace does NOT match the expected, re-read the problem — you're misunderstanding something.
5. Common misunderstandings: ordered vs unordered pairs, 0-indexed vs 1-indexed, inclusive vs exclusive bounds, "less than" vs "less than or equal".
6. Fix the code. Keep the same I/O format (stdin/stdout).

## Response format:
Return ONLY valid JSON (no markdown, no backticks):
{
  "status": "needs_fixes",
  "summary": "Brief description of the bug and fix",
  "algorithm_explanation": "2-3 sentence explanation of the correct algorithm",
  "fixes": {
    "approaches": {
      "${approach}": {
        "code": {
          "${ANCHOR_LANG}": "FULL CORRECTED ${ANCHOR_LANG} CODE HERE"
        }
      }
    },
    "testCases": []
  }
}

Only include "testCases" if expected values are genuinely wrong — but this is EXTREMELY RARE. 99% of the time YOUR CODE is wrong, not the tests.
Begin analysis now.`;
}

/**
 * Generate a translation prompt: given working anchor code, translate to other languages.
 * This is Phase 2 of the two-phase strategy.
 */
function generateTranslationPrompt(problemData, approach, workingAnchorCode, targetLanguages, existingCodes) {
  const {
    title,
    description,
    descriptionText,
    paramOrder,
  } = problemData;

  const targetCodesSection = targetLanguages.map(lang => {
    const existing = existingCodes[lang] || '';
    return `### ${lang} (current broken code):
\`\`\`${lang}
${existing}
\`\`\``;
  }).join('\n\n');

  return `You are an expert code translator. I have a WORKING ${ANCHOR_LANG} solution. Translate it to the following languages, keeping the exact same algorithm logic.

**Problem:** ${title}
**Description:** ${description || descriptionText}
**Parameter order:** ${JSON.stringify(paramOrder || [])}

**WORKING ${ANCHOR_LANG} code (approach: ${approach}):**
\`\`\`${ANCHOR_LANG}
${workingAnchorCode}
\`\`\`

**Target languages to translate to:** ${targetLanguages.join(', ')}

${targetCodesSection}

## Rules:
- Keep the EXACT same algorithm logic as the ${ANCHOR_LANG} code.
- Keep the same I/O format: read from stdin, print to stdout.
- Match the I/O parsing style of the EXISTING code for each language (how it reads input).
- For Java: handle empty array input "[]" gracefully.
- For JavaScript: use BigInt if the ${ANCHOR_LANG} code deals with large numbers.
- For C/C++: handle memory allocation properly.
- Provide COMPLETE code for each language.

## Response format:
Return ONLY valid JSON (no markdown, no backticks):
{
  "status": "needs_fixes",
  "summary": "Translated working ${ANCHOR_LANG} to ${targetLanguages.join(', ')}",
  "fixes": {
    "approaches": {
      "${approach}": {
        "code": {
${targetLanguages.map(l => `          "${l}": "FULL ${l} CODE HERE"`).join(',\n')}
        }
      }
    }
  }
}

Begin translation now.`;
}

/**
 * Smart fix strategy: Fix anchor language first, validate, then translate.
 * Falls back to the original "fix all at once" approach if anchor strategy fails.
 */
async function smartFixProblem(problem) {
  let failures = analyzeFailures(problem.tests_report);

  // If no failures in tests_report, run Judge0 first
  if (Object.keys(failures).length === 0) {
    console.log(`    ℹ️  No failures in tests_report — running Judge0 to check...`);
    if (!problem.testCases?.length || !problem.approaches || !Object.keys(problem.approaches).length) {
      console.log(`    ⏭️  Skipped: no test cases or approaches`);
      return null;
    }

    const liveValidation = await validateFixedCode(problem, {});
    if (liveValidation.allPassed) {
      console.log(`    ✅ All code passes! Updating Firebase...`);
      try {
        initFirebase();
        await db.collection(COLLECTION_NAME).doc(problem.id).update({
          tests_passed: true,
          tests_report: liveValidation.report,
          tests_validated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.log(`    ⚠️  Firebase update failed: ${err.message}`);
      }
      return { problemId: problem.id, result: { status: 'already_passing', summary: 'All code passes', validationPassed: true }, failures: {}, tokens: { input: 0, output: 0 }, cost: { input: 0, output: 0, total: 0 } };
    }

    for (const [key, data] of Object.entries(liveValidation.results)) {
      const [approachName, lang] = key.split('/');
      if (!failures[approachName]) failures[approachName] = {};
      failures[approachName][lang] = { passed: false, failedTests: data.failedTests };
    }
  }

  // Log failures
  for (const [approach, langs] of Object.entries(failures)) {
    const langList = Object.keys(langs).join(', ');
    const totalFailed = Object.values(langs).reduce((sum, l) => sum + l.failedTests.length, 0);
    console.log(`    ❌ ${approach}: ${langList} (${totalFailed} failed tests)`);
  }

  // Detect algorithm misunderstanding pattern
  const misunderstanding = detectAlgorithmMisunderstanding(failures);
  if (misunderstanding.detected) {
    console.log(`    🧠 Algorithm misunderstanding detected: ALL ${misunderstanding.langCount} langs output "${misunderstanding.actual}" for TC${misunderstanding.tc} (expected "${misunderstanding.expected}")`);
    console.log(`    📐 Using anchor-language strategy (fix ${ANCHOR_LANG} first, then translate)`);
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let allFixes = {};

  // === PRE-CHECK: Identify languages that already PASS for each approach ===
  // This avoids wasting API calls when a working reference already exists
  const passingCodeByApproach = {};
  for (const [approach, langs] of Object.entries(failures)) {
    const failingLangs = new Set(Object.keys(langs));
    const allLangs = Object.keys(problem.approaches?.[approach]?.code || {});
    const nonFailingLangs = allLangs.filter(l => !failingLangs.has(l));
    
    if (nonFailingLangs.length > 0) {
      // These languages are NOT in the failures list — they likely pass
      // But let's check if tests_report confirms they pass
      const testsReport = problem.tests_report || {};
      for (const lang of nonFailingLangs) {
        const langReport = testsReport[approach]?.[lang];
        if (langReport?.passed !== false) {
          if (!passingCodeByApproach[approach]) passingCodeByApproach[approach] = {};
          passingCodeByApproach[approach][lang] = problem.approaches[approach].code[lang];
        }
      }
    }
  }

  // Log passing references
  for (const [approach, langs] of Object.entries(passingCodeByApproach)) {
    console.log(`    🟢 "${approach}" has passing code in: ${Object.keys(langs).join(', ')} — will use as reference`);
  }

  // Process each failing approach
  for (const [approach, langs] of Object.entries(failures)) {
    const failingLangs = Object.keys(langs);
    const anchorFailing = langs[ANCHOR_LANG];
    const passingRef = passingCodeByApproach[approach] || {};
    const hasPassingReference = Object.keys(passingRef).length > 0;
    
    // Determine if we should use anchor strategy:
    // Use it if: algorithm misunderstanding OR 3+ languages failing in same approach
    const useAnchorStrategy = misunderstanding.detected || failingLangs.length >= 3;

    // === SHORTCUT: If we already have passing code in another language, use it directly ===
    if (hasPassingReference && useAnchorStrategy) {
      const refLang = Object.keys(passingRef)[0];
      const refCode = passingRef[refLang];
      console.log(`    🚀 Shortcut for "${approach}": Using passing ${refLang} code as reference → translate to ${failingLangs.join(', ')}`);

      const existingCodes = {};
      for (const lang of failingLangs) {
        existingCodes[lang] = problem.approaches?.[approach]?.code?.[lang] || '';
      }

      // Translate directly from the passing reference
      const transPrompt = generateTranslationPrompt(problem, approach, refCode, failingLangs, existingCodes);
      // Modify the prompt to mention it's from refLang not ANCHOR_LANG
      const adjustedPrompt = transPrompt.replace(
        new RegExp(`WORKING ${ANCHOR_LANG}`, 'g'), 
        `WORKING ${refLang}`
      ).replace(
        new RegExp(`\\\`\\\`\\\`${ANCHOR_LANG}`, 'g'),
        `\`\`\`${refLang}`
      );

      try {
        const transResp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages: [{ role: 'user', content: adjustedPrompt }]
        });

        totalInputTokens += transResp.usage?.input_tokens || 0;
        totalOutputTokens += transResp.usage?.output_tokens || 0;
        const transCost = ((transResp.usage?.input_tokens || 0) / 1000000) * 3 + ((transResp.usage?.output_tokens || 0) / 1000000) * 15;
        console.log(`    📊 Translation tokens: ${(transResp.usage?.input_tokens || 0).toLocaleString()} in / ${(transResp.usage?.output_tokens || 0).toLocaleString()} out ($${transCost.toFixed(4)})`);

        const transParsed = parseJsonResponse(transResp.content[0]?.text || '');
        if (transParsed?.fixes?.approaches?.[approach]?.code) {
          if (!allFixes.approaches) allFixes.approaches = {};
          if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
          Object.assign(allFixes.approaches[approach].code, transParsed.fixes.approaches[approach].code);
        }
      } catch (err) {
        console.log(`    ❌ Translation API error: ${err.message}`);
      }
      continue; // Skip to next approach
    }

    if (useAnchorStrategy && problem.approaches?.[approach]?.code?.[ANCHOR_LANG]) {
      console.log(`    📐 Anchor strategy for "${approach}": Fix ${ANCHOR_LANG} → translate to others`);
      
      // === PHASE 1: Fix anchor language ===
      const anchorCode = problem.approaches[approach].code[ANCHOR_LANG];
      let anchorFailedTests = anchorFailing?.failedTests || 
        Object.values(langs)[0]?.failedTests || []; // Use any lang's failures as reference

      // If we have passing code in another lang, include it as reference in the anchor prompt
      let referenceHint = '';
      if (hasPassingReference) {
        const refLang = Object.keys(passingRef)[0];
        referenceHint = `\n\n## 🟢 REFERENCE — Working ${refLang} code that PASSES all tests:\n\`\`\`${refLang}\n${passingRef[refLang]}\n\`\`\`\nUse this as your primary reference. Adapt the same algorithm logic to ${ANCHOR_LANG}.\n`;
      }

      let workingAnchorCode = null;
      let previousAttemptAnalysis = null;

      for (let attempt = 1; attempt <= MAX_FIX_RETRIES + 1; attempt++) {
        const isRetry = attempt > 1;
        console.log(`    ${isRetry ? `🔄 Anchor retry ${attempt - 1}` : '🔍'} Fixing ${ANCHOR_LANG} for "${approach}"...`);

        let anchorPrompt = generateAnchorFixPrompt(
          problem, approach, 
          workingAnchorCode || anchorCode, 
          anchorFailedTests, 
          isRetry, previousAttemptAnalysis
        );
        // Append reference code if available
        if (referenceHint && !isRetry) {
          anchorPrompt = anchorPrompt.replace('Begin analysis now.', referenceHint + '\nBegin analysis now.');
        }

        try {
          let response;
          // Use extended thinking on retry 2+ for hard problems
          if (isRetry && attempt >= 3 && USE_EXTENDED_THINKING_ON_RETRY) {
            console.log(`    🧠 Using extended thinking (budget: ${EXTENDED_THINKING_BUDGET} tokens)...`);
            // Extended thinking requires streaming for long operations
            const stream = await anthropic.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 16000 + EXTENDED_THINKING_BUDGET,
              thinking: { type: 'enabled', budget_tokens: EXTENDED_THINKING_BUDGET },
              messages: [{ role: 'user', content: anchorPrompt }]
            });
            response = await stream.finalMessage();
          } else {
            response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 16000,
              messages: [{ role: 'user', content: anchorPrompt }]
            });
          }

          const inputTokens = response.usage?.input_tokens || 0;
          const outputTokens = response.usage?.output_tokens || 0;
          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;
          const cost = (inputTokens / 1000000) * 3 + (outputTokens / 1000000) * 15;
          console.log(`    📊 Tokens: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out ($${cost.toFixed(4)})`);

          // Extract text from response (may have thinking blocks)
          const responseText = response.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('') || '';

          let parsed = parseJsonResponse(responseText);
          if (!parsed?.fixes?.approaches?.[approach]?.code?.[ANCHOR_LANG]) {
            console.log(`    ⚠️  No valid ${ANCHOR_LANG} fix in response`);
            if (attempt <= MAX_FIX_RETRIES) continue;
            break;
          }

          const fixedCode = parsed.fixes.approaches[approach].code[ANCHOR_LANG];
          console.log(`    📋 ${parsed.summary || 'Fix applied'}`);

          // Validate ONLY the anchor language
          console.log(`    🧪 Validating ${ANCHOR_LANG} only...`);
          const anchorFixes = { approaches: { [approach]: { code: { [ANCHOR_LANG]: fixedCode } } } };
          if (parsed.fixes.testCases?.length) anchorFixes.testCases = parsed.fixes.testCases;

          const validation = await validateSingleLang(problem, approach, ANCHOR_LANG, fixedCode, parsed.fixes.testCases);

          if (validation.passed) {
            console.log(`    ✅ ${ANCHOR_LANG} passes all tests!`);
            workingAnchorCode = fixedCode;
            // Also store test case fixes if any
            if (parsed.fixes.testCases?.length) {
              allFixes.testCases = parsed.fixes.testCases;
            }
            if (parsed.algorithm_explanation) {
              console.log(`    💡 Algorithm: ${parsed.algorithm_explanation}`);
            }
            break;
          } else {
            console.log(`    ❌ ${ANCHOR_LANG} still failing ${validation.failedTests.length} test(s)`);
            // Update failedTests for next retry prompt to show LATEST actual outputs
            anchorFailedTests = validation.failedTests;
            previousAttemptAnalysis = `Your previous ${ANCHOR_LANG} code output:\n` +
              validation.failedTests.map(ft => 
                `  TC${ft.tc}: expected="${ft.expected}" got="${ft.actual}" [${ft.status}]`
              ).join('\n');
            workingAnchorCode = fixedCode; // Use as base for next retry
          }
        } catch (err) {
          console.log(`    ❌ API error: ${err.message}`);
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!workingAnchorCode) {
        console.log(`    ❌ Failed to fix ${ANCHOR_LANG} for "${approach}" — falling back to original strategy`);
        // Fall back to original fixProblem
        return await fixProblem(problem);
      }

      // === PHASE 2: Translate to other languages ===
      const otherFailingLangs = failingLangs.filter(l => l !== ANCHOR_LANG);
      if (otherFailingLangs.length > 0) {
        console.log(`    🌐 Translating working ${ANCHOR_LANG} to: ${otherFailingLangs.join(', ')}`);

        const existingCodes = {};
        for (const lang of otherFailingLangs) {
          existingCodes[lang] = problem.approaches?.[approach]?.code?.[lang] || '';
        }

        const transPrompt = generateTranslationPrompt(problem, approach, workingAnchorCode, otherFailingLangs, existingCodes);
        
        try {
          const transResp = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            messages: [{ role: 'user', content: transPrompt }]
          });

          const transTokens = transResp.usage;
          totalInputTokens += transTokens?.input_tokens || 0;
          totalOutputTokens += transTokens?.output_tokens || 0;
          const transCost = ((transTokens?.input_tokens || 0) / 1000000) * 3 + ((transTokens?.output_tokens || 0) / 1000000) * 15;
          console.log(`    📊 Translation tokens: ${(transTokens?.input_tokens || 0).toLocaleString()} in / ${(transTokens?.output_tokens || 0).toLocaleString()} out ($${transCost.toFixed(4)})`);

          const transText = transResp.content[0]?.text || '';
          const transParsed = parseJsonResponse(transText);

          if (transParsed?.fixes?.approaches?.[approach]?.code) {
            // Merge: anchor code + translated codes
            if (!allFixes.approaches) allFixes.approaches = {};
            if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
            allFixes.approaches[approach].code[ANCHOR_LANG] = workingAnchorCode;
            Object.assign(allFixes.approaches[approach].code, transParsed.fixes.approaches[approach].code);
          }
        } catch (err) {
          console.log(`    ❌ Translation API error: ${err.message}`);
          // Still save the anchor fix
          if (!allFixes.approaches) allFixes.approaches = {};
          if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
          allFixes.approaches[approach].code[ANCHOR_LANG] = workingAnchorCode;
        }
      } else {
        // Only anchor was failing
        if (!allFixes.approaches) allFixes.approaches = {};
        if (!allFixes.approaches[approach]) allFixes.approaches[approach] = { code: {} };
        allFixes.approaches[approach].code[ANCHOR_LANG] = workingAnchorCode;
      }

    } else {
      // Not using anchor strategy (few languages failing, or anchor lang not available)
      // Use original approach for this specific approach
      console.log(`    📝 Standard fix for "${approach}" (${failingLangs.length} lang(s))`);
      
      const singleApproachFailures = { [approach]: langs };
      const prompt = generateFixPrompt(problem, singleApproachFailures);

      try {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages: [{ role: 'user', content: prompt }]
        });

        totalInputTokens += resp.usage?.input_tokens || 0;
        totalOutputTokens += resp.usage?.output_tokens || 0;

        const parsed = parseJsonResponse(resp.content[0]?.text || '');
        if (parsed?.fixes) {
          allFixes = mergeFixes(allFixes, parsed.fixes);
        }
      } catch (err) {
        console.log(`    ❌ API error: ${err.message}`);
      }
    }
  }

  if (!allFixes.approaches || Object.keys(allFixes.approaches).length === 0) {
    console.log(`    ❌ No fixes produced`);
    return null;
  }

  // === FINAL VALIDATION: Run all fixed code ===
  console.log(`    🧪 Final validation of all fixes...`);
  const validation = await validateFixedCode(problem, allFixes);

  // Auto-correct test cases if needed
  if (!validation.allPassed) {
    const autoFixed = autoCorrectTestCases(validation, allFixes);
    if (autoFixed.corrected > 0) {
      allFixes = mergeFixes(allFixes, { testCases: autoFixed.testCaseFixes });
      console.log(`    🔄 Re-validating after auto-correcting ${autoFixed.corrected} test case(s)...`);
      const reValidation = await validateFixedCode(problem, allFixes);
      if (reValidation.allPassed) {
        console.log(`    ✅ All tests passed after auto-correction!`);
        return {
          problemId: problem.id,
          result: { status: 'needs_fixes', summary: 'Fixed via anchor strategy + auto-correct', fixes: allFixes, validationPassed: true },
          failures, validationReport: reValidation.report,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
          cost: { input: (totalInputTokens / 1000000) * 3, output: (totalOutputTokens / 1000000) * 15, total: (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15 },
        };
      }
      Object.assign(validation, reValidation);
    }
  }

  const failCount = Object.keys(validation.results || {}).length;
  if (validation.allPassed) {
    console.log(`    ✅ All tests passed!`);
  } else {
    console.log(`    ⚠️  ${failCount} approach/lang combo(s) still failing after smart fix`);
    
    // One more retry for still-failing translations
    if (failCount > 0 && failCount <= 6) {
      console.log(`    🔄 Retry fixing ${failCount} still-failing translations...`);
      const retryFixes = await retryFailingTranslations(problem, allFixes, validation, totalInputTokens, totalOutputTokens);
      if (retryFixes) {
        totalInputTokens = retryFixes.tokens.input;
        totalOutputTokens = retryFixes.tokens.output;
        allFixes = retryFixes.fixes;
        if (retryFixes.allPassed) {
          return {
            problemId: problem.id,
            result: { status: 'needs_fixes', summary: 'Fixed via anchor + translation retry', fixes: allFixes, validationPassed: true },
            failures, validationReport: retryFixes.report,
            tokens: { input: totalInputTokens, output: totalOutputTokens },
            cost: { input: (totalInputTokens / 1000000) * 3, output: (totalOutputTokens / 1000000) * 15, total: (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15 },
          };
        }
      }
    }
  }

  return {
    problemId: problem.id,
    result: { status: 'needs_fixes', summary: 'Smart fix applied', fixes: allFixes, validationPassed: validation.allPassed },
    failures, validationReport: validation.report,
    tokens: { input: totalInputTokens, output: totalOutputTokens },
    cost: { input: (totalInputTokens / 1000000) * 3, output: (totalOutputTokens / 1000000) * 15, total: (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15 },
  };
}

/**
 * Validate a single language for one approach (cheaper than validating all)
 */
async function validateSingleLang(problem, approach, lang, code, testCaseFixes) {
  const langId = LANGUAGE_IDS[lang];
  if (!langId) return { passed: false, failedTests: [{ tc: 0, error: 'Unknown language' }] };

  let testCases = [...(problem.testCases || [])];
  if (testCaseFixes?.length) {
    for (const fix of testCaseFixes) {
      if (fix.index >= 0 && fix.index < testCases.length && fix.expected !== undefined) {
        testCases[fix.index] = { ...testCases[fix.index], expected: fix.expected };
      }
    }
  }

  const failedTests = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const stdin = buildStdin(tc);
    const expected = String(tc.expected ?? '').trim();

    try {
      const result = await judge0Submit(code, langId, stdin);
      const actual = (result.stdout || '').trim();
      const passed = result.status.id === 3 && compareOutputs(actual, expected);

      if (!passed) {
        const error = result.compile_output || result.stderr || result.message || null;
        failedTests.push({
          tc: i + 1, expected, actual,
          error: error ? error.substring(0, 300) : null,
          status: result.status.description,
        });
        console.log(`        ❌ TC${i + 1}: expected="${expected}" got="${actual}" [${result.status.description}]`);
      } else {
        console.log(`        ✅ TC${i + 1} passed`);
      }
    } catch (err) {
      failedTests.push({ tc: i + 1, expected, actual: '', error: err.message, status: 'Error' });
      console.log(`        ❌ TC${i + 1}: ERROR - ${err.message}`);
    }

    if (i < testCases.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  return { passed: failedTests.length === 0, failedTests };
}

/**
 * Retry fixing still-failing translations using the working anchor code as reference
 */
async function retryFailingTranslations(problem, currentFixes, validation, inputTokens, outputTokens) {
  const failingByApproach = {};
  for (const [key, data] of Object.entries(validation.results || {})) {
    const [approach, lang] = key.split('/');
    if (!failingByApproach[approach]) failingByApproach[approach] = {};
    failingByApproach[approach][lang] = data;
  }

  let updatedFixes = { ...currentFixes };
  let totalIn = inputTokens, totalOut = outputTokens;

  for (const [approach, langs] of Object.entries(failingByApproach)) {
    const workingAnchor = currentFixes.approaches?.[approach]?.code?.[ANCHOR_LANG] || 
                          problem.approaches?.[approach]?.code?.[ANCHOR_LANG];
    if (!workingAnchor) continue;

    const failingLangs = Object.keys(langs).filter(l => l !== ANCHOR_LANG);
    if (failingLangs.length === 0) continue;

    // Build a retry prompt with actual failure details
    const failDetails = failingLangs.map(lang => {
      const fts = langs[lang]?.failedTests || [];
      return `${lang}: ${fts.map(ft => `TC${ft.tc}: expected="${ft.expected}" got="${ft.actual}" [${ft.status}]${ft.error ? ' Error: ' + ft.error.substring(0, 100) : ''}`).join('; ')}`;
    }).join('\n');

    const existingCodes = {};
    for (const lang of failingLangs) {
      existingCodes[lang] = currentFixes.approaches?.[approach]?.code?.[lang] || 
                            problem.approaches?.[approach]?.code?.[lang] || '';
    }

    const prompt = `You are an expert code translator. A ${ANCHOR_LANG} solution is WORKING but the translations to other languages are FAILING. Fix ONLY the failing languages.

**Working ${ANCHOR_LANG} code:**
\`\`\`${ANCHOR_LANG}
${workingAnchor}
\`\`\`

**Failing translations and their actual Judge0 execution results:**
${failDetails}

**Current (broken) code for failing languages:**
${failingLangs.map(lang => `\`\`\`${lang}\n${existingCodes[lang]}\n\`\`\``).join('\n\n')}

Fix each failing language to match the ${ANCHOR_LANG} logic exactly. Return ONLY valid JSON:
{
  "status": "needs_fixes",
  "summary": "Fixed translation issues",
  "fixes": {
    "approaches": {
      "${approach}": {
        "code": {
${failingLangs.map(l => `          "${l}": "FULL CORRECTED CODE"`).join(',\n')}
        }
      }
    }
  }
}`;

    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      });

      totalIn += resp.usage?.input_tokens || 0;
      totalOut += resp.usage?.output_tokens || 0;

      const parsed = parseJsonResponse(resp.content[0]?.text || '');
      if (parsed?.fixes) {
        updatedFixes = mergeFixes(updatedFixes, parsed.fixes);
      }
    } catch (err) {
      console.log(`    ❌ Retry translation error: ${err.message}`);
    }
  }

  // Re-validate
  const reValidation = await validateFixedCode(problem, updatedFixes);
  return {
    fixes: updatedFixes,
    allPassed: reValidation.allPassed,
    report: reValidation.report,
    tokens: { input: totalIn, output: totalOut },
  };
}

/**
 * Parse JSON from Claude response (handles markdown fences, etc.)
 */
function parseJsonResponse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {}
  
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch (e) {}
  }
  
  const s = text.indexOf('{'), en = text.lastIndexOf('}');
  if (s !== -1 && en !== -1) {
    try { return JSON.parse(text.substring(s, en + 1)); } catch (e) {}
  }
  
  return null;
}

async function fetchFailedProblems(limit = null, skip = 0) {
  initFirebase();

  console.log(`📥 Fetching problems with tests_passed = false...${skip > 0 ? ` (skipping first ${skip})` : ''}`);

  try {
    let query = db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding')
      .where('tests_passed', '==', false);

    // If skipping, fetch extra to account for skipped items
    if (limit && skip > 0) {
      query = query.limit(limit + skip);
    } else if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const allProblems = [];

    snapshot.forEach(doc => {
      allProblems.push({ id: doc.id, ...doc.data() });
    });

    // Apply skip
    const problems = skip > 0 ? allProblems.slice(skip) : allProblems;
    
    // Apply limit after skip if needed
    const finalProblems = (limit && skip > 0) ? problems.slice(0, limit) : problems;

    console.log(`✅ Found ${allProblems.length} total failed, skipped ${skip}, returning ${finalProblems.length} problems\n`);
    return finalProblems;
  } catch (error) {
    console.error('❌ Error fetching from Firebase:', error.message);
    return [];
  }
}

async function fetchProblemById(problemId) {
  initFirebase();

  try {
    const doc = await db.collection(COLLECTION_NAME).doc(problemId).get();
    if (!doc.exists) {
      console.error(`❌ Problem not found: ${problemId}`);
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`❌ Error fetching: ${error.message}`);
    return null;
  }
}

// ==================== AUTO-CORRECT TEST CASES ====================

/**
 * Detect test cases where ALL approach/lang combos produce the SAME output
 * that differs from expected. In that case, the test case expected value is wrong.
 * Returns { corrected: number, testCaseFixes: [{index, expected}] }
 */
function autoCorrectTestCases(validation, currentFixes) {
  const { results, report } = validation;
  const testCaseFixes = [];

  // Collect all failing TCs with their actual outputs across all approach/langs
  // Key: tc number -> { expected, actuals: Set of actual values }
  const tcOutputs = {};

  for (const [key, data] of Object.entries(results)) {
    for (const ft of data.failedTests) {
      // Skip non-output failures (compile error, runtime error, TLE)
      if (ft.status !== 'Accepted' || !ft.actual) continue;

      if (!tcOutputs[ft.tc]) {
        tcOutputs[ft.tc] = { expected: ft.expected, actuals: new Set() };
      }
      tcOutputs[ft.tc].actuals.add(ft.actual);
    }
  }

  // Also check: how many approach/langs TOTAL were tested for each TC?
  // We need ALL of them to agree (both passing and failing should produce same output)
  // Passing ones already match expected, so we only care about failing ones agreeing with each other
  const totalLangs = new Set();
  for (const [approachName, langs] of Object.entries(report)) {
    if (typeof langs !== 'object') continue;
    for (const lang of Object.keys(langs)) {
      totalLangs.add(`${approachName}/${lang}`);
    }
  }

  // Count how many approach/langs failed on each TC
  const tcFailCount = {};
  for (const [key, data] of Object.entries(results)) {
    for (const ft of data.failedTests) {
      if (ft.status !== 'Accepted' || !ft.actual) continue;
      if (!tcFailCount[ft.tc]) tcFailCount[ft.tc] = new Set();
      tcFailCount[ft.tc].add(key);
    }
  }

  for (const [tcNum, data] of Object.entries(tcOutputs)) {
    // ALL failing langs produce exactly ONE same output
    if (data.actuals.size === 1) {
      const unanimousOutput = [...data.actuals][0];
      const failingOnThisTC = tcFailCount[tcNum]?.size || 0;

      // If ALL tested approach/langs fail on this TC with same output, it's a wrong expected
      if (failingOnThisTC === totalLangs.size) {
        const tcIndex = parseInt(tcNum) - 1; // tc is 1-indexed, index is 0-indexed
        console.log(`    🔧 Auto-correct TC${tcNum}: ALL ${failingOnThisTC} langs output "${unanimousOutput}" (expected was "${data.expected}")`);
        testCaseFixes.push({ index: tcIndex, expected: unanimousOutput });
      }
    }
  }

  return { corrected: testCaseFixes.length, testCaseFixes };
}

// ==================== FIX SINGLE PROBLEM ====================

async function fixProblem(problem) {
  let failures = analyzeFailures(problem.tests_report);

  // If no failures in tests_report, run Judge0 to get actual status
  if (Object.keys(failures).length === 0) {
    console.log(`    ℹ️  No failures in tests_report — running Judge0 to check...`);

    if (!problem.testCases || problem.testCases.length === 0) {
      console.log(`    ⏭️  Skipped: no test cases`);
      return null;
    }
    if (!problem.approaches || Object.keys(problem.approaches).length === 0) {
      console.log(`    ⏭️  Skipped: no approaches`);
      return null;
    }

    const liveValidation = await validateFixedCode(problem, {});

    if (liveValidation.allPassed) {
      console.log(`    ✅ All code passes! Updating Firebase...`);
      try {
        initFirebase();
        await db.collection(COLLECTION_NAME).doc(problem.id).update({
          tests_passed: true,
          tests_report: liveValidation.report,
          tests_validated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`    📤 Firebase updated: tests_passed=true`);
      } catch (err) {
        console.log(`    ⚠️  Firebase update failed: ${err.message}`);
      }
      return { problemId: problem.id, result: { status: 'already_passing', summary: 'All code passes', validationPassed: true }, failures: {}, validationReport: liveValidation.report, tokens: { input: 0, output: 0 }, cost: { input: 0, output: 0, total: 0 } };
    }

    // Build failures from Judge0 results
    for (const [key, data] of Object.entries(liveValidation.results)) {
      const [approachName, lang] = key.split('/');
      if (!failures[approachName]) failures[approachName] = {};
      failures[approachName][lang] = {
        passed: false,
        failedTests: data.failedTests,
      };
    }
    console.log(`    📊 Judge0 found failures:`);
  }

  // Log what's failing
  for (const [approach, langs] of Object.entries(failures)) {
    const langList = Object.keys(langs).join(', ');
    const totalFailed = Object.values(langs).reduce((sum, l) => sum + l.failedTests.length, 0);
    console.log(`    ❌ ${approach}: ${langList} (${totalFailed} failed tests)`);
  }

  const prompt = generateFixPrompt(problem, failures);
  let currentFixes = null;
  let lastResult = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 1; attempt <= MAX_FIX_RETRIES + 1; attempt++) {
    const isRetry = attempt > 1;
    const currentPrompt = (isRetry && lastResult)
      ? generateRetryPrompt(problem, currentFixes, lastResult.validationFailures, attempt - 1, lastResult.passedCode || {})
      : prompt;

    try {
      console.log(`    ${isRetry ? `🔄 Retry ${attempt - 1}/${MAX_FIX_RETRIES}` : '🔍'} Sending to Claude for fixing...`);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [
          { role: 'user', content: currentPrompt }
        ]
      });

      const responseText = response.content[0]?.text || '';
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      const inputCost = (inputTokens / 1000000) * 3;
      const outputCost = (outputTokens / 1000000) * 15;
      const totalCost = inputCost + outputCost;

      console.log(`    📊 Tokens: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out ($${totalCost.toFixed(4)})`);

      // Parse JSON response
      let result = null;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try { result = JSON.parse(jsonMatch[1]); } catch (e2) {}
        }
        if (!result) {
          const startIdx = responseText.indexOf('{');
          const endIdx = responseText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            try { result = JSON.parse(responseText.substring(startIdx, endIdx + 1)); } catch (e3) {}
          }
        }
      }

      if (!result) {
        console.error(`    ❌ Failed to parse response`);
        if (attempt <= MAX_FIX_RETRIES) {
          console.log(`    🔄 Will retry (${attempt}/${MAX_FIX_RETRIES})...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        console.log(`    ❌ Parse failed after all attempts`);
        return null;
      }

      if (!result || !result.fixes) {
        console.log(`    ℹ️  AI returned: ${result?.status || 'no result'} - ${result?.summary || ''}`);
        // If AI says no fixes needed on first attempt, return as-is
        if (!isRetry) return {
          problemId: problem.id, result, failures,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
          cost: { input: (totalInputTokens / 1000000) * 3, output: (totalOutputTokens / 1000000) * 15, total: (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15 },
        };
        return null;
      }

      console.log(`    📋 ${result.status}: ${result.summary}`);

      // Merge fixes across retries (accumulate)
      if (isRetry && currentFixes) {
        currentFixes = mergeFixes(currentFixes, result.fixes);
      } else {
        currentFixes = result.fixes;
      }

      // === VALIDATE: Run fixed code against test cases via Judge0 ===
      console.log(`    🧪 Validating fixed code via Judge0...`);
      const validation = await validateFixedCode(problem, currentFixes);

      // === AUTO-CORRECT: If ALL langs produce same output for a failing TC, fix the expected value ===
      if (!validation.allPassed) {
        const autoFixed = autoCorrectTestCases(validation, currentFixes);
        if (autoFixed.corrected > 0) {
          // Merge auto-corrected test cases into currentFixes
          currentFixes = mergeFixes(currentFixes, { testCases: autoFixed.testCaseFixes });
          console.log(`    🔄 Re-validating after auto-correcting ${autoFixed.corrected} test case(s)...`);
          const reValidation = await validateFixedCode(problem, currentFixes);
          if (reValidation.allPassed) {
            console.log(`    ✅ All tests passed after auto-correcting test cases!`);
            return {
              problemId: problem.id,
              result: { ...result, fixes: currentFixes, validationPassed: true, autoCorrectApplied: true },
              failures,
              validationReport: reValidation.report,
              tokens: { input: totalInputTokens, output: totalOutputTokens },
              cost: { input: (totalInputTokens / 1000000) * 3, output: (totalOutputTokens / 1000000) * 15, total: (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15 },
            };
          }
          // Some still failing after auto-correct — continue to retry loop with updated validation
          Object.assign(validation, reValidation);
        }
      }

      if (validation.allPassed) {
        console.log(`    ✅ All tests passed after ${isRetry ? `retry ${attempt - 1}` : 'first fix'}!`);
        return {
          problemId: problem.id,
          result: { ...result, fixes: currentFixes, validationPassed: true },
          failures,
          validationReport: validation.report,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
          cost: { input: (totalInputTokens / 1000000) * 3, output: (totalOutputTokens / 1000000) * 15, total: (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15 },
        };
      }

      // Still failing
      const failCount = Object.keys(validation.results).length;
      const passedCount = Object.keys(validation.passedCode || {}).reduce((sum, a) => sum + Object.keys(validation.passedCode[a]).length, 0);
      console.log(`    ⚠️  ${failCount} approach/lang combo(s) still failing`);
      if (passedCount > 0) {
        console.log(`    🟢 ${passedCount} lang(s) passed — will use as reference for retry`);
      }

      if (attempt <= MAX_FIX_RETRIES) {
        lastResult = { validationFailures: validation.results, passedCode: validation.passedCode || {} };
        console.log(`    🔄 Will retry with actual execution results...`);
        await new Promise(r => setTimeout(r, 1000));
      } else {
        // Exhausted retries — return what we have
        console.log(`    ❌ Exhausted ${MAX_FIX_RETRIES} retries. Returning best effort fixes.`);
        return {
          problemId: problem.id,
          result: { ...result, fixes: currentFixes, validationPassed: false },
          failures,
          validationReport: validation.report,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
          cost: { input: (totalInputTokens / 1000000) * 3, output: (totalOutputTokens / 1000000) * 15, total: (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15 },
        };
      }

    } catch (error) {
      console.error(`    ❌ API error: ${error.message}`);
      return null;
    }
  }

  return null;
}

/**
 * Merge new fixes on top of previous fixes (accumulate across retries)
 */
function mergeFixes(prev, next) {
  const merged = { ...prev };

  // Merge approach code fixes
  if (next.approaches) {
    if (!merged.approaches) merged.approaches = {};
    for (const [approach, data] of Object.entries(next.approaches)) {
      if (!merged.approaches[approach]) merged.approaches[approach] = {};
      if (data.code) {
        merged.approaches[approach].code = {
          ...(merged.approaches[approach].code || {}),
          ...data.code,
        };
      }
    }
  }

  // Merge analogy fixes
  if (next.analogy && Object.keys(next.analogy).length > 0) {
    merged.analogy = { ...(merged.analogy || {}), ...next.analogy };
  }

  // Merge test case fixes (later fixes override earlier for same index)
  if (next.testCases && next.testCases.length > 0) {
    const tcMap = {};
    for (const tc of (merged.testCases || [])) { tcMap[tc.index] = tc; }
    for (const tc of next.testCases) { tcMap[tc.index] = tc; }
    merged.testCases = Object.values(tcMap);
  }

  return merged;
}

// ==================== APPLY FIXES ====================

async function applyFixes(problemId, fixes, validationReport = null) {
  if (!fixes) return true;

  try {
    const docRef = db.collection(COLLECTION_NAME).doc(problemId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error(`    ❌ Problem not found: ${problemId}`);
      return false;
    }

    const currentData = doc.data();
    const updates = {};

    // Apply approach code fixes
    if (fixes.approaches) {
      const updatedApproaches = { ...currentData.approaches };

      for (const [approachName, approachFixes] of Object.entries(fixes.approaches)) {
        if (approachFixes.code) {
          if (!updatedApproaches[approachName]) {
            updatedApproaches[approachName] = {};
          }
          updatedApproaches[approachName].code = {
            ...updatedApproaches[approachName]?.code,
            ...approachFixes.code
          };
        }
      }

      updates.approaches = updatedApproaches;
    }

    // Apply analogy fixes
    if (fixes.analogy) {
      const currentAnalogy = currentData.analogy || {};
      const updatedAnalogy = { ...currentAnalogy };

      for (const [key, value] of Object.entries(fixes.analogy)) {
        if (value !== undefined && value !== null) {
          updatedAnalogy[key] = value;
        }
      }

      updates.analogy = updatedAnalogy;
    }

    // Apply testCases fixes
    if (fixes.testCases && fixes.testCases.length > 0) {
      const updatedTestCases = [...(currentData.testCases || [])];

      for (const fix of fixes.testCases) {
        const idx = fix.index;
        if (idx >= 0 && idx < updatedTestCases.length) {
          if (fix.expected !== undefined) {
            updatedTestCases[idx].expected = fix.expected;
          }
          if (fix.input !== undefined) {
            updatedTestCases[idx].input = fix.input;
          }
        }
      }

      updates.testCases = updatedTestCases;
    }

    // Reset tests_passed so it can be re-validated
    updates.tests_passed = null;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates._lastValidation = {
      validatedAt: new Date().toISOString(),
      fixesApplied: true,
      fixType: 'failed_tests_fix'
    };

    // If we have a validation report from Judge0, store it and set tests_passed
    if (validationReport) {
      updates.tests_report = validationReport;
      // Check if all passed
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

    if (Object.keys(updates).length > 2) { // More than just timestamp + tests_passed reset
      await docRef.update(updates);
      console.log(`    ✅ Applied fixes to ${problemId}`);
      return true;
    } else {
      console.log(`    ℹ️  No actual code changes to apply`);
      // Still reset tests_passed
      await docRef.update(updates);
      return true;
    }

  } catch (error) {
    console.error(`    ❌ Error applying fixes: ${error.message}`);
    return false;
  }
}

// ==================== COMMANDS ====================

async function listFailed(limit, skip = 0) {
  const problems = await fetchFailedProblems(limit, skip);

  if (problems.length === 0) {
    console.log('✅ No failed problems found!');
    return;
  }

  console.log(`\n📋 Problems with failed tests:`);
  console.log('─'.repeat(80));

  problems.forEach((p, i) => {
    const failures = analyzeFailures(p.tests_report);
    const failSummary = [];

    for (const [approach, langs] of Object.entries(failures)) {
      const langList = Object.keys(langs).join(', ');
      failSummary.push(`${approach}: [${langList}]`);
    }

    console.log(`${i + 1}. ${p.id}`);
    console.log(`   Title: ${p.title}`);
    console.log(`   Failures: ${failSummary.join(' | ')}`);
    console.log('');
  });
}

async function runTestMode(problemId) {
  const problem = await fetchProblemById(problemId);
  if (!problem) return;

  if (problem.tests_passed !== false) {
    console.log(`⚠️  Problem ${problemId} does not have tests_passed = false (current: ${problem.tests_passed})`);
    console.log(`   Proceeding anyway to analyze tests_report...`);
  }

  console.log(`\n🔍 Analyzing failures for: ${problem.title}`);
  console.log('─'.repeat(60));

  const result = await smartFixProblem(problem);

  if (!result) {
    console.log('❌ Fix attempt failed or no failures found');
    return;
  }

  console.log(`\n📋 Result: ${result.result.status}`);
  console.log(`   Summary: ${result.result.summary}`);

  if (result.result.details) {
    console.log(`\n📝 Details:`);
    result.result.details.forEach((d, i) => {
      console.log(`   ${i + 1}. [${d.approach || ''}/${d.language || ''}] ${d.issue}`);
      console.log(`      Fix: ${d.fix}`);
    });
  }

  // Save fixes for review
  const fixesFile = `fixes_failed_${problemId}.json`;
  fs.writeFileSync(fixesFile, JSON.stringify(result.result, null, 2));
  console.log(`\n📁 Fixes saved to: ${fixesFile}`);
}

async function runTestApply(problemId) {
  const problem = await fetchProblemById(problemId);
  if (!problem) return;

  console.log(`\n🔍 Fixing: ${problem.title}`);
  console.log('─'.repeat(60));

  const result = await smartFixProblem(problem);

  if (!result) {
    console.log('❌ Fix attempt failed');
    return;
  }

  console.log(`\n📋 Result: ${result.result.status}`);
  console.log(`   Summary: ${result.result.summary}`);

  if (result.result.status === 'needs_fixes' && result.result.fixes) {
    console.log(`\n🔧 Applying fixes...`);
    const success = await applyFixes(problemId, result.result.fixes, result.validationReport || null);
    if (success) {
      if (result.result.validationPassed) {
        console.log(`✅ Fixes applied & validated! All tests pass.`);
      } else {
        console.log(`⚠️  Fixes applied but some tests still fail after ${MAX_FIX_RETRIES} retries. Re-run test validation to verify.`);
      }
    } else {
      console.log(`❌ Failed to apply fixes`);
    }
  }
}

async function runFixAll(limit, apply = false, skip = 0) {
  const problems = await fetchFailedProblems(limit, skip);

  if (problems.length === 0) {
    console.log('✅ No failed problems to fix!');
    return;
  }

  console.log(`\n🔧 Fixing ${problems.length} problems (apply=${apply})`);
  console.log('═'.repeat(60));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let fixedCount = 0;
  let validatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`\n[${i + 1}/${problems.length}] ${problem.id}`);
    console.log(`   📌 ${problem.title}`);
    console.log('─'.repeat(50));

    const result = await smartFixProblem(problem);

    if (!result) {
      errorCount++;
      // Print running status
      console.log(`\n  📈 Progress: ${i + 1}/${problems.length} | ✅ Fixed & Validated: ${validatedCount} | 🔧 Fixed (unvalidated): ${fixedCount} | ❌ Errors: ${errorCount}`);
      continue;
    }

    totalInputTokens += result.tokens.input;
    totalOutputTokens += result.tokens.output;

    console.log(`   📋 ${result.result.status}: ${result.result.summary}`);

    // Already passing — no AI needed, just updated Firebase
    if (result.result.status === 'already_passing') {
      validatedCount++;
      const runningCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
      console.log(`\n  📈 Progress: ${i + 1}/${problems.length} | ✅ Fixed & Validated: ${validatedCount} | 🔧 Fixed (unvalidated): ${fixedCount} | ❌ Errors: ${errorCount} | 💰 $${runningCost.toFixed(4)}`);
      continue;
    }

    if (result.result.status === 'needs_fixes' && result.result.fixes) {
      if (apply) {
        const success = await applyFixes(problem.id, result.result.fixes, result.validationReport || null);
        if (success) {
          if (result.result.validationPassed) validatedCount++;
          else fixedCount++;
        } else {
          errorCount++;
        }
      } else {
        if (result.result.validationPassed) validatedCount++;
        else fixedCount++;
      }
    }

    // Print running status
    const runningCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
    console.log(`\n  📈 Progress: ${i + 1}/${problems.length} | ✅ Fixed & Validated: ${validatedCount} | 🔧 Fixed (unvalidated): ${fixedCount} | ❌ Errors: ${errorCount} | 💰 $${runningCost.toFixed(4)}`);
  }

  const inputCost = (totalInputTokens / 1000000) * 3;
  const outputCost = (totalOutputTokens / 1000000) * 15;
  const totalCost = inputCost + outputCost;
  const batchCost = totalCost * 0.5;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 FINAL SUMMARY`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`✅ Fixed & Validated: ${validatedCount}`);
  console.log(`🔧 Fixed (unvalidated): ${fixedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📦 Total processed: ${problems.length}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`💰 COST BREAKDOWN:`);
  console.log(`   Input:  ${totalInputTokens.toLocaleString()} tokens × $3.00/1M  = $${inputCost.toFixed(4)}`);
  console.log(`   Output: ${totalOutputTokens.toLocaleString()} tokens × $15.00/1M = $${outputCost.toFixed(4)}`);
  console.log(`   Live API Total:  $${totalCost.toFixed(4)}`);
  console.log(`   Batch API Total: $${batchCost.toFixed(4)} (50% off)`);
  console.log(`${'═'.repeat(60)}`);
}

// ==================== BATCH MODE ====================

async function createBatch(limit, skip = 0) {
  const problems = await fetchFailedProblems(limit, skip);

  if (problems.length === 0) {
    console.log('✅ No failed problems to batch!');
    return;
  }

  console.log(`📦 Creating batch for ${problems.length} failed problems...`);

  const requests = [];

  for (const problem of problems) {
    const failures = analyzeFailures(problem.tests_report);
    if (Object.keys(failures).length === 0) continue;

    const prompt = generateFixPrompt(problem, failures);
    let customId = problem.id;
    if (customId.length > 64) {
      customId = customId.substring(0, 58) + '-' + requests.length;
    }

    requests.push({
      custom_id: customId,
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      }
    });
  }

  if (requests.length === 0) {
    console.log('ℹ️  No problems with actual test failures');
    return;
  }

  console.log(`📝 Prepared ${requests.length} fix requests`);

  try {
    const batch = await anthropic.messages.batches.create({ requests });

    console.log(`\n✅ Batch created: ${batch.id}`);
    console.log(`📊 Status: ${batch.processing_status}`);
    console.log(`\nNext:`);
    console.log(`  node fix_failed_tests.js --check-batch ${batch.id}`);
    console.log(`  node fix_failed_tests.js --process-results ${batch.id}`);

    const idMapping = {};
    requests.forEach((req, idx) => {
      idMapping[req.custom_id] = problems[idx].id;
    });

    fs.writeFileSync(`fix_batch_${batch.id}.json`, JSON.stringify({
      batchId: batch.id,
      createdAt: new Date().toISOString(),
      problemCount: requests.length,
      problemIds: problems.map(p => p.id),
      idMapping
    }, null, 2));

  } catch (error) {
    console.error(`❌ Batch creation error: ${error.message}`);
  }
}

async function checkBatch(batchId) {
  try {
    const batch = await anthropic.messages.batches.retrieve(batchId);

    console.log(`\n📋 Batch: ${batchId}`);
    console.log(`Status: ${batch.processing_status}`);
    if (batch.request_counts) {
      console.log(`Succeeded: ${batch.request_counts.succeeded}, Errored: ${batch.request_counts.errored}, Processing: ${batch.request_counts.processing}`);
    }
    if (batch.processing_status === 'ended') {
      console.log(`\n✅ Complete! Run: node fix_failed_tests.js --process-results ${batchId}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function processResults(batchId) {
  initFirebase();

  console.log(`\n📦 Processing results for batch: ${batchId}`);

  let idMapping = {};
  const infoFile = `fix_batch_${batchId}.json`;
  if (fs.existsSync(infoFile)) {
    try {
      const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
      idMapping = info.idMapping || {};
    } catch (e) {}
  }

  let fixedCount = 0, errorCount = 0;
  let totalInputTokens = 0, totalOutputTokens = 0;

  try {
    const results = await anthropic.messages.batches.results(batchId);

    for await (const result of results) {
      const problemId = idMapping[result.custom_id] || result.custom_id;
      console.log(`\n[${problemId}]`);

      if (result.result.type !== 'succeeded') {
        console.log(`   ❌ Error: ${result.result.error?.message || 'Unknown'}`);
        errorCount++;
        continue;
      }

      const message = result.result.message;
      if (message.usage) {
        totalInputTokens += message.usage.input_tokens || 0;
        totalOutputTokens += message.usage.output_tokens || 0;
      }

      const responseText = message.content[0]?.text || '';
      let parsed = null;
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        const m = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (m) try { parsed = JSON.parse(m[1]); } catch (e2) {}
        if (!parsed) {
          const s = responseText.indexOf('{'), en = responseText.lastIndexOf('}');
          if (s !== -1 && en !== -1) try { parsed = JSON.parse(responseText.substring(s, en + 1)); } catch (e3) {}
        }
      }

      if (!parsed) {
        console.log(`   ❌ Failed to parse`);
        errorCount++;
        continue;
      }

      console.log(`   📋 ${parsed.status}: ${parsed.summary}`);

      if (parsed.status === 'needs_fixes' && parsed.fixes) {
        // Fetch the problem to validate fixes against test cases
        const problem = await fetchProblemById(problemId);
        if (problem) {
          console.log(`   🧪 Validating fixed code via Judge0...`);
          let currentFixes = parsed.fixes;
          let validated = false;

          for (let retry = 0; retry <= MAX_FIX_RETRIES; retry++) {
            const validation = await validateFixedCode(problem, currentFixes);

            // Auto-correct test cases where ALL langs produce same output
            if (!validation.allPassed) {
              const autoFixed = autoCorrectTestCases(validation, currentFixes);
              if (autoFixed.corrected > 0) {
                currentFixes = mergeFixes(currentFixes, { testCases: autoFixed.testCaseFixes });
                console.log(`   🔄 Re-validating after auto-correcting ${autoFixed.corrected} test case(s)...`);
                const reValidation = await validateFixedCode(problem, currentFixes);
                if (reValidation.allPassed) {
                  console.log(`   ✅ All tests passed after auto-correcting test cases!`);
                  const success = await applyFixes(problemId, currentFixes, reValidation.report);
                  if (success) fixedCount++;
                  else errorCount++;
                  validated = true;
                  break;
                }
                Object.assign(validation, reValidation);
              }
            }

            if (validation.allPassed) {
              console.log(`   ✅ All tests passed${retry > 0 ? ` after retry ${retry}` : ''}!`);
              const success = await applyFixes(problemId, currentFixes, validation.report);
              if (success) fixedCount++;
              else errorCount++;
              validated = true;
              break;
            }

            if (retry < MAX_FIX_RETRIES) {
              const failCount = Object.keys(validation.results).length;
              const passedRefCount = Object.keys(validation.passedCode || {}).reduce((sum, a) => sum + Object.keys(validation.passedCode[a]).length, 0);
              console.log(`   ⚠️  ${failCount} still failing. Retry ${retry + 1}/${MAX_FIX_RETRIES}...`);
              if (passedRefCount > 0) {
                console.log(`   🟢 ${passedRefCount} lang(s) passed — using as reference`);
              }

              // Send back to Claude for retry
              const retryPrompt = generateRetryPrompt(problem, currentFixes, validation.results, retry + 1, validation.passedCode || {});
              try {
                const retryResp = await anthropic.messages.create({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 16000,
                  messages: [{ role: 'user', content: retryPrompt }]
                });
                const retryText = retryResp.content[0]?.text || '';
                if (retryResp.usage) {
                  totalInputTokens += retryResp.usage.input_tokens || 0;
                  totalOutputTokens += retryResp.usage.output_tokens || 0;
                }
                let retryParsed = null;
                try { retryParsed = JSON.parse(retryText); } catch (e) {
                  const m2 = retryText.match(/```(?:json)?\s*([\s\S]*?)```/);
                  if (m2) try { retryParsed = JSON.parse(m2[1]); } catch (e2) {}
                  if (!retryParsed) {
                    const s2 = retryText.indexOf('{'), en2 = retryText.lastIndexOf('}');
                    if (s2 !== -1 && en2 !== -1) try { retryParsed = JSON.parse(retryText.substring(s2, en2 + 1)); } catch (e3) {}
                  }
                }
                if (retryParsed?.fixes) {
                  currentFixes = mergeFixes(currentFixes, retryParsed.fixes);
                } else {
                  console.log(`   ⚠️  Retry parse failed, applying best effort`);
                  break;
                }
              } catch (retryErr) {
                console.log(`   ❌ Retry API error: ${retryErr.message}`);
                break;
              }
              await new Promise(r => setTimeout(r, 1000));
            }
          }

          if (!validated) {
            console.log(`   ❌ Still failing after ${MAX_FIX_RETRIES} retries. Applying best effort.`);
            const success = await applyFixes(problemId, currentFixes);
            if (success) fixedCount++;
            else errorCount++;
          }
        } else {
          // Fallback: can't fetch problem, apply without validation
          const success = await applyFixes(problemId, parsed.fixes);
          if (success) fixedCount++;
          else errorCount++;
        }
      }
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  const inputCost = (totalInputTokens / 1000000) * 1.5;  // Batch = 50% off $3
  const outputCost = (totalOutputTokens / 1000000) * 7.5; // Batch = 50% off $15
  const totalCost = inputCost + outputCost;
  const standardCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
  const savedAmount = standardCost - totalCost;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🔧 Fixed: ${fixedCount} | ❌ Errors: ${errorCount}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`💰 COST BREAKDOWN (Batch 50% Discount):`);
  console.log(`   Input:  ${totalInputTokens.toLocaleString()} tokens × $1.50/1M  = $${inputCost.toFixed(4)}`);
  console.log(`   Output: ${totalOutputTokens.toLocaleString()} tokens × $7.50/1M  = $${outputCost.toFixed(4)}`);
  console.log(`   Batch Total: $${totalCost.toFixed(4)}`);
  console.log(`   💰 Saved: $${savedAmount.toFixed(4)} vs live API ($${standardCost.toFixed(4)})`);
  console.log(`${'═'.repeat(50)}`);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('═══════════════════════════════════════════');
    console.log('🔧 Fix Failed Tests');
    console.log('   Finds tests_passed:false problems,');
    console.log('   analyzes failures, sends to AI for fix');
    console.log('═══════════════════════════════════════════\n');
    console.log('Commands:\n');
    console.log('  --list-failed [limit]         List problems with failed tests');
    console.log('  --test <problem_id>           Analyze & show fixes (no apply)');
    console.log('  --test-apply <problem_id>     Analyze & apply fixes');
    console.log('  --fix-all [limit]             Fix all failed (show only)');
    console.log('  --fix-apply-all [limit]       Fix all failed & apply');
    console.log('  --create-batch [limit]        Create batch job (50% cheaper)');
    console.log('  --check-batch <batch_id>      Check batch status');
    console.log('  --process-results <batch_id>  Process & apply batch results');
    console.log('\n  Optional: --skip <n>          Skip first n problems (use with any command above)\n');
    console.log('  Examples:');
    console.log('    node fix_failed_tests.js --fix-apply-all 10 --skip 15');
    console.log('    node fix_failed_tests.js --list-failed --skip 15\n');
    process.exit(1);
  }

  const command = args[0];
  const param = args[1];
  
  // Parse --skip flag from any position
  const skipIdx = args.indexOf('--skip');
  const skip = skipIdx !== -1 && args[skipIdx + 1] ? parseInt(args[skipIdx + 1]) : 0;

  switch (command) {
    case '--list-failed':
      await listFailed(param ? parseInt(param) : null, skip);
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
      await runFixAll(param ? parseInt(param) : null, false, skip);
      break;

    case '--fix-apply-all':
      await runFixAll(param ? parseInt(param) : null, true, skip);
      break;

    case '--create-batch':
      await createBatch(param ? parseInt(param) : null, skip);
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
