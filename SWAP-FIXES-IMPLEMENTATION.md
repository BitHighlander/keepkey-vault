# Swap Component Fixes: Implementation Guide

Ready-to-apply code changes for the swap component audit findings.

---

## 🎯 Fix 1: Remove API Call from MAX Button (HIGH PRIORITY)

**Impact**: MAX button will respond instantly instead of waiting 1-2 seconds for API call
**Lines**: 1122-1130

### Step 1: Add Gas Estimate Helper Function

**Location**: Add after `calculateLocalQuote` function (~line 310)

```typescript
/**
 * Get estimated network fee for common chains
 * Used for MAX button to avoid API call for gas estimation
 * These are conservative estimates - actual fees determined by API during execution
 */
const getEstimatedNetworkFee = (symbol: string): number => {
  const gasEstimates: Record<string, number> = {
    // UTXO Chains (actual fees vary by network congestion)
    'BTC': 0.0001,   // ~$9.50 @ $95k
    'BCH': 0.0001,   // ~$0.04 @ $400
    'DOGE': 1.0,     // ~$0.35 @ $0.35
    'LTC': 0.001,    // ~$0.12 @ $120
    'DASH': 0.0001,  // ~$0.04 @ $40

    // EVM Chains (gas + priority fee)
    'ETH': 0.003,    // ~$10 @ $3300 (base + priority)
    'BNB': 0.003,    // ~$1.80 @ $600
    'AVAX': 0.01,    // ~$0.45 @ $45
    'MATIC': 0.1,    // ~$0.10 @ $1

    // ERC20 tokens (use ETH gas)
    'USDT': 0.003,   // Same as ETH
    'USDC': 0.003,
  };

  return gasEstimates[symbol] || 0.001; // Default 0.001 for unknown
};
```

### Step 2: Replace MAX Button Logic

**Location**: Lines 1122-1130 in `handleMaxClick()`

**BEFORE**:
```typescript
// Get quote to determine actual gas fees needed
console.log('🔍 Getting quote to calculate gas fees...');
const testQuote = await getSwapQuote(app, {
  caipIn: app.assetContext.caip,
  caipOut: app.outboundAssetContext.caip,
  amount: targetAmount.toString(),
  slippagePercentage: 3,
  isMax: false,
});

// Parse network gas fees from quote
const networkFee = testQuote.quote?.fees?.network ? parseFloat(testQuote.quote.fees.network) : 0;
console.log(`⛽ Network gas fee: ${networkFee} ${app.assetContext.symbol}`);
```

**AFTER**:
```typescript
// Use estimated network fee to avoid API call
// Actual fee will be determined by API quote during swap execution
const networkFee = getEstimatedNetworkFee(app.assetContext.symbol);
console.log(`⛽ Estimated network gas fee: ${networkFee} ${app.assetContext.symbol} (estimated)`);
```

**Result**: Removes lines 1123-1130, replaces with 2 lines.

---

## 🎯 Fix 2: Add Slippage to Local Quote Calculation (MEDIUM PRIORITY)

**Impact**: Local quotes will be ~0.5-2% more accurate, matching THORChain reality
**Lines**: 283-304

### Replace calculateLocalQuote Implementation

**Location**: Lines 283-304 in `calculateLocalQuote` function

**BEFORE**:
```typescript
// Step 1: Input Asset → RUNE (constant product formula)
// runeOut = (amountIn * runeDepthIn) / (assetDepthIn + amountIn)
const runeOut = (inputAmount * runeDepthIn) / (assetDepthIn + inputAmount);

// Step 2: RUNE → Output Asset (constant product formula)
// assetOut = (runeIn * assetDepthOut) / (runeDepthOut + runeIn)
const assetOut = (runeOut * assetDepthOut) / (runeDepthOut + runeOut);

// Calculate exchange rate
const rate = assetOut / inputAmount;

console.log('[Swap] Local quote calculation:', {
  input: inputAmount,
  runeIntermediate: runeOut,
  output: assetOut,
  rate
});

return {
  amountOut: assetOut.toFixed(8),
  exchangeRate: rate
};
```

