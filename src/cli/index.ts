#!/usr/bin/env node

/**
 * ⚡ Kythia CLI Entry Point
 *
 * @file src/cli/index.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pc = require('picocolors');

// Load package.json aman pake require
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
		// 👇 Filter .d.ts biar gak error kayak middleware tadi
		.filter(
			(file) =>
				(file.endsWith('.js') || file.endsWith('.ts')) &&
				!file.endsWith('.d.ts'),
		);

	for (const file of commandFiles) {
		const filePath = path.join(commandsDir, file);
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const moduleExport = require(filePath);

			// Support Default Export (TS) & Module Exports (JS)
			const CommandClass = moduleExport.default || moduleExport;

			// Cek apakah dia turunan dari BaseCommand
			if (
				typeof CommandClass === 'function' &&
				CommandClass.prototype instanceof BaseCommand
			) {
				const commandInstance = new CommandClass();
				commandInstance.register(program);
			} else if (typeof CommandClass.register === 'function') {
				// Support static register method (legacy)
				CommandClass.register(program);
			}
		} catch (err) {
			console.error(pc.red(`❌ Failed to load command ${file}:`), err);
		}
	}
}

program.parse(process.argv);
