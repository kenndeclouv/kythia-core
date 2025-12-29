#!/usr/bin/env node

/**
 * ⚡ Kythia CLI Entry Point
 *
 * @file src/cli/index.js
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.8-beta
 *
 * @description
 * The main bootstrap entry point for the Kythia CLI.
 * It dynamically scans, loads, and registers all command classes found in the
 * `commands` directory, orchestrating the `commander` program execution.
 *
 * ✨ Core Features:
 * -  Dynamic Loading: Automatically finds new commands without manual import.
 * -  Class-Based Architecture: Supports standard `Command` class structure.
 * -  Error Handling: Gracefully handles malformed commands during boot.
 */

import { Command } from 'commander';
import BaseCommand from './Command';
import path from 'node:path';
import fs from 'node:fs';

const pc = require('picocolors');

const { version } = require('../../package.json');

const program = new Command();

program
	.name('kythia')
	.description(pc.cyan('🌸 Kythia Framework CLI'))
	.version(version);

const commandsDir = path.join(__dirname, 'commands');

if (fs.existsSync(commandsDir)) {
	const commandFiles = fs
		.readdirSync(commandsDir)

		.filter(
			(file) =>
				(file.endsWith('.js') || file.endsWith('.ts')) &&
				!file.endsWith('.d.ts'),
		);

	for (const file of commandFiles) {
		const filePath = path.join(commandsDir, file);
		try {
			const moduleExport = require(filePath);

			const CommandClass = moduleExport.default || moduleExport;

			if (
				typeof CommandClass === 'function' &&
				CommandClass.prototype instanceof BaseCommand
			) {
				const commandInstance = new CommandClass();
				commandInstance.register(program);
			} else if (typeof CommandClass.register === 'function') {
				CommandClass.register(program);
			}
		} catch (err) {
			console.error(pc.red(`❌ Failed to load command ${file}:`), err);
		}
	}
}

program.parse(process.argv);
