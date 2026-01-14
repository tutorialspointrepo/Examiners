// ============================================
// Test Email Script - Verify Brevo Credentials
// Save as: functions/test-email.js
// Run: node functions/test-email.js
// ============================================

const nodemailer = require('nodemailer');

// Your Brevo SMTP credentials
const SMTP_CONFIG = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: '3d64ae004@smtp-brevo.com',
    pass: 'aVWGmBU6pnjsOvwZ'
  }
};

async function testEmail() {
  console.log('🧪 Testing Brevo SMTP Connection...\n');
  
  try {
    // Create transporter
    console.log('📬 Creating transporter with Brevo credentials...');
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    
    // Verify connection
    console.log('🔌 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');
    
    // Send test email
    console.log('📤 Sending test email...');
    const mailOptions = {
      from: 'EXAMINERS Test <noreply@tutorialspoint.com>',
      to: 'mohtashim@tutorialspoint.com', // Change this to your email
      subject: 'Test Email from EXAMINERS',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
            <h1 style="color: #667eea;">Test Email from EXAMINERS</h1>
            <p>This is a test email to verify Brevo SMTP integration.</p>
            <p><strong>SMTP Host:</strong> ${SMTP_CONFIG.host}</p>
            <p><strong>SMTP Port:</strong> ${SMTP_CONFIG.port}</p>
            <p><strong>SMTP User:</strong> ${SMTP_CONFIG.auth.user}</p>
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
              If you received this email, your Brevo SMTP configuration is working correctly!
            </p>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Test email sent successfully!\n');
    console.log('📧 Message ID:', info.messageId);
    console.log('📨 Email sent to:', mailOptions.to);
    console.log('\n✅ Brevo SMTP is working correctly!');
    console.log('✅ You can now use these credentials in your Cloud Function\n');
    
  } catch (error) {
    console.error('❌ Error testing email:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('1. Verify your Brevo credentials are correct');
    console.error('2. Check if your Brevo account is active');
    console.error('3. Ensure port 587 is not blocked by firewall');
    console.error('4. Verify you have not exceeded daily sending limits\n');
  }
}

// Run the test
testEmail();
