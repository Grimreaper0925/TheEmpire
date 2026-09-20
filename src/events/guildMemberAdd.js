import { Events, EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const guild = member.guild;
        const guildId = guild.id;

        // --- REAL HUMAN & ANTI-BOT VERIFICATION GATE ---
        // 1. Block standard Discord bots immediately
        if (member.user.bot) return;

        // 2. Check if the account has a verified phone number attached to Discord 
        // (Discord flags phone-verified users in member flags or safety states if available, 
        // or we ensure they must pass your server's Verification/AutoVerify module first).
        // If your server uses a verification system (like auto-verify or puzzle gate), 
        // we check if they have completed it before counting their inviter's credit.
        
        // Let's check if the member has a pending verification role or hasn't solved the puzzle yet:
        const isVerified = member.pending === false; // Discord's built-in Membership Screening check
        if (!isVerified) {
            // Member hasn't completed membership screening or puzzle verification yet.
            // We hold off on counting the invite until they finish verifying!
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

        const newInvites = await guild.invites.fetch().catch(() => null);
        if (!newInvites) return;

        // --- INVITE TRACKING & GOAL CHECK ---
        /*
        // When the correct inviter is matched for this verified human:
        if (inviter && validInviteFound) {
            const userKey = `invite_user_${guildId}_${inviter.id}`;
            let userData = await getFromDb(userKey, { uses: 0, rewardChoice: config.rewardName });
            
            userData.uses += 1;
            const targetGoal = config.goal || 10;
            const activeReward = userData.rewardChoice || config.rewardName;

            if (userData.uses === targetGoal && !userData.rewardClaimed) {
                userData.rewardClaimed = true;

                // Send your exact custom DM layout
                try {
                    const formattedDesc = config.dmText.replace('{reward}', activeReward);
                    const userDmEmbed = new EmbedBuilder()
                        .setColor(config.color || 0x5865F2)
                        .setTitle('Invite Goal Achieved!')
                        .setDescription(formattedDesc);

                    await inviter.send({ embeds: [userDmEmbed] });
                } catch (err) {}

                // Notify staff with role tags
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
                            '> *Use `/deliver-reward [user] [key]` to fulfill.*'
                        );

                    if (config.alertChannelId) {
                        const channel = guild.channels.cache.get(config.alertChannelId);
                        if (channel) await channel.send({ content: `🔔 Attention ${roleMention}:`, embeds: [staffEmbed] });
                    }
                } catch (err) {}
            }
            await setInDb(userKey, userData);
        }
        */
    }
};