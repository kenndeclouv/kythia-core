/**
 * 🔌 CLI Database & Migration Bootstrapper
 *
 * @file src/cli/utils/db.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.0-beta
 *
 * @description
 * Initializes the database connection and migration engine (Umzug) specifically
 * for CLI operations. It dynamically loads the project configuration and
 * discovers migration files across all addons.
 *
 * ✨ Core Features:
 * -  Dynamic Config: Loads `kythia.config.js` from the user's project root.
 * -  Auto-Discovery: Scans `addons` directory for migration files.
 * -  Pretty Logging: Custom console output using `picocolors` for migration status.
 * -  Singleton-like: Exports shared instances of Sequelize and Umzug.
 */

require('@dotenvx/dotenvx/config');
const fs = require('node:fs');
const path = require('node:path');
const { Umzug } = require('umzug');
const createSequelizeInstance = require('../../database/KythiaSequelize');
const KythiaStorage = require('../../database/KythiaStorage');
const pc = require('picocolors');

const configPath = path.resolve(process.cwd(), 'kythia.config.js');

if (!fs.existsSync(configPath)) {
	console.error('❌ kythia.config.js not found in root directory!');
	process.exit(1);
}

const config = require(configPath);

const logger = {
	info: () => {},
	error: console.error,
	debug: () => {},
};

const sequelize = createSequelizeInstance(config, logger);

function getMigrationFiles() {
	const rootDir = process.cwd();
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
				}));
			migrationFiles.push(...files);
		}
	}
	return migrationFiles.sort((a, b) => a.name.localeCompare(b.name));
}

const storage = new KythiaStorage({ sequelize });

const umzugLogger = {
	info: (event) => {
		if (typeof event === 'object') {
			if (event.event === 'migrated') {
				console.log(
					pc.green(`✅ Migrated:  ${event.name} `) +
						pc.gray(`(${event.durationSeconds}s)`),
				);
			} else if (event.event === 'reverting') {
				console.log(pc.yellow(`↩️ Reverting: ${event.name}`));
			} else if (event.event === 'reverted') {
				console.log(
					pc.red(`❌ Reverted:  ${event.name} `) +
						pc.gray(`(${event.durationSeconds}s)`),
				);
			}
		} else {
			console.log(pc.dim(event));
		}
	},
	warn: (msg) => console.warn(pc.yellow(`⚠️ ${msg}`)),
	error: (msg) => console.error(pc.red(`🔥 ${msg}`)),
};

const umzug = new Umzug({
	migrations: getMigrationFiles().map((m) => ({
		name: m.name,
		path: m.path,
		up: async ({ context }) => {
			const migration = require(m.path);
			return migration.up(context, require('sequelize').DataTypes);
		},
		down: async ({ context }) => {
			const migration = require(m.path);
			return migration.down(context, require('sequelize').DataTypes);
		},
	})),
	context: sequelize.getQueryInterface(),
	storage: storage,
	logger: umzugLogger,
});

module.exports = { sequelize, umzug, storage };
