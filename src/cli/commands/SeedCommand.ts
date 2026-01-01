/**
 * 🚜 Database Seeder Runner
 *
 * @file src/cli/commands/SeedCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
 * 
 * @description
 * Executed the database seeders.
 */

import Command from '../Command';
import type { Command as CommanderCommand } from 'commander';
import { sequelize } from '../utils/db';
import { SeederManager } from '../../database/SeederManager';
import path from 'node:path';
import fs from 'node:fs';
import type { KythiaContainer } from '../../types';

const pc = require('picocolors');

export default class SeedCommand extends Command {
	public signature = 'db:seed';
	public description = 'Seed the database with records';

	public configure(cmd: CommanderCommand): void {
		cmd
			.option('--class <class>', 'The specific seeder class to run')
			.option('--addon <addon>', 'Run seeders only from this addon');
	}

	public async handle(options: {
		class?: string;
		addon?: string;
	}): Promise<void> {
		const configPath = path.resolve(process.cwd(), 'kythia.config.js');
		if (!fs.existsSync(configPath)) {
			console.error(pc.red('❌ kythia.config.js not found!'));
			return;
		}
		const kythiaConfig = require(configPath);

		// Mock container
		const container: Partial<KythiaContainer> = {
			appRoot: process.cwd(),
			kythiaConfig: kythiaConfig,
			models: {},
		};

		// Mock Logger
		const mockLogger = {
			info: (msg: unknown) => console.log(pc.blue(String(msg))),
			warn: (msg: unknown) => console.warn(pc.yellow(String(msg))),
			error: (msg: unknown) => console.error(pc.red(String(msg))),
			debug: (msg: unknown) => console.debug(pc.gray(String(msg))),
		};

		// Mock Kythia instance for ModelLoader
		const mockKythia = {
			container: container as KythiaContainer,
			logger: mockLogger,
		};

		// Boot Models
		try {
			// Using require because export = bootModels
			const loader = require('../../database/ModelLoader');
			await loader(mockKythia, sequelize);
		} catch (error) {
			console.error(pc.red('❌ Failed to boot models:'), error);
			return;
		}

		const manager = new SeederManager(container as KythiaContainer);

		console.log(pc.green('🌱 Seeding database...'));

		try {
			if (options.class) {
				await manager.runSeeder(options.class);
			} else {
				await manager.runAll(options.addon);
			}
			console.log(pc.green('✅ Seeding completed successfully.'));
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			console.error(pc.red('🔥 Seeding failed:'), err.message);
		} finally {
			await sequelize.close();
		}
	}
}
