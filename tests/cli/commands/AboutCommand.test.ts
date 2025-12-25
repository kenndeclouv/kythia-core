
import AboutCommand from '../../../src/cli/commands/AboutCommand';
import { Command as Commander } from 'commander';

describe('AboutCommand', () => {
    test('should register command', () => {
        const cmd = new AboutCommand();
        expect(cmd.signature).toBe('about');

        const program = new Commander();
        cmd.register(program);
    });

    test('should execute handle', async () => {
        const cmd = new AboutCommand();
        // Since handle prints to console, we might want to spy on console.log
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await cmd.handle();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
