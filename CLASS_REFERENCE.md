# Kythia Core - Class & Method Reference

> Complete reference for all exported classes, methods, and utilities

---

## Table of Contents

- [Core Exports](#core-exports)
- [Kythia Class](#kythia-class)
- [KythiaClient Class](#kythiaclient-class)
- [Managers](#managers)
  - [AddonManager](#addonmanager)
  - [InteractionManager](#interactionmanager)
  - [EventManager](#eventmanager)
  - [ShutdownManager](#shutdownmanager)
  - [TelemetryManager](#telemetrymanager)
  - [TranslatorManager](#translatormanager)
- [Database Classes](#database-classes)
  - [KythiaModel](#kythiamodel)
  - [KythiaMigrator](#kythiamigrator)
  - [ModelLoader](#modelloader)
- [Utilities](#utilities)
- [Middlewares](#middlewares)
- [Type Definitions](#type-definitions)

---

## Core Exports

Main exports from `kythia-core`:

```typescript
import { 
  Kythia,                    // Main orchestrator
  KythiaClient,              // Extended Discord client
  KythiaModel,               // Base model class
  createSequelizeInstance,   // Sequelize factory
  utils,                     // Utility functions
  BaseCommand,               // Base command class (optional)
} from 'kythia-core';
```

### BaseCommand (Optional)

**File:** `src/structures/BaseCommand.ts`

Optional base class for creating commands using class syntax.

**Usage:**
```javascript
const { BaseCommand } = require('kythia-core');

class PingCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'ping';
    this.description = 'Ping the bot';
  }
  
  async execute(interaction) {
    await interaction.reply('Pong!');
  }
}

module.exports = PingCommand;
```

> **Note:** BaseCommand is optional. You can use plain module exports for commands.

---

## Kythia Class

**File:** `src/Kythia.ts`

Main orchestrator class that manages the entire bot lifecycle.

### Constructor

```typescript
constructor(dependencies: KythiaDependencies)
```

**Parameters:**
- `dependencies.config` - Bot configuration object
- `dependencies.logger` - Logger instance
- `dependencies.translator` - Translator instance
- `dependencies.redis` - Redis client
- `dependencies.sequelize` - Sequelize instance
- `dependencies.models` - Models object (populated later)
- `dependencies.helpers` - Helper functions
- `dependencies.appRoot` - Project root directory path

**Example:**
```javascript
const kythia = new Kythia({
  config: kythiaConfig,
  logger: logger,
  translator: translator,
  redis: redisClient,
  sequelize: sequelize,
  models: {},
  helpers: { /* ... */ },
  appRoot: __dirname,
});
```

### Properties

#### `client: IKythiaClient`
Extended Discord.js client instance.

#### `container: KythiaContainer`
Dependency injection container with all services.

#### `dbDependencies`
Database-specific dependencies (must be set before `start()`).

```typescript
kythia.dbDependencies = {
  KythiaModel,
  logger,
  config: kythiaConfig,
};
```

### Methods

#### `start(): Promise<void>`
Start the bot lifecycle.

**Flow:**
1. Initialize telemetry
2. Load addons
3. Boot database
4. Login to Discord
5. Setup shutdown hooks

**Example:**
```javascript
await kythia.start();
```

#### `addDbReadyHook(callback: Function): void`
Register a callback to run after models are loaded.

**Use case:** Define model associations

**Example:**
```javascript
kythia.addDbReadyHook((sequelize) => {
  const { User, Profile } = sequelize.models;
  User.hasOne(Profile);
  Profile.belongsTo(User);
});
```

---

## KythiaClient Class

**File:** `src/KythiaClient.ts`

Extended Discord.js Client with pre-configured settings.

### Properties

#### `container: KythiaContainer`
Access to all services and managers.

```javascript
const { logger, models, config } = client.container;
```

#### `commands: Collection<string, CommandModule>`
All registered commands.

### Pre-configured Settings

- **Intents:** All non-privileged + GuildMembers + MessageContent
- **Partials:** Message, Channel, Reaction
- **Caching:** Optimized for performance

---

## Managers

### AddonManager

**File:** `src/managers/AddonManager.ts`

Manages addon loading, priority, and dependencies.

#### Methods

##### `loadAddons(kythiaInstance): Promise<CommandData[]>`
Load and register all addons.

**Returns:** Array of command data for Discord API

##### `registerButtonHandler(customId: string, handler: Function): void`
Register a button click handler.

**Example:**
```javascript
addonManager.registerButtonHandler('confirm', async (interaction) => {
  await interaction.reply('Confirmed!');
});
```

##### `registerModalHandler(customIdPrefix: string, handler: Function): void`
Register a modal submit handler.

##### `registerSelectMenuHandler(customIdPrefix: string, handler: Function): void`
Register a select menu handler.

##### `registerTaskHandler(taskName: string, execute: Function, schedule: string | number): void`
Register a scheduled task.

**Parameters:**
- `taskName` - Unique task identifier
- `execute` - Task function
- `schedule` - Cron pattern (string) or interval (number in ms)

**Example:**
```javascript
addonManager.registerTaskHandler(
  'daily-cleanup',
  async (container) => {
    const { logger } = container;
    logger.info('Running cleanup...');
  },
  '0 0 * * *' // Daily at midnight
);
```

##### `getHandlers()` 
Get all registered handlers.

**Returns:**
```typescript
{
  buttonHandlers: Map<string, Function>,
  modalHandlers: Map<string, Function>,
  selectMenuHandlers: Map<string, Function>,
  autocompleteHandlers: Map<string, Function>,
  taskHandlers: Map<string, KythiaTaskHandler>,
  eventHandlers: Map<string, Function[]>,
}
```

---

### InteractionManager

**File:** `src/managers/InteractionManager.ts`

Handles all Discord interactions.

#### Methods

##### `handleInteraction(interaction: Interaction): Promise<void>`
Main interaction router.

**Handles:**
- Slash commands
- Context menus
- Buttons
- Modals
- Select menus
- Autocomplete

---

### EventManager

**File:** `src/managers/EventManager.ts`

Routes Discord events to addon handlers.

#### Methods

##### `registerEvent(eventName: string, handler: Function): void`
Register an event handler.

**Example:**
```javascript
eventManager.registerEvent('messageCreate', async (message, container) => {
  const { logger } = container;
  logger.info(`Message: ${message.content}`);
});
```

##### `attachEventListeners(client: Client): void`
Attach all event listeners to Discord client.

---

### ShutdownManager

**File:** `src/managers/ShutdownManager.ts`

Manages graceful shutdown.

#### Methods

##### `registerShutdownHook(callback: Function): void`
Register a cleanup function for shutdown.

**Example:**
```javascript
shutdownManager.registerShutdownHook(async () => {
  await database.close();
  logger.info('Database closed');
});
```

##### `initializeGlobalIntervalTracker(): void`
Patch global `setInterval` for automatic tracking.

**Note:** Called automatically during initialization.

---

### TelemetryManager

**File:** `src/managers/TelemetryManager.ts`

Error tracking and monitoring.

#### Methods

##### `report(level: 'error' | 'warning' | 'info', message: string, extra?: object): void`
Report an event to Sentry.

**Example:**
```javascript
telemetryManager.report('error', 'Command failed', {
  command: 'ping',
  user: interaction.user.id,
  error: error.message,
});
```

---

### TranslatorManager

**File:** `src/managers/TranslatorManager.ts`

Localization and translations.

#### Methods

##### `loadLocalesFromDir(directory: string): void`
Load locale files from a directory.

**Example:**
```javascript
translatorManager.loadLocalesFromDir('./addons/core/lang');
```

##### `t(interaction: Interaction, key: string, variables?: object): Promise<string>`
Translate a key for user's locale.

**Example:**
```javascript
const message = await translator.t(interaction, 'welcome_message', {
  user: interaction.user.username
});
```

##### `getLocales(): Map<string, object>`
Get all loaded locales.

---

## Database Classes

### KythiaModel

**File:** `src/database/KythiaModel.ts`

Base model class with caching.

#### Static Methods

##### `setDependencies(deps: object): void`
**CRITICAL:** Must be called once at startup.

```javascript
KythiaModel.setDependencies({
  logger: logger,
  config: kythiaConfig,
  redis: redisClient,
});
```

##### `autoBoot(sequelize: Sequelize): Promise<void>`
Auto-introspect table schema and define model.

**Called automatically by ModelLoader.**

#### Instance Methods (Cache)

##### `static getCache(query: FindOptions): Promise<Model | null>`
Get single record with caching.

**Example:**
```javascript
const user = await User.getCache({
  where: { userId: '123' }
});
```

##### `static getAllCache(query: FindOptions): Promise<Model[]>`
Get multiple records with caching.

##### `static findOrCreateWithCache(options): Promise<[Model, boolean]>`
Find or create with cache.

##### `static countWithCache(options): Promise<number>`
Count with cache.

##### `static aggregateWithCache(options): Promise<any>`
Aggregate query with cache.

#### Cache Methods

##### `invalidateCache(): Promise<void>`
Manually invalidate cache for this model.

---

### KythiaMigrator

**File:** `src/database/KythiaMigrator.ts`

Migration system.

#### Function Export

```typescript
KythiaMigrator({ sequelize, container, logger }): Promise<void>
```

**Called automatically by Kythia.start().**

---

### ModelLoader

**File:** `src/database/ModelLoader.ts`

Auto-loads models from addons.

#### Function Export

```typescript
bootModels(kythiaInstance, sequelize): Promise<void>
```

**Called automatically by Kythia.start().**

---

## Utilities

### convertColor

**File:** `src/utils/color.ts`

Color conversion utility (direct function export).

#### `convertColor(color: string): number`
Convert hex color to decimal.

**Example:**
```javascript
const { utils } = require('kythia-core');
const decimal = utils.convertColor('#FF0000'); // 16711680
```

### formatter

**File:** `src/utils/formatter.ts`

Data formatting utilities.

#### `formatDuration(ms: number): string`
Format milliseconds to human-readable duration.

#### `formatNumber(num: number): string`
Format number with commas.

---

## Middlewares

Middlewares are used to validate commands before execution. They are defined in command modules directly.

> **Note:** Middlewares are NOT exported from kythia-core. They are implemented by the middleware manager and accessed via command properties.

### botPermissions

**File:** `src/middlewares/botPermissions.ts`

Check if bot has required permissions.

**Usage:**
```javascript
// In your command file
module.exports = {
  data: /* SlashCommandBuilder */,
  
  // Define middleware via command properties
  botPermissions: ['SendMessages', 'EmbedLinks'],
  
  execute: async (interaction) => { /* ... */ }
};
```

**Alternative (direct middleware array):**
```javascript
const botPermissionsMiddleware = require('kythia-core/dist/middlewares/botPermissions').default;

module.exports = {
  middlewares: [botPermissionsMiddleware],
  execute: async (interaction) => { /* ... */ }
};
```

### userPermissions

Check if user has required permissions.

**Usage:**
```javascript
module.exports = {
  data: /* SlashCommandBuilder */,
  userPermissions: ['ManageMessages'],
  execute: async (interaction) => { /* ... */ }
};
```

### cooldown

Rate limiting middleware.

**Usage:**
```javascript
module.exports = {
  data: /* SlashCommandBuilder */,
  cooldown: 5000, // 5 seconds in milliseconds
  execute: async (interaction) => { /* ... */ }
};
```

### ownerOnly

Restrict to bot owner only.

**Usage:**
```javascript
module.exports = {
  data: /* SlashCommandBuilder */,
  ownerOnly: true,
  execute: async (interaction) => { /* ... */ }
};
```

### isInMainGuild

Restrict to main guild only.

**Usage:**
```javascript
module.exports = {
  data: /* SlashCommandBuilder */,
  isInMainGuild: true,
  execute: async (interaction) => { /* ... */ }
};
```

---

## Type Definitions

### KythiaContainer

```typescript
interface KythiaContainer {
  config: KythiaConfig;
  logger: Logger;
  translator: TranslatorManager;
  redis: Redis;
  sequelize: Sequelize;
  models: { [key: string]: typeof Model };
  helpers: { [key: string]: any };
  client: IKythiaClient;
  kythiaConfig: KythiaConfig;
  telemetry?: TelemetryManager;
}
```

### CommandModule

```typescript
interface CommandModule {
  data: SlashCommandBuilder;
  middlewares?: Middleware[];
  prefixCommand?: {
    name: string;
    aliases?: string[];
    description: string;
  };
  execute: (interaction: Interaction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
```

### KythiaTaskHandler

```typescript
interface KythiaTaskHandler {
  execute: (container: KythiaContainer) => Promise<void> | void;
  schedule: string | number;
  taskName?: string;
  active?: boolean;
  stopped?: boolean;
  cronTask?: ScheduledTask;
}
```

---

## Usage Examples

### Complete Bot Setup

```javascript
const { Kythia, KythiaModel, createSequelizeInstance } = require('kythia-core');
const config = require('./kythia.config.js');

// Setup
const logger = require('./core/helpers/logger');
const translator = require('./core/helpers/translator');
const Redis = require('ioredis');
const redis = new Redis(config.db.redis, { lazyConnect: true });
const sequelize = createSequelizeInstance(config, logger);

// Inject dependencies
KythiaModel.setDependencies({ logger, config, redis });

// Create container
const dependencies = {
  config,
  logger,
  translator,
  redis,
  sequelize,
  models: {},
  helpers: {},
  appRoot: __dirname,
};

// Start
const kythia = new Kythia(dependencies);
kythia.dbDependencies = { KythiaModel, logger, config };
await kythia.start();
```

### Using Container in Commands

```javascript
module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View profile'),
    
  async execute(interaction) {
    // Access everything from container
    const { logger, models, translator, helpers } = interaction.client.container;
    const { User } = models;
    const { t } = translator;
    
    // Use cached model
    const user = await User.getCache({
      where: { userId: interaction.user.id }
    });
    
    // Translate message
    const message = await t(interaction, 'profile.welcome', {
      points: user.points
    });
    
    // Log activity
    logger.info(`Profile viewed: ${interaction.user.tag}`);
    
    await interaction.reply(message);
  }
};
```

### Creating a Scheduled Task

```javascript
// addons/myfeature/tasks/daily-cleanup.js
module.exports = {
  schedule: '0 0 * * *', // Midnight daily
  taskName: 'daily-cleanup',
  
  async execute(container) {
    const { logger, models } = container;
    const { TempData } = models;
    
    // Cleanup old data
    const deleted = await TempData.destroy({
      where: {
        createdAt: {
          [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });
    
    logger.info(`Cleaned up ${deleted} temp records`);
  }
};
```

---

For architectural details, see [ARCHITECTURE.md](./ARCHITECTURE.md).

For development guide, see [DEV_GUIDE.md](./DEV_GUIDE.md).
