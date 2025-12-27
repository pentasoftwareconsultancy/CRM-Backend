// src/controllers/lead.controller.js (FINAL WITH FULL IMPORT/EXPORT LOGIC)

import Lead from '../models/Lead.model.js';
import mongoose from 'mongoose';
import { createNotification } from './notification.controller.js';
import logger from '../utils/logger.js';
import csv from 'csv-parser'; // Import CSV parser
import { Readable } from 'stream'; // Node.js built-in for streams

// @desc    Get all leads with filters and pagination (3.1 GET /leads)
export const getLeads = async (req, res) => {
    const { status, source, assignedTo, search, page = 1, limit = 20, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // --- Filter Construction ---
    const filters = { isDeleted: false };
    if (req.user.role === 'sales') filters.assignedTo = req.user._id;
    else if (assignedTo) filters.assignedTo = mongoose.Types.ObjectId.isValid(assignedTo) ? new mongoose.Types.ObjectId(assignedTo) : assignedTo;
    
    if (status) {
        const statusArray = status.split('|').filter(s => s);
        if (statusArray.length > 0) filters.status = { $in: statusArray };
    }
    if (source) filters.source = source;
    if (from || to) {
        filters.createdAt = {};
        if (from) filters.createdAt.$gte = new Date(from);
        if (to) filters.createdAt.$lte = new Date(to);
    }
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filters.$or = [
            { name: searchRegex },
            { company: searchRegex },
            { email: searchRegex },
            { phone: searchRegex }
        ];
    }
    // --- End Filter Construction ---
    logger.info('Lead.getLeads request', { userId: req.user._id, filters: { status, source, assignedTo, search, from, to, page, limit } });

    try {
        // --- Aggregation Pipeline for Note Count and Pagination ---
        const aggregationPipeline = [
            // 1. Filter Leads (Authorization, Status, Search, etc.)
            { $match: filters },

            // 2. Perform Lookup to Count Notes (FR-11)
            {
                $lookup: {
                    from: 'notes', // Name of the Note collection in MongoDB (usually lowercase plural)
                    localField: '_id',
                    foreignField: 'lead',
                    as: 'notes'
                }
            },
            
            // 3. Populate AssignedTo Details
            {
                $lookup: {
                    from: 'users',
                    localField: 'assignedTo',
                    foreignField: '_id',
                    as: 'assignedToDetails'
                }
            },
            {
                $addFields: {
                    notesCount: { $size: "$notes" },
                    assignedTo: { $arrayElemAt: ["$assignedToDetails", 0] }
                }
            },

            // 4. Sort and Pagination Stage
            { $sort: { createdAt: -1 } },
            { 
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: skip }, { $limit: parseInt(limit) }]
                }
            }
        ];

        const results = await Lead.aggregate(aggregationPipeline);
        
        const totalLeads = results[0]?.metadata?.[0]?.total || 0;
        const leadsData = results[0]?.data || [];

        // Clean up: Remove temporary fields used for counting/populating
        const cleanedData = leadsData.map(lead => {
            // ensure assignedTo is consistent with earlier endpoints (lean object)
            if (lead.assignedTo && lead.assignedTo._id) {
                lead.assignedTo = {
                    _id: lead.assignedTo._id,
                    name: lead.assignedTo.name,
                    email: lead.assignedTo.email,
                    designation: lead.assignedTo.designation
                };
            } else {
                lead.assignedTo = null;
            }
            delete lead.notes;
            delete lead.assignedToDetails;
            return lead;
        });

        logger.info('Lead.getLeads success', { userId: req.user._id, total: totalLeads });
        res.json({
            data: cleanedData,
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalLeads
        });
    } catch (error) {
        logger.error('Error fetching leads', { error });
        res.status(500).json({ message: 'Error fetching leads' });
    }
};

