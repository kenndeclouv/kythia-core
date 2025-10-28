/**
 * 🔔 Event Manager
 *
 * @file src/managers/EventManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.10-beta
 *
 * @description
 * Handles all Discord event listeners except InteractionCreate.
 * Manages event registration, execution order, and error handling for all events.
 */

class EventManager {
    /**
     * 🏗️ EventManager Constructor
     * @param {Object} client - Discord client instance
     * @param {Object} container - Dependency container
     * @param {Map} eventHandlers - Event handlers map from AddonManager
     */
    constructor({ client, container, eventHandlers }) {
        this.client = client;
        this.container = container;
        this.eventHandlers = eventHandlers;

        this.logger = this.container.logger;
    }

    /**
     * 🚦 Initialize Master Event Handlers
     * Creates a single listener for each event type that then executes all
     * registered addon handlers in their prioritized order.
     */
    initialize() {
        for (const [eventName, handlers] of this.eventHandlers.entries()) {
            this.client.on(eventName, async (...args) => {
                for (const handler of handlers) {
                    try {
                        const stopPropagation = await handler(this, ...args);

                        if (stopPropagation === true) {
                            break;
                        }
                    } catch (error) {
                        this.logger.error(`Error executing event handler for [${eventName}]:`, error);
                    }
                }
            });
        }

        this.logger.info(`✅ EventManager initialized with ${this.eventHandlers.size} event types`);
    }

    /**
     * Add a new event handler
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Handler function
     */
    addEventHandler(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }

    /**
     * Remove an event handler
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Handler function to remove
     */
    removeEventHandler(eventName, handler) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Get all handlers for a specific event
     * @param {string} eventName - Name of the event
     * @returns {Array} Array of handlers
     */
    getEventHandlers(eventName) {
        return this.eventHandlers.get(eventName) || [];
    }

    /**
     * Get all registered event types
     * @returns {Array} Array of event names
     */
    getEventTypes() {
        return Array.from(this.eventHandlers.keys());
    }
}

module.exports = EventManager;
