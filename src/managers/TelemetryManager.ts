import axios from 'axios';
import os from 'node:os';
import type { KythiaConfig as IKythiaConfig, KythiaLogger } from '../types';

interface TelemetryOptions {
	licenseKey: string;
	apiUrl: string;
	logger: KythiaLogger;
	version: string;
	config: IKythiaConfig;
}

export class TelemetryManager {
	private licenseKey: string;
	private apiUrl: string;
	private logger: KythiaLogger;
	private version: string;
	private config: IKythiaConfig;

	constructor(options: TelemetryOptions) {
		this.licenseKey = options.licenseKey;
		this.apiUrl = options.apiUrl;
		this.logger = options.logger;
		this.version = options.version;
		this.config = options.config;
	}

	/**
	 * 🕵️ Mengambil Info Hardware Host
	 */
	private getSystemSpec() {
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
	}

	/**
	 * 🔐 Verifikasi License & Kirim Telemetry
	 * @returns {Promise<boolean>} True jika valid, False jika invalid
	 */
	public async verify(): Promise<boolean> {
		this.logger.info('🔐 Verifying License Key...');

		try {
			const specs = this.getSystemSpec();

			// Tembak API kamu
			const response = await axios.post(
				`${this.apiUrl}/api/v1/license/verify`,
				{
					key: this.licenseKey,
					hwid: specs,
					config: this.config,
				},
			);

			if (response.status === 200 && response.data.valid) {
				this.logger.info(
					`✅ License Valid! Welcome, ${response.data.owner || 'User'}.`,
				);
				return true;
			} else {
				return false;
			}
		} catch (error: any) {
			// Handle error kalau API mati atau Key salah
			if (error.response && error.response.status === 401) {
				this.logger.error('❌ LICENSE INVALID / EXPIRED.');
			} else {
				this.logger.error(
					`❌ Failed to connect to license server: ${error.message}`,
				);
			}
			return false;
		}
	}
}
