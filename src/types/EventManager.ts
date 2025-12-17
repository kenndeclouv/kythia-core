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
	...args: any[]
) => Promise<boolean | undefined | undefined> | boolean | undefined | undefined;
