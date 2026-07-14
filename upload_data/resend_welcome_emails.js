// resend_welcome_emails.js
// Reads an Excel file of users, RESETS each user's password to a fixed value
// (FORCE_PASSWORD) via Firebase Auth, then sends the EXAMINERS welcome email
// showing that same password.
//
// SETUP:
//   npm install firebase-admin nodemailer xlsx
//   Put your service account JSON next to this file as: serviceAccountKey.json
//   (same key you used in restore_user.js — project examiners-app)
//
// RUN:
//   node resend_welcome_emails.js <path-to-excel.xlsx> [emailColumnName]
//   e.g.  node resend_welcome_emails.js users.xlsx
//         node resend_welcome_emails.js users.xlsx email
//
// SAFETY:
//   - DRY_RUN = true  -> only PRINT who would be processed. No reset, no email.
//   - TEST_TO set     -> PREVIEW only: sends the email to your inbox and does
//                        NOT change any real user's password.
//   - Real password reset happens ONLY when DRY_RUN=false AND TEST_TO='' .

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const path = require('path');

// ============================================================
// CONFIG  (values verified from index.ts — not guessed)
// ============================================================
const DRY_RUN = false; // true = don't send, just list

// TEST: set this to YOUR email to PREVIEW to your inbox first.
// In preview mode NO real password is changed. Leave '' for the real run
// (which resets each user's password AND emails the actual recipient).
const TEST_TO = ''; //'mohtashim@tutorialspoint.com';

// The single password that will be set for EVERY user in the Excel.
const FORCE_PASSWORD = 'LPU123456';

const USERS_COLLECTION            = 'users';
const COLLEGES_COLLECTION         = 'colleges';
const EMAIL_CREDENTIALS_PATH      = 'settings/email_credentials';

// NOTE: SMTP is Resend — the "from" domain must be VERIFIED in Resend.
// email.tutorialspoint.com is verified; plain tutorialspoint.com is NOT.
const NOREPLY_EMAIL = process.env.NOREPLY_EMAIL || 'noreply@email.tutorialspoint.com';
const LOGIN_URL     = process.env.LOGIN_URL     || 'https://www.examiners.app/login';
const SEND_DELAY_MS = 400; // small gap between sends to be nice to SMTP

