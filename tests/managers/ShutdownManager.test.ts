
import { ShutdownManager } from '../../src/managers/ShutdownManager';

describe('ShutdownManager', () => {
    let shutdownManager: ShutdownManager;
    let mockClient: any;
    let mockContainer: any;
    let mockLogger: any;

    beforeEach(() => {
        mockClient = {
            destroy: jest.fn(),
            user: { tag: 'TestBot#1234' },
            uptime: 1000,
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            on: jest.fn(),
            end: jest.fn(),
        };
        mockContainer = {
            logger: mockLogger,
            telemetry: {
                report: jest.fn(),
            },
            kythiaConfig: {
                developers: ['123'],
            },
            sequelize: {
                close: jest.fn(),
            },
            redis: {
                quit: jest.fn(),
            },
        };

        shutdownManager = new ShutdownManager({
            client: mockClient,
            container: mockContainer,
        });
    });

    test('should initialize shutdown manager', () => {
        shutdownManager.initialize();
        expect(shutdownManager).toBeDefined();
        // Check if global interval tracker was initialized
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Global setInterval/clearInterval has been patched'));
    });

    test('should track active intervals', () => {
        shutdownManager.initialize();

        const intervalId = setInterval(() => {}, 1000);
        expect(shutdownManager.getActiveIntervalsCount()).toBeGreaterThan(0);

        clearInterval(intervalId);
        expect(shutdownManager.getActiveIntervalsCount()).toBe(0);
    });
});
