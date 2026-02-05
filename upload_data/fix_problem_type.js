/**
 * Fix problemType Based on Excel Topics
 * Reads Excel file, checks Topics field, updates problemType in Firebase
 * 
 * Usage:
 *   DRY RUN (preview changes):
 *     node fix_problem_type.js --dry-run
 * 
 *   APPLY FIXES:
 *     node fix_problem_type.js --apply
 */

const admin = require('firebase-admin');
const xlsx = require('xlsx');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';
const EXCEL_FILE = './Leetcode_Original.xlsx';

// ==================== INITIALIZE FIREBASE ====================
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

// ==================== HELPER FUNCTIONS ====================

function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Determine problemType based on Topics field
 */
function getProblemType(topics) {
  if (!topics) return 'coding';
  
  const topicsLower = topics.toLowerCase();
  const sqlKeywords = ['database', 'sql', 'mysql', 'postgresql', 'sqlite'];
  
  for (const keyword of sqlKeywords) {
    if (topicsLower.includes(keyword)) {
      return 'sql';
    }
  }
  
  return 'coding';
}

// ==================== MAIN LOGIC ====================

async function fixProblemTypes(dryRun = true) {
  initFirebase();
  
  // Read Excel file
  console.log(`📖 Reading Excel file: ${EXCEL_FILE}\n`);
  
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`❌ Excel file not found: ${EXCEL_FILE}`);
    process.exit(1);
  }
  
  const workbook = xlsx.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0]; // First sheet: "Complete 3600 Questions"
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Sheet: "${sheetName}"`);
  console.log(`📊 Total rows in Excel: ${data.length}\n`);
  
  // Process each row
  let foundCount = 0;
  let notFoundCount = 0;
  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let errorCount = 0;
  
  const updates = [];
  const notFound = [];
  
  console.log('🔍 Scanning problems...\n');
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const problemName = row['Problem Name'];
    const topics = row['Topics'];
    
    if (!problemName) continue;
    
    const slug = generateSlug(problemName);
    const expectedType = getProblemType(topics);
    
    // Check if exists in Firebase
    try {
      const docRef = db.collection(COLLECTION_NAME).doc(slug);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        notFoundCount++;
        notFound.push({ slug, problemName });
        continue;
      }
      
      foundCount++;
      const currentData = doc.data();
      const currentType = currentData.problemType;
      
      if (currentType === expectedType) {
        alreadyCorrectCount++;
      } else {
        updates.push({
          slug,
          problemName,
          topics,
          currentType: currentType || 'NULL',
          expectedType
        });
      }
      
    } catch (error) {
      errorCount++;
      console.error(`   ❌ Error checking ${slug}: ${error.message}`);
    }
    
    // Progress indicator
    if ((i + 1) % 500 === 0) {
      console.log(`   Processed ${i + 1}/${data.length}...`);
    }
  }
  
  console.log(`   Processed ${data.length}/${data.length}... Done!\n`);
  
  // Summary
  console.log('═'.repeat(60));
  console.log('📊 SCAN SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Found in Firebase: ${foundCount}`);
  console.log(`❌ Not found in Firebase: ${notFoundCount}`);
  console.log(`✓  Already correct: ${alreadyCorrectCount}`);
  console.log(`⚠️  Need update: ${updates.length}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('═'.repeat(60));
  
  // Show updates needed
  if (updates.length > 0) {
    console.log(`\n📝 PROBLEMS NEEDING UPDATE (${updates.length}):\n`);
    
    updates.forEach((u, i) => {
      console.log(`${i + 1}. ${u.slug}`);
      console.log(`   Name: ${u.problemName}`);
      console.log(`   Topics: ${u.topics}`);
      console.log(`   Current: ${u.currentType} → Expected: ${u.expectedType}`);
      console.log('');
    });
  }
  
  // Apply updates if not dry run
  if (updates.length > 0) {
    if (dryRun) {
      console.log('─'.repeat(60));
      console.log('🔍 DRY RUN - No changes made');
      console.log('─'.repeat(60));
      console.log('\n💡 To apply these changes, run:');
      console.log('   node fix_problem_type.js --apply\n');
    } else {
      console.log('─'.repeat(60));
      console.log('🔧 APPLYING UPDATES...');
      console.log('─'.repeat(60));
      
      for (const u of updates) {
        try {
          await db.collection(COLLECTION_NAME).doc(u.slug).update({
            problemType: u.expectedType
          });
          updatedCount++;
          console.log(`   ✅ Updated: ${u.slug} (${u.currentType} → ${u.expectedType})`);
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Failed: ${u.slug} - ${error.message}`);
        }
      }
      
      console.log('\n═'.repeat(60));
      console.log('📊 UPDATE SUMMARY');
      console.log('═'.repeat(60));
      console.log(`✅ Successfully updated: ${updatedCount}`);
      console.log(`❌ Failed: ${errorCount}`);
      console.log('═'.repeat(60));
    }
  } else {
    console.log('\n✅ All problems have correct problemType! Nothing to update.\n');
  }
  
  // Save not found list
  if (notFound.length > 0) {
    const notFoundFile = 'problems_not_in_firebase.json';
    fs.writeFileSync(notFoundFile, JSON.stringify(notFound, null, 2));
    console.log(`\n📁 Problems not found in Firebase saved to: ${notFoundFile}`);
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('========================================');
    console.log('🔧 Fix problemType Based on Excel');
    console.log('========================================\n');
    console.log('Usage:');
    console.log('  node fix_problem_type.js --dry-run   (preview changes)');
    console.log('  node fix_problem_type.js --apply     (apply changes)\n');
    process.exit(1);
  }
  
  const dryRun = !args.includes('--apply');
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('\n🔧 APPLY MODE - Changes will be saved to Firebase\n');
  }
  
  await fixProblemTypes(dryRun);
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
