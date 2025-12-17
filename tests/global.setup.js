// tests/global.setup.js

import jwt from 'jsonwebtoken';
import User from '../src/models/User.model.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Define standard users for testing roles
const TEST_USERS = {
    ADMIN: {
        // Use consistent ObjectId structure for reliable testing
        _id: new mongoose.Types.ObjectId().toString(), 
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
        designation: 'System Administrator'
    },
    MANAGER: {
        _id: new mongoose.Types.ObjectId().toString(),
        name: 'Manager User',
        email: 'manager@test.com',
        password: 'password123',
        role: 'manager',
        designation: 'Sales Manager'
    },
    SALES: {
        _id: new mongoose.Types.ObjectId().toString(),
        name: 'Sales User',
        email: 'sales@test.com',
        password: 'password123',
        role: 'sales',
        designation: 'Sales Executive'
    }
};

/**
 * Generates a valid JWT token for a user.
 */
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION }
    );
};

/**
 * Initializes test data: cleans DB and inserts standard test users.
 */
const initializeTestData = async () => {
    await User.deleteMany({});
    
    // Insert users and pre-calculate their tokens
    const insertedUsers = {};
    for (const key in TEST_USERS) {
        const userData = TEST_USERS[key];
        
        // Use User.create to ensure pre-save hooks (password hashing) run
        const user = await User.create(userData); 

        insertedUsers[key] = {
            ...userData,
            token: generateToken(userData),
            userId: user._id.toString()
        };
    }
    return insertedUsers;
};

export { TEST_USERS, generateToken, initializeTestData };