/**
 * Generate problems.json for sidebar
 * Fetches all problems from Firebase and creates a minimal JSON file
 * 
 * Usage: node generate_problems_json.js
 * Output: problems.json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'problems';
const OUTPUT_FILE = 'problems.json';

// ==================== INITIALIZE FIREBASE ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// ==================== MAIN FUNCTION ====================
async function generateProblemsJSON() {
  console.log('========================================');
  console.log('📋 Problems JSON Generator');
  console.log('========================================\n');

  try {
    console.log('📡 Fetching problems from Firebase...');
    
    // Fetch all problems ordered by number
    const snapshot = await db.collection(COLLECTION_NAME)
      .orderBy('number', 'asc')
      .select('slug', 'number', 'title', 'difficulty')
      .get();

    if (snapshot.empty) {
      console.log('⚠️  No problems found in database');
      process.exit(1);
    }

    // Map to minimal structure
    const problems = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        number: data.number || 0,
        slug: data.slug || doc.id,
        title: data.title || '',
        difficulty: data.difficulty || 'Medium'
      };
    });

    console.log(`✅ Fetched ${problems.length} problems\n`);

    // Create JSON structure
    const output = {
      generated: new Date().toISOString(),
      count: problems.length,
      problems: problems
    };

    // Write to file
    const outputPath = path.join(__dirname, OUTPUT_FILE);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('========================================');
    console.log('📊 SUMMARY');
    console.log('========================================');
    console.log(`✅ Total problems: ${problems.length}`);
    console.log(`📁 Output file: ${outputPath}`);
    console.log(`📦 File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    console.log('========================================\n');

    // Show difficulty breakdown
    const easy = problems.filter(p => p.difficulty === 'Easy').length;
    const medium = problems.filter(p => p.difficulty === 'Medium').length;
    const hard = problems.filter(p => p.difficulty === 'Hard').length;
    
    console.log('📈 Difficulty Breakdown:');
    console.log(`   🟢 Easy:   ${easy}`);
    console.log(`   🟡 Medium: ${medium}`);
    console.log(`   🔴 Hard:   ${hard}`);
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
generateProblemsJSON();
