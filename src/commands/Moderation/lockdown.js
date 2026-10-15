import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { logModerationAction } from '../../utils/moderation.js';
import { describeUser } from '../../utils/modActions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Stop (or allow) everyone from sending messages in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('action')
        .setDescription('Lock or unlock')
        .setRequired(true)
        .addChoices({ name: 'Lock', value: 'lock' }, { name: 'Unlock', value: 'unlock' })
    )
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Defaults to this channel').addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((o) => o.setName('reason').setDescription('Why').setMaxLength(300)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const locking = interaction.options.getString('action', true) === 'lock';
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason given';

    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.editReply(`I'm missing **Manage Roles** in ${channel}, which Discord requires to change permissions.`);
    }

    // null clears the override, so unlock restores whatever the channel had before.
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      { SendMessages: locking ? false : null },
      { reason: `${interaction.user.tag}: ${reason}` }
    );

    await logModerationAction({
      client: interaction.client,
      guild: interaction.guild,
      event: {
        action: locking ? 'Channel Locked' : 'Channel Unlocked',
        target: `#${channel.name} (${channel.id})`,
        executor: describeUser(interaction.user),
        reason,
        metadata: { moderatorId: interaction.user.id },
      },
    });

    if (locking) {
      await channel.send('This channel is locked right now. Staff will open it again soon.').catch(() => {});
    }

    return interaction.editReply(locking ? `Locked ${channel}.` : `Unlocked ${channel}.`);
  },
};
