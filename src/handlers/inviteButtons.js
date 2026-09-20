import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export async function handleInviteButton(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const configKey = `invite_config_${guildId}`;
    const userKey = `invite_user_${guildId}_${userId}`;

    let config = await getFromDb(configKey, { goal: 10, color: '#5865F2', rewardName: '3-Day Access Key' });
    let userData = await getFromDb(userKey, { uses: 0, rewardChoice: null });

    if (interaction.customId === 'invite_get_link') {
        // Generate or fetch user's unique invite link
        const invite = await interaction.guild.invites.create(interaction.channel, {
            maxUses: 0,
            unique: true
        }).catch(() => null);

        const linkEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('🔗 __Your Personal Invite Link__')
            .setDescription(
                '> Share your unique link below to invite friends and track your progress!\n\n' +
                `**Link:** ${invite ? invite.url : '`Could not generate link. Check bot permissions.`'}\n\n' +
                `*Goal:* \`${config.goal} invites\` | *Reward Choice:* \`${userData.rewardChoice || 'Not Selected Yet'}\``
            );

        // Add a dropdown menu right on the button response to let them choose their reward!
        const rewardMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('invite_choose_reward')
                .setPlaceholder('🎁 Choose your preferred reward...')
                .addOptions([
                    { label: '3-Day Access Key', value: '3_day_access_key', description: 'Select software/tool access key', emoji: '🔑' },
                    { label: '30% Off Discount Code', value: '30_percent_discount', description: 'Select store discount code', emoji: '🏷️' }
                ])
        );

        return await interaction.reply({ embeds: [linkEmbed], components: [rewardMenu], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'invite_check_progress') {
        const progressEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle('📊 __Your Invite Progress__')
            .setDescription(
                `• **Current Invites:** \`${userData.uses} / ${config.goal}\`\n` +
                `• **Selected Reward:** \`${userData.rewardChoice || 'None selected yet'}\`\n\n' +
                'Keep sharing your link to reach the goal!'
            );

        return await interaction.reply({ embeds: [progressEmbed], flags: MessageFlags.Ephemeral });
    }
}