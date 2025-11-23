<p align="center">
  <a href="https://kythia.my.id">
    <img src="https://kythia.my.id/assets/img/logo/logo.png" alt="Kythia Logo" height="150" style="border-radius: 10px;">
  </a>
</p>

<h1 align="center">
  Kythia Core
</h1>

<p align="center">
  <strong>The foundational engine for building scalable and maintainable Discord bots based on the Kythia framework.</strong>
</p>

<p align="center">
  <a href="https://github.com/kenndeclouv/kythia-core/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-CC%20BYNC%204.0-blue?style=for-the-badge" alt="License"></a>
</p>

<p align="center">
  <a href="https://github.com/kenndeclouv/kythia-core/issues">Report a Bug</a>
  ·
  <a href="https://github.com/kenndeclouv/kythia-core/issues">Request a Feature</a>
</p>

<div align="center">
  <p><em>Powered by the following technologies:</em></p>
  <img alt="Discord" src="https://img.shields.io/badge/Discord-5865F2.svg?style=flat&logo=Discord&logoColor=white">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933.svg?style=flat&logo=nodedotjs&logoColor=white">
  <img alt="Sequelize" src="https://img.shields.io/badge/Sequelize-52B0E7.svg?style=flat&logo=Sequelize&logoColor=white">
</div>

---

## 🚀 Key Concepts & Architecture

`kythia-core` is built around a few core principles:

1.  **Dependency Injection (DI) Container:** The heart of the interaction between the core and the consuming application (your main bot and its addons). The `Kythia` class accepts a `dependencies` object during construction and stores critical instances (like the logger, config, database models, core helpers, etc.) in a `container` object attached to the `client`. **Addons MUST access shared resources via this container (`interaction.client.container`) within their execution context (e.g., inside `execute` functions) to prevent critical circular dependency issues during startup.**
2.  **Manager Pattern:** Core responsibilities are delegated to specialized managers:
    * `AddonManager`: Discovers, loads, and registers commands, events, and components from addons.
    * `EventManager`: Handles all non-interaction Discord gateway events, routing them to relevant addon handlers.
    * `InteractionManager`: Handles all `InteractionCreate` events (slash commands, buttons, modals, autocomplete, context menus), including permission checks, cooldowns, and DI for command execution.
    * `ShutdownManager`: Manages graceful shutdown procedures, tracking intervals and cleaning up active components.
3.  **Addon-Driven Functionality:** The core provides the *framework*, but the actual bot features (commands, specific event responses) are implemented within **addons** in the main bot application. The core is designed to discover and integrate these addons seamlessly.
4.  **Smart Database Layer:** Includes a base model (`KythiaModel`) with an advanced caching layer and an intelligent ORM utility (`KythiaORM`) for safe and efficient schema synchronization.

---

## 🔧 Core Components (Exports)

This package exports the following key components via its main `index.js`:

### `Kythia` (Default Export & Named Export)

* **File:** `src/Kythia.js`
* **Role:** The main orchestrator class. It initializes all managers, manages the startup sequence, and holds the central dependency container.
* **Usage:**
    * Instantiated in your main bot's `index.js` (`new Kythia(dependencies)`).
    * Requires a `dependencies` object containing essential services (`config`, `logger`, `translator`, `redis`, `sequelize`, `helpers`, `utils`, `appRoot`).
    * Requires `dbDependencies` to be set *after* instantiation but *before* `start()`.
    * The `start()` method initiates the entire bot lifecycle (addon loading, DB sync, Discord login).

### `KythiaClient`

* **File:** `src/KythiaClient.js`
* **Role:** An extended `discord.js` Client class. It's pre-configured with recommended intents, partials, and cache settings for a typical large bot. Crucially, the `container` is attached directly to the client instance (`client.container`) for easy access within interactions and events.
* **Usage:** Automatically instantiated by the `Kythia` class constructor. Addons access it via `interaction.client` or `container.client`.

### `KythiaModel`

