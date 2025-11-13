# getCharts Regression Audit - Vault Token Loading Failure

**Date**: 2025-11-13  
**Issue**: Vault fails to load tokens on first load, "Discover Tokens" button also fails  
**Status**: 🔴 CRITICAL - Users can't see their token balances

---

## 🎯 Problem Summary

- **Integration-coins test**: ✅ Works perfectly (32 tokens loaded)
- **Vault UI**: ❌ Fails to load tokens
- **Discover Tokens button**: ❌ Does nothing

### Working Evidence (integration-coins)

```bash
| charts-evm | Portfolio returned 5 balances
| charts-evm | Processing portfolio.tokens: 32
| charts-evm | Total balances (native + tokens): 37
```

---

## 🔍 Root Cause Analysis

### The Code That's Swallowing Errors

**File**: `projects/keepkey-vault/src/app/provider.tsx:517-532`

```typescript
try {
  await appInit.getCharts();
  console.log('✅ Chart fetching completed successfully');
  console.log('📊 Balances after getCharts:', appInit.balances.length);
} catch (chartError: any) {
  // Check if it's a network support error
  if (chartError?.message?.includes('network not live in blockchains')) {
    // Extract the unsupported network from the error message
    const match = chartError.message.match(/"([^"]+)"/);
    const network = match ? match[1] : 'unknown';
    console.log(`ℹ️ Network ${network} not supported for charts - skipping`);
    // This is expected - some networks don't have chart support
  } else {
    console.error('❌ Chart fetching error:', chartError);  // ← ERROR LOGGED BUT SWALLOWED
  }
}
```

**Problem**: The error is logged but execution continues without tokens!

### Same Issue in Dashboard

**File**: `projects/keepkey-vault/src/components/dashboard/Dashboard.tsx:1423-1428`

```typescript
try {
  await app.getCharts();
} catch (chartError) {
  console.warn('⚠️ [Dashboard] getCharts failed (likely staking position parameter bug):', chartError);
  // Don't throw - this is a known issue with the Pioneer SDK  ← SWALLOWED!
}
```

**Problem**: Assumes all errors are "known staking position bugs" and swallows them!

---

## 🐛 What's Really Happening

1. User opens Vault
2. Provider.tsx calls `appInit.getCharts()`
3. getCharts fails with REAL error (not staking bug)
4. Error is caught and swallowed
5. App continues without tokens
6. User sees "No tokens" message
7. User clicks "Discover Tokens" button
8. Dashboard.tsx calls `app.getCharts()`
9. Same error, swallowed again
10. Still no tokens

---

## 🔧 Likely Actual Errors

Based on the code, possible real errors being hidden:

### 1. Missing Pioneer Client

```typescript
if (!this.pioneer) {
  throw new Error('Pioneer client not initialized');
}
```

### 2. Empty Pubkeys Array

```typescript
if (!this.pubkeys || this.pubkeys.length === 0) {
  throw new Error('No pubkeys available');
}
```

### 3. GetPortfolio 404 Error

```
 | Pioneer-sdk |  | getUnifiedPortfolio |  Portfolio endpoint returned 404
```

This was in the integration-coins output - but it gracefully fell back. Vault might not handle this.

### 4. Module Import Failure

```typescript
const { getCharts: getChartsModular } = await import('./charts');
```

If the dist build is missing `charts/index.js`, this will fail.

---

## ✅ Fix Required

### Step 1: Add Detailed Error Logging

**File**: `projects/keepkey-vault/src/app/provider.tsx`

```typescript
try {
  await appInit.getCharts();
  console.log('✅ Chart fetching completed successfully');
  console.log('📊 Balances after getCharts:', appInit.balances.length);
  
  // ADD THIS: Verify tokens were loaded
  const tokens = appInit.balances.filter((b: any) => b.token === true);
  console.log('📊 Tokens loaded:', tokens.length);
  if (tokens.length === 0) {
    console.warn('⚠️ getCharts completed but found 0 tokens - this may indicate a problem');
  }
  
} catch (chartError: any) {
  // ADD DETAILED ERROR LOGGING
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ CRITICAL: getCharts failed during initialization');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Error type:', chartError?.constructor?.name);
  console.error('Error message:', chartError?.message);
  console.error('Error stack:', chartError?.stack);
  console.error('Pioneer client exists:', !!appInit.pioneer);
  console.error('Pubkeys count:', appInit.pubkeys?.length || 0);
  console.error('Blockchains count:', appInit.blockchains?.length || 0);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Check if it's a network support error
  if (chartError?.message?.includes('network not live in blockchains')) {
    const match = chartError.message.match(/"([^"]+)"/);
    const network = match ? match[1] : 'unknown';
    console.log(`ℹ️ Network ${network} not supported for charts - skipping`);
  } else {
    // DON'T SWALLOW - let it bubble up or at least show to user
    throw new Error(`Token discovery failed: ${chartError?.message || 'Unknown error'}`);
  }
}
```

