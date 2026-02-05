/**
 * Fix Slugs and Canonical URLs
 * Removes incorrect suffixes from slugs (.htm, .) and updates canonical URLs
 * 
 * Usage:
 *   DRY RUN (show what would change):
 *     node fix_slugs.js --dry-run
 * 
 *   APPLY FIXES:
 *     node fix_slugs.js --apply
 * 
 *   FIX SPECIFIC SLUGS:
 *     node fix_slugs.js --fix-list slugs.txt --apply
 */

const admin = require('firebase-admin');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';

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

// ==================== SLUG FIXING FUNCTIONS ====================

const MAX_SLUG_LENGTH = 64;

/**
 * Clean a slug by truncating if too long
 */
function cleanSlug(slug) {
  if (!slug) return slug;
  
  let cleaned = slug;
  
  // Remove .htm or .html suffix (just in case)
  cleaned = cleaned.replace(/\.htm[l]?$/i, '');
  
  // Remove trailing dots
  cleaned = cleaned.replace(/\.+$/, '');
  
  // Truncate if too long
  if (cleaned.length > MAX_SLUG_LENGTH) {
    // Try to cut at a word boundary (hyphen)
    let truncated = cleaned.substring(0, MAX_SLUG_LENGTH);
    const lastHyphen = truncated.lastIndexOf('-');
    
    // If there's a hyphen in the last 15 chars, cut there for cleaner slug
    if (lastHyphen > MAX_SLUG_LENGTH - 15) {
      truncated = truncated.substring(0, lastHyphen);
    }
    
    // Remove trailing hyphens
    truncated = truncated.replace(/-+$/, '');
    
    cleaned = truncated;
  }
  
  return cleaned;
}

/**
 * Generate canonical URL from slug
 */
function generateCanonicalUrl(slug) {
  return `https://www.tutorialspoint.com/practice/${slug}.htm`;
}

/**
 * Check if a slug needs fixing (too long)
 */
function needsFix(slug) {
  if (!slug) return false;
  return slug.length > MAX_SLUG_LENGTH;
}

/**
 * Scan all problems and find those with slugs > 64 chars
 */
async function findProblemsWithBadSlugs() {
  initFirebase();
  
  console.log(`🔍 Scanning all problems for slugs > ${MAX_SLUG_LENGTH} characters...\n`);
  
  const snapshot = await db.collection(COLLECTION_NAME).get();
  
  const problemsToFix = [];
  let totalCount = 0;
  
  snapshot.forEach(doc => {
    totalCount++;
    const data = doc.data();
    const docId = doc.id;
    const slug = data.slug || docId;
    
    // Check if document ID or slug is too long
    if (docId.length > MAX_SLUG_LENGTH || (slug && slug.length > MAX_SLUG_LENGTH)) {
      problemsToFix.push({
        docId,
        currentSlug: slug,
        currentId: data.id,
        currentProblemId: data.problem_id,
        cleanedSlug: cleanSlug(docId),
        data
      });
    }
  });
  
  console.log(`📊 Scanned ${totalCount} problems`);
  console.log(`⚠️  Found ${problemsToFix.length} problems with slugs > ${MAX_SLUG_LENGTH} chars\n`);
  
  return problemsToFix;
}

/**
 * Display problems that need fixing
 */
function displayProblemsToFix(problems) {
  if (problems.length === 0) {
    console.log('✅ No problems need fixing!\n');
    return;
  }
  
  console.log('Problems with slugs > 64 characters:');
  console.log('─'.repeat(80));
  
  problems.forEach((p, i) => {
    console.log(`\n${i + 1}. Document ID: ${p.docId} (${p.docId.length} chars)`);
    console.log(`   Current slug: "${p.currentSlug}" (${p.currentSlug?.length || 0} chars)`);
    console.log(`   Cleaned slug: "${p.cleanedSlug}" (${p.cleanedSlug.length} chars)`);
    console.log(`   Title: ${p.data.title || 'N/A'}`);
  });
  
  console.log('\n' + '─'.repeat(80));
}

/**
 * Apply fixes to a single problem
 * This requires creating a new document and deleting the old one if docId changes
 */
