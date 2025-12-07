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

	// Handlers
	buttonHandlers: Map<string, KythiaButtonHandler>;
	modalHandlers: Map<string, KythiaModalHandler>;
	selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
	autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
	commandCategoryMap: Map<string, string>;
	categoryToFeatureMap: Map<string, string>;

	// Dependencies
	kythiaConfig: KythiaConfig;
	models: any;
	helpers: any;
	logger: any;
	t: any;
	middlewareManager: IMiddlewareManager;

	// Models
	ServerSetting: any;
	KythiaVoter: any;

	// Helpers
	isTeam: (userId: string) => boolean;
	isOwner: (userId: string) => boolean;

	initialize(): void;
}
