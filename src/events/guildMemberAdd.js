import { Events, EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const guild = member.guild;
        const guildId = guild.id;

        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, {
            goal: 10,
            color: '#5865F2',
            rewardName: '3-Day Access Key',
            alertChannelId: '',
            staffRoleId: '',
            dmText: 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`\n\nYour fulfillment ticket has been transmitted to server administration. Please allow up to **24 hours** for manual key distribution right here via DM.'
        });

        const newInvites = await guild.invites.fetch().catch(() => null);
        if (!newInvites) return;

        // Inside your invite check block where you match the inviter:
        if (userData && userData.inviteCode === usedInvite.code) {
            userData.uses = (userData.uses || 0) + 1;
            
            const targetGoal = config.goal || 10;
            const activeReward = userData.rewardChoice || config.rewardName || '3-Day Access Key';

            // Check if they just hit the configured goal
            if (userData.uses === targetGoal && !userData.rewardClaimed) {
                userData.pendingReward = true;
                userData.rewardTimestamp = Date.now();

                // 1. DM the user using your custom Probot-style text template & chosen reward
                try {
                    const rawDmTemplate = config.dmText || 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`\n\nYour fulfillment ticket has been transmitted to server administration. Please allow up to **24 hours** for manual key distribution right here via DM.';
                    const formattedDescription = rawDmTemplate.replace('{reward}', activeReward);

                    const userDmEmbed = new EmbedBuilder()
                        .setColor(config.color || 0x5865F2)
                        .setTitle('Invite Goal Achieved!')
                        .setDescription(formattedDescription);

                    await inviter.send({ embeds: [userDmEmbed] });
                } catch (e) {}

                // 2. Notify staff in their designated channel or fallback to owner/staff role
                const roleMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : `<@${guild.ownerId}>`;
                const staffAlertEmbed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setTitle('⏳ __Pending Reward Fulfillment Required__')
                    .setDescription(
                        `> A member has completed the invite target and selected their reward!\n\n` +
                        `• **Member:** ${inviter} (\`${inviter.id}\`)\n` +
                        `• **Target Goal:** \`${targetGoal} Invites\`\n` +
                        `• **Chosen Reward:** \`${activeReward}\`\n\n` +
                        '> *Use `/deliver-reward [user] [key]` to fulfill this request.*'
                    )
                    .setTimestamp();

                try {
                    if (config.alertChannelId) {
                        const channel = guild.channels.cache.get(config.alertChannelId);
                        if (channel) {
                            await channel.send({ content: `🔔 Attention ${roleMention}:`, embeds: [staffAlertEmbed] });
                        }
                    } else {
                        const owner = await guild.fetchOwner();
                        await owner.send({ embeds: [staffAlertEmbed] });
                    }
                } catch (e) {}
            }

            const dbKey = `invite_user_${guildId}_${inviter.id}`;
            await setInDb(dbKey, userData);
        }
    }
};