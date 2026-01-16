# Provider Audit: Vault vs Integration-Coins Pattern

## Problem Summary
The vault's provider.tsx has 0 pubkeys and 0 balances after init because it's trying to manually orchestrate what the Pioneer SDK should handle automatically.

## Comparison

### ✅ Working Pattern (integration-coins/src/index.ts)

```typescript
// 1. Configure SDK with paths and blockchains
const config = {
  username: 'tester123',
  queryKey: '123456',
  spec: 'http://127.0.0.1:9001/spec/swagger.json',
  wss: 'wss://pioneers.dev',
  keepkeyApiKey: process.env.KEEPKEY_API_KEY,
  keepkeyEndpoint: vaultAvailable ? 'kkapi://' : undefined,
  paths,
  blockchains,
  nodes: [],
  pubkeys: [],
  balances: []
}

// 2. Create SDK instance
let app = new SDK.SDK(spec, config)

// 3. Initialize - THIS DOES EVERYTHING
const resultInit = await app.init({}, { skipSync: false })

// 4. At this point, we have:
console.log(app.pubkeys.length)    // > 0
console.log(app.balances.length)   // > 0
console.log(app.dashboard)         // Full dashboard data
```

### ❌ Broken Pattern (keepkey-vault/src/app/provider.tsx)

```typescript
// 1. Create SDK (mostly same)
const appInit = new SDK(PIONEER_URL, {
  spec: PIONEER_URL,
  wss: PIONEER_WSS,
  blockchains,
  keepkeyApiKey,
  keepkeyEndpoint: detectedKeeperEndpoint,
  username,
  queryKey,
  paths,
  // ... other config
})

// 2. Initialize - BUT MISSING skipSync OPTION
const resultInit = await appInit.init({}, {})  // ❌ Wrong!

// 3. At this point:
console.log(appInit.pubkeys.length)    // 0  ❌
console.log(appInit.balances.length)   // 0  ❌

// 4. Then MANUALLY tries to fix it:
await appInit.pairWallet('KEEPKEY')    // Should already be done by init!
await appInit.getCharts()              // Should already be done by init!
await appInit.getAssets()              // Should already be done by init!
// Still has 0 pubkeys/balances because init didn't run sync!
```

## Root Cause

The `init()` function in Pioneer SDK has TWO modes:

1. **Full Init** (skipSync: false)
   - Pairs with wallet
   - Gets pubkeys for all paths
   - Gets balances for all pubkeys
   - Returns fully initialized app

2. **Partial Init** (skipSync: true or missing)
   - Just sets up SDK structure
   - Expects manual pairing/syncing later
   - Returns app with 0 pubkeys/balances

The vault is calling `init({}, {})` which is partial init mode!

## Fix Required

Change line ~386 in provider.tsx from:
```typescript
const resultInit = await Promise.race([
  appInit.init({}, {}),  // ❌ Wrong - partial init
  initTimeout
]);
```

To:
```typescript
const resultInit = await Promise.race([
  appInit.init({}, { skipSync: false }),  // ✅ Correct - full init
  initTimeout
]);
```

Then REMOVE all the manual calls:
- ❌ Remove manual `pairWallet()` call
- ❌ Remove manual `getCharts()` call
- ❌ Remove manual `getAssets()` call
- ❌ Remove manual `refresh()` call

The SDK will handle everything automatically!

## Expected Results After Fix

```typescript
console.log("✅ Pioneer SDK initialized, resultInit:", resultInit);
console.log("📊 Wallets:", appInit.wallets.length);     // > 0
console.log("🔑 Pubkeys:", appInit.pubkeys.length);     // > 0 (14+ expected)
console.log("💰 Balances:", appInit.balances.length);   // > 0 (depends on wallet)
console.log("💵 Dashboard:", appInit.dashboard);        // Full dashboard object
```

## Additional Issues to Fix

1. Remove `PIONEER_INITIALIZED` global flag - it prevents retries
2. Remove validation warnings like "No pubkeys yet - will load on first sync" - they should ERROR if no pubkeys after init
3. Remove redundant error handling that tries to continue without pubkeys/balances
4. Let init() FAIL FAST if device not connected - don't try to workaround it

## Testing Plan

1. Make the init() fix
2. Remove manual calls
3. Run vault with device connected
4. Verify we get 14+ pubkeys and balances immediately after init
5. Verify dashboard data is populated
6. Verify no 404 errors for pubkey/balance fetching
