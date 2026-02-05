/**
 * Courses Uploader - Reads Excel directly
 * 
 * Structure:
 * courses/{slug}                      ← Listing fields
 *   └── details/content               ← Description fields
 *   └── curriculum/unit_N             ← Unit with chapters containing lectures
 * 
 * Usage: node upload_courses_from_excel.js <excel_file_path>
 */

const admin = require('firebase-admin');
const XLSX = require('xlsx');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const COLLECTION_NAME = 'courses';

// ==================== PROCESSING LIMIT ====================
const MAX_COURSES_TO_PROCESS = 200;

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

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  
  // Read Metadata sheet
  const metadataSheet = workbook.Sheets['Metadata'];
  const metadata = XLSX.utils.sheet_to_json(metadataSheet);
  
  // Read Curriculum sheet
  const curriculumSheet = workbook.Sheets['Curriculum'];
  const curriculum = XLSX.utils.sheet_to_json(curriculumSheet);
  
  return { metadata, curriculum };
}

function buildCourses(metadata, curriculum) {
  const courses = [];
  
  // Group curriculum by course_id
  const curriculumByCourse = {};
  curriculum.forEach(row => {
    const courseId = row.course_id;
    if (!curriculumByCourse[courseId]) {
      curriculumByCourse[courseId] = [];
    }
    curriculumByCourse[courseId].push(row);
  });
  
  // Build each course
  metadata.forEach(meta => {
    const courseId = meta.course_id;
    const courseRows = curriculumByCourse[courseId] || [];
    
    // Build Unit > Chapter > Lecture structure
    const unitsMap = {};
    
    courseRows.forEach(row => {
      const unitNumber = row.unit_number;
      const chapterName = row.chapter || 'Default Chapter';
      
      // Initialize unit if not exists
      if (!unitsMap[unitNumber]) {
        unitsMap[unitNumber] = {
          unitId: `${courseId}_unit_${unitNumber}`,
          unitName: `Unit ${unitNumber}`,
          unitOrder: unitNumber,
          chaptersMap: {}
        };
      }
      
      // Initialize chapter if not exists
      if (!unitsMap[unitNumber].chaptersMap[chapterName]) {
        const chapterOrder = Object.keys(unitsMap[unitNumber].chaptersMap).length + 1;
        unitsMap[unitNumber].chaptersMap[chapterName] = {
          chapterId: `${courseId}_unit_${unitNumber}_ch_${chapterOrder}`,
          chapterName: chapterName,
          chapterOrder: chapterOrder,
          lectures: []
        };
      }
      
      // Add lecture
      const lectureType = (row.type || 'video').toLowerCase();
      let textContent = null;
      if (lectureType === 'text' && row.lecture_description) {
        textContent = row.lecture_description;
      }
      
      const lecture = {
        lectureId: row.lecture_id,
        lectureName: row.lecture_name || '',
        lectureType: row.type || 'video',
        lectureOrder: unitsMap[unitNumber].chaptersMap[chapterName].lectures.length + 1,
        durationInSeconds: row.duration_in_seconds || 0,
        videoUrl: row.video_url || null,
        textContent: textContent,
        quizQuestions: row.quiz_questions || null,
        exerciseQuestions: row.exercises || null,
        assessmentQuestions: row.assessments || null,
        attachments: row.attachments ? [row.attachments] : []
      };
      
      unitsMap[unitNumber].chaptersMap[chapterName].lectures.push(lecture);
    });
    
    // Convert maps to arrays
    const curriculumArray = Object.keys(unitsMap)
      .sort((a, b) => Number(a) - Number(b))
      .map(unitNum => {
        const unit = unitsMap[unitNum];
        const chapters = Object.values(unit.chaptersMap)
          .sort((a, b) => a.chapterOrder - b.chapterOrder);
        
        return {
          unitId: unit.unitId,
          unitName: unit.unitName,
          unitOrder: unit.unitOrder,
          chapters: chapters
        };
      });
    
    // Build course object
    const course = {
      courseId: courseId,
      courseName: meta.course_name || '',
      courseSlug: meta.course_title || generateSlug(meta.course_name || ''),
      courseAuthor: meta.author || '',
      thumbnailUrl: meta.course_thumbnail_url || '',
      tagLine: meta.tag_line || '',
      complexityLevel: meta.level || 1,
      courseDescription: meta.description || '',
      coursePurpose: meta.course_goals || '',
      coursePrerequisite: meta.course_prerequisites || '',
      courseCategories: meta.category ? meta.category.split('|').map(c => c.trim()).filter(c => c) : [],
      isFree: meta.free_course === true || meta.free_course === 'TRUE',
      language: meta.language || 'en',
      dateOfPublishing: meta.date_of_publish || null,
      updatedDate: meta.updated_date || null,
      prices: {
        INR: { originalPrice: 0, discountedPrice: 0 },
        USD: { originalPrice: meta.USD || 0, discountedPrice: meta.USD || 0 },
        GBP: { originalPrice: 0, discountedPrice: 0 },
        CAD: { originalPrice: 0, discountedPrice: 0 },
        AED: { originalPrice: 0, discountedPrice: 0 }
      },
      curriculum: curriculumArray
    };
    
    courses.push(course);
  });
  
  return courses;
}

