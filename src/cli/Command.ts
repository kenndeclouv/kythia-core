/**
 * 🏗️ Abstract Base Command
 *
 * @file src/cli/Command.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.0-beta.1
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
import type { Command as CommanderCommand } from 'commander';

export default abstract class Command {
	/**
	 * The name and signature of the console command.
	 */
	public abstract signature: string;

	/**
	 * The console command description.
	 */
	public abstract description: string;

	/**
	 * Execute the console command.
	 * @param options - The options object from Commander
	 * @param args - Positional arguments (if any)
	 */
	public abstract handle(
		options: Record<string, any>,
		...args: any[]
	): Promise<void>;

	/**
	 * Register the command with the program.
	 */
	public register(program: CommanderCommand): void {
		const cmd = program
			.command(this.signature)
			.description(this.description)
			.action((...args: any[]) => {
				// Commander v7+ passes (arg1, arg2, options, commandObj)
				// Kita perlu extrak options dan arguments dengan benar
				const commandObj = args.pop(); // Commander object (terakhir)
				const options = args.pop() || {}; // Options object (kedua terakhir)

				// Sisanya adalah arguments
				this.handle(options, ...args);
			});

		this.configure(cmd);
	}

	/**
	 * Configure additional options or arguments.
	 * Override this method in child classes to add flags.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public configure(cmd: CommanderCommand): void {
		// Default: do nothing
	}
}
