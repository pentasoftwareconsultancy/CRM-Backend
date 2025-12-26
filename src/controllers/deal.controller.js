// src/controllers/deal.controller.js

import Deal from '../models/Deal.model.js';
import Lead from '../models/Lead.model.js';
import { createCustomerFromDeal } from './customer.controller.js';
import mongoose from 'mongoose';
import { createNotification } from './notification.controller.js'; // <-- CRITICAL IMPORT

const DEAL_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];

// @desc    Get list of deals with filters (4.1 GET /deals)
export const getDeals = async (req, res) => {
    const { stage, owner, leadId } = req.query;
    const filters = {};

    if (req.user.role === 'sales') {
        filters.owner = req.user._id;
    } else if (owner) {
        filters.owner = owner;
    }

    if (stage) filters.stage = stage;
    if (leadId) filters.lead = leadId;

    try {
        const deals = await Deal.find(filters)
            .sort({ expectedCloseDate: 1 })
            .populate('lead', 'name company email phone status website') // Added website
            .populate('owner', 'name email');

        res.json(deals);
    } catch (error) {
           console.error(error);
        res.status(500).json({ message: 'Error fetching deals' });
    }
};

// @desc    Create a new deal (4.2 POST /deals)
export const createDeal = async (req, res) => {
    const { leadId, title, value, currency, stage, expectedCloseDate, owner } = req.body;

    const dealOwner = (req.user.role === 'admin' || req.user.role === 'manager') && owner ? owner : req.user._id;

    try {
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

        // FR-38: Notify the owner that a new deal was created
        createNotification(
            deal.owner, 
            'deal_created', 
            `New deal "${deal.title}" created for lead ${lead.company || lead.name}.`,
            deal._id
        );

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
// ... (getDealById remains the same) ...
export const getDealById = async (req, res) => {
    try {
        const deal = await Deal.findById(req.params.id)
            .populate('lead', 'name company status')
            .populate('owner', 'name');

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

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
// ... (updateDeal remains the same) ...
export const updateDeal = async (req, res) => {
    try {
        const deal = await Deal.findById(req.params.id);

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

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
export const updateDealStage = async (req, res) => {
    const { stage } = req.body;

    if (!DEAL_STAGES.includes(stage)) {
        return res.status(400).json({ message: 'Invalid deal stage provided.' });
    }

    try {
        const deal = await Deal.findById(req.params.id).populate('owner', 'name'); 

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

        if (req.user.role === 'sales' && deal.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this deal stage' });
        }
        
        const oldStage = deal.stage;

        if (stage === 'WON' || stage === 'LOST') {
            return res.status(400).json({ message: 'Use the /close endpoint to finalize deals.' });
        }

        deal.stage = stage;
        await deal.save();

        // FR-38: Notify the owner of the stage change
        if (oldStage !== stage) {
            createNotification(
                deal.owner._id, 
                'stage_alert', 
                `Deal "${deal.title}" moved from ${oldStage} to ${stage.replace(/_/g, ' ')}.`,
                deal._id
            );
        }

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
export const closeDeal = async (req, res) => {
    const { status, reason } = req.body; 

    // Validation Check
    if (!['WON', 'LOST'].includes(status)) {
        return res.status(400).json({ message: 'Status must be WON or LOST.' });
    }
    if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ message: 'A descriptive reason (min 3 characters) is required to close a deal.' });
    }

    try {
        const deal = await Deal.findById(req.params.id).populate('owner', 'name'); 

        if (!deal) {
            return res.status(404).json({ message: 'Deal not found' });
        }

        if (req.user.role === 'sales' && deal.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to close this deal' });
        }

        // Update Deal fields
        deal.stage = status;
        deal.closedAt = new Date();
        deal.closedReason = reason;
        await deal.save();

        // FR-38: Notify the owner that the deal has been finalized
        createNotification(
            deal.owner._id, 
            'deal_closed', 
            `Deal "${deal.title}" was closed as ${status}. Reason: ${reason}`,
            deal._id
        );

        // FR-26: When a deal is marked "Won", convert lead to customer
        if (status === 'WON') {
            await Lead.findByIdAndUpdate(deal.lead, { status: 'converted' });
            try {
                await createCustomerFromDeal(deal._id);
            } catch (customerError) {
                console.error("Error creating customer from won deal:", customerError.message);
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