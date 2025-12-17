import Lead from '../models/Lead.model.js';
import Deal from '../models/Deal.model.js';
import User from '../models/User.model.js';
import mongoose from 'mongoose';

const getFilterDates = (query) => {
    const { from, to } = query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);
    return dateFilter;
};

// @desc    Get system overview report (8.1 GET /reports/overview)
// @route   GET /api/reports/overview
// @access  Admin, Manager
export const getOverviewReport = async (req, res) => {
    const dateFilter = getFilterDates(req.query);

    try {
        const [
            totalLeads,
            newLeads,
            wonDealsCount,
            lostDealsCount,
            pipelineValue,
            wonValue
        ] = await Promise.all([
            Lead.countDocuments({ isDeleted: false }),
            Lead.countDocuments({ createdAt: dateFilter, isDeleted: false }),
            Deal.countDocuments({ stage: 'WON', closedAt: dateFilter }),
            Deal.countDocuments({ stage: 'LOST', closedAt: dateFilter }),
            Deal.aggregate([
                { $match: { stage: { $nin: ['WON', 'LOST'] } } },
                { $group: { _id: null, total: { $sum: '$value' } } }
            ]),
            Deal.aggregate([
                { $match: { stage: 'WON', closedAt: dateFilter } },
                { $group: { _id: null, total: { $sum: '$value' } } }
            ])
        ]);

        res.json({
            totalLeads: totalLeads,
            newLeads: newLeads,
            wonDeals: wonDealsCount,
            lostDeals: lostDealsCount,
            pipelineValue: pipelineValue[0] ? pipelineValue[0].total : 0,
            wonValue: wonValue[0] ? wonValue[0].total : 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating overview report' });
    }
};

// @desc    Get sales performance report (8.2 GET /reports/sales-performance)
// @route   GET /api/reports/sales-performance
// @access  Admin, Manager
export const getSalesPerformanceReport = async (req, res) => {
    const dateFilter = getFilterDates(req.query);

    try {
        const salesUsers = await User.find({ role: 'sales', status: 'active' }).select('_id name');
        
        const performancePromises = salesUsers.map(async (user) => {
            const userId = user._id;

            const leadsAssigned = await Lead.countDocuments({ assignedTo: userId, createdAt: dateFilter, isDeleted: false });
            const dealsWon = await Deal.countDocuments({ owner: userId, stage: 'WON', closedAt: dateFilter });
            const wonValueAggregation = await Deal.aggregate([
                { $match: { owner: userId, stage: 'WON', closedAt: dateFilter } },
                { $group: { _id: null, total: { $sum: '$value' } } }
            ]);

            const wonValue = wonValueAggregation[0] ? wonValueAggregation[0].total : 0;
            const conversionRate = leadsAssigned > 0 ? ((dealsWon / leadsAssigned) * 100).toFixed(2) : 0;

            return {
                user: { _id: userId, name: user.name },
                leadsAssigned,
                dealsWon,
                wonValue,
                conversionRate: parseFloat(conversionRate)
            };
        });

        const results = await Promise.all(performancePromises);
        res.json(results);

    } catch (error) {
        res.status(500).json({ message: 'Error generating sales performance report' });
    }
};

// @desc    Get global conversion metrics (8.3 GET /reports/conversion-rate)
// @route   GET /api/reports/conversion-rate
// @access  Admin, Manager
export const getConversionRateReport = async (req, res) => {
    const dateFilter = getFilterDates(req.query);

    try {
        const totalLeadsCreated = await Lead.countDocuments({ createdAt: dateFilter, isDeleted: false });
        const dealsWon = await Deal.countDocuments({ stage: 'WON', closedAt: dateFilter });
        const dealsLost = await Deal.countDocuments({ stage: 'LOST', closedAt: dateFilter });
        
        const overallConversionRate = totalLeadsCreated > 0 ? ((dealsWon / totalLeadsCreated) * 100).toFixed(2) : 0;

        res.json({
            totalLeadsCreated,
            dealsWon,
            dealsLost,
            overallConversionRate: parseFloat(overallConversionRate)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating conversion report' });
    }
};

// @desc    Get lost lead reason analytics (8.4 GET /reports/lost-reasons)
// @route   GET /api/reports/lost-reasons
// @access  Admin, Manager
export const getLostReasonsReport = async (req, res) => {
    const dateFilter = getFilterDates(req.query);

    try {
        const reasons = await Deal.aggregate([
            { $match: { stage: 'LOST', closedAt: dateFilter, closedReason: { $ne: null } } },
            { $group: { _id: '$closedReason', count: { $sum: 1 } } },
            { $project: { _id: 0, reason: '$_id', count: 1 } },
            { $sort: { count: -1 } }
        ]);

        res.json(reasons);
    } catch (error) {
        res.status(500).json({ message: 'Error generating lost reasons report' });
    }
};

// Placeholder for Export Report (FR-34)
export const exportReport = (req, res) => res.status(501).json({ message: 'Export Report API not implemented yet (Phase 2)' });