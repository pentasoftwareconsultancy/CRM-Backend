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
        enum: ['pending', 'completed', 'overdue'], // Overdue status logic handled in controller/query
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