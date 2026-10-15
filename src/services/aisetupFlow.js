import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { BOT_NEEDS, buildServer, countTemplate, previewText } from './serverBuilder.js';
import { postStarterMessages } from './starterMessages.js';

export const building = new Set();

export function buttons(...defs) {
  return new ActionRowBuilder().addComponents(defs.map(([id, label, style]) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style)));
}

export async function ask(interaction, message) {
  try {
    return await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 180000,
    });
  } catch {
    await interaction.editReply({ content: 'No answer, so nothing was changed.', components: [] }).catch(() => {});
    return null;
  }
}

function extrasList(template) {
  const extras = [];
  if (template.gated !== false) extras.push('rules', 'welcome message', 'verify button');
  else extras.push('rules', 'welcome message');
  extras.push('FAQ');
  if (template.tickets) extras.push('ticket panel');
  if (template.selfRoles) extras.push('roles panel (ping roles and name colors)');
  return extras;
}

// Preview, confirm, build and post starter content. `interaction` must already be deferred (ephemeral).
export async function runBuildFlow(interaction, template, style) {
  const guild = interaction.guild;
  if (building.has(guild.id)) return interaction.editReply('A build is already running. Wait for it to finish.');

  const me = guild.members.me;
  if (BOT_NEEDS.some((perm) => !me.permissions.has(perm))) {
    return interaction.editReply('I need **Manage Channels**, **Manage Roles**, **View Channel** and **Send Messages**. Give my role those (Administrator is easiest), then try again.');
  }

  const totals = countTemplate(template);
  if (guild.channels.cache.size + totals.channels + totals.categories + 2 > 480) return interaction.editReply('This server is too close to Discord\'s 500 channel limit to add this layout.');
  if (guild.roles.cache.size + totals.roles + 14 > 245) return interaction.editReply('This server is too close to Discord\'s role limit to add this layout.');

  const gated = template.gated !== false;
  const isCustom = template.label === 'Custom layout';
  const preview =
    `**${template.label}** - ${template.blurb}\n` +
    `${totals.roles} roles, ${totals.categories} categories, ${totals.channels} channels. Anything with a matching name that already exists is reused, never duplicated.\n\n` +
    previewText(template, style) +
    (isCustom ? '' : `\n\n**I will also post:** ${extrasList(template).join(', ')} (only in channels I create now).`) +
    (gated ? '\n\n**Heads up:** most channels are hidden until a member has the **Verified** role. Existing members will not see them until you give them that role (or they press Verify).' : '');

  if (preview.length > 1950) return interaction.editReply('That layout is too long to preview. Try fewer channels.');

  const prompt = await interaction.editReply({
    content: preview,
    components: [buttons(['build_go', 'Build it', ButtonStyle.Success], ['build_cancel', 'Cancel', ButtonStyle.Secondary])],
  });
  const choice = await ask(interaction, prompt);
  if (!choice) return;
  if (choice.customId === 'build_cancel') return choice.update({ content: 'Cancelled. Nothing was created.', components: [] });

  await choice.update({ content: 'Starting the build...', components: [] });
  building.add(guild.id);
  try {
    const built = await buildServer(guild, template, { style, onProgress: (text) => interaction.editReply({ content: text }).catch(() => {}) });
    let posted = [];
    if (!isCustom) {
      await interaction.editReply({ content: 'Posting rules, panels and welcome messages...' }).catch(() => {});
      posted = await postStarterMessages(guild, template, built);
    } else if (built.verifiedRole) {
      posted = [];
    }

    const { created, reused } = built;
    const reusedCount = reused.roles + reused.categories + reused.channels;
    const lines = [
      `Built **${template.label}**. Created ${created.roles.length} roles, ${created.categories.length} categories and ${created.channels.length} channels${reusedCount ? ` (reused ${reusedCount} that already existed)` : ''}.`,
    ];
    if (posted.length) lines.push(`Posted: ${posted.join(', ')}.`);

    lines.push('', '**Next steps**');
    let n = 1;
    if (gated) {
      if (posted.includes('verify button')) lines.push(`${n++}. Verification is already wired up. Give **Verified** to your current members so they keep access.`);
      else lines.push(`${n++}. Run \`/verifysetup role:Verified verify_channel:#verify\`, and give **Verified** to your current members.`);
    }
    lines.push(`${n++}. Give yourself and your team the **Staff** role.`);
    if (template.tickets && posted.includes('ticket panel')) lines.push(`${n++}. Tickets are live. Tune them with \`/ticket settings\`, and add topics with \`/ticket type-add\`.`);
    lines.push(`${n++}. Edit any posted message with \`/say\`, or change its look with \`/embed\`. Changed your mind? \`/aisetup undo\` removes only what was just built.`);
    return interaction.editReply({ content: lines.join('\n') });
  } catch (error) {
    logger.error('Server build failed', { error: error.message });
    return interaction.editReply({
      content: `The build stopped partway: ${error.message}\nWhat was already created stays. Run it again to finish (existing items are reused), or \`/aisetup undo\` to remove them.`,
    });
  } finally {
    building.delete(guild.id);
  }
}
