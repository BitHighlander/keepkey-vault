# View-Only Mode Implementation Plan

## Executive Summary

This document outlines the implementation plan for adding view-only mode to KeepKey Vault, allowing users to view their portfolio and balances without requiring a connected KeepKey device. This feature is based on the successful proof-of-concept built in `projects/pioneer/e2e/wallets/intergration-view-only`.

## What We Built (Proof of Concept)

### Test Location
`/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/e2e/wallets/intergration-view-only`

### Three-Phase Architecture

#### Phase 1: Pubkey Generation and Caching
- Connect to KeepKey device via Pioneer SDK
- Generate pubkeys for all supported chains (14 chains: ETH, BTC, LTC, DOGE, BCH, DASH, GAIA, OSMO, XRP, MAYA, THOR, MATIC, BASE, BSC)
- Store pubkeys in `pubkeys.json` with metadata:
  ```json
  {
    "pubkeys": [...18 pubkey objects...],
    "deviceInfo": {
      "label": "keepkey:TestKeepKeyMain.json",
      "model": "KeepKey",
      "deviceId": "...",
      "features": {...}
    },
    "timestamp": 1234567890,
    "version": "1.0.0"
  }
  ```
- Cache includes: xpubs, addresses, networks, paths, symbols

#### Phase 2: View-Only Mode Initialization
- Check for cached pubkeys on startup
- If found, initialize SDK with:
  - `viewOnlyMode: true`
  - `skipDevicePairing: true`
  - `skipKeeperEndpoint: true`
  - Pre-loaded pubkeys from cache
- SDK confirms: `isViewOnlyMode() === true`, `canSignTransactions() === false`
- No device connection required

#### Phase 3: Balance Fetching and Display
- Successfully fetched 96 balances from cached pubkeys
- Portfolio value: $415.55
- Beautiful ASCII table formatting with three sections:
  - 🪙 NATIVE ASSETS (BTC, ETH, XRP, etc.)
  - 💵 STABLECOINS (USDC, USDT, DAI)
  - 🎯 TOKENS (ERC20/BEP20 tokens)
- Chain breakdown with percentages
- All without device connection

### Key Technical Details

**API Configuration** (matching intergration-coins working pattern):
```typescript
const apiUrl = process.env.API_URL || 'https://api.keepkey.info';
const spec = `${apiUrl}/spec/swagger.json`;

const config = {
  spec,
  keepkeyApiKey: process.env.KEEPKEY_API_KEY || 'e4ea6479-5ea4-4c7d-b824-e075101bf9fd',
  wss: process.env.VITE_PIONEER_URL_WSS || 'wss://api.keepkey.info',
  viewOnlyMode: true,
  skipDevicePairing: true,
  skipKeeperEndpoint: true,
  pubkeys: CACHED_PUBKEYS,
  blockchains: NETWORK_IDS_FROM_PUBKEYS,
  nodes: [],
  balances: [],
};
```

**Critical Success Factors:**
1. Filter wildcard networkIds (`eip155:*` is invalid CAIP)
2. Use `api.keepkey.info` API (not `pioneers.dev`)
3. Include empty `nodes: []` and `balances: []` arrays in config
4. Properly format pubkey objects with `networks` array

## Implementation Plan for KeepKey Vault

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        KeepKey Vault                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Startup Flow:                                                  │
│  ┌──────────────┐                                               │
│  │ Check        │  Yes   ┌──────────────────────┐              │
│  │ localStorage ├───────►│ Offer View-Only Mode │              │
│  │ for pubkeys  │        └──────────┬───────────┘              │
│  └──────┬───────┘                   │                           │
│         │ No                         │                           │
│         │                            ▼                           │
│         │                   ┌────────────────┐                  │
│         │                   │ User Choice:   │                  │
│         │                   │ 1. View-Only   │                  │
│         │                   │ 2. Full Mode   │                  │
│         │                   └────────┬───────┘                  │
│         ▼                            │                           │
│  ┌──────────────┐                   │                           │
│  │ Connect      │◄──────────────────┘                           │
│  │ KeepKey      │                                               │
│  │ Device       │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Generate     │                                               │
│  │ Pubkeys      │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Store in     │                                               │
│  │ localStorage │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Initialize   │                                               │
│  │ Full Mode    │                                               │
│  └──────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Create Pubkey Storage Service

**Location:** `src/services/pubkeyStorageService.ts`

