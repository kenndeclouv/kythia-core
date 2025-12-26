
import Kythia = require('../../src/Kythia');
import { InteractionManager } from '../../src/managers/InteractionManager';
import { Collection } from 'discord.js';

describe('InteractionManager', () => {
    let interactionManager: InteractionManager;
    let mockClient: any;
    let mockContainer: any;
    let mockHandlers: any;
    let mockLogger: any;
    let mockTelemetry: any;

    beforeEach(() => {
        mockClient = {
            on: jest.fn(),
            commands: new Collection(),
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        };
        mockTelemetry = {
            report: jest.fn(),
        };
        mockContainer = {
            logger: mockLogger,
            telemetry: mockTelemetry,
            kythiaConfig: {
                developers: ['123'],
                bot: { devGuildId: '456' },
                owner: { ids: '123' },
                settings: { supportServer: 'https://example.com' }
            },
            middlewareManager: {
                handle: jest.fn().mockResolvedValue(true)
            },
            t: jest.fn((_, key) => key),
            helpers: {
                discord: {
                    isOwner: jest.fn().mockReturnValue(false)
                }
            },
            models: {}
        };
        mockHandlers = {
            buttonHandlers: new Map(),
            modalHandlers: new Map(),
            selectMenuHandlers: new Map(),
            autocompleteHandlers: new Map(),
            commandCategoryMap: new Map(),
            categoryToFeatureMap: new Map(),
        };

        interactionManager = new InteractionManager({
            client: mockClient,
            container: mockContainer,
            handlers: mockHandlers,
        });
    });

    test('should initialize interaction handler', () => {
        interactionManager.initialize();
        expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
    });

    test('should handle chat input command', async () => {
        const mockCommand = {
            execute: jest.fn(),
        };
        mockClient.commands.set('test-cmd', mockCommand);

        const mockInteraction = {
            isChatInputCommand: () => true,
            isButton: () => false,
            isModalSubmit: () => false,
            isAnySelectMenu: () => false,
            isAutocomplete: () => false,
            commandName: 'test-cmd',
            user: { id: '789', tag: 'test#1234' },
            guild: { id: '101', name: 'Test Guild' },
            reply: jest.fn(),
            options: {
                getSubcommandGroup: () => null,
                getSubcommand: () => null,
            },
            isRepliable: jest.fn().mockReturnValue(true),
        };

        // Access the private method via any casting to test logic
        await (interactionManager as any)._handleChatInputCommand(mockInteraction);
        expect(mockCommand.execute).toHaveBeenCalled();
    });

    test('should handle button interaction', async () => {
        const handler = jest.fn();
        mockHandlers.buttonHandlers.set('test-btn', handler);

        const mockInteraction = {
            isChatInputCommand: () => false,
            isButton: () => true,
            isModalSubmit: () => false,
            isAnySelectMenu: () => false,
            isAutocomplete: () => false,
            customId: 'test-btn',
            user: { id: '789', tag: 'test#1234' },
            guild: { id: '101', name: 'Test Guild' },
            reply: jest.fn(),
            isRepliable: jest.fn().mockReturnValue(true),
        };

        await (interactionManager as any)._handleButton(mockInteraction);
        expect(handler).toHaveBeenCalled();
    });
});
