import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

// Invites are permanently tied to the channel ID they were created in — if that
// channel is one of the auto-reset channels in ready.js (cloned + deleted on a
// timer), every invite created there dies the moment the reset runs. Resolve
// the reset-tracked channel IDs for this guild so we can steer clear of them.
async function getResetTrackedChannelIds(guildId) {
    const trackedIds = new Set();

    const configs = await getFromDb(`reset_chat_configs_${guildId}`, []);
    if (Array.isArray(configs)) {
        for (const cfg of configs) {
            if (cfg?.channelId) trackedIds.add(cfg.channelId);
        }
    }

    // Legacy single-object format, still read as a fallback by ready.js
    const legacyCfg = await getFromDb(`reset_chat_config_${guildId}`, null);
    if (legacyCfg?.channelId) trackedIds.add(legacyCfg.channelId);

    return trackedIds;
}

// Picks a channel to create the personal invite in. If the channel the button
// was clicked in is safe (not subject to auto-reset), use it as before. Otherwise
// fall back to another text channel the bot can actually create invites in.
async function resolveSafeInviteChannel(guild, currentChannel) {
    const resetTrackedIds = await getResetTrackedChannelIds(guild.id);

    if (!resetTrackedIds.has(currentChannel.id)) {
        return { channel: currentChannel, wasRelocated: false };
    }

    logger.warn(`[Invite] /invite-panel is deployed in auto-reset channel ${currentChannel.id} (guild ${guild.id}); relocating invite creation to a stable channel.`);

    const fallback = guild.channels.cache.find(ch =>
        ch.isTextBased?.() &&
        !resetTrackedIds.has(ch.id) &&
        ch.viewable &&
        ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite)
    );

    if (!fallback) {
        logger.warn(`[Invite] No safe fallback channel found in guild ${guild.id}; falling back to the auto-reset channel (invite will break on next reset).`);
        return { channel: currentChannel, wasRelocated: false };
    }

    return { channel: fallback, wasRelocated: true };
}

