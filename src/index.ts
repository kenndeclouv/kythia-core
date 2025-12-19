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

export {
	Kythia,
	kythiaClient,
	kythiaClient as KythiaClient,
	KythiaModel,
	createSequelizeInstance,
	utils,
	BaseCommand,
};

export default Kythia;
