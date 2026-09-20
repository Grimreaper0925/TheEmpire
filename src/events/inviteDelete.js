import { Events, AuditLogEvent, EmbedBuilder } from 'discord.js';
import { getFromDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.InviteDelete,
    async execute(invite, client) {
        try {
            const guild = invite.guild;
            // discord.js only emits this event if the invite's channel is still
            // cached — an invite that dies because its own channel got deleted
            // (e.g. our auto-reset clone+delete) will NOT fire this event. So
            // anything that reaches here is an explicit revoke while the channel
            // still exists — exactly what we want to catch another bot doing.
            if (!guild) return;

            const guildId = guild.id;
            const ownerId = await getFromDb(`invite_owner_${guildId}_${invite.code}`, null);
            if (!ownerId) return; // Not one of our tracked personal invite links

            let executorLabel = 'an unknown actor (no matching audit log entry found)';
            let executor = null;

            const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.InviteDelete, limit: 5 }).catch(err => {
                logger.error(`[Invite] Could not fetch audit logs to identify who deleted invite ${invite.code} (bot may be missing View Audit Log permission):`, err);
                return null;
            });

            if (auditLogs) {
                const matchingEntry = auditLogs.entries.find(entry => entry.target?.code === invite.code);
                if (matchingEntry?.executor) {
                    executor = matchingEntry.executor;
                    executorLabel = `${executor.tag} (${executor.id})${executor.bot ? ' [BOT]' : ''}`;
                }
            }

            logger.warn(`[Invite] Tracked personal invite ${invite.code} (owner ${ownerId}) was deleted in guild ${guildId} by ${executorLabel}.`);

            const config = await getFromDb(`invite_config_${guildId}`, { alertChannelId: '', staffRoleId: '' });
            if (!config.alertChannelId) return;

            const alertChannel = guild.channels.cache.get(config.alertChannelId);
            if (!alertChannel) return;

            const roleMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : `<@${guild.ownerId}>`;
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('⚠️ __Tracked Invite Link Was Deleted__')
                .setDescription(
                    `> A personal invite-reward link was revoked before it should have been.\n\n` +
                    `• **Link Owner:** <@${ownerId}> (\`${ownerId}\`)\n` +
                    `• **Invite Code:** \`${invite.code}\`\n` +
                    `• **Deleted By:** ${executor ? `<@${executor.id}> (\`${executorLabel}\`)` : executorLabel}\n\n` +
                    `> *If this wasn't done intentionally by staff, check other bots in this server (invite-management or auto-moderation modules) — one of them may be revoking invites it doesn't recognize.*`
                )
                .setTimestamp();

            await alertChannel.send({ content: `🔔 Attention ${roleMention}:`, embeds: [embed] }).catch(() => {});
        } catch (error) {
            logger.error('[Invite] Error handling inviteDelete event:', error);
        }
    }
};
