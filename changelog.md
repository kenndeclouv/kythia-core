# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.9.6-beta](https://github.com/kenndeclouv/kythia-core/compare/v0.9.5-beta...v0.9.6-beta) (2025-11-18)


### ✨ Added

* Enhance KythiaModel with Redis scheduling methods for adding, removing, and retrieving expired items, improving cache management and scheduling capabilities. ([b98160a](https://github.com/kenndeclouv/kythia-core/commit/b98160abfa8396e06b432c91740c62c8f3a9e084))

### [0.9.5-beta](https://github.com/kenndeclouv/kythia-core/compare/v0.9.4-beta.3...v0.9.5-beta) (2025-11-11)


### ✨ Added

* Add select menu handler registration and interaction handling in Kythia and InteractionManager, enhancing user interaction capabilities. ([a27e84d](https://github.com/kenndeclouv/kythia-core/commit/a27e84d60f6f6077b073582f7c705eb28bc4d329))

### [0.9.4-beta.3](https://github.com/kenndeclouv/kythia-core/compare/v0.9.4-beta.2...v0.9.4-beta.3) (2025-11-10)


### 🔧 Changed

* Enhance KythiaORM with dialect-specific UPSERT queries for improved database compatibility. Adjusted InteractionManager button handler logic for better flexibility in handling interactions. ([2bfafc4](https://github.com/kenndeclouv/kythia-core/commit/2bfafc47e83b06f5f72a57da162d0c6b244bfe6d))

### [0.9.4-beta.2](https://github.com/kenndeclouv/kythia-core/compare/v0.9.4-beta.1...v0.9.4-beta.2) (2025-11-10)


### ✨ Added

* Enhance configuration validation in Kythia by adding checks for required bot and database settings, defaulting to SQLite if no driver is specified, and improving error logging for missing configurations. ([72148fa](https://github.com/kenndeclouv/kythia-core/commit/72148fa6b29a97da026746eb44fa4b8696744cb5))

### [0.9.4-beta.1](https://github.com/kenndeclouv/kythia-core/compare/v0.9.4-beta.0...v0.9.4-beta.1) (2025-11-09)


### ✨ Added

* Refactor KythiaORM to sync multiple models in a single operation, improving efficiency and logging. Updated version hashes in model_versions table after sync completion. ([1bc195d](https://github.com/kenndeclouv/kythia-core/commit/1bc195d17d67865d01cb6c0290a2715f876b2451))

### 0.9.4-beta.0 (2025-11-04)


### 🔧 Changed

* Kythia core library structure and update version to 0.9.1-beta. Simplified index.js exports, improved README with installation instructions, and enhanced documentation across various modules. Updated license to CC BY NC 4.0. Cleaned up unnecessary comments and improved code readability. ([1967b65](https://github.com/kenndeclouv/kythia-core/commit/1967b651d49b4c2a85403c2e5d7a58d95ba1d1ed))
* Update package name to "kythia-core", adjust LRUCache import, and ensure logger availability in InteractionManager for command execution context. ([9e90cf6](https://github.com/kenndeclouv/kythia-core/commit/9e90cf6e04c4655ffbf71813e173de8b8d074b79))
* Update version to 0.9.2-beta, enhance caching layer with LRU cache support, and improve sharding awareness in KythiaModel. ([6cfb275](https://github.com/kenndeclouv/kythia-core/commit/6cfb275543410aee6e5df429036be9571134618b))


### ✨ Added

* Enhance KythiaModel with multi-Redis fallback support, allowing connection to multiple Redis URLs for improved failover handling. Updated dependency injection to accept various Redis options and refined error handling for Redis connections. ([9eac22b](https://github.com/kenndeclouv/kythia-core/commit/9eac22b299b06842514e9576cdf1c08c09944a50))
* Introduce failover cache flushing in KythiaModel during Redis connection recovery, enhancing error handling and connection management. Added a flag to track failover state and updated event handlers for improved logging and cache management. ([bb30d36](https://github.com/kenndeclouv/kythia-core/commit/bb30d36a845086675fd35774d773fc04d213bc0b))
