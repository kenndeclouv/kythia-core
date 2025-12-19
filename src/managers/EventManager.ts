/**
 * 🔔 Event Manager
 *
 * @file src/managers/EventManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.12.3-beta
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
		for (const [eventName, handlers] of this.eventHandlers.entries()) {
			this.client.on(eventName, async (...args: any[]) => {
				for (const handler of handlers) {
					try {
						const stopPropagation = await handler(this, ...args);

						if (stopPropagation === true) {
							break;
						}
					} catch (error: any) {
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
	}

	public addEventHandler(
		eventName: string,
		handler: KythiaAugmentedEventHandler,
	): void {
		if (!this.eventHandlers.has(eventName)) {
			this.eventHandlers.set(eventName, []);
		}
		this.eventHandlers.get(eventName)?.push(handler);
	}

	public removeEventHandler(
		eventName: string,
		handler: KythiaAugmentedEventHandler,
	): void {
		if (this.eventHandlers.has(eventName)) {
			const handlers = this.eventHandlers.get(
				eventName,
			) as KythiaAugmentedEventHandler[];
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		}
	}

	public getEventHandlers(eventName: string): KythiaAugmentedEventHandler[] {
		return this.eventHandlers.get(eventName) || [];
	}

	public getEventTypes(): string[] {
		return Array.from(this.eventHandlers.keys());
	}
}
