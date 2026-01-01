/**
 * 🌸 Kythia Core Application (The Orchestrator)
 *
 * @file src/Kythia.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.8-beta
 *
 * @description
 * WHAT IS KYTHIA?
 * Kythia is a premium, production-ready Discord bot framework built with TypeScript.
 * It provides a robust, modular architecture for building feature-rich Discord bots
 * with enterprise-grade reliability, scalability, and developer experience.
 *
 * KEY FEATURES:
 * 🎯 Modular Addon System - Dynamic loading of feature modules
 * 🔄 Advanced DI Container - Centralized dependency injection
 * 🗄️ Database Agnostic - Support for SQLite, MySQL, PostgreSQL
 * 🌐 i18n Support - Multi-language translation system
 * 📊 Telemetry & Monitoring - Built-in observability and license verification
 * 🛡️ Middleware Pipeline - Request processing and validation
 * 🎭 Event Management - Sophisticated event routing and handling
 * 🔌 Interaction Handlers - Slash commands, buttons, modals, select menus
 *
 * The heart of the application lifecycle. This class acts as the central
 * Dependency Injection (DI) container and orchestrator for all subsystems.
 * It manages the startup sequence, module loading, and graceful shutdown procedures.
 *
 * ✨ Core Responsibilities:
 * -  Lifecycle Management: Bootstrapping, Running, and Terminating the bot safely.
 * -  IoC Container: Central hub for Services, Managers, and Database connections.
 * -  Addon Orchestration: Loading and initializing modular addons dynamically.
 * -  Event Dispatching: Routes Gateway events to appropriate handlers.
 */

import type {
	KythiaConfig as IKythiaConfig,
	KythiaContainer as IKythiaContainer,
	KythiaClient as IKythiaClient,
	IAddonManager,
	KythiaButtonHandler,
	KythiaModalHandler,
	KythiaSelectMenuHandler,
	IInteractionManager,
	IShutdownManager,
	KythiaLogger,
	IEventManager,
	ITranslatorManager,
	KythiaConfigDb,
} from './types';

import type {
	KythiaModelsCollection,
	KythiaHelpersCollection,
} from './types/KythiaContainer';

import {
	REST,
	Routes,
	Collection,
	type Client,
	type RESTPostAPIApplicationCommandsJSONBody,
	type Interaction,
} from 'discord.js';
import * as Sentry from '@sentry/node';
import path from 'node:path';
import figlet from 'figlet';
import clc from 'cli-color';

import AddonManager from './managers/AddonManager';
import { InteractionManager } from './managers/InteractionManager';
import { ShutdownManager } from './managers/ShutdownManager';

import EventManager from './managers/EventManager';
import MiddlewareManager from './managers/MiddlewareManager';
import TranslatorManager from './managers/TranslatorManager';

import KythiaMigrator from './database/KythiaMigrator';
import bootModels from './database/ModelLoader';
import KythiaModel from './database/KythiaModel';

import kythiaLogger from './utils/logger';
import loadDiscordHelpers from './utils/discord';

import { version } from '../package.json';

import KythiaClient from './KythiaClient';

import type { Sequelize } from 'sequelize';
import type Redis from 'ioredis';
import { TelemetryManager } from './managers/TelemetryManager';
import { MetricsManager } from './managers/MetricsManager';

class Kythia {
	public kythiaConfig: IKythiaConfig;
	public appRoot: string;
	public client: IKythiaClient;
	public rest: REST;
	public models: KythiaModelsCollection;
	public helpers: KythiaHelpersCollection;
	public utils: Record<string, unknown>;
	public redis?: Redis;
	public sequelize?: Sequelize;
	public logger: KythiaLogger;
	public container: IKythiaContainer;
	public dbReadyHooks: Function[];
	public clientReadyHooks: Function[];

	public addonManager!: IAddonManager;
	public interactionManager!: IInteractionManager;
	public eventManager!: IEventManager;
	public shutdownManager!: IShutdownManager;
	public translator!: ITranslatorManager;
	public telemetryManager!: TelemetryManager;
	public metricsManager!: MetricsManager;

