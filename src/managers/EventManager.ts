/**
 * 🔔 Event Manager
 *
 * @file src/managers/EventManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.7-beta
 *
 * @description
 * Handles all Discord event listeners except InteractionCreate.
 * Manages event registration, execution order, and error handling for all events.
 */

import type { Client } from 'discord.js';
import type {
	KythiaContainer,
	KythiaAugmentedEventHandler,
	IEventManager,
	KythiaLogger,
} from '../types';

export default class EventManager implements IEventManager {
	public client: Client;
	public container: KythiaContainer;
	public eventHandlers: Map<string, KythiaAugmentedEventHandler[]>;
	public logger: KythiaLogger;

	constructor({
		client,
		container,
		eventHandlers,
	}: {
		client: Client;
		container: KythiaContainer;
		eventHandlers: Map<string, KythiaAugmentedEventHandler[]>;
	}) {
		this.client = client;
		this.container = container;
		this.eventHandlers = eventHandlers;
		this.logger = this.container.logger;
	}

	public initialize(): void {
		try {
			for (const [eventName, handlers] of this.eventHandlers.entries()) {
				this.client.on(eventName, async (...args: any[]) => {
					for (const handler of handlers) {
						try {
							const stopPropagation = await handler(this, ...args);

							if (stopPropagation === true) {
								break;
							}
						} catch (err: unknown) {
							const error = err instanceof Error ? err : new Error(String(err));
							this.logger.error(
								`Error executing event handler for [${eventName}]:`,
								error,
							);

							this.container.telemetry?.report(
								'error',
								`Event Handler Failed: [${eventName}]`,
								{
									message: error.message,
									stack: error.stack,
								},
							);
						}
					}
				});
			}

			this.logger.info(
				`✅ EventManager initialized with ${this.eventHandlers.size} event types`,
			);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Failed to initialize EventManager:', error);
			this.container.telemetry?.report(
				'error',
				'EventManager Initialization Failed',
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	public addEventHandler(
		eventName: string,
		handler: KythiaAugmentedEventHandler,
	): void {
		try {
			if (!this.eventHandlers.has(eventName)) {
				this.eventHandlers.set(eventName, []);
			}
			this.eventHandlers.get(eventName)?.push(handler);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error(
				`Failed to add event handler for [${eventName}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Add Event Handler Failed: [${eventName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	public removeEventHandler(
		eventName: string,
		handler: KythiaAugmentedEventHandler,
	): void {
		try {
			if (this.eventHandlers.has(eventName)) {
				const handlers = this.eventHandlers.get(
					eventName,
				) as KythiaAugmentedEventHandler[];
				const index = handlers.indexOf(handler);
				if (index > -1) {
					handlers.splice(index, 1);
				}
			}
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error(
				`Failed to remove event handler for [${eventName}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Remove Event Handler Failed: [${eventName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
		}
	}

	public getEventHandlers(eventName: string): KythiaAugmentedEventHandler[] {
		try {
			return this.eventHandlers.get(eventName) || [];
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error(
				`Failed to get event handlers for [${eventName}]:`,
				error,
			);
			this.container.telemetry?.report(
				'error',
				`Get Event Handlers Failed: [${eventName}]`,
				{
					message: error.message,
					stack: error.stack,
				},
			);
			return [];
		}
	}

	public getEventTypes(): string[] {
		try {
			return Array.from(this.eventHandlers.keys());
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error('Failed to get event types:', error);
			this.container.telemetry?.report('error', 'Get Event Types Failed', {
				message: error.message,
				stack: error.stack,
			});
			return [];
		}
	}
}
