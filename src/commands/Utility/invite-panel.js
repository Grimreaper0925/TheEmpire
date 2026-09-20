import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-panel')
        .setDescription('Deploy the interactive Invite Rewards panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Administrator** permission to deploy the invite panel.' });
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferSuccess) return;

        try {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎁 Invite Rewards Program')
                .setDescription(
                    'Want to earn rewards? Share your unique invite link with friends!\n\n' +
                    '🎯 **Goal:** Reach **10 successful invites**.\n' +
                    '🏆 **Rewards (Choose 1 upon completion):**\n' +
                    '• **3-Day Access Key**\n' +
                    '• **30% Off Discount**\n\n' +
                    'Click the buttons below to get your personal link or check your live progress!'
                )
                .setFooter({ text: 'The Empire • Invite System' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('invite_get_link')
                    .setLabel('Get Invite Link')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔗'),
                new ButtonBuilder()
                    .setCustomId('invite_check_progress')
                    .setLabel('My Progress')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📊')
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await InteractionHelper.safeEditReply(interaction, { content: 'Invite panel successfully deployed!' });
        } catch (error) {
            console.error('Failed to deploy invite panel:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to deploy the panel.' });
        }
    },
};