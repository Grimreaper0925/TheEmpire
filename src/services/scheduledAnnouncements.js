import { AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { buildAnnouncement } from './announcementBuilder.js';

export const MIN_DELAY_MS = 60 * 1000;
export const MAX_DELAY_MS = 60 * 24 * 60 * 60 * 1000;
export const MAX_PER_GUILD = 25;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const key = (guildId) => `announce_scheduled_${guildId}`;

export async function getScheduled(guildId) {
  let jobs = await getFromDb(key(guildId), []);
  if (typeof jobs === 'string') {
    try { jobs = JSON.parse(jobs); } catch { jobs = []; }
  }
  return Array.isArray(jobs) ? jobs.filter((job) => job?.id && job.channelId) : [];
}

async function saveScheduled(guildId, jobs) {
  await setInDb(key(guildId), jobs);
}

/**
 * Reads "2h", "1d 6h", "45m" (from now) or "2026-12-25 18:00" (a date and time
 * in the given UTC offset). Returns a timestamp in ms, or throws a readable Error.
 */
export function parseSchedule(input, utcOffsetHours = 0, now = Date.now()) {
  const text = String(input || '').trim().toLowerCase();
  let at;

  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})[ t](\d{1,2}):(\d{2})$/);
  if (dateMatch) {
    const [, y, mo, d, h, mi] = dateMatch.map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) throw new Error('That date or time does not exist.');
    at = Date.UTC(y, mo - 1, d, h, mi) - utcOffsetHours * 3600000;
  } else {
    const parts = [...text.matchAll(/(\d+)\s*([dhm])/g)];
    const rest = text.replace(/(\d+)\s*([dhm])/g, '').replace(/\s+/g, '');
    if (parts.length === 0 || rest) {
      throw new Error('Use a delay like `30m`, `2h`, `1d 6h`, or a date and time like `2026-12-25 18:00`.');
    }
    const unit = { d: 86400000, h: 3600000, m: 60000 };
    at = now + parts.reduce((sum, [, n, u]) => sum + Number(n) * unit[u], 0);
  }

  if (!Number.isFinite(at) || at - now < MIN_DELAY_MS) throw new Error('That time is too soon or already passed. Pick at least 1 minute from now.');
  if (at - now > MAX_DELAY_MS) throw new Error('You can schedule at most 60 days ahead.');
  return at;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download the image.');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('The image is too big to schedule (8 MB max).');
  const ext = (res.headers.get('content-type') || 'image/png').split('/')[1]?.split(';')[0].replace(/[^a-z0-9]/gi, '') || 'png';
  return { name: `banner.${ext}`, data: buffer.toString('base64') };
}

/** Saves a job. Discord image links expire, so the banner is copied into storage now. */
export async function scheduleAnnouncement(guildId, { sendAt, imageUrl, ...job }) {
  const jobs = await getScheduled(guildId);
  if (jobs.length >= MAX_PER_GUILD) throw new Error(`You already have ${MAX_PER_GUILD} scheduled announcements. Cancel one first.`);

  const entry = {
    ...job,
    id: Math.random().toString(36).slice(2, 8),
    sendAt,
    image: imageUrl ? await downloadImage(imageUrl) : null,
  };
  jobs.push(entry);
  await saveScheduled(guildId, jobs);
  return entry;
}

export async function cancelScheduled(guildId, id) {
  const jobs = await getScheduled(guildId);
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  await saveScheduled(guildId, jobs.filter((j) => j.id !== id));
  return job;
}

export function pingFor(pingPart) {
  if (pingPart === 'everyone') return { pingText: '@everyone', allowedMentions: { parse: ['everyone'] } };
  if (pingPart && pingPart !== 'none') return { pingText: `<@&${pingPart}>`, allowedMentions: { parse: [], roles: [pingPart] } };
  return { pingText: undefined, allowedMentions: { parse: [] } };
}

/** Builds and sends one announcement. Used for both instant and scheduled posts. */
export async function sendAnnouncement(channel, { author, pingPart, options, fields, image }) {
  const { pingText, allowedMentions } = pingFor(pingPart);
  const files = image ? [new AttachmentBuilder(Buffer.from(image.data, 'base64'), { name: image.name })] : [];

  const { components, flags } = await buildAnnouncement({
    guild: channel.guild,
    author,
    styleKey: options.styleKey,
    title: fields.title,
    body: fields.body,
    imageUrl: image ? `attachment://${image.name}` : options.imageUrl,
    buttonLabel: options.buttonLabel,
    buttonUrl: options.buttonUrl,
    color: options.color ?? undefined,
    pingText,
    tagline: fields.tagline,
    points: fields.points,
    closing: fields.closing,
    vibe: options.vibe || 'hype',
  });

  return channel.send({ components, flags, allowedMentions, files });
}

async function tellAuthor(client, job, message) {
  const user = await client.users.fetch(job.createdBy).catch(() => null);
  await user?.send(message).catch(() => {});
}

let running = false;

async function runDue(client) {
  if (running) return;
  running = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      const jobs = await getScheduled(guild.id).catch(() => []);
      const due = jobs.filter((job) => Date.now() >= job.sendAt);
      if (!due.length) continue;

      // Remove first so a slow or failing send can never post twice.
      const dueIds = new Set(due.map((job) => job.id));
      await saveScheduled(guild.id, (await getScheduled(guild.id)).filter((job) => !dueIds.has(job.id)));

      for (const job of due) {
        try {
          const channel = await guild.channels.fetch(job.channelId).catch(() => null);
          if (!channel?.isTextBased()) throw new Error('the channel no longer exists');
          const perms = channel.permissionsFor(guild.members.me);
          if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            throw new Error('I lost permission to post there');
          }
          await sendAnnouncement(channel, job);
          logger.info('Scheduled announcement posted', { guildId: guild.id, id: job.id });
        } catch (error) {
          logger.error('Scheduled announcement failed', { guildId: guild.id, id: job.id, error: error.message });
          await tellAuthor(client, job, `Your scheduled announcement **${job.fields.title}** in ${guild.name} could not be posted: ${error.message}.`);
        }
      }
    }
  } finally {
    running = false;
  }
}

export function startAnnouncementScheduler(client) {
  setInterval(() => runDue(client).catch((error) => logger.error('Announcement scheduler error', { error: error.message })), 30 * 1000);
}
