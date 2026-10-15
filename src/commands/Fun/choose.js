import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { randomInt } from 'crypto';

export default {
  data: new SlashCommandBuilder()
    .setName('choose')
    .setDescription('Let the bot pick for you')
    .addStringOption((o) =>
      o.setName('options').setDescription('Separate choices with commas: pizza, tacos, sushi').setRequired(true).setMaxLength(300)
    ),

  async execute(interaction) {
    const options = interaction.options.getString('options', true).split(',').map((s) => s.trim()).filter(Boolean);
    if (options.length < 2) {
      return interaction.reply({ content: 'Give me at least two choices, separated by commas.', flags: MessageFlags.Ephemeral });
    }
    const pick = options[randomInt(0, options.length)];
    return interaction.reply({ content: `I pick: **${pick}**`, allowedMentions: { parse: [] } });
  },
};
