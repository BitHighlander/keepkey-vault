# Address Registration Audit - Deep Dive

## Issue Summary

**Problem**: Test account (`tester123`) successfully registers Bitcoin addresses with the Pioneer server, but the vault client (`user:b50ce805`) does NOT register its addresses, preventing payment notification events from reaching the vault client.

**Evidence**:
```
Server logs show:
  Address bc1qg2ryu0wy9d3l8aylc82vgwgj4rlgdppxsfr082 belongs to 1 user(s): tester123
  ✅ Emitted pioneer:tx to socket CBQqXbtxr-cQ27ZKAAAB for user tester123

Client logs show:
  🔧 Pioneer credentials: {username: 'user:b50ce805', ...}

Result: Event never reaches client because it's sent to 'tester123' instead of 'user:b50ce805'
```

## Address Registration Architecture

### Server-Side Flow (WORKING for tester123)

1. **Entry Point**: `/api/v1/portfolio` endpoint (balance.controller.ts:258)
2. **Authentication**: `expressAuthentication` middleware validates queryKey and sets `request.user.username`
3. **Balance Fetch**: Calls `balanceCache.getBatchBalances()` to get balance data
4. **Address Extraction**: Lines 323-428 extract addresses from balance tokens
   - For xpubs: Extracts derived addresses from `balance.tokens[]` array
   - For regular addresses: Uses `balance.pubkey` directly
   - Filters to RECEIVE addresses only (path ending in /0/N, not /1/N for change)
5. **Address Registration**: Lines 443-445 calls `addressService.registerAddresses()`
6. **Redis Storage**: `AddressRegistrationService.registerAddresses()` stores:
   - Forward mapping: `user:{username}:addresses:{networkId}` → [addresses]
   - Reverse mapping: `{networkId}:{address}:accounts` → {username}
7. **Blockbook Subscription**: Calls `subscriptionOrchestrator.subscribeAddressesForUser()`

### Client-Side Flow (SHOULD WORK but doesn't for user:b50ce805)

1. **SDK Initialization**: `pioneer-sdk/src/index.ts:894` calls `this.getBalances()`
2. **Get Balances**: Calls `this.getBalancesForNetworks()` (line 1958)
3. **Pioneer Client API Call**: Should call `/api/v1/portfolio` with:
   ```json
   {
     "pubkeys": [
       { "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0", "pubkey": "xpub..." },
       { "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0", "pubkey": "ypub..." },
       { "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0", "pubkey": "zpub..." }
     ]
   }
   ```
4. **Authentication Header**: Must include `Authorization: {queryKey}` header
5. **Server Processing**: Server validates queryKey → extracts username → registers addresses

## Critical Questions to Answer

### 1. Is the vault client calling `/api/v1/portfolio`?

**Check**: Browser Network tab for API calls to `/api/v1/portfolio`

**Expected**: Should see POST requests to `http://127.0.0.1:9001/api/v1/portfolio`

**If NOT present**: The Pioneer SDK is not calling the balance API
  - Check console logs for errors during SDK initialization
  - Check if `skipSync: true` is set in SDK config
  - Verify Pioneer client is properly initialized

**If present but failing**: Check response status code
  - 401: Authentication failure (queryKey invalid)
  - 400: Invalid request body (malformed pubkeys)
  - 500: Server error (check server logs)

### 2. Is authentication working?

**Check**: Server logs for authentication entries when vault loads

**Expected**:
```
[expressAuthentication] Validating queryKey for user: user:b50ce805
[expressAuthentication] ✅ Authentication successful - username: user:b50ce805
```

**If "Invalid queryKey" error**:
  - Verify queryKey in localStorage matches server registration
  - Check if user needs to re-register with `/api/user/register`

### 3. Are pubkeys being sent correctly?

**Check**: Request body in Network tab or server logs

**Expected**: Server logs line 265:
```
Request breakdown by CAIP:
   - bip122:000000000019d6689c085ae165831e93/slip44:0: 3 requests
```

**If no pubkeys sent**:
  - Check if KeepKey device is connected
  - Check if wallet pairing succeeded
  - Verify `this.pubkeys` array is populated in SDK

### 4. Are addresses being extracted from xpubs?

**Check**: Server logs during portfolio fetch

**Expected** (lines 363-373):
```
🔍 DIAGNOSTIC: isXpub=true, pubkey=zpub6rPBGeYJtMkALy...
🔍 DIAGNOSTIC: derivedAddresses exists? true
🔍 DIAGNOSTIC: derivedAddresses isArray? true
🔍 DIAGNOSTIC: tokens count: 42
📍 Found 20 RECEIVE addresses (filtered from 42 total) for xpub zpub... on bip122:000000000019d6689c085ae165831e93
```

