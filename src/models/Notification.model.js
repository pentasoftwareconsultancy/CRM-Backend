// src/models/Notification.model.js

import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    user: { // The recipient user
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: { // e.g., 'followup_due', 'lead_assigned', 'stage_alert'
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isRead: { // 9.2 PATCH /notifications/:id/read
        type: Boolean,
        default: false
    },
    relatedId: { // Optional: ID of the lead/deal/followup
        type: mongoose.Schema.Types.ObjectId,
        required: false 
    }
}, {
    timestamps: true
});

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;