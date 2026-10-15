import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { stashImage } from '../../services/announceStash.js';

export default {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post a nicely formatted announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Where to post it')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addRoleOption((o) => o.setName('ping').setDescription('Role to ping with it'))
    .addBooleanOption((o) => o.setName('ping_everyone').setDescription('Ping @everyone instead'))
    .addAttachmentOption((o) => o.setName('image').setDescription('Optional image for the announcement')),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('ping');
    const everyone = interaction.options.getBoolean('ping_everyone') === true;
    const image = interaction.options.getAttachment('image');

    if (image && !image.contentType?.startsWith('image/')) {
      return interaction.reply({ content: 'That attachment is not an image.', flags: MessageFlags.Ephemeral });
    }

    const perms = channel.permissionsFor(interaction.guild.members.me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return interaction.reply({
        content: `I need **View Channel**, **Send Messages** and **Embed Links** in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const pingPart = everyone ? 'everyone' : role ? role.id : 'none';
    const imagePart = image ? stashImage(image.url) : 'none';

    const modal = new ModalBuilder()
      .setCustomId(`announce_modal:${channel.id}:${pingPart}:${imagePart}`)
      .setTitle('New announcement')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('body').setLabel('Message').setStyle(TextInputStyle.Paragraph).setMaxLength(3500).setRequired(true)
        )
      );

    return interaction.showModal(modal);
  },
};
