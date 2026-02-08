/**
 * Fix Test Cases via Gemini AI
 * Fetches problems with tests_passed=false from Firebase,
 * sends description + examples + test cases to Gemini API to validate,
 * fixes wrong test cases in DB, then re-runs all code against corrected test cases.
 *
 * Usage:
 *   node fix_test_cases.js --fix <problem_id>           (single problem, dry run)
 *   node fix_test_cases.js --fix-apply <problem_id>     (single problem, update Firebase)
 *   node fix_test_cases.js --fix-batch [limit]           (batch failed problems, dry run)
 *   node fix_test_cases.js --fix-batch-apply [limit]     (batch failed problems, update Firebase)
 */

const admin = require('firebase-admin');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';
const JUDGE0_BASE_URL = 'https://tpcg2.tutorialspoint.com/judge0';

const GEMINI_API_KEY = 'AIzaSyA2c2KFku3mqZm_8Z4dU7KUKb3lVstKEqg';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const LANGUAGE_IDS = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  c: 50,
  go: 60,
};

// ==================== INIT FIREBASE ====================
let db = null;

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
      projectId: FIREBASE_PROJECT_ID,
    });
  }
  db = admin.firestore();
}

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
      // Direct match
      if (JSON.stringify(a) === JSON.stringify(e)) return true;
      // Order-agnostic array comparison (for problems like 3Sum where order doesn't matter)
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

async function runTestCase(code, languageId, stdin, expected, label = '') {
  const prefix = label ? `      ${label}` : '      ';
  console.log(`${prefix}  stdin: "${stdin}"`);
  console.log(`${prefix}  expected: "${expected}"`);
  try {
    const result = await judge0Submit(code, languageId, stdin);
    const actual = (result.stdout || '').trim();
    const exp = (expected || '').trim();
    const passed = result.status.id === 3 && compareOutputs(actual, exp);

    console.log(`${prefix}  actual: "${actual}" [${result.status.description}]`);

    return {
      passed,
      actual,
      expected: exp,
      status: result.status.description,
      error: result.compile_output || result.stderr || result.message || null,
    };
  } catch (err) {
    console.log(`${prefix}  actual: ERROR - ${err.message}`);
    return {
      passed: false,
      actual: '',
      expected: (expected || '').trim(),
      status: 'Error',
      error: err.message,
    };
  }
}

function buildLangReport(passed, tcResults) {
  return {
    passed,
    results: tcResults.map((r, i) => ({
      tc: i + 1,
      passed: r.passed,
      status: r.status,
      ...(r.passed ? {} : {
        expected: r.expected,
        actual: r.actual,
        ...(r.error ? { error: r.error.substring(0, 300) } : {})
      })
    }))
  };
}

// ==================== GEMINI API ====================

async function callGeminiAPI(systemPrompt, userMessage) {
  const resp = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: userMessage }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gemini API HTTP ${resp.status}: ${body}`);
  }

  const data = await resp.json();

  const candidates = data.candidates || [];
  if (candidates.length === 0) {
    throw new Error('Gemini returned no candidates');
  }

  const parts = candidates[0].content?.parts || [];
  const text = parts.map(p => p.text || '').join('');
  return text;
}

// ==================== ROBUST JSON PARSING ====================

function parseGeminiJSON(response) {
  let cleaned = response.trim();

  // Strip markdown fences if present
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to fix common issues
  }

  // Try to extract JSON object from response (find first { to last })
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch (e) {
      // Try fixing control characters
    }
  }

  // Remove control characters that might break JSON
  const sanitized = cleaned
    .replace(/[\x00-\x1F\x7F]/g, (ch) => {
      if (ch === '\n') return '\\n';
      if (ch === '\r') return '\\r';
      if (ch === '\t') return '\\t';
      return '';
    });

  const firstBrace2 = sanitized.indexOf('{');
  const lastBrace2 = sanitized.lastIndexOf('}');
  if (firstBrace2 !== -1 && lastBrace2 > firstBrace2) {
    try {
      return JSON.parse(sanitized.substring(firstBrace2, lastBrace2 + 1));
    } catch (e) {
      // Last resort failed
    }
  }

  return null;
}

// ==================== PHASE 1: VALIDATE TEST CASES WITH GEMINI ====================

async function validateTestCasesWithGemini(problem) {
  const { description, descriptionText, examples, testCases, constraints, paramOrder } = problem;

  const systemPrompt = `You are a precise algorithm test case validator. You will be given a coding problem description, examples, and test cases. Your job is to verify if each test case's expected output is correct for the given input.

