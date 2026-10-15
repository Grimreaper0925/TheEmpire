import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { getStoreConfig, promoIsActive } from './storeService.js';

export const ANNOUNCE_STYLES = {
  promo: { label: 'Promo / Sale', emoji: '🔥', color: 0xff3b30, bullets: ['💀', '⚡', '👑', '💎', '🎟️'] },
  news: { label: 'News', emoji: '📢', color: 0x5865f2, bullets: ['📌', '📣', '🧭', '🔔', '🗞️'] },
  update: { label: 'Update', emoji: '🛠️', color: 0x2ecc71, bullets: ['✅', '🔧', '🚀', '🧩', '📈'] },
  event: { label: 'Event', emoji: '🎉', color: 0xf1c40f, bullets: ['🎟️', '🎮', '🏆', '🎁', '🎶'] },
  alert: { label: 'Important', emoji: '⚠️', color: 0xe67e22, bullets: ['⚠️', '🛑', '🔔', '📛', '🧯'] },
};

export const ANNOUNCE_VIBES = {
  hype: 'Hype (emojis and bold highlights)',
  clean: 'Clean (simple and tidy)',
};

const PROMO_SIGNOFFS = [
  "Don't sleep on this one. 👑",
  'The Empire rewards the quick. ⚡',
  'Grab it before the clock runs out. 🔥',
  'Your move. 😈',
];

const MAX_BODY_CHARS = 2000;
const MAX_POINTS = 10;
const BULLET_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\/[^\s]+$/i.test(value);
}

const NAMED_COLORS = {
  red: 0xed4245,
  orange: 0xe67e22,
  yellow: 0xf1c40f,
  gold: 0xf1c40f,
  green: 0x2ecc71,
  teal: 0x1abc9c,
  blue: 0x3498db,
  purple: 0x9b59b6,
  pink: 0xff69b4,
  white: 0xffffff,
  black: 0x111111,
};

/** Accepts "#ff0000", "ff0000", "f00" or a plain color name like "red". Returns null if it can't. */
export function parseHexColor(value) {
  const input = String(value || '').trim().toLowerCase();
  if (NAMED_COLORS[input] !== undefined) return NAMED_COLORS[input];

  const match = input.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  return parseInt(hex, 16);
}

function tidy(value) {
  return String(value || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Picks a bullet for the Nth list item. Hype rotates emojis so a list isn't a wall of the same one. */
function bulletAt(bullets, index, vibe) {
  return vibe === 'hype' ? bullets[index % bullets.length] : '•';
}

/** Turns "- item" lines into bullets and bolds percentages and the promo code. */
export function formatBody(body, { bullets, vibe, promoCode }) {
  let n = 0;
  let out = tidy(body)
    .split('\n')
    .map((line) => {
      if (!BULLET_MARKER.test(line)) {
        n = 0;
        return line;
      }
      return `${bulletAt(bullets, n++, vibe)} ${line.replace(BULLET_MARKER, '')}`;
    })
    .join('\n');

  if (vibe === 'hype') {
    // Leave anything the admin already formatted (spoilers, inline code, bold) untouched,
    // and only highlight percentages and the promo code in the plain text between.
    const escaped = promoCode ? promoCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    out = out
      .split(/(\|\|[\s\S]*?\|\||`[^`\n]*`|\*\*[\s\S]*?\*\*)/)
      .map((part, i) => {
        if (i % 2 === 1) return part;
        let plain = part.replace(/(?<![\w])(\d{1,3}% ?(?:off|OFF)?)(?![\w])/g, '**$1**');
        if (escaped) {
          plain = plain.replace(new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'g'), `**\`${promoCode}\`**`);
        }
        return plain;
      })
      .join('');
  }
  return out;
}

export function formatPoints(points, { bullets, vibe }) {
  return tidy(points)
    .split('\n')
    .map((line) => line.replace(BULLET_MARKER, '').trim())
    .filter(Boolean)
    .slice(0, MAX_POINTS)
    .map((line, i) => `${bulletAt(bullets, i, vibe)} ${line.slice(0, 200)}`)
    .join('\n');
}

