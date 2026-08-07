import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getFromDb, setInDb } from '../../../utils/database.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';

async function deferComponent(interaction) {
    if (interaction.deferred || interaction.replied) return true;
    try {
        await interaction.deferUpdate();
        return true;
    } catch (error) {
        logger.debug('Component interaction expired or already acknowledged:', error.message);
        return false;
    }
}

async function sendEphemeralFollowUp(interaction, payload) {
    try {
        await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
    } catch (error) {
        logger.debug('Failed to send ephemeral follow-up:', error.message);
    }
}

function formatTimeRemaining(ms) {
    if (ms <= 0) return 'Due now';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

async function buildDashboardEmbed(configs, guild) {
    const embed = new EmbedBuilder()
        .setTitle('🔄 Multi-Channel Chat Reset Dashboard')
        .setDescription(`Manage automated periodic chat resets for **${guild.name}**.\nConfigure multiple reset channels, 24h timers, or trigger manual resets below.`)
        .setColor(getColor('info'))
        .setTimestamp();

    if (!configs || configs.length === 0) {
        embed.addFields({ name: 'Active Resets', value: '`No channels configured yet. Use the menu below to add one.`', inline: false });
    } else {
        for (let index = 0; index < configs.length; index++) {
            const cfg = configs[index];
            let channelName = 'unknown';
            try {
                const fetchedChan = await guild.channels.fetch(cfg.channelId).catch(() => null);
                if (fetchedChan) channelName = fetchedChan.name;
            } catch (e) {
                // fallback
            }

            const channelDisplay = `<#${cfg.channelId}>`;
            const intervalMs = cfg.intervalMs || (24 * 60 * 60 * 1000);
            const lastResetTime = new Date(cfg.lastReset || Date.now()).getTime();
            const timeLeft = intervalMs - (Date.now() - lastResetTime);
            const countdownStr = formatTimeRemaining(timeLeft);
            const hoursVal = Math.round(intervalMs / (3600 * 1000));

            embed.addFields({
                name: `Slot #${index + 1}: #${channelName}`,
                value: `📺 Channel: ${channelDisplay}\n⏱️ Interval: ${hoursVal} Hour(s)\n⏳ Time Left: ${countdownStr}`,
                inline: false,
            });
        }
    }

    return embed;
}

function buildSelectMenu(guildId, configs) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`chat_reset_cfg_${guildId}`)
        .setPlaceholder('Select an action...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('➕ Add New Reset Channel').setDescription('Configure a new channel for auto-reset').setValue('add_channel').setEmoji('➕')
        );

    configs.forEach((cfg, index) => {
        menu.addOptions(
            new StringSelectMenuOptionBuilder().setLabel(`Manage Slot #${index + 1}`).setDescription(`Change timer or delete slot #${index + 1}`).setValue(`manage_${index}`).setEmoji('⚙️')
        );
    });

    return menu;
}

async function refreshDashboard(rootInteraction, configs, guildId) {
    try {
        const selectMenu = buildSelectMenu(guildId, configs);
        const embed = await buildDashboardEmbed(configs, rootInteraction.guild);
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(selectMenu)],
        });
    } catch (error) {
        logger.debug('Could not refresh multi-channel dashboard:', error.message);
    }
}

export default {
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const settingsKey = `reset_chat_configs_${guildId}`;
            let configs = await getFromDb(settingsKey, []);
            if (typeof configs === 'string') {
                try { configs = JSON.parse(configs); } catch (e) { configs = []; }
            }

            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!interaction.deferred) return;

            const selectMenu = buildSelectMenu(guildId, configs);
            const initialEmbed = await buildDashboardEmbed(configs, interaction.guild);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [initialEmbed],
                components: [new ActionRowBuilder().addComponents(selectMenu)],
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i => i.user.id === interaction.user.id && i.customId === `chat_reset_cfg_${guildId}`,
                time: 600_000,
            });

            collector.on('collect', async selectInteraction => {
                const val = selectInteraction.values[0];
                try {
                    if (val === 'add_channel') {
                        await handleAddChannel(selectInteraction, interaction, configs, settingsKey, client);
                    } else if (val.startsWith('manage_')) {
                        const index = parseInt(val.split('_')[1], 10);
                        await handleManageSlot(selectInteraction, interaction, configs, index, settingsKey, client);
                    }
                } catch (error) {
                    logger.error('Error in multi-channel dashboard selection:', error);
                }
            });
        } catch (error) {
            logger.error('Unexpected error in chat_reset_dashboard module:', error);
            throw new TitanBotError('Dashboard failed', ErrorTypes.UNKNOWN, 'Failed to open the chat reset dashboard.');
        }
    },
};

