/**
 * 📄 Logger
 *
 * @file src/utils/logger.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
 *
 * @description
 * Colorized and enhanced logger for the Discord bot.
 * Prints readable, color-coded logs to the console and writes structured logs
 * to rotated files. Includes helpers to flush and exit safely, and captures
 * unhandled exceptions/rejections.
 *
 * - Distinct colors per level (console)
 * - Optional timestamp formatting per config
 * - Daily rotating log files for combined and error logs
 * - Flush-and-exit helper to ensure all logs are written
 */
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('node:path');
const fs = require('node:fs');
const clc = require('cli-color');
const logDir = 'logs';
const configPath = path.resolve(process.cwd(), 'kythia.config.js');

if (!fs.existsSync(configPath)) {
	console.error('❌ kythia.config.js not found in root directory!');
	process.exit(1);
}

const kythiaConfig = require(configPath);

if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir);
}

const isProduction = kythiaConfig.env === 'production';

const levelColors = {
	error: clc.bgRed.whiteBright.bold,
	warn: clc.bgYellow.black.bold,
	info: clc.bgCyan.black.bold,
	debug: clc.bgMagenta.white.bold,
	silly: clc.bgBlue.white,
	verbose: clc.bgGreen.black,
	default: clc.bgWhite.black,
};

const messageColors = {
	error: clc.redBright,
	warn: clc.yellowBright,
	info: clc.white,
	debug: clc.magentaBright,
	silly: clc.blueBright,
	verbose: clc.greenBright,
	default: clc.white,
};

const consoleLevelFilter = winston.format((info, opts) => {
	// Show if 'all' or if the level is included in the configured list
	if (opts.mode === 'all' || opts.levels.includes(info.level)) {
		return info;
	}
	return false;
});

// Collect console formatters based on config
const consoleFormatters = [];

// Optionally include timestamp unless the config disables it with 'none'
if (kythiaConfig.settings.logFormat !== 'none') {
	consoleFormatters.push(
		winston.format.timestamp({
			format: kythiaConfig.settings.logFormat || 'HH:mm:ss',
		}),
	);
}

// Core formatters (printf etc.)
consoleFormatters.push(
	winston.format.splat(),
	winston.format.printf(({ level, message, timestamp, label }) => {
		const levelKey = level in levelColors ? level : 'default';
		const msgKey = level in messageColors ? level : 'default';

		const levelLabel = levelColors[levelKey](` ${level.toUpperCase()} `);

		// Timestamp is optional depending on config
		const timeLabel = timestamp ? clc.blackBright(timestamp) : '';
		const categoryLabel = label ? clc.bgYellow.black.bold(` ${label} `) : '';

		let msg;
		if (typeof message === 'object' && message !== null) {
			msg = messageColors[msgKey](JSON.stringify(message, null, 2));
		} else {
			msg = messageColors[msgKey](message);
		}

		// Trim to remove extra spaces when timestamp is omitted
		return `${timeLabel} ${categoryLabel}${levelLabel} ${msg}`.trim();
	}),
);

// Terakhir, gabungkan semua formatters yang sudah kita kumpulkan di array
const colorConsoleFormat = winston.format.combine(...consoleFormatters);

const logger = winston.createLogger({
	level: isProduction ? 'info' : 'debug',
	transports: [
		new winston.transports.Console({
			// Run our filter BEFORE the color formatter
			format: winston.format.combine(
				// Pass through only configured levels (or 'all')
				consoleLevelFilter({
					// Convert "info,warn" into ["info", "warn"]; default to 'all'
					levels: (kythiaConfig.settings.logConsoleFilter || 'all')
						.split(',')
						.map((l) => l.trim()),
					mode: kythiaConfig.settings.logConsoleFilter || 'all',
				}),
				// After filtering, apply color formatting
				colorConsoleFormat,
			),
		}),

		new winston.transports.DailyRotateFile({
			level: 'info',
			filename: path.join(logDir, '%DATE%-combined.log'),
			datePattern: 'YYYY-MM-DD',
			zippedArchive: true,
			maxSize: '20m',
			maxFiles: '14d',
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json(),
			),
		}),
		new winston.transports.DailyRotateFile({
			level: 'error',
			filename: path.join(logDir, '%DATE%-error.log'),
			datePattern: 'YYYY-MM-DD',
			zippedArchive: true,
			maxSize: '20m',
			maxFiles: '30d',
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json(),
			),
		}),
	],
	exceptionHandlers: [
		new winston.transports.File({
			filename: path.join(logDir, 'exceptions.log'),
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json(),
			),
		}),
	],
	rejectionHandlers: [
		new winston.transports.File({
			filename: path.join(logDir, 'rejections.log'),
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json(),
			),
		}),
	],
	exitOnError: false,
});

/**
 * Ensures all logs are flushed before exiting the process. Replacement for `process.exit()`.
 * @param {number} code - Exit code (0 for success, 1 for error)
 */
function exitAfterFlush(code = 0) {
	logger.info(clc.yellowBright(`Process will exit with code: ${code}`));

	const transportPromises = logger.transports.map((transport) => {
		return new Promise((resolve) => transport.on('finish', resolve));
	});

	logger.end();

	Promise.all(transportPromises).then(() => {
		process.exit(code);
	});
}

/**
 * Captures all uncaught exceptions (synchronous errors).
 */
process.on('uncaughtException', (error, origin) => {
	logger.error({
		message: `UNCAUGHT EXCEPTION: ${error.message}`,
		label: 'PROCESS',
		error: error.stack,
		origin: origin,
	});
	// In production, you might want to exit after this.
	// exitAfterFlush(1);
});

/**
 * Captures all unhandled promise rejections (asynchronous errors).
 */
process.on('unhandledRejection', (reason, _promise) => {
	// `reason` can be an Error object or another data type
	const message =
		reason instanceof Error ? reason.message : JSON.stringify(reason);
	const stack = reason instanceof Error ? reason.stack : 'No stack available.';

	logger.error({
		message: `UNHANDLED REJECTION: ${message}`,
		label: 'PROCESS',
		error: stack,
	});
});

logger.exitAfterFlush = exitAfterFlush;

module.exports = logger;
