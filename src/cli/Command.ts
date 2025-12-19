/**
 * 🏗️ Abstract Base Command
 * @file src/cli/Command.ts
 */
import type { Command as CommanderCommand } from 'commander';

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
