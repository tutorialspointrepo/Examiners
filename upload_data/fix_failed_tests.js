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

// ==================== FETCH FAILED PROBLEMS ====================

async function fetchFailedProblems(limit = null) {
  initFirebase();

  console.log(`📥 Fetching problems with tests_passed = false...`);

  try {
    let query = db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding')
      .where('tests_passed', '==', false);

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const problems = [];

    snapshot.forEach(doc => {
      problems.push({ id: doc.id, ...doc.data() });
    });

    console.log(`✅ Found ${problems.length} failed problems\n`);
    return problems;
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

// ==================== FIX SINGLE PROBLEM ====================

async function fixProblem(problem) {
  const failures = analyzeFailures(problem.tests_report);

  if (Object.keys(failures).length === 0) {
    console.log(`    ℹ️  No failures found in tests_report`);
    return null;
  }

  // Log what's failing
  for (const [approach, langs] of Object.entries(failures)) {
    const langList = Object.keys(langs).join(', ');
    const totalFailed = Object.values(langs).reduce((sum, l) => sum + l.failedTests.length, 0);
    console.log(`    ❌ ${approach}: ${langList} (${totalFailed} failed tests)`);
  }

  const prompt = generateFixPrompt(problem, failures);

  try {
    console.log(`    🔍 Sending to Claude for fixing...`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const responseText = response.content[0]?.text || '';
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;

    // Cost calculation (Claude Sonnet: $3/1M input, $15/1M output)
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    const totalCost = inputCost + outputCost;
    const batchCost = totalCost * 0.5; // Batch API = 50% discount

    console.log(`    📊 Tokens: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out`);
    console.log(`    💰 Cost Breakdown:`);
    console.log(`       Input:  ${inputTokens.toLocaleString()} tokens × $3.00/1M  = $${inputCost.toFixed(4)}`);
    console.log(`       Output: ${outputTokens.toLocaleString()} tokens × $15.00/1M = $${outputCost.toFixed(4)}`);
    console.log(`       Live API Total:  $${totalCost.toFixed(4)}`);
    console.log(`       Batch API Total: $${batchCost.toFixed(4)} (50% off)`);

    // Parse JSON response
    let result = null;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1]);
        } catch (e2) {}
      }
      if (!result) {
        const startIdx = responseText.indexOf('{');
        const endIdx = responseText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          try {
            result = JSON.parse(responseText.substring(startIdx, endIdx + 1));
          } catch (e3) {
            console.error(`    ❌ Failed to parse response`);
            return null;
          }
        }
      }
    }

    return {
      problemId: problem.id,
      result,
      failures,
      tokens: { input: inputTokens, output: outputTokens },
      cost: { input: inputCost, output: outputCost, total: totalCost }
    };

  } catch (error) {
    console.error(`    ❌ API error: ${error.message}`);
    return null;
  }
}

// ==================== APPLY FIXES ====================

async function applyFixes(problemId, fixes) {
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

async function listFailed(limit) {
  const problems = await fetchFailedProblems(limit);

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

  const result = await fixProblem(problem);

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

  const result = await fixProblem(problem);

  if (!result) {
    console.log('❌ Fix attempt failed');
    return;
  }

  console.log(`\n📋 Result: ${result.result.status}`);
  console.log(`   Summary: ${result.result.summary}`);

  if (result.result.status === 'needs_fixes' && result.result.fixes) {
    console.log(`\n🔧 Applying fixes...`);
    const success = await applyFixes(problemId, result.result.fixes);
    if (success) {
      console.log(`✅ Fixes applied! Re-run test validation to verify.`);
    } else {
      console.log(`❌ Failed to apply fixes`);
    }
  }
}

async function runFixAll(limit, apply = false) {
  const problems = await fetchFailedProblems(limit);

  if (problems.length === 0) {
    console.log('✅ No failed problems to fix!');
    return;
  }

  console.log(`\n🔧 Fixing ${problems.length} problems (apply=${apply})`);
  console.log('═'.repeat(60));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let fixedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`\n[${i + 1}/${problems.length}] ${problem.id}`);
    console.log(`   📌 ${problem.title}`);
    console.log('─'.repeat(50));

    const result = await fixProblem(problem);

    if (!result) {
      errorCount++;
      continue;
    }

    totalInputTokens += result.tokens.input;
    totalOutputTokens += result.tokens.output;

    console.log(`   📋 ${result.result.status}: ${result.result.summary}`);

    if (result.result.status === 'needs_fixes' && result.result.fixes) {
      if (apply) {
        const success = await applyFixes(problem.id, result.result.fixes);
        if (success) fixedCount++;
        else errorCount++;
      } else {
        fixedCount++;
      }
    }
  }

  const inputCost = (totalInputTokens / 1000000) * 3;
  const outputCost = (totalOutputTokens / 1000000) * 15;
  const totalCost = inputCost + outputCost;
  const batchCost = totalCost * 0.5;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`🔧 ${apply ? 'Fixed' : 'Needs fixes'}: ${fixedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`💰 COST BREAKDOWN:`);
  console.log(`   Input:  ${totalInputTokens.toLocaleString()} tokens × $3.00/1M  = $${inputCost.toFixed(4)}`);
  console.log(`   Output: ${totalOutputTokens.toLocaleString()} tokens × $15.00/1M = $${outputCost.toFixed(4)}`);
  console.log(`   Live API Total:  $${totalCost.toFixed(4)}`);
  console.log(`   Batch API Total: $${batchCost.toFixed(4)} (50% off)`);
  console.log(`${'═'.repeat(60)}`);
}

// ==================== BATCH MODE ====================

async function createBatch(limit) {
  const problems = await fetchFailedProblems(limit);

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
        const success = await applyFixes(problemId, parsed.fixes);
        if (success) fixedCount++;
        else errorCount++;
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
    console.log('  --process-results <batch_id>  Process & apply batch results\n');
    process.exit(1);
  }

  const command = args[0];
  const param = args[1];

  switch (command) {
    case '--list-failed':
      await listFailed(param ? parseInt(param) : null);
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
      await runFixAll(param ? parseInt(param) : null, false);
      break;

    case '--fix-apply-all':
      await runFixAll(param ? parseInt(param) : null, true);
      break;

    case '--create-batch':
      await createBatch(param ? parseInt(param) : null);
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
