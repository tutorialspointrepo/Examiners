/**
 * Delete All Courses - Removes courses collection with all subcollections
 * 
 * Usage: node delete_all_courses.js
 * Or: node delete_all_courses.js <specific_slug>
 */

const admin = require('firebase-admin');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'courses';

// ==================== INITIALIZE FIREBASE ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// Delete a document and all its subcollections
async function deleteDocumentWithSubcollections(docRef) {
  // Get all subcollections
  const subcollections = await docRef.listCollections();
  
  for (const subcollection of subcollections) {
    const subcollectionDocs = await subcollection.listDocuments();
    
    for (const subDoc of subcollectionDocs) {
      // Recursively delete subcollection documents
      await deleteDocumentWithSubcollections(subDoc);
      await subDoc.delete();
    }
  }
  
  // Delete the document itself
  await docRef.delete();
}

async function deleteAllCourses() {
  console.log('========================================');
  console.log('🗑️  Delete All Courses');
  console.log('========================================\n');
  
  try {
    const coursesRef = db.collection(COLLECTION_NAME);
    const courseDocs = await coursesRef.listDocuments();
    
    console.log(`Found ${courseDocs.length} courses to delete\n`);
    
    if (courseDocs.length === 0) {
      console.log('No courses found. Collection is empty.');
      return;
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const courseDoc of courseDocs) {
      try {
        process.stdout.write(`[${deleted + failed + 1}/${courseDocs.length}] Deleting ${courseDoc.id}...`);
        
        await deleteDocumentWithSubcollections(courseDoc);
        
        deleted++;
        console.log(' ✅');
      } catch (error) {
        failed++;
        console.log(` ❌ ${error.message}`);
      }
    }
    
    console.log('\n========================================');
    console.log('📊 DELETE SUMMARY');
    console.log('========================================');
    console.log(`✅ Deleted: ${deleted}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

async function deleteSingleCourse(slug) {
  console.log('========================================');
  console.log(`🗑️  Delete Course: ${slug}`);
  console.log('========================================\n');
  
  try {
    const courseRef = db.collection(COLLECTION_NAME).doc(slug);
    const courseDoc = await courseRef.get();
    
    if (!courseDoc.exists) {
      console.log('❌ Course not found!');
      process.exit(1);
    }
    
    console.log('Deleting course and all subcollections...');
    await deleteDocumentWithSubcollections(courseRef);
    
    console.log('✅ Course deleted successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

// Main
const args = process.argv.slice(2);

if (args.length > 0) {
  // Delete specific course
  deleteSingleCourse(args[0]);
} else {
  // Delete all courses - ask for confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('⚠️  This will delete ALL courses. Type "DELETE" to confirm: ', (answer) => {
    rl.close();
    if (answer === 'DELETE') {
      deleteAllCourses();
    } else {
      console.log('Cancelled.');
      process.exit(0);
    }
  });
}
