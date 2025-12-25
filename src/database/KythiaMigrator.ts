/**
 * 🚜 Addon-based Database Migration Manager
 *
 * @file src/database/KythiaMigrator.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.5-beta
 *
 * @description
 * Scans 'addons' folder for migration files and executes them using Umzug.
 * It integrates with KythiaStorage (Laravel-style) to track migration batches.
 *
 * ✨ Core Features:
 * -  Auto-Discovery: Recursively finds migrations in `addons/{AddonName}/database/migrations`.
 * -  Sorting: Ensures migrations run in correct order (YYYYMMDD format).
 * -  Custom Logger: Clean, non-intrusive logging for the bot console.
 * -  Batch Integration: Uses KythiaStorage to support rollback by batch.
 */

import KythiaStorage = require('./KythiaStorage');
import { DataTypes } from 'sequelize';
import { Umzug } from 'umzug';
import path from 'node:path';
import fs from 'node:fs';
import type { KythiaMigratorFunction } from '../types/KythiaMigrator';

interface MigrationFile {
	name: string;
	path: string;
	folder: string;
}

function getMigrationFiles(rootDir: string): MigrationFile[] {
	const addonsDir = path.join(rootDir, 'addons');
	if (!fs.existsSync(addonsDir)) return [];

	const migrationFiles: MigrationFile[] = [];

	const addonFolders = fs
		.readdirSync(addonsDir)
		.filter((f) => fs.statSync(path.join(addonsDir, f)).isDirectory());

	for (const addon of addonFolders) {
		const migrationDir = path.join(addonsDir, addon, 'database', 'migrations');
		if (fs.existsSync(migrationDir)) {
			const files = fs
				.readdirSync(migrationDir)
				.filter((f) => f.endsWith('.js'))
				.map((f) => ({
					name: f,
					path: path.join(migrationDir, f),
					folder: migrationDir,
				}));
			migrationFiles.push(...files);
		}
	}

	return migrationFiles.sort((a, b) => a.name.localeCompare(b.name));
}

const KythiaMigrator: KythiaMigratorFunction = async ({
	sequelize,
	container,
	logger,
}) => {
	const rootDir = container.appRoot;
	const migrations = getMigrationFiles(rootDir);

	if (migrations.length === 0) {
		logger.info('📭 No migrations found in addons.');
		return;
	}

	const umzugLogger = {
		info: (event: any) => {
			if (typeof event === 'object') {
				if (event.event === 'migrating') {
				} else if (event.event === 'migrated') {
					logger.info(`✅ Migrated: ${event.name}`);
				}
			} else {
				logger.info(event);
			}
		},
		warn: (msg: any) => logger.warn(msg),
		error: (msg: any) => logger.error(msg),
		debug: (msg: any) => logger.debug(msg),
	};

	const umzug = new Umzug({
		migrations: migrations.map((m) => ({
			name: m.name,
			path: m.path,
			up: async ({ context }: { context: any }) => {
				const migration = require(m.path);
				return migration.up(context, DataTypes);
			},
			down: async ({ context }: { context: any }) => {
				const migration = require(m.path);
				return migration.down(context, DataTypes);
			},
		})),
		context: sequelize.getQueryInterface(),

		storage: new KythiaStorage({ sequelize }),
		logger: umzugLogger,
	});

	logger.info(`🚜 Checking migrations for ${migrations.length} files...`);

	try {
		const pending = await umzug.pending();

		if (pending.length > 0) {
			const executed = await umzug.up();
			if (executed.length > 0) {
				logger.info(`✨ Successfully applied ${executed.length} migrations.`);
			}
		} else {
			logger.info('✨ Database is already up to date.');
		}
	} catch (error) {
		logger.error('🔥 Migration Failed:', error);
		process.exit(1);
	}
};

export = KythiaMigrator;
