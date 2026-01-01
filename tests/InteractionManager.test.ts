import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InteractionManager } from '../src/managers/InteractionManager';
import { Collection, MessageFlags } from 'discord.js';

// Mocks
const mockConfig = {
	api: { webhookErrorLogs: 'https://discord.cloud/webhook' },
	bot: { devGuildId: '123456789', mainGuildId: '123456789' },
	settings: { webhookErrorLogs: true, supportServer: 'https://gg.gg' },
	owner: { ids: '00000000' },
} as any;

const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
} as any;

const mockMetrics = {
	commandDuration: { startTimer: vi.fn(() => vi.fn()) },
	commandsTotal: { inc: vi.fn() },
} as any;

const mockTelemetry = {
	report: vi.fn(),
	isTokenValid: vi.fn(() => true),
} as any;

const mockMiddleware = {
	handle: vi.fn().mockResolvedValue(true),
} as any;

describe('InteractionManager', () => {
	let interactionManager: InteractionManager;
	let mockClient: any;
	let mockContainer: any;
	let mockCommand: any;

	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('ok'),
		} as any);

		mockCommand = {
			name: 'test',
			execute: vi.fn((_i, _c) => {}),
			mainGuildOnly: false,
		};

		mockClient = {
			commands: new Map(),
			on: vi.fn(),
			restartNoticeCooldowns: new Collection(),
			user: { username: 'KythiaBot', displayAvatarURL: () => 'avatar.png' },
		};
		mockClient.commands.set('test', mockCommand);

		mockContainer = {
			kythiaConfig: mockConfig,
			logger: mockLogger,
			helpers: { discord: { isOwner: vi.fn(() => false) } },
			models: {},
			t: vi.fn((_, key) => key),
			middlewareManager: mockMiddleware,
			metrics: mockMetrics,
			telemetry: mockTelemetry,
			_degraded: false,
		};

		interactionManager = new InteractionManager({
			client: mockClient,
			container: mockContainer,
			handlers: {
				buttonHandlers: new Map(),
				modalHandlers: new Map(),
				selectMenuHandlers: new Map(),
				autocompleteHandlers: new Map(),
				commandCategoryMap: new Map(),
				categoryToFeatureMap: new Map(),
			},
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should route basic slash command to execute', async () => {
		const interaction = {
			isChatInputCommand: () => true,
			isRepliable: () => true,
			commandName: 'test',
			user: { id: '999', tag: 'User#1234' },
			options: {
				getSubcommandGroup: () => null,
				getSubcommand: () => null,
			},
			reply: vi.fn(),
		} as any;

		await (interactionManager as any)._handleChatInputCommand(interaction);

		expect(mockCommand.execute).toHaveBeenCalledWith(
			interaction,
			expect.anything(),
		);
		expect(mockMetrics.commandsTotal.inc).toHaveBeenCalledWith({
			command_name: 'test',
			status: 'success',
		});
	});

	it('should respect middleware rejection', async () => {
		mockMiddleware.handle.mockResolvedValueOnce(false); // deny

		const interaction = {
			isChatInputCommand: () => true,
			isRepliable: () => true,
			commandName: 'test',
			user: { id: '999', tag: 'User#1234' },
			options: { getSubcommandGroup: () => null, getSubcommand: () => null },
			reply: vi.fn(),
		} as any;

		await (interactionManager as any)._handleChatInputCommand(interaction);

		expect(mockCommand.execute).not.toHaveBeenCalled();
	});

	it('should send V2 Error Webhook on crash', async () => {
		const error = new Error('Test Crash');
		const interaction = {
			isChatInputCommand: () => true,
			isCommand: () => true,
			isRepliable: () => true,
			replied: false,
			deferred: false,
			commandName: 'test',
			user: {
				id: '999',
				tag: 'User#1234',
				username: 'User',
				displayAvatarURL: () => 'https://example.com/avatar.png',
			},
			reply: vi.fn(),
			followUp: vi.fn(),
		} as any;

		await (interactionManager as any)._handleInteractionError(
			interaction,
			error,
		);

		// Verify Webhook Fetch
		expect(global.fetch).toHaveBeenCalled();
		const [url, options] = (global.fetch as any).mock.calls[0];

		expect(url).toContain('?wait=true&with_components=true');

		const body = JSON.parse(options.body);
		expect(body.flags).toBe(MessageFlags.IsComponentsV2);

		// Check for error details in text
		const textContent = JSON.stringify(body);
		expect(textContent).toContain('Test Crash');
		expect(textContent).toContain('User#1234');
	});

	it('should handle subcommand routing correctly', async () => {
		mockClient.commands.set('config set value', mockCommand);

		const interaction = {
			isChatInputCommand: () => true,
			isRepliable: () => true,
			commandName: 'config',
			user: { id: '999' },
			options: {
				getSubcommandGroup: () => 'set',
				getSubcommand: () => 'value',
			},
			reply: vi.fn(),
		} as any;

		await (interactionManager as any)._handleChatInputCommand(interaction);

		expect(mockCommand.execute).toHaveBeenCalled();
	});
});
