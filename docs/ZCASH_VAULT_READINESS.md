# ZCash (ZEC) Vault Integration Readiness

This document tracks the status of ZCash (ZEC) support in KeepKey Vault and what needs to be done.

## Current Status

### ✅ Pioneer Platform (Backend) - COMPLETE
All backend packages have been updated and published with ZCash support:

**Published Packages (v8.15.25 / v9.11.3)**:
- `@pioneer-platform/pioneer-caip@9.10.3` - CAIP definitions ✅
- `@pioneer-platform/pioneer-coins@9.11.3` - Coin paths ✅
- `@pioneer-platform/pioneer-discovery@8.15.25` - Asset discovery ✅
- `@pioneer-platform/pioneer-sdk@8.15.25` - Core SDK ✅
- `@pioneer-platform/pioneer-types@8.11.2` - Type definitions ✅

**ZCash Configuration in Pioneer**:
```typescript
// From pioneer-caip/src/data.ts
Chain.Zcash = 'ZEC'
BaseDecimal.ZEC = 8
ChainToCaip['ZEC'] = 'bip122:00000000019d6689c085ae1e/slip44:133'
ChainToNetworkId['ZEC'] = 'bip122:00000000019d6689c085ae1e'
```

### ⚠️ KeepKey Vault (Frontend) - NEEDS UPDATE

**Package Updates Applied**:
- ✅ Pioneer packages bumped to latest versions with ZCash support
- ✅ `bun.lock` updated with new dependencies

**Code Status**:
```typescript
// src/utils/keepkeyAddress.ts - CURRENT STATE
NetworkIdToChain = {
  'zcash:main': 'zcash',  // ❌ INCORRECT - Using old format
}

COIN_MAP_KEEPKEY = {
  'zcash': 'Zcash',  // ✅ CORRECT
}

networkIdToType = {
  'zcash:main': 'UTXO',  // ❌ INCORRECT - Using old format
}
```

## Required Updates

### 1. Update NetworkId Format in keepkeyAddress.ts

**File**: `src/utils/keepkeyAddress.ts`

**Change Line 17** from:
```typescript
'zcash:main': 'zcash',
```

**To**:
```typescript
'bip122:00000000019d6689c085ae1e': 'zcash',  // ZCash mainnet
```

**Change Line 57** from:
```typescript
'zcash:main': 'UTXO',
```

**To**:
```typescript
'bip122:00000000019d6689c085ae1e': 'UTXO',  // ZCash mainnet
```

### 2. Update Swap Component (if needed)

**File**: `src/components/swap/Swap.tsx`

Search for `'zcash:main'` references and update to `'bip122:00000000019d6689c085ae1e'`.

### 3. Testing Requirements

Once the networkId is updated, test the following:

**Basic Functionality**:
- [ ] ZCash appears in asset list
- [ ] Can select ZCash wallet
- [ ] Address generation works (m/44'/133'/0')
- [ ] Balance fetching works
- [ ] Transaction history displays

**Send/Receive**:
- [ ] Can generate receive addresses
- [ ] Can build ZCash transactions
- [ ] Can sign transactions with KeepKey
- [ ] Can broadcast transactions
- [ ] Fee estimation works

**Swap Integration**:
- [ ] ZCash appears in swap UI
- [ ] Can swap from ZCash
- [ ] Can swap to ZCash
- [ ] Swap quote fetching works

## ZCash Technical Details

### Network Information
| Property | Value |
|----------|-------|
| Symbol | `ZEC` |
| Full Name | `Zcash` |
| SLIP44 Coin Type | `133` |
| NetworkId (CAIP-2) | `bip122:00000000019d6689c085ae1e` |
| CAIP (with slip44) | `bip122:00000000019d6689c085ae1e/slip44:133` |
| Decimals | `8` (satoshis) |
| Type | `UTXO` |

### Derivation Paths
```
m/44'/133'/0'    - Default account (BIP44)
m/44'/133'/0'/0  - Receive addresses
m/44'/133'/0'/1  - Change addresses
```

### Address Prefixes
- P2PKH (legacy): Starts with `t1`
- P2SH (script): Starts with `t3`

### Blockbook Node
```typescript
{
  symbol: "ZEC",
  blockchain: "zcash",
  caip: "bip122:00000000019d6689c085ae1e/slip44:133",
  networkId: "bip122:00000000019d6689c085ae1e",
  type: "blockbook",
  service: "https://zecbook.nownodes.io/YOUR-API-KEY",
  websocket: "wss://zec.nownodes.io/wss"
}
```

## Implementation Checklist

### Pioneer Platform (Backend)
- [x] CAIP definitions added
- [x] Coin paths configured
- [x] Asset discovery setup
- [x] SDK support implemented
- [x] Packages built successfully
- [x] Packages published to npm
- [x] Integration tests passing

### KeepKey Vault (Frontend)
- [x] Pioneer packages updated to latest
- [x] NetworkId format corrected in keepkeyAddress.ts
- [x] Swap component updated
- [x] Build passes
- [ ] Manual testing with device (READY FOR TESTING)
- [ ] Balance display works
- [ ] Send/receive functionality
- [ ] Swap integration tested

## Next Steps

1. **Update NetworkId Format**
   - Modify `src/utils/keepkeyAddress.ts` lines 17 and 57
   - Update any references in `src/components/swap/Swap.tsx`

2. **Build and Test**
   ```bash
   bun run build
   bun run dev
   ```

3. **Device Testing**
   - Connect KeepKey device
   - Verify ZCash appears in asset list
   - Test address generation
   - Test balance fetching
   - Test send/receive flow

4. **Deployment**
   - Commit changes
   - Deploy to staging for final testing
   - Deploy to production

## References

- Pioneer Coin Addition Guide: `/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/docs/coin-addition/coin-addition-guide.md`
- SLIP44 Registry: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
- ZCash Docs: https://zcash.readthedocs.io/
- Blockbook API: https://github.com/trezor/blockbook

## Notes

- ZCash uses UTXO model like Bitcoin
- Supports transparent addresses (t-addresses) only in KeepKey
- Shielded addresses (z-addresses) require different crypto and are not supported
- Uses same signing flow as other UTXO coins (BTC, LTC, DOGE, etc.)
