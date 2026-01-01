import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: false // Changed from true
    },
    deal: { // Added deal reference
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deal',
        required: false
    },
    user: { // Who created the note
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: { // The note text
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

// Ensure either lead or deal is present
NoteSchema.pre('save', async function () {
    if (!this.lead && !this.deal) {
        throw new Error('A note must be associated with either a lead or a deal.');
    }
});

const Note = mongoose.model('Note', NoteSchema);
export default Note;