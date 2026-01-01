import { describe, it, expect, vi, beforeEach } from 'vitest';
import TranslatorManager from '../src/managers/TranslatorManager';
import { Collection } from 'discord.js';

describe('TranslatorManager', () => {
	let translator: TranslatorManager;
	const mockContainer = {
		logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
		kythiaConfig: { bot: { language: 'en' } },
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
		translator = new TranslatorManager({ container: mockContainer });

		// Manual Injection of Locales for Testing (Avoid FS mocking hell)
		translator.locales.set('en', {
			common: {
				hello: 'Hello {name}',
				welcome: 'Welcome to Kythia',
				nested: {
					value: 'Nested Value',
				},
			},
		});

		translator.locales.set('es', {
			common: {
				hello: 'Hola {name}',
			},
		});
	});

	it('should translate simple keys', async () => {
		const result = await translator.t(null, 'common.welcome');
		expect(result).toBe('Welcome to Kythia');
	});

	it('should translate keys with variables', async () => {
		const result = await translator.t(null, 'common.hello', { name: 'Kenny' });
		expect(result).toBe('Hello Kenny');
	});

	it('should translate nested keys', async () => {
		const result = await translator.t(null, 'common.nested.value');
		expect(result).toBe('Nested Value');
	});

	it('should support different languages', async () => {
		const result = await translator.t(
			null,
			'common.hello',
			{ name: 'Jose' },
			'es',
		);
		expect(result).toBe('Hola Jose');
	});

	it('should fallback to default language if key missing in requested lang', async () => {
		// 'es' does not have 'common.welcome', but 'en' does
		const result = await translator.t(null, 'common.welcome', {}, 'es');
		expect(result).toBe('Welcome to Kythia');
	});

	it('should return key if missing in both languages', async () => {
		const result = await translator.t(null, 'common.missing');
		expect(result).toBe('[common.missing]');
	});

	it('should use custom language resolver if provided', async () => {
		const resolver = vi.fn().mockResolvedValue('es');
		translator.setLanguageResolver(resolver);

		const interaction = { guildId: '123' } as any;

		const result = await translator.t(interaction, 'common.hello', {
			name: 'User',
		});

		expect(resolver).toHaveBeenCalledWith('123');
		expect(result).toBe('Hola User');
		expect(translator.guildLanguageCache.get('123')).toBe('es');
	});
});
