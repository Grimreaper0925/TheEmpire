import { ChannelType, PermissionFlagsBits as P, AttachmentBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export const PRIORITIES = {
  low: { label: 'Low', emoji: '🔵' },
  normal: { label: 'Normal', emoji: '🟢' },
  high: { label: 'High', emoji: '🟠' },
  urgent: { label: 'Urgent', emoji: '🔴' },
};

export const DEFAULT_TYPES = [
  { key: 'purchase', label: 'Purchase help', emoji: '🛒', description: 'Questions before or during a purchase' },
  { key: 'delivery', label: 'Key or delivery issue', emoji: '🔑', description: 'Did not get your product or key' },
  { key: 'tech', label: 'Technical support', emoji: '🛠️', description: 'Something is not working' },
  { key: 'billing', label: 'Billing or refund', emoji: '💳', description: 'Payment problems and refund requests' },
  { key: 'other', label: 'Something else', emoji: '💬', description: 'Anything not listed above' },
];

const cfgKey = (g) => `ticket_cfg_${g}`;
const recKey = (g, c) => `ticket_rec_${g}_${c}`;
const idxKey = (g) => `ticket_idx_${g}`;
const histKey = (g) => `ticket_hist_${g}`;
const ctrKey = (g) => `ticket_ctr_${g}`;

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const asArray = (v) => (Array.isArray(v) ? v : []);

// ---------- config ----------
export async function getTicketConfig(guildId) {
  const saved = asObject(await getFromDb(cfgKey(guildId), null)) || {};
  return {
    panelChannelId: null,
    panelMessageId: null,
    categoryId: null,
    logChannelId: null,
    staffRoleIds: [],
    maxOpen: 3,
    cooldownSec: 60,
    inactivityHours: 48,
    autoDeleteHours: 24,
    ownerCanClose: true,
    panelTitle: 'Support',
    panelText: 'Need a hand? Pick what you need help with below and a private channel will open just for you and our staff.',
    welcomeText: 'A staff member will be with you as soon as they can. Add any extra details, screenshots or order numbers here.',
    blacklist: {},
    types: DEFAULT_TYPES,
    ...saved,
  };
}

export async function saveTicketConfig(guildId, config) {
  await setInDb(cfgKey(guildId), config);
}

export function isStaff(member, config) {
  if (!member) return false;
  if (member.permissions.has(P.Administrator) || member.permissions.has(P.ManageGuild)) return true;
  return config.staffRoleIds.some((id) => member.roles.cache.has(id));
}

// ---------- records ----------
const channelCache = new Set(); // channel ids that belong to tickets, so messageCreate stays cheap
export const isTicketChannel = (channelId) => channelCache.has(channelId);

export async function getRecord(guildId, channelId) {
  return asObject(await getFromDb(recKey(guildId, channelId), null));
}
async function saveRecord(record) {
  await setInDb(recKey(record.guildId, record.channelId), record);
}
async function getIndex(guildId) {
  return asArray(await getFromDb(idxKey(guildId), []));
}
async function addToIndex(guildId, channelId) {
  const idx = await getIndex(guildId);
  if (!idx.includes(channelId)) await setInDb(idxKey(guildId), [...idx, channelId]);
  channelCache.add(channelId);
}
async function removeFromIndex(guildId, channelId) {
  const idx = await getIndex(guildId);
  await setInDb(idxKey(guildId), idx.filter((id) => id !== channelId));
  channelCache.delete(channelId);
}

export async function loadTicketCache(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const id of await getIndex(guild.id).catch(() => [])) channelCache.add(id);
  }
}

export async function listRecords(guildId) {
  const out = [];
  for (const id of await getIndex(guildId)) {
    const rec = await getRecord(guildId, id);
    if (rec) out.push(rec);
  }
  return out;
}

async function nextNumber(guildId) {
  const n = (Number(await getFromDb(ctrKey(guildId), 0)) || 0) + 1;
  await setInDb(ctrKey(guildId), n);
  return n;
}

