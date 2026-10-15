import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getStoreConfig, describePromo, promoIsActive } from '../../services/storeService.js';

export default {
  data: new SlashCommandBuilder().setName('store').setDescription('Visit the store and see the current deal'),

  async execute(interaction) {
    await interaction.deferReply();

    const config = await getStoreConfig(interaction.guildId);
    const promo = describePromo(config);

    const embed = createEmbed({
      title: config.tagline,
      description: promo
        ? `Current deal: **${config.promoCode}** takes **${config.promoPercent}% off**${
            config.promoEndsAt ? ` until <t:${Math.floor(new Date(config.promoEndsAt).getTime() / 1000)}:f>` : ''
          }.\nEnter the code at checkout.`
        : 'Check out what we have in the store.',
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Open the store').setStyle(ButtonStyle.Link).setURL(config.url)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};
