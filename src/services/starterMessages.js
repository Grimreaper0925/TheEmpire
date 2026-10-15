import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import { createEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { describePromo, getStoreConfig, promoIsActive } from './storeService.js';
import { getVerifyConfig, saveVerifyConfig } from './verificationService.js';
import { getTicketConfig, saveTicketConfig } from './ticketSystem.js';
import { buildPanel } from './ticketFlows.js';
import { ensureSelfRoles, postSelfRolePanel } from './selfRoles.js';
import { addToLastBuild } from './serverBuilder.js';

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function card(color, ...blocks) {
  const container = new ContainerBuilder().setAccentColor(color);
  blocks.forEach((block, i) => {
    if (i > 0) container.addSeparatorComponents(divider());
    container.addTextDisplayComponents(text(block));
  });
  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

export const DEFAULT_RULES = [
  '**1. Be respectful.** No harassment, hate, slurs or personal attacks.',
  '**2. No spam or self-promo.** That includes unwanted DMs and invite links.',
  '**3. Keep it safe.** No scams, doxxing, or sharing anyone\'s private information.',
  '**4. Stay on topic.** Use the right channel for what you are posting.',
  '**5. Follow staff.** If a staff member asks you to stop, stop. Disagree in a ticket, not in chat.',
  '**6. Follow Discord\'s Terms of Service and Community Guidelines.**',
].join('\n');

// Posts starter content, but only into channels this build just created, so existing channels never get duplicate posts.
export async function postStarterMessages(guild, template, built) {
  const notes = [];
  const fresh = (name) => {
    const channel = built.channelsByName.get(name.replace(/[^a-z0-9]/g, ''));
    return channel && built.createdIds.has(channel.id) ? channel : null;
  };
  const attempt = async (label, fn) => {
    try {
      await fn();
      notes.push(label);
    } catch (error) {
      logger.warn(`Starter message failed: ${label}`, { error: error.message });
    }
  };

  const store = await getStoreConfig(guild.id);
  const verifyChannel = fresh('verify');
  const welcome = fresh('welcome');
  const verified = built.roles.verified;

  const rules = fresh('rules');
  if (rules) await attempt('rules', () => rules.send(card(0xed4245, `# 📜 Server rules\n${DEFAULT_RULES}`, '-# Breaking the rules can lead to a timeout, kick or ban. Staff decisions are final in chat; to appeal, open a ticket.')));

  if (welcome) {
    await attempt('welcome message', () =>
      welcome.send(
        card(
          0x5865f2,
          `# 👋 Welcome to ${guild.name}`,
          [
            '**Get started**',
            rules ? `1. Read ${rules}` : '1. Read the rules',
            verifyChannel ? `2. Verify in ${verifyChannel} to unlock the server` : '2. Say hi in the chat',
            built.channelsByName.get('getroles') ? `3. Pick your roles in ${built.channelsByName.get('getroles')}` : '3. Say hi in the chat',
          ].join('\n')
        )
      )
    );
  }

  if (verifyChannel && verified) {
    await attempt('verify button', async () => {
      const embed = createEmbed({
        title: 'Verify you are human',
        description: 'Welcome! Press **Verify**, answer one quick question, and you get full access to the server.\n\nThis keeps bots and spam accounts out.',
      });
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_btn:start').setLabel('Verify').setStyle(ButtonStyle.Success));
      await verifyChannel.send({ embeds: [embed], components: [row] });
      const config = await getVerifyConfig(guild.id);
      config.roleId = verified.id;
      config.verifyChannelId = verifyChannel.id;
      if (welcome) config.welcomeChannelId = welcome.id;
      await saveVerifyConfig(guild.id, config);
    });
  }

  const faq = fresh('faq');
  if (faq) {
    await attempt('FAQ', () =>
      faq.send(
        card(
          0x3498db,
          '# ❓ Frequently asked questions',
          '**How do I get access?**\nPress **Verify** in the verify channel. It takes a few seconds.',
          `**Where do I get help?**\n${built.channelsByName.get('support') ? `Open a private ticket in ${built.channelsByName.get('support')}.` : 'Ask a staff member.'}`,
          template.store ? `**Where is the store?**\n${store.url}${promoIsActive(store) ? `\nCurrent deal: ${describePromo(store)}.` : ''}` : '**Can I change my name color or pings?**\nYes, use the roles panel.',
          '-# Staff can edit this message with /say or /embed any time.'
        )
      )
    );
  }

  const sales = fresh('sales');
  if (sales && template.store && promoIsActive(store)) {
    await attempt('sale card', () =>
      sales.send(card(0xff3b30, `# 💸 ${store.tagline}`, `${describePromo(store)}\nEnter the code at checkout: ${store.url}`))
    );
  }

  const support = fresh('support');
  if (support && template.tickets && built.ticketCategory) {
    await attempt('ticket panel', async () => {
      const config = await getTicketConfig(guild.id);
      config.categoryId = built.ticketCategory.id;
      config.staffRoleIds = [...new Set([...config.staffRoleIds, built.roles.staff.id])];
      const log = built.channelsByName.get('modlog');
      if (log) config.logChannelId = log.id;
      const message = await support.send(buildPanel(config));
      config.panelChannelId = support.id;
      config.panelMessageId = message.id;
      await saveTicketConfig(guild.id, config);
    });
  }

  const getRoles = fresh('getroles');
  if (getRoles && template.selfRoles) {
    await attempt('roles panel', async () => {
      const { createdIds } = await ensureSelfRoles(guild);
      await addToLastBuild(guild.id, { roles: createdIds });
      await postSelfRolePanel(getRoles);
    });
  }

  return notes;
}
