import { describe, it, expect, vi, beforeEach } from 'vitest';
import BaseCommand from '../src/structures/BaseCommand';

describe('BaseCommand', () => {
	let mockContainer: any;

	beforeEach(() => {
		mockContainer = {
			client: {},
			logger: {},
			t: {},
			models: {},
			kythiaConfig: {},
			helpers: {},
		};
	});

	it('should initialize with container dependencies', () => {
		const cmd = new BaseCommand(mockContainer);

		expect(cmd.container).toBe(mockContainer);
		expect(cmd.client).toBe(mockContainer.client);
		expect(cmd.logger).toBe(mockContainer.logger);
	});

	it('should throw if container is missing', () => {
		expect(() => new BaseCommand(null as any)).toThrow('Container is required');
	});

	it('should have default data properties', () => {
		const cmd = new BaseCommand(mockContainer);
		expect(cmd.data.name).toBe('base-command');
		expect(cmd.data.cooldown).toBe(10);
	});

	it('should throw on execute if not implemented', async () => {
		const cmd = new BaseCommand(mockContainer);
		const interaction = { options: {} } as any;

		await expect(cmd.execute(interaction)).rejects.toThrow(
			'Execute method not implemented',
		);
	});

	it('should not throw if handled by subcommand logic', async () => {
		const cmd = new BaseCommand(mockContainer);
		cmd.logger.warn = vi.fn();

		const interaction = {
			options: {
				getSubcommand: () => 'sub',
			},
		} as any;

		await cmd.execute(interaction);
		expect(cmd.logger.warn).toHaveBeenCalledWith(
			expect.stringContaining('should be handled by subcommand'),
		);
	});
});
