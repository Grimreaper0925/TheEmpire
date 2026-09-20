import { EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export const inviteRewardChoiceHandler = {
    name: 'invite_choose_reward',
    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const userKey = `invite_user_${guildId}_${userId}`;

        let userData = await getFromDb(userKey, { uses: 0, rewardChoice: null });
        const chosenReward = interaction.values[0];

        userData.rewardChoice = chosenReward === '3_day_access_key' ? '3-Day Access Key' : '30% Off Discount Code';
        await setInDb(userKey, userData);

        const successEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ __Reward Preference Saved__')
            .setDescription(
                `You have successfully selected:\n> **${userData.rewardChoice}**\n\n` +
                'When you hit your invite goal, staff will know exactly which reward to deliver to you!'
            );

        await interaction.update({ embeds: [successEmbed], components: [] });
    }
};

export default inviteRewardChoiceHandler;