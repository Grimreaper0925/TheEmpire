import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { TEMPLATES } from '../../config/serverTemplates.js';
import { logger } from '../../utils/logger.js';
import {
  STYLES,
  BOT_NEEDS,
  buildServer,
  countTemplate,
  previewText,
  getLastBuild,
  undoLastBuild,
} from '../../services/serverBuilder.js';

const building = new Set();

function buttons(...defs) {
  return new ActionRowBuilder().addComponents(
    defs.map(([id, label, style]) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style))
  );
}

async function ask(interaction, message) {
  try {
    return await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000,
    });
  } catch {
    await interaction.editReply({ content: 'No answer, so nothing was changed.', components: [] }).catch(() => {});
    return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('aisetup')
    .setDescription('Build a ready-made server layout: roles, channels and permissions')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName('build')
        .setDescription('Pick a layout, preview it, then build it')
        .addStringOption((o) =>
          o
            .setName('template')
            .setDescription('Which layout to build')
            .setRequired(true)
            .addChoices(...Object.entries(TEMPLATES).map(([value, t]) => ({ name: t.label, value })))
        )
        .addStringOption((o) =>
          o
            .setName('style')
            .setDescription('How channel names look (default: emoji)')
            .addChoices(...Object.entries(STYLES).map(([value, name]) => ({ name, value })))
        )
    )
    .addSubcommand((s) => s.setName('undo').setDescription('Remove everything the last build created (nothing else is touched)')),
  category: 'Utility',

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply('Only server **Administrators** can use `/aisetup`.');
    }
    const guild = interaction.guild;
    if (building.has(guild.id)) return interaction.editReply('A build is already running. Wait for it to finish.');

    if (interaction.options.getSubcommand() === 'undo') {
      const last = await getLastBuild(guild.id);
      if (!last) return interaction.editReply('There is no build to undo.');
      const total = (last.channels?.length || 0) + (last.categories?.length || 0) + (last.roles?.length || 0);
      const prompt = await interaction.editReply({
        content: `Undo the last build? This deletes the **${last.channels?.length || 0} channels, ${last.categories?.length || 0} categories and ${last.roles?.length || 0} roles** it created (${total} items). Anything that already existed stays. Messages in those channels are lost.`,
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

    const key = interaction.options.getString('template', true);
    const style = interaction.options.getString('style') || 'emoji';
    const template = TEMPLATES[key];

    const me = guild.members.me;
    const missing = BOT_NEEDS.filter((perm) => !me.permissions.has(perm));
    if (missing.length) {
      return interaction.editReply('I need **Manage Channels**, **Manage Roles**, **View Channel** and **Send Messages**. Give my role those (Administrator is easiest), then try again.');
    }

    const totals = countTemplate(template);
    if (guild.channels.cache.size + totals.channels + totals.categories > 480) {
      return interaction.editReply('This server is too close to Discord\'s 500 channel limit to add this layout.');
    }
    if (guild.roles.cache.size + totals.roles > 245) {
      return interaction.editReply('This server is too close to Discord\'s role limit to add this layout.');
    }

    const gatedNote =
      template.gated === false
        ? ''
        : '\n\n**Heads up:** most channels will be hidden until a member has the **Verified** role. Existing members will not see them until you give them that role (or they press Verify).';
    const prompt = await interaction.editReply({
      content:
        `**${template.label}** - ${template.blurb}\n` +
        `${totals.roles} roles, ${totals.categories} categories, ${totals.channels} channels. Anything with a matching name that already exists is reused, never duplicated.\n\n` +
        previewText(template, style) +
        gatedNote,
      components: [buttons(['build_go', 'Build it', ButtonStyle.Success], ['build_cancel', 'Cancel', ButtonStyle.Secondary])],
    });

    const choice = await ask(interaction, prompt);
    if (!choice) return;
    if (choice.customId === 'build_cancel') return choice.update({ content: 'Cancelled. Nothing was created.', components: [] });

    await choice.update({ content: 'Starting the build...', components: [] });
    building.add(guild.id);
    try {
      const result = await buildServer(guild, key, {
        style,
        onProgress: (text) => interaction.editReply({ content: text }).catch(() => {}),
      });
      const { created, reused } = result;
      const next = [
        `Built **${template.label}**. Created ${created.roles.length} roles, ${created.categories.length} categories and ${created.channels.length} channels` +
          (reused.roles + reused.categories + reused.channels ? ` (reused ${reused.roles + reused.categories + reused.channels} that already existed).` : '.'),
      ];
      if (result.verifiedRole) {
        next.push(
          '',
          '**Next steps**',
          `1. Run \`/verifysetup role:${result.verifiedRole.name} verify_channel:#verify\` so new members can unlock the server.`,
          `2. Give **${result.verifiedRole.name}** to your current members so they keep access.`,
          '3. Give yourself and your team the **Staff** role.'
        );
      } else {
        next.push('', 'Give yourself and your team the **Staff** role. Changed your mind? `/aisetup undo` removes only what was just built.');
      }
      if (result.verifiedRole) next.push('', 'Changed your mind? `/aisetup undo` removes only what was just built.');
      return interaction.editReply({ content: next.join('\n') });
    } catch (error) {
      logger.error('Server build failed', { error: error.message });
      return interaction.editReply({
        content: `The build stopped partway: ${error.message}\nWhat was already created stays. Run it again to finish (existing items are reused), or \`/aisetup undo\` to remove them.`,
      });
    } finally {
      building.delete(guild.id);
    }
  },
};
