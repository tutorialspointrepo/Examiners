// restore_anubhav.js
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

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function restoreAnubhav() {
  try {
    const uid = 'PIBYYQUAdGg6SKnqh2YBrCMthei2';

    // Step 1: Check Auth
    console.log('🔍 Checking if Auth user exists...');
    let authUser = null;
    try {
      authUser = await admin.auth().getUser(uid);
      console.log(`✅ Auth user exists — updating password...`);
      await admin.auth().updateUser(uid, { password: 'Jandob123$' });
      console.log('✅ Password updated.');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log('⚠️  Auth user deleted. Recreating...');
        authUser = await admin.auth().createUser({
          uid: uid,
          phoneNumber: '+917060663248',
          email: 'anubhav.maheshwari@tutorialspoint.com',
          emailVerified: true,
          password: 'Jandob123$',
          displayName: 'Anubhav Maheshwari'
        });
        console.log('✅ Auth user recreated.');
      } else {
        throw err;
      }
    }

    // Step 2: Restore Firestore doc
    console.log('\n🔧 Restoring Firestore document...');
    await db.collection('users').doc(uid).set({
      userId: uid,
      fullName: 'Anubhav Maheshwari',
      email: 'anubhav.maheshwari@tutorialspoint.com',
      phone: '+917060663248',
      phoneRaw: '7060663248',
      userType: 'system_admin',
      collegeId: 'TPX',
      board: 'TPX',
      status: 'active',
      permissions: {
        canEvaluate: true,
        canViewReports: true,
        canManageUsers: true,
        canManageColleges: true,
        canManageRooms: true,
        canManageClasses: true,
        canManageSubjects: true,
        canManageBoards: true,
        canManageExamTypes: true,
        canManageSystem: true,
        canAccessAllColleges: true,
        level: 'system'
      },
      restoredAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('✅ Done!\n');
    console.log('═══════════════════════════════════════');
    console.log('  RESTORED: Anubhav Maheshwari');
    console.log('═══════════════════════════════════════');
    console.log(`  UID:        ${uid}`);
    console.log(`  Email:      anubhav.maheshwari@tutorialspoint.com`);
    console.log(`  Phone:      +917060663248`);
    console.log(`  Password:   Jandob123$`);
    console.log(`  UserType:   system_admin`);
    console.log(`  CollegeId:  TPX`);
    console.log('═══════════════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

restoreAnubhav();
