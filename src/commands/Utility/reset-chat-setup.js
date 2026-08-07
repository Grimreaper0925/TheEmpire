import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
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
                .setDescription("Set reset interval in hours (optional)")
                .setRequired(false)
                .setMinValue(1)
        )
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Set reset interval in minutes (optional)")
                .setRequired(false)
                .setMinValue(1)
        ),
    category: "Utility",

    async execute(interaction, config, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guildId = interaction.guildId;
            const channel = interaction.options.getChannel('channel');
            const hours = interaction.options.getInteger('hours');
            const minutes = interaction.options.getInteger('minutes');

            if (!hours && !minutes) {
                return await interaction.editReply({
                    content: 'Please provide either a **hours** or **minutes** option!'
                });
            }

            let intervalMs = 0;
            let timeString = '';

            if (hours) {
                intervalMs += hours * 60 * 60 * 1000;
                timeString += `${hours} hour(s) `;
            }
            if (minutes) {
                intervalMs += minutes * 60 * 1000;
                timeString += `${minutes} minute(s)`;
            }

            const settingsKey = `reset_chat_config_${guildId}`;
            const settingsData = {
                channelId: channel.id,
                intervalMs: intervalMs,
                displayTime: timeString.trim(),
                lastReset: new Date().toISOString()
            };

            await setInDb(settingsKey, settingsData);

            return await interaction.editReply({
                embeds: [
                    successEmbed(
                        "Chat Reset Configured",
                        `Successfully set auto-reset for <#${channel.id}> every **${timeString.trim()}**!`
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
