
/**
 * Fix Mojibake in Courses Collection
 * 
 * Fixes double-encoded UTF-8 smart quotes/dashes in all text fields:
 * - courses/{slug} → courseName, tagLine
 * - courses/{slug}/details/content → courseDescription, coursePurpose, coursePrerequisite
 * - courses/{slug}/curriculum/unit_N → chapters[].chapterName, chapters[].lectures[].lectureName
 * - courses/{slug}/lectures/{id} → textContent
 * 
 * Usage: node fix_mojibake_courses.js [--dry-run]
 */

const admin = require('firebase-admin');
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  projectId: 'examiners-app'
});

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

// Mojibake replacement map — built from actual hex in Firestore
// e2809a c384 c3b4 = ‚Äô = right single quote '
// e2809a c384 c3ac = ‚Äì = en dash –
// e2809a c384 c593 = ‚Äò = left single quote (if present)
// c385 e280a0 = Å† = bullet-like artifact
const MOJIBAKE_MAP = [
  [/\u201a\u00c4\u00f4/g, '\u2019'],   // ‚Äô → ' (right single quote)
  [/\u201a\u00c4\u00ec/g, '\u2013'],   // ‚Äì → – (en dash)
  [/\u201a\u00c4\u00f2/g, '\u2018'],   // ‚Äò → ' (left single quote)
  [/\u201a\u00c4\u00fa/g, '\u2014'],   // ‚Äú → — (em dash)
  [/\u201a\u00c4\u00f9/g, '\u201C'],   // ‚Äù → " (left double quote)
  [/\u201a\u00c4\u00ef/g, '\u201D'],   // ‚Äï → " (right double quote)
  [/\u201a\u00c4\u00b6/g, '\u2026'],   // ‚Ä¶ → … (ellipsis)
  [/\u00c5\u2020/g, '\u2022'],         // Å† → • (bullet)
  [/\u201a\u00c4\u00a2/g, '\u2022'],   // ‚Ä¢ → • (bullet variant)
];

function sanitize(text) {
  if (!text || typeof text !== 'string') return text;
  let fixed = text;
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    fixed = fixed.replace(pattern, replacement);
  }
  return fixed;
}

function hasChanges(original, fixed) {
  return original !== fixed;
}

