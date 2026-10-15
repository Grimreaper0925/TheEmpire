import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, EmbedBuilder } from 'discord.js';
import {
  getTicketConfig,
  saveTicketConfig,
  isStaff,
  getRecord,
  listRecords,
  getHistory,
  setClaim,
  addUser,
  removeUser,
  updateRecord,
  channelNameFor,
  averageFirstReply,
  formatDuration,
  PRIORITIES,
} from '../../services/ticketSystem.js';
import { buildPanel, closeFlow, refreshCard } from '../../services/ticketFlows.js';

const eph = MessageFlags.Ephemeral;

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Support tickets: set up the panel and manage tickets')
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription('Post the ticket panel and set up tickets')
        .addChannelOption((o) => o.setName('panel_channel').setDescription('Where the ticket panel goes').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addChannelOption((o) => o.setName('category').setDescription('Category new tickets are created in').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
        .addRoleOption((o) => o.setName('support_role').setDescription('Role that can see and answer tickets').setRequired(true))
        .addChannelOption((o) => o.setName('log_channel').setDescription('Where transcripts and ratings are sent').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand((s) => s.setName('panel').setDescription('Re-post the ticket panel in the current channel'))
    .addSubcommand((s) =>
      s
        .setName('settings')
        .setDescription('Change ticket settings')
        .addIntegerOption((o) => o.setName('max_open').setDescription('Open tickets allowed per member').setMinValue(1).setMaxValue(10))
        .addIntegerOption((o) => o.setName('cooldown_seconds').setDescription('Wait between new tickets').setMinValue(0).setMaxValue(3600))
        .addIntegerOption((o) => o.setName('inactivity_hours').setDescription('Auto-close after this many quiet hours (0 = never)').setMinValue(0).setMaxValue(720))
        .addIntegerOption((o) => o.setName('auto_delete_hours').setDescription('Delete closed tickets after this many hours (0 = never)').setMinValue(0).setMaxValue(720))
        .addBooleanOption((o) => o.setName('owner_can_close').setDescription('Can members close their own tickets?'))
        .addChannelOption((o) => o.setName('log_channel').setDescription('Where transcripts and ratings are sent').addChannelTypes(ChannelType.GuildText))
        .addChannelOption((o) => o.setName('category').setDescription('Category new tickets are created in').addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption((o) => o.setName('add_staff_role').setDescription('Another role that can answer tickets'))
        .addRoleOption((o) => o.setName('remove_staff_role').setDescription('Remove a support role'))
        .addStringOption((o) => o.setName('panel_title').setDescription('Title of the panel').setMaxLength(60))
        .addStringOption((o) => o.setName('panel_text').setDescription('Text under the panel title').setMaxLength(500))
        .addStringOption((o) => o.setName('welcome_text').setDescription('Message shown inside every new ticket').setMaxLength(400))
    )
    .addSubcommand((s) =>
      s
        .setName('type-add')
        .setDescription('Add a topic to the panel menu')
        .addStringOption((o) => o.setName('name').setDescription('Topic name').setRequired(true).setMaxLength(50))
        .addStringOption((o) => o.setName('emoji').setDescription('One emoji').setMaxLength(8))
        .addStringOption((o) => o.setName('description').setDescription('Short description').setMaxLength(100))
    )
    .addSubcommand((s) =>
      s
        .setName('type-remove')
        .setDescription('Remove a topic from the panel menu')
        .addStringOption((o) => o.setName('name').setDescription('Topic to remove').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) => s.setName('add').setDescription('Add a member to this ticket').addUserOption((o) => o.setName('user').setDescription('Who to add').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a member from this ticket').addUserOption((o) => o.setName('user').setDescription('Who to remove').setRequired(true)))
    .addSubcommand((s) => s.setName('rename').setDescription('Rename this ticket channel').addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(60)))
    .addSubcommand((s) => s.setName('close').setDescription('Close this ticket').addStringOption((o) => o.setName('reason').setDescription('Why it is being closed').setMaxLength(300)))
    .addSubcommand((s) => s.setName('transfer').setDescription('Hand this ticket to another staff member').addUserOption((o) => o.setName('staff').setDescription('Who takes over').setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('blacklist')
        .setDescription('Stop a member from opening tickets')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(200))
    )
    .addSubcommand((s) => s.setName('unblacklist').setDescription('Let a member open tickets again').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand((s) => s.setName('stats').setDescription('Ticket numbers, reply times, ratings and top staff')),
  category: 'Ticket',

  async autocomplete(interaction) {
    const config = await getTicketConfig(interaction.guildId);
    const typed = interaction.options.getFocused().toLowerCase();
    await interaction.respond(
      config.types.filter((t) => t.label.toLowerCase().includes(typed)).slice(0, 25).map((t) => ({ name: t.label, value: t.key }))
    );
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = await getTicketConfig(interaction.guildId);
    const manager = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
    const staff = isStaff(interaction.member, config);

    const needManager = ['setup', 'panel', 'settings', 'type-add', 'type-remove', 'blacklist', 'unblacklist', 'stats'];
    if (needManager.includes(sub) && !(manager || (sub === 'stats' && staff))) {
      return interaction.reply({ content: 'You need **Manage Server** to use that.', flags: eph });
    }

    if (sub === 'setup') return setup(interaction, config);
    if (sub === 'panel') return postPanel(interaction, config);
    if (sub === 'settings') return settings(interaction, config);
    if (sub === 'type-add') return typeAdd(interaction, config);
    if (sub === 'type-remove') return typeRemove(interaction, config);
    if (sub === 'blacklist' || sub === 'unblacklist') return blacklist(interaction, config, sub === 'blacklist');
    if (sub === 'stats') return stats(interaction, config);

    // Everything below works inside a ticket channel.
    const record = await getRecord(interaction.guildId, interaction.channelId);
    if (!record) return interaction.reply({ content: 'Use this inside a ticket channel.', flags: eph });
    if (!staff && !(sub === 'close' && interaction.user.id === record.userId && config.ownerCanClose)) {
      return interaction.reply({ content: 'Only staff can do that.', flags: eph });
    }

    if (sub === 'add' || sub === 'remove') {
      const user = interaction.options.getUser('user', true);
      if (user.bot) return interaction.reply({ content: 'Bots cannot be added.', flags: eph });
      if (sub === 'add') await addUser(interaction.channel, record, user);
      else {
        if (user.id === record.userId) return interaction.reply({ content: 'You cannot remove the person who opened the ticket.', flags: eph });
        await removeUser(interaction.channel, record, user);
      }
      return interaction.reply({ content: sub === 'add' ? `➕ ${user} was added to this ticket.` : `➖ ${user} was removed from this ticket.`, allowedMentions: { users: sub === 'add' ? [user.id] : [] } });
    }

    if (sub === 'rename') {
      const name = interaction.options.getString('name', true).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ticket';
      const base = channelNameFor(record, record.username).split('ticket-')[0];
      interaction.channel.setName(`${base}${name}`.slice(0, 100)).catch(() => {});
      return interaction.reply({ content: `Renaming to \`${name}\`. Discord limits renames, so it can take a moment.`, flags: eph });
    }

    if (sub === 'transfer') {
      const target = await interaction.guild.members.fetch(interaction.options.getUser('staff', true).id).catch(() => null);
      if (!target || !isStaff(target, config)) return interaction.reply({ content: 'That member is not on the support team.', flags: eph });
      const next = await setClaim(interaction.channel, record, target.id);
      await interaction.reply({ content: `🔁 <@${interaction.user.id}> handed this ticket to ${target}.`, allowedMentions: { users: [target.id] } });
      return refreshCard(interaction.channel, next, config);
    }

    if (sub === 'close') {
      if (record.status === 'closed') return interaction.reply({ content: 'This ticket is already closed.', flags: eph });
      await interaction.reply({ content: 'Closing the ticket and saving the transcript...', flags: eph });
      return closeFlow(interaction.guild, interaction.channel, record, config, { closedBy: interaction.user.id, reason: interaction.options.getString('reason') || '' });
    }
  },
};

async function postPanel(interaction, config) {
  const message = await interaction.channel.send(buildPanel(config)).catch(() => null);
  if (!message) return interaction.reply({ content: 'I cannot post here. Give me **Send Messages** in this channel.', flags: eph });
  config.panelChannelId = interaction.channelId;
  config.panelMessageId = message.id;
  await saveTicketConfig(interaction.guildId, config);
  return interaction.reply({ content: 'Panel posted.', flags: eph });
}

async function setup(interaction, config) {
  await interaction.deferReply({ flags: eph });
  const channel = interaction.options.getChannel('panel_channel', true);
  const category = interaction.options.getChannel('category', true);
  const role = interaction.options.getRole('support_role', true);
  const log = interaction.options.getChannel('log_channel');

  const perms = channel.permissionsFor(interaction.guild.members.me);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    return interaction.editReply(`I cannot post in ${channel}. Give me **View Channel** and **Send Messages** there.`);
  }
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply('I need the **Manage Channels** permission to create tickets.');
  }

  config.categoryId = category.id;
  config.staffRoleIds = [...new Set([...config.staffRoleIds, role.id])];
  if (log) config.logChannelId = log.id;

  const message = await channel.send(buildPanel(config));
  config.panelChannelId = channel.id;
  config.panelMessageId = message.id;
  await saveTicketConfig(interaction.guildId, config);

  return interaction.editReply(
    `Tickets are live. The panel is in ${channel}, tickets open in **${category.name}**, and ${role} can answer them.` +
      (log ? ` Transcripts and ratings go to ${log}.` : '\nTip: add a log channel with `/ticket settings log_channel:` to keep transcripts and ratings.') +
      '\nTune it with `/ticket settings`, and add topics with `/ticket type-add`.'
  );
}

async function settings(interaction, config) {
  const o = interaction.options;
  const changes = [];
  const set = (key, value, label) => {
    if (value !== null && value !== undefined) {
      config[key] = value;
      changes.push(label);
    }
  };
  set('maxOpen', o.getInteger('max_open'), 'max open tickets');
  set('cooldownSec', o.getInteger('cooldown_seconds'), 'cooldown');
  set('inactivityHours', o.getInteger('inactivity_hours'), 'inactivity auto-close');
  set('autoDeleteHours', o.getInteger('auto_delete_hours'), 'auto-delete');
  set('ownerCanClose', o.getBoolean('owner_can_close'), 'owner can close');
  set('logChannelId', o.getChannel('log_channel')?.id ?? null, 'log channel');
  set('categoryId', o.getChannel('category')?.id ?? null, 'category');
  set('panelTitle', o.getString('panel_title'), 'panel title');
  set('panelText', o.getString('panel_text'), 'panel text');
  set('welcomeText', o.getString('welcome_text'), 'welcome text');
  const add = o.getRole('add_staff_role');
  if (add) { config.staffRoleIds = [...new Set([...config.staffRoleIds, add.id])]; changes.push('added support role'); }
  const rem = o.getRole('remove_staff_role');
  if (rem) { config.staffRoleIds = config.staffRoleIds.filter((id) => id !== rem.id); changes.push('removed support role'); }

  if (!changes.length) {
    const roles = config.staffRoleIds.map((id) => `<@&${id}>`).join(' ') || 'none';
    return interaction.reply({
      flags: eph,
      content:
        `**Ticket settings**\nPanel: ${config.panelChannelId ? `<#${config.panelChannelId}>` : 'not posted'}\nCategory: ${config.categoryId ? `<#${config.categoryId}>` : 'not set'}\nLog channel: ${config.logChannelId ? `<#${config.logChannelId}>` : 'not set'}\nSupport roles: ${roles}\n` +
        `Max open per member: ${config.maxOpen}, cooldown ${config.cooldownSec}s\nAuto-close after ${config.inactivityHours || 'never'}h quiet, delete closed after ${config.autoDeleteHours || 'never'}h\nMembers can close their own: ${config.ownerCanClose ? 'yes' : 'no'}\nTopics: ${config.types.map((t) => t.label).join(', ')}`,
    });
  }

  await saveTicketConfig(interaction.guildId, config);
  await refreshPanel(interaction, config);
  return interaction.reply({ content: `Saved: ${changes.join(', ')}.`, flags: eph });
}

async function refreshPanel(interaction, config) {
  if (!config.panelChannelId || !config.panelMessageId) return;
  const channel = await interaction.guild.channels.fetch(config.panelChannelId).catch(() => null);
  const message = await channel?.messages.fetch(config.panelMessageId).catch(() => null);
  await message?.edit(buildPanel(config)).catch(() => {});
}

async function typeAdd(interaction, config) {
  if (config.types.length >= 25) return interaction.reply({ content: 'A menu holds up to 25 topics.', flags: eph });
  const label = interaction.options.getString('name', true).trim();
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || `topic-${config.types.length + 1}`;
  if (config.types.some((t) => t.key === key)) return interaction.reply({ content: 'A topic with that name already exists.', flags: eph });
  config.types.push({ key, label, emoji: interaction.options.getString('emoji') || '📌', description: interaction.options.getString('description') || '' });
  await saveTicketConfig(interaction.guildId, config);
  await refreshPanel(interaction, config);
  return interaction.reply({ content: `Added **${label}** to the panel.`, flags: eph });
}

async function typeRemove(interaction, config) {
  const key = interaction.options.getString('name', true);
  if (config.types.length <= 1) return interaction.reply({ content: 'You need at least one topic.', flags: eph });
  const before = config.types.length;
  config.types = config.types.filter((t) => t.key !== key);
  if (config.types.length === before) return interaction.reply({ content: 'I could not find that topic.', flags: eph });
  await saveTicketConfig(interaction.guildId, config);
  await refreshPanel(interaction, config);
  return interaction.reply({ content: 'Topic removed from the panel.', flags: eph });
}

async function blacklist(interaction, config, add) {
  const user = interaction.options.getUser('user', true);
  config.blacklist = config.blacklist || {};
  if (add) config.blacklist[user.id] = { reason: interaction.options.getString('reason') || '', by: interaction.user.id, at: Date.now() };
  else delete config.blacklist[user.id];
  await saveTicketConfig(interaction.guildId, config);
  return interaction.reply({ content: add ? `${user} can no longer open tickets.` : `${user} can open tickets again.`, flags: eph, allowedMentions: { parse: [] } });
}

async function stats(interaction, config) {
  await interaction.deferReply({ flags: eph });
  const [hist, open, avgReply] = await Promise.all([getHistory(interaction.guildId), listRecords(interaction.guildId), averageFirstReply(interaction.guildId)]);
  const openNow = open.filter((r) => r.status === 'open');
  const rated = hist.filter((h) => h.rating);
  const avgRating = rated.length ? (rated.reduce((n, h) => n + h.rating, 0) / rated.length).toFixed(2) : 'no ratings yet';

  const byStaff = {};
  for (const h of hist) if (h.claimedBy) byStaff[h.claimedBy] = (byStaff[h.claimedBy] || 0) + 1;
  const top = Object.entries(byStaff).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n], i) => `${i + 1}. <@${id}> - ${n} solved`).join('\n') || 'Nobody yet';

  const byType = {};
  for (const h of hist) byType[h.type] = (byType[h.type] || 0) + 1;
  const topics = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${config.types.find((t) => t.key === k)?.label || k}: ${n}`).join('\n') || 'None yet';

  const urgent = openNow.filter((r) => r.priority === 'urgent' || r.priority === 'high').length;
  const embed = new EmbedBuilder()
    .setTitle('Ticket stats')
    .setDescription(
      `**Open now:** ${openNow.length}${urgent ? ` (${urgent} high or urgent)` : ''}\n` +
        `**Unclaimed:** ${openNow.filter((r) => !r.claimedBy).length}\n` +
        `**Closed (all time):** ${hist.length}\n` +
        `**Average first reply:** ${avgReply ? formatDuration(avgReply) : 'n/a'}\n` +
        `**Average rating:** ${avgRating}${rated.length ? ` (${rated.length} ratings)` : ''}\n\n` +
        `**Top staff**\n${top}\n\n**Popular topics**\n${topics}`
    )
    .setColor(0x5865f2);
  return interaction.editReply({ embeds: [embed] });
}
