/**
 * 🌐 AI Localization Assistant
 *
 * @file src/cli/commands/LangTranslateCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.5-beta
 *
 * @description
 * Automates the translation of the core language file (`en.json`) to a target language
 * using Google's Gemini AI. Handles JSON flattening, batch processing, and placeholder preservation.
 *
 * ✨ Core Features:
 * -  AI-Powered: Uses Gemini 2.5 Flash for natural translations.
 * -  Smart Batching: Splits large files to avoid token limits.
 * -  Context Aware: Preserves keys and complex placeholders.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from '@dotenvx/dotenvx';
import Command from '../Command';
import path from 'node:path';
import pc from 'picocolors';
import fs from 'node:fs';

config({
	quiet: true,
});

export default class LangTranslateCommand extends Command {
	public signature = 'lang:translate <target>';
	public description = 'Translate en.json to target language using Gemini AI';

	public async handle(
		_options: Record<string, any>,
		target: string,
	): Promise<void> {
		const API_KEYS = (process.env.GEMINI_API_KEYS || '')
			.split(',')
			.filter(Boolean);

		const targetLang = target || 'ja';

		const TARGET_LANGUAGE =
			targetLang === 'ja' ? 'Japan (ja)' : `${targetLang}`;

		const rootDir = process.cwd();
		const INPUT_FILE_SAFE = path.join(
			rootDir,
			'addons',
			'core',
			'lang',
			'en.json',
		);
		const OUTPUT_FILE_SAFE = path.join(
			rootDir,
			'addons',
			'core',
			'lang',
			`${targetLang}.json`,
		);

		const BATCH_SIZE = 80;
		const GEMINI_MODEL = 'gemini-2.5-flash';
		const DELAY_BETWEEN_BATCHES_MS = 5000;
		const DELAY_ON_ERROR_MS = 5000;

		if (API_KEYS.length === 0) {
			console.error(pc.red('❌ FATAL: GEMINI_API_KEYS not found in .env!'));
			process.exit(1);
		}

		let keyIndex = 0;
		function getNextGenAI(nextIndex: number | null = null) {
			if (typeof nextIndex === 'number') {
				keyIndex = nextIndex % API_KEYS.length;
			}
			const apiKey = API_KEYS[keyIndex];
			keyIndex = (keyIndex + 1) % API_KEYS.length;
			console.log(
				`[Key Rotator] Using API Key #${keyIndex === 0 ? API_KEYS.length : keyIndex}`,
			);
			return new GoogleGenAI({ apiKey });
		}

		function flattenObject(
			obj: any,
			parentKey = '',
			result: Record<string, any> = {},
		) {
			for (const key in obj) {
				const newKey = parentKey ? `${parentKey}.${key}` : key;
				if (
					typeof obj[key] === 'object' &&
					obj[key] !== null &&
					!Array.isArray(obj[key])
				) {
					flattenObject(obj[key], newKey, result);
				} else {
					result[newKey] = obj[key];
				}
			}
			return result;
		}

		function unflattenObject(obj: Record<string, any>) {
			const result: Record<string, any> = {};
			for (const key in obj) {
				const keys = key.split('.');
				keys.reduce((acc, cur, i) => {
					if (i === keys.length - 1) {
						acc[cur] = obj[key];
					} else {
						acc[cur] = acc[cur] || {};
					}
					return acc[cur];
				}, result);
			}
			return result;
		}

		async function translateBatch(batch: Record<string, any>) {
			const placeholderMap = new Map();
			let placeholderCounter = 0;

			const processedBatch = JSON.parse(
				JSON.stringify(batch),
				(_key, value) => {
					if (typeof value !== 'string') return value;
					return value.replace(/{([^{}]*)}/g, (match: string) => {
						if (!placeholderMap.has(match)) {
							placeholderMap.set(`__P_${placeholderCounter}__`, match);
							placeholderCounter++;
						}
						for (const [token, ph] of placeholderMap.entries()) {
							if (ph === match) return token;
						}
						return match;
					});
				},
			);

			const prompt = `
You are a professional localization expert. Translate the JSON values from english to ${TARGET_LANGUAGE}.

- **Target Locale:** ${targetLang} (choose naturally)
- **DO NOT** translate the JSON keys.
- **DO NOT** translate any placeholder tokens that look like \`__P_N__\`. Keep them exactly as they are.
- **KEEP** all original markdown (\`##\`, \`*\`, \`\\\`\`, \`\n\`).
- Respond ONLY with the translated JSON object, in a VALID JSON format.

Input:
${JSON.stringify(processedBatch, null, 2)}

Output:
`;

			let attempt = 1;
			let usedKeyIndex = keyIndex;

			while (true) {
				let genAI = getNextGenAI();
				const GEMINI_API_CLIENT = genAI;
				try {
					console.log(`[Batch] Attempt #${attempt}...`);

					const response = await GEMINI_API_CLIENT.models.generateContent({
						model: GEMINI_MODEL,
						contents: [{ role: 'user', parts: [{ text: prompt }] }],
					});

					let text: any;
					const respAny = response as any;
					if (respAny && typeof respAny.text === 'function') {
						text = respAny.text();
					} else if (respAny && typeof respAny.text === 'string') {
						text = respAny.text;
					}
					text = typeof text === 'string' ? text.trim() : '';

					if (text.startsWith('```json')) {
						text = text.substring(7, text.length - 3).trim();
					} else if (text.startsWith('```')) {
						text = text
							.replace(/^```[a-z]*\n?/, '')
							.replace(/```$/, '')
							.trim();
					}

					let translatedBatch = JSON.parse(text);
					translatedBatch = JSON.parse(
						JSON.stringify(translatedBatch),
						(_key, value) => {
							if (typeof value !== 'string') return value;
							return value.replace(
								/__P_(\d+)__/g,
								(match: string) => placeholderMap.get(match) || match,
							);
						},
					);

					return translatedBatch;
				} catch (e: any) {
					const errorMessage = e.message || '';
					console.error(
						pc.red(`❌ Error in batch (Attempt ${attempt})...`),
						errorMessage,
					);

					if (
						errorMessage.includes('429') ||
						errorMessage.includes('RESOURCE_EXHAUSTED')
					) {
						usedKeyIndex = (usedKeyIndex + 1) % API_KEYS.length;
						console.warn(
							pc.yellow(
								`[RATE LIMIT] Got 429! Rotating to next API key [#${usedKeyIndex + 1}] and retrying.`,
							),
						);
						genAI = getNextGenAI(usedKeyIndex);
					} else {
						console.warn(
							pc.yellow(
								`[OTHER ERROR] Waiting ${DELAY_ON_ERROR_MS / 1000} seconds...`,
							),
						);
						await new Promise((resolve) =>
							setTimeout(resolve, DELAY_ON_ERROR_MS),
						);
					}
					attempt++;
				}
			}
		}

		console.log(
			pc.cyan(`🚀 Starting translation process (to ${targetLang})...`),
		);
		console.log(pc.dim(`   Input: ${INPUT_FILE_SAFE}`));
		console.log(pc.dim(`   Output: ${OUTPUT_FILE_SAFE}`));

		if (!fs.existsSync(INPUT_FILE_SAFE)) {
			console.error(pc.red(`❌ Input file not found: ${INPUT_FILE_SAFE}`));
			process.exit(1);
		}

		const idJsonString = fs.readFileSync(INPUT_FILE_SAFE, 'utf8');
		const idJson = JSON.parse(idJsonString);

		console.log(pc.dim('Flattening JSON...'));
		const flatIdJson = flattenObject(idJson);
		const flatLangJson: Record<string, any> = {};
		const allKeys = Object.keys(flatIdJson);

		let existingLangJson: Record<string, any> = {};
		if (fs.existsSync(OUTPUT_FILE_SAFE)) {
			console.log(
				pc.yellow(`[INFO] File ${OUTPUT_FILE_SAFE} exists, continuing work...`),
			);
			try {
				existingLangJson = flattenObject(
					JSON.parse(fs.readFileSync(OUTPUT_FILE_SAFE, 'utf8')),
				);
			} catch (_e) {
				console.warn(
					pc.yellow(
						`[WARN] File ${OUTPUT_FILE_SAFE} is corrupted, will be overwritten.`,
					),
				);
			}
		}

		const keysToTranslate = allKeys.filter(
			(key) =>
				typeof flatIdJson[key] === 'string' &&
				(!existingLangJson[key] || existingLangJson[key] === flatIdJson[key]),
		);

		allKeys.forEach((key) => {
			if (!keysToTranslate.includes(key)) {
				flatLangJson[key] = existingLangJson[key] || flatIdJson[key];
			}
		});

		const totalBatches = Math.ceil(keysToTranslate.length / BATCH_SIZE);

		console.log(pc.green(`✅ Total of ${allKeys.length} keys.`));
		console.log(
			pc.green(
				`✅ Found ${keysToTranslate.length} keys that need translation.`,
			),
		);
		console.log(
			pc.green(
				`✅ Divided into ${totalBatches} batches (up to ${BATCH_SIZE} keys per batch).`,
			),
		);

		for (let i = 0; i < totalBatches; i++) {
			console.log(
				pc.cyan(`--- 🏃 Working on Batch ${i + 1} / ${totalBatches} ---`),
			);
			const batchKeys = keysToTranslate.slice(
				i * BATCH_SIZE,
				(i + 1) * BATCH_SIZE,
			);
			const batchToTranslate: Record<string, any> = {};
			batchKeys.forEach((key) => {
				batchToTranslate[key] = flatIdJson[key];
			});

			if (Object.keys(batchToTranslate).length > 0) {
				const translatedBatch = await translateBatch(batchToTranslate);
				if (translatedBatch) {
					Object.assign(flatLangJson, translatedBatch);
				} else {
					Object.assign(flatLangJson, batchToTranslate);
				}
			}

			if (i < totalBatches - 1) {
				console.log(
					pc.yellow(
						`--- 😴 Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000} seconds between batches ---`,
					),
				);
				await new Promise((resolve) =>
					setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS),
				);
			}
		}

		console.log(pc.dim('Unflattening JSON...'));
		const langJson = unflattenObject(flatLangJson);

		console.log(pc.green(`Saving to file: ${OUTPUT_FILE_SAFE}`));
		fs.writeFileSync(
			OUTPUT_FILE_SAFE,
			JSON.stringify(langJson, null, 2),
			'utf8',
		);

		console.log(pc.green('🎉 Done! Translation file generated successfully.'));
	}
}
