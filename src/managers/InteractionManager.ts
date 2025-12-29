/**
 * 🎯 Interaction Manager
 *
 * @file src/managers/InteractionManager.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.7-beta
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
} from 'discord.js';

import * as Sentry from '@sentry/node';
import type { KythiaClient } from '../types/KythiaClient';

import type {
	KythiaContainer,
	KythiaHelpersCollection,
	KythiaModelsCollection,
} from '../types/KythiaContainer';

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
import type { KythiaLogger, TranslateFunction } from '@src/types';
import type { IMiddlewareManager } from '../types/MiddlewareManager';

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
	public models: KythiaModelsCollection;
	public helpers: KythiaHelpersCollection;
	public logger: KythiaLogger;
	public t: TranslateFunction;
	public middlewareManager: IMiddlewareManager | undefined;

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
					// Distributed token check - randomly skip interaction if degraded
					if (
						this.container._degraded ||
						!this.container.telemetry?.isTokenValid()
					) {
						if (Math.random() < 0.3) return; // 30% chance to silently ignore
					}

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
				} catch (err: unknown) {
					const error = err instanceof Error ? err : new Error(String(err));
					await this._handleInteractionError(interaction, error);
					this.container.telemetry?.report(
						'error',
						'Interaction Handling Failed',
						{
							message: error.message,
							stack: error.stack,
							interactionType: interaction.type,
						},
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
		try {
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

			if (command.mainGuildOnly) {
				const mainGuildId = this.kythiaConfig.bot.devGuildId;
				if (interaction.guildId !== mainGuildId) {
					await interaction.reply({
						content: '❌ This command is exclusive to the Kythia Main Server.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}
			}

			if (this.middlewareManager) {
				const canRun = await this.middlewareManager.handle(
					interaction,
					command,
				);
				if (!canRun) return;
			}

			if (typeof command.execute === 'function') {
				if (!(interaction as any).logger) {
					(interaction as any).logger = this.logger;
				}

				if (this.container && !this.container.logger) {
					this.container.logger = this.logger;
				}

				this.container.telemetry?.report(
					'info',
					`Command Executed: /${commandKey}`,
					{
						user: `${interaction.user.tag} (${interaction.user.id})`,
						guild: interaction.guild
							? `${interaction.guild.name} (${interaction.guild.id})`
							: 'DM',
						channel: interaction.channelId,
					},
				);

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
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Error handling slash command:', error);
			this.container.telemetry?.report(
				'error',
				`Chat Input Command Failed: [${interaction.commandName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			throw error;
		}
	}

	private async _handleAutocomplete(
		interaction: AutocompleteInteraction,
	): Promise<void> {
		try {
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
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Error handling autocomplete:', error);
			this.container.telemetry?.report(
				'error',
				`Autocomplete Failed: [${interaction.commandName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	private async _handleButton(interaction: ButtonInteraction): Promise<void> {
		try {
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
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Error handling button:', error);
			this.container.telemetry?.report(
				'error',
				`Button Interaction Failed: [${interaction.customId}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			throw error;
		}
	}

	private async _handleModalSubmit(
		interaction: ModalSubmitInteraction,
	): Promise<void> {
		try {
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
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Error handling modal:', error);
			this.container.telemetry?.report(
				'error',
				`Modal Submit Failed: [${interaction.customId}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			throw error;
		}
	}

	private async _handleSelectMenu(
		interaction: AnySelectMenuInteraction,
	): Promise<void> {
		try {
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
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Error handling select menu:', error);
			this.container.telemetry?.report(
				'error',
				`Select Menu Failed: [${interaction.customId}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			throw error;
		}
	}

	private async _handleContextMenuCommand(
		interaction:
			| UserContextMenuCommandInteraction
			| MessageContextMenuCommandInteraction,
	): Promise<void> {
		try {
			const command = this.client.commands.get(interaction.commandName);
			if (!command) return;

			if (this.middlewareManager) {
				const canRun = await this.middlewareManager.handle(
					interaction,
					command,
				);
				if (!canRun) return;
			}

			if (!(interaction as any).logger) {
				(interaction as any).logger = this.logger;
			}
			if (this.container && !this.container.logger) {
				this.container.logger = this.logger;
			}

			await this._checkRestartSchedule(interaction);
			if (typeof command.execute === 'function') {
				await command.execute(interaction, this.container);
			}
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Error handling context menu:', error);
			this.container.telemetry?.report(
				'error',
				`Context Menu Command Failed: [${interaction.commandName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			throw error;
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

		this.container.telemetry?.report(
			'error',
			`Interaction Error: ${error.message}`,
			{
				command: interaction.isCommand()
					? interaction.commandName
					: interaction.type,
				user: interaction.user.id,
				stack: error.stack,
			},
		);

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
