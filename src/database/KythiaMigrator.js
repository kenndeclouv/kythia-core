/**
 * 🚜 Addon-based Database Migration Manager
 *
 * @file src/database/KythiaMigrator.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.10.0-beta
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

const KythiaStorage = require('./KythiaStorage');
const { DataTypes } = require('sequelize');
const { Umzug } = require('umzug');
const path = require('node:path');
const fs = require('node:fs');

function getMigrationFiles(rootDir) {
	const addonsDir = path.join(rootDir, 'addons');
	if (!fs.existsSync(addonsDir)) return [];

	const migrationFiles = [];

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

async function KythiaMigrator({ sequelize, container, logger }) {
	const rootDir = container.appRoot;
	const migrations = getMigrationFiles(rootDir);

	if (migrations.length === 0) {
		logger.info('📭 No migrations found in addons.');
		return;
	}

	const umzugLogger = {
		info: (event) => {
			if (typeof event === 'object') {
				if (event.event === 'migrating') {
				} else if (event.event === 'migrated') {
					logger.info(`✅ Migrated: ${event.name}`);
				}
			} else {
				logger.info(event);
			}
		},
		warn: (msg) => logger.warn(msg),
		error: (msg) => logger.error(msg),
	};

	const umzug = new Umzug({
		migrations: migrations.map((m) => ({
			name: m.name,
			path: m.path,
			up: async ({ context }) => {
				const migration = require(m.path);
				return migration.up(context, DataTypes);
			},
			down: async ({ context }) => {
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
}

module.exports = KythiaMigrator;
