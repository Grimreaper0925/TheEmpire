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
            alertChannelId: '',
            staffRoleId: ''
        });

        const selectedValue = interaction.values[0];

        if (selectedValue === 'custom_goal_modal') {
            const modal = new ModalBuilder()
                .setCustomId('invite_modal_goal')
                .setTitle('Set Invite Goal');

            const goalInput = new TextInputBuilder()
                .setCustomId('goal_input')
                .setLabel('Required Invites (Number)')
                .setStyle(TextInputStyle.Short)
                .setValue(String(config.goal))
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(goalInput));
            return await interaction.showModal(modal);
        }

        if (selectedValue === 'custom_reward_modal') {
            const modal = new ModalBuilder()
                .setCustomId('invite_modal_reward')
                .setTitle('Set Reward Description');

            const rewardInput = new TextInputBuilder()
                .setCustomId('reward_input')
                .setLabel('Reward description text')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(config.rewardName)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(rewardInput));
            return await interaction.showModal(modal);
        }

        if (selectedValue === 'custom_role_modal') {
            const modal = new ModalBuilder()
                .setCustomId('invite_modal_role')
                .setTitle('Set Staff Role ID');

            const roleInput = new TextInputBuilder()
                .setCustomId('role_input')
                .setLabel('Staff Role ID to Tag')
                .setStyle(TextInputStyle.Short)
                .setValue(config.staffRoleId || '')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
            return await interaction.showModal(modal);
        }

        if (selectedValue === 'set_alert_channel') {
            config.alertChannelId = interaction.channelId;
            await setInDb(configKey, config);
            return await interaction.reply({ content: `✅ Staff alert channel successfully set to <#${config.alertChannelId}>!`, ephemeral: true });
        }

        if (selectedValue === 'test_full_workflow') {
            try {
                const userDmEmbed = new EmbedBuilder()
                    .setColor(config.color || 0x5865F2)
                    .setTitle('🎉 __Invite Goal Achieved!__')
                    .setDescription(
                        '> **Congratulations!** Your invite goal has been verified.\n\n' +
                        `• **Selected Reward:** \`${config.rewardName}\`\n\n` +
                        'Your fulfillment ticket has been transmitted to server administration. Please allow up to **24 hours** for manual key distribution right here via DM.'
                    )
                    .setFooter({ text: 'The Empire • Automated Reward System' })
                    .setTimestamp();

                await interaction.user.send({ embeds: [userDmEmbed] });

                const roleMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : `<@${interaction.user.id}>`;
                const staffEmbed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle('⏳ __Pending Reward Fulfillment Required__')
                    .setDescription(
                        `> A member has completed the invite target and selected their reward!\n\n` +
                        `• **Member:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                        `• **Target Goal:** \`${config.goal} Invites\`\n` +
                        `• **Chosen Reward:** \`${config.rewardName}\`\n\n` +
                        '> *Use `/deliver-reward [user] [key]` to fulfill this request within 24 hours.*'
                    )
                    .setTimestamp();

                if (config.alertChannelId) {
                    const channel = interaction.guild.channels.cache.get(config.alertChannelId);
                    if (channel) {
                        await channel.send({ content: `🔔 Attention ${roleMention}:`, embeds: [staffEmbed] });
                    }
                } else {
                    await interaction.user.send({ content: `🔔 **Staff Alert Preview (No Channel Set):**`, embeds: [staffEmbed] });
                }

                return await interaction.reply({ 
                    content: '🚀 **Full Workflow Simulation Sent!** Check your DMs for the user confirmation message, and watch your staff channel for the tagged alert.', 
                    ephemeral: true 
                });
            } catch (err) {
                return await interaction.reply({ 
                    content: '❌ **Simulation Failed:** Make sure your DMs are open so the bot can message you.', 
                    ephemeral: true 
                });
            }
        }
    }
};

export default inviteConfigSelectHandler;