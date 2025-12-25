/**
 * 🌐 Kythia Interaction Factory (The Slash Command Translator)
 *
 * @file src/utils/InteractionFactory.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.6-beta
 *
 * @description
 * A utility class designed to abstract and normalize interactions between the bot
 * and Discord's API. It provides a unified interface for handling both traditional
 * message-based commands and modern Slash Command interactions.
 *
 * ✨ Core Responsibilities:
 * -  Interaction Normalization: Providing a consistent API for different event types.
 * -  Response Management: Simplifying complex reply and edit logic for commands.
 * -  Payload Transformation: Mapping Discord payloads to internal Kythia types.
 * -  Context Abstraction: Decoupling command logic from specific Discord.js structures.
 */

import type { KythiaCommandModule } from '@src/types';

import type {
	Message,
	Client,
	InteractionReplyOptions,
	MessagePayload,
	InteractionEditReplyOptions,
} from 'discord.js';

export const InteractionFactory = {
	create(message: Message, commandName: string, rawArgsString: string) {
		try {
			let replied = false;
			let deferred = false;
			let replyMessage: Message | null = null;
			const followUpMessages: Message[] = [];

			const argsPattern = /([^\s"]+|"[^"]*")+/g;
			const rawTokens =
				rawArgsString.match(argsPattern)?.map((t) => t.replace(/^"|"$/g, '')) ||
				[];

			const client = message.client as Client & {
				commands: Map<string, KythiaCommandModule>;
				container?: any;
			};

			const targetCommand = client.commands?.get(commandName);

			let resolvedGroup: string | null = null;
			let resolvedSubcommand: string | null = null;
			const resolvedOptions: any[] = [];
			const remainingArgs = [...rawTokens];

			let currentSchema: any =
				targetCommand?.slashCommand || targetCommand?.data;

			if (remainingArgs.length > 0 && currentSchema?.options) {
				const potentialGroup = remainingArgs[0].toLowerCase();
				const groupOption = currentSchema.options.find(
					(opt: any) =>
						opt.name === potentialGroup &&
						(opt.type === 2 ||
							opt.constructor.name === 'SlashCommandSubcommandGroupBuilder'),
				);

				if (groupOption) {
					resolvedGroup = potentialGroup;
					remainingArgs.shift();
					currentSchema = groupOption;
				}
			}

			if (remainingArgs.length > 0) {
				const potentialSub = remainingArgs[0].toLowerCase();
				const subOptionsSource = currentSchema?.options || [];

				const subOption = subOptionsSource.find(
					(opt: any) =>
						opt.name === potentialSub &&
						(opt.type === 1 ||
							opt.constructor.name === 'SlashCommandSubcommandBuilder'),
				);

				if (resolvedGroup || subOption) {
					resolvedSubcommand = potentialSub;
					remainingArgs.shift();
					currentSchema = subOption;
				}
			}

			const optionsMap = new Map<string, string>();

			const availableOptions =
				currentSchema?.options?.filter(
					(opt: any) =>
						opt.type !== 1 &&
						opt.type !== 2 &&
						opt.constructor.name !== 'SlashCommandSubcommandBuilder' &&
						opt.constructor.name !== 'SlashCommandSubcommandGroupBuilder',
				) || [];

			let positionalIndex = 0;

			const guessType = (val: string) => {
				if (!Number.isNaN(Number(val))) return 3;
				if (val === 'true' || val === 'false') return 5;
				return 3;
			};

			remainingArgs.forEach((arg) => {
				if (arg.includes(':')) {
					const [key, ...valParts] = arg.split(':');
					const val = valParts.join(':');

					resolvedOptions.push({
						name: key.toLowerCase(),
						value: val,
						type: guessType(val),
					});
					optionsMap.set(key.toLowerCase(), val);
				} else {
					if (positionalIndex < availableOptions.length) {
						const targetOption = availableOptions[positionalIndex];
						resolvedOptions.push({
							name: targetOption.name.toLowerCase(),
							value: arg,
							type: targetOption.type || guessType(arg),
						});
						optionsMap.set(targetOption.name.toLowerCase(), arg);
						positionalIndex++;
					}
				}
			});

			const resolveUser = (val: string | undefined) => {
				if (!val) return null;
				const id = val.replace(/[<@!>]/g, '');
				return message.client.users.cache.get(id) || null;
			};
			const resolveMember = (val: string | undefined) => {
				const user = resolveUser(val);
				return user ? message.guild?.members.cache.get(user.id) || null : null;
			};
			const resolveChannel = (val: string | undefined) => {
				if (!val) return null;
				const id = val.replace(/[<#>]/g, '');
				return message.guild?.channels.cache.get(id) || null;
			};
			const resolveRole = (val: string | undefined) => {
				if (!val) return null;
				const id = val.replace(/[<@&>]/g, '');
				return message.guild?.roles.cache.get(id) || null;
			};

			const interaction: any = {
				type: 2,
				id: message.id,
				applicationId: message.client.application?.id,
				channelId: message.channel.id,
				guildId: message.guild?.id,
				user: message.author,
				member: message.member,
				guild: message.guild,
				channel: message.channel,
				client: message.client,
				commandName: commandName,
				commandType: 1,
				commandId: message.id,
				commandGuildId: message.guild?.id || null,
				get responded() {
					return replied || deferred;
				},

				get deferred() {
					return deferred;
				},
				get replied() {
					return replied;
				},
				set deferred(v) {
					deferred = v;
				},
				set replied(v) {
					replied = v;
				},

				createdTimestamp: message.createdTimestamp,
				get createdAt() {
					return new Date(message.createdTimestamp);
				},

				locale: message.guild?.preferredLocale || 'en-US',
				guildLocale: message.guild?.preferredLocale || 'en-US',

				deferReply: async (opts?: InteractionReplyOptions) => {
					if (replied || deferred) throw new Error('Already replied/deferred');
					deferred = true;
					replyMessage = await (message.channel as any)
						.send({ content: '⏳ ...', ...opts } as any)
						.catch(() => null);
					return replyMessage;
				},
				editReply: async (
					opts: string | MessagePayload | InteractionEditReplyOptions,
				) => {
					const options = typeof opts === 'string' ? { content: opts } : opts;

					if (replyMessage && replyMessage.content === '⏳ ...') {
						await replyMessage.delete().catch(() => {});
						replyMessage = await (message.channel as any)
							.send(options as any)
							.catch(() => null);
					} else if (replyMessage) {
						replyMessage = await replyMessage
							.edit(options as any)
							.catch(() => null);
					} else {
						replyMessage = await (message.channel as any)
							.send(options as any)
							.catch(() => null);
					}
					replied = true;
					return replyMessage;
				},
				reply: async (opts: InteractionReplyOptions) => {
					if (replied || deferred) return interaction.editReply(opts);
					replied = true;
					replyMessage = await (message.channel as any)
						.send(opts as any)
						.catch(() => null);
					return replyMessage;
				},
				followUp: async (opts: InteractionReplyOptions) => {
					const msg = await (message.channel as any)
						.send(opts as any)
						.catch(() => null);
					if (msg) followUpMessages.push(msg);
					return msg;
				},
				deleteReply: async () => {
					if (replyMessage) await replyMessage.delete().catch(() => {});
					replyMessage = null;
				},
				fetchReply: async () => replyMessage,

				options: {
					client: message.client,
					data: resolvedOptions,
					resolved: {
						users: new Map(),
						members: new Map(),
						channels: new Map(),
						roles: new Map(),
						attachments: new Map(),
						messages: new Map(),
					},
					_group: resolvedGroup,
					_subcommand: resolvedSubcommand,
					_hoistedOptions: resolvedOptions,

					get: (name: string, required?: boolean) => {
						const opt = resolvedOptions.find(
							(o) => o.name === name.toLowerCase(),
						);
						if (required && !opt) throw new Error(`Option "${name}" required`);
						return opt || null;
					},
					getSubcommand: (required?: boolean) => {
						if (required && !resolvedSubcommand)
							throw new Error('Subcommand required');
						return resolvedSubcommand;
					},
					getSubcommandGroup: (required?: boolean) => {
						if (required && !resolvedGroup) throw new Error('Group required');
						return resolvedGroup;
					},

					getString: (name: string, required?: boolean) => {
						const v = optionsMap.get(name.toLowerCase());
						if (required && v === undefined)
							throw new Error(`Option "${name}" required`);
						return v || null;
					},
					getBoolean: (name: string, required?: boolean) => {
						const v = optionsMap.get(name.toLowerCase());
						if (required && v === undefined)
							throw new Error(`Option "${name}" required`);
						return v ? v === 'true' || v === '1' : null;
					},
					getInteger: (name: string, required?: boolean) => {
						const v = optionsMap.get(name.toLowerCase());
						if (required && v === undefined)
							throw new Error(`Option "${name}" required`);
						return v ? parseInt(v, 10) : null;
					},
					getNumber: (name: string, required?: boolean) => {
						const v = optionsMap.get(name.toLowerCase());
						if (required && v === undefined)
							throw new Error(`Option "${name}" required`);
						return v ? parseFloat(v) : null;
					},
					getUser: (name: string, required?: boolean) => {
						const u = resolveUser(optionsMap.get(name.toLowerCase()));
						if (required && !u) throw new Error(`Option "${name}" required`);
						return u;
					},
					getMember: (name: string) =>
						resolveMember(optionsMap.get(name.toLowerCase())),
					getChannel: (name: string, required?: boolean) => {
						const c = resolveChannel(optionsMap.get(name.toLowerCase()));
						if (required && !c) throw new Error(`Option "${name}" required`);
						return c;
					},
					getRole: (name: string, required?: boolean) => {
						const r = resolveRole(optionsMap.get(name.toLowerCase()));
						if (required && !r) throw new Error(`Option "${name}" required`);
						return r;
					},
					getAttachment: (name: string, required?: boolean) => {
						const a = message.attachments.first();
						if (required && !a) throw new Error(`Option "${name}" required`);
						return a || null;
					},
					getMentionable: (name: string, required?: boolean) => {
						const v = optionsMap.get(name.toLowerCase());
						const m = resolveUser(v) || resolveRole(v);
						if (required && !m) throw new Error(`Option "${name}" required`);
						return m;
					},
					getMessage: (name: string, required?: boolean) => {
						if (required) throw new Error(`Option "${name}" required`);
						return null;
					},
					getFocused: (getFull?: boolean) => {
						return getFull ? { name: '', value: '', type: 3 } : '';
					},
				},

				isCommand: () => true,
				isChatInputCommand: () => true,
				isContextMenuCommand: () => false,
				isMessageContextMenuCommand: () => false,
				isUserContextMenuCommand: () => false,
				isMessageComponent: () => false,
				isButton: () => false,
				isStringSelectMenu: () => false,
				isSelectMenu: () => false,
				isUserSelectMenu: () => false,
				isRoleSelectMenu: () => false,
				isMentionableSelectMenu: () => false,
				isChannelSelectMenu: () => false,
				isAutocomplete: () => false,
				isModalSubmit: () => false,
				isRepliable: () => true,
				inGuild: () => !!message.guild,
				inCachedGuild: () => !!message.guild,
				inRawGuild: () => false,
				toString: () => `/${commandName} ${rawArgsString}`.trim(),
			};

			let commandKey = commandName;
			if (resolvedGroup)
				commandKey = `${commandKey} ${resolvedGroup} ${resolvedSubcommand}`;
			else if (resolvedSubcommand)
				commandKey = `${commandKey} ${resolvedSubcommand}`;

			client.container?.telemetry?.report(
				'info',
				`Command Executed (Mock): /${commandKey}`,
				{
					user: `${message.author.tag} (${message.author.id})`,
					guild: message.guild
						? `${message.guild.name} (${message.guild.id})`
						: 'DM',
					channel: message.channel.id,
					type: 'Prefix/Mock',
				},
			);

			return interaction;
		} catch (error: any) {
			const client = message.client as any;
			client.container?.logger?.error(
				'Error creating mock interaction:',
				error,
			);
			client.container?.telemetry?.report(
				'error',
				`Mock Interaction Creation Failed: [${commandName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			throw error;
		}
	},
};
