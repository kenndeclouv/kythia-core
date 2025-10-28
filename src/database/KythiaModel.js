/**
 * 🚀 Caching Layer for Sequelize Models (Hybrid Redis + In-Memory Fallback Edition, Sniper Mode)
 *
 * @file src/database/KythiaModel.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.1-beta
 *
 * @description
 * The ultimate, high-availability caching layer. It prioritizes a central Redis cache for speed and
 * scalability. If Redis becomes unavailable, it seamlessly falls back to a per-process, in-memory
 * Map cache. This ensures the application remains fast and responsive even during cache server outages.
 *
 * ✨ Core Features (Hybrid Upgrade + Sniper Tagging):
 * -  Automatic Fallback: Switches from Redis to in-memory Map cache when Redis fails.
 * -  Zero Downtime Caching: The application always has a caching layer available.
 * -  Intelligent Routing: Core methods now act as routers, delegating to the active cache engine.
 * -  Consistent API: No changes needed in any other part of the application.
 * -  Tag-aware Sniper Invalidation for maximum precision on cache busting.
 * -  Smart: On Redis disconnect, will auto-reconnect attempts after several (configurable) minutes
 */

const jsonStringify = require('json-stable-stringify');
const { Model } = require('sequelize');

const NEGATIVE_CACHE_PLACEHOLDER = '__KYTHIA_NEGATIVE_CACHE__';
const RECONNECT_DELAY_MINUTES = 3;

function safeStringify(obj, logger) {
    try {
        return JSON.stringify(obj, (key, value) => (typeof value === 'bigint' ? value.toString() : value));
    } catch (err) {
        (logger || console).error(`❌ [SAFE STRINGIFY] Failed: ${err.message}`);
        return '{}';
    }
}

function safeParse(str, logger) {
    try {
        return JSON.parse(str);
    } catch {
        (logger || console).warn('⚠️ [SAFE PARSE] Invalid JSON data, returning null');
        return null;
    }
}

class KythiaModel extends Model {
    static client;
    static redis;
    static isRedisConnected = false;
    static logger = console;
    static config = {};
    static CACHE_VERSION = '1.0.0';

    static localCache = new Map();
    static localNegativeCache = new Set();
    static MAX_LOCAL_CACHE_SIZE = 1000;
    static DEFAULT_TTL = 60 * 60 * 1000;

    static lastRedisOpts = null;
    static reconnectTimeout = null;
    static lastAutoReconnectTs = 0;

    static pendingQueries = new Map();
    static cacheStats = { redisHits: 0, mapHits: 0, misses: 0, sets: 0, clears: 0, errors: 0 };

    static localCache = new Map();
    static localNegativeCache = new Set();
    static MAX_LOCAL_CACHE_SIZE = 1000;

    static pendingQueries = new Map();
    static cacheStats = { redisHits: 0, mapHits: 0, misses: 0, sets: 0, clears: 0, errors: 0 };
    static DEFAULT_TTL = 60 * 60 * 1000;

    /**
     * 💉 Injects core dependencies into the KythiaModel class.
     * This must be called once at application startup before any models are loaded.
     * @param {Object} dependencies - The dependencies to inject
     * @param {Object} dependencies.logger - The logger instance
     * @param {Object} dependencies.config - The application config object
     * @param {Object} [dependencies.redis] - Optional Redis client instance
     * @param {Object} [dependencies.redisOptions] - Redis connection options if not providing a client
     */
    static setDependencies({ logger, config, redis, redisOptions }) {
        if (!logger || !config) {
            throw new Error('KythiaModel.setDependencies requires logger and config');
        }

        this.logger = logger;
        this.config = config;
        this.CACHE_VERSION = config.db?.redisCacheVersion || '1.0.0';

        if (redis) {
            this.redis = redis;
            this.isRedisConnected = redis.status === 'ready';
        } else if (redisOptions) {
            this.initializeRedis(redisOptions);
        } else {
            this.logger.warn('🟠 [REDIS] No Redis client or options provided. Operating in In-Memory Cache mode only.');
            this.isRedisConnected = false;
        }
    }

