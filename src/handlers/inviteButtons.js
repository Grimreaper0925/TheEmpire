import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../utils/database.js';

export async function handleInviteButton(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const configKey = `invite_config_${guildId}`;
    const userKey = `invite_user_${guildId}_${userId}`;

    const customId = interaction.customId;

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    let config = await getFromDb(configKey, {
        goal: 10,
        color: '#5865F2',
        rewardName: '3-Day Access Key'
    });

    let userData = await getFromDb(userKey, {
        uses: 0,
        inviteCode: '',
        inviteUrl: '',
        rewardChoice: null
    });

    if (customId === 'invite_get_link' || customId.startsWith('invite_get_link')) {
        try {
            let inviteUrl = userData.inviteUrl;

            if (!inviteUrl || !userData.inviteCode) {
                // Create a brand-new, unique invite link for THIS specific user only
                const invite = await interaction.guild.invites.create(interaction.channel.id, {
                    maxAge: 0,   // Never expires
                    maxUses: 0,  // Infinite uses
                    unique: true,
                    reason: `Unique personal invite link for ${interaction.user.tag} (${userId})`
                }).catch(() => null);

                if (invite) {
                    userData.inviteCode = invite.code;
                    userData.inviteUrl = invite.url;
                    inviteUrl = invite.url;
                    await setInDb(userKey, userData);

                    // Reverse lookup: code -> owner, so guildMemberAdd can find the
                    // real owner instead of trusting invite.inviter (which is always the bot)
                    await setInDb(`invite_owner_${guildId}_${invite.code}`, userId);

                    // Seed the bot's invite cache immediately so the very first use
                    // of this brand-new code isn't invisible to the next diff check
                    const client = interaction.client;
                    client.invites = client.invites || new Map();
                    let guildCache = client.invites.get(guildId);
                    if (!guildCache) {
                        guildCache = await interaction.guild.invites.fetch().catch(() => new Map());
                        client.invites.set(guildId, guildCache);
                    }
                    guildCache.set(invite.code, invite);
                } else {
                    // Invite creation failed — fall back, but this link will NOT be tracked
                    inviteUrl = `https://discord.gg/${interaction.guild.vanityCode || ''}`;
                }
            }

            // IF ALREADY LOCKED IN, HIDE DROPDOWN & SHOW LOCKED STATUS
            if (userData.rewardChoice) {
                return await interaction.editReply({
                    content:
                        `# 🔗 __Your Unique Personal Invite Link__\n` +
                        `> Share your personal link below to start earning invite rewards.\n\n` +
                        `• **Your Link:** \`${inviteUrl}\`\n` +
                        `• **Goal Required:** \`${config.goal} Invites\`\n\n` +
                        `🔒 **Locked Reward Choice:** \`${userData.rewardChoice}\`\n` +
                        `> *Your reward preference is permanently locked in!*`,
                    components: []
                });
            }

            // SHOW DROPDOWN IF NOT CHOSEN YET
            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('invite_choose_reward')
                    .setPlaceholder('🎁 Select your desired reward (Locks in permanently)...')
                    .addOptions([
                        { label: config.rewardName || '3-Day Access Key', value: 'reward_1', description: 'Primary community access key' },
                        { label: '30% Off Discount', value: 'reward_2', description: 'Exclusive store discount voucher' }
                    ])
            );

            return await interaction.editReply({
                content:
                    `# 🔗 __Your Unique Personal Invite Link__\n` +
                    `> Share your personal link below to start earning invite rewards.\n\n` +
                    `• **Your Link:** \`${inviteUrl}\`\n` +
                    `• **Goal Required:** \`${config.goal} Invites\`\n\n` +
                    `> *Please select your preferred reward from the dropdown below. **Note: This choice will be permanently locked in!***`,
                components: [selectMenu]
            });
        } catch (err) {
            return await interaction.editReply({ content: '❌ **Error:** Could not generate a unique tracking link. Please try again in a moment.' });
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
                `• **Progress:** \`${progressPercent}%\`\n` +
                `• **Locked Reward:** \`${userData.rewardChoice || 'Not Selected Yet'}\`\n\n` +
                (currentUses >= targetGoal
                    ? '🎉 **Goal Achieved!** Check your DMs for your fulfillment confirmation.'
                    : `> *Keep sharing your link! You need **${targetGoal - currentUses} more invites** to reach your goal.*`)
            )
            .setTimestamp();

        return await interaction.editReply({ embeds: [progressEmbed] });
    }
}

export default {
    name: 'invite_btn',
    async execute(interaction, client, args) {
        return await handleInviteButton(interaction);
    }
};