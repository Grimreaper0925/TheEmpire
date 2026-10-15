import { SlashCommandBuilder } from 'discord.js';
import { randomInt } from 'crypto';

export default {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
  async execute(interaction) {
    return interaction.reply(randomInt(0, 2) === 0 ? '🪙 Heads!' : '🪙 Tails!');
  },
};
