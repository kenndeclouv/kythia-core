/**
 * 📦 Addon Manager
 *
 * @file src/managers/AddonManager.js
 * @copyright © 2025 kenndeclouv
 * @assistant chaa & graa
 * @version 0.9.1-beta
 *
 * @description
 * Handles all addon loading, command registration, and component management.
 * This manager is responsible for scanning addon directories, loading commands,
 * events, buttons, modals, and other components from addons.
 */

const { SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');

class AddonManager {
    /**
     * 🏗️ AddonManager Constructor
     * Initializes the addon manager with necessary collections and maps.
     * @param {Object} client - Discord client instance
     * @param {Object} container - Dependency container
     */
    constructor({ client, container }) {
        this.client = client;
        this.container = container;
        this.logger = this.container.logger;

        this.buttonHandlers = new Map();
        this.modalHandlers = new Map();
        this.selectMenuHandlers = new Map();
        this.autocompleteHandlers = new Map();
        this.commandCategoryMap = new Map();
        this.categoryToFeatureMap = new Map();
        this.embedDrafts = new Collection();
        this.eventHandlers = new Map();
    }

    /**
     * 🔘 Register Button Handler
     * Registers a handler function for a specific button customId.
     * @param {string} customId - The customId of the button
     * @param {Function} handler - The handler function to execute
     */
    registerButtonHandler(customId, handler) {
        if (this.buttonHandlers.has(customId)) {
            this.logger.warn(`[REGISTRATION] Warning: Button handler for [${customId}] already exists and will be overwritten.`);
        }
        this.buttonHandlers.set(customId, handler);
    }

    /**
     * 📝 Register Modal Handler
     * Registers a handler function for a modal, using a prefix of the customId.
     * @param {string} customIdPrefix - The prefix of the modal customId
     * @param {Function} handler - The handler function to execute
     */
    registerModalHandler(customIdPrefix, handler) {
        if (this.modalHandlers.has(customIdPrefix)) {
            this.logger.warn(`[REGISTRATION] Warning: Modal handler for [${customIdPrefix}] already exists and will be overwritten.`);
        }
        this.modalHandlers.set(customIdPrefix, handler);
    }

    /**
     * 🔍 Register Autocomplete Handler
     * Registers a handler for autocomplete interactions for a specific command or subcommand.
     * @param {string} commandName - The command or subcommand key
     * @param {Function} handler - The autocomplete handler function
     */
    registerAutocompleteHandler(commandName, handler) {
        if (this.autocompleteHandlers.has(commandName)) {
            this.logger.warn(`[REGISTRATION] Warning: Autocomplete handler for [${commandName}] already exists and will be overwritten.`);
        }
        this.autocompleteHandlers.set(commandName, handler);
    }

    /**
     * 📝 Register Command Helper
     * Registers a single command file/module, adds it to the command collection, and prepares it for deployment.
     * @param {Object} module - The command module
     * @param {string} filePath - The file path of the command
     * @param {Set} commandNamesSet - Set of already registered command names
     * @param {Array} commandDataForDeployment - Array to collect command data for deployment
     * @param {Object} permissionDefaults - Permission defaults for the command
     * @param {Object} options - Additional options (e.g., folderName)
     * @returns {Object|null} Summary object for logging, or null if not registered
     */
    registerCommand(module, filePath, commandNamesSet, commandDataForDeployment, permissionDefaults = {}, options = {}) {
        if (!module || !module.data) return null;

        let commandBuilder = new SlashCommandBuilder();
        if (typeof module.data === 'function') {
            module.data(commandBuilder);
        } else {
            commandBuilder = module.data;
        }

        const commandName = commandBuilder.name;
        const category = options.folderName || path.basename(path.dirname(filePath));

        const categoryDefaults = permissionDefaults[category] || {};
        const finalCommand = {
            ...categoryDefaults,
            ...module,
        };

        this.commandCategoryMap.set(commandName, category);
        if (commandNamesSet.has(commandName)) {
            throw new Error(`Duplicate command name detected: "${commandName}" in ${filePath}`);
        }

        commandNamesSet.add(commandName);
        this.client.commands.set(commandName, finalCommand);
        commandDataForDeployment.push(commandBuilder.toJSON());

        if (typeof finalCommand.autocomplete === 'function') {
            this.registerAutocompleteHandler(commandName, finalCommand.autocomplete);
        }

        return {
            type: 'single',
            name: commandName,
            folder: category,
        };
    }

    /**
     * 🧩 Load Addons & Register Commands/Events
     * Loads all addons from the addons directory, registers their commands, events, and components.
     * @param {Object} kythiaInstance - The main Kythia instance for addon registration
     * @returns {Promise<Array>} Array of command data for deployment
     */
    async loadAddons(kythiaInstance) {
        this.logger.info('🔌 Loading & Registering Kythia Addons...');
        const commandDataForDeployment = [];
        const addonsDir = path.join(this.container.appRoot, 'addons');
        if (!fs.existsSync(addonsDir)) return commandDataForDeployment;

        let addonFolders = fs.readdirSync(addonsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_'));

        let coreAddon = addonFolders.find((d) => d.name === 'core');
        let otherAddons = addonFolders.filter((d) => d.name !== 'core');
        if (coreAddon) {
            addonFolders = [coreAddon, ...otherAddons];
        }

        const commandNamesSet = new Set();
        const addonSummaries = [];

        for (const addon of addonFolders) {
            const addonDir = path.join(addonsDir, addon.name);
            let addonVersion = 'v0.0.0-alpha';

            try {
                const addonJsonPath = path.join(addonDir, 'addon.json');
                if (fs.existsSync(addonJsonPath)) {
                    let addonJson;
                    try {
                        const addonJsonRaw = fs.readFileSync(addonJsonPath, 'utf8');
                        addonJson = JSON.parse(addonJsonRaw);
                    } catch (jsonErr) {
                        this.logger.warn(`🔴 Failed to parse addon.json for ${addon.name}: ${jsonErr.message}`);
                        continue;
                    }

                    addonVersion = addonJson.version || 'v0.0.0-alpha';
                    if (addonJson.active === false) {
                        this.logger.info(`🟠 Addon ${addon.name.toUpperCase()} disabled`);
                        continue;
                    }
                    if (addonJson.featureFlag) {
                        this.commandCategoryMap.set(addon.name, addon.name);
                        this.categoryToFeatureMap.set(addon.name, addonJson.featureFlag);
                    }
                } else {
                    this.logger.warn(`🔴 Addon ${addon.name.toUpperCase()} is missing addon.json. Skipping.`);
                    continue;
                }
            } catch (e) {
                this.logger.warn(`🔴 Error reading addon.json for ${addonDir}: ${e.message}`);
                continue;
            }

            try {
                const configAddons = this.container.kythiaConfig?.addons || {};
                if (configAddons.all?.active === false) {
                    this.logger.info(`🟠 Addon ${addon.name.toUpperCase()} disabled via kythia config`);
                    continue;
                } else if (configAddons[addon.name]?.active === false) {
                    this.logger.info(`🟠 Addon ${addon.name.toUpperCase()} disabled via kythia config`);
                    continue;
                }
            } catch (e) {
                this.logger.warn(`🔴 Error checking config for addon ${addon.name.toUpperCase()}: ${e.message}`);
            }

            let addonPermissionDefaults = {};
            const permissionsFilePath = path.join(addonDir, 'permissions.js');

            if (fs.existsSync(permissionsFilePath)) {
                try {
                    addonPermissionDefaults = require(permissionsFilePath);
                    this.logger.info(`  └─> Found and loaded permission defaults for addon '${addon.name.toUpperCase()}'`);
                } catch (e) {
                    this.logger.warn(`  └─> Failed to load permissions.js for addon '${addon.name.toUpperCase()}': ${e.message}`);
                }
            }

            const loadedCommandsSummary = [];
            const loadedEventsSummary = [];
            const loadedRegisterSummary = [];

            const commandsPath = path.join(addonDir, 'commands');
            if (fs.existsSync(commandsPath)) {
                try {
                    const commandsResult = await this._loadCommandsFromPath(
                        commandsPath,
                        addon,
                        addonPermissionDefaults,
                        commandNamesSet,
                        commandDataForDeployment
                    );
                    loadedCommandsSummary.push(...commandsResult);
                } catch (error) {
                    this.logger.error(`❌ Failed to load commands from addon "${addon.name}":`, error);
                }
            }

            const registerPath = path.join(addonDir, 'register.js');
            if (fs.existsSync(registerPath)) {
                try {
                    const registration = require(registerPath);
                    if (typeof registration.initialize === 'function') {
                        const registrationSummary = await registration.initialize(kythiaInstance);
                        if (Array.isArray(registrationSummary) && registrationSummary.length > 0) {
                            loadedRegisterSummary.push(...registrationSummary);
                        }
                    }
                } catch (error) {
                    this.logger.error(`❌ Failed to register components for [${addon.name}]:`, error);
                }
            }

            const eventsPath = path.join(addonDir, 'events');
            if (fs.existsSync(eventsPath)) {
                const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
                for (const file of eventFiles) {
                    const eventName = path.basename(file, '.js');
                    try {
                        const eventHandler = require(path.join(eventsPath, file));
                        if (typeof eventHandler === 'function') {
                            if (!this.eventHandlers.has(eventName)) {
                                this.eventHandlers.set(eventName, []);
                            }
                            this.eventHandlers.get(eventName).push(eventHandler);
                            loadedEventsSummary.push(eventName);
                        }
                    } catch (error) {
                        this.logger.error(`❌ Failed to register event [${eventName}] for [${addon.name}]:`, error);
                    }
                }
            }

            addonSummaries.push({
                name: addon.name,
                version: addonVersion,
                commands: loadedCommandsSummary,
                events: loadedEventsSummary,
                register: loadedRegisterSummary,
            });
        }

        this._logAddonSummary(addonSummaries);
        return commandDataForDeployment;
    }

    /**
     * Load commands from a specific path
     * @private
     */
    async _loadCommandsFromPath(commandsPath, addon, addonPermissionDefaults, commandNamesSet, commandDataForDeployment) {
        const loadedCommandsSummary = [];
        const isTopLevelCommandGroup = fs.existsSync(path.join(commandsPath, '_command.js'));

        if (isTopLevelCommandGroup) {
            return await this._loadTopLevelCommandGroup(
                commandsPath,
                addon,
                addonPermissionDefaults,
                commandNamesSet,
                commandDataForDeployment
            );
        } else {
            return await this._loadIndividualCommands(
                commandsPath,
                addon,
                addonPermissionDefaults,
                commandNamesSet,
                commandDataForDeployment
            );
        }
    }

    /**
     * Load top-level command group
     * @private
     */
    async _loadTopLevelCommandGroup(commandsPath, addon, addonPermissionDefaults, commandNamesSet, commandDataForDeployment) {
        const loadedCommandsSummary = [];
        const commandDef = require(path.join(commandsPath, '_command.js'));
        const mainBuilder = commandDef.data;
        const mainCommandName = mainBuilder.name;

        if (commandDef.featureFlag) {
            this.commandCategoryMap.set(mainCommandName, addon.name);
            this.categoryToFeatureMap.set(addon.name, commandDef.featureFlag);
        }
        this.commandCategoryMap.set(mainCommandName, addon.name);

        if (commandNamesSet.has(mainCommandName)) throw new Error(`Duplicate command name: ${mainCommandName}`);
        commandNamesSet.add(mainCommandName);

        this.client.commands.set(mainCommandName, commandDef);

        if (typeof commandDef.autocomplete === 'function') {
            this.registerAutocompleteHandler(mainCommandName, commandDef.autocomplete);
        }

        const loadedSubcommandsSummary = [];
        const contents = fs.readdirSync(commandsPath, { withFileTypes: true });

        for (const item of contents) {
            const itemPath = path.join(commandsPath, item.name);

            if (item.isFile() && item.name.endsWith('.js') && !item.name.startsWith('_')) {
                const subModule = require(itemPath);
                if (subModule.subcommand !== true) continue;
                if (!subModule.data || typeof subModule.data !== 'function') continue;

                const subBuilder = new SlashCommandSubcommandBuilder();
                subModule.data(subBuilder);

                mainBuilder.addSubcommand(subBuilder);
                this.client.commands.set(`${mainCommandName} ${subBuilder.name}`, { ...commandDef, ...subModule });
                loadedSubcommandsSummary.push(subBuilder.name);
            } else if (item.isDirectory()) {
                const groupDefPath = path.join(itemPath, '_group.js');

                if (!fs.existsSync(groupDefPath)) {
                    continue;
                }

                try {
                    const groupModule = require(groupDefPath);
                    if (!groupModule.data || typeof groupModule.data !== 'function') continue;

                    const groupBuilder = new SlashCommandSubcommandGroupBuilder();
                    groupModule.data(groupBuilder);

                    const subcommandsInGroupSummary = [];
                    const subCommandFiles = fs.readdirSync(itemPath).filter((f) => f.endsWith('.js') && !f.startsWith('_'));

                    for (const file of subCommandFiles) {
                        const subCommandPath = path.join(itemPath, file);
                        const subModule = require(subCommandPath);
                        if (!subModule.data || typeof subModule.data !== 'function') continue;

                        const subBuilder = new SlashCommandSubcommandBuilder();
                        subModule.data(subBuilder);

                        groupBuilder.addSubcommand(subBuilder);

                        const commandKey = `${mainCommandName} ${groupBuilder.name} ${subBuilder.name}`;

                        this.client.commands.set(commandKey, { ...commandDef, ...groupModule, ...subModule });

                        subcommandsInGroupSummary.push(subBuilder.name);
                    }

                    mainBuilder.addSubcommandGroup(groupBuilder);

                    loadedSubcommandsSummary.push({ group: groupBuilder.name, subcommands: subcommandsInGroupSummary });
                } catch (e) {
                    this.logger.error(`❌ Failed to load subcommand group from ${itemPath}:`, e);
                }
            }
        }

        commandDataForDeployment.push(mainBuilder.toJSON());
        loadedCommandsSummary.push({ type: 'group', name: mainCommandName, subcommands: loadedSubcommandsSummary });

        return loadedCommandsSummary;
    }

    /**
     * Load individual commands
     * @private
     */
    async _loadIndividualCommands(commandsPath, addon, addonPermissionDefaults, commandNamesSet, commandDataForDeployment) {
        const loadedCommandsSummary = [];
        const commandItems = fs.readdirSync(commandsPath, { withFileTypes: true });

        for (const item of commandItems) {
            const itemPath = path.join(commandsPath, item.name);

            if (item.isDirectory() && fs.existsSync(path.join(itemPath, '_command.js'))) {
                const commandDef = require(path.join(itemPath, '_command.js'));
                let mainBuilder;
                if (typeof commandDef.data === 'function') {
                    mainBuilder = new SlashCommandBuilder();
                    commandDef.data(mainBuilder);
                } else {
                    mainBuilder = commandDef.data;
                }
                const mainCommandName = mainBuilder.name;

                if (commandDef.featureFlag) {
                    this.commandCategoryMap.set(mainCommandName, addon.name);
                    this.categoryToFeatureMap.set(addon.name, commandDef.featureFlag);
                }
                if (commandNamesSet.has(mainCommandName)) throw new Error(`Duplicate name: ${mainCommandName}`);
                commandNamesSet.add(mainCommandName);
                this.client.commands.set(mainCommandName, commandDef);

                if (typeof commandDef.autocomplete === 'function') {
                    this.registerAutocompleteHandler(mainCommandName, commandDef.autocomplete);
                }

                const subcommandsList = [];
                const groupContents = fs.readdirSync(itemPath, { withFileTypes: true });

                for (const content of groupContents) {
                    const contentPath = path.join(itemPath, content.name);
                    if (content.isFile() && content.name.endsWith('.js') && !content.name.startsWith('_')) {
                        const subModule = require(contentPath);
                        if (!subModule.data) continue;
                        let subBuilder = new SlashCommandSubcommandBuilder();
                        if (typeof subModule.data === 'function') {
                            subModule.data(subBuilder);
                        } else {
                            subBuilder = subModule.data;
                        }
                        mainBuilder.addSubcommand(subBuilder);
                        this.client.commands.set(`${mainCommandName} ${subBuilder.name}`, { ...commandDef, ...subModule });

                        if (typeof subModule.autocomplete === 'function') {
                            this.registerAutocompleteHandler(`${mainCommandName} ${subBuilder.name}`, subModule.autocomplete);
                        }

                        subcommandsList.push(subBuilder.name);
                    } else if (content.isDirectory() && fs.existsSync(path.join(contentPath, '_group.js'))) {
                        const groupDef = require(path.join(contentPath, '_group.js'));
                        let groupBuilder = new SlashCommandSubcommandGroupBuilder();
                        if (typeof groupDef.data === 'function') {
                            groupDef.data(groupBuilder);
                        } else {
                            groupBuilder = groupDef.data;
                        }
                        const subGroupList = [];
                        const subGroupContents = fs.readdirSync(contentPath, { withFileTypes: true });

                        for (const subSubItem of subGroupContents) {
                            if (subSubItem.isFile() && subSubItem.name.endsWith('.js') && !subSubItem.name.startsWith('_')) {
                                const subSubPath = path.join(contentPath, subSubItem.name);
                                const subSubModule = require(subSubPath);
                                if (!subSubModule.data) continue;
                                let subSubBuilder = new SlashCommandSubcommandBuilder();
                                if (typeof subSubModule.data === 'function') {
                                    subSubModule.data(subSubBuilder);
                                } else {
                                    subSubBuilder = subSubModule.data;
                                }
                                groupBuilder.addSubcommand(subSubBuilder);
                                this.client.commands.set(`${mainCommandName} ${groupBuilder.name} ${subSubBuilder.name}`, {
                                    ...commandDef,
                                    ...groupDef,
                                    ...subSubModule,
                                });

                                if (typeof subSubModule.autocomplete === 'function') {
                                    this.registerAutocompleteHandler(
                                        `${mainCommandName} ${groupBuilder.name} ${subSubBuilder.name}`,
                                        subSubModule.autocomplete
                                    );
                                }

                                subGroupList.push(subSubBuilder.name);
                            }
                        }
                        mainBuilder.addSubcommandGroup(groupBuilder);
                        subcommandsList.push({ group: groupBuilder.name, subcommands: subGroupList });
                    }
                }
                commandDataForDeployment.push(mainBuilder.toJSON());
                loadedCommandsSummary.push({ type: 'group', name: mainCommandName, subcommands: subcommandsList });
            } else if (item.isFile() && item.name.endsWith('.js') && !item.name.startsWith('_')) {
                const commandModule = require(itemPath);
                if (commandModule.subcommand) continue;
                let summary = null;

                if (commandModule.slashCommand) {
                    const commandBuilder = commandModule.slashCommand;
                    const commandName = commandBuilder.name;

                    try {
                        const allLocales = this.container.translator.getLocales();

                        let nameLocalizations = {};
                        let descriptionLocalizations = {};
                        if (typeof allLocales.entries === 'function') {
                            for (const [lang, translations] of allLocales.entries()) {
                                const nameKey = `command_${commandName}_name`;
                                const descKey = `command_${commandName}_desc`;
                                if (translations[nameKey]) nameLocalizations[lang] = translations[nameKey];
                                if (translations[descKey]) descriptionLocalizations[lang] = translations[descKey];
                            }
                        } else {
                            for (const lang in allLocales) {
                                const translations = allLocales[lang];
                                const nameKey = `command_${commandName}_name`;
                                const descKey = `command_${commandName}_desc`;
                                if (translations[nameKey]) nameLocalizations[lang] = translations[nameKey];
                                if (translations[descKey]) descriptionLocalizations[lang] = translations[descKey];
                            }
                        }
                        if (Object.keys(nameLocalizations).length > 0) {
                            commandBuilder.setNameLocalizations(nameLocalizations);
                        }
                        if (Object.keys(descriptionLocalizations).length > 0) {
                            commandBuilder.setDescriptionLocalizations(descriptionLocalizations);
                        }

                        this._applySubcommandLocalizations(commandBuilder, commandName, allLocales);
                    } catch (e) {
                        this.logger.warn(`Failed to load localizations for command "${commandName}": ${e.message}`);
                    }

                    if (commandNamesSet.has(commandName)) {
                        this.logger.warn(`Duplicate command name detected: "${commandName}" in ${itemPath}`);
                    } else {
                        commandNamesSet.add(commandName);
                        this.client.commands.set(commandName, commandModule);
                    }
                    commandDataForDeployment.push(commandBuilder.toJSON());
                    summary = { type: 'single', name: commandName, folder: addon.name, kind: 'slash' };
                    if (summary) loadedCommandsSummary.push(summary);
                    this.commandCategoryMap.set(commandName, addon.name);
                }

                if (commandModule.contextMenuCommand) {
                    const commandName = commandModule.contextMenuCommand.name;
                    if (commandNamesSet.has(commandName) && !commandModule.slashCommand) {
                        this.logger.warn(`Duplicate command name detected: "${commandName}" in ${itemPath}`);
                    } else {
                        if (!commandNamesSet.has(commandName)) commandNamesSet.add(commandName);
                        this.client.commands.set(commandName, commandModule);
                    }
                    commandDataForDeployment.push(commandModule.contextMenuCommand.toJSON());
                    summary = { type: 'single', name: commandName, folder: addon.name, kind: 'contextMenu' };
                    if (summary) loadedCommandsSummary.push(summary);
                }

                if (!commandModule.slashCommand && !commandModule.contextMenuCommand) {
                    summary = this.registerCommand(
                        commandModule,
                        itemPath,
                        commandNamesSet,
                        commandDataForDeployment,
                        addonPermissionDefaults,
                        { folderName: addon.name }
                    );
                    if (summary) loadedCommandsSummary.push(summary);
                }
            } else if (item.isDirectory() && !item.name.startsWith('_')) {
                const files = fs.readdirSync(itemPath).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
                for (const file of files) {
                    const filePath = path.join(itemPath, file);
                    const commandModule = require(filePath);
                    let summary = null;

                    if (commandModule.slashCommand) {
                        const commandBuilder = commandModule.slashCommand;
                        const commandName = commandBuilder.name;
                        if (commandModule.subcommand) continue;

                        try {
                            const allLocales = this.container.translator.getLocales();

                            let nameLocalizations = {};
                            let descriptionLocalizations = {};
                            if (typeof allLocales.entries === 'function') {
                                for (const [lang, translations] of allLocales.entries()) {
                                    const nameKey = `command_${commandName}_name`;
                                    const descKey = `command_${commandName}_desc`;
                                    if (translations[nameKey]) nameLocalizations[lang] = translations[nameKey];
                                    if (translations[descKey]) descriptionLocalizations[lang] = translations[descKey];
                                }
                            } else {
                                for (const lang in allLocales) {
                                    const translations = allLocales[lang];
                                    const nameKey = `command_${commandName}_name`;
                                    const descKey = `command_${commandName}_desc`;
                                    if (translations[nameKey]) nameLocalizations[lang] = translations[nameKey];
                                    if (translations[descKey]) descriptionLocalizations[lang] = translations[descKey];
                                }
                            }
                            if (Object.keys(nameLocalizations).length > 0) {
                                commandBuilder.setNameLocalizations(nameLocalizations);
                            }
                            if (Object.keys(descriptionLocalizations).length > 0) {
                                commandBuilder.setDescriptionLocalizations(descriptionLocalizations);
                            }

                            this._applySubcommandLocalizations(commandBuilder, commandName, allLocales);
                        } catch (e) {
                            this.logger.warn(`Failed to load localizations for command "${commandName}": ${e.message}`);
                        }

                        this.commandCategoryMap.set(commandName, item.name);
                        if (commandNamesSet.has(commandName)) {
                            this.logger.warn(`Duplicate slash command name detected: "${commandName}" in ${filePath}`);
                        } else {
                            commandNamesSet.add(commandName);
                            this.client.commands.set(commandName, commandModule);
                            commandDataForDeployment.push(commandBuilder.toJSON());
                            summary = { type: 'single', name: commandName, folder: item.name, kind: 'slash' };
                            if (summary) loadedCommandsSummary.push(summary);
                        }
                    }

                    if (commandModule.contextMenuCommand) {
                        const commandName = commandModule.contextMenuCommand.name;
                        if (!this.client.commands.has(commandName)) {
                            this.client.commands.set(commandName, commandModule);
                        }
                        commandDataForDeployment.push(commandModule.contextMenuCommand.toJSON());
                        summary = { type: 'single', name: commandName, folder: item.name, kind: 'contextMenu' };
                        if (summary) loadedCommandsSummary.push(summary);
                    }

                    if (!commandModule.slashCommand && !commandModule.contextMenuCommand) {
                        summary = this.registerCommand(
                            commandModule,
                            filePath,
                            commandNamesSet,
                            commandDataForDeployment,
                            addonPermissionDefaults,
                            { folderName: item.name }
                        );
                        if (summary) loadedCommandsSummary.push(summary);
                    }
                }
            }
        }

        return loadedCommandsSummary;
    }

    /**
     * Apply subcommand localizations
     * @private
     */
    _applySubcommandLocalizations(commandBuilder, commandName, allLocales) {
        if (Array.isArray(commandBuilder.options)) {
            for (const group of commandBuilder.options) {
                if (typeof SlashCommandSubcommandGroupBuilder !== 'undefined' && group instanceof SlashCommandSubcommandGroupBuilder) {
                    const groupName = group.name;

                    let groupDescLocalizations = {};
                    if (typeof allLocales.entries === 'function') {
                        for (const [lang, translations] of allLocales.entries()) {
                            const groupDescKey = `command_${commandName}_${groupName}_group_desc`;
                            if (translations[groupDescKey]) groupDescLocalizations[lang] = translations[groupDescKey];
                        }
                    } else {
                        for (const lang in allLocales) {
                            const translations = allLocales[lang];
                            const groupDescKey = `command_${commandName}_${groupName}_group_desc`;
                            if (translations[groupDescKey]) groupDescLocalizations[lang] = translations[groupDescKey];
                        }
                    }
                    if (Object.keys(groupDescLocalizations).length > 0 && typeof group.setDescriptionLocalizations === 'function') {
                        group.setDescriptionLocalizations(groupDescLocalizations);
                    }

                    if (Array.isArray(group.options)) {
                        for (const sub of group.options) {
                            const subName = sub.name;

                            let subDescLocalizations = {};
                            if (typeof allLocales.entries === 'function') {
                                for (const [lang, translations] of allLocales.entries()) {
                                    const subDescKey = `command_${commandName}_${groupName}_${subName}_desc`;
                                    if (translations[subDescKey]) subDescLocalizations[lang] = translations[subDescKey];
                                }
                            } else {
                                for (const lang in allLocales) {
                                    const translations = allLocales[lang];
                                    const subDescKey = `command_${commandName}_${groupName}_${subName}_desc`;
                                    if (translations[subDescKey]) subDescLocalizations[lang] = translations[subDescKey];
                                }
                            }
                            if (Object.keys(subDescLocalizations).length > 0 && typeof sub.setDescriptionLocalizations === 'function') {
                                sub.setDescriptionLocalizations(subDescLocalizations);
                            }

                            if (Array.isArray(sub.options)) {
                                for (const opt of sub.options) {
                                    const optName = opt.name;
                                    let optDescLocalizations = {};
                                    if (typeof allLocales.entries === 'function') {
                                        for (const [lang, translations] of allLocales.entries()) {
                                            const optDescKey = `command_${commandName}_${groupName}_${subName}_option_${optName}`;
                                            if (translations[optDescKey]) optDescLocalizations[lang] = translations[optDescKey];
                                        }
                                    } else {
                                        for (const lang in allLocales) {
                                            const translations = allLocales[lang];
                                            const optDescKey = `command_${commandName}_${groupName}_${subName}_option_${optName}`;
                                            if (translations[optDescKey]) optDescLocalizations[lang] = translations[optDescKey];
                                        }
                                    }
                                    if (
                                        Object.keys(optDescLocalizations).length > 0 &&
                                        typeof opt.setDescriptionLocalizations === 'function'
                                    ) {
                                        opt.setDescriptionLocalizations(optDescLocalizations);
                                    }
                                }
                            }
                        }
                    }
                } else if (typeof SlashCommandSubcommandBuilder !== 'undefined' && group instanceof SlashCommandSubcommandBuilder) {
                    const subName = group.name;
                    let subDescLocalizations = {};
                    if (typeof allLocales.entries === 'function') {
                        for (const [lang, translations] of allLocales.entries()) {
                            const subDescKey = `command_${commandName}_${subName}_desc`;
                            if (translations[subDescKey]) subDescLocalizations[lang] = translations[subDescKey];
                        }
                    } else {
                        for (const lang in allLocales) {
                            const translations = allLocales[lang];
                            const subDescKey = `command_${commandName}_${subName}_desc`;
                            if (translations[subDescKey]) subDescLocalizations[lang] = translations[subDescKey];
                        }
                    }
                    if (Object.keys(subDescLocalizations).length > 0 && typeof group.setDescriptionLocalizations === 'function') {
                        group.setDescriptionLocalizations(subDescLocalizations);
                    }

                    if (Array.isArray(group.options)) {
                        for (const opt of group.options) {
                            const optName = opt.name;
                            let optDescLocalizations = {};
                            if (typeof allLocales.entries === 'function') {
                                for (const [lang, translations] of allLocales.entries()) {
                                    const optDescKey = `command_${commandName}_${subName}_option_${optName}`;
                                    if (translations[optDescKey]) optDescLocalizations[lang] = translations[optDescKey];
                                }
                            } else {
                                for (const lang in allLocales) {
                                    const translations = allLocales[lang];
                                    const optDescKey = `command_${commandName}_${subName}_option_${optName}`;
                                    if (translations[optDescKey]) optDescLocalizations[lang] = translations[optDescKey];
                                }
                            }
                            if (Object.keys(optDescLocalizations).length > 0 && typeof opt.setDescriptionLocalizations === 'function') {
                                opt.setDescriptionLocalizations(optDescLocalizations);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Log addon summary
     * @private
     */
    _logAddonSummary(addonSummaries) {
        this.logger.info('▬▬▬▬▬▬▬▬▬▬▬▬▬[ Addon(s) Loaded ]▬▬▬▬▬▬▬▬▬▬▬▬▬');
        for (const addon of addonSummaries) {
            this.logger.info(`📦  ${addon.name} (v${addon.version})`);
            this.logger.info('  ⚙️  Command(s)');
            if (!addon.commands.length) {
                this.logger.info('     (no commands registered)');
            } else {
                for (const cmd of addon.commands) {
                    if (cmd.type === 'group') {
                        this.logger.info(`     └─ /${cmd.name}`);
                        for (const sub of cmd.subcommands) {
                            if (typeof sub === 'string') {
                                this.logger.info(`        └─ ${sub}`);
                            } else if (typeof sub === 'object' && sub.group) {
                                this.logger.info(`          └─ [${sub.group}]`);
                                for (const subsub of sub.subcommands) {
                                    this.logger.info(`             └─ ${subsub}`);
                                }
                            }
                        }
                    } else if (cmd.type === 'single') {
                        let kindLabel = '';
                        if (cmd.kind === 'slash') kindLabel = ' [slash]';
                        else if (cmd.kind === 'contextMenu') kindLabel = ' [contextMenu]';
                        if (cmd.folder) {
                            this.logger.info(`     └─ /${cmd.name} (${cmd.folder})${kindLabel}`);
                        } else {
                            this.logger.info(`     └─ /${cmd.name}${kindLabel}`);
                        }
                    }
                }
            }
            if (addon.register && addon.register.length) {
                this.logger.info('  🧩 Component(s)');
                for (const reg of addon.register) {
                    this.logger.info(`   ${reg}`);
                }
            }
            if (addon.events && addon.events.length) {
                this.logger.info('  🔔 Event(s)');
                for (const ev of addon.events) {
                    this.logger.info(`     └─ ${ev}`);
                }
            }
        }
    }

    /**
     * Get handler maps for other managers
     */
    getHandlers() {
        return {
            buttonHandlers: this.buttonHandlers,
            modalHandlers: this.modalHandlers,
            selectMenuHandlers: this.selectMenuHandlers,
            autocompleteHandlers: this.autocompleteHandlers,
            commandCategoryMap: this.commandCategoryMap,
            categoryToFeatureMap: this.categoryToFeatureMap,
            eventHandlers: this.eventHandlers,
        };
    }
}

module.exports = AddonManager;
