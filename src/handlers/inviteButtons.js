import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { getFromDb } from '../utils/database.js';

export async function handleInviteButton(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const configKey = `invite_config_${guildId}`;
    const userKey = `invite_user_${guildId}_${userId}`;

    let config = await getFromDb(configKey, { goal: 10, color: '#5865F2', rewardName: '3-Day Access Key' });
    let userData = await getFromDb(userKey, { uses: 0, rewardChoice: null });

    if (interaction.customId === 'invite_get_link') {
        const invite = await interaction.guild.invites.create(interaction.channel, {
            maxUses: 0,
            unique: true
        }).catch(() => null);

        const linkEmbed = new EmbedBuilder()
            .setColor(config.color || 0x5865F2)
            .setTitle('🔗 __Your Personal Invite Link__')
            .setDescription(
                '> Share your unique link below to invite friends and earn rewards!\n\n' +
                `**Link:** ${invite ? invite.url : '`Could not generate invite link. Check bot permissions.`'}\n\n' +
                `• **Target Goal:** \`${config.goal} invites\`\n` +
                `• **Current Reward Choice:** \`${userData.rewardChoice || 'Not Selected Yet'}\``
            )
            .setTimestamp();

        const rewardMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('invite_choose_reward')
                .setPlaceholder('🎁 Select your preferred reward...')
                .addOptions([
                    { label: '3-Day Access Key', value: '3_day_access_key', description: 'Select software/tool access key', emoji: '🔑' },
                    { label: '30% Off Discount Code', value: '30_percent_discount', description: 'Select store discount code', emoji: '🏷️' }
                ])
        );

        return await interaction.reply({ embeds: [linkEmbed], components: [rewardMenu], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'invite_check_progress') {
        const progressEmbed = new EmbedBuilder()
            .setColor(config.color || 0x5865F2)
            .setTitle('📊 __Your Invite Progress__')
            .setDescription(
                `• **Invites Completed:** \`${userData.uses} / ${config.goal}\`\n` +
                `• **Chosen Reward:** \`${userData.rewardChoice || 'None selected yet'}\`\n\n' +
                'Keep sharing your link to reach the goal!'
            )
            .setTimestamp();

        return await interaction.reply({ embeds: [progressEmbed], flags: MessageFlags.Ephemeral });
    }
}