export const padNumber = (n) => String(n).padStart(4, '0');
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'user';

export function channelNameFor(record, username) {
  const closed = record.status === 'closed';
  const prefix = closed ? '🔒' : PRIORITIES[record.priority]?.emoji || '🟢';
  return `${prefix}・ticket-${padNumber(record.number)}-${slug(username)}`.slice(0, 100);
}

// ---------- history and stats ----------
async function pushHistory(guildId, entry) {
  const hist = asArray(await getFromDb(histKey(guildId), []));
  hist.push(entry);
  await setInDb(histKey(guildId), hist.slice(-1000));
}

async function updateHistoryRating(guildId, number, rating) {
  const hist = asArray(await getFromDb(histKey(guildId), []));
  const entry = hist.find((h) => h.number === number);
  if (entry) {
    entry.rating = rating;
    await setInDb(histKey(guildId), hist);
  }
}

export async function getHistory(guildId) {
  return asArray(await getFromDb(histKey(guildId), []));
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'n/a';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export async function averageFirstReply(guildId) {
  const hist = (await getHistory(guildId)).slice(-50).filter((h) => h.firstReplyMs > 0);
  if (!hist.length) return null;
  return hist.reduce((n, h) => n + h.firstReplyMs, 0) / hist.length;
}

// ---------- permissions ----------
function overwritesFor(guild, config, userId, extraUsers = []) {
  const userAllow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];
  const list = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: guild.members.me.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels, P.ManageMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory] },
    { id: userId, allow: userAllow },
  ];
  for (const id of extraUsers) list.push({ id, allow: userAllow });
  for (const id of config.staffRoleIds) {
    list.push({ id, allow: [...userAllow, P.ManageMessages] });
  }
  return list;
}

// ---------- open ----------
const lastOpened = new Map(); // guild:user -> time
export async function checkCanOpen(guild, member, config) {
  if (config.blacklist?.[member.id]) {
    return `You are not allowed to open tickets. Reason: ${config.blacklist[member.id].reason || 'none given'}.`;
  }
  const records = await listRecords(guild.id);
  const open = records.filter((r) => r.userId === member.id && r.status === 'open');
  if (open.length >= config.maxOpen) {
    return `You already have ${open.length} open ticket(s): ${open.map((r) => `<#${r.channelId}>`).join(' ')}. Close one before opening another.`;
  }
  const wait = (lastOpened.get(`${guild.id}:${member.id}`) || 0) + config.cooldownSec * 1000 - Date.now();
  if (wait > 0) return `Please wait ${Math.ceil(wait / 1000)} seconds before opening another ticket.`;
  return null;
}

export async function createTicket(guild, member, config, { typeKey, subject, orderId, details }) {
  const type = config.types.find((t) => t.key === typeKey) || config.types[0];
  const number = await nextNumber(guild.id);
  const record = {
    guildId: guild.id,
    channelId: null,
    number,
    userId: member.id,
    username: member.user.username,
    type: type.key,
    typeLabel: type.label,
    typeEmoji: type.emoji,
    subject: subject.slice(0, 100),
    orderId: orderId?.slice(0, 100) || '',
    details: details.slice(0, 1500),
    priority: 'normal',
    status: 'open',
    claimedBy: null,
    addedUsers: [],
    openedAt: Date.now(),
    firstReplyAt: null,
    lastActivity: Date.now(),
    warnedAt: null,
    cardMessageId: null,
  };

  const category = config.categoryId ? await guild.channels.fetch(config.categoryId).catch(() => null) : null;
  const channel = await guild.channels.create({
    name: channelNameFor(record, member.user.username),
    type: ChannelType.GuildText,
    parent: category?.type === ChannelType.GuildCategory ? category.id : undefined,
    topic: `Ticket #${padNumber(number)} for ${member.user.tag} | ${type.label} | ${record.subject}`.slice(0, 1000),
    permissionOverwrites: overwritesFor(guild, config, member.id),
    reason: `Ticket #${number} opened by ${member.user.tag}`,
  });

  record.channelId = channel.id;
  await saveRecord(record);
  await addToIndex(guild.id, channel.id);
  lastOpened.set(`${guild.id}:${member.id}`, Date.now());
  return { channel, record };
}

