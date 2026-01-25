const admin = require('firebase-admin');
const XLSX = require('xlsx');
const readlineSync = require('readline-sync');
const fs = require('fs');
const path = require('path');

// Supported educational boards
const SUPPORTED_BOARDS = [
  'CBSE', 'ICSE', 'ISC', 'State Board', 'IB', 'IGCSE', 
  'NIOS', 'Cambridge', 'CBSE International',
  'Telangana Board', 'AP Board', 'Maharashtra Board', 
  'Karnataka Board', 'Tamil Nadu Board', 'Kerala Board',
  'UP Board', 'Bihar Board', 'West Bengal Board'
];

// Valid question types - mapped to React app format
const VALID_QUESTION_TYPES = ['mcq', 'fitb', 'descriptive', 'jumbled', 'code'];

// Valid difficulty levels - mapped to React app format
const VALID_DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Initialize Firebase
console.log('🔧 Initializing Firebase...');
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({ 
  credential: admin.credential.cert(serviceAccount) 
});

const db = admin.firestore();

// Generate 10-character alphanumeric question ID
function generateQuestionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'Q'; // Start with Q for Question
  
  for (let i = 0; i < 9; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return id;
}

// Check if question ID already exists
async function isQuestionIdUnique(questionId) {
  try {
    const doc = await db.collection('questionBank').doc(questionId).get();
    return !doc.exists;
  } catch (error) {
    console.error('Error checking question ID:', error);
    return false;
  }
}

// Generate unique question ID
async function generateUniqueQuestionId() {
  let questionId;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    questionId = generateQuestionId();
    attempts++;
    
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique question ID after multiple attempts');
    }
  } while (!(await isQuestionIdUnique(questionId)));
  
  return questionId;
}

// No normalization - use class exactly as provided in Excel
function normalizeClassName(className) {
  if (!className) return '';
  // Return exactly as provided, just trim whitespace
  return String(className).trim();
}

