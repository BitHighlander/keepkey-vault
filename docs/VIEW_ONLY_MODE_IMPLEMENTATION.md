# View-Only Mode Implementation Summary

## What Has Been Implemented

### 1. Pubkey Storage Service ✅
**File**: `src/lib/storage/pubkeyStorage.ts`

A comprehensive localStorage service for managing KeepKey device pubkeys:

- **`savePubkeys(pubkeys, deviceInfo)`**: Saves pubkeys and device info after successful pairing
- **`loadPubkeys()`**: Retrieves stored pubkeys for view-only mode
- **`hasStoredPubkeys()`**: Quick check if pubkeys are available
- **`getDeviceInfo()`**: Gets device info without loading full pubkey data
- **`clearPubkeys()`**: Removes all stored data
- **`migrateFromMobileStorage()`**: Migrates data from mobile app format

**Storage Keys**:
- `keepkey_vault_pubkeys`: Main pubkey data with version and timestamp
- `keepkey_vault_device_info`: Device label, model, deviceId
- `keepkey_vault_last_paired`: Timestamp of last successful pairing
- `keepkey_vault_storage_version`: Format version for future compatibility

---

### 2. View-Only Banner Component ✅
**File**: `src/components/ViewOnlyBanner.tsx`

A fixed-position banner that appears at the top when in view-only mode:

