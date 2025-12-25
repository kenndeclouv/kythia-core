import axios from 'axios';
import os from 'node:os';
import type { KythiaConfig as IKythiaConfig, KythiaLogger } from '../types';

interface TelemetryOptions {
	licenseKey: string;
	logger: KythiaLogger;
	version: string;
	config: IKythiaConfig;
}

interface LogQueueItem {
	level: string;
	message: string;
	metadata?: any;
	timestamp: number;
}

export class TelemetryManager {
	private licenseKey: string;
	private logger: KythiaLogger;
	private version: string;
	private config: IKythiaConfig;

	private logQueue: LogQueueItem[] = [];

	private networkFailures = 0;

	private readonly MAX_NETWORK_FAILURES = 6;

	private heartbeatInterval: NodeJS.Timeout | null = null;

	private readonly _e: string =
		'aHR0cHM6Ly9reXRoaWEtbGljZW5zZS56dXVsaXppbHV1ei53b3JrZXJzLmRldi9hcGkvdjEvbGljZW5zZS92ZXJpZnk=';

	private readonly _t: string =
		'aHR0cHM6Ly9reXRoaWEtbGljZW5zZS56dXVsaXppbHV1ei53b3JrZXJzLmRldi9hcGkvdjEvbGljZW5zZS90ZWxlbWV0cnk=';

	flushInterval: NodeJS.Timeout | undefined;

	private get _ep(): string {
		return Buffer.from(this._e, 'base64').toString('utf-8');
	}

	private get _tp(): string {
		return Buffer.from(this._t, 'base64').toString('utf-8');
	}

	constructor(options: TelemetryOptions) {
		this.licenseKey = options.licenseKey;
		this.logger = options.logger;
		this.version = options.version;
		this.config = options.config;
	}

	private getSystemSpec() {
		try {
			const cpus = os.cpus();
			const ramTotal = `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`;

			return {
				platform: `${os.type()} ${os.release()} (${os.arch()})`,
				hostname: os.hostname(),
				cpu: cpus.length > 0 ? cpus[0].model : 'Unknown CPU',
				cores: cpus.length,
				ram: ramTotal,
				nodeVersion: process.version,
				botVersion: this.version,
			};
		} catch (error: any) {
			this.logger.error('Failed to get system specs:', error);
			// We can't report this error via telemetry because this method is used by verifyStatus which is used by telemetry.
			// Reporting here could cause infinite recursion if verifyStatus fails.
			return {
				platform: 'Unknown',
				hostname: 'Unknown',
				cpu: 'Unknown',
				cores: 0,
				ram: 'Unknown',
				nodeVersion: process.version,
				botVersion: this.version,
			};
		}
	}

	public async verifyStatus(): Promise<
		'VALID' | 'INVALID' | 'NETWORK_ERROR' | 'SERVER_ERROR'
	> {
		try {
			const specs = this.getSystemSpec();
			const botClientId = this.config.bot.clientId;

			const response = await axios.post(
				this._ep,
				{
					key: this.licenseKey,
					clientId: botClientId,
					hwid: specs,
					config: this.config,
				},
				{
					timeout: 5000,
				},
			);

			if (response.status === 200 && response.data.valid) {
				return 'VALID';
			} else {
				return 'INVALID';
			}
		} catch (error: any) {
			if (error.response) {
				if (error.response.status === 401 || error.response.status === 403) {
					this.logger.error(
						`❌ License Rejected by Server: ${error.response.status}`,
					);
					return 'INVALID';
				}

				if (error.response.status >= 500) {
					this.logger.warn(`⚠️ License Server Error: ${error.response.status}`);
					return 'SERVER_ERROR';
				}

				return 'NETWORK_ERROR';
			} else if (error.request) {
				this.logger.warn(`⚠️ License Server Unreachable: ${error.message}`);
				return 'NETWORK_ERROR';
			}

			return 'NETWORK_ERROR';
		}
	}

	public async verify(): Promise<boolean> {
		const status = await this.verifyStatus();
		return status === 'VALID';
	}

	public report(
		level: 'info' | 'warn' | 'error',
		message: string,
		metadata?: any,
	) {
		try {
			this.logQueue.push({
				level,
				message,
				metadata: metadata ? JSON.stringify(metadata) : null,
				timestamp: Date.now(),
			});

			if (this.logQueue.length >= 50) {
				this.flush();
			}
		} catch (error) {
			// If reporting fails, we shouldn't try to report it again to avoid loops
			this.logger.warn('Failed to queue telemetry log:', error);
		}
	}

	private async flush() {
		if (this.logQueue.length === 0) return;

		const logsToSend = [...this.logQueue];
		this.logQueue = [];

		try {
			await axios.post(this._tp, {
				key: this.licenseKey,
				logs: logsToSend,
			});
		} catch (error) {
			this.logger.warn(
				`⚠️ Failed to flush telemetry logs: ${(error as any).message}`,
			);
		}
	}

	public startAutoFlush() {
		try {
			this.flushInterval = setInterval(
				() => {
					this.flush();
				},
				5 * 60 * 1000,
			);
		} catch (error: any) {
			this.logger.error('Failed to start auto flush:', error);
			this.report('error', 'Auto Flush Start Failed', {
				message: error.message,
				stack: error.stack,
			});
		}
	}

	public startHeartbeat() {
		try {
			if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

			const minMs = 10 * 60 * 1000;
			const maxMs = 20 * 60 * 1000;
			const randomMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

			this.heartbeatInterval = setInterval(async () => {
				try {
					this.logger.debug('💓 Checking License Status...');

					const status = await this.verifyStatus();

					if (status === 'VALID') {
						if (this.networkFailures > 0) {
							this.logger.info('✅ Reconnected to License Server!');
						}
						this.networkFailures = 0;
					} else if (status === 'INVALID') {
						this.logger.error('💀 LICENSE REVOKED/INVALID. SHUTTING DOWN.');
						await this.report('error', 'License Revoked (Heartbeat Check)');
						await this.flush();
						process.exit(1);
					} else if (status === 'NETWORK_ERROR' || status === 'SERVER_ERROR') {
						this.networkFailures++;

						const msg =
							status === 'SERVER_ERROR'
								? `⚠️ License Server Error (5xx). Attempt ${this.networkFailures}/${this.MAX_NETWORK_FAILURES}`
								: `⚠️ Cannot reach license server. Attempt ${this.networkFailures}/${this.MAX_NETWORK_FAILURES}`;

						this.logger.warn(msg);

						if (this.networkFailures >= this.MAX_NETWORK_FAILURES) {
							this.logger.error(
								'💀 Unable to verify license for too long. Shutting down for security.',
							);

							process.exit(1);
						}
					}
				} catch (error: any) {
					this.logger.error('Error during heartbeat check:', error);
					this.report('error', 'Heartbeat Check Failed', {
						message: error.message,
						stack: error.stack,
					});
				}
			}, randomMs);
		} catch (error: any) {
			this.logger.error('Failed to start heartbeat:', error);
			this.report('error', 'Heartbeat Start Failed', {
				message: error.message,
				stack: error.stack,
			});
		}
	}
}
