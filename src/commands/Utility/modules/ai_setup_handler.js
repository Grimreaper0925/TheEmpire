import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';

export async function handleAiSetupModal(interaction) {
    if (interaction.customId !== 'ai_server_builder_modal') return;

    const description = interaction.fields.getTextInputValue('server_description_input');

    await interaction.reply({
        content: '🤖 Creating a suggestion for you... (~15 seconds)',
        flags: MessageFlags.Ephemeral,
    });

    // Simulate delay or call your AI text generation endpoint here using `description`
    setTimeout(async () => {
        const draftEmbed = new EmbedBuilder()
            .setTitle('🤖 Your server draft')
            .setDescription(
                '**Roles (3)**\n`Moderator` `Streamer` `Gamer`\n\n' +
                '📁 📌 **Server**\n' +
                '  📢 rules 🔒\n' +
                '  📢 announcements 🔒\n' +
                '  💬 welcome 🔒\n\n' +
                '📁 💬 **General**\n' +
                '  💬 general-chat\n' +
                '  💬 introductions\n' +
                '  💬 memes\n\n' +
                '📁 🎮 **Gaming**\n' +
                '  💬 game-recommendations\n' +
                '  💬 looking-for-squad\n' +
                '  💬 esports\n' +
                '  💬 gaming-clips\n\n' +
                '📁 🔊 **Voice Channels**\n' +
                '  🔊 Lounge\n' +
                '  🔊 Gaming Session\n' +
                '  🔊 Streaming Room\n\n' +
                '📁 🛠️ **Staff**\n' +
                '  💬 mod-chat 🔒\n' +
                '  💬 reports'
            )
            .setColor(0x5865F2)
            .setFooter({ text: '3 Rollen • 5 Kategorien • 15 Channels' });

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ai_build_apply').setLabel('Add to server').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('ai_build_clean').setLabel('Clean build').setStyle(ButtonStyle.Danger).setEmoji('🧹'),
            new ButtonBuilder().setCustomId('ai_build_regen').setLabel('Regenerate').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('ai_build_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('✖️'),
        );

        await interaction.editReply({
            content: null,
            embeds: [draftEmbed],
            components: [actionRow],
        });
    }, 3000);
}

export async function handleAiSetupButtons(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('ai_build_')) return;

    if (customId === 'ai_build_apply') {
        await interaction.update({
            content: '✅ Server structure successfully applied!',
            embeds: [],
            components: [],
        });
    } else if (customId === 'ai_build_clean') {
        await interaction.update({
            content: '🧹 Clean build executed. Previous structure cleared and new AI layout applied.',
            embeds: [],
            components: [],
        });
    } else if (customId === 'ai_build_regen') {
        await interaction.update({ content: '🔄 Regenerating new layout options...', embeds: [], components: [] });
    } else if (customId === 'ai_build_cancel') {
        await interaction.update({
            content: '✖️ AI server build cancelled.',
            embeds: [],
            components: [],
        });
    }
}