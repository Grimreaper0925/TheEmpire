import { Events, PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { parsePrefixCommand } from '../utils/prefixParser.js';
import { supportsPrefixExecution, executePrefixCommand, resolvePrefixAccessKey } from '../utils/messageAdapter.js';
import { resolveCommandAlias, resolveSubcommandAlias } from '../config/commands/commandAliases.js';
import { getPrefixRestriction } from '../config/commands/prefixRestrictions.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getCommandPrefix, getBotMessage, isBotOwner, isCommandCategoryEnabled, isMaintenanceMode } from '../config/bot.js';
import { enforceAbuseProtection, formatCooldownDuration } from '../utils/abuseProtection.js';
import { createEmbed } from '../utils/embeds.js';
import { isCommandEnabled } from '../services/commandAccessService.js';

import { getVerifyConfig } from '../services/verificationService.js';
import { logModerationAction } from '../utils/moderation.js';
import { describeUser } from '../utils/modActions.js';
import { askConcierge, isAiConfigured } from '../services/aiConciergeService.js';


export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      logger.debug(`Message received from ${message.author.tag}: ${message.content}`);

      const blocked = await handleLinkGuard(message);
      if (blocked) {
        return;
      }

      const aiHandled = await handleAiConcierge(message, client);
      if (aiHandled) {
        return;
      }

      await handlePrefixCommand(message, client);
    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

const LINK_PATTERN = /(https?:\/\/|www\.|discord\.gg\/|discord(app)?\.com\/invite)/i;

// Unverified members can't post links or invites (stops most scam and ad bots).
async function handleLinkGuard(message) {
  try {
    if (!message.member || !LINK_PATTERN.test(message.content)) return false;

    const config = await getVerifyConfig(message.guild.id);
    if (!config.linkGuard || !config.roleId) return false;
    if (message.member.roles.cache.has(config.roleId)) return false;
    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

    await message.delete().catch(() => {});

    const notice = await message.channel
      .send({
        content: `${message.author}, you need to verify before you can post links. Head to the verify channel first.`,
        allowedMentions: { users: [message.author.id] },
      })
      .catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 10000);

    const minutes = config.linkGuardTimeoutMinutes ?? 0;
    if (minutes > 0 && message.member.moderatable) {
      await message.member.timeout(minutes * 60 * 1000, 'Link guard: unverified member posted a link').catch(() => {});
    }

    await logModerationAction({
      client: message.client,
      guild: message.guild,
      event: {
        action: 'Messages Purged',
        target: describeUser(message.author),
        executor: describeUser(message.client.user),
        reason: 'Link guard removed a link from an unverified member',
        duration: minutes > 0 ? `${minutes} minute timeout` : undefined,
        metadata: { userId: message.author.id, moderatorId: message.client.user.id },
      },
    });
    return true;
  } catch (error) {
    logger.error('Error in link guard:', error);
    return false;
  }
}

async function handleAiConcierge(message, client) {
  try {
    if (!isAiConfigured()) return false;

    const config = await getVerifyConfig(message.guild.id);
    const inAiChannel = Boolean(config.aiChannelId) && message.channel.id === config.aiChannelId;
    const mentionedMe = message.mentions.users.has(client.user.id) && !message.mentions.everyone;
    if (!inAiChannel && !mentionedMe) return false;

    const text = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!text) return false;

    // Let normal prefix commands through in the AI channel.
    const guildConfig = await getGuildConfig(client, message.guild.id);
    const prefix = guildConfig?.prefix || getCommandPrefix();
    if (prefix && text.startsWith(prefix)) return false;

    const allowed = await checkRateLimit(`ai_concierge:${message.author.id}`, 5, 60000);
    if (!allowed) {
      await message.reply({ content: 'Slow down a little, then ask me again.', allowedMentions: { repliedUser: false } });
      return true;
    }

    await message.channel.sendTyping().catch(() => {});

    const reply = await askConcierge({
      guildId: message.guild.id,
      channelId: message.channel.id,
      userId: message.author.id,
      username: message.member?.displayName || message.author.username,
      text,
    });

    if (!reply) {
      await message.reply({
        content: "I couldn't answer that right now. A staff member can help, or open a ticket.",
        allowedMentions: { repliedUser: false },
      });
      return true;
    }

    await message.reply({ content: reply, allowedMentions: { parse: [], repliedUser: false } });
    return true;
  } catch (error) {
    logger.error('Error in AI concierge:', error);
    return false;
  }
}

