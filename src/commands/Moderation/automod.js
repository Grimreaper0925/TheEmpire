import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { getAutomod, saveAutomod, activateRaid, deactivateRaid } from '../../services/automodService.js';

const onOff = (v) => (v ? 'on' : 'off');

export default {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Anti-spam, mass-mention and anti-raid protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) => s.setName('status').setDescription('See every protection and its settings'))
    .addSubcommand((s) =>
      s
        .setName('spam')
        .setDescription('Too many messages too fast')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Turn on or off'))
        .addIntegerOption((o) => o.setName('messages').setDescription('Messages that count as spam').setMinValue(3).setMaxValue(30))
        .addIntegerOption((o) => o.setName('seconds').setDescription('Within this many seconds').setMinValue(2).setMaxValue(60))
        .addIntegerOption((o) => o.setName('timeout_minutes').setDescription('Timeout length').setMinValue(1).setMaxValue(1440))
    )
    .addSubcommand((s) =>
      s
        .setName('duplicates')
        .setDescription('The same message over and over')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Turn on or off'))
        .addIntegerOption((o) => o.setName('repeats').setDescription('Repeats that trigger it').setMinValue(2).setMaxValue(10))
    )
    .addSubcommand((s) =>
      s
        .setName('mentions')
        .setDescription('Mass mentions')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Turn on or off'))
        .addIntegerOption((o) => o.setName('max').setDescription('Most mentions allowed in one message').setMinValue(2).setMaxValue(30))
        .addIntegerOption((o) => o.setName('timeout_minutes').setDescription('Timeout length').setMinValue(1).setMaxValue(1440))
    )
    .addSubcommand((s) =>
      s
        .setName('raid')
        .setDescription('Raid protection: remove new accounts and pause invites')
        .addStringOption((o) => o.setName('mode').setDescription('Turn raid mode on or off right now').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
        .addBooleanOption((o) => o.setName('auto').setDescription('Turn raid mode on automatically when many people join at once'))
        .addIntegerOption((o) => o.setName('joins').setDescription('Joins that count as a raid').setMinValue(3).setMaxValue(50))
        .addIntegerOption((o) => o.setName('seconds').setDescription('Within this many seconds').setMinValue(3).setMaxValue(120))
        .addIntegerOption((o) => o.setName('min_account_age_days').setDescription('During a raid, remove accounts younger than this').setMinValue(0).setMaxValue(365))
        .addBooleanOption((o) => o.setName('strict').setDescription('During a raid, remove EVERY new member'))
        .addIntegerOption((o) => o.setName('auto_off_minutes').setDescription('Turn raid mode off after this long (0 = stay on)').setMinValue(0).setMaxValue(1440))
    )
    .addSubcommand((s) =>
      s
        .setName('warns')
        .setDescription('What happens when a member collects warnings')
        .addIntegerOption((o) => o.setName('timeout_at').setDescription('Timeout at this many warnings (0 = never)').setMinValue(0).setMaxValue(20))
        .addIntegerOption((o) => o.setName('timeout_minutes').setDescription('Timeout length').setMinValue(1).setMaxValue(40320))
        .addIntegerOption((o) => o.setName('kick_at').setDescription('Kick at this many warnings (0 = never)').setMinValue(0).setMaxValue(30))
    )
    .addSubcommand((s) =>
      s
        .setName('alerts')
        .setDescription('Where raid alerts are posted')
        .addChannelOption((o) => o.setName('channel').setDescription('Alert channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    ),
  category: 'Moderation',

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'You need **Manage Server** to use this.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();
    const config = await getAutomod(interaction.guildId);
    const o = interaction.options;
    const changes = [];
    const set = (target, field, value, label) => {
      if (value !== null && value !== undefined) {
        target[field] = value;
        changes.push(label);
      }
    };

    if (sub === 'status') {
      const { spam, duplicates, mentions, raid, warns } = config;
      return interaction.editReply(
        [
          '**Auto-mod**',
          `Spam: **${onOff(spam.enabled)}** (${spam.messages} messages in ${spam.seconds}s, timeout ${spam.timeoutMinutes} min)`,
          `Repeats: **${onOff(duplicates.enabled)}** (${duplicates.repeats} identical messages in ${duplicates.seconds}s)`,
          `Mass mentions: **${onOff(mentions.enabled)}** (over ${mentions.max}, timeout ${mentions.timeoutMinutes} min)`,
          `Raid mode: **${raid.active ? 'ACTIVE' : 'off'}**, auto trigger ${onOff(raid.auto)} (${raid.joins} joins in ${raid.seconds}s), ${raid.strict ? 'removes every new member' : `removes accounts under ${raid.minAgeDays} days old`}, auto-off after ${raid.autoOffMinutes || 'never'} min`,
          `Warnings: timeout at ${warns.timeoutAt || 'never'} (${warns.timeoutMinutes} min), kick at ${warns.kickAt || 'never'}`,
          `Alerts: ${config.alertChannelId ? `<#${config.alertChannelId}>` : 'the system channel'}`,
          '',
          'Members with **Manage Messages** are never touched by auto-mod.',
        ].join('\n')
      );
    }

    if (sub === 'spam') {
      set(config.spam, 'enabled', o.getBoolean('enabled'), 'enabled');
      set(config.spam, 'messages', o.getInteger('messages'), 'messages');
      set(config.spam, 'seconds', o.getInteger('seconds'), 'seconds');
      set(config.spam, 'timeoutMinutes', o.getInteger('timeout_minutes'), 'timeout');
    } else if (sub === 'duplicates') {
      set(config.duplicates, 'enabled', o.getBoolean('enabled'), 'enabled');
      set(config.duplicates, 'repeats', o.getInteger('repeats'), 'repeats');
    } else if (sub === 'mentions') {
      set(config.mentions, 'enabled', o.getBoolean('enabled'), 'enabled');
      set(config.mentions, 'max', o.getInteger('max'), 'max mentions');
      set(config.mentions, 'timeoutMinutes', o.getInteger('timeout_minutes'), 'timeout');
    } else if (sub === 'warns') {
      set(config.warns, 'timeoutAt', o.getInteger('timeout_at'), 'timeout threshold');
      set(config.warns, 'timeoutMinutes', o.getInteger('timeout_minutes'), 'timeout length');
      set(config.warns, 'kickAt', o.getInteger('kick_at'), 'kick threshold');
    } else if (sub === 'alerts') {
      config.alertChannelId = o.getChannel('channel', true).id;
      changes.push('alert channel');
    } else if (sub === 'raid') {
      set(config.raid, 'auto', o.getBoolean('auto'), 'auto trigger');
      set(config.raid, 'joins', o.getInteger('joins'), 'joins');
      set(config.raid, 'seconds', o.getInteger('seconds'), 'seconds');
      set(config.raid, 'minAgeDays', o.getInteger('min_account_age_days'), 'minimum account age');
      set(config.raid, 'strict', o.getBoolean('strict'), 'strict mode');
      set(config.raid, 'autoOffMinutes', o.getInteger('auto_off_minutes'), 'auto-off time');
      await saveAutomod(interaction.guildId, config);

      const mode = o.getString('mode');
      if (mode === 'on') await activateRaid(interaction.guild, `turned on by ${interaction.user.tag}`);
      if (mode === 'off') await deactivateRaid(interaction.guild, `turned off by ${interaction.user.tag}`);
      if (mode) changes.push(`raid mode ${mode}`);
    }

    if (!changes.length) return interaction.editReply('Nothing changed. Add an option, or use `/automod status` to see the current settings.');
    if (sub !== 'raid') await saveAutomod(interaction.guildId, config);
    return interaction.editReply(`Saved: ${changes.join(', ')}.`);
  },
};
