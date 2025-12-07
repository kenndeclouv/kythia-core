/**
 * 🤖 Automatic Model Loader & Bootstrapper
 *
 * @file src/loaders/ModelLoader.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.0-beta.1
 *
 * @description
 * Scans the `addons` directory for KythiaModel definitions, requires them,
 * and executes their `autoBoot` static method for database introspection.
 * Finally, it links Sequelize associations after all models are loaded.
 *
 * ✨ Core Features:
 * -  Addon Scanning: Finds models in `addons/{AddonName}/database/models`.
 * -  AutoBoot Execution: Triggers DB introspection (reading columns from DB).
 * -  Association Linking: Automatically calls `.associate()` on models if defined.
 * -  Container Registration: Registers booted models into the global container.
 */

import path from 'node:path';
import fs from 'node:fs';
import type { BootModels } from '../types/ModelLoader';

const bootModels: BootModels = async (kythiaInstance, sequelize) => {
	const { container, logger } = kythiaInstance;
	const rootDir = container.appRoot;
	const addonsDir = path.join(rootDir, 'addons');

	if (!fs.existsSync(addonsDir)) return;

	const loadedModels: any[] = [];
	const addonFolders = fs
		.readdirSync(addonsDir)
		.filter((f) => fs.statSync(path.join(addonsDir, f)).isDirectory());

	logger.info('📂 Scanning & Booting Models...');

	for (const addon of addonFolders) {
		const modelsDir = path.join(addonsDir, addon, 'database', 'models');
		if (fs.existsSync(modelsDir)) {
			const files = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js'));

			for (const file of files) {
				const modelPath = path.join(modelsDir, file);
				try {
					const ModelClass = require(modelPath);

					if (ModelClass.autoBoot) {
						loadedModels.push(ModelClass);
					}
				} catch (err) {
					logger.error(`❌ Failed to require model ${file}:`, err);
				}
			}
		}
	}

	for (const ModelClass of loadedModels) {
		try {
			await ModelClass.autoBoot(sequelize);

			container.models[ModelClass.name] = ModelClass;
			logger.info(
				`   ✨ Booted: ${ModelClass.name} -> ${ModelClass.tableName}`,
			);
		} catch (err) {
			logger.error(`❌ AutoBoot Failed for ${ModelClass.name}:`, err);
		}
	}

	logger.info('🔗 Linking Associations...');
	Object.values(container.models).forEach((model: any) => {
		if (model.associate) {
			model.associate(container.models);
		}
	});
};

export = bootModels;
