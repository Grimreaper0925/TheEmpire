import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../../../utils/database.js';

export async function handleInviteButton(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const configKey = `invite_config_${guildId}`;
    const userKey = `invite_user_${guildId}_${userId}`;

    let config = await getFromDb(configKey, {
        goal: 10,
        color: '#5865F2',
        rewardName: '3-Day Access Key'
    });

    let userData = await getFromDb(userKey, {
        uses: 0,
        inviteCode: ''
    });

    const customId = interaction.customId;

    if (customId === 'invite_get_link' || customId.startsWith('invite_get_link')) {
        try {
            let invite = await interaction.guild.invites.create(interaction.channel, {
                maxAge: 0,
                maxUses: 0,
                reason: `Personal invite tracking link for ${interaction.user.tag}`
            }).catch(() => null);

            let inviteUrl = invite ? invite.url : `https://discord.gg/${interaction.guild.vanityCode || 'server'}`;
            userData.inviteCode = invite ? invite.code : '';
            await setInDb(userKey, userData);

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('invite_choose_reward')
                    .setPlaceholder('🎁 Select your desired reward...')
                    .addOptions([
                        { label: config.rewardName || '3-Day Access Key', value: 'reward_1', description: 'Primary community access key' },
                        { label: '30% Off Discount', value: 'reward_2', description: 'Exclusive store discount voucher' }
                    ])
            );

            return await interaction.reply({
                content: 
                    `# 🔗 __Your Personal Invite Link__\n` +
                    `> Share your unique link below to start earning invite rewards.\n\n` +
                    `• **Your Link:** \`${inviteUrl}\`\n` +
                    `• **Goal Required:** \`${config.goal} Invites\`\n\n` +
                    `> *Please select your preferred reward from the dropdown menu below so administration knows what to fulfill.*`,
                components: [selectMenu],
                ephemeral: true
            });
        } catch (err) {
            return await interaction.reply({ content: '❌ **Error:** Could not generate a tracking link. Make sure I have "Create Invite" permissions.', ephemeral: true });
        }
    }

    if (customId === 'invite_check_progress' || customId.startsWith('invite_check_progress')) {
        const currentUses = userData.uses || 0;
        const targetGoal = config.goal || 10;
        const progressPercent = Math.min(Math.floor((currentUses / targetGoal) * 100), 100);

        const progressEmbed = new EmbedBuilder()
            .setColor(config.color || 0x5865F2)
            .setTitle('📊 __Your Invite Progress__')
            .setDescription(
                `Here are your current community invite stats:\n\n` +
                `• **Successful Invites:** \`${currentUses} /${targetGoal}\`\n` +
                `• **Progress:** \`${progressPercent}%\`\n\n` +
                (currentUses >= targetGoal 
                    ? '🎉 **Goal Achieved!** Check your DMs for your fulfillment confirmation.' 
                    : `> *Keep sharing your link! You need **${targetGoal - currentUses} more invites** to reach your goal.*`)
            )
            .setTimestamp();

        return await interaction.reply({ embeds: [progressEmbed], ephemeral: true });
    }
}

export default {
    name: 'invite_btn',
    async execute(interaction, client, args) {
        return await handleInviteButton(interaction);
    }
};