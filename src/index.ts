/**
 * 🚪 Entry Point Kythia Core
 * @file src/index.ts
 */

export * from './types';

import Kythia from './Kythia';
import kythiaClient from './KythiaClient';

import KythiaModel from './database/KythiaModel';
import createSequelizeInstance from './database/KythiaSequelize';
import { utils } from './utils';
import BaseCommand from './structures/BaseCommand';
import { Seeder } from './database/Seeder';
import { SeederManager } from './database/SeederManager';

export {
	Kythia,
	kythiaClient,
	kythiaClient as KythiaClient,
	KythiaModel,
	createSequelizeInstance,
	utils,
	BaseCommand,
	Seeder,
	SeederManager,
};

export default Kythia;
