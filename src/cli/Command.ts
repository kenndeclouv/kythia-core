/**
 * 🏗️ Abstract Base Command
 * @file src/cli/Command.ts
 */
import { Command as CommanderCommand } from 'commander';

export default abstract class Command {
	public abstract signature: string;
	public abstract description: string;

	public abstract handle(
		options: Record<string, any>,
		...args: any[]
	): Promise<void>;

	public register(program: CommanderCommand): void {
		const cmd = program.command(this.signature).description(this.description);

		this.configure(cmd);

		cmd.action((...args: any[]) => {
			args.pop();

			const options = args.pop() || {};

			this.handle(options, ...args);
		});
	}

	public configure(_cmd: CommanderCommand): void {}
}

export function createCommand(
	name: string,
	description: string,
	action: (...args: unknown[]) => Promise<void> | void,
): CommanderCommand {
	// Changed return type to CommanderCommand
	const cmd = new CommanderCommand(name); // Changed to instantiate CommanderCommand
	cmd.description(description);

	cmd.action((...args: unknown[]) => {
		const promise = action(...args);
		if (promise instanceof Promise) {
			promise.catch((err) => {
				console.error('Command failed:', err);
				process.exit(1);
			});
		}
	});

	return cmd;
}
