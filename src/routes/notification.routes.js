// src/routes/notification.routes.js

import express from 'express';
import { getNotifications, markNotificationRead, checkDueFollowUps } from '../controllers/notification.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// 9.1 GET /notifications
router.get('/', protect, getNotifications);

// 9.2 PATCH /notifications/:id/read
router.patch('/:id/read', protect, markNotificationRead);

// Check due follow-ups (for cron or manual trigger)
router.post('/check-due-followups', protect, authorize('admin', 'manager'), checkDueFollowUps);

export default router;