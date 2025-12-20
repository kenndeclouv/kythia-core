/**
 * 🛑 Shutdown Manager
 *
 * @file src/managers/ShutdownManager.ts
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.5-beta
 *
 * @description
 * Handles graceful shutdown procedures including interval tracking,
 * component cleanup, and resource management.
 */

import exitHook from 'async-exit-hook';
import type { Message } from 'discord.js';
import type {
	KythiaClient,
	KythiaContainer,
	IShutdownManager,
	KythiaLogger,
} from '../types';

export class ShutdownManager implements IShutdownManager {
	client: KythiaClient;
	container: KythiaContainer;
	logger: KythiaLogger;
	private _activeIntervals: Set<NodeJS.Timeout>;
	private _messagesWithActiveCollectors: Set<Message>;
	private _collectorPatched: boolean;
	private _cleanupAttached: boolean;

	/**
	 * 🏗️ ShutdownManager Constructor
	 * @param {Object} client - Discord client instance
	 * @param {Object} container - Dependency container
	 */
	constructor({
		client,
		container,
	}: { client: KythiaClient; container: KythiaContainer }) {
		this.client = client;
		this.container = container;
		this._activeIntervals = new Set();
		this._messagesWithActiveCollectors = new Set();
		this._collectorPatched = false;
		this._cleanupAttached = false;

		this.logger = this.container.logger;
	}

