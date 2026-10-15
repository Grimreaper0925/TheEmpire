import { SlashCommandBuilder } from 'discord.js';

const ANSWERS = [
  'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'You can count on it.', 'Most likely.',
  'Signs point to yes.', 'Ask again later.', 'I can\'t tell you right now.', 'Better not tell you now.',
  'Don\'t count on it.', 'My sources say no.', 'Very doubtful.', 'Absolutely not.',
];

export default {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a yes or no question')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(200)),

  async execute(interaction) {
    const question = interaction.options.getString('question', true);
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    return interaction.reply({ content: `**${question}**\n🎱 ${answer}`, allowedMentions: { parse: [] } });
  },
};
