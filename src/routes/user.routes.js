import express from 'express';
import { 
    getUsers, 
    createUser, 
    getUserById, 
    updateUser, 
    deactivateUser 
} from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All user management routes require authentication and Admin role
router.route('/')
    // 2.1 GET /users
    .get(protect, authorize('admin', 'manager'), getUsers) 
    // 2.2 POST /users
    .post(protect, authorize('admin'), createUser);

router.route('/:id')
    // 2.3 GET /users/:id
    .get(protect, authorize('admin'), getUserById)
    // 2.4 PUT /users/:id
    .put(protect, authorize('admin'), updateUser)
    // 2.5 DELETE /users/:id (Deactivate)
    .delete(protect, authorize('admin'), deactivateUser);

export default router;