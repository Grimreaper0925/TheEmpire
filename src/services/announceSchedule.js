import { AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { getFromDb, setInDb, deleteFromDb } from '../utils/database.js';
import { buildAnnouncement } from './announcementBuilder.js';
import { advancePast } from './announceTime.js';
import { logger } from '../utils/logger.js';

export const MAX_SCHEDULED = 25;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// If the bot was offline and a post is later than this, skip it instead of posting stale news.
const MAX_LATE_MS = 6 * 60 * 60 * 1000;

const listKey = (guildId) => `announce_schedule_${guildId}`;
const imageKey = (guildId, id) => `announce_img_${guildId}_${id}`;

// ---------- storage ----------

export async function getScheduled(guildId) {
  let items = await getFromDb(listKey(guildId), []);
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  return Array.isArray(items) ? items.filter((i) => i?.id && i?.channelId) : [];
}

async function saveScheduled(guildId, items) {
  await setInDb(listKey(guildId), items);
}

function newId(existing) {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 6);
    if (!existing.some((i) => i.id === id)) return id;
  }
}

/** Saves a scheduled announcement (and its image, kept in its own record) and returns it. */
export async function addScheduled(guildId, item, image = null) {
  const items = await getScheduled(guildId);
  if (items.length >= MAX_SCHEDULED) throw new Error(`You can have up to ${MAX_SCHEDULED} scheduled announcements. Cancel one with \`/announce-schedule cancel\` first.`);
  const id = newId(items);
  const saved = { ...item, id, createdAt: Date.now(), imageName: image?.name || null };
  if (image) await setInDb(imageKey(guildId, id), image);
  items.push(saved);
  await saveScheduled(guildId, items);
  return saved;
}

export async function removeScheduled(guildId, id) {
  const items = await getScheduled(guildId);
  const target = items.find((i) => i.id === String(id).trim().toLowerCase());
  if (!target) return null;
  await saveScheduled(guildId, items.filter((i) => i.id !== target.id));
  if (target.imageName) await deleteFromDb(imageKey(guildId, target.id)).catch(() => {});
  return target;
}

async function updateScheduled(guildId, id, changes) {
  const items = await getScheduled(guildId);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...changes };
  await saveScheduled(guildId, items);
}

/** Downloads an uploaded image so a scheduled post still has it days later (Discord upload links expire). */
export async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('I could not download that image.');
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error('That attachment is not an image.');
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error('That image is over 2 MB, which is too big to hold for a scheduled post. Use a smaller one, or post it right now.');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('That image is over 2 MB, which is too big to hold for a scheduled post. Use a smaller one, or post it right now.');
  const ext = type.split('/')[1]?.split(';')[0].replace('jpeg', 'jpg') || 'png';
  return { name: `banner.${/^[a-z0-9]{2,5}$/.test(ext) ? ext : 'png'}`, base64: buffer.toString('base64') };
}

// ---------- posting ----------

export function pingRules(pingPart) {
  const allowedMentions = { parse: [] };
  let pingText;
  if (pingPart === 'everyone') {
    pingText = '@everyone';
    allowedMentions.parse = ['everyone'];
  } else if (pingPart && pingPart !== 'none') {
    pingText = `<@&${pingPart}>`;
    allowedMentions.roles = [pingPart];
  }
  return { pingText, allowedMentions };
}

/**
 * Builds and sends an announcement. `item` holds { channelId, pingPart, options, fields, authorName }.
 * Throws an Error with a plain-language message if it can't be posted.
 */
export async function postAnnouncement(client, guildId, item) {
  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error('I am no longer in that server.');

  const channel = await guild.channels.fetch(item.channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('That channel no longer exists.');
  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw new Error(`I need View Channel, Send Messages and Embed Links in #${channel.name}.`);
  }

  const files = [];
  let imageUrl = item.options?.imageUrl || null;
  if (item.imageName) {
    const stored = await getFromDb(imageKey(guildId, item.id), null);
    if (stored?.base64) {
      files.push(new AttachmentBuilder(Buffer.from(stored.base64, 'base64'), { name: stored.name }));
      imageUrl = `attachment://${stored.name}`;
    } else {
      imageUrl = null; // image record is gone, post without the banner
    }
  }

  const { pingText, allowedMentions } = pingRules(item.pingPart);
  const { components, flags } = await buildAnnouncement({
    guild,
    author: item.authorName,
    styleKey: item.options?.styleKey,
    title: item.fields.title,
    body: item.fields.body,
    imageUrl,
    buttonLabel: item.options?.buttonLabel,
    buttonUrl: item.options?.buttonUrl,
    color: item.options?.color ?? undefined,
    pingText,
    tagline: item.fields.tagline,
    points: item.fields.points,
    closing: item.fields.closing,
    vibe: item.options?.vibe || 'hype',
  });

  return channel.send({ components, flags, files, allowedMentions });
}

// ---------- timer ----------

let running = false;

async function notifyAuthor(client, item, reason) {
  try {
    const user = await client.users.fetch(item.authorId);
    await user.send(`Your scheduled announcement **${String(item.fields?.title || '').slice(0, 80)}** (ID \`${item.id}\`) was not posted: ${reason}`);
  } catch {
    // DMs closed, nothing more to do.
  }
}

export async function runDueAnnouncements(client) {
  if (running) return;
  running = true;
  try {
    for (const guildId of client.guilds.cache.keys()) {
      const items = await getScheduled(guildId);
      const now = Date.now();
      for (const item of items.filter((i) => i.runAt <= now)) {
        const repeating = item.repeat === 'daily' || item.repeat === 'weekly';

        // Move it forward or remove it BEFORE sending, so a crash can never post it twice.
        if (repeating) await updateScheduled(guildId, item.id, { runAt: advancePast(item.runAt, item.repeat, now) });
        else await saveScheduled(guildId, (await getScheduled(guildId)).filter((i) => i.id !== item.id));

        try {
          if (now - item.runAt > MAX_LATE_MS) {
            logger.warn(`[Announce] Skipped late scheduled announcement ${item.id} in ${guildId}`);
            await notifyAuthor(client, item, 'the bot was offline at that time and it was too late to post by the time it came back.');
          } else {
            const sent = await postAnnouncement(client, guildId, item);
            logger.info(`[Announce] Posted scheduled announcement ${item.id} in ${guildId}`, { messageId: sent.id });
          }
        } catch (error) {
          logger.error(`[Announce] Scheduled announcement ${item.id} failed in ${guildId}: ${error.message}`);
          await notifyAuthor(client, item, error.message);
        }

        if (!repeating && item.imageName) await deleteFromDb(imageKey(guildId, item.id)).catch(() => {});
      }
    }
  } finally {
    running = false;
  }
}

export function startAnnounceScheduler(client) {
  const tick = () => runDueAnnouncements(client).catch((error) => logger.error('Announcement scheduler error', { error: error.message }));
  setInterval(tick, 30 * 1000);
  setTimeout(tick, 15 * 1000);
}
