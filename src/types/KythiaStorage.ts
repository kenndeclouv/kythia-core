import type { Sequelize } from 'sequelize';

export interface KythiaStorageOptions {
	sequelize: Sequelize;
	tableName?: string;
}

export interface KythiaStorage {
	sequelize: Sequelize;
	tableName: string;
	currentBatch: number;

	ensureTable(): Promise<void>;
	executed(): Promise<string[]>;
	logMigration(migration: { name: string }): Promise<void>;
	unlogMigration(migration: { name: string }): Promise<void>;
	setBatch(batchNumber: number): void;
	getLastBatchNumber(): Promise<number>;
	getLastBatchMigrations(): Promise<string[]>;
}
