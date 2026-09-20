import { Events } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { processInviteJoin } from './guildMemberAdd.js';

export default {
  name: Events.GuildMemberUpdate,
  once: false,

  async execute(oldMember, newMember, client) {
    try {
      if (!newMember.guild) return;

      // Membership Screening: the member just accepted the rules. guildMemberAdd
      // saw them as `pending` and skipped invite-reward tracking entirely, so this
      // transition is the only chance to credit their invite.
      if (oldMember.pending === true && newMember.pending === false && !newMember.user.bot) {
        await processInviteJoin(newMember, client);
      }

      if (oldMember.nickname !== newMember.nickname) {
        await logEvent({
          client: newMember.client,
          guildId: newMember.guild.id,
          eventType: EVENT_TYPES.MEMBER_NAME_CHANGE,
          data: {
            title: 'Nickname changed',
            lines: [
              `**User:** ${newMember.user.toString()} (${newMember.user.tag})`,
              `**ID:** \`${newMember.user.id}\``,
              `**Before:** ${oldMember.nickname || '*(no nickname)*'}`,
              `**After:** ${newMember.nickname || '*(no nickname)*'}`,
            ],
            thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
            userId: newMember.user.id,
          }
        });

        return;
      }

    } catch (error) {
      logger.error('Error in guildMemberUpdate event:', error);
    }
  }
};