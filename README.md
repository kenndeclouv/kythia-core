<p align="center">
  <a href="https://kythia.my.id">
    <img src="https://kythia.my.id/assets/img/logo/logo.png" alt="Kythia Logo" height="150" style="border-radius: 10px;">
  </a>
</p>

<h1 align="center">
  Kythia Core
</h1>

<p align="center">
  <strong>Enterprise-Grade Discord Bot Framework</strong><br>
  Modular · Scalable · Production-Ready
</p>

<p align="center">
  <a href="https://github.com/kenndeclouv/kythia-core/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-CC%20BY%20NC%204.0-blue?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/kenndeclouv/kythia-core"><img src="https://img.shields.io/badge/version-0.12.7--beta-green?style=for-the-badge" alt="Version"></a>
  <a href="https://discord.js.org"><img src="https://img.shields.io/badge/discord.js-v14-blue?style=for-the-badge&logo=discord" alt="Discord.js"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="./ARCHITECTURE.md">Architecture</a> ·
  <a href="./CLASS_REFERENCE.md">Class Reference</a> ·
  <a href="./DEV_GUIDE.md">Dev Guide</a> ·
  <a href="./CLI_REFERENCE.md">CLI Tools</a>
</p>

---

## 📚 Documentation

This README provides a quick overview and getting started guide. For comprehensive documentation:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture, design patterns, and data flow
- **[CLASS_REFERENCE.md](./CLASS_REFERENCE.md)** - Full class and method documentation
- **[DEV_GUIDE.md](./DEV_GUIDE.md)** - Development guide, best practices, and patterns
- **[CLI_REFERENCE.md](./CLI_REFERENCE.md)** - CLI tools and commands reference
- **[METRICS.md](./METRICS.md)** - Performance metrics and monitoring guide

---

## 🌟 What is Kythia Core?

**Kythia Core** is a powerful, production-ready framework for building scalable Discord bots. Built on top of discord.js v14, it provides a complete ecosystem for bot development with:

- 🔌 **Addon System** - Modular architecture with hot-loadable addons
- 🗄️ **Advanced ORM** - Hybrid Redis/LRU caching with automatic invalidation
- 🔄 **Migration System** - Laravel-style migrations with batch support
- 🎯 **Smart Routing** - Automatic command, event, and component registration
- 🛡️ **Middleware** - Flexible permission, cooldown, and validation system
- 📦 **Dependency Injection** - Clean, testable architecture with DI container
- 🔧 **CLI Tools** - Powerful development tools for scaffolding and management
- 📊 **Telemetry** - Built-in monitoring with Sentry integration
- 🌐 **i18n** - Complete localization system with auto-translation
- ⏰ **Task Scheduler** - Cron and interval-based task system

---

## 🏗️ Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Kythia Core                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Addon      │  │  Interaction │  │    Event     │     │
│  │   Manager    │  │   Manager    │  │   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Translator  │  │   Shutdown   │  │  Telemetry   │     │
│  │   Manager    │  │   Manager    │  │   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                    Database Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Kythia    │  │    Kythia    │  │   Kythia     │     │
│  │    Model     │  │   Migrator   │  │  Sequelize   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                   Caching Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Redis (Primary) ↔ LRU Map (Fallback)               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

---

## 🚀 Quick Start

### Installation

```bash
npm install kythia-core discord.js
# or
yarn add kythia-core discord.js
# or
pnpm add kythia-core discord.js
```

### Basic Setup

```javascript
// index.js
const { Kythia, KythiaModel, createSequelizeInstance } = require('kythia-core');
const config = require('./kythia.config.js');

// 1. Setup dependencies
const logger = require('./core/helpers/logger');
const translator = require('./core/helpers/translator');
const Redis = require('ioredis');
const redis = new Redis(config.db.redis, { lazyConnect: true });

// 2. Create Sequelize instance
const sequelize = createSequelizeInstance(config, logger);

// 3. Inject dependencies into KythiaModel
KythiaModel.setDependencies({ logger, config, redis });

// 4. Create dependency container
const dependencies = {
  config,
  logger,
  translator,
  redis,
  sequelize,
  models: {},
  helpers: {
    // Your addon helpers
  },
  appRoot: __dirname,
};

// 5. Initialize and start
const kythia = new Kythia(dependencies);
kythia.dbDependencies = { KythiaModel, logger, config };
kythia.start();
```

### Project Structure

```
your-bot/
├── addons/
│   ├── core/                  # Core addon
│   │   ├── addon.json        # Addon metadata
│   │   ├── commands/         # Slash commands
│   │   ├── events/           # Discord events
│   │   ├── buttons/          # Button handlers
│   │   ├── modals/           # Modal handlers
│   │   ├── select_menus/     # Select menu handlers
│   │   ├── tasks/            # Scheduled tasks
│   │   ├── database/
│   │   │   ├── models/       # Sequelize models
│   │   │   └── migrations/   # Database migrations
│   │   └── register.js       # Addon initialization
│   └── feature/              # Feature addon
│       └── ...
├── kythia.config.js          # Bot configuration
├── package.json
└── index.js                  # Entry point
```

---

## ⚙️ Configuration

Create `kythia.config.js`:

```javascript
module.exports = {
  bot: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    testGuildId: process.env.TEST_GUILD_ID,
  },
  db: {
    mysql: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
  },
  addons: {
    // Addon configuration
    core: { active: true, priority: 0 },
    feature: { active: true, priority: 50 },
  },
};
```

---

