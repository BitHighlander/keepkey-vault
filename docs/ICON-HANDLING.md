# Icon Handling in KeepKey Vault

## Overview

Asset icons in KeepKey Vault are managed by the **Pioneer SDK** through the `pioneer-discovery` module, not by hardcoding URLs in individual components or config files.

## Architecture

### Source of Truth: Pioneer Discovery

All asset metadata, including icons, is centralized in:
```
projects/pioneer/modules/pioneer/pioneer-discovery/src/generatedAssetData.json
```

This file contains comprehensive asset data for all supported assets with:
- Asset identifiers (CAIP format)
- Names and symbols
- Icon URLs (stored on KeepKey CDN using base64-encoded CAIP identifiers)
- Network information
- And more

### Icon Lookup Priority

When displaying an asset icon, use this priority order:

1. **Pioneer SDK balance data** (`balance.icon`)
   - When the user has a balance for an asset, Pioneer provides the icon
   
2. **Pioneer SDK assetsMap** (`app.assetsMap.get(caip).icon`)
   - Complete asset metadata from Pioneer Discovery
   - Contains icons for all known assets, even those without balances
   
3. **CDN Fallback** (`getAssetIconUrl(caip)`)
   - Generates URL using base64-encoded CAIP identifier
   - Format: `https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/{base64_caip}.png`

4. **Generic Icon** (FaCoins component)
   - Final fallback when no icon source is available

## Implementation Examples

### ✅ CORRECT: Use Pioneer SDK

```typescript
// Get icon from Pioneer SDK first
let icon = balance.icon; // Primary source: Pioneer balance data

if (!icon && app?.assetsMap) {
  const assetInfo = app.assetsMap.get(balance.caip);
  if (assetInfo?.icon) {
    icon = assetInfo.icon;
  }
}

// Final fallback: Use CDN with CAIP
if (!icon) {
  icon = getAssetIconUrl(balance.caip);
}
```

### ❌ INCORRECT: Hardcode Icons

```typescript
// DON'T DO THIS - hardcoding defeats the purpose of Pioneer Discovery
const ASSET_ICONS = {
  'BTC': 'https://pioneers.dev/coins/bitcoin.png',
  'ETH': 'https://pioneers.dev/coins/ethereum.png',
  // ... more hardcoded icons
};

const icon = ASSET_ICONS[symbol] || fallback;
```

## Why This Approach?

### Benefits of Using Pioneer SDK

1. **Single Source of Truth**
   - One centralized asset database for all Pioneer apps
   - Consistent icons across desktop, mobile, and web

2. **Automatic Updates**
   - When new assets are added to Pioneer Discovery, all apps get them
   - Icon fixes in Pioneer propagate to all consumers

3. **Reduced Maintenance**
   - No need to manually update icon URLs in multiple places
   - No risk of stale or broken URLs in individual apps

4. **Better Fallback Strategy**
   - CDN uses CAIP identifiers (unique per asset)
   - Symbol-based lookups can be ambiguous (ETH on multiple chains)

### Problems with Hardcoding

1. **Data Duplication**
   - Same icons defined in multiple places
   - High risk of inconsistency

2. **Maintenance Burden**
   - Every new asset requires updates in multiple files
   - Broken URLs need manual fixes everywhere

3. **Symbol Ambiguity**
   - Same symbol (e.g., "ETH") exists on multiple chains
   - Hardcoded mappings can't distinguish between them

4. **Stale Data**
   - Hardcoded URLs may break if sources change
   - No automatic updates when better icons become available

## Files That Should NOT Have Hardcoded Icons

- ✅ `projects/keepkey-vault/src/config/thorchain-pools.ts`
  - Contains only pool metadata (symbol, name, CAIP)
  - NO icon field - lookup via Pioneer SDK instead

- ✅ `projects/keepkey-vault/src/components/swap/Swap.tsx`
  - Uses `app.assetsMap` and `balance.icon`
  - Falls back to CDN with CAIP, never hardcoded URLs

- ✅ `projects/keepkey-vault/scripts/fetch-thorchain-pools.js`
  - Generates thorchain-pools.ts without icons
  - Comments explain icons come from Pioneer SDK

## AssetIcon Component

The `AssetIcon` component (`src/components/ui/AssetIcon.tsx`) implements the proper fallback cascade:

```typescript
<AssetIcon 
  src={asset.icon}        // From Pioneer SDK
  caip={asset.caip}       // Used for CDN fallback
  alt={asset.name}
  boxSize="48px"
/>
```

The component automatically:
1. Tries the provided `src` URL
2. Falls back to KeepKey CDN with base64-encoded CAIP
3. Falls back to localhost (development)
4. Shows generic coin icon as final fallback

## Updating Asset Icons

### For All Apps (Recommended)

Update icons in Pioneer Discovery:
```bash
cd projects/pioneer/modules/pioneer/pioneer-discovery
# Edit src/generatedAssetData.json or use icon scripts
bun run build
```

All Pioneer apps will automatically use the updated icons.

### For Development/Testing

The AssetIcon component supports a localhost fallback:
```
http://localhost:9001/coins/{base64_caip}.png
```

This is useful for testing new icons before uploading to CDN.

## Migration Guide

If you find hardcoded icons in the codebase:

1. **Identify the icon usage**
   - Is it for an asset display?
   - Is it configuration data?

2. **Remove hardcoded URLs**
   ```typescript
   // Before
   const icon = 'https://pioneers.dev/coins/bitcoin.png';
   
   // After
   const icon = app.assetsMap.get(caip)?.icon || getAssetIconUrl(caip);
   ```

3. **Use CAIP identifiers, not symbols**
   ```typescript
   // Before - symbol lookup (ambiguous)
   const icon = ICONS[asset.symbol];
   
   // After - CAIP lookup (unique)
   const icon = app.assetsMap.get(asset.caip)?.icon;
   ```

4. **Test the fallback chain**
   - Verify icons load from Pioneer SDK
   - Test CDN fallback
   - Confirm generic icon appears when all else fails

## Troubleshooting

### Icons showing as generic coins

1. Check if Pioneer SDK is loaded: `console.log(app.assetsMap.size)`
2. Verify CAIP identifier is correct: `console.log(asset.caip)`
3. Check Pioneer Discovery has the asset: Look in `generatedAssetData.json`
4. Verify CDN URL is accessible: Try the base64-encoded CAIP URL directly

### Icons not loading

1. Check browser console for 404 errors
2. Verify the CAIP identifier is properly formatted
3. Check if the icon exists in Pioneer Discovery
4. Try the CDN URL directly to test accessibility

## Related Documentation

- [Pioneer Discovery README](../../pioneer/modules/pioneer/pioneer-discovery/README.md)
- [Pioneer Discovery Icon Fix Reports](../../pioneer/modules/pioneer/pioneer-discovery/docs/)
- [AssetIcon Component](../src/components/ui/AssetIcon.tsx)

## Summary

**Always use Pioneer SDK for asset icons. Never hardcode icon URLs in components or configuration files.**

This ensures:
- Consistency across all Pioneer apps
- Automatic updates when icons improve
- Proper handling of multi-chain assets
- Reduced maintenance burden

