/**
 * SVG Infographic Generator for Coding Problems
 * Generates high-quality SVG visuals and updates Firebase problem documents
 * Uses Claude Opus 4.5 with Batch API for 50% cost savings
 * 
 * Usage:
 *   TEST MODE (1-2 problems, real-time API):
 *     node generate_svg_visuals.js --test 2
 *     node generate_svg_visuals.js --test 2 --tag Database
 * 
 *   BATCH MODE (50% cheaper, up to 24 hours):
 *     node generate_svg_visuals.js --create-batch [limit]
 *     node generate_svg_visuals.js --create-batch --tag Database
 *     node generate_svg_visuals.js --create-batch 50 --tag Database
 *     node generate_svg_visuals.js --check-batch <batch_id>
 *     node generate_svg_visuals.js --process-results <batch_id>
 */

const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const ANTHROPIC_API_KEY = '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';
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';
const MODEL = 'claude-opus-4-5-20251101'; // Opus 4.5

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

// ==================== SVG GENERATION PROMPT ====================
const SVG_PROMPT = `Generate an SVG infographic for this coding problem. Return ONLY the raw SVG code (no HTML wrapper, no explanation).

Problem: [PROBLEM_NAME]
Description: [DESCRIPTION]
Input: [INPUT]
Output: [OUTPUT]
Approach: [APPROACH]

=== SVG REQUIREMENTS ===

1. DIMENSIONS: viewBox="0 0 900 680", width="900", height="680"

2. THREE EQUAL PANELS (270px width each, 400px height):
   - Panel 1 (Blue #EBF4FF, border #BEE3F8): INPUT
     * Show data structure visually (array, graph, tree, etc.)
     * Display input values in boxes below
   
   - Panel 2 (Green #F0FFF4, border #9AE6B4): ALGORITHM STEPS
     * Numbered steps (1, 2, 3, 4) with green circles
     * Each step: title + brief explanation
     * Visual aids if needed (heap, table, etc.)
   
   - Panel 3 (Orange #FFFAF0, border #FEEBC8): FINAL RESULT
     * Show the solution visually
     * Display output array/value in a box
     * Brief confirmation text

3. KEY INSIGHT BOX (bottom, full width):
   - Background: Gray #EDF2F7, border #CBD5E0
   - LEFT SIDE: SVG lightbulb icon (yellow circles + rectangle base)
   - RIGHT SIDE: "Key Insight:" title + explanation text

4. CONNECTING ARROWS BETWEEN PANELS (IMPORTANT - must be clearly visible):
   - Draw bold arrows flowing LEFT-TO-RIGHT: Input --> Algorithm --> Result
   - Arrow shaft: line with stroke-width="3", color="#4A5568" (dark gray)
   - Arrowhead: solid filled polygon triangle, fill="#4A5568", size 12-14px
   - Position: horizontally centered in the gap between panels, vertically at mid-height of panels
   - Each arrow must clearly show direction from left panel to right panel
   - Do NOT use thin, faint, or light-colored arrows - they must be prominent and easy to see

5. FOOTER:
   - Line at y=620
   - Text: "TutorialsPoint - [Problem Name] | [Approach]" at y=650

=== STYLE RULES ===

- Background: White #FFFFFF
- Panel corners: 16px radius
- Font: Arial, system fonts
- Title: 28px bold
- Headers: 16px bold  
- Body: 12-14px
- Code: monospace

=== CRITICAL ===

- NO unicode arrows (→) - use "-->" text
- NO emoji - use SVG shapes
- NO checkmarks (✓) - use "OK" text
- Keep text SHORT to avoid overflow
- Minimum 15px gap between text and shapes
- Labels must not overlap

Return ONLY the SVG starting with <svg and ending with </svg>. No markdown, no explanation.`;

// ==================== HELPER FUNCTIONS ====================

function buildPrompt(problem) {
  // Get first example for input/output
  const firstExample = problem.examples?.[0] || {};
  
  // Get optimal approach name
  const approachName = problem.approaches?.greedy?.title ||
                       problem.approaches?.['hash-map']?.title ||
                       problem.approaches?.optimized?.title ||
                       problem.approaches?.dfs?.title ||
                       problem.solutionSummary?.match(/greedy|hash|dp|dfs|bfs/i)?.[0] ||
                       'Optimal Solution';
  
  return SVG_PROMPT
    .replace('[PROBLEM_NAME]', problem.title || problem.id)
    .replace('[DESCRIPTION]', problem.descriptionText || '')
    .replace('[INPUT]', firstExample.input || '')
    .replace('[OUTPUT]', firstExample.output || '')
    .replace(/\[APPROACH\]/g, approachName)
    .replace('[Problem Name]', problem.title || problem.id);
}

