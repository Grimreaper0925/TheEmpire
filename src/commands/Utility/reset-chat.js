import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { checkResettable, resetChannel } from '../../services/chatResetService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reset-chat')
    .setDescription('Wipe a channel clean right now (it is recreated empty)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to reset (default: this one)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  category: 'Utility',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply('You need the **Manage Channels** permission to use this.');
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const problem = checkResettable(channel);
    if (problem) return interaction.editReply(problem);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('reset_go').setLabel('Reset it').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('reset_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    const prompt = await interaction.editReply({
      content:
        `Reset ${channel}? This deletes **every message** in it and recreates the channel with the same name, topic and permissions.\n` +
        'Pins, threads and webhooks in it are lost. This cannot be undone.',
      components: [row],
    });

    let choice;
    try {
      choice = await prompt.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
      });
    } catch {
      return interaction.editReply({ content: 'No answer, so nothing was reset.', components: [] }).catch(() => {});
    }

    if (choice.customId === 'reset_cancel') {
      return choice.update({ content: 'Cancelled. Nothing was reset.', components: [] });
    }

    await choice.update({ content: 'Resetting...', components: [] });
    try {
      const fresh = await resetChannel(channel, { reason: `Chat reset by ${interaction.user.tag}` });
      logger.info(`[ManualReset] #${channel.name} reset by ${interaction.user.tag}`);
      // If the reset channel is the one this command ran in, the old reply is gone; that is fine.
      await interaction.editReply({ content: `Done. ${fresh} is fresh and empty.` }).catch(() => {});
    } catch (error) {
      logger.error('Manual chat reset failed', { error: error.message });
      await interaction.editReply({ content: `I couldn't reset that channel: ${error.message}` }).catch(() => {});
    }
  },
};
