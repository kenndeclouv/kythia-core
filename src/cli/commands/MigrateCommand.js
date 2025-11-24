/**
 * @namespace: src/cli/commands/MigrateCommand.js
 * @type: Command
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.12-beta
 */

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

module.exports = {
	async execute(options) {
		console.log(pc.dim('🔌 Connecting to database...'));
		let needReauth = false;

		// 1. Cek Koneksi & Create DB logic (Sama kayak kodemu yg lama)
		try {
			await sequelize.authenticate();
		} catch (err) {
			const dbErrorCodes = ['ER_BAD_DB_ERROR', '3D000']; // mysql & pg
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

		// 2. EXECUTE MIGRATION LOGIC
		try {
			// ============================================================
			// 🧨 MODE: FRESH (Reset Total)
			// ============================================================
			// --- MODE: FRESH ---
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

				// 🔥 NUCLEAR OPTION: Disable Foreign Keys -> Drop All -> Enable Foreign Keys
				const queryInterface = sequelize.getQueryInterface();

				// 1. Matikan Foreign Key Checks (Biar bisa hapus tabel sembarangan)
				if (
					sequelize.getDialect() === 'mysql' ||
					sequelize.getDialect() === 'mariadb'
				) {
					await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
				} else if (sequelize.getDialect() === 'sqlite') {
					await sequelize.query('PRAGMA foreign_keys = OFF', { raw: true });
				}
				// (Postgres biasanya pake CASCADE di dropTable, tapi dropAllTables sequelize udah handle lumayan oke)

				try {
					// 2. Drop Semua Tabel
					await queryInterface.dropAllTables();

					// 3. Hapus tabel history migrasi kita juga
					await queryInterface.dropTable('migrations').catch(() => {});
					await queryInterface.dropTable('SequelizeMeta').catch(() => {});

					console.log(pc.green('✅ All tables dropped. Database is clean.'));
				} catch (e) {
					console.error(pc.red(`❌ Failed to drop tables: ${e.message}`));
					throw e;
				} finally {
					// 4. Hidupkan lagi Foreign Key Checks (PENTING!)
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

				// Reset batch di storage
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

			// ============================================================
			// ⏪ MODE: ROLLBACK (Smart Batching)
			// ============================================================
			if (options.rollback) {
				// 1. Cari nomor batch terakhir di DB
				const lastBatchNum = await storage.getLastBatchNumber();

				if (lastBatchNum === 0) {
					console.log(pc.gray('✨ Nothing to rollback (No batches found).'));
					return;
				}

				// 2. Ambil semua file yang ada di batch tersebut
				const filesInBatch = await storage.getLastBatchMigrations();

				console.log(
					pc.yellow(
						`⏪ Rolling back Batch #${lastBatchNum} (${filesInBatch.length} files)...`,
					),
				);

				if (filesInBatch.length > 0) {
					// 3. Suruh Umzug rollback KHUSUS file-file tersebut
					const rolledBack = await umzug.down({
						migrations: filesInBatch, // 👈 INI KUNCINYA
					});

					// Logging handled by umzugLogger in db.js usually, but summary here:
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

			// ============================================================
			// 🚜 MODE: MIGRATE (Default)
			// ============================================================

			// 1. Cek dulu ada yang pending gak?
			const pending = await umzug.pending();
			if (pending.length === 0) {
				console.log(pc.gray('✨ Nothing to migrate. Database is up to date.'));
				return;
			}

			// 2. Kalkulasi Batch Baru (Last Batch + 1)
			// Ini biar nanti pas rollback, mereka dianggap satu paket
			const lastBatch = await storage.getLastBatchNumber();
			const newBatch = lastBatch + 1;

			storage.setBatch(newBatch); // Inject ke storage adapter

			console.log(pc.cyan(`🚜 Running migrations (Batch #${newBatch})...`));

			// 3. Eksekusi
			const executed = await umzug.up();

			// Logging detail sudah di-handle umzugLogger di db.js
			console.log(
				pc.green(`✅ Batch #${newBatch} completed (${executed.length} files).`),
			);
		} catch (err) {
			console.error(pc.bgRed(' ERROR '), pc.red(err.message));
			// console.error(pc.dim(err.stack));
			process.exit(1);
		} finally {
			await sequelize.close();
		}
	},
};
