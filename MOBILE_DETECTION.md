# Mobile App Detection & Security Warnings

This document describes the mobile app detection system and security warning implementation for KeepKey Vault.

## Overview

The KeepKey Vault runs in two distinct modes:

1. **Web Browser Mode**: Full functionality with hardware wallet connection support
2. **Mobile App Mode**: Watch-only mode via WebView in the React Native mobile app

The mobile app is strictly watch-only and displays critical security warnings to prevent users from entering recovery seeds.

## How Detection Works

### Mobile App Flag Injection

The mobile app (`keepkey-mobile-expo`) injects a localStorage flag when loading the vault in a WebView:

```javascript
// File: projects/keepkey-mobile-expo/src/screens/VaultWebViewScreen.js (line 101)
localStorage.setItem('keepkey_mobile_mode', 'true');
```

This flag is set during the WebView injection process along with wallet data (pubkeys, device info).

### Platform Detection Utility

The vault uses a utility function to detect the current platform:

```typescript
// File: projects/keepkey-vault/src/lib/platformDetection.ts

export function isMobileApp(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    return localStorage.getItem('keepkey_mobile_mode') === 'true';
  } catch (error) {
    console.error('[Platform Detection] Error checking mobile mode:', error);
    return false;
  }
}
```

Additional helper functions:
- `isWebBrowser()`: Returns `!isMobileApp()` - detects web browser mode
- `isStandalone()`: Detects PWA/installed app mode
- `supportsHardwareWallet()`: Returns `isWebBrowser()` - only web supports hardware wallet connection
- `getPlatformInfo()`: Returns comprehensive platform information
- `getPlatformDisplayName()`: Returns user-friendly platform name for UI

## Security Warning Components

### 1. MobileWatchOnlyWarning Component

**Location**: `src/components/warnings/MobileWatchOnlyWarning.tsx`

A dedicated warning component with three display variants:

#### Variants

**`full`** (default): Complete security information
- Mobile app badge
- Watch-only explanation
- Security warnings about recovery seeds
- Scam warning about fake wallets
- Usage instructions

**`banner`**: Compact banner style
- Mobile icon with shield
- Brief watch-only message
- Minimal space usage

**`inline`**: Minimal inline display
- Single line warning
- Suitable for tight layouts

#### Usage

```typescript
import { MobileWatchOnlyWarning } from '@/components/warnings/MobileWatchOnlyWarning';

// Full warning (recommended for dialogs)
<MobileWatchOnlyWarning variant="full" />

// Banner style (for persistent headers)
<MobileWatchOnlyWarning variant="banner" />

// Inline style (for tight spaces)
<MobileWatchOnlyWarning variant="inline" />
```

### 2. ConnectKeepKeyDialog Enhancement

**Location**: `src/components/send/ConnectKeepKeyDialog.tsx`

The KeepKey connection dialog now shows different content based on platform:

**Web Browser Mode**:
- Shows standard "Connect Your KeepKey" instructions
- USB connection steps
- Refresh and connect options

**Mobile App Mode**:
- Changes title to "Watch-Only Mode"
- Displays full `MobileWatchOnlyWarning` component
- Shows only "Close" button (no connection options)

#### Implementation

```typescript
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  if (isOpen) {
    setIsMobile(isMobileApp());
  }
}, [isOpen]);

// Conditional rendering
{isMobile ? (
  <MobileWatchOnlyWarning variant="full" />
) : (
  <StandardConnectionInstructions />
)}
```

### 3. ViewOnlyBanner Enhancement

**Location**: `src/components/ViewOnlyBanner.tsx`

The persistent banner at the top of the vault shows different messaging:

**Web Browser Mode** (original behavior):
- Gold theme
- "View-Only Mode" with device label
- "Connect Device" button
- Dismiss option

**Mobile App Mode** (new behavior):
- Orange/warning theme
- "Mobile App • Watch-Only" badge
- Security shield icon
- Warning: "Never enter your recovery seed"
- Message: "Private keys stay on your hardware device"
- Dismiss option only (no connect button)

