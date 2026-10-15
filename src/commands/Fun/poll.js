import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';

const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

export default {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Start a quick poll with up to 4 options')
    .setDMPermission(false)
    .addStringOption((o) => o.setName('question').setDescription('What are you asking?').setRequired(true).setMaxLength(200))
    .addStringOption((o) => o.setName('option1').setDescription('First option').setRequired(true).setMaxLength(80))
    .addStringOption((o) => o.setName('option2').setDescription('Second option').setRequired(true).setMaxLength(80))
    .addStringOption((o) => o.setName('option3').setDescription('Third option').setMaxLength(80))
    .addStringOption((o) => o.setName('option4').setDescription('Fourth option').setMaxLength(80)),

  async execute(interaction) {
    const channel = interaction.channel;
    const needed = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions];
    if (!channel?.permissionsFor(interaction.guild.members.me)?.has(needed)) {
      return interaction.reply({
        content: 'I need **Send Messages**, **Embed Links** and **Add Reactions** in this channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const question = interaction.options.getString('question', true);
    const options = ['option1', 'option2', 'option3', 'option4']
      .map((name) => interaction.options.getString(name))
      .filter(Boolean);

    const embed = createEmbed({
      title: `📊 ${question}`,
      description: options.map((text, i) => `${NUMBERS[i]} ${text}`).join('\n\n'),
    }).setFooter({ text: `Poll by ${interaction.user.username}. React to vote.` });

    await interaction.reply({ content: 'Poll posted.', flags: MessageFlags.Ephemeral });
    const message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    for (let i = 0; i < options.length; i++) await message.react(NUMBERS[i]).catch(() => {});
  },
};