async function handleAddChannel(selectInteraction, rootInteraction, configs, settingsKey, client) {
    if (!await deferComponent(selectInteraction)) return;

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('chat_reset_add_select')
        .setPlaceholder('Select channel to add for auto-reset...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [new EmbedBuilder().setTitle('➕ Add New Reset Channel').setDescription('Select the text channel you want to add to the auto-reset system (defaults to 24 hours).').setColor(getColor('info'))],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'chat_reset_add_select',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        if (!await deferComponent(chanInteraction)) return;
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'ManageChannels'])) {
            await replyUserError(chanInteraction, { type: ErrorTypes.PERMISSION, message: `I need permissions in ${channel}.` });
            return;
        }

        configs.push({
            channelId: channel.id,
            intervalMs: 24 * 60 * 60 * 1000, // Default 24 hours
            lastReset: new Date().toISOString(),
        });

        await setInDb(settingsKey, configs);
        await sendEphemeralFollowUp(chanInteraction, { embeds: [successEmbed('Channel Added', `Successfully added ${channel} with a 24-hour reset cycle.`)] });
        await refreshDashboard(rootInteraction, configs, rootInteraction.guild.id);
    });
}

async function handleManageSlot(selectInteraction, rootInteraction, configs, index, settingsKey, client) {
    if (!await deferComponent(selectInteraction)) return;
    const cfg = configs[index];
    if (!cfg) return;

    let channelName = 'unknown';
    try {
        const fetchedChan = await rootInteraction.guild.channels.fetch(cfg.channelId).catch(() => null);
        if (fetchedChan) channelName = fetchedChan.name;
    } catch (e) {}

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`slot_reset_${index}`).setLabel('Reset Now').setStyle(ButtonStyle.Danger).setEmoji('⚡'),
        new ButtonBuilder().setCustomId(`slot_24h_${index}`).setLabel('Set to 24h').setStyle(ButtonStyle.Primary).setEmoji('🕒'),
        new ButtonBuilder().setCustomId(`slot_delete_${index}`).setLabel('Delete Slot').setStyle(ButtonStyle.Secondary).setEmoji('🗑️')
    );

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle(`⚙️ Managing Slot #${index + 1} (#${channelName})`)
                .setDescription(`Target Channel: <#${cfg.channelId}>\nChoose an action below for this specific slot:`)
                .setColor(getColor('info'))
        ],
        components: [actionRow],
    });

    const btnCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === selectInteraction.user.id && i.customId.endsWith(`_${index}`),
        time: 60_000,
        max: 1,
    });

    btnCollector.on('collect', async btnInteraction => {
        if (!await deferComponent(btnInteraction)) return;

        if (btnInteraction.customId.startsWith('slot_reset_')) {
            const channel = await rootInteraction.guild.channels.fetch(cfg.channelId).catch(() => null);
            if (channel) {
                const newChannel = await channel.clone({ reason: 'Manual slot reset', position: channel.position });
                await channel.delete('Manual slot reset');
                await newChannel.send({ content: '🔄 **Leaderboard Reset!** A new period has started. Start chatting to climb the leaderboard!' });
                cfg.channelId = newChannel.id;
            }
            cfg.lastReset = new Date().toISOString();
            await setInDb(settingsKey, configs);
            await sendEphemeralFollowUp(btnInteraction, { embeds: [successEmbed('Reset Complete', 'Channel has been reset and timer restarted.')] });
        } else if (btnInteraction.customId.startsWith('slot_24h_')) {
            cfg.intervalMs = 24 * 60 * 60 * 1000;
            cfg.lastReset = new Date().toISOString();
            await setInDb(settingsKey, configs);
            await sendEphemeralFollowUp(btnInteraction, { embeds: [successEmbed('Timer Updated', 'Slot interval has been set to **24 hours**.')] });
        } else if (btnInteraction.customId.startsWith('slot_delete_')) {
            configs.splice(index, 1);
            await setInDb(settingsKey, configs);
            await sendEphemeralFollowUp(btnInteraction, { embeds: [successEmbed('Slot Deleted', 'This reset slot has been removed.')] });
        }

        await refreshDashboard(rootInteraction, configs, rootInteraction.guild.id);
    });
}