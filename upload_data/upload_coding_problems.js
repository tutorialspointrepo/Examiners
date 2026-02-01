/**
 * Coding Problems Uploader
 * Reads problems from Excel, generates rich content via Claude AI, uploads to Firebase
 * Supports both CODING problems (6 languages) and SQL/DATABASE problems
 * 
 * Usage: node upload_coding_problems.js <excel_file_path>
 * Example: node upload_coding_problems.js ./problems.xlsx
 */

const admin = require('firebase-admin');
const xlsx = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const ANTHROPIC_API_KEY = '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';
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

// ==================== PROCESSING LIMIT ====================
const MAX_PROBLEMS_TO_PROCESS = 1; // Change this to process more problems

// ==================== INITIALIZE SERVICES ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

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
 * Detect if problem is SQL/Database type based on topics
 */
function isSQLProblem(topics) {
  const sqlKeywords = ['sql', 'database', 'mysql', 'postgresql', 'sqlite', 'window functions', 'joins', 'aggregation'];
  return topics.some(t => sqlKeywords.includes(t.toLowerCase()));
}

/**
 * Generate prompt for CODING problems
 */
function generateCodingPrompt(problemName, description, topics, difficulty, relatedProblems, problemId) {
  return `You are an expert algorithm instructor creating educational content for a coding practice platform.

Generate comprehensive, educational content for the following coding problem:

**Problem ID:** ${problemId}
**Problem Name:** ${problemName}
**Original Description:** ${description}
**Topics/Tags:** ${topics.join(', ')}
**Difficulty:** ${difficulty}
**Related Problems:** ${relatedProblems.map(r => r.title).join(', ') || 'None'}

Generate a complete JSON response. Be thorough and educational.

CRITICAL INSTRUCTIONS:

1. APPROACHES - Generate 2-5 APPROACHES based on what's applicable to THIS problem:
   
   COMMON APPROACH KEYS (use these exact keys):
   - "brute-force" - Always include first (naive solution, usually O(n²) or O(n³))
   - "optimized" - General optimized solution when no specific pattern fits
   
   ARRAY/STRING PATTERNS:
   - "two-pointers" - Two pointers moving toward each other or same direction
   - "sliding-window" - Fixed or variable size window problems
   - "prefix-sum" - Precompute cumulative sums for range queries
   - "kadane" - Maximum subarray problems (Kadane's algorithm)
   - "dutch-flag" - 3-way partitioning (0s, 1s, 2s problems)
   
   HASH/MAP PATTERNS:
   - "hash-map" - Single pass with hash map lookup
   - "two-pass-hash" - First pass build map, second pass query
   - "frequency-count" - Count occurrences using map
   
   SEARCH PATTERNS:
   - "binary-search" - O(log n) search on sorted data
   - "binary-search-answer" - Binary search on answer space
   
   TREE/GRAPH PATTERNS:
   - "dfs" - Depth-first search traversal
   - "bfs" - Breadth-first search (shortest path, level order)
   - "backtracking" - Try all possibilities with pruning
   
   DYNAMIC PROGRAMMING:
   - "dp-1d" - 1D DP array
   - "dp-2d" - 2D DP table
   - "memoization" - Top-down recursion with cache
   
   OTHER PATTERNS:
   - "greedy" - Local optimal choices lead to global optimum
   - "stack" - Using stack for matching/parsing problems
   - "heap" - Priority queue for top-k or scheduling
   - "sort-first" - Sort then process
   - "math" - Mathematical formula or property
   - "bit-manipulation" - XOR, AND, OR operations
   
   RULES:
   - Always start with "brute-force" as first approach
   - Include 1-4 more approaches that ACTUALLY APPLY to this problem (total 2-5)
   - Don't force approaches that don't fit
   - Each approach must have WORKING code in all 6 languages

2. CODE GENERATION - EXTREMELY CRITICAL:
   
   **FUNCTION NAME**: Always use "solution" (not "solve")
   
   **ADAPT I/O TO PROBLEM TYPE** - Don't copy a template blindly!
   
   Look at paramOrder and expected output to determine:
   - How many inputs to read
   - What type each input is
   - What type the output is
   
   **INPUT FORMAT** - How test cases send data to stdin:
   - Strings: sent as PLAIN TEXT without quotes (e.g., babad not "babad")
   - Integers: sent as plain number (e.g., 9)
   - Arrays: sent as JSON format (e.g., [1,2,3])
   - 2D Arrays: sent as JSON format (e.g., [[1,2],[3,4]])
   - Boolean: sent as lowercase string (true or false)
   - Each parameter on a NEW LINE
   
   **INPUT PARSING PATTERNS BY LANGUAGE:**
   
   PYTHON:
   - Integer: int(input())
   - Float: float(input())
   - String: input().strip()  # NO json.loads for strings!
   - Array of int: json.loads(input())
   - Array of string: json.loads(input())
   - 2D Array: json.loads(input())
   - Boolean: input().strip().lower() == "true"
   
   JAVASCRIPT:
   - Integer: parseInt(lines[i])
   - Float: parseFloat(lines[i])
   - String: lines[i].trim()  // NO JSON.parse for strings!
   - Array: JSON.parse(lines[i])
   - Boolean: lines[i].trim() === "true"
   
   JAVA:
   - Integer: Integer.parseInt(sc.nextLine().trim())
   - Float: Double.parseDouble(sc.nextLine().trim())
   - String: sc.nextLine().trim()  // NO JSON parsing for strings!
   - Array of int: Parse JSON manually or use split
   - Boolean: Boolean.parseBoolean(sc.nextLine().trim())
   
   C++:
   - Integer: int x; cin >> x;
   - Float: double x; cin >> x;
   - String: string s; getline(cin, s);  // Plain text, no quote handling!
   - Array: Parse JSON manually using stringstream
   - Boolean: string s; cin >> s; bool b = (s == "true");
   
   GO:
   - Integer: strconv.Atoi(strings.TrimSpace(line))
   - Float: strconv.ParseFloat(strings.TrimSpace(line), 64)
   - String: strings.TrimSpace(line)  // NO json.Unmarshal for strings!
   - Array: json.Unmarshal([]byte(line), &arr)
   - Boolean: strings.TrimSpace(line) == "true"
   
   C:
   - Integer: int x; scanf("%d", &x);
   - Float: double x; scanf("%lf", &x);
   - String: fgets(s, sizeof(s), stdin); s[strcspn(s, "\\n")] = 0;  // Remove newline, NO quote handling!
   - Array: Parse manually using strtok or character parsing
   - Boolean: char s[10]; scanf("%s", s); int b = (strcmp(s, "true") == 0);
   
   **OUTPUT FORMAT** - What code should print to stdout:
   - Strings: print PLAIN TEXT without quotes (e.g., print("bab") not print("\\"bab\\""))
   - Integers: print plain number
   - Floats: print plain number
   - Boolean: print lowercase true or false
   - Arrays: print JSON format [1,2,3] with no spaces after commas
   - 2D Arrays: print JSON format [[1,2],[3,4]]
   
   **OUTPUT PATTERNS BY LANGUAGE:**
   
   | Output Type | Python | JavaScript | Java | C++ | Go | C |
   |-------------|--------|------------|------|-----|----|----|
   | Integer | print(x) | console.log(x) | System.out.println(x) | cout << x << endl | fmt.Println(x) | printf("%d\\n", x) |
   | Float | print(x) | console.log(x) | System.out.println(x) | cout << x << endl | fmt.Println(x) | printf("%f\\n", x) |
   | String | print(s) | console.log(s) | System.out.println(s) | cout << s << endl | fmt.Println(s) | printf("%s\\n", s) |
   | Boolean | print(str(b).lower()) | console.log(result) | System.out.println(result) | cout << (b?"true":"false") << endl | fmt.Println(b) | printf(b?"true\\n":"false\\n") |
   | Array | print(json.dumps(arr)) | console.log(JSON.stringify(arr)) | Custom format [1,2,3] | Custom format [1,2,3] | json.Marshal then print | Custom format [1,2,3] |
   
   **CRITICAL I/O RULES:**
   1. String inputs come as PLAIN TEXT - do NOT try to parse quotes
   2. String outputs should be PLAIN TEXT - do NOT add quotes around the output
   3. Only Arrays use JSON format for both input AND output
   4. Always end output with a newline
   
   **EXAMPLE - Different Problem Types:**
   
   Problem 1: Array + Integer → Array (Two Sum)
   - paramOrder: ["nums", "target"]
   - stdin: [2,7,11,15]\\n9
   - stdout: [0,1]
   
   Problem 2: String → String (Longest Palindrome)
   - paramOrder: ["s"]
   - stdin: babad
   - stdout: bab
   
   Problem 3: String → Boolean (Valid Palindrome)
   - paramOrder: ["s"]
   - stdin: racecar
   - stdout: true
   
   Problem 4: Matrix → Integer (Island Count)
   - paramOrder: ["grid"]
   - stdin: [[1,1,0],[0,1,0],[0,0,1]]
   - stdout: 2
   
   Problem 5: Two Arrays → Array (Merge Sorted)
   - paramOrder: ["nums1", "nums2"]
   - stdin: [1,3,5]\\n[2,4,6]
   - stdout: [1,2,3,4,5,6]
   
   Problem 6: Linked List → Linked List (Reverse List) - REQUIRES CLASS DEFINITION
   - paramOrder: ["head"]
   - stdin: [1,2,3,4,5]
   - stdout: [5,4,3,2,1]
   - MUST include ListNode class at top of code
   
   Problem 7: Binary Tree → Integer (Max Depth) - REQUIRES CLASS DEFINITION
   - paramOrder: ["root"]
   - stdin: [3,9,20,null,null,15,7]
   - stdout: 3
   - MUST include TreeNode class at top of code
   
   **CLASS/STRUCT DEFINITIONS** - CRITICAL FOR LINKED LIST AND TREE PROBLEMS:
   
   If the problem involves Linked Lists or Trees, YOU MUST include the class/struct definition at the TOP of the code in ALL languages:
   
   LINKED LIST:
   - Python: class ListNode:\\n    def __init__(self, val=0, next=None):\\n        self.val = val\\n        self.next = next
   - JavaScript: class ListNode { constructor(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; } }
   - Java: class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }
   - C++: struct ListNode { int val; ListNode* next; ListNode(int x) : val(x), next(nullptr) {} };
   - Go: type ListNode struct { Val int; Next *ListNode }
   - C: struct ListNode { int val; struct ListNode* next; };
   
   BINARY TREE:
   - Python: class TreeNode:\\n    def __init__(self, val=0, left=None, right=None):\\n        self.val = val\\n        self.left = left\\n        self.right = right
   - JavaScript: class TreeNode { constructor(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; } }
   - Java: class TreeNode { int val; TreeNode left; TreeNode right; TreeNode(int val) { this.val = val; } }
   - C++: struct TreeNode { int val; TreeNode* left; TreeNode* right; TreeNode(int x) : val(x), left(nullptr), right(nullptr) {} };
   - Go: type TreeNode struct { Val int; Left *TreeNode; Right *TreeNode }
   - C: struct TreeNode { int val; struct TreeNode* left; struct TreeNode* right; };
   
   **CRITICAL RULES:**
   1. Read paramOrder to know exact number and order of inputs
   2. Look at test cases to determine data types
   3. Generate I/O code specific to THIS problem
   4. All 6 languages must produce IDENTICAL output
   5. Function must be named "solution"
   6. Code must be COMPLETE and RUNNABLE
   7. For Linked List/Tree problems: INCLUDE class definition at TOP

   **COMPLEXITY ANALYSIS** - For each approach, calculate:
   
   TIME COMPLEXITY:
   - Count the loops: 1 loop = O(n), nested loops = O(n²), triple nested = O(n³)
   - Sorting = O(n log n)
   - Binary search = O(log n)
   - Hash table lookup = O(1)
   - Recursion: count recursive calls × work per call
   
   SPACE COMPLEXITY:
   - Extra array of size n = O(n)
   - Hash map with n entries = O(n)
   - 2D array n×m = O(n×m)
   - Only variables (no extra data structures) = O(1)
   - Recursion depth d = O(d) for call stack
   
   **COLOR CLASSIFICATION** (UI displays these colors):
   
   TIME - Green (good): O(1), O(n)
   TIME - Orange (medium): O(log n), O(n log n)
   TIME - Red (bad): O(n²), O(n³), O(2^n), O(n!)
   
   SPACE - Green (good): O(1)
   SPACE - Orange (medium): O(n), O(log n)
   SPACE - Red (bad): O(n²), O(n³), O(2^n)
   
   EXAMPLES:
   - Brute force two sum: Time O(n²) [RED], Space O(1) [GREEN]
   - Hash map two sum: Time O(n) [GREEN], Space O(n) [ORANGE]
   - Binary search: Time O(log n) [ORANGE], Space O(1) [GREEN]
   - Merge sort: Time O(n log n) [ORANGE], Space O(n) [ORANGE]
   - DFS on tree: Time O(n) [GREEN], Space O(h) [ORANGE]
   
   **FORMAT**: Use "O(n²)" not "O(n^2)" - the superscript ² is required
   
   **timeExplain** must clearly state WHY (e.g., "Nested loops iterate n×n times")
   **spaceExplain** must clearly state WHY (e.g., "Hash map stores up to n elements")

3. TEST CASES FORMAT - CRITICAL (READ CAREFULLY):
   
   STRUCTURE:
   - "paramOrder": Array of parameter names in EXACT order they appear in function signature
     Example: ["nums", "target"] for function solution(nums, target)
   
   - "testCases": Array of objects, each with:
     - "id": Sequential number (1, 2, 3...)
     - "input": Object with keys EXACTLY matching paramOrder, ALL VALUES AS STRINGS
     - "expected": Expected output AS STRING
     - "explanation": Brief explanation of why this is correct
   
   CRITICAL RULES FOR TEST CASE VALUES:
   - Arrays must be JSON format: "[1,2,3]" (as string with quotes)
   - Numbers must be strings: "9" not 9
   - Strings must be quoted inside: "\"hello\"" 
   - 2D arrays: "[[1,2],[3,4]]"
   - The keys in "input" MUST match paramOrder EXACTLY (same spelling, same case)
   
   EXAMPLE:
   paramOrder: ["nums", "target"]
   testCase: {
     "id": 1,
     "input": {"nums": "[2,7,11,15]", "target": "9"},  // Keys match paramOrder
     "expected": "[0,1]",
     "explanation": "2 + 7 = 9, indices 0 and 1"
   }
   
   ** VERIFICATION PROCESS (DO THIS FOR EVERY TEST CASE) **
   Before finalizing each test case, mentally execute:
   1. Parse the input values
   2. Run the algorithm step by step
   3. Verify the expected output is EXACTLY what the algorithm produces
   4. Check output format matches (array brackets, spacing, etc.)
   
   ** REQUIRED TEST CASES (minimum 5) **
   a) Basic case - straightforward example
   b) Minimum size - smallest valid input
   c) Edge case - boundary conditions (first/last element, duplicates)
   d) Negative numbers - if applicable to problem
   e) Larger input - 5-10 elements to verify logic scales

4. EXAMPLES - Must have VERIFIED correct input/output
   - Generate 2-3 examples with different scenarios
   - Each example must show clear input → output
   - Explanation must trace through WHY the output is correct
   - Include at least one edge case example

5. SVG VISUALIZATIONS:
   
   Generate simple, clean SVG diagrams. Each "svg" field must contain ACTUAL SVG CODE.
   
   RULES:
   - Canvas: viewBox="0 0 800 400"
   - Background: #f8f9fa
   - Use actual data from Example 1 (not metaphors or abstract icons)
   - Keep it simple: boxes for arrays, circles for nodes, arrows for flow
   - **NO OVERLAPPING**: Minimum 40px spacing between elements. Text must not overlap other text or shapes.
   - Minimum font size: 14px for readability
   
   EXAMPLE SVG FOR ARRAY PROBLEM (Two Sum with [2,7,11,15], target=9):
   
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
     <rect width="800" height="400" fill="#f8f9fa"/>
     <text x="400" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#1a1a2e">Two Sum: Find indices where nums[i] + nums[j] = 9</text>
     <rect x="150" y="80" width="60" height="50" fill="#e8f4fc" stroke="#3498db" stroke-width="2"/>
     <rect x="220" y="80" width="60" height="50" fill="#27ae60" stroke="#27ae60" stroke-width="2"/>
     <rect x="290" y="80" width="60" height="50" fill="#e8f4fc" stroke="#3498db" stroke-width="2"/>
     <rect x="360" y="80" width="60" height="50" fill="#e8f4fc" stroke="#3498db" stroke-width="2"/>
     <text x="180" y="112" text-anchor="middle" font-size="20" font-weight="bold" fill="#1a1a2e">2</text>
     <text x="250" y="112" text-anchor="middle" font-size="20" font-weight="bold" fill="#fff">7</text>
     <text x="320" y="112" text-anchor="middle" font-size="20" fill="#1a1a2e">11</text>
     <text x="390" y="112" text-anchor="middle" font-size="20" fill="#1a1a2e">15</text>
     <text x="180" y="150" text-anchor="middle" font-size="14" fill="#4a4a6a">0</text>
     <text x="250" y="150" text-anchor="middle" font-size="14" fill="#4a4a6a">1</text>
     <text x="320" y="150" text-anchor="middle" font-size="14" fill="#4a4a6a">2</text>
     <text x="390" y="150" text-anchor="middle" font-size="14" fill="#4a4a6a">3</text>
     <text x="400" y="200" text-anchor="middle" font-size="16" fill="#1a1a2e">nums[0] + nums[1] = 2 + 7 = 9 ✓</text>
     <text x="400" y="250" text-anchor="middle" font-size="18" font-weight="bold" fill="#27ae60">Output: [0, 1]</text>
   </svg>
   
   FOR EACH APPROACH: Create a similar SVG showing how THAT SPECIFIC ALGORITHM works on the data. DO NOT include XML comments in the SVG.

**IMPORTANT FOR CODE GENERATION:**
The JSON template below uses generic placeholders (param1, param2, Type1, Type2, ReturnType).
YOU MUST REPLACE these with actual parameter names from paramOrder and correct types based on the problem.
- Replace "param1", "param2" with actual names from paramOrder
- Replace "Type1", "Type2" with actual types (int[], String, List<Integer>, etc.)
- Replace "ReturnType" with actual return type
- Adjust parsing code based on input types (array, int, string, matrix, etc.)
- Adjust output formatting based on return type

**STRING I/O - CRITICAL:**
- For STRING input: read as plain text, do NOT use json.loads/JSON.parse
- For STRING output: print as plain text, do NOT use json.dumps/JSON.stringify or add quotes
- WRONG: printf("\\"%s\\"\\n", result)  →  CORRECT: printf("%s\\n", result)
- WRONG: print(json.dumps(s))  →  CORRECT: print(s)
- WRONG: console.log(JSON.stringify(s))  →  CORRECT: console.log(s)
- Only use JSON for ARRAYS, not for single strings/integers/booleans

{
  "problem_id": "${problemId}",
  "problemType": "coding",
  "description": "REWRITTEN clear HTML description using <p>, <strong>, <em>, <code> tags",
  "descriptionText": "Plain text version (no HTML)",
  "paramOrder": ["param1", "param2"],
  "analogy": {
    "title": "Simple real-world comparison",
    "description": "Brief relatable scenario (1-2 sentences)",
    "icon": "🎯",
    "bruteForce": "How you'd do it the slow way",
    "twoPass": "A smarter approach",
    "optimal": "The fastest way",
    "keyInsight": "💡 One sentence key insight"
  },
  "approaches": {
    "brute-force": {
      "title": "Brute Force",
      "icon": "🔨",
      "summary": "One-line summary of approach",
      "description": "2-3 sentence explanation of how it works",
      "steps": ["Step 1: Clear action", "Step 2: Clear action"],
      "pros": ["Simple to understand"],
      "cons": ["Slow for large inputs"],
      "complexity": {
        "time": "O(?)",
        "timeExplain": "Brief explanation",
        "space": "O(?)",
        "spaceExplain": "Brief explanation"
      },
      "code": {
        "python": "import json\\nimport sys\\n\\ndef solution(param1, param2):\\n    # IMPLEMENT ALGORITHM HERE\\n    pass\\n\\n# Read inputs\\nlines = sys.stdin.read().strip().split('\\\\n')\\nparam1 = json.loads(lines[0])  # Adjust parsing based on type\\nparam2 = int(lines[1])  # Adjust parsing based on type\\n\\n# Call solution and print result\\nresult = solution(param1, param2)\\nprint(json.dumps(result))  # Adjust output format based on return type",
        "javascript": "const fs = require('fs');\\nconst lines = fs.readFileSync(0, 'utf8').trim().split('\\\\n');\\n\\nfunction solution(param1, param2) {\\n    // IMPLEMENT ALGORITHM HERE\\n}\\n\\n// Read inputs - adjust parsing based on types\\nconst param1 = JSON.parse(lines[0]);\\nconst param2 = parseInt(lines[1]);\\n\\n// Call solution and print result\\nconst result = solution(param1, param2);\\nconsole.log(JSON.stringify(result));  // Adjust output format",
        "java": "import java.util.*;\\nimport java.io.*;\\n\\nclass Main {\\n    public static ReturnType solution(Type1 param1, Type2 param2) {\\n        // IMPLEMENT ALGORITHM HERE\\n        // Return appropriate default: 0 for int, false for boolean, null for objects\\n    }\\n    \\n    public static void main(String[] args) throws Exception {\\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\\n        // Parse inputs based on types\\n        // Call solution and print result\\n    }\\n}",
        "cpp": "#include <iostream>\\n#include <vector>\\n#include <string>\\n#include <sstream>\\nusing namespace std;\\n\\nReturnType solution(Type1 param1, Type2 param2) {\\n    // IMPLEMENT ALGORITHM HERE\\n}\\n\\nint main() {\\n    // Parse inputs based on types\\n    // Call solution and print result\\n    return 0;\\n}",
        "go": "package main\\n\\nimport (\\n    \\"bufio\\"\\n    \\"encoding/json\\"\\n    \\"fmt\\"\\n    \\"os\\"\\n    \\"strconv\\"\\n    \\"strings\\"\\n)\\n\\nfunc solution(param1 Type1, param2 Type2) ReturnType {\\n    // IMPLEMENT ALGORITHM HERE\\n    // Return appropriate zero value: 0 for int, \\\"\\\" for string, false for bool, nil for slice/pointer\\n}\\n\\nfunc main() {\\n    reader := bufio.NewReader(os.Stdin)\\n    // Parse inputs based on types\\n    // Call solution and print result\\n}",
        "c": "#include <stdio.h>\\n#include <stdlib.h>\\n#include <string.h>\\n\\nReturnType solution(Type1 param1, Type2 param2) {\\n    // IMPLEMENT ALGORITHM HERE\\n}\\n\\nint main() {\\n    // Parse inputs based on types\\n    // Call solution and print result\\n    return 0;\\n}"
      },
      "visualization": {
        "title": "Approach Name: What It Does",
        "description": "Shows how the algorithm works",
        "steps": [
          {"stepNumber": 1, "title": "Step 1", "description": "What happens"},
          {"stepNumber": 2, "title": "Step 2", "description": "What happens"},
          {"stepNumber": 3, "title": "Result", "description": "Final output"}
        ],
        "svg": "GENERATE ACTUAL SVG CODE HERE following the example SVG format shown above. Must start with <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'> and contain rect, text, line elements showing this specific algorithm working on the problem data."
      }
    }
  },
  "examples": [
    {
      "id": 1,
      "title": "Example 1 — Basic Case",
      "input": "nums = [2,7,11,15], target = 9",
      "output": "[0,1]",
      "explanation": "Clear step-by-step: nums[0] + nums[1] = 2 + 7 = 9, so return [0,1]"
    },
    {
      "id": 2,
      "title": "Example 2 — Different Position",
      "input": "nums = [3,2,4], target = 6",
      "output": "[1,2]",
      "explanation": "nums[1] + nums[2] = 2 + 4 = 6, indices are [1,2]"
    },
    {
      "id": 3,
      "title": "Example 3 — Edge Case",
      "input": "nums = [3,3], target = 6",
      "output": "[0,1]",
      "explanation": "Both elements are same: 3 + 3 = 6"
    }
  ],
  "testCases": [
    {
      "id": 1,
      "input": {"nums": "[2,7,11,15]", "target": "9"},
      "expected": "[0,1]",
      "explanation": "Basic case: 2 + 7 = 9"
    },
    {
      "id": 2,
      "input": {"nums": "[3,2,4]", "target": "6"},
      "expected": "[1,2]",
      "explanation": "Answer not at start: 2 + 4 = 6"
    },
    {
      "id": 3,
      "input": {"nums": "[3,3]", "target": "6"},
      "expected": "[0,1]",
      "explanation": "Minimum size, duplicate values"
    },
    {
      "id": 4,
      "input": {"nums": "[-1,-2,-3,-4,-5]", "target": "-8"},
      "expected": "[2,4]",
      "explanation": "Negative numbers: -3 + -5 = -8"
    },
    {
      "id": 5,
      "input": {"nums": "[1,2,3,4,5,6,7,8,9,10]", "target": "19"},
      "expected": "[8,9]",
      "explanation": "Larger array: 9 + 10 = 19"
    }
  ],
  "constraints": [
    "2 ≤ nums.length ≤ 10<sup>4</sup>",
    "-10<sup>9</sup> ≤ nums[i] ≤ 10<sup>9</sup>"
  ],
  "defaultCode": {
    "python": "import json\\nimport sys\\n\\ndef solution(param1, param2):\\n    # Write your code here\\n    pass\\n\\nlines = sys.stdin.read().strip().split('\\\\n')\\nparam1 = json.loads(lines[0])\\nparam2 = int(lines[1])\\nresult = solution(param1, param2)\\nprint(json.dumps(result))",
    "javascript": "const fs = require('fs');\\nconst lines = fs.readFileSync(0, 'utf8').trim().split('\\\\n');\\n\\nfunction solution(param1, param2) {\\n    // Write your code here\\n}\\n\\nconst param1 = JSON.parse(lines[0]);\\nconst param2 = parseInt(lines[1]);\\nconsole.log(JSON.stringify(solution(param1, param2)));",
    "java": "import java.util.*;\\nimport java.io.*;\\n\\nclass Main {\\n    public static ReturnType solution(Type1 param1, Type2 param2) {\\n        // Write your code here\\n        // Return appropriate default: 0 for int, false for boolean, null for objects\\n    }\\n    \\n    public static void main(String[] args) throws Exception {\\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\\n        // Read and parse inputs\\n        // Print result\\n    }\\n}",
    "cpp": "#include <iostream>\\n#include <vector>\\n#include <sstream>\\n#include <string>\\nusing namespace std;\\n\\nReturnType solution(Type1 param1, Type2 param2) {\\n    // Write your code here\\n}\\n\\nint main() {\\n    // Read and parse inputs\\n    // Print result\\n    return 0;\\n}",
    "go": "package main\\n\\nimport (\\n    \\"bufio\\"\\n    \\"encoding/json\\"\\n    \\"fmt\\"\\n    \\"os\\"\\n    \\"strconv\\"\\n    \\"strings\\"\\n)\\n\\nfunc solution(param1 Type1, param2 Type2) ReturnType {\\n    // Write your code here\\n    // Return appropriate zero value based on ReturnType\\n}\\n\\nfunc main() {\\n    reader := bufio.NewReader(os.Stdin)\\n    // Read and parse inputs\\n    // Print result\\n}",
    "c": "#include <stdio.h>\\n#include <stdlib.h>\\n#include <string.h>\\n\\nReturnType solution(Type1 param1, Type2 param2) {\\n    // Write your code here\\n}\\n\\nint main() {\\n    // Read and parse inputs\\n    // Print result\\n    return 0;\\n}"
  },
  "solutionSummary": "Brief HTML summary: The <strong>key insight</strong> is... Best approach is... Time: O(?), Space: O(?)",
  "visualize": {
    "title": "Problem Overview: [Problem Name]",
    "description": "Shows the input→output transformation",
    "steps": [
      {"stepNumber": 1, "title": "Input", "description": "Input data with actual values"},
      {"stepNumber": 2, "title": "Process", "description": "Key operation"},
      {"stepNumber": 3, "title": "Output", "description": "Expected result"}
    ],
    "svg": "GENERATE ACTUAL SVG CODE HERE following the example SVG format shown above. Must start with <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'> and show the problem input, transformation, and output.",
    "conclusion": "🎯 **Key Insight:** One sentence about the main trick"
  },
  "companies": [
    {"name": "Google", "logo": "G", "class": "google", "count": 50},
    {"name": "Amazon", "logo": "a", "class": "amazon", "count": 40}
  ],
  "stats": {
    "acceptance": "45.0%",
    "avgTime": "~20 min",
    "frequency": "High",
    "likes": 1200,
    "views": 45000
  },
  "seo": {
    "title": "${problemName} - ${topics[0] || 'Algorithm'} | Practice | Tutorials Point",
    "description": "Master ${problemName} with solutions in 6 languages.",
    "keywords": ${JSON.stringify([...topics, 'algorithm', 'coding interview'])},
    "ogImage": "/practice/images/${problemId}-og.png",
    "canonical": "https://www.tutorialspoint.com/practice/${problemId}.htm"
  }
}

CHECKLIST - VERIFY EACH ITEM BEFORE SUBMITTING:
1. ✅ paramOrder is array of strings matching function parameters exactly
2. ✅ Every testCase.input has keys that EXACTLY match paramOrder (same spelling, case)
3. ✅ ALL values in testCase.input are STRINGS (arrays as "[1,2,3]", numbers as "9")
4. ✅ testCase.expected is a STRING matching exact output format
5. ✅ VERIFIED each test case by mentally running algorithm - output is CORRECT
6. ✅ At least 5 test cases: basic, minimum size, edge case, negatives (if applicable), larger input
7. ✅ Function name is "solution" in ALL code (not "solve")
8. ✅ Code I/O matches THIS problem's data types (not copied from another problem)
9. ✅ All 6 languages read correct number of inputs based on paramOrder
10. ✅ All 6 languages output in correct format (array as [1,2], bool as true/false, etc.)
11. ✅ defaultCode has empty solution body but complete I/O handling
12. ✅ approach.code has complete working algorithm + I/O
13. ✅ Time complexity is CORRECT (count loops, recursion, operations)
14. ✅ Space complexity is CORRECT (count extra data structures, recursion stack)
15. ✅ timeExplain and spaceExplain clearly state WHY
16. ✅ SVG fields contain ACTUAL SVG CODE (starts with <svg>)
17. ✅ NO overlapping text/elements in SVG
18. ✅ If Linked List/Tree problem: ListNode/TreeNode class defined at TOP of code in ALL languages
19. ✅ STRING inputs: read as plain text (NO json.loads/JSON.parse)
20. ✅ STRING outputs: print as plain text (NO json.dumps/JSON.stringify, NO quotes around output)

Return ONLY the JSON object, no markdown.`;
}

