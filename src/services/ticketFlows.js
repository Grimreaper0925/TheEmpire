import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { logger } from '../utils/logger.js';
import {
  PRIORITIES,
  averageFirstReply,
  checkCanOpen,
  closeTicket,
  createTicket,
  formatDuration,
  getRecord,
  getTicketConfig,
  padNumber,
  updateRecord,
} from './ticketSystem.js';

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const COLORS = { low: 0x3498db, normal: 0x2ecc71, high: 0xe67e22, urgent: 0xed4245, closed: 0x747f8d };

// ---------- panel ----------
export function buildPanel(config) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('tk_open')
    .setPlaceholder('Choose what you need help with')
    .addOptions(
      config.types.slice(0, 25).map((t) => ({
        label: t.label.slice(0, 100),
        description: t.description?.slice(0, 100) || undefined,
        value: t.key,
        emoji: t.emoji || undefined,
      }))
    );

  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(text(`# 🎫 ${config.panelTitle}\n${config.panelText}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('**How it works**\n1. Pick a topic from the menu\n2. Fill in a short form\n3. A private channel opens for you and our team\n4. When it is solved, you get a transcript and can rate the help'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(select))
    .addTextDisplayComponents(text(`-# Up to ${config.maxOpen} open tickets per member. Please do not share passwords or payment details.`));
  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

// ---------- ticket card ----------
export function buildCard(record, config, avgReplyMs) {
  const closed = record.status === 'closed';
  const prio = PRIORITIES[record.priority] || PRIORITIES.normal;
  const state = closed ? '🔒 Closed' : record.claimedBy ? `✋ Claimed by <@${record.claimedBy}>` : '🟡 Waiting for staff';

  const lines = [
    `# 🎫 Ticket #${padNumber(record.number)}`,
    `**${record.typeEmoji || ''} ${record.typeLabel}** · ${prio.emoji} ${prio.label} priority`,
    '',
    `**Opened by** <@${record.userId}>`,
    `**Status** ${state}`,
    `**Subject** ${record.subject}`,
  ];
  if (record.orderId) lines.push(`**Order** ${record.orderId}`);

  const container = new ContainerBuilder()
    .setAccentColor(closed ? COLORS.closed : COLORS[record.priority] || COLORS.normal)
    .addTextDisplayComponents(text(lines.join('\n')))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Details**\n${record.details.split('\n').map((l) => `> ${l}`).join('\n')}`));

  if (closed) {
    const who = record.closedBy ? `<@${record.closedBy}>` : 'staff';
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(`**Closed by** ${who}${record.closeReason ? `\n**Reason** ${record.closeReason}` : ''}\n-# A transcript was saved. Staff can reopen or delete this channel.`))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tk:reopen').setLabel('Reopen').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('tk:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('tk:delete').setLabel('Delete channel').setStyle(ButtonStyle.Danger)
        )
      );
  } else {
    const wait = avgReplyMs ? ` Our recent average first reply is **${formatDuration(avgReplyMs)}**.` : '';
    const prioSelect = new StringSelectMenuBuilder()
      .setCustomId('tk_prio')
      .setPlaceholder('Staff: set priority')
      .addOptions(Object.entries(PRIORITIES).map(([value, p]) => ({ label: `${p.label} priority`, value, emoji: p.emoji, default: value === record.priority })));
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(`${config.welcomeText}${wait}`))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tk:claim').setLabel(record.claimedBy ? 'Unclaim' : 'Claim').setStyle(record.claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success),
          new ButtonBuilder().setCustomId('tk:close').setLabel('Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('tk:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary)
        )
      )
      .addActionRowComponents(new ActionRowBuilder().addComponents(prioSelect));
  }
  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

export async function refreshCard(channel, record, config) {
  if (!record?.cardMessageId) return;
  const message = await channel.messages.fetch(record.cardMessageId).catch(() => null);
  if (!message) return;
  const avg = record.status === 'open' ? await averageFirstReply(record.guildId) : null;
  await message.edit(buildCard(record, config, avg)).catch((error) => logger.warn('Could not refresh ticket card', { error: error.message }));
}

async function logTo(guild, config, payload) {
  if (!config.logChannelId) return;
  const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ allowedMentions: { parse: [] }, ...payload }).catch(() => {});
}

// ---------- open ----------
export async function openTicketFlow(guild, member, config, form) {
  const problem = await checkCanOpen(guild, member, config);
  if (problem) return { error: problem };

  const { channel, record } = await createTicket(guild, member, config, form);

  const pings = [`<@${member.id}>`, ...config.staffRoleIds.map((id) => `<@&${id}>`)].join(' ');
  await channel.send({ content: pings, allowedMentions: { users: [member.id], roles: config.staffRoleIds } }).catch(() => {});

  const avg = await averageFirstReply(guild.id);
  const card = await channel.send(buildCard(record, config, avg));
  await updateRecord(guild.id, channel.id, { cardMessageId: card.id });
  await card.pin().catch(() => {});

  await logTo(guild, config, {
    content: `🎫 **Ticket #${padNumber(record.number)}** opened by <@${member.id}> in ${channel} (${record.typeLabel}): ${record.subject}`,
  });
  return { channel, record };
}

// ---------- close ----------
export async function closeFlow(guild, channel, record, config, { closedBy, reason }) {
  const result = await closeTicket(guild, channel, record, config, { closedBy, reason });
  const closed = result.record;
  await refreshCard(channel, closed, config);
  await channel.send({ content: `🔒 Ticket closed${closedBy ? ` by <@${closedBy}>` : ''}.${reason ? ` Reason: ${reason}` : ''}`, allowedMentions: { parse: [] } }).catch(() => {});

  if (result.transcript) {
    await logTo(guild, config, {
      content: `🔒 **Ticket #${padNumber(closed.number)}** (${closed.typeLabel}) closed${closedBy ? ` by <@${closedBy}>` : ''}. Opened by <@${closed.userId}>, ${result.transcript.count} messages${closed.claimedBy ? `, handled by <@${closed.claimedBy}>` : ''}.${reason ? `\nReason: ${reason}` : ''}`,
      files: [result.transcript.file],
    });

    const user = await guild.client.users.fetch(closed.userId).catch(() => null);
    if (user) {
      const rate = new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map((n) =>
          new ButtonBuilder().setCustomId(`tk:rate:${guild.id}:${channel.id}:${n}`).setLabel(`${n} ⭐`).setStyle(n >= 4 ? ButtonStyle.Success : n === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        )
      );
      await user
        .send({
          content: `Your ticket **#${padNumber(closed.number)}** in **${guild.name}** was closed.${reason ? `\nReason: ${reason}` : ''}\nA copy of the conversation is attached. How did we do?`,
          files: [result.transcript.file],
          components: [rate],
        })
        .catch(() => {});
    }
  }
  return closed;
}

export async function autoClose(guild, channel, record, config) {
  await closeFlow(guild, channel, record, config, { closedBy: null, reason: 'Closed automatically after no reply.' });
}

export async function loadContext(interaction) {
  const config = await getTicketConfig(interaction.guildId);
  const record = await getRecord(interaction.guildId, interaction.channelId);
  return { config, record };
}

export { logTo };
