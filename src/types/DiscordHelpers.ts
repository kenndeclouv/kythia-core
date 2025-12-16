export interface DiscordHelpers {
	isOwner(userId: string): boolean;
	isTeam(userId: string): Promise<boolean>;
	isPremium(userId: string): Promise<boolean>;
	isVoterActive(userId: string): Promise<boolean>;
}
