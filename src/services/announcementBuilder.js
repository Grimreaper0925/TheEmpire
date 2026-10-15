import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getStoreConfig, promoIsActive } from './storeService.js';

export const ANNOUNCE_STYLES = {
  promo: { label: 'Promo / Sale', emoji: '🔥', color: 0xff3b30, divider: '🔥' },
  news: { label: 'News', emoji: '📢', color: 0x5865f2, divider: '📢' },
  update: { label: 'Update', emoji: '🛠️', color: 0x2ecc71, divider: '🛠️' },
  event: { label: 'Event', emoji: '🎉', color: 0xf1c40f, divider: '🎉' },
  alert: { label: 'Important', emoji: '⚠️', color: 0xe67e22, divider: '⚠️' },
};

const DIVIDER_LENGTH = 7;

function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\/[^\s]+$/i.test(value);
}

/**
 * Builds a polished announcement: styled color and emoji, server icon, a
 * divider, and (for promos) automatic code, discount and countdown fields
 * plus a Shop button taken from /storeconfig.
 */
export async function buildAnnouncement({ guild, styleKey, title, body, imageUrl, buttonLabel, buttonUrl }) {
  const style = ANNOUNCE_STYLES[styleKey] || ANNOUNCE_STYLES.news;
  const icon = guild.iconURL({ size: 256 }) || undefined;

  const divider = Array(DIVIDER_LENGTH).fill(style.divider).join(' ');

  // Built as a plain embed object on purpose. The bot's shared EmbedBuilder strips
  // emojis from titles, descriptions and fields, which made announcements look flat.
  const embed = {
    color: style.color,
    author: { name: `${guild.name}  •  ${style.label}`, ...(icon ? { icon_url: icon } : {}) },
    title: `${style.emoji}  ${title}`.slice(0, 256),
    description: `${divider}\n\n${body}\n\n${divider}`.slice(0, 4096),
    fields: [],
  };

  if (icon) embed.thumbnail = { url: icon };
  if (isHttpsUrl(imageUrl)) embed.image = { url: imageUrl };

  let linkLabel = buttonLabel;
  let linkUrl = buttonUrl;

  if (styleKey === 'promo') {
    const store = await getStoreConfig(guild.id);
    if (promoIsActive(store)) {
      embed.fields.push(
        { name: '🎟️  Code', value: `\`\`\`${store.promoCode}\`\`\``, inline: true },
        { name: '💸  Discount', value: `**${store.promoPercent}% OFF**`, inline: true }
      );
      if (store.promoEndsAt) {
        const ts = Math.floor(new Date(store.promoEndsAt).getTime() / 1000);
        embed.fields.push({ name: '⏳  Ends', value: `<t:${ts}:R>\n<t:${ts}:f>`, inline: true });
      }
    }
    if (!linkUrl) {
      linkUrl = store.url;
      linkLabel = linkLabel || 'Shop now';
    }
  }

  const components = [];
  if (isHttpsUrl(linkUrl)) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(linkUrl)
          .setLabel((linkLabel || 'Learn more').slice(0, 80))
      )
    );
  }

  return { embed, components };
}
