import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('backup-list')
        .setDescription('Zeigt alle verfügbaren Backups')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permission to view backups.' });
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferSuccess) return;

        try {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Server Backups')
                .setDescription('Use `/backup-load <ID>` to restore a saved backup.')
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('Failed to list backups:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to retrieve backups.' });
        }
    },
};