**If no addresses extracted**:
  - Check if `balance.tokens` array is populated
  - Verify balance data has `derivedAddresses` or `tokens` field
  - Check Blockbook response format

### 5. Is registerAddresses being called?

**Check**: Server logs for address registration (line 442)

**Expected**:
```
🔍 DEBUG: Calling registerAddresses for username=user:b50ce805...
✅ Registered 20 addresses (20 new) for user:b50ce805
🔔 Subscribed 20 new addresses to live Blockbook events
```

**If NOT called**:
  - Check if `addressService` is null (line 318)
  - Check if condition at line 309 fails (`username && cachedBalances.length > 0`)
  - Look for errors in try-catch block (line 451-454)

### 6. Are addresses stored in Redis?

**Check Redis**:
```bash
# List all keys for user
redis-cli KEYS "user:user:b50ce805:*"

# Check specific address reverse mapping
redis-cli SMEMBERS "bip122:000000000019d6689c085ae165831e93:bc1qg2ryu0wy9d3l8aylc82vgwgj4rlgdppxsfr082:accounts"

# Should show: user:b50ce805 AND tester123 (multiple users can watch same address)
```

**Expected Redis keys**:
```
user:user:b50ce805:addresses:bip122:000000000019d6689c085ae165831e93 → [20 addresses]
bip122:000000000019d6689c085ae165831e93:bc1qg2ryu0wy9d3l8aylc82vgwgj4rlgdppxsfr082:accounts → {user:b50ce805, tester123}
```

**If NOT present**:
  - Address registration failed silently
  - Check error logs from AddressRegistrationService
  - Verify Redis connection is working

## Diagnostic Steps

### Step 1: Check Browser Console Logs

Look for these specific log patterns:

**During SDK initialization:**
```
🔧 Pioneer credentials: {username: 'user:b50ce805', queryKey: 'key:...', keepkeyApiKey: 'eef73...'}
🔧 Pioneer URLs: {PIONEER_URL: 'http://127.0.0.1:9001/spec/swagger.json', PIONEER_WSS: 'ws://127.0.0.1:9001'}
🚀 Paired KeepKey SDK successfully
```

**During sync/balance fetch:**
```
[Pioneer SDK] | getBalances | 🌐 Refreshing all blockchains (21 networks)
[Pioneer SDK] | getBalancesForNetworks | Fetching balances for 21 networks...
```

**Expected but likely MISSING:**
```
[Pioneer Client] Calling /api/v1/portfolio with 3 pubkeys
[Pioneer Client] ✅ Got 3 balances from server
```

### Step 2: Check Server Logs

When vault client loads, you should see:

```
==== INCOMING REQUEST ==== 2025-12-28T21:XX:XX.XXXZ
POST /api/v1/portfolio?forceRefresh=false
Headers: {
  "authorization": "key:271e41d3-4cb6-4253-a885-13e3aa1734b9"
}
Body: {
  pubkeys: [
    { caip: "bip122:000000000019d6689c085ae165831e93/slip44:0", pubkey: "xpub..." },
    { caip: "bip122:000000000019d6689c085ae165831e93/slip44:0", pubkey: "ypub..." },
    { caip: "bip122:000000000019d6689c085ae165831e93/slip44:0", pubkey: "zpub..." }
  ]
}
```

Followed by:
```
[BALANCE_CONTROLLER] Processing 3 balance requests
[BALANCE_CONTROLLER] 🔍 DEBUG: Starting address extraction from 3 balances...
[BALANCE_CONTROLLER] 🔍 DEBUG: Calling registerAddresses for username=user:b50ce805...
[AddressRegistrationService] ✅ Registered 20 addresses (20 new) for user:b50ce805
```

**If NOT seeing these logs**: Portfolio API not being called

### Step 3: Check Network Tab

**Filter**: `portfolio`

**Expected**: POST request to `http://127.0.0.1:9001/api/v1/portfolio`

**Check**:
- Request Headers → `Authorization` header present?
- Request Payload → `pubkeys` array with 3+ entries?
- Response → Status 200 with balance data?

**If request is missing**: SDK not calling Pioneer Client
**If request fails**: Check response error message

### Step 4: Check Redis State

