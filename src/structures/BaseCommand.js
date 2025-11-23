/**
 * Base Command Structure
 * @class BaseCommand
 * @description Base class for all command types (slash commands, context menus, etc.)
 */
class BaseCommand {
	/**
	 * @param {Object} container - Dependency injection container
	 */
	constructor(container) {
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
	 * @param {import('discord.js').CommandInteraction} interaction - The interaction object
	 * @returns {Promise<void>}
	 */
	async execute(interaction) {
		if (interaction.options?.getSubcommand?.(false)) {
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

module.exports = BaseCommand;
