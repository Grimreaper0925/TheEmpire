import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import backup from 'discord-backup';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { setInDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('backup-create')
        .setDescription('Erstellt ein Backup des Servers (Kanäle & Rollen)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permission to create backups.' });
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferSuccess) return;

        try {
            // Ensure bot has Administrator permissions in the server
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.Administrator)) {
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'I need **Administrator** permission to create backups of channels and roles.' });
            }

            const backupData = await backup.create(interaction.guild, {
                saveMessages: false,
                disableEveryone: true,
                jsonBeautify: false,
            });

            const backupId = backupData.id;
            const guildId = interaction.guildId;
            const dbKey = `server_backup_${guildId}_${backupId}`;

            await setInDb(dbKey, backupData);

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('Backup erstellt')
                .setDescription('Dein Server-Backup wurde erfolgreich gespeichert!')
                .addFields(
                    { name: 'Backup-ID', value: `\`#${backupId}\`` },
                    { name: 'Kanäle', value: `${(backupData.channels?.categories?.length || 0) + (backupData.channels?.others?.length || 0)}`, inline: true },
                    { name: 'Rollen', value: `${backupData.roles?.length || 0}`, inline: true },
                    { name: 'Läuft ab', value: 'in 6 days', inline: false }
                )
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('Backup creation detailed error:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Failed to create server backup: ${error.message || 'Unknown error'}` });
        }
    },
};