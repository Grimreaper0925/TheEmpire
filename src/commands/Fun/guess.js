import { SlashCommandBuilder, MessageFlags } from 'discord.js';

const active = new Set();

export default {
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('Guess the secret number. First one to get it wins!')
    .setDMPermission(false)
    .addIntegerOption((o) => o.setName('max').setDescription('Highest possible number (default 100)').setMinValue(10).setMaxValue(10000)),

  async execute(interaction) {
    if (active.has(interaction.channelId)) return interaction.reply({ content: 'A guessing game is already running here.', flags: MessageFlags.Ephemeral });
    active.add(interaction.channelId);

    const max = interaction.options.getInteger('max') || 100;
    const secret = 1 + Math.floor(Math.random() * max);
    const maxGuesses = 60;
    let guesses = 0;
    let low = 1;
    let high = max;

    await interaction.reply(`🔢 I am thinking of a number from **1 to ${max}**. Type your guesses in this channel. You have 2 minutes!`);

    const collector = interaction.channel.createMessageCollector({
      filter: (m) => !m.author.bot && /^\d{1,5}$/.test(m.content.trim()),
      time: 120000,
    });

    collector.on('collect', async (message) => {
      const n = Number(message.content.trim());
      guesses += 1;
      if (n === secret) {
        await message.reply({ content: `🎉 **${message.author.username} got it!** The number was **${secret}**, found in ${guesses} guesses.`, allowedMentions: { repliedUser: false } });
        return collector.stop('won');
      }
      if (n < secret) low = Math.max(low, n + 1);
      else high = Math.min(high, n - 1);
      await message.react(n < secret ? '⬆️' : '⬇️').catch(() => {});
      if (guesses % 8 === 0) await interaction.channel.send(`Hint: it is between **${low}** and **${high}**.`);
      if (guesses >= maxGuesses) collector.stop('limit');
    });

    collector.on('end', async (collected, reason) => {
      active.delete(interaction.channelId);
      if (reason !== 'won') await interaction.channel.send(`⏰ Game over! The number was **${secret}**.`).catch(() => {});
    });
  },
};
