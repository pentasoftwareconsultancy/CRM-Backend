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

export const sendNotificationEmail = async (email, name, type, message) => {
  // Color scheme based on notification type
  const isUrgent = type === 'followup_due';
  const colors = isUrgent ? {
    background: '#fef2f2', // light red
    border: '#dc2626',     // red-600
    text: '#991b1b',       // red-800
    title: '⚠️ CRM Urgent Notification: Follow-up Due'
  } : {
    background: '#f0f9ff', // light blue
    border: '#3b82f6',     // blue-500
    text: '#1e40af',       // blue-800
    title: `CRM Notification: ${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
  };

  const subject = colors.title;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${isUrgent ? '#dc2626' : '#1e40af'};">${isUrgent ? '⚠️ CRM Urgent Notification' : 'CRM System Notification'}</h2>
      <p>Dear ${name},</p>
      <div style="background-color: ${colors.background}; border-left: 4px solid ${colors.border}; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: ${colors.text}; font-weight: ${isUrgent ? 'bold' : 'normal'};">${message}</p>
      </div>
      ${isUrgent ? '<p style="color: #dc2626; font-weight: bold;">⚡ This follow-up is overdue! Please take immediate action.</p>' : ''}
      <p>Please log in to your CRM account to view more details and take necessary actions.</p>
      <p>You can access the system at: <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: ${colors.border};">CRM Dashboard</a></p>
      <p>Best regards,<br>CRM System</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 12px; color: #6b7280;">This is an automated notification from the CRM system. Please do not reply to this email.</p>
    </div>
  `;

  return await sendEmail(email, subject, html);
};