/**
 * Generate prompt for SQL/DATABASE problems
 */
function generateSQLPrompt(problemName, description, topics, difficulty, relatedProblems, problemId) {
  return `You are an expert SQL instructor creating educational content for a coding practice platform.

Generate comprehensive content for the following SQL/Database problem:

**Problem ID:** ${problemId}
**Problem Name:** ${problemName}
**Original Description:** ${description}
**Topics/Tags:** ${topics.join(', ')}
**Difficulty:** ${difficulty}
**Related Problems:** ${relatedProblems.map(r => r.title).join(', ') || 'None'}

Generate a complete JSON response for a SQL problem.

CRITICAL INSTRUCTIONS:

1. APPROACHES - Generate ONLY 1-2 SQL approaches (MAXIMUM 2, never more):
   
   ⚠️ IMPORTANT: SQL problems typically have ONE optimal solution. Generate at most 2 approaches.
   DO NOT generate 3, 4, or 5 approaches - this is wasteful for SQL problems.
   
   COMMON SQL APPROACH KEYS (use these exact keys):
   - "basic-query" - Simple SELECT with WHERE/ORDER BY (for easy problems)
   
   JOIN PATTERNS:
   - "inner-join" - Standard INNER JOIN between tables
   - "left-join" - LEFT JOIN for including non-matching rows
   - "self-join" - Table joined with itself (comparing rows)
   - "cross-join" - Cartesian product when needed
   
   AGGREGATION PATTERNS:
   - "group-by" - GROUP BY with aggregate functions (COUNT, SUM, AVG, MAX, MIN)
   - "having" - GROUP BY with HAVING filter
   
   WINDOW FUNCTION PATTERNS:
   - "window-rank" - ROW_NUMBER, RANK, DENSE_RANK
   - "window-aggregate" - SUM/AVG/COUNT OVER (PARTITION BY...)
   - "window-lead-lag" - LEAD/LAG for comparing adjacent rows
   - "running-total" - Cumulative sum with window function
   
   SUBQUERY PATTERNS:
   - "subquery" - Subquery in WHERE or SELECT
   - "correlated-subquery" - Subquery referencing outer query
   - "cte" - Common Table Expression (WITH clause)
   - "derived-table" - Subquery in FROM clause
   
   SET OPERATIONS:
   - "union" - UNION or UNION ALL
   - "except" - EXCEPT/MINUS for difference
   - "intersect" - INTERSECT for common rows
   
   OTHER PATTERNS:
   - "case-when" - Conditional logic with CASE
   - "string-functions" - LIKE, CONCAT, SUBSTRING, etc.
   - "date-functions" - DATE_DIFF, EXTRACT, DATE_ADD, etc.
   - "null-handling" - COALESCE, NULLIF, IS NULL
   
   RULES:
   - ⛔ STRICT LIMIT: Generate ONLY 1-2 approaches (NEVER 3 or more)
   - Most SQL problems need just 1 approach - only add a 2nd if truly different
   - Pick the BEST approach that solves the problem optimally
   - Each approach must have WORKING SQL code
   - SQL must be PostgreSQL (PGLite) compatible

2. SQL CODE REQUIREMENTS:
   - Must be compatible with PostgreSQL (PGLite)
   - Use standard SQL syntax
   - Include only "sql" in code object (not 6 languages)

3. TABLE SCHEMA - CRITICAL:
   For SINGLE TABLE problems:
   - Define "tableSchema" with tableName, columns, primaryKey, notes
   - Each column: name, type, description
   
   For MULTI-TABLE problems (JOINs, subqueries across tables):
   - Define "tableSchema" as an ARRAY of table objects
   - Each table object has: tableName, columns, primaryKey
   - Example: "tableSchema": [
       {"tableName": "Person", "columns": [...], "primaryKey": "personId"},
       {"tableName": "Address", "columns": [...], "primaryKey": "addressId"}
     ]

4. EXAMPLES FORMAT - Table-based:

   === SINGLE TABLE PROBLEMS ===
   tableSchema (object):
   {
     "tableName": "Employee",
     "columns": [
       {"name": "id", "type": "int", "description": "Primary key"},
       {"name": "salary", "type": "int", "description": "Employee salary"}
     ],
     "primaryKey": "id",
     "notes": "Each row represents one employee"
   }
   
   examples input:
   {
     "headers": ["id", "salary"],
     "rows": [
       {"i0": 1, "i1": 100},
       {"i0": 2, "i1": 200},
       {"i0": 3, "i1": 300}
     ]
   }
   
   === MULTI-TABLE PROBLEMS (JOINs) ===
   tableSchema (array):
   [
     {
       "tableName": "Person",
       "columns": [
         {"name": "personId", "type": "int", "description": "Primary key"},
         {"name": "firstName", "type": "varchar", "description": "First name"},
         {"name": "lastName", "type": "varchar", "description": "Last name"}
       ],
       "primaryKey": "personId"
     },
     {
       "tableName": "Address",
       "columns": [
         {"name": "addressId", "type": "int", "description": "Primary key"},
         {"name": "personId", "type": "int", "description": "Foreign key to Person"},
         {"name": "city", "type": "varchar", "description": "City name"},
         {"name": "state", "type": "varchar", "description": "State name"}
       ],
       "primaryKey": "addressId"
     }
   ]
   
   examples input (multi-table):
   {
     "tables": [
       {
         "name": "Person",
         "headers": ["personId", "firstName", "lastName"],
         "rows": [
           {"i0": 1, "i1": "Wang", "i2": "Allen"},
           {"i0": 2, "i1": "Alice", "i2": "Bob"}
         ]
       },
       {
         "name": "Address",
         "headers": ["addressId", "personId", "city", "state"],
         "rows": [
           {"i0": 1, "i1": 2, "i2": "New York City", "i3": "New York"}
         ]
       }
     ]
   }
   
   === OUTPUT (same for single/multi-table) ===
   {
     "headers": ["firstName", "lastName", "city", "state"],
     "rows": [
       {"i0": "Wang", "i1": "Allen", "i2": null, "i3": null},
       {"i0": "Alice", "i1": "Bob", "i2": "New York City", "i3": "New York"}
     ]
   }
   
   RULES:
   - Use i0, i1, i2... as keys for row values matching header order
   - Generate 2-3 examples with different scenarios
   - Include edge cases (empty results, single row, NULL handling)
   - Use null (not "null" string) for NULL values

5. TEST CASES - NOT REQUIRED FOR SQL:
   - SQL problems do NOT need testCases array
   - Set "testCases": [] (empty array)
   - SQL execution uses PGlite with data from examples

6. SVG VISUALIZATIONS:
   
   Generate simple, clean SVG diagrams showing tables. Each "svg" field must contain ACTUAL SVG CODE.
   
   RULES:
   - Canvas: viewBox="0 0 800 400"
   - Background: #f8f9fa
   - Use actual data from Example 1
   - Draw tables as grids with headers and data rows
   - **NO OVERLAPPING**: Minimum 40px spacing between elements. Text must not overlap other text or shapes.
   - Minimum font size: 12px for table content, 14px for labels
   
   EXAMPLE SVG FOR SQL PROBLEM:
   
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
     <rect width="800" height="400" fill="#f8f9fa"/>
     <text x="400" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#1a1a2e">Running Total with Window Function</text>
     <text x="150" y="55" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a2e">Input: Transactions</text>
     <rect x="50" y="65" width="200" height="30" fill="#2c3e50"/>
     <text x="100" y="85" text-anchor="middle" font-size="12" fill="#fff">account</text>
     <text x="175" y="85" text-anchor="middle" font-size="12" fill="#fff">amount</text>
     <rect x="50" y="95" width="200" height="25" fill="#fff" stroke="#bdc3c7"/>
     <text x="100" y="112" text-anchor="middle" font-size="12" fill="#1a1a2e">1</text>
     <text x="175" y="112" text-anchor="middle" font-size="12" fill="#1a1a2e">2000</text>
     <rect x="50" y="120" width="200" height="25" fill="#f9f9f9" stroke="#bdc3c7"/>
     <text x="100" y="137" text-anchor="middle" font-size="12" fill="#1a1a2e">1</text>
     <text x="175" y="137" text-anchor="middle" font-size="12" fill="#1a1a2e">1000</text>
     <line x1="270" y1="110" x2="330" y2="110" stroke="#3498db" stroke-width="2"/>
     <polygon points="330,105 340,110 330,115" fill="#3498db"/>
     <text x="305" y="95" text-anchor="middle" font-size="10" fill="#3498db">SUM() OVER</text>
     <text x="500" y="55" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a2e">Output</text>
     <rect x="350" y="65" width="280" height="30" fill="#2c3e50"/>
     <text x="400" y="85" text-anchor="middle" font-size="12" fill="#fff">account</text>
     <text x="475" y="85" text-anchor="middle" font-size="12" fill="#fff">amount</text>
     <text x="560" y="85" text-anchor="middle" font-size="12" fill="#fff">balance</text>
     <rect x="350" y="95" width="280" height="25" fill="#fff" stroke="#bdc3c7"/>
     <text x="400" y="112" text-anchor="middle" font-size="12" fill="#1a1a2e">1</text>
     <text x="475" y="112" text-anchor="middle" font-size="12" fill="#1a1a2e">2000</text>
     <text x="560" y="112" text-anchor="middle" font-size="12" font-weight="bold" fill="#27ae60">2000</text>
     <rect x="350" y="120" width="280" height="25" fill="#f9f9f9" stroke="#bdc3c7"/>
     <text x="400" y="137" text-anchor="middle" font-size="12" fill="#1a1a2e">1</text>
     <text x="475" y="137" text-anchor="middle" font-size="12" fill="#1a1a2e">1000</text>
     <text x="560" y="137" text-anchor="middle" font-size="12" font-weight="bold" fill="#27ae60">1000</text>
   </svg>
   
   FOR EACH APPROACH: Create a similar SVG showing how THAT SPECIFIC SQL OPERATION works. DO NOT include XML comments in the SVG.

{
  "problem_id": "${problemId}",
  "problemType": "sql",
  "description": "REWRITTEN clear HTML description using <p>, <strong>, <code>, <ul>, <li>",
  "descriptionText": "Plain text version",
  "tableSchema": {
    "tableName": "TableName",
    "columns": [
      {"name": "id", "type": "int", "description": "Primary key"},
      {"name": "value", "type": "varchar", "description": "Description of column"}
    ],
    "primaryKey": "id",
    "notes": "Additional notes about the table"
  },
  "analogy": {
    "title": "Simple real-world comparison",
    "description": "Brief relatable scenario (1-2 sentences)",
    "icon": "📊",
    "bruteForce": "The slow manual way",
    "optimal": "The efficient SQL way",
    "keyInsight": "💡 One sentence key insight"
  },
  "approaches": {
    "window-function": {
      "title": "Window Function",
      "icon": "🪟",
      "summary": "One-line summary of approach",
      "description": "2-3 sentence explanation",
      "steps": ["Step 1: Clear action", "Step 2: Clear action"],
      "pros": ["Efficient single pass"],
      "cons": ["Requires understanding window syntax"],
      "complexity": {
        "time": "O(n log n)",
        "timeExplain": "Sorting required for window ordering",
        "space": "O(n)",
        "spaceExplain": "Window frame storage"
      },
      "code": {
        "sql": "SELECT\\n    column1,\\n    column2,\\n    SUM(amount) OVER (PARTITION BY account ORDER BY date) AS running_total\\nFROM table_name\\nORDER BY column1;"
      },
      "visualization": {
        "title": "Window Function: Running Total",
        "description": "Shows PARTITION BY grouping and running sum",
        "steps": [
          {"stepNumber": 1, "title": "Partition", "description": "Group by account"},
          {"stepNumber": 2, "title": "Order", "description": "Sort by date"},
          {"stepNumber": 3, "title": "Calculate", "description": "Running sum"}
        ],
        "svg": "GENERATE ACTUAL SVG CODE HERE following the example SVG format shown above. Must start with <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'> and show input table, SQL operation arrow, and output table with actual data."
      }
    }
  },
  "examples": [
    {
      "id": 1,
      "title": "Example 1 — Descriptive Title",
      "input": {
        "headers": ["col1", "col2"],
        "rows": [{"i0": "val1", "i1": "val2"}]
      },
      "output": {
        "headers": ["result_col1", "result_col2"],
        "rows": [{"i0": "result1", "i1": "result2"}]
      },
      "explanation": "<p>Clear explanation of how input produces this output.</p>"
    },
    {
      "id": 2,
      "title": "Example 2 — Edge Case",
      "input": {
        "headers": ["col1", "col2"],
        "rows": [{"i0": "val1", "i1": null}]
      },
      "output": {
        "headers": ["result_col1", "result_col2"],
        "rows": [{"i0": "result1", "i1": null}]
      },
      "explanation": "<p>Explanation showing NULL handling or edge case.</p>"
    }
  ],
  "testCases": [],
  "constraints": [
    "<code>1 ≤ account_id ≤ 1000</code>",
    "<code>type</code> is either <code>'Deposit'</code> or <code>'Withdraw'</code>"
  ],
  "defaultCode": {
    "sql": "-- Write your SQL query here\\n-- Use SELECT, UPDATE, DELETE, or INSERT as needed for this problem\\n"
  },
  "solutionSummary": "Brief HTML summary: Use <strong>window function</strong> with <code>SUM() OVER()</code> to calculate running totals efficiently.",
  "visualize": {
    "title": "SQL Problem Overview: [Problem Name]",
    "description": "Shows input table → SQL operation → output table",
    "steps": [
      {"stepNumber": 1, "title": "Input", "description": "Original table data"},
      {"stepNumber": 2, "title": "Operation", "description": "SQL operation"},
      {"stepNumber": 3, "title": "Output", "description": "Result table"}
    ],
    "svg": "GENERATE ACTUAL SVG CODE HERE following the example SVG format shown above. Must start with <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'> and show input table, SQL operation, and output table.",
    "conclusion": "🎯 **Key Insight:** When to use this SQL pattern"
  },
  "companies": [
    {"name": "Amazon", "logo": "a", "class": "amazon", "count": 45},
    {"name": "Google", "logo": "G", "class": "google", "count": 32}
  ],
  "stats": {
    "acceptance": "45.0%",
    "avgTime": "~15 min",
    "frequency": "High",
    "likes": 1250,
    "views": 45000
  },
  "seo": {
    "title": "${problemName} - SQL | Practice | Tutorials Point",
    "description": "Master ${problemName} SQL problem with window functions and joins.",
    "keywords": ${JSON.stringify([...topics, 'SQL', 'database', 'practice'])},
    "ogImage": "/practice/images/${problemId}-og.png",
    "canonical": "https://www.tutorialspoint.com/practice/${problemId}.htm"
  }
}

CHECKLIST - VERIFY EACH ITEM BEFORE SUBMITTING:
1. ✅ tableSchema: For single-table use object, for multi-table (JOINs) use array of objects
2. ✅ tableSchema has correct tableName, all columns with name/type/description for EACH table
3. ✅ examples input: For single-table use {headers, rows}, for multi-table use {tables: [{name, headers, rows}, ...]}
4. ✅ examples rows use i0, i1, i2... keys matching header order
5. ✅ testCases is empty array: []
6. ✅ SQL syntax is PostgreSQL compatible (PGLite)
7. ✅ SVG fields contain ACTUAL SVG CODE (starts with <svg>, not placeholder text)
8. ✅ Each approach has its own visualization SVG showing that specific SQL operation
9. ✅ SVG shows actual table data from examples, not abstract shapes
10. ✅ NO overlapping text or elements in SVG
11. ⛔ APPROACHES COUNT: Maximum 2 approaches (1 is preferred for most SQL problems)
12. ✅ NULL values use null (not "null" string)

Return ONLY the JSON object, no markdown.`;
}