async function fixProblem(problem, dryRun = true) {
  const { docId, cleanedSlug, data } = problem;
  const needsDocIdChange = needsFix(docId);
  
  // Prepare updates
  const updates = {
    slug: cleanedSlug,
    id: cleanedSlug,
    problem_id: cleanedSlug,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Update SEO canonical URL if exists
  if (data.seo && data.seo.canonical) {
    updates['seo.canonical'] = generateCanonicalUrl(cleanedSlug);
  }
  
  // Update SEO ogImage if exists
  if (data.seo && data.seo.ogImage) {
    updates['seo.ogImage'] = `/practice/images/${cleanedSlug}-og.png`;
  }
  
  if (dryRun) {
    console.log(`   [DRY RUN] Would update:`);
    console.log(`     - slug: "${data.slug}" → "${cleanedSlug}"`);
    console.log(`     - id: "${data.id}" → "${cleanedSlug}"`);
    console.log(`     - problem_id: "${data.problem_id}" → "${cleanedSlug}"`);
    if (data.seo?.canonical) {
      console.log(`     - seo.canonical: → "${generateCanonicalUrl(cleanedSlug)}"`);
    }
    if (needsDocIdChange) {
      console.log(`     - Document ID: "${docId}" → "${cleanedSlug}" (requires delete + create)`);
    }
    return true;
  }
  
  try {
    if (needsDocIdChange) {
      // Need to create new document and delete old one
      const newData = { ...data, ...updates };
      delete newData.updatedAt; // Will be set by serverTimestamp
      newData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      
      // Create new document
      await db.collection(COLLECTION_NAME).doc(cleanedSlug).set(newData);
      
      // Delete old document
      await db.collection(COLLECTION_NAME).doc(docId).delete();
      
      console.log(`   ✅ Migrated: "${docId}" → "${cleanedSlug}"`);
    } else {
      // Just update the existing document
      await db.collection(COLLECTION_NAME).doc(docId).update(updates);
      console.log(`   ✅ Updated: "${docId}"`);
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Fix specific slugs from a list
 */
async function fixSpecificSlugs(slugList, dryRun = true) {
  initFirebase();
  
  console.log(`\n🔧 Fixing ${slugList.length} specific slugs (dryRun=${dryRun})...\n`);
  
  let fixedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (const slug of slugList) {
    // Try to find the document (might have bad suffix)
    const possibleIds = [
      slug,
      slug + '.htm',
      slug + '.',
      slug + '.html'
    ];
    
    let found = false;
    
    for (const possibleId of possibleIds) {
      const docRef = db.collection(COLLECTION_NAME).doc(possibleId);
      const doc = await docRef.get();
      
      if (doc.exists) {
        found = true;
        const data = doc.data();
        const cleanedSlug = cleanSlug(possibleId);
        
        console.log(`[${slug}]`);
        
        if (possibleId === cleanedSlug && 
            data.slug === cleanedSlug && 
            data.id === cleanedSlug && 
            data.problem_id === cleanedSlug) {
          console.log(`   ✅ Already clean, skipping`);
          skippedCount++;
        } else {
          const problem = {
            docId: possibleId,
            cleanedSlug,
            data,
            issues: []
          };
          
          const success = await fixProblem(problem, dryRun);
          if (success) {
            fixedCount++;
          } else {
            errorCount++;
          }
        }
        
        break;
      }
    }
    
    if (!found) {
      console.log(`[${slug}]`);
      console.log(`   ⚠️  Not found in database`);
      skippedCount++;
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`${dryRun ? '🔍 Would fix' : '✅ Fixed'}: ${fixedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('═'.repeat(50));
}

/**
 * Fix all problems with bad slugs
 */
async function fixAllBadSlugs(dryRun = true) {
  const problems = await findProblemsWithBadSlugs();
  
  if (problems.length === 0) {
    return;
  }
  
  displayProblemsToFix(problems);
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made\n');
  } else {
    console.log('\n🔧 APPLYING FIXES...\n');
  }
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const problem of problems) {
    console.log(`\n[${problem.docId}] ${problem.data.title || 'Untitled'}`);
    const success = await fixProblem(problem, dryRun);
    if (success) {
      fixedCount++;
    } else {
      errorCount++;
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`${dryRun ? '🔍 Would fix' : '✅ Fixed'}: ${fixedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('═'.repeat(50));
  
  if (dryRun && fixedCount > 0) {
    console.log('\n💡 To apply these fixes, run:');
    console.log('   node fix_slugs.js --apply\n');
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('========================================');
    console.log('🔧 Slug Fixer');
    console.log('   Fixes bad slugs (.htm, .) and URLs');
    console.log('========================================\n');
    console.log('Commands:\n');
    console.log('  SCAN & FIX ALL:');
    console.log('    node fix_slugs.js --dry-run          (preview changes)');
    console.log('    node fix_slugs.js --apply            (apply changes)\n');
    console.log('  FIX SPECIFIC LIST:');
    console.log('    node fix_slugs.js --fix-list <file> --dry-run');
    console.log('    node fix_slugs.js --fix-list <file> --apply\n');
    process.exit(1);
  }
  
  const dryRun = !args.includes('--apply');
  const fixListIndex = args.indexOf('--fix-list');
  
  if (fixListIndex !== -1) {
    const filePath = args[fixListIndex + 1];
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    const slugList = fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('#'));
    
    await fixSpecificSlugs(slugList, dryRun);
  } else {
    await fixAllBadSlugs(dryRun);
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
