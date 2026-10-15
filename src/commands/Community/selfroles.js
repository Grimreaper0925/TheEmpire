import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { ensureSelfRoles, postSelfRolePanel } from '../../services/selfRoles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('selfroles')
    .setDescription('Post a panel where members pick ping roles and a name color')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addChannelOption((o) => o.setName('channel').setDescription('Where to post the panel').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  category: 'Community',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) return interaction.editReply('You need **Manage Roles** to use this.');
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.editReply('I need the **Manage Roles** permission first.');

    const channel = interaction.options.getChannel('channel', true);
    try {
      const { createdIds } = await ensureSelfRoles(interaction.guild);
      await postSelfRolePanel(channel);
      return interaction.editReply(
        `Panel posted in ${channel}. ${createdIds.length ? `I created ${createdIds.length} new roles (Sales Ping, Giveaway Ping, News Ping, Restock Ping and name colors).` : 'The roles already existed, so I reused them.'}\n` +
          'Use the ping roles when you announce: `/announce ping:@Sales Ping`. Keep my role above these roles so I can hand them out.'
      );
    } catch (error) {
      return interaction.editReply(`I could not set that up: ${error.message}`);
    }
  },
};
