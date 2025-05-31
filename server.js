require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
// const { scheduleMedicationChecks } = require('./services/notificationService'); // Optional cron job

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('🎉 Successfully connected to MongoDB!');
        // Start the server only after successful DB connection
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            // If using the cron job for backend-triggered notifications:
            // scheduleMedicationChecks();
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1); // Exit process with failure
    });


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);

// Basic route for testing
app.get('/', (req, res) => {
    res.send('👋 Swasthay Medication Reminder API is alive!');
});

// Global Error Handler (optional basic example)
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.stack);
    res.status(500).send('🔥 Something broke on the server!');
});