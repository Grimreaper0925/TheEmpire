import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { testAi } from '../../services/aiConciergeService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aistatus')
    .setDescription('Check which AI the helper is using and test it')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await testAi();
    const names = { gemini: 'Gemini (free)', anthropic: 'Claude (paid)', faq: 'Scripted replies only' };
    return interaction.editReply(
      `Engine: **${names[result.provider]}**\nStatus: ${result.ok ? 'working' : 'not working'}\n${result.detail}`
    );
  },
};
