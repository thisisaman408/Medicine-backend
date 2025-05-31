const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
    time: { type: String, required: true }, // e.g., "08:00", "14:30" or store as Date objects
    // You might want to store a full Date object if daily repetition needs to be calculated on the backend for scheduling
    // Or simply the time of day if notifications are scheduled on the client for repeats.
    taken: { type: Boolean, default: false },
    localNotificationId: { type: String } // To potentially manage client-side scheduled notifications
});

const MedicationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    amount: { type: String, required: true, trim: true },
    precautions: { type: String, trim: true },
    schedules: [ScheduleSchema]
}, { timestamps: true });

module.exports = mongoose.model('Medication', MedicationSchema);