function extractSVG(response) {
  // If response starts with <svg, return as-is
  if (response.trim().startsWith('<svg')) {
    const endIdx = response.lastIndexOf('</svg>');
    if (endIdx !== -1) {
      return response.substring(0, endIdx + 6).trim();
    }
    return response.trim();
  }
  
  // Try to extract from code blocks
  const svgMatch = response.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
  if (svgMatch && svgMatch[1].includes('<svg')) {
    return svgMatch[1].trim();
  }
  
  // Find <svg> tag
  const startIdx = response.indexOf('<svg');
  if (startIdx !== -1) {
    const endIdx = response.lastIndexOf('</svg>');
    if (endIdx !== -1) {
      return response.substring(startIdx, endIdx + 6);
    }
  }
  
  return null;
}

// ==================== FIREBASE FUNCTIONS ====================

async function fetchProblems(limit = null, tag = null) {
  initFirebase();
  
  console.log('📥 Fetching problems from Firebase...');
  
  let query = db.collection(COLLECTION_NAME);
  
  if (tag) {
    query = query.where('tags', 'array-contains', tag);
    console.log(`   Filter: tag = "${tag}"`);
  }
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const snapshot = await query.get();
  const problems = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    problems.push({
      docId: doc.id,
      ...data
    });
  });
  
  console.log(`   Found ${problems.length} problems`);
  return problems;
}

