/**
 * 🛠️ Internal Discord Helpers
 * @file src/utils/discord.ts
 */

import type { KythiaConfig, DiscordHelpers } from '../types';

interface DiscordHelperDependencies {
	kythiaConfig: KythiaConfig;
	models: Record<string, any>;
}

export default function loadDiscordHelpers({
	kythiaConfig,
	models,
}: DiscordHelperDependencies): DiscordHelpers {
	const { KythiaUser, KythiaTeam } = models as any;

	function isOwner(userId: string): boolean {
		let ownerIds: any = kythiaConfig?.owner.ids;

		if (typeof ownerIds === 'string') {
			ownerIds = ownerIds.split(',').map((id) => id.trim());
		}

		if (Array.isArray(ownerIds) && ownerIds.includes(String(userId))) {
			return true;
		}

		return String(ownerIds) === String(userId);
	}

	async function isTeam(userId: string): Promise<boolean> {
		if (isOwner(userId)) return true;
		if (!KythiaTeam) return false;

		const teams = await KythiaTeam.getCache({ userId: userId });
		return !!(teams && teams.length > 0);
	}

	async function isPremium(userId: string): Promise<boolean> {
		if (isOwner(userId)) return true;
		if (!KythiaUser) return false;

		const premium = await KythiaUser.getCache({ userId: userId });
		if (!premium) return false;
		if (premium.premiumExpiresAt && new Date() > premium.premiumExpiresAt)
			return false;
		return premium.isPremium === true;
	}

	async function isVoterActive(userId: string): Promise<boolean> {
		if (!KythiaUser) return false;

		const user = await KythiaUser.getCache({ userId });
		if (!user) return false;
		if (!user.isVoted || !user.voteExpiresAt || new Date() > user.voteExpiresAt)
			return false;
		return true;
	}

	return {
		isOwner,
		isTeam,
		isPremium,
		isVoterActive,
	};
}
