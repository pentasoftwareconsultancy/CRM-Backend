// src/controllers/notification.controller.js

import Notification from '../models/Notification.model.js';
import logger from '../utils/logger.js';
// Import FollowUp model if needed for triggering, but we'll focus on routes here.

// Helper function to create notifications (called by other controllers)
export const createNotification = async (userId, type, message, relatedId = null) => {
    // Safety checks
    if (!userId || !message) return;
    
    // Convert ObjectId if necessary, though Mongoose should handle it
    const recipientId = userId._id || userId; 
    
    try {
        await Notification.create({
            user: recipientId,
            type,
            message,
            relatedId
        });
    } catch (e) {
        // Log error but don't halt main operation
        logger.error(`Failed to create notification for user ${recipientId}`, { message: e.message });
    }
};


// @desc    Get notifications for logged-in user (9.1 GET /notifications)
// @route   GET /api/notifications
// @access  Authenticated (user gets their own notifications)
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20); // Limit to 20 recent notifications

        res.json(notifications);
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