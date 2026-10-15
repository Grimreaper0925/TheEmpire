import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { average, getVouchData, starString } from '../../services/vouchService.js';

export default {
  data: new SlashCommandBuilder().setName('vouches').setDescription('See the store rating and the latest vouches').setDMPermission(false),
  category: 'Store',

  async execute(interaction) {
    const data = await getVouchData(interaction.guildId);
    if (!data.count) return interaction.reply({ content: 'No vouches yet. Be the first with `/vouch`.', flags: MessageFlags.Ephemeral });

    const latest = data.recent.slice(-5).reverse().map((v) => `${starString(v.stars)} <@${v.userId}>${v.product ? ` (${v.product})` : ''}\n> ${v.message.slice(0, 120)}`).join('\n\n');
    const counts = [5, 4, 3, 2, 1].map((n) => `${n}⭐ ${data.recent.filter((v) => v.stars === n).length}`).join('  ');
    const embed = new EmbedBuilder()
      .setTitle('Store vouches')
      .setDescription(`**${average(data).toFixed(2)} / 5** from **${data.count}** vouches\nRecent split: ${counts}\n\n${latest}`)
      .setColor(0xf1c40f);
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
