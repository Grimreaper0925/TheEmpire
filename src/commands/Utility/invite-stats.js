import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getFromDb } from '../../utils/database.js';

function formatUserLine(userData, targetGoal) {
    const uses = userData.uses || 0;
    const reward = userData.rewardChoice || 'Not chosen yet';

    let status = 'In progress';
    if (userData.rewardClaimed) {
        status = userData.rewardDelivered
            ? `✅ Delivered (${new Date(userData.rewardDeliveredAt).toLocaleDateString()})`
            : '⏳ Pending delivery';
    }

    return (
        `> **Progress:** \`${uses}/${targetGoal}\` • **Status:** ${status}\n` +
        `> **Reward Choice:** \`${reward}\`\n` +
        `> **Invite Link:** ${userData.inviteUrl || '\`None generated yet\`'}`
    );
}

export default {
    data: new SlashCommandBuilder()
        .setName('invite-stats')
        .setDescription("View a member's invite reward progress, or the whole server's leaderboard")
        .addUserOption(option =>
            option.setName('user').setDescription('Check a specific member instead of the full leaderboard').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: '❌ **Access Denied:** You need **Administrator** permissions.', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const config = await getFromDb(`invite_config_${guildId}`, { goal: 10, color: '#5865F2' });
        const targetGoal = config.goal || 10;
        const targetUser = interaction.options.getUser('user');

        if (targetUser) {
            const userData = await getFromDb(`invite_user_${guildId}_${targetUser.id}`, null);
            if (!userData) {
                return await interaction.reply({ content: `**${targetUser.tag}** hasn't generated an invite link or earned any invites yet.`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(config.color || 0x5865F2)
                .setTitle(`📊 Invite Progress — ${targetUser.tag}`)
                .setDescription(formatUserLine(userData, targetGoal))
                .setFooter({ text: `User ID: ${targetUser.id}` })
                .setTimestamp();

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const prefix = `invite_user_${guildId}_`;
        const keys = await interaction.client.db.list(prefix);

        if (!keys || keys.length === 0) {
            return await interaction.editReply({ content: 'No one has generated an invite link yet.' });
        }

        const records = [];
        for (const key of keys) {
            if (!key.startsWith(prefix)) continue;
            const userId = key.slice(prefix.length);
            const userData = await getFromDb(key, null);
            if (userData) records.push({ userId, userData });
        }

        records.sort((a, b) => (b.userData.uses || 0) - (a.userData.uses || 0));

        const shown = records.slice(0, 15);

        const embed = new EmbedBuilder()
            .setColor(config.color || 0x5865F2)
            .setTitle('📊 Invite Rewards Leaderboard')
            .setDescription(`Showing ${shown.length} of ${records.length} member(s) with invite activity, sorted by progress.`)
            .setFooter({ text: 'Use /invite-stats user:<member> to look up anyone not shown here.' })
            .setTimestamp();

        for (const { userId, userData } of shown) {
            embed.addFields({
                name: `<@${userId}>`,
                value: formatUserLine(userData, targetGoal),
                inline: false
            });
        }

        return await interaction.editReply({ embeds: [embed] });
    }
};
