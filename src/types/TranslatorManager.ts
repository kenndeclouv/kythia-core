import type { BaseInteraction, Collection } from 'discord.js';

export interface TranslationVariables {
	[key: string]: string | number | boolean;
}

export type LocaleData = {
	[key: string]: string | LocaleData;
};

export type TranslateFunction = (
	interaction: BaseInteraction | null,
	key: string,
	variables?: TranslationVariables,
	forceLang?: string | null,
) => Promise<string>;

export interface ITranslatorManager {
	locales: Collection<string, LocaleData>;
	defaultLang: string;

	loadLocalesFromDir(dirPath: string): void;

	t: TranslateFunction;

	getLocales(): Collection<string, LocaleData>;
}
