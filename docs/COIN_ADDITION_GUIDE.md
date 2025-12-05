# KeepKey Vault - Coin Addition Guide

Complete guide for adding new blockchain assets to KeepKey Vault. This requires changes in **BOTH** the Pioneer monorepo (backend) and Vault repo (frontend).

## Overview

Adding a new coin requires:
1. ✅ **Pioneer Platform (Backend)** - Add coin support and publish packages
2. ✅ **KeepKey Vault (Frontend)** - Update packages and add UI support
3. ✅ **Testing** - Verify with connected KeepKey device

---

## Part 1: Pioneer Platform (Backend)

### Required Information

Gather this information before starting:

| Info | Example (ZCash) | Where to Find |
|------|----------------|---------------|
| Symbol | `ZEC` | Official project |
| Full Name | `Zcash` | Official project |
| SLIP44 Coin Type | `133` | [SLIP44 Registry](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) |
| Genesis Block Hash | `00040fe8ec8471911baa1db1266ea15d` | Block explorer or chainparams.cpp |
| Blockbook URL | `https://zecbook.nownodes.io/...` | NowNodes, Trezor, or self-hosted |
| Address Prefixes | `t1` (p2pkh), `t3` (p2sh) | Technical docs |
| Decimals | `8` (satoshis) | Standard for most UTXO |

### Checklist: Pioneer Platform Files

Location: `/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer`

#### Core Configuration (Required)

- [ ] **1. CAIP Definitions** - `modules/pioneer/pioneer-caip/src/data.ts`
  - [ ] Add to `Chain` enum: `Zcash = 'ZEC'`
  - [ ] Add to `BaseDecimal`: `ZEC: 8`
  - [ ] Add to `ChainToCaip`: `'ZEC': 'bip122:00040fe8ec8471911baa1db1266ea15d/slip44:133'`
  - [ ] Add to `ChainToNetworkId`: `'ZEC': 'bip122:00040fe8ec8471911baa1db1266ea15d'`
  - [ ] Add to `shortListSymbolToCaip`: `ZEC: 'bip122:...'`
  - [ ] Add to `shortListNameToCaip`: `zcash: 'bip122:...'`
  - [ ] Add to `UTXOChainList`: `Chain.Zcash`

- [ ] **2. Derivation Paths** - `modules/pioneer/pioneer-coins/src/paths.ts`
  - [ ] Add to `blockchains` array: `'bip122:00040fe8ec8471911baa1db1266ea15d'`
  - [ ] Add path definition in `getPaths()` function:
    ```typescript
    if(blockchains.indexOf('bip122:00040fe8ec8471911baa1db1266ea15d') >= 0){
        let entry:any = {
            note:"Zcash Default path",
            type:"xpub",
            networks: ['bip122:00040fe8ec8471911baa1db1266ea15d'],
            script_type:"p2pkh",
            available_scripts_types:['p2pkh'],
            addressNList: [0x80000000 + 44, 0x80000000 + 133, 0x80000000 + 0],
            addressNListMaster: [0x80000000 + 44, 0x80000000 + 133, 0x80000000 + 0, 0, 0],
            curve: 'secp256k1',
            showDisplay: false,
        }
        if(isTestnet) entry.testnet = true
        output.push(entry)
    }
    ```

- [ ] **3. Node Configuration** - `modules/pioneer/pioneer-nodes/src/seeds.ts`
  ```typescript
  {
      symbol: "ZEC",
      blockchain: "zcash",
      caip: "bip122:00040fe8ec8471911baa1db1266ea15d/slip44:133",
      networkId: "bip122:00040fe8ec8471911baa1db1266ea15d",
      type: "blockbook",
      service: "https://zecbook.nownodes.io/YOUR-API-KEY",
      websocket: "wss://zec.nownodes.io/wss"
  }
  ```

- [ ] **4. Asset Discovery** - `modules/pioneer/pioneer-discovery/src/generatedAssetData.json`
  - Usually auto-generated, but verify ZEC entry exists

- [ ] **5. UTXO Network Config** - `services/pioneer-server/src/config/utxo-networks.config.ts`
  ```typescript
  'bip122:00040fe8ec8471911baa1db1266ea15d': {
      networkId: 'bip122:00040fe8ec8471911baa1db1266ea15d',
      name: 'Zcash',
      symbol: 'ZEC',
      slip44: 133,
      blockbookUrl: process.env.BLOCKBOOK_ZEC_URL || 'https://zecbook.nownodes.io',
      priceKey: 'zcash',
      satoshisPerCoin: 100000000,
      addressPrefixes: {
          p2pkh: ['t1'],
          p2sh: ['t3'],
          p2wpkh: []
      }
  }
  ```

#### SDK Files (Required)

- [ ] **6. getPubkey.ts** - `modules/pioneer/pioneer-sdk/src/getPubkey.ts`
  - Add to `networkIdToType` map: `'bip122:00040fe8ec8471911baa1db1266ea15d': 'UTXO'`

