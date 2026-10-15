import { PermissionFlagsBits } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { logModerationAction } from '../utils/moderation.js';
import { describeUser } from '../utils/modActions.js';

const cfgKey = (guildId) => `automod_${guildId}`;

export const DEFAULTS = {
  spam: { enabled: true, messages: 6, seconds: 5, timeoutMinutes: 10 },
  duplicates: { enabled: true, repeats: 4, seconds: 30 },
  mentions: { enabled: true, max: 5, timeoutMinutes: 10 },
  raid: { auto: true, joins: 8, seconds: 12, minAgeDays: 7, strict: false, autoOffMinutes: 30, active: false, activatedAt: null },
  warns: { timeoutAt: 3, timeoutMinutes: 60, kickAt: 0 },
  alertChannelId: null,
};

const cache = new Map();
export async function getAutomod(guildId) {
  const hit = cache.get(guildId);
  if (hit && hit.expires > Date.now()) return hit.config;
  const saved = await getFromDb(cfgKey(guildId), null);
  const s = saved && typeof saved === 'object' ? saved : {};
  const config = {
    spam: { ...DEFAULTS.spam, ...s.spam },
    duplicates: { ...DEFAULTS.duplicates, ...s.duplicates },
    mentions: { ...DEFAULTS.mentions, ...s.mentions },
    raid: { ...DEFAULTS.raid, ...s.raid },
    warns: { ...DEFAULTS.warns, ...s.warns },
    alertChannelId: s.alertChannelId ?? null,
  };
  cache.set(guildId, { config, expires: Date.now() + 30000 });
  return config;
}

export async function saveAutomod(guildId, config) {
  await setInDb(cfgKey(guildId), config);
  cache.set(guildId, { config, expires: Date.now() + 30000 });
}

// ---------- alerts ----------
async function alert(guild, config, content) {
  const channel =
    (config.alertChannelId && (await guild.channels.fetch(config.alertChannelId).catch(() => null))) ||
    guild.systemChannel;
  if (channel?.isTextBased()) await channel.send({ content, allowedMentions: { parse: [] } }).catch(() => {});
}

async function logAuto(guild, action, user, reason, duration) {
  await logModerationAction({
    client: guild.client,
    guild,
    event: {
      action,
      target: describeUser(user),
      executor: describeUser(guild.client.user),
      reason,
      duration,
      metadata: { userId: user.id, moderatorId: guild.client.user.id },
    },
  }).catch((error) => logger.warn('Could not log automod action', { error: error.message }));
}

// ---------- spam, repeats and mass mentions ----------
const history = new Map(); // guild:user -> [{ t, id, channelId, text }]
const cooling = new Map(); // guild:user -> time of last action

function exempt(member) {
  return (
    !member ||
    member.user.bot ||
    member.id === member.guild.ownerId ||
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export async function handleAutomod(message) {
  const member = message.member;
  if (exempt(member)) return false;

  const guild = message.guild;
  const config = await getAutomod(guild.id);
  const key = `${guild.id}:${message.author.id}`;
  const now = Date.now();

  const list = (history.get(key) || []).filter((m) => now - m.t < 60000);
  list.push({ t: now, id: message.id, channelId: message.channel.id, text: message.content.trim().toLowerCase() });
  history.set(key, list);
  if (history.size > 5000) history.delete(history.keys().next().value);

  let reason = null;
  let minutes = 10;

  const mentionCount = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 5 : 0);
  if (config.mentions.enabled && mentionCount > config.mentions.max) {
    reason = `Mass mentions (${mentionCount})`;
    minutes = config.mentions.timeoutMinutes;
  } else if (config.spam.enabled && list.filter((m) => now - m.t < config.spam.seconds * 1000).length >= config.spam.messages) {
    reason = 'Spam (too many messages too fast)';
    minutes = config.spam.timeoutMinutes;
  } else if (config.duplicates.enabled && message.content.trim().length > 3) {
    const same = list.filter((m) => now - m.t < config.duplicates.seconds * 1000 && m.text === message.content.trim().toLowerCase());
    if (same.length >= config.duplicates.repeats) {
      reason = 'Repeating the same message';
      minutes = config.spam.timeoutMinutes;
    }
  }
  if (!reason) return false;

  if (now - (cooling.get(key) || 0) < 10000) {
    await message.delete().catch(() => {});
    return true;
  }
  cooling.set(key, now);

  // Remove the recent messages that triggered it.
  const byChannel = new Map();
  for (const m of list.filter((entry) => now - entry.t < 60000)) {
    byChannel.set(m.channelId, [...(byChannel.get(m.channelId) || []), m.id]);
  }
  for (const [channelId, ids] of byChannel) {
    const channel = guild.channels.cache.get(channelId);
    await channel?.bulkDelete(ids, true).catch(() => {});
  }
  history.delete(key);

  let timedOut = false;
  if (member.moderatable && minutes > 0) {
    timedOut = await member.timeout(minutes * 60000, `Auto-mod: ${reason}`).then(() => true).catch(() => false);
  }

  const notice = await message.channel
    .send({ content: `${message.author}, slow down. Auto-mod removed your messages (${reason}).`, allowedMentions: { users: [message.author.id] } })
    .catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), 8000);

  await logAuto(guild, timedOut ? 'Member Timed Out' : 'Messages Purged', message.author, `Auto-mod: ${reason}`, timedOut ? `${minutes} minutes` : undefined);
  return true;
}

