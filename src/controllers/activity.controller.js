import FollowUp from '../models/FollowUp.model.js';
import Note from '../models/Note.model.js';
import Lead from '../models/Lead.model.js';
import mongoose from 'mongoose';
import { createNotification } from './notification.controller.js'; // Ensure this is imported if used later
import logger from '../utils/logger.js';
// @desc    Get pending/overdue follow-ups (5.3 GET /followups)
// @route   GET /api/followups
// @access  Authenticated
export const getFollowUps = async (req, res) => {
    const { status, from, to, assignedTo, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filters = { lead: { $exists: true } };

    const now = new Date();

    // CRITICAL FIX: Handle 'pending' and 'overdue' as mutually exclusive for pagination accuracy.
    // Also support multi-status filtering (e.g. status=pending|completed)
    if (status && status.includes('|')) {
        const statuses = status.split('|');
        filters.status = { $in: statuses };
    } else if (status === 'overdue') {
        filters.status = 'pending';
        filters.scheduledAt = { $lt: now };
    } else if (status === 'pending') {
        filters.status = 'pending';
        filters.scheduledAt = { $gte: now };
    } else if (status === 'completed') {
        filters.status = 'completed';
    } else {
        filters.status = 'pending';
        filters.scheduledAt = { $gte: now }; // Default to pending future ones
    }

    // Role-based filtering (remains the same)
    if (req.user.role === 'sales') {
        filters.assignedTo = req.user._id;
    } else if (assignedTo) {
        filters.assignedTo = assignedTo;
    }

    // Apply date range filters (remains the same)
    if (from || to) {
        filters.scheduledAt = {};
        if (from) filters.scheduledAt.$gte = new Date(from);
        if (to) filters.scheduledAt.$lte = new Date(to);
    }

    let totalFollowUps = 0;
    let followups = [];

    try {
        // Fetch data based on the simplified filters
        totalFollowUps = await FollowUp.countDocuments(filters);

        followups = await FollowUp.find(filters)
            .sort({ scheduledAt: 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('lead', 'name company')
            .populate('assignedTo', 'name');

        // Apply dynamic status classification for the HTTP response
        const result = followups.map(fu => {
            const fuObject = fu.toObject();

            // Overdue classification: pending AND schedule time passed
            let isOverdue = fuObject.status === 'pending' && new Date(fuObject.scheduledAt) < new Date();

            // Override status in response if overdue
            if (isOverdue) {
                fuObject.status = 'overdue';
            }

            return fuObject;
        });

        res.json({
            data: result,
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalFollowUps
        });
    } catch (error) {
        logger.error('Error fetching follow-ups', { error });
        res.status(500).json({ message: 'Error fetching follow-ups' });
    }
};


// @desc    Create a new follow-up (5.1 POST /leads/:leadId/followups)
// @route   POST /api/leads/:leadId/followups
// @access  Authenticated
export const createFollowUp = async (req, res) => {
    const { type, scheduledAt, note, assignedTo } = req.body;
    const leadId = req.params.leadId;

    // Validation Check
    if (!type || !scheduledAt) {
        return res.status(400).json({ message: 'Type and scheduled date/time are required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
        return res.status(400).json({ message: 'Invalid lead ID format.' });
    }

    try {
        const followUp = await FollowUp.create({
            lead: leadId,
            type,
            scheduledAt,
            note,
            assignedTo: assignedTo || req.user._id // Assign to specified user or self
        });

        res.status(201).json({
            message: 'Follow-up created successfully',
            followup: { _id: followUp._id, status: followUp.status }
        });
    } catch (error) {
        logger.error('Error creating follow-up', { error });
        res.status(400).json({ message: error.message });
    }
};

// @desc    Mark follow-up as completed (5.4 PATCH /followups/:id/complete)
// @route   PATCH /api/followups/:id/complete
// @access  Authenticated
export const completeFollowUp = async (req, res) => {
    const followUpId = req.params.id;
    const { result, nextFollowup } = req.body;

    try {
        const followUp = await FollowUp.findById(followUpId);

        if (!followUp) {
            return res.status(404).json({ message: 'Follow-up not found' });
        }

        // Ensure user is the assigned user, manager, or admin
        if (req.user.role === 'sales' && followUp.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to complete this follow-up' });
        }

        followUp.status = 'completed';
        followUp.completedResult = result;
        await followUp.save();

        let newFollowUp = null;

        // Optionally create the next follow-up
        if (nextFollowup && nextFollowup.scheduledAt) {
            newFollowUp = await FollowUp.create({
                lead: followUp.lead,
                type: nextFollowup.type || 'call', // Default to call if not specified
                scheduledAt: nextFollowup.scheduledAt,
                note: nextFollowup.note,
                assignedTo: followUp.assignedTo // Assign to the same user who completed the task
            });
        }

        res.json({
            message: 'Follow-up updated successfully',
            newFollowUp: newFollowUp ? { _id: newFollowUp._id, status: newFollowUp.status } : undefined
        });

    } catch (error) {
        logger.error('Error completing follow-up', { error });
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get follow-ups for a specific lead (5.2 GET /leads/:leadId/followups)
// @route   GET /api/leads/:leadId/followups
// @access  Authenticated
export const getLeadFollowUps = async (req, res) => {
    const followups = await FollowUp.find({ lead: req.params.leadId })
        .sort({ scheduledAt: -1 })
        .populate('assignedTo', 'name');

    res.json(followups);
};

// --- NOTE CONTROLLERS ---

// @desc    Add a note to a lead (6.1 POST /leads/:leadId/notes)
// @route   POST /api/leads/:leadId/notes
// @access  Authenticated
export const addNote = async (req, res) => {
    const { content } = req.body;
    const leadId = req.params.leadId;

    try {
        const note = await Note.create({
            lead: leadId,
            user: req.user._id,
            content
        });

        res.status(201).json({
            message: 'Note added successfully',
            note: note
        });
    } catch (error) {
        logger.error('Error adding note', { error });
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get notes for a specific lead (6.2 GET /leads/:leadId/notes)
// @route   GET /api/leads/:leadId/notes
// @access  Authenticated
export const getLeadNotes = async (req, res) => {
    const notes = await Note.find({ lead: req.params.leadId })
        .sort({ createdAt: -1 })
        .populate('user', 'name');

    res.json(notes);
};

// @desc    Delete a specific note (6.3 DELETE /notes/:id)
// @route   DELETE /api/notes/:id
// @access  Authenticated (Owner, Admin)
export const deleteNote = async (req, res) => {
    const noteId = req.params.id;
    try {
        const note = await Note.findById(noteId);

        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        // Authorization: Must be the note creator or an admin
        if (req.user.role !== 'admin' && note.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this note.' });
        }

        await note.deleteOne();
        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        logger.error('Error deleting note', { error });
        res.status(500).json({ message: 'Error deleting note' });
    }
};

// --- ACTIVITY TIMELINE ---

// @desc    Get full activity timeline for a lead (6.4 GET /leads/:leadId/activities)
// @route   GET /api/leads/:leadId/activities
// @access  Authenticated
export const getLeadActivities = async (req, res) => {
    const leadId = req.params.leadId;

    try {
        // 1. Fetch Follow-up activities (completed ones)
        const completedFollowUps = await FollowUp.find({ lead: leadId, status: 'completed' })
            .populate('assignedTo', 'name');

        const followUpActivities = completedFollowUps.map(fu => ({
            type: 'followup_completed',
            message: fu.completedResult || `${fu.type} completed.`,
            createdAt: fu.updatedAt // Use updatedAt as completion time
        }));

        // 2. Fetch Notes
        const notes = await Note.find({ lead: leadId })
            .populate('user', 'name');

        const noteActivities = notes.map(note => ({
            type: 'note_added',
            message: note.content,
            createdAt: note.createdAt
        }));

        // 3. Fetch Lead/Deal history (Requires complex logic/audit logs, simplified here)
        // For simplicity, we just use Lead creation date and latest Deal stage change
        const lead = await Lead.findById(leadId).populate('assignedTo', 'name');

        let history = [];
        if (lead) {
            history.push({
                type: 'lead_created',
                message: `Lead created by ${lead.assignedTo.name}`,
                createdAt: lead.createdAt
            });
        }

        // Combine all activities and sort by date
        const allActivities = [
            ...history,
            ...followUpActivities,
            ...noteActivities
        ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        res.json(allActivities);

    } catch (error) {
        logger.error('Error fetching activities', { error });
        res.status(500).json({ message: 'Error fetching activities' });
    }
};