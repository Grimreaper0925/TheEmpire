import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getFromDb } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invite-config')
        .setDescription('Probot-style Control Panel for Invite Rewards')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ content: '❌ **Access Denied.**', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, {
            goal: 10,
            color: '#5865F2',
            rewardName: '3-Day Access Key',
            alertChannelId: '',
            staffRoleId: '',
            dmText: '🎉 **Congratulations!** Your invite goal has been verified.\n\n• **Reward:** `{reward}`\n\nPlease wait up to 24 hours for staff to send your access key!'
        });

        const embed = new EmbedBuilder()
            .setColor(config.color || '#5865F2')
            .setTitle('⚙️ __Invite Rewards Configuration__')
            .setDescription(
                `Welcome to the advanced invite rewards control panel.\n\n` +
                `🎯 **Invite Goal:** \`${config.goal} Invites\`\n` +
                `🎁 **Reward Name:** \`${config.rewardName}\`\n` +
                `🎨 **Theme Color:** \`${config.color || '#5865F2'}\`\n` +
                `📢 **Alert Channel:** ${config.alertChannelId ? `<#${config.alertChannelId}>` : '`Not Set (DMs Owner)`'}\n` +
                `🛡️ **Staff Role:** ${config.staffRoleId ? `<@&${config.staffRoleId}>` : '`Not Set`'}\n\n` +
                `💬 **Custom DM Message:**\n\`\`\`text\n${config.dmText}\n\`\`\``
            )
            .setFooter({ text: 'The Empire • Reward System' })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('invcfg_btn:goal').setLabel('Edit Goal').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
            new ButtonBuilder().setCustomId('invcfg_btn:reward').setLabel('Edit Reward').setStyle(ButtonStyle.Primary).setEmoji('🎁'),
            new ButtonBuilder().setCustomId('invcfg_btn:color').setLabel('Edit Color').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
            new ButtonBuilder().setCustomId('invcfg_btn:dmtext').setLabel('Edit DM Text').setStyle(ButtonStyle.Secondary).setEmoji('💬')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('invcfg_btn:role').setLabel('Set Staff Role').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('invcfg_btn:channel').setLabel('Set Alert Channel Here').setStyle(ButtonStyle.Success).setEmoji('📢'),
            new ButtonBuilder().setCustomId('invcfg_btn:test').setLabel('Test Delivery Workflow').setStyle(ButtonStyle.Danger).setEmoji('🚀')
        );

        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    }
};