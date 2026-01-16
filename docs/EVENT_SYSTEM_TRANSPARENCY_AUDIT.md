# Event System Transparency Audit

**Date**: 2026-01-07
**Status**: 🚨 CRITICAL - Complete breakdown in event flow transparency
**Issue**: Events flow perfectly through SDK but Vault receives NOTHING

---

## Executive Summary

Events are flowing correctly through the ENTIRE stack (Redis → Server → WebSocket → pioneer-events → SDK) but the Keepkey Vault application is completely silent. No logs, no toasts, no UI updates.

**Root Cause**: Unknown - multiple transparency gaps prevent diagnosis

---

## Verified Event Flow (WORKING)

### ✅ Phase 1: Redis → Pioneer Server
```
📨 [DEBUG] Message handler triggered! Channel: pioneer:test:blockbook:events
🔧 [DEBUG] Calling wsHandler.processRedisMessage...
[ | WebSocketHandler | handleTestEvent | ] 📨 Test event received: chain=BTC address=bc1q...
[ | WebSocketHandler | handleTestEvent | ] ✅ Notified user user:b50ce805 (socket TeFIfFtcJyzNUS5hAAAN)
✅ [DEBUG] processRedisMessage completed for channel: pioneer:test:blockbook:events
```

### ✅ Phase 2: WebSocket → pioneer-events
```
 | ws-client | init_events | 🔔 [PIONEER-EVENTS] Received transaction:incoming from server: {
  type: 'incoming',
  chain: 'BTC',
  address: 'bc1qg2ryu0wy9d3l8aylc82vgwgj4rlgdppxsfr082',
  txid: '9c4b892da24b4193f3ba9f149c151131e4e480085b025402fd5c9fe3827008e5',
  value: '1144',
  confirmations: 0,
  timestamp: 1767757998965
}
 | ws-client | init_events | 🔔 [PIONEER-EVENTS] Re-emitted as pioneer:tx to EventEmitter
```

### ✅ Phase 3: pioneer-events → Pioneer SDK
```
 | Pioneer-sdk | pioneer:tx | 🔔 Received transaction event: { ... }
 | Pioneer-sdk | pioneer:tx | 🔄 Refreshing balances for BTC (networkId: bip122:000000000019d6689c085ae165831e93)
 | Pioneer-sdk | pioneer:tx | ✅ Balances refreshed for BTC
```

### ❌ Phase 4: SDK → Vault (BROKEN)
```
[EXPECTED]
🔍 [PIONEER-TX-LISTENER] useEffect triggered: { ... }
✅ [PIONEER-TX-LISTENER] Subscribed to pioneer:tx events successfully!
[PioneerProvider] pioneer:tx event received: { ... }
[TransactionEventManager] Processing tx event: { ... }

[ACTUAL]
<complete silence - ZERO logs>
```

---

## Transparency Gaps Discovered

### Gap 1: No Logging at Context Creation
**File**: `keepkey-vault/src/app/provider.tsx:1094-1122`
**Expected**: Logs showing SDK.events property exists
**Actual**: NO LOGS - not even the diagnostic logs added in latest commit

```typescript
// ADDED DEBUG (commit: feb7e35) - BUT NOT LOGGING
logger.debug('🔍 [CONTEXT-VALUE] SDK events check:', {
  hasSDK: !!pioneerSdk,
  hasEvents: !!pioneerSdk?.events,
  eventsType: typeof pioneerSdk?.events,
  eventsConstructor: pioneerSdk?.events?.constructor?.name,
});
```

**Issue**: Cannot verify if `pioneerSdk.events` exists when contextValue is created

### Gap 2: No Logging at Component Mount
**File**: `keepkey-vault/src/components/providers/pioneer.tsx:195-212`
**Expected**: useEffect diagnostic logs on mount
**Actual**: NO LOGS - subscription never happens

```typescript
// ADDED DEBUG (commit: feb7e35) - BUT NOT LOGGING
useEffect(() => {
  console.log('🔍 [PIONEER-TX-LISTENER] useEffect triggered:', {
    hasPioneer: !!pioneer,
    hasState: !!pioneer?.state,
    hasApp: !!pioneer?.state?.app,
    hasEvents: !!pioneer?.state?.app?.events,
  });

  if (!pioneer?.state?.app?.events) {
    console.warn('⚠️ [PIONEER-TX-LISTENER] Cannot subscribe - missing!');
    return; // ← LIKELY HITTING THIS
  }

  pioneer.state.app.events.on('pioneer:tx', handleTransactionEvent);
  console.log('✅ [PIONEER-TX-LISTENER] Subscribed successfully!');
}, [pioneer?.state?.app?.events]);
```

