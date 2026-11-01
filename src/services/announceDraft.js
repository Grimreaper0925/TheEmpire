import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, TextDisplayBuilder } from 'discord.js';
import { buildAnnouncement } from './announcementBuilder.js';
import { pingRules } from './announceSchedule.js';
import { describeRepeat } from './announceTime.js';

export const DRAFT_TTL_MS = 30 * 60 * 1000;

const text = (content) => new TextDisplayBuilder().setContent(content);

export function pingLabel(pingPart) {
  if (pingPart === 'everyone') return '@everyone';
  if (!pingPart || pingPart === 'none') return 'nobody';
  return `<@&${pingPart}>`;
}

/** Message payload for a one-line status (used after posting, scheduling, cancelling or expiry). */
export function statusMessage(content) {
  return { components: [text(content)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

/** The private preview: the real announcement card plus Post / Schedule / Cancel buttons. */
export async function renderDraft(guild, draft, key) {
  const { pingText } = pingRules(draft.pingPart);
  const built = await buildAnnouncement({
    guild,
    author: draft.authorName,
    styleKey: draft.options.styleKey,
    title: draft.fields.title,
    body: draft.fields.body,
    imageUrl: draft.options.imageUrl,
    buttonLabel: draft.options.buttonLabel,
    buttonUrl: draft.options.buttonUrl,
    color: draft.options.color ?? undefined,
    pingText,
    tagline: draft.fields.tagline,
    points: draft.fields.points,
    closing: draft.fields.closing,
    vibe: draft.options.vibe || 'hype',
  });

  const scheduled = Boolean(draft.runAt);
  const when = scheduled
    ? `🕒 **Scheduled** for <t:${Math.floor(draft.runAt / 1000)}:F> (<t:${Math.floor(draft.runAt / 1000)}:R>), ${describeRepeat(draft.repeat)}`
    : '⚡ **Posts right away** when you press the button';

  const header = text(
    `### 👀 Preview (not posted yet)\n` +
      `Channel: <#${draft.channelId}>  •  Ping: ${pingLabel(draft.pingPart)}\n${when}`
  );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`announce_go:${key}`)
      .setStyle(ButtonStyle.Success)
      .setLabel(scheduled ? 'Schedule it' : 'Post now')
      .setEmoji(scheduled ? '🕒' : '📢'),
    new ButtonBuilder()
      .setCustomId(`announce_when:${key}`)
      .setStyle(ButtonStyle.Primary)
      .setLabel(scheduled ? 'Change time' : 'Schedule for later')
      .setEmoji('📅'),
    new ButtonBuilder().setCustomId(`announce_cancel:${key}`).setStyle(ButtonStyle.Danger).setLabel('Cancel')
  );

  return {
    components: [header, ...built.components, buttons],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}
