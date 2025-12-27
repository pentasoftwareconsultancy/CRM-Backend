// src/controllers/auth.controller.js (Validation Update)
import User from '../models/User.model.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION
    });
};

// @desc    Auth user & get token (FR-1)
// @route   POST /api/auth/login
export const login = async (req, res) => {
    const { email, password } = req.body;

    logger.info('Auth.login attempt', { email, ip: req.ip });

    // Validation check
    if (!email || !password) {
        logger.warn('Auth.login validation failed - missing fields', { email, ip: req.ip });
        return res.status(400).json({ message: 'Please enter both email and password.' });
    }
    // if (password.length < 6) {
    //     logger.warn('Auth.login validation failed - short password', { email, ip: req.ip });
    //     return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    // }

    // 1. Find user by email, explicitly selecting the password
    const user = await User.findOne({ email }).select('+password');

    // 2. Check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
        // 4. Handle disabled users (403 - User disabled)
        if (user.status === 'inactive') {
            logger.warn('Auth.login blocked - user inactive', { userId: user._id });
            return res.status(403).json({ message: 'User is deactivated. Contact administrator.' });
        }
        
        // Success response
        logger.info('Auth.login success', { userId: user._id, role: user.role });
        res.json({
            token: generateToken(user._id, user.role),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                designation: user.designation,
            }
        });
    } else {
        // 401 - Invalid credentials
        logger.warn('Auth.login failed - invalid credentials', { email, ip: req.ip });
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

// @desc    Change user password (1.2)
// @route   POST /api/auth/change-password
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    logger.info('Auth.changePassword attempt', { userId: req.user?._id });
    
    // Validation check
    if (!currentPassword || !newPassword) {
         logger.warn('Auth.changePassword validation failed - missing fields', { userId: req.user?._id });
         return res.status(400).json({ message: 'Current and new password fields are required.' });
    }
    if (newPassword.length < 6) {
        logger.warn('Auth.changePassword validation failed - short new password', { userId: req.user?._id });
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }
    if (currentPassword === newPassword) {
        logger.warn('Auth.changePassword validation failed - new equals current', { userId: req.user?._id });
        return res.status(400).json({ message: 'New password cannot be the same as the current password.' });
    }
    
    // 1. Find user, explicitly selecting password
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
        logger.error('Auth.changePassword - user not found', { userId: req.user?._id });
        return res.status(404).json({ message: 'User not found' });
    }

    // 2. Check if current password is correct (401 - Incorrect current password)
    if (!(await user.matchPassword(currentPassword))) {
        logger.warn('Auth.changePassword failed - incorrect current password', { userId: req.user?._id });
        return res.status(401).json({ message: 'Incorrect current password' });
    }

    // 3. Update and save new password (pre-save hook handles hashing)
    user.password = newPassword;
    await user.save();

    // 4. Response
    logger.info('Auth.changePassword success', { userId: req.user?._id });
    res.json({ message: 'Password updated successfully' });
};