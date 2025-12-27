// tests/deal.test.js (Final Corrected Version)

import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import { initializeTestData } from './global.setup.js';
import mongoose from 'mongoose';
import Lead from '../src/models/Lead.model.js';
import Deal from '../src/models/Deal.model.js'; 

describe('4. DEALS / PIPELINE APIs', () => {
    let users, salesToken, leadId, dealId, salesUserId;

    const DEAL_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];

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
        await Deal.deleteMany({});

        // Setup a qualified lead
        const lead = await Lead.create({
            name: 'Pipeline Client', email: 'pipeline@test.com', phone: '1111111111', company: 'Pipeline Co',
            status: 'qualified', assignedTo: salesUserId, source: 'referral'
        });
        leadId = lead._id.toString();

        // Setup a base deal
        const deal = await Deal.create({
            lead: leadId, owner: salesUserId, title: 'Project Alpha', 
            value: 75000, stage: 'NEW', expectedCloseDate: '2025-12-10'
        });
        dealId = deal._id.toString();
    });

    // --- 4.2 POST /deals ---
    describe('POST /api/deals', () => {
        it('should allow creating a new deal linked to a lead', async () => {
            const res = await request(app)
                .post('/api/deals')
                .set('Authorization', `Bearer ${salesToken}`)
                .send({
                    leadId: leadId,
                    title: 'New Deal Beta',
                    value: 100000,
                    currency: 'INR',
                    stage: 'CONTACTED',
                    owner: salesUserId
                });
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(201);
            expect(res.body.deal).to.have.property('stage', 'CONTACTED');

            const count = await Deal.countDocuments();
            expect(count).to.equal(2);
        });
    });
    
    // --- 4.1 GET /deals ---
    describe('GET /api/deals', () => {
        it('should fetch deals and allow filtering by stage and owner', async () => {
            const res = await request(app)
                .get(`/api/deals?stage=NEW&owner=${salesUserId}`)
                .set('Authorization', `Bearer ${salesToken}`);
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0].title).to.equal('Project Alpha');
        });
    });
    
    // --- 4.5 PATCH /deals/:id/stage (Pipeline Movement) ---
    describe('PATCH /api/deals/:id/stage', () => {
        it('should update the deal stage (drag-and-drop)', async () => {
            const res = await request(app)
                .patch(`/api/deals/${dealId}/stage`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ stage: 'NEGOTIATION' });
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body.deal.stage).to.equal('NEGOTIATION');

            const updatedDeal = await Deal.findById(dealId);
            expect(updatedDeal.stage).to.equal('NEGOTIATION');
        });

        it('should return 400 if stage is invalid', async () => {
            const res = await request(app)
                .patch(`/api/deals/${dealId}/stage`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ stage: 'INVALID_STAGE' });
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(400);
        });
    });

    // --- 4.6 PATCH /deals/:id/close (Won/Lost) ---
    describe('PATCH /api/deals/:id/close', () => {
        it('should close the deal as WON and set closedAt (FR-26)', async () => {
            const res = await request(app)
                .patch(`/api/deals/${dealId}/close`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ status: 'WON', reason: 'Approved proposal' });
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body.deal.stage).to.equal('WON');
            expect(res.body.deal).to.have.property('closedAt');
            
            // Check that the linked lead status is also updated (converted/won)
            const updatedLead = await Lead.findById(leadId);
            expect(updatedLead.status).to.equal('converted'); 
        });

        it('should close the deal as LOST and record the reason (FR-16)', async () => {
            const reason = 'Price too high, picked competitor';
            const res = await request(app)
                .patch(`/api/deals/${dealId}/close`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ status: 'LOST', reason });
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body.deal.stage).to.equal('LOST');
            
            const updatedDeal = await Deal.findById(dealId);
            expect(updatedDeal.closedReason).to.equal(reason); 
        });
    });
});