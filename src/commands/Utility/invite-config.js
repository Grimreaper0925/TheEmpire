import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getFromDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-config')
        .setDescription('Configure invite reward goals, staff notifications, custom rewards, and testing')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ **Access Denied:** You need **Administrator** permissions.', 
                ephemeral: true 
            });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, { 
            goal: 10, 
            color: '#5865F2', 
            rewardName: '3-Day Access Key & 30% Off Discount',
            alertChannelId: '',
            staffRoleId: ''
        });

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('⚙️ __Invite Rewards Control Panel__')
            .setDescription(
                '> Manage and customize your server’s automated invite tracking & staff notifications.\n\n' +
                '• **Target Goal:** `✨ ' + config.goal + ' successful invites`\n' +
                '• **Configured Reward:** `' + config.rewardName + '`\n' +
                '• **Staff Alert Channel:** ' + (config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set (Defaulting to Owner DM)`') + '\n' +
                '• **Staff Notification Role:** ' + (config.staffRoleId ? `<@&${config.staffRoleId}>` : '`Not Set (Tagging Owner/Staff)`') + '\n\n' +
                '---'
            )
            .setFooter({ text: 'The Empire • Advanced Server Automation' })
            .setTimestamp();

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('invite_config_select')
                .setPlaceholder('🛠️ Select a configuration or test action...')
                .addOptions([
                    { label: 'Set Custom Invite Goal', description: 'Change required invite count', value: 'custom_goal_modal', emoji: '🎯' },
                    { label: 'Set Custom Reward Description', description: 'Change reward details text', value: 'custom_reward_modal', emoji: '🎁' },
                    { label: 'Set Alert Channel to Current Channel', description: 'Routes fulfillment alerts here', value: 'set_alert_channel', emoji: '📢' },
                    { label: 'Set Staff Role ID to Tag', description: 'Configure role notified on completion', value: 'custom_role_modal', emoji: '🛡️' },
                    { label: '🧪 Test Staff Alert & Reward Delivery', description: 'Simulates a user hitting the goal & DMs you', value: 'test_full_workflow', emoji: '🚀' },
                    { label: "Reset Everyone's Invite Progress", description: 'DANGER: wipes all links, reward picks & progress', value: 'reset_all_progress', emoji: '⚠️' }
                ])
        );

        await interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
    }
};