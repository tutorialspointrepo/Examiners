// check_students.js
// READ-ONLY: Check if students from Summer_PEP_Student_Data_.xlsx exist in Firestore
// Usage: node check_students.js
// Requires: npm install firebase-admin xlsx
// Place Summer_PEP_Student_Data_.xlsx in the same folder as this script.

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');

const serviceAccount = {
  "type": "service_account",
  "project_id": "examiners-app",
  "private_key_id": "26f015b6e61cd7277a758c12582e9a9d8af9bbc5",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDfA4gQKi6kZpZc\nQiIAP08vjiWZ5sdYvcXc5oohCK9PHR+C7Ca7Joiopw80dUgBvuzk7kwWDEWuhsSc\nAzwuuBsSOhZ2GND3JYNTlMlAGxh0N2qiaZuwsJxI0YE90J4CpD/Sa+IKQ6DM2zxF\ngVvEBNph3NxFtt5pzvxioMKfqgbpGsgcEnoRAcWy19PC6ahOq7DCwlwrxfLNOMJ5\nV81s2nWlcdDOQ1+0ktmznbBwAuEGmVvM4ER94K07GxvxjU58mmP7Bl6PQePcsFdO\na9YIBI2MPujgnvndvadViqbGy7W/bunow97oDPTZ5B6nO10lH5GikdMSKKU691Mk\n1cgqWCNfAgMBAAECggEADiqYMP4b1NCnLKZqhBQ4UG1i816Un+iOv9+/uzguOh+I\n+fmVmkKNl10JWyeA7kG+yQ6os/BpfQm7RfWEpmI9ZpA4M8K38cMm6rF+pvQNGkMY\nWaLx5/XIFEmFiY9W5sugp6xuk4DEsaob08/ldS7YTw797jgMqh7+YgJcs8AvTJ94\nvUQjo6Opn4RgGsXRHj6bE8KU6zIKEchj40jWoIb20BIHgYFXFFlZdMiFHy0o/q09\n02lHad2ZVZyeX4O7JhXK/QeCqAIAnJiJcREPooDnM/xzNBT6BudFMowLEXV8iaYh\nNTKP7wsjocTw77sf1ttPstrV3J6ZQrWCP5e8crwTyQKBgQD3mhrfxxsQKz1M5rkL\nJsM3wQdAoAdesBUApz7aBEF8n3/qHM9qXn5hvEQFSwqcBeCKm6Y64knLFflUZRE2\nZiwNLo/uKaGwiKET+j48oWqKJCobkvDd/Sp5SMurSQ0ZcDlGNid3C5umzTJqvO7s\nAcsPlbFRxQTr5km7MWO422gyOQKBgQDmk+4+dmCUu+vPChqLam8oaAlqs35WUMG9\nZ4d9cmHsoVfcWNeW5usFZp+Yq9Zl9t93I7WYvdX7A8rcJ2fcktpFvatUSOT1wAzE\nDcS13jvpbZxRDgPS0nPoqoW9Clu3foOFOs9tl01mU9Cuwb18/EFT2rovnE41uJnW\n3qPPP1+iVwKBgQDIuFzg2//Mc8EV/lQz/hBzuj+u3AwdbpEYHnyNMLYF2SdRGlnq\n2P+LK5vYzqSjJwCIXPW89oTr5bxh9iyl9N3xMbXsVEOHYLtz/oFFlXVQ11BrWgt5\naipsd97j1CySWq+Tg4MqtnZQGjis3syw9iMvVyKQLy92LRHIdplo2jT1wQKBgQDP\nO+mGrjJDu1pG7JfK8dASCt9bzRMhVNer+Z6muuUUHjavThIGCGj2o7ORLfA2GFnj\n5G5UZ1oojtIGaExKzJns0Hlp+VH/JarTkmRX6PMD64Xwu53oH0oZtRkaPHMOSmC+\nn4rKvo/MBkyqpGpAKSA104I/REZutgleOyATJqw3ZQKBgQDOFF6+dYmmuSnvfJnp\nIfqwAeIq65sq2A7PRMWCdaJDtE6H6V7VE3bhYUPY1ORGibChRNEsoJs6/x0yhyho\n0Tk5xeIEG9IqThQRZ5tTUamZcbphI5m5+Yx1eHfogeTz2aJQDZ9EH8As4/qigqxB\njHrv28vOU9rDU8d+azlzvEGoVQ==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@examiners-app.iam.gserviceaccount.com",
  "client_id": "111371224895314632304",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40examiners-app.iam.gserviceaccount.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const EXCEL_FILE = path.join(__dirname, 'Summer_PEP_Student_Data_.xlsx');

// Same normalization as BulkUploadUsers: 10-digit → +91XXXXXXXXXX
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
  return null; // invalid length
}