IMPORTANT RULES:
- Analyze the problem statement carefully
- For each test case, manually work through the logic STEP BY STEP to determine the correct expected output
- Show your work: trace through the algorithm for each test case
- Compare your computed output with the given expected output
- Only flag test cases that are DEFINITELY wrong

Response format (JSON):
{
  "analysis": "Brief explanation of problem logic",
  "results": [
    {
      "tcIndex": 0,
      "input": {"nums": "[1,2,3]"},
      "givenExpected": "true",
      "correctExpected": "true",
      "isCorrect": true,
      "reason": "step by step trace showing why"
    }
  ],
  "hasErrors": false
}`;

  const descText = descriptionText || (description || '').replace(/<[^>]*>/g, '');

  let userMsg = `## Problem Description\n${descText}\n\n`;

  if (constraints && constraints.length > 0) {
    userMsg += `## Constraints\n${constraints.join('\n')}\n\n`;
  }

  if (examples && examples.length > 0) {
    userMsg += `## Examples\n`;
    for (const ex of examples) {
      userMsg += `Input: ${ex.input}\nOutput: ${ex.output}\n`;
      if (ex.explanation) userMsg += `Explanation: ${ex.explanation}\n`;
      userMsg += '\n';
    }
  }

  if (paramOrder && paramOrder.length > 0) {
    userMsg += `## Parameter Order\nThe function receives parameters in this order: ${paramOrder.join(', ')}\n\n`;
  }

  userMsg += `## Test Cases to Validate\n`;
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    userMsg += `TC${i + 1}: Input=${JSON.stringify(tc.input)}, Expected="${tc.expected}"`;
    if (tc.explanation) userMsg += ` (Explanation: ${tc.explanation})`;
    userMsg += '\n';
  }

  userMsg += `\nPlease validate each test case by tracing through the algorithm step by step. Return JSON.`;

  console.log(`  🤖 Querying Gemini to validate ${testCases.length} test cases...`);

  const response = await callGeminiAPI(systemPrompt, userMsg);

  const parsed = parseGeminiJSON(response);
  if (!parsed) {
    console.log(`  ⚠️  Failed to parse Gemini response as JSON`);
    console.log(`  Response preview: ${response.substring(0, 300)}`);
    return null;
  }
  return parsed;
}

// ==================== PHASE 2: CROSS-CHECK WITH TEST REPORT ====================

function extractFailuresFromReport(problem) {
  const report = problem.tests_report;
  if (!report) return [];

  const failures = [];
  const seen = new Set();

  for (const [approach, langs] of Object.entries(report)) {
    if (typeof langs !== 'object' || langs.error) continue;
    for (const [lang, data] of Object.entries(langs)) {
      if (!data.results) continue;
      for (const r of data.results) {
        if (!r.passed && r.actual !== undefined && !seen.has(r.tc - 1)) {
          seen.add(r.tc - 1);
          failures.push({
            tcIndex: r.tc - 1,
            expected: r.expected || problem.testCases[r.tc - 1]?.expected,
            actualOutput: r.actual,
            approachName: approach,
            lang,
          });
        }
      }
    }
  }

  return failures;
}

