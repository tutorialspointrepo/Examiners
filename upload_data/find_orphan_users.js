
// delete_orphan_users.js
// Delete all users NOT connected to a valid college (LPU, MITAOE, TPX)
const admin = require('firebase-admin');

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

const VALID_COLLEGE_IDS = ['LPU', 'MITAOE', 'TPX'];

// Set to true to actually delete, false for dry run
const DRY_RUN = false;

async function deleteOrphanUsers() {
  try {
    console.log(`🔍 Mode: ${DRY_RUN ? '🟡 DRY RUN (no deletions)' : '🔴 LIVE DELETE'}`);
    console.log(`✅ Valid College IDs: ${VALID_COLLEGE_IDS.join(', ')}\n`);

    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Total users in DB: ${usersSnapshot.size}\n`);

    const orphanUsers = [];

    usersSnapshot.forEach(doc => {
      const user = doc.data();
      const collegeId = user.collegeId || '';

      if (!collegeId || !VALID_COLLEGE_IDS.includes(collegeId)) {
        orphanUsers.push({
          docId: doc.id,
          fullName: user.fullName || 'N/A',
          phone: user.phone || 'N/A',
          email: user.email || 'N/A',
          userType: user.userType || 'N/A',
          collegeId: collegeId || '(empty)',
          status: user.status || 'N/A'
        });
      }
    });

    if (orphanUsers.length === 0) {
      console.log('✅ No orphan users found. All users are connected to valid colleges.');
      process.exit(0);
    }

    // Show what will be deleted
    console.log(`⚠️  Found ${orphanUsers.length} orphan users to delete:\n`);
    console.table(orphanUsers);

    if (DRY_RUN) {
      console.log('\n🟡 DRY RUN — No users were deleted.');
      console.log('👉 To actually delete, set DRY_RUN = false in the script and run again.');
      process.exit(0);
    }

    // Actually delete
    console.log(`\n🔴 Deleting ${orphanUsers.length} orphan users from Firestore...\n`);

    let deleted = 0;
    let failed = 0;
    const authDeleteFailed = [];

    for (const user of orphanUsers) {
      try {
        // Delete Firestore document
        await db.collection('users').doc(user.docId).delete();
        
        // Also try to delete from Firebase Auth
        try {
          await admin.auth().deleteUser(user.docId);
        } catch (authErr) {
          // Auth user may not exist, that's OK
          if (authErr.code !== 'auth/user-not-found') {
            authDeleteFailed.push({ docId: user.docId, error: authErr.message });
          }
        }

        deleted++;
        console.log(`  ✅ Deleted: ${user.fullName} (${user.collegeId}) — ${user.docId}`);
      } catch (err) {
        failed++;
        console.log(`  ❌ Failed: ${user.fullName} — ${err.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('  DELETION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`  Total orphans found:    ${orphanUsers.length}`);
    console.log(`  Firestore deleted:      ${deleted}`);
    console.log(`  Failed:                 ${failed}`);
    if (authDeleteFailed.length > 0) {
      console.log(`  Auth delete warnings:   ${authDeleteFailed.length}`);
      authDeleteFailed.forEach(f => console.log(`    ⚠️  ${f.docId}: ${f.error}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteOrphanUsers();
