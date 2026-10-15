import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getVerifyConfig } from '../../services/verificationService.js';
import { getStoreConfig, describePromo } from '../../services/storeService.js';

const DAY = 24 * 60 * 60 * 1000;

export default {
  data: new SlashCommandBuilder()
    .setName('pulse')
    .setDescription('Quick health check of your server for admins')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const members = await guild.members.fetch();
    const humans = members.filter((m) => !m.user.bot);
    const now = Date.now();

    const joined24h = humans.filter((m) => now - (m.joinedTimestamp ?? 0) < DAY).size;
    const joined7d = humans.filter((m) => now - (m.joinedTimestamp ?? 0) < 7 * DAY).size;
    const youngAccounts = humans.filter((m) => now - m.user.createdTimestamp < 7 * DAY).size;

    const config = await getVerifyConfig(guild.id);
    let verifiedLine = 'Not set up (run `/verifysetup`)';
    if (config.roleId) {
      const verified = humans.filter((m) => m.roles.cache.has(config.roleId)).size;
      const pct = humans.size ? Math.round((verified / humans.size) * 100) : 0;
      verifiedLine = `${verified} of ${humans.size} (${pct}%)`;
    }

    const store = await getStoreConfig(guild.id);
    const promo = describePromo(store);

    const embed = createEmbed({
      title: `${guild.name} pulse`,
      description: [
        `**Members:** ${humans.size} people, ${members.size - humans.size} bots`,
        `**Verified:** ${verifiedLine}`,
        `**Joined last 24h / 7d:** ${joined24h} / ${joined7d}`,
        `**Accounts under 7 days old:** ${youngAccounts}`,
        `**Link guard:** ${config.linkGuard ? 'on' : 'off'}`,
        `**AI helper:** ${process.env.ANTHROPIC_API_KEY ? (config.aiChannelId ? `on in <#${config.aiChannelId}>` : 'on when mentioned') : 'off (no API key)'}`,
        `**Promo:** ${promo ?? 'none active'}`,
      ].join('\n'),
    });

    return interaction.editReply({ embeds: [embed] });
  },
};
