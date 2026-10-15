import { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, PermissionFlagsBits, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import { takeAnnouncement } from '../../../services/announceStash.js';

const eph = MessageFlags.Ephemeral;

async function resolveTarget(interaction, channelId, editId) {
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return { error: 'I can no longer find that channel.' };
  const me = channel.permissionsFor(interaction.guild.members.me);
  if (!me?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return { error: `I cannot post in ${channel}.` };
  let target = null;
  if (editId && editId !== '0') {
    target = await channel.messages.fetch(editId).catch(() => null);
    if (!target || target.author.id !== interaction.client.user.id) return { error: 'I could not find that message to edit.' };
  }
  return { channel, target };
}

// Only people who can mention roles or everyone may use those mentions in what the bot posts.
function mentionRules(interaction) {
  return interaction.memberPermissions.has(PermissionFlagsBits.MentionEveryone) ? { parse: ['users', 'roles', 'everyone'] } : { parse: ['users'] };
}

const sayModal = {
  name: 'say_modal',
  async execute(interaction, client, args) {
    await interaction.deferReply({ flags: eph });
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply('You need **Manage Messages** to do that.');

    const { channel, target, error } = await resolveTarget(interaction, args[0], args[1]);
    if (error) return interaction.editReply(error);

    const content = interaction.fields.getTextInputValue('text');
    const options = { content, allowedMentions: mentionRules(interaction) };
    const sent = target ? await target.edit(options) : await channel.send(options);
    return interaction.editReply(target ? `Edited the message in ${channel}.` : `Posted in ${channel}. Message ID: \`${sent.id}\` (use it with \`edit_message_id\` to change it later).`);
  },
};

const embedModal = {
  name: 'embed_modal',
  async execute(interaction, client, args) {
    await interaction.deferReply({ flags: eph });
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply('You need **Manage Messages** to do that.');

    const { channel, target, error } = await resolveTarget(interaction, args[0], args[1]);
    if (error) return interaction.editReply(error);

    const options = (args[2] && takeAnnouncement(args[2])) || {};
    const title = interaction.fields.getTextInputValue('title');
    const body = interaction.fields.getTextInputValue('body');
    let footer = '';
    try { footer = interaction.fields.getTextInputValue('footer'); } catch { /* optional */ }

    const container = new ContainerBuilder().setAccentColor(options.color ?? 0x5865f2).addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (options.imageUrl) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(options.imageUrl)));
    if (footer.trim()) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer.trim()}`));

    const payload = { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: mentionRules(interaction) };
    const sent = target ? await target.edit(payload) : await channel.send(payload);
    return interaction.editReply(target ? `Replaced the card in ${channel}.` : `Posted in ${channel}. Message ID: \`${sent.id}\` (use it with \`edit_message_id\` to replace it later).`);
  },
};

export default [sayModal, embedModal];
