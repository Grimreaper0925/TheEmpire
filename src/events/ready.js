import { logger } from '../utils/logger.js';
import { getFromDb, setInDb } from '../utils/database.js';

export default async (client) => {
    logger.success(`Logged in as ${client.user.tag}!`);

    // Automated Chat Reset Background Loop
    setInterval(async () => {
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                const settingsKey = `reset_chat_config_${guildId}`;
                let settings = await getFromDb(settingsKey, null);

                if (!settings) continue;

                // Handle stringified objects if the database returns them as strings
                if (typeof settings === 'string') {
                    try { settings = JSON.parse(settings); } catch (e) { continue; }
                }

                if (!settings.channelId || !settings.intervalMs) continue;

                const lastResetTime = new Date(settings.lastReset).getTime();
                const now = Date.now();
                const timeLeft = settings.intervalMs - (now - lastResetTime);

                console.log(`[AutoReset] Guild ${guild.name}: ${Math.max(0, Math.floor(timeLeft / 1000))}s until next reset.`);

                if (now - lastResetTime >= settings.intervalMs) {
                    const channel = guild.channels.cache.get(settings.channelId);
                    if (!channel) {
                        console.log(`[AutoReset] Target channel not found in cache for guild ${guild.name}`);
                        continue;
                    }

                    console.log(`[AutoReset] Resetting channel #${channel.name} now!`);

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
            console.error('Error in automated chat reset loop:', error);
        }
    }, 30 * 1000); // Checks every 10 seconds
};
