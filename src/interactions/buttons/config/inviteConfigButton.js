import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../../../../utils/database.js';

export default {
    name: 'invcfg_btn',
    async execute(interaction, client, args) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            return await interaction.reply({ content: '❌ **Access Denied.**', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, {
            goal: 10, 
            color: '#5865F2', 
            rewardName: '3-Day Access Key', 
            alertChannelId: '', 
            staffRoleId: '',
            dmText: 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`\n\nYour fulfillment ticket has been transmitted to server administration. Please allow up to **24 hours** for manual key distribution right here via DM.'
        });

        if (!config.rewardName) config.rewardName = '3-Day Access Key';
        const action = args[0];

        if (action === 'goal') {
            const modal = new ModalBuilder().setCustomId('invcfg_modal_goal').setTitle('Set Invite Goal');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Number of invites required').setStyle(TextInputStyle.Short).setValue(String(config.goal)).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        if (action === 'reward') {
            // FIXED: Custom ID matches the modal handler below
            const modal = new ModalBuilder().setCustomId('invcfg_modal_reward').setTitle('Set Custom Reward Description');
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
            return await interaction.reply({ content: `✅ Staff alert channel set to <#${config.alertChannelId}>!`, ephemeral: true });
        }
        if (action === 'test') {
            try {
                const rawDmTemplate = config.dmText || 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`';
                const formattedDescription = rawDmTemplate.replace('{reward}', config.rewardName);

                const userDmEmbed = new EmbedBuilder()
                    .setColor(config.color || 0x5865F2)
                    .setTitle('Invite Goal Achieved!')
                    .setDescription(formattedDescription);

                await interaction.user.send({ embeds: [userDmEmbed] });
                return await interaction.reply({ content: '✅ Test workflow complete! Check your DMs.', ephemeral: true });
            } catch (e) {
                return await interaction.reply({ content: '❌ Test failed. Please open your DMs.', ephemeral: true });
            }
        }
    }
};