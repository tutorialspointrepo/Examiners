/**
 * Coding Problems Uploader - BATCH VERSION
 * Reads problems from Excel, generates rich content via Claude AI Batch API (50% cheaper), uploads to Firebase
 * 
 * Usage: 
 *   TEST MODE (Recommended first!):
 *     node upload_coding_problems_batch.js <excel_file_path> --test [count]
 *     Example: node upload_coding_problems_batch.js ./Leetcode.xlsx --test 2
 * 
 *   BATCH MODE (After testing):
 *     Step 1: node upload_coding_problems_batch.js <excel_file_path> --create-batch
 *     Step 2: node upload_coding_problems_batch.js <excel_file_path> --check-batch <batch_id>
 *     Step 3: node upload_coding_problems_batch.js <excel_file_path> --process-results <batch_id>
 */

const admin = require('firebase-admin');
const xlsx = require('xlsx');
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

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ==================== HELPER FUNCTIONS ====================

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Generate a custom_id for batch API (max 64 characters)
 */
function generateCustomId(slug, index) {
  // If slug is short enough, use it directly
  if (slug.length <= 64) {
    return slug;
  }
  // Otherwise, truncate and add index to ensure uniqueness
  const truncated = slug.substring(0, 50);
  return `${truncated}-${index}`;
}

function parseRelatedProblems(row) {
  const related = [];
  const columns = ['R1', 'R2', 'R3', 'R4', 'R5'];
  
  columns.forEach(col => {
    const value = row[col];
    if (value && typeof value === 'string' && value.trim()) {
      const parts = value.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        related.push({
          title: parts[0],
          difficulty: parts[1],
          id: generateSlug(parts[0]),
          category: 'Array',
          similarity: 'medium'
        });
      }
    }
  });
  
  return related;
}

function parseTopics(topicsStr) {
  if (!topicsStr) return [];
  return topicsStr.split(',').map(t => t.trim()).filter(t => t);
}

/**
 * Generate the prompt for a problem - ORIGINAL FULL PROMPT
 */
