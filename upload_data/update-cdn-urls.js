const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const OLD_CDN = 'https://cdn.tutorialspoint.com';
const NEW_CDN = 'https://cdn.examiners.app';

const DRY_RUN = process.argv.includes('--dry-run');

async function updateCDNUrls() {
  console.log(`${DRY_RUN ? '🔍 DRY RUN — no changes will be made' : '🚀 LIVE RUN — updating Firebase'}`);
  console.log(`Replacing: ${OLD_CDN} → ${NEW_CDN}\n`);

  const coursesSnap = await db.collection('courses').get();
  console.log(`Found ${coursesSnap.size} courses\n`);

  let totalUnitsUpdated = 0;
  let totalUrlsReplaced = 0;

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    const courseData = courseDoc.data();

    // Check top-level fields like thumbnailUrl
    let courseUpdates = {};
    let courseUrlCount = 0;
    for (const [key, value] of Object.entries(courseData)) {
      if (typeof value === 'string' && value.includes(OLD_CDN)) {
        courseUpdates[key] = value.replaceAll(OLD_CDN, NEW_CDN);
        courseUrlCount++;
      }
    }
    if (courseUrlCount > 0) {
      if (!DRY_RUN) await courseDoc.ref.update(courseUpdates);
      console.log(`  📄 ${courseId}: updated ${courseUrlCount} top-level field(s)`);
      totalUrlsReplaced += courseUrlCount;
    }

    // Process curriculum subcollection
    const curriculumSnap = await db.collection('courses').doc(courseId).collection('curriculum').get();

    for (const unitDoc of curriculumSnap.docs) {
      const unitData = unitDoc.data();
      const chapters = unitData.chapters || [];
      let unitModified = false;
      let unitUrlCount = 0;

      const updatedChapters = chapters.map(chapter => {
        const updatedLectures = (chapter.lectures || []).map(lecture => {
          const updated = { ...lecture };
          // Check all string fields in lecture (videoUrl, subtitleUrl, etc.)
          for (const [key, value] of Object.entries(updated)) {
            if (typeof value === 'string' && value.includes(OLD_CDN)) {
              updated[key] = value.replaceAll(OLD_CDN, NEW_CDN);
              unitModified = true;
              unitUrlCount++;
            }
          }
          return updated;
        });
        return { ...chapter, lectures: updatedLectures };
      });

      if (unitModified) {
        if (!DRY_RUN) {
          await unitDoc.ref.update({ chapters: updatedChapters });
        }
        totalUnitsUpdated++;
        totalUrlsReplaced += unitUrlCount;
        console.log(`  📦 ${courseId}/curriculum/${unitDoc.id}: ${unitUrlCount} URL(s) replaced`);
      }
    }
  }

  console.log(`\n✅ Done! ${totalUnitsUpdated} unit(s) updated, ${totalUrlsReplaced} URL(s) replaced`);
  if (DRY_RUN) console.log('⚠️  This was a dry run. Run without --dry-run to apply changes.');
}

updateCDNUrls().catch(console.error);
