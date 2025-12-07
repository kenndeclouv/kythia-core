import type { Sequelize } from 'sequelize';
import type { KythiaContainer } from './KythiaContainer';

export interface KythiaMigratorOptions {
	sequelize: Sequelize;
	container: KythiaContainer;
	logger: any;
}

export type KythiaMigratorFunction = (
	options: KythiaMigratorOptions,
) => Promise<void>;
