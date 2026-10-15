import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getVerifyConfig, saveVerifyConfig } from '../../services/verificationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('linkguard')
    .setDescription('Block links and invites from members who have not verified yet')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addBooleanOption((o) => o.setName('enabled').setDescription('Turn the guard on or off').setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName('timeout_minutes')
        .setDescription('Also time the person out for this long (0 = just delete the message)')
        .setMinValue(0)
        .setMaxValue(60)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getVerifyConfig(interaction.guildId);
    if (!config.roleId) {
      return interaction.editReply('Run `/verifysetup` first so I know which role means "verified".');
    }

    config.linkGuard = interaction.options.getBoolean('enabled', true);
    const minutes = interaction.options.getInteger('timeout_minutes');
    if (minutes !== null) config.linkGuardTimeoutMinutes = minutes;
    await saveVerifyConfig(interaction.guildId, config);

    if (!config.linkGuard) return interaction.editReply('Link guard is off.');

    const mins = config.linkGuardTimeoutMinutes ?? 0;
    return interaction.editReply(
      `Link guard is on. Members without <@&${config.roleId}> can't post links or invites. ` +
        (mins > 0 ? `They also get a ${mins}-minute timeout.` : 'Their message is just deleted.') +
        '\nStaff with Manage Messages are never affected.'
    );
  },
};
