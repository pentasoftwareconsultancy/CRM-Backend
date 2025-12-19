// src/routes/notification.routes.js

import express from 'express';
import { getNotifications, markNotificationRead } from '../controllers/notification.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// 9.1 GET /notifications
router.get('/', protect, getNotifications);

// 9.2 PATCH /notifications/:id/read
router.patch('/:id/read', protect, markNotificationRead);

export default router;