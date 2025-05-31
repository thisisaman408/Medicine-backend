// backend/src/services/notificationService.js
const { Expo } = require('expo-server-sdk');
const cron = require('node-cron');
const Medication = require('../models/Medication');
const User = require('../models/User'); // Ensure User model is correctly imported

const expo = new Expo();

/**
 * Sends a push notification.
 * @param {string} expoPushToken - The recipient's Expo Push Token.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body/message of the notification.
 * @param {object} data - Extra data to send with the notification.
 * @param {string} [userPreferredSound='default'] - The user's preferred sound file name (e.g., 'ringtone.mp3') or 'default'.
 */
const sendPushNotification = async (expoPushToken, title, body, data, userPreferredSound = 'default') => {
    if (!Expo.isExpoPushToken(expoPushToken)) {
        console.error(`[Backend NotificationService] Invalid Expo Push Token: ${expoPushToken}`);
        return null;
    }

    // Determine the sound to use in the payload.
    // For iOS: 'default' plays the standard sound. A filename (e.g., 'ringtone.mp3') plays a custom sound
    // if it's bundled with the client app.
    // For Android: The sound set on the NotificationChannel on the client (e.g., 'ringtone.mp3' via frontend notificationService.js)
    // usually takes precedence if this payload sound is 'default'.
    // If a specific filename is sent here AND that file is bundled in the client's assets, Android MIGHT play it.
    const soundToPlay = (userPreferredSound && userPreferredSound.trim() !== '' && userPreferredSound.toLowerCase() !== 'default')
        ? userPreferredSound
        : 'default';

    const message = {
        to: expoPushToken,
        sound: soundToPlay, // Use the determined sound
        title: title,
        body: body,
        data: data, // e.g., { medicationId: 'someId' }
        channelId: 'default', // This should match the channelId created on the client
                              // which has its own default sound (e.g., 'ringtone.mp3' in your frontend setup)
    };

    console.log(`[Backend NotificationService] Preparing to send notification. To: ${expoPushToken.substring(0,15)}..., Sound: "${soundToPlay}", Title: "${title}"`);

    try {
        // Chunk notifications if sending to multiple tokens (not applicable here but good practice)
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            // It's good to check ticketChunk for errors, e.g., if a token is invalid
            if (ticketChunk && ticketChunk.length > 0 && ticketChunk[0].status === 'error') {
                console.error(`[Backend NotificationService] Error sending notification to ${expoPushToken}: ${ticketChunk[0].message}`, ticketChunk[0].details);
            }
        }
        console.log('[Backend NotificationService] Notification sent. Ticket:', tickets.length > 0 ? tickets[0] : 'No ticket');
        return tickets;
    } catch (error) {
        console.error('[Backend NotificationService] Critical error sending push notification:', error);
        return null;
    }
};

/**
 * Schedules a cron job to check for due medications and send notifications.
 */
const scheduleMedicationChecks = () => {
    // Runs every minute. For production, you might adjust this (e.g., '*/5 * * * *' for every 5 minutes).
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        // This uses the server's local time. For global apps, managing timezones is critical.
        // We assume medication times are stored based on the user's local time input.
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        // console.log(`[Backend Cron] 🕒 Medication check for: ${currentTime} (Server Time)`);

        try {
            const medicationsDue = await Medication.find({
                'schedules.time': currentTime,
                // Consider adding 'schedules.taken': false if you only want to notify for untaken doses
                // and have a mechanism to reset 'taken' daily or manage its state.
            }).populate({
                path: 'user',
                select: 'username expoPushToken notificationSound' // Select fields needed
            });

            if (medicationsDue.length > 0) {
                console.log(`[Backend Cron] Found ${medicationsDue.length} medication(s) due at ${currentTime}.`);
            }

            for (const med of medicationsDue) {
                if (med.user && med.user.expoPushToken) {
                    const dueScheduleEntry = med.schedules.find(s => s.time === currentTime);

                    // Only send if not marked taken (assuming 'taken' status is relevant here)
                    if (dueScheduleEntry && !dueScheduleEntry.taken) {
                        const userSoundPreference = med.user.notificationSound || 'default'; // Fallback to 'default'
                        console.log(`[Backend Cron] Sending reminder for "${med.name}" to user "${med.user.username}". Sound preference: "${userSoundPreference}"`);

                        await sendPushNotification(
                            med.user.expoPushToken,
                            '💊 Medication Reminder!',
                            `Time to take your ${med.name} (${med.amount}).`,
                            { medicationId: med._id.toString(), scheduleTime: currentTime, type: 'medicationReminder' }, // Added type
                            userSoundPreference // Pass the user's preferred sound
                        );
                        // TODO (Optional): Implement logic to prevent re-notifying for the same dose
                        // within a short window or until 'taken' status changes.
                        // This might involve adding a 'lastNotifiedAt' timestamp to the schedule subdocument.
                    }
                } else if (med.user && !med.user.expoPushToken) {
                    console.warn(`[Backend Cron] User ${med.user.username} for medication ${med.name} has no push token. Cannot send reminder.`);
                }
            }
        } catch (error) {
            console.error('[Backend Cron] Error during scheduled medication check:', error);
        }
    });
    console.log('📰 Backend medication check cron job IS SCHEDULED to run every minute.');
};

module.exports = {
    sendPushNotification,
    scheduleMedicationChecks,
};
