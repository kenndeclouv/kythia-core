import type { Logger } from 'winston';

export type KythiaLogger = ((message: any, options?: any) => Logger) &
	Logger & {
		/**
		 * Ensures all logs are flushed before exiting the process.
		 * @param code Exit code (default 0)
		 */
		exitAfterFlush(code?: number): void;
	};
