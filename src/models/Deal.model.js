import mongoose from 'mongoose';

const DEAL_STAGES = [
    'NEW', 'CONTACTED_LEAD', 'CONTACTED_DEVELOPER', 'QUALIFIED', 'PROPOSAL_SENT',
    'NEGOTIATION', 'WON', 'LOST', 'CANCELLED'
];

const DealSchema = new mongoose.Schema({
    lead: { // FR-15: Each deal linked to a lead
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    value: {
        type: Number,
        required: true,
        min: [1, 'Value must be greater than zero']
    },
    currency: {
        type: String,
        default: 'INR'
    },
    stage: { // FR-13: Default stages
        type: String,
        enum: DEAL_STAGES,
        default: 'NEW',
        required: true
    },
    expectedCloseDate: {
        type: Date
    },
    closedAt: { // Set only if stage is WON or LOST
        type: Date
    },
    closedReason: { // FR-16: Win/Loss reason tracking
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const Deal = mongoose.model('Deal', DealSchema);
export default Deal;