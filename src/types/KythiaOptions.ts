import type { Sequelize } from 'sequelize';
import type { KythiaConfig } from './KythiaConfig';

export interface KythiaOptions {
	config: KythiaConfig;
	logger?: any;
	redis: any;
	sequelize: Sequelize;
	models?: Record<string, any>;
	helpers?: Record<string, any>;
	utils?: Record<string, any>;
	appRoot?: string;
}
