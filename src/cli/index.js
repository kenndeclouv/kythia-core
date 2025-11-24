#!/usr/bin/env node

const { Command } = require('commander');
const pc = require('picocolors');
const { version } = require('../../package.json');

const MigrateCommand = require('./commands/MigrateCommand');
const MakeMigrationCommand = require('./commands/MakeMigrationCommand');

const program = new Command();

program
	.name('kythia')
	.description(pc.cyan('⚡ Kythia Bot Framework CLI'))
	.version(version);

program
	.command('migrate')
	.description('Run pending database migrations')
	.option('-f, --fresh', 'Wipe database and re-run all migrations')
	.option('-r, --rollback', 'Rollback the last batch of migrations')
	.action((options) => MigrateCommand.execute(options));

program
	.command('make:migration')
	.description('Create a new migration file')
	.requiredOption('--name <string>', 'Name of the migration')
	.requiredOption('--addon <string>', 'Target addon name')
	.action((options) => MakeMigrationCommand.execute(options));

program
	.command('make:model')
	.description('Create a new KythiaModel file')
	.requiredOption('--name <string>', 'Name of the model (PascalCase)')
	.requiredOption('--addon <string>', 'Target addon name')
	.action((options) => MakeModelCommand.execute(options));

program
	.command('cache:clear')
	.description('Flush Redis cache (supports multi-instance selection)')
	.action((options) => CacheClearCommand.execute(options));
program.parse(process.argv);
