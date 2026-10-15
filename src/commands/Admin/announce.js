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
import { ANNOUNCE_STYLES, ANNOUNCE_VIBES, parseHexColor } from '../../services/announcementBuilder.js';

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
    .addStringOption((o) =>
      o
        .setName('vibe')
        .setDescription('How playful the text looks (default: Hype)')
        .addChoices(...Object.entries(ANNOUNCE_VIBES).map(([value, name]) => ({ name, value })))
    )
    .addRoleOption((o) => o.setName('ping').setDescription('Role to ping with it'))
    .addBooleanOption((o) => o.setName('ping_everyone').setDescription('Ping @everyone instead'))
    .addAttachmentOption((o) => o.setName('image').setDescription('Big banner image shown under the text'))
    .addStringOption((o) => o.setName('button_label').setDescription('Text on a link button, like "Shop now"').setMaxLength(80))
    .addStringOption((o) => o.setName('button_url').setDescription('Where the button goes (https://...)').setMaxLength(300))
    .addStringOption((o) => o.setName('color').setDescription('Custom card color as hex, like #ff0000').setMaxLength(7)),

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

    const colorInput = interaction.options.getString('color');
    const color = colorInput ? parseHexColor(colorInput) : null;
    if (colorInput && color === null) {
      return interaction.reply({ content: 'Use a hex color like `#ff0000`.', flags: MessageFlags.Ephemeral });
    }

    const pingPart = everyone ? 'everyone' : role ? role.id : 'none';
    const stashKey = stashAnnouncement({
      styleKey: interaction.options.getString('style') || 'news',
      imageUrl: image?.url || null,
      buttonLabel: interaction.options.getString('button_label'),
      buttonUrl,
      color,
      vibe: interaction.options.getString('vibe') || 'hype',
    });

    const modal = new ModalBuilder()
      .setCustomId(`announce_modal:${channel.id}:${pingPart}:${stashKey}`)
      .setTitle('New announcement')
      .addComponents(
        input('title', 'Title', TextInputStyle.Short, { max: 100, required: true, placeholder: 'GRIM EMPIRE HALLOWEEN SALE' }),
        input('tagline', 'Tagline (optional, shown under the title)', TextInputStyle.Short, {
          max: 120,
          placeholder: 'Everything is 30% off. Today only.',
        }),
        input('body', 'Message', TextInputStyle.Paragraph, {
          max: 1800,
          required: true,
          placeholder: 'Discord text works: **bold**, __underline__, ~~strike~~, ||spoiler||, > quote, ## big heading. Lines starting with - become bullets.',
        }),
        input('points', 'Highlights (optional, one per line)', TextInputStyle.Paragraph, {
          max: 900,
          placeholder: 'Instant delivery\nSupport tickets open 24/7\nUse code at checkout',
        }),
        input('closing', 'Sign-off line (optional)', TextInputStyle.Short, { max: 150, placeholder: 'See you in the Empire.' })
      );

    return interaction.showModal(modal);
  },
};

function input(id, label, style, { max, required = false, placeholder }) {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setMaxLength(max).setRequired(required);
  if (placeholder) field.setPlaceholder(placeholder);
  return new ActionRowBuilder().addComponents(field);
}
