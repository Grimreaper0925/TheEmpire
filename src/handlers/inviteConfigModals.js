import { EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export const inviteConfigModalHandler = {
    name: 'invite_modal_',
    async execute(interaction, client) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            return await interaction.reply({ content: '❌ Unauthorized.', ephemeral: true });
        }

        // Acknowledge the modal right away to prevent "Invalid Input" timeout errors
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, { 
            goal: 10, 
            color: '#5865F2', 
            rewardName: '3-Day Access Key & 30% Off Discount',
            alertChannelId: '',
            staffRoleId: ''
        });

        if (interaction.customId === 'invite_modal_goal') {
            const val = interaction.fields.getTextInputValue('goal_input');
            const newGoal = parseInt(val, 10);
            if (isNaN(newGoal) || newGoal <= 0) {
                return await interaction.editReply({ content: '❌ Please enter a valid positive number for the invite goal.' });
            }
            config.goal = newGoal;
        } else if (interaction.customId === 'invite_modal_reward') {
            config.rewardName = interaction.fields.getTextInputValue('reward_input');
        } else if (interaction.customId === 'invite_modal_role') {
            config.staffRoleId = interaction.fields.getTextInputValue('role_input').trim();
        }

        await setInDb(configKey, config);

        const successEmbed = new EmbedBuilder()
            .setColor(config.color || 0x5865F2)
            .setTitle('✅ __Configuration Updated Successfully__')
            .setDescription(
                `Your invite reward settings have been saved:\n\n` +
                `• **Invite Goal:** \`${config.goal}\`\n` +
                `• **Reward Description:** \`${config.rewardName}\`\n` +
                `• **Staff Role ID:** \`${config.staffRoleId || 'None (Tagging Owner/Staff)'}\``
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });
    }
};

export default inviteConfigModalHandler;