- [ ] **7. supportedCaips.ts** - `modules/pioneer/pioneer-sdk/src/supportedCaips.ts`
  - Add to `UTXO_SUPPORT` array
  - Add to `CAIP_TO_COIN_MAP`: `'bip122:00040fe8ec8471911baa1db1266ea15d': 'Zcash'`

- [ ] **8. Fee Configuration** - `modules/pioneer/pioneer-sdk/src/fees/index.ts`
  - Add fee sanity limits
  - Add network name mapping

- [ ] **9. Asset Colors (Optional)** - `modules/pioneer/pioneer-sdk/src/index.ts`
  - Add to `ASSET_COLORS` for UI color scheme

#### Balance Module (Required)

- [ ] **10. Balance Module** - `modules/pioneer/pioneer-balance/src/index.ts`
  - Add to `UTXO_SUPPORT` array
  - Add to `CAIP_TO_COIN_MAP`
  - Add to `networkIdToSymbol`

#### Server Controllers (Required)

- [ ] **11. Broadcast Controller** - `services/pioneer-server/src/controllers/broadcast.controller.ts`
  - Add to `UTXO_NETWORK_IDS` array

- [ ] **12. UTXO Controller** - `services/pioneer-server/src/controllers/utxo.controller.ts`
  - Add to `UTXO_NETWORK_MAP` (appears in multiple locations in file)

#### UTXO Network Module (Required for Fees)

- [ ] **13. UTXO Network Module** - `modules/coins/utxo/utxo-network/src/index.ts`
  - Add to `feeCapsBySatPerByte`
  - Add to `defaultFees`

#### Pricing (Required for USD Values)

- [ ] **14. Markets Integration** - `modules/intergrations/markets/src/index.ts`
  - Add to `MAJOR_CRYPTO_WHITELIST`

#### Wallet Support (CRITICAL!)

- [ ] **15. Wallet Support** - `modules/pioneer/pioneer-types/src/pioneer.ts`
  - **REQUIRED**: Add to `availableChainsByWallet[WalletOption.KEEPKEY]` array
  - Add `Chain.Zcash` to the KeepKey supported chains list
  - **Without this, the coin will NOT appear in the vault UI!**

#### Integration Tests

- [ ] **16. Integration Tests** - `e2e/wallets/intergration-coins/src/index.ts`
  - Add to `AllChainsSupported` array: `'ZEC'`

### Build and Publish

```bash
# Build all packages
make build

# Publish to npm
make publish

# Note the published version numbers (e.g., 8.15.26)
```

**Important**: After publishing, note the new version numbers. You'll need these for the vault update.

---

## Part 2: KeepKey Vault (Frontend)

Location: `/Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault`

### Checklist: Vault Files

#### Package Updates (REQUIRED)

- [ ] **1. Update Pioneer Packages** - `package.json`
  ```bash
  cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault
  bun update '@pioneer-platform/pioneer-caip' \
             '@pioneer-platform/pioneer-coins' \
             '@pioneer-platform/pioneer-discovery' \
             '@pioneer-platform/pioneer-sdk' \
             '@pioneer-platform/pioneer-types'
  ```

#### NetworkId Mappings (REQUIRED)

- [ ] **2. Address Utilities** - `src/utils/keepkeyAddress.ts`
  - [ ] Add to `NetworkIdToChain`:
    ```typescript
    'bip122:00040fe8ec8471911baa1db1266ea15d': 'zcash',  // ZCash mainnet
    ```
  - [ ] Add to `COIN_MAP_KEEPKEY`:
    ```typescript
    'zcash': 'Zcash',
    ```
  - [ ] Add to `networkIdToType`:
    ```typescript
    'bip122:00040fe8ec8471911baa1db1266ea15d': 'UTXO',  // ZCash mainnet
    ```

#### Swap Integration (If Applicable)

- [ ] **3. Swap Component** - `src/components/swap/Swap.tsx`
  - [ ] Find and update `networkIdToType` objects (usually 2 locations)
  - [ ] Add: `'bip122:00040fe8ec8471911baa1db1266ea15d': 'UTXO'`

#### UI Enhancements (Optional)

- [ ] **4. Asset Icons** - `src/components/ui/AssetIcon.tsx`
  - Usually uses CoinGecko/CoinCap icons automatically
  - Add custom icon if needed

- [ ] **5. Custom Theming** - Update if coin has specific branding requirements

### Build and Test

```bash
# Build vault
bun run build

# Run in development mode
bun run dev

# Test with KeepKey device
# - Connect device
# - Check ZCash appears in asset list
# - Test address generation
# - Test balance fetching
# - Test send/receive
```

---

## Testing Checklist

### With Connected KeepKey Device

- [ ] Coin appears in asset list
- [ ] Can select coin wallet
- [ ] Address generation works (check derivation path)
- [ ] Balance fetching works
- [ ] Transaction history displays correctly
- [ ] Can generate receive addresses
- [ ] Can build transactions
- [ ] Can sign transactions with device
- [ ] Can broadcast transactions
- [ ] Fee estimation works
- [ ] USD pricing displays correctly

