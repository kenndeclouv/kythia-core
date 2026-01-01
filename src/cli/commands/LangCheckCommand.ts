/**
 * 🕵️‍♂️ Translation Integrity Linter
 *
 * @file src/cli/commands/LangCheckCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
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

import type { Command as CommanderCommand } from 'commander';
import Command from '../Command';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';

function deepMerge(target: any, source: any): any {
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

function getAllKeys(obj: any, allDefinedKeys: Set<string>, prefix = '') {
	Object.keys(obj).forEach((key) => {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (
			typeof obj[key] === 'object' &&
			obj[key] !== null &&
			!Array.isArray(obj[key])
		) {
			if ('text' in obj[key] || '_value' in obj[key]) {
				allDefinedKeys.add(fullKey);
			}
			getAllKeys(obj[key], allDefinedKeys, fullKey);
		} else {
			allDefinedKeys.add(fullKey);
		}
	});
}

export default class LangCheckCommand extends Command {
	public signature = 'lang:check';
	public description =
		'Lint translation key usage in code and language files (AST-based)';

	public async handle(options: {
		fix?: boolean;
		clean?: boolean;
	}): Promise<void> {
		const PROJECT_ROOT = process.cwd();
		const SCAN_DIRECTORIES = ['addons', 'src'];
		const DEFAULT_LANG = 'en';
		const IGNORE_PATTERNS = [
			'**/node_modules/**',
			'**/dist/**',
			'**/assets/**',
			'**/dashboard/web/public/**',
			'**/temp/**',
			'**/leetMap.js',
			'**/generate_*.js',
			'**/refactor_*.js',
			'**/undo_*.js',
			'**/*.d.ts',
		];

		const locales: Record<string, any> = {};
		const usedStaticKeys = new Set<string>();
		const usedDynamicKeys = new Set<string>();
		const allFoundStrings = new Set<string>();
		const unanalyzableKeys = new Set<string>();
		let filesScanned = 0;
		let filesWithErrors = 0;

		console.log('--- Kythia AST Translation Linter ---');
		if (options.fix) {
			console.log(
				'\x1b[33m[FIX MODE ENABLED] Unused keys will be automatically removed (with backups).\x1b[0m',
			);
		}

		function hasNestedKey(obj: any, pathExpr: string): boolean {
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

		function _loadLocales(): boolean {
			console.log(`\n🔍 Searching for language files...`);

			const patterns = [
				'lang/*.json',
				'src/lang/*.json',
				'addons/**/lang/*.json',
				'node_modules/kythia-core/src/lang/*.json',
			];

			try {
				const langFiles = glob.sync(patterns, {
					cwd: PROJECT_ROOT,
					ignore: ['**/dist/**'],
					absolute: true,
				});

				if (langFiles.length === 0) {
					console.error(
						'\x1b[31m%s\x1b[0m',
						'❌ No .json files found (checked root, src, addons, and core).',
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
							locales[lang] = deepMerge(locales[lang], parsed);
						}
						loadedCount++;
					} catch (_e) {
						console.error(
							`\x1b[31m%s\x1b[0m`,
							`❌ Failed to parse: ${path.relative(PROJECT_ROOT, file)}`,
						);
						filesWithErrors++;
					}
				}

				console.log(
					`  > Successfully loaded ${loadedCount} language files (Merged Core + Project).`,
				);

				if (!locales[DEFAULT_LANG]) {
					console.error(
						`\x1b[31m%s\x1b[0m`,
						`❌ Default language (${DEFAULT_LANG}) missing!`,
					);
					return false;
				}
				return true;
			} catch (err: unknown) {
				const error = err instanceof Error ? err : new Error(String(err));
				console.error(
					'\x1b[31m%s\x1b[0m',
					`❌ Failed to load files: ${error.message}`,
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
						StringLiteral(path) {
							allFoundStrings.add(path.node.value);
						},
						TemplateLiteral(path) {
							path.node.quasis.forEach((q) => {
								if (q.value.raw) {
									allFoundStrings.add(q.value.raw);

									if (q.value.raw.endsWith('.')) {
										allFoundStrings.add(q.value.raw.slice(0, -1));
									}
								}
							});
						},
						CallExpression(nodePath: NodePath<any>) {
							const node = nodePath.node;

							if (
								node.callee.type === 'Identifier' &&
								node.callee.name === 't'
							) {
								if (node.arguments.length >= 2) {
									const keyArg = node.arguments[1];
									analyzeArg(keyArg, filePath, node.loc?.start.line);
								}
							}
						},
					});

					function analyzeArg(
						node: any,
						file: string,
						line: number | undefined,
					) {
						if (node.type === 'StringLiteral') {
							usedStaticKeys.add(node.value);
							return;
						}

						if (node.type === 'TemplateLiteral') {
							let pattern = '';
							node.quasis.forEach((quasi: any, _i: number) => {
								pattern += quasi.value.raw;
								if (!quasi.tail) pattern += '*';
							});

							pattern = pattern.replace(/_/g, '.');
							usedDynamicKeys.add(pattern);
							return;
						}

						if (node.type === 'BinaryExpression' && node.operator === '+') {
							if (node.left.type === 'StringLiteral') {
								usedDynamicKeys.add(`${node.left.value}*`);
							} else if (node.right.type === 'StringLiteral') {
								usedDynamicKeys.add(`*${node.right.value}`);
							} else {
								unanalyzableKeys.add(
									`Complex Concat at ${path.relative(PROJECT_ROOT, file)}:${line}`,
								);
							}
							return;
						}

						if (node.type === 'ConditionalExpression') {
							analyzeArg(node.consequent, file, line);
							analyzeArg(node.alternate, file, line);
							return;
						}

						unanalyzableKeys.add(
							`Variable/Unknown at ${path.relative(PROJECT_ROOT, file)}:${line}`,
						);
					}
				} catch (error: any) {
					if (error.message.includes('Unexpected token')) {
						console.warn(
							`\n\x1b[33m[WARN] Syntax Error parsing ${path.relative(
								PROJECT_ROOT,
								filePath,
							)}:${error.loc?.line} - ${error.message}\x1b[0m`,
						);
					} else {
						console.error(
							`\n\x1b[31m[ERROR] Failed to parse ${path.relative(
								PROJECT_ROOT,
								filePath,
							)}: ${error.message}\x1b[0m`,
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

		console.log(
			'\nChecking UNUSED keys (based on all strings found in code)...',
		);

		const defaultLocale = locales[DEFAULT_LANG];
		const allDefinedKeys = new Set<string>();

		const SAFE_ZONES = ['common.'];

		if (defaultLocale) {
			try {
				getAllKeys(defaultLocale, allDefinedKeys);
			} catch (error: unknown) {
				const err = error instanceof Error ? error : new Error(String(error));
				console.error('Error collecting defined keys:', err.message);
			}

			const unusedKeys = [];
			for (const definedKey of allDefinedKeys) {
				const isSafe = SAFE_ZONES.some((zone) => definedKey.startsWith(zone));
				if (isSafe) continue;

				let isUsed = allFoundStrings.has(definedKey);

				if (
					!isUsed &&
					(definedKey.endsWith('.text') || definedKey.endsWith('._value'))
				) {
					const parentKey = definedKey.replace(/\.(text|_value)$/, '');
					if (allFoundStrings.has(parentKey)) {
						isUsed = true;
					}
				}

				if (!isUsed) {
					for (const foundString of allFoundStrings) {
						if (foundString.startsWith(`${definedKey}.`)) {
							isUsed = true;
							break;
						}
					}
				}

				if (!isUsed) {
					let matchedByDynamic = false;
					for (const dynamicPattern of usedDynamicKeys) {
						const regexPattern = `^${dynamicPattern
							.replace(/\./g, '\\.')
							.replace(/\*/g, '.*')}$`;
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

				if (options.fix) {
					console.log(
						'\n\x1b[36m🔧 Fixing unused keys (Context Aware)...\x1b[0m',
					);

					const patterns = [
						'lang/*.json',
						'src/lang/*.json',
						'addons/**/lang/*.json',
					];

					const langFiles = glob.sync(patterns, {
						cwd: PROJECT_ROOT,
						ignore: ['**/dist/**', '**/node_modules/**'],
						absolute: true,
					});

					let fixedFilesCount = 0;

					for (const file of langFiles) {
						try {
							const content = fs.readFileSync(file, 'utf8');

							const json = JSON.parse(content);
							let modified = false;

							const deleteKey = (obj: any, keyPath: string) => {
								const parts = keyPath.split('.');
								const last = parts.pop();
								let current = obj;
								for (const part of parts) {
									if (current[part] === undefined) return false;
									current = current[part];
								}

								if (last && Object.hasOwn(current, last)) {
									delete current[last];
									return true;
								}
								return false;
							};

							let backupCreated = false;

							unusedKeys.forEach((key) => {
								if (deleteKey(json, key)) {
									if (!backupCreated) {
										fs.writeFileSync(`${file}.bak`, content);
										backupCreated = true;
									}
									modified = true;
								}
							});

							if (modified) {
								const newContent = JSON.stringify(json, null, '\t');
								fs.writeFileSync(file, newContent);
								console.log(
									`  > \x1b[32mFixed\x1b[0m ${path.relative(PROJECT_ROOT, file)}`,
								);
								fixedFilesCount++;
							}
						} catch (error: unknown) {
							const err =
								error instanceof Error ? error : new Error(String(error));
							console.error(
								`  > \x1b[31mFailed to fix\x1b[0m ${path.relative(PROJECT_ROOT, file)}: ${err.message}`,
							);
						}
					}
					console.log(
						`\n\x1b[32m✨ Fix complete. Modified ${fixedFilesCount} files.\x1b[0m`,
					);
				}
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

		if (options.clean) {
			console.log('\n\x1b[36m🧹 Cleaning up .bak files...\x1b[0m');
			const patterns = [
				'lang/*.json.bak',
				'src/lang/*.json.bak',
				'addons/**/lang/*.json.bak',
			];
			const bakFiles = glob.sync(patterns, {
				cwd: PROJECT_ROOT,
				ignore: ['**/dist/**', '**/node_modules/**'],
				absolute: true,
			});

			if (bakFiles.length === 0) {
				console.log('  > No .bak files found.');
			} else {
				let deletedCount = 0;
				for (const file of bakFiles) {
					try {
						fs.unlinkSync(file);
						deletedCount++;
					} catch (error: unknown) {
						const err =
							error instanceof Error ? error : new Error(String(error));
						console.error(
							`  > \x1b[31mFailed to delete\x1b[0m ${path.relative(PROJECT_ROOT, file)}: ${err.message}`,
						);
					}
				}
				console.log(`  > \x1b[32mDeleted ${deletedCount} .bak files.\x1b[0m`);
			}
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

	public configure(cmd: CommanderCommand): void {
		cmd.option('--fix', 'Automatically remove unused keys');
		cmd.option('--clean', 'Remove .bak files generated by --fix');
	}
}
