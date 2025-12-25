import type { Client, Collection } from 'discord.js';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaCommandModule } from './AddonManager';

/**
 * Custom Client Interface
 * Mewarisi semua fitur Discord.js Client, plus fitur custom Kythia.
 */
export interface KythiaClient extends Client {
	commands: Collection<string, KythiaCommandModule>;
	cooldowns: Collection<string, Collection<string, number>>;
	restartNoticeCooldowns?: Collection<string, number>;

	container: KythiaContainer;
}
