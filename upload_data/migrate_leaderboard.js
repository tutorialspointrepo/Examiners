/**
 * migrate_leaderboard.js - Backfill leaderboardStats from existing examAttempts
 * 
 * Uses Firebase Admin SDK (service account) for full read/write access.
 * 
 * Setup:
 *   1. Download service account key from Firebase Console > Project Settings > Service Accounts
 *   2. Place the JSON file in same directory as this script
 *   3. Set the path below or use env variable: GOOGLE_APPLICATION_CREDENTIALS
 * 
 * Usage: node migrate_leaderboard.js [--dry-run] [--college=COLLEGE_ID]
 */

const admin = require('firebase-admin');

// ============================================
// CONFIG - Update service account path
// ============================================
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

// ============================================
// PARSE CLI ARGS
// ============================================
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const collegeArg = args.find(a => a.startsWith('--college='));
const collegeFilter = collegeArg ? collegeArg.split('=')[1] : null;

console.log('=== Leaderboard Migration Script ===');
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`College filter: ${collegeFilter || 'ALL colleges'}\n`);

// ============================================
// INITIALIZE FIREBASE ADMIN
// ============================================
try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized\n');
} catch (err) {
    console.error('❌ Failed to initialize Firebase Admin.');
    console.error('   Make sure serviceAccountKey.json exists in this directory.');
    console.error('   Download from: Firebase Console > Project Settings > Service Accounts > Generate New Private Key');
    console.error(`   Error: ${err.message}\n`);
    process.exit(1);
}

const db = admin.firestore();

// ============================================
// FETCH ALL SUBMITTED ATTEMPTS (paginated)
// ============================================
async function fetchAllSubmittedAttempts() {
    console.log('Fetching all submitted exam attempts...');

    const allAttempts = [];
    const pageSize = 1000;
    let lastDoc = null;
    let page = 0;

    while (true) {
        page++;
        let q = db.collection('examAttempts')
            .where('status', '==', 'submitted');

        if (collegeFilter) {
            q = q.where('collegeId', '==', collegeFilter);
        }

        q = q.orderBy('startTime', 'desc').limit(pageSize);

        if (lastDoc) {
            q = q.startAfter(lastDoc);
        }

        const snapshot = await q.get();
        if (snapshot.empty) break;

        snapshot.docs.forEach(doc => {
            const d = doc.data();
            allAttempts.push({
                studentId: d.studentId,
                studentName: d.studentName || '',
                rollNumber: d.rollNumber || '',
                collegeId: d.collegeId,
                class: d.class || '',
                board: d.board || '',
                academicYear: d.academicYear || '',
                subject: d.subject || '',
                obtainedMarks: d.obtainedMarks || 0,
                maximumScore: d.maximumScore || 0,
                submitTime: d.submitTime || null,
                startTime: d.startTime || null,
            });
        });

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        console.log(`  Page ${page}: ${snapshot.docs.length} attempts (total: ${allAttempts.length})`);

        if (snapshot.docs.length < pageSize) break;
    }

    console.log(`\n✅ Total attempts fetched: ${allAttempts.length}\n`);
    return allAttempts;
}

