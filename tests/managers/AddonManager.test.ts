
import Kythia = require('../../src/Kythia');
import AddonManager from '../../src/managers/AddonManager';
import { Collection } from 'discord.js';

describe('AddonManager', () => {
    let addonManager: AddonManager;
    let mockClient: any;
    let mockContainer: any;
    let mockLogger: any;

    beforeEach(() => {
        mockClient = {
            commands: new Collection(),
        };
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };
        mockContainer = {
            logger: mockLogger,
            telemetry: {
                report: jest.fn(),
            },
            kythiaConfig: {
                addons: {}
            },
            appRoot: '/tmp'
        };

        addonManager = new AddonManager({
            client: mockClient,
            container: mockContainer,
        });
    });

    test('should register button handler', () => {
        const handler = jest.fn();
        addonManager.registerButtonHandler('test-btn', handler);
        expect(addonManager.buttonHandlers.get('test-btn')).toBe(handler);
    });

    test('should warn on duplicate button handler', () => {
        const handler = jest.fn();
        addonManager.registerButtonHandler('test-btn', handler);
        addonManager.registerButtonHandler('test-btn', handler);
        expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should register modal handler', () => {
        const handler = jest.fn();
        addonManager.registerModalHandler('test-modal', handler);
        expect(addonManager.modalHandlers.get('test-modal')).toBe(handler);
    });

    test('should register select menu handler', () => {
        const handler = jest.fn();
        addonManager.registerSelectMenuHandler('test-select', handler);
        expect(addonManager.selectMenuHandlers.get('test-select')).toBe(handler);
    });

    test('should register autocomplete handler', () => {
        const handler = jest.fn();
        addonManager.registerAutocompleteHandler('test-cmd', handler);
        expect(addonManager.autocompleteHandlers.get('test-cmd')).toBe(handler);
    });
});
