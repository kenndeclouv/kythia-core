/**
 * 🗺️ Project Structure Mapper
 *
 * @file src/cli/commands/StructureCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.3-beta
 *
 * @description
 * Generates a markdown tree representation of the entire project directory.
 * Useful for documentation and providing context to AI assistants.
 *
 * ✨ Core Features:
 * -  Clean Output: Excludes noise (`node_modules`, `.git`).
 * -  Format: Outputs standardized tree syntax to `temp/structure.md`.
 */

import Command from '../Command';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export default class StructureCommand extends Command {
	public signature = 'gen:structure';
	public description = 'Generate project structure to temp/structure.md';

	public async handle(): Promise<void> {
		const rootDir = process.cwd();
		const outputDir = path.join(rootDir, 'temp');
		const outputFile = path.join(outputDir, 'structure.md');
		const exclude = [
			'.git',
			'.vscode',
			'node_modules',
			'dist',
			'logs',
			'.husky',
			'.yalc',
		];

		function generateTree(dir: string, prefix = ''): string {
			const items = fs
				.readdirSync(dir)
				.filter((item) => !exclude.includes(item));
			let tree = '';

			items.forEach((item, index) => {
				const fullPath = path.join(dir, item);
				const isLast = index === items.length - 1;
				const connector = isLast ? '└── ' : '├── ';
				tree += `${prefix}${connector}${item}\n`;

				if (fs.statSync(fullPath).isDirectory()) {
					tree += generateTree(fullPath, prefix + (isLast ? '    ' : '│   '));
				}
			});
			return tree;
		}

		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const tree = generateTree(rootDir);
		fs.writeFileSync(outputFile, tree, 'utf8');
		console.log(pc.green(`✅ Project structure saved to: ${outputFile}`));
	}
}
