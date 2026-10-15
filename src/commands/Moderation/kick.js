import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { checkCanModerate, recordModAction } from '../../utils/modActions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription('Who to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why').setMaxLength(400)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason given';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const problem = checkCanModerate(interaction, member, { needsBotPermission: PermissionFlagsBits.KickMembers });
    if (problem) return interaction.editReply(problem);

    await member.kick(`${interaction.user.tag}: ${reason}`);
    const caseId = await recordModAction({ interaction, action: 'Member Kicked', targetUser: user, reason });

    return interaction.editReply(`Kicked **${user.tag}**. Case #${caseId}.`);
  },
};