```typescript
interface StoredPubkeys {
  pubkeys: any[];
  deviceInfo: {
    label: string;
    model: string;
    deviceId: string;
    features: any;
  };
  timestamp: number;
  version: string;
}

class PubkeyStorageService {
  private readonly STORAGE_KEY = 'keepkey_vault_pubkeys';
  private readonly VERSION = '1.0.0';

  // Save pubkeys to localStorage
  savePubkeys(pubkeys: any[], deviceInfo: any): void {
    const data: StoredPubkeys = {
      pubkeys,
      deviceInfo,
      timestamp: Date.now(),
      version: this.VERSION,
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // Load pubkeys from localStorage
  loadPubkeys(): StoredPubkeys | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data);

      // Version check
      if (parsed.version !== this.VERSION) {
        console.warn('Pubkey cache version mismatch, clearing cache');
        this.clearPubkeys();
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load pubkeys:', error);
      return null;
    }
  }

  // Check if pubkeys exist
  hasCachedPubkeys(): boolean {
    return this.loadPubkeys() !== null;
  }

  // Clear cached pubkeys
  clearPubkeys(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Get cache age in hours
  getCacheAge(): number | null {
    const data = this.loadPubkeys();
    if (!data) return null;

    const ageMs = Date.now() - data.timestamp;
    return ageMs / (1000 * 60 * 60);
  }
}

export const pubkeyStorage = new PubkeyStorageService();
```

#### Step 2: Modify Startup Flow

**Location:** `src/App.tsx` or main initialization component

```typescript
import { pubkeyStorage } from './services/pubkeyStorageService';

// On component mount
useEffect(() => {
  const initializeVault = async () => {
    const hasCachedPubkeys = pubkeyStorage.hasCachedPubkeys();

    if (hasCachedPubkeys) {
      const cachedData = pubkeyStorage.loadPubkeys();
      const cacheAge = pubkeyStorage.getCacheAge();

      // Show modal: "View-Only Mode Available"
      setViewOnlyModalOpen(true);
      setViewOnlyModalData({
        deviceLabel: cachedData.deviceInfo.label,
        pubkeyCount: cachedData.pubkeys.length,
        lastUpdated: new Date(cachedData.timestamp),
        cacheAge: cacheAge,
      });
    } else {
      // Standard flow: connect to device
      await connectToDevice();
    }
  };

  initializeVault();
}, []);
```

#### Step 3: Create View-Only Mode Modal

**Location:** `src/components/ViewOnlyModeModal.tsx`

```typescript
interface ViewOnlyModeModalProps {
  open: boolean;
  deviceLabel: string;
  pubkeyCount: number;
  lastUpdated: Date;
  cacheAge: number;
  onViewOnly: () => void;
  onFullMode: () => void;
  onClose: () => void;
}

export const ViewOnlyModeModal: React.FC<ViewOnlyModeModalProps> = ({
  open,
  deviceLabel,
  pubkeyCount,
  lastUpdated,
  cacheAge,
  onViewOnly,
  onFullMode,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose}>
      <Box>
        <Typography variant="h5">Cached Wallet Found</Typography>
        <Typography>
          Device: {deviceLabel}
        </Typography>
        <Typography>
          Pubkeys: {pubkeyCount}
        </Typography>
        <Typography>
          Last updated: {lastUpdated.toLocaleString()}
        </Typography>
        <Typography>
          Cache age: {cacheAge.toFixed(1)} hours
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={onViewOnly}
          >
            👁️ View-Only Mode
            <Typography variant="caption" display="block">
              View balances without device
            </Typography>
          </Button>

          <Button
            variant="contained"
            onClick={onFullMode}
          >
            🔐 Full Mode
            <Typography variant="caption" display="block">
              Connect device for signing
            </Typography>
          </Button>
        </Box>

        <Button
          onClick={() => {
            pubkeyStorage.clearPubkeys();
            onClose();
          }}
          sx={{ mt: 2 }}
        >
          Clear cached data
        </Button>
      </Box>
    </Modal>
  );
};
```

#### Step 4: Implement View-Only SDK Initialization

**Location:** `src/contexts/WalletContext.tsx` or SDK initialization logic

