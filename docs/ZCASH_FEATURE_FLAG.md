# ZCash Feature Flag

ZCash (ZEC) support is now behind a feature flag and **disabled by default**.

## Overview

This implementation adds a feature flag system to control ZCash support in KeepKey Vault. By default, ZCash is disabled and must be explicitly enabled by the user.

## Feature Flag Behavior

### Default State
- **ZCash is DISABLED by default**
- No ZCash network mappings are included
- ZCash won't appear in asset lists or swap options
- No environment variable is required to keep it disabled

### How to Enable

#### Option 1: Runtime Toggle (Recommended)
1. Open the vault in development mode
2. Click the gear icon (⚙️) in the bottom-right corner
3. Toggle "ZCash (ZEC)" to ON
4. Reload the page for changes to take effect

#### Option 2: Environment Variable
Add to your `.env.local` file:
```bash
NEXT_PUBLIC_ENABLE_ZCASH=true
```

#### Option 3: Browser Console
```javascript
localStorage.setItem('feature_enable_zcash', 'true');
window.location.reload();
```

## Technical Implementation

### Files Modified

1. **`src/config/features.ts`**
   - Added `enableZcash` to `FeatureFlags` interface
   - Added `isZcashEnabled()` helper function
   - Added `ZCASH_NETWORK_ID` constant
   - Added filter helpers for network IDs and chain names

2. **`src/utils/keepkeyAddress.ts`**
   - Made `NetworkIdToChain` mapping dynamic
   - Made `networkIdToType` mapping dynamic
   - ZCash entries only included when feature flag is enabled

3. **`src/components/swap/Swap.tsx`**
   - Updated network type mappings to conditionally include ZCash
   - Both device verification and signing flows respect the feature flag

4. **`src/components/FeatureFlagToggle.tsx`**
   - Added UI toggle for ZCash feature
   - Shows current state and allows runtime changes

### How It Works

```typescript
// Check if ZCash is enabled
import { isZcashEnabled, ZCASH_NETWORK_ID } from '@/config/features';

// Conditionally include ZCash in mappings
const networkMapping = {
  'eip155:1': 'ethereum',
  // ... other networks
  ...(isZcashEnabled() ? { [ZCASH_NETWORK_ID]: 'zcash' } : {})
};
```

### Network Identifier

ZCash uses the following network identifier:
```
bip122:00040fe8ec8471911baa1db1266ea15d
```

This is the CAIP-2 format for ZCash mainnet.

## Testing

### Verify ZCash is Disabled
1. Build and run the vault
2. Check that ZCash does not appear in:
   - Asset list on dashboard
   - Swap asset picker
   - Balance displays

### Verify ZCash is Enabled
1. Enable the feature flag using one of the methods above
2. Reload the page
3. Check that ZCash appears in:
   - Asset list (if you have ZCash balance)
   - Swap asset picker
   - Network mappings for transactions

## Priority Order

Feature flags are resolved in this order:
1. **localStorage override** (highest priority - runtime toggle)
2. **Environment variable** (`NEXT_PUBLIC_ENABLE_ZCASH`)
3. **Default value** (`false` - disabled)

## Security Considerations

- ZCash is disabled by default as a safety measure
- Users must explicitly opt-in to ZCash support
- The feature can be quickly disabled if issues are discovered
- No code is removed - just conditionally activated

## Future Considerations

This pattern can be extended to other coins:
```typescript
interface FeatureFlags {
  enableSwaps: boolean;
  enableZcash: boolean;
  enableNewCoin: boolean; // Add more as needed
}
```

## Rollback

To completely disable ZCash:
1. Remove the feature flag from localStorage: `localStorage.removeItem('feature_enable_zcash')`
2. Remove from environment: Delete `NEXT_PUBLIC_ENABLE_ZCASH`
3. Reload the page

ZCash will be disabled by default without any environment variable or localStorage entry.
