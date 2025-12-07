import type { Client, Collection } from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';

/**
 * Custom Client Interface
 * Mewarisi semua fitur Discord.js Client, plus fitur custom Kythia.
 */
export interface KythiaClient extends Client {
	// Custom Properties
	commands: Collection<string, any>;
	cooldowns: Collection<string, Collection<string, number>>; // Collection<UserId, Timestamp>
	restartNoticeCooldowns?: Collection<string, number>;

	// Dependency Injection Container yang nempel di client
	container: KythiaContainer;
}
