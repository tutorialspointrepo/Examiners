/**
 * Coding Problems Validator
 * Reads problems from Firebase, validates code solutions and test cases via Claude AI,
 * and merges fixes back into the database.
 * 
 * Usage:
 *   TEST MODE (validate single problem):
 *     node validate_coding_problems.js --test <problem_id>
 *     Example: node validate_coding_problems.js --test two-sum
 * 
 *   BATCH MODE (validate multiple problems):
 *     Step 1: node validate_coding_problems.js --create-batch [limit]
 *     Step 2: node validate_coding_problems.js --check-batch <batch_id>
 *     Step 3: node validate_coding_problems.js --process-results <batch_id>
 * 
 *   LIST MODE:
 *     node validate_coding_problems.js --list [limit]  - List problems in database
 *     node validate_coding_problems.js --list-batches  - List all batches
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

// ==================== VALIDATION PROMPT ====================

function generateValidationPrompt(problemData) {
  const {
    title,
    description,
    descriptionText,
    approaches,
    defaultCode,
    testCases,
    examples,
    paramOrder,
    constraints
  } = problemData;

  // Build the extracted data JSON for validation
  const extractedData = {
    title,
    description: description || descriptionText,
    paramOrder: paramOrder || [],
    constraints: constraints || [],
    approaches: {},
    defaultCode: defaultCode || {},
    testCases: testCases || [],
    examples: examples || []
  };

  // Extract only code from approaches
  if (approaches) {
    for (const [approachName, approachData] of Object.entries(approaches)) {
      if (approachData && approachData.code) {
        extractedData.approaches[approachName] = {
          code: approachData.code
        };
      }
    }
  }

  return `You are an expert code validator. I need you to thoroughly verify all code solutions, test cases, and examples for a coding problem.

**PROBLEM DATA:**
\`\`\`json
${JSON.stringify(extractedData, null, 2)}
\`\`\`

**CRITICAL RULE:** Only return fixes for the following fields if corrections are needed:
- \`approaches.[name].code.[language]\` - if code has bugs
- \`defaultCode.[language]\` - if starter code has bugs
- \`testCases.[index].input\` - if input is wrong
- \`testCases.[index].expected\` - if expected output is wrong
- \`examples.[index].input\` - if example input is wrong
- \`examples.[index].output\` - if example output is wrong
- \`examples.[index].explanation\` - if explanation is inaccurate

---

## TASK 1: Understand the Problem

From the provided data, understand:
- Problem description
- Input/output format from examples
- Constraints
- Parameters (paramOrder field)

---

## TASK 2: Verify Examples Against Problem Statement

For EACH example:
1. **Verify the output is correct** - Manually work through the example input step-by-step
2. **Verify the explanation is accurate** - Check that the explanation matches what actually happens
3. **Check for inconsistencies** - Ensure the explanation doesn't list wrong substrings, wrong counts, or wrong positions

---

## TASK 3: Verify Test Cases Against Problem Statement

For each test case:
- Is the expected output correct according to the problem rules?
- Manually work through each test case step-by-step to verify the expected output.

**CRITICAL - MULTIPLE VALID ANSWERS:**
Some problems accept multiple valid answers (e.g., graph coloring, any valid permutation, etc.). 
For such problems:
1. The \`expected\` value MUST match what the PROVIDED CODE actually produces
2. Do NOT just verify that \`expected\` is "a valid answer"
3. Mentally execute the greedy/primary approach code and check what it outputs
4. If the code outputs \`[1,2,2,2]\` but expected says \`[1,2,3,4]\`, FIX expected to \`[1,2,2,2]\`
5. The test framework does EXACT STRING MATCHING, so expected must match code output exactly

---

## TASK 4: Cross-Validate Examples and Test Cases

Check for consistency between examples and testCases:
- If an example input also appears in test cases, do the outputs match?

---

## TASK 5: Verify All Code Solutions

For EACH language (Python, JavaScript, C++, C, Java, Go) and EACH approach:

### 5.1 Static Code Analysis
- Does it have all required headers/imports?
- Does main() read from stdin correctly (not hardcoded)?
- Are there syntax errors?
- Is the algorithm logic correct?

### 5.2 Mental Execution
Mentally execute each code against ALL test cases and verify outputs match.

### 5.3 CRITICAL - Sync Expected with Code Output
For EACH test case, mentally run the greedy/optimized approach code:
1. Trace through the algorithm step by step
2. Determine the EXACT output the code produces
3. If code output differs from \`expected\`, UPDATE \`expected\` to match code output
4. This is especially important for problems with multiple valid answers!

Example:
- Test input: n=4, paths=[[1,2],[1,3],[1,4]]
- Code (greedy) produces: [1,2,2,2]
- Expected says: [1,2,3,4]
- FIX: Change expected to [1,2,2,2]

---

## TASK 6: Verify Default/Starter Code

Check defaultCode for each language:
- Does it have proper structure?
- Does it read input from stdin properly?
- Is the function signature correct?

---

## TASK 7: Generate Fix Response

**IMPORTANT:** Return a JSON response with ONLY the fields that need fixing.

If EVERYTHING is correct, return:
\`\`\`json
{
  "status": "valid",
  "summary": "All code solutions, test cases, and examples are correct.",
  "fixes": null
}
\`\`\`

If there are issues, return:
\`\`\`json
{
  "status": "needs_fixes",
  "summary": "Brief description of what was wrong",
  "fixes": {
    "approaches": {
      "approach-name": {
        "code": {
          "python": "FULL CORRECTED CODE HERE",
          "javascript": "FULL CORRECTED CODE HERE"
        }
      }
    },
    "defaultCode": {
      "python": "FULL CORRECTED CODE HERE"
    },
    "testCases": [
      {
        "index": 2,
        "expected": "CORRECTED VALUE"
      }
    ],
    "examples": [
      {
        "index": 0,
        "output": "CORRECTED VALUE",
        "explanation": "CORRECTED EXPLANATION"
      }
    ]
  },
  "details": [
    {
      "field": "testCases[2].expected",
      "issue": "Expected was 7, but correct answer is 6",
      "fix": "Changed to 6"
    }
  ]
}
\`\`\`

**RULES:**
1. Only include fields that need fixing in the "fixes" object
2. For code fixes, provide the COMPLETE corrected code (not just the changed lines)
3. For testCases and examples fixes, specify the index (0-based) and only the fields that need changing
4. Be thorough - actually trace through the algorithm mentally for each test case
5. Return ONLY valid JSON, no markdown formatting around it

Begin analysis now.`;
}

// ==================== FETCH PROBLEMS FROM FIREBASE ====================

async function fetchProblemsFromFirebase(limit = null, problemId = null) {
  initFirebase();
  
  const problems = [];
  
  try {
    let query = db.collection(COLLECTION_NAME)
      .where('problemType', '==', 'coding');
    
    if (problemId) {
      // Fetch specific problem
      const docRef = db.collection(COLLECTION_NAME).doc(problemId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.error(`❌ Problem not found: ${problemId}`);
        return [];
      }
      
      const data = doc.data();
      if (data.problemType !== 'coding') {
        console.error(`❌ Problem ${problemId} is not a coding problem (type: ${data.problemType})`);
        return [];
      }
      
      problems.push({
        id: doc.id,
        ...data
      });
    } else {
      // Fetch multiple problems
      if (limit) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      
      snapshot.forEach(doc => {
        problems.push({
          id: doc.id,
          ...doc.data()
        });
      });
    }
    
    return problems;
  } catch (error) {
    console.error('❌ Error fetching from Firebase:', error.message);
    return [];
  }
}

async function fetchProblemsBySlugList(slugList) {
  initFirebase();
  
  const problems = [];
  const notFound = [];
  const notCoding = [];
  
  console.log(`📥 Fetching ${slugList.length} problems from Firebase...`);
  
  for (const slug of slugList) {
    try {
      const docRef = db.collection(COLLECTION_NAME).doc(slug);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        notFound.push(slug);
        continue;
      }
      
      const data = doc.data();
      if (data.problemType !== 'coding') {
        notCoding.push(slug);
        continue;
      }
      
      problems.push({
        id: doc.id,
        ...data
      });
    } catch (error) {
      console.error(`   ❌ Error fetching ${slug}: ${error.message}`);
      notFound.push(slug);
    }
  }
  
  if (notFound.length > 0) {
    console.log(`\n⚠️  Not found (${notFound.length}): ${notFound.join(', ')}`);
  }
  if (notCoding.length > 0) {
    console.log(`\n⚠️  Not coding problems (${notCoding.length}): ${notCoding.join(', ')}`);
  }
  
  console.log(`✅ Found ${problems.length} coding problems\n`);
  
  return problems;
}

// ==================== EXTRACT VALIDATION DATA ====================

function extractValidationData(problem) {
  return {
    id: problem.id,
    title: problem.title,
    description: problem.description || problem.descriptionText,
    descriptionText: problem.descriptionText,
    paramOrder: problem.paramOrder || [],
    constraints: problem.constraints || [],
    approaches: problem.approaches || {},
    defaultCode: problem.defaultCode || {},
    testCases: problem.testCases || [],
    examples: problem.examples || []
  };
}

// ==================== VALIDATE SINGLE PROBLEM ====================

async function validateProblem(problem) {
  const validationData = extractValidationData(problem);
  const prompt = generateValidationPrompt(validationData);
  
  try {
    console.log(`    🔍 Sending to Claude for validation...`);
    
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
    
    // Calculate cost (Claude Sonnet: $3/1M input, $15/1M output)
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    const totalCost = inputCost + outputCost;
    
    console.log(`    📊 Tokens: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out`);
    console.log(`    💰 Cost: $${totalCost.toFixed(4)} (in: $${inputCost.toFixed(4)}, out: $${outputCost.toFixed(4)})`);
    
    // Parse JSON response
    let result = null;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      // Try to extract JSON from markdown code block
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1]);
        } catch (e2) {
          // Try to find raw JSON
          const startIdx = responseText.indexOf('{');
          const endIdx = responseText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            try {
              result = JSON.parse(responseText.substring(startIdx, endIdx + 1));
            } catch (e3) {
              console.error(`    ❌ Failed to parse validation response`);
              return null;
            }
          }
        }
      }
    }
    
    return {
      problemId: problem.id,
      result,
      tokens: { input: inputTokens, output: outputTokens },
      cost: { input: inputCost, output: outputCost, total: totalCost }
    };
    
  } catch (error) {
    console.error(`    ❌ Validation error: ${error.message}`);
    return null;
  }
}

// ==================== APPLY FIXES TO FIREBASE ====================

async function applyFixes(problemId, fixes) {
  if (!fixes) {
    console.log(`    ℹ️  No fixes to apply for ${problemId}`);
    return true;
  }
  
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
    
    // Apply defaultCode fixes
    if (fixes.defaultCode) {
      updates.defaultCode = {
        ...currentData.defaultCode,
        ...fixes.defaultCode
      };
    }
    
    // Apply testCases fixes
    if (fixes.testCases && fixes.testCases.length > 0) {
      const updatedTestCases = [...(currentData.testCases || [])];
      
      for (const fix of fixes.testCases) {
        const idx = fix.index;
        if (idx >= 0 && idx < updatedTestCases.length) {
          if (fix.input !== undefined) {
            updatedTestCases[idx].input = fix.input;
          }
          if (fix.expected !== undefined) {
            updatedTestCases[idx].expected = fix.expected;
          }
        }
      }
      
      updates.testCases = updatedTestCases;
    }
    
    // Apply examples fixes
    if (fixes.examples && fixes.examples.length > 0) {
      const updatedExamples = [...(currentData.examples || [])];
      
      for (const fix of fixes.examples) {
        const idx = fix.index;
        if (idx >= 0 && idx < updatedExamples.length) {
          if (fix.input !== undefined) {
            updatedExamples[idx].input = fix.input;
          }
          if (fix.output !== undefined) {
            updatedExamples[idx].output = fix.output;
          }
          if (fix.explanation !== undefined) {
            updatedExamples[idx].explanation = fix.explanation;
          }
        }
      }
      
      updates.examples = updatedExamples;
    }
    
    // Add update timestamp
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates._lastValidation = {
      validatedAt: new Date().toISOString(),
      fixesApplied: true
    };
    
    // Apply updates
    if (Object.keys(updates).length > 1) { // More than just timestamp
      await docRef.update(updates);
      console.log(`    ✅ Applied fixes to ${problemId}`);
      return true;
    } else {
      console.log(`    ℹ️  No actual changes to apply`);
      return true;
    }
    
  } catch (error) {
    console.error(`    ❌ Error applying fixes: ${error.message}`);
    return false;
  }
}

// ==================== TEST MODE ====================

async function runTestMode(problemId) {
  initFirebase();
  
  console.log(`\n🔍 Validating problem: ${problemId}`);
  console.log('─'.repeat(50));
  
  const problems = await fetchProblemsFromFirebase(null, problemId);
  
  if (problems.length === 0) {
    console.error('❌ Problem not found or not a coding problem');
    return;
  }
  
  const problem = problems[0];
  console.log(`📌 Title: ${problem.title}`);
  console.log(`📌 Approaches: ${Object.keys(problem.approaches || {}).join(', ')}`);
  console.log(`📌 Test Cases: ${(problem.testCases || []).length}`);
  console.log(`📌 Examples: ${(problem.examples || []).length}`);
  
  const validationResult = await validateProblem(problem);
  
  if (!validationResult) {
    console.error('❌ Validation failed');
    return;
  }
  
  const { result } = validationResult;
  
  console.log(`\n📋 Validation Result:`);
  console.log(`    Status: ${result.status}`);
  console.log(`    Summary: ${result.summary}`);
  
  if (result.status === 'needs_fixes') {
    console.log(`\n📝 Fixes needed:`);
    
    if (result.details) {
      result.details.forEach((detail, i) => {
        console.log(`    ${i + 1}. ${detail.field}: ${detail.issue}`);
      });
    }
    
    // Ask for confirmation before applying
    console.log(`\n⚠️  Would you like to apply these fixes? (Run with --apply flag)`);
    
    // Save fixes to file for review
    const fixesFile = `fixes_${problemId}.json`;
    fs.writeFileSync(fixesFile, JSON.stringify(result, null, 2));
    console.log(`📁 Fixes saved to: ${fixesFile}`);
    
  } else {
    console.log(`\n✅ All validations passed!`);
  }
}

// ==================== TEST AND APPLY MODE ====================

async function runTestAndApply(problemId) {
  initFirebase();
  
  console.log(`\n🔍 Validating and applying fixes for: ${problemId}`);
  console.log('─'.repeat(50));
  
  const problems = await fetchProblemsFromFirebase(null, problemId);
  
  if (problems.length === 0) {
    console.error('❌ Problem not found or not a coding problem');
    return;
  }
  
  const problem = problems[0];
  console.log(`📌 Title: ${problem.title}`);
  
  const validationResult = await validateProblem(problem);
  
  if (!validationResult) {
    console.error('❌ Validation failed');
    return;
  }
  
  const { result } = validationResult;
  
  console.log(`\n📋 Validation Result: ${result.status}`);
  console.log(`    Summary: ${result.summary}`);
  
  if (result.status === 'needs_fixes' && result.fixes) {
    console.log(`\n🔧 Applying fixes...`);
    const success = await applyFixes(problemId, result.fixes);
    
    if (success) {
      console.log(`✅ Fixes applied successfully!`);
    } else {
      console.log(`❌ Failed to apply fixes`);
    }
  } else {
    console.log(`\n✅ No fixes needed!`);
  }
}

async function runTestListMode(slugList, applyFixes = false) {
  initFirebase();
  
  console.log(`\n🔍 Validating ${slugList.length} problems (apply=${applyFixes})`);
  console.log('═'.repeat(60));
  
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let validCount = 0;
  let fixedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < slugList.length; i++) {
    const slug = slugList[i];
    console.log(`\n[${i + 1}/${slugList.length}] ${slug}`);
    console.log('─'.repeat(50));
    
    const problems = await fetchProblemsFromFirebase(null, slug);
    
    if (problems.length === 0) {
      console.log(`   ❌ Problem not found or not a coding problem`);
      errorCount++;
      continue;
    }
    
    const problem = problems[0];
    console.log(`   📌 Title: ${problem.title}`);
    console.log(`   📌 Approaches: ${Object.keys(problem.approaches || {}).join(', ')}`);
    console.log(`   📌 Test Cases: ${(problem.testCases || []).length}`);
    
    const validationResult = await validateProblem(problem);
    
    if (!validationResult) {
      console.log(`   ❌ Validation failed`);
      errorCount++;
      continue;
    }
    
    const { result, tokens, cost } = validationResult;
    totalInputTokens += tokens.input;
    totalOutputTokens += tokens.output;
    
    console.log(`\n   📋 Status: ${result.status}`);
    console.log(`   📝 Summary: ${result.summary}`);
    
    if (result.status === 'valid') {
      validCount++;
    } else if (result.status === 'needs_fixes') {
      if (result.details) {
        console.log(`   🔧 Issues found:`);
        result.details.forEach((detail, idx) => {
          console.log(`      ${idx + 1}. ${detail.field}: ${detail.issue}`);
        });
      }
      
      if (applyFixes && result.fixes) {
        console.log(`\n   🔧 Applying fixes...`);
        const success = await applyFixesToFirebase(slug, result.fixes);
        if (success) {
          console.log(`   ✅ Fixes applied!`);
          fixedCount++;
        } else {
          console.log(`   ❌ Failed to apply fixes`);
          errorCount++;
        }
      } else {
        fixedCount++; // Count as needing fixes
      }
    }
  }
  
  // Calculate costs (Real-time API, no discount)
  const inputCost = (totalInputTokens / 1000000) * 3;
  const outputCost = (totalOutputTokens / 1000000) * 15;
  const totalCost = inputCost + outputCost;
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`✅ Valid (no changes needed): ${validCount}`);
  console.log(`🔧 ${applyFixes ? 'Fixed' : 'Needs fixes'}: ${fixedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`💰 TOKEN USAGE & COST`);
  console.log(`📥 Input:  ${totalInputTokens.toLocaleString()} tokens`);
  console.log(`📤 Output: ${totalOutputTokens.toLocaleString()} tokens`);
  console.log(`💵 Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`${'═'.repeat(60)}`);
}

async function applyFixesToFirebase(problemId, fixes) {
  return await applyFixes(problemId, fixes);
}

// ==================== LIST PROBLEMS ====================

async function listProblems(limit = 20) {
  initFirebase();
  
  console.log(`\n📋 Listing coding problems (limit: ${limit}):`);
  console.log('─'.repeat(70));
  
  const problems = await fetchProblemsFromFirebase(limit);
  
  console.log(`Found ${problems.length} coding problems:\n`);
  
  problems.forEach((p, i) => {
    const approachCount = Object.keys(p.approaches || {}).length;
    const testCount = (p.testCases || []).length;
    const exampleCount = (p.examples || []).length;
    console.log(`${i + 1}. ${p.id}`);
    console.log(`   Title: ${p.title}`);
    console.log(`   Approaches: ${approachCount}, Tests: ${testCount}, Examples: ${exampleCount}`);
    console.log('');
  });
}

// ==================== BATCH MODE ====================

async function createValidationBatch(limit = null) {
  initFirebase();
  
  console.log(`\n📦 Creating validation batch...`);
  
  const problems = await fetchProblemsFromFirebase(limit);
  
  if (problems.length === 0) {
    console.error('❌ No coding problems found');
    return;
  }
  
  console.log(`📊 Found ${problems.length} coding problems to validate`);
  
  // Prepare batch requests
  const requests = problems.map((problem, index) => {
    const validationData = extractValidationData(problem);
    const prompt = generateValidationPrompt(validationData);
    
    return {
      custom_id: problem.id,
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [
          { role: 'user', content: prompt }
        ]
      }
    };
  });
  
  console.log(`📝 Prepared ${requests.length} validation requests`);
  
  try {
    const batch = await anthropic.messages.batches.create({
      requests: requests
    });
    
    console.log(`\n✅ Batch created successfully!`);
    console.log(`📋 Batch ID: ${batch.id}`);
    console.log(`📊 Status: ${batch.processing_status}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Check status: node validate_coding_problems.js --check-batch ${batch.id}`);
    console.log(`  2. Process results: node validate_coding_problems.js --process-results ${batch.id}`);
    
    // Save batch info
    const batchInfo = {
      batchId: batch.id,
      createdAt: new Date().toISOString(),
      problemCount: problems.length,
      problemIds: problems.map(p => p.id)
    };
    
    fs.writeFileSync(`validation_batch_${batch.id}.json`, JSON.stringify(batchInfo, null, 2));
    
    return batch.id;
    
  } catch (error) {
    console.error(`❌ Error creating batch: ${error.message}`);
    return null;
  }
}

async function createValidationBatchFromSlugs(slugList) {
  initFirebase();
  
  console.log(`\n📦 Creating validation batch for ${slugList.length} specific problems...`);
  
  const problems = await fetchProblemsBySlugList(slugList);
  
  if (problems.length === 0) {
    console.error('❌ No valid coding problems found');
    return null;
  }
  
  // Prepare batch requests
  const requests = problems.map((problem, index) => {
    const validationData = extractValidationData(problem);
    const prompt = generateValidationPrompt(validationData);
    
    // Truncate custom_id to max 64 characters (API limit)
    let customId = problem.id;
    if (customId.length > 64) {
      customId = customId.substring(0, 58) + '-' + index;
    }
    
    return {
      custom_id: customId,
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [
          { role: 'user', content: prompt }
        ]
      }
    };
  });
  
  console.log(`📝 Prepared ${requests.length} validation requests`);
  
  try {
    const batch = await anthropic.messages.batches.create({
      requests: requests
    });
    
    console.log(`\n✅ Batch created successfully!`);
    console.log(`📋 Batch ID: ${batch.id}`);
    console.log(`📊 Status: ${batch.processing_status}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Check status: node validate_coding_problems.js --check-batch ${batch.id}`);
    console.log(`  2. Process results: node validate_coding_problems.js --process-results ${batch.id}`);
    
    // Save batch info with mapping of customId to actual problemId
    const idMapping = {};
    requests.forEach((req, idx) => {
      idMapping[req.custom_id] = problems[idx].id;
    });
    
    const batchInfo = {
      batchId: batch.id,
      createdAt: new Date().toISOString(),
      problemCount: problems.length,
      problemIds: problems.map(p => p.id),
      idMapping: idMapping  // Map truncated IDs back to full IDs
    };
    
    fs.writeFileSync(`validation_batch_${batch.id}.json`, JSON.stringify(batchInfo, null, 2));
    
    return batch.id;
    
  } catch (error) {
    console.error(`❌ Error creating batch: ${error.message}`);
    return null;
  }
}

async function checkBatchStatus(batchId) {
  try {
    const batch = await anthropic.messages.batches.retrieve(batchId);
    
    console.log(`\n📋 Batch Status: ${batchId}`);
    console.log('─'.repeat(50));
    console.log(`Status: ${batch.processing_status}`);
    console.log(`Created: ${batch.created_at}`);
    
    if (batch.request_counts) {
      console.log(`\nRequest Counts:`);
      console.log(`  Processing: ${batch.request_counts.processing}`);
      console.log(`  Succeeded: ${batch.request_counts.succeeded}`);
      console.log(`  Errored: ${batch.request_counts.errored}`);
      console.log(`  Canceled: ${batch.request_counts.canceled}`);
      console.log(`  Expired: ${batch.request_counts.expired}`);
    }
    
    if (batch.processing_status === 'ended') {
      console.log(`\n✅ Batch complete! Run:`);
      console.log(`   node validate_coding_problems.js --process-results ${batchId}`);
    }
    
    return batch;
    
  } catch (error) {
    console.error(`❌ Error checking batch: ${error.message}`);
    return null;
  }
}

async function processValidationResults(batchId) {
  initFirebase();
  
  console.log(`\n📦 Processing validation results for batch: ${batchId}`);
  console.log('─'.repeat(50));
  
  // Load batch info to get ID mapping
  let idMapping = {};
  const batchInfoFile = `validation_batch_${batchId}.json`;
  if (fs.existsSync(batchInfoFile)) {
    try {
      const batchInfo = JSON.parse(fs.readFileSync(batchInfoFile, 'utf8'));
      idMapping = batchInfo.idMapping || {};
      console.log(`📄 Loaded ID mapping for ${Object.keys(idMapping).length} problems`);
    } catch (e) {
      console.log(`⚠️  Could not load batch info file, using custom_id directly`);
    }
  }
  
  let validCount = 0;
  let fixedCount = 0;
  let errorCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  const allResults = [];
  
  try {
    const results = await anthropic.messages.batches.results(batchId);
    
    for await (const result of results) {
      const customId = result.custom_id;
      // Use ID mapping to get actual problem ID (for truncated IDs)
      const problemId = idMapping[customId] || customId;
      
      console.log(`\n[${problemId}]`);
      
      if (result.result.type === 'succeeded') {
        const message = result.result.message;
        const responseText = message.content[0]?.text || '';
        
        // Track token usage
        if (message.usage) {
          totalInputTokens += message.usage.input_tokens || 0;
          totalOutputTokens += message.usage.output_tokens || 0;
        }
        
        let validationResult = null;
        try {
          validationResult = JSON.parse(responseText);
        } catch (e) {
          const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            try {
              validationResult = JSON.parse(jsonMatch[1]);
            } catch (e2) {
              const startIdx = responseText.indexOf('{');
              const endIdx = responseText.lastIndexOf('}');
              if (startIdx !== -1 && endIdx !== -1) {
                try {
                  validationResult = JSON.parse(responseText.substring(startIdx, endIdx + 1));
                } catch (e3) {
                  console.log(`   ❌ Failed to parse response`);
                  errorCount++;
                  continue;
                }
              }
            }
          }
        }
        
        if (validationResult) {
          allResults.push({
            problemId,
            status: validationResult.status,
            summary: validationResult.summary,
            fixes: validationResult.fixes,
            details: validationResult.details
          });
          
          if (validationResult.status === 'valid') {
            console.log(`   ✅ Valid`);
            validCount++;
          } else if (validationResult.status === 'needs_fixes') {
            console.log(`   ⚠️  Needs fixes: ${validationResult.summary}`);
            
            // Apply fixes
            if (validationResult.fixes) {
              const success = await applyFixes(problemId, validationResult.fixes);
              if (success) {
                fixedCount++;
              } else {
                errorCount++;
              }
            }
          }
        } else {
          console.log(`   ❌ Invalid response format`);
          errorCount++;
        }
        
      } else {
        console.log(`   ❌ Error: ${result.result.error?.message || 'Unknown'}`);
        errorCount++;
      }
    }
    
  } catch (error) {
    console.error(`❌ Error processing results: ${error.message}`);
  }
  
  // Save results summary
  const summaryFile = `validation_results_${batchId}.json`;
  fs.writeFileSync(summaryFile, JSON.stringify(allResults, null, 2));
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 VALIDATION SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Valid (no changes needed): ${validCount}`);
  console.log(`🔧 Fixed: ${fixedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`${'─'.repeat(50)}`);
  
  // Calculate costs (Batch API = 50% off)
  const inputCost = (totalInputTokens / 1000000) * 1.5;  // $3 * 0.5 = $1.5
  const outputCost = (totalOutputTokens / 1000000) * 7.5; // $15 * 0.5 = $7.5
  const totalCost = inputCost + outputCost;
  const standardCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
  const savedAmount = standardCost - totalCost;
  
  console.log(`💰 TOKEN USAGE & COST (50% Batch Discount)`);
  console.log(`📥 Input:  ${totalInputTokens.toLocaleString()} tokens`);
  console.log(`📤 Output: ${totalOutputTokens.toLocaleString()} tokens`);
  console.log(`💵 Total Cost:  $${totalCost.toFixed(4)}`);
  console.log(`💰 Saved:  $${savedAmount.toFixed(4)} (vs standard API)`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\n📁 Results saved to: ${summaryFile}`);
}

async function listBatches() {
  try {
    const batches = await anthropic.messages.batches.list({ limit: 10 });
    
    console.log(`\n📋 Recent Batches:`);
    console.log('─'.repeat(70));
    
    for (const batch of batches.data) {
      console.log(`\nID: ${batch.id}`);
      console.log(`  Status: ${batch.processing_status}`);
      console.log(`  Created: ${batch.created_at}`);
      if (batch.request_counts) {
        console.log(`  Succeeded: ${batch.request_counts.succeeded}, Errored: ${batch.request_counts.errored}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error listing batches: ${error.message}`);
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('========================================');
    console.log('🔍 Coding Problems Validator');
    console.log('   Validates code, test cases, examples');
    console.log('========================================\n');
    console.log('Commands:\n');
    console.log('  TEST MODE (single problem):');
    console.log('    node validate_coding_problems.js --test <problem_id>');
    console.log('    node validate_coding_problems.js --test-apply <problem_id>  (validate & apply)\n');
    console.log('  TEST LIST MODE (test first N from file):');
    console.log('    node validate_coding_problems.js --test-list <file.txt> [count]       (validate only)');
    console.log('    node validate_coding_problems.js --test-apply-list <file.txt> [count] (validate & apply)\n');
    console.log('  BATCH MODE (50% cheaper, for large sets):');
    console.log('    node validate_coding_problems.js --create-batch [limit]');
    console.log('    node validate_coding_problems.js --from-file <slugs_file.txt>');
    console.log('    node validate_coding_problems.js --check-batch <batch_id>');
    console.log('    node validate_coding_problems.js --process-results <batch_id>\n');
    console.log('  OTHER:');
    console.log('    node validate_coding_problems.js --list [limit]');
    console.log('    node validate_coding_problems.js --list-batches\n');
    process.exit(1);
  }
  
  const command = args[0];
  const param = args[1];
  
  switch (command) {
    case '--test':
      if (!param) {
        console.error('❌ Please provide a problem ID');
        console.log('Example: node validate_coding_problems.js --test two-sum');
        process.exit(1);
      }
      await runTestMode(param);
      break;
      
    case '--test-apply':
      if (!param) {
        console.error('❌ Please provide a problem ID');
        process.exit(1);
      }
      await runTestAndApply(param);
      break;
      
    case '--test-list':
      if (!param) {
        console.error('❌ Please provide a file path');
        console.log('Example: node validate_coding_problems.js --test-list slugs.txt [count]');
        process.exit(1);
      }
      if (!fs.existsSync(param)) {
        console.error(`❌ File not found: ${param}`);
        process.exit(1);
      }
      const testSlugs = fs.readFileSync(param, 'utf8')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('#'));
      const testLimit = args[2] ? parseInt(args[2]) : 2;
      console.log(`📄 Testing first ${testLimit} of ${testSlugs.length} slugs from ${param}`);
      await runTestListMode(testSlugs.slice(0, testLimit), false);
      break;
      
    case '--test-apply-list':
      if (!param) {
        console.error('❌ Please provide a file path');
        console.log('Example: node validate_coding_problems.js --test-apply-list slugs.txt [count]');
        process.exit(1);
      }
      if (!fs.existsSync(param)) {
        console.error(`❌ File not found: ${param}`);
        process.exit(1);
      }
      const applySlugs = fs.readFileSync(param, 'utf8')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('#'));
      const applyLimit = args[2] ? parseInt(args[2]) : 2;
      console.log(`📄 Testing & applying first ${applyLimit} of ${applySlugs.length} slugs from ${param}`);
      await runTestListMode(applySlugs.slice(0, applyLimit), true);
      break;
      
    case '--list':
      const listLimit = parseInt(param) || 20;
      await listProblems(listLimit);
      break;
      
    case '--list-batches':
      await listBatches();
      break;
      
    case '--create-batch':
      const batchLimit = param ? parseInt(param) : null;
      await createValidationBatch(batchLimit);
      break;
      
    case '--from-file':
      if (!param) {
        console.error('❌ Please provide a file path');
        console.log('Example: node validate_coding_problems.js --from-file slugs.txt');
        process.exit(1);
      }
      if (!fs.existsSync(param)) {
        console.error(`❌ File not found: ${param}`);
        process.exit(1);
      }
      const slugList = fs.readFileSync(param, 'utf8')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('#'));
      console.log(`📄 Loaded ${slugList.length} slugs from ${param}`);
      await createValidationBatchFromSlugs(slugList);
      break;
      
    case '--check-batch':
      if (!param) {
        console.error('❌ Please provide a batch ID');
        process.exit(1);
      }
      await checkBatchStatus(param);
      break;
      
    case '--process-results':
      if (!param) {
        console.error('❌ Please provide a batch ID');
        process.exit(1);
      }
      await processValidationResults(param);
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