    /**
     * 🔌 Initializes the Redis connection if not already initialized.
     * @param {string|Object} redisOptions - Redis connection string or options object
     * @returns {Object} The Redis client instance
     */
    static initializeRedis(redisOptions) {
        if (this.redis) return this.redis;

        const Redis = require('ioredis');
        this.lastRedisOpts = redisOptions;

        if (!redisOptions || (typeof redisOptions === 'string' && redisOptions.trim() === '')) {
            this.logger.warn('🟠 [REDIS] No Redis URL provided. Operating in In-Memory Cache mode only.');
            this.isRedisConnected = false;
            return null;
        }

        const retryStrategy = (times) => {
            if (times > 5) {
                this.logger.error(`❌ [REDIS] Could not connect after ${times - 1} retries. Falling back to In-Memory Cache.`);
                return null;
            }
            const delay = Math.min(times * 500, 2000);
            this.logger.warn(`🟠 [REDIS] Connection failed. Retrying in ${delay}ms (Attempt ${times})...`);
            return delay;
        };

        const finalOptions =
            typeof redisOptions === 'string'
                ? { url: redisOptions, retryStrategy, lazyConnect: true }
                : { maxRetriesPerRequest: 2, enableReadyCheck: true, retryStrategy, lazyConnect: true, ...redisOptions };

        this.redis = new Redis(
            typeof redisOptions === 'string' ? redisOptions : finalOptions,
            typeof redisOptions === 'string' ? finalOptions : undefined
        );

        this.redis.connect().catch((err) => {
            this.logger.error('❌ [REDIS] Initial connection failed:', err.message);
        });

        this._setupRedisEventHandlers();
        return this.redis;
    }