```typescript
// View-Only Mode initialization
const initializeViewOnlyMode = async () => {
  const cachedData = pubkeyStorage.loadPubkeys();
  if (!cachedData) throw new Error('No cached pubkeys found');

  // Filter out wildcard networkIds (e.g., "eip155:*")
  const networkIds = [...new Set(
    cachedData.pubkeys.flatMap((pk: any) => pk.networks || [])
  )].filter((id: string) => !id.includes('*'));

  const apiUrl = process.env.REACT_APP_API_URL || 'https://api.keepkey.info';
  const spec = `${apiUrl}/spec/swagger.json`;

  const config = {
    queryKey: `key:view-only-${Date.now()}`,
    username: `user:view-only-${Date.now()}`,
    spec,
    keepkeyApiKey: process.env.REACT_APP_KEEPKEY_API_KEY || 'e4ea6479-5ea4-4c7d-b824-e075101bf9fd',
    wss: process.env.REACT_APP_VITE_PIONEER_URL_WSS || 'wss://api.keepkey.info',
    paths: [],
    blockchains: networkIds,
    pubkeys: cachedData.pubkeys,
    nodes: [],
    balances: [],
    // View-only mode configuration
    viewOnlyMode: true,
    skipDevicePairing: true,
    skipKeeperEndpoint: true,
  };

  const sdk = new SDK.SDK(spec, config);
  await sdk.init({}, { skipSync: false });

  // Verify view-only mode
  if (!sdk.isViewOnlyMode()) {
    throw new Error('Failed to initialize view-only mode');
  }

  if (sdk.canSignTransactions()) {
    throw new Error('View-only mode should not allow signing');
  }

  return sdk;
};

// Full Mode initialization (existing flow + save pubkeys)
const initializeFullMode = async () => {
  // ... existing device connection logic ...

  const sdk = new SDK.SDK(spec, config);
  await sdk.init({}, { skipSync: false });

  // After successful init, save pubkeys
  if (sdk.pubkeys && sdk.pubkeys.length > 0) {
    const deviceInfo = {
      label: sdk.context || 'KeepKey',
      model: 'KeepKey',
      deviceId: sdk.keepKeySdk?.features?.device_id || 'UNKNOWN',
      features: sdk.keepKeySdk?.features || {},
    };

    pubkeyStorage.savePubkeys(sdk.pubkeys, deviceInfo);
  }

  return sdk;
};
```

#### Step 5: Update Portfolio Display

**Location:** `src/components/Portfolio.tsx`

The existing portfolio display should work seamlessly with view-only mode. Just ensure:

1. Disable/hide transaction buttons (Send, Swap, etc.) in view-only mode
2. Add visual indicator that wallet is in view-only mode
3. Add button to switch to full mode (requires device connection)

```typescript
// Add to portfolio header
{sdk.isViewOnlyMode() && (
  <Alert severity="info">
    👁️ View-Only Mode - Connect device to send transactions
    <Button onClick={switchToFullMode}>Connect Device</Button>
  </Alert>
)}
```

#### Step 6: Handle Mode Switching

**Location:** `src/contexts/WalletContext.tsx`

```typescript
const switchToFullMode = async () => {
  // Clear current SDK
  await sdk.disconnect();

  // Show device connection modal
  setShowDeviceConnectionModal(true);

  // Initialize full mode
  const newSdk = await initializeFullMode();
  setSdk(newSdk);

  // Update pubkey cache with fresh data
  if (newSdk.pubkeys && newSdk.pubkeys.length > 0) {
    const deviceInfo = {
      label: newSdk.context || 'KeepKey',
      model: 'KeepKey',
      deviceId: newSdk.keepKeySdk?.features?.device_id || 'UNKNOWN',
      features: newSdk.keepKeySdk?.features || {},
    };
    pubkeyStorage.savePubkeys(newSdk.pubkeys, deviceInfo);
  }
};

const switchToViewOnlyMode = async () => {
  // Verify pubkeys exist
  if (!pubkeyStorage.hasCachedPubkeys()) {
    throw new Error('No cached pubkeys available');
  }

  // Disconnect device if connected
  await sdk.disconnect();

  // Initialize view-only mode
  const newSdk = await initializeViewOnlyMode();
  setSdk(newSdk);
};
```

### Security Considerations

