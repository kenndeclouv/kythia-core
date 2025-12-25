import type { KythiaClient } from './KythiaClient';
import type {
	KythiaContainer,
	KythiaHelpersCollection,
	KythiaModelsCollection,
} from './KythiaContainer';
import type {
	KythiaButtonHandler,
	KythiaModalHandler,
	KythiaSelectMenuHandler,
	KythiaAutocompleteHandler,
} from './AddonManager';

import type { IMiddlewareManager } from './MiddlewareManager';
import type { KythiaConfig } from './KythiaConfig';
import type { KythiaLogger } from './KythiaLogger';
import type { TranslateFunction } from './TranslatorManager';

export interface InteractionManagerHandlers {
	buttonHandlers: Map<string, KythiaButtonHandler>;
	modalHandlers: Map<string, KythiaModalHandler>;
	selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
	autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
	commandCategoryMap: Map<string, string>;
	categoryToFeatureMap: Map<string, string>;
}

export interface IInteractionManager {
	client: KythiaClient;
	container: KythiaContainer;

	buttonHandlers: Map<string, KythiaButtonHandler>;
	modalHandlers: Map<string, KythiaModalHandler>;
	selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
	autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
	commandCategoryMap: Map<string, string>;
	categoryToFeatureMap: Map<string, string>;

	kythiaConfig: KythiaConfig;
	models: KythiaModelsCollection;
	helpers: KythiaHelpersCollection;
	logger: KythiaLogger;
	t: TranslateFunction;
	middlewareManager?: IMiddlewareManager;

	isOwner: (userId: string) => boolean;

	initialize(): void;
}
