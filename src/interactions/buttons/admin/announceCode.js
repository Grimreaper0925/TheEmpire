import { MessageFlags } from 'discord.js';

export default {
  name: 'announce_code',
  async execute(interaction, client, args) {
    const code = String(args?.[0] || '');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) {
      return interaction.reply({ content: 'That code is no longer available.', flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
      content: `Your code:\n\`\`\`${code}\`\`\`Paste it in the **discount code** box at checkout.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
