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

const { version } = require('../../package.json');
const { Command } = require('commander');
const BaseCommand = require('./Command');
const path = require('node:path');
const pc = require('picocolors');
const fs = require('node:fs');

const program = new Command();

program
	.name('kythia')
	.description(pc.cyan('🌸 Kythia Framework CLI'))
	.version(version);

const commandsDir = path.join(__dirname, 'commands');

if (fs.existsSync(commandsDir)) {
	const commandFiles = fs
		.readdirSync(commandsDir)
		.filter((file) => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsDir, file);
		try {
			const CommandClass = require(filePath);

			if (
				typeof CommandClass === 'function' &&
				CommandClass.prototype instanceof BaseCommand
			) {
				const commandInstance = new CommandClass();
				commandInstance.register(program);
			} else if (typeof CommandClass.register === 'function') {
				CommandClass.register(program);
			} else {
				console.warn(
					pc.yellow(
						`⚠️  Skipped ${file}: Not a valid Command class or missing 'register' function.`,
					),
				);
			}
		} catch (err) {
			console.error(pc.red(`❌ Failed to load command ${file}:`), err);
		}
	}
}

program.parse(process.argv);