**Issue**: Cannot verify:
- Is useEffect running at all?
- Is `pioneer.state.app.events` undefined?
- Is the early return being hit?

### Gap 3: No Console Output Verification
**Issue**: Cannot confirm if Vault's browser console is even working
**Test Needed**: Simple `console.log('VAULT LOADED')` at top of provider.tsx

### Gap 4: Event Listener Registration Status
**SDK Location**: `pioneer-sdk/src/index.ts:714`
**Issue**: SDK emits `this.events.emit('pioneer:tx', data)` but we cannot verify:
- Is `this.events` the same EventEmitter instance passed to Vault?
- Are there multiple SDK instances?
- Is the EventEmitter being garbage collected?

### Gap 5: No MCP or Observability Tools
**Issue**: No way to inspect:
- EventEmitter listener counts
- Component mount/unmount lifecycle
- React DevTools integration
- WebSocket connection status in browser

---

## Architecture Analysis

### Context Flow (provider.tsx → pioneer.tsx)

```typescript
// provider.tsx (lines 1103-1116)
const contextValue = {
  state: {
    status: 'connected',
    app: pioneerSdk,           // ← SDK instance with .events property
    api: pioneerSdk?.pioneer,
    balances: pioneerSdk?.balances || [],
    pubkeys: pioneerSdk?.pubkeys || [],
    dashboard: pioneerSdk?.dashboard,
  },
  dispatch: () => {},
};

// Passed to AppProvider
<AppProvider pioneer={contextValue}>
```

```typescript
// pioneer.tsx (lines 59-61)
export function AppProvider({ children, pioneer }: AppProviderProps) {
  // pioneer param = contextValue from above
  // pioneer.state.app = pioneerSdk
  // pioneer.state.app.events = pioneerSdk.events (EventEmitter)
}
```

### Event Listener Setup (pioneer.tsx)

```typescript
// Line 194-233
useEffect(() => {
  // CRITICAL CHECK: Does pioneer.state.app.events exist?
  if (!pioneer?.state?.app?.events) {
    return; // ← NO SUBSCRIPTION HAPPENS
  }

  // Register listener
  pioneer.state.app.events.on('pioneer:tx', handleTransactionEvent);
}, [pioneer?.state?.app?.events]);
```

### SDK EventEmitter Setup (pioneer-sdk/src/index.ts)

```typescript
// Line 252 (constructor)
this.events = new EventEmitter();

// Line 714 (clientEvents listener)
clientEvents.events.on('pioneer:tx', (data: any) => {
  this.events.emit('pioneer:tx', data); // ← Emitting to SDK's EventEmitter
});
```

**Critical Question**: Is `this.events` (SDK instance) the SAME object as `pioneer.state.app.events` (Vault context)?

---

## Hypotheses

### Hypothesis 1: EventEmitter Reference Mismatch
**Theory**: SDK's `this.events` is not the same object passed to Vault
**Evidence**: No logs = listener never registered = events object doesn't exist
**Test**: Add `console.log(pioneerSdk.events === pioneer.state.app.events)` comparison

### Hypothesis 2: Component Not Mounting
**Theory**: AppProvider/PioneerProvider not rendering due to error
**Evidence**: ZERO logs from either provider.tsx or pioneer.tsx
**Test**: Add `console.log('VAULT LOADED')` at top-level

### Hypothesis 3: Console Output Suppressed
**Theory**: Browser DevTools filtering or Next.js build stripping logs
**Evidence**: Even simple console.log not appearing
**Test**: Check browser console filters, try `alert()` instead

### Hypothesis 4: Multiple SDK Instances
**Theory**: Vault using different SDK instance than the one receiving events
**Evidence**: SDK logs show events, but Vault's SDK doesn't have listeners
**Test**: Add unique ID to SDK constructor, log on both sides

### Hypothesis 5: React StrictMode Double Mount
**Theory**: StrictMode causes mount/unmount/remount, breaking subscriptions
**Evidence**: useEffect cleanup may be unsubscribing immediately
**Test**: Check if running in StrictMode, disable temporarily

---

## Required Diagnostics (Priority Order)

### 1. Verify Console Works (CRITICAL)
```typescript
// Add at TOP of provider.tsx (before any React code)
console.log('========================================');
console.log('🚀 VAULT PROVIDER LOADED - CONSOLE WORKS');
console.log('========================================');
alert('VAULT LOADED - CHECK CONSOLE');
```

