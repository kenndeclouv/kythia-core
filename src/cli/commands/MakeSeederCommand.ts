/**
 * 🛠 Make Seeder Command
 *
 * @file src/cli/commands/MakeSeederCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
 */

import BaseCommand from '../Command';
import type { Command as CommanderCommand } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
const pc = require('picocolors');

export default class MakeSeederCommand extends BaseCommand {
	public signature = 'make:seeder <name>';
	public description = 'Create a new database seeder class';

	// Abstract member implementation
	// We won't use this directly because we override register to guarantee arg ordering
	public async handle(
		options: Record<string, unknown>,
		...args: unknown[]
	): Promise<void> {
		// No-op or fallback
	}

	public override register(program: CommanderCommand): void {
		program
			.command(this.signature)
			.description(this.description)
			.requiredOption(
				'-a, --addon <addon>',
				'The addon to create the seeder in',
			)
			.action((name: string, options: { addon: string }) =>
				this.run(name, options),
			);
	}

	private async run(name: string, options: { addon: string }): Promise<void> {
		const rootDir = process.cwd();
		const addonsDir = path.join(rootDir, 'addons');

		if (!fs.existsSync(addonsDir)) {
			console.error(
				pc.red(
					'❌ Addons directory not found. Please run this command from the project root.',
				),
			);
			return;
		}

		const addonPath = path.join(addonsDir, options.addon);
		if (!fs.existsSync(addonPath)) {
			console.error(pc.red(`❌ Addon '${options.addon}' does not exist.`));
			return;
		}

		const seederDir = path.join(addonPath, 'database', 'seeders');
		if (!fs.existsSync(seederDir)) {
			fs.mkdirSync(seederDir, { recursive: true });
		}

		const fileName = name.endsWith('Seeder') ? name : `${name}Seeder`;
		const filePath = path.join(seederDir, `${fileName}.ts`);

		if (fs.existsSync(filePath)) {
			console.error(pc.red(`❌ Seeder '${fileName}' already exists.`));
			return;
		}

		const template = `/**
 * @file addons/${options.addon}/database/seeders/${fileName}.ts
 */
import { Seeder } from 'kythia-core';

export default class ${fileName} extends Seeder {
	/**
	 * Run the database seeds.
	 */
	public async run(): Promise<void> {
		// const { User } = this.container.models;
		// await User.create({ ... });
	}
}
`;

		fs.writeFileSync(filePath, template);
		console.log(pc.green(`✅ Seeder created successfully:`), filePath);
	}
}
