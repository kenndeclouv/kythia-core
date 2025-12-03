/**
 * 🕵️‍♂️ Translation Integrity Linter
 *
 * @file src/cli/commands/LangCheckCommand.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
 *
 * @description
 * Performs a deep AST analysis of the codebase to find `t()` translation function calls.
 * Verifies that every used key exists in the language files (JSON) and reports usage errors.
 *
 * ✨ Core Features:
 * -  AST Parsing: Uses Babel parser for accurate key detection (handles dynamic patterns).
 * -  Key Verification: Recursively checks nested JSON structures.
 * -  Unused Key Detection: Reports keys defined in JSON but never used in code.
 */

const Command = require('../Command');
const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function deepMerge(target, source) {
	if (typeof target !== 'object' || target === null) return source;
	if (typeof source !== 'object' || source === null) return source;

	for (const key of Object.keys(source)) {
		if (
			source[key] instanceof Object &&
			target[key] instanceof Object &&
			!Array.isArray(source[key])
		) {
			target[key] = deepMerge(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
}

function getAllKeys(obj, allDefinedKeys, prefix = '') {
	Object.keys(obj).forEach((key) => {
		if (key === '_value' || key === 'text') {
			if (Object.keys(obj).length === 1) return;
			if (prefix) allDefinedKeys.add(prefix);
			return;
		}
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof obj[key] === 'object' && obj[key] !== null) {
			if (key !== 'jobs' && key !== 'shop') {
				getAllKeys(obj[key], allDefinedKeys, fullKey);
			} else {
				allDefinedKeys.add(fullKey);
			}
		} else {
			allDefinedKeys.add(fullKey);
		}
	});
}

class LangCheckCommand extends Command {
	signature = 'lang:check';
	description =
		'Lint translation key usage in code and language files (AST-based)';

	async handle() {
		const PROJECT_ROOT = process.cwd();
		const SCAN_DIRECTORIES = ['addons', 'src'];
		const DEFAULT_LANG = 'en';
		const IGNORE_PATTERNS = [
			'**/node_modules/**',
			'**/dist/**',
			'**/tests/**',
			'**/assets/**',
			'**/dashboard/web/public/**',
			'**/temp/**',
			'**/leetMap.js',
			'**/generate_*.js',
			'**/refactor_*.js',
			'**/undo_*.js',
			'**/*.d.ts',
		];

		const locales = {};
		const usedStaticKeys = new Set();
		const usedDynamicKeys = new Set();
		const unanalyzableKeys = new Set();
		let filesScanned = 0;
		let filesWithErrors = 0;

		console.log('--- Kythia AST Translation Linter ---');

		function hasNestedKey(obj, pathExpr) {
			if (!obj || !pathExpr) return false;
			const parts = pathExpr.split('.');
			let current = obj;
			for (const part of parts) {
				if (
					typeof current !== 'object' ||
					current === null ||
					!Object.hasOwn(current, part)
				) {
					return false;
				}
				current = current[part];
			}
			return true;
		}

		function _loadLocales() {
			console.log(`\n🔍 Searching for language files in: ${PROJECT_ROOT}`);
			try {
				const langFiles = glob.sync('**/lang/*.json', {
					cwd: PROJECT_ROOT,
					ignore: ['**/node_modules/**', '**/dist/**'],
					absolute: true,
				});

				if (langFiles.length === 0) {
					console.error(
						'\x1b[31m%s\x1b[0m',
						'❌ No .json files found in any lang folder.',
					);
					return false;
				}

				let loadedCount = 0;
				for (const file of langFiles) {
					if (file.includes('_flat') || file.includes('_FLAT')) continue;

					const filename = path.basename(file);
					const lang = filename.replace('.json', '');
					const content = fs.readFileSync(file, 'utf8');

					try {
						const parsed = JSON.parse(content);
						if (!locales[lang]) {
							locales[lang] = parsed;
						} else {
							// Merge with existing locale data
							locales[lang] = deepMerge(locales[lang], parsed);
						}
						loadedCount++;
					} catch (jsonError) {
						console.error(
							`\x1b[31m%s\x1b[0m`,
							`❌ Failed to parse JSON: ${path.relative(PROJECT_ROOT, file)} - ${jsonError.message}`,
						);
						filesWithErrors++;
					}
				}
				console.log(`  > Successfully loaded ${loadedCount} language files.`);

				if (!locales[DEFAULT_LANG]) {
					console.error(
						`\x1b[31m%s\x1b[0m`,
						`❌ Default language (${DEFAULT_LANG}) not found in any loaded files!`,
					);
					return false;
				}
				return true;
			} catch (error) {
				console.error(
					'\x1b[31m%s\x1b[0m',
					`❌ Failed to load language files: ${error.message}`,
				);
				return false;
			}
		}

		if (!_loadLocales()) {
			console.error('\x1b[31mCannot proceed (language files invalid).\x1b[0m');
			process.exit(1);
		}

		console.log(
			`\nScanning .js/.ts files in: ${SCAN_DIRECTORIES.join(', ')}...`,
		);
		SCAN_DIRECTORIES.forEach((dirName) => {
			const dirPath = path.join(PROJECT_ROOT, dirName);
			const files = glob.sync(`${dirPath}/**/*.{js,ts}`, {
				ignore: IGNORE_PATTERNS,
				dot: true,
			});
			files.forEach((filePath) => {
				filesScanned++;
				process.stdout.write(`\rScanning: ${filesScanned} files...`);

				try {
					const code = fs.readFileSync(filePath, 'utf8');
					const ast = parser.parse(code, {
						sourceType: 'module',
						plugins: [
							'typescript',
							'jsx',
							'classProperties',
							'objectRestSpread',
						],
						errorRecovery: true,
					});

					traverse(ast, {
						CallExpression(nodePath) {
							const node = nodePath.node;
							if (
								node.callee.type === 'Identifier' &&
								node.callee.name === 't'
							) {
								if (node.arguments.length >= 2) {
									const keyArg = node.arguments[1];
									if (keyArg.type === 'StringLiteral') {
										usedStaticKeys.add(keyArg.value);
									} else if (keyArg.type === 'TemplateLiteral') {
										let pattern = '';
										keyArg.quasis.forEach((quasi, _i) => {
											pattern += quasi.value.raw;
											if (!quasi.tail) {
												pattern += '*';
											}
										});
										pattern = pattern.replace(/_/g, '.');
										usedDynamicKeys.add(pattern);
									} else if (
										keyArg.type === 'BinaryExpression' &&
										keyArg.operator === '+'
									) {
										if (keyArg.left.type === 'StringLiteral') {
											const pattern = `${keyArg.left.value.replace(/_/g, '.')}*`;
											usedDynamicKeys.add(pattern);
										} else {
											unanalyzableKeys.add(
												`Complex (+) at ${path.relative(PROJECT_ROOT, filePath)}:${node.loc?.start.line}`,
											);
										}
									} else {
										unanalyzableKeys.add(
											`Variable/Other at ${path.relative(PROJECT_ROOT, filePath)}:${node.loc?.start.line}`,
										);
									}
								}
							}
						},
					});
				} catch (parseError) {
					if (parseError.message.includes('Unexpected token')) {
						console.warn(
							`\n\x1b[33m[WARN] Syntax Error parsing ${path.relative(
								PROJECT_ROOT,
								filePath,
							)}:${parseError.loc?.line} - ${parseError.message}\x1b[0m`,
						);
					} else {
						console.error(
							`\n\x1b[31m[ERROR] Failed to parse ${path.relative(
								PROJECT_ROOT,
								filePath,
							)}: ${parseError.message}\x1b[0m`,
						);
					}
					filesWithErrors++;
				}
			});
		});
		process.stdout.write(`${'\r'.padEnd(process.stdout.columns || 60)}\r`);

		console.log(`\nScan completed. Total ${filesScanned} files processed.`);
		console.log(`  > Found \x1b[33m${usedStaticKeys.size}\x1b[0m static keys.`);
		console.log(
			`  > Found \x1b[33m${usedDynamicKeys.size}\x1b[0m dynamic key patterns (check manually!).`,
		);

		if (unanalyzableKeys.size > 0) {
			console.log(
				`  > \x1b[31m${unanalyzableKeys.size}\x1b[0m t() calls could not be analyzed (variable/complex).`,
			);
		}

		console.log('\nVerifying static keys against language files...');

		let totalMissingStatic = 0;
		for (const lang in locales) {
			const missingInLang = [];
			for (const staticKey of usedStaticKeys) {
				if (!hasNestedKey(locales[lang], staticKey)) {
					missingInLang.push(staticKey);
				}
			}
			if (missingInLang.length > 0) {
				console.log(
					`\n❌ \x1b[31m[${lang.toUpperCase()}] Found ${missingInLang.length} missing static keys:\x1b[0m`,
				);
				missingInLang.sort().forEach((key) => {
					console.log(`  - ${key}`);
				});
				totalMissingStatic += missingInLang.length;
				filesWithErrors++;
			} else {
				console.log(
					`\n✅ \x1b[32m[${lang.toUpperCase()}] All static keys found!\x1b[0m`,
				);
			}
		}

		if (usedDynamicKeys.size > 0) {
			console.log(
				`\n\n⚠️ \x1b[33mDynamic Key Patterns Detected (Check Manually):\x1b[0m`,
			);
			[...usedDynamicKeys].sort().forEach((pattern) => {
				console.log(`  - ${pattern}`);
			});
			console.log(
				`   (Ensure all possible keys from these patterns exist in the language files)`,
			);
		}

		if (unanalyzableKeys.size > 0) {
			console.log(
				`\n\n⚠️ \x1b[31mComplex/Unanalyzable t() Calls (Check Manually):\x1b[0m`,
			);
			[...unanalyzableKeys].sort().forEach((loc) => {
				console.log(`  - ${loc}`);
			});
		}

		console.log(`\nChecking UNUSED keys (based on ${DEFAULT_LANG}.json)...`);

		const defaultLocale = locales[DEFAULT_LANG];
		const allDefinedKeys = new Set();

		if (defaultLocale) {
			try {
				getAllKeys(defaultLocale, allDefinedKeys);
			} catch (e) {
				console.error('Error collecting defined keys:', e);
			}

			const unusedKeys = [];
			for (const definedKey of allDefinedKeys) {
				if (!usedStaticKeys.has(definedKey)) {
					let matchedByDynamic = false;
					for (const dynamicPattern of usedDynamicKeys) {
						const regexPattern = `^${dynamicPattern
							.replace(/\./g, '\\.')
							.replace(/\*/g, '[^.]+?')}$`;
						if (new RegExp(regexPattern).test(definedKey)) {
							matchedByDynamic = true;
							break;
						}
					}
					if (!matchedByDynamic) {
						unusedKeys.push(definedKey);
					}
				}
			}
			if (unusedKeys.length > 0) {
				console.log(
					`\n⚠️ \x1b[33mFound ${unusedKeys.length} UNUSED keys in ${DEFAULT_LANG}.json (don't match static/dynamic patterns):\x1b[0m`,
				);
				unusedKeys.sort().forEach((key) => {
					console.log(`  - ${key}`);
				});
			} else {
				console.log(
					`\n✅ \x1b[32m[${DEFAULT_LANG.toUpperCase()}] No unused keys found.\x1b[0m`,
				);
			}
		} else {
			console.warn(
				`\n\x1b[33m[WARN] Cannot check unused keys because ${DEFAULT_LANG}.json failed to load.\x1b[0m`,
			);
		}

		console.log('\n--- Done ---');

		if (filesWithErrors > 0 || totalMissingStatic > 0) {
			console.log(
				`\x1b[31mTotal ${totalMissingStatic} missing static key errors + ${filesWithErrors - totalMissingStatic} file errors found. Please fix them.\x1b[0m`,
			);
			process.exit(1);
		} else {
			console.log(
				'\x1b[32mCongratulations! Language files (for static keys) are already synced with the code.\x1b[0m',
			);
			if (usedDynamicKeys.size > 0 || unanalyzableKeys.size > 0) {
				console.log(
					"\x1b[33mHowever, don't forget to manually check the reported dynamic/complex keys above!\x1b[0m",
				);
			}
		}
	}
}

module.exports = LangCheckCommand;
