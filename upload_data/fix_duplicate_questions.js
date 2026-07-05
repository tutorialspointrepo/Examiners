
/**
 * fix_duplicate_questions.js - Find and remove duplicate questions from Question Bank
 * 
 * Duplicates are detected by matching questionText content (case-insensitive, trimmed).
 * For each group of duplicates, keeps the OLDEST one (earliest createdAt) and removes the rest.
 * Also checks if removed questions are referenced in any exam's questionsList/questionPool/likertQuestions.
 *
 * Prerequisites:
 *   npm install firebase-admin
 *   Place serviceAccountKey.json in same directory
 *
 * Usage:
 *   node fix_duplicate_questions.js --dry-run                        (scan all, preview only)
 *   node fix_duplicate_questions.js --dry-run --collegeId=TPX        (scan one college)
 *   node fix_duplicate_questions.js --collegeId=TPX                  (fix one college)
 *   node fix_duplicate_questions.js --all                            (fix all colleges)
 *   node fix_duplicate_questions.js --dry-run --verbose              (show full details)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ============================================
// INIT FIREBASE ADMIN
// ============================================
const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('❌ serviceAccountKey.json not found in the same directory as this script.');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Collection name — adjust if different in your setup
const QUESTION_BANK_COLLECTION = 'questionBank';
const EXAMS_COLLECTION = 'exams';

// ============================================
// PARSE CLI ARGS
// ============================================
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const allColleges = args.includes('--all');
const collegeIdArg = args.find(a => a.startsWith('--collegeId='));
const collegeId = collegeIdArg ? collegeIdArg.split('=')[1] : null;

if (!collegeId && !allColleges && !dryRun) {
  console.error('❌ --collegeId=ID or --all is required (or use --dry-run to scan all)');
  process.exit(1);
}

console.log('╔══════════════════════════════════════════════════╗');
console.log('║   Question Bank Duplicate Finder & Cleaner      ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`College:  ${collegeId || 'ALL'}`);
console.log(`Mode:     ${dryRun ? '🔍 DRY RUN (no changes)' : '🔥 LIVE (will delete duplicates)'}`);
console.log(`Verbose:  ${verbose ? 'ON' : 'OFF'}\n`);

// ============================================
// STEP 1: Load all questions
// ============================================
async function loadQuestions(collegeId) {
  let query = db.collection(QUESTION_BANK_COLLECTION);
  if (collegeId) {
    query = query.where('collegeId', '==', collegeId);
  }
  
  const snapshot = await query.get();
  console.log(`📥 Loaded ${snapshot.size} questions${collegeId ? ` for college ${collegeId}` : ''}`);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// ============================================
// STEP 2: Find duplicates by questionText
// ============================================
function findDuplicates(questions) {
  // Group by normalized questionText
  const groups = new Map(); // normalizedText -> [question, question, ...]
  
  for (const q of questions) {
    if (!q.questionText) continue;
    
    // Normalize: strip HTML, lowercase, collapse whitespace
    const normalized = q.questionText
      .replace(/<[^>]*>/g, '')  // strip HTML tags
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!normalized) continue;
    
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized).push(q);
  }
  
  // Filter to only groups with 2+ questions (actual duplicates)
  const duplicateGroups = [];
  for (const [text, group] of groups) {
    if (group.length > 1) {
      // Sort by createdAt — keep oldest
      group.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                      a.createdAt?._seconds ? a.createdAt._seconds * 1000 :
                      new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() :
                      b.createdAt?._seconds ? b.createdAt._seconds * 1000 :
                      new Date(b.createdAt || 0).getTime();
        return aTime - bTime;
      });
      
      duplicateGroups.push({
        text: text.substring(0, 80),
        keep: group[0],       // oldest
        remove: group.slice(1) // all others
      });
    }
  }
  
  return duplicateGroups;
}

// ============================================
// STEP 3: Check if questions are used in exams
// ============================================
async function findExamReferences(questionIds) {
  const references = new Map(); // questionId -> [examId, examId, ...]
  
  // Get all exams
  const examsSnap = await db.collection(EXAMS_COLLECTION).get();
  console.log(`🔍 Scanning ${examsSnap.size} exams for references...`);
  
  for (const examDoc of examsSnap.docs) {
    const examId = examDoc.id;
    
    // Read questions subcollection
    try {
      const questionsDoc = await db.collection(EXAMS_COLLECTION)
        .doc(examId)
        .collection('examQuestions')
        .doc('main')
        .get();
      
      if (!questionsDoc.exists) continue;
      const data = questionsDoc.data();
      
      const allExamQuestions = [
        ...(data.questionsList || []),
        ...(data.questionPool || []),
        ...(data.likertQuestions || [])
      ];
      
      for (const eq of allExamQuestions) {
        const qId = eq.questionBankId || eq.id;
        if (questionIds.has(qId)) {
          if (!references.has(qId)) references.set(qId, []);
          references.get(qId).push(examId);
        }
      }
    } catch (err) {
      // Skip exams with no subcollection
    }
  }
  
  return references;
}

// ============================================
// STEP 4: Remove duplicates
// ============================================
async function removeDuplicates(duplicateGroups, examReferences) {
  let totalRemoved = 0;
  let totalKept = 0;
  
  let batchCount = 0;
  let batch = db.batch();
  const MAX_BATCH = 450;
  
  for (const group of duplicateGroups) {
    console.log(`\n📝 "${group.text}..."`);
    console.log(`   ✅ KEEP: ${group.keep.id} (${group.keep.type || '?'}, created: ${formatDate(group.keep.createdAt)})`);
    totalKept++;
    
    for (const dup of group.remove) {
      const refs = examReferences.get(dup.id) || [];
      const refNote = refs.length > 0 ? ` (referenced in ${refs.length} exam(s) — exams have full copy, safe to delete)` : '';
      
      if (verbose) {
        console.log(`   🗑️  REMOVE: ${dup.id} (${dup.type || '?'}, created: ${formatDate(dup.createdAt)}, by: ${dup.createdByName || '?'})${refNote}`);
      } else {
        console.log(`   🗑️  REMOVE: ${dup.id}${refNote}`);
      }
      
      if (!dryRun) {
        batch.delete(db.collection(QUESTION_BANK_COLLECTION).doc(dup.id));
        batchCount++;
        
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} deletions`);
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      totalRemoved++;
    }
  }
  
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`\n💾 Committed final batch of ${batchCount} deletions`);
  }
  
  return { totalRemoved, totalKept };
}

// ============================================
// HELPERS
// ============================================
function formatDate(ts) {
  if (!ts) return 'unknown';
  const d = ts.toDate ? ts.toDate() : 
            ts._seconds ? new Date(ts._seconds * 1000) :
            new Date(ts);
  return d.toISOString().split('T')[0];
}

// ============================================
// MAIN
// ============================================
async function main() {
  // Step 1: Load questions
  const questions = await loadQuestions(collegeId || (allColleges ? null : null));
  
  if (questions.length === 0) {
    console.log('No questions found.');
    process.exit(0);
  }
  
  // Step 2: Find duplicates
  const duplicateGroups = findDuplicates(questions);
  
  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.remove.length, 0);
  console.log(`\n🔍 Found ${duplicateGroups.length} duplicate groups (${totalDuplicates} questions to remove, ${duplicateGroups.length} to keep)`);
  
  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!');
    process.exit(0);
  }
  
  // Step 3: Check exam references for questions being removed
  const removeIds = new Set();
  for (const group of duplicateGroups) {
    for (const dup of group.remove) {
      removeIds.add(dup.id);
    }
  }
  
  const examReferences = await findExamReferences(removeIds);
  const referencedCount = [...examReferences.values()].filter(refs => refs.length > 0).length;
  if (referencedCount > 0) {
    console.log(`⚠️  ${referencedCount} duplicate(s) are referenced in exams — these will be SKIPPED`);
  }
  
  // Step 4: Remove (or preview)
  const result = await removeDuplicates(duplicateGroups, examReferences);
  
  // Summary
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Duplicate groups found:  ${String(duplicateGroups.length).padStart(6)}                ║`);
  console.log(`║  Questions kept (oldest): ${String(result.totalKept).padStart(6)}                ║`);
  console.log(`║  Questions removed:       ${String(result.totalRemoved).padStart(6)}                ║`);
  console.log(`║  Mode: ${dryRun ? 'DRY RUN (no changes made)   ' : 'LIVE (changes committed)     '}       ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
