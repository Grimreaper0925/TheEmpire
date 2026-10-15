import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { askConcierge, isAiConfigured } from '../../services/aiConciergeService.js';
import { checkRateLimit } from '../../utils/rateLimiter.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the AI helper a question')
    .setDMPermission(false)
    .addStringOption((o) => o.setName('question').setDescription('What do you want to know?').setRequired(true).setMaxLength(500)),

  async execute(interaction) {
    if (!isAiConfigured()) {
      return interaction.reply({ content: 'The AI helper is not turned on yet.', flags: MessageFlags.Ephemeral });
    }

    if (!(await checkRateLimit(`ai_concierge:${interaction.user.id}`, 5, 60000))) {
      return interaction.reply({ content: 'Slow down a little, then ask me again.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    const question = interaction.options.getString('question', true);

    const reply = await askConcierge({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      username: interaction.member?.displayName || interaction.user.username,
      text: question,
    });

    return interaction.editReply({
      content: reply || "I couldn't answer that right now. A staff member can help, or open a ticket.",
      allowedMentions: { parse: [] },
    });
  },
};
