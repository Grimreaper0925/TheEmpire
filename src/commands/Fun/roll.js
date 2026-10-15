import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { randomInt } from 'crypto';

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice, like 2d6 or d20')
    .addStringOption((o) => o.setName('dice').setDescription('Example: 2d6, d20, 4d8 (default d6)').setMaxLength(10)),

  async execute(interaction) {
    const input = (interaction.options.getString('dice') || 'd6').toLowerCase().replace(/\s/g, '');
    const match = input.match(/^(\d{0,2})d(\d{1,4})$/);
    if (!match) {
      return interaction.reply({ content: 'Use a format like `2d6` or `d20`.', flags: MessageFlags.Ephemeral });
    }

    const count = Number(match[1] || 1);
    const sides = Number(match[2]);
    if (count < 1 || count > 20 || sides < 2) {
      return interaction.reply({ content: 'Roll 1 to 20 dice with at least 2 sides each.', flags: MessageFlags.Ephemeral });
    }

    const rolls = Array.from({ length: count }, () => randomInt(1, sides + 1));
    const total = rolls.reduce((a, b) => a + b, 0);
    const detail = count > 1 ? ` (${rolls.join(' + ')})` : '';
    return interaction.reply(`🎲 ${count}d${sides}: **${total}**${detail}`);
  },
};