// Read Excel file
function readExcel(filePath) {
  console.log(`📖 Reading Excel file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  
  const sheets = {
    questions: workbook.Sheets['Questions']
  };
  
  const result = {};
  
  if (sheets.questions) {
    result.questions = XLSX.utils.sheet_to_json(sheets.questions);
  }
  
  return result;
}

// Add question to question bank
async function addQuestion(data, index, userId = 'system') {
  try {
    // Validate required fields
    if (!data.board || !data.class || !data.subject || !data.question_text) {
      throw new Error('Missing required fields: board, class, subject, or question_text');
    }
    
    // Validate board
    if (!SUPPORTED_BOARDS.includes(data.board)) {
      throw new Error(`Invalid board: ${data.board}. Must be one of: ${SUPPORTED_BOARDS.join(', ')}`);
    }
    
    // Normalize class (no validation - accept any class from Excel)
    const normalizedClass = normalizeClassName(data.class);
    
    // Validate and normalize question type
    let questionType = (data.type || 'descriptive').trim().toLowerCase();
    
    // ✅ FIXED: Normalize Excel format to React app format
    const typeMap = {
      'mcq': 'mcq',
      'multiple choice': 'mcq',
      'multiplechoice': 'mcq',
      'fillintheblank': 'fitb',
      'fill in the blank': 'fitb',
      'fillblank': 'fitb',
      'fitb': 'fitb',
      'jumbledquiz': 'jumbled',
      'jumbled': 'jumbled',
      'descriptive': 'descriptive',
      'Descriptive': 'descriptive',
      'longanswer': 'descriptive',
      'long': 'descriptive',
      'code': 'code',
      'coding': 'code',
      'programming': 'code'
    };
    
    const normalizedType = typeMap[questionType.replace(/\s+/g, '')];
    
    if (!normalizedType) {
      throw new Error(`Invalid question type: ${data.type}. Must be one of: mcq, fitb, jumbled, descriptive, code`);
    }
    
    questionType = normalizedType;
    
    // ✅ FIXED: Handle capitalized difficulty levels from Excel
    let difficultyLevel = (data.difficulty_level || data.complexity || 'medium').trim().toLowerCase();
    
    const difficultyMap = {
      'easy': 'easy',
      'medium': 'medium',
      'hard': 'hard',
      'complex': 'hard'
    };
    
    difficultyLevel = difficultyMap[difficultyLevel] || 'medium';
    
    if (!VALID_DIFFICULTY_LEVELS.includes(difficultyLevel)) {
      throw new Error(`Invalid difficulty: ${difficultyLevel}. Must be: easy, medium, or hard`);
    }
    
    // ✅ NEW: Read is_public field from Excel (default to true if not provided)
    let isPublic = true; // Default to public
    
    if (data.is_public !== undefined && data.is_public !== null && data.is_public !== '') {
      const publicStr = String(data.is_public).trim().toLowerCase();
      // Handle various formats: true/false, yes/no, public/private, 1/0
      if (publicStr === 'false' || publicStr === 'no' || publicStr === 'private' || publicStr === '0') {
        isPublic = false;
      } else if (publicStr === 'true' || publicStr === 'yes' || publicStr === 'public' || publicStr === '1') {
        isPublic = true;
      }
    }
    
    // Determine college ID based on is_public flag
    // If public → use "tutorialspoint" (common question bank)
    // If private → use college_id from Excel or require it
    let collegeId;
    if (isPublic) {
      collegeId = 'tutorialspoint';
    } else {
      // Private question - must have college_id
      if (!data.college_id || data.college_id.trim() === '') {
        throw new Error('Private questions must have a college_id specified');
      }
      collegeId = data.college_id.trim();
    }
    
    // isProprietaryQuestion is inverse of isPublic
    const isProprietaryQuestion = !isPublic;
    
    // Get college name
    const collegeName = data.college_name && data.college_name.trim() !== ''
      ? data.college_name.trim()
      : (collegeId === 'tutorialspoint' ? 'Tutorials Point' : 'Unknown College');
    
    // Generate unique question ID
    const questionId = await generateUniqueQuestionId();
    
    // Get current year
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${(currentYear + 1) % 100}`;
    
    // Create question document (matching React app field names)
    const questionDoc = {
      title: data.question_text,
      subject: data.subject,
      subjectCode: data.subject_code || null,
      class: normalizedClass,
      board: data.board,
      year: data.year || academicYear,
      type: questionType,
      complexity: difficultyLevel,
      marks: parseFloat(data.maximum_marks || data.marks) || 1,
      isProprietaryQuestion: isProprietaryQuestion,
      collegeId: collegeId,
      collegeName: collegeName,
      createdBy: userId,
      createdByName: data.created_by_name || 'System Admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tags: data.tags ? data.tags.split(',').map(t => t.trim()) : []
    };
    
    // ✅ NEW: Add optional fields if present
    if (data.chapter && String(data.chapter).trim()) {
      questionDoc.chapter = String(data.chapter).trim();
    }
    if (data.hint && String(data.hint).trim()) {
      questionDoc.hint = String(data.hint).trim();
    }
    if (data.solution && String(data.solution).trim()) {
      questionDoc.solution = String(data.solution).trim();
    }
    
    // ✅ FIXED: Add type-specific fields
    if (questionType === 'mcq') {
      // Read MCQ options from Excel
      const options = [];
      
      // ✅ FIXED: Check if options are in a single pipe-separated column
      if (data.options && String(data.options).trim()) {
        const splitOptions = String(data.options).split('|').map(opt => opt.trim()).filter(opt => opt.length > 0);
        options.push(...splitOptions);
      }
      // Otherwise, check for separate columns (backward compatibility)
      else {
        if (data.option_a && String(data.option_a).trim()) options.push(String(data.option_a).trim());
        if (data.option_b && String(data.option_b).trim()) options.push(String(data.option_b).trim());
        if (data.option_c && String(data.option_c).trim()) options.push(String(data.option_c).trim());
        if (data.option_d && String(data.option_d).trim()) options.push(String(data.option_d).trim());
        if (data.option_e && String(data.option_e).trim()) options.push(String(data.option_e).trim());
      }
      
      // Validate MCQ has at least 2 options
      if (options.length < 2) {
        throw new Error('MCQ must have at least 2 options (provide pipe-separated in "options" column OR separate option_a, option_b columns)');
      }
      
      questionDoc.options = options;
      
      // ✅ FIXED: Read correct answer (support both "correct_answer" and "correct_answers")
      const correctAnswerField = data.correct_answer || data.correct_answers;
      
      if (correctAnswerField) {
        const correctAnswerStr = String(correctAnswerField).trim();
        
        // ✅ FIXED: Try to match exact option text first (case-insensitive)
        const exactMatchIndex = options.findIndex(opt => 
          opt.toLowerCase() === correctAnswerStr.toLowerCase()
        );
        
        if (exactMatchIndex !== -1) {
          questionDoc.correctAnswer = exactMatchIndex;
        } else {
          // Try letter format (A, B, C, D, E)
          const correctAnswerUpper = correctAnswerStr.toUpperCase();
          const answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
          
          if (answerMap[correctAnswerUpper] !== undefined && answerMap[correctAnswerUpper] < options.length) {
            questionDoc.correctAnswer = answerMap[correctAnswerUpper];
          } else {
            // Try to parse as number (0-based index)
            const answerIndex = parseInt(correctAnswerStr);
            if (!isNaN(answerIndex) && answerIndex >= 0 && answerIndex < options.length) {
              questionDoc.correctAnswer = answerIndex;
            } else {
              console.warn(`   ⚠️  Invalid correct_answer "${correctAnswerStr}" for MCQ - should match option text, or be A/B/C/D/E, or 0/1/2/3/4`);
              questionDoc.correctAnswer = null;
            }
          }
        }
      } else {
        console.warn(`   ⚠️  No correct_answer provided for MCQ`);
        questionDoc.correctAnswer = null;
      }
      
    } else if (questionType === 'fitb') {
      // ✅ FIXED: Read FITB answers - support multiple formats
      const answers = [];
      
      // Check for pipe-separated answers in "answer" or "answers" or "correct_answer" or "correct_answers" column
      const answerField = data.answer || data.answers || data.correct_answer || data.correct_answers;
      
      if (answerField && String(answerField).trim()) {
        const answerStr = String(answerField).trim();
        
        // Check if it's pipe-separated
        if (answerStr.includes('|')) {
          const splitAnswers = answerStr.split('|').map(ans => ans.trim()).filter(ans => ans.length > 0);
          answers.push(...splitAnswers);
        } else {
          answers.push(answerStr);
        }
      }
      
      // Also check for separate answer columns (answer_1, answer_2, etc.)
      if (data.answer_1 && String(data.answer_1).trim()) {
        answers.push(String(data.answer_1).trim());
      }
      if (data.answer_2 && String(data.answer_2).trim()) {
        answers.push(String(data.answer_2).trim());
      }
      if (data.answer_3 && String(data.answer_3).trim()) {
        answers.push(String(data.answer_3).trim());
      }
      
      if (answers.length === 0) {
        console.warn(`   ⚠️  No answers provided for FITB question`);
      }
      
      questionDoc.correctAnswers = answers;
      
    } else if (questionType === 'jumbled') {
      // ✅ FIXED: Read jumbled parts
      const parts = [];
      
      // Check if parts are in question_text separated by |
      if (data.question_text && String(data.question_text).includes('|')) {
        const splitParts = String(data.question_text).split('|').map(part => part.trim()).filter(part => part.length > 0);
        parts.push(...splitParts);
      }
      // Otherwise check for separate part columns
      else {
        if (data.part_1 && String(data.part_1).trim()) parts.push(String(data.part_1).trim());
        if (data.part_2 && String(data.part_2).trim()) parts.push(String(data.part_2).trim());
        if (data.part_3 && String(data.part_3).trim()) parts.push(String(data.part_3).trim());
        if (data.part_4 && String(data.part_4).trim()) parts.push(String(data.part_4).trim());
        if (data.part_5 && String(data.part_5).trim()) parts.push(String(data.part_5).trim());
        if (data.part_6 && String(data.part_6).trim()) parts.push(String(data.part_6).trim());
      }
      
      if (parts.length < 2) {
        console.warn(`   ⚠️  Jumbled question needs at least 2 parts (found ${parts.length})`);
      }
      
      questionDoc.parts = parts;
      
      // ✅ FIXED: Read correct order from correct_answers field
      const correctAnswerField = data.correct_answer || data.correct_answers || data.correct_order;
      
      if (correctAnswerField && String(correctAnswerField).trim()) {
        const correctAnswerStr = String(correctAnswerField).trim();
        
        // Check if it's pipe-separated correct order (e.g., "Where|are|you|going|?")
        if (correctAnswerStr.includes('|')) {
          const correctParts = correctAnswerStr.split('|').map(part => part.trim());
          
          // Map correct parts to indices based on original parts
          const correctOrder = correctParts.map(correctPart => {
            return parts.findIndex(part => part.toLowerCase() === correctPart.toLowerCase());
          }).filter(index => index !== -1);
          
          if (correctOrder.length > 0) {
            questionDoc.correctOrder = correctOrder;
          } else {
            questionDoc.correctOrder = null;
          }
        } 
        // Check if it's comma-separated indices (e.g., "0,2,1,3,4")
        else if (correctAnswerStr.includes(',')) {
          const orderArray = correctAnswerStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          questionDoc.correctOrder = orderArray.length > 0 ? orderArray : null;
        } else {
          questionDoc.correctOrder = null;
        }
      } else {
        questionDoc.correctOrder = null;
      }
    } else if (questionType === 'code') {
      // ✅ NEW: Handle code-specific fields with marks per test case support
      
      // Add programming language (required for code questions)
      if (data.programming_language && String(data.programming_language).trim()) {
        questionDoc.programmingLanguage = String(data.programming_language).trim();
        console.log(`   💻 Programming Language: ${questionDoc.programmingLanguage}`);
      } else {
        console.warn(`   ⚠️  No programming_language provided for code question - defaulting to Python`);
        questionDoc.programmingLanguage = 'Python';
      }
      
      // Parse test cases from JSON string
      if (data.test_cases && String(data.test_cases).trim()) {
        try {
          const testCasesStr = String(data.test_cases).trim();
          const testCases = JSON.parse(testCasesStr);
          
          // ✅ NEW: Validate that test cases have marks field
          let totalMarks = 0;
          testCases.forEach((tc, idx) => {
            if (tc.marks === undefined || tc.marks === null) {
              console.warn(`   ⚠️  Test case ${idx + 1} missing 'marks' field - defaulting to 0`);
              tc.marks = 0;
            }
            totalMarks += parseFloat(tc.marks) || 0;
          });
          
          questionDoc.testCases = testCases;
          console.log(`   📋 Loaded ${testCases.length} test cases (Total: ${totalMarks.toFixed(1)} marks)`);
          
          // ✅ NEW: Verify total marks match maximum_marks
          const expectedMarks = parseFloat(data.maximum_marks || data.marks) || 0;
          if (Math.abs(totalMarks - expectedMarks) > 0.01) {
            console.warn(`   ⚠️  Warning: Test cases total (${totalMarks.toFixed(1)}) doesn't match maximum_marks (${expectedMarks})`);
          }
        } catch (e) {
          console.warn(`   ⚠️  Warning: Invalid test_cases JSON - ${e.message}`);
          questionDoc.testCases = [];
        }
      } else {
        console.warn(`   ⚠️  No test_cases provided for code question`);
        questionDoc.testCases = [];
      }
      
      // Add test stub (starter code template)
      if (data.test_stub && String(data.test_stub).trim()) {
        questionDoc.testStub = String(data.test_stub).trim();
        console.log(`   📝 Test stub loaded (${questionDoc.testStub.length} characters)`);
      } else {
        console.warn(`   ⚠️  No test_stub provided for code question`);
        questionDoc.testStub = '';
      }
    }
    
    // Save to Firebase
    await db.collection('questionBank').doc(questionId).set(questionDoc);
    
    const label = isProprietaryQuestion ? '🏫' : '🌐';
    const typeLabel = questionType === 'mcq' ? `[${questionDoc.options?.length || 0} options]` : '';
    console.log(`   ✅ [${questionId}] ${label} ${data.board} - ${data.question_text.substring(0, 50)}... (${questionType} ${typeLabel}, ${difficultyLevel})`);
    
    return { 
      success: true, 
      id: questionId,
      type: questionType,
      board: data.board,
      class: normalizedClass,
      subject: data.subject,
      collegeId: collegeId,
      isProprietary: isProprietaryQuestion,
      testCaseCount: questionDoc.testCases?.length || 0
    };
    
  } catch (error) {
    console.error(`   ❌ Error adding question ${index}:`, error.message);
    return { 
      success: false, 
      error: error.message,
      question: data.question_text?.substring(0, 50) || 'Unknown'
    };
  }
}