1. **Storage Security**
   - Pubkeys are NOT sensitive (they're public keys)
   - No private keys or seeds are stored
   - localStorage is acceptable for pubkeys
   - Consider adding encryption for device metadata

2. **View-Only Limitations**
   - Clearly indicate view-only mode status
   - Disable all signing operations
   - No access to private key operations
   - Cannot send transactions, sign messages, etc.

3. **Cache Invalidation**
   - Allow users to clear cache manually
   - Consider auto-refresh if cache is old (>7 days?)
   - Prompt to update cache if pubkeys seem stale

### Testing Plan

1. **E2E Test Coverage**
   - Test pubkey generation and storage
   - Test view-only mode initialization
   - Test balance fetching in view-only mode
   - Test mode switching (view-only ↔ full)
   - Test cache invalidation
   - Test with multiple devices

2. **User Scenarios**
   - First-time user: No cache → connect device → generate pubkeys → store
   - Returning user: Has cache → choose view-only → view portfolio
   - Mode switch: View-only → need to send → switch to full mode
   - Cache clear: Clear cache → start fresh → connect device
   - Multiple devices: Switch between different cached devices

3. **Error Handling**
   - Cache corruption → clear and re-initialize
   - API failures → show error, suggest retry
   - Network issues → offline mode with cached data
   - Device disconnected mid-session → handle gracefully

### Performance Benefits

Based on E2E test results:

- **Startup time**: ~0ms (no device initialization)
- **Balance fetch**: 617ms (same as full mode)
- **Total time to portfolio**: <1 second

**Full Mode:**
- Device connection: ~2-5 seconds
- Pubkey generation: ~3-10 seconds
- Total startup: ~5-15 seconds

**View-Only Mode:**
- Load from localStorage: <10ms
- SDK initialization: ~100ms
- Balance fetch: ~617ms
- Total startup: <1 second

**Performance improvement: 10-15x faster startup**

### User Experience Improvements

1. **Fast Portfolio Access**
   - Users can check balances instantly
   - No need to have device nearby
   - Works on mobile, desktop, anywhere

2. **Mobile QR Code Flow**
   - Generate pubkeys on desktop with device
   - Export pubkeys as QR code
   - Scan QR code on mobile
   - View portfolio on mobile without device

3. **Multi-Device Sync**
   - Export pubkeys from one device
   - Import to another device
   - Consistent view across all devices

### Future Enhancements

1. **Cloud Backup** (optional)
   - Encrypted pubkey backup to cloud
   - Sync across devices automatically
   - User-controlled encryption key

2. **Read-Only API Key**
   - Generate read-only API keys
   - Share with accountants, family, etc.
   - Revokable access

3. **Notification Support**
   - Push notifications for balance changes
   - Works without device connection
   - Based on cached pubkeys

4. **Price Alerts**
   - Set price alerts for assets
   - Monitor portfolio in view-only mode
   - No device required

## Implementation Timeline

### Phase 1: Core Implementation (Week 1)
- [ ] Create pubkey storage service
- [ ] Modify startup flow to check cache
- [ ] Implement view-only SDK initialization
- [ ] Basic UI for mode selection

### Phase 2: UI/UX Polish (Week 2)
- [ ] Create view-only mode modal
- [ ] Add visual indicators for view-only mode
- [ ] Implement mode switching
- [ ] Polish portfolio display

### Phase 3: Testing & Documentation (Week 3)
- [ ] Write E2E tests
- [ ] Test all user scenarios
- [ ] Document API usage
- [ ] Create user guide

### Phase 4: Mobile QR Flow (Week 4)
- [ ] Implement QR code export
- [ ] Implement QR code import
- [ ] Test mobile flow
- [ ] Document mobile setup

## Success Metrics

1. **Performance**
   - Startup time: <1 second in view-only mode
   - Balance fetch: <1 second
   - Mode switching: <2 seconds

2. **User Adoption**
   - 50%+ of users enable view-only mode
   - 80%+ of sessions start in view-only mode
   - 90%+ positive user feedback

3. **Reliability**
   - 99%+ success rate for cache loading
   - 99%+ success rate for balance fetching
   - <1% cache corruption rate

## References

- **Proof of Concept:** `/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/e2e/wallets/intergration-view-only`
- **Working Test:** `/Users/highlander/WebstormProjects/keepkey-stack/projects/pioneer/e2e/wallets/intergration-coins`
- **Pioneer SDK:** `@pioneer-platform/pioneer-sdk`
- **API Documentation:** `https://api.keepkey.info/spec/swagger.json`

## Conclusion

View-only mode is a proven pattern that significantly improves user experience by providing instant portfolio access without requiring a connected device. The implementation is straightforward, secure (no private keys stored), and provides measurable performance benefits.

The proof-of-concept successfully demonstrated:
- ✅ Pubkey caching works reliably
- ✅ View-only mode can fetch complete portfolio
- ✅ No device connection required
- ✅ 10-15x faster startup time
- ✅ Beautiful formatted display

Ready for production implementation in KeepKey Vault.
