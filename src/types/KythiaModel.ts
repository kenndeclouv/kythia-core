import type { KythiaConfig } from './KythiaConfig';
import type { Redis } from 'ioredis';
import type { KythiaLogger } from './KythiaLogger';

export interface CacheStats {
	redisHits: number;
	mapHits: number;
	misses: number;
	sets: number;
	clears: number;
	errors: number;
}

export interface RedisOptionsObject {
	urls?: string[];
	shard?: boolean;
	[key: string]: unknown;
}

export type RedisOptions =
	| string
	| string[]
	| RedisOptionsObject
	| RedisOptionsObject[];

export interface KythiaModelDependencies {
	logger: KythiaLogger;
	config: KythiaConfig;
	redis?: Redis;
	redisOptions?: RedisOptions;
}

export interface CacheEntry<T = unknown> {
	hit: boolean;
	data: T | null | undefined;
}

export interface KythiaModelStructure {
	attributes?: Record<string, unknown>;
	options?: Record<string, unknown>;
}
