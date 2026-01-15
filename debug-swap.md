# Swap Component Debugging Guide

## Current Issues

### 1. BTC Not Found in availableAssets
- **Error**: `getUserBalance: No asset found for CAIP bip122:000000000019d6689c085ae165831e93/slip44:0`
- **Impact**: User can't see their BTC balance in the swap interface
- **Location**: Swap.tsx:437

### 2. USD Value Shows as Undefined
- **Error**: Input render shows `BTC = $undefined` despite price being `$94926.1`
- **Impact**: User can't see the USD value of their swap amount
- **Location**: Swap.tsx:3031

## Data Flow Diagram

```
Pioneer Server
    ↓
/swap/available-assets → supportedSwapAssets (ThorchainPool[])
    ↓
app.balances + supportedSwapAssets → availableAssets (filtered by CAIP match)
    ↓
availableAssets → getUserBalance(caip)
    ↓
SwapInput component → renders balance and USD value
```

## Debugging Checklist

### Step 1: Verify Swap Assets Loading
Open browser console and check for:
```
[Swap] Loaded X swap assets from Pioneer SDK
```

Expected: X should be >= 8 (BTC, ETH, BCH, DOGE, LTC, DASH, USDT, etc.)

**Add this debug code** at line 227 (after setSupportedSwapAssets):
```typescript
console.log('🔍 [DEBUG] Supported swap assets:', assets.map(a => ({
  symbol: a.symbol,
  caip: a.caip,
  asset: a.asset
})));
```

### Step 2: Verify Balance Processing
Check for log at line 487:
```
🔍 [SWAP] Processing balances: X total balances
```

**Add this debug code** at line 488 (inside availableAssets useMemo):
```typescript
console.log('🔍 [DEBUG] Matching balances:');
app.balances.forEach((balance: any) => {
  const match = supportedSwapAssets.find(asset => asset.caip === balance.caip);
  console.log(`  ${balance.symbol || balance.ticker} (${balance.caip}):`,
    match ? `✅ Found (${match.symbol})` : '❌ No match');
});
```

### Step 3: Verify CAIP Matching
**The critical check**: Do the CAIPs match EXACTLY?

From Pioneer Server (`/swap/available-assets`):
```json
{
  "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0",
  "symbol": "BTC",
  "asset": "BTC.BTC"
}
```

From app.balances:
```json
{
  "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0",  // Must match exactly!
  "symbol": "BTC",
  "balance": "0.001",
  "priceUsd": "94926.1"
}
```

## Common Issues

### Issue A: CAIP Case Sensitivity
- Check if CAIPs have different casing (e.g., `SLIP44` vs `slip44`)
- Check for extra slashes or spaces

### Issue B: supportedSwapAssets Empty
If `supportedSwapAssets.length === 0`:
1. Check if Pioneer server is running on `http://localhost:9001`
2. Check if `/api/v1/swap/available-assets` endpoint returns data
3. Check Pioneer SDK `GetAvailableAssets()` method exists

**Test endpoint manually:**
```bash
curl http://localhost:9001/api/v1/swap/available-assets
```

Expected response:
```json
{
  "success": true,
  "data": {
    "assets": [
      {
        "asset": "BTC.BTC",
        "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0",
        "symbol": "BTC",
        "name": "Bitcoin",
        ...
      }
    ],
    "total": 8
  }
}
```

### Issue C: Balance Data Structure
Check if app.balances has the expected structure:
```typescript
// Add at line 487
console.log('🔍 [DEBUG] First balance structure:', app.balances[0]);
```

Expected:
```json
{
  "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0",
  "ticker": "BTC",
  "symbol": "BTC",
  "balance": "0.001",
  "priceUsd": "94926.1",
  "valueUsd": "94.92",
  "icon": "https://..."
}
```

## Quick Fixes

### Fix 1: Add CAIP Normalization
If CAIPs don't match due to formatting, normalize them:

```typescript
// Add helper function at top of file
const normalizeCAIP = (caip: string): string => {
  return caip?.toLowerCase().trim() || '';
};

// Update line 434 to use normalized CAIPs
const asset = availableAssets.find((x: any) =>
  normalizeCAIP(x.caip) === normalizeCAIP(caip)
);
```

### Fix 2: Add Fallback Symbol Matching
If CAIP matching fails, fallback to symbol:

```typescript
// Update line 434
const asset = availableAssets.find((x: any) => x.caip === caip) ||
              availableAssets.find((x: any) => x.symbol === app?.assetContext?.symbol);
```

### Fix 3: Debug Asset Context USD Calculation
The issue might be in how USD value is calculated. Check line 451:

```typescript
// Add debug logging
const getAssetUsdValue = (amount: string, balance: any) => {
  try {
    const price = parseFloat(balance?.priceUsd || '0');
    const qty = parseFloat(amount || '0');
    const result = price * qty;
    console.log(`💰 [DEBUG] USD calc: ${qty} × $${price} = $${result}`);
    return result;
  } catch (e) {
    console.error('❌ [DEBUG] USD calc failed:', e);
    return 0;
  }
};
```

## Testing Checklist

After implementing fixes:

- [ ] BTC shows in availableAssets (check console log)
- [ ] getUserBalance returns correct balance for BTC
- [ ] Input amount shows USD value (not undefined)
- [ ] Swap quote calculates correctly
- [ ] All UTXO chains work (BTC, BCH, DOGE, LTC, DASH)
- [ ] EVM chains work (ETH, USDT)

## Next Steps

1. Add debug logs from Step 1-3 above
2. Reload the app and capture console output
3. Compare CAIPs from server vs balances
4. Apply appropriate fix based on findings
5. Test with real device connected
