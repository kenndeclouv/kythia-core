
import KythiaMigrator from '../../src/database/KythiaMigrator';
import { Sequelize } from 'sequelize';
import * as Umzug from 'umzug';
import * as fs from 'node:fs';

// Mock Umzug
const mockUp = jest.fn().mockResolvedValue([{ name: 'test-migration.js' }]);
const mockPending = jest.fn().mockResolvedValue([{ name: 'test-migration.js' }]);

jest.mock('umzug', () => {
    return {
        Umzug: jest.fn().mockImplementation(() => ({
            pending: mockPending,
            up: mockUp,
        })),
        SequelizeStorage: jest.fn(),
    };
});

jest.mock('node:fs');

// Create a valid mock for KythiaStorage
jest.mock('../../src/database/KythiaStorage', () => {
    return jest.fn().mockImplementation(() => ({
        logMigration: jest.fn(),
        unlogMigration: jest.fn(),
        executed: jest.fn().mockResolvedValue([]),
    }));
});

describe('KythiaMigrator', () => {
    let sequelize: Sequelize;
    let mockContainer: any;
    let mockLogger: any;

    beforeEach(() => {
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        };
        mockContainer = {
            logger: mockLogger,
            appRoot: '/tmp',
        };

        // Mock FS structure
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readdirSync as jest.Mock).mockImplementation((dir: string) => {
            if (dir.endsWith('addons')) {
                return ['test-addon'];
            }
            if (dir.includes('migrations')) {
                return ['20230101000000-test.js'];
            }
            return [];
        });
        (fs.statSync as jest.Mock).mockReturnValue({
            isDirectory: () => true
        });

        mockUp.mockClear();
        mockPending.mockClear();
    });

    afterEach(async () => {
        await sequelize.close();
        jest.clearAllMocks();
    });

    test('should run migrations when pending migrations exist', async () => {
        await KythiaMigrator({
            sequelize,
            container: mockContainer,
            logger: mockLogger
        });

        expect(Umzug.Umzug).toHaveBeenCalled();
        expect(mockUp).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully applied'));
    });
});
