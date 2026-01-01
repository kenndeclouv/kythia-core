/**
 * 📦 Addon Manager
 *
 * @file src/managers/AddonManager.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.8-beta
 *
 * @description
 * Handles all addon loading, command registration, and component management.
 * This manager is responsible for scanning addon directories, loading commands,
 * events, buttons, modals, and other components from addons.
 */

import {
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandGroupBuilder,
	Collection,
	ContextMenuCommandBuilder,
	ApplicationCommandType,
	type APIEmbed,
	type Client,
} from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';
import cron from 'node-cron';
import type {
	IAddonManager,
	KythiaClient as IKythiaClient,
	KythiaContainer,
	KythiaButtonHandler,
	KythiaModalHandler,
	KythiaSelectMenuHandler,
	KythiaAutocompleteHandler,
	KythiaTaskHandler,
	KythiaEventHandler,
	CommandRegistrationSummary,
	KythiaCommandModule,
	KythiaLogger,
} from '../types';

export default class AddonManager implements IAddonManager {
	client: IKythiaClient;
	container: KythiaContainer;
	logger: KythiaLogger;

	buttonHandlers: Map<string, KythiaButtonHandler>;
	modalHandlers: Map<string, KythiaModalHandler>;
	selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
	autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
	taskHandlers: Map<string, any>;

	commandCategoryMap: Map<string, string>;
	categoryToFeatureMap: Map<string, string>;

	embedDrafts: Collection<string, APIEmbed | object>;
	eventHandlers: Map<string, KythiaEventHandler[]>;
	/**
	 * 🗝️ AddonManager Constructor
	 * Initializes the addon manager with necessary collections and maps.
	 * @param {Object} client - Discord client instance
	 * @param {Object} container - Dependency container
	 */
	constructor({
		client,
		container,
	}: { client: Client; container: KythiaContainer }) {
		this.client = client as IKythiaClient;
		this.container = container;
		this.logger = this.container.logger;

		this.buttonHandlers = new Map();
		this.modalHandlers = new Map();
		this.selectMenuHandlers = new Map();
		this.autocompleteHandlers = new Map();
		this.taskHandlers = new Map();
		this.commandCategoryMap = new Map();
		this.categoryToFeatureMap = new Map();
		this.embedDrafts = new Collection();
		this.eventHandlers = new Map();
	}

