// src/models/FollowUp.model.js

import mongoose from 'mongoose';

const FollowUpSchema = new mongoose.Schema({
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true
    },
    assignedTo: { // Who is responsible for this follow-up
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: { // call, email, meeting, other
        type: String,
        enum: ['call', 'email', 'meeting', 'other'],
        required: true
    },
    scheduledAt: { // FR-17: Date & time
        type: Date,
        required: true
    },
    status: {
        type: String,
        // CRITICAL FIX: Remove 'overdue' from the DB enum. It is a derived status now.
        enum: ['pending', 'completed'], 
        default: 'pending'
    },
    note: {
        type: String,
        trim: true
    },
    completedResult: { // Result/summary saved upon completion (5.4)
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const FollowUp = mongoose.model('FollowUp', FollowUpSchema);
export default FollowUp;