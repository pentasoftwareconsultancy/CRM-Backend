// tests/customer.test.js

import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import { initializeTestData } from './global.setup.js';
import mongoose from 'mongoose';
import Customer from '../src/models/Customer.model.js';

describe('7. CUSTOMERS APIs', () => {
    let users, salesToken, adminToken, customerId, salesUserId;
    
    const customerData = {
        name: 'TechCorp Solutions',
        primaryContact: 'Alice Smith',
        email: 'alice@techcorp.com',
        phone: '1234567890',
        owner: null // Will be assigned
    };

    before(async () => {
        if (mongoose.connection.readyState !== 1) {
             await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test');
        }
    });

    beforeEach(async () => {
        users = await initializeTestData();
        salesToken = users.SALES.token;
        adminToken = users.ADMIN.token;
        salesUserId = users.SALES.userId;

        await Customer.deleteMany({});
        
        // Create a base customer (mimicking a won deal conversion)
        const customer = await Customer.create({...customerData, owner: salesUserId});
        customerId = customer._id.toString();
    });

    // --- 7.2 POST /customers (Manual Creation) ---
    describe('POST /api/customers (Manual)', () => {
        it('should allow Admin to manually create a customer', async () => {
            const res = await request(app)
                .post('/api/customers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({...customerData, email: 'manual@test.com'});
            
            expect(res.statusCode).to.equal(201);
            expect(res.body.customer.name).to.equal(customerData.name);
            expect(res.body.customer.owner.toString()).to.equal(users.ADMIN.userId); // Default owner is creator
        });
        
        it('should deny Sales Executive manual creation', async () => {
             const res = await request(app)
                .post('/api/customers')
                .set('Authorization', `Bearer ${salesToken}`)
                .send({...customerData, email: 'denied@test.com'});
            
            expect(res.statusCode).to.equal(403);
        });
    });

    // --- 7.1 GET /customers ---
    describe('GET /api/customers', () => {
        it('should allow Sales Executive to fetch their own customers', async () => {
            const res = await request(app)
                .get('/api/customers')
                .set('Authorization', `Bearer ${salesToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0].email).to.equal(customerData.email);
        });
    });

    // --- 7.3 GET /customers/:id ---
    describe('GET /api/customers/:id', () => {
        it('should fetch details of a specific customer', async () => {
            const res = await request(app)
                .get(`/api/customers/${customerId}`)
                .set('Authorization', `Bearer ${salesToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('name', customerData.name);
        });
    });

    // --- 7.4 PUT /customers/:id ---
    describe('PUT /api/customers/:id', () => {
        it('should allow updating customer info (e.g., billing)', async () => {
            const update = { billingInfo: 'Bank transfer preferred' };
            const res = await request(app)
                .put(`/api/customers/${customerId}`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send(update);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body.customer.billingInfo).to.equal(update.billingInfo);
        });
    });
});