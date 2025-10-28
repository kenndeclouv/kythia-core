/**
 * 🛑 Shutdown Manager
 *
 * @file src/managers/ShutdownManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.10-beta
 *
 * @description
 * Handles graceful shutdown procedures including interval tracking,
 * component cleanup, and resource management.
 */

const exitHook = require('async-exit-hook');

class ShutdownManager {
    /**
     * 🏗️ ShutdownManager Constructor
     * @param {Object} client - Discord client instance
     * @param {Object} container - Dependency container
     */
    constructor({ client, container }) {
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
    initializeGlobalIntervalTracker() {
        if (!this._activeIntervals) this._activeIntervals = new Set();

        const botInstance = this;
        const originalSetInterval = global.setInterval;
        const originalClearInterval = global.clearInterval;

        global.setInterval = function (...args) {
            const intervalId = originalSetInterval.apply(this, args);

            botInstance._activeIntervals.add(intervalId);
            return intervalId;
        };

        global.clearInterval = function (intervalId) {
            originalClearInterval.apply(this, [intervalId]);

            botInstance._activeIntervals.delete(intervalId);
        };

        this.logger.info('✅ Global setInterval/clearInterval has been patched for tracking.');
    }

    /**
     * 🛑 [FINAL ARCHITECTURE v5] Manages ALL graceful shutdown procedures.
     * This version patches the core message sending/editing methods to automatically
     * track ANY message with components, regardless of how its interactions are handled.
     */
    initializeShutdownCollectors() {
        if (!this._messagesWithActiveCollectors) this._messagesWithActiveCollectors = new Set();

        if (!this._collectorPatched) {
            const origCreateCollector = require('discord.js').Message.prototype.createMessageComponentCollector;
            const botInstance = this;

            require('discord.js').Message.prototype.createMessageComponentCollector = function (...args) {
                const collector = origCreateCollector.apply(this, args);
                const message = this;

                if (botInstance._messagesWithActiveCollectors) {
                    botInstance._messagesWithActiveCollectors.add(message);
                }

                collector.once('end', () => {
                    if (botInstance._messagesWithActiveCollectors) {
                        botInstance._messagesWithActiveCollectors.delete(message);
                    }
                });

                return collector;
            };
            this._collectorPatched = true;
            this.logger.info('✅ Corrected collector-based component tracking has been patched.');
        }

        if (!this._cleanupAttached) {
            const cleanupAndFlush = async (callback) => {
                this.logger.info('🛑 Graceful shutdown initiated...');

                if (this._activeIntervals && this._activeIntervals.size > 0) {
                    this.logger.info(`🛑 Halting ${this._activeIntervals.size} active global intervals...`);
                    for (const intervalId of this._activeIntervals) {
                        clearInterval(intervalId);
                    }
                }

                const messagesToProcess = this._messagesWithActiveCollectors;

                if (messagesToProcess && messagesToProcess.size > 0) {
                    this.logger.info(`🛑 Disabling components on up to ${messagesToProcess.size} messages.`);
                    const editPromises = [];

                    function disableRecursively(components) {
                        return components.map((comp) => {
                            if (comp.components && Array.isArray(comp.components)) {
                                comp.components = disableRecursively(comp.components);
                            }

                            if (comp.type === 2 || comp.type === 3 || comp.type >= 5) {
                                return { ...comp, disabled: true };
                            }
                            return comp;
                        });
                    }

                    for (const msg of messagesToProcess) {
                        if (!msg.editable || !msg.components || msg.components.length === 0) continue;
                        try {
                            const rawComponents = msg.components.map((c) => c.toJSON());
                            const disabledComponents = disableRecursively(rawComponents);
                            editPromises.push(msg.edit({ components: disabledComponents }).catch(() => {}));
                        } catch (e) {
                            /* Abaikan */
                        }
                    }
                    await Promise.allSettled(editPromises);
                }
                this.logger.info('✅ Component cleanup complete.');

                this.logger.info('🚰 Flushing remaining logs...');
                this.logger.on('finish', () => {
                    console.log('⏳ Logger has flushed. Kythia is now safely shutting down.');
                    if (callback) callback();
                });
                this.logger.end();
                setTimeout(() => {
                    console.log('⏳ Logger flush timeout. Forcing exit.');
                    if (callback) callback();
                }, 4000);
            };

            exitHook(cleanupAndFlush);
            process.on('unhandledRejection', (error) => {
                this.logger.error('‼️ UNHANDLED PROMISE REJECTION:', error);
            });
            process.on('uncaughtException', (error) => {
                this.logger.error('‼️ UNCAUGHT EXCEPTION! Bot will shutdown.', error);
                process.exit(1);
            });

            this._cleanupAttached = true;
            this.logger.info('🛡️  Graceful shutdown and error handlers are now active.');
        }
    }

    /**
     * Initialize all shutdown procedures
     */
    initialize() {
        this.initializeGlobalIntervalTracker();
        this.initializeShutdownCollectors();
    }

    /**
     * Get active intervals count
     * @returns {number} Number of active intervals
     */
    getActiveIntervalsCount() {
        return this._activeIntervals ? this._activeIntervals.size : 0;
    }

    /**
     * Get messages with active collectors count
     * @returns {number} Number of messages with active collectors
     */
    getActiveCollectorsCount() {
        return this._messagesWithActiveCollectors ? this._messagesWithActiveCollectors.size : 0;
    }

    /**
     * Force cleanup (for testing purposes)
     */
    forceCleanup() {
        if (this._activeIntervals) {
            for (const intervalId of this._activeIntervals) {
                clearInterval(intervalId);
            }
            this._activeIntervals.clear();
        }
    }
}

module.exports = ShutdownManager;
