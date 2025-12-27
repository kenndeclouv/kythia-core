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
	RESTPostAPIApplicationCommandsJSONBody,
	ApplicationCommandType,
	ChatInputCommandInteraction,
	UserContextMenuCommandInteraction,
	MessageContextMenuCommandInteraction,
} from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaAugmentedEventHandler } from './EventManager';
import type { KythiaLogger } from './KythiaLogger';
import type Kythia from '@src/Kythia';

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

export type KythiaTaskHandler = (
	container: KythiaContainer,
) => Promise<void> | void;

export type KythiaEventHandler = KythiaAugmentedEventHandler;
export type KythiaCommandInteraction =
	| ChatInputCommandInteraction
	| UserContextMenuCommandInteraction
	| MessageContextMenuCommandInteraction;

export type KythiaCommandHandler = (
	interaction: KythiaCommandInteraction,
	container?: KythiaContainer,
) => Promise<void> | void;

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
	data?: RESTPostAPIApplicationCommandsJSONBody;
	slashCommand?: RESTPostAPIApplicationCommandsJSONBody;
	contextMenuCommand?: RESTPostAPIApplicationCommandsJSONBody;
	prefixCommand?: unknown;
	subcommand?: boolean;
	autocomplete?: KythiaAutocompleteHandler;
	execute?: KythiaCommandHandler;
	featureFlag?: string;
	disableAutoPrefix?: boolean;
	mainGuildOnly?: boolean;
	[key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* MAIN CLASS INTERFACE                           							  */
/* -------------------------------------------------------------------------- */

export interface IAddonManager {
	client: Client;
	container: KythiaContainer;
	logger: KythiaLogger;

	buttonHandlers: Map<string, KythiaButtonHandler>;
	modalHandlers: Map<string, KythiaModalHandler>;
	selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
	autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
	taskHandlers: Map<string, KythiaTaskHandler>;

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
	registerTaskHandler(
		taskName: string,
		handler: KythiaTaskHandler,
		schedule: string | number,
	): void;

	registerCommand(
		module: KythiaCommandModule,
		filePath: string,
		commandNamesSet: Set<string>,
		commandDataForDeployment: RESTPostAPIApplicationCommandsJSONBody[],
		permissionDefaults?: unknown,
		options?: unknown,
	): CommandRegistrationSummary | null;

	loadAddons(
		kythiaInstance: Kythia,
	): Promise<RESTPostAPIApplicationCommandsJSONBody[]>;

	getHandlers(): {
		buttonHandlers: Map<string, KythiaButtonHandler>;
		modalHandlers: Map<string, KythiaModalHandler>;
		selectMenuHandlers: Map<string, KythiaSelectMenuHandler>;
		autocompleteHandlers: Map<string, KythiaAutocompleteHandler>;
		taskHandlers: Map<string, KythiaTaskHandler>;
		commandCategoryMap: Map<string, string>;
		categoryToFeatureMap: Map<string, string>;
		eventHandlers: Map<string, KythiaEventHandler[]>;
	};
}

export interface RawCommandData {
	name?: string;
	description?: string;
	permissions?: string | number | bigint | null;
	guildOnly?: boolean;
	type?: ApplicationCommandType;
}
