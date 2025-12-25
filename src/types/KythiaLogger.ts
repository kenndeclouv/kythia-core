import type { Logger } from 'winston';

export type KythiaLogger = ((message: unknown, options?: unknown) => Logger) &
	Logger & {
		exitAfterFlush(code?: number): void;
	};
