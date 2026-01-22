# Swap Component Debug Summary

## ✅ Fixed: Use Pioneer SDK Instead of Direct Fetch

### Change Made
**File**: `src/components/swap/Swap.tsx` (line 312-362)

**Before**:
```typescript
// Call endpoint directly (workaround for SDK not having GetMarkets yet)
const response = await fetch('http://localhost:9001/api/v1/swap/markets');
const data = await response.json();
const pools = data.data.pools;
```

**After**:
```typescript
// Use Pioneer SDK method instead of direct fetch
const response = await app.pioneer.GetMarkets();
const pools = response?.data?.data?.pools;
```

### Verification
Created test file: `projects/pioneer/modules/pioneer/pioneer-client/__tests__/test-markets.cjs`

**Test Results**:
- ✅ `GetAvailableAssets()` returns 13 assets
- ✅ `GetMarkets()` returns 9 pools with liquidity data
- ✅ CAIP mapping validated between assets and pools
- ✅ Pool math calculation verified (BTC/ETH rate)

**Run Test**:
```bash
cd projects/pioneer/modules/pioneer/pioneer-client
node __tests__/test-markets.cjs
```

## 🔍 Outstanding Issue: BTC Not Found in availableAssets

### Error Logs
```
getUserBalance: No asset found for CAIP bip122:000000000019d6689c085ae165831e93/slip44:0
{availableAssets: Array(5)}

[SWAP-DEBUG] 🔍 getAssetDisplay FROM: BTC price=$94926.1
[SWAP-DEBUG] 📊 Input render:  BTC = $undefined
```

### Root Cause Analysis

The issue occurs in the `availableAssets` computation (line 480-567):

```typescript
const availableAssets = useMemo(() => {
  // 1. Takes app.balances
  // 2. Matches against supportedSwapAssets by CAIP
  // 3. Filters out assets with balanceUsd <= 0.01
  // 4. Returns matched assets
}, [app?.balances, app?.assets, supportedSwapAssets]);
```

**Possible causes**:
1. **CAIP mismatch**: BTC's CAIP from balance doesn't match supportedSwapAssets
2. **USD value filter**: BTC filtered out due to `balanceUsd <= 0.01` threshold
3. **Missing supportedSwapAssets**: GetAvailableAssets not loading before balances
4. **Price data missing**: BTC balance has no priceUsd, causing USD calculation to fail

## 🛠️ Debugging Steps

### Step 1: Add Debug Logs After GetAvailableAssets

**Location**: Line 227 (after `setSupportedSwapAssets(assets)`)

```typescript
setSupportedSwapAssets(assets);
setSwapAssetsSource('api');

console.log(`[Swap] Loaded ${assets.length} swap assets from Pioneer SDK`);

// 🔍 DEBUG: Log all CAIPs to verify matching
console.log('🔍 [DEBUG] Supported swap assets CAIPs:', assets.map(a => ({
  symbol: a.symbol,
  caip: a.caip,
  thorchainAsset: a.asset
})));
```

### Step 2: Add Debug Logs in availableAssets useMemo

**Location**: Line 488 (inside useMemo, after initial logs)

```typescript
console.log('🔍 [SWAP] Supported swap assets:', supportedSwapAssets.map(a => a.symbol));

// 🔍 DEBUG: Check each balance against supported assets
console.log('🔍 [DEBUG] Matching balances:');
app.balances.forEach((balance: any) => {
  const exactMatch = supportedSwapAssets.find(asset => asset.caip === balance.caip);
  const symbolMatch = supportedSwapAssets.find(asset => asset.symbol === (balance.ticker || balance.symbol));

  console.log(`  ${balance.symbol || balance.ticker} (${balance.caip}):`, {
    balance: balance.balance,
    priceUsd: balance.priceUsd,
    valueUsd: balance.valueUsd,
    exactMatch: exactMatch ? `✅ ${exactMatch.symbol}` : '❌ None',
    symbolMatch: symbolMatch ? `✅ ${symbolMatch.symbol}` : '❌ None',
    willBeFiltered: parseFloat(balance.valueUsd || '0') <= 0.01 ? '⚠️  YES (< $0.01)' : '✅ NO'
  });
});
```

### Step 3: Check getUserBalance Function

**Location**: Line 418-449

Add at the beginning of the function:

```typescript
const getUserBalance = (caip: string | undefined): string => {
  if (!caip) {
    console.warn('getUserBalance: No CAIP provided');
    return '0';
  }

  // 🔍 DEBUG
  console.log(`🔍 [DEBUG] getUserBalance called for: ${caip}`);
  console.log(`🔍 [DEBUG] availableAssets count: ${availableAssets.length}`);
  console.log(`🔍 [DEBUG] availableAssets CAIPs:`, availableAssets.map(a => a.caip));

  // ... rest of function
};
```

