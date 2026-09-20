import { EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export const inviteConfigModalHandler = {
    name: 'invite_modal_',
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

        if (interaction.customId === 'invite_modal_goal') {
            const newGoal = parseInt(interaction.fields.getTextInputValue('goal_input'), 10);
            if (isNaN(newGoal) || newGoal <= 0) {
                return await interaction.reply({ content: '❌ Please enter a valid number for the invite goal.', ephemeral: true });
            }
            config.goal = newGoal;
        } else if (interaction.customId === 'invite_modal_reward') {
            const newReward = interaction.fields.getTextInputValue('reward_input');
            config.rewardName = newReward;
        }

        await setInDb(configKey, config);

        const successEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('✅ __Configuration Updated__')
            .setDescription(
                `Successfully saved changes!\n\n` +
                `• **New Goal:** \`${config.goal} invites\`\n` +
                `• **New Reward:** \`${config.rewardName}\``
            )
            .setTimestamp();

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    }
};

export default inviteConfigModalHandler;