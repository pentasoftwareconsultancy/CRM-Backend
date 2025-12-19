import Lead from '../models/Lead.model.js';
import mongoose from 'mongoose';

// @desc    Get all leads with filters and pagination (3.1 GET /leads)
// @route   GET /api/leads
// @access  Authenticated (Sales, Manager, Admin)
// export const getLeads = async (req, res) => {
//     const { status, source, assignedTo, search, page = 1, limit = 20, from, to } = req.query;
//     const skip = (parseInt(page) - 1) * parseInt(limit);
    
//     // Base filter: exclude deleted leads
//     const filters = { isDeleted: false };
    
//     // Role-based access control for leads
//     if (req.user.role === 'sales') {
//         filters.assignedTo = req.user._id;
//     } else if (assignedTo) {
//         // Allows Managers/Admins to filter by any user
//         filters.assignedTo = assignedTo;
//     }

//     // Apply specific filters
//     if (status) filters.status = status;
//     if (source) filters.source = source;
    
//     // Apply date range filters (createdAt)
//     if (from || to) {
//         filters.createdAt = {};
//         if (from) filters.createdAt.$gte = new Date(from);
//         if (to) filters.createdAt.$lte = new Date(to);
//     }
    
//     // Search by name, company, email, or phone
//     if (search) {
//         const searchRegex = new RegExp(search, 'i');
//         filters.$or = [
//             { name: searchRegex },
//             { company: searchRegex },
//             { email: searchRegex },
//             { phone: searchRegex }
//         ];
//     }

//     try {
//         const totalLeads = await Lead.countDocuments(filters);
//         const leads = await Lead.find(filters)
//             .sort({ createdAt: -1 })
//             .skip(skip)
//             .limit(parseInt(limit))
//             .populate('assignedTo', 'name email designation'); // Include assigned user info

//         res.json({
//             data: leads,
//             page: parseInt(page),
//             limit: parseInt(limit),
//             total: totalLeads
//         });
//     } catch (error) {
//            console.error(error);
//         res.status(500).json({ message: 'Error fetching leads' });
//     }
// };


// ... other imports ...

// @desc    Get all leads with filters and pagination (3.1 GET /leads)
// @route   GET /api/leads
// @access  Authenticated (Sales, Manager, Admin)
export const getLeads = async (req, res) => {
    const { status, source, assignedTo, search, page = 1, limit = 20, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Base filter: exclude deleted leads
    const filters = { isDeleted: false };
    
    // Role-based access control for leads
    if (req.user.role === 'sales') {
        filters.assignedTo = req.user._id;
    } else if (assignedTo) {
        // Allows Managers/Admins to filter by any user
        filters.assignedTo = assignedTo;
    }

    // FIX START: Handle pipe-separated status list using $in
    if (status) {
        const statusArray = status.split('|').filter(s => s);
        if (statusArray.length > 0) {
            filters.status = { $in: statusArray };
        }
    }
    // FIX END
    
    if (source) filters.source = source;
    
    // ... (rest of the date and search filters remain the same) ...

    // Apply date range filters (createdAt)
    if (from || to) {
        filters.createdAt = {};
        if (from) filters.createdAt.$gte = new Date(from);
        if (to) filters.createdAt.$lte = new Date(to);
    }
    
    // Search by name, company, email, or phone
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        // Ensure $or respects other filters using $and
        const searchFilters = { 
            $or: [
                { name: searchRegex },
                { company: searchRegex },
                { email: searchRegex },
                { phone: searchRegex }
            ]
        };
        // Combine all filters using $and
        filters.$and = filters.$and || [];
        filters.$and.push(searchFilters);
        
        // If other filters exist, they must be moved under $and if $or is used
        // Since $and is complex to manage globally, let's simplify the combination:
        
        // If we have complex status/source filters, merging them with $or/$and 
        // in a flat structure is hard. We rely on the simple key:value merge for now,
        // which works well unless search is active.

        // Reverting the complex search merging for simplicity, sticking to common practice:
        if (Object.keys(filters).length > 1 || !filters.isDeleted) {
            // Complex scenario simplified for demonstration:
            // This is safer to implement robustly at a later phase if necessary.
        }
    }


    try {
        const totalLeads = await Lead.countDocuments(filters);
        const leads = await Lead.find(filters)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('assignedTo', 'name email designation'); // Include assigned user info

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
// @route   POST /api/leads
// @access  Authenticated (Sales, Manager, Admin)
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
// @route   GET /api/leads/:id
// @access  Authenticated (Assigned user, Manager, Admin)
export const getLeadById = async (req, res) => {
    try {
        const lead = await Lead.findOne({ _id: req.params.id, isDeleted: false })
            .populate('assignedTo', 'name email designation');

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        // Authorization check: User must be Admin, Manager, or the assigned user
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
// @route   PUT /api/leads/:id
// @access  Authenticated (Assigned user, Manager, Admin)
export const updateLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);

        if (!lead || lead.isDeleted) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        // Authorization check (same as GET)
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && lead.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this lead' });
        }

        const updatedLead = await Lead.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

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
// @route   DELETE /api/leads/:id
// @access  Admin, Manager
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

// Placeholders for Phase 2 implementation
export const importLeads = (req, res) => res.status(501).json({ message: 'Import API not implemented yet (Phase 2)' });
export const exportLeads = (req, res) => res.status(501).json({ message: 'Export API not implemented yet (Phase 2)' });