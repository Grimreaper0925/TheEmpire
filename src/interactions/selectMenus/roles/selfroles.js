import { MessageFlags } from 'discord.js';
import { buildSelfRolePanel, getSelfRoles } from '../../../services/selfRoles.js';

const eph = MessageFlags.Ephemeral;

async function applyChoice(interaction, bucket, wantedKeys) {
  const config = await getSelfRoles(interaction.guildId);
  const group = config[bucket];
  const member = interaction.member;
  const added = [];
  const removed = [];

  for (const [roleKey, roleId] of Object.entries(group)) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) continue;
    const has = member.roles.cache.has(roleId);
    const want = wantedKeys.includes(roleKey);
    try {
      if (want && !has) { await member.roles.add(role, 'Self-role panel'); added.push(role.name); }
      if (!want && has) { await member.roles.remove(role, 'Self-role panel'); removed.push(role.name); }
    } catch {
      return interaction.editReply('I could not change your roles. Ask an admin to move my role above the self-roles in Server Settings.');
    }
  }

  const parts = [];
  if (added.length) parts.push(`Added: ${added.join(', ')}`);
  if (removed.length) parts.push(`Removed: ${removed.join(', ')}`);
  return interaction.editReply(parts.join('\n') || 'No changes.');
}

async function resetPanel(interaction) {
  const config = await getSelfRoles(interaction.guildId);
  interaction.message.edit(buildSelfRolePanel(config)).catch(() => {}); // clears the menu so it can be used again
}

export default [
  {
    name: 'sr_ping',
    async execute(interaction) {
      await interaction.deferReply({ flags: eph });
      await applyChoice(interaction, 'pings', interaction.values);
      resetPanel(interaction);
    },
  },
  {
    name: 'sr_color',
    async execute(interaction) {
      await interaction.deferReply({ flags: eph });
      const choice = interaction.values[0];
      await applyChoice(interaction, 'colors', choice === 'none' ? [] : [choice]);
      resetPanel(interaction);
    },
  },
];
