/**
 * 👻 The Ghost Writer (Translation Syncer)
 *
 * @file src/cli/commands/LangSyncCommand.ts
 * @copyright © 2025 kenndeclouv
 * @version 0.12.2-beta
 *
 * @description
 * Scans codebase for t() calls using robust AST analysis (matching LangCheck).
 * If a key is missing in local en.json AND missing in kythia-core,
 * it automatically adds it with "__MISSING__".
 */

import Command from '../Command';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';

function setNestedValue(obj: any, pathStr: string, value: string) {
	const parts = pathStr.split('.');
	let current = obj;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (!current[part] || typeof current[part] !== 'object') {
			current[part] = {};
		}
		current = current[part];
	}

	const lastPart = parts[parts.length - 1];

	if (!Object.hasOwn(current, lastPart)) {
		current[lastPart] = value;
		return true;
	}
	return false;
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
		)
			return false;
		current = current[part];
	}
	return true;
}

export default class LangSyncCommand extends Command {
	public signature = 'lang:sync';
	public description = 'Auto-fill missing translation keys into en.json files.';

	public async handle(): Promise<void> {
		const PROJECT_ROOT = process.cwd();
		const DEFAULT_LANG = 'en';

		console.log('--- 👻 Kythia Ghost Writer (Lang Sync) ---');
		console.log('Scanning codebase for new keys (Robust Mode)...');

		const usedStaticKeys = new Set<string>();
		const usedDynamicKeys = new Set<string>();
		let filesScanned = 0;

		const SCAN_DIRECTORIES = ['addons', 'src'];
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
						CallExpression(nodePath: NodePath<any>) {
							const node = nodePath.node;
							if (
								node.callee.type === 'Identifier' &&
								node.callee.name === 't'
							) {
								if (node.arguments.length >= 2) {
									const keyArg = node.arguments[1];
									analyzeArg(keyArg);
								}
							}
						},
					});

					function analyzeArg(node: any) {
						if (node.type === 'StringLiteral') {
							usedStaticKeys.add(node.value);
							return;
						}

						if (node.type === 'TemplateLiteral') {
							if (node.quasis.length === 1 && node.expressions.length === 0) {
								usedStaticKeys.add(node.quasis[0].value.raw);
								return;
							}

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
							if (
								node.left.type === 'StringLiteral' &&
								node.right.type === 'StringLiteral'
							) {
								usedStaticKeys.add(node.left.value + node.right.value);
							} else if (node.left.type === 'StringLiteral') {
								usedDynamicKeys.add(`${node.left.value}*`);
							} else if (node.right.type === 'StringLiteral') {
								usedDynamicKeys.add(`*${node.right.value}`);
							}
							return;
						}

						if (node.type === 'ConditionalExpression') {
							analyzeArg(node.consequent);
							analyzeArg(node.alternate);
							return;
						}
					}
				} catch (_e) {}
			});
		});

		console.log(
			`\nScan complete. Found ${usedStaticKeys.size} unique static keys.`,
		);
		if (usedDynamicKeys.size > 0) {
			console.log(
				`(Ignored ${usedDynamicKeys.size} dynamic key patterns for auto-sync)`,
			);
		}

		let coreLang = {};
		try {
			const coreLangPath = path.join(
				PROJECT_ROOT,
				'node_modules/kythia-core/src/lang',
				`${DEFAULT_LANG}.json`,
			);
			if (fs.existsSync(coreLangPath)) {
				coreLang = JSON.parse(fs.readFileSync(coreLangPath, 'utf8'));
				console.log(`  > Loaded Core definitions from kythia-core.`);
			}
		} catch (e) {
			console.warn(`  > ⚠️ Could not load kythia-core definitions.`);
			console.error(e);
		}

		const addonMap: Record<string, string> = {};
		const rootLangPath = path.join(
			PROJECT_ROOT,
			'lang',
			`${DEFAULT_LANG}.json`,
		);
		const srcLangPath = path.join(
			PROJECT_ROOT,
			'src',
			'lang',
			`${DEFAULT_LANG}.json`,
		);

		let defaultPath = fs.existsSync(rootLangPath) ? rootLangPath : srcLangPath;
		if (!fs.existsSync(defaultPath)) {
			if (!fs.existsSync(path.join(PROJECT_ROOT, 'lang')))
				fs.mkdirSync(path.join(PROJECT_ROOT, 'lang'));
			fs.writeFileSync(rootLangPath, '{}');
			defaultPath = rootLangPath;
		}

		const addonFiles = glob.sync(`addons/**/lang/${DEFAULT_LANG}.json`, {
			cwd: PROJECT_ROOT,
			absolute: true,
		});
		addonFiles.forEach((file) => {
			const match = file.match(/addons[\\/]([^\\/]+)[\\/]lang/);
			if (match?.[1]) {
				addonMap[match[1]] = file;
			}
		});

		const changes: Record<string, number> = {};

		for (const key of usedStaticKeys) {
			if (hasNestedKey(coreLang, key)) {
				continue;
			}

			const parts = key.split('.');
			const prefix = parts[0];

			let targetFile = defaultPath;

			if (addonMap[prefix]) {
				targetFile = addonMap[prefix];
			}

			let content = {};
			try {
				if (fs.existsSync(targetFile)) {
					content = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
				}
			} catch (_e) {}

			if (!hasNestedKey(content, key)) {
				if (setNestedValue(content, key, '__MISSING__')) {
					fs.writeFileSync(targetFile, JSON.stringify(content, null, '\t'));

					if (!changes[targetFile]) changes[targetFile] = 0;
					changes[targetFile]++;
				}
			}
		}

		console.log('\n--- Sync Report ---');
		const changedFiles = Object.keys(changes);
		if (changedFiles.length > 0) {
			changedFiles.forEach((file) => {
				console.log(
					`📝 ${path.relative(PROJECT_ROOT, file)}: +${changes[file]} new keys`,
				);
			});
			console.log(
				`\n\x1b[32m✨ Done! Search for "__MISSING__" in your JSON files to fill translations.\x1b[0m`,
			);
		} else {
			console.log(`\n✅ Everything is in sync! No missing keys found.`);
		}
	}
}