**AFTER**:
```typescript
// Step 1: Input Asset → RUNE (constant product formula)
const runeOut = (inputAmount * runeDepthIn) / (assetDepthIn + inputAmount);

// Apply slip fee for first leg (slip = x / (x + X))
const slip1 = inputAmount / (assetDepthIn + inputAmount);
const runeAfterSlip1 = runeOut * (1 - slip1);

// Step 2: RUNE → Output Asset (constant product formula)
const assetOutBeforeSlip = (runeAfterSlip1 * assetDepthOut) / (runeDepthOut + runeAfterSlip1);

// Apply slip fee for second leg
const slip2 = runeAfterSlip1 / (runeDepthOut + runeAfterSlip1);
const assetOut = assetOutBeforeSlip * (1 - slip2);

// Calculate exchange rate (using final output after slippage)
const rate = assetOut / inputAmount;

// Calculate total slippage percentage
const totalSlipBps = ((slip1 + slip2) * 10000).toFixed(0); // basis points

console.log('[Swap] Local quote calculation:', {
  input: inputAmount,
  runeIntermediate: runeOut,
  runeAfterSlip: runeAfterSlip1,
  outputBeforeSlip: assetOutBeforeSlip,
  outputAfterSlip: assetOut,
  slip1Percent: (slip1 * 100).toFixed(3) + '%',
  slip2Percent: (slip2 * 100).toFixed(3) + '%',
  totalSlipBps: totalSlipBps + ' bps',
  rate
});

// Warn if slippage is high (>100 bps = 1%)
if (parseFloat(totalSlipBps) > 100) {
  console.warn(`[Swap] ⚠️ High slippage: ${totalSlipBps} bps (${((slip1 + slip2) * 100).toFixed(2)}%)`);
}

return {
  amountOut: assetOut.toFixed(8),
  exchangeRate: rate
};
```

---

## 🎯 Fix 3: Add Pool Liquidity Warnings (LOW PRIORITY)

**Impact**: Users get warned about high-slippage trades
**Lines**: Add before return in `calculateLocalQuote` (~line 301)

### Add Warning Check

**Location**: After calculating `assetOut`, before `return` statement

```typescript
// Check if trade is large relative to pool depth
const tradePercentageIn = (inputAmount / assetDepthIn) * 100;
const tradePercentageOut = (assetOut / assetDepthOut) * 100;
const maxTradePercentage = Math.max(tradePercentageIn, tradePercentageOut);

let warning: string | undefined;

if (maxTradePercentage > 10) {
  warning = `Very large trade (${maxTradePercentage.toFixed(1)}% of pool). Expect high slippage.`;
  console.warn(`[Swap] 🚨 ${warning}`);
} else if (maxTradePercentage > 5) {
  warning = `Large trade (${maxTradePercentage.toFixed(1)}% of pool). Consider splitting into smaller swaps.`;
  console.warn(`[Swap] ⚠️ ${warning}`);
} else if (maxTradePercentage > 1) {
  console.log(`[Swap] ℹ️ Trade is ${maxTradePercentage.toFixed(2)}% of pool depth`);
}

return {
  amountOut: assetOut.toFixed(8),
  exchangeRate: rate,
  warning // Add warning to return type
};
```

### Update Return Type

**Location**: Line 256

**BEFORE**:
```typescript
): { amountOut: string; exchangeRate: number } | null => {
```

**AFTER**:
```typescript
): { amountOut: string; exchangeRate: number; warning?: string } | null => {
```

### Display Warning in UI

**Location**: Lines 936-970 where local quote is set

**Add After Setting Quote**:
```typescript
if (localQuote.warning) {
  console.warn('[Swap] Quote warning:', localQuote.warning);
  // Optionally show warning to user (could add to error state or new warning state)
  // setWarning(localQuote.warning); // If you add a warning state
}
```

---

## 🎯 Fix 4: Refresh Pool Data Periodically (OPTIONAL)

**Impact**: Pool data stays fresh during long user sessions
**Lines**: 312-362

### Add Interval to useEffect

**Location**: Replace entire `useEffect` at lines 312-362

**BEFORE**:
```typescript
useEffect(() => {
  async function loadMarketData() {
    // ... existing code ...
  }

  loadMarketData();
}, [app?.pioneer]); // Re-run when Pioneer SDK is available
```

