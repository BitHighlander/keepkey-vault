# View-Only Mode Architecture Plan

## Overview

View-only mode allows the KeepKey Vault web app to display portfolio balances and transaction history using cached pubkeys, even when the KeepKey Desktop vault (localhost:1646) is unavailable. This enables users to check their balances on devices where they don't have the desktop app installed.

## Implementation Status

### ✅ Completed (Vault Side)

1. **Pubkey Storage Service** (`src/lib/storage/pubkeyStorage.ts`)
   - Save/load pubkeys to localStorage
   - Device info persistence
   - Version management
   - Migration from mobile storage format

2. **View-Only Banner Component** (`src/components/ViewOnlyBanner.tsx`)
   - Visual indicator for view-only mode
   - Connect device CTA
   - Dismissible notification

3. **Provider View-Only Logic** (`src/app/provider.tsx`)
   - Detect vault availability
   - Fall back to stored pubkeys
   - Load stored pubkeys into paths
   - Save pubkeys after successful pairing

## Required Pioneer SDK Modifications

### 1. Add View-Only Mode Configuration

**File**: `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts`

**Changes Needed**:

```typescript
export interface PioneerSDKConfig {
  // ... existing config ...
  keepkeyApiKey?: string;
  keepkeyEndpoint?: string;
  forceLocalhost?: boolean;

  // NEW: View-only mode support
  viewOnlyMode?: boolean;           // Enable view-only mode
  skipDevicePairing?: boolean;      // Skip KeepKey device pairing
  skipKeeperEndpoint?: boolean;     // Skip vault endpoint detection
}
```

**Purpose**: Allow SDK to initialize in view-only mode without requiring vault or device connection.

---

### 2. Modify Initialization Logic

**File**: `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts`

**Current Behavior**:
- SDK calls `detectKkApiAvailability()` to find vault
- If no vault, initialization may fail or timeout
- Attempts to pair with KeepKey device

**Required Changes**:

```typescript
async init(wallets: any = {}, options: { skipSync?: boolean } = {}) {
  const tag = ' | init | ';

  // NEW: Check if view-only mode
  if (this.viewOnlyMode) {
    console.log(tag, '👁️ [VIEW-ONLY] Initializing in view-only mode');

    // Skip vault detection
    this.keepkeyEndpoint = null;

    // Skip device pairing
    this.skipDevicePairing = true;

    // Continue with initialization using provided pubkeys
    // ... rest of init logic
  }

  // Existing logic for normal mode
  // ...
}
```

**Key Points**:
- Skip `detectKkApiAvailability()` if view-only mode
- Skip KeepKey device pairing attempts
- Allow init to complete with only pubkeys (no device or vault)
- Still fetch balances from Pioneer API using pubkeys

---

### 3. Modify KeepKey Endpoint Detection

**File**: `projects/pioneer/modules/pioneer/pioneer-sdk/src/utils/kkapi-detection.ts`

**Current Behavior**:
- Tries multiple endpoints to find vault
- Returns `isAvailable: false` if no vault found

**Required Changes**:

```typescript
export async function detectKkApiAvailability(
  forceLocalhost?: boolean,
  skipDetection?: boolean  // NEW parameter
): Promise<{
  isAvailable: boolean;
  baseUrl: string;
  basePath: string;
}> {
  const tag = ' | detectKkApiAvailability | ';

  // NEW: If skip detection requested (view-only mode)
  if (skipDetection) {
    console.log(tag, '👁️ [VIEW-ONLY] Skipping vault detection');
    return {
      isAvailable: false,
      baseUrl: '',
      basePath: '',
    };
  }

  // Existing detection logic...
}
```

---

### 4. Modify pairWallet Method

**File**: `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts`

**Current Behavior**:
- Attempts to connect to KeepKey device
- May timeout or fail if no device

**Required Changes**:

```typescript
this.pairWallet = async (walletType: string) => {
  const tag = ' | pairWallet | ';

  // NEW: If view-only mode, skip pairing
  if (this.viewOnlyMode || this.skipDevicePairing) {
    console.log(tag, '👁️ [VIEW-ONLY] Skipping device pairing');
    return {
      success: false,
      reason: 'view-only-mode',
      message: 'Device pairing skipped in view-only mode'
    };
  }

  // Existing pairing logic...
};
```

---

### 5. Modify Balance Fetching

**File**: `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts`

