import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getModerationCases } from '../../utils/moderation.js';
import { createEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('See the moderation history for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription('Whose history').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user', true);
    const cases = await getModerationCases(interaction.guildId, { userId: user.id, limit: 10 });

    if (cases.length === 0) {
      return interaction.editReply(`No moderation history for **${user.tag}**.`);
    }

    const lines = cases.map((c) => {
      const when = `<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:d>`;
      const reason = String(c.reason || 'No reason given').slice(0, 80);
      return `**#${c.caseId}** · ${c.action} · ${when}\n> ${reason}`;
    });

    const embed = createEmbed({
      title: `Cases for ${user.tag}`,
      description: lines.join('\n').slice(0, 4000),
    });

    return interaction.editReply({ embeds: [embed] });
  },
};
