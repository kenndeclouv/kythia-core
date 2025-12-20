/**
 * 🛡️ Middleware Manager
 *
 * @file src/managers/MiddlewareManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.5-beta
 *
 * @description
 * Handles the loading and execution of middleware functions for the application.
 * Ensures valid structure and manages the middleware pipeline.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Interaction } from 'discord.js';
import type { KythiaContainer, KythiaMiddleware } from '../types';

export default class MiddlewareManager {
	public container: KythiaContainer;
	public logger: any;
	public middlewares: KythiaMiddleware[];

	constructor({ container }: { container: KythiaContainer }) {
		this.container = container;
		this.logger = container.logger;
		this.middlewares = [];
	}

	public async loadMiddlewares(): Promise<void> {
		try {
			this.middlewares = [];

			const coreMiddlewarePath = path.join(__dirname, '..', 'middlewares');

			if (fs.existsSync(coreMiddlewarePath)) {
				await this._loadFromPath(coreMiddlewarePath, 'core');
			} else {
				this.logger.warn(
					`⚠️ Core middlewares path not found: ${coreMiddlewarePath}`,
				);
			}

			const appRoot = this.container.appRoot || process.cwd();
			const userPaths = [
				path.join(appRoot, 'src', 'middlewares'),
				path.join(appRoot, 'middlewares'),
			];

			for (const userPath of userPaths) {
				if (fs.existsSync(userPath) && userPath !== coreMiddlewarePath) {
					await this._loadFromPath(userPath, 'bot');
				}
			}

			this.middlewares.sort((a, b) => (a.priority || 10) - (b.priority || 10));

			this.logger.info(
				`🛡️  Total Loaded: ${this.middlewares.length} middlewares.`,
			);
		} catch (error: any) {
			this.logger.error('Failed to load middlewares:', error);
			this.container.telemetry?.report('error', 'Middleware Loading Failed', {
				message: error.message,
				stack: error.stack,
			});
		}
	}

	private async _loadFromPath(dirPath: string, source: string): Promise<void> {
		try {
			const files = fs
				.readdirSync(dirPath)
				.filter(
					(f) =>
						(f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.d.ts'),
				);

			let loadedCount = 0;

			for (const file of files) {
				try {
					const middleware = require(path.join(dirPath, file));
					const mw = middleware.default || middleware;

					if (!mw.name || typeof mw.execute !== 'function') {
						this.logger.warn(
							`⚠️ Middleware ${file} invalid structure. Skipping.`,
						);
						continue;
					}

					this.middlewares.push(mw as KythiaMiddleware);
					loadedCount++;
				} catch (err: any) {
					this.logger.error(`❌ Failed to load middleware ${file}:`, err);
					this.container.telemetry?.report(
						'error',
						`Middleware Load Failed: [${file}]`,
						{
							message: err.message,
							stack: err.stack,
							source,
						},
					);
				}
			}

			this.logger.info(`🛡️  Loaded ${loadedCount} middlewares from ${source}`);
		} catch (error: any) {
			this.logger.error(
				`Failed to read middleware directory [${dirPath}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Middleware Directory Read Failed: [${dirPath}]`,
				{
					message: error.message,
					stack: error.stack,
					source,
				},
			);
		}
	}

	public async handle(
		interaction: Interaction,
		command: any,
	): Promise<boolean> {
		for (const middleware of this.middlewares) {
			try {
				const shouldContinue = await middleware.execute(
					interaction,
					command,
					this.container,
				);
				if (!shouldContinue) return false;
			} catch (err: any) {
				this.logger.error(`❌ Error in middleware ${middleware.name}:`, err);
				this.container.telemetry?.report(
					'error',
					`Middleware Execution Failed: [${middleware.name}]`,
					{
						message: err.message,
						stack: err.stack,
						command: command.name,
					},
				);
				return false;
			}
		}
		return true;
	}
}
