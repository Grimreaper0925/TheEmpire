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
        } else if (selectedValue === 'test_reward_delivery') {
            // Test sending a simulated reward DM to the administrator running the test
            try {
                const testEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🧪 __Test Reward Delivery__')
                    .setDescription(
                        '> This is a simulation test for your invite reward system.\n\n' +
                        'Here is your test access key:\n' +
                        '```css\nTEST-KEY-EMPIRE-2026-9999\n```\n' +
                        'Everything is wired up and working smoothly!'
                    )
                    .setTimestamp();

                await interaction.user.send({ embeds: [testEmbed] });
                return await interaction.reply({ 
                    content: '✅ **Test Successful!** A simulated reward message has been sent directly to your DMs.', 
                    ephemeral: true 
                });
            } catch (err) {
                return await interaction.reply({ 
                    content: '❌ **Test Failed:** Could not send you a DM. Make sure your direct messages are open!', 
                    ephemeral: true 
                });
            }
        }

        await setInDb(configKey, config);

        const updatedEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('⚙️ __Invite Rewards Control Panel__')
            .setDescription(
                '> Settings updated successfully! ✨\n\n' +
                '• **Target Goal:** `✨ ' + config.goal + ' successful invites`\n' +
                '• **Embed Theme Color:** `' + config.color + '`\n' +
                '• **Staff Channel:** ' + (config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set`')
            )
            .setTimestamp();

        await interaction.update({ embeds: [updatedEmbed] });
    }
};

export default inviteConfigSelectHandler;