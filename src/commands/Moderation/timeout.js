import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { checkCanModerate, recordModAction } from '../../utils/modActions.js';

const DURATIONS = {
  '5m': { ms: 5 * 60 * 1000, label: '5 minutes' },
  '1h': { ms: 60 * 60 * 1000, label: '1 hour' },
  '6h': { ms: 6 * 60 * 60 * 1000, label: '6 hours' },
  '1d': { ms: 24 * 60 * 60 * 1000, label: '1 day' },
  '1w': { ms: 7 * 24 * 60 * 60 * 1000, label: '1 week' },
  remove: { ms: null, label: 'removed' },
};

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Mute a member for a while, or remove their timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('duration')
        .setDescription('How long')
        .setRequired(true)
        .addChoices(
          { name: '5 minutes', value: '5m' },
          { name: '1 hour', value: '1h' },
          { name: '6 hours', value: '6h' },
          { name: '1 day', value: '1d' },
          { name: '1 week', value: '1w' },
          { name: 'Remove timeout', value: 'remove' }
        )
    )
    .addStringOption((o) => o.setName('reason').setDescription('Why').setMaxLength(400)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user', true);
    const choice = DURATIONS[interaction.options.getString('duration', true)];
    const reason = interaction.options.getString('reason') || 'No reason given';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const problem = checkCanModerate(interaction, member, { needsBotPermission: PermissionFlagsBits.ModerateMembers });
    if (problem) return interaction.editReply(problem);

    await member.timeout(choice.ms, `${interaction.user.tag}: ${reason}`);

    const removing = choice.ms === null;
    const caseId = await recordModAction({
      interaction,
      action: removing ? 'Member Untimeouted' : 'Member Timed Out',
      targetUser: user,
      reason,
      duration: removing ? undefined : choice.label,
    });

    return interaction.editReply(
      removing
        ? `Removed the timeout on **${user.tag}**. Case #${caseId}.`
        : `Timed out **${user.tag}** for ${choice.label}. Case #${caseId}.`
    );
  },
};