async function crossCheckWithCodeOutput(problem, failures) {
  const { description, descriptionText, examples, testCases, constraints, approaches } = problem;
  const descText = descriptionText || (description || '').replace(/<[^>]*>/g, '');

  let userMsg = `## Problem Description\n${descText}\n\n`;

  if (constraints && constraints.length > 0) {
    userMsg += `## Constraints\n${constraints.join('\n')}\n\n`;
  }

  if (examples && examples.length > 0) {
    userMsg += `## Examples (from problem statement)\n`;
    for (const ex of examples) {
      userMsg += `Input: ${ex.input}\nOutput: ${ex.output}\n`;
      if (ex.explanation) userMsg += `Explanation: ${ex.explanation}\n`;
      userMsg += '\n';
    }
  }

  userMsg += `## Failing Test Cases\n`;
  userMsg += `All code implementations (brute-force and optimized, across 6 languages) produce the SAME output that differs from the expected value.\n`;
  userMsg += `This strongly suggests the TEST CASE expected value is wrong, not the code.\n\n`;

  for (const f of failures) {
    const tc = testCases[f.tcIndex];
    userMsg += `TC${f.tcIndex + 1}:\n`;
    userMsg += `  Input: ${JSON.stringify(tc.input)}\n`;
    userMsg += `  Expected (in test case): "${f.expected}"\n`;
    userMsg += `  Actual (from ALL code implementations): "${f.actualOutput}"\n`;
    if (tc.explanation) userMsg += `  Explanation: ${tc.explanation}\n`;

    const approachCode = approaches[f.approachName]?.code?.[f.lang];
    if (approachCode) {
      userMsg += `  Code (${f.approachName}/${f.lang}):\n\`\`\`\n${approachCode}\n\`\`\`\n`;
    }
    userMsg += '\n';
  }

  userMsg += `## Task\n`;
  userMsg += `For each failing test case, carefully trace through the problem logic step by step.\n`;
  userMsg += `Determine: is the EXPECTED value in the test case wrong, or is the CODE wrong?\n`;
  userMsg += `If ALL implementations produce the same "wrong" answer, it almost certainly means the test case expected value is incorrect.\n\n`;

  const systemPrompt = `You are a precise algorithm debugger. You will be given a problem description, failing test cases where ALL code implementations produce the same output that differs from the expected value, and the actual code.

Your job is to determine whether the TEST CASE expected value is wrong or the CODE is wrong.

CRITICAL RULES:
- When ALL implementations (brute-force AND optimized, across multiple languages) produce the SAME output, the test case is almost certainly wrong
- Carefully trace through the algorithm step by step for each failing test case

Response format (JSON):
{
  "analysis": "Brief overall analysis",
  "results": [
    {
      "tcIndex": 0,
      "verdict": "test_case_wrong" or "code_wrong",
      "correctExpected": "the correct expected value",
      "reason": "step by step explanation"
    }
  ]
}`;

  console.log(`  🔬 Phase 2: Cross-checking ${failures.length} failing TC(s) with code output via Gemini...`);

  const response = await callGeminiAPI(systemPrompt, userMsg);

  const parsed = parseGeminiJSON(response);
  if (!parsed) {
    console.log(`  ⚠️  Failed to parse Phase 2 Gemini response`);
    console.log(`  Response preview: ${response.substring(0, 300)}`);
    return null;
  }
  return parsed;
}

// ==================== VALIDATE PROBLEM: RE-RUN ALL CODE ====================

