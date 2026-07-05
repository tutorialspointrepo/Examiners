/**
 * Courses Uploader V3 - With section_order & sequence_number support
 * 
 * Changes from V2:
 * - Uses section_order from Excel for chapter ordering (instead of insertion order)
 * - Uses sequence_number from Excel for lecture ordering (instead of insertion order)
 * - Stores preview flag from Excel
 * 
 * Structure:
 * courses/{slug}                      ← Listing fields
 *   └── details/content               ← Description fields
 *   └── curriculum/unit_N             ← Unit with chapters + lecture summaries (includes videoUrl)
 *   └── lectures/{lectureId}          ← Heavy data only (quiz, exercises, text, attachments)
 * 
 * Usage: node upload_courses_from_excel_v3.js <excel_file_path>
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
      const sectionOrder = Number(row.section_order) || 1;
      const sequenceNumber = Number(row.sequence_number) || 1;
      
      // Initialize unit if not exists
      if (!unitsMap[unitNumber]) {
        unitsMap[unitNumber] = {
          unitId: `${courseId}_unit_${unitNumber}`,
          unitName: `Unit ${unitNumber}`,
          unitOrder: unitNumber,
          chaptersMap: {}
        };
      }
      
      // Use section_order as chapter key to handle ordering properly
      const chapterKey = `${sectionOrder}_${chapterName}`;
      
      // Initialize chapter if not exists
      if (!unitsMap[unitNumber].chaptersMap[chapterKey]) {
        unitsMap[unitNumber].chaptersMap[chapterKey] = {
          chapterId: `${courseId}_unit_${unitNumber}_ch_${sectionOrder}`,
          chapterName: chapterName,
          chapterOrder: sectionOrder,  // ✅ Use section_order from Excel
          lectures: []
        };
      }
      
      // Add lecture with sequence_number
      const lecture = {
        lectureId: row.lecture_id,
        lectureName: row.lecture_name || '',
        lectureType: row.type || 'video',
        lectureOrder: sequenceNumber,  // ✅ Use sequence_number from Excel
        durationInSeconds: row.duration_in_seconds || 0,
        videoUrl: row.video_url || null,
        preview: row.preview === 1 || row.preview === true || row.preview === 'TRUE',
        textContent: row.lecture_description || null,
        quizQuestions: row.quiz_questions || null,
        exerciseQuestions: row.exercises || null,
        assessmentQuestions: row.assessments || null,
        attachments: row.attachments ? [row.attachments] : []
      };
      
      unitsMap[unitNumber].chaptersMap[chapterKey].lectures.push(lecture);
    });
    
    // Convert maps to arrays — sort by section_order and sequence_number
    const curriculumArray = Object.keys(unitsMap)
      .sort((a, b) => Number(a) - Number(b))
      .map((unitNum, idx) => {
        const unit = unitsMap[unitNum];
        const chapters = Object.values(unit.chaptersMap)
          .sort((a, b) => a.chapterOrder - b.chapterOrder);
        
        // Sort lectures within each chapter by sequence_number
        chapters.forEach(chapter => {
          chapter.lectures.sort((a, b) => a.lectureOrder - b.lectureOrder);
        });
        
        return {
          unitId: unit.unitId,
          unitName: `Unit ${idx + 1}`,
          unitOrder: idx + 1,
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
  let totalExercises = 0;
  let totalQuizzes = 0;
  
  curriculumArray.forEach(unit => {
    const chapters = unit.chapters || [];
    totalChapters += chapters.length;
    chapters.forEach(chapter => {
      const lectures = chapter.lectures || [];
      totalLectures += lectures.length;
      lectures.forEach(lecture => {
        totalDuration += lecture.durationInSeconds || 0;
        
        // Count exercises and quizzes by lecture type
        const lectureType = (lecture.lectureType || '').toLowerCase();
        if (lectureType === 'exercise') {
          totalExercises++;
        } else if (lectureType === 'quiz' || lectureType === 'mcq') {
          totalQuizzes++;
        }
      });
    });
  });
  
  try {
    const courseRef = db.collection(COLLECTION_NAME).doc(slug);
    
    // 1. ROOT DOCUMENT - Listing info
    const listingDoc = {
      slug: slug,
      courseId: Number(course.courseId),
      courseName: course.courseName || '',
      courseAuthor: course.courseAuthor || '',
      thumbnailUrl: course.thumbnailUrl || '',
      tagLine: course.tagLine || '',
      complexityLevel: Number(course.complexityLevel) || 1,
      totalUnits: totalUnits,
      totalChapters: totalChapters,
      totalLectures: totalLectures,
      totalDuration: totalDuration,
      totalExercises: totalExercises,
      totalQuizzes: totalQuizzes,
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
    
    // 2. DETAILS SUBCOLLECTION - Description, prerequisites
    const detailsDoc = {
      courseDescription: course.courseDescription || '',
      coursePurpose: course.coursePurpose || '',
      coursePrerequisite: course.coursePrerequisite || '',
      updatedDate: course.updatedDate || null
    };
    
    await courseRef.collection('details').doc('content').set(detailsDoc);
    
    // 3. CURRICULUM SUBCOLLECTION - Units with lecture summaries (light)
    for (let i = 0; i < curriculumArray.length; i++) {
      const unit = curriculumArray[i];
      const unitKey = `unit_${i + 1}`;
      const chaptersArray = unit.chapters || [];
      
      // Build chapters with lecture SUMMARIES only (includes videoUrl)
      const chapters = chaptersArray.map((chapter, chapterIdx) => {
        const lectures = (chapter.lectures || []).map((lecture, lectureIdx) => ({
          lectureId: Number(lecture.lectureId),
          lectureName: lecture.lectureName || '',
          lectureType: lecture.lectureType || 'video',
          lectureOrder: Number(lecture.lectureOrder) || lectureIdx + 1,
          durationInSeconds: Number(lecture.durationInSeconds) || 0,
          videoUrl: lecture.videoUrl || null,
          preview: lecture.preview || false
        }));
        
        return {
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName || '',
          chapterOrder: Number(chapter.chapterOrder) || chapterIdx + 1,
          totalLectures: lectures.length,
          lectures: lectures
        };
      });
      
      const unitDoc = {
        unitId: unit.unitId,
        unitName: unit.unitName || '',
        unitOrder: Number(unit.unitOrder) || i + 1,
        totalChapters: chaptersArray.length,
        chapters: chapters
      };
      
      await courseRef.collection('curriculum').doc(unitKey).set(unitDoc);
    }
    
    // 4. LECTURES SUBCOLLECTION - Heavy data only
    for (const unit of curriculumArray) {
      for (const chapter of unit.chapters || []) {
        for (const lecture of chapter.lectures || []) {
          const numericLectureId = Number(lecture.lectureId);
          
          const lectureDoc = {
            lectureId: numericLectureId,
            chapterId: chapter.chapterId,
            unitId: unit.unitId,
            quizQuestions: lecture.quizQuestions || null,
            exerciseQuestions: lecture.exerciseQuestions || null,
            assessmentQuestions: lecture.assessmentQuestions || null,
            textContent: lecture.textContent || null,
            attachments: lecture.attachments || []
          };
          
          await courseRef.collection('lectures').doc(String(numericLectureId)).set(lectureDoc);
        }
      }
    }
    
    return { 
      success: true, 
      units: totalUnits, 
      chapters: totalChapters, 
      lectures: totalLectures
    };
    
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return { success: false, units: 0, chapters: 0, lectures: 0 };
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node upload_courses_from_excel_v3.js <excel_file_path>');
    process.exit(1);
  }
  
  const excelPath = args[0];
  
  console.log('========================================');
  console.log('🚀 Courses Uploader V3 (section_order + sequence_number)');
  console.log('========================================');
  console.log('📁 Structure:');
  console.log('   courses/{slug}              ← Listing');
  console.log('   └── details/content         ← Description');
  console.log('   └── curriculum/unit_N       ← Light (lecture list + videoUrl)');
  console.log('   └── lectures/{lectureId}    ← Heavy (quiz, exercises, text)');
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
  console.log(`📚 Units: ${totalUnits}`);
  console.log(`📖 Chapters: ${totalChapters}`);
  console.log(`🎬 Lectures: ${totalLectures}`);
  console.log('========================================\n');
  
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
