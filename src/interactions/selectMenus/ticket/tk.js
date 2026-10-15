import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { PRIORITIES, checkCanOpen, getTicketConfig, isStaff, setPriority } from '../../../services/ticketSystem.js';
import { buildPanel, loadContext, refreshCard } from '../../../services/ticketFlows.js';

const eph = MessageFlags.Ephemeral;

const openMenu = {
  name: 'tk_open',
  async execute(interaction) {
    const config = await getTicketConfig(interaction.guildId);
    const type = config.types.find((t) => t.key === interaction.values[0]);
    if (!type) return interaction.reply({ content: 'That topic is no longer available.', flags: eph });

    const problem = await checkCanOpen(interaction.guild, interaction.member, config);
    if (problem) {
      await interaction.reply({ content: problem, flags: eph });
    } else {
      const field = (id, label, style, required, max, placeholder) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max).setPlaceholder(placeholder)
        );
      const modal = new ModalBuilder()
        .setCustomId(`tk_new:${type.key}`)
        .setTitle(`${type.emoji ? `${type.emoji} ` : ''}${type.label}`.slice(0, 45))
        .addComponents(
          field('subject', 'Short summary', TextInputStyle.Short, true, 100, 'e.g. Did not receive my key'),
          field('order', 'Order number or email (optional)', TextInputStyle.Short, false, 100, 'Helps us find your order faster'),
          field('details', 'What is going on?', TextInputStyle.Paragraph, true, 1000, 'Tell us what happened and what you already tried.')
        );
      await interaction.showModal(modal);
    }

    // Reset the menu so the same topic can be picked again.
    interaction.message.edit(buildPanel(config)).catch(() => {});
  },
};

const prioMenu = {
  name: 'tk_prio',
  async execute(interaction) {
    const { config, record } = await loadContext(interaction);
    if (!record) return interaction.reply({ content: 'This channel is not an active ticket.', flags: eph });
    if (!isStaff(interaction.member, config)) return interaction.reply({ content: 'Only staff can change the priority.', flags: eph });
    if (record.status !== 'open') return interaction.reply({ content: 'This ticket is closed.', flags: eph });

    const priority = interaction.values[0];
    if (!PRIORITIES[priority]) return interaction.reply({ content: 'Unknown priority.', flags: eph });
    const next = await setPriority(interaction.channel, record, priority);
    await interaction.deferUpdate();
    await refreshCard(interaction.channel, next, config);

    const roles = priority === 'urgent' ? config.staffRoleIds : [];
    await interaction.channel.send({
      content: `${PRIORITIES[priority].emoji} <@${interaction.user.id}> set the priority to **${PRIORITIES[priority].label}**.${roles.length ? ` ${roles.map((id) => `<@&${id}>`).join(' ')}` : ''}`,
      allowedMentions: { roles },
    });
  },
};

export default [openMenu, prioMenu];
