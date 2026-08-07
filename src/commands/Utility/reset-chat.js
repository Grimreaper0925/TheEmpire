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
        if (!deferSuccess) {
            logger.warn(`Reset-chat interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'reset-chat'
            });
            return;
        }

        try {
            const guildId = interaction.guildId;
            const settingsKey = `reset_chat_config_${guildId}`;
            let settings = await getFromDb(settingsKey, null);

            // Fallback to the current channel if no dashboard setup config exists yet
            const channelToReset = settings?.channelId 
                ? interaction.guild.channels.cache.get(settings.channelId) || interaction.channel 
                : interaction.channel;

            const newChannel = await channelToReset.clone({
                reason: `Chat reset requested by ${interaction.user.tag}`,
                position: channelToReset.position
            });

            await channelToReset.delete(`Chat reset requested by ${interaction.user.tag}`);

            await newChannel.send({
                content: '🔄 **Leaderboard Reset!** A new period has started. Start chatting to climb the leaderboard!'
            });

            // Update database settings so the dashboard and timer loop track the new channel and restart the clock
            if (!settings) settings = {};
            settings.channelId = newChannel.id;
            settings.lastReset = new Date().toISOString();
            await setInDb(settingsKey, settings);

            logger.info(`[ManualReset] Channel successfully reset via /reset-chat by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Failed to reset channel:', error);
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'There was an error trying to reset this channel.' 
            });
        }
    },
};