**Current Behavior**:
- Requires vault or device for some operations
- May fail if vault unavailable

**Required Changes**:

```typescript
async getBalances() {
  const tag = ' | getBalances | ';

  // Balances can be fetched using pubkeys alone
  // No device or vault required
  // This should already work, but add view-only logging

  if (this.viewOnlyMode) {
    console.log(tag, '👁️ [VIEW-ONLY] Fetching balances using cached pubkeys');
  }

  // Existing balance fetch logic...
}
```

**Key Point**: Balance fetching via Pioneer API should work fine with just pubkeys - no vault or device needed.

---

### 6. Add View-Only Status Methods

**File**: `projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts`

**New Methods**:

```typescript
public class SDK {
  public viewOnlyMode: boolean = false;
  public skipDevicePairing: boolean = false;

  // NEW: Check if in view-only mode
  public isViewOnlyMode(): boolean {
    return this.viewOnlyMode;
  }

  // NEW: Check if device operations are available
  public canSignTransactions(): boolean {
    return !this.viewOnlyMode && !!this.keepKeySdk;
  }

  // NEW: Check if vault is available
  public isVaultAvailable(): boolean {
    return !!this.keepkeyEndpoint && this.keepkeyEndpoint !== '';
  }
}
```

---

## Data Flow

### Normal Mode (Device + Vault Available)

```
1. User opens vault web app
2. Provider detects vault at localhost:1646 ✅
3. SDK initializes with vault endpoint
4. SDK pairs with KeepKey device
5. SDK fetches pubkeys from device
6. SDK saves pubkeys to localStorage 💾
7. SDK fetches balances from Pioneer API
8. Dashboard displays with full functionality
```

### View-Only Mode (No Vault, Has Cached Pubkeys)

```
1. User opens vault web app
2. Provider checks vault at localhost:1646 ❌
3. Provider checks localStorage for cached pubkeys ✅
4. Provider sets viewOnlyMode = true
5. SDK initializes with viewOnlyMode flag
6. SDK skips vault detection
7. SDK skips device pairing
8. SDK uses cached pubkeys from localStorage
9. SDK fetches balances from Pioneer API
10. Dashboard displays in view-only mode 👁️
11. View-only banner shown at top
```

### First Time User (No Vault, No Pubkeys)

```
1. User opens vault web app
2. Provider checks vault at localhost:1646 ❌
3. Provider checks localStorage for cached pubkeys ❌
4. Show ConnectionError component
5. User prompted to download/launch KeepKey Desktop
```

---

## UI/UX Considerations