async function main() {
  console.log('========================================');
  console.log(`🔧 Fix Mojibake in Courses ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
  console.log('========================================\n');

  const DEBUG = process.argv.includes('--debug');
  const coursesSnap = await db.collection('courses').get();
  console.log(`Found ${coursesSnap.size} courses\n`);

  // In debug mode, just dump first 5 courseNames raw to see what's there
  if (DEBUG) {
    console.log('=== DEBUG: Raw courseName bytes ===\n');
    let count = 0;
    for (const doc of coursesSnap.docs) {
      const name = doc.data().courseName || '';
      const hasNonAscii = /[^\x00-\x7F]/.test(name);
      if (hasNonAscii && count < 20) {
        const hexBytes = Buffer.from(name, 'utf8').toString('hex');
        console.log(`[${doc.id}] courseName: "${name}"`);
        console.log(`  hex: ${hexBytes}\n`);
        count++;
      }
    }
    if (count === 0) console.log('No non-ASCII courseNames found in root docs.\n');

    // Also check first curriculum doc
    console.log('=== DEBUG: Sample curriculum chapter/lecture names ===\n');
    let cCount = 0;
    for (const doc of coursesSnap.docs) {
      if (cCount >= 5) break;
      const currSnap = await doc.ref.collection('curriculum').limit(1).get();
      for (const unitDoc of currSnap.docs) {
        const chapters = unitDoc.data().chapters || [];
        for (const ch of chapters) {
          const hasNonAscii = /[^\x00-\x7F]/.test(ch.chapterName || '');
          if (hasNonAscii) {
            console.log(`[${doc.id}/${unitDoc.id}] chapterName: "${ch.chapterName}"`);
            cCount++;
          }
          for (const lec of (ch.lectures || [])) {
            const lecNonAscii = /[^\x00-\x7F]/.test(lec.lectureName || '');
            if (lecNonAscii) {
              console.log(`[${doc.id}/${unitDoc.id}] lectureName: "${lec.lectureName}"`);
              cCount++;
            }
          }
        }
      }
    }
    if (cCount === 0) console.log('No non-ASCII chapter/lecture names found.\n');

    console.log('=== DEBUG: Sample details fields ===\n');
    let dCount = 0;
    for (const doc of coursesSnap.docs) {
      if (dCount >= 3) break;
      const detDoc = await doc.ref.collection('details').doc('content').get();
      if (detDoc.exists) {
        const dd = detDoc.data();
        for (const f of ['courseDescription', 'coursePurpose', 'coursePrerequisite']) {
          if (dd[f] && /[^\x00-\x7F]/.test(dd[f])) {
            console.log(`[${doc.id}] details.${f}: "${(dd[f] || '').substring(0, 200)}"`);
            dCount++;
          }
        }
      }
    }
    if (dCount === 0) console.log('No non-ASCII details fields found.\n');

    process.exit(0);
  }

  let stats = { root: 0, details: 0, curriculum: 0, lectures: 0, skipped: 0 };

  for (const courseDoc of coursesSnap.docs) {
    const slug = courseDoc.id;
    const data = courseDoc.data();
    const label = `[${slug}]`;

    // --- 1. Root document: courseName, tagLine ---
    const rootUpdates = {};
    for (const field of ['courseName', 'tagLine']) {
      if (data[field]) {
        const fixed = sanitize(data[field]);
        if (hasChanges(data[field], fixed)) {
          rootUpdates[field] = fixed;
          console.log(`${label} root.${field}: "${data[field]}" → "${fixed}"`);
        }
      }
    }
    if (Object.keys(rootUpdates).length > 0) {
      if (!DRY_RUN) await courseDoc.ref.update(rootUpdates);
      stats.root++;
    }

    // --- 2. Details subcollection ---
    try {
      const detailsDoc = await courseDoc.ref.collection('details').doc('content').get();
      if (detailsDoc.exists) {
        const dData = detailsDoc.data();
        const detailUpdates = {};
        for (const field of ['courseDescription', 'coursePurpose', 'coursePrerequisite']) {
          if (dData[field]) {
            const fixed = sanitize(dData[field]);
            if (hasChanges(dData[field], fixed)) {
              detailUpdates[field] = fixed;
              console.log(`${label} details.${field}: changed`);
            }
          }
        }
        if (Object.keys(detailUpdates).length > 0) {
          if (!DRY_RUN) await detailsDoc.ref.update(detailUpdates);
          stats.details++;
        }
      }
    } catch (e) {
      // no details doc, skip
    }

    // --- 3. Curriculum subcollection: chapterName, lectureName ---
    try {
      const currSnap = await courseDoc.ref.collection('curriculum').get();
      for (const unitDoc of currSnap.docs) {
        const unitData = unitDoc.data();
        let unitChanged = false;
        const chapters = unitData.chapters || [];

        for (let ci = 0; ci < chapters.length; ci++) {
          const ch = chapters[ci];
          const fixedChName = sanitize(ch.chapterName);
          if (hasChanges(ch.chapterName, fixedChName)) {
            console.log(`${label} ${unitDoc.id}.chapters[${ci}].chapterName: "${ch.chapterName}" → "${fixedChName}"`);
            chapters[ci].chapterName = fixedChName;
            unitChanged = true;
          }

          const lectures = ch.lectures || [];
          for (let li = 0; li < lectures.length; li++) {
            const lec = lectures[li];
            const fixedLecName = sanitize(lec.lectureName);
            if (hasChanges(lec.lectureName, fixedLecName)) {
              console.log(`${label} ${unitDoc.id}.lecture[${li}].lectureName: "${lec.lectureName}" → "${fixedLecName}"`);
              lectures[li].lectureName = fixedLecName;
              unitChanged = true;
            }
          }
        }

        if (unitChanged) {
          if (!DRY_RUN) await unitDoc.ref.update({ chapters });
          stats.curriculum++;
        }
      }
    } catch (e) {
      // no curriculum, skip
    }

    // --- 4. Lectures subcollection: textContent ---
    try {
      const lecSnap = await courseDoc.ref.collection('lectures').get();
      for (const lecDoc of lecSnap.docs) {
        const lecData = lecDoc.data();
        if (lecData.textContent) {
          const fixed = sanitize(lecData.textContent);
          if (hasChanges(lecData.textContent, fixed)) {
            console.log(`${label} lectures/${lecDoc.id}.textContent: changed`);
            if (!DRY_RUN) await lecDoc.ref.update({ textContent: fixed });
            stats.lectures++;
          }
        }
      }
    } catch (e) {
      // no lectures, skip
    }
  }

  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`Root docs fixed:       ${stats.root}`);
  console.log(`Details docs fixed:    ${stats.details}`);
  console.log(`Curriculum docs fixed: ${stats.curriculum}`);
  console.log(`Lecture docs fixed:    ${stats.lectures}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (written to Firestore)'}`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
