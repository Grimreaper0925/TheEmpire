import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export const inviteConfigSelectHandler = {
    name: 'invite_config_select',
    async execute(interaction, client) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            return await interaction.reply({ content: '❌ Unauthorized.', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, { 
            goal: 10, 
            color: '#5865F2', 
            rewardName: '3-Day Access Key & 30% Off Discount',
            alertChannelId: '' 
        });

        const selectedValue = interaction.values[0];

        // 1. Handle Custom Goal Modal Trigger
        if (selectedValue === 'custom_goal_modal') {
            const modal = new ModalBuilder()
                .setCustomId('invite_modal_goal')
                .setTitle('Set Invite Goal');

            const goalInput = new TextInputBuilder()
                .setCustomId('goal_input')
                .setLabel('Required Invites (Number only)')
                .setStyle(TextInputStyle.Short)
                .setValue(String(config.goal))
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(goalInput));
            return await interaction.showModal(modal);
        }

        // 2. Handle Custom Reward Description Modal Trigger
        if (selectedValue === 'custom_reward_modal') {
            const modal = new ModalBuilder()
                .setCustomId('invite_modal_reward')
                .setTitle('Set Reward Description');

            const rewardInput = new TextInputBuilder()
                .setCustomId('reward_input')
                .setLabel('Reward description shown on panel')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(config.rewardName)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(rewardInput));
            return await interaction.showModal(modal);
        }

        if (selectedValue === 'set_alert_channel') {
            config.alertChannelId = interaction.channelId;
        } else if (selectedValue === 'toggle_color') {
            config.color = config.color === '#5865F2' ? '#57F287' : '#5865F2';
        } else if (selectedValue === 'test_reward_delivery') {
            try {
                const testEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🧪 __Test Reward Delivery Simulation__')
                    .setDescription(
                        '> This is a test simulation for your invite reward system.\n\n' +
                        `• **Reward Package:** \`${config.rewardName}\`\n` +
                        '• **Test Key:**\n```css\nEMPIRE-TEST-KEY-2026-SUCCESS\n```\n' +
                        'Your reward delivery pipeline is fully functional!'
                    )
                    .setTimestamp();

                await interaction.user.send({ embeds: [testEmbed] });
                return await interaction.reply({ 
                    content: '✅ **Test Successful!** A simulated reward delivery has been sent to your DMs.', 
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
                '• **Configured Reward:** `' + config.rewardName + '`\n' +
                '• **Embed Theme Color:** `' + config.color + '`\n' +
                '• **Staff Channel:** ' + (config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set`')
            )
            .setTimestamp();

        await interaction.update({ embeds: [updatedEmbed] });
    }
};

export default inviteConfigSelectHandler;