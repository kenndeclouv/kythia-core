import { describe, it, expect, vi, beforeEach } from 'vitest';
import MiddlewareManager from '../src/managers/MiddlewareManager';

// Mock Dependencies
const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
} as any;

const mockContainer = {
	logger: mockLogger,
	telemetry: { report: vi.fn() },
	appRoot: '/test/root',
} as any;

describe('MiddlewareManager', () => {
	let middlewareManager: MiddlewareManager;

	beforeEach(() => {
		vi.clearAllMocks();
		middlewareManager = new MiddlewareManager({ container: mockContainer });
	});

	it('should allow execution if all middlewares return true', async () => {
		// Manually inject middlewares
		middlewareManager.middlewares = [
			{ name: 'm1', priority: 1, execute: vi.fn().mockResolvedValue(true) },
			{ name: 'm2', priority: 2, execute: vi.fn().mockResolvedValue(true) },
		];

		const interaction = {} as any;
		const command = {} as any;

		const result = await middlewareManager.handle(interaction, command);

		expect(result).toBe(true);
		expect(middlewareManager.middlewares[0].execute).toHaveBeenCalled();
		expect(middlewareManager.middlewares[1].execute).toHaveBeenCalled();
	});

	it('should halt execution if a middleware returns false', async () => {
		const m1 = { name: 'm1', execute: vi.fn().mockResolvedValue(true) };
		const m2 = { name: 'm2', execute: vi.fn().mockResolvedValue(false) }; // Stops here
		const m3 = { name: 'm3', execute: vi.fn().mockResolvedValue(true) };

		middlewareManager.middlewares = [m1, m2, m3];

		const result = await middlewareManager.handle({} as any, {} as any);

		expect(result).toBe(false);
		expect(m1.execute).toHaveBeenCalled();
		expect(m2.execute).toHaveBeenCalled();
		expect(m3.execute).not.toHaveBeenCalled(); // Should not run
	});

	it('should halt execution and report error if middleware throws', async () => {
		const m1 = {
			name: 'm1',
			execute: vi.fn().mockRejectedValue(new Error('Fail')),
		};
		middlewareManager.middlewares = [m1];

		const result = await middlewareManager.handle(
			{} as any,
			{ name: 'test' } as any,
		);

		expect(result).toBe(false);
		expect(mockContainer.telemetry.report).toHaveBeenCalled();
		expect(mockLogger.error).toHaveBeenCalled();
	});
});
