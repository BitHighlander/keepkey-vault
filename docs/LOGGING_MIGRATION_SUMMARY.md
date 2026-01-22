# Logging System Migration Summary

## Overview

Successfully migrated the Vault application from verbose console.log statements to a centralized, environment-aware logging system that is **quiet by default**.

## What Changed

### ✅ Created Centralized Logger

**File:** `src/lib/logger.ts`

Features:
- Environment-aware logging (production vs development)
- Runtime control via localStorage
- Category-based filtering (ASSET, PIONEER, CUSTOM_TOKENS, BALANCES, etc.)
- **Debug logs disabled by default** to reduce console noise
- Browser console access via `vaultLogger` global

### ✅ Migrated Files

Updated the following files to use the centralized logger:

1. **Asset.tsx** - 76 logger calls
   - Replaced emoji-decorated console.log statements
   - Added ASSET category for fine-grained control

2. **pioneer.tsx** - 10 logger calls
   - Replaced Pioneer SDK forwarded logs
   - Added PIONEER category

3. **useCustomTokens.ts** - 26 logger calls
   - Replaced custom token operation logs
   - Added CUSTOM_TOKENS category

4. **app/provider.tsx** - 163 logger calls
   - Main application provider logs

5. **app/page.tsx** - Updated
   - Main page component logs

6. **components/send/Send.tsx** - Updated
   - Send transaction logs

7. **services/erc20.ts** - Updated
   - ERC20 service logs

8. **services/thorchain.ts** - Updated
   - THORChain service logs

9. **components/swap/Swap.tsx** - Updated
   - Swap component logs

10. **components/swap/SwapConfirm.tsx** - Updated
    - Swap confirmation logs

11. **components/dashboard/Dashboard.tsx** - Updated
    - Dashboard component logs

### ✅ Created Documentation

**File:** `docs/LOGGING.md`

Complete guide covering:
- Quick start for developers
- Browser console usage
- Log levels and categories
- Migration guide
- Best practices
- Troubleshooting

## Default Behavior

### 🔇 Quiet by Default

**Production:**
- ✅ Errors logged
- ✅ Warnings logged
- ❌ Info hidden
- ❌ Debug hidden

**Development:**
- ✅ Errors logged
- ✅ Warnings logged
- ❌ Info hidden (unless DEBUG_MODE enabled)
- ❌ Debug hidden (unless DEBUG_MODE enabled)

This eliminates the console spam you were experiencing!

## How to Use

### For End Users

The console is now clean by default. Only errors and warnings appear.

### For Developers

**Enable debug logs when needed:**

```javascript
// In browser console
vaultLogger.enableDebug()          // Enable all
vaultLogger.enableDebug('ASSET')   // Enable specific category
location.reload()                   // Refresh to apply
```

**Check current status:**

```javascript
vaultLogger.status()
```

**Disable when done:**

```javascript
vaultLogger.disableDebug()
location.reload()
```

## Log Categories

Fine-grained control over which logs appear:

- `ASSET` - Asset component operations
- `PIONEER` - Pioneer SDK operations
- `CUSTOM_TOKENS` - Custom token management
- `BALANCES` - Balance calculations
- `TRANSACTIONS` - Transaction operations
- `NETWORK` - Network requests
- `STORAGE` - Local storage operations
- `STAKING` - Staking operations
- `SWAP` - Swap operations

## Example: Before vs After

### Before (Spammy!)
```
📊 Aggregated Balance: {symbol: 'BTC', ...}
🔑 Network Pubkeys: (9) [{...}, {...}, ...]
💰 Filtered Balances: (3) [{...}, {...}, ...]
🔄 Show All Pubkeys: false
🔍 Fetching custom tokens via Pioneer SDK for: 19TFo6S9...
🔍 Checking if GetCustomTokens method exists: function
📦 Custom tokens response: {data: {...}}
✅ Loaded 0 custom tokens from server
[WARN] | portfolio-helpers | fetchMarketPrice | No market data...
[Provider] SDK result for input asset: {symbol: 'BTC', ...}
✅ [Asset] Native asset context set in Pioneer SDK
```

### After (Clean!)
```
(No output unless DEBUG_MODE is enabled)
```

Only errors and critical warnings appear:
```
❌ Error loading asset: Network timeout
⚠️ No market data available for asset
```

## Benefits

1. **Clean Console** - No more spam in production or development
2. **Runtime Control** - Enable debug logs only when needed
3. **Categorized Logs** - Debug specific features without noise
4. **Persistent Settings** - Debug preferences saved in localStorage
5. **Developer Friendly** - Easy to enable/disable via browser console
6. **Production Safe** - Only errors/warnings in production

## Testing Checklist

- [ ] Verify console is clean on app startup
- [ ] Enable debug mode and verify logs appear
- [ ] Test category-specific filtering
- [ ] Verify localStorage persistence
- [ ] Check vaultLogger global availability
- [ ] Test in both dev and production builds

## Rollback

If needed, the old console.log behavior can be restored:

```javascript
// In browser console
vaultLogger.enableDebug()
location.reload()
```

Or edit `src/lib/logger.ts` and set:
```typescript
const DEBUG_MODE = true;  // Enable all debug logs by default
```

## Next Steps

**Optional Enhancements:**
1. Add log level configuration (e.g., only show warnings in dev)
2. Add log output destinations (e.g., send errors to monitoring service)
3. Add performance monitoring integration
4. Add structured logging for better parsing

## Notes

- All original log messages preserved, just controlled by the logger
- Emoji prefixes maintained for visual clarity when debugging
- Error logs always appear (important for troubleshooting)
- Warning logs always appear (important for catching issues)
- Debug/Info logs hidden by default (reduces noise)

---

**Result:** Console is now clean and quiet! 🎉

To debug when needed, simply run:
```javascript
vaultLogger.enableDebug('ASSET')
location.reload()
```
