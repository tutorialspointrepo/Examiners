/**
 * Course Stats Updater
 * 
 * This script goes through all courses and counts:
 * - Total Exercises
 * - Total Quizzes
 * 
 * Then updates the root course document with these counts.
 * 
 * Usage: node update_course_stats.js
 */

const admin = require('firebase-admin');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'courses';

// ==================== INITIALIZE SERVICES ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// ==================== MAIN FUNCTION ====================

async function updateCourseStats() {
  console.log('========================================');
  console.log('📊 Course Stats Updater');
  console.log('========================================');
  console.log('Counting Exercises & Quizzes for all courses...\n');

  try {
    // Get all courses
    const coursesSnapshot = await db.collection(COLLECTION_NAME).get();
    
    console.log(`Found ${coursesSnapshot.size} courses\n`);
    
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const courseDoc of coursesSnapshot.docs) {
      const courseSlug = courseDoc.id;
      const courseData = courseDoc.data();
      const courseName = courseData.courseName || courseSlug;
      
      processedCount++;
      console.log(`[${processedCount}/${coursesSnapshot.size}] ${courseName.substring(0, 50)}...`);
      
      try {
        let totalExercises = 0;
        let totalQuizzes = 0;
        
        // Method 1: Count from curriculum subcollection
        const curriculumSnapshot = await db
          .collection(COLLECTION_NAME)
          .doc(courseSlug)
          .collection('curriculum')
          .get();
        
        for (const unitDoc of curriculumSnapshot.docs) {
          const unitData = unitDoc.data();
          const chapters = unitData.chapters || [];
          
          for (const chapter of chapters) {
            const lectures = chapter.lectures || [];
            
            for (const lecture of lectures) {
              const lectureType = (lecture.lectureType || '').toLowerCase();
              
              if (lectureType === 'exercise') {
                totalExercises++;
              } else if (lectureType === 'quiz' || lectureType === 'mcq') {
                totalQuizzes++;
              }
            }
          }
        }
        
        // Method 2: Also check lectures subcollection for actual content
        // This counts lectures that have exercise/quiz questions regardless of type
        const lecturesSnapshot = await db
          .collection(COLLECTION_NAME)
          .doc(courseSlug)
          .collection('lectures')
          .get();
        
        let exercisesWithContent = 0;
        let quizzesWithContent = 0;
        
        for (const lectureDoc of lecturesSnapshot.docs) {
          const lectureData = lectureDoc.data();
          
          // Check if lecture has exercise questions
          if (lectureData.exerciseQuestions) {
            try {
              const exercises = typeof lectureData.exerciseQuestions === 'string' 
                ? JSON.parse(lectureData.exerciseQuestions) 
                : lectureData.exerciseQuestions;
              
              if (Array.isArray(exercises) && exercises.length > 0) {
                exercisesWithContent++;
              }
            } catch (e) {
              // If it's a non-empty string, count it
              if (lectureData.exerciseQuestions && lectureData.exerciseQuestions.trim()) {
                exercisesWithContent++;
              }
            }
          }
          
          // Check if lecture has quiz questions
          if (lectureData.quizQuestions) {
            try {
              const quizzes = typeof lectureData.quizQuestions === 'string' 
                ? JSON.parse(lectureData.quizQuestions) 
                : lectureData.quizQuestions;
              
              if (Array.isArray(quizzes) && quizzes.length > 0) {
                quizzesWithContent++;
              }
            } catch (e) {
              // If it's a non-empty string, count it
              if (lectureData.quizQuestions && lectureData.quizQuestions.trim()) {
                quizzesWithContent++;
              }
            }
          }
        }
        
        // Use the higher count (type-based or content-based)
        const finalExerciseCount = Math.max(totalExercises, exercisesWithContent);
        const finalQuizCount = Math.max(totalQuizzes, quizzesWithContent);
        
        // Update the course document
        await db.collection(COLLECTION_NAME).doc(courseSlug).update({
          totalExercises: finalExerciseCount,
          totalQuizzes: finalQuizCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`    ✅ Exercises: ${finalExerciseCount}, Quizzes: ${finalQuizCount}`);
        updatedCount++;
        
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('\n========================================');
    console.log('📊 UPDATE SUMMARY');
    console.log('========================================');
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📚 Total Processed: ${processedCount}`);
    console.log('========================================\n');
    
    return { updatedCount, errorCount };
    
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}

// ==================== RUN ====================

updateCourseStats()
  .then(result => {
    console.log('Done!');
    process.exit(result.errorCount > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