## Security Messages

### Key Security Points Displayed

1. **Watch-Only Mode**
   - Mobile app provides read-only portfolio view
   - No transaction signing capability in mobile app

2. **Never Enter Seeds**
   - Users should NEVER enter recovery seeds into the mobile app
   - Seeds should NEVER be entered into ANY software wallet
   - Seeds are only for hardware device initialization

3. **Hardware-Only Security**
   - Private keys remain on KeepKey hardware device
   - Mobile app only stores public keys (addresses)

4. **Scam Warning**
   - Any wallet claiming to be KeepKey and asking for seeds is a SCAM
   - KeepKey only asks for seeds during initial device setup ON THE DEVICE

## Testing the Implementation

### Test in Web Browser

1. Open vault in normal browser: `http://localhost:3000`
2. Should see standard view-only banner (gold theme)
3. Should see standard connection dialog

### Test in Mobile App Mode

1. Set mobile flag in browser console:
   ```javascript
   localStorage.setItem('keepkey_mobile_mode', 'true');
   ```
2. Refresh page
3. Should see orange warning banner at top
4. Should see mobile-specific warnings in dialogs

### Test with Mobile App

1. Build and run mobile app:
   ```bash
   cd projects/keepkey-mobile-expo
   npm start
   ```
2. Pair device with QR code
3. Verify vault loads in WebView
4. Verify warning banner appears
5. Try to send transaction - should show watch-only warning

## Files Modified

### New Files
- `src/lib/platformDetection.ts` - Platform detection utilities
- `src/components/warnings/MobileWatchOnlyWarning.tsx` - Warning component

### Modified Files
- `src/components/send/ConnectKeepKeyDialog.tsx` - Mobile-aware connection dialog
- `src/components/ViewOnlyBanner.tsx` - Mobile-aware banner

## Integration Points

The mobile detection system is used in:

1. **Connection Dialogs**: Show watch-only warning instead of connection instructions
2. **Persistent Banners**: Display security reminders at all times
3. **Transaction Flows**: Can be used to prevent signing attempts in mobile mode
4. **Settings/Info Pages**: Can show platform-specific help text

## Future Enhancements

Potential future improvements:

1. **Proactive Warnings**
   - Show warning when user attempts transaction-related actions
   - Toast notifications for security reminders

2. **Platform-Specific Features**
   - Mobile-optimized UI layouts
   - Touch-friendly controls for mobile users
   - Mobile-specific help documentation

3. **Enhanced Detection**
   - User agent analysis for additional validation
   - WebView API detection
   - React Native bridge detection

## Security Considerations

### Why This Matters

The mobile detection and warning system is critical for user security:

1. **Prevent Seed Entry**: Users might mistakenly think they need to enter seeds in the mobile app
2. **Prevent Scams**: Malicious apps could impersonate KeepKey and request seeds
3. **Set Expectations**: Users understand mobile app limitations upfront
4. **Maintain Trust**: Clear communication about security model builds confidence

### Best Practices

1. **Always Show Warnings**: Never hide security warnings for convenience
2. **Clear Language**: Use non-technical language users can understand
3. **Persistent Reminders**: Banner stays visible throughout session
4. **Multiple Touch Points**: Show warnings in dialogs, banners, and flows
5. **Scam Education**: Explicitly warn about fake wallet scams

## Troubleshooting

### Mobile flag not detected

**Cause**: localStorage not persisting or cleared
**Solution**: Mobile app re-injects flag on each load via WebView injection

### Wrong mode detected

**Cause**: localStorage manually modified
**Solution**: Clear localStorage and reload; mobile app will re-inject correct flag

### Banner not showing

**Cause**: Component not mounted or detection failing
**Solution**: Check console for errors; verify ViewOnlyBanner is in layout

## Related Documentation

- Mobile App: `projects/keepkey-mobile-expo/README.md`
- Pairing System: `projects/keepkey-mobile-expo/PAIRING_IMPLEMENTATION.md`
- Vault Architecture: `projects/keepkey-vault/README.md`
