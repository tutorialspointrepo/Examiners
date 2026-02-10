/**
 * Fix/Generate Analogies
 * Reads problems from Firebase, sends problem description + solution approaches
 * to Claude AI to generate relatable day-to-day analogies, then updates
 * ONLY the analogy field in Firebase.
 *
 * Usage:
 *   SINGLE PROBLEM:
 *     node fix_analogy.js --test <problem_id>           Preview analogy (no apply)
 *     node fix_analogy.js --apply <problem_id>          Generate & apply analogy
 *
 *   LIVE MODE (sequential, full price):
 *     node fix_analogy.js --list [limit]                List problems needing analogy fix
 *     node fix_analogy.js --fix-all [limit]             Preview all (no apply)
 *     node fix_analogy.js --fix-apply-all [limit]       Generate & apply all
 *
 *   BATCH MODE (50% cheaper):
 *     node fix_analogy.js --create-batch [limit]        Create batch job
 *     node fix_analogy.js --check-batch <batch_id>      Check batch status
 *     node fix_analogy.js --process-results <batch_id>  Process & apply batch results
 *
 *   OPTIONS:
 *     --skip <n>                                        Skip first n problems
 *     --force                                           Regenerate even if analogy exists
 */

const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const ANTHROPIC_API_KEY = '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';
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';
const MODEL = 'claude-sonnet-4-20250514';

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

// ==================== FIREBASE HELPERS ====================

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

async function fetchProblemsNeedingAnalogy(limit, skip = 0, force = false) {
  initFirebase();
  try {
    let query = db.collection(COLLECTION_NAME);

    // Fetch all problems (we'll filter in memory since analogy checks are complex)
    const snapshot = await query.get();
    const problems = [];

    snapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      
      if (force) {
        // Force mode: include all problems that have approaches
        if (data.approaches && Object.keys(data.approaches).length > 0) {
          problems.push(data);
        }
      } else {
        // Normal mode: only problems with missing/bad analogies
        if (needsAnalogyFix(data)) {
          problems.push(data);
        }
      }
    });

    // Apply skip and limit
    const skipped = problems.slice(skip);
    return limit ? skipped.slice(0, limit) : skipped;
  } catch (error) {
    console.error(`❌ Error fetching problems: ${error.message}`);
    return [];
  }
}

/**
 * Check if a problem needs analogy fix:
 * - No analogy at all
 * - No approaches array in analogy
 * - Has old format (bruteForce/optimal/twoPass flat keys)
 * - Approaches contain N/A
 * - Analogy approaches don't match solution approaches
 */
function needsAnalogyFix(problem) {
  if (!problem.approaches || Object.keys(problem.approaches).length === 0) return false;
  
  const analogy = problem.analogy;
  
  // No analogy at all
  if (!analogy) return true;
  
  // No approaches array (old format or missing)
  if (!Array.isArray(analogy.approaches) || analogy.approaches.length === 0) {
    // Check if it has old flat format keys
    const skipFields = ['icon', 'title', 'description', 'keyInsight', 'scenario', 'approaches'];
    const hasOldKeys = Object.keys(analogy).some(k => !skipFields.includes(k) && typeof analogy[k] === 'string');
    if (hasOldKeys) return true;
    // No approaches at all
    return true;
  }
  
  // Has N/A content
  const hasNA = analogy.approaches.some(a => 
    !a.content || a.content.trim().toLowerCase() === 'n/a'
  );
  if (hasNA) return true;

  // Approaches are too short (just 1-liner algorithm descriptions, not relatable)
  const hasTooShort = analogy.approaches.some(a => 
    a.content && a.content.trim().length < 100
  );
  if (hasTooShort) return true;
  
  return false;
}

// ==================== PROMPT GENERATION ====================

