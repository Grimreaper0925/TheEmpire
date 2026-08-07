import { getFromDb, setInDb } from '../utils/database.js';

export default async (client) => {
    // Check every 10 minutes if a reset is due
    setInterval(async () => {
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                const settingsKey = `reset_chat_config_${guildId}`;
                const settings = await getFromDb(settingsKey, null);

                if (!settings || !settings.channelId || !settings.intervalHours) continue;

                const lastResetTime = new Date(settings.lastReset).getTime();
                const intervalMs = settings.intervalHours * 60 * 60 * 1000;
                const now = Date.now();

                if (now - lastResetTime >= intervalMs) {
                    const channel = guild.channels.cache.get(settings.channelId);
                    if (!channel) continue;

                    // Clone and replace old channel
                    const newChannel = await channel.clone({
                        reason: 'Automated periodic chat reset'
                    });
                    await channel.delete('Automated periodic chat reset');

                    await newChannel.send({
                        content: '🔄 **Leaderboard Reset!** A new automated period has started. Start chatting to climb the leaderboard!'
                    });

                    // Update last reset timestamp
                    settings.lastReset = new Date().toISOString();
                    await setInDb(settingsKey, settingsData);
                }
            }
        } catch (error) {
            console.error('Error in automated chat reset loop:', error);
        }
    }, 10 * 60 * 1000); // 10 minutes check interval
};
