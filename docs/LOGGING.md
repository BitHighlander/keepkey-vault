# Vault Logging System

## Overview

The Vault application uses a centralized logging system that provides environment-aware logging with runtime control. By default, **all debug logs are disabled** in both development and production to reduce console noise.

## Quick Start

### Viewing Current Status

Open the browser console and run:
```javascript
vaultLogger.status()
```

### Enabling Debug Logs

**Enable all debug logging:**
```javascript
vaultLogger.enableDebug()
```

**Enable specific category:**
```javascript
vaultLogger.enableDebug('ASSET')      // Asset component logs
vaultLogger.enableDebug('PIONEER')    // Pioneer SDK logs
vaultLogger.enableDebug('CUSTOM_TOKENS') // Custom token operations
vaultLogger.enableDebug('BALANCES')   // Balance calculations
vaultLogger.enableDebug('TRANSACTIONS') // Transaction operations
vaultLogger.enableDebug('NETWORK')    // Network requests
vaultLogger.enableDebug('STORAGE')    // Local storage operations
vaultLogger.enableDebug('STAKING')    // Staking operations
vaultLogger.enableDebug('SWAP')       // Swap operations
```

### Disabling Debug Logs

**Disable all debug logging:**
```javascript
vaultLogger.disableDebug()
```

**Disable specific category:**
```javascript
vaultLogger.disableDebug('ASSET')
```

**Note:** After enabling or disabling debug logs, refresh the page for changes to take effect.

## Default Behavior

### Production Mode
- **Errors**: Always logged ✅
- **Warnings**: Always logged ✅
- **Info**: Not logged ❌
- **Debug**: Not logged ❌

### Development Mode
- **Errors**: Always logged ✅
- **Warnings**: Always logged ✅
- **Info**: Only if DEBUG_MODE is enabled
- **Debug**: Only if DEBUG_MODE is enabled

### Debug Mode (Off by Default)
Debug mode is **disabled by default** to reduce console noise. Enable it using `vaultLogger.enableDebug()`.

## Using the Logger in Code

### Import
```typescript
import { logger } from '@/lib/logger';
```

### Log Levels

**Debug** - Verbose debugging information (disabled by default):
```typescript
logger.debug('🔍 [Component] Fetching data', { caip }, 'ASSET');
```

**Info** - General information (disabled by default):
```typescript
logger.info('Balance updated', { balance }, 'BALANCES');
```

**Warn** - Warnings (always logged):
```typescript
logger.warn('⚠️ Missing data', { field }, 'ASSET');
```

**Error** - Errors (always logged):
```typescript
logger.error('❌ Operation failed', error, 'TRANSACTIONS');
```

### Categories

All log methods accept an optional third parameter for categorization:

```typescript
logger.debug(message, data, 'ASSET');
logger.info(message, data, 'PIONEER');
logger.warn(message, data, 'CUSTOM_TOKENS');
logger.error(message, data, 'BALANCES');
```

Available categories:
- `ASSET` - Asset component operations
- `PIONEER` - Pioneer SDK operations
- `CUSTOM_TOKENS` - Custom token management
- `BALANCES` - Balance calculations
- `TRANSACTIONS` - Transaction operations
- `NETWORK` - Network requests
- `STORAGE` - Local storage operations
- `STAKING` - Staking operations
- `SWAP` - Swap operations

## LocalStorage Flags

The logging system uses localStorage to persist debug settings:

**Global debug flag:**
```
VAULT_DEBUG = "true" | "false"
```

**Category-specific flags:**
```
VAULT_DEBUG_ASSET = "true" | "false"
VAULT_DEBUG_PIONEER = "true" | "false"
VAULT_DEBUG_CUSTOM_TOKENS = "true" | "false"
VAULT_DEBUG_BALANCES = "true" | "false"
VAULT_DEBUG_TRANSACTIONS = "true" | "false"
VAULT_DEBUG_NETWORK = "true" | "false"
VAULT_DEBUG_STORAGE = "true" | "false"
VAULT_DEBUG_STAKING = "true" | "false"
VAULT_DEBUG_SWAP = "true" | "false"
```

## Examples

### Debugging Asset Loading Issues

```javascript
// Enable asset-specific debug logs
vaultLogger.enableDebug('ASSET')

// Refresh the page
location.reload()

// Now you'll see all asset-related debug logs
// Navigate to an asset page to see the logs
```

### Debugging Custom Token Operations

```javascript
// Enable custom token debug logs
vaultLogger.enableDebug('CUSTOM_TOKENS')

// Refresh the page
location.reload()

// Try adding a custom token to see detailed logs
```

### Debugging Everything

```javascript
// Enable all debug logs (very verbose!)
vaultLogger.enableDebug()

// Refresh the page
location.reload()

// You'll see all debug logs from all categories
```

### Disabling Logs After Debugging

```javascript
// Disable all debug logs
vaultLogger.disableDebug()

// Or disable specific category
vaultLogger.disableDebug('ASSET')

// Refresh the page
location.reload()
```

## Migration from console.log

The codebase has been migrated from direct `console.log` calls to the centralized logger:

**Old:**
```typescript
console.log('🔍 Fetching data for CAIP:', caip);
console.warn('⚠️ Missing data');
console.error('❌ Operation failed:', error);
```

**New:**
```typescript
logger.debug('🔍 Fetching data for CAIP:', caip, 'ASSET');
logger.warn('⚠️ Missing data', undefined, 'ASSET');
logger.error('❌ Operation failed:', error, 'ASSET');
```

## Best Practices

1. **Use appropriate log levels:**
   - `debug` - Verbose information for debugging (disabled by default)
   - `info` - General information (disabled by default)
   - `warn` - Warnings that should be investigated
   - `error` - Errors that need attention

2. **Always include category:**
   ```typescript
   logger.debug('Message', data, 'CATEGORY');
   ```

3. **Use emoji prefixes for visual clarity:**
   ```typescript
   logger.debug('🔍 Searching for...', data, 'ASSET');
   logger.debug('✅ Operation complete', result, 'ASSET');
   logger.debug('⚠️ Warning condition', condition, 'ASSET');
   logger.debug('❌ Error occurred', error, 'ASSET');
   ```

4. **Keep production clean:**
   - Only warnings and errors are logged by default
   - Debug and info logs are hidden unless explicitly enabled

5. **Test with debug mode:**
   - During development, enable relevant categories
   - Disable before committing to keep defaults clean

## Troubleshooting

### Logs not appearing after enabling debug mode

**Solution:** Make sure to refresh the page after enabling debug mode:
```javascript
vaultLogger.enableDebug('ASSET')
location.reload()
```

### Too many logs

**Solution:** Disable global debug mode and enable only specific categories:
```javascript
vaultLogger.disableDebug()
vaultLogger.enableDebug('ASSET')
location.reload()
```

### Can't find vaultLogger in console

**Solution:** Make sure you're in the browser console (not Node.js). The logger is automatically attached to the window object when the app loads.

## Implementation Details

The logger is defined in `src/lib/logger.ts` and automatically checks:
- `NODE_ENV` for production detection
- `localStorage` flags for runtime configuration
- Category-specific flags for fine-grained control

The logger instance is exposed globally as `window.vaultLogger` for easy browser console access.
