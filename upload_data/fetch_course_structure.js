/**
 * Fetch Course Structure V2 - Check new optimized Firebase structure
 * 
 * Structure:
 * courses/{slug}                      ← Listing fields
 *   └── details/content               ← Description fields
 *   └── curriculum/unit_N             ← Light (chapter + lecture summaries + videoUrl)
 *   └── lectures/{lectureId}          ← Heavy data only (quiz, exercises, text)
 * 
 * Usage: node fetch_course_structure_v2.js <course_slug>
 */

const admin = require('firebase-admin');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';

// ==================== INITIALIZE FIREBASE ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function fetchCourseStructure(courseSlug) {
  console.log('========================================');
  console.log('📚 Fetch Course Structure V2');
  console.log(`📌 Course: ${courseSlug}`);
  console.log('========================================\n');

  try {
    const courseRef = db.collection('courses').doc(courseSlug);
    
    // 1. ROOT DOCUMENT
    console.log('1️⃣ ROOT DOCUMENT (courses/{slug})');
    console.log('─'.repeat(50));
    
    const courseDoc = await courseRef.get();
    
    if (!courseDoc.exists) {
      console.log('❌ Course not found!');
      return;
    }
    
    const courseData = courseDoc.data();
    console.log('Fields:', Object.keys(courseData).join(', '));
    console.log('\nKey fields:');
    console.log(`   slug: "${courseData.slug}"`);
    console.log(`   courseId: ${courseData.courseId} (type: ${typeof courseData.courseId})`);
    console.log(`   courseName: "${courseData.courseName}"`);
    console.log(`   totalUnits: ${courseData.totalUnits}`);
    console.log(`   totalChapters: ${courseData.totalChapters}`);
    console.log(`   totalLectures: ${courseData.totalLectures}`);
    
    // 2. DETAILS SUBCOLLECTION
    console.log('\n\n2️⃣ DETAILS SUBCOLLECTION (courses/{slug}/details/)');
    console.log('─'.repeat(50));
    
    const detailsSnapshot = await courseRef.collection('details').get();
    
    if (detailsSnapshot.empty) {
      console.log('No details subcollection found');
    } else {
      detailsSnapshot.forEach(doc => {
        console.log(`Document: ${doc.id}`);
        console.log('Fields:', Object.keys(doc.data()).join(', '));
        const desc = doc.data().courseDescription || '';
        console.log(`Description preview: "${desc.substring(0, 100)}..."`);
      });
    }
    
    // 3. CURRICULUM SUBCOLLECTION
    console.log('\n\n3️⃣ CURRICULUM SUBCOLLECTION (courses/{slug}/curriculum/)');
    console.log('─'.repeat(50));
    
    const curriculumSnapshot = await courseRef.collection('curriculum').get();
    
    if (curriculumSnapshot.empty) {
      console.log('No curriculum subcollection found');
    } else {
      console.log(`Found ${curriculumSnapshot.size} unit(s)\n`);
      
      curriculumSnapshot.forEach(unitDoc => {
        const unitData = unitDoc.data();
        console.log(`\n📁 UNIT: ${unitDoc.id}`);
        console.log(`   unitId: "${unitData.unitId}"`);
        console.log(`   unitName: "${unitData.unitName}"`);
        console.log(`   unitOrder: ${unitData.unitOrder} (type: ${typeof unitData.unitOrder})`);
        console.log(`   totalChapters: ${unitData.totalChapters}`);
        
        // Check chapters
        if (unitData.chapters && Array.isArray(unitData.chapters)) {
          console.log(`   chapters: ${unitData.chapters.length} chapter(s)`);
          
          unitData.chapters.forEach((chapter, idx) => {
            console.log(`\n      📖 Chapter ${idx + 1}: ${chapter.chapterName}`);
            console.log(`         chapterId: "${chapter.chapterId}"`);
            console.log(`         chapterOrder: ${chapter.chapterOrder} (type: ${typeof chapter.chapterOrder})`);
            console.log(`         totalLectures: ${chapter.totalLectures}`);
            
            // Check lectures
            if (chapter.lectures && Array.isArray(chapter.lectures)) {
              console.log(`         lectures: ${chapter.lectures.length} lecture(s)`);
              
              // Show first lecture as sample
              if (chapter.lectures.length > 0) {
                const lec = chapter.lectures[0];
                console.log(`\n            📝 Sample Lecture (first):`);
                console.log(`               lectureId: ${lec.lectureId} (type: ${typeof lec.lectureId})`);
                console.log(`               lectureName: "${lec.lectureName}"`);
                console.log(`               lectureType: "${lec.lectureType}"`);
                console.log(`               lectureOrder: ${lec.lectureOrder} (type: ${typeof lec.lectureOrder})`);
                console.log(`               durationInSeconds: ${lec.durationInSeconds} (type: ${typeof lec.durationInSeconds})`);
                console.log(`               videoUrl: ${lec.videoUrl ? '✅ Present' : '❌ null'}`);
                
                // Check what fields are NOT present (should be in lectures subcollection)
                const shouldNotHave = ['quizQuestions', 'exerciseQuestions', 'assessmentQuestions', 'textContent', 'attachments'];
                const hasHeavyData = shouldNotHave.filter(f => lec[f] !== undefined);
                if (hasHeavyData.length > 0) {
                  console.log(`               ⚠️ WARNING: Heavy data found in curriculum: ${hasHeavyData.join(', ')}`);
                } else {
                  console.log(`               ✅ No heavy data (correct!)`);
                }
              }
            }
          });
        }
      });
    }
    
    // 4. LECTURES SUBCOLLECTION (Heavy Data)
    console.log('\n\n4️⃣ LECTURES SUBCOLLECTION (courses/{slug}/lectures/)');
    console.log('─'.repeat(50));
    
    const lecturesSnapshot = await courseRef.collection('lectures').get();
    
    if (lecturesSnapshot.empty) {
      console.log('No lectures subcollection found (no heavy data lectures)');
    } else {
      console.log(`Found ${lecturesSnapshot.size} lecture(s) with heavy data\n`);
      
      // Show first 3 as samples
      const lectureDocs = lecturesSnapshot.docs.slice(0, 3);
      lectureDocs.forEach(lecDoc => {
        const lecData = lecDoc.data();
        console.log(`\n📝 LECTURE: ${lecDoc.id}`);
        console.log(`   lectureId: ${lecData.lectureId} (type: ${typeof lecData.lectureId})`);
        console.log(`   chapterId: "${lecData.chapterId}"`);
        console.log(`   unitId: "${lecData.unitId}"`);
        console.log(`   quizQuestions: ${lecData.quizQuestions ? '✅ Present' : '❌ null'}`);
        console.log(`   exerciseQuestions: ${lecData.exerciseQuestions ? '✅ Present' : '❌ null'}`);
        console.log(`   assessmentQuestions: ${lecData.assessmentQuestions ? '✅ Present' : '❌ null'}`);
        console.log(`   textContent: ${lecData.textContent ? '✅ Present' : '❌ null'}`);
        console.log(`   attachments: ${lecData.attachments?.length || 0} item(s)`);
      });
      
      if (lecturesSnapshot.size > 3) {
        console.log(`\n   ... and ${lecturesSnapshot.size - 3} more lecture(s)`);
      }
    }
    
    // 5. SUMMARY
    console.log('\n\n========================================');
    console.log('📊 STRUCTURE SUMMARY');
    console.log('========================================');
    console.log(`✅ Root document: courses/${courseSlug}`);
    console.log(`✅ Details: ${detailsSnapshot.size} doc(s)`);
    console.log(`✅ Curriculum: ${curriculumSnapshot.size} unit(s)`);
    console.log(`✅ Lectures (heavy): ${lecturesSnapshot.size} doc(s)`);
    
    // Calculate totals from curriculum
    let totalChapters = 0;
    let totalLectures = 0;
    curriculumSnapshot.forEach(unitDoc => {
      const unitData = unitDoc.data();
      if (unitData.chapters && Array.isArray(unitData.chapters)) {
        totalChapters += unitData.chapters.length;
        unitData.chapters.forEach(ch => {
          if (ch.lectures && Array.isArray(ch.lectures)) {
            totalLectures += ch.lectures.length;
          }
        });
      }
    });
    console.log(`📚 Total: ${curriculumSnapshot.size} units, ${totalChapters} chapters, ${totalLectures} lectures`);
    console.log(`📝 Lectures with heavy data: ${lecturesSnapshot.size}`);
    
    // Data type check
    console.log('\n🔍 DATA TYPE CHECK:');
    console.log(`   courseId: ${typeof courseData.courseId === 'number' ? '✅ Number' : '❌ Not Number'}`);
    
    let lectureIdOk = true;
    let orderOk = true;
    curriculumSnapshot.forEach(unitDoc => {
      const unitData = unitDoc.data();
      if (typeof unitData.unitOrder !== 'number') orderOk = false;
      if (unitData.chapters) {
        unitData.chapters.forEach(ch => {
          if (typeof ch.chapterOrder !== 'number') orderOk = false;
          if (ch.lectures) {
            ch.lectures.forEach(lec => {
              if (typeof lec.lectureId !== 'number') lectureIdOk = false;
              if (typeof lec.lectureOrder !== 'number') orderOk = false;
              if (typeof lec.durationInSeconds !== 'number') orderOk = false;
            });
          }
        });
      }
    });
    console.log(`   lectureId: ${lectureIdOk ? '✅ Number' : '❌ Not Number'}`);
    console.log(`   order fields: ${orderOk ? '✅ Number' : '❌ Not Number'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node fetch_course_structure_v2.js <course_slug>');
  console.log('Example: node fetch_course_structure_v2.js 3-responsive-web-design-projects-using-react-and-vite');
  process.exit(1);
}

fetchCourseStructure(args[0]);
