/**
 * Coding Problems Uploader - ChatGPT Version
 * 
 * Usage:
 *   Test (view only):  node upload_coding_problems_chatgpt.js ./failed_leetcode_retry.xlsx --test 2
 *   Upload to Firebase: node upload_coding_problems_chatgpt.js ./failed_leetcode_retry.xlsx --upload
 * 
 * This script processes problems sequentially using ChatGPT API
 */

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const https = require('https');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

// ChatGPT Configuration
const OPENAI_API_KEY = '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';
const OPENAI_ORG = 'org-8TalfbtaR3FJNxdhbEhMLKDT';
const OPENAI_PROJECT = 'proj_9bat3IRXDdJxQAT0pDL3h9X4';
const MODEL = 'gpt-4o';  // or 'gpt-4-turbo' or 'gpt-3.5-turbo'

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests

// ==================== INITIALIZE FIREBASE ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// ==================== HELPER FUNCTIONS ====================

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parseRelatedProblems(row) {
  const related = [];
  const columns = ['R1', 'R2', 'R3', 'R4', 'R5'];
  
  columns.forEach(col => {
    if (row[col]) {
      const parts = row[col].split('|').map(p => p.trim());
      if (parts.length >= 2) {
        related.push({
          id: generateSlug(parts[0]),
          title: parts[0],
          difficulty: parts[1] || 'Medium'
        });
      }
    }
  });
  
  return related;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== CHATGPT API ====================

async function callChatGPT(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert competitive programmer and coding instructor. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 16000
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Organization': OPENAI_ORG,
        'OpenAI-Project': OPENAI_PROJECT
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', chunk => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          
          if (result.error) {
            reject(new Error(result.error.message || 'API Error'));
            return;
          }
          
          if (result.choices && result.choices[0] && result.choices[0].message) {
            resolve({
              content: result.choices[0].message.content,
              usage: result.usage
            });
          } else {
            reject(new Error('Invalid response structure'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(data);
    req.end();
  });
}

// ==================== PROMPT TEMPLATE ====================

function buildPrompt(problemName, description, difficulty, topics, relatedProblems) {
  return `Generate a complete coding problem document for:

**Problem:** ${problemName}
**Difficulty:** ${difficulty}
**Topics:** ${topics}
**Description:** ${description}
**Related Problems:** ${JSON.stringify(relatedProblems)}

Return a JSON object with this EXACT structure (no markdown, just raw JSON):

{
  "title": "${problemName}",
  "difficulty": "${difficulty}",
  "category": "Primary category from topics",
  "topics": ["array", "of", "topics"],
  "companies": ["companies that ask this"],
  "problemStatement": "Detailed HTML problem statement with examples",
  "examples": [
    {
      "id": 1,
      "inputText": "Input description",
      "outputText": "Output description", 
      "explanation": "Why this is the answer"
    }
  ],
  "constraints": ["constraint 1", "constraint 2"],
  "starterCode": {
    "javascript": "function solution() {\\n  // code\\n}",
    "python": "def solution():\\n    # code",
    "java": "class Solution {\\n    public void solve() {\\n        // code\\n    }\\n}",
    "cpp": "class Solution {\\npublic:\\n    void solve() {\\n        // code\\n    }\\n};",
    "csharp": "public class Solution {\\n    public void Solve() {\\n        // code\\n    }\\n}",
    "go": "func solution() {\\n    // code\\n}",
    "rust": "impl Solution {\\n    pub fn solve() {\\n        // code\\n    }\\n}",
    "kotlin": "fun solution() {\\n    // code\\n}",
    "swift": "func solution() {\\n    // code\\n}",
    "typescript": "function solution(): void {\\n  // code\\n}",
    "sql": "-- SQL solution\\nSELECT * FROM table"
  },
  "solutions": {
    "javascript": "// Complete working solution\\nfunction solution() {\\n  // implementation\\n}",
    "python": "# Complete working solution\\ndef solution():\\n    # implementation",
    "java": "// Complete working solution\\nclass Solution {\\n    public void solve() {\\n        // implementation\\n    }\\n}",
    "cpp": "// Complete working solution\\nclass Solution {\\npublic:\\n    void solve() {\\n        // implementation\\n    }\\n};",
    "csharp": "// Complete working solution\\npublic class Solution {\\n    public void Solve() {\\n        // implementation\\n    }\\n}",
    "sql": "-- Complete SQL solution\\nSELECT * FROM table WHERE condition"
  },
  "testCases": [
    {
      "id": "1",
      "input": "test input",
      "expectedOutput": "expected output"
    }
  ],
  "hints": ["hint 1", "hint 2", "hint 3"],
  "editorial": {
    "approach": "Detailed approach explanation",
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)",
    "explanation": "Step by step explanation"
  }
}

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no extra text.`;
}

// ==================== PROCESS PROBLEM ====================

async function processProblem(row) {
  const problemName = row['Problem Name'] || '';
  const description = row['Description'] || '';
  const difficulty = row['Difficulty'] || 'Medium';
  const topics = row['Topics'] || '';
  const relatedProblems = parseRelatedProblems(row);
  const slug = generateSlug(problemName);

  console.log(`\n[${slug}] ${problemName}`);

  try {
    const prompt = buildPrompt(problemName, description, difficulty, topics, relatedProblems);
    const response = await callChatGPT(prompt);
    
    // Parse JSON from response
    let content = response.content.trim();
    
    // Remove markdown code blocks if present
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    const problemData = JSON.parse(content);

    // Build Firebase document
    const firebaseDoc = {
      id: slug,
      title: problemData.title || problemName,
      difficulty: problemData.difficulty || difficulty,
      category: problemData.category || topics.split(',')[0]?.trim() || 'General',
      topics: problemData.topics || topics.split(',').map(t => t.trim()),
      companies: problemData.companies || [],
      problemStatement: problemData.problemStatement || description,
      examples: problemData.examples || [],
      constraints: problemData.constraints || [],
      starterCode: problemData.starterCode || {},
      solutions: problemData.solutions || {},
      testCases: problemData.testCases || [],
      hints: problemData.hints || [],
      editorial: problemData.editorial || {},
      relatedProblems: relatedProblems,
      likes: 0,
      dislikes: 0,
      views: 0,
      acceptanceRate: 0,
      submissions: 0,
      accepted: 0,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    return {
      success: true,
      slug: slug,
      data: firebaseDoc,
      usage: response.usage
    };

  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}`);
    return {
      success: false,
      slug: slug,
      error: error.message
    };
  }
}

// ==================== UPLOAD TO FIREBASE ====================

async function uploadToFirebase(slug, data) {
  try {
    await db.collection(COLLECTION_NAME).doc(slug).set(data);
    return true;
  } catch (error) {
    console.log(`   ❌ Firebase error: ${error.message}`);
    return false;
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  node upload_coding_problems_chatgpt.js <excel_file> --test [count]');
    console.log('  node upload_coding_problems_chatgpt.js <excel_file> --upload');
    process.exit(1);
  }

  const excelPath = args[0];
  const mode = args[1];
  const testCount = parseInt(args[2]) || 2;

  // Read Excel
  console.log('========================================');
  console.log('🚀 Coding Problems Uploader (ChatGPT)');
  console.log('========================================');
  console.log(`📖 Reading: ${excelPath}`);
  
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Found ${data.length} problems`);
  console.log(`🤖 Model: ${MODEL}`);
  console.log('========================================\n');

  let problemsToProcess;
  
  if (mode === '--test') {
    problemsToProcess = data.slice(0, testCount);
    console.log(`🧪 TEST MODE: Processing ${testCount} problems\n`);
  } else if (mode === '--upload') {
    problemsToProcess = data;
    console.log(`📤 UPLOAD MODE: Processing all ${data.length} problems\n`);
  } else {
    console.log('Invalid mode. Use --test or --upload');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const failedProblems = [];
  const processedProblems = []; // Store all processed problems for review

  for (let i = 0; i < problemsToProcess.length; i++) {
    const row = problemsToProcess[i];
    console.log(`[${i + 1}/${problemsToProcess.length}]`);
    
    const result = await processProblem(row);
    
    if (result.success) {
      if (mode === '--test') {
        // In test mode, save to file for review (don't upload)
        processedProblems.push(result.data);
        console.log(`   ✅ Generated: ${result.data.title}`);
        console.log(`   📝 Difficulty: ${result.data.difficulty}`);
        console.log(`   🏷️  Topics: ${result.data.topics?.join(', ')}`);
        console.log(`   📊 Examples: ${result.data.examples?.length || 0}`);
        console.log(`   🧪 Test Cases: ${result.data.testCases?.length || 0}`);
        console.log(`   💡 Hints: ${result.data.hints?.length || 0}`);
        successCount++;
      } else {
        // In upload mode, upload to Firebase
        const uploaded = await uploadToFirebase(result.slug, result.data);
        
        if (uploaded) {
          console.log(`   ✅ Uploaded: ${result.data.title}`);
          successCount++;
        } else {
          failCount++;
          failedProblems.push({ slug: result.slug, error: 'Firebase upload failed' });
        }
      }
      
      if (result.usage) {
        totalInputTokens += result.usage.prompt_tokens || 0;
        totalOutputTokens += result.usage.completion_tokens || 0;
      }
    } else {
      failCount++;
      failedProblems.push({ slug: result.slug, error: result.error });
    }

    // Rate limiting delay
    if (i < problemsToProcess.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // In test mode, save results to JSON file for review
  if (mode === '--test' && processedProblems.length > 0) {
    const outputFile = 'test_output_problems.json';
    fs.writeFileSync(outputFile, JSON.stringify(processedProblems, null, 2));
    console.log(`\n📁 Test results saved to: ${outputFile}`);
    console.log('   Review this file to check the generated content.');
    console.log('   If satisfied, run with --upload to upload all problems.\n');
  }

  // Summary
  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('────────────────────────────────────────');
  console.log('💰 TOKEN USAGE');
  console.log(`📥 Input:  ${totalInputTokens.toLocaleString()}`);
  console.log(`📤 Output: ${totalOutputTokens.toLocaleString()}`);
  
  // Estimate cost (GPT-4o pricing: $2.50/1M input, $10/1M output)
  const inputCost = (totalInputTokens / 1000000) * 2.50;
  const outputCost = (totalOutputTokens / 1000000) * 10.00;
  console.log(`💵 Est. Cost: $${(inputCost + outputCost).toFixed(4)}`);
  console.log('========================================\n');

  // Save failed problems
  if (failedProblems.length > 0) {
    const fs = require('fs');
    fs.writeFileSync(
      'failed_chatgpt_problems.json',
      JSON.stringify(failedProblems, null, 2)
    );
    console.log(`📁 Failed problems saved to: failed_chatgpt_problems.json`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
