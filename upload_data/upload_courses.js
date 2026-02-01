/**
 * Courses Uploader - Optimized Structure
 * 
 * Structure:
 * courses/{slug}              ← Listing fields (lightweight)
 *   └── details/info          ← Heavy description fields
 *   └── curriculum/unit_1...  ← Units with lectures
 * 
 * Usage: node upload_courses.js <json_file_path>
 */

const admin = require('firebase-admin');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'courses';

// ==================== PROCESSING LIMIT ====================
const MAX_COURSES_TO_PROCESS = 100; // Change this to process more courses

// ==================== INITIALIZE SERVICES ====================
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: FIREBASE_PROJECT_ID
});

const db = admin.firestore();

// ==================== HELPER FUNCTIONS ====================

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Upload course with optimized structure
 */
async function uploadCourse(course) {
  const curriculumArray = course.curriculum || [];
  const slug = course.courseSlug || generateSlug(course.courseName);
  
  // Calculate stats
  const totalUnits = curriculumArray.length;
  const totalLectures = curriculumArray.reduce((sum, unit) => sum + (unit.lectures || []).length, 0);
  const totalDuration = curriculumArray.reduce((sum, unit) => {
    return sum + (unit.lectures || []).reduce((lectureSum, lecture) => {
      return lectureSum + (lecture.durationInSeconds || 0);
    }, 0);
  }, 0);
  
  try {
    const courseRef = db.collection(COLLECTION_NAME).doc(slug);
    
    // 1. ROOT DOCUMENT - Listing fields only (lightweight)
    const listingDoc = {
      slug: slug,
      courseId: course.courseId,
      courseName: course.courseName || '',
      courseAuthor: course.courseAuthor || '',
      thumbnailUrl: course.thumbnailUrl || '',
      tagLine: course.tagLine || '',
      complexityLevel: course.complexityLevel || 1,
      totalUnits: totalUnits,
      totalLectures: totalLectures,
      totalDuration: totalDuration,
      prices: course.prices || {
        INR: { originalPrice: 0, discountedPrice: 0 },
        USD: { originalPrice: 0, discountedPrice: 0 },
        GBP: { originalPrice: 0, discountedPrice: 0 },
        CAD: { originalPrice: 0, discountedPrice: 0 },
        AED: { originalPrice: 0, discountedPrice: 0 }
      },
      courseCategories: course.courseCategories || [],
      isFree: course.isFree || false,
      language: course.language || 'en',
      dateOfPublishing: course.dateOfPublishing || null,
      status: 'active',
      isPublished: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await courseRef.set(listingDoc);
    console.log(`    ✅ Root (listing): ${slug}`);
    
    // 2. DETAILS SUBCOLLECTION - Heavy description fields
    const detailsDoc = {
      courseDescription: course.courseDescription || '',
      coursePurpose: course.coursePurpose || '',
      coursePrerequisite: course.coursePrerequisite || '',
      updatedDate: course.updatedDate || null
    };
    
    await courseRef.collection('details').doc('content').set(detailsDoc);
    console.log(`    ✅ Details: details/content`);
    
    // 3. CURRICULUM SUBCOLLECTION - Units with lectures
    for (let i = 0; i < curriculumArray.length; i++) {
      const unit = curriculumArray[i];
      const unitKey = `unit_${i + 1}`;
      
      // Build lectures map
      const lectures = {};
      (unit.lectures || []).forEach((lecture, idx) => {
        lectures[`lecture_${idx + 1}`] = {
          lectureId: lecture.lectureId,
          lectureName: lecture.lectureName || '',
          lectureType: lecture.lectureType || 'Video',
          lectureOrder: lecture.lectureOrder || idx + 1,
          durationInSeconds: lecture.durationInSeconds || 0,
          videoUrl: lecture.videoUrl || null,
          textContent: lecture.textContent || null,
          quizQuestions: lecture.quizQuestions || null,
          exerciseQuestions: lecture.exerciseQuestions || null,
          assessmentQuestions: lecture.assessmentQuestions || null,
          attachments: lecture.attachments || []
        };
      });
      
      const unitDoc = {
        unitId: unit.unitId,
        unitName: unit.unitName || '',
        unitOrder: unit.unitOrder || i + 1,
        totalLectures: (unit.lectures || []).length,
        lectures: lectures
      };
      
      await courseRef.collection('curriculum').doc(unitKey).set(unitDoc);
    }
    console.log(`    ✅ Curriculum: ${totalUnits} units`);
    
    return { success: true, units: totalUnits, lectures: totalLectures };
    
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return { success: false, units: 0, lectures: 0 };
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node upload_courses.js <json_file_path>');
    console.log('Example: node upload_courses.js ./courses_complete.json');
    process.exit(1);
  }
  
  const jsonPath = args[0];
  
  console.log('========================================');
  console.log('🚀 Courses Uploader (Optimized Structure)');
  console.log('📁 courses/{slug}');
  console.log('   ├── listing fields (root)');
  console.log('   ├── details/content (subcollection)');
  console.log('   └── curriculum/unit_N (subcollection)');
  console.log(`📌 Processing: ${MAX_COURSES_TO_PROCESS} course(s)`);
  console.log('========================================\n');
  
  let courses;
  try {
    const fileContent = fs.readFileSync(jsonPath, 'utf8');
    courses = JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Error reading JSON: ${error.message}`);
    process.exit(1);
  }
  
  const coursesToProcess = Math.min(courses.length, MAX_COURSES_TO_PROCESS);
  console.log(`📊 Found ${courses.length} courses, processing ${coursesToProcess}\n`);
  
  let successCount = 0;
  let failCount = 0;
  let totalLectures = 0;
  let totalUnits = 0;
  
  for (let i = 0; i < coursesToProcess; i++) {
    const course = courses[i];
    
    if (!course.courseName) {
      console.log(`⚠️  Skipping index ${i}: No course name`);
      continue;
    }
    
    console.log(`\n[${i + 1}/${coursesToProcess}] ${course.courseName}`);
    console.log('─'.repeat(50));
    
    const result = await uploadCourse(course);
    
    if (result.success) {
      successCount++;
      totalUnits += result.units;
      totalLectures += result.lectures;
    } else {
      failCount++;
    }
    
    if (i < coursesToProcess - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n========================================');
  console.log('📊 UPLOAD SUMMARY');
  console.log('========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📚 Units: ${totalUnits} | 🎬 Lectures: ${totalLectures}`);
  console.log('========================================\n');
  
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});