function generateAnalogyPrompt(problem) {
  const approachDetails = {};
  const approachList = [];
  for (const [key, data] of Object.entries(problem.approaches || {})) {
    const title = data.title || data.name || key;
    approachDetails[key] = {
      title,
      description: data.description || '',
      summary: data.summary || '',
      steps: data.steps || [],
      complexity: data.complexity || {}
    };
    approachList.push({ key, title });
  }

  const promptData = {
    title: problem.title,
    description: problem.description || problem.descriptionText || '',
    category: problem.category || '',
    tags: problem.tags || [],
    difficulty: problem.difficulty || problem.level || '',
    constraints: problem.constraints || [],
    examples: (problem.examples || []).slice(0, 3),
    approaches: approachDetails
  };

  // Build explicit approach list for the prompt
  const approachListStr = approachList.map((a, i) => `   ${i + 1}. "${a.title}" (key: ${a.key})`).join('\n');

  return `You are an expert educator who explains complex algorithms through relatable, day-to-day analogies that students can easily connect with.

**PROBLEM DATA:**
\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\`

## REQUIRED APPROACHES — Generate an analogy for EACH of these:
${approachListStr}

Total: ${approachList.length} approaches. You MUST return EXACTLY ${approachList.length} entries in the "approaches" array.

## Your Task:
Generate a rich, relatable real-world analogy for this coding problem. The analogy should help students understand WHAT the problem is about and HOW each approach works — using everyday scenarios they experience.

## Rules:
1. **title** — A catchy, relatable title (not the problem name). Something like "Wiring Up the Apartment", "Finding the Cheapest Route to Work", "Organizing Your Bookshelf".
2. **description** — A vivid, detailed real-world scenario that maps directly to the problem. Use simple markdown formatting:
   - Use **bold** for key concepts
   - Keep it as a narrative paragraph (4-6 sentences minimum)
   - Use situations students face: apartment life, shopping, social media, food ordering, college, commuting, gaming, etc.
3. **keyInsight** — Start with 💡 emoji. A memorable takeaway that connects the real-world scenario to the algorithm insight. Should be an "aha!" moment. Use **bold** for emphasis.
4. **approaches** — An array with EXACTLY ${approachList.length} entries, one per solution approach listed above. Each entry has:
   - **label**: The approach title from the list above, followed by type in parentheses. Format: "Title (Brute Force)" or "Title (Optimal)". 
   - **content**: Rich markdown formatted explanation with this structure:
     - Start with a 1-2 sentence intro paragraph connecting to the analogy
     - Then a "**How it works:**" section with bullet points using emojis:
       - Each bullet should be a clear step: "📋 First, you **list all options**..."
       - Use 3-5 bullets covering the key steps
       - Bold the action words in each bullet
     - End with a callout line: "💡 **Think of it as:** [one-line relatable comparison]"
5. **icon** — A single emoji that represents the analogy scenario.

## Example approach content format:
"Imagine you're the apartment manager trying to connect all rooms at minimum cost.\\n\\n**How it works:**\\n- 📋 First, you **list all possible cable connections** and sort them cheapest to most expensive\\n- ✅ Go down the list — if connecting two rooms won't create a loop, **hire that contractor**\\n- ⏭️ If those rooms are already connected through other cables, **skip it**\\n- 🔁 Keep going until **every room is reachable**\\n\\n💡 **Think of it as:** Bargain shopping — you check every deal from cheapest first, but skip anything redundant."

## Quality Standards:
- EXACTLY ${approachList.length} approach entries — one for EACH solution approach. Missing any = FAILURE.
- Each approach content MUST use the bullet point structure shown above
- Do NOT just describe the algorithm in technical terms — translate it to the real-world scenario
- Use "you" to make it personal: "You start from...", "You look at..."
- Every bullet should map to an actual algorithm step but described in everyday language
- The description should also use **bold** for key terms

## Response Format:
Return ONLY valid JSON (no markdown code fences, no backticks wrapping):
{
  "icon": "🔌",
  "title": "Catchy Relatable Title",
  "description": "Vivid scenario with **bold** key terms...",
  "keyInsight": "💡 **Key takeaway** with emphasis...",
  "approaches": [
    {
      "label": "Approach Title (Type)",
      "content": "Intro paragraph...\\n\\n**How it works:**\\n- 📋 Step one...\\n- ✅ Step two...\\n\\n💡 **Think of it as:** comparison"
    }
  ]
}

Generate the analogy now.`;
}

