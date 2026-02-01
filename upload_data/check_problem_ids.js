/**
 * Check for problem document IDs with leading/trailing hyphens
 * 
 * Usage: node check_problem_ids.js
 */

const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();

async function checkProblemIds() {
  console.log('========================================');
  console.log('🔍 Checking Problem IDs for Issues');
  console.log('========================================\n');

  const problemsSnapshot = await db.collection('problems').get();
  console.log(`📊 Total problems: ${problemsSnapshot.size}\n`);

  const issues = {
    leadingHyphen: [],
    trailingHyphen: [],
    doubleHyphen: [],
    leadingSpace: [],
    trailingSpace: []
  };

  problemsSnapshot.forEach(doc => {
    const id = doc.id;
    const data = doc.data();
    const title = data.title || '';

    // Check for leading hyphen
    if (id.startsWith('-')) {
      issues.leadingHyphen.push({ id, title });
    }

    // Check for trailing hyphen
    if (id.endsWith('-')) {
      issues.trailingHyphen.push({ id, title });
    }

    // Check for double hyphens
    if (id.includes('--')) {
      issues.doubleHyphen.push({ id, title });
    }

    // Check title for leading/trailing spaces
    if (title.startsWith(' ')) {
      issues.leadingSpace.push({ id, title: `"${title}"` });
    }
    if (title.endsWith(' ')) {
      issues.trailingSpace.push({ id, title: `"${title}"` });
    }
  });

  // Report
  console.log('────────────────────────────────────────');
  console.log('📋 SUMMARY:');
  console.log('────────────────────────────────────────');
  console.log(`❌ Leading hyphen (-example):  ${issues.leadingHyphen.length}`);
  console.log(`❌ Trailing hyphen (example-): ${issues.trailingHyphen.length}`);
  console.log(`❌ Double hyphen (ex--ample):  ${issues.doubleHyphen.length}`);
  console.log(`⚠️  Title leading space:       ${issues.leadingSpace.length}`);
  console.log(`⚠️  Title trailing space:      ${issues.trailingSpace.length}`);

  const totalIssues = issues.leadingHyphen.length + issues.trailingHyphen.length + 
                      issues.doubleHyphen.length + issues.leadingSpace.length + 
                      issues.trailingSpace.length;

  console.log(`\n📊 Total issues: ${totalIssues}`);

  // Print details
  if (issues.leadingHyphen.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log('❌ IDs with LEADING HYPHEN:');
    console.log('────────────────────────────────────────');
    issues.leadingHyphen.forEach((p, i) => {
      console.log(`${i + 1}. "${p.id}" → ${p.title}`);
    });
  }

  if (issues.trailingHyphen.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log('❌ IDs with TRAILING HYPHEN:');
    console.log('────────────────────────────────────────');
    issues.trailingHyphen.forEach((p, i) => {
      console.log(`${i + 1}. "${p.id}" → ${p.title}`);
    });
  }

  if (issues.doubleHyphen.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log('❌ IDs with DOUBLE HYPHEN:');
    console.log('────────────────────────────────────────');
    issues.doubleHyphen.forEach((p, i) => {
      console.log(`${i + 1}. "${p.id}" → ${p.title}`);
    });
  }

  if (issues.leadingSpace.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log('⚠️  Titles with LEADING SPACE:');
    console.log('────────────────────────────────────────');
    issues.leadingSpace.forEach((p, i) => {
      console.log(`${i + 1}. ${p.id} → ${p.title}`);
    });
  }

  if (issues.trailingSpace.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log('⚠️  Titles with TRAILING SPACE:');
    console.log('────────────────────────────────────────');
    issues.trailingSpace.forEach((p, i) => {
      console.log(`${i + 1}. ${p.id} → ${p.title}`);
    });
  }

  if (totalIssues === 0) {
    console.log('\n✅ All problem IDs look good!');
  }

  return issues;
}

checkProblemIds()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
