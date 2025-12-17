import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true
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

const Note = mongoose.model('Note', NoteSchema);
export default Note;