import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-config')
        .setDescription('Configure invite reward goals, embed colors, and notification settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: '❌ You need **Administrator** permissions to use this command.', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, { goal: 10, color: '#5865F2', alertChannelId: '' });

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('⚙️ __Invite Rewards Dashboard__')
            .setDescription(
                '> Manage your server invite reward system dynamically.\n\n' +
                '• **Target Goal:** `✨ ' + config.goal + ' successful invites`\n' +
                '• **Embed Color:** `' + config.color + '`\n' +
                '• **Staff Channel:** ' + (config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set`')
            )
            .setFooter({ text: 'The Empire • Configuration System' })
            .setTimestamp();

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('invite_config_select')
                .setPlaceholder('🛠️ Choose a configuration option...')
                .addOptions([
                    { label: 'Set Goal to 10 Invites', description: 'Requires users to get 10 invites for rewards', value: 'set_goal_10', emoji: '🎯' },
                    { label: 'Set Goal to 5 Invites', description: 'Requires users to get 5 invites for rewards', value: 'set_goal_5', emoji: '🎯' },
                    { label: 'Set Alert Channel to Current Channel', description: 'Sends staff fulfillment alerts here', value: 'set_alert_channel', emoji: '📢' },
                    { label: 'Toggle Accent Color (Purple/Green)', description: 'Switch dashboard aesthetic theme', value: 'toggle_color', emoji: '🎨' }
                ])
        );

        await interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
    }
};