import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { setInDb } from '../../utils/database.js';
import { successEmbed } from '../../utils/embeds.js';
import chatResetDashboard from './modules/chat_reset_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('chat-reset')
        .setDescription('Manage automated chat reset configurations')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the chat reset configuration dashboard'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Clear all automated chat reset slots'),
        ),

    async execute(interaction, config, client) {
        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the **Manage Server** permission to use `/chat-reset`.' });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await chatResetDashboard.execute(interaction, config, client);
            } else if (subcommand === 'disable') {
                await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
                const guildId = interaction.guildId;
                const settingsKey = `reset_chat_configs_${guildId}`; // Fixed to multi-channel key

                // Clear out the array completely
                await setInDb(settingsKey, []);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('🗑️ Auto-Resets Cleared', 'All automated chat reset slots have been completely cleared and disabled.')]
                });
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                return await replyUserError(interaction, { type: ErrorTypes.CONFIGURATION, message: error.userMessage || 'Something went wrong.' });
            }
            await handleInteractionError(interaction, error, { command: 'chat-reset' });
        }
    },
};