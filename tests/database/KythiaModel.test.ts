
import { KythiaModel } from '../../src/database/KythiaModel';
import { Sequelize, DataTypes } from 'sequelize';

// Mock IORedis
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        multi: jest.fn().mockReturnThis(),
        exec: jest.fn(),
        sadd: jest.fn(),
        sunion: jest.fn(),
        quit: jest.fn(),
    }));
});

describe('KythiaModel', () => {
    let sequelize: Sequelize;
    let mockLogger: any;

    class TestModel extends KythiaModel {
        static structure = {
            attributes: {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                name: {
                    type: DataTypes.STRING
                }
            },
            options: {
                timestamps: true
            }
        };
    }

    beforeEach(async () => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        sequelize = new Sequelize('sqlite::memory:', { logging: false });

        TestModel.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING
            }
        }, {
            sequelize,
            modelName: 'TestModel'
        });

        await sequelize.sync({ force: true });

        // Reset KythiaModel static state
        KythiaModel.setDependencies({
            logger: mockLogger,
            config: {
                db: {
                    useRedis: false,
                    driver: 'sqlite',
                    name: 'test',
                    timezone: '+00:00',
                    redisCacheVersion: '1.0.0'
                }
            } as any
        });
    });

    afterEach(async () => {
        await sequelize.close();
    });

    test('should initialize model', () => {
        expect(TestModel).toBeDefined();
    });

    test('should cache get request in memory when redis disabled', async () => {
        const item = await TestModel.create({ name: 'test' });

        // First fetch (miss)
        const result1 = await TestModel.getCache({ where: { id: item.getDataValue('id') } });
        expect(result1.getDataValue('name')).toBe('test');
        expect(KythiaModel.cacheStats.misses).toBe(1);

        // Second fetch (hit)
        const result2 = await TestModel.getCache({ where: { id: item.getDataValue('id') } });
        expect(result2.getDataValue('name')).toBe('test');
        expect(KythiaModel.cacheStats.mapHits).toBe(1);
    });

    test('should invalidate cache on update', async () => {
        const item = await TestModel.create({ name: 'test' });
        await TestModel.getCache({ where: { id: item.getDataValue('id') } }); // Cache it

        const fetched = await TestModel.findOne({ where: { id: item.getDataValue('id') } }) as any;
        fetched.name = 'updated';
        await fetched.saveAndUpdateCache();

        const result = await TestModel.getCache({ where: { id: item.getDataValue('id') } });
        expect(result.getDataValue('name')).toBe('updated');
    });
});