export async function updateRecord(guildId, channelId, patch) {
  const rec = await getRecord(guildId, channelId);
  if (!rec) return null;
  const next = { ...rec, ...patch };
  await saveRecord(next);
  return next;
}

// ---------- staff actions ----------
export async function setClaim(channel, record, staffId) {
  const next = await updateRecord(record.guildId, record.channelId, {
    claimedBy: staffId,
    firstReplyAt: record.firstReplyAt || (staffId ? Date.now() : null),
  });
  return next;
}

export async function setPriority(channel, record, priority) {
  const next = await updateRecord(record.guildId, record.channelId, { priority });
  const name = channelNameFor(next, next.username);
  if (channel.name !== name) channel.setName(name, 'Ticket priority changed').catch(() => {}); // renames are rate limited, never wait on them
  return next;
}

export async function addUser(channel, record, user) {
  await channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true,
  });
  return updateRecord(record.guildId, record.channelId, { addedUsers: [...new Set([...(record.addedUsers || []), user.id])] });
}

export async function removeUser(channel, record, user) {
  await channel.permissionOverwrites.delete(user.id).catch(() => {});
  return updateRecord(record.guildId, record.channelId, { addedUsers: (record.addedUsers || []).filter((id) => id !== user.id) });
}

// ---------- transcript ----------
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function buildTranscript(channel, record) {
  const all = [];
  let before;
  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const rows = all
    .map((m) => {
      const when = new Date(m.createdTimestamp).toUTCString();
      const files = [...m.attachments.values()].map((a) => `<div class="att"><a href="${esc(a.url)}">${esc(a.name)}</a></div>`).join('');
      const embeds = m.embeds.map((e) => `<div class="emb">${esc(e.title || '')} ${esc(e.description || '')}</div>`).join('');
      const text = esc(m.content || (m.components?.length ? '(card)' : '')).replace(/\n/g, '<br>');
      return `<div class="msg"><img src="${esc(m.author.displayAvatarURL({ size: 64, extension: 'png' }))}"><div><span class="name">${esc(m.member?.displayName || m.author.username)}</span> <span class="time">${esc(when)}</span><div>${text}</div>${files}${embeds}</div></div>`;
    })
    .join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${padNumber(record.number)}</title><style>
body{background:#1e1f22;color:#dbdee1;font-family:system-ui,sans-serif;margin:0;padding:24px}
h1{font-size:20px}.meta{color:#949ba4;margin-bottom:16px;font-size:14px}
.msg{display:flex;gap:12px;margin:10px 0}.msg img{width:36px;height:36px;border-radius:50%}
.name{font-weight:600;color:#fff}.time{color:#949ba4;font-size:12px}.att a{color:#00a8fc}.emb{border-left:4px solid #5865f2;padding-left:8px;margin-top:4px;color:#b5bac1}
</style></head><body><h1>Ticket #${padNumber(record.number)} - ${esc(record.typeLabel)}</h1>
<div class="meta">Opened by ${esc(record.username)} (${esc(record.userId)}) on ${esc(new Date(record.openedAt).toUTCString())}<br>Subject: ${esc(record.subject)}${record.orderId ? `<br>Order: ${esc(record.orderId)}` : ''}<br>${all.length} messages</div>
${rows}</body></html>`;

  return { file: new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `ticket-${padNumber(record.number)}.html` }), count: all.length };
}

// ---------- close / reopen / delete ----------
export async function closeTicket(guild, channel, record, config, { closedBy, reason }) {
  if (record.status === 'closed') return { record };
  const transcript = await buildTranscript(channel, record);

  await channel.permissionOverwrites.edit(record.userId, { SendMessages: false }).catch(() => {});
  const next = await updateRecord(record.guildId, record.channelId, {
    status: 'closed',
    closedAt: Date.now(),
    closedBy,
    closeReason: reason || '',
  });
  channel.setName(channelNameFor(next, next.username), 'Ticket closed').catch(() => {});

  await pushHistory(guild.id, {
    number: next.number,
    type: next.type,
    userId: next.userId,
    claimedBy: next.claimedBy,
    openedAt: next.openedAt,
    closedAt: next.closedAt,
    firstReplyMs: next.firstReplyAt ? next.firstReplyAt - next.openedAt : 0,
    priority: next.priority,
    rating: null,
    messages: transcript.count,
  });
  return { record: next, transcript };
}

export async function reopenTicket(channel, record) {
  await channel.permissionOverwrites.edit(record.userId, { SendMessages: true }).catch(() => {});
  const next = await updateRecord(record.guildId, record.channelId, { status: 'open', closedAt: null, closedBy: null, closeReason: '', warnedAt: null, lastActivity: Date.now() });
  channel.setName(channelNameFor(next, next.username), 'Ticket reopened').catch(() => {});
  return next;
}

export async function forgetTicket(guildId, channelId) {
  await removeFromIndex(guildId, channelId);
  await setInDb(recKey(guildId, channelId), null);
}

export async function saveRating(guildId, channelId, rating) {
  const rec = await getRecord(guildId, channelId);
  if (!rec) return null;
  if (rec.rating) return { already: true, record: rec };
  const next = await updateRecord(guildId, channelId, { rating });
  await updateHistoryRating(guildId, rec.number, rating);
  return { record: next };
}

// ---------- activity tracking (called from messageCreate) ----------
export async function noteTicketMessage(message) {
  const record = await getRecord(message.guild.id, message.channel.id);
  if (!record || record.status !== 'open') return;
  const config = await getTicketConfig(message.guild.id);
  const patch = {};
  const now = Date.now();
  if (message.author.id !== record.userId && isStaff(message.member, config) && !record.firstReplyAt) patch.firstReplyAt = now;
  if (now - (record.lastActivity || 0) > 60000 || patch.firstReplyAt) patch.lastActivity = now;
  if (message.author.id === record.userId && record.warnedAt) patch.warnedAt = null;
  if (Object.keys(patch).length) await updateRecord(record.guildId, record.channelId, patch);
}

// ---------- scheduler: inactivity warnings, auto close, auto delete ----------
let busy = false;
export function startTicketScheduler(client, hooks) {
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const guild of client.guilds.cache.values()) {
        const config = await getTicketConfig(guild.id);
        const records = await listRecords(guild.id);
        for (const rec of records) {
          const channel = await guild.channels.fetch(rec.channelId).catch(() => null);
          if (!channel) {
            await forgetTicket(guild.id, rec.channelId);
            continue;
          }
          const now = Date.now();
          if (rec.status === 'closed' && config.autoDeleteHours > 0 && now - rec.closedAt > config.autoDeleteHours * 3600000) {
            await forgetTicket(guild.id, rec.channelId);
            await channel.delete('Closed ticket auto-deleted').catch(() => {});
            continue;
          }
          if (rec.status !== 'open' || config.inactivityHours <= 0) continue;
          const idle = now - (rec.lastActivity || rec.openedAt);
          if (!rec.warnedAt && idle > config.inactivityHours * 3600000) {
            await updateRecord(guild.id, rec.channelId, { warnedAt: now });
            await channel.send({
              content: `<@${rec.userId}> this ticket has been quiet for a while. Reply here in the next **12 hours** or it will be closed automatically.`,
              allowedMentions: { users: [rec.userId] },
            }).catch(() => {});
          } else if (rec.warnedAt && now - rec.warnedAt > 12 * 3600000 && idle > config.inactivityHours * 3600000) {
            await hooks?.autoClose?.(guild, channel, rec, config);
          }
        }
      }
    } catch (error) {
      logger.error('Ticket scheduler error', { error: error.message });
    } finally {
      busy = false;
    }
  }, 5 * 60 * 1000);
}