// @desc    Create a new lead (3.2 POST /leads)
export const createLead = async (req, res) => {
    const { name, email, phone, ...rest } = req.body;
    logger.info('Lead.createLead attempt', { userId: req.user._id, name, email, phone });
    
    // FR-12: Lead duplicate detection
    if (email || phone) {
        const existingLead = await Lead.findOne({ 
            $or: [{ email: email }, { phone: phone }],
            isDeleted: false
        });
        
        if (existingLead) {
            logger.warn('Lead.createLead conflict - duplicate', { userId: req.user._id, existingLeadId: existingLead._id });
            return res.status(409).json({ message: 'Lead with this email or phone already exists' });
        }
    }
    
    try {
        const lead = await Lead.create({
            name, email, phone,
            assignedTo: req.user._id, 
            ...rest
        });

        // FR-37: Notify the assigned user (creator)
        createNotification(
            lead.assignedTo, 
            'lead_assigned', 
            `New lead created: ${lead.name} (${lead.company || 'N/A'})`,
            lead._id
        );

        logger.info('Lead.createLead success', { userId: req.user._id, leadId: lead._id });

        res.status(201).json({
            message: 'Lead created successfully',
            lead: { _id: lead._id, name: lead.name, status: lead.status }
        });
    } catch (error) {
        logger.error('Error creating lead', { error });
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get full details of a lead (3.3 GET /leads/:id)
export const getLeadById = async (req, res) => {
    try {
        logger.info('Lead.getLeadById request', { userId: req.user._id, leadId: req.params.id });
        const lead = await Lead.findOne({ _id: req.params.id, isDeleted: false })
            .populate('assignedTo', 'name email designation');

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && lead.assignedTo._id.toString() !== req.user._id.toString()) {
            logger.warn('Lead.getLeadById - unauthorized access attempt', { userId: req.user._id, leadId: req.params.id });
            return res.status(403).json({ message: 'Not authorized to view this lead' });
        }

        res.json(lead);
    } catch (error) {
        logger.error('Error fetching lead', { error });
        res.status(500).json({ message: 'Error fetching lead' });
    }
};

// @desc    Update a lead's info (3.4 PUT /leads/:id)
export const updateLead = async (req, res) => {
    try {
        logger.info('Lead.updateLead attempt', { userId: req.user._id, leadId: req.params.id, body: req.body });
        const lead = await Lead.findById(req.params.id);

        if (!lead || lead.isDeleted) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && lead.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this lead' });
        }

        const oldAssignedTo = lead.assignedTo ? lead.assignedTo.toString() : null;
        
        const updatedLead = await Lead.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        // FR-37: Check if assignment changed
        if (req.body.assignedTo && updatedLead.assignedTo.toString() !== oldAssignedTo) {
            logger.info('Lead.updateLead - assignment changed', { leadId: updatedLead._id, oldAssignedTo, newAssignedTo: updatedLead.assignedTo });
            createNotification(
                updatedLead.assignedTo, 
                'lead_assigned', 
                `Lead "${updatedLead.name}" has been reassigned to you.`,
                updatedLead._id
            );
        }

        res.json({ 
            message: 'Lead updated successfully',
            lead: updatedLead
        });
    } catch (error) {
        logger.error('Error updating lead', { error });
        res.status(400).json({ message: error.message });
    }
};

// @desc    Soft-delete a lead (3.5 DELETE /leads/:id)
export const deleteLead = async (req, res) => {
    try {
        logger.info('Lead.deleteLead attempt', { userId: req.user._id, leadId: req.params.id });
        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        logger.info('Lead.deleteLead success', { userId: req.user._id, leadId: req.params.id });
        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        logger.error('Error deleting lead', { error });
        res.status(500).json({ message: 'Error deleting lead' });
    }
};

