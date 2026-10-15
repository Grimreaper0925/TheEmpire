import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { logModerationAction } from '../../utils/moderation.js';
import { describeUser } from '../../utils/modActions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('How many messages to scan (1-100)').setMinValue(1).setMaxValue(100).setRequired(true)
    )
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this person')),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;
    const me = interaction.guild.members.me;
    if (!channel?.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply("I'm missing **Manage Messages** in this channel.");
    }

    const amount = interaction.options.getInteger('amount', true);
    const target = interaction.options.getUser('user');

    let messages = await channel.messages.fetch({ limit: amount });
    if (target) messages = messages.filter((m) => m.author.id === target.id);

    // Discord only bulk-deletes messages younger than 14 days; `true` skips older ones.
    const deleted = await channel.bulkDelete(messages, true);

    await logModerationAction({
      client: interaction.client,
      guild: interaction.guild,
      event: {
        action: 'Messages Purged',
        target: target ? describeUser(target) : `#${channel.name}`,
        executor: describeUser(interaction.user),
        reason: `Deleted ${deleted.size} message(s) in #${channel.name}`,
        metadata: { moderatorId: interaction.user.id, userId: target?.id },
      },
    });

    return interaction.editReply(
      deleted.size === 0
        ? 'Nothing to delete. Messages older than 14 days can\'t be bulk deleted.'
        : `Deleted ${deleted.size} message${deleted.size === 1 ? '' : 's'}.`
    );
  },
};
