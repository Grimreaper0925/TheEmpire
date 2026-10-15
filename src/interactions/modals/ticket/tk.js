import { MessageFlags } from 'discord.js';
import { getTicketConfig, isStaff } from '../../../services/ticketSystem.js';
import { closeFlow, loadContext, openTicketFlow } from '../../../services/ticketFlows.js';
import { logger } from '../../../utils/logger.js';

const eph = MessageFlags.Ephemeral;
const read = (interaction, id) => {
  try {
    return interaction.fields.getTextInputValue(id).trim();
  } catch {
    return '';
  }
};

const newModal = {
  name: 'tk_new',
  async execute(interaction, client, args) {
    await interaction.deferReply({ flags: eph });
    const config = await getTicketConfig(interaction.guildId);
    try {
      const result = await openTicketFlow(interaction.guild, interaction.member, config, {
        typeKey: args[0],
        subject: read(interaction, 'subject'),
        orderId: read(interaction, 'order'),
        details: read(interaction, 'details'),
      });
      if (result.error) return interaction.editReply(result.error);
      return interaction.editReply(`Your ticket is open: ${result.channel}. A member of our team will be with you soon.`);
    } catch (error) {
      logger.error('Could not open ticket', { error: error.message });
      return interaction.editReply('I could not open your ticket. Please tell a staff member. (The bot may be missing **Manage Channels**, or the ticket category is full.)');
    }
  },
};

const closeModal = {
  name: 'tk_close',
  async execute(interaction) {
    await interaction.deferReply({ flags: eph });
    const { config, record } = await loadContext(interaction);
    if (!record || record.status !== 'open') return interaction.editReply('This ticket is already closed.');
    const owner = interaction.user.id === record.userId;
    if (!isStaff(interaction.member, config) && !(owner && config.ownerCanClose)) return interaction.editReply('Only staff can close this ticket.');
    await interaction.editReply('Closing the ticket and saving the transcript...');
    await closeFlow(interaction.guild, interaction.channel, record, config, { closedBy: interaction.user.id, reason: read(interaction, 'reason') });
    await interaction.editReply('Done. The ticket is closed.').catch(() => {});
  },
};

export default [newModal, closeModal];
