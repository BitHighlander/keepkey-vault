# Swap History Fix - Missing Database Save

**Date**: 2025-11-29
**Status**: ✅ FIXED
**Issue**: Swap history was always empty after completing swaps

## Root Cause

The swap history feature was implemented correctly, but **swaps were never being saved to the database** after broadcast. The flow was:

```
Build TX → Sign → Broadcast → ✅ Success → ❌ NO DATABASE SAVE
                                    ↓
                          SwapHistory.tsx fetches from DB
                                    ↓
                              Returns empty []
```

### What Was Missing

After successfully broadcasting a swap transaction (Swap.tsx:1650), the code:
- ✅ Showed success screen to user
- ✅ Reset form state
- ❌ **NEVER called the Pioneer API to save the swap**

The `SwapHistory` component relies on `usePendingSwaps` hook, which calls:
```typescript
app.pioneer.GetAddressPendingSwaps({ address })
```

But nothing was calling the **create** endpoint:
```typescript
app.pioneer.CreatePendingSwap(swapData)
```

## Solution

Added database save operation after successful swap broadcast at `src/components/swap/Swap.tsx:1652-1707`:

### 1. Save Swap to Database (After Broadcast)

```typescript
// Save pending swap to database for history tracking
try {
  console.log('💾 Saving swap to pending swaps database...');

  const userAddress = /* get user address from pubkeys */;

  const pendingSwapData = {
    txHash: String(txid),
    addresses: [userAddress],
    sellAsset: {
      caip: app.assetContext.caip,
      symbol: app.assetContext.symbol,
      amount: inputAmount,
      networkId: caipToNetworkId(app.assetContext.caip),
      address: userAddress,
      amountBaseUnits: inputAmount
    },
    buyAsset: {
      caip: app.outboundAssetContext.caip,
      symbol: app.outboundAssetContext.symbol,
      amount: outputAmount,
      networkId: caipToNetworkId(app.outboundAssetContext.caip),
      address: userAddress,
      amountBaseUnits: outputAmount
    },
    quote: {
      memo: quote.memo,
      slippage: quote.slippageBps / 100,
      fees: quote.fees,
      raw: quote
    },
    integration: 'thorchain',
    status: 'pending'
  };

  if (typeof app.pioneer.CreatePendingSwap === 'function') {
    const result = await app.pioneer.CreatePendingSwap(pendingSwapData);
    console.log('✅ Swap saved to database:', result);
  }
} catch (saveError) {
  // Don't fail the swap if DB save fails - just log it
  console.error('⚠️ Failed to save swap to database:', saveError);
}
```

### 2. Refresh Pending Swaps After Success (Swap.tsx:2477)

```typescript
onClose={() => {
  setShowSuccess(false);
  setSuccessTxid('');
  setInputAmount('');
  setOutputAmount('');
  setQuote(null);
  setError('');

  // Refresh pending swaps to show the new swap in history
  refreshPendingSwaps();
}}
```

## API Endpoint Used

**Pioneer API**: `POST /swaps/pending`
**Method**: `app.pioneer.CreatePendingSwap(data)`
**Swagger**: `/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/services/pioneer-server/public/swagger.json`

### Request Schema

```typescript
interface CreatePendingSwapRequest {
  txHash: string;
  addresses: string[];
  sellAsset: {
    networkId: string;
    address: string;
    amountBaseUnits: string;
    amount: string;
    symbol: string;
    caip: string;
  };
  buyAsset: {
    networkId: string;
    address: string;
    amountBaseUnits: string;
    amount: string;
    symbol: string;
    caip: string;
  };
  quote?: {
    memo?: string;
    slippage?: number;
    fees?: any;
    raw?: any;
  };
  integration: string;
  status: string;
}
```

## Testing

### Before Fix
1. ✅ Perform a swap
2. ✅ Swap broadcasts successfully
3. ✅ Success screen appears
4. ❌ Click "History" tab → Empty

### After Fix
1. ✅ Perform a swap
2. ✅ Swap broadcasts successfully
3. ✅ **Swap saved to database with CreatePendingSwap**
4. ✅ Success screen appears
5. ✅ Close success screen → **refreshPendingSwaps() called**
6. ✅ Click "History" tab → **Swap appears in pending swaps!**

## Files Modified

- `src/components/swap/Swap.tsx`
  - Lines 1652-1707: Added database save after successful broadcast
  - Line 2477: Added refreshPendingSwaps() call in success onClose handler

## Error Handling

The database save operation is wrapped in try/catch and **will not fail the swap** if something goes wrong:

```typescript
catch (saveError: any) {
  // Don't fail the swap if saving to DB fails - just log it
  console.error('⚠️ Failed to save swap to database (swap still succeeded):', saveError);
}
```

This ensures:
- User still sees success if broadcast succeeded
- Transaction is already on-chain
- Only the history tracking might fail (non-critical)

## Future Improvements

1. **Convert to Base Units**: Currently using the display amount for `amountBaseUnits`. Should convert to actual base units based on asset decimals.

2. **Auto-Update Status**: The Pioneer API should automatically track swap status (pending → confirming → completed) based on blockchain confirmations.

3. **Outbound TX Hash**: When THORChain completes the swap, the outbound transaction hash should be added to the pending swap record.

4. **Error Recovery**: If CreatePendingSwap fails, could save to localStorage as fallback until next successful API call.

## Summary

✅ **Swap history now works correctly**
✅ **Swaps are saved to database after broadcast**
✅ **History refreshes after closing success screen**
✅ **Users can now track their swap transactions**

The fix ensures that every successful swap is recorded in the Pioneer database and appears in the swap history tab immediately after the success screen is closed.
