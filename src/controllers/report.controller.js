// src/controllers/report.controller.js (FINAL)

import Lead from '../models/Lead.model.js';
import Deal from '../models/Deal.model.js';
import User from '../models/User.model.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const getDateDaysAgo = (days) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

const getFilterDates = (query = {}) => {
    // If caller provides explicit from/to, use that as Current Period (CP)
    if (query.from && query.to) {
        const from = new Date(query.from);
        const to = new Date(query.to);

        // Normalize to start/end of day in UTC to be inclusive
        from.setUTCHours(0, 0, 0, 0);
        to.setUTCHours(23, 59, 59, 999);

        const periodLen = to.getTime() - from.getTime();

        const ppEnd = new Date(from.getTime() - 1);
        const ppStart = new Date(ppEnd.getTime() - periodLen);

        return {
            CP: { $gte: from, $lte: to },
            PP: { $gte: ppStart, $lte: ppEnd }
        };
    }

    const now = new Date();
    // Default: Current Period (CP) = last 30 days
    const cpStart = getDateDaysAgo(30);
    const cpEnd = new Date(now);
    cpEnd.setUTCHours(23, 59, 59, 999); // Include the full current day in UTC

    // Previous Period (PP): 30 days before CP
    const ppStart = getDateDaysAgo(60);
    const ppEnd = new Date(getDateDaysAgo(30));
    ppEnd.setUTCHours(23, 59, 59, 999); // Include the full day in UTC

    return {
        CP: { $gte: cpStart, $lte: cpEnd },
        PP: { $gte: ppStart, $lte: ppEnd }
    };
};

/**
 * Helper to fetch key metrics for a given date range.
 */
const getPeriodStats = async (periodFilter, userFilter = {}) => {

    // For leads, we check creation date and apply user filter
    const leadsCreated = await Lead.countDocuments({ 
        createdAt: periodFilter, 
        isDeleted: false,
        ...userFilter 
    });

    // For deals, we check closedAt date and apply owner filter for sales users
    const dealFilter = { closedAt: periodFilter };
    if (userFilter.assignedTo) {
        // For sales users, filter deals by owner (since deals are owned by sales users)
        dealFilter.owner = userFilter.assignedTo;
    }

    const dealsWon = await Deal.countDocuments({ stage: 'WON', ...dealFilter });
    const dealsLost = await Deal.countDocuments({ stage: 'LOST', ...dealFilter });
    const dealsCancelled = await Deal.countDocuments({ stage: 'CANCELLED', ...dealFilter });

    const wonValueAggregation = await Deal.aggregate([
        { $match: { stage: 'WON', ...dealFilter } },
        { $group: { _id: null, total: { $sum: '$value' } } }
    ]);

    const totalClosed = dealsWon + dealsLost + dealsCancelled;
    const winRate = totalClosed > 0 ? ((dealsWon / totalClosed) * 100).toFixed(1) : 0;

    return {
        leadsCreated,
        wonDeals: dealsWon,
        lostDeals: dealsLost,
        cancelledDeals: dealsCancelled,
        wonValue: wonValueAggregation[0] ? wonValueAggregation[0].total : 0,
        winRate: parseFloat(winRate)
    };
};


// @desc    Get system overview report (8.1 GET /reports/overview)
// @route   GET /api/reports/overview
// @access  Admin, Manager
export const getOverviewReport = async (req, res) => {
    const { CP, PP } = getFilterDates(req.query);

    // Apply user-specific filters for sales users
    const userFilter = req.user.role === 'sales' ? { assignedTo: req.user._id } : {};

    try {
        const [
            totalLeadsCount,
            pipelineValueResult,
            currentStats,
            previousStats
        ] = await Promise.all([
            // 1. Total Leads (Cumulative) - filter by user for sales
            Lead.countDocuments({ isDeleted: false, ...userFilter }),

            // 2. Current Open Pipeline Value (Cumulative, no time filter needed on this aggregate)
            // Filter deals by owner for sales users
            Deal.aggregate([
                { $match: { 
                    stage: { $nin: ['WON', 'LOST', 'CANCELLED'] },
                    ...(req.user.role === 'sales' ? { owner: req.user._id } : {})
                } },
                { $group: { _id: null, total: { $sum: '$value' } } }
            ]),

            // 3. Current Period (CP) Stats - pass user filter
            getPeriodStats(CP, userFilter),

            // 4. Previous Period (PP) Stats - pass user filter
            getPeriodStats(PP, userFilter)
        ]);

        const pipelineValue = pipelineValueResult[0] ? pipelineValueResult[0].total : 0;

        res.json({
            // Base Cumulative Data
            totalLeads: totalLeadsCount,
            pipelineValue: pipelineValue,

            // Current Period Data (for display)
            newLeads: currentStats.leadsCreated,
            wonDeals: currentStats.wonDeals,
            lostDeals: currentStats.lostDeals,
            cancelledDeals: currentStats.cancelledDeals,
            wonValue: currentStats.wonValue,
            winRate: currentStats.winRate,

            // Previous Period Data (for comparison trends)
            prevWonValue: previousStats.wonValue,
            prevLeads: previousStats.leadsCreated,
            prevWinRate: previousStats.winRate
        });
    } catch (error) {
        logger.error('Error generating overview report', { error });
        res.status(500).json({ message: 'Error generating overview report' });
    }
};

