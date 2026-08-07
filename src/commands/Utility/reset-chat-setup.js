import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { setInDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName("reset-chat-setup")
        .setDescription("Configure automated channel resets")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("The channel to automatically reset")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("hours")
                .setDescription("How many hours between each reset (e.g., 24)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(168) // Max 1 week
        ),
    category: "Utility",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, true);
        if (!deferSuccess) return;

        try {
            const guildId = interaction.guildId;
            const channel = interaction.options.getChannel('channel');
            const hours = interaction.options.getInteger('hours');

            const settingsKey = `reset_chat_config_${guildId}`;
            const settingsData = {
                channelId: channel.id,
                intervalHours: hours,
                lastReset: new Date().toISOString()
            };

            await setInDb(settingsKey, settingsData);

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Chat Reset Configured",
                        `Successfully set auto-reset for <#${channel.id}> every **${hours} hours**!`
                    )
                ]
            });

        } catch (error) {
            console.error('Failed to configure chat reset:', error);
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'There was an error saving your configuration.' 
            });
        }
    },
};
