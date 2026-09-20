import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'javascript' // (or discord.js)
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-config')
        .setDescription('Configure invite reward goals, embed colors, and notification channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: 'You need Administrator permissions.', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, { goal: 10, color: '#5865F2', alertChannelId: '' });

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('⚙️ Invite Rewards Dashboard')
            .setDescription('Manage your server invite reward settings below:')
            .addFields(
                { name: 'Target Goal', value: `\`${config.goal} invites\``, inline: true },
                { name: 'Embed Color', value: `\`${config.color}\``, inline: true },
                { name: 'Staff Alert Channel', value: config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set`', inline: false }
            );

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('invite_config_select')
                .setPlaceholder('Choose a setting to change...')
                .addOptions([
                    { label: 'Set Goal to 10 Invites', value: 'set_goal_10' },
                    { label: 'Set Goal to 5 Invites', value: 'set_goal_5' },
                    { label: 'Set Current Channel for Staff Alerts', value: 'set_alert_channel' },
                    { label: 'Toggle Theme Color (Purple/Green)', value: 'toggle_color' }
                ])
        );

        await interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
    }
};