**AFTER**:
```typescript
useEffect(() => {
  let interval: NodeJS.Timeout | null = null;

  async function loadMarketData() {
    if (!app?.pioneer?.GetMarkets) {
      console.log('[Swap] Pioneer SDK GetMarkets not ready yet, waiting...');
      return;
    }

    try {
      setIsLoadingMarkets(true);
      setMarketsError('');

      console.log('[Swap] Loading market pool data from Pioneer SDK...');

      const response = await app.pioneer.GetMarkets();
      console.log('[Swap] GetMarkets raw response:', JSON.stringify(response, null, 2));

      const pools = response?.data?.data?.pools;

      if (!pools) {
        console.error('[Swap] Could not find pools at path response.data.data.pools');
        throw new Error('Invalid response structure from GetMarkets');
      }

      if (!Array.isArray(pools) || pools.length === 0) {
        throw new Error('No pools returned from GetMarkets');
      }

      setMarketPools(pools);
      console.log(`[Swap] ✅ Loaded ${pools.length} market pools from Pioneer SDK`);
      console.log('[Swap] Sample pool:', pools[0]);

    } catch (error) {
      console.error('[Swap] ❌ Failed to load market data:', error);
      setMarketsError(error instanceof Error ? error.message : 'Failed to load market data');
      setMarketPools([]);
    } finally {
      setIsLoadingMarkets(false);
    }
  }

  // Initial load
  loadMarketData();

  // Refresh pool data every 60 seconds to keep quotes accurate
  interval = setInterval(() => {
    console.log('[Swap] 🔄 Refreshing market pool data...');
    loadMarketData();
  }, 60000);

  // Cleanup on unmount
  return () => {
    if (interval) {
      clearInterval(interval);
    }
  };
}, [app?.pioneer]);
```

---

## 📋 Testing Steps

### After Applying Fix 1 (MAX Button)

1. **Reload the app**
2. **Select BTC → ETH**
3. **Click MAX button**
4. **Check console**:
   - Should see: `⛽ Estimated network gas fee: 0.0001 BTC (estimated)`
   - Should NOT see: `🔍 Getting quote to calculate gas fees...`
5. **Verify**:
   - Amount appears instantly (no 1-2s delay)
   - Balance is adjusted for gas fee
   - Quote uses local calculation

### After Applying Fix 2 (Slippage)

1. **Enter small amount**: 0.001 BTC → ETH
2. **Check console logs**:
   - Should see: `slip1Percent`, `slip2Percent`, `totalSlipBps`
3. **Compare with API quote** (click Swap to get API quote):
   - Local quote should be within 1-2% of API quote
4. **Try large amount**: 0.1 BTC (>1% of pool)
   - Should see higher slippage percentages

### After Applying Fix 3 (Warnings)

1. **Enter very large amount**: Try to swap 1 BTC (if you have it)
2. **Check console**:
   - Should see warning: `🚨 Very large trade (X% of pool)`
3. **Verify warning appears** (if you added UI display)

### After Applying Fix 4 (Refresh)

1. **Load swap page**
2. **Wait 60 seconds**
3. **Check console**:
   - Should see: `🔄 Refreshing market pool data...`
   - Should see: `✅ Loaded 9 market pools from Pioneer SDK`
4. **Verify**: Quotes remain accurate over time

---

## 🚀 Deployment Checklist

- [ ] Apply Fix 1 (MAX button) - REQUIRED
- [ ] Test MAX button performance
- [ ] Apply Fix 2 (slippage) - RECOMMENDED
- [ ] Verify quote accuracy vs API
- [ ] Apply Fix 3 (warnings) - OPTIONAL
- [ ] Test with large trades
- [ ] Apply Fix 4 (refresh) - OPTIONAL
- [ ] Monitor for any errors
- [ ] Update CHANGELOG.md with changes
- [ ] Commit changes with message: `fix(swap): optimize MAX button and improve local quote accuracy`

---

## 📊 Expected Results

### Performance Improvements
- MAX button: 1-2s → 50-100ms (95% faster)
- No change to initial quote speed (already fast)
- No change to execution speed (API still required)

### Accuracy Improvements
- Local quotes: Within 0.5-1% of API quotes (was 1-2%)
- Slippage warnings for large trades
- Fresh pool data throughout session

### User Experience
- Instant MAX button response
- More accurate quote estimates
- Warnings prevent high-slippage surprises
- Consistent quote accuracy over time

---

## 🔍 Rollback Plan

If issues occur:

### Rollback Fix 1 (MAX Button)
```bash
git diff HEAD -- src/components/swap/Swap.tsx > fix1.patch
git checkout HEAD -- src/components/swap/Swap.tsx
# Or manually restore lines 1122-1130 to call API
```

### Rollback Fix 2 (Slippage)
```bash
# Restore original calculation without slip fees
# Lines 283-304 back to simple formula
```

### Rollback Fix 3-4
```bash
# Remove added code
# Restart app
```

All fixes are independent and can be rolled back individually.
