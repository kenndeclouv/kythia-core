/**
 * 🛠️ Internal Discord Helpers
 * @file src/utils/discord.ts
 */

import type { KythiaConfig, DiscordHelpers } from '../types';

interface DiscordHelperDependencies {
	kythiaConfig: KythiaConfig;
}

export default function loadDiscordHelpers({
	kythiaConfig,
}: DiscordHelperDependencies): DiscordHelpers {
	function isOwner(userId: string): boolean {
		let ownerIds: string | string[] | undefined = kythiaConfig?.owner.ids;

		if (typeof ownerIds === 'string') {
			ownerIds = ownerIds.split(',').map((id) => id.trim());
		}

		if (Array.isArray(ownerIds) && ownerIds.includes(String(userId))) {
			return true;
		}

		return String(ownerIds) === String(userId);
	}

	return {
		isOwner,
	};
}