// ==================== PARSE AI RESPONSE ====================

function parseAnalogyResponse(responseText) {
  // Try direct JSON parse
  try {
    return JSON.parse(responseText);
  } catch (e) {}

  // Try extracting from markdown code block
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e) {}
  }

  // Try finding JSON object
  const start = responseText.indexOf('{');
  const end = responseText.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(responseText.substring(start, end + 1));
    } catch (e) {}
  }

  return null;
}

// ==================== VALIDATE ANALOGY ====================

function validateAnalogy(analogy, problem) {
  const errors = [];

  if (!analogy.icon) errors.push('Missing icon');
  if (!analogy.title || analogy.title.length < 5) errors.push('Missing or too short title');
  if (!analogy.description || analogy.description.length < 100) errors.push('Description too short (need 100+ chars)');
  if (!analogy.keyInsight || analogy.keyInsight.length < 20) errors.push('Key insight too short');
  
  if (!Array.isArray(analogy.approaches) || analogy.approaches.length === 0) {
    errors.push('Missing approaches array');
  } else {
    const approachCount = Object.keys(problem.approaches || {}).length;
    if (analogy.approaches.length !== approachCount) {
      errors.push(`Approach count mismatch: got ${analogy.approaches.length}, expected ${approachCount}`);
    }
    for (let i = 0; i < analogy.approaches.length; i++) {
      const a = analogy.approaches[i];
      if (!a.label) errors.push(`Approach ${i}: missing label`);
      if (!a.content || a.content.length < 100) errors.push(`Approach ${i}: content too short (need 100+ chars)`);
      if (a.content && a.content.trim().toLowerCase() === 'n/a') errors.push(`Approach ${i}: content is N/A`);
    }
  }

  return errors;
}

// ==================== APPLY TO FIREBASE ====================

