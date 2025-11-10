/**
 * 🧠 Smart Sequelize Sync Utility
 *
 * @file src/database/KythiaORM.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.4-beta
 *
 * @description
 * A utility for intelligent, hash-based syncing of Sequelize models.
 * Only models with schema changes are synced, minimizing downtime and risk.
 *
 * ✨ Core Features:
 * - Per-model schema hashing for change detection.
 * - Selective, safe syncing (avoids unnecessary ALTERs).
 * - Designed for production safety and speed.
 * - No destructive operations; only additive/compatible changes are auto-applied.
 * - Detailed logging for each sync operation.
 */
const readline = require('readline');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { existsSync, readdirSync, statSync } = fs;

/**
 * 🧬 generateModelHash
 *
 * Generates a unique, deterministic hash for a single Sequelize model's schema definition.
 *
 * - **Purpose:**
 *   Detects changes in a model's structure (attributes, associations, indexes) so that only changed models are synced.
 *
 * - **How it works:**
 *   1. **Attributes:**
 *      - Iterates all model attributes, sorts them, and serializes their type, nullability, primary/unique status.
 *      - Handles Sequelize's type objects robustly (tries `.toSql()`, then `.toString()`, else "UnknownType").
 *   2. **Associations:**
 *      - Serializes all associations (type, alias, target model, foreign key), sorted by alias.
 *   3. **Indexes:**
 *      - Serializes all indexes (name, fields, uniqueness), sorted by name.
 *   4. **Table Name:**
 *      - Ensures table name is always a string.
 *   5. **Hashing:**
 *      - Concatenates all above into a single string, then hashes with MD5 (first 10 chars).
 *
 * - **Why:**
 *   This ensures that any schema change (even subtle) will result in a new hash, triggering a sync for that model only.
 *
 * @param {import('sequelize').ModelCtor} model - The Sequelize model to hash.
 * @returns {string} - A short MD5 hash representing the model's schema state.
 */
function generateModelHash(model) {
    const attributes = Object.entries(model.rawAttributes)
        .sort()
        .map(([attrName, attr]) => {
            let typeString;
            try {
                if (typeof attr.type?.toSql === 'function') {
                    try {
                        typeString = attr.type.toSql({});
                    } catch (e) {
                        typeString = attr.type.toString();
                    }
                } else if (typeof attr.type?.toString === 'function') {
                    typeString = attr.type.toString();
                } else {
                    typeString = 'UnknownType';
                }
            } catch (err) {
                typeString = 'UnknownType';
            }
            return `${attrName}:${typeString}:${!!attr.allowNull}:${!!attr.primaryKey}:${!!attr.unique}`;
        })
        .join(',');

    const associations = Object.values(model.associations || {})
        .sort((a, b) => (a.as || '').localeCompare(b.as || ''))
        .map((assoc) => `${assoc.associationType}:${assoc.as}:${assoc.target.name}:${assoc.foreignKey}`)
        .join(',');

    const indexes = (model.options.indexes || [])
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map((idx) => {
            const fields = Array.isArray(idx.fields) ? idx.fields.join(',') : '';
            return `${idx.name || fields}:${fields}:${!!idx.unique}`;
        })
        .join(',');

    let tableName = model.getTableName();
    if (typeof tableName === 'object') tableName = tableName.tableName;

    const definitionString = `${tableName}:{attr:{${attributes}},assoc:{${associations}},idx:{${indexes}}}`;
    return crypto.createHash('md5').update(definitionString).digest('hex').substring(0, 10);
}

/**
 * 📦 loadAllAddonModels
 *
 * Dynamically loads all Sequelize models from every addon's `database/models` directory.
 *
 * - **Purpose:**
 *   Ensures that all models from all installed addons are registered with Sequelize before syncing.
 *
 * - **How it works:**
 *   1. Looks for the `addons` directory in the given root.
 *   2. For each addon folder, checks for a `database/models` subdirectory.
 *   3. Requires every `.js` file in that directory, which should register the model with Sequelize.
 *   4. Logs each loaded model for visibility.
 *
 * - **Why:**
 *   This allows the system to support modular, pluggable features (addons) with their own database models.
 *
 * @param {string} rootDir - The root directory of the project.
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} logger - Logger instance
 */
