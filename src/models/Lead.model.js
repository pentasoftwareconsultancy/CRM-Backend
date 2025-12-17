import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        // unique: true // We handle uniqueness check in controller for better error handling (FR-12)
    },
    phone: {
        type: String,
        trim: true,
        // unique: true // Handled in controller (FR-12)
    },
    source: {
        type: String,
        enum: ['website', 'referral', 'call', 'other'],
        default: 'other'
    },
    status: { // Corresponds to the first stage of the pipeline progression (New, Contacted, Qualified, Converted, Lost)
        type: String,
        enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
        default: 'new'
    },
    budget: {
        type: Number,
        default: 0
    },
    description: {
        type: String
    },
    city: {
        type: String
    },
    assignedTo: { // FR-9
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isDeleted: { // Used for Soft-Delete (3.5 DELETE /leads/:id)
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient search and duplicate detection
LeadSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true } } });
LeadSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $exists: true } } });

const Lead = mongoose.model('Lead', LeadSchema);
export default Lead;