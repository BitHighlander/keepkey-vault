# KeepKey Vault Scripts

Utility scripts for maintaining and configuring the KeepKey Vault application.

## THORChain Pool Management

### `fetch-thorchain-pools.js`

Fetches all active liquidity pools from the THORChain Midgard API and generates a TypeScript configuration file with CAIP-formatted asset identifiers.

**Usage:**
```bash
node scripts/fetch-thorchain-pools.js
```

**Output:**
- Generates: `src/config/thorchain-pools.ts`
- Contains all active THORChain pools with CAIP identifiers
- Includes helper functions for pool lookup by symbol, asset notation, or CAIP

**When to run:**
- After THORChain adds new liquidity pools
- Periodically to ensure pool list is up-to-date
- When CAIP mappings are updated

**Example output:**
```
✅ Fetched 45 total pools
✅ Found 40 active pools
✅ Successfully transformed 35 pools
⚠️  Skipped 5 pools (no CAIP mapping)

📊 Pools by chain:
   AVAX: 4 total (1 native, 3 tokens)
   BTC: 1 total (1 native, 0 tokens)
   ETH: 17 total (1 native, 16 tokens)
   ...
```

## Adding Support for New Chains

To add support for a new chain (e.g., BASE, TRON, XRP):

1. **Add CAIP-2 network ID mapping** in `fetch-thorchain-pools.js`:
   ```javascript
   const CHAIN_TO_NETWORK_ID = {
     'BASE': 'eip155:8453',  // Add BASE network
     // ...
   };
   ```

2. **Add SLIP-44 coin type**:
   ```javascript
   const CHAIN_TO_SLIP44 = {
     'BASE': '60',  // EVM chains use 60
     // ...
   };
   ```

3. **Add chain metadata**:
   ```javascript
   const CHAIN_METADATA = {
     'BASE': {
       name: 'Base',
       icon: 'https://pioneers.dev/coins/base.png'
     },
     // ...
   };
   ```

4. **Re-run the script**:
   ```bash
   node scripts/fetch-thorchain-pools.js
   ```

## Maintenance Notes

### Hardcoded TXID (Development Mode)

The `.env` file contains a `NEXT_PUBLIC_DEV_FAKE_SWAP_TXID` variable used for development testing:

- **Purpose**: Bypasses actual blockchain transactions during development
- **Location**: Used in `src/components/swap/Swap.tsx:1055`
- **Safety**: Only active when explicitly set in environment variables
- **Logs**: Clearly marked as "DEVELOPMENT MODE" in console

**To disable:**
```bash
# Comment out or remove from .env
# NEXT_PUBLIC_DEV_FAKE_SWAP_TXID=0x...
```

### Pool Configuration Updates

The swap component now uses dynamically generated pool lists instead of hardcoded arrays:

**Before:**
```typescript
// Hardcoded list of 11 native assets
const NATIVE_ASSETS = [ ... ];
```

**After:**
```typescript
// Dynamic list from THORChain Midgard API (35+ pools)
import { THORCHAIN_POOLS } from '@/config/thorchain-pools';
const SUPPORTED_SWAP_ASSETS = THORCHAIN_POOLS;
```

### CAIP Format Reference

CAIP (Chain Agnostic Improvement Proposal) identifiers follow this format:

- **Bitcoin chains**: `bip122:<genesis_hash>/slip44:<coin_type>`
  - Example: `bip122:000000000019d6689c085ae165831e93/slip44:0` (BTC)

- **EVM chains**: `eip155:<chain_id>/slip44:<coin_type>` (native) or `eip155:<chain_id>/erc20:<contract>` (tokens)
  - Example: `eip155:1/slip44:60` (ETH native)
  - Example: `eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7` (USDT token)

- **Cosmos chains**: `cosmos:<chain_id>/slip44:<coin_type>`
  - Example: `cosmos:cosmoshub-4/slip44:118` (ATOM)
  - Example: `cosmos:thorchain-mainnet-v1/slip44:931` (RUNE)

**References:**
- CAIP-2 (Chain IDs): https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md
- SLIP-44 (Coin Types): https://github.com/satoshilabs/slips/blob/master/slip-0044.md

## Troubleshooting

### Script fails with "Failed to fetch pools"

**Check:**
1. Internet connection
2. THORChain Midgard API status: https://midgard.ninerealms.com/v2/pools
3. Firewall/proxy settings

### Pools are skipped during transformation

**Reason:** Missing CAIP mapping for the chain

**Solution:** Add chain support (see "Adding Support for New Chains" above)

### Generated config has TypeScript errors

**Check:**
1. Run `npx tsc --noEmit` to verify
2. Ensure `src/config/` directory exists
3. Verify CAIP format consistency

## Future Enhancements

- [ ] Add support for BASE chain (eip155:8453)
- [ ] Add support for TRON chain (tron:<network>)
- [ ] Add support for XRP chain (ripple:<network>)
- [ ] Automatic pool refresh on schedule
- [ ] Integration with CI/CD for automated updates
- [ ] Pool liquidity depth filtering
- [ ] Multi-protocol support (Maya Protocol, etc.)
