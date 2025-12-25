import type { Client } from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';

export interface IEventManager {
	initialize(): void;
	client: Client;
	container: KythiaContainer;
	eventHandlers: Map<string, KythiaAugmentedEventHandler[]>;
}

export type KythiaAugmentedEventHandler = (
	manager: IEventManager,
	...args: unknown[]
) => Promise<boolean | undefined> | boolean | undefined;
