# Swap Double Execution & Stuck Signing Bug - Critical Audit Report

## Executive Summary

Two critical bugs identified that could cause users to:
1. **Double-swap** funds (executing the same swap twice)
2. **Get stuck in "signing" state** after successful broadcast

## Bug #1: Multiple useEffect Executions (Risk of Double Swap)

### Location
`src/components/swap/Swap.tsx:1615-2399`

### Root Cause
The `useEffect` has 4 dependencies that change during the swap flow:
```typescript
}, [pendingSwap, vaultVerified, hasViewedOnDevice, isExecutingSwap]);
```

### Execution Flow (From Logs)
1. **First trigger**: User clicks "Execute Swap"
   - `pendingSwap: true, vaultVerified: false, hasViewedOnDevice: false, isExecutingSwap: true`
   - useEffect runs → starts device verification

2. **Second trigger**: Device verification completes
   - `hasViewedOnDevice` changes from `false` → `true`
   - useEffect runs AGAIN → waits for user confirmation

3. **Third trigger**: User clicks "Proceed with Swap"
   - `vaultVerified` changes from `false` → `true`
   - useEffect runs AGAIN → EXECUTES THE SWAP

### Why This is Dangerous

While there's a guard at line 2040:
```typescript
if (vaultVerified && typeof app.swap === 'function') {
  // Execute swap...
}
```

**Problems:**
1. The guard prevents execution on triggers #1 and #2, BUT the entire `performSwap()` async function still runs
2. If `vaultVerified` changes rapidly (double-click, race condition), the swap block could execute twice
3. The `isExecutingSwap` flag is:
   - IN the dependency array (line 2399)
   - SET inside the useEffect (line 1574, 2275, 2386)
   - This creates a circular dependency risk

### Evidence from Logs
```
⚡ useEffect triggered! {pendingSwap: true, vaultVerified: false, hasViewedOnDevice: false, isExecutingSwap: true}
⚡ useEffect triggered! {pendingSwap: true, vaultVerified: false, hasViewedOnDevice: true, isExecutingSwap: true}
⚡ useEffect triggered! {pendingSwap: true, vaultVerified: true, hasViewedOnDevice: true, isExecutingSwap: true}
```

Each trigger runs the ENTIRE `performSwap()` function, not just the parts that need to run.

---

## Bug #2: Transaction Stuck in "Signing" State

### Location
`src/components/swap/PendingSwapsPopup.tsx:346-428`
`src/components/swap/Swap.tsx:2287-2314`

### Root Cause
Race condition between:
1. Creating temporary "signing" swap entry
2. Clearing signing swaps on broadcast
3. Async fetch of real pending swap from database

### Execution Flow

#### Step 1: User Approves Swap (Swap.tsx:1597)
```typescript
window.dispatchEvent(new CustomEvent('swap:signing', {
  detail: signingData
}));
```

#### Step 2: PendingSwapsPopup Creates Temp Entry (PendingSwapsPopup.tsx:348-377)
```typescript
const tempSwap: PendingSwap = {
  txHash: `signing-${Date.now()}`, // ← Temporary ID like "signing-1768462256029"
  status: 'signing',
  // ...
};
setSigningSwaps([tempSwap]);
```

#### Step 3: Swap Broadcasts Successfully (Swap.tsx:2308-2314)
```typescript
window.dispatchEvent(new CustomEvent('swap:broadcast', {
  detail: swapData  // Contains real txid
}));
router.push('/');  // ← IMMEDIATELY navigates away
```

#### Step 4: PendingSwapsPopup Receives Broadcast (PendingSwapsPopup.tsx:392-407)
```typescript
const handleSwapBroadcast = (event: CustomEvent) => {
  setSigningSwaps([]);  // ← Clears temp entry
  setTimeout(() => {
    refreshPendingSwaps();  // ← Fetches real swap after 1s delay
  }, 1000);
};
```

### The Gap Problem

Between steps 3-4, there's a **1+ second gap** where:
- Temp "signing" swap is cleared
- Real pending swap isn't fetched yet
- Component state shows `signingSwaps = []`
- BUT the UI might still render the old signing swap

### Evidence from Logs
```
🔄 Reopening SwapProgress for swap: signing-1768462256029
⏭️ Skipping - swap is still signing (no txid yet)
```

The signing swap persists in the UI because:
1. `swap:broadcast` event fires
2. `setSigningSwaps([])` clears the array
3. Component re-renders
4. User clicks on the swap card
5. `handleSwapClick` sees `status === 'signing'` and returns early (line 426-429)
6. Real swap isn't available yet from the 1-second delayed fetch

---

## Bug #3: Premature Navigation

### Location
`src/components/swap/Swap.tsx:2314`

### Issue
```typescript
// Dispatch event
window.dispatchEvent(new CustomEvent('swap:broadcast', {
  detail: swapData
}));

// IMMEDIATELY navigate away
router.push('/');  // ← Component unmounts before listeners fully process
```

### Risk
1. Event dispatched
2. Router navigates immediately
3. Swap component unmounts
4. Event listeners may not have time to process
5. Global state update could be dropped

---

## Critical Fixes Required

### Fix #1: Remove Circular Dependencies from useEffect

**Problem**: useEffect depends on `isExecutingSwap` which it also modifies

**Solution**: Remove `isExecutingSwap` from dependency array OR use a ref instead

```typescript
// Option A: Use ref for execution guard
const isExecutingRef = useRef(false);

const executeSwap = () => {
  if (isExecutingRef.current) {
    console.log('⏭️ Swap already in progress');
    return;
  }
  isExecutingRef.current = true;
  // ... rest of logic
};

// Option B: Remove from dependency array (current guard at line 1563 is sufficient)
}, [pendingSwap, vaultVerified, hasViewedOnDevice]); // Remove isExecutingSwap
```

