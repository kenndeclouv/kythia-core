import type { Sequelize } from 'sequelize';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaLogger } from './KythiaLogger';

export interface KythiaInstanceForLoader {
	container: KythiaContainer;
	logger: KythiaLogger;
}

export type BootModels = (
	kythiaInstance: KythiaInstanceForLoader,
	sequelize: Sequelize,
) => Promise<void>;
