# Confetti Disabled - Temporary Fix

## Issue
Confetti was showing repeatedly on already completed swaps, creating a confusing UX.

## Root Cause
Multiple components were triggering confetti when detecting completed swaps:
1. **PendingSwapsPopup.tsx** - Triggered on every detection of completed swap status
2. **SwapProgress.tsx** - Triggered on swap completion events

The triggers were firing multiple times due to:
- Component re-renders
- Event listeners firing multiple times
- State updates causing useEffect re-runs
- Reopening dialogs for already completed swaps

## Changes Made

### 1. PendingSwapsPopup.tsx (lines 296-314, 461-471)

**Before:**
```typescript
// Trigger confetti
setShowConfetti(true);
setTimeout(() => setShowConfetti(false), 5000);
```

**After:**
```typescript
// Confetti disabled - was triggering on already completed swaps
// setShowConfetti(true);
// setTimeout(() => setShowConfetti(false), 5000);
```

Also commented out the Confetti component render:
```tsx
{/* Confetti Effect - Disabled temporarily to prevent repeated triggers */}
{/* {showConfetti && (
  <Confetti ... />
)} */}
```

### 2. SwapProgress.tsx (lines 342-344, 507-535)

**Before:**
```typescript
setShowConfetti(true);
setTimeout(() => setShowConfetti(false), 5000);
```

**After:**
```typescript
// Confetti disabled - was triggering repeatedly on already completed swaps
// setShowConfetti(true);
// setTimeout(() => setShowConfetti(false), 5000);
```

Also commented out the Confetti component render:
```tsx
{/* Confetti - Disabled temporarily to prevent repeated triggers */}
{/* {showConfetti && isComplete && (
  <Confetti ... />
)} */}
```

## Files Not Modified

These files also have confetti but weren't causing the repeated trigger issue:
- `Send.tsx` - Only shows confetti on new send success (not the issue)
- `SwapSuccess.tsx` - Standalone success page (not repeatedly triggered)
- `SuccessView.tsx` - Standalone view (not the issue)

## Future Fix

To properly re-enable confetti without repeated triggers:

### Option 1: Use a "confetti shown" flag in localStorage
```typescript
const confettiKey = `confetti-shown-${swap.txHash}`;
if (!localStorage.getItem(confettiKey)) {
  setShowConfetti(true);
  localStorage.setItem(confettiKey, Date.now().toString());
  setTimeout(() => setShowConfetti(false), 5000);
}
```

### Option 2: Track confetti state per swap with better cleanup
```typescript
const [confettiShown, setConfettiShown] = useState<Set<string>>(new Set());

useEffect(() => {
  pendingSwaps.forEach(swap => {
    if (swap.status === 'completed' &&
        !completedSwaps.has(swap.txHash) &&
        !confettiShown.has(swap.txHash)) {

      setConfettiShown(prev => new Set(prev).add(swap.txHash));
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  });
}, [pendingSwaps, completedSwaps, confettiShown]);
```

### Option 3: Only trigger confetti on the initial completion event
Track when the swap first transitions to 'completed' status, not every time the component renders with a completed swap.

```typescript
const prevStatusRef = useRef<Map<string, string>>(new Map());

useEffect(() => {
  pendingSwaps.forEach(swap => {
    const prevStatus = prevStatusRef.current.get(swap.txHash);

    // Only trigger if status CHANGED to completed
    if (swap.status === 'completed' && prevStatus !== 'completed') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }

    prevStatusRef.current.set(swap.txHash, swap.status);
  });
}, [pendingSwaps]);
```

## Testing Checklist

After re-enabling confetti:
- [ ] Complete a new swap - confetti should show ONCE
- [ ] Reopen the swap progress dialog - confetti should NOT show again
- [ ] Close and reopen the pending swaps popup - confetti should NOT show again
- [ ] Refresh the page with a completed swap in history - confetti should NOT show
- [ ] Complete multiple swaps in sequence - each should show confetti exactly once

## Status

**Current**: Confetti disabled globally in swap components
**Next**: Implement proper confetti tracking to prevent repeated triggers
**Priority**: Low (cosmetic issue, not affecting functionality)
