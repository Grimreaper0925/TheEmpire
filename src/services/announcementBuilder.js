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
  promo: { label: 'Promo / Sale', emoji: '🔥', color: 0xff3b30 },
  news: { label: 'News', emoji: '📢', color: 0x5865f2 },
  update: { label: 'Update', emoji: '🛠️', color: 0x2ecc71 },
  event: { label: 'Event', emoji: '🎉', color: 0xf1c40f },
  alert: { label: 'Important', emoji: '⚠️', color: 0xe67e22 },
};

const MAX_BODY_CHARS = 3000;

export function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\/[^\s]+$/i.test(value);
}

export function parseHexColor(value) {
  const match = String(value || '').trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? parseInt(match[1], 16) : null;
}

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

  const heading = `-# ${style.emoji} ${style.label.toUpperCase()}  •  ${guild.name}\n# ${style.emoji} ${title}`;
  if (!hasBanner && icon) {
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(text(heading)).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon))
    );
  } else {
    container.addTextDisplayComponents(text(heading));
  }

  container.addSeparatorComponents(divider());
  container.addTextDisplayComponents(text(String(body).slice(0, MAX_BODY_CHARS)));

  const buttons = [];
  let linkLabel = buttonLabel;
  let linkUrl = buttonUrl;

  if (styleKey === 'promo') {
    const store = await getStoreConfig(guild.id);

    if (promoIsActive(store)) {
      const lines = [`## 💸 ${store.promoPercent}% OFF`, `🎟️ Use code **\`${store.promoCode}\`** at checkout`];
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

  container.addTextDisplayComponents(text(`-# Posted by ${author} • <t:${Math.floor(Date.now() / 1000)}:f>`));

  const components = [];
  if (pingText) components.push(text(pingText));
  components.push(container);

  return { components, flags: MessageFlags.IsComponentsV2 };
}
