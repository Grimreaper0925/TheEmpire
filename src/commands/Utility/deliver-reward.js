import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('deliver-reward')
        .setDescription('Deliver a pending invite reward to a user via DM')
        .addUserOption(option => 
            option.setName('user').setDescription('The user who completed the invites').setRequired(true))
        .addStringOption(option => 
            option.setName('reward').setDescription('The Access Key or Discount Code to send').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const rewardContent = interaction.options.getString('reward');
        const guildId = interaction.guild.id;
        // Same key inviteButtons.js / guildMemberAdd.js use for this user's invite progress.
        // (Previously pointed at invite_reward_<guildId>_<userId>, a key nothing ever wrote to —
        // this command always failed with "No invite record found" regardless of real progress.)
        const dbKey = `invite_user_${guildId}_${targetUser.id}`;
        const config = await getFromDb(`invite_config_${guildId}`, { goal: 10 });

        let userData = await getFromDb(dbKey, null);
        if (!userData) {
            return await interaction.reply({ content: 'No invite record found for this user.', ephemeral: true });
        }

        if (!userData.rewardClaimed) {
            return await interaction.reply({ content: `❌ **${targetUser.tag}** hasn't reached their invite goal yet (\`${userData.uses || 0}/${config.goal || 10}\`) — nothing pending to deliver.`, ephemeral: true });
        }

        if (userData.rewardDelivered) {
            return await interaction.reply({ content: `⚠️ **${targetUser.tag}**'s reward was already delivered on ${new Date(userData.rewardDeliveredAt).toLocaleString()}.`, ephemeral: true });
        }

        try {
            // Send reward securely to user's DMs
            const rewardEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🎁 Your Invite Reward Has Arrived!')
                .setDescription(
                    `Staff has verified your ${config.goal || 10} invites and fulfilled your reward:\n\n` +
                    `\`\`\`${rewardContent}\`\`\`\n` +
                    'Thank you for supporting the server!'
                )
                .setTimestamp();

            await targetUser.send({ embeds: [rewardEmbed] });

            // Mark reward as delivered so it can't be sent twice
            userData.rewardDelivered = true;
            userData.rewardDeliveredAt = Date.now();
            await setInDb(dbKey, userData);

            await interaction.reply({ content: `Successfully delivered the reward to ${targetUser.tag} via DM!`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `Failed to DM user. Their DMs might be closed.`, ephemeral: true });
        }
    }
};