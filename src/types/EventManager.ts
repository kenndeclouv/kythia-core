import type { Client } from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';

// 1. Definisikan Interface minimal yang dibutuhkan handler
export interface IEventManager {
	initialize(): void;
	client: Client;
	container: KythiaContainer;
	eventHandlers: Map<string, KythiaAugmentedEventHandler[]>;
	// Tambah method lain kalau handler butuh akses method manager
}

// 2. Pake Interface itu di sini (Ganti 'any')
export type KythiaAugmentedEventHandler = (
	manager: IEventManager,
	// biome-ignore lint/suspicious/noExplicitAny: discord dynamic event
	...args: any[]
) => Promise<boolean | undefined | void> | boolean | undefined | void;
