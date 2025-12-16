/**
 * 🎯 Interaction Manager
 *
 * @file src/managers/InteractionManager.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.1-beta
 *
 * @description
 * Handles all Discord interaction events including slash commands, buttons, modals,
 * autocomplete, and context menu commands. Manages permissions, cooldowns, and error handling.
 */

import {
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
	type Interaction,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
	type ButtonInteraction,
	type ModalSubmitInteraction,
	type AnySelectMenuInteraction,
	type UserContextMenuCommandInteraction,
	type MessageContextMenuCommandInteraction,
	type AutoModerationActionExecution,
} from 'discord.js';
import * as Sentry from '@sentry/node';
import type { KythiaClient } from '../types/KythiaClient';
import type { KythiaContainer } from '../types/KythiaContainer';
import type {
	IInteractionManager,
	InteractionManagerHandlers,
} from '../types/InteractionManager';
import type {
	KythiaButtonHandler,
	KythiaModalHandler,
	KythiaSelectMenuHandler,
	KythiaAutocompleteHandler,
} from '../types/AddonManager';
import type { KythiaConfig } from '../types/KythiaConfig';

import { convertColor } from '../utils';

export class InteractionManager implements IInteractionManager {
	public client: KythiaClient;
	public container: KythiaContainer;

	public buttonHandlers: Map<string, KythiaButtonHandler>;
	public modalHandlers: Map<string, KythiaModalHandler>;
	public selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
	public autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
	public commandCategoryMap: Map<string, string>;
	public categoryToFeatureMap: Map<string, string>;

	public kythiaConfig: KythiaConfig;
	public models: any;
	public helpers: any;
	public logger: any;
	public t: any;
	public middlewareManager: any;

	public ServerSetting: any;
	public KythiaVoter: any;

	public isTeam: (userId: string) => Promise<boolean>;
	public isOwner: (userId: string) => boolean;

