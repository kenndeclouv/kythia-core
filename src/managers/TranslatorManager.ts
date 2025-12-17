/**
 * 倹 Translator Manager
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

export default class TranslatorManager {
	private container: KythiaContainer;
	private logger: any;
	private config: any;

	public guildLanguageCache: Collection<string, string>;

	public locales: Collection<string, LocaleData>;

	public defaultLang: string;

	constructor({ container }: { container: KythiaContainer }) {
		this.container = container;
		this.logger = container.logger;
		this.config = container.kythiaConfig;

		this.guildLanguageCache = new Collection();
		this.locales = new Collection();
		this.defaultLang = this.config.bot.language || 'en';
	}

	/**
	 * Helper buat deep merge object
	 */
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

	/**
	 * Load locale dari folder tertentu
	 */
	public loadLocalesFromDir(dirPath: string): void {
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
					this.logger.debug(`🌐 Merged locale: ${langCode} from ${dirPath}`);
				} else {
					this.locales.set(langCode, newData);
					this.logger.info(`🌐 Loaded New Language: ${langCode}`);
				}
			} catch (err) {
				this.logger.error(
					`笶Error loading language file ${file} from ${dirPath}:`,
					err,
				);
			}
		}
	}

	/**
	 * Ambil nested value pake dot notation
	 */
	private _getNestedValue(obj: any, pathExpr: string): string | undefined {
		if (!pathExpr) return undefined;
		return pathExpr
			.split('.')
			.reduce(
				(o, key) => (o && o[key] !== undefined ? o[key] : undefined),
				obj,
			) as string | undefined;
	}

	/**
	 * Fungsi translate utama (t)
	 */
	public async t(
		interaction: BaseInteraction | null,
		key: string,
		variables: TranslationVariables = {},
		forceLang: string | null = null,
	): Promise<string> {
		const ServerSetting = this.container.models?.ServerSetting;

		let lang: string | null = forceLang;

		if (!lang && interaction && interaction.guildId) {
			if (this.guildLanguageCache.has(interaction.guildId)) {
				lang = this.guildLanguageCache.get(interaction.guildId) || null;
			} else if (ServerSetting) {
				try {
					const setting = await (ServerSetting as any).getCache({
						guildId: interaction.guildId,
					});
					lang = setting?.language ? setting.language : this.defaultLang;
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
	}

	public getLocales() {
		return this.locales;
	}
}
