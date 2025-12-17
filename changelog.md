# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.12.3-beta](https://github.com/kenndeclouv/kythia-core/compare/v0.12.2-beta...v0.12.3-beta) (2025-12-17)


### ✨ Added

* Implement legal agreement check and re-enable telemetry with license verification. ([4ec262c](https://github.com/kenndeclouv/kythia-core/commit/4ec262c590c44be99020bd1ec2c6c2909d5be418))

### [0.12.2-beta](https://github.com/kenndeclouv/kythia-core/compare/v0.12.1-beta...v0.12.2-beta) (2025-12-16)


### ✨ Added

* Introduce DI type generation CLI command and enhance Redis configuration with disable option. ([c501717](https://github.com/kenndeclouv/kythia-core/commit/c5017171bbafa3b15971ebde7f3af864a08796a8))

### [0.12.1-beta](https://github.com/kenndeclouv/kythia-core/compare/v0.12.0-beta.1...v0.12.1-beta) (2025-12-10)


### ✨ Added

* refactor addon component loading and update import styles and logging emojis ([d0ac3c8](https://github.com/kenndeclouv/kythia-core/commit/d0ac3c893fcaf24fd4c093095beba851a7f7d70b))

## [0.12.0-beta.1](https://github.com/kenndeclouv/kythia-core/compare/v0.12.0-beta...v0.12.0-beta.1) (2025-12-07)


### 🔧 Changed

* Explicitly define access modifiers, refine `kythiaConfig` and `isTeam` types, and enhance interaction handling with middleware checks and logger injection. ([5f53fc3](https://github.com/kenndeclouv/kythia-core/commit/5f53fc3bc63ff9c7e29437ae523382a30d536ff8))

## [0.12.0-beta](https://github.com/kenndeclouv/kythia-core/compare/v0.9.6-beta...v0.12.0-beta) (2025-12-07)


### ⚠ BREAKING CHANGES

* **core:** KythiaORM sync is removed in favor of KythiaMigrator.
* deprecate v0.9.x, jump to v0.10.0 (Major Overhaul)

### ✨ Added

* Add CLI entry point and enhance KythiaModel with debugging logs for cache operations ([15cfd38](https://github.com/kenndeclouv/kythia-core/commit/15cfd388c0624c9e0f62231fa36d568a4bbaca78))
* Add scheduled restart notifications and enhance cache invalidation with smart tags. ([a0627ba](https://github.com/kenndeclouv/kythia-core/commit/a0627ba83694f28912a7b9cd4ece51e95c70f54d))
* **core:**  v0.11.0-beta architecture overhaul & CLI integration ([1388a84](https://github.com/kenndeclouv/kythia-core/commit/1388a84bc3f224348031949d7ac7c60ed4b8b53e))
* Introduce robust logging with Winston and internationalize interaction manager error messages. ([e1daef9](https://github.com/kenndeclouv/kythia-core/commit/e1daef9bb64e38ef2405644fdaf6acdab2550f2b))


### 🔧 Changed

* **core:** cleanup architecture and prepare for ts migration ([6655b60](https://github.com/kenndeclouv/kythia-core/commit/6655b60a0487163de3294b7557d70fe0c28a8d1e))
* **core:** implement Middleware Pattern for interaction handling ([3752470](https://github.com/kenndeclouv/kythia-core/commit/3752470554b63e735b7c357789c5caa97d627275))
* **core:** migrate codebase from JavaScript to TypeScript ([030da66](https://github.com/kenndeclouv/kythia-core/commit/030da660d522bc734488f895a7cdad2f02fa3370))
* deprecate v0.9.x, jump to v0.10.0 (Major Overhaul) ([971436e](https://github.com/kenndeclouv/kythia-core/commit/971436ec0f9feb9db60994e227845c81315e63a4))
* improve type management in ShutdownManager and add new dev dependencies. ([7b9b0ba](https://github.com/kenndeclouv/kythia-core/commit/7b9b0ba003b620dc34e5386ec0f5ed54a07c8c6b))
* Update interaction replies to use `MessageFlags.Ephemeral` and adjust translation parameters. ([6888307](https://github.com/kenndeclouv/kythia-core/commit/688830767a3137b578f3035fe2bc0e923d1a7319))

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
