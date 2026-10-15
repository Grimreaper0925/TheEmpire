import {
  ActionRowBuilder,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export const PING_ROLES = [
  { key: 'sales', name: 'Sales Ping', emoji: '💸', description: 'Get pinged for sales and discount codes', color: 0x2ecc71 },
  { key: 'giveaways', name: 'Giveaway Ping', emoji: '🎁', description: 'Get pinged when a giveaway starts', color: 0xf1c40f },
  { key: 'news', name: 'News Ping', emoji: '📢', description: 'Get pinged for big announcements', color: 0x5865f2 },
  { key: 'restocks', name: 'Restock Ping', emoji: '🆕', description: 'Get pinged for restocks and new products', color: 0xe67e22 },
];

export const COLOR_ROLES = [
  { key: 'crimson', name: 'Crimson', emoji: '🟥', color: 0xdc143c },
  { key: 'orange', name: 'Sunset', emoji: '🟧', color: 0xff8c1a },
  { key: 'gold', name: 'Gold', emoji: '🟨', color: 0xf5c518 },
  { key: 'emerald', name: 'Emerald', emoji: '🟩', color: 0x2ecc71 },
  { key: 'aqua', name: 'Aqua', emoji: '🟦', color: 0x1abc9c },
  { key: 'sky', name: 'Sky', emoji: '🔵', color: 0x3498db },
  { key: 'violet', name: 'Violet', emoji: '🟪', color: 0x9b59b6 },
  { key: 'pink', name: 'Pink', emoji: '💗', color: 0xff69b4 },
];

const key = (guildId) => `selfroles_${guildId}`;
const text = (content) => new TextDisplayBuilder().setContent(content);

export async function getSelfRoles(guildId) {
  const saved = await getFromDb(key(guildId), null);
  return { pings: {}, colors: {}, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export async function saveSelfRoles(guildId, config) {
  await setInDb(key(guildId), config);
}

// Creates any missing ping and color roles (matching by name) and remembers their ids.
export async function ensureSelfRoles(guild) {
  await guild.roles.fetch();
  const config = await getSelfRoles(guild.id);
  const createdIds = [];

  const ensure = async (spec, bucket, mentionable) => {
    const known = config[bucket][spec.key] && guild.roles.cache.get(config[bucket][spec.key]);
    if (known) return;
    const byName = guild.roles.cache.find((r) => r.name.toLowerCase() === spec.name.toLowerCase() && !r.managed);
    if (byName) {
      config[bucket][spec.key] = byName.id;
      return;
    }
    const role = await guild.roles.create({ name: spec.name, color: spec.color, mentionable, permissions: [], reason: 'Self-role setup' });
    config[bucket][spec.key] = role.id;
    createdIds.push(role.id);
  };

  for (const spec of PING_ROLES) await ensure(spec, 'pings', true);
  for (const spec of COLOR_ROLES) await ensure(spec, 'colors', false);
  await saveSelfRoles(guild.id, config);
  return { config, createdIds };
}

export function buildSelfRolePanel(config) {
  const pings = PING_ROLES.filter((r) => config.pings[r.key]);
  const colors = COLOR_ROLES.filter((r) => config.colors[r.key]);

  const container = new ContainerBuilder().setAccentColor(0x9b59b6).addTextDisplayComponents(
    text('# 🎭 Pick your roles\nChoose what you want to be pinged for and the color of your name. You can change this any time.')
  );

  if (pings.length) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(text('**Pings**\nYour choice replaces your old ping roles. Pick none to turn them all off.'))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('sr_ping')
            .setPlaceholder('Choose your pings')
            .setMinValues(0)
            .setMaxValues(pings.length)
            .addOptions(pings.map((r) => ({ label: r.name, value: r.key, emoji: r.emoji, description: r.description })))
        )
      );
  }
  if (colors.length) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(text('**Name color**'))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('sr_color')
            .setPlaceholder('Choose a color')
            .addOptions([
              { label: 'No color', value: 'none', emoji: '⚪', description: 'Remove my color role' },
              ...colors.map((r) => ({ label: r.name, value: r.key, emoji: r.emoji })),
            ])
        )
      );
  }
  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

export async function postSelfRolePanel(channel) {
  const config = await getSelfRoles(channel.guild.id);
  const message = await channel.send(buildSelfRolePanel(config));
  config.panelChannelId = channel.id;
  config.panelMessageId = message.id;
  await saveSelfRoles(channel.guild.id, config);
  return message;
}
