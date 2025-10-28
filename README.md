# Kythia Core

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.9.10--beta-blue.svg)](https://semver.org)

> A powerful Discord.js framework for building scalable and maintainable Discord bots

## 🚀 Features

- **Modular Architecture**: Built with a modular design for better code organization
- **Database Integration**: Built-in support for Sequelize ORM
- **Addon System**: Extend functionality through addons
- **Event Management**: Robust event handling system
- **Error Handling**: Comprehensive error handling and logging
- **Type Support**: Full TypeScript type definitions

## 📦 Installation

```bash
npm install kythia-core
# or
yarn add kythia-core
```

## 🛠️ Basic Usage

### Initializing Kythia

```javascript
import Kythia, { KythiaClient, createSequelizeInstance } from 'kythia-core';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Kythia
const kythia = new Kythia({
  // Required dependencies
  config: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
  },
  logger: console,
  translator: {
    t: (key) => key, // i18n function
    loadLocales: () => ({}),
  },
  // Other dependencies...
});

// Start the bot
kythia.start()
  .then(() => console.log('Kythia is running!'))
  .catch(console.error);
```

### Creating a Simple Command

```javascript
// commands/ping.js
export default {
  name: 'ping',
  description: 'Check bot latency',
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    
    await interaction.editReply(
      `🏓 Pong!\n` +
      `Latency: ${latency}ms\n` +
      `API: ${Math.round(interaction.client.ws.ping)}ms`
    );
  },
};
```

### Database Models

```javascript
import { Model, DataTypes } from 'sequelize';
import { KythiaModel } from 'kythia-core';

class User extends KythiaModel {
  static attributes = {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // ... other fields
  };
  
  // Custom methods
  getFullName() {
    return `${this.username}#${this.discriminator}`;
  }
}

export default User;
```

## 📚 API Reference

### Core Classes

- `Kythia`: Main bot class that orchestrates all components
- `KythiaClient`: Extended Discord.js Client with additional functionality

### Database

- `KythiaModel`: Base model class extending Sequelize Model
- `KythiaORM`: ORM wrapper for database operations
- `createSequelizeInstance`: Factory function for creating Sequelize instances

### Managers

- `AddonManager`: Manages loading and unloading of addons
- `EventManager`: Handles Discord.js events
- `InteractionManager`: Manages application commands and interactions
- `ShutdownManager`: Handles graceful shutdown procedures

## 🌟 Advanced Usage

### Creating Addons

```javascript
// addons/my-addon/index.js
export default {
  name: 'my-addon',
  version: '1.0.0',
  
  async load(kythia) {
    // Initialize your addon
    console.log('My addon loaded!');
    
    // Register commands, events, etc.
    kythia.interactions.registerCommand({
      name: 'hello',
      description: 'Says hello',
      execute: (interaction) => interaction.reply('Hello from my addon!'),
    });
  },
  
  async unload(kythia) {
    // Cleanup when addon is unloaded
    console.log('My addon unloaded!');
  },
};
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📜 Credits

- **Author**: kenndeclouv
- **Version**: 0.9.10-beta
- **License**: MIT