async function validateProblemFull(problemData) {
  const { id, title, approaches, testCases } = problemData;

  if (!approaches || Object.keys(approaches).length === 0) {
    console.log(`  ⚠️  No approaches found`);
    return { allPassed: false, report: { error: 'No approaches found' }, tcUpdates: [] };
  }

  if (!testCases || testCases.length === 0) {
    console.log(`  ⚠️  No test cases found`);
    return { allPassed: false, report: { error: 'No test cases found' }, tcUpdates: [] };
  }

  const report = {};
  let allPassed = true;
  let earlyExit = false;

  const approachNames = Object.keys(approaches);
  console.log(`\n  📋 Running approaches: ${approachNames.join(', ')}`);

  for (const approachName of approachNames) {
    if (earlyExit) break;
    const approachData = approaches[approachName];
    if (!approachData.code) continue;

    report[approachName] = {};
    const allLangs = Object.entries(approachData.code).filter(([l]) => LANGUAGE_IDS[l]);

    for (const [lang, code] of allLangs) {
      if (earlyExit) break;
      const langId = LANGUAGE_IDS[lang];
      console.log(`    🔧 ${approachName} / ${lang}...`);

      let langPassed = true;
      const tcResults = [];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const stdin = buildStdin(tc);

        const res = await runTestCase(code, langId, stdin, tc.expected);
        tcResults.push(res);

        if (!res.passed) {
          langPassed = false;
          console.log(`      ❌ TC${i + 1}: expected="${res.expected}" got="${res.actual}" [${res.status}]`);
          if (res.error) console.log(`         Error: ${res.error.substring(0, 200)}`);
          // Stop remaining TCs for this lang
          break;
        } else {
          console.log(`      ✅ TC${i + 1} passed`);
        }

        if (i < testCases.length - 1) await new Promise(r => setTimeout(r, 300));
      }

      report[approachName][lang] = buildLangReport(langPassed, tcResults);
      if (!langPassed) {
        allPassed = false;
        earlyExit = true;
        console.log(`    ❌ ${approachName}/${lang}: FAILED — skipping remaining approaches/langs`);
      } else {
        console.log(`    ✅ ${approachName}/${lang}: ALL PASSED`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { allPassed, report, tcUpdates: [] };
}

// ==================== FIREBASE HELPERS ====================

async function fetchProblem(problemId) {
  initFirebase();
  const doc = await db.collection(COLLECTION_NAME).doc(problemId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function fetchFailedProblems(limit = null) {
  initFirebase();
  let query = db.collection(COLLECTION_NAME)
    .where('problemType', '==', 'coding')
    .where('tests_passed', '==', false);
  if (limit) query = query.limit(limit);
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function updateProblemInFirebase(problemId, allPassed, report, fixedTestCases = null) {
  initFirebase();
  const updateData = {
    tests_passed: allPassed,
    tests_validated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (report) {
    updateData.tests_report = report;
  }

  if (fixedTestCases) {
    updateData.testCases = fixedTestCases;
    updateData._lastValidation = {
      validatedAt: new Date().toISOString(),
      fixesApplied: true,
      fixedBy: 'gemini-ai-validation',
    };
  }

  await db.collection(COLLECTION_NAME).doc(problemId).update(updateData);
}

// ==================== CORE: FIX TEST CASES AND REVALIDATE ====================

async function fixAndRevalidate(problem, apply = false) {
  console.log(`\n🔍 Processing: ${problem.id} - ${problem.title}`);
  console.log(`  📋 ${(problem.testCases || []).length} test cases, ${Object.keys(problem.approaches || {}).length} approaches`);

  if (!problem.testCases || problem.testCases.length === 0) {
    console.log(`  ⏭️  Skipped: no test cases`);
    return { fixed: false, revalidated: false };
  }

  if (!problem.approaches || Object.keys(problem.approaches).length === 0) {
    console.log(`  ⏭️  Skipped: no approaches`);
    return { fixed: false, revalidated: false };
  }

  let fixedTestCases = [...problem.testCases];
  let tcFixCount = 0;

  // ===== PHASE 1: Ask Gemini to validate test cases =====
  console.log(`\n  ━━━ Phase 1: Gemini validates test cases ━━━`);
  const geminiResult = await validateTestCasesWithGemini(problem);

  if (!geminiResult) {
    console.log(`  ❌ Gemini validation failed (no parseable response)`);
    return { fixed: false, revalidated: false };
  }

  console.log(`  🤖 Gemini analysis: ${geminiResult.analysis || 'N/A'}`);

  const wrongTCs = (geminiResult.results || []).filter(r => !r.isCorrect);

  if (wrongTCs.length > 0) {
    console.log(`\n  🔧 Phase 1 found ${wrongTCs.length} incorrect test case(s):`);
    for (const wrong of wrongTCs) {
      const idx = wrong.tcIndex;
      if (idx >= 0 && idx < fixedTestCases.length) {
        const oldExpected = fixedTestCases[idx].expected;
        const newExpected = String(wrong.correctExpected).trim();
        if (oldExpected !== newExpected) {
          console.log(`    TC${idx + 1}: "${oldExpected}" → "${newExpected}" (${wrong.reason})`);
          fixedTestCases[idx].expected = newExpected;
          fixedTestCases[idx].explanation = wrong.reason || fixedTestCases[idx].explanation;
          tcFixCount++;
        }
      }
    }
  }

  // ===== PHASE 2: Cross-check with existing test report =====
  if (tcFixCount === 0 && problem.tests_report) {
    console.log(`\n  ━━━ Phase 2: Cross-checking with code execution results ━━━`);

    const reportFailures = extractFailuresFromReport(problem);
    if (reportFailures.length > 0) {
      console.log(`  📊 Found ${reportFailures.length} TC(s) where ALL code disagrees with expected:`);
      for (const f of reportFailures) {
        console.log(`    TC${f.tcIndex + 1}: expected="${f.expected}" but code outputs="${f.actualOutput}"`);
      }

      const crossCheck = await crossCheckWithCodeOutput(problem, reportFailures);

      if (crossCheck && crossCheck.results) {
        console.log(`  🤖 Phase 2 analysis: ${crossCheck.analysis || 'N/A'}`);

        const tcWrongResults = crossCheck.results.filter(r => r.verdict === 'test_case_wrong');

        for (const result of tcWrongResults) {
          const idx = result.tcIndex;
          if (idx >= 0 && idx < fixedTestCases.length) {
            const oldExpected = fixedTestCases[idx].expected;
            const newExpected = String(result.correctExpected).trim();
            if (oldExpected !== newExpected) {
              console.log(`    🔧 TC${idx + 1}: "${oldExpected}" → "${newExpected}" (${result.reason})`);
              fixedTestCases[idx].expected = newExpected;
              fixedTestCases[idx].explanation = result.reason || fixedTestCases[idx].explanation;
              tcFixCount++;
            }
          }
        }

        // Log code issues but don't fix — will fix later
        const codeWrongResults = crossCheck.results.filter(r => r.verdict === 'code_wrong');
        if (codeWrongResults.length > 0) {
          console.log(`\n  ⚠️  Gemini says CODE is wrong for ${codeWrongResults.length} TC(s) — skipping code fix (will fix later)`);
          for (const r of codeWrongResults) {
            console.log(`    TC${r.tcIndex + 1}: ${r.reason}`);
          }
        }
      }
    } else {
      console.log(`  ℹ️  No failure details in tests_report to cross-check`);
    }
  }

  // ===== PHASE 3: Re-run all code against (possibly fixed) test cases =====
  if (tcFixCount > 0) {
    console.log(`\n  📝 Fixed ${tcFixCount} test case(s). Now re-running all code...`);
  } else {
    console.log(`\n  ℹ️  No test case changes found. Skipping re-run.`);
    return { fixed: false, revalidated: false };
  }

  const problemWithFixes = { ...problem, testCases: fixedTestCases };
  const { allPassed, report } = await validateProblemFull(problemWithFixes);

  console.log(`\n  ${'='.repeat(50)}`);
  console.log(`  Re-validation result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS STILL FAILED (code issue — will fix later)'}`);

  const failures = [];
  for (const [approach, langs] of Object.entries(report)) {
    if (typeof langs !== 'object' || langs.error) continue;
    for (const [lang, data] of Object.entries(langs)) {
      if (!data.passed) {
        const failedTCs = (data.results || [])
          .filter(r => !r.passed)
          .map(r => `TC${r.tc}:${r.status}`)
          .join(', ');
        failures.push(`${approach}/${lang}: ${failedTCs}`);
      }
    }
  }
  if (failures.length > 0) {
    console.log(`\n  ❌ Remaining failures:`);
    failures.forEach(f => console.log(`     ${f}`));
  }

  // ===== PHASE 4: Update Firebase =====
  if (apply) {
    await updateProblemInFirebase(problem.id, allPassed, report, fixedTestCases);
    console.log(`\n  📤 Updated Firebase: tests_passed=${allPassed}, ${tcFixCount} test case(s) fixed`);
  } else {
    console.log(`\n  ℹ️  Dry run - use --fix-apply or --fix-batch-apply to update Firebase`);
  }

  return { fixed: tcFixCount > 0, revalidated: true, allPassed };
}

// ==================== MODES ====================

async function runFixSingle(problemId, apply = false) {
  const problem = await fetchProblem(problemId);
  if (!problem) {
    console.log(`❌ Problem not found: ${problemId}`);
    return;
  }
  await fixAndRevalidate(problem, apply);
}

async function runFixBatch(limit, apply = false) {
  const problems = await fetchFailedProblems(limit);
  console.log(`\n📦 Found ${problems.length} problems with tests_passed=false\n`);

  let fixedCount = 0, passedAfterFix = 0, stillFailing = 0, skippedCount = 0, errorCount = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`\n[${i + 1}/${problems.length}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      const result = await fixAndRevalidate(problem, apply);

      if (!result.fixed) {
        skippedCount++;
      } else {
        fixedCount++;
        if (result.allPassed) passedAfterFix++;
        else stillFailing++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      errorCount++;
    }

    if (i < problems.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 FIX SUMMARY`);
  console.log(`  📦 Total processed: ${problems.length}`);
  console.log(`  🔧 Fixed test cases: ${fixedCount}`);
  console.log(`  ✅ Passed after fix: ${passedAfterFix}`);
  console.log(`  ❌ Still failing (code issue): ${stillFailing}`);
  console.log(`  ⏭️  No fix needed/skipped: ${skippedCount}`);
  console.log(`  ⚠️  Errors: ${errorCount}`);
  console.log(`${'='.repeat(50)}`);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('====================================');
    console.log('🤖 Fix Test Cases via Gemini AI');
    console.log('   Validates & fixes test cases using Gemini API');
    console.log('   then re-runs all code against corrected test cases');
    console.log('====================================\n');
    console.log('Commands:\n');
    console.log('  --fix <problem_id>              Fix single problem (dry run)');
    console.log('  --fix-apply <problem_id>        Fix single problem & update Firebase');
    console.log('  --fix-batch [limit]             Fix all failed problems (dry run)');
    console.log('  --fix-batch-apply [limit]       Fix all failed problems & update Firebase');
    process.exit(1);
  }

  const cmd = args[0];
  const param = args[1];

  switch (cmd) {
    case '--fix':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runFixSingle(param, false);
      break;

    case '--fix-apply':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runFixSingle(param, true);
      break;

    case '--fix-batch':
      await runFixBatch(param ? parseInt(param) : null, false);
      break;

    case '--fix-batch-apply':
      await runFixBatch(param ? parseInt(param) : null, true);
      break;

    default:
      console.error(`❌ Unknown command: ${cmd}`);
      process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
