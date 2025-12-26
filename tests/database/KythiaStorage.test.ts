
import KythiaStorage = require('../../src/database/KythiaStorage');
import { Sequelize, Model, DataTypes } from 'sequelize';

describe('KythiaStorage', () => {
    let sequelize: Sequelize;
    let storage: KythiaStorage;

    beforeEach(async () => {
        sequelize = new Sequelize('sqlite::memory:', { logging: false });

        // Mock the Migration model which KythiaStorage uses
        // Since KythiaStorage defines it internally if not passed, but we pass sequelize instance
        // We need to let it initialize.

        storage = new KythiaStorage({ sequelize });
    });

    afterEach(async () => {
        await sequelize.close();
    });

    test('should initialize storage', () => {
        expect(storage).toBeDefined();
    });

    // Since KythiaStorage has internal logic to create model, let's just test executed()
    test('should return executed migrations', async () => {
        // First sync the model
        // KythiaStorage doesn't expose the model directly easily or sync it explicitly in executed()
        // unless executed() calls model methods.
        // It relies on MigrationModel being defined in constructor.

        // Since we are mocking everything else, this might be tricky without exposing internals.
        // But let's try calling executed.

        // We need to ensure the table exists.
        // KythiaStorage uses `this.model` which is `sequelize.define(...)`.
        // We can manually sync the sequelize instance.
        await sequelize.sync();

        const executed = await storage.executed();
        expect(executed).toEqual([]);
    });

    test('should log migration', async () => {
        await sequelize.sync();

        await storage.logMigration({ name: 'test-migration.js' });

        const executed = await storage.executed();
        expect(executed).toContain('test-migration.js');
    });

    test('should unlog migration', async () => {
        await sequelize.sync();

        await storage.logMigration({ name: 'test-migration.js' });
        await storage.unlogMigration({ name: 'test-migration.js' });

        const executed = await storage.executed();
        expect(executed).not.toContain('test-migration.js');
    });
});
