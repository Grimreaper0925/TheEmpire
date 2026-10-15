import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import {
  getSlots,
  saveSlots,
  checkResettable,
  formatInterval,
  nextResetAt,
  toUnix,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
  MAX_SLOTS,
} from '../../services/chatResetService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reset-chat-setup')
    .setDescription('Make a channel wipe itself on a timer')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to reset automatically')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addIntegerOption((o) => o.setName('days').setDescription('Days between resets').setMinValue(1).setMaxValue(30))
    .addIntegerOption((o) => o.setName('hours').setDescription('Hours between resets').setMinValue(1).setMaxValue(720))
    .addIntegerOption((o) => o.setName('minutes').setDescription('Minutes between resets (5 or more)').setMinValue(1).setMaxValue(1000)),
  category: 'Utility',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply('You need the **Manage Channels** permission to use this.');
    }

    const channel = interaction.options.getChannel('channel', true);
    const days = interaction.options.getInteger('days') || 0;
    const hours = interaction.options.getInteger('hours') || 0;
    const minutes = interaction.options.getInteger('minutes') || 0;
    const intervalMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;

    if (!intervalMs) return interaction.editReply('Pick how often to reset with `days`, `hours` or `minutes`. For example `hours: 24`.');
    if (intervalMs < MIN_INTERVAL_MS) return interaction.editReply('The shortest allowed time is 5 minutes.');
    if (intervalMs > MAX_INTERVAL_MS) return interaction.editReply('The longest allowed time is 30 days.');

    const problem = checkResettable(channel);
    if (problem) return interaction.editReply(problem);

    const slots = await getSlots(interaction.guildId);
    const existing = slots.find((s) => s.channelId === channel.id);
    if (!existing && slots.length >= MAX_SLOTS) {
      return interaction.editReply(`You can have up to ${MAX_SLOTS} auto-reset channels. Remove one with \`/chat-reset disable\` first.`);
    }

    const slot = { channelId: channel.id, intervalMs, lastReset: new Date().toISOString() };
    await saveSlots(interaction.guildId, existing ? slots.map((s) => (s.channelId === channel.id ? slot : s)) : [...slots, slot]);

    return interaction.editReply(
      `${existing ? 'Updated' : 'Done'}: ${channel} will reset every **${formatInterval(intervalMs)}**.\n` +
        `First reset <t:${toUnix(nextResetAt(slot))}:R>. Each reset deletes all messages and recreates the channel.\n` +
        'See and manage everything with `/chat-reset dashboard`.'
    );
  },
};