async function applyAnalogy(problemId, analogy) {
  try {
    const docRef = db.collection(COLLECTION_NAME).doc(problemId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error(`    ❌ Problem not found: ${problemId}`);
      return false;
    }

    await docRef.update({
      analogy: analogy,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`    ✅ Updated analogy for ${problemId}`);
    return true;
  } catch (error) {
    console.error(`    ❌ Error updating: ${error.message}`);
    return false;
  }
}

// ==================== GENERATE ANALOGY FOR ONE PROBLEM ====================

async function generateAnalogy(problem, apply = false) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📝 ${problem.title} (${problem.id})`);
  console.log(`   Difficulty: ${problem.difficulty || problem.level || '?'} | Category: ${problem.category || '?'}`);
  console.log(`   Approaches: ${Object.keys(problem.approaches || {}).map(k => problem.approaches[k].title || k).join(', ')}`);
  
  // Check current analogy state
  const analogy = problem.analogy;
  if (analogy) {
    if (Array.isArray(analogy.approaches) && analogy.approaches.length > 0) {
      console.log(`   Current analogy: "${analogy.title}" with ${analogy.approaches.length} approaches`);
    } else {
      const skipFields = ['icon', 'title', 'description', 'keyInsight', 'scenario', 'approaches'];
      const oldKeys = Object.keys(analogy).filter(k => !skipFields.includes(k) && typeof analogy[k] === 'string');
      console.log(`   Current analogy: OLD FORMAT with keys [${oldKeys.join(', ')}]`);
    }
  } else {
    console.log(`   Current analogy: NONE`);
  }

  // Generate prompt
  const prompt = generateAnalogyPrompt(problem);

  // Call Claude
  console.log(`   🤖 Calling Claude...`);
  let inputTokens = 0, outputTokens = 0;
  const expectedApproachCount = Object.keys(problem.approaches || {}).length;
  const MAX_RETRIES = 2;

  try {
    let newAnalogy = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0]?.text || '';
      inputTokens += response.usage?.input_tokens || 0;
      outputTokens += response.usage?.output_tokens || 0;

      // Per-attempt cost
      const cost = (inputTokens / 1000000) * 3 + (outputTokens / 1000000) * 15;
      console.log(`   💰 Cost: $${cost.toFixed(4)} (${inputTokens} in / ${outputTokens} out)${attempt > 0 ? ` [retry ${attempt}]` : ''}`);

      // Parse response
      const parsed = parseAnalogyResponse(responseText);
      if (!parsed) {
        console.log(`   ❌ Failed to parse AI response`);
        if (attempt < MAX_RETRIES) {
          console.log(`   🔄 Retrying...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        console.log(`   Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
        return { success: false, inputTokens, outputTokens };
      }

      // Check approach count
      const gotCount = (parsed.approaches || []).length;
      if (gotCount !== expectedApproachCount) {
        console.log(`   ⚠️  Approach count mismatch: got ${gotCount}, expected ${expectedApproachCount}`);
        if (attempt < MAX_RETRIES) {
          console.log(`   🔄 Retrying...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        console.log(`   ⚠️  Using best effort after ${MAX_RETRIES} retries`);
      }

      newAnalogy = parsed;
      break;
    }

    if (!newAnalogy) {
      return { success: false, inputTokens, outputTokens };
    }

    // Validate
    const errors = validateAnalogy(newAnalogy, problem);
    if (errors.length > 0) {
      console.log(`   ⚠️  Validation warnings:`);
      errors.forEach(e => console.log(`      - ${e}`));
    }

    // Display result
    console.log(`\n   📖 Generated Analogy:`);
    console.log(`   ${newAnalogy.icon} ${newAnalogy.title}`);
    console.log(`   ${newAnalogy.description?.substring(0, 150)}...`);
    console.log(`   Insight: ${newAnalogy.keyInsight?.substring(0, 100)}...`);
    if (newAnalogy.approaches) {
      newAnalogy.approaches.forEach((a, i) => {
        console.log(`   [${i + 1}] ${a.label}: ${a.content?.substring(0, 80)}...`);
      });
    }

    // Apply if requested
    if (apply) {
      if (errors.length > 0 && errors.some(e => e.includes('missing') || e.includes('Missing'))) {
        console.log(`   ❌ Skipping apply due to validation errors`);
        return { success: false, inputTokens, outputTokens };
      }
      const applied = await applyAnalogy(problem.id, newAnalogy);
      return { success: applied, inputTokens, outputTokens };
    }

    return { success: true, inputTokens, outputTokens, analogy: newAnalogy };

  } catch (error) {
    console.error(`   ❌ API error: ${error.message}`);
    return { success: false, inputTokens, outputTokens };
  }
}

// ==================== COMMANDS ====================

async function listProblems(limit, skip = 0, force = false) {
  const problems = await fetchProblemsNeedingAnalogy(limit, skip, force);

  if (problems.length === 0) {
    console.log('✅ No problems need analogy fixes!');
    return;
  }

  console.log(`\n📋 ${problems.length} problem(s) need analogy fixes:\n`);
  problems.forEach((p, i) => {
    const analogy = p.analogy;
    let status = 'NO ANALOGY';
    if (analogy) {
      if (Array.isArray(analogy.approaches) && analogy.approaches.length > 0) {
        const hasNA = analogy.approaches.some(a => a.content?.trim().toLowerCase() === 'n/a');
        const tooShort = analogy.approaches.some(a => a.content && a.content.trim().length < 100);
        status = hasNA ? 'HAS N/A' : tooShort ? 'TOO SHORT' : 'NEW FORMAT (needs review)';
      } else {
        status = 'OLD FORMAT';
      }
    }
    console.log(`  ${skip + i + 1}. ${p.title} (${p.id}) — ${status}`);
  });
}

