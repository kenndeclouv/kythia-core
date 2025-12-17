import type { Dialect } from 'sequelize';
import type { ActivityType } from 'discord.js';
import type { RedisOptions as IORedisOptions } from 'ioredis';

export interface KythiaConfigOwner {
	ids: string;
	names: string;
}

export interface KythiaConfigSentry {
	dsn?: string;
}

export interface KythiaConfigBot {
	name: string;
	token: string;
	clientId: string;
	clientSecret?: string;
	totalShards: number | 'auto';
	mainGuildId: string;
	devGuildId?: string;
	color: string;
	prefixes: string[];
	status: 'online' | 'idle' | 'dnd' | 'invisible';
	activityType: ActivityType;
	activity: string;
	globalCommandCooldown: number;
	language: string;
	locale: string;
	timezone: string;
}

export type KythiaRedisConfig = string | (IORedisOptions & { shard?: boolean });

export interface KythiaConfigDb {
	driver: Dialect;
	host?: string;
	port?: number;
	name: string;
	user?: string;
	pass?: string;
	storagePath?: string;
	socketPath?: string;
	dialectOptions?: object;
	timezone: string;
	redis?: KythiaRedisConfig;
	redisCacheVersion: string;
	useRedis?: boolean;
}

export interface BaseAddonConfig {
	active: boolean;
	[key: string]: unknown;
}

export interface KythiaConfigAddonsAll extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsAdventure extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsAI extends BaseAddonConfig {
	active: boolean;
	model: string;
	geminiApiKeys?: string;
	getMessageHistoryLength: number;
	perMinuteAiLimit: number;
	safeCommands: string[];
	additionalCommandKeywords: string[];
	personaPrompt: string;
	ownerInteractionPrompt: string;
	dailyGreeter: boolean;
	dailyGreeterSchedule: string;
	dailyGreeterPrompt: string;
	ownerBypassFilter: boolean;
}

export interface KythiaConfigAddonsChecklist extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsCore extends BaseAddonConfig {
	active: boolean;
	exchangerateApi?: string;
}

export interface KythiaConfigAddonsEconomy extends BaseAddonConfig {
	active: boolean;
	dailyCooldown: number;
	begCooldown: number;
	lootboxCooldown: number;
	workCooldown: number;
	robCooldown: number;
	hackCooldown: number;
}

export interface KythiaConfigAddonsDashboard extends BaseAddonConfig {
	active: boolean;
	url: string;
	port: number;
	sessionSecret?: string;
}

export interface KythiaConfigAddonsFunWordle {
	words: string[];
}

export interface KythiaConfigAddonsFun extends BaseAddonConfig {
	active: boolean;
	wordle: KythiaConfigAddonsFunWordle;
}

export interface KythiaConfigAddonsGiveaway extends BaseAddonConfig {
	active: boolean;
	checkInterval: number;
}

export interface KythiaConfigAddonsGlobalchat extends BaseAddonConfig {
	active: boolean;
	apiUrl: string;
	healthCheckSchedule: string;
	healthCheckDelay: number;
	apiKey?: string;
}

export interface KythiaConfigAddonsInvite extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsLeveling extends BaseAddonConfig {
	active: boolean;
	backgroundUrl: string;
}

export interface KythiaConfigAddonsMinecraft extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsMusicLavalink {
	hosts: string;
	ports: string;
	passwords: string;
	secures: string;
}

export interface KythiaConfigAddonsMusicSpotify {
	clientId?: string;
	clientSecret?: string;
}

export interface KythiaConfigAddonsMusicAudd {
	apiKey?: string;
}

export interface KythiaConfigAddonsMusic extends BaseAddonConfig {
	active: boolean;
	defaultPlatform: string;
	useAI: boolean;
	playlistLimit: number;
	autocompleteLimit: number;
	suggestionLimit: number;
	lavalink: KythiaConfigAddonsMusicLavalink;
	spotify: KythiaConfigAddonsMusicSpotify;
	audd: KythiaConfigAddonsMusicAudd;
	artworkUrlStyle: 'thumbnail' | 'banner';
}

export interface KythiaConfigAddonsNsfw extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsNuke extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsPet extends BaseAddonConfig {
	active: boolean;
	useCooldown: number;
	gachaCooldown: number;
}

export interface KythiaConfigAddonsProCloudflare {
	token?: string;
	zoneId?: string;
	domain?: string;
}

