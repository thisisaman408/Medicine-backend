const { Expo } = require('expo-server-sdk');
const cron = require('node-cron');
const Medication = require('../models/Medication'); // Adjust path as necessary
const User = require('../models/User'); // Adjust path as necessary

const expo = new Expo();

const sendPushNotification = async (expoPushToken, title, body, data) => {
    if (!Expo.isExpoPushToken(expoPushToken)) {
        console.error(`Push token ${expoPushToken} is not a valid Expo push token`);
        return null;
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data, // e.g., { medicationId: 'someId' }
        channelId: 'default', // Ensure this channel is created on the client
    };

    try {
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            console.log('Notification ticket chunk:', ticketChunk);
        }
        return tickets;
        // You might want to save these tickets to check for receipts later
    } catch (error) {
        console.error('Error sending push notification:', error);
        return null;
    }
};

// This is an example of a cron job.
// For a real-world app, you'd need more robust logic for:
// - Ensuring notifications are sent only once per scheduled time.
// - Handling different timezones if your users are global.
// - Managing recurring schedules beyond just daily at HH:MM.
const scheduleMedicationChecks = () => {
    // Runs every minute
    cron.schedule('* * * * *', async () => {
        console.log('🕒 Running scheduled medication check:', new Date().toLocaleTimeString());
        const now = new Date();
        // Get current time in HH:MM format, ensure it matches user's local time for schedule
        // This is tricky because the server time might not be the user's local time.
        // A better approach might be to store full datetime for next notification in UTC
        // or let the client handle repeats primarily.
        // For simplicity, this example checks against HH:MM string.
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        try {
            const medicationsDue = await Medication.find({
                'schedules.time': currentTime,
                // 'schedules.taken': false, // Add more complex logic if needed
            }).populate('user', 'username expoPushToken'); // Populate user to get their push token

            for (const med of medicationsDue) {
                if (med.user && med.user.expoPushToken) {
                    const dueScheduleEntry = med.schedules.find(s => s.time === currentTime);
                    if (dueScheduleEntry && !dueScheduleEntry.taken) { // Example: Only send if not marked taken
                        console.log(`Sending notification for ${med.name} to ${med.user.username} at ${currentTime}`);
                        await sendPushNotification(
                            med.user.expoPushToken,
                            '💊 Medication Reminder!',
                            `Time to take your ${med.name} (${med.amount}).`,
                            { medicationId: med._id.toString(), scheduleTime: currentTime }
                        );
                        // Optionally, mark as notified (you'd need a field for this in ScheduleSchema)
                        // Or rely on client to mark as taken.
                    }
                }
            }
        } catch (error) {
            console.error('Error in scheduled medication check:', error);
        }
    });
    console.log('📰 Medication check cron job scheduled.');
};

module.exports = {
    sendPushNotification,
    scheduleMedicationChecks,
};