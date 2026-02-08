/**
 * Run Test Cases Validator
 * Fetches problems from Firebase, executes each approach's code via Judge0
 * against test cases, and updates the document with tests_passed: true/false
 *
 * Usage:
 *   node run_test_cases.js --test <problem_id>           (single problem, dry run)
 *   node run_test_cases.js --test-apply <problem_id>     (single problem, update Firebase)
 *   node run_test_cases.js --batch [limit]               (batch, dry run)
 *   node run_test_cases.js --batch-apply [limit]         (batch, update Firebase)
 *   node run_test_cases.js --from-file <file.txt> [limit] (from slug list, dry run)
 *   node run_test_cases.js --from-file-apply <file.txt> [limit] (from slug list, update Firebase)
 *   node run_test_cases.js --list [limit]                (list problems)
 */

const admin = require('firebase-admin');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';
const JUDGE0_BASE_URL = 'https://tpcg2.tutorialspoint.com/judge0';

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

  // Decode base64 fields
  for (const field of ['stdout', 'stderr', 'compile_output', 'message']) {
    if (result[field]) {
      try { result[field] = b64Decode(result[field]); } catch (_) {}
    }
  }

  // If still processing, poll
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

// ==================== BUILD STDIN FROM TEST CASE ====================

function buildStdin(testCase) {
  // testCase.input is an object like { n: "2" } or { nums: "[1,2,3]", target: "5" }
  // The code reads from stdin line by line, so we join values with newlines
  const input = testCase.input;
  if (!input) return '';

  if (typeof input === 'string') return input;

  // If it's an object, join all values in order
  const values = Object.values(input);
  return values.join('\n');
}

// ==================== SMART OUTPUT COMPARISON ====================

function compareOutputs(actual, expected) {
  if (actual === expected) return true;

  // Case-insensitive for booleans
  if (actual.toLowerCase() === expected.toLowerCase()) return true;

  // Numeric comparison (handles "1" vs "1.0" vs "1.000000", "0.5" vs "0.500000")
  const actualNum = parseFloat(actual);
  const expectedNum = parseFloat(expected);
  if (!isNaN(actualNum) && !isNaN(expectedNum) &&
      /^-?\d+\.?\d*$/.test(actual) && /^-?\d+\.?\d*$/.test(expected)) {
    return Math.abs(actualNum - expectedNum) < 1e-6;
  }

  // Array/JSON comparison (normalize spacing)
  if ((actual.startsWith('[') && actual.endsWith(']')) ||
      (actual.startsWith('{') && actual.endsWith('}'))) {
    try {
      return JSON.stringify(JSON.parse(actual)) === JSON.stringify(JSON.parse(expected));
    } catch (e) {}
  }

  // Whitespace normalization
  if (actual.replace(/\s+/g, ' ') === expected.replace(/\s+/g, ' ')) return true;

  // Trailing newlines
  if (actual.replace(/\n+$/, '') === expected.replace(/\n+$/, '')) return true;

  return false;
}

// ==================== RUN SINGLE TEST CASE ====================

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

// ==================== INPUT REDUCTION HELPERS ====================

/**
 * Reduce a test case input value intelligently.
 * For numeric values: reduce by ~40% (e.g. 15 -> 9, 100 -> 60)
 * For arrays: shorten them
 * For strings: shorten them
 */
function reduceInputValue(value) {
  const str = String(value).trim();

  // Numeric integer
  if (/^-?\d+$/.test(str)) {
    const num = parseInt(str);
    const reduced = Math.max(1, Math.floor(num * 0.6));
    return String(reduced);
  }

  // Numeric float
  if (/^-?\d+\.\d+$/.test(str)) {
    const num = parseFloat(str);
    return String(Math.max(0.1, num * 0.6).toFixed(2));
  }

  // Array like [1,2,3,4,5]
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) {
        const reduced = arr.slice(0, Math.max(1, Math.ceil(arr.length * 0.6)));
        return JSON.stringify(reduced);
      }
    } catch (_) {}
  }

  // String: shorten
  if (str.length > 5) {
    return str.substring(0, Math.max(3, Math.ceil(str.length * 0.6)));
  }

  return str;
}

function reduceTestCaseInput(tc) {
  const input = tc.input;
  if (!input) return null;

  if (typeof input === 'string') {
    return { ...tc, input: reduceInputValue(input) };
  }

  // Object input: reduce each value
  const reduced = {};
  for (const [key, val] of Object.entries(input)) {
    reduced[key] = reduceInputValue(val);
  }
  return { ...tc, input: reduced };
}

