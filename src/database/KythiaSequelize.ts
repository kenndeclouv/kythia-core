/**
 * 🧠 Sequelize Connection Factory
 *
 * @file src/database/KythiaSequelize.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.8-beta
 *
 * @description
 * Main Sequelize connection factory for the application.
 */

import { Sequelize, type Dialect, type Options } from 'sequelize';
import kythiaLogger from '../utils/logger';
import type { CreateSequelizeInstance } from '../types/KythiaSequelize';

const createSequelizeInstance: CreateSequelizeInstance = (
	config,
	logger = kythiaLogger,
) => {
	const dbConfig = config.db || {};
	if (!config.db) config.db = dbConfig as any;

	let driver = dbConfig.driver || process.env.DB_DRIVER;
	let name = dbConfig.name || process.env.DB_NAME;

	if (!driver) {
		driver = 'sqlite';
		if (logger)
			logger.info('💡 DB driver not specified. Defaulting to: sqlite');
	} else {
		driver = driver.toLowerCase() as Dialect;
	}

	if (driver === 'sqlite') {
		if (!name || name === '') {
			name = 'kythiadata.sqlite';
			if (logger)
				logger.info(
					'💡 DB name for sqlite not specified. Defaulting to: kythiadata.sqlite',
				);
		}
	}

	dbConfig.driver = driver as any;
	dbConfig.name = name as string;

	const dialect = dbConfig.driver as Dialect;
	const dbName = dbConfig.name;
	const dbUser = dbConfig.user || process.env.DB_USER;

	const dbPassword = dbConfig.pass || process.env.DB_PASSWORD;
	const dbHost = dbConfig.host || process.env.DB_HOST;
	const dbPort =
		(dbConfig.port ? Number(dbConfig.port) : undefined) ||
		(process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined);

	const dbSocket = dbConfig.socketPath || process.env.DB_SOCKET_PATH;
	const dbSsl = dbConfig.ssl || process.env.DB_SSL;
	const dbDialectOptions =
		dbConfig.dialectOptions || process.env.DB_DIALECT_OPTIONS;

	const seqConfig: Options = {
		database: dbName,
		username: dbUser,
		password: dbPassword,
		dialect: dialect,
		logging: (sql) => {
			logger.debug(sql);
		},
		define: {
			charset: 'utf8mb4',
			collate: 'utf8mb4_unicode_ci',
		},
		pool: {
			max: dbConfig.pool?.max || 10,
			min: dbConfig.pool?.min || 0,
			acquire: dbConfig.pool?.acquire || 30000,
			idle: dbConfig.pool?.idle || 10000,
		},
	};

	if (dialect !== 'sqlite') {
		seqConfig.timezone = dbConfig.timezone || '+00:00';
	}

	switch (dialect) {
		case 'sqlite':
			seqConfig.storage = dbConfig.name;
			delete seqConfig.database;
			break;

		case 'mysql':
		case 'mariadb':
			seqConfig.host = dbHost;
			seqConfig.port = dbPort;
			if (dbSocket) {
				seqConfig.dialectOptions = { socketPath: dbSocket };
			}
			break;

		case 'postgres':
			seqConfig.host = dbHost;
			seqConfig.port = dbPort;
			if (dbSsl === 'true' || dbSsl === true) {
				seqConfig.dialectOptions = {
					ssl: { require: true, rejectUnauthorized: false },
				};
			}
			break;

		case 'mssql':
			seqConfig.host = dbHost;
			seqConfig.port = dbPort;
			if (dbDialectOptions) {
				try {
					seqConfig.dialectOptions =
						typeof dbDialectOptions === 'string'
							? JSON.parse(dbDialectOptions)
							: dbDialectOptions;
				} catch (error: unknown) {
					logger.error('❌ Query failed:', error);
					throw error;
				}
			}
			break;

		default:
			throw new Error(`${dialect} is not supported or not configured.`);
	}

	return new Sequelize(seqConfig);
};

export = createSequelizeInstance;
