import { getColor } from '../../../config/bot.js';
import {
    SlashCommandBuilder,
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
    if (interaction.deferred || interaction.replied) {
        return true;
    }
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
        await interaction.followUp({
            ...payload,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logger.debug('Failed to send ephemeral follow-up:', error.message);
    }
}

function buildDashboardEmbed(cfg, guild) {
    const channelDisplay = cfg.channelId ? `<#${cfg.channelId}>` : '`Not set`';
    const intervalMinutes = cfg.intervalMs ? Math.round(cfg.intervalMs / 60000) : '`Not set`';

    return new EmbedBuilder()
        .setTitle('🔄 Chat Reset System Dashboard')
        .setDescription(
            `Manage automated periodic chat resets for **${guild.name}**.\nUse the controls below to configure the target channel and reset intervals.`,
        )
        .setColor(getColor('info'))
        .addFields(
            { name: 'Reset Channel', value: channelDisplay, inline: true },
            { name: 'Status', value: cfg.channelId ? 'Active' : 'Disabled', inline: true },
            { name: 'Interval', value: `${intervalMinutes} minute(s)`, inline: true },
        )
        .setFooter({ text: 'Dashboard closes after 10 minutes of inactivity' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`chat_reset_cfg_${guildId}`)
        .setPlaceholder('Select a setting to configure...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Target Channel')
                .setDescription('Select the channel to automatically reset')
                .setValue('reset_channel')
                .setEmoji('📺'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Reset Interval')
                .setDescription('Set how often the channel resets (in minutes)')
                .setValue('reset_interval')
                .setEmoji('⏱️'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false) {
    const isActive = Boolean(cfg.channelId && cfg.intervalMs);
    
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`chat_reset_trigger_now_${guildId}`)
                .setLabel('Reset Now')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚡')
                .setDisabled(!isActive || disabled),
        ),
    ];
}

async function refreshDashboard(rootInteraction, cfg, guildId) {
    try {
        const selectMenu = buildSelectMenu(guildId);
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [buildDashboardEmbed(cfg, rootInteraction.guild)],
            components: [
                ...buildButtonRow(cfg, guildId),
                new ActionRowBuilder().addComponents(selectMenu),
            ],
        });
    } catch (error) {
        logger.debug('Could not refresh chat reset dashboard:', error.message);
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('chat-reset-dashboard')
        .setDescription('Open the interactive dashboard to manage automated chat resets.'),
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const settingsKey = `reset_chat_config_${guildId}`;
            let cfg = await getFromDb(settingsKey, { channelId: null, intervalMs: null, lastReset: new Date().toISOString() });
            if (typeof cfg === 'string') {
                try { cfg = JSON.parse(cfg); } catch (e) { cfg = { channelId: null, intervalMs: null }; }
            }

            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!interaction.deferred) return;

            const selectMenu = buildSelectMenu(guildId);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildDashboardEmbed(cfg, interaction.guild)],
                components: [
                    ...buildButtonRow(cfg, guildId),
                    new ActionRowBuilder().addComponents(selectMenu),
                ],
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i => i.user.id === interaction.user.id && i.customId === `chat_reset_cfg_${guildId}`,
                time: 600_000,
            });

            collector.on('collect', async selectInteraction => {
                const selectedOption = selectInteraction.values[0];
                try {
                    if (selectedOption === 'reset_channel') {
                        await handleResetChannel(selectInteraction, interaction, cfg, settingsKey, client);
                    } else if (selectedOption === 'reset_interval') {
                        await handleResetInterval(selectInteraction, interaction, cfg, settingsKey, client);
                    }
                } catch (error) {
                    logger.error('Error in chat reset dashboard selection:', error);
                    await replyUserError(selectInteraction, {
                        type: ErrorTypes.CONFIGURATION,
                        message: 'An error occurred while updating the configuration.',
                    }).catch(() => {});
                }
            });

            const btnCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id && i.customId === `chat_reset_trigger_now_${guildId}`,
                time: 600_000,
            });

            btnCollector.on('collect', async btnInteraction => {
                try {
                    if (!await deferComponent(btnInteraction)) return;

                    const channel = interaction.guild.channels.cache.get(cfg.channelId);
                    if (!channel) {
                        await sendEphemeralFollowUp(btnInteraction, { content: '❌ Target reset channel could not be found.' });
                        return;
                    }

                    const newChannel = await channel.clone({
                        reason: 'Manual dashboard chat reset trigger',
                        position: channel.position
                    });
                    await channel.delete('Manual dashboard chat reset trigger');

                    await newChannel.send({
                        content: '🔄 **Leaderboard Reset!** A new automated period has started. Start chatting to climb the leaderboard!'
                    });

                    cfg.channelId = newChannel.id;
                    cfg.lastReset = new Date().toISOString();
                    await setInDb(settingsKey, cfg);

                    await sendEphemeralFollowUp(btnInteraction, {
                        embeds: [successEmbed('⚡ Channel Reset', `Successfully cleared and reset ${newChannel}.`)],
                    });

                    await refreshDashboard(interaction, cfg, guildId);
                } catch (error) {
                    logger.error('Error triggering manual chat reset:', error);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    btnCollector.stop();
                    try {
                        await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('Dashboard Timed Out')
                                    .setDescription('This dashboard has been closed due to inactivity. Please run the command again.')
                                    .setColor(getColor('error'))
                            ],
                            components: [],
                        });
                    } catch (error) {
                        logger.debug('Could not update dashboard on timeout:', error.message);
                    }
                }
            });
        } catch (error) {
            logger.error('Unexpected error in chat_reset_dashboard:', error);
            throw new TitanBotError('Dashboard failed', ErrorTypes.UNKNOWN, 'Failed to open the chat reset dashboard.');
        }
    },
};

