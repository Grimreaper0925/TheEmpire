import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed } from '../../../utils/embeds.js';
import { takeStashedImage } from '../../../services/announceStash.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'announce_modal',
  async execute(interaction, client, args) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Anyone can craft a modal submit, so check the permission again here.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.editReply('You need **Manage Server** to post announcements.');
    }

    const [channelId, pingPart, imagePart] = args;
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return interaction.editReply('I can no longer find that channel.');

    const title = interaction.fields.getTextInputValue('title');
    const body = interaction.fields.getTextInputValue('body');
    const imageUrl = imagePart && imagePart !== 'none' ? takeStashedImage(imagePart) : null;

    const embed = createEmbed({ title, description: body });
    if (imageUrl) embed.setImage(imageUrl);

    let content;
    const allowedMentions = { parse: [] };
    if (pingPart === 'everyone') {
      content = '@everyone';
      allowedMentions.parse = ['everyone'];
    } else if (pingPart && pingPart !== 'none') {
      content = `<@&${pingPart}>`;
      allowedMentions.roles = [pingPart];
    }

    try {
      const sent = await channel.send({ content, embeds: [embed], allowedMentions });
      logger.info('Announcement posted', { guildId: interaction.guildId, by: interaction.user.id, channelId });
      return interaction.editReply(`Posted in ${channel}: ${sent.url}`);
    } catch (error) {
      logger.error('Announcement failed', { error: error.message });
      return interaction.editReply(`I couldn't post in ${channel}. Check my permissions there.`);
    }
  },
};
