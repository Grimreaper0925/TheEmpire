import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getVerifyConfig } from '../services/verificationService.js';

async function sendWelcomeGreeting(member) {
    try {
        const verifyConfig = await getVerifyConfig(member.guild.id);
        if (!verifyConfig.welcomeChannelId) return;

        const channel = member.guild.channels.cache.get(verifyConfig.welcomeChannelId);
        if (!channel?.isTextBased()) return;

        const verifyHint = verifyConfig.verifyChannelId
            ? ` Head to <#${verifyConfig.verifyChannelId}> and press **Verify** to unlock the server.`
            : '';
        await channel.send({
            content: `Welcome to ${member.guild.name}, ${member}!${verifyHint}`,
            allowedMentions: { users: [member.id] },
        });
    } catch (error) {
        logger.warn('Could not send welcome greeting', { error: error.message });
    }
}

export default {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        // 1. Block bots immediately
        if (member.user.bot) return;

        // Greet the new member and point them to verification.
        await sendWelcomeGreeting(member);

    }
};
