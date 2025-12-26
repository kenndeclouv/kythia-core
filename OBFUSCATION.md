# Production Build with Obfuscation

## Overview

The package is configured to automatically obfuscate all compiled JavaScript files when publishing to npm. Source code remains clean and readable for development.

## Scripts

### Development
```bash
bun run build        # Build without obfuscation (for local dev)
bun run dev          # Format, build, and push to yalc (local testing)
```

### Production
```bash
bun run build:prod   # Build + obfuscate (for production)
npm publish          # Automatically runs build:prod before publishing
```

## How It Works

1. **prepublishOnly Hook**: Automatically runs before `npm publish`
2. **build:prod**: Compiles TypeScript → JavaScript → Obfuscates all .js files
3. **Obfuscation Settings**: Configured in `obfuscator.config.json`

## Protection Features

The obfuscator applies:
- ✅ **Control Flow Flattening** - Makes code flow harder to follow
- ✅ **Dead Code Injection** - Adds fake code branches
- ✅ **String Array Encoding** - Encrypts string literals (base64)
- ✅ **Identifier Renaming** - Changes all variable/function names to hex
- ✅ **Self Defending** - Detects beautification attempts
- ✅ **Number to Expression** - Converts numbers to complex expressions
- ✅ **Object Key Transformation** - Obfuscates object property access

## Testing Obfuscation

To verify obfuscation quality:

```bash
# Build with obfuscation
bun run build:prod

# Check obfuscated output
head -n 50 dist/managers/TelemetryManager.js
```

You should see heavily obfuscated code with:
- Hexadecimal variable names (`_0x1a4b`, `_0x2cf9`)
- Encrypted strings
- Complex control flow
- No comments or readable logic

## Best Practices

**DO:**
- ✅ Use `bun run dev` for local development
- ✅ Use `npm publish` for releasing (auto-obfuscates)
- ✅ Keep source code in Git clean and readable

**DON'T:**
- ❌ Don't commit obfuscated code to Git
- ❌ Don't manually run obfuscation for development
- ❌ Don't modify obfuscated files (they are regenerated)

## Package Contents

When published to npm, the package includes:
- `dist/` - Obfuscated JavaScript files
- `dist/**/*.d.ts` - TypeScript type definitions (NOT obfuscated)
- `dist/lang/` - Translation files
- `LICENSE`, `README.md`

Source files (`src/`) are excluded via `.npmignore`.

## Upgrading Obfuscation

To upgrade to JavaScript Obfuscator Pro (VM-based protection):
1. Get API key from https://obfuscator.io
2. Update `obfuscator.config.json`:
   ```json
   {
     "apiKey": "YOUR_API_KEY",
     ...
   }
   ```

Pro features include:
- Bytecode virtualization
- Anti-decompilation
- Unique VM structure per compilation