async function updateProblemSVG(docId, svg) {
  initFirebase();
  
  try {
    await db.collection(COLLECTION_NAME).doc(docId).update({
      'visualize.svg': svg,
      'visualize.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.log(`   ❌ Failed to update: ${error.message}`);
    return false;
  }
}

// ==================== TEST MODE ====================

async function runTestMode(count = 2, tag = null) {
  console.log('\n========================================');
  console.log('🧪 TEST MODE - SVG Visual Generator');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Problems: ${count}`);
  if (tag) console.log(`   Tag filter: ${tag}`);
  console.log('========================================\n');
  
  const problems = await fetchProblems(count, tag);
  
  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    console.log(`\n[${i + 1}/${problems.length}] ${problem.title}`);
    console.log(`   ID: ${problem.docId}`);
    
    const prompt = buildPrompt(problem);
    
    try {
      console.log('   ⏳ Generating SVG...');
      
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      
      console.log(`   📊 Tokens: ${inputTokens} in / ${outputTokens} out`);
      
      const content = response.content[0]?.text || '';
      const svg = extractSVG(content);
      
      if (svg) {
        // Save locally for review
        fs.writeFileSync(`./svg_${problem.docId}.svg`, svg);
        console.log(`   📁 Saved: svg_${problem.docId}.svg`);
        
        // Update Firebase
        const updated = await updateProblemSVG(problem.docId, svg);
        if (updated) {
          console.log('   ✅ Firebase updated!');
          successCount++;
        } else {
          failCount++;
        }
      } else {
        console.log('   ⚠️  No valid SVG in response');
        fs.writeFileSync(`./svg_${problem.docId}_raw.txt`, content);
        failCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }
  
  // Cost calculation (Opus 4.5: $5/$25 per MTok)
  const inputCost = (totalInputTokens / 1000000) * 5;
  const outputCost = (totalOutputTokens / 1000000) * 25;
  const totalCost = inputCost + outputCost;
  
  console.log('\n========================================');
  console.log('📊 TEST RESULTS');
  console.log('========================================');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  console.log('────────────────────────────────────────');
  console.log(`📥 Input:  ${totalInputTokens.toLocaleString()} tokens`);
  console.log(`📤 Output: ${totalOutputTokens.toLocaleString()} tokens`);
  console.log(`💵 Cost:   $${totalCost.toFixed(4)}`);
  console.log('========================================\n');
}

// ==================== BATCH MODE ====================

async function createBatch(limit = null, tag = null) {
  console.log('\n========================================');
  console.log('📦 BATCH MODE - Creating Batch Request');
  console.log(`   Model: ${MODEL}`);
  if (tag) console.log(`   Tag filter: ${tag}`);
  console.log('========================================\n');
  
  const problems = await fetchProblems(limit, tag);
  
  console.log(`   Creating batch for ${problems.length} problems...`);
  
  const requests = problems.map(problem => {
    let customId = problem.docId;
    if (customId.length > 64) {
      customId = (problem.number || 0) + '_' + customId.substring(0, 58);
    }
    return {
      custom_id: customId,
      params: {
        model: MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: buildPrompt(problem) }]
      }
    };
  });
  
  try {
    const batch = await anthropic.messages.batches.create({ requests });
    
    console.log('\n✅ Batch created!');
    console.log(`   Batch ID: ${batch.id}`);
    console.log(`   Status:   ${batch.processing_status}`);
    console.log(`   Requests: ${batch.request_counts.total}`);
    
    // Build custom_id to docId mapping (for truncated IDs)
    const idMap = {};
    requests.forEach((req, idx) => {
      if (req.custom_id !== problems[idx].docId) {
        idMap[req.custom_id] = problems[idx].docId;
      }
    });
    
    // Save batch info
    const batchInfo = {
      batchId: batch.id,
      createdAt: new Date().toISOString(),
      model: MODEL,
      problemCount: problems.length,
      idMap: idMap,
      problems: problems.map(p => ({ docId: p.docId, title: p.title }))
    };
    
    fs.writeFileSync(`batch_svg_${batch.id}.json`, JSON.stringify(batchInfo, null, 2));
    console.log(`   📁 Info saved: batch_svg_${batch.id}.json`);
    
    console.log('\n📋 Next steps:');
    console.log(`   1. node generate_svg_visuals.js --check-batch ${batch.id}`);
    console.log(`   2. node generate_svg_visuals.js --process-results ${batch.id}`);
    
    return batch.id;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function checkBatchStatus(batchId) {
  console.log(`\n📊 Checking batch: ${batchId}\n`);
  
  const batch = await anthropic.messages.batches.retrieve(batchId);
  
  console.log('========================================');
  console.log(`ID:      ${batch.id}`);
  console.log(`Status:  ${batch.processing_status}`);
  console.log(`Created: ${batch.created_at}`);
  console.log('────────────────────────────────────────');
  console.log(`Total:      ${batch.request_counts.total}`);
  console.log(`Succeeded:  ${batch.request_counts.succeeded}`);
  console.log(`Processing: ${batch.request_counts.processing}`);
  console.log(`Errored:    ${batch.request_counts.errored}`);
  console.log('========================================');
  
  if (batch.processing_status === 'ended') {
    console.log('\n✅ Ready! Run:');
    console.log(`   node generate_svg_visuals.js --process-results ${batchId}`);
  }
  
  return batch;
}

async function processResults(batchId) {
  console.log(`\n📦 Processing batch: ${batchId}\n`);
  
  initFirebase();
  
  // Load ID mapping for truncated custom_ids
  let idMap = {};
  const batchFile = `batch_svg_${batchId}.json`;
  if (fs.existsSync(batchFile)) {
    const batchInfo = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    idMap = batchInfo.idMap || {};
    if (Object.keys(idMap).length > 0) {
      console.log(`   📋 Loaded ${Object.keys(idMap).length} truncated ID mappings\n`);
    }
  }
  
  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  const results = await anthropic.messages.batches.results(batchId);
  
  for await (const result of results) {
    const customId = result.custom_id;
    const docId = idMap[customId] || customId;
    console.log(`\n[${docId}]`);
    
    if (result.result.type === 'succeeded') {
      const message = result.result.message;
      
      totalInputTokens += message.usage?.input_tokens || 0;
      totalOutputTokens += message.usage?.output_tokens || 0;
      
      const content = message.content[0]?.text || '';
      const svg = extractSVG(content);
      
      if (svg) {
        const updated = await updateProblemSVG(docId, svg);
        if (updated) {
          console.log('   ✅ Updated!');
          successCount++;
        } else {
          failCount++;
        }
      } else {
        console.log('   ⚠️  No valid SVG');
        failCount++;
      }
      
    } else {
      console.log(`   ❌ Error: ${result.result.error?.message}`);
      failCount++;
    }
  }
  
  // Cost (Batch = 50% off: $2.5/$12.5)
  const inputCost = (totalInputTokens / 1000000) * 2.5;
  const outputCost = (totalOutputTokens / 1000000) * 12.5;
  const totalCost = inputCost + outputCost;
  const standardCost = (totalInputTokens / 1000000) * 5 + (totalOutputTokens / 1000000) * 25;
  
  console.log('\n========================================');
  console.log('📊 BATCH RESULTS');
  console.log('========================================');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  console.log('────────────────────────────────────────');
  console.log(`📥 Input:  ${totalInputTokens.toLocaleString()}`);
  console.log(`📤 Output: ${totalOutputTokens.toLocaleString()}`);
  console.log(`💵 Cost:   $${totalCost.toFixed(4)} (saved $${(standardCost - totalCost).toFixed(4)})`);
  console.log('========================================\n');
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('========================================');
    console.log('🎨 SVG Visual Generator for Problems');
    console.log('   Updates visualize.svg in Firebase');
    console.log('========================================\n');
    console.log('Commands:\n');
    console.log('  --test [count] [--tag Tag]   Test with N problems');
    console.log('  --create-batch [limit] [--tag Tag]  Create batch job');
    console.log('  --check-batch <id>           Check batch status');
    console.log('  --process-results <id>       Process & update Firebase');
    console.log('\nExamples:');
    console.log('  --create-batch --tag Database');
    console.log('  --test 2 --tag Array\n');
    process.exit(0);
  }
  
  const command = args[0];
  const tagIdx = args.indexOf('--tag');
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : null;
  
  // Get param (first arg after command, but not --tag or its value)
  let param = args[1];
  if (param === '--tag') param = null;
  
  switch (command) {
    case '--test':
      await runTestMode(parseInt(param) || 2, tag);
      break;
      
    case '--create-batch':
      await createBatch(param ? parseInt(param) : null, tag);
      break;
      
    case '--check-batch':
      if (!param) { console.error('❌ Provide batch ID'); process.exit(1); }
      await checkBatchStatus(param);
      break;
      
    case '--process-results':
      if (!param) { console.error('❌ Provide batch ID'); process.exit(1); }
      await processResults(param);
      break;
      
    default:
      console.error(`❌ Unknown: ${command}`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
