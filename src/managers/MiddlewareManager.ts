/**
 * 🛡️ Middleware Manager
 *
 * @file src/managers/MiddlewareManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.4-beta
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
	}

	private async _loadFromPath(dirPath: string, source: string): Promise<void> {
		const files = fs
			.readdirSync(dirPath)
			.filter(
				(f) => (f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.d.ts'),
			);

		let loadedCount = 0;

		for (const file of files) {
			try {
				const middleware = require(path.join(dirPath, file));
				const mw = middleware.default || middleware;

				if (!mw.name || typeof mw.execute !== 'function') {
					this.logger.warn(`⚠️ Middleware ${file} invalid structure. Skipping.`);
					continue;
				}

				this.middlewares.push(mw as KythiaMiddleware);
				loadedCount++;
			} catch (err) {
				this.logger.error(`❌ Failed to load middleware ${file}:`, err);
			}
		}

		this.logger.info(`🛡️  Loaded ${loadedCount} middlewares from ${source}`);
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
			} catch (err) {
				this.logger.error(`❌ Error in middleware ${middleware.name}:`, err);
				return false;
			}
		}
		return true;
	}
}
