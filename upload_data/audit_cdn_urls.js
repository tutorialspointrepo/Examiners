// audit_cdn_urls.js
// Scan ALL courses, subcollections, and nested fields for old CDN URLs
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const OLD_CDN = 'https://cdn.tutorialspoint.com';

// Recursively scan any value for old CDN URLs
function findOldUrls(obj, path = '') {
  const found = [];
  if (!obj) return found;

  if (typeof obj === 'string') {
    if (obj.includes(OLD_CDN)) {
      found.push({ path, value: obj.substring(0, 100) + '...' });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      found.push(...findOldUrls(item, `${path}[${i}]`));
    });
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      found.push(...findOldUrls(value, path ? `${path}.${key}` : key));
    }
  }
  return found;
}

async function audit() {
  console.log(`🔍 Scanning for: ${OLD_CDN}\n`);

  const coursesSnap = await db.collection('courses').get();
  console.log(`Found ${coursesSnap.size} courses\n`);

  let totalFound = 0;
  const subcollectionNames = new Set();

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    const courseData = courseDoc.data();

    // Check course top-level
    const topLevel = findOldUrls(courseData);
    if (topLevel.length > 0) {
      console.log(`📄 courses/${courseId} (top-level): ${topLevel.length} URL(s)`);
      topLevel.forEach(u => console.log(`   ${u.path}: ${u.value}`));
      totalFound += topLevel.length;
    }

    // List ALL subcollections for this course
    const subcollections = await courseDoc.ref.listCollections();
    for (const subColl of subcollections) {
      subcollectionNames.add(subColl.id);
      const subSnap = await subColl.get();

      for (const subDoc of subSnap.docs) {
        const subData = subDoc.data();
        const subUrls = findOldUrls(subData);
        if (subUrls.length > 0) {
          console.log(`📦 courses/${courseId}/${subColl.id}/${subDoc.id}: ${subUrls.length} URL(s)`);
          subUrls.forEach(u => console.log(`   ${u.path}: ${u.value}`));
          totalFound += subUrls.length;
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`  Total old CDN URLs found: ${totalFound}`);
  console.log(`  Subcollections scanned: ${[...subcollectionNames].join(', ')}`);
  console.log('═══════════════════════════════════════');
}

audit().catch(console.error);
