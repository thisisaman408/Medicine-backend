const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Generate JWT
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Token expires in 30 days
    });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password.' });
    }

    try {
        const userExists = await User.findOne({ username: username.toLowerCase() });
        if (userExists) {
            return res.status(400).json({ message: 'Username already exists.' });
        }

        const user = await User.create({
            username: username.toLowerCase(),
            password, // Password will be hashed by the pre-save hook in User model
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                expoPushToken: user.expoPushToken,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data.' });
        }
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: 'Server error during signup.', error: error.message });
    }
});

// @desc    Authenticate user & get token (Sign In)
// @route   POST /api/auth/signin
// @access  Public
router.post('/signin', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password.' });
    }

    try {
        const user = await User.findOne({ username: username.toLowerCase() });

        if (user && (await user.comparePassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                expoPushToken: user.expoPushToken,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid username or password.' });
        }
    } catch (error) {
        console.error("Signin error:", error);
        res.status(500).json({ message: 'Server error during signin.', error: error.message });
    }
});

// @desc    Update user's Expo Push Token
// @route   POST /api/auth/update-push-token
// @access  Private
router.post('/update-push-token', protect, async (req, res) => {
    const { expoPushToken } = req.body;
    if (!expoPushToken) {
        return res.status(400).json({ message: 'Expo push token is required.' });
    }
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.expoPushToken = expoPushToken;
            await user.save();
            res.json({ message: 'Push token updated successfully.' });
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    } catch (error) {
        console.error("Update push token error:", error);
        res.status(500).json({ message: 'Server error updating push token.', error: error.message });
    }
});


// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        // req.user is populated by the 'protect' middleware
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: 'Server error fetching profile.', error: error.message });
    }
});


// @desc    Update user's notification sound preference
// @route   PUT /api/auth/settings/notificationsound
// @access  Private
router.put('/settings/notificationsound', protect, async (req, res) => {
    const { soundName } = req.body;

    if (typeof soundName !== 'string') {
        return res.status(400).json({ message: 'Sound name must be a string.' });
    }

    // Optional: Validate soundName against a list of available sounds if you have a predefined list
    // const availableSounds = ['default', 'ringtone.mp3', 'alert.wav'];
    // if (!availableSounds.includes(soundName)) {
    //     return res.status(400).json({ message: 'Invalid sound name selected.' });
    // }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.notificationSound = soundName.trim() || 'default'; // Ensure it's not empty, fallback to default
        await user.save();

        res.json({
            message: 'Notification sound updated successfully.',
            notificationSound: user.notificationSound
        });

    } catch (error) {
        console.error("Update notification sound error:", error);
        res.status(500).json({ message: 'Server error updating notification sound.', error: error.message });
    }
});


module.exports = router;