import type { Sequelize, Dialect } from 'sequelize';
import type { KythiaConfig } from './KythiaConfig';

export interface KythiaSequelizeConfig extends KythiaConfig {
	driver?: Dialect;
	name?: string;
	pass?: string;
	host?: string;
	port?: number;
	socket?: string;
	ssl?: boolean;
}

export type CreateSequelizeInstance = (
	config: KythiaConfig,
	logger?: any,
	driver?: Dialect,
) => Sequelize;
