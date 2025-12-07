/** biome-ignore-all lint/suspicious/noExplicitAny: Using any for Model dynamicly load from kythia bot */
import type { Interaction } from 'discord.js';
import type { Sequelize, Model, ModelStatic } from 'sequelize';
import type { KythiaConfig } from './KythiaConfig';
import type { KythiaClient } from './KythiaClient';
import type { KythiaLogger } from './KythiaLogger';

import type { IAddonManager } from './AddonManager';
import type { IInteractionManager } from './InteractionManager';
import type { IShutdownManager } from './ShutdownManager';
import type { IEventManager } from './EventManager';
import type { IMiddlewareManager } from './MiddlewareManager';
import type { ITranslatorManager } from './TranslatorManager';

import type Redis from 'ioredis';

import type { DiscordHelpers } from './DiscordHelpers';

export type AnySequelizeModel = ModelStatic<Model<any, any>>;

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

	redis?: Redis;

	t: (
		interaction: Interaction | null,
		key: string,
		variables?: TranslationVars,
		forceLang?: string | null,
	) => Promise<string>;

	translator?: ITranslatorManager;
	middlewareManager?: IMiddlewareManager;
	interactionManager?: IInteractionManager;
	addonManager?: IAddonManager;
	eventManager?: IEventManager;
	shutdownManager?: IShutdownManager;

	models: KythiaModelsCollection;
	helpers: KythiaHelpersCollection;
	appRoot: string;
}