## 🎯 Expected Output

After adding debug logs, reload the app and check console for:

### 1. Supported Assets Loaded
```
✅ [Swap] Loaded 13 swap assets from Pioneer SDK
🔍 [DEBUG] Supported swap assets CAIPs: [
  { symbol: 'BTC', caip: 'bip122:000000000019d6689c085ae165831e93/slip44:0', thorchainAsset: 'BTC.BTC' },
  { symbol: 'ETH', caip: 'eip155:1/slip44:60', thorchainAsset: 'ETH.ETH' },
  ...
]
```

### 2. Balance Matching
```
🔍 [DEBUG] Matching balances:
  BTC (bip122:000000000019d6689c085ae165831e93/slip44:0): {
    balance: '0.00123456',
    priceUsd: '94926.1',
    valueUsd: '117.20',
    exactMatch: '✅ BTC',
    symbolMatch: '✅ BTC',
    willBeFiltered: '✅ NO'
  }
```

### 3. getUserBalance Called
```
🔍 [DEBUG] getUserBalance called for: bip122:000000000019d6689c085ae165831e93/slip44:0
🔍 [DEBUG] availableAssets count: 5
🔍 [DEBUG] availableAssets CAIPs: [
  'eip155:1/slip44:60',
  'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7',
  ...
]
```

## 🔧 Potential Fixes

### Fix 1: Lower USD Filter Threshold

If BTC is being filtered due to low USD value:

**Location**: Line 555

```typescript
// Change from:
const passesFilter = asset.balanceUsd > 0.01;

// To:
const passesFilter = asset.balance > 0; // Always show if balance > 0
```

### Fix 2: Add CAIP Normalization

If CAIPs don't match due to case sensitivity or formatting:

**Location**: Top of file (after imports)

```typescript
// Add helper function
const normalizeCAIP = (caip: string): string => {
  if (!caip) return '';
  return caip.toLowerCase().trim();
};
```

**Location**: Line 501 (in availableAssets useMemo)

```typescript
// Change from:
let supportedAsset = supportedSwapAssets.find(asset => asset.caip === balance.caip);

// To:
let supportedAsset = supportedSwapAssets.find(asset =>
  normalizeCAIP(asset.caip) === normalizeCAIP(balance.caip)
);
```

### Fix 3: Add Fallback for Missing Price Data

If price data is missing from balances:

**Location**: Line 516 (in availableAssets useMemo)

```typescript
const balanceAmount = parseFloat(balance.balance || '0');
const valueUsd = parseFloat(balance.valueUsd || '0');
const priceUsd = parseFloat(balance.priceUsd || '0');

// 🔍 DEBUG: Log missing data
if (balanceAmount > 0 && valueUsd === 0 && priceUsd === 0) {
  console.warn(`⚠️  [SWAP] ${ticker} has balance but no price data:`, {
    balance: balanceAmount,
    priceUsd,
    valueUsd
  });
}
```

## 📋 Testing Checklist

After implementing fixes:

- [ ] BTC appears in availableAssets (check console log)
- [ ] getUserBalance returns correct balance for BTC CAIP
- [ ] SwapInput shows BTC balance (not "0")
- [ ] SwapInput shows USD value (not "undefined")
- [ ] Can enter input amount and see USD value update
- [ ] Quote fetches correctly
- [ ] All other assets (ETH, USDT, etc.) still work

## 🚀 Next Steps

1. **Add debug logs** from Step 1-3 above
2. **Reload the app** and capture console output
3. **Compare CAIPs** between supportedSwapAssets and app.balances
4. **Check USD values** - is BTC being filtered?
5. **Apply appropriate fix** based on findings
6. **Test with real KeepKey** connected
7. **Remove debug logs** after issue is resolved

## 📊 Data Flow Diagram

```
Pioneer Server
   ↓
GetAvailableAssets() → supportedSwapAssets (13 assets)
   ↓
app.balances + supportedSwapAssets → availableAssets (filtered by CAIP + USD)
   ↓
getUserBalance(caip) → looks up in availableAssets
   ↓
SwapInput component → displays balance and USD value
```

## 🔗 Related Files

- **Swap Component**: `src/components/swap/Swap.tsx`
- **Swap Config Controller**: `projects/pioneer/services/pioneer-server/src/controllers/swap-config.controller.ts`
- **Test File**: `projects/pioneer/modules/pioneer/pioneer-client/__tests__/test-markets.cjs`
- **Debug Guide**: `debug-swap.md`
