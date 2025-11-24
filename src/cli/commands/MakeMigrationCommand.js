/**
 * @namespace: src/cli/commands/MakeMigrationCommand.js
 * @type: Command
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.12-beta
 */

const fs = require('node:fs');
const path = require('node:path');
const pc = require('picocolors');

module.exports = {
	execute(options) {
		const { name, addon } = options;
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
	},
};