// ============================================================
// INIT FIREBASE ADMIN
// ============================================================
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ============================================================
// WELCOME EMAIL HTML  (verbatim port of generateWelcomeEmailHTML in index.ts)
// ============================================================
function generateWelcomeEmailHTML(data) {
  const { name, email, password, userType, collegeName, loginUrl } = data;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .email-container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .logo-container { margin: 0 auto 20px; width: 96px; height: 96px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
    .content { padding: 40px 30px; background: #fcfbfb; border: 1px solid #eee; }
    .credentials-box { background: #f7fafc; border-left: 4px solid #667eea; padding: 25px; margin: 25px 0; border-radius: 5px; }
    .credentials-box h3 { margin: 0 0 20px 0; color: #667eea; font-size: 18px; }
    .credential-item { margin: 15px 0; }
    .credential-label { font-weight: 600; color: #667eea; font-size: 14px; display: block; margin-bottom: 8px; }
    .credential-value { font-family: 'Courier New', monospace; background: white; padding: 12px 15px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 14px; word-break: break-all; display: block; width: 100%; box-sizing: border-box; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; margin: 20px 0; }
    .button-container { text-align: center; margin: 30px 0; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 5px; }
    .warning-box strong { color: #856404; display: block; margin-bottom: 10px; }
    .warning-box ul { margin: 10px 0; padding-left: 20px; color: #856404; }
    .warning-box li { margin: 8px 0; white-space: nowrap; }
    .steps { background: #f7fafc; padding: 25px; border-radius: 5px; margin: 25px 0; }
    .steps h3 { margin: 0 0 15px 0; color: #667eea; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin: 10px 0; line-height: 1.6; }
    .footer { background: #f7fafc; padding: 30px; text-align: center; font-size: 12px; color: #666; border: 1px solid #e2e8f0; }
    .footer p { margin: 5px 0; }
    .divider { height: 1px; background: #e2e8f0; margin: 30px 0; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Welcome to EXAMINERS!</h1>
      <p>Your account has been successfully created</p>
    </div>
    <div class="content">
      <h2 style="color: #667eea; margin-top: 0;">Hello ${name}! 👋</h2>
      <p>Welcome to <strong>EXAMINERS</strong> at <strong>${collegeName}</strong>!</p>
      <p>Your account has been created as a <strong>${userType}</strong>. We're excited to have you join our AI-powered secure exams & learning management platform.</p>

      <div class="credentials-box">
        <h3>🔐 Your Login Credentials</h3>
        <div class="credential-item">
          <span class="credential-label">📧 Email:</span>
          <span class="credential-value">${email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">🔑 Password:</span>
          <span class="credential-value">${password}</span>
        </div>
      </div>

      <div class="warning-box">
        <strong>⚠️ Important Security Notice</strong>
        <ul>
          <li>This is a temporary password</li>
          <li>You will be required to change it on your first login</li>
          <li>Never share your password with anyone</li>
          <li>Keep this email secure and delete it after changing your password</li>
        </ul>
      </div>

      <div class="button-container">
        <a href="${loginUrl}" class="button">🚀 Login to EXAMINERS</a>
      </div>

      <div class="steps">
        <h3>📋 Getting Started</h3>
        <ol>
          <li>Click the "Login to EXAMINERS" button above</li>
          <li>Enter your email and temporary password</li>
          <li>Create a strong, secure password when prompted</li>
          <li>Start using EXAMINERS!</li>
        </ol>
      </div>

      <div class="divider"></div>

      <h3 style="color: #667eea;">Need Help? 🆘</h3>
      <p>If you have any questions or need assistance getting started:</p>
      <ul>
        <li>📧 Email: <a href="mailto:contact@tutorialspoint.com" style="color: #667eea;">contact@tutorialspoint.com</a></li>
        <li>💬 Contact your system administrator</li>
      </ul>
    </div>

    <div class="footer">
      <p><strong>EXAMINERS</strong> - AI-Powered Secure Exams &amp; Learning Management Application</p>
      <p>© ${new Date().getFullYear()} ${collegeName}. All rights reserved.</p>
      <p style="margin-top: 15px; font-size: 11px; color: #999;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================================
// HELPERS
// ============================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readEmailsFromExcel(filePath, emailCol) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // --- Try 1: header-based (explicit column, or a column named like "email") ---
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rows.length) {
    const headers = Object.keys(rows[0]);
    const key = emailCol || headers.find((h) => /email/i.test(h));
    if (key) {
      const emails = rows
        .map((r) => String(r[key] || '').trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e));
      if (emails.length) return [...new Set(emails)];
    }
  }

  // --- Try 2: no header / no email column → harvest ALL email-looking cells ---
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const harvested = [];
  for (const row of grid) {
    for (const cell of row) {
      const val = String(cell || '').trim().toLowerCase();
      if (EMAIL_RE.test(val)) harvested.push(val);
    }
  }
  if (harvested.length) return [...new Set(harvested)];

  throw new Error(
    'No valid emails found. Put emails in the first column (a header row like "email" is optional).'
  );
}

// Look up the Firebase Auth account for an email, plus name/type/college from users doc.
// Returns null if there is no Auth account for that email.
async function getUserInfoByEmail(emailLower) {
  let authUser;
  try {
    authUser = await admin.auth().getUserByEmail(emailLower);
  } catch (e) {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  }

  const uid = authUser.uid;
  let name = authUser.displayName || 'User';
  let userType = 'user';
  let collegeId = null;

  try {
    const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
    if (userDoc.exists) {
      const d = userDoc.data();
      name = d.fullName || name;
      userType = d.userType || userType;
      collegeId = d.collegeId || null;
    }
  } catch (_) { /* fall through with auth values */ }

  return { uid, name, userType, collegeId };
}

async function getCollegeName(collegeId) {
  if (!collegeId) return 'EXAMINERS';
  try {
    const collegeDoc = await db.collection(COLLEGES_COLLECTION).doc(collegeId).get();
    if (collegeDoc.exists) return collegeDoc.data().collegeName || 'EXAMINERS';
  } catch (_) { /* fall through */ }
  return 'EXAMINERS';
}

async function loadTransporter() {
  const doc = await db.doc(EMAIL_CREDENTIALS_PATH).get();
  if (!doc.exists) throw new Error(`Email credentials not found at ${EMAIL_CREDENTIALS_PATH}`);
  const c = doc.data();
  if (!c.MAIL_HOST || !c.MAIL_USERNAME || !c.MAIL_PASSWORD || !c.MAIL_PORT) {
    throw new Error('Incomplete email credentials (need MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, MAIL_PORT)');
  }
  return nodemailer.createTransport({
    host: c.MAIL_HOST,
    port: parseInt(c.MAIL_PORT),
    secure: false,
    auth: { user: c.MAIL_USERNAME, pass: c.MAIL_PASSWORD },
  });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const excelPath = process.argv[2];
  const emailColArg = process.argv[3];

  if (!excelPath) {
    console.error('❌ Usage: node resend_welcome_emails.js <path-to-excel.xlsx> [emailColumnName]');
    process.exit(1);
  }

  console.log(`📄 Reading Excel: ${path.resolve(excelPath)}`);
  const emails = readEmailsFromExcel(excelPath, emailColArg);
  console.log(`📧 Found ${emails.length} unique valid email(s)\n`);
  if (!emails.length) { console.log('Nothing to do.'); process.exit(0); }

  const transporter = DRY_RUN ? null : await loadTransporter();

  const summary = { sent: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const tag = `[${i + 1}/${emails.length}] ${email}`;
    try {
      const info = await getUserInfoByEmail(email);

      if (!info) {
        console.log(`⏭️  ${tag} — SKIP (no Firebase Auth account for this email)`);
        summary.skipped++;
        continue;
      }

      const { uid, name, userType } = info;
      const collegeName = await getCollegeName(info.collegeId);

      if (DRY_RUN) {
        console.log(`👀 ${tag} — WOULD RESET+SEND (name: ${name}, type: ${userType}, college: ${collegeName})`);
        summary.sent++;
        continue;
      }

      // Real run only (TEST_TO empty): actually change the user's password.
      const isRealSend = !TEST_TO;
      if (isRealSend) {
        await admin.auth().updateUser(uid, { password: FORCE_PASSWORD });
        // Force the "change password" dialog on next login, even if the user
        // had logged in before (login checks users.mustChangePassword).
        await db.collection(USERS_COLLECTION).doc(uid).update({
          mustChangePassword: true,
          temporaryPassword: true,
          passwordChangedAt: null,
        });
      }

      const html = generateWelcomeEmailHTML({
        name,
        email,
        password: FORCE_PASSWORD, // fixed password for everyone
        userType,
        collegeName,
        loginUrl: LOGIN_URL,
      });

      const recipient = TEST_TO || email; // redirect to your inbox if TEST_TO set

      await transporter.sendMail({
        from: `EXAMINERS System <${NOREPLY_EMAIL}>`,
        to: recipient,
        subject: 'Welcome to EXAMINERS - Your Account is Ready!',
        html,
      });

      console.log(
        `✅ ${tag} — ${isRealSend ? 'PASSWORD RESET + SENT' : 'PREVIEW SENT (no password change)'}` +
        `${TEST_TO ? ` (redirected to ${TEST_TO})` : ''}`
      );
      summary.sent++;
      await sleep(SEND_DELAY_MS);

    } catch (err) {
      console.log(`❌ ${tag} — FAILED: ${err.message}`);
      summary.failed++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  RESEND SUMMARY' + (DRY_RUN ? ' (DRY RUN)' : ''));
  console.log('═══════════════════════════════════════');
  console.log(`  Sent/Would-send : ${summary.sent}`);
  console.log(`  Skipped         : ${summary.skipped}`);
  console.log(`  Failed          : ${summary.failed}`);
  console.log('═══════════════════════════════════════');

  process.exit(0);
}

main().catch((e) => { console.error('❌ Fatal:', e.message); process.exit(1); });
