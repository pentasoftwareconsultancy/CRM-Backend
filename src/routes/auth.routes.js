import express from 'express';
import { login, changePassword } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// 1.1 POST /auth/login
router.post('/login', login);

// 1.2 POST /auth/change-password (requires authentication)
router.post('/change-password', protect, changePassword);

export default router;