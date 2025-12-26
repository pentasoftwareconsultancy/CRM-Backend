// src/models/Customer.model.js (Enhanced Validation)
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
        required: [true, 'Company Name is required'],
        trim: true
    },
    primaryContact: { // Contact details
        type: String,
        required: [true, 'Primary contact name is required'], // Added requirement
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'], // Added requirement
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address']
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
        type: String 
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