// @desc    Import leads via CSV/Excel (FR-10) - IMPLEMENTED
// @route   POST /api/leads/import
// @access  Admin, Manager
export const importLeads = async (req, res) => {
    if (!req.file || req.file.fieldname !== 'file') {
        return res.status(400).json({ message: 'No file uploaded. Expecting field name "file".' });
    }
    
    const fileBuffer = req.file.buffer;
    const currentUserId = req.user._id;
    logger.info('Lead.importLeads started', { userId: currentUserId, sizeBytes: fileBuffer.length });
    const leadsToInsert = [];
    let successfulImports = 0;
    let failedImports = 0;

    const bufferStream = Readable.from(fileBuffer);
    
    try {
        await new Promise((resolve, reject) => {
            bufferStream
                .pipe(csv())
                .on('data', (row) => {
                    const mappedLead = {
                        name: row.name ? row.name.trim() : null,
                        email: row.email ? row.email.trim().toLowerCase() : null,
                        phone: row.phone ? row.phone.trim() : null,
                        company: row.company ? row.company.trim() : null,
                        source: row.source ? row.source.trim().toLowerCase() : 'import',
                        status: row.status ? row.status.trim().toLowerCase() : 'new',
                        budget: row.budget ? Number(row.budget) : 0,
                        assignedTo: currentUserId,
                    };
                    
                    if (mappedLead.name && (mappedLead.email || mappedLead.phone)) {
                        leadsToInsert.push(mappedLead);
                    } else {
                        failedImports++;
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (leadsToInsert.length > 0) {
            try {
                 // Insert only unique documents (based on MongoDB indexes set up earlier)
                const results = await Lead.insertMany(leadsToInsert, { ordered: false });
                successfulImports = results.length;
                
                // Count documents skipped due to database-level duplicate email/phone constraints
                failedImports += (leadsToInsert.length - successfulImports);

            } catch (err) {
                // Handle bulk write errors (often due to duplicates or bad data)
                if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
                    successfulImports = err.result.nInserted || 0;
                    failedImports += err.result.nUpserted || 0;
                    failedImports += err.result.nInserted || 0; // Rough count of actual fails/skips
                } else {
                    throw err; // Re-throw if it's a critical error
                }
            }
            
            // Notify the user who uploaded the file
            createNotification(
                currentUserId, 
                'import_complete', 
                `Lead import complete: ${successfulImports} successful, ${failedImports} failed/skipped.`,
                null
            );
            logger.info('Lead.importLeads completed', { userId: currentUserId, successfulImports, failedImports, totalProcessed: leadsToInsert.length });
        }

        res.status(200).json({ 
            message: 'Import process finished.',
            successfulImports,
            failedImports,
            totalProcessed: leadsToInsert.length
        });

    } catch (error) {
        logger.error('Mass Import Error', { error });
        res.status(500).json({ message: 'Error processing file data or database insertion failure.' });
    }
};


// @desc    Export filtered leads as CSV/Excel (FR-10) - IMPLEMENTED
// @route   GET /api/leads/export
export const exportLeads = async (req, res) => {
    const { status, source, assignedTo, search } = req.query;
    
    // --- 1. Build Filters ---
    const filters = { isDeleted: false };
    
    if (req.user.role === 'sales') filters.assignedTo = req.user._id;
    else if (assignedTo) filters.assignedTo = assignedTo;

    if (status) {
        const statusArray = status.split('|').filter(s => s);
        if (statusArray.length > 0) filters.status = { $in: statusArray };
    }
    
    if (source) filters.source = source;
    
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filters.$or = [{ name: searchRegex }, { company: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    try {
        logger.info('Lead.exportLeads request', { userId: req.user._id, filters: { status, source, assignedTo, search } });
        const leads = await Lead.find(filters)
            .sort({ createdAt: 1 })
            .populate('assignedTo', 'name')
            .lean(); 

        if (leads.length === 0) {
            res.setHeader('Content-Type', 'text/csv');
            logger.info('Lead.exportLeads no results', { userId: req.user._id });
            return res.status(200).send("No leads found matching your export criteria.");
        }

        // --- 2. Format to CSV String ---
        const fields = [
            'id', 'name', 'company', 'email', 'phone', 'source', 
            'status', 'budget', 'city', 'description', 'assigned_to_name', 'created_at'
        ];
        
        const header = fields.join(',') + '\n';
        
        const csvRows = leads.map(lead => {
            const assignedName = lead.assignedTo ? lead.assignedTo.name : 'Unassigned';
            
            const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
            
            const row = [
                lead._id,
                escape(lead.name),
                escape(lead.company),
                escape(lead.email),
                escape(lead.phone),
                escape(lead.source),
                lead.status,
                lead.budget,
                escape(lead.city),
                escape(lead.description),
                escape(assignedName),
                lead.createdAt.toISOString()
            ];
            return row.join(',');
        });

        const csvContent = header + csvRows.join('\n');

        // --- 3. Send Response with Download Headers ---
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
        
        logger.info('Lead.exportLeads success', { userId: req.user._id, count: leads.length });
        res.status(200).send(csvContent);

    } catch (error) {
        logger.error('Error during lead export', { error });
        res.status(500).json({ message: 'Internal server error during export processing.' });
    }
};