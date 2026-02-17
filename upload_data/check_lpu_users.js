/**
 * Check LPU Users - Find who's missing
 * 
 * Reads the Excel file, checks each email against Firebase Auth + Firestore,
 * and lists users that are NOT yet fully created.
 * 
 * Usage:
 *   node check_lpu_users.js
 */

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');

// ==================== CONFIGURATION ====================
const FIREBASE_SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'examiners-app';
const EXCEL_FILE = path.join(__dirname, 'LPU_winter_batch_Data.xlsx');
const USERS_COLLECTION = 'users';

// ==================== INITIALIZE FIREBASE ====================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
    projectId: FIREBASE_PROJECT_ID
  });
}
const db = admin.firestore();
const auth = admin.auth();

// ==================== MAIN ====================
async function main() {
  // Read Excel
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`📊 Total users in Excel: ${rows.length}\n`);

  const results = {
    fullyCreated: [],     // Both Auth + Firestore
    authOnly: [],         // Auth exists, no Firestore doc
    firestoreOnly: [],    // Firestore doc exists, no Auth
    missing: [],          // Neither Auth nor Firestore
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = (row.email || row.Email || '').toString().trim().toLowerCase();
    const name = row.full_name || '';
    
    if (!email) continue;
    process.stdout.write(`\r  Checking ${i + 1}/${rows.length}...`);

    let inAuth = false, inFirestore = false;

    // Check Auth
    try {
      await auth.getUserByEmail(email);
      inAuth = true;
    } catch (e) {}

    // Check Firestore
    const snap = await db.collection(USERS_COLLECTION).where('email', '==', email).get();
    if (snap.empty) {
      // Try original case too
      const origEmail = (row.email || row.Email || '').toString().trim();
      if (origEmail !== email) {
        const snap2 = await db.collection(USERS_COLLECTION).where('email', '==', origEmail).get();
        if (!snap2.empty) inFirestore = true;
      }
    } else {
      inFirestore = true;
    }

    const entry = { name, email, studentClass: row.student_class || '' };

    if (inAuth && inFirestore) results.fullyCreated.push(entry);
    else if (inAuth && !inFirestore) results.authOnly.push(entry);
    else if (!inAuth && inFirestore) results.firestoreOnly.push(entry);
    else results.missing.push(entry);
  }

  // Print Results
  console.log(`\n\n${'═'.repeat(65)}`);
  console.log(`📋 RESULTS`);
  console.log(`${'═'.repeat(65)}`);
  console.log(`  ✅ Fully created (Auth + Firestore): ${results.fullyCreated.length}`);
  console.log(`  ⚠️  Auth only (no Firestore doc):     ${results.authOnly.length}`);
  console.log(`  ⚠️  Firestore only (no Auth):         ${results.firestoreOnly.length}`);
  console.log(`  ❌ Missing (not created at all):      ${results.missing.length}`);
  console.log(`${'═'.repeat(65)}`);

  if (results.authOnly.length > 0) {
    console.log(`\n⚠️  AUTH ONLY (need Firestore doc or delete & re-upload):`);
    results.authOnly.forEach((u, i) => {
      console.log(`  ${String(i + 1).padStart(3)}. ${u.name.padEnd(32)} ${u.email.padEnd(35)} ${u.studentClass}`);
    });
  }

  if (results.firestoreOnly.length > 0) {
    console.log(`\n⚠️  FIRESTORE ONLY (need Auth or delete & re-upload):`);
    results.firestoreOnly.forEach((u, i) => {
      console.log(`  ${String(i + 1).padStart(3)}. ${u.name.padEnd(32)} ${u.email.padEnd(35)} ${u.studentClass}`);
    });
  }

  if (results.missing.length > 0) {
    console.log(`\n❌ MISSING (need to be uploaded):`);
    results.missing.forEach((u, i) => {
      console.log(`  ${String(i + 1).padStart(3)}. ${u.name.padEnd(32)} ${u.email.padEnd(35)} ${u.studentClass}`);
    });
  }

  if (results.authOnly.length === 0 && results.firestoreOnly.length === 0 && results.missing.length === 0) {
    console.log(`\n🎉 All ${results.fullyCreated.length} users are fully created!`);
  }

  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
