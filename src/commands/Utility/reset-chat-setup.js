import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
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
        .addStringOption(option =>
            option
                .setName("type")
                .setDescription("Choose time unit")
                .setRequired(true)
                .addChoices(
                    { name: 'Minutes', value: 'minutes' },
                    { name: 'Hours', value: 'hours' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Amount of minutes or hours between resets")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080) // up to a week in minutes
        ),
    category: "Utility",

    async execute(interaction, config, client) {
        // Acknowledge the interaction immediately to prevent timeout errors
        await interaction.deferReply({ ephemeral: true });

        try {
            const guildId = interaction.guildId;
            const channel = interaction.options.getChannel('channel');
            const type = interaction.options.getString('type');
            const amount = interaction.options.getInteger('amount');

            // Convert everything to milliseconds for calculation
            let intervalMs = amount * 60 * 1000; // default minutes
            if (type === 'hours') {
                intervalMs = amount * 60 * 60 * 1000;
            }

            const settingsKey = `reset_chat_config_${guildId}`;
            const settingsData = {
                channelId: channel.id,
                intervalMs: intervalMs,
                displayTime: `${amount} ${type}`,
                lastReset: new Date().toISOString()
            };

            await setInDb(settingsKey, settingsData);

            return await interaction.editReply({
                embeds: [
                    successEmbed(
                        "Chat Reset Configured",
                        `Successfully set auto-reset for <#${channel.id}> every **${amount} ${type}**!`
                    )
                ]
            });

        } catch (error) {
            console.error('Failed to configure chat reset:', error);
            return await interaction.editReply({ 
                content: 'There was an error saving your configuration.' 
            });
        }
    },
};
