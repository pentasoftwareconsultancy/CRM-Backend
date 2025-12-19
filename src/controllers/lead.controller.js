// src/controllers/lead.controller.js (FINAL WITH NOTIFICATIONS AND EXPORT)

import Lead from '../models/Lead.model.js';
import mongoose from 'mongoose';
import { createNotification } from './notification.controller.js'; // <-- CRITICAL IMPORT

// @desc    Get all leads with filters and pagination (3.1 GET /leads)
// @route   GET /api/leads
// @access  Authenticated (Sales, Manager, Admin)
export const getLeads = async (req, res) => {
    const { status, source, assignedTo, search, page = 1, limit = 20, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const filters = { isDeleted: false };
    
    if (req.user.role === 'sales') {
        filters.assignedTo = req.user._id;
    } else if (assignedTo) {
        filters.assignedTo = assignedTo;
    }

    // Handle pipe-separated status list using $in
    if (status) {
        const statusArray = status.split('|').filter(s => s);
        if (statusArray.length > 0) {
            filters.status = { $in: statusArray };
        }
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

    try {
        const totalLeads = await Lead.countDocuments(filters);
        const leads = await Lead.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('assignedTo', 'name email designation');

        res.json({
            data: leads,
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalLeads
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching leads' });
    }
};

// @desc    Create a new lead (3.2 POST /leads)
export const createLead = async (req, res) => {
    const { name, email, phone, ...rest } = req.body;
    
    // FR-12: Lead duplicate detection
    if (email || phone) {
        const existingLead = await Lead.findOne({ 
            $or: [{ email: email }, { phone: phone }],
            isDeleted: false
        });
        
        if (existingLead) {
            return res.status(409).json({ message: 'Lead with this email or phone already exists' });
        }
    }
    
    try {
        const lead = await Lead.create({
            name, email, phone,
            assignedTo: req.user._id, // Default assigned to the creator
            ...rest
        });

        // FR-37: Notify the assigned user (creator)
        createNotification(
            lead.assignedTo, 
            'lead_assigned', 
            `New lead created: ${lead.name} (${lead.company || 'N/A'})`,
            lead._id
        );

        res.status(201).json({
            message: 'Lead created successfully',
            lead: { _id: lead._id, name: lead.name, status: lead.status }
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get full details of a lead (3.3 GET /leads/:id)
export const getLeadById = async (req, res) => {
    try {
        const lead = await Lead.findOne({ _id: req.params.id, isDeleted: false })
            .populate('assignedTo', 'name email designation');

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && lead.assignedTo._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this lead' });
        }

        res.json(lead);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching lead' });
    }
};

// @desc    Update a lead's info (3.4 PUT /leads/:id)
export const updateLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);

        if (!lead || lead.isDeleted) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && lead.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this lead' });
        }

        // Save old owner ID for comparison
        const oldAssignedTo = lead.assignedTo ? lead.assignedTo.toString() : null;
        
        const updatedLead = await Lead.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        // FR-37: Check if assignment changed
        if (req.body.assignedTo && updatedLead.assignedTo.toString() !== oldAssignedTo) {
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
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Soft-delete a lead (3.5 DELETE /leads/:id)
export const deleteLead = async (req, res) => {
    try {
        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting lead' });
    }
};

// Placeholder for Import Leads (KEEPING 501 for now)
export const importLeads = (req, res) => res.status(501).json({ message: 'Import API not implemented yet (Phase 2)' });


// @desc    Export filtered leads as CSV/Excel (FR-10) - IMPLEMENTED
// @route   GET /api/leads/export
export const exportLeads = async (req, res) => {
    const { status, source, assignedTo, search } = req.query;
    
    // --- 1. Build Filters (from getLeads) ---
    const filters = { isDeleted: false };
    
    if (req.user.role === 'sales') {
        filters.assignedTo = req.user._id;
    } else if (assignedTo) {
        filters.assignedTo = assignedTo;
    }

    if (status) {
        const statusArray = status.split('|').filter(s => s);
        if (statusArray.length > 0) filters.status = { $in: statusArray };
    }
    
    if (source) filters.source = source;
    
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filters.$or = [{ name: searchRegex }, { company: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }
    // --- End Filter Building ---

    try {
        // Fetch data
        const leads = await Lead.find(filters)
            .sort({ createdAt: 1 })
            .populate('assignedTo', 'name')
            .lean(); 

        if (leads.length === 0) {
            // Returning 200 with no content or a friendly message is better for CSV export than 404
            res.setHeader('Content-Type', 'text/csv');
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
            
            // Map values, wrapping strings with quotes and escaping internal quotes
            const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
            
            const row = [
                lead._id,
                escape(lead.name),
                escape(lead.company),
                escape(lead.email),
                escape(lead.phone),
                escape(lead.source),
                escape(lead.status),
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
        
        res.status(200).send(csvContent);

    } catch (error) {
        console.error("Error during lead export:", error);
        // This is the functional error return for the frontend to catch:
        res.status(500).json({ message: 'Internal server error during export processing.' });
    }
};