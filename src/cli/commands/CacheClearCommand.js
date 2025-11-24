/**
 * @namespace: src/cli/commands/CacheClearCommand.js
 * @type: Command
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.12-beta
 */

const pc = require('picocolors');
const readline = require('node:readline');
const Redis = require('ioredis');
require('@dotenvx/dotenvx/config'); // Load .env langsung

// Helper buat input user
function askQuestion(query) {
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

module.exports = {
	async execute(options) {
		console.log(pc.dim('🔍 Detecting Redis configuration...'));

		const redisUrlsRaw = process.env.REDIS_URLS;

		if (!redisUrlsRaw) {
			console.error(pc.red('❌ REDIS_URLS not found in .env'));
			process.exit(1);
		}

		// Parsing comma-separated URLs
		const urls = redisUrlsRaw
			.split(',')
			.map((u) => u.trim())
			.filter((u) => u.length > 0);

		if (urls.length === 0) {
			console.error(pc.red('❌ No valid Redis URLs found.'));
			process.exit(1);
		}

		let targets = [];

		// Kalau cuma 1 URL, langsung sikat (dengan konfirmasi)
		if (urls.length === 1) {
			targets = [urls[0]];
			console.log(pc.cyan(`🎯 Target: ${targets[0]}`));
		} else {
			// Kalau Multi URL, tanya user
			console.log(
				pc.yellow(`⚠️  Multiple Redis instances detected (${urls.length}):`),
			);
			console.log(
				pc.dim('---------------------------------------------------'),
			);
			console.log(`0. ${pc.bgRed(pc.white(' FLUSH ALL INSTANCES '))}`);
			urls.forEach((url, index) => {
				// Masking password biar aman di console
				const maskedUrl = url.replace(/:([^@]+)@/, ':****@');
				console.log(`${index + 1}. ${maskedUrl}`);
			});
			console.log(
				pc.dim('---------------------------------------------------'),
			);

			const answer = await askQuestion(
				pc.cyan('Select target to flush (number): '),
			);
			const choice = parseInt(answer);

			if (isNaN(choice) || choice < 0 || choice > urls.length) {
				console.error(pc.red('❌ Invalid selection.'));
				process.exit(1);
			}

			if (choice === 0) {
				targets = urls; // Sikat semua
			} else {
				targets = [urls[choice - 1]]; // Sikat spesifik
			}
		}

		// Konfirmasi terakhir (Nuclear Launch Key)
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

		// Eksekusi Flush
		console.log('');
		for (const url of targets) {
			const masked = url.replace(/:([^@]+)@/, ':****@');
			try {
				console.log(pc.dim(`🔌 Connecting to ${masked}...`));
				const redis = new Redis(url, {
					maxRetriesPerRequest: 1,
					retryStrategy: null, // Gak usah retry kalau mati, langsung error aja
				});

				await redis.flushall();
				console.log(pc.green(`✅ FLUSHALL Success: ${masked}`));

				redis.quit();
			} catch (err) {
				console.error(pc.red(`❌ Failed to flush ${masked}: ${err.message}`));
			}
		}

		console.log(pc.green('\n✨ Cache clearing process completed.'));
		process.exit(0);
	},
};
