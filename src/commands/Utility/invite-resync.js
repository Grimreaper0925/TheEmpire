import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getFromDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { creditInviteOwner } from '../../events/guildMemberAdd.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-resync')
        .setDescription("Correct everyone's invite progress from Discord's live invite counts")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: '❌ **Access Denied:** You need **Administrator** permissions.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const guildId = guild.id;
        const client = interaction.client;

        const liveInvites = await guild.invites.fetch().catch(err => {
            logger.error(`[Invite] /invite-resync could not fetch live invites for guild ${guildId}:`, err);
            return null;
        });

        if (!liveInvites) {
            return await interaction.editReply({ content: '❌ Could not fetch this server\'s invites — the bot may be missing **Manage Server** permission.' });
        }

        const config = await getFromDb(`invite_config_${guildId}`, { goal: 10, rewardName: '3-Day Access Key' });
        const prefix = `invite_user_${guildId}_`;
        const keys = await client.db.list(prefix);

        if (!keys || keys.length === 0) {
            return await interaction.editReply({ content: 'No invite records exist yet — nothing to resync.' });
        }

        let checked = 0;
        let corrected = 0;
        let totalRecovered = 0;
        const details = [];

        for (const key of keys) {
            if (!key.startsWith(prefix)) continue;
            const ownerId = key.slice(prefix.length);
            const userData = await getFromDb(key, null);
            if (!userData || !userData.inviteCode) continue;

            const liveInvite = liveInvites.get(userData.inviteCode);
            if (!liveInvite) continue; // their link is dead/replaced — nothing live to compare against

            checked += 1;
            const storedUses = userData.uses || 0;
            const delta = liveInvite.uses - storedUses;

            if (delta > 0) {
                await creditInviteOwner(guild, client, config, ownerId, delta);
                corrected += 1;
                totalRecovered += delta;
                details.push(`<@${ownerId}>: \`${storedUses}\` → \`${liveInvite.uses}\` (+${delta})`);
                logger.warn(`[Invite] /invite-resync corrected ${ownerId} in guild ${guildId} from ${storedUses} to ${liveInvite.uses} uses (invite ${userData.inviteCode}).`);
            }
        }

        // Resync doesn't change any invite's use count, so the cache stays valid —
        // just refresh it to the latest fetch for good measure.
        client.invites = client.invites || new Map();
        client.invites.set(guildId, liveInvites);

        if (corrected === 0) {
            return await interaction.editReply({ content: `✅ Checked ${checked} tracked link(s) against Discord's live invite counts — everyone's progress already matches. No corrections needed.` });
        }

        const summary =
            `✅ **Resync complete.** Checked ${checked} tracked link(s), corrected **${corrected}** member(s), recovered **${totalRecovered}** total missed invite(s).\n\n` +
            details.slice(0, 20).join('\n') +
            (details.length > 20 ? `\n...and ${details.length - 20} more.` : '');

        return await interaction.editReply({ content: summary });
    }
};