export async function handleInviteButton(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const configKey = `invite_config_${guildId}`;
    const userKey = `invite_user_${guildId}_${userId}`;

    const customId = interaction.customId;

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    let config = await getFromDb(configKey, {
        goal: 10,
        color: '#5865F2',
        rewardName: '3-Day Access Key'
    });

    let userData = await getFromDb(userKey, {
        uses: 0,
        inviteCode: '',
        inviteUrl: '',
        rewardChoice: null
    });

    if (customId === 'invite_get_link' || customId.startsWith('invite_get_link')) {
        try {
            const client = interaction.client;
            let inviteUrl = userData.inviteUrl;
            let relocatedNotice = '';

            if (inviteUrl && userData.inviteCode) {
                // We have a link on file, but Discord invites die permanently if their
                // channel gets deleted or the invite is explicitly revoked — a stale
                // DB record would otherwise keep re-serving a dead link forever. Verify
                // it's actually still live before trusting it.
                const liveInvites = await interaction.guild.invites.fetch().catch(err => {
                    logger.error(`[Invite] Could not verify stored invite ${userData.inviteCode} for user ${userId} in guild ${guildId}:`, err);
                    return null;
                });

                if (liveInvites) {
                    client.invites = client.invites || new Map();
                    client.invites.set(guildId, liveInvites);

                    if (!liveInvites.has(userData.inviteCode)) {
                        logger.warn(`[Invite] Stored invite ${userData.inviteCode} for user ${userId} in guild ${guildId} no longer exists on Discord — issuing a replacement.`);
                        inviteUrl = '';
                        userData.inviteCode = '';
                        userData.inviteUrl = '';
                    }
                }
            }

            if (!inviteUrl || !userData.inviteCode) {
                // Create a brand-new, unique invite link for THIS specific user only.
                // Avoid creating it in a channel that auto-resets (clone+delete), which
                // would permanently break the invite the moment the reset runs.
                const { channel: inviteChannel, wasRelocated } = await resolveSafeInviteChannel(interaction.guild, interaction.channel);
                if (wasRelocated) {
                    relocatedNotice = `\n⚠️ *This channel resets automatically, so your link was created in <#${inviteChannel.id}> to keep it from breaking. Admins: consider moving \`/invite-panel\` to a permanent channel.*`;
                }

                const invite = await interaction.guild.invites.create(inviteChannel.id, {
                    maxAge: 0,   // Never expires
                    maxUses: 0,  // Infinite uses
                    unique: true,
                    reason: `Unique personal invite link for ${interaction.user.tag} (${userId})`
                }).catch(err => {
                    logger.error(`[Invite] Failed to create invite for user ${userId} in guild ${guildId} (channel ${inviteChannel.id}):`, err);
                    return null;
                });

                if (invite) {
                    userData.inviteCode = invite.code;
                    userData.inviteUrl = invite.url;
                    inviteUrl = invite.url;
                    await setInDb(userKey, userData);

                    // Reverse lookup: code -> owner, so guildMemberAdd can find the
                    // real owner instead of trusting invite.inviter (which is always the bot)
                    await setInDb(`invite_owner_${guildId}_${invite.code}`, userId);

                    // Seed the bot's invite cache immediately so the very first use
                    // of this brand-new code isn't invisible to the next diff check
                    client.invites = client.invites || new Map();
                    let guildCache = client.invites.get(guildId);
                    if (!guildCache) {
                        guildCache = await interaction.guild.invites.fetch().catch(() => new Map());
                        client.invites.set(guildId, guildCache);
                    }
                    guildCache.set(invite.code, invite);
                } else if (interaction.guild.vanityURLCode) {
                    // Invite creation failed — fall back to the server's vanity link,
                    // but this link will NOT be tracked/attributed to this user.
                    inviteUrl = `https://discord.gg/${interaction.guild.vanityURLCode}`;
                } else {
                    // No tracked invite and no vanity URL to fall back to — surface a
                    // real error instead of silently handing out a broken discord.gg/ link.
                    return await interaction.editReply({
                        content: '❌ **Error:** Could not create your invite link. This is usually a missing **Create Invite** permission for the bot in this channel — please contact a server admin.'
                    });
                }
            }

            // IF ALREADY LOCKED IN, HIDE DROPDOWN & SHOW LOCKED STATUS
            if (userData.rewardChoice) {
                return await interaction.editReply({
                    content:
                        `# 🔗 __Your Unique Personal Invite Link__\n` +
                        `> Share your personal link below to start earning invite rewards.\n\n` +
                        `• **Your Link:** \`${inviteUrl}\`\n` +
                        `• **Goal Required:** \`${config.goal} Invites\`\n\n` +
                        `🔒 **Locked Reward Choice:** \`${userData.rewardChoice}\`\n` +
                        `> *Your reward preference is permanently locked in!*` +
                        relocatedNotice,
                    components: []
                });
            }

            // SHOW DROPDOWN IF NOT CHOSEN YET
            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('invite_choose_reward')
                    .setPlaceholder('🎁 Select your desired reward (Locks in permanently)...')
                    .addOptions([
                        { label: config.rewardName || '3-Day Access Key', value: 'reward_1', description: 'Primary community access key' },
                        { label: '30% Off Discount', value: 'reward_2', description: 'Exclusive store discount voucher' }
                    ])
            );

            return await interaction.editReply({
                content:
                    `# 🔗 __Your Unique Personal Invite Link__\n` +
                    `> Share your personal link below to start earning invite rewards.\n\n` +
                    `• **Your Link:** \`${inviteUrl}\`\n` +
                    `• **Goal Required:** \`${config.goal} Invites\`\n\n` +
                    `> *Please select your preferred reward from the dropdown below. **Note: This choice will be permanently locked in!***` +
                    relocatedNotice,
                components: [selectMenu]
            });
        } catch (err) {
            logger.error(`[Invite] Unexpected error in invite_get_link for user ${userId} in guild ${guildId}:`, err);
            return await interaction.editReply({ content: '❌ **Error:** Could not generate a unique tracking link. Please try again in a moment.' }).catch(() => {});
        }
    }

    if (customId === 'invite_check_progress' || customId.startsWith('invite_check_progress')) {
        const currentUses = userData.uses || 0;
        const targetGoal = config.goal || 10;
        const progressPercent = Math.min(Math.floor((currentUses / targetGoal) * 100), 100);

        const progressEmbed = new EmbedBuilder()
            .setColor(config.color || 0x5865F2)
            .setTitle('📊 __Your Invite Progress__')
            .setDescription(
                `Here are your current community invite stats:\n\n` +
                `• **Successful Invites:** \`${currentUses} /${targetGoal}\`\n` +
                `• **Progress:** \`${progressPercent}%\`\n` +
                `• **Locked Reward:** \`${userData.rewardChoice || 'Not Selected Yet'}\`\n\n` +
                (currentUses >= targetGoal
                    ? '🎉 **Goal Achieved!** Check your DMs for your fulfillment confirmation.'
                    : `> *Keep sharing your link! You need **${targetGoal - currentUses} more invites** to reach your goal.*`)
            )
            .setTimestamp();

        return await interaction.editReply({ embeds: [progressEmbed] });
    }
}

export default {
    name: 'invite_btn',
    async execute(interaction, client, args) {
        return await handleInviteButton(interaction);
    }
};