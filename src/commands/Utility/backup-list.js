import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { pool } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('backup-list')
        .setDescription('List all available server backups')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permission to view backups.' });
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferSuccess) return;

        try {
            const guildId = interaction.guildId;
            const prefix = `server_backup_${guildId}_`;

            const query = 'SELECT key, value FROM settings WHERE key LIKE $1';
            const result = await pool.query(query, [`${prefix}%`]);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`Server Backups (${result.rows.length})`)
                .setTimestamp();

            if (result.rows.length === 0) {
                embed.setDescription('No backups found for this server. Use `/backup-create` to make one.');
            } else {
                let description = 'Use `/backup-load <ID>` to restore a saved backup.\n\n';
                
                for (const row of result.rows) {
                    const backupData = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                    const backupId = row.key.replace(prefix, '');
                    const channelsCount = (backupData.channels?.categories?.length || 0) + (backupData.channels?.others?.length || 0);
                    const rolesCount = backupData.roles?.length || 0;
                    
                    description += `\`#${backupId}\`\n🧩 ${channelsCount} Channels | 🛡️ ${rolesCount} Roles\n\n`;
                }

                embed.setDescription(description);
            }

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('Failed to list backups:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to retrieve backups.' });
        }
    },
};