### Swap Testing (If Applicable)

- [ ] Coin appears in swap UI
- [ ] Can swap FROM the coin
- [ ] Can swap TO the coin
- [ ] Quote fetching works
- [ ] Swap execution completes

---

## Common Mistakes to Avoid

### ❌ Missing Steps

1. **Forgetting to add to KEEPKEY wallet support**
   - File: `modules/pioneer/pioneer-types/src/pioneer.ts`
   - Must add `Chain.Zcash` to `availableChainsByWallet[WalletOption.KEEPKEY]`
   - **This is why coins don't show up in the UI!**

2. **Not publishing Pioneer packages**
   - Must run `make publish` after Pioneer changes
   - Vault can't use the new coin until packages are published

3. **Not updating Vault packages**
   - Must run `bun update` on Pioneer packages in vault
   - Old versions won't have the new coin

4. **Wrong NetworkId format**
   - Must use full CAIP-2 format: `bip122:00040fe8ec8471911baa1db1266ea15d`
   - NOT old format like: `zcash:main`

5. **Inconsistent NetworkId across files**
   - Genesis hash must be exactly the same in ALL files
   - Use first 32 characters of display format

### ✅ Best Practices

1. **Use existing coin as reference**
   - Copy similar coin (e.g., DGB for UTXO coins)
   - Search for the coin symbol in all files

2. **Test incrementally**
   - Build after each major change
   - Test Pioneer integration tests
   - Test vault with device

3. **Document as you go**
   - Note any issues encountered
   - Update this guide with improvements

---

## File Reference Quick List

### Pioneer Platform
```
modules/pioneer/pioneer-caip/src/data.ts
modules/pioneer/pioneer-coins/src/paths.ts
modules/pioneer/pioneer-nodes/src/seeds.ts
modules/pioneer/pioneer-discovery/src/generatedAssetData.json
modules/pioneer/pioneer-types/src/pioneer.ts ⚠️ CRITICAL
modules/pioneer/pioneer-sdk/src/getPubkey.ts
modules/pioneer/pioneer-sdk/src/supportedCaips.ts
modules/pioneer/pioneer-sdk/src/fees/index.ts
modules/pioneer/pioneer-balance/src/index.ts
modules/coins/utxo/utxo-network/src/index.ts
modules/intergrations/markets/src/index.ts
services/pioneer-server/src/config/utxo-networks.config.ts
services/pioneer-server/src/controllers/broadcast.controller.ts
services/pioneer-server/src/controllers/utxo.controller.ts
e2e/wallets/intergration-coins/src/index.ts
```

### KeepKey Vault
```
package.json
src/utils/keepkeyAddress.ts
src/components/swap/Swap.tsx
src/components/ui/AssetIcon.tsx (optional)
```

---

## Deployment Workflow

1. **Pioneer Platform**
   ```bash
   cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer
   make build
   make publish
   # Note version numbers
   ```

2. **KeepKey Vault**
   ```bash
   cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault
   bun update @pioneer-platform/pioneer-caip \
              @pioneer-platform/pioneer-coins \
              @pioneer-platform/pioneer-discovery \
              @pioneer-platform/pioneer-sdk \
              @pioneer-platform/pioneer-types
   # Update code files
   bun run build
   # Test with device
   git commit -m "feat: add ZCash support"
   # Deploy to staging/production
   ```

---

## UTXO Coin Reference

| Coin | SLIP44 | NetworkId | Address Prefix |
|------|--------|-----------|----------------|
| Bitcoin | 0 | `bip122:000000000019d6689c085ae165831e93` | 1, 3, bc1 |
| Litecoin | 2 | `bip122:12a765e31ffd4059bada1e25190f6e98` | L, M, ltc1 |
| Dogecoin | 3 | `bip122:00000000001a91e3dace36e2be3bf030` | D, A |
| Dash | 5 | `bip122:000007d91d1254d60e2dd1ae58038307` | X, 7 |
| DigiByte | 20 | `bip122:4da631f2ac1bed857bd968c67c913978` | D, S, dgb1 |
| Zcash | 133 | `bip122:00040fe8ec8471911baa1db1266ea15d` | t1, t3 |
| Bitcoin Cash | 145 | `bip122:000000000000000000651ef99cb9fcbe` | q, p |

---

## Support Resources

- **SLIP44 Registry**: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
- **CAIP Standards**: https://github.com/ChainAgnostic/CAIPs
- **Pioneer Docs**: `/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/docs/coin-addition/coin-addition-guide.md`
- **Blockbook API**: https://github.com/trezor/blockbook
- **NowNodes**: https://nownodes.io/ (Blockbook provider)

---

## Next Coins to Add

Priority coins for KeepKey support:

- [ ] Ravencoin (RVN)
- [ ] Vertcoin (VTC)
- [ ] Qtum (QTUM)
- [ ] Peercoin (PPC)
- [ ] Namecoin (NMC)
- [ ] Monacoin (MONA)

Each requires similar steps following this guide.