// @desc    Get weekly sales performance data (Revenue & Leads by day)
// @route   GET /api/reports/weekly-performance
export const getWeeklyPerformanceReport = async (req, res) => {
    const sevenDaysAgo = getDateDaysAgo(7);

    try {
        // For sales users, filter by their assigned leads and owned deals
        const leadFilter = req.user.role === 'sales' ? { assignedTo: req.user._id, isDeleted: false } : { isDeleted: false };
        const dealFilter = req.user.role === 'sales' ? { owner: req.user._id, stage: 'WON' } : { stage: 'WON' };

        // Get daily leads count
        const dailyLeads = await Lead.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo },
                    ...leadFilter
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    leads: { $sum: 1 }
                }
            }
        ]);

        // Get daily revenue from won deals
        const dailyRevenue = await Deal.aggregate([
            {
                $match: {
                    closedAt: { $gte: sevenDaysAgo },
                    ...dealFilter
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$closedAt" } },
                    sales: { $sum: "$value" }
                }
            }
        ]);

        // --- Merge and Format for 7 Days ---
        const revenueMap = new Map(dailyRevenue.map(item => [item._id, item.sales]));
        const leadsMap = new Map(dailyLeads.map(item => [item._id, item.leads]));

        const output = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 6; i >= 0; i--) {
            const date = getDateDaysAgo(i);
            const dateStr = date.toISOString().slice(0, 10);

            output.push({
                name: dayNames[date.getUTCDay()],
                date: dateStr,
                sales: revenueMap.get(dateStr) || 0,
                leads: leadsMap.get(dateStr) || 0,
            });
        }

        res.json(output);

    } catch (error) {
        logger.error('Error generating weekly performance report', { error });
        res.status(500).json({ message: 'Error generating weekly performance report' });
    }
};


// @desc    Get sales performance report (8.2 GET /reports/sales-performance)
// ... (Logic remains the same, relying on getFilterDates helper) ...
export const getSalesPerformanceReport = async (req, res) => {
    // Respect explicit from/to query params when provided
    const { CP } = getFilterDates(req.query);
    const useDateFilter = Boolean(req.query.from || req.query.to);
    const leadsQuery = useDateFilter ? { createdAt: CP, isDeleted: false } : { isDeleted: false };
    const closedAtQuery = useDateFilter ? { closedAt: CP } : {};

    try {
        // For sales users, only show their own performance
        // For managers/admins, show all users' performance
        const usersToQuery = req.user.role === 'sales' 
            ? [{ _id: req.user._id, name: req.user.name }]
            : await User.find({ status: 'active' }).select('_id name');

        const performancePromises = usersToQuery.map(async (user) => {
            const userId = user._id;

            const leadsAssigned = await Lead.countDocuments({ assignedTo: userId, ...leadsQuery });
            const dealsWon = await Deal.countDocuments({ owner: userId, stage: 'WON', ...closedAtQuery });

            const wonValueAggregation = await Deal.aggregate([
                { $match: { owner: userId, stage: 'WON', ...closedAtQuery } },
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
        logger.error('Error generating sales performance report', { error });
        res.status(500).json({ message: 'Error generating sales performance report' });
    }
};

// ... (getConversionRateReport, getLostReasonsReport, exportReport remain the same) ...

const buildQuery = (baseFilters, dateFilter) => {
    const query = { ...baseFilters };
    if (Object.keys(dateFilter).length > 0) {
        query.createdAt = dateFilter;
    }
    return query;
};

export const getConversionRateReport = async (req, res) => {
    const useDateFilter = Boolean(req.query.from || req.query.to);
    const { CP } = getFilterDates(req.query);
    const leadsQuery = useDateFilter ? { isDeleted: false, createdAt: CP } : { isDeleted: false };
    const closedAtQuery = useDateFilter ? { closedAt: CP } : {};

    // Apply user-specific filters for sales users
    if (req.user.role === 'sales') {
        leadsQuery.assignedTo = req.user._id;
        closedAtQuery.owner = req.user._id;
    }

    try {
        const totalLeadsCreated = await Lead.countDocuments(leadsQuery);
        const dealsWon = await Deal.countDocuments({ stage: 'WON', ...closedAtQuery });
        const dealsLost = await Deal.countDocuments({ stage: 'LOST', ...closedAtQuery });
        const dealsCancelled = await Deal.countDocuments({ stage: 'CANCELLED', ...closedAtQuery });

        const overallConversionRate = totalLeadsCreated > 0 ? ((dealsWon / totalLeadsCreated) * 100).toFixed(2) : 0;

        res.json({
            totalLeadsCreated,
            dealsWon,
            dealsLost,
            dealsCancelled,
            overallConversionRate: parseFloat(overallConversionRate)
        });
    } catch (error) {
        logger.error('Error generating conversion report', { error });
        res.status(500).json({ message: 'Error generating conversion report' });
    }
};

export const getLostReasonsReport = async (req, res) => {
    const useDateFilter = Boolean(req.query.from || req.query.to);
    const { CP } = getFilterDates(req.query);
    const closedAtQuery = useDateFilter ? { closedAt: CP } : {};

    try {
        const reasons = await Deal.aggregate([
            { $match: { stage: 'LOST', closedReason: { $ne: null }, ...closedAtQuery } },
            { $group: { _id: '$closedReason', count: { $sum: 1 } } },
            { $project: { _id: 0, reason: '$_id', count: 1 } },
            { $sort: { count: -1 } }
        ]);

        res.json(reasons);
    } catch (error) {
        logger.error('Error generating lost reasons report', { error });
        res.status(500).json({ message: 'Error generating lost reasons report' });
    }
};

export const exportReport = (req, res) => res.status(501).json({ message: 'Export Report API not implemented yet (Phase 2)' });