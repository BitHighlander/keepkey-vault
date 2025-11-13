# Swap Component React Render Fix

## Problem
The swap component was not re-rendering when `app.setOutboundAssetContext()` was called. The UI would only update when clicking on other elements, indicating a React state management issue.

## Root Cause
The Pioneer context provider (`src/components/providers/pioneer.tsx`) was tracking `assetContext` as React state, but **not** tracking `outboundAssetContext`. When `app.setOutboundAssetContext()` was called:

1. It updated the underlying SDK state
2. But did NOT trigger React to re-render components
3. The component would only re-render when something else caused a React update (clicking, etc.)

## Solution
Added React state tracking for `outboundAssetContext` in the Pioneer provider:

### Changes Made

1. **Added React state for outboundAssetContext** (line 63)
   ```typescript
   const [outboundAssetContext, setOutboundAssetContext] = useState<AssetContextState | null>(null);
   ```

2. **Created wrapped setter function** (lines 81-90)
   ```typescript
   const wrappedSetOutboundAssetContext = useCallback((assetData: AssetContextState) => {
       console.log('🔄 [React State] Setting outbound asset context:', assetData);
       setOutboundAssetContext(assetData); // Updates React state -> triggers re-render
       if (pioneer?.state?.app?.setOutboundAssetContext) {
           return pioneer.state.app.setOutboundAssetContext(assetData);
       }
       return Promise.resolve();
   }, [pioneer]);
   ```

3. **Included in wrapped app object** (lines 93-101)
   ```typescript
   const wrappedApp = useMemo(() => {
       return pioneer?.state?.app ? {
           ...pioneer.state.app,
           assetContext,
           outboundAssetContext,  // React state value
           setAssetContext: wrappedSetAssetContext,
           setOutboundAssetContext: wrappedSetOutboundAssetContext,  // Wrapped setter
       } : null;
   }, [pioneer?.state?.app, assetContext, outboundAssetContext, ...]);
   ```

4. **Added clear method** (lines 110-113)
   ```typescript
   const clearOutboundAssetContextCallback = useCallback(() => {
       console.log('🔄 Clearing outbound asset context');
       setOutboundAssetContext(null);
   }, []);
   ```

## How It Works Now

### Before (Broken)
```
User selects output asset
  ↓
app.setOutboundAssetContext() called
  ↓
SDK state updated ✓
React state NOT updated ✗
  ↓
No re-render
  ↓
UI stays stale until something else triggers render
```

### After (Fixed)
```
User selects output asset
  ↓
app.setOutboundAssetContext() called (wrapped version)
  ↓
SDK state updated ✓
React state updated ✓ (setOutboundAssetContext)
  ↓
Context value changes
  ↓
All consuming components re-render immediately
  ↓
UI updates instantly ✨
```

## Benefits

1. **Immediate UI updates** - No more clicking needed to see changes
2. **Consistent with assetContext** - Both contexts now work the same way
3. **Backward compatible** - Returns Promises for existing `.then()/.catch()` code
4. **Optimized** - Uses `useMemo` and `useCallback` to prevent unnecessary re-renders

## Testing
To verify the fix:
1. Navigate to swap page
2. Select an asset for output (to asset)
3. UI should update immediately without needing to click anything else

## Files Modified
- `/Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault/src/components/providers/pioneer.tsx`

## Related Components
The fix benefits all components that read `app.outboundAssetContext`:
- `Swap.tsx` - Main swap component
- `SwapConfirm.tsx` - Confirmation view
- `SwapSuccess.tsx` - Success screen
- `Asset.tsx` - Asset detail view

