# Swap History Debug Report

## Issue
Both the swap history bottom-right box and total swap history page are failing to display data.

## Investigation Results

### Backend API (pioneer-server on port 9001)
✅ **WORKING** - API endpoint returns data correctly:
```bash
curl 'http://localhost:9001/api/v1/swaps/pending?limit=5'
# Returns: { swaps: [...], total: 58, limit: 5, offset: 0 }

curl 'http://localhost:9001/api/v1/swaps/pending/address/0xA2b59504C85237ec3c2395A702C306A676D179B7'
# Returns: [array of 58 swap objects]
```

### Database
✅ **WORKING** - Database has 58 pending swaps with correct structure:
- `addresses` field is an array
- Query is properly indexed
- Sample data shows correct format

### Pioneer SDK (`GetAddressPendingSwaps`)
⚠️ **NEEDS VERIFICATION** - Added debug logging to check:
- Location: `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts:3857`
- Added console.log statements to track:
  - Raw response from pioneer-client
  - response.data type and content
  - Array validation
  - Return value

### Frontend Hook (`usePendingSwaps`)
⚠️ **NEEDS VERIFICATION** - Hook implementation looks correct:
- Location: `projects/keepkey-vault/src/hooks/usePendingSwaps.ts:64`
- Checks for `response.success && response.swaps`
- Has fallback logic for backward compatibility
- Proper error handling

## Expected Data Flow

1. **API Layer**: `GET /swaps/pending/address/{address}` → Returns `PendingSwap[]` (direct array)

2. **Swagger Client**: Wraps in `{ body: PendingSwap[] }`

3. **Pioneer Client** (`pioneer-client/src/index.ts:219`):
   ```typescript
   return { data: result.body }
   ```
   Wraps as: `{ data: PendingSwap[] }`

4. **Pioneer SDK** (`pioneer-sdk/src/index.ts:3872-3876`):
   ```typescript
   if (response && response.data) {
     return {
       success: true,
       swaps: Array.isArray(response.data) ? response.data : []
     };
   }
   ```
   Returns: `{ success: true, swaps: PendingSwap[] }`

5. **Frontend Hook** (`usePendingSwaps.ts:88-90`):
   ```typescript
   if (response?.success && response?.swaps) {
     setPendingSwaps(Array.isArray(response.swaps) ? response.swaps : []);
   }
   ```

## Next Steps

1. **Check Browser Console** for new debug logs added to SDK:
   - Open DevTools Console
   - Navigate to Swap History page
   - Look for logs with tag `| GetAddressPendingSwaps |`
   - Check what's being logged for:
     - Raw response
     - response.data type
     - response.data length

2. **Verify User Address** is being passed correctly:
   - Hook gets address from `state.pubkeys` or `app.assetContext.pubkey`
   - Check if address is defined and non-empty
   - Verify it matches addresses in database

3. **Check Network Tab** in DevTools:
   - Look for `GET /api/v1/swaps/pending/address/...` requests
   - Verify they're hitting `localhost:9001` (pioneer-server)
   - Check response status and body

4. **Common Issues to Check**:
   - Is pioneer-server running on port 9001?
   - Is the vault correctly configured to use localhost:9001?
   - Are there CORS issues?
   - Is the SDK initialized properly (`app.pioneer` exists)?
   - Is there a valid user address available?

## Manual Test

You can manually test the SDK method:
```bash
cd /Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/services/pioneer-server
ts-node scripts/test-sdk-method.ts 0xA2b59504C85237ec3c2395A702C306A676D179B7
```

Expected output:
```
✅ Method call successful!
Found 58 pending swap(s)
```

## Files Modified

1. **pioneer-sdk/src/index.ts** - Added debug logging to `GetAddressPendingSwaps` method

Changes need to be committed after verification and cleanup.