// ---------- raid protection ----------
const joins = new Map(); // guild -> timestamps

export async function activateRaid(guild, why) {
  const config = await getAutomod(guild.id);
  if (config.raid.active) return;
  config.raid.active = true;
  config.raid.activatedAt = Date.now();
  await saveAutomod(guild.id, config);
  await guild.disableInvites?.(true).catch?.(() => {});
  await alert(guild, config, `🚨 **Raid mode is ON** (${why}). ${config.raid.strict ? 'Every new member is being removed' : `New accounts younger than ${config.raid.minAgeDays} days are being removed`} and invites are paused. It turns off by itself after ${config.raid.autoOffMinutes} minutes, or run \`/automod raid mode:off\`.`);
}

export async function deactivateRaid(guild, why) {
  const config = await getAutomod(guild.id);
  if (!config.raid.active) return;
  config.raid.active = false;
  config.raid.activatedAt = null;
  await saveAutomod(guild.id, config);
  await guild.disableInvites?.(false).catch?.(() => {});
  await alert(guild, config, `✅ **Raid mode is OFF** (${why}). Invites are open again.`);
}

// Returns true when the new member was removed.
export async function handleRaidJoin(member) {
  if (member.user.bot) return false;
  const guild = member.guild;
  const config = await getAutomod(guild.id);

  const now = Date.now();
  const list = (joins.get(guild.id) || []).filter((t) => now - t < config.raid.seconds * 1000);
  list.push(now);
  joins.set(guild.id, list);

  if (config.raid.auto && !config.raid.active && list.length >= config.raid.joins) {
    await activateRaid(guild, `${list.length} joins in ${config.raid.seconds} seconds`);
  }

  const fresh = await getAutomod(guild.id);
  if (!fresh.raid.active) return false;

  const ageDays = (now - member.user.createdTimestamp) / 86400000;
  if (!fresh.raid.strict && ageDays >= fresh.raid.minAgeDays) return false;
  if (!member.kickable) return false;

  await member.send('This server is temporarily locked because of a raid. Please try joining again later.').catch(() => {});
  const kicked = await member.kick('Raid mode').then(() => true).catch(() => false);
  if (kicked) await logAuto(guild, 'Member Kicked', member.user, `Raid mode (${fresh.raid.strict ? 'strict' : `account ${ageDays.toFixed(1)} days old`})`);
  return kicked;
}

export function startAutomodScheduler(client) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      const config = await getAutomod(guild.id).catch(() => null);
      if (config?.raid.active && config.raid.autoOffMinutes > 0 && Date.now() - config.raid.activatedAt > config.raid.autoOffMinutes * 60000) {
        await deactivateRaid(guild, 'timer ran out').catch(() => {});
      }
    }
  }, 60 * 1000);
}
