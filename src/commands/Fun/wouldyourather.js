import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags } from 'discord.js';
import { WOULD_YOU_RATHER } from '../../data/funData.js';

export default {
  data: new SlashCommandBuilder()
    .setName('wouldyourather')
    .setDescription('Would you rather? Everyone votes and you see the split live')
    .setDMPermission(false)
    .addStringOption((o) => o.setName('a').setDescription('Your own option A (leave empty for a random question)').setMaxLength(100))
    .addStringOption((o) => o.setName('b').setDescription('Your own option B').setMaxLength(100)),

  async execute(interaction) {
    const customA = interaction.options.getString('a');
    const customB = interaction.options.getString('b');
    if (Boolean(customA) !== Boolean(customB)) return interaction.reply({ content: 'Give both options, or neither for a random question.', flags: MessageFlags.Ephemeral });

    const [a, b] = customA ? [customA, customB] : WOULD_YOU_RATHER[Math.floor(Math.random() * WOULD_YOU_RATHER.length)];
    const votes = new Map(); // user -> 'a' | 'b'
    const endsAt = Date.now() + 60000;

    const render = (final) => {
      const ca = [...votes.values()].filter((v) => v === 'a').length;
      const cb = votes.size - ca;
      const pct = (n) => (votes.size ? Math.round((n / votes.size) * 100) : 0);
      const bar = (n) => '█'.repeat(Math.round(pct(n) / 10)).padEnd(10, '░');
      return new EmbedBuilder()
        .setTitle('🤔 Would you rather...')
        .setDescription(`🅰️ **${a}**\n${bar(ca)} ${pct(ca)}% (${ca})\n\n🅱️ **${b}**\n${bar(cb)} ${pct(cb)}% (${cb})\n\n${final ? `Voting closed with ${votes.size} votes.` : `Vote with the buttons. Closes <t:${Math.floor(endsAt / 1000)}:R>.`}`)
        .setColor(final ? 0x747f8d : 0x5865f2);
    };
    const row = (disabled) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wyr_a').setLabel('Option A').setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId('wyr_b').setLabel('Option B').setStyle(ButtonStyle.Danger).setDisabled(disabled)
      );

    const message = await interaction.reply({ embeds: [render(false)], components: [row(false)], fetchReply: true });
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    collector.on('collect', async (btn) => {
      votes.set(btn.user.id, btn.customId === 'wyr_a' ? 'a' : 'b');
      await btn.update({ embeds: [render(false)] });
    });
    collector.on('end', () => message.edit({ embeds: [render(true)], components: [row(true)] }).catch(() => {}));
  },
};
