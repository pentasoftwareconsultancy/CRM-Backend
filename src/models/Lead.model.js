import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    company: {
        type: String,
        required: [true, 'Company is required'], // Added requirement
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'], // Added requirement
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address'] 
        // unique is handled by indexing and controller logic (FR-12)
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'], // Added requirement
        trim: true,
    },
    source: {
        type: String,
        enum: ['website', 'referral', 'call', 'other'],
        default: 'other'
    },
    status: { 
        type: String,
        enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
        default: 'new'
    },
    budget: {
        type: Number,
        default: 0,
        min: [0, 'Budget cannot be negative'] // Enforce minimum 0
    },
    description: {
        type: String
    },
    city: {
        type: String
    },
    assignedTo: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isDeleted: { 
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