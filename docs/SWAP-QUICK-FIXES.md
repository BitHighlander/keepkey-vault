# Swap Component Quick Fixes

Apply these fixes to resolve the "BTC not found" issue immediately.

## 🎯 Most Likely Issue: USD Value Filter

The $0.01 filter is probably removing BTC if the price data isn't loaded yet.

### Quick Fix 1: Always Show Assets with Balance > 0

**File**: `src/components/swap/Swap.tsx`
**Line**: ~555

```typescript
// BEFORE
.filter((asset: any) => {
  if (!asset) return false;
  const passesFilter = asset.balanceUsd > 0.01;
  if (!passesFilter) {
    console.log(`❌ [SWAP] Filtered out ${asset.symbol} on ${asset.caip}: USD value ${asset.balanceUsd} below $0.01 threshold`);
  }
  return passesFilter;
})

// AFTER
.filter((asset: any) => {
  if (!asset) return false;

  // Show assets with any balance > 0, regardless of USD value
  const passesFilter = asset.balance > 0;

  if (!passesFilter) {
    console.log(`❌ [SWAP] Filtered out ${asset.symbol}: zero balance`);
  } else if (asset.balanceUsd <= 0.01) {
    console.warn(`⚠️  [SWAP] ${asset.symbol} has balance but low/missing USD value: $${asset.balanceUsd}`);
  }

  return passesFilter;
})
```

**Why this works**: Removes dependency on price data being loaded. Shows assets as long as they have a balance.

## 🔍 Alternative Fix: Debug First, Then Decide

Add these 3 debug blocks to identify the exact issue:

### Debug Block 1: After GetAvailableAssets
**Line**: ~227

```typescript
console.log(`[Swap] Loaded ${assets.length} swap assets from Pioneer SDK`);

// ADD THIS:
console.log('🔍 [DEBUG-1] Supported CAIPs:', assets.map(a => `${a.symbol}:${a.caip}`));
const btcAsset = assets.find(a => a.symbol === 'BTC');
console.log('🔍 [DEBUG-1] BTC from API:', btcAsset);
```

### Debug Block 2: Inside availableAssets useMemo
**Line**: ~488

```typescript
console.log('🔍 [SWAP] Supported swap assets:', supportedSwapAssets.map(a => a.symbol));

// ADD THIS:
const btcBalance = app.balances.find(b => (b.ticker || b.symbol) === 'BTC');
const btcSupported = supportedSwapAssets.find(a => a.symbol === 'BTC');

console.log('🔍 [DEBUG-2] BTC Matching:', {
  fromBalance: btcBalance ? {
    caip: btcBalance.caip,
    balance: btcBalance.balance,
    priceUsd: btcBalance.priceUsd,
    valueUsd: btcBalance.valueUsd
  } : '❌ Not found in balances',
  fromSupported: btcSupported ? {
    caip: btcSupported.caip,
    symbol: btcSupported.symbol
  } : '❌ Not found in supported assets',
  caipsMatch: btcBalance?.caip === btcSupported?.caip ? '✅ YES' : '❌ NO'
});
```

### Debug Block 3: Before Filter
**Line**: ~553 (right before .filter)

```typescript
// ADD THIS BEFORE .filter():
console.log('🔍 [DEBUG-3] Assets before filter:', app.balances.map((b: any) => ({
  symbol: b.ticker || b.symbol,
  caip: b.caip,
  balance: b.balance,
  priceUsd: b.priceUsd,
  valueUsd: b.valueUsd,
  matched: supportedSwapAssets.find(a => a.caip === b.caip) ? '✅' : '❌'
})));

.filter((asset: any) => {
  // ... existing filter code
```

## 🧪 Test the Fixes

### 1. Apply Quick Fix 1
- Remove USD value check
- Reload app
- Check if BTC appears

### 2. OR Add Debug Blocks First
- Add all 3 debug blocks
- Reload app
- Check console output:
  - Does `[DEBUG-1]` show BTC in supported assets?
  - Does `[DEBUG-2]` show CAIP match?
  - Does `[DEBUG-3]` show BTC before filter with matched='✅'?

### 3. Based on Debug Output

**If DEBUG-1 shows no BTC**:
- GetAvailableAssets failed or returned wrong data
- Check Pioneer server is running on port 9001
- Run: `node projects/pioneer/modules/pioneer/pioneer-client/__tests__/test-markets.cjs`

**If DEBUG-2 shows CAIP mismatch**:
- Apply CAIP normalization fix (see SWAP-DEBUG-SUMMARY.md, Fix 2)

**If DEBUG-3 shows matched='❌'**:
- supportedSwapAssets loaded after balances
- Add loading order fix (ensure GetAvailableAssets completes first)

**If DEBUG-3 shows BTC with low valueUsd**:
- Apply Quick Fix 1 (remove USD filter)

## ✅ Verification

After applying fix:

```bash
# 1. Check console for these logs:
✅ [SWAP] Final sorted assets (by CAIP, not aggregated): [...]
✅ [SWAP] Asset count: X  # Should include BTC

# 2. Check SwapInput component shows:
- BTC balance (not "0")
- USD value (not "undefined")

# 3. Try entering an amount:
- Should show USD value
- Should fetch quote
- Should enable swap button
```

## 🚨 If Still Not Working

Run this in browser console to diagnose:

```javascript
// Check Pioneer SDK
console.log('Pioneer SDK:', window.pioneer || app?.pioneer);
console.log('GetAvailableAssets:', typeof app?.pioneer?.GetAvailableAssets);
console.log('GetMarkets:', typeof app?.pioneer?.GetMarkets);

// Check balances
console.log('Balances:', app?.balances);
const btc = app?.balances?.find(b => (b.ticker || b.symbol) === 'BTC');
console.log('BTC Balance:', btc);

// Check supported assets
console.log('Supported Swap Assets:', supportedSwapAssets);
const btcSupported = supportedSwapAssets?.find(a => a.symbol === 'BTC');
console.log('BTC Supported:', btcSupported);

// Check available assets
console.log('Available Assets:', availableAssets);
const btcAvailable = availableAssets?.find(a => a.symbol === 'BTC');
console.log('BTC Available:', btcAvailable);
```

## 📞 Need Help?

If issue persists, share console output with:
- `[DEBUG-1]` logs
- `[DEBUG-2]` logs
- `[DEBUG-3]` logs
- Browser console diagnostics output

This will show exactly where the data flow breaks.