/**
 * Generate rich problem content using Claude AI
 */
async function generateProblemContent(problemName, description, topics, difficulty, relatedProblems, problemId) {
  const isSQL = isSQLProblem(topics);
  const prompt = isSQL 
    ? generateSQLPrompt(problemName, description, topics, difficulty, relatedProblems, problemId)
    : generateCodingPrompt(problemName, description, topics, difficulty, relatedProblems, problemId);

  try {
    console.log(`    🤖 Calling Claude API for: ${problemName}`);
    console.log(`    📋 Problem Type: ${isSQL ? 'SQL/Database' : 'Coding'}`);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 20000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    
    const inputTokens = message.usage?.input_tokens || 0;
    const outputTokens = message.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    const totalCost = inputCost + outputCost;
    
    console.log(`    📊 Tokens - Input: ${inputTokens.toLocaleString()}, Output: ${outputTokens.toLocaleString()}`);
    console.log(`    💰 Cost: $${totalCost.toFixed(4)}`);
    
    if (message.stop_reason === 'max_tokens') {
      console.log(`    ⚠️  Warning: Response truncated`);
    }
    
    let jsonContent;
    try {
      jsonContent = JSON.parse(responseText);
    } catch (e) {
      console.log(`    ⚠️  JSON parse failed, attempting recovery...`);
      
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          jsonContent = JSON.parse(jsonMatch[1]);
        } catch (e2) {}
      }
      
      if (!jsonContent) {
        const startIdx = responseText.indexOf('{');
        const endIdx = responseText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          let jsonStr = responseText.substring(startIdx, endIdx + 1);
          try {
            jsonContent = JSON.parse(jsonStr);
          } catch (e3) {
            jsonStr = fixTruncatedJson(jsonStr);
            try {
              jsonContent = JSON.parse(jsonStr);
              console.log(`    ✅ JSON recovered`);
            } catch (e4) {
              throw new Error(`Could not parse JSON: ${e4.message}`);
            }
          }
        } else {
          throw new Error('Could not extract JSON');
        }
      }
    }
    
    jsonContent._tokenUsage = { inputTokens, outputTokens, totalTokens, inputCost, outputCost, totalCost };
    jsonContent._isSQL = isSQL;
    
    console.log(`    ✅ Generated content for: ${problemName}`);
    return jsonContent;
    
  } catch (error) {
    console.error(`    ❌ Error generating content: ${error.message}`);
    return null;
  }
}

