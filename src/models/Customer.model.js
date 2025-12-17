import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
    // Link to the original lead (optional)
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead'
    },
    owner: { // The user who won the deal/owns the relationship
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: { // Company details
        type: String,
        required: true,
        trim: true
    },
    primaryContact: { // Contact details
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        trim: true
    },
    address: {
        type: String
    },
    industry: {
        type: String
    },
    website: {
        type: String
    },
    billingInfo: { // FR-27: Billing info
        type: String // Simplified, could be a separate subdocument
    },
    convertedDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Customer = mongoose.model('Customer', CustomerSchema);
export default Customer;