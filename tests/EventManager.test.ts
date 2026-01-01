import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventManager from '../src/managers/EventManager';

describe('EventManager', () => {
	let eventManager: EventManager;
	let mockClient: any;
	let mockContainer: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock Client with EventEmitter capability
		const listeners = new Map<string, Function>();
		mockClient = {
			on: vi.fn((event, callback) => listeners.set(event, callback)),
			emit: (event: string, ...args: any[]) => {
				const cb = listeners.get(event);
				if (cb) cb(...args);
			},
		};

		mockContainer = {
			logger: { info: vi.fn(), error: vi.fn() },
			telemetry: { report: vi.fn() },
		};

		eventManager = new EventManager({
			client: mockClient,
			container: mockContainer,
			eventHandlers: new Map(),
		});
	});

	it('should initialize and bind events to client', () => {
		const handler = vi.fn();
		eventManager.addEventHandler('ready', handler);

		eventManager.initialize();

		expect(mockClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
	});

	it('should execute handlers when event is emitted', async () => {
		const handler = vi.fn();
		eventManager.addEventHandler('messageCreate', handler);
		eventManager.initialize();

		// Simulate Event
		await mockClient.emit('messageCreate', 'payload');

		expect(handler).toHaveBeenCalled();
		expect(handler).toHaveBeenCalledWith(eventManager, 'payload');
	});

	it('should allow adding handlers dynamically', () => {
		const handler = vi.fn();
		eventManager.addEventHandler('test', handler);
		expect(eventManager.getEventHandlers('test')).toContain(handler);
	});

	it('should allow removing handlers', () => {
		const handler = vi.fn();
		eventManager.addEventHandler('test', handler);
		eventManager.removeEventHandler('test', handler);
		expect(eventManager.getEventHandlers('test')).not.toContain(handler);
	});

	it('should stop propagation if handler returns true', async () => {
		const handler1 = vi.fn().mockResolvedValue(true); // Stop
		const handler2 = vi.fn();

		eventManager.addEventHandler('test', handler1);
		eventManager.addEventHandler('test', handler2);
		eventManager.initialize();

		await mockClient.emit('test');

		expect(handler1).toHaveBeenCalled();
		expect(handler2).not.toHaveBeenCalled();
	});

	it('should handle errors in handlers gracefully', async () => {
		const handler = vi.fn().mockRejectedValue(new Error('Fail'));
		eventManager.addEventHandler('errorTest', handler);
		eventManager.initialize();

		await mockClient.emit('errorTest');

		expect(mockContainer.logger.error).toHaveBeenCalled();
		expect(mockContainer.telemetry.report).toHaveBeenCalled();
	});
});
