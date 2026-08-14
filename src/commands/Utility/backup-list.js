import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

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
            const db = interaction.client.db;

            let backupEntries = [];

            if (db && typeof db.list === 'function' && typeof db.get === 'function') {
                let keys = await db.list(prefix);
                if (!Array.isArray(keys) && typeof keys === 'object' && keys !== null) {
                    keys = Object.keys(keys).filter(k => k.startsWith(prefix));
                } else if (!Array.isArray(keys)) {
                    keys = [];
                }

                for (const key of keys) {
                    const rawData = await db.get(key);
                    if (rawData) {
                        const backupData = typeof rawData.value !== 'undefined' ? rawData.value : rawData;
                        const backupId = key.replace(prefix, '');
                        backupEntries.push({ backupId, backupData });
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`Server Backups (${backupEntries.length})`)
                .setTimestamp();

            if (backupEntries.length === 0) {
                embed.setDescription('No backups found for this server. Use `/backup-create` to make one.');
            } else {
                let description = 'Use `/backup-load <ID>` to restore a saved backup.\n\n';
                
                for (const entry of backupEntries) {
                    const { backupId, backupData } = entry;
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