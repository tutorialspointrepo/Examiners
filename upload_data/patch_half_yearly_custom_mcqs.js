#!/usr/bin/env node

/**
 * patch_half_yearly_custom_mcqs.js
 * 
 * Patches the 10 custom MCQ questions (Q1-Q10) in Anubhav's "Half Yearly, Feb-2026" exam
 * that are missing correctAnswers. These questions have source:"custom" and no questionBankId,
 * so the generic patch script can't fix them.
 * 
 * Correct answers determined from question content and DSA knowledge.
 * 
 * Usage:
 *   node patch_half_yearly_custom_mcqs.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ENV + FIREBASE INIT
const envPaths = ['.env', 'functions/.env', '../functions/.env', '../../functions/.env'];
for (const p of envPaths) {
  const fullPath = path.resolve(process.cwd(), p);
  if (fs.existsSync(fullPath)) {
    require('dotenv').config({ path: fullPath });
    break;
  }
}

const serviceAccountPaths = [
  'serviceAccountKey.json',
  'functions/serviceAccountKey.json',
  '../functions/serviceAccountKey.json',
  '../../functions/serviceAccountKey.json'
];
let serviceAccount;
for (const p of serviceAccountPaths) {
  const fullPath = path.resolve(process.cwd(), p);
  if (fs.existsSync(fullPath)) {
    serviceAccount = require(fullPath);
    break;
  }
}
if (!serviceAccount) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
});
const db = admin.firestore();

// ============================================
// CORRECT ANSWERS FOR THE 10 CUSTOM MCQs
// ============================================
const EXAM_ID = 'LPU-26-HY-FEB2026'; // UPDATE THIS with actual exam ID

const correctAnswersMap = {
  // Q1: Circular Array Next Greater Element for index 2 (value=1) in [1,2,1]
  // Circular: after index 2, wrap to index 0 (value=1, not greater), index 1 (value=2, GREATER)
  'QE8EG7X7EX': ['2'],

  // Q2: Most efficient data structure for monotonic decreasing stack → Stack
  'Q7IJMTXLRZ': ['Stack'],

  // Q3: Trapping Rain Water for height=[3,0,2,0,4]
  // idx0: min(3,4)-3=0, idx1: min(3,4)-0=3, idx2: min(3,4)-2=1, idx3: min(3,4)-0=3 → total=7
  'QGCXL1ICA4': ['7'],

  // Q4: Worst-case time complexity of Quick Sort → O(n²)
  'QZJBOD6TB6': ['O(n²)'],

  // Q5: Stack of size 5: push(10),push(20),push(30),pop(),push(40),push(50),push(60)
  // After: [10,20] → pop → [10,20] wait: push(10),push(20),push(30)=[10,20,30], pop()=[10,20], 
  // push(40)=[10,20,40], push(50)=[10,20,40,50], push(60)=[10,20,40,50,60] → size=5, full
  // Actually: push gives 3 items, pop gives 2, then push 3 more = 5 items. push(60) is 6th = Stack Overflow
  // Wait: push(10)[1], push(20)[2], push(30)[3], pop()[2], push(40)[3], push(50)[4], push(60)[5] = 5 items, fits!
  // No: array size 5 means indices 0-4, capacity=5. After ops: [10,20,40,50,60] = exactly 5. Fits.
  // Hmm, let me recount: push(10)→[10], push(20)→[10,20], push(30)→[10,20,30], pop()→[10,20], 
  // push(40)→[10,20,40], push(50)→[10,20,40,50], push(60)→[10,20,40,50,60] = 5 elements = full but fits
  // So "60 is pushed successfully"
  'QIGCVO89BR': ['60 is pushed successfully'],

  // Q6: Time complexity of finding max in unsorted array → O(n)
  'QLOU2MRYIB': ['O(n)'],

  // Q7: Sliding Window Maximum for [1,3,-1,-3,5,3,6,7] k=3
  // Windows: [1,3,-1]→3, [3,-1,-3]→3, [-1,-3,5]→5, [-3,5,3]→5, [5,3,6]→6, [3,6,7]→7
  // Output: [3,3,5,5,6,7]. Third maximum = 5
  'QRHV1PK4Q6': ['5'],

  // Q8: Stable sort with O(n log n) worst case → Merge Sort
  'QZMQG2JQJN': ['Merge Sort'],

  // Q9: Stack after: push(1),push(2),push(3),pop(),push(4),pop(),pop()
  // [1]→[1,2]→[1,2,3]→pop→[1,2]→[1,2,4]→pop→[1,2]→pop→[1]
  'QZJ5UIWM6Q': ['[1]'],

  // Q10: Binary Search comparisons for [2,3,4,10,40] target=10
  // mid=index2(val=4), 10>4→right half [10,40], mid=index3(val=10), found! = 2 comparisons
  'QGY3CPW1N5': ['2'],
};

// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Find the exam - search by title if no ID provided
  let examId = EXAM_ID;
  
  // Try to find by title
  const snapshot = await db.collection('exams')
    .where('title', '==', 'Half Yearly, Feb-2026')
    .where('collegeId', '==', 'LPU')
    .get();
  
  if (!snapshot.empty) {
    examId = snapshot.docs[0].id;
    console.log(`📋 Found exam by title: ${examId}`);
  } else {
    console.log(`📋 Using provided exam ID: ${examId}`);
  }

  const examRef = db.collection('exams').doc(examId);
  const examDoc = await examRef.get();
  
  if (!examDoc.exists) {
    console.error(`❌ Exam ${examId} not found`);
    process.exit(1);
  }

  const examData = examDoc.data();
  console.log(`\n📋 Exam: "${examData.title}" (${examId})`);
  console.log(`   Questions: ${examData.questionsList?.length || 0}`);
  console.log(`   Mode: ${dryRun ? '🔍 DRY RUN' : '🔧 LIVE PATCH'}\n`);

  const questionsList = examData.questionsList || [];
  let patchedCount = 0;
  let alreadyHasCount = 0;
  let skippedCount = 0;

  const updatedQuestions = questionsList.map((q, idx) => {
    if (q.type !== 'mcq') {
      return q;
    }

    if (q.correctAnswers && q.correctAnswers.length > 0) {
      alreadyHasCount++;
      console.log(`  ✅ Q${idx + 1} (${q.id}): Already has correctAnswers = ${JSON.stringify(q.correctAnswers)}`);
      return q;
    }

    const correctAnswer = correctAnswersMap[q.id];
    if (correctAnswer) {
      patchedCount++;
      const title = q.questionText?.replace(/<[^>]*>/g, '').substring(0, 60);
      console.log(`  🔧 Q${idx + 1} (${q.id}): "${title}..."`);
      console.log(`     Options: ${JSON.stringify(q.options)}`);
      console.log(`     Setting correctAnswers = ${JSON.stringify(correctAnswer)}`);
      
      // Verify the answer exists in options
      if (!q.options?.includes(correctAnswer[0])) {
        console.log(`     ⚠️ WARNING: "${correctAnswer[0]}" not found in options!`);
      }
      
      return { ...q, correctAnswers: correctAnswer };
    } else {
      skippedCount++;
      console.log(`  ⚠️ Q${idx + 1} (${q.id}): No correct answer mapping found`);
      return q;
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Patched: ${patchedCount}`);
  console.log(`   Already had answers: ${alreadyHasCount}`);
  console.log(`   Skipped (no mapping): ${skippedCount}`);

  if (patchedCount === 0) {
    console.log('\n✅ Nothing to patch!');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN — no changes written. Remove --dry-run to apply.');
  } else {
    await examRef.update({ questionsList: updatedQuestions });
    console.log(`\n✅ Patched ${patchedCount} questions in Firestore!`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
