import { MessageFlags } from 'discord.js';
import {
  getVerifyConfig,
  checkChallenge,
  grantVerifiedRole,
} from '../../../services/verificationService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'verify_modal',
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getVerifyConfig(interaction.guildId);
    if (!config.roleId) {
      return interaction.editReply('Verification is not set up yet. Please tell an admin.');
    }

    const answer = interaction.fields.getTextInputValue('answer');
    const result = checkChallenge(interaction.guildId, interaction.user.id, answer);

    if (!result.ok) {
      if (result.reason === 'locked') {
        return interaction.editReply('Too many wrong answers. Please wait a few minutes and try again.');
      }
      if (result.reason === 'expired') {
        return interaction.editReply('That question timed out. Press **Verify** again for a new one.');
      }
      return interaction.editReply(
        `That's not right. You have ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left. Press **Verify** again.`
      );
    }

    try {
      const { alreadyVerified } = await grantVerifiedRole(interaction.member, config);
      if (alreadyVerified) {
        return interaction.editReply('You are already verified.');
      }
      logger.info('Member verified', { guildId: interaction.guildId, userId: interaction.user.id });
      return interaction.editReply('You are verified. Welcome in!');
    } catch (error) {
      logger.error('Failed to grant verified role', { error: error.message });
      return interaction.editReply(
        'You passed, but I could not give you the role. Please tell an admin to check my permissions.'
      );
    }
  },
};
