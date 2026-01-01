/**
 * 📦 Model Scaffolding Tool
 *
 * @file src/cli/commands/MakeModelCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
 *
 * @description
 * Generates new Sequelize model files extending `KythiaModel`.
 * Automatically creates the directory structure and populates standard boilerplate.
 *
 * ✨ Core Features:
 * -  Smart Scaffolding: Creates models in `addons/{addon}/database/models`.
 * -  Duplicate Protection: Prevents overwriting existing models.
 * -  Standard Boilerplate: Includes `guarded` and `structure` properties by default.
 */

import Command from '../Command';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export default class MakeModelCommand extends Command {
	public signature = 'make:model <name> <addon>';
	public description = 'Create a new KythiaModel file';

	public async handle(
		_options: Record<string, any>,
		name: string,
		addon: string,
	): Promise<void> {
		//
		const rootDir = process.cwd();
		const targetDir = path.join(rootDir, 'addons', addon, 'database', 'models');

		if (!fs.existsSync(path.join(rootDir, 'addons', addon))) {
			console.error(pc.red(`❌ Addon '${addon}' not found!`));
			process.exit(1);
		}

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		const fileName = `${name}.js`;
		const filePath = path.join(targetDir, fileName);

		if (fs.existsSync(filePath)) {
			console.error(
				pc.red(`❌ Model '${fileName}' already exists in ${addon}!`),
			);
			process.exit(1);
		}

		const template = `/**
 * @namespace: addons/${addon}/database/models/${fileName}
 * @type: Database Model
 * @copyright © ${new Date().getFullYear()} kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
 */

const { KythiaModel } = require("kythia-core");

class ${name} extends KythiaModel {
    static guarded = [];

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
	}
}
