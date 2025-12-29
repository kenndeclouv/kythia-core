/**
 * 📝 Winston Logger Type Definitions
 *
 * @file src/types/Winston.ts
 * @description Type-safe wrappers for Winston logger with Kythia extensions
 */

import type { Logger as WinstonLogger } from 'winston';

/**
 * Simplified winston log info object
 * Used in format functions and middleware
 */
export interface WinstonLogInfo {
	level: string;
	message: unknown;
	label?: string;
	timestamp?: string;
	[key: string]: unknown;
}

/**
 * Winston format options for custom formats
 */
export interface WinstonFormatOptions {
	/** Log levels to include  */
	levels?: string[];

	/** Mode: 'all' or specific levels */
	mode?: 'all' | 'filter';
}

/**
 * Metadata object for logging
 */
export interface LogMetadata {
	/** Category/module label */
	label?: string;

	/** User ID for tracking */
	userId?: string;

	/** Guild ID for tracking */
	guildId?: string;

	/** Command name */
	commandName?: string;

	/** Error object */
	error?: Error;

	/** Additional metadata */
	[key: string]: unknown;
}

/**
 * Extended Kythia logger interface
 * Callable as function (defaults to info level) + all winston methods
 */
export interface KythiaLogger extends WinstonLogger {
	/**
	 * Log at info level (shorthand)
	 */
	(message: unknown, metadata?: LogMetadata): WinstonLogger;

	/**
	 * Flush logs and exit process gracefully
	 */
	exitAfterFlush: (code?: number) => void;
}
