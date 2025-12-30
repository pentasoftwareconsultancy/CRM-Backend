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
        validate: {
            validator: function (v) {
                // Must be 10 digits, cannot start with 0
                const digits = v.replace(/[\s-]/g, '');
                return /^[1-9][0-9]{9}$/.test(digits);
            },
            message: props => `${props.value} is not a valid phone number! Must be 10 digits and cannot start with 0.`
        }
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
        min: [1, 'Budget must be greater than zero'] // Enforce minimum 1
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