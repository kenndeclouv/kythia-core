import type { Sequelize } from 'sequelize';
import type { KythiaContainer } from './KythiaContainer';

export interface KythiaInstanceForLoader {
	container: KythiaContainer;
	logger: any;
}

export type BootModels = (
	kythiaInstance: KythiaInstanceForLoader,
	sequelize: Sequelize,
) => Promise<void>;