## 🔌 Creating Your First Addon

### 1. Create addon structure

```bash
npx kythia make:addon --name myfeature
```

### 2. Define addon metadata

```json
// addons/myfeature/addon.json
{
  "name": "myfeature",
  "version": "1.0.0",
  "priority": 50,
  "dependencies": ["core"]
}
```

### 3. Create a command

```javascript
// addons/myfeature/commands/hello.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Say hello!'),
    
  async execute(interaction) {
    const { logger } = interaction.client.container;
    
    logger.info('Hello command executed!');
    await interaction.reply('Hello, World!');
  }
};
```

### 4. Create a scheduled task

```javascript
// addons/myfeature/tasks/daily-report.js
module.exports = {
  schedule: '0 0 * * *', // Daily at midnight
  
  async execute(container) {
    const { logger } = container;
    logger.info('Running daily report...');
  }
};
```

See [DEV_GUIDE.md](./DEV_GUIDE.md) for complete addon development guide.

---

## 🗄️ Database & Models

### Creating a Model

```bash
npx kythia make:model --name User --addon myfeature
```

```javascript
// addons/myfeature/database/models/User.js
const { KythiaModel } = require('kythia-core');
const { DataTypes } = require('sequelize');

class User extends KythiaModel {
  static tableName = 'users';
  
  static init(sequelize) {
    return super.init({
      userId: {
        type: DataTypes.STRING,
        unique: true,
      },
      username: DataTypes.STRING,
      points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    }, {
      sequelize,
      modelName: 'User',
      tableName: this.tableName,
    });
  }
}

module.exports = User;
```

### Using the Model with Cache

```javascript
// In your command
const { models } = interaction.client.container;
const { User } = models;

// Get with cache (auto Redis/LRU)
const user = await User.getCache({
  where: { userId: interaction.user.id }
});

// Create with cache invalidation
const newUser = await User.create({
  userId: interaction.user.id,
  username: interaction.user.username,
});
```

### Creating Migrations

```bash
npx kythia make:migration --name create_users_table --addon myfeature
```

```javascript
// addons/myfeature/database/migrations/20250128000000_create_users_table.js
module.exports = {
  up: async (queryInterface, DataTypes) => {
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.STRING,
        unique: true,
      },
      points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    });
  },
  
  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  }
};
```

Run migrations:
```bash
npx kythia migrate
```

---

## 🛠️ CLI Tools

Kythia Core includes powerful CLI tools:

```bash
# Database
npx kythia migrate                    # Run migrations
npx kythia migrate --fresh            # Fresh migration
npx kythia migrate --rollback         # Rollback last batch
npx kythia make:migration             # Create migration
npx kythia make:model                 # Create model
npx kythia cache:clear                # Clear Redis cache

# Localization
npx kythia lang:check                 # Check translation keys
npx kythia lang:translate --target ja # Auto-translate

# Development
npx kythia dev:namespace              # Add JSDoc headers
npx kythia gen:structure              # Generate project tree
npx kythia version:up                 # Sync version tags
```

See [CLI_REFERENCE.md](./CLI_REFERENCE.md) for complete command reference.

---

## 🎯 Key Features

### Addon Dependency Management

```json
{
  "name": "analytics",
  "priority": 50,
  "dependencies": ["core", "database"]
}
```

Addons are loaded in dependency order with automatic validation.

### Task Scheduling

```javascript
// Cron-based
module.exports = {
  schedule: '*/5 * * * *', // Every 5 minutes
  execute: async (container) => { /* ... */ }
};

// Interval-based
module.exports = {
  schedule: 60000, // Every 60 seconds
  execute: async (container) => { /* ... */ }
};
```

### Middleware System

```javascript
const { botPermissions } = require('kythia-core/middlewares');

module.exports = {
  data: /* ... */,
  middlewares: [
    botPermissions(['SendMessages', 'EmbedLinks']),
  ],
  execute: async (interaction) => { /* ... */ }
};
```

### Hybrid Caching

Automatic Redis + LRU fallback with tag-based invalidation:

```javascript
// Automatically uses Redis if available, falls back to LRU
const user = await User.getCache({ where: { id: 1 } });

// Automatic cache invalidation on updates
await user.update({ points: 100 }); // Cache auto-cleared
```

---

## 📖 Advanced Topics

- **[Dependency Injection Pattern](./DEV_GUIDE.md#dependency-injection)** - Avoiding circular dependencies
- **[Migration Best Practices](./DEV_GUIDE.md#migrations)** - Safe schema management
- **[Cache Strategies](./DEV_GUIDE.md#caching)** - Optimizing performance
- **[Addon Architecture](./ARCHITECTURE.md#addon-system)** - Building scalable addons
- **[Testing Guide](./DEV_GUIDE.md#testing)** - Writing tests for your bot
- **[Deployment](./DEV_GUIDE.md#deployment)** - Production deployment guide

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines.

---

## 📜 License

This project is licensed under the CC BY NC 4.0 License - see the [LICENSE](./LICENSE) file for details.

---

## 🔗 Links

- [Documentation](./ARCHITECTURE.md)
- [Class Reference](./CLASS_REFERENCE.md)
- [Developer Guide](./DEV_GUIDE.md)
- [CLI Reference](./CLI_REFERENCE.md)
- [GitHub Issues](https://github.com/kenndeclouv/kythia-core/issues)
- [Discord Server](https://discord.gg/your-server)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/kenndeclouv">kenndeclouv</a>
</p>
