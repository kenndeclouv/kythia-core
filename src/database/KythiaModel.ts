/**
 * 🚀 Caching Layer for Sequelize Models (Hybrid Redis + In-Memory Fallback Edition, Sniper Mode, Shard-aware)
 *
 * @file src/database/KythiaModel.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
 *
 * @description
 * Caching layer for Sequelize Models, now sharding-aware. When config.db.redis.shard === true,
 * fallback to in-memory cache is DISABLED (dangerous with sharding). If sharding, then Redis is REQUIRED,
 * and if Redis goes down, instant queries go directly to db.
 * For shard: false/undefined, original hybrid fallback applies.
 *
 * ✨ Core Features:
 * -  Shard Mode: If using Redis sharding, disables Map fallback for strict consistency.
 * -  Hybrid Fallback: For non-shard setups, automatic fallback is preserved.
 * -  Fast, consistent, safe cache busting.
 * -  Multi-Redis Fallback: Support multiple Redis URLs for failover/fallback. Will try connect to next Redis if one fails.
 */

import jsonStringify = require('json-stable-stringify');
import {
	Model,
	DataTypes,
	type Sequelize,
	type InitOptions,
	type ModelAttributes,
	Utils,
} from 'sequelize';
import { LRUCache } from 'lru-cache';
import kythiaLogger from '../utils/logger';
import type { Redis } from 'ioredis';
import type { KythiaConfig } from '../types/KythiaConfig';
import type {
	CacheStats,
	KythiaModelDependencies,
	CacheEntry,
	KythiaModelStructure,
} from '../types/KythiaModel';

const NEGATIVE_CACHE_PLACEHOLDER = '__KYTHIA_NEGATIVE_CACHE__';
const RECONNECT_DELAY_MINUTES = 3;

const REDIS_ERROR_TOLERANCE_COUNT = 3;
const REDIS_ERROR_TOLERANCE_INTERVAL_MS = 10 * 1000;

function safeStringify(obj: any, logger: any): string {
	try {
		return JSON.stringify(obj, (_key, value) =>
			typeof value === 'bigint' ? value.toString() : value,
		);
	} catch (err: any) {
		(logger || console).error(`❌ [SAFE STRINGIFY] Failed: ${err.message}`);
		return '{}';
	}
}

function safeParse(str: string, logger: any): any {
	try {
		return JSON.parse(str);
	} catch {
		(logger || console).warn(
			'⚠️ [SAFE PARSE] Invalid JSON data, returning null',
		);
		return null;
	}
}

export class KythiaModel<
	T extends object = any,
	TCreationAttributes extends object = T,
