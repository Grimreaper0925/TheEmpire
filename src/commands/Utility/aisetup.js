import { SlashCommandBuilder, PermissionFlagsBits, ButtonStyle, MessageFlags, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { TEMPLATES } from '../../config/serverTemplates.js';
import { STYLES, getLastBuild, undoLastBuild } from '../../services/serverBuilder.js';
import { ask, building, buttons, runBuildFlow } from '../../services/aisetupFlow.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aisetup')
    .setDescription('Build a ready-made server layout: roles, channels, permissions and starter posts')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('build')
        .setDescription('Pick a layout, preview it, then build it')
        .addStringOption((o) =>
          o.setName('template').setDescription('Which layout to build').setRequired(true).addChoices(...Object.entries(TEMPLATES).map(([value, t]) => ({ name: t.label, value })))
        )
        .addStringOption((o) =>
          o.setName('style').setDescription('How channel names look (default: emoji)').addChoices(...Object.entries(STYLES).map(([value, name]) => ({ name, value })))
        )
    )
    .addSubcommand((s) =>
      s
        .setName('custom')
        .setDescription('Type your own categories and channels and I will build them')
        .addStringOption((o) =>
          o.setName('style').setDescription('How channel names look (default: emoji)').addChoices(...Object.entries(STYLES).map(([value, name]) => ({ name, value })))
        )
    )
    .addSubcommand((s) => s.setName('templates').setDescription('See every ready-made layout'))
    .addSubcommand((s) => s.setName('undo').setDescription('Remove everything the last build created (nothing else is touched)')),
  category: 'Utility',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only server **Administrators** can use `/aisetup`.', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'custom') {
      const style = interaction.options.getString('style') || 'emoji';
      const modal = new ModalBuilder()
        .setCustomId(`aisetup_custom:${style}`)
        .setTitle('Your server layout')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('layout')
              .setLabel('Category on its own line, then - channels')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(4000)
              .setPlaceholder('INFO\n- rules | read\n- chat\n- Lounge | voice\nSTAFF\n- staff-chat | staff')
          )
        );
      return interaction.showModal(modal);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (sub === 'templates') {
      const list = Object.values(TEMPLATES).map((t) => `**${t.label}**: ${t.blurb}`);
      return interaction.editReply(`${list.join('\n')}\n\nBuild one with \`/aisetup build\`, or write your own with \`/aisetup custom\`.\nFlags for custom layouts, added after \`|\`: \`read\` (members can read, not talk), \`staff\`, \`voice\`, \`public\`, \`news\`.`);
    }

    const guild = interaction.guild;
    if (sub === 'undo') {
      if (building.has(guild.id)) return interaction.editReply('A build is running. Wait for it to finish.');
      const last = await getLastBuild(guild.id);
      if (!last) return interaction.editReply('There is no build to undo.');
      const counts = [last.channels?.length || 0, last.categories?.length || 0, last.roles?.length || 0];
      const prompt = await interaction.editReply({
        content: `Undo the last build? This deletes the **${counts[0]} channels, ${counts[1]} categories and ${counts[2]} roles** it created. Anything that already existed stays. Messages in those channels are lost.`,
        components: [buttons(['undo_go', 'Yes, remove them', ButtonStyle.Danger], ['undo_cancel', 'Cancel', ButtonStyle.Secondary])],
      });
      const choice = await ask(interaction, prompt);
      if (!choice) return;
      if (choice.customId === 'undo_cancel') return choice.update({ content: 'Cancelled. Nothing was removed.', components: [] });

      await choice.update({ content: 'Removing...', components: [] });
      building.add(guild.id);
      try {
        const removed = await undoLastBuild(guild);
        return interaction.editReply(`Done. Removed ${removed.channels} channels, ${removed.categories} categories and ${removed.roles} roles.`);
      } finally {
        building.delete(guild.id);
      }
    }

    const template = TEMPLATES[interaction.options.getString('template', true)];
    return runBuildFlow(interaction, template, interaction.options.getString('style') || 'emoji');
  },
};
