// backend/src/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const { scheduleMedicationChecks } = require('./services/notificationService'); // <--- IMPORT IT

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('🎉 Successfully connected to MongoDB!');
        const PORT = process.env.PORT || 3001; 
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            // Start the cron job for backend-triggered notifications:
            scheduleMedicationChecks(); // <--- CRON JOB IS NOW CALLED AND WILL RUN
            console.log('[Backend Server] Medication check scheduler initialized.');
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
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
    console.error("Unhandled error in request:", err.stack); // Log the stack
    res.status(500).json({ message: '🔥 Something broke on the server!', error: err.message }); // Send JSON response
});