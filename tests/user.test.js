// tests/user.test.js (CORRECTED)

import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import { initializeTestData, TEST_USERS } from './global.setup.js';
import mongoose from 'mongoose';
import User from '../src/models/User.model.js';

describe('2. User & Role Management APIs (Admin Only)', () => {
    let users;
    let adminToken;
    let salesUserId;

    before(async () => {
        if (mongoose.connection.readyState !== 1) {
             await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test');
        }
    });

    beforeEach(async () => {
        users = await initializeTestData();
        adminToken = users.ADMIN.token;
        salesUserId = users.SALES.userId;
    });

    // --- 2.1 GET /users ---
    describe('GET /api/users', () => {
        it('should allow Admin to fetch all users', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`);
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            const body = res.body.data || res.body;
            expect(body).to.be.an('array').with.lengthOf(3);
            expect(body[0]).to.have.property('role');
        });

        it('should allow filtering users by role (manager)', async () => {
            const res = await request(app)
                .get('/api/users?role=manager')
                .set('Authorization', `Bearer ${adminToken}`);
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            const body = res.body.data || res.body;
            expect(body).to.be.an('array').with.lengthOf(1);
            expect(body[0].role).to.equal('manager');
        });

        it('should deny non-admin users access (FR-5)', async () => {
            const salesToken = users.SALES.token;
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${salesToken}`);
            
            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(403);
        });
    });

    // --- 2.2 POST /users ---
    describe('POST /api/users', () => {
        it('should allow Admin to create a new user (FR-3)', async () => {
            const newUser = {
                name: 'New Tester',
                email: 'newtester@test.com',
                password: 'password123',
                role: 'sales',
                designation: 'Sales Executive',
                phone: '1234567890'
            };

            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newUser);

            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(201);
            expect(res.body).to.have.property('message', 'User created successfully');
            expect(res.body.user).to.have.property('email', newUser.email);

            const count = await User.countDocuments();
            expect(count).to.equal(4);
        });
    });

    // --- 2.3 GET /users/:id ---
    describe('GET /api/users/:id', () => {
        it('should allow Admin to fetch a specific user by ID', async () => {
            const res = await request(app)
                .get(`/api/users/${salesUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('email', TEST_USERS.SALES.email);
        });
    });

    // --- 2.4 PUT /users/:id ---
    describe('PUT /api/users/:id', () => {
        it('should allow Admin to update a specific user', async () => {
            const updateData = {
                name: 'Sales Executive Updated',
                role: 'manager' // Promote the user
            };

            const res = await request(app)
                .put(`/api/users/${salesUserId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body.user.name).to.equal('Sales Executive Updated');
            expect(res.body.user.role).to.equal('manager');
        });
    });

    // --- 2.5 DELETE /users/:id (Soft-Delete) ---
    describe('DELETE /api/users/:id', () => {
        it('should allow Admin to soft-delete/deactivate a user', async () => {
            const res = await request(app)
                .delete(`/api/users/${salesUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            // CORRECTED: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('message', 'User deactivated successfully');

            const deactivatedUser = await User.findById(salesUserId);
            expect(deactivatedUser.status).to.equal('inactive');
        });
    });
});