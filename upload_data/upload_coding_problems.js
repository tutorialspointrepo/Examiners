/**
 * Coding Problems Uploader
 * Reads problems from Excel, generates rich content via Claude AI, uploads to Firebase
 * 
 * Usage: node upload_coding_problems.js <excel_file_path>
 * Example: node upload_coding_problems.js ./Leetcode.xlsx
 */

const admin = require('firebase-admin');
const xlsx = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json'); // Your Firebase service account
const ANTHROPIC_API_KEY = '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';
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

// ==================== INITIALIZE SERVICES ====================
// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// Initialize Anthropic Client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate URL-friendly slug from problem name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Parse related problems from R1-R5 columns
 * Format: "Problem Name | Difficulty"
 */
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
          category: 'Array', // Default, will be updated by AI
          similarity: 'medium'
        });
      }
    }
  });
  
  return related;
}

/**
 * Parse topics/tags from Topics column
 */
function parseTopics(topicsStr) {
  if (!topicsStr) return [];
  return topicsStr.split(',').map(t => t.trim()).filter(t => t);
}

/**
 * Generate rich problem content using Claude AI
 */
async function generateProblemContent(problemName, description, topics, difficulty, relatedProblems, problemId) {
  const prompt = `You are an expert algorithm instructor creating educational content for a coding practice platform similar to LeetCode.

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

  try {
    console.log(`    🤖 Calling Claude API for: ${problemName}`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 20000,  // Increased to avoid truncation
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const responseText = message.content[0].text;
    
    // Extract token usage
    const inputTokens = message.usage?.input_tokens || 0;
    const outputTokens = message.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    // Calculate cost (Claude Sonnet pricing: $3/1M input, $15/1M output)
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    const totalCost = inputCost + outputCost;
    
    console.log(`    📊 Tokens - Input: ${inputTokens.toLocaleString()}, Output: ${outputTokens.toLocaleString()}, Total: ${totalTokens.toLocaleString()}`);
    console.log(`    💰 Cost - Input: $${inputCost.toFixed(4)}, Output: $${outputCost.toFixed(4)}, Total: $${totalCost.toFixed(4)}`);
    
    // Check if response was truncated (hit max_tokens)
    if (message.stop_reason === 'max_tokens') {
      console.log(`    ⚠️  Warning: Response was truncated (hit max_tokens limit)`);
    }
    
    // Try to parse JSON from response
    let jsonContent;
    try {
      // Try direct parse first
      jsonContent = JSON.parse(responseText);
    } catch (e) {
      console.log(`    ⚠️  JSON parse failed, attempting recovery...`);
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          jsonContent = JSON.parse(jsonMatch[1]);
        } catch (e2) {
          // Continue to next recovery method
        }
      }
      
      if (!jsonContent) {
        // Try to find JSON object in response
        const startIdx = responseText.indexOf('{');
        const endIdx = responseText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          let jsonStr = responseText.substring(startIdx, endIdx + 1);
          
          try {
            jsonContent = JSON.parse(jsonStr);
          } catch (e3) {
            // Try to fix common JSON issues
            console.log(`    🔧 Attempting to fix malformed JSON...`);
            
            // Fix truncated arrays - find last complete element
            jsonStr = fixTruncatedJson(jsonStr);
            
            try {
              jsonContent = JSON.parse(jsonStr);
              console.log(`    ✅ JSON recovered successfully`);
            } catch (e4) {
              throw new Error(`Could not parse or recover JSON: ${e4.message}`);
            }
          }
        } else {
          throw new Error('Could not extract JSON from response');
        }
      }
    }
    
    // Add token usage to response
    jsonContent._tokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      inputCost,
      outputCost,
      totalCost
    };
    
    console.log(`    ✅ Generated content for: ${problemName}`);
    return jsonContent;
    
  } catch (error) {
    console.error(`    ❌ Error generating content for ${problemName}:`, error.message);
    return null;
  }
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
  // Find last complete structure (ends with }, ], ", number, true, false, null)
  fixed = fixed.replace(/,\s*[^}\]"'\d\w]*$/, '');
  
  // Remove incomplete string at the end
  const lastQuoteIdx = fixed.lastIndexOf('"');
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
    // Find the start of the incomplete key-value pair
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
 * Build complete problem document for Firebase
 */
function buildProblemDocument(row, generatedContent, problemNumber) {
  const problemName = row['Problem Name'];
  const slug = generateSlug(problemName);
  const problemId = slug; // problem_id is same as slug (lowercase with hyphens)
  const topics = parseTopics(row['Topics']);
  const difficulty = row['Difficulty'] || 'Medium';
  const description = row['Description'] || '';
  const relatedProblems = parseRelatedProblems(row);
  
  // Base document structure
  const doc = {
    id: slug,
    problem_id: problemId, // New field: lowercase with hyphens
    slug: slug,
    number: problemNumber,
    title: problemName,
    description: description,
    descriptionText: description.replace(/<[^>]*>/g, ''), // Strip HTML
    difficulty: difficulty,
    level: difficulty,
    category: topics[0] || 'Algorithm',
    tags: topics,
    topics: ['Data Structures', 'Algorithms'],
    related: relatedProblems,
    status: null,
    likes: 1,
    views: 0,
    
    // Timestamps
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    
    // Default values (will be overwritten by generated content)
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
      views: 25000  // Views should be ~30x more than likes (realistic engagement rate ~3%)
    },
    seo: {
      title: `${problemName} - ${topics[0] || 'Algorithm'} | Practice Coding Problems | Tutorials Point`,
      description: `Master the ${problemName} problem with detailed solutions in 6 languages.`,
      keywords: [...topics, 'algorithm', 'coding interview', 'practice'],
      ogImage: `/practice/images/${slug}-og.png`,
      canonical: `https://www.tutorialspoint.com/practice/${slug}.htm`
    }
  };
  
  // Merge generated content if available
  if (generatedContent) {
    // Use AI-generated description if available (it's rewritten to be clearer)
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
    
    // Ensure views > likes in stats (realistic: views should be 20-50x likes)
    if (doc.stats) {
      const likes = doc.stats.likes || 1000;
      const views = doc.stats.views || 0;
      
      // If views is less than 20x likes, fix it
      if (views < likes * 20) {
        // Random multiplier between 25-40x for variety
        const multiplier = Math.floor(Math.random() * 16) + 25; // 25-40
        doc.stats.views = likes * multiplier;
      }
    }
    
    // Store token usage for reference (optional - remove if not needed in DB)
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

/**
 * Upload problem to Firebase
 */
async function uploadToFirebase(problemDoc) {
  try {
    const docRef = db.collection(COLLECTION_NAME).doc(problemDoc.id);
    await docRef.set(problemDoc, { merge: true });
    console.log(`    ✅ Uploaded to Firebase: ${problemDoc.title}`);
    return true;
  } catch (error) {
    console.error(`    ❌ Firebase upload error for ${problemDoc.title}:`, error.message);
    return false;
  }
}

/**
 * Main function to process Excel and upload problems
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node upload_coding_problems.js <excel_file_path>');
    console.log('Example: node upload_coding_problems.js ./Leetcode.xlsx');
    process.exit(1);
  }
  
  const excelPath = args[0];
  
  console.log('========================================');
  console.log('🚀 Coding Problems Uploader');
  console.log('========================================\n');
  
  // Read Excel file
  console.log(`📖 Reading Excel file: ${excelPath}`);
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Found ${data.length} problems to process\n`);
  
  // Process each problem
  let successCount = 0;
  let failCount = 0;
  
  // Token tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const problemName = row['Problem Name'];
    
    if (!problemName) {
      console.log(`⚠️  Skipping row ${i + 1}: No problem name`);
      continue;
    }
    
    console.log(`\n[${i + 1}/${data.length}] Processing: ${problemName}`);
    console.log('─'.repeat(50));
    
    try {
      // Parse basic info
      const topics = parseTopics(row['Topics']);
      const difficulty = row['Difficulty'] || 'Medium';
      const description = row['Description'] || '';
      const relatedProblems = parseRelatedProblems(row);
      
      // Generate problem_id from title (lowercase with hyphens)
      const problemId = generateSlug(problemName);
      
      console.log(`    📌 Problem ID: ${problemId}`);
      console.log(`    📌 Difficulty: ${difficulty}`);
      console.log(`    🏷️  Topics: ${topics.join(', ')}`);
      console.log(`    🔗 Related: ${relatedProblems.length} problems`);
      
      // Generate rich content using Claude
      const generatedContent = await generateProblemContent(
        problemName,
        description,
        topics,
        difficulty,
        relatedProblems,
        problemId
      );
      
      // Track tokens if content was generated
      if (generatedContent && generatedContent._tokenUsage) {
        totalInputTokens += generatedContent._tokenUsage.inputTokens;
        totalOutputTokens += generatedContent._tokenUsage.outputTokens;
        totalCost += generatedContent._tokenUsage.totalCost;
      }
      
      // Build complete document
      const problemDoc = buildProblemDocument(row, generatedContent, i + 1);
      
      // Upload to Firebase
      const uploaded = await uploadToFirebase(problemDoc);
      
      if (uploaded) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Rate limiting - wait between API calls
      if (i < data.length - 1) {
        console.log('    ⏳ Waiting 2 seconds before next problem...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`    ❌ Error processing ${problemName}:`, error.message);
      failCount++;
    }
  }
  
  // Summary
  console.log('\n========================================');
  console.log('📊 UPLOAD SUMMARY');
  console.log('========================================');
  console.log(`✅ Successfully uploaded: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total processed: ${data.length}`);
  console.log('────────────────────────────────────────');
  console.log('💰 TOKEN USAGE & COST');
  console.log('────────────────────────────────────────');
  console.log(`📥 Total Input Tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`📤 Total Output Tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`📊 Total Tokens:        ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`💵 Total Cost:          $${totalCost.toFixed(4)}`);
  console.log('========================================\n');
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});