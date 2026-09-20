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
        const userKey = `invite_user_${guildId}_${interaction.user.id}`;

        let config = await getFromDb(configKey, {
            goal: 10, 
            color: '#5865F2', 
            rewardName: '3-Day Access Key', 
            alertChannelId: '', 
            staffRoleId: ''
        });

        // Pull the user's actual selected reward choice from their session if available
        let userData = await getFromDb(userKey, { rewardChoice: '3-Day Access Key' });
        const selectedReward = userData.rewardChoice || config.rewardName || '3-Day Access Key';

        const action = args[0];

        if (action === 'goal') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_goal').setTitle('Set Invite Goal');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Number of invites required').setStyle(TextInputStyle.Short).setValue(String(config.goal)).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'reward') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_reward').setTitle('Set Default Reward');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Default reward description').setStyle(TextInputStyle.Short).setValue(config.rewardName || '3-Day Access Key').setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'color') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_color').setTitle('Set Embed Hex Color');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Hex Color (e.g. #5865F2)').setStyle(TextInputStyle.Short).setValue(config.color || '#5865F2').setRequired(true);
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
            return await interaction.reply({ content: `✅ Staff alert channel set to <#${config.alertChannelId}>!`, ephemeral: true });
        }
        if (action === 'test') {
            try {
                // --- EXACT IMAGE 1 STYLE USER DM ---
                const userDmEmbed = new EmbedBuilder()
                    .setColor(config.color || 0x5865F2)
                    .setTitle('Invite Goal Achieved!')
                    .setDescription(
                        '| Congratulations! Your invite goal has been verified.\n\n' +
                        `• **Selected Reward:** \`${selectedReward}\`\n\n` +
                        'Your fulfillment ticket has been transmitted to server administration. Please allow up to **24 hours** for manual key distribution right here via DM.'
                    );

                await interaction.user.send({ embeds: [userDmEmbed] });

                // --- STAFF TAG NOTIFICATION ALERT ---
                const roleMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : `<@${interaction.user.id}>`;
                const staffEmbed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle('⏳ __Pending Reward Fulfillment Required__')
                    .setDescription(
                        `> A member has completed the invite target and selected their reward!\n\n` +
                        `• **Member:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                        `• **Target Goal:** \`${config.goal} Invites\`\n` +
                        `• **Chosen Reward:** \`${selectedReward}\`\n\n` +
                        '> *Use `/deliver-reward [user] [key]` to fulfill this request.*'
                    )
                    .setTimestamp();

                if (config.alertChannelId) {
                    const ch = interaction.guild.channels.cache.get(config.alertChannelId);
                    if (ch) {
                        await ch.send({ content: `🔔 Attention ${roleMention}:`, embeds: [staffEmbed] });
                    }
                } else {
                    await interaction.user.send({ content: `🔔 **Staff Alert Preview:**`, embeds: [staffEmbed] });
                }

                return await interaction.reply({ content: '✅ **Test Workflow Sent!** Check your DMs for Image 1 style layout and your channel for the staff tag.', ephemeral: true });
            } catch (e) {
                return await interaction.reply({ content: '❌ Test failed. Please open your DMs.', ephemeral: true });
            }
        }
    }
};