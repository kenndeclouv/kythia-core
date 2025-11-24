/**
 * @namespace: src/cli/commands/MakeModelCommand.js
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
		const targetDir = path.join(rootDir, 'addons', addon, 'database', 'models');

		// Cek Addon Exists
		if (!fs.existsSync(path.join(rootDir, 'addons', addon))) {
			console.error(pc.red(`❌ Addon '${addon}' not found!`));
			process.exit(1);
		}

		// Bikin folder models kalau belum ada
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		const fileName = `${name}.js`;
		const filePath = path.join(targetDir, fileName);

		// Cek duplicate
		if (fs.existsSync(filePath)) {
			console.error(
				pc.red(`❌ Model '${fileName}' already exists in ${addon}!`),
			);
			process.exit(1);
		}

		// Template Standar KythiaModel
		const template = `/**
 * @namespace: addons/${addon}/database/models/${fileName}
 * @type: Database Model
 * @copyright © ${new Date().getFullYear()} kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.12-beta
 */

const { DataTypes } = require("sequelize");
const { KythiaModel } = require("kythia-core");

class ${name} extends KythiaModel {
    static guarded = ["id"];

    static get structure() {
        return {
            options: { timestamps: true },
        };
    }
}

module.exports = ${name};`;

		fs.writeFileSync(filePath, template);

		console.log(pc.green('✅ Created Model:'));
		console.log(pc.dim(`   addons/${addon}/database/models/${fileName}`));
	},
};
