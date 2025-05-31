const express = require('express');
const Medication = require('../models/Medication');
const { protect } = require('../middleware/authMiddleware');
// const { sendPushNotification } = require('../services/notificationService'); // If you want to trigger from here

const router = express.Router();

// @desc    Create a new medication
// @route   POST /api/medications
// @access  Private
router.post('/', protect, async (req, res) => {
    const { name, amount, precautions, schedules } = req.body;

    if (!name || !amount || !schedules || !Array.isArray(schedules)) {
        return res.status(400).json({ message: 'Name, amount, and schedules are required.' });
    }
    // Basic validation for schedule times
    if (schedules.some(s => !s.time || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(s.time))) {
        return res.status(400).json({ message: 'All schedule entries must have a valid time in HH:MM format.' });
    }

    try {
        const medication = new Medication({
            user: req.user._id,
            name,
            amount,
            precautions,
            schedules, // Expecting schedules to have { time: "HH:MM", localNotificationId: "client_generated_id" }
        });

        const createdMedication = await medication.save();
        res.status(201).json(createdMedication);

        // Example: If you wanted to send an immediate push notification from backend
        // if (req.user.expoPushToken) {
        //   await sendPushNotification(
        //     req.user.expoPushToken,
        //     'Medication Added',
        //     `${name} has been added to your schedule.`,
        //     { medicationId: createdMedication._id.toString() }
        //   );
        // }

    } catch (error) {
        console.error("Create medication error:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation Error", errors: error.errors });
        }
        res.status(500).json({ message: 'Server error creating medication.', error: error.message });
    }
});

// @desc    Get all medications for the logged-in user
// @route   GET /api/medications
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const medications = await Medication.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(medications);
    } catch (error) {
        console.error("Get medications error:", error);
        res.status(500).json({ message: 'Server error fetching medications.', error: error.message });
    }
});

// @desc    Get a single medication by ID
// @route   GET /api/medications/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const medication = await Medication.findById(req.params.id);

        if (medication && medication.user.toString() === req.user._id.toString()) {
            res.json(medication);
        } else if (!medication) {
            res.status(404).json({ message: 'Medication not found.' });
        } else {
            res.status(401).json({ message: 'Not authorized to view this medication.' });
        }
    } catch (error) {
        console.error("Get medication by ID error:", error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Medication not found (invalid ID format).' });
        }
        res.status(500).json({ message: 'Server error fetching medication.', error: error.message });
    }
});

// @desc    Update a medication
// @route   PUT /api/medications/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
    const { name, amount, precautions, schedules } = req.body;

    try {
        const medication = await Medication.findById(req.params.id);

        if (medication && medication.user.toString() === req.user._id.toString()) {
            medication.name = name || medication.name;
            medication.amount = amount || medication.amount;
            medication.precautions = precautions !== undefined ? precautions : medication.precautions;
            if (schedules && Array.isArray(schedules)) {
                 // Basic validation for schedule times
                if (schedules.some(s => !s.time || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(s.time))) {
                    return res.status(400).json({ message: 'All schedule entries must have a valid time in HH:MM format.' });
                }
                medication.schedules = schedules;
            }


            const updatedMedication = await medication.save();
            res.json(updatedMedication);
        } else if (!medication) {
            res.status(404).json({ message: 'Medication not found.' });
        } else {
            res.status(401).json({ message: 'Not authorized to update this medication.' });
        }
    } catch (error) {
        console.error("Update medication error:", error);
         if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation Error", errors: error.errors });
        }
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Medication not found (invalid ID format).' });
        }
        res.status(500).json({ message: 'Server error updating medication.', error: error.message });
    }
});

// @desc    Delete a medication
// @route   DELETE /api/medications/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const medication = await Medication.findById(req.params.id);

        if (medication && medication.user.toString() === req.user._id.toString()) {
            await Medication.deleteOne({ _id: req.params.id });
            res.json({ message: 'Medication removed successfully.' });
        } else if (!medication) {
            res.status(404).json({ message: 'Medication not found.' });
        } else {
            res.status(401).json({ message: 'Not authorized to delete this medication.' });
        }
    } catch (error) {
        console.error("Delete medication error:", error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Medication not found (invalid ID format).' });
        }
        res.status(500).json({ message: 'Server error deleting medication.', error: error.message });
    }
});


// @desc    Update a specific schedule entry (e.g., mark as taken)
// @route   PATCH /api/medications/:medicationId/schedules/:scheduleId
// @access  Private
router.patch('/:medicationId/schedules/:scheduleId', protect, async (req, res) => {
    const { medicationId, scheduleId } = req.params;
    const { taken } = req.body; // Expecting { taken: true/false }

    if (typeof taken !== 'boolean') {
        return res.status(400).json({ message: 'Invalid "taken" status. Must be true or false.' });
    }

    try {
        const medication = await Medication.findOne({ _id: medicationId, user: req.user._id });

        if (!medication) {
            return res.status(404).json({ message: 'Medication not found or not authorized.' });
        }

        const schedule = medication.schedules.id(scheduleId);
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule entry not found.' });
        }

        schedule.taken = taken;
        await medication.save();
        res.json(medication); // Send back the updated medication document

    } catch (error) {
        console.error("Update schedule error:", error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Invalid ID format.' });
        }
        res.status(500).json({ message: 'Server error updating schedule.', error: error.message });
    }
});


module.exports = router;