// ==================== GET EXPECTED OUTPUT FROM OPTIMIZED APPROACH ====================

/**
 * Pick a non-brute-force approach and run it to get the correct expected output
 * for a given stdin input.
 */
async function getExpectedFromOptimized(approaches, stdin) {
  // Prefer non-brute-force approaches
  const preferredOrder = ['memoization', 'backtracking', 'optimal', 'dp', 'greedy'];
  const approachNames = Object.keys(approaches);

  let pickedApproach = null;
  for (const pref of preferredOrder) {
    const match = approachNames.find(a => a.toLowerCase().includes(pref));
    if (match && approaches[match].code) {
      pickedApproach = match;
      break;
    }
  }

  // Fallback: pick first non-brute-force
  if (!pickedApproach) {
    pickedApproach = approachNames.find(a =>
      !a.toLowerCase().includes('brute') && approaches[a].code
    );
  }

  // Last resort: pick any
  if (!pickedApproach) {
    pickedApproach = approachNames.find(a => approaches[a].code);
  }

  if (!pickedApproach) return null;

  const code = approaches[pickedApproach].code;
  // Try python first, then javascript, then any
  const langPriority = ['python', 'javascript', 'cpp', 'java', 'go', 'c'];
  for (const lang of langPriority) {
    if (code[lang] && LANGUAGE_IDS[lang]) {
      try {
        console.log(`       🔬 Getting expected from ${pickedApproach}/${lang} with stdin="${stdin}"`);
        const result = await judge0Submit(code[lang], LANGUAGE_IDS[lang], stdin);
        const output = (result.stdout || '').trim();
        console.log(`       🔬 Got: "${output}" [${result.status.description}]`);
        if (result.status.id === 3 && output) {
          return output;
        }
      } catch (e) {
        console.log(`       🔬 Error: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return null;
}

// ==================== VALIDATE A SINGLE PROBLEM ====================

async function validateProblem(problemData) {
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
  const tcUpdates = [];
  let allPassed = true;

  // Build working copy of test cases (will be mutated if TLE reduction happens)
  const workingTCs = testCases.map(tc => ({ ...tc }));

  // Sort approaches: brute-force first, so we detect TLE early and fix TCs before running others
  const approachNames = Object.keys(approaches);
  const sortedApproaches = approachNames.sort((a, b) => {
    const aIsBrute = a.toLowerCase().includes('brute') ? 0 : 1;
    const bIsBrute = b.toLowerCase().includes('brute') ? 0 : 1;
    return aIsBrute - bIsBrute;
  });

  console.log(`\n  📋 Approach order: ${sortedApproaches.join(' → ')}`);

  for (const approachName of sortedApproaches) {
    const approachData = approaches[approachName];
    if (!approachData.code) continue;

    report[approachName] = {};
    const isBruteForce = approachName.toLowerCase().includes('brute');

    // For brute-force, only test one language first to detect TLE quickly
    const allLangs = Object.entries(approachData.code).filter(([l]) => LANGUAGE_IDS[l]);

    if (isBruteForce && allLangs.length > 0) {
      // === BRUTE-FORCE: Test one lang first, fix TLE TCs, then run all langs ===
      const [firstLang, firstCode] = allLangs[0];
      const firstLangId = LANGUAGE_IDS[firstLang];

      console.log(`\n    🔧 ${approachName} / ${firstLang} (probe for TLE)...`);

      for (let i = 0; i < workingTCs.length; i++) {
        const tc = workingTCs[i];
        const stdin = buildStdin(tc);

        const res = await runTestCase(firstCode, firstLangId, stdin, tc.expected);
        const isTLE = res.status === 'Time Limit Exceeded' || (res.error || '').includes('Killed');

        if (res.passed) {
          console.log(`      ✅ TC${i + 1} passed`);
        } else if (isTLE) {
          console.log(`      ⏱️  TC${i + 1}: TLE — reducing input...`);
          console.log(`         Original: ${JSON.stringify(tc.input)}`);

          // Reduce and retry
          let reducedTc = reduceTestCaseInput(tc);
          let fixed = false;

          for (let attempt = 1; attempt <= 3 && reducedTc && !fixed; attempt++) {
            const reducedStdin = buildStdin(reducedTc);
            console.log(`         Attempt ${attempt}: input=${JSON.stringify(reducedTc.input)}`);

            // Get correct expected from optimized approach
            const newExpected = await getExpectedFromOptimized(approaches, reducedStdin);
            if (!newExpected) {
              console.log(`         ⚠️  Could not get expected from optimized approach`);
              break;
            }
            console.log(`         Expected from optimized: "${newExpected}"`);

            // Verify brute-force passes with reduced input
            const retryRes = await runTestCase(firstCode, firstLangId, reducedStdin, newExpected,
              `🔄 Retry ${approachName}/${firstLang}`);

            if (retryRes.passed) {
              console.log(`         ✅ Reduced input works! TC${i + 1}: ${JSON.stringify(tc.input)} → ${JSON.stringify(reducedTc.input)}`);
              // Update working TC
              tcUpdates.push({
                index: i,
                newInput: reducedTc.input,
                newExpected: newExpected,
                originalInput: tc.input,
                originalExpected: tc.expected,
              });
              workingTCs[i] = { ...workingTCs[i], input: reducedTc.input, expected: newExpected };
              fixed = true;
            } else {
              const stillTLE = retryRes.status === 'Time Limit Exceeded' || (retryRes.error || '').includes('Killed');
              if (stillTLE) {
                console.log(`         ⏱️  Still TLE, reducing further...`);
                reducedTc = reduceTestCaseInput(reducedTc);
              } else {
                console.log(`         ❌ Failed: got="${retryRes.actual}" [${retryRes.status}]`);
                break;
              }
            }
          }

          if (!fixed) {
            console.log(`         ❌ Could not fix TC${i + 1} with input reduction`);
          }
        } else {
          console.log(`      ❌ TC${i + 1}: expected="${res.expected}" got="${res.actual}" [${res.status}]`);
          if (res.error) console.log(`         Error: ${res.error.substring(0, 200)}`);
        }

        if (i < workingTCs.length - 1) await new Promise(r => setTimeout(r, 300));
      }

      // Now run ALL languages for brute-force with the (possibly updated) working TCs
      console.log(`\n    🔧 ${approachName}: Running all languages with final TCs...`);
      for (const [lang, code] of allLangs) {
        const langId = LANGUAGE_IDS[lang];
        console.log(`    🔧 ${approachName} / ${lang}...`);

        let langPassed = true;
        const tcResults = [];

        for (let i = 0; i < workingTCs.length; i++) {
          const tc = workingTCs[i];
          const stdin = buildStdin(tc);

          const res = await runTestCase(code, langId, stdin, tc.expected);
          tcResults.push(res);

          if (!res.passed) {
            langPassed = false;
            console.log(`      ❌ TC${i + 1}: expected="${res.expected}" got="${res.actual}" [${res.status}]`);
            if (res.error) console.log(`         Error: ${res.error.substring(0, 200)}`);
          } else {
            console.log(`      ✅ TC${i + 1} passed`);
          }

          if (i < workingTCs.length - 1) await new Promise(r => setTimeout(r, 300));
        }

        report[approachName][lang] = buildLangReport(langPassed, tcResults);
        if (!langPassed) allPassed = false;
        console.log(`    ${langPassed ? '✅' : '❌'} ${approachName}/${lang}: ${langPassed ? 'ALL PASSED' : 'FAILED'}`);
        await new Promise(r => setTimeout(r, 500));
      }

    } else {
      // === NON-BRUTE-FORCE: Run all languages directly with working TCs ===
      for (const [lang, code] of allLangs) {
        const langId = LANGUAGE_IDS[lang];
        console.log(`    🔧 ${approachName} / ${lang}...`);

        let langPassed = true;
        const tcResults = [];

        for (let i = 0; i < workingTCs.length; i++) {
          const tc = workingTCs[i];
          const stdin = buildStdin(tc);

          const res = await runTestCase(code, langId, stdin, tc.expected);
          tcResults.push(res);

          if (!res.passed) {
            langPassed = false;
            console.log(`      ❌ TC${i + 1}: expected="${res.expected}" got="${res.actual}" [${res.status}]`);
            if (res.error) console.log(`         Error: ${res.error.substring(0, 200)}`);
          } else {
            console.log(`      ✅ TC${i + 1} passed`);
          }

          if (i < workingTCs.length - 1) await new Promise(r => setTimeout(r, 300));
        }

        report[approachName][lang] = buildLangReport(langPassed, tcResults);
        if (!langPassed) allPassed = false;
        console.log(`    ${langPassed ? '✅' : '❌'} ${approachName}/${lang}: ${langPassed ? 'ALL PASSED' : 'FAILED'}`);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  return { allPassed, report, tcUpdates };
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

// ==================== FIREBASE HELPERS ====================

async function fetchProblem(problemId) {
  initFirebase();
  const doc = await db.collection(COLLECTION_NAME).doc(problemId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function fetchProblems(limit = null) {
  initFirebase();
  let query = db.collection(COLLECTION_NAME).where('problemType', '==', 'coding');
  if (limit) query = query.limit(limit);
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchProblemsBySlugList(slugs) {
  initFirebase();
  const problems = [];
  for (const slug of slugs) {
    const doc = await db.collection(COLLECTION_NAME).doc(slug).get();
    if (doc.exists && doc.data().problemType === 'coding') {
      problems.push({ id: doc.id, ...doc.data() });
    } else {
      console.log(`  ⚠️  Skipped: ${slug}`);
    }
  }
  return problems;
}

async function updateTestsPassed(problemId, passed, report = null, tcUpdates = []) {
  initFirebase();
  const updateData = {
    tests_passed: passed,
    tests_validated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Add report
  if (report) {
    updateData.tests_report = report;
  }

  // Update test cases if any were reduced
  if (tcUpdates.length > 0) {
    const docRef = db.collection(COLLECTION_NAME).doc(problemId);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      const testCases = data.testCases || [];
      for (const update of tcUpdates) {
        if (update.index < testCases.length) {
          testCases[update.index].input = update.newInput;
          testCases[update.index].expected = update.newExpected;
          testCases[update.index].explanation = 
            (testCases[update.index].explanation || '') + 
            ` [Input reduced from ${JSON.stringify(update.originalInput)} to avoid TLE]`;
        }
      }
      updateData.testCases = testCases;
    }
  }

  await db.collection(COLLECTION_NAME).doc(problemId).update(updateData);
}

// ==================== SKIP LOGIC ====================

function shouldSkip(problem) {
  // Skip if already passed
  if (problem.tests_passed === true) {
    console.log(`  ⏭️  Skipped: tests_passed=true`);
    return true;
  }

  // Skip SQL problems
  if (problem.problemType === 'sql' || (problem.tags && problem.tags.some(t => t.toLowerCase() === 'sql'))) {
    console.log(`  ⏭️  Skipped: SQL problem`);
    return true;
  }

  // Skip if no approaches or no test cases
  if (!problem.approaches || Object.keys(problem.approaches).length === 0) {
    console.log(`  ⏭️  Skipped: no approaches`);
    return true;
  }

  if (!problem.testCases || problem.testCases.length === 0) {
    console.log(`  ⏭️  Skipped: no test cases`);
    return true;
  }

  return false;
}

// ==================== MODES ====================

async function runSingle(problemId, apply = false) {
  console.log(`\n🔍 Validating: ${problemId}`);
  const problem = await fetchProblem(problemId);
  if (!problem) {
    console.log(`❌ Problem not found: ${problemId}`);
    return;
  }

  console.log(`  📋 ${problem.title} (${problem.difficulty || 'N/A'})`);
  console.log(`  📝 ${(problem.testCases || []).length} test cases, ${Object.keys(problem.approaches || {}).length} approaches`);

  const { allPassed, report, tcUpdates } = await validateProblem(problem);

  console.log(`\n  ${'='.repeat(50)}`);
  console.log(`  Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  if (tcUpdates.length > 0) {
    console.log(`  📉 ${tcUpdates.length} test case(s) had input reduced to avoid TLE`);
    for (const u of tcUpdates) {
      console.log(`     TC${u.index + 1}: ${JSON.stringify(u.originalInput)} → ${JSON.stringify(u.newInput)} (expected: ${u.newExpected})`);
    }
  }

  // Print failure summary from report
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
    console.log(`\n  ❌ Failures:`);
    failures.forEach(f => console.log(`     ${f}`));
  }

  if (apply) {
    await updateTestsPassed(problemId, allPassed, report, tcUpdates);
    console.log(`\n  📤 Updated Firebase: tests_passed=${allPassed}, tests_report saved`);
    if (tcUpdates.length > 0) {
      console.log(`  📤 Updated ${tcUpdates.length} test case(s) with reduced input`);
    }
  } else {
    console.log(`  ℹ️  Dry run - use --test-apply to update Firebase`);
  }
}

async function runBatch(limit, apply = false) {
  const problems = await fetchProblems(limit);
  console.log(`\n📦 Found ${problems.length} coding problems\n`);

  let passedCount = 0, failedCount = 0, errorCount = 0, reducedCount = 0, skippedCount = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`\n[${ i + 1}/${problems.length}] 🔍 ${problem.id} - ${problem.title}`);

    if (shouldSkip(problem)) {
      skippedCount++;
      continue;
    }

    try {
      const { allPassed, report, tcUpdates } = await validateProblem(problem);

      if (allPassed) passedCount++;
      else failedCount++;

      if (tcUpdates.length > 0) reducedCount++;

      if (apply) {
        await updateTestsPassed(problem.id, allPassed, report, tcUpdates);
        console.log(`  📤 tests_passed=${allPassed}${tcUpdates.length > 0 ? `, ${tcUpdates.length} TC(s) reduced` : ''}`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      errorCount++;

      if (apply) {
        await updateTestsPassed(problem.id, false, { error: err.message });
        console.log(`  📤 tests_passed=false (error)`);
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 SUMMARY`);
  console.log(`  ✅ Passed: ${passedCount}`);
  console.log(`  ❌ Failed: ${failedCount}`);
  console.log(`  📉 Reduced TCs: ${reducedCount} problems`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  ⚠️  Errors: ${errorCount}`);
  console.log(`${'='.repeat(50)}`);
}

async function runFromFile(filePath, limit, apply = false) {
  const slugs = fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'));

  const subset = limit ? slugs.slice(0, limit) : slugs;
  console.log(`📄 Loaded ${subset.length} slugs from ${filePath}`);

  const problems = await fetchProblemsBySlugList(subset);
  console.log(`📦 Found ${problems.length} coding problems\n`);

  let passedCount = 0, failedCount = 0, errorCount = 0, reducedCount = 0, skippedCount = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`\n[${i + 1}/${problems.length}] 🔍 ${problem.id} - ${problem.title}`);

    if (shouldSkip(problem)) {
      skippedCount++;
      continue;
    }

    try {
      const { allPassed, report, tcUpdates } = await validateProblem(problem);

      if (allPassed) passedCount++;
      else failedCount++;

      if (tcUpdates.length > 0) reducedCount++;

      if (apply) {
        await updateTestsPassed(problem.id, allPassed, report, tcUpdates);
        console.log(`  📤 tests_passed=${allPassed}${tcUpdates.length > 0 ? `, ${tcUpdates.length} TC(s) reduced` : ''}`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      errorCount++;

      if (apply) {
        await updateTestsPassed(problem.id, false, { error: err.message });
        console.log(`  📤 tests_passed=false (error)`);
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 SUMMARY`);
  console.log(`  ✅ Passed: ${passedCount}`);
  console.log(`  ❌ Failed: ${failedCount}`);
  console.log(`  📉 Reduced TCs: ${reducedCount} problems`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  ⚠️  Errors: ${errorCount}`);
  console.log(`${'='.repeat(50)}`);
}

async function listProblems(limit) {
  const problems = await fetchProblems(limit);
  console.log(`\n📋 ${problems.length} coding problems:\n`);
  for (const p of problems) {
    const tp = p.tests_passed !== undefined ? (p.tests_passed ? '✅' : '❌') : '⬜';
    const approaches = Object.keys(p.approaches || {}).length;
    const tcs = (p.testCases || []).length;
    console.log(`  ${tp} ${p.id} | ${p.title} | ${approaches} approaches | ${tcs} TCs`);
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('====================================');
    console.log('🧪 Run Test Cases Validator');
    console.log('   Executes code via Judge0 against test cases');
    console.log('====================================\n');
    console.log('Commands:\n');
    console.log('  --test <problem_id>                    Validate single (dry run)');
    console.log('  --test-apply <problem_id>              Validate single & update Firebase');
    console.log('  --batch [limit]                        Validate batch (dry run)');
    console.log('  --batch-apply [limit]                  Validate batch & update Firebase');
    console.log('  --from-file <file.txt> [limit]         From slug list (dry run)');
    console.log('  --from-file-apply <file.txt> [limit]   From slug list & update Firebase');
    console.log('  --list [limit]                         List problems');
    process.exit(1);
  }

  const cmd = args[0];
  const param = args[1];

  switch (cmd) {
    case '--test':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runSingle(param, false);
      break;

    case '--test-apply':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runSingle(param, true);
      break;

    case '--batch':
      await runBatch(param ? parseInt(param) : null, false);
      break;

    case '--batch-apply':
      await runBatch(param ? parseInt(param) : null, true);
      break;

    case '--from-file':
      if (!param || !fs.existsSync(param)) { console.error('❌ Provide valid file path'); process.exit(1); }
      await runFromFile(param, args[2] ? parseInt(args[2]) : null, false);
      break;

    case '--from-file-apply':
      if (!param || !fs.existsSync(param)) { console.error('❌ Provide valid file path'); process.exit(1); }
      await runFromFile(param, args[2] ? parseInt(args[2]) : null, true);
      break;

    case '--list':
      await listProblems(parseInt(param) || 20);
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
