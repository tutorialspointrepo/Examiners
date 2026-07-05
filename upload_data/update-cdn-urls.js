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

// Recursively replace old CDN in any value
function deepReplace(obj) {
  if (!obj) return { value: obj, count: 0 };

  if (typeof obj === 'string') {
    if (obj.includes(OLD_CDN)) {
      return { value: obj.replaceAll(OLD_CDN, NEW_CDN), count: 1 };
    }
    return { value: obj, count: 0 };
  }

  if (Array.isArray(obj)) {
    let totalCount = 0;
    const newArr = obj.map(item => {
      const { value, count } = deepReplace(item);
      totalCount += count;
      return value;
    });
    return { value: newArr, count: totalCount };
  }

  if (typeof obj === 'object') {
    let totalCount = 0;
    const newObj = {};
    for (const [key, val] of Object.entries(obj)) {
      const { value, count } = deepReplace(val);
      newObj[key] = value;
      totalCount += count;
    }
    return { value: newObj, count: totalCount };
  }

  return { value: obj, count: 0 };
}

async function updateCDNUrls() {
  console.log(`${DRY_RUN ? '🔍 DRY RUN — no changes will be made' : '🚀 LIVE RUN — updating Firebase'}`);
  console.log(`Replacing: ${OLD_CDN} → ${NEW_CDN}\n`);

  const coursesSnap = await db.collection('courses').get();
  console.log(`Found ${coursesSnap.size} courses\n`);

  let totalDocsUpdated = 0;
  let totalUrlsReplaced = 0;

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    const courseData = courseDoc.data();

    // 1. Check course top-level fields
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
      totalDocsUpdated++;
    }

    // 2. Process curriculum subcollection (chapters[].lectures[].videoUrl)
    const curriculumSnap = await db.collection('courses').doc(courseId).collection('curriculum').get();
    for (const unitDoc of curriculumSnap.docs) {
      const unitData = unitDoc.data();
      const chapters = unitData.chapters || [];

      const { value: updatedChapters, count: unitUrlCount } = deepReplace(chapters);

      if (unitUrlCount > 0) {
        if (!DRY_RUN) await unitDoc.ref.update({ chapters: updatedChapters });
        totalDocsUpdated++;
        totalUrlsReplaced += unitUrlCount;
        console.log(`  📦 ${courseId}/curriculum/${unitDoc.id}: ${unitUrlCount} URL(s) replaced`);
      }
    }

    // 3. Process lectures subcollection (attachments[] etc.)
    const lecturesSnap = await db.collection('courses').doc(courseId).collection('lectures').get();
    for (const lectureDoc of lecturesSnap.docs) {
      const lectureData = lectureDoc.data();
      const updates = {};
      let lectureUrlCount = 0;

      for (const [key, value] of Object.entries(lectureData)) {
        const { value: newValue, count } = deepReplace(value);
        if (count > 0) {
          updates[key] = newValue;
          lectureUrlCount += count;
        }
      }

      if (lectureUrlCount > 0) {
        if (!DRY_RUN) await lectureDoc.ref.update(updates);
        totalDocsUpdated++;
        totalUrlsReplaced += lectureUrlCount;
        console.log(`  📎 ${courseId}/lectures/${lectureDoc.id}: ${lectureUrlCount} URL(s) replaced`);
      }
    }

    // 4. Process details subcollection (if any URLs exist)
    const detailsSnap = await db.collection('courses').doc(courseId).collection('details').get();
    for (const detailDoc of detailsSnap.docs) {
      const detailData = detailDoc.data();
      const updates = {};
      let detailUrlCount = 0;

      for (const [key, value] of Object.entries(detailData)) {
        const { value: newValue, count } = deepReplace(value);
        if (count > 0) {
          updates[key] = newValue;
          detailUrlCount += count;
        }
      }

      if (detailUrlCount > 0) {
        if (!DRY_RUN) await detailDoc.ref.update(updates);
        totalDocsUpdated++;
        totalUrlsReplaced += detailUrlCount;
        console.log(`  📝 ${courseId}/details/${detailDoc.id}: ${detailUrlCount} URL(s) replaced`);
      }
    }
  }

  console.log(`\n✅ Done! ${totalDocsUpdated} document(s) updated, ${totalUrlsReplaced} URL(s) replaced`);
  if (DRY_RUN) console.log('⚠️  This was a dry run. Run without --dry-run to apply changes.');
}

updateCDNUrls().catch(console.error);
