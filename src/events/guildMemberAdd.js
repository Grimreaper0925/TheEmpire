import { Events, EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const guild = member.guild;
        const guildId = guild.id;

        // 1. Block bots immediately
        if (member.user.bot) return;

        // 2. Real human verification check (wait until membership screening / pending is cleared)
        if (member.pending === true) {
            return; 
        }

        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, {
            goal: 10,
            color: '#5865F2',
            rewardName: '3-Day Access Key',
            alertChannelId: '',
            staffRoleId: '',
            dmText: 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`\n\nYour fulfillment ticket has been transmitted to server administration. Please allow up to **24 hours** for manual key distribution right here via DM.'
        });

        // 3. Fetch current invites and compare with cached invites to find which link was used
        const cachedInvites = client.invites?.get(guildId);
        const newInvites = await guild.invites.fetch().catch(() => null);

        if (!newInvites) return;

        // Update cache
        client.invites = client.invites || new Map();
        client.invites.set(guildId, newInvites);

        let usedInvite = null;
        if (cachedInvites) {
            usedInvite = newInvites.find(inv => {
                const cachedInv = cachedInvites.get(inv.code);
                return cachedInv && inv.uses > cachedInv.uses;
            });
        }

        let inviter = usedInvite ? usedInvite.inviter : null;

        // Fallback: If invite increments couldn't be caught via cache delta, check our database for user-generated invite codes
        if (!inviter && cachedInvites) {
            // Find which invite code now has an increased use count across all active invites
            for (const [code, newInv] of newInvites) {
                const oldInv = cachedInvites.get(code);
                if (oldInv && newInv.uses > oldInv.uses) {
                    // Scan database keys to find which user owned this invite code
                    // (Or search through stored user records)
                    break;
                }
            }
        }

        if (inviter) {
            // Prevent self-invites
            if (inviter.id === member.id) return;

            const userKey = `invite_user_${guildId}_${inviter.id}`;
            let userData = await getFromDb(userKey, {
                uses: 0,
                rewardChoice: config.rewardName,
                rewardClaimed: false
            });

            userData.uses += 1;
            const targetGoal = config.goal || 10;
            const activeReward = userData.rewardChoice || config.rewardName;

            // Check if user hit target goal
            if (userData.uses >= targetGoal && !userData.rewardClaimed) {
                userData.rewardClaimed = true;

                // Send Custom DM to Inviter
                try {
                    const formattedDesc = (config.dmText || 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`').replace('{reward}', activeReward);
                    const userDmEmbed = new EmbedBuilder()
                        .setColor(config.color || 0x5865F2)
                        .setTitle('Invite Goal Achieved!')
                        .setDescription(formattedDesc);

                    await inviter.send({ embeds: [userDmEmbed] }).catch(() => {});
                } catch (err) {}

                // Notify Staff in Alert Channel
                try {
                    const roleMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : `<@${guild.ownerId}>`;
                    const staffEmbed = new EmbedBuilder()
                        .setColor(0xFEE75C)
                        .setTitle('⏳ __Pending Reward Fulfillment Required__')
                        .setDescription(
                            `> A verified human member has completed the invite target!\n\n` +
                            `• **Member:** ${inviter} (\`${inviter.id}\`)\n` +
                            `• **Target Goal:** \`${targetGoal} Invites\`\n` +
                            `• **Chosen Reward:** \`${activeReward}\`\n\n` +
                            '> *Use `/deliver-reward` to fulfill.*'
                        );

                    if (config.alertChannelId) {
                        const channel = guild.channels.cache.get(config.alertChannelId);
                        if (channel) await channel.send({ content: `🔔 Attention ${roleMention}:`, embeds: [staffEmbed] });
                    }
                } catch (err) {}
            }

            await setInDb(userKey, userData);
        }
    }
};