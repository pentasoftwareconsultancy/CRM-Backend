// src/controllers/auth.controller.js (Validation Update)
import User from '../models/User.model.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

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

    // Validation check
    if (!email || !password) {
        return res.status(400).json({ message: 'Please enter both email and password.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // 1. Find user by email, explicitly selecting the password
    const user = await User.findOne({ email }).select('+password');

    // 2. Check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
        // 4. Handle disabled users (403 - User disabled)
        if (user.status === 'inactive') {
            return res.status(403).json({ message: 'User is deactivated. Contact administrator.' });
        }
        
        // Success response
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
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

// @desc    Change user password (1.2)
// @route   POST /api/auth/change-password
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    // Validation check
    if (!currentPassword || !newPassword) {
         return res.status(400).json({ message: 'Current and new password fields are required.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }
    if (currentPassword === newPassword) {
        return res.status(400).json({ message: 'New password cannot be the same as the current password.' });
    }
    
    // 1. Find user, explicitly selecting password
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // 2. Check if current password is correct (401 - Incorrect current password)
    if (!(await user.matchPassword(currentPassword))) {
        return res.status(401).json({ message: 'Incorrect current password' });
    }

    // 3. Update and save new password (pre-save hook handles hashing)
    user.password = newPassword;
    await user.save();

    // 4. Response
    res.json({ message: 'Password updated successfully' });
};