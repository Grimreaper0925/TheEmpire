import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { takeAnnouncement } from '../../../services/announceStash.js';
import { buildAnnouncement } from '../../../services/announcementBuilder.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'announce_modal',
  async execute(interaction, client, args) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Anyone can craft a modal submit, so check the permission again here.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.editReply('You need **Manage Server** to post announcements.');
    }

    const [channelId, pingPart, stashKey] = args;
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return interaction.editReply('I can no longer find that channel.');

    const title = interaction.fields.getTextInputValue('title');
    const body = interaction.fields.getTextInputValue('body');
    const options = (stashKey && takeAnnouncement(stashKey)) || { styleKey: 'news' };

    let pingText;
    const allowedMentions = { parse: [] };
    if (pingPart === 'everyone') {
      pingText = '@everyone';
      allowedMentions.parse = ['everyone'];
    } else if (pingPart && pingPart !== 'none') {
      pingText = `<@&${pingPart}>`;
      allowedMentions.roles = [pingPart];
    }

    try {
      const { components, flags } = await buildAnnouncement({
        guild: interaction.guild,
        author: interaction.member?.displayName || interaction.user.username,
        styleKey: options.styleKey,
        title,
        body,
        imageUrl: options.imageUrl,
        buttonLabel: options.buttonLabel,
        buttonUrl: options.buttonUrl,
        color: options.color ?? undefined,
        pingText,
      });


      const sent = await channel.send({ components, flags, allowedMentions });
      logger.info('Announcement posted', { guildId: interaction.guildId, by: interaction.user.id, channelId });
      return interaction.editReply(`Posted in ${channel}: ${sent.url}`);
    } catch (error) {
      logger.error('Announcement failed', { error: error.message });
      return interaction.editReply(`I couldn't post in ${channel}. Check my permissions there.`);
    }
  },
};