async function handlePrefixCommand(message, client) {
  try {
    const guildConfig = await getGuildConfig(client, message.guild.id);
    const prefix = guildConfig?.prefix || getCommandPrefix();
    const parsed = parsePrefixCommand(message.content, prefix);
    
    if (!parsed) {
      return; 
    }

    let { commandName, args } = parsed;
    const musicPrefixShortcut = commandName.toLowerCase();
    const MUSIC_PREFIX_SHORTCUTS = new Set(['leave', 'pause', 'resume', 'skip', 'stop', 'volume']);
    if (MUSIC_PREFIX_SHORTCUTS.has(musicPrefixShortcut)) {
      commandName = 'music';
      args = [musicPrefixShortcut, ...args];
    }

    logger.info(`Prefix command detected: ${commandName}, args: ${args.join(', ')}`);

    const resolvedCommandName = resolveCommandAlias(commandName);
    logger.info(`Resolved command name: ${resolvedCommandName}`);
    const command = client.commands.get(resolvedCommandName);

    if (!command) {
      logger.warn(`Command not found: ${resolvedCommandName}`);
      return; 
    }

    if (isMaintenanceMode() && !isBotOwner(message.author.id)) {
      await message.channel.send({
        embeds: [createEmbed({
          title: 'Maintenance Mode',
          description: getBotMessage('maintenanceMode'),
          color: 'warning',
        })],
      }).catch(() => {});
      return;
    }

    if (!isCommandCategoryEnabled(command.category)) {
      await message.channel.send({
        embeds: [createEmbed({
          title: 'Feature Disabled',
          description: getBotMessage('commandDisabled'),
          color: 'error',
        })],
      }).catch(() => {});
      return;
    }

    const restriction = getPrefixRestriction(command, args, resolveSubcommandAlias);
    if (!supportsPrefixExecution(command) || restriction.blocked) {
      if (restriction.blocked && restriction.reason) {
        const embed = createEmbed({
          title: 'Slash Command Only',
          description: `${restriction.reason}\nUse \`/${resolvedCommandName}\` instead.`,
          color: 'info',
        });
        await message.channel.send({ embeds: [embed] }).catch(() => {});
      }
      return;
    }

    if (!(await isCommandEnabled(client, message.guild.id, resolvePrefixAccessKey(command.data, args), command.category))) {
      const embed = createEmbed({
        title: 'Command Disabled',
        description: 'This command has been disabled for this server.',
        color: 'error',
      });
      await message.channel.send({ embeds: [embed] }).catch(() => {});
      return;
    }

    const mockInteractionForProtection = {
      guildId: message.guild.id,
      user: message.author,
    };
    const abuseProtection = await enforceAbuseProtection(
      mockInteractionForProtection,
      command,
      resolvedCommandName,
    );
    if (!abuseProtection.allowed) {
      const formattedCooldown = formatCooldownDuration(abuseProtection.remainingMs);
      const embed = createEmbed({
        title: 'Command Cooldown',
        description: `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,
        color: 'error',
      });
      await message.channel.send({ embeds: [embed] }).catch(() => {});
      return;
    }

    logger.info(`Executing prefix command: ${prefix}${commandName} (resolved to ${resolvedCommandName}) by ${message.author.tag}`);
    
    await executePrefixCommand(command, message, args, client, prefix, guildConfig);
  } catch (error) {
    logger.error('Error handling prefix command:', error);
  }
}
