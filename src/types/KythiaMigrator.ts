import type { Sequelize } from 'sequelize';
import type { KythiaContainer } from './KythiaContainer';
import type { KythiaLogger } from './KythiaLogger';

export interface KythiaMigratorOptions {
	sequelize: Sequelize;
	container: KythiaContainer;
	logger: KythiaLogger;
}

export type KythiaMigratorFunction = (
	options: KythiaMigratorOptions,
) => Promise<void>;
