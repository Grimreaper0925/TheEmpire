import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getVerifyConfig, saveVerifyConfig } from '../../services/verificationService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verifysetup')
    .setDescription('Set up human verification and the AI greeter')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) =>
      o.setName('role').setDescription('Role given to verified members').setRequired(true)
    )
    .addChannelOption((o) =>
      o
        .setName('verify_channel')
        .setDescription('Channel where the Verify button is posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((o) =>
      o
        .setName('welcome_channel')
        .setDescription('Channel where new members get greeted')
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'You need **Manage Server** permission to use `/verifysetup`.',
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole('role', true);
    const verifyChannel = interaction.options.getChannel('verify_channel', true);
    const welcomeChannel = interaction.options.getChannel('welcome_channel');

    const me = interaction.guild.members.me;
    if (role.managed || role.position >= me.roles.highest.position) {
      return interaction.editReply(
        `I can't hand out **${role.name}**. Move my bot role above it in Server Settings -> Roles, then run this again.`
      );
    }

    const config = await getVerifyConfig(interaction.guildId);
    config.roleId = role.id;
    config.verifyChannelId = verifyChannel.id;
    if (welcomeChannel) config.welcomeChannelId = welcomeChannel.id;
    await saveVerifyConfig(interaction.guildId, config);

    const embed = createEmbed({
      title: 'Verify you are human',
      description:
        'Welcome! Press **Verify**, answer one quick question, and you get full access to the server.\n\n' +
        'This keeps bots and spam accounts out.',
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_btn:start').setLabel('Verify').setStyle(ButtonStyle.Success)
    );

    try {
      await verifyChannel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error('Failed to post verification panel', { error: error.message });
      return interaction.editReply(
        `Saved your settings, but I couldn't post in ${verifyChannel}. Give me **Send Messages** and **Embed Links** there and run the command again.`
      );
    }

    logger.info('Verification configured', { guildId: interaction.guildId, roleId: role.id });

    const lines = [
      `Verification is live. Members who pass get **${role.name}**.`,
      welcomeChannel ? `New members are greeted in ${welcomeChannel}.` : null,
      'Tip: hide your other channels from @everyone and show them only to the verified role.',
    ].filter(Boolean);

    return interaction.editReply(lines.join('\n'));
  },
};
