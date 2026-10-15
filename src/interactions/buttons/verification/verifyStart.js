import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { getVerifyConfig, createChallenge } from '../../../services/verificationService.js';

export default {
  name: 'verify_btn',
  async execute(interaction) {
    const config = await getVerifyConfig(interaction.guildId);

    if (!config.roleId) {
      return interaction.reply({
        content: 'Verification is not set up yet. Please tell an admin.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.member.roles.cache.has(config.roleId)) {
      return interaction.reply({ content: 'You are already verified.', flags: MessageFlags.Ephemeral });
    }

    const challenge = createChallenge(interaction.guildId, interaction.user.id);
    if (challenge.locked) {
      return interaction.reply({
        content: 'Too many wrong answers. Please wait a few minutes and try again.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder().setCustomId('verify_modal:answer').setTitle('Verify you are human');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answer')
          .setLabel(challenge.question)
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(4)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  },
};
