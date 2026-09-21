import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getFromDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-audit')
        .setDescription("Cross-check every live Discord invite against this bot's tracking records")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: '❌ **Access Denied:** You need **Administrator** permissions.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const guildId = guild.id;

        const liveInvites = await guild.invites.fetch().catch(err => null);
        if (!liveInvites) {
            return await interaction.editReply({ content: '❌ Could not fetch this server\'s invites — the bot may be missing **Manage Server** permission.' });
        }

        if (liveInvites.size === 0) {
            return await interaction.editReply({ content: 'This server has no active invites right now.' });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🔍 Invite Audit')
            .setDescription(`Every live Discord invite in this server (${liveInvites.size} total), matched against the bot's own tracking records.`)
            .setTimestamp();

        for (const inv of liveInvites.values()) {
            const ownerId = await getFromDb(`invite_owner_${guildId}_${inv.code}`, null);

            if (!ownerId) {
                embed.addFields({
                    name: `\`${inv.code}\` — ${inv.uses} use(s)`,
                    value: '⚠️ No owner record — not created via `/invite-panel` (manual invite, or an orphaned/deleted mapping).',
                    inline: false
                });
                continue;
            }

            const userData = await getFromDb(`invite_user_${guildId}_${ownerId}`, null);
            const isCurrentLink = userData?.inviteCode === inv.code;
            const storedTotal = userData ? (userData.uses || 0) : 'no record';

            embed.addFields({
                name: `\`${inv.code}\` — ${inv.uses} use(s)`,
                value: isCurrentLink
                    ? `✅ Owner: <@${ownerId}> — this is their **current** link (their tracked total: \`${storedTotal}\`)`
                    : `⚠️ Owner: <@${ownerId}> — this is an **OLD/replaced** link for them, not their current one (their tracked total: \`${storedTotal}\`). Uses on this code may not be fully reflected in their total.`,
                inline: false
            });
        }

        return await interaction.editReply({ embeds: [embed] });
    }
};
