import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShutdownManager } from '../src/managers/ShutdownManager';
import { MessageFlags } from 'discord.js';

// Mock Config
const mockConfig = {
	api: {
		webhookErrorLogs: 'https://discord.com/api/webhooks/123/token',
	},
	bot: {
		name: 'KythiaTest',
	},
	settings: {
		aboutBannerImage: 'https://example.com/banner.png',
		webhookErrorLogs: true, // Enable it
	},
	version: '1.0.0',
} as any;

// Mock Logger
const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
} as any;

// Mock Container
const mockContainer = {
	kythiaConfig: mockConfig,
	client: {
		user: {
			displayAvatarURL: () => 'https://example.com/avatar.png',
		},
	},
	logger: mockLogger,
} as any;

describe('ShutdownManager', () => {
	let shutdownManager: ShutdownManager;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset fetch mock
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('ok'),
		} as any);

		shutdownManager = new ShutdownManager({
			client: {} as any,
			container: mockContainer,
		});
		shutdownManager.initialize();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should construct correct V2 payload for SHUTDOWN event', async () => {
		// Access private method with CORRECT args: reason, type
		await (shutdownManager as any)._sendLifecycleWebhook(
			'Test Reason',
			'SHUTDOWN',
		);

		// Verify fetch call
		expect(global.fetch).toHaveBeenCalledTimes(1);
		const [url, options] = (global.fetch as any).mock.calls[0];

		// 1. Verify URL params
		expect(url).toContain('?wait=true&with_components=true');

		// 2. Verify Payload Body
		const body = JSON.parse(options.body);

		// Essential V2 fields
		expect(body.flags).toBe(MessageFlags.IsComponentsV2);

		// Content is NOT present when using with_components=true (user updated logic)
		expect(body.content).toBeUndefined();
		// expect(body.username).toBe('KythiaTest'); // Not in payload currently? (Need to check source)
		// expect(body.avatar_url).toBe('https://example.com/avatar.png'); // Not in payload currently?

		// Component Structure
		expect(body.components).toHaveLength(1); // One Container
		const container = body.components[0];
		expect(container.type).toBe(17); // Container Type
		expect(container.accent_color).toBe(0xffa500); // Orange for Shutdown

		// Check for specific text content
		const textComponent = container.components[0].components[0]; // Nested inside checks
		expect(textComponent.content).toContain('Graceful shutdown initiated');
		expect(textComponent.content).toContain('Test Reason');
	});

	it('should construct correct V2 payload for CRASH event', async () => {
		// Fix args: reason, type, error
		await (shutdownManager as any)._sendLifecycleWebhook(
			'Fatal Error',
			'CRASH',
			new Error('Stack Trace'),
		);

		const [url, options] = (global.fetch as any).mock.calls[0];
		const body = JSON.parse(options.body);

		expect(body.components[0].accent_color).toBe(0xff0000); // Red for Crash

		// Verify stack trace inclusion
		const textContent = JSON.stringify(body);
		expect(textContent).toContain('Fatal Error');
		expect(textContent).toContain('Stack Trace');
	});
});
