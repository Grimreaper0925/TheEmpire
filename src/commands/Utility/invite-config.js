import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getFromDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-config')
        .setDescription('Configure invite reward goals, custom rewards, and test delivery')
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
        let config = await getFromDb(configKey, { 
            goal: 10, 
            color: '#5865F2', 
            rewardName: '3-Day Access Key & 30% Off Discount',
            alertChannelId: '' 
        });

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('⚙️ __Invite Rewards Control Panel__')
            .setDescription(
                '> Manage and customize your server’s automated invite tracking parameters.\n\n' +
                '• **Target Goal:** `✨ ' + config.goal + ' successful invites`\n' +
                '• **Configured Reward:** `' + config.rewardName + '`\n' +
                '• **Embed Theme Color:** `' + config.color + '`\n' +
                '• **Staff Alert Channel:** ' + (config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set (Defaulting to Owner DM)`') + '\n\n' +
                '---'
            )
            .setFooter({ text: 'The Empire • Advanced Server Automation' })
            .setTimestamp();

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('invite_config_select')
                .setPlaceholder('🛠️ Select a configuration or test action...')
                .addOptions([
                    { label: 'Set Custom Invite Goal', description: 'Open a prompt to set any invite number', value: 'custom_goal_modal', emoji: '🎯' },
                    { label: 'Set Custom Reward Description', description: 'Change what reward users receive', value: 'custom_reward_modal', emoji: '🎁' },
                    { label: 'Set Alert Channel to Current Channel', description: 'Routes staff fulfillment alerts here', value: 'set_alert_channel', emoji: '📢' },
                    { label: 'Toggle Theme Color (Purple/Green)', description: 'Switch dashboard aesthetic style', value: 'toggle_color', emoji: '🎨' },
                    { label: '🧪 Test Reward Delivery (DM Me)', description: 'Sends a simulated test reward key to your DMs', value: 'test_reward_delivery', emoji: '🚀' }
                ])
        );

        await interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
    }
};