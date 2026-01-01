import { describe, it, expect, vi, beforeEach } from 'vitest';
import Kythia from '../src/Kythia'; // Uses @src alias from my config
import type { KythiaConfig } from '../src/types';

// Mocks
vi.mock('@src/KythiaClient', () => ({
	default: vi.fn(() => ({
		commands: new Map(),
		cooldowns: new Map(),
		container: {},
	})),
}));

vi.mock('@managers/TelemetryManager', () => {
	return {
		TelemetryManager: class {
			constructor() {}
			verify = vi.fn().mockResolvedValue(true);
			isTokenValid = vi.fn().mockReturnValue(true);
			getLicenseKey = vi.fn().mockReturnValue('TEST-LICENSE-KEY');
			report = vi.fn();
		},
	};
});

vi.mock('@managers/MetricsManager', () => ({
	MetricsManager: vi.fn(),
}));

vi.mock('@managers/TranslatorManager', () => ({
	default: vi.fn(),
}));

vi.mock('@managers/AddonManager', () => ({
	default: vi.fn(),
}));

describe('Kythia Core', () => {
	let kythia: Kythia;
	const mockConfig: KythiaConfig = {
		bot: {
			token: 'test-token',
			clientId: '123456789',
			clientSecret: 'secret',
			devGuildId: 'guild-id',
			mainGuildId: 'guild-id',
			name: 'KythiaTest',
			owners: ['123'],
		},
		db: {
			driver: 'sqlite',
			name: ':memory:',
		},
		env: 'development',
		licenseKey: 'TEST-KEY',
		version: '1.0.0',
	} as any;

	const mockLogger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should initialize container correctly', () => {
		kythia = new Kythia({
			config: mockConfig,
			logger: mockLogger,
			appRoot: '/test/root',
		});

		expect(kythia.container).toBeDefined();
		expect(kythia.container.client).toBeDefined();
		expect(kythia.container.logger).toBe(mockLogger);
		expect(kythia.container.kythiaConfig).toBe(mockConfig);
		expect(kythia.container.telemetry).toBeDefined();
	});

	it('should validate configuration on constructor (mostly implicit via type checks)', () => {
		kythia = new Kythia({
			config: mockConfig,
			logger: mockLogger,
		});
		expect(kythia.kythiaConfig.db.driver).toBe('sqlite');
	});
});
