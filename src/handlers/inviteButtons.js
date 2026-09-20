import { EmbedBuilder } from 'discord.js';
import { setInDb, getFromDb } from '../utils/database.js';

export async function handleInviteButton(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    if (customId !== 'invite_get_link' && customId !== 'invite_check_progress') return;

    await interaction.deferReply({ ephemeral: true });

    try {
        const guild = interaction.guild;
        const user = interaction.user;
        const dbKey = `invite_reward_${guild.id}_${user.id}`;

        // Fetch existing invite data from db
        let userData = await getFromDb(dbKey, null);

        if (customId === 'invite_get_link') {
            let inviteCode = userData?.inviteCode;
            let inviteLink = '';

            // Check if user already has an active invite or if it's still valid
            let existingInvite = null;
            if (inviteCode) {
                const fetchedInvites = await guild.invites.fetch().catch(() => null);
                existingInvite = fetchedInvites?.get(inviteCode);
            }

            // If no valid invite exists, create a new one
            if (!existingInvite) {
                const newInvite = await guild.invites.create(interaction.channel, {
                    maxAge: 0, // Never expires
                    maxUses: 0, // Unlimited uses until claimed/reset
                    reason: `Invite tracking link for ${user.tag}`
                });
                inviteCode = newInvite.code;
                inviteLink = newInvite.url;

                // Save to database
                userData = {
                    inviteCode: inviteCode,
                    uses: userData?.uses || 0,
                    claimed: userData?.claimed || 0
                };
                await setInDb(dbKey, userData);
            } else {
                inviteLink = existingInvite.url;
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🔗 Your Personal Invite Link')
                .setDescription(`Here is your unique invite link to share with friends:\n\n**${inviteLink}**\n\nEvery successful join using this link will count towards your reward goal!`)
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        }

        if (customId === 'invite_check_progress') {
            const currentUses = userData?.uses || 0;
            const goal = 10;
            const progressPercent = Math.min(Math.floor((currentUses / goal) * 100), 100);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📊 Your Invite Progress')
                .addFields(
                    { name: 'Successful Joins', value: `\`${currentUses} / ${goal}\``, inline: true },
                    { name: 'Progress', value: `\`${progressPercent}%\``, inline: true },
                    { name: 'Reward upon reaching 10:', value: '• **3-Day Access Key** OR **30% Off Discount**', inline: false }
                )
                .setFooter({ text: currentUses >= goal ? '🎉 Goal reached! Open a claim ticket or contact staff to claim your reward!' : 'Keep sharing your link to reach your goal!' })
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error handling invite button:', error);
        return await interaction.editReply({ content: 'An error occurred while processing your request. Please try again later.' });
    }
}