async function uploadCourse(course) {
  const curriculumArray = course.curriculum || [];
  const slug = course.courseSlug || generateSlug(course.courseName);
  
  // Calculate stats
  const totalUnits = curriculumArray.length;
  let totalChapters = 0;
  let totalLectures = 0;
  let totalDuration = 0;
  
  curriculumArray.forEach(unit => {
    const chapters = unit.chapters || [];
    totalChapters += chapters.length;
    chapters.forEach(chapter => {
      const lectures = chapter.lectures || [];
      totalLectures += lectures.length;
      lectures.forEach(lecture => {
        totalDuration += lecture.durationInSeconds || 0;
      });
    });
  });
  
  try {
    const courseRef = db.collection(COLLECTION_NAME).doc(slug);
    
    // 1. ROOT DOCUMENT
    const listingDoc = {
      slug: slug,
      courseId: course.courseId,
      courseName: course.courseName || '',
      courseAuthor: course.courseAuthor || '',
      thumbnailUrl: course.thumbnailUrl || '',
      tagLine: course.tagLine || '',
      complexityLevel: course.complexityLevel || 1,
      totalUnits: totalUnits,
      totalChapters: totalChapters,
      totalLectures: totalLectures,
      totalDuration: totalDuration,
      prices: course.prices,
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
    
    // 2. DETAILS SUBCOLLECTION
    const detailsDoc = {
      courseDescription: course.courseDescription || '',
      coursePurpose: course.coursePurpose || '',
      coursePrerequisite: course.coursePrerequisite || '',
      updatedDate: course.updatedDate || null
    };
    
    await courseRef.collection('details').doc('content').set(detailsDoc);
    
    // 3. CURRICULUM SUBCOLLECTION
    for (let i = 0; i < curriculumArray.length; i++) {
      const unit = curriculumArray[i];
      const unitKey = `unit_${i + 1}`;
      const chaptersArray = unit.chapters || [];
      
      // Build chapters map
      const chapters = {};
      chaptersArray.forEach((chapter, chapterIdx) => {
        const chapterKey = `chapter_${chapterIdx + 1}`;
        
        // Build lectures map
        const lectures = {};
        (chapter.lectures || []).forEach((lecture, lectureIdx) => {
          lectures[`lecture_${lectureIdx + 1}`] = {
            lectureId: lecture.lectureId,
            lectureName: lecture.lectureName || '',
            lectureType: lecture.lectureType || 'video',
            lectureOrder: lecture.lectureOrder || lectureIdx + 1,
            durationInSeconds: lecture.durationInSeconds || 0,
            videoUrl: lecture.videoUrl || null,
            textContent: lecture.textContent || null,
            quizQuestions: lecture.quizQuestions || null,
            exerciseQuestions: lecture.exerciseQuestions || null,
            assessmentQuestions: lecture.assessmentQuestions || null,
            attachments: lecture.attachments || []
          };
        });
        
        chapters[chapterKey] = {
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName || '',
          chapterOrder: chapter.chapterOrder || chapterIdx + 1,
          totalLectures: (chapter.lectures || []).length,
          lectures: lectures
        };
      });
      
      const unitDoc = {
        unitId: unit.unitId,
        unitName: unit.unitName || '',
        unitOrder: unit.unitOrder || i + 1,
        totalChapters: chaptersArray.length,
        chapters: chapters
      };
      
      await courseRef.collection('curriculum').doc(unitKey).set(unitDoc);
    }
    
    return { success: true, units: totalUnits, chapters: totalChapters, lectures: totalLectures };
    
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return { success: false, units: 0, chapters: 0, lectures: 0 };
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node upload_courses_from_excel.js <excel_file_path>');
    process.exit(1);
  }
  
  const excelPath = args[0];
  
  console.log('========================================');
  console.log('🚀 Courses Uploader (Excel → Firebase)');
  console.log('📁 Unit > Chapter > Lecture structure');
  console.log('========================================\n');
  
  console.log('📖 Reading Excel file...');
  const { metadata, curriculum } = parseExcel(excelPath);
  console.log(`   Found ${metadata.length} courses in Metadata`);
  console.log(`   Found ${curriculum.length} curriculum rows\n`);
  
  console.log('🔧 Building course objects...');
  const courses = buildCourses(metadata, curriculum);
  console.log(`   Built ${courses.length} courses\n`);
  
  const coursesToProcess = Math.min(courses.length, MAX_COURSES_TO_PROCESS);
  console.log(`📌 Processing ${coursesToProcess} courses...\n`);
  
  let successCount = 0;
  let failCount = 0;
  let totalLectures = 0;
  let totalChapters = 0;
  let totalUnits = 0;
  
  for (let i = 0; i < coursesToProcess; i++) {
    const course = courses[i];
    
    if (!course.courseName) {
      console.log(`⚠️  Skipping index ${i}: No course name`);
      continue;
    }
    
    console.log(`[${i + 1}/${coursesToProcess}] ${course.courseName.substring(0, 50)}...`);
    
    const result = await uploadCourse(course);
    
    if (result.success) {
      successCount++;
      totalUnits += result.units;
      totalChapters += result.chapters;
      totalLectures += result.lectures;
      console.log(`    ✅ ${result.units} units, ${result.chapters} chapters, ${result.lectures} lectures`);
    } else {
      failCount++;
    }
    
    if (i < coursesToProcess - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log('\n========================================');
  console.log('📊 UPLOAD SUMMARY');
  console.log('========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📚 Units: ${totalUnits} | 📖 Chapters: ${totalChapters} | 🎬 Lectures: ${totalLectures}`);
  console.log('========================================\n');
  
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});