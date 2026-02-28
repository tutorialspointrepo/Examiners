/**
 * fix_missing_attendance.js - Backfill missing Attendance records
 * 
 * Finds students who have examAttempts but NO Attendance record,
 * and creates attendance records for them.
 *
 * Prerequisites:
 *   npm install firebase-admin
 *   Place serviceAccountKey.json in same directory
 *
 * Usage:
 *   node fix_missing_attendance.js --examId=EXAM_ID              (fix one exam)
 *   node fix_missing_attendance.js --examId=EXAM_ID --dry-run    (preview only)
 *   node fix_missing_attendance.js --all --dry-run               (scan all exams)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ============================================
// INIT FIREBASE ADMIN
// ============================================
const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('❌ serviceAccountKey.json not found in the same directory as this script.');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================
// PARSE CLI ARGS
// ============================================
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allExams = args.includes('--all');
const examIdArg = args.find(a => a.startsWith('--examId='));
const examId = examIdArg ? examIdArg.split('=')[1] : null;

if (!examId && !allExams) {
  console.error('❌ --examId=EXAM_ID or --all is required');
  process.exit(1);
}

console.log('=== Fix Missing Attendance Records ===');
console.log(`Exam ID:  ${examId || 'ALL'}`);
console.log(`Mode:     ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

// ============================================
// FIX ONE EXAM
// ============================================
async function fixExam(examId) {
  // 1. Get exam metadata
  const examDoc = await db.collection('exams').doc(examId).get();
  if (!examDoc.exists) {
    console.log(`  ⚠️ Exam ${examId} not found, skipping`);
    return { fixed: 0, alreadyOk: 0 };
  }
  const exam = examDoc.data();
  console.log(`\n📋 Exam: ${exam.title || examId}`);
  console.log(`   College: ${exam.collegeId}`);

  // 2. Get all attempts for this exam
  const attemptsSnap = await db.collection('examAttempts')
    .where('examId', '==', examId)
    .get();

  if (attemptsSnap.empty) {
    console.log(`   No attempts found`);
    return { fixed: 0, alreadyOk: 0 };
  }

  // Dedupe by studentId (keep latest)
  const attemptsMap = new Map();
  attemptsSnap.docs.forEach(d => {
    const attempt = { ...d.data(), attemptId: d.id };
    const sid = attempt.studentId;
    const existing = attemptsMap.get(sid);
    if (!existing) {
      attemptsMap.set(sid, attempt);
    } else {
      const existingStart = existing.startTime?.toDate ? existing.startTime.toDate() : new Date(0);
      const currentStart = attempt.startTime?.toDate ? attempt.startTime.toDate() : new Date(0);
      if (currentStart > existingStart) {
        attemptsMap.set(sid, attempt);
      }
    }
  });

  console.log(`   Attempts: ${attemptsSnap.size} docs, ${attemptsMap.size} unique students`);

  // 3. Get existing attendance for this exam
  const attendanceSnap = await db.collection('Attendance')
    .where('examId', '==', examId)
    .get();

  const existingAttendanceIds = new Set();
  attendanceSnap.docs.forEach(d => {
    const rec = d.data();
    existingAttendanceIds.add(rec.studentId || rec.userId);
  });

  console.log(`   Existing attendance: ${attendanceSnap.size} records`);

  // 4. Find missing
  let fixed = 0;
  let alreadyOk = 0;

  for (const [studentId, attempt] of attemptsMap) {
    if (existingAttendanceIds.has(studentId)) {
      alreadyOk++;
      continue;
    }

    // Get student details
    const userDoc = await db.collection('users').doc(studentId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const attendanceId = `${examId}_${studentId}`;
    const startTime = attempt.startTime?.toDate ? attempt.startTime.toDate() : new Date();

    console.log(`   ➕ Missing: ${userData?.fullName || studentId} (${userData?.studentRoll || 'N/A'})`);

    if (!dryRun) {
      const attendanceData = {
        id: attendanceId,
        examId: examId,
        studentId: studentId,
        userId: studentId,
        studentName: userData?.fullName || attempt.studentName || 'Unknown',
        studentRollNumber: userData?.studentRoll || attempt.rollNumber || 'N/A',
        examinerId: studentId,
        examinerName: userData?.fullName || attempt.studentName || 'Unknown',
        examinerRole: 'Student',
        status: 'present',
        markedAt: startTime,
        updatedAt: startTime,
        collegeId: exam.collegeId || ''
      };

      await db.collection('Attendance').doc(attendanceId).set(attendanceData);
      console.log(`   ✅ Created attendance: ${attendanceId}`);
    }

    fixed++;
  }

  return { fixed, alreadyOk };
}

// ============================================
// MAIN
// ============================================
async function main() {
  let totalFixed = 0;
  let totalOk = 0;

  if (allExams) {
    // Find all exams that have attempts
    console.log('📥 Finding exams with attempts...');
    const attemptsSnap = await db.collection('examAttempts')
      .select('examId')
      .get();

    const examIds = new Set();
    attemptsSnap.docs.forEach(d => examIds.add(d.data().examId));
    console.log(`Found ${examIds.size} exams with attempts\n`);

    let i = 0;
    for (const eid of examIds) {
      i++;
      console.log(`[${i}/${examIds.size}] Processing ${eid}...`);
      const result = await fixExam(eid);
      totalFixed += result.fixed;
      totalOk += result.alreadyOk;
    }
  } else {
    const result = await fixExam(examId);
    totalFixed += result.fixed;
    totalOk += result.alreadyOk;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Already OK:  ${totalOk}`);
  console.log(`Fixed:       ${totalFixed}`);
  console.log(`Mode:        ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
