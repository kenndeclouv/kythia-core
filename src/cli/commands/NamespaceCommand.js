/**
 * 🏷️ JSDoc Namespace Automator
 *
 * @file src/cli/commands/NamespaceCommand.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
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

const Command = require('../Command');
const path = require('node:path');
const pc = require('picocolors');
const fs = require('node:fs');

class NamespaceCommand extends Command {
	signature = 'dev:namespace';
	description = 'Add or update JSDoc @namespace headers in command files';

	async handle() {
		console.log(pc.cyan('🚀 Starting namespace annotation process...'));
		const rootDir = process.cwd();

		// Helper: Find Files Recursive
		function findJsFilesRecursive(dir) {
			let results = [];
			if (!fs.existsSync(dir)) return results;
			const list = fs.readdirSync(dir, { withFileTypes: true });
			for (const file of list) {
				if (file.name === 'node_modules' || file.name === '.git') continue;
				const fullPath = path.join(dir, file.name);
				if (file.isDirectory()) {
					results = results.concat(findJsFilesRecursive(fullPath));
				} else if (file.name.endsWith('.js')) {
					results.push(fullPath);
				}
			}
			return results;
		}

		function getFileType(filePath) {
			const fileName = path.basename(filePath);
			const parentDirName = path.basename(path.dirname(filePath));
			const grandParentDirName = path.basename(
				path.dirname(path.dirname(filePath)),
			);

			if (fileName === '_command.js') return 'Command Group Definition';
			if (fileName === '_group.js') return 'Subcommand Group Definition';
			if (parentDirName === 'commands' || grandParentDirName === 'commands')
				return 'Command';
			if (parentDirName === 'events') return 'Event Handler';
			if (parentDirName === 'helpers') return 'Helper Script';
			if (parentDirName === 'models') return 'Database Model';
			if (parentDirName === 'migrations') return 'Database Migration';
			if (parentDirName === 'tasks') return 'Scheduled Task';
			return 'Module';
		}

		let filesToProcess = [];

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

			let newContent;
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

module.exports = NamespaceCommand;
