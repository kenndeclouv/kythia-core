/**
 * 🧠 Sequelize Connection Factory
 *
 * @file src/database/KythiaSequelize.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.4-beta
 *
 * @description
 * Main Sequelize connection factory for the application
 */
const { Sequelize } = require('sequelize');

/**
 * 🧩 Creates and returns a Sequelize instance.
 *
 * @function createSequelizeInstance
 * @param {object} config - The configuration object
 * @param {object} logger - The logger instance
 * @returns {Sequelize} Configured Sequelize instance
 */
function createSequelizeInstance(config, logger) {
    const dbConfig = config.db || {};

    const dialect = dbConfig.driver || process.env.DB_DRIVER;
    const dbName = dbConfig.name || process.env.DB_NAME;
    const dbUser = dbConfig.user || process.env.DB_USER;
    const dbPassword = dbConfig.password || process.env.DB_PASSWORD;
    const dbHost = dbConfig.host || process.env.DB_HOST;
    const dbPort = dbConfig.port || process.env.DB_PORT;
    const dbStorage = dbConfig.storagePath || process.env.DB_STORAGE_PATH;
    const dbSocket = dbConfig.socketPath || process.env.DB_SOCKET_PATH;
    const dbSsl = dbConfig.ssl || process.env.DB_SSL;
    const dbDialectOptions = dbConfig.dialectOptions || process.env.DB_DIALECT_OPTIONS;

    const seqConfig = {
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
        timezone: dbConfig.timezone || '+00:00',
    };

    switch (dialect) {
        case 'sqlite':
            seqConfig.storage = dbStorage;
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
                    seqConfig.dialectOptions = typeof dbDialectOptions === 'string' ? JSON.parse(dbDialectOptions) : dbDialectOptions;
                } catch (e) {
                    logger.error('Error parsing dialect options:', e.message);
                }
            }
            break;

        default:
            throw new Error(`${dialect} is not supported or not configured.`);
    }

    return new Sequelize(seqConfig);
}

module.exports = createSequelizeInstance;