async function checkStudents() {
  try {
    // Read Excel
    const wb = XLSX.readFile(EXCEL_FILE);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`📄 Loaded ${rows.length} students from Excel (sheet: ${wb.SheetNames[0]})\n`);

    const found = [];
    const notFound = [];
    const invalid = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (header = row 1)
      const fullName = String(row.full_name || '').trim();
      const email = String(row.email || '').trim().toLowerCase();
      const roll = String(row.student_roll || '').trim();
      const normalizedPhone = normalizePhone(row.phone);

      if (!normalizedPhone) {
        invalid.push({ rowNum, fullName, reason: `Invalid phone: ${row.phone}` });
        console.log(`⚠️  Row ${rowNum}: ${fullName} — INVALID PHONE (${row.phone})`);
        continue;
      }

      // Check 1: by phone
      let matchDoc = null;
      let matchedBy = null;

      const phoneSnap = await db.collection('users')
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();

      if (!phoneSnap.empty) {
        matchDoc = phoneSnap.docs[0];
        matchedBy = 'phone';
      }

      // Check 2: by email (if not found by phone)
      if (!matchDoc && email) {
        const emailSnap = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();
        if (!emailSnap.empty) {
          matchDoc = emailSnap.docs[0];
          matchedBy = 'email';
        }
      }

      // Check 3: by roll number (if still not found)
      if (!matchDoc && roll) {
        const rollSnap = await db.collection('users')
          .where('studentRoll', '==', roll)
          .where('collegeId', '==', String(row.college_id || '').trim())
          .limit(1)
          .get();
        if (!rollSnap.empty) {
          matchDoc = rollSnap.docs[0];
          matchedBy = 'roll';
        }
      }

      if (matchDoc) {
        const d = matchDoc.data();
        found.push({
          rowNum, fullName, matchedBy,
          docId: matchDoc.id,
          dbName: d.fullName || '',
          dbPhone: d.phone || '',
          dbEmail: d.email || '',
          dbRoll: d.studentRoll || '',
          dbClass: d.studentClass || '',
          dbYear: d.academicYear || '',
          dbCollege: d.collegeId || ''
        });
        console.log(`✅ Row ${rowNum}: ${fullName} — FOUND (by ${matchedBy}) → uid: ${matchDoc.id} | class: ${d.studentClass || 'N/A'} | year: ${d.academicYear || 'N/A'}`);
      } else {
        notFound.push({ rowNum, fullName, phone: normalizedPhone, email, roll });
        console.log(`❌ Row ${rowNum}: ${fullName} — NOT FOUND`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`  Total in Excel:  ${rows.length}`);
    console.log(`  ✅ Found in DB:   ${found.length}`);
    console.log(`  ❌ Not found:     ${notFound.length}`);
    console.log(`  ⚠️  Invalid rows:  ${invalid.length}`);
    console.log('═══════════════════════════════════════');

    if (notFound.length > 0) {
      console.log('\n❌ NOT FOUND LIST:');
      notFound.forEach(s => console.log(`   Row ${s.rowNum}: ${s.fullName} | ${s.phone} | ${s.email} | roll: ${s.roll}`));
    }

    if (invalid.length > 0) {
      console.log('\n⚠️  INVALID ROWS:');
      invalid.forEach(s => console.log(`   Row ${s.rowNum}: ${s.fullName} — ${s.reason}`));
    }

    // Mismatch check: found by phone/email but different roll or class in DB
    const mismatches = found.filter(f => {
      const row = rows[f.rowNum - 2];
      return (f.dbRoll && f.dbRoll !== String(row.student_roll).trim()) ||
             (f.dbClass && f.dbClass !== String(row.student_class).trim());
    });
    if (mismatches.length > 0) {
      console.log('\n🔶 FOUND BUT DATA MISMATCH (Excel vs DB):');
      mismatches.forEach(f => {
        const row = rows[f.rowNum - 2];
        console.log(`   Row ${f.rowNum}: ${f.fullName}`);
        console.log(`      Excel → roll: ${row.student_roll}, class: ${row.student_class}`);
        console.log(`      DB    → roll: ${f.dbRoll}, class: ${f.dbClass}, year: ${f.dbYear}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStudents();