// ============================================
// AGGREGATE BY STUDENT
// ============================================
function aggregateStudents(attempts) {
    console.log('Aggregating student stats...');

    const studentMap = new Map();

    for (const attempt of attempts) {
        if (!attempt.studentId || !attempt.collegeId) continue;

        const key = `${attempt.collegeId}_${attempt.studentId}`;

        if (!studentMap.has(key)) {
            studentMap.set(key, {
                studentId: attempt.studentId,
                userName: attempt.studentName,
                rollNumber: attempt.rollNumber,
                collegeId: attempt.collegeId,
                class: attempt.class,
                board: attempt.board,
                academicYear: attempt.academicYear,
                totalExams: 0,
                totalMarks: 0,
                totalMaxMarks: 0,
                scores: [],
                lastExamDate: null,
                classStats: {},
                subjectStats: {},
            });
        }

        const student = studentMap.get(key);
        const obtained = attempt.obtainedMarks || 0;
        const max = attempt.maximumScore || 0;
        const pct = max > 0 ? (obtained / max) * 100 : 0;

        student.totalExams += 1;
        student.totalMarks += obtained;
        student.totalMaxMarks += max;
        student.scores.push(pct);

        const examDate = attempt.submitTime || attempt.startTime;
        if (examDate && (!student.lastExamDate || examDate.toMillis() > student.lastExamDate.toMillis())) {
            student.lastExamDate = examDate;
        }

        // Class stats
        const cls = attempt.class || 'unknown';
        if (!student.classStats[cls]) student.classStats[cls] = { totalMarks: 0, totalMaxMarks: 0, totalExams: 0 };
        student.classStats[cls].totalMarks += obtained;
        student.classStats[cls].totalMaxMarks += max;
        student.classStats[cls].totalExams += 1;

        // Subject stats
        const subj = attempt.subject || 'unknown';
        if (!student.subjectStats[subj]) student.subjectStats[subj] = { totalMarks: 0, totalMaxMarks: 0, totalExams: 0 };
        student.subjectStats[subj].totalMarks += obtained;
        student.subjectStats[subj].totalMaxMarks += max;
        student.subjectStats[subj].totalExams += 1;
    }

    console.log(`✅ Aggregated ${studentMap.size} unique students\n`);
    return studentMap;
}

// ============================================
// WRITE TO FIRESTORE (batched)
// ============================================
async function writeLeaderboardStats(studentMap) {
    const students = Array.from(studentMap.entries());
    console.log(`Writing ${students.length} leaderboard entries to Firestore...\n`);

    let written = 0;
    let failed = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (let i = 0; i < students.length; i++) {
        const [docId, student] = students[i];
        const avgPct = student.totalMaxMarks > 0 ? (student.totalMarks / student.totalMaxMarks) * 100 : 0;

        console.log(`  [${i + 1}/${students.length}] ${student.userName} (${student.rollNumber}) — ${student.totalExams} exams, ${avgPct.toFixed(1)}%`);

        if (dryRun) {
            written++;
            continue;
        }

        const ref = db.collection('leaderboardStats').doc(docId);
        batch.set(ref, {
            studentId: student.studentId,
            collegeId: student.collegeId,
            userName: student.userName,
            rollNumber: student.rollNumber,
            class: student.class,
            board: student.board,
            academicYear: student.academicYear,
            totalExams: student.totalExams,
            totalMarks: Math.round(student.totalMarks * 100) / 100,
            totalMaxMarks: Math.round(student.totalMaxMarks * 100) / 100,
            averagePercentage: Math.round(avgPct * 100) / 100,
            highestScore: student.scores.length > 0 ? Math.round(Math.max(...student.scores) * 100) / 100 : 0,
            lowestScore: student.scores.length > 0 ? Math.round(Math.min(...student.scores) * 100) / 100 : 0,
            lastExamDate: student.lastExamDate || null,
            classStats: student.classStats,
            subjectStats: student.subjectStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        batchCount++;
        written++;

        // Firestore batch limit is 500
        if (batchCount >= 400) {
            console.log(`    ... committing batch (${written} written so far) ...`);
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (!dryRun && batchCount > 0) {
        await batch.commit();
        console.log(`    ... final batch committed ...`);
    }

    return { written, failed };
}

// ============================================
// MAIN
// ============================================
async function main() {
    const startTime = Date.now();

    // Step 1: Fetch all submitted attempts
    const attempts = await fetchAllSubmittedAttempts();

    if (attempts.length === 0) {
        console.log('No submitted attempts found. Nothing to migrate.');
        return;
    }

    // Step 2: Aggregate by student
    const studentMap = aggregateStudents(attempts);

    // Step 3: Write to leaderboardStats
    const { written, failed } = await writeLeaderboardStats(studentMap);

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total attempts processed: ${attempts.length}`);
    console.log(`Unique students: ${studentMap.size}`);
    console.log(`Written: ${written} | Failed: ${failed}`);
    console.log(`Time: ${elapsed}s`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);

    if (dryRun) {
        console.log('\n⚠️  This was a dry run. Run without --dry-run to write to Firestore.');
    } else {
        console.log('\n✅ Migration complete! leaderboardStats collection is now populated.');
        console.log('   The updateLeaderboardStats trigger will keep it in sync going forward.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
