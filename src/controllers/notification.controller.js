// src/controllers/notification.controller.js

import Notification from '../models/Notification.model.js';
import User from '../models/User.model.js';
import FollowUp from '../models/FollowUp.model.js';
import logger from '../utils/logger.js';
import { sendEmail, sendNotificationEmail } from '../utils/email.js';
// Import FollowUp model if needed for triggering, but we'll focus on routes here.

// Helper function to create notifications (called by other controllers)
export const createNotification = async (userId, type, message, relatedId = null) => {
    // Safety checks
    if (!userId || !message) return;

    // Convert ObjectId if necessary, though Mongoose should handle it
    const recipientId = userId._id || userId;

    try {
        // Create the notification in DB
        const notification = await Notification.create({
            user: recipientId,
            type,
            message,
            relatedId
        });

        // Get user details for email
        const user = await User.findById(recipientId).select('name email');
        if (user && user.email) {
            try {
                await sendNotificationEmail(user.email, user.name, type, message);
                logger.info('Notification email sent', { userId: recipientId, type });
            } catch (emailError) {
                logger.error('Failed to send notification email', { userId: recipientId, error: emailError });
                logger.error(emailError);
                // Don't fail the notification creation if email fails
            }
        }

        return notification;
    } catch (e) {
        // Log error but don't halt main operation
        logger.error(`Failed to create notification for user ${recipientId}`, { message: e.message });
    }
};


// @desc    Get notifications for logged-in user (9.1 GET /notifications)
// @route   GET /api/notifications
// @access  Authenticated (user gets their own notifications)
export const getNotifications = async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    try {
        const total = await Notification.countDocuments({ user: req.user._id });
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            data: notifications,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        logger.error('Error fetching notifications', { error });
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

// @desc    Mark notification as read (9.2 PATCH /notifications/:id/read)
// @route   PATCH /api/notifications/:id/read
// @access  Authenticated
export const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Ensure user owns the notification
        if (notification.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this notification.' });
        }

        notification.isRead = true;
        await notification.save();

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        logger.error('Failed to update notification status', { error });
        res.status(400).json({ message: 'Failed to update notification status' });
    }
};

// @desc    Check for due follow-ups and send notifications (can be called by cron or manually)
// @route   POST /api/notifications/check-due-followups
// @access  Authenticated (admin/manager)
export const checkDueFollowUps = async (req, res) => {
    try {
        const now = new Date();
        // Find follow-ups that are due (scheduledAt <= now and status = 'pending')
        const dueFollowUps = await FollowUp.find({
            status: 'pending',
            scheduledAt: { $lte: now }
        }).populate('assignedTo', 'name email').populate('lead', 'name');

        let notificationsSent = 0;

        for (const followUp of dueFollowUps) {
            if (followUp.assignedTo && followUp.assignedTo.email) {
                const message = `Follow-up due: ${followUp.type} scheduled for ${followUp.lead?.name || 'Unknown Lead'} at ${new Date(followUp.scheduledAt).toLocaleString()}. Note: ${followUp.note || 'No note'}`;
                
                // Check if notification already exists for this follow-up
                const existingNotification = await Notification.findOne({
                    user: followUp.assignedTo._id,
                    type: 'followup_due',
                    relatedId: followUp._id,
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
                });

                if (!existingNotification) {
                    await createNotification(followUp.assignedTo._id, 'followup_due', message, followUp._id);
                    notificationsSent++;
                }
            }
        }

        res.json({ message: `Checked ${dueFollowUps.length} due follow-ups, sent ${notificationsSent} notifications` });
    } catch (error) {
        logger.error('Failed to check due follow-ups', { error });
        res.status(500).json({ message: 'Failed to check due follow-ups' });
    }
};