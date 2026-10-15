import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export const MIN_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SLOTS = 10;
export const RESET_MESSAGE = '🔄 **Chat Channel Reset!** A new period has started. Start chatting!';

const slotsKey = (guildId) => `reset_chat_configs_${guildId}`;
const legacyKey = (guildId) => `reset_chat_config_${guildId}`;
const RESETTABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

// Slots look like { channelId, intervalMs, lastReset (ISO string) }.
export async function getSlots(guildId) {
  let slots = await getFromDb(slotsKey(guildId), []);
  if (typeof slots === 'string') {
    try { slots = JSON.parse(slots); } catch { slots = []; }
  }
  if (!Array.isArray(slots)) slots = [];

  // Older versions stored a single channel under a different key.
  if (slots.length === 0) {
    let old = await getFromDb(legacyKey(guildId), null);
    if (typeof old === 'string') {
      try { old = JSON.parse(old); } catch { old = null; }
    }
    if (old?.channelId) {
      slots = [{ channelId: old.channelId, intervalMs: old.intervalMs || 86400000, lastReset: old.lastReset || new Date().toISOString() }];
      await setInDb(slotsKey(guildId), slots);
    }
  }
  return slots.filter((slot) => slot?.channelId);
}

export async function saveSlots(guildId, slots) {
  await setInDb(slotsKey(guildId), slots);
}

export function nextResetAt(slot) {
  const last = new Date(slot.lastReset || Date.now()).getTime();
  return last + (slot.intervalMs || 86400000);
}

export function toUnix(ms) {
  return Math.floor(ms / 1000);
}

export function formatInterval(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(' ') || '0m';
}

// Returns a plain-English reason this channel can't be reset, or null if it's fine.
export function checkResettable(channel) {
  if (!channel || !RESETTABLE.includes(channel.type)) return 'Only text and announcement channels can be reset.';
  const guild = channel.guild;
  if ([guild.rulesChannelId, guild.publicUpdatesChannelId, guild.systemChannelId].includes(channel.id)) {
    return 'That channel is used by Discord for rules, updates or system messages, so it can\'t be deleted and recreated.';
  }
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return 'I need the **Manage Channels** permission to reset channels.';
  }
  if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels])) {
    return `I can't manage ${channel}. Give me **View Channel** and **Manage Channel** there.`;
  }
  return null;
}

// Clones the channel (same name, topic, permissions, position), deletes the old one and posts the reset message.
export async function resetChannel(channel, { reason, auto = false } = {}) {
  const problem = checkResettable(channel);
  if (problem) throw new Error(problem);

  const guildId = channel.guild.id;
  const oldId = channel.id;

  const fresh = await channel.clone({ reason, position: channel.position });
  await channel.delete(reason);

  const slots = await getSlots(guildId);
  const slot = slots.find((s) => s.channelId === oldId);
  if (slot) {
    slot.channelId = fresh.id;
    slot.lastReset = new Date().toISOString();
    delete slot.lastError;
    await saveSlots(guildId, slots);
  }

  let content = RESET_MESSAGE;
  if (auto && slot) content += `\n-# Next reset <t:${toUnix(nextResetAt(slot))}:R>`;
  await fresh.send({ content }).catch((error) => logger.warn('Could not post reset message', { error: error.message }));
  return fresh;
}

// Re-reads the saved slots, then changes one (patch) or removes it (patch = null).
async function updateSlot(guildId, channelId, patch) {
  const slots = await getSlots(guildId);
  const next = patch === null ? slots.filter((s) => s.channelId !== channelId) : slots.map((s) => (s.channelId === channelId ? { ...s, ...patch } : s));
  await saveSlots(guildId, next);
}

let running = false;

async function runDueResets(client) {
  if (running) return;
  running = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      let slots;
      try {
        slots = await getSlots(guild.id);
      } catch {
        continue;
      }
      if (!slots.length) continue;

      const due = slots.filter((slot) => Date.now() >= nextResetAt(slot));
      for (const slot of due) {
        const channel = await guild.channels.fetch(slot.channelId).catch(() => null);
        if (!channel) {
          // The channel was deleted by hand, so stop tracking it.
          await updateSlot(guild.id, slot.channelId, null);
          continue;
        }
        try {
          await resetChannel(channel, { reason: 'Scheduled chat reset', auto: true });
          logger.info(`[ChatReset] Reset #${channel.name} in ${guild.name}`);
        } catch (error) {
          // Push the timer forward so a broken channel doesn't retry every 30 seconds.
          await updateSlot(guild.id, slot.channelId, { lastReset: new Date().toISOString(), lastError: error.message });
          logger.error(`[ChatReset] Could not reset #${channel.name} in ${guild.name}: ${error.message}`);
        }
      }
    }
  } finally {
    running = false;
  }
}

export function startChatResetScheduler(client) {
  setInterval(() => runDueResets(client).catch((error) => logger.error('Chat reset loop error', { error: error.message })), 30 * 1000);
}
