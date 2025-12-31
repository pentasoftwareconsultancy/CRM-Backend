import nodemailer from 'nodemailer';
import logger from './logger.js';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    logger.error('Email transporter verification failed', { error });
  } else {
    logger.info('Email transporter is ready');
  }
});

export const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"CRM System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    logger.info('Email sent successfully', { messageId: info.messageId, to });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email', { error, to });
    throw error;
  }
};

export const sendUserCredentials = async (email, name, password) => {
  const subject = 'Your CRM Account Credentials';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to CRM System</h2>
      <p>Dear ${name},</p>
      <p>Your account has been created successfully. Here are your login credentials:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      <p><strong>Important:</strong> Please change your password after first login for security reasons.</p>
      <p>You can login at: <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}">CRM Login</a></p>
      <p>Best regards,<br>CRM Admin Team</p>
    </div>
  `;

  return await sendEmail(email, subject, html);
};