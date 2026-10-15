import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags } from 'discord.js';
import { TRIVIA } from '../../data/funData.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);
const active = new Set();

export default {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Quick multiplayer trivia: everyone answers, fastest correct answer scores more')
    .setDMPermission(false)
    .addIntegerOption((o) => o.setName('rounds').setDescription('How many questions (default 5)').setMinValue(1).setMaxValue(10))
    .addStringOption((o) =>
      o.setName('category').setDescription('Topic (default: mixed)').addChoices({ name: 'Gaming', value: 'Gaming' }, { name: 'General', value: 'General' }, { name: 'Tech', value: 'Tech' })
    ),

  async execute(interaction) {
    if (active.has(interaction.channelId)) return interaction.reply({ content: 'A trivia game is already running in this channel.', flags: MessageFlags.Ephemeral });
    active.add(interaction.channelId);

    try {
      const rounds = interaction.options.getInteger('rounds') || 5;
      const category = interaction.options.getString('category');
      const pool = shuffle(TRIVIA.filter((t) => !category || t.c === category)).slice(0, rounds);
      const scores = new Map();

      await interaction.reply(`🧠 **Trivia time!** ${pool.length} questions, 15 seconds each. Faster correct answers score more.`);
      await new Promise((r) => setTimeout(r, 2500));

      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        const options = shuffle(item.a);
        const correct = options.indexOf(item.a[0]);
        const row = new ActionRowBuilder().addComponents(
          options.map((text, n) => new ButtonBuilder().setCustomId(`trivia_${n}`).setLabel(`${LETTERS[n]}. ${text}`.slice(0, 80)).setStyle(ButtonStyle.Secondary))
        );
        const embed = new EmbedBuilder().setTitle(`Question ${i + 1} of ${pool.length} · ${item.c}`).setDescription(`**${item.q}**`).setColor(0x5865f2);
        const message = await interaction.channel.send({ embeds: [embed], components: [row] });

        const answers = new Map(); // user -> { n, at }
        const started = Date.now();
        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });
        collector.on('collect', async (btn) => {
          if (answers.has(btn.user.id)) return btn.reply({ content: 'You already answered this one.', flags: MessageFlags.Ephemeral });
          answers.set(btn.user.id, { n: Number(btn.customId.split('_')[1]), at: Date.now() - started });
          await btn.reply({ content: 'Answer locked in!', flags: MessageFlags.Ephemeral });
        });
        await new Promise((resolve) => collector.on('end', resolve));

        const winners = [...answers.entries()].filter(([, a]) => a.n === correct).sort((a, b) => a[1].at - b[1].at);
        winners.forEach(([id, a], rank) => {
          const points = 100 + Math.round((1 - a.at / 15000) * 100) - rank * 5;
          scores.set(id, (scores.get(id) || 0) + Math.max(points, 50));
        });

        const result = new EmbedBuilder()
          .setTitle(`Question ${i + 1}: the answer was ${LETTERS[correct]}`)
          .setDescription(`**${options[correct]}**\n${winners.length ? `Got it: ${winners.slice(0, 8).map(([id]) => `<@${id}>`).join(' ')}` : 'Nobody got it right.'}`)
          .setColor(winners.length ? 0x2ecc71 : 0xe74c3c);
        await message.edit({ embeds: [result], components: [] });
        await new Promise((r) => setTimeout(r, 2500));
      }

      const board = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🏆 Trivia results')
            .setDescription(board.length ? board.map(([id, pts], i) => `**${i + 1}.** <@${id}> - ${pts} points`).join('\n') : 'Nobody scored. Try again!')
            .setColor(0xf1c40f),
        ],
        allowedMentions: { parse: [] },
      });
    } finally {
      active.delete(interaction.channelId);
    }
  },
};
