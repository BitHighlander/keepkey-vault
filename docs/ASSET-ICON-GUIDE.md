# AssetIcon Component Usage Guide

## Overview

The `AssetIcon` component is the **unified, standardized** component for displaying asset/token icons throughout the application. It provides CAIP-based icon resolution with automatic fallbacks and optional network badge overlays.

## Key Features

1. **CAIP-First Design**: All icon lookups use CAIP identifiers (never symbol names)
2. **Automatic Fallbacks**: Primary URL → KeepKey CDN → Generic coin icon
3. **Network Badge Support**: Optional badge overlay showing the blockchain network
4. **Extensible Props**: Customizable badge size, position, and appearance
5. **Consistent Styling**: Unified glassmorphic design across all use cases

## Basic Usage

### Simple Asset Icon

```tsx
import { AssetIcon } from '@/components/ui/AssetIcon';

<AssetIcon
  src={asset.icon}
  caip={asset.caip}
  alt={asset.name}
  boxSize="40px"
/>
```

### With Network Badge

For multi-chain tokens (e.g., USDT on Ethereum, USDC on Polygon), show the network badge:

```tsx
<AssetIcon
  src={asset.icon}
  caip="eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7"
  alt="USDT on Ethereum"
  boxSize="100px"
  showNetworkBadge={true}
/>
```

The network badge will automatically:
- Extract networkId from CAIP (`eip155:1`)
- Look up network icon via `getNetworkIconUrl()`
- Display Ethereum logo badge overlay

### Custom Network ID

If you need to override the network or the CAIP doesn't include the networkId:

```tsx
<AssetIcon
  src={asset.icon}
  caip={asset.caip}
  networkId="eip155:56" // Explicit BSC network
  alt="Asset on BSC"
  boxSize="60px"
  showNetworkBadge={true}
  badgeSize="35%"
  badgePosition="top-right"
/>
```

## Common Use Cases

### 1. Dashboard Balance Rows

```tsx
<AssetIcon
  src={balance.icon}
  caip={balance.caip}
  alt={balance.symbol}
  boxSize="32px"
/>
```

### 2. Asset Detail Page (Large Display)

**For Native Assets (ETH, BTC, etc.):**

```tsx
<AssetIcon
  src={assetContext.icon}
  caip={assetContext.caip}
  symbol={assetContext.symbol}
  alt={`${assetContext.name} Icon`}
  boxSize="80px"
  color={assetContext.color || theme.gold}
/>
```

**For Tokens (USDT, USDC, etc.) - Compound Display:**

```tsx
{/* Main Network Icon (80px) */}
<Box position="relative">
  <Box boxSize="80px">
    <AssetIcon
      src={getNetworkIconUrl(assetContext.networkId)}
      caip={assetContext.networkId}
      alt={`${assetContext.networkId} Network`}
      boxSize="100%"
    />
  </Box>

  {/* Token Icon Overlay (48px) - NO network badge */}
  <Box
    position="absolute"
    bottom="-4"
    right="-4"
    boxSize="48px"
  >
    <AssetIcon
      src={assetContext.icon}
      caip={assetContext.caip}
      alt={assetContext.name}
      boxSize="100%"
      // NO showNetworkBadge - network already shown as main icon
    />
  </Box>
</Box>
```

**Why no `showNetworkBadge` for tokens?**

The compound display already shows:
1. **Large network icon** (Ethereum, BSC, Polygon, etc.)
2. **Small token icon** as overlay (USDT, USDC, etc.)

Adding a network badge on the token icon would create a **triple icon display** (network + token + badge), which is redundant and visually cluttered.

### 3. Swap Interface (Token Selection)

```tsx
<AssetIcon
  src={asset.icon}
  caip={asset.caip}
  symbol={asset.symbol}
  alt={asset.name}
  boxSize="24px"
/>
```

### 4. Transaction History

```tsx
<AssetIcon
  src={tx.assetIcon}
  caip={tx.caip}
  alt={tx.symbol}
  boxSize="36px"
  showNetworkBadge={tx.isToken} // Show badge only for tokens
  networkId={tx.networkId}
/>
```

## Props Reference

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `src` | `string \| null` | No | - | Primary icon URL (from Pioneer SDK) |
| `caip` | `string` | No | - | CAIP identifier for fallback and networkId extraction |
| `symbol` | `string` | No | - | Asset symbol (legacy fallback) |
| `alt` | `string` | **Yes** | - | Alt text for accessibility |
| `boxSize` | `string` | **Yes** | - | Icon size (e.g., "24px", "40px", "100%") |
| `color` | `string` | No | `#FFD700` | Color for FaCoins fallback icon |
| `debug` | `boolean` | No | `false` | Enable debug logging |
| `showNetworkBadge` | `boolean` | No | `false` | Display network badge overlay |
| `networkId` | `string` | No | - | Explicit network ID (CAIP format) |
| `badgeSize` | `string` | No | `40%` | Badge size as percentage of parent |
| `badgePosition` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | No | `bottom-right` | Badge position |

## Network ID Mapping

