
import KythiaClient from '../src/KythiaClient';
import { Collection } from 'discord.js';

describe('KythiaClient', () => {
    test('should initialize client', () => {
        const client = KythiaClient();
        expect(client).toBeDefined();
    });
});
