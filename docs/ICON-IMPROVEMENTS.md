# Icon System Improvements

## Overview

This document describes the improvements made to the icon system to address broken icons and improve user experience with multi-chain asset identification.

## Problems Addressed

### 1. Broken Icons
**Issue**: Many assets displayed broken icon placeholders (generic coin icons) instead of actual asset images.

**Root Cause**:
- Missing icons in the KeepKey CDN (DigitalOcean Spaces)
- Icon lookup failures due to missing or incorrect CAIP mappings
- No fallback chain for icon resolution

**Solution**:
- Enhanced `AssetIcon` component with a 3-level fallback cascade:
  1. Primary URL from Pioneer SDK
  2. KeepKey CDN (api.keepkey.info) with base64-encoded CAIP
  3. Localhost fallback (localhost:9001) for development
  4. Generic coin icon (FaCoins) as final fallback

### 2. Network Ambiguity
**Issue**: Users could not distinguish between assets on different networks (e.g., USDT on Ethereum vs. USDT on Avalanche).

**Critical Impact**: Could result in users sending assets to the wrong network, causing permanent loss of funds.

**Example from User Report**:
> "I would have been upset I want mainnet USDT"
> - User nearly selected AVAX.USDT instead of ETH.USDT for a swap

**Solution**: Implemented dual avatar system with network badges and color coding.

## New Features

### 1. Network Icon Mapping (`src/lib/utils/networkIcons.ts`)

Created a comprehensive network configuration system with:

```typescript
export interface NetworkConfig {
  name: string;        // Network display name
  icon: string;        // CDN URL for network icon
  color: string;       // Brand color for UI theming
  sortOrder: number;   // Sort priority
}
```

**Supported Networks**:
- **Bitcoin** (orange, `#F7931A`) - Priority 0
- **Ethereum** (blue, `#627EEA`) - Priority 1
- **BNB Chain** (yellow, `#F3BA2F`) - Priority 2
- **Avalanche** (red, `#E84142`) - Priority 3
- **Arbitrum**, **Optimism**, **Polygon** - Priorities 4-6
- **Bitcoin Cash**, **Litecoin**, **Dogecoin** - Priorities 7-9
- **Cosmos**, **THORChain** - Priorities 10-11

**Key Functions**:
- `getNetworkIconUrl(networkId)` - Get network icon from CAIP networkId
- `getNetworkColor(networkId)` - Get brand color for theming
- `getNetworkName(networkId)` - Get display name
- `getNetworkSortOrder(networkId)` - Get sort priority
- `extractNetworkId(caip)` - Extract networkId from full CAIP

### 2. Enhanced AssetIcon Component

**New Props**:
```typescript
interface AssetIconProps {
  // ... existing props ...
  showNetworkBadge?: boolean;  // Show network badge overlay
  networkId?: string;          // Network ID for badge (CAIP format)
}
```

**Network Badge**:
- Positioned at bottom-right corner (40% of icon size)
- Dark background with white border for visibility
- Displays network icon (e.g., ETH logo for Ethereum assets)
- Automatically extracts networkId from CAIP if not provided

**Usage**:
```tsx
<AssetIcon
  src={asset.icon}
  caip="eip155:43114/erc20:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7"
  alt="USDT (Avalanche)"
  boxSize="48px"
  showNetworkBadge={true}
/>
```

### 3. Improved AssetPicker Component

**Network-Based Sorting**:
- Primary sort: By network (Bitcoin → Ethereum → BNB → Avalanche → etc.)
- Secondary sort: By USD balance within each network
- Result: Assets grouped by network, making it easy to find the right chain

**Visual Enhancements**:

1. **Color-Coded Top Border**:
   - Each asset card has a colored top border matching its network
   - Ethereum assets: Blue border
   - Avalanche assets: Red border
   - BNB Chain assets: Yellow border

2. **Network Name Badge**:
   - Displays network name below asset icon
   - Color-coded text and border matching network brand color
   - Uppercase, small font for subtle but clear identification

3. **Enhanced Hover Effects**:
   - Top border glows with network color on hover
   - Dual box-shadow: KeepKey teal + network color accent

**Example Card Structure**:
```
┌─[Network Color Border]──────────────┐
│  ⚪ ← Balance USD (top-right)       │
│  🪙 ← Asset Icon + Network Badge    │
│  USDT ← Symbol                      │
│  [AVALANCHE] ← Network Badge        │
│  Tether USD (Avalanche) ← Name      │
│  eip155:43114/erc20:0x... ← CAIP   │
└──────────────────────────────────────┘
```

## Icon Upload Requirements

### Missing Icons

To upload missing icons to S3 (DigitalOcean Spaces), use the following process:

1. **Source Icons**: Get high-quality PNG icons from:
   - CoinGecko API
   - Official project websites
   - Pioneer SDK asset registry

2. **Filename Format**: Base64-encode the CAIP identifier
   ```bash
   # Example for AVAX.USDT
   CAIP="eip155:43114/erc20:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7"
   FILENAME=$(echo -n "$CAIP" | base64).png
   # Result: ZWlwMTU1OjQzMTE0L2VyYzIwOjB4OTcwMjIzMGE4ZWE1MzYwMWY1Y2QyZGMwMGZkYmMxM2Q0ZGY0YThjNw==.png
   ```

