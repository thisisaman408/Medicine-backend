// backend/src/services/notificationService.js
const { Expo } = require('expo-server-sdk');
const cron = require('node-cron');
const Medication = require('../models/Medication');
const User = require('../models/User'); // User model to fetch sound preference

const expo = new Expo();

const sendPushNotification = async (expoPushToken, title, body, data, userPreferredSound = 'default') => {
    if (!Expo.isExpoPushToken(expoPushToken)) {
        console.error(`Push token ${expoPushToken} is not a valid Expo push token`);
        return null;
    }

    // Determine the sound to use.
    // For iOS, 'default' plays the standard sound. A filename (e.g., 'ringtone.mp3') plays a custom sound bundled with the client app.
    // For Android, the sound set on the NotificationChannel on the client (e.g., 'ringtone.mp3')
    // usually takes precedence if this payload sound is 'default'.
    // If you send a specific filename here AND that file is bundled in the client's assets,
    // Android might prioritize this payload sound.
    const soundToPlay = (userPreferredSound && userPreferredSound.trim() !== '' && userPreferredSound !== 'default')
        ? userPreferredSound
        : 'default';

    const message = {
        to: expoPushToken,
        sound: soundToPlay, // Use the determined sound
        title: title,
        body: body,
        data: data,
        channelId: 'default', // Ensure this matches the channel created on the client
    };

    console.log(`[Backend NotificationService] Preparing to send notification with sound: "${soundToPlay}"`);

    try {
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            console.log('[Backend NotificationService] Notification ticket chunk:', ticketChunk);
        }
        return tickets;
    } catch (error) {
        console.error('[Backend NotificationService] Error sending push notification:', error);
        return null;
    }
};

const scheduleMedicationChecks = () => {
    // Runs every minute (adjust cron schedule as needed for production: e.g., '*/5 * * * *' for every 5 mins)
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        // Using UTC hours and minutes can help with timezone consistency if times are stored in UTC
        // For simplicity, this uses server's local time matching "HH:MM" stored from client's local time
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        console.log(`[Backend Cron] 🕒 Running medication check for time: ${currentTime} (Server Time)`);

        try {
            const medicationsDue = await Medication.find({
                'schedules.time': currentTime,
                // Consider 'schedules.taken': false if you only want to notify for untaken doses
            }).populate({ // Populate user to get their push token and sound preference
                path: 'user',
                select: 'username expoPushToken notificationSound' // Select necessary fields
            });

            if (medicationsDue.length > 0) {
                console.log(`[Backend Cron] Found ${medicationsDue.length} medications due at ${currentTime}.`);
            }

            for (const med of medicationsDue) {
                if (med.user && med.user.expoPushToken) {
                    const dueScheduleEntry = med.schedules.find(s => s.time === currentTime);

                    // Only send if not marked taken (assuming 'taken' status is managed)
                    if (dueScheduleEntry && !dueScheduleEntry.taken) {
                        const userSoundPreference = med.user.notificationSound || 'default';
                        console.log(`[Backend Cron] Sending notification for ${med.name} to ${med.user.username}. Preferred sound: "${userSoundPreference}"`);

                        await sendPushNotification(
                            med.user.expoPushToken,
                            '💊 Medication Reminder!',
                            `Time to take your ${med.name} (${med.amount}).`,
                            { medicationId: med._id.toString(), scheduleTime: currentTime },
                            userSoundPreference // Pass the user's preferred sound
                        );
                        // Optional: Add logic here to mark the schedule as "notified" to prevent re-notifying
                        // within the same minute or until 'taken' status changes. This would require
                        // adding a 'lastNotifiedAt' or 'isNotified' field to your ScheduleSchema.
                    }
                } else if (med.user && !med.user.expoPushToken) {
                    console.warn(`[Backend Cron] User ${med.user.username} for medication ${med.name} has no push token.`);
                }
            }
        } catch (error) {
            console.error('[Backend Cron] Error in scheduled medication check:', error);
        }
    });
    console.log('📰 Backend medication check cron job IS SCHEDULED to run every minute.');
};

module.exports = {
    sendPushNotification,
    scheduleMedicationChecks,
};