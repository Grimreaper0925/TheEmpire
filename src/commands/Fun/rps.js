import { SlashCommandBuilder } from 'discord.js';
import { randomInt } from 'crypto';

const MOVES = ['rock', 'paper', 'scissors'];
const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export default {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock paper scissors against the bot')
    .addStringOption((o) =>
      o
        .setName('move')
        .setDescription('Your move')
        .setRequired(true)
        .addChoices(...MOVES.map((m) => ({ name: m, value: m })))
    ),

  async execute(interaction) {
    const mine = interaction.options.getString('move', true);
    const theirs = MOVES[randomInt(0, 3)];
    const result = mine === theirs ? "It's a tie." : BEATS[mine] === theirs ? 'You win!' : 'I win!';
    return interaction.reply(`You ${EMOJI[mine]} vs me ${EMOJI[theirs]}. ${result}`);
  },
};
