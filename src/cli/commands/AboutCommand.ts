/**
 * 🌸 About Kythia Core
 *
 * @file src/cli/commands/AboutCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.6-beta
 *
 * @description
 * Display system architecture and runtime telemetry.
 *
 */

import pkg from '../../../package.json';
import Command from '../Command';
import pc from 'picocolors';
import figlet from 'figlet';
import os from 'node:os';

export default class AboutCommand extends Command {
	public signature = 'about';
	public description = 'Display system architecture and runtime telemetry';

	public async handle(): Promise<void> {
		const figletText = (text: string, opts: figlet.FigletOptions) =>
			new Promise<string>((resolve, reject) => {
				figlet.text(
					text,
					opts,
					(err: Error | null, data: string | undefined) => {
						if (err) {
							reject(err);
						} else {
							resolve(data || '');
						}
					},
				);
			});

		const data = await figletText('KYTHIA', {
			font: 'ANSI Shadow',
			horizontalLayout: 'full',
			verticalLayout: 'full',
		});
		console.log('');
		console.log(pc.cyan(data));

		// 2. The Manifesto
		console.log(pc.bold(pc.white(' A MODULAR ORCHESTRATION ENGINE')));
		console.log(
			pc.dim(
				' ────────────────────────────────────────────────────────────────────────',
			),
		);
		console.log(
			pc.gray(
				' Kythia is an advanced, high-performance automation framework designed\n' +
					' for seamless Discord integration. Built on a reactive event-driven\n' +
					' architecture, it bridges the gap between raw efficiency and developer\n' +
					' experience. Featuring dynamic addon injection, smart resource governance,\n' +
					' and a robust ORM layer for scalable data management.',
			),
		);
		console.log(
			pc.dim(
				' ────────────────────────────────────────────────────────────────────────\n',
			),
		);

		// 3. Metadata Grid
		const pad = (str: string, width = 16) => str.padEnd(width);

		const version = pkg.version;

		console.log(pc.cyan(' ⚙️  SYSTEM METADATA'));
		console.log(
			`    ${pc.blue('●')} ${pad('Version')}          : ${pc.green(version)}`,
		);
		console.log(
			`    ${pc.blue('●')} ${pad('Engineered')}          : ${pc.white('kenndeclouv')}`,
		);
		console.log(
			`    ${pc.blue('●')} ${pad('Assistants')}          : ${pc.magenta('graa & chaa')}`,
		);
		console.log(
			`    ${pc.blue('●')} ${pad('License')}          : ${pc.dim('CC BY-NC 4.0')}`,
		);
		console.log('');

		// 4. Core Features
		console.log(pc.cyan(' 🎯 CORE FEATURES'));
		console.log(
			`    ${pc.green('✓')} Modular Addon System      - Dynamic feature loading`,
		);
		console.log(
			`    ${pc.green('✓')} Dependency Injection      - Advanced IoC container`,
		);
		console.log(
			`    ${pc.green('✓')} Database Abstraction      - SQLite, MySQL, PostgreSQL`,
		);
		console.log(
			`    ${pc.green('✓')} i18n Support              - Multi-language translations`,
		);
		console.log(
			`    ${pc.green('✓')} Middleware Pipeline       - Request processing & validation`,
		);
		console.log(
			`    ${pc.green('✓')} Event Management          - Sophisticated event routing`,
		);
		console.log(
			`    ${pc.green('✓')} Interaction Handlers      - Commands, buttons, modals, menus`,
		);
		console.log(
			`    ${pc.green('✓')} Telemetry & Monitoring    - Built-in observability`,
		);
		console.log(
			`    ${pc.green('✓')} Redis Caching             - Performance optimization`,
		);
		console.log(
			`    ${pc.green('✓')} Graceful Shutdown         - Safe process termination`,
		);
		console.log('');

		// 5. Architecture Components
		console.log(pc.magenta(' 🏗️  ARCHITECTURE COMPONENTS'));
		console.log(
			`    ${pc.dim('├─')} AddonManager             - Dynamic module orchestration`,
		);
		console.log(
			`    ${pc.dim('├─')} InteractionManager       - Discord interaction routing`,
		);
		console.log(
			`    ${pc.dim('├─')} EventManager             - Gateway event distribution`,
		);
		console.log(
			`    ${pc.dim('├─')} TranslatorManager        - Locale & i18n handling`,
		);
		console.log(
			`    ${pc.dim('├─')} MiddlewareManager        - Request preprocessing pipeline`,
		);
		console.log(
			`    ${pc.dim('├─')} TelemetryManager         - Metrics & license verification`,
		);
		console.log(
			`    ${pc.dim('├─')} ShutdownManager          - Process lifecycle governance`,
		);
		console.log(
			`    ${pc.dim('└─')} KythiaMigrator           - Database schema migration`,
		);
		console.log('');

		// 6. Database Support
		console.log(pc.yellow(' 🗄️  DATABASE SUPPORT'));
		console.log(
			`    ${pc.dim('•')} SQLite                    - Lightweight, zero-config (default)`,
		);
		console.log(
			`    ${pc.dim('•')} MySQL                     - Production-ready relational DB`,
		);
		console.log(
			`    ${pc.dim('•')} PostgreSQL                - Advanced features & scalability`,
		);
		console.log(
			`    ${pc.dim('•')} Sequelize                 - Powerful ORM with migrations`,
		);
		console.log(
			`    ${pc.dim('•')} KythiaModel               - Enhanced base model with caching`,
		);
		console.log('');

		// 7. Technology Stack
		console.log(pc.blue(' 🔧 TECHNOLOGY STACK'));
		console.log(
			`    ${pad('Runtime')}            : Node.js ${process.version}`,
		);
		console.log(`    ${pad('Language')}            : TypeScript (ES2020+)`);
		console.log(`    ${pad('Discord Client')}            : discord.js v14`);
		console.log(`    ${pad('ORM')}            : Sequelize`);
		console.log(`    ${pad('Cache')}            : Redis (optional)`);
		console.log(`    ${pad('Error Tracking')}            : Sentry (optional)`);
		console.log(
			`    ${pad('CLI Framework')}            : Custom Commander-based`,
		);
		console.log('');

		// 8. Runtime Telemetry
		const uptime = (process.uptime() / 60).toFixed(2);
		const memory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
		const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
		const heapTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(
			2,
		);

		console.log(pc.green(' 📊 RUNTIME TELEMETRY'));
		console.log(
			`    ${pad('OS Platform')}            : ${os.type()} ${os.release()} (${os.arch()})`,
		);
		console.log(
			`    ${pad('CPU Cores')}            : ${os.cpus().length} cores`,
		);
		console.log(
			`    ${pad('Total Memory')}            : ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
		);
		console.log(
			`    ${pad('Free Memory')}            : ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
		);
		console.log(`    ${pad('Process RSS')}            : ${memory} MB`);
		console.log(
			`    ${pad('Heap Used')}            : ${heapUsed} MB / ${heapTotal} MB`,
		);
		console.log(`    ${pad('Process PID')}            : ${process.pid}`);
		console.log(`    ${pad('Session Time')}            : ${uptime} min`);
		console.log(`    ${pad('Working Dir')}            : ${process.cwd()}`);
		console.log('');

		// 9. Community & Resources
		console.log(pc.cyan(' 🌐 COMMUNITY & RESOURCES'));
		console.log(
			`    ${pc.dim('●')} Website                   : ${pc.underline('https://kythia.me')}`,
		);
		console.log(
			`    ${pc.dim('●')} Discord                   : ${pc.underline('https://dsc.gg/kythia')}`,
		);
		console.log(
			`    ${pc.dim('●')} GitHub                    : ${pc.underline('https://github.com/kythia/kythia')}`,
		);
		console.log(
			`    ${pc.dim('●')} Documentation             : ${pc.underline('https://docs.kythia.me')}`,
		);
		console.log(
			`    ${pc.dim('●')} Support                   : ${pc.underline('kythiadev@gmail.com')}`,
		);
		console.log('');

		console.log(
			pc.dim(
				' ────────────────────────────────────────────────────────────────────────',
			),
		);
		console.log(
			pc.yellow(
				' ⚡ Built for scale. Designed for developers. Powered by passion.',
			),
		);
		console.log(
			pc.dim(
				' ────────────────────────────────────────────────────────────────────────\n',
			),
		);
	}
}
