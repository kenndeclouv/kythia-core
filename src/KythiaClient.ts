/**
 * 🌐 Optimized Discord Client Factory
 *
 * @file src/client/kythiaClient.js
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.6-beta
 *
 * @description
 * Factory function that initializes the Discord.js Client with high-performance
 * memory management strategies tailored for VPS environments.
 *
 * ✨ Optimization Highlights:
 * -  Rolling Buffer Cache: Limits GuildMember cache to active users (Rolling Window) to save RAM.
 * -  Aggressive Sweepers: Periodically clears stale cache data every hour.
 * -  Voice Priority: Always caches members connected to Voice Channels.
 * -  Zero-Presence: Disables PresenceManager completely for maximum efficiency.
 */

import { Client, GatewayIntentBits, Partials, Options } from 'discord.js';
import type { KythiaClient as IKythiaClient } from './types';

export default function kythiaClient(): IKythiaClient {
	const client = new Client({
		waitGuildTimeout: 60000,
		closeTimeout: 60000,
		rest: {
			timeout: 60000,
			retries: 20,
		},
		ws: {
			large_threshold: 250,
		},
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.MessageContent,
			GatewayIntentBits.GuildMembers,
			GatewayIntentBits.GuildModeration,
			GatewayIntentBits.GuildInvites,
			GatewayIntentBits.GuildVoiceStates,
			GatewayIntentBits.AutoModerationExecution,
			GatewayIntentBits.DirectMessages,
			GatewayIntentBits.DirectMessageReactions,
			GatewayIntentBits.DirectMessageTyping,
			GatewayIntentBits.GuildExpressions,
		],

		partials: [
			Partials.Message,
			Partials.Channel,
			Partials.Reaction,
			Partials.User,
			Partials.GuildMember,
		],

		makeCache: Options.cacheWithLimits({
			PresenceManager: 0,

			ThreadManager: {
				maxSize: 25,
			},

			GuildMemberManager: {
				maxSize: 2000,
				keepOverLimit: (member) =>
					(member.client.user && member.id === member.client.user.id) ||
					(member.guild && member.id === member.guild.ownerId) ||
					(member.voice && member.voice.channelId !== null) ||
					member.roles.cache.size > 5,
			},

			UserManager: {
				maxSize: 20000,
				keepOverLimit: (user) => user.id === user.client.user.id,
			},
		}),

		sweepers: {
			...Options.DefaultSweeperSettings,
			messages: {
				interval: 3600,
				lifetime: 1800,
			},
			threads: {
				interval: 3600,
				lifetime: 1800,
			},

			users: {
				interval: 3600,

				filter: () => (user) => {
					if (user.bot) return false;
					if (user.id === user.client.user.id) return false;
					return true;
				},
			},
		},
	});

	return client as unknown as IKythiaClient;
}
