import { EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export const inviteConfigSelectHandler = {
    name: 'invite_config_select',
    async execute(interaction, client) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            return await interaction.reply({ content: '❌ Unauthorized.', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, { goal: 10, color: '#5865F2', alertChannelId: '' });

        const selectedValue = interaction.values[0];

        if (selectedValue === 'set_goal_10') {
            config.goal = 10;
        } else if (selectedValue === 'set_goal_5') {
            config.goal = 5;
        } else if (selectedValue === 'set_alert_channel') {
            config.alertChannelId = interaction.channelId;
        } else if (selectedValue === 'toggle_color') {
            config.color = config.color === '#5865F2' ? '#57F287' : '#5865F2';
        }

        await setInDb(configKey, config);

        const updatedEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('⚙️ __Invite Rewards Dashboard__')
            .setDescription(
                '> Settings updated successfully! ✨\n\n' +
                '• **Target Goal:** `✨ ' + config.goal + ' successful invites`\n' +
                '• **Embed Color:** `' + config.color + '`\n' +
                '• **Staff Channel:** ' + (config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set`')
            )
            .setTimestamp();

        await interaction.update({ embeds: [updatedEmbed] });
    }
};

export default inviteConfigSelectHandler;