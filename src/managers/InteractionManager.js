/**
 * 🎯 Interaction Manager
 *
 * @file src/managers/InteractionManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.10-beta
 *
 * @description
 * Handles all Discord interaction events including slash commands, buttons, modals,
 * autocomplete, and context menu commands. Manages permissions, cooldowns, and error handling.
 */

const {
    Events,
    Collection,
    ButtonStyle,
    MessageFlags,
    EmbedBuilder,
    ButtonBuilder,
    WebhookClient,
    SeparatorBuilder,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorSpacingSize,
} = require('discord.js');
const convertColor = require('../utils/color');
const Sentry = require('@sentry/node');

class InteractionManager {
    /**
     * 🏗️ InteractionManager Constructor
     * @param {Object} client - Discord client instance
     * @param {Object} container - Dependency container
     * @param {Object} handlers - Handler maps from AddonManager
     */
    constructor({ client, container, handlers }) {
        this.client = client;
        this.container = container;
        this.buttonHandlers = handlers.buttonHandlers;
        this.modalHandlers = handlers.modalHandlers;
        this.selectMenuHandlers = handlers.selectMenuHandlers;
        this.autocompleteHandlers = handlers.autocompleteHandlers;
        this.commandCategoryMap = handlers.commandCategoryMap;
        this.categoryToFeatureMap = handlers.categoryToFeatureMap;

        this.kythiaConfig = this.container.kythiaConfig;
        this.models = this.container.models;
        this.helpers = this.container.helpers;

        this.logger = this.container.logger;
        this.t = this.container.t;

        this.ServerSetting = this.models.ServerSetting;
        this.KythiaVoter = this.models.KythiaVoter;
        this.isTeam = this.helpers.discord.isTeam;
        this.isOwner = this.helpers.discord.isOwner;
    }

