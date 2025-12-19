/**
 * 📦 Addon Manager Types & Interface
 * @file src/types/AddonManager.ts
 */

import type {
	ButtonInteraction,
	ModalSubmitInteraction,
	AnySelectMenuInteraction,
	AutocompleteInteraction,
	APIEmbed,
	Client,
	Collection,
} from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaAugmentedEventHandler } from './EventManager';

/* -------------------------------------------------------------------------- */
/* TYPE ALIASES                               								  */
/* -------------------------------------------------------------------------- */

export type KythiaButtonHandler = (
	interaction: ButtonInteraction,
	container: KythiaContainer,
) => Promise<void> | void;

export type KythiaModalHandler = (
	interaction: ModalSubmitInteraction,
	container: KythiaContainer,
) => Promise<void> | void;

export type KythiaSelectMenuHandler = (
	interaction: AnySelectMenuInteraction,
	container: KythiaContainer,
) => Promise<void> | void;

export type KythiaAutocompleteHandler = (
	interaction: AutocompleteInteraction,
	container: KythiaContainer,
) => Promise<void> | void;

export type KythiaEventHandler = KythiaAugmentedEventHandler;

/* -------------------------------------------------------------------------- */
/* DATA STRUCTURES                                                            */
/* -------------------------------------------------------------------------- */

export interface SubcommandSummary {
	group: string;
	subcommands: string[];
}

export interface CommandRegistrationSummary {
	type: 'single' | 'group';
	name: string;
	folder: string;
	kind?: 'slash' | 'contextMenu' | 'prefix';
	subcommands?: (string | SubcommandSummary)[];
}

export interface KythiaCommandModule {
	data?: any;
	slashCommand?: any;
	contextMenuCommand?: any;
	prefixCommand?: any;
	subcommand?: boolean;
	autocomplete?: KythiaAutocompleteHandler;
	featureFlag?: string;
	disableAutoPrefix?: boolean;
	[key: string]: any;
}

/* -------------------------------------------------------------------------- */
/* MAIN CLASS INTERFACE                           							  */
/* -------------------------------------------------------------------------- */

export interface IAddonManager {
	client: Client;
	container: KythiaContainer;
	logger: any;

	buttonHandlers: Map<string, KythiaButtonHandler>;
	modalHandlers: Map<string, KythiaModalHandler>;
	selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
	autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;

	commandCategoryMap: Map<string, string>;
	categoryToFeatureMap: Map<string, string>;

	embedDrafts: Collection<string, APIEmbed | object>;
	eventHandlers: Map<string, KythiaEventHandler[]>;

	registerButtonHandler(customId: string, handler: KythiaButtonHandler): void;
	registerSelectMenuHandler(
		customIdPrefix: string,
		handler: KythiaSelectMenuHandler,
	): void;
	registerModalHandler(
		customIdPrefix: string,
		handler: KythiaModalHandler,
	): void;
	registerAutocompleteHandler(
		commandName: string,
		handler: KythiaAutocompleteHandler,
	): void;

	registerCommand(
		module: KythiaCommandModule,
		filePath: string,
		commandNamesSet: Set<string>,
		commandDataForDeployment: object[],
		permissionDefaults?: any,
		options?: any,
	): CommandRegistrationSummary | null;

	loadAddons(kythiaInstance: any): Promise<object[]>;

	getHandlers(): {
		buttonHandlers: Map<string, KythiaButtonHandler>;
		modalHandlers: Map<string, KythiaModalHandler>;
		selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
		autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
		commandCategoryMap: Map<string, string>;
		categoryToFeatureMap: Map<string, string>;
		eventHandlers: Map<string, KythiaEventHandler[]>;
	};
}
