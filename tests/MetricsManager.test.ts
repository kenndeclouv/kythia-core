import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsManager } from '@managers/MetricsManager';
import { Registry } from 'prom-client';

// Mock Logger
const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
} as any;

describe('MetricsManager', () => {
	let metricsManager: MetricsManager;

	beforeEach(() => {
		// Clear registry between tests to avoid duplicate metric errors
		const registry = new Registry();
		registry.clear();

		metricsManager = new MetricsManager({ logger: mockLogger });
	});

	it('should initialize with default metrics', async () => {
		const metrics = await metricsManager.getMetrics();

		// Check for default node metrics
		expect(metrics).toContain('process_cpu_user_seconds_total');
		expect(metrics).toContain('nodejs_version_info');

		// Check for custom metrics
		expect(metrics).toContain('kythia_commands_total');
		expect(metrics).toContain('kythia_command_duration_seconds');
	});

	it('should increment command counter', async () => {
		metricsManager.commandsTotal.inc({
			command_name: 'ping',
			status: 'success',
		});

		const metrics = await metricsManager.getMetrics();
		expect(metrics).toContain(
			'kythia_commands_total{command_name="ping",status="success"} 1',
		);
	});

	it('should return correct content type', () => {
		const contentType = metricsManager.getContentType();
		expect(contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
	});
});