	/**
	 * 🔘 Register Button Handler
	 * Registers a handler function for a specific button customId.
	 * @param {string} customId - The customId of the button
	 * @param {Function} handler - The handler function to execute
	 */
	registerButtonHandler(customId: string, handler: KythiaButtonHandler) {
		try {
			if (this.buttonHandlers.has(customId)) {
				this.logger.warn(
					`Button handler for [${customId}] already exists and will be overwritten.`,
					{ label: 'registration' },
				);
			}
			this.buttonHandlers.set(customId, handler);
		} catch (error: any) {
			this.logger.error(
				`Failed to register button handler for [${customId}]:`,
				error,
				{ label: 'registration' },
			);
			this.container.telemetry?.report(
				'error',
				`Register Button Handler Failed: [${customId}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}
	/**
	 * 🔽 Register Select Menu Handler
	 * Registers a handler function for a specific select menu customId prefix.
	 * @param {string} customIdPrefix - The prefix of the select menu customId
	 * @param {Function} handler - The handler function to execute
	 */
	registerSelectMenuHandler(
		customIdPrefix: string,
		handler: KythiaSelectMenuHandler,
	) {
		try {
			if (this.selectMenuHandlers.has(customIdPrefix)) {
				this.logger.warn(
					`Select menu handler for [${customIdPrefix}] already exists and will be overwritten.`,
					{ label: 'registration' },
				);
			}
			this.selectMenuHandlers.set(customIdPrefix, handler);
		} catch (error: any) {
			this.logger.error(
				`Failed to register select menu handler for [${customIdPrefix}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Register Select Menu Handler Failed: [${customIdPrefix}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	/**
	 * 📝 Register Modal Handler
	 * Registers a handler function for a modal, using a prefix of the customId.
	 * @param {string} customIdPrefix - The prefix of the modal customId
	 * @param {Function} handler - The handler function to execute
	 */
	registerModalHandler(customIdPrefix: string, handler: KythiaModalHandler) {
		try {
			if (this.modalHandlers.has(customIdPrefix)) {
				this.logger.warn(
					`Modal handler for [${customIdPrefix}] already exists and will be overwritten.`,
					{ label: 'registration' },
				);
			}
			this.modalHandlers.set(customIdPrefix, handler);
		} catch (error: any) {
			this.logger.error(
				`Failed to register modal handler for [${customIdPrefix}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Register Modal Handler Failed: [${customIdPrefix}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	/**
	 * 📋 Register Autocomplete Handler
	 * Registers a handler for autocomplete interactions for a specific command or subcommand.
	 * @param {string} commandName - The command or subcommand key
	 * @param {Function} handler - The autocomplete handler function
	 */
	registerAutocompleteHandler(
		commandName: string,
		handler: KythiaAutocompleteHandler,
	): void {
		try {
			if (this.autocompleteHandlers.has(commandName)) {
				this.logger.warn(
					`Autocomplete handler for [${commandName}] already exists.`,
					{ label: 'registration' },
				);
			}
			this.autocompleteHandlers.set(commandName, handler);
		} catch (error: any) {
			this.logger.error(
				`Failed to register autocomplete handler for [${commandName}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Register Autocomplete Handler Failed: [${commandName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	/**
	 * ⏰ Register Task Handler
	 * Registers a scheduled task handler with either cron pattern or interval.
	 * @param {string} taskName - The name of the task
	 * @param {Function} handler - The task handler function
	 * @param {string | number} schedule - Cron pattern (string) or interval in ms (number)
	 */
	registerTaskHandler(
		taskName: string,
		handler: KythiaTaskHandler,
		schedule: string | number,
	): void {
		try {
			if (this.taskHandlers.has(taskName)) {
				this.logger.warn(
					`Task handler for [${taskName}] already exists and will be overwritten.`,
					{ label: 'registration' },
				);
			}

			let taskRef: any;

			if (typeof schedule === 'string') {
				// Cron pattern
				if (!cron.validate(schedule)) {
					throw new Error(
						`Invalid cron pattern: ${schedule} for task [${taskName}]`,
					);
				}

				taskRef = cron.schedule(
					schedule,
					async () => {
						try {
							await handler(this.container);
						} catch (err: unknown) {
							const error = err instanceof Error ? err : new Error(String(err));
							this.logger.error(`Failed to start task ${taskName}:`, error);
							this.container.telemetry?.report(
								'error',
								`Task Execution Failed: [${taskName}]`,
								{
									message: error.message,
									stack: error.stack,
								},
							);
						}
					},
					{
						scheduled: true,
					},
				);

				this.logger.info(
					`Registered cron task [${taskName}] with schedule: ${schedule}`,
					{ label: 'task' },
				);
			} else if (typeof schedule === 'number') {
				// Simple interval (tracked by ShutdownManager automatically)
				taskRef = setInterval(async () => {
					try {
						await handler(this.container);
					} catch (err: unknown) {
						const error = err instanceof Error ? err : new Error(String(err));
						this.logger.error(`Task ${taskName} error:`, error); // Changed taskRef.name to taskName as taskRef is NodeJS.Timeout
						this.container.telemetry?.report(
							'error',
							`Task Execution Failed: [${taskName}]`,
							{
								message: error.message,
								stack: error.stack,
							},
						);
					}
				}, schedule);

				this.logger.info(
					`Registered interval task [${taskName}] with interval: ${schedule}ms`,
					{ label: 'task' },
				);
			} else {
				throw new Error(
					`Invalid schedule type for task [${taskName}]: must be string (cron) or number (interval)`,
				);
			}

			this.taskHandlers.set(taskName, taskRef);
		} catch (error: any) {
			this.logger.error(
				`Failed to register task handler for [${taskName}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Register Task Handler Failed: [${taskName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	/**
	 * 🔍 Validate Addon Dependencies
	 * Checks if all dependencies exist and are enabled
	 */
	private validateDependencies(
		_addonName: string,
		dependencies: string[],
		allAddons: Set<string>,
		disabledAddons: Set<string>,
	): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		for (const dep of dependencies) {
			if (!allAddons.has(dep)) {
				errors.push(`Dependency "${dep}" not found`);
			} else if (disabledAddons.has(dep)) {
				errors.push(`Dependency "${dep}" is disabled`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * 📊 Topological Sort for Addon Dependencies
	 * Ensures dependencies load before dependents using Kahn's algorithm
	 */
	private topologicalSort(
		addons: Array<{
			name: string;
			dependencies: string[];
			priority: number;
		}>,
	): string[] {
		const graph = new Map<string, string[]>();
		const inDegree = new Map<string, number>();

		// Build graph
		for (const addon of addons) {
			graph.set(addon.name, addon.dependencies || []);
			inDegree.set(addon.name, 0);
		}

		// Calculate in-degrees
		for (const [_name, deps] of graph) {
			for (const dep of deps) {
				if (inDegree.has(dep)) {
					inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
				}
			}
		}

		// Topological sort (Kahn's algorithm)
		const queue: string[] = [];
		const result: string[] = [];

		for (const [addon, degree] of inDegree) {
			if (degree === 0) {
				queue.push(addon);
			}
		}

		while (queue.length > 0) {
			// Sort queue by priority before processing
			queue.sort((a, b) => {
				const addonA = addons.find((x) => x.name === a);
				const addonB = addons.find((x) => x.name === b);
				const priorityA = addonA?.priority ?? 50;
				const priorityB = addonB?.priority ?? 50;
				if (priorityA !== priorityB) {
					return priorityA - priorityB;
				}
				return a.localeCompare(b);
			});

			const current = queue.shift();
			if (!current) continue;
			result.push(current);

			const deps = graph.get(current) || [];
			for (const dep of deps) {
				const degree = (inDegree.get(dep) ?? 0) - 1;
				inDegree.set(dep, degree);
				if (degree === 0) {
					queue.push(dep);
				}
			}
		}

		// Check for circular dependencies
		if (result.length !== addons.length) {
			const remaining = addons.filter((a) => !result.includes(a.name));
			this.logger.error(
				`Circular dependency detected in addons: ${remaining.map((a) => a.name).join(', ')}`,
				{ label: 'addon' },
			);
		}

		return result;
	}

	/**
	 * 🔍 Check if module is a BaseCommand class
	 * @param {any} module - The module to check
	 * @returns {boolean} True if module is a class extending BaseCommand
	 * @private
	 */
	private _isBaseCommandClass(module: any): boolean {
		if (typeof module !== 'function') return false;
		if (!module.prototype) return false;

		const hasExecute = typeof module.prototype.execute === 'function';
		return hasExecute;
	}

	/**
	 * 🏗️ Instantiate and prepare BaseCommand class
	 * @param {Function} CommandClass - The command class to instantiate
	 * @returns {Object} Command instance with proper structure
	 * @private
	 */
	private _instantiateBaseCommand(CommandClass: any): any {
		try {
			return new CommandClass(this.container);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Failed to instantiate BaseCommand class:', error); // Adjusted message to fit context
			this.container.telemetry?.report(
				'error',
				'Instantiate BaseCommand Failed',
				{
					// Adjusted telemetry message
					message: error.message,
					stack: error.stack,
				},
			);
			throw error;
		}
	}

	/**
	 * INTERNAL: Creates a Builder instance (Slash, Subcommand, Group) from a module's data property.
	 * @param {Object} data - The data property (can be function, builder, or object)
	 * @param {Class} BuilderClass - The d.js class to use (SlashCommandBuilder, etc.)
	 * @returns {SlashCommandBuilder|SlashCommandSubcommandBuilder|SlashCommandSubcommandGroupBuilder}
	 * @private
	 */
	private _createBuilderFromData(data: any, BuilderClass: any): any {
		let builder = new BuilderClass();

		if (typeof data === 'function') {
			data(builder);
		} else if (data instanceof BuilderClass) {
			builder = data;
		} else if (typeof data === 'object') {
			builder.setName(data.name || 'unnamed');
			builder.setDescription(data.description || 'No description');

			if (BuilderClass === SlashCommandBuilder) {
				builder.setDescription(data.description || 'No description');
				if (data.permissions) {
					builder.setDefaultMemberPermissions(data.permissions);
				}
				if (data.guildOnly !== undefined) {
					builder.setDMPermission(!data.guildOnly);
				}
			} else if (BuilderClass === ContextMenuCommandBuilder) {
				builder.setType(data.type || ApplicationCommandType.User);
				if (data.permissions) {
					builder.setDefaultMemberPermissions(data.permissions);
				}
				if (data.guildOnly !== undefined) {
					builder.setDMPermission(!data.guildOnly);
				}
			}
		}
		return builder;
	}

	/**
	 * 📝 Register Command Helper
	 * Registers a single command file/module, adds it to the command collection, and prepares it for deployment.
	 * @param {Object} module - The command module
	 * @param {string} filePath - The file path of the command
	 * @param {Set} commandNamesSet - Set of already registered command names
	 * @param {Array} commandDataForDeployment - Array to collect command data for deployment
	 * @param {Object} permissionDefaults - Permission defaults for the command
	 * @param {Object} options - Additional options (e.g., folderName)
	 * @returns {Object|null} Summary object for logging, or null if not registered
	 */
	registerCommand(
		module: KythiaCommandModule,
		filePath: string,
		commandNamesSet: Set<string>,
		commandDataForDeployment: object[],
		permissionDefaults: Record<string, any> = {},
		options: { folderName?: string } = {},
	): CommandRegistrationSummary | null {
		try {
			if (this._isBaseCommandClass(module)) {
				module = this._instantiateBaseCommand(module);
			}

			const data =
				module.data || module.slashCommand || module.contextMenuCommand;
			if (!module || !data) return null;

			let builderClass: any;

			if (module.data instanceof ContextMenuCommandBuilder) {
				builderClass = ContextMenuCommandBuilder;
			} else {
				builderClass = SlashCommandBuilder;
			}

			const commandBuilder = this._createBuilderFromData(
				module.data,
				builderClass,
			);

			const commandName = commandBuilder.name;
			const category =
				options.folderName || path.basename(path.dirname(filePath));

			const categoryDefaults = permissionDefaults[category] || {};
			const finalCommand = {
				...categoryDefaults,
				...module,
			};

			this.commandCategoryMap.set(commandName, category);
			if (commandNamesSet.has(commandName)) {
				throw new Error(
					`Duplicate command name detected: "${commandName}" in ${filePath}`,
				);
			}

			commandNamesSet.add(commandName);

			this.client.commands.set(commandName, finalCommand);
			commandDataForDeployment.push(commandBuilder.toJSON());

			if (typeof finalCommand.autocomplete === 'function') {
				this.registerAutocompleteHandler(
					commandName,
					finalCommand.autocomplete,
				);
			}

			return {
				type: 'single',
				name: commandName,
				folder: category,
			};
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error(
				`Failed to register command from [${filePath}]:`,
				error,
			); // Kept filePath as addonName is not defined here
			this.container.telemetry?.report(
				'error',
				`Register Command Failed: [${filePath}]`, // Kept filePath as addonName is not defined here
				{
					message: error.message,
					stack: error.stack,
				},
			);
			return null;
		}
	}

	/**
	 * 🧩 Load Addons & Register Commands/Events
	 * Loads all addons from the addons directory, registers their commands, events, and components.
	 * @param {Object} kythiaInstance - The main Kythia instance for addon registration
	 * @returns {Promise<Array>} Array of command data for deployment
	 */
	async loadAddons(kythiaInstance: any): Promise<Array<any>> {
		this.logger.info('🔌 Loading & Registering Kythia Addons...');
		const commandDataForDeployment: any[] = [];
		const addonsDir = path.join(this.container.appRoot, 'addons');
		if (!fs.existsSync(addonsDir)) return commandDataForDeployment;

		let addonFolders = fs
			.readdirSync(addonsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory() && !d.name.startsWith('_'));

		// Parse addon metadata (priority, dependencies)
		const addonData = addonFolders.map((addon) => {
			let priority = 50; // Default priority
			let dependencies: string[] = [];

			try {
				const addonJsonPath = path.join(addonsDir, addon.name, 'addon.json');
				if (fs.existsSync(addonJsonPath)) {
					const addonJson = JSON.parse(fs.readFileSync(addonJsonPath, 'utf8'));
					priority = addonJson.priority ?? 50;
					dependencies = addonJson.dependencies || [];
				}
			} catch (_e) {
				// Use defaults on error
			}

			return {
				name: addon.name,
				addon,
				priority,
				dependencies,
			};
		});

		// Validate dependencies
		const allAddonNames = new Set(addonData.map((a) => a.name));
		const disabledAddons = new Set<string>();

		// Check for disabled addons first (from kythia.config)
		try {
			const configAddons = this.container.kythiaConfig?.addons || {};
			for (const data of addonData) {
				if (
					configAddons.all?.active === false ||
					configAddons[data.name]?.active === false
				) {
					disabledAddons.add(data.name);
				}
			}
		} catch (_e) {
			// Continue with empty set
		}

		// Validate dependencies for each addon
		for (const data of addonData) {
			if (disabledAddons.has(data.name)) continue;

			const validation = this.validateDependencies(
				data.name,
				data.dependencies,
				allAddonNames,
				disabledAddons,
			);

			if (!validation.valid) {
				this.logger.error(
					`Cannot load addon "${data.name}": ${validation.errors.join(', ')}`,
					{ label: 'addon' },
				);
				disabledAddons.add(data.name);
			}
		}

		// Topological sort (dependency-aware)
		const validAddons = addonData.filter((a) => !disabledAddons.has(a.name));
		const sortedNames = this.topologicalSort(validAddons);

		// Map back to addon folders
		addonFolders = sortedNames
			.map((name) => addonData.find((a) => a.name === name))
			.filter((data): data is (typeof addonData)[0] => data !== undefined)
			.map((data) => data.addon);

		// Log loading order
		this.logger.info('📋 Addon loading order:');
		sortedNames.forEach((name, index) => {
			const data = addonData.find((a) => a.name === name);
			if (!data) return;
			const depsStr =
				data.dependencies.length > 0
					? ` [deps: ${data.dependencies.join(', ')}]`
					: '';
			this.logger.info(
				`  ${index + 1}. ${name} (priority: ${data.priority})${depsStr}`,
			);
		});

		const commandNamesSet = new Set<string>();
		const addonSummaries = [];

		for (const addon of addonFolders) {
			const addonDir = path.join(addonsDir, addon.name);
			let addonVersion = 'v0.0.0-alpha';

			try {
				const addonJsonPath = path.join(addonDir, 'addon.json');
				if (fs.existsSync(addonJsonPath)) {
					let addonJson: any;
					try {
						const addonJsonRaw = fs.readFileSync(addonJsonPath, 'utf8');
						addonJson = JSON.parse(addonJsonRaw);
					} catch (jsonErr: unknown) {
						const error =
							jsonErr instanceof Error ? jsonErr : new Error(String(jsonErr));
						this.logger.warn(
							`🔴 Failed to parse addon.json for ${addon.name}:`,
							error,
						);
						continue;
					}

					addonVersion = addonJson.version || 'v0.0.0-alpha';
					if (addonJson.active === false) {
						this.logger.info(`🟠 Addon ${addon.name.toUpperCase()} disabled`);
						continue;
					}
					if (addonJson.featureFlag) {
						this.commandCategoryMap.set(addon.name, addon.name);
						this.categoryToFeatureMap.set(addon.name, addonJson.featureFlag);
					}
				} else {
					this.logger.warn(
						`🔴 Addon ${addon.name.toUpperCase()} is missing addon.json. Skipping.`,
					);
					continue;
				}
			} catch (e: unknown) {
				const error = e instanceof Error ? e : new Error(String(e));
				this.logger.error(
					`🔴 Error reading addon.json for ${addonDir}:`,
					error,
				);
				continue;
			}

			try {
				const configAddons = this.container.kythiaConfig?.addons || {};

				if (configAddons.all?.active === false) {
					this.logger.info(
						`🟠 Addon ${addon.name.toUpperCase()} disabled via kythia config`,
					);
					continue;
				} else if (configAddons[addon.name]?.active === false) {
					this.logger.info(
						`🟠 Addon ${addon.name.toUpperCase()} disabled via kythia config`,
					);
					continue;
				}
			} catch (e: unknown) {
				const error = e instanceof Error ? e : new Error(String(e));
				this.logger.warn(
					`🔴 Error checking config for addon ${addon.name.toUpperCase()}:`,
					error,
				);
			}

			let addonPermissionDefaults = {};
			const permissionsFilePath = path.join(addonDir, 'permissions.js');

			if (fs.existsSync(permissionsFilePath)) {
				try {
					addonPermissionDefaults = require(permissionsFilePath);
					this.logger.info(
						`  └─> Found and loaded permission defaults for addon '${addon.name.toUpperCase()}'`,
					);
				} catch (e: unknown) {
					const error = e instanceof Error ? e : new Error(String(e));
					this.logger.warn(
						`  └─> Failed to load permissions.js for addon '${addon.name.toUpperCase()}':`,
						error,
					);
				}
			}

			let hasLocales = false;
			const addonLangPath = path.join(addonDir, 'lang');

			if (fs.existsSync(addonLangPath)) {
				if (this.container.translator) {
					this.container.translator.loadLocalesFromDir(addonLangPath);
					hasLocales = true;
				}
			}

			const loadedCommandsSummary: any[] = [];
			const loadedEventsSummary: any[] = [];

			const commandsPath = path.join(addonDir, 'commands');
			if (fs.existsSync(commandsPath)) {
				try {
					const commandsResult = await this._loadCommandsFromPath(
						commandsPath,
						addon,
						addonPermissionDefaults,
						commandNamesSet,
						commandDataForDeployment,
					);
					loadedCommandsSummary.push(...commandsResult);
				} catch (error) {
					this.logger.error(
						`❌ Failed to load commands from addon "${addon.name}":`,
						error,
					);
				}
			}

			const componentSummary = await this._loadAddonComponents(addonDir);

			const registerPath = path.join(addonDir, 'register.js');
			const loadedRegisterSummary: string[] = [];

			if (fs.existsSync(registerPath)) {
				try {
					const registration = require(registerPath);
					const regModule = registration.default || registration;

					if (typeof regModule.initialize === 'function') {
						const res = await regModule.initialize(kythiaInstance);
						if (Array.isArray(res)) loadedRegisterSummary.push(...res);
					}
				} catch (error) {
					this.logger.error(
						`❌ Failed to load register.js for [${addon.name}]:`,
						error,
					);
				}
			}

			const eventsPath = path.join(addonDir, 'events');
			if (fs.existsSync(eventsPath)) {
				const eventFiles = fs
					.readdirSync(eventsPath)
					.filter((file) => file.endsWith('.js'));
				for (const file of eventFiles) {
					const eventName = path.basename(file, '.js');
					try {
						const eventHandler = require(path.join(eventsPath, file));
						if (typeof eventHandler === 'function') {
							if (!this.eventHandlers.has(eventName)) {
								this.eventHandlers.set(eventName, []);
							}
							this.eventHandlers.get(eventName)?.push(eventHandler);
							loadedEventsSummary.push(eventName);
						}
					} catch (e: unknown) {
						const error = e instanceof Error ? e : new Error(String(e));
						this.logger.error(
							`❌ Failed to register event [${eventName}] for [${addon.name}]:`,
							error,
						);
					}
				}
			}

			addonSummaries.push({
				name: addon.name,
				version: addonVersion,
				commands: loadedCommandsSummary,
				events: loadedEventsSummary,
				register: [...componentSummary, ...loadedRegisterSummary],
				hasLocales: hasLocales,
			});
		}

		this._logAddonSummary(addonSummaries);
		return commandDataForDeployment;
	}

	private async _loadAddonComponents(addonDir: string): Promise<string[]> {
		const summary: string[] = [];

		const componentTypes = [
			{
				folder: 'buttons',
				register: this.registerButtonHandler.bind(this),
				name: 'Buttons',
			},
			{
				folder: 'modals',
				register: this.registerModalHandler.bind(this),
				name: 'Modals',
			},
			{
				folder: 'select_menus',
				register: this.registerSelectMenuHandler.bind(this),
				name: 'Select Menus',
			},
			{
				folder: 'tasks',
				register: this.registerTaskHandler.bind(this),
				name: 'Tasks',
			},
		];

		for (const type of componentTypes) {
			const dirPath = path.join(addonDir, type.folder);

			if (!fs.existsSync(dirPath)) continue;

			const files = fs
				.readdirSync(dirPath)
				.filter(
					(f) =>
						(f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.d.ts'),
				);

			let count = 0;

			for (const file of files) {
				try {
					const filePath = path.join(dirPath, file);

					let module = require(filePath);
					if (module.default) module = module.default;

					if (typeof module.execute !== 'function') {
						this.logger.warn(
							`⚠️ Skipped component ${file}: Missing 'execute' function.`,
						);
						continue;
					}

					// Tasks require special handling (3 arguments instead of 2)
					if (type.folder === 'tasks') {
						// Check if task is disabled
						if (module.active === false || module.disabled) {
							this.logger.info(
								`🟠 Skipped task ${file}: Task is disabled (active: false).`,
							);
							continue;
						}

						if (!module.schedule) {
							this.logger.warn(
								`⚠️ Skipped task ${file}: Missing 'schedule' property.`,
							);
							continue;
						}

						const taskName = module.taskName || path.parse(file).name;
						type.register(taskName, module.execute, module.schedule);
					} else {
						const id = module.customId || path.parse(file).name;
						(type.register as (id: string, handler: any) => void)(
							id,
							module.execute,
						);
					}

					count++;
				} catch (err) {
					this.logger.error(
						`❌ Failed to load ${type.name.slice(0, -1)} ${file}:`,
						err,
					);
				}
			}

			if (count > 0) {
				summary.push(`  └─ ✅ Auto-loaded ${count} ${type.name}`);
			}
		}

		return summary;
	}

	/**
	 * Load commands from a specific path
	 * @private
	 */
	private async _loadCommandsFromPath(
		commandsPath: string,
		addon: any,
		addonPermissionDefaults: any,
		commandNamesSet: Set<string>,
		commandDataForDeployment: any[],
	) {
		const isTopLevelCommandGroup = fs.existsSync(
			path.join(commandsPath, '_command.js'),
		);

		if (isTopLevelCommandGroup) {
			return await this._loadTopLevelCommandGroup(
				commandsPath,
				addon,
				addonPermissionDefaults,
				commandNamesSet,
				commandDataForDeployment,
			);
		} else {
			return await this._loadIndividualCommands(
				commandsPath,
				addon,
				addonPermissionDefaults,
				commandNamesSet,
				commandDataForDeployment,
			);
		}
	}

	/**
	 * Load top-level command group (supports BaseCommand classes)
	 * @private
	 */
	private async _loadTopLevelCommandGroup(
		commandsPath: string,
		addon: any,
		addonPermissionDefaults: any,
		commandNamesSet: Set<string>,
		commandDataForDeployment: any[],
	) {
		const loadedCommandsSummary: any[] = [];
		let commandDef = require(path.join(commandsPath, '_command.js'));

		if (this._isBaseCommandClass(commandDef)) {
			commandDef = this._instantiateBaseCommand(commandDef);
		}

		const category = addon.name;
		const categoryDefaults = addonPermissionDefaults[category] || {};

		if (
			(commandDef.data || commandDef.slashCommand) &&
			!commandDef.prefixCommand
		) {
			if (commandDef.disableAutoPrefix !== true) {
				const builder = commandDef.data || commandDef.slashCommand;
				commandDef.prefixCommand = {
					name: builder.name,
					aliases: commandDef.aliases || [],
					description: builder.description,
					autoGenerated: true,
				};
			}
		}

		commandDef = {
			...categoryDefaults,
			...commandDef,
		};

		const mainData = commandDef.data || commandDef.slashCommand;
		const mainBuilder = this._createBuilderFromData(
			mainData,
			SlashCommandBuilder,
		);

		const mainCommandName = mainBuilder.name;

		if (commandDef.featureFlag) {
			this.commandCategoryMap.set(mainCommandName, addon.name);
			this.categoryToFeatureMap.set(addon.name, commandDef.featureFlag);
		}
		this.commandCategoryMap.set(mainCommandName, addon.name);

		if (commandNamesSet.has(mainCommandName))
			throw new Error(`Duplicate command name: ${mainCommandName}`);
		commandNamesSet.add(mainCommandName);

		this.client.commands.set(mainCommandName, commandDef);

		if (typeof commandDef.autocomplete === 'function') {
			this.registerAutocompleteHandler(
				mainCommandName,
				commandDef.autocomplete,
			);
		}

		const loadedSubcommandsSummary: any[] = [];
		const contents = fs.readdirSync(commandsPath, { withFileTypes: true });

		for (const item of contents) {
			const itemPath = path.join(commandsPath, item.name);

			if (
				item.isFile() &&
				item.name.endsWith('.js') &&
				!item.name.startsWith('_')
			) {
				let subModule = require(itemPath);

				const isSubcommand =
					subModule.subcommand === true || this._isBaseCommandClass(subModule);

				if (this._isBaseCommandClass(subModule)) {
					subModule = this._instantiateBaseCommand(subModule);
				}

				if (!isSubcommand) continue;

				const subData = subModule.data || subModule.slashCommand;
				if (!subData) continue;

				const subBuilder = this._createBuilderFromData(
					subData,
					SlashCommandSubcommandBuilder,
				);

				mainBuilder.addSubcommand(subBuilder);

				this.client.commands.set(
					`${mainCommandName} ${subBuilder.name}`,
					subModule,
				);

				if (typeof subModule.autocomplete === 'function') {
					this.registerAutocompleteHandler(
						`${mainCommandName} ${subBuilder.name}`,
						subModule.autocomplete,
					);
				}

				loadedSubcommandsSummary.push(subBuilder.name);
			} else if (item.isDirectory()) {
				const groupDefPath = path.join(itemPath, '_group.js');

				if (!fs.existsSync(groupDefPath)) {
					continue;
				}

				try {
					let groupModule = require(groupDefPath);

					if (this._isBaseCommandClass(groupModule)) {
						groupModule = this._instantiateBaseCommand(groupModule);
					}

					const groupData = groupModule.data || groupModule.slashCommand;
					if (!groupData) continue;

					const groupBuilder = this._createBuilderFromData(
						groupData,
						SlashCommandSubcommandGroupBuilder,
					);

					const subcommandsInGroupSummary = [];
					const subCommandFiles = fs
						.readdirSync(itemPath)
						.filter((f) => f.endsWith('.js') && !f.startsWith('_'));

					for (const file of subCommandFiles) {
						const subCommandPath = path.join(itemPath, file);
						let subModule = require(subCommandPath);

						if (this._isBaseCommandClass(subModule)) {
							subModule = this._instantiateBaseCommand(subModule);
						}

						const subData = subModule.data || subModule.slashCommand;
						if (!subData) continue;

						const subBuilder = this._createBuilderFromData(
							subData,
							SlashCommandSubcommandBuilder,
						);

						groupBuilder.addSubcommand(subBuilder);

						const commandKey = `${mainCommandName} ${groupBuilder.name} ${subBuilder.name}`;

						this.client.commands.set(commandKey, subModule);

						if (typeof subModule.autocomplete === 'function') {
							this.registerAutocompleteHandler(
								commandKey,
								subModule.autocomplete,
							);
						}

						subcommandsInGroupSummary.push(subBuilder.name);
					}

					mainBuilder.addSubcommandGroup(groupBuilder);

					loadedSubcommandsSummary.push({
						group: groupBuilder.name,
						subcommands: subcommandsInGroupSummary,
					});
				} catch (e) {
					this.logger.error(
						`❌ Failed to load subcommand group from ${itemPath}:`,
						e,
					);
				}
			}
		}

		if (commandDef.prefixCommand) {
			const pConfig = commandDef.prefixCommand;
			const name = pConfig.name || pConfig.trigger;

			if (name) {
				Object.assign(commandDef, pConfig);
				if (!this.client.commands.has(name)) {
					if (commandNamesSet.has(name)) {
						this.logger.warn(
							`Duplicate prefix command name detected: "${name}" in ${commandsPath}`,
						);
					} else {
						commandNamesSet.add(name);
						this.client.commands.set(name, commandDef);
					}
				} else {
					const existing = this.client.commands.get(name);
					if (existing) Object.assign(existing, pConfig);
				}

				loadedCommandsSummary.push({
					type: 'single',
					name: name,
					folder: addon.name,
					kind: 'prefix',
				});
			}
		}

		commandDataForDeployment.push(mainBuilder.toJSON());
		loadedCommandsSummary.push({
			type: 'group',
			name: mainCommandName,
			subcommands: loadedSubcommandsSummary,
		});

		return loadedCommandsSummary;
	}

	/**
	 * Load individual commands (supports BaseCommand classes)
	 * @private
	 */
	private async _loadIndividualCommands(
		commandsPath: string,
		addon: any,
		addonPermissionDefaults: any,
		commandNamesSet: Set<string>,
		commandDataForDeployment: any[],
	) {
		const loadedCommandsSummary: any[] = [];
		const commandItems = fs.readdirSync(commandsPath, { withFileTypes: true });

		for (const item of commandItems) {
			const itemPath = path.join(commandsPath, item.name);

			if (
				item.isDirectory() &&
				fs.existsSync(path.join(itemPath, '_command.js'))
			) {
				let commandDef = require(path.join(itemPath, '_command.js'));
				if (this._isBaseCommandClass(commandDef)) {
					commandDef = this._instantiateBaseCommand(commandDef);
				}

				const mainData = commandDef.data || commandDef.slashCommand;
				const mainBuilder = this._createBuilderFromData(
					mainData,
					SlashCommandBuilder,
				);

				const mainCommandName = mainBuilder.name;

				if (commandDef.featureFlag) {
					this.commandCategoryMap.set(mainCommandName, addon.name);
					this.categoryToFeatureMap.set(addon.name, commandDef.featureFlag);
				}
				if (commandNamesSet.has(mainCommandName))
					throw new Error(`Duplicate name: ${mainCommandName}`);
				commandNamesSet.add(mainCommandName);

				this.client.commands.set(mainCommandName, commandDef);
				if (typeof commandDef.autocomplete === 'function') {
					this.registerAutocompleteHandler(
						mainCommandName,
						commandDef.autocomplete,
					);
				}

				const subcommandsList = [];
				const groupContents = fs.readdirSync(itemPath, { withFileTypes: true });

				for (const content of groupContents) {
					const contentPath = path.join(itemPath, content.name);

					if (
						content.isFile() &&
						content.name.endsWith('.js') &&
						!content.name.startsWith('_')
					) {
						let subModule = require(contentPath);
						if (this._isBaseCommandClass(subModule)) {
							subModule = this._instantiateBaseCommand(subModule);
						}

						const subData = subModule.data || subModule.slashCommand;
						if (!subData) continue;

						const subBuilder = this._createBuilderFromData(
							subData,
							SlashCommandSubcommandBuilder,
						);
						mainBuilder.addSubcommand(subBuilder);

						this.client.commands.set(
							`${mainCommandName} ${subBuilder.name}`,
							subModule,
						);
						if (typeof subModule.autocomplete === 'function') {
							this.registerAutocompleteHandler(
								`${mainCommandName} ${subBuilder.name}`,
								subModule.autocomplete,
							);
						}
						subcommandsList.push(subBuilder.name);
					} else if (
						content.isDirectory() &&
						fs.existsSync(path.join(contentPath, '_group.js'))
					) {
						let groupDef = require(path.join(contentPath, '_group.js'));
						if (this._isBaseCommandClass(groupDef)) {
							groupDef = this._instantiateBaseCommand(groupDef);
						}

						const groupData = groupDef.data || groupDef.slashCommand;
						const groupBuilder = this._createBuilderFromData(
							groupData,
							SlashCommandSubcommandGroupBuilder,
						);

						const subGroupList = [];
						const subGroupContents = fs.readdirSync(contentPath, {
							withFileTypes: true,
						});
						for (const subSubItem of subGroupContents) {
							if (
								subSubItem.isFile() &&
								subSubItem.name.endsWith('.js') &&
								!subSubItem.name.startsWith('_')
							) {
								const subSubPath = path.join(contentPath, subSubItem.name);
								let subSubModule = require(subSubPath);
								if (this._isBaseCommandClass(subSubModule)) {
									subSubModule = this._instantiateBaseCommand(subSubModule);
								}

								const subSubData =
									subSubModule.data || subSubModule.slashCommand;
								if (!subSubData) continue;

								const subSubBuilder = this._createBuilderFromData(
									subSubData,
									SlashCommandSubcommandBuilder,
								);
								groupBuilder.addSubcommand(subSubBuilder);

								this.client.commands.set(
									`${mainCommandName} ${groupBuilder.name} ${subSubBuilder.name}`,
									subSubModule,
								);
								if (typeof subSubModule.autocomplete === 'function') {
									this.registerAutocompleteHandler(
										`${mainCommandName} ${groupBuilder.name} ${subSubBuilder.name}`,
										subSubModule.autocomplete,
									);
								}
								subGroupList.push(subSubBuilder.name);
							}
						}
						mainBuilder.addSubcommandGroup(groupBuilder);
						subcommandsList.push({
							group: groupBuilder.name,
							subcommands: subGroupList,
						});
					}
				}
				commandDataForDeployment.push(mainBuilder.toJSON());
				loadedCommandsSummary.push({
					type: 'group',
					name: mainCommandName,
					subcommands: subcommandsList,
				});
			} else if (
				item.isFile() &&
				item.name.endsWith('.js') &&
				!item.name.startsWith('_')
			) {
				let commandModule = require(itemPath);
				if (commandModule.default) commandModule = commandModule.default;
				let isClass = false;
				if (this._isBaseCommandClass(commandModule)) {
					commandModule = this._instantiateBaseCommand(commandModule);
					isClass = true;
				}

				if (!isClass && commandModule.subcommand) continue;

				if (commandModule.slashCommand && !commandModule.prefixCommand) {
					if (commandModule.disableAutoPrefix !== true) {
						commandModule.prefixCommand = {
							name: commandModule.slashCommand.name,
							aliases: commandModule.aliases || [],
							description: commandModule.slashCommand.description,
							autoGenerated: true,
						};
					}
				}

				let summarySlash = null;
				let summaryContext = null;

				if (commandModule.slashCommand) {
					const builder = commandModule.slashCommand;
					const name = builder.name;
					try {
						const allLocales = this.container.translator?.getLocales() as any;
						const nameLocalizations: any = {};
						const descriptionLocalizations: any = {};
						if (typeof allLocales.entries === 'function') {
							for (const [lang, translations] of allLocales.entries()) {
								const nameKey = `command_${name}_name`;
								const descKey = `command_${name}_desc`;
								if (translations[nameKey])
									nameLocalizations[lang] = translations[nameKey];
								if (translations[descKey])
									descriptionLocalizations[lang] = translations[descKey];
							}
						} else {
							for (const lang in allLocales) {
								const translations = allLocales[lang];
								const nameKey = `command_${name}_name`;
								const descKey = `command_${name}_desc`;
								if (translations[nameKey])
									nameLocalizations[lang] = translations[nameKey];
								if (translations[descKey])
									descriptionLocalizations[lang] = translations[descKey];
							}
						}
						if (Object.keys(nameLocalizations).length > 0) {
							builder.setNameLocalizations(nameLocalizations);
						}
						if (Object.keys(descriptionLocalizations).length > 0) {
							builder.setDescriptionLocalizations(descriptionLocalizations);
						}
						this._applySubcommandLocalizations(builder, name, allLocales);
					} catch (e: unknown) {
						const error = e instanceof Error ? e : new Error(String(e));
						this.logger.warn(
							`Failed to load localizations for command "${name}":`,
							error,
						);
					}

					if (commandNamesSet.has(name)) {
						this.logger.warn(
							`Duplicate command name detected: "${name}" in ${itemPath}`,
						);
					} else {
						commandNamesSet.add(name);

						this.client.commands.set(name, commandModule);
					}
					if (typeof commandModule.autocomplete === 'function') {
						this.registerAutocompleteHandler(name, commandModule.autocomplete);
					}
					commandDataForDeployment.push(builder.toJSON());
					summarySlash = {
						type: 'single',
						name: name,
						folder: addon.name,
						kind: 'slash',
					};
					if (summarySlash) loadedCommandsSummary.push(summarySlash);
					this.commandCategoryMap.set(name, addon.name);
				}

				if (commandModule.contextMenuCommand) {
					const builder = commandModule.contextMenuCommand;
					const name = builder.name;
					if (commandNamesSet.has(name) && !commandModule.slashCommand) {
						this.logger.warn(
							`Duplicate command name detected: "${name}" in ${itemPath}`,
						);
					} else {
						if (!commandNamesSet.has(name)) commandNamesSet.add(name);

						this.client.commands.set(name, commandModule);
					}
					commandDataForDeployment.push(builder.toJSON());
					summaryContext = {
						type: 'single',
						name: name,
						folder: addon.name,
						kind: 'contextMenu',
					};
					if (summaryContext) loadedCommandsSummary.push(summaryContext);
				}

				if (
					!isClass &&
					!commandModule.slashCommand &&
					!commandModule.contextMenuCommand
				) {
					const summary = this.registerCommand(
						commandModule,
						itemPath,
						commandNamesSet,
						commandDataForDeployment,
						addonPermissionDefaults,
						{ folderName: addon.name },
					);
					if (summary) loadedCommandsSummary.push(summary);
				}
			} else if (item.isDirectory() && !item.name.startsWith('_')) {
				const files = fs
					.readdirSync(itemPath)
					.filter((f) => f.endsWith('.js') && !f.startsWith('_'));
				for (const file of files) {
					const filePath = path.join(itemPath, file);
					let commandModule = require(filePath);
					let isClass = false;
					if (this._isBaseCommandClass(commandModule)) {
						commandModule = this._instantiateBaseCommand(commandModule);
						isClass = true;
					}

					if (!isClass && commandModule.subcommand) continue;

					if (commandModule.slashCommand && !commandModule.prefixCommand) {
						if (commandModule.disableAutoPrefix !== true) {
							commandModule.prefixCommand = {
								name: commandModule.slashCommand.name,
								aliases: commandModule.aliases || [],
								description: commandModule.slashCommand.description,
								autoGenerated: true,
							};
						}
					}

					let summarySlash = null;
					let summaryContext = null;

					if (commandModule.slashCommand) {
						const builder = commandModule.slashCommand;
						const name = builder.name;
						try {
							const allLocales = this.container.translator?.getLocales() as any;
							const nameLocalizations: any = {};
							const descriptionLocalizations: any = {};
							if (typeof allLocales.entries === 'function') {
								for (const [lang, translations] of allLocales.entries()) {
									const nameKey = `command_${name}_name`;
									const descKey = `command_${name}_desc`;
									if (translations[nameKey])
										nameLocalizations[lang] = translations[nameKey];
									if (translations[descKey])
										descriptionLocalizations[lang] = translations[descKey];
								}
							} else {
								for (const lang in allLocales) {
									const translations = allLocales[lang];
									const nameKey = `command_${name}_name`;
									const descKey = `command_${name}_desc`;
									if (translations[nameKey])
										nameLocalizations[lang] = translations[nameKey];
									if (translations[descKey])
										descriptionLocalizations[lang] = translations[descKey];
								}
							}
							if (Object.keys(nameLocalizations).length > 0) {
								builder.setNameLocalizations(nameLocalizations);
							}
							if (Object.keys(descriptionLocalizations).length > 0) {
								builder.setDescriptionLocalizations(descriptionLocalizations);
							}
							this._applySubcommandLocalizations(builder, name, allLocales);
						} catch (e: unknown) {
							const error = e instanceof Error ? e : new Error(String(e));
							this.logger.warn(
								`Failed to load localizations for command "${name}": ${error.message}`,
							);
						}
						this.commandCategoryMap.set(name, item.name);
						if (commandNamesSet.has(name)) {
							this.logger.warn(
								`Duplicate slash command name detected: "${name}" in ${filePath}`,
							);
						} else {
							commandNamesSet.add(name);

							this.client.commands.set(name, commandModule);
							commandDataForDeployment.push(builder.toJSON());
							summarySlash = {
								type: 'single',
								name: name,
								folder: item.name,
								kind: 'slash',
							};
							if (summarySlash) loadedCommandsSummary.push(summarySlash);
						}
					}

					if (commandModule.contextMenuCommand) {
						const builder = commandModule.contextMenuCommand;
						const name = builder.name;

						if (!this.client.commands.has(name)) {
							this.client.commands.set(name, commandModule);
						}
						commandDataForDeployment.push(builder.toJSON());
						summaryContext = {
							type: 'single',
							name: name,
							folder: item.name,
							kind: 'contextMenu',
						};
						if (summaryContext) loadedCommandsSummary.push(summaryContext);
					}

					if (commandModule.prefixCommand) {
						const pConfig = commandModule.prefixCommand;

						const name = pConfig.name || pConfig.trigger;

						if (name) {
							Object.assign(commandModule, pConfig);

							if (!this.client.commands.has(name)) {
								if (commandNamesSet.has(name)) {
									this.logger.warn(
										`Duplicate prefix command name detected: "${name}" in ${itemPath}`,
									);
								} else {
									commandNamesSet.add(name);

									this.client.commands.set(name, commandModule);
								}
							} else {
								const existing = this.client.commands.get(name);
								if (existing) Object.assign(existing, pConfig);
							}

							const summaryPrefix = {
								type: 'single',
								name: name,
								folder: addon.name,
								kind: 'prefix',
							};
							loadedCommandsSummary.push(summaryPrefix);
							this.commandCategoryMap.set(name, addon.name);
						}
					}

					if (
						!isClass &&
						!commandModule.slashCommand &&
						!commandModule.contextMenuCommand &&
						!commandModule.prefixCommand
					) {
						const summary = this.registerCommand(
							commandModule,
							filePath,
							commandNamesSet,
							commandDataForDeployment,
							addonPermissionDefaults,
							{ folderName: item.name },
						);
						if (summary) loadedCommandsSummary.push(summary);
					}
				}
			}
		}
		return loadedCommandsSummary;
	}

	/**
	 * Apply subcommand localizations
	 * @private
	 */
	private _applySubcommandLocalizations(
		commandBuilder: any,
		commandName: string,
		allLocales: any,
	) {
		if (Array.isArray(commandBuilder.options)) {
			for (const group of commandBuilder.options) {
				if (
					typeof SlashCommandSubcommandGroupBuilder !== 'undefined' &&
					group instanceof SlashCommandSubcommandGroupBuilder
				) {
					const groupName = group.name;

					const groupDescLocalizations: any = {};
					if (typeof allLocales.entries === 'function') {
						for (const [lang, translations] of allLocales.entries()) {
							const groupDescKey = `command_${commandName}_${groupName}_group_desc`;
							if (translations[groupDescKey])
								groupDescLocalizations[lang] = translations[groupDescKey];
						}
					} else {
						for (const lang in allLocales) {
							const translations = allLocales[lang];
							const groupDescKey = `command_${commandName}_${groupName}_group_desc`;
							if (translations[groupDescKey])
								groupDescLocalizations[lang] = translations[groupDescKey];
						}
					}
					if (
						Object.keys(groupDescLocalizations).length > 0 &&
						typeof group.setDescriptionLocalizations === 'function'
					) {
						group.setDescriptionLocalizations(groupDescLocalizations);
					}

					if (Array.isArray(group.options)) {
						for (const sub of group.options) {
							const subName = sub.name;

							const subDescLocalizations: any = {};
							if (typeof allLocales.entries === 'function') {
								for (const [lang, translations] of allLocales.entries()) {
									const subDescKey = `command_${commandName}_${groupName}_${subName}_desc`;
									if (translations[subDescKey])
										subDescLocalizations[lang] = translations[subDescKey];
								}
							} else {
								for (const lang in allLocales) {
									const translations = allLocales[lang];
									const subDescKey = `command_${commandName}_${groupName}_${subName}_desc`;
									if (translations[subDescKey])
										subDescLocalizations[lang] = translations[subDescKey];
								}
							}
							if (
								Object.keys(subDescLocalizations).length > 0 &&
								typeof sub.setDescriptionLocalizations === 'function'
							) {
								sub.setDescriptionLocalizations(subDescLocalizations);
							}

							if (Array.isArray(sub.options)) {
								for (const opt of sub.options) {
									const optName = opt.name;
									const optDescLocalizations: any = {};
									if (typeof allLocales.entries === 'function') {
										for (const [lang, translations] of allLocales.entries()) {
											const optDescKey = `command_${commandName}_${groupName}_${subName}_option_${optName}`;
											if (translations[optDescKey])
												optDescLocalizations[lang] = translations[optDescKey];
										}
									} else {
										for (const lang in allLocales) {
											const translations = allLocales[lang];
											const optDescKey = `command_${commandName}_${groupName}_${subName}_option_${optName}`;
											if (translations[optDescKey])
												optDescLocalizations[lang] = translations[optDescKey];
										}
									}
									if (
										Object.keys(optDescLocalizations).length > 0 &&
										typeof opt.setDescriptionLocalizations === 'function'
									) {
										opt.setDescriptionLocalizations(optDescLocalizations);
									}
								}
							}
						}
					}
				} else if (
					typeof SlashCommandSubcommandBuilder !== 'undefined' &&
					group instanceof SlashCommandSubcommandBuilder
				) {
					const subName = group.name;
					const subDescLocalizations: any = {};
					if (typeof allLocales.entries === 'function') {
						for (const [lang, translations] of allLocales.entries()) {
							const subDescKey = `command_${commandName}_${subName}_desc`;
							if (translations[subDescKey])
								subDescLocalizations[lang] = translations[subDescKey];
						}
					} else {
						for (const lang in allLocales) {
							const translations = allLocales[lang];
							const subDescKey = `command_${commandName}_${subName}_desc`;
							if (translations[subDescKey])
								subDescLocalizations[lang] = translations[subDescKey];
						}
					}
					if (
						Object.keys(subDescLocalizations).length > 0 &&
						typeof group.setDescriptionLocalizations === 'function'
					) {
						group.setDescriptionLocalizations(subDescLocalizations);
					}

					if (Array.isArray(group.options)) {
						for (const opt of group.options) {
							const optName = opt.name;
							const optDescLocalizations: any = {};
							if (typeof allLocales.entries === 'function') {
								for (const [lang, translations] of allLocales.entries()) {
									const optDescKey = `command_${commandName}_${subName}_option_${optName}`;
									if (translations[optDescKey])
										optDescLocalizations[lang] = translations[optDescKey];
								}
							} else {
								for (const lang in allLocales) {
									const translations = allLocales[lang];
									const optDescKey = `command_${commandName}_${subName}_option_${optName}`;
									if (translations[optDescKey])
										optDescLocalizations[lang] = translations[optDescKey];
								}
							}
							if (
								Object.keys(optDescLocalizations).length > 0 &&
								typeof opt.setDescriptionLocalizations === 'function'
							) {
								opt.setDescriptionLocalizations(optDescLocalizations);
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Log addon summary
	 * @private
	 */
	private _logAddonSummary(addonSummaries: any[]) {
		this.logger.info('▬▬▬▬▬▬▬▬▬▬▬▬▬[ Addon(s) Loaded ]▬▬▬▬▬▬▬▬▬▬▬▬▬');
		for (const addon of addonSummaries) {
			this.logger.info(`📦  ${addon.name} (v${addon.version})`);
			this.logger.info('  ⚙️  Command(s)');
			if (!addon.commands.length) {
				this.logger.info('     (no commands registered)');
			} else {
				for (const cmd of addon.commands) {
					if (cmd.type === 'group') {
						this.logger.info(`     └─ /${cmd.name}`);
						for (const sub of cmd.subcommands) {
							if (typeof sub === 'string') {
								this.logger.info(`        └─ ${sub}`);
							} else if (typeof sub === 'object' && sub.group) {
								this.logger.info(`          └─ [${sub.group}]`);
								for (const subsub of sub.subcommands) {
									this.logger.info(`             └─ ${subsub}`);
								}
							}
						}
					} else if (cmd.type === 'single') {
						let kindLabel = '';
						if (cmd.kind === 'slash') kindLabel = ' [slash]';
						else if (cmd.kind === 'contextMenu') kindLabel = ' [contextMenu]';
						else if (cmd.kind === 'prefix') kindLabel = ' [prefix]';

						const prefixSymbol = cmd.kind === 'prefix' ? '!' : '/';

						if (cmd.folder) {
							this.logger.info(
								`     └─ ${prefixSymbol}${cmd.name} (${cmd.folder})${kindLabel}`,
							);
						} else {
							this.logger.info(
								`     └─ ${prefixSymbol}${cmd.name}${kindLabel}`,
							);
						}
					}
				}
			}
			if (addon.hasLocales) {
				this.logger.info('  🌐  Locales: Loaded');
			}
			if (addon.register?.length) {
				this.logger.info('  🧩 Component(s)');
				for (const reg of addon.register) {
					this.logger.info(`   ${reg}`);
				}
			}
			if (addon.events?.length) {
				this.logger.info('  📢 Event(s)');
				for (const ev of addon.events) {
					this.logger.info(`     └─ ${ev}`);
				}
			}
		}
	}

	/**
	 * Get handler maps for other managers
	 */
	getHandlers() {
		return {
			buttonHandlers: this.buttonHandlers,
			modalHandlers: this.modalHandlers,
			selectMenuHandlers: this.selectMenuHandlers,
			autocompleteHandlers: this.autocompleteHandlers,
			taskHandlers: this.taskHandlers,
			commandCategoryMap: this.commandCategoryMap,
			categoryToFeatureMap: this.categoryToFeatureMap,
			eventHandlers: this.eventHandlers,
		};
	}
}
