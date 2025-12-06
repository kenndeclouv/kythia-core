/**
 * 🛡️ Middleware Manager
 *
 * @file src/managers/MiddlewareManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.11.1-beta
 *
 * @description
 * Handles the loading and execution of middleware functions for the application.
 * Ensures valid structure and manages the middleware pipeline.
 */

const fs = require('node:fs');
const path = require('node:path');

class MiddlewareManager {
	constructor({ container }) {
		this.container = container;
		this.logger = container.logger;
		this.middlewares = [];
	}

	async loadMiddlewares() {
		const middlewarePath = path.join(__dirname, '..', 'middlewares');

		if (!fs.existsSync(middlewarePath)) {
			fs.mkdirSync(middlewarePath, { recursive: true });
			return;
		}

		const files = fs
			.readdirSync(middlewarePath)
			.filter((f) => f.endsWith('.js'));
		this.middlewares = [];

		for (const file of files) {
			try {
				const middleware = require(path.join(middlewarePath, file));

				if (!middleware.name || typeof middleware.execute !== 'function') {
					this.logger.warn(`⚠️ Middleware ${file} invalid structure. Skipping.`);
					continue;
				}
				this.middlewares.push(middleware);
			} catch (err) {
				this.logger.error(`❌ Failed to load middleware ${file}:`, err);
			}
		}

		this.middlewares.sort((a, b) => (a.priority || 10) - (b.priority || 10));

		this.logger.info(`🛡️  Loaded ${this.middlewares.length} middlewares.`);
	}

	async handle(interaction, command) {
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

module.exports = MiddlewareManager;