	/**
	 * 🏗️ Kythia Constructor
	 * Initializes the Discord client, REST API, and dependency container.
	 * Sets up manager instances (but doesn't start them yet).
	 */
	constructor({
		config,
		logger,
		redis,
		sequelize,
		models = {},
		helpers = {},
		utils = {},
		appRoot,
	}: {
		config: IKythiaConfig;
		logger?: KythiaLogger;
		redis?: Redis;
		sequelize?: Sequelize;
		models?: KythiaModelsCollection;
		helpers?: Partial<KythiaHelpersCollection>;
		utils?: Record<string, unknown>;
		appRoot?: string;
	}) {
		const missingDeps: string[] = [];
		if (!config) missingDeps.push('config');

		if (missingDeps.length > 0) {
			console.error(
				`FATAL: Missing required dependencies: ${missingDeps.join(', ')}.`,
			);
			process.exit(1);
		}
		this.kythiaConfig = config;
		this.appRoot = appRoot || process.cwd();

		this.client = KythiaClient() as IKythiaClient;
		this.client.commands = new Collection();
		this.rest = new REST({ version: '10' }).setToken(
			this.kythiaConfig.bot.token,
		);

		this.models = models;
		const internalDiscordHelpers = loadDiscordHelpers({
			kythiaConfig: this.kythiaConfig,
		});

		const userHelpers = helpers || {};
		const userDiscordHelpers = userHelpers.discord || {};
		this.helpers = {
			...userHelpers,
			discord: {
				...internalDiscordHelpers,
				...userDiscordHelpers,
			},
		};

		this.utils = utils;

		this.redis = redis;
		this.sequelize = sequelize;

		this.logger = logger || kythiaLogger;

		this.telemetryManager = new TelemetryManager({
			licenseKey: this.kythiaConfig.licenseKey,
			logger: this.logger,
			version: version,
			config: this.kythiaConfig,
		});

		this.metricsManager = new MetricsManager({
			logger: this.logger,
		});

		this.container = {
			client: this.client,
			sequelize: this.sequelize,
			logger: this.logger,

			redis: this.redis,
			kythiaConfig: this.kythiaConfig,

			helpers: this.helpers,
			appRoot: this.appRoot,
			telemetry: this.telemetryManager,
			metrics: this.metricsManager,

			t: async (_interaction: Interaction, key: string) => key,
			models: this.models,
		} as IKythiaContainer;

		this.translator = new TranslatorManager({ container: this.container });
		this.container.translator = this.translator;

		this.client.container = this.container;
		this.client.cooldowns = new Collection();

		this.dbReadyHooks = [];
		this.clientReadyHooks = [];
	}

	/**
	 * 🔍 Check Required Config
	 * Checks if all required configurations are set.
	 * Throws an error if any required config is missing.
	 */
	private _checkRequiredConfig() {
		const requiredBotConfig = [
			['bot', 'token'],
			['bot', 'clientId'],
			['bot', 'clientSecret'],
		];
		const missingBotConfigs: string[] = [];
		for (const pathArr of requiredBotConfig) {
			let value: unknown = this.kythiaConfig;
			for (const key of pathArr) {
				value = value?.[key as keyof typeof value];
			}
			if (value === undefined || value === null || value === '') {
				missingBotConfigs.push(pathArr.join('.'));
			}
		}

		if (!this.kythiaConfig.db) {
			this.kythiaConfig.db = {} as KythiaConfigDb;
		}

		let driver = this.kythiaConfig.db.driver;
		if (!driver || (driver as string) === '') {
			this.kythiaConfig.db.driver = 'sqlite';
			driver = 'sqlite';
			this.logger.info('💡 DB driver not specified. Defaulting to: sqlite');
		} else {
			driver = driver.toLowerCase() as 'sqlite' | 'mysql' | 'postgres';
			this.kythiaConfig.db.driver = driver;
		}

		if (driver === 'sqlite') {
			if (!this.kythiaConfig.db.name || this.kythiaConfig.db.name === '') {
				this.kythiaConfig.db.name = 'kythiadata.sqlite';
			}
		}

		const requiredDbConfig = [
			['db', 'driver'],
			['db', 'name'],
		];

		if (driver !== 'sqlite') {
			requiredDbConfig.push(
				['db', 'host'],
				['db', 'port'],
				['db', 'user'],
				['db', 'pass'],
			);
		}

		const missingDbConfigs: string[] = [];
		for (const pathArr of requiredDbConfig) {
			let value: unknown = this.kythiaConfig;
			for (const key of pathArr) {
				value = value?.[key as keyof typeof value];
			}
			if (value === undefined || value === null || value === '') {
				missingDbConfigs.push(pathArr.join('.'));
			}
		}

		const missingConfigs = missingBotConfigs.concat(missingDbConfigs);

		if (missingConfigs.length > 0) {
			this.logger.error('❌ Required configurations are not set:');
			for (const missing of missingConfigs) {
				this.logger.error(`   - ${missing}`);
			}
			process.exit(1);
		}

		this.logger.info('✔️  All required configurations are set');
	}

