import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware for JWT verification
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);

            // Attach user to the request (excluding password)
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
           console.error(error);
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Middleware for Role-Based Access Control (FR-5)
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            // Error handling for 2.1 GET /users (non-admin attempt)
            return res.status(403).json({ 
                message: `User role ${req.user ? req.user.role : 'unauthenticated'} is not authorized to access this route` 
            });
        }
        next();
    };
};