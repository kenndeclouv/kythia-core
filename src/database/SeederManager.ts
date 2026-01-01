/**
 * 🚜 Addon-based Database Seeder Manager
 *
 * @file src/database/SeederManager.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
 *
 * @description
 * Discovers and executes seeders from 'addons' directories.
 * Mimics Laravel's seeding system but adapted for the Kythia addon architecture.
 */

import { Seeder } from './Seeder';
import type { KythiaContainer } from '../types';
import path from 'node:path';
import fs from 'node:fs';

interface SeederFile {
	name: string;
	path: string;
	addon: string;
}

export class SeederManager {
	private container: KythiaContainer;

	constructor(container: KythiaContainer) {
		this.container = container;
	}

	/**
	 * Discovers all seeder files across enabled addons.
	 */
	public getSeederFiles(): SeederFile[] {
		const rootDir = this.container.appRoot;
		const addonsDir = path.join(rootDir, 'addons');
		if (!fs.existsSync(addonsDir)) return [];

		const seederFiles: SeederFile[] = [];
		const configAddons = this.container.kythiaConfig?.addons || {};

		const addonFolders = fs
			.readdirSync(addonsDir)
			.filter((f) => fs.statSync(path.join(addonsDir, f)).isDirectory());

		for (const addon of addonFolders) {
			// Skip disabled addons
			if (
				configAddons.all?.active === false ||
				configAddons[addon]?.active === false
			) {
				continue;
			}

			const seederDir = path.join(addonsDir, addon, 'database', 'seeders');
			if (fs.existsSync(seederDir)) {
				const files = fs
					.readdirSync(seederDir)
					.filter(
						(f) =>
							f.endsWith('.js') || (f.endsWith('.ts') && !f.endsWith('.d.ts')),
					)
					.map((f) => ({
						name: path.parse(f).name,
						path: path.join(seederDir, f),
						addon: addon,
					}));
				seederFiles.push(...files);
			}
		}

		return seederFiles;
	}

	/**
	 * Run a specific seeder by class name.
	 * @param className The name of the seeder class to run.
	 */
	public async runSeeder(className: string): Promise<void> {
		const seeders = this.getSeederFiles();
		const seederFile = seeders.find((s) => s.name === className);

		if (!seederFile) {
			throw new Error(`Seeder class '${className}' not found.`);
		}

		await this.executeSeeder(seederFile);
	}

	/**
	 * Run all discovered seeders.
	 * Can be filtered by addon name.
	 * @param addonFilter Optional addon name to filter by.
	 */
	public async runAll(addonFilter?: string): Promise<void> {
		let seeders = this.getSeederFiles();

		if (addonFilter) {
			seeders = seeders.filter((s) => s.addon === addonFilter);
		}

		for (const seeder of seeders) {
			await this.executeSeeder(seeder);
		}
	}

	/**
	 * Internal method to load and execute a seeder file.
	 */
	private async executeSeeder(file: SeederFile): Promise<void> {
		const moduleExport = require(file.path);
		// Support both default export and named export matching the file name
		const SeederClass =
			moduleExport.default || moduleExport[file.name] || moduleExport;

		if (typeof SeederClass !== 'function') {
			throw new Error(
				`File '${file.path}' does not export a valid Seeder class.`,
			);
		}

		const seederInstance = new SeederClass(this.container);

		if (!(seederInstance instanceof Seeder)) {
			// In case user forgot to extend Seeder, checking for run method might be safer duck typing
			if (typeof seederInstance.run !== 'function') {
				throw new Error(
					`Class in '${file.path}' must extend Seeder or have a run() method.`,
				);
			}
		}

		await seederInstance.run();
	}
}
