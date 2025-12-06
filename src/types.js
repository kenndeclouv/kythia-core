/**
 * 📚 KYTHIA TYPE DEFINITIONS
 * File ini cuma buat definisi tipe data biar VS Code pinter.
 * Gak akan dieksekusi sama Node.js.
 */

/**
 * @typedef {import('discord.js').Client} DiscordClient
 * @typedef {import('sequelize').Sequelize} SequelizeInstance
 * @typedef {import('./managers/TranslatorManager')} TranslatorManager
 * @typedef {import('./managers/MiddlewareManager')} MiddlewareManager
 * @typedef {import('./managers/InteractionManager')} InteractionManager
 * @typedef {import('./managers/AddonManager')} AddonManager
 * * @typedef {Object} KythiaConfigBot
 * @property {string} token
 * @property {string} clientId
 * @property {string} clientSecret
 * @property {string} [devGuildId]
 * * @typedef {Object} KythiaConfigDb
 * @property {'sqlite'|'mysql'|'postgres'} driver
 * @property {string} name
 * @property {string} [host]
 * @property {number} [port]
 * @property {string} [user]
 * @property {string} [pass]
 * * @typedef {Object} KythiaConfig
 * @property {KythiaConfigBot} bot
 * @property {KythiaConfigDb} db
 * @property {Object} [redis]
 * @property {string} env
 *
 * @typedef {Object} KythiaOptions
 * @property {KythiaConfig} config
 * @property {Object} [logger]
 * @property {Object} redis
 * @property {SequelizeInstance} sequelize
 * @property {Object.<string, any>} [models]
 * @property {Object.<string, any>} [helpers]
 * @property {Object.<string, any>} [utils]
 * @property {string} [appRoot]
 *
 * @typedef {Object} KythiaContainer
 * @property {DiscordClient} client
 * @property {SequelizeInstance} sequelize
 * @property {Object} logger
 * @property {function(import('discord.js').Interaction, string, object=): Promise<string>} [t]
 * @property {Object} redis
 * @property {KythiaConfig} kythiaConfig
 * @property {TranslatorManager} [translator]
 * @property {MiddlewareManager} [middlewareManager]
 * @property {Object} models
 * @property {Object} helpers
 * @property {string} appRoot
 */

// Kita harus export sesuatu biar file ini dianggap module sama VS Code
module.exports = {};
