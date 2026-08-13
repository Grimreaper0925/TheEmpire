import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import backup from 'discord-backup';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getFromDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('backup-load')
        .setDescription('Lädt ein Backup und erstellt alle Kanäle & Rollen')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Die Backup-ID (ohne #)')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Administrator** permissions to load backups.' });
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferSuccess) return;

        const backupId = interaction.options.getString('id');
        const dbKey = `server_backup_${interaction.guildId}_${backupId}`;

        try {
            const backupData = await getFromDb(dbKey, null);
            if (!backupData) {
                return await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: `No backup found with ID \`${backupId}\`.` });
            }

            await backup.load(backupData, interaction.guild, {
                clearGuildBeforeRestore: true,
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('Backup geladen', `Successfully restored server from backup ID \`${backupId}\`!`)]
            });
        } catch (error) {
            console.error('Failed to load backup:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to restore backup. Ensure the bot has Administrator permissions.' });
        }
    },
};