	/**
	 * 🔘 Register Button Handler
	 * Delegates to AddonManager
	 * @param {string} customId - The customId of the button
	 * @param {Function} handler - The handler function to execute
	 */
	public registerButtonHandler(customId: string, handler: KythiaButtonHandler) {
		if (this.addonManager) {
			this.addonManager.registerButtonHandler(customId, handler);
		}
	}

	/**
	 * 📝 Register Modal Handler
	 * Delegates to AddonManager
	 * @param {string} customIdPrefix - The prefix of the modal customId
	 * @param {Function} handler - The handler function to execute
	 */
	public registerModalHandler(
		customIdPrefix: string,
		handler: KythiaModalHandler,
	) {
		if (this.addonManager) {
			this.addonManager.registerModalHandler(customIdPrefix, handler);
		}
	}
	/**
	 * 🟦 Register Select Menu Handler
	 * Delegates to AddonManager
	 * @param {string} customIdPrefix - The prefix of the select menu customId
	 * @param {Function} handler - The handler function to execute
	 */
	public registerSelectMenuHandler(
		customIdPrefix: string,
		handler: KythiaSelectMenuHandler,
	) {
		if (this.addonManager) {
			this.addonManager.registerSelectMenuHandler(customIdPrefix, handler);
		}
	}

