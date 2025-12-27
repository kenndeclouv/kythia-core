# Kythia Core - Architecture Documentation

> Complete system architecture, design patterns, data flow, and internal components

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Components](#core-components)
  - [Kythia Orchestrator](#kythia-orchestrator)
  - [Manager System](#manager-system)
  - [Database Layer](#database-layer)
  - [Caching Layer](#caching-layer)
- [Addon System](#addon-system)
- [Data Flow](#data-flow)
- [Design Patterns](#design-patterns)

---

## Overview

Kythia Core is built on a **layered architecture** with **dependency injection** at its core. The framework separates concerns into distinct layers, each responsible for specific functionality.

### Architecture Principles

1. **Separation of Concerns** - Each manager handles a specific domain
2. **Dependency Injection** - Loose coupling through DI container
3. **Plugin Architecture** - Extensible through addon system
4. **Fail-Safe Design** - Graceful degradation (Redis → LRU fallback)
5. **Event-Driven** - React to Discord events efficiently

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application Layer                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Your Bot (index.js)                    │  │
│  │  - Configuration                                         │  │
│  │  - Dependency Setup                                      │  │
│  │  - Kythia Initialization                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Kythia Core Layer                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Kythia Orchestrator                     │  │
│  │  - Lifecycle Management                                  │  │
│  │  - Manager Initialization                                │  │
│  │  -  Dependency Container                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐  │
│  │    Addon     │ Interaction  │    Event     │   Other    │  │
│  │   Manager    │   Manager    │   Manager    │  Managers  │  │
│  │              │              │              │            │  │
│  │ - Discovery  │ - Routing    │ - Routing    │ - Telemetry│  │
│  │ - Loading    │ - Middleware │ - Dispatch   │ - Shutdown │  │
│  │ - Priority   │ - DI         │              │ - i18n     │  │
│  │ - Deps       │              │              │            │  │
│  └──────────────┴──────────────┴──────────────┴────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Database Layer                             │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐  │
│  │   Kythia     │   Kythia     │    Model     │    Kythia  │  │
│  │   Model      │  Migrator    │   Loader     │  Sequelize │  │
│  │              │              │              │            │  │
│  │ - Caching    │ - Batch      │ - Discovery  │ - Factory  │  │
│  │ - Hooks      │ - Migration  │ - AutoBoot   │ - Config   │  │
│  │ - DI         │              │              │            │  │
│  └──────────────┴──────────────┴──────────────┴────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure Layer                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Redis (Primary) ↔ LRU Map (Fallback)  │  Sequelize/DB  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Discord.js Client  │  Sentry  │  Winston Logger         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### Kythia Orchestrator

**File:** `src/Kythia.ts`

The main class that orchestrates the entire framework lifecycle.

#### Responsibilities

1. **Initialization**
   - Create KythiaClient (extended discord.js Client)
   - Initialize all managers
   - Attach DI container to client

2. **Lifecycle Management**
   ```
   constructor() → start() → loadAddons() → bootDB() → login()
   ```

3. **Dependency Management**
   - Accepts dependencies via constructor
   - Provides container to all components
   - Manages dbDependencies for ORM

#### Code Structure

```typescript
class Kythia {
  client: IKythiaClient;
  container: KythiaContainer;
  
  // Managers
  addonManager: IAddonManager;
  eventManager: IEventManager;
  interactionManager: IInteractionManager;
  shutdownManager: IShutdownManager;
  telemetryManager: ITelemetryManager;
  translatorManager: ITranslatorManager;
  
  constructor(dependencies: KythiaDependencies) {
    // 1. Create client
    // 2. Attach container
    // 3. Initialize managers
  }
  
  async start() {
    // 1. Load addons
    // 2. Boot database
    // 3. Login to Discord
    // 4. Setup shutdown hooks
  }
}
```

---

### Manager System

Kythia uses a **manager pattern** where each manager is responsible for a specific domain.

#### AddonManager

**File:** `src/managers/AddonManager.ts`

Handles all addon-related functionality.

**Responsibilities:**
- Discover addons from `addons/` directory
- Parse `addon.json` metadata
- **Priority-based loading** (lower = first)
- **Dependency validation** (topological sort)
- **Circular dependency detection**
- Load components (commands, events, buttons, modals, tasks)
- Register handlers

**Key Methods:**
```typescript
loadAddons(kythiaInstance): Promise<CommandData[]>
validateDependencies(name, deps, all, disabled): ValidationResult
topologicalSort(addons): string[]
registerButton/Modal/SelectMenu/TaskHandler(...)
```

**Loading Flow:**
```
1. Scan addons/ directory
2. Parse addon.json files
3. Check kythia.config for disabled addons
4. Validate dependencies
5. Topological sort (dependency order)
6. Load components:
   - commands/
   - events/
   - buttons/
   - modals/
   - select_menus/
   - tasks/
   - register.js
```

---

#### InteractionManager

**File:** `src/managers/InteractionManager.ts`

Handles all `InteractionCreate` events from Discord.

**Responsibilities:**
- Route slash commands
- Route button interactions
- Route modal submissions
- Route select menu interactions
- Route autocomplete requests
- Execute middleware chains
- Inject dependencies into commands

**Middleware System:**
```typescript
interface CommandModule {
  data: SlashCommandBuilder;
  middlewares?: Middleware[];
  execute: (interaction) => Promise<void>;
}
```

**Built-in Middlewares:**
- `botPermissions` - Check bot permissions
- `userPermissions` - Check user permissions
- `cooldown` - Rate limiting
- `ownerOnly` - Owner-only commands
- `isInMainGuild` - Main guild check

**Execution Flow:**
```
1. Receive InteractionCreate event
2. Identify interaction type (command/button/modal/etc)
3. Find handler from registered handlers
4. Execute middleware chain
5. Inject container into execution context
6. Execute handler
7. Handle errors
8. Report to telemetry
```

---

#### EventManager

**File:** `src/managers/EventManager.ts`

Routes Discord gateway events to addon event handlers.

**Responsibilities:**
- Register event handlers from addons
- Dispatch events to all registered handlers
- Handle multiple handlers per event

**Event Flow:**
```
1. Discord gateway event → EventManager
2. Find all handlers for event name
3. Execute handlers concurrently
4. Log errors without crashing
```

---

#### ShutdownManager

**File:** `src/managers/ShutdownManager.ts`

Manages graceful shutdown of the bot.

**Responsibilities:**
- Track active intervals (global `setInterval` patch)
- Clear all intervals on shutdown
- Execute shutdown hooks
- Handle SIGINT/SIGTERM signals

**Features:**
- **Global interval tracking** - Patches `setInterval`/`clearInterval`
- **Automatic cleanup** - Clears all tracked intervals
- **Graceful stop** - Waits for cleanup before exit

```typescript
// Automatically tracked
const interval = setInterval(() => { /* ... */ }, 1000);

// On shutdown, automatically cleared
```

---

#### TelemetryManager

**File:** `src/managers/TelemetryManager.ts`

Handles error tracking and monitoring.

**Responsibilities:**
- Initialize Sentry SDK
- Report errors with context
- Track command/interaction errors
- Performance monitoring

**Methods:**
```typescript
report(level: 'error' | 'warning', message: string, extra?: any)
```

---

#### TranslatorManager

**File:** `src/managers/TranslatorManager.ts`

Manages localization and translations.

**Responsibilities:**
- Load locale files from addons
- Provide translation function
- Support variable interpolation

**Usage:**
```javascript
const { t } = interaction.client.container.translator;
await interaction.reply(await t(interaction, 'welcome_message', { user: interaction.user.username }));
```

---

## Database Layer

### KythiaModel

**File:** `src/database/KythiaModel.ts`

Base model class with advanced caching.

#### Architecture

```
┌────────────────────────────────────┐
│         KythiaModel API            │
│  getCache / getAllCache / etc      │
└────────────────────────────────────┘
              ↓
┌────────────────────────────────────┐
│       Cache Strategy Layer         │
│  - Generate cache key              │
│  - Check cache                     │
│  - Execute query if miss           │
│  - Store in cache                  │
└────────────────────────────────────┘
              ↓
┌────────────────┬───────────────────┐
│  Redis Cache   │   LRU Map Cache   │
│  (Primary)     │   (Fallback)      │
└────────────────┴───────────────────┘
              ↓
┌────────────────────────────────────┐
│         Sequelize/Database         │
└────────────────────────────────────┘
```

#### Key Features

1. **Hybrid Caching**
   - Tries Redis first
   - Falls back to LRU Map if Redis unavailable
   - Transparent to developer

2. **Tag-Based Invalidation**
   ```typescript
   // Tags: ["User", "User:ID:1", "User:query:hash123"]
   await User.create({ id: 1, name: "John" });
   // Invalidates all "User*" tags
   ```

3. **Automatic Hooks**
   - `afterSave` → Invalidate cache
   - `afterDestroy` → Invalidate cache
   - `afterBulk*` → Bulk invalidation

4. **Dependency Injection**
   ```typescript
   KythiaModel.setDependencies({ logger, config, redis });
   ```

---

### KythiaMigrator

**File:** `src/database/KythiaMigrator.ts`

Laravel-style migration system with batch support.

#### Features

1. **Auto-Discovery**
   - Scans `addons/*/database/migrations`
   - Sorts by timestamp
   - **Respects disabled addons**

2. **Batch Tracking**
   - Tracks migration batches
   - Allows batch rollback
   - Uses `KythiaStorage` adapter

3. **Migration Flow**
   ```
   1. Scan addon migrations
   2. Filter disabled addons
   3. Sort by filename (timestamp)
   4. Compare with migrations table
   5. Run pending migrations
   6. Record in batch
   ```

---

### ModelLoader

**File:** `src/database/ModelLoader.ts`

Automatically loads and boots all addon models.

#### Process

```
1. Scan addons/*/database/models
2. Skip disabled addons
3. Require model files
4. Call Model.autoBoot(sequelize)
5. Register in container.models
6. Link associations
```

---

## Addon System

### Addon Structure

```
addons/my-feature/
├── addon.json              # Metadata
├── register.js             # Initialization (optional)
├── commands/              # Slash commands
│   ├── ping.js
│   └── user/
│       ├── _command.js    # Main command
│       ├── profile.js     # Subcommand
│       └── settings/
│           ├── _group.js  # Group
│           └── privacy.js # Subcommand in group
├── events/                # Discord events
│   └── messageCreate.js
├── buttons/               # Button handlers
│   └── confirm.js
├── modals/                # Modal handlers
│   └── feedback.js
├── select_menus/          # Select menu handlers
│   └── role-select.js
├── tasks/                 # Scheduled tasks
│   └── daily-cleanup.js
└── database/
    ├── models/            # Sequelize models
    │   └── UserData.js
    └── migrations/        # Database migrations
        └── 20250128_create_user_data.js
```

### addon.json Schema

```json
{
  "name": "my-feature",
  "version": "1.0.0",
  "description": "Feature description",
  "author": "Your Name",
  "priority": 50,
  "dependencies": ["core", "database"],
  "active": true
}
```

**Fields:**
- `name` - Addon identifier
- `version` - Semantic version
- `priority` - Load order (0-9999, lower = first)
- `dependencies` - Array of required addons
- `active` - Enable/disable via addon.json

### Dependency Resolution

Uses **Kahn's topological sort algorithm**:

```
1. Build dependency graph
2. Calculate in-degrees
3. Process addons with 0 in-degree
4. Sort by priority for same level
5. Detect cycles
```

**Example:**
```json
core: { priority: 0, deps: [] }
database: { priority: 10, deps: ["core"] }
analytics: { priority: 50, deps: ["core", "database"] }

Load order:
1. core
2. database
3. analytics
```

---

## Data Flow

### Command Execution Flow

```
User                Discord.js        InteractionManager      AddonManager       Your Command
 │                       │                    │                     │                  │
 │  /command            │                    │                     │                  │
 ├──────────────────────>│                    │                     │                  │
 │                       │  InteractionCreate │                     │                  │
 │                       ├───────────────────>│                     │                  │
 │                       │                    │  Find handler        │                  │
 │                       │                    ├────────────────────>│                  │
 │                       │                    │  Return handler      │                  │
 │                       │                    │<────────────────────┤                  │
 │                       │                    │ Execute middlewares  │                  │
 │                       │                    ├───────────┐          │                  │
 │                       │                    │<──────────┘          │                  │
 │                       │                    │  Call execute()      │                  │
 │                       │                    │                     ...                 │
 │                       │                    ├────────────────────────────────────────>│
 │                       │                    │                     ...  Execute logic  │
 │                       │                    │                     ...  Access container│
 │                       │                <│  Reply               │                  │ 
 │  Response             │                    │                     │                  │
 │<──────────────────────┤                    │                     │                  │
```

### Event Dispatch Flow

```
Discord.js          EventManager       Addon Event Handlers
    │                    │                    │
    │  messageCreate     │                    │
    ├───────────────────>│                    │
    │                    │  Find all handlers │
    │                    ├──────────┐         │
    │                    │<─────────┘         │
    │                    │  Execute all       │
    │                    ├───────────────────>│
    │                    │                 Execute
    │                    │<───────────────────┤
```

### Database Query with Cache

```
Your Code           KythiaModel         Cache Layer       Redis/LRU       Database
    │                    │                   │               │               │
    │  getCache(query)   │                   │               │               │
    ├───────────────────>│                   │               │               │
    │                    │  Generate key     │               │               │
    │                    ├──────────┐        │               │               │
    │                    │<─────────┘        │               │               │
    │                    │  Check cache      │               │               │
    │                    ├──────────────────>│               │               │
    │                    │                   │  Try Redis    │               │
    │                    │                   ├──────────────>│               │
    │                    │                   │  (or LRU)     │               │
    │                    │                   │<──────────────┤               │
    │                    │  Cache HIT        │               │               │
   ...  Return cached  <─┤                   │               │               │
    │                    │                   │               │               │
    │                 (Cache MISS)           │               │               │
    │                    │  Query DB         │               │               │
    │                    ├──────────────────────────────────────────────────>│
    │                    │  Store in cache   <───────────────────────────────┤
    │                    ├──────────────────>│               │               │
   ...  Return result  <─┤                   │               │               │
```

---

## Design Patterns

### 1. Dependency Injection

**Problem:** Circular dependencies when addons require core services.

**Solution:** DI Container

```javascript
// ❌ BAD: Circular dependency
const logger = require('@coreHelpers/logger');

// ✅ GOOD: DI from container
async execute(interaction) {
  const { logger } = interaction.client.container;
  logger.info('Command executed');
}
```

### 2. Manager Pattern

**Problem:** Monolithic orchestrator class.

**Solution:** Separate concerns into managers.

Each manager is responsible for one domain:
- AddonManager → Addons
- InteractionManager → Interactions
- EventManager → Events
- etc.

### 3. Plugin Architecture

**Problem:** Core cannot contain all features.

**Solution:** Addon system.

Core provides framework, addons provide features.

### 4. Middleware Chain

**Problem:** Repeated permission/validation logic.

**Solution:** Reusable middleware.

```javascript
middlewares: [
  botPermissions(['SendMessages']),
  cooldown(5000),
  ownerOnly,
]
```

### 5. Strategy Pattern (Caching)

**Problem:** Different caching backends.

**Solution:** Abstract cache interface with strategies.

- RedisCacheStrategy
- LRUCacheStrategy
- Automatic fallback

### 6. Observer Pattern (Events)

**Problem:** Multiple handlers for same event.

**Solution:** Event subscription system.

EventManager maintains `Map<eventName, handler[]>` and dispatches to all.

### 7. Factory Pattern

**Problem:** Complex Sequelize instantiation.

**Solution:** `createSequelizeInstance` factory.

Encapsulates configuration complexity.

---

## Scaling Considerations

### Horizontal Scaling

- **Redis for shared cache** - Multiple instances share cache
- **Database connection pooling** - Efficient DB usage
- **Stateless design** - Each instance independent

### Performance Optimization

- **Hybrid caching** - Reduce DB queries
- **Tag-based invalidation** - Precise cache clearing
- **Lazy loading** - Load components on demand
- **Batch operations** - Bulk DB operations

### Monitoring

- **Sentry integration** - Error tracking
- **Winston logging** - Structured logs
- **Command metrics** - Track usage

---

## Security

### Best Practices

1. **Environment variables** - Never hardcode credentials
2. **Permission checks** - Middleware validation
3. **Input validation** - Sanitize user input
4. **Rate limiting** - Cooldown middleware
5. **Error handling** - Never expose internal errors

---

## Conclusion

Kythia Core's architecture is designed for:
- **Scalability** - Handle growth efficiently
- **Maintainability** - Clean separation of concerns
- **Extensibility** - Easy to add features via addons
- **Reliability** - Graceful degradation and error handling

For implementation details, see [API_REFERENCE.md](./API_REFERENCE.md).

For development guide, see [DEV_GUIDE.md](./DEV_GUIDE.md).