### 2. Verify SDK Events Property Exists
```typescript
// In provider.tsx contextValue creation
const sdkHasEvents = !!pioneerSdk?.events;
const sdkEventsType = typeof pioneerSdk?.events;
const sdkEventsListeners = pioneerSdk?.events?.listenerCount?.('pioneer:tx') ?? 'N/A';

console.log('🔍 SDK EVENTS CHECK:', {
  hasEvents: sdkHasEvents,
  type: sdkEventsType,
  listeners: sdkEventsListeners,
  constructor: pioneerSdk?.events?.constructor?.name,
});

if (!sdkHasEvents) {
  alert('CRITICAL: SDK.events is undefined!');
}
```

### 3. Verify Context Passing
```typescript
// In pioneer.tsx AppProvider function
console.log('🔍 PIONEER.TSX RECEIVED:', {
  hasPioneer: !!pioneer,
  hasState: !!pioneer?.state,
  hasApp: !!pioneer?.state?.app,
  hasAppEvents: !!pioneer?.state?.app?.events,
  appEventsType: typeof pioneer?.state?.app?.events,
});
```

### 4. Verify useEffect Execution
```typescript
// In pioneer.tsx useEffect
useEffect(() => {
  alert('useEffect RUNNING - check console');
  console.log('🔍 useEffect TRIGGERED');

  // ... rest of code
}, [pioneer?.state?.app?.events]);
```

### 5. Add EventEmitter Identity Check
```typescript
// In SDK constructor (pioneer-sdk/src/index.ts)
this.events = new EventEmitter();
this.events.__SDK_ID__ = `SDK-${Date.now()}-${Math.random()}`;
console.log('🆔 SDK EventEmitter Created:', this.events.__SDK_ID__);

// In vault context creation
console.log('🆔 Vault EventEmitter ID:', pioneerSdk?.events?.__SDK_ID__);
```

---

## E2E Test Verification

### Current Test (Working)
```bash
# Terminal 1: Pioneer server logs show complete flow
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer
node tests/push-events/push-btc-payment.js

# Output: ✅ Redis → Server → WebSocket → pioneer-events → SDK
```

### Vault Test (Broken)
```bash
# Terminal 2: Vault console shows NOTHING
# Browser console: <silence>
# Expected: Toast notification, transaction event logs
# Actual: Complete silence
```

---

## Next Steps

1. **Immediate**: Add `alert()` at top of provider.tsx to verify console
2. **Verify**: SDK.events exists at contextValue creation
3. **Verify**: pioneer.state.app.events exists in useEffect
4. **Verify**: EventEmitter instance identity matches
5. **Document**: Create EVENT_FLOW_DIAGRAM.md with complete architecture
6. **Fix**: Once gaps identified, implement proper event subscription

---

## Files Modified (Diagnostic Commits)

### Commit: feb7e35 (not yet committed)
- `keepkey-vault/src/app/provider.tsx:1094-1122` - Added SDK events diagnostics
- `keepkey-vault/src/components/providers/pioneer.tsx:195-212` - Added useEffect diagnostics

**Status**: Diagnostics NOT logging - indicates deeper issue

---

## Critical Questions

1. **Is Vault's browser console working?** → Unknown (no logs at all)
2. **Does SDK.events exist when passed to Vault?** → Unknown (no diagnostic logs)
3. **Is AppProvider/PioneerProvider mounting?** → Unknown (no mount logs)
4. **Are EventEmitter instances the same object?** → Unknown (no identity check)
5. **Is React StrictMode interfering?** → Unknown (no lifecycle logs)

---

## Comparison: E2E Test vs Vault

| Component | E2E Test (✅ Working) | Vault (❌ Silent) |
|-----------|---------------------|------------------|
| pioneer-events | Logs visible | N/A (package used by both) |
| Pioneer SDK | Logs visible | Logs visible |
| Event subscription | SDK logs show emission | NO subscription logs |
| Event handler | Balance refresh works | NO handler execution |
| Console output | Full logging | ZERO output |

**Key Insight**: The SAME SDK instance logs events in E2E test but Vault shows NO evidence of receiving them.

---

## Recommendation

**STOP** attempting to fix the event system until we have BASIC TRANSPARENCY:

1. Verify console.log works in Vault
2. Verify SDK.events property exists
3. Verify EventEmitter instance identity
4. Verify component mounting
5. Verify useEffect execution

**THEN** we can diagnose the actual event subscription issue.

Without these diagnostics, we are debugging blind.
