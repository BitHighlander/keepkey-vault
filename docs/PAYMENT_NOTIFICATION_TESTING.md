# Payment Notification System - Testing Guide

## Overview

This guide documents how to test the end-to-end payment notification system, from triggering a test Bitcoin payment event to seeing the toast notification and hearing the sound effect in the KeepKey Vault application.

## Architecture Overview

```
Test Script (Redis Pub/Sub)
    ↓
ChainWatcher (Pioneer Server)
    ↓
SubscriptionOrchestrator (Pioneer Server)
    ↓
WebSocket (Socket.IO)
    ↓
Pioneer SDK
    ↓
DASHBOARD_UPDATE Event
    ↓
PioneerProvider (React)
    ↓
PaymentEventManager
    ↓
Toast Notification + Sound Effect
```

## Prerequisites

### 1. Services Running

- **Pioneer Server** must be running on `http://127.0.0.1:9001`
- **Redis** must be running (default port 6379)
- **KeepKey Vault** must be running (dev mode)

### 2. Environment Configuration

Verify `.env` in the vault project root:

```bash
# Local development (enabled)
NEXT_PUBLIC_PIONEER_URL="http://127.0.0.1:9001/spec/swagger.json"
NEXT_PUBLIC_PIONEER_WSS="ws://127.0.0.1:9001"
```

### 3. Clear Cached WebSocket URL

**CRITICAL**: The vault caches the WebSocket URL in localStorage which can override the environment variable. Before testing:

```javascript
// Open browser console and run:
localStorage.removeItem('pioneerWss');
// Then reload the page
```

## Testing Workflow

### Step 1: Start All Services

```bash
# Terminal 1: Start Pioneer Server
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer
make start

# Terminal 2: Start KeepKey Vault (dev mode)
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault
npm run dev

# Terminal 3: Verify Redis is running
redis-cli ping
# Should respond: PONG
```

### Step 2: Verify WebSocket Connection

Open the KeepKey Vault in your browser and check the console logs. You should see:

```
🔧 Pioneer URLs: {
  PIONEER_URL: "http://127.0.0.1:9001/spec/swagger.json",
  PIONEER_WSS: "ws://127.0.0.1:9001"
}
```

**If you see `wss://api.keepkey.info` instead**:
1. Run `localStorage.removeItem('pioneerWss')` in browser console
2. Reload the page
3. Verify the URL is now correct

### Step 3: Get Your Bitcoin Address

In the KeepKey Vault UI:
1. Navigate to "Receive" or "Select Address Type"
2. Copy your Bitcoin address (e.g., `bc1qg2ryu0wy9d3l8aylc82vgwj4rlgdppxsfr082`)
3. This address will be used in the test script

### Step 4: Run the Test Script

```bash
# Terminal 4: Trigger test payment event
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/tests/push-events

# Edit push-btc-payment.js and update the address to match YOUR address
# Then run:
node push-btc-payment.js
```

The script publishes a test event to Redis channel `pioneer:test:blockbook:events`.

### Step 5: Verify Server-Side Logs

In the Pioneer Server terminal (Terminal 1), you should see:

```
[ChainWatcher] 📨 Received test event for BTC address bc1qg2ryu0wy9d3l8aylc82vgwj4rlgdppxsfr082
[ChainWatcher] 📨 Transaction detected on BTC: 9c4b892da24b4193f3ba9f149c151131e4e480085b025402fd5c9fe3827008e5 for address bc1qg2ryu0wy9d3l8aylc82vgwj4rlgdppxsfr082
[SubscriptionOrchestrator] Handling transaction 9c4b892da24b4193f3ba9f149c151131e4e480085b025402fd5c9fe3827008e5
[SubscriptionOrchestrator] Address bc1qg2ryu0wy9d3l8aylc82vgwj4rlgdppxsfr082 belongs to 1 user(s): user:b50ce805
[SubscriptionOrchestrator] User user:b50ce805 has 1 connected socket(s)
[SubscriptionOrchestrator] ✅ Emitted pioneer:tx to socket abc123xyz for user user:b50ce805
```

**Key Indicators**:
- ✅ Event received from Redis
- ✅ Transaction detected
- ✅ User found for address
- ✅ Event emitted to WebSocket

### Step 6: Verify Client-Side Logs

In the KeepKey Vault browser console, you should see:

