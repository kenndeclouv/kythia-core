/**
 * 🔌 CLI Database & Migration Bootstrapper
 *
 * @file src/cli/utils/db.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.2-beta
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

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Umzug } from 'umzug';
import { DataTypes, type QueryInterface } from 'sequelize';

const pc = require('picocolors');

import createSequelizeInstance from '../../database/KythiaSequelize';
import KythiaStorage from '../../database/KythiaStorage';
import type { KythiaConfig } from '../../types';

// Cari config
const configPath = path.resolve(process.cwd(), 'kythia.config.js');

if (!fs.existsSync(configPath)) {
	console.error('❌ kythia.config.js not found in root directory!');
	process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(configPath) as KythiaConfig;

// Init Sequelize
const sequelize = createSequelizeInstance(config);

interface MigrationFile {
	name: string;
	path: string;
}

function getMigrationFiles(): MigrationFile[] {
	const rootDir = process.cwd();
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
				.filter((f) => f.endsWith('.js') || f.endsWith('.ts')) // Support TS migrations too
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
	info: (event: any) => {
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
	warn: (msg: any) =>
		console.warn(
			pc.yellow(`⚠️ ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`),
		),
	error: (msg: any) =>
		console.error(
			pc.red(`🔥 ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`),
		),
	debug: (msg: any) =>
		console.debug(
			pc.gray(`🐛 ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`),
		),
};

const umzug = new Umzug({
	migrations: getMigrationFiles().map((m) => ({
		name: m.name,
		path: m.path,
		up: async ({ context }: { context: QueryInterface }) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const migration = require(m.path);
			return migration.up(context, DataTypes);
		},
		down: async ({ context }: { context: QueryInterface }) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const migration = require(m.path);
			return migration.down(context, DataTypes);
		},
	})),
	context: sequelize.getQueryInterface(),
	storage: storage,
	logger: umzugLogger,
});

export { sequelize, umzug, storage };
