import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { WarningService } from '../../services/moderation/warningService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('See a member\'s warnings, and remove them')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser('user', true);
    const warnings = await WarningService.getWarnings(interaction.guildId, user.id);

    if (!warnings.length) return interaction.editReply(`**${user.tag}** has no warnings.`);

    const lines = warnings.slice(-15).map((w, i) => {
      const number = warnings.length - Math.min(15, warnings.length) + i + 1;
      return `**#${number}** <t:${Math.floor(w.timestamp / 1000)}:d> by <@${w.moderatorId}>: ${String(w.reason).slice(0, 150)}`;
    });
    const embed = new EmbedBuilder().setTitle(`Warnings for ${user.tag}`).setDescription(lines.join('\n')).setColor(0xe67e22);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`warning_delete_specific:${user.id}:${interaction.user.id}`).setLabel('Remove one').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`warning_clear_all:${user.id}:${interaction.user.id}`).setLabel('Clear all').setStyle(ButtonStyle.Danger)
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};
