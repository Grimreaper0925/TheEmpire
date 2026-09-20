import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getFromDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-config')
        .setDescription('Configure invite reward goals, embed colors, and notification settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ **Access Denied:** You need **Administrator** permissions to manage the invite system.', 
                ephemeral: true 
            });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, { goal: 10, color: '#5865F2', alertChannelId: '' });

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('⚙️ __Invite Rewards Control Panel__')
            .setDescription(
                '> Manage and customize your server’s automated invite tracking parameters.\n\n' +
                '• **Target Goal:** `✨ ' + config.goal + ' successful invites`\n' +
                '• **Embed Theme Color:** `' + config.color + '`\n' +
                '• **Staff Alert Channel:** ' + (config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set (Defaulting to Owner DM)`') + '\n\n' +
                '---'
            )
            .setFooter({ text: 'The Empire • Advanced Server Automation' })
            .setTimestamp();

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('invite_config_select')
                .setPlaceholder('🛠️ Select a configuration action...')
                .addOptions([
                    { label: 'Set Goal to 10 Invites', description: 'Requires users to secure 10 invites', value: 'set_goal_10', emoji: '🎯' },
                    { label: 'Set Goal to 5 Invites', description: 'Requires users to secure 5 invites', value: 'set_goal_5', emoji: '🎯' },
                    { label: 'Set Alert Channel to Current Channel', description: 'Routes staff fulfillment alerts here', value: 'set_alert_channel', emoji: '📢' },
                    { label: 'Toggle Theme Color (Purple/Green)', description: 'Switch dashboard aesthetic style', value: 'toggle_color', emoji: '🎨' }
                ])
        );

        await interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
    }
};