```bash
# Connect to Redis
redis-cli

# Check for vault user's addresses
KEYS "user:user:b50ce805:*"

# Check specific Bitcoin address
SMEMBERS "bip122:000000000019d6689c085ae165831e93:bc1qg2ryu0wy9d3l8aylc82vgwgj4rlgdppxsfr082:accounts"

# Should return BOTH usernames:
# 1) "tester123"
# 2) "user:b50ce805"
```

**If vault user NOT in Redis**: Registration never happened

## Root Cause Hypotheses

### Hypothesis 1: SDK skipSync is enabled

**Evidence needed**: Check SDK config in provider.tsx

```typescript
// Line ~440 in provider.tsx
const sdkConfig = {
  spec: PIONEER_URL,
  wss: PIONEER_WSS,
  skipSync: true, // ← If this is true, balance fetch is skipped
  // ...
};
```

**Fix**: Set `skipSync: false` or remove the parameter

### Hypothesis 2: Pioneer Client not calling the API

**Evidence needed**: Check if Pioneer Client is initialized

**Check**: Browser console for Pioneer Client initialization logs

**Possible causes**:
- Pioneer client failed to initialize
- API client misconfigured
- Network request blocked by CORS or CSP

### Hypothesis 3: Authentication failing silently

**Evidence needed**: Server logs showing auth errors

**Check**: Server logs for:
```
[expressAuthentication] ❌ Invalid queryKey: key:271e41d3...
```

**Fix**: Re-register user with `/api/user/register`

### Hypothesis 4: Address extraction failing

**Evidence needed**: Server logs showing empty address extraction

**Check**: Server logs for:
```
🔍 DEBUG: Extracted addresses for 0 networks:
```

**Possible causes**:
- Balance data missing `tokens` field
- xpub not being detected (isXpub = false)
- Derived addresses not returned by Blockbook

### Hypothesis 5: AddressRegistrationService not available

**Evidence needed**: Server logs showing:
```
AddressRegistrationService not available - skipping address registration
```

**Check**: WebSocketHandler initialization

**Fix**: Ensure WebSocketHandler properly initializes AddressRegistrationService

## Expected Working Flow

When everything works correctly:

**Client → Server:**
```
1. Vault loads → SDK.init() → SDK.getBalances()
2. SDK → Pioneer Client → POST /api/v1/portfolio
3. Headers: { Authorization: "key:271e41d3..." }
4. Body: { pubkeys: [...] }
```

**Server Processing:**
```
5. expressAuthentication validates queryKey
6. Sets request.user.username = "user:b50ce805"
7. Fetches balances from Blockbook
8. Extracts 20 receive addresses from xpub tokens
9. Calls addressService.registerAddresses("user:b50ce805", addresses)
```

**Redis Storage:**
```
10. SADD user:user:b50ce805:addresses:bip122:... [20 addresses]
11. For each address:
    SADD bip122:...:ADDRESS:accounts user:b50ce805
```

**Blockbook Subscription:**
```
12. subscriptionOrchestrator.subscribeAddressesForUser()
13. ChainWatcher subscribes to Blockbook websocket
14. Server ready to receive events for user:b50ce805
```

**Event Delivery:**
```
15. Test script → Redis → ChainWatcher → SubscriptionOrchestrator
16. Looks up bc1qg2ryu... → finds ["tester123", "user:b50ce805"]
17. Emits pioneer:tx to BOTH users' WebSocket connections
18. Client receives event → DASHBOARD_UPDATE → Payment notification
```

## Next Steps

1. **Check browser console** for SDK initialization and balance fetch logs
2. **Check Network tab** for `/api/v1/portfolio` API calls
3. **Check server logs** for portfolio requests from `user:b50ce805`
4. **Check Redis** for address registration entries
5. **Add this address to vault user** manually if needed (temporary fix)
6. **Find root cause** of why registration isn't happening automatically

## Temporary Manual Fix

If you need payment notifications NOW while debugging:

```bash
# Add vault user to the address manually
redis-cli SADD "bip122:000000000019d6689c085ae165831e93:bc1qg2ryu0wy9d3l8aylc82vgwgj4rlgdppxsfr082:accounts" "user:b50ce805"

# Set TTL to 24 hours
redis-cli EXPIRE "bip122:000000000019d6689c085ae165831e93:bc1qg2ryu0wy9d3l8aylc82vgwgj4rlgdppxsfr082:accounts" 86400
```

Then run the test script again - events should reach BOTH users.

But this doesn't fix the root cause - we need to find why automatic registration isn't working for the vault client.