> extends Model<T, TCreationAttributes> {
	static client: any;
	static redis: Redis | undefined;
	static isRedisConnected = false;
	static logger: any = kythiaLogger;
	static config: KythiaConfig | {} = {};
	static CACHE_VERSION = '1.0.0';

	static localCache = new LRUCache<string, { data: any; expires: number }>({
		max: 1000,
	});
	static localNegativeCache = new Set<string>();
	static MAX_LOCAL_CACHE_SIZE = 1000;
	static DEFAULT_TTL = 60 * 60 * 1000;

	static lastRedisOpts: string[] | null = null;
	static reconnectTimeout: NodeJS.Timeout | null = null;
	static lastAutoReconnectTs = 0;

	static pendingQueries = new Map<string, Promise<any>>();
	static cacheStats: CacheStats = {
		redisHits: 0,
		mapHits: 0,
		misses: 0,
		sets: 0,
		clears: 0,
		errors: 0,
	};

	static redisErrorTimestamps: number[] = [];

	static isShardMode = false;

	static _redisFallbackURLs: any[] = [];
	static _redisCurrentIndex = 0;
	static _redisFailedIndexes = new Set<number>();
	static _justFailedOver = false;

	// Custom properties
	static fillable?: string[];
	static guarded?: string[];
	static structure?: KythiaModelStructure;
	static table?: string;
	static cacheKeys?: any[];
	static CACHE_KEYS?: any[];
	static CACHE_TTL?: number;
	static customInvalidationTags?: string[];

	/**
	 * 🛡️ LARAVEL STYLE: MASS ASSIGNMENT PROTECTION
	 *
	 * We inject a global Hook when the model is initialized.
	 * This hook will check 'fillable' or 'guarded' before data is processed.
	 */
	static init(
		attributes: ModelAttributes<any, any>,
		options: InitOptions<any>,
	): any {
		const model = super.init(attributes, options);

		model.addHook('beforeValidate', (instance: any) => {
			const ModelClass = instance.constructor as typeof KythiaModel;

			if (ModelClass.fillable && Array.isArray(ModelClass.fillable)) {
				const allowedFields = ModelClass.fillable;
				Object.keys(instance.dataValues).forEach((key) => {
					if (!allowedFields.includes(key)) {
						delete instance.dataValues[key];
						if (instance.changed()) instance.changed(key, false);
					}
				});
			} else if (ModelClass.guarded && Array.isArray(ModelClass.guarded)) {
				const forbiddenFields = ModelClass.guarded;

				if (forbiddenFields.includes('*')) {
					instance.dataValues = {};
					return;
				}

				Object.keys(instance.dataValues).forEach((key) => {
					if (forbiddenFields.includes(key)) {
						delete instance.dataValues[key];
						if (instance.changed()) instance.changed(key, false);
					}
				});
			}
		});

		return model;
	}

	/**
	 * 🎩 MAGIC BOOTSTRAPPER (FIXED MERGE)
	 */
	static async autoBoot(sequelize: Sequelize) {
		let tableName = this.table;

		if (!tableName) {
			const modelName = this.name;
			const snakeCase = Utils.underscoredIf(modelName, true);
			tableName = Utils.pluralize(snakeCase);
		}

		let manualAttributes: any = {};
		let manualOptions: any = {};

		if (this.structure) {
			manualAttributes = this.structure.attributes || {};
			manualOptions = this.structure.options || {};
		}

		const queryInterface = sequelize.getQueryInterface();
		let tableSchema: any;

		try {
			tableSchema = await queryInterface.describeTable(tableName);
		} catch (error) {
			console.warn(
				`⚠️ [KythiaModel] Table '${tableName}' not found for model '${this.name}'. Skipping auto-boot. err ${error}`,
			);
			return;
		}

		const dbAttributes: any = {};

		for (const [colName, colInfo] of Object.entries(tableSchema) as any) {
			dbAttributes[colName] = {
				type: this._mapDbTypeToSequelize(colInfo.type),
				allowNull: colInfo.allowNull,
				defaultValue: colInfo.defaultValue,
				primaryKey: colInfo.primaryKey,
				autoIncrement: colInfo.autoIncrement,
			};
		}

		const finalAttributes = { ...dbAttributes, ...manualAttributes };

		super.init(finalAttributes, {
			sequelize,
			modelName: this.name,
			tableName: tableName,

			timestamps:
				manualOptions.timestamps !== undefined
					? manualOptions.timestamps
					: !!finalAttributes.createdAt,
			paranoid:
				manualOptions.paranoid !== undefined
					? manualOptions.paranoid
					: !!finalAttributes.deletedAt,
			...manualOptions,
		});

		this._setupLaravelHooks();

		return this;
	}

	/**
	 * Helper: Translate DB Types (VARCHAR) to Sequelize (DataTypes.STRING)
	 */
	static _mapDbTypeToSequelize(dbType: string) {
		const type = dbType.toUpperCase();

		if (type.startsWith('BOOLEAN') || type.startsWith('TINYINT(1)'))
			return DataTypes.BOOLEAN;

		if (
			type.startsWith('INT') ||
			type.startsWith('TINYINT') ||
			type.startsWith('BIGINT')
		)
			return DataTypes.INTEGER;

		if (
			type.startsWith('VARCHAR') ||
			type.startsWith('TEXT') ||
			type.startsWith('CHAR')
		)
			return DataTypes.STRING;
		if (type.startsWith('DATETIME') || type.startsWith('TIMESTAMP'))
			return DataTypes.DATE;
		if (type.startsWith('JSON')) return DataTypes.JSON;
		if (
			type.startsWith('FLOAT') ||
			type.startsWith('DOUBLE') ||
			type.startsWith('DECIMAL')
		)
			return DataTypes.FLOAT;

		if (type.startsWith('ENUM')) return DataTypes.STRING;

		return DataTypes.STRING;
	}

	/**
	 * Helper: Sets up Laravel-like mass assignment protection hooks (fillable/guarded)
	 * and manages timestamp attributes for the model.
	 * This method should be called during model initialization.
	 */
	static _setupLaravelHooks() {
		this.addHook('beforeValidate', (instance: any) => {
			const ModelClass = instance.constructor as typeof KythiaModel;
			const pkAttribute = ModelClass.primaryKeyAttribute || 'id';

			if (ModelClass.fillable && Array.isArray(ModelClass.fillable)) {
				const allowedFields = ModelClass.fillable;
				Object.keys(instance.dataValues).forEach((key) => {
					if (key === pkAttribute) return;

					if (!allowedFields.includes(key)) {
						delete instance.dataValues[key];
						if (instance.changed()) instance.changed(key, false);
					}
				});
			} else if (ModelClass.guarded && Array.isArray(ModelClass.guarded)) {
				const forbiddenFields = ModelClass.guarded;
				if (forbiddenFields.includes('*')) {
					instance.dataValues = {};
					return;
				}
				Object.keys(instance.dataValues).forEach((key) => {
					if (key === pkAttribute) return;

					if (forbiddenFields.includes(key)) {
						delete instance.dataValues[key];
						if (instance.changed()) instance.changed(key, false);
					}
				});
			}
		});
	}

	/**
	 * 💉 Injects core dependencies into the KythiaModel class.
	 * This must be called once at application startup before any models are loaded.
	 * @param {Object} dependencies - The dependencies to inject
	 * @param {Object} dependencies.logger - The logger instance
	 * @param {Object} dependencies.config - The application config object
	 * @param {Object} [dependencies.redis] - Optional Redis client instance
	 * @param {Object|Array|string} [dependencies.redisOptions] - Redis connection options if not providing a client.
	 *     Can now be string (URL), object (ioredis options), or array of URLs/options for fallback.
	 */
	static setDependencies({
		logger,
		config,
		redis,
		redisOptions,
	}: KythiaModelDependencies) {
		if (!config) {
			throw new Error('KythiaModel.setDependencies requires config!');
		}

		this.logger = logger || kythiaLogger;
		this.config = config;
		this.CACHE_VERSION = config.db?.redisCacheVersion || '1.0.0';

		const redisConfig = config?.db?.redis;
		this.isShardMode =
			(typeof redisConfig === 'object' &&
				redisConfig !== null &&
				redisConfig.shard) ||
			false;
		if (this.isShardMode) {
			this.logger.info(
				'🟣 [REDIS][SHARD] Detected redis sharding mode (shard: true). Local fallback cache DISABLED!',
			);
		}

		this._redisFallbackURLs = [];

		if (Array.isArray(redisOptions)) {
			this._redisFallbackURLs = redisOptions.filter(
				(opt) => opt && (typeof opt !== 'string' || opt.trim().length > 0),
			);
		} else if (typeof redisOptions === 'string') {
			if (redisOptions.trim().length > 0) {
				this._redisFallbackURLs = redisOptions
					.split(',')
					.map((url) => url.trim())
					.filter((url) => url.length > 0);
			}
		} else if (
			redisOptions &&
			typeof redisOptions === 'object' &&
			Array.isArray((redisOptions as any).urls)
		) {
			this._redisFallbackURLs = (redisOptions as any).urls.slice();
		} else if (
			redisOptions &&
			typeof redisOptions === 'object' &&
			Object.keys(redisOptions).length > 0
		) {
			this._redisFallbackURLs = [redisOptions];
		}

		this._redisCurrentIndex = 0;

		if (redis) {
			this.redis = redis;
			this.isRedisConnected = redis.status === 'ready';
		} else if (this._redisFallbackURLs.length > 0) {
			this.initializeRedis();
		} else {
			if (this.isShardMode) {
				this.logger.error(
					'❌ [REDIS][SHARD] No Redis client/options, but shard:true. Application will work WITHOUT caching!',
				);
				this.isRedisConnected = false;
			} else {
				this.logger.warn(
					'🟠 [REDIS] No Redis provided. Switching to In-Memory Cache mode.',
				);
				this.isRedisConnected = false;
			}
		}
	}

	/**
	 * Helper: Track redis error timestamp, and check if error count in interval exceeds tolerance.
	 * If errors occur >= REDIS_ERROR_TOLERANCE_COUNT within REDIS_ERROR_TOLERANCE_INTERVAL_MS,
	 * then try to connect to the next redis (multi redis), if none, then fallback to In-Memory (isRedisConnected = false)
	 * -- EXCEPT if shard: true.
	 */
	static _trackRedisError(err: any) {
		const now = Date.now();

		this.redisErrorTimestamps = (this.redisErrorTimestamps || []).filter(
			(ts) => now - ts < REDIS_ERROR_TOLERANCE_INTERVAL_MS,
		);
		this.redisErrorTimestamps.push(now);

		if (this.redisErrorTimestamps.length >= REDIS_ERROR_TOLERANCE_COUNT) {
			if (this.isRedisConnected) {
				const triedFallback = this._tryRedisFailover();
				if (triedFallback) {
					this.logger.warn(
						`[REDIS] Error tolerance reached, switching to NEXT Redis failover...`,
					);
				} else if (this.isShardMode) {
					this.logger.error(
						`❌ [REDIS][SHARD] ${
							this.redisErrorTimestamps.length
						} consecutive errors in ${
							REDIS_ERROR_TOLERANCE_INTERVAL_MS / 1000
						}s. SHARD MODE: Disabling cache (NO fallback), all queries go to DB. (Last error: ${
							err?.message
						})`,
					);
					this.isRedisConnected = false;
					this._scheduleReconnect();
				} else {
					this.logger.error(
						`❌ [REDIS] ${
							this.redisErrorTimestamps.length
						} consecutive errors in ${
							REDIS_ERROR_TOLERANCE_INTERVAL_MS / 1000
						}s. All Redis exhausted, fallback to In-Memory Cache! (Last error: ${
							err?.message
						})`,
					);
					this.isRedisConnected = false;
					this._scheduleReconnect();
				}
			}

			this.redisErrorTimestamps = [];
		} else {
			this.logger.warn(
				`🟠 [REDIS] Error #${this.redisErrorTimestamps.length}/${REDIS_ERROR_TOLERANCE_COUNT} tolerated. (${err?.message})`,
			);
		}
	}

	/**
	 * Try switching to the next redis URL if available. Return true if switching, false if no more.
	 * PRIVATE.
	 */
	static _tryRedisFailover() {
		if (
			!Array.isArray(this._redisFallbackURLs) ||
			this._redisFallbackURLs.length < 2
		) {
			return false;
		}
		const prevIndex = this._redisCurrentIndex;
		if (this._redisCurrentIndex + 1 < this._redisFallbackURLs.length) {
			this._redisCurrentIndex++;
			this.logger.warn(
				`[REDIS][FAILOVER] Trying to switch Redis connection from url index ${prevIndex} to ${this._redisCurrentIndex}`,
			);

			this._justFailedOver = true;

			this._closeCurrentRedis();
			this.initializeRedis();
			return true;
		}
		return false;
	}

	/**
	 * Close the current Redis (if exists).
	 * PRIVATE.
	 */
	static _closeCurrentRedis() {
		if (this.redis && typeof this.redis.quit === 'function') {
			try {
				this.redis.quit();
			} catch (e) {
				console.log(e);
			}
		}
		this.redis = undefined;
		this.isRedisConnected = false;
	}

	/**
	 * 🔌 Initializes the Redis connection if not already initialized.
	 * (This version REMOVES lazyConnect and _attemptConnection to fix race condition)
	 */
	static initializeRedis(redisOptions?: any) {
		if (redisOptions) {
			if (Array.isArray(redisOptions)) {
				this._redisFallbackURLs = redisOptions.slice();
				this._redisCurrentIndex = 0;
			} else if (
				redisOptions &&
				typeof redisOptions === 'object' &&
				Array.isArray(redisOptions.urls)
			) {
				this._redisFallbackURLs = redisOptions.urls.slice();
				this._redisCurrentIndex = 0;
			} else {
				this._redisFallbackURLs = [redisOptions];
				this._redisCurrentIndex = 0;
			}
		}

		if (
			!Array.isArray(this._redisFallbackURLs) ||
			this._redisFallbackURLs.length === 0
		) {
			if (this.isShardMode) {
				this.logger.error(
					'❌ [REDIS][SHARD] No Redis URL/options provided but shard:true. Will run without caching!',
				);
				this.isRedisConnected = false;
			} else {
				this.logger.warn(
					'🟠 [REDIS] No Redis client or options provided. Operating in In-Memory Cache mode only.',
				);
				this.isRedisConnected = false;
			}
			return null;
		}

		const Redis = require('ioredis');
		this.lastRedisOpts = Array.isArray(this._redisFallbackURLs)
			? this._redisFallbackURLs.slice()
			: [this._redisFallbackURLs];

		if (this.redis) return this.redis;

		const opt = this._redisFallbackURLs[this._redisCurrentIndex];

		if (opt && typeof opt === 'object' && opt.shard) {
			this.isShardMode = true;
		}

		let redisOpt: any;
		if (typeof opt === 'string') {
			redisOpt = { url: opt, retryStrategy: this._makeRetryStrategy() };
		} else if (opt && typeof opt === 'object') {
			redisOpt = {
				maxRetriesPerRequest: 2,
				enableReadyCheck: true,
				retryStrategy: this._makeRetryStrategy(),
				...opt,
			};
		} else {
			this.logger.error('❌ [REDIS] Invalid redis config detected in list');
			this.isRedisConnected = false;
			return null;
		}

		this.logger.info(
			`[REDIS][INIT] Connecting to Redis fallback #${
				this._redisCurrentIndex + 1
			}/${this._redisFallbackURLs.length}: ${
				typeof opt === 'string' ? opt : redisOpt.url || '(object)'
			}`,
		);

		this.redis = new Redis(redisOpt.url || redisOpt);

		this._setupRedisEventHandlers();

		return this.redis;
	}

	/**
	 * Internal: Makes retry strategy function which wraps the fallback failover logic if all failed.
	 * Used by initializeRedis.
	 */
	static _makeRetryStrategy() {
		return (times: number) => {
			if (times > 5) {
				this.logger.error(
					`❌ [REDIS] Could not connect after ${times - 1} retries for Redis #${
						this._redisCurrentIndex + 1
					}.`,
				);
				return null;
			}
			const delay = Math.min(times * 500, 2000);
			this.logger.warn(
				`🟠 [REDIS] Connection failed for Redis #${
					this._redisCurrentIndex + 1
				}. Retrying in ${delay}ms (Attempt ${times})...`,
			);
			return delay;
		};
	}

	/**
	 * 🔌 Sets up Redis event handlers
	 * @private
	 */
	static _setupRedisEventHandlers() {
		if (!this.redis) return;

		this.redis.on('connect', async () => {
			if (!this.isRedisConnected) {
				this.logger.info(
					'✅ [REDIS] Connection established. Switching to Redis Cache mode.',
				);
			}
			this.isRedisConnected = true;
			this.redisErrorTimestamps = [];
			if (this.reconnectTimeout) {
				clearTimeout(this.reconnectTimeout);
				this.reconnectTimeout = null;
			}
			this._redisFailedIndexes.delete(this._redisCurrentIndex);

			if (this._justFailedOver) {
				this.logger.warn(
					`[REDIS][FAILOVER] Connected to new server, flushing potentially stale cache...`,
				);
				try {
					await this.redis!.flushdb();
					this.logger.info(
						`[REDIS][FAILOVER] Stale cache flushed successfully.`,
					);
				} catch (err) {
					this.logger.error(`[REDIS][FAILOVER] FAILED TO FLUSH CACHE:`, err);
				}
				this._justFailedOver = false;
			}
		});

		this.redis.on('error', (err: any) => {
			if (err && (err.code === 'ECONNREFUSED' || err.message)) {
				this.logger.warn(`🟠 [REDIS] Connection error: ${err.message}`);
			}
		});

		this.redis.on('close', () => {
			if (this.isRedisConnected) {
				if (this.isShardMode) {
					this.logger.error(
						'❌ [REDIS][SHARD] Connection closed. Cache DISABLED (no fallback).',
					);
				} else {
					this.logger.error(
						'❌ [REDIS] Connection closed. Fallback/failover will be attempted.',
					);
				}
			}
			this.isRedisConnected = false;

			this._redisFailedIndexes.add(this._redisCurrentIndex);

			this.logger.warn(
				`[REDIS] Connection #${
					this._redisCurrentIndex + 1
				} closed. Attempting immediate failover...`,
			);
			const triedFailover = this._tryRedisFailover();

			if (!triedFailover) {
				this.logger.warn(
					`[REDIS] Failover exhausted. Scheduling full reconnect...`,
				);
				this._scheduleReconnect();
			}
		});
	}

	/**
	 * ⏱️ Schedules a reconnection attempt
	 * @private
	 */
	static _scheduleReconnect() {
		if (this.reconnectTimeout) return;

		const sinceLast = Date.now() - this.lastAutoReconnectTs;
		if (sinceLast < RECONNECT_DELAY_MINUTES * 60 * 1000) return;

		this.lastAutoReconnectTs = Date.now();
		if (this.isShardMode) {
			this.logger.warn(
				`[REDIS][SHARD] Attempting auto-reconnect after ${RECONNECT_DELAY_MINUTES}min downtime...`,
			);
		} else {
			this.logger.warn(
				`🟢 [REDIS] Attempting auto-reconnect after ${RECONNECT_DELAY_MINUTES}min downtime...`,
			);
		}

		this.reconnectTimeout = setTimeout(
			() => {
				this.reconnectTimeout = null;

				this._redisCurrentIndex = 0;
				this._redisFailedIndexes.clear();
				this._closeCurrentRedis();
				this.initializeRedis();
			},
			RECONNECT_DELAY_MINUTES * 60 * 1000,
		);
	}

	/**
	 * 🔑 Generates a consistent, model-specific cache key from a query identifier.
	 * This ensures that the same query always produces the same key, preventing collisions.
	 * @param {string|Object} queryIdentifier - A unique string or a Sequelize query object.
	 * @returns {string} The final cache key, prefixed with the model's name (e.g., "User:{\"id\":1}").
	 */
	static getCacheKey(queryIdentifier: any): string {
		let dataToHash = queryIdentifier;

		if (
			dataToHash &&
			typeof dataToHash === 'object' &&
			!dataToHash.where &&
			!dataToHash.include
		) {
			dataToHash = { where: dataToHash };
		}

		const opts = {
			replacer: (_key: string | number, value: any) =>
				typeof value === 'bigint' ? value.toString() : value,
		};

		const keyBody =
			typeof queryIdentifier === 'string'
				? queryIdentifier
				: jsonStringify(this.normalizeQueryOptions(dataToHash), opts);

		return `${this.CACHE_VERSION}:${this.name}:${keyBody}`;
	}

	/**
	 * 🧽 Recursively normalizes a query options object to ensure deterministic key generation.
	 * It sorts keys alphabetically and handles Sequelize's Symbol-based operators to produce
	 * a consistent string representation for any given query.
	 * @param {*} data - The query options or part of the options to normalize.
	 * @returns {*} The normalized data.
	 */
	static normalizeQueryOptions(data: any): any {
		if (!data || typeof data !== 'object') return data;
		if (Array.isArray(data))
			return data.map((item) => this.normalizeQueryOptions(item));
		const normalized: any = {};
		Object.keys(data)
			.sort()
			.forEach((key) => {
				normalized[key] = this.normalizeQueryOptions(data[key]);
			});
		Object.getOwnPropertySymbols(data).forEach((symbol) => {
			const key = `$${symbol.toString().slice(7, -1)}`;
			normalized[key] = this.normalizeQueryOptions(data[symbol]);
		});
		return normalized;
	}

	/**
	 * 🧠 Generate tags based on PK and static cacheKeys definition.
	 * Used for smart invalidation (e.g. invalidate all items belonging to a userId).
	 */
	static _generateSmartTags(instance: any) {
		if (!instance) return [`${this.name}`];

		const tags = [`${this.name}`];

		const pk = this.primaryKeyAttribute;
		if (instance[pk]) {
			tags.push(`${this.name}:${pk}:${instance[pk]}`);
		}

		const smartKeys = this.cacheKeys || this.CACHE_KEYS || [];

		if (Array.isArray(smartKeys)) {
			for (const keyGroup of smartKeys) {
				const keys = Array.isArray(keyGroup) ? keyGroup : [keyGroup];
				const hasAllValues = keys.every(
					(k: string) => instance[k] !== undefined && instance[k] !== null,
				);

				if (hasAllValues) {
					const tagParts = keys
						.map((k: string) => `${k}:${instance[k]}`)
						.join(':');
					tags.push(`${this.name}:${tagParts}`);
				}
			}
		}
		return tags;
	}

	/**
	 * 📥 [HYBRID/SHARD ROUTER] Sets a value in the currently active cache engine.
	 * In shard mode, if Redis down, nothing is cached.
	 * @param {string|Object} cacheKeyOrQuery - The key or query object to store the data under.
	 * @param {*} data - The data to cache. Use `null` for negative caching.
	 * @param {number} [ttl=this.DEFAULT_TTL] - The time-to-live for the entry in milliseconds.
	 * @param {string[]} [tags=[]] - Cache tags (for sniper tag-based invalidation)
	 */
	static async setCacheEntry(
		cacheKeyOrQuery: any,
		data: any,
		ttl?: number,
		tags: string[] = [],
	) {
		const cacheKey =
			typeof cacheKeyOrQuery === 'string'
				? cacheKeyOrQuery
				: this.getCacheKey(cacheKeyOrQuery);
		const finalTtl = ttl || this.CACHE_TTL || this.DEFAULT_TTL;

		if (this.isRedisConnected) {
			await this._redisSetCacheEntry(cacheKey, data, finalTtl, tags);
		} else if (!this.isShardMode) {
			this._mapSetCacheEntry(cacheKey, data, finalTtl);
		}
	}

	/**
	 * 📤 [HYBRID/SHARD ROUTER] Retrieves a value from the currently active cache engine.
	 * If in shard mode and Redis is down, always miss (direct to DB).
	 * @param {string|Object} cacheKeyOrQuery - The key or query object of the item to retrieve.
	 * @returns {Promise<{hit: boolean, data: *|undefined}>} An object indicating if the cache was hit and the retrieved data.
	 */
	static async getCachedEntry(
		cacheKeyOrQuery: any,
		includeOptions?: any,
	): Promise<CacheEntry> {
		const cacheKey =
			typeof cacheKeyOrQuery === 'string'
				? cacheKeyOrQuery
				: this.getCacheKey(cacheKeyOrQuery);
		if (this.isRedisConnected) {
			return this._redisGetCachedEntry(cacheKey, includeOptions);
		} else if (!this.isShardMode) {
			return this._mapGetCachedEntry(cacheKey, includeOptions);
		}

		return { hit: false, data: undefined };
	}

	/**
	 * 🗑️ [HYBRID/SHARD ROUTER] Deletes an entry from the currently active cache engine.
	 * In shard mode, if Redis down, delete does nothing (cache already dead).
	 * @param {string|Object} keys - The query identifier used to generate the key to delete.
	 */
	static async clearCache(keys: any) {
		const cacheKey = typeof keys === 'string' ? keys : this.getCacheKey(keys);
		if (this.isRedisConnected) {
			await this._redisClearCache(cacheKey);
		} else if (!this.isShardMode) {
			this._mapClearCache(cacheKey);
		}
	}

	/**
	 * 🔴 (Private) Sets a cache entry specifically in Redis, supporting tags for sniper invalidation.
	 */
	static async _redisSetCacheEntry(
		cacheKey: string,
		data: any,
		ttl: number,
		tags: string[] = [],
	) {
		if (!this.redis) return;
		try {
			let plainData = data;

			if (data && typeof data.toJSON === 'function') {
				plainData = data.toJSON();
			} else if (Array.isArray(data)) {
				plainData = data.map((item: any) =>
					item && typeof item.toJSON === 'function' ? item.toJSON() : item,
				);
			}

			const valueToStore =
				plainData === null
					? NEGATIVE_CACHE_PLACEHOLDER
					: safeStringify(plainData, this.logger);

			const multi = this.redis.multi();
			multi.set(cacheKey, valueToStore, 'PX', ttl);

			for (const tag of tags) {
				multi.sadd(tag, cacheKey);
			}
			await multi.exec();
			this.cacheStats.sets++;
		} catch (err) {
			this._trackRedisError(err);
		}
	}

	static async _redisGetCachedEntry(
		cacheKey: string,
		includeOptions: any,
	): Promise<CacheEntry> {
		if (!this.redis) return { hit: false, data: undefined };
		try {
			const result = await this.redis.get(cacheKey);

			if (result === null || result === undefined)
				return { hit: false, data: undefined };

			this.cacheStats.redisHits++;
			if (result === NEGATIVE_CACHE_PLACEHOLDER) {
				return { hit: true, data: null };
			}

			const parsedData = safeParse(result, this.logger);

			if (parsedData === null) {
				return { hit: false, data: undefined };
			}

			const includeAsArray = includeOptions
				? Array.isArray(includeOptions)
					? includeOptions
					: [includeOptions]
				: undefined;

			const buildInstance = (data: any) => {
				const instance = this.build(data, {
					isNewRecord: false,
					include: includeAsArray,
				});
				return instance;
			};

			if (Array.isArray(parsedData)) {
				const instances = parsedData.map((d) => buildInstance(d));
				return { hit: true, data: instances };
			} else {
				const instance = buildInstance(parsedData);
				return { hit: true, data: instance };
			}
		} catch (err) {
			this._trackRedisError(err);
			return { hit: false, data: undefined };
		}
	}

	/**
	 * 🔴 (Private) Deletes an entry specifically from Redis.
	 */
	static async _redisClearCache(cacheKey: string) {
		if (!this.redis) return;
		try {
			await this.redis.del(cacheKey);
			this.cacheStats.clears++;
		} catch (err) {
			this._trackRedisError(err);
		}
	}

	/**
	 * 🎯 [SNIPER] Invalidates cache entries by tags in Redis.
	 */
	static async invalidateByTags(tags: string[]) {
		if (
			!this.isRedisConnected ||
			!Array.isArray(tags) ||
			tags.length === 0 ||
			!this.redis
		)
			return;

		try {
			const keysToDelete = await this.redis.sunion(tags);

			if (keysToDelete && keysToDelete.length > 0) {
				this.logger.info(
					`🎯 [SNIPER] Invalidating ${
						keysToDelete.length
					} keys for tags: ${tags.join(', ')}`,
				);

				await this.redis.multi().del(keysToDelete).del(tags).exec();
			} else {
				await this.redis.del(tags);
			}
		} catch (err) {
			this._trackRedisError(err);
		}
	}

	/**
	 * 🗺️ (Private) Sets a cache entry specifically in the in-memory Map.
	 * DISABLED in shard mode.
	 */
	static _mapSetCacheEntry(cacheKey: string, data: any, ttl: number) {
		if (this.isShardMode) return;

		if (data === null) {
			this.localNegativeCache.add(cacheKey);
			this.localCache.delete(cacheKey);
		} else {
			let plainData = data;
			if (data && typeof data.toJSON === 'function') {
				plainData = data.toJSON();
			} else if (Array.isArray(data)) {
				plainData = data.map((item: any) =>
					item && typeof item.toJSON === 'function' ? item.toJSON() : item,
				);
			}

			const dataCopy =
				plainData === null
					? NEGATIVE_CACHE_PLACEHOLDER
					: safeStringify(plainData, this.logger);

			this.localCache.set(cacheKey, {
				data: dataCopy,
				expires: Date.now() + ttl,
			});
			this.localNegativeCache.delete(cacheKey);
		}
		this.cacheStats.sets++;
	}

	/**
	 * 🗺️ (Private) Retrieves an entry specifically from the in-memory Map.
	 * DISABLED in shard mode.
	 */
	static _mapGetCachedEntry(cacheKey: string, includeOptions: any): CacheEntry {
		if (this.isShardMode) return { hit: false, data: undefined };

		if (this.localNegativeCache.has(cacheKey)) {
			this.cacheStats.mapHits++;
			return { hit: true, data: null };
		}

		const entry = this.localCache.get(cacheKey);
		if (entry && entry.expires > Date.now()) {
			this.cacheStats.mapHits++;

			const dataRaw = entry.data;

			let parsedData: any;
			if (typeof dataRaw === 'string') {
				parsedData = safeParse(dataRaw, this.logger);
			} else {
				parsedData = dataRaw;
			}

			if (typeof parsedData !== 'object' || parsedData === null) {
				return { hit: true, data: parsedData };
			}

			const includeAsArray = includeOptions
				? Array.isArray(includeOptions)
					? includeOptions
					: [includeOptions]
				: undefined;

			if (Array.isArray(parsedData)) {
				const instances = this.bulkBuild(parsedData, {
					isNewRecord: false,
					include: includeAsArray,
				});
				return { hit: true, data: instances };
			} else {
				const instance = this.build(parsedData, {
					isNewRecord: false,
					include: includeAsArray,
				});
				return { hit: true, data: instance };
			}
		}

		if (entry) this.localCache.delete(cacheKey);
		return { hit: false, data: undefined };
	}

	/**
	 * 🗺️ (Private) Deletes an entry specifically from the in-memory Map.
	 * DISABLED in shard mode.
	 */
	static _mapClearCache(cacheKey: string) {
		if (this.isShardMode) return;
		this.localCache.delete(cacheKey);
		this.localNegativeCache.delete(cacheKey);
		this.cacheStats.clears++;
	}

	/**
	 * 🗺️ (Private) Clears all in-memory cache entries for this model.
	 * Used as a fallback when Redis is disconnected.
	 * DISABLED in shard mode.
	 */
	static _mapClearAllModelCache() {
		if (this.isShardMode) return;
		const prefix = `${this.CACHE_VERSION}:${this.name}:`;
		let cleared = 0;

		for (const key of this.localCache.keys()) {
			if (key.startsWith(prefix)) {
				this.localCache.delete(key);
				cleared++;
			}
		}
		for (const key of this.localNegativeCache.keys()) {
			if (key.startsWith(prefix)) {
				this.localNegativeCache.delete(key);
				cleared++;
			}
		}

		if (cleared > 0) {
			this.logger.info(
				`♻️ [MAP CACHE] Cleared ${cleared} in-memory entries for ${this.name} (Redis fallback).`,
			);
		}
	}

	/**
	 * 🔄 (Internal) Standardizes various query object formats into a consistent Sequelize options object.
	 * This helper ensures that `getCache({ id: 1 })` and `getCache({ where: { id: 1 } })` are treated identically.
	 */
	static _normalizeFindOptions(options: any): any {
		if (
			!options ||
			typeof options !== 'object' ||
			Object.keys(options).length === 0
		)
			return { where: {} };
		if (options.where) {
			const sequelizeOptions = { ...options };
			delete sequelizeOptions.cacheTags;
			delete sequelizeOptions.noCache;
			return sequelizeOptions;
		}
		const knownOptions = [
			'order',
			'limit',
			'attributes',
			'include',
			'group',
			'having',
		];

		const cacheSpecificOptions = ['cacheTags', 'noCache'];
		const whereClause: any = {};
		const otherOptions: any = {};
		for (const key in options) {
			if (cacheSpecificOptions.includes(key)) {
				continue;
			}
			if (knownOptions.includes(key)) otherOptions[key] = options[key];
			else whereClause[key] = options[key];
		}
		return { where: whereClause, ...otherOptions };
	}

	/**
	 * 📦 fetches a single record from the cache, falling back to the database on a miss.
	 * FIXED: Logic merging options vs keys & TTL extraction
	 */
	static async getCache(keys: any, options: any = {}) {
		const { noCache, customCacheKey, ttl, ...explicitQueryOptions } = options;

		if (Array.isArray(keys)) {
			const pk = this.primaryKeyAttribute;
			return this.findAll({ where: { [pk]: keys.map((m) => m[pk]) } as any });
		}

		const normalizedKeys = this._normalizeFindOptions(keys);

		const finalQuery = {
			...normalizedKeys,
			...explicitQueryOptions,
			where: {
				...(normalizedKeys.where || {}),
				...(explicitQueryOptions.where || {}),
			},
		};

		if (noCache) {
			return this.findOne(finalQuery);
		}

		if (!finalQuery.where || Object.keys(finalQuery.where).length === 0) {
			return null;
		}

		const cacheKey = customCacheKey || this.getCacheKey(finalQuery);

		const cacheResult = await this.getCachedEntry(cacheKey, finalQuery.include);
		if (cacheResult.hit) return cacheResult.data;

		this.cacheStats.misses++;

		if (this.pendingQueries.has(cacheKey))
			return this.pendingQueries.get(cacheKey);

		const queryPromise = this.findOne(finalQuery)
			.then(async (record) => {
				if (this.isRedisConnected || !this.isShardMode) {
					const tags = [`${this.name}`];
					if (record)
						tags.push(
							`${this.name}:${this.primaryKeyAttribute}:${
								(record as any)[this.primaryKeyAttribute]
							}`,
						);

					await this.setCacheEntry(cacheKey, record, ttl, tags);
				}
				return record;
			})
			.finally(() => this.pendingQueries.delete(cacheKey));

		this.pendingQueries.set(cacheKey, queryPromise);
		return queryPromise;
	}

	/**
	 * 📦 Fetches multiple records.
	 * FIXED: Logic merging options vs keys & TTL extraction
	 */
	static async getAllCache(options: any = {}) {
		const { cacheTags, noCache, customCacheKey, ttl, ...explicitQueryOptions } =
			options || {};

		const normalizedOptions = this._normalizeFindOptions(explicitQueryOptions);

		if (noCache) {
			return this.findAll(normalizedOptions);
		}

		const cacheKey = customCacheKey || this.getCacheKey(normalizedOptions);

		const cacheResult = await this.getCachedEntry(
			cacheKey,
			normalizedOptions.include,
		);
		if (cacheResult.hit) return cacheResult.data;

		this.cacheStats.misses++;

		if (this.pendingQueries.has(cacheKey))
			return this.pendingQueries.get(cacheKey);

		const queryPromise = this.findAll(normalizedOptions)
			.then(async (records) => {
				if (this.isRedisConnected || !this.isShardMode) {
					const tags = [`${this.name}`];
					if (Array.isArray(cacheTags)) tags.push(...cacheTags);

					await this.setCacheEntry(cacheKey, records, ttl, tags);
				}
				return records;
			})
			.finally(() => this.pendingQueries.delete(cacheKey));

		this.pendingQueries.set(cacheKey, queryPromise);
		return queryPromise;
	}

	/**
	 * 🕒 Add item to Scheduler (Redis Sorted Set)
	 * @param {string} keySuffix - Suffix key (misal: 'active_schedule')
	 * @param {number} score - Timestamp/Score
	 * @param {string} value - Value (biasanya ID)
	 */
	static async scheduleAdd(keySuffix: string, score: number, value: string) {
		if (!this.isRedisConnected || !this.redis) return;
		const key = `${this.name}:${keySuffix}`;
		try {
			await this.redis.zadd(key, score, value);
		} catch (e) {
			this._trackRedisError(e);
		}
	}

	/**
	 * 🕒 Remove item from Scheduler
	 */
	static async scheduleRemove(keySuffix: string, value: string) {
		if (!this.isRedisConnected || !this.redis) return;
		const key = `${this.name}:${keySuffix}`;
		try {
			await this.redis.zrem(key, value);
		} catch (e) {
			this._trackRedisError(e);
		}
	}

	/**
	 * 🕒 Get items that have expired (Score <= Now)
	 * @returns {Promise<string[]>} Array of IDs
	 */
	static async scheduleGetExpired(keySuffix: string, scoreLimit = Date.now()) {
		if (!this.isRedisConnected || !this.redis) return [];
		const key = `${this.name}:${keySuffix}`;
		try {
			return await this.redis.zrangebyscore(key, 0, scoreLimit);
		} catch (e) {
			this._trackRedisError(e);
			return [];
		}
	}

	/**
	 * 🕒 Bersihkan Scheduler (Flush Key)
	 */
	static async scheduleClear(keySuffix: string) {
		if (!this.isRedisConnected || !this.redis) return;
		const key = `${this.name}:${keySuffix}`;
		try {
			await this.redis.del(key);
		} catch (e) {
			this._trackRedisError(e);
		}
	}

	/**
	 * 📦 Finds a record by the specified where condition, using cache if available; if not found, creates it and caches the result.
	 * Will update an existing cached instance with defaults (if necessary) and save any new/changed data to both DB and cache.
	 */
	static async findOrCreateWithCache(options: any) {
		if (!options || !options.where) {
			throw new Error("findOrCreateWithCache requires a 'where' option.");
		}

		const { where, defaults, noCache, ...otherOptions } = options;

		if (noCache) {
			return this.findOrCreate(options);
		}

		const normalizedWhere = this._normalizeFindOptions(where).where;
		const cacheKey = this.getCacheKey(normalizedWhere);

		const cacheResult = await this.getCachedEntry(
			cacheKey,
			otherOptions.include,
		);

		if (cacheResult.hit && cacheResult.data) {
			const instance = cacheResult.data as any;
			let needsUpdate = false;

			if (defaults && typeof defaults === 'object') {
				for (const key in defaults) {
					if (
						instance[key] === undefined ||
						String(instance[key]) !== String(defaults[key])
					) {
						instance[key] = defaults[key];
						needsUpdate = true;
					}
				}
			}

			if (needsUpdate) {
				await instance.saveAndUpdateCache();
			}

			return [instance, false];
		}

		this.cacheStats.misses++;
		if (this.pendingQueries.has(cacheKey)) {
			return this.pendingQueries.get(cacheKey);
		}

		const findPromise = this.findOne({ where, ...otherOptions })
			.then(async (instance: any) => {
				if (instance) {
					let needsUpdate = false;
					if (defaults && typeof defaults === 'object') {
						for (const key in defaults) {
							if (
								instance[key] === undefined ||
								String(instance[key]) !== String(defaults[key])
							) {
								instance[key] = defaults[key];
								needsUpdate = true;
							}
						}
					}

					if (needsUpdate) {
						await instance.saveAndUpdateCache();
					} else {
						const tags = [
							`${this.name}`,
							`${this.name}:${this.primaryKeyAttribute}:${
								instance[this.primaryKeyAttribute]
							}`,
						];
						await this.setCacheEntry(cacheKey, instance, undefined, tags);
					}

					return [instance, false];
				} else {
					const createData = { ...where, ...defaults };
					const newInstance: any = await this.create(createData);

					const tags = [
						`${this.name}`,
						`${this.name}:${this.primaryKeyAttribute}:${
							newInstance[this.primaryKeyAttribute]
						}`,
					];
					await this.setCacheEntry(cacheKey, newInstance, undefined, tags);

					return [newInstance, true];
				}
			})
			.finally(() => {
				this.pendingQueries.delete(cacheKey);
			});

		this.pendingQueries.set(cacheKey, findPromise);
		return findPromise;
	}

	/**
	 * 📦 Fetches the count of records matching the query from the cache, falling back to the database.
	 */
	static async countWithCache(options: any = {}, ttl = 5 * 60 * 1000) {
		const { ...countOptions } = options || {};

		const cacheKeyOptions = { queryType: 'count', ...countOptions };
		const cacheKey = this.getCacheKey(cacheKeyOptions);
		const cacheResult = await this.getCachedEntry(cacheKey);
		if (cacheResult.hit) {
			return cacheResult.data;
		}
		this.cacheStats.misses++;
		const count = await this.count(countOptions);

		if (this.isRedisConnected || !this.isShardMode) {
			const tags = [`${this.name}`];
			this.setCacheEntry(cacheKey, count, ttl, tags);
		}
		return count;
	}

	/**
	 * 📦 FIXED: Save data to DB, then INVALIDATE the cache tags.
	 * Don't try to setCache here, because .save() result doesn't have associations/includes.
	 * Let the next getCache() fetch the full fresh data tree.
	 */
	async saveAndUpdateCache() {
		const savedInstance = await this.save();
		const pk = (this.constructor as typeof KythiaModel).primaryKeyAttribute;
		const pkValue = (this as any)[pk];

		if (
			pkValue &&
			((this.constructor as typeof KythiaModel).isRedisConnected ||
				!(this.constructor as typeof KythiaModel).isShardMode)
		) {
			const cacheKey = (this.constructor as typeof KythiaModel).getCacheKey({
				where: { [pk]: pkValue },
			});

			const tags = [
				`${(this.constructor as typeof KythiaModel).name}`,
				`${(this.constructor as typeof KythiaModel).name}:${pk}:${pkValue}`,
			];

			await (this.constructor as typeof KythiaModel).setCacheEntry(
				cacheKey,
				savedInstance,
				undefined,
				tags,
			);

			(this.constructor as typeof KythiaModel).logger.info(
				`🔄 [CACHE] Updated cache for ${(this.constructor as typeof KythiaModel).name}:${pk}:${pkValue}`,
			);
		}

		return savedInstance;
	}

	/**
	 * 📦 A convenience alias for `clearCache`. In the hybrid system, positive and negative
	 * cache entries for the same key are managed together, so clearing one clears the other.
	 */
	static async clearNegativeCache(keys: any) {
		return this.clearCache(keys);
	}

	/**
	 * 📦 Fetches a raw aggregate result from the cache, falling back to the database.
	 */
	static async aggregateWithCache(options: any = {}, cacheOptions: any = {}) {
		const { cacheTags, ...queryOptions } = options || {};
		const { ttl = 5 * 60 * 1000 } = cacheOptions || {};
		const cacheKeyOptions = { queryType: 'aggregate', ...queryOptions };
		const cacheKey = this.getCacheKey(cacheKeyOptions);

		const cacheResult = await this.getCachedEntry(cacheKey);
		if (cacheResult.hit) {
			return cacheResult.data;
		}

		this.cacheStats.misses++;

		const result = await this.findAll(queryOptions);

		if (this.isRedisConnected || !this.isShardMode) {
			const tags = [`${this.name}`];
			if (Array.isArray(cacheTags)) tags.push(...cacheTags);
			this.setCacheEntry(cacheKey, result, ttl, tags);
		}

		return result;
	}

	/**
	 * 🪝 Attaches Sequelize lifecycle hooks (`afterSave`, `afterDestroy`, etc.) to this model.
	 * In shard mode, fallback invalidation does nothing.
	 */
	static initializeCacheHooks() {
		if (!this.redis) {
			this.logger.warn(
				`❌ Redis not initialized for model ${this.name}. Cache hooks will not be attached.`,
			);
			return;
		}

		const afterSaveLogic = async (instance: any) => {
			const modelClass = instance.constructor as typeof KythiaModel;

			if (modelClass.isRedisConnected) {
				const tagsToInvalidate = modelClass._generateSmartTags(instance);

				if (Array.isArray(modelClass.customInvalidationTags)) {
					tagsToInvalidate.push(...modelClass.customInvalidationTags);
				}
				await modelClass.invalidateByTags(tagsToInvalidate);
			} else if (!modelClass.isShardMode) {
				modelClass._mapClearAllModelCache();
			}
		};

		const afterDestroyLogic = async (instance: any) => {
			const modelClass = instance.constructor as typeof KythiaModel;

			if (modelClass.isRedisConnected) {
				const tagsToInvalidate = modelClass._generateSmartTags(instance);

				if (Array.isArray(modelClass.customInvalidationTags)) {
					tagsToInvalidate.push(...modelClass.customInvalidationTags);
				}
				await modelClass.invalidateByTags(tagsToInvalidate);
			} else if (!modelClass.isShardMode) {
				modelClass._mapClearAllModelCache();
			}
		};

		const afterBulkLogic = async () => {
			if (this.isRedisConnected) {
				await this.invalidateByTags([`${this.name}`]);
			} else if (!this.isShardMode) {
				this._mapClearAllModelCache();
			}
		};

		this.addHook('afterSave', afterSaveLogic);
		this.addHook('afterDestroy', afterDestroyLogic);
		this.addHook('afterBulkCreate', afterBulkLogic);
		this.addHook('afterBulkUpdate', afterBulkLogic);
		this.addHook('afterBulkDestroy', afterBulkLogic);
	}

	/**
	 * 🪝 Iterates through all registered Sequelize models and attaches the cache hooks
	 * to any model that extends `KythiaModel`. This should be called once after all models
	 * have been defined and loaded.
	 */
	static attachHooksToAllModels(sequelizeInstance: Sequelize, client: any) {
		if (!this.redis) {
			this.logger.error(
				'❌ Cannot attach hooks because Redis is not initialized.',
			);
			return;
		}

		for (const modelName in sequelizeInstance.models) {
			const model = sequelizeInstance.models[modelName];
			if (model.prototype instanceof KythiaModel) {
				(model as any).client = client;
				this.logger.info(`⚙️  Attaching hooks to ${model.name}`);
				(model as any).initializeCacheHooks();
			}
		}
	}

	/**
	 * 🔄 Touches (updates the timestamp of) a parent model instance.
	 */
	static async touchParent(
		childInstance: any,
		foreignKeyField: string,
		ParentModel: typeof KythiaModel,
		timestampField: string = 'updatedAt',
	) {
		if (!childInstance || !childInstance[foreignKeyField]) {
			return;
		}

		try {
			const parentPk = ParentModel.primaryKeyAttribute;
			const parent = await ParentModel.findByPk(childInstance[foreignKeyField]);

			if (parent) {
				parent.changed(timestampField as any, true);
				await parent.save({ fields: [timestampField] as any });
				this.logger.info(
					`🔄 Touched parent ${ParentModel.name} #${(parent as any)[parentPk]} due to change in ${this.name}.`,
				);
			}
		} catch (e) {
			this.logger.error(`🔄 Failed to touch parent ${ParentModel.name}`, e);
		}
	}

	/**
	 * 🔄 Configures automatic parent touching on model hooks.
	 */
	static setupParentTouch(
		foreignKeyField: string,
		ParentModel: typeof KythiaModel,
		timestampField = 'updatedAt',
	) {
		const touchHandler = (instance: any) => {
			return this.touchParent(
				instance,
				foreignKeyField,
				ParentModel,
				timestampField,
			);
		};

		const bulkTouchHandler = (instances: any[]) => {
			if (instances && instances.length > 0) {
				return this.touchParent(
					instances[0],
					foreignKeyField,
					ParentModel,
					timestampField,
				);
			}
			return Promise.resolve();
		};

		this.addHook('afterSave', touchHandler);
		this.addHook('afterDestroy', touchHandler);
		this.addHook('afterBulkCreate', bulkTouchHandler);
	}
}

export default KythiaModel;
