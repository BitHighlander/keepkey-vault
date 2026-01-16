# Network ID Refactoring

## Problem
The notification system was using a bad architecture with unnecessary conversions:
1. Pioneer SDK sends events with `networkId: "eip155:1"`
2. Old code tried to convert `networkId` → `chain symbol` ("ETH")
3. Then looked up metadata using chain symbol
4. This was fragile, buggy, and unnecessary

## Solution
**Use `networkId` everywhere** - no conversions needed!

## Changes Made

### 1. chainMetadata.ts - Refactored to use networkId
**Before:**
```typescript
export const CHAIN_METADATA: Record<string, ChainMetadata> = {
  BTC: { networkId: 'bitcoin', ... },
  ETH: { networkId: 'ethereum', ... },
}

function getChainMetadata(chainSymbol: string) {
  return CHAIN_METADATA[chainSymbol.toUpperCase()]
}
```

**After:**
```typescript
export function getNetworkMetadata(networkId: string): NetworkMetadata | undefined {
  // Direct lookup by networkId - no conversion!
  // Supports: "bitcoin", "ethereum", "eip155:1", etc.
}
```

### 2. TransactionEventManager.ts - Simplified
**Removed:**
- 60+ lines of `getChainSymbol()` conversion logic
- All the brittle `startsWith('eip155:1')` checks
- Chain symbol lookups

**Added:**
- Direct `getNetworkMetadata(txData.networkId)` call
- Clean, simple code

### 3. TransactionEventData Interface - Cleaned up
**Before:**
```typescript
interface TransactionEventData {
  chain?: string // Old format
  networkId?: string // New format
  // ... confusion
}
```

**After:**
```typescript
interface TransactionEventData {
  networkId: string // REQUIRED - Pioneer SDK format
  type?: 'incoming' | 'outgoing' // Use Pioneer's classification
  // ... clean and simple
}
```

## Benefits
1. ✅ **No conversions** - use Pioneer's data directly
2. ✅ **Simpler code** - removed 60+ lines of brittle logic
3. ✅ **More reliable** - no string matching bugs
4. ✅ **Future-proof** - easy to add new networks
5. ✅ **Better performance** - no unnecessary lookups

## Migration Guide
Old code (deprecated):
```typescript
import { getChainMetadata } from './chainMetadata'
const metadata = getChainMetadata('ETH') // ❌ Old way
```

New code:
```typescript
import { getNetworkMetadata } from './chainMetadata'
const metadata = getNetworkMetadata('eip155:1') // ✅ New way
const metadata = getNetworkMetadata('bitcoin')   // ✅ Also works
```

## Testing
After rebuild, you should see:
```
[TransactionEventManager] 🔍 Processing tx event: { networkId: 'eip155:1', ... }
[TransactionEventManager] 📋 Metadata result: { symbol: 'ETH', decimals: 18, ... }
[TransactionEventManager] ✅ Classified as INCOMING (Pioneer type field)
[TransactionEventManager] 🎉 Showing toast for incoming payment
```

## Next Steps
1. **Rebuild** to get the new code
2. Test with incoming transaction
3. Remove deprecated functions after confirming everything works
