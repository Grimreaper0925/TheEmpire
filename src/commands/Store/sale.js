import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { getStoreConfig, saveStoreConfig, endOfPacificDay, describePromo } from '../../services/storeService.js';
import { buildAnnouncement, isHttpsUrl } from '../../services/announcementBuilder.js';
import { getSelfRoles } from '../../services/selfRoles.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sale')
    .setDescription('Start a sale: saves the promo and posts a promo announcement in one step')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) => o.setName('code').setDescription('Discount code customers enter at checkout').setRequired(true).setMaxLength(40))
    .addIntegerOption((o) => o.setName('percent').setDescription('Percent off').setRequired(true).setMinValue(1).setMaxValue(100))
    .addStringOption((o) => o.setName('ends').setDescription('Last day, like 2026-12-31 (end of that day, Pacific time)').setMaxLength(10))
    .addIntegerOption((o) => o.setName('hours').setDescription('...or the sale lasts this many hours from now').setMinValue(1).setMaxValue(720))
    .addChannelOption((o) => o.setName('channel').setDescription('Where to post (default: the sales channel)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addRoleOption((o) => o.setName('ping').setDescription('Role to ping (default: the Sales Ping role if it exists)'))
    .addBooleanOption((o) => o.setName('ping_everyone').setDescription('Ping @everyone instead'))
    .addStringOption((o) => o.setName('title').setDescription('Headline, like HALLOWEEN SALE').setMaxLength(100))
    .addStringOption((o) => o.setName('details').setDescription('Extra line under the headline').setMaxLength(300))
    .addAttachmentOption((o) => o.setName('image').setDescription('Banner image')),
  category: 'Store',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const o = interaction.options;
    const store = await getStoreConfig(interaction.guildId);
    const code = o.getString('code', true).trim().toUpperCase();
    const percent = o.getInteger('percent', true);

    let endsAt = null;
    if (o.getString('ends')) {
      const m = o.getString('ends').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const date = m && endOfPacificDay(Number(m[1]), Number(m[2]), Number(m[3]));
      if (!date) return interaction.editReply('Use the date format YYYY-MM-DD, like 2026-12-31.');
      endsAt = date;
    } else if (o.getInteger('hours')) {
      endsAt = new Date(Date.now() + o.getInteger('hours') * 3600000);
    }
    if (endsAt && endsAt.getTime() <= Date.now()) return interaction.editReply('That end date has already passed.');

    const channel = o.getChannel('channel') || (store.salesChannelId && (await interaction.guild.channels.fetch(store.salesChannelId).catch(() => null))) || interaction.channel;
    const perms = channel.permissionsFor(interaction.guild.members.me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return interaction.editReply(`I cannot post in ${channel}.`);

    const image = o.getAttachment('image');
    if (image && !image.contentType?.startsWith('image/')) return interaction.editReply('That attachment is not an image.');

    // The announcement's promo block reads the store config, so save the new promo first.
    store.promoCode = code;
    store.promoPercent = percent;
    store.promoEndsAt = endsAt ? endsAt.toISOString() : null;
    await saveStoreConfig(interaction.guildId, store);

    let pingText;
    const allowedMentions = { parse: [] };
    if (o.getBoolean('ping_everyone')) {
      pingText = '@everyone';
      allowedMentions.parse = ['everyone'];
    } else {
      const role = o.getRole('ping') || interaction.guild.roles.cache.get((await getSelfRoles(interaction.guildId)).pings?.sales);
      if (role) {
        pingText = `<@&${role.id}>`;
        allowedMentions.roles = [role.id];
      }
    }

    try {
      const { components, flags } = await buildAnnouncement({
        guild: interaction.guild,
        author: interaction.member?.displayName || interaction.user.username,
        styleKey: 'promo',
        title: o.getString('title') || `${percent}% OFF EVERYTHING`,
        body: o.getString('details') || 'Use the code at checkout. Limited time only.',
        imageUrl: image?.url,
        buttonLabel: 'Shop now',
        buttonUrl: isHttpsUrl(store.url) ? store.url : undefined,
        pingText,
        tagline: '',
        points: '',
        closing: '',
        vibe: 'hype',
      });
      const sent = await channel.send({ components, flags, allowedMentions });
      return interaction.editReply(`Sale started: ${describePromo(store)}.\nPosted in ${channel}: ${sent.url}\n/store and the bot now show this deal. Remember the discount itself must also exist in Shopify.`);
    } catch (error) {
      logger.error('Sale post failed', { error: error.message });
      return interaction.editReply(`The promo was saved, but I could not post the announcement: ${error.message}`);
    }
  },
};
