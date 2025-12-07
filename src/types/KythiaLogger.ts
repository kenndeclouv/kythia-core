import type { Logger } from 'winston';

export interface KythiaLogger extends Logger {
	/**
	 * Ensures all logs are flushed before exiting the process.
	 * @param code Exit code (default 0)
	 */
	exitAfterFlush(code?: number): void;
}
