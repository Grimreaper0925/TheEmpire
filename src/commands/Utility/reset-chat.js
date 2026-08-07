import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

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
            const channel = interaction.channel;

            const newChannel = await channel.clone({
                reason: `Chat reset requested by ${interaction.user.tag}`
            });

            await channel.delete(`Chat reset requested by ${interaction.user.tag}`);

            await newChannel.send({
                content: '🔄 **Leaderboard Reset!** A new 24-hour period has started. Start chatting to climb the leaderboard!'
            });

        } catch (error) {
            console.error('Failed to reset channel:', error);
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'There was an error trying to reset this channel.' 
            });
        }
    },
};