function generatePrompt(problemName, description, topics, difficulty, relatedProblems, problemId) {
  return `You are an expert algorithm instructor creating educational content for a coding practice platform similar to LeetCode.

Generate comprehensive, educational content for the following coding problem:

**Problem ID:** ${problemId}
**Problem Name:** ${problemName}
**Original Description:** ${description}
**Topics/Tags:** ${topics.join(', ')}
**Difficulty:** ${difficulty}
**Related Problems:** ${relatedProblems.map(r => r.title).join(', ') || 'None'}

Generate a complete JSON response with the following structure. Be thorough and educational.

IMPORTANT INSTRUCTIONS:
1. Generate UP TO 5 APPROACHES based on what's applicable for this problem:
   - "brute-force" - Always include (naive O(n²) or O(n³) solution)
   - "two-pass-hash" - If hash table can solve it in two passes
   - "one-pass-hash" - If hash table can solve it in one pass (optimal for many problems)
   - "two-pointers" - If sorting + two pointers approach works
   - "binary-search" - If sorting + binary search approach works
   Only include approaches that are ACTUALLY APPLICABLE to this specific problem.

2. REWRITE THE DESCRIPTION: Make the original description more clear, engaging, and interesting. Add context, explain the problem better, use proper HTML formatting with examples inline if needed.

{
  "problem_id": "${problemId}",
  "description": "REWRITTEN clear, engaging HTML description of the problem. Make it interesting and easy to understand. Include the goal, what input is given, what output is expected. Use <strong>, <em>, <code> tags where appropriate.",
  "descriptionText": "Plain text version of the rewritten description (no HTML tags)",
  "analogy": {
    "title": "Creative analogy title",
    "description": "Real-world scenario that explains the problem",
    "icon": "🎯",
    "bruteForce": "Explain brute force using the analogy",
    "twoPass": "Explain a better approach using the analogy (if applicable)",
    "optimal": "Explain optimal approach using the analogy",
    "keyInsight": "💡 The key insight that makes the optimal solution work"
  },
  "approaches": {
    "brute-force": {
      "title": "Brute Force (Nested Loops)",
      "icon": "🔨",
      "summary": "One-line summary",
      "description": "Detailed description of the approach",
      "steps": ["Step 1", "Step 2", "..."],
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "complexity": {
        "time": "O(n²)",
        "timeExplain": "Explanation of time complexity",
        "space": "O(1)",
        "spaceExplain": "Explanation of space complexity"
      },
      "code": {
        "python": "# Complete working Python solution\\ndef solution():\\n    pass",
        "javascript": "// Complete working JavaScript solution\\nfunction solution() {\\n}",
        "java": "// Complete working Java solution\\npublic int[] solution() {\\n}",
        "cpp": "// Complete working C++ solution\\nvector<int> solution() {\\n}",
        "go": "// Complete working Go solution\\nfunc solution() []int {\\n}",
        "c": "// Complete working C solution\\nint* solution() {\\n}"
      },
      "visualization": {
        "title": "Visualization title",
        "description": "Brief description",
        "steps": [
          {"stepNumber": 1, "title": "Step title", "description": "Step description"}
        ],
        "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 600 400\\">...</svg>"
      }
    },
    "two-pass-hash": {
      "title": "Two-Pass Hash Table",
      "icon": "📚",
      "summary": "Build hash map first, then search for complements",
      "description": "Detailed description",
      "steps": ["Step 1", "Step 2", "..."],
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "complexity": {
        "time": "O(n)",
        "timeExplain": "Explanation",
        "space": "O(n)",
        "spaceExplain": "Explanation"
      },
      "code": {
        "python": "# Complete Python solution",
        "javascript": "// Complete JavaScript solution",
        "java": "// Complete Java solution",
        "cpp": "// Complete C++ solution",
        "go": "// Complete Go solution",
        "c": "// Complete C solution"
      },
      "visualization": {
        "title": "Visualization title",
        "description": "Brief description",
        "steps": [{"stepNumber": 1, "title": "Step title", "description": "Step description"}],
        "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 700 450\\">...</svg>"
      }
    },
    "one-pass-hash": {
      "title": "One-Pass Hash Table (Optimal)",
      "icon": "⚡",
      "summary": "Build hash map and search simultaneously in one pass",
      "description": "Detailed description",
      "steps": ["Step 1", "Step 2", "..."],
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "complexity": {
        "time": "O(n)",
        "timeExplain": "Explanation",
        "space": "O(n)",
        "spaceExplain": "Explanation"
      },
      "code": {
        "python": "# Complete optimal Python solution",
        "javascript": "// Complete optimal JavaScript solution",
        "java": "// Complete optimal Java solution",
        "cpp": "// Complete optimal C++ solution",
        "go": "// Complete optimal Go solution",
        "c": "// Complete optimal C solution"
      },
      "visualization": {
        "title": "Visualization title",
        "description": "Brief description",
        "steps": [{"stepNumber": 1, "title": "Step title", "description": "Step description"}],
        "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 800 500\\">...</svg>"
      }
    },
    "two-pointers": {
      "title": "Two Pointers (Sorted Array)",
      "icon": "👉👈",
      "summary": "Sort array and use two pointers from both ends",
      "description": "Detailed description",
      "steps": ["Step 1", "Step 2", "..."],
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "complexity": {
        "time": "O(n log n)",
        "timeExplain": "Explanation",
        "space": "O(n)",
        "spaceExplain": "Explanation"
      },
      "code": {
        "python": "# Complete Python solution",
        "javascript": "// Complete JavaScript solution",
        "java": "// Complete Java solution",
        "cpp": "// Complete C++ solution",
        "go": "// Complete Go solution",
        "c": "// Complete C solution"
      },
      "visualization": {
        "title": "Visualization title",
        "description": "Brief description",
        "steps": [{"stepNumber": 1, "title": "Step title", "description": "Step description"}],
        "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 700 480\\">...</svg>"
      }
    },
    "binary-search": {
      "title": "Sorting + Binary Search",
      "icon": "🔍",
      "summary": "Sort array, then binary search for complement of each element",
      "description": "Detailed description",
      "steps": ["Step 1", "Step 2", "..."],
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "complexity": {
        "time": "O(n log n)",
        "timeExplain": "Explanation",
        "space": "O(n)",
        "spaceExplain": "Explanation"
      },
      "code": {
        "python": "# Complete Python solution",
        "javascript": "// Complete JavaScript solution",
        "java": "// Complete Java solution",
        "cpp": "// Complete C++ solution",
        "go": "// Complete Go solution",
        "c": "// Complete C solution"
      },
      "visualization": {
        "title": "Visualization title",
        "description": "Brief description",
        "steps": [{"stepNumber": 1, "title": "Step title", "description": "Step description"}],
        "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 650 500\\">...</svg>"
      }
    }
  },
  "examples": [
    {
      "id": 1,
      "title": "example_1.py — Python",
      "input": "Formatted input",
      "output": "Expected output",
      "explanation": "Why this is the answer"
    },
    {
      "id": 2,
      "title": "example_2.py — Python",
      "input": "Another input",
      "output": "Expected output",
      "explanation": "Explanation"
    },
    {
      "id": 3,
      "title": "example_3.py — Python",
      "input": "Edge case input",
      "output": "Expected output",
      "explanation": "Edge case explanation"
    }
  ],
  "testCases": [
    {
      "id": 1,
      "input": {"param1": "value1", "param2": "value2"},
      "expected": "expected output",
      "explanation": "Test case explanation"
    },
    {
      "id": 2,
      "input": {"param1": "value1", "param2": "value2"},
      "expected": "expected output",
      "explanation": "Another test case"
    }
  ],
  "constraints": [
    "Constraint 1 (use <sup> for exponents like 10<sup>4</sup>)",
    "Constraint 2",
    "<strong>Important constraint</strong>"
  ],
  "defaultCode": {
    "python": "def solution():\\n    # Write your code here\\n    pass\\n\\n# Parse input\\nimport ast\\ndata = ast.literal_eval(input())\\nprint(solution(data))",
    "javascript": "function solution() {\\n    // Write your code here\\n    return [];\\n}\\n\\nconst lines = require('fs').readFileSync(0, 'utf8').trim().split('\\\\n');\\nconsole.log(JSON.stringify(solution(JSON.parse(lines[0]))));",
    "java": "import java.util.*;\\n\\nclass Main {\\n    public static void solution() {\\n        // Write your code here\\n    }\\n    \\n    public static void main(String[] args) {\\n        Scanner sc = new Scanner(System.in);\\n        // Parse input and call solution\\n    }\\n}",
    "cpp": "#include <iostream>\\n#include <vector>\\nusing namespace std;\\n\\nvoid solution() {\\n    // Write your code here\\n}\\n\\nint main() {\\n    // Parse input and call solution\\n    return 0;\\n}",
    "go": "package main\\n\\nimport (\\n    \\"fmt\\"\\n)\\n\\nfunc solution() {\\n    // Write your code here\\n}\\n\\nfunc main() {\\n    // Parse input and call solution\\n}",
    "c": "#include <stdio.h>\\n#include <stdlib.h>\\n\\nvoid solution() {\\n    // Write your code here\\n}\\n\\nint main() {\\n    // Parse input and call solution\\n    return 0;\\n}"
  },
  "solutionSummary": "Brief HTML summary highlighting the optimal approach with <strong> tags for key terms",
  "visualize": {
    "title": "Visual explanation title",
    "description": "Real-world analogy description",
    "steps": [
      {"stepNumber": 1, "title": "Step title", "description": "Step description"}
    ],
    "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 800 500\\">...</svg>",
    "conclusion": "🎯 **Key Insight:** Summary of the key insight"
  },
  "companies": [
    {"name": "Google", "logo": "G", "class": "google", "count": 50},
    {"name": "Amazon", "logo": "a", "class": "amazon", "count": 40},
    {"name": "Meta", "logo": "f", "class": "meta", "count": 30},
    {"name": "Microsoft", "logo": "⊞", "class": "microsoft", "count": 20}
  ],
  "stats": {
    "acceptance": "45.0%",
    "avgTime": "~20 min",
    "frequency": "High",
    "likes": 1200,
    "views": 45000
  },
  "seo": {
    "title": "Problem Name - Category | Practice Coding Problems | Tutorials Point",
    "description": "Master the problem with detailed solutions in 6 languages...",
    "keywords": ["keyword1", "keyword2", "algorithm", "coding interview"],
    "ogImage": "/practice/images/problem-og.png",
    "canonical": "https://www.tutorialspoint.com/practice/problem-slug.htm"
  }
}

IMPORTANT REQUIREMENTS:
1. All code must be COMPLETE and WORKING - not pseudocode
2. Include proper input parsing for each language
3. SVG visualizations should be detailed and educational
4. Test cases should cover edge cases
5. Explanations should be beginner-friendly
6. Use proper escaping for JSON strings (\\n for newlines, \\" for quotes)
7. Stats must be LOGICAL: views should be 20-50x more than likes (typical engagement rate is 2-5%)

Return ONLY the JSON object, no markdown formatting or extra text.`;
}

