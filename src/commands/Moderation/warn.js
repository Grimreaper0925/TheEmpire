import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { checkCanModerate, recordModAction } from '../../utils/modActions.js';
import { getAutomod } from '../../services/automodService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member (they get a DM, and repeat warnings can trigger a timeout or kick)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription('Who to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why').setRequired(true).setMaxLength(400)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const problem = checkCanModerate(interaction, member);
    if (problem) return interaction.editReply(problem);
    if (user.bot) return interaction.editReply('Bots cannot be warned.');

    const { totalCount } = await WarningService.addWarning({ guildId: interaction.guildId, userId: user.id, moderatorId: interaction.user.id, reason });
    const caseId = await recordModAction({ interaction, action: 'User Warned', targetUser: user, reason, extra: { warnings: totalCount } });

    const { warns } = await getAutomod(interaction.guildId);
    let escalation = '';
    let kicked = false;
    if (warns.kickAt && totalCount >= warns.kickAt && member.kickable) {
      await user.send(`You were removed from **${interaction.guild.name}** after ${totalCount} warnings. Last reason: ${reason}`).catch(() => {});
      kicked = await member.kick(`Reached ${totalCount} warnings`).then(() => true).catch(() => false);
      if (kicked) {
        escalation = `\nThey reached ${totalCount} warnings and were **kicked**.`;
        await recordModAction({ interaction, action: 'Member Kicked', targetUser: user, reason: `Reached ${totalCount} warnings` });
      }
    }
    if (!kicked && warns.timeoutAt && totalCount >= warns.timeoutAt && member.moderatable) {
      const done = await member.timeout(warns.timeoutMinutes * 60000, `Reached ${totalCount} warnings`).then(() => true).catch(() => false);
      if (done) {
        escalation = `\nThey reached ${totalCount} warnings and were **timed out for ${warns.timeoutMinutes} minutes**.`;
        await recordModAction({ interaction, action: 'Member Timed Out', targetUser: user, reason: `Reached ${totalCount} warnings`, duration: `${warns.timeoutMinutes} minutes` });
      }
    }

    if (!kicked) {
      await user
        .send(`You were warned in **${interaction.guild.name}**.\nReason: ${reason}\nThis is warning **${totalCount}**. Repeat warnings can lead to a timeout or removal.`)
        .catch(() => {});
    }
    return interaction.editReply(`Warned **${user.tag}** (warning ${totalCount}). Case #${caseId}.${escalation}`);
  },
};
