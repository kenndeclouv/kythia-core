/**
 * 📐 Migration File Generator
 *
 * @file src/cli/commands/MakeMigrationCommand.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.0-beta
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

const Command = require('../Command');
const fs = require('node:fs');
const path = require('node:path');
const pc = require('picocolors');

class MakeMigrationCommand extends Command {
	signature = 'make:migration <name> <addon>';
	description = 'Create a new migration file for an addon';

	async handle(_options, name, addon) {
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
 * @assistant chaa & graa
 * @version 0.9.12-beta
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

module.exports = MakeMigrationCommand;