async function handleResetChannel(selectInteraction, rootInteraction, cfg, settingsKey, client) {
    if (!await deferComponent(selectInteraction)) return;

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('chat_reset_channel_select')
        .setPlaceholder('Select a text channel...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await sendEphemeralFollowUp(selectInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle('📺 Target Reset Channel')
                .setDescription(`**Current:** ${cfg.channelId ? `<#${cfg.channelId}>` : '`Not set`'}\n\nSelect the text channel you want to automatically reset.`)
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'chat_reset_channel_select',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        if (!await deferComponent(chanInteraction)) return;
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'ManageChannels'])) {
            await replyUserError(chanInteraction, {
                type: ErrorTypes.PERMISSION,
                message: `I need **View Channel**, **Send Messages**, and **Manage Channels** in ${channel} to clone and delete it.`,
            });
            return;
        }

        cfg.channelId = channel.id;
        cfg.lastReset = new Date().toISOString();
        await setInDb(settingsKey, cfg);

        await sendEphemeralFollowUp(chanInteraction, {
            embeds: [successEmbed('Channel Updated', `Chat resets will now target ${channel}.`)],
        });

        await refreshDashboard(rootInteraction, cfg, rootInteraction.guild.id);
    });
}

async function handleResetInterval(selectInteraction, rootInteraction, cfg, settingsKey, client) {
    const modal = new ModalBuilder()
        .setCustomId('chat_reset_interval_modal')
        .setTitle('Configure Reset Interval')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('interval_input')
                    .setLabel('Interval in Minutes (e.g. 60 for 1 hour)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(cfg.intervalMs ? String(Math.round(cfg.intervalMs / 60000)) : '60')
                    .setRequired(true),
            ),
        );

    try {
        await selectInteraction.showModal(modal);
    } catch {
        return;
    }

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'chat_reset_interval_modal' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const minutes = parseInt(submitted.fields.getTextInputValue('interval_input'), 10);
    if (isNaN(minutes) || minutes <= 0) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Please enter a valid positive number of minutes.' });
        return;
    }

    cfg.intervalMs = minutes * 60 * 1000;
    cfg.lastReset = new Date().toISOString();
    await setInDb(settingsKey, cfg);

    await submitted.reply({
        embeds: [successEmbed('Interval Updated', `Chat will now automatically reset every **${minutes}** minute(s).`)],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, cfg, rootInteraction.guild.id);
}