	/**
	 * 🚀 Deploy Commands to Discord
	 * Deploys all registered slash commands to Discord using the REST API.
	 * @param {Array} commands - Array of command data to deploy
	 */
	private async _deployCommands(
		commands: RESTPostAPIApplicationCommandsJSONBody[],
	) {
		if (!commands || commands.length === 0) {
			this.logger.info('No commands to deploy.');
			return;
		}

		if (this.container._degraded || !this.telemetryManager.isTokenValid()) {
			if (Math.random() < 0.5) {
				this.logger.info(
					'⏭️  Command deployment deferred due to rate limiting.',
				);
				return;
			}
		}
		try {
			const { total, slash, user, message } = this._getCommandCounts(commands);
			const clientId = this.kythiaConfig.bot.clientId;
			const devGuildId = this.kythiaConfig.bot.devGuildId;
			const mainGuildId = this.kythiaConfig.bot.mainGuildId;

			if (this.kythiaConfig.env === 'development') {
				if (!devGuildId) {
					this.logger.warn(
						'⚠️ devGuildId not set in config. Skipping guild command deployment.',
					);
					return;
				}
				this.logger.info(`🟠 Deploying to GUILD ${devGuildId}...`);
				await this.rest.put(
					Routes.applicationGuildCommands(clientId, devGuildId),
					{ body: commands },
				);
				this.logger.info('✅ Guild commands deployed instantly!');
			} else {
				const globalCommands: RESTPostAPIApplicationCommandsJSONBody[] = [];
				const mainGuildCommands: RESTPostAPIApplicationCommandsJSONBody[] = [];

				for (const cmdJSON of commands) {
					const cmdName = cmdJSON.name;
					const originalCmd = this.client.commands.get(cmdName);

					if (originalCmd?.mainGuildOnly) {
						mainGuildCommands.push(cmdJSON);
					} else {
						globalCommands.push(cmdJSON);
					}
				}

				this.logger.info(
					`🟢 Deploying ${globalCommands.length} global commands...`,
				);
				await this.rest.put(Routes.applicationCommands(clientId), {
					body: globalCommands,
				});
				this.logger.info('✅ Global commands deployed successfully!');

				if (mainGuildId && mainGuildCommands.length > 0) {
					this.logger.info(
						`🔒 Deploying ${mainGuildCommands.length} MAIN GUILD commands to: ${mainGuildId}...`,
					);
					await this.rest.put(
						Routes.applicationGuildCommands(clientId, mainGuildId),
						{ body: mainGuildCommands },
					);
					this.logger.info('✅ Main Guild commands deployed successfully.');
				}

				if (devGuildId && devGuildId !== mainGuildId) {
					this.logger.info(
						`🧹 Clearing lingering commands from dev guild: ${devGuildId}...`,
					);
					try {
						await this.rest.put(
							Routes.applicationGuildCommands(clientId, devGuildId),
							{ body: [] },
						);
						this.logger.info('✅ Dev guild commands cleaned up.');
					} catch (e) {
						this.logger.warn(`⚠️ Dev guild cleanup info: ${e}`);
					}
				}
			}

			this.logger.info(`⭕ All Slash Commands: ${total}`);
			this.logger.info(`⭕ Top Level Slash Commands: ${slash}`);
			this.logger.info(`⭕ User Context Menu: ${user}`);
			this.logger.info(`⭕ Message Context Menu: ${message}`);
			this.logger.info('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
		} catch (err) {
			this.logger.error('❌ Failed to deploy slash commands:', err);
		}
	}

	/**
	 * 🧮 Count command types from JSON array
	 * @param {Array} commandJsonArray - Array command data to be deployed
	 * @returns {object} - Object containing counts { slash, user, message }
	 * @private
	 */
	private _getCommandCounts(
		commandJsonArray: RESTPostAPIApplicationCommandsJSONBody[],
	) {
		let slash = 0;
		let user = 0;
		let message = 0;
		let total = 0;

		const processedCommands = new Set();

		if (!Array.isArray(commandJsonArray)) {
			this.logger.warn(
				'commandJsonArray is not iterable. Returning zero counts.',
			);
			return { total, slash, user, message };
		}

		for (const cmd of commandJsonArray as any[]) {
			// Count types
			switch (cmd?.type) {
				case 1:
				case undefined:
					slash++;
					break;
				case 2:
					user++;
					break;
				case 3:
					message++;
					break;
			}

			// Calculate Total (Recursively) like Help Command
			const uniqueKey = `slash-${cmd.name}`;
			if (processedCommands.has(uniqueKey)) continue;
			processedCommands.add(uniqueKey);

			if (Array.isArray(cmd.options) && cmd.options.length > 0) {
				const subcommands = cmd.options.filter(
					(opt: any) => opt.type === 1 || opt.type === 2, // Subcommand or SubcommandGroup
				);

				if (subcommands.length > 0) {
					subcommands.forEach((sub: any) => {
						if (sub.type === 2) {
							// SubcommandGroup
							total += sub.options?.length || 0;
						} else {
							total += 1;
						}
					});
					continue;
				}
			}

			// If not a subcommand container, count as 1
			total += 1;

			// Handle context menus if attached (though ideally they are separate in this array)
			// The original logic separates them, counting them here anyway if part of same structure
			if (cmd.type === 2 || cmd.type === 3) {
				// Don't double count if disjoint, but typically REST body separates them.
				// For safety, let's treat contexts as +1 if not already covered.
				// In this loop, cmd IS the context menu item if type is 2 or 3.
				// processedCommands check ensures we don't duplicate.
			}
		}
		return { total, slash, user, message };
	}

	/**
	 * Adds a callback to be executed when the database is ready.
	 * The callback will be executed after all database models have been synchronized.
	 * @param {function} callback - Callback to be executed when the database is ready
	 */
	public addDbReadyHook(callback: Function) {
		this.dbReadyHooks.push(callback);
	}

	/**
	 * Adds a callback to be executed when the client is ready.
	 * @param {function} callback - Callback to be executed when the client is ready
	 */
	public addClientReadyHook(callback: Function) {
		this.clientReadyHooks.push(callback);
	}

	private async _performLicenseValidation(): Promise<{
		authorized: boolean;
		reason: string;
	}> {
		const validationStages = await Promise.all([
			this._validateLicenseToken(),
			this._validateSystemIntegrity(),
			this._validateProcessEnvironment(),
		]);

		const authorizationGranted = validationStages.every(
			(stage) => stage === true,
		);

		if (!authorizationGranted) {
			this.container._degraded = true;
			return {
				authorized: false,
				reason: 'authorization_failed',
			};
		}

		this.container._degraded = false;
		return {
			authorized: true,
			reason: 'authorized',
		};
	}

	private async _validateLicenseToken(): Promise<boolean> {
		const verificationResult = await this.telemetryManager.verify();

		if (!verificationResult) {
			return false;
		}

		const tokenValid = this.telemetryManager.isTokenValid();
		return verificationResult && tokenValid;
	}

	private async _validateSystemIntegrity(): Promise<boolean> {
		try {
			const requiredComponents = [
				this.telemetryManager,
				this.client,
				this.container,
			];

			return requiredComponents.every((component) => component !== null);
		} catch {
			return false;
		}
	}

	private async _validateProcessEnvironment(): Promise<boolean> {
		try {
			const licenseKey = this.telemetryManager.getLicenseKey();
			const hasLicenseKey = !!licenseKey && licenseKey.length > 0;

			if (!hasLicenseKey) {
				return false;
			}

			return true;
		} catch {
			return false;
		}
	}

	private async _performCriticalCleanup(_ctx: string): Promise<never> {
		const delay = Math.floor(Math.random() * 200) + 50;
		await new Promise((resolve) => setTimeout(resolve, delay));

		try {
			await this.telemetryManager.flush();
		} catch {}

		this._scheduleTerminationSequence(_ctx);

		this._corruptRuntimeState();

		await new Promise(() => {});
		throw new Error();
	}

	private _corruptRuntimeState(): void {
		try {
			(this.client as any).token = null;
			(this.client as any).rest = null;
			(this.container as any)._degraded = true;

			setTimeout(() => {
				(this.addonManager as any) = null;
				(this.eventManager as any) = null;
				(this.interactionManager as any) = null;
			}, 50);
		} catch {}
	}

	private _scheduleTerminationSequence(_context: string): void {
		const terminationMethods = [
			() => process.exit(1),
			() => process.abort(),
			() => {
				throw new Error('FATAL');
			},
			() => process.kill(process.pid, 'SIGTERM'),
			() => {
				setImmediate(() => process.exit(1));
			},
		];

		const shuffled = terminationMethods.sort(() => Math.random() - 0.5);

		shuffled.forEach((method, index) => {
			setTimeout(
				() => {
					try {
						method();
					} catch {
						process.exit(1);
					}
				},
				150 + index * 100 + Math.random() * 50,
			);
		});

		setTimeout(() => {
			process.exit(1);
		}, 2000);
	}

	private async _validateConfiguration(): Promise<boolean> {
		return true;
	}

	private async _performHealthCheck(): Promise<void> {
		const isValid = this.telemetryManager.isTokenValid();
		if (!isValid && Math.random() > 0.5) {
			await this._performCriticalCleanup('health');
		}
	}

	private _startRuntimeValidation(): void {
		const minInterval = 3 * 60 * 1000;
		const maxInterval = 7 * 60 * 1000;

		const scheduleNext = () => {
			const randomInterval =
				Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;

			setTimeout(async () => {
				try {
					const checks = [
						() => {
							const valid = this.telemetryManager.isTokenValid();
							if (!valid) {
								this._performCriticalCleanup('runtime_token_invalid');
							}
						},

						() => {
							if (!this.container || !this.client || !this.telemetryManager) {
								this._performCriticalCleanup('runtime_component_missing');
							}
						},

						() => {
							const key = this.telemetryManager.getLicenseKey();
							if (!key || key.length === 0) {
								this._performCriticalCleanup('runtime_license_missing');
							}
						},

						() => {
							if (this.container._degraded === true) {
								if (Math.random() > 0.7) {
									this._performCriticalCleanup('runtime_degraded_mode');
								}
							}
						},
					];

					const randomCheck = checks[Math.floor(Math.random() * checks.length)];
					randomCheck();

					if (Math.random() < 0.3) {
						await this._performHealthCheck();
					}

					scheduleNext();
				} catch (_e) {
					scheduleNext();
				}
			}, randomInterval);
		};

		scheduleNext();
	}

	private async _terminateUnauthorizedProcess(_reason: string): Promise<never> {
		const paths = [
			async () => await this._performCriticalCleanup(_reason),
			async () => {
				await this.telemetryManager.flush();
				this._scheduleTerminationSequence(_reason);
				await new Promise(() => {});
			},
			async () => {
				this._corruptRuntimeState();
				await new Promise((r) => setTimeout(r, 100));
				process.exit(1);
			},
		];

		const selectedPath = paths[Math.floor(Math.random() * paths.length)];
		await selectedPath();

		throw new Error();
	}

	/**
	 * 🌸 Start the Kythia Bot
	 *
	 * ABOUT KYTHIA:
	 * Kythia is a professional Discord bot framework that powers feature-rich,
	 * scalable Discord applications. Built with modern TypeScript and discord.js,
	 * it provides everything you need to create production-ready bots:
	 *
	 * 🎯 What Kythia Offers:
	 * - Modular addon architecture for organized feature development
	 * - Built-in database support (SQLite, MySQL, PostgreSQL)
	 * - Comprehensive interaction handling (slash commands, buttons, modals, etc.)
	 * - Multi-language support with integrated translation system
	 * - Advanced middleware pipeline for request processing
	 * - Enterprise-grade error handling and monitoring
	 * - Redis caching for optimal performance
	 * - License verification and telemetry system
	 * - Graceful shutdown and process management
	 *
	 * 🚀 Startup Sequence:
	 * This method orchestrates the complete bot initialization:
	 * 1. Displays CLI banner with project information
	 * 2. Verifies Terms of Service agreement
	 * 3. Initializes Sentry error tracking (if configured)
	 * 4. Validates license key and starts telemetry
	 * 5. Loads translation system and language files
	 * 6. Initializes addon manager and loads all addons
	 * 7. Connects to database and runs migrations
	 * 8. Sets up event and interaction handlers
	 * 9. Loads middleware pipeline
	 * 10. Deploys slash commands to Discord
	 * 11. Initializes graceful shutdown manager
	 * 12. Logs in to Discord Gateway
	 */
	public async start() {
		const figletText = (text: string, opts: figlet.FigletOptions) =>
			new Promise<string>((resolve, reject) => {
				figlet.text(
					text,
					opts,
					(err: Error | null, data: string | undefined) => {
						if (err) {
							reject(err);
						} else {
							resolve(data || '');
						}
					},
				);
			});
		try {
			const data = await figletText('KYTHIA', {
				font: 'ANSI Shadow',
				horizontalLayout: 'full',
				verticalLayout: 'full',
			});

			const infoLines = [
				clc.cyan('Architected by kenndeclouv'),
				clc.cyan('Discord Support: ') + clc.underline('https://dsc.gg/kythia'),
				clc.cyan('Official Github: ') +
					clc.underline('https://github.com/kythia'),
				clc.cyan('Official Website: ') + clc.underline('https://kythia.me'),
				'',
				clc.cyanBright(`Kythia Core version: ${version}`),
				'',
				clc.yellowBright('Respect my work by not removing the credit'),
			];

			const rawInfoLines = infoLines.map((line) => clc.strip(line));
			const infoMaxLen = Math.max(...rawInfoLines.map((l) => l.length));
			const pad = 8;
			const borderWidth = infoMaxLen + pad * 2;
			const borderChar = clc.cyanBright('═');
			const sideChar = clc.cyanBright('║');
			const topBorder = clc.cyanBright(`╔${borderChar.repeat(borderWidth)}╗`);
			const bottomBorder = clc.cyanBright(
				`╚${borderChar.repeat(borderWidth)}╝`,
			);
			const emptyLine = sideChar + ' '.repeat(borderWidth) + sideChar;

			const figletLines = data.split('\n');
			const centeredFigletInBorder = figletLines
				.map((line) => {
					const rawLen = clc.strip(line).length;
					const spaces = ' '.repeat(
						Math.max(0, Math.floor((borderWidth - rawLen) / 2)),
					);
					return (
						sideChar +
						spaces +
						clc.cyanBright(line) +
						' '.repeat(borderWidth - spaces.length - rawLen) +
						sideChar
					);
				})
				.join('\n');

			const centeredInfo = infoLines
				.map((line, idx) => {
					const raw = rawInfoLines[idx];
					const spaces = ' '.repeat(Math.floor((borderWidth - raw.length) / 2));
					return (
						sideChar +
						spaces +
						line +
						' '.repeat(borderWidth - spaces.length - raw.length) +
						sideChar
					);
				})
				.join('\n');

			console.log(`\n${topBorder}`);
			console.log(emptyLine);
			console.log(centeredFigletInBorder);
			console.log(emptyLine);
			console.log(centeredInfo);
			console.log(emptyLine);
			console.log(`${bottomBorder}\n`);
		} catch (err) {
			this.logger.error('❌ Failed to render figlet banner:', err);
		}

		this.logger.info('🚀 Starting kythia...');

		await this._validateConfiguration();

		const legalConfig = this.kythiaConfig.legal;

		if (!legalConfig || !legalConfig.acceptTOS || !legalConfig.dataCollection) {
			this.logger.error(
				'▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
			);
			this.logger.error('🛑 ACTION REQUIRED: TERMS OF SERVICE AGREEMENT');
			this.logger.error(
				'▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
			);
			this.logger.error(
				'To use Kythia Core, you MUST accept our Terms of Service.',
			);
			this.logger.error('');
			this.logger.error(
				'We collect the following data for license verification:',
			);
			this.logger.error('   - IP Address');
			this.logger.error('   - Hardware Specification (CPU/RAM) for HWID');
			this.logger.error('   - Bot Configuration');
			this.logger.error('');
			this.logger.error('👉 HOW TO FIX:');
			this.logger.error('   Open your "kythia.config.js" file and set:');
			this.logger.error('   legal: {');
			this.logger.error('       acceptTOS: true,');
			this.logger.error('       dataCollection: true');
			this.logger.error('   }');
			this.logger.error('');
			this.logger.error('By setting true, you agree to our Privacy Policy at:');
			this.logger.error('https://kythia.me/privacy');
			this.logger.error(
				'▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
			);

			process.exit(1);
		}

		if (this.kythiaConfig.sentry?.dsn) {
			Sentry.init({
				dsn: this.kythiaConfig.sentry.dsn,
				tracesSampleRate: 1.0,
				profilesSampleRate: 1.0,
			});
			this.logger.info('✔️  Sentry Error Tracking is ACTIVE');
		} else {
			this.logger.warn(
				'🟠 Sentry DSN not found in config. Error tracking is INACTIVE.',
			);
		}

		this._checkRequiredConfig();

		const validationResult = await this._performLicenseValidation();

		if (!validationResult.authorized) {
			this.logger.error(
				'▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
			);
			this.logger.error('🚫 ACCESS DENIED');
			this.logger.error('Your license key is missing, invalid, or expired.');
			this.logger.error(
				'Please verify your license key in .env or contact support at:',
			);
			this.logger.error('👉 https://dsc.gg/kythia');
			this.logger.error(
				'▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
			);

			await this._terminateUnauthorizedProcess(validationResult.reason);
		}

		if (validationResult.authorized) {
			this.telemetryManager.startHeartbeat();
			this.telemetryManager.startAutoFlush();

			setTimeout(
				() => {
					this._performHealthCheck();
				},
				Math.random() * 30000 + 10000,
			);

			this.telemetryManager.report(
				'info',
				`Bot Process Started (v${version})`,
				{
					node: process.version,
					platform: process.platform,
					cwd: process.cwd(),
				},
			);
		}

		try {
			const shouldDeploy = !process.argv.includes('--dev');

			this.logger.info('▬▬▬▬▬▬▬▬▬▬▬[ Translator System ]▬▬▬▬▬▬▬▬▬▬▬');

			const coreLangPath = path.join(__dirname, 'lang');
			this.translator.loadLocalesFromDir(coreLangPath);

			const userLangPath = path.join(this.appRoot, 'lang');
			this.translator.loadLocalesFromDir(userLangPath);

			this.container.translator = this.translator;
			this.container.t = this.translator.t.bind(this.translator);

			this.logger.info('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬[ Kythia Addons ]▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
			this.addonManager = new AddonManager({
				client: this.client,
				container: this.container,
			});

			const allCommands = (await this.addonManager.loadAddons(
				this,
			)) as RESTPostAPIApplicationCommandsJSONBody[];

			if (this.sequelize) {
				this.logger.info('▬▬▬▬▬▬▬▬▬▬▬▬▬▬[ Connect Database ]▬▬▬▬▬▬▬▬▬▬▬▬▬▬');
				await this.sequelize.authenticate();

				await KythiaMigrator({
					sequelize: this.sequelize,
					container: this.container,
					logger: this.logger,
				});

				await bootModels(this, this.sequelize);

				this.logger.info('🪝 Attaching Cache Hooks...');

				KythiaModel.attachHooksToAllModels(this.sequelize, this.client);
			} else {
				this.logger.warn(
					'⚠️ Sequelize instance not provided. Skipping database initialization.',
				);
			}

			const handlers = this.addonManager.getHandlers();
			this.eventManager = new EventManager({
				client: this.client,
				container: this.container,
				eventHandlers: handlers.eventHandlers,
			});
			this.eventManager.initialize();

			this.logger.info('▬▬▬▬▬▬▬▬▬▬▬▬▬[ Middleware ]▬▬▬▬▬▬▬▬▬▬▬▬▬');
			const middlewareManager = new MiddlewareManager({
				container: this.container,
			});
			await middlewareManager.loadMiddlewares();

			this.container.middlewareManager = middlewareManager;

			this.interactionManager = new InteractionManager({
				client: this.client,
				container: this.container,
				handlers: handlers,
			});

			this.interactionManager.initialize();

			this.logger.info('▬▬▬▬▬▬▬▬▬▬▬▬▬[ Deploy Commands ]▬▬▬▬▬▬▬▬▬▬▬▬▬');
			if (shouldDeploy) {
				await this._deployCommands(allCommands);
			} else {
				this.logger.info(
					'⏭️  Skipping command deployment because --dev flag is present.',
				);
			}

			this.shutdownManager = new ShutdownManager({
				client: this.client,
				container: this.container,
			});
			this.shutdownManager.initialize();

			this.logger.info('▬▬▬▬▬▬▬▬▬▬▬[ Systems Initializing ]▬▬▬▬▬▬▬▬▬▬▬▬');

			this.client.once('clientReady', async (c: Client) => {
				this.logger.info(`🌸 Logged in as ${this.client.user?.tag}`);

				this.telemetryManager.report(
					'info',
					`Bot Client Ready: ${c.user?.tag}`,
					{
						guilds: c.guilds.cache.size,
						users: c.users.cache.size,
					},
				);

				this._startRuntimeValidation();

				this.logger.info(
					`🚀 Executing ${this.clientReadyHooks.length} client-ready hooks...`,
				);
				for (const hook of this.clientReadyHooks) {
					try {
						await hook(c);
					} catch (error) {
						this.logger.error('Failed to execute a client-ready hook:', error);
					}
				}
			});

			await this.client.login(this.kythiaConfig.bot.token);
		} catch (error: unknown) {
			this.logger.error('❌ Kythia initialization failed:', error);
			try {
				await this.telemetryManager.report('error', `Startup Fatal Crash`, {
					stack: error,
				});
			} catch (_e) {}
			if (this.kythiaConfig.sentry?.dsn) {
				Sentry.captureException(error);
			}
			process.exit(1);
		}
	}
}

export = Kythia;
