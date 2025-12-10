/**
 * 🛡️ Middleware Manager
 *
 * @file src/managers/MiddlewareManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.0-beta.1
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
		// 👇 FIX 1: Reset array di SINI, sekali aja di awal.
		this.middlewares = [];

		const coreMiddlewarePath = path.join(__dirname, '..', 'middlewares');

		// this.logger.info(
		// 	`🔍 [Middleware] Loading Core Middlewares from: ${coreMiddlewarePath}`,
		// );

		if (fs.existsSync(coreMiddlewarePath)) {
			await this._loadFromPath(coreMiddlewarePath);
		} else {
			this.logger.warn(
				`⚠️ Core middlewares path not found: ${coreMiddlewarePath}`,
			);
		}

		const appRoot = this.container.appRoot || process.cwd();
		const userMiddlewarePath = path.join(appRoot, 'src', 'middlewares');

		if (
			fs.existsSync(userMiddlewarePath) &&
			userMiddlewarePath !== coreMiddlewarePath
		) {
			// this.logger.info(
			// 	`🔍 [Middleware] Loading User Middlewares from: ${userMiddlewarePath}`,
			// );
			await this._loadFromPath(userMiddlewarePath);
		}

		// Sort cukup sekali aja di akhir
		this.middlewares.sort((a, b) => (a.priority || 10) - (b.priority || 10));

		this.logger.info(
			`🛡️  Total Loaded: ${this.middlewares.length} middlewares.`,
		);
	}

	private async _loadFromPath(dirPath: string): Promise<void> {
		const files = fs
			.readdirSync(dirPath)
			.filter(
				(f) => (f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.d.ts'),
			);

		// 👇 FIX 2: HAPUS BARIS INI (Jangan di-reset di sini!)
		// this.middlewares = []; ❌

		// Kita pake array sementara buat log jumlah per-folder
		let loadedCount = 0;

		for (const file of files) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const middleware = require(path.join(dirPath, file));
				const mw = middleware.default || middleware;

				if (!mw.name || typeof mw.execute !== 'function') {
					this.logger.warn(`⚠️ Middleware ${file} invalid structure. Skipping.`);
					continue;
				}

				// Push ke array utama (numpuk, gak nimpa)
				this.middlewares.push(mw as KythiaMiddleware);
				loadedCount++;
			} catch (err) {
				this.logger.error(`❌ Failed to load middleware ${file}:`, err);
			}
		}

		// Log khusus folder ini
		this.logger.info(`🛡️  Loaded ${loadedCount} middlewares from this path.`);
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