	/**
	 * 🕵️‍♂️ [GLOBAL PATCH] Overrides global interval functions to track all active intervals.
	 * This allows for a truly generic and scalable graceful shutdown of all timed tasks.
	 */
	/**
	 * 🕵️‍♂️ [GLOBAL PATCH] Overrides global interval functions
	 */
	initializeGlobalIntervalTracker(): void {
		try {
			if (!this._activeIntervals) this._activeIntervals = new Set();

			const originalSetInterval = global.setInterval;
			const originalClearInterval = global.clearInterval;

			(global as any).setInterval = (
				callback: (...args: any[]) => void,
				ms?: number,
				...args: any[]
			): NodeJS.Timeout => {
				const intervalId = originalSetInterval(callback, ms, ...args);

				this._activeIntervals.add(intervalId);
				return intervalId;
			};

			(global as any).clearInterval = (
				intervalId: NodeJS.Timeout | undefined,
			): void => {
				if (intervalId) {
					originalClearInterval(intervalId);
					this._activeIntervals.delete(intervalId);
				}
			};

			this.logger.info(
				'✅ Global setInterval/clearInterval has been patched for tracking.',
			);
		} catch (error: any) {
			this.logger.error('Failed to initialize global interval tracker:', error);
			this.container.telemetry?.report(
				'error',
				'Global Interval Tracker Initialization Failed',
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	disableRecursively(components: any[]): any[] {
		return components.map((comp) => {
			if (comp.components && Array.isArray(comp.components)) {
				comp.components = this.disableRecursively(comp.components);
			}

			if (comp.type === 2 || comp.type === 3 || comp.type >= 5) {
				return { ...comp, disabled: true };
			}
			return comp;
		});
	}

	/**
	 * 🛑 [FINAL ARCHITECTURE v5] Manages ALL graceful shutdown procedures.
	 * This version patches the core message sending/editing methods to automatically
	 * track ANY message with components, regardless of how its interactions are handled.
	 */
	initializeShutdownCollectors(): void {
		try {
			if (!this._messagesWithActiveCollectors)
				this._messagesWithActiveCollectors = new Set();

			if (!this._collectorPatched) {
				const DiscordMessage = require('discord.js').Message;
				const origCreateCollector =
					DiscordMessage.prototype.createMessageComponentCollector;

				const botInstance = this;

				DiscordMessage.prototype.createMessageComponentCollector = function (
					this: Message,
					...args: any[]
				) {
					const collector = origCreateCollector.apply(this, args);

					if (botInstance._messagesWithActiveCollectors) {
						botInstance._messagesWithActiveCollectors.add(this);
					}

					collector.once('end', () => {
						if (botInstance._messagesWithActiveCollectors) {
							botInstance._messagesWithActiveCollectors.delete(this);
						}
					});

					return collector;
				};
				this._collectorPatched = true;
				this.logger.info(
					'✅ Corrected collector-based component tracking has been patched.',
				);
			}

			if (!this._cleanupAttached) {
				const cleanupAndFlush = async (callback: () => void) => {
					this.logger.info('🛑 Graceful shutdown initiated...');

					if (this._activeIntervals && this._activeIntervals.size > 0) {
						this.logger.info(
							`🛑 Halting ${this._activeIntervals.size} active global intervals...`,
						);
						for (const intervalId of this._activeIntervals) {
							clearInterval(intervalId);
						}
					}

					const messagesToProcess = this._messagesWithActiveCollectors;

					if (messagesToProcess && messagesToProcess.size > 0) {
						this.logger.info(
							`🛑 Disabling components on up to ${messagesToProcess.size} messages.`,
						);
						const editPromises: Promise<any>[] = [];

						for (const msg of messagesToProcess) {
							if (
								!msg.editable ||
								!msg.components ||
								msg.components.length === 0
							)
								continue;
							try {
								const rawComponents = msg.components.map((c) => c.toJSON());
								const disabledComponents =
									this.disableRecursively(rawComponents);
								editPromises.push(
									msg.edit({ components: disabledComponents }).catch(() => {}),
								);
							} catch (error) {
								this.logger.error(error);
							}
						}
						await Promise.allSettled(editPromises);
					}
					this.logger.info('✅ Component cleanup complete.');

					this.logger.info('🚰 Flushing remaining logs...');
					this.logger.on('finish', () => {
						console.log(
							'⏳ Logger has flushed. Kythia is now safely shutting down.',
						);
						if (callback) callback();
					});
					this.logger.end();
					setTimeout(() => {
						console.log('⏳ Logger flush timeout. Forcing exit.');
						if (callback) callback();
					}, 4000);
				};

				exitHook(cleanupAndFlush);
				process.on('unhandledRejection', (error: any) => {
					this.logger.error('‼️ UNHANDLED PROMISE REJECTION:', error);
					this.container.telemetry?.report(
						'error',
						'Unhandled Promise Rejection',
						{
							message: error.message,
							stack: error.stack,
						},
					);
				});
				process.on('uncaughtException', (error: any) => {
					this.logger.error('‼️ UNCAUGHT EXCEPTION! Bot will shutdown.', error);
					this.container.telemetry?.report('error', 'Uncaught Exception', {
						message: error.message,
						stack: error.stack,
					});
					process.exit(1);
				});

				this._cleanupAttached = true;
				this.logger.info(
					'🛡️  Graceful shutdown and error handlers are now active.',
				);
			}
		} catch (error: any) {
			this.logger.error('Failed to initialize shutdown collectors:', error);
			this.container.telemetry?.report(
				'error',
				'Shutdown Collector Initialization Failed',
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	/**
	 * Initialize all shutdown procedures
	 */
	initialize(): void {
		this.initializeGlobalIntervalTracker();
		this.initializeShutdownCollectors();
	}

	/**
	 * Get active intervals count
	 * @returns {number} Number of active intervals
	 */
	getActiveIntervalsCount(): number {
		return this._activeIntervals ? this._activeIntervals.size : 0;
	}

	/**
	 * Get messages with active collectors count
	 * @returns {number} Number of messages with active collectors
	 */
	getActiveCollectorsCount(): number {
		return this._messagesWithActiveCollectors
			? this._messagesWithActiveCollectors.size
			: 0;
	}

	/**
	 * Force cleanup (for testing purposes)
	 */
	forceCleanup(): void {
		if (this._activeIntervals) {
			for (const intervalId of this._activeIntervals) {
				clearInterval(intervalId);
			}
			this._activeIntervals.clear();
		}
	}
}
