const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-chat')
        .setDescription('Resets the channel by clearing all messages and starts a new period.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.channel;

            const newChannel = await channel.clone({
                reason: `Chat reset requested by ${interaction.user.tag}`
            });

            await channel.delete(`Chat reset requested by ${interaction.user.tag}`);

            await newChannel.send({
                content: '🔄 **Leaderboard Reset!** A new 24-hour period has started. Start chatting to climb the leaderboard!'
            });

        } catch (error) {
            console.error('Failed to reset channel:', error);
            await interaction.editReply({ content: 'There was an error trying to reset this channel.' });
        }
    },
};
