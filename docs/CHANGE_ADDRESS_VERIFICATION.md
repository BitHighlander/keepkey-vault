# Change Address Verification on KeepKey Device

## Overview

This feature allows users to verify their Bitcoin change addresses on their KeepKey hardware device during the transaction review process. This enhances transaction transparency and security by letting users confirm that the change from their transaction is being sent back to an address they control.

## User Experience

### Change Output Display

When reviewing a Bitcoin transaction that includes change outputs, users will see:

1. **Header Section**
   - Bitcoin icon (🪙)
   - "Your Change Address" label
   - Address type badge (e.g., "Legacy (P2PKH)", "Native SegWit (P2WPKH)")

2. **Address Information**
   - If address is pre-computed: Shows the full Bitcoin address
   - If address not computed: Shows the BIP32 derivation path
   - Example path: `m/44'/0'/0'/1/1` (change address at index 1)

3. **Verification Button**
   - "View & Verify on Device" button with eye icon
   - When clicked, displays the change address on the KeepKey screen
   - Uses the same verification flow as receiving addresses

### Transaction Flow

```
User creates transaction
    ↓
Reviews transaction details
    ↓
Sees change output information
    ↓
[Optional] Clicks "View & Verify on Device"
    ↓
KeepKey displays change address
    ↓
User verifies it matches expected path/address
    ↓
User signs transaction
```

## Technical Implementation

### Components Modified

#### 1. ChangeControl.tsx
**Location**: `src/components/send/ChangeControl.tsx`

**Changes**:
- Removed firmware validation message box (redundant information)
- Added Bitcoin icon and clear ownership messaging
- Displays derivation path when address not available
- Added "View & Verify on Device" button
- Added `onViewOnDevice` callback prop for device verification

**Key Functions**:
```typescript
interface ChangeControlProps {
  changeOutputs: ChangeOutput[];
  assetColor: string;
  assetColorLight: string;
  theme: any;
  onChangeAddressUpdate?: (outputIndex: number, newScriptType: string) => void;
  onViewOnDevice?: (output: ChangeOutput) => void;  // NEW
  usageInfo?: Record<string, AddressUsageInfo>;
}
```

#### 2. Send.tsx
**Location**: `src/components/send/Send.tsx`

**Changes**:
- Added `handleViewChangeOnDevice` function
- Uses KeepKey SDK to display address on device
- Passes callback to ReviewTransaction component

**Key Implementation**:
```typescript
const handleViewChangeOnDevice = async (output: any) => {
  if (!app?.keepKeySdk) return;

  const addressNList = output.addressNList || output.address_n;
  const scriptType = output.scriptType || 'p2wpkh';

  // Call KeepKey SDK directly with exact path
  const addressInfo = {
    address_n: addressNList,      // Complete BIP32 path
    show_display: true,            // Show on device screen
    script_type: scriptType,       // Address format
    coin: 'Bitcoin'                // Network
  };

  const { address } = await app.keepKeySdk.address.utxoGetAddress(addressInfo);
}
```

#### 3. ReviewTransaction.tsx
**Location**: `src/components/send/ReviewTransaction.tsx`

**Changes**:
- Added `onViewChangeOnDevice` prop to interface
- Passes callback through to ChangeControl component
- Minimal changes for prop drilling

### KeepKey SDK Integration

The implementation uses the same SDK pattern as the Receive tab:

```typescript
// Direct SDK call with complete address path
await app.keepKeySdk.address.utxoGetAddress({
  address_n: [2147483692, 2147483648, 2147483648, 1, 1],  // m/44'/0'/0'/1/1
  show_display: true,
  script_type: 'p2pkh',
  coin: 'Bitcoin'
})
```

**Important**: The complete `addressNList` is passed directly without modification. Earlier attempts to reconstruct the path were causing incorrect paths to be shown on the device.

### BIP32 Path Format

Change addresses follow BIP44 standard:
```
m / purpose' / coin_type' / account' / change / address_index
```

Example paths:
- `m/44'/0'/0'/1/1` - Legacy change address #1
- `m/49'/0'/0'/1/0` - Nested SegWit change address #0
- `m/84'/0'/0'/1/5` - Native SegWit change address #5

The `change` field:
- `0` = receive addresses
- `1` = change addresses

## Security Considerations

### Why This Matters

1. **Address Ownership Verification**: Users can confirm the change address belongs to their wallet
2. **Protection Against Address Substitution**: Prevents malware from replacing change address with attacker's address
3. **Transaction Transparency**: Users see exactly where their change is going
4. **Hardware Security**: Verification happens on the secure hardware device

### Firmware Validation

The KeepKey firmware internally validates that:
- The derivation path belongs to the connected device
- The path is within valid BIP32 bounds
- The address can be derived from the device's seed

Users see this validation happen on the device screen when they verify the address.

## Future Enhancements

Potential improvements:
1. Auto-fetch and display change address on transaction review (currently only shown on button click)
2. Cache derived addresses to avoid multiple device calls
3. Show address usage history (which change addresses have been used)
4. Support for multi-output transactions with multiple change addresses
5. Add address verification for non-Bitcoin UTXO chains (LTC, DOGE, etc.)

## Testing

### Manual Testing Steps

1. **Setup**
   - Connect KeepKey device
   - Navigate to Send tab
   - Select Bitcoin as asset

2. **Create Transaction**
   - Enter recipient address
   - Enter amount (not MAX to generate change)
   - Click "Review Transaction"

3. **Verify Change Display**
   - Confirm "Change Output Information" section appears
   - Verify Bitcoin icon and "Your Change Address" header shown
   - Check derivation path is displayed
   - Confirm address type badge matches expected script type

4. **Test Device Verification**
   - Click "View & Verify on Device" button
   - Check KeepKey screen displays change address
   - Verify path matches what's shown in UI
   - Confirm address format is correct

5. **Complete Transaction**
   - Sign transaction on device
   - Verify transaction broadcasts successfully

### Edge Cases

- Transaction with no change (MAX amount)
- Transaction with multiple change outputs
- Different script types (P2PKH, P2SH-P2WPKH, P2WPKH, P2TR)
- Network errors during address verification
- Device disconnection during verification

## Troubleshooting

### Common Issues

**Issue**: "View on Device" button disabled
- **Cause**: `onViewOnDevice` callback not provided
- **Solution**: Check that callback is passed through component props

**Issue**: Wrong path shown on device
- **Cause**: Path reconstruction modifying addressNList
- **Solution**: Pass complete addressNList directly to SDK without modification

**Issue**: "KeepKey SDK not available" error
- **Cause**: SDK not initialized or device disconnected
- **Solution**: Check `app.keepKeySdk` exists before calling

**Issue**: Address format doesn't match script type
- **Cause**: Incorrect script_type parameter
- **Solution**: Verify script type from output matches device expectation

## References

- [BIP32: Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP44: Multi-Account Hierarchy](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [KeepKey SDK Documentation](../../README.md)
- [UTXO Change Control Feature](./UTXO_CHANGE_CONTROL.md)
