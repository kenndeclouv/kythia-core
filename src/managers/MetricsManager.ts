import {
	Registry,
	Counter,
	Histogram,
	collectDefaultMetrics,
} from 'prom-client';
import type { KythiaLogger } from '../types';

export class MetricsManager {
	public registry: Registry;
	public logger: KythiaLogger;

	public commandsTotal: Counter;
	public commandDuration: Histogram;
	public cacheOpsTotal: Counter;
	public dbQueryDuration: Histogram;

	constructor({ logger }: { logger: KythiaLogger }) {
		this.logger = logger;
		this.registry = new Registry();

		// Default Node.js metrics (event loop, memory, cpu)
		collectDefaultMetrics({ register: this.registry });

		this.commandsTotal = new Counter({
			name: 'kythia_commands_total',
			help: 'Total number of commands executed',
			labelNames: ['command_name', 'status'], // status: success, error
			registers: [this.registry],
		});

		this.commandDuration = new Histogram({
			name: 'kythia_command_duration_seconds',
			help: 'Duration of command execution in seconds',
			labelNames: ['command_name'],
			buckets: [0.1, 0.5, 1, 2, 5, 10],
			registers: [this.registry],
		});

		this.cacheOpsTotal = new Counter({
			name: 'kythia_cache_ops_total',
			help: 'Total number of cache operations (hits/misses)',
			labelNames: ['type', 'model'], // type: hit, miss, set, clear
			registers: [this.registry],
		});

		this.dbQueryDuration = new Histogram({
			name: 'kythia_db_query_duration_seconds',
			help: 'Duration of database queries in seconds',
			labelNames: ['model', 'operation'],
			buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
			registers: [this.registry],
		});
	}

	public async getMetrics(): Promise<string> {
		return this.registry.metrics();
	}

	public getContentType(): string {
		return this.registry.contentType;
	}
}