```
[Pioneer SDK] 🔔 Received transaction event: { chain: "BTC", address: "bc1q...", txid: "9c4b..." }
[Pioneer SDK] 🔄 Refreshing balances for BTC (networkId: bip122:000000000019d6689c085ae165831e93)
[Pioneer SDK] ✅ Balances refreshed for BTC
[Pioneer SDK] 💰 Portfolio updated: 0.00123456 → 0.00124600
[Pioneer SDK] DASHBOARD_UPDATE emitted

[PioneerProvider] DASHBOARD_UPDATE event received
[PaymentEventManager] Detected 1 potential event(s)
[PaymentEventManager] PAYMENT_RECEIVED: 0.00001144 BTC ($1.50) on bitcoin
[SoundManager] 🔊 Playing sound: payment_received
[PaymentToastManager] 💰 Showing payment toast for PAYMENT_RECEIVED
```

**Key Indicators**:
- ✅ `pioneer:tx` event received from WebSocket
- ✅ Balances refreshed
- ✅ `DASHBOARD_UPDATE` event emitted
- ✅ Payment event detected
- ✅ Sound played
- ✅ Toast shown

### Step 7: Visual Confirmation

You should see:
1. **Toast Notification**: Top-right corner with Bitcoin logo, amount, and USD value
2. **Sound Effect**: "Chingle" sound plays (chaching.mp3)
3. **Animation**: Toast slides in with bounce effect

## Troubleshooting

### Issue: Server logs show event but client doesn't receive it

**Diagnosis**: WebSocket connection issue

**Solution**:
1. Check browser console for WebSocket connection errors
2. Verify `PIONEER_WSS` is set to `ws://127.0.0.1:9001` (not `wss://api.keepkey.info`)
3. Clear localStorage: `localStorage.removeItem('pioneerWss')`
4. Check Network tab for WebSocket connection status
5. Verify server is running on port 9001

### Issue: "Address belongs to 0 users" in server logs

**Diagnosis**: Address not registered to user account

**Solution**:
1. Ensure you've completed the vault onboarding flow
2. Verify the address in the test script matches your wallet address
3. Check Redis for address registration:
   ```bash
   redis-cli
   SMEMBERS BTC:bc1qg2ryu0wy9d3l8aylc82vgwj4rlgdppxsfr082:accounts
   ```

### Issue: Client receives event but no toast/sound

**Diagnosis**: PaymentEventManager or notification settings issue

**Solution**:
1. Check browser console for PaymentEventManager logs
2. Verify notification settings are enabled (Settings → Notifications)
3. Check sound is unmuted (Settings → Sound)
4. Verify minimum amount threshold is not too high (Settings → Minimum Amount)

### Issue: Duplicate events / multiple toasts

**Diagnosis**: Deduplication not working

**Solution**:
1. Check sessionStorage for event history
2. Clear sessionStorage if needed: `sessionStorage.clear()`
3. Verify 5-second deduplication window is working

## Event Flow Details

### 1. Test Script → Redis
```javascript
// push-btc-payment.js
const CHANNEL = 'pioneer:test:blockbook:events';
const event = {
    chain: 'BTC',
    address: 'bc1qg2ryu0wy9d3l8aylc82vgwj4rlgdppxsfr082',
    event: { tx: { /* transaction data */ } }
};
await publisher.publish(CHANNEL, JSON.stringify(event));
```

### 2. ChainWatcher → Transaction Event
```typescript
// ChainWatcher.ts:101-133
this.redisSubscriber.on('message', (channel, message) => {
    if (channel === TEST_CHANNEL) {
        const testEvent = JSON.parse(message);
        this.handleBlockbookEvent(testEvent.chain, testEvent.address, testEvent.event);
    }
});

// ChainWatcher.ts:382-403
this.emit('transaction', { chain, address, txid, value, tx });
```

### 3. SubscriptionOrchestrator → WebSocket
```typescript
// SubscriptionOrchestrator.ts:318-379
this.chainWatcher.on('transaction', (event) => {
    // Find users who own this address
    const usernamesWithAddress = await redis.smembers(`${chain}:${address}:accounts`);

    // Emit to all their connected sockets
    socket.emit('pioneer:tx', txData);
});
```

### 4. Pioneer SDK → DASHBOARD_UPDATE
```typescript
// pioneer-sdk/src/index.ts:712-755
clientEvents.events.on('pioneer:tx', (data) => {
    this.getBalances({ networkId, forceRefresh: true })
        .then(() => {
            this.dashboard = this.buildDashboardFromBalances();
            this.events.emit('DASHBOARD_UPDATE', { dashboard, trigger: 'transaction' });
        });
});
```