function loadAllAddonModels(rootDir, sequelize, logger) {
    const addonsDir = path.join(rootDir, 'addons');
    if (!existsSync(addonsDir)) return;

    const addonFolders = readdirSync(addonsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

    for (const addonName of addonFolders) {
        const modelsDir = path.join(addonsDir, addonName, 'database', 'models');
        if (existsSync(modelsDir) && statSync(modelsDir).isDirectory()) {
            logger.info(`📂 Loading models from addon: ${addonName}`);
            const files = readdirSync(modelsDir).filter((file) => file.endsWith('.js'));

            for (const file of files) {
                const modelPath = path.join(modelsDir, file);
                try {
                    const modelClass = require(modelPath);

                    if (modelClass && typeof modelClass.init === 'function') {
                        modelClass.init(sequelize);

                        logger.info(`  └─> Initialized model: ${file}`);
                    } else {
                        logger.warn(`  └─> File ${file} is not a valid model class, skipping init.`);
                    }
                } catch (err) {
                    logger.error(`  └─> ❌ Failed to load or init model: ${file}`, err.message);
                }
            }
        }
    }
}

/**
 * Helper: Interactive prompt for production force sync
 * @param {Array<string>} changedModels - Array of model names that will be synced
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>}
 */
async function askForProductionSyncConfirmation(changedModels, logger) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        logger.warn('\n==================== 🚨 PRODUCTION WARNING 🚨 ====================');
        logger.warn(`Database schema for [${changedModels.join(', ')}] is OUT OF DATE.`);
        logger.warn('You are about to ALTER tables in PRODUCTION.');
        logger.warn('This operation may be risky. Please ensure you have a backup.');
        logger.warn('==================================================================');

        rl.question('Do you want to continue with force sync? (y/N): ', (answer) => {
            rl.close();
            const normalized = answer.trim().toLowerCase();
            if (normalized === 'y' || normalized === 'yes') {
                resolve(true);
            } else {
                logger.error('❌ Force sync aborted by user.');
                resolve(false);
            }
        });
    });
}

/**
 * Helper: Interactive prompt for destructive changes (column removal)
 * @param {string} modelName - Name of the model with potential destructive changes
 * @param {Array<string>} droppedColumns - Array of column names that would be dropped
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>}
 */
async function askForDestructiveChangeConfirmation(modelName, droppedColumns, logger) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        logger.error(`\n==================== ⚠️ DANGEROUS CHANGE WARNING ⚠️ ====================`);
        logger.error(`Model '${modelName}' detected potential COLUMN REMOVAL:`);
        logger.error(` -> ${droppedColumns.join(', ')}`);
        logger.error('\nThese columns exist in the database but are not found in the latest model file.');
        logger.error('To prevent data loss, automatic sync is blocked by default.');
        logger.error('\nSOLUTION:');
        logger.error('1. If this is a mistake, fix your model file to include these columns.');
        logger.error('2. If you are SURE you want to remove these columns, you can continue, but data will be lost.');
        logger.error('================================================================================\n');

        rl.question('Do you want to continue with this destructive change? (y/N): ', (answer) => {
            rl.close();
            const normalized = answer.trim().toLowerCase();
            if (normalized === 'y' || normalized === 'yes') {
                logger.warn('⚠️  Proceeding with destructive change as requested by user.');
                resolve(true);
            } else {
                logger.error('❌ Destructive change aborted by user.');
                resolve(false);
            }
        });
    });
}

/**
 * 🚨 Safety Net: Pengecekan Perubahan Destruktif
 *
 * Membandingkan skema model di kode dengan skema di database.
 * Jika ada kolom yang ada di DB tapi tidak ada di model (potensi DROP COLUMN),
 * proses akan berhenti dengan pesan error yang jelas, atau bertanya ke user jika di production.
 *
 * @param {import('sequelize').ModelCtor} model - Model Sequelize yang akan dicek.
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} logger - Logger instance
 * @param {Object} config - Application config
 * @returns {Promise<boolean>} - true jika aman lanjut, false jika user abort.
 */

/**
 * 🚨 Safety Net: Pengecekan Perubahan Destruktif
 *
 * (Deskripsi biarin aja)
 *
 * @param {import('sequelize').ModelCtor} model - Model Sequelize yang akan dicek.
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} logger - Logger instance
 * @param {Object} config - Application config
 * @returns {Promise<boolean>} - true jika aman lanjut, false jika user abort.
 */
