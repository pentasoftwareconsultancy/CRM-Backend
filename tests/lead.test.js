import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';
import { initializeTestData } from './global.setup.js';
import mongoose from 'mongoose';
import Lead from '../src/models/Lead.model.js'; 
import fs from 'fs';
import path from 'path';

// Helper for Supertest path (since we need a dummy file)
const createDummyFile = () => {
    const filePath = path.join(process.cwd(), 'tests', 'dummy.csv');
    if (!fs.existsSync(path.join(process.cwd(), 'tests'))) {
        fs.mkdirSync(path.join(process.cwd(), 'tests'));
    }
    fs.writeFileSync(filePath, 'header1,header2\nvalue1,value2');
    return filePath;
};

const dummyFilePath = createDummyFile();


describe('3. LEADS APIs', () => {
    let users;
    let salesToken;
    let adminToken;
    let leadId;
    let salesUserId;

    const newLeadData = {
        name: 'John Doe',
        company: 'ABC Pvt Ltd',
        email: 'john@abc.com',
        phone: '9000000000',
        source: 'website',
        status: 'new',
        budget: 50000,
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
        adminToken = users.ADMIN.token;
        salesUserId = users.SALES.userId;
        
        await Lead.deleteMany({});
        
        // Create a base lead for retrieval/update tests
        const initialLead = {
            name: 'Initial Lead',
            company: 'Base Co',
            email: 'initial@lead.com',
            phone: '9999999999',
            status: 'new',
            assignedTo: salesUserId,
            source: 'referral'
        };

        const lead = new Lead(initialLead);
        await lead.save();
        leadId = lead._id.toString();
    });

    // --- 3.2 POST /leads ---
    describe('POST /api/leads', () => {
        it('should allow a Sales Executive to create a new lead (FR-6)', async () => {
            const res = await request(app)
                .post('/api/leads')
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ ...newLeadData, email: 'newunique@email.com' });
            
            expect(res.statusCode).to.equal(201);
            expect(res.body.lead).to.have.property('name', 'John Doe');
            expect(res.body.lead.status).to.equal('new');

            const count = await Lead.countDocuments({isDeleted: false});
            expect(count).to.equal(2);
        });

        it('should detect duplicate leads (FR-12)', async () => {
            const res = await request(app)
                .post('/api/leads')
                .set('Authorization', `Bearer ${salesToken}`)
                .send({ ...newLeadData, email: 'initial@lead.com' }); // Intentional duplicate email
            
            expect(res.statusCode).to.equal(409); // Conflict status
            expect(res.body).to.have.property('message', 'Lead with this email or phone already exists');
        });
    });

    // --- 3.1 GET /leads ---
    describe('GET /api/leads', () => {
        it('should fetch a list of leads with pagination and filters', async () => {
            const res = await request(app)
                .get(`/api/leads?limit=1&page=1&status=new&assignedTo=${salesUserId}`)
                .set('Authorization', `Bearer ${salesToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('data').that.is.an('array').with.lengthOf(1);
            expect(res.body).to.have.property('total');
            expect(res.body.data[0].assignedTo._id).to.equal(salesUserId);
        });
    });

    // --- 3.3 GET /leads/:id ---
    describe('GET /api/leads/:id', () => {
        it('should fetch full details of a specific lead', async () => {
            const res = await request(app)
                .get(`/api/leads/${leadId}`)
                .set('Authorization', `Bearer ${salesToken}`);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('_id', leadId);
        });
    });

    // --- 3.4 PUT /leads/:id ---
    describe('PUT /api/leads/:id', () => {
        it('should allow updating a lead (FR-8)', async () => {
            const update = { status: 'contacted', budget: 80000 };
            const res = await request(app)
                .put(`/api/leads/${leadId}`)
                .set('Authorization', `Bearer ${salesToken}`)
                .send(update);
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('message', 'Lead updated successfully');

            const updatedLead = await Lead.findById(leadId);
            expect(updatedLead.status).to.equal('contacted');
            expect(updatedLead.budget).to.equal(80000);
        });
    });

    // --- 3.5 DELETE /leads/:id ---
    describe('DELETE /api/leads/:id', () => {
        it('should soft-delete a lead (FR-8)', async () => {
            const res = await request(app)
                .delete(`/api/leads/${leadId}`)
                .set('Authorization', `Bearer ${adminToken}`); 
            
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('message', 'Lead deleted successfully');

            const deletedLead = await Lead.findById(leadId);
            expect(deletedLead.isDeleted).to.be.true; 
            
            // Should not appear in the general list
            const listRes = await request(app)
                .get(`/api/leads`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(listRes.body.total).to.equal(0);
        });
    });

    // --- 3.6 & 3.7 Import/Export Endpoints (Phase 2) ---
    describe('Import/Export Endpoints (Phase 2)', () => {
        it('should return 501 Not Implemented for import (placeholder)', async () => {
            const res = await request(app)
                .post('/api/leads/import')
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('file', dummyFilePath, 'dummy.csv'); // Use the dummy file
            
            // The file attachment request should now succeed and hit the controller.
            // Controller now implements import logic — assert it did not return 501.
            expect(res.statusCode).to.not.equal(501);
        });

        it('should return 501 Not Implemented for export (placeholder)', async () => {
            const res = await request(app)
                .get('/api/leads/export')
                .set('Authorization', `Bearer ${adminToken}`);
            // Controller now implements export — assert it did not return 501.
            expect(res.statusCode).to.not.equal(501);
        });
    });
});