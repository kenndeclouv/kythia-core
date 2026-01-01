# Kythia Core - CLI Tools Reference

> Complete reference for all command-line tools and utilities

---

## Table of Contents

- [Overview](#overview)
- [Database Commands](#database-commands)
- [Localization Commands](#localization-commands)
- [Development Commands](#development-commands)
- [About Command](#about-command)

---

## Overview

Kythia Core includes a comprehensive CLI toolset accessible via:

```bash
npx kythia <command> [options]
```

View all commands:
```bash
npx kythia --help
```

---

## Database Commands

### migrate

Run pending database migrations.

#### Usage

```bash
npx kythia migrate [options]
```

#### Options

- `-f, --fresh` - **[DANGER]** Drop all tables and re-run all migrations
- `-r, --rollback` - Rollback the last batch of migrations

#### Examples

**Run pending migrations:**
```bash
npx kythia migrate
```

**Fresh migration (DESTRUCTIVE):**
```bash
npx kythia migrate --fresh
```

**Rollback last batch:**
```bash
npx kythia migrate --rollback
```

#### How It Works

1. Scans `addons/*/database/migrations`
2. Sorts by timestamp
3. Compares with `migrations` table
4. Runs pending migrations
5. Records in batch for rollback support

#### Notes

- Migrations are tracked in batches (Laravel-style)
- Rollback only affects last batch
- Fresh migration will **destroy all data**

---

### make:migration

Create a new timestamped migration file.

#### Usage

```bash
npx kythia make:migration --name <migration_name> --addon <addon_name>
```

#### Options

- `--name <string>` - Migration name (required, snake_case recommended)
- `--addon <string>` - Target addon name (required)

#### Example

```bash
npx kythia make:migration --name create_users_table --addon core
```

#### Output

Creates file: `addons/core/database/migrations/20250128120000_create_users_table.js`

#### Template

```javascript
module.exports = {
  up: async (queryInterface, DataTypes) => {
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // Add columns here
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    });
  },
  
  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  }
};
```

---

### make:model

Scaffold a new Sequelize model file.

#### Usage

```bash
npx kythia make:model --name <ModelName> --addon <addon_name>
```

#### Options

- `--name <string>` - Model name (required, PascalCase recommended)
- `--addon <string>` - Target addon name (required)

#### Example

```bash
npx kythia make:model --name User --addon core
```

#### Output

Creates file: `addons/core/database/models/User.js`

#### Template

```javascript
const { KythiaModel } = require('kythia-core');
const { DataTypes } = require('sequelize');

class User extends KythiaModel {
  static tableName = 'users';
  
  static init(sequelize) {
    return super.init({
      // Define attributes here
      userId: {
        type: DataTypes.STRING,
        unique: true,
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

---

### db:seed

Seed the database with records.

#### Usage

```bash
npx kythia db:seed [options]
```

#### Options

- `--class <string>` - Run a specific seeder class
- `--addon <string>` - Run seeders only from this addon

#### Examples

**Run all seeders:**
```bash
npx kythia db:seed
```

**Run specific seeder:**
```bash
npx kythia db:seed --class UserSeeder
```

**Run seeders from specific addon:**
```bash
npx kythia db:seed --addon core
```

---

### make:seeder

Create a new seeder file.

#### Usage

```bash
npx kythia make:seeder <name> --addon <addon>
```

#### Options

- `--addon <string>` - Target addon name (required)

#### Example

```bash
npx kythia make:seeder UserSeeder --addon core
```

#### Output

Creates file: `addons/core/database/seeders/UserSeeder.ts`

```typescript
import { Seeder } from 'kythia-core';

export default class UserSeeder extends Seeder {
  public async run(): Promise<void> {
    const { User } = this.container.models;
    
    await User.bulkCreate([
      { username: 'Admin', discriminator: '0001', role: 'admin' },
      { username: 'Moderator', discriminator: '0002', role: 'mod' },
      { username: 'User', discriminator: '0003', role: 'user' },
    ]);
  }
}
```

---

### cache:clear

Flush Redis cache.

#### Usage

```bash
npx kythia cache:clear
```

#### Features

- Supports multiple Redis instances
- Interactive selection if `REDIS_URLS` configured
- Confirms before clearing

#### Example Output

```
🗑️  Redis Cache Clearer
━━━━━━━━━━━━━━━━━━━━━━━━━

? Select Redis instance:
  ❯ Main (redis://localhost:6379)
    Backup (redis://backup:6379)
    All instances

✅ Cache cleared successfully!
```

---

## Localization Commands

### lang:check

Lint translation key usage in code.

#### Usage

```bash
npx kythia lang:check
```

#### Features

- **Static Analysis** - Uses AST parsing to find `t('key')` calls
- **Missing Keys** - Reports keys used in code but not in JSON
- **Unused Keys** - Reports keys in JSON but never used
- **Multi-file** - Scans entire codebase

#### Example Output

```
📝 Translation Key Checker
━━━━━━━━━━━━━━━━━━━━━━━━━

Scanning files...
✅ Found 150 translation calls

Checking en.json...
❌ Missing keys:
  - welcome.new_user
  - error.invalid_input

⚠️  Unused keys:
  - old.deprecated_key
  - test.example

Summary:
  150 keys used
  2 missing
  1 unused
```

---

### lang:translate

Auto-translate using Google GenAI.

#### Usage

```bash
npx kythia lang:translate --target <language_code>
```

#### Options

- `--target <lang>` - Target language code (default: `ja`)

#### Requirements

- `GEMINI_API_KEYS` environment variable set
- `en.json` as source file

#### Example

```bash
npx kythia lang:translate --target ja
```

#### Process

1. Reads `en.json`
2. Connects to Gemini API
3. Translates all keys
4. Writes to `ja.json`
5. Preserves formatting and structure

#### Example Output

```
🌐 Auto-Translator (Gemini AI)
━━━━━━━━━━━━━━━━━━━━━━━━━

Source: en.json (150 keys)
Target: ja (Japanese)

Translating...
✅ welcome.message
✅ error.not_found
✅ command.help.description
...

✅ Translation complete!
Saved to: addons/core/lang/ja.json
```

---

### lang:sync

Synchronize translation files.

#### Usage

```bash
npx kythia lang:sync
```

#### Features

- Syncs keys across all language files
- Adds missing keys with placeholder `[placeholder]`
- Removes unused keys
- Preserves existing translations

#### Example Output

```
🔄 Translation Sync
━━━━━━━━━━━━━━━━━━━━━━━━━

Syncing with en.json (master)...

ja.json:
  + Added 5 new keys
  - Removed 2 unused keys
  ✅ Synced

id.json:
  + Added 5 new keys
  ✅ Synced
```

---

## Development Commands

### docs:generate

Generate markdown documentation for all Discord commands.

#### Usage

```bash
npx kythia docs:generate [options]
```

#### Options

- `-p, --path <path>` - Custom output path for documentation (default: `docs/commands`)

#### Features

- Supports simple and split command structures
- Generates metadata (permissions, cooldowns, aliases)
- Resolves module aliases from `package.json`

#### Example

**Generate to default path:**
```bash
npx kythia docs:generate
```

**Generate to specific path:**
```bash
npx kythia docs:generate -p src/docs
```

---

### di:generate

Generate TypeScript definitions for Dependency Injection.

#### Usage

```bash
npx kythia di:generate
```

#### Features

- **Smart Analysis** - Reads `index.js` AST to find injected helpers
- **Auto Discovery** - Scans filesystem for Models and Helpers
- **Type Safety** - Generates `types/auto-di.d.ts` for IntelliSense

#### Example Output

```
🧙‍♂️ Kythia Type Wizard (Smart Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━

📖 Reading index.js to find injected helpers...
   > Detected keys: color, currency

✨ Done! Generated types matching your index.js dependencies.
```

---

### dev:namespace

Add/update JSDoc `@namespace` headers.

#### Usage

```bash
npx kythia dev:namespace
```

#### Features

- Scans all `.js`/`.ts` files
- Adds JSDoc headers if missing
- Updates existing headers
- Maintains file ownership

#### Template

```javascript
/**
 * @file <relative_path>
 * @namespace <addon_name>/<path>
 * @copyright © 2025 kenndeclouv
 * @version 0.12.7-beta
 */
```

#### Example Output

```
📝 Namespace Header Generator
━━━━━━━━━━━━━━━━━━━━━━━━━

Scanning files...
✅ Updated: src/Kythia.js
✅ Updated: src/managers/AddonManager.js
⏭️  Skipped: src/utils/index.js (already exists)

Summary:
  50 files scanned
  35 updated
  15 skipped
```

---

### gen:structure

Generate project structure markdown.

#### Usage

```bash
npx kythia gen:structure
```

#### Output

Creates `temp/structure.md` with project tree:

```
kythia-core/
├── src/
│   ├── Kythia.ts
│   ├── KythiaClient.ts
│   ├── managers/
│   │   ├── AddonManager.ts
│   │   ├── EventManager.ts
│   │   └── ...
│   └── ...
├── package.json
└── README.md
```

#### Use Cases

- Documentation
- Sharing context with AI
- Project overview

---

### version:up

Sync JSDoc `@version` tags with `package.json`.

#### Usage

```bash
npx kythia version:up
```

#### Features

- Reads version from `package.json`
- Updates all JSDoc `@version` tags
- Maintains consistency across codebase

#### Example

If `package.json` has `0.13.0`, updates all files:

```javascript
/**
 * @version 0.13.0
 */
```

#### Example Output

```
🔢 Version Sync
━━━━━━━━━━━━━━━━━━━━━━━━━

package.json version: 0.13.0

Updated files:
✅ src/Kythia.ts (0.12.7 → 0.13.0)
✅ src/managers/AddonManager.ts (0.12.7 → 0.13.0)

Summary:
  50 files updated
```

---

## About Command

View detailed information about Kythia Core.

#### Usage

```bash
npx kythia about
```

#### Output

```
╔═══════════════════════════════════════╗
║         🚀 Kythia Core v0.12.7        ║
╚═══════════════════════════════════════╝

📦 Package Information
   Name:        kythia-core
   Version:     0.12.7-beta
   License:     CC BY NC 4.0
   Author:      kenndeclouv

🏗️  Architecture
   • Addon System
   • Advanced ORM with Hybrid Caching
   • Laravel-style Migrations
   • Task Scheduler (Cron + Interval)
   • Middleware System
   • Dependency Injection

📚 Documentation
   • README.md
   • ARCHITECTURE.md
   • CLASS_REFERENCE.md
   • DEV_GUIDE.md

🔗 Links
   • GitHub: github.com/kenndeclouv/kythia-core
   • License: github.com/kenndeclouv/kythia-core/blob/main/LICENSE
```

---

## Global Options

All commands support:

- `--help` - Show command help
- `--version` - Show Kythia Core version

---

## Configuration

### Environment Variables

Some commands require environment variables:

```env
# For lang:translate
GEMINI_API_KEYS=your_api_key

# For cache:clear (if multiple instances)
REDIS_URLS=redis://main:6379,redis://backup:6379

# For migrations
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kythia
DB_USER=root
DB_PASS=password
```

### kythia.config.js

Migration and model commands use configuration from:

```javascript
// kythia.config.js
module.exports = {
  db: {
    mysql: {
      host: process.env.DB_HOST,
      // ...
    },
  },
};
```

---

## Tips & Best Practices

### Migrations

1. **Always create migration before modifying models**
2. **Test rollback before deploying**
3. **Use descriptive names** (e.g., `add_email_to_users`)
4. **One change per migration** for easier rollbacks

### Translations

1. **Run `lang:check` before commits**
2. **Use namespaced keys** (e.g., `command.ping.description`)
3. **Keep `en.json` as master**
4. **Review AI translations** before deploying

### Development

1. **Run `version:up` after version bumps**
2. **Use `gen:structure`** when sharing context
3. **Add namespaces** for better code organization

---

For more information, see [DEV_GUIDE.md](./DEV_GUIDE.md).
