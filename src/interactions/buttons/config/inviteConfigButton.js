import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../../../utils/database.js';

export default {
    name: 'invcfg_btn',
    async execute(interaction, client, args) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            return await interaction.reply({ content: '❌ **Access Denied.**', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, {
            goal: 10, color: '#5865F2', rewardName: '3-Day Access Key', alertChannelId: '', staffRoleId: '',
            dmText: '🎉 **Congratulations!** Your invite goal has been verified.\n\n• **Reward:** `{reward}`\n\nPlease wait up to 24 hours for staff to send your access key!'
        });

        const action = args[0]; // Gets the button action from customId (e.g., invcfg_btn:goal)

        if (action === 'goal') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_goal').setTitle('Set Invite Goal');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Number of invites required').setStyle(TextInputStyle.Short).setValue(String(config.goal)).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'reward') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_reward').setTitle('Set Reward Description');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Reward description text').setStyle(TextInputStyle.Short).setValue(config.rewardName).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'color') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_color').setTitle('Set Embed Hex Color');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Hex Color (e.g. #5865F2)').setStyle(TextInputStyle.Short).setValue(config.color || '#5865F2').setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'dmtext') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_dmtext').setTitle('Set Custom DM Message');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Message (use {reward} for name)').setStyle(TextInputStyle.Short).setValue(config.dmText).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'role') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_role').setTitle('Set Staff Role ID');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Role ID (Leave blank to remove)').setStyle(TextInputStyle.Short).setRequired(false);
            if (config.staffRoleId) input.setValue(config.staffRoleId);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'channel') {
            config.alertChannelId = interaction.channelId;
            await setInDb(configKey, config);
            return await interaction.reply({ content: `✅ Staff alert channel set to <#${config.alertChannelId}>! Run \`/invite-config\` again to refresh panel.`, ephemeral: true });
        }
        if (action === 'test') {
            try {
                const parsedDmText = (config.dmText).replace('{reward}', config.rewardName);
                const userDmEmbed = new EmbedBuilder().setColor(config.color || '#5865F2').setTitle('✅ __Test Delivery__').setDescription(parsedDmText + '\n\n**Test Key:** `TEST-KEY-123`').setTimestamp();
                await interaction.user.send({ embeds: [userDmEmbed] });

                const roleMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : `Staff`;
                const staffEmbed = new EmbedBuilder().setColor('#FEE75C').setTitle('🔔 Test Staff Alert').setDescription(`User ${interaction.user} just reached their goal of **${config.goal}** invites!\nReward: **${config.rewardName}**`).setTimestamp();

                if (config.alertChannelId) {
                    const ch = interaction.guild.channels.cache.get(config.alertChannelId);
                    if (ch) await ch.send({ content: roleMention, embeds: [staffEmbed] });
                } else {
                    await interaction.user.send({ content: `[Staff Alert Preview]:`, embeds: [staffEmbed] });
                }
                return await interaction.reply({ content: '✅ Workflow test complete! Check your DMs and alert channel.', ephemeral: true });
            } catch (e) {
                return await interaction.reply({ content: '❌ Test failed. Please open your DMs.', ephemeral: true });
            }
        }
    }
};