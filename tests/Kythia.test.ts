
import Kythia = require('../src/Kythia');
import { Collection } from 'discord.js';

// Mock dependencies
jest.mock('discord.js', () => ({
    Client: jest.fn().mockImplementation(() => ({
        commands: new Collection(),
        once: jest.fn(),
        login: jest.fn(),
        on: jest.fn(),
        user: { tag: 'TestBot' }
    })),
    Collection: Map,
    REST: jest.fn().mockImplementation(() => ({
        setToken: jest.fn().mockReturnThis(),
        put: jest.fn(),
    })),
    Routes: {
        applicationGuildCommands: jest.fn(),
        applicationCommands: jest.fn(),
    }
}));

jest.mock('../src/managers/AddonManager');
jest.mock('../src/managers/InteractionManager');
jest.mock('../src/managers/ShutdownManager');
jest.mock('../src/managers/EventManager');
jest.mock('../src/managers/MiddlewareManager');
jest.mock('../src/managers/TranslatorManager');
jest.mock('../src/managers/TelemetryManager');
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));
jest.mock('../src/utils/discord', () => jest.fn().mockReturnValue({}));
jest.mock('../src/KythiaClient', () => jest.fn().mockImplementation(() => ({
    commands: new Collection(),
    once: jest.fn(),
    login: jest.fn(),
    on: jest.fn(),
    user: { tag: 'TestBot' },
    cooldowns: new Collection()
})));

describe('Kythia', () => {
    let kythia: Kythia;
    let mockConfig: any;

    beforeEach(() => {
        mockConfig = {
            bot: {
                token: 'test-token',
                clientId: '123',
                clientSecret: 'secret',
                devGuildId: '456',
            },
            db: {
                driver: 'sqlite',
                name: 'test.sqlite'
            },
            legal: {
                acceptTOS: true,
                dataCollection: true,
            },
            licenseKey: 'test-license'
        };

        // Reset mocks
        jest.clearAllMocks();

        kythia = new Kythia({
            config: mockConfig,
        });
    });

    test('should initialize successfully', () => {
        expect(kythia).toBeDefined();
        expect(kythia.client).toBeDefined();
    });

    test('should register button handler', () => {
        // Mock addonManager
        const mockAddonManager = {
            registerButtonHandler: jest.fn(),
        };
        (kythia as any).addonManager = mockAddonManager;

        const handler = jest.fn();
        kythia.registerButtonHandler('test-btn', handler);

        expect(mockAddonManager.registerButtonHandler).toHaveBeenCalledWith('test-btn', handler);
    });

    // We can add a test for start(), but it involves many async steps and complex mocking.
    // For now, let's ensure instantiation works and delegation works.

    test('should register modal handler', () => {
         const mockAddonManager = {
            registerModalHandler: jest.fn(),
        };
        (kythia as any).addonManager = mockAddonManager;

        const handler = jest.fn();
        kythia.registerModalHandler('test-modal', handler);

        expect(mockAddonManager.registerModalHandler).toHaveBeenCalledWith('test-modal', handler);
    });
});
