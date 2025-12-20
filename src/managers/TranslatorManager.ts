/**
 * 🌐 Translator Manager
 * @file src/managers/TranslatorManager.ts
 */

import { Collection, type BaseInteraction } from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';
import type {
	KythiaContainer,
	LocaleData,
	TranslationVariables,
} from '../types';

type LanguageResolver = (guildId: string) => Promise<string | null>;

export default class TranslatorManager {
	private logger: any;
	private config: any;

	public guildLanguageCache: Collection<string, string>;
	public locales: Collection<string, LocaleData>;
	public defaultLang: string;

	private languageResolver: LanguageResolver = async () => null;

	public container: KythiaContainer;

	constructor({ container }: { container: KythiaContainer }) {
		this.container = container;
		this.logger = container.logger;
		this.config = container.kythiaConfig;

		this.guildLanguageCache = new Collection();
		this.locales = new Collection();
		this.defaultLang = this.config.bot.language || 'en';
	}

	public setLanguageResolver(resolver: LanguageResolver) {
		this.languageResolver = resolver;
	}

	private _deepMerge(target: any, source: any): any {
		for (const key of Object.keys(source)) {
			if (source[key] instanceof Object && !Array.isArray(source[key])) {
				if (!target[key]) Object.assign(target, { [key]: {} });
				this._deepMerge(target[key], source[key]);
			} else {
				Object.assign(target, { [key]: source[key] });
			}
		}
		return target;
	}

	public loadLocalesFromDir(dirPath: string): void {
		try {
			if (!fs.existsSync(dirPath)) return;

			const langFiles = fs
				.readdirSync(dirPath)
				.filter((file) => file.endsWith('.json'));

			for (const file of langFiles) {
				try {
					const langCode = file.replace('.json', '');
					const filePath = path.join(dirPath, file);
					const newData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

					if (this.locales.has(langCode)) {
						const existingData = this.locales.get(langCode);
						const mergedData = this._deepMerge(existingData, newData);
						this.locales.set(langCode, mergedData);

						let source = dirPath;
						if (dirPath.includes('addons')) {
							const addonName = path.basename(path.dirname(dirPath));
							source = `addon ${addonName}`;
						} else if (dirPath.endsWith('src/lang')) {
							source = 'core';
						} else if (dirPath.endsWith('lang')) {
							source = 'app';
						}

						this.logger.debug(`🌐 Merged locale ${langCode} from ${source}`);
					} else {
						this.locales.set(langCode, newData);
						this.logger.info(`🌐 Loaded New Language: ${langCode}`);
					}
				} catch (err: any) {
					this.logger.error(
						`Error loading language file ${file} from ${dirPath}:`,
						err,
					);
					// We can't use container.telemetry here because TranslatorManager is initialized before TelemetryManager in some cases,
					// or doesn't have direct access to container in the same way.
					// However, based on the constructor, it DOES have access to container.
					// But TranslatorManager properties are defined as private/public without container being a public property on the class itself,
					// only passed in constructor.
					// Wait, the constructor assigns `this.logger = container.logger`.
					// It does NOT assign `this.container = container`.
					// So I cannot access `this.container.telemetry`.
					// I should check if I can add `container` to the class properties.
				}
			}
		} catch (error: any) {
			this.logger.error(`Failed to read locale directory [${dirPath}]:`, error);
		}
	}

	private _getNestedValue(obj: any, pathExpr: string): string | undefined {
		if (!pathExpr) return undefined;
		return pathExpr
			.split('.')
			.reduce(
				(o, key) => (o && o[key] !== undefined ? o[key] : undefined),
				obj,
			) as string | undefined;
	}

	public async t(
		interaction: BaseInteraction | null | { guildId: string | null },
		key: string,
		variables: TranslationVariables = {},
		forceLang: string | null = null,
	): Promise<string> {
		try {
			let lang: string | null = forceLang;

			if (!lang && interaction && interaction.guildId) {
				if (this.guildLanguageCache.has(interaction.guildId)) {
					lang = this.guildLanguageCache.get(interaction.guildId) || null;
				} else {
					try {
						const resolvedLang = await this.languageResolver(
							interaction.guildId,
						);

						lang = resolvedLang || this.defaultLang;

						if (lang) this.guildLanguageCache.set(interaction.guildId, lang);
					} catch (_e) {
						lang = this.defaultLang;
					}
				}
			}

			if (!lang) lang = this.defaultLang;

			let primaryLangFile = this.locales.get(lang);
			const fallbackLangFile = this.locales.get(this.defaultLang);

			if (!primaryLangFile) {
				lang = this.defaultLang;
				primaryLangFile = fallbackLangFile;
			}

			let translation = this._getNestedValue(primaryLangFile, key);

			if (translation === undefined && fallbackLangFile) {
				translation = this._getNestedValue(fallbackLangFile, key);
			}

			if (translation === undefined) {
				return `[${key}]`;
			}

			for (const [variable, value] of Object.entries(variables)) {
				const regex = new RegExp(`{${variable}}`, 'g');
				translation = translation.replace(regex, String(value));
			}

			return translation;
		} catch (error: any) {
			this.logger.error(`Translation failed for key [${key}]:`, error);
			this.container.telemetry?.report(
				'error',
				`Translation Failed: [${key}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			return `[${key}]`;
		}
	}

	public getLocales() {
		return this.locales;
	}
}
