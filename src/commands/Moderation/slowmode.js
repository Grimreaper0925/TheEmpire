import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode on a channel (0 turns it off)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addIntegerOption((o) =>
      o.setName('seconds').setDescription('Seconds between messages (0-21600)').setMinValue(0).setMaxValue(21600).setRequired(true)
    )
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Defaults to this channel').addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const seconds = interaction.options.getInteger('seconds', true);
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply(`I'm missing **Manage Channels** in ${channel}.`);
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

    return interaction.editReply(
      seconds === 0 ? `Slowmode is off in ${channel}.` : `Slowmode in ${channel} is now ${seconds} second${seconds === 1 ? '' : 's'}.`
    );
  },
};
