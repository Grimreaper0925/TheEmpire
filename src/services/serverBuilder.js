import { ChannelType, PermissionFlagsBits as P } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { TEMPLATES } from '../config/serverTemplates.js';

const recordKey = (guildId) => `server_build_${guildId}`;
const norm = (text) => String(text).toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const STYLES = { emoji: 'Emoji (📢・announcements)', clean: 'Clean (announcements)' };

const STAFF_PERMS = [
  P.ManageMessages, P.KickMembers, P.ModerateMembers, P.MuteMembers, P.DeafenMembers,
  P.MoveMembers, P.ViewAuditLog, P.ManageNicknames, P.MentionEveryone,
];

export const BOT_NEEDS = [P.ManageChannels, P.ManageRoles, P.ViewChannel, P.SendMessages];

export function countTemplate(template) {
  const channels = template.categories.reduce((n, c) => n + c.channels.length, 0);
  return { roles: template.roles.length, categories: template.categories.length, channels };
}

export function previewText(template, style) {
  const lines = [];
  lines.push(`**Roles:** ${template.roles.map((r) => `\`${r.name}\``).join(' ')}`);
  for (const category of template.categories) {
    const names = category.channels
      .map((c) => (c.type === 'voice' ? `🔊${displayName(c, style).replace(/^.*・/, '')}` : `#${displayName(c, style).replace(/^.*・/, '')}`))
      .join(' ');
    lines.push(`${category.emoji} **${category.name}**\n${names}`);
  }
  return lines.join('\n');
}

function displayName(channel, style) {
  const base = channel.type === 'voice' ? channel.name : slug(channel.name);
  return style === 'emoji' && channel.emoji ? `${channel.emoji}・${base}` : base;
}

function categoryName(category, style) {
  return style === 'emoji' ? `${category.emoji} ${category.name}` : category.name;
}

function overwritesFor(channel, ctx) {
  const voice = channel.type === 'voice';
  let access = channel.access || 'public';
  if (!ctx.gated) {
    if (access === 'verified') access = 'public';
    if (access === 'readonly-verified') access = 'readonly-public';
  }

  const view = voice ? [P.ViewChannel, P.Connect, P.Speak] : [P.ViewChannel, P.SendMessages, P.ReadMessageHistory];
  const bot = { id: ctx.botId, allow: voice ? [P.ViewChannel, P.Connect, P.ManageChannels] : [P.ViewChannel, P.SendMessages, P.ManageChannels] };
  const list = [];

  if (access === 'public') return [];

  if (access === 'readonly-public') {
    list.push({ id: ctx.everyoneId, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] });
    list.push({ id: ctx.staffId, allow: [P.SendMessages] });
  } else if (access === 'verified') {
    list.push({ id: ctx.everyoneId, deny: [P.ViewChannel] });
    list.push({ id: ctx.verifiedId, allow: view });
    list.push({ id: ctx.staffId, allow: view });
  } else if (access === 'readonly-verified') {
    list.push({ id: ctx.everyoneId, deny: [P.ViewChannel] });
    list.push({ id: ctx.verifiedId, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] });
    list.push({ id: ctx.staffId, allow: view });
  } else if (access === 'staff') {
    list.push({ id: ctx.everyoneId, deny: [P.ViewChannel] });
    list.push({ id: ctx.staffId, allow: view });
  }
  list.push(bot);
  return list;
}

export async function buildServer(guild, templateKey, { style = 'emoji', onProgress } = {}) {
  const template = TEMPLATES[templateKey];
  const totals = countTemplate(template);
  const created = { roles: [], categories: [], channels: [] };
  const reused = { roles: 0, categories: 0, channels: 0 };
  const note = async (text) => onProgress?.(text);
  try {

    await guild.roles.fetch();
    await guild.channels.fetch();
    const me = guild.members.me;
    const canAnnounce = guild.features.includes('COMMUNITY');
    const ids = { botId: me.id, everyoneId: guild.roles.everyone.id };
    const roleByKey = {};

    // Roles
    await note(`Creating roles (0/${totals.roles})...`);
    for (const spec of template.roles) {
      const existing = guild.roles.cache.find((r) => norm(r.name) === norm(spec.name) && !r.managed);
      if (existing) {
        roleByKey[spec.key] = existing;
        reused.roles++;
        continue;
      }
      const role = await guild.roles.create({
        name: spec.name,
        color: spec.color,
        hoist: Boolean(spec.hoist),
        mentionable: false,
        permissions: spec.staff ? STAFF_PERMS : [],
        reason: '/aisetup server build',
      });
      roleByKey[spec.key] = role;
      created.roles.push(role.id);
    }
    ids.staffId = roleByKey.staff.id;
    ids.verifiedId = roleByKey.verified?.id || null;
    ids.gated = template.gated !== false && Boolean(ids.verifiedId);

    // Categories and channels
    let done = 0;
    for (const category of template.categories) {
      const wanted = categoryName(category, style);
      let parent = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && norm(c.name) === norm(category.name));
      if (parent) {
        reused.categories++;
      } else {
        parent = await guild.channels.create({ name: wanted, type: ChannelType.GuildCategory, reason: '/aisetup server build' });
        created.categories.push(parent.id);
      }

      for (const spec of category.channels) {
        done++;
        const voice = spec.type === 'voice';
        const sameKind = (c) =>
          voice ? c.type === ChannelType.GuildVoice : c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement;
        const existing = guild.channels.cache.find((c) => sameKind(c) && norm(c.name) === norm(spec.name));
        if (existing) {
          reused.channels++;
          continue;
        }
        let type = ChannelType.GuildText;
        if (voice) type = ChannelType.GuildVoice;
        else if (spec.type === 'announcement' && canAnnounce) type = ChannelType.GuildAnnouncement;

        const channel = await guild.channels.create({
          name: displayName(spec, style),
          type,
          parent: parent.id,
          topic: voice ? undefined : spec.topic,
          permissionOverwrites: overwritesFor(spec, ids),
          reason: '/aisetup server build',
        });
        created.channels.push(channel.id);
        if (done % 4 === 0) await note(`Creating channels (${done}/${totals.channels})...`);
      }
    }

  return { created, reused, verifiedRole: roleByKey.verified || null };
  } finally {
    // Save what was made even if the build stops partway, so /aisetup undo can still clean it up.
    const previous = await getLastBuild(guild.id);
    const merge = (key) => [...(previous?.[key] || []), ...created[key]];
    await setInDb(recordKey(guild.id), { at: new Date().toISOString(), template: templateKey, roles: merge('roles'), categories: merge('categories'), channels: merge('channels') });
  }
}

export async function getLastBuild(guildId) {
  const record = await getFromDb(recordKey(guildId), null);
  return record && typeof record === 'object' ? record : null;
}

// Deletes only what the last build created. Anything that already existed is left alone.
export async function undoLastBuild(guild) {
  const record = await getLastBuild(guild.id);
  if (!record) return null;
  const removed = { channels: 0, categories: 0, roles: 0 };

  for (const id of record.channels || []) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (channel) { await channel.delete('/aisetup undo').catch(() => {}); removed.channels++; }
  }
  for (const id of record.categories || []) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (channel) { await channel.delete('/aisetup undo').catch(() => {}); removed.categories++; }
  }
  for (const id of record.roles || []) {
    const role = await guild.roles.fetch(id).catch(() => null);
    if (role) { await role.delete('/aisetup undo').catch(() => {}); removed.roles++; }
  }
  await setInDb(recordKey(guild.id), null);
  return removed;
}
