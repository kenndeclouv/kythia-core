/**
 * 🚜 Database Migration Runner
 *
 * @file src/cli/commands/MigrateCommand.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.0-beta
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

const Command = require('../Command');
const { umzug, sequelize, storage } = require('../utils/db');
const pc = require('picocolors');
const readline = require('node:readline');

function promptYN(question) {
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

class MigrateCommand extends Command {
	signature = 'migrate';
	description = 'Run pending database migrations';

	configure(cmd) {
		cmd
			.option('-f, --fresh', 'Wipe database and re-run all migrations')
			.option('-r, --rollback', 'Rollback the last batch of migrations');
	}

	async handle(options) {
		console.log(pc.dim('🔌 Connecting to database...'));
		let needReauth = false;

		try {
			await sequelize.authenticate();
		} catch (err) {
			const dbErrorCodes = ['ER_BAD_DB_ERROR', '3D000'];
			if (
				dbErrorCodes.includes(err.original?.code) ||
				dbErrorCodes.includes(err.original?.sqlState)
			) {
				const dbName = sequelize.config?.database || '(unknown)';
				console.log(pc.red(`❗ Database "${dbName}" does not exist.`));
				const answer = await promptYN(
					pc.yellow(`Do you want to create the database "${dbName}"? (y/n): `),
				);
				if (answer === 'y' || answer === 'yes') {
					try {
						const { Sequelize } = require('sequelize');
						const currentDialect = sequelize.getDialect();
						const adminConfig = {
							...sequelize.config,
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
							.catch(async (e) => {
								if (currentDialect === 'postgres') {
									await adminSequelize.query(`CREATE DATABASE "${dbName}"`);
								} else {
									throw e;
								}
							});

						await adminSequelize.close();
						console.log(pc.green(`✅ Database "${dbName}" created.`));
						needReauth = true;
					} catch (createErr) {
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
			} catch (e) {
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
				} catch (e) {
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
		} catch (err) {
			console.error(pc.bgRed(' ERROR '), pc.red(err.message));

			process.exit(1);
		} finally {
			await sequelize.close();
		}
	}
}

module.exports = MigrateCommand;