function fixTruncatedJson(jsonStr) {
  let fixed = jsonStr;
  
  fixed = fixed.replace(/,\s*[^}\]"'\d\w]*$/, '');
  
  let openBraces = (fixed.match(/{/g) || []).length;
  let closeBraces = (fixed.match(/}/g) || []).length;
  let openBrackets = (fixed.match(/\[/g) || []).length;
  let closeBrackets = (fixed.match(/\]/g) || []).length;
  
  while (closeBrackets < openBrackets) { fixed += ']'; closeBrackets++; }
  while (closeBraces < openBraces) { fixed += '}'; closeBraces++; }
  
  return fixed;
}

/**
 * Build complete problem document for Firebase
 */
function buildProblemDocument(row, generatedContent, problemNumber) {
  const problemName = row['Problem Name'];
  const slug = generateSlug(problemName);
  const problemId = slug;
  const topics = parseTopics(row['Topics']);
  const difficulty = row['Difficulty'] || 'Medium';
  const description = row['Description'] || '';
  const relatedProblems = parseRelatedProblems(row);
  const isSQL = generatedContent?._isSQL || isSQLProblem(topics);
  
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
    topics: isSQL ? ['Database', 'SQL'] : ['Data Structures', 'Algorithms'],
    related: relatedProblems,
    status: null,
    problemType: isSQL ? 'sql' : 'coding',
    
    // Timestamps
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    
    // Default values
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
      title: `${problemName} - ${topics[0] || 'Algorithm'} | Practice | Tutorials Point`,
      description: `Master the ${problemName} problem with detailed solutions.`,
      keywords: [...topics, 'algorithm', 'coding interview', 'practice'],
      ogImage: `/practice/images/${slug}-og.png`,
      canonical: `https://www.tutorialspoint.com/practice/${slug}.htm`
    }
  };
  
  // Add type-specific fields
  if (isSQL) {
    doc.tableSchema = null;
  } else {
    doc.paramOrder = [];
  }
  
  // Merge generated content
  if (generatedContent) {
    if (generatedContent.description) doc.description = generatedContent.description;
    if (generatedContent.descriptionText) doc.descriptionText = generatedContent.descriptionText;
    
    const fieldsToMerge = [
      'analogy', 'approaches', 'examples', 'testCases', 'constraints',
      'defaultCode', 'solutionSummary', 'visualize', 'companies', 'stats', 'seo'
    ];
    
    if (isSQL) {
      fieldsToMerge.push('tableSchema');
    } else {
      fieldsToMerge.push('paramOrder');
    }
    
    fieldsToMerge.forEach(field => {
      if (generatedContent[field] !== undefined) {
        doc[field] = generatedContent[field];
      }
    });
    
    // Ensure views > likes in stats
    if (doc.stats) {
      const likes = doc.stats.likes || 1000;
      const views = doc.stats.views || 0;
      if (views < likes * 20) {
        doc.stats.views = likes * (Math.floor(Math.random() * 16) + 25);
      }
    }
    
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
    console.log(`    ✅ Uploaded to Firebase: ${problemDoc.title}`);
    return true;
  } catch (error) {
    console.error(`    ❌ Firebase upload error: ${error.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node upload_coding_problems.js <excel_file_path>');
    console.log('Example: node upload_coding_problems.js ./problems.xlsx');
    process.exit(1);
  }
  
  const excelPath = args[0];
  
  console.log('========================================');
  console.log('🚀 Problems Uploader (Coding + SQL)');
  console.log(`📌 Processing limit: ${MAX_PROBLEMS_TO_PROCESS} problem(s)`);
  console.log('========================================\n');
  
  console.log(`📖 Reading Excel file: ${excelPath}`);
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  
  const problemsToProcess = Math.min(data.length, MAX_PROBLEMS_TO_PROCESS);
  console.log(`📊 Found ${data.length} problems, processing ${problemsToProcess}\n`);
  
  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  
  for (let i = 0; i < problemsToProcess; i++) {
    const row = data[i];
    const problemName = row['Problem Name'];
    
    if (!problemName) {
      console.log(`⚠️  Skipping row ${i + 1}: No problem name`);
      continue;
    }
    
    console.log(`\n[${i + 1}/${problemsToProcess}] Processing: ${problemName}`);
    console.log('─'.repeat(50));
    
    try {
      const topics = parseTopics(row['Topics']);
      const difficulty = row['Difficulty'] || 'Medium';
      const description = row['Description'] || '';
      const relatedProblems = parseRelatedProblems(row);
      const problemId = generateSlug(problemName);
      
      console.log(`    📌 Problem ID: ${problemId}`);
      console.log(`    📌 Difficulty: ${difficulty}`);
      console.log(`    🏷️  Topics: ${topics.join(', ')}`);
      
      const generatedContent = await generateProblemContent(
        problemName, description, topics, difficulty, relatedProblems, problemId
      );
      
      if (generatedContent?._tokenUsage) {
        totalInputTokens += generatedContent._tokenUsage.inputTokens;
        totalOutputTokens += generatedContent._tokenUsage.outputTokens;
        totalCost += generatedContent._tokenUsage.totalCost;
      }
      
      const problemDoc = buildProblemDocument(row, generatedContent, row['P_ID'] || (i + 1));
      const uploaded = await uploadToFirebase(problemDoc);
      
      if (uploaded) successCount++;
      else failCount++;
      
      if (i < problemsToProcess - 1) {
        console.log('    ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`    ❌ Error: ${error.message}`);
      failCount++;
    }
  }
  
  console.log('\n========================================');
  console.log('📊 UPLOAD SUMMARY');
  console.log('========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('────────────────────────────────────────');
  console.log('💰 TOKEN USAGE & COST');
  console.log(`📥 Input:  ${totalInputTokens.toLocaleString()}`);
  console.log(`📤 Output: ${totalOutputTokens.toLocaleString()}`);
  console.log(`💵 Total:  $${totalCost.toFixed(4)}`);
  console.log('========================================\n');
  
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});