### Step 2: Fix Dashboard Button Handler

**File**: `projects/keepkey-vault/src/components/dashboard/Dashboard.tsx`

```typescript
try {
  await app.getCharts();
  
  // ADD VERIFICATION
  const tokens = app.balances?.filter((b: any) => b.token === true) || [];
  console.log('✅ [Dashboard] getCharts returned', tokens.length, 'tokens');
  
  if (tokens.length === 0) {
    console.warn('⚠️ [Dashboard] getCharts completed but returned 0 tokens');
    // Show toast notification to user
    // toaster.warning({ 
    //   title: 'No Tokens Found',
    //   description: 'Token discovery completed but no tokens were found for this wallet'
    // });
  }
  
} catch (chartError) {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ [Dashboard] getCharts failed:', chartError);
  console.error('Error details:', {
    message: chartError?.message,
    type: chartError?.constructor?.name,
    pioneer: !!app?.pioneer,
    pubkeys: app?.pubkeys?.length || 0
  });
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // SHOW ERROR TO USER
  // toaster.error({
  //   title: 'Token Discovery Failed',
  //   description: chartError?.message || 'Unable to discover tokens. Please try again.'
  // });
}
```

### Step 3: Verify SDK Build

```bash
# Check if charts module is built
ls -la /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/modules/pioneer/pioneer-sdk/dist/charts/

# Should show:
# index.js
# index.d.ts
# (other chart files)

# If missing, rebuild SDK
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer
make build
```

---

## 🧪 Testing Steps

### 1. Open Vault DevTools

```bash
# Start Vault
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/keepkey-vault
bun run dev
```

### 2. Watch Console on Load

Look for:
- ✅ `getCharts` being called
- ❌ Any error messages with full details
- 📊 Token count after getCharts

### 3. Click "Discover Tokens"

Watch for:
- ❌ Full error details (not swallowed)
- 📊 Token count changes

### 4. Check Network Tab

Look for:
- `POST /api/v1/charts/portfolio` request
- Response status (200, 404, 500?)
- Response body (tokens present?)

---

## 🎯 Expected Behavior After Fix

### Successful Load:
```
📊 Starting chart fetching...
✅ Chart fetching completed successfully
📊 Balances after getCharts: 37
📊 Tokens loaded: 32
```

### Failed Load (with details):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ CRITICAL: getCharts failed during initialization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Error type: TypeError
Error message: Cannot read property 'GetPortfolio' of undefined
Pioneer client exists: false  ← AH HA! Real problem!
Pubkeys count: 18
Blockchains count: 14
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔗 Related Issues

1. **TOKEN_MISSING_AUDIT.md** - Integration-coins token loading (fixed)
2. **Balance cache fix** - Just completed (unrelated)
3. **Provider initialization** - May need review

---

## 📋 Action Plan

1. ✅ Identify that SDK is working (integration-coins test passes)
2. ⏳ Add detailed error logging to Vault
3. ⏳ Test in browser to see real error
4. ⏳ Fix the actual error (likely Pioneer client not initialized)
5. ⏳ Remove error swallowing from Dashboard
6. ⏳ Test token discovery end-to-end
7. ⏳ Document the fix

---

## 💡 Key Lesson

**NEVER silently swallow errors in production code!**

❌ Bad:
```typescript
} catch (error) {
  console.warn('Known bug, ignoring:', error);  // SWALLOWED!
}
```

✅ Good:
```typescript
} catch (error) {
  console.error('Failed:', error);
  throw error;  // Let caller handle it
}
```

Or at minimum:
```typescript
} catch (error) {
  console.error('━━━━ CRITICAL ERROR ━━━━');
  console.error('Full details:', error);
  console.error('Context:', { /* relevant state */ });
  console.error('━━━━━━━━━━━━━━━━━━━━━━━');
  // Still swallowed, but at least visible!
}
```

