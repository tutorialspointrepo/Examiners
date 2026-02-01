/**
 * Create Topics Collection Only
 * 
 * Usage: node create_topics_collection.js
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

async function createTopicsCollection() {
  console.log('========================================');
  console.log('📊 Creating Topics Collection');
  console.log('========================================\n');

  // Fetch all problems
  console.log('📥 Fetching all problems...');
  const problemsSnapshot = await db.collection('problems').get();
  console.log(`   Found ${problemsSnapshot.size} problems\n`);

  // Aggregate by topic
  const topicsMap = {};

  problemsSnapshot.forEach(doc => {
    const data = doc.data();
    const tags = data.tags || [];
    const problemInfo = {
      id: doc.id,
      slug: data.slug || doc.id,
      title: data.title || '',
      difficulty: data.difficulty || 'Medium',
      companies: (data.companies || []).slice(0, 5) // Top 5 companies
    };

    tags.forEach(tag => {
      if (!tag) return;
      
      const topicKey = tag.toLowerCase().replace(/[^a-z0-9\s()]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
      
      // Skip empty or invalid topic keys
      if (!topicKey || topicKey.length === 0) {
        console.log(`   ⚠️  Skipping invalid tag: "${tag}"`);
        return;
      }
      
      if (!topicsMap[topicKey]) {
        topicsMap[topicKey] = {
          id: topicKey,
          name: tag,
          count: 0,
          problems: [],
          difficultyCounts: { Easy: 0, Medium: 0, Hard: 0 }
        };
      }

      topicsMap[topicKey].count++;
      topicsMap[topicKey].problems.push(problemInfo);
      
      // Count by difficulty
      const diff = problemInfo.difficulty || 'Medium';
      if (topicsMap[topicKey].difficultyCounts[diff] !== undefined) {
        topicsMap[topicKey].difficultyCounts[diff]++;
      }
    });
  });

  const topics = Object.values(topicsMap);
  console.log(`📊 Found ${topics.length} unique topics\n`);

  // Upload to Firestore in batches
  console.log('📤 Uploading topics collection...');
  
  const BATCH_SIZE = 400;
  let uploaded = 0;

  for (let i = 0; i < topics.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = topics.slice(i, i + BATCH_SIZE);

    chunk.forEach(topic => {
      // Create main topic doc (without full problems array for fast queries)
      const topicDoc = {
        id: topic.id,
        name: topic.name,
        count: topic.count,
        difficultyCounts: topic.difficultyCounts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = db.collection('topics').doc(topic.id);
      batch.set(docRef, topicDoc, { merge: true });
    });

    await batch.commit();
    uploaded += chunk.length;
    console.log(`   ✅ Uploaded ${uploaded}/${topics.length} topics`);
  }

  // Create topic_problems subcollection for pagination
  console.log('\n📤 Creating topic problems for fast pagination...');
  
  let problemsUploaded = 0;
  const totalProblems = topics.reduce((sum, t) => sum + t.problems.length, 0);

  for (const topic of topics) {
    // Upload problems in batches
    for (let i = 0; i < topic.problems.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = topic.problems.slice(i, i + BATCH_SIZE);

      chunk.forEach((problem) => {
        const docRef = db.collection('topics').doc(topic.id)
          .collection('problems').doc(problem.id);
        
        batch.set(docRef, {
          ...problem,
          topicId: topic.id,
          topicName: topic.name
        }, { merge: true });
      });

      await batch.commit();
      problemsUploaded += chunk.length;
    }
    
    process.stdout.write(`\r   ✅ Uploaded ${problemsUploaded}/${totalProblems} topic-problem links`);
  }

  console.log('\n');
  
  // Print ALL topics sorted by count
  console.log('────────────────────────────────────────');
  console.log(`🏆 All ${topics.length} Topics by Problem Count:`);
  console.log('────────────────────────────────────────');
  
  const sorted = topics.sort((a, b) => b.count - a.count);
  sorted.forEach((t, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${t.name.padEnd(30)} ${t.count} problems`);
  });

  console.log('\n========================================');
  console.log('✅ Topics Collection Created!');
  console.log('========================================');

  return topics;
}

createTopicsCollection()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