async function runTest(problemId) {
  const problem = await fetchProblemById(problemId);
  if (!problem) return;
  await generateAnalogy(problem, false);
}

async function runApply(problemId) {
  const problem = await fetchProblemById(problemId);
  if (!problem) return;
  await generateAnalogy(problem, true);
}

async function runFixAll(limit, apply = false, skip = 0, force = false) {
  const problems = await fetchProblemsNeedingAnalogy(limit, skip, force);

  if (problems.length === 0) {
    console.log('✅ No problems need analogy fixes!');
    return;
  }

  console.log(`\n🔧 Processing ${problems.length} problem(s)...\n`);

  let successCount = 0, errorCount = 0;
  let totalInputTokens = 0, totalOutputTokens = 0;

  for (let i = 0; i < problems.length; i++) {
    console.log(`\n[${i + 1}/${problems.length}]`);
    const result = await generateAnalogy(problems[i], apply);
    
    totalInputTokens += result.inputTokens || 0;
    totalOutputTokens += result.outputTokens || 0;

    if (result.success) successCount++;
    else errorCount++;

    // Running cost
    const runningCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
    console.log(`   📈 Progress: ${i + 1}/${problems.length} | ✅ ${successCount} | ❌ ${errorCount} | 💰 $${runningCost.toFixed(4)}`);

    // Rate limit: wait between API calls
    if (i < problems.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Cost summary
  const inputCost = (totalInputTokens / 1000000) * 3;
  const outputCost = (totalOutputTokens / 1000000) * 15;
  const totalCost = inputCost + outputCost;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`💰 COST:`);
  console.log(`   Input:  ${totalInputTokens.toLocaleString()} tokens × $3.00/1M  = $${inputCost.toFixed(4)}`);
  console.log(`   Output: ${totalOutputTokens.toLocaleString()} tokens × $15.00/1M = $${outputCost.toFixed(4)}`);
  console.log(`   Total: $${totalCost.toFixed(4)}`);
  console.log(`${'═'.repeat(50)}`);
}

// ==================== BATCH MODE (50% cheaper) ====================

// ==================== SLUGS FILE MODE ====================

async function runFromSlugsFile(filePath, apply = false) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  const slugs = fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'));

  if (slugs.length === 0) {
    console.log('ℹ️  No slugs found in file');
    return;
  }

  console.log(`\n📂 Found ${slugs.length} slug(s) in ${filePath}`);
  console.log(`   Mode: ${apply ? '🔥 APPLY (will update Firebase)' : '👀 PREVIEW (dry run)'}\n`);

  let successCount = 0, errorCount = 0, skipCount = 0;
  let totalInputTokens = 0, totalOutputTokens = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    console.log(`\n[${i + 1}/${slugs.length}] ${slug}`);

    const problem = await fetchProblemById(slug);
    if (!problem) {
      console.log(`   ⚠️ Skipping (not found)`);
      skipCount++;
      continue;
    }

    if (!problem.approaches || Object.keys(problem.approaches).length === 0) {
      console.log(`   ⚠️ Skipping (no approaches)`);
      skipCount++;
      continue;
    }

    const result = await generateAnalogy(problem, apply);

    totalInputTokens += result.inputTokens || 0;
    totalOutputTokens += result.outputTokens || 0;

    if (result.success) successCount++;
    else errorCount++;

    const runningCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
    console.log(`   📈 Progress: ${i + 1}/${slugs.length} | ✅ ${successCount} | ❌ ${errorCount} | ⏭️ ${skipCount} | 💰 $${runningCost.toFixed(4)}`);

    if (i < slugs.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const inputCost = (totalInputTokens / 1000000) * 3;
  const outputCost = (totalOutputTokens / 1000000) * 15;
  const totalCost = inputCost + outputCost;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Success: ${successCount} | ❌ Errors: ${errorCount} | ⏭️ Skipped: ${skipCount}`);
  console.log(`💰 Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`${'═'.repeat(50)}`);
}