/**
 * Attempt to fix truncated/malformed JSON
 */
function fixTruncatedJson(jsonStr) {
  let fixed = jsonStr;
  
  // Count open brackets/braces
  let openBraces = (fixed.match(/{/g) || []).length;
  let closeBraces = (fixed.match(/}/g) || []).length;
  let openBrackets = (fixed.match(/\[/g) || []).length;
  let closeBrackets = (fixed.match(/\]/g) || []).length;
  
  // Remove trailing incomplete elements
  fixed = fixed.replace(/,\s*[^}\]"'\d\w]*$/, '');
  
  // Remove incomplete string at the end
  const lastCompleteIdx = Math.max(
    fixed.lastIndexOf('}'),
    fixed.lastIndexOf(']'),
    fixed.lastIndexOf('true'),
    fixed.lastIndexOf('false'),
    fixed.lastIndexOf('null')
  );
  
  // If there's an unclosed string, remove it
  const quotesAfterComplete = (fixed.substring(lastCompleteIdx).match(/"/g) || []).length;
  if (quotesAfterComplete % 2 !== 0) {
    const lastCommaBeforeEnd = fixed.lastIndexOf(',', lastCompleteIdx);
    if (lastCommaBeforeEnd > 0) {
      fixed = fixed.substring(0, lastCommaBeforeEnd);
    }
  }
  
  // Recount after fixes
  openBraces = (fixed.match(/{/g) || []).length;
  closeBraces = (fixed.match(/}/g) || []).length;
  openBrackets = (fixed.match(/\[/g) || []).length;
  closeBrackets = (fixed.match(/\]/g) || []).length;
  
  // Add missing closing brackets/braces
  while (closeBrackets < openBrackets) {
    fixed += ']';
    closeBrackets++;
  }
  while (closeBraces < openBraces) {
    fixed += '}';
    closeBraces++;
  }
  
  return fixed;
}

/**
 * Read Excel and prepare problems
 */
function prepareProblemsFromExcel(excelPath, limit = null) {
  console.log(`📖 Reading Excel file: ${excelPath}`);
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Found ${data.length} problems in Excel`);
  if (limit) console.log(`🔢 Limiting to first ${limit} problems for testing`);
  console.log('');
  
  const problems = [];
  const maxProblems = limit || data.length;
  
  for (let i = 0; i < Math.min(data.length, maxProblems); i++) {
    const row = data[i];
    const problemName = row['Problem Name'];
    
    if (!problemName) {
      console.log(`⚠️  Skipping row ${i + 1}: No problem name`);
      continue;
    }
    
    const topics = parseTopics(row['Topics']);
    const difficulty = row['Difficulty'] || 'Medium';
    const description = row['Description'] || '';
    const relatedProblems = parseRelatedProblems(row);
    const problemId = generateSlug(problemName);
    const customId = generateCustomId(problemId, i); // For batch API (max 64 chars)
    
    problems.push({
      index: i,
      row: row,
      problemId: problemId,        // Full slug for Firebase
      customId: customId,          // Truncated for batch API
      problemName: problemName,
      topics: topics,
      difficulty: difficulty,
      description: description,
      relatedProblems: relatedProblems
    });
  }
  
  return problems;
}

// ==================== TEST MODE ====================

async function runTestMode(excelPath, testCount = 2) {
  initFirebase();
  
  console.log('========================================');
  console.log('🧪 TEST MODE - Verifying Setup');
  console.log(`   Processing ${testCount} problem(s) with real-time API`);
  console.log('========================================\n');
  
  const problems = prepareProblemsFromExcel(excelPath, testCount);
  
  if (problems.length === 0) {
    console.error('❌ No problems found in Excel file');
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  
  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    
    console.log(`\n[${i + 1}/${problems.length}] Testing: ${problem.problemName}`);
    console.log('─'.repeat(50));
    console.log(`    📌 Problem ID: ${problem.problemId}`);
    console.log(`    📌 Difficulty: ${problem.difficulty}`);
    console.log(`    🏷️  Topics: ${problem.topics.join(', ')}`);
    console.log(`    🔗 Related: ${problem.relatedProblems.length} problems`);
    
    try {
      console.log(`    🤖 Calling Claude API (real-time)...`);
      
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 20000,
        messages: [{
          role: 'user',
          content: generatePrompt(
            problem.problemName,
            problem.description,
            problem.topics,
            problem.difficulty,
            problem.relatedProblems,
            problem.problemId
          )
        }]
      });
      
      const inputTokens = message.usage?.input_tokens || 0;
      const outputTokens = message.usage?.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 3;
      const outputCost = (outputTokens / 1000000) * 15;
      const cost = inputCost + outputCost;
      
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCost += cost;
      
      console.log(`    📊 Tokens - Input: ${inputTokens.toLocaleString()}, Output: ${outputTokens.toLocaleString()}, Total: ${(inputTokens + outputTokens).toLocaleString()}`);
      console.log(`    💰 Cost - Input: $${inputCost.toFixed(4)}, Output: $${outputCost.toFixed(4)}, Total: $${cost.toFixed(4)}`);
      
      // Check if truncated
      if (message.stop_reason === 'max_tokens') {
        console.log(`    ⚠️  Warning: Response was truncated (hit max_tokens limit)`);
      }
      
      // Parse response
      const responseText = message.content[0]?.text || '';
      let generatedContent = null;
      
      try {
        generatedContent = JSON.parse(responseText);
        console.log(`    ✅ JSON parsed successfully`);
      } catch (e) {
        console.log(`    ⚠️  JSON parse failed, attempting recovery...`);
        
        // Try markdown extraction
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            generatedContent = JSON.parse(jsonMatch[1]);
            console.log(`    ✅ JSON extracted from markdown`);
          } catch (e2) {}
        }
        
        if (!generatedContent) {
          const startIdx = responseText.indexOf('{');
          const endIdx = responseText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            let jsonStr = responseText.substring(startIdx, endIdx + 1);
            try {
              generatedContent = JSON.parse(jsonStr);
              console.log(`    ✅ JSON recovered successfully`);
            } catch (e3) {
              console.log(`    🔧 Attempting to fix malformed JSON...`);
              jsonStr = fixTruncatedJson(jsonStr);
              try {
                generatedContent = JSON.parse(jsonStr);
                console.log(`    ✅ JSON fixed and recovered`);
              } catch (e4) {
                console.log(`    ❌ Failed to parse JSON response`);
              }
            }
          }
        }
      }
      
      // Verify content structure
      if (generatedContent) {
        const hasDescription = !!generatedContent.description;
        const approachCount = Object.keys(generatedContent.approaches || {}).length;
        const exampleCount = (generatedContent.examples || []).length;
        const hasCode = Object.keys((generatedContent.approaches?.['brute-force']?.code) || {}).length > 0;
        
        console.log(`    📋 Content Check:`);
        console.log(`       - Description: ${hasDescription ? '✅' : '❌'}`);
        console.log(`       - Approaches: ${approachCount > 0 ? '✅' : '❌'} (${approachCount} found)`);
        console.log(`       - Examples: ${exampleCount > 0 ? '✅' : '❌'} (${exampleCount} found)`);
        console.log(`       - Code: ${hasCode ? '✅' : '❌'}`);
        
        // Add token usage
        generatedContent._tokenUsage = {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          inputCost,
          outputCost,
          totalCost: cost
        };
      }
      
      // Build and upload document
      const problemDoc = buildProblemDocument(problem.row, generatedContent, problem.index + 1);
      const uploaded = await uploadToFirebase(problemDoc);
      
      if (uploaded) {
        successCount++;
        console.log(`    ✅ Uploaded to Firebase successfully!`);
      } else {
        failCount++;
        console.log(`    ❌ Failed to upload to Firebase`);
      }
      
      // Small delay between requests
      if (i < problems.length - 1) {
        console.log('    ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`    ❌ Error: ${error.message}`);
      failCount++;
    }
  }
  
  // Calculate estimates for full batch
  const workbook = xlsx.readFile(excelPath);
  const totalProblemsInExcel = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).length;
  const avgCostPerProblem = totalCost / problems.length;
  const estimatedFullCostRealtime = avgCostPerProblem * totalProblemsInExcel;
  const estimatedFullCostBatch = estimatedFullCostRealtime * 0.5;
  
  // Summary
  console.log('\n========================================');
  console.log('🧪 TEST SUMMARY');
  console.log('========================================');
  console.log(`✅ Successful: ${successCount}/${problems.length}`);
  console.log(`❌ Failed: ${failCount}/${problems.length}`);
  console.log('────────────────────────────────────────');
  console.log('💰 TEST COST');
  console.log('────────────────────────────────────────');
  console.log(`📥 Input Tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`📤 Output Tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`📊 Total Tokens:  ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`💵 Test Cost:     $${totalCost.toFixed(4)}`);
  console.log('────────────────────────────────────────');
  console.log('📊 FULL BATCH ESTIMATE');
  console.log('────────────────────────────────────────');
  console.log(`📦 Total Problems: ${totalProblemsInExcel}`);
  console.log(`💵 Real-time API:  ~$${estimatedFullCostRealtime.toFixed(2)}`);
  console.log(`💵 Batch API:      ~$${estimatedFullCostBatch.toFixed(2)} (50% off!)`);
  console.log(`💰 You'd Save:     ~$${(estimatedFullCostRealtime - estimatedFullCostBatch).toFixed(2)}`);
  console.log('========================================');
  
  if (successCount === problems.length) {
    console.log('\n✅ TEST PASSED! Everything looks good.');
    console.log('   You can now run the full batch:');
    console.log(`   node upload_coding_problems_batch.js ${excelPath} --create-batch\n`);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above before running full batch.\n');
  }
}

// ==================== BATCH FUNCTIONS ====================

async function createBatch(excelPath) {
  const problems = prepareProblemsFromExcel(excelPath);
  
  console.log('========================================');
  console.log('🚀 Creating Batch Request (50% cheaper!)');
  console.log('========================================\n');
  
  const batchRequests = problems.map(problem => ({
    custom_id: problem.customId,  // Use truncated customId (max 64 chars)
    params: {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 20000,
      messages: [{
        role: 'user',
        content: generatePrompt(
          problem.problemName,
          problem.description,
          problem.topics,
          problem.difficulty,
          problem.relatedProblems,
          problem.problemId
        )
      }]
    }
  }));
  
  console.log(`📦 Preparing ${batchRequests.length} requests for batch processing...`);
  console.log(`📊 Estimated cost: ~$${(batchRequests.length * 0.21 * 0.5).toFixed(2)} (with 50% batch discount)`);
  
  try {
    const batch = await anthropic.messages.batches.create({ requests: batchRequests });
    
    console.log('\n✅ Batch created successfully!');
    console.log('────────────────────────────────────────');
    console.log(`📋 Batch ID: ${batch.id}`);
    console.log(`📊 Total Requests: ${batchRequests.length}`);
    console.log(`⏰ Status: ${batch.processing_status}`);
    console.log(`🕐 Created: ${batch.created_at}`);
    console.log('────────────────────────────────────────');
    console.log('\n💡 Next Steps:');
    console.log(`   1. Wait for batch to complete (up to 24 hours, usually much faster)`);
    console.log(`   2. Check status: node upload_coding_problems_batch.js ${excelPath} --check-batch ${batch.id}`);
    console.log(`   3. Process results: node upload_coding_problems_batch.js ${excelPath} --process-results ${batch.id}`);
    
    // Save batch info
    const batchInfo = {
      batchId: batch.id,
      createdAt: batch.created_at,
      totalRequests: batchRequests.length,
      problems: problems.map(p => ({ 
        customId: p.customId,  // For result mapping
        problemId: p.problemId, // Full slug for Firebase
        name: p.problemName 
      })),
      excelPath: excelPath
    };
    
    fs.writeFileSync(`batch_${batch.id}.json`, JSON.stringify(batchInfo, null, 2));
    console.log(`\n📁 Batch info saved to: batch_${batch.id}.json`);
    
    return batch;
  } catch (error) {
    console.error('❌ Error creating batch:', error.message);
    throw error;
  }
}

async function checkBatchStatus(batchId) {
  console.log('========================================');
  console.log('🔍 Checking Batch Status');
  console.log('========================================\n');
  
  try {
    const batch = await anthropic.messages.batches.retrieve(batchId);
    
    console.log(`📋 Batch ID: ${batch.id}`);
    console.log(`⏰ Status: ${batch.processing_status}`);
    console.log(`🕐 Created: ${batch.created_at}`);
    
    if (batch.request_counts) {
      const { succeeded = 0, errored = 0, processing = 0, canceled = 0 } = batch.request_counts;
      const total = succeeded + errored + processing + canceled;
      const completed = succeeded + errored;
      const percent = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
      
      console.log('────────────────────────────────────────');
      console.log('📊 Progress:');
      console.log(`   ✅ Succeeded:  ${succeeded}`);
      console.log(`   ❌ Errored:    ${errored}`);
      console.log(`   ⏳ Processing: ${processing}`);
      console.log(`   🚫 Canceled:   ${canceled}`);
      console.log(`   📈 Progress:   ${percent}%`);
    }
    
    if (batch.processing_status === 'ended') {
      console.log('\n✅ Batch processing complete!');
      console.log(`   Run: node upload_coding_problems_batch.js <excel_file> --process-results ${batchId}`);
    } else if (batch.processing_status === 'in_progress') {
      console.log('\n⏳ Batch still processing. Check again in a few minutes.');
    } else {
      console.log(`\n⏰ Status: ${batch.processing_status}`);
    }
    
    return batch;
  } catch (error) {
    console.error('❌ Error checking batch:', error.message);
    throw error;
  }
}

async function processResults(excelPath, batchId) {
  initFirebase();
  
  console.log('========================================');
  console.log('📥 Processing Batch Results');
  console.log('========================================\n');
  
  // Check if batch is complete
  const batch = await anthropic.messages.batches.retrieve(batchId);
  
  if (batch.processing_status !== 'ended') {
    console.log(`⚠️  Batch is not yet complete. Status: ${batch.processing_status}`);
    console.log('   Please wait for the batch to finish processing.');
    return;
  }
  
  // Read problems from Excel
  const problems = prepareProblemsFromExcel(excelPath);
  const problemMap = {};
  problems.forEach(p => { problemMap[p.customId] = p; }); // Map by customId
  
  console.log(`📦 Fetching results for batch: ${batchId}`);
  
  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  try {
    const results = await anthropic.messages.batches.results(batchId);
    
    for await (const result of results) {
      const customId = result.custom_id;
      const problem = problemMap[customId];
      
      if (!problem) {
        console.log(`⚠️  Unknown custom_id: ${customId}`);
        continue;
      }
      
      console.log(`\n[${problem.problemId}] ${problem.problemName}`);
      
      if (result.result.type === 'succeeded') {
        const message = result.result.message;
        
        // Track tokens
        if (message.usage) {
          totalInputTokens += message.usage.input_tokens || 0;
          totalOutputTokens += message.usage.output_tokens || 0;
        }
        
        // Parse response
        const responseText = message.content[0]?.text || '';
        let generatedContent = null;
        
        try {
          generatedContent = JSON.parse(responseText);
        } catch (e) {
          // Try markdown extraction
          const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            try { generatedContent = JSON.parse(jsonMatch[1]); } catch (e2) {}
          }
          
          if (!generatedContent) {
            const startIdx = responseText.indexOf('{');
            const endIdx = responseText.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1) {
              let jsonStr = responseText.substring(startIdx, endIdx + 1);
              try {
                generatedContent = JSON.parse(jsonStr);
              } catch (e3) {
                jsonStr = fixTruncatedJson(jsonStr);
                try { generatedContent = JSON.parse(jsonStr); } catch (e4) {
                  console.log(`   ⚠️  Failed to parse JSON response`);
                }
              }
            }
          }
        }
        
        // Build and upload document
        const problemDoc = buildProblemDocument(problem.row, generatedContent, problem.index + 1);
        const uploaded = await uploadToFirebase(problemDoc);
        
        if (uploaded) {
          successCount++;
          console.log(`   ✅ Uploaded to Firebase`);
        } else {
          failCount++;
        }
        
      } else if (result.result.type === 'errored') {
        console.log(`   ❌ Error: ${result.result.error?.message || 'Unknown error'}`);
        failCount++;
      } else {
        console.log(`   ⚠️  Unexpected result type: ${result.result.type}`);
        failCount++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error fetching results:', error.message);
    throw error;
  }
  
  // Calculate costs (Batch API = 50% off)
  const inputCost = (totalInputTokens / 1000000) * 1.5;  // $3 * 0.5
  const outputCost = (totalOutputTokens / 1000000) * 7.5; // $15 * 0.5
  const totalCost = inputCost + outputCost;
  const standardCost = (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;
  const savedAmount = standardCost - totalCost;
  
  // Summary
  console.log('\n========================================');
  console.log('📊 UPLOAD SUMMARY');
  console.log('========================================');
  console.log(`✅ Successfully uploaded: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total processed: ${successCount + failCount}`);
  console.log('────────────────────────────────────────');
  console.log('💰 TOKEN USAGE & COST (BATCH - 50% OFF!)');
  console.log('────────────────────────────────────────');
  console.log(`📥 Total Input Tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`📤 Total Output Tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`📊 Total Tokens:        ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`💵 Batch Cost:          $${totalCost.toFixed(4)}`);
  console.log(`💵 Standard would be:   $${standardCost.toFixed(4)}`);
  console.log(`💰 YOU SAVED:           $${savedAmount.toFixed(4)} (50%!)`);
  console.log('========================================\n');
}

async function listBatches() {
  console.log('========================================');
  console.log('📋 Listing All Batches');
  console.log('========================================\n');
  
  try {
    const batches = await anthropic.messages.batches.list({ limit: 20 });
    
    if (!batches.data || batches.data.length === 0) {
      console.log('No batches found.');
      return;
    }
    
    for (const batch of batches.data) {
      console.log(`📋 ${batch.id}`);
      console.log(`   Status: ${batch.processing_status}`);
      console.log(`   Created: ${batch.created_at}`);
      if (batch.request_counts) {
        console.log(`   Requests: ${batch.request_counts.succeeded || 0} succeeded, ${batch.request_counts.errored || 0} errored, ${batch.request_counts.processing || 0} processing`);
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error listing batches:', error.message);
  }
}

// ==================== FIREBASE FUNCTIONS ====================

function buildProblemDocument(row, generatedContent, problemNumber) {
  const problemName = row['Problem Name'];
  const slug = generateSlug(problemName);
  const problemId = slug;
  const topics = parseTopics(row['Topics']);
  const difficulty = row['Difficulty'] || 'Medium';
  const description = row['Description'] || '';
  const relatedProblems = parseRelatedProblems(row);
  
  // Base document structure
  const doc = {
    id: slug,
    problem_id: problemId,
    slug: slug,
    number: problemNumber,
    title: problemName,
    description: description,
    descriptionText: description.replace(/<[^>]*>/g, ''),
    difficulty: difficulty,
    level: difficulty,
    category: topics[0] || 'Algorithm',
    tags: topics,
    topics: ['Data Structures', 'Algorithms'],
    related: relatedProblems,
    status: null,
    likes: 1,
    views: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    analogy: null,
    approaches: {},
    examples: [],
    testCases: [],
    constraints: [],
    defaultCode: {},
    solutionSummary: '',
    visualize: null,
    companies: [],
    stats: {
      acceptance: '50.0%',
      avgTime: '~15 min',
      frequency: 'Medium',
      likes: 850,
      views: 25000
    },
    seo: {
      title: `${problemName} - ${topics[0] || 'Algorithm'} | Practice Coding Problems | Tutorials Point`,
      description: `Master the ${problemName} problem with detailed solutions in 6 languages.`,
      keywords: [...topics, 'algorithm', 'coding interview', 'practice'],
      ogImage: `/practice/images/${slug}-og.png`,
      canonical: `https://www.tutorialspoint.com/practice/${slug}.htm`
    }
  };
  
  // Merge generated content
  if (generatedContent) {
    if (generatedContent.description) {
      doc.description = generatedContent.description;
    }
    if (generatedContent.descriptionText) {
      doc.descriptionText = generatedContent.descriptionText;
    }
    
    Object.assign(doc, {
      analogy: generatedContent.analogy || null,
      approaches: generatedContent.approaches || {},
      examples: generatedContent.examples || [],
      testCases: generatedContent.testCases || [],
      constraints: generatedContent.constraints || [],
      defaultCode: generatedContent.defaultCode || {},
      solutionSummary: generatedContent.solutionSummary || '',
      visualize: generatedContent.visualize || null,
      companies: generatedContent.companies || [],
      stats: generatedContent.stats || doc.stats,
      seo: generatedContent.seo || doc.seo
    });
    
    // Ensure views > likes
    if (doc.stats) {
      const likes = doc.stats.likes || 1000;
      const views = doc.stats.views || 0;
      if (views < likes * 20) {
        const multiplier = Math.floor(Math.random() * 16) + 25;
        doc.stats.views = likes * multiplier;
      }
    }
    
    // Store token usage
    if (generatedContent._tokenUsage) {
      doc._generationMeta = {
        tokenUsage: generatedContent._tokenUsage,
        generatedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514'
      };
    }
  }
  
  return doc;
}

async function uploadToFirebase(problemDoc) {
  try {
    const docRef = db.collection(COLLECTION_NAME).doc(problemDoc.id);
    await docRef.set(problemDoc, { merge: true });
    return true;
  } catch (error) {
    console.error(`   ❌ Firebase upload error for ${problemDoc.title}:`, error.message);
    return false;
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('========================================');
    console.log('🚀 Coding Problems Uploader - BATCH VERSION');
    console.log('   (50% cheaper than standard API!)');
    console.log('========================================\n');
    console.log('RECOMMENDED: Test first with 1-2 problems:');
    console.log('  node upload_coding_problems_batch.js <excel_file> --test 2\n');
    console.log('Then run full batch:');
    console.log('  Step 1: node upload_coding_problems_batch.js <excel_file> --create-batch');
    console.log('  Step 2: node upload_coding_problems_batch.js <excel_file> --check-batch <batch_id>');
    console.log('  Step 3: node upload_coding_problems_batch.js <excel_file> --process-results <batch_id>\n');
    console.log('Other commands:');
    console.log('  node upload_coding_problems_batch.js --list-batches\n');
    process.exit(1);
  }
  
  // Handle --list-batches
  if (args[0] === '--list-batches') {
    await listBatches();
    process.exit(0);
  }
  
  const excelPath = args[0];
  const command = args[1];
  const param = args[2];
  
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    process.exit(1);
  }
  
  switch (command) {
    case '--test':
      const testCount = parseInt(param) || 2;
      await runTestMode(excelPath, testCount);
      break;
      
    case '--create-batch':
      await createBatch(excelPath);
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
      await processResults(excelPath, param);
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('\nAvailable commands:');
      console.log('  --test [count]           Test with 1-2 problems first (recommended!)');
      console.log('  --create-batch           Create batch for all problems');
      console.log('  --check-batch <id>       Check batch status');
      console.log('  --process-results <id>   Download results & upload to Firebase');
      process.exit(1);
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
