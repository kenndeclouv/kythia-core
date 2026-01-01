import type { Sequelize, Model, ModelStatic } from 'sequelize';
import type { KythiaConfig } from './KythiaConfig';
import type { KythiaClient } from './KythiaClient';
import type { KythiaLogger } from './KythiaLogger';

import type { IAddonManager } from './AddonManager';
import type { IInteractionManager } from './InteractionManager';
import type { IShutdownManager } from './ShutdownManager';
import type { IEventManager } from './EventManager';
import type { IMiddlewareManager } from './MiddlewareManager';
import type {
	ITranslatorManager,
	TranslateFunction,
} from './TranslatorManager';

import type Redis from 'ioredis';

import type { DiscordHelpers } from './DiscordHelpers';
import type { TelemetryManager } from '../managers/TelemetryManager';
import type { MetricsManager } from '../managers/MetricsManager';

export type AnySequelizeModel = ModelStatic<
	Model<Record<string, unknown>, Record<string, unknown>>
>;

export type KythiaModelsCollection = Record<string, AnySequelizeModel>;

export interface KythiaHelpersCollection {
	discord: DiscordHelpers;
	[key: string]: unknown;
}

export type TranslationVars = Record<string, string | number | boolean>;

export interface KythiaContainer {
	client: KythiaClient;
	sequelize?: Sequelize;
	kythiaConfig: KythiaConfig;
	logger: KythiaLogger;
	telemetry?: TelemetryManager;
	metrics?: MetricsManager;

	redis?: Redis;

	t: TranslateFunction;

	translator?: ITranslatorManager;
	middlewareManager?: IMiddlewareManager;
	interactionManager?: IInteractionManager;
	addonManager?: IAddonManager;
	eventManager?: IEventManager;
	shutdownManager?: IShutdownManager;

	models: KythiaModelsCollection;
	helpers: KythiaHelpersCollection;
	appRoot: string;

	// Internal flag for degraded mode (license check bypass detection)
	_degraded?: boolean;
}
