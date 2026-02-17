/**
 * Delete Failed LPU Users (28 users)
 * 
 * Deletes ONLY the users that failed during bulk upload from:
 *   - Firebase Authentication
 *   - Firestore 'users' collection
 * 
 * Usage:
 *   node delete_failed_lpu_users.js --dry-run     Preview (no deletions)
 *   node delete_failed_lpu_users.js --delete       Actually delete
 */

const admin = require('firebase-admin');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const USERS_COLLECTION = 'users';

// ==================== 28 FAILED USERS ====================
const FAILED_USERS = [
  { name: 'Ayush Gautam', email: 'ayush.gautam23@lpu.in' },
  { name: 'Amar Jeet Singh', email: 'amarjeetsingh23@lpu.in' },
  { name: 'Raj Aryan', email: 'raj.aryan23@lpu.in' },
  { name: 'Khushi Tripathi', email: 'khushi.tripathi23@lpu.in' },
  { name: 'Adarsh Kumar Singh', email: 'adarshkumar231@lpu.in' },
  { name: 'Pranaw Kumar', email: 'pranaw.kumar23@lpu.in' },
  { name: 'Maddisetti Bapu Charan Teja', email: 'bapucharanteja23@lpu.in' },
  { name: 'Prakhar Gupta', email: 'prakhar.12322277@lpu.in' },
  { name: 'Tejas', email: 'tejas.12323476@lpu.in' },
  { name: 'Piyush Sharma', email: 'Piyush.12409160@lpu.in' },
  { name: 'Paawan Sharma', email: 'paawan.sharma23@lpu.in' },
  { name: 'Vikash Kumar Singh', email: 'vikashkumar23@lpu.in' },
  { name: 'Yadu Vamsi Meegada', email: 'yaduvamsi23@lpu.in' },
  { name: 'Tanay Mishra', email: 'tanay.mishra23@lpu.in' },
  { name: 'Inam Khan', email: 'inam.khan23@lpu.in' },
  { name: 'Dinesh', email: 'dinesh.231@lpu.in' },
  { name: 'Abhishek Rangi', email: 'abhishek.rangi23@lpu.in' },
  { name: 'Vivek Raj', email: 'vivek.raj23@lpu.in' },
  { name: 'Priya Kumari', email: 'priya.kumari233@lpu.in' },
  { name: 'Nageshwar Tiwari', email: 'nageshwar.tiwari23@lpu.in' },
  { name: 'Srishti Malhotra', email: 'srishti.malhotra23@lpu.in' },
  { name: 'Kunal Rathour', email: 'kunal.rathour23@lpu.in' },
  { name: 'Vivek Kumar', email: 'vivek.kumar236@lpu.in' },
  { name: 'Ayush kumar', email: 'ayush.kumar236@lpu.in' },
  { name: 'Aryan Sinha', email: 'aryan.sinha23@lpu.in' },
  { name: 'Anuradha Jha', email: 'anuradha.jha23@lpu.in' },
  { name: 'Pankaj Singh Bisht', email: 'pankajsingh23@lpu.in' },
  { name: 'Mushkan Kumari', email: 'mushkan.kumari23@lpu.in' },
];

// ==================== INITIALIZE FIREBASE ====================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();
const auth = admin.auth();

// ==================== DELETE FUNCTIONS ====================
async function deleteFromAuth(email) {
  try {
    const userRecord = await auth.getUserByEmail(email);
    await auth.deleteUser(userRecord.uid);
    return { success: true, uid: userRecord.uid };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return { success: false, reason: 'not in Auth' };
    }
    return { success: false, reason: error.message };
  }
}

async function deleteFromFirestore(email) {
  try {
    // Try both original case and lowercase
    const queries = [
      db.collection(USERS_COLLECTION).where('email', '==', email).get(),
      db.collection(USERS_COLLECTION).where('email', '==', email.toLowerCase()).get(),
    ];
    const [snap1, snap2] = await Promise.all(queries);
    
    const allDocs = new Map();
    snap1.docs.forEach(d => allDocs.set(d.id, d));
    snap2.docs.forEach(d => allDocs.set(d.id, d));

    if (allDocs.size === 0) {
      return { success: false, reason: 'not in Firestore', count: 0 };
    }

    const batch = db.batch();
    allDocs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return { success: true, count: allDocs.size, docIds: [...allDocs.keys()] };
  } catch (error) {
    return { success: false, reason: error.message, count: 0 };
  }
}

