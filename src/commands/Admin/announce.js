import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { stashAnnouncement } from '../../services/announceStash.js';
import { ANNOUNCE_STYLES, ANNOUNCE_VIBES, parseHexColor } from '../../services/announcementBuilder.js';
import { cancelScheduled, getScheduled, parseSchedule } from '../../services/scheduledAnnouncements.js';

const SALE_HINT = 'What is on sale and why it is worth it. Use - for bullets. The % and code are highlighted for you.';
const BODY_HINTS = {
  update: 'Added: new ticket panel\nFixed: giveaway reroll\nChanged: faster loading\nRemoved: old command',
  promo: SALE_HINT,
  flash: SALE_HINT,
  restock: 'What is back in stock. One item per line with - for bullets.',
  maintenance: 'What is being worked on, how long it should take, and what will be down.',
};

const reply = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

export default {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post or schedule a nicely formatted announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('post')
        .setDescription('Write an announcement and post it now, or schedule it for later')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Where to post it')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('schedule')
            .setDescription('Post later: a delay like 2h or 1d 6h, or a date like 2026-12-25 18:00 (leave empty to post now)')
            .setMaxLength(30)
        )
        .addIntegerOption((o) =>
          o
            .setName('utc_offset')
            .setDescription('Your time zone as an offset from UTC, used with a date (e.g. -5 for New York). Default 0')
            .setMinValue(-12)
            .setMaxValue(14)
        )
        .addStringOption((o) =>
          o
            .setName('style')
            .setDescription('Look of the announcement (default: News)')
            .addChoices(...Object.entries(ANNOUNCE_STYLES).map(([value, v]) => ({ name: `${v.emoji} ${v.label}`, value })))
        )
        .addStringOption((o) =>
          o
            .setName('vibe')
            .setDescription('How playful the text looks (default: Hype)')
            .addChoices(...Object.entries(ANNOUNCE_VIBES).map(([value, name]) => ({ name, value })))
        )
        .addRoleOption((o) => o.setName('ping').setDescription('Role to ping with it'))
        .addBooleanOption((o) => o.setName('ping_everyone').setDescription('Ping @everyone instead'))
        .addAttachmentOption((o) => o.setName('image').setDescription('Big banner image shown under the text'))
        .addStringOption((o) => o.setName('button_label').setDescription('Text on a link button, like "Shop now"').setMaxLength(80))
        .addStringOption((o) => o.setName('button_url').setDescription('Where the button goes (https://...)').setMaxLength(300))
        .addStringOption((o) => o.setName('color').setDescription('Card color: a name like red, or hex like #ff0000').setMaxLength(20))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Show announcements that are waiting to be posted'))
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel a scheduled announcement')
        .addStringOption((o) => o.setName('id').setDescription('The ID shown by /announce list').setRequired(true).setMaxLength(10))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return list(interaction);
    if (sub === 'cancel') return cancel(interaction);
    return post(interaction);
  },
};

async function list(interaction) {
  const jobs = (await getScheduled(interaction.guildId)).sort((a, b) => a.sendAt - b.sendAt);
  if (jobs.length === 0) return reply(interaction, 'Nothing is scheduled. Use `/announce post` with the `schedule` option.');

  const lines = jobs.map((job) => {
    const ts = Math.floor(job.sendAt / 1000);
    return `\`${job.id}\` • <#${job.channelId}> • <t:${ts}:f> (<t:${ts}:R>)\n└ **${job.fields.title.slice(0, 80)}**`;
  });
  return reply(interaction, `**Scheduled announcements**\n${lines.join('\n')}\n\nCancel one with \`/announce cancel id:<id>\`.`);
}

async function cancel(interaction) {
  const id = interaction.options.getString('id', true).trim();
  const job = await cancelScheduled(interaction.guildId, id);
  if (!job) return reply(interaction, `I couldn't find a scheduled announcement with ID \`${id}\`. Check \`/announce list\`.`);
  return reply(interaction, `Cancelled **${job.fields.title}** that was set for <#${job.channelId}>.`);
}

async function post(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  const role = interaction.options.getRole('ping');
  const everyone = interaction.options.getBoolean('ping_everyone') === true;
  const image = interaction.options.getAttachment('image');

  if (image && !image.contentType?.startsWith('image/')) return reply(interaction, 'That attachment is not an image.');

  const perms = channel.permissionsFor(interaction.guild.members.me);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    return reply(interaction, `I need **View Channel**, **Send Messages** and **Embed Links** in ${channel}.`);
  }

  const buttonUrl = interaction.options.getString('button_url');
  if (buttonUrl && !/^https:\/\/[^\s]+$/i.test(buttonUrl)) return reply(interaction, 'The button link must start with https://');

  const colorInput = interaction.options.getString('color');
  const color = colorInput ? parseHexColor(colorInput) : null;
  if (colorInput && color === null) {
    return reply(interaction, 'I could not read that color. Use a name like `red`, `gold` or `purple`, or hex like `#ff0000`.');
  }

  let sendAt = null;
  const scheduleInput = interaction.options.getString('schedule');
  if (scheduleInput) {
    try {
      sendAt = parseSchedule(scheduleInput, interaction.options.getInteger('utc_offset') ?? 0);
    } catch (error) {
      return reply(interaction, error.message);
    }
  }

  const pingPart = everyone ? 'everyone' : role ? role.id : 'none';
  const styleKey = interaction.options.getString('style') || 'news';
  const stashKey = stashAnnouncement({
    styleKey,
    imageUrl: image?.url || null,
    buttonLabel: interaction.options.getString('button_label'),
    buttonUrl,
    color,
    vibe: interaction.options.getString('vibe') || 'hype',
    sendAt,
  });

  const modal = new ModalBuilder()
    .setCustomId(`announce_modal:${channel.id}:${pingPart}:${stashKey}`)
    .setTitle(sendAt ? 'Schedule announcement' : 'New announcement')
    .addComponents(
      input('title', 'Title', TextInputStyle.Short, { max: 100, required: true, placeholder: 'GRIM EMPIRE HALLOWEEN SALE' }),
      input('tagline', 'Tagline (optional, shown under the title)', TextInputStyle.Short, {
        max: 120,
        placeholder: 'Everything is 30% off. Today only.',
      }),
      input('body', 'Message', TextInputStyle.Paragraph, {
        max: 1800,
        required: true,
        placeholder: BODY_HINTS[styleKey] || 'Try **bold** __underline__ ~~strike~~ ||spoiler|| > quote ## heading. Use - for bullets.',
      }),
      input('points', 'Highlights (optional, one per line)', TextInputStyle.Paragraph, {
        max: 900,
        placeholder: 'Instant delivery\nSupport tickets open 24/7\nUse code at checkout',
      }),
      input('closing', 'Sign-off line (optional)', TextInputStyle.Short, { max: 150, placeholder: 'See you in the Empire.' })
    );

  return interaction.showModal(modal);
}

function input(id, label, style, { max, required = false, placeholder }) {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setMaxLength(max).setRequired(required);
  if (placeholder) field.setPlaceholder(placeholder);
  return new ActionRowBuilder().addComponents(field);
}