	/**
	 * 🏗️ InteractionManager Constructor
	 * @param {Object} client - Discord client instance
	 * @param {Object} container - Dependency container
	 * @param {Object} handlers - Handler maps from AddonManager
	 */
	constructor({
		client,
		container,
		handlers,
	}: {
		client: KythiaClient;
		container: KythiaContainer;
		handlers: InteractionManagerHandlers;
	}) {
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
	public initialize(): void {
		this.client.on(
			Events.InteractionCreate,
			async (interaction: Interaction) => {
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
			},
		);

		this.client.on(
			Events.AutoModerationActionExecution,
			async (execution: AutoModerationActionExecution) => {
				try {
					await this._handleAutoModerationAction(execution);
				} catch (err) {
					this.logger.error(
						`[AutoMod Logger] Error during execution for ${execution.guild.name}:`,
						err,
					);
				}
			},
		);
	}

	/**
	 * Handle chat input commands
	 * @private
	 */
	private async _handleChatInputCommand(
		interaction: ChatInputCommandInteraction,
	): Promise<void> {
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
			await interaction.reply({
				content: await this.t(interaction, 'common.error.command.not.found'),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (this.middlewareManager) {
			const canRun = await this.middlewareManager.handle(interaction, command);
			if (!canRun) return;
		}

		if (typeof command.execute === 'function') {
			if (!(interaction as any).logger) {
				(interaction as any).logger = this.logger;
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
			await interaction.reply({
				content: await this.t(
					interaction,
					'common.error.command.execution.invalid',
				),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
	}

	private async _handleAutocomplete(
		interaction: AutocompleteInteraction,
	): Promise<void> {
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
			} catch (_e) {}
		} else {
			try {
				await interaction.respond([]);
			} catch (e) {
				this.logger.error(e);
			}
		}
	}

	private async _handleButton(interaction: ButtonInteraction): Promise<void> {
		const customIdPrefix = interaction.customId.includes('|')
			? interaction.customId.split('|')[0]
			: interaction.customId.split(':')[0];

		const handler = this.buttonHandlers.get(customIdPrefix);

		if (handler) {
			const handlerFunc = handler as unknown as Function;

			if (
				typeof handler === 'object' &&
				typeof (handler as any).execute === 'function'
			) {
				await (handler as any).execute(interaction, this.container);
			} else if (typeof handler === 'function') {
				if (handlerFunc.length === 2) {
					await handler(interaction, this.container);
				} else {
					await (handler as any)(interaction);
				}
			} else {
				this.logger.error(
					`Handler for button ${customIdPrefix} has an invalid format`,
				);
			}
		}
	}

	private async _handleModalSubmit(
		interaction: ModalSubmitInteraction,
	): Promise<void> {
		const customIdPrefix = interaction.customId.includes('|')
			? interaction.customId.split('|')[0]
			: interaction.customId.split(':')[0];

		this.logger.info(
			`Modal submit - customId: ${interaction.customId}, prefix: ${customIdPrefix}`,
		);

		const handler = this.modalHandlers.get(customIdPrefix);
		this.logger.info(`Modal handler found: ${!!handler}`);

		if (handler) {
			const handlerFunc = handler as unknown as Function;

			if (
				typeof handler === 'object' &&
				typeof (handler as any).execute === 'function'
			) {
				await (handler as any).execute(interaction, this.container);
			} else if (typeof handler === 'function') {
				if (handlerFunc.length === 2) {
					await handler(interaction, this.container);
				} else {
					await (handler as any)(interaction);
				}
			} else {
				this.logger.error(
					`Handler for modal ${customIdPrefix} has an invalid format`,
				);
			}
		}
	}

	private async _handleSelectMenu(
		interaction: AnySelectMenuInteraction,
	): Promise<void> {
		const customIdPrefix = interaction.customId.includes('|')
			? interaction.customId.split('|')[0]
			: interaction.customId.split(':')[0];

		this.logger.info(
			`Select menu submit - customId: ${interaction.customId}, prefix: ${customIdPrefix}`,
		);

		const handler = this.selectMenuHandlers.get(customIdPrefix);
		this.logger.info(`Select menu handler found: ${!!handler}`);

		if (handler) {
			const handlerFunc = handler as unknown as Function;

			if (
				typeof handler === 'object' &&
				typeof (handler as any).execute === 'function'
			) {
				await (handler as any).execute(interaction, this.container);
			} else if (typeof handler === 'function') {
				if (handlerFunc.length === 2) {
					await handler(interaction, this.container);
				} else {
					await (handler as any)(interaction);
				}
			} else {
				this.logger.error(
					`Handler for select menu ${customIdPrefix} has an invalid format`,
				);
			}
		}
	}

	private async _handleContextMenuCommand(
		interaction:
			| UserContextMenuCommandInteraction
			| MessageContextMenuCommandInteraction,
	): Promise<void> {
		const command = this.client.commands.get(interaction.commandName);
		if (!command) return;

		if (this.middlewareManager) {
			const canRun = await this.middlewareManager.handle(interaction, command);
			if (!canRun) return;
		}

		if (!(interaction as any).logger) {
			(interaction as any).logger = this.logger;
		}
		if (this.container && !this.container.logger) {
			this.container.logger = this.logger;
		}

		await this._checkRestartSchedule(interaction);

		await command.execute(interaction, this.container);
	}

	private async _handleAutoModerationAction(
		execution: AutoModerationActionExecution,
	): Promise<void> {
		const guildId = execution.guild.id;
		const ruleName = execution.ruleTriggerType.toString();

		const settings = await (this.ServerSetting as any).getCache({
			guildId: guildId,
		});
		const locale = execution.guild.preferredLocale;

		if (!settings || !settings.modLogChannelId) {
			return;
		}

		const logChannelId = settings.modLogChannelId;
		const logChannel = await execution.guild.channels
			.fetch(logChannelId)
			.catch(() => null);

		if (logChannel?.isTextBased()) {
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
						value: `${execution.user?.tag} (${execution.userId})`,
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

	private async _checkRestartSchedule(interaction: Interaction): Promise<void> {
		if (!interaction.isRepliable()) return;

		const restartTs = (this.client as any).kythiaRestartTimestamp;

		if (!restartTs || (interaction as any).commandName === 'restart') return;

		const userId = interaction.user.id;
		const cooldowns = this.client.restartNoticeCooldowns;

		if (!cooldowns) return;

		const now = Date.now();
		const cooldownTime = 5 * 60 * 1000;

		if (cooldowns.has(userId)) {
			const lastNotified = cooldowns.get(userId) || 0;
			if (now - lastNotified < cooldownTime) {
				return;
			}
		}

		const timeLeft = restartTs - now;

		if (timeLeft > 0) {
			try {
				const timeString = `<t:${Math.floor(restartTs / 1000)}:R>`;
				const msg = `## ⚠️ System Notice\nKythia is scheduled to restart **${timeString}**.\n-# Kythia is originally created by kenndeclouv`;

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

	private async _handleInteractionError(
		interaction: Interaction,
		error: any,
	): Promise<void> {
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
				if (interaction.isCommand()) {
					scope.setTag('command', interaction.commandName);
				}
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
					new ActionRowBuilder<ButtonBuilder>().addComponents(
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
			if (interaction.isRepliable()) {
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