* **File:** `src/database/KythiaModel.js`
* **Role:** The **base class for ALL Sequelize models** used within the Kythia framework (both core and addons). It provides a powerful, built-in caching layer.
* **Key Features:**
    * **Hybrid Caching:** Prioritizes Redis for shared caching, seamlessly falls back to an in-memory Map cache if Redis is unavailable, ensuring high availability.
    * **Cache Methods:** Provides `getCache(query)`, `getAllCache(query)`, `findOrCreateWithCache(options)`, `countWithCache(options)`, `aggregateWithCache(options)` for efficient data retrieval.
    * **Automatic Invalidation:** Includes Sequelize lifecycle hooks (`afterSave`, `afterDestroy`, `afterBulkUpdate`, etc.) that automatically invalidate relevant cache entries using **tag-based sniper invalidation** for precision.
    * **Dependency Injection:** Requires core dependencies (`logger`, `config`, `redis`) to be injected *once* at startup using the static `KythiaModel.setDependencies({...})` method in your main `index.js`.
    * **Parent Touching:** Includes helpers (`touchParent`, `setupParentTouch`) for automatically updating parent model timestamps when child models change (useful for cache invalidation).
* **Usage:** All addon models **must** `extend KythiaModel` and implement their own `static init(sequelize)` method which calls `super.init(...)`.

### `createSequelizeInstance`

* **File:** `src/database/KythiaSequelize.js`
* **Role:** A factory function that creates and configures the main Sequelize instance based on your bot's configuration.
* **Usage:** Called in your main `index.js` to create the `sequelize` instance that gets passed into the `Kythia` constructor.

### `KythiaORM`

* **File:** `src/database/KythiaORM.js`
* **Role:** An intelligent database synchronization utility designed for safety and efficiency, especially in production.
* **Key Features:**
    * **Loads All Addon Models:** Automatically discovers and requires all model files within the `addons/*/database/models` directories, ensuring Sequelize is aware of them before syncing. Uses the `appRoot` from the container to find the `addons` directory.
    * **Hash-Based Syncing:** Generates a schema hash for each model (`generateModelHash`). It compares this hash against a stored version in the `model_versions` table.
    * **Selective `alter: true`:** Only runs `model.sync({ alter: true })` on models whose schema hash has actually changed, significantly speeding up startup and reducing risk.
    * **Destructive Change Prevention:** Includes a `checkForDestructiveChanges` check. If it detects that syncing would drop columns, it prompts for confirmation in production or warns in development, preventing accidental data loss.
    * **Handles `dbReadyHooks`:** Executes hooks registered via `kythiaInstance.addDbReadyHook()` *after* all models are loaded but *before* syncing (typically used for defining model associations).
    * **Attaches Cache Hooks:** Calls `KythiaModel.attachHooksToAllModels()` after models are ready.
* **Usage:** Called internally by `Kythia.start()`.

### `utils`

* **File:** `src/utils/index.js` (Barrel File)
* **Role:** Exports common utility functions used within the core and potentially by addons.
* **Available Utils:**
    * `color`: Color conversion utilities (e.g., hex to decimal).
    * `formatter`: Data formatting functions.
* **Usage:** Accessed via `require('@kenndeclouv/kythia-core').utils`. Example: `utils.color.convertColor(...)`.

---

## 📦 Installation

```bash
npm install @kenndeclouv/kythia-core
# or
yarn add @kenndeclouv/kythia-core
# or
pnpm add @kenndeclouv/kythia-core
````

**Important:** This package declares `discord.js` as a **peer dependency**. Your main bot application **must** have `discord.js` installed as a direct dependency.

```bash
npm install discord.js
```

-----

## 🚀 Basic Usage (in your main `index.js`)

```javascript
// 1. Load Environment & Aliases (if used)
require('dotenv').config();
const kythiaConfig = require('./kythia.config.js');
require('module-alias/register'); // Important for addon helpers/models if you use aliases

// 2. Import Core Components
const {
  Kythia,
  KythiaModel,
  createSequelizeInstance,
  utils, // Example: Accessing utils
} = require('@kenndeclouv/kythia-core');

