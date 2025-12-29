/**
 * 📄 Logger
 *
 * @file src/utils/logger.js
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.7-beta
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
 *
 * https://www.npmjs.com/package/colors-cli
 */

import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'node:path';
import fs from 'node:fs';

import clc from 'cli-color';

import type { KythiaConfig, KythiaLogger } from '../types';

const logDir = 'logs';

const configPath = path.resolve(process.cwd(), 'kythia.config.js');

let kythiaConfig: KythiaConfig;
try {
	if (fs.existsSync(configPath)) {
		kythiaConfig = require(configPath) as KythiaConfig;
	} else {
		kythiaConfig = { env: 'development' } as KythiaConfig;
	}
} catch (error: unknown) {
	console.warn('⚠️ Logger could not load kythia.config.js');
	console.warn(error);
	kythiaConfig = { env: 'development' } as KythiaConfig;
}

if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir);
}

const isProduction = kythiaConfig.env === 'production';

const levelColors: Record<string, any> = {
	error: clc.bgRed.whiteBright.bold,
	warn: clc.bgYellow.black.bold,
	info: clc.bgCyan.black.bold,
	debug: clc.bgMagenta.white.bold,
	silly: clc.bgBlue.white,
	verbose: clc.bgGreen.black,
	default: clc.bgWhite.black,
};

const levelIcons: Record<string, string> = {
	error: '✖',
	warn: '⚠',
	info: 'ℹ',
	debug: '⚙',
	silly: '💬',
	verbose: '🔎',
	default: '・',
};

const messageColors: Record<string, any> = {
	error: clc.redBright,
	warn: clc.yellowBright,
	info: clc.white,
	debug: clc.magentaBright,
	silly: clc.blueBright,
	verbose: clc.greenBright,
	default: clc.white,
};

const consoleLevelFilter = winston.format((info) => {
	// Winston format doesn't provide opts parameter in this context
	// This filter is not used anywhere, so it's safe to simplify
	return info;
});

const consoleFormatters = [];

if (
	kythiaConfig.settings?.logFormat &&
	kythiaConfig.settings.logFormat !== 'none'
) {
	consoleFormatters.push(
		winston.format.timestamp({
			format: kythiaConfig.settings.logFormat || 'HH:mm:ss',
		}),
	);
}

consoleFormatters.push(
	winston.format.splat(),
	winston.format.printf(({ level, message, timestamp, label }) => {
		const levelKey = level in levelColors ? level : 'default';
		const msgKey = level in messageColors ? level : 'default';

		const icon = levelIcons[levelKey] || levelIcons.default;
		const levelText = level.toUpperCase().padEnd(7);
		const levelLabel = levelColors[levelKey](` ${icon} ${levelText} `);

		const timeLabel = timestamp
			? clc.bgWhiteBright.black(` ${timestamp} `)
			: '';
		const categoryLabel = label
			? clc.bgWhiteBright.black.bold(` ${String(label).toUpperCase()} `)
			: '';

		const separator = clc.blackBright('│');

		let msg: string;
		if (typeof message === 'object' && message !== null) {
			msg = messageColors[msgKey](JSON.stringify(message, null, 2));
		} else {
			msg = messageColors[msgKey](message);
		}

		const header =
			`${timeLabel}${levelLabel}${categoryLabel ? ` ${categoryLabel}` : ''}`.trim();
		const visibleLength = clc.strip(header).length;
		const padding = ' '.repeat(Math.max(0, 12 - visibleLength));

		return `${header}${padding} ${separator} ${msg}`;
	}),
);

const colorConsoleFormat = winston.format.combine(...consoleFormatters);

const winstonLogger = winston.createLogger({
	level: isProduction ? 'info' : 'debug',
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				consoleLevelFilter({
					levels: (kythiaConfig.settings?.logConsoleFilter || 'all')
						.split(',')
						.map((l: string) => l.trim()),
					mode: kythiaConfig.settings?.logConsoleFilter || 'all',
				}),
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
 * 🛠️ Kythia Logger Wrapper
 * Allows the logger to be called as a function, defaulting to 'info' level.
 */
const logger = ((message: string, options?: unknown) => {
	return winstonLogger.info(message, options);
}) as unknown as KythiaLogger;

const methods = [
	'error',
	'warn',
	'info',
	'debug',
	'silly',
	'verbose',
	'log',
	'add',
	'remove',
	'clear',
	'close',
	'end',
	'on',
	'emit',
	'once',
	'off',
	'addListener',
	'removeListener',
	'removeAllListeners',
] as const;

for (const method of methods) {
	(logger as any)[method] = winstonLogger[method].bind(winstonLogger);
}

logger.transports = winstonLogger.transports;
logger.level = winstonLogger.level;
logger.levels = winstonLogger.levels;
logger.exceptions = winstonLogger.exceptions;
logger.rejections = winstonLogger.rejections;
logger.profilers = winstonLogger.profilers;
logger.exitOnError = winstonLogger.exitOnError;

/**
 * Ensures all logs are flushed before exiting the process.
 */
function exitAfterFlush(code = 0) {
	logger.info(clc.yellowBright(`Process will exit with code: ${code}`));

	const transportPromises = winstonLogger.transports.map((transport) => {
		return new Promise((resolve) => transport.on('finish', resolve));
	});

	winstonLogger.end();

	Promise.all(transportPromises).then(() => {
		process.exit(code);
	});
}

logger.exitAfterFlush = exitAfterFlush;

process.on('uncaughtException', (error, origin) => {
	logger.error({
		message: `UNCAUGHT EXCEPTION: ${error.message}`,
		label: 'PROCESS',
		error: error.stack,
		origin: origin,
	});
});

process.on('unhandledRejection', (reason, _promise) => {
	const message =
		reason instanceof Error ? reason.message : JSON.stringify(reason);
	const stack = reason instanceof Error ? reason.stack : 'No stack available.';

	logger.error({
		message: `UNHANDLED REJECTION: ${message}`,
		label: 'PROCESS',
		error: stack,
	});
});

export default logger;
