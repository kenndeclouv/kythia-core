export interface Error {
	message: string;
	code?: string | number;
	stack?: string;
	details?: Record<string, unknown>;
}
