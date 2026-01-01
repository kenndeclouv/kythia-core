import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AddonManager from '../src/managers/AddonManager';

import { Collection } from 'discord.js';

// Mock FS and Cron
vi.mock('node:fs');
vi.mock('node-cron');

describe('AddonManager', () => {
	let addonManager: AddonManager;
	let mockClient: any;
	let mockContainer: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockClient = {
			commands: new Collection(),
			on: vi.fn(),
		};

		mockContainer = {
			logger: {
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				debug: vi.fn(),
			},
			telemetry: { report: vi.fn() },
			appRoot: '/test-root',
			kythiaConfig: { addons: {} },
		};

		addonManager = new AddonManager({
			client: mockClient,
			container: mockContainer,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should register button handlers', () => {
		const handler = vi.fn();
		addonManager.registerButtonHandler('btn-1', handler);

		expect(addonManager.buttonHandlers.has('btn-1')).toBe(true);
		expect(addonManager.buttonHandlers.get('btn-1')).toBe(handler);
	});

	it('should warn on duplicate button handler', () => {
		const handler = vi.fn();
		addonManager.registerButtonHandler('btn-1', handler);
		addonManager.registerButtonHandler('btn-1', handler);

		expect(mockContainer.logger.warn).toHaveBeenCalled();
	});

	it('should register modal handlers', () => {
		const handler = vi.fn();
		addonManager.registerModalHandler('modal-1', handler);
		expect(addonManager.modalHandlers.has('modal-1')).toBe(true);
	});

	it('should register select menu handlers', () => {
		const handler = vi.fn();
		addonManager.registerSelectMenuHandler('select-1', handler);
		expect(addonManager.selectMenuHandlers.has('select-1')).toBe(true);
	});

	it('should register autocomplete handlers', () => {
		const handler = vi.fn();
		addonManager.registerAutocompleteHandler('cmd-1', handler);
		expect(addonManager.autocompleteHandlers.has('cmd-1')).toBe(true);
	});

	it('should register task handlers with interval', () => {
		const handler = vi.fn();
		vi.useFakeTimers();

		addonManager.registerTaskHandler('task-1', handler, 1000);

		expect(addonManager.taskHandlers.has('task-1')).toBe(true);
		expect(mockContainer.logger.info).toHaveBeenCalledWith(
			expect.stringContaining('Registered interval task'),
			expect.any(Object),
		);

		vi.useRealTimers();
	});

	it('should sort addons topologically by dependencies', () => {
		// Access private method via any
		const addons = [
			{ name: 'C', dependencies: ['A', 'B'], priority: 50 },
			{ name: 'A', dependencies: [], priority: 50 },
			{ name: 'B', dependencies: ['A'], priority: 50 },
		];

		const sorted = (addonManager as any).topologicalSort(addons);

		// Expected: A (deps: none) -> B (deps: A) -> C (deps: A, B)
		expect(sorted).toEqual(['A', 'B', 'C']);
	});

	it('should detect circular dependencies', () => {
		const addons = [
			{ name: 'A', dependencies: ['B'], priority: 50 },
			{ name: 'B', dependencies: ['A'], priority: 50 },
		];

		const sorted = (addonManager as any).topologicalSort(addons);

		// Should log error and return partial/empty valid list
		expect(mockContainer.logger.error).toHaveBeenCalledWith(
			expect.stringContaining('Circular dependency'),
			expect.any(Object),
		);
	});
});
