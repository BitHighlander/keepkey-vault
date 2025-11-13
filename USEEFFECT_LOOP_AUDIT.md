# useEffect Loop Audit - KeepKey Vault

**Date**: November 13, 2025  
**Severity**: CRITICAL  
**Impact**: Browser crashes, 40,000+ logs, ERR_INSUFFICIENT_RESOURCES

## The Problem

Multiple components depend on `app` object in useEffect:

```typescript
useEffect(() => {
  // ... fetch data using app.pioneer ...
}, [app]); // ❌ WRONG - app is a new object reference on every render
```

**Why this causes infinite loops:**
1. Component renders
2. useEffect runs, calls API
3. API response updates state
4. State update causes re-render
5. Pioneer context updates `app` object reference
6. useEffect sees `app` changed, runs again
7. GOTO step 3 (infinite loop)

## Files with Loop Bugs

Based on grep search for `}, [.*app[,]]`:
1. `components/asset/Asset.tsx`
2. `components/dashboard/Dashboard.tsx`
3. `components/swap/Swap.tsx`
4. `components/send/Send.tsx`
5. `components/chat/ChatPopup.tsx`
6. `hooks/useCustomTokens.ts` - ✅ FIXED
7. `hooks/usePathManager.ts`
8. `hooks/useFeeRates.ts`
9. `components/asset/DappStore.tsx` - ✅ FIXED
10. `components/pairing/MobilePairingDialog.tsx`
11. `app/page.tsx`

## The Fix

**Change from:**
```typescript
}, [app])
```

**To:**
```typescript
}, [app?.pioneer]) // Only depend on the stable pioneer client
```

**Or better - use refs:**
```typescript
const appRef = useRef(app);
useEffect(() => {
  appRef.current = app;
}, [app]);

useEffect(() => {
  // Use appRef.current instead
}, [networkId]); // Don't depend on app at all
```

## Impact of Not Fixing

- ✅ Browser crashes (ERR_INSUFFICIENT_RESOURCES)
- ✅ Thousands of API calls per second
- ✅ Database overwhelmed
- ✅ Poor user experience
- ✅ Cannot use application

## Status

**Fixed:**
- ✅ `hooks/useCustomTokens.ts`
- ✅ `components/asset/DappStore.tsx`  
- ✅ Removed pending swaps hook (was also broken)

**Still Broken:**
- ❌ 8+ other files need fixing

## Recommendation

**DO NOT ADD MORE useEffect CODE** until this systemic issue is fixed across the entire codebase.

**Alternative Patterns:**
1. Fetch on button click (user-triggered)
2. Use React Query / SWR (proper caching)
3. Server Components (Next.js 13+)
4. WebSocket subscriptions (one-time subscribe)

## Next Steps

1. Audit and fix ALL files with `}, [app])`
2. Implement ref-based pattern or remove app dependency
3. Test vault is stable with no loops
4. Document proper useEffect patterns for team

