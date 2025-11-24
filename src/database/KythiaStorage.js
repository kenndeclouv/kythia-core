/**
 * 🗄️ Laravel-Style Migration Storage Adapter
 *
 * @file src/database/KythiaStorage.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.0-beta
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

const { DataTypes } = require('sequelize');

class KythiaStorage {
	constructor({ sequelize, tableName = 'migrations' }) {
		this.sequelize = sequelize;
		this.tableName = tableName;
		this.currentBatch = 1;
	}

	async ensureTable() {
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

	async executed() {
		await this.ensureTable();
		const [results] = await this.sequelize.query(
			`SELECT name FROM ${this.tableName} ORDER BY id ASC`,
		);
		return results.map((r) => r.name);
	}

	async logMigration({ name }) {
		await this.ensureTable();

		await this.sequelize.query(
			`INSERT INTO ${this.tableName} (name, batch, migration_time) VALUES (?, ?, ?)`,
			{
				replacements: [name, this.currentBatch, new Date()],
				type: this.sequelize.QueryTypes.INSERT,
			},
		);
	}

	async unlogMigration({ name }) {
		await this.ensureTable();
		await this.sequelize.query(`DELETE FROM ${this.tableName} WHERE name = ?`, {
			replacements: [name],
			type: this.sequelize.QueryTypes.DELETE,
		});
	}

	setBatch(batchNumber) {
		this.currentBatch = batchNumber;
	}

	async getLastBatchNumber() {
		await this.ensureTable();
		const [result] = await this.sequelize.query(
			`SELECT MAX(batch) as max_batch FROM ${this.tableName}`,
			{
				type: this.sequelize.QueryTypes.SELECT,
			},
		);
		return result ? result.max_batch || 0 : 0;
	}

	async getLastBatchMigrations() {
		await this.ensureTable();
		const lastBatch = await this.getLastBatchNumber();
		if (lastBatch === 0) return [];

		const migrations = await this.sequelize.query(
			`SELECT name FROM ${this.tableName} WHERE batch = ? ORDER BY id DESC`,
			{
				replacements: [lastBatch],
				type: this.sequelize.QueryTypes.SELECT,
			},
		);

		return migrations.map((m) => m.name);
	}
}

module.exports = KythiaStorage;
