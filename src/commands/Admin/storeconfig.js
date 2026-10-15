import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { getStoreConfig, saveStoreConfig, describePromo, endOfPacificDay } from '../../services/storeService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('storeconfig')
    .setDescription('Change the store link and promo code that /store uses')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) => o.setName('url').setDescription('Store link (https://...)').setMaxLength(200))
    .addStringOption((o) => o.setName('code').setDescription('Promo code, or "none" to clear it').setMaxLength(40))
    .addIntegerOption((o) => o.setName('percent').setDescription('Percent off').setMinValue(1).setMaxValue(100))
    .addStringOption((o) =>
      o.setName('ends').setDescription('End date like 2026-12-31, or "never"').setMaxLength(30)
    )
    .addChannelOption((o) => o.setName('vouch_channel').setDescription('Where /vouch posts go').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('sales_channel').setDescription('Default channel for /sale posts').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addChannelOption((o) => o.setName('restock_channel').setDescription('Default channel for /restock posts').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getStoreConfig(interaction.guildId);
    const url = interaction.options.getString('url');
    const code = interaction.options.getString('code');
    const percent = interaction.options.getInteger('percent');
    const ends = interaction.options.getString('ends');

    if (url) {
      if (!/^https:\/\/[^\s]+$/i.test(url)) return interaction.editReply('The link must start with https://');
      config.url = url;
    }
    if (code) config.promoCode = code.toLowerCase() === 'none' ? null : code.trim().toUpperCase();
    if (percent) config.promoPercent = percent;
    if (ends) {
      if (ends.toLowerCase() === 'never') {
        config.promoEndsAt = null;
      } else {
        const match = ends.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return interaction.editReply('Use the date format YYYY-MM-DD, like 2026-12-31, or "never".');
        const [, y, m, d] = match.map(Number);
        const date = endOfPacificDay(y, m, d);
        if (!date) return interaction.editReply('That date is not valid.');
        config.promoEndsAt = date.toISOString();
      }
    }

    const vouch = interaction.options.getChannel('vouch_channel');
    const sales = interaction.options.getChannel('sales_channel');
    const restock = interaction.options.getChannel('restock_channel');
    if (vouch) config.vouchChannelId = vouch.id;
    if (sales) config.salesChannelId = sales.id;
    if (restock) config.restockChannelId = restock.id;

    await saveStoreConfig(interaction.guildId, config);

    const promo = describePromo(config);
    return interaction.editReply(
      `Saved. Store: ${config.url}\n${promo ? `Promo: ${promo}.` : 'No active promo right now.'}\n` +
        'Note: this only changes what the bot says. The discount itself lives in Shopify.'
    );
  },
};
