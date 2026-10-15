import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { parseLayout } from '../../../services/layoutParser.js';
import { runBuildFlow } from '../../../services/aisetupFlow.js';

export default {
  name: 'aisetup_custom',
  async execute(interaction, client, args) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.editReply('Only server **Administrators** can do that.');

    const { template, errors } = parseLayout(interaction.fields.getTextInputValue('layout'));
    if (errors.length) return interaction.editReply(`I could not use that layout:\n${errors.map((e) => `- ${e}`).join('\n')}`);
    return runBuildFlow(interaction, template, args[0] === 'clean' ? 'clean' : 'emoji');
  },
};
