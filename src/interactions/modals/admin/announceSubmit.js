import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { takeAnnouncement, stashAnnouncement, peekAnnouncement } from '../../../services/announceStash.js';
import { renderDraft, statusMessage, DRAFT_TTL_MS } from '../../../services/announceDraft.js';
import { parseWhen, normalizeRepeat } from '../../../services/announceTime.js';
import { logger } from '../../../utils/logger.js';

// Step 1: the form from /announce. Builds a private preview instead of posting straight away.
const announceModal = {
  name: 'announce_modal',
  async execute(interaction, client, args) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Anyone can craft a modal submit, so check the permission again here.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.editReply('You need **Manage Server** to post announcements.');
    }

    const [channelId, pingPart, stashKey] = args;
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return interaction.editReply('I can no longer find that channel.');

    const read = (id) => {
      try {
        return interaction.fields.getTextInputValue(id);
      } catch {
        return '';
      }
    };
    const picked = (stashKey && takeAnnouncement(stashKey)) || { styleKey: 'news' };

    const draft = {
      channelId,
      pingPart: pingPart || 'none',
      options: {
        styleKey: picked.styleKey,
        imageUrl: picked.imageUrl || null,
        buttonLabel: picked.buttonLabel || null,
        buttonUrl: picked.buttonUrl || null,
        color: picked.color ?? null,
        vibe: picked.vibe || 'hype',
      },
      fields: {
        title: read('title'),
        body: read('body'),
        tagline: read('tagline'),
        points: read('points'),
        closing: read('closing'),
      },
      authorId: interaction.user.id,
      authorName: interaction.member?.displayName || interaction.user.username,
      runAt: picked.runAt || null,
      repeat: picked.repeat || 'none',
      whenText: picked.whenText || '',
    };

    try {
      const key = stashAnnouncement(draft, DRAFT_TTL_MS);
      return interaction.editReply(await renderDraft(interaction.guild, draft, key));
    } catch (error) {
      logger.error('Announcement preview failed', { error: error.message });
      return interaction.editReply(`I couldn't build the preview: ${error.message}`);
    }
  },
};

// Step 2 (optional): the "Schedule for later" form opened from the preview.
const whenModal = {
  name: 'announce_when_modal',
  async execute(interaction, client, args) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'You need **Manage Server** to post announcements.', flags: MessageFlags.Ephemeral });
    }

    const key = args[0];
    const draft = peekAnnouncement(key);
    if (!draft) {
      return interaction.update(statusMessage('⌛ This draft expired. Run `/announce` again.'));
    }

    const whenText = interaction.fields.getTextInputValue('when');
    let repeatText = '';
    try {
      repeatText = interaction.fields.getTextInputValue('repeat');
    } catch {
      // field left out
    }

    const parsed = parseWhen(whenText);
    if (parsed.error) return interaction.reply({ content: parsed.error, flags: MessageFlags.Ephemeral });
    const repeat = normalizeRepeat(repeatText);
    if (repeat === null) return interaction.reply({ content: 'Repeat must be `none`, `daily` or `weekly`.', flags: MessageFlags.Ephemeral });

    draft.runAt = parsed.ts;
    draft.repeat = repeat;
    draft.whenText = whenText.trim();

    try {
      return interaction.update(await renderDraft(interaction.guild, draft, key));
    } catch (error) {
      logger.error('Announcement preview failed', { error: error.message });
      return interaction.reply({ content: `I couldn't refresh the preview: ${error.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};

export default [announceModal, whenModal];
