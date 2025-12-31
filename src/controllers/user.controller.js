import User from '../models/User.model.js';
import cloudinary from '../config/cloudinary.js';
// 1. IMPORT THE NOTIFICATION HELPER
import { createNotification } from './notification.controller.js';
import logger from '../utils/logger.js';
import { sendUserCredentials } from '../utils/email.js';

// Helper function for filtering (remains the same)
const buildUserQuery = (query) => {
    const filters = { status: 'active' }; 
    if (query.role) {
        filters.role = { $in: query.role.split('|') };
    }
    if (query.status) {
        filters.status = { $in: query.status.split('|') };
    }
    
    if (query.search) {
        const search = new RegExp(query.search, 'i');
        filters.$or = [{ name: search }, { email: search }];
    }
    
    return filters;
};

// @desc    Get list of users (2.1 GET /users)
// @access  Authenticated (All roles)
export const getUsers = async (req, res) => {
    const { search, status, role, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    logger.info('User.getUsers request', { userId: req.user._id, filters: { search, status, role, page, limit } });

    try {
        const filters = buildUserQuery({ search, status, role });
        
        const selectFields = req.user.role === 'admin' 
            ? '-password' 
            : '_id name email role designation status'; 

        const totalUsers = await User.countDocuments(filters);
        const users = await User.find(filters)
            .select(selectFields)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        logger.info('User.getUsers success', { userId: req.user._id, total: totalUsers });
        res.json({
            data: users,
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalUsers
        });

    } catch (error) {
        logger.error('Error fetching users', { error });
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const getAssignees = async (req, res) => {
    try {
        logger.info('User.getAssignees request', { userId: req.user._id });
        // Fetch only active users with roles capable of owning leads/deals
        const users = await User.find({ 
            status: 'active',
            role: { $in: ['admin', 'manager', 'sales'] } 
        }).select('_id name role'); // Only return minimal, safe data

        logger.info('User.getAssignees success', { userId: req.user._id, count: users.length });
        res.json(users);

    } catch (error) {
        logger.error('Error fetching assignees', { error });
        res.status(500).json({ message: 'Error fetching user list for assignment' });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        logger.info('User.updateUserProfile attempt', { userId: req.user._id });
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Update Name
        if (req.body.name) user.name = req.body.name;

        // Handle Avatar Upload to Cloudinary
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "nexus_crm/avatars",
                public_id: `user_${user._id}`, // Overwrites old image to save space
                transformation: [{ width: 300, height: 300, crop: "fill" }] // Auto-resize
            });
            user.avatar = result.secure_url; // Save the Cloudinary URL to MongoDB
        }

        const savedUser = await user.save();

        logger.info('User.updateUserProfile success', { userId: savedUser._id });
        res.json({
            _id: savedUser._id,
            name: savedUser.name,
            email: savedUser.email,
            avatar: savedUser.avatar, 
            role: savedUser.role
        });
    } catch (error) {
        logger.error('Upload Error', { error });
        res.status(500).json({ message: "Failed to upload image" });
    }
};

// @desc    Create a new user (2.2 POST /users)
// @route   POST /api/users
// @access  Admin
export const createUser = async (req, res) => {
    const { name, email, password, role, designation, phone } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User with this email already exists' });
    }
    logger.info('User.createUser attempt', { adminId: req.user._id, email, role });

    try {
        // Send email with credentials before creating user
        try {
            await sendUserCredentials(email, name, password);
            logger.info('Credentials email sent', { email });
        } catch (emailError) {
            logger.error('Failed to send credentials email', { email, error: emailError });
            // Continue with user creation even if email fails
        }

        const user = await User.create({
            name, email, password, role, designation, phone
        });

        // 2. CREATE NOTIFICATION (Target: The Admin who performed the action)
        createNotification(
            req.user._id, 
            'user_created', 
            `Successfully created new user: ${user.name} (${user.role}).`,
            user._id // Related ID is the new user's ID
        );

        logger.info('User.createUser success', { adminId: req.user._id, createdUserId: user._id });

        // Response should exclude the password field (handled by default select: false)
        res.status(201).json({
            message: 'User created successfully. Credentials sent to user email.',
            user: user
        });
    } catch (error) {
        logger.error('Error creating user', { error });
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get details of a specific user (2.3 GET /users/:id)
// @route   GET /api/users/:id
// @access  Admin
export const getUserById = async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Update user details (2.4 PUT /users/:id)
// @route   PUT /api/users/:id
// @access  Admin
export const updateUser = async (req, res) => {
    const userId = req.params.id;
    const updates = req.body;

    try {
        logger.info('User.updateUser attempt', { adminId: req.user._id, targetUserId: userId, updates });
        // Find user but prevent direct modification of sensitive fields like email
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
            if (key !== 'password' && key !== 'email') {
                user[key] = updates[key];
            }
        });

        const updatedUser = await user.save();
        logger.info('User.updateUser success', { adminId: req.user._id, updatedUserId: updatedUser._id });
        res.json({ 
            message: 'User updated successfully',
            user: updatedUser 
        });

    } catch (error) {
        logger.error('Error updating user', { error });
        res.status(400).json({ message: error.message });
    }
};

// @desc    Soft-delete / deactivate user (2.5 DELETE /users/:id)
// @route   DELETE /api/users/:id
// @access  Admin
export const deactivateUser = async (req, res) => {
    const userId = req.params.id;

    logger.info('User.deactivateUser attempt', { adminId: req.user._id, targetUserId: userId });

    const user = await User.findByIdAndUpdate(
        userId, 
        { status: 'inactive' }, 
        { new: true }
    );

    if (user) {
        logger.info('User.deactivateUser success', { adminId: req.user._id, targetUserId: userId });
        res.json({ message: 'User deactivated successfully' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};