import {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { getStoreConfig } from '../../services/storeService.js';
import { isHttpsUrl } from '../../services/announcementBuilder.js';
import { getSelfRoles } from '../../services/selfRoles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('restock')
    .setDescription('Post a restock or new product card')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) => o.setName('product').setDescription('Product name').setRequired(true).setMaxLength(100))
    .addStringOption((o) => o.setName('type').setDescription('What kind of post').addChoices({ name: 'Back in stock', value: 'restock' }, { name: 'New product', value: 'new' }, { name: 'Update', value: 'update' }))
    .addStringOption((o) => o.setName('details').setDescription('Extra info, like price or what changed').setMaxLength(500))
    .addStringOption((o) => o.setName('link').setDescription('Link to the product (https://...)').setMaxLength(300))
    .addChannelOption((o) => o.setName('channel').setDescription('Where to post').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addRoleOption((o) => o.setName('ping').setDescription('Role to ping (default: the Restock Ping role if it exists)'))
    .addAttachmentOption((o) => o.setName('image').setDescription('Product image')),
  category: 'Store',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const o = interaction.options;
    const store = await getStoreConfig(interaction.guildId);

    const channel = o.getChannel('channel') || (store.restockChannelId && (await interaction.guild.channels.fetch(store.restockChannelId).catch(() => null))) || interaction.channel;
    if (!channel.permissionsFor(interaction.guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return interaction.editReply(`I cannot post in ${channel}.`);

    const link = o.getString('link') || store.url;
    if (!isHttpsUrl(link)) return interaction.editReply('The link must start with https://');
    const image = o.getAttachment('image');
    if (image && !image.contentType?.startsWith('image/')) return interaction.editReply('That attachment is not an image.');

    const kinds = { restock: ['🟢', 'BACK IN STOCK', 0x2ecc71], new: ['🆕', 'NEW PRODUCT', 0x5865f2], update: ['🛠️', 'UPDATE', 0xe67e22] };
    const [emoji, label, color] = kinds[o.getString('type') || 'restock'];

    const container = new ContainerBuilder()
      .setAccentColor(color)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${emoji} ${label}\n# ${o.getString('product', true)}`));
    if (o.getString('details')) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(o.getString('details')));
    }
    if (image) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image.url)));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View in store').setStyle(ButtonStyle.Link).setURL(link)));

    const role = o.getRole('ping') || interaction.guild.roles.cache.get((await getSelfRoles(interaction.guildId)).pings?.restocks);
    const allowedMentions = role ? { roles: [role.id] } : { parse: [] };
    try {
      if (role) await channel.send({ content: `<@&${role.id}>`, allowedMentions });
      const sent = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
      return interaction.editReply(`Posted in ${channel}: ${sent.url}`);
    } catch (error) {
      return interaction.editReply(`I could not post there: ${error.message}`);
    }
  },
};
