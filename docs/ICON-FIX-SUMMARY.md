# Icon Fix Summary

## Problem

The Swap component was displaying generic coin stack emojis (🪙) for many assets instead of their proper icons. This was caused by hardcoding icon URLs in the `thorchain-pools.ts` configuration file instead of using the canonical source: Pioneer SDK's asset data.

## Root Cause

1. **Wrong Approach**: Icons were being hardcoded in `fetch-thorchain-pools.js` script
2. **Duplication**: Icon data existed in both Pioneer Discovery and vault config
3. **Inconsistency**: Hardcoded URLs didn't match Pioneer SDK's asset data
4. **Fallback Issues**: When hardcoded icons failed, there was no proper fallback to Pioneer SDK

## Solution

### 1. Removed Hardcoded Icons from THORChain Config

**File**: `projects/keepkey-vault/scripts/fetch-thorchain-pools.js`

- Removed `ASSET_ICONS` mapping (50+ hardcoded URLs)
- Removed `getAssetIcon()` function
- Updated generated config to NOT include `icon` field
- Added documentation explaining icons come from Pioneer SDK

**Before**:
```javascript
const ASSET_ICONS = {
  'BTC': 'https://pioneers.dev/coins/bitcoin.png',
  'ETH': 'https://pioneers.dev/coins/ethereum.png',
  // ... 50+ more hardcoded URLs
};

const icon = getAssetIcon(symbol, chain);
```

**After**:
```javascript
// NO hardcoded icons - use Pioneer SDK instead
const item = {
  asset: pool.asset,
  chain: parsed.chain,
  symbol,
  name,
  // icon removed - use Pioneer SDK assetData
  caip,
  // ...
};
```

### 2. Updated Swap Component to Use Pioneer SDK

**File**: `projects/keepkey-vault/src/components/swap/Swap.tsx`

Updated icon lookup in `availableAssets` (line 327-340):
```typescript
// Get icon from Pioneer SDK assetsMap FIRST
let icon = balance.icon; // Primary source: Pioneer balance data

if (!icon && app?.assetsMap) {
  const assetInfo = app.assetsMap.get(balance.caip);
  if (assetInfo?.icon) {
    icon = assetInfo.icon;
    console.log(`📍 [SWAP] Using icon from assetsMap for ${ticker}:`, icon);
  }
}

// Final fallback: Use CDN with CAIP
if (!icon) {
  icon = getAssetIconUrl(balance.caip);
}
```

Updated icon lookup in `toAssets` (line 385-397):
```typescript
// Get icon from Pioneer SDK assetsMap FIRST
let icon = balance?.icon; // From user's balance if they have it

if (!icon && app?.assetsMap) {
  const assetInfo = app.assetsMap.get(poolAsset.caip);
  if (assetInfo?.icon) {
    icon = assetInfo.icon;
  }
}

// Final fallback: Use CDN with CAIP
if (!icon) {
  icon = getAssetIconUrl(poolAsset.caip);
}
```

### 3. Updated TypeScript Interface

**File**: `projects/keepkey-vault/src/config/thorchain-pools.ts` (generated)

**Before**:
```typescript
export interface ThorchainPool {
  asset: string;
  chain: string;
  symbol: string;
  name: string;
  icon: string;  // ← REMOVED
  caip: string;
  // ...
}
```

**After**:
```typescript
export interface ThorchainPool {
  asset: string;
  chain: string;
  symbol: string;
  name: string;
  caip: string;  // ← Use this to lookup icons in Pioneer SDK
  // ...
}
```

## Icon Lookup Priority

The fix implements the correct fallback hierarchy:

1. **Pioneer Balance Data** (`balance.icon`)
   - Icons provided by Pioneer SDK when user has a balance

2. **Pioneer AssetsMap** (`app.assetsMap.get(caip)?.icon`)
   - Canonical asset data from `pioneer-discovery/generatedAssetData.json`
   - Contains icons for ALL known assets

3. **CDN Fallback** (`getAssetIconUrl(caip)`)
   - Generates URL using base64-encoded CAIP
   - Format: `https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/{base64_caip}.png`

4. **Generic Icon** (FaCoins)
   - Final fallback in AssetIcon component

## Benefits

### ✅ Single Source of Truth
- All asset metadata centralized in Pioneer Discovery
- No duplication across apps

### ✅ Automatic Updates
- New assets added to Pioneer Discovery automatically appear in vault
- Icon fixes propagate to all consumers

### ✅ Proper CAIP Handling
- Icons keyed by CAIP identifier, not symbol
- Distinguishes between same token on different chains (e.g., ETH mainnet vs ETH on BSC)

### ✅ Reduced Maintenance
- No need to manually update icons in multiple places
- Scripts don't need to track icon URLs

### ✅ Better Fallback
- Graceful degradation through multiple sources
- Always shows *something* even if primary source fails

## Testing

To verify the fix works:

1. **Check Pioneer SDK is loaded**:
   ```javascript
   console.log('Assets Map size:', app.assetsMap?.size);
   ```

2. **Verify icon lookups**:
   ```javascript
   const btcCaip = 'bip122:000000000019d6689c085ae165831e93/slip44:0';
   const btcIcon = app.assetsMap.get(btcCaip)?.icon;
   console.log('BTC icon:', btcIcon);
   ```

3. **Test swap modal**:
   - Open swap interface
   - Check "Select Asset to Receive" modal
   - All assets should show proper icons, not generic coins

## Files Changed

1. ✅ `projects/keepkey-vault/scripts/fetch-thorchain-pools.js`
   - Removed hardcoded ASSET_ICONS mapping
   - Removed getAssetIcon() function
   - Updated generateConfigFile() to exclude icon field
   - Added comments about using Pioneer SDK

2. ✅ `projects/keepkey-vault/src/components/swap/Swap.tsx`
   - Updated availableAssets icon lookup (line 327-340)
   - Updated toAssets icon lookup (line 385-397)
   - Added app.assetsMap to useMemo dependencies (line 414)

3. ✅ `projects/keepkey-vault/src/config/thorchain-pools.ts` (regenerated)
   - No longer contains icon field
   - Updated interface documentation
   - Added note about using Pioneer SDK for icons

4. ✅ `projects/keepkey-vault/docs/ICON-HANDLING.md` (new)
   - Comprehensive documentation on icon handling
   - Examples of correct vs incorrect approaches
   - Troubleshooting guide

## Related Issues

This fix addresses the following anti-patterns:

- ❌ Hardcoding asset metadata in app-specific config files
- ❌ Duplicating icon URLs across multiple locations
- ❌ Using symbol-based lookups instead of CAIP identifiers
- ❌ Not utilizing Pioneer SDK's centralized asset data

## Next Steps

If you encounter missing icons in other parts of the app:

1. Check if Pioneer SDK is being used for icon lookups
2. Look for hardcoded icon URLs or mappings
3. Refactor to use `app.assetsMap.get(caip)?.icon`
4. Test the fallback chain thoroughly

## Documentation

See [ICON-HANDLING.md](./ICON-HANDLING.md) for complete documentation on proper icon handling in KeepKey Vault.

---

**Date**: November 13, 2024
**Issue**: Missing icons in swap asset picker
**Resolution**: Use Pioneer SDK assetData instead of hardcoding

