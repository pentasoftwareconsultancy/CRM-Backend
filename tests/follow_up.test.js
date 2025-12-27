// tests/follow_up.test.js (MIGRATED TO SUPERTEST)

import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import { initializeTestData } from './global.setup.js';
import mongoose from 'mongoose';
import Lead from '../src/models/Lead.model.js';
import FollowUp from '../src/models/FollowUp.model.js'; 

describe('5. FOLLOW-UP APIs', () => {
    let users, salesToken, leadId, followUpId, salesUserId;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduledAt = tomorrow.toISOString().split('.')[0] + 'Z';

    const followUpData = {
        type: 'call',
        scheduledAt: scheduledAt,
        note: 'Initial contact call',
        assignedTo: null 
    };

    before(async () => {
        if (mongoose.connection.readyState !== 1) {
             await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test');
        }
    });

    beforeEach(async () => {
        users = await initializeTestData();
        salesToken = users.SALES.token;
        salesUserId = users.SALES.userId;

        await Lead.deleteMany({});
        await FollowUp.deleteMany({});

        const lead = await Lead.create({
            name: 'FollowUp Lead', email: 'followup@test.com', phone: '2222222222', company: 'FollowUp Co',
            status: 'new', assignedTo: salesUserId, source: 'website'
        });
        leadId = lead._id.toString();
        
        followUpData.assignedTo = salesUserId;
        const followup = await FollowUp.create({...followUpData, lead: leadId});
        followUpId = followup._id.toString();
    });

    // --- 5.1 POST /leads/:leadId/followups ---
    describe('POST /api/leads/:leadId/followups', () => {
        it('should allow scheduling a new follow-up', async () => {
            const res = await request(app)
                .post(`/api/leads/${leadId}/followups`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ ...followUpData, type: 'email' });
            
            expect(res.statusCode).to.equal(201);
            expect(res.body.followup.status).to.equal('pending');
            expect(res.body.message).to.include('created successfully');
        });
    });

    // --- 5.2 GET /leads/:leadId/followups ---
    describe('GET /api/leads/:leadId/followups', () => {
        it('should get all follow-ups for a specific lead (FR-20)', async () => {
            const res = await request(app)
                .get(`/api/leads/${leadId}/followups`)
                .set('Authorization', `Bearer ${salesToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0].type).to.equal('call');
        });
    });

    // --- 5.3 GET /followups ---
    describe('GET /api/followups', () => {
        it('should get all pending follow-ups assigned to the user', async () => {
            const res = await request(app)
                .get(`/api/followups?status=pending`)
                .set('Authorization', `Bearer ${salesToken}`);
            expect(res.statusCode).to.equal(200);
            // controller may return paginated object { data, page, ... }
            const body = res.body.data || res.body;
            expect(body).to.be.an('array').with.lengthOf(1);
        });
    });

    // --- 5.4 PATCH /followups/:id/complete ---
    describe('PATCH /api/followups/:id/complete', () => {
        it('should mark a follow-up as completed and optionally schedule the next one', async () => {
            const nextScheduledAt = new Date().toISOString().split('.')[0] + 'Z';

            const res = await request(app)
                .patch(`/api/followups/${followUpId}/complete`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ 
                    result: 'Call successful, next meeting needed.',
                    nextFollowup: {
                        scheduledAt: nextScheduledAt,
                        note: 'Schedule meeting with CEO'
                    }
                });
            
            expect(res.statusCode).to.equal(200);
            expect(res.body.message).to.equal('Follow-up updated successfully');
        });
    });
});