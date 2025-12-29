/**
 * 🎯 Sequelize Type Definitions for KythiaModel
 *
 * @file src/types/Sequelize.ts
 * @description Provides generic type wrappers for Sequelize models with cache support
 */

import type {
	Model,
	ModelStatic,
	FindOptions,
	Attributes,
	ModelAttributes,
	CreationAttributes,
	InferAttributes,
	InferCreationAttributes,
} from 'sequelize';

/**
 * Cache operation result - discriminated union for type safety
 */
export type CacheResult<T> =
	| { hit: true; data: T }
	| { hit: false; data: null };

/**
 * Extended find options with cache controls
 */
export interface KythiaFindOptions<M extends Model>
	extends FindOptions<Attributes<M>> {
	/** Bypass cache and query database directly */
	noCache?: boolean;

	/** Custom cache key instead of auto-generated */
	customCacheKey?: string;

	/** Time-to-live in seconds */
	ttl?: number;

	/** Tags for cache invalidation */
	cacheTags?: string[];
}

/**
 * Find or create options with cache support
 */
export interface KythiaFindOrCreateOptions<M extends Model> {
	/** Criteria to search for */
	where: Partial<Attributes<M>>;

	/** Default values if creating new record */
	defaults?: Partial<Attributes<M>>;

	/** Bypass cache */
	noCache?: boolean;
}

/**
 * Count options with cache support
 */
export interface KythiaCountOptions<M extends Model> {
	/** Where clause for counting */
	where?: Partial<Attributes<M>>;

	/** Bypass cache */
	noCache?: boolean;

	/** Custom cache key */
	customCacheKey?: string;

	/** TTL for cached count */
	ttl?: number;
}

/**
 * Generic KythiaModel static interface
 * Extends Sequelize ModelStatic with cache methods
 */
export interface KythiaModelStatic<M extends Model = Model>
	extends ModelStatic<M> {
	/**
	 * Get single record from cache or database
	 */
	getCache<T extends M>(
		this: ModelStatic<T>,
		options: KythiaFindOptions<T>,
	): Promise<T | null>;

	/**
	 * Get multiple records from cache or database
	 */
	getAllCache<T extends M>(
		this: ModelStatic<T>,
		options?: KythiaFindOptions<T>,
	): Promise<T[]>;

	/**
	 * Find or create with cache support
	 * Returns [instance, wasCreated]
	 */
	findOrCreateWithCache<T extends M>(
		this: ModelStatic<T>,
		options: KythiaFindOrCreateOptions<T>,
	): Promise<[T, boolean]>;

	/**
	 * Count records with cache
	 */
	countWithCache<T extends M>(
		this: ModelStatic<T>,
		options?: KythiaCountOptions<T>,
	): Promise<number>;

	/**
	 * Invalidate all cache entries for this model
	 */
	invalidateCache(): Promise<void>;

	/**
	 * Set cache entry manually
	 */
	setCacheEntry<T>(
		key: string,
		data: T,
		ttl?: number,
		tags?: string[],
	): Promise<void>;

	/**
	 * Get cache entry if exists
	 */
	getCachedEntry<T>(key: string, include?: unknown): Promise<CacheResult<T>>;

	/**
	 * Generate cache key from query
	 */
	getCacheKey(queryIdentifier: unknown): string;

	/**
	 * Normalize query options for consistent cache keys
	 */
	normalizeQueryOptions(options: unknown): unknown;

	/**
	 * Auto-boot the model (introspect database)
	 */
	autoBoot(sequelize: unknown): Promise<void>;
}

/**
 * Model with associations support
 */
export interface KythiaModelWithAssociations<M extends Model = Model>
	extends KythiaModelStatic<M> {
	/**
	 * Define associations with other models
	 */
	associate(models: Record<string, KythiaModelStatic>): void;
}

/**
 * Helper type to infer model attributes from a KythiaModel instance
 */
export type KythiaAttributes<M> = M extends Model<infer A, any> ? A : never;

/**
 * Helper type to infer creation attributes from a KythiaModel instance
 */
export type KythiaCreationAttributes<M> = M extends Model<any, infer C>
	? C
	: never;
