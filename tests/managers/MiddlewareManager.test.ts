
import MiddlewareManager from '../../src/managers/MiddlewareManager';

describe('MiddlewareManager', () => {
    let middlewareManager: MiddlewareManager;
    let mockContainer: any;
    let mockLogger: any;

    beforeEach(() => {
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
            appRoot: '/tmp',
        };

        middlewareManager = new MiddlewareManager({
            container: mockContainer,
        });
    });

    test('should initialize middleware manager', () => {
        expect(middlewareManager).toBeDefined();
    });

    test('should load middlewares', async () => {
        // Since loadMiddlewares reads from FS, we might want to mock FS or just check empty state if dir doesn't exist
        // For now, assuming empty or missing dir is fine
        await middlewareManager.loadMiddlewares();
        // Just checking no error thrown
    });

    // Add more tests for execute method if needed, potentially with mocked middlewares
});
