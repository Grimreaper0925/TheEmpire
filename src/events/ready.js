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
                    const settingsKey = `reset_chat_configs_${guildId}`;
                    let configs = await getFromDb(settingsKey, []);

                    if (!configs || !Array.isArray(configs) || configs.length === 0) {
                        // Fallback support for old single-object format if present
                        const oldKey = `reset_chat_config_${guildId}`;
                        let oldCfg = await getFromDb(oldKey, null);
                        if (oldCfg) {
                            if (typeof oldCfg === 'string') { try { oldCfg = JSON.parse(oldCfg); } catch (e) { oldCfg = null; } }
                            if (oldCfg && oldCfg.channelId) {
                                configs = [oldCfg];
                                await setInDb(settingsKey, configs);
                            }
                        }
                    }

                    if (!configs || configs.length === 0) continue;

                    let updated = false;

                    for (const cfg of configs) {
                        if (!cfg.channelId) continue;
                        const intervalMs = cfg.intervalMs || (24 * 60 * 60 * 1000);
                        const lastResetTime = new Date(cfg.lastReset || Date.now()).getTime();
                        const now = Date.now();

                        if (now - lastResetTime >= intervalMs) {
                            const channel = guild.channels.cache.get(cfg.channelId);
                            if (!channel) continue;

                            logger.info(`[AutoReset] Resetting multi-channel slot #${channel.name} in guild ${guild.name}`);

                            const newChannel = await channel.clone({
                                reason: 'Automated multi-channel periodic chat reset',
                                position: channel.position
                            });

                            await channel.delete('Automated multi-channel periodic chat reset');

                            await newChannel.send({
                                content: '🔄 **Leaderboard Reset!** A new 24-hour period has started. Start chatting to climb the leaderboard!'
                            });

                            cfg.channelId = newChannel.id;
                            cfg.lastReset = new Date().toISOString();
                            updated = true;
                        }
                    }

                    if (updated) {
                        await setInDb(settingsKey, configs);
                    }
                }
            } catch (error) {
                console.error('Error in multi-channel automated chat reset loop:', error);
            }
        }, 30 * 1000);
    }
};