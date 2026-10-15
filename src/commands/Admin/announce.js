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
import { stashAnnouncement } from '../../services/announceStash.js';
import { ANNOUNCE_STYLES } from '../../services/announcementBuilder.js';

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
    .addStringOption((o) =>
      o
        .setName('style')
        .setDescription('Look of the announcement (default: News)')
        .addChoices(...Object.entries(ANNOUNCE_STYLES).map(([value, v]) => ({ name: `${v.emoji} ${v.label}`, value })))
    )
    .addRoleOption((o) => o.setName('ping').setDescription('Role to ping with it'))
    .addBooleanOption((o) => o.setName('ping_everyone').setDescription('Ping @everyone instead'))
    .addAttachmentOption((o) => o.setName('image').setDescription('Big banner image shown under the text'))
    .addStringOption((o) => o.setName('button_label').setDescription('Text on a link button, like "Shop now"').setMaxLength(80))
    .addStringOption((o) => o.setName('button_url').setDescription('Where the button goes (https://...)').setMaxLength(300)),

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

    const buttonUrl = interaction.options.getString('button_url');
    if (buttonUrl && !/^https:\/\/[^\s]+$/i.test(buttonUrl)) {
      return interaction.reply({ content: 'The button link must start with https://', flags: MessageFlags.Ephemeral });
    }

    const pingPart = everyone ? 'everyone' : role ? role.id : 'none';
    const stashKey = stashAnnouncement({
      styleKey: interaction.options.getString('style') || 'news',
      imageUrl: image?.url || null,
      buttonLabel: interaction.options.getString('button_label'),
      buttonUrl,
    });

    const modal = new ModalBuilder()
      .setCustomId(`announce_modal:${channel.id}:${pingPart}:${stashKey}`)
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
