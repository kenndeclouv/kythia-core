
import EventManager from '../../src/managers/EventManager';
import { Collection } from 'discord.js';

describe('EventManager', () => {
    let eventManager: EventManager;
    let mockClient: any;
    let mockContainer: any;
    let mockHandlers: any;
    let mockLogger: any;

    beforeEach(() => {
        mockClient = {
            on: jest.fn(),
            once: jest.fn(),
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        };
        mockContainer = {
            logger: mockLogger,
            telemetry: {
                report: jest.fn(),
            },
            kythiaConfig: {
                developers: ['123'],
            },
        };
        mockHandlers = new Map();

        eventManager = new EventManager({
            client: mockClient,
            container: mockContainer,
            eventHandlers: mockHandlers,
        });
    });

    test('should initialize event manager', () => {
        eventManager.initialize();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('EventManager initialized'));
    });

    test('should register event handlers', () => {
        const handler = jest.fn();
        mockHandlers.set('messageCreate', [handler]);

        eventManager.initialize();

        expect(mockClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    });
});
