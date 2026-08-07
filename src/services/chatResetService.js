import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export default async (client) => {
    logger.success('Counting Game & Chat Reset Services initialized.');

    // Automated Chat Reset Background Loop
    setInterval(async () => {
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                const settingsKey = `reset_chat_config_${guildId}`;
                let settings = await getFromDb(settingsKey, null);

                if (!settings) continue;

                if (typeof settings === 'string') {
                    try { settings = JSON.parse(settings); } catch (e) { continue; }
                }

                if (!settings.channelId || !settings.intervalMs) continue;

                const lastResetTime = new Date(settings.lastReset).getTime();
                const now = Date.now();

                if (now - lastResetTime >= settings.intervalMs) {
                    const channel = guild.channels.cache.get(settings.channelId);
                    if (!channel) continue;

                    logger.info(`[AutoReset] Resetting channel #${channel.name} in guild ${guild.name}`);

                    const newChannel = await channel.clone({
                        reason: 'Automated periodic chat reset'
                    });
                    await channel.delete('Automated periodic chat reset');

                    await newChannel.send({
                        content: '🔄 **Leaderboard Reset!** A new automated period has started. Start chatting to climb the leaderboard!'
                    });

                    settings.lastReset = new Date().toISOString();
                    await setInDb(settingsKey, settings);
                }
            }
        } catch (error) {
            console.error('Error in automated chat reset service:', error);
        }
    }, 30 * 1000); // Check every 30 seconds
};
