import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { peekAnnouncement, dropAnnouncement } from '../../../services/announceStash.js';
import { statusMessage } from '../../../services/announceDraft.js';
import { addScheduled, downloadImage, postAnnouncement, MAX_SCHEDULED, getScheduled } from '../../../services/announceSchedule.js';
import { DEFAULT_TZ, tzLabel, describeRepeat } from '../../../services/announceTime.js';
import { logger } from '../../../utils/logger.js';

const EXPIRED = '⌛ This draft expired (they last 30 minutes, and are lost if the bot restarts). Run `/announce` again.';

function guard(interaction, key) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    interaction.reply({ content: 'You need **Manage Server** to post announcements.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return null;
  }
  return peekAnnouncement(key);
}

const announceGo = {
  name: 'announce_go',
  async execute(interaction, client, args) {
    const key = args[0];
    const draft = guard(interaction, key);
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return;
    if (!draft) return interaction.update(statusMessage(EXPIRED));

    await interaction.deferUpdate();

    if (draft.runAt) {
      if (draft.runAt <= Date.now() + 15000) {
        return interaction.followUp({ content: 'That time has already passed. Press **Change time** and pick a new one.', flags: MessageFlags.Ephemeral });
      }
      if ((await getScheduled(interaction.guildId)).length >= MAX_SCHEDULED) {
        return interaction.followUp({ content: `You already have ${MAX_SCHEDULED} scheduled announcements. Cancel one with \`/announce-schedule cancel\` first.`, flags: MessageFlags.Ephemeral });
      }

      let image = null;
      if (draft.options.imageUrl) {
        try {
          image = await downloadImage(draft.options.imageUrl);
        } catch (error) {
          return interaction.followUp({ content: error.message, flags: MessageFlags.Ephemeral });
        }
      }

      try {
        const saved = await addScheduled(
          interaction.guildId,
          {
            channelId: draft.channelId,
            pingPart: draft.pingPart,
            options: { ...draft.options, imageUrl: null },
            fields: draft.fields,
            authorId: draft.authorId,
            authorName: draft.authorName,
            runAt: draft.runAt,
            repeat: draft.repeat,
          },
          image
        );
        dropAnnouncement(key);
        logger.info('Announcement scheduled', { guildId: interaction.guildId, by: interaction.user.id, id: saved.id });
        return interaction.editReply(
          statusMessage(
            `✅ **Scheduled** for <t:${Math.floor(draft.runAt / 1000)}:F> (<t:${Math.floor(draft.runAt / 1000)}:R>) in <#${draft.channelId}>, ${describeRepeat(draft.repeat)}.\n` +
              `ID: \`${saved.id}\`. See or cancel it with \`/announce-schedule\`.`
          )
        );
      } catch (error) {
        return interaction.followUp({ content: error.message, flags: MessageFlags.Ephemeral });
      }
    }

    try {
      const sent = await postAnnouncement(client, interaction.guildId, draft);
      dropAnnouncement(key);
      logger.info('Announcement posted', { guildId: interaction.guildId, by: interaction.user.id, channelId: draft.channelId });
      return interaction.editReply(statusMessage(`✅ Posted in <#${draft.channelId}>: ${sent.url}`));
    } catch (error) {
      logger.error('Announcement failed', { error: error.message });
      return interaction.followUp({ content: `I couldn't post it: ${error.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};

const announceWhen = {
  name: 'announce_when',
  async execute(interaction, client, args) {
    const key = args[0];
    const draft = guard(interaction, key);
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return;
    if (!draft) return interaction.update(statusMessage(EXPIRED));

    const when = new TextInputBuilder()
      .setCustomId('when')
      .setLabel(`When to post? (${tzLabel(DEFAULT_TZ)})`.slice(0, 45))
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(40)
      .setPlaceholder('tomorrow 6pm  |  in 2h  |  2026-11-05 18:00');
    if (draft.whenText) when.setValue(draft.whenText.slice(0, 40));

    const repeat = new TextInputBuilder()
      .setCustomId('repeat')
      .setLabel('Repeat? none, daily or weekly')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(10)
      .setPlaceholder('none');
    if (draft.repeat && draft.repeat !== 'none') repeat.setValue(draft.repeat);

    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(`announce_when_modal:${key}`)
        .setTitle('Schedule this announcement')
        .addComponents(new ActionRowBuilder().addComponents(when), new ActionRowBuilder().addComponents(repeat))
    );
  },
};

const announceCancel = {
  name: 'announce_cancel',
  async execute(interaction, client, args) {
    dropAnnouncement(args[0]);
    return interaction.update(statusMessage('🗑️ Cancelled. Nothing was posted.'));
  },
};

export default [announceGo, announceWhen, announceCancel];