### Fix #2: Prevent Multiple useEffect Runs

**Current Problem**: useEffect runs 3 times for one swap

**Solution**: Add early returns at the TOP of useEffect, not inside performSwap()

```typescript
useEffect(() => {
  console.log('⚡ useEffect triggered!', { pendingSwap, vaultVerified, hasViewedOnDevice });

  // GUARD #1: Not in swap flow
  if (!pendingSwap) return;

  // GUARD #2: Already executed (use ref, not state)
  if (hasExecutedSwap.current) {
    console.log('⏭️ Swap already executed');
    return;
  }

  // GUARD #3: Still waiting for verification states
  if (!hasViewedOnDevice || !vaultVerified) {
    console.log('⏳ Waiting for user verification...');
    return; // Don't run performSwap at all
  }

  // ONLY run performSwap once when ALL conditions are met
  hasExecutedSwap.current = true;
  performSwap();

}, [pendingSwap, vaultVerified, hasViewedOnDevice]);
```

### Fix #3: Transition Signing Swap to Real Swap Properly

**Problem**: 1-second gap where neither signing nor real swap is shown

**Solution**: Keep signing swap visible until real swap is confirmed

```typescript
const handleSwapBroadcast = (event: CustomEvent) => {
  console.log('🎯 New swap broadcast detected:', event.detail);

  const broadcastData = event.detail;

  // DON'T clear signing swaps yet - update them with real txid
  setSigningSwaps(prev => prev.map(swap => ({
    ...swap,
    txHash: broadcastData.txHash,  // Update with real txid
    status: 'pending',              // Change status
  })));

  // Refresh pending swaps to get server data
  refreshPendingSwaps().then(() => {
    // NOW clear signing swaps after real data is fetched
    setSigningSwaps([]);
  });
};
```

### Fix #4: Delay Navigation Until Event Processing

**Problem**: Router navigates before event is processed

**Solution**: Delay navigation slightly

```typescript
// Dispatch event
window.dispatchEvent(new CustomEvent('swap:broadcast', {
  detail: swapData
}));

// Allow event listeners to process before navigation
setTimeout(() => {
  console.log('✅ Swap broadcasted - navigating to dashboard');
  router.push('/');
}, 100); // Small delay ensures event is processed
```

---

## Testing Checklist

### Test Case 1: Normal Swap Flow
- [ ] Execute swap with Base → ETH
- [ ] Verify device verification shows
- [ ] Click "Proceed with Swap"
- [ ] Confirm on device
- [ ] **VERIFY**: Swap executes EXACTLY ONCE (check blockchain)
- [ ] **VERIFY**: Popup shows signing state immediately
- [ ] **VERIFY**: Popup transitions to pending state after broadcast
- [ ] **VERIFY**: Can click on swap card to reopen progress dialog

### Test Case 2: Rapid Button Clicks
- [ ] Set up swap
- [ ] Click "Proceed with Swap" button MULTIPLE TIMES rapidly
- [ ] **VERIFY**: Only ONE transaction is broadcast (check logs and blockchain)

### Test Case 3: State Transitions
- [ ] Monitor console logs during entire swap flow
- [ ] **VERIFY**: useEffect only runs swap execution ONCE (not 3 times)
- [ ] **VERIFY**: No "useEffect triggered" logs after vaultVerified=true

### Test Case 4: Navigation Timing
- [ ] Execute swap
- [ ] **VERIFY**: swap:broadcast event is logged in PendingSwapsPopup
- [ ] **VERIFY**: Navigation happens AFTER event is received
- [ ] **VERIFY**: Popup updates correctly on dashboard

---

## Severity Assessment

**Critical Priority**: MUST FIX BEFORE PRODUCTION

**Risk Level**:
- **Double execution**: HIGH - Could cause users to lose funds
- **Stuck signing**: MEDIUM - Confusing UX, but funds are safe

**User Impact**:
- Financial loss from double swaps
- Confusion and lost trust from stuck UI states
- Support burden from users reporting "broken" swaps

---

## Recommended Implementation Order

1. **FIRST**: Fix useEffect circular dependency (Fix #1)
2. **SECOND**: Prevent multiple useEffect runs (Fix #2)
3. **THIRD**: Fix signing state transition (Fix #3)
4. **FOURTH**: Delay navigation (Fix #4)
5. **FIFTH**: Comprehensive testing with all test cases

---

## Additional Observations

### Positive Aspects
- Good defensive coding with execution guards
- Comprehensive logging for debugging
- Proper error handling in most places

### Areas for Improvement
- useEffect with multiple changing dependencies is anti-pattern
- Consider state machine for swap flow (signing → broadcasting → pending → completed)
- Separate verification flow from execution flow into different useEffects
- Use refs for execution guards instead of state

---

## Code References

All issues found in:
- `src/components/swap/Swap.tsx` (lines 1560-2399)
- `src/components/swap/PendingSwapsPopup.tsx` (lines 346-428)

Key problem areas:
- Swap.tsx:1563 - Execution guard check
- Swap.tsx:1615 - useEffect with circular dependencies
- Swap.tsx:2040 - Vault verification guard
- Swap.tsx:2275-2276 - State reset after swap
- Swap.tsx:2308-2314 - Event dispatch and navigation
- Swap.tsx:2399 - Dependency array
- PendingSwapsPopup.tsx:395-407 - Broadcast handler with gap
- PendingSwapsPopup.tsx:426-429 - Signing state skip logic
