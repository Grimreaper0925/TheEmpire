import { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder } from 'discord.js';
import { getStoreConfig } from '../../services/storeService.js';
import { addVouch, average, getVouchData, starString } from '../../services/vouchService.js';

const COOLDOWN_MS = 60 * 60 * 1000;

export default {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Leave a vouch for the store or a trade')
    .setDMPermission(false)
    .addIntegerOption((o) => o.setName('rating').setDescription('1 to 5 stars').setRequired(true).setMinValue(1).setMaxValue(5))
    .addStringOption((o) => o.setName('message').setDescription('How was it?').setRequired(true).setMinLength(5).setMaxLength(300))
    .addStringOption((o) => o.setName('product').setDescription('What did you get?').setMaxLength(80))
    .addAttachmentOption((o) => o.setName('proof').setDescription('Screenshot (optional)')),
  category: 'Store',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const store = await getStoreConfig(interaction.guildId);
    let channel = store.vouchChannelId ? await interaction.guild.channels.fetch(store.vouchChannelId).catch(() => null) : null;
    channel ||= interaction.guild.channels.cache.find((c) => c.isTextBased() && !c.isThread() && /vouch/i.test(c.name));
    if (!channel) return interaction.editReply('No vouch channel is set up yet. An admin can set one with `/storeconfig vouch_channel`.');

    const before = await getVouchData(interaction.guildId);
    const wait = (before.lastByUser[interaction.user.id] || 0) + COOLDOWN_MS - Date.now();
    if (wait > 0) return interaction.editReply(`You can leave another vouch in ${Math.ceil(wait / 60000)} minutes.`);

    const proof = interaction.options.getAttachment('proof');
    if (proof && !proof.contentType?.startsWith('image/')) return interaction.editReply('The proof must be an image.');

    const stars = interaction.options.getInteger('rating', true);
    const message = interaction.options.getString('message', true);
    const product = interaction.options.getString('product');
    const data = await addVouch(interaction.guildId, { userId: interaction.user.id, stars, message, product });

    const container = new ContainerBuilder()
      .setAccentColor(stars >= 4 ? 0x2ecc71 : stars === 3 ? 0xf1c40f : 0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${starString(stars)}  Vouch #${data.count}`))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${message.replace(/\n/g, '\n> ')}`))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**From** <@${interaction.user.id}>${product ? `\n**Product** ${product}` : ''}`));
    if (proof) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(proof.url)));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Store average: ${average(data).toFixed(2)} / 5 from ${data.count} vouches`));

    try {
      await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    } catch {
      return interaction.editReply('I could not post in the vouch channel. Ask an admin to check my permissions there.');
    }
    return interaction.editReply(`Thanks! Your vouch was posted in ${channel}.`);
  },
};
