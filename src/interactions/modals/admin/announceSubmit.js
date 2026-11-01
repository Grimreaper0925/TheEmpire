import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { takeAnnouncement } from '../../../services/announceStash.js';
import { scheduleAnnouncement, sendAnnouncement } from '../../../services/scheduledAnnouncements.js';
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

    const read = (id) => {
      try {
        return interaction.fields.getTextInputValue(id);
      } catch {
        return '';
      }
    };
    const stashed = stashKey ? takeAnnouncement(stashKey) : null;
    if (stashKey && !stashed) return interaction.editReply('That form expired. Run `/announce post` again.');

    const { imageUrl, sendAt, ...options } = stashed || { styleKey: 'news' };
    const author = interaction.member?.displayName || interaction.user.username;
    const fields = {
      title: interaction.fields.getTextInputValue('title'),
      body: interaction.fields.getTextInputValue('body'),
      tagline: read('tagline'),
      points: read('points'),
      closing: read('closing'),
    };

    try {
      if (sendAt) {
        const job = await scheduleAnnouncement(interaction.guildId, {
          sendAt,
          imageUrl,
          channelId,
          createdBy: interaction.user.id,
          author,
          pingPart,
          options,
          fields,
        });
        logger.info('Announcement scheduled', { guildId: interaction.guildId, by: interaction.user.id, id: job.id, sendAt });
        const ts = Math.floor(sendAt / 1000);
        return interaction.editReply(
          `Scheduled for <t:${ts}:f> (<t:${ts}:R>) in ${channel}.\nID: \`${job.id}\` • see \`/announce list\` or \`/announce cancel\`.`
        );
      }

      const sent = await sendAnnouncement(channel, { author, pingPart, options: { ...options, imageUrl }, fields, image: null });
      logger.info('Announcement posted', { guildId: interaction.guildId, by: interaction.user.id, channelId });
      return interaction.editReply(`Posted in ${channel}: ${sent.url}`);
    } catch (error) {
      logger.error('Announcement failed', { error: error.message });
      return interaction.editReply(
        sendAt ? `I couldn't schedule that: ${error.message}` : `I couldn't post in ${channel}. Check my permissions there.`
      );
    }
  },
};
