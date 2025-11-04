/**
 * 🚀 Caching Layer for Sequelize Models (Hybrid Redis + In-Memory Fallback Edition, Sniper Mode, Shard-aware)
 *
 * @file src/database/KythiaModel.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.4-beta
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

const jsonStringify = require('json-stable-stringify');
const { Model } = require('sequelize');
const { LRUCache } = require('lru-cache');

const NEGATIVE_CACHE_PLACEHOLDER = '__KYTHIA_NEGATIVE_CACHE__';
const RECONNECT_DELAY_MINUTES = 3;

const REDIS_ERROR_TOLERANCE_COUNT = 3;
const REDIS_ERROR_TOLERANCE_INTERVAL_MS = 10 * 1000;

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

    static localCache = new LRUCache({ max: 1000 });
    static localNegativeCache = new Set();
    static MAX_LOCAL_CACHE_SIZE = 1000;
    static DEFAULT_TTL = 60 * 60 * 1000;

    static lastRedisOpts = null;
    static reconnectTimeout = null;
    static lastAutoReconnectTs = 0;

    static pendingQueries = new Map();
    static cacheStats = { redisHits: 0, mapHits: 0, misses: 0, sets: 0, clears: 0, errors: 0 };

    static redisErrorTimestamps = [];

    static isShardMode = false;

    static _redisFallbackURLs = [];
    static _redisCurrentIndex = 0;
    static _redisFailedIndexes = new Set();
    static _justFailedOver = false;

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
    static setDependencies({ logger, config, redis, redisOptions }) {
        if (!logger || !config) {
            throw new Error('KythiaModel.setDependencies requires logger and config');
        }

        this.logger = logger;
        this.config = config;
        this.CACHE_VERSION = config.db?.redisCacheVersion || '1.0.0';

        this.isShardMode = !!config?.db?.redis?.shard || false;
        if (this.isShardMode) {
            this.logger.info('🟣 [REDIS][SHARD] Detected redis sharding mode (shard: true). Local fallback cache DISABLED!');
        }

        if (Array.isArray(redisOptions)) {
            this._redisFallbackURLs = redisOptions.slice();
        } else if (typeof redisOptions === 'string') {
            this._redisFallbackURLs = redisOptions.split(',').map((url) => url.trim());
        } else if (redisOptions && typeof redisOptions === 'object' && Array.isArray(redisOptions.urls)) {
            this._redisFallbackURLs = redisOptions.urls.slice();
        } else if (redisOptions) {
            this._redisFallbackURLs = [redisOptions];
        } else {
            this._redisFallbackURLs = [];
        }

        this._redisCurrentIndex = 0;

        if (redis) {
            this.redis = redis;
            this.isRedisConnected = redis.status === 'ready';
        } else if (this._redisFallbackURLs.length > 0) {
            this.initializeRedis();
        } else {
            if (this.isShardMode) {
                this.logger.error('❌ [REDIS][SHARD] No Redis client/options, but shard:true. Application will work WITHOUT caching!');
                this.isRedisConnected = false;
            } else {
                this.logger.warn('🟠 [REDIS] No Redis client or options provided. Operating in In-Memory Cache mode only.');
                this.isRedisConnected = false;
            }
        }
    }

    /**
     * Helper: Track redis error timestamp, and check if error count in interval exceeds tolerance.
     * Jika error yang terjadi >= REDIS_ERROR_TOLERANCE_COUNT dalam  REDIS_ERROR_TOLERANCE_INTERVAL_MS,
     * barulah coba connect ke redis berikutnya (multi redis), jika tidak ada, baru fallback ke In-Memory (isRedisConnected = false)
     * -- KECUALI jika shard: true.
     */
    static _trackRedisError(err) {
        const now = Date.now();

        this.redisErrorTimestamps = (this.redisErrorTimestamps || []).filter((ts) => now - ts < REDIS_ERROR_TOLERANCE_INTERVAL_MS);
        this.redisErrorTimestamps.push(now);

        if (this.redisErrorTimestamps.length >= REDIS_ERROR_TOLERANCE_COUNT) {
            if (this.isRedisConnected) {
                const triedFallback = this._tryRedisFailover();
                if (triedFallback) {
                    this.logger.warn(`[REDIS] Error tolerance reached, switching to NEXT Redis failover...`);
                } else if (this.isShardMode) {
                    this.logger.error(
                        `❌ [REDIS][SHARD] ${this.redisErrorTimestamps.length} consecutive errors in ${
                            REDIS_ERROR_TOLERANCE_INTERVAL_MS / 1000
                        }s. SHARD MODE: Disabling cache (NO fallback), all queries go to DB. (Last error: ${err?.message})`
                    );
                    this.isRedisConnected = false;
                    this._scheduleReconnect();
                } else {
                    this.logger.error(
                        `❌ [REDIS] ${this.redisErrorTimestamps.length} consecutive errors in ${
                            REDIS_ERROR_TOLERANCE_INTERVAL_MS / 1000
                        }s. All Redis exhausted, fallback to In-Memory Cache! (Last error: ${err?.message})`
                    );
                    this.isRedisConnected = false;
                    this._scheduleReconnect();
                }
            }

            this.redisErrorTimestamps = [];
        } else {
            this.logger.warn(
                `🟠 [REDIS] Error #${this.redisErrorTimestamps.length}/${REDIS_ERROR_TOLERANCE_COUNT} tolerated. (${err?.message})`
            );
        }
    }

    /**
     * Coba switch ke redis URL berikutnya jika ada. Return true jika switching, false jika tidak ada lagi.
     * PRIVATE.
     */
    static _tryRedisFailover() {
        if (!Array.isArray(this._redisFallbackURLs) || this._redisFallbackURLs.length < 2) {
            return false;
        }
        const prevIndex = this._redisCurrentIndex;
        if (this._redisCurrentIndex + 1 < this._redisFallbackURLs.length) {
            this._redisCurrentIndex++;
            this.logger.warn(
                `[REDIS][FAILOVER] Trying to switch Redis connection from url index ${prevIndex} to ${this._redisCurrentIndex}`
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
            } catch (e) {}
        }
        this.redis = undefined;
        this.isRedisConnected = false;
    }

    /**
     * 🔌 Initializes the Redis connection if not already initialized.
     * (Versi ini MENGHAPUS lazyConnect dan _attemptConnection untuk fix race condition)
     */
    static initializeRedis(redisOptions) {
        if (redisOptions) {
            if (Array.isArray(redisOptions)) {
                this._redisFallbackURLs = redisOptions.slice();
                this._redisCurrentIndex = 0;
            } else if (redisOptions && typeof redisOptions === 'object' && Array.isArray(redisOptions.urls)) {
                this._redisFallbackURLs = redisOptions.urls.slice();
                this._redisCurrentIndex = 0;
            } else {
                this._redisFallbackURLs = [redisOptions];
                this._redisCurrentIndex = 0;
            }
        }

        if (!Array.isArray(this._redisFallbackURLs) || this._redisFallbackURLs.length === 0) {
            if (this.isShardMode) {
                this.logger.error('❌ [REDIS][SHARD] No Redis URL/options provided but shard:true. Will run without caching!');
                this.isRedisConnected = false;
            } else {
                this.logger.warn('🟠 [REDIS] No Redis client or options provided. Operating in In-Memory Cache mode only.');
                this.isRedisConnected = false;
            }
            return null;
        }

        const Redis = require('ioredis');
        this.lastRedisOpts = Array.isArray(this._redisFallbackURLs) ? this._redisFallbackURLs.slice() : [this._redisFallbackURLs];

        if (this.redis) return this.redis;

        const opt = this._redisFallbackURLs[this._redisCurrentIndex];

        if (opt && typeof opt === 'object' && opt.shard) {
            this.isShardMode = true;
        }

        let redisOpt;
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
            `[REDIS][INIT] Connecting to Redis fallback #${this._redisCurrentIndex + 1}/${this._redisFallbackURLs.length}: ${
                typeof opt === 'string' ? opt : redisOpt.url || '(object)'
            }`
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
        return (times) => {
            if (times > 5) {
                this.logger.error(`❌ [REDIS] Could not connect after ${times - 1} retries for Redis #${this._redisCurrentIndex + 1}.`);
                return null;
            }
            const delay = Math.min(times * 500, 2000);
            this.logger.warn(
                `🟠 [REDIS] Connection failed for Redis #${this._redisCurrentIndex + 1}. Retrying in ${delay}ms (Attempt ${times})...`
            );
            return delay;
        };
    }

    /**
     * 🔌 Sets up Redis event handlers
     * @private
     */
    static _setupRedisEventHandlers() {
        this.redis.on('connect', async () => {
            if (!this.isRedisConnected) {
                this.logger.info('✅ [REDIS] Connection established. Switching to Redis Cache mode.');
            }
            this.isRedisConnected = true;
            this.redisErrorTimestamps = [];
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            this._redisFailedIndexes.delete(this._redisCurrentIndex);

            if (this._justFailedOver) {
                this.logger.warn(`[REDIS][FAILOVER] Connected to new server, flushing potentially stale cache...`);
                try {
                    await this.redis.flushdb();
                    this.logger.info(`[REDIS][FAILOVER] Stale cache flushed successfully.`);
                } catch (err) {
                    this.logger.error(`[REDIS][FAILOVER] FAILED TO FLUSH CACHE:`, err);
                }
                this._justFailedOver = false;
            }
        });

        this.redis.on('error', (err) => {
            if (err && (err.code === 'ECONNREFUSED' || err.message)) {
                this.logger.warn(`🟠 [REDIS] Connection error: ${err.message}`);
            }
        });

        this.redis.on('close', () => {
            if (this.isRedisConnected) {
                if (this.isShardMode) {
                    this.logger.error('❌ [REDIS][SHARD] Connection closed. Cache DISABLED (no fallback).');
                } else {
                    this.logger.error('❌ [REDIS] Connection closed. Fallback/failover will be attempted.');
                }
            }
            this.isRedisConnected = false;

            this._redisFailedIndexes.add(this._redisCurrentIndex);

            this.logger.warn(`[REDIS] Connection #${this._redisCurrentIndex + 1} closed. Attempting immediate failover...`);
            const triedFailover = this._tryRedisFailover();

            if (!triedFailover) {
                this.logger.warn(`[REDIS] Failover exhausted. Scheduling full reconnect...`);
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
            this.logger.warn(`[REDIS][SHARD] Attempting auto-reconnect after ${RECONNECT_DELAY_MINUTES}min downtime...`);
        } else {
            this.logger.warn(`🟢 [REDIS] Attempting auto-reconnect after ${RECONNECT_DELAY_MINUTES}min downtime...`);
        }

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;

            this._redisCurrentIndex = 0;
            this._redisFailedIndexes.clear();
            this._closeCurrentRedis();
            this.initializeRedis();
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
     * 📥 [HYBRID/SHARD ROUTER] Sets a value in the currently active cache engine.
     * In shard mode, if Redis down, nothing is cached.
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
    static async getCachedEntry(cacheKeyOrQuery, includeOptions) {
        const cacheKey = typeof cacheKeyOrQuery === 'string' ? cacheKeyOrQuery : this.getCacheKey(cacheKeyOrQuery);
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
    static async clearCache(keys) {
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
            this._trackRedisError(err);
        }
    }

    /**
     * 🔴 (Private) Retrieves and deserializes an entry specifically from Redis.
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
            this._trackRedisError(err);
            return { hit: false, data: undefined };
        }
    }

    /**
     * 🔴 (Private) Deletes an entry specifically from Redis.
     */
    static async _redisClearCache(cacheKey) {
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
            this._trackRedisError(err);
        }
    }

    /**
     * 🗺️ (Private) Sets a cache entry specifically in the in-memory Map.
     * DISABLED in shard mode.
     */
    static _mapSetCacheEntry(cacheKey, data, ttl) {
        if (this.isShardMode) return;

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
     * DISABLED in shard mode.
     */
    static _mapGetCachedEntry(cacheKey, includeOptions) {
        if (this.isShardMode) return { hit: false, data: undefined };

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
     * DISABLED in shard mode.
     */
    static _mapClearCache(cacheKey) {
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
            this.logger.info(`♻️ [MAP CACHE] Cleared ${cleared} in-memory entries for ${this.name} (Redis fallback).`);
        }
    }

    /**
     * 🔄 (Internal) Standardizes various query object formats into a consistent Sequelize options object.
     * This helper ensures that `getCache({ id: 1 })` and `getCache({ where: { id: 1 } })` are treated identically.
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
     * In SHARD mode/fallback, cache miss triggers instant DB query, no in-memory caching.
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
                if (this.isRedisConnected || !this.isShardMode) {
                    const tags = [`${this.name}`];
                    if (record) {
                        const pk = this.primaryKeyAttribute;
                        tags.push(`${this.name}:${pk}:${record[pk]}`);
                    }
                    this.setCacheEntry(cacheKey, record, undefined, tags);
                }
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
                if (this.isRedisConnected || !this.isShardMode) {
                    const tags = [`${this.name}`];

                    if (Array.isArray(cacheTags)) {
                        tags.push(...cacheTags);
                    }
                    this.setCacheEntry(cacheKey, records, undefined, tags);
                }
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
                if (this.isRedisConnected || !this.isShardMode) {
                    const tags = [`${this.name}`];
                    if (instance) {
                        const pk = this.primaryKeyAttribute;
                        tags.push(`${this.name}:${pk}:${instance[pk]}`);
                    }
                    this.setCacheEntry(cacheKey, instance, undefined, tags);
                }
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

        if (this.isRedisConnected || !this.isShardMode) {
            const tags = [`${this.name}`];
            this.setCacheEntry(cacheKey, count, ttl, tags);
        }
        return count;
    }

    /**
     * 📦 An instance method that saves the current model instance to the database and then
     * intelligently updates its corresponding entry in the active cache.
     */
    async saveAndUpdateCache() {
        const savedInstance = await this.save();
        const pk = this.constructor.primaryKeyAttribute;
        const pkValue = this[pk];
        if (pkValue && (this.constructor.isRedisConnected || !this.constructor.isShardMode)) {
            const cacheKey = this.constructor.getCacheKey({ [pk]: pkValue });
            const tags = [`${this.constructor.name}`, `${this.constructor.name}:${pk}:${pkValue}`];
            await this.constructor.setCacheEntry(cacheKey, savedInstance, undefined, tags);
        }
        return savedInstance;
    }

    /**
     * 📦 A convenience alias for `clearCache`. In the hybrid system, positive and negative
     * cache entries for the same key are managed together, so clearing one clears the other.
     */
    static async clearNegativeCache(keys) {
        return this.clearCache(keys);
    }

    /**
     * 📦 Fetches a raw aggregate result from the cache, falling back to the database.
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
            } else if (!modelClass.isShardMode) {
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
