import type { BaseInteraction, Collection } from 'discord.js';

// --- Helper Types (Yang sudah ada) ---

export interface TranslationVariables {
	[key: string]: string | number | boolean;
}

// Tipe data locale (nested object)
export type LocaleData = {
	[key: string]: string | LocaleData;
};

// Tipe function translate
export type TranslateFunction = (
	interaction: BaseInteraction | null,
	key: string,
	variables?: TranslationVariables,
	forceLang?: string | null,
) => Promise<string>;

// --- 🔥 MAIN INTERFACE (Yang Baru) ---

export interface ITranslatorManager {
	// Property Public
	locales: Collection<string, LocaleData>;
	defaultLang: string;

	// Method Public
	loadLocalesFromDir(dirPath: string): void;

	// Method t (Translate) pake tipe TranslateFunction di atas
	t: TranslateFunction;

	getLocales(): Collection<string, LocaleData>;
}
