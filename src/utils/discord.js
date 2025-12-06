/**
 * 🛠️ Internal Discord Helpers
 * @param {Object} container - Dependency Container (config, models, etc)
 */
module.exports = (container) => {
	const { kythiaConfig, models } = container;
	// Ambil model dari container, bukan require manual biar konsisten
	const { KythiaUser, KythiaTeam } = models;

	// Helper: Cek Owner
	function isOwner(userId) {
		// Ambil dari config container, bukan global variable
		let ownerIds = kythiaConfig.owner.ids;

		if (typeof ownerIds === 'string') {
			ownerIds = ownerIds.split(',').map((id) => id.trim());
		}
		if (Array.isArray(ownerIds) && ownerIds.includes(String(userId))) {
			return true;
		}
		return false;
	}

	// Helper: Cek Team
	async function isTeam(user) {
		if (isOwner(user.id)) return true;
		// Pastikan model ada sebelum dipanggil
		if (!KythiaTeam) return false;

		const teams = await KythiaTeam.getCache({ userId: user.id });
		return !!teams?.length;
	}

	// Helper: Cek Premium
	async function isPremium(userId) {
		if (isOwner(userId)) return true;
		if (!KythiaUser) return false;

		const premium = await KythiaUser.getCache({ userId: userId });
		if (!premium) return false;
		if (premium.premiumExpiresAt && new Date() > premium.premiumExpiresAt)
			return false;
		return premium.isPremium;
	}

	// Helper: Cek Vote
	async function isVoterActive(userId) {
		if (!KythiaUser) return false;

		const user = await KythiaUser.getCache({ userId });
		if (!user) return false;
		if (!user.isVoted || !user.voteExpiresAt || new Date() > user.voteExpiresAt)
			return false;
		return true;
	}

	// Return semua function sebagai object
	return {
		isOwner,
		isTeam,
		isPremium,
		isVoterActive,
	};
};
