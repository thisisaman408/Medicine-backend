// backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required.'], // Changed from your provided file
        unique: true,
        trim: true,
        lowercase: true, // Added for consistency
        minlength: [3, 'Username must be at least 3 characters.'] // Added validation
    },
    password: {
        type: String,
        required: [true, 'Password is required.'], // Changed from your provided file
        minlength: [6, 'Password must be at least 6 characters.'] // Added validation
    },
    expoPushToken: {
        type: String,
        trim: true,
        default: null 
    },
    notificationSound: { 
        type: String,
        trim: true,
        default: 'default' 
    }
}, { timestamps: true });


UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try { // Added try-catch for pre-save hook
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);