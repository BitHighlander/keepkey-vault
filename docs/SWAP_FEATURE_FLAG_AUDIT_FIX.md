# Swap Feature Flag Audit & Fix

## Issue
The swap feature was not properly respecting feature flags throughout the application. Users could access swap functionality even when the feature was disabled via the `enableSwaps` flag.

## Root Cause Analysis
The feature flag check was only implemented in the Asset component's swap button visibility, but not in:
1. Navigation to swap views via URL parameters
2. Chat system's `navigateToSwap` function
3. Dashboard's pending swaps badge navigation
4. Direct rendering of the Swap component

## Files Modified

### 1. `/src/app/asset/[caip]/page.tsx`
**Changes:**
- Added `isFeatureEnabled` import from `@/config/features`
- Added feature flag check in URL parameter handler (line 215-218)
- Added feature flag check in `onSwapClick` handler (line 297-301)
- Added feature flag check before rendering Swap component (line 315)

**Impact:** Prevents navigation to swap view via URL parameters or button clicks when feature is disabled.

### 2. `/src/lib/chat/functions.ts`
**Changes:**
- Added feature flag check at the beginning of `navigateToSwap` function (line 342-348)
- Returns early with user-friendly message if swaps are disabled

**Impact:** Chat assistant will inform users that swaps are disabled rather than attempting navigation.

### 3. `/src/components/dashboard/Dashboard.tsx`
**Changes:**
- Added `isFeatureEnabled` import from `@/config/features` (line 35)
- Added feature flag check for pending swaps badge visibility (line 669)
- Badge now only shows when both conditions are true:
  - Feature is enabled
  - There are pending swaps

**Impact:** Pending swaps badge doesn't appear on dashboard when feature is disabled.

## Feature Flag Configuration

The swap feature is controlled by:
- **Environment Variable**: `NEXT_PUBLIC_ENABLE_SWAPS=true`
- **LocalStorage Override**: `feature_enable_swaps=true`

LocalStorage takes precedence over environment variable for runtime configuration.

## Testing Checklist

### When Feature is DISABLED
- [ ] Swap button is hidden on asset pages ✓
- [ ] URL parameter `?view=swap` is ignored ✓
- [ ] Chat command "I want to swap X" returns disabled message ✓
- [ ] Pending swaps badge doesn't show on dashboard ✓
- [ ] Direct navigation to swap view is blocked ✓

### When Feature is ENABLED
- [ ] Swap button appears on supported assets ✓
- [ ] URL parameter `?view=swap` works correctly ✓
- [ ] Chat commands navigate to swap page ✓
- [ ] Pending swaps badge shows active swaps ✓
- [ ] All swap functionality works normally ✓

## Code Quality
- ✅ No linter errors
- ✅ Type-safe implementations
- ✅ Consistent feature flag checking pattern
- ✅ User-friendly error messages
- ✅ Console warnings for debugging

## Benefits

1. **Centralized Control**: Single feature flag controls all swap access points
2. **Security**: Prevents unauthorized access to swap features
3. **User Experience**: Clear messaging when feature is disabled
4. **Development**: Easy toggling for testing and deployment
5. **Maintainability**: Consistent pattern for feature gating

## Usage

### Enable Swaps
```bash
# Via environment variable
export NEXT_PUBLIC_ENABLE_SWAPS=true

# Via LocalStorage (in browser console)
localStorage.setItem('feature_enable_swaps', 'true')
```

### Disable Swaps
```bash
# Via environment variable
export NEXT_PUBLIC_ENABLE_SWAPS=false

# Via LocalStorage (in browser console)
localStorage.setItem('feature_enable_swaps', 'false')
```

### Check Current Status
```javascript
// In browser console
import { isFeatureEnabled } from '@/config/features'
console.log('Swaps enabled:', isFeatureEnabled('enableSwaps'))
```

## Implementation Notes

1. **Order of Checks**: LocalStorage override > Environment variable > Default (false)
2. **SSR Compatibility**: Feature flag checks are client-side safe
3. **Performance**: Minimal overhead, checks are synchronous
4. **Backwards Compatible**: Existing code continues to work when feature is enabled

## Related Files

- `/src/config/features.ts` - Feature flag configuration
- `/src/components/asset/Asset.tsx` - Already had feature flag check (unchanged)
- `/src/hooks/usePendingSwaps.ts` - Fetches pending swaps (unchanged)
- `/src/components/swap/Swap.tsx` - Main swap component (unchanged)

## Future Considerations

1. **Admin UI**: Add settings page toggle for enabling/disabling swaps
2. **User Permissions**: Role-based swap access control
3. **Feature Graduation**: Remove flag when swap feature is fully stable
4. **Analytics**: Track feature flag usage and swap adoption

## Commit Message
```
fix: enforce swap feature flag across all entry points

- Add feature flag checks to navigation handlers
- Block URL parameter navigation when swaps disabled
- Gate chat system swap navigation
- Hide dashboard pending swaps badge when disabled
- Consistent user messaging across all access points

Fixes issue where swaps could be accessed despite feature flag
```