Network badges use the `NETWORK_CONFIGS` mapping in `lib/utils/networkIcons.ts`:

| Network | NetworkId (CAIP) | Icon |
|---------|------------------|------|
| Ethereum | `eip155:1` | ETH logo |
| BSC | `eip155:56` | BNB logo |
| Polygon | `eip155:137` | MATIC logo |
| Avalanche | `eip155:43114` | AVAX logo |
| Arbitrum | `eip155:42161` | ARB logo |
| Optimism | `eip155:10` | OP logo |
| Bitcoin | `bip122:000000000019d6689c085ae165831e93` | BTC logo |
| Cosmos | `cosmos:cosmoshub-4` | ATOM logo |
| THORChain | `cosmos:thorchain-1` | RUNE logo |

## Best Practices

### 1. Always Provide CAIP

```tsx
// ✅ GOOD: Provides CAIP for fallback
<AssetIcon
  src={asset.icon}
  caip={asset.caip}
  alt={asset.name}
  boxSize="40px"
/>

// ❌ BAD: Only src, no fallback if it fails
<AssetIcon
  src={asset.icon}
  alt={asset.name}
  boxSize="40px"
/>
```

### 2. Show Network Badge for Tokens (Small Displays Only)

**For small displays (lists, cards):**

```tsx
// ✅ GOOD: Shows network context for multi-chain token
<AssetIcon
  src={usdtIcon}
  caip="eip155:1/erc20:0xdac17f..."
  alt="USDT"
  boxSize="32px"
  showNetworkBadge={true}
/>
```

**For large displays (detail pages) - Use compound display instead:**

```tsx
// ✅ GOOD: Compound display for tokens
<Box position="relative">
  <AssetIcon src={networkIcon} boxSize="80px" />
  <Box position="absolute" bottom="-4" right="-4" boxSize="48px">
    <AssetIcon src={tokenIcon} boxSize="100%" />
  </Box>
</Box>

// ❌ BAD: Triple badge (network + token + badge)
<Box position="relative">
  <AssetIcon src={networkIcon} boxSize="80px" />
  <Box position="absolute" bottom="-4" right="-4">
    <AssetIcon
      src={tokenIcon}
      boxSize="48px"
      showNetworkBadge={true} // ❌ Creates redundant badge
    />
  </Box>
</Box>
```

**Rule of thumb:**
- **Small tokens (≤40px)**: Use `showNetworkBadge={true}`
- **Large tokens (>40px)**: Use compound display pattern

### 3. Use Consistent Sizes

Maintain visual hierarchy with standard sizes:

- **List items**: 24px-32px
- **Cards/buttons**: 40px-48px
- **Detail pages**: 80px-120px
- **Large displays**: "100%" (container-based)

### 4. Provide Meaningful Alt Text

```tsx
// ✅ GOOD: Descriptive alt text
<AssetIcon
  caip={asset.caip}
  alt={`${asset.name} on ${networkName}`}
  boxSize="40px"
/>

// ❌ BAD: Generic alt text
<AssetIcon
  caip={asset.caip}
  alt="Token"
  boxSize="40px"
/>
```

## Migration from Legacy Patterns

### Before (Inconsistent)

```tsx
// Multiple different icon implementations
<Image src={asset.icon} boxSize="40px" />
<Avatar src={asset.icon} size="md" />
<Box as="img" src={asset.icon} />
```

### After (Unified)

```tsx
// Single standardized component
<AssetIcon
  src={asset.icon}
  caip={asset.caip}
  alt={asset.name}
  boxSize="40px"
/>
```

## Troubleshooting

### Issue: Network badge not showing

**Solution**: Ensure networkId is in NETWORK_CONFIGS:

```tsx
import { getNetworkIconUrl } from '@/lib/utils/networkIcons';

const iconUrl = getNetworkIconUrl('eip155:1');
console.log('Network icon:', iconUrl); // Should return URL
```

### Issue: Icon shows coin fallback instead of asset icon

**Possible causes**:
1. Primary `src` is invalid/unreachable
2. CAIP is not in KeepKey CDN
3. Network request failed

**Debug**:

```tsx
<AssetIcon
  src={asset.icon}
  caip={asset.caip}
  alt={asset.name}
  boxSize="40px"
  debug={true} // Enable logging
/>
```

### Issue: Badge appears too large/small

**Solution**: Adjust badgeSize prop:

```tsx
<AssetIcon
  showNetworkBadge={true}
  badgeSize="30%" // Smaller badge
  boxSize="100px"
/>
```

## Future Enhancements

Potential improvements under consideration:

1. **Multiple badges**: Support for LP tokens with 2 asset badges
2. **Badge animations**: Pulse/glow effects for active swaps
3. **Smart badge positioning**: Auto-adjust based on asset icon shape
4. **Badge tooltips**: Show network name on hover
5. **Loading states**: Shimmer effect during icon load

## Related Documentation

- [Icon Handling Guide](./ICON-HANDLING.md)
- [Network Icons Reference](./ICON-IMPROVEMENTS.md)
- [Asset Data Structure](./COIN_ADDITION_GUIDE.md)
