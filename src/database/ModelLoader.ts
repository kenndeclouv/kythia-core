/**
 * 🤖 Automatic Model Loader & Bootstrapper
 *
 * @file src/loaders/ModelLoader.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.8-beta
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
import type { BootModels, AnySequelizeModel } from '../types/ModelLoader';
import { Model } from 'sequelize';
import type {
	KythiaModelStatic,
	KythiaModelWithAssociations,
} from '../types/Sequelize';

const bootModels: BootModels = async (kythiaInstance, sequelize) => {
	const { container, logger } = kythiaInstance;
	const addonsDir = path.join(process.cwd(), 'addons');

	if (!fs.existsSync(addonsDir)) return;

	const loadedModels: KythiaModelStatic[] = [];
	const addonFolders = fs
		.readdirSync(addonsDir)
		.filter((f) => fs.statSync(path.join(addonsDir, f)).isDirectory());

	logger.info('📂 Scanning & Booting Models...');

	for (const addon of addonFolders) {
		// Skip disabled addons
		try {
			const configAddons = container.kythiaConfig?.addons || {};

			if (
				configAddons.all?.active === false ||
				configAddons[addon]?.active === false
			) {
				logger.info(`🟠 Skipping models for disabled addon: ${addon}`);
				continue;
			}
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			logger.warn(
				`Failed to check config for addon ${addon}: ${error.message}`,
			);
		}

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
			// Cast sequelize to any as KythiaModelStatic expects a specific Sequelize instance type
			// which might be slightly different here
			await ModelClass.autoBoot(sequelize as any);

			container.models[ModelClass.name] =
				ModelClass as unknown as AnySequelizeModel;
			logger.info(
				`   ✨ Booted: ${ModelClass.name} -> ${ModelClass.tableName}`,
			);
		} catch (err) {
			logger.error(`❌ AutoBoot Failed for ${ModelClass.name}:`, err);
		}
	}

	logger.info('🔗 Linking Associations...');
	Object.values(container.models).forEach((model) => {
		const ModelClass = model as unknown as KythiaModelWithAssociations;
		if (ModelClass.associate) {
			ModelClass.associate(
				container.models as unknown as Record<string, KythiaModelStatic>,
			);
		}
	});
};

export = bootModels;
