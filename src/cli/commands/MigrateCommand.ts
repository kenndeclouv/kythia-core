/**
 * 🚜 Database Migration Runner
 *
 * @file src/cli/commands/MigrateCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.4-beta
 *
 * @description
 * Manages database schema updates using Umzug. Supports standard migration,
 * fresh resets (nuclear option), and smart batch-based rollbacks.
 *
 * ✨ Core Features:
 * -  Fresh Mode: Wipes database and re-runs migrations from scratch.
 * -  Smart Rollback: Rolls back only the last batch of migrations.
 * -  Auto-Create: Detects missing database and offers to create it.
 * -  Safety Net: Prompts for confirmation on destructive actions.
 */

import Command from '../Command';
import { umzug, sequelize, storage } from '../utils/db';
import pc from 'picocolors';
import readline from 'node:readline';
import type { Command as CommanderCommand } from 'commander';

function promptYN(question: string): Promise<string> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase());
		});
	});
}

interface MigrateOptions {
	fresh?: boolean;
	rollback?: boolean;
}

export default class MigrateCommand extends Command {
	public signature = 'migrate';
	public description = 'Run pending database migrations';

	public configure(cmd: CommanderCommand): void {
		cmd
			.option('-f, --fresh', 'Wipe database and re-run all migrations')
			.option('-r, --rollback', 'Rollback the last batch of migrations');
	}

	public async handle(options: MigrateOptions): Promise<void> {
		console.log(pc.dim('🔌 Connecting to database...'));
		let needReauth = false;

		try {
			await sequelize.authenticate();
		} catch (err: any) {
			const dbErrorCodes = ['ER_BAD_DB_ERROR', '3D000'];
			if (
				dbErrorCodes.includes(err.original?.code) ||
				dbErrorCodes.includes(err.original?.sqlState)
			) {
				const dbName =
					(sequelize.config as any)?.database ||
					((sequelize as any).options as any)?.database ||
					'(unknown)';
				console.log(pc.red(`❗ Database "${dbName}" does not exist.`));
				const answer = await promptYN(
					pc.yellow(`Do you want to create the database "${dbName}"? (y/n): `),
				);
				if (answer === 'y' || answer === 'yes') {
					try {
						const { Sequelize } = require('sequelize');
						const currentDialect = sequelize.getDialect();
						const adminConfig = {
							...(sequelize.config as any),
							dialect: currentDialect,
						};

						if (currentDialect === 'mysql' || currentDialect === 'mariadb') {
							delete adminConfig.database;
						} else if (currentDialect === 'postgres') {
							adminConfig.database = 'postgres';
						} else if (currentDialect === 'sqlite') {
							console.log(
								pc.green('SQLite database file will be created automatically.'),
							);
						}

						const adminSequelize = new Sequelize(adminConfig);
						adminSequelize.options.logging = false;

						await adminSequelize
							.query(`CREATE DATABASE \`${dbName}\``)
							.catch(async (e: any) => {
								if (currentDialect === 'postgres') {
									await adminSequelize.query(`CREATE DATABASE "${dbName}"`);
								} else {
									throw e;
								}
							});

						await adminSequelize.close();
						console.log(pc.green(`✅ Database "${dbName}" created.`));
						needReauth = true;
					} catch (createErr: any) {
						console.error(
							pc.bgRed(' ERROR '),
							pc.red('Failed to create database:'),
							createErr.message,
						);
						process.exit(1);
					}
				} else {
					console.log(pc.red('Migration cancelled.'));
					process.exit(1);
				}
			} else {
				console.error(pc.bgRed(' ERROR '), pc.red(err.message));
				process.exit(1);
			}
		}

		if (needReauth) {
			try {
				await sequelize.authenticate();
			} catch (e: any) {
				console.error(
					pc.bgRed(' ERROR '),
					pc.red('Failed to connect after creating database:'),
					e.message,
				);
				process.exit(1);
			}
		}

		try {
			if (options.fresh) {
				console.log(pc.red('🧨 DROPPING ALL TABLES (Fresh)...'));

				const answer = await promptYN(
					pc.bgRed(pc.white(' DANGER ')) +
						pc.yellow(' This will wipe ALL DATA. Are you sure? (y/n): '),
				);
				if (answer !== 'y' && answer !== 'yes') {
					console.log(pc.cyan('Operation cancelled.'));
					process.exit(0);
				}

				const queryInterface = sequelize.getQueryInterface();

				if (
					sequelize.getDialect() === 'mysql' ||
					sequelize.getDialect() === 'mariadb'
				) {
					await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
				} else if (sequelize.getDialect() === 'sqlite') {
					await sequelize.query('PRAGMA foreign_keys = OFF', { raw: true });
				}

				try {
					await queryInterface.dropAllTables();

					await queryInterface.dropTable('migrations').catch(() => {});
					await queryInterface.dropTable('SequelizeMeta').catch(() => {});

					console.log(pc.green('✅ All tables dropped. Database is clean.'));
				} catch (e: any) {
					console.error(pc.red(`❌ Failed to drop tables: ${e.message}`));
					throw e;
				} finally {
					if (
						sequelize.getDialect() === 'mysql' ||
						sequelize.getDialect() === 'mariadb'
					) {
						await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });
					} else if (sequelize.getDialect() === 'sqlite') {
						await sequelize.query('PRAGMA foreign_keys = ON', { raw: true });
					}
				}

				console.log(pc.dim('   -> Re-running all migrations...'));

				if (storage && typeof storage.setBatch === 'function') {
					storage.setBatch(1);
				}

				const executed = await umzug.up();

				console.log(
					pc.green(
						`✅ Database refreshed! (${executed.length} migrations re-applied in Batch 1)`,
					),
				);
				return;
			}

			if (options.rollback) {
				const lastBatchNum = await storage.getLastBatchNumber();

				if (lastBatchNum === 0) {
					console.log(pc.gray('✨ Nothing to rollback (No batches found).'));
					return;
				}

				const filesInBatch = await storage.getLastBatchMigrations();

				console.log(
					pc.yellow(
						`⏪ Rolling back Batch #${lastBatchNum} (${filesInBatch.length} files)...`,
					),
				);

				if (filesInBatch.length > 0) {
					const rolledBack = await umzug.down({
						migrations: filesInBatch,
					});

					if (rolledBack.length === 0)
						console.log(
							pc.red('❌ Rollback logic executed but no files processed.'),
						);
					else
						console.log(
							pc.green(`✅ Batch #${lastBatchNum} rolled back successfully.`),
						);
				} else {
					console.log(
						pc.gray(
							'✨ Batch record exists but no files found (Manual DB modification?).',
						),
					);
				}
				return;
			}

			const pending = await umzug.pending();
			if (pending.length === 0) {
				console.log(pc.gray('✨ Nothing to migrate. Database is up to date.'));
				return;
			}

			const lastBatch = await storage.getLastBatchNumber();
			const newBatch = lastBatch + 1;

			storage.setBatch(newBatch);

			console.log(pc.cyan(`🚜 Running migrations (Batch #${newBatch})...`));

			const executed = await umzug.up();

			console.log(
				pc.green(`✅ Batch #${newBatch} completed (${executed.length} files).`),
			);
		} catch (err: any) {
			console.error(pc.bgRed(' ERROR '), pc.red(err.message));

			process.exit(1);
		} finally {
			await sequelize.close();
		}
	}
}
