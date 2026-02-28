#!/usr/bin/env node

/**
 * audit_missing_correct_answers.js
 * 
 * Scans ALL exams in Firestore and reports MCQ/FITB/Jumbled questions
 * that are missing the correctAnswers field.
 * 
 * Usage:
 *   node audit_missing_correct_answers.js [--college=LPU] [--verbose]
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
});
const db = admin.firestore();

// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const collegeFilter = args.find(a => a.startsWith('--college='))?.split('=')[1];
  const verbose = args.includes('--verbose');

  console.log('🔍 Scanning all exams for missing correctAnswers...\n');
  if (collegeFilter) console.log(`   Filter: collegeId = ${collegeFilter}\n`);

  // Fetch all exams
  let query = db.collection('exams');
  if (collegeFilter) {
    query = query.where('collegeId', '==', collegeFilter);
  }
  
  const snapshot = await query.get();
  console.log(`📋 Total exams found: ${snapshot.size}\n`);

  const CHECK_TYPES = ['mcq', 'fitb', 'fill_in_the_blank', 'jumbled'];
  
  let totalExams = 0;
  let affectedExams = 0;
  let totalMissing = 0;
  const results = [];

  for (const doc of snapshot.docs) {
    const exam = doc.data();
    totalExams++;

    const allQuestions = [
      ...(exam.questionsList || []).map((q, i) => ({ ...q, _location: 'questionsList', _index: i })),
      ...(exam.questionPool || []).map((q, i) => ({ ...q, _location: 'questionPool', _index: i })),
    ];

    const missing = allQuestions.filter(q => 
      CHECK_TYPES.includes(q.type) &&
      (!q.correctAnswers || (Array.isArray(q.correctAnswers) && q.correctAnswers.length === 0))
    );

    if (missing.length > 0) {
      affectedExams++;
      totalMissing += missing.length;

      const examInfo = {
        id: doc.id,
        title: exam.title,
        college: exam.collegeId,
        createdBy: exam.createdByName,
        createdAt: exam.createdAt?.__time__ || exam.createdAt,
        status: exam.status,
        totalQuestions: allQuestions.length,
        missingCount: missing.length,
        questions: missing.map(q => ({
          id: q.id,
          type: q.type,
          location: q._location,
          index: q._index + 1,
          source: q.source,
          questionBankId: q.questionBankId || null,
          title: (q.questionText || '').replace(/<[^>]*>/g, '').substring(0, 80),
        }))
      };
      results.push(examInfo);

      console.log(`❌ ${exam.title} (${doc.id})`);
      console.log(`   College: ${exam.collegeId} | By: ${exam.createdByName} | Status: ${exam.status}`);
      console.log(`   Missing: ${missing.length} / ${allQuestions.length} questions`);
      
      if (verbose) {
        missing.forEach(q => {
          const title = (q.questionText || '').replace(/<[^>]*>/g, '').substring(0, 60);
          const qbId = q.questionBankId ? `QB:${q.questionBankId}` : 'custom';
          console.log(`     Q${q._index + 1} [${q.type}] (${q._location}) ${qbId} — "${title}..."`);
        });
      }
      console.log('');
    }
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Total exams scanned:    ${totalExams}`);
  console.log(`   Affected exams:         ${affectedExams}`);
  console.log(`   Total missing answers:  ${totalMissing}`);
  
  if (affectedExams > 0) {
    console.log('\n📋 Affected exams:');
    results.forEach(r => {
      const fixable = r.questions.filter(q => q.questionBankId).length;
      const manual = r.questions.length - fixable;
      console.log(`   • ${r.title} (${r.id}) — ${r.missingCount} missing [${fixable} fixable via QB, ${manual} need manual fix]`);
    });
  } else {
    console.log('\n✅ All exams have correctAnswers for MCQ/FITB/Jumbled questions!');
  }

  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
