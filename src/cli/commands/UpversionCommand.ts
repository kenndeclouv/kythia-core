/**
 * 🆙 Semantic Version Bumper
 *
 * @file src/cli/commands/UpversionCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.5-beta
 *
 * @description
 * Synchronizes the `@version` tag in all JSDoc headers across the project
 * to match the version defined in `package.json`.
 *
 * ✨ Core Features:
 * -  Mass Update: Updates hundreds of files in seconds.
 * -  Regex Powered: Accurately targets version tags without affecting other code.
 * -  Safety: Ignores sensitive folders like `node_modules` and `.git`.
 */

import Command from '../Command';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export default class UpversionCommand extends Command {
	public signature = 'version:up';
	public description = 'Update @version in JSDoc headers to match package.json';

	public async handle(): Promise<void> {
		const rootDir = process.cwd();
		const pkgPath = path.join(rootDir, 'package.json');

		if (!fs.existsSync(pkgPath)) {
			console.error(pc.red('❌ package.json not found!'));
			process.exit(1);
		}

		const pkg = require(pkgPath);
		const version = pkg.version;
		console.log(pc.cyan(`✨ Using version from package.json: ${version}`));

		const ignoredPaths = [
			'node_modules',
			'.git',
			'.env',
			'dist',
			'obfuscate.js',
			'.yalc',
		];

		function getAllJsFiles(dir: string, fileList: string[] = []): string[] {
			const files = fs.readdirSync(dir);
			files.forEach((file) => {
				const fullPath = path.join(dir, file);
				if (ignoredPaths.includes(path.basename(fullPath))) return;

				const stat = fs.statSync(fullPath);
				if (stat.isDirectory()) {
					getAllJsFiles(fullPath, fileList);
				} else if (file.endsWith('.js') || file.endsWith('.ts')) {
					fileList.push(fullPath);
				}
			});
			return fileList;
		}

		const jsFiles = getAllJsFiles(rootDir);
		const versionRegex = /(@version\s+)v?[\d.\-a-zA-Z]+/g;
		let updatedCount = 0;

		jsFiles.forEach((file) => {
			try {
				const originalContent = fs.readFileSync(file, 'utf8');
				const newContent = originalContent.replace(
					versionRegex,
					`$1${version}`,
				);

				if (originalContent !== newContent) {
					fs.writeFileSync(file, newContent, 'utf8');
					console.log(pc.green(`✅ Updated: ${path.relative(rootDir, file)}`));
					updatedCount++;
				}
			} catch (err: any) {
				console.error(pc.red(`❌ Failed to process: ${file}`), err.message);
			}
		});

		console.log(
			pc.green(`\n🎉 Version update complete! (${updatedCount} files changed)`),
		);
	}
}
