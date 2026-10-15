import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getStoreConfig, saveStoreConfig, describePromo } from '../../services/storeService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('storeconfig')
    .setDescription('Change the store link and promo code that /store and the AI helper use')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) => o.setName('url').setDescription('Store link (https://...)').setMaxLength(200))
    .addStringOption((o) => o.setName('code').setDescription('Promo code, or "none" to clear it').setMaxLength(40))
    .addIntegerOption((o) => o.setName('percent').setDescription('Percent off').setMinValue(1).setMaxValue(100))
    .addStringOption((o) =>
      o.setName('ends').setDescription('End date like 2026-12-31, or "never"').setMaxLength(30)
    ),

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

    await saveStoreConfig(interaction.guildId, config);

    const promo = describePromo(config);
    return interaction.editReply(
      `Saved. Store: ${config.url}\n${promo ? `Promo: ${promo}.` : 'No active promo right now.'}\n` +
        'Note: this only changes what the bot says. The discount itself lives in Shopify.'
    );
  },
};

// 23:59:59 on the given calendar day in US Pacific time, as a Date (handles daylight saving).
function endOfPacificDay(y, m, d) {
  const base = Date.UTC(y, m - 1, d, 23, 59, 59);
  if (new Date(base).getUTCMonth() !== m - 1) return null;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(base + offsetHours * 3600 * 1000);
    const parts = Object.fromEntries(fmt.formatToParts(candidate).map((p) => [p.type, p.value]));
    if (Number(parts.day) === d && Number(parts.month) === m && Number(parts.hour) % 24 === 23 && parts.minute === '59') {
      return candidate;
    }
  }
  return null;
}