    /**
     * 🔌 Sets up Redis event handlers
     * @private
     */
    static _setupRedisEventHandlers() {
        this.redis.on('connect', () => {
            if (!this.isRedisConnected) {
                this.logger.info('✅ [REDIS] Connection established. Switching to Redis Cache mode.');
            }
            this.isRedisConnected = true;

            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        });

        this.redis.on('error', (err) => {
            if (err && (err.code === 'ECONNREFUSED' || err.message)) {
                this.logger.warn(`🟠 [REDIS] Error: ${err.message}`);
            }
        });

        this.redis.on('close', () => {
            if (this.isRedisConnected) {
                this.logger.error('❌ [REDIS] Connection closed. Falling back to In-Memory Cache mode.');
            }
            this.isRedisConnected = false;
            this._scheduleReconnect();
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
        this.logger.warn(`🟢 [REDIS] Attempting auto-reconnect after ${RECONNECT_DELAY_MINUTES}min downtime...`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.initializeRedis(this.lastRedisOpts);
        }, RECONNECT_DELAY_MINUTES * 60 * 1000);
    }

    /**
     * 🔑 Generates a consistent, model-specific cache key from a query identifier.
     * This ensures that the same query always produces the same key, preventing collisions.
     * @param {string|Object} queryIdentifier - A unique string or a Sequelize query object.
     * @returns {string} The final cache key, prefixed with the model's name (e.g., "User:{\"id\":1}").
     */
    static getCacheKey(queryIdentifier) {
        const keyBody =
            typeof queryIdentifier === 'string' ? queryIdentifier : jsonStringify(this.normalizeQueryOptions(queryIdentifier), this.logger);
        return `${this.CACHE_VERSION}:${this.name}:${keyBody}`;
    }

    /**
     * 🧽 Recursively normalizes a query options object to ensure deterministic key generation.
     * It sorts keys alphabetically and handles Sequelize's Symbol-based operators to produce
     * a consistent string representation for any given query.
     * @param {*} data - The query options or part of the options to normalize.
     * @returns {*} The normalized data.
     */
    static normalizeQueryOptions(data) {
        if (!data || typeof data !== 'object') return data;
        if (Array.isArray(data)) return data.map((item) => this.normalizeQueryOptions(item));
        const normalized = {};
        Object.keys(data)
            .sort()
            .forEach((key) => (normalized[key] = this.normalizeQueryOptions(data[key])));
        Object.getOwnPropertySymbols(data).forEach((symbol) => {
            const key = `$${symbol.toString().slice(7, -1)}`;
            normalized[key] = this.normalizeQueryOptions(data[symbol]);
        });
        return normalized;
    }

    /**
     * 📥 [HYBRID ROUTER] Sets a value in the currently active cache engine (Redis or Map).
     * This method acts as a router, delegating the operation to the appropriate
     * private implementation based on the Redis connection status.
     * @param {string|Object} cacheKeyOrQuery - The key or query object to store the data under.
     * @param {*} data - The data to cache. Use `null` for negative caching.
     * @param {number} [ttl=this.DEFAULT_TTL] - The time-to-live for the entry in milliseconds.
     * @param {string[]} [tags=[]] - Cache tags (for sniper tag-based invalidation)
     */
    static async setCacheEntry(cacheKeyOrQuery, data, ttl, tags = []) {
        const cacheKey = typeof cacheKeyOrQuery === 'string' ? cacheKeyOrQuery : this.getCacheKey(cacheKeyOrQuery);
        const finalTtl = ttl || this.CACHE_TTL || this.DEFAULT_TTL;

        if (this.isRedisConnected) {
            await this._redisSetCacheEntry(cacheKey, data, finalTtl, tags);
        } else {
            this._mapSetCacheEntry(cacheKey, data, finalTtl);
        }
    }

    /**
     * 📤 [HYBRID ROUTER] Retrieves a value from the currently active cache engine.
     * Delegates the read operation to either the Redis or the in-memory Map cache.
     * @param {string|Object} cacheKeyOrQuery - The key or query object of the item to retrieve.
     * @returns {Promise<{hit: boolean, data: *|undefined}>} An object indicating if the cache was hit and the retrieved data.
     */
    static async getCachedEntry(cacheKeyOrQuery, includeOptions) {
        const cacheKey = typeof cacheKeyOrQuery === 'string' ? cacheKeyOrQuery : this.getCacheKey(cacheKeyOrQuery);
        if (this.isRedisConnected) {
            return this._redisGetCachedEntry(cacheKey, includeOptions);
        } else {
            return this._mapGetCachedEntry(cacheKey, includeOptions);
        }
    }

    /**
     * 🗑️ [HYBRID ROUTER] Deletes an entry from the currently active cache engine.
     * Delegates the delete operation to the appropriate cache implementation.
     * @param {string|Object} keys - The query identifier used to generate the key to delete.
     */
    static async clearCache(keys) {
        const cacheKey = typeof keys === 'string' ? keys : this.getCacheKey(keys);
        if (this.isRedisConnected) {
            await this._redisClearCache(cacheKey);
        } else {
            this._mapClearCache(cacheKey);
        }
    }

    /**
     * 🔴 (Private) Sets a cache entry specifically in Redis, supporting tags for sniper invalidation.
     * Serializes the data to JSON and handles negative caching with a placeholder.
     * Uses Redis multi (transactional) to add tag sets.
     * @param {string} cacheKey - The Redis key.
     * @param {*} data - The data to cache.
     * @param {number} ttl - The TTL in milliseconds.
     * @param {string[]} tags - Tags to associate this entry with.
     * @private
     */
    static async _redisSetCacheEntry(cacheKey, data, ttl, tags = []) {
        try {
            let plainData = data;
            if (data && typeof data.toJSON === 'function') {
                plainData = data.toJSON();
            } else if (Array.isArray(data)) {
                plainData = data.map((item) => (item && typeof item.toJSON === 'function' ? item.toJSON() : item));
            }

            const valueToStore = plainData === null ? NEGATIVE_CACHE_PLACEHOLDER : safeStringify(plainData, this.logger);

            const multi = this.redis.multi();
            multi.set(cacheKey, valueToStore, 'PX', ttl);
            for (const tag of tags) {
                multi.sadd(tag, cacheKey);
            }
            await multi.exec();
            this.cacheStats.sets++;
        } catch (err) {
            this.logger.error(`❌ [REDIS SET] Failed for key ${cacheKey}. Falling back. Error:`, err.message);
            this.isRedisConnected = false;
            this._scheduleReconnect();
        }
    }

    /**
     * 🔴 (Private) Retrieves and deserializes an entry specifically from Redis.
     * It handles negative caching placeholders and rebuilds Sequelize instances from raw JSON data.
     * If the operation fails, it flags the Redis connection as down and returns a cache miss.
     * @param {string} cacheKey - The Redis key.
     * @returns {Promise<{hit: boolean, data: *|undefined}>} The cache result.
     * @private
     */
    static async _redisGetCachedEntry(cacheKey, includeOptions) {
        try {
            const result = await this.redis.get(cacheKey);
            if (result === null || result === undefined) return { hit: false, data: undefined };

            this.cacheStats.redisHits++;
            if (result === NEGATIVE_CACHE_PLACEHOLDER) return { hit: true, data: null };

            const parsedData = safeParse(result, this.logger);

            if (typeof parsedData !== 'object' || parsedData === null) {
                return { hit: true, data: parsedData };
            }

            const includeAsArray = includeOptions ? (Array.isArray(includeOptions) ? includeOptions : [includeOptions]) : null;

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
        } catch (err) {
            this.logger.error(`❌ [REDIS SET] Failed for key ${cacheKey}. Falling back. Error:`, err.message);
            this.isRedisConnected = false;
            this._scheduleReconnect();
        }
    }

    /**
     * 🔴 (Private) Deletes an entry specifically from Redis.
     * If the operation fails, it flags the Redis connection as down.
     * @param {string} cacheKey - The canonical cache key to delete.
     * @private
     */
    static async _redisClearCache(cacheKey) {
        try {
            await this.redis.del(cacheKey);
            this.cacheStats.clears++;
        } catch (err) {
            this.logger.error(`❌ [REDIS SET] Failed for key ${cacheKey}. Falling back. Error:`, err.message);
            this.isRedisConnected = false;
            this._scheduleReconnect();
        }
    }

    /**
     * 🎯 [SNIPER] Invalidates cache entries by tags in Redis.
     * @param {string[]} tags - An array of tags to invalidate.
     */
    static async invalidateByTags(tags) {
        if (!this.isRedisConnected || !Array.isArray(tags) || tags.length === 0) return;

        try {
            const keysToDelete = await this.redis.sunion(tags);

            if (keysToDelete && keysToDelete.length > 0) {
                this.logger.info(`🎯 [SNIPER] Invalidating ${keysToDelete.length} keys for tags: ${tags.join(', ')}`);

                await this.redis.multi().del(keysToDelete).del(tags).exec();
            } else {
                await this.redis.del(tags);
            }
        } catch (err) {
            this.logger.error(`❌ [REDIS SET] Failed for key ${cacheKey}. Falling back. Error:`, err.message);
            this.isRedisConnected = false;
            this._scheduleReconnect();
        }
    }

    /**
     * 🗺️ (Private) Sets a cache entry specifically in the in-memory Map.
     * It clones the data to prevent mutation issues and handles negative caching.
     * Also manages a simple FIFO-like eviction policy if the cache size limit is reached.
     * @param {string} cacheKey - The Map key.
     * @param {*} data - The data to cache.
     * @param {number} ttl - The TTL in milliseconds.
     * @private
     */
    static _mapSetCacheEntry(cacheKey, data, ttl) {
        if (this.localCache.size >= this.MAX_LOCAL_CACHE_SIZE) {
            const firstKey = this.localCache.keys().next().value;
            this.localCache.delete(firstKey);
        }

        if (data === null) {
            this.localNegativeCache.add(cacheKey);
            this.localCache.delete(cacheKey);
        } else {
            let plainData = data;
            if (data && typeof data.toJSON === 'function') {
                plainData = data.toJSON();
            } else if (Array.isArray(data)) {
                plainData = data.map((item) => (item && typeof item.toJSON === 'function' ? item.toJSON() : item));
            }

            const dataCopy = plainData === null ? NEGATIVE_CACHE_PLACEHOLDER : safeStringify(plainData, this.logger);

            this.localCache.set(cacheKey, { data: dataCopy, expires: Date.now() + ttl });
            this.localNegativeCache.delete(cacheKey);
        }
        this.cacheStats.sets++;
    }

    /**
     * 🗺️ (Private) Retrieves an entry specifically from the in-memory Map.
     * It checks for expired entries, handles negative caching, and rebuilds fresh
     * Sequelize instances from the stored plain objects to ensure data integrity.
     * @param {string} cacheKey - The Map key.
     * @returns {{hit: boolean, data: *|undefined}} The cache result.
     * @private
     */
    static _mapGetCachedEntry(cacheKey, includeOptions) {
        if (this.localNegativeCache.has(cacheKey)) {
            this.cacheStats.mapHits++;
            return { hit: true, data: null };
        }

        const entry = this.localCache.get(cacheKey);
        if (entry && entry.expires > Date.now()) {
            this.cacheStats.mapHits++;

            const dataRaw = entry.data;

            let parsedData;
            if (typeof dataRaw === 'string') {
                parsedData = safeParse(dataRaw, this.logger);
            } else {
                parsedData = dataRaw;
            }

            if (typeof parsedData !== 'object' || parsedData === null) {
                return { hit: true, data: parsedData };
            }

            const includeAsArray = includeOptions ? (Array.isArray(includeOptions) ? includeOptions : [includeOptions]) : null;

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
     * @param {string} cacheKey - The canonical cache key to delete.
     * @private
     */
    static _mapClearCache(cacheKey) {
        this.localCache.delete(cacheKey);
        this.localNegativeCache.delete(cacheKey);
        this.cacheStats.clears++;
    }

    /**
     * 🗺️ (Private) Clears all in-memory cache entries for this model.
     * Used as a fallback when Redis is disconnected.
     * @private
     */
    static _mapClearAllModelCache() {
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
            this.logger.info(`♻️ [MAP CACHE] Cleared ${cleared} in-memory entries for ${this.name} (Redis fallback).`);
        }
    }

    /**
     * 🔄 (Internal) Standardizes various query object formats into a consistent Sequelize options object.
     * This helper ensures that `getCache({ id: 1 })` and `getCache({ where: { id: 1 } })` are treated identically.
     * @param {Object} options - The user-provided query options.
     * @returns {Object} A standardized options object with a `where` property.
     * @private
     */
    static _normalizeFindOptions(options) {
        if (!options || typeof options !== 'object' || Object.keys(options).length === 0) return { where: {} };
        if (options.where) {
            const sequelizeOptions = { ...options };
            delete sequelizeOptions.cacheTags;
            delete sequelizeOptions.noCache;
            return sequelizeOptions;
        }
        const knownOptions = ['order', 'limit', 'attributes', 'include', 'group', 'having'];

        const cacheSpecificOptions = ['cacheTags', 'noCache'];
        const whereClause = {};
        const otherOptions = {};
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
     * This is the primary method for retrieving individual model instances. It's fully hybrid-aware.
     * @param {Object} keys - A Sequelize `where` clause or a query options object.
     * @returns {Promise<Model|null>} A single model instance or null if not found.
     */
    static async getCache(keys, options = {}) {
        if (options.noCache) {
            const filteredOpts = { ...options };
            delete filteredOpts.cacheTags;
            return this.findOne(this._normalizeFindOptions(keys));
        }
        if (!keys || Array.isArray(keys)) {
            if (Array.isArray(keys)) {
                const pk = this.primaryKeyAttribute;
                return this.findAll({ where: { [pk]: keys.map((m) => m[pk]) } });
            }
            return null;
        }
        const normalizedOptions = this._normalizeFindOptions(keys);
        if (!normalizedOptions.where || Object.keys(normalizedOptions.where).length === 0) return null;
        const cacheKey = this.getCacheKey(normalizedOptions);

        const cacheResult = await this.getCachedEntry(cacheKey, normalizedOptions.include);
        if (cacheResult.hit) {
            return cacheResult.data;
        }

        this.cacheStats.misses++;

        if (this.pendingQueries.has(cacheKey)) {
            return this.pendingQueries.get(cacheKey);
        }

        const queryPromise = this.findOne(normalizedOptions)
            .then((record) => {
                const tags = [`${this.name}`];
                if (record) {
                    const pk = this.primaryKeyAttribute;
                    tags.push(`${this.name}:${pk}:${record[pk]}`);
                }
                this.setCacheEntry(cacheKey, record, undefined, tags);
                return record;
            })
            .finally(() => {
                this.pendingQueries.delete(cacheKey);
            });

        this.pendingQueries.set(cacheKey, queryPromise);
        return queryPromise;
    }

    /**
     * 📦 Fetches an array of records from the cache, falling back to the database.
     * Ideal for caching lists of results from `findAll` queries. Fully hybrid-aware.
     * @param {Object} [options={}] - A Sequelize `findAll` options object (containing `where`, `order`, etc.).
     * @returns {Promise<Model[]>} An array of model instances.
     */
    static async getAllCache(options = {}) {
        const { cacheTags, noCache, ...queryOptions } = options || {};

        if (noCache) {
            return this.findAll(this._normalizeFindOptions(queryOptions));
        }
        const normalizedOptions = this._normalizeFindOptions(queryOptions);
        const cacheKey = this.getCacheKey(normalizedOptions);

        const cacheResult = await this.getCachedEntry(cacheKey, normalizedOptions.include);
        if (cacheResult.hit) {
            return cacheResult.data;
        }

        this.cacheStats.misses++;

        if (this.pendingQueries.has(cacheKey)) {
            return this.pendingQueries.get(cacheKey);
        }

        const queryPromise = this.findAll(normalizedOptions)
            .then((records) => {
                const tags = [`${this.name}`];

                if (Array.isArray(cacheTags)) {
                    tags.push(...cacheTags);
                }
                this.setCacheEntry(cacheKey, records, undefined, tags);

                return records;
            })
            .finally(() => {
                this.pendingQueries.delete(cacheKey);
            });

        this.pendingQueries.set(cacheKey, queryPromise);
        return queryPromise;
    }

    /**
     * 📦 Attempts to find a record based on `options.where`. If found, it returns the cached or DB record.
     * If not found, it creates a new record using `options.defaults`. The operation is cache-aware.
     * This method also includes in-memory locking to prevent race conditions.
     * @param {Object} options - A Sequelize `findOrCreate` options object.
     * @returns {Promise<[Model, boolean]>} An array containing the instance and a boolean indicating if it was created.
     */
    static async findOrCreateWithCache(options) {
        if (!options || !options.where) {
            throw new Error("findOrCreateWithCache requires a 'where' option.");
        }

        const { cacheTags, noCache, ...findOrCreateOptions } = options;

        const cacheKey = this.getCacheKey(options.where);
        const cacheResult = await this.getCachedEntry(cacheKey);
        if (cacheResult.hit && cacheResult.data) {
            return [cacheResult.data, false];
        }
        this.cacheStats.misses++;
        if (this.pendingQueries.has(cacheKey)) {
            return this.pendingQueries.get(cacheKey);
        }
        const findOrCreatePromise = this.findOrCreate(findOrCreateOptions)
            .then(([instance, created]) => {
                const tags = [`${this.name}`];
                if (instance) {
                    const pk = this.primaryKeyAttribute;
                    tags.push(`${this.name}:${pk}:${instance[pk]}`);
                }
                this.setCacheEntry(cacheKey, instance, undefined, tags);
                return [instance, created];
            })
            .finally(() => {
                this.pendingQueries.delete(cacheKey);
            });

        this.pendingQueries.set(cacheKey, findOrCreatePromise);
        return findOrCreatePromise;
    }

    /**
     * 📦 Fetches the count of records matching the query from the cache, falling back to the database.
     * @param {Object} [options={}] - A Sequelize `count` options object.
     * @param {number} [ttl] - A specific TTL for this count operation.
     * @returns {Promise<number>} The total number of matching records.
     */
    static async countWithCache(options = {}, ttl = 5 * 60 * 1000) {
        const { cacheTags, noCache, ...countOptions } = options || {};

        const cacheKeyOptions = { queryType: 'count', ...countOptions };
        const cacheKey = this.getCacheKey(cacheKeyOptions);
        const cacheResult = await this.getCachedEntry(cacheKey);
        if (cacheResult.hit) {
            return cacheResult.data;
        }
        this.cacheStats.misses++;
        const count = await this.count(countOptions);

        const tags = [`${this.name}`];
        this.setCacheEntry(cacheKey, count, ttl, tags);
        return count;
    }

    /**
     * 📦 An instance method that saves the current model instance to the database and then
     * intelligently updates its corresponding entry in the active cache.
     * @returns {Promise<this>} The saved instance.
     */
    async saveAndUpdateCache() {
        const savedInstance = await this.save();
        const pk = this.constructor.primaryKeyAttribute;
        const pkValue = this[pk];
        if (pkValue) {
            const cacheKey = this.constructor.getCacheKey({ [pk]: pkValue });
            const tags = [`${this.constructor.name}`, `${this.constructor.name}:${pk}:${pkValue}`];
            await this.constructor.setCacheEntry(cacheKey, savedInstance, undefined, tags);
        }
        return savedInstance;
    }

    /**
     * 📦 A convenience alias for `clearCache`. In the hybrid system, positive and negative
     * cache entries for the same key are managed together, so clearing one clears the other.
     * @param {string|Object} keys - The query identifier to clear.
     */
    static async clearNegativeCache(keys) {
        return this.clearCache(keys);
    }

    /**
     * 📦 Fetches a raw aggregate result from the cache, falling back to the database.
     * Ideal for caching results from functions like AVG, SUM, MAX etc.
     * @param {Object} options - A Sequelize `findAll` options object, usually with `attributes` and `raw: true`.
     * @param {Object} [cacheOptions={}] - Options for caching, like ttl and tags.
     * @returns {Promise<*>} The raw result from the aggregation.
     */
    static async aggregateWithCache(options = {}, cacheOptions = {}) {
        const { cacheTags, noCache, ...queryOptions } = options || {};
        const { ttl = 5 * 60 * 1000 } = cacheOptions || {};
        const cacheKeyOptions = { queryType: 'aggregate', ...queryOptions };
        const cacheKey = this.getCacheKey(cacheKeyOptions);

        const cacheResult = await this.getCachedEntry(cacheKey);
        if (cacheResult.hit) {
            return cacheResult.data;
        }

        this.cacheStats.misses++;

        const result = await this.findAll(queryOptions);

        const tags = [`${this.name}`];
        if (Array.isArray(cacheTags)) tags.push(...cacheTags);
        this.setCacheEntry(cacheKey, result, ttl, tags);

        return result;
    }

    /**
     * 🪝 Attaches Sequelize lifecycle hooks (`afterSave`, `afterDestroy`, etc.) to this model.
     * These hooks automatically and intelligently invalidate or update cache entries
     * in the active cache engine (Redis or Map) whenever data changes.
     * * ✨ [HYBRID AWARE]
     * - If Redis is connected: Uses precise, tag-based "Sniper" invalidation.
     * - If Redis is disconnected: Falls back to brute-force "Nuke" invalidation for
     * the in-memory cache to guarantee data consistency.
     */
    static initializeCacheHooks() {
        if (!this.redis) {
            this.logger.warn(`❌ Redis not initialized for model ${this.name}. Cache hooks will not be attached.`);
            return;
        }

        /**
         * Logika setelah data disimpan (Create atau Update)
         */
        const afterSaveLogic = async (instance) => {
            const modelClass = instance.constructor;

            if (modelClass.isRedisConnected) {
                const tagsToInvalidate = [`${modelClass.name}`];
                const pk = modelClass.primaryKeyAttribute;
                tagsToInvalidate.push(`${modelClass.name}:${pk}:${instance[pk]}`);

                if (Array.isArray(modelClass.customInvalidationTags)) {
                    tagsToInvalidate.push(...modelClass.customInvalidationTags);
                }
                await modelClass.invalidateByTags(tagsToInvalidate);
            } else {
                modelClass._mapClearAllModelCache();
            }
        };

        /**
         * Logika setelah data dihapus
         */
        const afterDestroyLogic = async (instance) => {
            const modelClass = instance.constructor;

            if (modelClass.isRedisConnected) {
                const tagsToInvalidate = [`${modelClass.name}`];
                const pk = modelClass.primaryKeyAttribute;
                tagsToInvalidate.push(`${modelClass.name}:${pk}:${instance[pk]}`);

                if (Array.isArray(modelClass.customInvalidationTags)) {
                    tagsToInvalidate.push(...modelClass.customInvalidationTags);
                }
                await modelClass.invalidateByTags(tagsToInvalidate);
            } else {
                modelClass._mapClearAllModelCache();
            }
        };

        const afterBulkLogic = async () => {
            if (this.isRedisConnected) {
                await this.invalidateByTags([`${this.name}`]);
            } else {
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
     * @param {Sequelize} sequelizeInstance - The active Sequelize instance containing all models.
     */
    static attachHooksToAllModels(sequelizeInstance, client) {
        if (!this.redis) {
            this.logger.error('❌ Cannot attach hooks because Redis is not initialized.');
            return;
        }

        for (const modelName in sequelizeInstance.models) {
            const model = sequelizeInstance.models[modelName];
            if (model.prototype instanceof KythiaModel) {
                model.client = client;
                this.logger.info(`⚙️  Attaching hooks to ${model.name}`);
                model.initializeCacheHooks();
            }
        }
    }

    /**
     * 🔄 Touches (updates the timestamp of) a parent model instance.
     * This is useful for updating parent records when child records change.
     * @param {Object} childInstance - The child model instance that triggered the touch.
     * @param {string} foreignKeyField - The field name in the child that references the parent's primary key.
     * @param {typeof KythiaModel} ParentModel - The parent model class to touch.
     * @param {string} [timestampField='updatedAt'] - The timestamp field to update on the parent.
     * @returns {Promise<void>}
     */
    static async touchParent(childInstance, foreignKeyField, ParentModel, timestampField = 'updatedAt') {
        if (!childInstance || !childInstance[foreignKeyField]) {
            return;
        }

        try {
            const parentPk = ParentModel.primaryKeyAttribute;
            const parent = await ParentModel.findByPk(childInstance[foreignKeyField]);

            if (parent) {
                parent.changed(timestampField, true);
                await parent.save({ fields: [timestampField] });
                this.logger.info(`🔄 Touched parent ${ParentModel.name} #${parent[parentPk]} due to change in ${this.name}.`);
            }
        } catch (e) {
            this.logger.error(`🔄 Failed to touch parent ${ParentModel.name}`, e);
        }
    }

    /**
     * 🔄 Configures automatic parent touching on model hooks.
     * This method sets up hooks that automatically update parent timestamps when child records change.
     * @param {string} foreignKeyField - The field name in the child that references the parent's primary key.
     * @param {typeof KythiaModel} ParentModel - The parent model class to touch.
     * @param {string} [timestampField='updatedAt'] - The timestamp field to update on the parent.
     * @returns {void}
     */
    static setupParentTouch(foreignKeyField, ParentModel, timestampField = 'updatedAt') {
        const touchHandler = (instance) => {
            return this.touchParent(instance, foreignKeyField, ParentModel, timestampField);
        };

        const bulkTouchHandler = (instances) => {
            if (instances && instances.length > 0) {
                return this.touchParent(instances[0], foreignKeyField, ParentModel, timestampField);
            }
        };

        this.addHook('afterSave', touchHandler);
        this.addHook('afterDestroy', touchHandler);
        this.addHook('afterBulkCreate', bulkTouchHandler);
    }
}

module.exports = KythiaModel;