// ==================== DRY RUN ====================
async function dryRun() {
  console.log(`\n🔍 DRY RUN - Checking ${FAILED_USERS.length} failed users\n`);
  let authFound = 0, fsFound = 0;

  for (let i = 0; i < FAILED_USERS.length; i++) {
    const { name, email } = FAILED_USERS[i];
    let authStatus = '⚪', fsStatus = '⚪';

    try {
      const rec = await auth.getUserByEmail(email);
      authStatus = `✅ uid:${rec.uid}`;
      authFound++;
    } catch (e) {
      authStatus = '⚪ not found';
    }

    const snap = await db.collection(USERS_COLLECTION).where('email', '==', email).get();
    const snap2 = await db.collection(USERS_COLLECTION).where('email', '==', email.toLowerCase()).get();
    const fsCount = new Set([...snap.docs.map(d => d.id), ...snap2.docs.map(d => d.id)]).size;
    if (fsCount > 0) {
      fsStatus = `✅ ${fsCount} doc(s)`;
      fsFound++;
    } else {
      fsStatus = '⚪ not found';
    }

    console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(30)} Auth: ${authStatus.padEnd(35)} Firestore: ${fsStatus}`);
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  Auth found:      ${authFound}/${FAILED_USERS.length}`);
  console.log(`  Firestore found: ${fsFound}/${FAILED_USERS.length}`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`\n⚠️  To delete, run: node delete_failed_lpu_users.js --delete\n`);
}

// ==================== DELETE ====================
async function deleteAll() {
  console.log(`\n🗑️  Deleting ${FAILED_USERS.length} failed users...\n`);
  console.log(`  ⚠️  Starting in 5 seconds... (Ctrl+C to cancel)`);
  await new Promise(r => setTimeout(r, 5000));

  let authDel = 0, authSkip = 0, authFail = 0;
  let fsDel = 0, fsSkip = 0, fsFail = 0;

  for (let i = 0; i < FAILED_USERS.length; i++) {
    const { name, email } = FAILED_USERS[i];
    console.log(`\n  [${i + 1}/${FAILED_USERS.length}] ${name} (${email})`);

    // Auth
    const authRes = await deleteFromAuth(email);
    if (authRes.success) {
      console.log(`    ✅ Auth deleted (uid: ${authRes.uid})`);
      authDel++;
    } else if (authRes.reason === 'not in Auth') {
      console.log(`    ⚪ Auth: not found`);
      authSkip++;
    } else {
      console.log(`    ❌ Auth error: ${authRes.reason}`);
      authFail++;
    }

    // Firestore
    const fsRes = await deleteFromFirestore(email);
    if (fsRes.success) {
      console.log(`    ✅ Firestore deleted (${fsRes.count} doc(s): ${fsRes.docIds.join(', ')})`);
      fsDel++;
    } else if (fsRes.reason.includes('not in')) {
      console.log(`    ⚪ Firestore: not found`);
      fsSkip++;
    } else {
      console.log(`    ❌ Firestore error: ${fsRes.reason}`);
      fsFail++;
    }
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`📋 RESULTS`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  Auth:      ✅ ${authDel} deleted | ⚪ ${authSkip} skipped | ❌ ${authFail} failed`);
  console.log(`  Firestore: ✅ ${fsDel} deleted | ⚪ ${fsSkip} skipped | ❌ ${fsFail} failed`);
  console.log(`${'═'.repeat(55)}\n`);
}

// ==================== MAIN ====================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--dry-run')) {
    await dryRun();
  } else if (args.includes('--delete')) {
    await deleteAll();
  } else {
    console.log('Usage:');
    console.log('  node delete_failed_lpu_users.js --dry-run     Preview');
    console.log('  node delete_failed_lpu_users.js --delete       Delete');
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