// Import all questions from Excel
async function importQuestions(questions) {
  console.log(`📦 Importing ${questions.length} questions...\n`);
  
  const results = {
    added: [],
    failed: []
  };
  
  for (let i = 0; i < questions.length; i++) {
    console.log(`\n[${i + 1}/${questions.length}] Processing question...`);
    
    const result = await addQuestion(questions[i], i + 1);
    
    if (result.success) {
      results.added.push(result);
    } else {
      results.failed.push(result);
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('📋 QUESTION IMPORT SUMMARY');
  console.log('═'.repeat(80));
  console.log(`✅ Questions added: ${results.added.length}`);
  console.log(`❌ Questions failed: ${results.failed.length}`);
  
  if (results.added.length > 0) {
    // Breakdown by type
    console.log('\n📊 Breakdown by Type:');
    const byType = {};
    results.added.forEach(q => {
      byType[q.type] = (byType[q.type] || 0) + 1;
    });
    Object.keys(byType).forEach(type => {
      console.log(`   ${type}: ${byType[type]}`);
    });
    
    // Breakdown by board
    console.log('\n📚 Breakdown by Board:');
    const byBoard = {};
    results.added.forEach(q => {
      byBoard[q.board] = (byBoard[q.board] || 0) + 1;
    });
    Object.keys(byBoard).forEach(board => {
      console.log(`   ${board}: ${byBoard[board]}`);
    });
    
    // Breakdown by college (Common vs Proprietary)
    console.log('\n🏢 Breakdown by College:');
    const commonQuestions = results.added.filter(q => q.collegeId === 'tutorialspoint').length;
    const proprietaryQuestions = results.added.filter(q => q.collegeId !== 'tutorialspoint').length;
    console.log(`   🌐 Common Questions (tutorialspoint): ${commonQuestions}`);
    console.log(`   🏫 Proprietary Questions: ${proprietaryQuestions}`);
    
    if (proprietaryQuestions > 0) {
      const byCollege = {};
      results.added
        .filter(q => q.collegeId !== 'tutorialspoint')
        .forEach(q => {
          byCollege[q.collegeId] = (byCollege[q.collegeId] || 0) + 1;
        });
      console.log('\n   College-specific breakdown:');
      Object.keys(byCollege).forEach(college => {
        console.log(`      ${college}: ${byCollege[college]}`);
      });
    }
    
    // Sample question IDs
    console.log('\n🔑 Sample Question IDs:');
    results.added.slice(0, 5).forEach(q => {
      const label = q.isProprietary ? '🏫' : '🌐';
      const typeLabel = q.type === 'code' ? '💻' : '';
      console.log(`   ${label}${typeLabel} ${q.id} - ${q.subject} (${q.class})`);
    });
    
    // Show code questions with test case count and marks
    const codeQuestions = results.added.filter(q => q.type === 'code');
    if (codeQuestions.length > 0) {
      console.log('\n💻 Code Questions Added:');
      codeQuestions.forEach(q => {
        console.log(`   ${q.id} - ${q.subject} (${q.class}) - ${q.testCaseCount || 0} test cases`);
      });
    }
  }
  
  if (results.failed.length > 0) {
    console.log('\n⚠️  Failed Questions:');
    results.failed.forEach((q, idx) => {
      console.log(`   ${idx + 1}. ${q.question}: ${q.error}`);
    });
  }
  
  console.log('\n✅ Question import completed!\n');
}

// Main import function
async function importData(excelFilePath) {
  try {
    console.log('\n🚀 Starting import process...\n');
    
    const data = readExcel(excelFilePath);
    
    // Import questions if Questions sheet exists
    if (data.questions && data.questions.length > 0) {
      await importQuestions(data.questions);
    } else {
      console.log('⚠️  No Questions sheet found or sheet is empty. Skipping question import.\n');
    }
    
    console.log('✅ All imports completed!\n');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// ==========================
// MAIN EXECUTION STARTS HERE
// ==========================

// Look for Excel file in current directory
const currentDir = __dirname;
const excelFileName = 'questions_data.xlsx';
const excelFilePath = path.join(currentDir, excelFileName);

console.log('📂 Current directory:', currentDir);
console.log('🔍 Looking for Excel file:', excelFileName);

// Check if files exist
if (!fs.existsSync(excelFilePath)) {
  console.error(`\n❌ Error: Excel file '${excelFileName}' not found in current directory!\n`);
  console.log('📁 Please ensure the file exists at:');
  console.log(`   ${excelFilePath}\n`);
  console.log('💡 File should be named: questions_data.xlsx\n');
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error('\n❌ Error: serviceAccountKey.json not found in current directory!\n');
  console.log('📁 Please ensure the file exists at:');
  console.log(`   ${serviceAccountPath}\n`);
  console.log('💡 Download from: Firebase Console → Project Settings → Service Accounts\n');
  process.exit(1);
}

console.log('✅ Excel file found:', excelFilePath);
console.log('✅ Service account key found\n');

console.log('⚠️  This script will add questions to Firebase Question Bank!\n');
console.log(`📄 Excel file: ${excelFileName}`);
console.log(`🔥 Firebase project: ${serviceAccount.project_id}\n`);

console.log('📋 Excel Columns Expected:');
console.log('   Required (ALL questions):');
console.log('      • board - e.g., "CBSE", "ICSE"');
console.log('      • class - e.g., "1st", "2nd", "11th", "12th" (used exactly as provided)');
console.log('      • subject - e.g., "Mathematics"');
console.log('      • question_text - The question content');
console.log('      • type - "mcq", "fillInTheBlank", "descriptive", "jumbledQuiz", "code"');
console.log('   For Code questions:');
console.log('      • programming_language - Language: Python, Java, C++, C, JavaScript (Required)');
console.log('      • test_cases - JSON array with input, expected_output, and marks for each test case');
console.log('      • test_stub - Starter code template for students');
console.log('   Optional (ALL questions):');
console.log('      • is_public - "true"/"yes"/"public" for shared questions, "false"/"no"/"private" for college-only (default: true)');
console.log('      • college_id - Required ONLY if is_public is false (private questions)');
console.log('      • college_name - College Name');
console.log('      • subject_code - e.g., "Math-03"');
console.log('      • difficulty_level - "Easy", "Medium", "Hard" (case-insensitive)');
console.log('      • maximum_marks or marks - Question marks (must match sum of test case marks for code questions)');
console.log('      • year - Academic year');
console.log('      • tags - Comma-separated tags');
console.log('      • chapter - Chapter name');
console.log('      • hint - Hint for solving the question');
console.log('      • solution - Detailed solution explanation');
console.log('   For MCQ questions (TWO FORMATS SUPPORTED):');
console.log('      Format 1 - Single "options" column with pipe-separated values:');
console.log('         • options - "Option A|Option B|Option C|Option D"');
console.log('      Format 2 - Separate columns:');
console.log('         • option_a - First option (required)');
console.log('         • option_b - Second option (required)');
console.log('         • option_c, option_d, option_e - Additional options');
console.log('      Both formats require:');
console.log('         • correct_answers - Exact option text, or A/B/C/D/E, or 0/1/2/3/4');
console.log('   For FITB questions (MULTIPLE FORMATS SUPPORTED):');
console.log('      Format 1 - Single column with pipe-separated answers:');
console.log('         • correct_answers - "correct answer|alternate answer"');
console.log('      Format 2 - Separate columns:');
console.log('         • answer - Primary correct answer');
console.log('         • answer_1, answer_2, answer_3 - Additional acceptable answers');
console.log('   For Jumbled questions (TWO FORMATS SUPPORTED):');
console.log('      Format 1 - Parts in question_text with answer in correct_answers:');
console.log('         • question_text - "Arrange: going | are | where | you | ?"');
console.log('         • correct_answers - "Where|are|you|going|?" (pipe-separated correct order)');
console.log('      Format 2 - Separate part columns:');
console.log('         • part_1, part_2, part_3, part_4, part_5 - Sentence parts');
console.log('         • correct_order - "0,2,1,3,4" (comma-separated indices)\n');

console.log('💻 Code Question Test Cases Format (NEW):');
console.log('   Each test case must have THREE fields:');
console.log('      • input - Test input (string)');
console.log('      • expected_output - Expected result (string)');
console.log('      • marks - Points awarded for this test case (number)');
console.log('   Example JSON:');
console.log('      [{"input":"5","expected_output":"120","marks":0.5},');
console.log('       {"input":"3","expected_output":"6","marks":0.5}]');
console.log('   IMPORTANT: Sum of all test case marks must equal maximum_marks!\n');

console.log('📚 Question Types (Excel Format → React App Format):');
console.log('   • mcq → mcq (Multiple Choice Questions)');
console.log('   • fillInTheBlank → fitb (Fill in the Blank)');
console.log('   • jumbledQuiz → jumbled (Jumbled Quiz)');
console.log('   • descriptive → descriptive (Descriptive/Long Answer)');
console.log('   • code → code (Coding/Programming Questions)\n');

console.log('📊 Difficulty Levels (case-insensitive):');
console.log('   • Easy → easy');
console.log('   • Medium → medium');
console.log('   • Hard → hard\n');

console.log('🏢 Public/Private Question Rules:');
console.log('   • is_public = true/yes/public → Question shared with all colleges (college_id auto-set to "tutorialspoint")');
console.log('   • is_public = false/no/private → Question only for specific college (must provide college_id)');
console.log('   • If is_public not specified → Defaults to public (true)\n');

console.log('🔑 Question IDs:');
console.log('   • Auto-generated 10-character alphanumeric IDs (e.g., Q1A2B3C4D5)');
console.log('   • Unique across all questions\n');

const proceed = readlineSync.keyInYN('Continue with import?');

if (proceed) {
  importData(excelFilePath);
} else {
  console.log('❌ Import cancelled.\n');
  process.exit(0);
}