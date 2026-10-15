import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { checkCanModerate, recordModAction } from '../../utils/modActions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member (works even if they already left)')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription('Who to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why').setMaxLength(400))
    .addIntegerOption((o) =>
      o
        .setName('delete_days')
        .setDescription('Also delete their messages from the last N days (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason given';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (member) {
      const problem = checkCanModerate(interaction, member, { needsBotPermission: PermissionFlagsBits.BanMembers });
      if (problem) return interaction.editReply(problem);
    } else if (user.id === interaction.user.id) {
      return interaction.editReply("You can't do that to yourself.");
    } else if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply("I'm missing the **BanMembers** permission.");
    }

    await interaction.guild.members.ban(user.id, {
      reason: `${interaction.user.tag}: ${reason}`,
      deleteMessageSeconds: deleteDays * 86400,
    });
    const caseId = await recordModAction({ interaction, action: 'Member Banned', targetUser: user, reason });

    return interaction.editReply(`Banned **${user.tag}**. Case #${caseId}.`);
  },
};
