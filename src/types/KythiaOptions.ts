import type { Sequelize } from 'sequelize';
import type { KythiaConfig } from './KythiaConfig';
import type { KythiaLogger } from './KythiaLogger';
import type Redis from 'ioredis';
import type {
	KythiaModelsCollection,
	KythiaHelpersCollection,
} from './KythiaContainer';

export interface KythiaOptions {
	config: KythiaConfig;
	logger?: KythiaLogger;
	redis?: Redis;
	sequelize?: Sequelize;
	models?: KythiaModelsCollection;
	helpers?: KythiaHelpersCollection;
	utils?: Record<string, unknown>;
	appRoot?: string;
}
