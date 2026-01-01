/**
 * 🗄️ Laravel-Style Migration Storage Adapter
 *
 * @file src/database/KythiaStorage.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.8-beta
 *
 * @description
 * Custom storage adapter for Umzug that mimics Laravel's migration table structure.
 * It adds a 'batch' column to the migrations table, allowing for smart rollbacks
 * (undoing only the last batch of migrations instead of just the last file).
 *
 * ✨ Core Features:
 * -  Batch Tracking: Stores migration batch numbers.
 * -  Auto-Setup: Creates the migrations table automatically if missing.
 * -  Smart Rollback Support: Methods to fetch the last batch ID and files.
 */

import { DataTypes, type Sequelize, QueryTypes } from 'sequelize';
import type {
	KythiaStorage as IKythiaStorage,
	KythiaStorageOptions,
} from '../types/KythiaStorage';

class KythiaStorage implements IKythiaStorage {
	public sequelize: Sequelize;
	public tableName: string;
	public currentBatch: number;

	constructor({ sequelize, tableName = 'migrations' }: KythiaStorageOptions) {
		this.sequelize = sequelize;
		this.tableName = tableName;
		this.currentBatch = 1;
	}

	async ensureTable(): Promise<void> {
		const queryInterface = this.sequelize.getQueryInterface();

		const tables = await queryInterface.showAllTables();
		if (!tables.includes(this.tableName)) {
			await queryInterface.createTable(this.tableName, {
				id: {
					type: DataTypes.INTEGER,
					primaryKey: true,
					autoIncrement: true,
				},
				name: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				batch: {
					type: DataTypes.INTEGER,
					allowNull: false,
					defaultValue: 1,
				},
				migration_time: {
					type: DataTypes.DATE,
					defaultValue: DataTypes.NOW,
				},
			});
		}
	}

	async executed(): Promise<string[]> {
		await this.ensureTable();
		const [results] = await this.sequelize.query(
			`SELECT name FROM ${this.tableName} ORDER BY id ASC`,
		);

		interface MigrationRecord {
			name: string;
		}

		return (results as MigrationRecord[]).map((r) => r.name);
	}

	async logMigration({ name }: { name: string }): Promise<void> {
		await this.ensureTable();

		await this.sequelize.query(
			`INSERT INTO ${this.tableName} (name, batch, migration_time) VALUES (?, ?, ?)`,
			{
				replacements: [name, this.currentBatch, new Date()],
				type: QueryTypes.INSERT,
			},
		);
	}

	async unlogMigration({ name }: { name: string }): Promise<void> {
		await this.ensureTable();
		await this.sequelize.query(`DELETE FROM ${this.tableName} WHERE name = ?`, {
			replacements: [name],
			type: QueryTypes.DELETE,
		});
	}

	setBatch(batchNumber: number): void {
		this.currentBatch = batchNumber;
	}

	async getLastBatchNumber(): Promise<number> {
		await this.ensureTable();
		const [result] = await this.sequelize.query(
			`SELECT MAX(batch) as max_batch FROM ${this.tableName}`,
			{
				type: QueryTypes.SELECT,
			},
		);

		interface BatchResult {
			max_batch: number | null;
		}

		return result ? (result as BatchResult).max_batch || 0 : 0;
	}

	async getLastBatchMigrations(): Promise<string[]> {
		await this.ensureTable();
		const lastBatch = await this.getLastBatchNumber();
		if (lastBatch === 0) return [];

		const migrations = await this.sequelize.query(
			`SELECT name FROM ${this.tableName} WHERE batch = ? ORDER BY id DESC`,
			{
				replacements: [lastBatch],
				type: QueryTypes.SELECT,
			},
		);

		interface MigrationRecord {
			name: string;
		}

		return (migrations as MigrationRecord[]).map((m) => m.name);
	}
}

export default KythiaStorage;