**Features**:
- Eye icon indicator
- Device name display
- "Connect Device" button to retry vault connection
- Dismissible with X button
- Gold (#FFD700) theming matching KeepKey branding
- Responsive design

---

### 3. Provider View-Only Logic ✅
**File**: `src/app/provider.tsx`

Updated the main app provider to handle view-only mode:

**Detection Logic**:
```typescript
1. Check if vault available at localhost:1646
   ├─ Available: Normal mode with device pairing
   └─ Not Available:
       ├─ Check localStorage for cached pubkeys
       │   ├─ Found: Enter view-only mode
       │   └─ Not Found: Show connection error
```

**Key Changes**:
- Added `isViewOnlyMode` state
- Added `viewOnlyDeviceInfo` state
- Migrates from mobile storage if present
- Loads cached pubkeys when vault unavailable
- Saves pubkeys to localStorage after successful device pairing
- Renders ViewOnlyBanner when in view-only mode

**Storage Integration**:
- Pubkeys are saved after successful `pairWallet('KEEPKEY')` call
- Device info captured from `appInit.context` and `appInit.keepKeySdk.features`
- Automatic migration from legacy mobile storage format

---

## How It Works

### Normal Flow (With Vault)

```
1. User opens vault web app
2. Provider detects vault at http://localhost:1646 ✅
3. Pioneer SDK initializes with vault endpoint
4. SDK pairs with KeepKey device via vault
5. SDK fetches pubkeys from device
6. Provider SAVES pubkeys to localStorage 💾
   └─ Storage: keepkey_vault_pubkeys, keepkey_vault_device_info
7. SDK fetches balances from Pioneer API
8. Dashboard shows full functionality (send, swap, stake)
```

### View-Only Flow (Without Vault, With Cached Pubkeys)

```
1. User opens vault web app (on different device/computer)
2. Provider tries to detect vault at localhost:1646 ❌
3. Provider checks localStorage for cached pubkeys ✅
4. Provider loads cached pubkeys from storage
5. Provider sets isViewOnlyMode = true
6. Pioneer SDK initializes with cached pubkeys
7. SDK fetches balances from Pioneer API using pubkeys
8. Dashboard shows balances (read-only) 👁️
9. View-Only Banner appears at top
10. Send/swap/stake buttons disabled or hidden
```

### First-Time User Flow (No Vault, No Pubkeys)

```
1. User opens vault web app
2. Provider tries to detect vault at localhost:1646 ❌
3. Provider checks localStorage for cached pubkeys ❌
4. ConnectionError component displayed
5. User prompted to:
   - Launch KeepKey Desktop (keepkey:// protocol)
   - Download KeepKey Desktop
   - Try again
```

---

## Features in View-Only Mode

### ✅ Enabled (Read-Only)
- View all balances across all chains
- View transaction history
- View portfolio charts and analytics
- View asset details
- View receive addresses (for deposits)
- Export reports (PDF, CSV)
- Search and filter assets
- View staking positions

### ❌ Disabled (Requires Device)
- Send transactions (needs device signature)
- Swap assets (needs device signature)
- Stake/unstake (needs device signature)
- Add new blockchains (needs device for pubkeys)
- Device settings
- Firmware updates

---

## Storage Format

### Pubkey Data Structure
```json
{
  "pubkeys": [
    {
      "note": "Bitcoin account 0 Native Segwit (Bech32)",
      "networks": ["bip122:000000000019d6689c085ae165831e93"],
      "script_type": "p2wpkh",
      "type": "zpub",
      "addressNList": [2147483732, 2147483648, 2147483648],
      "pubkey": "zpub6rFR7y4Q2AijBEqTUq...",
      "address": "bc1q...",
      "master": "zpub6rFR7y4Q2AijBEqTUq...",
      // ... other fields
    }
    // ... more pubkeys for different chains/paths
  ],
  "deviceInfo": {
    "label": "My KeepKey",
    "model": "KeepKey",
    "deviceId": "1234567890ABCDEF",
    "features": { /* device features */ }
  },
  "timestamp": 1699999999999,
  "version": "1.0.0"
}
```

### Device Info Structure
```json
{
  "label": "My KeepKey",
  "model": "KeepKey",
  "deviceId": "1234567890ABCDEF",
  "features": {
    "vendor": "keepkey.com",
    "major_version": 7,
    "minor_version": 10,
    "patch_version": 0,
    "bootloader_mode": false,
    "device_id": "1234567890ABCDEF",
    "pin_protection": true,
    "passphrase_protection": false,
    "language": "english",
    "label": "My KeepKey",
    "initialized": true,
    "revision": "...",
    "bootloader_hash": "...",
    "imported": false,
    "pin_cached": false,
    "passphrase_cached": false,
    "firmware_present": true,
    "needs_backup": false,
    "flags": 0,
    "model": "K1-14AM"
  }
}
```

---

## What Still Needs to Be Done

### Pioneer SDK Modifications (Required)

The vault side is complete, but the Pioneer SDK needs updates to fully support view-only mode:

1. **Add `viewOnlyMode` config option**
   - See: `VIEW_ONLY_MODE_PLAN.md` Section 1

2. **Skip vault detection when in view-only mode**
   - See: `VIEW_ONLY_MODE_PLAN.md` Section 2-3

3. **Skip device pairing when in view-only mode**
   - See: `VIEW_ONLY_MODE_PLAN.md` Section 4

4. **Add view-only status methods**
   - `isViewOnlyMode()`
   - `canSignTransactions()`
   - `isVaultAvailable()`
   - See: `VIEW_ONLY_MODE_PLAN.md` Section 6

### UI Polish (Optional)

1. **Disable/Hide Transaction Buttons**
   - Grey out or hide "Send" buttons in view-only mode
   - Show tooltip: "Connect device to send transactions"

2. **Add View-Only Indicators**
   - Badge on asset cards: "View Only"
   - Watermark on charts
   - Read-only indicators on forms

3. **Sync Status Display**
   - Show when balances were last updated
   - Show cache age
   - Prompt to reconnect device if data is stale (>30 days)

---

## Testing Checklist

### Manual Testing

- [ ] **Normal Mode**: Pair device with vault running
  - [ ] Verify pubkeys saved to localStorage
  - [ ] Check browser DevTools → Application → Local Storage
  - [ ] Should see `keepkey_vault_pubkeys` key

- [ ] **View-Only Mode**: Stop vault, reload app
  - [ ] Verify view-only banner appears
  - [ ] Verify balances still display correctly
  - [ ] Verify device name shows in banner
  - [ ] Verify "Connect Device" button works

- [ ] **First Time User**: Clear localStorage, reload app
  - [ ] Should see ConnectionError screen
  - [ ] Verify links to download KeepKey Desktop

- [ ] **Migration**: Test with mobile app data
  - [ ] Add test data to `keepkey_mobile_pubkeys`
  - [ ] Reload app
  - [ ] Verify migration to new format

### Browser Console Verification

Look for these log messages:

**Normal Mode**:
```
✅ [KKAPI DEBUG] Vault detected at: http://localhost:1646
🔑 KeepKey connection result: ...
💾 ✅ Saved pubkeys to localStorage for view-only mode
```

**View-Only Mode**:
```
⚠️ [KKAPI DEBUG] Vault not detected - checking for view-only mode
✅ [VIEW-ONLY] Stored pubkeys found - entering view-only mode
👁️ [VIEW-ONLY] Replacing paths with X stored pubkeys
```

**First Time**:
```
⚠️ [KKAPI DEBUG] Vault not detected - checking for view-only mode
❌ [VIEW-ONLY] No stored pubkeys - showing connection error
```

---

## Troubleshooting

### Issue: Pubkeys not being saved

**Check**:
1. Open browser DevTools → Console
2. Look for: `💾 ✅ Saved pubkeys to localStorage`
3. If not present, device pairing may have failed

**Solution**:
- Ensure vault is running on localhost:1646
- Check that KeepKey device is connected
- Look for errors in console during pairing

---

### Issue: View-only mode not activating

**Check**:
1. Open DevTools → Application → Local Storage
2. Look for `keepkey_vault_pubkeys` key
3. If present but view-only not working, check console logs

**Solution**:
- Clear localStorage and re-pair device
- Check for JavaScript errors in console
- Verify pubkey data format is valid JSON

---

### Issue: Balances not showing in view-only mode

**Check**:
1. Console logs for Pioneer API errors
2. Network tab for failed requests
3. Verify pubkeys have valid addresses

**Solution**:
- Check internet connection
- Verify Pioneer API is accessible
- Check if pubkey format is correct

---

## Security Notes

1. **No Private Keys Stored**
   - Only xpubs and addresses saved to localStorage
   - Signing transactions ALWAYS requires device
   - View-only mode cannot compromise security

2. **Data Visibility**
   - localStorage is accessible to JavaScript
   - Public keys are public by design
   - No sensitive information exposed

3. **Device Requirements**
   - All transactions require physical device
   - View-only mode is truly read-only
   - No way to bypass device signatures

---

## File Summary

### New Files Created
1. `src/lib/storage/pubkeyStorage.ts` - Pubkey persistence layer
2. `src/components/ViewOnlyBanner.tsx` - View-only mode UI banner
3. `VIEW_ONLY_MODE_PLAN.md` - Detailed architecture plan
4. `VIEW_ONLY_MODE_IMPLEMENTATION.md` - This implementation summary

### Modified Files
1. `src/app/provider.tsx` - Added view-only mode logic and pubkey persistence

---

## Next Steps

1. **Test Current Implementation**
   - Follow manual testing checklist above
   - Verify pubkeys are being saved correctly
   - Test view-only mode activation

2. **Implement Pioneer SDK Changes**
   - Follow `VIEW_ONLY_MODE_PLAN.md`
   - Add `viewOnlyMode` config option
   - Skip vault/device when in view-only mode
   - Add status helper methods

3. **UI Polish**
   - Disable transaction buttons in view-only mode
   - Add view-only indicators
   - Show sync status/age

4. **Write Tests**
   - Unit tests for pubkeyStorage
   - Integration tests for full flow
   - E2E tests for user flows

---

## Questions?

Refer to `VIEW_ONLY_MODE_PLAN.md` for:
- Detailed Pioneer SDK modification plan
- Data flow diagrams
- API impact analysis
- Future enhancement ideas
- Testing strategy
