
import TranslatorManager from '../../src/managers/TranslatorManager';

describe('TranslatorManager', () => {
    let translatorManager: TranslatorManager;
    let mockContainer: any;
    let mockLogger: any;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };
        mockContainer = {
            logger: mockLogger,
            telemetry: {
                report: jest.fn(),
            },
            kythiaConfig: {
                developers: ['123'],
                bot: {
                    language: 'en'
                }
            },
        };

        translatorManager = new TranslatorManager({
            container: mockContainer,
        });
    });

    test('should initialize translator manager', () => {
        expect(translatorManager).toBeDefined();
    });

    test('should translate simple key', async () => {
        // Manually load some locales for testing
        (translatorManager as any).locales.set('en', {
            'hello': 'Hello World'
        });

        const result = await translatorManager.t(null as any, 'hello');
        expect(result).toBe('Hello World');
    });

    test('should handle missing key', async () => {
        const result = await translatorManager.t(null as any, 'missing.key');
        expect(result).toBe('[missing.key]');
    });

    test('should handle interpolation', async () => {
         (translatorManager as any).locales.set('en', {
            'welcome': 'Welcome, {name}!'
        });

        const result = await translatorManager.t(null as any, 'welcome', { name: 'User' });
        expect(result).toBe('Welcome, User!');
    });
});