function urgencyTag(endsAt, now = Date.now()) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return null;
  const hours = ms / 3600000;
  if (hours <= 24) return '🚨 LAST DAY';
  if (hours <= 72) return `⚡ ONLY ${Math.ceil(hours / 24)} DAYS LEFT`;
  return null;
}

const SIGNOFF_PICK = () => PROMO_SIGNOFFS[Math.floor(Math.random() * PROMO_SIGNOFFS.length)];

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large);

/**
 * Builds a modern "Components V2" announcement: a colored card with an optional
 * full-width banner, a big title, divider lines, the message in normal chat
 * text, promo details with a countdown, and buttons inside the card.
 *
 * These messages can't have a normal `content` or `embeds`, so the ping is
 * placed as the first text block.
 */
export async function buildAnnouncement({
  guild,
  author,
  styleKey,
  title,
  body,
  imageUrl,
  buttonLabel,
  buttonUrl,
  color,
  pingText,
  tagline,
  points,
  closing,
  vibe = 'hype',
}) {
  const style = ANNOUNCE_STYLES[styleKey] || ANNOUNCE_STYLES.news;
  const icon = guild.iconURL({ size: 256 }) || null;
  const hasBanner = isHttpsUrl(imageUrl);

  const container = new ContainerBuilder().setAccentColor(color ?? style.color);

  if (hasBanner) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl))
    );
  }

  const store = styleKey === 'promo' ? await getStoreConfig(guild.id) : null;
  const promoLive = Boolean(store && promoIsActive(store));
  const hype = vibe === 'hype';

  const urgency = promoLive && hype ? urgencyTag(store.promoEndsAt) : null;
  const topLine = `-# ${style.label.toUpperCase()}  •  ${guild.name}${urgency ? `  •  ${urgency}` : ''}`;
  const taglineLine = tidy(tagline) ? `\n### ${tidy(tagline).slice(0, 150)}` : '';
  const heading = `${topLine}\n# ${hype ? `${style.emoji} ` : ''}${title}${taglineLine}`;

  if (!hasBanner && icon) {
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(text(heading)).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon))
    );
  } else {
    container.addTextDisplayComponents(text(heading));
  }

  container.addSeparatorComponents(divider());
  container.addTextDisplayComponents(
    text(
      formatBody(body, {
        bullets: style.bullets,
        vibe,
        promoCode: promoLive ? store.promoCode : null,
      }).slice(0, MAX_BODY_CHARS)
    )
  );

  const pointsText = formatPoints(points, { bullets: style.bullets, vibe });
  if (pointsText) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(text(`**Highlights**\n${pointsText}`));
  }

  const buttons = [];
  let linkLabel = buttonLabel;
  let linkUrl = buttonUrl;

  if (styleKey === 'promo') {
    if (promoLive) {
      const lines = [`## ${store.promoPercent}% OFF`, `🎟️ Use code **\`${store.promoCode}\`** at checkout`];
      if (store.promoEndsAt) {
        const ts = Math.floor(new Date(store.promoEndsAt).getTime() / 1000);
        lines.push(`⏳ Ends <t:${ts}:R>  •  <t:${ts}:f>`);
      }
      container.addSeparatorComponents(divider());
      container.addTextDisplayComponents(text(lines.join('\n')));

      if (/^[A-Za-z0-9_-]{1,40}$/.test(store.promoCode)) {
        buttons.push(
          new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('Get code').setEmoji('🎟️').setCustomId(`announce_code:${store.promoCode}`)
        );
      }
    }

    if (!linkUrl) {
      linkUrl = store.url;
      linkLabel = linkLabel || 'Shop now';
    }
  }

  if (isHttpsUrl(linkUrl)) {
    buttons.unshift(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(linkUrl).setLabel((linkLabel || 'Learn more').slice(0, 80))
    );
  }

  if (buttons.length > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons.slice(0, 5)));
  }

  const signOff = tidy(closing) || (promoLive && hype ? SIGNOFF_PICK() : '');
  if (signOff) container.addTextDisplayComponents(text(`*${signOff.slice(0, 200)}*`));

  container.addTextDisplayComponents(text(`-# Posted by ${author} • <t:${Math.floor(Date.now() / 1000)}:f>`));

  const components = [];
  if (pingText) components.push(text(pingText));
  components.push(container);

  return { components, flags: MessageFlags.IsComponentsV2 };
}
