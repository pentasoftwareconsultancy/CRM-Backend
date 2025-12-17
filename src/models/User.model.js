import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false // Do not return password by default
    },
    role: { // FR-4
        type: String,
        enum: ['admin', 'manager', 'sales'],
        default: 'sales'
    },
    designation: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    status: { // Used for soft-deletion/deactivation (2.5 DELETE /users/:id)
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Middleware to hash password before saving
userSchema.pre('save', async function () { // <--- REMOVED 'next'
    if (!this.isModified('password')) {
        return; // <--- Changed return next() to just return
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    // Removed the final next() call
});

// Method to compare hashed password (FR-1)
userSchema.methods.matchPassword = async function (enteredPassword) {
    // Note: 'this.password' needs to be explicitly selected in the query
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;