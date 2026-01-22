# App Store Testing Guide

## For App Store Reviewers and Testers

This guide explains how to test the KeepKey Mobile app for app store submission without requiring a physical KeepKey hardware device.

## 🔑 Permanent Test Pairing Code

**Test Code: `TESTTEST`**

This is a permanent, never-expiring pairing code that provides access to a test wallet with real blockchain balances for demonstration purposes.

### Quick Start

1. **Open KeepKey Mobile App**
2. **Select "Pair via Manual Code"**
3. **Enter Code**: `TESTTEST`
4. **Tap "Pair Wallet"**
5. **View Portfolio**: The app will load a test wallet with multi-chain balances

## 📱 What You'll See

### Test Wallet Details

**Device Label**: KeepKey TestNet
**Device ID**: TEST-APPSTORE-DEVICE
**Chains Supported**: 17 blockchains
**Total Pubkeys**: 17 public addresses

### Supported Blockchains

The test wallet includes addresses for:

**UTXO Chains**:
- Bitcoin (BTC) - Legacy, SegWit, Native SegWit
- Litecoin (LTC) - Legacy & Native SegWit
- Dogecoin (DOGE)
- Bitcoin Cash (BCH)
- Dash (DASH)

**EVM Chains**:
- Ethereum (ETH) - Works across all EVM networks
- All EVM-compatible chains via wildcard support

**Cosmos Ecosystem**:
- Cosmos Hub (ATOM)
- Osmosis (OSMO)
- THORChain (RUNE)
- Maya Protocol (CACAO)

**Other Chains**:
- Ripple (XRP)
- Solana (SOL)
- TRON (TRX)
- TON (Toncoin)

## 🎯 Testing Scenarios

### 1. Basic Portfolio View
- ✅ Verify wallet loads successfully
- ✅ Check multiple chains display
- ✅ Confirm balances appear (may be zero if no funds)
- ✅ Test scrolling through asset list

### 2. Multi-Chain Support
- ✅ Switch between different blockchains
- ✅ View addresses for each chain
- ✅ Check address formatting (Bitcoin bech32, Ethereum 0x, etc.)

### 3. Watch-Only Mode Verification
- ✅ Confirm security banner displays at top
- ✅ Verify "Mobile App • Watch-Only" message shows
- ✅ Check warning: "Never enter your recovery seed"
- ✅ Attempt to send transaction → Should show watch-only warning

### 4. Security Messaging
- ✅ Warning displays when trying to send
- ✅ "Watch-Only Mode" dialog appears
- ✅ Scam warning visible: "Any wallet claiming to be KeepKey asking for seeds is a SCAM"

### 5. Data Persistence
- ✅ Close and reopen app → Portfolio data persists
- ✅ Background app → Return → Data still loaded
- ✅ Refresh → Balances update (if connected to internet)

## 🔒 Security Information for Reviewers

### What the Test Code Provides

**Safe to Use**:
- ✅ Public keys only (addresses)
- ✅ Read-only portfolio access
- ✅ No private keys included
- ✅ Cannot sign transactions
- ✅ Cannot move funds

**NOT Included**:
- ❌ No recovery seeds
- ❌ No private keys
- ❌ No spending capability
- ❌ No personal information

### Privacy & Safety

The test pubkeys are:
- Public information (safe to share)
- Used only for demonstration
- Do NOT contain sensitive data
- Cannot access or move real funds
- Derived from a reference test seed for E2E testing

## 📊 Expected Behavior

### On First Pair

1. User enters `TESTTEST` code
2. App fetches test pubkeys from vault
3. Portfolio loads with ~17 addresses
4. Balances fetch from blockchain APIs
5. Watch-only banner appears at top
6. User can view but NOT send

### On Subsequent Opens

1. App loads from cached storage
2. Portfolio displays immediately
3. Balances refresh from APIs
4. Watch-only reminders persist

## ⚠️ Watch-Only Mode Features

### What Users CAN Do

✅ View portfolio balances
✅ See transaction history
✅ Monitor asset prices
✅ Track portfolio performance
✅ View addresses and QR codes
✅ Refresh balance data

### What Users CANNOT Do

❌ Send transactions
❌ Sign messages
❌ Access private keys
❌ Export recovery seeds
❌ Modify wallet settings requiring device

When attempting restricted actions, users see:
- Watch-only mode warning
- Instructions to use desktop with hardware device
- Security warnings about never entering seeds

## 🧪 Testing Checklist

