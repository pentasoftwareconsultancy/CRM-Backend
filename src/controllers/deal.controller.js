import Deal from '../models/Deal.model.js';
import Lead from '../models/Lead.model.js';
import { createCustomerFromDeal } from './customer.controller.js';
import mongoose from 'mongoose';

const DEAL_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];

// @desc    Get list of deals with filters (4.1 GET /deals)
// @route   GET /api/deals
// @access  Authenticated
export const getDeals = async (req, res) => {
    const { stage, owner, leadId } = req.query;
    const filters = {};

    // Role-based filtering
    if (req.user.role === 'sales') {
        filters.owner = req.user._id;
    } else if (owner) {
        filters.owner = owner;
    }

    // Specific filters
    if (stage) filters.stage = stage;
    if (leadId) filters.lead = leadId;

    try {
        const deals = await Deal.find(filters)
            .sort({ expectedCloseDate: 1 })
            .populate('lead', 'name company email phone status') // FR-15
            .populate('owner', 'name email');

        res.json(deals);
    } catch (error) {
           console.error(error);
        res.status(500).json({ message: 'Error fetching deals' });
    }
};

// @desc    Create a new deal (4.2 POST /deals)
// @route   POST /api/deals
// @access  Authenticated
export const createDeal = async (req, res) => {
    const { leadId, title, value, currency, stage, expectedCloseDate, owner } = req.body;

    // Authorization check for owner field (Only Admin/Manager can assign ownership)
    const dealOwner = (req.user.role === 'admin' || req.user.role === 'manager') && owner ? owner : req.user._id;

    try {
        // Ensure lead exists and is not deleted
        const lead = await Lead.findById(leadId);
        if (!lead || lead.isDeleted) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        const deal = await Deal.create({
            lead: leadId,
            owner: dealOwner,
            title,
            value,
            currency,
            stage: stage || 'NEW',
            expectedCloseDate
        });

        res.status(201).json({
            message: 'Deal created successfully',
            deal: { _id: deal._id, stage: deal.stage }
        });

    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get full deal detail (4.3 GET /deals/:id)
// @route   GET /api/deals/:id
// @access  Authenticated (Owner, Manager, Admin)
export const getDealById = async (req, res) => {
    try {
        const deal = await Deal.findById(req.params.id)
            .populate('lead', 'name company status')
            .populate('owner', 'name');

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

        // Authorization check
        if (req.user.role === 'sales' && deal.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this deal' });
        }

        res.json(deal);
    } catch (error) {
           console.error(error);
        res.status(500).json({ message: 'Error fetching deal' });
    }
};

// @desc    Update deal fields (4.4 PUT /deals/:id)
// @route   PUT /api/deals/:id
// @access  Authenticated (Owner, Manager, Admin)
export const updateDeal = async (req, res) => {
    try {
        const deal = await Deal.findById(req.params.id);

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

        // Authorization check (Sales can only update their own deals)
        if (req.user.role === 'sales' && deal.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this deal' });
        }

        const updatedDeal = await Deal.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json({
            message: 'Deal updated successfully',
            deal: updatedDeal
        });
    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update deal stage (4.5 PATCH /deals/:id/stage)
// @route   PATCH /api/deals/:id/stage
// @access  Authenticated (Owner, Manager, Admin)
export const updateDealStage = async (req, res) => {
    const { stage } = req.body;

    if (!DEAL_STAGES.includes(stage)) {
        return res.status(400).json({ message: 'Invalid deal stage provided.' });
    }

    try {
        const deal = await Deal.findById(req.params.id);

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

        // Authorization check
        if (req.user.role === 'sales' && deal.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this deal stage' });
        }

        // Prevent setting WON/LOST here; use the /close endpoint
        if (stage === 'WON' || stage === 'LOST') {
            return res.status(400).json({ message: 'Use the /close endpoint to finalize deals.' });
        }

        deal.stage = stage;
        await deal.save();

        res.json({
            message: 'Deal stage updated',
            deal: { _id: deal._id, stage: deal.stage }
        });
    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Close a deal as WON or LOST (4.6 PATCH /deals/:id/close)
// @route   PATCH /api/deals/:id/close
// @access  Authenticated (Owner, Manager, Admin)
export const closeDeal = async (req, res) => {
    const { status, reason } = req.body; // status must be 'WON' or 'LOST'

    if (!['WON', 'LOST'].includes(status) || !reason) {
        return res.status(400).json({ message: 'Status must be WON or LOST, and a reason is required.' });
    }

    try {
        const deal = await Deal.findById(req.params.id);

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

        // Authorization check
        if (req.user.role === 'sales' && deal.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to close this deal' });
        }

        // Update Deal fields
        deal.stage = status;
        deal.closedAt = new Date();
        deal.closedReason = reason;
        await deal.save();

        // FR-26: When a deal is marked "Won", convert lead to customer
        if (status === 'WON') {
            await Lead.findByIdAndUpdate(deal.lead, { status: 'converted' });

            // --- NEW: Internal call to create customer ---
            try {
                await createCustomerFromDeal(deal._id);
            } catch (customerError) {
                console.error("Error creating customer from won deal:", customerError.message);
                // Optionally continue or return a warning, but we mark the deal closed.
            }
        }

        res.json({
            message: 'Deal closed successfully',
            deal: { _id: deal._id, stage: deal.stage, closedAt: deal.closedAt }
        });
    } catch (error) {
           console.error(error);
        res.status(400).json({ message: error.message });
    }
};