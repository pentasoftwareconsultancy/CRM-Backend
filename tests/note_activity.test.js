// tests/note_activity.test.js (MIGRATED TO SUPERTEST)

import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import { initializeTestData } from './global.setup.js';
import mongoose from 'mongoose';
import Lead from '../src/models/Lead.model.js';
import Note from '../src/models/Note.model.js'; 

describe('6. NOTES & ACTIVITIES APIs', () => {
    let users, salesToken, leadId, noteId, salesUserId;

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
        await Note.deleteMany({});

        const lead = await Lead.create({
            name: 'Activity Lead', email: 'activity@test.com', phone: '3333333333',
            status: 'new', assignedTo: salesUserId, source: 'website'
        });
        leadId = lead._id.toString();
        
        const note = await Note.create({
            lead: leadId, content: 'Initial note added by sales', user: salesUserId
        });
        noteId = note._id.toString();
    });

    // --- 6.1 POST /leads/:leadId/notes ---
    describe('POST /api/leads/:leadId/notes', () => {
        it('should allow adding a new note to a lead (FR-23)', async () => {
            const res = await request(app)
                .post(`/api/leads/${leadId}/notes`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ content: 'Client requested revised pricing.' });
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(201);
            expect(res.body.note.content).to.include('revised pricing');

            const count = await Note.countDocuments();
            expect(count).to.equal(2);
        });
    });

    // --- 6.2 GET /leads/:leadId/notes ---
    describe('GET /api/leads/:leadId/notes', () => {
        it('should return all notes for that lead', async () => {
            const res = await request(app)
                .get(`/api/leads/${leadId}/notes`)
                .set('Authorization', `Bearer ${salesToken}`);
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0]._id).to.equal(noteId);
        });
    });

    // --- 6.3 DELETE /notes/:id ---
    describe('DELETE /api/notes/:id', () => {
        it('should allow the owner or admin to delete a note', async () => {
            const res = await request(app)
                .delete(`/api/notes/${noteId}`)
                .set('Authorization', `Bearer ${salesToken}`); 
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(200);

            const count = await Note.countDocuments();
            expect(count).to.equal(0);
        });
    });

    // --- 6.4 GET /leads/:leadId/activities ---
    describe('GET /api/leads/:leadId/activities (FR-25)', () => {
        it('should fetch the full activity timeline', async () => {
            const res = await request(app)
                .get(`/api/leads/${leadId}/activities`)
                .set('Authorization', `Bearer ${salesToken}`);
            
            // FIX: Use res.statusCode
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array');
            // At least one activity (the lead creation) should exist.
            expect(res.body.length).to.be.at.least(1);
        });
    });
});