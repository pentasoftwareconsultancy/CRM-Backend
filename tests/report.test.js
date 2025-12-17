// tests/report.test.js

import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import { initializeTestData } from './global.setup.js';
import mongoose from 'mongoose';
import Lead from '../src/models/Lead.model.js';
import Deal from '../src/models/Deal.model.js';

describe('8. REPORTS APIs (Admin/Manager Only)', () => {
    let users, adminToken, managerToken, salesUserId;
    const REPORT_DATE_RANGE = 'from=2025-11-01&to=2025-11-30';
    const TEST_DATE = new Date('2025-11-15T10:00:00.000Z');

    before(async () => {
        if (mongoose.connection.readyState !== 1) {
             await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test');
        }
    });

    beforeEach(async () => {
        users = await initializeTestData();
        adminToken = users.ADMIN.token;
        managerToken = users.MANAGER.token;
        salesUserId = users.SALES.userId;

        await Lead.deleteMany({});
        await Deal.deleteMany({});

        // --- Setup Test Data ---
        // 1. Leads Created in Range (FR-28)
        await Lead.create({ name: 'Lead 1', email: 'l1@test.com', status: 'new', assignedTo: salesUserId, createdAt: TEST_DATE });
        await Lead.create({ name: 'Lead 2', email: 'l2@test.com', status: 'new', assignedTo: salesUserId, createdAt: TEST_DATE });

        // 2. Deals Closed in Range (WON/LOST)
        // Deal 1: WON
        await Deal.create({
            lead: new mongoose.Types.ObjectId(), owner: salesUserId, title: 'Won Deal', 
            value: 100000, stage: 'WON', closedAt: TEST_DATE, closedReason: 'Approved'
        });
        // Deal 2: LOST (FR-33)
        await Deal.create({
            lead: new mongoose.Types.ObjectId(), owner: salesUserId, title: 'Lost Deal 1', 
            value: 20000, stage: 'LOST', closedAt: TEST_DATE, closedReason: 'Price too high'
        });
        // Deal 3: LOST (FR-33)
        await Deal.create({
            lead: new mongoose.Types.ObjectId(), owner: salesUserId, title: 'Lost Deal 2', 
            value: 10000, stage: 'LOST', closedAt: TEST_DATE, closedReason: 'Price too high'
        });

        // 3. Deals in Pipeline (Pipeline Value)
        await Deal.create({
            lead: new mongoose.Types.ObjectId(), owner: salesUserId, title: 'Pipeline 1', 
            value: 50000, stage: 'NEGOTIATION'
        });
        await Deal.create({
            lead: new mongoose.Types.ObjectId(), owner: salesUserId, title: 'Pipeline 2', 
            value: 30000, stage: 'PROPOSAL_SENT'
        });
    });

    // --- 8.1 GET /reports/overview ---
    describe('GET /api/reports/overview (FR-28, FR-29)', () => {
        it('should return overall KPIs for the date range', async () => {
            const res = await request(app)
                .get(`/api/reports/overview?${REPORT_DATE_RANGE}`)
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body.newLeads).to.equal(2);
            expect(res.body.wonDeals).to.equal(1);
            expect(res.body.lostDeals).to.equal(2);
            expect(res.body.pipelineValue).to.equal(80000); // 50k + 30k
            expect(res.body.wonValue).to.equal(100000);
        });
    });

    // --- 8.2 GET /reports/sales-performance ---
    describe('GET /api/reports/sales-performance (FR-30, FR-31)', () => {
        it('should return performance metrics per sales user', async () => {
            const res = await request(app)
                .get(`/api/reports/sales-performance?${REPORT_DATE_RANGE}`)
                .set('Authorization', `Bearer ${managerToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array');
            
            const salesReport = res.body.find(r => r.user._id === salesUserId);

            expect(salesReport.leadsAssigned).to.equal(2); 
            expect(salesReport.dealsWon).to.equal(1); 
            expect(salesReport.wonValue).to.equal(100000);
            // Conversion Rate: (1 won deal / 2 leads created) * 100 = 50.00
            expect(salesReport.conversionRate).to.equal(50.00); 
        });
    });

    // --- 8.3 GET /reports/conversion-rate ---
    describe('GET /api/reports/conversion-rate (FR-32)', () => {
        it('should return global conversion rate metrics', async () => {
            const res = await request(app)
                .get(`/api/reports/conversion-rate?${REPORT_DATE_RANGE}`)
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body.totalLeadsCreated).to.equal(2);
            expect(res.body.dealsWon).to.equal(1);
            expect(res.body.overallConversionRate).to.equal(50.00);
        });
    });

    // --- 8.4 GET /reports/lost-reasons ---
    describe('GET /api/reports/lost-reasons (FR-33)', () => {
        it('should aggregate and return counts for lost reasons', async () => {
            const res = await request(app)
                .get(`/api/reports/lost-reasons?${REPORT_DATE_RANGE}`)
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0].reason).to.equal('Price too high');
            expect(res.body[0].count).to.equal(2);
        });
    });

    // --- FR-34 Export Placeholder ---
    describe('GET /reports/export', () => {
        it('should return 501 (Not Implemented)', async () => {
            const res = await request(app)
                .get('/api/reports/export')
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(res.statusCode).to.equal(501);
        });
    });
});