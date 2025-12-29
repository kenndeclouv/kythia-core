import type { Sequelize, Model, ModelStatic } from 'sequelize';
import type { KythiaContainer } from './index';
import type { KythiaLogger } from './Winston';

export interface KythiaInstanceForLoader {
	container: KythiaContainer;
	logger: KythiaLogger;
}

export type AnySequelizeModel = ModelStatic<Model>;

export type BootModels = (
	kythiaInstance: {
		container: KythiaContainer;
		logger: KythiaLogger;
	},
	sequelize: Sequelize,
) => Promise<void>;