// ==================== MISMATCH DETECTION ====================

async function findMismatchProblems(limit, apply = false) {
  initFirebase();

  console.log('\n🔍 Scanning all problems for analogy/approach count mismatches...\n');

  const snapshot = await db.collection(COLLECTION_NAME).get();
  const mismatched = [];

  snapshot.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    const approachCount = Object.keys(data.approaches || {}).length;
    const analogyCount = Array.isArray(data.analogy?.approaches) ? data.analogy.approaches.length : 0;

    if (approachCount > 0 && analogyCount < approachCount) {
      mismatched.push({
        ...data,
        _approachCount: approachCount,
        _analogyCount: analogyCount
      });
    }
  });

  if (mismatched.length === 0) {
    console.log('✅ All problems have matching analogy counts!');
    return;
  }

  console.log(`⚠️  Found ${mismatched.length} problem(s) with fewer analogies than approaches:\n`);

  const toProcess = limit ? mismatched.slice(0, limit) : mismatched;

  for (const p of toProcess) {
    const approachKeys = Object.keys(p.approaches).map(k => p.approaches[k].title || k).join(', ');
    const analogyLabels = (p.analogy?.approaches || []).map(a => a.label).join(', ');
    console.log(`  [${p.id}]`);
    console.log(`    Approaches (${p._approachCount}): ${approachKeys}`);
    console.log(`    Analogies  (${p._analogyCount}): ${analogyLabels || '(none)'}`);
    console.log('');
  }

  if (!apply) {
    console.log(`\n💡 Run with --fix-mismatch-apply to regenerate analogies for these ${toProcess.length} problems`);
    console.log(`   Or save slugs: node fix_analogy.js --find-mismatch | grep "^  \\[" | sed 's/.*\\[//;s/\\].*//' > mismatch_slugs.txt`);
    return;
  }

  // Apply mode - regenerate
  console.log(`\n🔧 Regenerating analogies for ${toProcess.length} mismatched problem(s)...\n`);

  let successCount = 0, errorCount = 0;
  let totalInputTokens = 0, totalOutputTokens = 0;

  for (let i = 0; i < toProcess.length; i++) {
    console.log(`\n[${i + 1}/${toProcess.length}] ${toProcess[i].id} (${toProcess[i]._analogyCount}→${toProcess[i]._approachCount} approaches)`);

    const result = await generateAnalogy(toProcess[i], true);

    totalInputTokens += result.inputTokens || 0;
    totalOutputTokens += result.outputTokens || 0;

    if (result.success) successCount++;
    else errorCount++;

    const runningCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
    console.log(`   📈 Progress: ${i + 1}/${toProcess.length} | ✅ ${successCount} | ❌ ${errorCount} | 💰 $${runningCost.toFixed(4)}`);

    if (i < toProcess.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const totalCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
  console.log(`💰 Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`${'═'.repeat(50)}`);
}

async function createBatch(limit, skip = 0, force = false) {
  const problems = await fetchProblemsNeedingAnalogy(limit, skip, force);

  if (problems.length === 0) {
    console.log('✅ No problems need analogy fixes!');
    return;
  }

  console.log(`📦 Creating batch for ${problems.length} problem(s)...`);

  const requests = [];

  for (const problem of problems) {
    if (!problem.approaches || Object.keys(problem.approaches).length === 0) continue;

    const prompt = generateAnalogyPrompt(problem);
    let customId = problem.id;
    if (customId.length > 64) {
      customId = customId.substring(0, 58) + '-' + requests.length;
    }

    requests.push({
      custom_id: customId,
      params: {
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      }
    });
  }

  if (requests.length === 0) {
    console.log('ℹ️  No problems to process');
    return;
  }

  console.log(`📝 Prepared ${requests.length} analogy requests`);

  try {
    const batch = await anthropic.messages.batches.create({ requests });

    console.log(`\n✅ Batch created: ${batch.id}`);
    console.log(`📊 Status: ${batch.processing_status}`);
    console.log(`\nNext:`);
    console.log(`  node fix_analogy.js --check-batch ${batch.id}`);
    console.log(`  node fix_analogy.js --process-results ${batch.id}`);

    // Save mapping file
    const idMapping = {};
    requests.forEach((req, idx) => {
      idMapping[req.custom_id] = problems[idx].id;
    });

    fs.writeFileSync(`analogy_batch_${batch.id}.json`, JSON.stringify({
      batchId: batch.id,
      createdAt: new Date().toISOString(),
      problemCount: requests.length,
      problemIds: problems.map(p => p.id),
      idMapping
    }, null, 2));

    console.log(`💾 Saved batch info to analogy_batch_${batch.id}.json`);

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
      console.log(`\n✅ Complete! Run: node fix_analogy.js --process-results ${batchId}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function processResults(batchId) {
  initFirebase();

  console.log(`\n📦 Processing analogy batch results: ${batchId}`);

  // Load mapping file
  let idMapping = {};
  const infoFile = `analogy_batch_${batchId}.json`;
  if (fs.existsSync(infoFile)) {
    try {
      const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
      idMapping = info.idMapping || {};
    } catch (e) {}
  }

  let appliedCount = 0, errorCount = 0, skippedCount = 0;
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

      // Per-problem cost (batch rate)
      const problemCost = ((message.usage?.input_tokens || 0) / 1000000) * 1.5 + ((message.usage?.output_tokens || 0) / 1000000) * 7.5;
      console.log(`   💰 Cost: $${problemCost.toFixed(4)} (${message.usage?.input_tokens || 0} in / ${message.usage?.output_tokens || 0} out)`);

      const responseText = message.content[0]?.text || '';
      const newAnalogy = parseAnalogyResponse(responseText);

      if (!newAnalogy) {
        console.log(`   ❌ Failed to parse response`);
        errorCount++;
        continue;
      }

      // Fetch problem for validation
      const problem = await fetchProblemById(problemId);
      if (!problem) {
        errorCount++;
        continue;
      }

      // Validate
      const errors = validateAnalogy(newAnalogy, problem);
      if (errors.some(e => e.includes('missing') || e.includes('Missing'))) {
        console.log(`   ⚠️  Skipping — validation errors: ${errors.join(', ')}`);
        skippedCount++;
        continue;
      }

      if (errors.length > 0) {
        console.log(`   ⚠️  Warnings: ${errors.join(', ')}`);
      }

      // Display summary
      console.log(`   ${newAnalogy.icon} ${newAnalogy.title}`);
      if (newAnalogy.approaches) {
        console.log(`   Approaches: ${newAnalogy.approaches.map(a => a.label).join(', ')}`);
      }

      // Apply
      const applied = await applyAnalogy(problemId, newAnalogy);
      if (applied) appliedCount++;
      else errorCount++;

      // Running total
      const runningCost = (totalInputTokens / 1000000) * 1.5 + (totalOutputTokens / 1000000) * 7.5;
      const processed = appliedCount + skippedCount + errorCount;
      console.log(`   📈 Progress: ${processed} processed | ✅ ${appliedCount} | ⚠️ ${skippedCount} | ❌ ${errorCount} | 💰 $${runningCost.toFixed(4)}`);
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  // Cost summary (batch = 50% off)
  const inputCost = (totalInputTokens / 1000000) * 1.5;
  const outputCost = (totalOutputTokens / 1000000) * 7.5;
  const totalCost = inputCost + outputCost;
  const standardCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
  const savedAmount = standardCost - totalCost;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Applied: ${appliedCount} | ⚠️ Skipped: ${skippedCount} | ❌ Errors: ${errorCount}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`💰 COST (Batch 50% Discount):`);
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
    console.log('📖 Fix/Generate Analogies');
    console.log('   Reads problems, generates relatable');
    console.log('   day-to-day analogies via Claude AI,');
    console.log('   updates only the analogy field.');
    console.log('═══════════════════════════════════════════\n');
    console.log('Commands:\n');
    console.log('  --list [limit]                List problems needing analogy fix');
    console.log('  --test <problem_id>           Preview generated analogy (no apply)');
    console.log('  --apply <problem_id>          Generate & apply analogy');
    console.log('  --fix-all [limit]             Preview all (no apply)');
    console.log('  --fix-apply-all [limit]       Generate & apply all');
    console.log('');
    console.log('  Slugs File:');
    console.log('  --slugs-file <file>           Preview analogies for slugs in file');
    console.log('  --slugs-apply <file>          Generate & apply analogies for slugs in file');
    console.log('');
    console.log('  Mismatch Detection:');
    console.log('  --find-mismatch [limit]       List problems with fewer analogies than approaches');
    console.log('  --fix-mismatch-apply [limit]  Regenerate analogies for mismatched problems');
    console.log('');
    console.log('  Batch (50% cheaper):');
    console.log('  --create-batch [limit]        Create batch job');
    console.log('  --check-batch <batch_id>      Check batch status');
    console.log('  --process-results <batch_id>  Process & apply batch results');
    console.log('\n  Options:');
    console.log('    --skip <n>                  Skip first n problems');
    console.log('    --force                     Regenerate even if analogy exists\n');
    console.log('  Examples:');
    console.log('    node fix_analogy.js --test network-cable-cost');
    console.log('    node fix_analogy.js --apply network-cable-cost');
    console.log('    node fix_analogy.js --fix-apply-all 10 --skip 5');
    console.log('    node fix_analogy.js --create-batch 50');
    console.log('    node fix_analogy.js --check-batch msgbatch_xxx');
    console.log('    node fix_analogy.js --process-results msgbatch_xxx');
    console.log('    node fix_analogy.js --list --force\n');
    console.log('    node fix_analogy.js --slugs-apply failed_slugs.txt');
    console.log('    node fix_analogy.js --find-mismatch');
    console.log('    node fix_analogy.js --fix-mismatch-apply 10\n');
    process.exit(1);
  }

  const command = args[0];
  const param = args[1] && !args[1].startsWith('--') ? args[1] : null;

  // Parse flags
  const skipIdx = args.indexOf('--skip');
  const skip = skipIdx !== -1 && args[skipIdx + 1] ? parseInt(args[skipIdx + 1]) : 0;
  const force = args.includes('--force');

  switch (command) {
    case '--list':
      await listProblems(param ? parseInt(param) : null, skip, force);
      break;

    case '--test':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runTest(param);
      break;

    case '--apply':
      if (!param) { console.error('❌ Provide problem_id'); process.exit(1); }
      await runApply(param);
      break;

    case '--fix-all':
      await runFixAll(param ? parseInt(param) : null, false, skip, force);
      break;

    case '--fix-apply-all':
      await runFixAll(param ? parseInt(param) : null, true, skip, force);
      break;

    case '--slugs-file':
      if (!param) { console.error('❌ Provide file path'); process.exit(1); }
      await runFromSlugsFile(param, false);
      break;

    case '--slugs-apply':
      if (!param) { console.error('❌ Provide file path'); process.exit(1); }
      await runFromSlugsFile(param, true);
      break;

    case '--find-mismatch':
      await findMismatchProblems(param ? parseInt(param) : null, false);
      break;

    case '--fix-mismatch-apply':
      await findMismatchProblems(param ? parseInt(param) : null, true);
      break;

    case '--create-batch':
      await createBatch(param ? parseInt(param) : null, skip, force);
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