3. **Upload to CDN**:
   ```bash
   aws s3 cp icon.png s3://keepkey/coins/$FILENAME \
     --acl public-read \
     --endpoint-url https://sfo3.digitaloceanspaces.com
   ```

4. **Verify**:
   ```
   https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/$FILENAME
   ```

### Priority Icons to Upload

Based on THORChain pools and common user assets:

**High Priority** (Most traded):
- ✅ ETH (Ethereum mainnet)
- ✅ BTC (Bitcoin)
- ❌ USDT (Ethereum) - `eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7`
- ❌ USDT (Avalanche) - `eip155:43114/erc20:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7`
- ❌ USDT (BNB Chain) - `eip155:56/erc20:0x55d398326f99059ff775485246999027b3197955`
- ❌ USDC (Ethereum) - `eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
- ❌ USDC (Avalanche) - `eip155:43114/erc20:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e`
- ❌ SOL (Avalanche wrapped) - `eip155:43114/erc20:0xfe6b19286885a4f7f55adad09c3cd1f906d2478f`

**Medium Priority** (Common chains):
- ✅ AVAX (Avalanche native)
- ✅ BNB (BNB Chain native)
- ❌ BCH (Bitcoin Cash)
- ❌ LTC (Litecoin)
- ❌ DOGE (Dogecoin)

**Low Priority** (Less common):
- ❌ Cosmos Hub (ATOM)
- ❌ THORChain (RUNE)
- ❌ Various ERC20 tokens on different chains

## Testing

### Manual Testing Checklist

1. **Icon Fallback Chain**:
   - [ ] Primary URL loads correctly
   - [ ] CDN fallback works for missing primary URLs
   - [ ] Generic icon displays for completely missing assets

2. **Network Badge**:
   - [ ] Badge appears on bottom-right of icon
   - [ ] Correct network icon displays (ETH logo for Ethereum, etc.)
   - [ ] Badge scales properly with different icon sizes

3. **Network Color Coding**:
   - [ ] Top border matches network color
   - [ ] Network name badge has correct color
   - [ ] Hover effect shows network color glow

4. **Sorting**:
   - [ ] Assets grouped by network
   - [ ] Bitcoin assets appear first
   - [ ] Within each network, sorted by USD balance

5. **User Experience**:
   - [ ] Easy to distinguish ETH.USDT from AVAX.USDT
   - [ ] Clear visual hierarchy (balance → icon → symbol → network → name)
   - [ ] No confusion about which chain to select

### Automated Testing

Add E2E tests for:
```typescript
// Test network badge visibility
test('AssetPicker shows network badges', async () => {
  const picker = await screen.findByRole('dialog');
  const usdtEth = await within(picker).findByText('ETHEREUM');
  const usdtAvax = await within(picker).findByText('AVALANCHE');
  expect(usdtEth).toBeInTheDocument();
  expect(usdtAvax).toBeInTheDocument();
});

// Test network-based sorting
test('Assets sorted by network then balance', async () => {
  const assets = await screen.findAllByRole('button');
  // First asset should be Bitcoin (sortOrder: 0)
  expect(assets[0]).toContainText('BTC');
  // Then Ethereum (sortOrder: 1)
  expect(assets[1]).toContainText('ETH');
});
```

## Implementation Details

### CAIP Format

All icons use CAIP (Chain Agnostic Improvement Proposal) format:
```
<namespace>:<reference>/<asset_namespace>:<asset_reference>
```

Examples:
- Ethereum ETH: `eip155:1/slip44:60`
- Avalanche USDT: `eip155:43114/erc20:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7`
- Bitcoin: `bip122:000000000019d6689c085ae165831e93/slip44:0`

### CDN Structure

Icons stored at:
```
https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/[BASE64_CAIP].png
```

Network ID extraction:
```
eip155:43114/erc20:0x... → eip155:43114
bip122:000.../slip44:0   → bip122:000...
```

## Future Improvements

1. **Icon Upload Automation**:
   - Script to bulk-upload missing icons from CoinGecko
   - Automated CAIP encoding and S3 upload
   - Validation and duplicate detection

2. **Network Badges**:
   - Support for more networks (Solana, Polkadot, etc.)
   - Animated badges for special tokens (governance, stablecoins)
   - Custom badges for verified/audited tokens

3. **Search Enhancement**:
   - Filter by network: "Show only Ethereum assets"
   - Search by network name: "avalanche usdt"
   - Recent networks prioritization

4. **Performance**:
   - Lazy loading for icons (IntersectionObserver)
   - WebP format for smaller file sizes
   - Progressive image loading

5. **Accessibility**:
   - ARIA labels for network badges
   - Keyboard navigation between network groups
   - Screen reader announcements for network context

## Maintenance

### Adding New Networks

1. Add network config to `networkIcons.ts`:
```typescript
'eip155:10': {
  name: 'Optimism',
  icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/[BASE64_CAIP].png',
  color: '#FF0420',
  sortOrder: 5,
}
```

2. Upload network icon to CDN

3. Update documentation

### Monitoring

- Track icon 404 errors in CDN logs
- Monitor user feedback for missing icons
- Regular audits of new THORChain pools

## References

- [CAIP Standards](https://github.com/ChainAgnostic/CAIPs)
- [KeepKey CDN](https://keepkey.sfo3.cdn.digitaloceanspaces.com)
- [Pioneer SDK Asset Registry](https://github.com/BitHighlander/pioneer)
- [THORChain Pools](https://docs.thorchain.org)
