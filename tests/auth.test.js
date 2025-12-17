// tests/auth.test.js (CORRECTED)

import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import User from '../src/models/User.model.js';
import mongoose from 'mongoose';
import { initializeTestData } from './global.setup.js'; // Import setup

describe('1. Authentication APIs', () => {
    let users; // Hold the initialized users and tokens
    const adminUser = {
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin'
    };
    
    // Connect to DB and ensure data consistency
    before(async () => {
        if (mongoose.connection.readyState !== 1) {
             await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test');
        }
    });

    beforeEach(async () => {
        // We only need one user for auth tests initially
        await User.deleteMany({});
        const user = new User(adminUser);
        await user.save();
    });

    after(async () => {
        await User.deleteMany({});
    });

    // --- 1.1 POST /auth/login ---
    describe('POST /api/auth/login', () => {
        it('should successfully log in a user and return a token (FR-1)', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: adminUser.email,
                    password: adminUser.password
                });
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(200); 
            expect(res.body).to.have.property('token');
            expect(res.body.user).to.have.property('email', adminUser.email);
            expect(res.body.user).to.not.have.property('password');
        });

        it('should return 401 for invalid credentials (password)', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: adminUser.email,
                    password: 'wrongpassword'
                });
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(401); 
            expect(res.body).to.have.property('message', 'Invalid credentials');
        });

        it('should return 401 for invalid credentials (email)', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: adminUser.password
                });
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(401);
        });
    });

    // --- 1.2 POST /auth/change-password ---
    describe('POST /api/auth/change-password', () => {
        let token;

        beforeEach(async () => {
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: adminUser.email,
                    password: adminUser.password
                });
            token = loginRes.body.token;
        });

        it('should allow a logged-in user to change their password', async () => {
            const newPassword = 'newPassword456';
            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: adminUser.password,
                    newPassword: newPassword
                });
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('message', 'Password updated successfully');

            // Try logging in with the new password
            const newLoginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: adminUser.email,
                    password: newPassword
                });
            
            // CORRECTED: Use res.statusCode
            expect(newLoginRes.statusCode).to.equal(200);
        });

        it('should return 401 if current password is wrong', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: 'badpassword',
                    newPassword: 'newPassword456'
                });
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(401);
            expect(res.body).to.have.property('message', 'Incorrect current password');
        });

        it('should return 401 if no token is provided', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .send({
                    currentPassword: adminUser.password,
                    newPassword: 'newPassword456'
                });
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(401); 
        });
    });
});