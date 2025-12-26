import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address'] // Added basic email format check
    },
    avatar: {
        type: String,
        default: '' 
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        select: false,
        minlength: [6, 'Password must be at least 6 characters long'] // Enforce minimum length
    },
   
    role: { 
        type: String,
        enum: ['admin', 'manager', 'sales'],
        default: 'sales'
    },
    designation: {
        type: String,
        trim: true,
        required: [true, 'Designation is required'] // Added requirement
    },
    phone: {
        type: String,
        trim: true
    },
    status: { 
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