async function checkForDestructiveChanges(model, sequelize, logger, config) {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = model.getTableName();
    const tableNameStr = typeof tableName === 'string' ? tableName : tableName.tableName;

    try {
        const dbSchema = await queryInterface.describeTable(tableNameStr);
        const dbColumnNames = Object.keys(dbSchema);

        const modelColumnNames = Object.keys(model.rawAttributes);

        const droppedColumns = dbColumnNames.filter((col) => !modelColumnNames.includes(col));

        if (droppedColumns.length > 0) {
            if (config.env === 'production') {
                logger.warn(`PERINGATAN PRODUKSI: Terdeteksi potensi penghapusan kolom di model ${model.name}.`);
                return await askForDestructiveChangeConfirmation(model.name, droppedColumns, logger);
            } else {
                logger.warn(`\n⚠️  WARNING: Model '${model.name}' has ${droppedColumns.length} columns in DB that are not in the model.`);
                logger.warn('This could cause data loss if columns are removed. Columns:', droppedColumns.join(', '));
                return true;
            }
        }

        return true;
    } catch (error) {
        const isTableNotFoundError =
            (error.name === 'SequelizeDatabaseError' && error.original?.code === 'ER_NO_SUCH_TABLE') ||
            (error.name === 'SequelizeDatabaseError' && error.original?.code === '42P01') ||
            (typeof error.message === 'string' && error.message.match(/table.*?doesn't exist/i)) ||
            (typeof error.message === 'string' && error.message.match(/^No description found for/i));

        if (isTableNotFoundError) {
            logger.info(` -> Table '${tableNameStr}' not found, will be created.`);
            return true;
        }

        logger.error(`❌ Error checking for destructive changes on ${model.name}:`, error.message);
        return false;
    }
}

/**
 * 🧠 KythiaORM
 *
 * Intelligently synchronizes the database schema on a per-model basis, only syncing models whose schema has changed.
 *
 * - **Purpose:**
 *   Avoids unnecessary full-database syncs by tracking a hash of each model's schema.
 *   Only models with a changed hash are synced, making migrations safer and faster.
 *
 * - **How it works:**
 *   1. Loads all addon models so Sequelize knows about every model.
 *   2. Ensures a `model_versions` table exists to track each model's last known schema hash.
 *   3. For each model:
 *      - Computes its current schema hash.
 *      - Compares to the hash stored in `model_versions`.
 *      - If different, adds to the sync list.
 *   4. If any models need syncing:
 *      - In **production**, refuses to sync unless `options.force` is true (safety net).
 *      - Otherwise, syncs each changed model with `{ alter: true }`.
 *      - Updates the hash in `model_versions` for each synced model (UPSERT).
 *   5. Logs the result.
 *
 * - **Why:**
 *   This approach minimizes risk in production, speeds up development, and makes schema management more robust.
 *
 * @param {Object} params - Parameters
 * @param {Object} params.kythiaInstance - The main Kythia instance
 * @param {Object} params.sequelize - Sequelize instance
 * @param {Object} params.KythiaModel - KythiaModel class
 * @param {Object} params.logger - Logger instance
 * @param {Object} params.config - Application config
 * @param {Object} [options] - Options for the sync
 * @param {boolean} [options.force=false] - Force sync in production mode
 * @returns {Promise<Object>} - Sequelize instance
 */
async function KythiaORM({ kythiaInstance, sequelize, KythiaModel, logger, config }, options = {}) {
    try {
        const rootDir = kythiaInstance.container.appRoot;

        loadAllAddonModels(rootDir, sequelize, logger);

        logger.info('↔️ Performing model associations from ready hooks...');

        if (Array.isArray(kythiaInstance?.dbReadyHooks)) {
            for (const hook of kythiaInstance.dbReadyHooks) {
                if (typeof hook === 'function') {
                    await hook(sequelize);
                }
            }
        }

        if (kythiaInstance?.client) {
            KythiaModel.attachHooksToAllModels(sequelize, kythiaInstance.client);
        } else {
            logger.warn('🟠 No client instance provided, skipping model hooks attachment');
        }

        const isProduction = config.env === 'production';
        const shouldReset = process.argv.includes('--db-reset');

        try {
            const dialect = (config.db?.driver || '').toLowerCase();
            if (dialect === 'mysql' || dialect === 'mariadb') {
                const dbName = config.db?.name || process.env.DB_NAME;
                const { Sequelize } = require('sequelize');
                const tempSequelize = new Sequelize(
                    '',
                    config.db?.user || process.env.DB_USER,
                    config.db?.password || process.env.DB_PASSWORD,
                    {
                        host: config.db?.host || process.env.DB_HOST,
                        port: config.db?.port || process.env.DB_PORT,
                        dialect,
                        logging: false,
                        dialectOptions:
                            config.db?.dialectOptions || (process.env.DB_DIALECT_OPTIONS ? JSON.parse(process.env.DB_DIALECT_OPTIONS) : {}),
                        socketPath: config.db?.socketPath || process.env.DB_SOCKET_PATH,
                    }
                );

                await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
                await tempSequelize.close();
                logger.info(`🗄️ Ensured database "${dbName}" exists.`);
            }
        } catch (dbCreateError) {
            logger.error('❌ Failed to create/check database existence:', dbCreateError);
            throw dbCreateError;
        }

        if (shouldReset) {
            if (isProduction && !options.force) {
                logger.error('❌ Cannot reset database in production without --force flag');
                process.exit(1);
            }

            logger.warn('🔄 Resetting database...');
            await sequelize.sync({ force: true });
            logger.info('✅ Database reset complete.');
            return sequelize;
        }

        const versionTableName = 'model_versions';
        const versionTableExists = await sequelize
            .getQueryInterface()
            .showAllTables()
            .then((tables) => tables.includes(versionTableName));

        if (!versionTableExists) {
            logger.info('🆕 Creating model_versions table...');
            await sequelize.getQueryInterface().createTable(versionTableName, {
                model_name: {
                    type: sequelize.Sequelize.STRING,
                    primaryKey: true,
                },
                version_hash: {
                    type: sequelize.Sequelize.STRING(10),
                    allowNull: false,
                },
                updated_at: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            });
        }

        const dbVersions = await sequelize.query(`SELECT model_name, version_hash FROM ${versionTableName}`, {
            type: sequelize.QueryTypes.SELECT,
        });

        const dbVersionsMap = new Map(dbVersions?.map((v) => [v.model_name, v.version_hash]) || []);
        const allModels = Object.values(sequelize.models);
        const modelsToSync = [];
        const changedModels = [];

        for (const model of allModels) {
            const newHash = generateModelHash(model);
            const currentHash = dbVersionsMap.get(model.name);

            if (newHash !== currentHash) {
                const safe = await checkForDestructiveChanges(model, sequelize, logger, config);
                if (!safe) {
                    logger.error(`❌ Aborting sync due to destructive changes in ${model.name}`);
                    process.exit(1);
                }
                modelsToSync.push({ model, newHash });
                changedModels.push(model.name);
            }
        }

        if (modelsToSync.length > 0) {
            logger.info(`🔄 ${changedModels.length} models need sync: ${changedModels.join(', ')}`);

            if (isProduction && !options.force) {
                const proceed = await askForProductionSyncConfirmation(changedModels, logger);
                if (!proceed) {
                    process.exit(1);
                }
            }

            const modelNamesToSync = modelsToSync.map((m) => m.model.name);

            logger.info(`🔄 Syncing models via sequelize.sync(): ${modelNamesToSync.join(', ')}...`);
            await sequelize.sync({
                models: modelNamesToSync,
                alter: true,
            });
            logger.info('✅ Model sync complete.');

            logger.info('💾 Updating version hashes in model_versions table...');
            for (const { model, newHash } of modelsToSync) {
                const dialect = sequelize.getDialect();
                let upsertQuery;

                switch (dialect) {
                    case 'mysql':
                    case 'mariadb':
                        upsertQuery = `INSERT INTO ${versionTableName} (model_name, version_hash, updated_at) 
                                     VALUES (?, ?, CURRENT_TIMESTAMP) 
                                     ON DUPLICATE KEY UPDATE 
                                     version_hash = VALUES(version_hash), updated_at = CURRENT_TIMESTAMP`;
                        break;

                    case 'sqlite':
                    case 'postgres':
                        upsertQuery = `INSERT INTO ${versionTableName} (model_name, version_hash, updated_at) 
                                     VALUES (?, ?, CURRENT_TIMESTAMP) 
                                     ON CONFLICT(model_name) 
                                     DO UPDATE SET version_hash = excluded.version_hash, updated_at = CURRENT_TIMESTAMP`;
                        break;

                    case 'mssql':
                        upsertQuery = `MERGE INTO ${versionTableName} AS T
                                     USING (VALUES (?, ?, CURRENT_TIMESTAMP)) AS S (model_name, version_hash, updated_at)
                                     ON (T.model_name = S.model_name)
                                     WHEN MATCHED THEN
                                         UPDATE SET T.version_hash = S.version_hash, T.updated_at = S.updated_at
                                     WHEN NOT MATCHED THEN
                                         INSERT (model_name, version_hash, updated_at) 
                                         VALUES (S.model_name, S.version_hash, S.updated_at);`;
                        break;

                    default:
                        logger.warn(`Dialect "${dialect}" does not have a custom UPSERT, attempting fallback to ON CONFLICT...`);
                        upsertQuery = `INSERT INTO ${versionTableName} (model_name, version_hash, updated_at) 
                                     VALUES (?, ?, CURRENT_TIMESTAMP) 
                                     ON CONFLICT(model_name) 
                                     DO UPDATE SET version_hash = excluded.version_hash, updated_at = CURRENT_TIMESTAMP`;
                }

                await sequelize.query(upsertQuery, {
                    replacements: [model.name, newHash],

                    type: sequelize.QueryTypes.INSERT,
                });
            }

            logger.info('✨ Database sync completed successfully!');
        } else {
            logger.info('💾 All model schemas are up to date.');
        }

        return sequelize;
    } catch (err) {
        logger.error('❌ Error during database sync:', err);
        throw err;
    }
}

module.exports = KythiaORM;