    /**
     * 🛎️ Initialize Interaction Handler
     * Sets up the main Discord interaction handler for commands, autocomplete, buttons, and modals.
     */
    initialize() {
        function formatPerms(permsArray) {
            return permsArray.map((perm) => perm.replace(/([A-Z])/g, ' $1').trim()).join(', ');
        }

        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                if (interaction.isChatInputCommand()) {
                    await this._handleChatInputCommand(interaction, formatPerms);
                } else if (interaction.isAutocomplete()) {
                    await this._handleAutocomplete(interaction);
                } else if (interaction.isButton()) {
                    await this._handleButton(interaction);
                } else if (interaction.isModalSubmit()) {
                    await this._handleModalSubmit(interaction);
                } else if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
                    await this._handleContextMenuCommand(interaction, formatPerms);
                }
            } catch (error) {
                await this._handleInteractionError(interaction, error);
            }
        });

        this.client.on(Events.AutoModerationActionExecution, async (execution) => {
            try {
                await this._handleAutoModerationAction(execution);
            } catch (err) {
                this.logger.error(`[AutoMod Logger] Error during execution for ${execution.guild.name}:`, err);
            }
        });
    }

    /**
     * Handle chat input commands
     * @private
     */
    async _handleChatInputCommand(interaction, formatPerms) {
        let commandKey = interaction.commandName;
        const group = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);

        if (group) commandKey = `${commandKey} ${group} ${subcommand}`;
        else if (subcommand) commandKey = `${commandKey} ${subcommand}`;

        let command = this.client.commands.get(commandKey);

        if (!command && (subcommand || group)) {
            command = this.client.commands.get(interaction.commandName);
        }
        if (!command) {
            this.logger.error(`Command not found for key: ${commandKey}`);
            return interaction.reply({ content: await this.t(interaction, 'common.error.command.not.found'), ephemeral: true });
        }

        // Feature flag check
        if (interaction.inGuild()) {
            const category = this.commandCategoryMap.get(interaction.commandName);
            const featureFlag = this.categoryToFeatureMap.get(category);

            if (featureFlag && !this.isOwner(interaction.user.id)) {
                const settings = await this.ServerSetting.getCache({ guildId: interaction.guild.id });

                if (settings && Object.prototype.hasOwnProperty.call(settings, featureFlag) && settings[featureFlag] === false) {
                    const featureName = category.charAt(0).toUpperCase() + category.slice(1);
                    const reply = await this.t(interaction, 'common.error.feature.disabled', { feature: featureName });
                    return interaction.reply({ content: reply });
                }
            }
        }

        // Permission checks
        if (command.guildOnly && !interaction.inGuild()) {
            return interaction.reply({ content: await this.t(interaction, 'common.error.guild.only'), ephemeral: true });
        }
        if (command.ownerOnly && !this.isOwner(interaction.user.id)) {
            return interaction.reply({ content: await this.t(interaction, 'common.error.not.owner'), ephemeral: true });
        }
        if (command.teamOnly && !this.isOwner(interaction.user.id)) {
            const isTeamMember = await this.isTeam(interaction.user);
            if (!isTeamMember) return interaction.reply({ content: await this.t(interaction, 'common.error.not.team'), ephemeral: true });
        }
        if (command.permissions && interaction.inGuild()) {
            const missingPerms = interaction.member.permissions.missing(command.permissions);
            if (missingPerms.length > 0)
                return interaction.reply({
                    content: await this.t(interaction, 'common.error.user.missing.perms', { perms: formatPerms(missingPerms) }),
                    ephemeral: true,
                });
        }
        if (command.botPermissions && interaction.inGuild()) {
            const missingPerms = interaction.guild.members.me.permissions.missing(command.botPermissions);
            if (missingPerms.length > 0)
                return interaction.reply({
                    content: await this.t(interaction, 'common.error.bot.missing.perms', { perms: formatPerms(missingPerms) }),
                    ephemeral: true,
                });
        }

        // Vote lock check
        if (command.voteLocked && !this.isOwner(interaction.user.id)) {
            const voter = await this.KythiaVoter.getCache({ userId: interaction.user.id });
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

            if (!voter || voter.votedAt < twelveHoursAgo) {
                const container = new ContainerBuilder().setAccentColor(
                    convertColor(this.kythiaConfig.bot.color, { from: 'hex', to: 'decimal' })
                );
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await this.t(interaction, 'common.error.vote.locked.text'))
                );
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel(
                                await this.t(interaction, 'common.error.vote.locked.button', {
                                    botName: interaction.client.user.username,
                                })
                            )
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://top.gg/bot/${this.kythiaConfig.bot.clientId}/vote`)
                    )
                );
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await this.t(interaction, 'common.container.footer'))
                );
                return interaction.reply({
                    components: [container],
                    ephemeral: true,
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
                });
            }
        }

        // Cooldown check
        const cooldownDuration = command.cooldown ?? this.kythiaConfig.bot.globalCommandCooldown ?? 0;

        if (cooldownDuration > 0 && !this.isOwner(interaction.user.id)) {
            const { cooldowns } = this.client;

            if (!cooldowns.has(command.name)) {
                cooldowns.set(command.name, new Collection());
            }

            const now = Date.now();
            const timestamps = cooldowns.get(command.name);
            const cooldownAmount = cooldownDuration * 1000;

            if (timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    const reply = await this.t(interaction, 'common.error.cooldown', { time: timeLeft.toFixed(1) });
                    return interaction.reply({ content: reply, ephemeral: true });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
        }

        await command.execute(interaction, this.container);
    }

    /**
     * Handle autocomplete interactions
     * @private
     */
    async _handleAutocomplete(interaction) {
        let commandKey = interaction.commandName;
        const group = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);

        if (group) commandKey = `${commandKey} ${group} ${subcommand}`;
        else if (subcommand) commandKey = `${commandKey} ${subcommand}`;

        let handler = this.autocompleteHandlers.get(commandKey);

        if (!handler && (subcommand || group)) {
            handler = this.autocompleteHandlers.get(interaction.commandName);
        }

        if (handler) {
            try {
                await handler(interaction, this.container);
            } catch (err) {
                this.logger.error(`Error in autocomplete handler for ${commandKey}:`, err);
                try {
                    await interaction.respond([]);
                } catch (e) {}
            }
        } else {
            try {
                await interaction.respond([]);
            } catch (e) {}
        }
    }

    /**
     * Handle button interactions
     * @private
     */
    async _handleButton(interaction) {
        const handler = this.buttonHandlers.get(interaction.customId.split('_')[0]);
        if (handler) await handler(interaction, this.container);
    }

    /**
     * Handle modal submit interactions
     * @private
     */
    async _handleModalSubmit(interaction) {
        // Handle both | and : separators for modal custom IDs
        const customIdPrefix = interaction.customId.includes('|') ? interaction.customId.split('|')[0] : interaction.customId.split(':')[0];
        this.logger.info('Modal submit - customId:', interaction.customId, 'prefix:', customIdPrefix);
        const handler = this.modalHandlers.get(customIdPrefix);
        this.logger.info('Modal handler found:', !!handler);
        if (handler) await handler(interaction, this.container);
    }

    /**
     * Handle context menu commands
     * @private
     */
    async _handleContextMenuCommand(interaction, formatPerms) {
        const command = this.client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.guildOnly && !interaction.inGuild()) {
            return interaction.reply({ content: await this.t(interaction, 'common.error.guild.only'), ephemeral: true });
        }
        if (command.ownerOnly && !this.isOwner(interaction.user.id)) {
            return interaction.reply({ content: await this.t(interaction, 'common.error.not.owner'), ephemeral: true });
        }
        if (command.teamOnly && !this.isOwner(interaction.user.id)) {
            const isTeamMember = await this.isTeam(interaction.user);
            if (!isTeamMember) return interaction.reply({ content: await this.t(interaction, 'common.error.not.team'), ephemeral: true });
        }
        if (command.permissions && interaction.inGuild()) {
            const missingPerms = interaction.member.permissions.missing(command.permissions);
            if (missingPerms.length > 0)
                return interaction.reply({
                    content: await this.t(interaction, 'common.error.user.missing.perms', { perms: formatPerms(missingPerms) }),
                    ephemeral: true,
                });
        }
        if (command.botPermissions && interaction.inGuild()) {
            const missingPerms = interaction.guild.members.me.permissions.missing(command.botPermissions);
            if (missingPerms.length > 0)
                return interaction.reply({
                    content: await this.t(interaction, 'common.error.bot.missing.perms', { perms: formatPerms(missingPerms) }),
                    ephemeral: true,
                });
        }
        if (command.isInMainGuild && !this.isOwner(interaction.user.id)) {
            const mainGuild = this.client.guilds.cache.get(this.kythiaConfig.bot.mainGuildId);
            if (!mainGuild) {
                this.logger.error(
                    `❌ [isInMainGuild Check] Error: Bot is not a member of the main guild specified in config: ${this.kythiaConfig.bot.mainGuildId}`
                );
            }
            try {
                await mainGuild.members.fetch(interaction.user.id);
            } catch (error) {
                const container = new ContainerBuilder().setAccentColor(
                    convertColor(this.kythiaConfig.bot.color, { from: 'hex', to: 'decimal' })
                );
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        await this.t(interaction, 'common.error.not.in.main.guild.text', { name: mainGuild.name })
                    )
                );
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel(await this.t(interaction, 'common.error.not.in.main.guild.button.join'))
                            .setStyle(ButtonStyle.Link)
                            .setURL(this.kythiaConfig.settings.supportServer)
                    )
                );
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        await this.t(interaction, 'common.container.footer', { username: interaction.client.user.username })
                    )
                );
                return interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
                });
            }
        }
        if (command.voteLocked && !this.isOwner(interaction.user.id)) {
            const voter = await this.KythiaVoter.getCache({ userId: interaction.user.id });
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

            if (!voter || voter.votedAt < twelveHoursAgo) {
                const container = new ContainerBuilder().setAccentColor(
                    convertColor(this.kythiaConfig.bot.color, { from: 'hex', to: 'decimal' })
                );
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await this.t(interaction, 'common.error.vote.locked.text'))
                );
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel(
                                await this.t(interaction, 'common.error.vote.locked.button', {
                                    username: interaction.client.user.username,
                                })
                            )
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://top.gg/bot/${this.kythiaConfig.bot.clientId}/vote`)
                    )
                );
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        await this.t(interaction, 'common.container.footer', { username: interaction.client.user.username })
                    )
                );
                return interaction.reply({
                    components: [container],
                    ephemeral: true,
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
                });
            }
        }

        await command.execute(interaction, this.container);
    }

    /**
     * Handle AutoModeration action execution
     * @private
     */
    async _handleAutoModerationAction(execution) {
        const guildId = execution.guild.id;
        const ruleName = execution.ruleTriggerType.toString();

        const settings = await this.ServerSetting.getCache({ guildId: guildId });
        const locale = execution.guild.preferredLocale;

        if (!settings || !settings.modLogChannelId) {
            return;
        }

        const logChannelId = settings.modLogChannelId;
        const logChannel = await execution.guild.channels.fetch(logChannelId).catch(() => null);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(
                    await this.t(
                        null,
                        'common.automod',
                        {
                            ruleName: ruleName,
                        },
                        locale
                    )
                )
                .addFields(
                    {
                        name: await this.t(null, 'common.automod.field.user', {}, locale),
                        value: `${execution.user.tag} (${execution.userId})`,
                        inline: true,
                    },
                    { name: await this.t(null, 'common.automod.field.rule.trigger', {}, locale), value: `\`${ruleName}\``, inline: true }
                )
                .setFooter({
                    text: await this.t(
                        null,
                        'common.embed.footer',
                        {
                            username: execution.guild.client.user.username,
                        },
                        locale
                    ),
                })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        }
    }

    /**
     * Handle interaction errors
     * @private
     */
    async _handleInteractionError(interaction, error) {
        this.logger.error(`Error in interaction handler for ${interaction.user.tag}:`, error);

        if (this.kythiaConfig.sentry && this.kythiaConfig.sentry.dsn) {
            Sentry.withScope((scope) => {
                scope.setUser({ id: interaction.user.id, username: interaction.user.tag });
                scope.setTag('command', interaction.commandName);
                if (interaction.guild) {
                    scope.setContext('guild', {
                        id: interaction.guild.id,
                        name: interaction.guild.name,
                    });
                }
                Sentry.captureException(error);
            });
        }

        const ownerFirstId = this.kythiaConfig.owner.ids.split(',')[0].trim();
        const components = [
            new ContainerBuilder()
                .setAccentColor(convertColor('Red', { from: 'discord', to: 'decimal' }))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(await this.t(interaction, 'common.error.generic')))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel(await this.t(interaction, 'common.error.button.join.support.server'))
                            .setURL(this.kythiaConfig.settings.supportServer),
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel(await this.t(interaction, 'common.error.button.contact.owner'))
                            .setURL(`discord://-/users/${ownerFirstId}`)
                    )
                ),
        ];
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    components,
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    components,
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
                    ephemeral: true,
                });
            }
        } catch (e) {
            this.logger.error('Failed to send interaction error message:', e);
        }

        try {
            if (
                this.kythiaConfig.api &&
                this.kythiaConfig.api.webhookErrorLogs &&
                this.kythiaConfig.settings &&
                this.kythiaConfig.settings.webhookErrorLogs === true
            ) {
                const webhookClient = new WebhookClient({ url: this.kythiaConfig.api.webhookErrorLogs });
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(`## ❌ Error at ${interaction.user.tag}\n` + `\`\`\`${error.stack}\`\`\``)
                    .setFooter({ text: interaction.guild ? `Error from server ${interaction.guild.name}` : 'Error from DM' })
                    .setTimestamp();
                await webhookClient.send({ embeds: [errorEmbed] });
            }
        } catch (webhookErr) {
            this.logger.error('Error sending interaction error webhook:', webhookErr);
        }
    }
}

module.exports = InteractionManager;
