import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { getScheduled, removeScheduled } from '../../services/announceSchedule.js';
import { describeRepeat, tzLabel } from '../../services/announceTime.js';

export default {
  data: new SlashCommandBuilder()
    .setName('announce-schedule')
    .setDescription('See or cancel announcements you scheduled with /announce')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('list').setDescription('Show every scheduled announcement'))
    .addSubcommand((s) =>
      s
        .setName('cancel')
        .setDescription('Cancel a scheduled announcement')
        .addStringOption((o) => o.setName('id').setDescription('The ID shown in /announce-schedule list').setRequired(true).setMaxLength(10))
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'You need **Manage Server** to use this.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (interaction.options.getSubcommand() === 'cancel') {
      const removed = await removeScheduled(interaction.guildId, interaction.options.getString('id', true));
      if (!removed) return interaction.editReply('I could not find a scheduled announcement with that ID. Check `/announce-schedule list`.');
      return interaction.editReply(`🗑️ Cancelled **${String(removed.fields.title).slice(0, 80)}** (was set for <t:${Math.floor(removed.runAt / 1000)}:F>).`);
    }

    const items = (await getScheduled(interaction.guildId)).sort((a, b) => a.runAt - b.runAt);
    if (!items.length) return interaction.editReply('Nothing is scheduled. Use `/announce` with the **when** option, or press **Schedule for later** on a preview.');

    const lines = items.map((i) => {
      const ts = Math.floor(i.runAt / 1000);
      return `\`${i.id}\`  <t:${ts}:F> (<t:${ts}:R>)\n<#${i.channelId}>  •  ${describeRepeat(i.repeat)}  •  **${String(i.fields.title).slice(0, 50)}**`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Scheduled announcements (${items.length})`)
      .setDescription(lines.join('\n\n').slice(0, 4000))
      .setFooter({ text: `Times show in your own time zone. Cancel with /announce-schedule cancel. Typed times use ${tzLabel()}.` });
    return interaction.editReply({ embeds: [embed] });
  },
};
