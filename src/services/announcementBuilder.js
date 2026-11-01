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

// `sale` styles pull the live promo (code, percent, countdown) from the store config.
export const ANNOUNCE_STYLES = {
  promo: { label: 'Promo / Sale', emoji: '🔥', color: 0xff3b30, bullets: ['💀', '⚡', '👑', '💎', '🎟️'], sale: true },
  flash: {
    label: 'Flash Sale',
    emoji: '⚡',
    color: 0xff9500,
    bullets: ['⚡', '🔥', '💥', '⏰', '🎟️'],
    sale: true,
    signoffs: ['Gone when the timer hits zero. ⏰', 'Blink and you miss it. ⚡', 'No extensions. No excuses. 🔥'],
  },
  restock: {
    label: 'New Drop / Restock',
    emoji: '📦',
    color: 0x1abc9c,
    bullets: ['📦', '✨', '🆕', '💎', '🛒'],
    signoffs: ['Stock is limited. Grab yours. 📦', 'Fresh in the Empire. 👑'],
  },
  update: {
    label: 'Update / Changelog',
    emoji: '🛠️',
    color: 0x2ecc71,
    bullets: ['✅', '🔧', '🚀', '🧩', '📈'],
    changelog: true,
    signoffs: ['Thanks for being part of the Empire. 👑'],
  },
  news: { label: 'News', emoji: '📢', color: 0x5865f2, bullets: ['📌', '📣', '🧭', '🔔', '🗞️'] },
  event: {
    label: 'Event',
    emoji: '🎉',
    color: 0xf1c40f,
    bullets: ['🎟️', '🎮', '🏆', '🎁', '🎶'],
    signoffs: ["Don't miss it. See you there. 🎉"],
  },
  giveaway: {
    label: 'Giveaway',
    emoji: '🎁',
    color: 0xeb459e,
    bullets: ['🎁', '🏆', '🎟️', '✨', '👑'],
    signoffs: ['Good luck, Empire. 🍀'],
  },
  maintenance: {
    label: 'Maintenance',
    emoji: '🚧',
    color: 0x95a5a6,
    bullets: ['🚧', '🔧', '⏳', '✅', '📍'],
    signoffs: ['Thanks for your patience. 🙏'],
  },
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

const CHANGE_GROUPS = [
  { key: 'added', title: '✨ Added', words: 'added|add|new', mark: '+' },
  { key: 'changed', title: '🔧 Changed', words: 'changed|change|improved|updated', mark: '~' },
  { key: 'fixed', title: '🐛 Fixed', words: 'fixed|fix', mark: '!' },
  { key: 'removed', title: '🗑️ Removed', words: 'removed|remove|deleted', mark: 'x' },
];

/**
 * Groups changelog lines under headings. A line counts if it starts with a word
 * ("Added: ...", "Fixed - ...") or a marker ("+ " added, "~ " changed, "! " fixed,
 * "x " removed). Other lines stay on top as an intro. Returns the text unchanged
 * when nothing looks like a changelog.
 */
export function groupChangelog(body) {
  const groups = new Map(CHANGE_GROUPS.map((g) => [g.key, []]));
  const intro = [];
  let matched = false;

  for (const line of tidy(body).split('\n')) {
    let hit = null;
    for (const g of CHANGE_GROUPS) {
      const word = line.match(new RegExp(`^\\s*(?:${g.words})\\s*[:\\-–]\\s*(.+)$`, 'i'));
      const mark = line.match(new RegExp(`^\\s*${g.mark.replace(/[+~!]/g, '\\$&')}\\s+(.+)$`, g.mark === 'x' ? 'i' : ''));
      const found = word || mark;
      if (found) {
        hit = { key: g.key, text: found[1].trim() };
        break;
      }
    }
    if (hit) {
      groups.get(hit.key).push(hit.text);
      matched = true;
    } else {
      intro.push(line);
    }
  }

  if (!matched) return tidy(body);
  const sections = CHANGE_GROUPS.filter((g) => groups.get(g.key).length > 0).map(
    (g) => `### ${g.title}\n${groups.get(g.key).map((item) => `• ${item}`).join('\n')}`
  );
  return [tidy(intro.join('\n')), ...sections].filter(Boolean).join('\n\n');
}

/** Turns "- item" lines into bullets and bolds percentages and the promo code. */
export function formatBody(body, { bullets, vibe, promoCode, changelog = false }) {
  let n = 0;
  let out = (changelog ? groupChangelog(body) : tidy(body))
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

const pick = (list) => list[Math.floor(Math.random() * list.length)];

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
  const hasBanner = isHttpsUrl(imageUrl) || (typeof imageUrl === 'string' && imageUrl.startsWith('attachment://'));

  const container = new ContainerBuilder().setAccentColor(color ?? style.color);

  if (hasBanner) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl))
    );
  }

  const isSale = Boolean(style.sale);
  const store = isSale ? await getStoreConfig(guild.id) : null;
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
        changelog: Boolean(style.changelog),
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

  if (isSale) {
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

  const styleSignoffs = isSale ? (promoLive ? style.signoffs || PROMO_SIGNOFFS : null) : style.signoffs;
  const signOff = tidy(closing) || (hype && styleSignoffs ? pick(styleSignoffs) : '');
  if (signOff) container.addTextDisplayComponents(text(`*${signOff.slice(0, 200)}*`));

  container.addTextDisplayComponents(text(`-# Posted by ${author} • <t:${Math.floor(Date.now() / 1000)}:f>`));

  const components = [];
  if (pingText) components.push(text(pingText));
  components.push(container);

  return { components, flags: MessageFlags.IsComponentsV2 };
}
