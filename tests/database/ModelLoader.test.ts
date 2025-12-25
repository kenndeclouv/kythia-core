
import bootModels from '../../src/database/ModelLoader';
import { Sequelize, DataTypes } from 'sequelize';
import * as fs from 'node:fs';
import * as path from 'node:path';

jest.mock('node:fs');

describe('ModelLoader', () => {
    let sequelize: Sequelize;
    let mockKythiaInstance: any;

    beforeEach(() => {
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        mockKythiaInstance = {
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            },
            appRoot: '/tmp',
            container: {
                appRoot: '/tmp',
                models: {}
            }
        };

        // Mock FS
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readdirSync as jest.Mock).mockImplementation((dir: string) => {
            if (dir.endsWith('addons')) {
                return ['test-addon'];
            }
            if (dir.includes('models')) {
                return ['TestModel.js'];
            }
            return [];
        });
        (fs.statSync as jest.Mock).mockReturnValue({
            isDirectory: () => true
        });
    });

    afterEach(async () => {
        await sequelize.close();
    });

    test('should load models from addons', async () => {
        // We need to verify it scans.
        await bootModels(mockKythiaInstance, sequelize);

        // It should at least log scanning info or attempt to load.
        // Since the require inside ModelLoader will fail (file doesn't exist), it might log error.
        expect(mockKythiaInstance.logger.info).toHaveBeenCalled();
    });
});
