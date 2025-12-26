/**
 * 📐 Migration File Generator
 *
 * @file src/cli/commands/MakeMigrationCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.7-beta
 *
 * @description
 * Scaffolds a new database migration file with a precise YYYYMMDD_HHMMSS timestamp prefix.
 * Places the file in the specified addon's migration directory.
 *
 * ✨ Core Features:
 * -  Timestamped Ordering: Ensures migrations run in creation order.
 * -  Addon Aware: Targets the correct module folder automatically.
 * -  Template Injection: Provides standard up/down methods via `queryInterface`.
 */

import Command from '../Command';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export default class MakeMigrationCommand extends Command {
	public signature = 'make:migration <name> <addon>';
	public description = 'Create a new migration file for an addon';

	public async handle(
		_options: Record<string, any>,
		name: string,
		addon: string,
	): Promise<void> {
		const rootDir = process.cwd();
		const targetDir = path.join(
			rootDir,
			'addons',
			addon,
			'database',
			'migrations',
		);

		if (!fs.existsSync(path.join(rootDir, 'addons', addon))) {
			console.error(pc.red(`❌ Addon '${addon}' not found!`));
			process.exit(1);
		}

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		const now = new Date();
		const timestamp = now
			.toISOString()
			.replace(/T/, '_')
			.replace(/[-:]/g, '')
			.split('.')[0];
		const fileName = `${timestamp}_${name}.js`;
		const filePath = path.join(targetDir, fileName);

		const template = `/**
 * @namespace: addons/${addon}/database/migrations/${fileName}
 * @type: Database Migration
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.7-beta
 */
module.exports = {
    async up(queryInterface, DataTypes) {
        // await queryInterface.createTable('table_name', { 
		// 		id: DataTypes.INTEGER 
		// });
    },

    async down(queryInterface, DataTypes) {
        // await queryInterface.dropTable('table_name');
    }
};`;

		fs.writeFileSync(filePath, template);

		console.log(pc.green('✅ Created migration:'));
		console.log(pc.dim(`   addons/${addon}/database/migrations/${fileName}`));
	}
}
