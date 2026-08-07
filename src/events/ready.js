import { logger } from '../utils/logger.js';

import { getFromDb, setInDb } from '../utils/database.js';



export default async (client) => {

    logger.success(`Logged in as ${client.user.tag}!`);



    // Automated Chat Reset Background Loop

    setInterval(async () => {

        try {

            for (const [guildId, guild] of client.guilds.cache) {

                const settingsKey = `reset_chat_config_${guildId}`;

                const settings = await getFromDb(settingsKey, null);



                if (!settings || !settings.channelId || !settings.intervalMs) continue;



                const lastResetTime = new Date(settings.lastReset).getTime();

                const now = Date.now();



                if (now - lastResetTime >= settings.intervalMs) {

                    const channel = guild.channels.cache.get(settings.channelId);

                    if (!channel) continue;



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

    }, 30 * 1000); // Checks every 30 seconds

}; 

