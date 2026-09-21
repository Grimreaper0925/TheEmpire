import { Events, EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

// Attribution works by diffing invite use-counts between two guild.invites.fetch()
// snapshots. That's only safe if joins are handled one at a time per guild —
// two joins landing close together (exactly what a successful shared invite link
// produces) can otherwise both read the same stale cache and get attributed to
// the same invite, or lose a count entirely. Serialize processing per guild.
const guildProcessingQueues = new Map();

function withGuildLock(guildId, task) {
    const previous = guildProcessingQueues.get(guildId) || Promise.resolve();
    const next = previous.then(task, task);
    guildProcessingQueues.set(guildId, next.catch(() => {}));
    return next;
}

// Exported so guildMemberUpdate.js can credit the invite once a member who was
// held by Membership Screening (pending: true) finally accepts the rules —
// guildMemberAdd returns early for pending members and never revisits them.
export async function processInviteJoin(member, client) {
    const guildId = member.guild.id;
    return withGuildLock(guildId, () => trackInviteJoin(member, client));
}

async function trackInviteJoin(member, client) {
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

    // Fetch current invites and compare with cached invites to find which link(s) were used
    const cachedInvites = client.invites?.get(guildId);
    const newInvites = await guild.invites.fetch().catch(err => {
        logger.error(`[Invite] Failed to fetch invites for guild ${guildId} (needs Manage Server permission) — invite-reward tracking is silently broken for this join:`, err);
        return null;
    });

    if (!newInvites) return;

    // No baseline yet for this guild (fresh boot, or ready.js's startup seed
    // hasn't run/failed for it). We can't tell old uses from new ones, so just
    // record the current snapshot as the baseline and skip crediting — the
    // alternative (treating every existing use as "brand new") would dump a
    // server's ENTIRE historical invite count onto whoever joins first.
    if (!cachedInvites) {
        logger.warn(`[Invite] No cached invite baseline yet for guild ${guildId} — seeding from ${member.user.tag}'s join without crediting anyone (expected right after a restart).`);
        client.invites = client.invites || new Map();
        client.invites.set(guildId, newInvites);
        return;
    }

    // Diff every invite against the cached baseline rather than stopping at the
    // first one that changed. A flat "+1 to whoever's link changed" silently
    // undercounts whenever more than one join lands in the same fetch window —
    // e.g. several friends clicking the same link within moments of each other,
    // or several joins queued up behind this guild's processing lock. Each
    // invite's own use-count delta tells us exactly how many real joins it
    // picked up since the last check, however many that is.
    let anyDeltaFound = false;

    for (const inv of newInvites.values()) {
        const cachedInv = cachedInvites.get(inv.code);
        const previousUses = cachedInv ? cachedInv.uses : 0;
        const delta = inv.uses - previousUses;
        if (delta <= 0) continue;

        anyDeltaFound = true;

        // IMPORTANT: never trust inv.inviter here — bot-created invites always
        // attribute to the bot itself, not the user the link was made for.
        const ownerId = await getFromDb(`invite_owner_${guildId}_${inv.code}`, null);
        if (!ownerId) {
            logger.warn(`[Invite] Detected ${delta} new use(s) of invite ${inv.code} in guild ${guildId} (uses now ${inv.uses}), but no invite_owner_${guildId}_${inv.code} record exists — not tracked as a personal link.`);
            continue;
        }

        // Prevent self-invites: if this exact join is the owner's own and the
        // invite only picked up one use, that use is this join — don't credit it.
        // (With delta > 1 we can't tell whose join was whose, so let the batch
        // through rather than risk swallowing real friends' invites too.)
        if (ownerId === member.id && delta === 1) continue;

        await creditInviteOwner(guild, client, config, ownerId, delta);
    }

    if (!anyDeltaFound) {
        const snapshot = newInvites.map(inv => `${inv.code}:${inv.uses}(cached:${cachedInvites.get(inv.code)?.uses ?? 'none'})`).join(', ');
        logger.warn(`[Invite] No invite use-count increase detected for ${member.user.tag}'s join in guild ${guildId} — likely already credited by another join processed just before this one, or joined via an untracked method (vanity URL, server discovery). Live invites: [${snapshot}]`);
    }

    client.invites = client.invites || new Map();
    client.invites.set(guildId, newInvites);
}

// Exported so /invite-resync can reuse the exact same threshold/DM/alert logic
// when correcting historical undercounts from Discord's live invite numbers.
export async function creditInviteOwner(guild, client, config, ownerId, amount) {
    const guildId = guild.id;
    const userKey = `invite_user_${guildId}_${ownerId}`;
    let userData = await getFromDb(userKey, {
        uses: 0,
        rewardChoice: config.rewardName,
        rewardClaimed: false
    });

    userData.uses += amount;
    const targetGoal = config.goal || 10;
    const activeReward = userData.rewardChoice || config.rewardName;

    // Check if user hit target goal
    if (userData.uses >= targetGoal && !userData.rewardClaimed) {
        userData.rewardClaimed = true;

        // Fetch the real inviter's user object for the DM
        let inviterUser = null;
        try {
            inviterUser = await client.users.fetch(ownerId);
        } catch (err) {}

        // Send Custom DM to Inviter
        if (inviterUser) {
            try {
                const formattedDesc = (config.dmText || 'Congratulations! Your invite goal has been verified.\n\n• **Selected Reward:** `{reward}`').replace('{reward}', activeReward);
                const userDmEmbed = new EmbedBuilder()
                    .setColor(config.color || 0x5865F2)
                    .setTitle('Invite Goal Achieved!')
                    .setDescription(formattedDesc);

                await inviterUser.send({ embeds: [userDmEmbed] }).catch(() => {});
            } catch (err) {}
        }

        // Notify Staff in Alert Channel
        try {
            const roleMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : `<@${guild.ownerId}>`;
            const staffEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('⏳ __Pending Reward Fulfillment Required__')
                .setDescription(
                    `> A verified human member has completed the invite target!\n\n` +
                    `• **Member:** <@${ownerId}> (\`${ownerId}\`)\n` +
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

export default {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        // 1. Block bots immediately
        if (member.user.bot) return;

        // 2. Real human verification check (Membership Screening / rules gate).
        // Don't count yet — guildMemberUpdate.js picks this member back up and
        // credits the invite once `pending` flips to false.
        if (member.pending === true) {
            return;
        }

        await processInviteJoin(member, client);
    }
};