### View-Only Banner
- **Position**: Fixed at top of viewport
- **Color**: Gold (#FFD700) to match KeepKey branding
- **Content**: "View-Only Mode • [Device Name] • Showing balances without device access"
- **Actions**:
  - "Connect Device" button → Retry vault connection
  - Dismiss button (X)

### Disabled Features in View-Only Mode
- **Sending transactions** - Requires device signature
- **Swapping assets** - Requires device signature
- **Staking operations** - Requires device signature
- **Adding new blockchains** - Requires device for new pubkeys
- **Device settings** - Requires device connection

### Enabled Features in View-Only Mode
- **Viewing balances** ✅
- **Viewing transaction history** ✅
- **Portfolio charts** ✅
- **Asset details** ✅
- **Receive addresses** ✅ (read-only)
- **Export reports** ✅

---

## Testing Strategy

### Unit Tests Needed

1. **Pubkey Storage Service**
   - Test save/load operations
   - Test version compatibility
   - Test migration from mobile storage
   - Test error handling

2. **Pioneer SDK View-Only Mode**
   - Test initialization without vault
   - Test initialization without device
   - Test balance fetching with cached pubkeys
   - Test status methods (isViewOnlyMode, canSignTransactions, etc.)

### Integration Tests Needed

1. **Full Flow Test**
   - Pair device with vault → Save pubkeys
   - Close vault
   - Reload app → Enter view-only mode
   - Verify balances display correctly

2. **Error Handling Test**
   - No vault + no cached pubkeys → Show connection error
   - Corrupted localStorage data → Handle gracefully
   - Network errors during balance fetch → Show appropriate error

### Manual Testing Checklist

- [ ] Pair KeepKey device with vault running
- [ ] Verify pubkeys saved to localStorage
- [ ] Stop vault (kill localhost:1646)
- [ ] Reload app
- [ ] Verify view-only banner appears
- [ ] Verify balances still display
- [ ] Verify send/swap buttons are disabled
- [ ] Try to "Connect Device" from banner
- [ ] Verify error if vault still unavailable

---

## Configuration in Vault Provider

**File**: `projects/keepkey-vault/src/app/provider.tsx`

**Current Implementation**:
```typescript
// If vault unavailable but pubkeys available
if (isViewOnlyMode) {
  const storedData = loadPubkeys();

  const appInit = new SDK(PIONEER_URL, {
    // ... existing config ...
    viewOnlyMode: true,           // NEW
    skipDevicePairing: true,      // NEW
    skipKeeperEndpoint: true,     // NEW
    paths: storedData.pubkeys,    // Use cached pubkeys
  });
}
```

---

## Security Considerations

1. **No Private Keys in localStorage**
   - Only public keys (xpubs, addresses) are stored
   - Device is required for signing operations
   - View-only mode cannot compromise wallet security

2. **Data Expiry**
   - Consider adding pubkey cache expiry (e.g., 30 days)
   - Prompt user to reconnect device periodically

3. **Data Validation**
   - Validate pubkey format before using
   - Check version compatibility
   - Handle corrupted data gracefully

---

## Future Enhancements

1. **Multiple Device Support**
   - Store pubkeys for multiple KeepKey devices
   - Allow switching between devices in view-only mode

2. **Sync Status Indicator**
   - Show last sync time
   - Show when balances were last updated
   - Warn if data is stale

3. **Partial Functionality Mode**
   - Allow some operations without device (e.g., address generation)
   - Clearly indicate which features require device

4. **QR Code Pairing**
   - Generate QR code on desktop vault
   - Scan from mobile to sync pubkeys
   - Enables mobile view-only mode

---

## Implementation Priority

### Phase 1: Core View-Only Mode (Current)
- [x] Pubkey storage service
- [x] View-only banner component
- [x] Provider view-only logic
- [ ] Pioneer SDK view-only config
- [ ] Pioneer SDK initialization changes

### Phase 2: Testing & Polish
- [ ] Unit tests
- [ ] Integration tests
- [ ] Error handling improvements
- [ ] UI polish

### Phase 3: Enhanced Features
- [ ] Multiple device support
- [ ] Sync status indicator
- [ ] Data expiry
- [ ] QR code pairing

---

## API Impact

No breaking changes to Pioneer SDK public API. All new fields are optional:

```typescript
// Existing code continues to work
const sdk = new SDK(spec, {
  appName: 'MyApp',
  // ... existing config
});

// New view-only mode is opt-in
const sdk = new SDK(spec, {
  appName: 'MyApp',
  viewOnlyMode: true,        // NEW (optional)
  skipDevicePairing: true,   // NEW (optional)
  // ... existing config
});
```

---

## Questions for Review

1. Should we add a "Last Updated" timestamp to the view-only banner?
2. Should we automatically refresh balances periodically in view-only mode?
3. Should we limit how long pubkeys stay in localStorage (30 days? 90 days?)?
4. Should we add analytics to track view-only mode usage?
5. Should we support exporting pubkeys to share between devices?

---

## Related Files

### Vault Web App
- `/src/lib/storage/pubkeyStorage.ts` - Pubkey persistence
- `/src/components/ViewOnlyBanner.tsx` - UI banner
- `/src/app/provider.tsx` - Provider with view-only logic
- `/src/components/error/ConnectionError.tsx` - No vault/pubkeys error

### Pioneer SDK
- `/projects/pioneer/modules/pioneer/pioneer-sdk/src/index.ts` - Main SDK class
- `/projects/pioneer/modules/pioneer/pioneer-sdk/src/utils/kkapi-detection.ts` - Vault detection
- `/projects/pioneer/modules/pioneer/pioneer-sdk/src/getPubkey.ts` - Pubkey operations

---

## Summary

View-only mode is a user-friendly feature that allows balance checking without the desktop app. The implementation is straightforward:

1. **Vault side**: Store pubkeys after pairing, detect when vault unavailable, load cached pubkeys
2. **SDK side**: Add optional flags to skip vault/device, initialize with pubkeys only
3. **UI side**: Show banner, disable device-required features

**Key Principle**: Balances can be fetched using pubkeys alone - no device or vault required. The Pioneer API handles the blockchain queries.
