/**
 * 📦 Dynamic Module Loading Helpers
 *
 * @file src/types/ModuleLoaders.ts
 * @description Type guards and safe loading for modules - uses existing types from AddonManager
 */

import type { KythiaCommandModule } from './AddonManager';
import type { KythiaAugmentedEventHandler } from './EventManager';
import type { KythiaContainer } from './KythiaContainer';

/**
 * Task module interface (new type, doesn't exist in AddonManager)
 */
export interface KythiaTaskModule {
	schedule: string | number;
	taskName?: string;
	active?: boolean;
	disabled?: boolean;
	execute: (container: KythiaContainer) => Promise<void> | void;
}

/**
 * Addon metadata from addon.json
 */
export interface AddonMetadata {
	name: string;
	version: string;
	description?: string;
	author?: string;
	priority?: number;
	dependencies?: string[];
	active?: boolean;
}

/**
 * Type guard for commands
 */
export function isCommandModule(obj: unknown): obj is KythiaCommandModule {
	if (!obj || typeof obj !== 'object') return false;
	return 'execute' in obj && typeof (obj as any).execute === 'function';
}

/**
 * Type guard for events
 */
export function isEventModule(
	obj: unknown,
): obj is KythiaAugmentedEventHandler {
	if (!obj || typeof obj !== 'object') return false;
	return 'execute' in obj && typeof (obj as any).execute === 'function';
}

/**
 * Type guard for tasks
 */
export function isTaskModule(obj: unknown): obj is KythiaTaskModule {
	if (!obj || typeof obj !== 'object') return false;
	const module = obj as any;
	return (
		typeof module.execute === 'function' &&
		'schedule' in module &&
		(typeof module.schedule === 'string' || typeof module.schedule === 'number')
	);
}
