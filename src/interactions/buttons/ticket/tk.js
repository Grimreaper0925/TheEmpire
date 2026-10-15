import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import {
  buildTranscript,
  forgetTicket,
  getRecord,
  getTicketConfig,
  isStaff,
  reopenTicket,
  saveRating,
  setClaim,
  padNumber,
} from '../../../services/ticketSystem.js';
import { closeFlow, loadContext, logTo, refreshCard } from '../../../services/ticketFlows.js';

const eph = MessageFlags.Ephemeral;

export default {
  name: 'tk',
  async execute(interaction, client, args) {
    const action = args[0];

    // Ratings come from DMs, so there is no guild on the interaction.
    if (action === 'rate') return rate(interaction, args);

    const { config, record } = await loadContext(interaction);
    if (!record) return interaction.reply({ content: 'This channel is not an active ticket.', flags: eph });

    const staff = isStaff(interaction.member, config);
    const owner = interaction.user.id === record.userId;

    if (action === 'claim') {
      if (!staff) return interaction.reply({ content: 'Only staff can claim tickets.', flags: eph });
      if (record.status !== 'open') return interaction.reply({ content: 'This ticket is closed.', flags: eph });
      if (record.claimedBy && record.claimedBy !== interaction.user.id && !interaction.memberPermissions.has('ManageGuild')) {
        return interaction.reply({ content: `<@${record.claimedBy}> already has this ticket. Use \`/ticket transfer\` to hand it over.`, flags: eph });
      }
      const unclaim = record.claimedBy === interaction.user.id;
      const next = await setClaim(interaction.channel, record, unclaim ? null : interaction.user.id);
      await interaction.deferUpdate();
      await refreshCard(interaction.channel, next, config);
      return interaction.channel.send({
        content: unclaim ? `✋ <@${interaction.user.id}> released this ticket.` : `✋ <@${interaction.user.id}> is taking care of this ticket.`,
        allowedMentions: { parse: [] },
      });
    }

    if (action === 'close') {
      if (!staff && !(owner && config.ownerCanClose)) return interaction.reply({ content: 'Only staff can close this ticket.', flags: eph });
      if (record.status === 'closed') return interaction.reply({ content: 'This ticket is already closed.', flags: eph });
      const modal = new ModalBuilder()
        .setCustomId('tk_close')
        .setTitle('Close ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300).setPlaceholder('Solved, no reply, duplicate...')
          )
        );
      return interaction.showModal(modal);
    }

    if (action === 'reopen') {
      if (!staff) return interaction.reply({ content: 'Only staff can reopen tickets.', flags: eph });
      if (record.status !== 'closed') return interaction.reply({ content: 'This ticket is already open.', flags: eph });
      const next = await reopenTicket(interaction.channel, record);
      await interaction.deferUpdate();
      await refreshCard(interaction.channel, next, config);
      return interaction.channel.send({ content: `🔓 Ticket reopened by <@${interaction.user.id}>. <@${record.userId}>`, allowedMentions: { users: [record.userId] } });
    }

    if (action === 'transcript') {
      if (!staff && !owner) return interaction.reply({ content: 'Only staff or the ticket owner can do that.', flags: eph });
      await interaction.deferReply({ flags: eph });
      const transcript = await buildTranscript(interaction.channel, record);
      return interaction.editReply({ content: `Transcript of ticket #${padNumber(record.number)} (${transcript.count} messages).`, files: [transcript.file] });
    }

    if (action === 'delete') {
      if (!staff) return interaction.reply({ content: 'Only staff can delete tickets.', flags: eph });
      await interaction.reply({ content: '🗑️ Deleting this channel in 5 seconds...' });
      const channel = interaction.channel;
      setTimeout(async () => {
        await forgetTicket(interaction.guildId, channel.id);
        await channel.delete(`Ticket deleted by ${interaction.user.tag}`).catch(() => {});
      }, 5000);
      return;
    }
  },
};

async function rate(interaction, args) {
  const [, guildId, channelId, value] = args;
  const stars = Number(value);
  if (!guildId || !channelId || !(stars >= 1 && stars <= 5)) {
    return interaction.reply({ content: 'That rating link is not valid.', flags: eph });
  }
  const record = await getRecord(guildId, channelId);
  if (!record || record.userId !== interaction.user.id) {
    return interaction.update({ content: 'This rating is no longer available.', components: [] });
  }
  const result = await saveRating(guildId, channelId, stars);
  if (result?.already) return interaction.update({ content: `You already rated this ticket ${result.record.rating}/5. Thank you!`, components: [] });

  await interaction.update({ content: `Thanks for rating this ticket **${stars}/5**. We appreciate the feedback!`, components: [] });

  const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
  if (guild) {
    const config = await getTicketConfig(guildId);
    const handler = record.claimedBy ? ` Handled by <@${record.claimedBy}>.` : '';
    await logTo(guild, config, { content: `${'⭐'.repeat(stars)} Ticket **#${padNumber(record.number)}** rated **${stars}/5** by <@${record.userId}>.${handler}${stars <= 2 ? ' Worth a look.' : ''}` });
  }
}
