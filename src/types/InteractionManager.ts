import type { KythiaClient } from './KythiaClient';
import type { KythiaContainer } from './KythiaContainer';
import type {
	KythiaButtonHandler,
	KythiaModalHandler,
	KythiaSelectMenuHandler,
	KythiaAutocompleteHandler,
} from './AddonManager';

import type { IMiddlewareManager } from './MiddlewareManager';
import type { KythiaConfig } from './KythiaConfig';

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
	models: any;
	helpers: any;
	logger: any;
	t: any;
	middlewareManager: IMiddlewareManager;

	isOwner: (userId: string) => boolean;

	initialize(): void;
}
