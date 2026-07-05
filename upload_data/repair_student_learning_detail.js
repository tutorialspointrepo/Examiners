/**
 * Repair Script: Backfill studentLearningDetail for existing course_enrollments
 * 
 * For each active enrollment, ensures:
 * 1. studentLearningDetail doc exists for the user
 * 2. The course is added to the courses map
 * 3. totalCoursesEnrolled is correct
 * 
 * Usage: node repair_student_learning_detail.js [--dry-run]
 */

const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: 'examiners-app'
});

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');
const FieldValue = admin.firestore.FieldValue;

async function main() {
  console.log('========================================');
  console.log(`🔧 Repair studentLearningDetail ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
  console.log('========================================\n');

  // 1. Fetch all active course_enrollments
  const enrollSnap = await db.collection('course_enrollments')
    .where('status', '==', 'active')
    .get();

  console.log(`Found ${enrollSnap.size} active enrollments\n`);

  // Group enrollments by userId+collegeId
  const userEnrollments = {};
  for (const enrollDoc of enrollSnap.docs) {
    const data = enrollDoc.data();
    const key = `${data.userId}_${data.collegeId}`;
    if (!userEnrollments[key]) {
      userEnrollments[key] = { userId: data.userId, collegeId: data.collegeId, enrollments: [] };
    }
    userEnrollments[key].enrollments.push({
      enrollmentId: enrollDoc.id,
      courseId: data.courseId,
      enrolledAt: data.enrolledAt,
    });
  }

  console.log(`Found ${Object.keys(userEnrollments).length} unique user+college combos\n`);

  let created = 0, updated = 0, skipped = 0;

  for (const [docId, userData] of Object.entries(userEnrollments)) {
    const { userId, collegeId, enrollments } = userData;

    // Fetch user profile for name/email
    let userName = '';
    let userEmail = '';
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const uData = userDoc.data();
        userName = uData.fullName || uData.userName || '';
        userEmail = uData.email || '';
      }
    } catch (e) { /* skip */ }

    // Check if studentLearningDetail exists
    const detailRef = db.collection('studentLearningDetail').doc(docId);
    const detailSnap = await detailRef.get();
    const existingData = detailSnap.exists ? detailSnap.data() : null;
    const existingCourses = existingData?.courses || {};

    let coursesAdded = 0;

    for (const enrollment of enrollments) {
      // Resolve courseSlug from courseId
      // courseId could be numeric or slug - try to find the course
      let courseSlug = '';
      let courseName = '';
      let totalLectures = 0;

      // Try finding by slug first (courseId might be the slug)
      let courseDoc = await db.collection('courses').doc(String(enrollment.courseId)).get();
      if (courseDoc.exists) {
        courseSlug = courseDoc.id;
        const cData = courseDoc.data();
        courseName = cData.courseName || '';
        totalLectures = cData.totalLectures || 0;
      } else {
        // courseId is numeric - query by courseId field
        const courseQuery = await db.collection('courses')
          .where('courseId', '==', Number(enrollment.courseId))
          .limit(1)
          .get();
        if (!courseQuery.empty) {
          const cDoc = courseQuery.docs[0];
          courseSlug = cDoc.id;
          const cData = cDoc.data();
          courseName = cData.courseName || '';
          totalLectures = cData.totalLectures || 0;
        }
      }

      if (!courseSlug) {
        console.log(`  ⚠️ Could not find course for courseId=${enrollment.courseId}, skipping`);
        continue;
      }

      // Check if course already in learning detail
      if (existingCourses[courseSlug]) {
        skipped++;
        continue;
      }

      // Add course to map
      console.log(`  [${docId}] Adding course: ${courseSlug} (${courseName})`);
      if (!DRY_RUN) {
        if (!detailSnap.exists) {
          // Create the doc
          await detailRef.set({
            userId,
            collegeId,
            userName,
            userEmail,
            studentClass: '',
            userType: 'student',
            compositeScore: 0,
            totalCoursesEnrolled: 0,
            totalCoursesCompleted: 0,
            totalTimeSpent: 0,
            totalAssessmentsCompleted: 0,
            totalQuizzesCompleted: 0,
            totalLecturesCompleted: 0,
            totalQuizMarksObtained: 0,
            totalQuizMaxMarks: 0,
            totalExercisesCompleted: 0,
            totalExerciseMarksObtained: 0,
            totalExerciseMaxMarks: 0,
            courses: {},
            recentActivity: [],
            lastActiveAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          created++;
        }

        await detailRef.update({
          [`courses.${courseSlug}`]: {
            courseName,
            enrollmentId: enrollment.enrollmentId,
            totalLectures,
            percentage: 0,
            timeSpent: 0,
            lecturesCompleted: 0,
            lastLectureId: '',
            lastLectureTitle: '',
            lastChapterName: '',
            lastAccessedAt: FieldValue.serverTimestamp(),
            status: 'active',
          },
          totalCoursesEnrolled: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      coursesAdded++;
      updated++;
    }

    if (coursesAdded > 0) {
      console.log(`  ✅ [${docId}] ${userName || userId}: added ${coursesAdded} courses`);
    }
  }

  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`Docs created:    ${created}`);
  console.log(`Courses added:   ${updated}`);
  console.log(`Already present: ${skipped}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
