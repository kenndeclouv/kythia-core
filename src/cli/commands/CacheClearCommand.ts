/**
 * 🧹 Redis Cache Flusher
 *
 * @file src/cli/commands/CacheClearCommand.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.7-beta
 *
 * @description
 * Interactive utility to flush Redis cache. Supports intelligent handling of
 * multiple Redis instances defined in environment variables.
 *
 * ✨ Core Features:
 * -  Multi-Target: Detects and lists all Redis URLs from config.
 * -  Safety First: Requires explicit confirmation before flushing.
 * -  Target Selection: Allows flushing specific instances or all at once.
 */

import { config } from '@dotenvx/dotenvx';
import readline from 'node:readline';
import Command from '../Command';
import pc from 'picocolors';
import Redis from 'ioredis';

config({
	quiet: true,
});

function askQuestion(query: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise((resolve) =>
		rl.question(query, (ans) => {
			rl.close();
			resolve(ans);
		}),
	);
}

export default class CacheClearCommand extends Command {
	public signature = 'cache:clear';
	public description = 'Flush Redis cache (supports multi-instance selection)';

	public async handle(): Promise<void> {
		console.log(pc.dim('🔍 Detecting Redis configuration...'));

		const redisUrlsRaw = process.env.REDIS_URLS;

		if (!redisUrlsRaw) {
			console.error(pc.red('❌ REDIS_URLS not found in .env'));
			process.exit(1);
		}

		const urls = redisUrlsRaw
			.split(',')
			.map((u) => u.trim())
			.filter((u) => u.length > 0);

		if (urls.length === 0) {
			console.error(pc.red('❌ No valid Redis URLs found.'));
			process.exit(1);
		}

		let targets: string[] = [];

		if (urls.length === 1) {
			targets = [urls[0]];
			console.log(pc.cyan(`🎯 Target: ${targets[0]}`));
		} else {
			console.log(
				pc.yellow(`⚠️  Multiple Redis instances detected (${urls.length}):`),
			);
			console.log(
				pc.dim('---------------------------------------------------'),
			);
			console.log(`0. ${pc.bgRed(pc.white(' FLUSH ALL INSTANCES '))}`);
			urls.forEach((url, index) => {
				const maskedUrl = url.replace(/:([^@]+)@/, ':****@');
				console.log(`${index + 1}. ${maskedUrl}`);
			});
			console.log(
				pc.dim('---------------------------------------------------'),
			);

			const answer = await askQuestion(
				pc.cyan('Select target to flush (number): '),
			);
			const choice = parseInt(answer, 10);

			if (Number.isNaN(choice) || choice < 0 || choice > urls.length) {
				console.error(pc.red('❌ Invalid selection.'));
				process.exit(1);
			}

			if (choice === 0) {
				targets = urls;
			} else {
				targets = [urls[choice - 1]];
			}
		}

		const confirm = await askQuestion(
			pc.bgRed(pc.white(' DANGER ')) +
				pc.yellow(
					` Are you sure you want to FLUSHALL ${targets.length} instance(s)? (y/n): `,
				),
		);

		if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
			console.log(pc.cyan('🛡️  Operation cancelled.'));
			process.exit(0);
		}

		console.log('');
		for (const url of targets) {
			const masked = url.replace(/:([^@]+)@/, ':****@');
			try {
				console.log(pc.dim(`🔌 Connecting to ${masked}...`));
				const redis = new Redis(url, {
					maxRetriesPerRequest: 1,
					retryStrategy: () => null,
				});

				await redis.flushall();
				console.log(pc.green(`✅ FLUSHALL Success: ${masked}`));

				redis.quit();
			} catch (err: any) {
				console.error(pc.red(`❌ Failed to flush ${masked}: ${err.message}`));
			}
		}

		console.log(pc.green('\n✨ Cache clearing process completed.'));
		process.exit(0);
	}
}
