import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryManager } from '../src/managers/TelemetryManager';
import axios from 'axios';

// Mock Axios
vi.mock('axios');

describe('TelemetryManager', () => {
	let telemetry: TelemetryManager;
	const mockLogger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	} as any;

	const mockConfig = {
		bot: { clientId: '123' },
		licenseKey: 'TEST-KEY',
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
		telemetry = new TelemetryManager({
			licenseKey: 'TEST-KEY',
			logger: mockLogger,
			version: '1.0.0',
			config: mockConfig,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should verify status as VALID when server approves', async () => {
		(axios.post as any).mockResolvedValue({
			status: 200,
			data: { valid: true },
		});

		const status = await telemetry.verifyStatus();
		expect(status).toBe('VALID');
		expect(axios.post).toHaveBeenCalledWith(
			expect.stringContaining('verify'),
			expect.objectContaining({ key: 'TEST-KEY' }),
			expect.any(Object),
		);
	});

	it('should verify status as INVALID when server rejects', async () => {
		(axios.post as any).mockResolvedValue({
			status: 200,
			data: { valid: false },
		});

		const status = await telemetry.verifyStatus();
		expect(status).toBe('INVALID');
	});

	it('should generate valid token upon successful verification', async () => {
		(axios.post as any).mockResolvedValue({
			status: 200,
			data: { valid: true },
		});

		const result = await telemetry.verify();
		expect(result).toBe(true);
		expect(telemetry.getToken()).not.toBeNull();
		expect(telemetry.isTokenValid()).toBe(true);
	});

	it('should fail token validation if not verified', () => {
		expect(telemetry.isTokenValid()).toBe(false);
	});

	it('should report logs to queue and flush when full', () => {
		// Mock flush
		const flushSpy = vi.spyOn(telemetry, 'flush').mockResolvedValue();

		// Fill queue
		for (let i = 0; i < 55; i++) {
			telemetry.report('info', `Log ${i}`);
		}

		expect(flushSpy).toHaveBeenCalled();
	});

	it('should handle network error gracefully', async () => {
		(axios.post as any).mockRejectedValue(new Error('Network Error'));

		const status = await telemetry.verifyStatus();
		expect(status).toBe('NETWORK_ERROR');
	});
});
