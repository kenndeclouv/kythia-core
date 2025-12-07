import type { KythiaClient } from './KythiaClient';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaLogger } from './KythiaLogger';

export interface IShutdownManager {
	client: KythiaClient;
	container: KythiaContainer;
	logger: KythiaLogger;

	initializeGlobalIntervalTracker(): void;
	initializeShutdownCollectors(): void;
	initialize(): void;
	getActiveIntervalsCount(): number;
	getActiveCollectorsCount(): number;
	forceCleanup(): void;
}
