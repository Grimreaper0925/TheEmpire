import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { HANGMAN_WORDS } from '../../data/funData.js';

const active = new Set();
const STAGES = [
  '```\n +---+\n |   |\n     |\n     |\n     |\n=======```',
  '```\n +---+\n |   |\n O   |\n     |\n     |\n=======```',
  '```\n +---+\n |   |\n O   |\n |   |\n     |\n=======```',
  '```\n +---+\n |   |\n O   |\n/|   |\n     |\n=======```',
  '```\n +---+\n |   |\n O   |\n/|\\  |\n     |\n=======```',
  '```\n +---+\n |   |\n O   |\n/|\\  |\n/    |\n=======```',
  '```\n +---+\n |   |\n O   |\n/|\\  |\n/ \\  |\n=======```',
];

export default {
  data: new SlashCommandBuilder().setName('hangman').setDescription('Team hangman: everyone guesses letters or the whole word').setDMPermission(false),

  async execute(interaction) {
    if (active.has(interaction.channelId)) return interaction.reply({ content: 'A hangman game is already running here.', flags: MessageFlags.Ephemeral });
    active.add(interaction.channelId);

    const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
    const guessed = new Set();
    const wrong = [];
    const contributors = new Map();

    const view = () => {
      const shown = [...word].map((l) => (guessed.has(l) ? l : '_')).join(' ');
      return `${STAGES[wrong.length]}\n**${shown}**\nWrong letters: ${wrong.length ? wrong.join(' ') : 'none'} · Lives left: ${6 - wrong.length}`;
    };

    await interaction.reply(`🪢 **Hangman!** Type a single letter or the full word in this channel. You have 3 minutes.\n${view()}`);
    const board = await interaction.fetchReply();

    const collector = interaction.channel.createMessageCollector({
      filter: (m) => !m.author.bot && /^[a-zA-Z]{1,20}$/.test(m.content.trim()),
      time: 180000,
    });

    collector.on('collect', async (message) => {
      const text = message.content.trim().toUpperCase();
      await message.delete().catch(() => {});

      if (text.length > 1) {
        if (text === word) {
          [...word].forEach((l) => guessed.add(l));
          contributors.set(message.author.id, (contributors.get(message.author.id) || 0) + 3);
          return collector.stop('won');
        }
        if (text.length === word.length) wrong.push(text.slice(0, 1) + '…');
        else return;
      } else {
        if (guessed.has(text) || wrong.includes(text)) return;
        if (word.includes(text)) {
          guessed.add(text);
          contributors.set(message.author.id, (contributors.get(message.author.id) || 0) + [...word].filter((l) => l === text).length);
        } else {
          wrong.push(text);
        }
      }

      if ([...word].every((l) => guessed.has(l))) return collector.stop('won');
      if (wrong.length >= 6) return collector.stop('lost');
      await board.edit(`🪢 **Hangman**\n${view()}`).catch(() => {});
    });

    collector.on('end', async (collected, reason) => {
      active.delete(interaction.channelId);
      const mvp = [...contributors.entries()].sort((a, b) => b[1] - a[1])[0];
      const mvpLine = mvp ? `\nMVP: <@${mvp[0]}>` : '';
      let ending;
      if (reason === 'won') ending = `🎉 **You got it!** The word was **${word}**.${mvpLine}`;
      else if (reason === 'lost') ending = `💀 **Out of lives!** The word was **${word}**.`;
      else ending = `⏰ Time is up! The word was **${word}**.`;
      await board.edit(`🪢 **Hangman**\n${STAGES[Math.min(wrong.length, 6)]}\n${ending}`).catch(() => {});
      await interaction.channel.send({ content: ending, allowedMentions: { parse: [] } }).catch(() => {});
    });
  },
};
