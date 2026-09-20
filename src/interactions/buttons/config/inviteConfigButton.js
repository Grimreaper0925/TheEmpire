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
            dmText: 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`'
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
            const modal = new ModalBuilder().setCustomId('invcfg_modal_reward').setTitle('Set Custom Reward Description');
            const input = new TextInputBuilder().setCustomId('input_value').setLabel('Reward description text').setStyle(TextInputStyle.Short).setValue(config.rewardName).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return await interaction.showModal(modal);
        }
        // ... rest of your buttons ...
    }
};