import { EmbedBuilder } from 'discord.js';
import { getFromDb, setInDb } from '../../utils/database.js';

export default {
    name: 'invcfg_modal',
    async execute(interaction, client) {
        if (!interaction.memberPermissions?.has('Administrator')) return;

        await interaction.deferUpdate();

        const guildId = interaction.guild.id;
        const configKey = `invite_config_${guildId}`;
        let config = await getFromDb(configKey, {
            goal: 10, color: '#5865F2', rewardName: '3-Day Access Key', alertChannelId: '', staffRoleId: '',
            dmText: '🎉 **Congratulations!** Your invite goal has been verified.\n\n• **Reward:** `{reward}`\n\nPlease wait up to 24 hours for staff to send your access key!'
        });

        const action = interaction.customId.replace('invcfg_modal_', '');
        const val = interaction.fields.getTextInputValue('input_value');

        if (action === 'goal') config.goal = parseInt(val, 10) || 10;
        else if (action === 'reward') config.rewardName = val;
        else if (action === 'color') config.color = val.startsWith('#') ? val : `#${val}`;
        else if (action === 'dmtext') config.dmText = val;
        else if (action === 'role') config.staffRoleId = val.replace(/[^0-9]/g, '');

        await setInDb(configKey, config);

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

        await interaction.editReply({ embeds: [embed] });
    }
};