// 3. Load Your Addon Helpers (NOT Core Helpers)
//    Core helpers like logger, translator are INJECTED, not required here directly
//    unless they are specifically designed to be standalone.
const logger = require('@coreHelpers/logger'); // Assuming this comes from your 'core' addon
const translator = require('@coreHelpers/translator'); // Assuming this comes from your 'core' addon
const { isTeam, isOwner, embedFooter } = require('@coreHelpers/discord'); // from 'core' addon
const { loadFonts } = require('@coreHelpers/fonts'); // from 'core' addon

// 4. Setup External Dependencies (Redis)
const Redis = require('ioredis');
const redisClient = new Redis(kythiaConfig.db.redis, { lazyConnect: true });

// 5. Setup Sequelize
const sequelize = createSequelizeInstance(kythiaConfig, logger);

// 6. Inject Dependencies into KythiaModel (CRITICAL - DO THIS ONLY ONCE)
KythiaModel.setDependencies({ logger, config: kythiaConfig, redis: redisClient });

// 7. Prepare the Dependency Container Object
const dependencies = {
    config: kythiaConfig,
    logger: logger, // Your logger instance
    translator: translator, // Your translator instance
    redis: redisClient,
    sequelize: sequelize,
    models: {}, // Will be populated by KythiaORM after loading addon models
    helpers: { // Your addon helpers accessible via container
        discord: { isTeam, isOwner, embedFooter },
        fonts: { loadFonts },
        color: utils.color, // Injecting core color util as a helper
        // Add other shared addon helpers here if needed
    },
    appRoot: __dirname, // CRITICAL: Tell the core where your project root is
};

// 8. Instantiate and Start Kythia
try {
    const kythiaInstance = new Kythia(dependencies);

    // Set dependencies needed specifically by KythiaORM/Model Hooks
    kythiaInstance.dbDependencies = {
        KythiaModel,
        logger,
        config: kythiaConfig,
    };

    // Liftoff! 🚀
    kythiaInstance.start();

} catch (error) {
    const log = logger || console;
    log.error('🔥 FATAL ERROR during initialization:', error);
    process.exit(1);
}
```

-----

## 💡 Dependency Injection & The Container (CRITICAL FOR ADDONS)

**Problem:** Loading addons dynamically while allowing addons to use core functionalities (like models or helpers which *also* depend on the core) creates **circular dependencies**. If an addon command file tries to `require` a core helper or model at the top level, Node.js will often fail because the core (`kythia-core`) is still in the middle of loading that addon file\!

**Solution:** The **Dependency Injection Container (`interaction.client.container`)**.

  * The `Kythia` core initializes all essential services and instances (`logger`, `config`, loaded `models`, core `helpers`, etc.) and puts them into the `container`.
  * **Addon commands, events, and other components MUST access these shared resources via the container.** This access typically happens *inside* the function that handles the interaction or event (e.g., inside the `async execute(interaction)` function for commands).

**Example (Inside an Addon Command File):**

```javascript
// addons/your-addon/commands/your-command.js

// ✅ OK: Require external libs or discord.js stuff at top level
const { EmbedBuilder } = require('discord.js');

// ❌ BAD: DO NOT require core helpers or models at the top level!
// const logger = require('@coreHelpers/logger'); // WRONG - Causes circular dependency
// const YourModel = require('../database/models/YourModel'); // WRONG