### Initial Setup
- [ ] Install mobile app
- [ ] Open app for first time
- [ ] See onboarding/pairing screen
- [ ] Choose "Manual Code Entry"
- [ ] Enter `TESTTEST`
- [ ] Successfully pair

### Portfolio Functionality
- [ ] Portfolio loads with balances
- [ ] Multiple chains visible
- [ ] Asset icons display correctly
- [ ] Prices show (if API available)
- [ ] Total portfolio value calculates
- [ ] Can switch between chains
- [ ] Addresses display correctly

### Watch-Only Verification
- [ ] Orange warning banner at top
- [ ] "Watch-Only" label visible
- [ ] Security message displays
- [ ] Try to send → Warning appears
- [ ] Cannot proceed with send
- [ ] Scam warning visible in dialog

### Data & Performance
- [ ] App loads in <3 seconds
- [ ] Balances update on refresh
- [ ] Data persists after app close
- [ ] Works offline (cached data)
- [ ] No crashes or errors

### Security & Privacy
- [ ] No seed entry prompts
- [ ] No private key access
- [ ] Warnings prominent
- [ ] Cannot disable watch-only mode
- [ ] Signing operations blocked

## 🌐 Network Requirements

**Internet Required**:
- Initial pairing (fetch pubkeys)
- Balance updates
- Price data fetching

**Works Offline**:
- View cached portfolio
- See addresses
- Read-only operations

## 🔧 Troubleshooting

### "Pairing code not found"
- Ensure code is exactly: `TESTTEST` (all caps)
- Check internet connection
- Verify vault URL is reachable

### "No balances showing"
- This may be normal if test addresses have zero balance
- Check blockchain API connectivity
- Wait 10-30 seconds for initial fetch

### "App crashes on pair"
- Check mobile app logs
- Verify React Native WebView working
- Ensure sufficient device memory

## 📞 Support for Reviewers

If you encounter issues during testing:

1. **Check Code**: Verify `TESTTEST` spelled correctly
2. **Internet**: Ensure device online
3. **Clear Cache**: Uninstall/reinstall if needed
4. **Logs**: Check console for error messages

## 🏗️ Technical Details for Reviewers

### How Test Code Works

1. **API Endpoint**: `/api/pairing/TESTTEST`
2. **Response**: Returns hardcoded test pubkeys
3. **Storage**: Mobile app stores in AsyncStorage
4. **Display**: WebView loads vault with test data
5. **Security**: Pubkeys only, no private keys

### Data Source

Test pubkeys sourced from:
```
projects/pioneer/e2e/wallets/intergration-view-only/pubkeys.json
```

These are the SAME pubkeys used for automated E2E testing of the Pioneer SDK view-only mode.

### Vault Integration

The mobile app loads KeepKey Vault in a WebView and injects:
- Test pubkeys
- Device info
- `keepkey_mobile_mode = true` flag

The vault detects mobile mode and shows appropriate warnings.

## ✅ App Store Submission Notes

### For App Store Review Team

**This is a watch-only cryptocurrency portfolio viewer**

**Key Points**:
1. Does NOT hold private keys
2. Does NOT enable transactions (watch-only)
3. Requires desktop hardware wallet for signing
4. Mobile app is READ-ONLY portfolio monitor
5. Uses test code for demonstration/review only

**Privacy & Security**:
- No personal information collected
- No authentication required for demo
- Public blockchain data only
- Open source and auditable
- No server-side user accounts

**Permissions Required**:
- Camera: For QR code scanning (pairing codes)
- Network: For blockchain balance fetching
- Storage: For caching portfolio data

## 📄 Related Documentation

- **Mobile Detection**: `projects/keepkey-vault/MOBILE_DETECTION.md`
- **View-Only Mode**: `projects/pioneer/e2e/wallets/intergration-view-only/README.md`
- **Mobile App**: `projects/keepkey-mobile-expo/README.md`
- **Pairing System**: `projects/keepkey-mobile-expo/PAIRING_IMPLEMENTATION.md`

## 🔐 Security Reminders

**For End Users** (not reviewers):

⚠️ **NEVER enter your KeepKey recovery seed into the mobile app**
⚠️ **ANY wallet asking for seeds is a SCAM**
⚠️ **Private keys MUST stay on hardware device**

The test code is ONLY for app store review and demonstration purposes. Real users should pair with their own hardware device via QR code from desktop.

---

**Test Code**: `TESTTEST`
**Version**: 1.0.1
**Last Updated**: December 2024

For technical support or questions, see repository documentation.
