import type { KythiaConfig } from './KythiaConfig';
import type { Redis } from 'ioredis';

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
	[key: string]: any;
}

export type RedisOptions =
	| string
	| string[]
	| RedisOptionsObject
	| RedisOptionsObject[];

export interface KythiaModelDependencies {
	logger: any;
	config: KythiaConfig;
	redis?: Redis;
	redisOptions?: RedisOptions;
}

export interface CacheEntry<T = any> {
	hit: boolean;
	data: T | null | undefined;
}

export interface KythiaModelStructure {
	attributes?: Record<string, any>;
	options?: Record<string, any>;
}
