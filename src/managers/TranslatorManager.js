/**
 * 🌐 Translator Manager
 * @file src/managers/TranslatorManager.js
 */
const { Collection } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');

class TranslatorManager {
	constructor({ container }) {
		this.container = container;
		this.logger = container.logger;
		this.config = container.kythiaConfig;

		// Cache buat nyimpen preference bahasa per guild
		this.guildLanguageCache = new Collection();

		// Storage utama translasi
		// Struktur: { 'en': { ...data }, 'id': { ...data } }
		this.locales = new Collection();

		this.defaultLang = this.config.bot.language || 'en';
	}

	/**
	 * Helper buat deep merge object biar locale addon bisa gabung sama core
	 */
	_deepMerge(target, source) {
		for (const key of Object.keys(source)) {
			// Cek apakah value adalah Object (dan bukan Array)
			if (source[key] instanceof Object && !Array.isArray(source[key])) {
				// Kalau di target belum ada objectnya, bikin kosong dulu biar gak error
				if (!target[key]) Object.assign(target, { [key]: {} });

				// 🔥 REKURSIF (Gali ke dalam)
				// Ini kuncinya: Jangan timpa objectnya, tapi merge isinya satu-satu
				this._deepMerge(target[key], source[key]);
			} else {
				// Kalau bukan object (string/number), baru boleh timpa
				Object.assign(target, { [key]: source[key] });
			}
		}
		return target;
	}

	/**
	 * Load locale dari folder tertentu (Generic)
	 * Bisa dipake buat load 'src/lang' core, atau 'addons/music/lang'
	 */
	loadLocalesFromDir(dirPath) {
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
					// Kalau bahasa udah ada (misal 'en'), kita MERGE data barunya
					const existingData = this.locales.get(langCode);
					const mergedData = this._deepMerge(existingData, newData);
					this.locales.set(langCode, mergedData);
					this.logger.debug(`🌐 Merged locale: ${langCode} from ${dirPath}`);
					if (langCode === 'en' && mergedData.common) {
						this.logger.info(
							`🔍 Debug Merge: common.time exists? ${!!mergedData.common.time}`,
						);
					}
				} else {
					// Kalau belum ada, set baru
					this.locales.set(langCode, newData);
					this.logger.info(`🌐 Loaded New Language: ${langCode}`);
				}
			} catch (err) {
				this.logger.error(
					`❌ Error loading language file ${file} from ${dirPath}:`,
					err,
				);
			}
		}
	}

	/**
	 * Ambil nested value pake dot notation (common.error.generic)
	 */
	_getNestedValue(obj, pathExpr) {
		if (!pathExpr) return undefined;
		return pathExpr
			.split('.')
			.reduce(
				(o, key) => (o && o[key] !== undefined ? o[key] : undefined),
				obj,
			);
	}

	/**
	 * Fungsi translate utama (t)
	 */
	async t(interaction, key, variables = {}, forceLang = null) {
		// Ambil Model ServerSetting dari container (Dependency Injection)
		const ServerSetting = this.container.models?.ServerSetting;

		let lang = forceLang;

		// 1. Cek Guild Language (Cache -> DB)
		if (!lang && interaction && interaction.guildId) {
			if (this.guildLanguageCache.has(interaction.guildId)) {
				lang = this.guildLanguageCache.get(interaction.guildId);
			} else if (ServerSetting) {
				try {
					const setting = await ServerSetting.getCache({
						guildId: interaction.guildId,
					});
					lang = setting?.language ? setting.language : this.defaultLang;
					this.guildLanguageCache.set(interaction.guildId, lang);
				} catch (_e) {
					// Silent fail, pake default
					lang = this.defaultLang;
				}
			}
		}

		if (!lang) lang = this.defaultLang;

		// 2. Ambil data bahasa
		let primaryLangFile = this.locales.get(lang);
		const fallbackLangFile = this.locales.get(this.defaultLang);

		// Fallback kalau bahasa gak ketemu
		if (!primaryLangFile) {
			lang = this.defaultLang;
			primaryLangFile = fallbackLangFile;
		}

		// 3. Resolve Key
		let translation = this._getNestedValue(primaryLangFile, key);

		// Kalau di bahasa pilihan gak ada, cari di default (en)
		if (translation === undefined && fallbackLangFile) {
			translation = this._getNestedValue(fallbackLangFile, key);
		}

		// Kalau masih gak ada, return key-nya aja
		if (translation === undefined) {
			return `[${key}]`;
		}

		// 4. Replace Variable {variable}
		for (const [variable, value] of Object.entries(variables)) {
			const regex = new RegExp(`{${variable}}`, 'g');
			translation = translation.replace(regex, String(value));
		}

		return translation;
	}

	getLocales() {
		return this.locales;
	}
}

module.exports = TranslatorManager;
