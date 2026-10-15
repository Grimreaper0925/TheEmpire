import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import {
  getSlots,
  saveSlots,
  resetChannel,
  formatInterval,
  nextResetAt,
  toUnix,
} from '../../services/chatResetService.js';

async function renderDashboard(interaction, selectedId) {
  const slots = await getSlots(interaction.guildId);
  const selected = slots.find((s) => s.channelId === selectedId) || slots[0];

  const embed = new EmbedBuilder().setTitle('Auto chat resets').setColor(0x5865f2);
  if (!slots.length) {
    embed.setDescription('No channels are set to reset automatically.\nUse `/reset-chat-setup` to add one.');
    return { embeds: [embed], components: [] };
  }

  embed.setDescription(
    slots
      .map((s) => {
        const marker = s.channelId === selected.channelId ? '▸ ' : '';
        const warn = s.lastError ? `\n  Last attempt failed: ${s.lastError}` : '';
        return `${marker}<#${s.channelId}> every **${formatInterval(s.intervalMs)}**, next reset <t:${toUnix(nextResetAt(s))}:R>${warn}`;
      })
      .join('\n')
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('cr_pick')
    .setPlaceholder('Pick a channel to manage')
    .addOptions(
      slots.map((s) => ({
        label: `#${interaction.guild.channels.cache.get(s.channelId)?.name || 'unknown'}`.slice(0, 100),
        description: `Every ${formatInterval(s.intervalMs)}`,
        value: s.channelId,
        default: s.channelId === selected.channelId,
      }))
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cr_now').setLabel('Reset now').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cr_remove').setLabel('Stop auto-reset').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cr_refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), buttons], selectedId: selected.channelId };
}

export default {
  data: new SlashCommandBuilder()
    .setName('chat-reset')
    .setDescription('See and manage channels that reset automatically')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('dashboard').setDescription('Open the auto-reset dashboard'))
    .addSubcommand((s) =>
      s
        .setName('disable')
        .setDescription('Stop automatic resets')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Only stop this channel (leave empty to stop all)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    ),
  category: 'Utility',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.editReply('You need the **Manage Server** permission to use this.');
    }

    if (interaction.options.getSubcommand() === 'disable') {
      const channel = interaction.options.getChannel('channel');
      const slots = await getSlots(interaction.guildId);
      if (channel) {
        if (!slots.some((s) => s.channelId === channel.id)) return interaction.editReply(`${channel} is not set to reset automatically.`);
        await saveSlots(interaction.guildId, slots.filter((s) => s.channelId !== channel.id));
        return interaction.editReply(`Stopped automatic resets for ${channel}.`);
      }
      await saveSlots(interaction.guildId, []);
      return interaction.editReply(slots.length ? `Stopped automatic resets for all ${slots.length} channel(s).` : 'Nothing was set up.');
    }

    let view = await renderDashboard(interaction);
    const message = await interaction.editReply({ embeds: view.embeds, components: view.components });
    if (!view.components.length) return;

    let selectedId = view.selectedId;
    const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 5 * 60 * 1000 });

    collector.on('collect', async (i) => {
      try {
        if (i.customId === 'cr_pick') selectedId = i.values[0];

        if (i.customId === 'cr_remove') {
          const slots = await getSlots(interaction.guildId);
          await saveSlots(interaction.guildId, slots.filter((s) => s.channelId !== selectedId));
          selectedId = null;
        }

        if (i.customId === 'cr_now') {
          await i.deferUpdate();
          const channel = await interaction.guild.channels.fetch(selectedId).catch(() => null);
          if (!channel) {
            await i.followUp({ content: 'That channel no longer exists.', flags: MessageFlags.Ephemeral });
          } else {
            try {
              const fresh = await resetChannel(channel, { reason: `Chat reset by ${i.user.tag}` });
              selectedId = fresh.id;
              await i.followUp({ content: `Reset done: ${fresh}`, flags: MessageFlags.Ephemeral });
            } catch (error) {
              await i.followUp({ content: `I couldn't reset it: ${error.message}`, flags: MessageFlags.Ephemeral });
            }
          }
          view = await renderDashboard(interaction, selectedId);
          selectedId = view.selectedId;
          return interaction.editReply({ embeds: view.embeds, components: view.components });
        }

        view = await renderDashboard(interaction, selectedId);
        selectedId = view.selectedId;
        await i.update({ embeds: view.embeds, components: view.components });
      } catch (error) {
        await i.followUp({ content: 'Something went wrong. Run `/chat-reset dashboard` again.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });

    collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
