/**
 * Base Command Structure
 * @class BaseCommand
 * @description Base class for all command types (slash commands, context menus, etc.)
 */
import type { KythiaContainer } from '../types/KythiaContainer';
import type { CommandInteraction } from 'discord.js';

export default class BaseCommand {
	public container: KythiaContainer;
	public client: KythiaContainer['client'];
	public logger: KythiaContainer['logger'];
	public t: KythiaContainer['t'];
	public models: KythiaContainer['models'];
	public kythiaConfig: KythiaContainer['kythiaConfig'];
	public helpers: KythiaContainer['helpers'];

	public data: {
		name: string;
		description: string;
		cooldown: number;
		permissions: string[];
		ownerOnly: boolean;
		teamOnly: boolean;
		guildOnly: boolean;
	};

	/**
	 * @param {KythiaContainer} container - Dependency injection container
	 */
	constructor(container: KythiaContainer) {
		if (!container) {
			throw new Error('Container is required for BaseCommand');
		}

		this.container = container;
		this.client = container.client;
		this.logger = container.logger;
		this.t = container.t;
		this.models = container.models;
		this.kythiaConfig = container.kythiaConfig;
		this.helpers = container.helpers;

		this.data = {
			name: 'base-command',
			description: 'Base command description',
			cooldown: 10,
			permissions: [],
			ownerOnly: false,
			teamOnly: false,
			guildOnly: false,
		};
	}

	/**
	 * Main command execution method (must be implemented by child classes)
	 * @param {CommandInteraction} interaction - The interaction object
	 * @returns {Promise<void>}
	 */
	public async execute(interaction: CommandInteraction): Promise<void> {
		if ((interaction as any).options?.getSubcommand?.(false)) {
			this.logger.warn(
				`Command group ${this.constructor.name} execute called - this should be handled by subcommand`,
			);
			return;
		}

		throw new Error(
			`Execute method not implemented for ${this.constructor.name}`,
		);
	}
}