export interface KythiaConfigAddonsPro extends BaseAddonConfig {
	active: boolean;
	cloudflare: KythiaConfigAddonsProCloudflare;
	maxSubdomains: number;
}

export interface KythiaConfigAddonsPterodactyl extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsServer extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsStore extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsStreak extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsSuggestion extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsTestimony extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsTicket extends BaseAddonConfig {
	active: boolean;
}

export interface KythiaConfigAddonsQuest extends BaseAddonConfig {
	active: boolean;
	apiUrls: string;
}

export interface KythiaConfigAddons {
	all?: KythiaConfigAddonsAll;
	adventure?: KythiaConfigAddonsAdventure;
	ai?: KythiaConfigAddonsAI;
	checklist?: KythiaConfigAddonsChecklist;
	core?: KythiaConfigAddonsCore;
	economy?: KythiaConfigAddonsEconomy;
	dashboard?: KythiaConfigAddonsDashboard;
	fun?: KythiaConfigAddonsFun;
	giveaway?: KythiaConfigAddonsGiveaway;
	globalchat?: KythiaConfigAddonsGlobalchat;
	invite?: KythiaConfigAddonsInvite;
	leveling?: KythiaConfigAddonsLeveling;
	minecraft?: KythiaConfigAddonsMinecraft;
	music?: KythiaConfigAddonsMusic;
	nsfw?: KythiaConfigAddonsNsfw;
	nuke?: KythiaConfigAddonsNuke;
	pet?: KythiaConfigAddonsPet;
	pro?: KythiaConfigAddonsPro;
	pterodactyl?: KythiaConfigAddonsPterodactyl;
	server?: KythiaConfigAddonsServer;
	store?: KythiaConfigAddonsStore;
	streak?: KythiaConfigAddonsStreak;
	suggestion?: KythiaConfigAddonsSuggestion;
	testimony?: KythiaConfigAddonsTestimony;
	ticket?: KythiaConfigAddonsTicket;
	quest?: KythiaConfigAddonsQuest;
	[key: string]: BaseAddonConfig | undefined;
}

export interface KythiaConfigApiTopgg {
	authToken?: string;
	apiKey?: string;
}

export interface KythiaConfigApi {
	webhookGuildInviteLeave?: string;
	webhookErrorLogs?: string;
	topgg: KythiaConfigApiTopgg;
	webhookVoteLogs?: string;
}

export interface KythiaConfigSettings {
	logConsoleFilter: string;
	logFormat: string;
	supportServer: string;
	inviteLink: string;
	ownerWeb: string;
	kythiaWeb: string;
	bannerImage: string;
	voteBannerImage: string;
	gcBannerImage: string;
	statsBannerImage: string;
	helpBannerImage: string;
	aboutBannerImage: string;
	tempvoiceBannerImage: string;
	statusPage: string;
	webhookErrorLogs: boolean;
	webhookGuildInviteLeave: boolean;
	spamThreshold: number;
	duplicateThreshold: number;
	mentionThreshold: number;
	fastTimeWindow: number;
	duplicateTimeWindow: number;
	cacheExpirationTime: number;
	shortMessageThreshold: number;
	punishmentCooldown: number;
	ownerSkipCooldown: boolean;
	antiAllCapsMinLength: number;
	antiAllCapsRatio: number;
	antiEmojiMinTotal: number;
	antiEmojiRatio: number;
	antiZalgoMin: number;
}

export interface KythiaConfigEmojis {
	musicPlayPause: string;
	musicPlay: string;
	musicPause: string;
	musicSkip: string;
	musicStop: string;
	musicLoop: string;
	musicAutoplay: string;
	musicLyrics: string;
	musicQueue: string;
	musicShuffle: string;
	musicFilter: string;
	musicFavorite: string;
	musicBack: string;

	[key: string]: string;
}

export interface KythiaConfig {
	env: 'development' | 'production' | 'test' | 'local';
	licenseKey: string;
	legal: {
		acceptTOS: boolean;
		dataCollection: boolean;
	};
	version: string;
	owner: KythiaConfigOwner;
	sentry: KythiaConfigSentry;
	bot: KythiaConfigBot;
	db: KythiaConfigDb;
	addons: KythiaConfigAddons;
	api: KythiaConfigApi;
	settings: KythiaConfigSettings;
	emojis: KythiaConfigEmojis;
}