module.exports = {
  data: /* ... your SlashCommandBuilder ... */,
  async execute(interaction) {
    // ✅ GOOD: Access everything from the container HERE
    const { logger, models, translator, helpers, kythiaConfig } = interaction.client.container;
    const { YourModel } = models; // Get the initialized model
    const { t } = translator; // Get the translation function
    const { someHelper } = helpers.yourCoreHelpers; // Get helpers

    // Now you can safely use them
    logger.info('Executing your command!');
    const data = await YourModel.getCache({ userId: interaction.user.id });
    await interaction.reply(await t(interaction, 'your.translation.key'));
    // ...
  }
}
```

**Adhering to this DI pattern is essential for preventing startup errors.**

-----

## 🧩 Addon Development Integration

`kythia-core` is designed to work seamlessly with your addon structure:

1.  **Discovery:** `AddonManager` scans the `addons/` directory located relative to the `appRoot` provided in the dependencies.
2.  **Metadata (`addon.json`):** Each addon **must** have an `addon.json` file in its root directory. This file provides:
      * `name`: Display name.
      * `version`: Addon version.
      * `description`: What it does.
      * `author`: Who made it.
      * `active` (optional, default `true`): Set to `false` to disable the addon.
      * `featureFlag` (optional): The corresponding boolean key in `ServerSetting` model that toggles this addon's commands per-guild (e.g., `"petOn"`). `AddonManager` uses this to perform automatic checks in `InteractionManager`.
3.  **Initialization (`register.js` - Optional):** If an addon needs to perform setup tasks *after* the core is initialized but *before* the bot logs in (e.g., define model associations, register non-command components), it can include a `register.js` file exporting an `initialize` function:
    ```javascript
    // addons/your-addon/register.js
    module.exports = {
      async initialize(kythiaInstance) {
        // Access core components via kythiaInstance.container
        const { logger } = kythiaInstance.container;

        // Example: Register a button handler
        kythiaInstance.registerButtonHandler('myButtonPrefix', require('./buttons/myButtonHandler'));

        // Example: Define model associations (runs after models are loaded by KythiaORM)
        kythiaInstance.addDbReadyHook((sequelize) => {
          const { ModelA, ModelB } = sequelize.models;
          if (ModelA && ModelB) {
            ModelA.hasMany(ModelB);
            ModelB.belongsTo(ModelA);
            logger.info('🔗 Model associations for YourAddon defined.');
          }
        });

        // Return an array of strings for summary logging (optional)
        return ['✅ YourAddon component registered.'];
      }
    }
    ```
4.  **Command Loading:** `AddonManager` looks for commands within an addon's `commands/` directory. It supports flexible structures:
      * **Simple Commands:** A single `.js` file per command (e.g., `ping.js`).
      * **Grouped Commands (Top-Level):** A `_command.js` file defining the main command (`/image`), with `.js` files for subcommands (`add.js`, `list.js`) and subdirectories for groups (`admin/_group.js` with `add.js`, `delete.js` inside). `subcommand: true` must be set in the subcommand module exports.
      * **Individual Command Folders:** A folder per command (e.g., `ping/`) containing `_command.js` for the main definition and potentially subcommand/group files inside.

-----

## 🗄️ Database Layer (`KythiaModel` & Migrations)

The core abandons traditional `sync()` operations in favor of a robust, **Laravel-style migration system** combined with **Database Introspection**.

### 1. `KythiaModel` (The Base Model)
* **Hybrid Caching:** Provides a zero-config caching layer. It prioritizes **Redis** for distributed caching and falls back to a local **LRU Map** if Redis is unreachable (Shard Mode aware).
* **Auto-Boot Introspection:** You don't need to define attributes manually in your model classes. The `autoBoot` method automatically introspects the database table schema to define Sequelize attributes at runtime.
* **Smart Invalidation:** Includes `afterSave`, `afterDestroy`, and `afterBulk` hooks that automatically invalidate cache entries using **tag-based sniper invalidation** (e.g., clearing `User:ID:1` also clears related queries).

### 2. `KythiaMigrator` (Migration Engine)
* **Addon Scanning:** Automatically discovers migration files located in `addons/*/database/migrations`.
* **Laravel-Style Batching:** Uses a custom `LaravelStorage` adapter for Umzug. It tracks migration **batches** (not just files), allowing you to rollback the entire last deployment (batch) rather than one file at a time.
* **Production Safe:** Schema changes are strictly handled via migration files, eliminating the risk of accidental data loss caused by `sequelize.sync({ alter: true })` in production environments.

-----

## 🔗 Peer Dependencies

  * **`discord.js`:** This is a `peerDependency`. `kythia-core` requires `discord.js` to function, but it expects the *consuming application* (your main bot) to provide it by listing `discord.js` in its own `dependencies`. This prevents version conflicts and issues with `instanceof` checks, especially common when using `npm link` during development. Ensure your main bot project has `discord.js` installed.

-----

## 📜 License

This project is licensed under the CC BY NC 4.0 License - see the [LICENSE](https://www.google.com/search?q=./LICENSE) file for details.
