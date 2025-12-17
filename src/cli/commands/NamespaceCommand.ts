/**
 * 🏷️ JSDoc Namespace Automator
 *
 * @file src/cli/commands/NamespaceCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.3-beta
 *
 * @description
 * Scans the entire project structure and automatically adds or updates
 * JSDoc `@namespace` headers to ensure code documentation consistency.
 * Detects file types (Command, Model, Event) based on directory context.
 *
 * ✨ Core Features:
 * -  Smart Detection: Infers `@type` from folder names (commands, events, etc).
 * -  Recursive Scan: Processes nested directories including addons.
 * -  Safe Update: Updates headers without touching code logic.
 */

import Command from '../Command';
import path from 'node:path';
import pc from 'picocolors';
import fs from 'node:fs';

export default class NamespaceCommand extends Command {
	public signature = 'dev:namespace';
	public description =
		'Add or update JSDoc @namespace headers in command files';

	public async handle(): Promise<void> {
		console.log(pc.cyan('🚀 Starting namespace annotation process...'));
		const rootDir = process.cwd();

		function findJsFilesRecursive(dir: string): string[] {
			let results: string[] = [];
			if (!fs.existsSync(dir)) return results;
			const list = fs.readdirSync(dir, { withFileTypes: true });
			for (const file of list) {
				if (file.name === 'node_modules' || file.name === '.git') continue;
				const fullPath = path.join(dir, file.name);
				if (file.isDirectory()) {
					results = results.concat(findJsFilesRecursive(fullPath));
				} else if (file.name.endsWith('.js') || file.name.endsWith('.ts')) {
					results.push(fullPath);
				}
			}
			return results;
		}

		function getFileType(filePath: string): string {
			const fileName = path.basename(filePath);
			const parentDirName = path.basename(path.dirname(filePath));
			const grandParentDirName = path.basename(
				path.dirname(path.dirname(filePath)),
			);

			if (fileName === '_command.js' || fileName === '_command.ts')
				return 'Command Group Definition';
			if (fileName === '_group.js' || fileName === '_group.ts')
				return 'Subcommand Group Definition';
			if (parentDirName === 'commands' || grandParentDirName === 'commands')
				return 'Command';
			if (parentDirName === 'events') return 'Event Handler';
			if (parentDirName === 'helpers') return 'Helper Script';
			if (parentDirName === 'models') return 'Database Model';
			if (parentDirName === 'migrations') return 'Database Migration';
			if (parentDirName === 'tasks') return 'Scheduled Task';
			return 'Module';
		}

		let filesToProcess: string[] = [];

		const addonsPath = path.join(rootDir, 'addons');
		if (fs.existsSync(addonsPath)) {
			console.log(pc.dim('🔎 Scanning addons...'));
			filesToProcess = filesToProcess.concat(findJsFilesRecursive(addonsPath));
		}

		const pkg = require(path.join(rootDir, 'package.json'));
		const currentYear = new Date().getFullYear();

		filesToProcess.forEach((filePath) => {
			const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
			const fileType = getFileType(filePath);

			const newHeader = `/**
 * @namespace: ${relativePath}
 * @type: ${fileType}
 * @copyright © ${currentYear} kenndeclouv
 * @assistant chaa & graa
 * @version ${pkg.version}
 */`;

			const content = fs.readFileSync(filePath, 'utf8');
			const headerRegex = /\/\*\*[\s\S]*?namespace:[\s\S]*?\*\//;

			let newContent: any;
			if (headerRegex.test(content)) {
				newContent = content.replace(headerRegex, newHeader.trim());
			} else {
				newContent = `${newHeader}\n\n${content}`;
			}

			if (newContent.trim() !== content.trim()) {
				fs.writeFileSync(filePath, newContent, 'utf8');
				console.log(pc.green(`🔄 Updated: ${relativePath}`));
			}
		});

		console.log(pc.green('\n✅ Namespace annotation complete!'));
	}
}
