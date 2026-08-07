import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getFromDb, setInDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName("reset-chat")
        .setDescription("Resets the channel by clearing all messages and starts a new period.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: "Utility",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) return;

        try {
            // Always target the exact channel the user is currently typing in
            const channelToReset = interaction.channel;

            const newChannel = await channelToReset.clone({
                reason: `Chat reset requested by ${interaction.user.tag}`,
                position: channelToReset.position
            });

            await channelToReset.delete(`Chat reset requested by ${interaction.user.tag}`);

            await newChannel.send({
                content: '🔄 **Leaderboard Reset!** A new period has started. Start chatting to climb the leaderboard!'
            });

            // If this channel was part of the multi-channel slots, update its ID in the database
            const guildId = interaction.guildId;
            const settingsKey = `reset_chat_configs_${guildId}`;
            let configs = await getFromDb(settingsKey, []);
            if (Array.isArray(configs)) {
                const slot = configs.find(c => c.channelId === channelToReset.id);
                if (slot) {
                    slot.channelId = newChannel.id;
                    slot.lastReset = new Date().toISOString();
                    await setInDb(settingsKey, configs);
                }
            }

            logger.info(`[ManualReset] Channel #${channelToReset.name} reset via /reset-chat by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Failed to reset channel:', error);
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'There was an error trying to reset this channel.' 
            });
        }
    },
};