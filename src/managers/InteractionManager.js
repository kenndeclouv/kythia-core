/**
 * 🎯 Interaction Manager
 *
 * @file src/managers/InteractionManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
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

		this.middlewareManager = this.container.middlewareManager;

		this.ServerSetting = this.models.ServerSetting;
		this.KythiaVoter = this.models.KythiaVoter;
		this.isTeam = this.helpers.discord.isTeam;
		this.isOwner = this.helpers.discord.isOwner;

		if (!this.client.restartNoticeCooldowns) {
			this.client.restartNoticeCooldowns = new Collection();
		}
	}

	/**
	 * 🛎️ Initialize Interaction Handler
	 * Sets up the main Discord interaction handler for commands, autocomplete, buttons, and modals.
	 */
	initialize() {
		this.client.on(Events.InteractionCreate, async (interaction) => {
			try {
				if (interaction.isChatInputCommand()) {
					await this._handleChatInputCommand(interaction);
				} else if (interaction.isAutocomplete()) {
					await this._handleAutocomplete(interaction);
				} else if (interaction.isButton()) {
					await this._handleButton(interaction);
				} else if (interaction.isModalSubmit()) {
					await this._handleModalSubmit(interaction);
				} else if (interaction.isAnySelectMenu()) {
					await this._handleSelectMenu(interaction);
				} else if (
					interaction.isUserContextMenuCommand() ||
					interaction.isMessageContextMenuCommand()
				) {
					await this._handleContextMenuCommand(interaction);
				}
			} catch (error) {
				await this._handleInteractionError(interaction, error);
			}
		});

		this.client.on(Events.AutoModerationActionExecution, async (execution) => {
			try {
				await this._handleAutoModerationAction(execution);
			} catch (err) {
				this.logger.error(
					`[AutoMod Logger] Error during execution for ${execution.guild.name}:`,
					err,
				);
			}
		});
	}

	/**
	 * Handle chat input commands
	 * @private
	 */
	async _handleChatInputCommand(interaction) {
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
			return interaction.reply({
				content: await this.t(interaction, 'common.error.command.not.found'),
				flags: MessageFlags.Ephemeral,
			});
		}

		// if (interaction.inGuild()) {
		// 	const category = this.commandCategoryMap.get(interaction.commandName);
		// 	const featureFlag = this.categoryToFeatureMap.get(category);

		// 	if (featureFlag && !this.isOwner(interaction.user.id)) {
		// 		const settings = await this.ServerSetting.getCache({
		// 			guildId: interaction.guild.id,
		// 		});

		// 		if (
		// 			settings &&
		// 			Object.hasOwn(settings, featureFlag) &&
		// 			settings[featureFlag] === false
		// 		) {
		// 			const featureName =
		// 				category.charAt(0).toUpperCase() + category.slice(1);
		// 			const reply = await this.t(
		// 				interaction,
		// 				'common.error.feature.disabled',
		// 				{ feature: featureName },
		// 			);
		// 			return interaction.reply({ content: reply });
		// 		}
		// 	}
		// }

		const canRun = await this.middlewareManager.handle(interaction, command);
		if (!canRun) return;

		if (typeof command.execute === 'function') {
			if (!interaction.logger) {
				interaction.logger = this.logger;
			}

			if (this.container && !this.container.logger) {
				this.container.logger = this.logger;
			}
			if (command.execute.length === 2) {
				await command.execute(interaction, this.container);
			} else {
				await command.execute(interaction);
			}

			await this._checkRestartSchedule(interaction);
		} else {
			this.logger.error(
				"Command doesn't have a valid 'execute' function:",
				command.name || commandKey,
			);
			return interaction.reply({
				content: await this.t(
					interaction,
					'common.error.command.execution.invalid',
				),
				flags: MessageFlags.Ephemeral,
			});
		}
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
				this.logger.error(
					`Error in autocomplete handler for ${commandKey}:`,
					err,
				);
				try {
					await interaction.respond([]);
				} catch (e) {
					this.logger.error(e);
				}
			}
		} else {
			try {
				await interaction.respond([]);
			} catch (e) {
				this.logger.error(e);
			}
		}
	}

	/**
	 * Handle button interactions
	 * @private
	 */
	async _handleButton(interaction) {
		const customIdPrefix = interaction.customId.includes('|')
			? interaction.customId.split('|')[0]
			: interaction.customId.split(':')[0];

		const handler = this.buttonHandlers.get(customIdPrefix);

		if (handler) {
			if (
				typeof handler === 'object' &&
				typeof handler.execute === 'function'
			) {
				await handler.execute(interaction, this.container);
			} else if (typeof handler === 'function') {
				if (handler.length === 2) {
					await handler(interaction, this.container);
				} else {
					await handler(interaction);
				}
			} else {
				this.logger.error(
					`Handler for button ${customIdPrefix} has an invalid format`,
				);
			}
		}
	}

	/**
	 * Handle modal submit interactions
	 * @private
	 */
	async _handleModalSubmit(interaction) {
		const customIdPrefix = interaction.customId.includes('|')
			? interaction.customId.split('|')[0]
			: interaction.customId.split(':')[0];

		this.logger.info(
			`Modal submit - customId: ${interaction.customId}, prefix: ${customIdPrefix}`,
		);

		const handler = this.modalHandlers.get(customIdPrefix);
		this.logger.info(`Modal handler found: ${!!handler}`);

		if (handler) {
			if (
				typeof handler === 'object' &&
				typeof handler.execute === 'function'
			) {
				await handler.execute(interaction, this.container);
			} else if (typeof handler === 'function') {
				if (handler.length === 2) {
					await handler(interaction, this.container);
				} else {
					await handler(interaction);
				}
			} else {
				this.logger.error(
					`Handler for modal ${customIdPrefix} has an invalid format (not a function or { execute: ... })`,
				);
			}
		}
	}

	/**
	 * Handle select menu interactions
	 * @private
	 */
	async _handleSelectMenu(interaction) {
		const customIdPrefix = interaction.customId.includes('|')
			? interaction.customId.split('|')[0]
			: interaction.customId.split(':')[0];

		this.logger.info(
			`Select menu submit - customId: ${interaction.customId}, prefix: ${customIdPrefix}`,
		);

		const handler = this.selectMenuHandlers.get(customIdPrefix);
		this.logger.info(`Select menu handler found: ${!!handler}`);

		if (handler) {
			if (
				typeof handler === 'object' &&
				typeof handler.execute === 'function'
			) {
				await handler.execute(interaction, this.container);
			} else if (typeof handler === 'function') {
				if (handler.length === 2) {
					await handler(interaction, this.container);
				} else {
					await handler(interaction);
				}
			} else {
				this.logger.error(
					`Handler for select menu ${customIdPrefix} has an invalid format`,
				);
			}
		}
	}

	/**
	 * Handle context menu commands
	 * @private
	 */
	async _handleContextMenuCommand(interaction) {
		const command = this.client.commands.get(interaction.commandName);
		if (!command) return;

		const canRun = await this.middlewareManager.handle(interaction, command);
		if (!canRun) return;

		if (!interaction.logger) {
			interaction.logger = this.logger;
		}
		if (this.container && !this.container.logger) {
			this.container.logger = this.logger;
		}

		await this._checkRestartSchedule(interaction);

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
		const logChannel = await execution.guild.channels
			.fetch(logChannelId)
			.catch(() => null);

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
						locale,
					),
				)
				.addFields(
					{
						name: await this.t(null, 'common.automod.field.user', {}, locale),
						value: `${execution.user.tag} (${execution.userId})`,
						inline: true,
					},
					{
						name: await this.t(
							null,
							'common.automod.field.rule.trigger',
							{},
							locale,
						),
						value: `\`${ruleName}\``,
						inline: true,
					},
				)
				.setFooter({
					text: await this.t(
						null,
						'common.embed.footer',
						{
							username: execution.guild.client.user.username,
						},
						locale,
					),
				})
				.setTimestamp();

			await logChannel.send({ embeds: [embed] });
		}
	}

	/**
	 * Check for scheduled restart and notify user
	 * @private
	 */
	async _checkRestartSchedule(interaction) {
		const restartTs = this.client.kythiaRestartTimestamp;

		if (!restartTs || interaction.commandName === 'restart') return;

		const userId = interaction.user.id;
		const cooldowns = this.client.restartNoticeCooldowns;
		const now = Date.now();
		const cooldownTime = 5 * 60 * 1000;

		if (cooldowns.has(userId)) {
			const lastNotified = cooldowns.get(userId);
			if (now - lastNotified < cooldownTime) {
				return;
			}
		}

		const timeLeft = restartTs - now;

		if (timeLeft > 0) {
			try {
				const timeString = `<t:${Math.floor(restartTs / 1000)}:R>`;
				// TODO: Add translation
				const msg = `## ⚠️ System Notice\nKythia is scheduled to restart **${timeString}**.`;

				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: msg,
						flags: MessageFlags.Ephemeral,
					});

					cooldowns.set(userId, now);

					setTimeout(() => cooldowns.delete(userId), cooldownTime);
				}
			} catch (err) {
				this.logger.error(err);
			}
		}
	}

	/**
	 * Handle interaction errors
	 * @private
	 */
	async _handleInteractionError(interaction, error) {
		this.logger.error(
			`Error in interaction handler for ${interaction.user.tag}:`,
			error,
		);

		if (this.kythiaConfig.sentry?.dsn) {
			Sentry.withScope((scope) => {
				scope.setUser({
					id: interaction.user.id,
					username: interaction.user.tag,
				});
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
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						await this.t(interaction, 'common.error.generic'),
					),
				)
				.addSeparatorComponents(
					new SeparatorBuilder()
						.setSpacing(SeparatorSpacingSize.Small)
						.setDivider(true),
				)
				.addActionRowComponents(
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setStyle(ButtonStyle.Link)
							.setLabel(
								await this.t(
									interaction,
									'common.error.button.join.support.server',
								),
							)
							.setURL(this.kythiaConfig.settings.supportServer),
						new ButtonBuilder()
							.setStyle(ButtonStyle.Link)
							.setLabel(
								await this.t(interaction, 'common.error.button.contact.owner'),
							)
							.setURL(`https://discord.com/users/${ownerFirstId}`),
					),
				),
		];
		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					components,
					flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
				});
			} else {
				await interaction.reply({
					components,
					flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
				});
			}
		} catch (e) {
			this.logger.error('Failed to send interaction error message:', e);
		}

		try {
			if (
				this.kythiaConfig.api?.webhookErrorLogs &&
				this.kythiaConfig.settings &&
				this.kythiaConfig.settings.webhookErrorLogs === true
			) {
				const webhookClient = new WebhookClient({
					url: this.kythiaConfig.api.webhookErrorLogs,
				});
				const errorEmbed = new EmbedBuilder()
					.setColor('Red')
					.setDescription(
						`## ❌ Error at ${interaction.user.tag}\n` +
							`\`\`\`${error.stack}\`\`\``,
					)
					.setFooter({
						text: interaction.guild
							? `Error from server ${interaction.guild.name}`
							: 'Error from DM',
					})
					.setTimestamp();
				await webhookClient.send({ embeds: [errorEmbed] });
			}
		} catch (webhookErr) {
			this.logger.error('Error sending interaction error webhook:', webhookErr);
		}
	}
}

module.exports = InteractionManager;
