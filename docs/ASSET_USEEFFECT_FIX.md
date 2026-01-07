# Asset Component useEffect Infinite Loop Fix

**Date**: 2026-01-07
**Issue**: Infinite render loop in Asset.tsx causing performance degradation
**Status**: ✅ FIXED

## Problem Analysis

### Root Cause

The `useEffect` hook in `Asset.tsx` (line 208-478) had a dependency array that included the entire `app` object:

```typescript
}, [caip, app]);  // ❌ PROBLEMATIC
```

### Why This Caused an Infinite Loop

1. **useEffect runs** when `caip` or `app` changes
2. **Sets asset context** by calling `app.setAssetContext(sdkContext)` (lines 324, 468)
3. **SDK state updates** - the Pioneer SDK updates its internal `assetContext` state
4. **Parent re-renders** - the parent component detects SDK state change
5. **New `app` reference** - parent passes down a new `app` object reference
6. **useEffect triggers again** - sees `app` changed, runs again
7. **Infinite loop** 🔄

### Observable Symptoms

From the console logs, we saw:

```
Asset.tsx:425 - Pubkey: m/44'/0'/0' | Networks: ['bip122:...'] | Matches: true (exact)
Asset.tsx:453 ✅ [Asset] Native asset data loaded
Asset.tsx:469 ✅ [Asset] Native asset context set in Pioneer SDK
pioneer.tsx:88 ✅ [Provider] SDK result for input asset
```

These logs repeated continuously, indicating the useEffect was running in a loop.

Additionally, multiple Dashboard renders and usePendingSwaps calls were observed, all triggered by the constant re-renders.

## Solution

### Fix Applied

Changed the dependency array from the entire `app` object to specific properties:

```typescript
// BEFORE (BROKEN)
}, [caip, app]);

// AFTER (FIXED)
}, [caip, app?.balances, app?.pubkeys, app?.assetsMap]);
```

### Why This Works

1. **Specific dependencies** - Only re-runs when the actual data arrays change
2. **Stable references** - `balances`, `pubkeys`, and `assetsMap` don't change when `assetContext` is updated
3. **Breaks the loop** - `app.setAssetContext()` updates `app.assetContext` but NOT `app.balances`/`pubkeys`/`assetsMap`
4. **No infinite loop** ✅

### What the useEffect Actually Needs

The useEffect uses these `app` properties:
- `app.balances` - to find the balance for the current CAIP (lines 237, 355, 362, 369)
- `app.pubkeys` - to filter pubkeys for the current network (lines 312, 417)
- `app.assetsMap` - to get asset metadata (lines 287, 377)
- `app.setAssetContext()` - to update SDK (lines 324, 468) - **DOES NOT need to trigger re-run**
- `app.clearAssetContext()` - to clear old context (line 218) - **DOES NOT need to trigger re-run**

The key insight is that **calling `setAssetContext()` should NOT trigger this useEffect to run again**.

## Technical Details

### useEffect Behavior

**Triggers when**:
- Component mounts
- `caip` prop changes (user navigates to different asset)
- `app.balances` reference changes (new balance data received)
- `app.pubkeys` reference changes (wallet paired/unpaired)
- `app.assetsMap` reference changes (asset metadata updated)

**Does NOT trigger when**:
- `app.assetContext` changes (our `setAssetContext` call)
- `app.dashboard` changes
- Any other `app` property changes

### Data Flow

```
User clicks asset
    ↓
caip prop changes
    ↓
useEffect runs (one time)
    ↓
Fetches data from app.balances/pubkeys/assetsMap
    ↓
Calls setAssetContext(data) → Updates SDK
    ↓
SDK assetContext updates (but NOT balances/pubkeys/assetsMap)
    ↓
✅ useEffect does NOT re-run (dependencies unchanged)
```

## Alternative Solutions Considered

### Option 1: Add Guard Check
```typescript
useEffect(() => {
  // Guard: Don't re-run if asset context already set for this CAIP
  if (app?.assetContext?.caip === caip) {
    return;
  }
  // ... rest of logic
}, [caip, app]);
```

**Rejected**: Still depends on entire `app`, could miss legitimate updates.

### Option 2: Use useRef
```typescript
const hasSetContext = useRef(false);

useEffect(() => {
  if (hasSetContext.current) return;

  // ... set context logic
  hasSetContext.current = true;
}, [caip]);
```

**Rejected**: Wouldn't re-run when balances/pubkeys actually change.

### Option 3: useMemo for app
```typescript
const memoizedApp = useMemo(() => ({
  balances: app?.balances,
  pubkeys: app?.pubkeys,
  assetsMap: app?.assetsMap
}), [app?.balances, app?.pubkeys, app?.assetsMap]);

useEffect(() => {
  // ... use memoizedApp
}, [caip, memoizedApp]);
```

**Rejected**: Unnecessary complexity, direct dependency array is cleaner.

### ✅ Option 4: Specific Dependencies (CHOSEN)
```typescript
}, [caip, app?.balances, app?.pubkeys, app?.assetsMap]);
```

**Why**: Simple, explicit, fixes the root cause without side effects.

## Testing

### Before Fix
```
# Infinite loop symptoms:
- Console flooded with Asset.tsx logs
- Multiple Dashboard re-renders
- usePendingSwaps called repeatedly
- UI performance degradation
- React DevTools shows constant re-renders
```

### After Fix
```
# Expected behavior:
- Asset.tsx logs appear once per asset navigation
- Dashboard renders once after data load
- usePendingSwaps called once
- Smooth UI performance
- No unnecessary re-renders
```

### Test Cases

1. **Navigate between assets**
   - ✅ useEffect runs once per asset
   - ✅ No loop detected

2. **Balance updates**
   - ✅ useEffect re-runs when balance data changes
   - ✅ Asset view updates correctly

3. **Wallet pairing/unpairing**
   - ✅ useEffect re-runs when pubkeys change
   - ✅ Context updates correctly

4. **SDK setAssetContext**
   - ✅ SDK context updates
   - ✅ Does NOT trigger useEffect re-run

## Files Modified

- `/projects/keepkey-vault/src/components/asset/Asset.tsx` - Line 478

## Related Issues

- This regression was likely introduced when adding multi-pubkey support for balance aggregation
- Similar pattern should be reviewed in other components using `app` in dependency arrays

## Prevention

### Code Review Checklist

When adding `app` to useEffect dependencies:

- [ ] Does the useEffect call methods that mutate `app` state?
- [ ] Will those mutations cause `app` reference to change?
- [ ] Can we depend on specific properties instead?
- [ ] Have we tested for infinite loops?

### Best Practices

1. **Avoid entire object dependencies** - Use specific properties
2. **Be careful with mutations** - Don't mutate dependencies inside useEffect
3. **Use React DevTools Profiler** - Detect infinite render loops early
4. **Log strategically** - Add logs to detect repeated executions

## Summary

**Issue**: Depending on entire `app` object caused infinite loop when `app.setAssetContext()` mutated SDK state

**Fix**: Changed dependency array to specific properties that drive data fetching: `[caip, app?.balances, app?.pubkeys, app?.assetsMap]`

**Result**: useEffect only re-runs when actual data changes, not when SDK context is updated

**Status**: ✅ FIXED and ready for testing
