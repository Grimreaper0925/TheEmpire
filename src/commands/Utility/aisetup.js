import { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('aisetup')
        .setDescription('Build your Discord server with AI (channels, roles, permissions)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permission to use `/aisetup`.' });
        }

        const modal = new ModalBuilder()
            .setCustomId('ai_server_builder_modal')
            .setTitle('AI Server Builder')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('server_description_input')
                        .setLabel('Describe your dream server')
                        .setPlaceholder('e.g. gaming community with tickets, team area, events and voice lounges')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );

        await interaction.showModal(modal);
    },
};