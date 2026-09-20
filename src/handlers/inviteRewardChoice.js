import { getFromDb, setInDb } from '../utils/database.js';

export const inviteRewardChoiceHandler = {
    name: 'invite_choose_reward',
    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const userKey = `invite_user_${guildId}_${userId}`;
        const configKey = `invite_config_${guildId}`;

        let config = await getFromDb(configKey, { rewardName: '3-Day Access Key' });
        let userData = await getFromDb(userKey, { uses: 0, rewardChoice: null });

        if (userData.rewardChoice) {
            return await interaction.followUp({
                content: `🔒 **Your reward is already permanently locked in as:** \`${userData.rewardChoice}\`.`,
                ephemeral: true
            });
        }

        const selectedVal = interaction.values[0];
        const rewardTitle = selectedVal === 'reward_2' ? '30% Off Discount Code' : (config.rewardName || '3-Day Access Key');

        userData.rewardChoice = rewardTitle;
        await setInDb(userKey, userData);

        return await interaction.followUp({
            content: `✅ **Reward Preference Locked In!**\n> You have successfully selected: **${rewardTitle}**. This choice is now permanent and recorded for server staff!`,
            ephemeral: true
        });
    }
};

export default inviteRewardChoiceHandler;