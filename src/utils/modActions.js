import { PermissionFlagsBits } from 'discord.js';
import { logModerationAction } from './moderation.js';

export function describeUser(user) {
  return `${user.tag ?? user.username} (${user.id})`;
}

/**
 * Checks the person running a moderation command and the bot can both act on
 * the target. Returns an error string, or null when the action is allowed.
 */
export function checkCanModerate(interaction, targetMember, { needsBotPermission } = {}) {
  const guild = interaction.guild;
  const me = guild.members.me;

  if (!targetMember) return 'That person is not in this server.';
  if (targetMember.id === interaction.user.id) return "You can't do that to yourself.";
  if (targetMember.id === me.id) return "I can't do that to myself.";
  if (targetMember.id === guild.ownerId) return "You can't do that to the server owner.";

  if (needsBotPermission && !me.permissions.has(needsBotPermission)) {
    const name = Object.entries(PermissionFlagsBits).find(([, v]) => v === needsBotPermission)?.[0] ?? 'the needed';
    return `I'm missing the **${name}** permission.`;
  }

  const actorIsOwner = interaction.user.id === guild.ownerId;
  if (!actorIsOwner && targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
    return "That person's top role is equal to or higher than yours.";
  }
  if (targetMember.roles.highest.position >= me.roles.highest.position) {
    return "That person's top role is equal to or higher than mine. Move my role up in Server Settings.";
  }

  return null;
}

export async function recordModAction({ interaction, action, targetUser, reason, duration, extra = {} }) {
  return logModerationAction({
    client: interaction.client,
    guild: interaction.guild,
    event: {
      action,
      target: describeUser(targetUser),
      executor: describeUser(interaction.user),
      reason: reason || 'No reason given',
      duration,
      metadata: { userId: targetUser.id, moderatorId: interaction.user.id, ...extra },
    },
  });
}
