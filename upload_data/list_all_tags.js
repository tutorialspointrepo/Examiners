/**
 * List All Unique Tags in Problems Collection
 * Helps identify data issues before fixing
 * 
 * Usage: node list_all_tags.js
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

async function listAllTags() {
  console.log('========================================');
  console.log('📋 Listing All Unique Tags');
  console.log('========================================\n');

  const problemsSnapshot = await db.collection('problems').get();
  console.log(`📊 Total problems: ${problemsSnapshot.size}\n`);

  // Collect all tags with counts and sample problem
  const tagsMap = {};

  problemsSnapshot.forEach(doc => {
    const data = doc.data();
    const tags = data.tags || [];

    tags.forEach(tag => {
      if (!tag) return;
      
      if (!tagsMap[tag]) {
        tagsMap[tag] = {
          tag: tag,
          count: 0,
          sampleProblems: []
        };
      }
      
      tagsMap[tag].count++;
      if (tagsMap[tag].sampleProblems.length < 3) {
        tagsMap[tag].sampleProblems.push({
          id: doc.id,
          title: data.title
        });
      }
    });
  });

  const allTags = Object.values(tagsMap).sort((a, b) => b.count - a.count);
  
  console.log(`📊 Total unique tags: ${allTags.length}\n`);

  // Categorize tags
  const normalTags = [];
  const suspiciousTags = [];  // Long tags, likely problem descriptions
  const lowCountTags = [];     // Tags with only 1-2 problems

  allTags.forEach(t => {
    if (t.tag.length > 40) {
      suspiciousTags.push(t);
    } else if (t.count <= 2) {
      lowCountTags.push(t);
    } else {
      normalTags.push(t);
    }
  });

  // Print normal tags
  console.log('────────────────────────────────────────');
  console.log(`✅ NORMAL TAGS (${normalTags.length}):`);
  console.log('────────────────────────────────────────');
  normalTags.forEach((t, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${t.tag.padEnd(35)} ${t.count} problems`);
  });

  // Print low count tags (potential typos/duplicates)
  console.log('\n────────────────────────────────────────');
  console.log(`⚠️  LOW COUNT TAGS - 1-2 problems (${lowCountTags.length}):`);
  console.log('   (May be typos or should be merged)');
  console.log('────────────────────────────────────────');
  lowCountTags.forEach((t, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. "${t.tag}" (${t.count})`);
    t.sampleProblems.forEach(p => {
      console.log(`      → ${p.id}`);
    });
  });

  // Print suspicious tags
  if (suspiciousTags.length > 0) {
    console.log('\n────────────────────────────────────────');
    console.log(`❌ SUSPICIOUS TAGS - Too long (${suspiciousTags.length}):`);
    console.log('   (Likely problem descriptions, not tags)');
    console.log('────────────────────────────────────────');
    suspiciousTags.forEach((t, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. "${t.tag.substring(0, 60)}${t.tag.length > 60 ? '...' : ''}" (${t.count})`);
      t.sampleProblems.forEach(p => {
        console.log(`      → ${p.id}`);
      });
    });
  }

  // Summary
  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`✅ Normal tags:     ${normalTags.length}`);
  console.log(`⚠️  Low count tags: ${lowCountTags.length}`);
  console.log(`❌ Suspicious tags: ${suspiciousTags.length}`);
  console.log(`📊 Total unique:    ${allTags.length}`);

  return { normalTags, lowCountTags, suspiciousTags };
}

listAllTags()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
