const Kythia = require('./src/Kythia.js');

module.exports = Kythia;

module.exports.Kythia = Kythia;

module.exports.KythiaClient = require('./src/KythiaClient.js');

module.exports.KythiaModel = require('./src/database/KythiaModel.js');

module.exports.createSequelizeInstance = require('./src/database/KythiaSequelize.js');

module.exports.KythiaORM = require('./src/database/KythiaORM.js');

module.exports.utils = require('./src/utils/index.js');

module.exports.BaseCommand = require('./src/structures/BaseCommand.js')