# Token Discovery Test Instructions

## What We Fixed

Added detailed error logging to identify why `getCharts()` is failing in Vault but working in integration-coins.

## Testing Steps

### 1. Start Vault in Dev Mode

```bash
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault
bun run dev
```

### 2. Open Browser DevTools

1. Open Vault in browser (http://localhost:3000 or whatever port it shows)
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Clear console

### 3. Watch Initialization

When Vault loads, look for these specific messages:

#### ✅ Success Case:
```
📊 Starting chart fetching (including staking positions)...
📊 Balances before getCharts: 5
✅ Chart fetching completed successfully
📊 Balances after getCharts: 37
📊 Tokens loaded: 32  ← Should see tokens!
```

#### ❌ Failure Case (What you're probably seeing):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ CRITICAL: getCharts failed during initialization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Error type: TypeError
Error message: <ACTUAL ERROR HERE>
Pioneer client exists: true/false  ← KEY INFO
Pubkeys count: 18
Blockchains count: 14
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Click "Discover Tokens" Button

1. Navigate to any EVM asset (ETH, BNB, Polygon, Base)
2. Scroll down to the "Tokens" section
3. Click "Discover Tokens" button
4. Watch console for detailed error

### 5. Report Findings

Copy the exact error message from the console, including:
- Error type
- Error message
- Error stack
- Pioneer client exists (true/false)
- Pubkeys count
- Blockchains count

---

## Common Errors & Fixes

### Error: "Cannot read property 'GetPortfolio' of undefined"

**Cause**: Pioneer client not initialized  
**Fix**: Check that `appInit.init()` completed successfully

### Error: "No pubkeys available"

**Cause**: Wallet not paired or pubkeys not loaded  
**Fix**: Check that device pairing completed

### Error: "Portfolio endpoint returned 404"

**Cause**: Pioneer server doesn't have `/api/v1/charts/portfolio` route  
**Fix**: Verify Pioneer server is updated and running

### Error: Module import failure

**Cause**: SDK charts module not built  
**Fix**: Rebuild SDK:
```bash
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer
make build
```

---

## Quick Debug in Browser Console

Once Vault is loaded, you can run this in the browser console:

```javascript
// Check app state
console.log('App exists:', !!window.app || !!pioneer?.state?.app);
console.log('Pioneer client:', !!app?.pioneer);
console.log('Pubkeys:', app?.pubkeys?.length);
console.log('Current balances:', app?.balances?.length);
console.log('Tokens:', app?.balances?.filter(b => b.token === true).length);

// Try getCharts manually
try {
  const result = await app.getCharts();
  console.log('✅ getCharts succeeded:', result.length);
} catch (e) {
  console.error('❌ getCharts failed:', e.message, e);
}
```

---

## Expected Result

After proper initialization, you should see:

```
📊 Tokens loaded: 30+  ← Non-zero!
```

And in the UI:
- Tokens section should show USDC, USDT, WETH, etc.
- Each token should have balance and USD value
- "Discover Tokens" should add/refresh tokens

---

## Next Steps

1. Test in browser and copy the FULL error message
2. Share the error details
3. We'll fix the actual root cause
4. Test again to verify fix

The detailed logging will tell us exactly what's wrong instead of guessing!

