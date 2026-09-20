// Inside your guildMemberAdd.js invite check block:
if (userData && userData.inviteCode === usedInvite.code) {
    userData.uses = (userData.uses || 0) + 1;
    
    // Check if they just hit the goal (e.g., 10)
    const targetGoal = 10;
    if (userData.uses === targetGoal && !userData.rewardClaimed) {
        userData.pendingReward = true;
        userData.rewardTimestamp = Date.now();

        // 1. DM the user confirming they reached it and instructions
        try {
            const userDmEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🎉 Invite Goal Reached!')
                .setDescription(
                    `Congratulations! You have reached **${targetGoal} successful invites**!\n\n` +
                    'Your reward request has been sent to staff. Please allow up to **24 hours** for delivery via DM.'
                );
            await inviter.send({ embeds: [userDmEmbed] });
        } catch (e) {}

        // 2. Notify staff / admin via DM or designated channel
        const staffAlertEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('⏳ Invite Reward Pending Delivery!')
            .setDescription(
                `**User:** ${inviter.tag} (\`${inviter.id}\`) has reached ${targetGoal} invites!\n` +
                `You have **24 hours** to deliver the reward using the admin command.`
            )
            .setTimestamp();

        // Send alert to server owner or admin log channel if configured
        try {
            const owner = await guild.fetchOwner();
            await owner.send({ embeds: [staffAlertEmbed] });
        } catch (e) {}
    }

    await setInDb(dbKey, userData);
}