import { logger } from '../utils/logger.js';
import { getFromDb, setInDb } from '../utils/database.js';

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.info(`Logged in as ${client.user.tag}!`);

        setInterval(async () => {
            try {
                for (const [guildId, guild] of client.guilds.cache) {
                    const settingsKey = `reset_chat_config_${guildId}`;
                    let settings = await getFromDb(settingsKey, null);

                    if (!settings) continue;

                    if (typeof settings === 'string') {
                        try { settings = JSON.parse(settings); } catch (e) { continue; }
                    }

                    if (!settings.channelId) continue;

                    // Default to 24 hours if intervalMs isn't specified
                    const intervalMs = settings.intervalMs || (24 * 60 * 60 * 1000);
                    const lastResetTime = new Date(settings.lastReset || Date.now()).getTime();
                    const now = Date.now();
                    const timeLeft = intervalMs - (now - lastResetTime);

                    console.log(`[AutoReset] Guild ${guild.name}: ${Math.max(0, Math.floor(timeLeft / 1000))}s remaining.`);

                    if (now - lastResetTime >= intervalMs) {
                        const channel = guild.channels.cache.get(settings.channelId);
                        if (!channel) continue;

                        logger.info(`[AutoReset] Resetting channel #${channel.name} in guild ${guild.name}`);

                        const newChannel = await channel.clone({
                            reason: 'Automated 24-hour periodic chat reset',
                            position: channel.position
                        });

                        await channel.delete('Automated 24-hour periodic chat reset');

                        await newChannel.send({
                            content: '🔄 **Leaderboard Reset!** A new 24-hour period has started. Start chatting to climb the leaderboard!'
                        });

                        settings.channelId = newChannel.id;
                        settings.lastReset = new Date().toISOString();
                        await setInDb(settingsKey, settings);
                    }
                }
            } catch (error) {
                console.error('Error in automated chat reset loop:', error);
            }
        }, 30 * 1000);
    }
};