### 5. PioneerProvider → Payment Detection
```typescript
// pioneer.tsx:73-105
useEffect(() => {
    const handleDashboardUpdate = (data: any) => {
        const newBalances = pioneer.state.app.balances || [];
        paymentEventManager.processBalanceUpdate(balancesSnapshotRef.current, newBalances);
        balancesSnapshotRef.current = createBalancesMap(newBalances);
    };

    pioneer.state.app.events.on('DASHBOARD_UPDATE', handleDashboardUpdate);
    return () => pioneer.state.app.events.off('DASHBOARD_UPDATE', handleDashboardUpdate);
}, [pioneer?.state?.app?.events]);
```

### 6. PaymentEventManager → Notifications
```typescript
// PaymentEventManager.ts:79-112
processBalanceUpdate(oldBalances, newBalances) {
    const detectedEvents = detectPaymentEvents(oldBalances, newBalances);

    for (const event of detectedEvents) {
        if (!isDuplicate(event, this.history)) {
            this.handlePaymentEvent(event);
        }
    }
}

// PaymentEventManager.ts:121-151
handlePaymentEvent(event) {
    soundManager.play('payment_received');
    paymentToastManager.showPaymentToast(event);
    this.emitEvent(event);
}
```

## Configuration Files

### WebSocket URL Priority (provider.tsx:37-44)
```typescript
const getConfiguredWss = () => {
  if (typeof window !== 'undefined') {
    // Priority: localStorage > .env > default
    return localStorage.getItem('pioneerWss') ||
           process.env.NEXT_PUBLIC_PIONEER_WSS ||
           'wss://api.keepkey.info';
  }
  return process.env.NEXT_PUBLIC_PIONEER_WSS || 'wss://api.keepkey.info';
};
```

**Order of Precedence**:
1. `localStorage.getItem('pioneerWss')` ← **Can override .env!**
2. `process.env.NEXT_PUBLIC_PIONEER_WSS` ← From .env file
3. `'wss://api.keepkey.info'` ← Default fallback

### Notification Settings

Default values:
- **Notifications Enabled**: `true`
- **Sound Enabled**: `true` (not muted)
- **Minimum Amount**: `$0` (all payments)
- **Show Fiat Value**: `true`

Access in Settings → Notifications

## Testing Checklist

- [ ] All services running (Pioneer Server, Redis, Vault)
- [ ] `.env` configured for local development
- [ ] localStorage cleared (`pioneerWss` removed)
- [ ] WebSocket URL verified in console (should be `ws://127.0.0.1:9001`)
- [ ] Bitcoin address obtained from vault UI
- [ ] Test script updated with correct address
- [ ] Test script executed successfully
- [ ] Server logs show event received and emitted
- [ ] Client logs show `pioneer:tx` received
- [ ] Client logs show `DASHBOARD_UPDATE` emitted
- [ ] Client logs show payment event detected
- [ ] Toast notification appears
- [ ] Sound effect plays
- [ ] No duplicate notifications

## Performance Metrics

Expected latencies:
- **Redis → ChainWatcher**: <10ms
- **ChainWatcher → SubscriptionOrchestrator**: <5ms
- **SubscriptionOrchestrator → WebSocket emit**: <5ms
- **WebSocket → Pioneer SDK**: <50ms (network latency)
- **Pioneer SDK → Balance refresh**: <500ms (depends on API)
- **DASHBOARD_UPDATE → Toast display**: <100ms

**Total end-to-end**: <1 second from test script execution to toast appearing

## Known Issues

1. **localStorage Override**: The WebSocket URL is cached in localStorage and takes precedence over environment variables. Always clear localStorage when switching environments.

2. **Infinite Loop Fixed**: Previously, the PioneerProvider had an infinite loop bug due to `useState` in useEffect. This was fixed by using `useRef` instead.

3. **Username Validation**: The server now allows colons in usernames (e.g., `user:abc123`) after updating the validation regex.

4. **Deduplication Window**: Events are deduplicated within a 5-second window. If you trigger the same test event twice within 5 seconds, the second one will be filtered out.

## Future Improvements

- [ ] Add visual indication of WebSocket connection status in UI
- [ ] Add "Test Notification" button in Settings
- [ ] Add event history panel to view past payment notifications
- [ ] Add metrics dashboard for notification system performance
- [ ] Add support for multiple notification types (swaps, NFTs, etc.)
