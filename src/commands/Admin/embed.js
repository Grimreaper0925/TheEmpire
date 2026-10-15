import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { stashAnnouncement } from '../../services/announceStash.js';
import { parseHexColor, isHttpsUrl } from '../../services/announcementBuilder.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Post a clean card (rules, info, FAQ) or edit one the bot posted')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addChannelOption((o) => o.setName('channel').setDescription('Where to post').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addStringOption((o) => o.setName('color').setDescription('Color name (red, gold, purple...) or hex like #ff0000').setMaxLength(20))
    .addAttachmentOption((o) => o.setName('image').setDescription('Picture shown under the text'))
    .addStringOption((o) => o.setName('edit_message_id').setDescription('ID of a card the bot posted, to replace it').setMaxLength(25)),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'You need **Manage Messages** to use this.', flags: MessageFlags.Ephemeral });
    }
    const channel = interaction.options.getChannel('channel', true);
    const colorInput = interaction.options.getString('color');
    const color = colorInput ? parseHexColor(colorInput) : null;
    if (colorInput && color === null) return interaction.reply({ content: 'I could not read that color. Try `red`, `gold`, `purple` or `#ff0000`.', flags: MessageFlags.Ephemeral });

    const image = interaction.options.getAttachment('image');
    if (image && !image.contentType?.startsWith('image/')) return interaction.reply({ content: 'That attachment is not an image.', flags: MessageFlags.Ephemeral });

    const editId = (interaction.options.getString('edit_message_id') || '').trim();
    if (editId) {
      if (!/^\d{15,25}$/.test(editId)) return interaction.reply({ content: 'That does not look like a message ID.', flags: MessageFlags.Ephemeral });
      const target = await channel.messages.fetch(editId).catch(() => null);
      if (!target || target.author.id !== interaction.client.user.id) return interaction.reply({ content: 'I can only edit my own cards, and I could not find that one.', flags: MessageFlags.Ephemeral });
      if (!target.flags.has(MessageFlags.IsComponentsV2)) return interaction.reply({ content: 'That is a plain message. Edit it with `/say`.', flags: MessageFlags.Ephemeral });
    }

    const stash = stashAnnouncement({ color, imageUrl: image?.url || null });
    const field = (id, label, style, required, max, placeholder) =>
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max).setPlaceholder(placeholder));

    const modal = new ModalBuilder()
      .setCustomId(`embed_modal:${channel.id}:${editId || '0'}:${stash}`)
      .setTitle(editId ? 'Replace card' : 'New card')
      .addComponents(
        field('title', 'Title', TextInputStyle.Short, true, 100, 'Server rules'),
        field('body', 'Text', TextInputStyle.Paragraph, true, 3500, 'Supports **bold**, __underline__, > quotes, - lists and links.'),
        field('footer', 'Small text at the bottom (optional)', TextInputStyle.Short, false, 150, 'Last updated today')
      );
    return interaction.showModal(modal);
  },
};
