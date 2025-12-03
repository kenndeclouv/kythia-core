/**
 * 🏗️ Abstract Base Command
 *
 * @file src/cli/Command.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
 *
 * @description
 * The base class for all Kythia CLI commands. It enforces a standard structure
 * (signature, description, handle) and manages the integration with Commander.js.
 *
 * ✨ Core Features:
 * -  Standardized Interface: Enforces `handle()` implementation.
 * -  Flexible Parsing: Handles both Options and Arguments intelligently.
 * -  Auto Registration: Simplifies wiring commands to the main program.
 */

class Command {
	/**
	 * The name and signature of the console command.
	 * @type {string}
	 */
	signature = '';

	/**
	 * The console command description.
	 * @type {string}
	 */
	description = '';

	/**
	 * Execute the console command.
	 * @param {Object} options - The options object from Commander
	 * @param {...any} args - Positional arguments (if any)
	 */
	async handle(_options, ..._args) {
		throw new Error('Command must implement handle method');
	}

	/**
	 * Register the command with the program.
	 * @param {import('commander').Command} program
	 */
	register(program) {
		const cmd = program
			.command(this.signature)
			.description(this.description)
			.action((...args) => {
				const _commandObj = args.pop();
				const opts = args.pop() || {};

				this.handle(opts, ...args);
			});

		this.configure(cmd);
	}

	/**
	 * Configure additional options or arguments.
	 * @param {import('commander').Command} cmd
	 */
	configure(_cmd) {
		// Override to add options
	}
}

module.exports = Command;
