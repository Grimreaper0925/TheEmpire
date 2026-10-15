import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Post a message as the bot (or edit one it posted earlier)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addChannelOption((o) => o.setName('channel').setDescription('Where to post').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addStringOption((o) => o.setName('edit_message_id').setDescription('ID of a bot message to edit instead of posting a new one').setMaxLength(25)),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'You need **Manage Messages** to use this.', flags: MessageFlags.Ephemeral });
    }
    const channel = interaction.options.getChannel('channel', true);
    const editId = (interaction.options.getString('edit_message_id') || '').trim();

    let prefill = '';
    if (editId) {
      if (!/^\d{15,25}$/.test(editId)) return interaction.reply({ content: 'That does not look like a message ID.', flags: MessageFlags.Ephemeral });
      const target = await channel.messages.fetch(editId).catch(() => null);
      if (!target || target.author.id !== interaction.client.user.id) {
        return interaction.reply({ content: 'I can only edit my own messages, and I could not find that one in that channel.', flags: MessageFlags.Ephemeral });
      }
      if (target.flags.has(MessageFlags.IsComponentsV2)) {
        return interaction.reply({ content: 'That message is a card. Edit cards with `/embed` instead.', flags: MessageFlags.Ephemeral });
      }
      prefill = target.content.slice(0, 2000);
    }

    const input = new TextInputBuilder()
      .setCustomId('text')
      .setLabel('Message')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder('Supports **bold**, __underline__, > quotes, lists and links.');
    if (prefill) input.setValue(prefill);

    const modal = new ModalBuilder()
      .setCustomId(`say_modal:${channel.id}:${editId || '0'}`)
      .setTitle(editId ? 'Edit message' : 'Post a message')
      .addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  },
};
